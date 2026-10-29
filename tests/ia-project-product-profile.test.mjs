/**
 * tests/ia-project-product-profile.test.mjs
 * 
 * TASK 07A-3B: Project Product Profile V1 — Store + Editor + Audit 专项测试
 * 
 * 覆盖：
 * 1. 静态源码与组件挂载契约（Editor、Detail Tab、不破坏 Legacy 与 Gate）
 * 2. productProfile 纯函数事实源与边界校验（Whitelist、Fail-close、类型保护）
 * 3. 一次性草稿生成与语义安全保护（重量不预填、尺寸安全读取、variantLabel 绝不猜字符串）
 * 4. t6Store.updateProjectProduct 行为、事务一致性、DecisionLog 审计与项目隔离
 * 5. 初始化非持续同步与历史项目兼容性
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  _setAdapterForTests,
  ensureCandidate,
  refreshCandidateSnapshot,
  createSnapshot,
  createProject,
  getProject,
  getSnapshot,
  getLog,
  updateProjectProduct,
  PROJECT_PRODUCT_FIELDS,
  isProjectProductEmpty,
  buildInitialProjectProductDraft,
  buildNextProjectProduct,
  buildMarketValidationSnapshot,
} from '../ozon-react/src/utils/t6/t6Store.js'

console.log('===== IA Project Product Profile V1 Test Suite (TASK 07A-3B) =====\n')

const ROOT = path.resolve('.')
const PROFILE_UTILS_PATH = path.join(ROOT, 'ozon-react/src/utils/t6/productProfile.js')
const EDITOR_PATH = path.join(ROOT, 'ozon-react/src/components/t6/ProductProfileEditor.jsx')
const DETAIL_PATH = path.join(ROOT, 'ozon-react/src/components/t6/ProjectDetailPage.jsx')
const GATE_PATH = path.join(ROOT, 'ozon-react/src/utils/t6/gateEngine.js')
const LEGACY_PATH = path.join(ROOT, 'ozon-react/src/components/ProductDefinition.jsx')
const COST_ADAPTER_PATH = path.join(ROOT, 'ozon-react/src/utils/t6/costScenarioAdapter.js')

// ==========================================
// PART 1: 静态源码契约测试
// ==========================================
console.log('--- PART 1: 静态源码与组件契约测试 ---')

// 1. productProfile.js 存在
assert(fs.existsSync(PROFILE_UTILS_PATH), 'TEST 1: productProfile.js 文件必须存在')
console.log('  ✅ TEST 1: productProfile.js 存在')

// 36. ProductProfileEditor 存在
assert(fs.existsSync(EDITOR_PATH), 'TEST 36: ProductProfileEditor.jsx 文件必须存在')
console.log('  ✅ TEST 36: ProductProfileEditor 存在')

// 37. ProjectDetail product Tab 挂载 Editor
assert(fs.existsSync(DETAIL_PATH), 'TEST 37: ProjectDetailPage.jsx 文件必须存在')
const detailCode = fs.readFileSync(DETAIL_PATH, 'utf-8')
assert(detailCode.includes('import ProductProfileEditor from'), 'TEST 37A: ProjectDetailPage 必须导入 ProductProfileEditor')
assert(/tab === 'product' &&\s*\(\s*<ProductProfileEditor/.test(detailCode), 'TEST 37B: product Tab 必须挂载 ProductProfileEditor')
assert(detailCode.includes("product_update: '商品档案更新'"), 'TEST 37C: LOG_KIND_ZH 必须包含 product_update')
console.log('  ✅ TEST 37: ProjectDetail product Tab 挂载 Editor')

// 38. ProductDefinition 未被修改/嵌入
assert(fs.existsSync(LEGACY_PATH), 'TEST 38: ProductDefinition.jsx 必须存在且未被删除')
const legacyCode = fs.readFileSync(LEGACY_PATH, 'utf-8')
assert(!detailCode.includes('ProductDefinition'), 'TEST 38: ProjectDetailPage 严禁引入 ProductDefinition')
assert(!legacyCode.includes('updateProjectProduct'), 'TEST 38: ProductDefinition 严禁直接调用 updateProjectProduct')
console.log('  ✅ TEST 38: ProductDefinition 未被修改/嵌入')

// 39. gateEngine 未修改
const gateCode = fs.readFileSync(GATE_PATH, 'utf-8')
assert(!gateCode.includes('product_complete'), 'TEST 39: gateEngine 严禁新增 product 相关 gate')
assert(!gateCode.includes('sku_ready'), 'TEST 39: gateEngine 严禁新增 sku_ready gate')
console.log('  ✅ TEST 39: gateEngine 未修改')

// 40. CostScenario adapter 未修改
const costAdapterCode = fs.readFileSync(COST_ADAPTER_PATH, 'utf-8')
assert(!costAdapterCode.includes('project.product'), 'TEST 40: costScenarioAdapter 本轮严禁读取 project.product')
console.log('  ✅ TEST 40: CostScenario adapter 未修改')

// ==========================================
// PART 2: 纯函数事实源与草稿生成测试
// ==========================================
console.log('\n--- PART 2: 纯函数事实源与草稿生成测试 ---')

// 2. project.product 空对象识别正确
assert.equal(isProjectProductEmpty({}), true, 'TEST 2A: 字面量空对象为空')
assert.equal(isProjectProductEmpty(null), true, 'TEST 2B: null 为空')
assert.equal(isProjectProductEmpty(undefined), true, 'TEST 2C: undefined 为空')
assert.equal(isProjectProductEmpty({ nameZh: '', categoryLeaf: '', brand: '' }), true, 'TEST 2D: 全空字段为空')
assert.equal(isProjectProductEmpty({ nameZh: '高压发泡胶枪', categoryLeaf: '胶枪' }), false, 'TEST 2E: 有效档案不为空')
console.log('  ✅ TEST 2: project.product 空对象识别正确')

// 3, 4, 5. SCORING 初始 draft 仅安全预填 nameZh/categoryLeaf，重量与尺寸不自动预填
const scoringSnapshot = {
  id: 'snap-scoring-1',
  snapshotKind: 'SCORING',
  sourceInputs: {
    name: '  高速吹风机-负离子  ',
    category_leaf: '  吹风机  ',
    weight_kg: 0.55,
    dims: [28, 18, 9],
  },
}
const scoringDraft = buildInitialProjectProductDraft({
  project: { name: '项目-高速吹风机-黑色' },
  snapshot: scoringSnapshot,
})
assert.equal(scoringDraft.nameZh, '高速吹风机-负离子', 'TEST 3A: SCORING nameZh 正确带入并 trim')
assert.equal(scoringDraft.categoryLeaf, '吹风机', 'TEST 3B: SCORING categoryLeaf 正确带入并 trim')
console.log('  ✅ TEST 3: SCORING 初始 draft 仅安全预填 nameZh/categoryLeaf')

// 4. SCORING weight 不自动预填
assert.equal(scoringDraft.grossWeightG, null, 'TEST 4A: SCORING grossWeightG 必须为 null')
assert.equal(scoringDraft.netWeightG, null, 'TEST 4B: SCORING netWeightG 必须为 null')
console.log('  ✅ TEST 4: SCORING weight 不自动预填')

// 5. SCORING dims 不自动预填 packageDims
assert.equal(scoringDraft.packageDimsCm, null, 'TEST 5A: SCORING packageDimsCm 必须为 null')
assert.equal(scoringDraft.productDimsCm, null, 'TEST 5B: SCORING productDimsCm 必须为 null')
console.log('  ✅ TEST 5: SCORING dims 不自动预填 packageDims')

// 6, 7, 8, 9, 10, 11. MARKET_VALIDATION 初始 draft
const mvSnapshot = {
  id: 'snap-mv-1',
  snapshotKind: 'MARKET_VALIDATION',
  sourceInputs: {
    name: '家用乳胶手套',
    category_leaf: '劳保手套',
    dims: [25, 15, 8],
    weight_kg: 0.25,
  },
  procurementEvidence: {
    supplierName: '金华乳胶制品厂',
    supplierUrl: 'https://detail.1688.com/offer/123456.html',
    factoryPriceCny: 4.5,
    moq: 100,
    weightG: 250,
    dims: '25x15x8',
  },
}
const mvDraft = buildInitialProjectProductDraft({
  project: { name: '家用乳胶手套-黄色M码-3双装' },
  snapshot: mvSnapshot,
})

// 6. MARKET_VALIDATION 初始 draft 预填 nameZh/categoryLeaf
assert.equal(mvDraft.nameZh, '家用乳胶手套', 'TEST 6A: MV nameZh 正确带入')
assert.equal(mvDraft.categoryLeaf, '劳保手套', 'TEST 6B: MV categoryLeaf 正确带入')
console.log('  ✅ TEST 6: MARKET_VALIDATION 初始 draft 预填 nameZh/categoryLeaf')

// 7. MARKET_VALIDATION packageDims 来自 snapshot.sourceInputs.dims
assert.deepEqual(mvDraft.packageDimsCm, [25, 15, 8], 'TEST 7: packageDimsCm 必须从 sourceInputs.dims 读取')
console.log('  ✅ TEST 7: MARKET_VALIDATION packageDims 来自 snapshot.sourceInputs.dims')

// 8. 不直接使用 procurementEvidence.dims 字符串
const mvBadDimsSnapshot = {
  id: 'snap-mv-bad',
  snapshotKind: 'MARKET_VALIDATION',
  sourceInputs: {
    name: '手套',
    category_leaf: '手套',
    dims: null, // sourceInputs 未成功解析
  },
  procurementEvidence: {
    weightG: 250,
    dims: '25x15x8', // 仅有原始字符串
  },
}
const mvBadDimsDraft = buildInitialProjectProductDraft({
  project: { name: '手套' },
  snapshot: mvBadDimsSnapshot,
})
assert.equal(mvBadDimsDraft.packageDimsCm, null, 'TEST 8: 严禁直接使用 procurementEvidence.dims 字符串作为 packageDimsCm')
console.log('  ✅ TEST 8: 不直接使用 procurementEvidence.dims 字符串')

// 9. MARKET_VALIDATION weightG 不自动映射 grossWeightG
assert.equal(mvDraft.grossWeightG, null, 'TEST 9: MV weightG 严禁自动映射 grossWeightG')
console.log('  ✅ TEST 9: MARKET_VALIDATION weightG 不自动映射 grossWeightG')

// 10. MARKET_VALIDATION weightG 不自动映射 netWeightG
assert.equal(mvDraft.netWeightG, null, 'TEST 10: MV weightG 严禁自动映射 netWeightG')
console.log('  ✅ TEST 10: MARKET_VALIDATION weightG 不自动映射 netWeightG')

// 11. variantLabel 不从 project.name 猜测
assert.equal(mvDraft.variantLabel, '', 'TEST 11: variantLabel 严禁从 project.name 猜测提取（必须为空字符串）')
console.log('  ✅ TEST 11: variantLabel 不从 project.name 猜测')

// ==========================================
// PART 3: buildNextProjectProduct 纯函数校验与白名单 (Fail-close)
// ==========================================
console.log('\n--- PART 3: buildNextProjectProduct 校验与白名单 ---')

// 12. 首次保存成功
const validInitialPatch = {
  nameZh: '专业吹风机',
  categoryLeaf: '个护家电',
  brand: 'PINGPREM',
}
const initialProduct = buildNextProjectProduct({ current: {}, patch: validInitialPatch })
assert.equal(initialProduct.nameZh, '专业吹风机', 'TEST 12A: nameZh 设置成功')
assert.equal(initialProduct.categoryLeaf, '个护家电', 'TEST 12B: categoryLeaf 设置成功')
assert.equal(initialProduct.brand, 'PINGPREM', 'TEST 12C: brand 设置成功')
assert.equal(initialProduct.grossWeightG, null, 'TEST 12D: 未填权重默认为 null')
assert.equal(initialProduct.variantLabel, '', 'TEST 12E: 未填字符串默认为空')
console.log('  ✅ TEST 12: updateProjectProduct 首次保存成功')

// 13. 缺 nameZh 拒绝
assert.throws(() => {
  buildNextProjectProduct({ current: {}, patch: { categoryLeaf: '胶枪' } })
}, /nameZh.*必填/, 'TEST 13A: 缺 nameZh 必须抛错')
assert.throws(() => {
  buildNextProjectProduct({ current: {}, patch: { nameZh: '   ', categoryLeaf: '胶枪' } })
}, /nameZh.*必填/, 'TEST 13B: 空白 nameZh 必须抛错')
console.log('  ✅ TEST 13: 缺 nameZh 拒绝')

// 14. 缺 categoryLeaf 拒绝
assert.throws(() => {
  buildNextProjectProduct({ current: {}, patch: { nameZh: '胶枪' } })
}, /categoryLeaf.*必填/, 'TEST 14A: 缺 categoryLeaf 必须抛错')
assert.throws(() => {
  buildNextProjectProduct({ current: {}, patch: { nameZh: '胶枪', categoryLeaf: '' } })
}, /categoryLeaf.*必填/, 'TEST 14B: 空白 categoryLeaf 必须抛错')
console.log('  ✅ TEST 14: 缺 categoryLeaf 拒绝')

// 15. unknown field 拒绝
assert.throws(() => {
  buildNextProjectProduct({ current: initialProduct, patch: { fooBar: 123 } })
}, /未知或非法商品档案字段/, 'TEST 15: 未知字段必须抛错')
console.log('  ✅ TEST 15: unknown field 拒绝')

// 16. Supplier 字段拒绝
for (const sf of ['supplierName', 'factoryPriceCny', 'purchasePriceCny', 'moq']) {
  assert.throws(() => {
    buildNextProjectProduct({ current: initialProduct, patch: { [sf]: 'val' } })
  }, /未知或非法商品档案字段/, `TEST 16: Supplier 字段 ${sf} 必须被拒绝`)
}
console.log('  ✅ TEST 16: Supplier 字段拒绝')

// 17. Cost 字段拒绝
for (const cf of ['targetPriceRub', 'commissionRatePct', 'profit', 'marginPct']) {
  assert.throws(() => {
    buildNextProjectProduct({ current: initialProduct, patch: { [cf]: 100 } })
  }, /未知或非法商品档案字段/, `TEST 17: Cost 字段 ${cf} 必须被拒绝`)
}
console.log('  ✅ TEST 17: Cost 字段拒绝')

// 18. Listing 字段拒绝
for (const lf of ['titleRu', 'bulletPoints', 'description']) {
  assert.throws(() => {
    buildNextProjectProduct({ current: initialProduct, patch: { [lf]: 'copy' } })
  }, /未知或非法商品档案字段/, `TEST 18: Listing 字段 ${lf} 必须被拒绝`)
}
console.log('  ✅ TEST 18: Listing 字段拒绝')

// 19. Compliance 字段拒绝
for (const compf of ['eacStatus', 'certificateNumber']) {
  assert.throws(() => {
    buildNextProjectProduct({ current: initialProduct, patch: { [compf]: 'cert' } })
  }, /未知或非法商品档案字段/, `TEST 19: Compliance 字段 ${compf} 必须被拒绝`)
}
console.log('  ✅ TEST 19: Compliance 字段拒绝')

// 20. 合法 optional string 保存
const patchWithStrings = {
  nameRu: '  Фен  ',
  model: 'PP-01',
  material: 'ABS',
  variantLabel: '黑色',
  barcode: '6901234567890',
}
const resStrings = buildNextProjectProduct({ current: initialProduct, patch: patchWithStrings })
assert.equal(resStrings.nameRu, 'Фен', 'TEST 20A: nameRu trim 保存')
assert.equal(resStrings.model, 'PP-01', 'TEST 20B: model 保存')
assert.equal(resStrings.material, 'ABS', 'TEST 20C: material 保存')
assert.equal(resStrings.variantLabel, '黑色', 'TEST 20D: variantLabel 保存')
assert.equal(resStrings.barcode, '6901234567890', 'TEST 20E: barcode 保存')
console.log('  ✅ TEST 20: 合法 optional string 保存')

// 21. grossWeightG null 合法
const resNullWeight = buildNextProjectProduct({ current: initialProduct, patch: { grossWeightG: null } })
assert.equal(resNullWeight.grossWeightG, null, 'TEST 21: grossWeightG 可以为 null')
console.log('  ✅ TEST 21: grossWeightG null 合法')

// 22. grossWeightG 正数合法
const resPosWeight = buildNextProjectProduct({ current: initialProduct, patch: { grossWeightG: 500.5 } })
assert.equal(resPosWeight.grossWeightG, 500.5, 'TEST 22: grossWeightG 为正数合法')
console.log('  ✅ TEST 22: grossWeightG 正数合法')

// 23. grossWeightG 0 / negative / NaN / Infinity 拒绝
for (const badW of [0, -10, NaN, Infinity, '500']) {
  assert.throws(() => {
    buildNextProjectProduct({ current: initialProduct, patch: { grossWeightG: badW } })
  }, /grossWeightG.*有效正数/, `TEST 23: grossWeightG = ${badW} 必须被拒绝`)
}
console.log('  ✅ TEST 23: grossWeightG 0 / negative / NaN / Infinity 拒绝')

// 24. dims null 合法
const resNullDims = buildNextProjectProduct({ current: initialProduct, patch: { packageDimsCm: null } })
assert.equal(resNullDims.packageDimsCm, null, 'TEST 24: packageDimsCm 为 null 合法')
console.log('  ✅ TEST 24: dims null 合法')

// 25. dims 正确 3 正数合法
const resGoodDims = buildNextProjectProduct({ current: initialProduct, patch: { packageDimsCm: [20, 15, 10] } })
assert.deepEqual(resGoodDims.packageDimsCm, [20, 15, 10], 'TEST 25: packageDimsCm 为 3 正数合法')
console.log('  ✅ TEST 25: dims 正确 3 正数合法')

// 26. dims 长度错误拒绝
assert.throws(() => {
  buildNextProjectProduct({ current: initialProduct, patch: { packageDimsCm: [20, 15] } })
}, /packageDimsCm.*3 个大于 0 正数/, 'TEST 26: 长度 2 必须被拒绝')
assert.throws(() => {
  buildNextProjectProduct({ current: initialProduct, patch: { packageDimsCm: [20, 15, 10, 5] } })
}, /packageDimsCm.*3 个大于 0 正数/, 'TEST 26: 长度 4 必须被拒绝')
console.log('  ✅ TEST 26: dims 长度错误拒绝')

// 27. dims 0/负数/字符串拒绝
for (const badDims of [[20, 15, 0], [20, -5, 10], ['20', 15, 10], [20, NaN, 10]]) {
  assert.throws(() => {
    buildNextProjectProduct({ current: initialProduct, patch: { packageDimsCm: badDims } })
  }, /packageDimsCm.*3 个大于 0 正数/, `TEST 27: dims = ${JSON.stringify(badDims)} 必须被拒绝`)
}
console.log('  ✅ TEST 27: dims 0/负数/字符串拒绝')

// 28. partial patch 保留其它字段
const partialPatch = { model: 'V2-PRO' }
const patchedProduct = buildNextProjectProduct({ current: resStrings, patch: partialPatch })
assert.equal(patchedProduct.nameZh, '专业吹风机', 'TEST 28A: 保留原有 nameZh')
assert.equal(patchedProduct.categoryLeaf, '个护家电', 'TEST 28B: 保留原有 categoryLeaf')
assert.equal(patchedProduct.brand, 'PINGPREM', 'TEST 28C: 保留原有 brand')
assert.equal(patchedProduct.model, 'V2-PRO', 'TEST 28D: 成功更新 model')
assert.equal(patchedProduct.material, 'ABS', 'TEST 28E: 保留原有 material')
console.log('  ✅ TEST 28: partial patch 保留其它字段')

// ==========================================
// PART 4: t6Store 运行时行为、日志与项目隔离测试
// ==========================================
console.log('\n--- PART 4: t6Store 运行时行为、日志与项目隔离测试 ---')

// 注入测试内存适配器
const memoryDb = new Map()
_setAdapterForTests({
  get: (k) => memoryDb.get(k) || null,
  set: (k, v) => memoryDb.set(k, v),
  keys: () => Array.from(memoryDb.keys()),
})

// 创建候选人与立项
const { candidate: cand } = ensureCandidate({
  sourceProductId: 'PROD-T7-001',
  candidateIndex: 0,
  name: '恒温电吹风',
  categoryLeaf: '个护美发',
  categoryFull: '个护美发>吹风机',
})
const snap = createSnapshot({
  candidateId: cand.id,
  sourceProductId: cand.sourceProductId,
  scoreResult: {
    totalScore: 85,
    grade: 'A',
    status: [],
    decision: { status: 'ELIGIBLE' },
  },
  sourceInputs: {
    name: '恒温负离子电吹风',
    category_leaf: '电吹风',
    dims: [24, 16, 8],
    weight_kg: 0.6,
  },
  versions: { rulesVersion: '1.0' },
})
refreshCandidateSnapshot(cand.id, snap.id)
const projA = createProject({
  candidateId: cand.id,
  creationSnapshotId: snap.id,
  name: '项目A-恒温电吹风-黑色',
})

// 29. update product 不修改 project.name
const updatedProjA = updateProjectProduct(projA.id, {
  nameZh: '专业恒温电吹风',
  categoryLeaf: '美发电器',
  brand: 'AIRFLOW',
})
assert.equal(updatedProjA.name, '项目A-恒温电吹风-黑色', 'TEST 29: project.name 保持不变')
assert.equal(updatedProjA.product.nameZh, '专业恒温电吹风', 'TEST 29: product.nameZh 独立更新')
console.log('  ✅ TEST 29: update product 不修改 project.name')

// 30. update category 不修改 project.source.category
assert.equal(updatedProjA.source.category, '个护美发', 'TEST 30: project.source.category 保持时点事实不变')
assert.equal(updatedProjA.product.categoryLeaf, '美发电器', 'TEST 30: product.categoryLeaf 独立更新')
console.log('  ✅ TEST 30: update category 不修改 project.source.category')

// 31. update 不修改 Snapshot
const snapAfter = getSnapshot(snap.id)
assert.deepEqual(snapAfter.sourceInputs.dims, [24, 16, 8], 'TEST 31: Snapshot 不可变，未受修改')
console.log('  ✅ TEST 31: update 不修改 Snapshot')

// 32. update 不修改 Supplier / Costing
assert.deepEqual(updatedProjA.suppliers, [], 'TEST 32A: suppliers 数组不受影响')
assert.equal(updatedProjA.costing.scenarios.length, 0, 'TEST 32B: costing scenarios 不受影响')
console.log('  ✅ TEST 32: update 不修改 Supplier / Costing')

// 33, 41. product_update DecisionLog 产生并验证紧凑差异结构
const latestProjA = getProject(projA.id)
assert(latestProjA.decisionLog.length > 0, 'TEST 33A: 项目决策日志必须有新记录')
const lastLogId = latestProjA.decisionLog[latestProjA.decisionLog.length - 1]
const logEntry = getLog(lastLogId)
assert.equal(logEntry.kind, 'product_update', 'TEST 33B: log.kind 必须为 product_update')
assert.equal(logEntry.subjectType, 'project', 'TEST 41A: log.subjectType 必须为 project')
assert.equal(logEntry.subjectId, projA.id, 'TEST 41B: log.subjectId 必须为 projectId')
assert.equal(logEntry.by, 'user', 'TEST 41C: log.by 保留传入值')

// 差异对象仅包含变更字段
const fromObj = JSON.parse(logEntry.from)
const toObj = JSON.parse(logEntry.to)
assert('nameZh' in toObj, 'TEST 41D: toObj 包含变更字段 nameZh')
assert('categoryLeaf' in toObj, 'TEST 41E: toObj 包含变更字段 categoryLeaf')
assert('brand' in toObj, 'TEST 41F: toObj 包含变更字段 brand')
assert(!('packageDimsCm' in toObj), 'TEST 41G: 未变更字段 packageDimsCm 不应出现在 to 差异中')
console.log('  ✅ TEST 33 & 41: product_update DecisionLog 产生并验证紧凑差异结构')

// 34. no-op update 不产生新 Log
const logCountBefore = latestProjA.decisionLog.length
const noOpRes = updateProjectProduct(projA.id, {
  brand: 'AIRFLOW', // 相同值
})
const projAfterNoOp = getProject(projA.id)
assert.equal(projAfterNoOp.decisionLog.length, logCountBefore, 'TEST 34: no-op 不追加新日志')
console.log('  ✅ TEST 34: no-op update 不产生新 Log')

// 35. Project A / Project B Product 隔离
const projB = createProject({
  candidateId: cand.id,
  creationSnapshotId: snap.id,
  name: '项目B-恒温电吹风-白色',
})
updateProjectProduct(projB.id, {
  nameZh: '便携式负离子吹风机',
  categoryLeaf: '美发电器',
  brand: 'OTHER_BRAND',
})
const finalA = getProject(projA.id)
const finalB = getProject(projB.id)
assert.equal(finalA.product.brand, 'AIRFLOW', 'TEST 35A: Project A 品牌不受 Project B 影响')
assert.equal(finalB.product.brand, 'OTHER_BRAND', 'TEST 35B: Project B 品牌不受 Project A 影响')
console.log('  ✅ TEST 35: Project A / Project B Product 隔离')

// 42. 初始化非持续同步测试 (One-time Draft)
// 第一阶段：project.product 初始为空，从 MV Snapshot 生成 draft 包含 [24, 16, 8]
const { candidate: miCand } = ensureCandidate({
  sourceProductId: 'wb-niche-uid-fresh',
  candidateIndex: 1,
  name: '发泡胶枪',
  categoryLeaf: '发泡胶枪',
  categoryFull: '工具/发泡胶枪',
  source_system: 'WB_MARKET_INTELLIGENCE',
  source_niche_uid: 'uid-fresh',
  marketEvidence: {
    schemaVersion: 1,
    nicheUid: 'uid-fresh',
    mos: 80,
    pfs: 90,
    gmv: 1000000,
    growth: 15,
    buyout: 85,
    sellers: 20,
    price: 1500,
    weightG: 600,
    heavy: 'NO',
    verdict: 'POTENTIAL',
    risks: [],
    syncedAt: '2026-09-18T09:00:00.000Z',
  },
})
const quote = {
  uid: 'uid-fresh',
  name: '发泡胶枪',
  supplierName: '精工制造',
  supplierUrl: 'https://1688.com/offer/987.html',
  factoryPriceCny: 32,
  moq: 100,
  weightG: 600,
  dims: '24x16x8',
  targetPriceRub: 1450,
}
const mvSnap = buildMarketValidationSnapshot({ candidate: miCand, quote })
const freshProject = createProject({
  candidateId: miCand.id,
  creationSnapshotId: mvSnap.id,
  name: '新鲜立项',
})
assert.equal(isProjectProductEmpty(freshProject.product), true, 'TEST 42A: 初始为空')
const draft1 = buildInitialProjectProductDraft({ project: freshProject, snapshot: mvSnap })
assert.deepEqual(draft1.packageDimsCm, [24, 16, 8], 'TEST 42B: 首次 draft 读取快照外包装尺寸')

// 用户显式保存并修改为 [30, 20, 10]
updateProjectProduct(freshProject.id, {
  nameZh: draft1.nameZh,
  categoryLeaf: draft1.categoryLeaf,
  packageDimsCm: [30, 20, 10],
})

// 第二阶段：再次读取 project.product
const savedProject = getProject(freshProject.id)
assert.equal(isProjectProductEmpty(savedProject.product), false, 'TEST 42C: 已保存，不为空')
// 契约铁律：此时 UI 必须直接使用 savedProject.product，严禁再次调用 buildInitialProjectProductDraft 从 Snapshot 覆盖
assert.deepEqual(savedProject.product.packageDimsCm, [30, 20, 10], 'TEST 42D: 保存后的尺寸必须为 [30, 20, 10]，绝不回滚为快照的 [24, 16, 8]')
console.log('  ✅ TEST 42: 初始化非持续同步测试通过')

// 43. 历史 Project 兼容测试 (product: {} 可以平滑处理)
const legacyMockProject = {
  id: 'legacy-proj-001',
  name: '历史遗留项目',
  product: {},
}
assert.equal(isProjectProductEmpty(legacyMockProject.product), true, 'TEST 43: 历史遗留空 product 正确识别为 empty')
console.log('  ✅ TEST 43: 历史 Project 兼容测试通过')

console.log('\n===== All 43 IA Project Product Profile Tests Passed Successfully! =====\n')
