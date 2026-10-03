from pathlib import Path
from xml.sax.saxutils import escape
import json
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib.pagesizes import A4

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/artifacts/MerchantLens_产品评审.pdf'
REPORT=json.loads((ROOT/'public/artifacts/evaluation-report.json').read_text())
MANIFEST=json.loads((ROOT/'public/artifacts/fixture-manifest.json').read_text())
R=MANIFEST['scopes'][1]['result']
pdfmetrics.registerFont(TTFont('STSong-Light', '/Library/Fonts/Arial Unicode.ttf'))
INK=colors.HexColor('#14213A'); MUTED=colors.HexColor('#64748B'); INDIGO=colors.HexColor('#4F46E5'); LIGHT=colors.HexColor('#F3F2FF'); LINE=colors.HexColor('#DFE5EF')
styles={
 'eyebrow':ParagraphStyle('eyebrow',fontName='Helvetica',fontSize=9,textColor=INDIGO,leading=12,spaceAfter=7),
 'title':ParagraphStyle('title',fontName='STSong-Light',fontSize=24,textColor=INK,leading=31,spaceAfter=9),
 'intro':ParagraphStyle('intro',fontName='STSong-Light',fontSize=11,textColor=MUTED,leading=17,spaceAfter=12),
 'h2':ParagraphStyle('h2',fontName='STSong-Light',fontSize=12,textColor=INDIGO,leading=17,spaceBefore=11,spaceAfter=7),
 'body':ParagraphStyle('body',fontName='STSong-Light',fontSize=9.5,textColor=INK,leading=15,spaceAfter=7,wordWrap='CJK'),
 'cell':ParagraphStyle('cell',fontName='STSong-Light',fontSize=9,textColor=INK,leading=14,wordWrap='CJK'),
 'small':ParagraphStyle('small',fontName='STSong-Light',fontSize=8,textColor=MUTED,leading=12,spaceAfter=5,wordWrap='CJK'),
}
story=[]
def p(text,style='body'):return Paragraph(text,styles[style])
def add(text,style='body'):story.append(p(text,style))
def heading(n,title,intro):
 add(f'MERCHANTLENS / PRODUCT REVIEW / {n:02d}', 'eyebrow');add(title,'title');add(intro,'intro')
def table(headers,rows,widths):
 data=[[p(escape(c),'cell') for c in headers]]+[[p(c,'cell') for c in row] for row in rows]
 t=Table(data,colWidths=widths,hAlign='LEFT');t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),LIGHT),('VALIGN',(0,0),(-1,-1),'TOP'),('BOX',(0,0),(-1,-1),0.6,LINE),('LINEBELOW',(0,0),(-1,0),0.6,LINE),('LINEBELOW',(0,1),(-1,-2),0.35,LINE),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8)]));story.append(t)
def box(text):
 t=Table([[p(text)]],colWidths=[499]);t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),LIGHT),('BOX',(0,0),(-1,-1),.5,LINE),('LEFTPADDING',(0,0),(-1,-1),12),('TOPPADDING',(0,0),(-1,-1),10),('BOTTOMPADDING',(0,0),(-1,-1),7)]));story.append(t)
def link(title,url):return f'<link href="{escape(url)}" color="#4F46E5">{escape(title)}</link>'
fmt=lambda cents:f'￥{cents/100:,.2f}'

heading(1,'商证 MerchantLens','腾讯 CDG 金融科技方向 | AI 产品实习工作室 | 独立项目 v1.0')
box('产品命题：让商户异常处理从“凭经验解释”转为“范围明确、金额可算、证据可查、人工可审”的闭环。程序提供可体验的业务原型和六项产品经理训练任务。')
add('业务依据与组织边界','h2')
add('CDG 的公开业务覆盖基础支付与金融应用；微信生态提供商户和小程序入口；腾讯云提供模型服务。本项目从金融科技问题出发，选取微信支付公开对账与退款规则作为案例，不推断腾讯内部汇报、权限或流程。')
table(['能力层','本次实现','真实接入边界'],[
 ['商户服务','合成支付账单、POS和退款的对账与异常解释','未连接商户平台、银行或真实支付账户'],
 ['AI 产品','结构化计算 + 词项检索 + 证据解释；混元适配代码','默认无密钥；真实模型质量尚未评测'],
 ['协作流程','工单草稿、审核标记、审计与交付记录','本地记录；企业微信协同属于后续接入'],
 ['实习训练','业务选型、口径、状态、架构、协调、上线决策','公开规则下的模拟任务；规则验收反馈'],
],[83,218,198])
add('为什么选这一个 MVP','h2')
add('优先选择商户对账与异常处理：业务证据具备订单、金额、日期和状态，适合精确验收，也能结合候选人的金融工程与数据分析背景。营销助手需要真实客群和转化实验；理财或授信助手涉及更高的决策风险与资质要求。它们不进入本次 MVP。')
add('价值目标与待验证假设','h2')
add('北极星指标为有效异常闭环率：异常同时满足金额复核、证据充分、权限正确及责任人处理确认，才计为闭环。节省工时、客服沟通和使用意愿均待访谈、影子运行与试点验证，不填写虚构增长数据。')
add('商业敏感性示例：每月1,200例 × 节省3分钟 × 60元/小时 = 3,600元时间价值；假设总成本1,400元，净价值2,200元。若仅节省1分钟则为负。参数为方案假设，非真实收益。','small')
add('公开依据：'+link('腾讯业务组织','https://www.tencent.com/zh-cn/about.html')+'；'+link('微信支付账单规则','https://pay.wechatpay.cn/doc/v3/merchant/4013071218')+'；'+link('TokenHub 调用指南','https://cloud.tencent.com/document/product/1823/130079'),'small')
story.append(PageBreak())

heading(2,'从账单到可审核证据','一个可以手算复核、修改数据后重跑的最小业务闭环')
add('工作流','h2')
box('选定商户与日期 → 读取规范化记录 → 整数分计算 → 按订单关联定位异常 → 检索规则 → 区分事实与假设 → 生成工单 → 人工审核')
add('青禾咖啡 / 2026-09-29 / 合成数据','h2')
table(['核算对象','程序实际结果','口径'],[
 ['支付交易',f'{R["tradeCount"]}笔 / {fmt(R["gross"])}','交易总额；不等于利润'],
 ['POS记录',f'{R["posCount"]}条 / {fmt(R["posGross"])}','保留导入中的重复记录，便于追溯'],
 ['订单差额',fmt(R['difference']),'POS总额 − 支付交易总额'],
 ['已成功退款',fmt(R['refunds']),'只含SUCCESS'],
 ['未确认成功退款',fmt(R['pendingRefunds']),'PROCESSING + ABNORMAL；独立列示'],
 ['账单费用',fmt(R['fee']),'演示合同逐笔取整校验'],
 ['演示账面净额',fmt(R['net']),'支付交易 − SUCCESS退款 − 费用'],
],[104,146,249])
add('差额解释：先定位数据事实','h2')
diffs=[f for f in R['findings'] if f['category'] in ['duplicate','missing-pos','missing-bill','amount']]
add(' + '.join(f'{f["title"]} {fmt(f["amount"])}' for f in diffs)+f' = {fmt(R["difference"])}。费用偏差与退款状态另列，避免与订单差额重复相加。')
add('重复 POS 可能由重复导出导致；支付有单而 POS 无单可能是同步遗漏；POS 有单而当前支付账单无单，还需查渠道和日期。以上均是待核验假设，不将数据未匹配直接表述为平台少结算。')
add('退款与资金口径','h2')
add('申请受理不等于退款成功。PROCESSING 需回查最终结果；ABNORMAL 需人工核验。退款受理时资金可进入中间账户，因此“未计入成功退款”不等于“资金未扣”。缺少资金账单、冻结、退款手续费返还和银行入账，账面净额不能当作余额或可提现额。')
add('来源：'+link('微信支付退款开发指引','https://pay.wechatpay.cn/doc/v3/merchant/4013071031')+'。演示费率60/55/50基点只用于合成合同测试，不代表微信支付统一费率。','small')
story.append(PageBreak())

heading(3,'产品经理的六项实习任务','阅读材料 → 做唯一选择 → 解释未选理由 → 提交交付物 → 查看验收反馈')
table(['任务','工作情境与交付','验收要点'],[
 ['01 / 需求选型','从商户异常解释、泛营销、自动金融决策中选择一个MVP，给出定位与范围。','JTBD、单一方案、证据、未选理由、可验收目标'],
 ['02 / 数据口径','复算指定账单，解释POS差额、费用、成功与未成功退款。','精确金额、差额方向、净额边界、不能等同余额'],
 ['03 / 退款排查','客服反馈退款处理中，缺少通知；设计核验与沟通材料。','最终状态、回查、证据、不能承诺银行到账'],
 ['04 / AI 架构','在通用聊天、纯规则、计算与证据约束语言层间做取舍。','模型分工、检索、数字真值、引用、成本与回退'],
 ['05 / 支付联调','签名、哈希及回调验签未完成，业务追加多币种与自动退款；决定内部演示和真实灰度范围。','支付硬门、需求变更、阶段交付、责任与里程碑'],
 ['06 / 上线决策','总体评测表现良好，但发现一例商户隔离泄漏。决定是否放量。','硬门优先、停止上线、修复复验、影子与灰度'],
],[89,223,187])
add('每个任务都留下可展示的交付物','h2')
add('任务说明与官方规则可查，单选取舍有具体反馈，长文本交付按透明 rubric 检查。进度和草稿保存在当前浏览器，学习日志可导出。验收分数用于结构化自检；规则不能理解文章的全部含义，也不代表腾讯导师评价或招聘结果。')
add('实习推进的真实产出','h2')
box('问题定义 / MVP范围 → 数据口径说明 → 异常排查工单 → AI工作流方案 → 跨职能评审纪要 → 上线与回滚决策。六份交付物组成候选人亲自练习与复验的证据。')
add('个人贡献如何讲清','h2')
add('候选人提出腾讯金融科技 AI 岗作品与沉浸式实习目标，提供背景并参与方向反馈；方案、实现、测试及文档由 AI 协作辅助完成。后续亲自复算、修改、验证、接入和访谈的内容，应记录为真实个人贡献。作品可提交为独立产品实践，不填作腾讯正式实习。')
add('完整材料：项目内 PRODUCT_BRIEF、PRD、BUSINESS_MAP、INTERNSHIP_CURRICULUM、TECHNICAL_DESIGN 与 INTERVIEW_GUIDE。','small')
story.append(PageBreak())

heading(4,'评测、上线与下一轮验证','先把硬门做实，再验证语言质量和商业价值')
table(['评测层','已完成 / 当前状态','不能推出的结论'],[
 ['业务与工程','金额复算、变更重跑、作用域隔离、超时与无效模型引用等测试已运行','工程通过 ≠ 覆盖所有自然语言对抗'],
 ['固定场景回放',f'{REPORT["passed"]}/{REPORT["total"]}条预定义案例通过；逐例检查与指纹可下载','开发回归集 ≠ 真实盲测或生产通过率'],
 ['真实模型','腾讯TokenHub / 混元适配、提示模板、引用校验已实现；无密钥未调用','引用ID合法 ≠ 文本真正由证据支持'],
 ['用户与商业','提供访谈提纲、ROI公式、试点与灰度计划','尚未完成商户试点或工时/收入验证'],
],[88,230,181])
add('上线决策与止损条件','h2')
add('金额错误、跨商户泄漏、未经授权资金动作均为硬门：发现任一实例，停止上线并修复复验。先用脱敏历史账单做影子运行；通过独立模型评测后，向小范围授权人员开放解释辅助。模型服务超时或质量下降时，回退到结构化证据与人工流程。')
add('真实模型评测计划','h2')
add('冻结数据、规则、prompt 和模型版本；分别评估日常问题、权限对抗与证据不足。记录来源支撑率、金额一致性、有效拒答率、人工修订率、P95延迟及每次有效处理成本。必须加入“引用正确但把PROCESSING说成已到账”等反例，不能只验证JSON格式。')
add('部署与作品链接','h2')
add('当前完整本地演示无需账号或密钥。静态构建和源码包可用于GitHub Pages、Vercel或腾讯云托管。用户尚未配置托管账号；127.0.0.1仅供本机，长期HTTPS链接仍待部署。真实付费模型公网入口需要单独鉴权、配额、限流与费用封顶。')
add('证据与可复验记录','h2')
add(f'数据：{REPORT["counts"]["merchants"]}个合成商户 / {REPORT["counts"]["trades"]}条支付 / {REPORT["counts"]["posOrders"]}条POS / {REPORT["counts"]["refunds"]}条退款。可下载CSV、固定评测用例、报告JSON/Markdown、工单及学习记录。')
add('数据SHA256：'+REPORT['fixtureHash'],'small')
add('官方业务依据：'+link('腾讯组织与业务','https://www.tencent.com/zh-cn/about.html')+'；'+link('账单开发指引','https://pay.wechatpay.cn/doc/v3/merchant/4013071218')+'；'+link('退款开发指引','https://pay.wechatpay.cn/doc/v3/merchant/4013071031')+'；'+link('TokenHub 接口','https://cloud.tencent.com/document/product/1823/130079')+'。完整来源矩阵见 SOURCES。','small')

def page_decor(canvas,doc):
 canvas.setStrokeColor(INDIGO);canvas.setLineWidth(2);canvas.line(48,805,547,805)
 canvas.setStrokeColor(LINE);canvas.setLineWidth(.5);canvas.line(48,42,547,42)
 canvas.setFont('STSong-Light',8);canvas.setFillColor(MUTED);canvas.drawString(48,27,'商证 MerchantLens | 独立产品实践与实习模拟 | 2026.10')
 canvas.setFont('Helvetica',8);canvas.drawRightString(547,27,f'{doc.page} / 4')
doc=SimpleDocTemplate(str(OUT),pagesize=A4,rightMargin=48,leftMargin=48,topMargin=53,bottomMargin=54,title='商证 MerchantLens 产品评审',author='徐天予 · AI协作辅助')
doc.build(story,onFirstPage=page_decor,onLaterPages=page_decor)
print(str(OUT))
