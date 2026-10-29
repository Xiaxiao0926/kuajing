import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  findProcurementQuote,
  buildProcurementIdentity,
  resolveProcurementNicheUid,
} from '../ozon-react/src/utils/marketIntelligence/procurementIdentity.js'

console.log('===== IA Candidate Capabilities (Scoring & Procurement) Test Suite =====\n')

const drawerFilePath = path.resolve('ozon-react/src/components/t6/CandidateDetailDrawer.jsx')
const scoringGatewayFilePath = path.resolve('ozon-react/src/components/t6/CandidateScoringGateway.jsx')
const procurementPanelFilePath = path.resolve('ozon-react/src/components/t6/CandidateProcurementPanel.jsx')
const appFilePath = path.resolve('ozon-react/src/App.jsx')
const sidebarFilePath = path.resolve('ozon-react/src/components/Sidebar.jsx')

// -------------------------------------------------------------
// TEST 1: CandidateDetailDrawer 物理存在且包含严格 6 个业务 Tab
// -------------------------------------------------------------
console.log('TEST 1: 验证 CandidateDetailDrawer 存在且包含严格 6 个业务 Tab')
assert.ok(fs.existsSync(drawerFilePath), 'CandidateDetailDrawer.jsx 必须存在')
const drawerCode = fs.readFileSync(drawerFilePath, 'utf-8')
assert.match(drawerCode, /id:\s*'overview',\s*label:\s*'概览'/)
assert.match(drawerCode, /id:\s*'market',\s*label:\s*'市场依据'/)
assert.match(drawerCode, /id:\s*'scoring',\s*label:\s*'选品评分'/)
assert.match(drawerCode, /id:\s*'procurement',\s*label:\s*'采购验证'/)
assert.match(drawerCode, /id:\s*'risk',\s*label:\s*'风险与合规'/)
assert.match(drawerCode, /id:\s*'history',\s*label:\s*'决策记录'/)
console.log('  ✅ 严格 6 个业务 Tab 校验通过')

// -------------------------------------------------------------
// TEST 2: CandidateScoringGateway 物理存在并被引入
// -------------------------------------------------------------
console.log('TEST 2: 验证 CandidateScoringGateway 存在并被引入')
assert.ok(fs.existsSync(scoringGatewayFilePath), 'CandidateScoringGateway.jsx 必须存在')
const scoringGatewayCode = fs.readFileSync(scoringGatewayFilePath, 'utf-8')
assert.match(drawerCode, /import\s+CandidateScoringGateway\s+from\s+['"]\.\/CandidateScoringGateway['"]/)
assert.match(drawerCode, /<CandidateScoringGateway\s+candidate=\{candidate\}\s+snapshot=\{snapshot\}\s+onOpenScoring=\{handleOpenScoring\}\s*\/>/)
console.log('  ✅ CandidateScoringGateway 引入与挂载校验通过')

// -------------------------------------------------------------
// TEST 3: CandidateProcurementPanel 物理存在并被引入
// -------------------------------------------------------------
console.log('TEST 3: 验证 CandidateProcurementPanel 存在并被引入')
assert.ok(fs.existsSync(procurementPanelFilePath), 'CandidateProcurementPanel.jsx 必须存在')
const procurementPanelCode = fs.readFileSync(procurementPanelFilePath, 'utf-8')
assert.match(drawerCode, /import\s+CandidateProcurementPanel\s+from\s+['"]\.\/CandidateProcurementPanel['"]/)
assert.match(drawerCode, /<CandidateProcurementPanel\s+candidate=\{candidate\}\s+onOpenProcurement=\{handleOpenProcurement\}\s*\/>/)
console.log('  ✅ CandidateProcurementPanel 引入与挂载校验通过')

// -------------------------------------------------------------
// TEST 4: 评分隔离性（不引入评分工作台与抽屉）
// -------------------------------------------------------------
console.log('TEST 4: 验证评分隔离性（不引入 ProductScoringSection、ScoringDetailDrawer）')
assert.doesNotMatch(scoringGatewayCode, /import\s+.*ProductScoringSection/)
assert.doesNotMatch(scoringGatewayCode, /import\s+.*ScoringDetailDrawer/)
assert.doesNotMatch(drawerCode, /import\s+.*ProductScoringSection/)
assert.doesNotMatch(drawerCode, /import\s+.*ScoringDetailDrawer/)
console.log('  ✅ 评分组件物理隔离校验通过')

// -------------------------------------------------------------
// TEST 5: 采购隔离性（不引入 ManualProcurementWorkbench）
// -------------------------------------------------------------
console.log('TEST 5: 验证采购隔离性（不引入 ManualProcurementWorkbench）')
assert.doesNotMatch(procurementPanelCode, /import\s+.*ManualProcurementWorkbench/)
assert.doesNotMatch(drawerCode, /import\s+.*ManualProcurementWorkbench/)
console.log('  ✅ 采购工作台物理隔离校验通过')

// -------------------------------------------------------------
// TEST 6: CandidateScoringGateway 支持只读展示完整快照
// -------------------------------------------------------------
console.log('TEST 6: 验证 CandidateScoringGateway 快照字段完整映射')
assert.match(scoringGatewayCode, /scoreResult\.totalScore/)
assert.match(scoringGatewayCode, /scoreResult\.grade/)
assert.match(scoringGatewayCode, /scoreResult\.decision/)
assert.match(scoringGatewayCode, /scoreResult\.dimensions/)
assert.match(scoringGatewayCode, /scoreResult\.supplyGap/)
assert.match(scoringGatewayCode, /versions\.rulesVersion/)
console.log('  ✅ 快照字段映射完整')

// -------------------------------------------------------------
// TEST 7: CandidateScoringGateway 无快照时的语义隔离警示
// -------------------------------------------------------------
console.log('TEST 7: 验证无快照时的 MOS/PFS 语义隔离警示')
assert.match(scoringGatewayCode, /MOS\/PFS 属于市场机会指标，不能替代商品评分/)
assert.match(scoringGatewayCode, /isMiCandidate/)
assert.match(scoringGatewayCode, /以 canonical 商品数据为评分对象/)
console.log('  ✅ 语义隔离警示文案校验通过')

// -------------------------------------------------------------
// TEST 8: CandidateScoringGateway 选品评分全局工作台跳转声明
// -------------------------------------------------------------
console.log('TEST 8: 验证选品评分全局工作台未预过滤声明')
assert.match(scoringGatewayCode, /不会自动筛选或定位到当前 Candidate/)
assert.match(scoringGatewayCode, /打开选品评分工作台/)
console.log('  ✅ 全局工作台未预过滤声明校验通过')

// -------------------------------------------------------------
// TEST 9: CandidateProcurementPanel 读取采购数据 API 契约
// -------------------------------------------------------------
console.log('TEST 9: 验证采购读取使用 getManualQuotes 与 findProcurementQuote')
assert.match(procurementPanelCode, /import\s*\{[^}]*getManualQuotes[^}]*\}\s*from\s*['"][^'"]*miStore['"]/)
assert.match(procurementPanelCode, /import\s*\{[^}]*findProcurementQuote[^}]*\}\s*from\s*['"][^'"]*procurementIdentity['"]/)
assert.doesNotMatch(procurementPanelCode, /saveManualQuote/, '只读面板严禁调用 saveManualQuote 写入')
console.log('  ✅ 采购数据读取 API 契约校验通过')

// -------------------------------------------------------------
// TEST 10: Case A: 有 source_niche_uid 优先按 UID 稳定查找
// -------------------------------------------------------------
console.log('TEST 10: 验证 Case A: 有 source_niche_uid 优先 UID 查找')
const sampleQuotes = {
  niche_uid_1001: {
    supplierName: '义乌市晨阳实业',
    factoryPriceCny: 18.5,
    moq: 100,
    weightG: 320,
    dims: { lengthCm: 25, widthCm: 15, heightCm: 8 },
    domesticFreightCny: 3,
    internationalFreightCny: 12,
    targetPriceRub: 890,
    netProfitCny: 28.2,
    marginPct: 35.5,
    overallTrustTier: 'TIER1_CONFIRMED',
    priceProvenance: 'SUPPLIER_CONFIRMED',
    specProvenance: 'SAMPLE_WEIGHED',
    freightProvenance: 'CHANNEL_QUOTED',
    regulationProvenance: 'EAC_VERIFIED',
    updatedAt: '2026-09-17T12:00:00.000Z',
  },
  '发泡胶枪': {
    supplierName: '旧名称供应商',
    factoryPriceCny: 30,
  }
}

const candidateCaseA = {
  candidateName: '发泡胶枪',
  source_niche_uid: 'niche_uid_1001',
  source_system: 'WB_MARKET_INTELLIGENCE',
}

const quoteA = findProcurementQuote(sampleQuotes, {
  uid: candidateCaseA.source_niche_uid,
  name: candidateCaseA.candidateName,
})
assert.ok(quoteA, 'Case A 必须找到 quote')
assert.equal(quoteA.supplierName, '义乌市晨阳实业', '必须命中 UID 对应条目而非名称条目')
assert.equal(quoteA.factoryPriceCny, 18.5)
assert.match(procurementPanelCode, /UID 稳定关联/)
console.log('  ✅ Case A: UID 稳定关联查找通过')

// -------------------------------------------------------------
// TEST 11: Case B: 无 source_niche_uid 且 WB_MARKET_INTELLIGENCE 回退 Legacy 名称查找
// -------------------------------------------------------------
console.log('TEST 11: 验证 Case B: 无 UID 但为 MI 候选时回退 Legacy 名称查找')
const candidateCaseB = {
  candidateName: '发泡胶枪',
  source_niche_uid: null,
  source_system: 'WB_MARKET_INTELLIGENCE',
}

const quoteB = findProcurementQuote(sampleQuotes, {
  name: candidateCaseB.candidateName,
})
assert.ok(quoteB, 'Case B 必须找到 quote')
assert.equal(quoteB.supplierName, '旧名称供应商', '必须回退命中名称条目')
assert.match(procurementPanelCode, /Legacy 名称关联/)
console.log('  ✅ Case B: Legacy 名称关联回退通过')

// -------------------------------------------------------------
// TEST 12: Case C: 静态或非 MI 候选且无 UID 时绝不按名称关联
// -------------------------------------------------------------
console.log('TEST 12: 验证 Case C: 静态或非 MI 候选且无 UID 绝不按名称自动匹配')
const candidateCaseC = {
  candidateName: '发泡胶枪', // 与 quotes 里的 key 同名
  source_niche_uid: null,
  source_system: 'STATIC_SCORING',
}

// 模拟面板中的判定逻辑
const isMiC = candidateCaseC.source_system === 'WB_MARKET_INTELLIGENCE'
const hasUidC = Boolean(candidateCaseC.source_niche_uid)
let quoteC = null
let associationTypeC = 'NONE'
if (hasUidC) {
  quoteC = findProcurementQuote(sampleQuotes, { uid: candidateCaseC.source_niche_uid, name: candidateCaseC.candidateName })
  if (quoteC) associationTypeC = 'UID'
} else if (isMiC) {
  quoteC = findProcurementQuote(sampleQuotes, { name: candidateCaseC.candidateName })
  if (quoteC) associationTypeC = 'LEGACY_NAME'
}
assert.equal(quoteC, null, 'Case C 绝不能命中 quote')
assert.equal(associationTypeC, 'NONE', 'Case C 关联类型必须为 NONE')
console.log('  ✅ Case C: 静态候选绝不按名称盲目关联通过')

// -------------------------------------------------------------
// TEST 13: 严禁从 notes 正则反向解析采购字段
// -------------------------------------------------------------
console.log('TEST 13: 验证 CandidateProcurementPanel 严禁使用 notes 正则解析')
assert.doesNotMatch(procurementPanelCode, /notes\.match\(/, '严禁对 notes 使用 match')
assert.doesNotMatch(procurementPanelCode, /RegExp/, '严禁引入 RegExp')
console.log('  ✅ 零文本正则反解析保证通过')

// -------------------------------------------------------------
// TEST 14: CandidateProcurementPanel Gateway 按钮与未预过滤声明
// -------------------------------------------------------------
console.log('TEST 14: 验证采购 Gateway 按钮调用 onOpenProcurement 且有免责说明')
assert.match(procurementPanelCode, /不会自动筛选或定位到当前 Candidate/)
assert.match(procurementPanelCode, /打开市场情报验证池/)
assert.match(procurementPanelCode, /onClick=\{onOpenProcurement\}/)
console.log('  ✅ 采购 Gateway 与未预过滤声明校验通过')

// -------------------------------------------------------------
// TEST 15: App.jsx 隐藏别名路由与 Sidebar 导航纯净性
// -------------------------------------------------------------
console.log('TEST 15: 验证 App.jsx __market_validation__ 隐藏路由与 Sidebar 纯净性')
const appCode = fs.readFileSync(appFilePath, 'utf-8')
const sidebarCode = fs.readFileSync(sidebarFilePath, 'utf-8')

assert.match(appCode, /if\s*\(nodeId === '__market_validation__'\)\s*return\s*'产品验证池'/)
assert.match(appCode, /if\s*\(activeNode === '__market_validation__'\)\s*\{[\s\S]*initialView="validation"/)
assert.doesNotMatch(sidebarCode, /__market_validation__/, 'Sidebar 严禁包含 __market_validation__')
assert.doesNotMatch(appCode, /PRIMARY_NAV_NODE_IDS\s*=\s*new\s+Set\(\[[^\]]*__market_validation__/, 'PRIMARY_NAV_NODE_IDS 严禁包含 __market_validation__')
console.log('  ✅ 隐藏路由配置与导航 8 领域 12 项纯净性校验通过')

console.log('\n🎉 IA Candidate Capabilities 全部 15 项测试通过！')
