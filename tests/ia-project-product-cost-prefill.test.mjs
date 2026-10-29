/**
 * tests/ia-project-product-cost-prefill.test.mjs
 * 
 * TASK 07A-3C 专项测试：
 * Project Product Profile → Costing Prefill Overlay
 * 
 * 验证规则：
 * 1. buildOzonPrefill / buildWbPrefill 历史 snapshot-only 调用保持 100% 兼容
 * 2. product 为 null / undefined / {} 时完全 fallback 到 Snapshot
 * 3. 仅 nameZh / grossWeightG / packageDimsCm 三项允许覆盖核算草稿
 * 4. grossWeightG (g) 覆盖 Ozon weight (kg) 及 WB actualWeightG (g)
 * 5. netWeightG 严禁用于物流运费重量
 * 6. packageDimsCm 覆盖物流长宽高，productDimsCm 严禁用于物流尺寸
 * 7. 售价、采购成本、平台佣金等商业字段绝不被 Product 覆盖
 * 8. 异常类型（字符串、0、负数、Infinity、畸形数组）safe-ignore 并 fallback，不 throw
 * 9. 历史已保存 CostScenario 严格不可变，修改 Product 绝不篡改历史场景
 * 10. MV 与 Scoring 真实立项场景下未经确认与确认后的行为验证
 * 11. 静态代码契约：adapter 不 import t6Store、ProjectDetailPage 传参、边界隔离
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildOzonPrefill,
  buildWbPrefill,
  buildOzonScenarioPayload,
  buildWbScenarioPayload,
} from '../ozon-react/src/utils/t6/costScenarioAdapter.js'
import * as store from '../ozon-react/src/utils/t6/t6Store.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('\n===============================================================')
console.log('  TASK 07A-3C: Product Profile -> Costing Prefill Overlay Tests')
console.log('===============================================================\n')

// In-memory store adapter setup
const mem = new Map()
store._setAdapterForTests({
  get: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null),
  set: (k, v) => mem.set(k, JSON.stringify(v)),
  keys: () => [...mem.keys()],
})

// Sample snapshots fixture
const sampleSnapshot = {
  id: 'snap-test-01',
  projectId: 'proj-01',
  sourceInputs: {
    name: '快照原始商品名称',
    price_rub: 3600,
    weight_kg: 0.35,
    dims: [25, 18, 12],
    commission_rfbs: 14,
  },
}

// -------------------------------------------------------------
// 1. buildOzonPrefill 历史 snapshot-only 调用保持兼容
// -------------------------------------------------------------
{
  const prefill = buildOzonPrefill({ snapshot: sampleSnapshot })
  assert.equal(prefill.productName, '快照原始商品名称')
  assert.equal(prefill.price, 3600)
  assert.equal(prefill.weight, 0.35)
  assert.equal(prefill.length, 25)
  assert.equal(prefill.width, 18)
  assert.equal(prefill.height, 12)
  assert.equal(prefill.commission, 14)
  assert.equal(prefill.purchaseCost, '')
  console.log('✅ TEST 1: buildOzonPrefill 历史 snapshot-only 调用保持兼容')
}

// -------------------------------------------------------------
// 2. buildWbPrefill snapshot-only 调用保持兼容
// -------------------------------------------------------------
{
  const prefill = buildWbPrefill({ snapshot: sampleSnapshot })
  assert.equal(prefill.productName, '快照原始商品名称')
  assert.equal(prefill.actualWeightG, 350)
  assert.equal(prefill.lengthCm, 25)
  assert.equal(prefill.widthCm, 18)
  assert.equal(prefill.heightCm, 12)
  assert.equal(prefill.sellerRevenueRub, 3600)
  assert.equal(Object.keys(prefill).length, 6)
  console.log('✅ TEST 2: buildWbPrefill snapshot-only 调用保持兼容')
}

// -------------------------------------------------------------
// 3. product null 不改变 Ozon
// -------------------------------------------------------------
{
  const base = buildOzonPrefill({ snapshot: sampleSnapshot })
  const withNull = buildOzonPrefill({ snapshot: sampleSnapshot, product: null })
  assert.deepEqual(withNull, base)
  console.log('✅ TEST 3: product null 不改变 Ozon')
}

// -------------------------------------------------------------
// 4. product {} 不改变 Ozon
// -------------------------------------------------------------
{
  const base = buildOzonPrefill({ snapshot: sampleSnapshot })
  const withEmpty = buildOzonPrefill({ snapshot: sampleSnapshot, product: {} })
  assert.deepEqual(withEmpty, base)
  console.log('✅ TEST 4: product {} 不改变 Ozon')
}

// -------------------------------------------------------------
// 5. product null 不改变 WB
// -------------------------------------------------------------
{
  const base = buildWbPrefill({ snapshot: sampleSnapshot })
  const withNull = buildWbPrefill({ snapshot: sampleSnapshot, product: null })
  assert.deepEqual(withNull, base)
  console.log('✅ TEST 5: product null 不改变 WB')
}

// -------------------------------------------------------------
// 6. product {} 不改变 WB
// -------------------------------------------------------------
{
  const base = buildWbPrefill({ snapshot: sampleSnapshot })
  const withEmpty = buildWbPrefill({ snapshot: sampleSnapshot, product: {} })
  assert.deepEqual(withEmpty, base)
  console.log('✅ TEST 6: product {} 不改变 WB')
}

// -------------------------------------------------------------
// 7. nameZh 覆盖 Ozon 商品名
// -------------------------------------------------------------
{
  const product = { nameZh: '人工确认档案商品名称' }
  const prefill = buildOzonPrefill({ snapshot: sampleSnapshot, product })
  assert.equal(prefill.productName, '人工确认档案商品名称')
  console.log('✅ TEST 7: nameZh 覆盖 Ozon 商品名')
}

// -------------------------------------------------------------
// 8. nameZh 覆盖 WB 商品名
// -------------------------------------------------------------
{
  const product = { nameZh: '人工确认档案商品名称' }
  const prefill = buildWbPrefill({ snapshot: sampleSnapshot, product })
  assert.equal(prefill.productName, '人工确认档案商品名称')
  console.log('✅ TEST 8: nameZh 覆盖 WB 商品名')
}

// -------------------------------------------------------------
// 9. 空 nameZh fallback Snapshot
// -------------------------------------------------------------
{
  for (const emptyName of ['', '   ', null, undefined]) {
    const prefillOz = buildOzonPrefill({ snapshot: sampleSnapshot, product: { nameZh: emptyName } })
    const prefillWb = buildWbPrefill({ snapshot: sampleSnapshot, product: { nameZh: emptyName } })
    assert.equal(prefillOz.productName, '快照原始商品名称')
    assert.equal(prefillWb.productName, '快照原始商品名称')
  }
  console.log('✅ TEST 9: 空 nameZh fallback Snapshot')
}

// -------------------------------------------------------------
// 10. grossWeightG 覆盖 Ozon 重量并 g→kg
// -------------------------------------------------------------
{
  const product = { grossWeightG: 500 }
  const prefill = buildOzonPrefill({ snapshot: sampleSnapshot, product })
  assert.equal(prefill.weight, 0.5)
  console.log('✅ TEST 10: grossWeightG 覆盖 Ozon 重量并 g→kg (500g -> 0.5kg)')
}

// -------------------------------------------------------------
// 11. grossWeightG 覆盖 WB actualWeightG
// -------------------------------------------------------------
{
  const product = { grossWeightG: 500 }
  const prefill = buildWbPrefill({ snapshot: sampleSnapshot, product })
  assert.equal(prefill.actualWeightG, 500)
  console.log('✅ TEST 11: grossWeightG 覆盖 WB actualWeightG (500g)')
}

// -------------------------------------------------------------
// 12. netWeightG 不覆盖物流重量
// -------------------------------------------------------------
{
  const product = { netWeightG: 280, grossWeightG: null }
  const prefillOz = buildOzonPrefill({ snapshot: sampleSnapshot, product })
  const prefillWb = buildWbPrefill({ snapshot: sampleSnapshot, product })
  assert.equal(prefillOz.weight, 0.35, 'Ozon 物流重量绝不得被 netWeightG 覆盖')
  assert.equal(prefillWb.actualWeightG, 350, 'WB 物流重量绝不得被 netWeightG 覆盖')
  console.log('✅ TEST 12: netWeightG 不覆盖物流重量 (严禁净重用于运费)')
}

// -------------------------------------------------------------
// 13. packageDimsCm 覆盖 Ozon L/W/H
// -------------------------------------------------------------
{
  const product = { packageDimsCm: [30, 20, 10] }
  const prefill = buildOzonPrefill({ snapshot: sampleSnapshot, product })
  assert.equal(prefill.length, 30)
  assert.equal(prefill.width, 20)
  assert.equal(prefill.height, 10)
  console.log('✅ TEST 13: packageDimsCm 覆盖 Ozon L/W/H')
}

// -------------------------------------------------------------
// 14. packageDimsCm 覆盖 WB L/W/H
// -------------------------------------------------------------
{
  const product = { packageDimsCm: [30, 20, 10] }
  const prefill = buildWbPrefill({ snapshot: sampleSnapshot, product })
  assert.equal(prefill.lengthCm, 30)
  assert.equal(prefill.widthCm, 20)
  assert.equal(prefill.heightCm, 10)
  console.log('✅ TEST 14: packageDimsCm 覆盖 WB L/W/H')
}

// -------------------------------------------------------------
// 15. productDimsCm 不覆盖物流尺寸
// -------------------------------------------------------------
{
  const product = { productDimsCm: [20, 10, 5], packageDimsCm: null }
  const prefillOz = buildOzonPrefill({ snapshot: sampleSnapshot, product })
  const prefillWb = buildWbPrefill({ snapshot: sampleSnapshot, product })
  assert.equal(prefillOz.length, 25, 'Ozon 尺寸绝不得被 productDimsCm 裸机尺寸覆盖')
  assert.equal(prefillWb.lengthCm, 25, 'WB 尺寸绝不得被 productDimsCm 裸机尺寸覆盖')
  console.log('✅ TEST 15: productDimsCm 不覆盖物流尺寸 (严禁裸机尺寸用于物流运费)')
}

// -------------------------------------------------------------
// 16. 单独 name 可覆盖，其它 fallback
// -------------------------------------------------------------
{
  const product = { nameZh: '仅改名称' }
  const prefillOz = buildOzonPrefill({ snapshot: sampleSnapshot, product })
  const prefillWb = buildWbPrefill({ snapshot: sampleSnapshot, product })
  assert.equal(prefillOz.productName, '仅改名称')
  assert.equal(prefillOz.weight, 0.35)
  assert.equal(prefillOz.length, 25)

  assert.equal(prefillWb.productName, '仅改名称')
  assert.equal(prefillWb.actualWeightG, 350)
  assert.equal(prefillWb.lengthCm, 25)
  console.log('✅ TEST 16: 单独 name 可覆盖，其它 fallback')
}

// -------------------------------------------------------------
// 17. 单独 weight 可覆盖，其它 fallback
// -------------------------------------------------------------
{
  const product = { grossWeightG: 620 }
  const prefillOz = buildOzonPrefill({ snapshot: sampleSnapshot, product })
  const prefillWb = buildWbPrefill({ snapshot: sampleSnapshot, product })
  assert.equal(prefillOz.productName, '快照原始商品名称')
  assert.equal(prefillOz.weight, 0.62)
  assert.equal(prefillOz.length, 25)

  assert.equal(prefillWb.productName, '快照原始商品名称')
  assert.equal(prefillWb.actualWeightG, 620)
  assert.equal(prefillWb.lengthCm, 25)
  console.log('✅ TEST 17: 单独 weight 可覆盖，其它 fallback')
}

// -------------------------------------------------------------
// 18. 单独 dims 可覆盖，其它 fallback
// -------------------------------------------------------------
{
  const product = { packageDimsCm: [40, 30, 20] }
  const prefillOz = buildOzonPrefill({ snapshot: sampleSnapshot, product })
  const prefillWb = buildWbPrefill({ snapshot: sampleSnapshot, product })
  assert.equal(prefillOz.productName, '快照原始商品名称')
  assert.equal(prefillOz.weight, 0.35)
  assert.equal(prefillOz.length, 40)
  assert.equal(prefillOz.width, 30)
  assert.equal(prefillOz.height, 20)

  assert.equal(prefillWb.productName, '快照原始商品名称')
  assert.equal(prefillWb.actualWeightG, 350)
  assert.equal(prefillWb.lengthCm, 40)
  assert.equal(prefillWb.widthCm, 30)
  assert.equal(prefillWb.heightCm, 20)
  console.log('✅ TEST 18: 单独 dims 可覆盖，其它 fallback')
}

// -------------------------------------------------------------
// 19. string grossWeightG 被忽略
// -------------------------------------------------------------
{
  const product = { grossWeightG: '500' }
  const prefillOz = buildOzonPrefill({ snapshot: sampleSnapshot, product })
  const prefillWb = buildWbPrefill({ snapshot: sampleSnapshot, product })
  assert.equal(prefillOz.weight, 0.35)
  assert.equal(prefillWb.actualWeightG, 350)
  console.log('✅ TEST 19: string grossWeightG 被忽略并安全 fallback')
}

// -------------------------------------------------------------
// 20. 0 或负数 grossWeightG 被忽略
// -------------------------------------------------------------
{
  for (const zeroOrNeg of [0, -100]) {
    const product = { grossWeightG: zeroOrNeg }
    const prefillOz = buildOzonPrefill({ snapshot: sampleSnapshot, product })
    const prefillWb = buildWbPrefill({ snapshot: sampleSnapshot, product })
    assert.equal(prefillOz.weight, 0.35)
    assert.equal(prefillWb.actualWeightG, 350)
  }
  console.log('✅ TEST 20: 0 或负数 grossWeightG 被忽略并安全 fallback')
}

// -------------------------------------------------------------
// 21. Infinity / NaN 被忽略
// -------------------------------------------------------------
{
  for (const badWeight of [Infinity, -Infinity, NaN]) {
    const product = { grossWeightG: badWeight }
    const prefillOz = buildOzonPrefill({ snapshot: sampleSnapshot, product })
    const prefillWb = buildWbPrefill({ snapshot: sampleSnapshot, product })
    assert.equal(prefillOz.weight, 0.35)
    assert.equal(prefillWb.actualWeightG, 350)
  }
  console.log('✅ TEST 21: Infinity / NaN grossWeightG 被忽略并安全 fallback')
}

// -------------------------------------------------------------
// 22. malformed packageDims 被忽略
// -------------------------------------------------------------
{
  for (const malformed of [[30, 20], [30, 20, 10, 5], null, {}, '30x20x10']) {
    const product = { packageDimsCm: malformed }
    const prefillOz = buildOzonPrefill({ snapshot: sampleSnapshot, product })
    const prefillWb = buildWbPrefill({ snapshot: sampleSnapshot, product })
    assert.equal(prefillOz.length, 25)
    assert.equal(prefillOz.width, 18)
    assert.equal(prefillOz.height, 12)
    assert.equal(prefillWb.lengthCm, 25)
    assert.equal(prefillWb.widthCm, 18)
    assert.equal(prefillWb.heightCm, 12)
  }
  console.log('✅ TEST 22: malformed packageDims 被忽略并安全 fallback')
}

// -------------------------------------------------------------
// 23. packageDims 字符串数组或非法数字被忽略
// -------------------------------------------------------------
{
  for (const badArr of [['30', '20', '10'], [30, -20, 10], [30, 0, 10], [30, NaN, 10]]) {
    const product = { packageDimsCm: badArr }
    const prefillOz = buildOzonPrefill({ snapshot: sampleSnapshot, product })
    const prefillWb = buildWbPrefill({ snapshot: sampleSnapshot, product })
    assert.equal(prefillOz.length, 25)
    assert.equal(prefillWb.lengthCm, 25)
  }
  console.log('✅ TEST 23: packageDims 字符串数组或包含 <=0/NaN 被忽略并安全 fallback')
}

// -------------------------------------------------------------
// 24. product 不覆盖售价
// -------------------------------------------------------------
{
  const product = { price: 9999, priceRub: 9999, sellingPrice: 9999 }
  const prefillOz = buildOzonPrefill({ snapshot: sampleSnapshot, product })
  const prefillWb = buildWbPrefill({ snapshot: sampleSnapshot, product })
  assert.equal(prefillOz.price, 3600)
  assert.equal(prefillWb.sellerRevenueRub, 3600)
  console.log('✅ TEST 24: product 不覆盖售价')
}

// -------------------------------------------------------------
// 25. product 不覆盖佣金
// -------------------------------------------------------------
{
  const product = { commission: 5, commissionRate: 5 }
  const prefillOz = buildOzonPrefill({ snapshot: sampleSnapshot, product })
  const prefillWb = buildWbPrefill({ snapshot: sampleSnapshot, product })
  assert.equal(prefillOz.commission, 14)
  assert.equal('commissionRate' in prefillWb, false)
  console.log('✅ TEST 25: product 不覆盖佣金')
}

// -------------------------------------------------------------
// 26. product 不覆盖采购成本
// -------------------------------------------------------------
{
  const product = { purchaseCost: 88, cost: 88 }
  const prefillOz = buildOzonPrefill({ snapshot: sampleSnapshot, product })
  assert.equal(prefillOz.purchaseCost, '')
  console.log('✅ TEST 26: product 不覆盖采购成本 (保持留空，不虚构)')
}

// -------------------------------------------------------------
// 27. ProjectDetail Ozon 传 project.product
// -------------------------------------------------------------
{
  const detailFile = fs.readFileSync(path.join(__dirname, '../ozon-react/src/components/t6/ProjectDetailPage.jsx'), 'utf8')
  assert(
    detailFile.includes('buildOzonPrefill({ snapshot, product: project.product })'),
    'ProjectDetailPage 必须向 buildOzonPrefill 传递 product: project.product',
  )
  console.log('✅ TEST 27: ProjectDetail Ozon 传 project.product 源码契约成立')
}

// -------------------------------------------------------------
// 28. ProjectDetail WB 传 project.product
// -------------------------------------------------------------
{
  const detailFile = fs.readFileSync(path.join(__dirname, '../ozon-react/src/components/t6/ProjectDetailPage.jsx'), 'utf8')
  assert(
    detailFile.includes('buildWbPrefill({ snapshot, product: project.product })'),
    'ProjectDetailPage 必须向 buildWbPrefill 传递 product: project.product',
  )
  console.log('✅ TEST 28: ProjectDetail WB 传 project.product 源码契约成立')
}

// -------------------------------------------------------------
// 29. adapter 不 import t6Store
// -------------------------------------------------------------
{
  const adapterFile = fs.readFileSync(path.join(__dirname, '../ozon-react/src/utils/t6/costScenarioAdapter.js'), 'utf8')
  assert(!adapterFile.includes("from './t6Store.js'"), 'costScenarioAdapter.js 严禁导入 t6Store.js')
  assert(!adapterFile.includes('from "./t6Store.js"'), 'costScenarioAdapter.js 严禁导入 t6Store.js')
  assert(!adapterFile.includes('getProject('), 'costScenarioAdapter.js 严禁调用 getProject')
  assert(!adapterFile.includes('getSnapshot('), 'costScenarioAdapter.js 严禁调用 getSnapshot')
  console.log('✅ TEST 29: adapter 不 import t6Store 纯适配契约成立')
}

// -------------------------------------------------------------
// 30. costScenarioAdapter 不写 Product
// -------------------------------------------------------------
{
  const adapterFile = fs.readFileSync(path.join(__dirname, '../ozon-react/src/utils/t6/costScenarioAdapter.js'), 'utf8')
  assert(!adapterFile.includes('updateProjectProduct'), 'costScenarioAdapter.js 严禁写 Product')
  console.log('✅ TEST 30: costScenarioAdapter 不写 Product 契约成立')
}

// -------------------------------------------------------------
// 31. t6Store 未被修改为依赖 prefill
// -------------------------------------------------------------
{
  const storeFile = fs.readFileSync(path.join(__dirname, '../ozon-react/src/utils/t6/t6Store.js'), 'utf8')
  assert(!storeFile.includes('buildOzonPrefill'), 't6Store.js 严禁依赖 buildOzonPrefill')
  assert(!storeFile.includes('buildWbPrefill'), 't6Store.js 严禁依赖 buildWbPrefill')
  console.log('✅ TEST 31: t6Store 未被修改为依赖 prefill')
}

// -------------------------------------------------------------
// 32. ProductProfileEditor 未被修改为依赖 costScenarioAdapter
// -------------------------------------------------------------
{
  const editorFile = fs.readFileSync(path.join(__dirname, '../ozon-react/src/components/t6/ProductProfileEditor.jsx'), 'utf8')
  assert(!editorFile.includes('costScenarioAdapter'), 'ProductProfileEditor 严禁耦合 costScenarioAdapter')
  console.log('✅ TEST 32: ProductProfileEditor 未修改')
}

// -------------------------------------------------------------
// 33. gateEngine 未被修改为依赖 prefill 或 product
// -------------------------------------------------------------
{
  const gateFile = fs.readFileSync(path.join(__dirname, '../ozon-react/src/utils/t6/gateEngine.js'), 'utf8')
  assert(!gateFile.includes('buildOzonPrefill'), 'gateEngine 严禁耦合 buildOzonPrefill')
  assert(!gateFile.includes('buildWbPrefill'), 'gateEngine 严禁耦合 buildWbPrefill')
  assert(!gateFile.includes('project.product'), 'gateEngine 严禁耦合 project.product')
  console.log('✅ TEST 33: gateEngine 未被修改为依赖 prefill 或 product')
}

// -------------------------------------------------------------
// 34. 历史 Scenario 不变测试 (§33)
// -------------------------------------------------------------
{
  mem.clear()
  const { candidate } = store.ensureCandidate({
    sourceProductId: 'PROD-34',
    candidateIndex: 1,
    name: '历史不可变商品',
    categoryLeaf: '家用手套',
    categoryFull: '住宅和花园>家居用品>家用手套',
  })
  const snap = store.buildScoringSnapshot({
    scored: {
      index: 0, name: '历史不可变商品', leaf: '家用手套', categoryFull: '住宅和花园>家居用品>家用手套',
      kind: 'exact', totalScore: 80, grade: 'A', gradeTentative: false, context: 'HIGH', evidenceCoverage: 0.9,
      dimensions: { demand: { score: 80, weight: 25, available: true, coverage: 1, marketScaleScore: 80, candidateStrengthScore: 80 } },
      supplyGap: null, status: [], decision: { status: 'ELIGIBLE', action: 'PILOT_TEST', reason: 'NO_BLOCKING_FLAG' },
      ruleVersion: '1.0', matchedProductType: null, benchmarkSampleSize: null,
      strengths: [], risks: [], missingMetrics: [],
    },
    canonical: {
      source_product_id: 'PROD-34', category_leaf: '家用手套', category_full: '住宅和花园>家居用品>家用手套',
      price_rub: 3000, avg_price_rub: 3000, sales_rub_28d: 100000, units_28d: 500,
      conv_rate: 0.5, cart_add_rate: 10, exposure: 50000, card_visits: 2500, reviews: 50,
      gross_margin: 40, commission_fbs: 20, commission_fbo: 19, commission_rfbs: 12, commission_fbp: 18,
      ad_share: 5, weight_kg: 0.35, dims: [20, 15, 10], ship_mode: 'FBO',
      sign_rate: 90, oos_days_share: 10, stock: 500, turnover: 20, revenue_loss_rate: 0.01,
    },
    benchmarkMeta: { version: '1.0', generated_at: 't' },
    benchmarkDoc: { product_types: {} },
    rules: { version: '1.0' },
    datasetVersion: 't',
    candidateId: candidate.id,
  })
  const project = store.createProject({ candidateId: candidate.id, creationSnapshotId: snap.id })

  // 1. 设置 Product grossWeightG = 400 (首次保存需包含必填核心 nameZh, categoryLeaf)
  store.updateProjectProduct(project.id, {
    nameZh: '历史不可变商品',
    categoryLeaf: '家用手套',
    grossWeightG: 400,
  })
  const projAfterFirstUpdate = store.getProject(project.id)

  // 2. 打开 WB Prefill -> 400
  const prefill1 = buildWbPrefill({ snapshot: snap, product: projAfterFirstUpdate.product })
  assert.equal(prefill1.actualWeightG, 400)

  // 3. 保存 Scenario A
  const inputPayloadA = { ...prefill1, purchaseCost: 20, commissionRate: 25 }
  const scenarioA = store.createCostScenario({
    projectId: project.id,
    platform: 'WB',
    name: 'Scenario A',
    sourceSnapshotId: snap.id,
    inputPayload: inputPayloadA,
    resolvedConfig: { calculatorVersion: 'wb-order-v2' },
    outputPayload: { profitCalc: { operatingProfitCny: 15, profitMargin: 20 } },
  })
  const scenarioABytesBefore = JSON.stringify(store.getCostScenario(scenarioA.id))

  // 4. 更新 Product -> 500g
  store.updateProjectProduct(project.id, { grossWeightG: 500 })
  const projAfterSecondUpdate = store.getProject(project.id)

  // 5. 校验 Scenario A inputPayload 仍为 400
  const scenarioAAfter = store.getCostScenario(scenarioA.id)
  assert.equal(scenarioAAfter.inputPayload.actualWeightG, 400, '历史 Scenario A 必须保持保存时的 400g')
  assert.equal(JSON.stringify(scenarioAAfter), scenarioABytesBefore, '历史 Scenario A 字节严格不变')

  // 6. 再次打开 WB Prefill -> 500g
  const prefill2 = buildWbPrefill({ snapshot: snap, product: projAfterSecondUpdate.product })
  assert.equal(prefill2.actualWeightG, 500, '新打开 Calculator 预填采用最新的 500g')

  console.log('✅ TEST 34: 历史 Scenario 不变测试（Current Product ≠ Historical Scenario Mutation）')
}

// -------------------------------------------------------------
// 35. MV 场景特别测试 (§34)
// -------------------------------------------------------------
{
  const mvSnapshot = {
    id: 'snap-mv-01',
    projectId: 'proj-mv',
    sourceInputs: {
      name: '吹风机机身',
      price_rub: 1490,
      weight_kg: 0.35,
      dims: [30, 20, 8],
      commission_rfbs: null,
    },
  }

  // 1. 未人工确认 Product (grossWeightG 为 null)
  const unconfirmedProduct = { grossWeightG: null, nameZh: '吹风机机身' }
  const prefillInitial = buildWbPrefill({ snapshot: mvSnapshot, product: unconfirmedProduct })
  assert.equal(prefillInitial.actualWeightG, 350, '未人工确认时，继续使用 MV snapshot 350g 作为物流重量')

  // 2. 人工打样确认 Product grossWeightG = 480
  const confirmedProduct = { grossWeightG: 480, nameZh: '吹风机机身' }
  const prefillConfirmed = buildWbPrefill({ snapshot: mvSnapshot, product: confirmedProduct })
  assert.equal(prefillConfirmed.actualWeightG, 480, '人工确认后，当前真实毛重 480g 覆盖历史参考')

  console.log('✅ TEST 35: MV 场景特别测试（未确认沿用立项参考，确认后当前事实覆盖历史参考）')
}

// -------------------------------------------------------------
// 36. Scoring 场景特别测试 (§35)
// -------------------------------------------------------------
{
  const scoringSnapshot = {
    id: 'snap-sc-01',
    projectId: 'proj-sc',
    sourceInputs: {
      name: '评分阶段商品',
      price_rub: 2500,
      weight_kg: 0.6,
      dims: [30, 20, 10],
      commission_rfbs: 15,
    },
  }

  // Product 初始化时没有保存正式物理事实 (grossWeightG = null, packageDimsCm = null)
  const initialProduct = {
    nameZh: '评分阶段商品',
    grossWeightG: null,
    packageDimsCm: null,
  }

  const prefillWb = buildWbPrefill({ snapshot: scoringSnapshot, product: initialProduct })
  assert.equal(prefillWb.actualWeightG, 600, 'Scoring Snapshot 物理事实 fallback 保持 600g')
  assert.equal(prefillWb.lengthCm, 30)
  assert.equal(prefillWb.widthCm, 20)
  assert.equal(prefillWb.heightCm, 10)

  const prefillOz = buildOzonPrefill({ snapshot: scoringSnapshot, product: initialProduct })
  assert.equal(prefillOz.weight, 0.6)
  assert.equal(prefillOz.length, 30)
  assert.equal(prefillOz.width, 20)
  assert.equal(prefillOz.height, 10)

  console.log('✅ TEST 36: Scoring 场景特别测试（Product 未填时 legacy Snapshot fallback 完整保持）')
}

console.log('\n===============================================================')
console.log('  ALL 36 Product Cost Prefill Overlay Tests Passed Successfully!')
console.log('===============================================================\n')
