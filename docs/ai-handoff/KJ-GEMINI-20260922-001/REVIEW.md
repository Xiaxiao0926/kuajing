# 项目详情通知修复：Codex 独立验收

日期：2026-09-22。任务：KJ-GEMINI-20260922-001。
结论：`accepted_with_known_limitations`。限定通知显示与项目归属的本地修复通过；不是整个核算流程或生产验收。

## 复核结果

- 对照执行前 `evidence/ProjectDetailPage.initial.jsx` 检查真实增量，仅四处：通知状态关联 projectId、主容器 min-w-0、通知移到所有 Tab 共用区域、移除原概览内通知。没有修改保存回调、载荷、公式、Store 或预填逻辑。
- HEAD 为 `de0cecf107e670e1c0d9cf393c50b92ab85afdee`。006 基线的 28 个文件中，27 个哈希一致，唯一变化为允许的 ProjectDetailPage.jsx。
- 初始 SHA256：`83adf484de082dba76b053bb3840fbc62cef8985154499473dde34aa99d7ede7`；验收 SHA256：`d2721e6adb795076af9c46e182a7753cadb547b93da033218a31369fa7288daf`。

## 独立执行的验证

复核入口：`run-codex-review.mjs`。原 Gemini 测试和证据保留，扩展的复核副本与原始日志在 `evidence/codex-review/`。

| 检查 | 结果 |
| --- | --- |
| 通知静态契约与辅助函数测试 | exit 0；不是独立的真实 React 生命周期证明 |
| 真实组件合成浏览器 S1-S5 | exit 0；通知六 Tab 可见、无空节点/重复、最新消息覆盖、同实例与卸载重挂的 A/B 归属隔离 |
| Ozon 和 WB 故障与重试 | 各自输入115、确认后故障；错误可见、输入与确认保留、核算器不关闭；失败前后完整合成持久化快照一致；重试各生成一个成本115的场景 |
| B 项目保护 | 两种重试之后 B 项目、创建快照、场景完整对象与初始一致，不只检查场景数量 |
| 响应式与键盘 | 390/768/1440 无页面横向溢出；真实 Tab 操作能到达 Ozon 保存按钮；已检查桌面和手机截图 |
| npm.cmd test | exit 0；以 regression.log 记录的实际套件为准，不称全部仓库测试均执行 |
| npm.cmd run test:golden | exit 0 |
| npm.cmd run test:sync | exit 0 |
| 生成文件完整性 | 测试前后 generated 目录文件哈希一致 |

浏览器 pageerror 0；非预期 console.error 0；已有 WB 下拉列表重复 key 警告20条，保留原始堆栈，不视为修复完成。

## 证据边界与未解决事项

1. 浏览器使用真实 ProjectDetailPage、核算组件、保存回调与合成存储/网络。列表返回使用真实 onBack 触发卸载，但列表为测试占位，不是完整 App 侧栏/路由验收。
2. `role=status`、`aria-live=polite` 属性与键盘检查通过；未使用实际屏幕阅读器，不能保证所有读屏软件都即时播报条件挂载通知。
3. 切 Tab/离页草稿丢失、同实例核算上下文残留、采购成本回退语义、WB 重复 key 仍属独立后续项。本轮不得顺手修复。
4. 001 只解决本地通知，未验证服务器保存确认、并发恢复或现网版本；“通知可见”不能替代业务备份能力。

## 状态与后续

本地验收通过，`production_authorized=false`、`deployment_status=not_deployed`、`public_verification_status=not_performed`。没有提交、推送、迁移或生产操作。
下一步优先冻结未保存核算输入的离页保护合同，再签发小范围实施任务；不能直接开展全站重写。003 不自动重新领取。
回滚仅采用本任务四处增量的逆向修补；先检查并行编辑，不恢复整个文件或清理现有 dirty 工作。
