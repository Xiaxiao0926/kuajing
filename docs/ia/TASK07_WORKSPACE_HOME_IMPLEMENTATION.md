# TASK07 — 工作台首页聚合（IA 步骤7/9）

> 执行人：GLM-5.3（Lead）· 执行日期：2026-11-03 · 状态：`implemented`（待全量测试通过后封存）
> 任务书：`docs/ai-handoff/KJ-GLM-20261103-WORKSPACE-001/TASK.md`

---

## 1. 目标回顾

把 `ProgressOverview.jsx`（原 273 行，仅 4 预设产品 7 阶段进度条）升级为**工作台首页**：登录首屏即回答「今天我需要处理什么」。聚合四类信息，全部只读展示 + 点击跳转，不做任何写操作。

## 2. 实施内容

### 2.1 新增组件 `workspace/WorkspaceHomeCards.jsx`

三个纯展示组件，只编排不计算：

| 组件 | 职责 | 空态 |
|---|---|---|
| `ProjectBlockCard` | ACTIVE 项目卡片：projectCode / name / stage / 进度条 / Gate verdict（绿/黄/红/未评估）/ 首条阻断原因 | "暂无进行中项目" |
| `CandidateAlertCard` | 待调研/待立项计数 + Top 5 高分候选（按 snapshot.scoreResult.totalScore 降序） | "暂无待处理候选" |
| `TodoNodeList` | 各项目 workflow 中 `status=active` 的节点标题聚合 | "暂无进行中节点" |

### 2.2 重写 `ProgressOverview.jsx`

- 新增 `useWorkspaceAggregation()` hook：只读取数（`listProjects` / `listCandidates` / `getSnapshot` / `projectProgress` / `buildWorkflowTemplate`），加工为三区块数据
- Gate 概要：对每个 ACTIVE 项目，取 `PROJECT_STAGES[stageIndex+1]` 作为下一阶段，调用 `evaluateProjectGate(project, nextStage)` 只读求值，提取 `verdict` + `blockingReasons`
- 候选评分：取 `candidate.latestSnapshotId` → `getSnapshot` → `scoreResult.totalScore`，降序取 Top 5
- 待办节点：遍历 ACTIVE 项目的 `workflow.states`，筛 `status=active`，用 workflow 模板的 `nodeId→title` 映射补标题
- **原全局进度保留**：PRODUCTS（4 产品）/ COLOR_MAP / STATUS_DOT / PHASE_ICONS 及 7 阶段进度条完整保留，降级为页尾区块
- 标题从"项目进度总览"改为"工作台"，副标题"今天我需要处理什么"
- 安全取数：persist 环境异常时 try/catch 降级为空数组，杜绝白屏

### 2.3 `App.jsx` 接线

`ProgressOverview` 调用处新增 `openProjectDetail` prop 传入，使项目卡/待办节点点击可跳转项目详情。

### 2.4 契约测试 `tests/ia-workspace-home.test.mjs`

26 项断言（WS-1 ~ WS-10）：
- 组件签名与导出（WS-1/2）
- 四区块标题存在（WS-3）
- 数据只读：源码不含 persistSet、不调用任何 store 写函数（24 个写函数全检）（WS-4）
- 原进度条保留（WS-5）
- 跳转接线（WS-6）
- 空态文本（WS-7）
- App.jsx 传参（WS-8）
- 计算引擎零改动（git diff）（WS-9）
- 无新运行时依赖（WS-10）

已接入 `test:t6` 强制链。

## 3. 禁止事项遵守

1. ✅ 未修改 `gateEngine.js` / `scoringEngine.js` / `wbEngine.js` / `ozonEngine.js` 及任何计算公式
2. ✅ 无任何写操作（工作台只读；立项/推进/保存仍走各自页面）
3. ✅ 未改 `Sidebar.jsx` 导航结构与旧节点兼容层
4. ✅ 未引入新依赖
5. ✅ 未部署（`production_authorized: false`）

## 4. 涉及文件

| 文件 | 类型 | 说明 |
|---|---|---|
| `ozon-react/src/components/ProgressOverview.jsx` | 重写 | 聚合工作台首页 + 保留原进度条 |
| `ozon-react/src/components/workspace/WorkspaceHomeCards.jsx` | 新增 | 三区块纯展示组件 |
| `ozon-react/src/App.jsx` | 1 行 | 传入 openProjectDetail prop |
| `tests/ia-workspace-home.test.mjs` | 新增 | 26 契约断言 |
| `package.json` | 1 行 | 接入 test:t6 链 |
| `docs/ia/TASK07_WORKSPACE_HOME_*.md` | 新增 | 本报告 |

## 5. 回滚

改动集中于 2 个前端文件 + 1 行接线 + 1 测试 + package.json 一行；`git restore` 即可整体回滚，无数据迁移。
