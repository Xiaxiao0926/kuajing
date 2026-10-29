import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  SNAPSHOT_KIND,
  resolveSnapshotKind,
  validateProjectCreationSnapshot,
  buildMarketValidationSnapshotPayload,
} from '../ozon-react/src/utils/t6/candidateProjectEvidence.js'
import {
  _setAdapterForTests,
  ensureCandidate,
  getCandidate,
  createSnapshot,
  getSnapshot,
  createProject,
  getProject,
  createCostScenario,
  buildMarketValidationSnapshot,
  SNAPSHOT_KIND as STORE_SNAPSHOT_KIND,
  resolveSnapshotKind as storeResolveSnapshotKind,
} from '../ozon-react/src/utils/t6/t6Store.js'
import {
  evaluateProjectGate,
  snapshotStatusList,
  GATE_RESULTS,
  GATE_VERDICTS,
} from '../ozon-react/src/utils/t6/gateEngine.js'
import {
  buildOzonPrefill,
  buildWbPrefill,
} from '../ozon-react/src/utils/t6/costScenarioAdapter.js'

function createMemoryAdapter() {
  const store = new Map()
  return {
    get: (k) => (store.has(k) ? JSON.parse(JSON.stringify(store.get(k))) : null),
    set: (k, v) => { store.set(k, JSON.parse(JSON.stringify(v))) },
    keys: () => Array.from(store.keys()),
  }
}

console.log('===== IA Dual Snapshot Project Gate Test Suite =====\n')

// Fixture helpers
function makeCanonicalCandidate(overrides = {}) {
  return {
    id: 'cand-canon-001',
    sourceProductId: 'CANON-SKU-99',
    candidateName: '标准商品A',
    categoryLeaf: '收纳盒',
    categoryFull: '家居/收纳/收纳盒',
    latestSnapshotId: null,
    projectIds: [],
    ...overrides,
  }
}

function makeScoringSnapshot(overrides = {}) {
  return {
    candidateId: 'cand-canon-001',
    sourceProductId: 'CANON-SKU-99',
    scoreResult: {
      totalScore: 88,
      grade: 'A',
      status: [],
      decision: { status: 'ELIGIBLE', action: 'SAMPLE' },
    },
    sourceInputs: {
      name: '标准商品A',
      price_rub: 1200,
      weight_kg: 0.25,
      dims: [20, 10, 5],
      commission_rfbs: 12,
    },
    ...overrides,
  }
}

function makeMiCandidate(overrides = {}) {
  return {
    id: 'cand-mi-888',
    sourceProductId: 'wb-niche-niche_foam_gun',
    candidateName: '高压发泡胶枪',
    categoryLeaf: '发泡胶枪',
    categoryFull: '工具/气动工具/发泡胶枪',
    source_system: 'WB_MARKET_INTELLIGENCE',
    source_niche_uid: 'wb_niche_uid_foam_gun',
    latestSnapshotId: null,
    projectIds: [],
    marketEvidence: {
      schemaVersion: 1,
      nicheUid: 'wb_niche_uid_foam_gun',
      mos: 82.5,
      pfs: 94.0,
      gmv: 4500000,
      growth: 22.1,
      buyout: 87,
      sellers: 28,
      price: 1490,
      weightG: 380,
      heavy: 'NO',
      verdict: 'POTENTIAL',
      risks: ['PACKAGING_CRUSH'],
      eac_status: 'NOT_REQUIRED',
      certification_status: 'SELF_DECLARATION',
      syncedAt: '2026-09-18T09:00:00.000Z',
    },
    ...overrides,
  }
}

function makeValidQuote(overrides = {}) {
  return {
    uid: 'wb_niche_uid_foam_gun',
    name: '高压发泡胶枪',
    supplierName: '宁波精工气动制造厂',
    factoryPriceCny: 32.0,
    weightG: 380,
    dims: '30x20x8',
    targetPriceRub: 1490,
    moq: 200,
    leadTimeDays: 10,
    sampleStatus: 'PASS',
    updatedAt: '2026-09-18T09:15:00.000Z',
    ...overrides,
  }
}

// -------------------------------------------------------------
// TEST 1: Legacy 无 kind 快照解析为 SCORING
// -------------------------------------------------------------
console.log('TEST 1: Legacy 无 snapshotKind 快照解析为 SCORING')
const legacySnap = {
  id: 'snap-legacy-001',
  candidateId: 'cand-canon-001',
  sourceProductId: 'CANON-SKU-99',
  scoreResult: { totalScore: 75, grade: 'B' },
}
assert.equal(resolveSnapshotKind(legacySnap), SNAPSHOT_KIND.SCORING)
assert.equal(resolveSnapshotKind({ ...legacySnap, snapshotKind: undefined }), SNAPSHOT_KIND.SCORING)
console.log('  ✅ Legacy 无 kind 快照默认回退 SCORING 通过')

// -------------------------------------------------------------
// TEST 2: 正常 SCORING Project 创建成功
// -------------------------------------------------------------
console.log('TEST 2: 正常 SCORING Project 创建成功')
const memAdapter = createMemoryAdapter()
_setAdapterForTests(memAdapter)

const { candidate: canonCand } = ensureCandidate({
  sourceProductId: 'CANON-SKU-99',
  candidateIndex: 1,
  name: '标准商品A',
  categoryLeaf: '收纳盒',
  categoryFull: '家居/收纳/收纳盒',
})
const scoringSnap = createSnapshot(makeScoringSnapshot({ candidateId: canonCand.id }))

const scoringProj = createProject({
  candidateId: canonCand.id,
  creationSnapshotId: scoringSnap.id,
})
assert.ok(scoringProj.id)
assert.equal(scoringProj.source.creationSnapshotId, scoringSnap.id)
assert.equal(scoringProj.source.candidateId, canonCand.id)
console.log('  ✅ SCORING 立项成功并正确记录 creationSnapshotId')

// -------------------------------------------------------------
// TEST 3: SCORING candidateId mismatch 拒绝
// -------------------------------------------------------------
console.log('TEST 3: SCORING 快照 candidateId 不一致被拒绝')
const { candidate: otherCand } = ensureCandidate({
  sourceProductId: 'CANON-SKU-100',
  candidateIndex: 2,
  name: '商品B',
  categoryLeaf: '收纳盒',
  categoryFull: '家居/收纳/收纳盒',
})
assert.throws(
  () => {
    createProject({
      candidateId: otherCand.id,
      creationSnapshotId: scoringSnap.id, // scoringSnap belongs to canonCand.id
    })
  },
  /T6_STORE: 非法立项快照.*candidateId.*不一致/
)
console.log('  ✅ candidateId 不匹配拒绝通过')

// -------------------------------------------------------------
// TEST 4: SCORING sourceProductId mismatch 拒绝
// -------------------------------------------------------------
console.log('TEST 4: SCORING 快照 sourceProductId 不一致被拒绝')
const snapWrongPid = createSnapshot(
  makeScoringSnapshot({
    candidateId: canonCand.id,
    sourceProductId: 'DIFFERENT-PRODUCT-ID',
  })
)
assert.throws(
  () => {
    createProject({
      candidateId: canonCand.id,
      creationSnapshotId: snapWrongPid.id,
    })
  },
  /T6_STORE: 非法立项快照.*sourceProductId.*不一致/
)
console.log('  ✅ sourceProductId 不匹配拒绝通过')

// -------------------------------------------------------------
// TEST 5: 完整 MARKET_VALIDATION Snapshot 被 validator 接受
// -------------------------------------------------------------
console.log('TEST 5: 完整 MARKET_VALIDATION Snapshot 结构校验通过')
const miCandFixture = makeMiCandidate()
const quoteFixture = makeValidQuote()
const mvPayload = buildMarketValidationSnapshotPayload({
  candidate: miCandFixture,
  quote: quoteFixture,
})
const val5 = validateProjectCreationSnapshot({
  candidate: miCandFixture,
  snapshot: { ...mvPayload, id: 'snap-mv-mock' },
})
assert.equal(val5.valid, true)
assert.equal(val5.snapshotKind, SNAPSHOT_KIND.MARKET_VALIDATION)
assert.equal(val5.errors.length, 0)
console.log('  ✅ validateProjectCreationSnapshot 接受合规 MARKET_VALIDATION 快照')

// -------------------------------------------------------------
// TEST 6: Malformed MARKET_VALIDATION 拒绝
// -------------------------------------------------------------
console.log('TEST 6: 畸变 MARKET_VALIDATION 快照被严格拒绝')
// Case 6A: 缺失 procurementEvidence
const bad6A = { ...mvPayload, procurementEvidence: null }
const val6A = validateProjectCreationSnapshot({ candidate: miCandFixture, snapshot: bad6A })
assert.equal(val6A.valid, false)
assert.ok(val6A.errors.some((e) => e.includes('procurementEvidence')))

// Case 6B: 缺失 sourceInputs
const bad6B = { ...mvPayload, sourceInputs: null }
const val6B = validateProjectCreationSnapshot({ candidate: miCandFixture, snapshot: bad6B })
assert.equal(val6B.valid, false)
assert.ok(val6B.errors.some((e) => e.includes('sourceInputs')))

// Case 6C: 违规携带 scoreResult
const bad6C = { ...mvPayload, scoreResult: { totalScore: 80 } }
const val6C = validateProjectCreationSnapshot({ candidate: miCandFixture, snapshot: bad6C })
assert.equal(val6C.valid, false)
assert.ok(val6C.errors.some((e) => e.includes('scoreResult')))

// Case 6D: 内部 UID 不一致 (procurementEvidence.uid !== evidenceContext.sourceNicheUid)
const bad6D = {
  ...mvPayload,
  procurementEvidence: { ...mvPayload.procurementEvidence, uid: 'tampered_uid' },
}
const val6D = validateProjectCreationSnapshot({ candidate: miCandFixture, snapshot: bad6D })
assert.equal(val6D.valid, false)
assert.ok(val6D.errors.some((e) => e.includes('procurementEvidence.uid')))

// Case 6E: 版本不符合 market-validation-v1
const bad6E = { ...mvPayload, versions: { evidenceSchemaVersion: 'unknown-v9' } }
const val6E = validateProjectCreationSnapshot({ candidate: miCandFixture, snapshot: bad6E })
assert.equal(val6E.valid, false)
assert.ok(val6E.errors.some((e) => e.includes('evidenceSchemaVersion')))
console.log('  ✅ 各种形态的畸变 MARKET_VALIDATION 快照被正确拦截')

// -------------------------------------------------------------
// TEST 7: 未知 Snapshot kind 拒绝 (Fail-close)
// -------------------------------------------------------------
console.log('TEST 7: 未知快照类型拒绝')
const unknownSnap = {
  id: 'snap-unknown',
  snapshotKind: 'EXPERIMENTAL_AI_PREDICTION',
  candidateId: miCandFixture.id,
  sourceProductId: miCandFixture.sourceProductId,
}
const val7 = validateProjectCreationSnapshot({ candidate: miCandFixture, snapshot: unknownSnap })
assert.equal(val7.valid, false)
assert.ok(val7.errors.some((e) => e.includes('未知或不支持的快照类型')))
console.log('  ✅ 未知 Snapshot 类型被拒通过')

// -------------------------------------------------------------
// TEST 8: MARKET_VALIDATION 创建 Project 成功
// -------------------------------------------------------------
console.log('TEST 8: MARKET_VALIDATION 创建 Project 成功')
const { candidate: miCandSaved } = ensureCandidate({
  sourceProductId: 'wb-niche-niche_foam_gun',
  candidateIndex: 3,
  name: '高压发泡胶枪',
  categoryLeaf: '发泡胶枪',
  categoryFull: '工具/气动工具/发泡胶枪',
  source_system: 'WB_MARKET_INTELLIGENCE',
  source_niche_uid: 'wb_niche_uid_foam_gun',
  marketEvidence: makeMiCandidate().marketEvidence,
})
assert.equal(miCandSaved.latestSnapshotId, null)

const mvSnapshot = buildMarketValidationSnapshot({
  candidate: miCandSaved,
  quote: makeValidQuote(),
})
assert.equal(mvSnapshot.snapshotKind, SNAPSHOT_KIND.MARKET_VALIDATION)

const mvProject = createProject({
  candidateId: miCandSaved.id,
  creationSnapshotId: mvSnapshot.id,
})
assert.ok(mvProject.id)
assert.equal(mvProject.source.candidateId, miCandSaved.id)
console.log('  ✅ MARKET_VALIDATION 快照成功创建 Project')

// -------------------------------------------------------------
// TEST 9: Project source.creationSnapshotId 等于 MV Snapshot ID
// -------------------------------------------------------------
console.log('TEST 9: Project.source.creationSnapshotId 正确绑定 MV 快照 ID')
assert.equal(mvProject.source.creationSnapshotId, mvSnapshot.id)
assert.equal(mvProject.source.kind, 'candidate')
assert.equal('creationSnapshotKind' in mvProject.source, false, 'Project Schema 保持纯净不变')
console.log('  ✅ 契约绑定且未污染 Project Schema')

// -------------------------------------------------------------
// TEST 10: MI Candidate latestSnapshotId 创建 Project 后仍为 null
// -------------------------------------------------------------
console.log('TEST 10: MI Candidate latestSnapshotId 在立项后保持 null')
const miCandAfterProj = getCandidate(miCandSaved.id)
assert.equal(miCandAfterProj.latestSnapshotId, null)
assert.ok(miCandAfterProj.projectIds.includes(mvProject.id))
console.log('  ✅ Candidate latestSnapshotId 维持 null 且 projectIds 正常追加')

// -------------------------------------------------------------
// TEST 11: RESEARCH Gate: creationSnapshotId + snapshot实体 -> PASS
// -------------------------------------------------------------
console.log('TEST 11: RESEARCH Gate: creationSnapshotId + snapshot实体 -> PASS')
const gate11 = evaluateProjectGate(mvProject, 'RESEARCH', { snapshot: mvSnapshot })
assert.equal(gate11.direction, 'FORWARD')
assert.equal(gate11.verdict, GATE_VERDICTS.GREEN)
const researchCheck11 = gate11.checks.find((c) => c.id === 'snapshot_exists')
assert.ok(researchCheck11)
assert.equal(researchCheck11.label, '立项证据快照存在')
assert.equal(researchCheck11.result, GATE_RESULTS.PASS)
console.log('  ✅ RESEARCH Gate 实体完整且 label 中性化验证通过')

// -------------------------------------------------------------
// TEST 12: 只有 creationSnapshotId 但 deps.snapshot = null -> FAIL
// -------------------------------------------------------------
console.log('TEST 12: 只有 creationSnapshotId 但 deps.snapshot = null -> FAIL')
const gate12 = evaluateProjectGate(mvProject, 'RESEARCH', { snapshot: null })
assert.equal(gate12.verdict, GATE_VERDICTS.RED)
const researchCheck12 = gate12.checks.find((c) => c.id === 'snapshot_exists')
assert.ok(researchCheck12)
assert.equal(researchCheck12.result, GATE_RESULTS.FAIL)
assert.equal(researchCheck12.message, '立项证据快照实体缺失')
assert.ok(gate12.blockingReasons.includes('立项证据快照实体缺失'))
console.log('  ✅ 显式缺少快照实体时 Fail-close 触发正确阻断')

// -------------------------------------------------------------
// TEST 13: Scoring scoreResult.status = ['BLOCKED_LOGISTICS'] 仍触发原物流阻断
// -------------------------------------------------------------
console.log('TEST 13: Scoring scoreResult.status = [BLOCKED_LOGISTICS] 触发物流阻断')
const blockedScoringSnap = createSnapshot(
  makeScoringSnapshot({
    candidateId: canonCand.id,
    scoreResult: {
      totalScore: 40,
      grade: 'D',
      status: ['BLOCKED_LOGISTICS'],
    },
  })
)
assert.deepEqual(snapshotStatusList(blockedScoringSnap), ['BLOCKED_LOGISTICS'])

const gate13 = evaluateProjectGate(scoringProj, 'SAMPLING', {
  snapshot: blockedScoringSnap,
  availableModules: {},
})
assert.equal(gate13.verdict, GATE_VERDICTS.RED)
const logCheck13 = gate13.checks.find((c) => c.id === 'blocked_logistics')
assert.ok(logCheck13, '必须包含 blocked_logistics 检查项')
assert.equal(logCheck13.result, GATE_RESULTS.FAIL)
console.log('  ✅ 新路径 snapshot.scoreResult.status 被正确识别并触发阻断')

// -------------------------------------------------------------
// TEST 14: Legacy 顶层 snapshot.status 仍兼容
// -------------------------------------------------------------
console.log('TEST 14: Legacy 顶层 snapshot.status 仍兼容识别')
const legacyBlockedSnap = {
  id: 'snap-legacy-blocked',
  status: ['BLOCKED_LOGISTICS'],
}
assert.deepEqual(snapshotStatusList(legacyBlockedSnap), ['BLOCKED_LOGISTICS'])
const gate14 = evaluateProjectGate(scoringProj, 'SAMPLING', {
  snapshot: legacyBlockedSnap,
})
assert.equal(gate14.verdict, GATE_VERDICTS.RED)
assert.ok(gate14.checks.some((c) => c.id === 'blocked_logistics' && c.result === GATE_RESULTS.FAIL))
console.log('  ✅ Legacy 顶层 status 兼容通过')

// -------------------------------------------------------------
// TEST 15: MARKET_VALIDATION 不得从 marketEvidence.risks 伪造 BLOCKED_LOGISTICS
// -------------------------------------------------------------
console.log('TEST 15: MARKET_VALIDATION 快照即使 marketEvidence.risks 含 BLOCKED_LOGISTICS 也绝不伪造物流阻断')
const mvWithRisks = {
  ...mvSnapshot,
  marketEvidence: {
    ...mvSnapshot.marketEvidence,
    risks: ['BLOCKED_LOGISTICS', 'HEAVY_CARGO'],
  },
}
assert.deepEqual(snapshotStatusList(mvWithRisks), [])
const gate15 = evaluateProjectGate(mvProject, 'SAMPLING', {
  snapshot: mvWithRisks,
  availableModules: {},
})
const logCheck15 = gate15.checks.find((c) => c.id === 'blocked_logistics')
assert.equal(logCheck15, undefined, '绝不能为 MARKET_VALIDATION 触发 blocked_logistics 检查')
console.log('  ✅ 事实源严格隔离，无虚构物流阻断')

// -------------------------------------------------------------
// TEST 16: MARKET_VALIDATION Project 可成功 createCostScenario
// -------------------------------------------------------------
console.log('TEST 16: MARKET_VALIDATION Project 成功接入 createCostScenario 链条')
const costScenarioRecord = createCostScenario({
  projectId: mvProject.id,
  platform: 'OZON',
  name: '测试首个基线场景',
  sourceSnapshotId: mvProject.source.creationSnapshotId,
  inputPayload: { price: 1490, weight: 0.38 },
  resolvedConfig: {
    calculatorVersion: 'ozon-rfbs-single-v1',
    exchange_rate: 13.0,
  },
  outputPayload: {
    profit: 350,
    profitRate: 23.5,
  },
})
assert.ok(costScenarioRecord.id)
assert.equal(costScenarioRecord.projectId, mvProject.id)
assert.equal(costScenarioRecord.sourceSnapshotId, mvSnapshot.id)

const projAfterCost = getProject(mvProject.id)
assert.equal(projAfterCost.costing.baselineScenarioId, costScenarioRecord.id)
assert.ok(projAfterCost.costing.scenarios.includes(costScenarioRecord.id))
console.log('  ✅ MARKET_VALIDATION 快照为创建 Project 并冻结 CostScenario 提供了合法链路')

// -------------------------------------------------------------
// TEST 17: buildOzonPrefill(MV) 字段映射正确
// -------------------------------------------------------------
console.log('TEST 17: buildOzonPrefill 消费 MARKET_VALIDATION sourceInputs 零改动验证')
const ozonPrefill = buildOzonPrefill({ snapshot: mvSnapshot })
assert.equal(ozonPrefill.price, 1490)
assert.equal(ozonPrefill.weight, 0.38)
assert.equal(ozonPrefill.length, 30)
assert.equal(ozonPrefill.width, 20)
assert.equal(ozonPrefill.height, 8)
assert.equal(ozonPrefill.commission, '', 'null 佣金应安全转化为空输入，不虚构 Ozon 佣金')
console.log('  ✅ buildOzonPrefill 完美兼容')

// -------------------------------------------------------------
// TEST 18: buildWbPrefill(MV) 字段映射正确
// -------------------------------------------------------------
console.log('TEST 18: buildWbPrefill 消费 MARKET_VALIDATION sourceInputs 零改动验证')
const wbPrefill = buildWbPrefill({ snapshot: mvSnapshot })
assert.equal(wbPrefill.productName, '高压发泡胶枪')
assert.equal(wbPrefill.actualWeightG, 380)
assert.equal(wbPrefill.lengthCm, 30)
assert.equal(wbPrefill.widthCm, 20)
assert.equal(wbPrefill.heightCm, 8)
assert.equal(wbPrefill.sellerRevenueRub, 1490)
console.log('  ✅ buildWbPrefill 完美兼容')

// -------------------------------------------------------------
// TEST 19: SNAPSHOT_KIND 与 resolveSnapshotKind 单一事实源契约
// -------------------------------------------------------------
console.log('TEST 19: 检查 SNAPSHOT_KIND 与 resolveSnapshotKind 单一事实源引用')
assert.equal(STORE_SNAPSHOT_KIND, SNAPSHOT_KIND)
assert.equal(storeResolveSnapshotKind, resolveSnapshotKind)

const evidenceFile = path.resolve('ozon-react/src/utils/t6/candidateProjectEvidence.js')
const storeFile = path.resolve('ozon-react/src/utils/t6/t6Store.js')
const gateFile = path.resolve('ozon-react/src/utils/t6/gateEngine.js')

const evidenceCode = fs.readFileSync(evidenceFile, 'utf-8')
const storeCode = fs.readFileSync(storeFile, 'utf-8')
const gateCode = fs.readFileSync(gateFile, 'utf-8')

// candidateProjectEvidence.js 为源头定义
assert.match(evidenceCode, /export\s+const\s+SNAPSHOT_KIND\s*=/)
assert.match(evidenceCode, /export\s+function\s+resolveSnapshotKind\s*\(/)

// t6Store.js 只 import 并 re-export
assert.match(storeCode, /import\s*\{[^}]*SNAPSHOT_KIND[^}]*\}\s*from\s*['"]\.\/candidateProjectEvidence\.js['"]/)
assert.match(storeCode, /export\s*\{[^}]*SNAPSHOT_KIND[^}]*\}/)
assert.doesNotMatch(storeCode, /const\s+SNAPSHOT_KIND\s*=\s*\{/)

// gateEngine.js 只 import
assert.match(gateCode, /import\s*\{[^}]*SNAPSHOT_KIND[^}]*\}\s*from\s*['"]\.\/candidateProjectEvidence\.js['"]/)
console.log('  ✅ 单一事实源契约静态检查通过')

console.log('\n===== All 19 IA Dual Snapshot Project Gate Tests Passed Successfully! =====')
