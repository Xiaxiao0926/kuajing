# ARCHITECTURE.md — 项目架构

> 本文档回答"项目到底怎么跑"。维护前先读 `AGENTS.md`（行为宪法），本文提供技术事实。

---

## 1. 应用拓扑

```
                    ┌─────────────────────────────────────────┐
                    │  业务数据（只读资产，禁删禁改）             │
                    │  市场分析/  选品/  运费计算/  根目录xlsx/pdf │
                    └──────────────┬──────────────────────────┘
                                   │
        ┌──────────────────────────┼───────────────────────────┐
        │                          │                           │
        ▼                          ▼                           ▼
┌───────────────┐        ┌──────────────────┐        ┌──────────────────────┐
│ ozon-react    │        │ server.js        │        │ ozon-product-analyzer│
│ React+Vite    │        │ Node http (8888) │        │ Python Streamlit     │
│ (5173)        │        │ 价格分析 API      │        │ app.py(8501)选品     │
│ 主入口面板    │◄──────►│ 清洗/匹配/分析    │        │ wb_panel.py(8502)WB  │
└───────┬───────┘        └────────┬─────────┘        └──────────┬───────────┘
        │  /api/persist 持久化    │                             │
        │  /data/* 数据同步        │ 读取 E:\...\坪优报价分析*     │ wb_data/ JSON 存储
        ▼                         ▼                             ▼
  市场分析/persisted-data.json  市场价CSV+报价表xlsx            settings/tariffs/skus/orders
```

### 1.1 四个应用

| # | 应用 | 技术栈 | 端口 | 入口文件 | 职责 |
|---|------|--------|------|---------|------|
| 1 | Ozon 跨境运营面板 | React 18 + Vite + Tailwind + Recharts | 5173 | `ozon-react/src/main.jsx` | 主入口：市场调研、Ozon/WB 核算、香薰定价、Listing 内容 |
| 2 | 价格分析 API | Node.js（http 模块 + xlsx + csv-parser） | 8888 | `server.js` | 市场价清洗、供应商报价匹配、价格优势分析、候选管理 |
| 3 | WB 跨境核算面板（Python） | Streamlit + Decimal | 8502 | `ozon-product-analyzer/wb_panel.py` | WB 运费/利润/反向赔偿核算（与 React WBCalc 功能平行） |
| 4 | Ozon 选品分析面板（Python） | Streamlit + pandas + plotly | 8501 | `ozon-product-analyzer/app.py` | 热销数据评分排序（A/B/C/D 推荐） |

**遗留应用**：`ozon_hair_dryer_analysis/`（早期吹风机分析 Streamlit，已被应用 1 取代，只读保留）。

---

## 2. 数据流

### 2.1 React 面板数据流

```
用户上传 xlsx/html
    ↓
vite.config.js ozonDataSyncPlugin：
  - 扫描 市场分析/ 与 市场分析/uploads/
  - 拷贝到 ozon-react/public/data/ + 生成 manifest.json
    ↓
前端 fetch('/data/manifest.json') → 加载最新文件 → XLSX/DOMParser 解析
    ↓
dataProcessor.js（cleanData/addPriceCategory/calculateKPIs）
    ↓
App.jsx 状态 → 各组件渲染图表/表格
```

- **持久化**：`localStorage` + vite 中间件 `/api/persist` 同步到 `市场分析/persisted-data.json`（局域网多设备共享）。
- **AI 图片生成**：`/api/ai` 代理到 `http://localhost:8000`（外部 AI 服务，当前未随仓库提供）。

### 2.2 价格分析 API 数据流

```
E:\Desktop\坪优报价分析\市场价\*.csv  +  报价表\*.xlsx
    ↓ （fs.watch 防抖3s + 5分钟定时扫描）
server.js runPipeline()
    ↓ execSync
market_data_processor.js --incremental   # 清洗 → 清洗后的市场价数据.xlsx
    ↓
analyze_with_cleaned_data.js             # 匹配 → 价格优势分析结果_v2.xlsx
    ↓
前端 public/index.html（自包含内联脚本）轮询 /api/* 渲染
```

- 路径解析：`config.js` 三层优先级（环境变量 `BASE_PATH` → 项目 `data/` → Legacy `E:\Desktop\坪优报价分析`，`LEGACY_PATH_ENABLED` 开关）。
- 候选拒绝记录：`rejected_candidates.json`（每次重跑分析后清空）。

### 2.3 Python 面板数据流

- `wb_panel.py`：设置与费率**读 `config/settings.json`、`config/wb_tariffs.json`（唯一事实源，经 `CONFIG_DIR` 环境变量）**；运行时数据（skus/orders）在 `wb_data/`。
- `app.py`：扫描 `OZON_DATA_DIR`（环境变量，回退 `../选品/`）下的 xlsx/csv 评分。
- `utils/ai_service.py`：可选 AI 增强（配置 `ai_config.json`，gitignored）。

### 2.4 配置唯一事实源（T2 起）

```
config/*.json（唯一事实源，snake_case）
  ├─ wb_tariffs.json      ← 脚本 scripts/sync-config.js 生成 ozon-react/src/generated/wb_tariffs.js
  ├─ settings.json        ← 生成 src/generated/settings.js
  ├─ ozon_channels.json   ← 生成 src/generated/ozon_channels.js
  └─ schema/*.json        （JSON Schema，费率/渠道结构约束）

React 侧：wbConfig.js / ozonEngine.js 是 adapter（snake→camel 映射），对外 API 不变。
Python 侧：wb_data.py 严格读 config/*.json（CONFIG_DIR），fail-fast——文件缺失/损坏/结构非法即抛 ConfigError，不存在第二套兜底数字；写入经 `_save_config_atomic`（校验→.tmp→os.replace）。
同步时机：npm test 前置、vite buildStart；手动 node scripts/sync-config.js。
```

---

## 3. 双引擎现状（T2 后：同源 + 对拍）

WB 核算两套实现**同读 config/wb_tariffs.json**，`npm run test:sync` 对拍（16 边界重量 + 2 版本边界）零差异：

| | React 引擎 | Python 引擎 |
|---|---|---|
| 引擎文件 | `ozon-react/src/utils/wbEngine.js` | `ozon-product-analyzer/wb_calc.py` |
| 配置 | **同读 `config/wb_tariffs.json`**（React 经 adapter+generated） | **同读 `config/wb_tariffs.json`**（CONFIG_DIR） |
| 数值类型 | JS number + round2 | Decimal + ROUND_HALF_UP |
| 测试 | `wbEngine.test.mjs` 65 项 | `wb_test.py` 31 项 |
| 对拍 | `npm run test:sync` 零差异（16 边界重量 + 2 版本边界） | 同左 |
| 反向赔偿(V2) | ✅ 已实现 13.1.14 全套 | ❌ 未实现（TD-3 待补） |

---

## 4. 关键文件索引

| 文件 | 作用 | 改动敏感度 |
|---|---|---|
| `ozon-react/src/App.jsx` | 路由编排 + 五个页面 React.lazy（T3-4） | 中 |
| `ozon-react/src/components/NewDashboard.jsx` | 市场调研编排层（T3-1 拆分后 115 行） | 中 |
| `ozon-react/src/components/dashboard/` | 词库 dictionary.js / 计算 hook useDashboardStats.js / Cards / 5 展示区段 | 计算 hook 禁改逻辑；区段只改展示 |
| `ozon-react/src/components/WBCalc.jsx` | WB 核算编排层（T3-2 拆分后 109 行） | 中 |
| `ozon-react/src/components/wbcalc/` | 6 Tab + 5 共享组件 + format.js | 高（只拆不改逻辑） |
| `ozon-react/src/components/fragrancePricing/` | data.js（常量+利润计算）/ InputField / PlanPanel（T3-3） | data.js 禁改计算 |
| `ozon-react/src/components/OzonCalc.jsx` | Ozon 核算 UI | 高 |
| `ozon-react/src/utils/wbEngine.js` | WB 计算引擎（纯函数） | **极高（禁改公式）** |
| `ozon-react/src/utils/ozonEngine.js` | Ozon 引擎 + 渠道 adapter（费率数值在 config/） | **极高（禁改公式）** |
| `ozon-react/src/utils/wbConfig.js` | WB 配置 adapter（读 generated，禁改映射语义） | **极高** |
| `ozon-react/src/generated/*.js` | 自动生成物（勿手改，改 config 后重跑 sync） | 只读 |
| `ozon-react/src/utils/dataProcessor.js` | 市场数据清洗 | 中 |
| `ozon-react/vite.config.js` | 数据同步插件 + config-sync（fail-close + dev watch） | 高 |
| `server.js` | 价格分析 API（497 行自包含路由） | 中 |
| `config.js` | Node 端路径配置 | 低（改环境变量即可） |
| `market_data_processor.js` | 市场价清洗（848 行） | 中 |
| `analyze_with_cleaned_data.js` | 报价匹配分析（2353 行） | 中 |
| `ozon-product-analyzer/wb_calc.py` | WB 计算引擎（Decimal） | **极高（禁改公式）** |
| `ozon-product-analyzer/wb_data.py` | Python 端配置 fail-fast 加载 + 原子写 | **极高（禁改校验逻辑）** |
| `ozon-product-analyzer/wb_panel.py` | WB Streamlit 面板 | 高 |
| `ozon-product-analyzer/app.py` | 选品评分面板 | 中 |
| `scripts/run-wb-py-test.js` | 跨平台 Python 测试启动器 | 低 |
| `scripts/run-golden-tests.js` | 黄金案例护栏（76 断言，provenance 分级，5 核心案例 ID 锁定） | 低 |
| `scripts/verify_sync.js` | 双端对拍（16 边界+2 版本） | 低 |
| `scripts/sync-config.js` | config→generated 同步+结构校验 | 低 |
| `config/*.json` | **唯一事实源：费率/设置/渠道** | **极高（改动须全测试+对拍）** |
| `tests/golden/*.json` | 黄金业务案例（provenance 分级） | **极高（改动须需求方确认）** |

#### 选品评分系统（T4）
- `ozon-react/src/utils/scoring/`：`normalization.js`（百分位/winsorize/证据感知/shrinkage）、`scoringEngine.js`（scoreProduct 纯函数 + fail-close）、`explanations.js`（两段式契约第二段）、`scoringDataAdapter.js`（数据适配管线，UI 与审计同源）、`scoringExport.js`（XLSX/CSV 导出）+ 4 个测试文件
- `config/scoring_rules.json` → `ozon-react/src/generated/scoring_rules.js`（sync-config 生成，deepFreeze 只读，唯一规则源）
- `scripts/`：`build-bsr-benchmark.js`（BSR 聚合基准）、`scoring-xlsx.js`（候选解析唯一实现）、`build-scoring-input.js`（xlsx→`public/data/scoring_candidates.json`）、`t4-score-audit.js`（1000 SKU 审计+维度验证矩阵）、`run-scoring-golden.js`
- `tests/scoring-golden/*.json`：10 固件 56 断言
- 面板：`ozon-react/src/components/dashboard/sections/ProductScoringSection.jsx`（在 MarketResearch 的 dashboardRef 之外挂载，独立于市场分析数据与 PDF 导出）

---

## 5. 已知风险与限制（与 TECH_DEBT.md 联动）

1. ~~汇率运行时覆盖风险~~ ✅ T2 已解决：单源 config/settings.json，运行态副本已删（TD-1 关闭）。
2. Python 端未实现反向赔偿 V2（13.1.14），与 React 端功能不对称（TD-3）。
3. 业务路径硬编码**大部分**已解决（T2：OZON_DATA_DIR / WB_COMMISSION_FILE / CONFIG_DIR）；残留 TD-18：`vite.config.js` 数据同步层仍写死 `D:/ozon/市场分析` 绝对路径。
4. Ozon 单规格（售价直算）与多规格（上架价×0.6）价格语义不一致（TD-14）；Big/Budget 0.001kg 边界表述差异（TD-17）。
5. `ozon-react/public/data/` 与根目录存在重复 xlsx（数据同步插件拷贝产物，约 11MB）。
6. ~~无代码分割~~ ✅ T3-4 已解决：React.lazy 页面级分割，主 chunk 2743KB→1122KB（gzip 780→336KB）。

## 6. 选品评分系统（T4）数据流

```text
选品/跨境项目产品线扩展计划.xlsx（1000 行 × 63 字段，业务源）
  → scripts/scoring-xlsx.js（唯一解析实现 → canonical candidates，T4-1B §1.1 契约）
  → scripts/build-scoring-input.js → ozon-react/public/data/scoring_candidates.json

市场分析/市场bsr/*.xlsx（19 域 ~19000 行明细）
  → scripts/build-bsr-benchmark.js（聚合统计：类型/域 P10-P90；只入库聚合，不存明细）
  → ozon-react/public/data/bsr_market_benchmarks.json（855 类型 / 19 域）

config/scoring_rules.json（唯一规则源：λ=0.5、六维权重 25/15/10/20/15/15、评级线、Gate、SupplyGap、Decision）
  → scripts/sync-config.js（结构校验 fail-close）→ src/generated/scoring_rules.js（deepFreeze 只读）

浏览器（ProductScoringSection，useMemo 只算一次）：
  fetch 两个 JSON + import 生成规则/设置
  → scoringDataAdapter.js（buildBsrIndex / 精确>包含匹配 / shrinkage / 候选池+市场规模池 / CEL 探测）
  → scoringEngine.js scoreProduct()（fail-close：HIGH/MEDIUM 无 marketScalePool 即抛 SCORING_CONFIG_FAIL）
  → explanations.js buildExplanations()（三档口径：同类市场 / 对应 BSR 市场域 / 候选池表现）
  → ScoredProduct[] → 总览/排名/筛选/详情 + scoringExport.js 导出当前筛选

审计（Node）：scripts/t4-score-audit.js 与 UI 共用同一 scoringDataAdapter（同源保证逐位一致），
输出 A/B/C/D/不可评级分布 + 维度验证矩阵；对拍脚本 _audit/tmp/verify-ui-audit-identity.js（5 SKU 逐位一致）。
```
