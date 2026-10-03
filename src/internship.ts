import { defaultScope, merchants, trades, refunds } from './data.js';
import { reconcile, money } from './engine.js';

/** Independent learning simulation, not a Tencent internship or recruiting test. */
const STORAGE_KEY =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('qa')
    ? 'merchantlens-internship-qa-v1'
    : 'merchantlens-internship-v1';
const MIN_CHARS = 180;
const MAX_CHARS = 1200;
const r = reconcile(defaultScope);
const merchant = merchants.find((item) => item.id === defaultScope.merchantId)!;
const scopedRefunds = refunds.filter(
  (item) => item.merchantId === defaultScope.merchantId && item.date === defaultScope.billDate,
);
const BILL_URL = 'https://pay.wechatpay.cn/doc/v3/merchant/4013071218';
const REFUND_URL = 'https://pay.wechatpay.cn/doc/v3/merchant/4013071031';
const MODEL_URL = 'https://cloud.tencent.com/document/product/1823/130079';

export interface InternshipCriterion {
  id: string;
  label: string;
  groups: string[][];
  required: boolean;
  hint: string;
}
export interface InternshipChoice {
  id: string;
  label: string;
  description: string;
  correct: boolean;
  feedback: string;
}
export interface InternshipMission {
  id: string;
  number: number;
  stage: string;
  title: string;
  role: string;
  deliverable: string;
  brief: string;
  facts: string[];
  sourceUrl: string;
  sourceLabel: string;
  decision: string;
  choices: InternshipChoice[];
  criteria: InternshipCriterion[];
  template: string;
  debrief: string;
}
export interface GradeResult {
  missionId: string;
  score: number;
  passed: boolean;
  choiceCorrect: boolean;
  charCount: number;
  minimumChars: number;
  maximumChars: number;
  matchedCriteria: number;
  requiredSatisfied: boolean;
  rubric: {
    id: string;
    label: string;
    matched: boolean;
    required: boolean;
    keywords: string[][];
    hint: string;
    points: number;
  }[];
  feedback: string;
  nextAction: string;
}
interface SavedSubmission {
  choiceId: string;
  text: string;
  submittedAt: string;
}
interface MissionEntry {
  choiceId: string;
  draft: string;
  attempts: number;
  lastSubmission?: SavedSubmission;
  accepted?: SavedSubmission;
}
export interface InternshipProgress {
  version: 1;
  activeMission: number;
  unlockedMission: number;
  entries: Record<string, MissionEntry>;
  updatedAt: string;
}

const criterion = (
  id: string,
  label: string,
  groups: string[][],
  required: boolean,
  hint: string,
): InternshipCriterion => ({ id, label, groups, required, hint });
const numeric = (value: number) => String(value / 100);

export const missions: InternshipMission[] = [
  {
    id: 'mvp',
    number: 1,
    stage: '需求定义',
    title: '需求评审：首版做什么',
    role: '产品经理 · 业务负责人',
    deliverable: '一页 MVP 决策备忘录',
    brief:
      '业务负责人提出：“用 AI 提高商户运营效率。”本次模拟团队有 1 名产品、2 名开发、1 名客服代表，首轮迭代 10 个工作日。请根据现有数据选定首版范围，并写出验收方法。',
    facts: [
      `当前材料覆盖 ${merchants.length} 个合成商户、${trades.length} 条支付记录和两个账单日期；没有广告曝光、点击、授信、征信或真实资金权限。`,
      '已具备交易、POS、退款、演示合同费率和官方规则来源；可形成解释与待人工审核的工单。',
      '模拟目标：缩短运营人员从发现差异到形成可审核处理建议的时间。目标是待验证假设，没有线上成效数据。',
    ],
    sourceUrl: BILL_URL,
    sourceLabel: '微信支付 · 下载账单开发指引',
    decision: '选一项作为首版方案。',
    choices: [
      {
        id: 'evidence',
        label: '商户账单异常解释与工单草稿',
        description: '计算账单差异，附上规则来源，交给运营和财务审核。',
        correct: true,
        feedback:
          '现有账单、POS 和退款记录足以支持异常核对。广告方案缺少曝光、转化归因与实验材料；自动贷款缺少授信资料、授权和风控体系。本期先测试处理耗时、工单能否被审核以及事实错误率，不承诺拉新或自动执行资金动作。',
      },
      {
        id: 'ads',
        label: 'AI 广告投放与精准获客',
        description: '预测人群、自动投放，追求新客与 GMV 增长。',
        correct: false,
        feedback:
          '增长方向有商业价值，但当前没有广告链路、归因、预算和转化数据。只凭支付流水不能证明因果增量，首轮会把需求、数据与验收风险一起放大。应先补齐数据与实验设计，作为独立后续方向。',
      },
      {
        id: 'loan',
        label: '自动贷款审批与资金执行',
        description: '根据账单决定授信额度并自动放款。',
        correct: false,
        feedback:
          '交易流水不等于完整信用评估材料。原型没有身份、授权、风控和资金执行体系，无法在 10 天内合理承诺此闭环。AI 解释能力不能替代授信决策；本次不选。',
      },
    ],
    criteria: [
      criterion(
        'user',
        '明确服务对象与具体任务',
        [
          ['商户', '运营', '客服'],
          ['差异', '异常', '对账'],
        ],
        true,
        '说明谁在什么场景下受阻，而非只写“提升效率”。',
      ),
      criterion(
        'boundary',
        '给出人工审核与首版边界',
        [['人工', '审核', '只读', '不执行', '不自动']],
        true,
        '写清产品生成建议，资金操作仍走授权系统。',
      ),
      criterion(
        'tradeoff',
        '分别解释未选方案',
        [
          ['广告', '获客', '投放'],
          ['贷款', '授信', '放款'],
        ],
        false,
        '对两种未选方案分别交代缺失的数据或权限。',
      ),
      criterion(
        'metric',
        '定义可测业务指标',
        [['时间', '耗时', '错误率', '完成率', '可审核', '验收']],
        false,
        '写指标口径、基线采集或验证方法，勿伪造收益。',
      ),
    ],
    template:
      '【用户与问题】\n【唯一 MVP 与不选其他方案的原因】\n【首版范围与人工审核】\n【验收指标与验证方法】',
    debrief:
      '评审时先说明用户遇到什么问题、现有数据能支持什么、团队本期能做什么。微信支付提供业务规则，混元可用于解释证据，企业微信可作为后续工单协同入口；每一项接入都要单独验证。',
  },
  {
    id: 'ledger',
    number: 2,
    stage: '账单口径',
    title: '账单核对：净额的计算口径',
    role: '产品经理 · 财务分析',
    deliverable: '金额核算与口径说明',
    brief: `财务要求你解释 ${merchant.name} 在 ${defaultScope.billDate} 的账单。先写公式并手算，再写业务含义。不能把系统展示的“演示账面净额”直接称为银行到账或可提现余额。`,
    facts: [
      `同一范围支付 ${r.tradeCount} 笔：${money(r.gross)}；POS ${r.posCount} 条：${money(r.posGross)}；列示手续费：${money(r.fee)}。`,
      `SUCCESS 退款：${money(r.refunds)}；未确认成功退款：${money(r.pendingRefunds)}，单独保留状态。`,
      `本题统一差异方向为 POS − 支付。平台样本账面净额 = 支付总额 − SUCCESS 退款 − 列示手续费。请得出两个数值，再与工作台交叉验证。`,
      '反事实检验：若把全部未成功退款提前扣进净额，报表会额外减去一笔尚未确认的状态金额；资金账单与结算流水缺失，无法推出实际银行余额。',
    ],
    sourceUrl: BILL_URL,
    sourceLabel: '微信支付 · 账单获取与完整性校验',
    decision: '你采用哪一种口径？',
    choices: [
      {
        id: 'settled',
        label: '将演示净额直接标为实际到账',
        description: '用账单支付额减手续费，忽略资金与结算差异。',
        correct: false,
        feedback:
          '交易账单是订单核对证据，不等于银行资金流水。结算周期、冻结、资金账单和手续费返还尚未覆盖，展示名称会把一个简化指标变成过度承诺。',
      },
      {
        id: 'normalized',
        label: '先算简化净额，再限定适用范围',
        description: 'SUCCESS 退款计入口径，处理中与异常单单列，差异方向固定。',
        correct: true,
        feedback: `本样本净额 = ${money(r.gross)} − ${money(r.refunds)} − ${money(r.fee)} = ${money(r.net)}；POS − 支付 = ${money(r.difference)}。费用、退款状态与订单匹配差异属于不同维度，不能简单相加称为资金损失。这里是整数分计算的演示分析值，不等于真实余额。`,
      },
      {
        id: 'allrefunds',
        label: '所有退款一律扣除，差异就是损失',
        description: 'SUCCESS、PROCESSING、ABNORMAL 使用同一个财务口径。',
        correct: false,
        feedback:
          '这样混淆了申请受理、最终成功和资金结算。未成功退款需要单列状态核验；订单差异也可能源于重复导出或映射。不能用一次总额运算直接认定资金损失。',
      },
    ],
    criteria: [
      criterion(
        'net',
        '写出正确净额或整数分结果',
        [[numeric(r.net), String(r.net)]],
        true,
        `核对公式与结果：${money(r.net)}（${r.net} 分）。`,
      ),
      criterion(
        'limit',
        '限定为演示口径而非实际资金余额',
        [
          ['演示', '分析', '简化', '样本'],
          ['到账', '余额', '提现', '结算', '资金账单'],
        ],
        true,
        '明确尚缺资金证据，避免把指标解释成实际余额。',
      ),
      criterion(
        'refund',
        '区分成功退款与未成功状态',
        [
          ['success', '成功退款'],
          ['processing', '处理中', '异常', '未成功'],
        ],
        false,
        '说明为何当前净额只扣 SUCCESS，其他状态另核验。',
      ),
      criterion(
        'difference',
        '注明差异方向与数值',
        [['pos'], [numeric(r.difference), String(r.difference)], ['差异', '减', '−', '-']],
        false,
        `方向为 POS − 支付，本样本为 ${money(r.difference)}。`,
      ),
    ],
    template:
      '【商户、账期与单位】\n【净额公式与手算结果】\n【POS 差异方向与结果】\n【退款状态及结算口径的限制】',
    debrief:
      '净额字段需要同时交代公式、数据范围和不能代表的事项。手算后与工作台复核，再检查标签是否会让财务误认为已经完成银行结算核对。',
  },
  {
    id: 'refund',
    number: 3,
    stage: '退款核验',
    title: '退款处理：受理之后怎么确认结果',
    role: '产品经理 · 客服与财务',
    deliverable: '退款核验工单与客服答复',
    brief:
      '模拟客服收到投诉：“系统显示已受理，客户却没收到钱。”请按当前退款记录回答，只陈述已知事实、未确认事项、证据和责任人，不能承诺未经核实的到账时间。',
    facts: scopedRefunds
      .map((item) => `${item.id} / 原订单 ${item.orderId} / ${money(item.amount)} / ${item.status}`)
      .concat([
        '官方退款指引：受理成功后资金可进入退款中间账户；最终结果需由退款查询或结果通知确认。',
        '本作品无真实退款 API、无银行到账记录、无外部工单系统。异常单的具体根因仍需核查官方返回信息。',
      ]),
    sourceUrl: REFUND_URL,
    sourceLabel: '微信支付 · 退款开发指引',
    decision: '你如何处理这次咨询？',
    choices: [
      {
        id: 'guarantee',
        label: '受理即成功，向客户承诺立即到账',
        description: '用明确承诺尽快结束咨询。',
        correct: false,
        feedback:
          '受理与 SUCCESS 是不同状态；SUCCESS 也不能被原型解释成已核实客户银行余额。没有订单回查与到账证据时，明确承诺只会把不确定性转移给客户。',
      },
      {
        id: 'execute',
        label: '自动发起第二笔退款',
        description: '把状态未成功直接视为失败，绕过人工核验。',
        correct: false,
        feedback:
          '状态待确认并不等于可安全再次执行资金动作。需要幂等、原退款单回查、权限和正式流程；本产品不提供退款执行工具，本次不选。',
      },
      {
        id: 'verify',
        label: '按状态分流，形成待审核核验工单',
        description: '记录证据，查询/通知确认，异常由客服与财务人工核查。',
        correct: true,
        feedback:
          'PROCESSING 进入结果回查，ABNORMAL 进入异常核验，SUCCESS 按结果说明。工单应包含商户、账期、原订单、退款单、状态、金额、证据与责任人；“处理中未计入简化净额”不意味着资金未扣除。原型只生成草稿。',
      },
    ],
    criteria: [
      criterion(
        'state',
        '明确受理与最终成功的区别',
        [['受理'], ['success', '成功', '最终']],
        true,
        '说明受理≠最终成功，并解释当前状态。',
      ),
      criterion(
        'verify',
        '提出状态回查或通知核验',
        [
          ['查询', '回查', '通知', '回调'],
          ['人工', '客服', '财务', '核验'],
        ],
        true,
        '提出可执行的核验动作和责任人。',
      ),
      criterion(
        'evidence',
        '保留订单和退款单证据',
        [
          ['订单', 'qh-'],
          ['退款单', 'rf-', '证据'],
        ],
        false,
        '把原订单与退款单绑定，不仅写泛化结论。',
      ),
      criterion(
        'money',
        '理解资金中间账户与承诺边界',
        [
          ['中间账户', '已扣', '扣除', '资金'],
          ['到账', '承诺', '未知', '未确认'],
        ],
        false,
        '说明状态分析与真实资金流的区别。',
      ),
    ],
    template:
      '【已知状态与证据】\n【不能据此断言的事项】\n【查询/通知核验及责任人】\n【客户回复与人工处理边界】',
    debrief:
      '客服答复应写清已确认的状态、下一次查询和跟进人。最终结果不明确时保留待核验项，避免重复发起退款或承诺未经确认的到账时间。',
  },
  {
    id: 'workflow',
    number: 4,
    stage: 'AI 方案',
    title: '技术评审：何时调用模型',
    role: '产品经理 · AI 与研发',
    deliverable: '工作流、路由与单位成本设计',
    brief:
      '技术团队要求说明：“既然已有规则，为什么还需要 AI？”请把计算、检索、生成与审核分开，并给模型一个足够具体、可以独立验收的职责。',
    facts: [
      '演示已有作用域过滤、整数分对账、词项检索和规则解释。模型只承担证据约束下的自然语言解读；无实时模型调用记录。',
      '成本练习假设（并非腾讯报价）：1 万个任务；35% 需要模型；每次输入 1500 token、输出 350 token；单价为输入 ¥2 / 百万 token、输出 ¥8 / 百万 token。',
      '基础模型成本：3500 × (1500×2 + 350×8) / 1,000,000 = ¥20.30。若额外请求率为 10%，模型预算示例 ¥22.33；尚未计入检索、服务器、监控和人工审核。',
      '服务端真实接入预置 25 秒总超时；仅对 429/503 重试一次；密钥留服务端；无效 JSON 或范围外引用拒绝展示模型摘要。',
    ],
    sourceUrl: MODEL_URL,
    sourceLabel: '腾讯云 · TokenHub 语言模型调用概览',
    decision: '你选择哪一种路由方案？',
    choices: [
      {
        id: 'llmall',
        label: '所有请求先调用大模型，再让模型计算',
        description: '统一自然语言链路，减少传统规则代码。',
        correct: false,
        feedback:
          '这会让金额正确性依赖生成输出，同时为拒答、查规则等简单问题支付成本。调用次数减少不必然提高效果，但账务计算必须有确定性来源；模型可以解释，不能接管金额事实。',
      },
      {
        id: 'hybrid',
        label: '确定性计算与检索在前，按需生成解读',
        description: '明确拒答、澄清、低风险规则路径与模型路径，失败回退。',
        correct: true,
        feedback:
          '混合路径将金额与权限留给确定性工具，把表达任务交给模型。需要比较路由错误率、解释可用性、延迟与总成本；¥20.30 只是当前假设下的 token 成本，不代表真实服务报价或整套运营成本。',
      },
      {
        id: 'rulesonly',
        label: '永久只用模板，不设计任何模型路径',
        description: '接受表达覆盖有限，拒绝所有生成能力。',
        correct: false,
        feedback:
          '无密钥阶段用规则演示是正确工程选择；但本题要设计未来的 AI 产品职责。完全不设计解释层，会错过将复杂证据转成不同角色语言的空间。应先定义质量增益与上线门槛，未验证之前继续用模板。',
      },
    ],
    criteria: [
      criterion(
        'role',
        '分离计算事实和模型解释',
        [
          ['计算', '确定性', '整数'],
          ['解释', '生成', '解读'],
        ],
        true,
        '规定金额不由模型改写，模型只解释已计算证据。',
      ),
      criterion(
        'fallback',
        '设计失败回退与调用边界',
        [
          ['回退', '降级', '超时', '拒答'],
          ['证据', '引用', '范围', '审核'],
        ],
        true,
        '说明如何识别并显示调用失败，保留本地证据答案。',
      ),
      criterion(
        'cost',
        '写出成本或可复核计算',
        [
          ['token', '成本', '预算'],
          ['20.3', '22.33', '1500', '3500'],
        ],
        false,
        '给公式、调用比例与单位价格；明确是模拟假设。',
      ),
      criterion(
        'evaluate',
        '比较质量、延迟及调用成本',
        [
          ['评测', '质量', '准确', '正确'],
          ['延迟', '耗时', '成本', '路由'],
        ],
        false,
        '选择模型须通过任务评测，不能只看知名度。',
      ),
    ],
    template:
      '【请求分流与模型职责】\n【证据输入、输出校验与失败回退】\n【成本公式及假设】\n【质量与延迟的评测方法】',
    debrief:
      '先比较模板与模型在同一批任务中的解释质量、延迟和成本，再决定哪些请求值得调用。API 能连接只是接入检查，解释是否有用还要另做评测。',
  },
  {
    id: 'delivery',
    number: 5,
    stage: '联调评审',
    title: '支付联调：按期演示与真实灰度',
    role: '产品经理 · 业务、研发、客服、财务',
    deliverable: '支付联调评审纪要与阶段交付计划',
    brief:
      '模拟团队计划在第 10 个工作日启动授权商户灰度。第 7 日研发发现账单下载签名与哈希校验、退款回调验签及解密联调尚需额外 4 个工作日；业务又追加多币种与自动退款。内部合成样本分析已经可演示。请提出一个单一主方案，区分可准时交付的学习与评审价值、真实数据安全硬门，以及不纳入本期的新需求。',
    facts: [
      '业务：希望按期看见差异定位和客服核验流程，并追加多币种结算与自动退款；追加需求尚无完整数据模型和审批方案。',
      '研发：内部合成样本的确定性分析和工单草稿已完成；真实商户身份授权、账单下载签名/哈希完整性校验及退款回调验签/解密联调尚未完整验收。',
      '客服：需要订单、退款状态、证据和责任人。财务：必须统一人民币样本口径，真实多币种还需汇率来源、币种精度、结算差异与对账规则；自动退款另需授权、幂等、审批和审计。',
      '可原期交付内部合成离线演示；未来如使用真实资料进行脱敏离线评审，也必须先取得授权。真实商户灰度不得绕过鉴权、验签与完整性硬门。本作品实际只用合成数据，没有处理授权真实商户资料。',
      '第 10 日计划、第 7 日联调发现和额外 4 日均为角色扮演假设，不是本项目真实进度。官方依据用于验证安全接入规则，不是模拟时间的出处。',
    ],
    sourceUrl: BILL_URL,
    sourceLabel: '微信支付 · 账单下载签名与哈希完整性校验',
    decision: '选一项提交给业务、研发、客服和财务评审。',
    choices: [
      {
        id: 'pressure',
        label: '按期上真实商户，先跳过验签和完整性校验',
        description: '借赶进度同时接收新增范围，后续再补安全措施。',
        correct: false,
        feedback:
          '不选这一方案：真实数据的身份授权、验签与文件完整性不是可后补的体验功能。跳过它们可能导致篡改或伪造通知进入业务判断。多币种与自动退款也不能靠现有人民币只读分析顺便完成，赶时间不能替代联调和授权验收。',
      },
      {
        id: 'delayall',
        label: '取消内部演示，等新增需求全部做完再交付',
        description: '将多币种、自动退款和真实商户联调一起打包等待。',
        correct: false,
        feedback:
          '不选这一方案：内部合成离线闭环已经可用，可以原期验证产品价值、培训客服并澄清财务口径；全部取消会丢失可低风险交付的价值。新增需求尚未定义验收条件，等待“全部做完”还会造成范围和日期无界。',
      },
      {
        id: 'phase',
        label: '原期内部离线演示，真实灰度等待安全硬门',
        description: '只演示合成数据；新增需求另立项，四方确认联调与验收。',
        correct: true,
        feedback:
          '唯一主方案是分阶段交付：原期做内部合成离线演示；未来如用脱敏真实资料，也先取得授权。真实商户灰度延期到鉴权、账单签名/哈希与退款回调验签完整性验收完成。不选按期跳过验签，因为安全底线不可换进度；不选等待全部新增需求，因为离线闭环已有价值。多币种与自动退款移出本期，分别补数据口径、授权幂等与审批设计。四方共同确认负责人、关键路径、人工复核和新灰度日期。',
      },
    ],
    criteria: [
      criterion(
        'phase',
        '拆出内部合成离线交付与真实灰度',
        [
          ['阶段', '分期', '首版', '先交付', '离线', '演示'],
          ['合成', '脱敏', '内部'],
          ['灰度', '真实商户', '真实数据'],
        ],
        true,
        '原期可做内部合成演示；真实商户灰度等接入硬门完成，脱敏真资料须先授权。',
      ),
      criterion(
        'quality',
        '保留鉴权、验签与完整性硬门',
        [
          ['鉴权', '权限', '授权'],
          ['验签', '签名', '哈希', '完整性'],
          ['硬门', '验收', '审核', '人工', '不跳过'],
        ],
        true,
        '明确安全验收和人工复核，不能先上真实数据后补校验。',
      ),
      criterion(
        'roles',
        '写明角色分工与共同决策',
        [['业务'], ['研发', '技术'], ['客服', '财务']],
        false,
        '说明每一方提出什么意见、由谁确认哪项交付。',
      ),
      criterion(
        'plan',
        '给关键路径、负责人或里程碑',
        [
          ['负责人', '责任人', '里程碑', '日期', '关键路径'],
          ['沟通', '同步', '评审', '变更', '交接'],
        ],
        false,
        '让计划能被跟踪，而非只有协调态度。',
      ),
    ],
    template:
      '【联调缺口与不可绕过的硬门】\n【内部离线交付与真实灰度的唯一阶段方案】\n【不选其他方案及新增需求移出本期的原因】\n【四方责任、人工复核、验收与变更同步】',
    debrief:
      '演示进度与真实数据接入可以分开安排。内部合成材料用于检查工作流；真实灰度要等授权、验签和完整性检查完成。把多币种和自动退款另列需求，记录各方确认的范围、负责人和验收日期。',
  },
  {
    id: 'launch',
    number: 6,
    stage: '上线决策',
    title: '上线评审：现在能开放真实版本吗',
    role: '产品经理 · 发布负责人',
    deliverable: 'Go / No-Go 决策与灰度回滚清单',
    brief:
      '你需要向模拟发布评审会解释：本地规则与接口测试已通过，但没有真实混元语义评测、真实账户权限、真实支付接入或线上业务数据。选择一个当前发布决策，并给出未来由 No-Go 变成 Go 的硬门槛。',
    facts: [
      '本地场景评测能验证计算、检索、引用范围、拒答和澄清；模拟上游测试能验证 JSON、超时与有限重试。它们不能替代真实模型语义忠实度评测。',
      '额外训练假设：未来某次模型语义评测总体正确率达 98.5%，但出现 1 例跨商户信息泄漏，真实版仍应 No-Go。98.5% 和 1 例是本任务模拟数字，不是本项目实测结果。',
      '模型摘要只检查 JSON 与证据 ID 白名单，不能保证每句话完全正确。尚无真实 token 用量、延迟分布、账户权限与付费接入测试。',
      '本轮可分享不含密钥的静态合成演示。真实商户版本需要身份与租户授权、成本配额、监控、审批与业务验收。',
      '以下灰度量级与数值阈值应由业务和研发协商，并标为目标；不能把学习练习得分写成招聘测评或线上产品成功率。',
    ],
    sourceUrl: MODEL_URL,
    sourceLabel: '腾讯云 · 模型服务开通与调用边界',
    decision: '当前唯一发布决策是什么？',
    choices: [
      {
        id: 'fullgo',
        label: 'Go：本地评测全过即可全量真实商户上线',
        description: '把演示测试当成模型效果与生产权限验收。',
        correct: false,
        feedback:
          '本地规则测试的适用范围很明确，不能推出真实 LLM 语义正确或生产隔离已完成。越权泄露、金额误述、错误资金动作等硬风险不能被平均通过率掩盖。',
      },
      {
        id: 'nogolive',
        label: 'No-Go 真实模型；Go 静态演示，再完成硬门与灰度',
        description: '分清作品展示与真实业务上线，先补真实评测、权限和回滚。',
        correct: true,
        feedback:
          '对外作品演示可交付，真实模型与真实商户版本暂不全量上线。硬门可包含：金额/状态不可改写、跨商户泄露与写操作为零容忍、语义引用人工验收、超时成本预算和故障回退。之后以授权小范围灰度、人工复核与版本回滚验证目标。门槛是设计，不是已实现的线上数据。',
      },
      {
        id: 'never',
        label: '永久 No-Go：只要可能幻觉就停止项目',
        description: '放弃受约束生成与逐步验证的机会。',
        correct: false,
        feedback:
          '不确定性需要产品化控制，而不是用一个永远不交付的结论替代验证。先交付合成演示与确定性价值，再以权限、证据、语义评测、人工复核和回滚限制模型用途。',
      },
    ],
    criteria: [
      criterion(
        'gate',
        '分清真实模型评测与本地演示',
        [
          ['真实模型', '语义', '混元', 'llm'],
          ['评测', '验收', '未验证', '测试'],
        ],
        true,
        '说明还缺哪些真实模型证据，避免把模板通过率当模型质量。',
      ),
      criterion(
        'hardgate',
        '定义硬门与人工复核',
        [
          ['金额', '跨商户', '权限', '泄露', '写操作'],
          ['硬门', '零容忍', '阻断', '人工', '审核'],
        ],
        true,
        '对高风险错误设置停止条件，不能只看综合平均分。',
      ),
      criterion(
        'rollout',
        '给灰度范围与回滚动作',
        [
          ['灰度', '小范围', '试点'],
          ['回滚', '降级', '关闭模型', '切回'],
        ],
        false,
        '写谁何时关闭哪个能力，以及保留的确定性闭环。',
      ),
      criterion(
        'observe',
        '设置质量、延迟或成本监控',
        [
          ['监控', '告警', '阈值', '指标'],
          ['延迟', '成本', '错误', '投诉', '修订'],
        ],
        false,
        '以业务与系统指标跟踪灰度，注明目标而非业绩。',
      ),
    ],
    template:
      '【当前 Go / No-Go 决策】\n【真实模型和业务权限的硬门】\n【授权灰度、人工复核与监控】\n【触发条件、责任人与回滚方案】',
    debrief:
      '发布纪要分开记录已通过的检查、尚未验证的事项和停止发布条件。综合通过率不能抵消跨商户泄漏；每项问题都应有复核人、修复计划和回滚措施。',
  },
];

function normalize(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s,，¥￥]/g, '');
}
function charCount(text: string) {
  return Array.from(text.replace(/\s/g, '')).length;
}
const esc = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (item) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[item]!,
  );

/** Transparent lexical rubric; this is not AI semantic grading or recruiting assessment. */
export function gradeSubmission(missionId: string, choiceId: string, text: string): GradeResult {
  const mission = missions.find((item) => item.id === missionId);
  if (!mission) throw new Error('未知的学习任务。');
  const choice = mission.choices.find((item) => item.id === choiceId);
  const normalized = normalize(text);
  const count = charCount(text);
  const validLength = count >= MIN_CHARS && text.length <= MAX_CHARS;
  const rubric = mission.criteria.map((item) => {
    const matched = item.groups.every((group) =>
      group.some((word) => normalized.includes(normalize(word))),
    );
    return {
      id: item.id,
      label: item.label,
      matched,
      required: item.required,
      keywords: item.groups,
      hint: item.hint,
      points: matched ? 16.25 : 0,
    };
  });
  const matchedCriteria = rubric.filter((item) => item.matched).length;
  const requiredSatisfied = rubric.filter((item) => item.required).every((item) => item.matched);
  const choiceCorrect = Boolean(choice?.correct);
  const passed = choiceCorrect && validLength && requiredSatisfied && matchedCriteria >= 3;
  const score = Math.round(
    (choiceCorrect ? 20 : 0) +
      (validLength ? 15 : 0) +
      rubric.reduce((sum, item) => sum + item.points, 0),
  );
  const missing = rubric.filter((item) => !item.matched).map((item) => item.label);
  return {
    missionId,
    score,
    passed,
    choiceCorrect,
    charCount: count,
    minimumChars: MIN_CHARS,
    maximumChars: MAX_CHARS,
    matchedCriteria,
    requiredSatisfied,
    rubric,
    feedback: choice?.feedback || '请先选一个方案。',
    nextAction: passed
      ? '可以继续下一任务，也可以修改后重交。请再核对金额、来源和原因是否一致。'
      : [
          !choiceCorrect ? '当前方案与任务材料不符，请对照反馈重新选择。' : '',
          !validLength
            ? `当前有效字数为 ${count}，请写到 ${MIN_CHARS}–${MAX_CHARS} 字；总长度不能超过 ${MAX_CHARS} 字符。`
            : '',
          !requiredSatisfied || matchedCriteria < 3
            ? `本次未识别的内容：${missing.join('、')}。可对照公开词组补充表述。`
            : '',
        ]
          .filter(Boolean)
          .join(' '),
  };
}

function blankProgress(): InternshipProgress {
  return {
    version: 1,
    activeMission: 1,
    unlockedMission: 1,
    entries: {},
    updatedAt: new Date().toISOString(),
  };
}
let cachedProgress: InternshipProgress | undefined;
let persistAvailable = true;

function isSubmission(value: unknown): value is SavedSubmission {
  if (!value || typeof value !== 'object') return false;
  const item = value as SavedSubmission;
  return (
    typeof item.choiceId === 'string' &&
    typeof item.text === 'string' &&
    item.text.length <= MAX_CHARS &&
    typeof item.submittedAt === 'string'
  );
}
function readProgress(): InternshipProgress {
  if (cachedProgress) return cachedProgress;
  const result = blankProgress();
  try {
    const raw = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || 'null',
    ) as Partial<InternshipProgress> | null;
    if (
      raw?.version === 1 &&
      raw.entries &&
      typeof raw.entries === 'object' &&
      !Array.isArray(raw.entries)
    ) {
      for (const mission of missions) {
        const entry = raw.entries[mission.id];
        if (!entry || typeof entry !== 'object') continue;
        const safe: MissionEntry = {
          choiceId: mission.choices.some((item) => item.id === entry.choiceId)
            ? entry.choiceId
            : '',
          draft: typeof entry.draft === 'string' ? entry.draft.slice(0, MAX_CHARS) : '',
          attempts: Number.isFinite(entry.attempts)
            ? Math.max(0, Math.min(9999, Math.floor(entry.attempts)))
            : 0,
        };
        if (
          isSubmission(entry.lastSubmission) &&
          mission.choices.some((item) => item.id === entry.lastSubmission!.choiceId)
        )
          safe.lastSubmission = entry.lastSubmission;
        if (
          isSubmission(entry.accepted) &&
          gradeSubmission(mission.id, entry.accepted.choiceId, entry.accepted.text).passed
        )
          safe.accepted = entry.accepted;
        result.entries[mission.id] = safe;
      }
      // Recompute progression from accepted evidence, rather than trusting a stored score.
      for (const mission of missions) {
        if (result.entries[mission.id]?.accepted && mission.number <= result.unlockedMission)
          result.unlockedMission = Math.min(missions.length, mission.number + 1);
        else break;
      }
      result.activeMission = Number.isInteger(raw.activeMission)
        ? Math.max(1, Math.min(result.unlockedMission, raw.activeMission!))
        : 1;
      result.updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : result.updatedAt;
    }
  } catch {
    persistAvailable = false;
  }
  cachedProgress = result;
  return result;
}
function persist(progress: InternshipProgress) {
  progress.updatedAt = new Date().toISOString();
  cachedProgress = progress;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    persistAvailable = true;
  } catch {
    persistAvailable = false;
  }
}
export function getInternshipProgress(): InternshipProgress {
  return JSON.parse(JSON.stringify(readProgress())) as InternshipProgress;
}
function getEntry(progress: InternshipProgress, mission: InternshipMission): MissionEntry {
  return (progress.entries[mission.id] ||= { choiceId: '', draft: '', attempts: 0 });
}

function feedbackHtml(mission: InternshipMission, entry: MissionEntry): string {
  if (!entry.lastSubmission) {
    return `<aside class="internship-check">
      <h3 class="internship-check-title">提交后查看基础检查</h3>
      <p class="internship-check-note">先选一个方案，再写 ${MIN_CHARS}–${MAX_CHARS} 字的交付说明。可修改后重新提交。</p>
    </aside>`;
  }

  const grade = gradeSubmission(
    mission.id,
    entry.lastSubmission.choiceId,
    entry.lastSubmission.text,
  );
  const criteria = grade.rubric
    .map(
      (item) => `<div class="internship-check-item">
    <span class="pill ${item.matched ? 'green' : 'amber'}">${item.matched ? '词组已匹配' : '词组未匹配'}</span>
    <strong class="internship-check-item-title">${esc(item.label)}${item.required ? ' · 必要项' : ''}</strong>
    <p class="internship-check-hint">${esc(item.hint)}</p>
  </div>`,
    )
    .join('');

  return `<section class="internship-check" aria-live="polite">
    <div class="internship-check-header">
      <h3 class="internship-check-title">本次提交的基础检查</h3>
      <span class="pill internship-check-result ${grade.passed ? 'green' : 'amber'}">${grade.passed ? '通过' : '待补充'} · ${grade.score}/100</span>
    </div>
    <p class="internship-check-note">方案：${grade.choiceCorrect ? '符合当前任务' : '需要调整'} · 有效字数：${grade.charCount} · 内容词组：${grade.matchedCriteria}/${grade.rubric.length}</p>
    <p class="internship-check-feedback">${esc(grade.feedback)}</p>
    <div class="internship-check-grid">${criteria}</div>
    <p class="internship-check-next">${esc(grade.nextAction)}</p>
    <small class="internship-check-note">分数按下方规则计算，不是 AI 评分。词组命中只说明材料有覆盖，事实与逻辑仍需自行复核。</small>
  </section>`;
}

function missionSteps(progress: InternshipProgress): string {
  return `<nav class="internship-steps" aria-label="模拟任务进度">${missions
    .map((mission) => {
      const locked = mission.number > progress.unlockedMission;
      const accepted = Boolean(progress.entries[mission.id]?.accepted);
      const current = mission.number === progress.activeMission;
      const state = [
        current ? 'is-active' : '',
        accepted ? 'is-complete' : '',
        locked ? 'is-locked' : '',
      ]
        .filter(Boolean)
        .join(' ');

      return `<button type="button" class="internship-step ${state}" data-internship-mission="${mission.number}" ${locked ? 'disabled' : ''} ${current ? 'aria-current="step"' : ''}>
      <span class="internship-step-number">${String(mission.number).padStart(2, '0')}</span>
      <strong class="internship-step-label">${esc(mission.stage)}</strong>
      <span class="internship-step-status">${accepted ? '已完成，可重写' : locked ? '完成前一任务后解锁' : '可开始'}</span>
    </button>`;
    })
    .join('')}</nav>`;
}

function missionMaterials(mission: InternshipMission): string {
  const facts = mission.facts
    .map(
      (fact, index) => `<li class="internship-material">
    <span class="internship-material-number">${index + 1}</span>
    <span>${esc(fact)}</span>
  </li>`,
    )
    .join('');

  return `<div class="internship-materials">
    <h3>任务材料</h3>
    <ol class="internship-material-list">${facts}</ol>
  </div>
  <a class="internship-source" href="${esc(mission.sourceUrl)}" target="_blank" rel="noopener noreferrer">参考：${esc(mission.sourceLabel)} ↗</a>`;
}

function missionRules(mission: InternshipMission): string {
  const criteria = mission.criteria
    .map(
      (item) => `<div class="internship-rule-item">
    <strong>${esc(item.label)}${item.required ? '（必要项）' : ''}</strong>
    <p class="internship-rule-terms">${item.groups.map((group) => `［${group.map(esc).join(' / ')}］`).join(' + ')}</p>
    <p class="internship-rule-hint">${esc(item.hint)}</p>
  </div>`,
    )
    .join('');

  return `<details class="internship-rules">
    <summary>查看基础检查规则</summary>
    <p class="internship-rule-intro">选择占 20 分，字数占 15 分，下面四项各占 16.25 分。通过条件：选对方案、写满 ${MIN_CHARS} 字且不超过 ${MAX_CHARS} 字、覆盖所有必要项及至少三项内容。词组每组任选一个，同一项各组均需出现。</p>
    ${criteria}
  </details>`;
}

function missionChoices(mission: InternshipMission, entry: MissionEntry): string {
  return `<fieldset class="internship-choice-list">
    <legend class="sr-only">只选一个主方案</legend>
    ${mission.choices
      .map(
        (
          choice,
          index,
        ) => `<label class="internship-choice ${entry.choiceId === choice.id ? 'is-selected' : ''}">
      <input type="radio" name="internship-choice" value="${choice.id}" ${entry.choiceId === choice.id ? 'checked' : ''} required>
      <span class="internship-choice-copy">
        <strong class="internship-choice-title">${String.fromCharCode(65 + index)}. ${esc(choice.label)}</strong>
        <small class="internship-choice-description">${esc(choice.description)}</small>
      </span>
    </label>`,
      )
      .join('')}
  </fieldset>`;
}

function missionWriting(mission: InternshipMission, entry: MissionEntry): string {
  return `<label class="internship-writing-label" for="internship-delivery">${esc(mission.deliverable)}</label>
    <textarea class="internship-writing-input" id="internship-delivery" name="delivery" rows="11" maxlength="${MAX_CHARS}" required aria-describedby="internship-char-count internship-draft-note" placeholder="${esc(mission.template)}">${esc(entry.draft)}</textarea>
    <div class="internship-writing-actions">
      <small class="internship-counter" id="internship-char-count">${charCount(entry.draft)} 字 / ${MIN_CHARS}–${MAX_CHARS} 字，不计空白</small>
      <button type="submit" class="btn btn-primary">提交并检查</button>
    </div>
    <p class="internship-draft-note" id="internship-draft-note">第 ${entry.attempts + 1} 次提交。写明选择理由、证据和下一步，空模板不能解锁下一任务。</p>`;
}

function missionNavigation(progress: InternshipProgress, completed: number): string {
  const current = progress.activeMission;
  const next =
    current === missions.length
      ? `<span class="internship-step-status">${completed === missions.length ? '六份交付已完成，可导出复盘' : '完成本次评审后导出学习日志'}</span>`
      : `<button class="btn btn-primary" type="button" data-internship-action="next" ${current >= progress.unlockedMission ? 'disabled' : ''}>下一任务</button>`;

  return `<div class="internship-navigation">
    <button class="btn btn-secondary" type="button" data-internship-action="previous" ${current === 1 ? 'disabled' : ''}>上一任务</button>
    ${next}
  </div>`;
}

function panelHtml(progress: InternshipProgress): string {
  const mission = missions[progress.activeMission - 1];
  const entry = getEntry(progress, mission);
  const completed = missions.filter((item) => progress.entries[item.id]?.accepted).length;
  const savedNote = persistAvailable
    ? '草稿和进度保存在当前浏览器。'
    : '当前无法保存进度，请导出一份备份。';

  return `<div class="internship-intro">
      <div class="internship-intro-copy">
        <h2>线上实习模拟 · 独立学习项目</h2>
        <p>围绕腾讯支付商户场景，依次完成需求、数据、方案和上线评审。材料使用合成样本，业务规则可查原文。</p>
      </div>
      <span class="internship-count">已完成 ${completed} / ${missions.length}</span>
    </div>
    <div class="internship-toolbar">
      <p class="internship-storage-note" id="internship-save-status" role="status">${savedNote}</p>
      <div class="internship-actions">
        <button type="button" class="btn btn-secondary btn-small" data-tab="workbench">去工作台核对材料</button>
        <button type="button" class="btn btn-secondary btn-small" data-internship-action="export-md">导出 Markdown</button>
        <button type="button" class="btn btn-secondary btn-small" data-internship-action="export-json">导出 JSON</button>
      </div>
    </div>
    ${missionSteps(progress)}
    <div class="internship-grid">
      <section class="panel internship-brief">
        <p class="internship-meta">任务 ${mission.number} / ${missions.length} · ${esc(mission.role)}</p>
        <h2 class="internship-title">${esc(mission.title)}</h2>
        <p class="internship-description">${esc(mission.brief)}</p>
        ${missionMaterials(mission)}
        ${missionRules(mission)}
      </section>
      <section class="panel internship-delivery">
        <p class="internship-meta">交付：${esc(mission.deliverable)}</p>
        <h3 class="internship-question">${esc(mission.decision)}</h3>
        <form id="internship-form">
          ${missionChoices(mission, entry)}
          ${missionWriting(mission, entry)}
        </form>
        ${feedbackHtml(mission, entry)}
        <details class="internship-reflection">
          <summary>任务复盘</summary>
          <p class="internship-reflection-copy">${esc(mission.debrief)}</p>
        </details>
        ${missionNavigation(progress, completed)}
      </section>
    </div>`;
}

export function renderInternship(): string {
  return `<section id="internship-root" aria-label="金融科技 AI 产品线上实习模拟">${panelHtml(readProgress())}</section>`;
}

function exportLog(progress: InternshipProgress, format: 'json' | 'md') {
  const entries = missions.map((mission) => {
    const entry = progress.entries[mission.id];
    const submission = entry?.lastSubmission;
    return {
      missionId: mission.id,
      number: mission.number,
      title: mission.title,
      deliverable: mission.deliverable,
      sourceUrl: mission.sourceUrl,
      attempts: entry?.attempts || 0,
      completed: Boolean(entry?.accepted),
      draft: entry?.draft || '',
      lastSubmission: submission || null,
      lastRuleGrade: submission
        ? gradeSubmission(mission.id, submission.choiceId, submission.text)
        : null,
      acceptedSubmission: entry?.accepted || null,
    };
  });
  const payload = {
    title: 'MerchantLens · 金融科技 AI 产品线上实习模拟',
    classification: '独立学习项目；不是腾讯雇佣实习、官方认证或招聘测评',
    exportedAt: new Date().toISOString(),
    dataScope: { ...defaultScope },
    evaluationMethod: '选择、字数与内容词组检查；不调用 AI 评分',
    entries,
  };
  const content =
    format === 'json'
      ? JSON.stringify(payload, null, 2)
      : [
          `# ${payload.title}`,
          payload.classification,
          `导出时间：${payload.exportedAt}`,
          `范围：${defaultScope.merchantId} / ${defaultScope.billDate} · 合成样本`,
          `验收方法：${payload.evaluationMethod}`,
          ...entries.map((entry) => {
            const mission = missions[entry.number - 1];
            const selected = mission.choices.find(
              (choice) => choice.id === entry.lastSubmission?.choiceId,
            );
            return [
              `## ${entry.number}. ${entry.title}`,
              `交付：${entry.deliverable}`,
              `官方参考：${entry.sourceUrl}`,
              `基础完成：${entry.completed ? '是' : '否'}；提交次数：${entry.attempts}`,
              selected ? `最近主方案：${selected.label}` : '尚未提交主方案',
              `### 最近交付\n${entry.lastSubmission?.text || '尚未提交'}`,
              entry.lastRuleGrade
                ? `### 基础检查\n${entry.lastRuleGrade.score}/100；${entry.lastRuleGrade.passed ? '通过' : '待补充'}\n${entry.lastRuleGrade.rubric.map((item) => `- ${item.matched ? '词组已匹配' : '词组未匹配'}：${item.label}${item.required ? '（必要项）' : ''}`).join('\n')}\n${entry.lastRuleGrade.nextAction}`
                : '',
              `### 当前草稿\n${entry.draft || '无草稿'}`,
              `### 工作复盘\n${mission.debrief}`,
            ]
              .filter(Boolean)
              .join('\n\n');
          }),
        ].join('\n\n');
  const url = URL.createObjectURL(
    new Blob([content], {
      type: format === 'json' ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8',
    }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `MerchantLens_实习模拟学习日志_${new Date().toISOString().slice(0, 10)}.${format}`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function bindInternship(
  root: HTMLElement,
  onAudit?: (action: string, detail: string) => void,
): void {
  const host =
    root.id === 'internship-root' ? root : root.querySelector<HTMLElement>('#internship-root');
  if (!host) return;
  const rerender = (focusHeading = false) => {
    host.innerHTML = panelHtml(readProgress());
    if (focusHeading) {
      const heading = host.querySelector<HTMLElement>('h2');
      heading?.setAttribute('tabindex', '-1');
      heading?.focus({ preventScroll: true });
      host.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  };
  const updateSavedNote = () => {
    const note = host.querySelector<HTMLElement>('#internship-save-status');
    if (note)
      note.textContent = persistAvailable ? '草稿已保存。' : '当前无法保存，请导出一份备份。';
  };
  host.oninput = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLTextAreaElement) || target.id !== 'internship-delivery') return;
    const progress = readProgress();
    const mission = missions[progress.activeMission - 1];
    getEntry(progress, mission).draft = target.value.slice(0, MAX_CHARS);
    persist(progress);
    const counter = host.querySelector('#internship-char-count');
    if (counter)
      counter.textContent = `${charCount(target.value)} 字 / ${MIN_CHARS}–${MAX_CHARS} 字，不计空白`;
    updateSavedNote();
  };
  host.onchange = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.name !== 'internship-choice') return;
    const progress = readProgress();
    const mission = missions[progress.activeMission - 1];
    if (!mission.choices.some((choice) => choice.id === target.value)) return;
    getEntry(progress, mission).choiceId = target.value;
    persist(progress);
    rerender();
    host.querySelector<HTMLInputElement>(`input[value="${target.value}"]`)?.focus();
  };
  host.onsubmit = (event) => {
    if (!(event.target instanceof HTMLFormElement) || event.target.id !== 'internship-form') return;
    event.preventDefault();
    const progress = readProgress();
    const mission = missions[progress.activeMission - 1];
    const entry = getEntry(progress, mission);
    const textarea = host.querySelector<HTMLTextAreaElement>('#internship-delivery');
    entry.draft = textarea?.value.slice(0, MAX_CHARS) || entry.draft;
    const selected = host.querySelector<HTMLInputElement>(
      'input[name="internship-choice"]:checked',
    );
    entry.choiceId = selected?.value || '';
    const submission: SavedSubmission = {
      choiceId: entry.choiceId,
      text: entry.draft.trim(),
      submittedAt: new Date().toISOString(),
    };
    const grade = gradeSubmission(mission.id, submission.choiceId, submission.text);
    entry.lastSubmission = submission;
    entry.attempts += 1;
    if (grade.passed) {
      entry.accepted = submission;
      progress.unlockedMission = Math.max(
        progress.unlockedMission,
        Math.min(missions.length, mission.number + 1),
      );
    }
    persist(progress);
    onAudit?.(
      '实习模拟基础检查',
      `任务${mission.number}：${mission.title}；基础检查${grade.score}/100；${grade.passed ? '通过' : '待补充'}。`,
    );
    rerender();
    host
      .querySelector<HTMLElement>('[aria-live="polite"]')
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  host.onclick = (event) => {
    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-internship-action], [data-internship-mission]')
        : null;
    if (
      !target ||
      !host.contains(target) ||
      (target instanceof HTMLButtonElement && target.disabled)
    )
      return;
    const progress = readProgress();
    if (target.dataset.internshipMission) {
      const next = Number(target.dataset.internshipMission);
      if (Number.isInteger(next) && next >= 1 && next <= progress.unlockedMission) {
        progress.activeMission = next;
        persist(progress);
        rerender(true);
      }
      return;
    }
    const action = target.dataset.internshipAction;
    if (action === 'next' && progress.activeMission < progress.unlockedMission) {
      progress.activeMission += 1;
      persist(progress);
      rerender(true);
    } else if (action === 'previous' && progress.activeMission > 1) {
      progress.activeMission -= 1;
      persist(progress);
      rerender(true);
    } else if (action === 'export-md' || action === 'export-json') {
      exportLog(progress, action === 'export-json' ? 'json' : 'md');
      onAudit?.('导出实习模拟学习日志', '导出六项练习的草稿、交付和基础检查。');
    }
  };
}
