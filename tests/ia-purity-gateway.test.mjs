import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

console.log('===== IA Opportunity Purity Gateway Test Suite =====\n')

const gatewayPath = path.join(ROOT, 'ozon-react/src/components/marketIntelligence/components/OpportunityPurityGateway.jsx')
const drawerPath = path.join(ROOT, 'ozon-react/src/components/marketIntelligence/components/NicheDetailDrawer.jsx')
const appPath = path.join(ROOT, 'ozon-react/src/App.jsx')
const miAppPath = path.join(ROOT, 'ozon-react/src/components/marketIntelligence/MarketIntelligenceApp.jsx')

// TEST 1: 存在 OpportunityPurityGateway.jsx
console.log('TEST 1: 验证 OpportunityPurityGateway.jsx 文件存在')
{
  assert.ok(fs.existsSync(gatewayPath), 'OpportunityPurityGateway.jsx 必须存在')
  console.log('  ✅ OpportunityPurityGateway.jsx 文件存在')
}

// TEST 2: 组件不 import PurityPipelinePage
console.log('TEST 2: 验证 OpportunityPurityGateway 绝对未引入 PurityPipelinePage')
{
  const gatewaySrc = fs.readFileSync(gatewayPath, 'utf8')
  assert.ok(!gatewaySrc.includes('PurityPipelinePage'), 'Gateway 禁止直接或间接引入 PurityPipelinePage')
  console.log('  ✅ Gateway 物理隔离通过')
}

// TEST 3: 显示五个当前规则品类：发膜 / 护发喷雾 / 手套 / 枕头 / 吹风机
console.log('TEST 3: 验证 Gateway 显示当前规则库支持的 5 大品类')
{
  const gatewaySrc = fs.readFileSync(gatewayPath, 'utf8')
  const categories = ['发膜', '护发喷雾', '手套', '枕头', '吹风机']
  for (const cat of categories) {
    assert.ok(gatewaySrc.includes(cat), `Gateway 必须包含支持品类: ${cat}`)
  }
  assert.ok(gatewaySrc.includes('config/market_analysis.json'), '源码注释必须说明事实源来自 config/market_analysis.json')
  console.log('  ✅ 5 大规则品类完整展示且注明事实源')
}

// TEST 4: 存在明确警告：不会自动映射 / 不会自动过滤 语义
console.log('TEST 4: 验证存在明确的业务边界警告横幅')
{
  const gatewaySrc = fs.readFileSync(gatewayPath, 'utf8')
  assert.ok(gatewaySrc.includes('当前市场机会不会自动映射为纯度分析品类'), '必须包含不会自动映射品类的警告')
  assert.ok(gatewaySrc.includes('系统不会使用当前 Opportunity 名称或类目预过滤数据'), '必须包含不会预过滤数据的警告')
  console.log('  ✅ 业务边界与数据语义真实性警告存在')
}

// TEST 5: NicheDetailDrawer 存在 purity Tab
console.log('TEST 5: 验证 NicheDetailDrawer 严格包含 purity Tab')
{
  const drawerSrc = fs.readFileSync(drawerPath, 'utf8')
  assert.ok(drawerSrc.includes("id: 'purity'"), "Tabs 中必须声明 id: 'purity'")
  assert.ok(drawerSrc.includes("label: '纯度分析'"), "Tabs 中必须声明 label: '纯度分析'")
  console.log('  ✅ NicheDetailDrawer 存在 purity Tab')
}

// TEST 6: purity Tab 渲染 OpportunityPurityGateway
console.log('TEST 6: 验证 purity Tab 渲染 OpportunityPurityGateway')
{
  const drawerSrc = fs.readFileSync(drawerPath, 'utf8')
  assert.ok(drawerSrc.includes("activeTab === 'purity'"), "必须存在 activeTab === 'purity' 条件渲染区块")
  assert.ok(drawerSrc.includes('<OpportunityPurityGateway'), 'purity Tab 必须渲染 <OpportunityPurityGateway')
  assert.ok(drawerSrc.includes('opportunity={opportunity}'), '必须向 Gateway 传入 opportunity')
  assert.ok(drawerSrc.includes('onOpenPurity={handleOpenPurity}'), '必须向 Gateway 传入 onOpenPurity 回调')
  console.log('  ✅ purity Tab 正确渲染 OpportunityPurityGateway')
}

// TEST 7: App -> MarketIntelligenceApp: 存在 node navigation callback
console.log('TEST 7: 验证 App.jsx 向 MarketIntelligenceApp 传递 onOpenNode 回调')
{
  const appSrc = fs.readFileSync(appPath, 'utf8')
  assert.ok(
    appSrc.includes('onOpenNode={(nodeId) => setActiveNode(nodeId)}'),
    'App.jsx 必须传递 onOpenNode={(nodeId) => setActiveNode(nodeId)}'
  )
  console.log('  ✅ App.jsx 回调注入完整')
}

// TEST 8: MarketIntelligenceApp -> NicheDetailDrawer: callback 被透传
console.log('TEST 8: 验证 MarketIntelligenceApp 透传 onOpenNode 回调至 NicheDetailDrawer')
{
  const miSrc = fs.readFileSync(miAppPath, 'utf8')
  assert.ok(miSrc.includes('onOpenNode = null'), 'MarketIntelligenceApp 声明 onOpenNode 参数')
  assert.ok(miSrc.includes('onOpenNode={onOpenNode}'), 'NicheDetailDrawer 调用处必须传递 onOpenNode={onOpenNode}')
  console.log('  ✅ MarketIntelligenceApp 回调透传完整')
}

// TEST 9: 点击 Gateway: 目标 Node 固定为 __purity_analysis__
console.log('TEST 9: 验证 Gateway 点击回调目标 Node 固定为 __purity_analysis__ 且先关闭 Drawer')
{
  const drawerSrc = fs.readFileSync(drawerPath, 'utf8')
  const gatewaySrc = fs.readFileSync(gatewayPath, 'utf8')

  assert.ok(drawerSrc.includes("onOpenNode('__purity_analysis__')"), "必须调用 onOpenNode('__purity_analysis__')")
  assert.ok(drawerSrc.includes('onClose?.()'), '跳转前必须调用 onClose?.() 关闭 Drawer')
  assert.ok(gatewaySrc.includes('打开纯度分析工具'), 'CTA 按钮文案必须为「打开纯度分析工具」')
  assert.ok(gatewaySrc.includes('onClick={onOpenPurity}'), 'CTA 按钮点击必须触发 onOpenPurity')
  console.log('  ✅ Gateway 跳转链路与目标 Node 契约吻合')
}

// TEST 10: 没有修改 PurityPipelinePage, purityFilter, specParser, priceBands, credibility
console.log('TEST 10: 验证纯度流水线 5 个核心算法与页面文件零改动')
{
  const criticalFiles = [
    'ozon-react/src/components/PurityPipelinePage.jsx',
    'ozon-react/src/utils/marketAnalysis/purityFilter.js',
    'ozon-react/src/utils/marketAnalysis/specParser.js',
    'ozon-react/src/utils/marketAnalysis/priceBands.js',
    'ozon-react/src/utils/marketAnalysis/credibility.js',
  ]

  const diffOutput = execSync('git diff --name-only', { cwd: ROOT, encoding: 'utf8' })
  const changedFiles = diffOutput.split('\n').map((s) => s.trim().replace(/\\/g, '/')).filter(Boolean)

  for (const file of criticalFiles) {
    assert.ok(!changedFiles.includes(file), `核心算法文件禁止改动: ${file}`)
    console.log(`  ✅ 核心文件未修改: ${file}`)
  }
}

console.log('\n🎉 IA Opportunity Purity Gateway 全部 10 项测试通过！')
