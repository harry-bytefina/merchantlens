import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyze } from '../build-core/engine.js';
import { merchants } from '../build-core/data.js';
import { createModelClient, ModelError } from './model.mjs';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VALID_DATES = new Set(['2026-09-28', '2026-09-29']);
const VALID_MERCHANTS = new Set(merchants.map((merchant) => merchant.id));
const MAX_BODY_BYTES = 16_384;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
};

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function isLocalHostname(hostname) {
  return ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
}

function localRequest(req) {
  try {
    const host = new URL(`http://${req.headers.host || ''}`);
    if (!isLocalHostname(host.hostname) || host.username || host.password) return false;
    if (!req.headers.origin) return true;
    const origin = new URL(req.headers.origin);
    return (
      ['http:', 'https:'].includes(origin.protocol) &&
      isLocalHostname(origin.hostname) &&
      !origin.username &&
      !origin.password
    );
  } catch {
    return false;
  }
}

function secureHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  );
}

function json(res, status, payload) {
  const content = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(content),
  });
  res.end(content);
}

async function readJson(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || ''))
    throw new HttpError(415, 'JSON_REQUIRED', '请使用 application/json 请求。');
  if (Number(req.headers['content-length']) > MAX_BODY_BYTES) {
    req.resume();
    throw new HttpError(413, 'BODY_TOO_LARGE', '请求体不得超过 16 KB。');
  }
  const body = await new Promise((resolveBody, rejectBody) => {
    let size = 0;
    const chunks = [];
    const cleanup = () => {
      req.removeListener('data', data);
      req.removeListener('end', end);
      req.removeListener('error', error);
      req.removeListener('aborted', aborted);
    };
    const data = (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        cleanup();
        req.resume();
        rejectBody(new HttpError(413, 'BODY_TOO_LARGE', '请求体不得超过 16 KB。'));
        return;
      }
      chunks.push(chunk);
    };
    const end = () => {
      cleanup();
      resolveBody(Buffer.concat(chunks).toString('utf8'));
    };
    const error = () => {
      cleanup();
      rejectBody(new HttpError(400, 'BODY_INTERRUPTED', '请求体读取失败。'));
    };
    const aborted = () => {
      cleanup();
      rejectBody(new HttpError(400, 'BODY_INTERRUPTED', '请求已中断。'));
    };
    req.on('data', data);
    req.once('end', end);
    req.once('error', error);
    req.once('aborted', aborted);
  });
  try {
    return JSON.parse(body);
  } catch {
    throw new HttpError(400, 'INVALID_JSON', '请求体不是有效 JSON。');
  }
}

export function validateAssistRequest(body) {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => !['query', 'scope'].includes(key)) ||
    typeof body.query !== 'string' ||
    !body.query.trim() ||
    body.query.length > 2000 ||
    !body.scope ||
    typeof body.scope !== 'object' ||
    Array.isArray(body.scope) ||
    Object.keys(body.scope).length !== 2 ||
    Object.keys(body.scope).some((key) => !['merchantId', 'billDate'].includes(key)) ||
    !VALID_MERCHANTS.has(body.scope.merchantId) ||
    !VALID_DATES.has(body.scope.billDate)
  ) {
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      '仅接受 query 与 scope；请选择演示商户和有效账单日期。',
    );
  }
  return {
    query: body.query.trim(),
    scope: { merchantId: body.scope.merchantId, billDate: body.scope.billDate },
  };
}

function evidenceText(answer) {
  return [
    answer.summary,
    ...answer.sections.map((section) => `${section.title}：${section.content}`),
  ]
    .filter(Boolean)
    .join('\n\n');
}

async function serveStatic(req, res, distDir) {
  const rawPath = (req.url || '/').split('?')[0];
  let decoded;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    throw new HttpError(400, 'INVALID_PATH', '路径编码无效。');
  }
  if (
    !decoded.startsWith('/') ||
    decoded.includes('\\') ||
    decoded.includes('\0') ||
    decoded.split('/').some((part) => part === '..' || part.startsWith('.'))
  ) {
    throw new HttpError(403, 'PATH_BLOCKED', '此路径不可访问。');
  }
  const root = await realpath(distDir).catch(() => {
    throw new HttpError(503, 'BUILD_MISSING', '尚未生成前端构建，请先运行 npm run build。');
  });
  let candidate = resolve(root, `.${decoded === '/' ? '/index.html' : decoded}`);
  if (candidate !== root && !candidate.startsWith(root + sep))
    throw new HttpError(403, 'PATH_BLOCKED', '此路径不可访问。');
  let metadata = await stat(candidate).catch(() => null);
  if (!metadata?.isFile() && !extname(decoded) && !decoded.startsWith('/api/')) {
    candidate = resolve(root, 'index.html');
    metadata = await stat(candidate).catch(() => null);
  }
  if (!metadata?.isFile()) throw new HttpError(404, 'NOT_FOUND', '资源不存在。');
  const resolvedFile = await realpath(candidate);
  if (!resolvedFile.startsWith(root + sep))
    throw new HttpError(403, 'PATH_BLOCKED', '此路径不可访问。');
  const extension = extname(candidate);
  res.writeHead(200, {
    'Content-Type': TYPES[extension] || 'application/octet-stream',
    'Cache-Control': extension === '.html' ? 'no-store' : 'public, max-age=3600',
    'Content-Length': metadata.size,
  });
  res.end(req.method === 'HEAD' ? undefined : await readFile(resolvedFile));
}

/** Injectable dependencies permit meaningful tests without network or credentials. */
export function createAppServer({
  distDir = resolve(PROJECT_ROOT, 'dist'),
  analyzeFn = analyze,
  modelClient = createModelClient(),
} = {}) {
  const server = createServer(async (req, res) => {
    secureHeaders(res);
    try {
      if (!localRequest(req))
        throw new HttpError(403, 'ORIGIN_BLOCKED', '仅允许本机来源访问此演示服务。');
      const pathname = new URL(req.url || '/', 'http://localhost').pathname;
      if (pathname === '/api/model-status' && req.method === 'GET')
        return json(res, 200, modelClient.status());
      if (pathname === '/api/assist' && req.method === 'POST') {
        const request = validateAssistRequest(await readJson(req));
        const answer = analyzeFn(request.query, request.scope);
        if (answer.status !== 'answered' || ['blocked', 'unsupported'].includes(answer.intent)) {
          return json(res, 200, {
            text: evidenceText(answer),
            model: 'evidence-engine',
            citations: answer.evidence.map((item) => item.id),
          });
        }
        const result = await modelClient.assist({ ...request, answer });
        return json(res, 200, result);
      }
      if (pathname === '/api/model-status' || pathname === '/api/assist')
        throw new HttpError(405, 'METHOD_NOT_ALLOWED', '请求方法不受支持。');
      if (pathname.startsWith('/api/')) throw new HttpError(404, 'API_NOT_FOUND', 'API 不存在。');
      if (!['GET', 'HEAD'].includes(req.method))
        throw new HttpError(405, 'METHOD_NOT_ALLOWED', '请求方法不受支持。');
      await serveStatic(req, res, distDir);
    } catch (error) {
      if (res.writableEnded || res.destroyed) return;
      if (error instanceof HttpError || error instanceof ModelError)
        return json(res, error.status, { error: error.code, message: error.message });
      // Deliberately omit payloads, provider response bodies and raw exceptions.
      json(res, 500, { error: 'INTERNAL_ERROR', message: '服务暂时不可用，请使用本地证据分析。' });
    }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5000;
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 5180);
  if (!Number.isInteger(port) || port < 1024 || port > 65_535)
    throw new Error('PORT 必须是 1024–65535 之间的整数。');
  const server = createAppServer();
  server.listen(port, '127.0.0.1', () =>
    console.log(`Merchant Copilot 本机服务：http://127.0.0.1:${port}`),
  );
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
}
