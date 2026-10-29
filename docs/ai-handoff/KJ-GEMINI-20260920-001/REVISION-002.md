# KJ-GEMINI-20260920-001 / Revision 002

先读 TASK.md、REVISION-001.md、REVIEW-REVISION-001.md。只修 R4/R5/R6，禁止新增业务功能或部署。

## 输入冻结

SHA256：

- ProjectCompliancePanel.jsx：`04C90B3C8A542483E7953A07465526B042264B8262643EA1F426286D0406B685`
- complianceDraftState.js：`B90E0DBA11A1681793A0E3B0C76284EC86E7074AFFFFFF59DAEDE3A115697FBA`
- ia-project-compliance-draft.test.mjs：`B393FF662985A0D298FBE598D88A12ADD4DC3A8422488A00A18E25CB27C6B7B1`

修改前核对并备份至 evidence/revision-002/，保留全部旧证据。若不匹配，先说明漂移，不覆盖。

## 最小修复

1. 协调 draft / baseline / incoming：不仅在外部值变化时，也要在草稿变化时推导正确状态。Assessment 与 Plan 使用一致策略。
2. 草稿回到旧 baseline，但 incoming 已变：刷新到 incoming，或保留冲突等待明确选择。不得变成无提示的干净旧值。
3. 草稿等于 incoming：可以接受 incoming 为新 baseline 并清除 dirty；若不接受新基准，之后再次偏离 incoming 必须重新显示冲突。禁止基准保持旧值而永久不告警。
4. 保留已通过的项目身份隔离、独立保存、Requirement CRUD 草稿保护；避免无限 render。
5. 测试环境加载只捕获明确缺失依赖/浏览器的情况，按 not_run 或非零退出报告；组件构建错误、页面异常、AssertionError、交互超时必须非零退出。跳过时不打印全场景通过。
6. 删除测试中硬编码本机路径。依赖通过环境变量或项目已有依赖解析，不安装新包、不扫描用户目录。

## 环境使用

本机已验证：

```powershell
$env:CODEX_NODE_MODULES='C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node tests/ia-project-compliance-draft.test.mjs
```

该路径仅供本机交接，不写入生产源码或通用测试默认值。不存在则报告，不读取 .codex 历史数据库、会话日志、账号配置、环境凭据，不全盘搜索。

## 验收

- 复跑 Codex `evidence/codex-revision-001-review.mjs` 的全部场景；用副本输出至 revision-002/，修改路径解析而非削弱断言，保留旧 JSON。G2/G3 必须通过。
- Assessment 与 Plan 都补以下真实组件场景：旧值回退、匹配外部值后再编辑、外部连续两次变更、重复 render、点击显式载入。
- 测试 runner 用临时副本或专用故障注入验证：故意让浏览器断言失败，子进程必须非零退出且没有 ALL PASSED。不要修改生产组件来制造失败。另验证缺少依赖时确实报告 not_run，而非伪造通过。
- A/B/C/F/G 不能回归。H 完整样式桌面/390px 仍可明确 not_run，交 Codex 补验；本轮不能宣称 UI 最终通过。
- 运行原任务所有必跑命令，逐条保存日志与退出码。严格保留构建前文件状态，不用 git restore 清理脏工作区。

## 范围与交付

仅原组件、原 helper、专项测试及本任务证据目录。不得改 Store、父级路由、persist、认证枚举、公式、数据、依赖和部署。

写 RESULT-REVISION-002.md、tests-revision-002.json；不覆写旧报告。完成指针置 review_ready，Codex 再独立验收。下一任务尚未授权。
