# 执行结果修订报告 (KJ-GEMINI-20260921-004 Revision 001)

> Codex 复核标记（2026-09-21）：本文保留为 Gemini 原始交付，含未采纳的结论，不能直接作为实施合同。以 APPROVED_BASELINE.md 与 REVIEW-REVISION-001.md 的校正事实和限定验收范围为准；尤其不得沿用旧报告路径、核算只读结论或浏览器全通过结论。

- **任务 ID**：`KJ-GEMINI-20260921-004`
- **修订批次**：Revision 001
- **状态**：`review_ready`
- **基线 HEAD**：`de0cecf107e670e1c0d9cf393c50b92ab85afdee`
- **生产授权**：`false`
- **部署状态**：`not_deployed`（严格未部署、未触碰生产网络）
- **公开验证状态**：`not_performed`（纯文档修订与本地日志比对）
- **前置审阅输入**：[`docs/ai-handoff/KJ-GEMINI-20260921-004/REVIEW.md`](file:///D:/ozon/docs/ai-handoff/KJ-GEMINI-20260921-004/REVIEW.md) 及 [`docs/ai-handoff/KJ-GEMINI-20260921-004/FRONTEND_REFACTOR_PLAN.md`](file:///D:/ozon/docs/ai-handoff/KJ-GEMINI-20260921-004/FRONTEND_REFACTOR_PLAN.md)
- **修订任务书**：[`docs/ai-handoff/KJ-GEMINI-20260921-004/REVISION-001.md`](file:///D:/ozon/docs/ai-handoff/KJ-GEMINI-20260921-004/REVISION-001.md)

---

## 1. R1–R6 审阅意见逐项修订对照表

| 编号 | 审阅关注项 (Codex Review) | 修订涉及文件 | 确认事实与校正内容 | 剩余未知与后续门禁 |
| :--- | :--- | :--- | :--- | :--- |
| **R1** | **本地历史包不能当成现网版本**<br>仓库源码、本地历史包、本地构建与线上状态混淆；取消强制升级与补库结论。 | `BASELINE.json`<br>`BACKEND_DATA_MAP.md`<br>`FINDINGS.md` | 1. 严格拆分四层事实边界：仓库主干源码插件为 `0.3.3`；本地 `deploy/` 历史包插件为 `0.2.5`（对应提交 `a0dfa64`）；本地构建构件为 `assets/index-HdMyp8U-.js`；线上生产版本与 MySQL 表结构严格标为 `[未知]`。<br>2. 取消“必须先升级插件和补表”的强制结论，改为上线前只读探查实际 API 能力与兼容性。 | 线上实际 WordPress 插件版本及 MySQL 数据表结构未在现网探查，需后续通过授权只读探查确认。 |
| **R2** | **报告中心链路漏项与离线队列**<br>补齐源文件导入、生成报告 JSON、静态索引与 HTML 报告；纠偏 jspdf 断言；核实离线上传队列源码。 | `FRONTEND_INVENTORY.md`<br>`BACKEND_DATA_MAP.md`<br>`PRESERVATION_MATRIX.md` | 1. 补充 `MarketReportCenter` 真实数据流：命名空间 `market-report-sources`（上传源文件）与 `market-report-json`（生成研报），`reportIndex.js` 静态索引与 `<iframe>` 历史 HTML 渲染。<br>2. **纠偏**：核实 `MarketReportCenter.jsx` **不包含** `jspdf` 或 `html2canvas` 导出调用，不存在导出截断隐患。<br>3. 记录 `serverFiles.js:3-35` 客户端 IndexedDB 离线队列：数据库 `kuajing-server-file-backups`、Store `pending-uploads`、`queuedAt` 排序与 FIFO 自动重试。 | 客户端 IndexedDB 离线队列已获源码确认，真实网络恢复流程标记为 `[源码确认，恢复未实测]`。 |
| **R3** | **核算共享默认值不等于已证实串扰**<br>核对 `!projectContext` 保护代码；区分共享只读默认值与项目保存；未复现假设降级。 | `FRONTEND_INVENTORY.md`<br>`BACKEND_DATA_MAP.md`<br>`PRESERVATION_MATRIX.md`<br>`FINDINGS.md` | 1. 查证 `OzonCalc.jsx:129` 已显式包含 `if (!projectContext) persistSet(SHIPPING_KEY, newData)`，项目模式下并不会无条件写回全局键 `ozon_shipping_data`。<br>2. 查证 `WBCalc.jsx` 费率与偏好作为共享只读默认值，项目测算经 `onSaveScenario` 独立持久化至 `CostScenario` 实体。<br>3. 建立核算工具读写矩阵；将跨项目串扰从 P0 降级为 P1 待运行时合成验证假说。 | 快速切换项目 A/B 场景下的极值边界需在 S1 阶段设计合成用例进行运行时验证。 |
| **R4** | **草稿保护边界纠偏与性能去夸大**<br>澄清 `beforeunload` 不防内部 `setTab`；删除未测量的性能数值并提测量方案。 | `FRONTEND_INVENTORY.md`<br>`FINDINGS.md` | 1. 明确 `ProjectCompliancePanel.jsx:325` 的 `beforeunload` 仅拦截浏览器刷新与关闭，**完全无法拦截** `ProjectDetailPage.jsx:323` 的内部 `setTab` 切换与 Sidebar 导航。<br>2. **彻底删除**“冻结 2~4 秒”、“100 条严重卡顿”、“OOM”等未经采样测量的夸大断言，改为长列表未分页/未窗口化的客观事实描述。<br>3. 提出采用 20/100/500 条合成数据集进行基线测量的方案（按 S3 规划执行）。 | 真实数据规模下的渲染与加载耗时待 S3 测量后获取精确基线。 |
| **R5** | **合同精度、ID规范与授权边界纠偏**<br>修正 500ms 防抖；保留不透明 ID；记录私有目录 fallback；清理越权条款。 | `BACKEND_DATA_MAP.md`<br>`PRESERVATION_MATRIX.md` | 1. 纠正防抖时间：`persist.js:377-382` 实际防抖为 **500ms**（原写 150ms 纠正）。<br>2. 明确主键规范：`t6Store.js:73-76` 支持 `crypto.randomUUID()` 及 `t6-` fallback，保留所有既有不透明 ID，不强制改为严格 UUID v4。<br>3. 明确文件目录：`kuajing-persistence.php:253-257` 存在 `WP_CONTENT_DIR` fallback，非 Apache 环境不能断言绝对物理隔离。<br>4. 明确合规结果层（Layer C）未发布，不作为可用功能录入。<br>5. **清理越权授权**：删除保留矩阵中“允许前端重构新增 schema/API/费率”及“git checkout -- config/”条款；回退仅限于本轮前端代码增量，禁止用旧数据库覆盖生产。 | 线上服务器对 `dirname(ABSPATH)` 的实际写权限与 Web 服务器是否解析 `.htaccess` 属环境配置未知项。 |
| **R6** | **证据等级规范与可复核日志**<br>区分源码确认/本地运行/未知；补齐本地真实测试日志文件；不合并未执行项。 | `tests.json`<br>`BASELINE.json`<br>`evidence/` | 1. 建立五级证据分类并落实到所有审计文件。<br>2. 补齐本地真实测试执行生成的持久化日志至 `docs/ai-handoff/KJ-GEMINI-20260921-004/evidence/`（包含 `npm-test.log`, `web-persistence.log`, `ia-navigation.log`, `ia-candidate.log`, `ia-project.log`, `sha256-hashes.log`）。<br>3. 在 `tests.json` 中独立列出 `static_checks`, `local_verified_checks`, `unexecuted_or_remote_checks`，端到端浏览器测试与远端探测严格标为 `not_run`，杜绝冒称全部通过。 | 生产端真实运行日志与只读探针日志在未获生产授权前不生成、不伪造。 |

---

## 2. 文件改动与备份情况

### 2.1 预先完整备份 (Pre-flight Backup)
修改前已在 `docs/ai-handoff/KJ-GEMINI-20260921-004/evidence/revision-001/` 归档所有 7 份原交付文件副本：
- `BASELINE.json.bak`
- `FRONTEND_INVENTORY.md.bak`
- `BACKEND_DATA_MAP.md.bak`
- `PRESERVATION_MATRIX.md.bak`
- `FINDINGS.md.bak`
- `tests.json.bak`
- `RESULT.md.bak`

### 2.2 本轮修订文件清单
1. [`docs/ai-handoff/KJ-GEMINI-20260921-004/BASELINE.json`](file:///D:/ozon/docs/ai-handoff/KJ-GEMINI-20260921-004/BASELINE.json)：四层版本分离，移除线上落后结论；
2. [`docs/ai-handoff/KJ-GEMINI-20260921-004/FRONTEND_INVENTORY.md`](file:///D:/ozon/docs/ai-handoff/KJ-GEMINI-20260921-004/FRONTEND_INVENTORY.md)：补齐研报中心真实链路，纠正 jspdf 误报，标明 Tab 离页未拦截；
3. [`docs/ai-handoff/KJ-GEMINI-20260921-004/BACKEND_DATA_MAP.md`](file:///D:/ozon/docs/ai-handoff/KJ-GEMINI-20260921-004/BACKEND_DATA_MAP.md)：补齐 500ms 防抖、IndexedDB 离线队列、Ozon/WB 核算隔离读写表、不透明 ID 与私有目录 fallback；
4. [`docs/ai-handoff/KJ-GEMINI-20260921-004/PRESERVATION_MATRIX.md`](file:///D:/ozon/docs/ai-handoff/KJ-GEMINI-20260921-004/PRESERVATION_MATRIX.md)：显式冻结研报双命名空间、离线上传队列、全部历史单品入口（禁止归档只读/删除），删除越权条款；
5. [`docs/ai-handoff/KJ-GEMINI-20260921-004/FINDINGS.md`](file:///D:/ozon/docs/ai-handoff/KJ-GEMINI-20260921-004/FINDINGS.md)：降级串扰假说，校正线上插件状态为未知，删除未测量性能断言，按 S0–S4 渐进对齐；
6. [`docs/ai-handoff/KJ-GEMINI-20260921-004/tests.json`](file:///D:/ozon/docs/ai-handoff/KJ-GEMINI-20260921-004/tests.json)：三分类结构，对应真实本地日志文件，未执行项明确标记；
7. [`docs/ai-handoff/KJ-GEMINI-20260921-004/RESULT-REVISION-001.md`](file:///D:/ozon/docs/ai-handoff/KJ-GEMINI-20260921-004/RESULT-REVISION-001.md)：本修订交付报告；
8. [`docs/ai-handoff/CURRENT_TASK.json`](file:///D:/ozon/docs/ai-handoff/CURRENT_TASK.json)：任务状态更新为 `review_ready`。

---

## 3. 业务代码零变动验证 (Zero Code Changes)

根据物理 SHA256 哈希比对记录（见 [`docs/ai-handoff/KJ-GEMINI-20260921-004/evidence/sha256-hashes.log`](file:///D:/ozon/docs/ai-handoff/KJ-GEMINI-20260921-004/evidence/sha256-hashes.log)），本轮修订执行过程中：
- `ozon-react/src/` 下所有业务组件与工具函数代码：**0 行变动，哈希 100% 一致**；
- `config/` 下所有费率与设置配置文件：**0 行变动，哈希 100% 一致**；
- `wordpress/` 及 `deploy/` 下所有后端插件代码：**0 行变动，哈希 100% 一致**；
- `server.js` 及根目录脚本：**0 行变动，哈希 100% 一致**；
- 测试用例代码：**0 行变动**；
- 本轮改动范围严格封闭在 `docs/ai-handoff/KJ-GEMINI-20260921-004/` 交付文档与 `CURRENT_TASK.json` 指针内。

---

## 4. 验收与状态移交

本轮 Revision 001 修订工作已全部完成，满足 `REVISION-001.md` 中的所有必做要求。
任务状态已置为 `review_ready`，等待 Codex 独立审阅。未创建后续任务，未执行任何部署，未将策划建议直接编码。
