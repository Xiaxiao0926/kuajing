# Codex 独立验收：KJ-GEMINI-20260921-002

日期：2026-09-21。结论：accepted_with_known_limitations。本任务新增事项标题/按钮布局通过，测试由 Codex 补严后通过。未提交、未 push、未部署、未公开验证。

## 实际范围

- 对比 evidence/ProjectCompliancePanel.jsx.pre-002 与现文件，生产改动仅 Requirements 标题容器的 flex-wrap/gap、min-w-0、副标题响应式换行和按钮 shrink-0/whitespace-nowrap。
- 基线副本 SHA256 为 90FF06F35D38D2074609A9D61F3966B2868CF336F52D1193CF0C8C0BF234EE0F；现组件为 8D1A4772569CF59050A6C20C2CE59A2AABC7BC0E564F3DD5BCB390982BFCEC41。
- complianceDraftState.js 与草稿测试分别保持 55D4D405516384B5A712EC8A961DBC751E7B5DEE8711FCA312C30EBF0F919053、CB16BB5149693A938811C130C2920EC362491535577D1D9EDC854BF70DEB3335。
- 仓库大量已有改动不属于本任务验收范围；未清理或还原。
- 全仓 git diff --check 报 t6Store.js:1111 文件末尾多空行；该文件不在本轮写入范围，未顺手修复，不宣称全仓差异检查全绿。

## 发现并修正的测试问题

1. 原布局测试在 finally 写入的顶层 passed 恒为 true，即使断言失败也可能留下成功 JSON。现初始 false，全部检查完成才置 true，异常写 error 并重新抛出。
2. 原编辑态测试查找“编辑”，实际按钮名为“编辑事项”；count 为 0 时整段跳过，却报告编辑态通过。现使用正确名称并强制等待、点击和等待保存按钮。首次强制断言的失败日志保留于 evidence/codex-layout-initial-selector-failure.log。
3. 新增 LAYOUT_EVIDENCE_DIR 输出配置以隔离 Codex 与 Gemini 证据，新增 LAYOUT_TEST_INJECT_FAILURE 故障注入。未改生产交互。

修正前测试源码按读取内容保留于 evidence/layout-test.pre-codex.mjs（文本还原副本，不宣称字节级快照）；测试现 SHA256：E27488D6784D6619C4AC8A62B838C5B91C3EDB2B67F9DD3DACE023D3084C9495。

## 独立复跑

证据入口 evidence/codex-checks.json 与 evidence/codex-*.log：

- layout、draft（含真实浏览器）、compliance、gate、npm test、test:golden、test:sync、生产 build：8 项退出码均为 0。
- layout-fault：注入失败退出码 1，结果 passed=false 且不输出成功宣告，故障检测通过。
- 草稿测试旧的 H 标记 not_run 仅表示该脚本不加载真实 CSS；本轮由 layout 测试及实际截图补验，不把 not_run 当作通过。
- 构建前后 manifest SHA256 完全相同：fcbcf0f24fd9abfd6e91718ff58bb059e3ea9b023eee6f1314b3afc2bef88998。保留 dist，未操作真实业务数据。
- 使用合成数据、内存 Store 和禁止网络的隔离浏览器。

## 视觉结论

已实际查看 evidence/codex-layout/ 的 360、390、768、1440 初始截图与 390 冲突、新增、真实编辑截图。

- 各初始视口无文档横向溢出；新增事项按钮均为 92x28px，四字同一行，桌面保持正常。
- 390px 冲突提示、新增表单可以显示；真实编辑态已进入，表格内部支持横向滚动。
- 通过范围是本次标题/按钮收尾，不是全站美学验收。窄屏表格原有列宽仍挤压类别、风险、状态文字，编辑行操作需横向滚动；这属于后续可读性任务，不能报告“全页面移动体验已完美”。
- 测试未覆盖完整 WordPress 外壳、真实同步/备份、公开部署，也不是各宽度与全部状态的笛卡尔积覆盖。

## 裁决与回滚

本任务结束，不要求 Gemini 重做布局。旧任务草稿冲突提示并非并发写入锁等限制仍有效。
生产布局回滚仅撤回本轮局部 className 差异；测试回滚参考 pre-codex 文本与本轮差异，若文件已有后续修改不得整文件覆盖。
下一任务 KJ-GEMINI-20260921-003 仅修订认证适用性合同。移动表格改善登记 BACKLOG.md，未授权顺手开发。
