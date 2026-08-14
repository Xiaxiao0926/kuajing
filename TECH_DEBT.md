# TECH_DEBT.md — 技术债登记表

> 规则（AGENTS.md §3.4）：AI 发现技术债**只登记到这里**，未经授权不得顺手修复。
> 每个条目：编号、描述、位置、风险、建议处理阶段。

---

## 已登记

| # | 描述 | 位置 | 风险 | 建议处理 |
|---|---|---|---|---|
| TD-1 | ✅ 已解决（T2）：配置单源化后不再存在运行态副本——Python 读写均指向 `config/settings.json`（原 `wb_data/settings.json` 已删除），React 经 generated 读同一文件。历史 11.5 观察无法复现，判定为已消失的旧运行态残留 | — | — | 关闭 |
| TD-2 | ✅ 已解决（T2）：WB 双引擎同读 `config/wb_tariffs.json`，对拍脚本 `npm run test:sync` 16 边界+2 版本零差异 | — | — | 关闭 |
| TD-3 | Python 端未实现反向赔偿 V2（13.1.14），与 React 端功能不对称 | `wb_calc.py` | 中：Python 面板算不出拒收/清关赔偿 | T2 或独立任务补齐并加测试 |
| TD-4 | ✅ 已解决（T3-1）：NewDashboard 6609 行拆为编排层 + dictionary.js(2141) + useDashboardStats.js(1524) + Cards + 5 展示区段，脚本锚点校验 + 逐行比对零差异 | — | — | 关闭 |
| TD-5 | ✅ 已解决（T3-2/T3-3）：WBCalc 拆为编排层+6 Tab+5 共享组件（1531 行函数体逐字一致）；FragrancePricing 拆为 data.js/InputField/PlanPanel | — | — | 关闭 |
| TD-6 | ✅ 已解决（T3-4）：React.lazy 页面级分割，主 chunk 2743KB→1122KB（gzip 780→336KB，-59%） | — | — | 关闭 |
| TD-7 | ✅ 已解决（T2）：`app.py` DATA_DIR→`OZON_DATA_DIR` 环境变量+相对路径回退；`wb_panel.py` COMMISSION_FILE→`WB_COMMISSION_FILE`；`wb_data.py` 配置目录→`CONFIG_DIR` | — | — | 关闭 |
| TD-8 | `manifest.json` 的 `updatedAt` 每次启动被 vite 插件重写，产生无关 git dirty | `ozon-react/vite.config.js` | 低：噪声 | 待定：gitignore 该字段或改为构建期生成 |
| TD-9 | 业务数据重复存储：根目录 xlsx 与 `ozon-react/public/data/` 各一份（约 11MB） | `public/data/` | 低：仓库体积 | 待定：仅保留同步产物或改软链接 |
| TD-10 | `ozon_hair_dryer_analysis/` 遗留应用（吹风机分析，已被 React 取代） | 根目录 | 低：误导新人 | 待定：保留只读（当前决策）或归档 |
| TD-11 | `server.js` 用自包含 http 路由（497 行无框架分层），扩展性有限 | `server.js` | 低 | 待定：有真实扩展需求再改 Express 分层 |
| TD-12 | `market_data_processor.js`(848行)/`analyze_with_cleaned_data.js`(2353行) 大文件无单测 | 根目录 | 中：清洗/匹配逻辑改动无护栏 | 待定：核心清洗函数补单测 |
| TD-13 | ✅ 已解决（T2）：`run-golden-tests.js` 真实现（76 断言，含 provenance 分级）；`verify_sync.js` 真实现（双端对拍零差异） | — | — | 关闭 |
| TD-14 | Ozon 两个 Tab 价格语义不一致：SingleTab 输入"售价"直接计算（不乘 0.6），MultiTab 输入"上架价"×0.6 得折后价 | `ozon-react/src/components/OzonCalc.jsx` / `ozonEngine.js` calcRow/calcChannelProfit | 中：同一产品两口径得出不同利润 | 需求方确认是否统一口径后再立项 |
| TD-16 | Ozon 渠道表 3 份重复定义已收敛为 1 份（`config/ozon_channels.json` → `ozonEngine.js` adapter）；但 `PricingCalc.jsx`、`ShippingCalc.jsx` 两个旧组件仍内嵌自己的渠道数组且未被 App.jsx 引用（死代码） | `ozon-react/src/components/PricingCalc.jsx` / `ShippingCalc.jsx` | 低：死代码不参与计算，但误导 | T3 拆分时删除或改为消费引擎导出 |
| TD-17 | Big 渠道重量下限代码为 2kg、原表为 2.001kg；Budget 下限代码 0.5kg、原表 0.501kg——边界表述差异，T2 按"行为冻结"原则保留代码现值 | `config/ozon_channels.json` | 低：0.001kg 边界无实际影响 | 需求方确认后统一（改 config 一处即可） |
| TD-15 | ✅ 已解决（T2+hardening）：config 语义正确（96元/kg+100g进位）；UI 单位文案已修正为「96元/KG · 100g进位」（OzonCalc.jsx）；adapter 中 `rateUnit:'per100g'` 仅作 calcShipping 内部分支标志并加注释说明 | — | — | 关闭 |
| TD-18 | `vite.config.js` 数据同步层仍写死 `D:/ozon/市场分析`、`D:/ozon/市场分析/persisted-data.json` 绝对路径（T0 只处理了 server.js/config.js 与 Python 端） | `ozon-react/vite.config.js` | 中：换机器/换盘后 React dev 数据同步失效 | 单独任务：改为环境变量 OZON_DATA_DIR + 相对回退（不做，仅登记） |

---

## 处理纪律

- 处理任何条目 = 新开分支（`fix/td-N-xxx`），不与其他任务混在一个 commit。
- 处理 TD-1/TD-2/TD-3 前必须读 `BUSINESS_RULES.md`，改动后 `npm test` 全绿 + 需求方确认。
- 处理完成后在 `CHANGELOG.md` 记录，并把该行从本表移除。
