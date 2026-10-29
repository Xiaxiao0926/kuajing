# TASK 07A-4C3B Codex 独立验收

- 审核日期：2026-10-09
- 决定：`accepted_with_known_limitations`
- 基线 HEAD：`de0cecf107e670e1c0d9cf393c50b92ab85afdee`；工作树原有大量未提交及未跟踪文件，本次审核未归并、还原或提交它们。
- 范围：仅验收本地 Certification Applicability 实现；`deployment_status=not_deployed`，`public_verification_status=not_performed`。

## 独立核对

1. `createProject()` 只为新项目写入 `certificationApplicability: 'UNASSESSED'`，不预建 `assessmentStatus`；历史项目无读取时迁移。
2. `buildNextProjectCompliance()` 基于真实 current 合并 patch；仅保存 notes、Plan 或 Requirement 不隐式注入新字段。`NOT_REQUIRED` 与依据可同次校验和保存；校验失败发生在写入前。同值保存不写 Store、不加日志。
3. Store 的 Profile 字段列表已包含两个新字段。Gate 对缺失字段返回 `NOT_EVALUATED`，对显式非法值返回 `FAIL`；`REQUIRED` 要求计划，`NOT_REQUIRED` 要求依据。Gate 仍通过依赖注入取得事实。
4. `ProjectCompliancePanel` 的新增字段参与草稿、冲突和保存逻辑；真实 React 浏览器组件测试覆盖 A→B→A 和外部变更场景。
5. SCORING 与 MARKET_VALIDATION 的 Candidate→Project 及快照回归测试通过。未发现必须阻断下一本地任务的合同冲突。

## 实跑验证

| 命令 | 结果 |
| --- | --- |
| `node tests/ia-certification-applicability.test.mjs` | exit 0；13 场景与 12 行真值表通过 |
| `node tests/ia-project-compliance.test.mjs` | exit 0；32 组通过 |
| `node tests/ia-project-compliance-gate.test.mjs` | exit 0；49 项通过 |
| `node tests/ia-project-compliance-draft.test.mjs`，设置本机 `CODEX_NODE_MODULES` | exit 0；真实 React/Playwright 草稿隔离与冲突测试通过；完整样式响应式场景仍标记 not_run |
| `node tests/ia-candidate-project-launch.test.mjs` | exit 0；20 项及 E2E 通过 |
| `node tests/ia-dual-snapshot-project-gate.test.mjs` | exit 0；19 项通过 |
| `npm test` | exit 0；汇总脚本通过，不把各子套件重复相加为一个总数 |
| `npm run test:golden` | exit 0；76/76 |
| `npm run test:sync` | exit 0；16 个重量边界、2 个版本边界及规则同步，零差异 |
| `npm --prefix ozon-react run build` | exit 0；Vite 构建通过，有大 chunk 与 Browserslist 更新提示 |

## 已知限制与后续门禁

1. 旧项目缺失适用性时，Gate 检查行正确展示“尚未记录，兼容处理，不代表完成”；但 `ProjectDetailPage.jsx` 的总状态徽标仍统一写“依赖模块尚未实现（非通过，非失败）”。这是不准确的概括，后续 UI 小修应改为中性“部分事项未评估”，不能把兼容放行显示成认证已完成。当前详细行可见，故不阻断本地任务流转，但阻断对该文案的最终视觉验收。
2. 浏览器测试为组件 harness；未对完整页面 CSS 在窄屏和桌面做视觉验收。生产部署前须补该验证，不得以本次测试替代。
3. 执行者未按 `docs/ai-handoff/README.md` 在本任务目录提供独立的 `RESULT.md` 与 `tests.json`，而是使用 `docs/ia/TASK07A4C3B_CERTIFICATION_IMPLEMENTATION.md` 汇报。本审核已逐项重跑关键测试；后续任务仍须恢复标准交付格式。本次不得把上述实施报告的历史测试数字当成当前全量统计。

## 流转决定

本地核心实现已验收，4C3B 状态归档为 `accepted_with_known_limitations`。允许随后把 `KJ-GEMINI-20261009-MARKET-001` 设为当前 `ready`；该决定不授权合规功能部署、数据迁移或市场任务自动运行。市场任务必须由 Gemini 在核对当前指针后自行领取。
