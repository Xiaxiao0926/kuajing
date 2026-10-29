# KUAIJING-IA-REFACTOR-V1 · TASK 07A-4B
# Project Compliance Assessment & Plan Workspace V1 架构与交付文档

## 1. 业务目标与最终链路 (Objective & End-to-End Pipeline)

本任务将 SKU 项目的 `project.compliance` 从原先的占位空容器 `{}` 升级为正式的 **项目级合规评估与计划工作区 (Project-scoped Compliance Assessment & Plan Workspace V1)**。

严格遵循 `TASK 07A-4A-R` 冻结的架构契约：
- **三层解耦**：将以往混为一谈的合规流程清晰拆分为 **Layer A: 评估层 (Assessment)**、**Layer B: 计划与事项层 (Plan & Requirements)**、**Layer C: 结果层 (Result)**；
- **V1 阶段范围**：
  - 完整交付 Layer A（评估状态、合规风险等级、备忘）；
  - 完整交付 Layer B（适用法规计划、认证方案路径、具体核验事项 CRUD）；
  - 完整对接跨领域只读参考（历史市场快照证据、商品物理档案、打样实测数据）；
  - **明确延期 Layer C**（证书号、官方结论）至后续法定认证结果合同成熟后接入；
  - **明确延期附件能力** 至 P6 Attachment 统一架构；
  - **明确延期 Stage Gate 门禁对接** 至独立的 TASK 07A-4C。

```text
Creation Snapshot (立项快照)
      │
      ├── 历史市场/法规推测 (只读引用，绝不复制为合规结论)
      │
Product Profile (商品档案)
      │
      ├── 中文品名 / 规格 / 材质 / 尺寸 (只读引用，绝不跨域篡改)
      │
Sample Records (打样记录)
      │
      ├── 实物物理/功能实测 (只读引用，不替代法规合规审查)
      │
      ▼
Project Compliance Workspace (V1)
├── Layer A: Assessment (评估状态 + 风险等级 + 审核备忘)
├── Layer B: Plan & Requirements
│     ├── applicableStandards (适用法规计划清单)
│     ├── certificationPlan (认证路径方案说明)
│     └── requirements[] (具体合规核验事项 CRUD)
└── DecisionLog (kind: compliance_update 全程留痕)
```

---

## 2. 三层解耦模型在 V1 的落地 (Three-Layer Architecture)

| 层级 | 业务概念 | 核心字段 | V1 状态 | 职责定义 |
| :--- | :--- | :--- | :---: | :--- |
| **Layer A: Assessment** | 合规评估 | `assessmentStatus`<br>`riskLevel`<br>`notes` | **已交付** | 描述项目当前是否已启动合规审查、审查处于什么阶段、整体合规风险定级及备忘。 |
| **Layer B: Plan & Requirements** | 合规计划与核验清单 | `applicableStandards`<br>`certificationPlan`<br>`requirements[]` | **已交付** | 规划适用的法规标准代号、认证处理路径（办证/豁免/声明），并管理拆解出的具体事项列表。 |
| **Layer C: Result** | 官方证书与法定凭证 | `resultType`<br>`certificateNumber`<br>`exemptReason`<br>`validUntil`<br>`issuingBody` | **明确延期** | 待后续法定凭据合同成熟后通过专用任务引入，V1 严禁伪造枚举或提前录入。 |

---

## 3. 纯函数事实源契约：`complianceProfile.js`

源码位置：[`ozon-react/src/utils/t6/complianceProfile.js`](file:///d:/ozon/ozon-react/src/utils/t6/complianceProfile.js)

### 3.1 设计原则
- **零外部副作用**：严禁引入 Store 读写、`localStorage`、网络请求或 React Hooks；
- **严格字段白名单**：`PROJECT_COMPLIANCE_FIELDS` 严格限定为 6 个字段：
  `['assessmentStatus', 'riskLevel', 'applicableStandards', 'certificationPlan', 'requirements', 'notes']`；
- **Fail-close 防御黑名单**：
  - 拦截 Result 字段（`certificateNumber`, `resultType`, `exemptReason` 等）；
  - 拦截 Attachment 字段（`documents`, `attachments`, `fileIds` 等）；
  - 拦截 Evidence 字段（`eacStatus`, `certificationStatus`, `risks`, `regulationProvenance` 等）；
  - 拦截 Product 字段（`productName`, `nameZh`, `brand`, `model`, `material`, `dims`, `weight` 等）；
  - 拦截 Sample 字段（`sampleStatus`, `testResult`, `sampleId`, `trackNo` 等）；
  - 拦截直接通过 Profile patch 覆盖 `requirements` 数组的操作。

### 3.2 核心枚举与类型
```javascript
export const COMPLIANCE_ASSESSMENT_STATUS = Object.freeze({
  NOT_STARTED: 'NOT_STARTED',   // 未开始
  IN_ASSESSMENT: 'IN_ASSESSMENT', // 评估中
  COMPLETED: 'COMPLETED',       // 已评估
})

export const COMPLIANCE_RISK_LEVELS = Object.freeze(['', 'LOW', 'MEDIUM', 'HIGH'])

export const COMPLIANCE_REQUIREMENT_CATEGORIES = Object.freeze([
  'REGULATION',     // 技术法规
  'INGREDIENT',     // 成分准入
  'LABELING',       // 标签标识
  'RISK',           // 合规风险
  'CERTIFICATION',  // 认证方案
  'OTHER',          // 其他事项
])

export const COMPLIANCE_REQUIREMENT_STATUS = Object.freeze({
  PENDING: 'PENDING',         // 待处理
  IN_PROGRESS: 'IN_PROGRESS', // 处理中
  DONE: 'DONE',               // 已确认（内部核验完成，非官方证书）
})
```

---

## 4. 事项模型：`PROFILE_PLUS_REQUIREMENTS`

事项内嵌于 `project.compliance.requirements` 数组中，单个事项结构严格规范化：
```javascript
{
  id: 'uuid',                                 // 系统生成的唯一主键
  category: 'REGULATION',                     // 6 大分类之一
  name: '低电压指令绝缘核查',                    // 事项名称（必填，自动 trim）
  required: true,                             // 是否强制必选项（布尔值）
  status: 'PENDING',                          // PENDING | IN_PROGRESS | DONE
  risk: 'MEDIUM',                             // '' | LOW | MEDIUM | HIGH
  desc: '需确认代工厂提供俄语警示标签与耐压报告',   // 详细说明/核查依据
  createdAt: '2026-09-20T...',                // 创建时间戳
  updatedAt: '2026-09-20T...',                // 最后更新时间戳
}
```

---

## 5. T6 Store API 与审计留痕契约

源码位置：[`ozon-react/src/utils/t6/t6Store.js`](file:///d:/ozon/ozon-react/src/utils/t6/t6Store.js)

### 5.1 四个专用 Store 方法
1. `updateProjectCompliance(projectId, patch, { by, reason })`:
   - 仅限更新 Profile 级字段（`assessmentStatus`, `riskLevel`, `applicableStandards`, `certificationPlan`, `notes`）；
   - 严禁修改 `requirements`；
   - 严格比较字段差异，无变更时执行 No-op（不写 Store，不追加日志）；
   - 写入 `compliance_update` 决策日志，记录 compact `fromDiff` 与 `toDiff`。
2. `createProjectComplianceRequirement(projectId, input, { by, reason })`:
   - 自动生成 UUID，严格校验输入格式；
   - 追加至 `project.compliance.requirements`；
   - 写入 `compliance_update` 决策日志，记录 `{ from: null, to: compactReq }`。
3. `updateProjectComplianceRequirement(projectId, requirementId, patch, { by, reason })`:
   - 仅允许更新 `['category', 'name', 'required', 'status', 'risk', 'desc']`；
   - 严禁篡改 `id` 与 `createdAt`（Fail-close）；
   - 无变更时执行 No-op；
   - 写入 `compliance_update` 决策日志，记录 compact `fromDiff` 与 `toDiff`。
4. `removeProjectComplianceRequirement(projectId, requirementId, { by, reason })`:
   - 从 `project.compliance.requirements` 移除对应事项；
   - 写入 `compliance_update` 决策日志，记录 `{ from: compactReq, to: null }`。

### 5.2 审计日志契约
- 日志类别：`kind: 'compliance_update'`；
- 在 `ProjectDetailPage.jsx` 的 `LOG_KIND_ZH` 中注册为 `'合规记录更新'`；
- 日志主体：`subjectType: 'project'`, `subjectId: projectId`, `projectId`；
- 日志追加时自动同步计入 `project.decisionLog` 数组并刷新 `project.updatedAt`。

---

## 6. 跨领域只读引用边界 (Read-Only Cross-Domain Boundaries)

| 领域数据源 | 来源字段 | 合规面板展现方式 | 边界铁律 |
| :--- | :--- | :--- | :--- |
| **Creation Snapshot (MI)** | `marketEvidence.eacStatus`<br>`marketEvidence.certificationStatus`<br>`explanations.risks` | 只读参考卡片 | 标记为“历史市场/法规推测”，仅作立项时只读参考，**严禁作为本项目合规法定结论，严禁复制到 `project.compliance`**。 |
| **Product Profile** | `nameZh`, `categoryLeaf`, `brand`, `model`, `material`, `packageDimsCm`, `grossWeightG` | 只读参考卡片 | 标记为“商品档案物理事实”，合规域只读引用，**严禁跨域修改**。 |
| **Sample Records** | `status`, `testResult`, `createdAt` | 只读参考卡片 | 标记为“样品实测事实”，**明确声明样品实测不替代法规合规审查**。 |

---

## 7. 前端工作区组件实现：`ProjectCompliancePanel.jsx`

源码位置：[`ozon-react/src/components/t6/ProjectCompliancePanel.jsx`](file:///d:/ozon/ozon-react/src/components/t6/ProjectCompliancePanel.jsx)

### 7.1 结构与布局
包含 8 个直观视觉分区：
1. **概览看板**：项目编号、当前评估状态徽章、风险等级徽章、4 项统计指标卡（事项总数、已确认数、必选数、适用标准数）；
2. **历史证据只读引用区**：展示快照不可变 ID、市场 EAC 推测、认证要求及立项风险提示；
3. **商品档案物理事实区**：展示品名、类目、规格、材质、尺寸毛重；
4. **打样实测记录参考区**：展示打样进度与实物测试结论；
5. **Layer A: 评估状态与风险表单**：支持评估状态下拉、风险等级下拉、备忘文本框，配备显式“保存评估状态”按钮；
6. **Layer B: 适用标准与计划表单**：支持多行标准文本编辑（保存自动规范化）、认证方案文本框，配备显式“保存合规计划”按钮；
7. **Layer B: 具体事项 CRUD 表单与列表**：支持新增事项内联抽屉、事项表格展示、行内编辑、两步内联删除确认（**严禁 `window.confirm()`**）；
8. **架构落差与未决边界说明**：醒目阐明 Layer C 证书层、P6 附件层与 4C Gate 门禁联动状态。

---

## 8. 回归与验证结果

执行完整的跨端与专项测试套件，确保零回归：
1. **专项合规测试**：`node tests/ia-project-compliance.test.mjs` → **32 个测试组全部通过 (100%)**；
2. **相关 IA 测试**：
   - `node tests/ia-project-product-profile.test.mjs` → 40 项全绿；
   - `node tests/ia-project-supply-cost-apply.test.mjs` → 42 项全绿；
   - `node tests/ia-candidate-project-launch.test.mjs` → 全绿；
   - `node tests/ia-dual-snapshot-project-gate.test.mjs` → 全绿；
3. **T6 主测试**：`npm run test:t6` → 122 项全绿；
4. **全端核心测试**：`npm test` → React 65 项 + Python 44 项全绿；
5. **黄金业务案例**：`npm run test:golden` → 56 项全绿；
6. **双端对拍测试**：`npm run test:sync` → 全绿；
7. **持久化测试**：`npm run test:web-persistence` → 全绿；
8. **前端构建**：`npm --prefix ozon-react run build` → 成功无报错（10s 内打包完成）。
