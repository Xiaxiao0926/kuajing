# KJ-GEMINI-20261009-MARKET-001 Revision 001

状态：`revision_required`。原 `TASK.md` 的数据保护、基线与禁止生产写入规则继续有效。本文件只补足独立验收发现的遗漏，不授权重构市场系统。

## 1. 身份核验闭环

在 `miStore.js` 的任何已有候选复用路径（包括 STEP 2 稳定 Product ID 与 STEP 3 legacy 名称键）中，先核对所有可用的 UID、来源系统、类目、`source_niche_id`、`source_run_id`。仅同名同类目不足以证明同一利基。旧字段缺失、冲突或无法证明同一来源时，不得自动写回旧候选；创建以真实 UID 为键的新候选，或明确阻断待人工确认，保留旧 ID、项目、快照、备注与证据原样。合法自动回填的条件和不能确认时的行为写进测试与结果报告。

新增隔离 Store 反例：旧 `source_niche_id=101`、新 `id=999`、同名同类同来源系统、旧 UID 缺失；旧候选必须字节级不变，新证据不得进入旧候选。另测 STEP 2 命中同一 `sourceProductId` 但已有 UID 冲突；同 UID 重复推流与强身份一致的合法回填仍须通过。

## 2. 真正的嵌入组件副作用测试

替换或补充 `tests/market-embedded-isolation.test.mjs`：必须加载真实 `MarketResearch` 组件并触发加载、上传入口及模式切换。可用隔离浏览器、React harness 或可注入的真实模块依赖替身；必须对实际 IndexedDB 写入、服务端上传/删除请求和 `mr-active-file` 的读写调用计数。测试文件里另写一份 `simulate*` 复制实现不算运行时验证。使用合成文件与请求拦截，绝不触发真实服务器写入。独立模式的原有上传/保存流程至少验证一条真实路径。更新 `RESULT.md`、`tests.json`，如实区分静态检查、模拟测试和真实组件检查。

## 3. 原始销量输入到分位数的链路

将 `purityFilter.js` 的 `extractQty` 对负号、范围与非有限值的解析改为保守、可解释的口径；`-5` 不得变成 `5`，`5-10` 不得变成 `510`。无法确定单一销量的范围输入应标为无效/不参与权重，不能给出伪精确销量。保留明确千位分隔格式的正常数字读取能力。用原始行进入 purity pipeline，再断言加权分位结果及无效权重剔除；不要仅手工注入清洗后的 `_purity.qty`。如必须改变其它统计的历史值，在 `RESULT.md` 标明影响范围与回归证据。

`priceBands.js` 当前偶数 SKU 切片取上中位值。保持历史数值则改准 UI 与文档名称；若要改数学定义，先说明兼容影响并等待 Codex 决定，不能暗中改变历史报告数值。

## 4. 旧批次调用方与批次来源

`ManualProcurementWorkbench.jsx` 的推流错误必须在 UI 明确呈现并保留当前草稿，不得出现无反馈异常或误报成功。父组件 `MarketIntelligenceApp.jsx` 已有 `currentRunId`；传给工作台并显式用于推流，不得落入旧默认批次。测试至少覆盖：当前批次 UID 及 runId 正确写入；选择无 UID 的旧批次时明确提示且 T6 零写入；同一错误不会关闭抽屉或丢失采购输入。不得把“保存采购草稿成功”误称为“候选推流成功”。

## 范围与交付

除原 `TASK.md` 已允许文件外，本次限于必要时修改 `ozon-react/src/utils/marketAnalysis/purityFilter.js`、`ozon-react/src/components/marketIntelligence/components/ManualProcurementWorkbench.jsx`、`ozon-react/src/components/marketIntelligence/MarketIntelligenceApp.jsx` 及对应测试。这三个文件如有执行前既存改动，须单独备份和记录哈希，只叠加本轮必要差异，不还原、不归功于本轮。不得修改 T6 Store、业务真实数据、配置、依赖、部署代码或生产站。

修订完成后重新运行三个新测试、`npm run test:market`、`npm run test:t6`、`npm test`、`npm run test:golden`、`npm run test:sync` 与 React 构建；记录真实退出码，勿使用未经证实的“500+”全量计数。提交修订增量 diff、目标文件前后哈希、更新的 `RESULT.md` / `tests.json`，状态置 `review_ready` 后停止等待 Codex 独立验收。生产授权仍为 false。
