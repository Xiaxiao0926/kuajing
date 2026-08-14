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

- `wb_panel.py`：读取 `wb_data/settings.json`、`tariffs.json`、`skus.json`、`orders.json`，调用 `wb_calc.py` 纯函数计算。
- `app.py`：扫描 `DATA_DIR`（当前硬编码 `d:\ozon\选品`，T2 将改为环境变量）下的 xlsx/csv 评分。
- `utils/ai_service.py`：可选 AI 增强（配置 `ai_config.json`，gitignored）。

---

## 3. 双引擎现状（重要：规则漂移风险区）

WB 核算有 **两套独立实现**，功能平行、数值应一致（当前有已知漂移，见 §5 与 BUSINESS_RULES.md §10）：

| | React 引擎 | Python 引擎 |
|---|---|---|
| 引擎文件 | `ozon-react/src/utils/wbEngine.js` | `ozon-product-analyzer/wb_calc.py` |
| 配置 | `ozon-react/src/utils/wbConfig.js`（内嵌 camelCase 常量） | `ozon-product-analyzer/wb_data/tariffs.json`（snake_case） |
| 数值类型 | JS number + round2 | Decimal + ROUND_HALF_UP |
| 测试 | `wbEngine.test.mjs` 65 项 | `wb_test.py` 31 项 |
| 反向赔偿(V2) | ✅ 已实现 13.1.14 全套 | ❌ 未实现（仅有旧版 calculate_return_loss） |

**T2 目标**：以 `config/*.json` 为唯一事实源，双端消费同一份数据（详见 整改任务书V3.md T2）。

---

## 4. 关键文件索引

| 文件 | 作用 | 改动敏感度 |
|---|---|---|
| `ozon-react/src/App.jsx` | 路由编排（roadmap 节点→组件映射） | 中 |
| `ozon-react/src/components/WBCalc.jsx` | WB 核算 UI（1692 行） | 高（只拆不改逻辑） |
| `ozon-react/src/components/OzonCalc.jsx` | Ozon 核算 UI | 高 |
| `ozon-react/src/components/NewDashboard.jsx` | 市场调研看板（459KB 巨型） | 高（T3 拆分） |
| `ozon-react/src/utils/wbEngine.js` | WB 计算引擎（纯函数） | **极高（禁改公式）** |
| `ozon-react/src/utils/ozonEngine.js` | Ozon CEL 渠道+佣金+利润 | **极高（禁改公式）** |
| `ozon-react/src/utils/wbConfig.js` | WB 费率/赔偿默认配置 | **极高（禁改数值）** |
| `ozon-react/src/utils/dataProcessor.js` | 市场数据清洗 | 中 |
| `ozon-react/vite.config.js` | 数据同步插件 + /api/persist + /api/upload | 高 |
| `server.js` | 价格分析 API（497 行自包含路由） | 中 |
| `config.js` | Node 端路径配置 | 低（改环境变量即可） |
| `market_data_processor.js` | 市场价清洗（848 行） | 中 |
| `analyze_with_cleaned_data.js` | 报价匹配分析（2353 行） | 中 |
| `ozon-product-analyzer/wb_calc.py` | WB 计算引擎（Decimal） | **极高（禁改公式）** |
| `ozon-product-analyzer/wb_data.py` | Python 端数据存储+默认费率 | **极高（禁改数值）** |
| `ozon-product-analyzer/wb_panel.py` | WB Streamlit 面板 | 高 |
| `ozon-product-analyzer/app.py` | 选品评分面板 | 中 |
| `scripts/run-wb-py-test.js` | 跨平台 Python 测试启动器 | 低 |
| `scripts/run-golden-tests.js` | 黄金案例（T2 实现，当前占位） | 低 |
| `scripts/verify_sync.js` | 双端对拍（T2 实现，当前占位） | 低 |

---

## 5. 已知风险与限制（与 TECH_DEBT.md 联动）

1. **汇率运行时覆盖风险**：仓库内三处基线一致（React `DEFAULT_SETTINGS` 12 / Python `DEFAULT_SETTINGS` 12 / tracked `settings.json` 12）；但 2026-08-14 曾观察到本机 Python 运行态 `settings.json` 为 11.5（当前仓库无法复现）。运行时存在外部/持久化配置覆盖代码默认值的可能，T2 统一 config 时需验证（TD-1）。
2. Python 端未实现反向赔偿 V2（13.1.14），与 React 端功能不对称。
3. `app.py` `DATA_DIR` 与 `wb_panel.py` `COMMISSION_FILE` 仍硬编码本机路径（T2 修复）。
4. Ozon 单规格（售价直算）与多规格（上架价×0.6）价格语义不一致（TD-14）；HK 渠道费率单位待 CEL 原始表复核（TD-15）。
5. `ozon-react/public/data/` 与根目录存在重复 xlsx（数据同步插件拷贝产物，约 11MB）。
6. 生产构建无代码分割，主 chunk 2.7MB。
