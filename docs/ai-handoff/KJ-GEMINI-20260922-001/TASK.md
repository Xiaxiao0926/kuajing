# 项目详情保存反馈可见性：最小本地修复

Task ID: KJ-GEMINI-20260922-001
执行Gemini，独立验收Codex。ready可领取，不是已经运行。本地限定源码修改已放行；生产访问、部署、数据迁移均未授权。

## 先读与基线

读取AGENTS.md、ARCHITECTURE.md相关组件说明、CURRENT_TASK.json、006/REVIEW-REVISION-002.md、ProjectDetailPage.jsx全文。
核对HEAD与006/BASELINE.json的28文件。HEAD：de0cecf107e670e1c0d9cf393c50b92ab85afdee。
目标ProjectDetailPage.jsx初始SHA256：83adf484de082dba76b053bb3840fbc62cef8985154499473dde34aa99d7ede7。
先保存git status、目标文件完整副本及哈希到本任务evidence，记录阅读结论和拟改范围，再修改。已有dirty改动必须保留；并行改动/基线漂移先报告，不恢复别人代码。

## 唯一目标

父页面已经catch保存失败并refresh(message)，但notice只在overview渲染。将现有notice移到所有项目详情Tab可见的位置，仅显示一份。Ozon/WB失败后应在成本页直接看到原因、原位重试，无须为了看错误切页。

## 范围

- 唯一可改生产源码：ozon-react/src/components/t6/ProjectDetailPage.jsx。
- 可新增tests/ia-project-notice.test.mjs及本任务目录内合成浏览器测试/报告/证据；既有测试只读。
- 沿用既有样式，紧凑、长文本换行，可用role=status和aria-live=polite；不加大型卡片或弹窗。保留原消息内容，不将本机保存描述成服务器同步。
- A切B不得显示A的旧notice；必要时仅调整notice归属/清理，不顺带重构核算上下文生命周期。
- 保存回调、入库载荷、确认复选框、核算器关闭时机、日志语义保持不变。失败不得变成假成功或自动保存。
- 不改引擎、费用/汇率、Store、prefill、存储键/协议、数据结构、产品/合规表单、导航、依赖、生成配置、业务资料、dist及生产。
- 采购成本回退、切页草稿丢失、同实例上下文残留、WB重复key均保留为已知问题，不能顺手修复。

## 验收

1. 真实ProjectDetailPage中分别打开Ozon/WB，成本输入115，勾选确认，注入场景写失败。当前costing页可见错误、输入115保留、确认状态不偷偷取消、核算器不关闭、全部T6实体前后完全相同。
2. 移除故障，不切页直接重试。恰好新增一个当前项目场景，实际载荷成本115；B项目/场景/快照不变；正常关闭核算器且成本页可见成功消息。
3. 概览和其他Tab消息仍可见且不重复；无notice不渲染空通知；连续失败/恢复显示最新消息，不累积旧条目。
4. A有notice时切B，测试同实例与经列表卸载两种边界。不出现A的消息；这里只修通知归属。
5. 390/768/1440视口截图验证长错误不溢出、不遮挡Tab/按钮。键盘可达原保存按钮，辅助技术可感知通知。
6. 保留未确认保存按钮disabled。测试只替换持久化/网络/汇率，不能替换父页真实保存回调，不能用手写Map代替UI动作。

意外pageerror/console error必须失败；既有WB重复key警告精确分类，不能全局忽略。预期异常与注入场景绑定。截图不代替载荷断言。

## 回归与交付

运行专项测试和真实组件浏览器测试；按AGENTS执行npm test、npm run test:golden、npm run test:sync。记录真实退出码/日志；环境失败如实说明，not_run不是通过。不部署、不另行build。
仓库测试存在生成配置前置步骤，先记相关哈希；如产生任务外差异，报告范围异常，不提交、不自行还原或顺手改配置。
保存相对任务开始副本的实际增量diff、开始/结束哈希。28基线中仅目标生产文件可变化；新增测试单列，其他漂移说明。
交付RESULT.md、tests.json、evidence，结束置STATUS与CURRENT_TASK为review_ready，等待Codex。不得自称已部署，不自动领取003。
回滚仅撤销自己的精确增量；遇并行编辑先停止对照，禁止git reset/checkout清理已有工作。所有证据使用合成数据，不访问真实存储/凭据。
