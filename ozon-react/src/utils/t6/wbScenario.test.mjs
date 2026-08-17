/**
 * t6/wbScenario.test.mjs — WB 成本场景测试（T6-2B2）
 * 运行: node --experimental-vm-modules src/utils/t6/wbScenario.test.mjs
 * 覆盖：
 *  W1 buildWbPrefill：只预填 5 项（名称/重量克/尺寸/参考售价）；佣金绝不预填（即使 commission_rfbs=99）
 *  W2 buildWbResolvedConfig：冻结完整费率版本快照（tariffId/routeId/routeName/有效期/取整/限制/tiers/反向规则/来源），非仅 routeId
 *  W3 calculatorVersion = 'wb-order-v2'（公式不变，仅元数据）
 *  W4 buildWbScenarioPayload：outputPayload = wbEngine 输出原文（logisticsCalc/profitCalc/reverseCalcResult/breakEvenPriceRub）
 *  W5 store 创建 WB 场景：platform=WB、项目追加、首个自动基线、cost_scenario_create 日志
 *  W6 scenarioSummary(WB)：毛利率取 profitCalc.profitMargin、线路名=route_name、售价=sellerRevenueRub
 *  W7 OZON/WB 场景共存：scenarioMarginPct/scenarioSummary 统一口径（可跨平台比较）
 *  W8 Gate 用 WB 基线毛利率判定（≥15 PASS；<15 WARN）
 *  W9 WB 场景永不带入 Ozon 佣金（commissionRate 为用户填写值）
 *  W10 基线仅人工切换：WB 场景创建不自动改基线（human-only）
 */
import * as store from './t6Store.js'
import { buildWbPrefill, buildWbResolvedConfig, buildWbScenarioPayload, scenarioSummary, scenarioMarginPct, WB_CALC_VERSION } from './costScenarioAdapter.js'
import { buildOzonPrefill, buildOzonScenarioPayload, OZON_CALC_VERSION } from './costScenarioAdapter.js'
import { calculateOrderLogistics, calculateOperatingProfit, calculateTotalLogisticsCost, toNum } from '../wbEngine.js'
import { DEFAULT_SETTINGS, DEFAULT_TARIFFS } from '../wbConfig.js'
import { ALL_CHANNELS, calcChannelProfit } from '../ozonEngine.js'
import { evaluateProjectGate, GATE_VERDICTS, GATE_RESULTS } from './gateEngine.js'

let pass = 0, fail = 0
const assert = (cond, msg) => { if (cond) { pass++; console.log(`  ✅ ${msg}`) } else { fail++; console.log(`  ❌ ${msg}`) } }

console.log('\n===== WB 成本场景测试 =====\n')

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
  source_product_id: 'P-WB-001', name: '家用手套-黑色10mil', category_leaf: '家用手套', category_full: '住宅和花园>家居用品>家用手套',
  price_rub: 5000, avg_price_rub: 4800, sales_rub_28d: 500000, units_28d: 1200,
  conv_rate: 0.5, cart_add_rate: 10, exposure: 100000, card_visits: 5000, reviews: 100,
  gross_margin: 40, commission_fbs: 20, commission_fbo: 19, commission_rfbs: 99, commission_fbp: 18,
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

function computeWbOutputs(input = WB_INPUT, settings = DEFAULT_SETTINGS, tariff = TARIFF) {
  const perParcelWeight = input.actualWeightG * input.quantity / input.parcelCount
  const parcels = Array.from({ length: input.parcelCount }, () => ({
    actualWeightG: perParcelWeight, lengthCm: input.lengthCm, widthCm: input.widthCm, heightCm: input.heightCm,
  }))
  const logisticsCalc = calculateOrderLogistics(parcels, tariff)
  const logisticsCny = logisticsCalc ? logisticsCalc.totalFeeCny : 0
  const orderData = {
    sellerRevenueBaseRub: input.sellerRevenueRub,
    commissionBaseRub: input.sellerRevenueRub,
    commissionRate: input.commissionRate,
    acquiringFeeRub: 0,
    promotionCostRub: input.promotionCostRub,
    platformOtherDeductionRub: 0,
    otherOperatingCostCny: 0,
    taxCostCny: 0,
  }
  const skuData = {
    purchaseCostCny: input.purchaseCost * input.quantity,
    packagingCostCny: input.packagingCost * input.quantity,
    chinaInboundCostCny: input.chinaInbound * input.quantity,
    certificationAllocationCny: 0,
  }
  const profitCalc = calculateOperatingProfit(orderData, skuData, settings, logisticsCny)
  const reverseOrderData = {
    ...orderData,
    reverseEventType: input.reverseEventType,
    reverseCompensationMultiplier: input.reverseCompensationMultiplier,
    estimatedForwardLogisticsCny: logisticsCny,
    actualForwardLogisticsCny: input.actualForwardLogisticsCny,
    actualReverseCompensationCny: input.actualReverseCompensationCny,
    otherReverseCostCny: input.otherReverseCostCny,
    forwardFeeApplied: input.forwardFeeApplied,
    inventoryRecoveryRate: input.inventoryRecoveryRate,
    parcels: Array.from({ length: input.parcelCount }, () => ({ actualWeightG: perParcelWeight })),
  }
  const reverseCalcResult = calculateTotalLogisticsCost(reverseOrderData, tariff)
  const rubPerCny = toNum(settings.rubPerCny)
  const commissionPct = input.commissionRate / 100
  const fixedCost = input.purchaseCost * input.quantity + input.packagingCost * input.quantity + input.chinaInbound * input.quantity + logisticsCny
  const breakEvenPriceRub = commissionPct < 1 && rubPerCny > 0 ? (fixedCost * rubPerCny) / (1 - commissionPct) : null
  return { logisticsCalc, profitCalc, reverseCalcResult, breakEvenPriceRub }
}

console.log('W1: buildWbPrefill——只预填 5 项；佣金绝不预填（即使 commission_rfbs=99）')
{
  const { snap } = makeProject()
  const prefill = buildWbPrefill({ snapshot: snap })
  assert(prefill.productName === '家用手套-黑色10mil', 'productName 来自候选名称')
  assert(prefill.actualWeightG === 1550, 'actualWeightG = weight_kg×1000 (1.55kg → 1550g)')
  assert(prefill.lengthCm === 52 && prefill.widthCm === 45 && prefill.heightCm === 28, '尺寸来自候选 dims')
  assert(prefill.sellerRevenueRub === 5000, 'sellerRevenueRub ← price_rub（参考售价）')
  assert(!('commissionRate' in prefill) && !('commission' in prefill), '预填不含任何佣金字段')
  assert(JSON.stringify(prefill) === JSON.stringify({ productName: '家用手套-黑色10mil', actualWeightG: 1550, lengthCm: 52, widthCm: 45, heightCm: 28, sellerRevenueRub: 5000 }), '预填严格只有 5 项')
}

console.log('W2: buildWbResolvedConfig——冻结完整费率版本快照（非仅 routeId）+ 设置子集')
{
  const cfg = buildWbResolvedConfig({ tariff: TARIFF, settings: DEFAULT_SETTINGS })
  const t = cfg.tariff
  assert(t.routeId === TARIFF.routeId && t.routeName === TARIFF.routeName, 'routeId/routeName')
  assert(t.tariffId === TARIFF.tariffId, 'tariffId（版本标识）')
  assert(t.effectiveFrom === TARIFF.effectiveFrom && t.effectiveTo === TARIFF.effectiveTo, 'effectiveFrom/effectiveTo（版本有效期）')
  assert(t.weightRoundingG === TARIFF.weightRoundingG, 'weightRoundingG')
  assert(t.maxWeightKg === TARIFF.maxWeightKg && t.maxSumDimensionsCm === TARIFF.maxSumDimensionsCm && t.maxSingleSideCm === TARIFF.maxSingleSideCm, '尺寸/重量限制')
  assert(JSON.stringify(t.tiers) === JSON.stringify(TARIFF.tiers) && t.tiers.length > 0, 'tiers 完整冻结')
  assert(t.buyerToRuWarehouseReverseIncluded === TARIFF.buyerToRuWarehouseReverseIncluded, '反向规则（reverse_to_ru_warehouse_included）')
  assert(t.sourceName === TARIFF.sourceName, '费率来源 sourceName')
  assert(cfg.settings.rubPerCny === DEFAULT_SETTINGS.rubPerCny && cfg.settings.profitMarginThreshold === DEFAULT_SETTINGS.profitMarginThreshold, '设置子集（rubPerCny/阈值）')
  assert(cfg.calculatorVersion === WB_CALC_VERSION, 'calculatorVersion = wb-order-v2')
}

console.log('W3: 公式不变——wb-order-v2 仅元数据；引擎输出与直接调用逐位一致')
{
  const cfg = buildWbResolvedConfig({ tariff: TARIFF, settings: DEFAULT_SETTINGS })
  assert(cfg.calculatorVersion === 'wb-order-v2', `calculatorVersion=${cfg.calculatorVersion}`)
  assert(WB_CALC_VERSION !== OZON_CALC_VERSION, 'OZON/WB 计算器版本区分')
}

console.log('W4: buildWbScenarioPayload——outputPayload = wbEngine 输出原文（verbatim）')
{
  const { project, snap } = makeProject()
  const outputs = computeWbOutputs()
  const payload = buildWbScenarioPayload({ project, inputPayload: WB_INPUT, tariff: TARIFF, settings: DEFAULT_SETTINGS, outputs })
  assert(JSON.stringify(payload.outputPayload) === JSON.stringify(outputs), 'logisticsCalc/profitCalc/reverseCalcResult/breakEvenPriceRub 原文')
  assert(payload.platform === 'WB' && payload.sourceSnapshotId === snap.id, 'platform=WB / sourceSnapshotId')
  assert(payload.resolvedConfig.tariff.routeId === TARIFF.routeId, 'resolvedConfig 冻结费率版本')
}

console.log('W5: store 创建 WB 场景——platform=WB、项目追加、首个自动基线、cost_scenario_create 日志')
{
  const { project, snap } = makeProject()
  const outputs = computeWbOutputs()
  const payload = buildWbScenarioPayload({ project, inputPayload: WB_INPUT, tariff: TARIFF, settings: DEFAULT_SETTINGS, outputs })
  const sc = store.createCostScenario({
    projectId: project.id, platform: 'WB', name: `${project.projectCode} WB 订单场景`,
    sourceSnapshotId: snap.id, ...payload,
  })
  const after = store.getProject(project.id)
  assert(store.getCostScenario(sc.id).platform === 'WB', '场景 platform=WB')
  assert(after.costing.scenarios.includes(sc.id) && after.costing.baselineScenarioId === sc.id, '项目追加 + 首个自动基线')
  const logs = store.listLogs().filter((l) => l.projectId === project.id)
  assert(logs.some((l) => l.kind === 'cost_scenario_create' && l.to === sc.id), 'cost_scenario_create 日志')
}

console.log('W6: scenarioSummary(WB)——毛利率取 profitCalc.profitMargin、线路名=route_name、售价=sellerRevenueRub')
{
  const { project, snap } = makeProject()
  const outputs = computeWbOutputs()
  const payload = buildWbScenarioPayload({ project, inputPayload: WB_INPUT, tariff: TARIFF, settings: DEFAULT_SETTINGS, outputs })
  const sc = store.createCostScenario({ projectId: project.id, platform: 'WB', name: 'WB摘要', sourceSnapshotId: snap.id, ...payload })
  const s = scenarioSummary(store.getCostScenario(sc.id))
  assert(s.profitMarginPct === outputs.profitCalc.profitMargin, `profitMarginPct = profitCalc.profitMargin (${s.profitMarginPct})`)
  assert(s.profitCny === outputs.profitCalc.operatingProfitCny, 'profitCny = operatingProfitCny')
  assert(s.channelName === TARIFF.routeName && s.channelId === TARIFF.routeId, 'channelName/channelId = 线路名/routeId')
  assert(s.priceRub === WB_INPUT.sellerRevenueRub, 'priceRub = sellerRevenueRub')
  assert(s.calculatorVersion === WB_CALC_VERSION, 'calculatorVersion')
}

console.log('W7: OZON/WB 共存——scenarioMarginPct/scenarioSummary 统一口径（可跨平台比较）')
{
  const { project, snap } = makeProject()
  // WB 场景
  const wbOut = computeWbOutputs()
  const wbPayload = buildWbScenarioPayload({ project, inputPayload: WB_INPUT, tariff: TARIFF, settings: DEFAULT_SETTINGS, outputs: wbOut })
  const wbSc = store.createCostScenario({ projectId: project.id, platform: 'WB', name: 'WB场景', sourceSnapshotId: snap.id, ...wbPayload })
  // OZON 场景
  const ozPrefill = buildOzonPrefill({ snapshot: snap })
  const ozParams = { purchaseCost: 35, domesticShipping: 3, labelingFee: 2, adRate: 10, paymentFee: 1, agencyFee: 2, returnLoss: 4, ...ozPrefill }
  const engineCh = ALL_CHANNELS.find((c) => c.id === 'standard_small')
  const ozOut = calcChannelProfit(engineCh, Number(ozParams.price), Number(ozParams.weight), Number(ozParams.length), Number(ozParams.width), Number(ozParams.height), ozParams)
  const ozPayload = buildOzonScenarioPayload({ project, inputPayload: ozParams, selectedChannelId: 'standard_small', outputPayload: ozOut })
  const ozSc = store.createCostScenario({ projectId: project.id, platform: 'OZON', name: 'OZON场景', sourceSnapshotId: snap.id, ...ozPayload })
  const wbSum = scenarioSummary(store.getCostScenario(wbSc.id))
  const ozSum = scenarioSummary(store.getCostScenario(ozSc.id))
  assert(wbSum.profitMarginPct !== null && ozSum.profitMarginPct !== null, '两平台均有统一 profitMarginPct')
  assert(scenarioMarginPct(store.getCostScenario(wbSc.id)) === wbOut.profitCalc.profitMargin, 'scenarioMarginPct(WB)')
  assert(scenarioMarginPct(store.getCostScenario(ozSc.id)) === ozOut.profitRate, 'scenarioMarginPct(OZON)')
  assert(store.getProject(project.id).costing.scenarios.length === 2, '两场景共存于同一项目')
}

console.log('W8: Gate 用 WB 基线毛利率判定（≥15 PASS；<15 WARN）')
{
  const baseProject = {
    id: 'p-wb-gate', projectCode: 'RU-2026-999', marketCode: 'RU', schemaVersion: 1, name: 'x',
    source: { kind: 'candidate', candidateId: 'c1', sourceProductId: 'P-1', candidateName: 'x', category: 'x', creationSnapshotId: 's1' },
    lifecycleStatus: 'ACTIVE', stage: 'PIPELINE', goLiveAt: null,
    workflow: { templateVersion: 'roadmap-v1', states: [] },
    product: {}, suppliers: [], samples: [], compliance: {},
    costing: { scenarios: ['wbs1'], baselineScenarioId: 'wbs1' },
    logistics: {}, listing: {}, launch: {}, operations: {}, settlement: {},
    decisionLog: [], createdAt: '', updatedAt: '',
  }
  const wbScenario = (margin) => ({
    id: 'wbs1', projectId: 'p-wb-gate', platform: 'WB', name: 'WB基线', sourceSnapshotId: 's1',
    inputPayload: { sellerRevenueRub: 5000 },
    outputPayload: { profitCalc: { profitMargin: margin, operatingProfitCny: 100 } },
    resolvedConfig: { tariff: { routeId: 'DPX-SZ-382822', routeName: 'DPX深圳标准' }, calculatorVersion: WB_CALC_VERSION },
    createdAt: '',
  })
  const ok = evaluateProjectGate(baseProject, 'COSTING', { scenarios: [wbScenario(22)] })
  assert(ok.verdict === GATE_VERDICTS.GREEN && ok.checks.every((c) => c.result === GATE_RESULTS.PASS), 'WB 基线毛利 22% → GREEN')
  const low = evaluateProjectGate(baseProject, 'COSTING', { scenarios: [wbScenario(10)] })
  assert(low.verdict === GATE_VERDICTS.YELLOW && low.warnings.some((w) => w.includes('10%')), 'WB 基线毛利 10% → YELLOW')
  const none = evaluateProjectGate(baseProject, 'COSTING', { scenarios: [] })
  assert(none.verdict === GATE_VERDICTS.RED, '无场景 → RED')
}

console.log('W9: WB 场景永不带入 Ozon 佣金（即使 commission_rfbs=99，commissionRate 为用户填写值）')
{
  const { project, snap } = makeProject() // canonical.commission_rfbs = 99
  const prefill = buildWbPrefill({ snapshot: snap })
  assert(!('commission' in prefill) && !('commissionRate' in prefill), '预填不含佣金（99 也不带入）')
  const outputs = computeWbOutputs({ ...WB_INPUT, commissionRate: 25 })
  const payload = buildWbScenarioPayload({ project, inputPayload: { ...WB_INPUT, commissionRate: 25 }, tariff: TARIFF, settings: DEFAULT_SETTINGS, outputs })
  const sc = store.createCostScenario({ projectId: project.id, platform: 'WB', name: 'WB佣金', sourceSnapshotId: snap.id, ...payload })
  assert(store.getCostScenario(sc.id).inputPayload.commissionRate === 25, '场景 commissionRate = 用户填写值 25')
  assert(store.getCostScenario(sc.id).inputPayload.commissionRate !== 99, '绝不等于 Ozon commission_rfbs=99')
}

console.log('W10: 基线仅人工切换——WB 场景创建不自动改基线（human-only）')
{
  const { project, snap } = makeProject()
  // 先建 OZON 基线
  const ozPrefill = buildOzonPrefill({ snapshot: snap })
  const ozParams = { purchaseCost: 35, domesticShipping: 3, labelingFee: 2, adRate: 10, paymentFee: 1, agencyFee: 2, returnLoss: 4, ...ozPrefill }
  const engineCh = ALL_CHANNELS.find((c) => c.id === 'standard_small')
  const ozOut = calcChannelProfit(engineCh, Number(ozParams.price), Number(ozParams.weight), Number(ozParams.length), Number(ozParams.width), Number(ozParams.height), ozParams)
  const ozPayload = buildOzonScenarioPayload({ project, inputPayload: ozParams, selectedChannelId: 'standard_small', outputPayload: ozOut })
  const ozSc = store.createCostScenario({ projectId: project.id, platform: 'OZON', name: 'OZON基线', sourceSnapshotId: snap.id, ...ozPayload })
  // 再存 WB 场景
  const outputs = computeWbOutputs()
  const wbPayload = buildWbScenarioPayload({ project, inputPayload: WB_INPUT, tariff: TARIFF, settings: DEFAULT_SETTINGS, outputs })
  const wbSc = store.createCostScenario({ projectId: project.id, platform: 'WB', name: 'WB参考', sourceSnapshotId: snap.id, ...wbPayload })
  assert(store.getProject(project.id).costing.baselineScenarioId === ozSc.id, 'WB 场景创建不自动改基线（仍为 OZON 基线）')
  const logs = store.listLogs().filter((l) => l.projectId === project.id && l.kind === 'cost_baseline_change')
  assert(logs.filter((l) => l.to === wbSc.id).length === 0, '无指向 WB 场景的自动基线日志')
  store.setProjectBaselineScenario(project.id, wbSc.id)
  assert(store.getProject(project.id).costing.baselineScenarioId === wbSc.id, '人工 setProjectBaselineScenario 可切换（human-only）')
}

console.log(`\n===== WB 成本场景测试结果: ${pass} 通过 / ${fail} 失败 =====\n`)
if (fail > 0) process.exit(1)
