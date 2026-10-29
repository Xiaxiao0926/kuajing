# 核心资产与契约冻结保留清单 (PRESERVATION_MATRIX.md)

> Codex 复核标记（2026-09-21）：本文保留为 Gemini 原始交付，含未采纳的结论，不能直接作为实施合同。以 APPROVED_BASELINE.md 与 REVIEW-REVISION-001.md 的校正事实和限定验收范围为准；尤其不得沿用旧报告路径、核算只读结论或浏览器全通过结论。

> 审计任务：KJ-GEMINI-20260921-004 (Revision 001)  
> 审计时间：2026-09-21  
> 核心原则：**前端重构不得导致数据迁移、语义漂移、计算公式修改或访问断裂。重构仅限于呈现层与交互架构。所有历史入口、报告资产、上传队列与实体结构必须 100% 保持可用，禁止自动归档为只读或删除。**

---

## 1. 核心保留对象矩阵 (Preservation Matrix)

| 类别 | 冻结保留对象 | 代码位置 / 物理标识 | 重构绝对禁止项 (Forbidden) | 允许的呈现层重构范围 (Allowed) | 核验与测试依据 | 失败回退方案 (Rollback) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **访问路径与入口** | WordPress 页面 `/kuajing/`<br>短代码 `[kuajing_dashboard]` | `kuajing-persistence.php:31`<br>`kuajing-persistence.php:245` | 禁止修改 slug，禁止删除短代码，禁止改动 `body.fyzsxnb-kuajing-page` 根样式隔离类名 | 允许在 shortcode 挂载容器内部调整骨架排版与响应式外框 | 浏览器访问 `/kuajing/` 验证 200 响应及 DOM 挂载 | 还原前端打包静态入口引用 |
| **运行配置注入** | `<script id="fyzsxnb-kuajing-config">` | `runtime.js:3-9`<br>`kuajing-persistence.php:550` | 禁止变更 JSON 配置标签 ID，禁止删除 `apiBase`, `assetBase`, `dataBase`, `nonce`, `authorized` 字段 | 仅允许前端防御性读取配置，无权变更服务端配置注入契约 | 验证 `getRuntimeConfig()` 返回完整对象 | 撤销对 `runtime.js` 的改动 |
| **历史入口与导航标识** | 全量历史 Node ID：<br>`__progress_overview__`<br>`__market_intelligence__`<br>`__market_reports__`<br>`__t6_candidates__`<br>`__t6_projects__`<br>`__t6_project_detail__`<br>`__scoring__`<br>`__purity_analysis__`<br>`__fbp_calc__`<br>`n1, n2, n4, n5, n6, n8, n14, n36, n39` | `App.jsx:52-83`<br>`Sidebar.jsx:22-90`<br>`data/roadmap.js` | **绝对禁止重命名已有 Node ID**；**禁止自动归档为只读，禁止删除任何历史入口**；禁止单方面截断旧单品工具功能 | 允许在 UI 上优化视觉分组、折叠层级与导航排版，引入 Hash 作为顶层别名，但必须 100% 向后兼容所有已有 Node ID | `tests/ia-navigation-acceptance.test.mjs` (必须全绿) | 还原 `Sidebar.jsx` 与 `App.jsx` 导航映射 |
| **研报与上传资产** | 1. `market-report-sources` (源文件)<br>2. `market-report-json` (生成研报)<br>3. 静态资产 `data/market_reports/*.json`<br>4. 静态索引 `reportIndex.js`<br>5. 历史 HTML 报告 (`<iframe>`) | `MarketReportCenter.jsx:5-140`<br>`serverFiles.js`<br>`public/data/market_reports/` | **禁止删除或隐藏已有 24 份研报与历史 HTML 路径**；禁止改变服务端两个 namespace 读写逻辑；禁止破坏源文件与报告关联 | 允许优化报告目录检索、筛选交互与阅读排版，不重算或删减已有报告内容 | 验证研报列表加载、源文件导入与 HTML 报告内嵌查看正常 | 还原 `MarketReportCenter.jsx` |
| **离线文件上传队列** | IndexedDB: `kuajing-server-file-backups`<br>ObjectStore: `pending-uploads`<br>排序: `queuedAt` (FIFO) | `serverFiles.js:3-35` | **严禁移除客户端离线上传队列**；严禁清空用户尚未同步成功的排队文件 | 允许在 UI 提供离线排队状态指示器与手动重试触发按钮 | 检查 IndexedDB 表结构及重试逻辑未受影响 | 还原 `serverFiles.js` |
| **持久化 Key 与前缀** | `t6.candidate.`<br>`t6.project.`<br>`t6.snapshot.`<br>`t6.log.`<br>`t6.costScenario.`<br>`t6.supplier.`<br>`t6.supplierQuote.`<br>`t6.sample.`<br>单品键: `ozon_shipping_data`, `wb_calc_settings`, `mi_manual_procurement_quotes` 等 | `t6Store.js:62-71`<br>`persist.js:502-518` | **严禁修改既有 Key 前缀**；严禁将多个独立实体合并为单一巨大 Key；严禁擅自新增未经审批的全局持久化前缀 | 实体内部仅允许扩展可选展示字段；保持原有原子读写粒度 | `tests/ia-project-product-profile.test.mjs`<br>`tests/ia-project-supply-chain-ui.test.mjs` | 回滚前端代码改动 |
| **主键与标识规范** | UUID 与 `t6-` 前缀不透明 ID<br>人类编号 `RU-YYYY-NNN` (业务展示字段)<br>自增版本锁 `revision`<br>报价版本树 `SupplierQuote.version` | `t6Store.js:73-76`<br>`persist.js:155-163`<br>`kuajing-persistence.php:69` | **严禁强制将既有不透明 ID 改为纯 UUID v4**；严禁将人类项目编号作为存储主键；严禁在修改时覆盖历史 Quote 版本；严禁伪造 revision | 允许在列表与详情展示自定义别名和人类编号；支持各种合法不透明 ID 字符串 | `tests/state-safety-contract.test.mjs` | 回滚前端代码改动 |
| **REST API 契约** | `/wp-json/kuajing/v1/state`<br>`/wp-json/kuajing/v1/session`<br>`/wp-json/kuajing/v1/state/backup`<br>`/wp-json/kuajing/v1/state/restore`<br>`/wp-json/kuajing/v1/files/*` | `kuajing-persistence.php:561-642`<br>`persist.js:179-208` | **前端重构无权修改后端 REST API 协议**；严禁修改请求报文格式 `{ entries: { [key]: { value, baseRevision, deviceId } } }`；严禁移除 409 拦截 | 前端严格按照既有协议适配请求与状态码处理 | `tests/web-persistence.test.mjs`<br>`tests/access-session.test.mjs` | 回滚前端代码改动 |
| **计算引擎公式与费率** | WB 运费跳档与赔偿 (`wbEngine.js`)<br>Ozon 佣金与渠道 (`ozonEngine.js`)<br>FBP 边境仓全链路 (`ozonFbpEngine.js`)<br>选品评分模型 (`scoringEngine.js`) | `src/utils/wbEngine.js`<br>`src/utils/ozonEngine.js`<br>`src/utils/ozonFbpEngine.js`<br>`src/utils/scoring/` | **宪法级红线：严禁在前端重构中以任何理由触碰、修改、重写计算公式与数值逻辑！** | 允许优化公式输入面板的 UI 排版、数字右对齐与单位展示，但必须逐位调用既有纯函数 | `npm test`<br>`npm run test:golden` (100% 保持全绿) | 还原 `src/utils/` 下相关 js 引擎 |
| **费率配置单源** | `config/wb_tariffs.json`<br>`config/ozon_channels.json`<br>`config/settings.json`<br>`src/generated/*.js` | `config/`<br>`scripts/sync-config.js` | **严禁在 React 组件中写死费率常数**；严禁在前端重构中修改 config 文件；**严禁执行 git checkout -- config/ 重置配置** | 仅作为只读事实源消费 | `npm run test:sync` (双端对拍零差异) | 撤销前端改动 |
| **全局与项目隔离机制** | 单品运费 `ozon_shipping_data`<br>项目场景 `t6.costScenario.<id>`<br>保护守卫 `!projectContext` | `OzonCalc.jsx:129`<br>`WBCalc.jsx:49-71` | **严禁在项目核算中意外写回全局单品持久化键**；严禁随意切断有意共享的只读费率表与用户偏好 | 允许在项目核算中作为只读模板引用全局偏好，计算结果保存至 `CostScenario` | 合成项目 A/B 切换核算读写隔离测试 | 回滚前端核算组件改动 |
| **Stage Gate 门禁语义** | `gateEngine.js`<br>`PROJECT_STAGES`<br>`cert_plan`, `supplier_quote`, `samples_record` | `gateEngine.js:1-320`<br>`stageModel.js` | 严禁改变 `FAIL (RED)`、`WARN (YELLOW)`、`PASS (GREEN)`、`NOT_EVALUATED` 判定语义；**严禁将未发布的认证结果层 (Layer C) 伪称为已可用功能** | 允许美化门禁卡片 UI 与说明文字，求值过程保持纯函数调用 | `tests/ia-project-supply-gate.test.mjs`<br>`tests/ia-project-compliance-gate.test.mjs` | 还原 `gateEngine.js` |
| **存量缺字段兼容原则** | 历史项目未评估字段兼容 (`undefined != 'UNASSESSED'`) | `complianceProfile.js:33-36`<br>`complianceDraftState.js` | **严禁在数据载入时执行全库隐式补齐**；严禁把 `undefined` 字段自动存为 `UNASSESSED` 破坏历史门禁 | 允许在 UI 展示层对于缺失值显示占位符或提示性文案，但持久化事实保持原貌 | `tests/ia-project-compliance-draft.test.mjs` | 撤销数据适配改动 |
| **安全与认证入口** | 密码哈希校验<br>HMAC-SHA256 签名 Cookie<br>Rate Limiter 10次锁定 | `kuajing-persistence.php:402-414`<br>`kuajing-persistence.php:453-475` | 严禁在前端硬编码或明文传输访问密码；严禁绕过或移除 Rate Limiter | 允许改进登录弹窗的视觉质感与报错文案 | 模拟密码错误 10 次触发 429 测试 | 还原会话交互逻辑 |

---

## 2. 重构技术栈与权限边界约束 (Boundaries & Permissions)

1. **框架与依赖约束**：
   - 维持 `React 18 + Vite` 技术栈，不得迁移至 SSR 框架；
   - 沿用既有基础 UI 组件与 Tailwind Morandi 规范，不新引入庞大商业中后台组件库；
   - 不增加未经批准的外置重型依赖。
2. **权限与授权边界**：
   - 本次前端重构**无权变更后端代码、MySQL 数据表结构或 REST API 协议**；
   - 本次重构**无权修改 `config/*.json` 费率配置文件**；
   - 严禁把“拟议设计”或“未验收规范”（如 003 合规结果层合同）作为已实现功能对待。
3. **回退与容灾原则**：
   - 回退操作**仅限于回退本轮前端代码增量**；
   - **严禁使用旧数据库备份覆盖正在运行的业务数据**，严禁覆盖或删除已有研报、源文件与项目记录。
4. **样式隔离守则**：
   - 所有 CSS 样式必须完全限制在 `.fyzsxnb-workspace` / `body.fyzsxnb-kuajing-page` 命名空间内部，绝对禁止编写全局无限定标签选择器（如全局 `button`, `h1`, `table` 等），严禁污染 WordPress 主题与前台其它页面。
