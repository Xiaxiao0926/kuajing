# Codex 独立审阅：004 现状审计

2026-09-21，北京时间 14:46 后。结论：revision_required。材料齐全，可用于形成条件式规划，但不能冻结为全部准确的上线基线。
本轮仅审阅和策划，没有改业务代码/数据、没有部署。003 合同仍待独立验收。

## 已核实

- 19 个 BASELINE.json 目标文件的当前 SHA256 全部匹配该清单。这证明当前文件与清单一致，不单独证明 Gemini 执行前后零改动，也未覆盖所有公式文件。
- App.jsx:93/109/305 的 activeNode/activeProjectId 驱动视图，ProjectDetailPage.jsx:323 直接 setTab；可确认当前这些入口不具备深链接与统一站内离页守卫。
- 本地 deploy 插件头为 0.2.5，本地 wordpress 插件头为 0.3.3。前者和 DEPLOYED_COMMIT 只证明本地历史包内容。
- 先前验收的新增事项按钮已修复；窄屏事项表格仍有可读性问题。

## 必须最小修订的事实

### R1 高优先级：本地历史包不能当成现网版本

RESULT/BASELINE/FINDINGS 称生产仍为 0.2.5、缺表、落后 24 次提交，但没有当前远端读取证据；BACKEND_DATA_MAP 又将线上标为 0.3.3，两者矛盾。
将版本分别标为仓库源码、本地历史部署包、本地构建、线上未验证。功能清单的“已部署/未部署”不能仅靠本地文件推断。取消“必须先升级插件和补表”的既定行动，改为上线前验证实际能力与兼容性，不足时再单独申请升级。

### R2 高优先级：报告保存链路漏项

MarketReportCenter.jsx:5/18/47-50/93-100/133/140 使用 generated 静态索引、HTML 报告、服务器导入源文件和生成 JSON，并非只有 public/data/market_reports/*.json。
必须保留 market-report-sources、market-report-json 两个 namespace，稳定报告 ID、历史 HTML 路径、源文件与报告关联、重载读取。该组件不存在报告所述 jspdf/html2canvas 导出调用，不能据此认定导出截断。
serverFiles.js:3-4 的 IndexedDB 库 kuajing-server-file-backups、store pending-uploads、queuedAt 排序与重试有源码；不是已完成现网恢复演练。

### R3 中优先级：核算共享默认值不等于已证实项目串写

OzonCalc.jsx:105-106 读取全局默认值，129 已以 !projectContext 阻止单品更新写回；不能引用该行证明它无条件串写。还需分别调查多品 Tab 与 WB 设置/订单/SKU 回调。
WBCalc.jsx:49/60/68-71 有共享状态写入路径，CalculatorTab 接收项目上下文。需要按模式/操作形成读写矩阵，合成数据复现或明确待验证。共享费率/偏好不应默认全部断开。
风险可优先调查，但不得把未复现假设和线上事故同列 P0。

### R4 中优先级：草稿保护边界及性能夸大

ProjectCompliancePanel.jsx:325 的 beforeunload 不拦截 React 内部 setTab；前次 REVIEW 已明确这一限制。不得称合规面板有完整站内离页拦截。
没有耗时采样、性能 trace 或规模复现，不能写冻结 2–4 秒、100 条卡顿、OOM 等确定结果。无虚拟列表只能证明实现方式，不能证明卡顿。先分页/按需加载测量，不自动引入虚拟化或 Worker。

### R5 中优先级：合同精度与安全回退

- persist.js:377-382 当前防抖为 500ms，不是 150ms。
- t6Store.js:73-76 支持 crypto.randomUUID 以及 t6- 前缀 fallback；保留所有既有不透明 ID，不强制改为 UUID v4。
- PHP:253-257 私有目录存在 WP_CONTENT_DIR fallback；不能仅凭首选位置断言绝对不可 HTTP 访问。
- 认证结果层未开放，不应列作现有可用结果录入功能；004 不得将尚未验收的 003 合同当成已实现字段。
- 保留矩阵中的允许新增 schema/API/费率及 git checkout -- config/ 不适合作为本次纯前端授权。改为另行审批；回退只能回退本轮代码增量，不恢复旧数据库/覆盖现有记录。

### R6 证据等级

tests.json 的 Terminal execution output 不是本地可复核日志。此次 Codex 没有重跑这些完整测试，不能将 Gemini 自报视为独立通过。
可保留执行者声明，但需补已留存日志路径；无日志标缺证据。浏览器 not_run 与 exit 0 不能合并成“全部绿”。不要为补历史日志改源码或伪造输出。

## 下一步

按 REVISION-001.md 精准修订现有审计，不重跑全量调查、不接触生产。
Codex 已写 FRONTEND_REFACTOR_PLAN.md 条件式策划；事实基线未通过前，不放行业务重构。保留旧入口可用、报告与上传资产、Store/API/公式语义不变。
