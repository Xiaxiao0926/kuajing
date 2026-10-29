# KUAIJING-IA-REFACTOR-V1 · TASK 07A-4C2
# Project Compliance Stage Gate Partial Integration 实施与契约报告

> **状态**：已实施完成 (IMPLEMENTED)  
> **实施范围**：只接入 `compliance_pending` 与 `compliance_done` 两个具备明确数据事实合同的 Gate，`cert_plan` 保持 `NOT_EVALUATED`。  
> **架构纯度**：`gateEngine.js` 纯函数保持零 Store/外部依赖；事实由 `ProjectDetailPage.jsx` 从 `project.compliance` 解析并通过 `availableModules.compliance` 显式注入。

---

## 1. Entry Gate Semantics (门禁准入执行时机固定)

根据 `gateEngine.js:evaluateProjectGate`：
- 阶段路径计算公式：`path = PROJECT_STAGES.slice(fromIdx + 1, toIdx + 1)`，区间为 `(fromIdx, toIdx]`。
- **Entry Gate 事实**：`CHECKS[stage]` 恒在**推进进入该 stage 时（准入检查）**执行。
- `CHECKS.COMPLIANCE`：进入 `COMPLIANCE` 阶段（`SAMPLING → COMPLIANCE`）执行。
- `CHECKS.PRODUCTION`：进入 `PRODUCTION` 阶段（`COMPLIANCE → PRODUCTION`）执行。

---

## 2. Compliance Fact Injection (调用层事实注入上下文)

在 `ProjectDetailPage.jsx` 中，依据 `complianceProfile.js` 导出的纯辅助函数 `isProjectComplianceEmpty`：
```javascript
const complianceEvaluated = !isProjectComplianceEmpty(project.compliance)
const complianceFact = complianceEvaluated
  ? {
      evaluated: true,
      assessmentStatus: project.compliance?.assessmentStatus,
    }
  : undefined

const gateDeps = {
  availableModules: {
    supplier: {
      evaluated: true,
      supplierCount: projectSuppliers.length,
      quoteCount,
    },
    samples: {
      evaluated: true,
      sampleCount,
    },
    ...(complianceFact ? { compliance: complianceFact } : {}),
  },
  snapshot,
  scenarios,
}
```

### 契约边界：
1. 初始空项目（`compliance: {}`）或仅打开 Panel 生成 local draft 但未保存的项目，`complianceEvaluated === false`，不注入 `availableModules.compliance`，门禁安全回退为 `NOT_EVALUATED`。
2. 只有用户显式点击保存默认 Profile 后，`complianceEvaluated === true`，才正式提供事实对象。
3. 事实对象采用最小上下文原则：**仅传递 `evaluated` 与 `assessmentStatus`**，绝不注入 `requirements`、`riskLevel`、`applicableStandards`、`certificationPlan` 或未成熟的 Result 字段。

---

## 3. `compliance_pending` 门禁契约

- **Check ID**：`compliance_pending`（永久保持）。
- **Label**：`合规评估档案已建立`（由旧有的“合规评估完成”彻底修正，消除与阶段准入的业务倒置冲突）。
- **业务语义**：项目级合规档案是否已建立且处于有效推进状态（Readiness Check）。
- **求值规则**：
  - 若 `availableModules.compliance` 缺失或 `evaluated !== true` → **`NOT_EVALUATED`**（兼容未接入项目）。
  - 若 `evaluated === true` 且 `assessmentStatus` 为合法枚举（`NOT_STARTED` / `IN_ASSESSMENT` / `COMPLETED`）之一 → **`PASS`**。
  - 若 `evaluated === true` 但 `assessmentStatus` 缺失或为非法值 → **`FAIL`**（Fail-close，提示：`'合规评估档案状态无效，请检查项目合规记录'`）。
  - 本 Check 不使用 `WARN`。

---

## 4. `compliance_done` 门禁契约

- **Check ID**：`compliance_done`（永久保持）。
- **Label**：`合规评估已完成`。
- **业务语义**：进入生产阶段前，商品合规评估工作本身是否已完成。
- **求值规则**：
  - 若 `availableModules.compliance` 缺失或 `evaluated !== true` → **`NOT_EVALUATED`**。
  - 若 `evaluated === true` 且 `assessmentStatus === 'COMPLETED'` → **`PASS`**。
  - 若 `evaluated === true` 且 `assessmentStatus === 'NOT_STARTED'` → **`FAIL`**（提示：`'合规评估尚未开始'`）。
  - 若 `evaluated === true` 且 `assessmentStatus === 'IN_ASSESSMENT'` → **`FAIL`**（提示：`'合规评估尚未完成'`）。
  - 若状态损坏/非法 → **`FAIL`**（提示：`'合规评估状态无效'`）。

---

## 5. `cert_plan` 延期说明 (Deferred to Data Patch)

- **Check ID**：`cert_plan`（保持不变）。
- **Label**：`认证计划存在`。
- **实施状态**：**不定义任何 `evaluate` 函数，严格保持 generic module fallback (`NOT_EVALUATED`)**。
- **延期理由**：
  - 在 TASK 07A-4C1 审计中确认存在 `CERTIFICATION_APPLICABILITY_GAP` 与 `CERT_PLAN_AMBIGUITY`；
  - 当前 Schema 无法从空 `requirements` 区分出商品是“普通日用品免认证”还是“尚未评估认证要求”；
  - 任何强行布尔判断都会误伤正常商品。必须等待后续补齐显式 `certificationApplicability`（如 `REQUIRED / EXEMPT / NOT_APPLICABLE`）字段后再安全实现。

---

## 6. `NOT_EVALUATED` 兼容性与聚合机制

- **向后兼容**：调用 `evaluateProjectGate(project, targetStage)` 未传合规事实时，所有 compliance checks 均返回 `NOT_EVALUATED`，绝不会让既有项目或旧测试意外失败。
- **聚合规则**：
  - 当项目推进到 `PRODUCTION` 且 `assessmentStatus === 'COMPLETED'` 时：
    - `compliance_done` 返回 `PASS`；
    - `cert_plan` 返回 `NOT_EVALUATED`；
    - 根据 Gate 优先级规则（`RED > YELLOW > NOT_EVALUATED > GREEN`），整体阶段门禁 verdict 为 **`NOT_EVALUATED`**（**绝非 `GREEN`**）。
  - **推进语义**：在 `stageTransition.js` 中，`NOT_EVALUATED` 与 `GREEN` 一样均允许正常推进（无需填写强制 override 理由）。因此业务流程畅通，同时逻辑上准确反映部分依赖项尚未完全接入。

---

## 7. 领域边界铁律 (Decoupling Invariants)

1. **`Assessment Complete ≠ Requirements Done`**：
   - `compliance_done` 只看 `assessmentStatus === 'COMPLETED'`；
   - 严禁引入 `requirements.every(r => r.status === 'DONE')` 作为通过条件；
   - 评估完成代表法规政策与技术要求已辨识明确；具体标签印刷、出厂检验等事项允许伴随生产继续执行。
2. **`Risk Level` 不参与 Gate**：`riskLevel` 为团队内部标签，`riskLevel === 'HIGH'` 只要评估完成依然 PASS。
3. **`Applicable Standards` 与 `Certification Plan` 不参与本轮 Gate**：列表或文本为空不阻断 `compliance_done`。
4. **零 Result 依赖**：严禁在此阶段读取或引入 `certificateNumber`、`resultType` 等法定证书实体。

---

## 8. 跨阶段推进路径行为 (Cross-stage Behavior)

- **场景**：项目从 `SAMPLING`（阶段 3）直接推进到 `PRODUCTION`（阶段 5）：
  - 路径聚合：`path = ['COMPLIANCE', 'PRODUCTION']`；
  - 检查项聚合：`samples_record` + `compliance_pending` + `compliance_done` + `cert_plan`。
- **推演**：
  - 当 `assessmentStatus === 'COMPLETED'` 且样品已就绪时：
    - `samples_record`: PASS
    - `compliance_pending`: PASS
    - `compliance_done`: PASS
    - `cert_plan`: NOT_EVALUATED
    - **总 verdict**: **`NOT_EVALUATED`**（允许推进）。
  - 当 `assessmentStatus === 'IN_ASSESSMENT'` 时：
    - `compliance_pending`: PASS
    - `compliance_done`: FAIL（'合规评估尚未完成'）
    - **总 verdict**: **`RED`**（精准阻断进入生产）。

---

## 9. 调用层 Preview 与 Transition 绝对一致性

在 `ProjectDetailPage.jsx` 中：
- 实时预览：`gate = evaluateProjectGate(project, targetStage, gateDeps)`
- 用户推进：`transitionProjectStage({ projectId: project.id, targetStage, deps: gateDeps, reason })`
- 两者共享完全相同的 `gateDeps` 对象，绝无“预览通过但推进遗漏”或反向分歧。
- 用户在 `ProjectCompliancePanel` 修改并保存合规档案后，回调 `onChanged` 触发 `refresh`，状态立即在详情页与 Gate 预览中生效，无需浏览器重载。

---

## 10. 自动化测试基准 (Test Baseline)

- 新增专项目测试：[`tests/ia-project-compliance-gate.test.mjs`](file:///d:/ozon/tests/ia-project-compliance-gate.test.mjs)，包含 **49 项断言测试** 全部通过。
- 全量回归测试：
  - `tests/ia-project-compliance-gate.test.mjs`: **49/49 PASS**
  - `tests/ia-project-compliance.test.mjs`: **32/32 PASS**
  - `tests/ia-project-supply-gate.test.mjs`: **24/24 PASS**
  - `tests/ia-project-supply-cost-apply.test.mjs`: **42/42 PASS**
  - `tests/ia-project-product-profile.test.mjs`: **28/28 PASS**
  - `tests/ia-candidate-project-launch.test.mjs`: **12/12 PASS**
  - `tests/ia-dual-snapshot-project-gate.test.mjs`: **18/18 PASS**
  - `npm run test:t6`: **302/302 PASS**（跨 7 套测试组件，全部通过）
  - `npm test`: **65/65 React + 44/44 Python + 56/56 Golden + 29/29 FBP PASS**
  - `npm run test:golden`: **56/56 PASS**
  - `npm run test:sync`: **双端对拍零差异 PASS**
  - `npm run test:web-persistence`: **23/23 PASS**
  - `npm --prefix ozon-react run build`: **生产编译成功（dist 打包零警告/零报错）**

---

## 11. 剩余数据缺口 (Remaining Gap)

- **缺口标识**：`CERTIFICATION_APPLICABILITY_GAP`
- **后续建议**：在未来任务中，为 `project.compliance` 引入显式属性 `certificationApplicability: 'REQUIRED' | 'EXEMPT' | 'NOT_APPLICABLE'`。待此字段补齐后，`cert_plan` 即可安全接入求值，实现真正的全链路 Stage Gate。
