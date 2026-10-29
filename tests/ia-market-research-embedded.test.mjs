import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

console.log('===== IA MarketResearch Embedded Mode Test Suite =====\n')

const marketResearchSrc = fs.readFileSync(
  path.join(ROOT, 'ozon-react/src/components/MarketResearch.jsx'),
  'utf8'
)
const dashboardSrc = fs.readFileSync(
  path.join(ROOT, 'ozon-react/src/components/Dashboard.jsx'),
  'utf8'
)
const newDashboardSrc = fs.readFileSync(
  path.join(ROOT, 'ozon-react/src/components/NewDashboard.jsx'),
  'utf8'
)
const dataTableSrc = fs.readFileSync(
  path.join(ROOT, 'ozon-react/src/components/DataTable.jsx'),
  'utf8'
)
const drawerSrc = fs.readFileSync(
  path.join(ROOT, 'ozon-react/src/components/marketIntelligence/components/NicheDetailDrawer.jsx'),
  'utf8'
)
const panelSrc = fs.readFileSync(
  path.join(ROOT, 'ozon-react/src/components/marketIntelligence/components/OpportunityMarketResearchPanel.jsx'),
  'utf8'
)

// TEST 1: MarketResearch 支持 embedded / initialQuery / contextKey props
console.log('TEST 1: 验证 MarketResearch 声明 embedded, initialQuery, contextKey props')
{
  assert.ok(marketResearchSrc.includes('embedded = false'), 'MarketResearch 必须声明 embedded = false')
  assert.ok(marketResearchSrc.includes("initialQuery = ''"), 'MarketResearch 必须声明 initialQuery')
  assert.ok(marketResearchSrc.includes("contextKey = ''"), 'MarketResearch 必须声明 contextKey')
  console.log('  ✅ MarketResearch props 声明完整')
}

// TEST 2: 独立模式 (embedded !== true) 读取/写入 mr-active-file 保持原逻辑不变
console.log('TEST 2: 验证独立模式下保留 mr-active-file 读取与写入逻辑')
{
  assert.ok(marketResearchSrc.includes("persistGet('mr-active-file')"), '独立模式必须存在 persistGet(mr-active-file)')
  assert.ok(marketResearchSrc.includes("persistSet('mr-active-file'"), '独立模式必须存在 persistSet(mr-active-file)')
  assert.ok(marketResearchSrc.includes("persistRemove('mr-active-file')"), '独立模式必须存在 persistRemove(mr-active-file)')
  console.log('  ✅ 独立模式下 mr-active-file 操作完整保留')
}

// TEST 3: embedded 模式下禁止读取 localStorage('mr-active-file')，也禁止写入
console.log('TEST 3: 验证 embedded 模式下严格隔离 mr-active-file 读取与写入')
{
  // 检查读取是否被 if (!embedded) 守卫
  const getMatch = marketResearchSrc.match(/if\s*\(!embedded\)\s*\{\s*const\s+lastActive\s*=\s*persistGet\(['"]mr-active-file['"]\)/)
  assert.ok(getMatch, 'persistGet(mr-active-file) 必须置于 if (!embedded) 守卫中')

  // 检查写入是否被 if (!embedded) 守卫
  const setMatches = marketResearchSrc.match(/if\s*\(!embedded\)\s*\{[^}]*persistSet\(['"]mr-active-file['"]/g)
  assert.ok(setMatches && setMatches.length >= 2, '所有 persistSet(mr-active-file) 必须置于 if (!embedded) 守卫中')

  // 检查删除是否被 if (!embedded) 守卫
  const removeMatch = marketResearchSrc.match(/if\s*\(!embedded\)\s*\{\s*persistRemove\(['"]mr-active-file['"]\)/)
  assert.ok(removeMatch, 'persistRemove(mr-active-file) 必须置于 if (!embedded) 守卫中')
  console.log('  ✅ embedded 模式严格隔离 mr-active-file，无状态泄漏风险')
}

// TEST 4: embedded 模式下 initialQuery 传递给 DataTable initialSearchTerm
console.log('TEST 4: 验证 initialQuery 正确透传至 Dashboard/NewDashboard 与 DataTable')
{
  // MarketResearch 传给 Dashboard / NewDashboard
  assert.ok(
    marketResearchSrc.includes('initialSearchTerm={initialQuery}') && marketResearchSrc.includes('searchContextKey={contextKey}'),
    'MarketResearch 必须将 initialQuery 透传为 initialSearchTerm，contextKey 透传为 searchContextKey'
  )
  // Dashboard 声明并透传给 DataTable
  assert.ok(dashboardSrc.includes('initialSearchTerm'), 'Dashboard 必须接收 initialSearchTerm')
  assert.ok(dashboardSrc.includes('searchContextKey'), 'Dashboard 必须接收 searchContextKey')
  assert.ok(
    dashboardSrc.includes('<DataTable') && dashboardSrc.includes('initialSearchTerm={initialSearchTerm}'),
    'Dashboard 必须将 initialSearchTerm 传给 DataTable'
  )
  console.log('  ✅ initialQuery 数据流向链条正确透传')
}

// TEST 5: contextKey 变化时 DataTable 搜索框重置/同步到新 initialSearchTerm
console.log('TEST 5: 验证 DataTable 响应 searchContextKey 同步 searchTerm')
{
  assert.ok(dataTableSrc.includes('initialSearchTerm = \'\''), 'DataTable 声明 initialSearchTerm')
  assert.ok(dataTableSrc.includes('searchContextKey = \'\''), 'DataTable 声明 searchContextKey')
  const syncEffectMatch = dataTableSrc.match(/useEffect\s*\(\(\)\s*=>\s*\{[^}]*setSearchTerm\([^)]*initialSearchTerm[^)]*\)[^}]*\},\s*\[searchContextKey,\s*initialSearchTerm\]\)/s)
  assert.ok(syncEffectMatch, 'DataTable 必须在 [searchContextKey, initialSearchTerm] 变化时触发 setSearchTerm 同步')
  console.log('  ✅ DataTable 跨上下文搜索词同步逻辑正确')
}

// TEST 6: opportunity.category 仅作为上下文显示，不存在 category filter dropdown/state
console.log('TEST 6: 验证 opportunity.category 仅为 UI 上下文，无筛选器状态')
{
  assert.ok(panelSrc.includes('所属类目: {opportunity.category}'), 'Panel 中包含类目展示')
  assert.ok(!panelSrc.includes('categoryFilter'), 'Panel 禁止维护 categoryFilter 状态')
  assert.ok(!panelSrc.includes('setCategoryFilter'), 'Panel 禁止维护 setCategoryFilter 动作')
  assert.ok(!panelSrc.includes('<select'), 'Panel 禁止渲染类目 select 下拉菜单')
  console.log('  ✅ category 仅做展示上下文，未伪造类目筛选器')
}

// TEST 7: NicheDetailDrawer 中 OpportunityMarketResearchPanel 为动态/懒加载引入
console.log('TEST 7: 验证 NicheDetailDrawer 采用 React.lazy 动态加载 OpportunityMarketResearchPanel')
{
  assert.ok(
    drawerSrc.includes("const OpportunityMarketResearchPanel = lazy(() => import('./OpportunityMarketResearchPanel'))"),
    'NicheDetailDrawer 必须使用 lazy(() => import(...)) 引入 OpportunityMarketResearchPanel'
  )
  assert.ok(drawerSrc.includes('<Suspense'), '必须使用 <Suspense> 包裹懒加载组件')
  console.log('  ✅ 懒加载与代码分割验证通过')
}

// TEST 8: NicheDetailDrawer 中 MarketResearch 仅在 activeTab === \'competition\' 渲染
console.log('TEST 8: 验证仅在 activeTab === competition 时挂载，切 Tab 自动卸载')
{
  const compTabStart = drawerSrc.indexOf("activeTab === 'competition'")
  const compTabEnd = drawerSrc.indexOf("activeTab === 'risk'")
  assert.ok(compTabStart !== -1 && compTabEnd !== -1, '必须存在 competition 和 risk tab 区块')
  const compBlock = drawerSrc.substring(compTabStart, compTabEnd)
  assert.ok(compBlock.includes('<OpportunityMarketResearchPanel'), 'OpportunityMarketResearchPanel 必须仅在 competition tab 区块内渲染')
  assert.ok(!drawerSrc.substring(0, compTabStart).includes('<OpportunityMarketResearchPanel'), '其他 tab 区块严禁渲染 OpportunityMarketResearchPanel')
  console.log('  ✅ 挂载与卸载生命周期契约符合要求')
}

// TEST 9: opportunity.nicheUid 缺失时拦截 MarketResearch 挂载并显示告警
console.log('TEST 9: 验证缺失 nicheUid 时拦截挂载并展示业务告警')
{
  assert.ok(panelSrc.includes('if (!opportunity.nicheUid)'), 'Panel 必须包含 if (!opportunity.nicheUid) 防护')
  assert.ok(
    panelSrc.includes('机会标识缺失，无法进入上下文市场调研。'),
    'Panel 必须展示指定的中文告警提示语'
  )
  console.log('  ✅ 缺失 UID 安全守卫有效拦截')
}

// TEST 10: IndexedDB 结构未被破坏（files store, name keyPath）
console.log('TEST 10: 验证 MarketResearch IndexedDB 结构原样保留')
{
  assert.ok(marketResearchSrc.includes("const DB_NAME = 'ozon-market-research'"), 'DB_NAME 必须为 ozon-market-research')
  assert.ok(marketResearchSrc.includes('const DB_VERSION = 1'), 'DB_VERSION 必须为 1')
  assert.ok(marketResearchSrc.includes("const STORE_NAME = 'files'"), 'STORE_NAME 必须为 files')
  assert.ok(marketResearchSrc.includes("{ keyPath: 'name' }"), 'objectStore keyPath 必须为 name')
  console.log('  ✅ IndexedDB 存储规范零改动')
}

console.log('\n🎉 IA MarketResearch Embedded Mode 全部 10 项测试通过！')
