# 前端结构与页面资产现状清单 (FRONTEND_INVENTORY.md)

> Codex 复核标记（2026-09-21）：本文保留为 Gemini 原始交付，含未采纳的结论，不能直接作为实施合同。以 APPROVED_BASELINE.md 与 REVIEW-REVISION-001.md 的校正事实和限定验收范围为准；尤其不得沿用旧报告路径、核算只读结论或浏览器全通过结论。

> 审计任务：KJ-GEMINI-20260921-004 (Revision 001)  
> 审计时间：2026-09-21  
> 证据级别说明：  
> - `[源码确认]`：基于本地仓库代码静态查阅并引证文件名与行号  
> - `[本地运行]`：本地真实执行命令，生成持久化测试日志并记录退出码  
> - `[待合成验证]`：基于逻辑推测或代码静态路径分析，尚未在运行时独立复现  
> - `[未知]`：未执行远端访问、无凭据或环境未连接，严格保持未知

---

## 1. 路由与全局导航机制

### 1.1 状态驱动的单页伪路由 `[源码确认]`
- **代码位置**：[`ozon-react/src/App.jsx:93-401`](file:///D:/ozon/ozon-react/src/App.jsx#L93-L401)
- **核心实现与事实**：
  - 应用没有引入 `react-router-dom`，全站导航完全由 `App.jsx` 中的单例状态 `const [activeNode, setActiveNode] = useState('n1')` 控制。
  - 页面跳转通过组件回调（如 `onNodeSelect={(nodeId) => setActiveNode(nodeId)}`）传递，深层组件需要层层透传 `setActiveNode`。
  - **URL 深度链接缺失**：页面刷新后无法根据浏览器 URL Path 或 Hash 恢复特定页面或项目详情页，刷新将重置为初始状态（默认 `n1` 或工作台）。
  - **项目详情跳转**：通过 `openProjectDetail(projectId)` 显式设置 `activeProjectId` 并切换 `activeNode = '__t6_project_detail__'`，无法分享直达特定项目 URL。

### 1.2 主导航结构 (Sidebar.jsx) `[源码确认]`
- **代码位置**：[`ozon-react/src/components/Sidebar.jsx:22-90`](file:///D:/ozon/ozon-react/src/components/Sidebar.jsx#L22-L90)
- **导航分区**（8 大业务域与已有入口）：
  1. `workspace` (工作台)：`__progress_overview__` (ProgressOverview)
  2. `market` (市场机会)：`__market_intelligence__` (MarketIntelligenceApp), `__market_reports__` (MarketReportCenter)
  3. `selection` (选品与立项)：`__t6_candidates__` (CandidatePoolPage)
  4. `goods` (商品项目)：`__t6_projects__` (ProjectListPage), `n5` (商品档案 - ProductDefinition)
  5. `logistics` (成本与物流)：`n39` (WB核算 - WBCalc), `__fbp_calc__` (FBP核算 - OzonFbpCalc), `n8` (成本报价 - CostQuote)
  6. `listing` (Listing与上架)：`n14` (Listing工作台 - ListingContent)
  7. `operations` (运营与复盘)：`n4` (Ozon运营 - OzonCalc)
  8. `system` (系统与数据)：`__market_datahub__` (DataHubView)
- **辅助区与历史入口**：底部保留「项目执行进度（36节点工作流）」折叠面板及数据源文件切换面板。**所有历史入口在重构策划中全部保持可用，禁止自动归档为只读或删除**。
- **移动端适配**：顶部下拉框 [`App.jsx:434-510`](file:///D:/ozon/ozon-react/src/App.jsx#L434-L510)，屏幕 `< 1024px` 时隐藏 Sidebar，以 `<select id="mobile-node-select">` 进行扁平选择。

---

## 2. 完整页面与视图资产清单

| 页面标识 / Node ID | 对应组件及代码位置 | 关键用户操作 | 数据读取/保存位置 | 证据等级 | 真实状态与已知边界 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **工作台**<br>`__progress_overview__` | `ProgressOverview.jsx`<br>[`ozon-react/src/components/ProgressOverview.jsx:1-150`](file:///D:/ozon/ozon-react/src/components/ProgressOverview.jsx) | 查看工作区宏观指标、最近动态、快速跳转 | 读 `roadmap-statuses`<br>读 `node-updates` | `[源码确认]` | 统计卡片指标部分来自静态 mock 计算，未完全对齐 T6 实际项目数量。 |
| **流程总览**<br>`__project_flow__` | `ProjectFlow.jsx`<br>[`ozon-react/src/components/ProjectFlow.jsx:1-120`](file:///D:/ozon/ozon-react/src/components/ProjectFlow.jsx) | 查看 36 节点全局流转、编辑流转备注 | 读写 `ozon_project_flow`<br>读写 `ozon_flow_notes` | `[源码确认]` | 属于旧单品线性工作流视图，保留可用，不强制删除。 |
| **俄罗斯市场情报**<br>`__market_intelligence__` | `MarketIntelligenceApp.jsx`<br>[`ozon-react/src/components/marketIntelligence/MarketIntelligenceApp.jsx:1-260`](file:///D:/ozon/ozon-react/src/components/marketIntelligence/MarketIntelligenceApp.jsx) | 切换 6 大视图 (Overview/Radar/Niches/Keywords/Validation/DataHub)；打开利基抽屉 | 读静态 JSON `runs/RUN-*/`；<br>写 `mi_validation_overrides`；<br>写 `mi_manual_procurement_quotes`；<br>推送到 `t6Store` | `[源码确认]` | 依赖构建生成的静态批次 JSON。数据中心提供批次状态、diff 报告查看与回滚接口。 |
| **利基详情抽屉**<br>(Context Drawer) | `NicheDetailDrawer.jsx`<br>[`ozon-react/src/components/marketIntelligence/components/NicheDetailDrawer.jsx:1-380`](file:///D:/ozon/ozon-react/src/components/marketIntelligence/components/NicheDetailDrawer.jsx) | 查看利基 GMV/竞争/趋势；录入 Phase 5 采购报价；推流到候选池；打开纯度网关 | 读写 `mi_manual_procurement_quotes`；<br>调用 `t6Store.ensureCandidate` | `[源码确认]` | 包含 6 个固定业务 Tab（Summary, Trend, Pricing, Competition, Purity Gateway, Sourcing）。 |
| **市场报告中心**<br>`__market_reports__` | `MarketReportCenter.jsx`<br>[`ozon-react/src/components/reports/MarketReportCenter.jsx:1-302`](file:///D:/ozon/ozon-react/src/components/reports/MarketReportCenter.jsx) | 浏览 24 份品类研报；查看 HTML 报告；上传导入新源文件；发布并备份报告 JSON | 读写 `market-report-sources` (源文件)<br>读写 `market-report-json` (生成报告)<br>读 `generated/` 静态报告索引<br>通过 `<iframe>` 渲染历史 HTML 报告 | `[源码确认]` | **勘误**：该组件**不使用 jspdf / html2canvas**，不存在导出截断问题；完整支持源文件备份与生成报告回载。 |
| **选品候选池**<br>`__t6_candidates__` | `CandidatePoolPage.jsx`<br>[`ozon-react/src/components/t6/CandidatePoolPage.jsx:1-320`](file:///D:/ozon/ozon-react/src/components/t6/CandidatePoolPage.jsx) | 浏览候选商品；筛选品类/评分/状态；查看快照；打开一键立项弹窗 | 读写 `t6.candidate.*`<br>读写 `t6.snapshot.*`<br>调用 `createProject` | `[源码确认]` | 表格未做虚拟滚动。数据规模增长时的性能表现待使用合成数据集进行测量。 |
| **候选详情抽屉**<br>(Candidate Drawer) | `CandidateDetailDrawer.jsx`<br>[`ozon-react/src/components/t6/CandidateDetailDrawer.jsx:1-280`](file:///D:/ozon/ozon-react/src/components/t6/CandidateDetailDrawer.jsx) | 查看候选商品物理事实、市场线索、快照历史、采购报价 | 读 `t6.candidate.*`<br>读 `t6.snapshot.*` | `[源码确认]` | 抽屉展示候选的完整证据链，支持查看历史多份快照。 |
| **选品评分**<br>`__scoring__` | `ProductScoringSection.jsx`<br>[`ozon-react/src/components/dashboard/sections/ProductScoringSection.jsx:1-450`](file:///D:/ozon/ozon-react/src/components/dashboard/sections/ProductScoringSection.jsx) | 对上传的商品表格执行多维度打分 (A/B/C/D)；导出打分结果 | 读上传 Excel 数据；<br>计算纯函数，无持久化 | `[源码确认]` | 历史曾出现生产白屏（已修复为静态 import 并锁定）。表格未做虚拟化。 |
| **选品市场分析 (纯度)**<br>`__purity_analysis__` | `PurityPipelinePage.jsx`<br>[`ozon-react/src/components/PurityPipelinePage.jsx:1-580`](file:///D:/ozon/ozon-react/src/components/PurityPipelinePage.jsx) | 5 大品类规格解析、纯度过滤、价格带切分、信度校验 | 读上传 Excel；<br>内存状态 | `[源码确认]` | 仅支持固定 5 个品类的规则集，纯客户端计算。 |
| **SKU 项目列表**<br>`__t6_projects__` | `ProjectListPage.jsx`<br>[`ozon-react/src/components/t6/ProjectListPage.jsx:1-180`](file:///D:/ozon/ozon-react/src/components/t6/ProjectListPage.jsx) | 查看立项项目卡片；按阶段/生命周期筛选；点击进入详情 | 读 `t6.project.*`；<br>读 `t6.costScenario.*` | `[源码确认]` | 项目列表卡片呈现，支持生命周期与阶段聚合。 |
| **SKU 项目详情**<br>`__t6_project_detail__` | `ProjectDetailPage.jsx`<br>[`ozon-react/src/components/t6/ProjectDetailPage.jsx:1-637`](file:///D:/ozon/ozon-react/src/components/t6/ProjectDetailPage.jsx) | 总览/档案/供应链/合规/成本核算/推进阶段/查看日志 | 读写 `t6.project.*`；<br>读写 `t6.log.*`；<br>读写 `t6.costScenario.*` | `[源码确认]` | 包含 6 个 Tab。Tab 切换通过局部 `setTab` 驱动，切换 Tab 时不会触发 `window.beforeunload`。 |
| **商品档案编辑**<br>(Sub-panel) | `ProductProfileEditor.jsx`<br>[`ozon-react/src/components/t6/ProductProfileEditor.jsx:1-350`](file:///D:/ozon/ozon-react/src/components/t6/ProductProfileEditor.jsx) | 编辑尺寸、重量、材质、产地、包装规格 | 读写 `project.product` via `updateProjectProduct` | `[源码确认]` | 具备字段校验与保存提示。目前未与父级 Tab 联动未保存拦截。 |
| **项目合规面板**<br>(Sub-panel) | `ProjectCompliancePanel.jsx`<br>[`ozon-react/src/components/t6/ProjectCompliancePanel.jsx:1-1195`](file:///D:/ozon/ozon-react/src/components/t6/ProjectCompliancePanel.jsx) | Layer A 适用性评估；Layer B 合规计划；Layer C 结果凭证；新增/编辑合规事项 | 读写 `project.compliance` via `t6Store`；<br>草稿态维护在 `complianceDraftState.js` | `[源码确认]` | **草稿保护边界纠偏**：`beforeunload` 仅拦截浏览器刷新/关闭，**不拦截** React 内部 `setTab`；新增事项按钮通过；360-390px 窄屏表格可读性待优化。 |
| **项目供应链工作区**<br>(Sub-panel) | `ProjectSupplyChainPanel.jsx`<br>[`ozon-react/src/components/t6/ProjectSupplyChainPanel.jsx:1-680`](file:///D:/ozon/ozon-react/src/components/t6/ProjectSupplyChainPanel.jsx) | 维护供应商库；录入报价版本 (v1→v2)；跟踪样品打样；指定正式供应方案 | 读写 `t6.supplier.*`；<br>读写 `t6.supplierQuote.*`；<br>读写 `t6.sample.*` | `[源码确认]` | 报价版本不可变自增树；样品状态机流转受控；支持正式方案绑定与解绑。 |
| **Ozon 跨境核算**<br>`n4` | `OzonCalc.jsx`<br>[`ozon-react/src/components/OzonCalc.jsx:1-636`](file:///D:/ozon/ozon-react/src/components/OzonCalc.jsx) | 单品/多品/佣金表测算；支持项目上下文注入与采用供应报价 | 独立时读写 `shipping-calc-rfbs-v2`；<br>项目模式下仅内存计算并保存为 `CostScenario` | `[源码确认]` | **核算串扰纠偏**：`SingleTab` 129 行已显式通过 `if (!projectContext)` 阻止写回全局持久化键；项目模式读全局默认值作为 base 是有意的模板复用，未复现无条件串写。 |
| **WB 跨境核算**<br>`n39` | `WBCalc.jsx`<br>[`ozon-react/src/components/WBCalc.jsx:1-120`](file:///D:/ozon/ozon-react/src/components/WBCalc.jsx) | 6 个 Tab (计算器/运费表/SKU管理/订单结算/设置/反向赔偿) | 独立模式写 `wb_settings`, `wb_skus`, `wb_orders`；<br>项目模式由 `CalculatorTab` 接收上下文 | `[源码确认]` | 共享费率与用户偏好（如默认线路、汇率）由全局提供；项目测算保存为不可变 `CostScenario`，未证实存在意外串写。 |
| **FBP 边境仓核算**<br>`__fbp_calc__` | `OzonFbpCalc.jsx`<br>[`ozon-react/src/components/OzonFbpCalc.jsx:1-410`](file:///D:/ozon/ozon-react/src/components/OzonFbpCalc.jsx) | 边境仓头程、仓储、操作费、尾程全链路测算与线路推荐 | 读写 `ozon_fbp_params`；<br>读写 `ozon_fbp_history` | `[源码确认]` | 边境仓独立核算工具，保持独立可用。 |
| **Listing 工作台**<br>`n14` | `ListingContent.jsx`<br>[`ozon-react/src/components/ListingContent.jsx:1-480`](file:///D:/ozon/ozon-react/src/components/ListingContent.jsx) | 生成俄文标题、卖点、富文本描述、属性表格 | 读写 `ozon_listing_content` | `[源码确认]` | 保持独立可用。 |
| **历史单品档案与工具**<br>`n1, n5, n6, n8, n36` | `ProjectSetup.jsx`, `ProductDefinition.jsx`, `SupplyChain.jsx`, `CostQuote.jsx`, `FragrancePricing.jsx` | 历史单品业务表单与核算 | 读写各自历史 keys | `[源码确认]` | **全量保留可用**，重构方案不得强制删除或设为只读。 |

---

## 3. UI 设计系统与交互规范现状

- **基础设计系统**：无外部商业组件库，使用统一的 Tailwind CSS Morandi 调色板与 `lucide-react` 图标。
- **16 个标准 UI 原子组件**（`ozon-react/src/components/ui/`）：
  - `Surface`, `PageHeader`, `SectionHeader`, `Toolbar`, `Drawer`, `Button`, `IconButton`, `Select`, `SearchInput`, `Badge`, `StatusBadge`, `KpiStat`, `LoadingState`, `EmptyState`, `ErrorState`, `DataTable`。
- **重构原则**：沿用现有基础 UI 组件，不推倒新建一套新组件库；样式严格限制在 `.fyzsxnb-workspace` / `body.fyzsxnb-kuajing-page` 作用域内。
