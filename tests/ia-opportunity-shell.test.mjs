import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildOpportunityContext } from '../ozon-react/src/utils/marketIntelligence/opportunityContext.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

console.log('===== IA Opportunity Shell & Context Test Suite =====\n')

// TEST 1: 存在 opportunityContext.js
console.log('TEST 1: 验证 opportunityContext.js 文件存在')
{
  const filePath = path.join(ROOT, 'ozon-react/src/utils/marketIntelligence/opportunityContext.js')
  assert.ok(fs.existsSync(filePath), 'opportunityContext.js 必须存在')
  console.log('  ✅ opportunityContext.js 文件存在')
}

// TEST 2: buildOpportunityContext() 基础字段映射与结构
console.log('TEST 2: 验证 buildOpportunityContext(发泡胶枪) 基础字段映射')
{
  const mockGun = {
    uid: 'wb_niche_d0198d600bed',
    name: '发泡胶枪',
    cat: '手动工具及配件',
    mos: 73.7,
    pfs: 100,
    gmv: 7785641,
    growth: '-3.4%',
    buyout: 91,
    sellers: 945,
    verdict: 'TEST',
    risks: ['NONE (通用标品)'],
  }

  const opp = buildOpportunityContext(mockGun, { runId: 'RUN-20261217-001' })
  assert.equal(opp.nicheUid, 'wb_niche_d0198d600bed')
  assert.equal(opp.name, '发泡胶枪')
  assert.equal(opp.category, '手动工具及配件')
  assert.equal(opp.runId, 'RUN-20261217-001')
  assert.equal(opp.mos, 73.7)
  assert.equal(opp.pfs, 100)
  assert.equal(opp.gmv, 7785641)
  assert.equal(opp.growth, '-3.4%')
  assert.equal(opp.buyout, 91)
  assert.equal(opp.sellers, 945)
  assert.equal(opp.verdict, 'TEST')
  assert.deepEqual(opp.risks, ['NONE (通用标品)'])
  assert.equal(opp.source, 'WB_MARKET_INTELLIGENCE')
  assert.equal(opp.raw, mockGun)
  console.log('  ✅ 发泡胶枪基础字段完整生成')
}

// TEST 3: 兼容 cfs -> pfs
console.log('TEST 3: 验证旧数据 cfs 字段平滑兼容映射到 pfs')
{
  const mockLegacy = {
    niche_uid: 'wb_niche_legacy_001',
    niche_name: '旧版商品',
    category: '汽摩配件',
    mos: 65.5,
    cfs: 92.0,
  }

  const opp = buildOpportunityContext(mockLegacy)
  assert.equal(opp.nicheUid, 'wb_niche_legacy_001')
  assert.equal(opp.name, '旧版商品')
  assert.equal(opp.category, '汽摩配件')
  assert.equal(opp.pfs, 92.0, 'cfs 必须自动转换为 pfs')
  console.log('  ✅ cfs -> pfs 兼容成功')
}

// TEST 4: 禁止假造 niche UID (必须为 null)
console.log('TEST 4: 验证缺失 UID 时严格返回 null，严禁假造 ID')
{
  const missingUidNiche = {
    name: '无标识利基',
    cat: '家居',
    mos: 50,
  }

  const opp = buildOpportunityContext(missingUidNiche)
  assert.equal(opp.nicheUid, null, '缺失 uid/niche_uid 时必须为 null，禁止 Math.random / Date.now')
  console.log('  ✅ 缺失 UID 严格返回 null')
}

// TEST 5: NicheDetailDrawer 源码契约使用统一 buildOpportunityContext
console.log('TEST 5: 验证 NicheDetailDrawer 使用 buildOpportunityContext')
{
  const drawerSrc = fs.readFileSync(
    path.join(ROOT, 'ozon-react/src/components/marketIntelligence/components/NicheDetailDrawer.jsx'),
    'utf8'
  )
  assert.ok(
    drawerSrc.includes("import { buildOpportunityContext } from '../../../utils/marketIntelligence/opportunityContext'"),
    '必须导入 buildOpportunityContext'
  )
  assert.ok(
    drawerSrc.includes('buildOpportunityContext(niche, { runId })'),
    '必须调用 buildOpportunityContext(niche, { runId })'
  )
  console.log('  ✅ NicheDetailDrawer 统一构建 Opportunity Context')
}

// TEST 6: 验证前台存在且仅存在 6 个规定主 Tab (概览, 搜索需求, 竞品与价格, 纯度分析, 风险, 决策)
console.log('TEST 6: 验证 6 个固定业务 Tab 配置')
{
  const drawerSrc = fs.readFileSync(
    path.join(ROOT, 'ozon-react/src/components/marketIntelligence/components/NicheDetailDrawer.jsx'),
    'utf8'
  )
  assert.ok(drawerSrc.includes("label: '概览'"), "必须包含 '概览' Tab")
  assert.ok(drawerSrc.includes("label: '搜索需求'"), "必须包含 '搜索需求' Tab")
  assert.ok(drawerSrc.includes("label: '竞品与价格'"), "必须包含 '竞品与价格' Tab")
  assert.ok(drawerSrc.includes("label: '纯度分析'"), "必须包含 '纯度分析' Tab")
  assert.ok(drawerSrc.includes("label: '风险'"), "必须包含 '风险' Tab")
  assert.ok(drawerSrc.includes("label: '决策'"), "必须包含 '决策' Tab")
  console.log('  ✅ 6 个业务 Tab 配置精确匹配')
}

// TEST 7: 严禁直接 import MarketResearch 与 PurityPipelinePage
console.log('TEST 7: 验证 NicheDetailDrawer 未直接引入 MarketResearch 与 PurityPipelinePage')
{
  const drawerSrc = fs.readFileSync(
    path.join(ROOT, 'ozon-react/src/components/marketIntelligence/components/NicheDetailDrawer.jsx'),
    'utf8'
  )
  assert.ok(!drawerSrc.includes("import MarketResearch from"), 'NicheDetailDrawer 严禁直接 import MarketResearch')
  assert.ok(!drawerSrc.includes('PurityPipelinePage'), 'NicheDetailDrawer 严禁 import PurityPipelinePage')
  console.log('  ✅ 物理隔离通过')
}

// TEST 8: 现有 Candidate 推流调用依然保持
console.log('TEST 8: 验证现有 T6 推流与采购验证接线未被破坏')
{
  const drawerSrc = fs.readFileSync(
    path.join(ROOT, 'ozon-react/src/components/marketIntelligence/components/NicheDetailDrawer.jsx'),
    'utf8'
  )
  assert.ok(drawerSrc.includes('onPromoteToT6(opportunity.raw, statusNote)'), '必须保留 onPromoteToT6 推流调用')
  assert.ok(drawerSrc.includes('onOpenProcurement(opportunity.raw)'), '必须保留 onOpenProcurement 采购验证调用')
  console.log('  ✅ 业务流转接线保持完好')
}

// 真实数据烟雾测试 (Section XXV)
console.log('TEST 9: 真实批次数据烟雾测试 (发泡胶枪、热缩管、拖车支轮)')
{
  const activeRunJson = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'ozon-react/public/data/market_intelligence/active_run.json'), 'utf8')
  )
  const activeRunId = activeRunJson.active_run_id || 'RUN-20261217-001'
  const nichesCompactPath = path.join(
    ROOT,
    `ozon-react/public/data/market_intelligence/runs/${activeRunId}/niches_compact.json`
  )
  assert.ok(fs.existsSync(nichesCompactPath), `真实批次文件必须存在: ${nichesCompactPath}`)
  const niches = JSON.parse(fs.readFileSync(nichesCompactPath, 'utf8'))

  const targets = ['发泡胶枪', '热缩管', '拖车支轮']
  for (const name of targets) {
    const rawNiche = niches.find((n) => n.name === name)
    assert.ok(rawNiche, `批次数据中必须包含「${name}」`)

    const opp = buildOpportunityContext(rawNiche, { runId: activeRunId })
    assert.ok(opp.nicheUid && opp.nicheUid.startsWith('wb_niche_'), `${name} 的 nicheUid 必须有效: ${opp.nicheUid}`)
    assert.equal(opp.name, name, `${name} 名称匹配`)
    assert.ok(opp.category, `${name} 类目非空: ${opp.category}`)
    assert.ok(typeof opp.mos === 'number', `${name} MOS 必须为数值: ${opp.mos}`)
    assert.ok(typeof opp.pfs === 'number', `${name} PFS 必须为数值: ${opp.pfs}`)
    assert.ok(opp.gmv > 0, `${name} GMV 必须大于0: ${opp.gmv}`)
    assert.ok(Array.isArray(opp.risks), `${name} risks 必须为数组`)
    console.log(`  ✅ 真实数据【${name}】验证通过: UID=${opp.nicheUid}, Category=${opp.category}, MOS=${opp.mos}, PFS=${opp.pfs}, GMV=${opp.gmv}`)
  }
}

console.log('\n🎉 IA Opportunity Shell 全部 9 项测试通过！')
