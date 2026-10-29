import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// 模拟测试环境持久化存储
const mem = new Map()
globalThis.localStorage = {
  getItem: (k) => mem.get(k) ?? null,
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
}
globalThis.window = { location: { origin: 'http://localhost' } }

import {
  resolveProcurementNicheUid,
  buildProcurementIdentity,
  findProcurementQuote,
} from '../ozon-react/src/utils/marketIntelligence/procurementIdentity.js'
import {
  getManualQuotes,
  saveManualQuote,
  promoteToT6Candidate,
} from '../ozon-react/src/utils/marketIntelligence/miStore.js'
import * as t6Store from '../ozon-react/src/utils/t6/t6Store.js'

console.log('===== IA Procurement Identity Test Suite =====\n')

// -------------------------------------------------------------
// TEST 1: UID Resolver (uid > niche_uid, 空串 -> null)
// -------------------------------------------------------------
console.log('TEST 1: UID Resolver 优先级与空串防御')
assert.equal(resolveProcurementNicheUid({ uid: 'UID-001', niche_uid: 'UID-002' }), 'UID-001')
assert.equal(resolveProcurementNicheUid({ niche_uid: 'UID-002' }), 'UID-002')
assert.equal(resolveProcurementNicheUid({ uid: '  UID-003  ' }), 'UID-003')
assert.equal(resolveProcurementNicheUid({ uid: '   ' }), null)
assert.equal(resolveProcurementNicheUid({}), null)
assert.equal(resolveProcurementNicheUid(null), null)
console.log('  ✅ UID 解析优先级 (uid > niche_uid) 与空串归一通过')

// -------------------------------------------------------------
// TEST 2: Identity 基础契约
// -------------------------------------------------------------
console.log('TEST 2: buildProcurementIdentity 结构契约')
const id1 = buildProcurementIdentity({ uid: 'UID-A', name: '发泡胶枪' })
assert.deepEqual(id1, { uid: 'UID-A', name: '发泡胶枪' })

const id2 = buildProcurementIdentity({ niche_uid: 'UID-B', name: '  热缩管  ' })
assert.deepEqual(id2, { uid: 'UID-B', name: '热缩管' })

const id3 = buildProcurementIdentity({ name: '无UID商品' })
assert.deepEqual(id3, { uid: null, name: '无UID商品' })
console.log('  ✅ buildProcurementIdentity 返回标准 { uid, name } 契约通过')

// -------------------------------------------------------------
// TEST 3: UID lookup priority
// -------------------------------------------------------------
console.log('TEST 3: UID lookup 优先级高于 name')
const mockQuotes1 = {
  'UID-A': { uid: 'UID-A', name: '发泡胶枪', supplierName: 'UID首选供应商', factoryPriceCny: 18 },
  '发泡胶枪': { uid: null, name: '发泡胶枪', supplierName: '旧名称供应商', factoryPriceCny: 25 },
}
const found1 = findProcurementQuote(mockQuotes1, { uid: 'UID-A', name: '发泡胶枪' })
assert.equal(found1.supplierName, 'UID首选供应商')
assert.equal(found1.factoryPriceCny, 18)
console.log('  ✅ UID 命中时优先返回 UID 记录通过')

// -------------------------------------------------------------
// TEST 4: Legacy fallback
// -------------------------------------------------------------
console.log('TEST 4: Legacy Name 回退读取')
const mockQuotes2 = {
  '发泡胶枪': { uid: null, name: '发泡胶枪', supplierName: '老旧供应商', factoryPriceCny: 22 },
}
// 即使传入了新 UID，但 quotes 中只有 name 索引时仍能回退读取到
const found2 = findProcurementQuote(mockQuotes2, { uid: 'UID-NEW-999', name: '发泡胶枪' })
assert.ok(found2)
assert.equal(found2.supplierName, '老旧供应商')
assert.equal(found2.factoryPriceCny, 22)

// 都不匹配返回 null
assert.equal(findProcurementQuote(mockQuotes2, { uid: 'UID-X', name: '未录入商品' }), null)
console.log('  ✅ Legacy Name 回退与无记录返回 null 通过')

// -------------------------------------------------------------
// TEST 5: New save writes UID
// -------------------------------------------------------------
console.log('TEST 5: 新记录保存写入 UID 索引')
mem.clear()
const nicheA = { uid: 'wb_niche_foam_gun', name: '发泡胶枪' }
const quoteDataA = {
  supplierName: '义乌五金工具厂',
  supplierUrl: 'https://detail.1688.com/offer/123456.html',
  factoryPriceCny: 16.5,
  moq: 100,
  weightG: 380,
  dims: '25x15x5',
  domesticFreightCny: 2.0,
  internationalFreightCny: 13.5,
  targetPriceRub: 450,
  commissionRatePct: 15.0,
  priceProvenance: 'SUPPLIER_CONFIRMED',
  specProvenance: 'SUPPLIER_CONFIRMED',
  freightProvenance: 'LOGISTICS_CONFIRMED',
  regulationProvenance: 'REGULATION_VERIFIED',
  overallTrustTier: 'REGULATION_VERIFIED',
  netProfitCny: 8.5,
  marginPct: 22.6,
}
saveManualQuote(nicheA, quoteDataA)
const savedQuotes = getManualQuotes()
assert.ok(savedQuotes['wb_niche_foam_gun'], 'UID 键必须存在')
assert.equal(savedQuotes['wb_niche_foam_gun'].supplierName, '义乌五金工具厂')
console.log('  ✅ saveManualQuote 成功建立 UID 索引通过')

// -------------------------------------------------------------
// TEST 6: New save preserves name alias
// -------------------------------------------------------------
console.log('TEST 6: 新记录保存保留 Name Alias')
assert.ok(savedQuotes['发泡胶枪'], 'Name Alias 键必须存在')
assert.equal(savedQuotes['发泡胶枪'].supplierName, '义乌五金工具厂')
assert.equal(savedQuotes['发泡胶枪'].factoryPriceCny, 16.5)
console.log('  ✅ saveManualQuote 双键写入保留 Name Alias 通过')

// -------------------------------------------------------------
// TEST 7: entry.uid 存储真实 UID
// -------------------------------------------------------------
console.log('TEST 7: entry.uid 存储真实 UID')
assert.equal(savedQuotes['wb_niche_foam_gun'].uid, 'wb_niche_foam_gun')
assert.equal(savedQuotes['发泡胶枪'].uid, 'wb_niche_foam_gun')
console.log('  ✅ entry.uid 保持真实 UID 而非 null 校验通过')

// -------------------------------------------------------------
// TEST 8: Legacy no UID 兼容
// -------------------------------------------------------------
console.log('TEST 8: 无 UID 的 Legacy Niche 兼容')
const legacyNiche = { name: '老式测温枪' }
saveManualQuote(legacyNiche, { supplierName: '老款测温仪商行', factoryPriceCny: 30 })
const quotesAfterLegacy = getManualQuotes()
assert.ok(quotesAfterLegacy['老式测温枪'])
assert.equal(quotesAfterLegacy['老式测温枪'].uid, null)
assert.equal(quotesAfterLegacy['老式测温枪'].supplierName, '老款测温仪商行')
console.log('  ✅ 无 UID 纯名称保存与读取兼容通过')

// -------------------------------------------------------------
// TEST 9: Rename Safety (利基更名保持同一采购记录)
// -------------------------------------------------------------
console.log('TEST 9: 利基更名安全性 (Rename Safety)')
// 初始：UID-X + '发泡胶枪'
const nicheX = { uid: 'UID-X-001', name: '发泡胶枪' }
saveManualQuote(nicheX, { supplierName: '原始供应商A', factoryPriceCny: 15.0 })

// 随后利基更名为 '聚氨酯发泡胶枪'
const renamedNicheX = { uid: 'UID-X-001', name: '聚氨酯发泡胶枪' }
const retrievedRenamed = findProcurementQuote(getManualQuotes(), renamedNicheX)
assert.ok(retrievedRenamed, '利基更名后必须通过 UID 依然命中原报价')
assert.equal(retrievedRenamed.supplierName, '原始供应商A')

// 再次保存更新报价
saveManualQuote(renamedNicheX, { ...retrievedRenamed, supplierName: '更新后供应商B', factoryPriceCny: 14.0 })
const updatedQuotes = getManualQuotes()
assert.equal(updatedQuotes['UID-X-001'].supplierName, '更新后供应商B')
assert.equal(updatedQuotes['聚氨酯发泡胶枪'].supplierName, '更新后供应商B')
assert.equal(findProcurementQuote(updatedQuotes, renamedNicheX).supplierName, '更新后供应商B')
console.log('  ✅ Rename 场景下基于 UID 的稳定数据延续校验通过')

// -------------------------------------------------------------
// TEST 10: Same Name Different UID (同名不同 UID 物理隔离)
// -------------------------------------------------------------
console.log('TEST 10: 同名不同 UID 物理隔离与防碰撞')
const nicheGlove1 = { uid: 'UID-GLOVE-NITRILE', name: '防护手套' }
const nicheGlove2 = { uid: 'UID-GLOVE-LATEX', name: '防护手套' }

saveManualQuote(nicheGlove1, { supplierName: '丁腈手套源头工厂', factoryPriceCny: 2.5 })
saveManualQuote(nicheGlove2, { supplierName: '乳胶手套源头工厂', factoryPriceCny: 4.0 })

const quotesGloves = getManualQuotes()
const foundGlove1 = findProcurementQuote(quotesGloves, nicheGlove1)
const foundGlove2 = findProcurementQuote(quotesGloves, nicheGlove2)

assert.equal(foundGlove1.supplierName, '丁腈手套源头工厂')
assert.equal(foundGlove1.factoryPriceCny, 2.5)
assert.equal(foundGlove2.supplierName, '乳胶手套源头工厂')
assert.equal(foundGlove2.factoryPriceCny, 4.0)
console.log('  ✅ 同名不同 UID 物理隔离，各自报价互不串扰通过')

// -------------------------------------------------------------
// TEST 11: Candidate Identity 对拍测试
// -------------------------------------------------------------
console.log('TEST 11: Candidate Identity 对拍测试 (通过 source_niche_uid 定位 Phase 5)')
const candidateMock = {
  id: 'cand-uuid-12345',
  candidateName: '发泡胶枪',
  source_niche_uid: 'wb_niche_foam_gun',
  source_system: 'WB_MARKET_INTELLIGENCE',
}
const matchedQuote = findProcurementQuote(getManualQuotes(), {
  uid: candidateMock.source_niche_uid,
  name: candidateMock.candidateName,
})
assert.ok(matchedQuote, 'Candidate 必须通过 source_niche_uid 稳定定位 Phase 5 报价')
assert.equal(matchedQuote.supplierName, '义乌五金工具厂')
assert.equal(matchedQuote.uid, 'wb_niche_foam_gun')
console.log('  ✅ Candidate.source_niche_uid 对拍定位 Phase 5 报价通过')

// -------------------------------------------------------------
// TEST 12: Legacy Quote Backfill (旧数据在再次保存时自动补全 UID)
// -------------------------------------------------------------
console.log('TEST 12: Legacy Quote Backfill 测试')
mem.clear()
// 模拟历史系统中只有 name-keyed 的旧数据 (uid 为 null)
const oldStorage = {
  '热缩管': {
    uid: null,
    name: '热缩管',
    supplierName: '温州热缩材料厂',
    factoryPriceCny: 5.0,
    updatedAt: '2026-05-01T00:00:00.000Z',
  }
}
mem.set('mi_manual_procurement_quotes', JSON.stringify(oldStorage))

// 当前用户打开了具有 UID 的热缩管
const nicheHeatShrink = { uid: 'wb_niche_heat_shrink_001', name: '热缩管' }
const loadedOldDraft = findProcurementQuote(getManualQuotes(), nicheHeatShrink)
assert.ok(loadedOldDraft, '打开时通过 name 回退读取到旧数据')
assert.equal(loadedOldDraft.supplierName, '温州热缩材料厂')

// 用户点击保存采购草稿 (Backfill 发生)
saveManualQuote(nicheHeatShrink, {
  ...loadedOldDraft,
  supplierName: '温州热缩材料厂（已确认）',
  factoryPriceCny: 4.8,
})

const quotesAfterBackfill = getManualQuotes()
assert.ok(quotesAfterBackfill['wb_niche_heat_shrink_001'], 'Backfill 后 UID 键必须建立')
assert.equal(quotesAfterBackfill['wb_niche_heat_shrink_001'].uid, 'wb_niche_heat_shrink_001')
assert.equal(quotesAfterBackfill['wb_niche_heat_shrink_001'].factoryPriceCny, 4.8)
assert.equal(quotesAfterBackfill['热缩管'].uid, 'wb_niche_heat_shrink_001')
console.log('  ✅ Legacy Quote Backfill 机制验证通过')

// -------------------------------------------------------------
// TEST 13: ManualProcurementWorkbench 源码契约校验
// -------------------------------------------------------------
console.log('TEST 13: ManualProcurementWorkbench 源码契约校验')
const workbenchSource = fs.readFileSync(
  path.resolve('ozon-react/src/components/marketIntelligence/components/ManualProcurementWorkbench.jsx'),
  'utf-8'
)
assert.ok(
  workbenchSource.includes('findProcurementQuote'),
  'ManualProcurementWorkbench 必须引入并使用 findProcurementQuote'
)
assert.ok(
  workbenchSource.includes('findProcurementQuote(all, niche)'),
  'ManualProcurementWorkbench 加载草稿必须使用 findProcurementQuote(all, niche)'
)
assert.ok(
  workbenchSource.includes('saveManualQuote(niche,'),
  'ManualProcurementWorkbench 保存草稿必须传递完整 niche 对象'
)
console.log('  ✅ ManualProcurementWorkbench 基础契约校验通过')

// -------------------------------------------------------------
// TEST 14: ManualProcurementWorkbench 批次 runId 与错误隔离契约
// -------------------------------------------------------------
console.log('TEST 14: ManualProcurementWorkbench 显式 runId 传递与推流异常隔离契约')
assert.ok(
  workbenchSource.includes('runId'),
  'ManualProcurementWorkbench 必须声明接收 runId 属性'
)
assert.ok(
  /promoteToT6Candidate\s*\(\s*niche\s*,[\s\S]*?,\s*runId\s*\)/.test(workbenchSource),
  'ManualProcurementWorkbench 推流必须显式传入 runId，严禁落入默认旧批次'
)
assert.ok(
  workbenchSource.includes('promoteError'),
  'ManualProcurementWorkbench 必须包含 promoteError 状态以捕获并展示推流异常'
)
assert.ok(
  workbenchSource.includes('setPromoteError(err.message'),
  '推流异常时必须捕获并设置错误提示'
)
assert.ok(
  workbenchSource.includes('推流到 T6 候选池受阻'),
  'UI 界面中必须包含推流受阻时清晰可见的错误提示条'
)

// 校验父组件 MarketIntelligenceApp 将 currentRunId 显式透传
const parentSource = fs.readFileSync(
  path.resolve('ozon-react/src/components/marketIntelligence/MarketIntelligenceApp.jsx'),
  'utf-8'
)
assert.ok(
  parentSource.includes('<ManualProcurementWorkbench') &&
  parentSource.includes('runId={currentRunId}'),
  'MarketIntelligenceApp 必须将 currentRunId 显式传给 ManualProcurementWorkbench'
)
console.log('  ✅ ManualProcurementWorkbench 与 MarketIntelligenceApp 批次 runId 传递与异常隔离契约校验通过')

// -------------------------------------------------------------
// TEST 15: 旧批次无 UID 阻断与采购草稿安全保留闭环
// -------------------------------------------------------------
console.log('TEST 15: 旧批次无 UID 阻断与采购草稿安全保留闭环')
{
  mem.clear()
  t6Store._setAdapterForTests({
    get: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null),
    set: (k, v) => mem.set(k, JSON.stringify(v)),
    remove: (k) => mem.delete(k),
    keys: () => [...mem.keys()],
  })

  // 15.1 模拟来自历史旧批次 RUN-20260917-001 的利基（无 uid / niche_uid）
  const legacyBatchNiche = {
    id: 'legacy-niche-777',
    name: '旧批次手动工具',
    cat: '手动工具',
    price: 38,
    mos: 65,
  }

  // 模拟用户在采购工作台录入了采购草稿
  const procurementDraft = {
    supplierName: '旧批次源头五金厂',
    factoryPriceCny: 12.0,
    weightG: 300,
    moq: 100,
  }
  saveManualQuote(legacyBatchNiche, procurementDraft)

  // 验证采购草稿已安全保存
  const quotesBefore = getManualQuotes()
  assert.ok(quotesBefore['旧批次手动工具'], '采购草稿必须成功保存到本地存储')
  assert.equal(quotesBefore['旧批次手动工具'].supplierName, '旧批次源头五金厂')

  // 尝试在采购工作台中点击“核准并推送到 T6 候选立项”
  let caughtError = null
  try {
    promoteToT6Candidate(legacyBatchNiche, '旧批次采购核准推流', 'RUN-20260917-001')
  } catch (err) {
    caughtError = err
  }

  // 断言：缺少 UID 必须被阻断，抛出标准错误
  assert.ok(caughtError, '推流无 UID 利基必须抛出异常')
  assert.match(caughtError.message, /缺少有效 nicheUid/, '异常信息必须明确指出缺少有效 nicheUid')

  // 断言：T6 候选池严格零写入
  const t6Candidates = t6Store.listCandidates()
  assert.strictEqual(t6Candidates.length, 0, '推流阻断时 T6 候选池必须严格保持 0 条记录')

  // 断言：同一错误绝不会丢失用户的采购草稿输入
  const quotesAfter = getManualQuotes()
  assert.deepEqual(
    quotesAfter['旧批次手动工具'],
    quotesBefore['旧批次手动工具'],
    '推流异常时用户录入的采购草稿必须完好保留，绝不丢失'
  )

  // 15.2 模拟来自当前活跃批次 RUN-20261217-001 的新利基（具有合法 UID）
  const currentBatchNiche = {
    id: 'niche-active-888',
    uid: 'wb_niche_active_tool_888',
    name: '新批次手动工具',
    cat: '手动工具',
    price: 45,
    mos: 88,
  }

  // 推流新批次利基，显式传递 currentRunId = 'RUN-20261217-001'
  const promoteRes = promoteToT6Candidate(
    currentBatchNiche,
    '新批次采购核准推流',
    'RUN-20261217-001'
  )
  assert.strictEqual(promoteRes.created, true)
  assert.strictEqual(promoteRes.candidate.source_niche_uid, 'wb_niche_active_tool_888')
  assert.strictEqual(promoteRes.candidate.source_run_id, 'RUN-20261217-001', '显式传入的 runId 必须正确写入候选')
  assert.strictEqual(t6Store.listCandidates().length, 1)

  // 15.3 按钮文案区隔验证：保存草稿不等于候选推流成功
  assert.ok(workbenchSource.includes('保存采购草稿'), '工作台必须包含“保存采购草稿”按钮')
  assert.ok(workbenchSource.includes('已保存草稿！'), '草稿保存成功文案仅提示“已保存草稿！”')
  assert.ok(workbenchSource.includes('核准并推送到 T6 候选立项'), '候选推流按钮具有独立明确的操作文案')
  assert.ok(
    !workbenchSource.includes('saveManualQuote') || !workbenchSource.includes('已推送到 T6 候选池！'),
    '严禁在保存草稿处误报“已推送到 T6 候选池”'
  )
  console.log('  ✅ 旧批次无 UID 阻断、草稿保留与当前批次 runId 正确写入闭环校验通过')
}

console.log('\n🎉 IA Procurement Identity 全部 15 项测试通过！\n')
