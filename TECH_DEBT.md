# TECH_DEBT.md — 技术债登记表

> 规则（AGENTS.md §3.4）：AI 发现技术债**只登记到这里**，未经授权不得顺手修复。
> 每个条目：编号、描述、位置、风险、建议处理阶段。

---

## 已登记

| # | 描述 | 位置 | 风险 | 建议处理 |
|---|---|---|---|---|
| TD-1 | 双端汇率漂移：React 默认 12 vs Python settings.json 11.5，两端 WB 计算结果不一致 | `wbConfig.js` / `wb_data/settings.json` | 高：业务数字两端打架 | T2 统一 config 层时解决，以需求方确认值为准 |
| TD-2 | WB 核算双引擎并行，规则靠人工同步（已有漂移先例 TD-1） | `wbEngine.js` vs `wb_calc.py` | 高：改一处忘另一处 | T2 配置唯一事实源 + T2-4 双端对拍 |
| TD-3 | Python 端未实现反向赔偿 V2（13.1.14），与 React 端功能不对称 | `wb_calc.py` | 中：Python 面板算不出拒收/清关赔偿 | T2 或独立任务补齐并加测试 |
| TD-4 | `NewDashboard.jsx` 459KB 巨型组件 | `ozon-react/src/components/NewDashboard.jsx` | 中：任何改动易牵一发动全身 | T3-1 按职责拆分 |
| TD-5 | `WBCalc.jsx` 1692 行、`FragrancePricing.jsx` 42KB 同样偏大 | `ozon-react/src/components/` | 中 | T3-1 |
| TD-6 | 生产构建无代码分割，主 chunk 2.7MB | `ozon-react/vite.config.js` | 低：首屏慢 | T3-2 React.lazy |
| TD-7 | `app.py` 硬编码 `DATA_DIR = d:\ozon\选品`；`wb_panel.py` 硬编码 `COMMISSION_FILE` | `ozon-product-analyzer/` | 中：换机器即失效 | T2-2 改环境变量 |
| TD-8 | `manifest.json` 的 `updatedAt` 每次启动被 vite 插件重写，产生无关 git dirty | `ozon-react/vite.config.js` | 低：噪声 | 待定：gitignore 该字段或改为构建期生成 |
| TD-9 | 业务数据重复存储：根目录 xlsx 与 `ozon-react/public/data/` 各一份（约 11MB） | `public/data/` | 低：仓库体积 | 待定：仅保留同步产物或改软链接 |
| TD-10 | `ozon_hair_dryer_analysis/` 遗留应用（吹风机分析，已被 React 取代） | 根目录 | 低：误导新人 | 待定：保留只读（当前决策）或归档 |
| TD-11 | `server.js` 用自包含 http 路由（497 行无框架分层），扩展性有限 | `server.js` | 低 | 待定：有真实扩展需求再改 Express 分层 |
| TD-12 | `market_data_processor.js`(848行)/`analyze_with_cleaned_data.js`(2353行) 大文件无单测 | 根目录 | 中：清洗/匹配逻辑改动无护栏 | 待定：核心清洗函数补单测 |
| TD-13 | 黄金案例与双端对拍仍是占位器（`scripts/run-golden-tests.js` / `verify_sync.js` 输出 SKIP） | `scripts/` | 高：假护栏（看起来有测试，实际没有） | **T2-3 / T2-4 必须完成，此前不得宣称已通过** |

---

## 处理纪律

- 处理任何条目 = 新开分支（`fix/td-N-xxx`），不与其他任务混在一个 commit。
- 处理 TD-1/TD-2/TD-3 前必须读 `BUSINESS_RULES.md`，改动后 `npm test` 全绿 + 需求方确认。
- 处理完成后在 `CHANGELOG.md` 记录，并把该行从本表移除。
