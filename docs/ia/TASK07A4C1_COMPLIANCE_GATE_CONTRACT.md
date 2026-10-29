# KUAIJING-IA-REFACTOR-V1 · TASK 07A-4C1
# Project Compliance Stage Gate Semantic Contract Audit (只读审计与 Gate 语义裁决文档)

> **任务属性**：只读审计 + Gate 语义裁决。本轮绝对不修改生产代码，唯一新增本审计文档。

---

## 1. 阶段门禁执行模型源码核查 (Path Gate Execution Model Proof)

源码依据：[`ozon-react/src/utils/t6/gateEngine.js:194-216`](file:///d:/ozon/ozon-react/src/utils/t6/gateEngine.js#L194-L216)

### 1.1 核心证明：CHECKS[STAGE] 发生在“进入该 Stage”时
在 `evaluateProjectGate(project, targetStage, deps)` 中：
```javascript
// FORWARD：路径 = (from, target] 每一段
const fromIdx = stageIndex(from)
const toIdx = stageIndex(targetStage)
const path = PROJECT_STAGES.slice(fromIdx + 1, toIdx + 1)
```
- `from` 为项目当前所在阶段 `project.stage`；
- `targetStage` 为目标推进阶段；
- `path` 计算采用半开区间 `(fromIdx, toIdx]`，**严格排除 `from`（当前阶段），包含 `toIdx`（目标阶段）**；
- 随后循环遍历 `for (const stage of path)`，执行对应 `CHECKS[stage]`；
- 源码第 75 行显式注释固定：`// 每段进入时执行的检查；`。

### 1.2 结论
- 当项目从 `SAMPLING`（阶段 3）推进到 `COMPLIANCE`（阶段 4）时：
  `path = ['COMPLIANCE']`，执行 `CHECKS.COMPLIANCE`。
  这证明：**`CHECKS.COMPLIANCE` 是进入 `COMPLIANCE` 阶段（COMPLIANCE Entry Gate）时评估，绝非离开该阶段时评估**。
- 当项目从 `COMPLIANCE`（阶段 4）推进到 `PRODUCTION`（阶段 5）时：
  `path = ['PRODUCTION']`，执行 `CHECKS.PRODUCTION`。
  这证明：**`CHECKS.PRODUCTION` 是进入 `PRODUCTION` 阶段（PRODUCTION Entry Gate）时评估**。

---

## 2. 阶段顺序与 Transition 映射图

根据 [`ozon-react/src/utils/t6/stageModel.js`](file:///d:/ozon/ozon-react/src/utils/t6/stageModel.js) 冻结的 9 大阶段顺序：
`PIPELINE(0) → RESEARCH(1) → COSTING(2) → SAMPLING(3) → COMPLIANCE(4) → PRODUCTION(5) → LAUNCH(6) → OPERATIONS(7) → REVIEW(8)`。

```text
SAMPLING (Stage 3: 样品阶段)
   │
   ▼ Transition: SAMPLING → COMPLIANCE  [Path: 'COMPLIANCE']
   │ 执行 CHECKS.COMPLIANCE (COMPLIANCE Entry Gate):
   │   ├── samples_record: '样品记录存在'
   │   └── compliance_pending: '合规评估完成'  <-- 存在严重语义冲突！
   │
COMPLIANCE (Stage 4: 合规认证阶段)
   │
   ▼ Transition: COMPLIANCE → PRODUCTION  [Path: 'PRODUCTION']
   │ 执行 CHECKS.PRODUCTION (PRODUCTION Entry Gate):
   │   ├── compliance_done: '合规评估完成'
   │   └── cert_plan: '认证计划存在'
   │
PRODUCTION (Stage 5: 生产物流阶段)
```

---

## 3. 当前三个 Compliance Check 现状记录

源码定位：[`gateEngine.js:133-154`](file:///d:/ozon/ozon-react/src/utils/t6/gateEngine.js#L133-L154)

| Check ID | 所属 Stage | 检查性质 | 当前 Label | Kind | Module | 当前 Evaluator | 当前运行返回值 |
| :--- | :---: | :---: | :--- | :--- | :--- | :--- | :--- |
| **`compliance_pending`** | `COMPLIANCE` | Entry Gate | 合规评估完成 | `module` | `compliance` | `undefined` (走 fallback) | `NOT_EVALUATED` (`'合规数据域（后续版本接入）'`) |
| **`compliance_done`** | `PRODUCTION` | Entry Gate | 合规评估完成 | `module` | `compliance` | `undefined` (走 fallback) | `NOT_EVALUATED` (`'合规数据域（后续版本接入）'`) |
| **`cert_plan`** | `PRODUCTION` | Entry Gate | 认证计划存在 | `module` | `compliance` | `undefined` (走 fallback) | `NOT_EVALUATED` (`'合规数据域（后续版本接入）'`) |

---

## 4. `compliance_pending` 核心冲突裁决

- **事实**：`compliance_pending` 位于 `CHECKS.COMPLIANCE`，在 `SAMPLING → COMPLIANCE` 推进时执行；
- **Label 现状**：`'合规评估完成'`；
- **冲突裁决**：
  **`COMPLIANCE_PENDING_SEMANTICS = ENTRY_LABEL_CONFLICT`**。
- **倒置分析**：
  项目刚刚完成打样（SAMPLING），正准备进入合规阶段（COMPLIANCE）开展合规评估与认证工作。
  在此入口要求“合规评估完成”，相当于“还没进入合规阶段就必须已经完成合规评估”，造成极其严重的**阶段业务语义倒置**。
  同时，后一阶段 `PRODUCTION` 入口的 `compliance_done` 的 Label 也是“合规评估完成”，两者完全同名重叠。

---

## 5. 三种解决方案比较与推荐契约

| 方案模式 | 模式定义 | Compatibility (兼容性) | Business Meaning (业务语义) | Data Available (数据支撑) | Risk (风险) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **MODE A** | 保留 ID，语义修正为“合规初筛已启动 / 档案已建” | 高（保留 check id，调整 label/message） | 表达进入合规前必须先建立合规档案或启动初筛 | 4B 已有 `project.compliance`，可检查非空 | 偏高：若强求初筛已启动，可能挡住刚打完样准备建档的项目 |
| **MODE B (推荐)** | 保留 ID，语义定义为“合规评估待开展 / 就绪” | **最高**（完全保留 check id 与调用签名） | **完全自洽**：进入合规阶段时，合规任务处于 Pending/就绪或进行中即可进入，主要由 `samples_record` 守门 | 4B 事实完全具备 (`NOT_STARTED` / `IN_ASSESSMENT` 均 PASS) | **极低**：消除阶段倒置，流程顺畅 |
| **MODE C** | 维持现状，死板要求“合规评估完成”才进 COMPLIANCE | 形式兼容 | 严重荒谬：合规阶段名存实亡 | 要求 `assessmentStatus === 'COMPLETED'` | 极高：业务流程死锁 |

### 推荐契约：
采纳 **MODE B**：
- 保留 Check ID：`compliance_pending`（禁止改动 ID，确保对现有调用、测试、快照兼容）；
- 修正 Label：`'合规评估就绪 / 待开展'`；
- 判定语义：只要合规模块已就绪，当前状态处于待开展 (`NOT_STARTED`)、审查中 (`IN_ASSESSMENT`) 或已评估 (`COMPLETED`) 均视为合规准入就绪，予以 **PASS**。

---

## 6. ID 与 Label 分离处理原则

- **`KEEP_CHECK_IDS: YES`**：`compliance_pending`, `compliance_done`, `cert_plan` 三个 ID 永久保留；
- **`LABEL_AND_SEMANTICS_TUNING: YES`**：允许且必须在 4C2 中将 `compliance_pending` 的 UI Label 修正为“合规评估待开展 / 就绪”，彻底消除语义冲突。

---

## 7. Assessment Status 真实语义固定

在 TASK 07A-4B 中已建立枚举：`NOT_STARTED`, `IN_ASSESSMENT`, `COMPLETED`。
必须在宪法级别锁定其语义边界：
1. `assessmentStatus` **仅表达项目团队针对该 SKU 的合规评估工作进度**；
2. 它 **不代表官方证书已取得**（No Certificate Issued）；
3. 它 **不代表具体 Requirements 事项均已执行闭环**（No Execution Done）；
4. 它 **不代表该商品已获法定准入清关背书**（No Legal Clearance）。

---

## 8. `compliance_pending` 候选事实与判定规则

当调用层传入 `availableModules.compliance.evaluated === true` 时：
- `project.compliance` 存在且 `assessmentStatus` 为 `NOT_STARTED` → **PASS**（评估已就绪，待开展）；
- `assessmentStatus` 为 `IN_ASSESSMENT` → **PASS**（评估已在推进中）；
- `assessmentStatus` 为 `COMPLETED` → **PASS**（评估已提前完成）；
- 若 `availableModules.compliance` 缺失或 `evaluated !== true` → **NOT_EVALUATED**（兼容未接入环境）；
- 若数据结构损坏或非法枚举 → **FAIL**（Fail-close 防御）。

---

## 9. `NOT_EVALUATED` 兼容原则

- **历史项目零阻断**：对于历史项目（`project.compliance === {}`）或在未注入 `availableModules.compliance` 的测试/环境中，三个 check 必须统一返回 `NOT_EVALUATED`；
- **继承 T7 Supplier/Sample Gate 规范**：严格依赖调用层显式传入的 `evaluated: true` 标志，未注入模块事实时绝不伪造 PASS，也绝不突然报错 FAIL。

---

## 10. `compliance_done` 语义：Assessment Complete ≠ Requirements Done

源码定位：[`gateEngine.js:152`](file:///d:/ozon/ozon-react/src/utils/t6/gateEngine.js#L152)（`CHECKS.PRODUCTION`）。
- **Label 事实**：`'合规评估完成'`。
- **业务定性**：它检查的是进入生产阶段前，**合规评估是否已经得出结论**；
- **解耦铁律**：
  **`ASSESSMENT COMPLETE ≠ ALL REQUIREMENTS DONE`**！
  - 评估完成（`assessmentStatus === 'COMPLETED'`）代表团队已经掌握法规政策、明确了认证方案与包装要求；
  - 但此时，某些具体执行事项（如标签打样印刷、大货出厂批次送检等）完全可以在生产阶段（PRODUCTION）伴随大货继续执行；
  - **严禁擅自增加“所有 required requirements.status === 'DONE'”作为 `compliance_done` 的硬性通过条件**！
- 若未来业务确实需要“生产或上架前所有合规事项清零”，必须作为**独立的新 Check** 提出，绝不能偷换 `compliance_done` 的概念。

---

## 11. `cert_plan` 核心问题与重大歧义审计

源码定位：[`gateEngine.js:153`](file:///d:/ozon/ozon-react/src/utils/t6/gateEngine.js#L153)（`CHECKS.PRODUCTION`）。
- **Label 事实**：`'认证计划存在'`。
- **核心原则**：检查的是**“认证处理计划/路径是否明确”**，绝对不是“证书是否已取得（Result）”。

### 11.1 Certification Requirement 三种情况分析
- **CASE 1**: 存在 `category === 'CERTIFICATION'` 且 `required === true`。
  - 含义：明确需要认证，且已建立必选认证事项。
- **CASE 2**: 存在 `category === 'CERTIFICATION'` 且 `required === false`。
  - 含义：已排查认证事项，确认该事项不需要办理。
- **CASE 3**: **完全不存在 `category === 'CERTIFICATION'` 的 Requirement！**
  - 重大歧义：
    - 含义 A：该商品普通日用品，经评估**完全无需认证**；
    - 含义 B：团队**尚未开始评估**认证适用性；
    - 含义 C：团队评估了需要办证，但**操作人员忘记在系统建立事项**。
  - **审计判定**：**`CERTIFICATION_APPLICABILITY_GAP = PRESENT`**！
    当前 Schema 无法从一个空数组中区分出该商品究竟是“无需认证”还是“尚未评估/漏填”。

### 11.2 `certificationPlan === ''` 文本歧义
- **审计判定**：**`CERT_PLAN_AMBIGUITY = PRESENT`**！
  文本为空可能表示“免办认证所以留空”，也可能表示“忘记录入方案”。系统缺乏枚举或布尔字段表达“免认证”。

### 11.3 裁决：严禁为 Gate 提前加 Result，4C2 延期 `cert_plan`
- **铁律**：绝不能为了让 `cert_plan` 跑通而引入 `certificateNumber` 或 `resultType`；
- **实施判定**：
  鉴于当前 Schema 存在 `CERTIFICATION_APPLICABILITY_GAP`，任何非黑即白的判定规则（如“没有 CERTIFICATION 事项就判 FAIL”）都会误伤无需认证的正常商品；
  因此：**在 TASK 07A-4C2 中，`cert_plan` 必须继续保持 `NOT_EVALUATED`**，直到后续最小数据补丁落地。

---

## 12. 最小数据补丁建议 (MINIMAL_DATA_GAP Proposal — NOT IMPLEMENTED)

为在未来彻底解决 `cert_plan` 的免认证歧义，建议后续版本在 `project.compliance` 中引入最小显式决策字段（仅作建议，本任务不实现）：
```javascript
// PROPOSED DATA PATCH (Future TASK 07A-4D / 4B-R)
project.compliance = {
  ...
  certificationApplicability: 'REQUIRED' | 'EXEMPT' | 'NOT_APPLICABLE' | 'UNDECIDED',
  // 当为 EXEMPT / NOT_APPLICABLE 时，无 CERTIFICATION 事项自动 PASS
  // 当为 REQUIRED 时，必须具备有效 certificationPlan 或 CERTIFICATION 事项
}
```

---

## 13. 字段不可误用铁律 (Boundary Invariants)

1. **`Requirement.required === false`**：仅代表该具体事项不需处理，绝不等于整个 SKU 免认证；
2. **`Requirement.status === 'DONE'`**：仅代表内部检查动作完成，绝不等于法定发证；
3. **`riskLevel`**：仅为团队内部合规风险标签，**`NOT_USED_FOR_GATE`**；
4. **`applicableStandards`**：仅为法规代号清单，**不等于认证方案计划**；
5. **`Workflow Nodes (n9/n10)`**：看板节点打卡状态与结构化 Gate 彻底解耦；
6. **`MI Evidence (eacStatus)`**：历史市场证据仅作只读参考，绝不直接让 Gate PASS。

---

## 14. Gate 架构纯度与事实注入契约

### 14.1 调用层与引擎隔离
```text
ProjectDetailPage / transitionProjectStage
       │
       │ (读取 project.compliance 纯数据)
       ▼
availableModules.compliance 事实注入
       │
       ▼
gateEngine.evaluateProjectGate (纯函数，零外部 Store/网络/浏览器依赖)
```
- `gateEngine.js` 严禁直接 `import t6Store`，严禁调用 `getProject()`；
- 保持与 `availableModules.supplier` 和 `availableModules.samples` 相同的纯上下文依赖注入模型。

### 14.2 建议注入事实对象 (PROPOSED — NOT IMPLEMENTED)
```javascript
// 仅向 Gate 提供最小必要状态，绝不传递整个 project 对象或笨重数组
availableModules.compliance = {
  evaluated: true,
  assessmentStatus: project.compliance?.assessmentStatus || 'NOT_STARTED',
}
```

---

## 15. Preview 与 Transition 一致性审计

在 [`ProjectDetailPage.jsx:147-185`](file:///d:/ozon/ozon-react/src/components/t6/ProjectDetailPage.jsx#L147-L185) 中：
- `gate = evaluateProjectGate(project, targetStage, gateDeps)`（页面实时预览）；
- `transitionProjectStage({ projectId, targetStage, deps: gateDeps, reason })`（用户点击推进）；
- **两者消费完全相同的 `gateDeps` 对象**，4C2 接入时必须严格保持这一契约一致性。

---

## 16. 跨阶段 Path Gate 穿透审计 (Multi-stage Jump)

- **场景**：项目从 `SAMPLING`（阶段 3）直接跨阶段推进到 `PRODUCTION`（阶段 5）；
- **执行路径**：`path = ['COMPLIANCE', 'PRODUCTION']`；
- **聚合检查项**：
  1. `samples_record` (COMPLIANCE)
  2. `compliance_pending` (COMPLIANCE)
  3. `compliance_done` (PRODUCTION)
  4. `cert_plan` (PRODUCTION)
- **逻辑自洽性验证**：
  - `compliance_pending` 要求“评估就绪/待开展”（MODE B: `NOT_STARTED` / `IN_ASSESSMENT` / `COMPLETED` 均 PASS）；
  - `compliance_done` 要求“评估已完成”（`COMPLETED` PASS，其余 FAIL）；
  - 当项目评估完成时，`compliance_pending` 与 `compliance_done` 同时 PASS；
  - 当项目尚未评估完成时，`compliance_done` 准确抛出 FAIL (RED) 实施阻断；
  - **两者顺次求值，逻辑完全闭环，绝不产生跨阶段互斥或悖论**。

---

## 17. 业务场景模拟推演 (Cases A ~ F)

| 场景代码 | 场景输入描述 | `compliance_pending`<br>(进 COMPLIANCE) | `compliance_done`<br>(进 PRODUCTION) | `cert_plan`<br>(进 PRODUCTION) | 跨阶段单次推进<br>(SAMPLING→PRODUCTION) |
| :---: | :--- | :---: | :---: | :---: | :---: |
| **Case A** | `project.compliance = {}` (历史项目/未接入) | `NOT_EVALUATED` | `NOT_EVALUATED` | `NOT_EVALUATED` | `NOT_EVALUATED` (允许推进，不阻断历史项目) |
| **Case B** | `assessmentStatus: 'NOT_STARTED'` | **PASS** (就绪) | **FAIL** (评估未完成) | `NOT_EVALUATED` | **RED** (阻断) |
| **Case C** | `assessmentStatus: 'IN_ASSESSMENT'` | **PASS** (审查中) | **FAIL** (评估未完成) | `NOT_EVALUATED` | **RED** (阻断) |
| **Case D** | `assessmentStatus: 'COMPLETED'`<br>无认证要求，无计划文本 | **PASS** | **PASS** (评估完成) | `NOT_EVALUATED` (歧义保护) | **GREEN** |
| **Case E** | `assessmentStatus: 'COMPLETED'`<br>有认证要求，有计划文本 | **PASS** | **PASS** (评估完成) | `NOT_EVALUATED` (4C2 保持) | **GREEN** |
| **Case F** | `assessmentStatus: 'COMPLETED'`<br>认证要求 `required === false` | **PASS** | **PASS** (评估完成) | `NOT_EVALUATED` (4C2 保持) | **GREEN** |

---

## 18. Gate Result 四态与 Override 行为机制

1. **`GREEN` / `PASS`**：条件满足，允许无理由推进；
2. **`NOT_EVALUATED`**：模块未接入或未评估，**允许正常推进（无需理由）**；
3. **`YELLOW` / `WARN`**：存在风险，必须填写 `reason` 写入 `gate_override` 决策日志后方可推进；
4. **`RED` / `FAIL`**：核心事实缺失或不合规，必须填写 `reason` 写入 `gate_override` 决策日志后方可推进。
- **关键认知**：`NOT_EVALUATED` 不是阻断状态！因此在数据接入后，不合规情况必须返回 `FAIL`，绝不可滥用 `NOT_EVALUATED`。

---

## 19. T6 测试数量异常记账彻底澄清

- **审计结论**：**`T6_TEST_COUNT_CHANGE = REPORTING_DIFFERENCE`**；
- **真实基准**：
  `npm run test:t6` 包含 7 个测试文件，按顺序执行：
  1. `t6Store.test.mjs`: **56 项 PASS**
  2. `gateEngine.test.mjs`: **42 项 PASS**
  3. `costScenario.test.mjs`: **74 项 PASS**
  4. `wbScenario.test.mjs`: **53 项 PASS**
  5. `t6UiContract.test.mjs`: **26 项 PASS**
  6. `supplier.test.mjs`: **43 项 PASS**
  7. `factoryTrialCandidates.test.mjs`: **8 项 PASS**
  - **全量真实执行的测试总数从始至终都是 302 项全部 PASS**；
- **差异原因溯源**：
  - 之前报告中的 `130/130`，是报告者在累加终端截断后末尾可见的 4 个套件：`53 + 26 + 43 + 8 = 130`；
  - 07A-4B 报告中的 `122 项`，是报告者仅累加了 `53 + 26 + 43 = 122`，漏加上了最末尾的 `8` 项；
  - `package.json` 未受任何改动，无任何测试被移除或漏跑。

---

## 20. Gate Semantic Matrix (门禁语义矩阵)

| Check ID | Stage Entry | Existing Label | Recommended Label | Recommended Meaning | Data Needed | PASS 条件 | FAIL / WARN 条件 | NOT_EVALUATED 条件 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`compliance_pending`** | `COMPLIANCE`<br>(SAMPLING→COMPLIANCE) | 合规评估完成 | **合规评估就绪 / 待开展** | 进入合规阶段前，合规评估处于就绪、待开展或已启动状态 | `assessmentStatus` | `assessmentStatus` 处于有效状态 (`NOT_STARTED` / `IN_ASSESSMENT` / `COMPLETED`) | 非法状态或异常损坏 (FAIL) | `availableModules.compliance` 缺失或 `evaluated !== true` |
| **`compliance_done`** | `PRODUCTION`<br>(COMPLIANCE→PRODUCTION) | 合规评估完成 | **合规评估已完成** | 进入生产前，项目合规评估工作本身已经完成（法规已辨识、方案已确立） | `assessmentStatus` | `assessmentStatus === 'COMPLETED'` | `assessmentStatus !== 'COMPLETED'` (FAIL，阻断进入生产) | `availableModules.compliance` 缺失或 `evaluated !== true` |
| **`cert_plan`** | `PRODUCTION`<br>(COMPLIANCE→PRODUCTION) | 认证计划存在 | **认证处理计划明确** | 进入生产前，商品的认证路径或豁免方案已明确建立 | `certificationPlan`<br>`requirements[]` | 明确有认证计划或明确免认证 | 存在认证要求但无计划 (FAIL) | **4C2 阶段保持 NOT_EVALUATED**（消除 CASE 3 歧义前不强行判定） |

---

## 21. 数据充分性判定 (Data Sufficiency)

- **`COMPLIANCE_PENDING_DATA = SUFFICIENT`**（4B 事实完全充足）；
- **`COMPLIANCE_DONE_DATA = SUFFICIENT`**（4B 事实完全充足）；
- **`CERT_PLAN_DATA = INSUFFICIENT`**（存在无需认证与未评估的严重语义歧义）。

---

## 22. 07A-4C2 实施范围与决策 (Implementation Decision)

- **`07A-4C2 IMPLEMENTATION STATUS: READY_PARTIAL`**
- **READY CHECKS**：
  - `compliance_pending`: 修正 Label 为“合规评估就绪 / 待开展”，实现就绪求值器；
  - `compliance_done`: 实现基于 `assessmentStatus === 'COMPLETED'` 的求值器。
- **BLOCKED CHECKS**：
  - `cert_plan`: 保持 `NOT_EVALUATED`（不伪装通过，不误伤免认证商品）。
- **WHY**：
  在没有显式“认证适用性/豁免决策”数据字段前，无法安全区分“无需认证”与“尚未制定计划”。延期 `cert_plan` 事实求值，符合架构审慎与 Fail-close 原则。

---

## 23. CONTRACT SUMMARY

```text
COMPLIANCE GATE
Path Semantics:
  - CHECKS.COMPLIANCE: Evaluated on entering COMPLIANCE (SAMPLING -> COMPLIANCE)
  - CHECKS.PRODUCTION: Evaluated on entering PRODUCTION (COMPLIANCE -> PRODUCTION)

CHECKS
compliance_pending:
  Recommended Label: 合规评估就绪 / 待开展
  Recommended Meaning: 进入合规阶段时合规评估已建档且就绪/进行中
  Data Sufficiency: SUFFICIENT

compliance_done:
  Recommended Label: 合规评估已完成
  Recommended Meaning: 进入生产阶段前合规评估工作本身已完成
  Data Sufficiency: SUFFICIENT

cert_plan:
  Recommended Label: 认证处理计划明确
  Recommended Meaning: 明确认证路径或豁免方案
  Data Sufficiency: INSUFFICIENT (Deferred to future data patch)

RESULTS
Missing Module Fact: NOT_EVALUATED (backward compatible)
Known Empty Fact: FAIL for compliance_done, PASS for compliance_pending
Positive Fact: PASS

BOUNDARIES
Reads Store Directly: NO (Strict dependency injection via gateDeps)
Uses MI Evidence: NO (Decoupled from eacStatus)
Uses Workflow Nodes: NO (Decoupled from n9/n10 states)
Uses Sample Data: NO (Decoupled from sample counts)
Uses Result Layer: NO (Zero certificateNumber dependencies)

TEST BASELINE
Previous T6 Count: 130 (tail truncated sum: 53+26+43+8)
Current T6 Count: 122 reported (missed adding 8); actual total is 302 across all 7 suites
Count Change Cause: REPORTING_DIFFERENCE

NEXT
07A-4C2 Status: READY_PARTIAL
07A-4C2 Allowed Checks: compliance_pending, compliance_done
Remaining Data Gap: certificationApplicability for cert_plan
```
