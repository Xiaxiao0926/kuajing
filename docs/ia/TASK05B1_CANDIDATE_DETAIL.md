# KUAIJING-IA-REFACTOR-V1 · TASK 05B-1 实施报告
## Candidate Detail 基础详情层与 Market Evidence 可视化

> **实施性质**：Candidate 统一只读详情层交付。  
> **实施边界**：仅将既有候选数据及市场证据可视化呈现；禁止嵌入评分、禁止嵌入采购验证、禁止处理立项 Gate。

---

### 一、Candidate Detail Drawer

* **组件路径**：[`ozon-react/src/components/t6/CandidateDetailDrawer.jsx`](file:///d:/ozon/ozon-react/src/components/t6/CandidateDetailDrawer.jsx)
* **抽屉契约**：复用公共基础组件 [`ozon-react/src/components/ui/Drawer.jsx`](file:///d:/ozon/ozon-react/src/components/ui/Drawer.jsx)，统一宽度为 `width={620}`。
* **数据读取契约**：严格只读调用 T6 Store Read API（`getCandidate(candidateId)`、`getSnapshot(candidate.latestSnapshotId)`、`listLogs()`），禁止直接读写 `localStorage`、`persist` 或发起任何网络请求。

---

### 二、四 Tab 业务架构

严格按规范固定 4 个业务 Tab：
1. **概览** (`overview`)
2. **市场依据** (`market`)
3. **风险与合规** (`risk`)
4. **决策记录** (`history`)

---

### 三、Market Evidence 市场依据展示

* **数据来源**：直接读取 `candidate.marketEvidence`。若不存在显示空状态文案“暂无结构化市场依据”。
* **展示字段**：
  * 核心指标：MOS、PFS、GMV、增长率、签收率、在售卖家数。
  * 规格状态：市场均价（无单位伪造）、预估单重（显式 `weightG g`）、大件标识（`heavy`）、MI 验证阶段（`verdict`）、最后同步时间（`syncedAt`）。
  * 来源追溯：来源系统（`source_system`）、来源批次（`source_run_id`）、利基 UID（`source_niche_uid`）、利基 ID（`source_niche_id`）、商品主键（`sourceProductId`）。
* **零清洗原则**：未进行汇率换算、未做单位猜测、未进行百分比除乘。

---

### 四、Risk / Compliance 风险与合规展示

* **风险标签**：结构化读取 `candidate.marketEvidence.risks` 数组渲染 Badge；若为空数组显示“暂无结构化风险标签”（绝不显示“无风险”）。
* **EAC 与资质认证**：真实展示 `marketEvidence.eacStatus` 与 `marketEvidence.certificationStatus` 原文字符串。
* **合规警告横幅**：固定展示合规边界提示：
  > 当前风险和认证状态来自最近一次 Market Intelligence 市场证据同步，仅用于候选判断；正式采购/上架前仍需按实际 SKU 进行合规确认。

---

### 五、Snapshot 评分状态展示与语义隔离

* **已有评分快照**：展示快照 ID，以及真实快照数据中的 `totalScore` 与 `grade`。
* **暂无评分快照（MI 候选常见形态）**：
  * 显示“暂无 T6 评分快照”警告徽标。
  * **语义隔离硬提示**：
    > Market Intelligence 的 MOS / PFS 属于市场机会分析指标，不等同于 T6 商品评分快照。
  * **绝对禁止伪造**：未将 `marketEvidence.mos` 或 `pfs` 伪装成 T6 评分。

---

### 六、Decision Logs 决策记录

* **过滤与排序**：读取 `listLogs()`，按 `subjectType === 'candidate' && subjectId === candidateId` 过滤，并按 `at` 时间戳倒序排列。
* **展示要素**：操作时间、动作类型 Label（`状态变化`、`市场证据同步`、`创建项目`、`评分刷新`、`评分快照`）、状态流转（`from → to`）、操作原因及操作人。

---

### 七、CandidatePool 详情入口改造

* **操作列改造**：在 [`CandidatePoolPage.jsx`](file:///d:/ozon/ozon-react/src/components/t6/CandidatePoolPage.jsx) 操作列现有 [刷新评分] 按钮前，新增带有 `Eye` 图标的 [详情] 按钮。
* **状态设计**：组件采用最小状态 `selectedCandidateId`（保存 ID 而非全量对象缓存）。点击触发 `setSelectedCandidateId(cand.id)`，关闭触发 `setSelectedCandidateId(null)`。
* **整行行为**：保持整行不可点击，不干扰负责人输入框与状态下拉选择。

---

### 八、明确未接入项（安全边界）

* **未嵌入评分**：`ProductScoringSection.jsx` 零修改、零导入。
* **未接入 Phase 5**：`ManualProcurementWorkbench.jsx` 零修改、零导入。
* **未处理立项 Gate**：未在详情中添加立项按钮，未解除缺少快照时的立项拦截，等待 TASK 05C。
* **未修改 Store**：`t6Store.js`、`miStore.js`、`candidateMarketBridge.js` 零改动。

---

### 九、测试套件验证结果

* **专项测试**：`node tests/ia-candidate-detail.test.mjs`（13 项测试全部通过，含抽屉存在性、组件引入、状态驱动、按钮保留、Read API 契约、4 Tab 结构、市场依据映射、风险标签与空状态、物理隔离、零文本反解析、语义隔离横幅、以及 MI 候选与静态候选双形态行为测试）。
* **全量回归**：
  * `node tests/ia-candidate-market-bridge.test.mjs`：15/15 通过
  * `node tests/ia-purity-gateway.test.mjs`：10/10 通过
  * `node tests/ia-opportunity-shell.test.mjs`：9/9 通过
  * `node tests/ia-market-research-embedded.test.mjs`：10/10 通过
  * `node tests/ia-navigation-acceptance.test.mjs`：8 域 12 项全部通过
  * `npm test`：129/129 全部通过
  * `npm run test:golden`：76/76 全部通过
  * `npm run test:sync`：双端对拍零差异
  * `npm run test:web-persistence`：全部通过
  * `npm --prefix ozon-react run build`：生产构建成功
