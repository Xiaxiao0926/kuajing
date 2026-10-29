# KUAIJING-IA-REFACTOR-V1 · TASK 07A-2A

## T7 Project Supply Chain Workspace 实施与契约交付文档

> 本文档记录 TASK 07A-2A 的实施细节：将 SKU Project Workspace (`ProjectDetailPage.jsx`) 的 `suppliers` Tab 从占位符升级为完整的 Project-scoped 供应链工作台 (`ProjectSupplyChainPanel.jsx`)。

---

### 1. 架构目标与职责边界

在 TASK 07A-1R 审计确认“T7 供应链 Store 具备完整模型与测试，仅前端 UI 缺失”的前提下，本任务完成了供应链工作台的端到端交互闭环：
- **事实源**：全部直接调用 `t6Store.js` 导出的 T7 公共 API，无任何本地复制缓存或第二事实源。
- **作用域**：严格绑定 `projectId`，跨项目供应商与报价实现物理隔离。
- **不可变性**：报价版本仅追加（Append-only），旧版本只读不可变；打样状态机遵循单向约束，终态不可回退。
- **阶段边界**：本阶段**不修改任何 Gate 逻辑**，不修改 `gateEngine.js`，不与 Phase 5 (MI 采购询价) 发生自动导入关联，保持 `NO_BRIDGE`。

---

### 2. T7 Store Contracts（底层 API 契约与使用清单）

| 业务实体 | 调用 API | 语义与约束 |
| :--- | :--- | :--- |
| **供应商** (Supplier) | `getProjectSuppliers(projectId)` | 按项目 ID 过滤供应商列表，返回包含 `id, name, contact, quotes, notes` 的数组。 |
| | `createSupplier({ projectId, name, contact, notes })` | 新增供应商，自动分配 UUID，追加到 `project.suppliers`，生成 `supplier_create` 决策日志。 |
| | `updateSupplier(id, { name, contact, notes })` | 仅允许修改白名单字段（`name, contact, notes`），绝不改动 `id, projectId, quotes, createdAt`。 |
| **报价版本** (Quote) | `getSupplierQuotes(supplierId)` | 按供应商读取报价树，按版本升序或降序排列。 |
| | `createSupplierQuote({ supplierId, unitPriceCny, currency, moq, exw, fob, packagingSpec, toolingFeeCny, sampleFeeCny, leadTimeDays, paymentTerms, remark })` | 追加不可变报价版本，Store 自动自增版本号（v1→v2）；严禁 payload 携带系统字段；旧版本只读，无修改/无删除 API。 |
| **打样记录** (Sample) | `getProjectSamples(projectId)` | 读取项目下全部打样记录。 |
| | `createSampleRecord({ projectId, supplierId, quoteId, status: 'ordered', trackNo, testResult, notes })` | 创建打样记录，初始状态强校验为 `ordered`；强校验 `supplierId` 与 `quoteId` 跨实体归属一致性。 |
| | `updateSampleRecord(id, patch)` | 状态机流转：`ordered` → `arrived` → `tested` → `approved` 或 `rejected`。终态冻结，跳级或回退均被 Store 拒绝。 |
| **正式供应方案** | `setProjectSupply(projectId, { supplierId, quoteId, by, note })` | 引用型绑定，将正式供应商及选定报价锁定在 `project.supply`，写入 `supply_plan_change` 审计日志。 |
| | `clearProjectSupply(projectId)` | 清除正式方案，将 `project.supply` 置为 `null`，写入 `supply_plan_change` 审计日志。 |

---

### 3. Project-scoped Isolation（项目隔离性保证）

- `ProjectSupplyChainPanel` 仅接收 `projectId` 与 `onChanged` 回调。
- 所有数据读取（`getProjectSuppliers(projectId)`, `getProjectSamples(projectId)`）均基于 `projectId`，绝不跨项目串扰。
- 测试验证（`ia-project-supply-chain-ui.test.mjs` TEST 17）：
  - Project A 与 Project B 分别创建供应商，`getProjectSuppliers(A)` 中永远不会出现 Project B 的供应商；反之亦然。
- 跨项目引用阻断（TEST 25）：
  - Project A 尝试将 Project B 旗下的供应商/报价绑定为正式供应方案时，Store 立即 fail-close 抛错拦截。

---

### 4. Supplier CRUD Boundary（供应商管理边界）

- **支持的操作**：
  - 新增供应商（表单：名称、联系方式、备注）。
  - 编辑供应商（修改名称、联系方式、备注）。
- **不支持的操作（严格禁止）**：
  - **无删除操作（No Delete）**：Store 并未暴露 `deleteSupplier`，UI 层完全不呈现任何删除按钮，不伪造前端软删除。
  - **无系统字段修改**：禁止修改 `projectId`, `quotes`, `createdAt`, `id`。

---

### 5. Immutable Quote Versions（不可变报价版本树）

- 选中任一供应商后，右侧展示其专属报价版本树。
- 明确突出版本标识（`v1`, `v2`, `v3`...）、人民币单价（`¥...`）、币种、起订量（MOQ）、贸易条款（EXW/FOB）、交期、模具费与样品费。
- **不可变性铁律**：
  - 历史报价不可编辑、不可覆盖、不可删除。
  - 修改报价的唯一途径是点击「新增报价版本」，由 Store 自动自增版本号（`max + 1`），旧版本字节保持 100% 不变。
  - 前端表单严禁输入 `version`, `id`, `createdAt`, `supplierId`。

---

### 6. Sample State Machine（样品打样状态机）

- 样品打样记录严格遵循 T7 单向物理流转状态机：
  ```text
  ordered (已下单)
    ↓ [标记到样]
  arrived (已到样)
    ↓ [完成测试 / 录入测试结果]
  tested (已测试)
    ├─ [通过] → approved (终态冻结)
    └─ [淘汰] → rejected (终态冻结)
  ```
- 初始创建时，状态强制由 Store 赋予 `ordered`，UI 不允许直接创建后续状态。
- 非法跳级（如 `ordered` 直接跳到 `approved`）由 Store 拦截并抛出错误信息，UI 实时展示错误通知。
- 到达终态（`approved` / `rejected`）后，操作列显示“终态冻结”，不再提供任何流转按钮。

---

### 7. Supply Plan Binding（正式供应方案绑定与清除）

- 工作台顶栏直观呈现当前项目的正式供应方案（`project.supply`）。
- **初始未选定**：
  - `project.supply === undefined` 时，展示空状态提示：“尚未确定正式供应方案”，指导用户在下方报价列表中进行选定。
- **选定与切换**：
  - 在任意供应商的有效报价卡片上点击「设为正式方案」，调用 `setProjectSupply` 即可完成锁定或无缝切换。
  - 顶栏立即展示正式供应商名称、报价版本号、单价、MOQ、交期、选定时间与备注。
- **清除方案（二次显式确认）**：
  - 点击「清除供应方案」后进入安全确认态（显示“确认清除？”及红色的“确认清除”和“取消”按钮），杜绝误触。
  - 确认后调用 `clearProjectSupply(projectId)` 将 `project.supply` 置为 `null` 并记录日志。

---

### 8. No Phase 5 Bridge & No Gate Change（边界与隔离）

- **零 Phase 5 关联**：
  - `ProjectSupplyChainPanel.jsx` 严格未导入 `miStore.js`、`procurementIdentity.js`，亦未读取 `mi_manual_procurement_quotes`。
  - 当前遵守 `CURRENT BRIDGE: NO_BRIDGE` 铁律，不提供“一键从 Phase 5 导入”等跨域未决逻辑。
- **零 Gate 逻辑改动**：
  - 未修改 `gateEngine.js`，未修改 `SAMPLING` 检查逻辑。
  - Gate 保持现有纯评估器状态（`kind: 'module'` 保持 `NOT_EVALUATED`），待 07A-2B 专程实现上下文数据注入。
- **零成本场景修改**：
  - 选定供应方案时，绝不自动覆盖既有 `CostScenario` 的采购成本，保持成本快照的不可变性。

---

### 9. Tests（专项与回归验证）

- 新建专项测试：`tests/ia-project-supply-chain-ui.test.mjs`
  - 覆盖 16 项静态契约检查（组件存在、挂载位置、API 导入、无 delete、无 Phase5 依赖、Gate 纯净性）。
  - 覆盖 10 项 Store 运行时行为测试（项目隔离、不可变版本、状态机流转、非法跳级拦截、跨项目引用拦截）。
  - 结果：**26/26 全部通过**。
- 回归测试：
  - `npm run test:t6`：**130/130 全部通过**。
  - `npm test`：React 65 项 + Python 44 项全绿。
  - `npm run test:golden`：56 项评分 + 76 项核算黄金案例全绿。
  - `npm run test:sync`：双端对拍零差异通过。
  - `npm --prefix ozon-react run build`：生产构建一次性成功。

---

### 10. Remaining Gate Gap（待在 07A-2B 解决的缺口）

目前 `SAMPLING` Stage Gate 的 `supplier_quote` 检查仍为 `NOT_EVALUATED`。
下一步 TASK 07A-2B 将：
1. 在 `ProjectDetailPage.jsx` 计算出当前项目是否具备已录入的供应商报价（例如 `suppliers.some(s => s.quotes.length > 0)`）或正式供应方案。
2. 通过 `deps.availableModules` 或 context 注入给 `evaluateProjectGate(project, targetStage, deps)`。
3. 保持 `gateEngine.js` 纯评估器原则，正式将 `SAMPLING` Gate 真实求值解锁为 `PASS / FAIL`！
