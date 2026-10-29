import assert from 'node:assert/strict'
import {
  resolveNicheUid,
  buildMiCandidateSourceProductId,
  buildCandidateMarketEvidence,
} from '../ozon-react/src/utils/marketIntelligence/candidateMarketBridge.js'
import {
  _setAdapterForTests,
  ensureCandidate,
  getCandidate,
  listCandidates,
  listLogs,
} from '../ozon-react/src/utils/t6/t6Store.js'
import {
  promoteToT6Candidate,
} from '../ozon-react/src/utils/marketIntelligence/miStore.js'

function createMemoryAdapter() {
  const store = new Map()
  return {
    get: (k) => (store.has(k) ? JSON.parse(JSON.stringify(store.get(k))) : null),
    set: (k, v) => { store.set(k, JSON.parse(JSON.stringify(v))) },
    keys: () => Array.from(store.keys()),
  }
}

console.log('===== IA Candidate Market Bridge Test Suite =====\n')

// -------------------------------------------------------------
// TEST 1: Adapter 完整生成各字段
// -------------------------------------------------------------
console.log('TEST 1: buildCandidateMarketEvidence 完整字段生成')
const sampleNiche = {
  uid: 'wb_niche_test_001',
  mos: 73.7,
  pfs: 95.0,
  gmv: 7785641,
  growth: 18.5,
  buyout: 88,
  sellers: 42,
  price: 350,
  weight_g: 450,
  heavy: 'NO',
  verdict: 'TEST',
  risks: ['CERT_REQUIRED', 'SEASONAL'],
  eac_status: 'NOT_REQUIRED',
  certification_status: 'SELF_DECLARATION',
}
const evidence = buildCandidateMarketEvidence(sampleNiche, 'RUN-20260917-001', 'VERIFY')
assert.equal(evidence.schemaVersion, 1)
assert.equal(evidence.nicheUid, 'wb_niche_test_001')
assert.equal(evidence.runId, 'RUN-20260917-001')
assert.equal(evidence.mos, 73.7)
assert.equal(evidence.pfs, 95.0)
assert.equal(evidence.gmv, 7785641)
assert.equal(evidence.growth, 18.5)
assert.equal(evidence.buyout, 88)
assert.equal(evidence.sellers, 42)
assert.equal(evidence.price, 350)
assert.equal(evidence.weightG, 450)
assert.equal(evidence.heavy, 'NO')
assert.equal(evidence.verdict, 'VERIFY', 'effectiveVerdict 应覆盖原 verdict')
assert.deepEqual(evidence.risks, ['CERT_REQUIRED', 'SEASONAL'])
assert.equal(evidence.eacStatus, 'NOT_REQUIRED')
assert.equal(evidence.certificationStatus, 'SELF_DECLARATION')
assert.ok(evidence.syncedAt && !isNaN(Date.parse(evidence.syncedAt)))
console.log('  ✅ 完整字段结构生成校验通过')

// -------------------------------------------------------------
// TEST 2: CFS fallback 统一映射至 pfs
// -------------------------------------------------------------
console.log('TEST 2: CFS fallback 映射至 pfs')
const cfsNiche = { uid: 'wb_002', cfs: 78.5 }
const cfsEv = buildCandidateMarketEvidence(cfsNiche, 'RUN-1')
assert.equal(cfsEv.pfs, 78.5, '未提供 pfs 时应 fallback 至 cfs')
assert.equal(cfsEv.cfs, undefined, '严禁生成 cfs 字段')

const bothNiche = { uid: 'wb_003', pfs: 90, cfs: 80 }
const bothEv = buildCandidateMarketEvidence(bothNiche, 'RUN-1')
assert.equal(bothEv.pfs, 90, '同时提供时 pfs 优先')
console.log('  ✅ CFS fallback 与命名单一性校验通过')

// -------------------------------------------------------------
// TEST 3: UID 解析优先级
// -------------------------------------------------------------
console.log('TEST 3: UID 解析优先级 (uid > niche_uid)')
assert.equal(resolveNicheUid({ uid: '  uid_a  ', niche_uid: 'uid_b' }), 'uid_a')
assert.equal(resolveNicheUid({ niche_uid: 'uid_b' }), 'uid_b')
assert.equal(resolveNicheUid({ uid: '   ' }), null)
assert.equal(resolveNicheUid({}), null)
assert.equal(resolveNicheUid(null), null)
console.log('  ✅ UID 解析优先级校验通过')

// -------------------------------------------------------------
// TEST 4: Stable sourceProductId 构造规则
// -------------------------------------------------------------
console.log('TEST 4: Stable sourceProductId 构造 (有 UID / 无 UID)')
assert.equal(
  buildMiCandidateSourceProductId({ uid: 'wb_niche_d0198d600bed', name: '发泡胶枪' }),
  'wb-niche-wb_niche_d0198d600bed'
)
assert.equal(
  buildMiCandidateSourceProductId({ name: '旧商品无UID' }),
  'wb-niche-旧商品无UID'
)
console.log('  ✅ Stable sourceProductId 构造规则校验通过')

// -------------------------------------------------------------
// 切换至测试用内存 Adapter
// -------------------------------------------------------------
_setAdapterForTests(createMemoryAdapter())

// -------------------------------------------------------------
// TEST 5: 新 Candidate 写入完整来源与市场证据
// -------------------------------------------------------------
console.log('TEST 5: 新 Candidate 写入 source_niche_uid 与 marketEvidence')
const p1 = promoteToT6Candidate(
  {
    uid: 'wb_uid_gun_001',
    name: '发泡胶枪',
    category: '手动工具',
    mos: 80.2,
    pfs: 91.0,
    gmv: 5000000,
    price: 320,
    weight_g: 400,
  },
  '初始推荐',
  'RUN-A'
)
assert.equal(p1.created, true)
assert.equal(p1.candidate.sourceProductId, 'wb-niche-wb_uid_gun_001')
assert.equal(p1.candidate.source_niche_uid, 'wb_uid_gun_001')
assert.equal(p1.candidate.source_run_id, 'RUN-A')
assert.equal(p1.candidate.source_system, 'WB_MARKET_INTELLIGENCE')
assert.equal(p1.candidate.bizStatus, '待调研')
assert.ok(p1.candidate.marketEvidence)
assert.equal(p1.candidate.marketEvidence.mos, 80.2)
assert.equal(p1.candidate.marketEvidence.runId, 'RUN-A')
console.log('  ✅ 新 Candidate 结构化字段写入校验通过')

// -------------------------------------------------------------
// TEST 6: 相同 UID 连续推进两次去重
// -------------------------------------------------------------
console.log('TEST 6: 相同 UID 连续推进两次去重')
const countBefore = listCandidates().length
const p2 = promoteToT6Candidate(
  {
    uid: 'wb_uid_gun_001',
    name: '发泡胶枪',
    category: '手动工具',
    mos: 80.2,
  },
  '再次点击推流',
  'RUN-A'
)
assert.equal(p2.created, false)
assert.equal(p2.candidate.id, p1.candidate.id, '候选 ID 必须保持一致')
assert.equal(listCandidates().length, countBefore, '候选总量不得增加')
console.log('  ✅ 相同 UID 重复推流去重校验通过')

// -------------------------------------------------------------
// TEST 7: 跨 Run 推进刷新 Market Evidence
// -------------------------------------------------------------
console.log('TEST 7: 跨 Run 推进刷新 Market Evidence')
const p3 = promoteToT6Candidate(
  {
    uid: 'wb_uid_gun_001',
    name: '发泡胶枪',
    category: '手动工具',
    mos: 89.5,
    pfs: 98.0,
  },
  '新批次数据更新',
  'RUN-B'
)
assert.equal(p3.created, false)
assert.equal(p3.candidate.id, p1.candidate.id)
assert.equal(p3.candidate.source_run_id, 'RUN-B')
assert.equal(p3.candidate.marketEvidence.mos, 89.5)
assert.equal(p3.candidate.marketEvidence.pfs, 98.0)
assert.equal(p3.candidate.marketEvidence.runId, 'RUN-B')
console.log('  ✅ 跨 Run 市场证据刷新校验通过')

// -------------------------------------------------------------
// TEST 8: Rename 安全性（同一 UID 利基改名不分裂）
// -------------------------------------------------------------
console.log('TEST 8: Rename 安全性（利基更名保持同一 Candidate）')
const p4 = promoteToT6Candidate(
  {
    uid: 'wb_uid_gun_001',
    name: '专业聚氨酯发泡枪',
    category: '手动工具',
    mos: 90.0,
  },
  '更名更新',
  'RUN-C'
)
assert.equal(p4.created, false)
assert.equal(p4.candidate.id, p1.candidate.id)
assert.equal(p4.candidate.sourceProductId, 'wb-niche-wb_uid_gun_001')
assert.equal(p4.candidate.candidateName, '发泡胶枪', '已有商品名称不被覆盖')
console.log('  ✅ Rename 安全性校验通过')

// -------------------------------------------------------------
// TEST 9: 同名不同 UID 不发生碰撞
// -------------------------------------------------------------
console.log('TEST 9: 同名不同 UID 创建独立候选')
const pGloveA = promoteToT6Candidate(
  { uid: 'wb_glove_protective', name: '防护手套', category: '劳保' },
  '',
  'RUN-1'
)
const pGloveB = promoteToT6Candidate(
  { uid: 'wb_glove_household', name: '防护手套', category: '家居' },
  '',
  'RUN-1'
)
assert.notEqual(pGloveA.candidate.id, pGloveB.candidate.id)
assert.equal(pGloveA.candidate.sourceProductId, 'wb-niche-wb_glove_protective')
assert.equal(pGloveB.candidate.sourceProductId, 'wb-niche-wb_glove_household')
console.log('  ✅ 同名不同 UID 物理隔离校验通过')

// -------------------------------------------------------------
// TEST 10: Legacy Candidate Backfill
// -------------------------------------------------------------
console.log('TEST 10: Legacy Candidate 识别并 Backfill source_niche_uid 与 marketEvidence')
// 人为注入旧系统生成的 legacy candidate (sourceProductId = wb-niche-热缩管, 无 source_niche_uid)
const legacy = ensureCandidate({
  sourceProductId: 'wb-niche-热缩管',
  name: '热缩管',
  categoryLeaf: '电工',
  notes: '旧数据历史备注',
})
assert.equal(legacy.candidate.source_niche_uid, undefined)

// 此时从新系统推流带 uid 的热缩管
const pLegacyBackfill = promoteToT6Candidate(
  {
    uid: 'wb_heatshrink_001',
    name: '热缩管',
    category: '电工',
    mos: 85.0,
  },
  '旧商品关联 UID',
  'RUN-X'
)
assert.equal(pLegacyBackfill.created, false)
assert.equal(pLegacyBackfill.candidate.id, legacy.candidate.id, '必须复用旧 Candidate')
assert.equal(pLegacyBackfill.candidate.sourceProductId, 'wb-niche-热缩管', '绝不破坏旧 sourceProductId')
assert.equal(pLegacyBackfill.candidate.source_niche_uid, 'wb_heatshrink_001', '成功 backfill source_niche_uid')
assert.equal(pLegacyBackfill.candidate.marketEvidence.mos, 85.0, '成功注入 marketEvidence')
console.log('  ✅ Legacy Candidate Backfill 校验通过')

// -------------------------------------------------------------
// TEST 11: 保护已有业务字段不被覆写
// -------------------------------------------------------------
console.log('TEST 11: 同步时严禁覆盖业务字段 (owner, bizStatus, notes, projectIds)')
// 先给 p1 人为注入业务字段
const c1 = getCandidate(p1.candidate.id)
c1.owner = '张三'
c1.bizStatus = '待立项'
c1.notes = '手工重要备注（严禁丢失）'
c1.projectIds = ['ru-project-uuid-001']
_setAdapterForTests(createMemoryAdapter()) // 换干净测试
// 重新放入
const adapter = {
  store: new Map([[`t6.candidate.${c1.id}`, c1]]),
  get(k) { return this.store.get(k) || null },
  set(k, v) { this.store.set(k, v) },
  keys() { return Array.from(this.store.keys()) },
}
_setAdapterForTests(adapter)

const pSync = promoteToT6Candidate(
  {
    uid: 'wb_uid_gun_001',
    name: '发泡胶枪',
    mos: 99.9,
  },
  '推流原因不应抹杀用户 notes',
  'RUN-D'
)
assert.equal(pSync.candidate.owner, '张三')
assert.equal(pSync.candidate.bizStatus, '待立项')
assert.equal(pSync.candidate.notes, '手工重要备注（严禁丢失）')
assert.deepEqual(pSync.candidate.projectIds, ['ru-project-uuid-001'])
assert.equal(pSync.candidate.marketEvidence.mos, 99.9)
console.log('  ✅ 业务核心字段防护校验通过')

// -------------------------------------------------------------
// TEST 12: 无假造 Scoring Snapshot
// -------------------------------------------------------------
console.log('TEST 12: latestSnapshotId 必须保持 null，严禁假造评分快照')
assert.equal(pSync.candidate.latestSnapshotId, null)
console.log('  ✅ Snapshot 隔离校验通过')

// -------------------------------------------------------------
// TEST 13: Legacy 碰撞隔离测试
// -------------------------------------------------------------
console.log('TEST 13: Legacy Candidate 碰撞隔离 (同名但已有不同 UID)')
// 模拟旧 candidate: sourceProductId = wb-niche-拖车轮, 已有 source_niche_uid = UID_A
const wheelCandidate = {
  id: 'cand_wheel_legacy',
  sourceProductId: 'wb-niche-拖车轮',
  candidateName: '拖车轮',
  source_niche_uid: 'UID_WHEEL_A',
}
adapter.set(`t6.candidate.${wheelCandidate.id}`, wheelCandidate)

// 此时推进同名但不同 UID 的利基: name = 拖车轮, uid = UID_WHEEL_B
const pWheelB = promoteToT6Candidate(
  { uid: 'UID_WHEEL_B', name: '拖车轮', category: '汽配' },
  '',
  'RUN-1'
)
assert.equal(pWheelB.created, true, '必须创建全新候选，严禁覆盖 UID_A')
assert.notEqual(pWheelB.candidate.id, wheelCandidate.id)
assert.equal(pWheelB.candidate.sourceProductId, 'wb-niche-UID_WHEEL_B')
assert.equal(pWheelB.candidate.source_niche_uid, 'UID_WHEEL_B')
// 检查旧候选依然完好
assert.equal(getCandidate('cand_wheel_legacy').source_niche_uid, 'UID_WHEEL_A')
console.log('  ✅ Legacy 碰撞隔离校验通过')

// -------------------------------------------------------------
// TEST 14: 静态评分 Candidate 兼容性
// -------------------------------------------------------------
console.log('TEST 14: 静态评分 Candidate (不带 uid/evidence) 兼容通过')
const staticCand = ensureCandidate({
  sourceProductId: 'SP-100234',
  name: '静态测试商品',
  categoryLeaf: '美妆',
})
assert.equal(staticCand.created, true)
assert.equal(staticCand.candidate.source_niche_uid, undefined)
assert.equal(staticCand.candidate.marketEvidence, undefined)
console.log('  ✅ 静态评分 Candidate 兼容性校验通过')

// -------------------------------------------------------------
// TEST 15: T6 Audit Log 生成校验
// -------------------------------------------------------------
console.log('TEST 15: market_evidence_sync 日志生成')
const logs = listLogs().filter((l) => l.kind === 'market_evidence_sync')
assert.ok(logs.length > 0, '必须产生 market_evidence_sync 类型日志')
assert.equal(logs[0].subjectType, 'candidate')
assert.equal(logs[0].reason, '同步俄罗斯市场情报证据')
console.log('  ✅ Audit Log 审计记录校验通过')

console.log('\n🎉 IA Candidate Market Bridge 全部 15 项测试通过！')
