# KUAIJING-IA-REFACTOR-V1 · TASK 07A-3C
# Project Product Profile → Costing Prefill Overlay 架构规格与落地报告

## 1. 概述与核心目标 (Overview & Objectives)

在项目推进流程中，商品物理参数（品名、包装毛重、包装尺寸）会经历从立项参考到打样/采购实测的演进。
- **历史痛点**：项目创建后，用户在商品档案（Product Profile）中录入了真实打样或实测物理事实，但在打开 Ozon / WB 成本核算器时，预填数据仍然只读取立项快照（Creation Snapshot）中的初始或预估数据，造成物理参数错位。
- **本任务核心目标**：让 Project 当前已保存的人工确认商品档案（`project.product`），在用户新建 Ozon / WB 核算草稿时，安全覆盖 Creation Snapshot 中已过时的物理事实。
- **核心约束**：
  1. 仅影响**新打开的核算面板草稿默认值（Calculator Draft Prefill）**；
  2. 严禁篡改任何已保存的历史 `CostScenario`（不可变冻结快照）；
  3. 严禁反向污染 `Creation Snapshot`、`SupplierQuote`、`productProfile` 或成本引擎公式。

---

## 2. 预填优先级契约 (Prefill Priority Contract)

核算器打开时，预填数据按照严格的单向优先级装配：

```text
Project Product Profile (当前已保存有效字段)
        ↓ 优先覆盖 (Override)
Creation Snapshot (立项快照 sourceInputs 历史数据)
        ↓ 用户核算面板手工编辑 (User Editing)
Calculator Draft (当前核算草稿)
        ↓ 保存操作冻结 (Freeze)
CostScenario (不可变历史场景)
```

- **单向无回流**：`CostScenario` 绝不反向同步到 `project.product` 或 `snapshot`；修改 `project.product` 绝不联动修改已存在的 `CostScenario`。
- **纯适配层**：`costScenarioAdapter.js` 保持纯函数适配层，不读取任何 Store，不包含任何外部状态，由上层编排组件（`ProjectDetailPage.jsx`）显式传入 `product: project.product`。

---

## 3. 字段覆盖规则与物理边界 (Field Overrides & Boundaries)

仅允许 `project.product` 中具有明确物流核算语义的 **3 个物理字段** 参与覆盖：

| Product 字段 | 目标平台 | 核算预填字段 | 转换规则 / 约束 | Fallback 行为 (无效或缺失时) |
|---|---|---|---|---|
| `nameZh` | Ozon & WB | `productName` | 必须为非空字符串 (`trim().length > 0`) | 回退到 `snapshot.sourceInputs.name ?? ''` |
| `grossWeightG` | Ozon | `weight` | 必须为有限正数 (`> 0`)，单位换算 **克 → 千克** (`grossWeightG / 1000`) | 回退到 `snapshot.sourceInputs.weight_kg ?? ''` |
| `grossWeightG` | WB | `actualWeightG` | 必须为有限正数 (`> 0`)，单位保持 **克** | 回退到 `Math.round(weight_kg * 1000)` 或 `''` |
| `packageDimsCm` | Ozon | `length, width, height` | 必须为长度为 3 的有效正数数组 `[L, W, H]` | 回退到 `snapshot.sourceInputs.dims[0..2]` 或 `''` |
| `packageDimsCm` | WB | `lengthCm, widthCm, heightCm` | 必须为长度为 3 的有效正数数组 `[L, W, H]` | 回退到 `snapshot.sourceInputs.dims[0..2]` 或 `''` |

### 严格禁区与隔离铁律

1. **净重绝不用于运费 (Net Weight Boundary)**：
   `netWeightG` 是商品裸重，严禁用于 Ozon 运费计费重或 WB `actualWeightG`。若 `grossWeightG` 缺失或无效，即使 `netWeightG` 存在，也必须回退到 Snapshot 物流重量，绝不得使用净重代替物流重。
2. **裸机尺寸绝不用于物流尺寸 (Product Dimensions Boundary)**：
   `productDimsCm` 是商品物理本体尺寸，物流计费严格使用外包装尺寸 `packageDimsCm`。若 `packageDimsCm` 缺失或无效，即使 `productDimsCm` 存在，也必须回退到 Snapshot 尺寸，绝不得使用裸机尺寸充当包装尺寸。
3. **商业与采购字段绝不被 Product 覆盖 (Commercial Fields Boundary)**：
   - 售价：Ozon `price` / WB `sellerRevenueRub` 继续保持读取 `snapshot.sourceInputs.price_rub`。
   - 采购成本：Ozon 预填保持留空 `''`，WB 默认保持 `0` / 用户输入，严禁自动读取 `SupplierQuote` 或 `project.supply` 预填采购成本。
   - 平台佣金：Ozon 保持读取 `snapshot.sourceInputs.commission_rfbs`，WB 严禁预填佣金（由用户在面板按类目选择）。

---

## 4. 容错与向后兼容契约 (Fault Tolerance & Backward Compatibility)

- **逐字段独立覆盖 (Independent Field Fallback)**：
  不要求商品档案所有字段均完整。例如若仅填写了 `nameZh` 和 `packageDimsCm`，而 `grossWeightG` 为 `null`，则名称与尺寸使用 Product 覆盖，重量安全回退到 Snapshot。
- **Safe-Ignore 异常数据 (No-Throw Policy)**：
  若遇到异常遗留数据（如字符串 `'500'`、零或负数 `0`、`NaN`、`Infinity`、畸形数组 `[30, 20]` 等），适配器静默忽略该字段并安全回退到 Snapshot，严禁在预填适配阶段抛错阻断页面渲染。
- **空 Product 完全兼容**：
  若 `product` 为 `null`、`undefined` 或 `{}`，预填输出与 TASK 07A-3C 之前完全一致，字节语义 100% 保持。

---

## 5. 历史 CostScenario 严格不可变 (Historical Scenario Immutability)

- **场景创建时点冻结**：`createCostScenario` 生成的场景记录包含其独立的 `inputPayload`、`resolvedConfig` 与 `outputPayload`。
- **零联动**：后续更新 `project.product`（例如重量由 400g 修改为 500g），历史保存的 Scenario A 其 `inputPayload.actualWeightG` 依然保持为当时的 400g，历史记录的哈希与字节严格不可变。
- **无 Product Version Entity**：本轮不引入过度设计的 Product Version Entity，`sourceSnapshotId` 继续表示立项历史事实来源快照，具体核算参数已在 `inputPayload` 中完整冻结。

---

## 6. 前端集成与 UI 提示 (UI Integration)

在 `ProjectDetailPage.jsx` 中：
1. **预填挂载**：在 Costing Tab 中调用 `buildOzonPrefill({ snapshot, product: project.product })` 与 `buildWbPrefill({ snapshot, product: project.product })`。
2. **轻量提示**：当 `project.product` 至少存在一项有效物理覆盖（`nameZh`、`grossWeightG`、`packageDimsCm`）时，在成本核算按钮旁展示提示文案：
   > “新核算将优先使用已保存商品档案中的当前物理参数。”
3. **不做虚假完整性声明**：不提示“已使用完整商品档案”，避免用户误解部分空字段的状态。

---

## 7. 专项测试与全量回归矩阵 (Verification Matrix)

新增专项测试套件 `tests/ia-project-product-cost-prefill.test.mjs`，包含 36 项全面覆盖：

1. `buildOzonPrefill` 历史 snapshot-only 调用保持兼容
2. `buildWbPrefill` snapshot-only 调用保持兼容
3. `product: null` 不改变 Ozon 预填
4. `product: {}` 不改变 Ozon 预填
5. `product: null` 不改变 WB 预填
6. `product: {}` 不改变 WB 预填
7. `nameZh` 覆盖 Ozon 商品名
8. `nameZh` 覆盖 WB 商品名
9. 空 `nameZh` fallback Snapshot
10. `grossWeightG` 覆盖 Ozon 重量并 g→kg (500g -> 0.5kg)
11. `grossWeightG` 覆盖 WB `actualWeightG` (500g)
12. `netWeightG` 不覆盖物流重量 (严禁净重用于运费)
13. `packageDimsCm` 覆盖 Ozon L/W/H
14. `packageDimsCm` 覆盖 WB L/W/H
15. `productDimsCm` 不覆盖物流尺寸 (严禁裸机尺寸用于物流运费)
16. 单独 name 可覆盖，其它 fallback
17. 单独 weight 可覆盖，其它 fallback
18. 单独 dims 可覆盖，其它 fallback
19. string `grossWeightG` 被忽略并安全 fallback
20. 0 或负数 `grossWeightG` 被忽略并安全 fallback
21. Infinity / NaN `grossWeightG` 被忽略并安全 fallback
22. malformed packageDims 被忽略并安全 fallback
23. packageDims 字符串数组或非法数字被忽略并安全 fallback
24. product 不覆盖售价
25. product 不覆盖佣金
26. product 不覆盖采购成本 (保持留空，不虚构)
27. ProjectDetail Ozon 传 `project.product` 源码契约成立
28. ProjectDetail WB 传 `project.product` 源码契约成立
29. adapter 不 import `t6Store` 纯适配契约成立
30. `costScenarioAdapter` 不写 Product 契约成立
31. `t6Store` 未被修改为依赖 prefill
32. `ProductProfileEditor` 未修改
33. `gateEngine` 未被修改为依赖 prefill 或 product
34. 历史 Scenario 不变测试（Current Product ≠ Historical Scenario Mutation）
35. MV 场景特别测试（未确认沿用立项参考，确认后当前事实覆盖历史参考）
36. Scoring 场景特别测试（Product 未填时 legacy Snapshot fallback 完整保持）

### 回归执行结果

- `ia-project-product-cost-prefill.test.mjs`: 36/36 通过
- `ia-project-product-profile.test.mjs`: 43/43 通过
- `ia-project-supply-gate.test.mjs`: 24/24 通过
- `ia-project-supply-chain-ui.test.mjs`: 26/26 通过
- `ia-candidate-project-launch.test.mjs`: 20/20 + E2E 通过
- `ia-dual-snapshot-project-gate.test.mjs`: 19/19 通过
- `npm run test:t6`: 204/204 通过 (CostScenario 74, WB Cost 53, T6 UI 26, T7 Store 43, Factory trial 8)
- `npm test`: 65 React + 44 Python + 56 Scoring Golden 通过
- `npm run test:golden`: 76/76 通过
- `npm run test:sync`: 双端对拍零差异通过
- `npm run test:web-persistence`: 24 market reports + deploy safety 通过
- `npm --prefix ozon-react run build`: Vite build 成功
