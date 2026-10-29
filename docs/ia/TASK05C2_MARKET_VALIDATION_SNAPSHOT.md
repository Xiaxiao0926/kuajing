# KUAIJING-IA-REFACTOR-V1 · TASK 05C-2 实施报告
# Market Validation Snapshot V1 与 MI Candidate 立项证据评估器

> 状态：**已完成**  
> 对应任务：KUAIJING-IA-REFACTOR-V1 · TASK 05C-2  
> 核心目标：在既有 `t6.snapshot.*` 体系内引入第二种快照类型 `MARKET_VALIDATION`，提供纯事实性立项证据评估器与载荷组装器，为 MI Candidate 提供物理与商业事实冻结依据，绝不伪造评分、绝不自动刷新评分快照指针、绝不产生 Project 实体。

---

## 1. Snapshot 双类型设计与 Legacy 兼容策略

在 T6 架构下，所有快照统一以不可变形式保存在 `t6.snapshot.<uuid>` 命名空间中。为了支持 MI（Market Intelligence）来源候选对象的立项，本次正式建立快照双类型枚举契约：

```javascript
export const SNAPSHOT_KIND = {
  SCORING: 'SCORING',
  MARKET_VALIDATION: 'MARKET_VALIDATION',
}
```

### Legacy 兼容策略
历史所有基于 canonical 商品打分生成的快照对象均未声明 `snapshotKind` 属性。
通过解析函数 `resolveSnapshotKind(snapshot)`：
```javascript
export function resolveSnapshotKind(snapshot) {
  if (!snapshot) return null
  return snapshot.snapshotKind || SNAPSHOT_KIND.SCORING
}
```
- **向后兼容（Zero Migration）**：所有历史快照在缺失 `snapshotKind` 时，自动解析为 `'SCORING'`。无需对现存持久化快照进行批量迁移或数据改写。
- **全新证据识别**：由 MI Candidate 与 Phase 5 采购报价组装生成的快照显式声明 `snapshotKind: 'MARKET_VALIDATION'`。

---

## 2. Eligibility 10 项评估标准与 Fail-close 逻辑

评估函数 `evaluateMarketValidationEligibility({ candidate, quote })` 严格校验以下 10 项事实性条件：

| # | 检查项 ID | 检查规则 | 校验目的与 Fail-close 逻辑 |
|---|---|---|---|
| 1 | `candidate_exists` | `candidate` 为有效对象 | 根候选对象必须存在 |
| 2 | `mi_source` | `candidate.source_system === 'WB_MARKET_INTELLIGENCE'` | 必须为市场情报利基转化对象 |
| 3 | `stable_niche_uid` | `candidate.source_niche_uid` 非空有效字符串 | 必须具备全局稳定利基 UID（防降维） |
| 4 | `market_evidence` | `candidate.marketEvidence` 存在且其 `nicheUid === source_niche_uid` | 市场事实证据已挂载且利基 UID 完全一致 |
| 5 | `procurement_quote` | `quote` 存在且 `quote.uid === source_niche_uid` | 采购验证报价存在且通过 UID 稳定关联（防御纯名称关联） |
| 6 | `supplier` | `quote.supplierName` 非空有效字符串 | 必须具备可信真实的供应商来源 |
| 7 | `factory_price` | `Number.isFinite(factoryPriceCny) && factoryPriceCny > 0` | 采购出厂价必须为有限正数 |
| 8 | `measured_weight` | `Number.isFinite(weightG) && weightG > 0` | 实测单件重量（克）必须为有限正数 |
| 9 | `package_dims` | `parseProcurementDims(quote.dims) !== null` | 包装尺寸必须能被解析为三个正数（长/宽/高，单位 cm） |
| 10 | `target_price` | `Number.isFinite(targetPriceRub) && targetPriceRub > 0` | 测算售价必须为有限正数 |

**Fail-close 保护机制**：
- 只要任意一项检查未通过，`eligible` 立即判定为 `false`，并汇总返回 `missing: string[]`。
- `buildMarketValidationSnapshotPayload({ candidate, quote })` 在执行前强制调用评估器。若 `eligible === false`，直接抛出 `Error('T6_EVIDENCE: MI Candidate 立项证据不完整...')`，物理切断残缺数据的入库路径。

---

## 3. 纯事实门禁与商业选品规则的隔离原则

在 05C-2 中，证据评估器只回答一个问题：**“是否有足够、合法、经过结构化校验的事实，能够冻结一份立项证据快照？”**

- **严禁商业选品规则渗透**：评估器绝对不包含诸如 `MOS >= 70`、`PFS >= 90`、`marginPct >= 15%`、`GMV >= 1,000,000` 或 EAC 认证必须齐全等主观业务门禁。
- **业务职责隔离**：
  - 业务可行性分析由运营在 Phase 1~Phase 5 自主裁量；
  - 商业评审由立项评审会及 Stage Gate（立项门禁）判定；
  - 证据快照层只负责记录**不可逆、不可篡改的时点事实**。

---

## 4. sourceInputs 字段契约与 WB 佣金隔离

为了使下游成本测算适配器（如 `costScenarioAdapter.js`）能够在不破坏接口的前提下读取事实数据，快照中规范化了 `sourceInputs` 对象：

```javascript
const sourceInputs = {
  name: candidate.candidateName || '',
  price_rub: Number(quote.targetPriceRub),
  avg_price_rub: null,
  weight_kg: weightKg,       // quote.weightG / 1000
  dims: parsedDims,           // [L, W, H] (cm)
  commission_rfbs: null,     // 严格置 null
  category_leaf: candidate.categoryLeaf || '',
  category_full: candidate.categoryFull || '',
}
```

### 关键业务隔离契约
- **`commission_rfbs: null`**：WB 平台的佣金规则与费率体系与 Ozon 完全不同。绝不能将 WB 佣金冒充或回填为 Ozon 的 rFBS 佣金。显式置 `null`，确保后续成本测算引擎通过默认规则或人工确认重新配置 Ozon 佣金。
- **`weight_kg`**：由采购测得的克重（`weightG`）除以 1000 精确换算为公斤数，保留至 3 位小数。

---

## 5. DIMS 尺寸单位与格式契约

### 契约依据
经查验，`ManualProcurementWorkbench.jsx:284` 中明确声明了表单项标签与占位符：
- Label：`外包装尺寸 (长x宽x高 cm)`
- Placeholder：`20x15x5`
- 业务事实单位：**厘米（cm）**。

### 解析规则与容错实现
解析函数 `parseProcurementDims(value)` 支持以下输入格式：
1. **字符串**：支持以 `x`、`X`、`*`、`×` 或空格分隔的三个数字字符串，如 `'20x15x5'`、`'20*15*5'`、`'20×15×5'`、`' 25.5 x 10.2 x 4 '`；
2. **数组**：如 `[20, 15, 5]`；
3. **对象**：如 `{ lengthCm: 20, widthCm: 15, heightCm: 5 }` 或 `{ length: 20, width: 15, height: 5 }`。

**Fail-close 约束**：输入必须能解析出且仅解析出三个严格大于 0 的有限数值，否则一律返回 `null`。包含 0、负数、NaN 或格式残缺的输入均无法通过验证。

---

## 6. 不可变性保障（Immutability Guarantee）

1. **证据深拷贝冻结**：
   ```javascript
   const marketEvidence = JSON.parse(JSON.stringify(candidate.marketEvidence))
   const procurementEvidence = JSON.parse(JSON.stringify(quote))
   ```
   快照生成后，外部即使修改了 `candidate.marketEvidence` 或修改了 Phase 5 的 Quote 数据，已生成的快照内容完全不受影响。
2. **UUID 主键与防冲突**：
   每个快照分配唯一的 `uuid()`，在写入 `t6.snapshot.<uuid>` 时校验 key 不得冲突，不允许覆写。
3. **仅追加（Append-only）**：
   `t6Store.js` 对快照只提供 `createSnapshot` 与 `getSnapshot / listSnapshots`，接口层面不提供任何 update 或 delete 操作。即使同一候选人因重新核算生成了新的快照，旧快照仍完好保留在存储中。

---

## 7. Candidate 状态解耦（latestSnapshotId 维持 null）

在 Candidate 模型中：
- `candidate.latestSnapshotId` 的语义是**“当前绑定的 Canonical 商品 T6 评分快照”**。
- MI Candidate 来源于市场利基（`wb-niche-*`），并不对应 `scoring_candidates.json` 中的具体商品，因此**没有合法的 Canonical 评分事实**。
- `buildMarketValidationSnapshot` **绝不调用 `refreshCandidateSnapshot`**。
- 生成 `MARKET_VALIDATION` 快照后，`candidate.latestSnapshotId` 依然保持 `null`。
- 绝不通过虚构假分来填补 `latestSnapshotId`，保持评分与市场验证两个业务轨道的严格解耦。

---

## 8. 零项目创建副作用（Zero Project Creation Side-effect）

- 05C-2 严格限定在领域快照构建与完整性评估层。
- `candidateProjectEvidence.js` 内部**严禁导入 `createProject`**，亦不包含任何触发 Project 创建的代码逻辑。
- 本轮执行完毕后，系统内部**没有生成任何 Project 实体**，存储中无任何新增的 `t6.project.*` 记录。

---

## 9. BLOCKED_LOGISTICS 契约路径审计（EXISTING_GATE_PATH_MISMATCH）

在契约审计中，我们对 `gateEngine.js` 现存的 `BLOCKED_LOGISTICS` 检查路径进行了核实：

### 审计发现
1. **`gateEngine.js:155` 代码实现**：
   ```javascript
   // 检查物流可行性（快照中已标记不可行）
   if (gateKey === 'logistics_review' && (snapshot.status || []).includes('BLOCKED_LOGISTICS')) {
     return { allowed: false, reason: '商品在选品快照中已被标记为物流不可行，需重新评估' }
   }
   ```
   此处代码预期从 `snapshot.status`（顶层属性）读取状态数组。
2. **Scoring Snapshot 真实结构**：
   在 `t6Store.js:136` 的 `buildScoringSnapshot` 中：
   ```javascript
   const scoreResult = {
     ...
     status: scored.status,
     ...
   }
   return createSnapshot({
     ...
     scoreResult,
     ...
   })
   ```
   快照顶层并没有 `status` 字段，该状态实际保存在 `snapshot.scoreResult.status`。
3. **前端调用层适配**：
   在 `ProjectDetailPage.jsx:117` 中，调用方通过如下适配弥补了这一偏差：
   ```javascript
   snapshot: snapshot ? { status: snapshot.scoreResult?.status || [] } : null
   ```

### 治理判定
- **标记**：`BLOCKED_LOGISTICS_PATH: EXISTING_GATE_PATH_MISMATCH`
- **处理决策**：按照架构规范铁律，05C-2 不就地改动 `gateEngine.js`，避免无测试保护下的连锁反应。
- **后续规划（TASK 05C-3）**：在 05C-3 统一改造 Stage Gate 时，在 `gateEngine.js` 中将路径规范化为：
  ```javascript
  const statusList = snapshot.status || snapshot.scoreResult?.status || []
  ```
  同时支持 `MARKET_VALIDATION` 快照通过 `evidenceContext` 或 `sourceInputs` 对齐物流评估，确保多处调用方的一致性。

---

## 10. 文件变更清单

| 文件路径 | 变更类型 | 核心职责 |
|---|---|---|
| `ozon-react/src/utils/t6/candidateProjectEvidence.js` | **新增** | 证据评估器 `evaluateMarketValidationEligibility`、载荷构建器 `buildMarketValidationSnapshotPayload`、快照类型解析器 `resolveSnapshotKind`、包装尺寸解析器 `parseProcurementDims`、辅助查找器 `findLatestMarketValidationSnapshot` |
| `ozon-react/src/utils/t6/t6Store.js` | **修改** | 引入并导出 `SNAPSHOT_KIND`、`resolveSnapshotKind`；新增 `buildMarketValidationSnapshot` 并接入既有 `t6.snapshot.*` 存储体系 |
| `tests/ia-market-validation-snapshot.test.mjs` | **新增** | 19 项专项自动化测试套件 |
| `docs/ia/TASK05C2_MARKET_VALIDATION_SNAPSHOT.md` | **新增** | 本设计与验收报告文档 |

---

## 11. 19 项专项测试验证结果

运行命令：`node tests/ia-market-validation-snapshot.test.mjs`

```text
===== IA Market Validation Snapshot Test Suite =====

TEST 1: Legacy snapshot 没有 snapshotKind 时解析为 SCORING
  ✅ Legacy snapshot 默认回退 SCORING 通过
TEST 2: 新快照 snapshotKind 正确识别为 MARKET_VALIDATION
  ✅ MARKET_VALIDATION 快照类型识别通过
TEST 3: 非 WB_MARKET_INTELLIGENCE 来源 -> eligible: false
  ✅ 非 MI 来源候选被正确拒绝
TEST 4: 缺失 source_niche_uid -> eligible: false
  ✅ 缺失稳定利基 UID 被正确拒绝
TEST 5: marketEvidence.nicheUid 不匹配 -> eligible: false
  ✅ 市场证据 UID 不一致或缺失被正确拒绝
TEST 6: Quote UID 不匹配或为 null -> eligible: false
  ✅ 采购报价 UID 校验（防御纯名称关联）通过
TEST 7: 缺失供应商名称 -> eligible: false
  ✅ 缺失供应商名称被正确拒绝
TEST 8: 出厂价非正数或缺失 -> eligible: false
  ✅ 非法出厂价全部被正确拒绝
TEST 9: 实测重量非正数或缺失 -> eligible: false
  ✅ 非法实测单重全部被正确拒绝
TEST 10: Dims 解析与有效性校验
  ✅ 外包装尺寸多种分隔符解析与 Fail-close 校验通过
TEST 11: 目标售价非正数或缺失 -> eligible: false
  ✅ 非法目标售价全部被正确拒绝
TEST 12: 完整合法 Candidate + Quote -> eligible: true
  ✅ 10 项事实性完整性检查全部通过
TEST 13: Payload 严禁包含评分字段
  ✅ 绝无伪造评分字段校验通过
TEST 14: sourceInputs 严格冻结物理事实与价格
  ✅ sourceInputs 物理事实与佣金 null 校验通过
TEST 15: 证据深拷贝冻结（外部修改不影响快照载荷）
  ✅ 市场与采购证据深拷贝不可变校验通过
TEST 16: 构建快照后 Candidate latestSnapshotId 依然保持 null
  ✅ Candidate latestSnapshotId 维持 null 且快照成功进入 t6.snapshot.* 存储
TEST 17: candidateProjectEvidence.js 静态检查无假评分代码
  ✅ 静态源码无伪造评分逻辑校验通过
TEST 18: candidateProjectEvidence.js 不导入也不执行 createProject
  ✅ 物理隔离：不产生任何 Project 创建副作用
TEST 19: Append-only 不可变性：快照仅追加，互不干扰
  ✅ 追加式不可变性校验通过（两份独立证据快照共存）

===== All 19 IA Market Validation Snapshot Tests Passed Successfully! =====
```

---

## 12. 下一步（TASK 05C-3）规划建议

完成证据快照的底层支撑后，下一步可安全推进 **TASK 05C-3：MI Candidate 立项入口与 Project Gate 适配**：
1. **Candidate Pool UI 适配**：在候选池中为具备 `MARKET_VALIDATION` 证据条件的 MI Candidate 开放立项动作入口；
2. **Project 创建与快照冻结**：调用 `createProject` 时，将 `creationSnapshotId` 正式绑定为生成的 `MARKET_VALIDATION` 快照 ID；
3. **Stage Gate 路径修复**：解决 `EXISTING_GATE_PATH_MISMATCH`，确保 `gateEngine.js` 能同时无缝消费两类快照；
4. **Project Detail 展现适配**：区分展示 “T6 评分快照” 与 “市场验证证据快照”，防止前台将证据快照误显为评分徽章。
