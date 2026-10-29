# 006：独立核算与项目核算读写隔离验证

执行者Gemini，Codex复核。仅本地合成数据与测试，禁止修改生产代码/配置/持久化语义。本任务不是修复或部署授权。

## 为什么先做

004发现Ozon多品与WB共享键仍有写入；不能把单品守卫当作整个计算器隔离证明。前端继续重构前，先分清有意共享的设置和意外覆盖，保护现有数据及结构。不要为了得出通过结论而改保存逻辑。

## 入口和基线

读取AGENTS.md、ARCHITECTURE.md、004/APPROVED_BASELINE.md、004/FRONTEND_REFACTOR_PLAN.md、005/REVIEW.md。
唯一入口CURRENT_TASK.json。ready且claimed_by为空才领取running。核对BASELINE.json当前HEAD和目标哈希，漂移先报告，不覆盖别的执行者。
保存开始git status、目标哈希和测试新增文件清单。本任务不跑会生成业务文件的build/config同步，不清理dirty目录。

## 允许范围

只可在本任务目录创建测试脚本、合成fixture、证据及报告；更新CURRENT_TASK.json和本任务STATUS的领取/结果状态。
生产源码、既有测试、config、generated、manifest、dist、报告索引、服务器与数据库一律只读。
禁止读取真实localStorage、用户配置目录/会话/凭据/业务表格；使用独立浏览器context、内存存储、合成固定汇率，拦截所有网络请求。不升级依赖，不启动生产服务。

## 要验证的真实组件

- OzonCalc.jsx：SingleTab和MultiTab，不能只验证纯辅助函数。
- WBCalc.jsx及wbcalc/tabs/CalculatorTab.jsx：共享设置、SKU/订单/费率入口，独立与项目上下文。
- 结合ProjectDetailPage现有挂载方式和costScenarioAdapter/onSaveScenario：测试单组件项目ID切换与实际父级卸载重挂两种路径，区分实际可到达UI和仅测试人为构造路径。
- 完整记录shipping-calc-rfbs-v2、product-pricing-v2、wb-settings-v1、wb-tariffs-v1、wb-skus-v1、wb-orders-v1以及T6项目场景的读写。不要改名或迁移。

测试可用esbuild专用插件在打包时注入内存persist适配器和稳定汇率模块，记录每次调用的key、动作、场景、前后合成值；禁止改生产文件加测试开关。明确哪些是真实模块、哪些替身。组件隔离测试不能宣称证明了WordPress/MySQL/跨设备同步。
如现有依赖环境不满足，写blocked/not_run和具体缺失，不扫描整个用户目录或安装新依赖。

## 最少运行矩阵

1. 独立Ozon单品：加载共享预设、改输入、退出重开；核对键名、值和调用次数。
2. 项目A/Ozon单品：A/B用明显不同价格/尺寸/重量；改输入但不保存场景，观察共享键及A/B实体；保存A场景只落A，切B不携带A输入，再回A说明草稿/已存场景分别如何恢复。
3. 项目A进入Ozon多品：观察初始化与编辑/保存定价的共享写入，比较独立多品视图；不要先验判定写全局就是错误。记录用户是否能看出其共享语义。
4. WB独立与项目：分别记录挂载/固定汇率首次生效/汇率一次变化的设置写入，与用户主动编辑分开。
5. 项目WB：编辑计算输入、保存场景、创建SKU、保存订单、进入费率管理，各记录写到哪里、是否可达、是否影响B；保留有意共享费率与SKU的事实，不自行决定要隔离。
6. A到B快速切换、卸载重挂、切工具Tab；未保存输入、保存后输入和共享数据逐项比对。
7. 空存储、缺字段旧预设的加载：不得把原本unknown变成已确认/合规；保存前后保留未知字段语义。
8. 模拟一次persist保存失败与一次onSaveScenario失败：记录提示与输入是否保留。失败抛错须可捕获且不写真实数据；不擅自修复发现的问题。

## 断言和判定

- 每个场景有初始完整快照、实际操作、最终快照、写调用轨迹和UI截图/关键DOM结果，不能只看退出码。
- 状态至少区分：verified_shared_behavior / confirmed_unexpected_write / potential_risk / not_run。
- 业务预期未明的共享行为标needs_decision，不编造为通过或P0缺陷；给出“保留共享并明确界面”与“仅项目输入隔离”的最小选项。
- 应当隔离的场景出现跨项目写入为失败，不因为测试准确复现Bug就写“业务通过”。脚本执行成功与行为验收分开。
- 至少一个故障注入改变合成写入目标/值，证明比较断言能抓住串写；直接assert.fail不是充分证明。
- 没有重跑的既有测试如实列not_run；不把005测试当作006运行证据。

## 交付

- RESULT.md：一页结论、真实缺陷与待裁决共享行为、范围与限制。
- WRITE_MATRIX.md：入口/模式/触发/读取键/写入键/项目归属/是否预期/证据。
- FINDINGS.md：按风险排序，精确源码位置与复现，最多建议两个下一步小修复，不编码。
- tests.json：每项命令退出码、业务结论、替身边界、未运行项。
- evidence/：可重复脚本、纯合成快照、写轨迹、日志、截图、前后哈希。日志不含秘密或真实商品数据。
- 完成更新STATUS与CURRENT_TASK为review_ready，不自动创建下一任务或修改生产代码。

本任务没有生产变更可回滚；不删除他人的文件。若误改源码立即停止并报告，不用git checkout/restore/reset清理；仅在确认没有并行编辑时处理自己精确增量。完成不等于已部署。
