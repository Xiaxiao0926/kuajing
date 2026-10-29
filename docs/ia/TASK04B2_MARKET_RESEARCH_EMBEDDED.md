# TASK 04B-2: MarketResearch Opportunity 嵌入模式精确实施文档

## 1. 任务背景与核心目标

在 /kuajing 信息架构重组中，Opportunity Detail（利基机会详情抽屉）需要在「竞品与价格」Tab 内为运营人员提供上下文关联的市场调研工具能力。

在 04B-1 审计中发现：
1. MarketResearch 原为独立全屏分析页面（
2），通过 localStorage['mr-active-file'] 全局持久化当前激活报告；
2. 市场调研数据为宏观/全类目数据，其 KPI 卡片、价格区间图表均针对整份报告计算；
3. 直接将 MarketResearch 塞进抽屉会导致：
   - 抽屉内切换报告污染独立 
2 视图的 mr-active-file；
   - 假造“全量数据已过滤”假象误导运营决策。

因此，TASK 04B-2 实施了受控的 **Embedded 模式**，实现了零污染隔离与语义诚实。

---

## 2. 接口与 Props 变更清单

### 2.1 MarketResearch.jsx
新增可选 Props（带安全默认值）：
`javascript
export default function MarketResearch({
  data,
  kpis,
  dataFormat,
  onFileUpload = () => {},
  loading,
  error,
  screenshotMode = false,
  setScreenshotMode = () => {},
  embedded = false,           // 是否处于嵌入模式
  initialQuery = '',          // 初始检索关键词（预填表格检索框）
  contextKey = '',            // 上下文唯一标识（触发检索框同步）
})
`

### 2.2 Dashboard.jsx & NewDashboard.jsx
新增透传 Props：
`javascript
embedded = false,
initialSearchTerm = '',
searchContextKey = '',
`
- 在 Dashboard.jsx 中，mbedded === true 时隐藏全局主标题 🇷🇺 俄罗斯电商吹风机市场深度分析；
- 将 initialSearchTerm 与 searchContextKey 透传给 <DataTable />。

### 2.3 DataTable.jsx
新增 Props 与同步 Effect：
`javascript
export default function DataTable({
  data,
  categoryFilter,
  initialSearchTerm = '',
  searchContextKey = '',
}) {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '')

  useEffect(() => {
    setSearchTerm(initialSearchTerm || '')
  }, [searchContextKey, initialSearchTerm])
  ...
}
`

---

## 3. 隔离与安全机制

### 3.1 mr-active-file 严格隔离
在 MarketResearch.jsx 中：
1. **读取防护**：
   `javascript
   useEffect(() => {
     const loadSaved = async () => {
       const files = await dbGetAll()
       setSavedFiles(files)
       if (!embedded) {
         const lastActive = persistGet('mr-active-file')
         // ...仅在非 embedded 模式下自动加载历史文件
       }
     }
     loadSaved()
   }, [embedded])
   `
2. **写入与清理防护**：
   - processAndSave: if (!embedded) { persistSet('mr-active-file', fileName) }
   - handleLoadSaved: if (!embedded) { persistSet('mr-active-file', file.name) }
   - handleDeleteSaved: if (!embedded) { persistRemove('mr-active-file') }
   - 
ode-updates: if (!embedded) { /* 记录节点更新 */ }

### 3.2 布局适配
- 独立模式：lex gap-4 h-full，左侧保留固定 192px 报告文件选择列表；
- 嵌入模式：lex flex-col gap-4，顶部使用紧凑横向折行工具栏，不挤占抽屉 680px 宽度。

---

## 4. 数据流向与语义诚实设计

`	ext
[Opportunity Context]
  name: "发泡胶枪"
  category: "手动工具及配件"
  nicheUid: "wb_niche_d0198d600bed"
  runId: "RUN-20261217-001"
       │
       ▼
[OpportunityMarketResearchPanel]
  contextKey: "RUN-20261217-001:wb_niche_d0198d600bed"
  initialQuery: "发泡胶枪"
  category: "手动工具及配件" (仅界面展示，无下拉框/无过滤状态)
  缺失 UID 防护: 若 nicheUid 为空，拦截挂载并告警
  语义横幅: 显式声明 KPI 基于全报告，表格仅预填当前词筛选
       │
       ▼
[MarketResearch (embedded=true)]
  initialQuery ──► Dashboard / NewDashboard ──► DataTable
                                                   │
                                                   ▼
                                        searchTerm: "发泡胶枪"
`

---

## 5. 抽屉集成与生命周期控制

在 NicheDetailDrawer.jsx 中：
`javascript
const OpportunityMarketResearchPanel = lazy(() => import('./OpportunityMarketResearchPanel'))

// 仅在 activeTab === 'competition' 渲染，由 Suspense 包裹
{activeTab === 'competition' && (
  <div className="space-y-4 text-xs">
    {/* Section A: 市场竞争概览卡片 */}
    ...
    {/* Section B: 市场调研工具（嵌入式，按需懒加载，切 Tab 自动卸载） */}
    <Suspense fallback={<LoadingSpinner />}>
      <OpportunityMarketResearchPanel opportunity={opportunity} />
    </Suspense>
  </div>
)}
`
- 切到其他 Tab（如概览、搜索需求、风险、决策）时，MarketResearch 组件树彻底从 DOM 卸载，释放内存和事件监听。

---

## 6. 验证结果汇总

| 测试项 | 状态 | 覆盖要点 |
|---|---|---|
| 	ests/ia-market-research-embedded.test.mjs | ✅ 10/10 通过 | Props、隔离、透传、重置、懒加载、UID防护、IndexedDB 零破坏 |
| 	ests/ia-opportunity-shell.test.mjs | ✅ 9/9 通过 | Opportunity 上下文、抽屉外壳、真实利基数据烟雾测试 |
| 	ests/ia-navigation-acceptance.test.mjs | ✅ 通过 | 8 个一级业务域、12 个导航项、旧路由兼容 |
| 
pm test | ✅ 96/96 通过 | React wbEngine 65 项 + Python wb_calc 31 项 |
| 
pm run test:golden | ✅ 11/11 通过 | 黄金案例全绿 |
| 
pm run test:sync | ✅ 10/10 通过 | 双端对拍全绿 |
| 
pm run test:web-persistence | ✅ 通过 | Web 存储与持久化测试 |
| 
pm --prefix ozon-react run build | ✅ 通过 | Vite 生产构建打包成功 |
