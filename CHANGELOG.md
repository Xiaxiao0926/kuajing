# CHANGELOG.md — 变更记录

> 记录原则：每个有意义的变更（功能/修复/重构/文档/数据）必须在此登记。
> 格式：日期 | 类型 | 说明（关联 commit/tag）。类型：feat / fix / refactor / docs / chore / data。

---

## 2026-08-14（整改阶段 V3）

### feat — T6 SKU 项目生命周期：成本场景与平台联动（T6-2B，已合并 main，tag `v3-t6-sku-project-lifecycle`）
- **T6-2A hardening**（`fix(t6-2a)` `2b2758d`，merge `f1ef799`）：路径 Stage Gate 重构——`stageModel.js` 阶段唯一事实源（PIPELINE..REVIEW 9 段，SAMPLING 硬阻断界点）；`gateEngine.js` 路径 Gate（FORWARD 逐段聚合带 stage 归属、SAME/BACKWARD 不执行前向检查、非法 stage fail-close、BLOCKED_LOGISTICS 精确触发一次、RED>YELLOW>NOT_EVALUATED>GREEN）；`stageTransition.js` 流转 domain action（YELLOW/RED 推进必填理由，空理由 throw 且不产生日志）；`setWorkflowNode` 审计（状态变化写 workflow_change，仅备注不写日志，备注可清空/保留）；ProjectDetailPage 路径 Gate UI（分组检查/回退提示/理由输入）+ 备注草稿 onBlur 保存；ProjectListPage 移除列表内生命周期按钮与 window.prompt（收敛到详情页）。Gate 测试 33（I18-I22 新增），Store 测试 56（I17 新增）。
- **T6-2B1**（`feat(t6-2b1)` `ce4949c`，merge `0b78bac`）：CostScenario 不可变实体（`t6.costScenario.<uuid>`，仅 create/read，payload 禁带系统字段，快照归属 fail-close，首个自动基线 + cost_scenario_create/cost_baseline_change 日志）；`costScenarioAdapter.js` Ozon 冻结（prefill 只取 price/weight/dims/commission_rfbs，绝不虚构成本；resolvedConfig 冻结完整渠道配置+source/source_date/verified_by meta；汇率双语义 rubToCny=0.09 / celRubPerCny=12 并存不统一；outputPayload=calcChannelProfit 原文；calculatorVersion 'ozon-rfbs-single-v1'）；OzonCalc projectContext 模式（显式状态、prefill 一次、不写共享持久化键、[保存此方案到项目]）；Gate 成本检查真实化（无场景 FAIL、基线毛利≥15 PASS、<15 WARN，supplier 仍 NOT_EVALUATED）；测试 44（C1-C9）。
- **T6-2B2**（`feat(t6-2b2)` `8271d3f`，merge `797b6c2`）：WB 成本场景（prefill 只 5 项：名称/重量克=weight_kg×1000/尺寸/sellerRevenueRub←price_rub 参考售价；佣金绝不预填即使 commission_rfbs=99；resolvedConfig 冻结完整费率版本快照 tariffId/routeId/routeName/有效期/取整/限制/tiers/反向规则/来源，非仅 routeId；outputPayload=wbEngine 原文 logisticsCalc/profitCalc/reverseCalcResult/breakEvenPriceRub；calculatorVersion 'wb-order-v2' 公式不变）；WBCalc/CalculatorTab projectContext 模式 + [保存此方案到项目]；跨平台方案比较表（scenarioSummary 统一 profitMarginPct，注明"比较值来自各平台现有核算引擎；不跨平台重新计算费用"）；基线仅人工切换（WB 场景仅测算参考）；Gate target_price 平台统一口径（price/sellerRevenueRub）；测试 42（W1-W10）。
- 全程未改 wbEngine/ozonEngine/wb_calc.py 公式、config 费率、评分分布；A1/B191/C448/D169/不可评级191 不变。

### feat — T4 选品评分与决策解释系统（分支 `feat/v3-t4-product-scoring`，待验收合并）
- **T4-0**：1000×63 选品数据审计（`T4-0-选品数据审计报告.md`）；**T4-1A**：BSR 市场基准层（855 类型/19 域聚合，`T4-1A-BSR市场基准层审计报告.md`）；**T4-1B**：机器可执行规格（`T4-1B-评分模型设计冻结.md`）。
- **T4-2**：纯评分引擎（六维 25/15/10/20/15/15 + Gate/Decision 分离 + Supply Gap + 证据感知重归一），41 单测；hardening（NEEDS_DATA→不可评级、coverage 两位精度、缺失子项重归一、两价格公式冻结、物流池排除无效尺寸、merge main）。
- **T4-3**：黄金固件 10×56 断言 + 单调性 7 组×20 + 维度验证矩阵；识别 demand 语义问题（候选强度≠市场规模），`T4-3-黄金案例与模型验证报告.md`。
- **T4-4A**：demand 两层化（λ×市场规模+(1-λ)×候选强度），λ 校准 30/40/50 → **冻结 λ=0.5**（Demand Top20 市场 sales/units 双转正；LMC 771 行逐位不变），`T4-4A-Demand语义校准报告.md`。
- **T4-4B**：评分面板接入（Gate0 fail-close、scoring_rules 进 sync-config/verify_sync 链路、scoringDataAdapter 同源管线、ProductScoringSection 总览/排名/筛选/详情、1953ms→150ms 零行为变化优化、挂载解耦 fix `b731131`），`T4-4B-评分面板接入报告.md`。
- **T4-5**：XLSX/CSV 导出（当前筛选结果，回读验证）、列表简版原因、文档（ARCHITECTURE §6 数据流 / BUSINESS_RULES §12 / RUNBOOK §9）、final hardening（λ≤1、六维权重和=100 校验）。
- 全程未改 WB/CEL 费率与既有引擎；TD-3/8/9/10/11/12/14/16/17/18 未触碰。

### refactor — T3 前端工程结构治理（分支 `refactor/v3-t3-react-structure`，待验收合并）
- **T3-0**：UI/Bundle 行为冻结快照（`T3-0-行为冻结快照.md`）。
- **T3-1**：NewDashboard 6609 行拆为编排层 + `dashboard/dictionary.js`(2141) + `useDashboardStats.js`(1524) + `Cards.jsx` + 5 展示区段；脚本锚点校验 + 逐行比对**零差异**。
- **T3-2**：WBCalc 1692 行拆为编排层 + `wbcalc/tabs/`6 Tab + 5 共享组件；11 个函数体共 1531 行**逐字一致**。
- **T3-3**：FragrancePricing 拆为 `fragrancePricing/data.js`（常量+利润计算+报告生成）/InputField/PlanPanel。
- **T3-4**：App.jsx 五个页面组件 React.lazy + Suspense；主 chunk **2743KB→1122KB（gzip 780→336KB，-59%）**；WBCalc/OzonCalc/FragrancePricing/ListingContent/MarketResearch 独立 chunk。
- 铁律执行：引擎与 config **零改动**；TD-14 双口径保持原样；计算逻辑留在 engine 层；拆分脚本保留在 `scripts/split-*.js` 供审计。
- 验证：npm test 65+31 / golden 76 / sync 零差异 / build / dev server 全绿。

### feat — T2 配置唯一事实源（分支 `feat/v3-t2-config-source`，已合并 main，tag `v3-t2-config-source`）
- **Gate 0**：核验 CEL V5.23 原表，TD-15 定性（HK = 96元/kg + 百克进位，代码数值正确仅标签错），核验报告 `T2-Gate0-CEL-HK核验报告.md`。
- **config 层**：`config/wb_tariffs.json`（10 条费率）、`config/settings.json`（汇率 12 等）、`config/ozon_channels.json`（17 渠道，HK 语义已修正）、`config/schema/`（tariff/channel JSON Schema）。
- **React adapter**：`wbConfig.js`/`ozonEngine.js` 改为从 `src/generated/*.js` 读配置（snake→camel 映射），对外 API 与数值逐位不变；`scripts/sync-config.js` 同步+结构校验；vite buildStart 与 npm test 自动同步。
- **Python 接入**：`wb_data.py` 读写指向 `config/`（`CONFIG_DIR`）；删除 `wb_data/tariffs.json`/`settings.json` 运行态副本（TD-1 结构性解决）；`app.py`→`OZON_DATA_DIR`、`wb_panel.py`→`WB_COMMISSION_FILE`（TD-7 解决）。
- **黄金案例**：`tests/golden/` 5 文件 76 断言（WB 边界 16 项、反向六场景、正常订单利润、多包裹、Ozon 渠道），`run-golden-tests.js` 真实现，provenance 分级（当前全部 spec_derived，待人工确认真实订单升级）。
- **双端对拍**：`verify_sync.js` 真实现，16 边界重量 + 2 版本边界 React vs Python **零差异**。
- **文档同步**：AGENTS §5 三条强制测试去占位化；ARCHITECTURE 配置层/双引擎现状更新；RUNBOOK 费率更新流程改"只改 config"；TECH_DEBT TD-1/2/7/13/15 关闭，新增 TD-16（旧组件死代码）/TD-17（0.001kg 边界）。
- **冻结快照**：`T2-1-行为冻结快照.md`（迁移铁律：任何数字变化=失败；TD-14 双口径保持原样）。
- 验证：`npm test` 65+31 全绿；`npm run test:golden` 76/76；`npm run test:sync` 零差异；vite build 成功。

### docs — T1 文档层（已合并 main，tag `v3-t1-ai-handoff`）
- 新增 `AGENTS.md`：AI 协作宪法（禁止事项、强制测试、范围铁律、Git 纪律、角色分工、复杂任务工作流）。
- 新增 `ARCHITECTURE.md`：4 应用拓扑、数据流、关键文件索引、已知漂移。
- 新增 `BUSINESS_RULES.md`：业务公式唯一权威描述（WB 运费/利润/反向赔偿 + Ozon CEL 渠道），来源标注到规格章节。
- 新增 `RUNBOOK.md`：启动/测试/路径配置/费率更新/备份/故障排查 + AI 角色→模型映射表。
- 新增 `TECH_DEBT.md`：13 项技术债登记（含双端汇率漂移 TD-1）。
- 新增本文件 `CHANGELOG.md`。
- 分支：`docs/v3-t1-ai-handoff`（待验收合并）。

### chore — T0 收尾（已合并 main，tag `v3-t0-baseline`）
- `fix/v3-t0-cleanup` 合并进 main（merge `744bb14`）。
- 回退 `manifest.json` 运行时 timestamp 无关改动（`1cd502b`）。
- `tunnel.js` 提示改为 `npm install --no-save localtunnel`（可选依赖不写入 package.json）。
- Secret 审计结论措辞严谨化（"扫描范围内未发现已知敏感凭据"）。
- 新增 `整改任务书V3.md`（V3.1：审计报告入库、平台无关测试命令、Lead/Fast 去型号化、T2 迁移冻结、golden provenance）。

### fix — T0 整改收尾（`e298f56`）
- Secret 审计报告 `_audit/secret_audit_report.md` 入库（gitignored 仅 raw/tmp）。
- 跨平台测试：`scripts/run-wb-py-test.js`（py -3 → python3 → python 探测）；`package.json` 新增 `test:python`/`test:golden`/`test:sync`。
- `tunnel.js` 缺 localtunnel 时优雅退出 exit 0（不再崩溃）。
- 删除 `cc-switch/` 残留仓库；`public/` 37 个孤儿脚本归档至 `_archive/deprecated/`。
- 旧 PRD/技术文档归位 `ozon_hair_dryer_analysis/`；删除空 `uploads/` 与 `cloudflared.exe`（51MB）。
- 验证：npm test 全绿（React 65 + Python 31）；npm start 冒烟通过；零业务公式改动。

### chore — P1 工程卫生（`d6a197d`）
- 29 个一次性脚本归档至 `_archive/{debug,analysis,deprecated,reports,migration}`，根目录 43→14 文件。
- 新增根 `README.md`（4 应用清单/启动/数据流/目录结构）。
- `config.js` 三层路径优先级（BASE_PATH → data/ → Legacy）+ `LEGACY_PATH_ENABLED` 开关。
- `tunnel.js` 去硬编码路径（该改动引入 localtunnel 依赖缺失问题，已在 T0 修复）。
- 根 `package.json` 接入 `npm test`（当时 Python 部分在本机 python 空壳环境失败，T0 已改为跨平台探测）。

### chore — 全量快照（`7456a6d`）
- 首次全量快照：ozon-react、ozon-product-analyzer、server.js、运费计算文档。
- 测试基线：React wbEngine 65 通过 / Python wb_test 31 通过。
- 数据资产入库：WB 佣金表（96 类目/7424 条）、CEL 费率表、0726 费率 PDF。

---

## 2026-05-22 之前

### feat — 项目初始（`747f254`）
- init：OZON 跨境电商项目 = React 前端（市场调研/核算面板）+ 京东联盟后端（jd-union-service，已在快照中移除）。
- 业务数据形成期：市场分析（发膜/护发喷雾/矫形枕/手套/枕头热销数据 05-06~05-12）、供应链工厂目录、样品终选和包材。
- WB 需求规格说明书 V1.1 定稿（DPX 线路、反向赔偿 13.1.14）。
