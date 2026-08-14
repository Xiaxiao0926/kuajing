# TECH_DEBT.md — 技术债登记表

> 规则（AGENTS.md §3.4）：AI 发现技术债**只登记到这里**，未经授权不得顺手修复。
> 每个条目：编号、描述、位置、风险、建议处理阶段。

---

## 已登记

| # | 描述 | 位置 | 风险 | 建议处理 |
|---|---|---|---|---|
| TD-1 | 运行时配置来源存在漂移风险：仓库基线三处一致（React 12 / Python 默认 12 / tracked settings.json 12），但 2026-08-14 曾观察到本机 Python 运行态 11.5（当前仓库无法复现）——运行时持久化文件可覆盖代码默认值 | `wbConfig.js` / `wb_data.py` / `wb_data/settings.json` | 高：运行态与仓库态可能不一致 | T2 建立 config 唯一事实源时，验证运行时是否存在外部覆盖；以需求方确认值为准 |
| TD-2 | WB 核算双引擎并行，规则靠人工同步（已有运行态异常观察 TD-1） | `wbEngine.js` vs `wb_calc.py` | 高：改一处忘另一处 | T2 配置唯一事实源 + T2-4 双端对拍 |
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
| TD-14 | Ozon 两个 Tab 价格语义不一致：SingleTab 输入"售价"直接计算（不乘 0.6），MultiTab 输入"上架价"×0.6 得折后价 | `ozon-react/src/components/OzonCalc.jsx` / `ozonEngine.js` calcRow/calcChannelProfit | 中：同一产品两口径得出不同利润 | 需求方确认是否统一口径后再立项 |
| TD-15 | ✅ 已定性（2026-08-14 Gate 0 核验）：代码数值正确（96 即元/kg），仅配置标签 `rateUnit:'per100g'` 与 UI 文案错误。核验报告：`T2-Gate0-CEL-HK核验报告.md`。T2 迁移按 **96元/kg + 百克进位** 存储 | `ozon-react/src/utils/ozonEngine.js` / `OzonCalc.jsx` | 已降级：迁移时修正语义即可 | T2-2 建 config 时修语义与 UI 文案 |

---

## 处理纪律

- 处理任何条目 = 新开分支（`fix/td-N-xxx`），不与其他任务混在一个 commit。
- 处理 TD-1/TD-2/TD-3 前必须读 `BUSINESS_RULES.md`，改动后 `npm test` 全绿 + 需求方确认。
- 处理完成后在 `CHANGELOG.md` 记录，并把该行从本表移除。
