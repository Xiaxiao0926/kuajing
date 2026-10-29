import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  SNAPSHOT_KIND,
  resolveSnapshotKind,
  parseProcurementDims,
  evaluateMarketValidationEligibility,
  buildMarketValidationSnapshotPayload,
  findLatestMarketValidationSnapshot,
} from '../ozon-react/src/utils/t6/candidateProjectEvidence.js'
import {
  _setAdapterForTests,
  ensureCandidate,
  getCandidate,
  listSnapshots,
  getSnapshot,
  buildMarketValidationSnapshot,
} from '../ozon-react/src/utils/t6/t6Store.js'

function createMemoryAdapter() {
  const store = new Map()
  return {
    get: (k) => (store.has(k) ? JSON.parse(JSON.stringify(store.get(k))) : null),
    set: (k, v) => { store.set(k, JSON.parse(JSON.stringify(v))) },
    keys: () => Array.from(store.keys()),
  }
}

console.log('===== IA Market Validation Snapshot Test Suite =====\n')

// -------------------------------------------------------------
// TEST 1: Legacy snapshot without snapshotKind resolves to 'SCORING'
// -------------------------------------------------------------
console.log('TEST 1: Legacy snapshot 没有 snapshotKind 时解析为 SCORING')
const legacySnapshot = {
  id: 'snap-legacy-001',
  scoreResult: { totalScore: 82, grade: 'B' },
  sourceInputs: { name: '老商品' },
}
assert.equal(resolveSnapshotKind(legacySnapshot), SNAPSHOT_KIND.SCORING)
assert.equal(resolveSnapshotKind(null), null)
assert.equal(resolveSnapshotKind(undefined), null)
console.log('  ✅ Legacy snapshot 默认回退 SCORING 通过')

// -------------------------------------------------------------
// TEST 2: New MARKET_VALIDATION snapshot recognized
// -------------------------------------------------------------
console.log('TEST 2: 新快照 snapshotKind 正确识别为 MARKET_VALIDATION')
assert.equal(SNAPSHOT_KIND.SCORING, 'SCORING')
assert.equal(SNAPSHOT_KIND.MARKET_VALIDATION, 'MARKET_VALIDATION')
const evidenceSnapshot = {
  id: 'snap-mv-001',
  snapshotKind: SNAPSHOT_KIND.MARKET_VALIDATION,
  candidateId: 'cand-001',
}
assert.equal(resolveSnapshotKind(evidenceSnapshot), SNAPSHOT_KIND.MARKET_VALIDATION)
console.log('  ✅ MARKET_VALIDATION 快照类型识别通过')

// -------------------------------------------------------------
// Fixture Helper for Candidate & Quote
// -------------------------------------------------------------
function makeValidCandidate(overrides = {}) {
  return {
    id: 'cand-mi-101',
    sourceProductId: 'wb-niche-niche_test_001',
    candidateName: '高压发泡胶枪',
    categoryLeaf: '发泡胶枪',
    categoryFull: '工具/气动工具/发泡胶枪',
    source_system: 'WB_MARKET_INTELLIGENCE',
    source_niche_uid: 'wb_niche_uid_001',
    source_niche_id: 'niche_test_001',
    source_run_id: 'RUN-20260918-01',
    latestSnapshotId: null,
    marketEvidence: {
      schemaVersion: 1,
      nicheUid: 'wb_niche_uid_001',
      runId: 'RUN-20260918-01',
      mos: 78.5,
      pfs: 92.0,
      gmv: 5600000,
      growth: 15.2,
      buyout: 85,
      sellers: 35,
      price: 1250,
      weightG: 480,
      heavy: 'NO',
      verdict: 'POTENTIAL',
      risks: ['PACKAGING_CRUSH'],
      eac_status: 'NOT_REQUIRED',
      certification_status: 'SELF_DECLARATION',
      syncedAt: '2026-09-18T08:00:00.000Z',
    },
    ...overrides,
  }
}

function makeValidQuote(overrides = {}) {
  return {
    uid: 'wb_niche_uid_001',
    name: '高压发泡胶枪',
    supplierName: '金华市精密工具有限公司',
    factoryPriceCny: 28.5,
    weightG: 480,
    dims: '25x15x6',
    targetPriceRub: 1250,
    moq: 100,
    leadTimeDays: 7,
    sampleStatus: 'PASS',
    updatedAt: '2026-09-18T08:30:00.000Z',
    ...overrides,
  }
}

// -------------------------------------------------------------
// TEST 3: Non-MI candidate -> eligible: false
// -------------------------------------------------------------
console.log('TEST 3: 非 WB_MARKET_INTELLIGENCE 来源 -> eligible: false')
const nonMiCand = makeValidCandidate({ source_system: 'OZON_MANUAL' })
const res3 = evaluateMarketValidationEligibility({ candidate: nonMiCand, quote: makeValidQuote() })
assert.equal(res3.eligible, false)
assert.ok(res3.missing.includes('mi_source'))
console.log('  ✅ 非 MI 来源候选被正确拒绝')

// -------------------------------------------------------------
// TEST 4: Missing UID -> eligible: false
// -------------------------------------------------------------
console.log('TEST 4: 缺失 source_niche_uid -> eligible: false')
const noUidCand = makeValidCandidate({ source_niche_uid: null })
const res4 = evaluateMarketValidationEligibility({ candidate: noUidCand, quote: makeValidQuote() })
assert.equal(res4.eligible, false)
assert.ok(res4.missing.includes('stable_niche_uid'))
console.log('  ✅ 缺失稳定利基 UID 被正确拒绝')

// -------------------------------------------------------------
// TEST 5: marketEvidence nicheUid mismatch -> eligible: false
// -------------------------------------------------------------
console.log('TEST 5: marketEvidence.nicheUid 不匹配 -> eligible: false')
const mismatchEvCand = makeValidCandidate({
  marketEvidence: { ...makeValidCandidate().marketEvidence, nicheUid: 'mismatched_uid' },
})
const res5 = evaluateMarketValidationEligibility({ candidate: mismatchEvCand, quote: makeValidQuote() })
assert.equal(res5.eligible, false)
assert.ok(res5.missing.includes('market_evidence'))

const noEvCand = makeValidCandidate({ marketEvidence: null })
const res5b = evaluateMarketValidationEligibility({ candidate: noEvCand, quote: makeValidQuote() })
assert.equal(res5b.eligible, false)
assert.ok(res5b.missing.includes('market_evidence'))
console.log('  ✅ 市场证据 UID 不一致或缺失被正确拒绝')

// -------------------------------------------------------------
// TEST 6: Quote UID mismatch / null UID -> eligible: false
// -------------------------------------------------------------
console.log('TEST 6: Quote UID 不匹配或为 null -> eligible: false')
const quoteWrongUid = makeValidQuote({ uid: 'other_uid_999' })
const res6 = evaluateMarketValidationEligibility({ candidate: makeValidCandidate(), quote: quoteWrongUid })
assert.equal(res6.eligible, false)
assert.ok(res6.missing.includes('procurement_quote'))

const quoteNullUid = makeValidQuote({ uid: null })
const res6b = evaluateMarketValidationEligibility({ candidate: makeValidCandidate(), quote: quoteNullUid })
assert.equal(res6b.eligible, false)
assert.ok(res6b.missing.includes('procurement_quote'))

const res6c = evaluateMarketValidationEligibility({ candidate: makeValidCandidate(), quote: null })
assert.equal(res6c.eligible, false)
assert.ok(res6c.missing.includes('procurement_quote'))
console.log('  ✅ 采购报价 UID 校验（防御纯名称关联）通过')

// -------------------------------------------------------------
// TEST 7: Missing supplierName -> eligible: false
// -------------------------------------------------------------
console.log('TEST 7: 缺失供应商名称 -> eligible: false')
const quoteNoSupplier = makeValidQuote({ supplierName: '   ' })
const res7 = evaluateMarketValidationEligibility({ candidate: makeValidCandidate(), quote: quoteNoSupplier })
assert.equal(res7.eligible, false)
assert.ok(res7.missing.includes('supplier'))
console.log('  ✅ 缺失供应商名称被正确拒绝')

// -------------------------------------------------------------
// TEST 8: Missing / invalid factoryPriceCny -> eligible: false
// -------------------------------------------------------------
console.log('TEST 8: 出厂价非正数或缺失 -> eligible: false')
for (const badPrice of [0, -10, null, undefined, 'abc']) {
  const q = makeValidQuote({ factoryPriceCny: badPrice })
  const r = evaluateMarketValidationEligibility({ candidate: makeValidCandidate(), quote: q })
  assert.equal(r.eligible, false)
  assert.ok(r.missing.includes('factory_price'))
}
console.log('  ✅ 非法出厂价全部被正确拒绝')

// -------------------------------------------------------------
// TEST 9: Missing / invalid weightG -> eligible: false
// -------------------------------------------------------------
console.log('TEST 9: 实测重量非正数或缺失 -> eligible: false')
for (const badWeight of [0, -50, null, undefined, 'xyz']) {
  const q = makeValidQuote({ weightG: badWeight })
  const r = evaluateMarketValidationEligibility({ candidate: makeValidCandidate(), quote: q })
  assert.equal(r.eligible, false)
  assert.ok(r.missing.includes('measured_weight'))
}
console.log('  ✅ 非法实测单重全部被正确拒绝')

// -------------------------------------------------------------
// TEST 10: Dims parsing and validation
// -------------------------------------------------------------
console.log('TEST 10: Dims 解析与有效性校验')
assert.deepEqual(parseProcurementDims('20x15x5'), [20, 15, 5])
assert.deepEqual(parseProcurementDims('20*15*5'), [20, 15, 5])
assert.deepEqual(parseProcurementDims('20×15×5'), [20, 15, 5])
assert.deepEqual(parseProcurementDims(' 25.5 x 10.2 x 4 '), [25.5, 10.2, 4])
assert.deepEqual(parseProcurementDims([30, 20, 10]), [30, 20, 10])
assert.deepEqual(parseProcurementDims({ lengthCm: 18, widthCm: 12, heightCm: 6 }), [18, 12, 6])
assert.deepEqual(parseProcurementDims({ length: 18, width: 12, height: 6 }), [18, 12, 6])

assert.equal(parseProcurementDims(''), null)
assert.equal(parseProcurementDims('abc'), null)
assert.equal(parseProcurementDims('20x15'), null)
assert.equal(parseProcurementDims('20x15x0'), null)
assert.equal(parseProcurementDims('-5x15x10'), null)
assert.equal(parseProcurementDims([20, 15]), null)
assert.equal(parseProcurementDims([20, 15, -5]), null)
assert.equal(parseProcurementDims({ length: 20, width: 0, height: 5 }), null)
assert.equal(parseProcurementDims(null), null)

const quoteBadDims = makeValidQuote({ dims: 'invalid-dims' })
const res10 = evaluateMarketValidationEligibility({ candidate: makeValidCandidate(), quote: quoteBadDims })
assert.equal(res10.eligible, false)
assert.ok(res10.missing.includes('package_dims'))
console.log('  ✅ 外包装尺寸多种分隔符解析与 Fail-close 校验通过')

// -------------------------------------------------------------
// TEST 11: Missing / invalid targetPriceRub -> eligible: false
// -------------------------------------------------------------
console.log('TEST 11: 目标售价非正数或缺失 -> eligible: false')
for (const badPrice of [0, -100, null, undefined, 'free']) {
  const q = makeValidQuote({ targetPriceRub: badPrice })
  const r = evaluateMarketValidationEligibility({ candidate: makeValidCandidate(), quote: q })
  assert.equal(r.eligible, false)
  assert.ok(r.missing.includes('target_price'))
}
console.log('  ✅ 非法目标售价全部被正确拒绝')

// -------------------------------------------------------------
// TEST 12: Complete valid candidate + quote -> eligible: true
// -------------------------------------------------------------
console.log('TEST 12: 完整合法 Candidate + Quote -> eligible: true')
const res12 = evaluateMarketValidationEligibility({
  candidate: makeValidCandidate(),
  quote: makeValidQuote(),
})
assert.equal(res12.eligible, true)
assert.equal(res12.missing.length, 0)
assert.equal(res12.checks.length, 10)
assert.ok(res12.checks.every((c) => c.pass === true))
console.log('  ✅ 10 项事实性完整性检查全部通过')

// -------------------------------------------------------------
// TEST 13: Payload has no scoreResult / grade / totalScore / decision
// -------------------------------------------------------------
console.log('TEST 13: Payload 严禁包含评分字段')
const validCand = makeValidCandidate()
const validQuote = makeValidQuote()
const payload = buildMarketValidationSnapshotPayload({ candidate: validCand, quote: validQuote })

assert.equal(payload.snapshotKind, SNAPSHOT_KIND.MARKET_VALIDATION)
assert.equal(payload.candidateId, validCand.id)
assert.equal(payload.sourceProductId, validCand.sourceProductId)
assert.equal('scoreResult' in payload, false, 'payload 绝对不能有 scoreResult')
assert.equal('grade' in payload, false, 'payload 绝对不能有 grade')
assert.equal('totalScore' in payload, false, 'payload 绝对不能有 totalScore')
assert.equal('decision' in payload, false, 'payload 绝对不能有 decision')
console.log('  ✅ 绝无伪造评分字段校验通过')

// -------------------------------------------------------------
// TEST 14: sourceInputs correctly frozen
// -------------------------------------------------------------
console.log('TEST 14: sourceInputs 严格冻结物理事实与价格')
assert.equal(payload.sourceInputs.name, '高压发泡胶枪')
assert.equal(payload.sourceInputs.price_rub, 1250)
assert.equal(payload.sourceInputs.avg_price_rub, null)
assert.equal(payload.sourceInputs.weight_kg, 0.48) // 480g -> 0.48kg
assert.deepEqual(payload.sourceInputs.dims, [25, 15, 6])
assert.equal(payload.sourceInputs.commission_rfbs, null, '绝不能将 WB 佣金冒充为 Ozon 佣金')
assert.equal(payload.sourceInputs.category_leaf, '发泡胶枪')
assert.equal(payload.sourceInputs.category_full, '工具/气动工具/发泡胶枪')
console.log('  ✅ sourceInputs 物理事实与佣金 null 校验通过')

// -------------------------------------------------------------
// TEST 15: Market & procurement evidence deep copied
// -------------------------------------------------------------
console.log('TEST 15: 证据深拷贝冻结（外部修改不影响快照载荷）')
const candToMutate = makeValidCandidate()
const quoteToMutate = makeValidQuote()
const clonedPayload = buildMarketValidationSnapshotPayload({ candidate: candToMutate, quote: quoteToMutate })

candToMutate.marketEvidence.mos = 999
quoteToMutate.supplierName = '已被篡改的供应商'

assert.equal(clonedPayload.marketEvidence.mos, 78.5)
assert.equal(clonedPayload.procurementEvidence.supplierName, '金华市精密工具有限公司')
console.log('  ✅ 市场与采购证据深拷贝不可变校验通过')

// -------------------------------------------------------------
// TEST 16: Candidate latestSnapshotId remains null
// -------------------------------------------------------------
console.log('TEST 16: 构建快照后 Candidate latestSnapshotId 依然保持 null')
const memAdapter = createMemoryAdapter()
_setAdapterForTests(memAdapter)

const { candidate: savedCand } = ensureCandidate({
  sourceProductId: 'wb-niche-uid_test_999',
  candidateIndex: 1,
  name: '测试利基商品',
  categoryLeaf: '测试类目',
  categoryFull: '顶级/二级/测试类目',
  source_system: 'WB_MARKET_INTELLIGENCE',
  source_niche_uid: 'uid_test_999',
  marketEvidence: {
    schemaVersion: 1,
    nicheUid: 'uid_test_999',
    mos: 80,
    pfs: 90,
  },
})
assert.equal(savedCand.latestSnapshotId, null)

const quoteForCand = makeValidQuote({ uid: 'uid_test_999' })
const createdSnapshot = buildMarketValidationSnapshot({
  candidate: savedCand,
  quote: quoteForCand,
})

const candAfter = getCandidate(savedCand.id)
assert.equal(candAfter.latestSnapshotId, null, 'MI Candidate latestSnapshotId 必须保持 null')
assert.ok(createdSnapshot.id.startsWith('t6-') || createdSnapshot.id.length > 10)
assert.equal(createdSnapshot.snapshotKind, SNAPSHOT_KIND.MARKET_VALIDATION)

const allSnapshots = listSnapshots()
const latestMv = findLatestMarketValidationSnapshot(allSnapshots, savedCand.id)
assert.ok(latestMv)
assert.equal(latestMv.id, createdSnapshot.id)
console.log('  ✅ Candidate latestSnapshotId 维持 null 且快照成功进入 t6.snapshot.* 存储')

// -------------------------------------------------------------
// TEST 17: No fake scoring in candidateProjectEvidence source code
// -------------------------------------------------------------
console.log('TEST 17: candidateProjectEvidence.js 静态检查无假评分代码')
const evidenceCodePath = path.resolve('ozon-react/src/utils/t6/candidateProjectEvidence.js')
const evidenceCode = fs.readFileSync(evidenceCodePath, 'utf-8')
assert.doesNotMatch(evidenceCode, /scoreProduct\s*\(/)
assert.doesNotMatch(evidenceCode, /scoreAllCandidates\s*\(/)
assert.doesNotMatch(evidenceCode, /totalScore\s*:/)
assert.doesNotMatch(evidenceCode, /grade\s*:\s*['"][ABCD]/)
console.log('  ✅ 静态源码无伪造评分逻辑校验通过')

// -------------------------------------------------------------
// TEST 18: No project creation in candidateProjectEvidence
// -------------------------------------------------------------
console.log('TEST 18: candidateProjectEvidence.js 不导入也不执行 createProject')
assert.doesNotMatch(evidenceCode, /import\s+.*createProject/)
assert.doesNotMatch(evidenceCode, /createProject\s*\(/)
console.log('  ✅ 物理隔离：不产生任何 Project 创建副作用')

// -------------------------------------------------------------
// TEST 19: Append-only immutability
// -------------------------------------------------------------
console.log('TEST 19: Append-only 不可变性：快照仅追加，互不干扰')
const quote2 = makeValidQuote({ uid: 'uid_test_999', targetPriceRub: 1399 })
const snapshot2 = buildMarketValidationSnapshot({
  candidate: savedCand,
  quote: quote2,
})

assert.notEqual(createdSnapshot.id, snapshot2.id)
const snap1Read = getSnapshot(createdSnapshot.id)
assert.equal(snap1Read.sourceInputs.price_rub, 1250)
const snap2Read = getSnapshot(snapshot2.id)
assert.equal(snap2Read.sourceInputs.price_rub, 1399)
console.log('  ✅ 追加式不可变性校验通过（两份独立证据快照共存）')

console.log('\n===== All 19 IA Market Validation Snapshot Tests Passed Successfully! =====')
