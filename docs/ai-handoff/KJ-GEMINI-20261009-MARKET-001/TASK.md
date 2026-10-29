# KJ-GEMINI-20261009-MARKET-001: 市场分析面板数据正确性修正

状态：`queued`，尚未领取。执行角色：Gemini；独立验收：Codex。

## 领取条件与目标

1. 先读仓库根目录 `AGENTS.md`、`ARCHITECTURE.md`、`RUNBOOK.md`、`BUSINESS_RULES.md`、`docs/ai-handoff/README.md` 和当前 `CURRENT_TASK.json`。
2. 当前指针仍是 `KUAIJING-IA-REFACTOR-V1-07A-4C3B`，状态 `review_ready`。不得覆盖或冒领。只有 Codex 验收、归档该任务并将本任务设为当前 `ready` 后，才能把本任务标为 `running` 并修改生产代码。可提前只读理解本任务，但不能写结果冒充已执行。
3. 目标是修正三个已复核问题：嵌入调研的共享存储副作用、价格带的加权口径误标、历史候选同名回填错配；再校正交接书中与实现不符的描述。只做本地修正，不部署、不发布、不写生产数据。
4. 交接书 `C:\Users\Administrator\.gemini\antigravity\brain\a42cab7e-4b01-4329-a9cf-81e7795cffa4\MARKET-ANALYSIS-PANEL-UPGRADE-HANDOVER-20261009.md` 仅是待核对的主张，不是代码事实，也不是授权范围。

## 执行前冻结

- 记录实际 HEAD、分支、`git status --short`，以及所有目标文件的 SHA-256 和执行前差异。基线审查时 HEAD 为 `de0cecf107e670e1c0d9cf393c50b92ab85afdee`，但执行时必须重查；不要求工作树干净。
- 目标文件已有未提交改动；逐文件保存执行前副本或可重建的 patch。不得 `reset --hard`、清理未跟踪文件、还原他人的改动，也不得把已有改动归为本任务成果。
- 先给出简短只读分析：实际数据流、拟改文件、预期行为、兼容风险。若目标文件同时被其他任务改动，先写 `blocked` 说明冲突，不抢写。
- 不读取或输出凭据、Cookie、真实业务明细；测试使用合成数据。不写 `市场分析/`、`选品/`、根目录业务 xlsx/pdf、`ozon-react/public/data/` 或生产服务器。

## 工作包 A：嵌入调研隔离

事实基线：`ozon-react/src/components/MarketResearch.jsx` 仅对 `mr-active-file` 加了 `embedded` 守卫。加载服务端文件时 `processAndSave(..., file.source === 'server')` 仍可能 `dbPut`；嵌入模式仍暴露上传，上传可写共享 IndexedDB 和 `market-research` 服务端命名空间。

实施合同：

- `embedded=true` 只读展示已有报表。加载现有文件不得写共享 IndexedDB、服务端或 `mr-active-file`，也不得触发删除。不要在嵌入页展示可误触的上传/删除动作；需要导入时明确引导到独立 `n2` 页面。
- `embedded=false` 的原有上传、服务端保存/备份、加载、删除和最近文件行为保持不变。不得为隔离嵌入页而削弱独立页面的数据持久化。
- 同名服务端文件加载、抽屉 A/B 连续切换、关闭再打开、独立页面同时打开等场景应验证不污染全局活动文件与共享缓存。
- 用可运行的组件或浏览器交互测试验证 `dbPut` / `uploadServerFile` / `deleteServerFile` 调用次数；单纯检索源码字符串不算完成。

## 工作包 B：价格带口径纠正

事实基线：`ozon-react/src/utils/marketAnalysis/priceBands.js` 当前按 SKU 条数分桶，并以排序后位置计算 `medianPrice`。销量和销售额仅用于聚合占比；没有销量加权 P10/P25/P50/P75/P90。不能把现有结果称为“销量加权中位数”。

最小实现合同：

- 保留现有 `bands`、`skuShare`、`qtyShare`、`salesShare`、`topQtyBandIndex` 的结构与既有用途，避免无授权改变历史报告语义。现有分桶明确标注为“按 SKU 数分段”；现有 `medianPrice` 明确标注为“SKU 价格中位值”，不得再称加权中位数。
- 在返回值中新增独立的**销量加权价格分位**摘要，使用 `_purity.normalizedPrice` 为价格、有效正数 `_purity.qty` 为权重。按价格升序，分位点取累计权重首次达到目标比例时的价格；明确给出 P10/P25/P50/P75/P90。无有效正数权重时返回“数据不足”状态，不把普通 SKU 中位数冒充加权值。
- 保持 A 或 A+B 的现有进入规则，C、UNKNOWN 和无可比价格不参与分位；无效、负数或非有限销量不得进入权重。若 `_purity.qty` 在实际数据中并非月销量，先查来源并在 `RESULT.md` 标注真实口径，不擅自改称月销量。
- UI 区分“SKU 分段”“销量占比”“销售额占比”“销量加权分位”。不要将销售额权重与销量权重混用，也不要把没有 GMV 字段的数据写成 GMV%。
- 添加可运行反例：10 元销量 1000、100 元销量 1 的 P50 必为 10；同价、零销量、非法数量、无价格、A+B 切换、C/UNKNOWN 排除、多件装归一化结果各有覆盖。

## 工作包 C：候选身份与历史回填

事实基线：`ozon-react/src/utils/marketIntelligence/miStore.js` 的旧候选查重在 `source_niche_uid` 缺失时可仅凭 `wb-niche-${niche.name}` 复用，然后同步新 UID 与市场证据。不同类目的同名利基会被错误关联。

实施合同：

- 新利基有真实 UID 时，优先按 UID 查找；任何旧候选复用都必须核对可用的来源、类目及已有身份字段。仅名称相同不足以自动回填。身份信息不足或互相矛盾时，保留旧候选及其项目/快照指针原样，创建 UID 对应的新候选，或明确阻断并要求人工确认；不得悄悄把新证据写进旧候选。
- 新利基缺失真实 UID 时不得再通过名称键自动创建或回填候选；给调用方可见的失败/待补 UID 结果。已有无 UID 历史候选可读，不作批量迁移或隐式补写。
- 同 UID 的重复推流仍幂等；合法历史回填必须保留原 `candidate.id`、`sourceProductId`、项目与快照引用，不覆盖业务状态、负责人和手工备注。
- 用真实 Store 行为或隔离存储测试覆盖：同名不同类目、同名同类但身份不充分、同 UID 重复推流、旧项目引用保留、无 UID 阻断、合法回填。禁止只做源码字符串断言。
- `t6Store.js` 与当前 07A-4C3B 有交叉：默认不修改它。如确需修改，先在 `RESULT.md` 明确原因并交 Codex 裁决；不得与未验收的 4C3B 变更混合提交。

## 工作包 D：文档与业务门禁口径

- 在本任务目录写 `DOCUMENTATION_CORRECTIONS.md`，逐条对照原交接书：`OpportunityPurityGateway` 当前只是导航入口；市场验证快照实际使用 `t6.snapshot.*`，没有 SHA-256；当前 UI 是一次操作中建快照并立项；Gate 检查结构完整与一致，不等于商业上推荐立项。不得把未实现能力写成已交付。
- 对“REJECT/HOLD 但证据齐全”的候选，提出单独的商业放行/人工理由方案供 Codex 决策。本任务**不**擅自更改 `candidateProjectEvidence.js` 的 Gate 阈值、合规判断或项目阶段逻辑。
- 测试报告写执行时真实数量与退出码，不重复累计多套测试，也不沿用旧交接书的 `94/94` 等计数。
- 原交接书位于 Gemini 私有 brain 目录，若需要修改它，先保留原件并明确版本差异；仓库内的纠错文档才作为本轮可审查交付物。

## 允许文件与禁止范围

预计允许修改：`ozon-react/src/components/MarketResearch.jsx`、`ozon-react/src/utils/marketAnalysis/priceBands.js`、`ozon-react/src/components/PurityPipelinePage.jsx`、`ozon-react/src/utils/marketIntelligence/miStore.js`、必要的纯适配器、相应测试、以及本任务目录。实际变更前按最小必要性核对；若需其他文件，先在结果中说明并等待 Codex 授权。

不得修改：核算公式/费率引擎、合规模块、历史 Candidate/Project 业务数据、WordPress/FTP/服务器、部署工作流、依赖版本、全站导航与无关 UI。不得执行生产上传、发布、迁移或 Git push。

## 验证与验收

至少真实执行并在 `tests.json` 逐项记录退出码：新增的三组行为测试、`npm run test:market`、`npm run test:t6`、`npm test`、`npm run test:golden`、`npm run test:sync`。若涉及 UI，提供桌面与窄屏交互证据，并检查数据量较大时没有明显空白或阻塞；构建可运行 `npm run build --prefix ozon-react`，但本地构建不等于部署。

本任务达到 `review_ready` 的条件：三个反例有运行时证据、原独立页面行为回归通过、文档纠错清单完整、变更范围可审、所有强制测试真实通过或明确阻塞。任何数据错配/覆盖反例未解决都不得报完成。

交付：`RESULT.md`、`tests.json`、`DOCUMENTATION_CORRECTIONS.md`、`evidence/` 中的基线/增量 diff/精简测试日志与回滚说明。说明执行前已有改动与本轮增量；不提交包含其他任务变更的混合 commit。完成时仅置 `review_ready`，等待 Codex 独立验收。部署状态保持 `not_deployed`，公开验证状态保持 `not_performed`。

## 回滚

每个工作包保留执行前副本及本轮增量差异。回滚只撤销本任务实际新增的变更，不删除执行前已存在的改动、测试、文档或业务数据。若无法分离增量，停止自动回滚并交 Codex 处理。
