# KUAIJING-IA-REFACTOR-V1 · TASK 06 — Context Bar 上下文贯通 · 实施报告

- **Task ID**: `KUAIJING-IA-REFACTOR-V1-06`
- **执行日期**: 2026-11-03
- **执行人**: GLM-5.3（Lead；巡查盘点由独立只读子体完成）
- **状态**: `implemented`（本地实现，测试全绿；未部署）
- **参考设计**: `docs/ia/TARGET_ROUTE_MATRIX.md` §4（双模式调度协议）与 §10 步骤 6

---

## 1. 目标与实现方式

「用户从项目详情跳往 WB 核算（n39）、Ozon 核算（n4）等页面时，顶栏保留当前上下文并自动预填，避免手工重复录入」。

实现采用**最小接线**方案：`OzonCalc` / `WBCalc` 早已支持 `projectContext` prop（T6-2B1/2B2 已在项目详情内嵌模式使用），缺的只是 App 层的上下文状态与传递。**未新增任何数据模型，未触碰任何计算引擎。**

## 2. 改动文件（4 生产文件 + 1 测试 + 1 配置）

| # | 文件 | 改动 |
|---|---|---|
| 1 | `ozon-react/src/App.jsx` | 新增 `calcContext` 状态（platform/prefill/supplyCostReference）；`openCalcStandalone` 按平台路由 n4/n39 并注入 `projectContext`；`saveContextScenario` 从 t6Store **现取**项目数据冻结不可变场景（避免闭包快照漂移），成功后回项目详情；构造 `contextPill` 传 Topbar |
| 2 | `ozon-react/src/components/workspace/WorkspaceTopbar.jsx` | 新增可选 `contextPill` prop：上下文指示器（项目码+名称+平台），点击回项目详情，✕ 退出上下文回到独立模式；无上下文时零渲染、行为不变 |
| 3 | `ozon-react/src/components/t6/ProjectDetailPage.jsx` | 新增可选 `onOpenCalcStandalone` prop：「成本与物流」Tab 增加「独立页 Ozon/WB 核算」入口（ghost 按钮），prefill 复用与内嵌模式同一构建器（`buildOzonPrefill`/`buildWbPrefill`），携带 `supplyCostReference`；prop 缺失时不渲染（向后兼容） |
| 4 | `ozon-react/src/utils/t6/t6UiContract.test.mjs` | 新增 UI-7 防回归断言（FINDINGS 发现1 回归锁）：项目模式 base 全空、绝不读全局历史键、不写回共享持久化键、CalculatorTab 成本/售价/佣金显式置 `''` |
| 5 | `tests/ia-context-bar.test.mjs`（新建） | 26 项契约断言：状态/路由/退出处理器、n4/n39 项目模式接线、场景保存无闭包漂移、Topbar 指示器、独立页入口、范围红线（App 不直接 import 计算引擎） |
| 6 | `package.json` | `tests/ia-context-bar.test.mjs` 接入 `test:t6` 强制链 |

## 3. 行为契约

- **独立模式（无上下文）**：n4/n39 页面行为与此前**逐字节一致**（projectContext=null）。
- **项目模式（有上下文）**：预填经 `mergeTrustedPrefill`（''/null/undefined 不覆盖既有假设，UI-4/UI-7 契约）；保存场景前仍需人工勾选 `costConfirmed`；保存走 `createCostScenario` 冻结不可变快照。
- **范围红线**：未改 `wbEngine.js`/`ozonEngine.js`/`gateEngine.js` 等任何引擎；App 编排层不直接 import 计算引擎。

## 4. 验证

| 命令 | 结果 |
|---|---|
| `npm test`（全量，含 test:t6 新链） | exit 0，829 项断言标记全过 |
| `node tests/ia-context-bar.test.mjs` | 26 契约断言全过 |
| `node --experimental-vm-modules ozon-react/src/utils/t6/t6UiContract.test.mjs` | 33 通过 / 0 失败（含 UI-7 九项） |

## 5. 未做与后续

- `activeNicheUid` / `activeCandidateId`（市场机会/候选维度上下文）**未实现**：当前两域已在其容器内部完成上下文传递（NicheDetailDrawer / CandidateDetailDrawer），跨页漫游需求真实出现时再立项，避免为不存在的路径预建状态。
- Listing（n14）项目上下文预填未接（同上，ListingContent 尚无 projectContext 接口，待 Listing 域任务）。
- 生产部署未做（`production_authorized: false`）；上线后需人工抽验一条「项目详情 → 独立页核算 → 保存场景 → 回项目详情」链路。
