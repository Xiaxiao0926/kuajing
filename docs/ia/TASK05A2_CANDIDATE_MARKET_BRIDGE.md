# KUAIJING-IA-REFACTOR-V1 · TASK 05A-2 实施报告
## Opportunity → Candidate 稳定来源与 Market Evidence Bridge

> **实施目标**：打通 Opportunity → Candidate 结构化数据桥梁，消除数据降维。  
> **实施边界**：本轮不修改 Candidate UI、不创建评分快照、不修改 Project、不处理 Phase 5 采购结构化。

---

### 一、新增 source_niche_uid

在 `t6Store.js` 的 Candidate Schema 中以兼容方式新增可选字段 `source_niche_uid`：
* **字段定义**：`source_niche_uid?: string`
* **来源**：由 `candidateMarketBridge.resolveNicheUid(niche)` 解析（优先取 `niche.uid`，次选 `niche.niche_uid`）。
* **兼容性**：原有 Candidate 未设置该字段时为 `undefined`，保持 `schemaVersion: 1` 不变，不执行物理数据库迁移。
* **索引支持**：`t6Store.js` 新增并导出 `findCandidateBySourceNicheUid(nicheUid)`，支持按全局利基 UID 快速精确检索候选。

---

### 二、marketEvidence Schema

在 `candidateMarketBridge.js` 中纯函数定义 `buildCandidateMarketEvidence(niche, runId, effectiveVerdict)`，返回严格固定的结构化市场证据对象：

```javascript
{
  schemaVersion: 1,

  nicheUid: string | null,        // 全局利基业务标识
  runId: string | null,           // 分析批次编号（如 RUN-20260917-001）

  mos: number | null,             // 市场机会综合评分
  pfs: number | null,             // 选品潜力分（统一由 pfs 或旧 cfs 映射而来）

  gmv: number | null,             // 市场销售额（来自 gmv 或 revenue）
  growth: number | null,          // 市场增长率
  buyout: number | null,          // 市场平均签收率
  sellers: number | null,         // 市场在售卖家数

  price: number | null,           // 市场平均售价
  weightG: number | null,         // 预估单重（克，来自 weight_g）
  heavy: string | null,           // 大件标识（来自 heavy，如 'YES'/'NO'）

  verdict: string | null,         // 验证池决策（优先取 validationOverride，次取 niche.verdict）
  risks: string[],                // 风险标识列表（数组）

  eacStatus: string | null,       // EAC 认证要求（来自 eac_status 或 eacStatus）
  certificationStatus: string | null, // 资质认证要求（来自 certification_status 或 certificationStatus）

  syncedAt: string                // 最后一次从 MI 同步的时间戳 (ISO 8601)
}
```

* **纯搬运原则**：不进行任何单位换算、汇率折算、价格猜测或百分比清洗，忠实保留原始商业证据。

---

### 三、Stable sourceProductId

* **构造规则**：
  * 若存在有效 `nicheUid`，构造为：`wb-niche-${nicheUid}`（如 `wb-niche-wb_niche_d0198d600bed`）。
  * 若缺失 `nicheUid`（历史遗留或第三方调用），平滑退回历史兼容格式：`wb-niche-${niche.name}`。
* **业务价值**：消除了以前基于中文利基名称构造导致的不同类目同名利基碰撞风险，同时利基更名时由于 UID 稳定，不会分裂出重复候选。

---

### 四、Legacy Candidate Backfill

新版推流函数 `promoteToT6Candidate` 实现了严格的四步查重策略：
1. **STEP 1**：按 `source_niche_uid` 查找已存在的候选。
2. **STEP 2**：按 `stableSourceProductId`（`wb-niche-${uid}`）查找候选。
3. **STEP 3**：若前两步未找到，且当前利基包含 `nicheUid`，检查是否存在历史格式的候选 `wb-niche-${niche.name}`：
   * 若历史候选无 `source_niche_uid`，判定为未升级的旧候选，执行 **Backfill**（补全 `source_niche_uid` 并同步 `marketEvidence`）。
   * 若历史候选已记录相同的 `source_niche_uid === nicheUid`，复用该候选。
   * 若历史候选已记录不同的 `source_niche_uid !== nicheUid`，**禁止复用**，防止同名不同 UID 碰撞，进入 STEP 4。
   * **不可变约束**：对被 Backfill 的旧候选，绝对不修改其原有的 `sourceProductId = wb-niche-${name}`，确保对下游 Project 或历史 Snapshot 的引用一致性不被破坏。
4. **STEP 4**：若上述步骤均未命中，调用 `ensureCandidate` 创建全新 Candidate。

---

### 五、重复推流与跨批次 Evidence Sync

* **行为修正**：此前对于已存在的候选，推流直接返回 `{ candidate, created: false }`，属于完全 NO-OP；UI 提示的“已在候选池中，信息已同步更新”实际上并未更新任何数据。
* **现在行为**：调用 `t6Store.syncCandidateMarketEvidence(id, bridge)`：
  * 更新 `source_niche_id`、`source_niche_uid`、`source_run_id`、`source_system` 以及 `marketEvidence`。
  * 自动刷新 `updatedAt` 时间戳。
  * 在 T6 审计日志系统写入 `kind: 'market_evidence_sync'` 的状态跟踪记录。
  * **严禁篡改保护**：严格锁定并保护已存在的 `id`、`sourceProductId`、`candidateName`、`categoryLeaf`、`categoryFull`、`latestSnapshotId`、`bizStatus`、`owner`、`notes`、`projectIds` 以及 `addedAt`，确保用户手工录入的负责人、业务状态、备注及关联项目完整不丢失。

---

### 六、保持不解决的 Snapshot Gate

* **明确保留的边界**：
  * 本轮绝对不伪造任何 Scoring Snapshot，不将 MOS/PFS 偷换为 T4/T6 综合评分。
  * MI Candidate 的 `latestSnapshotId` 在本轮之后**依然保持为 `null`**。
  * 在 `CandidatePoolPage.jsx` 中点击 [创建项目] 触发的门禁校验（“缺少评分快照，无法立项”）**保持原样生效**。
  * MI Candidate 如何合规立项进入 Project 将在后续专职任务中独立设计 Gate 机制。

---

### 七、测试套件验证结果

* **专项测试**：`node tests/ia-candidate-market-bridge.test.mjs`
  * 15 项核心场景与边界测试全部通过（含 CFS 回退、UID 优先级、稳定 Key 构造、重复推流去重、跨批次证据同步、利基改名防分裂、同名不同 UID 隔离、历史遗留候选 Backfill、业务字段保护、Snapshot 物理隔离、Legacy 碰撞隔离、静态评分候选兼容以及 T6 审计日志生成）。
* **全量回归**：
  * `npm test`：129/129 通过
  * `npm run test:golden`：56/56 黄金案例全绿
  * `npm run test:sync`：双端对拍零差异
  * `node tests/ia-opportunity-shell.test.mjs`：9/9 通过
  * `node tests/ia-market-research-embedded.test.mjs`：10/10 通过
  * `node tests/ia-purity-gateway.test.mjs`：10/10 通过
  * `node tests/ia-navigation-acceptance.test.mjs`：8/8 通过
  * `npm run test:web-persistence`：通过
  * `npm --prefix ozon-react run build`：构建成功
