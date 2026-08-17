# T6-0 SKU 项目数据模型与流程设计

> 阶段：T6-0（只做规格，不写业务功能/页面）。审核通过后才放行 T6-1（候选池 + 一键立项）。
> 目标：把系统从"工具箱"升级为"业务操作系统"——SKU 成为贯穿 评分→立项→供应链→成本→合规→上架→运营→回款 的一等业务对象。
> 铁律：**不改变 T4 的任何模型结论**（λ=0.5、六维权重、Grade/Decision/Gate/Supply Gap 全部冻结）；人工业务状态与模型评分是两套正交信息。

---

## 1. 设计原则

| # | 原则 | 含义 |
|---|---|---|
| P1 | **快照不可变** | 立项那一刻的评分依据（ScoringSnapshot）永远不变；模型/数据以后更新不得改写历史决策依据 |
| P2 | **人工状态与模型评分分离** | Grade/Decision 是模型结论；候选池人工状态（观察/待调研/…）是业务动作。UI 必须并列展示，不互相覆盖 |
| P3 | **workflow 模板化、每项目实例化** | 36 节点 roadmap 是模板（`templateVersion`），每个 SkuProject 持有自己的一份 WorkflowState |
| P4 | **Gate 是建议 + 人工 override** | 不搞死板审批；hard block（如 BLOCKED_LOGISTICS）只"明确提示不建议"，人工可强制推进但必须记录理由 |
| P5 | **一切决策留痕** | 状态/阶段/强制推进全部写入 DecisionLog（含操作者与理由），这是未来 T9 复盘与 T10 AI 的数据基础 |
| P6 | **成本场景版本化** | CostScenario 是 append-only 版本列表，不同渠道/不同假设并列比较，不做覆盖式编辑 |
| P7 | **先模型后页面** | T6-0 冻结数据结构后，后续所有页面（供应商/成本/物流/运营）都只读写本模型 |

---

## 2. 实体总览与关系

```text
ScoringEngine(T4, 只读)
   │
   ├── ScoringSnapshot（不可变快照，立项依据）
   │        ▲ 引用
   │        │
Candidate（候选池条目：候选索引 + 人工业务状态 + 快照引用）
   │  [一键立项]
   ▼
SkuProject（项目主实体：projectCode、阶段、每项目 workflow）
   ├── WorkflowState[]（36 节点模板实例）
   ├── CostScenario[]（成本场景，版本化）
   ├── Supplier[]（T7 实体，T6 预留字段）
   └── DecisionLog[]（决策日志，append-only）
```

- `Candidate` 与 `SkuProject` 是 1:0..1（一个候选最多立项一次；项目可手工创建而不经候选池）。
- `ScoringSnapshot` 是值对象（不可变），可被 Candidate 与 SkuProject 同时引用（同一快照 id）。

---

## 3. 实体定义（TypeScript 风格）

### 3.1 ScoringSnapshot（不可变快照）

```ts
interface ScoringSnapshot {
  id: string                     // uuid；不可修改
  createdAt: string              // ISO；不可修改
  schemaVersion: 1               // 不可修改

  // 来源（不可修改）
  candidateIndex: number         // 对应 scoring_candidates.json 行号
  candidateName: string
  categoryLeaf: string
  categoryFull: string

  // 模型输出（不可修改；字段与 scoreProduct 输出一一对应）
  totalScore: number | null
  grade: 'A'|'B'|'C'|'D'|null
  gradeTentative: boolean
  context: 'HIGH'|'MEDIUM'|'LOW'|'LOW_MARKET_CONTEXT'
  evidenceCoverage: number       // 0-1，两位小数
  dimensions: { [k in 'demand'|'competition'|'price_opportunity'|'profitability'|'logistics'|'operations']: {
    score: number | null
    available: boolean
    coverage: number
    marketScaleScore?: number | null       // 仅 demand
    candidateStrengthScore?: number | null // 仅 demand
  }}
  supplyGap: { signal: number; rank: string; demandRank: number; shortageRank: number; entryOpenness: number } | null
  status: string[]               // flags：MARGIN_RISK/REVIEW_REQUIRED/BLOCKED_LOGISTICS/NEEDS_DATA/LOW_MARKET_CONTEXT
  decision: { status: string; action: string; reason: string }

  // 市场基准（不可修改）
  matchedProductType: string | null
  benchmarkSampleSize: number | null
  marketPriceBand: { p25: number; p50: number; p75: number } | null

  // 版本（不可修改）：回答"当初按哪套规则做的决定"
  ruleVersion: string            // config/scoring_rules.json version
  engineVersion: string          // 引擎版本常量（见 §7）
}
```

**不可修改 = 全字段**。创建后禁止任何写入路径；快照永远通过"重新生成新快照"而不是"修改旧快照"演进。

### 3.2 Candidate（候选池条目）

```ts
interface Candidate {
  id: string                     // uuid；系统生成
  candidateIndex: number         // 系统自动带入（加入候选时）
  candidateName: string          // 自动带入，展示用（源名；不做二次编辑）
  categoryLeaf: string           // 自动带入
  categoryFull: string           // 自动带入

  snapshotId: string             // 加入时生成的 ScoringSnapshot id（自动带入）
  snapshotCreatedAt: string      // 自动带入

  bizStatus: '观察'|'待调研'|'待立项'|'已立项'|'暂缓'|'淘汰'   // 人工业务状态（与 Grade/Decision 正交）
  owner: string                  // 人工编辑：负责人
  notes: string                  // 人工编辑：备注
  projectId: string | null       // 系统写入：已立项时关联 SkuProject.id

  addedAt: string                // 系统生成
  updatedAt: string              // 系统生成
}
```

- UI 展示 = 快照里的评分字段 + 人工字段并列；`bizStatus=已立项` 由系统在一键立项时写入（也可人工改回）。
- **候选池显示"加入时评分"（快照）**；提供"刷新评分"动作 = 生成新快照并替换 snapshotId（旧快照保留）。

### 3.3 SkuProject

```ts
interface SkuProject {
  id: string                     // uuid
  projectCode: string            // 系统生成：RU-YYYY-NNN（年 + 年序，如 RU-2026-001）
  name: string                   // 人工编辑（默认 = 候选名）
  schemaVersion: 1

  source: {
    kind: 'candidate' | 'manual' // candidate=一键立项；manual=手工创建
    candidateIndex: number | null
    candidateName: string
    category: string
    snapshotId: string | null    // 立项快照引用（手动创建可为 null）
  }

  status: '进行中'|'待决策'|'暂缓'|'已上线'|'已归档'   // 人工业务状态
  stage: ProjectStage            // 系统建议 + 人工确认（见 §5）
  workflow: {
    templateVersion: string      // 模板版本（T6-1 起 = 'roadmap-v1'）
    states: WorkflowState[]      // 每 SKU 独立的 36 节点进度
  }

  // 域数据（逐域解锁，T6 起逐步填充；全部为普通可变数据）
  product: {}                    // 产品定义域（T6-2+）
  suppliers: string[]            // Supplier.id 引用（T7 填充）
  samples: []                    // 样品记录（T6-2+）
  compliance: {}                 // 合规域
  costing: {
    scenarios: CostScenario[]    // 版本化列表（append-only）
  }
  logistics: {}
  listing: {}
  launch: {}
  operations: {}
  settlement: {}

  decisionLog: DecisionLog[]     // append-only
  createdAt: string
  updatedAt: string
}
```

### 3.4 ProjectStage（枚举与 roadmap 映射）

```ts
type ProjectStage =
  | 'PIPELINE'      // 候选观察（对应 phase-1 前半）
  | 'RESEARCH'      // 市场调研/核算（phase-1）
  | 'COSTING'       // 成本与报价锁定（phase-2 后半）
  | 'COMPLIANCE'    // 合规与账号（phase-3）
  | 'SAMPLING'      // 样品/包材（phase-2 前半）
  | 'PRODUCTION'    // 生产与物流（phase-4）
  | 'LAUNCH'        // 上架与冷启动（phase-5 前半）
  | 'OPERATIONS'    // 广告/库存/结算（phase-5 后半 + phase-6）
  | 'REVIEW'        // 复盘与迭代（phase-7）
  | 'HOLD'          // 暂缓（人工）
  | 'KILLED'        // 淘汰（人工，终态）
```

- 阶段与 roadmap phase 是多对多映射（阶段是"项目当前重心"，36 节点是"执行清单"）；阶段由 Gate 建议 + 人工确认，不自动推导。

### 3.5 WorkflowState（模板实例）

```ts
interface WorkflowState {
  nodeId: string                 // 模板节点 id（n1..n39 等）
  status: 'pending'|'active'|'done'|'skipped'   // 人工操作（沿用现有三态 + skipped）
  updatedAt: string | null
  updatedBy: string | null
  note: string | null            // 人工备注（如"样品已寄出"）
}
```

- **兼容迁移**：现有全局 `persist('roadmap-statuses')` 保持不动（作为"模板默认态/整体看板"继续可用）；T6-1 起项目创建时初始化 `workflow.states` 为全 pending，不从全局状态继承。
- 全局 ProgressOverview/ProjectFlow 继续读旧 key；项目内进度读 `project.workflow.states`。

### 3.6 Supplier（T7 实体，T6 预留字段）

```ts
interface Supplier {
  id: string
  projectId: string
  name: string                   // 人工
  contact: string                // 人工
  quotes: SupplierQuote[]        // 版本化报价（append-only）
  notes: string
  createdAt: string
  updatedAt: string
}

interface SupplierQuote {
  id: string
  version: number                // v1/v2...
  unitPriceCny: number           // 人工
  currency: 'CNY'|'RUB'|'USD'    // 人工
  moq: number                    // 人工
  exw: boolean                   // 人工
  fob: boolean                   // 人工
  packagingSpec: string          // 人工（如 100只/盒）
  toolingFeeCny: number | null   // 模具费
  sampleFeeCny: number | null    // 样品费
  leadTimeDays: number           // 交期
  paymentTerms: string           // 付款条件
  remark: string
  createdAt: string
}
```

### 3.7 CostScenario（版本化成本场景）

```ts
interface CostScenario {
  id: string
  projectId: string
  name: string                   // 人工（如 'Ozon Scenario v1'）
  channel: 'OZON'|'WB'|'MANUAL'  // 来源
  createdAt: string
  isBaseline: boolean            // 人工标记基线场景（同项目仅一个）

  // 自动带入（来自评分快照/canonical 候选；不可手工改，见 §6 映射）
  inputs: {
    priceRub: number | null      // 价格（price>0 用 price，否则 avg_price）
    weightKg: number | null
    dims: [number,number,number] | null
    categoryLeaf: string
    commissionRates: { fbs: number|null; fbo: number|null; rfbs: number|null; fbp: number|null }
    rubPerCny: number            // 从 config/settings.json 带入
  }
  // 人工计算参数
  assumptions: {
    adRatio: number | null       // 广告占比假设
    otherCostCny: number | null  // 其他成本
  }
  // 结果（由对应核算引擎计算写入，人工可覆盖 scenario 但会生成新版本）
  results: {
    netMarginPct: number | null
    logisticsCny: number | null
    platformFeePct: number | null
    finalPriceRub: number | null
    note: string
  }
}
```

- 比较规则（T7 UI）：同项目多场景并列显示净利率；"建议渠道"仅作提示文案，**不自动替人决策**。

### 3.8 DecisionLog（决策日志，append-only）

```ts
interface DecisionLog {
  id: string
  projectId: string
  at: string                     // ISO
  by: string                     // 操作者（当前无账号体系 → 固定 'user' 或未来接入 WP 用户）
  kind: 'status_change'|'stage_change'|'gate_override'|'snapshot_create'|'note'
  from: string                   // 旧值（可空）
  to: string                     // 新值
  reason: string                 // 人工必填（gate_override 强制必填，其余强烈建议）
}
```

示例（用户口径）：

```text
2026-08-17  待调研 → 已立项    原因：市场规模高、物流可行，计划采购3家供应商样品
2026-08-23  样品测试 → 暂缓    原因：实际供应商报价超过目标成本18%
```

---

## 4. 字段权限矩阵

| 实体 / 字段 | 自动带入 | 人工编辑 | 不可修改 | 历史快照 | 版本化 |
|---|---|---|---|---|---|
| ScoringSnapshot.全部 | — | — | ✅ | ✅ | — |
| Candidate.candidateIndex/Name/leaf/full | ✅ | — | ✅ | — | — |
| Candidate.snapshotId/createdAt | ✅ | — | ✅（替换=生成新快照） | — | — |
| Candidate.bizStatus/owner/notes | — | ✅ | — | — | — |
| Candidate.projectId | ✅（立项时） | — | ✅ | — | — |
| SkuProject.projectCode/createdAt/source | ✅ | — | ✅ | — | — |
| SkuProject.name/status | — | ✅ | — | — | — |
| SkuProject.stage | ✅（Gate 建议） | ✅（确认/override） | — | — | — |
| SkuProject.workflow.states | — | ✅（每节点） | — | — | — |
| SkuProject.costing.scenarios | inputs ✅ / 其余 — | ✅ | — | — | ✅（append-only） |
| SkuProject.decisionLog | — | ✅（追加） | — | — | ✅（append-only） |
| Supplier.quotes | — | ✅ | — | — | ✅（append-only） |

**规则**：
1. 任何"修改不可修改字段"的操作在 UI 上不存在；数据层写入前校验并拒绝（fail-close）。
2. "刷新评分" = 生成新 ScoringSnapshot + 更新引用，旧快照不删除。
3. CostScenario/SupplierQuote/DecisionLog 只增不改不删。

---

## 5. Stage Gate 设计（建议 + 人工 override）

### 5.1 检查项（按阶段）

| 阶段跃迁 | 建议检查 |
|---|---|
| PIPELINE → RESEARCH | ✅ 市场评分存在（snapshot）· ✅ 候选池状态已确认 |
| RESEARCH → COSTING | ✅ Ozon/WB 核算至少 1 个 CostScenario · ✅ 目标售价已填 |
| COSTING → SAMPLING | ✅ 至少 1 个供应商报价 · ⚠ 毛利率预期 ≥ 15%（不满足仅提示） |
| SAMPLING → COMPLIANCE | ✅ 样品记录存在 · ⚠ 合规评估未完成 |
| COMPLIANCE → PRODUCTION | ✅ 合规评估完成 · ✅ 认证计划存在 |
| PRODUCTION → LAUNCH | ✅ Listing 草稿存在 · ✅ 库存计划存在 |
| LAUNCH → OPERATIONS | ✅ 上架完成记录 · ✅ 冷启动计划 |
| OPERATIONS → REVIEW | 无强制项（提示性：30/60/90 天数据回填） |

### 5.2 结果呈现（三档）

```text
GREEN 可以推进          → 全部 ✅
YELLOW 可以推进，但存在风险 → 存在 ⚠（如"合规未确认"）
RED    不建议进入样品阶段  → hard block（来自快照 BLOCKED_LOGISTICS）
```

### 5.3 人工 override

- 人工可在 YELLOW/RED 下"强制推进"，但必须填写理由 → 写入 `DecisionLog(kind='gate_override')`。
- **不做的**：程序自动禁止推进、自动审批链、角色权限系统（T6 不引入）。

---

## 6. 模块间自动带入映射（T6-2 实现，本阶段只定义）

| 目标模块 | 动作 | 自动带入字段（来自 canonical 候选/快照） |
|---|---|---|
| Ozon 核算 | 「计算利润」 | price_rub（price>0 用 price，否则 avg_price_rub）、weight_kg、dims[3]、category_leaf（→佣金类目）、commission_fbs/fbo/rfbs/fbp、rub_per_cny（config/settings.json） |
| Ozon 核算 | 「保存到项目」 | 生成 `CostScenario{channel:'OZON', name:'Ozon Scenario v1', inputs:上述字段, results:核算结果}` |
| WB 核算 | 「保存到项目」 | 生成 `CostScenario{channel:'WB', name:'WB Scenario v1', ...}` |

- 带入只填 `inputs`（来自评分快照），核算引擎的算法与费率保持不变（T2/T4 冻结）。

---

## 7. 存储与迁移（沿用现有 persist 体系）

- 命名空间（key-value，localStorage + WP REST 同步）：

```text
t6.candidates     → Candidate[]
t6.projects       → SkuProject[]
t6.snapshots      → ScoringSnapshot[]（append-only）
```

- 每条顶层值含 `schemaVersion`；读取时按版本做迁移（T6 只有 v1）。
- **引擎版本常量**：新增 `SCORING_ENGINE_VERSION = 't4-frozen-1'`（随引擎公式变更递增；快照记录它）。
- 现有 key 不动：`roadmap-statuses`（全局模板态）、`node-updates`（节点更新）保持现状（§3.5 兼容说明）。
- 写入纪律：所有 T6 写入走统一 store 函数（T6-1 实现），禁止组件直写 localStorage。

---

## 8. UI 规划（只描述，T6-1 起实现）

1. **一级导航**（商品中心下）：

```text
商品中心
  ├─ 候选池      → Candidate[] 列表（商品/评分/Decision/Context/市场规模/候选表现/利润/物流/Supply Gap/负责人/状态/更新时间）
  ├─ SKU 项目    → SkuProject[] 卡片（RU-2026-001、当前阶段、进度 6/36、Score+Decision+Context、供应商数/当前成本/目标售价/净利率、下一步）
  └─ 商品档案    → 正式 SKU 长期资料（T6-3）
```

2. **评分页动作**：Drawer 增加 [加入候选] [创建项目]；表格行增加 [加入候选] 快捷按钮。
3. **项目详情**：六 Tab（概览/产品/供应链/成本与物流/合规/运营）；36 节点 workflow 放**右侧进度 Timeline/抽屉**，不做 36 个 Tab。
4. **候选池人工状态**始终与模型 Grade/Decision 并列展示（如 `76 B · ELIGIBLE · 待立项`）。

---

## 9. T4 冻结边界重申（T6 全程）

- 不改 λ=0.5 / 六维权重 / 评级线 / Grade / Decision / Gate / Supply Gap / Context / Evidence / 适配器 / CEL / 配置 / golden。
- 冻结分布 A1/B191/C448/D169/不可评级191 保持不变（`npm test` 适配层回归持续锁定）。
- T6 只**消费**评分输出并做快照，不反向影响评分。

## 10. 本阶段明确不做

- 不写任何页面/组件/存储代码（T6-0 纯规格）；
- 不动 T5-5 遗留（已登记 TD-20/TD-21）；
- 不实现 Gate 引擎（T6-2）；不实现供应商功能（T7）；不引入账号/权限体系。

## 11. 审核要点（供需求方验收）

1. 实体与字段是否覆盖"评分→立项→供应链→成本→合规→上架→运营→回款"闭环；
2. 快照不可变与人工状态分离是否符合预期；
3. 字段权限矩阵（自动带入/人工/不可改/快照/版本化）是否有遗漏或过度约束；
4. Gate 三档 + 强制推进必填理由是否满足"不搞死板审批"；
5. projectCode 规则（RU-YYYY-NNN）与命名空间 key 是否认可；
6. 与现有 `roadmap-statuses` 的兼容迁移方案是否接受。
