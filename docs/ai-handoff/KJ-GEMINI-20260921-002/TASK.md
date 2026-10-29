# KJ-GEMINI-20260921-002：合规面板手机布局收尾

执行者 Gemini；Codex 验收。只本地执行，不提交、不 push、不部署。

## 已有成果与目标

上一任务的草稿保护已通过独立行为验收，不重写状态管理。本次只修复真实 390px 截图中 Requirements 标题行挤压“新增事项”按钮，造成逐字竖排的问题。

先阅读 AGENTS.md、ARCHITECTURE.md 的 UI 约定、上一任务 REVIEW-REVISION-002.md，以及上一任务 evidence/codex-final-390.png / codex-final-1440.png。

## 输入冻结

- HEAD：de0cecf107e670e1c0d9cf393c50b92ab85afdee；有大量已有未提交文件，不清理、不恢复。
- ProjectCompliancePanel.jsx SHA256：90FF06F35D38D2074609A9D61F3966B2868CF336F52D1193CF0C8C0BF234EE0F。
- 不改 helper 和草稿专项测试；其哈希应分别保持 55D4D405516384B5A712EC8A961DBC751E7B5DEE8711FCA312C30EBF0F919053、CB16BB5149693A938811C130C2920EC362491535577D1D9EDC854BF70DEB3335。
- 修改前保存目标副本与基线状态至本任务 evidence/。哈希漂移先报告，不覆盖并行工作。

## 允许范围

1. ProjectCompliancePanel.jsx 的 Requirements 标题/按钮所在布局容器与必要的本地 className。
2. 新增 tests/ia-project-compliance-layout.test.mjs，或在本任务 evidence/ 放独立可复跑布局测试。
3. 本任务 RESULT.md、tests.json、evidence/ 及 CURRENT_TASK.json 的领取状态。

不改全局 Button/Surface、不改全局 CSS、Store、helper、Gate、表单处理器、公式、业务数据、依赖或 CI。不要顺手改所有文案和卡片。

## 行为和视觉要求

- 手机标题说明允许换行；按钮应保留稳定可读宽度，必要时整按钮另起一行。“新增事项”四字必须正常横排，不能逐字竖排或缩到不可读。
- 保留 Plus 图标、原有点击行为、添加表单、删除确认。
- 桌面布局不明显退化；没有内容遮挡或横向溢出。
- 在 360px、390px、768px、1440px 下加载真实项目 CSS 测量，并查看截图。
- 检查初始、双区块 dirty+冲突、新增事项展开、长事项名/编辑状态。
- 几何检查除 scrollWidth 外，还要检验按钮标签没有逐字换行；静态查 className 不算视觉验收。

## 验证与资源

可参考上一任务 evidence/codex-final-review.mjs 的项目样式编译与隔离组件构建方式。不要修改旧审计脚本或覆盖旧截图；新证据写本任务目录。

本机浏览器依赖已经确认可用：

```powershell
$env:CODEX_NODE_MODULES='C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node tests/ia-project-compliance-draft.test.mjs
```

该路径只用于本机运行，不写入通用源码默认值。不扫描用户目录、会话记录或数据库。

必须运行：草稿专项测试（含浏览器部分）、合规档案测试、合规门禁测试、npm test、npm run test:golden、npm run test:sync、npm --prefix ozon-react run build。逐条保存退出码与日志。测试进入断言阶段的错误不得跳过。缺环境如实 not_run，交 Codex 补验。

## 数据与输出保护

- 构建前保存可能生成文件的现状，结束后仅恢复本轮生成差异到执行前版本。
- 不使用 git restore 清理已有工作，不删除整个 dist，不递归清理目录；构建产物留存即可。
- 不安装新依赖，不操作生产或真实用户数据；使用合成数据/内存 Store。

## 交付与回滚

RESULT.md 逐条说明布局变更、四个宽度截图与验证、未完成项、是否部署（必须为否）。tests.json 分开标记行为/几何/人工视觉结果。

保留本轮原文件副本和增量差异；回滚只恢复本轮改动，若他人又改同一文件则暂停合并，不覆盖。

完成置 review_ready。通过后下一计划是认证适用性合同修订，当前不授权进入该工作。
