# KUAIJING-IA-REFACTOR-V1 · TASK 07A-4C3A
# Certification Applicability & cert_plan Contract Audit

## 任务性质与边界

- **性质**：只读审计与数据合同定义（Read-only Audit & Data Contract Specification）。
- **实施授权**：尚未授权代码实施（`implementation_authorized = false`，`production_authorized = false`）。
- **生产代码改动**：严格为 0 行（严禁修改任何生产及测试代码）。

## 核心目标

1. **只读审计 (Read-only Audit)**：
   - 审计既有合规模块中的适用性缺口（未评估 vs 无需认证 vs 漏填计划）。
   - 审计 Store 影响链、数据白名单、草稿管理及门禁事实提取机制。
2. **认证适用性数据合同 (Certification Applicability Data Contract)**：
   - 确立 `certificationApplicability` 显式字段及取值枚举与缺失值边界。
   - 确立 `certificationApplicabilityNotes` 与合法性检查规则。
   - 确立历史数据兼容与无副作用保护（禁止隐式注入或静默修改历史记录）。
3. **`cert_plan` 门禁语义 (cert_plan Gate Semantics)**：
   - 明确准入生产阶段 `cert_plan` 检查项的通过条件、阻断条件与跳过条件。
   - 严密定义 facts 上下文注入接口与评估函数逻辑。

## 唯一业务产物

- `docs/ia/TASK07A4C3A_CERTIFICATION_APPLICABILITY_CONTRACT.md`

## 严禁修改的文件列表

- `ozon-react/src/utils/t6/t6Store.js`
- `ozon-react/src/utils/t6/complianceProfile.js`
- `ozon-react/src/components/t6/ProjectCompliancePanel.jsx`
- `ozon-react/src/utils/t6/gateEngine.js`
- `ozon-react/src/components/t6/ProjectDetailPage.jsx`
- `ozon-react/src/utils/t6/stageTransition.js`
- 任何其它 `ozon-react/src/` 下的生产代码文件
