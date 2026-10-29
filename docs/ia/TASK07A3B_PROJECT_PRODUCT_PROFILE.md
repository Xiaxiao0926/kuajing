# KUAIJING-IA-REFACTOR-V1 · TASK 07A-3B

## Project Product Profile V1 — Store + Editor + Audit 实施交付报告

> 本文档记录 TASK 07A-3B 实施落地的 Project Product Profile V1 数据契约、Store API、校验机制、UI 编辑器与审计跟踪。
> 
> **定位铁律**：`project.product` 是当前 Project 作用域下的过渡商品档案（Transitional Project-scoped Product Profile），承载单 SKU 事实。它**不是** Global Product Master，也**不是**最终的多 SKU 演进模型。

---

### 一、Product Profile V1 Schema

在 `ozon-react/src/utils/t6/productProfile.js` 中确立的 12 字段白名单契约：

```javascript
// project.product V1 数据结构
{
  // === A. Required Core (基础身份核心，必填非空字符串) ===
  nameZh: '高压发泡胶枪',              // string, 必填: 内部中文标准品名
  categoryLeaf: '发泡胶枪',            // string, 必填: 业务叶子类目

  // === B. Optional Core (规格、物理参数与属性) ===
  packageDimsCm: [25, 15, 8],          // [number, number, number] | null: 外包装尺寸 (长宽高 cm)
  grossWeightG: 450,                   // number | null: 含包装毛重 (g), 人工核实录入
  netWeightG: 320,                     // number | null: 裸机净重 (g), 人工核实录入
  productDimsCm: [20, 12, 5],          // [number, number, number] | null: 裸机本体尺寸 (cm)
  variantLabel: '黑色加强版',           // string: 规格/变体标识（人工输入，严禁自动推断）
  nameRu: 'Пистолет для пены',         // string: 俄语参考品名（非营销文案）
  brand: 'PINGPREM',                   // string: 品牌名称
  model: 'PP-FG01',                    // string: 产品型号/款号
  material: '铝合金 + 铜嘴',            // string: 主要材质/成分
  barcode: '6901234567890',            // string: 标准商品条码 (EAN-13 等)
}
```

- **不追加系统字段**：不添加 `product.id`, `product.updatedAt`, `product.schemaVersion`, `product.sourceSnapshotId`。项目级已有 `project.updatedAt` 与 `project.source.creationSnapshotId`。

---

### 二、Required / Optional 边界与类型校验 (Fail-close)

1. **Required Core**：
   - 仅 `nameZh` 与 `categoryLeaf` 为必填项。
   - 保存时必须满足 `String(val).trim() !== ''`，否则抛出异常拦截保存。
2. **Optional Strings**：
   - `variantLabel`, `nameRu`, `brand`, `model`, `material`, `barcode`。
   - 允许空字符串，保存前统一 `trim()`。类型必须为 `string`，非字符串直接抛错。
3. **重量字段 (Weights)**：
   - `grossWeightG`, `netWeightG`。
   - 仅允许 `null` 或大于 0 的有限正数（`finite positive number`）。
   - 严格拦截：`''`, `0`, 负数, `NaN`, `Infinity`, 字符串数字等隐式类型转换。
4. **尺寸字段 (Dimensions)**：
   - `packageDimsCm`, `productDimsCm`。
   - 仅允许 `null` 或恰好包含 3 个大于 0 有限正数的数组 `[L, W, H]`。
   - 严格拦截：长度不等于 3（如 `[30, 20]`）、含 0 或负数（如 `[30, 20, 0]`）、含字符串（如 `['30', 20, 10]`）。
5. **非法字段拦截 (Whitelist Fail-close)**：
   - 严禁商业字段进入 Product：`supplierName`, `factoryPriceCny`, `purchasePriceCny`, `moq`, `targetPriceRub`, `commissionRatePct`, `profit`, `marginPct`。
   - 严禁营销与合规字段进入 Product：`titleRu`, `bulletPoints`, `description`, `eacStatus`, `certificateNumber`。
   - 严禁平台 ID 与系统字段进入 Product：`ozonSkuId`, `wbNmId`, `id`, `projectId`, `createdAt` 等。

---

### 三、Snapshot 一次性本地 Draft 契约 (One-time Draft)

`buildInitialProjectProductDraft({ project, snapshot })` 仅在 `isProjectProductEmpty(project.product) === true` 时充当本地 React 表单的初始填充源：

1. **SCORING 快照**：
   - `nameZh` ← `snapshot.sourceInputs.name`
   - `categoryLeaf` ← `snapshot.sourceInputs.category_leaf`
   - `packageDimsCm = null`（前台爬虫尺寸口径未确认，未自动带入）
   - `grossWeightG = null`, `netWeightG = null`（爬虫重量未区分毛净重，未自动带入）
2. **MARKET_VALIDATION 快照**：
   - `nameZh` ← `snapshot.sourceInputs.name`
   - `categoryLeaf` ← `snapshot.sourceInputs.category_leaf`
   - `packageDimsCm` ← `snapshot.sourceInputs.dims`（**安全物理数组**，必须为 3 个有限正数数组；**严禁**直接使用 `procurementEvidence.dims` 原始 Quote 字符串）
   - `grossWeightG = null`, `netWeightG = null`（即使 `procurementEvidence.weightG` 存在，由于 UI 净重标签与物流算费用途存在语义冲突，严格保持 null）
3. **variantLabel 保护**：
   - 严格初始化为空字符串 `''`。
   - **严禁**从 `project.name`、`candidateName` 或标题中通过字符串模式猜测（如 `'黑色'`、`'10mil'`、`'2件套'`）。
4. **非持续同步原则 (Non-continuous Sync)**：
   - 一旦用户完成首次保存，`isProjectProductEmpty(project.product)` 即变为 `false`；
   - 之后再次打开工作台或刷新页面，**必须直接读取 `project.product` 作为事实**，绝不再次调用 Snapshot 覆盖或回滚用户已维护的数据。

---

### 四、物理语义安全保护 (Semantic Protection)

1. **重量冲突保护**：
   - 确立 `MARKET_VALIDATION_WEIGHT_SEMANTICS = CONFLICTED`；
   - 避免将尚未澄清的 Phase 5 重量直接注入 Product 的物流毛重或净重字段；
   - UI 明确显示“人工确认”与口径冲突提示，确保由人工核验样品后录入。
2. **外包装尺寸保护**：
   - 确认 Market Validation `snapshot.sourceInputs.dims` 为解析后的 `[L, W, H]` (cm)；
   - 杜绝向 `packageDimsCm` 赋值未解析的 Quote 字符串。

---

### 五、Product Mutation API & 决策日志审计

在 `t6Store.js` 导出：
```javascript
export function updateProjectProduct(projectId, patch, { by = 'user', reason = '' } = {})
```

1. **执行事务**：
   - 检查项目是否存在；
   - 调用 `buildNextProjectProduct({ current: project.product || {}, patch })`；
   - 支持 Partial Patch（仅修改部分字段，其他既有字段完整保留）；
   - 计算真实变更字段 `changedFields`。
2. **No-op 保护**：
   - 若 `changedFields.length === 0`，不写 Store，不记 Log，直接返回原 Project。
3. **审计追溯 (`product_update` DecisionLog)**：
   - 变更时调用 `appendLog` 记录：
     - `kind: 'product_update'`
     - `subjectType: 'project'`, `subjectId: projectId`, `projectId`
     - `by`: 保留调用者身份
     - `from`: 紧凑 JSON 字符串，**仅包含变更字段的旧值**
     - `to`: 紧凑 JSON 字符串，**仅包含变更字段的新值**
     - `reason`: 用户指定 reason 或自动生成 ``更新商品档案：${changedFields.join(', ')}``
   - 绝不将整个 Project JSON 塞进日志。

---

### 六、领域职责与命名隔离

1. **Product Name vs Project Name 分离**：
   - `project.name`：项目管理与工作台的人类可读标题（如包含变体后缀 `'家用手套-黄色M码'`）；
   - `project.product.nameZh`：该 SKU 的内部官方中文品名档案（如 `'家用乳胶手套'`）；
   - 修改 `nameZh` 绝不联动修改 `project.name`。
2. **Product Category vs Source Category 分离**：
   - `project.source.category`：立项时点的历史来源分类证据，永久不可变；
   - `project.product.categoryLeaf`：当前有效业务品类归属；
   - 修改 `categoryLeaf` 绝不反写 `project.source.category`。
3. **与其他领域隔离**：
   - 更新 Product 绝不改动 `project.suppliers`, `project.samples`, `project.supply`；
   - 更新 Product 绝不改动 `project.costing`, `project.logistics`；
   - 更新 Product 绝不改动 `workflow`, `stage`, `lifecycleStatus`；
   - 更新 Product 绝不改动不可变 Snapshot。

---

### 七、UI 工作台：ProductProfileEditor

实现于 `ozon-react/src/components/t6/ProductProfileEditor.jsx`，替换 `ProjectDetailPage.jsx` 的占位容器：

1. **输入与显式保存**：
   - 采用 React 局部表单状态，允许操作者自由编辑输入；
   - 提供独立“保存商品档案”按钮，点击后执行严格 normalize 与校验，再调用 `updateProjectProduct`；
   - 禁用任何 onChange / onBlur 自动静默保存；
   - 提供“重置未保存修改”按钮，恢复到最近保存状态或初始草稿。
2. **输入分组**：
   - **基础身份与通用属性**：中文标准品名 *、叶子类目 *、变体规格说明、俄语参考品名、品牌、型号、材质、商品条码；
   - **包装与物流事实**：外包装尺寸 (L/W/H cm)、含包装毛重 (g，标明人工确认)、裸机净重 (g，标明人工确认)；
   - **产品本体规格**：裸机本体尺寸 (L/W/H cm)。
3. **提示与向导**：
   - 未建档时展示醒目引导 Banner；
   - SCORING 来源提示重量尺寸未决；
   - MARKET_VALIDATION 来源提示已安全带入外包装尺寸草稿、重量待人工确认。

---

### 八、下游集成边界与多 SKU 演进

1. **未接入 Costing**：
   - 本轮暂不修改 `costScenarioAdapter.js`、`OzonCalc.jsx` 或 `WBCalc.jsx`；
   - 核算面板继续使用既有 Snapshot prefill，保持 Calculator 行为稳定；
   - Product → Costing 的数据消费留待后续专门任务处理。
2. **未接入 Gate**：
   - `gateEngine.js` 保持零修改；
   - 不创造虚构的 `product_complete` 或 `sku_ready` Stage Gate。
3. **Multi-SKU 演进定位**：
   - 当前系统的业务粒度为 `ONE_SKU_PROJECT`；
   - `project.product` 作为过渡模型，未来在演进为 `Project → N SKUs` 时：
     **EXPLICIT MIGRATION / MAPPING MAY BE REQUIRED（很可能需要显式迁移或映射）**；
   - 本轮仅保证 V1 模型在 Project 作用域内结构清晰，不阻断未来独立 SKU 实体表的引入。

---

### 九、自动化验证矩阵

已创建专项测试 `tests/ia-project-product-profile.test.mjs`，并通过全部 43 项测试，同时通过全仓现有回归套件：

```text
node tests/ia-project-product-profile.test.mjs    ✅ 43/43 PASS
node tests/ia-project-supply-gate.test.mjs        ✅ 24/24 PASS
node tests/ia-project-supply-chain-ui.test.mjs    ✅ 26/26 PASS
node tests/ia-candidate-project-launch.test.mjs   ✅ 20/20 PASS + E2E
node tests/ia-dual-snapshot-project-gate.test.mjs ✅ 19/19 PASS
npm run test:t6                                   ✅ 130/130 PASS
npm test                                          ✅ React 65 + Python 44 + Golden 56 PASS
npm run test:golden                               ✅ 76/76 PASS
npm run test:sync                                 ✅ 双端对拍零差异 PASS
npm run test:web-persistence                      ✅ 完整通过
npm --prefix ozon-react run build                 ✅ Vite 生产构建成功
```
