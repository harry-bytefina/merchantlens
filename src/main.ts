import './styles.css';
import { merchants, defaultScope, knowledge } from './data';
import { renderInternship, bindInternship } from './internship.js';
import { reconcile, analyze, money, exportTicket, getScopedRows } from './engine';
import { evaluationCases, runEvaluation } from './eval';
import { icon } from './icons';
import type { Scope, AuditEvent, EvaluationResult } from './types';

type Tab = 'internship' | 'workbench' | 'evaluation' | 'product' | 'evidence' | 'audit';
type Feedback = { answerId: string; query: string; helpful: boolean; time: string; scope: Scope };
type ProjectNotes = {
  text: string;
  savedAt: string | null;
  previous: { text: string; savedAt: string | null } | null;
};
const escape = (v: unknown) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const readLocal = <T>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
};
const saveLocal = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    toast('浏览器未允许本地保存，当前会话仍可体验。');
  }
};
const qaSession = new URLSearchParams(window.location.search).has('qa');
const auditKey = qaSession ? 'merchantlens-audit-qa-v1' : 'merchantlens-audit-v1';
const feedbackKey = qaSession ? 'merchantlens-feedback-qa-v1' : 'merchantlens-feedback-v1';
const projectNotesKey = qaSession
  ? 'merchantlens-project-notes-qa-v1'
  : 'merchantlens-project-notes-v1';
const notesLimit = 12000;
let projectNotes = readProjectNotes();
let notesDraft = projectNotes.text;
let notesSaveFailed = false;
let scope: Scope = { ...defaultScope };
let tab: Tab = 'internship';
let answer = analyze('解释这一天的对账差异', scope);
let audits = readLocal<AuditEvent[]>(auditKey, []);
let feedback = readLocal<Feedback[]>(feedbackKey, []);
let evaluations: EvaluationResult[] = [];
let evalTime = '';
let modelAvailable = false;
let modelName = '';
let useModel = false;
let modelText = '';
let modelError = '';
let busy = false;
let requestId = 0;
let evidenceTab: 'trades' | 'pos' | 'refunds' | 'knowledge' = 'trades';
let toastTimer = 0;
const app = document.querySelector<HTMLDivElement>('#app')!;
const tabs: { id: Tab; icon: string; label: string; sub: string }[] = [
  { id: 'internship', icon: 'design', label: '实习任务台', sub: '腾讯 CDG 金融科技 · 学习模拟' },
  { id: 'workbench', icon: 'dashboard', label: '经营工作台', sub: '交易、POS 与退款' },
  { id: 'evaluation', icon: 'lab', label: '评测实验室', sub: '规则用例' },
  { id: 'product', icon: 'design', label: '产品设计', sub: '需求与迭代' },
  { id: 'evidence', icon: 'book', label: '证据知识库', sub: '数据与来源' },
  { id: 'audit', icon: 'history', label: '审计记录', sub: '本地操作记录' },
];
const pageDescriptions: Record<Tab, string> = {
  internship: '从需求选择开始，逐步完成金额核算、方案评审和上线判断。',
  workbench: '选一个账期，核对订单差异、退款状态和手续费。',
  evaluation: '逐条查看测试的问题、预期结果和实际断言。',
  product: '记录首版范围、设计取舍，以及下一步要验证的事情。',
  evidence: '回答里引用的账单记录和规则，都可以在这里查看。',
  audit: '分析、导出和审核记录保存在当前浏览器。',
};
const merchant = () => merchants.find((m) => m.id === scope.merchantId)!;
function addAudit(action: string, detail: string, eventScope: Scope = scope) {
  audits.unshift({
    id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    time: new Date().toISOString(),
    action,
    scope: { ...eventScope },
    detail,
  });
  audits = audits.slice(0, 150);
  saveLocal(auditKey, audits);
}
function toast(message: string) {
  document.querySelector('#toast')?.remove();
  const node = document.createElement('div');
  node.id = 'toast';
  node.className = 'toast';
  node.setAttribute('role', 'status');
  node.innerHTML = `${icon('check')}<span>${escape(message)}</span>`;
  document.body.append(node);
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => node.remove(), 4500);
}
function download(filename: string, content: string, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
function timestamp(time: string) {
  return new Date(time).toLocaleString('zh-CN', { hour12: false });
}
function fmt(cents: number) {
  return money(cents);
}
function pill(text: string, cls = '') {
  return `<span class="pill ${cls}">${escape(text)}</span>`;
}
function render() {
  const current = tabs.find((t) => t.id === tab)!;
  app.innerHTML = `<div class="app-shell">
    <aside class="sidebar"><a class="brand" href="#internship" aria-label="实习工作室首页"><span class="brand-mark"><i></i><i></i><i></i></span><div><strong>商证</strong><span>MerchantLens</span></div><span class="brand-beta">v1.1</span></a>
      <div class="sidebar-label">腾讯金融科技场景</div>
      <nav class="nav" aria-label="主导航">${tabs.map((t) => `<button class="nav-item ${tab === t.id ? 'active' : ''}" data-tab="${t.id}" ${tab === t.id ? 'aria-current="page"' : ''}>${icon(t.icon)}<span>${t.label}</span>${t.id === 'audit' && audits.length ? `<b>${audits.length}</b>` : ''}</button>`).join('')}</nav>
      <div class="sidebar-divider"></div><div class="sidebar-label">工作台当前商户</div>
      <div class="workspace-mini"><span class="mini-avatar">${escape(merchant().name.slice(0, 1))}</span><div><strong>${escape(merchant().name)}</strong><small>${escape(merchant().industry)} · 合成样本</small></div></div>
      <div class="sidebar-note">${icon('shield')}<div><strong>先把一笔账对清楚</strong><p>展开计算和订单记录，再决定哪些问题需要人工核查。</p></div></div>
      <div class="sidebar-bottom"><span class="status-dot"></span><span>个人项目 · v1.1</span><a href="./docs/PRODUCT_BRIEF.md" target="_blank" rel="noopener" aria-label="查看项目说明">${icon('link')}</a></div>
    </aside>
    <div class="main-shell"><header class="topbar"><div class="breadcrumb">商证 ${icon('chevron')} <span>${current.label}</span></div><div class="topbar-right"><span class="engine-badge ${modelAvailable ? 'available' : ''}"><span class="status-dot"></span>${modelAvailable ? '混元接入已配置' : '证据演示引擎'}</span><button class="icon-btn" data-action="show-about" aria-label="作品说明">${icon('info')}</button><span class="user-avatar">徐</span></div></header>
    <main id="main-content"><div class="page-heading"><div><div class="eyebrow">${current.sub}</div><h1>${tab === 'internship' ? '金融科技产品练习' : current.label}</h1><p>${pageDescriptions[tab]}</p></div><div class="page-heading-actions">${tab === 'product' ? `<a class="btn btn-primary" href="./artifacts/MerchantLens_产品评审.pdf" target="_blank" rel="noopener">${icon('download')}项目评审包</a>` : ''}${tab === 'internship' ? `<a class="btn btn-secondary" href="./docs/INTERNSHIP_CURRICULUM.md" target="_blank" rel="noopener">${icon('file')}任务说明</a>` : tab === 'workbench' ? `<button class="btn btn-secondary" data-action="download-report">${icon('download')}导出分析报告</button>` : tab === 'evaluation' ? `<button class="btn btn-primary" data-action="run-evaluation">${icon('refresh')}重跑评测</button>` : tab === 'audit' ? `<button class="btn btn-secondary" data-action="download-audit">${icon('download')}导出审计记录</button>` : `<a class="btn btn-secondary" href="./docs/${tab === 'product' ? 'PRD' : 'SOURCES'}.md" target="_blank" rel="noopener">${icon('file')}完整文档</a>`}</div></div>
      ${tab === 'internship' ? renderInternship() : tab === 'workbench' ? workbench() : tab === 'evaluation' ? evaluationPage() : tab === 'product' ? productPage() : tab === 'evidence' ? evidencePage() : auditPage()}
      <footer class="footer"><span>商证 MerchantLens · v1.1</span><span>个人项目 · 合成账单，未连接真实商户</span></footer>
    </main></div></div>`;
  bind();
}
function scopeBar() {
  return `<div class="scope-bar"><div class="scope-label">${icon('dashboard')}业务范围</div><label class="select-wrap"><span>商户</span><select id="merchant-select" aria-label="选择商户">${merchants.map((m) => `<option value="${m.id}" ${m.id === scope.merchantId ? 'selected' : ''}>${escape(m.name)}</option>`).join('')}</select></label><label class="select-wrap"><span>账单日期</span><select id="date-select" aria-label="选择账单日期">${['2026-09-28', '2026-09-29'].map((d) => `<option ${d === scope.billDate ? 'selected' : ''}>${d}</option>`).join('')}</select></label><span class="scope-caption">金额单位：人民币 · 账期归属按样本口径</span><button class="text-button" data-tab="evidence">查看原始账单 ${icon('arrow')}</button></div>`;
}
function chart() {
  const r = reconcile(scope);
  const series = r.series.slice(-7);
  if (!series.length) return `<div class="chart-empty">当前范围没有历史样本。</div>`;
  const max = Math.max(...series.map((s) => s.gross), 1) * 1.2;
  const start = 25,
    width = 510,
    height = 126;
  const points = series.map((s, i) => ({
    x: start + (series.length === 1 ? width / 2 : (i * width) / (series.length - 1)),
    y: 150 - (s.gross / max) * height,
    n: 150 - (s.net / max) * height,
    d: s.date,
    g: s.gross,
    net: s.net,
  }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const npath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.n}`).join(' ');
  return `<svg class="trend-chart" role="img" aria-label="${escape(merchant().name)}样本账期交易金额与演示账面净额走势图" viewBox="0 0 570 190"><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--td-brand-color)" stop-opacity=".16"/><stop offset="100%" stop-color="var(--td-brand-color)" stop-opacity="0"/></linearGradient></defs>${[40, 95, 150].map((y) => `<line x1="25" x2="535" y1="${y}" y2="${y}" stroke="var(--td-border-level-1-color)" stroke-dasharray="4 4"/>`).join('')}<path d="${path} L${points.at(-1)!.x},150 L${points[0].x},150 Z" fill="url(#chart-fill)"/><path d="${path}" stroke="var(--td-brand-color)" stroke-width="2.5" fill="none"/><path d="${npath}" stroke="var(--td-success-color-active)" stroke-width="2" stroke-dasharray="5 4" fill="none"/>${points.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="4.5" fill="var(--td-brand-color)" stroke="#fff" stroke-width="2"><title>${p.d} · 交易金额 ${fmt(p.g)} · 演示账面净额 ${fmt(p.net)}</title></circle><text x="${p.x}" y="178" text-anchor="middle" font-size="12" fill="var(--td-text-color-secondary)">${p.d.slice(5)}</text><text x="${p.x}" y="${p.y - 12}" text-anchor="middle" font-size="12" fill="var(--td-text-color-secondary)">${fmt(p.g)}</text>`).join('')}</svg>`;
}
function workbench() {
  const r = reconcile(scope);
  const metrics = [
    {
      label: '交易账单总额',
      value: r.gross,
      icon: 'coin',
      detail: `${r.tradeCount} 笔支付记录`,
      cls: '',
    },
    {
      label: '成功退款金额',
      value: r.refunds,
      icon: 'refresh',
      detail: `未成功退款 ${fmt(r.pendingRefunds)}`,
      cls: '',
    },
    {
      label: '演示账面净额',
      value: r.net,
      icon: 'shield',
      detail: `扣除成功退款及手续费 ${fmt(r.fee)}`,
      cls: 'accent',
    },
    {
      label: 'POS 与支付差异',
      value: r.difference,
      icon: 'warning',
      detail: `${r.findings.length} 项待核查线索 · POS 总额减支付`,
      cls: r.difference ? 'attention' : '',
    },
  ];
  return `${scopeBar()}<div class="metrics">${metrics.map((m) => `<article class="metric ${m.cls}"><div class="metric-label">${m.label}<span class="metric-icon">${icon(m.icon)}</span></div><strong>${fmt(m.value)}</strong><div class="metric-detail">${m.detail}</div></article>`).join('')}</div>
  <div class="work-grid"><section class="panel assistant-panel"><div class="panel-heading"><div class="heading-with-icon"><span class="assistant-symbol">${icon('spark')}</span><div><h2>查账助手</h2><p>从当前账单回答问题</p></div></div>${pill('附计算与来源', 'indigo')}</div>
    <form id="query-form"><label class="sr-only" for="query-input">输入经营问题</label><div class="query-box"><textarea id="query-input" rows="2" maxlength="800" placeholder="例如：为什么当前账期与 POS 金额不一致？" ${busy ? 'disabled' : ''}>${escape(answer.query)}</textarea><div class="query-bottom"><span>${icon('lock')}仅使用当前商户与账期</span><button class="btn btn-primary btn-small" type="submit" ${busy ? 'disabled' : ''}>${busy ? '正在生成' : '分析问题'}${busy ? '<span class="spinner"></span>' : icon('arrow')}</button></div></div></form>
    <div class="suggestions">${['解释这一天的对账差异', '当前账期的退款是否存在异常？', '手续费是怎么计算的？'].map((q) => `<button class="suggestion" data-query="${q}" ${busy ? 'disabled' : ''}>${escape(q)}</button>`).join('')}</div>
    <div class="model-control"><label><input id="use-model" type="checkbox" ${useModel ? 'checked' : ''} ${modelAvailable ? '' : 'disabled'}>启用混元辅助解读</label><span>${modelAvailable ? `服务端已配置 ${escape(modelName || '模型')}；生成内容另行展示` : '接入代码已就绪 · 尚未配置模型 API'}</span></div>
    <div id="answer-region" aria-live="polite">${answerContent()}</div>
  </section><div class="context-column"><section class="panel trend-panel"><div class="panel-heading"><div><h2>账单走势</h2><p>对比两个样本账期</p></div><span class="mini-muted">${escape(merchant().industry)}</span></div>${chart()}<div class="chart-legend"><span><i class="legend-gross"></i>支付总额</span><span><i class="legend-net"></i>演示账面净额</span></div></section>
    <section class="panel findings-panel"><div class="panel-heading"><div><h2>待核查线索 <span class="count">${r.findings.length}</span></h2><p>展开查看订单和核查原因</p></div></div><div class="findings-list">${r.findings.length ? r.findings.map((f) => `<details class="finding"><summary><span class="finding-dot ${f.severity}"></span><div><strong>${escape(f.title)}</strong><span>${escape(f.orderIds.join(' / ') || '账期汇总')}</span></div><b>${fmt(f.amount)}</b>${icon('down')}</summary><div class="finding-detail">${escape(f.detail)}<div class="finding-tags">${pill(f.id)}${pill(f.severity === 'high' ? '优先核查' : f.severity === 'medium' ? '常规核查' : '信息提示', f.severity === 'high' ? 'amber' : '')}</div></div></details>`).join('') : `<div class="empty-state compact">${icon('check')}<strong>当前样本未发现对账差异</strong><p>这不代表已经完成实际资金核验。</p></div>`}</div></section>
    <section class="boundary-note">${icon('shield')}<div><strong>这里先整理核查材料</strong><p>工单可下载供人工处理；页面不会发起退款或修改商户费率。</p></div></section></div></div>`;
}
function answerContent() {
  const status =
    answer.status === 'answered'
      ? '已生成'
      : answer.status === 'clarify'
        ? '需要补充信息'
        : '操作被拦截';
  const f = feedback.find((x) => x.answerId === answer.id);
  return `<article class="answer-card ${answer.status !== 'answered' ? 'answer-boundary' : ''}"><div class="answer-top"><span class="answer-marker">${icon(answer.status === 'blocked' ? 'shield' : 'check')}${status}</span><span class="answer-meta">确定性计算 + 证据检索 · ${answer.latencyMs.toFixed(1)} ms</span></div><h3>${escape(answer.title)}</h3><p class="answer-summary">${escape(answer.summary)}</p><div class="answer-sections">${answer.sections.map((s) => `<section><h4>${escape(s.title)}</h4><p>${escape(s.content).replace(/\n/g, '<br>')}</p>${s.evidenceIds.length ? `<div class="citation-row">${s.evidenceIds.map((id) => `<button class="citation" data-evidence="${escape(id)}">${icon('file')}${escape(id)}</button>`).join('')}</div>` : ''}</section>`).join('')}</div>
      ${answer.suggestions.length ? `<div class="next-actions"><span>下一步建议</span><ul>${answer.suggestions.map((s) => `<li>${escape(s)}</li>`).join('')}</ul></div>` : ''}
      ${modelText ? `<section class="model-reading"><h4>${icon('spark')}混元辅助解读 <span>${escape(modelName)}</span></h4><p>${escape(modelText).replace(/\n/g, '<br>')}</p><small>模型解读独立展示；金额与异常结论以已核验的账单计算为准。</small></section>` : ''}
      ${modelError ? `<div class="inline-alert" role="alert">${icon('warning')}<span>${escape(modelError)}。当前显示证据演示引擎的结果。</span></div>` : ''}
      <div class="answer-actions">${answer.ticket ? `<button class="btn btn-secondary btn-small" data-action="review-ticket">${icon('file')}生成处理工单</button><button class="text-button" data-action="download-ticket-json">JSON</button>` : '<span class="mini-muted">当前问题不生成资金处理工单</span>'}<div class="feedback"><span>${f ? '反馈已记录' : '这次回答有帮助吗？'}</span><button class="icon-btn ${f?.helpful === true ? 'selected' : ''}" data-feedback="yes" aria-label="回答有帮助" aria-pressed="${f?.helpful === true}">${icon('thumbs')}</button><button class="icon-btn thumb-down ${f?.helpful === false ? 'selected' : ''}" data-feedback="no" aria-label="回答需要改进" aria-pressed="${f?.helpful === false}">${icon('thumbs')}</button></div></div>
    </article><details class="trace"><summary>${icon('terminal')}计算与检索步骤 <span>${answer.steps.length} 个步骤</span>${icon('down')}</summary><ol>${answer.steps.map((s, i) => `<li><span class="trace-num">${i + 1}</span><div><strong>${escape(s.name)} ${pill(s.state === 'done' ? '完成' : '拦截', s.state === 'done' ? 'green' : 'amber')}</strong><p>${escape(s.detail)}</p></div></li>`).join('')}</ol></details><details class="evidence-details"><summary>${icon('book')}引用证据 <span>${answer.evidence.length} 项</span>${icon('down')}</summary><div class="evidence-stack">${answer.evidence.map((e) => `<article id="evidence-${escape(e.id)}"><span class="evidence-kind">${e.kind === 'ledger' ? '账单' : e.kind === 'calculation' ? '计算口径' : '知识来源'} · ${escape(e.id)}</span><h4>${escape(e.title)}</h4><p>${escape(e.detail)}</p>${e.url ? `<a href="${escape(e.url)}" target="_blank" rel="noopener">打开原文 ${icon('link')}</a>` : ''}</article>`).join('')}</div></details>`;
}
function evaluationPage() {
  const groups = [...new Set(evaluationCases.map((c) => c.group))];
  const pass = evaluations.filter((r) => r.passed).length;
  return `<div class="callout">${icon('lab')}<div><strong>这组用例检查计算、范围和引用</strong><p>点击重跑会执行本地规则测试。模型表达质量和实际业务效果需要另外验证。</p></div>${pill('本地可重跑', 'indigo')}</div>
    <div class="eval-summary"><div class="eval-stat"><span>测试用例</span><strong>${evaluationCases.length}<small>条</small></strong><p>覆盖 ${groups.length} 类问题</p></div><div class="eval-stat"><span>本次通过</span><strong>${evaluations.length ? pass : '—'}<small>${evaluations.length ? `/ ${evaluations.length}` : '未运行'}</small></strong><p>${evaluations.length ? `通过率 ${((pass / evaluations.length) * 100).toFixed(1)}% · 确定性测试` : '点击右上角重跑评测'}</p></div><div class="eval-stat"><span>上线前仍需验证</span><strong class="word-stat">模型与试点</strong><p>需新增模型语义评审与真实商户试点</p></div></div>
    <section class="panel"><div class="panel-heading"><div><h2>测试集与结果</h2><p>${evalTime ? `最近运行：${escape(evalTime)}` : '每条用例都有可查看的断言，避免只展示一个分数。'}</p></div><button class="text-button" data-action="download-evaluation">${icon('download')}下载评测报告</button></div><div class="table-scroll"><table class="data-table eval-table"><thead><tr><th>用例 / 类别</th><th>问题</th><th>预期行为</th><th>结果</th><th>检查明细</th></tr></thead><tbody>${evaluationCases
      .map((c) => {
        const result = evaluations.find((r) => r.id === c.id);
        return `<tr><td><strong>${escape(c.id)}</strong><small>${escape(c.group)}</small></td><td>${escape(c.query)}<small>${escape(c.scope.merchantId)} · ${c.scope.billDate}</small></td><td>${pill(c.expectedIntent)} ${pill(c.expectedStatus)}</td><td>${result ? pill(result.passed ? 'PASS' : 'FAIL', result.passed ? 'green' : 'red') : pill('待运行')}</td><td>${result ? `<details><summary class="checks-summary">${result.checks.filter((x) => x.passed).length}/${result.checks.length} 断言 ${icon('down')}</summary><div class="check-list">${result.checks.map((x) => `<div><span class="${x.passed ? 'check-ok' : 'check-fail'}">${icon(x.passed ? 'check' : 'close')}</span><p><strong>${escape(x.name)}</strong><small>${escape(x.detail)}</small></p></div>`).join('')}</div></details>` : '<span class="mini-muted">等待执行</span>'}</td></tr>`;
      })
      .join('')}</tbody></table></div></section>
    <div class="two-column docs-grid"><article class="panel document-panel"><span class="section-number">先检查哪一层</span><h3>分开验收账务工具与模型</h3><p>先验证账务计算和隔离，再验证模型表达。离线高分不能替代线上业务验证。</p><ol class="flat-list"><li><strong>确定性层</strong><span>金额逐分精确、范围隔离、异常检测、退款状态</span></li><li><strong>模型层（待验证）</strong><span>忠实度、引用匹配、幻觉与提示注入抵抗</span></li><li><strong>业务层（待验证）</strong><span>工单可执行性、人工修订率、真实处理时长</span></li></ol></article><article class="panel document-panel"><span class="section-number">为什么这些指标先测</span><h3>金额正确比措辞自然更优先</h3><p>对账场景的错误代价高于措辞不够自然。因此把金额正确与拒绝资金指令作为硬门槛。</p><div class="criterion"><span>金额与账期一致</span><b>目标 100%</b></div><div class="criterion"><span>越权与资金执行拦截</span><b>目标 100%</b></div><div class="criterion"><span>证据支持的模型结论</span><b>待接入后测量</b></div><a class="text-button" href="./docs/EVALUATION.md" target="_blank" rel="noopener">完整评测设计 ${icon('arrow')}</a></article></div>`;
}
function productPage() {
  return `<div class="product-hero"><div><span class="eyebrow">项目起点</span><h2>先把商户对账这件事做完整。</h2><p>一笔交易在支付账单和门店 POS 里对不上，运营人员需要知道该查哪张单、找谁核实。首版串起差异定位、状态核查和材料交接，让同事可以沿着记录继续复核。</p><div class="hero-chips">${pill(`${merchants.length} 个合成商户`, 'white')}${pill('两个账期', 'white')}</div></div><div class="hero-diagram"><span>交易账单 / POS / 退款记录</span><i></i><div>核算金额 → 找到差异 → 附上依据</div><i></i><strong>整理工单，交给人复核</strong><small>生成说明可选，金额由工具计算</small></div></div>
    <div class="product-content">
      ${projectNotesPanel()}
      <section class="panel document-panel"><div class="document-title"><span class="section-number">首版范围</span><h3>为什么从对账开始</h3></div><div class="two-column"><div><h4>要帮谁解决什么</h4><p>目标是门店运营与财务。遇到总额不一致时，他们往往还要逐个打开订单，比较记录，再把问题整理给客服或同事。这三步需要同一套账期和金额口径。</p><h4>首版保留的动作</h4><p>选商户和账期，比较支付与 POS，核查退款状态和手续费，下载带订单证据的工单。广告归因和授信决策缺少对应数据，暂不放进这条流程。</p></div><div class="hypothesis-box"><span>还需要验证的价值</span><strong>能否少花时间查账和整理材料</strong><p>先采集人工处理的耗时与修订情况，再做有授权的商户试点。合成样本能验证流程和计算，不能证明真实效率提升。</p></div></div></section>
      <section class="panel document-panel"><div class="document-title"><span class="section-number">几处刻意保留的取舍</span><h3>金额工具、模型解读和人工审核分开</h3></div><div class="table-scroll"><table class="data-table tradeoffs"><thead><tr><th>选择</th><th>理由</th><th>代价</th></tr></thead><tbody><tr><td>金额用整数分计算</td><td>每一步可以复算，不让生成文本决定账务事实</td><td>遇到新口径需要补工具和测试</td></tr><tr><td>模型解读单独展示</td><td>可以比较工具结论与生成说明；失败时账务结果仍在</td><td>页面多一块信息，表达更受约束</td></tr><tr><td>停在工单草稿</td><td>核查原因后才能决定是否处理资金</td><td>真实闭环还需权限、审批和业务系统</td></tr><tr><td>先用公开规则和合成账单</td><td>任何人都能复现差异，不暴露商户数据</td><td>还不能评估真实数据分布和使用习惯</td></tr></tbody></table></div></section>
      <div class="two-column"><section class="panel document-panel"><span class="section-number">已经做出的部分</span><h3>这份原型能验证什么</h3><div class="delivery-row">${icon('check')}<div><strong>对账与工单流程</strong><p>切换商户和账期、金额核算、异常定位、来源引用、工单下载和本地审核记录。</p></div></div><div class="delivery-row">${icon('check')}<div><strong>测试与练习</strong><p>可重跑规则用例，六个模拟任务可提交交付、查看检查项和导出学习日志。</p></div></div><div class="delivery-row pending">${icon('lab')}<div><strong>接入代码已写，效果仍需实测</strong><p>混元服务端配置、超时和错误处理已提供。真实模型语义、商户权限和生产支付接口尚未完成验收。</p></div></div></section><section class="panel document-panel"><span class="section-number">下一次验证</span><h3>先收集什么证据</h3><ol class="flat-list"><li><strong>人工查错</strong><span>让财务逐条核对金额与引用，记录哪些工单仍需重写。</span></li><li><strong>影子运行</strong><span>在授权数据上生成建议，不执行动作，对比人工结果。</span></li><li><strong>小范围试点</strong><span>对照查账耗时、工单修订率和重复咨询，保留退出条件。</span></li></ol><p class="fine-print">基线、样本量和停止条件需要与业务一起确认，当前没有线上收益数据。</p></section></div>
      <section class="panel document-panel"><div class="document-title"><span class="section-number">放到腾讯业务里看</span><h3>几个能力各自承担什么</h3></div><div class="ecosystem-grid"><div><h4>微信支付</h4><p>提供交易、退款与账单场景。接入真实商户前要补正式授权和身份校验。</p></div><div><h4>腾讯混元</h4><p>把已计算的事实解释给不同角色，先过引用和语义验收再放开使用。</p></div><div><h4>企业微信</h4><p>可作为后续工单交接触点；当前只下载草稿，尚未发送消息。</p></div><div><h4>腾讯云</h4><p>后续承载后端、日志和密钥管理。部署与模型配置步骤在接入文档中。</p></div></div></section>
      <section class="panel document-panel integration design-reference"><div><span class="section-number">界面参考</span><h3>设计依据</h3><p>桌面工作台依据腾讯 TDesign 公开设计规范，移动端保留相同的任务流程。这里是独立原型，界面取舍和参考来源可单独查看。</p></div><a class="btn btn-secondary" href="./docs/TENCENT_DESIGN.md" target="_blank" rel="noopener">${icon('file')}查看设计依据</a></section>
      <section class="panel document-panel project-changelog"><div class="document-title"><span class="section-number">改动记录</span><h3>v1.1 <span class="change-date">2026-10-04</span></h3></div><ul class="change-list"><li>按腾讯 TDesign 公开规范统一色彩、字号、控件状态和阶段进度，采用官方图标。</li><li>页面文案改为具体操作和问题描述。</li><li>产品设计页增加项目笔记，可保存自己的复盘、恢复上一份保存内容并导出 Markdown。</li><li>模型状态与数据来源保留在页头和项目说明中，方便评审核对当前能力。</li></ul></section>
      <section class="panel document-panel integration"><div><span class="section-number">接入说明</span><h3>配置模型后，再验证生成部分</h3><p>密钥留在服务端。调用失败会显示原因并回到规则结果；模型解读不能覆盖已核算的金额。</p></div><a class="btn btn-secondary" href="./docs/INTEGRATION.md" target="_blank" rel="noopener">${icon('terminal')}查看接入步骤</a></section>
    </div>`;
}

function projectNotesPanel() {
  return `<section class="panel document-panel project-notes"><div class="project-notes-head"><div><span class="section-number">自己的复盘</span><h3>项目笔记</h3></div><span class="pill">仅本地保存</span></div><p class="project-notes-help">记下一个口径为什么这样定、测试中遇到的问题，或下一次准备验证什么。只写你实际思考或检查过的内容。</p><form id="project-notes-form" class="project-notes-form"><label class="sr-only" for="project-notes-input">项目复盘笔记</label><textarea id="project-notes-input" maxlength="${notesLimit}" rows="6" placeholder="例如：这次检查了什么？为什么选择这个方案？还有哪个判断缺少证据？" aria-describedby="project-notes-status project-notes-location">${escape(notesDraft)}</textarea><div class="project-notes-controls"><span id="project-notes-status" class="project-notes-status" role="status">${escape(notesStatus())}</span><div><button type="button" class="btn btn-secondary btn-small" data-action="restore-project-notes" ${projectNotes.previous ? '' : 'disabled'}>恢复上一份</button><button type="button" class="btn btn-secondary btn-small" data-action="export-project-notes" ${notesDraft.trim() ? '' : 'disabled'}>${icon('download')}导出 Markdown</button><button type="submit" class="btn btn-primary btn-small">保存笔记</button></div></div></form><p id="project-notes-location" class="fine-print">保存在当前浏览器，换设备前请导出。编辑后点击保存，也可在输入框里按 Ctrl / ⌘ + S。</p></section>`;
}

function readProjectNotes(): ProjectNotes {
  const empty: ProjectNotes = { text: '', savedAt: null, previous: null };
  const stored = readLocal<unknown>(projectNotesKey, null);
  if (!stored || typeof stored !== 'object') return empty;
  const note = stored as Partial<ProjectNotes>;
  if (typeof note.text !== 'string') return empty;
  const validDate = (value: unknown) =>
    typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
  const previous =
    note.previous && typeof note.previous.text === 'string'
      ? { text: note.previous.text.slice(0, notesLimit), savedAt: validDate(note.previous.savedAt) }
      : null;
  return { text: note.text.slice(0, notesLimit), savedAt: validDate(note.savedAt), previous };
}

function notesStatus() {
  if (notesSaveFailed) return '未能保存到浏览器；内容仍在输入框，可先导出备份。';
  if (notesDraft !== projectNotes.text) return `有未保存的修改 · ${notesDraft.length} 字`;
  return projectNotes.savedAt ? `已保存 · ${timestamp(projectNotes.savedAt)}` : '尚未填写';
}

function updateNotesControls() {
  const status = app.querySelector<HTMLElement>('#project-notes-status');
  if (status) status.textContent = notesStatus();
  const exportButton = app.querySelector<HTMLButtonElement>('[data-action="export-project-notes"]');
  if (exportButton) exportButton.disabled = !notesDraft.trim();
  const restoreButton = app.querySelector<HTMLButtonElement>(
    '[data-action="restore-project-notes"]',
  );
  if (restoreButton) restoreButton.disabled = !projectNotes.previous;
}

function persistProjectNotes() {
  const next: ProjectNotes = {
    text: notesDraft,
    savedAt: new Date().toISOString(),
    previous:
      notesDraft === projectNotes.text
        ? projectNotes.previous
        : { text: projectNotes.text, savedAt: projectNotes.savedAt },
  };
  try {
    localStorage.setItem(projectNotesKey, JSON.stringify(next));
    projectNotes = next;
    notesSaveFailed = false;
    updateNotesControls();
    toast('笔记已保存到当前浏览器。');
  } catch {
    notesSaveFailed = true;
    updateNotesControls();
    toast('浏览器未允许保存，请先导出笔记备份。');
  }
}

function saveProjectNotes() {
  if (!notesDraft.trim() && projectNotes.text.trim()) {
    const overlay = showModal(
      '<p>保存后正文会变为空白。上一份保存的内容会保留，可以恢复。</p><div class="modal-actions"><button type="button" class="btn btn-primary" id="confirm-empty-notes">保存为空白</button></div>',
      '确认保存空白笔记',
    );
    overlay.querySelector('#confirm-empty-notes')?.addEventListener('click', () => {
      overlay.remove();
      persistProjectNotes();
    });
    return;
  }
  persistProjectNotes();
}

function exportProjectNotes() {
  if (!notesDraft.trim()) return;
  const changed = notesDraft !== projectNotes.text;
  const content = `# 商证 MerchantLens · 项目笔记\n\n导出时间：${new Date().toISOString()}\n状态：${changed ? '当前编辑稿，尚未保存到浏览器' : '已保存笔记'}\n\n${notesDraft}\n`;
  download(
    `MerchantLens_项目笔记_${new Date().toISOString().slice(0, 10)}.md`,
    content,
    'text/markdown;charset=utf-8',
  );
  toast('已导出当前笔记。');
}

function evidencePage() {
  const rows = getScopedRows(scope);
  const r = reconcile(scope);
  const counts = {
    trades: rows.trades.length,
    pos: rows.posOrders.length,
    refunds: rows.refunds.length,
    knowledge: knowledge.length,
  };
  return `${scopeBar()}<div class="callout compact">${icon('shield')}<div><strong>这是用于复现问题的合成账单。</strong><p>可按订单号核对金额和状态，也可下载当前范围的样本。</p></div></div><section class="panel"><div class="evidence-toolbar"><div class="segmented" role="tablist" aria-label="数据类型">${(
    [
      { id: 'trades', name: '支付账单' },
      { id: 'pos', name: 'POS订单' },
      { id: 'refunds', name: '退款记录' },
      { id: 'knowledge', name: '知识来源' },
    ] as const
  )
    .map(
      (s) =>
        `<button role="tab" aria-selected="${s.id === evidenceTab}" class="${s.id === evidenceTab ? 'active' : ''}" data-evidence-tab="${s.id}">${s.name}<b>${counts[s.id]}</b></button>`,
    )
    .join(
      '',
    )}</div><button class="btn btn-secondary btn-small" data-action="download-csv">${icon('download')}导出当前样本</button></div>${evidenceTab === 'knowledge' ? `<div class="knowledge-grid">${knowledge.map((k) => `<article class="knowledge-item"><div>${pill(k.authority === 'official' ? '官方来源' : '演示口径', k.authority === 'official' ? 'green' : 'amber')}<span>${escape(k.id)}</span></div><h3>${escape(k.title)}</h3><p>${escape(k.text)}</p><div class="knowledge-bottom"><span>记录更新：${escape(k.updated)}</span>${k.url ? `<a href="${escape(k.url)}" target="_blank" rel="noopener">查看来源 ${icon('link')}</a>` : ''}</div></article>`).join('')}</div>` : dataTable(rows)}<div class="dataset-footer"><span>${evidenceTab === 'knowledge' ? '官方知识不等于当前商户签约费率；个体费率需查协议。' : `当前范围：${escape(merchant().name)} / ${scope.billDate} · 样本记录 ${counts[evidenceTab]} 条`}</span><span>金额全部按人民币分存储</span></div></section><section class="panel document-panel"><span class="section-number">计算口径</span><h3>两个指标分别怎么算</h3><div class="formula-grid"><div><span>POS 与支付差异</span><code>POS订单总额 − 支付账单总额</code><strong>${fmt(r.posGross)} − ${fmt(r.gross)} = ${fmt(r.difference)}</strong></div><div><span>演示账面净额</span><code>支付总额 − 成功退款 − 手续费</code><strong>${fmt(r.gross)} − ${fmt(r.refunds)} − ${fmt(r.fee)} = ${fmt(r.net)}</strong></div></div><p class="fine-print">处理中退款不计入成功退款扣减。演示账面净额不是银行到账凭证，本原型未接入资金账单、退款手续费回退及结算时间；实际资金状态以商户合同和支付系统为准。</p></section>`;
}
function dataTable(rows: ReturnType<typeof getScopedRows>) {
  const list =
    evidenceTab === 'trades' ? rows.trades : evidenceTab === 'pos' ? rows.posOrders : rows.refunds;
  if (!list.length)
    return `<div class="empty-state">${icon('book')}<strong>当前范围没有${evidenceTab === 'refunds' ? '退款' : '订单'}记录</strong><p>可更换商户或账单日查看其他样本。</p></div>`;
  return `<div class="table-scroll"><table class="data-table"><thead><tr><th>${evidenceTab === 'refunds' ? '退款单号' : '订单号'}</th>${evidenceTab === 'refunds' ? '<th>关联订单</th>' : ''}<th>账单日期</th><th class="align-right">金额</th>${evidenceTab === 'trades' ? '<th class="align-right">手续费</th>' : ''}${evidenceTab !== 'pos' ? '<th>状态</th>' : ''}</tr></thead><tbody>${list.map((row) => `<tr><td><code>${escape(row.id)}</code></td>${'orderId' in row ? `<td><code>${escape(row.orderId)}</code></td>` : ''}<td>${row.date}</td><td class="align-right money-cell">${fmt(row.amount)}</td>${'fee' in row ? `<td class="align-right">${fmt(Number(row.fee))}</td>` : ''}${'status' in row ? `<td>${pill(row.status === 'SUCCESS' ? '成功' : row.status === 'PROCESSING' ? '处理中' : '异常', row.status === 'SUCCESS' ? 'green' : 'amber')}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
}
function auditPage() {
  return `<div class="audit-summary"><div>${icon('history')}<strong>${audits.length}</strong><span>操作记录</span></div><div>${icon('thumbs')}<strong>${feedback.length}</strong><span>回答反馈</span></div><div>${icon('lock')}<strong>浏览器本地</strong><span>存储范围</span></div></div><section class="panel"><div class="panel-heading"><div><h2>操作轨迹</h2><p>用于回看这次练习的操作过程。</p></div></div>${audits.length ? `<div class="audit-list">${audits.map((e) => `<article><div class="audit-icon">${icon(e.action.includes('审核') ? 'shield' : e.action.includes('导出') ? 'download' : e.action.includes('评测') ? 'lab' : 'spark')}</div><div class="audit-body"><div><h3>${escape(e.action)}</h3><time>${timestamp(e.time)}</time></div><p>${escape(e.detail)}</p><span>${e.action.startsWith('实习模拟') ? '独立实习模拟 · 训练上下文以任务说明为准' : `${escape(merchants.find((m) => m.id === e.scope.merchantId)?.name || e.scope.merchantId)} · ${e.scope.billDate}`}</span></div></article>`).join('')}</div>` : `<div class="empty-state">${icon('history')}<strong>还没有操作记录</strong><p>尝试分析一个问题、导出工单或运行评测，过程会记录在这里。</p><button class="btn btn-primary" data-tab="workbench">开始体验 ${icon('arrow')}</button></div>`}</section>${feedback.length ? `<section class="panel"><div class="panel-heading"><div><h2>回答反馈</h2><p>保留认为有用或需要修改的回答，方便后续复查。</p></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>问题</th><th>反馈</th><th>账期</th><th>时间</th></tr></thead><tbody>${feedback.map((f) => `<tr><td>${escape(f.query)}</td><td>${pill(f.helpful ? '有帮助' : '需要改进', f.helpful ? 'green' : 'amber')}</td><td>${f.scope.billDate}</td><td>${timestamp(f.time)}</td></tr>`).join('')}</tbody></table></div></section>` : ''}`;
}
async function submitQuery(query: string) {
  if (!query.trim() || busy) return;
  const currentRequest = ++requestId;
  answer = analyze(query.trim(), scope);
  modelText = '';
  modelError = '';
  addAudit('证据分析', `${query.trim()} → ${answer.title}；状态 ${answer.status}`);
  if (useModel && modelAvailable && answer.status === 'answered') {
    busy = true;
    render();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 22000);
    try {
      const response = await fetch('/api/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), scope }),
        signal: controller.signal,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || '模型服务未完成请求');
      if (currentRequest !== requestId) return;
      if (!payload.text || typeof payload.text !== 'string') throw new Error('模型未返回有效解读');
      modelText = payload.text;
      modelName = payload.model || modelName;
      addAudit('模型辅助解读', `生成了独立解读，模型 ${modelName}；账务结论仍来自工具。`);
    } catch (error) {
      if (currentRequest === requestId) {
        modelError =
          error instanceof Error && error.name === 'AbortError'
            ? '模型请求超时，已降级'
            : `模型调用失败：${error instanceof Error ? error.message : '网络异常'}`;
        addAudit('模型显式降级', modelError);
      }
    } finally {
      clearTimeout(timeout);
      if (currentRequest === requestId) {
        busy = false;
        render();
      }
    }
  } else render();
}
function changeScope() {
  const merchantSelect = document.querySelector<HTMLSelectElement>('#merchant-select');
  const dateSelect = document.querySelector<HTMLSelectElement>('#date-select');
  scope = {
    merchantId: (merchantSelect?.value as Scope['merchantId']) || scope.merchantId,
    billDate: dateSelect?.value || scope.billDate,
  };
  ++requestId;
  busy = false;
  modelText = '';
  modelError = '';
  answer = analyze('解释这一天的对账差异', scope);
  render();
}
function report() {
  const r = reconcile(scope);
  return `# 商证 MerchantLens — 对账分析报告\n\n> 独立个人作品 / 合成数据 / 不构成实际资金核验结论\n\n商户：${merchant().name}\n账单日：${scope.billDate}\n生成时间：${new Date().toISOString()}\n\n## 账务汇总\n支付总额：${fmt(r.gross)}\nPOS总额：${fmt(r.posGross)}\n成功退款：${fmt(r.refunds)}\n手续费：${fmt(r.fee)}\n演示账面净额：${fmt(r.net)}\nPOS与支付差异：${fmt(r.difference)}\n\n## ${answer.title}\n${answer.summary}\n\n${answer.sections.map((s) => `### ${s.title}\n${s.content}\n证据：${s.evidenceIds.join('、')}`).join('\n\n')}\n\n## 证据\n${answer.evidence.map((e) => `- ${e.id} / ${e.title}：${e.detail}${e.url ? `\n  来源：${e.url}` : ''}`).join('\n')}\n\n## 人工核查\n${answer.suggestions.map((s) => `- ${s}`).join('\n')}\n\n该报告不发起任何退款、支付或费率修改。`;
}
function exportCsv() {
  const rows = getScopedRows(scope);
  if (evidenceTab === 'knowledge') {
    download('MerchantLens-knowledge.json', JSON.stringify(knowledge, null, 2), 'application/json');
    return;
  }
  const list =
    evidenceTab === 'trades' ? rows.trades : evidenceTab === 'pos' ? rows.posOrders : rows.refunds;
  const keys =
    evidenceTab === 'trades'
      ? ['id', 'merchantId', 'date', 'amount', 'fee', 'status']
      : evidenceTab === 'pos'
        ? ['id', 'merchantId', 'date', 'amount']
        : ['id', 'orderId', 'merchantId', 'date', 'amount', 'status'];
  const csv = [
    keys.join(','),
    ...list.map((row) =>
      keys
        .map(
          (k) =>
            `"${String((row as unknown as Record<string, unknown>)[k] ?? '').replace(/"/g, '""')}"`,
        )
        .join(','),
    ),
  ].join('\n');
  download(
    `${scope.merchantId}-${scope.billDate}-${evidenceTab}.csv`,
    '\ufeff' + csv,
    'text/csv;charset=utf-8',
  );
  addAudit('导出样本', `${evidenceTab}，${list.length} 条；金额单位为分。`);
  toast('已导出当前范围的样本数据。');
}
function showModal(content: string, title: string) {
  document.querySelector('.modal-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-heading"><h2 id="modal-title">${escape(title)}</h2><button class="icon-btn" data-close-modal aria-label="关闭">${icon('close')}</button></div>${content}</section>`;
  const previouslyFocused = document.activeElement as HTMLElement | null;
  const close = () => {
    overlay.remove();
    previouslyFocused?.focus();
  };
  overlay.querySelector('[data-close-modal]')?.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') {
      const nodes = Array.from(
        overlay.querySelectorAll<HTMLElement>('button,input,a,[tabindex="0"]'),
      ).filter((n) => !('disabled' in n && (n as HTMLButtonElement).disabled));
      const first = nodes[0],
        last = nodes.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  });
  document.body.append(overlay);
  (overlay.querySelector('button') as HTMLButtonElement)?.focus();
  return overlay;
}
function showTicket() {
  if (!answer.ticket) return;
  const ticket = answer.ticket;
  const overlay = showModal(
    `<div class="ticket-status">${pill('待人工审核', 'amber')}<span>商户：${escape(merchant().name)} · ${scope.billDate}</span></div><h3>${escape(ticket.title)}</h3><p class="ticket-body">${escape(ticket.body).replace(/\n/g, '<br>')}</p><div class="ticket-owner">建议处理角色：<strong>${escape(ticket.owner)}</strong></div><div class="callout compact">${icon('shield')}<div><strong>本地工单，不进入真实业务系统。</strong><p>审核记录只保存在浏览器，不发送退款或其他资金指令。</p></div></div><label class="review-check"><input id="ticket-confirm" type="checkbox">我已核对当前商户、账期、证据与下一步动作</label><div class="modal-actions"><button class="btn btn-secondary" id="ticket-download">${icon('download')}下载待审核工单</button><button class="btn btn-primary" id="ticket-approve" disabled>${icon('check')}本地标记已审核</button></div>`,
    '处理工单预览',
  );
  addAudit('生成待审核工单', ticket.title);
  const checkbox = overlay.querySelector<HTMLInputElement>('#ticket-confirm')!;
  const approve = overlay.querySelector<HTMLButtonElement>('#ticket-approve')!;
  checkbox.addEventListener('change', () => {
    approve.disabled = !checkbox.checked;
  });
  overlay.querySelector('#ticket-download')?.addEventListener('click', () => {
    download(`MerchantLens-ticket-${scope.billDate}.md`, exportTicket(answer, scope));
    addAudit('导出待审核工单', ticket.title);
    toast('工单已下载；未提交到任何业务系统。');
  });
  approve.addEventListener('click', () => {
    if (!checkbox.checked) return;
    addAudit('工单本地已审核', `${ticket.title}；只记录人工确认，不执行业务指令。`);
    overlay.remove();
    render();
    toast('已记录本地审核确认。');
  });
}
function bind() {
  const notesInput = app.querySelector<HTMLTextAreaElement>('#project-notes-input');
  notesInput?.addEventListener('input', () => {
    notesDraft = notesInput.value.slice(0, notesLimit);
    notesSaveFailed = false;
    updateNotesControls();
  });
  notesInput?.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      saveProjectNotes();
    }
  });
  app.querySelector('#project-notes-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    saveProjectNotes();
  });
  if (tab === 'internship')
    bindInternship(app, (action: string, detail: string) =>
      addAudit(`实习模拟 · ${action}`, detail, defaultScope),
    );
  app.querySelector<HTMLAnchorElement>('.brand')?.addEventListener('click', (e) => {
    e.preventDefault();
    tab = 'internship';
    render();
    window.scrollTo({ top: 0, behavior: 'auto' });
  });
  app.querySelector('#query-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    void submitQuery(app.querySelector<HTMLTextAreaElement>('#query-input')!.value);
  });
  app
    .querySelectorAll<HTMLButtonElement>('[data-query]')
    .forEach((b) => b.addEventListener('click', () => void submitQuery(b.dataset.query!)));
  app.querySelector('#merchant-select')?.addEventListener('change', changeScope);
  app.querySelector('#date-select')?.addEventListener('change', changeScope);
  app.querySelector<HTMLInputElement>('#use-model')?.addEventListener('change', (e) => {
    useModel = (e.target as HTMLInputElement).checked;
    toast(useModel ? '下一次分析将尝试生成独立模型解读。' : '已切换为证据演示引擎。');
  });
  app.querySelectorAll<HTMLButtonElement>('[data-evidence]').forEach((b) =>
    b.addEventListener('click', () => {
      const details = app.querySelector<HTMLDetailsElement>('.evidence-details');
      if (details) details.open = true;
      const node = document.getElementById(`evidence-${b.dataset.evidence}`);
      node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      node?.classList.add('evidence-focus');
      setTimeout(() => node?.classList.remove('evidence-focus'), 1800);
    }),
  );
  app.querySelectorAll<HTMLButtonElement>('[data-evidence-tab]').forEach((b) =>
    b.addEventListener('click', () => {
      evidenceTab = b.dataset.evidenceTab as typeof evidenceTab;
      render();
    }),
  );
  app.querySelectorAll<HTMLButtonElement>('[data-feedback]').forEach((b) =>
    b.addEventListener('click', () => {
      feedback = feedback.filter((f) => f.answerId !== answer.id);
      feedback.unshift({
        answerId: answer.id,
        query: answer.query,
        helpful: b.dataset.feedback === 'yes',
        time: new Date().toISOString(),
        scope: { ...scope },
      });
      feedback = feedback.slice(0, 150);
      saveLocal(feedbackKey, feedback);
      addAudit(
        '记录回答反馈',
        `${answer.query}：${b.dataset.feedback === 'yes' ? '有帮助' : '需要改进'}`,
      );
      render();
      toast('反馈已保存在本地。');
    }),
  );
  app.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((b) =>
    b.addEventListener('click', () => {
      switch (b.dataset.action) {
        case 'restore-project-notes': {
          if (!projectNotes.previous) break;
          const previous = projectNotes.previous;
          const overlay = showModal(
            '<p>输入框会切换到上一份保存内容。当前未保存的修改将被替换，请先导出需要保留的编辑稿。</p><div class="modal-actions"><button type="button" class="btn btn-primary" id="confirm-restore-notes">恢复上一份</button></div>',
            '恢复项目笔记',
          );
          overlay.querySelector('#confirm-restore-notes')?.addEventListener('click', () => {
            notesDraft = previous.text;
            overlay.remove();
            if (notesInput) notesInput.value = notesDraft;
            notesSaveFailed = false;
            updateNotesControls();
            notesInput?.focus();
            toast('已恢复到输入框；核对后再保存。');
          });
          break;
        }
        case 'export-project-notes':
          exportProjectNotes();
          break;
        case 'download-report':
          download(`MerchantLens-report-${scope.billDate}.md`, report());
          addAudit('导出分析报告', answer.title);
          toast('已导出含计算口径与证据的报告。');
          break;
        case 'review-ticket':
          showTicket();
          break;
        case 'download-ticket-json':
          if (answer.ticket) {
            download(
              `MerchantLens-ticket-${scope.billDate}.json`,
              JSON.stringify(
                {
                  status: 'PENDING_HUMAN_REVIEW',
                  scope,
                  ticket: answer.ticket,
                  evidence: answer.evidence,
                  generatedAt: new Date().toISOString(),
                  disclaimer: 'Synthetic data. No real fund operation.',
                },
                null,
                2,
              ),
              'application/json',
            );
            addAudit('导出待审核工单 JSON', answer.ticket.title);
            toast('已导出待审核工单 JSON。');
          }
          break;
        case 'run-evaluation':
          evaluations = runEvaluation();
          evalTime = new Date().toLocaleString('zh-CN', { hour12: false });
          addAudit(
            '运行规则评测',
            `${evaluations.filter((e) => e.passed).length}/${evaluations.length} 通过；不调用大模型。`,
          );
          render();
          toast(
            `评测完成：${evaluations.filter((e) => e.passed).length}/${evaluations.length} 条通过。`,
          );
          break;
        case 'download-evaluation':
          if (!evaluations.length) {
            toast('请先重跑评测，再导出实测报告。');
            break;
          }
          download(
            'MerchantLens-evaluation.json',
            JSON.stringify(
              {
                runAt: evalTime,
                scope: 'deterministic-rule-retrieval-evaluation',
                llmEvaluated: false,
                results: evaluations,
              },
              null,
              2,
            ),
            'application/json',
          );
          addAudit('导出评测报告', evalTime);
          toast('实测评测报告已下载。');
          break;
        case 'download-csv':
          exportCsv();
          break;
        case 'download-audit':
          download(
            'MerchantLens-audit.json',
            JSON.stringify(
              {
                audits,
                feedback,
                disclaimer: 'Browser-local demo records, not production audit logs.',
              },
              null,
              2,
            ),
            'application/json',
          );
          toast('本地审计与反馈记录已导出。');
          break;
        case 'show-about':
          showModal(
            `<div class="about-mark">${icon('spark')}</div><h3>商证 MerchantLens</h3><p>个人产品项目 v1.1，参考腾讯 TDesign 公开设计规范的独立原型。围绕商户对账，提供合成账单、计算与来源查看、工单草稿和产品练习。</p><p class="about-collaboration">项目采用人机协作：用户提出方向、材料和修改要求，AI 辅助整理方案、编写代码与文档；具体判断、笔记与验证结果仍需要本人核对。模拟任务不是腾讯雇佣实习或官方认证。</p><div class="about-lines"><div><span>当前引擎</span><strong>${modelAvailable ? '混元接入已配置（可选）' : '证据演示引擎'}</strong></div><div><span>数据来源</span><strong>合成商户与账单</strong></div><div><span>真实业务动作</span><strong>不执行任何资金操作</strong></div><div><span>模型效果与收益</span><strong>尚未经过真实商户验证</strong></div></div><p class="fine-print">本项目不是腾讯官方产品。真实商户接入、模型质量与业务收益尚待验证。</p>`,
            '作品说明',
          );
          break;
      }
    }),
  );
}
app.addEventListener('click', (event) => {
  const button = (event.target as Element).closest<HTMLElement>('[data-tab]');
  const next = button?.dataset.tab as Tab | undefined;
  if (next && tabs.some((item) => item.id === next)) {
    tab = next;
    render();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
});
render();
void fetch('/api/model-status')
  .then((r) => (r.ok ? r.json() : null))
  .then((status) => {
    if (status) {
      modelAvailable = Boolean(status.configured);
      modelName = status.model || '';
      render();
    }
  })
  .catch(() => {
    /* Static preview remains fully usable. */
  });
