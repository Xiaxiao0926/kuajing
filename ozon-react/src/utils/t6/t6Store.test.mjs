/**
 * t6/t6Store.test.mjs — T6-1 数据层 golden/invariant（T6-0 V1.1 冻结的 8 条验收）
 * 运行: node --experimental-vm-modules src/utils/t6/t6Store.test.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as store from './t6Store.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..', '..', '..', '..')

// 内存 adapter（深拷贝，模拟逐 key 持久化；roadmap-statuses 预置为 legacy 全局看板）
const mem = new Map()
mem.set('roadmap-statuses', JSON.stringify({ 'n1': 'done' }))
store._setAdapterForTests({
  get: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null),
  set: (k, v) => mem.set(k, JSON.stringify(v)),
  keys: () => [...mem.keys()],
})

let pass = 0, fail = 0
const assert = (cond, msg) => { if (cond) { pass++; console.log(`  ✅ ${msg}`) } else { fail++; console.log(`  ❌ ${msg}`) } }

console.log('\n===== T6 Store golden/invariant 测试 =====\n')

// 公共 fixtures
const scored = {
  index: 0, name: 'Тестовый товар', leaf: '家用手套', categoryFull: '住宅和花园>家居用品>家用手套',
  kind: 'exact',
  totalScore: 76.4, grade: 'B', gradeTentative: false, context: 'HIGH', evidenceCoverage: 0.9,
  dimensions: { demand: { score: 78, weight: 25, available: true, coverage: 1, marketScaleScore: 82, candidateStrengthScore: 74 } },
  supplyGap: { signal: 55, rank: 'MEDIUM_GAP', demandRank: 60, shortageRank: 55, entryOpenness: 40 },
  status: [], decision: { status: 'ELIGIBLE', action: 'PILOT_TEST', reason: 'NO_BLOCKING_FLAG' },
  ruleVersion: '1.0', matchedProductType: '家用手套', benchmarkSampleSize: 50,
  strengths: ['价格落在市场主成交带内'], risks: [], missingMetrics: [],
}
const canonical = {
  source_product_id: 'P-GLOVES-001', category_leaf: '家用手套', category_full: '住宅和花园>家居用品>家用手套',
  price_rub: 300, avg_price_rub: 280, sales_rub_28d: 500000, units_28d: 1200,
  conv_rate: 0.5, cart_add_rate: 10, exposure: 100000, card_visits: 5000, reviews: 100,
  gross_margin: 40, commission_fbs: 20, commission_fbo: 20, commission_rfbs: 12, commission_fbp: 11,
  ad_share: 5, weight_kg: 0.3, dims: [20, 10, 5], ship_mode: 'FBO',
  sign_rate: 90, oos_days_share: 10, stock: 1000, turnover: 20, revenue_loss_rate: 0.01,
  name: 'Тестовый товар',
}
const benchmarkDoc = { product_types: { '家用手套': { domain: 'dom-home' } } }
const benchmarkMeta = { version: '1.0', generated_at: '2026-08-14T07:08:04.324Z' }
const rules = { version: '1.0' }

function makeSnapshot(candidateId) {
  return store.buildScoringSnapshot({ scored, canonical, benchmarkMeta, benchmarkDoc, rules, datasetVersion: '2026-08-14#1', candidateId })
}

console.log('I1: 源数据重新排序 → Candidate 仍指向同一商品（按 sourceProductId）')
{
  const { candidate } = store.ensureCandidate({ sourceProductId: 'P-GLOVES-001', candidateIndex: 0, name: canonical.name, categoryLeaf: canonical.category_leaf, categoryFull: canonical.category_full })
  // 模拟数据重生成后行号变化：身份必须不依赖 index
  const again = store.findCandidateByProductId('P-GLOVES-001')
  assert(again && again.id === candidate.id, '按 sourceProductId 命中同一候选')
  const byWrongIndex = store.listCandidates().find((c) => c.candidateIndex === 999)
  assert(!byWrongIndex, '行号 999 不产生幽灵候选')
}

console.log('I2: 刷新评分 → 旧 Snapshot 完全不变（字节级）')
{
  const cand = store.findCandidateByProductId('P-GLOVES-001')
  const snap1 = makeSnapshot(cand.id)
  store.refreshCandidateSnapshot(cand.id, snap1)
  const bytes1 = JSON.stringify(store.getSnapshot(snap1.id))
  const snap2 = makeSnapshot(cand.id)
  store.refreshCandidateSnapshot(cand.id, snap2)
  const bytes1After = JSON.stringify(store.getSnapshot(snap1.id))
  assert(bytes1 === bytes1After, '旧快照字节不变')
  const candAfter = store.getCandidate(cand.id)
  assert(candAfter.latestSnapshotId === snap2.id, 'latestSnapshotId 指向新快照')
  assert(snap1.id !== snap2.id, '新旧快照是两个独立 uuid')
}

console.log('I3: 项目创建后刷新 Candidate → Project.creationSnapshotId 及其快照不变')
{
  const cand = store.findCandidateByProductId('P-GLOVES-001')
  const creationSnap = store.getSnapshot(cand.latestSnapshotId)
  const project = store.createProject({ candidate: cand, creationSnapshot: creationSnap, name: '家用手套-黑色10mil' })
  const creationBytes = JSON.stringify(store.getSnapshot(creationSnap.id))
  // 候选刷新（评分变化）
  const snap3 = makeSnapshot(cand.id)
  store.refreshCandidateSnapshot(cand.id, snap3)
  const projectAfter = store.getProject(project.id)
  assert(projectAfter.source.creationSnapshotId === creationSnap.id, 'creationSnapshotId 永久冻结')
  assert(JSON.stringify(store.getSnapshot(creationSnap.id)) === creationBytes, '立项快照字节不变')
}

console.log('I4: 一个 Candidate 可创建多个 SKU Project（1:0..N）')
{
  const cand = store.findCandidateByProductId('P-GLOVES-001')
  const snap = store.getSnapshot(cand.latestSnapshotId)
  const p2 = store.createProject({ candidate: cand, creationSnapshot: snap, name: '家用手套-橙色10mil' })
  const candAfter = store.getCandidate(cand.id)
  assert(candAfter.projectIds.length === 2, 'projectIds 长度 = 2')
  const codes = store.listProjects().map((p) => p.projectCode)
  assert(new Set(codes).size === codes.length && codes.every((c) => /^RU-\d{4}-\d{3}$/.test(c)), `项目编号唯一且符合 RU-YYYY-NNN (${codes.join(',')})`)
  assert(codes.includes(p2.projectCode), '新项目编号已分配')
}

console.log('I5: PAUSED → 恢复后仍回原 stage')
{
  const projects = store.listProjects()
  const p = projects[0]
  store.setProjectStage(p.id, 'COSTING', '进入成本核算')
  store.setProjectLifecycle(p.id, 'ACTIVE', '启动')
  store.setProjectLifecycle(p.id, 'PAUSED', '供应商报价超预算')
  const paused = store.getProject(p.id)
  assert(paused.lifecycleStatus === 'PAUSED' && paused.stage === 'COSTING', '暂停时阶段保留')
  store.setProjectLifecycle(p.id, 'ACTIVE', '恢复')
  const resumed = store.getProject(p.id)
  assert(resumed.lifecycleStatus === 'ACTIVE' && resumed.stage === 'COSTING', '恢复后仍回 COSTING')
}

console.log('I6: 旧 Snapshot / Log 不能 update/delete（API 层面不存在）')
{
  assert(!('updateSnapshot' in store) && !('deleteSnapshot' in store), '无 updateSnapshot/deleteSnapshot')
  assert(!('updateLog' in store) && !('deleteLog' in store), '无 updateLog/deleteLog')
  const logIds = [...mem.keys()].filter((k) => k.startsWith('t6.log.'))
  const logBytes = logIds.map((k) => mem.get(k)).sort()
  store.listLogs()
  const logBytesAfter = [...mem.keys()].filter((k) => k.startsWith('t6.log.')).map((k) => mem.get(k)).sort()
  assert(JSON.stringify(logBytes) === JSON.stringify(logBytesAfter), '读取操作不改变日志字节')
}

console.log('I7: 旧 roadmap-statuses 完全不受 T6 影响')
{
  assert(mem.get('roadmap-statuses') === JSON.stringify({ 'n1': 'done' }), 'roadmap-statuses 字节不变')
  assert(![...mem.keys()].some((k) => k.startsWith('roadmap') && k.startsWith('t6')), '无跨命名空间写入')
}

console.log('I8: 评分分布不变的前置条件——候选数据 1000 个唯一 source_product_id')
{
  const doc = JSON.parse(fs.readFileSync(path.join(ROOT, 'ozon-react', 'public', 'data', 'scoring_candidates.json'), 'utf-8'))
  const ids = doc.candidates.map((c) => c.source_product_id)
  const nonEmpty = ids.filter((x) => x && String(x).trim()).length
  const unique = new Set(ids.filter((x) => x && String(x).trim())).size
  assert(doc.candidates.length === 1000 && nonEmpty === 1000 && unique === 1000, `1000 行 / ${nonEmpty} 非空 / ${unique} 唯一`)
}

console.log('I9: 决策日志覆盖立项前事件（candidate 域 + project 域）')
{
  const logs = store.listLogs()
  const candidateKinds = logs.filter((l) => l.subjectType === 'candidate').map((l) => l.kind)
  const projectKinds = logs.filter((l) => l.subjectType === 'project').map((l) => l.kind)
  assert(candidateKinds.includes('snapshot_create') && candidateKinds.includes('project_create'), 'candidate 域含 snapshot_create/project_create')
  assert(projectKinds.includes('status_change') && projectKinds.includes('stage_change'), 'project 域含 status/stage 变更')
}

console.log(`\n===== T6 Store 测试结果: ${pass} 通过 / ${fail} 失败 =====\n`)
if (fail > 0) process.exit(1)
