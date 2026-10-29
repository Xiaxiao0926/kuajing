# KUAIJING-IA-REFACTOR-V1 · TASK 05C-3A 实施报告
# Dual Snapshot Project Gate Core Integration

> 状态：**已完成**  
> 对应任务：KUAIJING-IA-REFACTOR-V1 · TASK 05C-3A  
> 核心目标：在系统底层完成 `SCORING` 与 `MARKET_VALIDATION` 双快照到 Project Gate 与 Cost Scenario 的安全接轨。证明两类快照均能作为合法的 `creationSnapshotId`，修复 Stage Gate 路径错位，并证明 `costScenarioAdapter` 零改动即可消费市场验证事实，全程不开放 MI Candidate 的前端立项入口。

---

## 1. Snapshot Type 单一事实源

为杜绝枚举类型在多模块独立维护带来的分裂风险，本项目明确确立快照类型的单一事实源：
- **定义源**：[`candidateProjectEvidence.js`](file:///d:/ozon/ozon-react/src/utils/t6/candidateProjectEvidence.js) 声明并导出：
  ```javascript
  export const SNAPSHOT_KIND = {
    SCORING: 'SCORING',
    MARKET_VALIDATION: 'MARKET_VALIDATION',
  }

  export function resolveSnapshotKind(snapshot) {
    if (!snapshot) return null
    return snapshot.snapshotKind || SNAPSHOT_KIND.SCORING
  }
  ```
- **消费与转出**：[`t6Store.js`](file:///d:/ozon/ozon-react/src/utils/t6/t6Store.js) 通过 `import` 引入并直接 `re-export`，不保留第二份枚举定义。
- **Gate 消费**：[`gateEngine.js`](file:///d:/ozon/ozon-react/src/utils/t6/gateEngine.js) 直接从 `candidateProjectEvidence.js` 引用该唯一事实源。

---

## 2. createProject Type Validation

在 `candidateProjectEvidence.js` 中实现纯函数校验器：
```javascript
export function validateProjectCreationSnapshot({ candidate, snapshot })
```
在 [`t6Store.js:createProject`](file:///d:/ozon/ozon-react/src/utils/t6/t6Store.js#L342) 中，在完成候选与快照实体检索后统一调用：
```javascript
const validation = validateProjectCreationSnapshot({
  candidate,
  snapshot: creationSnapshot,
})
if (!validation.valid) {
  throw new Error(`T6_STORE: 非法立项快照 (${validation.errors.join('; ')})`)
}
```
- **通用约束**：强制校验 `snapshot.candidateId === candidate.id` 与 `String(snapshot.sourceProductId) === String(candidate.sourceProductId)`。
- **未知类型阻断（Fail-close）**：对于非 `SCORING` 且非 `MARKET_VALIDATION` 的快照类型（如 `UNKNOWN_KIND`），一律拒绝并抛出异常。
- **Project Schema 保持纯净**：创建后的 `project.source` 保持既有契约，不新增 `creationSnapshotKind` 或 `marketValidationId`。快照类型由 `getSnapshot(project.source.creationSnapshotId) → resolveSnapshotKind()` 动态判定。

---

## 3. Legacy Scoring Compatibility

- **历史快照零破坏**：历史 Snapshot 中未持久化 `snapshotKind` 属性，通过 `resolveSnapshotKind` 统一回退解释为 `'SCORING'`。
- **不收紧既有契约**：对于 `SCORING` 类型快照，校验器只做 ID 与归属一致性检查，严禁突然要求 `scoreResult` 完整性或全量字段，确保历史项目和测试用例不受任何影响。

---

## 4. Market Validation Shape Validation

当 `snapshotKind === 'MARKET_VALIDATION'` 时，执行严格结构完整性检查：
1. `snapshot.snapshotKind === 'MARKET_VALIDATION'`；
2. 必备结构存在：`sourceInputs`、`marketEvidence`、`procurementEvidence`、`evidenceContext` 均必须为有效对象；
3. 版本号强校验：`snapshot.versions?.evidenceSchemaVersion === 'market-validation-v1'`；
4. **严禁伪造评分**：若快照中存在 `scoreResult`（`'scoreResult' in snapshot || snapshot.scoreResult != null`），判定为非法并阻断；
5. **内部 UID 闭环**：校验快照内部 `evidenceContext.sourceNicheUid === marketEvidence.nicheUid` 且 `procurementEvidence.uid === evidenceContext.sourceNicheUid`；
6. **历史事实独立性保证**：**绝不**重新读取或比对当前可变的 `candidate.marketEvidence`。立项项目严格绑定当时冻结在快照 Artifact 中的事实。

---

## 5. RESEARCH Gate 中性化与实体门禁

1. **文案中性化**：
   将原有 `市场评分存在（立项快照）` 改为中性且准确的业务表述：`立项证据快照存在`。
2. **双重实体检查**：
   ```javascript
   RESEARCH: [
     {
       id: 'snapshot_exists', label: '立项证据快照存在', kind: 'data',
       evaluate: (p, ctx) => {
         if (!p.source?.creationSnapshotId) {
           return { result: GATE_RESULTS.FAIL, message: '缺少立项证据快照' }
         }
         if (ctx?.snapshotSpecified && !ctx?.snapshot) {
           return { result: GATE_RESULTS.FAIL, message: '立项证据快照实体缺失' }
         }
         return { result: GATE_RESULTS.PASS }
       },
     },
   ],
   ```
   - 若仅有快照 ID 字符串但 `deps.snapshot` 显式传入为 `null`，判定为 `立项证据快照实体缺失` 并返回 `FAIL`。

---

## 6. BLOCKED_LOGISTICS 路径修复

针对 05C-2 发现的 `EXISTING_GATE_PATH_MISMATCH`，在 [`gateEngine.js`](file:///d:/ozon/ozon-react/src/utils/t6/gateEngine.js) 中新增类型化状态提取纯函数：
```javascript
export function snapshotStatusList(snapshot) {
  if (!snapshot) return []
  const kind = resolveSnapshotKind(snapshot)
  if (kind === SNAPSHOT_KIND.SCORING) {
    return snapshot.scoreResult?.status ?? snapshot.status ?? []
  }
  return []
}
```
### 治理规则
- **路径对齐**：对于 `SCORING` 快照，优先从 `snapshot.scoreResult.status` 读取；若缺失则安全回退到顶层 `snapshot.status`（保持历史兼容）。
- **零伪造保证**：对于 `MARKET_VALIDATION` 快照，返回值恒为 `[]`。严禁根据 `marketEvidence.risks`、`heavy`、重量或包装尺寸猜测或伪造 `BLOCKED_LOGISTICS`。

---

## 7. ProjectDetailPage Gate Snapshot 透传

在 [`ProjectDetailPage.jsx:115-119`](file:///d:/ozon/ozon-react/src/components/t6/ProjectDetailPage.jsx#L115-L119) 中，将此前向 Gate 传递的临时对象修复为传递完整真实 Snapshot：
```javascript
const gateDeps = {
  availableModules: {},
  snapshot, // 直接传入通过 getSnapshot 获取的完整快照实体
  scenarios,
}
```
**严格恪守边界**：本轮对 `ProjectDetailPage.jsx` 仅修改该处参数传递，未添加任何 UI 组件、Badge 或证据卡，保持视觉与前端呈现零变动。

---

## 8. Cost Adapter 零改动证明

得益于 05C-2 阶段对 `MARKET_VALIDATION` 的 `sourceInputs` 的严谨构造，现有 [`costScenarioAdapter.js`](file:///d:/ozon/ozon-react/src/utils/t6/costScenarioAdapter.js) **无需做任何代码修改**，即可无缝消费：
- **`buildOzonPrefill` 验证**：
  - `price = 1490`
  - `weight = 0.38`
  - `length = 30, width = 20, height = 8`
  - `commission = ''`（`commission_rfbs: null` 通过 `?? ''` 安全转化为空输入，杜绝 WB 佣金冒充）
- **`buildWbPrefill` 验证**：
  - `productName = '高压发泡胶枪'`
  - `actualWeightG = 380`（0.38kg × 1000 换算）
  - `lengthCm = 30, widthCm = 20, heightCm = 8`
  - `sellerRevenueRub = 1490`

---

## 9. MV Snapshot → Project → CostScenario 完整链路测试

在专项测试 TEST 16 中，验证了基于 `MARKET_VALIDATION` 快照立项的全链路：
1. `candidate.latestSnapshotId = null`；
2. 构建 `MARKET_VALIDATION` 快照；
3. 调用 `createProject({ candidateId, creationSnapshotId })` 创建项目成功；
4. 验证 `project.source.creationSnapshotId === snapshot.id`；
5. 验证 `candidate.latestSnapshotId` **依然保持 `null`**；
6. 调用 `createCostScenario({ projectId, sourceSnapshotId: project.source.creationSnapshotId, ... })`，成本场景创建成功并自动设为项目基线；
7. 证明整条链条在架构和数据模型上完全成立且闭环。

---

## 10. 仍未开放 MI 前端立项（Strict Boundary Guard）

- **UI 零开放**：本轮严格守住边界，未在 `CandidatePoolPage.jsx`、`CandidateDetailDrawer.jsx` 或其他 UI 处开放任何针对 MI Candidate 的“创建项目”按钮。
- **Candidate Schema 零修改**：Candidate 实体未添加任何 `candidateType` 枚举。
- **立项门禁前置就绪**：底层已全部就绪，等待 TASK 05C-3B 统一进行前端安全立项交互与重复点击保护的接入。
