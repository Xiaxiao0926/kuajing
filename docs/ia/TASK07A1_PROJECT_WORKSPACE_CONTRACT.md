# KUAIJING-IA-REFACTOR-V1 · TASK 07A-1R

## SKU Project Workspace 模块与上下文契约审计报告（修订版）

> 本报告为 TASK 07A-1 的严格事实纠偏与契约基线文档。基于当前源码（`ProjectDetailPage.jsx`、`t6Store.js`、`gateEngine.js`、`candidateProjectEvidence.js` 等）进行逐行事实核验，删除所有未经决定的未来设计字段，仅记录系统真实存在的代码事实、契约状态、成熟度等级与功能落差。

---

### 1. Corrected Current Facts（详情页现状事实审计）

**代码事实源**：`ozon-react/src/components/t6/ProjectDetailPage.jsx`（共 561 行）

#### 1.1 页面整体拓扑与布局
当前 `ProjectDetailPage` 采用双栏工作区拓扑：
- **顶部 Header**（Lines 209–222）：
  - 呈现项目名称 `project.name` 与代号 `project.projectCode · project.marketCode`。
  - 提供生命周期操作：`DRAFT`（启动）→ `ACTIVE`（暂停/归档/淘汰）→ `PAUSED`（恢复/归档/淘汰）。
- **顶层 Context 证据看板**（Lines 224–265）：
  - 依据 `resolveSnapshotKind(snapshot)` 动态分流渲染两类合法立项证据：
    - `SCORING`：展示选品评分 `ScoreCell`、决策建议 `DecisionBadge`、市场上下文深度 `ContextBadge`、立项时间及规则版本号。
    - `MARKET_VALIDATION`：展示“市场验证立项”徽章、采购事实摘要（供应商名称、出厂价 ¥、实测单重 g、包装尺寸、目标售价 ₽）及证据 Schema 版本号。
- **主工作区网格布局**（Lines 267–558）：
  - 左侧主区域（`1fr`）：Tab 导航容器，当前定义 6 个 Tab 项（`overview`, `product`, `suppliers`, `costing`, `compliance`, `operations`）。
  - 右侧固定栏（`360px`）：36 节点独立 Workflow Timeline，按 `roadmap-v1` 模板渲染 7 个 Phase 的节点列表，支持节点状态下拉切换（`pending/active/done/skipped`）与备注失焦保存。

#### 1.2 6 个 Tab 的实际实现真实度

| Tab Key | Tab 标签 | 实际实现状态 | 源码交互与能力事实 |
| :--- | :--- | :--- | :--- |
| `overview` | 概览 | **已实现** | 包含前向/后向 Stage Gate 评估面板（`evaluateProjectGate`）、推进/回退操作按钮、阻断/警告列表、以及按时间倒序排列的不可变 `decisionLog` 时间轴。 |
| `product` | 产品 | **纯文本占位** | 仅显示居中文案：`PLACEHOLDERS.product = '产品定义域将在后续版本接入'`。 |
| `suppliers` | 供应链 | **纯文本占位** | 仅显示居中文案：`PLACEHOLDERS.suppliers = '供应商管理将在 T7 接入'`。底层 Store API 完备，但前端未接。 |
| `costing` | 成本与物流 | **已实现** | 支持双平台核算上下文切换：集成 `OzonCalc` 与 `WBCalc`，支持读取立项快照预填；支持生成不可变成本场景快照（`createCostScenario`）；支持设为项目基线；提供跨平台方案对比表（利润/毛利率对比）。 |
| `compliance` | 合规 | **纯文本占位** | 仅显示居中文案：`PLACEHOLDERS.compliance = '合规数据域将在后续版本接入'`。 |
| `operations` | 运营 | **纯文本占位** | 仅显示居中文案：`PLACEHOLDERS.operations = '订单 / 库存 / 广告数据将在 T8 接入'`。 |

---

### 2. Snapshot / Project Schema Corrections（快照与项目真实 Schema 核验）

#### 2.1 Scoring Snapshot 物理参数的真实存储路径
- **源码事实**：在 `t6Store.js` `buildScoringSnapshot` (Lines 143–170)，商品物理事实与市场输入**严格保存在 `snapshot.sourceInputs`**，绝非 `snapshot.canonical.*`（`canonical` 仅为函数运行入参，未持久化为快照顶层键）。
- **持久化路径**：
  - 重量：`snapshot.sourceInputs.weight_kg`
  - 尺寸：`snapshot.sourceInputs.dims`
  - 价格与佣金：`snapshot.sourceInputs.price_rub`、`avg_price_rub`、`commission_rfbs`、`commission_fbo`、`commission_fbs`、`commission_fbp`
  - 类目：`snapshot.sourceInputs.category_leaf`、`category_full`
- **Market Validation 快照**：物理参数保存在 `snapshot.procurementEvidence = { supplierName, factoryPriceCny, weightG, dims, targetPriceRub, notes }`。

#### 2.2 `createProject` 的真实初始 Schema 核验
- **源码事实**：在 `t6Store.js` `createProject` (Lines 356–376)，初始生成的 project 对象结构为：
```javascript
{
  id: uuid(),
  projectCode: nextProjectCode(),
  marketCode: 'RU',
  schemaVersion: 1,
  name: name || candidate.candidateName,
  source: {
    kind: 'candidate',
    candidateId: candidate.id,
    sourceProductId: candidate.sourceProductId,
    candidateName: candidate.candidateName,
    category: candidate.categoryLeaf,
    creationSnapshotId: creationSnapshot.id,
  },
  lifecycleStatus: 'DRAFT',
  stage: 'PIPELINE',
  goLiveAt: null,
  workflow: {
    templateVersion: 'roadmap-v1',
    states: initWorkflowStates(), // 36 节点初始数组
  },
  product: {},
  suppliers: [],
  samples: [],
  compliance: {},
  costing: { scenarios: [], baselineScenarioId: null },
  logistics: {},
  listing: {},
  launch: {},
  operations: {},
  settlement: {},
  decisionLog: [],
  createdAt: now,
  updatedAt: now,
}
```
- **关键事实纠偏**：
  - **`supply` 字段在 `createProject()` 创建时根本不存在（`undefined`），绝非 `supply: null`**。
  - `supply` 仅在首次调用 `setProjectSupply(projectId, args)` 时才会动态写入对象 `{ supplierId, quoteId, selectedAt, selectedBy, note }`。
  - 调用 `clearProjectSupply(projectId)` 时，`supply` 才被设置为 `null`。
  - 该表现已被单元测试 `supplier.test.mjs` S9 显式锁定：旧项目或新建项目在未设置前 `project.supply === undefined`。

---

### 3. Phase5 vs T7 Current Bridge（选品询价与正式供应关系事实）

```text
CURRENT BRIDGE: NO_BRIDGE
```

- **事实依据**：
  - Phase 5 采购询价（`mi_manual_procurement_quotes`）保存在 `miStore.js`，按 `nicheUid` / `nicheName` 索引，属于市场调研初筛层扁平字典。
  - T7 Project Supplier（`t6.supplier.*` / `t6.supplierQuote.*` / `t6.sample.*`）保存在 `t6Store.js`，按 UUID 实体索引，具备项目 ID 绑定、版本自增（v1..vn）、单向打样状态机与审计日志。
  - **全仓源码没有任何从 Phase 5 自动调用 `createSupplier` 或 `createSupplierQuote` 的转换桥梁代码**。
  - 两个体系当前在物理存储、实体身份、数据结构与调用链上完全解耦。

---

### 4. Component Context Matrix（存量组件上下文矩阵）

| Component | Current Scope | Current Persistence | Project-aware | Minimal Change | Integration Class |
| :--- | :--- | :--- | :---: | :--- | :--- |
| `ProductDefinition.jsx` | Global Static | None | NO | `DATA_MODEL_GAP` | `PLACEHOLDER_ONLY` |
| `Legacy SupplyChain.jsx` | Global Directory | `supply-chain-factories` (localStorage / Excel) | NO | `DATA_MODEL_GAP` | `NO_EXISTING_MODULE` |
| `T7 Project Supplier Store` | Project-scoped | `t6.supplier.*`, `t6.supplierQuote.*`, `t6.sample.*` | YES | `WRAPPER` | `PROJECT_NATIVE` |
| `CostQuote.jsx` | Global Directory | `cost-quote-data` (localStorage / Excel) | NO | `DATA_MODEL_GAP` | `NO_EXISTING_MODULE` |
| `ComplianceAssessment.jsx` | Global Singleton | IndexedDB `ozon-compliance`, localStorage `compliance-items` | NO | `WRAPPER` | `CONTEXTUAL_WRAPPER` |
| `ListingContent.jsx` | Global Static | None | NO | `DATA_MODEL_GAP` | `NO_EXISTING_MODULE` |
| `OzonCalc.jsx` | Hybrid (Global / Project) | `t6.costScenario.*` (via `onSaveScenario`) | YES | `NONE` | `DIRECT_EMBED` |
| `WBCalc.jsx` | Hybrid (Global / Project) | `t6.costScenario.*` (via `onSaveScenario`) | YES | `NONE` | `DIRECT_EMBED` |
| `ProjectFlow.jsx` | Global Fixed 6 Products | `project-flow-data-v2` | NO | `DATA_MODEL_GAP` | `NO_EXISTING_MODULE` |

---

### 5. Target Workspace Matrix（正式目标工作区矩阵）

| Target Domain | Current Capability | Data Owner | Identity | Integration Class | Maturity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **概览** | Stage Gate 前向/后向评估面板、生命周期流转、不可变 DecisionLog 时间轴 | `project`, `gateEngine`, `t6.log.*` | `project.id` | `PROJECT_NATIVE` | `READY` |
| **商品与 SKU** | 仅 Tab 文本占位；全局有静态教学组件 `ProductDefinition`（无输入/无持久化） | `project.product`（目前为 `{}`） | `project.id` | `PLACEHOLDER_ONLY` | `EMPTY` |
| **供应链** | Store 层具备 Supplier、不可变 SupplierQuote、Sample 状态机与 project.supply；前台仅文本占位 | `t6.supplier.*`, `t6.supplierQuote.*`, `t6.sample.*`, `project.supply` | `t6.supplier.<uuid>` 等（Scoped by `projectId`） | `PLACEHOLDER_ONLY` | `PARTIAL` |
| **合规** | 仅 Tab 文本占位；全局有 `ComplianceAssessment`（全局 IndexedDB + localStorage，无 `projectId`） | 全局 IndexedDB / localStorage（`project.compliance` 为 `{}`） | 全局单例（无 project identity 隔离） | `PLACEHOLDER_ONLY` | `BLOCKED` |
| **成本与物流** | 双平台预填、不可变场景快照生成、首个自动基线、基线切换、跨平台方案对比表 | `t6.costScenario.*`, `project.costing` | `t6.costScenario.<uuid>` | `PROJECT_NATIVE` | `READY` |
| **Listing 与上架** | 尚无 Tab；全局有静态教学组件 `ListingContent`（无输入/无持久化/无俄文草稿） | 无（`project.listing` 目前为 `{}`） | 无 | `NO_EXISTING_MODULE` | `EMPTY` |
| **运营与复盘** | 仅 Tab 文本占位；全局有固定 6 品类的 `ProjectFlow` 历史原型 | 无（`project.operations` 目前为 `{}`） | 无 | `PLACEHOLDER_ONLY` | `EMPTY` |
| **附件与记录** | DecisionLog 全面运行；项目级文件附件存储完全不存在（仅有全局临时上传） | `t6.log.*`（日志）；文件附件无 Owner | `t6.log.<uuid>`（日志）；附件无 | `PROJECT_NATIVE`（日志）；`NO_EXISTING_MODULE`（附件） | `PARTIAL` |

---

### 6. Maturity Matrix（各领域成熟度汇总）

- **READY（已有 Project-bound Store + UI）**：
  - 概览（Overview）：生命周期流转、Gate 评估、DecisionLog 时间轴完整可用。
  - 成本与物流（Cost & Logistics）：双端 Calculator、不可变场景、基线逻辑完全闭环。
- **PARTIAL（已有 Store 或 UI，但链路不完整）**：
  - 供应链（Supply Chain）：底层 Store 100% 具备且测试通过，前端 UI 处于占位状态。
  - 附件与记录（Attachments & Logs）：DecisionLog 具备，文件附件存储不存在。
- **BLOCKED（已有能力，但 Identity / Context 不允许安全接入）**：
  - 合规（Compliance）：全局存在解析与核对能力，但全局单例存储无 `projectId`，直接接入会发生数据串扰。
- **EMPTY（几乎没有真实能力）**：
  - 商品与 SKU（Product & SKU）：`project.product` 为空，存量组件无数据模型。
  - Listing 与上架（Listing & Publishing）：`project.listing` 为空，存量组件为纯教学文本。
  - 运营与复盘（Operations & Review）：`project.operations` 为空，存量组件为硬编码原型。

---

### 7. Gate ↔ Workspace Matrix（Stage Gate 映射事实）

| Gate Module | Workspace Domain | Current Data Capability | Current Gate State |
| :--- | :--- | :--- | :--- |
| `costing` | 成本与物流 | 已有完整 Store (`t6.costScenario.*`) 及计算适配器 | `EVALUATED` |
| `supplier` | 供应链 | 已有完整 Store (`t6.supplier.*` / `t6.supplierQuote.*`) | `NOT_EVALUATED` |
| `samples` | 供应链 | 已有完整 Store (`t6.sample.*`) | `NOT_EVALUATED` |
| `compliance` | 合规 | 项目级无 Store（`project.compliance` 为空） | `NOT_EVALUATED` |
| `listing` | Listing 与上架 | 项目级无 Store（`project.listing` 为空） | `NOT_EVALUATED` |
| `operations` | 运营与复盘 | 项目级无 Store（`project.operations` 为空） | `NOT_EVALUATED` |
| `launch` | Listing 与上架 / 运营 | 项目级无 Store（`project.launch` 为空） | `NOT_EVALUATED` |

> **Gate Engine 架构原则**：
> 未来 Gate 集成应保持 `evaluateProjectGate` 作为领域纯评估器（Domain Evaluator）的架构定位。项目绑定的 Store 状态应由调用层/上下文层（Calling / Context Layer）解析并通过 `deps` 注入，而不是由 Gate Engine 直接调用 Store，除非后续任务明确调整该架构。

---

### 8. P1~P7 GAP（固定代码与能力落差事实审计）

- **P1 — PROJECT PRODUCT MODEL GAP**：
  `project.product` 目前为空对象 `{}`；无结构化 SKU 规格字段、无数据校验、无持久化 API；存量 `ProductDefinition.jsx` 仅为静态教程，无输入无存储。
- **P2 — SUPPLY CHAIN UI GAP**：
  底层 Store API（`t6.supplier.*` / `t6.supplierQuote.*` / `t6.sample.*` / `project.supply`）已实现并有单元测试，但 `ProjectDetailPage` 中 `suppliers` Tab 仍为纯文本占位符，未接入前端交互组件。
- **P3 — COMPLIANCE DATA GAP**：
  `project.compliance` 目前为空对象 `{}`；存量 `ComplianceAssessment.jsx` 使用全局 IndexedDB `ozon-compliance` 与全局 localStorage `compliance-items`，未携带 `projectId`，缺乏多项目隔离能力。
- **P4 — LISTING IDENTITY GAP**：
  `project.listing` 目前为空对象 `{}`；存量 `ListingContent.jsx` 仅为静态教程；系统无俄文标题/卖点/富文本编辑输入与草稿存储能力，无商品刊登状态机。
- **P5 — OPERATIONS DATA GAP**：
  `project.operations` / `project.launch` / `project.settlement` 均为空对象 `{}`；`operations` Tab 仅为占位符；存量 `ProjectFlow.jsx` 为写死 6 品类的历史原型，缺乏真实订单、库存与广告数据模型。
- **P6 — ATTACHMENT GAP**：
  `project.decisionLog` 已存在，但项目级实体中无文件附件列表；合规文件存储在全局 IndexedDB，缺乏基于 `projectId` 的文件附件生命周期管理。
- **P7 — LEGACY GLOBAL TOOL GAP**：
  在 `App.jsx` 中，`n5`, `n6`, `n8`, `n9`, `n14`, `n39` 作为全局顶层路由存在；在 `ProjectDetailPage` 侧边栏点击 36 节点仅能改变节点状态与备注，无法联动打开左侧对应的工作区 Tab。

---

### 9. Legacy Nodes（历史节点与全局工具映射事实）

`App.jsx` 当前的实际节点映射关系：
- `n2`：`MarketResearch`（全局选品调研面板）
- `n5`：`ProductDefinition`（挂载在 `NodePage` 下的全局静态页面）
- `n6`：`SupplyChain`（挂载在 `NodePage` 下的全局工厂目录）
- `n8`：`CostQuote`（挂载在 `NodePage` 下的全局报价清单）
- `n9`：`ComplianceAssessment`（挂载在 `NodePage` 下的全局合规评估）
- `n14`：`ListingContent`（挂载在 `NodePage` 下的全局 Listing 教程）
- `n39`：`WBCalc`（挂载在 `NodePage` 下的独立 WB 核算面板）
- `__fbp_calc__`：`OzonFbpCalc`
- `__project_flow__`：`ProjectFlow`（全局 6 品类流程总览）
- `__t6_project_detail__`：`ProjectDetailPage`（传入 `activeProjectId`）

这些全局入口属于既有系统可用工具，后续在将能力沉淀入 Project Workspace 时，不得随意删除或破坏既有全局入口。

---

### 10. Recommended Batches（按契约成熟度分批）

- **BATCH 1 — Project-bound Store 已存在，主要缺 UI**：
  - **涵盖领域**：供应链管理（T7 Supplier / SupplierQuote / Sample / project.supply）。
  - **核心工作**：在 `ProjectDetailPage` 的 `suppliers` Tab 接入列表、报价版本展示、打样流转及供应方案选定交互。Gate 集成需通过后续契约任务明确上下文传递后接入，不提前在 Gate Engine 内硬编码写死 Store 调用。
- **BATCH 2 — 已有全局工具，但需 Project Context 隔离**：
  - **涵盖领域**：合规认证（Compliance）。
  - **核心工作**：将 `ComplianceAssessment` 改造为支持 `projectId` 作用域隔离的组件，存储键绑定项目 ID，接入 `compliance` Tab。
- **BATCH 3 — 数据模型尚不存在或 identity 不完整**：
  - **涵盖领域**：商品与 SKU 规格定义（`product`）、Listing 刊登内容（`listing`）、运营与冷启动（`operations`）、项目文件附件（`attachments`）。
  - **核心工作**：在后续任务中分别进行领域建模、Schema 定义与组件开发。

---

### 11. CONTRACT SUMMARY（正式系统契约摘要）

```text
PROJECT WORKSPACE

Current Tabs: overview, product, suppliers, costing, compliance, operations
Current Implemented Tabs: overview, costing
Current Placeholder Tabs: product, suppliers, compliance, operations

Project Primary Key: t6.project.<uuid>
Project Human Code: projectCode (RU-YYYY-NNN)
Candidate Link: project.source.candidateId
Source Product Link: project.source.sourceProductId
Creation Evidence Link: project.source.creationSnapshotId
Snapshot Types: SCORING, MARKET_VALIDATION

PRODUCT

Project Product Store: project.product (currently {})
Product UI: PLACEHOLDERS.product (text placeholder)
Formal SKU Entity: NONE
Integration Class: PLACEHOLDER_ONLY

SUPPLY CHAIN

Supplier Store: t6.supplier.<uuid> (EXISTS)
Quote Store: t6.supplierQuote.<uuid> (EXISTS, append-only, versioned)
Sample Store: t6.sample.<uuid> (EXISTS, state machine)
Supply Plan: project.supply (EXISTS via setProjectSupply, undefined at creation)
Supply UI: PLACEHOLDERS.suppliers (text placeholder)
Phase5 Bridge: NO_BRIDGE
Integration Class: PLACEHOLDER_ONLY (Store: PROJECT_NATIVE)

COMPLIANCE

Project Compliance Store: project.compliance (currently {})
Compliance UI: PLACEHOLDERS.compliance (text placeholder)
MI Compliance Evidence: candidate.marketEvidence.eac_status / risks (advisory tags only)
Integration Class: PLACEHOLDER_ONLY (Legacy tool: CONTEXTUAL_WRAPPER)

COSTING

CostScenario Store: t6.costScenario.<uuid> (EXISTS, immutable)
Ozon Project Context: OzonCalc (supported via projectContext)
WB Project Context: WBCalc (supported via projectContext)
Baseline: project.costing.baselineScenarioId (supported)
Integration Class: DIRECT_EMBED / PROJECT_NATIVE

LISTING

Listing UI: NONE (not in active tabs)
Listing Store: project.listing (currently {})
Project Link: NONE
Publish Capability: NOT_IMPLEMENTED
Integration Class: NO_EXISTING_MODULE

OPERATIONS

Operations Store: project.operations (currently {})
Launch Store: project.launch (currently {})
Settlement Store: project.settlement (currently {})
Operations UI: PLACEHOLDERS.operations (text placeholder)
Integration Class: PLACEHOLDER_ONLY

FILES

Attachment Store: NONE
Decision Log: t6.log.<uuid> (EXISTS, rendered in overview)
Integration Class: PROJECT_NATIVE (Log) / NO_EXISTING_MODULE (Attachment)

GATE

Real Evaluated Modules: costing (baselineMarginResult, target_price), snapshot_exists, launch_done (n20 workflow)
Not Evaluated Modules: supplier, samples, compliance, listing, operations, launch (kind: module)

LEGACY

Project-related Node IDs: n2, n5, n6, n8, n9, n14, n39
Standalone Tools: ProductDefinition, SupplyChain, CostQuote, ComplianceAssessment, ListingContent, ProjectFlow

NEXT

Recommended Batch 1: BATCH 1 — Project-bound Store 已存在，主要缺 UI (T7 供应链)
Recommended Batch 2: BATCH 2 — 已有全局工具，但需 Project Context 隔离 (合规认证)
Recommended Batch 3: BATCH 3 — 数据模型尚不存在或 identity 不完整 (商品定义 / Listing / 运营 / 附件)
```

---

### 12. Tests（测试验证状态）

- `git status`：仅审计文档处于受控状态。
- `node tests/ia-candidate-project-launch.test.mjs`：20 项测试 + 1 项 E2E 100% 全绿。
- `node tests/ia-dual-snapshot-project-gate.test.mjs`：12 项快照与 Gate 边界测试 100% 全绿。
- `npm run test:t6`：T6/T7 核心套件（43 项 Supplier + 53 项 WB 成本场景 + 26 项 UI 契约 + 8 项 Candidate 契约）100% 全绿。
- `npm test`：React 65 项 + Python 44 项 100% 全绿。
- `npm run test:sync`：双端对拍零差异 100% 全绿。

---

### 13. Git Status（变更状态确认）

```text
Changes not staged for commit:
	modified: docs/ia/TASK07A1_PROJECT_WORKSPACE_CONTRACT.md
```
- 本轮未改动任何生产代码，未修改任何测试代码，未修改 `package.json`。

---

### 14. Deferred Design Notes（推迟设计记录，非当前契约）

> [!NOTE]
> 以下内容均为未来业务域实施时的设计构想，**明确不属于当前系统契约**（`NOT CURRENT CONTRACT`，`NOT DECIDED IN TASK07A-1`），在后续专门的实施任务确定前不构成任何实现约束：
> 1. **商品与 SKU 规格字段**（如 `SkuProductDefinition`）：净重毛重、内外包装尺寸、条形码生成、俄文品名拼接规则等，推迟至 BATCH 3 设计。
> 2. **Phase 5 到 T7 供应链快捷导入**：在创建项目时是否自动根据 Phase 5 采购询价预填初版供应商和报价 v1，推迟至 BATCH 1 UI 实施阶段评估。
> 3. **合规数据模型与附件结构**：EAC 证书号、测试报告编号、认证机构信息以及 `project.attachments` 存储设计，推迟至 BATCH 2 评估。
> 4. **Listing 俄语草稿结构**：标题 200 字限制、5 点卖点输入器、图文素材索引等，推迟至 BATCH 3 设计。
> 5. **Gate Engine 依赖具体注入方式**：`deps.availableModules` 如何优雅接收由调用层计算出的供应方案或合规状态，推迟至后续 Gate 专项任务中制定。
