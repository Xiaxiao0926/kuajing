# KUAIJING-IA-REFACTOR-V1 · TASK 04B-1 代码契约审计报告

> 本文档为只读代码审计产物，旨在完整摸清 `MarketResearch.jsx` 及其下属依赖的真实运行契约，为下一步（TASK 04B-2）实施双模式无损接入提供技术依据。本任务未改动任何业务代码。

---

## 一、MarketResearch 组件入口契约

- **组件源文件路径**：`ozon-react/src/components/MarketResearch.jsx`
- **导出方式**：命名默认导出函数（`export default function MarketResearch(...)`）
- **当前 Props 清单**（共 8 个）：
  1. `data`：外部传入已解析数据行数组（Array | null）
  2. `kpis`：外部传入指标汇总对象（Object | null）
  3. `dataFormat`：数据版本标识（'old' | 'new'）
  4. `onFileUpload`：全局文件上传回调（Function: `(file) => void`）
  5. `loading`：全局加载中状态（Boolean）
  6. `error`：全局错误文本（String | null）
  7. `screenshotMode`：截图模式布尔值（Boolean）
  8. `setScreenshotMode`：切换截图模式回调（Function: `(val) => void`）
- **默认 Props**：无（未定义 defaultProps，亦无解构默认值）
- **是否完全无 Props**：否（共接收 8 个 props）

---

## 二、useState 完整清单

| State 变量名 | 初始值 | 类型 | 核心作用 | 是否与 Opportunity 有关 |
|---|---|---|---|---|
| `availableFiles` | `[]` | Array | 存放从 `${DATA_DIR}/manifest.json` 与服务器 API 获取的可用报告文件列表 | 否 |
| `loadingFiles` | `false` | Boolean | 指示正在从远程下载或加载 Excel 文件的进度状态 | 否 |
| `activeFile` | `null` | String \| null | 当前正在显示/激活的报告文件名 | **是**（可映射至当前利基所关联的特定报告） |
| `localData` | `null` | Array \| null | 本地/缓存中已解析的商品全量数据（优先于 props.data） | **是**（承载竞品分析与价格带明细） |
| `localKpis` | `null` | Object \| null | 基于 `localData` 重新计算的局部 KPI 指标对象 | **是** |
| `localFormat` | `dataFormat` | String | 当前激活文件格式版本（'old' \| 'new'） | 否 |
| `exporting` | `false` | Boolean | 控制 PDF 生成与导出的 loading 状态 | 否 |
| `savedFiles` | `[]` | Array | 存储从 IndexedDB 读取的已缓存文件记录列表 | 否 |

> **关键事实**：`MarketResearch.jsx` 顶层**不存在** `searchTerm`、`searchText`、`categoryFilter` 或 `selectedProduct` 状态，这些细粒度搜索或品类逻辑均下沉在其子组件（`Dashboard` / `DataTable` / `NewDashboard`）中。

---

## 三、useEffect 完整清单

| # | Dependencies | 作用 | 首次挂载是否执行 | Context 切换受影响评估 |
|---|---|---|---|---|
| 1 | `[]` | **IndexedDB 本地缓存恢复**：调用 `dbGetAll()` 加载本地已保存文件列表到 `savedFiles`；读取 `persistGet('mr-active-file')`，若有历史记录则自动从缓存取回 `data`、`kpis`、`format` 并激活。 | **是** | **高**：若跨 Opportunity 频繁打开 Drawer，若仍直接读取全局 `mr-active-file`，可能发生载入上一商品文件的串流。 |
| 2 | `[]` | **服务器与 Manifest 文件同步**：请求 `manifest.json` 获取热销报告列表，结合 `listServerFiles('market-research')` 获取服务端文件并去重合并；建立 30 秒定时轮询。 | **是** | **无**：仅维护左侧公共文件列表，与特定 Opportunity 上下文解耦。 |

---

## 四、搜索与筛选入口契约

### 1. 商品名称搜索
- **在 `MarketResearch.jsx` 中**：**无**对应 State。
- **在下属渲染组件中**：
  - 位于 `ozon-react/src/components/DataTable.jsx:5`：
    - `state`: `searchTerm`（初始值 `''`）
    - `setter`: `setSearchTerm`
    - `UI input`: `<input type="text" placeholder="搜索关键词..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />`
  - 在 `NewDashboard.jsx` 中：**无**顶层商品名称搜索输入框。

### 2. 类目筛选
- **状态现状**：`NO CATEGORY FILTER`
- **事实依据**：`MarketResearch.jsx`、`Dashboard.jsx`、`NewDashboard.jsx` 均未实现 `categoryFilter` 或 `selectedCategory` 下拉选择框。`NewDashboard` 是在 `useDashboardStats.js` 中依据数据列名启发式判断是否为发膜、喷雾或手套品类。

---

## 五、分析触发方式契约

- **触发模式**：**模式 C（选择 Excel / 数据源后分析）**。
- **核心触发函数**：`processAndSave(parsedData, fileName, fileDate, isUpload)`（`MarketResearch.jsx:146-183`）
  - **参数**：
    - `parsedData` (Array)：已提取表头的二维行对象数据
    - `fileName` (String)：报告文件名
    - `fileDate` (String | undefined)：文件日期
    - `isUpload` (Boolean)：是否存入 IndexedDB
  - **涉及 State**：`setLocalFormat`, `setLocalData`, `setLocalKpis`, `setActiveFile`, `setSavedFiles`
  - **返回值**：`Promise<void>`
  - **是否 async**：`async`
  - **是否写入持久化**：
    - 是，写入 `localStorage`：`persistSet('mr-active-file', fileName)`、`persistSet('node-updates', ...)`
    - 若 `isUpload=true`，写入 IndexedDB：`await dbPut({ name, date, format, data, kpis, savedAt })`
- **用户交互路径**：
  1. 用户点击左侧服务器文件 → `handleLoadFile(f)` → fetch ArrayBuffer → `parseXlsxArrayBuffer` → `processAndSave`
  2. 用户点击左侧本地缓存 → `handleLoadSaved(f)` → `dbGet(f.name)` → 恢复 `localData`/`localKpis`
  3. 用户上传新文件 → `handleLocalUpload(e)` → 解析 ArrayBuffer → `processAndSave(..., isUpload=true)`

---

## 六、数据源与 IndexedDB 契约

### 1. 数据来源汇总表

| 数据源 | 实际读取位置 | 读取/操作函数 | 是否浏览器专属 | 是否可复用 |
|---|---|---|---|---|
| **IndexedDB** (`ozon-market-research`) | `MarketResearch.jsx:92, 200` | `dbGetAll()`, `dbGet(name)` | 是 | 是（全局 IndexedDB） |
| **localStorage** (`mr-active-file`) | `MarketResearch.jsx:94, 206` | `persistGet('mr-active-file')` | 是 | 是 |
| **静态 Manifest JSON** | `MarketResearch.jsx:113` | `fetch('${DATA_DIR}/manifest.json')` | 否 | 是 |
| **Node API 服务端文件** | `MarketResearch.jsx:119, 214, 228` | `listServerFiles()`, `uploadServerFile()` | 否 | 是 |
| **Excel 二进制流 (.xlsx)** | `MarketResearch.jsx:188, 246` | `XLSX.read(...)` | 是 | 是 |
| **HTML 导表文件 (.html)** | `MarketResearch.jsx:251` | `DOMParser().parseFromString(...)` | 是 | 是 |
| **内存 Props** (`data`, `kpis`) | `MarketResearch.jsx:73, 85-87` | `displayData = localData \|\| data` | 否 | 是 |

### 2. IndexedDB 详细规范
- **Database Name**：`ozon-market-research`
- **Version**：`1`
- **Object Store**：`files`
- **Key Path**：`name`（以文件名为主键）
- **记录结构**：`{ name, date, format, data, kpis, savedAt }`
- **并发与多实例审计结论**：
  - **读写冲突**：由于 IndexedDB 为事务隔离，两个组件实例同时读取不会造成底层死锁。但无跨实例广播机制，一个实例保存新文件后，另一个实例不会自动刷新 `savedFiles`。
  - **localStorage 键冲突**：独立页面 `n2` 与 Drawer 内部实例共用全局键 `'mr-active-file'`。若在 Drawer 中切换了分析文件，将直接改写该键，导致用户切回独立 `n2` 页面刷新后自动载入了 Drawer 中查看的文件。

---

## 七、文件上传与 Excel 行为

- **文件选择器位置**：`MarketResearch.jsx:318`：
  `<input ref={fileInputRef} type="file" accept="*" className="hidden" onChange={handleLocalUpload} disabled={loading} />`
- **支持文件类型**：`accept="*"`，代码内通过 `.html`/`.htm` 分流 DOMParser，其余全部走 XLSX 二进制解析。
- **解析库**：`xlsx`（SheetJS）
- **刷新后状态保持**：刷新页面后，通过 `useEffect` 重新从 IndexedDB 读取 `persistGet('mr-active-file')` 并赋值给 `localData`，数据可恢复。
- **关闭 Drawer 后的状态行为**：
  - **会卸载销毁**：Drawer 关闭时卸载子树，`MarketResearch` 的 React 内存 State（`localData` 等）彻底销毁。
  - **重新挂载恢复**：再次打开时，组件重新执行 `mount` 的 `loadSaved()`，将自动从 IndexedDB 再次读入内存，产生重新加载开销。

---

## 八、组件规模与复杂度

- **代码行数**：451 行
- **内部子组件数量**：0 个
- **直接 import 子组件**：2 个（`<Dashboard />`, `<NewDashboard />`）
- **复杂度评级**：`HIGH_COUPLING`（深度揉合 IndexedDB、DOMParser、XLSX、html2canvas、jspdf、Node API 上传与文件持久化）。

---

## 九、独立页面依赖与调用关系

- **独立路由节点**：`n2`（市场调研）
- **挂载位置**：`ozon-react/src/App.jsx:314-329`：
  ```jsx
  if (activeNode === 'n2') {
    return (
      <Suspense fallback={<LazyFallback />}>
        <MarketResearch
          data={data}
          kpis={kpis}
          dataFormat={dataFormat}
          onFileUpload={handleFileUpload}
          loading={loading}
          error={error}
          screenshotMode={screenshotMode}
          setScreenshotMode={setScreenshotMode}
        />
      </Suspense>
    )
  }
  ```
- **工作流跳入**：`ProjectSetup.jsx:292` 通过 `onNavigateToResearch={() => setActiveNode('n2')}` 跳入。

---

## 十、页面布局与 CSS 冲突审计

| 检查项 | 源码现状 | 具体位置 | 嵌入 Drawer (680px) 冲突评估 |
|---|---|---|---|
| **页面大标题** | 写死「🇷🇺 俄罗斯电商吹风机市场深度分析」 | `Dashboard.jsx:43` | **严重冲突**：在查看其他品类（如发泡胶枪）时出现吹风机标题极其突兀，必须在 embedded 模式下屏蔽。 |
| **返回按钮** | 无返回主页按钮 | — | 不冲突 |
| **定位方式** | 无 `position: fixed`，左侧有 `sticky top-0` | `MarketResearch.jsx:307` | 不冲突 |
| **最小高度** | 存在 `min-h-[80vh]` 空白态 | `Dashboard.jsx:20`, `NewDashboard.jsx:26` | **轻度冲突**：Drawer 内部高度受限，80vh 容易撑大内部滚动区域。 |
| **视口容器宽度** | 左侧边栏写死 `w-48`（192px） | `MarketResearch.jsx:307` | **严重冲突**：在 680px 的 Drawer 内，192px 侧栏独占近 30% 宽度，严重挤压右侧图表与表格展示。 |

---

## 十一、Opportunity 上下文输入规划

从 `opportunityContext.js` 可提供以下 14 个属性：
`nicheUid`, `name`, `category`, `runId`, `mos`, `pfs`, `gmv`, `growth`, `buyout`, `sellers`, `verdict`, `risks`, `source`, `raw`。

**TASK 04B 精确规划且仅允许消费的 4 个输入**：
1. `name`：机会/商品名称（如 `'发泡胶枪'`）
2. `category`：类目名称（如 `'手动工具及配件'`）
3. `nicheUid`：稳定标识（如 `'wb_niche_d0198d600bed'`）
4. `runId`：批次号（如 `'RUN-20261217-001'`）

> **严禁将 `mos`、`pfs`、`verdict`、`risks` 传入 MarketResearch 作为算法过滤或业务分支判断依据**。

---

## 十二、四个接入可行性判断

### Q1: MarketResearch 能否通过增加一个可选 `embedded = false` prop 隐藏独立页面 Header/侧边栏？
- **YES**
- **代码依据**：在 `MarketResearch.jsx:307` 的侧边栏与 `Dashboard.jsx:43` 的标题处判断 `!embedded`，可零破坏隐藏大标题并收起或简化侧边栏。

### Q2: 是否能够增加 `initialQuery` 并只在 Opportunity 改变时设置当前搜索 state？
- **NO（在 MarketResearch 顶层组件） / YES（需下沉或由 Wrapper 层处理）**
- **代码依据**：`MarketResearch.jsx` 顶层并无 `searchTerm`，真正的过滤发生在 `DataTable.jsx:5`。若要在 04B 联动，必须通过 Wrapper 包装层在向 `Dashboard` 传递数据前先按 `initialQuery` 进行内存过滤，或者逐层穿透至 `DataTable`。

### Q3: 是否能够增加 `initialCategory` 映射到现有类目筛选？
- **NO_EXISTING_CATEGORY_FILTER**
- **代码依据**：全组件代码均无现有类目筛选 state 或下拉选择器，不可虚构或强制映射。

### Q4: 是否能保持 `n2 standalone` 完全不变？
- **YES**
- **代码依据**：`App.jsx` 中的 `activeNode === 'n2'` 维持现状不传新 props，所有新增 props 赋予安全默认值（如 `embedded = false`），独立页面执行逻辑与展示 100% 保持不变。

---

## CONTRACT SUMMARY

```text
Component: MarketResearch (ozon-react/src/components/MarketResearch.jsx)
Current Props: data, kpis, dataFormat, onFileUpload, loading, error, screenshotMode, setScreenshotMode
Search State: NONE (Internal to DataTable.jsx: searchTerm)
Search Setter: NONE (Internal to DataTable.jsx: setSearchTerm)
Category State: NONE
Category Setter: NONE
Analysis Trigger: processAndSave (Mode C: on file select/upload)
Primary Data Source: localData (state) || data (props), hydrated from IndexedDB (ozon-market-research)
IndexedDB: ozon-market-research (version 1, store: files, keyPath: name)
Full Page Header: YES (Dashboard.jsx:43 hardcoded title; left sidebar 192px width)
Standalone Node: n2 (App.jsx:314)
Unmount Data Loss: YES (local React state destroyed on unmount; IndexedDB preserved)
Embedded Prop Feasible: YES
Initial Query Prop Feasible: YES (requires prop threading to DataTable or filtering in Wrapper)
Initial Category Prop Feasible: NO_EXISTING_CATEGORY_FILTER
Recommended Coupling Level: WRAPPER_REQUIRED
```
