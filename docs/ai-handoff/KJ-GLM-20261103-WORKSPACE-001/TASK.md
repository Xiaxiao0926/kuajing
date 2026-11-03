# TASK — KJ-GLM-20261103-WORKSPACE-001（IA 步骤7：工作台首页聚合）

> 创建人：GLM-5.3（Lead）· 创建日期：2026-11-03 · 状态：`ready`（待执行者领取）
> 前置任务：KJ-GEMINI-20261022-MARKET-RETENTION-003（accepted_with_known_limitations，见其 REVIEW.md）
> 参考设计：`docs/ia/TARGET_ROUTE_MATRIX.md` §2（`/kuajing/` 工作台 = Workspace 域）与 §10 步骤 7

---

## 1. 目标

把 `ProgressOverview.jsx`（当前仅 4 预设产品 7 阶段进度条，273 行）升级为**工作台首页**：登录首屏即回答「今天我需要处理什么」。聚合四类信息，全部只读展示 + 点击跳转，**不做任何写操作**：

1. **项目卡点**：进行中（ACTIVE）项目的阶段/生命周期 + Gate 概要（复用 `evaluateProjectGate` 只读求值，禁止改 gateEngine）。
2. **候选预警**：候选池中状态为「待调研/待立项」的候选计数 + Top N 高分候选（复用 t6Store 只读 API）。
3. **待办节点**：各项目 workflow 中状态为 `active` 的节点标题聚合（点击跳项目详情）。
4. **全局进度**：保留现有 7 阶段 36 节点进度条（降级为页尾区块，不删除）。

## 2. 允许范围（仅本地实现，禁止部署）

| 文件 | 改动 |
|---|---|
| `ozon-react/src/components/ProgressOverview.jsx` | 重写为聚合工作台（保留原进度条区块） |
| `ozon-react/src/components/workspace/`（可新增 1-2 个子组件） | 卡片/列表展示组件，只编排不计算 |
| `ozon-react/src/utils/t6/t6Store.js` | **只读导出复用**；若确需新增只读选择器函数，须 fail-close 且不改变现有导出行为 |
| `tests/ia-workspace-home.test.mjs`（新建） | 契约测试：四区块存在、数据只读（无 persistSet 调用）、原进度条保留、跳转接线 |
| `package.json` | 仅把新测试接入 `test:t6` 链 |
| `docs/ia/TASK07_WORKSPACE_HOME_*.md` | 实施报告 |
| `docs/ai-handoff/`（本任务目录 + CURRENT_TASK.json） | 交接记录 |

## 3. 禁止事项

1. 禁止修改 `gateEngine.js`、`scoringEngine.js`、`wbEngine.js`、`ozonEngine.js` 及任何计算公式。
2. 禁止在本任务内做任何写操作（工作台只读；立项/推进/保存仍走各自页面）。
3. 禁止改 `Sidebar.jsx` 导航结构与旧节点兼容层（步骤 1/8 已冻结验收）。
4. 禁止引入 React-Router 等新依赖；跳转沿用 `onNodeSelect` / `openProjectDetail` 回调模式。
5. 禁止部署、禁止宣称生产验证（`production_authorized: false`）。

## 4. 验收标准

1. `npm test` 全绿（含新契约测试）；`npm run test:golden`、`npm run test:sync` 零差异。
2. Vite 生产构建通过，工作台为默认路由 `__progress_overview__`，懒加载不受影响。
3. 无项目/无候选/无待办时四区块均显示明确空态（禁止白屏或假数据）。
4. `git diff` 不得触碰计算引擎与业务数据文件。
5. RESULT.md 按 `docs/ai-handoff/README.md` 模板撰写；tests.json 记录真实命令与退出码。

## 5. 回滚

改动集中于 2-4 个前端文件 + 1 测试 + package.json 一行；`git restore` 即可整体回滚，无数据迁移。
