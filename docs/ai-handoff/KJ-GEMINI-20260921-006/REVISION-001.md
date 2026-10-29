# 006 Revision 001：补齐真实交互与证据边界

只修006目录内测试/报告，禁止修改任何生产源码或既有测试。沿用原TASK边界和28文件BASELINE。先读REVIEW.md，不重做已验证的简单场景，不创建007。

## R1 实际父页面和同实例路径

- 用真实ProjectDetailPage打开成本Tab和Ozon/WB核算器，实际点击保存并核对场景目标、当前项目、核算器关闭/提示行为。不要替换其saveOzonScenario/saveWbScenario。
- 保留现有卸载重挂测试，另加不强制换key的A/B props切换；清楚标明哪种符合真实父级挂载，不把人为重挂当作全部快速切换证据。
- 用纯内存adapter/稳定汇率隔离外部依赖，禁止接生产。可在测试adapter按键/值注入错误，但不替换被验收的父页保存逻辑。

## R2 真实WB操作

- 删除“手动Map.set+手写trace等价于UI保存”的结论，改为真实设置控件交互。
- 订单/费率从界面输入或导入纯合成数据并执行其实际保存动作，观测目标键与B项目快照。若某动作不存在，写not_applicable并说明，不增加业务功能来满足测试。
- 初始化fixture可以直接写Map，但必须标seed，与observed application writes分开；trace只能来自被观测调用，不手填通过记录。

## R3 保存失败与错误提示

- 注册pageerror与console error监听；针对预期错误记录来源，意外错误导致该场景失败。
- 独立persist失败和真实父页场景保存失败分别检查：输入保留、目标实体/场景不变、可见错误提示、无虚假成功提示、恢复后可重试。
- 记录“不处理异常但输入没丢”的实际结果，不把click正常返回当作业务catch成功；若发现真实缺陷只报告，不修源码。
- 保留已有采购假设人工确认，分别测试确认前和确认后。不要把未核定成本写成0或伪造已核定。

## R4 数据证据和报告校正

- 每个关键场景保存完整合成存储before/after，以及get/set/remove轨迹。T6 adapter的所有读写也进入统一观测，保留t6.project.<id>/t6.costScenario.<id>/t6.log.<id>实际键，不编造聚合键。
- 结果区分execution_status、assertions_status、business_verdict。现有缺陷被准确复现可使测试流程成功，但business_verdict须为issues_found，而不是passed。
- 正常与故障运行输出分目录，保留各退出码和结果；fault_injection_caught仅在真的运行且命中预期B场景断言时成立，其他脚本错误不算成功。
- 校正RESULT/FINDINGS/WRITE_MATRIX/tests.json中的绝对表述、源码行号、共享权限判断。将未执行路径如实not_run。
- 报告“继承历史采购假设且来源不明显”；同时记录保存前已有人工确认。下一步建议不得简单用空值/零值覆盖缺项，不得自动把未知变确认；多品/WB共享入口继续保留，具体修复待Codex裁决。

## 执行与提交

先保留本轮开始脚本与报告副本，尤其不要覆盖evidence/codex-normal/、codex-fault/及Codex脚本。
补充脚本可拆小文件放本任务目录；运行环境路径从CODEX_NODE_MODULES传入，不写死用户绝对目录。
结束前重新校验28文件，无源码漂移；不build、不同步生成配置、不git checkout/restore清理。提交RESULT-REVISION-001.md、更新后的矩阵/发现/tests和证据索引。
全部证据齐全才将CURRENT_TASK和STATUS置review_ready；缺环境/控件不可达如实说明。不能以业务存在Bug为由修改源码。当前无生产或部署授权。
