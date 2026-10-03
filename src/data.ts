import type { Merchant, Scope, Trade, PosOrder, Refund, KnowledgeChunk } from './types.js';

// Reproducible synthetic fixtures. These are not exports from a real WeChat Pay account.
export const merchants: Merchant[] = [
  { id: 'demo-qinghe', name: '青禾咖啡', industry: '餐饮 · 3家门店（合成）', feeBps: 60 },
  { id: 'demo-yunji', name: '云集文创', industry: '文创零售（合成）', feeBps: 55 },
  { id: 'demo-xinghu', name: '星湖书店', industry: '图书零售（合成）', feeBps: 50 },
];
export const defaultScope: Scope = { merchantId: 'demo-qinghe', billDate: '2026-09-29' };
export const trades: Trade[] = [];
export const posOrders: PosOrder[] = [];
export const refunds: Refund[] = [];
for (const [m, merchant] of merchants.entries()) {
  for (const [d, date] of ['2026-09-28', '2026-09-29'].entries()) {
    for (let j = 1; j <= 24; j++) {
      const id = `${['QH', 'YJ', 'XH'][m]}-${date.slice(5).replace('-', '')}-${String(j).padStart(3, '0')}`;
      const amount = 1800 + j * 375 + m * 1200 + d * 250;
      trades.push({
        id,
        merchantId: merchant.id,
        date,
        amount,
        fee: Math.round((amount * merchant.feeBps) / 10000) + (d === 1 && j === 8 ? 75 : 0),
        status: 'SUCCESS',
      });
      if (!(d === 1 && j === 11))
        posOrders.push({
          id,
          merchantId: merchant.id,
          date,
          amount: amount + (d === 1 && j === 17 ? 100 : 0),
        });
      if (d === 1 && j === 3) posOrders.push({ id, merchantId: merchant.id, date, amount });
      if (j === 2)
        refunds.push({
          id: `RF-${id}`,
          orderId: id,
          merchantId: merchant.id,
          date,
          amount: 1000,
          status: 'SUCCESS',
        });
      if (d === 1 && j === 6)
        refunds.push({
          id: `RF-${id}`,
          orderId: id,
          merchantId: merchant.id,
          date,
          amount: 1500,
          status: 'PROCESSING',
        });
      if (d === 1 && j === 9)
        refunds.push({
          id: `RF-${id}`,
          orderId: id,
          merchantId: merchant.id,
          date,
          amount: 2200,
          status: 'ABNORMAL',
        });
    }
    if (d === 1)
      posOrders.push({
        id: `${['QH', 'YJ', 'XH'][m]}-0929-099`,
        merchantId: merchant.id,
        date,
        amount: 4500 + m * 500,
      });
  }
}

export const knowledge: KnowledgeChunk[] = [
  {
    id: 'K-BILL',
    title: '交易账单的获取窗口',
    text: '微信支付下载账单开发指引：当日账单需次日上午十点生成后申请；支持前三个月内日期。无交易或退款的日期可能不生成交易账单。演示数据已预置，只支持界面显示的两个日期，未调用微信支付接口。',
    url: 'https://pay.wechatpay.cn/doc/v3/merchant/4013071218',
    authority: 'official',
    updated: '2026-06-09',
    tags: ['账单', '下载', '当天', '今天', '十点', '不存在', '日期'],
  },
  {
    id: 'K-HASH',
    title: '下载文件的完整性校验',
    text: '微信支付指引要求签名请求账单下载链接并比对下载文件的哈希值，以检查完整性。本项目使用规范化合成CSV；生产系统还需按官方签名、验签及哈希流程接入，不能直接把网页下载能力当作已完成微信支付接入。',
    url: 'https://pay.wechatpay.cn/doc/v3/merchant/4013071218',
    authority: 'official',
    updated: '2026-06-09',
    tags: ['哈希', '完整性', '签名', '下载链接', '账单'],
  },
  {
    id: 'K-REFUND',
    title: '退款状态与最终结果',
    text: '退款申请受理不等于退款成功。SUCCESS为退款成功；PROCESSING需查询最终结果；ABNORMAL需核查并人工处理。受理后资金可进入退款中间账户，因此处理中不能被解释为没有扣款。产品只将SUCCESS计入演示净交易指标，不预测银行到账。',
    url: 'https://pay.wechatpay.cn/doc/v3/merchant/4013071031',
    authority: 'official',
    updated: '2026-06-09',
    tags: ['退款', '到账', '处理中', 'PROCESSING', 'SUCCESS', 'ABNORMAL', '成功', '异常'],
  },
  {
    id: 'K-QUERY',
    title: '退款回查与通知',
    text: '官方退款指引支持查询单笔退款与退款结果通知。未收到通知时应以查询结果确认最终状态，而不是仅凭申请受理结果判断。长时间处理中可逐步降低查询频率；本原型不轮询真实订单，仅生成可审核的排查清单。',
    url: 'https://pay.wechatpay.cn/doc/v3/merchant/4013071031',
    authority: 'official',
    updated: '2026-06-09',
    tags: ['退款', '回调', '通知', '查询', '轮询', '处理'],
  },
  {
    id: 'D-SCOPE',
    title: '商户作用域与人工审核约定',
    text: '本项目演示约定：每次分析绑定商户ID和账单日期，不能通过自然语言绕过已选择的商户。切换下拉框仅切换合成样例，不代表生产鉴权。工单只在本机记录审核标记，不发送企业微信，也不执行退款、转账或账户修改。',
    url: './docs/TECHNICAL_DESIGN.md',
    authority: 'demo',
    updated: '2026-10-03',
    tags: ['商户', '权限', '审核', '工单', '隐私', '隔离'],
  },
  {
    id: 'D-FEE',
    title: '演示合同费率与费用校验',
    text: '本项目合成商户的合同费率分别为60、55、50个基点，按每笔金额计算、四舍五入到分。它们仅用于测试，不代表微信支付统一费率。应以商户实际合同与账单为准；退款手续费回退、优惠和结算周期不在当前数据模型内。',
    url: './docs/PRD.md',
    authority: 'demo',
    updated: '2026-10-03',
    tags: ['费率', '手续费', '费用', '基点', '合同', '优惠'],
  },
  {
    id: 'D-NET',
    title: '金额口径与账面净额边界',
    text: '演示账面净额=SUCCESS支付交易总額−SUCCESS退款金额−账单手续费。POS差异=POS订单总額−支付交易总額。所有金额以整数分计算，最终展示为元。净额是归一化分析指标；缺少资金账单、冻结、手续费返还、银行入账与结算周期，不等于实际余额或可提现金额。',
    url: './docs/TECHNICAL_DESIGN.md',
    authority: 'demo',
    updated: '2026-10-03',
    tags: ['净额', '余额', '可提现', '结算', '到账', '对账', '金额', '差异', '计算'],
  },
  {
    id: 'D-MODEL',
    title: '证据引擎与模型接入的分工',
    text: '离线演示使用确定性金额计算、作用域过滤、词项检索和规则解释。腾讯TokenHub/混元适配层已经提供，但需服务器配置模型与API密钥才会真实调用。模型只解释可见证据；不能改写金额计算或执行资金操作。离线评测结果不等同真实模型质量或生产业务收益。',
    url: 'https://cloud.tencent.com/document/product/1823/130079',
    authority: 'demo',
    updated: '2026-10-03',
    tags: ['模型', '混元', 'AI', 'TokenHub', '接入', '评测', '检索', '幻觉'],
  },
];
