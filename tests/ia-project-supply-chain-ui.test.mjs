/**
 * tests/ia-project-supply-chain-ui.test.mjs
 * 
 * TASK 07A-2A: T7 Project Supply Chain Workspace UI & Store 契约与行为测试
 * 
 * 覆盖：
 * 1. ProjectSupplyChainPanel 源码存在性与结构契约（16 项静态契约）
 * 2. T7 Store 行为与多项目隔离性测试（10 项行为测试）
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

console.log('===== IA Project Supply Chain Workspace Test Suite (TASK 07A-2A) =====\n')

const ROOT = path.resolve('.')
const PANEL_PATH = path.join(ROOT, 'ozon-react/src/components/t6/ProjectSupplyChainPanel.jsx')
const DETAIL_PATH = path.join(ROOT, 'ozon-react/src/components/t6/ProjectDetailPage.jsx')
const GATE_PATH = path.join(ROOT, 'ozon-react/src/utils/t6/gateEngine.js')

// ==========================================
// PART 1: 静态源码契约测试 (16 项)
// ==========================================

console.log('--- PART 1: 静态源码与组件契约测试 ---')

// 1. ProjectSupplyChainPanel 存在
assert(fs.existsSync(PANEL_PATH), 'TEST 1: ProjectSupplyChainPanel.jsx 文件必须存在')
const panelCode = fs.readFileSync(PANEL_PATH, 'utf-8')
console.log('  ✅ TEST 1: ProjectSupplyChainPanel.jsx 文件存在')

// 2. ProjectDetailPage suppliers Tab 挂载 Panel
assert(fs.existsSync(DETAIL_PATH), 'TEST 2: ProjectDetailPage.jsx 文件必须存在')
const detailCode = fs.readFileSync(DETAIL_PATH, 'utf-8')
assert(detailCode.includes('import ProjectSupplyChainPanel from'), 'TEST 2A: ProjectDetailPage 必须导入 ProjectSupplyChainPanel')
assert(/tab === 'suppliers' &&\s*\(\s*<ProjectSupplyChainPanel/.test(detailCode), 'TEST 2B: suppliers Tab 必须挂载 ProjectSupplyChainPanel')
console.log('  ✅ TEST 2: ProjectDetailPage suppliers Tab 成功挂载 ProjectSupplyChainPanel')

// 3. Panel 使用 getProjectSuppliers
assert(panelCode.includes('getProjectSuppliers'), 'TEST 3: Panel 必须调用 getProjectSuppliers 读取项目供应商')
console.log('  ✅ TEST 3: Panel 成功绑定 getProjectSuppliers')

// 4. 支持 createSupplier
assert(panelCode.includes('createSupplier'), 'TEST 4: Panel 必须调用 createSupplier 新增供应商')
console.log('  ✅ TEST 4: Panel 成功绑定 createSupplier')

// 5. 支持 updateSupplier
assert(panelCode.includes('updateSupplier'), 'TEST 5: Panel 必须调用 updateSupplier 修改供应商信息')
console.log('  ✅ TEST 5: Panel 成功绑定 updateSupplier')

// 6. 不存在 deleteSupplier UI 或伪造删除
assert(!panelCode.includes('deleteSupplier'), 'TEST 6: Panel 严禁存在 deleteSupplier（Store 无删除 API）')
console.log('  ✅ TEST 6: Panel 严格不存在 deleteSupplier 操作')

// 7. 使用 getSupplierQuotes
assert(panelCode.includes('getSupplierQuotes'), 'TEST 7: Panel 必须调用 getSupplierQuotes 读取报价版本')
console.log('  ✅ TEST 7: Panel 成功绑定 getSupplierQuotes')

// 8. 支持 createSupplierQuote
assert(panelCode.includes('createSupplierQuote'), 'TEST 8: Panel 必须调用 createSupplierQuote 追加报价版本')
console.log('  ✅ TEST 8: Panel 成功绑定 createSupplierQuote')

// 9. 不存在 Quote edit/delete
assert(!panelCode.includes('updateSupplierQuote'), 'TEST 9A: 严禁存在 updateSupplierQuote（报价不可变）')
assert(!panelCode.includes('deleteSupplierQuote'), 'TEST 9B: 严禁存在 deleteSupplierQuote（报价不可变）')
console.log('  ✅ TEST 9: Panel 严格保持报价版本不可变（无修改/无删除）')

// 10. 使用 getProjectSamples
assert(panelCode.includes('getProjectSamples'), 'TEST 10: Panel 必须调用 getProjectSamples 读取样品记录')
console.log('  ✅ TEST 10: Panel 成功绑定 getProjectSamples')

// 11. 支持 createSampleRecord
assert(panelCode.includes('createSampleRecord'), 'TEST 11: Panel 必须调用 createSampleRecord 创建打样记录')
console.log('  ✅ TEST 11: Panel 成功绑定 createSampleRecord')

// 12. 支持 updateSampleRecord
assert(panelCode.includes('updateSampleRecord'), 'TEST 12: Panel 必须调用 updateSampleRecord 推进打样状态')
console.log('  ✅ TEST 12: Panel 成功绑定 updateSampleRecord')

// 13. 使用 setProjectSupply
assert(panelCode.includes('setProjectSupply'), 'TEST 13: Panel 必须调用 setProjectSupply 绑定正式供应方案')
console.log('  ✅ TEST 13: Panel 成功绑定 setProjectSupply')

// 14. 使用 clearProjectSupply
assert(panelCode.includes('clearProjectSupply'), 'TEST 14: Panel 必须调用 clearProjectSupply 清除正式供应方案')
console.log('  ✅ TEST 14: Panel 成功绑定 clearProjectSupply')

// 15. 不 import miStore / Phase 5 采购询价
assert(!panelCode.includes('miStore'), 'TEST 15A: Panel 严禁 import miStore')
assert(!panelCode.includes('mi_manual_procurement_quotes'), 'TEST 15B: Panel 严禁读取 mi_manual_procurement_quotes')
assert(!panelCode.includes('procurementIdentity'), 'TEST 15C: Panel 严禁 import procurementIdentity')
console.log('  ✅ TEST 15: Panel 严格遵守 NO_BRIDGE 契约，零 Phase 5 污染')

// 16. 不修改 gateEngine
const gateCode = fs.readFileSync(GATE_PATH, 'utf-8')
assert(!gateCode.includes('getProjectSuppliers'), 'TEST 16: gateEngine 严禁直接调用 Store（保持纯评估器原则）')
console.log('  ✅ TEST 16: gateEngine 架构纯净，未在 07A-2A 中被违规修改')

// ==========================================
// PART 2: 运行时 Store 行为与隔离测试 (10 项)
// ==========================================

console.log('\n--- PART 2: T7 Store 运行时行为与项目隔离测试 ---')

// 导入 t6Store
import * as store from '../ozon-react/src/utils/t6/t6Store.js'

const mem = new Map()
store._setAdapterForTests({
  get: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null),
  set: (k, v) => mem.set(k, JSON.stringify(v)),
  keys: () => [...mem.keys()],
})

function createMockProject(code = 'TEST-001') {
  const { candidate } = store.ensureCandidate({
    sourceProductId: `PID-${code}`,
    candidateIndex: 0,
    name: `商品-${code}`,
    categoryLeaf: '日用品',
    categoryFull: '家居>日用品',
  })
  const snap = store.createSnapshot({
    candidateId: candidate.id,
    sourceProductId: candidate.sourceProductId,
    sourceInputs: { weight_kg: 0.5, dims: [20, 15, 10], price_rub: 1500 },
    versions: { rulesVersion: '1.0' },
  })
  store.refreshCandidateSnapshot(candidate.id, snap.id)
  return store.createProject({ candidateId: candidate.id, creationSnapshotId: snap.id, name: `项目-${code}` })
}

// 17. Project A/B Supplier 隔离测试
const projectA = createMockProject('A')
const projectB = createMockProject('B')

const supA1 = store.createSupplier({ projectId: projectA.id, name: '供应商A1', contact: '13800000001' })
const supA2 = store.createSupplier({ projectId: projectA.id, name: '供应商A2', contact: '13800000002' })
const supB1 = store.createSupplier({ projectId: projectB.id, name: '供应商B1', contact: '13800000003' })

const suppliersA = store.getProjectSuppliers(projectA.id)
const suppliersB = store.getProjectSuppliers(projectB.id)

assert.equal(suppliersA.length, 2, 'Project A 必须有且仅有 2 家供应商')
assert(suppliersA.some(s => s.id === supA1.id) && suppliersA.some(s => s.id === supA2.id), 'Project A 包含 supA1 和 supA2')
assert(!suppliersA.some(s => s.id === supB1.id), 'Project A 绝不能出现 Project B 的供应商')

assert.equal(suppliersB.length, 1, 'Project B 必须有且仅有 1 家供应商')
assert.equal(suppliersB[0].id, supB1.id, 'Project B 包含 supB1')
assert(!suppliersB.some(s => s.id === supA1.id), 'Project B 绝不能出现 Project A 的供应商')
console.log('  ✅ TEST 17: Project A 与 Project B 供应商实现严格上下文隔离')

// 18. 供应商更新只修改白名单字段
const updatedSupA1 = store.updateSupplier(supA1.id, { name: '新供应商A1', contact: '13999999999', notes: '合作顺畅' })
assert.equal(updatedSupA1.name, '新供应商A1')
assert.equal(updatedSupA1.contact, '13999999999')
assert.equal(updatedSupA1.projectId, projectA.id, 'projectId 保持不变')
assert.equal(updatedSupA1.id, supA1.id, 'id 保持不变')
console.log('  ✅ TEST 18: updateSupplier 仅更新白名单字段，保护系统属性')

// 19. Quote 报价版本自增与不可变性 (v1 -> v2)
const qA1_v1 = store.createSupplierQuote({ supplierId: supA1.id, unitPriceCny: 45, currency: 'CNY', moq: 1000 })
assert.equal(qA1_v1.version, 1, '第一个报价版本号为 1')
const qA1_v1_bytes = JSON.stringify(store.getSupplierQuote(qA1_v1.id))

const qA1_v2 = store.createSupplierQuote({ supplierId: supA1.id, unitPriceCny: 42.5, currency: 'CNY', moq: 3000, remark: '大货阶梯价' })
assert.equal(qA1_v2.version, 2, '同供应商第二个报价版本号为 2')

const quotesA1 = store.getSupplierQuotes(supA1.id)
assert.equal(quotesA1.length, 2, 'supA1 必须有两个报价版本')
assert.equal(JSON.stringify(store.getSupplierQuote(qA1_v1.id)), qA1_v1_bytes, 'qA1_v1 历史报价字节完全不可变')
console.log('  ✅ TEST 19: SupplierQuote 实现不可变自增版本树 (v1 → v2)，旧版本字节冻结')

// 20. Quote 跨供应商隔离测试
const qB1_v1 = store.createSupplierQuote({ supplierId: supB1.id, unitPriceCny: 50 })
assert.equal(qB1_v1.version, 1, 'supB1 独立从 version=1 起算')
const quotesB1 = store.getSupplierQuotes(supB1.id)
assert.equal(quotesB1.length, 1)
assert.equal(quotesB1[0].id, qB1_v1.id)
assert(!quotesB1.some(q => q.id === qA1_v1.id), 'supB1 绝不能混入 supA1 的报价')
console.log('  ✅ TEST 20: 报价版本在供应商之间完全隔离')

// 21. Sample 打样状态机合规前向流转
const sample1 = store.createSampleRecord({ projectId: projectA.id, supplierId: supA1.id, quoteId: qA1_v1.id, trackNo: 'SF1001' })
assert.equal(sample1.status, 'ordered', '初始状态必为 ordered')

const sampleArrived = store.updateSampleRecord(sample1.id, { status: 'arrived' })
assert.equal(sampleArrived.status, 'arrived', '流转至 arrived')
assert(sampleArrived.arrivedAt, '自动记录 arrivedAt 时间戳')

const sampleTested = store.updateSampleRecord(sample1.id, { status: 'tested', testResult: '外观与风速达标' })
assert.equal(sampleTested.status, 'tested', '流转至 tested')
assert.equal(sampleTested.testResult, '外观与风速达标')

const sampleApproved = store.updateSampleRecord(sample1.id, { status: 'approved' })
assert.equal(sampleApproved.status, 'approved', '流转至终态 approved')
console.log('  ✅ TEST 21: Sample 状态机 ordered → arrived → tested → approved 合法流转全闭环')

// 22. Sample 状态机非法跳级被拒
const sample2 = store.createSampleRecord({ projectId: projectA.id, supplierId: supA1.id, quoteId: qA1_v2.id })
let skipThrew = false
try {
  store.updateSampleRecord(sample2.id, { status: 'approved' })
} catch (e) {
  skipThrew = /样品状态不可从 ordered → approved/.test(e.message)
}
assert(skipThrew, 'ordered 直接跳级 approved 必须被 Store 强行拦截抛错')

// 23. Sample 终态不可回退
let terminalThrew = false
try {
  store.updateSampleRecord(sampleApproved.id, { status: 'tested' })
} catch (e) {
  terminalThrew = /样品状态不可从 approved → tested/.test(e.message)
}
assert(terminalThrew, 'approved 终态不可逆向回退')
console.log('  ✅ TEST 22 & 23: Sample 状态机严禁非法跳级或终态回退')

// 24. 正式供应方案锁定与切换
assert.equal(store.getProject(projectA.id).supply, undefined, '初始 Project.supply 必须为 undefined')

const projectWithSupply = store.setProjectSupply(projectA.id, {
  supplierId: supA1.id,
  quoteId: qA1_v2.id,
  by: 'test-admin',
  note: '最终定点供应商方案',
})
assert(projectWithSupply.supply, 'supply 对象已生成')
assert.equal(projectWithSupply.supply.supplierId, supA1.id)
assert.equal(projectWithSupply.supply.quoteId, qA1_v2.id)
assert.equal(projectWithSupply.supply.note, '最终定点供应商方案')
console.log('  ✅ TEST 24: setProjectSupply 成功绑定正式供应方案')

// 25. 跨项目供应方案引用被拒
let crossProjectThrew = false
try {
  store.setProjectSupply(projectA.id, {
    supplierId: supB1.id, // supB1 属于 projectB
    quoteId: qB1_v1.id,
  })
} catch (e) {
  crossProjectThrew = /不属于项目/.test(e.message)
}
assert(crossProjectThrew, '跨项目引用供应商必须被拒')
console.log('  ✅ TEST 25: 跨项目供应方案引用被严格拦截 (Fail-close)')

// 26. 清除供应方案
const projectCleared = store.clearProjectSupply(projectA.id)
assert.equal(projectCleared.supply, null, '清除后 supply 置为 null')
console.log('  ✅ TEST 26: clearProjectSupply 成功将 supply 重置为 null')

console.log('\n===== All 26 IA Project Supply Chain Workspace Tests Passed Successfully! =====\n')
