# 后台体系与数据全景映射 (BACKEND_DATA_MAP.md)

> Codex 复核标记（2026-09-21）：本文保留为 Gemini 原始交付，含未采纳的结论，不能直接作为实施合同。以 APPROVED_BASELINE.md 与 REVIEW-REVISION-001.md 的校正事实和限定验收范围为准；尤其不得沿用旧报告路径、核算只读结论或浏览器全通过结论。

> 审计任务：KJ-GEMINI-20260921-004 (Revision 001)  
> 审计时间：2026-09-21  
> 审计基准：代码静态证据与持久化合约比对  
> 证据级别说明：  
> - `[源码确认]`：基于本地仓库代码静态查阅并引证文件名与行号  
> - `[本地运行]`：本地真实执行命令，生成持久化测试日志并记录退出码  
> - `[待合成验证]`：基于逻辑推测或代码静态路径分析，尚未在运行时独立复现  
> - `[未知]`：未执行远端访问、无凭据或环境未连接，严格保持未知

---

## 1. 节点与存储基础设施角色分工

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           1. 代码事实源与公开静态资源                             │
│       GitHub 仓库 (Xiaxiao0926/kuajing) @ main (de0cecf107e670e1c0d9cf393c)     │
│   ├─ 核心算法与 React 组件代码                                                    │
│   ├─ 统一配置唯一事实源: config/*.json (wb_tariffs, settings, ozon_channels)       │
│   ├─ 静态研报资产: public/data/market_reports/*.json 及 generated 静态索引        │
│   └─ 静态市场情报批次: public/data/market_intelligence/runs/                      │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ 编译打包 / 生产部署
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           2. 线上宿主与持久化服务层                              │
│       WordPress 生产服务器 (fyzsxnb.com / PHP 8.x + LiteSpeed Cache)             │
│   ├─ 挂载插件版本: [未知] (仓库源码为 v0.3.3; 本地 deploy 历史包为 v0.2.5 @ a0dfa64)│
│   ├─ 页面短代码: [kuajing_dashboard] on /kuajing/                                │
│   ├─ REST API: /wp-json/kuajing/v1/ (state, session, files, history, backups)    │
│   ├─ MySQL 状态持久化: ${prefix}kuajing_state (原子版本锁、修订历史、冲突快照)      │
│   └─ 私有文件存储: 首选 dirname(ABSPATH)/kuajing-private-data/,                 │
│                   fallback 为 WP_CONTENT_DIR/kuajing-private-data/              │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ credentials: 'same-origin', X-WP-Nonce
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           3. 前端客户端与离线容灾层                              │
│       浏览器运行时 (React 18 SPA)                                                │
│   ├─ 设备标识: localStorage['__kuajing_device_id__'] (UUID 隔离客户端)            │
│   ├─ 本地缓存与版本: localStorage['__kuajing_revision__:<key>']                  │
│   ├─ 脏状态跟踪: localStorage['__kuajing_dirty__:<key>']                         │
│   ├─ 离线兜底: persist.js (防抖 500ms 聚合同步, visibilitychange 自动 flush)     │
│   ├─ 离线文件上传队列: IndexedDB kuajing-server-file-backups (pending-uploads)   │
│   └─ 内存状态/缓存: RUNS_CACHE (Map), t6Store adapter, Zustand/React useState    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.1 各后端技术栈角色与证据边界
1. **WordPress 生产插件 (PHP + MySQL)** `[源码确认 / 现网状态未知]`:
   - 仓库源码证据：[`wordpress/kuajing-persistence/kuajing-persistence.php:13-38`](file:///D:/ozon/wordpress/kuajing-persistence/kuajing-persistence.php#L13-L38)（版本头为 `0.3.3`）。
   - 本地历史包证据：[`deploy/kuajing-persistence/kuajing-persistence.php`](file:///D:/ozon/deploy/kuajing-persistence/kuajing-persistence.php)（版本头为 `0.2.5`，对应 `DEPLOYED_COMMIT` `a0dfa64`）。
   - 现网状态：**[未知]**。未执行针对生产环境 `fyzsxnb.com` 的只读探测，不能仅凭本地历史旧包断定线上滞后或要求补表。上线前需通过授权探测实际 API 能力与兼容性。
   - 职责：生产持久化事实源；协调并发写入、Revision 版本自增校验、冲突数据自动备份、文件私有化鉴权分发。
2. **Node.js 价格分析服务 (Port 8888)** `[源码确认]`:
   - 代码证据：[`server.js:1-120`](file:///D:/ozon/server.js#L1-L120)
   - 角色：桌面端独立价格抓取与离线清洗 API。生产线上未部署此服务。
3. **Python Streamlit 选品与核算面板 (Port 8501/8502)** `[源码确认]`:
   - 代码证据：[`ozon-product-analyzer/app.py`](file:///D:/ozon/ozon-product-analyzer/app.py), [`ozon-product-analyzer/wb_panel.py`](file:///D:/ozon/ozon-product-analyzer/wb_panel.py)
   - 角色：早期/辅助数据分析工具，严格消费 `config/*.json` 作为费率唯一事实源。
4. **Vite 开发服务器中间件** `[源码确认]`:
   - 代码证据：[`ozon-react/vite.config.js:80-264`](file:///D:/ozon/ozon-react/vite.config.js#L80-L264)
   - 角色：本地开发态 Mock API 与文件同步器。

---

## 2. 数据生命周期与同步链路

### 2.1 读取链路 (Read Flow) `[源码确认]`
1. **应用冷启动**：
   - `App.jsx` 挂载时调用 `syncFromServer()` ([`persist.js:520-580`](file:///D:/ozon/ozon-react/src/utils/persist.js#L520-L580))；
   - 若处于 WordPress 环境 (`canUseServerPersistence() === true`)，向 `GET /wp-json/kuajing/v1/state` 发起请求；
   - 获得服务端最新 `state_key`、`state_value`、`revision` 映射表；
   - 将服务端版本与本地 `localStorage` 比对：若本地为 clean 且服务端版本更高，以服务端数据覆盖本地；若本地有 dirty 写入，保持本地并进入待同步队列。
2. **静态资产与分析报告读取**：
   - 市场情报批次数据：由 `miStore.js` 统一调用 `getDataUrl('market_intelligence/runs/...')`，生产环境下动态拼接为 GitHub Raw Content CDN URL ([`runtime.js:27-32`](file:///D:/ozon/ozon-react/src/utils/runtime.js#L27-L32))；
   - 市场报告静态索引与内容：由 `MarketReportCenter.jsx` 读取 `src/pages/market-reports/generated/reportIndex.js` 与 `public/data/market_reports/*.json`；历史 HTML 报告通过 `<iframe>` 嵌入查看；
   - 动态上传与生成报告：通过 `market-report-sources` 与 `market-report-json` 两个 namespace 与服务器通信读取。

### 2.2 编辑与保存链路 (Write / Save Flow) `[源码确认]`
1. **UI 触发保存**（如更新商品档案、新增合规事项、记录供应商报价）：
   - 组件调用业务 Store（如 `t6Store.js` 中的 `updateProjectProduct` 或 `createSupplierQuote`）；
   - 业务 Store 将实体深拷贝后调用 `persistSet(key, value)` ([`persist.js:502-518`](file:///D:/ozon/ozon-react/src/utils/persist.js#L502-L518))；
   - `persistSet` 同步写入 `localStorage[key]`，并打上 `__kuajing_dirty__:<key> = 1` 标记；
   - 加入内存待同步队列 `pending.set(key, entry)`，启动 **500ms 防抖计时器** `flushTimer` ([`persist.js:377-382`](file:///D:/ozon/ozon-react/src/utils/persist.js#L377-L382))；
2. **网络同步 (Flush to Server)**：
   - `flushPending()` 向 `POST /wp-json/kuajing/v1/state` 提交 payload：
     ```json
     {
       "entries": {
         "t6.project.<id>": {
           "value": { ... },
           "baseRevision": 4,
           "deviceId": "device-172691...",
           "updatedAt": 1726910520000
         }
       }
     }
     ```
   - WordPress 插件接收请求后开启 MySQL 事务与 `FOR UPDATE` 行级锁；
   - 检查客户端 `baseRevision`：
     - 若 `baseRevision === server_revision`：版本号自增为 `baseRevision + 1`，写入新值，并记录不可变快照到 `${prefix}kuajing_state_versions` 与审计事件 `${prefix}kuajing_audit_events`；
     - 若 `baseRevision !== server_revision`：抛出 `HTTP 409 Conflict`。

### 2.3 冲突处理与备份链路 (Conflict & Backup) `[源码确认]`
- **代码证据**：[`persist.js:210-227`](file:///D:/ozon/ozon-react/src/utils/persist.js#L210-L227), [`kuajing-persistence.php:676-691`](file:///D:/ozon/wordpress/kuajing-persistence/kuajing-persistence.php#L676-L691)
- 当捕获到 HTTP 409 时：
  1. 客户端立即调用 `backupConflictSnapshot(key, entry)`，向 `POST /wp-json/kuajing/v1/state/backup` 投递当前被拒绝的脏数据快照；
  2. 服务端将其持久化至 `${prefix}kuajing_state_backups`（带有 `snapshot_hash`、`reason: 'revision_conflict'`）；
  3. 客户端标记该 key 处于 `PersistenceState.CONFLICT` 状态，停止盲目重试，通知 UI 弹出冲突解决指示；
  4. 绝不静默覆盖服务端已有更新，保证双端数据不丢失。

### 2.4 恢复链路 (Restore Flow) `[源码确认，现网恢复未实测]`
- **代码证据**：[`kuajing-persistence.php:800-845`](file:///D:/ozon/wordpress/kuajing-persistence/kuajing-persistence.php#L800-L845)
- 支持调用 `POST /wp-json/kuajing/v1/state/restore`，传入历史版本号，服务端将历史版本提取并以最新的 Revision 重新提交，产生 RESTORE 类型审计事件。
- **实测状态标记**：静态实现与测试文件已确认，生产环境尚未发生真实冲突恢复演练。

---

## 3. 报告中心与离线文件上传全景链路 `[源码确认]`

`MarketReportCenter.jsx` 与文件上传模块不仅包含静态报表，还包含完整的报告源文件导入与生成报告备份流：

### 3.1 命名空间与静态资源映射
| 资源类别 | 命名空间 / 路径 | 存储载体 | 稳定标识规范 | 读取与使用方式 |
| :--- | :--- | :--- | :--- | :--- |
| **报告导入源文件** | `market-report-sources` | WordPress 私有文件存储 | 上传原始文件名 / 时间戳 | 供二次重新解析与审计溯源 |
| **生成研报 JSON** | `market-report-json` | WordPress 私有文件存储 | `report-<slug>.json` | 保存与回载用户定制或最新生成的研报结构数据 |
| **静态研报 JSON** | `public/data/market_reports/*.json` | 仓库 Git 静态资产 | 报告英文 Slug (如 `power-strip-report.json`) | 构建打包随 SPA 发布，提供开箱即用研报 |
| **静态研报索引** | `src/pages/market-reports/generated/reportIndex.js` | 代码构建生成物 | 包含 24 份报告的元数据清单 | 报告目录列表渲染与筛选 |
| **历史 HTML 研报** | `public/data/market_reports/*.html` | 静态资源 | 报告 Slug | 通过 `<iframe>` 原生安全沙箱加载查看 |

> **勘误说明**：`MarketReportCenter.jsx` **不使用** `jspdf` 或 `html2canvas` 导出。`jspdf`/`html2canvas` 仅在 `NewDashboard`, `FragrancePricing`, `MarketResearch` 中局部使用。报告中心不存在导出截断问题。

### 3.2 客户端离线上传队列 (Offline Upload Queue)
- **代码证据**：[`ozon-react/src/utils/serverFiles.js:3-35`](file:///D:/ozon/ozon-react/src/utils/serverFiles.js#L3-L35)
- **存储机制**：IndexedDB 数据库 `kuajing-server-file-backups`，对象仓库（ObjectStore）`pending-uploads`。
- **工作机制**：
  1. 当客户端处于离线状态、会话超时或网络波动时，待上传文件及元数据写入 `pending-uploads`；
  2. 队列条目记录 `queuedAt` 时间戳；
  3. 网络恢复或会话重连后，按先进先出（FIFO，按 `queuedAt` 升序）自动补发重试；
  4. 上传成功并获得服务器确认后，从 IndexedDB 清理对应条目。
- **实测状态**：`[源码确认，现网恢复演练未实测]`。

---

## 4. 核算工具全局与项目模式读写隔离矩阵 `[源码确认 / 待合成验证]`

核算工具在独立单品模式与项目模式下的读写行为存在明确分工，必须严格区分共享只读默认值、全局写入与项目专属保存：

| 工具与模式 | 读操作 (Read Source) | 写操作 (Write Target) | 隔离机制与保护代码 | 风险判定与证据等级 |
| :--- | :--- | :--- | :--- | :--- |
| **OzonCalc 单品**<br>(独立模式) | 读全局运费配置 `ozon_shipping_data`、渠道配置 `ozon_channels.json` | 写全局持久化键 `ozon_shipping_data` | 全局单品专用读写，不影响项目 | 无风险 `[源码确认]` |
| **OzonCalc 项目模式**<br>(嵌入项目核算) | 读全局运费配置 `ozon_shipping_data` 作为默认模板基准 (Base) | 仅向父级投递 `CostScenario` 数据对象，**不写** 全局键 | [`OzonCalc.jsx:129`](file:///D:/ozon/ozon-react/src/components/OzonCalc.jsx#L129): `if (!projectContext) persistSet(SHIPPING_KEY, newData)` 已阻止写回全局 | 串写假说未复现；代码已有防护 `[源码确认 / 待合成验证]` |
| **OzonCalc 多品 Tab**<br>(MultiTab) | 读批量输入与规格计算规则 | 维护在组件局部 useState，未持久化至全局键 | 与 `projectContext` 未直接连接，不修改项目数据 | 无串扰 `[源码确认]` |
| **WBCalc 独立模式**<br>(独立核算工具) | 读 `config/wb_tariffs.json`、`config/settings.json`、`localStorage['wb_calc_settings']` | 写 `wb_calc_settings`, `wb_skus`, `wb_orders` | 用户自定义偏好与单品记录 | 无风险 `[源码确认]` |
| **WBCalc 项目模式**<br>(嵌入项目核算) | 共享只读费率表与用户线路偏好 | 用户显式点击保存时，调用 `onSaveScenario` 写入 `t6.costScenario.<id>` | 费率与设置作为共享默认值；项目场景持久化到 `CostScenario` 实体 | 串写假说未复现；共享费率属有意设计 `[源码确认 / 待合成验证]` |

> **判定结论**：静态代码分析证实 `OzonCalc` 已具备 `!projectContext` 保护，未发现项目模式无条件串写全局 key 的代码路径。共享费率与用户偏好属于有意设计的默认值复用，不应盲目全面切断。跨项目数据污染属于**待运行时合成验证的静态假说，不得定性为已证实的线上 P0 事故**。

---

## 5. 业务实体数据字典 (Entity Dictionary)

| 实体名称 | 存储 Key 前缀 / 物理位置 | 所有者与 Schema 版本 | 主键 ID 规范 | 关联外键 (Foreign Keys) | 读调用方 (Callers) | 写调用方 (Writers) | 备份与同步机制 | 验证状态 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **选品候选商品**<br>(Candidate) | `t6.candidate.<id>`<br>MySQL & localStorage | `t6Store.js`<br>Schema v1 | UUID 或 `t6-` 前缀不透明 ID | `sourceProductId`<br>`sourceNicheUid`<br>`latestSnapshotId` | `CandidatePoolPage`<br>`NicheDetailDrawer` | `ensureCandidate`<br>`setCandidateBizStatus`<br>`syncCandidateMarketEvidence` | 防抖 500ms 同步 / 版本历史 | `[本地运行]` (单元测试通过) |
| **不可变快照**<br>(Snapshot) | `t6.snapshot.<id>`<br>MySQL & localStorage | `t6Store.js`<br>Schema v1 | UUID 或 `t6-` 前缀不透明 ID | `candidateId` | `CandidateDetailDrawer`<br>`ProjectDetailPage` | `createSnapshot`<br>(只增不删不改) | Append-only / 冲突拦截 | `[本地运行]` (单元测试通过) |
| **SKU 项目**<br>(Project) | `t6.project.<id>`<br>MySQL & localStorage | `t6Store.js`<br>Schema v1 | UUID 或 `t6-` 前缀不透明 ID<br>(人类号 `RU-YYYY-NNN` 为业务字段) | `source.candidateId`<br>`source.creationSnapshotId`<br>`supply.supplierId`<br>`supply.quoteId` | `ProjectListPage`<br>`ProjectDetailPage` | `createProject`<br>`updateProject`<br>`setProjectLifecycle`<br>`setProjectSupply` | 防抖 500ms 同步 / 乐观锁 Revision | `[本地运行]` (单元测试通过) |
| **商品档案**<br>(Product Profile) | `project.product`<br>(内嵌于 Project JSON) | `productProfile.js`<br>Schema v1 | 随项目 ID | 无 | `ProductProfileEditor`<br>`gateEngine` (dims/weight) | `updateProjectProduct`<br>(生成 product_update 日志) | 随 Project 整体原子提交 | `[本地运行]` (单元测试通过) |
| **合规记录**<br>(Compliance Profile) | `project.compliance`<br>(内嵌于 Project JSON) | `complianceProfile.js`<br>Schema v1 | 随项目 ID | 无 | `ProjectCompliancePanel`<br>`gateEngine` (cert_plan) | `updateProjectCompliance`<br>`saveComplianceRequirement` | 随 Project 整体原子提交 / 草稿隔离保护 | `[本地运行]` (001/002通过；003合同待验收；结果层未开放) |
| **供应链供应商**<br>(Supplier) | `t6.supplier.<id>`<br>MySQL & localStorage | `t6Store.js`<br>Schema v1 | UUID 或 `t6-` 前缀不透明 ID | `projectId` | `ProjectSupplyChainPanel`<br>`gateEngine` | `createSupplier`<br>`updateSupplier`<br>(禁删除) | 独立实体同步 / 版本锁 | `[本地运行]` (单元测试通过) |
| **供应商报价版本**<br>(Supplier Quote) | `t6.supplierQuote.<id>`<br>MySQL & localStorage | `t6Store.js`<br>Schema v1 | UUID 或 `t6-` 前缀不透明 ID | `projectId`<br>`supplierId`<br>版本号 `version: 1, 2...` | `ProjectSupplyChainPanel`<br>`supplyCostBridge` | `createSupplierQuote`<br>(自增版本树，不可变) | 不可变版本链 / Append-only | `[本地运行]` (单元测试通过) |
| **样品打样记录**<br>(Sample) | `t6.sample.<id>`<br>MySQL & localStorage | `t6Store.js`<br>Schema v1 | UUID 或 `t6-` 前缀不透明 ID | `projectId`<br>`supplierId` | `ProjectSupplyChainPanel`<br>`gateEngine` (samples_record) | `createSampleRecord`<br>`updateSampleRecord` (有限状态机) | 状态流转留痕 | `[本地运行]` (单元测试通过) |
| **成本场景**<br>(Cost Scenario) | `t6.costScenario.<id>`<br>MySQL & localStorage | `costScenarioAdapter.js`<br>Schema v1 | UUID 或 `t6-` 前缀不透明 ID | `projectId`<br>`sourceSnapshotId` | `ProjectDetailPage` (Costing Tab)<br>`ProjectListPage` | `createCostScenario`<br>`setProjectBaselineScenario` | 不可变存储 / 自由切换基线 | `[本地运行]` (单元测试通过) |
| **项目决策日志**<br>(Decision Log) | `t6.log.<id>`<br>MySQL & localStorage | `t6Store.js`<br>Schema v1 | UUID 或 `t6-` 前缀不透明 ID | `projectId`<br>`subjectId` | `ProjectDetailPage` (Timeline) | `appendLog`<br>(只增不删不改) | Append-only / 冲突抛错 | `[本地运行]` (单元测试通过) |
| **市场情报批次**<br>(Market Run) | `public/data/market_intelligence/runs/` (静态 JSON) | `pipelineRunner.cjs`<br>Run Schema | 批次号 `RUN-YYYYMMDD-NNN` | 包含 `niche_uid` | `miStore.js`<br>`MarketIntelligenceApp` | 构建期生成；<br>运行时只读 | 随代码仓库发布与更新 | `[本地运行]` (构建校验通过) |
| **采购人工暂存**<br>(Manual Quotes) | `mi_manual_procurement_quotes`<br>MySQL & localStorage | `procurementIdentity.js`<br>Schema v1 | 双键索引：`uid` 或 `name` | `uid` (niche_uid) | `ManualProcurementWorkbench`<br>`NicheDetailDrawer` | `saveManualQuote` | 防抖 500ms 同步 / 覆盖合并 | `[本地运行]` (单元测试通过) |
| **市场分析报告**<br>(Market Reports) | `public/data/market_reports/*.json`<br>及 `market-report-*` 命名空间 | `marketReportAnalysis.js`<br>Report Schema | 文件名 Slug | 无 | `MarketReportCenter.jsx` | 静态编译 + 用户上传解析 | Git 跟踪 + 服务器私有备份 | `[源码确认]` (24份研报就绪) |

> **ID 规范说明**：实体 ID 生成基于 [`t6Store.js:73-76`](file:///D:/ozon/ozon-react/src/utils/t6/t6Store.js#L73-L76)，优先使用 `crypto.randomUUID()`，若环境不支持则回退为 `t6-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`。系统必须完整支持并保留所有不透明字符串 ID，不得强制要求全量清洗为严格 UUID v4。

---

## 6. 文件与附件存储策略 `[源码确认]`

1. **服务端存储路径与 Fallback 机制**：
   - 代码证据：[`wordpress/kuajing-persistence/kuajing-persistence.php:253-257`](file:///D:/ozon/wordpress/kuajing-persistence/kuajing-persistence.php#L253-L257)
   - 路径解析逻辑：
     ```php
     $parent_dir = dirname(ABSPATH);
     $target_dir = $parent_dir . '/kuajing-private-data';
     if (!is_dir($target_dir) || !wp_is_writable($target_dir)) {
         $target_dir = WP_CONTENT_DIR . '/kuajing-private-data';
     }
     ```
   - **安全边界**：首选目录位于 `public_html` 平级，HTTP 无法直接静态访问；若降级到 `WP_CONTENT_DIR`，插件会写入 `.htaccess` (`Deny from all`) 及空 `index.php` 实施防护。但在非 Apache 服务器（如 Nginx 反代或未开启 htaccess 解析的 LiteSpeed 架构）下，不能断言该目录具备绝对物理隔离，实际安全性依赖 Web 服务器配置。
   - 文件通过 WordPress 短代码鉴权路由 `/wp-json/kuajing/v1/files/{namespace}` 鉴权流式返回；
   - 替换或删除已有文件前，系统会自动保留历史版本快照（保留最新 20 份快照）。
2. **离线上传队列 (Client Side)**：
   - 若客户端断网或会话过期，待上传文件暂存至浏览器的 IndexedDB 队列中（`kuajing-server-file-backups` -> `pending-uploads`）；
   - 待网络恢复或重新鉴权后，按照先进先出（FIFO）原则自动补发重试。
3. **安全凭据与敏感信息存储隔离**：
   - 生产访问密码：`kuajing-persistence.php` 中仅比对访问密码的 SHA256 哈希值；
   - Cookie 采用 `HttpOnly`, `Secure`, `SameSite=Lax` 并在服务端通过 HMAC-SHA256 签名，TTL 为 7 天；
   - 严禁任何组件把明文密码、真实业务客户联系方式存储在状态树或向外暴露。
