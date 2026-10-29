# KUAIJING-IA-REFACTOR-V1 · TASK 03 实施记录

## 一、任务目标与实施原则

本阶段为 **TASK 03：左侧导航结构重组与旧 Node 零破坏兼容**。
严格执行以下纪律：
1. **只改导航与最小必要路由别名**：重组左侧导航与移动端下拉，增加 `__market_datahub__` 别名跳转。
2. **零破坏兼容**：保留所有旧 Node（`n1`~`n39`、`__project_flow__`、`__node_overview__`、`__scoring__`、`__purity_analysis__` 等）的渲染与状态映射，不破坏任何页面现有跳转链路。
3. **零业务代码修改**：不修改 Store、不改核算公式、不改 Market Intelligence Pipeline、不改业务组件内部实现。

---

## 二、目标导航结构落地对照

| # | 一级业务域 | 渲染类型 | 包含入口 ID | 导航标签 | 挂载组件 / 视图 |
|---|---|---|---|---|---|
| 1 | **工作台** | 直达按钮 (`directItem`) | `__progress_overview__` | 工作台 | `<ProgressOverview />` |
| 2 | **市场机会** | 折叠分组 | `__market_intelligence__`<br>`__market_reports__` | 俄罗斯市场情报<br>市场报告 | `<MarketIntelligenceApp />`<br>`<MarketReportCenter />` |
| 3 | **选品与立项** | 折叠分组 | `__t6_candidates__` | 候选池 | `<CandidatePoolPage />` |
| 4 | **商品项目** | 折叠分组 | `__t6_projects__`<br>`n5` | SKU 项目<br>商品档案 | `<ProjectListPage />`<br>`<ProductDefinition />` |
| 5 | **成本与物流** | 折叠分组 | `n39`<br>`__fbp_calc__`<br>`n8` | WB 核算<br>FBP 核算<br>成本报价 | `<WBCalc />`<br>`<OzonFbpCalc />`<br>`<CostQuote />` |
| 6 | **Listing 与上架** | 折叠分组 | `n14` | Listing 工作台 | `<ListingContent />` |
| 7 | **运营与复盘** | 折叠分组 | `n4` | Ozon 运营 | `<OzonCalc />` |
| 8 | **系统与数据** | 折叠分组 | `__market_datahub__` | 数据中心 | `<MarketIntelligenceApp initialView="datahub" />` |

---

## 三、旧节点兼容与隐藏策略

1. **原 36 节点项目流程（Phase 1~6）**：
   - 完整保留在 `Sidebar.jsx` 底部的「项目执行进度 (36)」折叠抽屉中，点击即可展开查看各个节点完成状态与快速跳转。
   - 保留 WorkspaceTopbar 上的「项目流程」跳转按钮（`onOpenProgress={() => handleNodeSelect('__project_flow__')}`）。
   - 保留 `renderContent()` 中对所有旧节点（`n1`, `n2`, `n4`, `n5`, `n6`, `n8`, `n9`, `n14`, `n36`, `n39` 等）的独立渲染分支。
2. **移动端下拉适配 (`mobile-node-select`)**：
   - 同步采用 8 大业务域 `<optgroup>` 组织结构。
   - 增加动态活跃节点 Fallback：若当前激活的是未列在主导航的旧节点（如 `n1`、`n2`、`n6`、`n9`、`__scoring__` 等），自动在底部渲染 `<optgroup label="历史 / 子页面">`，保证 `<select>` 状态始终受控且不会出现空白。
3. **数据中心别名 (`__market_datahub__`)**：
   - `MarketIntelligenceApp` 新增 `initialView` prop（默认 `'overview'`）。
   - 当以 `activeNode === '__market_datahub__'` 进入时，传入 `initialView="datahub"`，直接定位并渲染数据中心上传与版本管理视图。

---

## 四、修改文件清单

1. `ozon-react/src/components/Sidebar.jsx`
   - 将 `NAV_SECTIONS` 严格收敛为 8 大业务域与 12 个固定入口项。
   - 工作台配置为直达按钮样式（`directItem: true`），其余 7 个分组配置为可折叠分组（默认全部展开）。
   - 折叠窄轨图标导航（64px rail）同步映射 12 个入口。
   - 保留底部数据面板抽屉与 36 节点进度展开面板。
2. `ozon-react/src/components/marketIntelligence/MarketIntelligenceApp.jsx`
   - 组件入参增加 `initialView = 'overview'`。
   - 增加 `useEffect` 同步 `activeTab` 与 `initialView`。
3. `ozon-react/src/App.jsx`
   - `pageLabelForNode` 增加 `__market_datahub__` 标题映射（'数据中心'）。
   - `renderContent()` 增加 `activeNode === '__market_datahub__'` 渲染分支，调用 `<MarketIntelligenceApp initialView="datahub" />`。
   - 移动端 `<select id="mobile-node-select">` 重构为 8 大业务域结构，并添加 `PRIMARY_NAV_NODE_IDS` 校验与历史节点 fallback。
4. `tests/ia-navigation-acceptance.test.mjs` (新增)
   - 自动化断言：8 大业务域、12 个入口 ID 与 Label、底部 36 节点进度保留、App 渲染分支覆盖、移动端 select 结构及 fallback。

---

## 五、测试与验证结果

- `node tests/ia-navigation-acceptance.test.mjs`：**PASS**
- `npm test`：**PASS**（React wbEngine 65 项 + Python wb_test 31 项）
- `npm run test:sync`：**PASS**（双端边界重量与费率对拍全绿）
- `npm run build`：**PASS**（Vite 构建无报错，产物正常生成）
