# KJ-GEMINI-20261012-MARKET-PLAN-002

状态：`ready`；执行者：Gemini；独立审核：Codex。任务类型：**只读调查与下一阶段策划**。不得改生产代码、测试、业务数据，不部署、不发布、不操作生产。唯一允许写入本任务目录的交付文档及领取/交回时的任务状态指针。

## 业务目标与已冻结事实

系统供 2-3 人内部长期使用。用户有合作工厂提供的品类，需利用俄罗斯 Ozon/WB 市场数据筛选可由中国跨境发货小批量测试的商品。报告应支持人工判断：市场结构、同类竞品、180 天内新品、规格/价格/销量、有效链接、数据覆盖和不确定性，再接到候选、采购报价与核算；不能把样本榜单外推成全市场规模，也不能把数据门禁 PASS 表述成商业或法规批准。

`KJ-GEMINI-20261009-MARKET-001` 的本地实施已由 Codex `accepted`，但 `production_authorized=false`、`deployment_status=not_deployed`、`public_verification_status=not_performed`。不要将本地已验收写成线上已上线。

已有 `marketReportAnalysis.js` 包含 180 天新品、字段覆盖、价格/品牌/卖家分析与样本内探索分；`MarketReportCenter.jsx` 已支持 xlsx/xls/csv/json 导入，并依次上传源文件和报告。先核对实现再提出差异，不得重复策划已存在的能力。

## 领取与事实基线

1. 先读根目录 `AGENTS.md`、`ARCHITECTURE.md`、`BUSINESS_RULES.md`、`RUNBOOK.md`、`TECH_DEBT.md`、`docs/ai-handoff/README.md`、`CURRENT_TASK.json`、上一任务 `REVIEW.md` 与本书。当前指针须是本任务且状态 `ready`；如已由他人领取，停止，不覆盖。
2. 开始前记录 HEAD、分支、目标文件的工作树状态及已接受任务的部署状态。仓库有大量未提交/未跟踪文件，不清理、不恢复、不提交、不将其归功于本轮。
3. 按需阅读 `MarketReportCenter.jsx`、`UploadedMarketReport.jsx`、`MarketDecisionBrief.jsx`、`marketReportAnalysis.js`、`marketReportRussiaContext.js`、`MarketResearch.jsx`、`PurityPipelinePage.jsx`、`marketIntelligence/` 视图与存储、`t6` 候选/快照/门禁、`serverFiles.js`、`persist.js` 及相关测试。路径变化先查实际目录。
4. 不读取或输出密码、Token、Cookie、客户私密明细；不扫描聊天历史。业务原始文件只确认结构和字段是否可用，不复制真实记录到交付物。反例用合成数据。

## 工作包 A：报告可信度与来源链

画出原始文件 -> 解析/清洗 -> 报告 JSON -> 服务端备份 -> 页面读取 -> 候选/快照的实际链路。逐项区分：文件名、内容身份、采样日、导入日、发布时间、来源链接、平台、类目、单位、缺失值、重复 SKU、未来/无效上架日期。确认“180 天新品”采用哪个日期做截点；若日期缺失或报告文件无日期，页面现在如何表示，不得把默认当前日期暗称原始数据快照日。

重点**核验而非预判**：`stableMarketReportId(fileName)` 是否导致同名但新内容/新批次覆盖旧报告；源文件上传成功而报告发布失败的中间状态能否被发现与恢复；批量读取报告 JSON 的网络/渲染成本。给最小复现、用户可见后果、数据保留策略、可逆方案和测试门。本任务不修复。

## 工作包 B：从市场报告到工厂选品

比较报告中心、纯度分析、市场情报验证池、T6 候选及采购/核算的既有字段与身份键。明确哪些建议只是报告文本，哪些已能安全转成候选；不得仅凭同名/同类目自动合并。给出“可人工执行的选品卡”最小字段建议：工厂 SKU 与规格、有效竞品 URL、抓取/快照日期、180 天新品标记及日期覆盖率、样本量与集中度、A/B/C/UNKNOWN 可比性、价格/销量/销售额口径、运费重量与成本版本、预计利润区间、缺证据项、人工结论与理由。字段缺失时显示待补证据，不填伪值。

核对 `HOLD`/`REJECT` 与结构门禁现状。若建议人工商业放行，只能写为候选方案，说明权限不是现有事实、理由与审计如何保留；不修改 Gate、合规判断或核算公式。

## 工作包 C：可用性、备份与上线顺序

按内部使用场景检查导入失败/重试、同一报告跨设备可见、服务器确认与本地缓存、恢复操作、离页未保存草稿、长列表/大报告响应、桌面/窄屏可读性。仅报告有代码证据或可复现证据的问题；无法测量的性能标为待测，不臆测改善百分比。

上一任务未部署是发布门：先验收快照与回滚、测试检查、真实环境备份/恢复和公开页差异，再谈下一轮功能上线。只提出门禁和验证步骤，不执行生产写入、远端账号操作或 Git push。`TECH_DEBT.md` 中的数据公开风险单列为需用户决策的治理项，不擅自删数据、改 Git 历史或推出复杂 SaaS 权限体系。

## 优先级与交付

提出最多 3 个后续实施切片，按数据损坏/误导决策风险、2-3 人实际收益、变更范围、可验证性、可回滚性排序。不要把所有发现捆成一个大改。每片写目标、涉及文件/实体、保留边界、合成反例、验收、回滚、是否需用户授权；区分 P0 发布/数据保护与 P1 决策价值、P2 体验。未经 Codex 审核不得把实施任务置 `ready`。

只在本任务目录生成：`BASELINE.json`（HEAD、分支、关键文件状态及线上边界）、`DATA_FLOW.md`（报告/候选/快照/备份读写与身份）、`FINDINGS.md`（P0/P1/P2，文件行号、证据与影响）、`ROADMAP.md`（最多 3 片及不做项）、`IMPLEMENTATION_CARDS.md`（每片范围/保留/验证/回滚/授权）、`RESULT.md` 和 `tests.json`（真实只读检查与未跑原因）。不能把多个测试重复累计成全量数字。

输入缺失时写具体缺口并置 `blocked`；交付齐全后将本任务 `STATUS.json` 与 `CURRENT_TASK.json` 置 `review_ready`、`claimed_by:null`，停止等待 Codex 独立审核。始终保持 `production_authorized=false`、`deployment_status=not_deployed`、`public_verification_status=not_performed`。
