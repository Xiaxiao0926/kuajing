# CHANGELOG.md — 变更记录

> 记录原则：每个有意义的变更（功能/修复/重构/文档/数据）必须在此登记。
> 格式：日期 | 类型 | 说明（关联 commit/tag）。类型：feat / fix / refactor / docs / chore / data。

---

## 2026-09-02（Ozon FBP 边境仓核算，一期，已上线 fyzsxnb.com）

> 完整交接归档见《流程任务书-20260902-FBP边境仓核算.md》。

### feat — FBP 边境仓核算引擎 + 独立页面
- **新页面**「FBP 边境仓核算」（侧栏「物流与成本」组，node id `__fbp_calc__`，懒加载 chunk 96.63 kB）：与 rFBS 的 OzonCalc 并列，覆盖俄/白俄/哈萨克三国。
- **渠道配置**：`config/ozon_fbp_channels.json` 唯一事实源，提取自 FBP 官方服务清单（版本 `HK1092026` 动态提取自 source）。142 条线路 / 7 物流商（CEL、GUOO、RETS、Ural、Ural HK、XY、ZTO）/ 11 边境仓 / 计费三模式（实重 94、体积重÷12000 46、条件体积重 2——Ural Super Express 三边和>90cm 切÷6000）。DEX 美元线路与 Smart 服务一期排除。sync-config 新增 `validateFbpChannels` fail-close 校验。
- **引擎** `ozonFbpEngine.js`：`calcFbpShipping`（适用性六维过滤：目的国/仓库/尺寸/重量/申报价值/电池液体三态 + 计费重）、`calcStorageFee`（**90 天免仓期，其后 ¥4/m³/天**）、`calcFbpProfit`（完整利润链：国内段工厂→边境仓运费 + 3PL 国际段 + 尾程手动 + 仓租 + 代理费 + 平台费 + 退货损失）、`getBestFbpProfit`；汇率沿用 live binding `R`，代理费沿用 agency_fee（2%/15₽/200₽ 封顶）。
- **UI**：最优线路卡（8 项成本分解）/ 全线路对比表（不可用灰显带原因，MSDS 标注）/ 参数与方案历史手动保存（`fbp-calc-params-v1` / `fbp-calc-history-v1`，保留 20 条）。
- **测试**：`ozonFbpEngine.test.mjs` 29 用例（计费三模式、过滤、仓租边界、利润链复算、live binding），`test:fbp` 入 npm test 主链；全量回归 + 构建全绿。

### fix — 开发期缺陷（已防回归）
- **体积重单位错误**（关键）：初版把体积重结果（kg）当克用（64000cm³÷6000=10.67kg 被算作 10.67g）→ 全程 kg 口径 + 单测双断言锁定；条件体积重解析遗漏 Ural Super Express → 扩展 conditional 类型支持。

### deploy — 上线与验收（commit `3cdd7d4`，2026-09-02）
- 提交 15 文件（+9298/−7）已推送 `origin/main`；push run 33583013290 verify success（含 test:fbp 29 用例全链），dispatch run 33583444717 verify + deploy 双 success，FTP 上传 Hostinger 无超时复现。
- 线上验收：fyzsxnb.com/kuajing/ 主 bundle 切换 `index-CBhzPVQY.js`（HTTP 200，含 `__fbp_calc__` 路由）；FBP chunk `OzonFbpCalc-kGfieGQk.js` HTTP 200（108KB，内含资费版本 HK1092026 与 142 线路数据）；FBP 资费 xlsx 源表入库（沿袭 CEL 资费表先例）；BYD 等无关文件未混入提交。

### 待办（P5）
- Ozon 尾程配送费率表到位后切自动查表（配置已预留 `last_mile` 结构，现 UI 手动输入默认 0，利润为不含尾程口径）。
- DEX 美元线路与逆向物流结构化计费：二期。
- 部署记录补录（20260902 任务书 §5.1 与本条目）为本地变更，随下次 docs commit 入库。

---


## 2026-09-01（选品市场分析·纯度流水线，模块 2/3/4/5 一期，已上线 fyzsxnb.com）

> 完整交接归档见《流程任务书-20260901-选品市场分析纯度流水线.md》。

### feat — 纯度流水线引擎 + 「选品市场分析」页面
- **模块链**（`ozon-react/src/utils/marketAnalysis/`）：specParser（标题→数量+单位，пар×2/мл/кг 归一，西里尔边界 `(?![а-яёa-z0-9])` 替代 `\b`，排除尺寸对/型号/词干变体陷阱）→ purityFilter（类目投票检测 + A/B/C/UNKNOWN 可配置分层，UNKNOWN 独立成桶禁止归 C）→ priceBands（标准化可比价五等分位带 × SKU占比/销量占比/销售额占比三维，A 默认/A+B 可切，C 与 UNKNOWN 排除）→ credibility（覆盖率 + mulberry32 种子化 50 SKU 抽检 + 核验准确率/异常清单）。
- **规则引擎唯一事实源**：`config/market_analysis.json`（5 类目：发膜/护发喷雾/手套/枕头/吹风机），sync-config 新增 validateMarketAnalysis fail-close 校验。
- **UI**：新页面 `PurityPipelinePage.jsx`（桌面侧栏与移动端「当前步骤」均可进入，懒加载 chunk 34.56 kB）；抽检核验手动保存（`purity-checks-v1`）+ 生成记录日志（`purity-sample-history-v1`）。
- **测试**：specParser 36 + purityFilter 45 + pipeline.e2e 49（真实 xlsx 端到端 + 移动端入口契约）= 130 断言，`test:market` 入 npm test 主链；真实数据验证：发膜 380 行覆盖率 82.9%（A=296/B=9/C=10/UNKNOWN=65）、手套 1000 行覆盖率 79.8%（A=774/B=12/C=12/UNKNOWN=202）。

### fix — priceBands 分箱错位（e2e 抓出）
- 初版分箱边界取自排序数组、成员聚合切未排序数组 → 中位价/占比与价格区间错位（手套带1 区间 ₽0.5–1.0 中位却是 ₽31.2）。修复为整行排序后统一分箱；e2e 增守门断言（中位价∈区间、区间单调不重叠）；排除明细键 `A_no_price`→`no_price`。

### 口径冻结（用户决策，禁止回退）
- 三维名称固定 SKU占比/销量占比/销售额占比，无 GMV 字段禁写 GMV%；UNKNOWN 禁止自动归 C；批次摊销（模块1）二期独立进成本链。

### deploy — 上线与验收（commit `85dfa5c`，2026-09-01）
- 提交 17 文件（+2383/−2）已推送 `origin/main`；GitHub Actions run 33478718108 → success（20260826 遗留 FTP 超时本次未复现，降级观察项）。
- 线上验收：fyzsxnb.com/kuajing/ 「选品市场分析」正常加载，生产资源 200 无 "assets are not deployed" 回退；桌面/移动入口均存在、无横向溢出；A 默认 / A+B 切换 / C 与 UNKNOWN 排除 / 三维占比口径线上验证通过；130 项测试 + 7 份真实 Ozon 数据表回归全绿；BYD 等无关文件未混入提交。

---

## 2026-08-26（CEL 资费表 V7.24 + 每日汇率自动更新，已上线 fyzsxnb.com）

> 完整交接归档见《流程任务书-20260826-CEL费率V724与每日汇率自动更新.md》。

### feat — 每日汇率自动更新 + 页头动态版本号（`a0dfa64`，已部署）
- **数据源三级**：俄罗斯央行官方牌价（主，cbr-xml-daily.ru）→ open.er-api.com（备）→ config 兜底 13₽/¥；防护：区间 8–20、新鲜度 ≤10 天、8s 超时；localStorage 按日缓存（`fx-rate-daily-v1`），当日不重复请求。
- **live binding**：`ozonEngine` 的 `rubPerCny`/`R` 改 `let` + `setLiveRubPerCny()`，11 个组件既有引用零改动全局生效（Rollup 打包保真已验证，139 处共享引用）；React 侧 `useSyncExternalStore` hook；WBCalc 订阅同步进 WB settings（原"强制迁移汇率"逻辑删除）。
- **TARIFF_VERSION**：从 `config/ozon_channels.json` source 动态提取，消灭 OzonCalc/ShippingCalc 硬编码 "V5.23"（本次缺陷根因）；汇率显示格式化 4 位 + 来源/日期标注。
- 新增 `exchangeRate.js`/`useExchangeRate.js`/`exchangeRate.test.mjs`（27 单测入 npm test 链）；回归：npm test 44/44、golden 76/76、sync 零差异、web-persistence、build 全绿。
- 用户决策：暂不加手动锁定开关，按央行牌价跑（任务书 §2.4）。

### data — CEL 资费表 V5.23 → V7.24 全渠道更新（`288a374`，已部署）
- `config/ozon_channels.json`：17 个 Ozon 渠道费率上调约 7-8%（express_xs 5.46→5.90、standard_big 384.11→415.11），HK 渠道不变（沿用 T2-Gate0 核验结论）。
- 黄金测试纪律：`ozon-cel-channels`/`costScenario.test`/`grade-boundaries` 三处期望值随官方表更新，均附 provenance.change_log（边界毛利率 49/48→51/50 校准）。

### docs — 交接归档
- 新增《流程任务书-20260826-CEL费率V724与每日汇率自动更新.md》（修改清单/执行时间线/手动部署流程/遗留待办/接手约束）。
- `.gitignore` 补 `deploy/`（手动部署临时打包目录）。
- 遗留：hPanel 清理 4 个部署残留目录；GitHub Actions FTP 超时待修（期间部署走手动流程，任务书 §4）。

---

## 2026-08-14（整改阶段 V3）

### fix — T6-2B production hotfix（`fix/v3-t6-master-production-hotfix`，验收后）
- **P0**：`ProjectDetailPage.jsx` 补 WB 联动 imports（`buildWbPrefill`/`buildWbScenarioPayload`/`WBCalc`）——此前缺导入，点「使用 WB 核算」会运行时 ReferenceError（vite build 无法发现运行时标识符）。
- **P1**：`mergeTrustedPrefill`（costScenarioAdapter）——项目模式预填仅非空值覆盖既有成本假设，禁止 `''` 把采购/广告等清成 0 产生虚假高利润基线；OzonCalc/CalculatorTab 共用。
- **P1**：Ozon/WB 项目模式保存前「已确认成本与费率假设」人工确认 Gate，未确认禁用保存。
- **P1**：`buildWbResolvedConfig` 冻结进入利润公式的 `taxMethod`/`taxRate`（连同 rubPerCny）。
- **P1**：`scenarioMarginPct`/`scenarioSummary` 用 `num()` 安全取值——null/undefined/`''` → null（不再 Number(null)→0），Gate 基线缺利润率 → FAIL 而非 WARN 0%。
- **P2**：跨平台比较表补 `logisticsCostCny`/`platformCostCny`/`profitCny` 列（映射各引擎原文，不重算）。
- **P2**：`T6-MASTER-REPORT.md` FINAL MAIN 文案改为「release baseline f9ef3a3 + post-release hotfix」，消除自指 sha 漂移。
- **护栏**：新增 `t6UiContract.test.mjs`（UI 契约 + 项目联动保存流 smoke，23 断言）永久进 `npm run test:t6`。
- 回归全绿：npm test（T6 五套 56/42/46/53/23）+ golden 76 + sync 零差异 + verify:scoring-build + web-persistence + vite build；分布 1/191/448/169/191 不变；引擎/config 0 改动；旧 tag `v3-t6-sku-project-lifecycle` 未移动。

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
