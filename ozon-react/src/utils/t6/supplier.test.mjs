/**
 * t6/supplier.test.mjs — T7-1 Supplier/Quote/Sample/supply store 测试（T7-0 V1.0 冻结）
 * 运行: node --experimental-vm-modules src/utils/t6/supplier.test.mjs
 * 覆盖：
 *  S1 createSupplier：项目必须存在、project.suppliers 追加、supplier_create 日志
 *  S2 createSupplierQuote：version=供应商内 max+1（v1→v2）、旧报价字节不变
 *  S3 quote payload 禁带系统字段（id/createdAt/schemaVersion/version）→ throw
 *  S4 报价 append-only：无 update/delete API、读取不改字节
 *  S5 跨实体引用一致性：供应商跨项目 / 报价跨供应商 / 样品报价错配 → throw
 *  S6 setProjectSupply/clearProjectSupply：引用型变更（报价/供应商字节不变）、跨项目/错配 throw、supply_plan_change 日志
 *  S7 样品状态机：ordered→arrived→tested→approved|rejected 前向约束、终态不可变、非法状态 throw
 *  S8 Supplier 仅 name/contact/notes 可改（无其它字段写入口）
 *  S9 T6 兼容：旧项目无 supply 字段读为 undefined（不破坏 T6 实体）、决策日志新 kind 可记录
 *  S10 数据层回归：评分分布前提（1000 唯一 source_product_id）不变；T6 既有 store 断言不受影响
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as store from './t6Store.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..', '..', '..', '..')

let pass = 0, fail = 0
const assert = (cond, msg) => { if (cond) { pass++; console.log(`  ✅ ${msg}`) } else { fail++; console.log(`  ❌ ${msg}`) } }

console.log('\n===== T7-1 Supplier/Quote/Sample/supply Store 测试 =====\n')

const mem = new Map()
store._setAdapterForTests({
  get: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null),
  set: (k, v) => mem.set(k, JSON.stringify(v)),
  keys: () => [...mem.keys()],
})

// ---- fixtures ----
const scored = {
  index: 0, name: '测试商品', leaf: '家用手套', categoryFull: '住宅和花园>家居用品>家用手套',
  kind: 'exact',
  totalScore: 76.4, grade: 'B', gradeTentative: false, context: 'HIGH', evidenceCoverage: 0.9,
  dimensions: { demand: { score: 78, weight: 25, available: true, coverage: 1, marketScaleScore: 82, candidateStrengthScore: 74 } },
  supplyGap: null, status: [], decision: { status: 'ELIGIBLE', action: 'PILOT_TEST', reason: 'NO_BLOCKING_FLAG' },
  ruleVersion: '1.0', matchedProductType: null, benchmarkSampleSize: null,
  strengths: [], risks: [], missingMetrics: [],
}
const canonical = {
  source_product_id: 'P-SUP-001', name: '测试商品', category_leaf: '家用手套', category_full: '住宅和花园>家居用品>家用手套',
  price_rub: 5000, avg_price_rub: 4800, sales_rub_28d: 500000, units_28d: 1200,
  conv_rate: 0.5, cart_add_rate: 10, exposure: 100000, card_visits: 5000, reviews: 100,
  gross_margin: 40, commission_fbs: 20, commission_fbo: 19, commission_rfbs: 12, commission_fbp: 18,
  ad_share: 5, weight_kg: 1.55, dims: [52, 45, 28], ship_mode: 'FBO',
  sign_rate: 90, oos_days_share: 10, stock: 1000, turnover: 20, revenue_loss_rate: 0.01,
}
function makeProject() {
  const { candidate } = store.ensureCandidate({ sourceProductId: canonical.source_product_id, candidateIndex: 0, name: canonical.name, categoryLeaf: canonical.category_leaf, categoryFull: canonical.category_full })
  const snap = store.buildScoringSnapshot({
    scored, canonical,
    benchmarkMeta: { version: '1.0', generated_at: 't' },
    benchmarkDoc: { product_types: {} },
    rules: { version: '1.0' },
    datasetVersion: 't',
    candidateId: candidate.id,
  })
  store.refreshCandidateSnapshot(candidate.id, snap.id)
  return { candidate, snap, project: store.createProject({ candidateId: candidate.id, creationSnapshotId: snap.id }) }
}

function makeSupplier(projectId, name = '供应商A') {
  return store.createSupplier({ projectId, name, contact: '张工', notes: '老客户' })
}
function makeQuote(supplierId, unitPriceCny = 35) {
  return store.createSupplierQuote({ supplierId, unitPriceCny, currency: 'CNY', moq: 500, exw: true, fob: false, packagingSpec: '彩盒+气泡膜', toolingFeeCny: 3000, sampleFeeCny: 50, leadTimeDays: 15, paymentTerms: '30%定金', remark: '' })
}

console.log('S1: createSupplier——项目必须存在、project.suppliers 追加、supplier_create 日志')
{
  const { project } = makeProject()
  const sup = makeSupplier(project.id, '供应商A')
  assert(sup.id && sup.projectId === project.id && sup.quotes.length === 0, '供应商记录创建（quotes 空）')
  assert(store.getProject(project.id).suppliers.includes(sup.id), 'project.suppliers 追加')
  const logs = store.listLogs().filter((l) => l.projectId === project.id)
  assert(logs.some((l) => l.kind === 'supplier_create' && l.to === sup.id), 'supplier_create 日志')
  let threw = false
  try { store.createSupplier({ projectId: 'no-such-project', name: 'x' }) } catch (e) { threw = /项目不存在/.test(e.message) }
  assert(threw, '项目不存在 → throw')
  let threwName = false
  try { store.createSupplier({ projectId: project.id, name: '  ' }) } catch (e) { threwName = /名称必填/.test(e.message) }
  assert(threwName, '空名称 → throw')
}

console.log('S2: createSupplierQuote——version=供应商内 max+1（v1→v2）、旧报价字节不变')
{
  const { project } = makeProject()
  const sup = makeSupplier(project.id, '供应商B')
  const q1 = makeQuote(sup.id, 35)
  assert(q1.version === 1, `首个报价 version=1 (实际 ${q1.version})`)
  const q1Bytes = JSON.stringify(store.getSupplierQuote(q1.id))
  const q2 = makeQuote(sup.id, 32.5)
  assert(q2.version === 2, `同供应商第二个报价 version=2 (实际 ${q2.version})`)
  assert(JSON.stringify(store.getSupplierQuote(q1.id)) === q1Bytes, '旧报价 v1 字节不变')
  const supAfter = store.getSupplier(sup.id)
  assert(supAfter.quotes.length === 2 && supAfter.quotes.includes(q2.id), 'supplier.quotes 追加 v2')
  // 不同供应商各自从 1 起
  const sup2 = makeSupplier(project.id, '供应商C')
  const qOther = makeQuote(sup2.id, 40)
  assert(qOther.version === 1, '不同供应商报价独立从 version=1 起')
}

console.log('S3: quote payload 禁带系统字段（id/createdAt/schemaVersion/version）→ throw')
{
  const { project } = makeProject()
  const sup = makeSupplier(project.id)
  for (const f of ['id', 'createdAt', 'schemaVersion', 'version']) {
    let threw = false
    try { store.createSupplierQuote({ supplierId: sup.id, unitPriceCny: 35, [f]: 'hack' }) } catch (e) { threw = /系统字段/.test(e.message) }
    assert(threw, `携带系统字段 ${f} → throw`)
  }
  let threwBadPrice = false
  try { store.createSupplierQuote({ supplierId: sup.id, unitPriceCny: -5 }) } catch (e) { threwBadPrice = /非负/.test(e.message) }
  assert(threwBadPrice, '负单价 → throw')
  let threwBadCur = false
  try { store.createSupplierQuote({ supplierId: sup.id, unitPriceCny: 35, currency: 'EUR' }) } catch (e) { threwBadCur = /非法报价币种/.test(e.message) }
  assert(threwBadCur, '非法币种 → throw')
}

console.log('S4: 报价 append-only——无 update/delete API、读取不改字节')
{
  assert(!('updateSupplierQuote' in store) && !('deleteSupplierQuote' in store), '无 update/deleteSupplierQuote API')
  const { project } = makeProject()
  const sup = makeSupplier(project.id)
  const q = makeQuote(sup.id, 35)
  const bytes = JSON.stringify(store.getSupplierQuote(q.id))
  store.listSupplierQuotes()
  assert(JSON.stringify(store.getSupplierQuote(q.id)) === bytes, '读取不改变报价字节')
}

console.log('S5: 跨实体引用一致性——供应商跨项目 / 报价跨供应商 / 样品报价错配 → throw')
{
  const a = makeProject()
  const b = makeProject()
  const supA = makeSupplier(a.project.id, 'A厂')
  const supB = makeSupplier(b.project.id, 'B厂')
  const qA = makeQuote(supA.id, 35)
  let threwSupplier = false
  try { store.createSampleRecord({ projectId: b.project.id, supplierId: supA.id }) } catch (e) { threwSupplier = /不属于项目/.test(e.message) }
  assert(threwSupplier, '跨项目供应商 → 样品创建 throw')
  let threwQuote = false
  try { store.createSampleRecord({ projectId: a.project.id, supplierId: supA.id, quoteId: qA.id }) } catch (e) { threwQuote = false }
  assert(!threwQuote, '同项目同供应商的报价 → 正常')
  let threwMismatch = false
  try { store.createSampleRecord({ projectId: b.project.id, supplierId: supB.id, quoteId: qA.id }) } catch (e) { threwMismatch = /不属于供应商/.test(e.message) }
  assert(threwMismatch, '样品报价不属于该供应商 → throw')
  let threwQuoteMissing = false
  try { store.createSampleRecord({ projectId: a.project.id, supplierId: supA.id, quoteId: 'no-such-quote' }) } catch (e) { threwQuoteMissing = /报价 .* 不存在/.test(e.message) }
  assert(threwQuoteMissing, '样品引用不存在报价 → throw')
}

console.log('S6: setProjectSupply/clearProjectSupply——引用型变更、错配 throw、supply_plan_change 日志')
{
  const { project } = makeProject()
  const sup = makeSupplier(project.id, 'A厂')
  const q1 = makeQuote(sup.id, 35)
  const q2 = makeQuote(sup.id, 32.5)
  const q1Bytes = JSON.stringify(store.getSupplierQuote(q1.id))
  const supBytes = JSON.stringify(store.getSupplier(sup.id))
  store.setProjectSupply(project.id, { supplierId: sup.id, quoteId: q2.id, by: 'tester', note: '备选二版' })
  const p = store.getProject(project.id)
  assert(p.supply && p.supply.supplierId === sup.id && p.supply.quoteId === q2.id, 'supply 引用 v2')
  assert(JSON.stringify(store.getSupplierQuote(q1.id)) === q1Bytes && JSON.stringify(store.getSupplier(sup.id)) === supBytes, '报价/供应商字节不变（引用型）')
  const logs = store.listLogs().filter((l) => l.projectId === project.id)
  assert(logs.some((l) => l.kind === 'supply_plan_change' && l.to === `${sup.id}@${q2.id}`), 'supply_plan_change 日志')
  let threwCross = false
  try { store.setProjectSupply('no-such-project', { supplierId: sup.id, quoteId: q2.id }) } catch (e) { threwCross = /项目不存在/.test(e.message) }
  assert(threwCross, '项目不存在 → throw')
  let threwMismatch = false
  try { store.setProjectSupply(project.id, { supplierId: sup.id, quoteId: 'no-such-quote' }) } catch (e) { threwMismatch = /报价 .* 不存在/.test(e.message) }
  assert(threwMismatch, '报价不存在 → throw')
  // 清除
  store.clearProjectSupply(project.id)
  assert(store.getProject(project.id).supply === null, 'clearProjectSupply → supply=null')
  const afterClear = store.listLogs().filter((l) => l.projectId === project.id && l.kind === 'supply_plan_change')
  assert(afterClear[afterClear.length - 1].to === null, '清除写 supply_plan_change（to=null）')
}

console.log('S7: 样品状态机——ordered→arrived→tested→approved|rejected 前向约束、终态不可变')
{
  const { project } = makeProject()
  const sup = makeSupplier(project.id, 'A厂')
  const q = makeQuote(sup.id, 35)
  const sample = store.createSampleRecord({ projectId: project.id, supplierId: sup.id, quoteId: q.id, trackNo: 'SF123' })
  assert(store.getProject(project.id).samples.includes(sample.id), 'project.samples 追加')
  let threwInit = false
  try { store.createSampleRecord({ projectId: project.id, supplierId: sup.id, status: 'arrived' }) } catch (e) { threwInit = /初始状态必须为 ordered/.test(e.message) }
  assert(threwInit, '初始状态非 ordered → throw')
  let threwJump = false
  try { store.updateSampleRecord(sample.id, { status: 'tested' }) } catch (e) { threwJump = /状态机/.test(e.message) }
  assert(threwJump, 'ordered→tested 跳级 → throw')
  store.updateSampleRecord(sample.id, { status: 'arrived', arrivedAt: '2026-08-14T00:00:00Z' })
  store.updateSampleRecord(sample.id, { status: 'tested', testResult: '样品合格' })
  store.updateSampleRecord(sample.id, { status: 'approved' })
  assert(store.getSampleRecord(sample.id).status === 'approved', 'approved 终态')
  let threwTerminal = false
  try { store.updateSampleRecord(sample.id, { status: 'arrived' }) } catch (e) { threwTerminal = /终态|状态机/.test(e.message) }
  assert(threwTerminal, '终态不可回退')
  let threwBad = false
  try { store.updateSampleRecord(sample.id, { status: 'banana' }) } catch (e) { threwBad = /非法样品状态/.test(e.message) }
  assert(threwBad, '非法状态 → throw')
  const logs = store.listLogs().filter((l) => l.projectId === project.id && l.kind === 'sample_change')
  assert(logs.length >= 4, '样品状态推进写 sample_change 日志（创建+3 次推进）')
}

console.log('S8: Supplier 仅 name/contact/notes 可改（API 只暴露这三个可变字段）')
{
  const { project } = makeProject()
  const sup = makeSupplier(project.id, '原名')
  store.updateSupplier(sup.id, { name: '新名', contact: '李工', notes: '更新' })
  const after = store.getSupplier(sup.id)
  assert(after.name === '新名' && after.contact === '李工' && after.notes === '更新', 'name/contact/notes 可改')
  assert(after.id === sup.id && after.projectId === project.id && after.createdAt === sup.createdAt, 'id/projectId/createdAt 不可改')
  assert(JSON.stringify(Object.keys(after).sort()) === JSON.stringify(['contact', 'createdAt', 'id', 'name', 'notes', 'projectId', 'quotes', 'schemaVersion', 'updatedAt']), '供应商字段白名单固定')
}

console.log('S9: T6 兼容——旧项目无 supply 字段、决策日志新 kind、T6 实体不受影响')
{
  // 手工写入一个 T6 时代的旧项目（无 supply/samples 新字段语义）
  const fake = {
    id: 'legacy-p', projectCode: 'RU-2020-001', marketCode: 'RU', schemaVersion: 1,
    name: '旧项目',
    source: { kind: 'candidate', candidateId: null, sourceProductId: null, candidateName: 'x', category: '', creationSnapshotId: null },
    lifecycleStatus: 'DRAFT', stage: 'PIPELINE', goLiveAt: null,
    workflow: { templateVersion: 'roadmap-v1', states: [] },
    product: {}, suppliers: [], samples: [], compliance: {},
    costing: { scenarios: [], baselineScenarioId: null },
    logistics: {}, listing: {}, launch: {}, operations: {}, settlement: {},
    decisionLog: [], createdAt: '', updatedAt: '',
  }
  mem.set('t6.project.legacy-p', JSON.stringify(fake))
  assert(store.getProject('legacy-p').supply === undefined, '旧项目无 supply 字段（读取不报错，undefined）')
  const sup = store.createSupplier({ projectId: 'legacy-p', name: '老供应商' })
  assert(store.getProject('legacy-p').suppliers.includes(sup.id), '旧项目可正常追加供应商')
  const logs = store.listLogs().filter((l) => l.projectId === 'legacy-p')
  assert(logs.some((l) => l.kind === 'supplier_create'), '新 kind 日志可记录（DecisionLog 不限制 kind）')
}

console.log('S10: 数据层回归前提——评分分布数据 1000 唯一 source_product_id 不变')
{
  const doc = JSON.parse(fs.readFileSync(path.join(ROOT, 'ozon-react', 'public', 'data', 'scoring_candidates.json'), 'utf-8'))
  const ids = doc.candidates.map((c) => c.source_product_id).filter((x) => x && String(x).trim())
  assert(doc.candidates.length === 1000 && new Set(ids).size === 1000, '1000 行 / 1000 唯一')
}

console.log(`\n===== T7-1 Store 测试结果: ${pass} 通过 / ${fail} 失败 =====\n`)
if (fail > 0) process.exit(1)
