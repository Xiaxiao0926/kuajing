import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// 模拟浏览器环境与本地存储（用于 miStore.js 采购持久化）
const localStoreMem = new Map()
globalThis.localStorage = {
  getItem: (k) => localStoreMem.get(k) ?? null,
  setItem: (k, v) => localStoreMem.set(k, String(v)),
  removeItem: (k) => localStoreMem.delete(k),
  clear: () => localStoreMem.clear(),
}
globalThis.window = { location: { origin: 'http://localhost' } }

import {
  SNAPSHOT_KIND,
  resolveSnapshotKind,
  evaluateMarketValidationEligibility,
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
  setProjectLifecycle,
  buildMarketValidationSnapshot,
  SNAPSHOT_KIND as STORE_SNAPSHOT_KIND,
  resolveSnapshotKind as storeResolveSnapshotKind,
} from '../ozon-react/src/utils/t6/t6Store.js'
import {
  findProcurementQuote,
} from '../ozon-react/src/utils/marketIntelligence/procurementIdentity.js'
import {
  saveManualQuote,
  getManualQuotes,
} from '../ozon-react/src/utils/marketIntelligence/miStore.js'
import {
  evaluateProjectGate,
  GATE_RESULTS,
  GATE_VERDICTS,
} from '../ozon-react/src/utils/t6/gateEngine.js'

function createMemoryAdapter() {
  const store = new Map()
  return {
    get: (k) => (store.has(k) ? JSON.parse(JSON.stringify(store.get(k))) : null),
    set: (k, v) => { store.set(k, JSON.parse(JSON.stringify(v))) },
    keys: () => Array.from(store.keys()),
  }
}

console.log('===== IA Candidate Project Launch Test Suite (TASK 05C-3B) =====\n')

const candidatePoolPagePath = path.resolve('ozon-react/src/components/t6/CandidatePoolPage.jsx')
const projectListPagePath = path.resolve('ozon-react/src/components/t6/ProjectListPage.jsx')
const projectDetailPagePath = path.resolve('ozon-react/src/components/t6/ProjectDetailPage.jsx')

assert.ok(fs.existsSync(candidatePoolPagePath), 'CandidatePoolPage.jsx 必须存在')
assert.ok(fs.existsSync(projectListPagePath), 'ProjectListPage.jsx 必须存在')
assert.ok(fs.existsSync(projectDetailPagePath), 'ProjectDetailPage.jsx 必须存在')

const candidatePoolCode = fs.readFileSync(candidatePoolPagePath, 'utf-8')
const projectListCode = fs.readFileSync(projectListPagePath, 'utf-8')
const projectDetailCode = fs.readFileSync(projectDetailPagePath, 'utf-8')

// -------------------------------------------------------------
// TEST 1: SCORING Candidate latestSnapshotId creates project
// -------------------------------------------------------------
console.log('TEST 1: SCORING Candidate 通过已有 latestSnapshotId 成功创建项目')
{
  const t6Mem = createMemoryAdapter()
  _setAdapterForTests(t6Mem)

  const { candidate: cand } = ensureCandidate({
    sourceProductId: 'SKU-SCORING-888',
    name: '评分测试商品',
    categoryLeaf: '电子配件',
    categoryFull: '电子/配件/转接头',
  })

  const scoringSnap = createSnapshot({
    candidateId: cand.id,
    sourceProductId: cand.sourceProductId,
    snapshotKind: SNAPSHOT_KIND.SCORING,
    productName: '评分测试商品',
    scoreResult: {
      totalScore: 82.5,
      grade: 'A',
      decision: { status: 'RECOMMENDED', action: 'PRIORITY_PURCHASE' },
      context: { status: 'NORMAL' },
    },
    physicalParams: { weightG: 120, dims: [10, 5, 2] },
    marketContext: { sourcePriceRub: 450, sampleCount: 20 },
    versions: { rulesVersion: 'rules-v2' },
  })

  // 更新 candidate 的 latestSnapshotId
  const storedCand = getCandidate(cand.id)
  storedCand.latestSnapshotId = scoringSnap.id
  t6Mem.set(`t6.candidate.${cand.id}`, storedCand)

  const project = createProject({
    candidateId: storedCand.id,
    creationSnapshotId: storedCand.latestSnapshotId,
  })

  assert.ok(project.id, '项目 ID 必须存在')
  assert.equal(project.source.candidateId, storedCand.id)
  assert.equal(project.source.creationSnapshotId, scoringSnap.id)
  assert.equal(resolveSnapshotKind(getSnapshot(project.source.creationSnapshotId)), SNAPSHOT_KIND.SCORING)

  const updatedCand = getCandidate(cand.id)
  assert.ok(updatedCand.projectIds.includes(project.id), 'Candidate 必须记录项目 ID')
  console.log('  ✅ SCORING Candidate 评分立项成功通过')
}

// -------------------------------------------------------------
// TEST 2: SCORING launch does NOT create new snapshot (reuses existing)
// -------------------------------------------------------------
console.log('TEST 2: SCORING 立项不创建新 Snapshot，直接复用 existing latestSnapshotId')
{
  const t6Mem = createMemoryAdapter()
  _setAdapterForTests(t6Mem)

  const { candidate: cand } = ensureCandidate({
    sourceProductId: 'SKU-SCORING-999',
    name: '复用测试商品',
  })

  const snap = createSnapshot({
    candidateId: cand.id,
    sourceProductId: cand.sourceProductId,
    snapshotKind: SNAPSHOT_KIND.SCORING,
    scoreResult: { totalScore: 78, grade: 'B', decision: { status: 'RECOMMENDED' } },
  })

  const storedCand = getCandidate(cand.id)
  storedCand.latestSnapshotId = snap.id
  t6Mem.set(`t6.candidate.${cand.id}`, storedCand)

  const snapCountBefore = t6Mem.keys().filter((k) => k.startsWith('t6.snapshot.')).length

  // 执行立项
  const project = createProject({
    candidateId: storedCand.id,
    creationSnapshotId: storedCand.latestSnapshotId,
  })

  const snapCountAfter = t6Mem.keys().filter((k) => k.startsWith('t6.snapshot.')).length
  assert.equal(snapCountAfter, snapCountBefore, 'SCORING 立项不得生成额外 Snapshot')
  assert.equal(project.source.creationSnapshotId, snap.id)
  console.log('  ✅ SCORING 立项纯复用现有 Snapshot 校验通过')
}

// -------------------------------------------------------------
// TEST 3: MI Candidate with complete Quote passes Eligibility
// -------------------------------------------------------------
console.log('TEST 3: 证据齐全的 MI Candidate + Quote 通过 Eligibility 校验')
{
  const cand = {
    id: 'cand-mi-001',
    source_system: 'WB_MARKET_INTELLIGENCE',
    source_niche_uid: 'uid-niche-101',
    candidateName: '便携桌面加湿器',
    categoryLeaf: '小家电',
    marketEvidence: {
      nicheUid: 'uid-niche-101',
      mos: 4.2,
      pfs: 3.8,
      marketShare: 0.12,
    },
  }

  const quote = {
    uid: 'uid-niche-101',
    supplierName: '慈溪市某某电器厂',
    factoryPriceCny: 28.5,
    weightG: 320,
    dims: '15x15x18',
    targetPriceRub: 1250,
  }

  const res = evaluateMarketValidationEligibility({ candidate: cand, quote })
  assert.equal(res.eligible, true)
  assert.deepEqual(res.missing, [])
  console.log('  ✅ 齐全证据通过 Eligibility 校验')
}

// -------------------------------------------------------------
// TEST 4: MI Candidate with missing evidence is non-eligible / disabled
// -------------------------------------------------------------
console.log('TEST 4: 证据不齐的 MI Candidate 判定为 ineligible 并准确列出 missing 字段')
{
  const cand = {
    id: 'cand-mi-002',
    source_system: 'WB_MARKET_INTELLIGENCE',
    source_niche_uid: 'uid-niche-102',
    candidateName: '无采购商品',
    marketEvidence: { nicheUid: 'uid-niche-102' },
  }

  // 缺少 Quote
  const resNoQuote = evaluateMarketValidationEligibility({ candidate: cand, quote: null })
  assert.equal(resNoQuote.eligible, false)
  assert.ok(resNoQuote.missing.includes('procurement_quote'))

  // 缺少出厂价与重量
  const incompleteQuote = {
    uid: 'uid-niche-102',
    supplierName: '工厂B',
    dims: '10x10x10',
    targetPriceRub: 900,
  }
  const resIncomplete = evaluateMarketValidationEligibility({ candidate: cand, quote: incompleteQuote })
  assert.equal(resIncomplete.eligible, false)
  assert.ok(resIncomplete.missing.includes('factory_price'))
  assert.ok(resIncomplete.missing.includes('measured_weight'))
  console.log('  ✅ 缺失证据判定与 missing 列表准确')
}

// -------------------------------------------------------------
// TEST 5: MI launch re-reads quote and re-evaluates eligibility at click-time
// -------------------------------------------------------------
console.log('TEST 5: MI 立项点击时重新读取最新 Quote 并重新评估 Eligibility')
{
  localStoreMem.clear()

  const cand = {
    id: 'cand-mi-003',
    source_system: 'WB_MARKET_INTELLIGENCE',
    source_niche_uid: 'uid-niche-103',
    candidateName: '动态采购商品',
    categoryLeaf: '车载用品',
    marketEvidence: {
      nicheUid: 'uid-niche-103',
      mos: 4.5,
    },
  }

  // 最初没有 Quote
  let currentQuotes = getManualQuotes()
  let matchedQuote = findProcurementQuote(currentQuotes, { uid: cand.source_niche_uid, name: cand.candidateName })
  let evalRes = evaluateMarketValidationEligibility({ candidate: cand, quote: matchedQuote })
  assert.equal(evalRes.eligible, false)

  // 采购人员在 Phase 5 录入了完整 Quote
  saveManualQuote({ uid: 'uid-niche-103', name: '动态采购商品' }, {
    supplierName: '广州汽车用品厂',
    factoryPriceCny: 45,
    weightG: 400,
    dims: '20x15x10',
    targetPriceRub: 1800,
  })

  // 点击立项时重新读取
  currentQuotes = getManualQuotes()
  matchedQuote = findProcurementQuote(currentQuotes, { uid: cand.source_niche_uid, name: cand.candidateName })
  evalRes = evaluateMarketValidationEligibility({ candidate: cand, quote: matchedQuote })
  assert.equal(evalRes.eligible, true)
  assert.equal(matchedQuote.supplierName, '广州汽车用品厂')
  console.log('  ✅ 点击时重读与动态 Eligibility 评估通过')
}

// -------------------------------------------------------------
// TEST 6: MI launch creates MARKET_VALIDATION Snapshot then creates Project
// -------------------------------------------------------------
console.log('TEST 6: MI 立项创建合法 MARKET_VALIDATION Snapshot 并顺利生成 Project')
{
  const t6Mem = createMemoryAdapter()
  _setAdapterForTests(t6Mem)

  const { candidate: cand } = ensureCandidate({
    sourceProductId: 'wb-niche-uid-niche-106',
    source_system: 'WB_MARKET_INTELLIGENCE',
    source_niche_uid: 'uid-niche-106',
    name: '露营灯',
    categoryLeaf: '户外照明',
    marketEvidence: { nicheUid: 'uid-niche-106', mos: 4.5, pfs: 4.0 },
  })

  const quote = {
    uid: 'uid-niche-106',
    supplierName: '宁波露营设备有限公司',
    factoryPriceCny: 35,
    weightG: 280,
    dims: '12x12x15',
    targetPriceRub: 1450,
  }

  const snap = buildMarketValidationSnapshot({ candidate: cand, quote })
  assert.equal(snap.snapshotKind, SNAPSHOT_KIND.MARKET_VALIDATION)
  assert.equal(snap.procurementEvidence.supplierName, '宁波露营设备有限公司')
  assert.equal(snap.procurementEvidence.factoryPriceCny, 35)

  const project = createProject({
    candidateId: cand.id,
    creationSnapshotId: snap.id,
  })

  assert.ok(project.id)
  assert.equal(project.source.creationSnapshotId, snap.id)
  assert.equal(resolveSnapshotKind(getSnapshot(project.source.creationSnapshotId)), SNAPSHOT_KIND.MARKET_VALIDATION)
  console.log('  ✅ MARKET_VALIDATION Snapshot 与 Project 创建通过')
}

// -------------------------------------------------------------
// TEST 7: MI Candidate latestSnapshotId remains null
// -------------------------------------------------------------
console.log('TEST 7: MI Candidate 立项后 latestSnapshotId 严格保持为 null（杜绝伪装商品评分）')
{
  const t6Mem = createMemoryAdapter()
  _setAdapterForTests(t6Mem)

  const { candidate: cand } = ensureCandidate({
    sourceProductId: 'wb-niche-uid-niche-107',
    source_system: 'WB_MARKET_INTELLIGENCE',
    source_niche_uid: 'uid-niche-107',
    name: '纯市场商品',
    marketEvidence: { nicheUid: 'uid-niche-107' },
  })
  assert.equal(cand.latestSnapshotId, null)

  const quote = {
    uid: 'uid-niche-107',
    supplierName: '优质供应商',
    factoryPriceCny: 20,
    weightG: 180,
    dims: '10x10x10',
    targetPriceRub: 800,
  }

  const snap = buildMarketValidationSnapshot({ candidate: cand, quote })
  createProject({ candidateId: cand.id, creationSnapshotId: snap.id })

  const storedCand = getCandidate(cand.id)
  assert.equal(storedCand.latestSnapshotId, null, 'Candidate.latestSnapshotId 绝不能被赋予 MARKET_VALIDATION Snapshot')
  console.log('  ✅ latestSnapshotId 零污染校验通过')
}

// -------------------------------------------------------------
// TEST 8: Created project lifecycle is ACTIVE
// -------------------------------------------------------------
console.log('TEST 8: 新创建的项目经由 setProjectLifecycle 设置为 ACTIVE 状态')
{
  const t6Mem = createMemoryAdapter()
  _setAdapterForTests(t6Mem)

  const { candidate: cand } = ensureCandidate({ sourceProductId: 'SKU-ACTIVE-01', name: '启动测试商品' })
  const snap = createSnapshot({ candidateId: cand.id, sourceProductId: cand.sourceProductId, snapshotKind: SNAPSHOT_KIND.SCORING })
  const project = createProject({ candidateId: cand.id, creationSnapshotId: snap.id })

  assert.equal(project.lifecycleStatus, 'DRAFT')
  setProjectLifecycle(project.id, 'ACTIVE', '市场验证立项后启动')

  const activatedProject = getProject(project.id)
  assert.equal(activatedProject.lifecycleStatus, 'ACTIVE')
  assert.ok(activatedProject.decisionLog.length > 0)
  console.log('  ✅ 项目成功激活为 ACTIVE 并记录日志')
}

// -------------------------------------------------------------
// TEST 9: MI candidate in UI does NOT display "刷新评分"
// -------------------------------------------------------------
console.log('TEST 9: 验证 UI 中 MI 候选商品绝不展示“刷新评分”按钮')
{
  assert.match(
    candidatePoolCode,
    /const isMi = cand\.source_system === 'WB_MARKET_INTELLIGENCE'/,
    'CandidatePoolPage 必须定义 isMi'
  )
  assert.match(
    candidatePoolCode,
    /\{!isMi && \(\s*<Button variant="ghost" size="sm" onClick=\{\(\) => handleAddOrRefresh\(cand\)\}/,
    'CandidatePoolPage 必须仅对非 MI Candidate 渲染刷新评分按钮'
  )
  console.log('  ✅ UI 刷新评分隔离性静态校验通过')
}

// -------------------------------------------------------------
// TEST 10: Scoring candidate in UI retains "刷新评分"
// -------------------------------------------------------------
console.log('TEST 10: 验证 UI 中 Scoring 候选商品保留“刷新评分”功能')
{
  assert.match(candidatePoolCode, /handleAddOrRefresh/, '必须保留 handleAddOrRefresh 函数')
  assert.match(candidatePoolCode, /refreshCandidateSnapshot/, '必须保留 refreshCandidateSnapshot 机制')
  console.log('  ✅ Scoring 候选商品刷新评分保留校验通过')
}

// -------------------------------------------------------------
// TEST 11: Repeat handler lock (creatingRef) prevents concurrent clicks
// -------------------------------------------------------------
console.log('TEST 11: 防并发连续点击锁（creatingRef）防重复触发')
{
  assert.match(candidatePoolCode, /const creatingRef = useRef\(new Set\(\)\)/)
  assert.match(candidatePoolCode, /if \(creatingRef\.current\.has\(cand\.id\)\) return/)
  assert.match(candidatePoolCode, /creatingRef\.current\.add\(cand\.id\)/)
  assert.match(candidatePoolCode, /creatingRef\.current\.delete\(cand\.id\)/)

  // 逻辑模拟验证
  const creatingSet = new Set()
  let calls = 0
  const simulatedClickHandler = (candId) => {
    if (creatingSet.has(candId)) return 'BLOCKED'
    creatingSet.add(candId)
    try {
      calls++
      return 'OK'
    } finally {
      // 模拟异步后释放
    }
  }

  assert.equal(simulatedClickHandler('cand-01'), 'OK')
  assert.equal(simulatedClickHandler('cand-01'), 'BLOCKED')
  assert.equal(calls, 1, '并发调用必须被阻断')
  creatingSet.delete('cand-01')
  assert.equal(simulatedClickHandler('cand-01'), 'OK')
  assert.equal(calls, 2)
  console.log('  ✅ creatingRef 锁机制校验通过')
}

// -------------------------------------------------------------
// TEST 12: Candidate with existing project: first click triggers warning
// -------------------------------------------------------------
console.log('TEST 12: 已有关联项目的 Candidate 首次点击不建项目，触发确认提示')
{
  assert.match(candidatePoolCode, /const \[repeatConfirmId, setRepeatConfirmId\] = useState\(null\)/)
  assert.match(candidatePoolCode, /if \(\(cand\.projectIds \|\| \[\]\)\.length > 0 && repeatConfirmId !== cand\.id\)/)
  assert.match(candidatePoolCode, /setRepeatConfirmId\(cand\.id\)/)

  // 模拟状态流转
  let repeatConfirmId = null
  let notice = null
  let projectCreated = false

  const simulateClick = (cand) => {
    if ((cand.projectIds || []).length > 0 && repeatConfirmId !== cand.id) {
      repeatConfirmId = cand.id
      notice = '该候选已有关联项目。如确需创建另一个 SKU 项目，请再次点击确认。'
      return
    }
    projectCreated = true
    repeatConfirmId = null
  }

  const candWithProject = { id: 'cand-multi-1', projectIds: ['proj-001'] }
  simulateClick(candWithProject)
  assert.equal(projectCreated, false, '首次点击严禁直接创建项目')
  assert.equal(repeatConfirmId, 'cand-multi-1')
  assert.ok(notice.includes('已有关联项目'))
  console.log('  ✅ 首次点击预警与状态拦截校验通过')
}

// -------------------------------------------------------------
// TEST 13: Second click on candidate with existing project creates second SKU project
// -------------------------------------------------------------
console.log('TEST 13: 再次点击确认后成功创建第二个 SKU 项目（1 Candidate : N Projects）')
{
  const t6Mem = createMemoryAdapter()
  _setAdapterForTests(t6Mem)

  const { candidate: cand } = ensureCandidate({ sourceProductId: 'SKU-MULTI-02', name: '多项目候选' })
  const snap1 = createSnapshot({ candidateId: cand.id, sourceProductId: cand.sourceProductId, snapshotKind: SNAPSHOT_KIND.SCORING })
  const proj1 = createProject({ candidateId: cand.id, creationSnapshotId: snap1.id })

  let storedCand = getCandidate(cand.id)
  assert.equal(storedCand.projectIds.length, 1)

  // 模拟二次点击确认流程
  let repeatConfirmId = cand.id // 用户已完成首次点击
  let createdProjects = []

  const simulateConfirmClick = (c, snapId) => {
    if ((c.projectIds || []).length > 0 && repeatConfirmId !== c.id) {
      repeatConfirmId = c.id
      return
    }
    const p = createProject({ candidateId: c.id, creationSnapshotId: snapId })
    repeatConfirmId = null
    createdProjects.push(p)
  }

  const snap2 = createSnapshot({ candidateId: cand.id, sourceProductId: cand.sourceProductId, snapshotKind: SNAPSHOT_KIND.SCORING })
  simulateConfirmClick(storedCand, snap2.id)

  assert.equal(createdProjects.length, 1)
  assert.notEqual(createdProjects[0].id, proj1.id)
  storedCand = getCandidate(cand.id)
  assert.equal(storedCand.projectIds.length, 2, 'Candidate 必须成功挂载两个项目')
  assert.equal(repeatConfirmId, null, '二次确认状态必须重置')
  console.log('  ✅ 二次点击建项目成功（1:N 语义完整）')
}

// -------------------------------------------------------------
// TEST 14: No candidate-level store idempotency block (Store allows 1:N)
// -------------------------------------------------------------
console.log('TEST 14: 底层 Store 无候选级别单一项目阻断（允许 1 Candidate 衍生多个 SKU Project）')
{
  const t6Mem = createMemoryAdapter()
  _setAdapterForTests(t6Mem)

  const { candidate: cand } = ensureCandidate({ sourceProductId: 'SKU-STORE-1N', name: '1对N测试候选' })
  const snapA = createSnapshot({ candidateId: cand.id, sourceProductId: cand.sourceProductId, snapshotKind: SNAPSHOT_KIND.SCORING })
  const snapB = createSnapshot({ candidateId: cand.id, sourceProductId: cand.sourceProductId, snapshotKind: SNAPSHOT_KIND.SCORING })

  const p1 = createProject({ candidateId: cand.id, creationSnapshotId: snapA.id })
  const p2 = createProject({ candidateId: cand.id, creationSnapshotId: snapB.id })

  assert.ok(p1.id && p2.id)
  assert.notEqual(p1.id, p2.id)
  const updated = getCandidate(cand.id)
  assert.deepEqual(updated.projectIds, [p1.id, p2.id])
  console.log('  ✅ 底层 Store 1:N 支持校验通过')
}

// -------------------------------------------------------------
// TEST 15: ProjectListPage SCORING retains ScoreCell/Decision/Context
// -------------------------------------------------------------
console.log('TEST 15: ProjectListPage 中 SCORING 证据展示 ScoreCell / Decision / Context 及规则版本')
{
  assert.match(projectListCode, /snapshotKind === SNAPSHOT_KIND\.SCORING && score && \(/)
  assert.match(projectListCode, /<ScoreCell score=\{score\.totalScore\} grade=\{score\.grade\}/)
  assert.match(projectListCode, /<DecisionBadge status=\{score\.decision\.status\}/)
  assert.match(projectListCode, /<ContextBadge context=\{score\.context\} \/>/)
  assert.match(projectListCode, /规则 \{snap\.versions\?\.rulesVersion \?\? '—'\}/)
  console.log('  ✅ ProjectListPage SCORING 专属展示结构校验通过')
}

// -------------------------------------------------------------
// TEST 16: ProjectListPage MARKET_VALIDATION renders "市场验证立项" + procurement facts
// -------------------------------------------------------------
console.log('TEST 16: ProjectListPage 中 MARKET_VALIDATION 专属展示 4 项采购证据及版本，无虚假分数')
{
  assert.match(projectListCode, /snapshotKind === SNAPSHOT_KIND\.MARKET_VALIDATION && \(/)
  assert.match(projectListCode, /市场验证立项/)
  assert.match(projectListCode, /snap\.procurementEvidence\.supplierName/)
  assert.match(projectListCode, /snap\.procurementEvidence\.factoryPriceCny/)
  assert.match(projectListCode, /snap\.procurementEvidence\.weightG/)
  assert.match(projectListCode, /snap\.procurementEvidence\.targetPriceRub/)
  assert.match(projectListCode, /\{snap\.versions\?\.evidenceSchemaVersion \|\| 'market-validation-v1'\}/)
  console.log('  ✅ ProjectListPage MARKET_VALIDATION 专属展示结构校验通过')
}

// -------------------------------------------------------------
// TEST 17: ProjectDetailPage MARKET_VALIDATION renders snapshot.procurementEvidence
// -------------------------------------------------------------
console.log('TEST 17: ProjectDetailPage 顶部栏根据 snapshotKind 分流展示采购证据')
{
  assert.match(projectDetailCode, /snapshotKind === SNAPSHOT_KIND\.MARKET_VALIDATION && \(/)
  assert.match(projectDetailCode, /市场验证立项/)
  assert.match(projectDetailCode, /snapshot\.procurementEvidence\.supplierName/)
  assert.match(projectDetailCode, /snapshot\.procurementEvidence\.factoryPriceCny/)
  assert.match(projectDetailCode, /snapshot\.procurementEvidence\.weightG/)
  assert.match(projectDetailCode, /snapshot\.procurementEvidence\.dims/)
  assert.match(projectDetailCode, /snapshot\.procurementEvidence\.targetPriceRub/)
  assert.match(projectDetailCode, /证据版本 \{snapshot\?\.versions\?\.evidenceSchemaVersion \|\| 'market-validation-v1'\}/)
  console.log('  ✅ ProjectDetailPage MARKET_VALIDATION 顶栏展示结构校验通过')
}

// -------------------------------------------------------------
// TEST 18: ProjectDetailPage does NOT call getManualQuotes or read candidate.marketEvidence
// -------------------------------------------------------------
console.log('TEST 18: ProjectDetailPage 绝不调用 getManualQuotes 且严格只读取 frozen snapshot')
{
  assert.doesNotMatch(projectDetailCode, /getManualQuotes/)
  assert.doesNotMatch(projectDetailCode, /candidate\.marketEvidence/)
  assert.doesNotMatch(projectDetailCode, /findProcurementQuote/)
  console.log('  ✅ ProjectDetailPage 证据冻结性与零污染校验通过')
}

// -------------------------------------------------------------
// TEST 19: Legacy project without snapshotKind renders as SCORING
// -------------------------------------------------------------
console.log('TEST 19: 历史存量无 snapshotKind 快照解析为 SCORING 并正常兼容显示')
{
  const legacySnapshot = {
    id: 'snap-legacy-001',
    scoreResult: { totalScore: 75, grade: 'B', decision: { status: 'RECOMMENDED' } },
  }
  const resolved = resolveSnapshotKind(legacySnapshot)
  assert.equal(resolved, SNAPSHOT_KIND.SCORING, '无 snapshotKind 历史快照必须解析为 SCORING')
  console.log('  ✅ 历史快照向后兼容为 SCORING 校验通过')
}

// -------------------------------------------------------------
// TEST 20: Unknown snapshot kind has fallback warning badge
// -------------------------------------------------------------
console.log('TEST 20: 未知快照类型具有防御性 fallback 提示')
{
  const unknownSnap = {
    id: 'snap-weird-001',
    snapshotKind: 'WEIRD_CUSTOM_KIND',
  }
  const resolved = resolveSnapshotKind(unknownSnap)
  assert.equal(resolved, 'WEIRD_CUSTOM_KIND')

  // 校验 ProjectListPage 与 ProjectDetailPage 均有 fallback 提示
  assert.match(projectListCode, /未知立项证据/)
  assert.match(projectDetailCode, /未知立项证据/)
  console.log('  ✅ 未知快照类型 fallback 提示校验通过')
}

// -------------------------------------------------------------
// Additional E2E Integration Test: Full MI Flow
// -------------------------------------------------------------
console.log('\n--- Additional E2E Integration Test: Full MI Flow ---')
{
  const t6Mem = createMemoryAdapter()
  _setAdapterForTests(t6Mem)
  localStoreMem.clear()

  // 1. 创建 MI Candidate
  const { candidate: miCandidate } = ensureCandidate({
    sourceProductId: 'wb-niche-uid-niche-e2e-999',
    source_system: 'WB_MARKET_INTELLIGENCE',
    source_niche_uid: 'uid-niche-e2e-999',
    name: '智能车载支架',
    categoryLeaf: '车载支架',
    marketEvidence: {
      nicheUid: 'uid-niche-e2e-999',
      mos: 4.8,
      pfs: 4.2,
      top10Share: 0.35,
    },
  })

  // 2. 存入 Phase 5 采购报价
  saveManualQuote({ uid: 'uid-niche-e2e-999', name: '智能车载支架' }, {
    supplierName: '深圳市某某数码科技有限公司',
    factoryPriceCny: 19.8,
    weightG: 160,
    dims: '10x8x5',
    targetPriceRub: 799,
  })

  // 3. 模拟 UI 立项点击触发：读报价 -> 算资格 -> 建快照 -> 建项目 -> 启动
  const quotes = getManualQuotes()
  const matchedQuote = findProcurementQuote(quotes, {
    uid: miCandidate.source_niche_uid,
    name: miCandidate.candidateName,
  })
  assert.ok(matchedQuote)

  const eligibility = evaluateMarketValidationEligibility({
    candidate: miCandidate,
    quote: matchedQuote,
  })
  assert.equal(eligibility.eligible, true)

  const snap = buildMarketValidationSnapshot({
    candidate: miCandidate,
    quote: matchedQuote,
  })
  assert.equal(snap.snapshotKind, SNAPSHOT_KIND.MARKET_VALIDATION)

  const project = createProject({
    candidateId: miCandidate.id,
    creationSnapshotId: snap.id,
  })
  assert.ok(project.projectCode.startsWith('RU-'))

  setProjectLifecycle(project.id, 'ACTIVE', '市场验证立项后启动')

  // 4. 验证完整状态一致性
  const finalProject = getProject(project.id)
  assert.equal(finalProject.lifecycleStatus, 'ACTIVE')
  assert.equal(finalProject.source.creationSnapshotId, snap.id)
  assert.equal(resolveSnapshotKind(getSnapshot(finalProject.source.creationSnapshotId)), SNAPSHOT_KIND.MARKET_VALIDATION)

  const finalCand = getCandidate(miCandidate.id)
  assert.equal(finalCand.latestSnapshotId, null, 'MI Candidate latestSnapshotId 必须保持 null')
  assert.deepEqual(finalCand.projectIds, [project.id])

  // 5. 验证 Gate 门禁在 MV 项目下正常评估
  const gateRes = evaluateProjectGate(finalProject, 'RESEARCH', {
    snapshot: snap,
    scenarios: [],
    availableModules: {},
  })
  assert.equal(gateRes.verdict, GATE_VERDICTS.GREEN)

  console.log('  ✅ E2E: MI Candidate → Phase 5 Quote → Snapshot → Project → ACTIVE → Gate 评估全链路成功通过！')
}

console.log('\n===== All 20 Tests + E2E Passed Successfully! =====')
