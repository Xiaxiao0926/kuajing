# KUAIJING-IA-REFACTOR-V1 · TASK 05A-1 契约审计报告
## Candidate 数据模型与 Opportunity → Candidate 桥接契约审计

> **审计性质**：只读审计与现状核对（READ-ONLY CONTRACT AUDIT）。  
> **执行原则**：仅记录事实（FACT）、缺陷（GAP）与风险（RISK）；严格禁止在本文档提出具体重构方案或修改任何业务代码。

---

### 一、Candidate ID 契约

* **字段名**：`id`
* **生成函数**：`uuid()`（定义于 `ozon-react/src/utils/t6/t6Store.js` 第 29-32 行）
  ```javascript
  export function uuid() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID()
    return `t6-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }
  ```
* **格式**：标准 RFC 4122 v4 UUID（如 `e18fa4b2-4db1-4ad9-906c-94119d85bf18`），或降级串 `t6-<base36-time>-<base36-rand>`。
* **是否稳定**：是。写入实体键 `t6.candidate.<uuid>` 后，实体 `id` 保持不可变。
* **是否随机**：是（基于随机数/加密安全随机数生成）。
* **是否可重复创建**：否。`t6Store.ensureCandidate` 执行前置查重（`findCandidateByProductId(sourceProductId)`）。若已存在相同 `sourceProductId` 的候选，则直接返回已有记录 `{ candidate: existing, created: false }`，不重新分配 ID。

---

### 二、Candidate 完整 Schema 审计

从 `ozon-react/src/utils/t6/t6Store.js` 中 `ensureCandidate` 构造器与使用现场还原的真实字段结构如下：

| 字段名 | 类型 | 创建时来源 | 是否必填 | UI 是否使用 | Project 是否继承 | 备注 |
|---|---|---|---|---|---|---|
| `id` | `string` (UUID) | `uuid()` 自动生成 | 是 | 是 | 是 | 作为 `project.source.candidateId` |
| `schemaVersion` | `number` | 常量 `1` | 是 | 否 | 否 | 项目具有独立的 schemaVersion |
| `sourceProductId` | `string` | `args.sourceProductId` | 是 | 否直接展示 | 是 | 查重主键；继承为 `project.source.sourceProductId` |
| `candidateIndex` | `number` | `args.candidateIndex` | 否 | 否 | 否 | 静态数据集中的物理行索引 |
| `candidateName` | `string` | `args.name` | 是 | 是 | 是 | 继承为 `project.name` 默认值与 `project.source.candidateName` |
| `categoryLeaf` | `string` | `args.categoryLeaf` | 否 | 是 | 是 | 继承为 `project.source.category` |
| `categoryFull` | `string` | `args.categoryFull` | 否 | 否 | 否 | 仅用于静态评分数据集筛选与匹配 |
| `latestSnapshotId` | `string \| null` | 初始固定置 `null` | 否 | 是 | 是 | 绑定评分快照外键；立项前必须非空 |
| `bizStatus` | `string` | 默认 `'观察'` | 是 | 是 | 否 | 候选业务状态，不带入项目生命周期 |
| `owner` | `string` | `args.owner` (默认 `''`) | 否 | 是 | 否 | 候选负责人，可在列表直接编辑 |
| `notes` | `string` | `args.notes` (默认 `''`) | 否 | 否 | 否 | 列表未展示，立项未继承 |
| `source_niche_id` | `string` (可选) | `args.source_niche_id` | 否 | 否 | 否 | 来源利基标识，项目未继承 |
| `source_run_id` | `string` (可选) | `args.source_run_id` | 否 | 否 | 否 | 来源分析批次，项目未继承 |
| `source_system` | `string` (可选) | `args.source_system` | 否 | 否 | 否 | 来源系统标识，项目未继承 |
| `projectIds` | `string[]` | 初始 `[]` | 是 | 是 | 否 | 关联的 SKU 项目 UUID 列表 |
| `addedAt` | `string` (ISO) | `new Date().toISOString()` | 是 | 否 | 否 | 候选创建时间戳 |
| `updatedAt` | `string` (ISO) | `new Date().toISOString()` | 是 | 是 | 否 | 用于列表倒序排序 |

**源码字段对齐事实确认**：
* 源码中**不存在** `productName`、`title`，统一使用 `candidateName`。
* 源码中**不存在**单一 `category` 字段，拆分为 `categoryLeaf` 与 `categoryFull`。
* 源码中**不存在** `status` / `stage` 字段，候选状态字段名为 `bizStatus`。
* 源码中**不存在** `createdAt`，创建时间字段名为 `addedAt`。
* 源码中**不存在**内联 `snapshot` / `scoring` 对象，仅存储外键 `latestSnapshotId`。
* 源码中**不存在** `source_niche_uid`，仅支持可选字段 `source_niche_id`。

---

### 三、Candidate Status 状态机

候选池状态由常量 `CANDIDATE_BIZ_STATUS = ['观察', '待调研', '待立项', '暂缓', '淘汰']` 约束：

| Status | 创建来源 | 谁能修改 | UI 文案 | 是否允许立项 |
|---|---|---|---|---|
| `观察` | `ensureCandidate` 默认初始值 | 用户手动在下拉框修改；API | 观察 | 允许（UI 仅校验快照是否存在） |
| `待调研` | `promoteToT6Candidate` 推流成功后自动置入 | 用户手动在下拉框修改；API | 待调研 | 允许（UI 仅校验快照是否存在） |
| `待立项` | 用户手动在下拉框选择 | 用户手动在下拉框修改；API | 待立项 | 允许（UI 仅校验快照是否存在） |
| `暂缓` | 用户手动在下拉框选择 | 用户手动在下拉框修改；API | 暂缓 | 允许（UI 仅校验快照是否存在） |
| `淘汰` | 用户手动在下拉框选择 | 用户手动在下拉框修改；API | 淘汰 | 允许（UI 仅校验快照是否存在） |

**与 Market Intelligence 状态体系对比事实**：
* **FACT**：MI 状态体系（`TEST / VERIFY / WATCH / DROP`，由 `wb-mi-verdict-overrides-v1` 管理）与 T6 Candidate 的 `bizStatus`（`['观察', '待调研', '待立项', '暂缓', '淘汰']`）**属于两套完全独立的字段体系**。
* **FACT**：推流函数 `promoteToT6Candidate` 执行时，硬编码将新候选状态置为 `'待调研'`，并未将利基当前的 `verdict`（例如已处于 `TEST` 或 `VERIFY`）转换或保留进候选状态。

---

### 四、Candidate 数据事实源与持久化

* **Store 架构**：`ozon-react/src/utils/t6/t6Store.js`，基于实体 Key-Value 的存储引擎。
* **Persistence Key**：实体格式为 `t6.candidate.<uuid>`（属于 `t6.*` 统一命名空间）。
* **同步 WordPress 机制**：
  * **FACT**：生产环境默认适配器直接调用 `ozon-react/src/utils/persist.js` 的 `persistGet` 与 `persistSet`。
  * **FACT**：`persistSet` 在写入本地 `localStorage` 的同时，将键入队 `pending` Map，并异步推送到 WordPress REST 端点 `/wp-json/kuajing/v1/state`，持久化至数据表 `wp_kuajing_state`。
* **Revision 与版本控制**：
  * **FACT**：`persist.js` 对每个 key 维护 `__kuajing_revision__:<key>` 与 `__kuajing_updated__:<key>`。服务端保存时校验 revision，遇到并发冲突抛出 `PersistenceConflictError`（HTTP 409）。
* **跨设备特性**：
  * **FACT**：在联网且 WordPress REST API 正常的环境下具备跨设备同步能力；离线或本地单机模式下保留在浏览器 `localStorage` 中。

---

### 五、Opportunity → Candidate 调用链路

当前存在两条调用 Opportunity 推流到 Candidate 的真实链路：

#### 链路 A：来自 Opportunity Detail 抽屉（`NicheDetailDrawer.jsx`）
```text
NicheDetailDrawer.jsx (UI: [一键推送到 T6 候选池] 按钮)
  ↓ onClick={() => onPromoteToT6(opportunity.raw, statusNote)}
MarketIntelligenceApp.jsx (handlePromoteToT6)
  ↓ promoteToT6Candidate(niche, reason, currentRunId)
miStore.js (promoteToT6Candidate)
  ↓ ensureCandidate({ sourceProductId, candidateIndex, name, categoryLeaf, categoryFull, notes, source_niche_id, source_run_id, source_system })
  ↓ setCandidateBizStatus(candidate.id, '待调研', '来自俄罗斯市场情报一键推进') [仅在 created === true 时执行]
  ↓ recordAuditLog({ action: 'T6_PUSH', ... })
t6Store.js (ensureCandidate / setCandidateBizStatus)
  ↓ adapter.set('t6.candidate.' + candidate.id, record) -> persistSet
Candidate 实体落库
```

#### 链路 B：来自 Phase 5 采购工作台（`ManualProcurementWorkbench.jsx`）
```text
ManualProcurementWorkbench.jsx (UI: [推进至 T6 候选池] 按钮)
  ↓ handleSaveDraft() -> saveManualQuote (写入 wb-mi-manual-quotes-v1)
  ↓ promoteToT6Candidate(niche, `${trustPrefix}。采购报价: ¥...`)
miStore.js (promoteToT6Candidate)
  ↓ ensureCandidate(...) [同上]
t6Store.js
Candidate 实体落库
```

---

### 六、promoteToT6Candidate 输入 → 输出字段审计

审计目标：`ozon-react/src/utils/marketIntelligence/miStore.js` 中 `promoteToT6Candidate` 函数。

| Niche / Opportunity 字段 | 中间处理逻辑 | Candidate 目标字段 | 存储形式 | 完整性评估 |
|---|---|---|---|---|
| `niche.name` | 传给 name；拼入 sourceProductId | `candidateName`, `sourceProductId` | STRUCTURED | 结构化保留 |
| `niche.category` / `cat` | 取 `niche.category \|\| niche.cat \|\| '未分类'` | `categoryLeaf`, `categoryFull` | STRUCTURED | 结构化保留 |
| `runId` (参数) | `String(runId)` | `source_run_id` 及 `notes` | STRUCTURED | 结构化保留 |
| `niche.rank` / `id` | `niche.rank ?? niche.id ?? niche.name` | `source_niche_id`, `candidateIndex` | STRUCTURED | 结构化保留（存的是 rank/id） |
| `niche.uid` (`nicheUid`) | 仅拼入 notes 文本模板 | `notes` | **TEXT_ONLY** | **结构化丢失** |
| `niche.mos` | 仅拼入 notes 文本模板 | `notes` | **TEXT_ONLY** | **结构化丢失** |
| `niche.cfs` / `pfs` | 仅拼入 notes 文本模板 | `notes` | **TEXT_ONLY** | **结构化丢失** |
| `niche.buyout` | 仅拼入 notes 文本模板 | `notes` | **TEXT_ONLY** | **结构化丢失** |
| `niche.price` | 仅拼入 notes 文本模板 | `notes` | **TEXT_ONLY** | **结构化丢失** |
| `niche.weight_g` / `heavy` | 仅拼入 notes 文本模板 | `notes` | **TEXT_ONLY** | **结构化丢失** |
| `reason` / `rationale` | 拼入 notes 文本末尾 | `notes` | TEXT_ONLY | 文本保留 |
| `niche.gmv` / `revenue` | 完全未处理 | 无 | **DROPPED** | **完全丢失** |
| `niche.growth` | 完全未处理 | 无 | **DROPPED** | **完全丢失** |
| `niche.sellers` | 完全未处理 | 无 | **DROPPED** | **完全丢失** |
| `niche.verdict` | 未传递（直接覆盖为 '待调研'） | 无 | **DROPPED** | **阶段丢失** |
| `niche.risks` | 完全未处理 | 无 | **DROPPED** | **完全丢失** |
| EAC / 认证状态 | 完全未处理 | 无 | **DROPPED** | **完全丢失** |

---

### 七、三大来源追溯字段核对

| 期望追溯字段 | 当前是否存在 | 实际字段名 | 当前存储值 | 稳定性分析 |
|---|---:|---|---|---|
| `source_system` | 是 | `source_system` | `'WB_MARKET_INTELLIGENCE'` | 稳定（硬编码常量） |
| `source_run_id` | 是 | `source_run_id` | 传入的 `runId`（如 `'RUN-20260917-001'`） | 稳定（批次字符串） |
| `source_niche_uid` | **否** | `source_niche_id` | `String(niche.rank ?? niche.id ?? niche.name)` | **不稳定**（取自 rank/id，无唯一 uid 时退化为 name） |

**事实确认**：
* 核心来源追溯字段 `source_niche_uid` 处于 **MISSING** 状态。
* 现有 `source_niche_id` 存储的是利基的排名数字（rank）或本地 id，不能作为全局跨报告追溯依据。

---

### 八、sourceProductId 语义审计

* **字段位置**：`record.sourceProductId`（Candidate 必填主键）。
* **生成来源**：
  * 评分数据集 (`ProductScoringSection`)：取静态商品数据中的 `canonical.source_product_id`（真实商品 ID）。
  * 市场情报推流 (`promoteToT6Candidate`)：动态构造为 `` `wb-niche-${niche.name}` ``。
* **真实语义**：
  * 在 T6 原设计架构中，`sourceProductId` 代表被分析的原始商品 ID（Product SKU ID）。
  * 在 MI 推流中，被临时借用充当“利基名称的虚拟商品键”。
* **是否指 Opportunity**：否。它不是 Opportunity 的标准标识符（Opportunity 的全局标识符是 `nicheUid`）。
* **是否指 Supplier Product**：否。
* **是否指 Candidate**：否。Candidate 自身主键为 `id` (UUID)。
* **是否允许为空**：否。`ensureCandidate` 包含强防御校验：
  ```javascript
  if (!sourceProductId || !String(sourceProductId).trim()) {
    throw new Error('T6_STORE: sourceProductId 为空，禁止创建候选（稳定业务身份缺失，fail-close）')
  }
  ```

---

### 九、notes 文本打包内容审计

`promoteToT6Candidate` 当前生成的 `notes` 模板示例：
```text
[WB选品情报] Niche ID: 1 | UID: wb-niche-hairdryer-001 | Run: RUN-20260917-001 | MOS: 82.5 | CFS: 74.1 | 签收率: 88% | 均价: 340 | 预估单重: 轻件。待确认 1688 盒装尺寸与特氟龙涂层标准...
```
若从 Phase 5 采购工作台推流，模板追加前缀：
```text
[数据可信度: HIGH] 价格:厂家实询 | 重量:实测 | 物流:空运 | 认证:无需。采购报价: ¥15.5, 供应商: 义乌市XX塑胶厂, 实测重: 120g, 预估毛利率: 35.2%
```

**notes 打包内容与结构化状态对照**：
| notes 中打包的信息 | 本应是结构化数据？ | 当前 Candidate 是否有独立字段 |
|---|---:|---:|
| 全局利基标识 `UID` | 是 | 否（MISSING） |
| 市场机会分 `MOS` | 是 | 否（MISSING） |
| 选品潜力分 `CFS` / `PFS` | 是 | 否（MISSING） |
| 市场签收率 `buyout` | 是 | 否（MISSING） |
| 市场均价 `price` | 是 | 否（MISSING） |
| 预估单重 `weight` | 是 | 否（MISSING） |
| 1688 采购报价 `factoryPriceCny` | 是 | 否（MISSING） |
| 供应商名称 `supplierName` | 是 | 否（MISSING） |
| 实测重量 `weightG` | 是 | 否（MISSING） |
| 预估毛利率 `marginPct` | 是 | 否（MISSING） |
| 数据可信度等级 `overallTrustTier` | 是 | 否（MISSING） |
| 推流备注 / 理由 | 否 | 是（符合 notes 原始语义） |

---

### 十、风险数据结构化审计

* **事实**：Candidate 实体定义中，不存在 `risks`、`riskFlags`、`certificationStatus`、`eacStatus` 等任何结构化字段。
* **审计状态确认**：**`RISK_DATA_NOT_STRUCTURED`**。

---

### 十一、Candidate 列表当前展示字段与可见性

在 `ozon-react/src/components/t6/CandidatePoolPage.jsx` 中，每行 Candidate 渲染以下列：
1. **商品**：`cand.candidateName`（大字标题）+ `cand.categoryLeaf`（副标小字）。
2. **评分**：`snap.totalScore` + `snap.grade` + `snap.gradeTentative`（通过 `ScoreCell` 组件展示）。
3. **Decision**：`snap.decision.status` + `snap.decision.action`（通过 `DecisionBadge` 组件展示）。
4. **Context**：`snap.context`（通过 `ContextBadge` 组件展示）。
5. **市场规模**：`snap.dimensions.demand.marketScaleScore`。
6. **候选表现**：`snap.dimensions.demand.candidateStrengthScore`。
7. **利润**：`snap.dimensions.profitability.score`。
8. **物流**：`snap.dimensions.logistics.score`。
9. **Supply Gap**：`snap.supplyGap.rank`。
10. **负责人**：`cand.owner`（可编辑的输入框）。
11. **状态**：`cand.bizStatus`（下拉选择框）+ 若 `cand.projectIds.length > 0` 显示 "已产生项目" 徽标。
12. **操作**：[刷新评分] 按钮与 [创建项目] 按钮。

**Opportunity 推流数据在列表中的可见性**：
* 实际可见：仅 `candidateName`（利基名称）、`categoryLeaf`（品类）、初始化的 `bizStatus`（显示为“待调研”）。
* **不可见**：从 Opportunity 带过来的 MOS、CFS/PFS、签收率、均价、单重、UID、备注内容等**在列表中完全不可见**。
* **破折号异常**：由于 MI 推流的候选没有评分快照（`latestSnapshotId === null`），上述评分相关的 7 列在 UI 上全部显示为 `'—'` 或 `'无市场基准'`。

---

### 十二、Candidate Detail 存在性审计

* **事实**：
  ```text
  CURRENT_CANDIDATE_DETAIL = NONE
  ```
* **具体组件**：**无（NONE）**。
* 现状：在 `CandidatePoolPage.jsx` 中，点击商品名称或整行没有绑定任何 Drawer、Modal 或路由跳转事件。目前系统不存在独立的 Candidate 详情界面。

---

### 十三、Candidate 当前操作动作审计

| 动作 | UI 触发函数 | Store 真实调用 | 是否持久化 | 行为描述 |
|---|---|---|---|---|
| 修改负责人 | `onChange` 输入框 | `setCandidateOwner(cand.id, val)` | 是 | 更新 `owner` 字段 |
| 变更业务状态 | `onChange` 下拉框 | `setCandidateBizStatus(cand.id, val, '')` | 是 | 更新 `bizStatus` 并写入状态变更日志 |
| 刷新评分 | `handleAddOrRefresh(cand)` | `refreshCandidateSnapshot(cand.id, snap.id)` | 是 | 需匹配 `scoring_candidates.json`；MI 候选无法匹配 |
| 创建项目 | `handleCreateProject(cand)` | `createProject({ candidateId, creationSnapshotId })` | 是 | 一键立项；若无快照直接阻断 |
| 查看详情 | 无 | 无 | 否 | **不存在该动作** |
| 删除候选 | 无 | 无 | 否 | **不存在该 API 与动作** |
| 淘汰候选 | 下拉框选择 `'淘汰'` | `setCandidateBizStatus(cand.id, '淘汰')` | 是 | 仅改状态，实体不删除 |
| 编辑备注 | 无 | 无 | 否 | **UI 与 Store 均无备注更新方法** |

---

### 十四、评分与快照契约审计

* **输入契约**：
  * 评分引擎通过 `scoreAllCandidates` 计算，要求传入符合 canonical 规范的商品对象（含 20+ 项指标如 `price_rub`, `sales_rub_28d`, `units_28d`, `conv_rate`, `reviews`, `weight_kg` 等）。
  * Candidate 实体本身不包含这些字段，无法直接输入评分引擎。
* **快照创建与字段**：
  * 由 `buildScoringSnapshot` 构建，包含 `scoreResult`（综合分、等级、决策、维度分）、`sourceInputs`（原始输入）、`explanations`（优势/风险/缺失）、`marketContext`、`versions`（规则与引擎版本）。
  * 快照实体保存在 `t6.snapshot.<uuid>`。
* **creationSnapshotId 生命周期**：
  * 创建时机：在静态评分页点击“加入候选”或“一键立项”时生成；或在候选池点击“刷新评分”时生成。
  * 写入对象：先存入 `candidate.latestSnapshotId`；立项时传入 `createProject`，存入 `project.source.creationSnapshotId`。
  * 强校验规则：`t6Store.createProject` 严格校验 `creationSnapshot.candidateId === candidate.id` 与 `creationSnapshot.sourceProductId === candidate.sourceProductId`（一致性 fail-close）。
* **MI 候选立项阻断事实**：
  * **FACT**：MI 利基推流时，`candidate.latestSnapshotId` 为 `null`。
  * **FACT**：在 `CandidatePoolPage.jsx` 中，`handleCreateProject` 包含前置门禁：
    ```javascript
    if (!cand.latestSnapshotId) { flush('缺少评分快照，无法立项'); return }
    ```
  * **FACT**：由于 MI 推流的利基不在 `scoring_candidates.json` 中，点击“刷新评分”会报错“未找到该商品的当前评分数据”。因此，**当前从 MI 推入的候选，在 UI 上处于完全无法创建 SKU 项目的阻断状态**。

---

### 十五、Candidate → Project 继承与流转链

#### 流转链
```text
Candidate (CandidatePoolPage 列表)
  ↓ 用户点击 [创建项目]
handleCreateProject(cand)
  ↓ 门禁校验: if (!cand.latestSnapshotId) return
createProject({ candidateId: cand.id, creationSnapshotId: cand.latestSnapshotId })
  ↓ t6Store.createProject:
    - 校验 candidate 存在
    - 校验 creationSnapshot 存在
    - 校验 snapshot.candidateId 与 snapshot.sourceProductId 归属一致
    - 生成 projectCode (RU-YYYY-NNN)
    - 构造 project 实体 (lifecycleStatus: 'DRAFT', stage: 'PIPELINE')
    - 写入 t6.project.<uuid>
    - appendCandidateProjectId: 追加 project.id 至 candidate.projectIds
    - appendLog: 写入 candidate 的 project_create 日志与 project 的 status_change 日志
setProjectLifecycle(project.id, 'ACTIVE', '一键立项后启动')
Project 实体落地并进入进行中状态
```

#### 继承字段对照表
| Candidate 字段 | Project 对应位置 | 当前是否继承 | 转换逻辑 |
|---|---|---:|---|
| `id` | `project.source.candidateId` | 是 | 直接引用 |
| `sourceProductId` | `project.source.sourceProductId` | 是 | 直接引用 |
| `candidateName` | `project.name` 与 `project.source.candidateName` | 是 | 作为项目默认名称与来源名称 |
| `categoryLeaf` | `project.source.category` | 是 | 直接引用 |
| `categoryFull` | 无 | 否 | DROPPED |
| `latestSnapshotId` | `project.source.creationSnapshotId` | 是 | 作为立项快照凭据 |
| `bizStatus` | 无 | 否 | Project 初始使用固定的生命周期状态（DRAFT → ACTIVE） |
| `owner` | 无 | 否 | DROPPED |
| `notes` | 无 | 否 | DROPPED |
| `source_niche_id` | 无 | 否 | DROPPED |
| `source_run_id` | 无 | 否 | DROPPED |
| `source_system` | 无 | 否 | DROPPED |
| `scoreResult` / 快照详情 | 无（通过快照外键访问） | 是 | 通过 `getSnapshot(project.source.creationSnapshotId)` 关联读取 |

---

### 十六、项目幂等机制审计

* **问题**：同一个 Candidate 连续点两次立项，会不会创建两个 Project？
* **代码审计**：
  * `CandidatePoolPage.jsx` 中，即使 `cand.projectIds.length > 0`，[创建项目] 按钮依然处于可点击状态。
  * `t6Store.createProject` 每次调用都会生成全新的 `uuid()`，并派发递增的 `projectCode`（如 `RU-2026-001`, `RU-2026-002`），然后将新 ID 压入 `candidate.projectIds`。
* **审计结论**：
  ```text
  NOT_IDEMPOTENT
  ```
* **判断依据**：代码中不存在针对同一 Candidate 重复立项的拦截保护或唯一约束。连续点击会重复生成多个相互独立的 Project 实体。

---

### 十七、Candidate 删除 / DROP 联动审计

* **事实**：`t6Store.js` 没有 `deleteCandidate` 方法。
* **淘汰联动**：当 Candidate 的 `bizStatus` 被手动切换为 `'淘汰'` 时，`setCandidateBizStatus` 仅更新候选自身记录并记录一条状态变更日志。
* **对关联 Project 的影响**：代码完全不查询或修改 `projectIds` 数组中已存在的任何 Project 实体。已生成的项目生命周期状态保持原样。
* **审计结论**：
  ```text
  NO_RULE
  ```

---

### 十八、Market Intelligence 重复推流行为审计

* **测试场景**：同一个 `runId + nicheUid`，在 MI 界面连续两次触发 `promoteToT6Candidate`。
* **推流去重规则**：
  * `promoteToT6Candidate` 生成 `sourceProductId = 'wb-niche-' + niche.name`。
  * `ensureCandidate` 内部执行 `findCandidateByProductId(sourceProductId)`。
  * 如果找到已有记录，执行：
    ```javascript
    const existing = findCandidateByProductId(sourceProductId)
    if (existing) return { candidate: existing, created: false }
    ```
* **输出结论**：
  ```text
  同一 Candidate
  ```
* **去重条件与副作用事实**：
  1. 去重仅依据利基名称 `niche.name`，不校验 `runId`，也不校验 `nicheUid`。
  2. 第二次调用时，由于直接命中 `existing`，系统直接返回已有实体，**不会更新已存在实体的任何字段**（既有候选的 `notes`、`source_run_id`、`source_niche_id` 等均不会被刷新，为完全 NO-OP）。
  3. 但 `promoteToT6Candidate` 依然会额外向 `wb-mi-audit-log-v1` 写入一条重复推流的审计日志。

---

### 十九、Candidate Stable Key 事实审计

* **现有候选键分析**：
  * `candidateId` (`id`)：为随机 UUID，在推流之前不存在。
  * `sourceProductId`：当前推流采用 `wb-niche-${niche.name}`。其稳定性严重依赖名称唯一性，若不同报告或类目下有利基同名，将产生覆盖碰撞。
  * `source_niche_id`：当前存储 `String(niche.rank ?? niche.id ?? niche.name)`，缺失 uid 时退化为名称。
* **审计结论**：
  ```text
  NO_STABLE_SOURCE_KEY
  ```
* **依据**：现有数据 Schema 中未收录全局稳定业务键 `nicheUid`。当前用于去重的 `sourceProductId` 强耦合利基中文名称，不能满足多批次、重命名或重名利基的全局稳定追踪要求。

---

### 二十、Opportunity Context 与 Candidate Schema 对拍表

| Opportunity Context 字段 | Candidate 是否有独立字段 | 当前 promote 是否传递 | 当前结果 |
|---|---|---|---|
| `nicheUid` | 否（无 source_niche_uid） | 仅在 notes 字符串中包含 `UID: ${niche.uid}` | **TEXT_ONLY** |
| `name` | 是（`candidateName`） | 是（作为 `name` 传入） | **STRUCTURED** |
| `category` | 是（`categoryLeaf`, `categoryFull`） | 是（作为品类传入） | **STRUCTURED** |
| `runId` | 是（`source_run_id`） | 是（作为 `source_run_id` 传入） | **STRUCTURED** |
| `mos` | 否 | 仅在 notes 字符串中包含 `MOS: ${niche.mos}` | **TEXT_ONLY** |
| `pfs` | 否 | 仅在 notes 字符串中包含 `CFS: ${niche.cfs}` | **TEXT_ONLY** |
| `gmv` | 否 | 否（完全未传递） | **DROPPED** |
| `growth` | 否 | 否（完全未传递） | **DROPPED** |
| `buyout` | 否 | 仅在 notes 字符串中包含 `签收率: ${niche.buyout}` | **TEXT_ONLY** |
| `sellers` | 否 | 否（完全未传递） | **DROPPED** |
| `verdict` | 否（仅有独立 bizStatus，初始固定待调研） | 否（原始 verdict 被丢弃） | **DROPPED** |
| `risks` | 否 | 否（完全未传递） | **DROPPED** |

---

### 二十一、Phase 5 采购工作台数据审计

* **Phase 5 Data Owner**：**`Market Intelligence validation item`**（由 `miStore.js` 统一管理，持久化在独立键 `wb-mi-manual-quotes-v1` 中，按利基名称和 UID 双键索引）。
* **Candidate Link**：**`无结构化关联（仅文本拼入 notes）`**。Candidate 实体完全不感知 `wb-mi-manual-quotes-v1` 键，也没有厂家报价、实测重量、供应商等独立字段。
* **Project Link**：**`无关联`**。Project 实体中预留的 `suppliers`、`costing` 结构不读取 Phase 5 数据。

---

### 二十二、Audit 与 Decision Log 机制审计

* **Candidate 审计事实源**：
  * **T6 日志系统**：存储于 `t6.log.<uuid>`。创建候选、状态变更、快照挂载、项目创建均调用 `appendLog` 记录。
  * **MI 审计系统**：存储于 `wb-mi-audit-log-v1`。推流动作记录 `action: 'T6_PUSH'`。
* **事件格式**：
  * T6 log 格式：`{ id, schemaVersion, subjectType: 'candidate', subjectId, projectId, kind, from, to, reason, at, by }`
  * MI audit log 格式：`{ timestamp, action, niche_uid, niche_name, old_value, new_value, source, note }`
* **是否包含 candidateId**：
  * T6 日志中 `subjectId` 即 `candidate.id`（包含）。
  * MI 日志中 `new_value` 包含文本 `PROMOTED_TO_T6_CANDIDATE (ID: ${candidate.id})`（包含）。

---

### 二十三、三类 GAP 归纳

#### G1 — SOURCE TRACEABILITY（来源追溯缺口）
1. **缺失全局唯一利基 UID**：Candidate Schema 仅支持 `source_niche_id`（存放 rank 或 name），缺少全局稳定的 `source_niche_uid`。
2. **sourceProductId 语义异化**：推流以利基中文名构造 `wb-niche-${niche.name}` 充当商品主键，容易发生重名冲突且不具备商业实体唯一性。
3. **Candidate → Project 来源链断裂**：项目仅继承 `candidateId` 与 `sourceProductId`，Candidate 上记录的 `source_run_id`、`source_niche_id` 与 `source_system` 在立项时被完全抛弃，无法逆向追踪项目的分析批次与利基来源。

#### G2 — STRUCTURED MARKET DATA（结构化市场数据缺口）
1. **核心利基指标降解为纯文本**：`UID`、`MOS`、`CFS/PFS`、`buyout`、`price`、`weight` 全被塞入非结构化字符串 `notes`，无法在候选池中进行数值筛选、排序或传递给下游。
2. **关键宏观数据直接丢失**：`gmv`、`growth`、`sellers`、原始 `verdict` 在推流时直接丢弃（DROPPED）。
3. **风险与合规数据无结构承载**：`risks` 与认证信息未定义结构化字段（`RISK_DATA_NOT_STRUCTURED`）。
4. **Phase 5 采购数据孤岛化**：采购工作台录入的真实报价、供应商与实测重量未进入 Candidate 结构化字段，仅作为文本前缀追加进 `notes`。
5. **缺少评分快照导致立项被阻断**：MI 推流候选的 `latestSnapshotId` 为 `null`，且无法通过静态评分数据集刷新快照，导致在候选池界面点击立项被直接拦截报错（“缺少评分快照，无法立项”）。

#### G3 — CANDIDATE UI（界面与交互缺口）
1. **无 Candidate Detail**：`CURRENT_CANDIDATE_DETAIL = NONE`，既无 Drawer 也无详情页，无法查看 Candidate 的详细信息或 `notes`。
2. **列表数据展示脱节**：候选池列表为评分模型设计，利基推流的候选因缺少快照，7 个核心评分列全部显示破折号；而已传递的利基市场数据在列表中没有任何列可以展示。
3. **备注不可维护**：UI 未提供任何查看或编辑 `notes` 的输入组件。
4. **立项操作缺乏幂等防重守卫**：列表在“已产生项目”后依然允许重复点击“创建项目”，每次点击均生成全新项目编号与实体，缺乏防重拦截。

---

### 二十四、CONTRACT SUMMARY

```text
Candidate Store: ozon-react/src/utils/t6/t6Store.js
Candidate Persistence: localStorage (t6.candidate.<uuid>) + WordPress REST (wp_kuajing_state) via persist.js
Candidate ID Field: id
Candidate ID Generator: uuid() (RFC 4122 v4 / fallback t6-<time>-<random>)

Candidate Status Field: bizStatus
Candidate Status Values: '观察' | '待调研' | '待立项' | '暂缓' | '淘汰'

Candidate Create Function: ensureCandidate({ sourceProductId, candidateIndex, name, categoryLeaf, categoryFull, owner, notes, source_niche_id, source_run_id, source_system })
Candidate Update Function: setCandidateBizStatus(id, status, reason), setCandidateOwner(id, owner), refreshCandidateSnapshot(candidateId, snapshotId)
Candidate Get Function: getCandidate(id), listCandidates(), findCandidateByProductId(sourceProductId)

MI Promotion Function: miStore.promoteToT6Candidate(niche, reason, runId)
MI Dedupe Rule: 基于 sourceProductId === `wb-niche-${niche.name}` 精确去重；若已存在则直接返回且不更新既有字段（NO-OP）

Source System Field: source_system ('WB_MARKET_INTELLIGENCE')
Source Run Field: source_run_id (当前传递 runId)
Source Niche Field: source_niche_id (当前传递 String(niche.rank ?? niche.id ?? niche.name)；source_niche_uid 缺失)

MOS Storage: TEXT_ONLY (拼入 notes 文本)
PFS Storage: TEXT_ONLY (拼入 notes 文本)
GMV Storage: DROPPED (未传递)
Risk Storage: RISK_DATA_NOT_STRUCTURED (未定义且未传递)

Notes Usage: 充当非结构化数据包，承载 Niche ID, UID, Run, MOS, CFS, 签收率, 均价, 预估单重, Phase 5 采购信息及用户备注

Candidate Detail: NONE (无 Drawer / Modal / Page)
Candidate List: 展示商品名称、类目、负责人(输入框)、业务状态(下拉框)、评分快照列(MI候选因无快照均显示破折号)、操作(刷新评分/创建项目)
Scoring Integration: 解耦且不兼容；MI 候选无 canonical 数据，无法在评分系统中打分，latestSnapshotId 恒为 null
Phase5 Integration: 隔离；数据保存在 wb-mi-manual-quotes-v1，推流时以文本拼入 notes，Candidate 无结构化字段

Project Create Function: createProject({ candidateId, creationSnapshotId, name })
Candidate -> Project Idempotency: NOT_IDEMPOTENT (同一候选重复点击创建项目会重复生成多个项目实体，projectIds 数组重复追加)
Creation Snapshot: 强依赖且 fail-close 校验；若 candidate.latestSnapshotId 为 null，UI 直接拦截立项，Store 校验亦抛异常

Audit / Decision Log: 双轨记录；T6 日志写 t6.log.<uuid> (subjectType: 'candidate')，MI 日志写 wb-mi-audit-log-v1 (action: 'T6_PUSH')

G1 Traceability: source_niche_uid 缺失，sourceProductId 以名称代 UID，Candidate->Project 丢失 run/niche 来源
G2 Structured Market Data: MOS/PFS/GMV/Risk/Phase5 结构化丢失或仅留文本 notes，无 snapshot 导致无法立项
G3 Candidate UI: 无 Candidate Detail，列表无法展示利基数据，notes 不可编辑，创建项目无防重拦截

Recommended Next Coupling Level: ADAPTER_REQUIRED
```
