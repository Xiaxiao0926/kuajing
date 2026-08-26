# FYZSXNB-KUAJING-CALC-ENGINE-GLM-REVIEW-FIX-002-REPORT

任务编号：FYZSXNB-KUAJING-CALC-ENGINE-REVIEW-FIX-002（接续执行）
报告日期：2026-08-26
执行模式：接手前一个 Agent 的未完成现场（以 git diff 为唯一事实依据），补齐剩余核验/修复，完成全部测试。

---

## 0. 现场恢复结论

前一个 Agent 在运行时限内已完成绝大部分工作（34 个文件，约 +702/-687 行），但留下了 **1 处未完成代码**：

| 文件 | 问题 | 处置 |
|---|---|---|
| `ozon-react/src/components/OzonCalc.jsx` | UI 使用了 `rubPerCny`（第 236、338 行汇率展示），但 import 列表**缺失该符号**，组件渲染时会抛 `ReferenceError`。Vite build 不做未定义标识符检查，因此构建通过但运行时必然白屏 | **本轮 FIXED**：补充导入 `rubPerCny`；同时删除 SingleTab 中已由引擎内部计算取代的死代码（`domesticCost`、`platformCostRate` 局部变量） |

除此之外，前一个 Agent 的工作经逐文件 diff 审查 + 测试验证，业务逻辑均正确，无回滚必要，无重复实现。

---

## 1. 七个核验点结果

### 1.1 Ozon / WB 代理费隔离 — **PASS**

- **Ozon 扣代理费：是。** `ozonEngine.js` 的 `calcRow` / `calcChannelProfit` 均调用统一纯函数 `calculateAgencyFeeRub(price, config)`，规则为 `clamp(orderAmountRub × rate, min_rub, max_rub)`，默认配置来自 `config/settings.json → agency_fee = { rate: 0.02, min_rub: 15, max_rub: 200 }`。
- **WB 不扣该代理费：是。** 
  - JS 侧：`wbEngine.js` 的 `calculatePlatformSettlement` / `calculateOperatingProfit` / `calculateOperatingProfitV2` 的扣费链为「佣金 + 物流 + 支付费 + 促销费 + 其他扣款 + 税费 + 成本」，**不含任何代理费项**，也不读取 `settingsData.agency_fee`。
  - Python 侧：`wb_calc.py` 中 `calculate_agency_fee_rub` **仅为独立纯函数**，全仓库检索确认只被 `wb_test.py` 调用，未被 `calculate_platform_settlement` / `calculate_operating_profit` 等 WB 利润路径调用。符合「辅助函数可保留、但不得进入 WB 实际利润」的原则。
- **Platform Isolation Test：已存在。** `costScenario.test.mjs` C14：向 WB 结算传入 Ozon 的 agencyFee 配置（rate 0.99 / min 999 / max 9999），断言结算结果与不含该配置时完全一致 → 通过。

### 1.2 内部计算精度 — **PASS（前 Agent 已修复，本轮复核确认）**

过早 round2 问题原存在于 `wbEngine.js` 与 `wb_calc.py`（中间费用项逐项 round2 后再相减，产生累计误差）。修复方式为「raw / format 分离」：

- JS：`calculatePlatformSettlementRaw`（全精度）+ `formatPlatformSettlement`（展示取整）；`calculateOperatingProfit` / `V2` 内部全程使用 `*Raw` 值，仅在输出层 round2。
- Python：`_calculate_platform_settlement_raw` + `_format_platform_settlement` 同构拆分，Decimal 全精度。
- Ozon：`ozonEngine.js` 中 `priceCnyRaw` / `agencyCnyRaw` / `platformCostRaw` / `returnAmtRaw` / `profitRaw` 全精度链，`round2` 仅用于输出字段；`rubToCnyExact`（不取整）与 `toCNY`（展示取整）分离导出。
- 组件层：PricingCalc / ShippingCalc / OzonCalc 已全部委托引擎，无本地公式残留（检索 `calcShipping|getBestShipping|const R|agencyAmtRub` 无组件内实现）。
- 专项验证（JS C10 + Python `test_agency_fee_and_exchange_rate`）：`3998/13=307.54`、`5200/13=400.00`、`100000/13=7692.31` 展示正确，且 `rubToCnyExact(3998) === 3998/13` 证明内部未提前截位。
- 全精度聚合验证（C15 + Python）：3998₽ / 佣金7% / 各1₽ 场景净结算 = **285.78**（由未取整中间值聚合后一次 round2，而非展示值相减）。

### 1.3 CostScenario 不可变快照 — **PASS**

追踪「创建 → 保存 → 读取 → 重新计算」全链路：

- **创建**：`buildOzonResolvedConfig` 冻结 `exchange_rate`、`currency: 'RUB/CNY'`、`calculation_version`、`agencyFee: {rate, min_rub, max_rub}`、完整渠道记录（含 meta）。
- **保存**：`createCostScenario` append-only，无 update/delete API（C4 测试：读取不改字节）。
- **读取**：UI（ProjectDetailPage）经 `scenarioSummary` 读取 `outputPayload` 原文（保存时引擎输出 verbatim），**不做重算** —— 历史场景展示天然冻结。
- **重新计算**：`recalculateOzonScenario` 按需复算，优先级实现为：
  - 汇率：`cfg.exchange_rate ?? cfg.rubPerCny ?? currentSettings.rub_per_cny`
  - 代理费：`cfg.agencyFee || currentSettings.agency_fee`

**C12 测试（模拟当前配置 13 + 3%/20/250，不触碰正式配置）**：
- 历史场景（冻结 12 + 2%/15/200）：复算代理费仍为 5000×2% = **100 RUB**、折合 **8.33 CNY**（按 12 汇率）→ 冻结生效。
- 新场景：读取当前 13 + 3%/20/250 → 正确。
- 旧版本场景（resolvedConfig 缺新字段）：明确回退当前配置（150 RUB / 11.54 CNY），**不报错** → fallback 生效。

### 1.4 代理费临界值 — **PASS**

JS（C11）与 Python（`test_agency_fee_and_exchange_rate`）双侧同值测试，全部通过：

| 订单金额 (RUB) | 期望代理费 (RUB) | 结果 |
|---|---|---|
| -1 | 0 | PASS |
| 0 | 0 | PASS |
| 0.01 | 15 | PASS |
| 500 | 15 | PASS |
| 750 | 15 | PASS |
| 751 | 15.02 | PASS |
| 2000 | 40 | PASS |
| 10000 | 200 | PASS |
| 15000 | 200 | PASS |

JS/Python 结果完全一致。

### 1.5 旧汇率残留 — **PASS**

全仓库检索 `0.0769` / `0.09` / `ozon_rub_to_cny` / `rub_to_cny` / `rubToCny` / `ozonRubToCny`：

- 运行时业务代码 **零残留**：`config/settings.json`、`generated/settings.js`、`ozon_channels.json`、`generated/ozon_channels.js`、`wb_data.py` 校验规则中 `ozon_rub_to_cny` 均已移除；各组件（KPICards、dictionary.js、HeaderOverview、ExpertStrategy、NewProductsAnalysis、PopularFeaturesAnalysis、PotentialProductsAnalysis、PriceBandAnalysis、PriceElasticityAnalysis、chartConfigs、ProjectSetup）的硬编码 `0.075` / `0.09` 均改为从 `ozonEngine` / `generated/settings.js` 单源读取。
- 保留项（均为合法保留）：
  - `scripts/split-newdashboard.js`：一次性历史拆分脚本的行号锚点（引用旧源文件原文，供审计，非运行时业务逻辑）。
  - `fragrancePricing/data.js` 中 `jd: { rate: 0.096 }`：京东**渠道费率**（国内香水定价业务），与 RUB/CNY 汇率无关。
  - 历史报告/文档/fixture 中的旧汇率记载：按规则保留。
- 当前唯一汇率事实源：`config/settings.json → rub_per_cny = 13`（生效 2026-08-25）。

### 1.6 PricingCalc / ShippingCalc 去重核验 — **PASS（含本轮 1 处修复）**

- `PricingCalc.jsx`：本地 `ALL_CHANNELS` / `calcShipping` / `getBestShipping` / 本地 `calcRow`（约 80 行公式）已删除，改 import 引擎 `calcRow`。
- `ShippingCalc.jsx`：本地 17 条渠道表 + `calcShipping` + 代理费/利润公式（约 260 行）已删除，改 import `CHANNEL_GROUPS` / `calcChannelProfit` / `toCNY`。
- `OzonCalc.jsx`：SingleTab 走 `calcChannelProfit`，MultiTab 走 `calcRow`。
- 组件保留职责：输入、state、UI、format、interaction —— 符合边界要求。
- 本轮修复：OzonCalc 缺失的 `rubPerCny` 导入（见第 0 节）。

### 1.7 多规格 0.6 折扣核验 — **PASS**

模型显性化为 `listPrice → discountRate（默认 0.6，UI 可调）→ transactionPrice`：

- `calcRow` 中 `price = round2(listPrice × discountRate)`，**只执行一次**；佣金、代理费、平台费、退货、利润全部基于 `price`（成交价）。
- UI（PricingCalc / OzonCalc MultiTab）仅保存/回显 `discountRate`，不做任何价格乘算 → 无双重折扣。
- C13 专项测试：`8600 × 0.6 = 5160`；代理费 = 5160×2% = **103.2 RUB**（若误用挂牌价 8600 则为 172 → 断言排除）。

---

## 2. 配置同步链 — **PASS**

执行 `node scripts/sync-config.js` 后核对三端：

| 配置项 | config/settings.json | JS (generated/settings.js) | Python (wb_data.py 校验) |
|---|---|---|---|
| rub_per_cny | 13 | 13 | 13 |
| agency_fee.rate | 0.02 | 0.02 | 0.02 |
| agency_fee.min_rub | 15 | 15 | 15 |
| agency_fee.max_rub | 200 | 200 | 200 |
| calculation_version | v1.0 | v1.0 | v1.0（非空字符串校验） |

`sync-config.js` 与 `wb_data.py` 的必填字段校验已同步更新（移除 `ozon_rub_to_cny`，新增 `calculation_version` + `agency_fee` 结构校验：rate/min 非负、max ≥ min）。`npm run test:sync` 双端对拍零差异，无 13/12 类漂移。

---

## 3. Golden Test 纪律 — **PASS（未修改任何 Expected）**

`npm run test:golden`：**76/76 通过**，全程未修改任何 golden expected 值。本轮无 A/B/C 判定场景触发。

---

## 4. 测试执行记录（本轮实际运行）

| 命令 | 结果 |
|---|---|
| `npm test`（全链 13 套） | 全部通过，共 **592** 项断言（详见下表） |
| `npm run test:golden` | **76/76** 通过 |
| `npm run test:sync` | 通过（双端对拍零差异，16 重量边界 + 2 版本边界 + scoring_rules 一致性） |
| `npm run build` | 成功（仅 chunk 体积提示，非错误） |
| Python 测试（`wb_test.py`，含 UTF-8 环境修正） | **44/44** 通过 |

`npm test` 明细：

| 套件 | 通过/失败 |
|---|---|
| WB跨境核算（wbEngine） | 65/0 |
| 评分引擎 | 81/0 |
| 单调性/不变式 | 20/0 |
| 评分数据适配层 | 13/0 |
| 评分导出（XLSX/CSV） | 22/0 |
| T6 Store | 56/0 |
| Stage Gate 引擎 | 42/0 |
| **CostScenario（含 C10–C16 专项）** | **74/0** |
| WB 成本场景 | 53/0 |
| T6 UI 契约 | 23/0 |
| T7-1 Supplier/Quote/Sample | 43/0 |
| T4-3 黄金评分案例 | 56/0 |
| Python wb_test（含新增代理费/汇率 13 项） | 44/44 |

专项测试质量抽查（非仅看绿灯）：C12 使用 fixture `price_rub=5000`，历史冻结断言值 100 RUB / 8.33 CNY 与「5000×2%=100、100÷12=8.33」手工推算一致；legacy 回退断言 150 RUB / 11.54 CNY 与「5000×3%=150、150÷13=11.54」一致 → 测试确实覆盖业务规则，非空转。

---

## 5. 十五个核心问题逐项回答

| # | 问题 | 结论 | 标记 |
|---|---|---|---|
| 1 | Ozon 是否扣 2%/15~200 RUB 代理费？ | 是。`calcRow`/`calcChannelProfit` 统一走 `calculateAgencyFeeRub`，配置来自 settings.json | PASS |
| 2 | WB 是否扣相同代理费？为什么？ | 否。WB 结算/利润扣费链不含代理费；Ozon 代理费是 Ozon 合作配送服务（rFBS）专属费用，WB 是独立利润模型，禁止移植。Python 的 `calculate_agency_fee_rub` 仅为纯函数+测试，未接入 WB 利润 | PASS |
| 3 | 是否发现过早 round2？ | 是（前 Agent 发现于 wbEngine.js / wb_calc.py：中间费用项逐项 round2 后相减） | PASS（已修复） |
| 4 | 如果发现，修改了哪里？ | `wbEngine.js`（raw/format 分离 + OperatingProfit/V2 全精度内部链）、`wb_calc.py`（`_raw`/`_format` 同构拆分）、`ozonEngine.js`（`*Raw` 全精度 + `rubToCnyExact`）；本轮额外修复 `OzonCalc.jsx` 缺失的 `rubPerCny` 导入（运行时 ReferenceError） | FIXED |
| 5 | 历史 Scenario 汇率是否真正冻结？ | 是。C12：冻结 12 的历史场景在当前全局 13 下复算仍用 12（代理费折合 8.33 而非 7.69）；UI 读取走 outputPayload verbatim 不重算 | PASS |
| 6 | 历史 agencyFee 规则是否真正冻结？ | 是。C12：当前模拟 3%/20/250 下，历史场景仍按 2%/15/200 计算（100 RUB 而非 150 RUB）；模拟配置仅存在于测试内存，未写正式配置 | PASS |
| 7 | 旧 Scenario 缺字段如何 fallback？ | 汇率：`exchange_rate ?? rubPerCny ?? settings.rub_per_cny`；代理费：`cfg.agencyFee \|\| settings.agency_fee`；缺字段不报错（C12 legacy 分支通过） | PASS |
| 8 | 0.6 折扣是否只执行一次？ | 是。C13：8600×0.6=5160，仅引擎内一次；UI 只传 discountRate 不乘价 | PASS |
| 9 | 佣金和代理费基于挂牌价还是成交价？ | 成交价（transactionPrice 5160）。C13 断言代理费 103.2（=5160×2%）而非 172（=8600×2%） | PASS |
| 10 | 当前运行时代码是否仍残留 0.0769/0.09 汇率？ | 否。运行时零残留；仅历史审计脚本锚点（split-newdashboard.js）与无关的京东渠道费率 0.096（fragrancePricing） | PASS |
| 11 | JS/Python/config 是否一致？ | 是。三端均 13 + 2%/15/200 + v1.0；`test:sync` 双端对拍零差异 | PASS |
| 12 | Ozon 计算结果是否发生变化？ | 汇率事实源统一为 13 后，Ozon 利润换算口径随之更新（此前组件端存在 0.09/0.075 双口径并存）；核心公式结构未变，golden（含 ozon-cel-channels）76/76 通过 | PASS |
| 13 | WB 计算结果是否发生变化？ | 仅中间精度提升：净结算由「逐项 round2 相减」改为「全精度聚合后一次 round2」，展示值可能最后一位 ±0.01；无费率/结构变化，golden 全通过 | PASS |
| 14 | 历史Scenario是否发生变化？ | 否。append-only 存储，读取 verbatim，字节不变（C4）；复算仅在显式调用 `recalculateOzonScenario` 时发生且优先用冻结配置 | PASS |
| 15 | 全部自动化测试实际通过数量 | npm test 592 项 + golden 76 项 + sync 通过 + build 成功，**0 失败** | PASS |

---

## 6. 最终自查（git diff / status）

- 修改文件 34 个，全部与本任务相关（引擎、组件收敛、配置、校验、测试、文档、PHP 版本号 0.2.4→0.2.5）。
- 无 debug / console 临时代码（检索确认）。
- 无误改正式费率：`agency_fee` 保持 2%/15/200；测试中的 3%/20/250 仅为内存内模拟值。
- 无误删历史 fixture；历史报告/快照中的旧汇率记载按规则保留。
- 无生产部署、无 git push、无 reset/checkout。
- `ozon-react/public/data/manifest.json` 的 `updatedAt` 时间戳变化为 vite 构建插件（vite.config.js）自动再生成的构建产物时间戳，每次 `npm run build` 必然更新，非业务变更。
- 未跟踪文件（`bydCP0818.sh`、`fybydcp0818.html`、`hwj07_audit/`、`reports/`、`tools/`）为本轮之前已存在的现场内容，未触碰。

---

## 7. 本轮（接手 Agent）实际增量

1. **修复** `OzonCalc.jsx`：补充缺失的 `rubPerCny` 导入（消除运行时 ReferenceError / 组件白屏风险）；删除 SingleTab 两行死代码。
2. **复核** 全部 7 个核验点、配置同步链、全部 diff 文件。
3. **执行** 全量测试（npm test / golden / sync / build / Python）。
4. **输出** 本报告。

前一个 Agent 已完成的工作（引擎精度改造、代理费统一、汇率单源化、场景冻结、组件去重、双侧测试、文档更新）经核验全部有效，予以保留。
