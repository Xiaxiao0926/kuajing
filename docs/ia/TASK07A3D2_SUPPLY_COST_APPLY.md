# KUAIJING-IA-REFACTOR-V1 · TASK 07A-3D2
# Selected Supply Quote → Costing Explicit Apply 架构与交付文档

## 1. 业务目标与最终链路 (Objective & End-to-End Pipeline)

本任务打通了 SKU 项目已选定的正式供应报价向成本核算草稿的显式受控采用，核心原则为**“仅供草稿辅助，绝不自动覆盖，用户主动触发”**。

```text
Project
  ↓ (project.supply: { supplierId, quoteId })
Selected immutable SupplierQuote (不可变历史快照)
  ↓
ProjectDetail 调用层解析实体引用 (getSupplier, getSupplierQuote)
  ↓
buildSupplyCostReference 纯函数引用与币种校验
  ↓
projectContext.supplyCostReference
  ↓
Ozon / WB Calculator 界面展示
  ↓ (用户显式点击“采用正式供应报价”)
当前 Calculator Draft.purchaseCost (仅采购成本草稿值，不锁死)
  ↓ (用户可二次微调，勾选成本假设确认)
createCostScenario 不可变快照持久化
```

---

## 2. 正式报价单一事实源与版本稳定性 (Selected Quote Identity & Stability)

- **单一事实源**：核算工作台唯一读取 `project.supply.quoteId`；
- **禁止版本猜测**：严禁调用 `supplier.quotes.at(-1)`、`Math.max(...quotes.map(q => q.version))` 猜测“最新报价”；
- **版本冻结隔离**：供应商即使后续追加 `Quote v2` 或 `Quote v3`，只要未人工重新调用 `setProjectSupply`，项目档案与成本核算参考的引用指针严格保持在 `Quote v1`，不会发生隐式版本漂移。

---

## 3. 纯函数供应成本桥接契约 (Pure Supply Cost Reference)

文件位置：[`ozon-react/src/utils/t6/supplyCostBridge.js`](file:///d:/ozon/ozon-react/src/utils/t6/supplyCostBridge.js)

### 3.1 设计原则
- **零外部副作用**：严禁 `import t6Store`，严禁访问 `localStorage` / `persist`，严禁引入汇率配置或网络请求；
- **最小归一化状态**：不向 Calculator 传递 `MOQ`、`EXW`、`FOB`、`paymentTerms`、`toolingFee`、`sampleFee`、`packagingSpec` 等无关字段，仅暴露用于成本草稿的最小引用契约：
  `{ status, quoteId, quoteVersion, supplierId, supplierName, rawAmount, currency, [purchaseCostCny], [warning] }`。

### 3.2 状态判定矩阵
1. **`NONE`**：`project.supply` 为空或未设置，Calculator 完全不渲染报价卡片（零噪音）；
2. **`INVALID_REFERENCE`**：
   - 存在 `supply`，但 `supplier` 或 `quote` 实体不存在；
   - 跨项目引用 (`supplier.projectId !== project.id`)；
   - 跨供应商引用 (`quote.supplierId !== supplier.id`)；
   - 指针不匹配 (`supply.quoteId !== quote.id` 或 `supply.supplierId !== supplier.id`)；
   - 报价单价非法（非有限数值、负数、或字符串隐式转换）。
   - 此时 Calculator 渲染醒目弱提示，禁用一键采用，引导用户手工输入。
3. **`APPLICABLE_CNY`**：
   - 引用合法，且 `quote.currency === 'CNY'`；
   - 提供 `purchaseCostCny: quote.unitPriceCny` 供显式写入草稿。
4. **`BLOCKED_CURRENCY`**：
   - 引用合法，但 `quote.currency !== 'CNY'`（如 USD / RUB）；
   - **绝对不产生 `purchaseCostCny`**；
   - 保留原币原值（例如 `10 USD`、`1000 RUB`），供 UI 只读提示；
   - 一键采用按钮强制禁用。

---

## 4. 零汇率换算铁律 (No FX Conversion)

- `supplyCostBridge.js` 中严禁任何动态汇率换算逻辑（无 `rubPerCny`、无 `USD/CNY` 实时比价）；
- 原因：当前 `SupplierQuote` 未冻结建单时的汇率快照（`QUOTE_FX_SNAPSHOT = NONE`），若在读取时采用实时浮动汇率折算，会随市场汇率波动直接破坏历史报价的事实稳定性；
- 表现形式：非人民币报价在 UI 上仅以“原币原数值”展示（如 `10 USD`），**严禁错误拼接 `¥10 USD`**。

---

## 5. 采购成本边界与草稿辅助定位 (Purchase Cost Draft Boundary)

### 5.1 草稿辅助 (Draft Assistance) vs 字段锁死 (Quote Lock)
- 点击“采用正式供应报价”仅仅是将报价数值赋给当前 React Draft state（Ozon 的 `params.purchaseCost`，WB 的 `form.purchaseCost`）；
- **不锁死字段**：采用后，用户仍可根据实际商务沟通情况，手动将 `32` 修改为 `33.5`；最终生成的 `CostScenario` 冻结的是实际修改后的值（33.5），而非强制 Quote 原值；
- **状态提示清理**：用户一旦手动二次修改采购成本，界面清除“已采用正式报价”的反馈标签，防止误导。

### 5.2 采购成本口径边界
- 报价单价 `unitPriceCny` 仅为出厂单价草稿，**绝不等于国内到仓完整采购成本**；
- Ozon 端的 `domesticShipping`（国内段运费）、`labelingFee`（贴标费）；
- WB 端的 `chinaInbound`（国内送仓费）、`packagingCost`（包装材料费）；
- 以上独立字段在用户点击“采用正式供应报价”时**严格保持不变**，不得受到任何篡改。

### 5.3 附加成本不可分摊 (No Extra Cost Allocation)
- 模具费 `toolingFeeCny`、打样费 `sampleFeeCny` 属于参考信息，当前无结构化分摊公式，**严禁自动摊入 purchaseCost**；
- 包装规格 `packagingSpec` 属于非结构化文本，**严禁解析为包装成本**；
- 贸易条款 `exw` / `fob` 布尔标志仅作供应链记录，**严禁自动增扣运费**。

---

## 6. 人工确认门禁保持 (Cost Confirmation Required)

- 即使用户点击了“采用正式供应报价”，核算面板原有的“已确认采购成本及平台费用假设”人工复选框（`costConfirmed`）**仍然是保存成本场景的强制前提**；
- **`Apply ≠ Confirm`**：采用只是填入草稿，确认才是商业授权。未勾选时，[保存此方案到项目] 按钮保持禁用。

---

## 7. 历史成本场景不可变性 (Historical Scenario Immutability)

- 采用报价仅作用于当前正在编辑的临时草稿；
- 在用户点击“保存此方案到项目”之前，不写项目、不写供应商、不写任何持久化记录；
- 历史已保存的 `CostScenario` 字节完全冻结，项目后续切换供应方案或供应商追加新报价，绝不会回写历史场景中的 `inputPayload.purchaseCost`。

---

## 8. 遗留审计缺口说明 (Remaining Cost Provenance Gap)

- 当前 `CostScenario.inputPayload` 仅冻结实际计算输入数值（如 `purchaseCost: 32`）；
- 本轮未在 `CostScenario` 顶层扩展 `quoteId` / `supplierId` / `purchaseCostSource` 等溯源 Schema，以保证跨版本数据一致性与 Schema 稳定性；
- 该项作为 **`REMAINING_AUDIT_GAP`** 登记，若未来审计需要完整输入来源链条，将通过专门的 Cost Input Provenance 规范进行升级。

---

## 9. 自动化测试套件 (Test Suite)

专项测试文件：[`tests/ia-project-supply-cost-apply.test.mjs`](file:///d:/ozon/tests/ia-project-supply-cost-apply.test.mjs)
全量 42 项专项测试 100% 通过：
1. `supplyCostBridge.js` 纯函数独立存在且零副作用导入；
2. `NONE` / `INVALID_REFERENCE` / `APPLICABLE_CNY` / `BLOCKED_CURRENCY` 完整覆盖；
3. 严格引用一致性（跨项目、跨供应商、指针不一致拦截）；
4. 严格非负有限数值校验（拒绝字符串隐式转换）；
5. 零汇率逻辑验证；
6. `ProjectDetailPage` 严格通过 `project.supply.quoteId` 寻址，零 `max(version)` 猜测；
7. Ozon 与 WB projectContext 传递验证；
8. Ozon 与 WB 显式 Apply 纯净性（仅改 `purchaseCost`，其余费用不变）；
9. 非 CNY 报价按钮禁用与币种展示；
10. `costConfirmed` 流程保持；
11. 模具/打样/包装规格/EXW/FOB 隔离；
12. 引用不可变版本稳定性（追加 v2 不影响 v1 绑定）；
13. 项目间供应引用隔离；
14. 核心 Store、Adapter、Gate 无破坏性修改；
15. 4 项全链路行为集成测试（Apply 后可微调、版本固定、非 CNY 阻断、历史场景不可变）。
