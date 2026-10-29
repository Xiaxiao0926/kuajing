# KUAIJING-IA-REFACTOR-V1 · TASK 07A-3A-R

## Project Product V1 数据契约审计与语义修订规范 (Contract Revision)

> 本文档为 TASK 07A-3A 的语义修订版本（07A-3A-R）：针对 `ManualProcurementWorkbench` 实测重量语义冲突、Current vs Target Project 业务粒度、Procurement Evidence 真实冻结字段、以及 Compliance/Listing 的非当前运行时消费性质进行关键语义纠偏，确立最小、安全、无污染的 `Project Product Profile V1` 契约，为 TASK 07A-3B 实施提供精准依据。
> 
> **本任务零生产代码修改，仅修订本契约文档。**

---

### 一、Current vs Target Project 业务粒度与实体架构

通过对 `t6Store.js`、`CandidatePoolPage.jsx`、`ProjectListPage.jsx`、`docs/ia/CURRENT_TO_TARGET_MAPPING.md` 与 `TARGET_ROUTE_MATRIX.md` 的综合审计，明确区分当前实现事实与未来架构目标：

1. **当前实现粒度（Current Implementation Fact）**：
   - **`CURRENT_PROJECT_GRANULARITY = ONE_SKU_PROJECT`**。
   - 候选池（`CandidatePoolPage.jsx:127-130`）支持 1 个 Candidate 创建多个 SKU 项目（“该候选已有关联项目。如确需创建另一个 SKU 项目，请再次点击确认”）。
   - 当前系统的 `SkuProject` 在运行时即代表单 SKU 工作单元（如测试用例 `'家用手套-黑色10mil'`、`'家用手套-橙色10mil'`）。
2. **目标架构粒度（Target IA Architecture）**：
   - **`TARGET_PROJECT_GRANULARITY = PROJECT_TO_N_SKUS_OR_FAMILY`**。
   - 依据 Target IA（`CURRENT_TO_TARGET_MAPPING.md` §1.1），“4. 商品项目 (Product Projects)”规划包含“SKU 项目”与“商品档案”；未来架构预留了 Project 作为产品系列（Product Family）并统管多个 SKU 的演进空间。
3. **正式 SKU 实体存在性决策**：
   - **`CURRENT_FORMAL_SKU_ENTITY = NONE`**。全局 `T6_PREFIX` 仅有 `candidate`, `project`, `snapshot`, `log`, `costScenario`, `supplier`, `supplierQuote`, `sample`。
   - **`V1_SEPARATE_SKU_ENTITY = NO`**。
   - **架构过渡策略**：V1 阶段将 `project.product` 作为 **Project Product Profile（项目商品档案）** 承载单 SKU 档案，作为过渡模型；**严禁声称这是最终的多 SKU 模型**，也**严禁称其为 Global Product Master**。

---

### 二、当前 project.product 状态审计

对 `ozon-react/src/utils/t6/t6Store.js` 及全仓引用的审计结果：

1. **初始化值**：`t6Store.js:371` 在 `createProject` 时初始化为字面量空对象：`product: {}`。
2. **读取者（Current Readers）**：**零读取**。全仓目前没有任何业务组件或引擎读取 `project.product.*`。
3. **写入者（Current Writers）**：**零写入**。全仓无任何代码向 `project.product` 写入属性。
4. **Store API**：**`PRODUCT_MUTATION_API = NONE`**。`t6Store.js` 缺失针对 `product` 的更新、校验与补丁接口。
5. **UI 状态**：`ProjectDetailPage.jsx:540` 在 `tab === 'product'` 时仅呈现静态占位文案：`PLACEHOLDERS.product = '产品定义域将在后续版本接入'`。
6. **Gate 关联**：`gateEngine.js` 中所有阶段的 checks 均未检查 `product`（`GATE = NONE`）。
7. **审计结论**：**`PROJECT_PRODUCT_STATUS = EMPTY_CONTAINER`**。

---

### 三、两类立项 Snapshot 的商品与采购事实审计

#### 1. SCORING Snapshot (`buildScoringSnapshot`)
- **`snapshot.sourceInputs` 实际冻结字段**：
  - `name`: 参考商品名（来自爬虫/候选 `canonical.name` 或 `scored.name`）
  - `price_rub`: 参考市场价（₽）
  - `avg_price_rub`: 类目均价（₽）
  - `weight_kg`: 标称重量（kg），来自 BSR 爬虫原始记录
  - `dims`: 标称尺寸数组 `[L, W, H]`，来自 BSR 爬虫原始记录
  - `category_leaf`: 叶子类目
  - `category_full`: 全路径类目
  - `commission_fbs`, `commission_fbo`, `commission_rfbs`, `commission_fbp`: 各模式佣金参考
  - 运营历史参考：`sales_rub_28d`, `units_28d`, `conv_rate`, `reviews`, `gross_margin`, `ship_mode` 等
  - **特征**：无出厂价、无材质、无型号、无品牌、无区分净重与毛重。

#### 2. MARKET_VALIDATION Snapshot (`buildMarketValidationSnapshotPayload`)
- **商品物理事实 (`sourceInputs`)**：
  - `name`: 候选名称 (`candidate.candidateName`)
  - `price_rub`: 目标售价 (`quote.targetPriceRub`)
  - `weight_kg`: 换算重量 (`quote.weightG / 1000`)
  - `dims`: 结构化外包装尺寸 `[L, W, H]` (cm)
  - `category_leaf`, `category_full`: 类目名称
- **真实采购证据 (`procurementEvidence`)**：
  源码（`candidateProjectEvidence.js:235`）通过 `JSON.parse(JSON.stringify(quote))` 冻结 Phase 5 Quote 对象。
  **真实存在字段**（依据 `ManualProcurementWorkbench.jsx:105-123` 与 `miStore.js:232-237`）：
  - `supplierName`: 供应商名称
  - `supplierUrl`: 供应商链接 (注：字段名确为 `supplierUrl`，不存在 `supplierLink` 或 `sourceUrl`)
  - `factoryPriceCny`: 采购出厂价（¥）
  - `moq`: 起订量
  - `weightG`: 实测重量（g）
  - `dims`: 外包装长宽高尺寸（如 `"20x15x10"`）
  - `domesticFreightCny`, `internationalFreightCny`: 运费预估
  - `targetPriceRub`: 目标售价（₽）
  - `commissionRatePct`: 预估佣金率（%）
  - `priceProvenance`, `specProvenance`, `freightProvenance`, `regulationProvenance`: 数据可信度来源
  - `overallTrustTier`, `netProfitCny`, `marginPct`: 效益摘要
  - `uid`, `name`, `updatedAt`: 利基与时间戳标识
  *(注：真实 Quote Schema 中**不存在** `notes` 字段)*。
- **市场事实 (`marketEvidence`)**：
  - `nicheUid`, `mos`, `pfs`, `gmv`, `growth`, `buyout`, `sellers`, `price`, `monopolyIndex`, `risks` 等。

---

### 四、重量与尺寸物理口径关键纠偏

#### 1. 重量口径（Weight Semantics）：冲突与未决
- **MARKET_VALIDATION `weightG` 语义冲突**：
  - **UI 标签**：`ManualProcurementWorkbench.jsx:259` 明确写着：`<label className="text-morandi-text-light">单件实测净重 (g)</label>`；
  - **来源选项 (Provenance)**：提供 `ESTIMATED` (预估)、`SUPPLIER_CONFIRMED` (样品实测)、`LOGISTICS_CONFIRMED` (物流仓实测)；
  - **计算用途**：同一组件（line 276）执行 `setInternationalFreightCny(Math.max(8, Math.round((w / 1000) * 35)))`，拿它参与跨境运费测算。
  - **核心纠偏**：
    **`CURRENT_CALCULATION_USAGE`（用于算运费）≠ `PHYSICAL_SEMANTICS`（物理含义）**！
    该字段目前存在“UI 标签叫净重，但来源包含物流仓实测且用于算运费”的内在语义矛盾。
    结论：**`MARKET_VALIDATION_WEIGHT_SEMANTICS = CONFLICTED`**。
    **严禁将其武断定义为 `GROSS_SHIPPING_WEIGHT_G`，严禁将其自动预填为 Product 的 `grossWeightG`**（否则对于枕头、轻泡棉等包装重量差异大的品类会造成严重物流数据污染）。
- **SCORING `weight_kg` 语义未决**：
  - 爬虫采集自 Ozon 前台页面，未区分净重与包装毛重。
  - 结论：**`SCORING_WEIGHT_SEMANTICS_UNRESOLVED`**。
- **长期治理方案**：
  **`WEIGHT_MODEL_REQUIRES_SOURCE_SEMANTIC_CLEANUP`**。未来需在采购/打样工作台显式拆分为 `netWeightG`（裸机净重）与 `grossWeightG`（含包装物流毛重），本轮暂不改动 Phase 5。

#### 2. 尺寸口径（Dimension Semantics）：确认与未决
- **MARKET_VALIDATION `dims` 语义明确**：
  - `ManualProcurementWorkbench.jsx:284` 明确标注为：`外包装尺寸 (长x宽x高 cm)`；
  - 经 `parseProcurementDims` 解析为 `[L, W, H]` (cm)。
  - 结论：**`MARKET_VALIDATION_DIMS = PACKAGE_DIMS_CM (CONFIRMED)`**。
- **SCORING `dims` 语义未决**：
  - 爬虫采集原始数组，未标明是裸机本体还是包装外径。
  - 结论：**`SCORING_DIMS_SEMANTICS_UNRESOLVED`**。

---

### 五、Product 与 Snapshot 的职责与状态边界

```text
Creation Snapshot (不可变时点事实)
        ↓  (一键初始化草稿 one-time prefill)
project.product (当前有效 SKU 档案 Project Product Profile)
```

- **事实边界**：
  - `Snapshot` = 立项时点证据切片（**Immutable Frozen Point**），永久冻结立项时刻原貌，用于审计与回溯；
  - `project.product` = 项目生命周期内**当前有效 SKU 档案（Mutable Current State）**，由运营团队在选品、打样后持续维护。
- **操作铁律**：
  - **允许**：创建项目时（或首次打开产品面板时），从 Creation Snapshot 提取基础事实一次性预填 `project.product`；
  - **禁止**：修改 `project.product` 绝不回写 Snapshot；
  - **禁止**：每次打开页面自动从 Snapshot 覆盖 `project.product`；
  - **禁止**：SupplierQuote 更新或重新核算时自动静默同步 `project.product`。

---

### 六、成本场景、供应链与 Product 的边界

1. **成本核算工具边界**：
   - 售价（`price` / `sellerRevenueRub`）、采购价（`purchaseCost` / `costRmb`）、佣金率（`commission` / `commissionRate`）、广告费率、汇率、代理费、利润与毛利率均属于 **`CostScenario` 商业测算与平台费率参数，严禁搬入 `project.product`**。
   - `snapshot.sourceInputs.price_rub` 与 `commission_rfbs` 仅为历史参考值，绝不能成为 `project.product.currentPrice`。
2. **T7 供应链边界**：
   - `SupplierQuote` 中的 `unitPriceCny`, `moq`, `exw`, `fob`, `toolingFeeCny`, `sampleFeeCny`, `leadTimeDays`, `paymentTerms`, `packagingSpec` 均为特定供应商合作条款，属于供应链事实；
   - `project.supply` 仅为选定供应方案指针 (`{ supplierId, quoteId }`)；
   - `SampleRecord` 测试后确认的重量与尺寸，属于 Product 的 **`POSSIBLE_UPDATE_SOURCE`**，未来由人工比对确认后录入，严禁系统自动回写。

---

### 七、Current vs Future/Reference Consumers 边界明确

必须严谨区分“当前运行时真实消费者”与“静态指南/未来规划需求”：

1. **Compliance 域消费属性**：
   - `ComplianceAssessment.jsx` 当前无 `projectId`，亦未消费 `project.product`；
   - 品名、品类、材质、型号、用途等需求来源于合规方法论指南（`roadmap.js:n9/n10`），属于 **`REFERENCE_REQUIREMENT / FUTURE_CONSUMER`**，不能表述为当前消费者。
   - 合规自产结果（EAC 证书号、DoC 声明、风险等级）严禁塞入 Product。
2. **Listing 域消费属性**：
   - `ListingContent.jsx` 当前是静态货架文案规范，未接入运行时项目数据；
   - 品牌、品类、型号、材质、尺寸、变体等需求属于 **`REFERENCE_GUIDE_REQUIREMENT / FUTURE_CONSUMER`**。
   - 营销文案（俄语标题、五点卖点、SEO 词、图片视频）严禁塞入 Product。
3. **Costing 域消费属性**：
   - `costScenarioAdapter.js` 目前直接从 Snapshot 提取预填数据；
   - 未来将 `project.product` 作为预填源，属于首个候选的直接运行时消费者。

---

### 八、TARGET DOMAIN OWNERSHIP（目标领域归属矩阵）

> **说明**：本表表达各业务概念在 Kuaijing 整体架构中的**目标领域归属（Target Domain Ownership）**，而非当前运行时数据消费关系。

| Field / Concept | Snapshot | Product | SupplierQuote | CostScenario | Listing | Compliance | 目标领域判定 |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Name (中文品名)** | REFERENCE | **OWNER** | NOT_OWNER | REFERENCE | REFERENCE | REFERENCE | Product 拥有官方中文标准品名 |
| **Category (品类)** | REFERENCE | **OWNER** | NOT_OWNER | NOT_OWNER | REFERENCE | REFERENCE | Product 拥有业务正式分类 |
| **Brand (品牌)** | NOT_OWNER | **OWNER** | NOT_OWNER | NOT_OWNER | REFERENCE | REFERENCE | Product 拥有商品品牌属性 |
| **Model (型号)** | NOT_OWNER | **OWNER** | NOT_OWNER | NOT_OWNER | REFERENCE | REFERENCE | Product 拥有规格型号 |
| **Material (材质)** | NOT_OWNER | **OWNER** | NOT_OWNER | NOT_OWNER | REFERENCE | REFERENCE | Product 拥有产品物理材质 |
| **Variant Label (变体说明)** | NOT_OWNER | **OWNER** | NOT_OWNER | NOT_OWNER | REFERENCE | NOT_OWNER | Product 拥有当前 SKU 变体标识 |
| **Net Weight (净重)** | NOT_OWNER | **OWNER** | NOT_OWNER | NOT_OWNER | REFERENCE | NOT_OWNER | Product 拥有裸机净重 |
| **Gross Weight (毛重)** | REFERENCE | **OWNER** | NOT_OWNER | REFERENCE | REFERENCE | NOT_OWNER | Product 拥有含包装物流毛重 |
| **Product Dims (裸机尺寸)** | NOT_OWNER | **OWNER** | NOT_OWNER | NOT_OWNER | REFERENCE | NOT_OWNER | Product 拥有裸机本体尺寸 |
| **Package Dims (包装尺寸)** | REFERENCE | **OWNER** | NOT_OWNER | REFERENCE | REFERENCE | NOT_OWNER | Product 拥有外包装尺寸 |
| **Barcode (条码/EAN)** | NOT_OWNER | **OWNER** | NOT_OWNER | NOT_OWNER | REFERENCE | NOT_OWNER | Product 拥有商品标准条码 |
| **Supplier (供应商信息)** | REFERENCE | NOT_OWNER | **OWNER** | NOT_OWNER | NOT_OWNER | NOT_OWNER | Supplier 实体拥有 |
| **Purchase Price (出厂价)** | REFERENCE | NOT_OWNER | **OWNER** | REFERENCE | NOT_OWNER | NOT_OWNER | SupplierQuote 实体拥有 |
| **MOQ (起订量)** | NOT_OWNER | NOT_OWNER | **OWNER** | NOT_OWNER | NOT_OWNER | NOT_OWNER | SupplierQuote 实体拥有 |
| **Target Selling Price (售价)**| REFERENCE | NOT_OWNER | NOT_OWNER | **OWNER** | NOT_OWNER | NOT_OWNER | CostScenario 拥有商业售价假设 |
| **Commission Rate (佣金率)** | REFERENCE | NOT_OWNER | NOT_OWNER | **OWNER** | NOT_OWNER | NOT_OWNER | CostScenario / Config 拥有 |
| **Freight (国际物流费)** | NOT_OWNER | NOT_OWNER | NOT_OWNER | **OWNER** | NOT_OWNER | NOT_OWNER | CostScenario 引擎输出拥有 |
| **Listing Title (俄语标题)** | NOT_OWNER | NOT_OWNER | NOT_OWNER | NOT_OWNER | **OWNER** | NOT_OWNER | Listing 域拥有营销文案 |
| **Bullet Points (五点描述)** | NOT_OWNER | NOT_OWNER | NOT_OWNER | NOT_OWNER | **OWNER** | NOT_OWNER | Listing 域拥有营销文案 |
| **Certification (认证/DoC)** | NOT_OWNER | NOT_OWNER | NOT_OWNER | NOT_OWNER | NOT_OWNER | **OWNER** | Compliance 域拥有认证结论 |

---

### 九、Corrected Initialization Matrix（修正后的初始化矩阵）

| Product Field | SCORING 初始化来源 | MARKET_VALIDATION 初始化来源 | Safe Auto-prefill? | 转换规则与说明 |
| :--- | :--- | :--- | :---: | :--- |
| `nameZh` | `sourceInputs.name` | `sourceInputs.name` (`candidateName`) | **YES** | 作为初始草稿预填，可手工重命名 |
| `categoryLeaf` | `sourceInputs.category_leaf` | `sourceInputs.category_leaf` | **YES** | 作为初始草稿预填 |
| `packageDimsCm` | `sourceInputs.dims` | `procurementEvidence.dims` (已解析数组) | **YES (MV) / REVIEW_REQUIRED (Scoring)** | MV 外包装尺寸明确可安全预填；Scoring 语义未决，需标记复核 |
| `grossWeightG` | `sourceInputs.weight_kg * 1000` | `procurementEvidence.weightG` | **REVIEW_REQUIRED** | **严禁自动预填**！MV 存在净重/物流重语义冲突，Scoring 未决，待人工确认 |
| `netWeightG` | 空 (`null`) | `procurementEvidence.weightG` | **REVIEW_REQUIRED** | **严禁自动预填**！来源语义冲突，待人工确认 |
| `productDimsCm` | 空 (`null`) | 空 (`null`) | **NO** | Snapshot 均无裸机本体尺寸 |
| `variantLabel` | 空 (`''`) | 空 (`''`) | **NO (MANUAL ONLY)** | **严禁从项目名自动字符串猜测**，必须由人工输入 |
| `nameRu` | 空 (`''`) | 空 (`''`) | **NO** | 待人工录入 |
| `brand` | 空 (`''`) | 空 (`''`) | **NO** | 待人工录入 |
| `model` | 空 (`''`) | 空 (`''`) | **NO** | 待人工录入 |
| `material` | 空 (`''`) | 空 (`''`) | **NO** | 待人工录入 |
| `barcode` | 空 (`''`) | 空 (`''`) | **NO** | 待打样/贴标阶段录入 |

---

### 十、Corrected Product V1 Proposal

> **PROPOSED — NOT IMPLEMENTED**（作为 TASK 07A-3B 实施设计目标，本轮不修改代码）

#### 1. REQUIRED_CORE 严格判定标准
字段进入 REQUIRED_CORE 必须**同时满足**以下 4 条硬约束：
1. **生命周期明确需要**；
2. **不是其它域的已有事实源**；
3. **与单一 Project/SKU 稳定对应**；
4. **语义在事实源中已经完全明确（SEMANTICS_CONFIRMED）**。

因此：
- `grossWeightG` 与 `netWeightG` 因来源语义冲突/未决，**绝不能进入 REQUIRED_CORE**！
- 仅 `nameZh` 与 `categoryLeaf` 满足全部 4 项约束，构成 V1 最小必填身份核心。

#### 2. Proposal 分组与字段定义
```javascript
// project.product V1 数据模型草案
const proposedProductProfileSchema = {
  // === A. REQUIRED_CORE (基础身份核心，语义确定) ===
  nameZh: '高压发泡胶枪',              // string, 必填: 内部中文标准品名
  categoryLeaf: '发泡胶枪',            // string, 必填: 业务叶子类目

  // === B. OPTIONAL_CORE (规格、物理参数与合规/Listing 属性) ===
  packageDimsCm: [25, 15, 8],          // [number, number, number]|null, 可选: 外包装尺寸 (长宽高 cm)
  grossWeightG: null,                  // number|null, 可选: 含包装毛重 (g), 待人工核实确认
  netWeightG: null,                    // number|null, 可选: 裸机净重 (g), 待人工核实确认
  productDimsCm: null,                 // [number, number, number]|null, 可选: 裸机本体尺寸 (cm)
  variantLabel: '',                    // string, 可选: 规格/变体标识（人工输入，如 "黑色加强版"）
  nameRu: '',                          // string, 可选: 俄语参考品名（非营销文案）
  brand: '',                           // string, 可选: 品牌名称
  model: '',                           // string, 可选: 产品型号/款号
  material: '',                        // string, 可选: 主要材质/成分
  barcode: '',                         // string, 可选: 标准商品条码 (EAN-13 等)

  // === C. DEFERRED (延期至后续阶段) ===
  // hsCode, originCountry, shelfLifeDays, platformSkus (ozonSkuId, wbNmId), 多 SKU 容器
}
```

| Proposed Field | Group | Meaning | Initial Source | Current Consumer | Future/Reference Consumer |
| :--- | :---: | :--- | :--- | :--- | :--- |
| `nameZh` | REQUIRED | 内部中文标准品名 | Snapshot.sourceInputs.name (One-time) | CostScenario Prefill | Supply, Listing, Compliance |
| `categoryLeaf` | REQUIRED | 业务分类/叶子类目 | Snapshot.sourceInputs.category_leaf (One-time) | None | Costing, Listing, Compliance |
| `packageDimsCm` | OPTIONAL | 外包装尺寸 (cm) | MV.dims (Safe Prefill) / Scoring.dims (Review) | CostScenario Prefill | Listing (参数图) |
| `grossWeightG` | OPTIONAL | 含包装毛重 (g) | Review Required (人工确认) | None | CostScenario, Supply, Listing |
| `netWeightG` | OPTIONAL | 裸机净重 (g) | Review Required (人工确认) | None | Listing (参数展示) |
| `productDimsCm` | OPTIONAL | 裸机尺寸 (cm) | None (手工录入/样品确认) | None | Listing (规格展示) |
| `variantLabel` | OPTIONAL | 变体规格标签 | MANUAL ONLY (人工录入，不猜字符串) | None | Supply, Listing, Operations |
| `nameRu` | OPTIONAL | 俄语参考品名 | None (人工录入) | None | Listing, Compliance |
| `brand` | OPTIONAL | 品牌名称 | None (人工录入) | None | Listing, Compliance |
| `model` | OPTIONAL | 产品型号/款号 | None (人工录入) | None | Compliance, Supply, Listing |
| `material` | OPTIONAL | 主体材质/成分 | None (人工录入) | None | Compliance, Listing |
| `barcode` | OPTIONAL | 商品条码 (EAN-13) | None (打样/贴标阶段维护) | None | Operations, Listing |

---

### 十一、Multi-SKU Compatibility（多 SKU 演进兼容性）

- **结论**：**`MULTI_SKU COMPATIBILITY: COMPATIBLE_AS_TRANSITION`**。
- **依据与演进路径**：
  1. 当前 `project.product` 作为挂载在 `SkuProject` 上的独立 Profile 对象存在，没有污染全局数据表；
  2. 当未来系统根据 Target IA 演进为 `Project → N SKUs`（产品系列包含多个子 SKU）时，现有的 `project.product` 可平滑映射为该项目的“默认 SKU”或“首个 SKU”，无需进行侵入式破坏性重构；
  3. 当前模型严格将 `product` 限制在 `project` 上下文内，不会对未来引入独立的 SKU 表造成结构性阻塞。

---

### 十二、P1 ~ P6 GAP 事实诊断

- **P1 — PRODUCT IDENTITY GAP**：
  `project.product` 至今为空容器 `{}`。项目缺少标准品名、品牌、型号、材质等基本身份，下游模块缺少统一定义基础。
- **P2 — WEIGHT SEMANTICS GAP**：
  - **SCORING**：`UNRESOLVED`（爬虫数据未标明毛净重）；
  - **MARKET_VALIDATION**：`CONFLICTED`（UI 明确标注“单件实测净重”，但同时支持物流实测并参与国际物流费计算）。
- **P3 — DIMENSION SEMANTICS GAP**：
  - **SCORING**：`UNRESOLVED`（爬虫数据未标明裸机还是包装尺寸）；
  - **MARKET_VALIDATION**：`PACKAGE_DIMS_CM CONFIRMED`（界面与代码明确为外包装长宽高尺寸）。
- **P4 — VARIANT GAP**：
  系统当前采用 `1 Candidate → N Projects` 隐式表达变体（`IMPLICIT_BY_PROJECT`），无结构化变体属性支持；变体说明 `variantLabel` 需人工录入，禁止通过字符串猜测提取。
- **P5 — PRODUCT MUTATION/AUDIT GAP**：
  `t6Store.js` 缺失针对 `project.product` 的任何更新接口、校验机制与 DecisionLog 审计记录机制。
- **P6 — PLATFORM ID GAP**：
  系统目前完全没有 Ozon SKU ID、WB nmId、条形码（EAN/Barcode）的持久化字段，无法在上线后直接映射电商平台真实资产。

---

### 十三、CONTRACT SUMMARY

```text
PROJECT PRODUCT

Current Project Granularity: ONE_SKU_PROJECT
Target Project Granularity: PROJECT_TO_N_SKUS_OR_FAMILY
Formal SKU Entity: CURRENT_FORMAL_SKU_ENTITY = NONE (V1_SEPARATE_SKU_ENTITY = NO)
project.product Status: EMPTY_CONTAINER
Product Mutation API: NONE
Product Audit: NONE
Product Versioning Model: RECOMMENDED_STATE_MODEL (Mutable Profile on Project + DecisionLog Audit)
Product Profile Naming: Project Product Profile (NOT Product Master)

IDENTITY

Project Name Role: 项目人类可读识别与工作台标题 (可含变体后缀)
Product Name Role: 内部中文标准商品档案品名 (nameZh)
Category Role: 业务正式分类归属 (categoryLeaf)
Variant Model: IMPLICIT_BY_PROJECT (一项目一 SKU；variantLabel 手工录入，严禁猜字符串)
Barcode: OPTIONAL_CORE (待上线/贴标阶段维护)
Platform IDs: DEFERRED (上线后映射，不入 V1 Product Profile)

PHYSICAL FACTS

Scoring Weight Semantics: SCORING_WEIGHT_SEMANTICS_UNRESOLVED
Market Validation Weight Semantics: MARKET_VALIDATION_WEIGHT_SEMANTICS = CONFLICTED (UI says net weight; provenance/usage treats as logistics freight weight)
Weight Cleanup Requirement: WEIGHT_MODEL_REQUIRES_SOURCE_SEMANTIC_CLEANUP
Scoring Dims Semantics: SCORING_DIMS_SEMANTICS_UNRESOLVED
Market Validation Dims Semantics: PACKAGE_DIMS_CM CONFIRMED

OWNERSHIP

Target Domain Ownership: TARGET DOMAIN OWNERSHIP (not current runtime consumption)
Supplier Commercial Terms: SupplierQuote OWNER (unitPrice, moq, exw, fob, packagingSpec)
Cost Assumptions: CostScenario OWNER (targetPrice, commission, freight, profit)
Listing Copy: Listing OWNER (titleRu, bullets, descRu, seo, media)
Compliance Results: Compliance OWNER (eacStatus, certificateNo, DoC)

INITIALIZATION

Scoring Snapshot Auto-prefill: YES for nameZh / categoryLeaf; REVIEW_REQUIRED for packageDimsCm; REVIEW_REQUIRED for weight
Market Validation Auto-prefill: YES for nameZh / categoryLeaf; YES for packageDimsCm; REVIEW_REQUIRED for weight (严禁自动映射 grossWeightG)
Continuous Sync: FORBIDDEN (一次性初始化草稿，独立维护，绝不自动回写或反向覆写)

LEGACY

ProductDefinition Role: KEEP_AS_REFERENCE_GUIDE (方法论参考指南，不充当数据编辑器)
Consumers Role: REFERENCE_REQUIREMENT / FUTURE_CONSUMER (非当前运行时消费者)

PROPOSAL

V1 Required Fields: nameZh, categoryLeaf (语义完全明确)
V1 Optional Fields: packageDimsCm, grossWeightG (Review Required), netWeightG (Review Required), productDimsCm, variantLabel (Manual), nameRu, brand, model, material, barcode
V1 Deferred Fields: hsCode, originCountry, shelfLifeDays, platformSkus

COMPATIBILITY

Multi-SKU Compatibility: COMPATIBLE_AS_TRANSITION

NEXT

07A-3B Scope:
  1. t6Store.js 增加 updateProjectProduct(projectId, patch, { by, reason })
  2. Snapshot 一次性初始化草稿 helper (initProjectProductDraft: 仅预填 nameZh, categoryLeaf, 以及 MV 的 packageDimsCm)
  3. 严禁实现将 MV weightG 自动映射为 required grossWeightG 的逻辑
  4. ProjectDetailPage.jsx product Tab 实现真正的 ProductProfileEditor
  5. 写入 product_update 决策日志
  6. 字段白名单与数值范围严格校验 (Fail-close)
```

---

### 十四、Revised 07A-3B Scope

在修正了重量语义冲突与字段依赖后，下一实施任务 TASK 07A-3B 的边界锁定为：
1. **Store API**：在 `t6Store.js` 增加 `updateProjectProduct(projectId, patch, { by, reason })`，仅允许修改白名单字段（`nameZh`, `categoryLeaf`, `packageDimsCm`, `grossWeightG`, `netWeightG`, `productDimsCm`, `variantLabel`, `nameRu`, `brand`, `model`, `material`, `barcode`）；
2. **安全一次性初始化**：
   - `nameZh` ← `snapshot.sourceInputs.name`
   - `categoryLeaf` ← `snapshot.sourceInputs.category_leaf`
   - `packageDimsCm` ← 仅当 snapshotKind 为 `MARKET_VALIDATION` 时从 `procurementEvidence.dims` 安全带入；若为 `SCORING` 则标记待复核；
   - **重量字段一律不自动填充**，留给人工核实；
3. **审计日志**：每次更新向 `project.decisionLog` 写入 `product_update` 日志；
4. **UI 编辑器**：在 `ProjectDetailPage.jsx` 的 `tab === 'product'` 处实现 `ProductProfileEditor`，替换占位文本；
5. **严禁事项**：
   - 严禁把 `grossWeightG` 设为必填项；
   - 严禁将 Phase 5 `weightG` 自动塞入 `grossWeightG`；
   - 严禁自动从项目名解析变体标签；
   - 严禁改动任何 Snapshot、SupplierQuote 或 CostScenario 数据。

---

### 十五、测试

已运行全部指定自动化验证：
```text
node tests/ia-project-supply-gate.test.mjs       ✅ 24/24 PASS
node tests/ia-project-supply-chain-ui.test.mjs   ✅ 26/26 PASS
npm run test:t6                                  ✅ 130/130 PASS
npm test                                         ✅ React 65 + Python 44 + Golden 56 PASS
npm run test:sync                                ✅ 双端对拍零差异 PASS
```

---

### 十六、Git Status

- **本轮零生产代码改动，零测试代码修改**；
- 仅修订契约文档：`docs/ia/TASK07A3A_PROJECT_PRODUCT_CONTRACT.md`。
