# Revision 001 独立验收

日期：2026-09-21。结论：**REVISION_REQUIRED**，未部署。

## 已通过

独立运行当前 `tests/ia-project-compliance-draft.test.mjs`，退出码 0，真实组件 A/B/C/F/G 原有场景通过。
另运行 Codex 隔离 React/Chrome 验收脚本，内存 Store、禁止网络：

- A/B：分区保存互不覆盖，通过。
- F：A -> B 草稿隔离与保存 B，通过。原跨项目串写缺陷关闭。
- G：同 ID 外部 Store 更新 + 父级 render，干净区块刷新与 dirty 冲突提示，通过。原 memo 陈旧数据缺陷关闭。

## R4 / P1：冲突隐藏后仍能覆盖外部更新

位置：`ProjectCompliancePanel.jsx:235` 起。

第一次检测到外部变更时更新了 `lastExternalRef`。之后若外部没有再次变化，逻辑仅在已有 conflict 为 true 时尝试清除，不再处理草稿基准与最新外部数据的协调。

真实组件证据 G2：

1. 初始 notes 为空；本地编辑为 LOCAL DRAFT。
2. 外部更新为 EXTERNAL UPDATE，触发父级 render，正确显示冲突。
3. 用户将本地 notes 改回旧基准空字符串。
4. 表单仍为空、冲突提示消失；点击保存后外部 EXTERNAL UPDATE 被空字符串覆盖。

真实组件证据 G3：

1. 有冲突后，把草稿手工改成外部值 REMOTE，冲突消失但 dirty 仍为 true，基准没有接受新值。
2. 再编辑为 LOCAL AGAIN，冲突不再出现。

应选择一致策略：草稿回到旧基准时刷新到最新外部值或保留明确冲突；草稿等于最新外部值时接受新基准，或继续依据旧基准完整重算冲突。不能仅更新警告布尔值。

## R5 / P1：运行时测试会吞掉失败

位置：`tests/ia-project-compliance-draft.test.mjs:735`。

外层 catch 包住浏览器加载、组件打包、页面交互和全部断言。AssertionError、页面错误、超时等也被打印为“环境不可用或受限，跳过”，然后仍输出 ALL ... PASSED 并以 0 退出。

必须把可选环境预检与真正执行测试分开；进入测试后的错误必须以非零退出。环境缺失只能明确 SKIP/not_run，不能全绿。本次没有用篡改生产文件的方式触发故障注入，该发现来自明确的异常控制流。

## R6 / P2：测试写死本机目录

测试第 558 行增加了 `C:\\Users\\Administrator\\...` 回退路径，违反仓库可移植路径约定。运行依赖使用项目解析或 CODEX_NODE_MODULES；本机路径只能放本地运行说明，不固化进测试代码。

## 验收范围与证据

- `evidence/codex-revision-001-review.mjs` 与同名 `.json`：A/B/F/G passed，G2/G3 failed，退出码 1。
- 保留第一次验收的脚本、JSON和 Gemini 初次/返工报告，没有覆盖历史。
- 使用未加载 CSS 的隔离真实组件验证行为，不承担移动端布局验收。H 仍为 not_run。
- 发现上述数据覆盖问题后未重复全量引擎/Golden/Sync/Build；Gemini 的分项日志为交付证据，不冒充本轮独立全量复验。
- 未修改生产代码，未提交，未部署。

## 环境范围提醒

附件显示为寻找 Playwright 扫描了整个用户目录，甚至读取 Codex 历史数据库及日志。执行本任务不需要访问其他会话、配置、账号或凭据。后续只用明确提供的依赖路径或报告缺失，不再扩大搜索范围。

按 REVISION-002.md 完成小范围返工，不进入下一功能。
