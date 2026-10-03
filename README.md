# 商证 MerchantLens · v1.1

[在线体验](https://harry-bytefina.github.io/merchantlens/) · [源码](https://github.com/harry-bytefina/merchantlens)

2026-10-04 已通过 GitHub Pages 发布静态演示。

一个面向腾讯 CDG 金融科技岗位的产品实践项目。起点很具体：商户发现 POS 和支付账单对不上时，怎样把差额查清楚，并准备好交给财务或客服的材料？

项目用三个合成商户、两个账单日复现这个流程，另提供六项产品经理练习。默认运行不需要账号或模型密钥。腾讯 TokenHub / 混元接入放在后端，配置后需单独验证真实输出。

## 几个设计选择

- 桌面工具采用腾讯 TDesign 公开的视觉基础与中后台任务方法，来源和实施范围见 `docs/TENCENT_DESIGN.md`。
- 金额用整数分计算，保留原始记录。发现重复订单时先显示差异，不擅自去重改账。
- 查询固定在当前商户和账期，回答能回到具体订单与规则来源。
- 先完成解释和工单草稿；实际退款与改账交给有权限的业务系统。
- 小规则库先用词项检索，保留无需模型的基线，便于衡量模型是否值得加入。
- 练习交付和项目笔记保存在当前浏览器，支持导出。清除站点数据前应先备份。

## 运行

需要 Node.js 20.19+ 或 22.12+（本次使用 Node 24）。

```sh
npm install
npm test
npm run build
npm start
```

打开 `http://127.0.0.1:5180/`。开发模式可用 `npm run dev`（5175）；模型 API 已代理至本机 5180，需要同时运行后端。

## 页面

1. 实习任务台：六项产品练习、方案选择、书面交付与基础内容检查。
2. 商户经营工作台：作用域切换、对账、费用、退款、自然语言提问、订单证据与工单下载。
3. 评测实验室：运行固定场景回放，查看逐条检查和下载报告。
4. 产品设计：设计取舍、指标口径、架构、个人项目笔记和本次修改记录。
5. 证据知识库：官方资料及演示口径，来源可追踪。
6. 审计记录：本地分析、反馈、审核与训练记录。

## 模型接入

查看 `docs/INTEGRATION.md`。密钥只放服务器环境变量，不使用 VITE_ 前缀。默认无密钥时显示证据演示模式；不会伪造模型调用。后端仅绑定本机，真实付费 API 公网版需要另行增加鉴权和额度管理。

## 修改与检查

`src/engine.ts` 负责核算与异常分析，`src/internship.ts` 负责练习与进度，`src/main.ts` 组织页面，`src/styles.css` 管理组件样式。修改金额或退款规则后，先跑 `npm test`，再用页面中的原始账单复算。

```sh
npm run format
npm run format:check
npm test
npm run build
```

格式由 Prettier 和 EditorConfig 统一约定。`scripts/artifacts.mjs` 从实际数据和任务生成评测报告、CSV 与课程文档，生成文件无需手工改。具体变更见 `CHANGELOG.md`。

## 在线作品与部署

正式作品入口为 [商证 MerchantLens](https://harry-bytefina.github.io/merchantlens/)，源码见 [GitHub 仓库](https://github.com/harry-bytefina/merchantlens)。2026-10-04 已通过 GitHub Pages 发布，首个发布记录见 [GitHub Actions](https://github.com/harry-bytefina/merchantlens/actions/runs/37142662688)。`dist/` 是不含密钥的静态站，支持子目录；Node 模型后端没有发布到该站点。

当前访问检查限于本设备及无需身份认证的 HTTP 请求，未验证中国大陆网络、不同设备或长期可用性。真实模型调用、商户接入与业务效果验证仍未完成。`127.0.0.1` 仍只用于本机调试，招聘作品链接应使用上面的 HTTPS 地址。

`docs/` 包含产品概览、PRD、业务地图、课程、评测协议、技术设计、接入说明、面试指南与准确的网申表述。`public/artifacts/` 包含合成 CSV、评测用例和报告、数据指纹、工单样例及评审 PDF。

## 项目贡献与真实状态

徐天予提出腾讯 AI 产品岗作品与沉浸式实习训练目标，提供金融研究背景并参与方向反馈；方案、实现、测试和文档由 AI 协作辅助完成。个人贡献与已完成验证见 `docs/APPLICATION_TEXT.md`，不虚构腾讯雇佣关系、真实客户、访谈、用户增长或线上收益。

本地记录仅保存在浏览器 localStorage；清除站点数据会删除学习进度。演示的商户下拉框不是生产身份鉴权。跨商户、注入与操作边界检测仅服务固定回归集，尚不构成生产安全保障。
