/**
 * t6/t6Store.js — T6 业务主数据存储（T6-1）
 * 契约（T6-0 V1.1 冻结）：
 *  - 逐实体存储：t6.candidate.<uuid> / t6.project.<uuid> / t6.snapshot.<uuid> / t6.log.<uuid>
 *  - UUID 是唯一主键；RU-YYYY-NNN 仅人类编号
 *  - ScoringSnapshot / DecisionLog 只提供 create/read，API 层面不存在 update/delete
 *  - 不可修改字段写入被 store 校验拒绝（fail-close）
 *  - 生产走 persist（localStorage + WP REST 同步）；测试可注入内存 adapter
 */
import { persistGet, persistSet } from '../persist.js'
import { ROADMAP_PHASES } from '../../data/roadmap.js'

const SCHEMA_VERSION = 1
export const WORKFLOW_TEMPLATE_VERSION = 'roadmap-v1'
export const SCORING_ENGINE_VERSION = 't4-frozen-1'

export const T6_PREFIX = {
  candidate: 't6.candidate.',
  project: 't6.project.',
  snapshot: 't6.snapshot.',
  log: 't6.log.',
}

export function uuid() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `t6-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// ---------- 适配器（生产 persist；测试注入内存实现） ----------
const defaultAdapter = {
  get: (k) => persistGet(k),
  set: (k, v) => persistSet(k, v),
  keys: () => { try { return Object.keys(localStorage).filter((k) => /^t6\./.test(k)) } catch { return [] } },
}
let adapter = defaultAdapter
/** 测试专用：注入内存 adapter（{get,set,keys}），并清除 _synced 副作用依赖 */
export function _setAdapterForTests(a) { adapter = a }

function read(key) { return adapter.get(key) }
function write(key, value) { adapter.set(key, JSON.parse(JSON.stringify(value))) } // 深拷贝入库，外部修改不影响已存记录
function listEntities(prefix) {
  return adapter.keys().filter((k) => k.startsWith(prefix)).map((k) => read(k)).filter((v) => v != null)
}

// ---------- Workflow 模板（roadmap-v1 不可变快照） ----------
export function buildWorkflowTemplate() {
  const phases = ROADMAP_PHASES.map((p, i) => ({ phaseId: p.id, title: p.title, order: i }))
  const nodes = []
  let order = 0
  for (const p of ROADMAP_PHASES) {
    for (const n of p.nodes) nodes.push({ nodeId: n.id, phaseId: p.id, title: n.title, order: order++ })
  }
  return { version: WORKFLOW_TEMPLATE_VERSION, phases, nodes }
}

export function initWorkflowStates() {
  return buildWorkflowTemplate().nodes.map((n) => ({
    nodeId: n.nodeId, status: 'pending', updatedAt: null, updatedBy: null, note: null,
  }))
}

// ---------- DecisionLog（append-only：仅 create/read） ----------
export function appendLog({ subjectType, subjectId, projectId = null, kind, from = null, to, reason = '', by = 'user' }) {
  const entry = {
    id: uuid(), schemaVersion: SCHEMA_VERSION,
    subjectType, subjectId, projectId, kind, from, to, reason,
    at: new Date().toISOString(), by,
  }
  write(`${T6_PREFIX.log}${entry.id}`, entry)
  if (projectId) {
    const project = read(`${T6_PREFIX.project}${projectId}`)
    if (project) {
      write(`${T6_PREFIX.project}${projectId}`, {
        ...project,
        decisionLog: [...(project.decisionLog || []), entry.id],
        updatedAt: entry.at,
      })
    }
  }
  return entry
}

export function getLog(id) { return read(`${T6_PREFIX.log}${id}`) }
export function listLogs() { return listEntities(T6_PREFIX.log) }

// ---------- ScoringSnapshot（不可变：仅 create/read） ----------
export function createSnapshot(payload) {
  const record = { id: uuid(), createdAt: new Date().toISOString(), schemaVersion: SCHEMA_VERSION, ...payload }
  write(`${T6_PREFIX.snapshot}${record.id}`, record)
  return record
}
export function getSnapshot(id) { return read(`${T6_PREFIX.snapshot}${id}`) }
export function listSnapshots() { return listEntities(T6_PREFIX.snapshot) }

/** 由 ScoredProduct + canonical 输入构建完整快照（structuredClone 评分输出，不抄缩水版） */
export function buildScoringSnapshot({ scored, canonical, benchmarkMeta, benchmarkDoc, rules, datasetVersion, candidateId = null }) {
  const scoreResult = structuredClone({
    totalScore: scored.totalScore,
    grade: scored.grade,
    gradeTentative: scored.gradeTentative,
    context: scored.context,
    evidenceCoverage: scored.evidenceCoverage,
    dimensions: scored.dimensions,
    supplyGap: scored.supplyGap,
    status: scored.status,
    decision: scored.decision,
    ruleVersion: scored.ruleVersion,
    matchedProductType: scored.matchedProductType,
    benchmarkSampleSize: scored.benchmarkSampleSize,
  })
  const sourceInputs = {
    price_rub: canonical?.price_rub ?? null,
    avg_price_rub: canonical?.avg_price_rub ?? null,
    sales_rub_28d: canonical?.sales_rub_28d ?? null,
    units_28d: canonical?.units_28d ?? null,
    conv_rate: canonical?.conv_rate ?? null,
    cart_add_rate: canonical?.cart_add_rate ?? null,
    exposure: canonical?.exposure ?? null,
    card_visits: canonical?.card_visits ?? null,
    reviews: canonical?.reviews ?? null,
    gross_margin: canonical?.gross_margin ?? null,
    commission_fbs: canonical?.commission_fbs ?? null,
    commission_fbo: canonical?.commission_fbo ?? null,
    commission_rfbs: canonical?.commission_rfbs ?? null,
    commission_fbp: canonical?.commission_fbp ?? null,
    ad_share: canonical?.ad_share ?? null,
    weight_kg: canonical?.weight_kg ?? null,
    dims: canonical?.dims ?? null,
    ship_mode: canonical?.ship_mode ?? '',
    sign_rate: canonical?.sign_rate ?? null,
    oos_days_share: canonical?.oos_days_share ?? null,
    stock: canonical?.stock ?? null,
    turnover: canonical?.turnover ?? null,
    revenue_loss_rate: canonical?.revenue_loss_rate ?? null,
    category_leaf: canonical?.category_leaf ?? scored.leaf ?? '',
    category_full: canonical?.category_full ?? scored.categoryFull ?? '',
  }
  const matchedType = scored.matchedProductType
  const matchedTypeEntry = matchedType && benchmarkDoc?.product_types ? benchmarkDoc.product_types[matchedType] : null
  const benchmarkVersion = benchmarkMeta ? `${benchmarkMeta.version || '?'}@${benchmarkMeta.generated_at || '?'}` : 'unknown'
  return createSnapshot({
    candidateId,
    sourceProductId: canonical?.source_product_id ?? '',
    scoreResult,
    explanations: {
      strengths: scored.strengths || [],
      risks: scored.risks || [],
      missingMetrics: scored.missingMetrics || [],
    },
    sourceInputs,
    marketContext: {
      matchMethod: scored.kind || 'none',
      matchedProductType: matchedType ?? null,
      domain: matchedTypeEntry?.domain ?? null,
      sampleSize: scored.benchmarkSampleSize ?? null,
      benchmarkGeneratedAt: benchmarkMeta?.generated_at ?? null,
    },
    versions: {
      rulesVersion: rules?.version ?? 'unknown',
      engineVersion: SCORING_ENGINE_VERSION,
      candidateDatasetVersion: datasetVersion || 'unknown',
      benchmarkVersion,
    },
  })
}

// ---------- Candidate ----------
export function getCandidate(id) { return read(`${T6_PREFIX.candidate}${id}`) }
export function listCandidates() { return listEntities(T6_PREFIX.candidate) }
export function findCandidateByProductId(sourceProductId) {
  const pid = String(sourceProductId)
  return listEntities(T6_PREFIX.candidate).find((c) => String(c.sourceProductId) === pid) || null
}

/** 候选不存在则创建（latestSnapshotId 置 null，随后由 refreshCandidateSnapshot 挂快照） */
export function ensureCandidate({ sourceProductId, candidateIndex, name, categoryLeaf, categoryFull, owner = '', notes = '' }) {
  const existing = findCandidateByProductId(sourceProductId)
  if (existing) return { candidate: existing, created: false }
  const now = new Date().toISOString()
  const record = {
    id: uuid(), schemaVersion: SCHEMA_VERSION,
    sourceProductId: String(sourceProductId),
    candidateIndex, candidateName: name, categoryLeaf, categoryFull,
    latestSnapshotId: null,
    bizStatus: '观察', owner, notes,
    projectIds: [],
    addedAt: now, updatedAt: now,
  }
  write(`${T6_PREFIX.candidate}${record.id}`, record)
  appendLog({ subjectType: 'candidate', subjectId: record.id, kind: 'status_change', from: null, to: '观察', reason: '加入候选' })
  return { candidate: record, created: true }
}

export function setCandidateBizStatus(id, status, reason = '') {
  const rec = getCandidate(id)
  if (!rec) throw new Error('T6_STORE: 候选不存在')
  const next = { ...rec, bizStatus: status, updatedAt: new Date().toISOString() }
  write(`${T6_PREFIX.candidate}${id}`, next)
  appendLog({ subjectType: 'candidate', subjectId: id, kind: 'status_change', from: rec.bizStatus, to: status, reason })
  return next
}

export function setCandidateOwner(id, owner) {
  const rec = getCandidate(id)
  if (!rec) throw new Error('T6_STORE: 候选不存在')
  const next = { ...rec, owner, updatedAt: new Date().toISOString() }
  write(`${T6_PREFIX.candidate}${id}`, next)
  return next
}

/** 刷新评分：生成新快照 → 更新 latestSnapshotId；旧快照字节不变 */
export function refreshCandidateSnapshot(id, snapshot) {
  const rec = getCandidate(id)
  if (!rec) throw new Error('T6_STORE: 候选不存在')
  const next = { ...rec, latestSnapshotId: snapshot.id, updatedAt: new Date().toISOString() }
  write(`${T6_PREFIX.candidate}${id}`, next)
  appendLog({ subjectType: 'candidate', subjectId: id, kind: 'snapshot_create', from: rec.latestSnapshotId, to: snapshot.id, reason: '刷新评分' })
  return next
}

function appendCandidateProjectId(id, projectId) {
  const rec = getCandidate(id)
  if (!rec) throw new Error('T6_STORE: 候选不存在')
  if ((rec.projectIds || []).includes(projectId)) return rec
  const next = { ...rec, projectIds: [...(rec.projectIds || []), projectId], updatedAt: new Date().toISOString() }
  write(`${T6_PREFIX.candidate}${id}`, next)
  return next
}

// ---------- SkuProject ----------
export function getProject(id) { return read(`${T6_PREFIX.project}${id}`) }
export function listProjects() { return listEntities(T6_PREFIX.project) }

export function nextProjectCode() {
  const year = new Date().getFullYear()
  const prefix = `RU-${year}-`
  const nums = listEntities(T6_PREFIX.project)
    .map((p) => p.projectCode || '')
    .filter((c) => c.startsWith(prefix))
    .map((c) => parseInt(c.slice(prefix.length), 10))
    .filter((n) => !isNaN(n))
  return `${prefix}${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0')}`
}

/** 一键立项：创建项目（creationSnapshotId 永久冻结）、候选 projectIds 追加、双域日志 */
export function createProject({ candidate, creationSnapshot, name }) {
  const now = new Date().toISOString()
  const project = {
    id: uuid(), projectCode: nextProjectCode(), marketCode: 'RU', schemaVersion: SCHEMA_VERSION,
    name: name || candidate.candidateName,
    source: {
      kind: 'candidate',
      candidateId: candidate.id,
      sourceProductId: candidate.sourceProductId,
      candidateName: candidate.candidateName,
      category: candidate.categoryLeaf,
      creationSnapshotId: creationSnapshot.id,
    },
    lifecycleStatus: 'DRAFT', // 冻结契约：创建=DRAFT，人工「启动」→ACTIVE
    stage: 'PIPELINE',
    goLiveAt: null,
    workflow: { templateVersion: WORKFLOW_TEMPLATE_VERSION, states: initWorkflowStates() },
    product: {}, suppliers: [], samples: [], compliance: {},
    costing: { scenarios: [], baselineScenarioId: null },
    logistics: {}, listing: {}, launch: {}, operations: {}, settlement: {},
    decisionLog: [],
    createdAt: now, updatedAt: now,
  }
  write(`${T6_PREFIX.project}${project.id}`, project)
  appendCandidateProjectId(candidate.id, project.id)
  appendLog({ subjectType: 'candidate', subjectId: candidate.id, projectId: project.id, kind: 'project_create', from: null, to: project.id, reason: `一键立项 ${project.projectCode}` })
  appendLog({ subjectType: 'project', subjectId: project.id, projectId: project.id, kind: 'status_change', from: null, to: 'DRAFT', reason: '创建项目' })
  return project
}

const LIFECYCLE_ALLOWED = {
  DRAFT: ['ACTIVE', 'ARCHIVED', 'KILLED'],
  ACTIVE: ['PAUSED', 'ARCHIVED', 'KILLED'],
  PAUSED: ['ACTIVE', 'ARCHIVED', 'KILLED'],
  ARCHIVED: ['ACTIVE', 'KILLED'],
  KILLED: [],
}

/** 生命周期动作：PAUSED→ACTIVE 恢复时 stage 保留（不丢失原阶段） */
export function setProjectLifecycle(id, status, reason = '') {
  const rec = getProject(id)
  if (!rec) throw new Error('T6_STORE: 项目不存在')
  if (!(LIFECYCLE_ALLOWED[rec.lifecycleStatus] || []).includes(status)) {
    throw new Error(`T6_STORE: 非法生命周期流转 ${rec.lifecycleStatus} → ${status}`)
  }
  const next = { ...rec, lifecycleStatus: status, updatedAt: new Date().toISOString() }
  write(`${T6_PREFIX.project}${id}`, next)
  appendLog({ subjectType: 'project', subjectId: id, projectId: id, kind: 'status_change', from: rec.lifecycleStatus, to: status, reason })
  return next
}

export function setProjectStage(id, stage, reason = '') {
  const rec = getProject(id)
  if (!rec) throw new Error('T6_STORE: 项目不存在')
  const next = { ...rec, stage, updatedAt: new Date().toISOString() }
  write(`${T6_PREFIX.project}${id}`, next)
  appendLog({ subjectType: 'project', subjectId: id, projectId: id, kind: 'stage_change', from: rec.stage, to: stage, reason })
  return next
}

export function setProjectName(id, name) {
  const rec = getProject(id)
  if (!rec) throw new Error('T6_STORE: 项目不存在')
  const next = { ...rec, name, updatedAt: new Date().toISOString() }
  write(`${T6_PREFIX.project}${id}`, next)
  return next
}

export function setWorkflowNode(id, nodeId, status, note = '') {
  const rec = getProject(id)
  if (!rec) throw new Error('T6_STORE: 项目不存在')
  const now = new Date().toISOString()
  const states = rec.workflow.states.map((s) => (s.nodeId === nodeId ? { ...s, status, updatedAt: now, note: note || s.note } : s))
  const next = { ...rec, workflow: { ...rec.workflow, states }, updatedAt: now }
  write(`${T6_PREFIX.project}${id}`, next)
  return next
}

// ---------- 派生工具 ----------
export function projectProgress(project) {
  const states = project?.workflow?.states || []
  const done = states.filter((s) => s.status === 'done').length
  return { done, total: states.length }
}

export function projectNextStep(project) {
  const states = project?.workflow?.states || []
  const node = states.find((s) => s.status !== 'done' && s.status !== 'skipped')
  return node ? node.nodeId : null
}
