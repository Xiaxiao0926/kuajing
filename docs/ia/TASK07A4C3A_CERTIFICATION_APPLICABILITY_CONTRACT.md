# KUAIJING-IA-REFACTOR-V1 · TASK 07A-4C3A (Revision 5)
# Certification Applicability & cert_plan Gate Contract (Final Contract Freeze 最终合同冻结规范)

> **文档性质**：只读审计、架构数据合同修订与实施规范准则。  
> **生产代码变更**：**0 行**（严格不修改任何生产代码与测试代码）。  
> **当前实施状态**：**`07A-4C3B IMPLEMENTATION STATUS: PENDING_CODEX_ACCEPTANCE`（最终合同冻结，待 Codex 独立验收，尚未授权实施）**。  
> **版本修订记录**：
> - Revision 1~3 (2026-09-21 ~ 2026-09-24): 初始方案推演与 Store 影响链、数据分类初步规范。
> - Revision 4 (2026-09-24): 修正缺失与非法值分类、12 行真值表初版。
> - Revision 5 (2026-09-24 当前版 - R5 Final Contract Freeze 终审冻结):
>   1. **冻结新旧项目创建合同**：4C3B 必做实施项——仅在真正 `createProject()` 创建新项目时初始化 `compliance: { certificationApplicability: 'UNASSESSED' }`；历史项目绝对不自动迁移；
>   2. **彻底取消隐式 Assessment 建立**：`buildNextProjectCompliance` 严禁因空档案、更新备注或 Requirement CRUD 自动写入 `assessmentStatus: 'NOT_STARTED'`；未显式保存前 `compliance_pending = FAIL`；
>   3. **修订历史缺失字段准确含义**：历史缺失为 `NOT_EVALUATED`，新项目显式 `UNASSESSED` 为 `FAIL`；重构 `isProjectComplianceEmpty` 目标合同，确保非法值进入 Gate 并判定为 `FAIL`；
>   4. **冻结 NOT_REQUIRED 原子保存**：规范化、依据校验、持久化与日志一次性原子处理，失败零写入零日志，同值保存 No-op；
>   5. **修正 Gate 12 行真值表与综合评定**：全行统一遵从 `RED > YELLOW > NOT_EVALUATED > GREEN` 规则，单项 PASS 不保证整体 GREEN；
>   6. **修正历史兼容推进提示**：统一提示文案“该项目尚未记录认证适用性，目前该项采用兼容处理，不代表认证判断已经完成”；
>   7. **彻底清理监管效力断言**：全文档统一替换为中立核实表述，删除所有绝对化法律结论；
>   8. **客观纠正 Override 权限表述**：明确现有 `stageTransition.js` 仅校验非空理由并记录日志，无角色鉴权；
>   9. **确立 4C3B 固定验收矩阵**：新增 13 项明确验收测试契约。

---

## 1. 业务困境与核心歧义 (Current Ambiguity & Problem Statement)

在合规工作区（TASK 07A-4B）与门禁基础架构（TASK 07A-4C2）落地后，系统确立了准入合规阶段的 `compliance_pending` 与准入生产阶段的 `compliance_done`。但生产准入检查项中的 `cert_plan` 依然保持 `NOT_EVALUATED`（依赖 generic module fallback）。

根本原因在于既有底层数据模型中，缺少对商品“是否适用强制认证/声明”的独立定性：

```text
       project.compliance.requirements: [] 且 certificationPlan: ''
                               │
       ┌───────────────────────┼───────────────────────┐
       ▼                       ▼                       ▼
    CASE A                  CASE B                  CASE C
  商品无需认证            尚未开展认证评估        需要认证但漏填计划
(Legit Not-Required)     (Unassessed)            (Plan Missing)
       │                       │                       │
  期望 Gate: PASS         期望 Gate: FAIL         期望 Gate: FAIL
```

1. **`requirements` 数组不能作为适用性所有者 (Applicability Owner)**：
   - 空数组无法在语义上区分“商品免认证”、“尚未评估”还是“遗漏未填”；
   - 依赖事项数组推导商品法规属性属于领域倒置。
2. **`certificationPlan` 方案文本不能作为适用性所有者**：
   - 文本为空（`certificationPlan === ''`）无法区分是“无需认证所以不写”，还是“未制定计划”；
   - `certificationPlan` 是规划说明文本（Plan Text），不具备结构化裁决属性。
3. **裁决结论**：
   必须在 `project.compliance` 中增加独立的显式决策字段，负责且仅负责表达：**“当前 SKU 到底需要认证、无需认证，还是尚未判断？”**

---

## 2. 既有源码认证语义全量审计 (Existing Source Audit)

对仓库现有源码中涉及认证、EAC、状态与豁免的定义进行全量审计：

| 源码位置 | 字段 / 代码片段 | 业务性质 | 审计定性与现状 |
| :--- | :--- | :--- | :--- |
| `candidateMarketBridge.js:65-66` | `eacStatus: niche?.eac_status`<br>`certificationStatus: niche?.certification_status` | 选品市场调研证据 | **外部市场参考线索**（只读引用，零法定效力，严禁自动复制入项目） |
| `validation_pool.json:19` | `"eac": "NOT_REQUIRED_VERIFIED (属于非电气类手动五金工具，通常仅需豁免函)"` | 调研样例池非受控文本 | **非规范文本**（混杂了内部判断与函件线索，不具备法律效力引用） |
| `complianceProfile.js:8-10, 62-70` | `FORBIDDEN_RESULT_FIELDS = ['resultType', 'certificateNumber', 'exemptReason', ...]` | 4B 冻结的领域防御 | **明确将 `exemptReason` 列为严禁混入的 Result 字段** |
| `t6Store.js:407` | `compliance: {}` | `createProject` 初始项目结构 | **空对象初始化**：历史项目与新项目均为空，无法仅凭对象为空判断项目新旧 |
| `t6Store.js:886` | `const PROFILE_FIELDS = ['assessmentStatus', 'riskLevel', 'applicableStandards', 'certificationPlan', 'notes']` | Store 持久化更新白名单 | **硬编码独立列表**（必须同步扩充 Store，否则 patch 新字段将被静默丢弃） |
| `complianceProfile.js:209-213` | `base = isProjectComplianceEmpty(current) ? buildInitialComplianceDraft() : { ...buildInitialComplianceDraft(), ...current }` | Profile 合并纯函数 | **存在隐式补齐漏洞**（旧项目更新其他字段时会被暗中注入默认值） |
| `ProjectCompliancePanel.jsx:876` | Layer A（Assessment）与 Layer B（Plan）双表单分离 | UI 表现与独立草稿管理 | **两表单独立保存**（新增字段必须明确归属与保存按钮责任） |
| `gateEngine.js:201` | `{ id: 'cert_plan', label: '认证计划存在', kind: 'module', module: 'compliance' }` | 生产阶段准入门禁 | **当前无 explicit evaluator**，依赖 generic module fallback 恒为 `NOT_EVALUATED` |
| `ProjectDetailPage.jsx:148-155` | `complianceFact = { evaluated: true, assessmentStatus: ... }` | 门禁调用层上下文注入 | **上下文尚未注入适用性与计划有效性事实** |

---

## 3. MI 市场证据与项目合规决策隔离原则

- `candidate.marketEvidence.eacStatus` 与 `certificationStatus` 是市场验证阶段采集到的外部竞品/类目情报；
- **宪法铁律**：**MI 证据绝对禁止自动复制或自动预填到 `project.compliance` 中**；
- **业务依据**：类目一般参考信息不代表特定工厂的具体商品法规属性。特定商品的材质、物理结构、用途及参数差异均可能改变其实际适用的技术法规。项目级认证决策必须由合规或运营人员根据具体商品物理事实独立定性。MI 证据在 UI 界面仅作为“参考线索”只读展示。

---

## 4. 核心语义分层模型与术语边界 (Core Semantic Layers & Terminology)

合规领域严格遵循四层单向演进模型，严禁混淆概念与法律效力：

```text
┌────────────────────────────────────────────────────────────────────────┐
│ 1. 市场线索 (Market Clues / Reference)                                 │
│    - 载体：candidate.marketEvidence (eacStatus / certificationStatus)  │
│    - 性质：外部类目与竞品调研情报，只读参考，零法定效力。              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. 适用性判断与依据 (Layer A: Applicability Decision & Justification)   │
│    - 载体：certificationApplicability + certificationApplicabilityNotes│
│    - 性质：项目团队对当前 SKU 的内部法规适用性判定与依据留痕。         │
│    - 责任人：合规负责人 / 运营项目组                                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. 规划路径与核验清单 (Layer B: Plan & Checklist)                      │
│    - 载体：certificationPlan (方案说明) + requirements[] (核验事项)   │
│    - 性质：内部处理步骤规划，不代表证件已取得。                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 4. 证件与函件材料 (Layer C: Result - V1 阶段严格冻结未开放)            │
│    - 载体：certificateNumber, exemptReason, validUntil 等              │
│    - 性质：相关证件或函件材料的签发主体、适用范围和法律效力，须针对具  │
│            体商品及适用要求另行核实。                                  │
└────────────────────────────────────────────────────────────────────────┘
```

### 术语与法律效力边界裁决
1. **中立合规用语规范**：
   - 彻底删除关于“特定品类绝对无需任何证明、海关完全免审”等超出软件审计边界的未经引用断言；不得把任何示例商品类别当成已经核实的法规结论；
   - 在软件系统中，`NOT_REQUIRED` 仅代表**“经项目团队内部判断，该 SKU 无需办理当前所讨论的认证/声明手续”**，不代表免除其它适用法规、技术规范、标签标识、检验检测、海关进口或电商平台管制要求。
2. **相关证件或函件材料效力界定**：
   - 针对市场业务中提及的豁免函/说明函（Отказное письмо / Разъяснительное письмо）：**相关证件或函件材料的签发主体、适用范围和法律效力，须针对具体商品及适用要求另行核实**。
   - 官方函件包含公函编号与签发机构信息，严格属于 **`Layer C: Result`（证件与函件材料）**。
   - 严禁将 `EXEMPT` 作为枚举值混入 Layer A 的 `certificationApplicability`。
3. **内部规划放行 ≠ 外部法定许可**：
   - Stage Gate `cert_plan` 检查通过，**仅代表项目在内部流程上明确了认证路径或依据**；
   - 严禁将门禁通过宣传或记录为“海关放行”、“平台免审”或“全链路法定合规通过”。
4. **“无需认证”的依据留痕性质**：
   - 当判定为无需认证时，必须录入依据记录（`certificationApplicabilityNotes`，trim 后长度 >= 2）；
   - 该校验仅为**纯前端/服务端的文本录入完整性校验**，系统不具备判断其法律真实性与充分性的能力。

---

## 5. 数据情况分类与非法值处理合同 (Missing vs Invalid Values)

### 5.1 数据情况与合同处理矩阵
正式冻结以下 6 类数据情况在系统各层的处理规则：

| 数据情况 | 数据库持久化存储表现 | 读取与内存表现 | 写入 Patch 校验规则 | 门禁 `cert_plan` 结果 | 业务语义与系统动作 |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **1. 字段不存在** | 键不存在（缺失） | `undefined` | 允许缺省 | **`NOT_EVALUATED`** | 历史遗留档案兼容放行 |
| **2. 读取为 undefined** | 键不存在或内存未定义 | `undefined` | 允许缺省 | **`NOT_EVALUATED`** | 按字段缺失处理 |
| **3. Patch 显式含 undefined** | 无法被 JSON 序列化 | 显式传入 `undefined` | **直接拒绝（Fail-close 抛错）** | — | 非法写入调用，拦截抛错 |
| **4. null** | `"certificationApplicability": null` | `null` | **直接拒绝（Fail-close 抛错）** | **`FAIL` (RED)** | 损坏/非法值拦截 |
| **5. 空字符串** | `"certificationApplicability": ""` | `""` | **直接拒绝（Fail-close 抛错）** | **`FAIL` (RED)** | 损坏/非法值拦截 |
| **6. EXEMPT 或未知枚举** | 包含非法枚举字符串 | 非法字符串 | **直接拒绝（Fail-close 抛错）** | **`FAIL` (RED)** | 越层/非法枚举拦截 |

> **关键准则**：在本地存储持久化为 JSON 字符串后，存储层不依赖“缺失键”与“值为 undefined 的键”之间的细微内存差异（JSON 序列化会自动丢弃值为 undefined 的键）。但系统在内存读取与校验中必须严格识别显式非法值。

### 5.2 受控枚举常量
```javascript
export const COMPLIANCE_CERTIFICATION_APPLICABILITY = Object.freeze({
  UNASSESSED: 'UNASSESSED',     // 尚未判断（初始定性/未评估）
  REQUIRED: 'REQUIRED',         // 需要办理认证/声明
  NOT_REQUIRED: 'NOT_REQUIRED', // 判定无需办理认证
})
```
- **合法值集合**：严格限定为 `['UNASSESSED', 'REQUIRED', 'NOT_REQUIRED']`。
- **Fail-close 校验**：传入非上述 3 个字符串一律抛错拦截。

### 5.3 `isProjectComplianceEmpty()` 目标合同重构
现行 `isProjectComplianceEmpty` 函数存在严重设计缺陷：若一个对象所有键的值均为 `null`、`undefined` 或 `""`，函数会将其判定为空档案：
```javascript
// 现有缺陷逻辑：
// 若 compliance 为 { certificationApplicability: null }，会被判定为 empty！
// 导致 ProjectDetailPage 不生成 complianceFact，进而使 Gate 降级为 NOT_EVALUATED 漏过拦截！
```
**修订后的目标合同**：
1. 即使其它 Profile 字段均为空，只要已存储对象明确包含 `certificationApplicability`（无论其值是合法枚举还是 `null`、`""` 等非法值），**绝对不能将其判定为没有合规模块事实的空容器**！
2. 目标契约判定逻辑伪代码：
   ```javascript
   export function isProjectComplianceEmpty(compliance) {
     if (!compliance || typeof compliance !== 'object') return true
     // 只要显式存在 certificationApplicability 键，无论值为何，均非空（必须交给 Gate 审查）
     if ('certificationApplicability' in compliance) return false
     const keys = Object.keys(compliance)
     if (keys.length === 0) return true
     return keys.every((k) => {
       const val = compliance[k]
       if (val === null || val === undefined || val === '') return true
       if (Array.isArray(val) && val.length === 0) return true
       return false
     })
   }
   ```
3. 效果：`{ certificationApplicability: null }` 将准确生成 `complianceFact`，并在 Gate 检查中命中非法值分支，返回 **`FAIL` (RED)** 拦截，绝不发生静默降级。

---

## 6. 冻结新旧项目创建与彻底取消隐式 Assessment 建立

### 6.1 新旧项目创建与保留合同 (4C3B 必做实施规则)
1. **新项目初始化规则 (Mandatory Implementation Rule)**：
   - 4C3B 必须在真正的 `createProject()` 创建新项目时（[t6Store.js:407](file:///D:/ozon/ozon-react/src/utils/t6/t6Store.js#L407)），明确初始化：
     ```javascript
     compliance: {
       certificationApplicability: 'UNASSESSED',
     }
     ```
   - 这是新项目唯一的持久化创建规则，**严禁据此修改历史 Project，严禁引入自动批量数据迁移**。
2. **历史项目零修改保留规则**：
   - 历史数据保持原样。如果原本没有 `certificationApplicability`，读取、修改备注、保存计划和 Requirement CRUD 均绝对不得自动补齐；
   - 如果原本存在该字段（无论合法与否），修改其它字段时绝对不得将其删除或替换。

### 6.2 彻底取消隐式 Assessment 建立 (Total Cancellation of Implicit Assessment)
这是本次技术合同最核心的架构约束：
1. **通用默认草稿去持久化**：
   - `buildInitialComplianceDraft()` 仅供旧 UI 本地草稿使用，**严禁将 `certificationApplicability` 或 `certificationApplicabilityNotes` 作为通用可持久化默认值**。
2. **纯函数合并以当前真实数据为基础**：
   - `buildNextProjectCompliance({ current, patch })` 必须以当前实际持久化数据为合并基础；
   - **绝对不得因为 Compliance 为空、执行 Profile 更新或创建 Requirement，就自动写入 `assessmentStatus: 'NOT_STARTED'`**；
   - Requirement 的创建、更新、删除绝对不得补齐缺失的 Assessment 状态；
   - 只有用户在 Layer A 表单中明确选择并保存 Assessment 状态时，才写入 `assessmentStatus`。
3. **新项目初始门禁三连 FAIL 行为推演**：
   - 新建项目初始仅包含 `{ certificationApplicability: 'UNASSESSED' }`，此时：
     - `compliance_pending = FAIL`（合规评估档案尚未建立，因为 `assessmentStatus` 缺失）；
     - `compliance_done = FAIL`（合规评估尚未完成）；
     - 4C3B 接入后，`cert_plan = FAIL`（适用性尚未判断，值为 `UNASSESSED`）。
   - **只修改 notes 或操作 Requirements 绝对不得让 `compliance_pending` 自动变成 PASS**！
   - 用户首次明确保存 Assessment 时，系统必须完整保留已经存在的 `certificationApplicability: 'UNASSESSED'`。
4. **历史档案 UI 展示规范**：
   - 历史档案缺少该字段时，UI 界面统一显示：**“未记录” (Not Recorded)**；
   - 界面上显示“未记录”，**绝对不得在内存或持久化存储中自动将其转换为 `UNASSESSED`**。

---

## 7. UI 显式保存与原子更新合同 (Explicit UI & Atomic Save Contract)

新增字段归属于 `ProjectCompliancePanel.jsx` 的 Layer A（Assessment 表单），但**打开表单绝不产生写入意图**：

### 7.1 交互意图捕获与 Patch 构建
1. **初始挂载与“未记录”状态**：
   - 打开包含历史档案的项目时，适用性下拉框展示“未记录”占位状态；
   - 此时表单草稿处于 clean 状态（`isDirty === false`），保存按钮置灰或保持原样；
   - 不得自动选中任何可提交的枚举值（如不自动选中 `UNASSESSED`）。
2. **显式修改驱动 Patch**：
   - 只有当用户显式点击下拉框并主动选择了选项（如选择 `REQUIRED`、`NOT_REQUIRED` 或 `UNASSESSED`）时，草稿才标记为 dirty，且向保存 patch 中添加 `certificationApplicability`；
   - 只有当用户显式在依据输入框中键入文本时，草稿才向 patch 中添加 `certificationApplicabilityNotes`；
   - 若用户仅修改了合规备注（`notes-only`），生成的 patch 仅包含 `{ notes }`，**绝对不附带两个新增字段**。
3. **跨表单与 CRUD 绝对隔离**：
   - 点击 Layer B「保存合规计划」按钮（`handleSavePlan`）：生成的 patch 仅包含 `{ applicableStandards, certificationPlan }`，绝不修改新增字段；
   - 核验事项表格的增删改（Requirement CRUD）：仅调用 Requirement API，绝不修改顶层 Profile 字段。
4. **生命周期机制对齐**：
   - 项目切换（projectId 变化）：草稿与基准彻底重置，无串写残留；
   - 并发冲突检测（`detectAssessmentConflict`）：基于实际字段值比较，缺失值与缺失值视为相等，不误报冲突；
   - 成功保存后回填：规范化数据精确回填为本地基准，清除 dirty 标记。

---

## 8. Store 白名单与原子持久化合同 (Store and Atomic Persistence Contract)

### 8.1 白名单扩充规范 (本轮仅定规范，不修改源码)
1. `complianceProfile.js`：
   - `PROJECT_COMPLIANCE_FIELDS` 扩充包含 `certificationApplicability`, `certificationApplicabilityNotes`；
   - `PROFILE_PATCH_ALLOWED_FIELDS` 同步扩充包含上述两字段。
2. `t6Store.js`：
   - `PROFILE_FIELDS` 数组扩充：
     ```javascript
     const PROFILE_FIELDS = [
       'assessmentStatus',
       'riskLevel',
       'applicableStandards',
       'certificationPlan',
       'notes',
       'certificationApplicability',
       'certificationApplicabilityNotes',
     ]
     ```

### 8.2 NOT_REQUIRED 与新字段原子保存流水线
新字段必须支持一次原子更新。示例：
```javascript
{
  certificationApplicability: 'NOT_REQUIRED',
  certificationApplicabilityNotes: '纯机械结构手动五金工具，不含电气或化学控管成分'
}
```
**固定的处理顺序 (Fixed Processing Sequence)**：
1. **读取状态**：读取当前持久化实体；
2. **合并 Patch**：合并本次明确提交的完整 patch 字段；
3. **规范化验证**：规范化并验证合并后的最终状态（枚举合法性校验）；
4. **依据前置校验**：校验 `NOT_REQUIRED` 的判断依据（trim 后长度 >= 2）；
5. **原子持久化**：全部成功后一次性写入存储；
6. **单一审计日志**：仅对真实变更字段计算 `fromDiff` / `toDiff`，记录一次 `kind: 'compliance_update'` 的 `DecisionLog`。

**异常与幂等防线**：
- **全失败零写入**：任何一步校验失败（如缺依据或枚举非法），**项目零写入，DecisionLog 零新增，严禁部分保存**；
- **依据保留机制**：如果当前数据已经具备合法判断依据，更新其它字段时应保留并使用该依据；
- **同值 No-op**：规范化后相同值重复保存，`changedFields` 为空，直接返回未修改实体，零 Store 写入，零日志。

---

## 9. Stage Gate `cert_plan` 12 行真值表与门禁语义 (Gate Truth Table)

### 9.1 完整 12 行真值表 (Exhaustive 12-Row Truth Table)

检查项：`id: 'cert_plan'`，所属阶段：`PRODUCTION`，关联模块：`compliance`。  
统一事实输入：`fact = ctx.availableModules?.compliance`。  
统一事实字段名：`fact.certificationApplicabilityNotesPresent`（Boolean）、`fact.certificationPlanPresent`（Boolean）。

> **综合阶段总评裁决铁律**：
> 所有行的最终阶段流转总评（Stage Verdict）**绝不由单个 `cert_plan` 独家决定**，必须严格遵循全局优先级法则：  
> **`RED > YELLOW > NOT_EVALUATED > GREEN`**

| # | `fact.evaluated` | 字段存在性 | `fact.certificationApplicability` | `fact.certificationPlanPresent` | `fact.certificationApplicabilityNotesPresent` | `cert_plan` 单项结果 | 阶段综合 Verdict 规则 | 消息文本 / 提示规范 |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **1** | `false` / 缺失 | — | — | — | — | **`NOT_EVALUATED`** | 遵从优先级：若他项有 RED 则 RED；若全就绪则 NOT_EVALUATED | `'合规数据域尚未接入'` |
| **2** | `true` | `false` (Absent) | `undefined` | 任意 | 任意 | **`NOT_EVALUATED`** | 遵从优先级：若他项有 RED 则 RED；若全就绪则 NOT_EVALUATED | *该项目尚未记录认证适用性，目前该项采用兼容处理，不代表认证判断已经完成。* |
| **3** | `true` | `true` | `undefined` | 任意 | 任意 | **`NOT_EVALUATED`** | 遵从优先级：若他项有 RED 则 RED；若全就绪则 NOT_EVALUATED | *该项目尚未记录认证适用性，目前该项采用兼容处理，不代表认证判断已经完成。* |
| **4** | `true` | `true` | `null` | 任意 | 任意 | **`FAIL`** | **RED**（一票否决） | `'认证适用性状态无效（Fail-close）'` |
| **5** | `true` | `true` | `""` (空串) | 任意 | 任意 | **`FAIL`** | **RED**（一票否决） | `'认证适用性状态无效（Fail-close）'` |
| **6** | `true` | `true` | `false` / `0` | 任意 | 任意 | **`FAIL`** | **RED**（一票否决） | `'认证适用性状态无效（Fail-close）'` |
| **7** | `true` | `true` | `'EXEMPT'` / 未知 | 任意 | 任意 | **`FAIL`** | **RED**（一票否决） | `'认证适用性状态无效（Fail-close）'` |
| **8** | `true` | `true` | `'UNASSESSED'` | 任意 | 任意 | **`FAIL`** | **RED**（一票否决） | `'认证适用性尚未判断，请在合规面板确认'` |
| **9** | `true` | `true` | `'REQUIRED'` | `false` | 任意 | **`FAIL`** | **RED**（一票否决） | `'商品需要办理认证，但尚未制定认证处理计划'` |
| **10**| `true` | `true` | `'REQUIRED'` | `true` | 任意 | **`PASS`** | 仅当全路径 Checks 皆 PASS 时方为 **GREEN** | `'认证处理路径已明确'` |
| **11**| `true` | `true` | `'NOT_REQUIRED'`| 任意 | `false` | **`FAIL`** | **RED**（一票否决） | `'判定无需认证时必须填写判断依据'` |
| **12**| `true` | `true` | `'NOT_REQUIRED'`| 任意 | `true` | **`PASS`** | 仅当全路径 Checks 皆 PASS 时方为 **GREEN** | `'已明确判定无需办理认证（依据已留存）'` |

### 9.2 历史兼容推进提示规范 (Legacy Compatibility Warning)
- 当且仅当命中真值表 **行 2 或 行 3**（历史缺失字段的兼容分支）时，Gate 检查结果必须附带明确的提示说明：
  > **该项目尚未记录认证适用性，目前该项采用兼容处理，不代表认证判断已经完成。**
- **流转推进说明**：
  - 只有当整体 Gate 聚合结果确实允许正常推进时（即无其它 RED 阻断项），才可以进一步提示“目前允许兼容推进”；
  - 若阶段整体被其它检查项判定为 RED 或 YELLOW，必须明确告知用户仍受其它检查项限制，严禁误导用户；
  - 非法值（行 4-7）绝对不得显示兼容提示。
- **流转一致性**：不改变现行 `stageTransition.js` 规则，`NOT_EVALUATED` 允许向前流转且无需填写 override 理由。

### 9.3 阶段流转 Override 机制与客观现状
- 审计确认：现行 [stageTransition.js](file:///D:/ozon/ozon-react/src/utils/t6/stageTransition.js#L24-L30) 规则：
  ```javascript
  if (gate.verdict === GATE_VERDICTS.YELLOW || gate.verdict === GATE_VERDICTS.RED) {
    if (!reason.trim()) {
      throw new Error(`T6_GATE: ${gate.verdict} 推进必须填写理由（stage 未改变，未产生 override 日志）`)
    }
    appendLog({ subjectType: 'project', subjectId: projectId, projectId, kind: 'gate_override', from: project.stage, to: targetStage, reason, by })
  }
  ```
- **客观事实**：当前系统仅对推进理由进行了非空校验（`reason.trim()`）并记录审计日志，**并没有实现基于角色的用户权限鉴定（RBAC）**；
- 严禁出现“绝对禁止推进”或“仅授权管理员方可 Override”等不符合既有源码的表述。权限鉴权属于系统独立技术债，本合同不虚构尚未实现的权限能力。

---

## 10. Gate Fact 提取规范 (ProjectDetailPage Contract)

在 `ProjectDetailPage.jsx` 中，调用层规整数据并传递给 `gateEngine.js`：

```javascript
// ProjectDetailPage.jsx 中的注入契约:
const complianceEvaluated = !isProjectComplianceEmpty(project.compliance)
const complianceFact = complianceEvaluated
  ? {
      evaluated: true,
      assessmentStatus: project.compliance?.assessmentStatus,
      // 只有在字段确实存在时才注入，未存在时保持 undefined（以供 Gate 识别历史档案）
      certificationApplicability: project.compliance?.certificationApplicability,
      // 统一事实字段名称，纯格式录入完整性校验（trim 长度 >= 2）
      certificationApplicabilityNotesPresent: Boolean(
        typeof project.compliance?.certificationApplicabilityNotes === 'string' &&
        project.compliance.certificationApplicabilityNotes.trim().length >= 2
      ),
      // 计划文本非空校验
      certificationPlanPresent: Boolean(
        typeof project.compliance?.certificationPlan === 'string' &&
        project.compliance.certificationPlan.trim() !== ''
      ),
    }
  : undefined
```

---

## 11. 07A-4C3B 实施范围与强制验收测试矩阵

### 11.1 拟修改文件白名单 (待后续实施任务签发后执行)
1. `ozon-react/src/utils/t6/complianceProfile.js`：导出枚举、扩充白名单、改造合并函数消除隐式补齐、重构 `isProjectComplianceEmpty`。
2. `ozon-react/src/utils/t6/t6Store.js`：
   - **必做规则**：在 `createProject()` 中初始化 `compliance: { certificationApplicability: 'UNASSESSED' }`；
   - 扩充 `PROFILE_FIELDS`、优化原子差异对比。
3. `ozon-react/src/utils/t6/complianceDraftState.js`：草稿纯函数适配。
4. `ozon-react/src/utils/t6/gateEngine.js`：实现 `cert_plan` 12 行真值表评估器与兼容提示文案。
5. `ozon-react/src/components/t6/ProjectDetailPage.jsx`：注入规范化合规事实。
6. `ozon-react/src/components/t6/ProjectCompliancePanel.jsx`：Layer A 界面渲染“未记录”及交互控件。

### 11.2 4C3B 强制验收测试矩阵 (Mandatory 4C3B Acceptance Matrix)
以下 13 项场景是 4C3B 必须实现的测试契约（本轮 4C3A 文档阶段明确其规范，不声称已通过）：

| 序号 | 测试场景 | 必须满足的预期行为 |
| :---: | :--- | :--- |
| **1** | **新建 Project** | `createProject()` 初始化生成 `certificationApplicability: 'UNASSESSED'`，无 `assessmentStatus` |
| **2** | **新项目仅修改 notes** | `updateProjectCompliance` 仅更新备注，**绝对不自动写入 `assessmentStatus: 'NOT_STARTED'`** |
| **3** | **新项目仅操作 Requirements** | Requirement CRUD 仅修改事项数组，**绝对不自动建立 Assessment 状态** |
| **4** | **新项目首次显式保存 Assessment** | 显式写入选择的 `assessmentStatus`，同时**完整保留已有的 `certificationApplicability: 'UNASSESSED'`** |
| **5** | **历史空档案** | 历史遗留 `{}` 项目在读取和普通操作下**绝对不自动迁移或补齐字段** |
| **6** | **历史档案仅修改 notes** | 仅 patch 备注，**新字段继续保持缺失（undefined）**，不补齐默认值 |
| **7** | **历史档案仅保存 Plan** | Layer B 保存仅更新计划文本与法规，**新字段继续保持缺失** |
| **8** | **显式保存 NOT_REQUIRED 和依据** | 原子更新成功，一次性持久化并产生单条 `compliance_update` 决策日志 |
| **9** | **NOT_REQUIRED 缺少依据** | 触发校验拦截，**全过程零写入存储、零新增日志** |
| **10**| **非法 Applicability** | 传入 `null`、`""`、`false`、`0`、`'EXEMPT'` 时，Gate 坚决判定为 **`FAIL` (RED)** |
| **11**| **缺失 Applicability** | 历史缺失项目 Gate 单项返回 **`NOT_EVALUATED`**，并提示兼容说明 |
| **12**| **Candidate → Project 一键立项** | 验证候选池转项目创建链路完整性，不破坏既有数据拓扑与引用一致性 |
| **13**| **快照行为不变** | SCORING 快照与 MARKET_VALIDATION 快照行为与既有测试保持 100% 稳定一致 |

---

## 12. 合同结论与实施授权状态 (Contract Status)

```text
================================================================================
CONTRACT VERDICT: FROZEN_REVIEW_READY (FINAL CONTRACT FREEZE; READY FOR CODEX RE-ACCEPTANCE)
IMPLEMENTATION STATUS: PENDING_CODEX_ACCEPTANCE (待 Codex 重新验收，未授权实施)
================================================================================
- 新旧项目创建合同：已冻结，createProject 显式初始化 UNASSESSED，历史档案绝对零迁移。
- 彻底取消隐式 Assessment：已冻结，严禁因空档案、更新备注或 CRUD 自动写入 NOT_STARTED。
- 缺失与非法值合同：已冻结，严格区分历史兼容与非法拦截，重构 isProjectComplianceEmpty 契约。
- NOT_REQUIRED 原子保存：已冻结，规范化、校验、持久化与日志一次性原子处理，失败零写入零日志。
- Gate 真值表与综合评定：已冻结，统一 12 行标准真值表，全局遵循 RED > YELLOW > NOT_EVALUATED > GREEN。
- 历史兼容推进提示：已冻结，规范统一中立文案，严禁以偏概全。
- 监管效力断言：已彻底清理，统一替换为中立核实表述，删除所有绝对化法律结论。
- Override 权限表述：已客观纠正，真实反映 stageTransition 无 RBAC 现状。
- 4C3B 验收矩阵：已建立 13 项固定测试契约。
- 当前任务执行者：Gemini。
- 验收者：Codex。
- 下一实施阶段：待 Codex 独立重新验收通过后，另行签发 07A-4C3B 实施任务书。
================================================================================
```
