# TASK 04C-1: Purity Pipeline 代码契约与嵌入可行性审计报告

## 1. 组件入口契约

- **组件路径**: `ozon-react/src/components/PurityPipelinePage.jsx`
- **Export 类型**: `export default function PurityPipelinePage({ data })` (Default Export)
- **当前 Props**: `{ data }` (唯一定义的 prop，无其他入参)
- **默认 Props**: 无默认值
- **是否依赖父级传参**: 否。
  - 若父级未传 `data` 或为 null/空数组，组件展示初始空状态及 `FileSelector`（提示从静态热销文件列表中选择）；
  - 若父级传入 `data`，组件通过 `useEffect` 首次同步给 `rows`，并标记 `sourceLabel = '顶部/市场调研已上传数据'`。
- **Standalone Node**: `__purity_analysis__` (对应导航「选品市场分析」)
- **在 App.jsx 中的渲染方式**:
  ```jsx
  if (activeNode === '__purity_analysis__') {
    return (
      <Suspense fallback={<LazyFallback />}>
        <PurityPipelinePage data={data} />
      </Suspense>
    )
  }
  ```

---

## 2. 全部 State 契约清单

源码顶层 `useState` 完整清单（共 11 个状态）：

| State 变量名 | 初始值 | 类型 | 作用与生命周期 | 是否属于数据源 | 是否可受 Opportunity 影响 |
|---|---|---|---|---|---|
| `rows` | `null` | `Array<object> | null` | 存储待分析的原始行数据（来自 Excel 解析或 props.data） | 是 | **否**（必须为完整 Excel 行数组） |
| `sourceLabel` | `''` | `string` | 当前数据源名称（用于顶部概览展示） | 否 | **否** |
| `availableFiles` | `[]` | `Array<object>` | 可用热销 Excel 文件列表（从 manifest 与 serverFiles 合并） | 是 | **否** |
| `loadingFiles` | `false` | `boolean` | 拉取文件清单的异步 loading 状态 | 否 | **否** |
| `loadingFile` | `false` | `boolean` | 下载并解析 Excel 文件的异步 loading 状态 | 否 | **否** |
| `scope` | `'A'` | `string ('A' | 'AB')` | 价格带计算口径范围（A 默认直接可比，AB 包含邻近竞品） | 否 | **否** |
| `seed` | `1` | `number` | 抽检样本的确定性伪随机数种子 | 否 | **否** |
| `sample` | `null` | `Array<object> | null` | 当前生成的 50 条抽检样本数据集 | 否 | **否** |
| `checks` | `{}` | `object ({ [key]: 'correct' | 'wrong' })` | 运营人员对抽检样本的人工核验标记 | 否 | **否** |
| `checksSavedAt` | `null` | `string | null` | 核验结果保存到 localStorage 的时间戳 | 否 | **否** |
| `history` | `[]` | `Array<object>` | 最近 20 次抽检执行历史记录 | 否 | **否** |

此外，包含一个 `useRef`：
- `fileInitRef = useRef(false)`：用于防止 `props.data` 挂载后重复无条件覆盖已加载的 `rows`。

---

## 3. 全部 Effect 契约清单

| Effect 序号 | Dependencies | 作用 | Mount 是否执行 | Unmount 影响 | Opportunity 切换风险 |
|---|---|---|---|---|---|
| **Effect 1** | `[]` | 从 localStorage 读取 `purity-checks-v1` 和 `purity-sample-history-v1` | 是 | 无 | **高（状态碰撞）**：全局共用 key，抽屉若开启多个利基会相互覆盖 |
| **Effect 2** | `[data]` | 当且仅当 `fileInitRef.current === false` 时将父级 `data` 写入 `rows` | 是（若 data 存在） | 无 | **中**：单次锁定，切换 Opportunity 不会触发重新赋值 |
| **Effect 3** | `[fetchFiles]` | 异步请求 `manifest.json` 与服务端文件列表 | 是 | 无 | **低**：标准只读网络请求，无脏写 |

- **是否自动恢复旧文件**: **否**（无类似 `mr-active-file` 的自动激活文件记忆逻辑，刷新后重置为空状态）。
- **是否自动请求 API**: **是**（`fetchFiles` 自动拉取文件清单）。
- **是否有 Timer**: **无**。
- **是否根据条件自动重新分析**: **是**（`rows` 改变后，`useMemo` 会瞬时联动重算 `runPurityPipeline`, `buildWeightedBands`, `buildCredibility`）。
- **是否有 Cleanup**: **无**。

---

## 4. 纯度流水线真实执行阶段

真实流水线调用链：
```text
INPUT (Excel ArrayBuffer 或父级传入 rows)
  │
  ▼
[STEP 1: parseXlsxArrayBuffer(arrayBuffer)]
  - 输入: ArrayBuffer (XLSX 二进制)
  - 输出: Array<object> (首行解析为 headers，过滤空行)
  - 同步/异步: 同步
  - 修改 state: 否
  - 写文件/调服务: 否
  │
  ▼
[STEP 2: runPurityPipeline(rows) - 纯度核心过滤]
  - 函数: runPurityPipeline (purityFilter.js)
  - 输入: rows
  - 输出: { category, rows: outRows, stats }
  - 内部子步骤 2.1: detectCategory(rows)
      - 遍历所有商品标题，匹配 rules.categories 中的 detect_keywords 投票；
      - 检查最高票份额是否 >= 30% (min_share_for_detection)；
      - 满足则确认品类 key，否则返回 key=null (触发 NEEDS_DATA)。
  - 内部子步骤 2.2: 逐行 classifyRow(row, catCfg)
      - extractTitle, extractPrice, extractQty, extractSales；
      - parseSpec(title)：正则排除尺寸(50х70)、功能描述(5в1)、型号(AHD51)等干扰，提取 пар/шт/мл/л/кг/г 候选；
      - resolveSpec(parsed, catCfg)：将规格折算为目标口径基准值 (pcs / volume_ml / weight_g)；
      - A/B/C 分层判定：
          * 命中 tier_a.any 且未命中 tier_a.none ➔ Tier A（直接可比）
          * 命中 tier_a.none (如套装) 或 tier_b.any ➔ Tier B（邻近竞品）
          * 其余已识别规格商品 ➔ Tier C（不可比杂质）
          * 规格未解析或单位体系不匹配 ➔ UNKNOWN（未解析，独立成桶）
      - 计算 normalizedPrice = (price / spec.total) * catCfg.normalize.per。
  - 同步/异步: 同步 (useMemo)
  - 修改 state: 否
  - 写文件/调服务: 否
  │
  ▼
[STEP 3: buildWeightedBands(pipeline.rows, { tiers }) - 加权价格带]
  - 函数: buildWeightedBands (priceBands.js)
  - 输入: pipeline.rows, scope ('A' 或 'AB')
  - 逻辑: 过滤进入口径且 normalizedPrice > 0 的行，按可比价升序排序，切分成 5 个分位数价格带；
  - 聚合指标: 计算各带的 SKU占比、销量占比、销售额占比及中位价，找出主流价格带。
  - 同步/异步: 同步 (useMemo)
  - 修改 state: 否
  - 写文件/调服务: 否
  │
  ▼
[STEP 4: buildCredibility(pipeline.rows, category) - 数据可信度]
  - 函数: buildCredibility (credibility.js)
  - 统计: 计算规格识别覆盖率 coveragePct，汇总 UNKNOWN 成因。
  - 同步/异步: 同步 (useMemo)
  - 修改 state: 否
  - 写文件/调服务: 否
  │
  ▼
[STEP 5: createSample(pipeline.rows, { size: 50, seed }) - 人工抽检 (交互触发)]
  - 函数: createSample (credibility.js)
  - 逻辑: 使用 mulberry32(seed) 确定性伪随机数打乱样本索引，抽取 50 SKU；
  - 保存: 生成行稳定 ID (rowId)，记录抽取历史到 purity-sample-history-v1。
  - 同步/异步: 同步
  - 修改 state: 是 (sample, history)
  - 写文件/调服务: 写入 localStorage
  │
  ▼
OUTPUT (看板渲染)
  - 渲染类目折算口径卡片
  - 渲染分层分布柱状图与成因清单
  - 渲染加权价格带对比图表与 7 列明细表
  - 渲染抽检样本表格与人工核验准确率统计
```

---

## 5. A / B / C 分类事实源

- **规则配置事实源**: `config/market_analysis.json`（经 `scripts/sync-config.js` 自动同步为 `ozon-react/src/generated/market_analysis.js`）。
- **执行规则函数**: `classifyRow(row, catCfg)`（位于 `ozon-react/src/utils/marketAnalysis/purityFilter.js`）。
- **是否硬编码**:
  - 核心逻辑骨架硬编码（先排除双装单位不符、再解析规格、规格失败判 UNKNOWN、最后根据 tier_a/tier_b 关键词判定 A/B/C）；
  - 类目词库、单位、目标口径、套装降级词完全配置化于 JSON 中。
- **当前已配置的类目**:
  1. `hair_mask` (发膜/发用护理膏) - 目标口径 `volume_ml`
  2. `hair_spray` (护发喷雾/免洗护理) - 目标口径 `volume_ml`
  3. `gloves` (家务/劳保手套) - 目标口径 `pcs`
  4. `pillows` (枕头/矫形枕) - 目标口径 `pcs`
  5. `hair_dryer` (吹风机/造型器) - 目标口径 `pcs`
- **是否已有测试**: 是，`ozon-react/src/utils/marketAnalysis/pipeline.e2e.test.mjs` 及各级构建校验覆盖完整。

---

## 6. 价格带 / 规格 / 抽检逻辑

### 6.1 俄语规格提取（已完整实现）
- **函数**: `parseSpec(title)` (位于 `ozon-react/src/utils/marketAnalysis/specParser.js`)。
- **西里尔字母边界处理**: 严格采用 `(?![а-яёa-z0-9])` 负向前瞻处理俄语字母边界，杜绝 ASCII `\b` 在俄语下的失效问题。
- **陷阱排除**:
  - 尺寸对: `\d+\s*[хx×*]\s*\d+` (如 `50х70`, `40x60см`)
  - 功能复合: `\d+\s*(?:в|in)\s*1\b` (如 `5в1`, `6 в 1`)
  - 特性数量: `\d+\s*(?:насадок|масел|скоростей...)` (如 `8 насадок`, `3 скорости`)
  - 型号编号: `[а-яёА-ЯЁa-zA-Z]+-?\d+` (如 `AHD51`, `TF64`)
  - 序号/版本: `№ \d+`, `RESTART 2.0`
- **支持单位**: `пар` (×2), `шт`, `мл`, `л` (×1000), `кг` (×1000), `г`，并兼容中文 `双`, `只`, `毫升`, `克`。

### 6.2 价格带分析
- **输入价格**: 提取自行的价格列，原币种为卢布（₽）。
- **分箱算法**: 针对进入口径（A 或 A+B）的可比价格升序排序后，切为 5 个等频分位数分箱（动态分档，`Math.min(5, n)`）。
- **可比价格归一**: `normalizedPrice = (price / spec.total) * catCfg.normalize.per`（例如每 100ml / 每 100只 / 每只）。
- **输出指标**: 价格区间、中位可比价（₽/¥）、SKU占比、销量占比、销售额占比。

### 6.3 随机抽检
- **是否真实存在**: **真实存在**。
- **默认抽检数**: **50 SKU** (`rules.sampling?.default_size ?? 50`)。
- **算法保证**: `mulberry32(seed)` 确定性伪随机数发生器，相同 seed 抽取的 50 条样本完全一致。
- **保存方式**: 写入 `localStorage`（键名 `purity-checks-v1` 与 `purity-sample-history-v1`）。

---

## 7. 数据源 / 持久化 / API

### 7.1 数据源
- 支持静态 Excel 文件选择（通过 `manifest.json` 与 `/api/files/market-research` 获取列表）；
- 支持父级组件传入 `data` props（浏览器内存行数组）。

### 7.2 持久化键值
- `purity-checks-v1`: 存储人工核验对错标记。
- `purity-sample-history-v1`: 存储最近 20 次抽检生成记录。
- **未发现** `purity-active-file` 等页面级激活文件持久化。

### 7.3 服务端任务性质
- 所有服务端接口均为只读 `GET`（获取清单或静态 Excel 文件）；
- 无 POST/PUT 修改，无异步长任务，无 task id，服务端并发绝对安全。
- 纯度算法本身为 **100% 前端同步 JS 计算**（500-2000 行数据计算耗时通常小于 100ms），不调用 Python 后端。

---

## 8. 页面布局与嵌入风险

- **宽度适配**: 无固定 192px 侧栏，全页采用流式布局。但类目口径 5 列网格与加权价格带 7 列宽表格在 680px 抽屉内会较拥挤，需横向滚动。
- **高度开销**: 包含 4 大卡片板块 + 抽检核验面板，纵向高度超过 2000px，若直接塞入抽屉，会显著增加抽屉滚动负担。
- **切 Tab 行为**: 目前无生命周期防重置机制，切换 Tab 卸载后组件内部 state (`rows`, `sample`) 将丢失。

---

## 9. Opportunity 四字段映射可行性判断

| Opportunity 字段 | 当前 Pure Pipeline 是否已有对应输入 | 能否安全映射 | 事实代码依据 |
|---|---|---|---|
| **`nicheUid`** | 否 | **NO** | 纯度流水线完全没有 UID 概念，不可作为计算参数；仅可作为上下文 Key |
| **`name`** (如"发泡胶枪") | 否 | **ONLY_UI_HINT** | 纯度流水线**没有搜索框或过滤输入**，它是全量大盘分析；若按关键词预过滤 rows 会导致得票率不足 30% 直接触发 `NEEDS_DATA` 崩溃 |
| **`category`** (如"手动工具及配件") | 否 | **NO** | 纯度规则库中仅有 5 个配置类目（吹风机/发膜/喷雾/手套/枕头），且品类识别由俄语标题投票完成，与 Opportunity 的业务大类完全不兼容 |
| **`runId`** | 否 | **NO** | 纯度流水线无批次概念，不可传入算法 |

---

## 10. Multi-instance Safety (多实例安全性)

- **评定结果**: **`STATE_COLLISION_RISK`**
- **理由**:
  - `PurityPipelinePage` 中无服务端任务冲突，但组件固定监听与写入 `purity-checks-v1` 和 `purity-sample-history-v1` 两个全局 `localStorage` 键；
  - 若用户在独立页面（`__purity_analysis__`）正在核验某报告，同时在 Opportunity 抽屉中打开纯度分析并执行“保存”或“清空”，两处的人工核验数据会直接在浏览器发生读写覆盖冲突！
  - 嵌入模式下必须隔离或禁用针对全局 key 的写入。

---

## 11. Purity Pipeline vs MarketResearch 对比表

| 项目 | MarketResearch (`n2`) | PurityPipeline (`__purity_analysis__`) |
|---|---|---|
| **分析对象** | 大盘 Excel 报表（店铺/价格/销量宏观大盘） | 大盘 Excel 报表（商品标题/规格单位/同类性清洗） |
| **数据来源** | `manifest.json` 热销表 / 服务端上传 Excel | `manifest.json` 热销表 / 服务端文件 / props.data |
| **是否文件驱动** | 是（文件选择器驱动整个页面） | 是（文件选择器驱动整个页面，无文件则空白） |
| **是否关键词过滤** | **是**（DataTable 支持按关键词搜索过滤行） | **否**（无搜索框，全量数据自动跑规则分类） |
| **是否已有类目规则库**| 否（仅根据 Excel 原生字段分析） | **是**（强依赖 `config/market_analysis.json` 的 5 大品类配置）|
| **能否按 Niche 过滤** | 否（只能在表格搜索框预填搜索词） | **否**（完全不能预过滤，过滤会导致得票不足 30% 崩溃） |
| **持久化风险点** | `mr-active-file` 全局激活文件 | `purity-checks-v1` 全局抽检核验记录 |
| **适合集成方式** | 嵌入抽屉「竞品与价格」Tab 作为上下文搜索工具 | 需专用 Wrapper 隔离，或通过抽屉提供「带上下文跳转到纯度分析」 |

---

## 12. Cross-check: DataTable categoryFilter 事实澄清

在上一轮文档中曾出现 `categoryFilter` 的描述，经本次对源码的严格审查澄清如下：
- **`prop 是否真实存在`**: **否**。在 `DataTable.jsx` 实际源码签名中：
  `export default function DataTable({ data, initialSearchTerm = '', searchContextKey = '' })`，完全没有 `categoryFilter`。
- **`是否实际用于 filter`**: **否**。组件内部代码（包括 `filteredData`）无任何一处引用 `categoryFilter`。
- **`谁传入`**: 整个工程中没有组件向 `DataTable` 传递该 prop。上一轮文档中的出现纯属文档草稿文本失误。
- **`是否与 Opportunity 有关`**: **无关**。Opportunity 的 `category` 纯属界面展示字段，无过滤逻辑。

---

## 13. CONTRACT SUMMARY

```text
Component: PurityPipelinePage.jsx
Standalone Node: __purity_analysis__
Current Props: { data }

Primary Analysis Object: 用户选择或上传的整份 Ozon 热销大盘 Excel 数据集 (Option C)
Primary Input: Array<object> (原始 Excel 数据行)
Primary Output: 纯度分层结果 (A/B/C/UNKNOWN)、5档加权价格带 (SKU/销量/销售额占比)、数据可信度指标、50 SKU 抽检样本

Main Pipeline Function: runPurityPipeline(rows)
Pipeline Steps: parseXlsxArrayBuffer -> detectCategory (30%门槛投票) -> parseSpec (西里尔规格与陷阱排除) -> resolveSpec (口径归一) -> classifyRow (A/B/C/UNKNOWN) -> buildWeightedBands (等频分箱) -> buildCredibility -> createSample (mulberry32)

A/B/C Rule Source: config/market_analysis.json (5大配置类目: 发膜/喷雾/手套/枕头/吹风机) + purityFilter.js
Price Band Logic: 动态等频分箱 (5档)，中位价 + 三维加权占比 (SKU/销量/销售额)，C与UNKNOWN严格排除
Random Sampling: mulberry32 确定性 PRNG，默认 50 SKU，支持自定义 seed
Russian Spec Extraction: specParser.js 正则负向前瞻 (?![а-яёa-z0-9])，排除尺寸/功能/型号/版本，提取 пар/шт/мл/л/кг/г

File State: availableFiles, loadingFiles, loadingFile, rows, sourceLabel
Category State: 纯前端自动检测 (pipeline.category.key)，无外部 category state
Search State: 无检索状态，无关键词搜索框

Persistence: localStorage ('purity-checks-v1', 'purity-sample-history-v1')
Server API: GET /data/manifest.json, GET /api/files/market-research (只读，无长任务)

Full Page Header: 存在顶部 insight-card 标题与数据源摘要
Sidebar / Fixed Layout: 无固定侧栏，纯流式垂直布局

Opportunity Name Mapping: ONLY_UI_HINT (禁止用于数据过滤，否则导致品类投票不足 30% 崩溃)
Opportunity Category Mapping: NO (不可映射，规则库仅有5个细分品类，大类无法对齐)
Opportunity NicheUid Mapping: NO (流水线无 UID 概念，仅可作为隔离 key)
Opportunity RunId Mapping: NO (流水线无批次概念)

Standalone Safe: YES (原有 __purity_analysis__ 路由保持原样)
Multi-instance Safety: STATE_COLLISION_RISK (localStorage purity-checks-v1 冲突风险)
Embedded Feasible: FEASIBLE_WITH_WRAPPER (需封装隔离 localStorage，且必须提示大盘属性)

Recommended Coupling Level: WRAPPER_REQUIRED
```
