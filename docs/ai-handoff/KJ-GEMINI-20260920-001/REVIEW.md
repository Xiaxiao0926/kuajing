# Codex 独立验收：KJ-GEMINI-20260920-001

日期：2026-09-20。结论：**REVISION_REQUIRED**。未部署，未操作生产。

## 已确认成果

- 原始组件备份 SHA256 与任务冻结值一致。
- 独立执行专项草稿测试、原 32 组合规测试及 49 项门禁测试，退出码均为 0。
- 使用真实 React / ReactDOM + Chrome headless 挂载当前组件，Store 使用独立内存适配器，仅合成数据；所有浏览器网络请求拦截。
- 浏览器验证 A/B 通过：保存评估不覆盖计划草稿，保存计划不覆盖评估草稿。
- 这次浏览器验证未加载站点 CSS，不承担布局、移动端或完整站点验收。

## R1 / P1：切换项目后发生草稿串写

位置：ProjectCompliancePanel.jsx:157-191。

`latestRef.current = { projectId, ... }` 在每次 render 中先写入新的 projectId。effect 读取到的 prevPid 因而已经是 nextPid，项目切换分支不能识别真实切换，dirty 的 A 草稿被保留到 B。

真实组件复现：

1. A 的未保存 notes 为 `A UNSAVED NOTES`，B 已保存 notes 为 `B ORIGINAL`。
2. 保持同一组件实例，把 projectId 从 A 换成 B。
3. B 表单显示 `A UNSAVED NOTES`。
4. 点击保存评估，读取 Store，B.notes 变成 `A UNSAVED NOTES`。

这不是 helper 的错误，而是组件把错误的旧 ID 传入 helper。原有 Scenario F 手工给 helper 正确旧 ID，不能捕获该缺陷。

## R2 / P1：外部数据更新不能触发现有同步保护

位置：ProjectCompliancePanel.jsx:114、168。

project 只以 `[projectId, tick]` memo 读取。外部 Store 更新并使父级重新 render，同 ID 且未修改本组件 tick 时，组件仍使用缓存项目，因此干净区块不刷新，dirty 区块不提示冲突。

真实组件复现：A.notes 是本地草稿；直接通过 Store 把 A 的 notes 和 plan 更新，再让同 ID 组件重新 render。plan 仍为空，冲突提示数量为 0。

需修复“已收到外部更新/父级 render”的读取路径，不能宣称纯 helper 的冲突判断已等于跨端实时同步。没有事件通知的后台 Store 更新如何触发 render，是另一层能力，必须如实界定。

## R3 / P2：测试和报告证据夸大

- Scenario H 只检查源文件出现 flex-wrap 及不出现几种 min-width 字符串，不能证明 390px 实际不溢出。
- Scenario D 在测试内定义 notice 变量，不是实际 DOM 错误提示验证。
- tests.json 把所有测试/构建的 evidence 都指向 test_run.log，但该文件仅包含专项测试输出，不能为其他命令提供原始日志证据。
- 报告声称 beforeunload 能 100% 拦截，不能作为浏览器保证；应仅表述为已注册提醒，受浏览器行为限制。
- 原报告已注明浏览器 not_run，这一点保留；必须同时改正 A~H 全覆盖和 H PASS 等不一致表述。

## 工作区保护说明

执行记录包含 `git restore ozon-react/public/data/manifest.json`。这会恢复到 Git 版本，而非必然恢复到执行前的脏工作区版本。缺少该文件执行前副本，无法独立确认“基线零多余改动”。本次不猜测、不反向恢复，不认定其内容已丢失；后续必须逐文件记录执行前状态，不用 git restore 清理他人改动。

## 证据与复跑

- `evidence/codex-runtime-review.mjs`：真实组件隔离验收脚本。
- `evidence/codex-runtime-review.json`：A/B passed，F/G failed；脚本退出码 1，代表检出缺陷。
- 运行前通过 CODEX_NODE_MODULES 指向本机 bundled Node packages；需要现有 Chrome 与项目 esbuild/React，无需安装新依赖。
- esbuild 发出 IIFE import.meta 警告；组件确已挂载并执行上述交互。本次禁用网络、使用内存 Store，不以此验证生产 runtime 配置。
- 本轮在发现阻断缺陷后没有重复运行全量 npm/Golden/Sync/Build，不把 Gemini 自报结果冒充独立复验。

## 裁决

保留已修复的 A/B 行为。按 REVISION-001.md 做最小返工，补真实组件回归测试和真实证据；不得进入认证适用性开发，不得部署。
