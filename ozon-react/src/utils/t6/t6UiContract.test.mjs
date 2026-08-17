/**
 * t6/t6UiContract.test.mjs — T6 UI 契约 + 项目联动 smoke（T6-2B hotfix）
 * 运行: node --experimental-vm-modules src/utils/t6/t6UiContract.test.mjs
 * 背景：vite build + 单测全绿仍漏过 ProjectDetailPage 缺 WB imports 的运行时 ReferenceError。
 * 本测试永久锁住"项目详情 → 成本与物流 → Ozon/WB 项目模式"的可达性契约：
 *  UI-1 ProjectDetailPage 必须导入 buildWbPrefill/buildWbScenarioPayload/WBCalc 并真正接线（源码契约）
 *  UI-2 WB 项目模式保存流（数据级复刻 saveWbScenario 处理器）：prefill→payload→store→项目场景
 *  UI-3 Ozon 项目模式保存流（数据级复刻 saveOzonScenario 处理器）
 *  UI-4 mergeTrustedPrefill：''/null/undefined 不得覆盖既有成本假设（防"成本=0 虚假高利润基线"）
 *  UI-5 保存前人工确认 Gate：OzonCalc/CalculatorTab 含 costConfirmed 且未确认禁用保存（源码契约）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as store from './t6Store.js'
import {
  buildOzonPrefill, buildOzonScenarioPayload, buildWbPrefill, buildWbScenarioPayload, mergeTrustedPrefill,
} from './costScenarioAdapter.js'
import { calculateOrderLogistics, calculateOperatingProfit, calculateTotalLogisticsCost, toNum } from '../wbEngine.js'
import { DEFAULT_SETTINGS, DEFAULT_TARIFFS } from '../wbConfig.js'
import { ALL_CHANNELS, calcChannelProfit } from '../ozonEngine.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..', '..', '..', '..')

let pass = 0, fail = 0
const assert = (cond, msg) => { if (cond) { pass++; console.log(`  ✅ ${msg}`) } else { fail++; console.log(`  ❌ ${msg}`) } }

console.log('\n===== T6 UI 契约 + 项目联动 smoke 测试 =====\n')

const mem = new Map()
store._setAdapterForTests({
  get: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null),
  set: (k, v) => mem.set(k, JSON.stringify(v)),
  keys: () => [...mem.keys()],
})

console.log('UI-1: ProjectDetailPage WB 联动源码契约（P0 回归锁）')
{
  const src = fs.readFileSync(path.join(ROOT, 'ozon-react', 'src', 'components', 't6', 'ProjectDetailPage.jsx'), 'utf-8')
  assert(src.includes('buildWbPrefill') && src.includes('buildWbScenarioPayload'), '导入 buildWbPrefill / buildWbScenarioPayload')
  assert(src.includes("import WBCalc from '../WBCalc'"), '导入 WBCalc')
  assert(src.includes("setWbContext({ prefill: buildWbPrefill({ snapshot }) })"), '「使用 WB 核算」调用 buildWbPrefill')
  assert(src.includes('buildWbScenarioPayload({ project, inputPayload: data.inputPayload'), 'saveWbScenario 调用 buildWbScenarioPayload')
  assert(src.includes('platform: \'WB\'') && src.includes('createCostScenario('), 'saveWbScenario 走 createCostScenario')
  assert(src.includes('<WBCalc') && src.includes('projectContext={{') && src.includes('onSaveScenario: saveWbScenario'), '渲染 <WBCalc> 且接线 onSaveScenario')
}

// ---- 项目 fixtures ----
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
  source_product_id: 'P-UI-001', name: '家用手套-黑色10mil', category_leaf: '家用手套', category_full: '住宅和花园>家居用品>家用手套',
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

const TARIFF = DEFAULT_TARIFFS.find((t) => t.routeId === 'DPX-SZ-382822') || DEFAULT_TARIFFS[0]
const WB_INPUT = {
  productName: '家用手套-黑色10mil', actualWeightG: 1550, lengthCm: 52, widthCm: 45, heightCm: 28,
  quantity: 1, parcelCount: 1, routeId: TARIFF.routeId, sellerRevenueRub: 5000, commissionRate: 25,
  promotionCostRub: 0, purchaseCost: 35, packagingCost: 3, chinaInbound: 2, status: '已签收',
  reverseEventType: 'none', reverseCompensationMultiplier: '', actualForwardLogisticsCny: '',
  actualReverseCompensationCny: '', otherReverseCostCny: 0, forwardFeeApplied: true, inventoryRecoveryRate: 0,
}
function computeWbOutputs(input = WB_INPUT) {
  const perParcelWeight = input.actualWeightG * input.quantity / input.parcelCount
  const parcels = Array.from({ length: input.parcelCount }, () => ({
    actualWeightG: perParcelWeight, lengthCm: input.lengthCm, widthCm: input.widthCm, heightCm: input.heightCm,
  }))
  const logisticsCalc = calculateOrderLogistics(parcels, TARIFF)
  const logisticsCny = logisticsCalc ? logisticsCalc.totalFeeCny : 0
  const orderData = {
    sellerRevenueBaseRub: input.sellerRevenueRub, commissionBaseRub: input.sellerRevenueRub,
    commissionRate: input.commissionRate, acquiringFeeRub: 0, promotionCostRub: input.promotionCostRub,
    platformOtherDeductionRub: 0, otherOperatingCostCny: 0, taxCostCny: 0,
  }
  const skuData = {
    purchaseCostCny: input.purchaseCost * input.quantity, packagingCostCny: input.packagingCost * input.quantity,
    chinaInboundCostCny: input.chinaInbound * input.quantity, certificationAllocationCny: 0,
  }
  const profitCalc = calculateOperatingProfit(orderData, skuData, DEFAULT_SETTINGS, logisticsCny)
  const reverseOrderData = { ...orderData, reverseEventType: input.reverseEventType, reverseCompensationMultiplier: input.reverseCompensationMultiplier, estimatedForwardLogisticsCny: logisticsCny, actualForwardLogisticsCny: input.actualForwardLogisticsCny, actualReverseCompensationCny: input.actualReverseCompensationCny, otherReverseCostCny: input.otherReverseCostCny, forwardFeeApplied: input.forwardFeeApplied, inventoryRecoveryRate: input.inventoryRecoveryRate, parcels: Array.from({ length: input.parcelCount }, () => ({ actualWeightG: perParcelWeight })) }
  const reverseCalcResult = calculateTotalLogisticsCost(reverseOrderData, TARIFF)
  const rubPerCny = toNum(DEFAULT_SETTINGS.rubPerCny)
  const commissionPct = input.commissionRate / 100
  const fixedCost = input.purchaseCost * input.quantity + input.packagingCost * input.quantity + input.chinaInbound * input.quantity + logisticsCny
  const breakEvenPriceRub = commissionPct < 1 && rubPerCny > 0 ? (fixedCost * rubPerCny) / (1 - commissionPct) : null
  return { logisticsCalc, profitCalc, reverseCalcResult, breakEvenPriceRub }
}

console.log('UI-2: WB 项目模式保存流（数据级复刻 saveWbScenario）→ 场景进入项目')
{
  const { project, snap } = makeProject()
  // 点击「使用 WB 核算」：buildWbPrefill
  const prefill = buildWbPrefill({ snapshot: snap })
  assert(prefill.productName === '家用手套-黑色10mil' && prefill.actualWeightG === 1550 && prefill.sellerRevenueRub === 5000, 'WB 预填 5 项就绪')
  // 面板用户填写真实假设后保存：buildWbScenarioPayload → createCostScenario
  const outputs = computeWbOutputs()
  const payload = buildWbScenarioPayload({ project, inputPayload: WB_INPUT, tariff: TARIFF, settings: DEFAULT_SETTINGS, outputs })
  const sc = store.createCostScenario({
    projectId: project.id, platform: 'WB', name: `${project.projectCode} WB 订单场景`,
    sourceSnapshotId: snap.id, ...payload,
  })
  const after = store.getProject(project.id)
  assert(after.costing.scenarios.includes(sc.id), '保存后场景进入 project.costing.scenarios')
  assert(after.costing.baselineScenarioId === sc.id, '首个场景自动成为基线')
  assert(store.getCostScenario(sc.id).outputPayload.profitCalc !== undefined, '场景冻结 wbEngine 输出')
}

console.log('UI-3: Ozon 项目模式保存流（数据级复刻 saveOzonScenario）→ 场景进入项目')
{
  const { project, snap } = makeProject()
  const prefill = buildOzonPrefill({ snapshot: snap })
  assert(prefill.price === 5000 && prefill.commission === 12, 'Ozon 预填（实际售价/rFBS 佣金）')
  const params = { purchaseCost: 35, domesticShipping: 3, labelingFee: 2, adRate: 10, paymentFee: 1, agencyFee: 2, returnLoss: 4, ...prefill }
  const engineCh = ALL_CHANNELS.find((c) => c.id === 'standard_small')
  const out = calcChannelProfit(engineCh, Number(params.price), Number(params.weight), Number(params.length), Number(params.width), Number(params.height), params)
  const payload = buildOzonScenarioPayload({ project, inputPayload: params, selectedChannelId: 'standard_small', outputPayload: out })
  const sc = store.createCostScenario({
    projectId: project.id, platform: 'OZON', name: `${project.projectCode} Ozon rFBS 场景`,
    sourceSnapshotId: snap.id, ...payload,
  })
  assert(store.getProject(project.id).costing.scenarios.includes(sc.id), '保存后场景进入项目')
}

console.log("UI-4: mergeTrustedPrefill——''/null/undefined 不覆盖既有成本假设（防虚假高利润基线）")
{
  const base = {
    price: 5200, weight: 1.55, length: 52, width: 45, height: 28,
    purchaseCost: 35, domesticShipping: 3, labelingFee: 2, commission: 12,
    adRate: 10, paymentFee: 1, agencyFee: 2, returnLoss: 4,
  }
  // 候选缺成本数据 → prefill 成本字段为 ''
  const prefill = { price: 5000, weight: 1.55, commission: 12, purchaseCost: '', domesticShipping: '', labelingFee: '', adRate: '', paymentFee: '', agencyFee: '', returnLoss: '', someNull: null, someUndef: undefined }
  const merged = mergeTrustedPrefill(base, prefill)
  assert(merged.price === 5000 && merged.commission === 12, '有值预填覆盖（价格/佣金）')
  assert(merged.purchaseCost === 35 && merged.domesticShipping === 3 && merged.labelingFee === 2, "采购/国内运费/贴标不被 '' 清成 0")
  assert(merged.adRate === 10 && merged.paymentFee === 1 && merged.agencyFee === 2 && merged.returnLoss === 4, "费率假设不被 '' 清成 0")
  assert(merged.someNull === undefined && merged.someUndef === undefined, 'null/undefined 不进入结果')
  assert(JSON.stringify(mergeTrustedPrefill(base, null)) === JSON.stringify(base) && JSON.stringify(mergeTrustedPrefill(base, undefined)) === JSON.stringify(base), '无 prefill 时返回与 base 等值')
}

console.log('UI-5: 保存前人工确认 Gate 源码契约（Ozon/WB 未确认禁用保存）')
{
  const oz = fs.readFileSync(path.join(ROOT, 'ozon-react', 'src', 'components', 'OzonCalc.jsx'), 'utf-8')
  assert(oz.includes('const [costConfirmed, setCostConfirmed] = useState(false)'), 'OzonCalc 含 costConfirmed 状态')
  assert(oz.includes('disabled={!bestChannel || !costConfirmed}'), 'Ozon 保存按钮未确认即禁用')
  const wb = fs.readFileSync(path.join(ROOT, 'ozon-react', 'src', 'components', 'wbcalc', 'tabs', 'CalculatorTab.jsx'), 'utf-8')
  assert(wb.includes('const [costConfirmed, setCostConfirmed] = useState(false)'), 'CalculatorTab 含 costConfirmed 状态')
  assert(wb.includes('disabled={!tariff || !form.productName || !costConfirmed}'), 'WB 保存按钮未确认即禁用')
  // 两个面板共用 trusted 预填合并
  assert(oz.includes('mergeTrustedPrefill(base, projectContext.prefill)'), 'OzonCalc 用 mergeTrustedPrefill')
  assert(wb.includes('mergeTrustedPrefill(defaults, projectContext.prefill)'), 'CalculatorTab 用 mergeTrustedPrefill')
}

console.log(`\n===== T6 UI 契约测试结果: ${pass} 通过 / ${fail} 失败 =====\n`)
if (fail > 0) process.exit(1)
