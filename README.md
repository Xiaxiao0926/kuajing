# Ozon/WB 跨境电商运营工作区

俄罗斯电商平台 Ozon 与 Wildberries 的跨境运营一体化工作区，包含 4 个应用 + 业务数据资产。

## 应用清单

| # | 应用 | 技术栈 | 端口 | 启动命令 | 用途 |
|---|------|-------|------|---------|------|
| 1 | **Ozon 跨境运营面板**（主入口） | React + Vite + Tailwind | 5173 | `cd ozon-react && npm run dev` | 选品调研 / Ozon+WB 核算 / AI 生图 / 列表内容 |
| 2 | **价格分析 API** | Node.js + Express | 8888 | `npm start` 或 `npm run dev` | 市场价清洗 / 价格优势分析 / 候选商品管理 |
| 3 | **WB 跨境核算面板**（Python 版） | Streamlit | 8502 | `cd ozon-product-analyzer && streamlit run wb_panel.py` | WB 运费/利润/反向配送赔偿核算（独立单元） |
| 4 | **Ozon 选品分析面板**（Python 版） | Streamlit | 8501 | `cd ozon-product-analyzer && streamlit run app.py` | 市场数据分析 / 产品定价建议 |

## 快速开始

### 环境要求
- Node.js 18+ / Python 3.10+
- Windows / macOS / Linux

### 启动主面板（React）
```bash
cd ozon-react
npm install
npm run dev
# 访问 http://localhost:5173
```

### 启动 Python 面板（可选）
```bash
cd ozon-product-analyzer
pip install -r requirements.txt
streamlit run wb_panel.py --server.port 8502  # WB 核算
streamlit run app.py --server.port 8501       # 选品分析
```

### 启动价格分析 API（可选）
```bash
npm install
npm start
# 访问 http://localhost:8888
```

## 数据流

```
市场价 Excel + 供应商报价 Excel
        ↓
   server.js（清洗 + 分析）
        ↓
  React 前端（选品 + 核算）
        ↓
  持久化到 D:/ozon/市场分析/persisted-data.json
        ↓
  通过 /api/persist 中间件实现局域网多设备共享
```

## 核心模块

### 计算引擎（已通过测试验证）
- **React 版**：`ozon-react/src/utils/wbEngine.js`（65 项测试通过）
  - 运费计算 / 反向配送赔偿 / 多包裹独立计费 / 历史费率版本匹配
- **Python 版**：`ozon-product-analyzer/wb_calc.py`（31 项测试通过）
  - 运费计算 / 历史费率 / 利润核算

### 费率配置
- **React**：`ozon-react/src/utils/wbConfig.js`（含 2026-02-09 历史版 + 2026-07-22 0726版）
- **Python**：`ozon-product-analyzer/wb_data/tariffs.json`（双版本已对齐）
- **汇率**：两端统一 1¥ = 12₽（生效 2026-08-11）

### 测试
```bash
# React 测试（65 项）
cd ozon-react
node --experimental-vm-modules src/utils/wbEngine.test.mjs

# Python 测试（31 项）
cd ozon-product-analyzer
python wb_test.py
```

## 目录结构

```
d:\ozon\
├─ ozon-react/              # React 主面板
│  ├─ src/
│  │  ├─ components/         # 组件（WBCalc/OzonCalc/AiImageGen 等）
│  │  ├─ utils/              # 引擎（wbEngine/wbConfig/ozonEngine/persist）
│  │  └─ data/               # 路由配置
│  └─ public/data/           # 静态数据（WB佣金表/Excel）
├─ ozon-product-analyzer/    # Python 面板
│  ├─ wb_calc.py             # WB 核算引擎
│  ├─ wb_panel.py            # Streamlit WB 面板
│  ├─ app.py                 # Streamlit 选品面板
│  └─ wb_data/               # 费率/设置 JSON
├─ 运费计算/                  # 需求规格说明书 + 费率 PDF
├─ 市场分析/                  # 业务数据（persisted-data.json / uploads）
├─ 选品/                     # 选品 Excel
├─ server.js                 # 价格分析 API
├─ config.js                 # 路径配置（支持环境变量）
├─ market_data_processor.js  # 市场数据处理核心
├─ analyze_with_cleaned_data.js  # 清洗后数据分析
└─ _archive/                 # 归档的一次性脚本
   ├─ debug/                 # 调试脚本
   ├─ analysis/              # 历史分析脚本
   ├─ migration/             # 迁移脚本
   ├─ reports/               # 历史报告
   └─ deprecated/            # 废弃代码
```

## 路径配置

价格分析 API 的数据路径通过环境变量驱动：

```bash
# Windows PowerShell
$env:BASE_PATH = "D:\你的数据目录"
$env:PORT = "8888"
npm start

# Linux/macOS
BASE_PATH=/your/data/path PORT=8888 npm start
```

默认回退到 `E:\Desktop\坪优报价分析`（可通过 `LEGACY_PATH_ENABLED=false` 禁用）。

## 数据资产

| 文件 | 用途 |
|------|------|
| `2026年Ozon平台供应链工厂目录0406.xlsx` | 供应链工厂目录 |
| `各供应商起订量及价格清单表.xlsx` | 供应商报价 |
| `样品终选和包材.xlsx` | 样品与包材清单 |
| `运费计算/CEL产品资费表 V5.23.xlsx` | Ozon CEL 渠道费率 |
| `运费计算/DPX运费.pdf` | WB 物流费率（历史版） |
| `运费计算/warehouse_and_tarrifs/0726.pdf` | WB 物流费率（0726版） |
| `ozon-react/public/data/wb_commission.json` | WB 佣金表（96类目/7424条） |

## Git 与备份

```bash
git remote -v
# origin  https://github.com/Xiaxiao0926/kuajing.git
```

## 相关文档

- [WB 跨境利润与物流费用核算面板-需求规格说明书](运费计算/WB跨境利润与物流费用核算面板-需求规格说明书.md)
- [整改方案](整改方案.md)
- [整改任务书V2](整改任务书V2.md)
