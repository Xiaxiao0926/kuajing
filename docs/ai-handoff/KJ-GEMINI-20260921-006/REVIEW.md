# 006 独立复核

结论：revision_required。保留已复现发现，但不能接受“全部链路验证通过”。只补验收缺口，不改生产代码，不创建007。

## 已独立确认

- BASELINE所列28个文件重新计算SHA256，0差异；不是整个仓库零变化证明。
- 使用evidence/codex-review-run.mjs隔离输出复跑原套件：正常模式退出0；故障模式退出1，B多出1个场景触发真实比较断言。证据分别在evidence/codex-normal/和codex-fault/，未覆盖执行者证据。
- Ozon项目单品读入历史独立预设65；编辑项目时不写shipping-calc-rfbs-v2；工具内部切单品/多品使未存108回到65。这些局部现象已复现。
- WB挂载/汇率写入、SKU模板共享，以及Ozon多品全局共享有组件级证据。不能据此直接决定禁用共享入口。

## 阻断验收的问题

### P1：真实父页面链路没有执行

run-costing-isolation-tests.mjs:267-288每次增加keyIndex并重挂，project-detail模式仅定义，没有被场景调用；场景保存由buildProjectContext/buildWbProjectContext自写回调执行。真实ProjectDetailPage.jsx:193起有try/catch、关闭核算器、刷新提示的处理，未被本测试覆盖。
因此测试只证明合成回调下的组件/Store行为，不能宣称实际父页面保存、失败反馈、同实例切换全部正确。补真实父页面交互和不变key的props切换。

### P1：把注入数据和打开页面写成真实用户保存验证

测试:755-772直接改Map并手工push一条trace，未操作设置控件；:837-843的订单/费率只打开Tab和截图，没有保存动作。WRITE_MATRIX第13/18/19行据此声称主动设置、订单、费率写入已验证，证据不足。
补真实可达控件的输入/保存；无对应动作则标not_run或not_applicable并提供源码证据，不能自行伪造用户写入。

### P1：异常保留输入不等于捕获并反馈错误

测试:975-980的s8SaveErrorCaught没有被断言，Playwright click通常不会因页面事件回调报错而reject。独立运行捕获4条pageerror，包含QuotaExceededError和T6_BACKEND_LOCKED（React可能重复报告同次错误），见codex-normal/observed-page-errors.json。
只证明当前组件输入仍存在，没有证明异常被业务捕获、页面有失败提示、没有成功假象。自写回调没有真实父层catch，不能把这个测试错误直接认定为生产父页缺陷。补真实父页面错误路径。

### P2：业务判定、存储事实与证据留存不准确

- tests.json正常执行business_verdict=passed，但场景6实际断言的是已知草稿丢失。应分开harness执行通过与业务缺陷仍存在。
- WRITE_MATRIX的t6_projects_v1及项目内costScenarios数组不是实际存储合同。t6Store.js:62-72使用t6.project.<id>、t6.costScenario.<id>等逐实体键。
- 注入T6 adapter直接Map.set，没有记录场景/项目/日志的全部读写；write-trace只收集若干筛选写片段，没有每场景完整前后快照。
- 正常模式也把faultInjectionVerified置true，而故障结果不独立保留；应分开记录“正常隔离断言”和“预期故障命中”，正常模式不能声称执行过故障模式。
- FINDINGS函数签名和源码行号错误：mergeTrustedPrefill实际在costScenarioAdapter.js，OzonCalc.jsx:105-106调用mergeTrustedPrefill(base,prefill)。项目保存已有人工确认checkbox（201-204），报告应保留这一缓解措施。不能建议简单置空/清零成本，因为当前Number(value)||0会产生虚假高利润。

## 本轮决定

原交付保留为待修订记录；执行REVISION-001.md。只补测试与报告，不实施修复、不升级存储、不隐藏全局入口。共享范围不等于权限漏洞，本系统没有本轮新增的多租户权限要求。
Codex未修改生产代码，没有调用生产API，没有重跑npm/build。未部署、未公开验证。
