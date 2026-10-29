# 004 校正后的实施基线

Codex，2026-09-21。仅用于渐进前端策划和 005 窄屏样板，不是全站安全或生产验收。原 Gemini 文档作为历史交付保留，冲突内容以本文为准。未列出的原始推断不自动成为冻结事实，实施相应功能前仍需核对源码。

## 版本与证据边界

- 当前 HEAD 为 de0cecf107e670e1c0d9cf393c50b92ab85afdee，工作区不干净，不清理已有改动。
- Codex 本轮重新计算 BASELINE.json 列出的 19 个文件 SHA256，全部一致。这不证明所有 src、config、测试和生成物都没有变化。
- 仓库插件 0.3.3、本地历史部署目录插件 0.2.5 是本地事实；现网插件、表结构、部署提交仍未知。不能因本地包较旧就自动升级现网。
- Gemini 留存的项目测试日志明确跳过组件和布局浏览器测试。进程退出 0 不等于全部检查通过。tests.json 已校正；本轮 Codex 没有重新运行整套测试或浏览器测试。

## 报告中心真实链路

入口为 ozon-react/src/components/reports/MarketReportCenter.jsx。
静态目录来自该组件的 FEATURED_REPORTS，以及 src/generated/marketReports.js、recentMarketReports.js；摘要来自 featuredMarketBriefs.js。不是 src/pages/market-reports/generated/reportIndex.js。
组件内示例路径为 reports/ozon-lighting-deep-analysis/index.html 和 reports/doors-windows-top10/ozon-doors-windows-top10.html，其他路径保留索引中的实际值。不得迁到虚构的 public/data/market_reports/ 目录。
导入支持类型由现有 getMarketImportType 决定；当前上传源文件至 market-report-sources，再上传 JSON 至 market-report-json，文件名为 stableMarketReportId(file.name) + '.json'，sourceBackup 记录服务器返回的源文件名。保留两类文件、命名及关联。
serverFiles.js 中本机待上传队列是保存链路的一部分，不能用“服务器已保存”替代队列状态；断网恢复成功尚未在本轮运行验证。
未发现该组件直接调用 jspdf/html2canvas，只能撤销关于这两个库的具体误报，不能推出所有导出路径绝无截断。完整导出/打印未验收。

## 核算读写矩阵

| 范围 | 实际键与行为 | 边界 |
| --- | --- | --- |
| Ozon SingleTab | shipping-calc-rfbs-v2；读取默认值后叠加项目预填；保存本机输入有 !projectContext 守卫 | 该守卫仅覆盖单品输入，不代表整个 OzonCalc 无共享写入 |
| Ozon MultiTab | product-pricing-v2；初始化 persistGet，savePricing 调用 persistSet | 不是纯 useState，不得标成“不持久化” |
| WB 设置 | wb-settings-v1；挂载和汇率更新可 persistSet，另有 saveSettings | 共享设置不是只读，项目上下文没有覆盖这些写入的通用守卫 |
| WB 费率/SKU/订单 | wb-tariffs-v1、wb-skus-v1、wb-orders-v1；均有对应保存函数 | 项目视图仍保留这些工具入口，不能直接断言全部隔离 |
| 项目测算场景 | 通过 projectContext.onSaveScenario 保存 | 这是单独的场景保存链路，不会证明其他共享键完全不变 |

证据：OzonCalc.jsx:15-16、105-106、129、405-408；WBCalc.jsx:14-17、49、60、68-71、119-123。
共享写路径已静态确认；是否导致用户不期望的 A/B 项目串写，需要合成数据与写调用观测。区分有意共享汇率/费率和项目输入泄漏，不能把所有全局写入一律当 Bug，也不能直接清除风险。

## 保存、状态与保留合同

- beforeunload 不覆盖内部 Tab、侧栏或组件卸载；站内离页保护保持未闭环，不因本轮文档验收而视为完成。
- 冲突提示/备份代码存在不等于并发锁或已完成恢复演练；不得承诺绝不丢失。
- 保留原 URL、Node ID、实体不透明 ID、关联、全部历史可编辑工具、存储键、revision 元数据、报告索引和上传源文件。
- 数据实体、schema、API、费率、计算公式、缺失字段含义均不在本次前端授权范围。允许的派生展示只能是内存视图，不写入新持久化字段。
- 003 认证适用性合同仍待独立验收，尚不授权实现 Layer C 或新增合规字段。
- Node 服务与 PHP 源码说明本地存在能力，不代表其生产部署已核实。

## 当前允许的下一步

仅 005 的 Requirements 窄屏表格展示改进，可独立于上述数据链路调查执行。保存隔离、站内离页、远端能力、备份恢复、003 合同分别保留为后续门禁，不得在 005 顺手实施。没有发布授权。
