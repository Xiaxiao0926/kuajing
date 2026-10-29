# KUAIJING-IA-REFACTOR-V1 · TASK 07A-4A-R
# Project Compliance V1 — Current Contract Audit (语义纠偏修订版)

> **审计基线与性质说明**：
> 本文档为 `KUAIJING-IA-REFACTOR-V1 · TASK 07A-4A` 的法定语义纠偏修订版（07A-4A-R）。
> **纯只读契约审计，零生产代码修改**。
> 本次修订聚焦于：
> 1. 纠正将合规过度简化为单体 `complianceStatus + certificationType` 的错误建模；
> 2. 严格确立 **Assessment（评估过程）**、**Requirement / Plan（要求与计划）**、**Result（确认结果）** 三层边界；
> 3. 纠正将 `cert_plan`（认证计划存在）等同于证书结果的门禁倒置；
> 4. 纠正对 `compliance_pending` 门禁语义的越权解释，如实标记 `SEMANTIC_CONFLICT`；
> 5. 补齐正式 Compliance Ownership Matrix（五列）、Gate Fact Mapping Table、C1~C7 GAP 与完整 CONTRACT SUMMARY。

---

## 1. 保留与已确认的代码事实基线 (Retained Code Facts)

以下事实经过全仓源码逐行核验，继续作为全系统架构基石：

```text
PROJECT_COMPLIANCE_STATUS = EMPTY_CONTAINER
LEGACY_COMPLIANCE_IDENTITY = GLOBAL_SINGLETON_NO_PROJECT_ID
MI_OR_CANDIDATE_EVIDENCE ≠ PROJECT_COMPLIANCE_RESULT
MARKET_VALIDATION_SNAPSHOT_EVIDENCE = HISTORICAL_EVIDENCE
PRODUCT_PROFILE ≠ COMPLIANCE_OWNER
COMPLIANCE_ATTACHMENT_CURRENT = NONE / UNRESOLVED
```

### 1.1 `project.compliance` 事实源现状
- **源码位置**：[`ozon-react/src/utils/t6/t6Store.js:385`](file:///d:/ozon/ozon-react/src/utils/t6/t6Store.js#L385) 在 `createProject` 时初始化为字面量空对象：`compliance: {}`。
- **读写状态**：全仓代码零读取、零写入 `project.compliance`。
- **Store Mutation API**：`t6Store.js` 缺失任何关于 compliance 的更新、补丁或校验接口（`COMPLIANCE_MUTATION_API = NONE`）。
- **UI 呈现**：[`ozon-react/src/components/t6/ProjectDetailPage.jsx:56`](file:///d:/ozon/ozon-react/src/components/t6/ProjectDetailPage.jsx#L56) 在 `tab === 'compliance'` 时仅呈现静态占位文案：`PLACEHOLDERS.compliance = '合规数据域将在后续版本接入'`。

### 1.2 历史遗留 `ComplianceAssessment.jsx` 定位
- **源码位置**：[`ozon-react/src/components/ComplianceAssessment.jsx`](file:///d:/ozon/ozon-react/src/components/ComplianceAssessment.jsx)（共 689 行）。
- **实体身份**：`export default function ComplianceAssessment()` **零 Props**（无 `projectId`，无 `skuId`）。
- **存储机制**：纯全局命名空间，数据写入全局 IndexedDB（`ozon-compliance`）与全局 localStorage（`compliance-items`, `compliance-checklist`）。
- **本质**：全局通用的合规文档预览与任务清单小工具，脱离 T6 Project 实体生命周期。

---

## 2. 措辞纠偏：项目合规当前状态 (PROJECT_COMPLIANCE_CURRENT_STATE)

删除原文档中“法定结论具有法律责任效力”等超越软件边界的过强措辞，统一纠正为：

> **`PROJECT_COMPLIANCE_CURRENT_STATE`**：
> 项目内部维护的当前合规判断、计划与执行状态。
> 它可以记录人工确认的操作结果与业务信息，**但系统本身不证明法律有效性，亦不替代任何官方机构的证书/法规法定核验**。
> 它的核心作用是支撑跨职能团队在跨境选品、打样、量产、上线过程中的内部合规风控与决策门禁。

---

## 3. 三层数据边界与概念分离 (Assessment / Plan / Result)

合规领域业务生命周期长，绝不能用单一状态字段替代全流程。必须在概念与数据层严格分离三层架构：

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Layer A: ASSESSMENT (当前评估工作进行到哪里)                            │
│ - 解决问题：项目当前是否开始梳理法规？是否已完成初审？评估处于什么阶段？│
│ - 状态概念：NOT_STARTED / IN_ASSESSMENT / ASSESSED                     │
├────────────────────────────────────────────────────────────────────────┤
│ Layer B: REQUIREMENT / CERTIFICATION PLAN (要求与认证计划)             │
│ - 解决问题：项目判断需要处理什么法规/认证事项？怎么处理？由谁办理？   │
│ - 计划概念：是否需要认证？需要什么认证/测试？豁免依据是什么？计划完成时间？│
├────────────────────────────────────────────────────────────────────────┤
│ Layer C: RESULT (正式确认与核验结果)                                   │
│ - 解决问题：已经完成了什么正式结果？取得了什么证书凭证？               │
│ - 结果概念：证书编号、签发日期、有效截止日、官方豁免确认状态           │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.1 核心业务推导：评估完成 ≠ 认证完成
业务中存在大量以下典型分支，单一枚举必定导致状态失真：
- **分支 1（评估完成但免认证）**：`Assessment = ASSESSED` → `Plan = NO_CERTIFICATION_REQUIRED` → `Result = EXEMPTION_CONFIRMED`（项目无需办理 EAC 证书，可直接推进）。
- **分支 2（评估完成但正在办证）**：`Assessment = ASSESSED` → `Plan = EAC_DECLARATION_PLANNED` → `Result = PENDING_CERTIFICATE`（评估已彻底完成，但证书尚在实验室检测，不能谎称认证完成）。
- **分支 3（评估完成且证书就绪）**：`Assessment = ASSESSED` → `Plan = EAC_CERTIFICATE_REQUIRED` → `Result = CERTIFICATE_OBTAINED`。

---

## 4. 合规需求模型审计 (Requirement Model Audit)

通过对 `ComplianceAssessment.jsx`、`roadmap-v1.js` 与 `gateEngine.js` 的综合核验：

### 4.1 源码证据核查
1. **Legacy 清单分类**：`ComplianceAssessment.jsx` 明确包含四类任务项：
   - 法规识别（`c1`）
   - 成分筛查（`c2`）
   - 标签要求（`c3`）
   - 风险等级（`c4`）
   以及自由添加的合规条目（`category`: `'法规识别' | '成分筛查' | '标签要求' | '风险等级' | '其他'`）。
2. **Gate 门控定义**：`gateEngine.js` 明确独立区分了 `compliance_done`（评估结论）与 `cert_plan`（认证计划存在）。

### 4.2 决策判定：`REQUIREMENT_MODEL = PROFILE_PLUS_REQUIREMENTS`
- **否定 `PROFILE_ONLY`**：单体 Profile 会把“法规适用”、“标签确认”、“实验室送检”多个异构任务压扁为单个字符串，无法支持实际业务审查。
- **否定 `REQUIREMENTS_ONLY`**：纯条目列表缺少顶层项目级合规状态摘要，会导致 Stage Gate 难以执行高效的快速布尔判定。
- **裁决**：**采用 `PROFILE_PLUS_REQUIREMENTS` 复合模型**：
  - 顶层保持轻量 Profile（承载顶层评估阶段与总体风控状态）；
  - 内部嵌套 `requirements: [...]` 数组，承载具体合规/认证要求项。

### 4.3 为什么 V1 允许 `requirements` 数组内嵌在 `project.compliance`？
1. **数量规模小**：单个跨境电商 SKU 通常仅涉及 1~4 个主要合规要求；
2. **Project-scoped**：完全在单项目生命周期内闭环，无跨项目独立检索诉求；
3. **无独立附件实体**：目前无附件关联需求；
4. **无独立版本演进**：无需像 `SupplierQuote` 一样维护独立 Append-only 历史实体；
5. **架构一致性**：与 `project.costing.scenarios`、`project.workflow.states` 的内嵌风格保持完全一致。

---

## 5. 认证类型与适用标准审计 (Certification Types & Standards Audit)

### 5.1 认证类型：`CERTIFICATION_TYPE_ENUM = UNRESOLVED / DEFERRED_REFERENCE`
- **源码核查**：全仓没有提供任何固定硬编码的认证类型枚举字典。
- `marketReportRussiaContext.js` 仅提及具体的法规编号（如 `ТР ТС 004/2011`, `ТР ТС 020/2011`），未定义运行时系统 Enum；
- `CandidateDetailDrawer.jsx` 仅渲染字符串 `marketEvidence?.eacStatus`；
- **纠偏铁律**：**严禁在 V1 提案中伪造 `EAC_DECLARATION`, `EAC_CERTIFICATE`, `GOST_R`, `EXEMPTION_LETTER` 等不可变系统 Enum**。
- V1 中认证类型应允许结构化描述或留作文本/待决引用（`DEFERRED_REFERENCE`）。

### 5.2 适用标准：`applicableStandards[] = CURRENT_PROJECT_DECISION_OR_PLAN`
- 若保留 `applicableStandards[]` 数组，必须明确其语义：
  它代表 **当前项目团队判断适用的技术法规清单（Project Decision / Plan）**（如 `['TR CU 004/2011', 'TR CU 020/2011']`）；
- **严禁将其表述为“官方认证通过的法规背书（Official Verified Result）”**。

---

## 6. Stage Gate 门禁契约与语义冲突审计 (Gate Contract Audit)

源码定位：[`ozon-react/src/utils/t6/gateEngine.js:149-153`](file:///d:/ozon/ozon-react/src/utils/t6/gateEngine.js#L149-L153)。

### 6.1 Gate 事实映射全景表 (Gate Fact Mapping Table)

| Stage | Check ID | Label | Current Evaluator | Needed Project Fact | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **COMPLIANCE** | `compliance_pending` | 合规评估完成 | Module fallback (`MODULE_ZH.compliance`) | 项目推进到合规阶段的前置合规条件 | **`SEMANTIC_CONFLICT`** |
| **PRODUCTION** | `compliance_done` | 合规评估完成 | Module fallback (`MODULE_ZH.compliance`) | 合规评估已确认完成的事实状态 | **`NOT_EVALUATED`** |
| **PRODUCTION** | `cert_plan` | 认证计划存在 | Module fallback (`MODULE_ZH.compliance`) | 项目具备明确认证/豁免计划的事实 | **`NOT_EVALUATED`** |

### 6.2 `compliance_pending` 语义冲突裁决
- **现象事实**：
  - Check ID: `compliance_pending`（字面意为待评估 / 评估中）；
  - Label: `'合规评估完成'`；
  - 目标阶段: 进入 `COMPLIANCE`。
- **裁决**：**`COMPLIANCE_PENDING_SEMANTICS = CONFLICTED`**。
  - 进入 `COMPLIANCE` 阶段时项目才刚要开始合规，要求“合规评估完成”在业务阶段上是颠倒的；
  - **铁律约束**：**`07A-4B MUST NOT reinterpret compliance_pending without a dedicated Gate semantic decision`**。
  - 严禁在 4A/4B 中擅自将其重新解释为“只要评估已启动就 PASS”。该冲突必须留待独立的 `07A-4C` Gate 任务审慎决策。

### 6.3 `cert_plan` 严禁由证书结果替代
- **现象事实**：Label 明确声明为 `'认证计划存在'`。
- **数据契约现状**：**`CERT_PLAN_DATA_CONTRACT = MISSING`**。
- **纠偏铁律**：
  - **`Certification Plan ≠ Certificate Result`**；
  - “计划（Plan）”关注的是对认证路径的规划；“结果（Result）”关注的是证书号与有效凭证。
  - **严禁将 `certificateNumber` 填入作为 `cert_plan` PASS 的条件**（否则会导致“拿到了证书才算有计划”的严重逻辑倒置）。

### 6.4 `compliance_done` 保持来源语义
- Label: `'合规评估完成'`，处于 `PRODUCTION` 阶段入口。
- 当前意图是某种完成条件，但具体什么状态算完成（是评估状态为 `ASSESSED`，还是要求所有 Requirement 项清零），需要数据模型先落地支撑。4A 阶段**严禁提前固定 `CERTIFIED || EXEMPT` 规则**。

---

## 7. 外部证据、商品与测试事实的只读引用边界 (Reference Boundaries)

系统内已有其它业务领域的数据事实，在合规域中严格遵循 **只读引用（REFERENCE），禁止复制（NO COPY）**：

1. **Market Intelligence / Snapshot Evidence**：
   - 包含 `eacStatus`、`certificationStatus`、`risks`、`regulationProvenance`；
   - 统一通过 `project.source.creationSnapshotId` 按需读取，**绝对禁止复制为 `project.compliance` 的顶层状态**。
2. **Product Profile Facts**：
   - 包含 `nameZh`、`categoryLeaf`、`brand`、`model`、`material`、物理尺寸与重量；
   - 统一通过 `project.product` 动态读取，**绝对禁止在合规模块内重复保存一份商品物理属性**。
3. **Sample Testing Facts**：
   - 包含 `SampleRecord.testResult`、`arrivedAt`、样品版本；
   - 统一通过 `t6Store.getProjectSamples(projectId)` 读取，样品测试仅证明物理样品合格，**绝对不能将其状态直接覆盖为合规结论**。
4. **Workflow Node States**：
   - `project.workflow.states` 中 `n9` / `n10` 的 `status === 'done'` 仅代表流程操作人员在看板上推进了任务，**绝不代表 `project.compliance` 结构化数据已合规**。

---

## 8. 附件与文件存储边界 (Attachment Boundaries / P6 Gap)

- **当前事实**：**`COMPLIANCE_ATTACHMENT_CURRENT = NONE / UNRESOLVED`**。
  - `t6Store.js` 没有任何基于 `projectId` 的文件/附件持久化实体表。
- **Legacy 文件隔离缺陷**：
  - `ComplianceAssessment.jsx` 仅按原始文件名保存于全局 IndexedDB，`LEGACY_FILE_PROJECT_LINK = NONE`。
  - 历史上传文件无法自动识别归属于哪个项目。
- **4B 实施禁令**：
  - **`07A-4B MUST NOT implement documents[] / attachmentIds[] / certificateFiles[]`**；
  - 附件能力完全留待后续 **P6: Attachment Architecture** 统一解决。

---

## 9. 正式 Compliance Ownership Matrix (合规所有权矩阵)

> **取值约束**：严格限定为 `OWNER`（事实所有者）、`REFERENCE`（只读引用者）、`NOT_OWNER`（无权涉足）、`UNRESOLVED`（未决）。

| Concept (业务概念) | MI Evidence | Creation Snapshot | Product Profile | Project Compliance | Gate Engine |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **EAC applicability (EAC 适用推测)** | **OWNER** | REFERENCE | NOT_OWNER | REFERENCE | NOT_OWNER |
| **Certification requirement (类目认证要求推测)** | **OWNER** | REFERENCE | NOT_OWNER | REFERENCE | NOT_OWNER |
| **Applicable regulation (项目当前适用法规计划)** | REFERENCE | REFERENCE | NOT_OWNER | **OWNER** | REFERENCE |
| **Risk (市场风险标签 / 项目合规风险评级)** | **OWNER** (市场风险) | REFERENCE | NOT_OWNER | **OWNER** (合规风险) | REFERENCE |
| **Product identity (品名/规格/材质事实)** | NOT_OWNER | REFERENCE | **OWNER** | REFERENCE | NOT_OWNER |
| **Sample evidence (样品实测与到样证据)** | NOT_OWNER | NOT_OWNER | NOT_OWNER | REFERENCE | REFERENCE |
| **Certification result (正式证书号/豁免凭据)** | NOT_OWNER | NOT_OWNER | NOT_OWNER | **OWNER** | REFERENCE |
| **Compliance assessment state (合规评估状态)** | NOT_OWNER | NOT_OWNER | NOT_OWNER | **OWNER** | REFERENCE |
| **Certification plan (认证处理计划与路径)** | NOT_OWNER | NOT_OWNER | NOT_OWNER | **OWNER** | REFERENCE |
| **Document / attachment (合规附件存储实体)** | NOT_OWNER | NOT_OWNER | NOT_OWNER | **UNRESOLVED** (P6) | NOT_OWNER |

---

## 10. 纠偏后的 Project Compliance V1 数据模型提案 (PROPOSED — NOT IMPLEMENTED)

根据 Assessment / Plan / Result 三层解耦原则与 `PROFILE_PLUS_REQUIREMENTS` 架构，形成最小提案：

### 10.1 字段分级原则
- **`REQUIRED_CORE`（核心必填）**：支撑基本评估状态流转的最少字段；
- **`OPTIONAL_CORE`（核心选填）**：业务常用但初筛期可能空缺的信息；
- **`DEFERRED`（延期接入）**：涉及复杂外部机构、效期预警与附件的字段，V1 不强制。

### 10.2 结构定义提案

```javascript
// project.compliance Schema 提案 (仅供 07A-4B 参考，本审计任务不实现)
project.compliance = {
  // === Layer A: ASSESSMENT (REQUIRED_CORE) ===
  assessmentStatus: 'NOT_STARTED', // 'NOT_STARTED' | 'IN_ASSESSMENT' | 'COMPLETED'
  assessedAt: null,                // ISO8601 字符串 | null
  assessedBy: '',                  // 用户标识字符串
  riskLevel: 'LOW',                // 'LOW' | 'MEDIUM' | 'HIGH'

  // === Layer B: PLAN & REQUIREMENTS (OPTIONAL_CORE) ===
  applicableStandards: [],         // 计划适用的法规标准代号字符串数组，如 ['TR CU 004/2011']
  certificationPlan: '',           // 认证处理方案说明纯文本（如 "无需办证，走豁免函申报" 或 "需代工厂提供 EAC DoC"）
  requirements: [
    // 最小 Requirement 项，回答三个问题：
    // 1. 是什么事项？ 2. 是否需要处理？ 3. 处于什么状态？
    /*
    {
      id: 'req_1',
      category: 'REGULATION',      // 'REGULATION'(法规) | 'INGREDIENT'(成分) | 'LABELING'(标签) | 'CERTIFICATION'(认证) | 'OTHER'
      title: '低电压安全核验',
      required: true,              // boolean: 是否需要处理
      status: 'PENDING',           // 'PENDING' | 'IN_PROGRESS' | 'DONE'
      notes: ''
    }
    */
  ],

  // === Layer C: RESULT (OPTIONAL_CORE & DEFERRED) ===
  resultType: 'NONE',              // 'NONE' | 'EXEMPTION_CONFIRMED' | 'CERTIFICATE_OBTAINED' | 'REJECTED'
  certificateNumber: '',           // OPTIONAL_CORE: 证书或声明编号
  exemptReason: '',                // OPTIONAL_CORE: 豁免依据条款说明
  validUntil: null,                // DEFERRED: 证书失效日期
  issuingBody: '',                 // DEFERRED: 发证机构名称
  notes: '',                       // 总体审核意见备注
}
```

---

## 11. 历史遗留组件定位裁决 (Legacy ComplianceAssessment Role)

对 `ComplianceAssessment.jsx` 的未来角色做出明确判定：
- **`KEEP_STANDALONE: YES`**：继续保留在 `n9` 节点作为独立全屏辅助工具，不阻断既有用户操作习惯。
- **`REFERENCE_ONLY: YES`**：仅供参考其 checklist 文本和解析函数，不直接引用其内部 state。
- **`CONTEXTUAL_WRAPPER_CANDIDATE: NO`**：其内部无 `projectId`，代码重度绑定全局 IndexedDB，不适合直接封装为 Project Tab。
- **`MIGRATION_SOURCE: YES`**：其 Word/Excel 解析逻辑与核心 4 项清单，未来可作为新组件的功能借鉴。
- **`DEPRECATE_LATER: YES`**：当 Project Compliance 体系与附件架构完整建立后，再进行正式下线与归档。

---

## 12. 固定 C1~C7 架构落差清单 (Fixed GAP Matrix)

```text
C1 — PROJECT COMPLIANCE DATA GAP:
t6Store 仅初始化 compliance: {}，缺失读写 API、校验器与变更留痕。

C2 — LEGACY IDENTITY GAP:
ComplianceAssessment.jsx 缺少 projectId/skuId，数据保存在全局 IndexedDB 与全局 localStorage。

C3 — EVIDENCE VS RESULT GAP:
系统此前存在将 MI 市场推测、法规预筛与工厂配合资质误当做最终 SKU 合规结论的混淆风险。

C4 — REQUIREMENT MODEL GAP:
单一 Profile 无法表达合规审查中的多项异构任务（法规识别、标签、送检、豁免），需要 Profile + Requirements 复合支持。

C5 — DOCUMENT / ATTACHMENT GAP:
T6 域当前零附件持久化支持，Legacy 文件无项目隔离，附件能力整体属于未决架构落差（P6）。

C6 — GATE DATA GAP:
compliance_pending 存在 ID 与 Label 语义冲突；cert_plan 缺失真实数据合同支撑。

C7 — COMPLIANCE AUDIT GAP:
t6Store 的 decisionLog 缺少针对合规变更的专用审计日志类型（如 compliance_update）。
```

---

## 13. 实施决策与阶段拆分 (Implementation Decision: 07A-4B / 07A-4C Split)

### 13.1 实施状态判定
**`07A-4B IMPLEMENTATION STATUS: READY_WITH_LIMITS`**

- **WHY**：
  数据归属主体（`project.compliance`）、三层数据架构（Assessment / Plan / Result）、以及 Product/Snapshot/Sample 隔离边界已经完全明确；但 Gate 引擎的语义冲突必须隔离处理，附件系统尚未就绪。
- **07A-4B MAY IMPLEMENT（允许实施）**：
  1. `complianceProfile.js` 纯函数白名单与校验层；
  2. `t6Store.js` 增加 `updateProjectCompliance` 与 `compliance_update` 决策日志；
  3. `ProjectDetailPage.jsx` 中新增 `ProjectCompliancePanel.jsx` 替换合规占位文案；
  4. 支持基础状态、法规计划、Requirement 列表的人工录入与维护。
- **07A-4B MUST NOT IMPLEMENT（严禁实施）**：
  1. 严禁重定义或擅自接入 `compliance_pending`、`compliance_done`、`cert_plan` 的 Gate PASS 规则；
  2. 严禁开发附件上传与存储系统（`documents[]`）；
  3. 严禁在 Compliance 中复制 Product 物理属性或 Snapshot 市场属性。

### 13.2 后续任务拆分：07A-4B 与 07A-4C
- **`TASK 07A-4B`（合规数据实体与 UI 落地）**：
  聚焦于 `project.compliance` 数据模型、Store 接口、DecisionLog 以及 ProjectDetailPage 的编辑面板。
- **`TASK 07A-4C`（合规门禁契约专项）**：
  在合规数据已有稳定实例的前提下，专门解决 `compliance_pending` 的语义冲突，确立 `compliance_done` 与 `cert_plan` 的真实评估算法。

---

## 14. 法定契约总表 (CONTRACT SUMMARY)

```text
PROJECT COMPLIANCE
Current project.compliance: EMPTY_CONTAINER ({})
Mutation API: NONE
Audit Log: NONE (Planned: compliance_update)
Recommended Data Owner: project.compliance
Requirement Model: PROFILE_PLUS_REQUIREMENTS

LEGACY
Scope: GLOBAL_SINGLETON
Project Identity: NONE (No projectId)
Persistence: IndexedDB (ozon-compliance) + localStorage (compliance-items)
Attachment Identity: GLOBAL_FILE_NAME (No project namespace)
Recommended Role: STANDALONE_TOOL_REFERENCE_ONLY

EVIDENCE
MI Evidence: REFERENCE (Read via creationSnapshotId)
Creation Snapshot Evidence: HISTORICAL_EVIDENCE (Read via creationSnapshotId)
Product Context: REFERENCE (Read via project.product)
Sample Context: REFERENCE (Read via SampleRecord)

CURRENT PROJECT STATE
Assessment Model: PROJECT_COMPLIANCE_CURRENT_STATE (Layer A)
Requirement / Plan Model: APPLICABLE_STANDARDS_AND_REQUIREMENTS (Layer B)
Result Model: CERTIFICATE_OR_EXEMPTION_RESULT (Layer C)

CERTIFICATION
Certification Type Model: UNRESOLVED / DEFERRED_REFERENCE
Certification Plan: EXPLICIT_PLAN_TEXT_OR_REQUIREMENT
Certificate Result: OPTIONAL_CORE (certificateNumber, validUntil)
Exemption Result: OPTIONAL_CORE (exemptReason)

ATTACHMENTS
Current Project Attachment: NONE (P6 Gap)
Legacy Attachment Reuse: FORBIDDEN (No project scope)

GATE
compliance_pending: SEMANTIC_CONFLICT
compliance_done: NOT_EVALUATED (Requires data contract)
cert_plan: NOT_EVALUATED (Data contract missing)
Gate Implementation Now: DEFERRED_TO_07A_4C

BOUNDARIES
Copies MI Evidence: NO
Copies Product Facts: NO
Copies Sample Data: NO
Official Verification API: NONE (Software does not prove legal validity)

NEXT
07A-4B Status: READY_WITH_LIMITS
07A-4B Scope: Project Compliance Store API + Profile/Requirements UI Panel
07A-4C Scope: Compliance Gate Evaluator & Semantic Conflict Resolution
```

---
*TASK 07A-4A-R 语义纠偏修订完毕。本文件为合规域后续开发的唯一权威契约。*
