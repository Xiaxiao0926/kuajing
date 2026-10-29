# KUAIJING-IA-REFACTOR-V1 · TASK 07A-3D1
# Supply Plan → Costing Bridge Contract Audit (只读审计报告)

## 1. 目标与审计范围 (Goal & Scope)

### 核心问题
> 当前已经选定的 `project.supply.quoteId`，能否安全成为新 Costing Draft 的采购成本来源？如果可以，在什么条件下可以；如果不可以，缺什么契约？

### 审计原则
- **只读审计，零生产代码修改**；
- 严禁基于变量名（如 `unitPriceCny`）主观臆断业务事实，一切以 Store 存储、UI 输入和引擎计算代码事实为准；
- 重点解决 `unitPriceCny` 与 `currency = CNY/RUB/USD` 的语义冲突问题。

---

## 2. 真实链路与实体关系 (Selected Supply Contract)

源码核查定位：[`ozon-react/src/utils/t6/t6Store.js`](file:///d:/ozon/ozon-react/src/utils/t6/t6Store.js) (Line 757-781) 与 [`ozon-react/src/components/t6/ProjectSupplyChainPanel.jsx`](file:///d:/ozon/ozon-react/src/components/t6/ProjectSupplyChainPanel.jsx)。

### 2.1 project.supply Schema 事实
当前 Project 存储正式供应方案的真实结构为：
```javascript
project.supply = {
  supplierId: 'uuid',
  quoteId: 'uuid',       // 严禁误写作 selectedQuoteId！
  selectedAt: 'ISO8601',
  selectedBy: 'user',
  note: 'string'
}
```
若未调用 `setProjectSupply`，项目初始状态为 `project.supply === undefined` 或 `null`。

### 2.2 正式报价查询契约 (Lookup Contract)
```javascript
const supply = project?.supply ?? null
if (supply?.supplierId && supply?.quoteId) {
  const supplier = getSupplier(supply.supplierId)
  const quote = getSupplierQuote(supply.quoteId)
  // 严格引用一致性验证 (Fail-close):
  const isValid = supplier && quote &&
    supplier.projectId === project.id &&
    quote.supplierId === supplier.id
}
```
- **单一事实源**：正式报价来源严格绑定 `project.supply.quoteId`；
- **禁止猜测版本**：严禁通过 `supplier.quotes.at(-1)`、`max(version)` 或“最新报价”来猜测正式报价；用户可能明确选定 v1 而非 v2。
- **Quote Append-Only 隔离**：报价记录创建即冻结。即使后续供应商追加了 `Quote v3`，`project.supply.quoteId` 也绝不自动漂移，必须维持用户原选定版本。

---

## 3. SupplierQuote Schema 完整审计

源码位置：[`ozon-react/src/utils/t6/t6Store.js`](file:///d:/ozon/ozon-react/src/utils/t6/t6Store.js) (Line 649-682 `createSupplierQuote`)。

| 字段 | 类型 | 存储规则 | 默认值 / 约束 |
|---|---|---|---|
| `id` | string (UUID) | 系统自动生成 | 禁止 payload 传入 |
| `schemaVersion` | string | `1.0` | 禁止 payload 传入 |
| `supplierId` | string (UUID) | 必填，外键关联 `Supplier` | 必须存在于 Store |
| `version` | number | 该供应商内 `max(version) + 1` | 从 1 起自增，不可变 |
| `unitPriceCny` | number | `Number(unitPriceCny)` 原样存入 | `>= 0` 有限数值 |
| `currency` | string | 必须是 `'CNY' \| 'RUB' \| 'USD'` | 默认 `'CNY'` |
| `moq` | number | `Number(moq) \|\| 0` | 最小起订量 |
| `exw` | boolean | `Boolean(exw)` | 贸易条款 EXW 标记 |
| `fob` | boolean | `Boolean(fob)` | 贸易条款 FOB 标记 |
| `packagingSpec` | string | 字符串（如 "彩盒+气泡袋，一箱40个"） | 默认为 `''` |
| `toolingFeeCny` | number \| null | `Number(toolingFeeCny)` 或 `null` | 模具费 |
| `sampleFeeCny` | number \| null | `Number(sampleFeeCny)` 或 `null` | 样品费 |
| `leadTimeDays` | number | `Number(leadTimeDays) \|\| 0` | 生产交期天数 |
| `paymentTerms` | string | 字符串 | 付款条款 |
| `remark` | string | 字符串 | 报价备注 |
| `createdAt` | string (ISO) | 系统生成时间戳 | 创建即冻结 |

---

## 4. 重点审计：`unitPriceCny + currency` 语义冲突

### 4.1 UI 表现事实
审查 [`ozon-react/src/components/t6/ProjectSupplyChainPanel.jsx`](file:///d:/ozon/ozon-react/src/components/t6/ProjectSupplyChainPanel.jsx) (Line 552-573)：
```jsx
<label className="block text-workspace-text-secondary">报价单价 *</label>
<div className="mt-1 flex items-center">
  <input
    type="number"
    value={quoteFormData.unitPriceCny}
    onChange={(e) => setQuoteFormData(p => ({ ...p, unitPriceCny: e.target.value }))}
    placeholder="例如：35.5"
  />
  <select
    value={quoteFormData.currency}
    onChange={(e) => setQuoteFormData(p => ({ ...p, currency: e.target.value }))}
  >
    <option value="CNY">CNY (¥)</option>
    <option value="RUB">RUB (₽)</option>
    <option value="USD">USD ($)</option>
  </select>
</div>
```
并在报价列表卡片中展示 (Line 706-707)：
```jsx
<span className="text-base font-semibold text-workspace-success">¥{q.unitPriceCny}</span>
<span className="text-xs text-workspace-text-tertiary">({q.currency})</span>
```

### 4.2 Store 表现事实
审查 `createSupplierQuote`：
1. 校验逻辑：
   `throw new Error('T7_STORE: 报价单价 unitPriceCny 必须为非负数值（CNY 口径）')`；
2. 存储逻辑：
   直接将 `Number(quoteFormData.unitPriceCny)` 存入 `unitPriceCny`，完全**没有进行任何汇率换算**（`NO_CURRENCY_NORMALIZATION`）；
3. 币种字段：
   原币种字符串直接存入 `currency`。

### 4.3 冲突定性
- 用户如果在输入框填入 `10`，右侧下拉选 `USD`；
- Store 实际写入的是：`{ unitPriceCny: 10, currency: 'USD' }`；
- UI 列表实际渲染为：`¥10 (USD)`；
- 决策日志写入：`报价 v1（¥10）`。
- **结论**：
  **`QUOTE_PRICE_SEMANTICS = CONFLICTED`**
  （字段名为 `unitPriceCny`，Store 报错声称“CNY 口径”，但 UI 和 Store 允许选择 USD/RUB 并原样保存非 CNY 原始数字，既不是真实的 CNY_NORMALIZED，字段名又与 ORIGINAL_CURRENCY 严重冲突）。

---

## 5. Costing 采购成本字段与口径审计

### 5.1 Ozon 核算面板 (`OzonCalc.jsx`)
- 字段名：`purchaseCost`；
- 输入单位与币种：UI 标签 `采购成本`，单位 `¥` (CNY)；
- 国内运费与贴标：
  `domesticShipping`（国内段运费 ¥）与 `labelingFee`（贴标费 ¥）为**独立并列输入字段**；
- 税务口径：源码无进项税/退税计算，`tax: UNRESOLVED`；
- 预填现状：`buildOzonPrefill` 保持 `purchaseCost: ''`（留空不虚构）。

### 5.2 WB 单订单核算器 (`WBCalc.jsx` / `CalculatorTab.jsx`)
- 字段名：`purchaseCost`；
- 输入单位与币种：UI 标签 `采购成本`，单位 `¥` (CNY)；
- 包装与国内送仓：
  `packagingCost`（包装成本 ¥）与 `chinaInbound`（国内送仓费 ¥）为**独立并列输入字段**；
- 计算公式：`skuData.purchaseCostCny = input.purchaseCost * input.quantity`；
- 预填现状：`buildWbPrefill` 中根本没有 `purchaseCost` 字段（保持默认 0 / 用户手动录入）。

### 5.3 结论：Costing 采购成本口径
- 两个平台均严格要求采购成本数值为 **人民币 CNY (¥)**；
- 两个平台的采购成本均**不包含国内运费**（Ozon 另有 `domesticShipping`，WB 另有 `chinaInbound`）；
- 两个平台的采购成本均**不包含包装辅料成本**（WB 另有 `packagingCost`，Ozon 另有 `labelingFee`）。

---

## 6. 贸易条款与附加成本边界 (Incoterms & Extra Costs)

### 6.1 EXW / FOB
- Store 类型：`exw: boolean, fob: boolean`；
- UI 表现：两个独立 Checkbox；
- 允许状态：用户可以两个都不勾，也可以同时勾选 `exw = true && fob = true`（UI 会显示 `EXW/FOB`）；
- **结论**：
  **`INCOTERM_MODEL = NON_EXCLUSIVE_FLAGS`**。
- **物流边界**：`SupplierQuote` 中没有国内运费字段。无论勾选 EXW 还是 FOB，`unitPriceCny` 都是纯工厂供货价，绝不能当成“国内到仓完整采购成本”。

### 6.2 模具费与样品费 (Tooling & Sample Fees)
- `toolingFeeCny` 与 `sampleFeeCny`：均为一次性金额（一次性开模或打样支出）；
- 源码完全没有分摊公式（如 `toolingFeeCny / MOQ`）；
- 历史设计冻结约束（参见 `T7-0 §9`）：模具费/样品费仅作参考信息，不自动摊入单件单位成本；
- **结论**：
  **`COST_ALLOCATION_SEMANTICS = UNRESOLVED`**（严禁自动摊入采购单价）。

### 6.3 包装规格 (packagingSpec)
- 类型：纯文本字符串 `string`（例如 `"彩盒+气泡袋，一箱40个"`）；
- 并非结构化数据，严禁尝试用正则或启发式从中解析装箱数、单件包装成本或箱规。

---

## 7. 汇率快照与非 CNY 风险 (FX Snapshot & Non-CNY Boundary)

- **汇率冻结现状**：`SupplierQuote` 记录中**没有任何汇率快照字段**；
  **`QUOTE_FX_SNAPSHOT = NONE`**；
- **禁止偷换汇率**：若报价为 `10 USD`，严禁在读取时用当前实时的 `rub_per_cny` 或动态拉取的 USD/CNY 汇率去折算；因为汇率会波动，会直接破坏历史报价的事实稳定；
- **非 CNY 风险判断**：
  **`NON_CNY_PREFILL = BLOCKED_BY_CURRENCY_SEMANTICS`**；
  在没有币种归一化和汇率冻结前，非 CNY 报价绝对不可进入成本预填。

---

## 8. 正式供应方案的业务语义边界

根据 `setProjectSupply` 源码事实：
- 该函数仅校验 `quoteId` 属于 `supplierId` 且属于当前项目，然后记录引用；
- **不校验**打样是否通过（`project.samples` 中是否有 approved 记录）；
- **不产生**采购订单（PO）；
- **结论**：
  - **`SUPPLY_PLAN ≠ PURCHASE_ORDER`**（供应方案不是采购下单）；
  - **`SUPPLY_PLAN ≠ SAMPLE_APPROVAL`**（供应方案不等于打样通过）。

---

## 9. 当前字段来源矩阵 (Current Costing Matrix)

| Costing Field | Current Source | Potential Supply Source | Safe? | Reason |
|---|---|---|---|---|
| `productName` | `project.product.nameZh` (fallback `snapshot.sourceInputs.name`) | None (`SupplierQuote` 无品名字段) | N/A | 供应链报价不拥有品名所有权 |
| `grossWeight` | `project.product.grossWeightG` (fallback `snapshot.sourceInputs.weight_kg`) | None (`SupplierQuote` 无重量字段) | N/A | 供应链报价不包含物流重量 |
| `packageDims` | `project.product.packageDimsCm` (fallback `snapshot.sourceInputs.dims`) | None (`packagingSpec` 为非结构化文本) | N/A | 无法从字符串安全提取 `[L, W, H]` |
| `purchaseCost` | 用户核算面板手工填写 (Ozon 预填留空，WB 默认 0) | `SupplierQuote.unitPriceCny` (经 `project.supply.quoteId`) | **Conditional** | **当且仅当 `currency === 'CNY'` 且由用户显式点击采用时安全**；非 CNY 因币种语义冲突直接阻断 |
| `sellingPrice` | `snapshot.sourceInputs.price_rub` | None | N/A | 售价由市场情报/候选快照提供 |
| `commission` | `snapshot.sourceInputs.commission_rfbs` / 平台类目配置 | None | N/A | 佣金属于平台政策 |
| `freight` | 跨境物流资费表 + 物流计算引擎 | None | N/A | 物流费由重量尺寸与渠道引擎计算 |

---

## 10. 采购成本桥接模式比较 (Bridge Candidate Modes)

| Mode | 模式说明 | 所需契约 | 当前是否满足 | 风险 |
|---|---|---|:---:|---|
| **MODE A — AUTO_OVERLAY** | 只要项目选了 Supply，打开新核算自动预填报价 | 1. 报价必须保证为 CNY 或已归一化<br>2. 报价与核算成本口径（税/运费）完全闭环 | ❌ 否 | **致命风险**：若报价为 10 USD，将直接自动填入 10 元人民币，导致虚高利润误导决策 |
| **MODE B — EXPLICIT_APPLY** | 核算器显示“采用正式报价”，用户点击确认后填入 | 1. `project.supply.quoteId` 引用一致性<br>2. `currency === 'CNY'` 强制校验拦截 | ⚠️ 条件满足 (仅限 CNY) | 用户有明确预期，非 CNY 报价置灰并提示，风险完全可控 |
| **MODE C — REFERENCE_ONLY** | 仅在核算器旁展示参考卡片，不改动任何输入框 | 只读查询权限 | ✅ 是 | 零风险，完全依赖人工手动键入 |

---

## 11. Quote Semantics 固定卡片

```text
SUPPLIER QUOTE

Selected Quote Identity: project.supply.quoteId (Explicit immutable version reference)
Price Field: unitPriceCny
Currency Field: currency ('CNY' | 'RUB' | 'USD')
Price Semantics: CONFLICTED
FX Snapshot: NONE
Incoterm Model: NON_EXCLUSIVE_FLAGS (exw: boolean, fob: boolean)
Packaging Cost: UNRESOLVED (packagingSpec is string, WB has separate packagingCost)
Domestic Freight: NONE (no domestic freight field, Ozon/WB have separate freight inputs)
Tooling Allocation: UNRESOLVED (one-off reference, no amortization)
Sample Fee Allocation: UNRESOLVED (one-off reference, no amortization)
```

---

## 12. Bridge Decision (桥接决策)

根据源码严谨事实，最终决策结论为分条件分支：

```text
SUPPLY_COST_BRIDGE =
  IF currency === 'CNY':
    SAFE_FOR_EXPLICIT_APPLY (严禁 AUTO_OVERLAY，仅允许用户在核算面板显式点击“采用”)
  IF currency !== 'CNY' (USD / RUB):
    BLOCKED_BY_CURRENCY_SEMANTICS (严禁自动换算，置灰并提示用户手工核算)
```

- **绝对禁止 AUTO_OVERLAY**：无论何种币种，都不允许静默自动覆盖 `purchaseCost`；
- **历史场景绝对不可变**：未来若引入 Explicit Apply，也绝不允许回写已存在的 `CostScenario`。

---

## 13. Fixed GAP 清单 (S1 ~ S6)

- **`S1 — QUOTE CURRENCY SEMANTICS`**：
  `CONFLICTED`。`unitPriceCny` 字段名与 `currency` 可选 USD/RUB 存在命名与存储口径冲突；UI 列表无条件加 `¥` 前缀；Store 未做任何汇率归一化。
- **`S2 — PURCHASE COST SEMANTICS`**：
  `UNRESOLVED`。核算采购成本税负口径（含税/不含税）未定义；国内运费与包装费在核算器中是独立输入项，`SupplierQuote` 的单价仅是工厂价，不等于到仓采购总成本。
- **`S3 — INCOTERM SEMANTICS`**：
  `NON_EXCLUSIVE_FLAGS`。`exw` 与 `fob` 为非排他性布尔标志，可同时为 true。
- **`S4 — EXTRA COST ALLOCATION`**：
  `UNRESOLVED`。模具费与样品费为一次性参考支出，无摊销逻辑；包装规格为非结构化文本。
- **`S5 — FX SNAPSHOT`**：
  `NONE`。报价单未冻结汇率快照，无法对非 CNY 报价进行无损历史溯源换算。
- **`S6 — SELECTED QUOTE IDENTITY`**：
  `RESOLVED`。`project.supply = { supplierId, quoteId, selectedAt, selectedBy, note }` 准确稳定，版本引用链路清晰。

---

## 14. 下一任务建议 (Next Conditional Step)

- **IF SAFE (仅针对 CNY 报价)**：
  后续 **TASK 07A-3D2** 仅可实现：在核算面板中增加**显式操作按钮（EXPLICIT_APPLY）**：“采用正式供应报价 (v{version}: ¥{unitPriceCny})”。用户主动点击后，才将数值写入当前核算草稿输入框；
- **IF BLOCKED (针对非 CNY 报价)**：
  若 `currency !== 'CNY'`，按钮禁用并悬浮提示：“非人民币报价暂不支持一键导入，请核实汇率后手工填入”。若要彻底解决，需在未来专门的 T7 Schema 升级任务中规范币种与汇率快照模型。
