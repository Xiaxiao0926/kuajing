# KUAIJING-IA-REFACTOR-V1 · TASK 05C-1

## Candidate → Project 正式立项 Gate 与 Snapshot 下游依赖审计报告

### 1. 审计背景与核心问题

本审计任务旨在深入剖析现存系统架构中，为什么 `SkuProject` 必须绑定 T6 Scoring Snapshot（`creationSnapshotId`），以及如果来源于 Market Intelligence 的候选（MI Candidate）在没有合法商品级 Scoring Snapshot 的情况下强行立项，究竟会对系统哪些下游契约产生破坏。

通过对全仓生产代码、适配器层、数据存储层及测试用例的系统性排查，审计确认：
> **`creationSnapshotId` 绝不仅仅是立项时的一个简单门禁，它承担了整套 SKU 项目生命周期中“商品物理事实（重量/尺寸/售价/佣金）冻结”与“成本核算上下文锚点”的双重职能。**
> 如果直接删除快照门禁允许空快照立项，将直接导致下游成本场景适配器抛错崩溃、成本核算按钮永久置灰、阶段 Gate 推进被拦截判红。

---

### 2. 第一优先级：`createProject()` 全仓调用点清查

全仓定向检索 `createProject(`，在生产代码中仅发现 **2 处真实调用点**：

| 调用方 | 文件位置 | 入口场景 | Candidate 来源 | Snapshot 来源 | 创建后动作 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `CandidatePoolPage` | `ozon-react/src/components/t6/CandidatePoolPage.jsx:103` | 候选池表格操作列点击「创建项目」 | 列表行绑定的 `cand` 实体 | 复用已有 `cand.latestSnapshotId` | 立即调用 `setProjectLifecycle(project.id, 'ACTIVE', '一键立项后启动')` |
| `ProductScoringSection` | `ozon-react/src/components/dashboard/sections/ProductScoringSection.jsx:184` | 选品评分商品行操作列点击「创建项目」 | 通过 `ensureCandidate` 动态获取或创建 | **现场调用 `buildSnap` 生成新快照**并 `refreshCandidateSnapshot` | 立即调用 `setProjectLifecycle(project.id, 'ACTIVE', '一键立项后启动')` |
| `ProjectSetup` (`n1`) | `ozon-react/src/components/ProjectSetup.jsx` | **不存在** | 无 | 无 | 无（纯 Legacy 业务说明页，不调 Store） |
| 测试文件用例 | `t6Store.test.mjs`, `wbScenario.test.mjs`, `costScenario.test.mjs`, `gateEngine.test.mjs`, `supplier.test.mjs`, `t6UiContract.test.mjs` | 单元与集成测试套件 | mock 或测试用 candidate | mock 或测试用 snapshot | 验证冻结字段、多项目关联、异常拦截等 |

---

### 3. `t6Store.createProject` 真实硬门禁审计

深入 `ozon-react/src/utils/t6/t6Store.js` (lines 329–367)，其实际执行的校验如下：

```javascript
export function createProject({ candidateId, creationSnapshotId, name }) {
  const candidate = getCandidate(candidateId)
  if (!candidate) throw new Error('T6_STORE: 候选不存在')
  const creationSnapshot = getSnapshot(creationSnapshotId)
  if (!creationSnapshot) throw new Error(`T6_STORE: 立项快照 ${creationSnapshotId} 不存在（fail-close）`)
  if (creationSnapshot.candidateId !== candidateId) {
    throw new Error(`T6_STORE: 立项快照 candidateId(${creationSnapshot.candidateId}) 与候选(${candidateId}) 不一致（fail-close）`)
  }
  if (String(creationSnapshot.sourceProductId) !== String(candidate.sourceProductId)) {
    throw new Error(`T6_STORE: 立项快照 sourceProductId 与候选不一致（fail-close）`)
  }
...
```

#### 硬门禁审计结果表：
- **candidate 必须存在？** `YES`（缺失抛错：`T6_STORE: 候选不存在`）
- **creationSnapshot 必须存在？** `YES`（缺失抛错：`T6_STORE: 立项快照 xx 不存在（fail-close）`）
- **snapshot.candidateId 必须匹配？** `YES`（不一致抛错：`立项快照 candidateId 与候选不一致（fail-close）`）
- **snapshot.sourceProductId 必须匹配？** `YES`（不一致抛错：`立项快照 sourceProductId 与候选不一致（fail-close）`）
- **bizStatus 是否检查？** `NO`（完全未检查）
- **projectIds 是否检查？** `NO`（无长度或上限检查，直接追加）
- **重复项目是否检查？** `NO`（无去重逻辑，每次生成新 UUID 与自增 projectCode）

---

### 4. Candidate 业务状态与 Gate 真实关系

系统定义的候选业务状态集合为：
`['观察', '待调研', '待立项', '暂缓', '淘汰']`

审计结论：**`NOT_USED`**
- **证据 1**：`t6Store.createProject` 源码中只有针对 Candidate 实体、Snapshot 实体以及 ID 匹配的 4 项断言，绝无任何判断 `candidate.bizStatus === '待立项'` 的代码。
- **证据 2**：`CandidatePoolPage.jsx:101` 的前端保护逻辑仅有一句：`if (!cand.latestSnapshotId) { flush('缺少评分快照，无法立项'); return }`，未对 `cand.bizStatus` 做任何拦截。
- **证据 3**：`ProductScoringSection.jsx:173` 在执行立项时通过 `ensureCandidate` 创建的候选默认业务状态为 `'观察'`，随后直接 `createProject` 成功。
- 结论：`bizStatus` 在当前架构中纯属 **UI 展示与人工标记字段**，未在任何层级构成业务立项 Gate。

---

### 5. 重复立项行为与幂等性审计

测试场景：对同一个拥有合法快照 `SNAP-1` 的候选商品 A，连续执行两次立项：
```javascript
const p1 = createProject({ candidateId: A.id, creationSnapshotId: 'SNAP-1' })
const p2 = createProject({ candidateId: A.id, creationSnapshotId: 'SNAP-1' })
```

审计结论：**`NOT_IDEMPOTENT`**
- **实际结果**：成功创建两个完全独立的 Project 记录（如 `RU-2026-001` 和 `RU-2026-002`），各自拥有全新 UUID。
- **关联影响**：`candidate.projectIds` 变为包含两个项目 ID 的数组 `[p1.id, p2.id]`。
- **设计初衷**：在 `t6Store.test.mjs:95` 明确标有设计规范 `I4: 一个 Candidate 可创建多个 SKU Project（1:0..N）`，允许从同一款候选规格衍生出不同颜色、包装或子型号的多个 SKU 项目。
- **风险缺口**：UI 与 Store 层均未针对误触、重复点击或同规格重复立项做任何幂等限制或预警机制。

---

### 6. `ProductScoringSection` 的直接立项路径审计

位于 `ozon-react/src/components/dashboard/sections/ProductScoringSection.jsx:169-190`：
1. 用户在选品评分表格行点击「创建项目」。
2. 调用 `ensureCandidate` 传入当前 canonical 商品信息；若已存在则返回原 candidate。
3. **关键点**：`buildSnap(row, candidate.id)` 实时依据用户眼前看到的表格数据重新构建完整快照。
4. 调用 `refreshCandidateSnapshot(candidate.id, snap.id)` 将候选实体的 `latestSnapshotId` 替换为新生成的快照。
5. 调用 `createProject({ candidateId: candidate.id, creationSnapshotId: snap.id })` 正式落库。
6. 调用 `setProjectLifecycle(project.id, 'ACTIVE', '一键立项后启动')`。

**核心发现**：
- 该路径完全绕过了 `CandidatePoolPage` 的任何人工业务流程与状态管理。
- 无论候选原本是「观察」还是「暂缓」，该路径都会直接覆盖刷新候选的 `latestSnapshotId`，并立项且将项目状态立即置为 `ACTIVE`。

---

### 7. `CandidatePoolPage` 的立项路径审计

位于 `ozon-react/src/components/t6/CandidatePoolPage.jsx:99-109`：
```javascript
  const handleCreateProject = (cand) => {
    // 候选池展示的就是 latestSnapshotId 对应的快照，立项复用该快照（与评分页"冻结当前可见评分"语义一致）
    if (!cand.latestSnapshotId) { flush('缺少评分快照，无法立项'); return }
    try {
      const project = createProject({ candidateId: cand.id, creationSnapshotId: cand.latestSnapshotId })
      setProjectLifecycle(project.id, 'ACTIVE', '一键立项后启动')
      flush(`已创建项目 ${project.projectCode}`)
    } catch (e) {
      flush(e.message || String(e))
    }
  }
```

**门禁审计事实**：
- **当前唯一 UI 门禁**：`!cand.latestSnapshotId`（缺失则弹提示拦截）。
- **完全没有检查**：`bizStatus`（是否为待立项）、`owner`（是否有负责人）、`marketEvidence`（是否有市场表现依据）、`procurement quote`（是否有 Phase 5 采购报价）、`risk`（是否有合规认证风险）。
- **生命周期处理**：创建成功后，同样立即调用 `setProjectLifecycle(project.id, 'ACTIVE')` 跳过 DRAFT。

---

### 8. `Project.source` Schema 真实字段与下游使用统计

在 `t6Store.js:344-351` 中，项目创建时的 `project.source` 结构严格定义如下：

| 字段名 | 字段类型 | 必填/实际总有 | 下游代码直接读取次数 | 是否允许 null | 作用说明 |
| :--- | :--- | :--- | :---: | :--- | :--- |
| `kind` | `string` | 实际总有 (硬编码 `'candidate'`) | 0 | 否 | 来源类型，预留多类型 |
| `candidateId` | `string` | 必填 | 0 | 否 | 溯源候选实体 UUID |
| `sourceProductId` | `string` | 必填 | 0 | 否 | 对应源商品业务 ID / UID 字符串 |
| `candidateName` | `string` | 必填 | 0 | 否 | 候选商品名称副本 |
| `category` | `string` | 实际总有 | 0 | 可空串 | 叶子类目副本 |
| `creationSnapshotId` | `string` | **必填 (Fail-close)** | **12+ 处** | **严禁 null** | **立项评分与输入事实不可变快照 ID** |

> 注：`project.source` 中除 `creationSnapshotId` 被下游高频读取外，其余字段目前仅作为审计溯源元数据留存，无业务逻辑直接读取。

---

### 9. `creationSnapshotId` 全仓定向搜索与读取位置分析

| 文件路径 | 读取代码与上下文 | 用途说明 | 如果为 null 会发生什么 |
| :--- | :--- | :--- | :--- |
| `ozon-react/src/utils/t6/t6Store.js:468` | `if (sourceSnapshotId !== project.source.creationSnapshotId)` | 校验成本场景必须归属于该项目的立项快照 | 抛出致命 Error：`T6_STORE: 成本场景快照归属不一致`，阻止保存成本场景 |
| `ozon-react/src/utils/t6/costScenarioAdapter.js:94` | `const snap = getSnapshot(project.source.creationSnapshotId)` | 组装 Ozon 场景时校验快照存在性并提取物理参数 | 抛出 Error：`T6_COST: 立项快照 null 不存在（场景上下文缺失）` |
| `ozon-react/src/utils/t6/costScenarioAdapter.js:253` | `const snap = getSnapshot(project.source.creationSnapshotId)` | 组装 WB 场景时校验快照存在性并提取物理参数 | 抛出 Error：`T6_COST: 立项快照 null 不存在（场景上下文缺失）` |
| `ozon-react/src/utils/t6/gateEngine.js:57` | `evaluate: (p) => (p.source?.creationSnapshotId ? PASS : FAIL)` | RESEARCH 阶段推进检查：市场评分是否存在 | 阶段推进检查直接判 **FAIL**，Stage Gate 亮红灯，阻断向后推进 |
| `ozon-react/src/components/t6/ProjectDetailPage.jsx:90` | `project?.source?.creationSnapshotId ? getSnapshot(...) : null` | 详情页只读加载立项快照实体 | 安全返回 null，页面不白屏，但评分区域与快照时间显示为空 |
| `ozon-react/src/components/t6/ProjectDetailPage.jsx:382,390` | `disabled={!snapshot}` | 控制「使用 WB 核算」与「使用 Ozon 核算」按钮的可点击状态 | **两个核算按钮永久置灰 (disabled)**，用户无法进入测算面板 |
| `ozon-react/src/components/t6/ProjectListPage.jsx:41` | `project.source.creationSnapshotId ? getSnapshot(...) : null` | 项目列表页卡片提取立项快照评分 | 安全返回 null，卡片不崩溃，但不显示评分与决策徽章 |

---

### 10. `sourceSnapshotId` 全仓依赖分析

`sourceSnapshotId` 是每个 `CostScenario` 实体上的必填外键字段：
1. **强引用绑定**：在 `createCostScenario` 执行时，强制校验 `sourceSnapshotId === project.source.creationSnapshotId`。
2. **上下文冻结**：成本场景不但要记录自己测算输出的利润，更必须冻结“当时测算基于哪个商品物理规格与市场基准”。
3. **不可篡改性**：即使候选池之后重新刷新了评分快照（`latestSnapshotId` 变化），已有 Project 的 `creationSnapshotId` 和 CostScenario 的 `sourceSnapshotId` 保持永久不可变。

---

### 11. `createCostScenario` 深入审计

读取 `ozon-react/src/utils/t6/t6Store.js:450-485`：
- **是否要求 sourceSnapshotId？** `YES`（参数必填，未传则不满足相等校验）。
- **是否必须等于 project.source.creationSnapshotId？** `YES`（硬编码严格全等校验：`if (sourceSnapshotId !== project.source.creationSnapshotId) throw new Error(...)`）。
- **是否检查 Snapshot 实体存在？** `YES`（`const snap = getSnapshot(sourceSnapshotId); if (!snap) throw new Error(...)`）。
- **如果 Project 没 Snapshot 是否完全无法创建成本场景？** **完全无法创建（`FULLY_BLOCKED`）**。不仅调用适配器组装 payload 会在前端抛错，即使绕过适配器直接调 Store 也会被拦截。

---

### 12. `ProjectDetailPage.jsx` 对 Snapshot 的真实依赖

在 `ProjectDetailPage.jsx` 中：
1. **评分显示**：通过 `const score = snapshot?.scoreResult` 读取，若无快照则不渲染 `ScoreCell`、`DecisionBadge`、`ContextBadge`，安全降级。
2. **时间与规则**：通过 `snapshot.createdAt` 和 `snapshot.versions.rulesVersion` 读取，若无快照则显示 `'—'`。
3. **核算入口控制**：
   ```jsx
   <Button disabled={!snapshot} onClick={() => setWbContext({ prefill: buildWbPrefill({ snapshot }) })}>使用 WB 核算</Button>
   <Button disabled={!snapshot} onClick={() => setOzonContext({ prefill: buildOzonPrefill({ snapshot }) })}>使用 Ozon 核算</Button>
   ```
   若 `snapshot` 为 null，**两个核心成本核算入口按钮均直接 disabled**！
4. **预填数据提取**：
   - `buildOzonPrefill({ snapshot })` 从 `snapshot.sourceInputs` 提取 `price_rub`, `weight_kg`, `dims`, `commission_rfbs`。
   - `buildWbPrefill({ snapshot })` 从 `snapshot.sourceInputs` 提取 `name`, `actualWeightG`, `dims`, `sellerRevenueRub`。
   若 snapshot 为 null，预填参数全部为空，核算面板无法带入商品基础参数。
5. **Stage Gate 推进**：
   `gateDeps.snapshot` 取 `snapshot.scoreResult.status`。若无快照，项目推进至 `RESEARCH` 阶段时被 `snapshot_exists` 判定为 FAIL，进入阻断红灯状态。

**综合表现**：如果无 Snapshot，UI **不会白屏**，但会呈现**严重功能残废（核算按钮置灰 + 无法推进阶段）**。

---

### 13. `ProjectSetup.jsx` (`n1`) 真实身份审计

经逐行核验 `ozon-react/src/components/ProjectSetup.jsx`（306 行）：
- **组件职责**：为早期的静态展示页（节点 `n1`），展示俄罗斯电商宏观数据、5 大基础品类（吹风机、枕头、发膜、精油、手套）的静态卡片，点击后通过 `onNavigateToResearch` 导向市场调研页面（节点 `n2`）。
- **与 T6 关系**：**零关系**。不调用 `t6Store`，不涉及 `createProject`，不生成 Candidate 或 Snapshot。
- **定位判定**：**纯 Legacy 说明页**，非真实立项入口，亦非 Gate 逻辑所在。

---

### 14. Gate 相关代码定向搜索与真实架构

搜索全仓 Gate 相关文件：
- 真实文件存在：`ozon-react/src/utils/t6/gateEngine.js`（176 行）及其测试 `gateEngine.test.mjs`。
- **架构机制**：
  - 它是**阶段推进建议引擎（Stage Gate）**，负责在项目跨越阶段（`PIPELINE → RESEARCH → COSTING → SAMPLING → COMPLIANCE → PRODUCTION → LAUNCH → OPERATIONS → REVIEW`）时，对前向路径进行逐段规则校验。
  - **核心设计**：Gate **只建议，不自动改状态，不强行阻止管理员覆盖推进**（VERDICT = RED 时允许用户填写理由后强制推进）。
  - **快照依赖点**：
    1. `RESEARCH` 段：检查 `snapshot_exists`（必须有 `creationSnapshotId`）。
    2. `SAMPLING` 段：如果快照中包含 `BLOCKED_LOGISTICS`（超重/超大件），触发硬性警告。

---

### 15. T6 Scoring Snapshot 真实 Schema 与冻结语义

通过 `buildScoringSnapshot` 确认，一个合法的 T6 Scoring Snapshot 包含以下 5 大数据包：
1. **`scoreResult`**：
   - `totalScore` (综合分), `grade` (评级 A/B/C/D), `gradeTentative` (暂定标识)
   - `decision` (`{ status, action }`), `status` (如 `['BLOCKED_LOGISTICS']`, `['MARGIN_RISK']`)
   - `dimensions` (商业可行性五维评分：需求、利润、物流、竞争、价格空间、运营)
   - `supplyGap` (供需缺口信号等级与子排名)
   - `context`, `evidenceCoverage`, `ruleVersion`, `matchedProductType`
2. **`sourceInputs`（商品基础事实层）**：
   - `name`, `price_rub`, `avg_price_rub`, `sales_rub_28d`, `units_28d`
   - `weight_kg`, `dims` (`[length, width, height]`), `ship_mode`
   - `commission_rfbs`, `commission_fbs`, `commission_fbo`, `commission_fbp`
   - `conv_rate`, `cart_add_rate`, `exposure`, `card_visits`, `reviews`, `gross_margin`, `ad_share`, `sign_rate`, `oos_days_share`, `stock`, `turnover`
3. **`marketContext`**：
   - `matchMethod`, `matchedProductType`, `domain`, `sampleSize`, `benchmarkGeneratedAt`
4. **`versions`**：
   - `rulesVersion`, `engineVersion`, `candidateDatasetVersion`, `benchmarkVersion`
5. **`explanations`**：
   - `strengths`, `risks`, `missingMetrics`

---

### 16. Snapshot 双重作用确认：不仅是评分数字

回答核心问题：**Snapshot 是否同时承担“项目创建时的商品事实冻结”作用？**
结论：**`YES`**
- **代码确凿证据**：`costScenarioAdapter.js` 中的 `buildOzonPrefill` 与 `buildWbPrefill` 在帮助用户进行成本核算时，商品售价、重量、长宽高三维尺寸、自发货佣金率，**全部直接从 `snapshot.sourceInputs` 中读取**。
- Snapshot 在 T6 架构中实质上充当了**商品立项基准数据凭证（Product Specification & Performance Baseline）**，而不仅是打分工具输出。

---

### 17. MI Candidate 当前具备的证据资产

| Evidence 字段 | 是否结构化 | 是否不可变 | 是否有版本/时间 | 是否与 Candidate 稳定关联 | 内容说明 |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `source_niche_uid` | 是 | 是 | 随 Niche 绑定 | 是（稳定外键） | 利基市场唯一全局 UID |
| `source_run_id` | 是 | 否 (可跨批次更新) | 是 (RUN 编号) | 是 | 市场情报分析运行批次 |
| `source_system` | 是 | 是 | 否 | 是 | 恒为 `'WB_MARKET_INTELLIGENCE'` |
| `marketEvidence.mos` | 是 | 否 (随批次刷新) | 随 `syncedAt` | 是 | 市场机会指数 (0-100) |
| `marketEvidence.pfs` | 是 | 否 (随批次刷新) | 随 `syncedAt` | 是 | 选品可行性指数 (0-100) |
| `marketEvidence.gmv` | 是 | 否 (随批次刷新) | 随 `syncedAt` | 是 | 利基市场月 GMV (卢布) |
| `marketEvidence.price` | 是 | 否 (随批次刷新) | 随 `syncedAt` | 是 | 利基平均价格 (卢布) |
| `marketEvidence.weightG` | 是 | 否 (随批次刷新) | 随 `syncedAt` | 是 | 算法预估单重 (克) |
| `marketEvidence.heavy` | 是 | 否 (随批次刷新) | 随 `syncedAt` | 是 | 大件标识 |
| `marketEvidence.risks` | 是 | 否 (随批次刷新) | 随 `syncedAt` | 是 | 风险标签数组 |
| `marketEvidence.eacStatus` | 是 | 否 (随批次刷新) | 随 `syncedAt` | 是 | EAC 认证要求 |
| `Phase 5 Quote` | 是 | 否 (人工可保存覆盖) | 有 `updatedAt` | 是 (UID 优先检索) | 供应商报价、实测重、包装尺寸、头程尾程、预估毛利率、凭证级别 |

---

### 18. MI Market Evidence 是否能替代 Snapshot

结论：**`PARTIAL_EVIDENCE_ONLY`**
- **不可替代原因**：
  1. `marketEvidence` 记录的是**利基市场宏观表现**（利基均价、类目总 GMV、大盘转化率），而非单个具体商品的 canonical 数据。
  2. 缺失具体的商品长宽高包装尺寸（`dims` 为空）。
  3. 缺失平台各渠道佣金率（`commission_rfbs` 等为空）。
  4. 缺失 T6 评分模型的五维可行性分数、供需缺口（Supply Gap）排名与准入建议。
  5. 最关键的是，`marketEvidence` 在 `candidate` 实体上是可变的（跨批次同步时会被刷新覆盖），不具备 Snapshot 的**不可变持久化实体特性**。

---

### 19. Phase 5 Quote 是否能替代 Snapshot

结论：**`PARTIAL_EVIDENCE_ONLY`**
- **价值分析**：Phase 5 采购报价已经具备了下游核算急需的物理事实（出厂价 `factoryPriceCny`、实测重 `weightG`、包装三边尺寸 `dims`、目标售价 `targetPriceRub`）。
- **不可直接替代原因**：
  1. 报价数据目前存储在 `miStore.js` 的 `quotes` 对象中，是按 `uid` / `name` 索引的**可编辑草稿**，每次点击“保存”都会覆盖，不具备 `schemaVersion`、自增 ID 以及不可变性。
  2. 缺少需求端的市场表现指标与评分。
  3. 未在 `t6Store` 中注册为独立快照实体，无法被 `getSnapshot(id)` 读取。

---

### 20. Project 创建后到底需要什么“冻结事实”（下游反推表）

| 下游需求点 | 消费组件 / 引擎 | 当前事实源 | 必须来自 Snapshot？ |
| :--- | :--- | :--- | :---: |
| 商品名称与类目 | `ProjectDetailPage` 标题 | `project.source.candidateName` / `project.name` | 否（Project 自身已有） |
| 参考售价 (RUB) | `costScenarioAdapter` 预填 | `snapshot.sourceInputs.price_rub` | **是**（当前代码无回退分支） |
| 实测单重 (kg/g) | `costScenarioAdapter` 预填 | `snapshot.sourceInputs.weight_kg` | **是**（当前代码无回退分支） |
| 包装尺寸 (L/W/H) | `costScenarioAdapter` 预填 | `snapshot.sourceInputs.dims` | **是**（当前代码无回退分支） |
| Ozon 自发货佣金 | `costScenarioAdapter` 预填 | `snapshot.sourceInputs.commission_rfbs` | 仅 Ozon 预填依赖 |
| 物流阻断状态 | `gateEngine` (SAMPLING 门禁) | `snapshot.scoreResult.status` | **是**（直接判定 BLOCKED_LOGISTICS） |
| 立项决策评级 | `ProjectDetailPage` / `ProjectListPage` 徽章 | `snapshot.scoreResult.grade` / `totalScore` | 仅展示依赖（缺失可隐藏） |
| 快照唯一凭证外键 | `createCostScenario` 强校验 | `project.source.creationSnapshotId` | **是（底层强校验不可空）** |

---

### 21. `FactoryTrialCandidatesSection` 独立性审计

审计结果：
- 该组件纯粹消费 `../../data/factoryTrialCandidates.js` 中的静态测试数据。
- 不创建 T6 Candidate 实体。
- 不生成 T6 Snapshot。
- 不调用 `createProject`，也没有任何“立项”按钮。
- 明确标注为独立试卖观察泳道，**绝对未进入 T6 Candidate/Project 正式流程**。

---

### 22. Candidate 类型事实分类

在 `t6Store.js` 中：
- Candidate 实体中**不存在显式的 `candidateType` 枚举字段**。
- 当前候选类型的区分完全是：**`INFERRED_BY_SOURCE_FIELDS`**（通过源字段隐式推断）：
  - **静态评分候选**：拥有数字型 `sourceProductId`，无 `source_niche_uid`，无 `source_system`。
  - **MI 市场情报候选**：拥有 `source_system === 'WB_MARKET_INTELLIGENCE'`，拥有 `source_niche_uid` 和 `marketEvidence`。

---

### 23. `source_system` 唯一性排查

全仓检索确认：
- 当前代码中唯一的非静态业务源系统字符串就是 **`'WB_MARKET_INTELLIGENCE'`**。
- 此外只有测试文件中的 `'STATIC_SCORING'` mock。

---

### 24. Project `source.kind` 审计

在 `t6Store.js:345` 中：
- `project.source.kind` 目前在生产代码中**永远硬编码为 `'candidate'`**。
- 虽在测试用例中见到了预留的 `'manual'` mock，但系统中目前不存在任何其他来源的立项流程。

---

### 25. Project 创建后的生命周期审计

在目前现存的两个 `createProject` 真实调用点中：
- `CandidatePoolPage.jsx:104`：`createProject(...)` 刚刚返回，紧接着执行 `setProjectLifecycle(project.id, 'ACTIVE', '一键立项后启动')`。
- `ProductScoringSection.jsx:185`：`createProject(...)` 刚刚返回，紧接着执行 `setProjectLifecycle(project.id, 'ACTIVE', '一键立项后启动')`。
- **事实确认**：虽然 `createProject` 底层将 `lifecycleStatus` 默认初始化为 `'DRAFT'`，但**两个现有业务入口在立项后全部立即人工强制置为了 `'ACTIVE'`**，导致现实中所有立项项目立即进入「进行中」状态。

---

### 26. Creation Gate 与 Project Lifecycle 的概念隔离

必须严格在架构认知上区分两个概念：
1. **Creation Gate（立项准入门禁）**：在 Candidate → Project 转化时执行。当前 Store 层硬门禁为“必须存在匹配的合法 Snapshot”，UI 层硬门禁为“必须有 latestSnapshotId”。
2. **Project Lifecycle（项目生命周期状态）**：项目创建后的业务状态流转（`DRAFT → ACTIVE → PAUSED → ARCHIVED / KILLED`），以及阶段推进（`PIPELINE → ... → REVIEW`）。
- 绝不能将“项目当前生命周期是不是 ACTIVE”当作立项准入门禁；两者在时间轴与实体层级上完全不同。

---

### 27. 重复立项幂等缺口的业务影响

- **现象**：同一 Candidate 在连点两次「创建项目」后，会生成两个具有不同编号的正式项目，`candidate.projectIds` 记录两个项目。
- **正向意图**：业务上允许一个品类候选衍生多个颜色/包装的 SKU 项目（1:N）。
- **负向缺陷**：没有提供“该候选已立项”的提示；若用户无意重复点击，会无端产生冗余垃圾项目，且项目无法彻底物理删除（只能 KILLED）。

---

### 28. `ProjectListPage.jsx` 行为审计

- 不展示 `candidateId`，不显示来源利基 UID。
- 不检测重复候选，不自动合并同候选项目。
- 在展示上，对 `creationSnapshotId` 为 null 具有容错能力（`snap ? ... : null` 安全取值，不导致报错）。

---

### 29. 历史项目兼容性判定

- 判定结果：**`FAIL_CLOSE`（整体架构属于严格失败闭锁型）**。
- 虽然列表页与详情页的展示层采用了 `project.source?.creationSnapshotId ? ... : null` 这种可选链容错，但是：
  - 一旦用户尝试推进阶段，`gateEngine` 立即判 FAIL；
  - 一旦用户尝试创建成本场景，`t6Store.createCostScenario` 强制断言不等抛错；
  - 详情页的 Ozon 与 WB 核算入口按钮被直接禁用。
- 因此，任何缺失 `creationSnapshotId` 的 Project 在实际业务链路中均处于**半瘫痪闭锁状态**。

---

### 30. `CostScenario` 深度受阻判定

- 判定结果：**`FULLY_BLOCKED`（完全阻塞）**。
- 若没有合法 Snapshot，下游成本场景既无法在 UI 端进入（按钮禁用），也无法在适配器组装 payload（抛错），更无法在 Store 层通过快照归属校验（抛错）。

---

### 31. Project Downstream 完整依赖总表

| 下游业务能力 | 是否依赖 `creationSnapshotId` | 是否依赖 Snapshot 内部数据 | 无 Snapshot 真实后果 | 敏感程度 |
| :--- | :---: | :---: | :--- | :---: |
| **Project 列表展示** | 是 (可选链) | 是 (展示评分/决策) | 仅隐藏评分与决策徽章，列表正常显示 | 低 (UI 兼容) |
| **Project 详情展示** | 是 (可选链) | 是 (展示评分/决策) | 隐藏评分徽章，显示项目基础信息 | 低 (UI 兼容) |
| **Stage Gate 推进** | 是 | 是 (`status` 物流阻断) | `RESEARCH` 阶段被判 FAIL，前向推进全红灯 | **极高 (流程阻断)** |
| **Ozon 成本核算入口** | 是 | 是 (预填售价/重量/尺寸/佣金) | 详情页按钮直接 disabled，无法开启面板 | **极高 (入口阻断)** |
| **WB 成本核算入口** | 是 | 是 (预填名称/重量/尺寸/售价) | 详情页按钮直接 disabled，无法开启面板 | **极高 (入口阻断)** |
| **Ozon 场景组装** | 是 | 否 (只校验 snapshot.id 存在) | `buildOzonScenarioPayload` 抛致命异常 | **致命 (代码崩溃)** |
| **WB 场景组装** | 是 | 否 (只校验 snapshot.id 存在) | `buildWbScenarioPayload` 抛致命异常 | **致命 (代码崩溃)** |
| **成本场景持久化** | 是 | 是 (校验快照归属一致性) | `createCostScenario` 抛致命异常并回滚 | **致命 (存储拒收)** |
| **项目工作流 (36 节点)** | 否 | 否 | 节点状态更新与备注保存不受影响 | 无影响 |
| **供应商 / 样品 / 合规** | 否 | 否 | 当前为 placeholder 占位或未评价 | 无影响 |

---

### 32. 05B-2C Cross-check（只读复核）

检查 `CandidateScoringGateway.jsx`：
```javascript
export default function CandidateScoringGateway({ candidate, snapshot, onOpenScoring }) {
  const isMiCandidate = candidate?.source_system === 'WB_MARKET_INTELLIGENCE'
  const hasSnapshot = Boolean(snapshot?.scoreResult)
...
```
- **源码事实**：`CandidateScoringGateway.jsx` 内部绝对没有引入 `getSnapshot`，也没有直接从 `t6Store` 读取数据，而是严格通过组件 props 接收 `snapshot`。
- **调用方**：由上层 `CandidateDetailDrawer.jsx:36` 执行 `getSnapshot(candidate.latestSnapshotId)` 后统一下发。
- **契约审计结论**：**`PARENT_READS_SNAPSHOT`**（完全符合 05B-2C 设计契约，无偏差）。

---

### 33. 三种 Gate 模式技术可行性与破坏面矩阵

| Gate 架构模式 | 技术可行性 | 下游破坏面 | 深度技术解释 |
| :--- | :---: | :---: | :--- |
| **模式一：继续强制 Scoring Snapshot**<br>*(维持现状)* | **`BLOCKED`** | **`LOW`**<br>(零破坏) | 下游契约完全不需要任何改动，所有成本与 Gate 正常运行。但由于 MI 候选（`wb-niche-*`）与打分库（`scoring_candidates.json`）在商品颗粒度上不相交，**MI 候选将永久无法立项**，业务流转彻底卡死。 |
| **模式二：允许 Project 无 Snapshot**<br>*(放宽 createProject)* | **`LOW`** | **`HIGH`**<br>(毁灭性破坏) | 仅改 `createProject` 让 `creationSnapshotId` 可为 null 极其容易，但下游全是地雷：`createCostScenario` 崩溃、`costScenarioAdapter` 崩溃、详情页核算按钮禁用、`gateEngine` 阶段推进红灯，必须将全套下游同时魔改为 null-tolerant，架构风险最高。 |
| **模式三：新增另一种不可变 Evidence Snapshot**<br>*(假设评估)* | **`MEDIUM`** | **`MEDIUM`**<br>(可控局部适配) | 为 MI 候选设计专用的不可变立项快照（或扩展快照类型，融合 `marketEvidence` 与 Phase 5 `quote`），让它在 `t6Store` 拥有合法快照身份。`costScenarioAdapter` 仅需做预填字段 fallback（优先从 quote 读取长宽高、单重与出厂价），下游所有强校验（快照存在性与 ID 一致性）无需任何破坏性变更。 |

---

### 34. 核心 GAP 归纳（G1 ~ G5）

- **`G1 — PROJECT CREATION GATE`**：Store 层只把守“快照归属与存在性”，UI 层只把守 `latestSnapshotId` 是否为空；业务状态（`bizStatus`）、负责人（`owner`）、市场证据（`marketEvidence`）、采购报价（`procurement quote`）在系统层均未设立真正的立项前置审查守门。
- **`G2 — SNAPSHOT SEMANTICS`**：Snapshot 当前同时承担了“模型评分结果”与“立项时商品物理规格/价格基准冻结”两项语义。MI 候选虽然缺乏商品级评分模型结果，但往往已经具备采购实测的物理规格。两项语义混淆导致有物理事实的 MI 候选因缺分而无法使用下游成本工具。
- **`G3 — DOWNSTREAM SNAPSHOT DEPENDENCY`**：下游成本核算体系（`createCostScenario`、`buildOzonScenarioPayload`、`buildWbScenarioPayload`）以及阶段推进（`gateEngine`）对 `creationSnapshotId` 建立了强一致性与非空强校验，无法接受纯粹无快照的 Project。
- **`G4 — PROJECT IDEMPOTENCY`**：`createProject` 完全不具备幂等性保护，虽然满足了 1 个 Candidate 生成多个 SKU Project 的衍生需求，但在单次立项意图中缺乏防误触与去重保护。
- **`G5 — MI EVIDENCE COVERAGE`**：MI 候选自身的 `marketEvidence` 与 Phase 5 `quote` 已经覆盖了长宽高、实测重量、出厂价与目标售价，但未能被固化为不可变的 `t6Store` 快照实体，无法被下游标准接口 `getSnapshot()` 读取。

---

### 35. CONTRACT SUMMARY（固定契约摘要块）

```text
CREATE PROJECT

CreateProject Function: export function createProject({ candidateId, creationSnapshotId, name })
Call Sites: CandidatePoolPage.jsx (handleCreateProject), ProductScoringSection.jsx (handleCreateProject)
Candidate Required: YES (fail-close)
Snapshot Required: YES (fail-close)
CandidateId Match: YES (fail-close, creationSnapshot.candidateId === candidateId)
SourceProductId Match: YES (fail-close, String(creationSnapshot.sourceProductId) === String(candidate.sourceProductId))
BizStatus Required: NO (NOT_USED)
Owner Required: NO (NOT_USED)
Existing Project Guard: NO (None)
Idempotency: NOT_IDEMPOTENT (creates new Project with incremented projectCode each call)

PROJECT SOURCE

Source Kind: candidate (hardcoded in createProject)
Source Fields: kind, candidateId, sourceProductId, candidateName, category, creationSnapshotId
CreationSnapshot Field: project.source.creationSnapshotId
Null Tolerance: FAIL_CLOSE (costScenarioAdapter and t6Store throw if null; ProjectListPage and ProjectDetailPage handle null safely for display but costing is disabled)

SNAPSHOT

Snapshot Primary Role: Score Result + Product Physical Inputs + Context/Rules Versions Freezing
Snapshot Fields: id, candidateId, sourceProductId, scoreResult, sourceInputs, marketContext, versions, explanations, createdAt, schemaVersion
Immutable: YES (append-only, write throws on key conflict, no update function)
Candidate Bound: YES (candidateId field checked on createProject)
SourceProduct Bound: YES (sourceProductId field checked on createProject and refreshCandidateSnapshot)

MI CANDIDATE

Market Evidence: Available (synced in candidate.marketEvidence)
Procurement Evidence: Available via miStore / procurementIdentity (Phase 5 quote)
Scoring Snapshot: None (latestSnapshotId is null)
Current Project Eligibility: INELIGIBLE (blocked at UI gate and Store hard gate)

DOWNSTREAM

Project Detail Snapshot Dependency: PARTIAL (renders basic info, disables Ozon/WB scenario buttons)
Cost Scenario Snapshot Dependency: FULL (createCostScenario and adapters throw fail-close error if snapshot missing)
Supply Chain Snapshot Dependency: NOT_EVALUATED (module not yet implemented, placeholder)
Compliance Snapshot Dependency: NOT_EVALUATED (module not yet implemented, placeholder)
Listing Snapshot Dependency: NOT_EVALUATED (module not yet implemented, placeholder)
Operations Snapshot Dependency: NOT_EVALUATED (module not yet implemented, placeholder)

FACTORY TRIAL

T6 Candidate: NO (static catalogue items in factoryTrialCandidates.js)
Snapshot: NO (does not generate snapshot)
Project Creation: NO (no createProject call or entry)

05B2C CROSS-CHECK

Scoring Gateway Snapshot Read: PARENT_READS_SNAPSHOT (passed via props, no getSnapshot call in Gateway)

RISK CLASS

Remove Snapshot Requirement: HIGH (breaks costScenarioAdapter, createCostScenario, gateEngine)
Alternative Evidence Artifact: MEDIUM (requires defining immutable snapshot entity or adapter)
Recommended Next Step: ALTERNATE_EVIDENCE_DESIGN_REQUIRED
```

---

### 36. 推荐下一步行动 (Recommended Next Step)

根据本轮只读审计事实，推荐的唯一合理架构演进方向为：
> **`ALTERNATE_EVIDENCE_DESIGN_REQUIRED`**

**核心研判理由**：
1. 直接解除 Snapshot 门禁（`Remove Snapshot Requirement`）属于高危自毁方案，下游成本核算、场景持久化与阶段推进会被全线破坏。
2. 强行把 MI 候选塞入传统打分体系（`KEEP_EXISTING_GATE`）客观不可行，因为利基市场并非具体的 SKU 商品，不具备真实曝光、加购、竞品评价等 canonical 字段。
3. 最佳演进路径是在 TASK 05C-2 中设计**“立项证据快照契约（Project Evidence Snapshot Contract）”**：为 MI 候选将 `marketEvidence` 与 Phase 5 `quote` 冻结成一种不可变立项快照，使下游 `costScenarioAdapter` 能平滑读取实测重量尺寸，同时保全 `createCostScenario` 强引用的完整性。
