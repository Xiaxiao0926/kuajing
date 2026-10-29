# TASK 05C-3B: Candidate 双证据立项 UI 与 Project 证据差异化展示设计文档

## 1. 背景与目标

在 KUAIJING 跨国电商运营工作区中，T6 候选池（Candidate Pool）汇集了来自不同来源系统的潜力商品。
此前，系统的立项链路强依赖于选品评分生成的不可变快照（`SCORING` Snapshot），导致来自选品雷达（`WB_MARKET_INTELLIGENCE`）的市场候选商品因缺乏商品级 canonical 评分而处于“只读观察、无法合规立项”的割裂状态。

在 **TASK 05C-2** 与 **TASK 05C-3A** 中，我们完成了底层双证据快照契约（`SCORING` 与 `MARKET_VALIDATION`）及其在 Project、CostScenario、Stage Gate 中的流通闭环。
**TASK 05C-3B** 的核心任务是在 UI 层面正式打通双路径立项：
1. **Candidate 列表立项交互分流**：根据候选商品来源（Scoring vs MI）展示差异化的立项按钮与状态（“评分立项” vs “市场验证立项” / “立项证据未齐”）。
2. **防副作用与准入守门**：严禁在 React Render 期产生任何持久化副作用；点击立项时现场重新读取最新 Phase 5 采购报价并实时校验资格（Eligibility），通过后才生成不可变的 `MARKET_VALIDATION` Snapshot 并立项。
3. **Project 前台差异化展示**：在 Project 列表与详情页中，依据快照解析类型（`resolveSnapshotKind`），清晰区隔展示“商品评分”与“市场采购事实”，彻底杜绝虚假评分或空规则版本。

---

## 2. 双路径立项交互契约

系统严格区分两类候选商品的立项路径：

| 维度 | 选品评分候选 (Scoring Candidate) | 市场情报候选 (MI Candidate) |
|---|---|---|
| **来源系统** | 标准商品池 / 默认 | `WB_MARKET_INTELLIGENCE` |
| **快照来源** | 复用已有 `cand.latestSnapshotId` | 点击时现场基于 Candidate + Phase 5 Quote 构建 |
| **快照类型** | `SCORING` | `MARKET_VALIDATION` |
| **快照生成时机** | 选品评分工作台或列表刷新评分时预先生成 | 用户点击“市场验证立项”时现场生成（无预先 Snapshot） |
| **立项前校验** | 检查 `cand.latestSnapshotId` 是否存在且有效 | 现场调用 `evaluateMarketValidationEligibility` 检查证据完整性 |
| **候选快照字段** | `candidate.latestSnapshotId` 记录最新评分快照 ID | `candidate.latestSnapshotId` **严格保持 null**，绝不污染 |
| **初始项目状态** | `createProject()` -> `setProjectLifecycle(id, 'ACTIVE')` | `createProject()` -> `setProjectLifecycle(id, 'ACTIVE')` |

---

## 3. 动态资格评估与不可变冻结

### 3.1 为什么不能在 Render 中创建快照？
React 的组件渲染必须是纯函数（Pure Function），严禁产生持久化快照的副作用。如果在渲染阶段自动根据当前报价创建快照：
- 会导致每次状态变更、搜索过滤或页面切换产生大量垃圾 Snapshot。
- 违背了 Snapshot 作为“用户业务决策时点不可变证据”的语义。

因此，在 `CandidatePoolPage.jsx` 的渲染周期中，`evaluateMarketValidationEligibility` 仅以只读方式运行，用于驱动按钮的可用性（Disabled）和 Tooltip 缺失字段提示。

### 3.2 点击时重新获取最新 Quote 的必要性
采购人员可能在另一个标签页或 Phase 5 采购工作台中刚刚录入或修正了报价。在用户点击“市场验证立项”瞬间：
1. 现场调用 `getManualQuotes()` 读取最新报价集合；
2. 现场通过 UID 优先匹配 `findProcurementQuote(quotes, { uid, name })`；
3. 现场再次执行 `evaluateMarketValidationEligibility` 进行强校验；
4. 若校验通过，立即调用 `buildMarketValidationSnapshot` 冻结生成不可变证据，并以此快照创建项目。
这一机制保证了立项快照记录的是“立项动作发生瞬间”的真实采购事实。

---

## 4. UI 守门与防呆设计

### 4.1 单操作并发锁 (`creatingRef`)
网络抖动或用户双击可能导致并发触发立项，生成重复快照或重复项目。
- 采用 `useRef(new Set())` 维护当前正在执行立项的 `candidateId`；
- 进入点击处理函数首先检查 `if (creatingRef.current.has(cand.id)) return`；
- 立项期间设置 `creatingCandidateId` 状态展示“立项中…”加载动画并禁用按钮；
- `finally` 块中严格清理该 ID，确保失败或成功后锁被正确释放。

### 4.2 重复立项确认机制 (`repeatConfirmId`) 与 1 Candidate : N Projects 语义
业务场景中，同一个利基/候选商品完全可能孵化出不同规格、颜色或定位的多个 SKU 项目（例如同一个收纳盒利基衍生“大号透明”与“小号磨砂”两个独立项目）。
- 系统**严禁在 Store 层禁止重复立项**；
- 在 UI 层引入防手抖确认机制：若 `cand.projectIds.length > 0` 且未确认，首次点击拦截并提示：“该候选已有关联项目。如确需创建另一个 SKU 项目，请再次点击确认。”，按钮文案变更为“确认再建项目”；
- 再次点击确认后，顺利调用 `createProject` 挂载第二个项目，并将 `repeatConfirmId` 重置为 `null`。

---

## 5. Candidate 评分隔离机制

MI 候选商品代表市场 Niche，不具备商品级评分模型：
1. **隐藏刷新评分按钮**：`CandidatePoolPage.jsx` 中对 `cand.source_system === 'WB_MARKET_INTELLIGENCE'` 彻底隐藏“刷新评分”按钮，避免误触。
2. **评分列中性提示**：MI 候选若无评分快照，评分列显示灰底徽章“市场验证”，而不是显示横杠或虚假 0 分。
3. **`latestSnapshotId` 零污染**：`buildMarketValidationSnapshot` 生成的快照 ID 仅注入给 `createProject` 作为 `creationSnapshotId`，绝不更新到 `candidate.latestSnapshotId`。

---

## 6. Project 列表证据差异化展示 (`ProjectListPage.jsx`)

在 SKU 项目列表中，不再假设所有项目都有评分：
- **`SCORING` 项目**：
  - 展示：`ScoreCell`（分值、评级）、`DecisionBadge`（决策建议）、`ContextBadge`（上下文）；
  - 底部标注：`立项快照 2026/9/18 · 规则 rules-v1`。
- **`MARKET_VALIDATION` 项目**：
  - 展示：`[市场验证立项]` 专属业务徽章；
  - 采购事实：单行紧凑展示 `供应商 · 出厂价 · 实测重 · 目标售价`（全部严格取自 `snap.procurementEvidence`）；
  - 底部标注：`立项证据 2026/9/18 · market-validation-v1`（绝不显示“规则 —”）。
- **未知快照类型**：
  - 防御性展示黄色警告徽章 `未知立项证据`。

---

## 7. Project 详情顶部栏差异化展示 (`ProjectDetailPage.jsx`)

在 SKU 项目详情工作台顶部状态栏：
- **`SCORING` 项目**：
  - 保留立项评分、建议徽章、上下文以及规则版本。
- **`MARKET_VALIDATION` 项目**：
  - 突出展示 `市场验证立项` 徽章；
  - 详细罗列立项时冻结的核心采购要素：供应商、出厂价（¥）、实测重（g）、包装尺寸（长x宽x高 cm）、目标售价（₽）；
  - 显示立项冻结时间与证据版本（`evidenceSchemaVersion`）。
- **未知类型**：
  - 展示 `未知立项证据` 徽章。

---

## 8. 数据与视图零污染

为维护立项快照的不可变性与法律证据效力：
- `ProjectListPage` 与 `ProjectDetailPage` 严禁调用 `getManualQuotes()`；
- 严禁在 Project 视图中读取 `candidate.marketEvidence` 等任何可变的上游数据；
- 所有展示内容 100% 来源于项目创建时固化的 `snapshot.procurementEvidence` 与 `snapshot.marketEvidence`。

---

## 9. 自动化测试套件设计

测试套件 `tests/ia-candidate-project-launch.test.mjs` 覆盖了严格的 20 项断言及端到端（E2E）集成流：

1. **TEST 1**: SCORING Candidate 通过已有 `latestSnapshotId` 成功创建项目；
2. **TEST 2**: SCORING 立项不创建新 Snapshot，直接复用 existing `latestSnapshotId`；
3. **TEST 3**: 证据齐全的 MI Candidate + Quote 通过 Eligibility 校验；
4. **TEST 4**: 证据不齐的 MI Candidate 判定为 ineligible 并准确列出 missing 字段；
5. **TEST 5**: MI 立项点击时重新读取最新 Quote 并重新评估 Eligibility；
6. **TEST 6**: MI 立项创建合法 `MARKET_VALIDATION` Snapshot 并顺利生成 Project；
7. **TEST 7**: MI Candidate 立项后 `latestSnapshotId` 严格保持为 `null`；
8. **TEST 8**: 新创建的项目经由 `setProjectLifecycle` 设置为 `ACTIVE` 状态；
9. **TEST 9**: 验证 UI 中 MI 候选商品绝不展示“刷新评分”按钮；
10. **TEST 10**: 验证 UI 中 Scoring 候选商品保留“刷新评分”功能；
11. **TEST 11**: 防并发连续点击锁（`creatingRef`）防重复触发；
12. **TEST 12**: 已有关联项目的 Candidate 首次点击不建项目，触发确认提示；
13. **TEST 13**: 再次点击确认后成功创建第二个 SKU 项目（1 Candidate : N Projects）；
14. **TEST 14**: 底层 Store 无候选级别单一项目阻断；
15. **TEST 15**: `ProjectListPage` 中 SCORING 证据展示 ScoreCell / Decision / Context 及规则版本；
16. **TEST 16**: `ProjectListPage` 中 `MARKET_VALIDATION` 专属展示 4 项采购证据及版本；
17. **TEST 17**: `ProjectDetailPage` 顶部栏根据 `snapshotKind` 分流展示采购证据；
18. **TEST 18**: `ProjectDetailPage` 绝不调用 `getManualQuotes` 且严格只读取 frozen snapshot；
19. **TEST 19**: 历史存量无 `snapshotKind` 快照解析为 SCORING 并正常兼容显示；
20. **TEST 20**: 未知快照类型具有防御性 fallback 提示；
- **E2E**: 完整跑通 `MI Candidate → Phase 5 UID Quote → Snapshot → Project → ACTIVE → Gate 评估` 全链路。

---

## 10. 后续演进建议与上线指南

1. **多 SKU 变体模板化**：随着 1:N 项目创建被频繁使用，后续可在立项确认弹窗中引导用户输入变体属性（如颜色、规格），自动预填项目名称。
2. **证据快照对比视图**：当同个 Candidate 衍生多个项目时，可在详情页提供历史快照与当前市场数据的漂移对比分析。
3. **只读审计追溯**：在操作日志 Timeline 中标明项目立项依据类型（评分立项 vs 市场验证立项），方便运营团队复盘核查。
