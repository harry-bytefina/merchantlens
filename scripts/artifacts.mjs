import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { trades, posOrders, refunds, merchants, defaultScope } from '../build-core/data.js';
import { runEvaluation, evaluationCases } from '../build-core/eval.js';
import { analyze, reconcile, exportTicket } from '../build-core/engine.js';
import { missions } from '../build-core/internship.js';

const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
await mkdir('public/artifacts', { recursive: true });
const curriculum = [
  '# 商证 MerchantLens · CDG金融科技 AI 产品实习任务',
  `版本：${version}。本文由当前程序任务定义生成，与交互页面同步。任务情境、资源与排期为训练假设；官方链接提供业务规则依据。`,
  '## 如何进行',
  '阅读材料，选择一个主方案，提交180–1200有效字的交付，根据规则反馈修改，再进入下一任务。草稿与进度保存在当前浏览器，支持导出日志。',
  '基础检查：主方案选择20分；交付长度符合要求15分；四项词项覆盖各16.25分。通过还要求选对主方案、满足长度、必要项全部覆盖且至少三项内容检出。关键词检查用于提醒遗漏，具体逻辑和金额推导还需自己复核。',
  ...missions.map((m) =>
    [
      `## ${m.number}. ${m.title}`,
      `阶段：${m.stage}　角色：${m.role}`,
      `交付物：${m.deliverable}`,
      `### 任务情境\n${m.brief}`,
      '### 工作材料',
      ...m.facts.map((f) => '- ' + f),
      `官方业务依据：[${m.sourceLabel}](${m.sourceUrl})`,
      `### 单一方案判断\n${m.decision}`,
      ...m.choices.map(
        (c, i) =>
          `**${String.fromCharCode(65 + i)}. ${c.label}**\n\n${c.description}\n\n复盘参考：${c.feedback}`,
      ),
      '### 交付结构\n```text\n' + m.template + '\n```',
      '### 基础检查',
      ...m.criteria.map((c) => `- ${c.label}${c.required ? '（必要）' : ''}：${c.hint}`),
      `### 工作复盘\n${m.debrief}`,
    ].join('\n\n'),
  ),
  '## 个人训练记录',
  '只有亲自提交、复算、修改与复验的部分才能记作个人学习成果。开发完成不意味着用户已经完成六项训练；QA使用独立存储，不会替用户通关。',
  '本作品用于展示独立产品实践。公网作品链接、真实模型调用、用户访谈和业务试点以实际完成记录为准。',
].join('\n\n');
await writeFile('docs/INTERNSHIP_CURRICULUM.md', curriculum);
await cp('docs', 'public/docs', { recursive: true });
const csv = (rows) =>
  [
    Object.keys(rows[0]).join(','),
    ...rows.map((row) =>
      Object.values(row)
        .map((v) => '"' + String(v).replaceAll('"', '""') + '"')
        .join(','),
    ),
  ].join('\n');
for (const [name, rows] of [
  ['demo-trades', trades],
  ['demo-pos', posOrders],
  ['demo-refunds', refunds],
])
  await writeFile(`public/artifacts/${name}.csv`, '\ufeff' + csv(rows), 'utf8');
const results = runEvaluation();
const fixtureHash = createHash('sha256')
  .update(JSON.stringify({ merchants, trades, posOrders, refunds }))
  .digest('hex');
const report = {
  project: '商证 MerchantLens',
  version,
  generatedAt: new Date().toISOString(),
  mode: 'deterministic-evidence-engine',
  fixtureHash,
  counts: {
    merchants: merchants.length,
    trades: trades.length,
    posOrders: posOrders.length,
    refunds: refunds.length,
  },
  passed: results.filter((r) => r.passed).length,
  total: results.length,
  limitations: [
    '固定合成样例；不是随机真实业务样本',
    '检测意图、作用域、预期引用与状态；不检测所有自然语言安全风险',
    '未配置模型密钥；不代表混元输出质量',
    '不能用离线通过率估算生产收益',
  ],
  results,
};
await writeFile('public/artifacts/evaluation-report.json', JSON.stringify(report, null, 2));
await writeFile('public/artifacts/evaluation-cases.json', JSON.stringify(evaluationCases, null, 2));
await writeFile(
  'public/artifacts/evaluation-report.md',
  [
    '# 商证 MerchantLens · 可复现评测',
    `版本：${report.version}　生成时间：${report.generatedAt}`,
    `模式：确定性证据引擎（不含真实模型）\n\n场景：${report.passed}/${report.total}通过。`,
    `数据：${trades.length}条支付 / ${posOrders.length}条POS / ${refunds.length}条退款 / ${merchants.length}合成商户。`,
    `数据指纹SHA256：${fixtureHash}`,
    '\n## 结果',
    '| 用例 | 分组 | 问题 | 结果 |',
    '| --- | --- | --- | --- |',
    ...results.map(
      (r) => `| ${r.id} | ${r.group} | ${r.query || '空输入'} | ${r.passed ? '通过' : '未通过'} |`,
    ),
    '\n## 适用范围与局限',
    ...report.limitations.map((l) => '- ' + l),
    '\n## 复现',
    'npm install\nnpm test\nnpm run build',
    '\n注：金额、数据变更与租户隔离还有独立工程测试；生成本报告不替代npm test。',
  ].join('\n\n'),
);
await writeFile(
  'public/artifacts/sample-ticket.md',
  exportTicket(analyze('解释这一天的对账差异', defaultScope), defaultScope),
);
await writeFile(
  'public/artifacts/fixture-manifest.json',
  JSON.stringify(
    {
      version,
      fixtureHash,
      counts: report.counts,
      scopes: merchants.flatMap((m) =>
        ['2026-09-28', '2026-09-29'].map((billDate) => ({
          scope: { merchantId: m.id, billDate },
          result: reconcile({ merchantId: m.id, billDate }),
        })),
      ),
    },
    null,
    2,
  ),
);
if (report.passed !== report.total) {
  process.exitCode = 1;
  console.error('评测存在未通过案例，请修复后构建。');
} else
  console.log(
    `已导出：${report.passed}/${report.total}证据引擎场景、合成CSV、PRD、工单与数据指纹。`,
  );
