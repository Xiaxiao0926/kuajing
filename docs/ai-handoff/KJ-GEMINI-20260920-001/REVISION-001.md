# KJ-GEMINI-20260920-001 / Revision 001

状态以 CURRENT_TASK.json 为准。先读原 TASK.md 与 REVIEW.md。
原任务业务范围、禁止部署/推送/修改公式与数据的约束继续有效。

## 本轮目标

只修复独立验收发现的 R1/R2，并纠正 R3 证据问题；保留 A/B 已通过的分区保存行为。

## 返工起点冻结

- ProjectCompliancePanel.jsx SHA256：`6BAEDEB5A7D4A17D3183713F2170D00A913085388CA8BC789F923712C2988388`
- complianceDraftState.js SHA256：`B90E0DBA11A1681793A0E3B0C76284EC86E7074AFFFFFF59DAEDE3A115697FBA`
- ia-project-compliance-draft.test.mjs SHA256：`55E0808B17741D02CEFF6DE757DC4B72637C4428409BA4603DFD27E8797B6422`

领取前核对，记录执行前状态并备份本轮目标文件至 evidence/revision-001/。不得覆盖原始 .orig 或 Codex 验收证据。

## 必须修复

1. **项目身份切换**：独立保存“草稿所属项目 ID”，不能在 render 阶段先覆盖用于比较的旧 ID。切换项目后重置全部草稿、基准、事项编辑状态和提示；保存动作必须确认草稿所属项目与当前 projectId 一致。不得仅靠父级临时加 key 掩盖组件契约问题。
2. **同项目新数据可见**：父级同 ID 重新 render 时必须能取得更新后的项目；让干净区块刷新，dirty 区块保留输入并提示冲突。注意 getProject 可能每次返回新对象，避免引入无限 render/effect 循环。保持本轮不改 Store/persist/父级的边界；如果一定需要外部事件订阅改造才能完成其他能力，请列为后续项，不新增定时轮询。
3. **冲突状态准确**：冲突消除时提示应能复位，不能只把冲突置 true 而一直不重新求值。载入外部数据应读取最新值，保留独立保存语义。
4. **报告准确**：保留初次 RESULT.md/tests.json，不抹去审计历史；新写 RESULT-REVISION-001.md、tests-revision-001.json。清楚区分 helper、真实组件交互、页面布局与未执行项。

## 允许文件

延续原任务生产代码三个文件范围（组件、helper、专项测试）。允许在 evidence/revision-001/ 新增真实组件测试驱动、合成数据截图和日志，不新增依赖、不修改 package.json。不改 Codex 的 REVIEW.md、codex-runtime-review.mjs/json，也不削弱测试规避失败。

## 必须验收

- 原 TASK.md A~G 保持；至少补真实组件 A/B/C/F/G 测试。
- 同一 React 实例 A -> B：A 有未保存 notes/plan/事项输入，B 显示自己的值；保存 B 后 A/B 都无串写。补 B -> A 与快速切换场景。
- 同 ID 外部 Store 更新 + 父级 render：干净 plan 跟新，dirty notes 保留且提示冲突；重复 render 不死循环、不虚假重复告警。
- 单纯外部变化但没有任何通知/render 的情况不伪称自动收到。
- 真实运行 `evidence/codex-runtime-review.mjs`，F/G 必须从 failed 变为 passed；将本轮运行结果另存 evidence/revision-001/，不要覆盖首次 Codex 证据（可复制脚本到 revision-001/ 并调整 repo-root 解析/输出路径，或临时输出到单独位置，保持测试断言不变）。
- H 必须在加载真实样式的本地页面检查桌面及 390px，记录截图和尺寸。无法执行则标 not_run，不能用静态样式字符串替代；交由 Codex 补验。
- beforeunload 仅如实报告监听与实际测试；不承诺 100% 触发，站内卸载拦截仍按原任务范围列为待办。

## 测试、证据与交接

运行原任务全部必跑命令。每条命令单独保留日志、退出码；测试不应读取线上业务数据。可记录原有警告但不能吞掉新错误。

构建前对可能生成的文件记录原状态/副本；不得用 git restore 把脏文件恢复到 HEAD。没有执行前副本的历史差异只报告，不猜测修复。

结果指针已改为 RESULT-REVISION-001.md、tests-revision-001.json。完成置 review_ready；阻塞置 blocked。下一任务仍需 Codex 独立裁决，不部署。
