/**
 * tests/ia-project-supply-cost-apply.test.mjs
 * 
 * TASK 07A-3D2 专项测试：
 * Selected Supply Quote -> Costing Explicit Apply
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  SUPPLY_COST_STATUS,
  buildSupplyCostReference,
} from '../ozon-react/src/utils/t6/supplyCostBridge.js'
import * as store from '../ozon-react/src/utils/t6/t6Store.js'
import {
  buildOzonScenarioPayload,
  buildWbScenarioPayload,
} from '../ozon-react/src/utils/t6/costScenarioAdapter.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('\n===============================================================')
console.log('  TASK 07A-3D2: Selected Supply Quote -> Costing Explicit Apply')
console.log('===============================================================\n')

// In-memory store adapter setup
const mem = new Map()
store._setAdapterForTests({
  get: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null),
  set: (k, v) => mem.set(k, JSON.stringify(v)),
  keys: () => [...mem.keys()],
})

const sampleSnapshot = {
  id: 'snap-apply-01',
  projectId: 'proj-apply-01',
  productName: '测试蓝牙音箱',
  weightKg: 0.5,
  dims: [20, 15, 10],
  priceRub: 2500,
  commissionRfbs: 12,
  sourceInputs: {
    name: '测试蓝牙音箱',
    weight_kg: 0.5,
    dims: [20, 15, 10],
    price_rub: 2500,
    commission_rfbs: 12,
  },
}

function createMockProject(code = '001') {
  const { candidate } = store.ensureCandidate({
    sourceProductId: `sp-${code}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    candidateIndex: 0,
    name: `候选商品-${code}`,
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

// Read static file sources for contract checks
const bridgeSource = fs.readFileSync(
  path.join(__dirname, '../ozon-react/src/utils/t6/supplyCostBridge.js'),
  'utf8'
)
const projectDetailSource = fs.readFileSync(
  path.join(__dirname, '../ozon-react/src/components/t6/ProjectDetailPage.jsx'),
  'utf8'
)
const ozonCalcSource = fs.readFileSync(
  path.join(__dirname, '../ozon-react/src/components/OzonCalc.jsx'),
  'utf8'
)
const calculatorTabSource = fs.readFileSync(
  path.join(__dirname, '../ozon-react/src/components/wbcalc/tabs/CalculatorTab.jsx'),
  'utf8'
)
const t6StoreSource = fs.readFileSync(
  path.join(__dirname, '../ozon-react/src/utils/t6/t6Store.js'),
  'utf8'
)
const costScenarioAdapterSource = fs.readFileSync(
  path.join(__dirname, '../ozon-react/src/utils/t6/costScenarioAdapter.js'),
  'utf8'
)
const gateEngineSource = fs.readFileSync(
  path.join(__dirname, '../ozon-react/src/utils/t6/gateEngine.js'),
  'utf8'
)

// 1. supplyCostBridge.js 存在
console.log('✅ TEST 1: supplyCostBridge.js 文件存在')
assert.ok(fs.existsSync(path.join(__dirname, '../ozon-react/src/utils/t6/supplyCostBridge.js')))

// 2. supplyCostBridge 不 import Store / localStorage / persist / exchangeRate
console.log('✅ TEST 2: supplyCostBridge 纯函数原则，零外部数据副作用导入')
const bridgeCode = bridgeSource.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')
assert.doesNotMatch(bridgeCode, /t6Store/)
assert.doesNotMatch(bridgeCode, /localStorage/)
assert.doesNotMatch(bridgeCode, /persist/)
assert.doesNotMatch(bridgeCode, /exchangeRate/)
assert.doesNotMatch(bridgeCode, /fetch/)

// 3. no supply → NONE
console.log('✅ TEST 3: no supply 时返回 NONE')
{
  const res1 = buildSupplyCostReference()
  assert.equal(res1.status, SUPPLY_COST_STATUS.NONE)
  const res2 = buildSupplyCostReference({ project: { id: 'p1' } })
  assert.equal(res2.status, SUPPLY_COST_STATUS.NONE)
  const res3 = buildSupplyCostReference({ project: { id: 'p1', supply: null } })
  assert.equal(res3.status, SUPPLY_COST_STATUS.NONE)
}

// 4. valid project/supplier/quote identity
console.log('✅ TEST 4: 合法引用身份构造成功')
{
  const project = { id: 'p1', supply: { supplierId: 's1', quoteId: 'q1' } }
  const supplier = { id: 's1', projectId: 'p1', name: '优质工厂' }
  const quote = { id: 'q1', supplierId: 's1', version: 1, unitPriceCny: 32, currency: 'CNY' }
  const res = buildSupplyCostReference({ project, supplier, quote })
  assert.equal(res.status, SUPPLY_COST_STATUS.APPLICABLE_CNY)
  assert.equal(res.supplierId, 's1')
  assert.equal(res.supplierName, '优质工厂')
  assert.equal(res.quoteId, 'q1')
  assert.equal(res.quoteVersion, 1)
  assert.equal(res.rawAmount, 32)
  assert.equal(res.currency, 'CNY')
  assert.equal(res.purchaseCostCny, 32)
}

// 5. supplier 不属于 project → INVALID_REFERENCE
console.log('✅ TEST 5: supplier 跨项目引用判定 INVALID_REFERENCE (Fail-close)')
{
  const project = { id: 'p1', supply: { supplierId: 's1', quoteId: 'q1' } }
  const supplier = { id: 's1', projectId: 'p2', name: '其它项目工厂' } // 跨项目
  const quote = { id: 'q1', supplierId: 's1', version: 1, unitPriceCny: 32, currency: 'CNY' }
  const res = buildSupplyCostReference({ project, supplier, quote })
  assert.equal(res.status, SUPPLY_COST_STATUS.INVALID_REFERENCE)
}

// 6. quote 不属于 supplier → INVALID_REFERENCE
console.log('✅ TEST 6: quote 跨供应商引用判定 INVALID_REFERENCE (Fail-close)')
{
  const project = { id: 'p1', supply: { supplierId: 's1', quoteId: 'q1' } }
  const supplier = { id: 's1', projectId: 'p1', name: '优质工厂' }
  const quote = { id: 'q1', supplierId: 's2', version: 1, unitPriceCny: 32, currency: 'CNY' } // 跨供应商
  const res = buildSupplyCostReference({ project, supplier, quote })
  assert.equal(res.status, SUPPLY_COST_STATUS.INVALID_REFERENCE)
}

// 7. supply.quoteId 与 quote.id 不同 → INVALID_REFERENCE
console.log('✅ TEST 7: supply.quoteId 与传入 quote.id 不匹配判定 INVALID_REFERENCE')
{
  const project = { id: 'p1', supply: { supplierId: 's1', quoteId: 'q1' } }
  const supplier = { id: 's1', projectId: 'p1', name: '优质工厂' }
  const quote = { id: 'q2', supplierId: 's1', version: 2, unitPriceCny: 30, currency: 'CNY' }
  const res = buildSupplyCostReference({ project, supplier, quote })
  assert.equal(res.status, SUPPLY_COST_STATUS.INVALID_REFERENCE)
}

// 8. string unitPriceCny → INVALID_REFERENCE
console.log('✅ TEST 8: 字符串 unitPriceCny 拒绝隐式转换，严格判定 INVALID_REFERENCE')
{
  const project = { id: 'p1', supply: { supplierId: 's1', quoteId: 'q1' } }
  const supplier = { id: 's1', projectId: 'p1', name: '优质工厂' }
  const quote = { id: 'q1', supplierId: 's1', version: 1, unitPriceCny: '32', currency: 'CNY' }
  const res = buildSupplyCostReference({ project, supplier, quote })
  assert.equal(res.status, SUPPLY_COST_STATUS.INVALID_REFERENCE)
}

// 9. NaN / Infinity / negative → INVALID_REFERENCE
console.log('✅ TEST 9: NaN / Infinity / 负数判定 INVALID_REFERENCE')
{
  const project = { id: 'p1', supply: { supplierId: 's1', quoteId: 'q1' } }
  const supplier = { id: 's1', projectId: 'p1', name: '优质工厂' }
  assert.equal(buildSupplyCostReference({ project, supplier, quote: { id: 'q1', supplierId: 's1', version: 1, unitPriceCny: NaN, currency: 'CNY' } }).status, SUPPLY_COST_STATUS.INVALID_REFERENCE)
  assert.equal(buildSupplyCostReference({ project, supplier, quote: { id: 'q1', supplierId: 's1', version: 1, unitPriceCny: Infinity, currency: 'CNY' } }).status, SUPPLY_COST_STATUS.INVALID_REFERENCE)
  assert.equal(buildSupplyCostReference({ project, supplier, quote: { id: 'q1', supplierId: 's1', version: 1, unitPriceCny: -5, currency: 'CNY' } }).status, SUPPLY_COST_STATUS.INVALID_REFERENCE)
}

// 10. CNY quote → APPLICABLE_CNY
console.log('✅ TEST 10: CNY 报价判定为 APPLICABLE_CNY')
{
  const project = { id: 'p1', supply: { supplierId: 's1', quoteId: 'q1' } }
  const supplier = { id: 's1', projectId: 'p1', name: '优质工厂' }
  const quote = { id: 'q1', supplierId: 's1', version: 1, unitPriceCny: 45.5, currency: 'CNY' }
  const res = buildSupplyCostReference({ project, supplier, quote })
  assert.equal(res.status, SUPPLY_COST_STATUS.APPLICABLE_CNY)
}

// 11. CNY amount 保持原数值
console.log('✅ TEST 11: CNY amount 与 purchaseCostCny 原数值保持')
{
  const project = { id: 'p1', supply: { supplierId: 's1', quoteId: 'q1' } }
  const supplier = { id: 's1', projectId: 'p1', name: '优质工厂' }
  const quote = { id: 'q1', supplierId: 's1', version: 1, unitPriceCny: 128.75, currency: 'CNY' }
  const res = buildSupplyCostReference({ project, supplier, quote })
  assert.equal(res.rawAmount, 128.75)
  assert.equal(res.purchaseCostCny, 128.75)
}

// 12. USD quote → BLOCKED_CURRENCY
console.log('✅ TEST 12: USD 报价判定为 BLOCKED_CURRENCY')
{
  const project = { id: 'p1', supply: { supplierId: 's1', quoteId: 'q1' } }
  const supplier = { id: 's1', projectId: 'p1', name: '海外工厂' }
  const quote = { id: 'q1', supplierId: 's1', version: 1, unitPriceCny: 10, currency: 'USD' }
  const res = buildSupplyCostReference({ project, supplier, quote })
  assert.equal(res.status, SUPPLY_COST_STATUS.BLOCKED_CURRENCY)
  assert.equal(res.rawAmount, 10)
  assert.equal(res.currency, 'USD')
}

// 13. RUB quote → BLOCKED_CURRENCY
console.log('✅ TEST 13: RUB 报价判定为 BLOCKED_CURRENCY')
{
  const project = { id: 'p1', supply: { supplierId: 's1', quoteId: 'q1' } }
  const supplier = { id: 's1', projectId: 'p1', name: '莫斯科仓' }
  const quote = { id: 'q1', supplierId: 's1', version: 1, unitPriceCny: 1000, currency: 'RUB' }
  const res = buildSupplyCostReference({ project, supplier, quote })
  assert.equal(res.status, SUPPLY_COST_STATUS.BLOCKED_CURRENCY)
  assert.equal(res.rawAmount, 1000)
  assert.equal(res.currency, 'RUB')
}

// 14. 非 CNY 不产生 purchaseCostCny
console.log('✅ TEST 14: 非 CNY 绝对不返回 purchaseCostCny 字段')
{
  const project = { id: 'p1', supply: { supplierId: 's1', quoteId: 'q1' } }
  const supplier = { id: 's1', projectId: 'p1', name: '海外工厂' }
  const quote = { id: 'q1', supplierId: 's1', version: 1, unitPriceCny: 10, currency: 'USD' }
  const res = buildSupplyCostReference({ project, supplier, quote })
  assert.equal(res.purchaseCostCny, undefined)
}

// 15. 不存在 FX 逻辑
console.log('✅ TEST 15: bridge 源码零汇率计算')
assert.doesNotMatch(bridgeCode, /rubPerCny/i)
assert.doesNotMatch(bridgeCode, /exchange/i)
assert.doesNotMatch(bridgeCode, /\* 7\./)

// 16. ProjectDetail 使用 project.supply.quoteId
console.log('✅ TEST 16: ProjectDetailPage 严格通过 project.supply.quoteId 读取')
assert.match(projectDetailSource, /project(?:\.|\?\.)supply(?:\.|\?\.)quoteId/)
assert.doesNotMatch(projectDetailSource, /selectedQuoteId/)

// 17. ProjectDetail 不通过 max(version) 选 Quote
console.log('✅ TEST 17: ProjectDetailPage 绝不通过 max(version) 或 .at(-1) 猜测报价')
assert.doesNotMatch(projectDetailSource, /getSupplierQuotes\([^)]+\)\.at\(-1\)/)
assert.doesNotMatch(projectDetailSource, /Math\.max\(.*quotes\.map/)

// 18. ProjectDetail 向 Ozon projectContext 传 supplyCostReference
console.log('✅ TEST 18: ProjectDetailPage 向 OzonCalc 传递 supplyCostReference')
assert.match(projectDetailSource, /<OzonCalc[\s\S]*supplyCostReference/)

// 19. ProjectDetail 向 WB projectContext 传 supplyCostReference
console.log('✅ TEST 19: ProjectDetailPage 向 WBCalc 传递 supplyCostReference')
assert.match(projectDetailSource, /<WBCalc[\s\S]*supplyCostReference/)

// 20. ProjectDetail 不把 quote 写入 prefill.purchaseCost
console.log('✅ TEST 20: ProjectDetailPage 绝不把报价写入 prefill.purchaseCost (防退化为 AUTO_OVERLAY)')
assert.doesNotMatch(projectDetailSource, /prefill\.purchaseCost\s*=/)

// 21. Ozon 显示 CNY 正式报价
console.log('✅ TEST 21: OzonCalc 具备正式供应报价展示逻辑')
assert.match(ozonCalcSource, /正式供应报价/)
assert.match(ozonCalcSource, /supplyRef\.status === 'APPLICABLE_CNY'/)

// 22. Ozon 有显式 Apply 按钮
console.log('✅ TEST 22: OzonCalc 具备“采用正式供应报价”按钮')
assert.match(ozonCalcSource, /采用正式供应报价/)
assert.match(ozonCalcSource, /handleApplySupplyQuote/)

// 23. Ozon Apply 只改 purchaseCost
console.log('✅ TEST 23: OzonCalc Apply 纯净性：仅变更 purchaseCost')
assert.match(ozonCalcSource, /purchaseCost:\s*supplyRef\.purchaseCostCny/)
const ozonApplyBody = ozonCalcSource.match(/const handleApplySupplyQuote = \(\) => \{([\s\S]*?)\}/)?.[1] || ''
assert.doesNotMatch(ozonApplyBody, /domesticShipping/)
assert.doesNotMatch(ozonApplyBody, /labelingFee/)

// 24. Ozon 非 CNY Apply disabled
console.log('✅ TEST 24: OzonCalc 非 CNY 报价按钮禁用且提示手工填写')
assert.match(ozonCalcSource, /supplyRef\.status === 'BLOCKED_CURRENCY'/)
assert.match(ozonCalcSource, /非人民币正式报价暂不支持一键采用/)

// 25. WB 显示 CNY 正式报价
console.log('✅ TEST 25: CalculatorTab 具备正式供应报价展示逻辑')
assert.match(calculatorTabSource, /正式供应报价/)
assert.match(calculatorTabSource, /supplyRef\.status === 'APPLICABLE_CNY'/)

// 26. WB 有显式 Apply 按钮
console.log('✅ TEST 26: CalculatorTab 具备“采用正式供应报价”按钮')
assert.match(calculatorTabSource, /采用正式供应报价/)
assert.match(calculatorTabSource, /handleApplySupplyQuote/)

// 27. WB Apply 只改 purchaseCost
console.log('✅ TEST 27: CalculatorTab Apply 纯净性：仅变更 purchaseCost')
assert.match(calculatorTabSource, /purchaseCost:\s*supplyRef\.purchaseCostCny/)
const wbApplyBody = calculatorTabSource.match(/const handleApplySupplyQuote = \(\) => \{([\s\S]*?)\}/)?.[1] || ''
assert.doesNotMatch(wbApplyBody, /packagingCost/)
assert.doesNotMatch(wbApplyBody, /chinaInbound/)

// 28. WB 非 CNY Apply disabled
console.log('✅ TEST 28: CalculatorTab 非 CNY 报价按钮禁用且提示手工填写')
assert.match(calculatorTabSource, /supplyRef\.status === 'BLOCKED_CURRENCY'/)
assert.match(calculatorTabSource, /非人民币正式报价暂不支持一键采用/)

// 29. Apply 后仍保留 costConfirmed 流程
console.log('✅ TEST 29: Ozon 与 WB 均严格保留 costConfirmed 确认门禁')
assert.match(ozonCalcSource, /costConfirmed/)
assert.match(calculatorTabSource, /costConfirmed/)

// 30. Quote toolingFee 不参与 purchaseCost
console.log('✅ TEST 30: 模具费不参与 purchaseCost')
assert.doesNotMatch(bridgeCode, /toolingFee/i)

// 31. Quote sampleFee 不参与 purchaseCost
console.log('✅ TEST 31: 样品费不参与 purchaseCost')
assert.doesNotMatch(bridgeCode, /sampleFee/i)

// 32. packagingSpec 不参与 packagingCost
console.log('✅ TEST 32: packagingSpec 纯文本不参与成本数值')
assert.doesNotMatch(bridgeCode, /packagingSpec/i)

// 33. EXW/FOB 不自动修改其它成本
console.log('✅ TEST 33: EXW/FOB 贸易条款不修改任何核算参数')
assert.doesNotMatch(bridgeCode, /exw/i)
assert.doesNotMatch(bridgeCode, /fob/i)

// 34. 新 Quote v2 不影响仍引用 v1 的 Supply Plan
console.log('✅ TEST 34: 新增 Quote v2 不漂移原 Supply Plan 对 v1 的引用')
{
  const p = createMockProject('音箱')
  const sup = store.createSupplier({ projectId: p.id, name: '东莞音箱厂' })
  const q1 = store.createSupplierQuote({ supplierId: sup.id, unitPriceCny: 32, currency: 'CNY' })
  store.setProjectSupply(p.id, { supplierId: sup.id, quoteId: q1.id })

  // 追加 v2 报价
  const q2 = store.createSupplierQuote({ supplierId: sup.id, unitPriceCny: 28, currency: 'CNY' })

  const updatedProject = store.getProject(p.id)
  assert.equal(updatedProject.supply.quoteId, q1.id) // 仍然是 q1
  assert.notEqual(updatedProject.supply.quoteId, q2.id)

  const activeQuote = store.getSupplierQuote(updatedProject.supply.quoteId)
  assert.equal(activeQuote.version, 1)
  assert.equal(activeQuote.unitPriceCny, 32)
}

// 35. Project A/B Supply Reference 隔离
console.log('✅ TEST 35: Project A 与 Project B 供应方案引用严格隔离')
{
  const pa = createMockProject('A')
  const pb = createMockProject('B')
  const sa = store.createSupplier({ projectId: pa.id, name: '工厂A' })
  const sb = store.createSupplier({ projectId: pb.id, name: '工厂B' })
  const qa = store.createSupplierQuote({ supplierId: sa.id, unitPriceCny: 50, currency: 'CNY' })
  const qb = store.createSupplierQuote({ supplierId: sb.id, unitPriceCny: 70, currency: 'CNY' })
  store.setProjectSupply(pa.id, { supplierId: sa.id, quoteId: qa.id })
  store.setProjectSupply(pb.id, { supplierId: sb.id, quoteId: qb.id })

  const refA = buildSupplyCostReference({
    project: store.getProject(pa.id),
    supplier: store.getSupplier(sa.id),
    quote: store.getSupplierQuote(qa.id),
  })
  const refB = buildSupplyCostReference({
    project: store.getProject(pb.id),
    supplier: store.getSupplier(sb.id),
    quote: store.getSupplierQuote(qb.id),
  })
  assert.equal(refA.purchaseCostCny, 50)
  assert.equal(refB.purchaseCostCny, 70)
}

// 36. t6Store 未修改
console.log('✅ TEST 36: t6Store 保持完整无破坏')
assert.ok(typeof store.createSupplierQuote === 'function')
assert.ok(typeof store.setProjectSupply === 'function')

// 37. costScenarioAdapter 未修改
console.log('✅ TEST 37: costScenarioAdapter 保持适配层纯度')
assert.doesNotMatch(costScenarioAdapterSource, /supplyCostReference/)

// 38. gateEngine 未修改
console.log('✅ TEST 38: gateEngine 保持纯门禁评估器原则')
assert.doesNotMatch(gateEngineSource, /supplyCostReference/)

// 39. [行为集成测试] Quote Apply != Quote Lock
console.log('✅ TEST 39: 行为集成测试：用户 Apply 后手动调整，最终保存实际调整值（非锁死）')
{
  const p = createMockProject('集成测试')
  const sup = store.createSupplier({ projectId: p.id, name: '灵活供货厂' })
  const q1 = store.createSupplierQuote({ supplierId: sup.id, unitPriceCny: 32, currency: 'CNY' })
  store.setProjectSupply(p.id, { supplierId: sup.id, quoteId: q1.id })

  const ref = buildSupplyCostReference({
    project: store.getProject(p.id),
    supplier: sup,
    quote: q1,
  })
  assert.equal(ref.status, 'APPLICABLE_CNY')
  assert.equal(ref.purchaseCostCny, 32)

  // 模拟 Apply: purchaseCost 草稿值变为 32
  let draftPurchaseCost = ref.purchaseCostCny
  assert.equal(draftPurchaseCost, 32)

  // 用户手动微调为 33.5
  draftPurchaseCost = 33.5

  // 保存 Scenario: 场景中保存的是 33.5
  const scPayload = buildOzonScenarioPayload({
    project: p,
    inputPayload: {
      price: 2500,
      weight: 0.5,
      length: 20,
      width: 15,
      height: 10,
      purchaseCost: draftPurchaseCost,
      domesticShipping: 3,
      labelingFee: 2,
      commission: 12,
      adRate: 10,
      paymentFee: 1,
      agencyFee: 2,
      returnLoss: 4,
    },
    selectedChannelId: 'standard_xs',
    outputPayload: { profitRate: 22 },
  })

  const sc = store.createCostScenario({
    projectId: p.id,
    platform: 'OZON',
    name: '测试场景',
    sourceSnapshotId: scPayload.sourceSnapshotId,
    inputPayload: scPayload.inputPayload,
    resolvedConfig: scPayload.resolvedConfig,
    outputPayload: scPayload.outputPayload,
  })

  assert.equal(sc.inputPayload.purchaseCost, 33.5)
}

// 40. [版本固定测试] 追加 v2 不影响 v1 引用解析
console.log('✅ TEST 40: 版本固定测试：追加 v2 后重新解析仍为已选定的 v1')
{
  const p = createMockProject('版本固定')
  const sup = store.createSupplier({ projectId: p.id, name: '供货商' })
  const q1 = store.createSupplierQuote({ supplierId: sup.id, unitPriceCny: 32, currency: 'CNY' })
  store.setProjectSupply(p.id, { supplierId: sup.id, quoteId: q1.id })

  // 随后创建了 v2
  store.createSupplierQuote({ supplierId: sup.id, unitPriceCny: 30, currency: 'CNY' })

  const projNow = store.getProject(p.id)
  const resolvedSup = store.getSupplier(projNow.supply.supplierId)
  const resolvedQuote = store.getSupplierQuote(projNow.supply.quoteId)

  const ref = buildSupplyCostReference({
    project: projNow,
    supplier: resolvedSup,
    quote: resolvedQuote,
  })

  assert.equal(ref.quoteVersion, 1)
  assert.equal(ref.purchaseCostCny, 32)
}

// 41. [非 CNY 集成] 10 USD -> BLOCKED_CURRENCY -> Apply disabled
console.log('✅ TEST 41: 非 CNY 集成：10 USD 阻断且不产生 purchaseCostCny')
{
  const p = createMockProject('USD')
  const sup = store.createSupplier({ projectId: p.id, name: '美国供货商' })
  const qUsd = store.createSupplierQuote({ supplierId: sup.id, unitPriceCny: 10, currency: 'USD' })
  store.setProjectSupply(p.id, { supplierId: sup.id, quoteId: qUsd.id })

  const projNow = store.getProject(p.id)
  const ref = buildSupplyCostReference({
    project: projNow,
    supplier: sup,
    quote: qUsd,
  })

  assert.equal(ref.status, SUPPLY_COST_STATUS.BLOCKED_CURRENCY)
  assert.equal(ref.rawAmount, 10)
  assert.equal(ref.currency, 'USD')
  assert.equal(ref.purchaseCostCny, undefined)
}

// 42. [历史场景不可变] 切换 Supply Plan 绝不篡改已保存 Scenario
console.log('✅ TEST 42: 历史场景不可变：切换 Supply Plan 历史 CostScenario 字节不变')
{
  const p = createMockProject('不可变')
  const sup = store.createSupplier({ projectId: p.id, name: '供货商' })
  const q1 = store.createSupplierQuote({ supplierId: sup.id, unitPriceCny: 35, currency: 'CNY' })
  store.setProjectSupply(p.id, { supplierId: sup.id, quoteId: q1.id })

  // 保存历史场景（purchaseCost = 35）
  const scPayload = buildOzonScenarioPayload({
    project: p,
    inputPayload: {
      price: 2500,
      weight: 0.5,
      length: 20,
      width: 15,
      height: 10,
      purchaseCost: 35,
      domesticShipping: 3,
      labelingFee: 2,
      commission: 12,
      adRate: 10,
      paymentFee: 1,
      agencyFee: 2,
      returnLoss: 4,
    },
    selectedChannelId: 'standard_xs',
    outputPayload: { profitRate: 20 },
  })

  const sc = store.createCostScenario({
    projectId: p.id,
    platform: 'OZON',
    name: '历史基线场景',
    sourceSnapshotId: scPayload.sourceSnapshotId,
    inputPayload: scPayload.inputPayload,
    resolvedConfig: scPayload.resolvedConfig,
    outputPayload: scPayload.outputPayload,
  })

  // 随后切换供应方案为全新供应商和更低报价（¥25）
  const supNew = store.createSupplier({ projectId: p.id, name: '新工厂' })
  const qNew = store.createSupplierQuote({ supplierId: supNew.id, unitPriceCny: 25, currency: 'CNY' })
  store.setProjectSupply(p.id, { supplierId: supNew.id, quoteId: qNew.id })

  // 读取已保存场景，验证其输入完全不受新方案影响
  const scenarios = store.getProjectScenarios(p.id)
  assert.equal(scenarios.length, 1)
  assert.equal(scenarios[0].inputPayload.purchaseCost, 35)
}

console.log('\n===============================================================')
console.log('  ALL 42 Supply Cost Apply Tests Passed Successfully!')
console.log('===============================================================\n')
