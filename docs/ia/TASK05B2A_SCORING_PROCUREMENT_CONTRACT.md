# KUAIJING-IA-REFACTOR-V1 · TASK 05B-2A
## Candidate Scoring / Procurement 双能力接入前契约审计报告

> **审计性质**：只读代码契约审计。  
> **审计范围**：选品评分（`__scoring__`）与 Phase 5 人工采购验证（`ManualProcurementWorkbench`）的现有运行契约。  
> **实施纪律**：零业务代码修改、零 Tab 增加、零 Wrapper 引入、零 Snapshot 假造、零 Phase 5 数据搬移。

---

### 第一部分：选品评分系统（Scoring）真实契约审计

#### 一、Scoring 系统定位
在 [`ozon-react/src/App.jsx`](file:///d:/ozon/ozon-react/src/App.jsx#L249-L251) 中查找 `__scoring__` 节点：
* **Node**: `__scoring__`
* **Component**: `ProductScoringSection`
* **Component Path**: [`ozon-react/src/components/dashboard/sections/ProductScoringSection.jsx`](file:///d:/ozon/ozon-react/src/components/dashboard/sections/ProductScoringSection.jsx)
* **Current Props**: `{}`（无入参，以完整独立页面形式挂载，采用静态导入）

#### 二、Scoring 直接相关代码结构
1. **主编排组件**：[`ozon-react/src/components/dashboard/sections/ProductScoringSection.jsx`](file:///d:/ozon/ozon-react/src/components/dashboard/sections/ProductScoringSection.jsx)
2. **决策详情抽屉**：[`ozon-react/src/components/scoring/ScoringDetailDrawer.jsx`](file:///d:/ozon/ozon-react/src/components/scoring/ScoringDetailDrawer.jsx)
3. **表格展示组件**：[`ozon-react/src/components/scoring/ScoringTable.jsx`](file:///d:/ozon/ozon-react/src/components/scoring/ScoringTable.jsx)
4. **统计总览组件**：[`ozon-react/src/components/scoring/ScoringOverview.jsx`](file:///d:/ozon/ozon-react/src/components/scoring/ScoringOverview.jsx)
5. **筛选工具栏**：[`ozon-react/src/components/scoring/ScoringToolbar.jsx`](file:///d:/ozon/ozon-react/src/components/scoring/ScoringToolbar.jsx)
6. **数据适配层**：[`ozon-react/src/utils/scoring/scoringDataAdapter.js`](file:///d:/ozon/ozon-react/src/utils/scoring/scoringDataAdapter.js)
7. **数据中台快照**：[`ozon-react/src/utils/t6/t6Store.js`](file:///d:/ozon/ozon-react/src/utils/t6/t6Store.js)（`buildScoringSnapshot`、`createSnapshot`、`refreshCandidateSnapshot`）
8. **候选池消费端**：[`ozon-react/src/components/t6/CandidatePoolPage.jsx`](file:///d:/ozon/ozon-react/src/components/t6/CandidatePoolPage.jsx)（`handleAddOrRefresh`）

#### 三、Scoring 真正的分析对象
* **事实结论**：**B. `scoring_candidates.json` 中的 canonical product**。
* 评分引擎 `scoreProduct` 和适配层 `scoreAllCandidates` 不接收抽象的 Candidate 或 Opportunity，而是必须消费具备完备物理/运营指标的 canonical 商品对象（含 `price_rub`, `sales_rub_28d`, `units_28d`, `conv_rate`, `cart_add_rate`, `reviews`, `weight_kg`, `dims`, `ship_mode`, `category_leaf` 等 20+ 字段）。

#### 四、Scoring 真实数据链
```text
静态数据文件 (public/data/scoring_candidates.json & bsr_market_benchmarks.json)
↓
ProductScoringSection (fetch 获取 cDoc.candidates & bDoc)
↓
scoreAllCandidates({ candidates, benchmark, rules, rubPerCny }) (scoringDataAdapter.js)
  ├─ buildBsrIndex / buildCandidatePool / makeCelChannels / fillLogisticsPools
  ├─ matchType(c.category_leaf, index)
  ├─ buildMarketContext(m, index)
  ├─ scoreProduct(c, ctx, deps, rules) (scoringEngine.js)
  └─ buildExplanations(c, r, ctx) (explanations.js)
↓
ScoredProduct[] (内存数组：含 index, name, leaf, totalScore, grade, decision, dimensions, supplyGap, etc.)
↓
用户在评分工作台点击 [加入候选] 或 [创建项目]
↓
buildScoringSnapshot({ scored: row, canonical: candidates[row.index], ... }) (t6Store.js)
↓
createSnapshot(payload) (t6Store.js 生成不可变快照，写入 t6.snapshot.{uuid})
↓
refreshCandidateSnapshot(candidate.id, snap.id) (更新 Candidate.latestSnapshotId)
```

#### 五、sourceProductId 对拍审计
| 项目 | 当前源码事实 |
| :--- | :--- |
| **Candidate key** | `candidate.sourceProductId`（MI 推进候选为 `wb-niche-${uid}`；静态候选为数字字符串如 `1390458672`） |
| **Scoring dataset key** | `scoring_candidates.json` 中的 `c.source_product_id`（纯数字字符串） |
| **Lookup function** | `CandidatePoolPage.jsx` 中 `scoredByProductId.get(String(cand.sourceProductId))` |
| **Match condition** | `String(candidate.source_product_id) === String(cand.sourceProductId)` |
| **MI Candidate 是否能命中** | **NO**（MI 候选前缀带 `wb-niche-`，静态数据全为纯数字，绝对无法命中） |

#### 六、MI Candidate 为什么无法刷新评分
在 `CandidatePoolPage.jsx` 的 `handleAddOrRefresh(cand)` 中：
1. **查什么 Map**：`scoredByProductId`（由 `scoring_candidates.json` 全量打分后按 `c.source_product_id` 构建的 `Map`）。
2. **用什么 key**：`String(cand.sourceProductId)`。
3. **为什么不命中**：MI Candidate 的 `sourceProductId` 形如 `wb-niche-wb_niche_d0198d600bed`，而在 `scoring_candidates.json` 中不存在任何 `wb-niche-` 开头的商品记录。
4. **不命中时提示什么**：页面直接调用 `flush('未找到该商品的当前评分数据')`，阻断快照生成与刷新流程。

#### 七、Scoring 当前是否支持“单 Candidate 输入”
* `Scoring` 主组件（`ProductScoringSection`）是否接受：
  * `candidateId`: **NO**
  * `candidate`: **NO**
  * `canonical`: **NO**
  * `sourceProductId`: **NO**
* 说明：主组件接收 `props = {}`，是全局数据集全量加载编排组件。

#### 八、ScoringDetailDrawer 契约
* **Props**: `{ row, open, onClose, onAddCandidate, onCreateProject }`
* **输入对象**: `row`（必须是已完成打分的 `ScoredProduct` 实例）
* **是否只读**: 界面展示只读，但底部包含 [加入候选] 与 [创建项目] 两个副作用动作
* **是否执行评分**: **NO**（直接渲染已计算完毕的 `row.dimensions`, `row.supplyGap`, `row.strengths` 等）
* **是否创建 Snapshot**: **NO**（本身不创建，依赖回调 `onAddCandidate(row)` 由父组件创建）
* **是否依赖全局列表**: **YES**（依赖父组件传递的 `scored.find(r => r.index === selectedIndex)`）
* **是否适合直接放 Candidate Drawer**: **NO**（自身根元素即为 `<Drawer width={440}>`，会引发嵌套抽屉冲突；且输入必须是 `ScoredProduct`，无法在未评分前渲染）

#### 九、Scoring 主页面嵌入适应性分类
* 页面包含：`ScoringPageHeader`、`ScoringOverview`（多卡片 KPI）、`ScoringToolbar`（6 组筛选器）、`ScoringTable`（1000 行虚拟滚动大表格）与自身 `ScoringDetailDrawer`。
* **架构分类**：**GATEWAY_ONLY**（页面体积大、自带复杂全局上下文，仅适合作为独立工作台通过导航到达）。

#### 十、严格区分两套评分体系
* **市场机会评分（MI）**：`MOS`（利基机会分）、`PFS`（潜力拟合分），属于宏观市场供求、品类蓝海程度指标。
* **商品评分（T4/T6 Scoring）**：多维微观指标综合评分（包含利润模型、物流运费、竞品分布、BSR 拟合度与供应缺口等）。
* **铁律**：**严禁将 MOS/PFS 伪装或映射为 T6 商品评分**。

#### 十一、Snapshot 硬门禁条件
* **输入要求**：必须提供完整 `scored` 结构、`canonical` 原始商品对象、`benchmarkDoc`、`rules`。
* **candidateId 是否必须**：必须（用于绑定快照所有权）。
* **sourceProductId 是否必须一致**：**必须一致**（`refreshCandidateSnapshot` 强校验 `String(snap.sourceProductId) === String(rec.sourceProductId)`，不一致直接抛错）。
* **canonical 是否必须存在**：**必须存在**（用于填充快照中的 20+ 项 `sourceInputs`）。
* **benchmark 是否必须存在**：必须存在（提供基准元数据与版本）。
* **判定**：MI Candidate 在缺 canonical product 时：**`CANNOT_CREATE_VALID_SNAPSHOT`**。

---

### 第二部分：Phase 5 人工采购验证（Procurement）真实契约审计

#### 十二、ManualProcurementWorkbench 定位
* **组件路径**：[`ozon-react/src/components/marketIntelligence/components/ManualProcurementWorkbench.jsx`](file:///d:/ozon/ozon-react/src/components/marketIntelligence/components/ManualProcurementWorkbench.jsx)
* **Current Props**:
  ```javascript
  { niche, isOpen, onClose, onNavigateToWbCalc, onPromoted }
  ```
* **父组件**: [`ozon-react/src/components/marketIntelligence/MarketIntelligenceApp.jsx`](file:///d:/ozon/ozon-react/src/components/marketIntelligence/MarketIntelligenceApp.jsx)
* **当前调用位置**: `MarketIntelligenceApp.jsx` 根部（第 315-323 行），由 `procurementTarget` 状态驱动显隐。

#### 十三、Phase 5 绑定的业务对象
* **事实结论**：**Niche / Validation Item**。
* 接收的是 Market Intelligence 中的利基单品（包含 `name`, `cat`, `price`, `buyout`, `specs`, `heavy`, `eac`）。

#### 十四、Procurement 数据链路
```text
Niche / Validation Item (选品雷达/验证池单品)
↓
打开采购工作台 (MarketIntelligenceApp 中 setProcurementTarget(niche))
↓
useEffect 读取 getManualQuotes()[niche.name]，恢复之前保存的报价与 4 级可信度状态
↓
填写表单 (供应商、1688 链接、出厂价、MOQ、净重、包装尺寸、头程、国际物流、零售价、扣点、资质状态)
↓
保存草稿 (handleSaveDraft → saveManualQuote(niche.name, quoteData))
↓
Persistence (写入 localStorage/持久化 mi_manual_procurement_quotes，并记录 mi_audit_log)
↓
重新打开恢复 (按 niche.name 读取持久化缓存回填表单)
```

#### 十五、Phase 5 持久化 Key 审计
* **Persistence Key**: `'mi_manual_procurement_quotes'`
* **Store/API**: [`ozon-react/src/utils/marketIntelligence/miStore.js`](file:///d:/ozon/ozon-react/src/utils/marketIntelligence/miStore.js)（`getManualQuotes`、`saveManualQuote`）
* **Entity Key**: **`niche.name`**（**NAME_KEYED**）
  * *代码细节*：虽然 `miStore.js` 的 `saveManualQuote` 方法内写了 `if (nicheUid) all[nicheUid] = entry`，但 `ManualProcurementWorkbench.jsx` 第 105 行调用时传入的是 `saveManualQuote(niche.name, ...)`（传入的是字符串而不是对象），导致 `typeof nicheIdentifier === 'string'`，因此 `nicheUid` 始终为 `null`。实际数据完全按 `niche.name` 存储与索引。

#### 十六、Phase 5 数据 Schema（真实字段清单）
* `supplierName`: string（供应商/厂家名称）
* `supplierUrl`: string（1688 商品/店铺链接）
* `factoryPriceCny`: number（出厂含税单价 RMB）
* `moq`: number（首批建议起订量）
* `weightG`: number（单件实测净重 g）
* `dims`: string（外包装尺寸，形如 `'20x15x5'`）
* `domesticFreightCny`: number（国内头程运费 RMB/件）
* `internationalFreightCny`: number（国际跨境物流 RMB/件）
* `targetPriceRub`: number（计划在售零售价 RUB）
* `commissionRatePct`: number（WB 平台扣点/佣金率 %）
* `priceProvenance`: string（`'ESTIMATED'` | `'SUPPLIER_CONFIRMED'`）
* `specProvenance`: string（`'ESTIMATED'` | `'SUPPLIER_CONFIRMED'` | `'LOGISTICS_CONFIRMED'`）
* `freightProvenance`: string（`'ESTIMATED'` | `'LOGISTICS_CONFIRMED'`）
* `regulationProvenance`: string（`'ESTIMATED'` | `'REGULATION_VERIFIED'`）
* `overallTrustTier`: string（`'ESTIMATED'` | `'SUPPLIER_CONFIRMED'` | `'LOGISTICS_CONFIRMED'` | `'REGULATION_VERIFIED'`）
* `netProfitCny`: number（单件贡献毛利 RMB）
* `marginPct`: number（净毛利率 %）
* *(系统元数据)*: `uid`, `name`, `updatedAt`

#### 十七、Procurement 是否 UID-aware
* **结论**：**UID_AWARE = NO (`NAME_KEYED`)**。
* `ManualProcurementWorkbench.jsx` 内部读取与存储均强制基于 `niche.name`。

#### 十八、Procurement 与 Candidate 当前关系
* **关系判断**：**PARTIAL**。
* Candidate 仅能通过 `quotes[candidate.candidateName]` 弱关联尝试读取；若利基发生重命名或候选名称不一致，关联立刻断裂。

#### 十九、当前 Notes 拼接行为核查
在 `ManualProcurementWorkbench.jsx` 的 `handlePromote()` 中：
```javascript
const trustPrefix = `[数据可信度: ${overallTrustTier}] 价格:... | 重量:... | 物流:... | 认证:...`
promoteToT6Candidate(niche, `${trustPrefix}。采购报价: ¥${factoryPriceCny}, 供应商: ${supplierName || '待填'}, 实测重: ${weightG}g, 预估毛利率: ${marginPct.toFixed(1)}%`)
```
进入 `miStore.js` 后被拼接到 `candidate.notes` 字符串中。

| Phase 5 字段 | Phase 5 原数据 | Candidate 独立字段 | Candidate notes 拼接状态 |
| :--- | :--- | :---: | :--- |
| `supplierName` | string (供应商) | **无** | 拼入字符串（`供应商: ...`） |
| `supplierUrl` | string (1688链接) | **无** | **完全丢失** |
| `factoryPriceCny` | number (出厂价) | **无** | 拼入字符串（`采购报价: ¥...`） |
| `moq` | number (起订量) | **无** | **完全丢失** |
| `weightG` | number (实测净重) | 仅利基推算重在 `marketEvidence.weightG` | 拼入字符串（`实测重: ...g`） |
| `dims` | string (外包装尺寸) | **无** | **完全丢失** |
| `domesticFreightCny`| number (国内头程) | **无** | **完全丢失** |
| `internationalFreightCny`| number (国际物流) | **无** | **完全丢失** |
| `targetPriceRub` | number (计划售价) | **无** | **完全丢失** |
| `commissionRatePct` | number (佣金率) | **无** | **完全丢失** |
| `priceProvenance` | string (价格可信度) | **无** | 拼入字符串（`价格: ...`） |
| `specProvenance` | string (规格可信度) | **无** | 拼入字符串（`重量: ...`） |
| `freightProvenance` | string (物流可信度) | **无** | 拼入字符串（`物流: ...`） |
| `regulationProvenance`| string (合规可信度) | **无** | 拼入字符串（`认证: ...`） |
| `overallTrustTier` | string (综合可信度) | **无** | 拼入字符串（`[数据可信度: ...]`） |
| `netProfitCny` | number (贡献毛利) | **无** | **完全丢失** |
| `marginPct` | number (净毛利率) | **无** | 拼入字符串（`预估毛利率: ...%`） |

#### 二十、零正则反解原则
* **契约冻结**：Candidate Detail 绝对禁止通过正则表达式从 `notes` 逆向反解提取 Phase 5 采购数据。
* 采购验证必须直连真实的 `miStore` 持久化数据。

#### 二十一、ManualProcurementWorkbench 嵌入可行性与 Nested Drawer 风险
* **UI 结构**：组件直接渲染 `<Drawer isOpen={isOpen} onClose={onClose} title={...} width="max-w-2xl">`。
* **Nested Drawer 风险**：**`NESTED_DRAWER_RISK = YES`**。若在 `CandidateDetailDrawer`（本身是 620px Drawer）内部嵌入，会导致双重 Drawer 重叠与蒙层交互冲突。
* **架构分类**：**GATEWAY_ONLY**（或需重构抽离纯表单视图的 `WRAPPER_REQUIRED`）。

#### 二十二、Procurement 写操作与对 Candidate 的影响
| Action | Function | Persistence | Candidate 是否受影响 |
| :--- | :--- | :--- | :---: |
| **保存采购草稿** | `handleSaveDraft` | 写入 `mi_manual_procurement_quotes` + `mi_audit_log` | **否**（Candidate 实体完全不受影响） |
| **推送候选立项** | `handlePromote` | 写入 `t6Store` Candidate + 报价持久化 | **是**（若已存在则更新 marketEvidence，不存在则新建 Candidate） |
| **调整可信度标签** | 本地 `setXxxProvenance` | 仅本地 state（保存草稿后入库） | **否** |
| **跳转 WB 费率精算**| `onNavigateToWbCalc(niche)` | 保存草稿后触发外层导航至 `n39` | **否** |

#### 二十三、Procurement 对 Niche 字段的依赖
* `name`: 必须（用于表单标题、持久化索引键）
* `cat / category`: 必须（类目展示）
* `price`: 必须（WB 均价展示、计划售价默认值）
* `buyout`: 必须（签收率展示）
* `specs.weight_g`: 必须（初始预估重量）
* `specs.dims`: 必须（初始预估包装尺寸）
* `specs.eac / eac`: 必须（认证状态与合规分级）
* `heavy`: 必须（无重量时用于大件兜底 2500g / 350g）

#### 二十四、Candidate 还原 Niche 能力对拍
| Procurement 需要 | Candidate 是否具备 | 存放字段 |
| :--- | :---: | :--- |
| `name` | **YES** | `candidate.candidateName` |
| `uid` | **YES** | `candidate.source_niche_uid` / `marketEvidence.nicheUid` |
| `cat / category` | **YES** | `candidate.categoryLeaf` / `candidate.categoryFull` |
| `runId` | **YES** | `candidate.source_run_id` / `marketEvidence.runId` |
| `price` | **YES** | `candidate.marketEvidence?.price`（缺失 marketEvidence 则为空） |
| `weight_g` | **PARTIAL** | `candidate.marketEvidence?.weightG`（无 specs 包装层） |
| `dims` | **NO** | **缺失**（未进入 marketEvidence） |
| `eac` | **PARTIAL** | `candidate.marketEvidence?.eacStatus`（无 specs 包装层） |
| `heavy` | **YES** | `candidate.marketEvidence?.heavy` |
| `raw Niche` | **NO** | **缺失**（禁止在 Candidate 存入原始 Niche，存在 `CONTEXT_GAP`） |

#### 二十五、采购验证的真实事实源
* **真实事实源**：**MI Phase5 Persistence (`mi_manual_procurement_quotes`)**。
* 当前 Candidate 与 Project 均未承载采购报价原生结构字段，禁止无授权新建 `procurementStore`。

---

### 第三部分：决策矩阵与架构评估

#### 二十六、Scoring Decision Matrix
| 方案 | 当前代码可行性 | 事实风险 |
| :--- | :---: | :--- |
| **直接嵌整个 Scoring 页面** | `NOT_SUPPORTED` | 页面为全屏容器，包含多层筛选器与千行大表格；不接受单候选入参；强绑定静态文件。 |
| **复用 ScoringDetailDrawer** | `NOT_SUPPORTED` | 自身为 Drawer 引起嵌套冲突；必须输入已打分的 `ScoredProduct`；包含冗余动作按钮。 |
| **Candidate → Scoring Gateway** | `SUPPORTED` | 零侵入解耦，支持通过 `onOpenNode('__scoring__')` 跳转；需提示暂不支持单一 SKU 预筛选。 |
| **Candidate 内直接生成 Snapshot** | `NOT_SUPPORTED` | MI Candidate 缺少 20+ 项微观 canonical 指标；`refreshCandidateSnapshot` 强校验失败。 |

#### 二十七、Procurement Decision Matrix
| 方案 | 当前代码可行性 | 事实风险 |
| :--- | :---: | :--- |
| **直接嵌 ManualProcurementWorkbench** | `NOT_SUPPORTED` | 自身为 `<Drawer width="max-w-2xl">`，产生 Nested Drawer 严重交互破坏；包含向 T6 重复推流按钮。 |
| **Wrapper 传 Candidate Context** | `PARTIAL` | 需重构剥离其 Drawer 外壳为纯表单视图；需通过 Adapter 拼凑伪 Niche；持久化键仍为 `name`。 |
| **Candidate → Phase5 Gateway** | `SUPPORTED` | 零代码侵入既有工作台；无嵌套抽屉风险；支持直接导航至 MI 工作台或在 Tab 中做只读展示。 |
| **复制 Phase5 数据到 Candidate** | `NOT_SUPPORTED` | 破坏单一事实源；需破坏性改动 T6 Schema V1 增加十余个字段；容易产生双向不同步。 |

#### 二十八、Candidate Detail 目标位置与安全边界
* **未来架构目标**：6 个业务 Tab（概览、市场依据、选品评分、采购验证、风险与合规、决策记录）。
* **本轮纪律**：**绝对不修改 `CandidateDetailDrawer.jsx`**，本轮仅做接入前契约审计。
* **Navigation Gateway 确认**：系统具备成熟的 `onOpenNode` 模式，可安全跳转至 `__scoring__` 或 `__market_intelligence__`。
* **立项 Gate 冻结**：05C 正式立项流程持续冻结，严禁提前处理 `createProject`。

---

### 第四部分：文档勘误与 CONTRACT SUMMARY

#### 二十九、05B-1 Documentation Cross-check
经与当前代码交叉核验，05B-1 实施报告中存在以下 5 处笔误（代码实现完全正确且类型安全，无需返工）：
1. 报告写 `candidate.name` → 源码实际为 `candidate.candidateName`
2. 报告写 `candidate.leafCategory` → 源码实际为 `candidate.categoryLeaf`
3. 报告写 `snapshot.totalScore` → 源码实际为 `snapshot.scoreResult.totalScore`
4. 报告写 `snapshot.grade` → 源码实际为 `snapshot.scoreResult.grade`
5. 报告写 `log.operator` → 源码实际为 `log.by`（默认 `'user'`）

#### 三十、CONTRACT SUMMARY

```text
SCORING

Scoring Node:                  __scoring__
Scoring Root Component:        ProductScoringSection
Scoring Primary Object:        scoring_candidates.json canonical product
Canonical Dataset:             public/data/scoring_candidates.json
Canonical Key:                 c.source_product_id (numeric string)
Candidate Lookup Key:          candidate.sourceProductId
MI Candidate Match:            NO (wb-niche-xxx vs numeric ID, non-overlapping namespace)
Single Candidate Input:        NO (ProductScoringSection accepts no props)
Snapshot Requirements:         ScoredProduct + canonical (20+ fields) + benchmarkDoc + rules
Scoring Detail Reusable:       NO (renders <Drawer>, requires pre-calculated ScoredProduct)
Standalone Safe:               YES (runs independently on static JSON)
Recommended Integration Class: GATEWAY_REQUIRED


PROCUREMENT

Component:                     ManualProcurementWorkbench
Current Props:                 { niche, isOpen, onClose, onNavigateToWbCalc, onPromoted }
Primary Object:                MI Niche / Validation Item
Persistence Key:               mi_manual_procurement_quotes
Persistence Entity Key:        niche.name (NAME_KEYED)
UID Aware:                     NO (Workbench passes niche.name string to saveManualQuote)
Main Fields:                   supplierName, supplierUrl, factoryPriceCny, moq, weightG, dims,
                               domesticFreightCny, internationalFreightCny, targetPriceRub,
                               commissionRatePct, priceProvenance, specProvenance, freightProvenance,
                               regulationProvenance, overallTrustTier, netProfitCny, marginPct
Candidate Link:                PARTIAL (only brittle name match via candidate.candidateName)
Candidate Context Coverage:    PARTIAL (has price, weightG, heavy; lacks dims, raw specs)
Nested Drawer Risk:            YES (renders Drawer max-w-2xl)
Standalone Safe:               YES (driven by niche + local persistence)
Recommended Integration Class: GATEWAY_REQUIRED
```

---

### 第五部分：核心架构 GAP 汇总

* **S1 — SCORING IDENTITY GAP**  
  Candidate 的 `sourceProductId` 在 MI 候选为 `wb-niche-${uid}`（如 `wb-niche-wb_niche_d0198d600bed`），而评分数据集 `scoring_candidates.json` 中的 `source_product_id` 为纯数字字符串（如 `1390458672`）或静态编号。两者处于完全不相交的命名空间，无法建立身份映射。

* **S2 — SNAPSHOT INPUT GAP**  
  `buildScoringSnapshot` 强依赖包含 20+ 个指标字段（点击率、加购率、退货率、广告占比、尺寸三维、BSR 对应 benchmark 等）的完整 canonical product 对象；MI Candidate 仅具备利基宏观证据（MOS、PFS、GMV、在售卖家等），缺乏单品微观指标，无法满足 Snapshot 门禁。

* **P1 — PROCUREMENT IDENTITY GAP**  
  `ManualProcurementWorkbench` 虽在底层的 `saveManualQuote` 中有条件支持 `uid`，但调用时固定传递 `niche.name`，持久化数据完全以 `niche.name` 为 key 索引（NAME_KEYED）。Candidate 若发生重命名或名称不精确匹配，将丢失关联。

* **P2 — PROCUREMENT CONTEXT GAP**  
  `ManualProcurementWorkbench` 依赖 `specs.dims`、`specs.weight_g`、`specs.eac` 等结构化利基上下文；Candidate 虽有 `marketEvidence`，但字段被扁平化且部分规格（如包装三维尺寸）未入库，无法完全无损还原工作台所需的原始上下文对象。
