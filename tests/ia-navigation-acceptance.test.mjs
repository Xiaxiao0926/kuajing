import assert from 'node:assert/strict'
import fs from 'node:fs'

const sidebarPath = new URL('../ozon-react/src/components/Sidebar.jsx', import.meta.url)
const appPath = new URL('../ozon-react/src/App.jsx', import.meta.url)
const miAppPath = new URL('../ozon-react/src/components/marketIntelligence/MarketIntelligenceApp.jsx', import.meta.url)

const sidebarSrc = fs.readFileSync(sidebarPath, 'utf8')
const appSrc = fs.readFileSync(appPath, 'utf8')
const miAppSrc = fs.readFileSync(miAppPath, 'utf8')

// 1. Sidebar.jsx: 7 business domains
const expectedDomains = [
  '工作台',
  '市场机会',
  '选品与立项',
  '商品项目',
  '成本核算',
  'Listing 与上架',
  '系统与数据'
]

for (const domain of expectedDomains) {
  assert.ok(sidebarSrc.includes(`label: '${domain}'`), `Sidebar must contain domain label '${domain}'`)
}
assert.ok(!sidebarSrc.includes("label: '运营与复盘'"), 'Sidebar must no longer contain empty 运营与复盘 domain')
assert.ok(!sidebarSrc.includes("label: '成本与物流'"), 'Sidebar must no longer contain legacy 成本与物流 label')

// 2. Sidebar.jsx: 12 primary items
const expectedPrimaryItems = [
  { id: '__progress_overview__', label: '工作台' },
  { id: '__market_intelligence__', label: '俄罗斯市场情报' },
  { id: '__market_reports__', label: '市场报告' },
  { id: '__t6_candidates__', label: '候选池' },
  { id: '__t6_projects__', label: 'SKU 项目' },
  { id: 'n5', label: '商品档案' },
  { id: 'n4', label: 'Ozon 跨境核算' },
  { id: '__fbp_calc__', label: 'Ozon FBP 核算' },
  { id: 'n39', label: 'WB 核算' },
  { id: 'n8', label: '成本报价' },
  { id: 'n14', label: 'Listing 工作台' },
  { id: '__market_datahub__', label: '数据中心' },
]

for (const item of expectedPrimaryItems) {
  assert.ok(sidebarSrc.includes(`id: '${item.id}'`), `Sidebar must contain item id '${item.id}'`)
  assert.ok(sidebarSrc.includes(`label: '${item.label}'`), `Sidebar must contain item label '${item.label}'`)
}

// 2b. 成本核算分组顺序契约：Ozon 跨境核算 → Ozon FBP 核算 → WB 核算 → 成本报价
{
  const pos = (needle) => sidebarSrc.indexOf(needle)
  const posN4 = pos("id: 'n4', label: 'Ozon 跨境核算'")
  const posFbp = pos("id: '__fbp_calc__', label: 'Ozon FBP 核算'")
  const posN39 = pos("id: 'n39', label: 'WB 核算'")
  const posN8 = pos("id: 'n8', label: '成本报价'")
  assert.ok(posN4 >= 0 && posFbp >= 0 && posN39 >= 0 && posN8 >= 0, '成本核算 four items must exist in Sidebar')
  assert.ok(posN4 < posFbp, '成本核算 order: Ozon 跨境核算 must precede Ozon FBP 核算')
  assert.ok(posFbp < posN39, '成本核算 order: Ozon FBP 核算 must precede WB 核算')
  assert.ok(posN39 < posN8, '成本核算 order: WB 核算 must precede 成本报价')
  const posCostingSection = pos("label: '成本核算'")
  assert.ok(posCostingSection > 0 && posCostingSection < posN4, '成本核算 section label must precede its items')
}

// 3. Sidebar.jsx: Preserves bottom progress section and roadmap nodes
assert.ok(sidebarSrc.includes('ROADMAP_PHASES'), 'Sidebar must retain ROADMAP_PHASES import')
assert.ok(sidebarSrc.includes('项目执行进度'), 'Sidebar must retain 项目执行进度 checklist section')

// 4. App.jsx: Page labels and fallback support
assert.ok(appSrc.includes(`if (nodeId === '__market_datahub__') return '数据中心'`), 'App.jsx must support __market_datahub__ label')
assert.ok(appSrc.includes('PRIMARY_NAV_NODE_IDS'), 'App.jsx must define PRIMARY_NAV_NODE_IDS')

// 5. App.jsx: renderContent legacy and new node coverage
const requiredRenderNodes = [
  '__project_flow__',
  '__node_overview__',
  '__progress_overview__',
  '__scoring__',
  '__purity_analysis__',
  '__market_intelligence__',
  '__market_datahub__',
  '__market_reports__',
  '__t6_candidates__',
  '__t6_projects__',
  '__t6_project_detail__',
  'n1',
  'n2',
  'n4',
  'n5',
  'n6',
  'n8',
  'n9',
  'n14',
  'n36',
  'n39',
  '__fbp_calc__'
]

for (const node of requiredRenderNodes) {
  assert.ok(
    appSrc.includes(`activeNode === '${node}'`),
    `renderContent in App.jsx must handle '${node}'`
  )
}

// 6. App.jsx: __market_datahub__ renders MarketIntelligenceApp with initialView="datahub"
assert.ok(
  appSrc.includes(`activeNode === '__market_datahub__'`),
  'App.jsx must have activeNode === __market_datahub__ branch'
)
assert.ok(
  appSrc.includes(`initialView="datahub"`),
  'App.jsx must pass initialView="datahub"'
)

// 7. App.jsx: Mobile dropdown domains & fallback
assert.ok(appSrc.includes('id="mobile-node-select"'), 'App.jsx must contain mobile-node-select')
assert.ok(appSrc.includes('<optgroup label="市场机会">'), 'Mobile select must have 市场机会 optgroup')
assert.ok(appSrc.includes('<optgroup label="系统与数据">'), 'Mobile select must have 系统与数据 optgroup')
assert.ok(appSrc.includes('<optgroup label="成本核算">'), 'Mobile select must have 成本核算 optgroup')
assert.ok(appSrc.includes('<option value="n4">Ozon 跨境核算</option>'), 'Mobile select must expose Ozon 跨境核算')
assert.ok(!appSrc.includes('<optgroup label="运营与复盘">'), 'Mobile select must no longer have 运营与复盘 optgroup')
assert.ok(appSrc.includes('PRIMARY_NAV_NODE_IDS.has(activeNode)'), 'Mobile select must have legacy active node fallback')

// 8. MarketIntelligenceApp.jsx: initialView support
assert.ok(miAppSrc.includes('initialView'), 'MarketIntelligenceApp must accept initialView prop')
assert.ok(miAppSrc.includes('setActiveTab(initialView)'), 'MarketIntelligenceApp must sync activeTab with initialView')

console.log('✅ IA navigation acceptance test passed: all 7 domains, 12 items, costing order contract, legacy fallback, and datahub alias verified!')
