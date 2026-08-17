# T6-0 SKU 项目数据模型与流程设计（V1.1 hardening）

> 阶段：T6-0（只做规格）。V1.1 = 审核 hardening：身份/快照/持久化契约钉死（8 项）。
> 铁律：不改变 T4 任何模型结论；人工业务状态与模型评分是两套正交信息。
> 修订记录：V1.1 采纳需求方审核意见——stable identity、完整快照、latest/creation 双指针、1:0..N、lifecycleStatus 与 stage 分离、Candidate 级日志、CostScenario 可复算、逐实体存储、roadmap-v1 不可变模板、Gate NOT_EVALUATED。

---

## 1. 设计原则（不变 + 强化）

| # | 原则 | 含义 |
|---|---|---|
| P1 | **快照不可变** | 立项那一刻的评分依据永远不变；模型/数据更新不得改写历史 |
| P2 | **人工状态与模型评分分离** | Grade/Decision 是模型结论；人工业务状态是业务动作，并列展示 |
| P3 | **workflow 模板不可变、每项目实例化** | `roadmap-v1` 是 immutable WorkflowTemplate；每个 SkuProject 持有一份实例 |
| P4 | **Gate 是建议 + 人工 override** | 三档 GREEN/YELLOW/RED + 强制推进必填理由；未实现依赖返回 NOT_EVALUATED |
| P5 | **一切决策留痕（含立项前）** | Candidate 与 Project 两个阶段的状态/决策全部入 DecisionLog |
| P6 | **成本场景可复算且版本化** | CostScenario 冻结完整输入/配置/输出；append-only；基线是项目引用不是场景字段 |
| P7 | **稳定身份优先** | UUID 是主键；`sourceProductId`（原始 商品ID）是业务稳定身份；`candidateIndex` 仅调试定位 |
| P8 | **逐实体存储** | 每实体一个 persist key（`t6.<entity>.<uuid>`），杜绝整数组互相覆盖 |

---

## 2. 实体总览与关系（V1.1）

```text
ScoringEngine(T4, 只读) + scoring_candidates.json（含 source_product_id，纯加法字段）
   │
   ├── ScoringSnapshot（不可变：scoreProduct 完整输出 + 解释 + 源输入 + 市场上下文 + 版本）
   │
Candidate（sourceProductId 稳定身份；latestSnapshotId 当前评分；人工 bizStatus）
   │  projectIds: string[]  —— 1:0..N（一个候选机会可衍生多个中国 SKU 项目）
   ▼
SkuProject（marketCode 'RU' + RU-YYYY-NNN 人类编号；UUID 主键）
   ├── source.creationSnapshotId（立项快照，永久冻结）
   ├── lifecycleStatus（DRAFT/ACTIVE/PAUSED/ARCHIVED/KILLED）× stage（PIPELINE..REVIEW，无 HOLD/KILLED）
   ├── workflow（roadmap-v1 模板实例，每项目独立）
   ├── costing（scenarios[] append-only；baselineScenarioId 项目级引用）
   ├── supplier / samples / compliance / logistics / listing / launch / operations / settlement
   └── DecisionLog（subjectType: candidate|project，立项前日志也可记录）
```

---

## 3. 实体定义（V1.1 钉死）

### 3.1 ScoringSnapshot（不可变快照 = 完整可审计、可追溯的评分依据）

> 措辞精确化（V1.1 hardening）：快照保存 scoreResult 全量输出 + explanations + 本次实际 canonical 输入 + 市场上下文 + 四版本号，属于**完整可审计、可追溯**；它不包含当时的完整候选池/BSR 全量基准资产，因此不承诺脱离历史数据资产后仍能 100% 独立重算。

```ts
interface ScoringSnapshot {
  id: string                     // uuid；不可修改
  candidateId: string            // Candidate.id；不可修改（不依赖 index 反查）
  sourceProductId: string        // 原始 商品ID（稳定业务身份）；不可修改
  createdAt: string              // ISO；不可修改

  // 评分完整输出：structuredClone(scoreProduct 最终返回值) —— 不手工抄缩水版
  scoreResult: ScoreProductOutput   // 含 totalScore/grade/gradeTentative/context/evidenceCoverage/
                                    // dimensions(score/weight/available/coverage/subs 全子指标/
                                    //   demand 含 marketScaleScore + candidateStrengthScore)/
                                    // supplyGap/status/decision/ruleVersion/matchedProductType/benchmarkSampleSize

  // 解释输出（同一次评分）
  explanations: {
    strengths: string[]
    risks: string[]
    missingMetrics: string[]
  }

  // 本次评分实际使用的 canonical 原始字段（复现输入）
  sourceInputs: {
    price_rub: number|null
    avg_price_rub: number|null
    sales_rub_28d: number|null
    units_28d: number|null
    conv_rate: number|null
    cart_add_rate: number|null
    exposure: number|null
    card_visits: number|null
    reviews: number|null
    gross_margin: number|null
    commission_fbs: number|null
    commission_fbo: number|null
    commission_rfbs: number|null
    commission_fbp: number|null
    ad_share: number|null
    weight_kg: number|null
    dims: [number,number,number]|null
    ship_mode: string
    sign_rate: number|null
    oos_days_share: number|null
    stock: number|null
    turnover: number|null
    revenue_loss_rate: number|null
    category_leaf: string
    category_full: string
  }

  // 市场上下文（本次评分实际采用的匹配/基准）
  marketContext: {
    matchMethod: 'exact'|'partial'|'none'
    matchedProductType: string|null
    domain: string|null
    sampleSize: number|null
    benchmarkGeneratedAt: string|null   // bsr_market_benchmarks.json 生成时间
  }

  // 版本（回答"当初按哪套规则/哪份数据做的决定"）
  versions: {
    rulesVersion: string          // config/scoring_rules.json version
    engineVersion: string         // SCORING_ENGINE_VERSION 常量（t4-frozen-1）
    candidateDatasetVersion: string // scoring_candidates.json 的 generatedAt/source
    benchmarkVersion: string      // bsr_market_benchmarks.json 版本/生成时间
  }
}
```

- **全字段不可修改**。刷新 = 生成新快照（新 uuid），旧快照不删除、不更新。

### 3.2 Candidate（候选池条目）

```ts
interface Candidate {
  id: string                     // uuid；系统生成
  sourceProductId: string        // 原始 商品ID，稳定业务身份（加入候选时写入，不可改）
  candidateIndex: number         // 当前数据行号，仅调试/定位（数据重生成后失效，禁止作身份）
  candidateName: string          // 自动带入
  categoryLeaf: string
  categoryFull: string

  latestSnapshotId: string       // "当前评分"指针；刷新评分 = 生成新快照并更新本指针
  addedAt: string
  updatedAt: string

  bizStatus: '观察'|'待调研'|'待立项'|'暂缓'|'淘汰'   // 人工业务状态（无"已立项"——那是派生事实）
  owner: string
  notes: string

  projectIds: string[]           // 系统派生：已创建的项目 id 列表（append；不随人工状态修改）
  // 派生事实：projectIds.length > 0 → "已产生项目"（UI 展示，不入人工状态枚举）
}
```

- "是否已经立过项目"是事实不是意见：由 `projectIds.length > 0` 派生，禁止人工改写。
- `latestSnapshotId`（当前评分）与 `SkuProject.source.creationSnapshotId`（立项评分）**永久分离**：候选以后从 76 分变 61 分，不影响任何既有项目的立项依据。

### 3.3 SkuProject

```ts
interface SkuProject {
  id: string                     // uuid（主键、storage key 依据）
  projectCode: string            // RU-YYYY-NNN，人类可读编号（非主键）
  marketCode: 'RU'               // 市场代码（未来 IN-2028-001 无需重构）
  name: string
  schemaVersion: 1

  source: {
    kind: 'candidate' | 'manual'
    candidateId: string | null
    sourceProductId: string | null
    candidateName: string
    category: string
    creationSnapshotId: string | null   // 立项快照；项目创建后永久冻结（不随候选刷新变化）
  }

  lifecycleStatus: 'DRAFT'|'ACTIVE'|'PAUSED'|'ARCHIVED'|'KILLED'   // 生命周期（事实）
  stage: ProjectStage            // 项目当前阶段（PIPELINE..REVIEW，不含 HOLD/KILLED）
  goLiveAt: string | null        // 上线里程碑（workflow 商品上架节点完成时写入；不是 lifecycleStatus）

  workflow: {
    templateVersion: string      // 'roadmap-v1'（不可变模板版本）
    states: WorkflowState[]
  }

  product: {}
  suppliers: string[]            // Supplier.id 引用（T7）
  samples: []
  compliance: {}
  costing: {
    scenarios: string[]          // CostScenario.id 引用（append-only）
    baselineScenarioId: string | null   // 基线是项目级引用，换基线不修改历史场景
  }
  logistics: {}
  listing: {}
  launch: {}
  operations: {}
  settlement: {}

  decisionLog: string[]          // DecisionLog.id 引用（append-only）
  createdAt: string
  updatedAt: string
}
```

- 暂停与恢复：`lifecycleStatus=PAUSED` 时 `stage` 保留（如 PAUSED + SAMPLING）；恢复后仍在原阶段。
- "已上线"是 milestone（`goLiveAt` / 上架节点 done），项目上线后继续 OPERATIONS。

### 3.4 ProjectStage（不含 HOLD/KILLED）

```ts
type ProjectStage =
  | 'PIPELINE' | 'RESEARCH' | 'COSTING' | 'SAMPLING'
  | 'COMPLIANCE' | 'PRODUCTION' | 'LAUNCH'
  | 'OPERATIONS' | 'REVIEW'
```

- 生命周期状态与阶段完全正交：`{lifecycleStatus, stage}` 两字段，杜绝"status=暂缓 + stage=HOLD"式重复语义。

### 3.5 WorkflowState + WorkflowTemplate（不可变模板）

```ts
interface WorkflowTemplate {     // roadmap-v1 冻结定义（由 data/roadmap.js 生成并入库）
  version: string                // 'roadmap-v1'
  phases: Array<{ phaseId: string; title: string; order: number }>
  nodes: Array<{ nodeId: string; phaseId: string; title: string; order: number }>
}

interface WorkflowState {
  nodeId: string
  status: 'pending'|'active'|'done'|'skipped'
  updatedAt: string | null
  updatedBy: string | null
  note: string | null
}
```

- **模板不可变**：`roadmap-v1` 的 nodeId/phaseId/title/order 一旦入库不得修改；36 节点未来变化 → 新建 `roadmap-v2`，老项目继续用 v1 定义渲染自己的进度。
- **兼容定义（修正）**：
  - `roadmap-statuses`（persist key）= **legacy 全局项目看板状态**，与 T6 项目实例**完全独立**、互不读写；
  - 新项目创建时 `workflow.states` 初始化为模板全 pending，**不继承** `roadmap-statuses`。

### 3.6 Supplier / SupplierQuote（T7 实体，T6 预留）

```ts
interface Supplier {
  id: string; projectId: string
  name: string; contact: string
  quotes: string[]               // SupplierQuote.id 引用（append-only）
  notes: string
  createdAt: string; updatedAt: string
}
interface SupplierQuote {
  id: string; supplierId: string
  version: number
  unitPriceCny: number; currency: 'CNY'|'RUB'|'USD'
  moq: number; exw: boolean; fob: boolean
  packagingSpec: string
  toolingFeeCny: number|null; sampleFeeCny: number|null
  leadTimeDays: number; paymentTerms: string; remark: string
  createdAt: string
}
```

### 3.7 CostScenario（可复算历史利润）

```ts
interface CostScenario {
  id: string                     // uuid；append-only
  projectId: string
  channel: 'OZON'|'WB'|'MANUAL'
  name: string                   // 'Ozon Scenario v1' 等
  createdAt: string

  calculatorVersion: string      // 对应核算引擎版本常量
  sourceSnapshotId: string|null  // 输入来源的评分快照

  inputPayload: object           // 对应 OZON/WB 引擎实际完整输入（冻结）：
                                 // purchaseCost / domesticShipping / labelingFee / commission /
                                 // adRate / paymentFee / agencyFee / returnLoss / priceRub /
                                 // weightKg / dims / category / 等全部参与计算的参数
  resolvedConfig: {              // 计算时实际采用的配置（冻结）
    exchangeRate: number
    selectedTariff: string|null
    commission: number|null
    configVersionOrHash: string
  }
  outputPayload: {               // 引擎输出（冻结）
    logisticsCny: number|null
    platformCost: number|null
    profit: number|null
    netMarginPct: number|null
    finalPriceRub: number|null
    note: string
  }
}
```

- **基线不是场景字段**：`SkuProject.costing.baselineScenarioId`（项目级引用），换基线不修改任何历史场景。
- 半年后费率/假设变了，旧场景仍可用 inputPayload+resolvedConfig+calculatorVersion 完整复算。

### 3.8 DecisionLog（统一日志，含立项前）

```ts
interface DecisionLog {
  id: string
  subjectType: 'candidate' | 'project'
  subjectId: string              // Candidate.id 或 SkuProject.id
  projectId: string | null       // project 域事件必填；candidate 域事件为 null
  kind: 'status_change'|'stage_change'|'gate_override'|'snapshot_create'|'project_create'|'note'
  from: string | null
  to: string
  reason: string                 // gate_override 强制必填，其余强烈建议
  at: string
  by: string
}
```

- 立项前事件全部可记录：`观察→待调研`、`待调研→待立项`、`暂缓`、`淘汰`、`刷新评分(snapshot_create)`、`加入候选`。
- 存储：逐条 key（§7），列表由索引缓存聚合。

---

## 4. 字段权限矩阵（V1.1）

| 实体 / 字段 | 自动带入 | 人工编辑 | 不可修改 | 历史快照 | 版本化 |
|---|---|---|---|---|---|
| ScoringSnapshot.全部 | — | — | ✅ | ✅ | — |
| Candidate.sourceProductId/name/leaf/full | ✅ | — | ✅ | — | — |
| Candidate.candidateIndex | ✅（加入时） | — | ✅ | — | — |
| Candidate.latestSnapshotId | ✅（加入/刷新） | — | ✅（替换=新快照+新指针） | — | — |
| Candidate.bizStatus/owner/notes | — | ✅ | — | — | — |
| Candidate.projectIds | ✅（立项时追加） | — | ✅（仅系统追加） | — | — |
| SkuProject.id/projectCode/marketCode/source/createdAt | ✅ | — | ✅ | — | — |
| SkuProject.source.creationSnapshotId | ✅（创建时） | — | ✅（永久冻结） | ✅ | — |
| SkuProject.name | — | ✅ | — | — | — |
| SkuProject.lifecycleStatus | ✅（创建=DRAFT） | ✅（暂停/恢复/归档/淘汰） | — | — | — |
| SkuProject.stage | ✅（Gate 建议） | ✅（确认/override） | — | — | — |
| SkuProject.goLiveAt | ✅（上架节点完成） | — | ✅ | — | — |
| SkuProject.workflow.states | ✅（模板初始化） | ✅（每节点） | — | — | — |
| SkuProject.costing.baselineScenarioId | — | ✅（指向既有场景） | — | — | — |
| SkuProject.decisionLog / costing.scenarios / suppliers | ✅（追加引用） | — | ✅（仅追加） | — | ✅（append-only） |
| CostScenario / SupplierQuote / DecisionLog 记录本身 | ✅（创建时冻结） | — | ✅（禁 update/delete） | — | ✅ |

**规则**：
1. 不可修改字段的写入在 store 层校验拒绝（fail-close），UI 不提供入口。
2. 刷新评分 = 新 ScoringSnapshot + 更新 `latestSnapshotId`；旧快照字节不变。
3. append-only 集合只提供 create/read，不导出 update/delete。

---

## 5. Stage Gate（三档 + NOT_EVALUATED）

### 5.1 检查结果四态

```text
GREEN          可以推进            → 全部 ✅
YELLOW         可以推进，但存在风险  → 存在 ⚠
RED            不建议推进            → hard block（快照 BLOCKED_LOGISTICS）
NOT_EVALUATED  依赖模块尚未实现       → 例如 T6-2 时供应商检查（Supplier 属 T7）
               不算失败、不判黄/红
```

### 5.2 检查项（按阶段）

| 阶段跃迁 | 建议检查 | 未实现时 |
|---|---|---|
| PIPELINE → RESEARCH | 市场评分存在 · 候选池状态确认 | — |
| RESEARCH → COSTING | ≥1 个 CostScenario · 目标售价已填 | CostScenario 联动未实现 → NOT_EVALUATED |
| COSTING → SAMPLING | ≥1 个供应商报价（⚠ 毛利<15% 仅提示） | Supplier 未实现 → NOT_EVALUATED |
| SAMPLING → COMPLIANCE | 样品记录 · ⚠ 合规未完成 | 样品域未实现 → NOT_EVALUATED |
| COMPLIANCE → PRODUCTION | 合规完成 · 认证计划 | 合规域未实现 → NOT_EVALUATED |
| PRODUCTION → LAUNCH | Listing 草稿 · 库存计划 | — |
| LAUNCH → OPERATIONS | 上架完成 · 冷启动计划 | — |
| OPERATIONS → REVIEW | 提示性：30/60/90 数据回填 | — |

### 5.3 人工 override

- YELLOW/RED 下可"强制推进"，必须填写理由 → `DecisionLog(kind='gate_override')`。
- 不做：程序自动禁止、审批链、角色权限（T6 不引入）。

---

## 6. 模块间自动带入映射（T6-2 实现，本阶段只定义）

| 目标模块 | 动作 | 自动带入字段 |
|---|---|---|
| Ozon 核算 | 「计算利润」 | price_rub、weight_kg、dims、category_leaf（→佣金）、commission_fbs/fbo/rfbs/fbp、rub_per_cny（config） |
| Ozon 核算 | 「保存到项目」 | 生成 `CostScenario{channel:'OZON', inputPayload: 引擎完整输入, resolvedConfig, outputPayload}` |
| WB 核算 | 「保存到项目」 | 同上 `channel:'WB'` |

- 引擎算法与费率保持 T2/T4 冻结；T6 只搬运输入并冻结输出。
- `scoring_candidates.json` 增加 `source_product_id`（纯加法）：评分引擎忽略该字段，1000 SKU 分布逐位不变。

---

## 7. 存储与迁移（逐实体存储，钉死）

```text
t6.candidate.<uuid>        Candidate
t6.project.<uuid>          SkuProject
t6.snapshot.<uuid>         ScoringSnapshot
t6.log.<uuid>              DecisionLog
（T7 起同构扩展：t6.supplier.<uuid> / t6.supplierQuote.<uuid> / t6.costScenario.<uuid>）
```

- **每个实体一个 key**：电脑 A 改项目001、电脑 B 改项目002 不会互相覆盖；append-only 可被逐条审计。
- **UUID 是唯一主键**；`RU-2026-001` 仅人类可读编号（projectCode）；`marketCode` 字段支持未来多市场。
- 允许 `t6.index.projects`（可重建缓存，仅加速列表页）；**缓存永远不作为真相源**，损坏时由逐实体 key 重建。
- `schemaVersion` 进实体；读取按版本迁移（T6 只有 v1）。
- 引擎版本常量：`SCORING_ENGINE_VERSION = 't4-frozen-1'`（引擎公式变更时递增）。
- 既有 key 不动：`roadmap-statuses`（legacy 全局看板，与 T6 完全独立）、`node-updates` 保持现状。
- 写入纪律：所有 T6 读写走 `t6Store`（T6-1 实现），禁止组件直写 localStorage/persist。

---

## 8. UI 规划（只描述，T6-1 起实现）

1. 商品中心导航：

```text
商品中心
  ├─ 候选池      → Candidate 列表（商品/评分/Decision/Context/市场规模/候选表现/利润/物流/Supply Gap/负责人/状态/更新时间）
  ├─ SKU 项目    → SkuProject 卡片（RU-2026-001、lifecycleStatus、stage、进度 N/36、Score+Decision+Context、
  │                 供应商数/当前成本/目标售价/净利率、下一步=第一个未完成节点）
  └─ 商品中心(档案) → 长期 SKU 资料（T6-3）
```

2. 评分页动作：表格行 [加入候选]；Drawer [加入候选] [创建项目]。
3. 项目详情（T6-2+）：六 Tab（概览/产品/供应链/成本与物流/合规/运营）；36 节点 workflow 放右侧 timeline/抽屉。
4. 候选池展示"已产生项目"派生徽标（projectIds.length>0），与人工状态并列。

---

## 9. T4 冻结边界重申（T6 全程）

- 不改 λ=0.5 / 六维权重 / 评级线 / Grade / Decision / Gate / Supply Gap / Context / Evidence / 适配器 / CEL / 配置 / golden。
- 冻结分布 A1/B191/C448/D169/不可评级191 保持不变（适配层回归持续锁定）。
- T6 只消费评分输出并快照，不反向影响评分。

## 10. T6-1 边界（本阶段之后执行）

**做**：候选池页面、[加入候选]、刷新评分生成新快照、一键创建 SKU Project、项目列表、每项目独立 workflow 初始化（模板 v1 全 pending）、DecisionLog 基础留痕、`t6Store`（逐实体 key + 校验）。
**不做**：Supplier UI、CostScenario 与 Ozon/WB 正式联动、Stage Gate 引擎、合规数据域、订单/运营数据（留给 T6-2+/T7/T8）。

**T6-1 golden/invariant（数据级验收）**：

```text
1. 源数据重新排序 → Candidate 仍指向同一商品（按 sourceProductId）
2. 刷新评分 → 旧 Snapshot 完全不变（字节级）
3. 项目创建后刷新 Candidate → Project.creationSnapshotId 及其快照不变
4. 一个 Candidate 可以创建多个 SKU Project（1:0..N）
5. PAUSED → 恢复后仍回原 stage
6. 任何旧 Snapshot / Log 不能 update/delete（store API 层面不存在）
7. 旧 roadmap-statuses 完全不受 T6 影响
8. 评分分布仍为 1 / 191 / 448 / 169 / 191
```

## 11. 审核要点（V1.0 已审，V1.1 为修订版）

V1.1 已按审核意见修订 8 项：稳定身份 / 完整快照 / 双指针分离 / 1:0..N / lifecycleStatus×stage / 立项前日志 / 可复算成本 / 逐实体存储；roadmap-v1 冻结为不可变模板；Gate 增加 NOT_EVALUATED。
