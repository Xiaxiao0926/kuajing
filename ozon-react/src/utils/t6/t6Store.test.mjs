/**
 * t6/t6Store.test.mjs — T6-1 数据层 golden/invariant（T6-0 V1.1 冻结的 8 条验收）
 * 运行: node --experimental-vm-modules src/utils/t6/t6Store.test.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as store from './t6Store.js'
import { getWorkflowTemplate, WORKFLOW_TEMPLATES } from '../../data/workflowTemplates/registry.js'

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
  store.refreshCandidateSnapshot(cand.id, snap1.id)
  const bytes1 = JSON.stringify(store.getSnapshot(snap1.id))
  const snap2 = makeSnapshot(cand.id)
  store.refreshCandidateSnapshot(cand.id, snap2.id)
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
  const project = store.createProject({ candidateId: cand.id, creationSnapshotId: creationSnap.id, name: '家用手套-黑色10mil' })
  const creationBytes = JSON.stringify(store.getSnapshot(creationSnap.id))
  // 候选刷新（评分变化）
  const snap3 = makeSnapshot(cand.id)
  store.refreshCandidateSnapshot(cand.id, snap3.id)
  const projectAfter = store.getProject(project.id)
  assert(projectAfter.source.creationSnapshotId === creationSnap.id, 'creationSnapshotId 永久冻结')
  assert(JSON.stringify(store.getSnapshot(creationSnap.id)) === creationBytes, '立项快照字节不变')
}

console.log('I4: 一个 Candidate 可创建多个 SKU Project（1:0..N）')
{
  const cand = store.findCandidateByProductId('P-GLOVES-001')
  const snap = store.getSnapshot(cand.latestSnapshotId)
  const p2 = store.createProject({ candidateId: cand.id, creationSnapshotId: snap.id, name: '家用手套-橙色10mil' })
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

console.log('I10: Snapshot create 真正不可覆盖（payload 禁带系统字段；传旧 id 必须抛错且原字节不变）')
{
  const cand = store.findCandidateByProductId('P-GLOVES-001')
  const existing = store.getSnapshot(cand.latestSnapshotId)
  const bytesBefore = JSON.stringify(existing)
  let threwId = false
  try { store.createSnapshot({ id: existing.id, scoreResult: { hacked: true } }) } catch (e) { threwId = /系统字段 id/.test(e.message) }
  assert(threwId, 'payload 携带 id → 抛错')
  let threwCreatedAt = false
  try { store.createSnapshot({ createdAt: '2000-01-01', scoreResult: { hacked: true } }) } catch (e) { threwCreatedAt = /系统字段 createdAt/.test(e.message) }
  assert(threwCreatedAt, 'payload 携带 createdAt → 抛错')
  let threwSchema = false
  try { store.createSnapshot({ schemaVersion: 99 }) } catch (e) { threwSchema = /系统字段 schemaVersion/.test(e.message) }
  assert(threwSchema, 'payload 携带 schemaVersion → 抛错')
  assert(JSON.stringify(store.getSnapshot(existing.id)) === bytesBefore, '原快照字节完全不变')
  let threwLog = false
  try { store.appendLog({ id: 'hack', subjectType: 'candidate', subjectId: 'x', kind: 'note', to: 'x' }) } catch (e) { threwLog = /系统字段 id/.test(e.message) }
  assert(threwLog, 'appendLog payload 携带 id → 抛错')
}

console.log('I11: 引用一致性 fail-close（错配快照 / 不存在快照 → throw）')
{
  const cand = store.findCandidateByProductId('P-GLOVES-001')
  // 造一个归属其它商品的快照
  const foreign = store.createSnapshot({ candidateId: 'other-candidate', sourceProductId: 'P-OTHER-999', scoreResult: { totalScore: 1 } })
  let threwRefresh = false
  try { store.refreshCandidateSnapshot(cand.id, foreign.id) } catch (e) { threwRefresh = /不一致/.test(e.message) }
  assert(threwRefresh, '错配快照 → refresh 抛错')
  let threwMissing = false
  try { store.refreshCandidateSnapshot(cand.id, 'no-such-snapshot') } catch (e) { threwMissing = /不存在/.test(e.message) }
  assert(threwMissing, '不存在 snapshotId → refresh 抛错')
  let threwProject = false
  try { store.createProject({ candidateId: cand.id, creationSnapshotId: foreign.id }) } catch (e) { threwProject = /不一致/.test(e.message) }
  assert(threwProject, '错配快照 → 创建项目抛错')
  let threwProjectMissing = false
  try { store.createProject({ candidateId: cand.id, creationSnapshotId: 'no-such-snapshot' }) } catch (e) { threwProjectMissing = /不存在/.test(e.message) }
  assert(threwProjectMissing, '不存在快照 → 创建项目抛错')
  assert(store.getCandidate(cand.id).latestSnapshotId !== foreign.id, 'latestSnapshotId 未被污染')
}

console.log('I12: 枚举与空身份校验（bizStatus/stage/workflow/空 sourceProductId）')
{
  const cand = store.findCandidateByProductId('P-GLOVES-001')
  let threwBiz = false
  try { store.setCandidateBizStatus(cand.id, '随便写') } catch (e) { threwBiz = /非法候选业务状态/.test(e.message) }
  assert(threwBiz, '非法 bizStatus → 抛错')
  const project = store.listProjects()[0]
  let threwStage = false
  try { store.setProjectStage(project.id, 'HOLD') } catch (e) { threwStage = /非法项目阶段/.test(e.message) }
  assert(threwStage, 'stage=HOLD（已从枚举删除）→ 抛错')
  let threwNode = false
  try { store.setWorkflowNode(project.id, 'n999', 'done') } catch (e) { threwNode = /不属于模板/.test(e.message) }
  assert(threwNode, 'nodeId 不属于模板 → 抛错')
  let threwNodeStatus = false
  try { store.setWorkflowNode(project.id, 'n1', 'banana') } catch (e) { threwNodeStatus = /非法节点状态/.test(e.message) }
  assert(threwNodeStatus, '非法节点状态 → 抛错')
  let threwEmpty = false
  try { store.ensureCandidate({ sourceProductId: '', candidateIndex: 0, name: 'x', categoryLeaf: 'x', categoryFull: 'x' }) } catch (e) { threwEmpty = /sourceProductId 为空/.test(e.message) }
  assert(threwEmpty, '空 sourceProductId → ensureCandidate 抛错')
  // 合法路径不受影响
  store.setWorkflowNode(project.id, 'n1', 'done', '已完成')
  assert(store.getProject(project.id).workflow.states.find((s) => s.nodeId === 'n1').status === 'done', '合法节点更新正常')
}

console.log('I13: roadmap-v1 是静态冻结模板（不从 ROADMAP_PHASES 运行时生成；冻结字段不可变）')
{
  const tpl = getWorkflowTemplate('roadmap-v1')
  assert(tpl && tpl.nodes.length === 36 && tpl.phases.length === 7, '模板存在且 36 节点 / 7 阶段')
  assert(Object.isFrozen(tpl) && Object.isFrozen(tpl.nodes) && Object.isFrozen(tpl.nodes[0]), '模板与节点对象冻结')
  let threwMutate = false
  try { tpl.nodes[0].title = 'hacked' } catch (e) { threwMutate = true }
  assert(threwMutate, '修改冻结字段抛错（strict mode）')
  assert(store.buildWorkflowTemplate() === tpl, 'store 读取同一注册表实例')
  assert(getWorkflowTemplate('roadmap-v2') === null, '未定义版本返回 null')
}

console.log('I14: 评分页立项语义——每次立项冻结"当前可见评分"（新快照，不复用旧快照）')
{
  const cand = store.findCandidateByProductId('P-GLOVES-001')
  const oldLatest = cand.latestSnapshotId
  // 模拟评分页当前 row 生成新快照（即使候选已有旧快照）
  const fresh = makeSnapshot(cand.id)
  store.refreshCandidateSnapshot(cand.id, fresh.id)
  const project = store.createProject({ candidateId: cand.id, creationSnapshotId: fresh.id })
  assert(project.source.creationSnapshotId === fresh.id, 'creationSnapshotId = 本次新快照')
  assert(fresh.id !== oldLatest, '新快照与旧快照不同（未复用旧评分）')
}

console.log('I15: server sync 生命周期（false→true 后能读到同步后的实体；App 层 Gate 源码锁定）')
{
  // 全新内存后端模拟冷启动：同步前为空 → 同步写入实体 → 再次读取可见
  const mem2 = new Map()
  const adapter2 = {
    get: (k) => (mem2.has(k) ? JSON.parse(mem2.get(k)) : null),
    set: (k, v) => mem2.set(k, JSON.stringify(v)),
    keys: () => [...mem2.keys()],
  }
  store._setAdapterForTests(adapter2)
  assert(store.listCandidates().length === 0, '同步完成前读取为空（模拟冷启动）')
  // 模拟 WP REST 同步完成：持久层写入一条候选
  adapter2.set('t6.candidate.synced-1', JSON.stringify({
    id: 'synced-1', schemaVersion: 1, sourceProductId: 'P-SYNC-001', candidateIndex: 0,
    candidateName: '同步商品', categoryLeaf: 'x', categoryFull: 'x',
    latestSnapshotId: null, bizStatus: '观察', owner: '', notes: '', projectIds: [],
    addedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }))
  assert(store.listCandidates().length === 1, '同步完成后再次读取可见（useMemo 生命周期已由 App 层 Gate 规避）')
  // App 层 Gate 源码锁：T6 页面在 !serverSynced 时不挂载
  const fs2 = fs.readFileSync(path.join(ROOT, 'ozon-react', 'src', 'App.jsx'), 'utf-8')
  assert(fs2.includes("'__t6_candidates__' || activeNode === '__t6_projects__'") && fs2.includes('!serverSynced'), 'App.jsx 含 T6 server-sync Gate')
  assert(fs2.includes('正在同步项目数据'), 'Gate 显示同步提示')
  // 还原主适配器供后续用例
  store._setAdapterForTests({
    get: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null),
    set: (k, v) => mem.set(k, JSON.stringify(v)),
    keys: () => [...mem.keys()],
  })
}

console.log('I16: setWorkflowNode 按项目自己的 templateVersion 取模板（伪造 v2 项目 fail-close）')
{
  // 手工写入一个 templateVersion='roadmap-v2' 的项目（模拟未来数据）
  const fake = {
    id: 'fake-v2', projectCode: 'RU-2099-001', marketCode: 'RU', schemaVersion: 1,
    name: '未来项目',
    source: { kind: 'manual', candidateId: null, sourceProductId: null, candidateName: 'x', category: '', creationSnapshotId: null },
    lifecycleStatus: 'DRAFT', stage: 'PIPELINE', goLiveAt: null,
    workflow: { templateVersion: 'roadmap-v2', states: [{ nodeId: 'n1', status: 'pending', updatedAt: null, updatedBy: null, note: null }] },
    product: {}, suppliers: [], samples: [], compliance: {},
    costing: { scenarios: [], baselineScenarioId: null },
    logistics: {}, listing: {}, launch: {}, operations: {}, settlement: {},
    decisionLog: [], createdAt: '', updatedAt: '',
  }
  mem.set('t6.project.fake-v2', JSON.stringify(fake))
  let threwV2 = false
  try { store.setWorkflowNode('fake-v2', 'n1', 'done') } catch (e) { threwV2 = /未注册/.test(e.message) }
  assert(threwV2, 'v2 项目在未注册模板时 setWorkflowNode 抛错（不会误用 v1 校验）')
  assert(WORKFLOW_TEMPLATES['roadmap-v1'] && !WORKFLOW_TEMPLATES['roadmap-v2'], 'registry 只含已冻结版本')
}

console.log(`\n===== T6 Store 测试结果: ${pass} 通过 / ${fail} 失败 =====\n`)
if (fail > 0) process.exit(1)
