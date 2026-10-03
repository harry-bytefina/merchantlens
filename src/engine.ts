import { merchants, trades, posOrders, refunds, knowledge } from './data.js';
import type {
  Scope,
  Trade,
  PosOrder,
  Refund,
  Answer,
  Evidence,
  Finding,
  Reconciliation,
  KnowledgeChunk,
  Intent,
} from './types.js';

const dates = ['2026-09-28', '2026-09-29'];
export const money = (cents: number) =>
  new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(cents / 100);
export function validScope(scope: Scope): boolean {
  return Boolean(
    scope && merchants.some((m) => m.id === scope.merchantId) && dates.includes(scope.billDate),
  );
}
export function getScopedRows(scope: Scope): {
  trades: Trade[];
  posOrders: PosOrder[];
  refunds: Refund[];
} {
  if (!validScope(scope)) return { trades: [], posOrders: [], refunds: [] };
  const match = (r: { merchantId: string; date: string }) =>
    r.merchantId === scope.merchantId && r.date === scope.billDate;
  return {
    trades: trades.filter(match),
    posOrders: posOrders.filter(match),
    refunds: refunds.filter(match),
  };
}
const sum = (rows: { amount: number }[]) => rows.reduce((v, r) => v + r.amount, 0);
export function reconcile(scope: Scope): Reconciliation {
  const rows = getScopedRows(scope);
  const merchant = merchants.find((m) => m.id === scope.merchantId);
  const findings: Finding[] = [];
  const tradeById = new Map(rows.trades.map((r) => [r.id, r]));
  const posById = new Map<string, PosOrder[]>();
  for (const p of rows.posOrders) posById.set(p.id, [...(posById.get(p.id) || []), p]);
  for (const [id, entries] of posById) {
    if (entries.length > 1)
      findings.push({
        id: `F-DUP-${id}`,
        category: 'duplicate',
        title: 'POS重复记录',
        amount: sum(entries.slice(1)),
        severity: 'high',
        detail: `${id}在POS中出现${entries.length}次，需核验重复导出或重复记账；不能据此断定消费者重复支付。`,
        orderIds: [id],
      });
    const t = tradeById.get(id);
    if (!t)
      findings.push({
        id: `F-NOBILL-${id}`,
        category: 'missing-bill',
        title: 'POS有单，支付账单未匹配',
        amount: entries[0].amount,
        severity: 'high',
        detail: `${id}未匹配当前日支付账单；需检查支付渠道、账单日期和支付状态，未证明平台漏结算。`,
        orderIds: [id],
      });
    else if (t.amount !== entries[0].amount)
      findings.push({
        id: `F-AMOUNT-${id}`,
        category: 'amount',
        title: '订单金额不一致',
        amount: entries[0].amount - t.amount,
        severity: 'high',
        detail: `${id}：POS ${money(entries[0].amount)}，支付账单 ${money(t.amount)}。需核对优惠、修改记录与导出口径。`,
        orderIds: [id],
      });
  }
  for (const t of rows.trades) {
    if (!posById.has(t.id))
      findings.push({
        id: `F-NOPOS-${t.id}`,
        category: 'missing-pos',
        title: '支付成功，POS未匹配',
        amount: -t.amount,
        severity: 'medium',
        detail: `${t.id}支付账单记录${money(t.amount)}，POS中没有同ID；需核对收银系统同步和订单映射。`,
        orderIds: [t.id],
      });
    const expected = Math.round((t.amount * (merchant?.feeBps || 0)) / 10000);
    if (t.fee !== expected)
      findings.push({
        id: `F-FEE-${t.id}`,
        category: 'fee',
        title: '费用与演示合同不一致',
        amount: t.fee - expected,
        severity: 'medium',
        detail: `${t.id}账单手续费${money(t.fee)}，按演示合同逐笔计算应为${money(expected)}；偏差${money(t.fee - expected)}。实际费用须核验合同及退款返还，不能直接判定多收。`,
        orderIds: [t.id],
      });
  }
  for (const r of rows.refunds.filter((r) => r.status !== 'SUCCESS'))
    findings.push({
      id: `F-${r.id}`,
      category: 'refund',
      title: r.status === 'PROCESSING' ? '退款处理中，需回查' : '退款异常，需人工核验',
      amount: r.amount,
      severity: r.status === 'ABNORMAL' ? 'high' : 'low',
      detail: `${r.id} / ${r.orderId}：${r.status}，${money(r.amount)}。未确认最终退款成功，不能承诺银行到账。`,
      orderIds: [r.orderId],
    });
  const gross = sum(rows.trades),
    fee = rows.trades.reduce((v, r) => v + r.fee, 0),
    done = sum(rows.refunds.filter((r) => r.status === 'SUCCESS'));
  const series = dates.map((date) => {
    const ts = trades.filter((r) => r.merchantId === scope.merchantId && r.date === date);
    const rs = refunds.filter(
      (r) => r.merchantId === scope.merchantId && r.date === date && r.status === 'SUCCESS',
    );
    return { date, gross: sum(ts), net: sum(ts) - sum(rs) - ts.reduce((v, r) => v + r.fee, 0) };
  });
  return {
    tradeCount: rows.trades.length,
    posCount: rows.posOrders.length,
    gross,
    posGross: sum(rows.posOrders),
    fee,
    refunds: done,
    pendingRefunds: sum(rows.refunds.filter((r) => r.status !== 'SUCCESS')),
    net: gross - fee - done,
    difference: sum(rows.posOrders) - gross,
    findings,
    series,
  };
}

// Lexical retrieval only, not embeddings or a language model. Chinese bigrams + BM25.
function tokens(text: string): string[] {
  const normal = text.normalize('NFKC').toLowerCase();
  const latin = normal.match(/[a-z0-9][a-z0-9_-]*/g) || [];
  const chinese = normal.match(/[\u4e00-\u9fff]+/g) || [];
  return [
    ...latin,
    ...chinese.flatMap((run) =>
      run.length === 1
        ? [run]
        : Array.from({ length: run.length - 1 }, (_, i) => run.slice(i, i + 2)),
    ),
  ];
}
export function retrieve(query: string, limit = 3): KnowledgeChunk[] {
  const corpus = knowledge.map((k) => tokens(k.title + ' ' + k.text + ' ' + k.tags.join(' ')));
  const avg = corpus.reduce((v, t) => v + t.length, 0) / corpus.length;
  const q = [...new Set(tokens(query))];
  return knowledge
    .map((k, i) => {
      let score = 0;
      for (const term of q) {
        const df = corpus.filter((d) => d.includes(term)).length,
          tf = corpus[i].filter((t) => t === term).length;
        if (tf)
          score +=
            (Math.log(1 + (corpus.length - df + 0.5) / (df + 0.5)) * tf * 2.2) /
            (tf + 1.2 * (0.25 + (0.75 * corpus[i].length) / avg));
      }
      return { k, score };
    })
    .filter((r) => r.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.k);
}
function kEvidence(id: string): Evidence {
  const k = knowledge.find((k) => k.id === id)!;
  return { id: k.id, title: k.title, detail: k.text, kind: 'knowledge', url: k.url };
}
export function analyze(rawQuery: string, scope: Scope): Answer {
  const start = performance.now();
  const query = String(rawQuery || '')
    .trim()
    .normalize('NFKC');
  const base: Answer = {
    id: `A-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    query,
    intent: 'unsupported',
    status: 'clarify',
    title: '请补充可核验的问题',
    summary: '可以询问当前商户的对账差异、退款状态、手续费或账单下载规则。',
    sections: [],
    evidence: [],
    steps: [],
    suggestions: ['解释这一天的对账差异', '为什么退款还在处理中', '检查手续费是否与合同一致'],
    latencyMs: 0,
    engine: 'evidence',
  };
  const finish = (a: Answer) => ({ ...a, latencyMs: Math.max(0, performance.now() - start) });
  if (!validScope(scope))
    return finish({
      ...base,
      intent: 'blocked',
      status: 'blocked',
      title: '作用域无效',
      summary: '请在商户和日期下拉框选择已有合成样例。',
      steps: [{ name: '作用域校验', state: 'blocked', detail: '未知商户或日期；未读取任何账单。' }],
    });
  const merchant = merchants.find((m) => m.id === scope.merchantId)!;
  const isInjection =
    /(忽略|跳过|绕过|无视|ignore|bypass).{0,18}(指令|规则|系统|权限|隔离|之前|instruction|system|scope)|system\s*prompt|系统提示词|泄露.{0,8}(密钥|key)|api\s*key|密钥/.test(
      query.toLowerCase(),
    );
  const foreign = merchants.find(
    (m) => m.id !== scope.merchantId && (query.includes(m.name) || query.includes(m.id)),
  );
  const broad = /所有商户|全部商户|其他商户|跨商户|全平台商户/.test(query);
  const action =
    /(直接|立即|自动|帮我|替我|执行|发起).{0,18}(退款|转账|打款|提现|修改账户|支付)|转账.{0,8}(给|到)|^修改.{0,12}(账单|金额|手续费|收款账户)|把.{0,18}(金额|账单|手续费).{0,12}(改成|改为)|(?:execute|initiate|send).{0,18}(?:refund|transfer)|^change.{0,18}(?:amount|balance)/i.test(
      query,
    );
  if (isInjection || foreign || broad || action)
    return finish({
      ...base,
      intent: 'blocked',
      status: 'blocked',
      title: action ? '资金操作需要授权流程' : '请求超出当前证据与权限边界',
      summary: action
        ? '本作品只输出核验建议和工单草稿，不执行退款、转账或提现。'
        : '自然语言不能改变商户作用域或索取系统密钥。请只询问当前所选商户；其他合成样例可通过下拉框切换。',
      evidence: [kEvidence('D-SCOPE')],
      steps: [
        {
          name: '作用域与操作边界',
          state: 'blocked',
          detail: `已阻止请求；当前上下文${merchant.name}，未返回跨商户账单。`,
        },
      ],
      suggestions: ['查看当前商户的退款状态', '解释当前账单差异'],
    });
  const requestedDates = query.match(/20\d{2}[-/]\d{2}[-/]\d{2}/g) || [];
  if (requestedDates.some((d) => d.replaceAll('/', '-') !== scope.billDate))
    return finish({
      ...base,
      title: '问题日期与当前账单不一致',
      summary: `当前选择${scope.billDate}。请切换日期下拉框后再分析，无法从另一天的数据推断。`,
      steps: [{ name: '日期一致性', state: 'blocked', detail: '未用当前数据替代用户指定日期。' }],
    });
  const r = reconcile(scope),
    rows = getScopedRows(scope);
  const calculation: Evidence = {
    id: 'C-TOTAL',
    title: `${merchant.name} · ${scope.billDate} · 金额核算`,
    kind: 'calculation',
    detail: `支付交易${r.tradeCount}笔 / ${money(r.gross)}；POS ${r.posCount}条 / ${money(r.posGross)}；差异=POS−支付=${money(r.difference)}。SUCCESS退款${money(r.refunds)}；账单手续费${money(r.fee)}；演示账面净额=${money(r.gross)}−${money(r.refunds)}−${money(r.fee)}=${money(r.net)}。均以整数分计算。`,
  };
  const steps: Answer['steps'] = [
    {
      name: '锁定商户与日期',
      state: 'done',
      detail: `${merchant.name} / ${scope.billDate}；仅使用选定合成样例。`,
    },
    {
      name: '读取并核验结构化证据',
      state: 'done',
      detail: `${r.tradeCount}条支付、${r.posCount}条POS、${rows.refunds.length}条退款；金额单位为分。`,
    },
    {
      name: '匹配订单与检索规则',
      state: 'done',
      detail: '按商户＋日期＋订单号关联；词项BM25检索官方规则和产品口径。',
    },
    {
      name: '生成解释与待审核草稿',
      state: 'done',
      detail: '事实由计算工具生成，原因是待核验假设；没有写入资金系统。',
    },
  ];
  const ledgerEvidence = (f: Finding): Evidence => ({
    id: f.id,
    title: f.title,
    detail: f.detail,
    kind: 'ledger',
  });
  let intent: Intent = 'unsupported';
  if (/费率|手续费|费用|基点|fee/i.test(query)) intent = 'fee';
  else if (/退款|refund|processing|abnormal/i.test(query)) intent = 'refund';
  else if (/下载|哈希|签名|回调|账单不存在|今天.*账单|当天.*账单|bill.*download/i.test(query))
    intent = 'knowledge';
  else if (/对账|差异|异常|净额|营业额|支付金额|收入|POS|账面|提现余额|可提现|余额/i.test(query))
    intent = 'reconcile';
  if (!query || query.length < 3 || query.length > 800)
    return finish({
      ...base,
      summary: query.length > 800 ? '请将问题控制在800字以内，再指定想核验的指标。' : base.summary,
    });
  if (intent === 'unsupported')
    return finish({
      ...base,
      title: '缺少能支撑该问题的数据',
      summary:
        '当前作品只提供合成交易、POS、退款与规则文档。无法据此判断真实业绩、借贷额度、投资收益、客群转化或未提供的账单。',
      steps: [steps[0]],
      suggestions: base.suggestions,
    });
  const answer: Answer = {
    ...base,
    intent,
    status: 'answered',
    steps,
    evidence: [calculation],
    sections: [],
  };
  if (intent === 'reconcile') {
    const categories = ['duplicate', 'missing-pos', 'missing-bill', 'amount'];
    const diffs = r.findings.filter((f) => categories.includes(f.category));
    answer.title = diffs.length ? '差异已定位，根因仍需人工核验' : '账单订单金额已匹配';
    answer.summary = diffs.length
      ? `${merchant.name}在${scope.billDate}的POS与支付账单差异为${money(r.difference)}，发现${diffs.length}类订单匹配异常。差异是数据事实，重复导出、同步遗漏、渠道或日期口径是需要验证的原因。`
      : `${merchant.name}在${scope.billDate}的POS与支付记录金额一致，订单匹配差异为${money(r.difference)}。此结论覆盖当前合成样本；资金结算仍需独立核验。`;
    answer.sections.push({
      title: '金额与口径',
      content: calculation.detail + ' 演示账面净额不能视为实际到账或可提现余额。',
      evidenceIds: ['C-TOTAL', 'D-NET'],
    });
    answer.evidence.push(kEvidence('D-NET'));
    if (diffs.length) {
      answer.sections.push({
        title: '差异分解',
        content: diffs.map((f) => `${f.title}：${money(f.amount)}。${f.detail}`).join('\n'),
        evidenceIds: diffs.map((f) => f.id),
      });
      answer.evidence.push(...diffs.map(ledgerEvidence));
    } else
      answer.sections.push({
        title: '本次核验范围',
        content:
          '当前日订单金额完全匹配。该结论只覆盖预置数据，不代表银行结算、所有渠道或实际财务总账已经核平。',
        evidenceIds: ['C-TOTAL'],
      });
    answer.sections.push({
      title: '下一步处置',
      content: diffs.length
        ? '优先核查重复POS记录及未匹配订单，再核对金额变更；将订单证据交给门店运营和财务复核。费用与退款问题进入独立核验队列，避免与订单差异重复相加。'
        : '保存本次订单核验报告，继续核对费用、退款最终状态及资金结算材料。订单匹配无异常，仍不能替代财务资金核验。',
      evidenceIds: ['D-SCOPE'],
    });
    answer.evidence.push(kEvidence('D-SCOPE'));
  } else if (intent === 'refund') {
    answer.title = '先确认退款状态，再判断结果';
    answer.summary = `SUCCESS退款${money(r.refunds)}；未确认成功的退款合计${money(r.pendingRefunds)}。PROCESSING与ABNORMAL均不能当作已退款成功，也不能承诺银行到账。`;
    const f = r.findings.filter((f) => f.category === 'refund');
    const rs: Evidence[] = rows.refunds.map((refund) => ({
      id: refund.id,
      title: `退款 ${refund.id}`,
      detail: `原订单${refund.orderId}，金额${money(refund.amount)}，状态${refund.status}，日期${refund.date}，属于${merchant.name}。`,
      kind: 'ledger',
    }));
    answer.evidence.push(...rs, kEvidence('K-REFUND'), kEvidence('K-QUERY'), kEvidence('D-NET'));
    answer.sections = [
      {
        title: '退款明细',
        content: rs.map((e) => e.detail).join('\n'),
        evidenceIds: rs.map((e) => e.id),
      },
      {
        title: '状态解释与核验',
        content:
          '申请受理不等于SUCCESS。处理中需要回查最终结果；异常单需要核查官方返回信息并人工处理。受理阶段资金可被扣至中间账户，所以不能把处理中解释成没有扣款。',
        evidenceIds: ['K-REFUND', 'K-QUERY'],
      },
      {
        title: '分析口径',
        content:
          'SUCCESS计入演示净交易分析；未成功退款单独列为状态待核验。缺少资金账单时不推断实际余额、冻结金额或到账时间。',
        evidenceIds: ['D-NET'],
      },
    ];
    if (f.length) answer.suggestions = ['生成退款异常工单', '解释这一天的对账差异'];
  } else if (intent === 'fee') {
    const f = r.findings.filter((f) => f.category === 'fee');
    const expected = rows.trades.reduce(
      (v, t) => v + Math.round((t.amount * merchant.feeBps) / 10000),
      0,
    );
    answer.title = f.length ? '费用存在待核验偏差' : '费用与演示合同一致';
    answer.summary = `账单手续费${money(r.fee)}，按${merchant.feeBps}个基点的演示合同逐笔计算应为${money(expected)}；偏差${money(r.fee - expected)}。这是合同样例，不代表微信支付统一费率。`;
    answer.evidence.push(kEvidence('D-FEE'), ...f.map(ledgerEvidence));
    answer.sections = [
      {
        title: '费用计算',
        content: answer.summary,
        evidenceIds: ['C-TOTAL', 'D-FEE', ...f.map((x) => x.id)],
      },
      {
        title: '核验建议',
        content:
          f.map((x) => x.detail).join('\n') ||
          '当前样例逐笔费用无偏差。真实商户还需核验实际合同、优惠和退款手续费回退。',
        evidenceIds: ['D-FEE', ...f.map((x) => x.id)],
      },
    ];
  } else {
    const result = retrieve(query);
    if (!result.length)
      return finish({
        ...base,
        steps: [steps[0]],
        title: '没有找到足够依据',
        summary: '当前知识库中没有可直接支持该问题的规则。请补充来源或缩小问题范围。',
      });
    answer.title = '规则解释附带可追溯来源';
    answer.evidence = result.map((k) => kEvidence(k.id));
    answer.summary = result[0].text;
    answer.sections = result.map((k) => ({ title: k.title, content: k.text, evidenceIds: [k.id] }));
    answer.steps = [
      steps[0],
      {
        name: '词项检索',
        state: 'done',
        detail: `检索到${result.length}条规则；仅逐条转述，未推断真实订单结果。`,
      },
    ];
  }
  const ticketBody = [
    `范围：${merchant.name} / ${scope.billDate}`,
    `问题：${query}`,
    `初步结论：${answer.summary}`,
    ...answer.sections.map((s) => `${s.title}\n${s.content}`),
    '待人工确认：数据导出时间、支付渠道、合同版本与实际订单状态。',
    '处置边界：本草稿不发起退款、转账或外部工单。',
  ].join('\n\n');
  if (intent !== 'knowledge')
    answer.ticket = {
      title: `${merchant.name} · ${scope.billDate} · ${intent === 'refund' ? '退款状态核验' : intent === 'fee' ? '手续费核验' : '对账差异核验'}`,
      body: ticketBody,
      owner: intent === 'refund' ? '门店客服 + 财务复核' : '门店运营 + 财务复核',
    };
  return finish(answer);
}
export function exportTicket(answer: Answer, scope: Scope): string {
  return [
    '# 商证 MerchantLens · 待审核工单草稿',
    `生成时间：${new Date().toISOString()}`,
    `商户作用域：${scope.merchantId} / ${scope.billDate}`,
    '数据：合成样例；无真实资金操作',
    `\n## ${answer.ticket?.title || answer.title}`,
    answer.ticket?.body || answer.summary,
    '\n## 证据索引',
    ...answer.evidence.map(
      (e) => `- [${e.id}] ${e.title}：${e.detail}${e.url ? '\n  来源：' + e.url : ''}`,
    ),
    '\n## 审核记录',
    '审核人：________   结论：________   时间：________',
  ].join('\n\n');
}
