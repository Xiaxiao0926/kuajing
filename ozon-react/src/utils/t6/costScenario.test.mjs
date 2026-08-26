/**
 * t6/costScenario.test.mjs — CostScenario 实体 + 冻结适配测试（T6-2B1 Ozon）
 * 运行: node --experimental-vm-modules src/utils/t6/costScenario.test.mjs
 * 覆盖：
 *  C1 创建场景：uuid 主键、项目 scenarios 追加、首个自动基线、cost_scenario_create 日志
 *  C2 第二个场景不自动改基线（仅 setProjectBaselineScenario 可切换）
 *  C3 payload 禁带系统字段（id/createdAt/schemaVersion）→ throw
 *  C4 append-only：无 update/delete API，读取不改字节
 *  C5 setProjectBaselineScenario：跨项目 throw、引用型（场景字节不变）、cost_baseline_change 日志
 *  C6 buildOzonPrefill：只取 price/weight/dims/commission_rfbs；绝不取 fbs/fbo/fbp；成本字段不虚构
 *  C7 buildOzonScenarioPayload：resolvedConfig 冻结渠道完整配置+meta、汇率双语义、calcChannelProfit 输出 verbatim
 *  C8 scenarioSummary 统一摘要（跨平台比较用字段）
 *  C9 创建校验：项目不存在 / 快照归属不一致 / 非法平台 / 空名称 / 载荷不完整 → throw
 */
import * as store from './t6Store.js'
import { buildOzonPrefill, buildOzonResolvedConfig, buildOzonScenarioPayload, recalculateOzonScenario, scenarioSummary, findOzonChannelRaw, OZON_CALC_VERSION } from './costScenarioAdapter.js'
import { R, ALL_CHANNELS, calcChannelProfit, calcRow, toCNY, toRUB, rubToCnyExact, calculateAgencyFeeRub } from '../ozonEngine.js'
import { calculatePlatformSettlement } from '../wbEngine.js'
import settingsData from '../../generated/settings.js'
import channelsData from '../../generated/ozon_channels.js'

let pass = 0, fail = 0
const assert = (cond, msg) => { if (cond) { pass++; console.log(`  ✅ ${msg}`) } else { fail++; console.log(`  ❌ ${msg}`) } }

console.log('\n===== CostScenario 实体 + 冻结适配测试 =====\n')

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
  source_product_id: 'P-COST-001', category_leaf: '家用手套', category_full: '住宅和花园>家居用品>家用手套',
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

const CHANNEL_ID = 'standard_small'
const USER_INPUT = { purchaseCost: 35, domesticShipping: 3, labelingFee: 2, adRate: 10, paymentFee: 1, agencyFee: 2, returnLoss: 4 }

function makeScenarioPayloads(project, snap, { profitRateOverride } = {}) {
  const prefill = buildOzonPrefill({ snapshot: snap })
  const params = { ...USER_INPUT, ...prefill }
  const engineCh = ALL_CHANNELS.find((c) => c.id === CHANNEL_ID)
  const out = calcChannelProfit(engineCh, Number(params.price), Number(params.weight), Number(params.length), Number(params.width), Number(params.height), params)
  // 统一走 buildOzonScenarioPayload 冻结（与 UI 保存路径一致）
  return {
    prefill,
    ...buildOzonScenarioPayload({ project, inputPayload: { ...params }, selectedChannelId: CHANNEL_ID, outputPayload: out }),
  }
}

console.log('C1: 创建场景 → uuid 主键、项目 scenarios 追加、首个自动基线、cost_scenario_create 日志')
{
  const { project, snap } = makeProject()
  const p = makeScenarioPayloads(project, snap)
  const sc = store.createCostScenario({
    projectId: project.id, platform: 'OZON', name: `${project.projectCode} Ozon rFBS 场景`,
    sourceSnapshotId: snap.id, ...p,
  })
  assert(sc.id && /^[0-9a-f-]{36}$/.test(sc.id) || String(sc.id).length > 8, '场景有主键 id')
  const after = store.getProject(project.id)
  assert(after.costing.scenarios.includes(sc.id), '项目 costing.scenarios 追加场景 id')
  assert(after.costing.baselineScenarioId === sc.id, '首个场景自动设为基线')
  const logs = store.listLogs().filter((l) => l.projectId === project.id)
  assert(logs.some((l) => l.kind === 'cost_scenario_create' && l.to === sc.id), '存在 cost_scenario_create 日志')
  assert(logs.some((l) => l.kind === 'cost_baseline_change' && l.to === sc.id), '存在 cost_baseline_change（自动基线）日志')
  assert(store.getCostScenario(sc.id).platform === 'OZON' && store.getCostScenario(sc.id).sourceSnapshotId === snap.id, '场景绑定项目与立项快照')
}

console.log('C2: 第二个场景不自动改基线（仅人工 setProjectBaselineScenario 可切换）')
{
  const { project, snap } = makeProject()
  const p1 = makeScenarioPayloads(project, snap)
  const s1 = store.createCostScenario({ projectId: project.id, platform: 'OZON', name: '场景一', sourceSnapshotId: snap.id, ...p1 })
  const p2 = makeScenarioPayloads(project, snap)
  const s2 = store.createCostScenario({ projectId: project.id, platform: 'OZON', name: '场景二', sourceSnapshotId: snap.id, ...p2 })
  assert(store.getProject(project.id).costing.baselineScenarioId === s1.id, '第二个场景不自动改基线')
  store.setProjectBaselineScenario(project.id, s2.id)
  assert(store.getProject(project.id).costing.baselineScenarioId === s2.id, 'setProjectBaselineScenario 切换基线')
}

console.log('C3: payload 禁带系统字段（id/createdAt/schemaVersion）→ throw')
{
  const { project, snap } = makeProject()
  const p = makeScenarioPayloads(project, snap)
  for (const f of ['id', 'createdAt', 'schemaVersion']) {
    let threw = false
    try { store.createCostScenario({ projectId: project.id, platform: 'OZON', name: 'x', sourceSnapshotId: snap.id, ...p, [f]: 'hack' }) } catch (e) { threw = /系统字段/.test(e.message) }
    assert(threw, `携带系统字段 ${f} → throw`)
  }
}

console.log('C4: append-only——无 update/delete API，读取不改字节')
{
  assert(!('updateCostScenario' in store) && !('deleteCostScenario' in store), '无 update/delete API')
  const { project, snap } = makeProject()
  const p = makeScenarioPayloads(project, snap)
  const sc = store.createCostScenario({ projectId: project.id, platform: 'OZON', name: 'x', sourceSnapshotId: snap.id, ...p })
  const bytes = JSON.stringify(store.getCostScenario(sc.id))
  store.listCostScenarios()
  const bytesAfter = JSON.stringify(store.getCostScenario(sc.id))
  assert(bytes === bytesAfter, '读取操作不改变场景字节')
}

console.log('C5: setProjectBaselineScenario——跨项目 throw、引用型（场景字节不变）、cost_baseline_change 日志')
{
  const a = makeProject()
  const b = makeProject()
  const pa = makeScenarioPayloads(a.project, a.snap)
  const sa = store.createCostScenario({ projectId: a.project.id, platform: 'OZON', name: 'A场景', sourceSnapshotId: a.snap.id, ...pa })
  const saBytes = JSON.stringify(store.getCostScenario(sa.id))
  let threwCross = false
  try { store.setProjectBaselineScenario(b.project.id, sa.id) } catch (e) { threwCross = /跨项目/.test(e.message) }
  assert(threwCross, '跨项目设置基线 → throw')
  assert(JSON.stringify(store.getCostScenario(sa.id)) === saBytes, '基线变更不修改场景字节（引用型）')
  const logsBefore = store.listLogs().filter((l) => l.kind === 'cost_baseline_change' && l.projectId === a.project.id).length
  const pb = makeScenarioPayloads(a.project, a.snap)
  const sb = store.createCostScenario({ projectId: a.project.id, platform: 'OZON', name: 'B场景', sourceSnapshotId: a.snap.id, ...pb })
  store.setProjectBaselineScenario(a.project.id, sb.id)
  const change = store.listLogs().filter((l) => l.kind === 'cost_baseline_change' && l.projectId === a.project.id)
  assert(change.length === logsBefore + 1 && change[change.length - 1].to === sb.id, '切换基线写 cost_baseline_change 日志')
}

console.log('C6: buildOzonPrefill——只取 price/weight/dims/commission_rfbs；绝不取 fbs/fbo/fbp；成本字段不虚构')
{
  const { project, snap } = makeProject()
  const prefill = buildOzonPrefill({ snapshot: snap })
  assert(prefill.price === 5000 && prefill.weight === 1.55, 'price/weight 来自候选真实数据（price=实际售价 5000₽，无 ×0.6）')
  assert(prefill.length === 52 && prefill.width === 45 && prefill.height === 28, 'dims 来自候选 dims')
  assert(prefill.commission === 12, 'commission 取 commission_rfbs=12')
  assert(prefill.commission !== 20 && prefill.commission !== 19 && prefill.commission !== 18, '绝不取 fbs(20)/fbo(19)/fbp(18)')
  assert(prefill.purchaseCost === '' && prefill.domesticShipping === '' && prefill.labelingFee === '', '采购/国内运费/贴标费留空（不虚构）')
  assert(prefill.adRate === '' && prefill.paymentFee === '' && prefill.agencyFee === '' && prefill.returnLoss === '', '广告/支付/代理/退货留空（不虚构）')
  // dims 缺失回退空
  const noDims = buildOzonPrefill({ snapshot: { sourceInputs: { price_rub: 100, weight_kg: 1, commission_rfbs: 12, commission_fbs: 9 } } })
  assert(noDims.length === '' && noDims.width === '' && noDims.height === '', 'dims 缺失 → 空（不编造）')
}

console.log('C7: buildOzonScenarioPayload——resolvedConfig 冻结渠道完整配置+meta、单源汇率、快照保护、引擎输出 verbatim')
{
  const { project, snap } = makeProject()
  const p = makeScenarioPayloads(project, snap)
  const payload = buildOzonScenarioPayload({ project, inputPayload: p.inputPayload, selectedChannelId: CHANNEL_ID, outputPayload: p.outputPayload })
  const cfg = payload.resolvedConfig
  assert(cfg.calculatorVersion === OZON_CALC_VERSION, `calculatorVersion = ${OZON_CALC_VERSION}`)
  assert(cfg.exchange_rate === 13, `exchange_rate = 13 (${cfg.exchange_rate})`)
  assert(cfg.currency === 'RUB/CNY', `currency = RUB/CNY (${cfg.currency})`)
  assert(cfg.calculation_version === 'v1.0', `calculation_version = v1.0 (${cfg.calculation_version})`)
  assert(cfg.agencyFee.rate === 0.02 && cfg.agencyFee.min_rub === 15 && cfg.agencyFee.max_rub === 200, 'agencyFee 配置快照冻结')
  const raw = findOzonChannelRaw(CHANNEL_ID)
  assert(cfg.selectedChannel.id === raw.id && cfg.selectedChannel.kg_rate_cny === raw.kg_rate_cny, 'selectedChannel = config 原始渠道记录（不复制费率）')
  assert(cfg.selectedChannel.meta.source === channelsData.source && cfg.selectedChannel.meta.source_date === channelsData.source_date && cfg.selectedChannel.meta.verified_by === channelsData.verified_by, 'selectedChannel 含 source/source_date/verified_by meta')
  const engineCh = ALL_CHANNELS.find((c) => c.id === CHANNEL_ID)
  const expected = calcChannelProfit(engineCh, Number(p.inputPayload.price), Number(p.inputPayload.weight), Number(p.inputPayload.length), Number(p.inputPayload.width), Number(p.inputPayload.height), p.inputPayload)
  assert(JSON.stringify(payload.outputPayload) === JSON.stringify(expected), 'outputPayload = calcChannelProfit 输出原文（verbatim）')
  assert(payload.sourceSnapshotId === snap.id, 'sourceSnapshotId = 立项快照 id')
}

console.log('C8: scenarioSummary——统一摘要字段（跨平台比较用）')
{
  const { project, snap } = makeProject()
  const p = makeScenarioPayloads(project, snap)
  const sc = store.createCostScenario({ projectId: project.id, platform: 'OZON', name: '摘要场景', sourceSnapshotId: snap.id, ...p })
  const s = scenarioSummary(store.getCostScenario(sc.id))
  assert(s.id === sc.id && s.platform === 'OZON' && s.name === '摘要场景', 'id/platform/name')
  assert(s.channelId === CHANNEL_ID && s.channelName === 'Standard Small', 'channelId/channelName')
  assert(s.priceRub === 5000, 'priceRub 来自 inputPayload.price')
  assert(s.logisticsCostCny === p.outputPayload.costBreakdown.crossBorderCost, 'logisticsCostCny = costBreakdown.crossBorderCost（引擎原文）')
  assert(s.platformCostCny === p.outputPayload.costBreakdown.platformAmt, 'platformCostCny = costBreakdown.platformAmt（引擎原文）')
  assert(s.profitMarginPct === p.outputPayload.profitRate, 'profitMarginPct = 引擎 profitRate（统一口径）')
  assert(s.profitCny === p.outputPayload.profit, 'profitCny = 引擎 profit')
  assert(s.calculatorVersion === OZON_CALC_VERSION, 'calculatorVersion')
  assert(scenarioSummary(null) === null, 'null 场景 → null')
}

console.log('C9: 创建校验——项目不存在 / 快照归属不一致 / 非法平台 / 空名称 / 载荷不完整 → throw')
{
  const { project, snap } = makeProject()
  const p = makeScenarioPayloads(project, snap)
  const base = { projectId: project.id, platform: 'OZON', name: 'x', sourceSnapshotId: snap.id, ...p }
  let threwProj = false
  try { store.createCostScenario({ ...base, projectId: 'no-such-project' }) } catch (e) { threwProj = /项目不存在/.test(e.message) }
  assert(threwProj, '项目不存在 → throw')
  let threwSnap = false
  try { store.createCostScenario({ ...base, sourceSnapshotId: 'foreign-snapshot' }) } catch (e) { threwSnap = /快照归属不一致/.test(e.message) }
  assert(threwSnap, '快照归属不一致 → throw')
  let threwPlat = false
  try { store.createCostScenario({ ...base, platform: 'TEMU' }) } catch (e) { threwPlat = /非法成本平台/.test(e.message) }
  assert(threwPlat, '非法平台 → throw')
  let threwName = false
  try { store.createCostScenario({ ...base, name: '  ' }) } catch (e) { threwName = /名称必填/.test(e.message) }
  assert(threwName, '空名称 → throw')
  let threwPayload = false
  try { store.createCostScenario({ ...base, inputPayload: null, resolvedConfig: {}, outputPayload: {} }) } catch (e) { threwPayload = /载荷不完整/.test(e.message) }
  assert(threwPayload, '载荷不完整 → throw')
  assert(settingsData.rub_per_cny === 13, 'config 汇率单源化保持（rub_per_cny=13）')
}

console.log('C10: 汇率单源化与精度测试——3998 RUB / 13 = 307.54 RMB')
{
  assert(toCNY(3998) === 307.54, `toCNY(3998) = 307.54 (实际: ${toCNY(3998)})`)
  assert(toCNY(5200) === 400, `toCNY(5200) = 400.00 (实际: ${toCNY(5200)})`)
  assert(toCNY(100000) === 7692.31, `toCNY(100000) = 7692.31 (实际: ${toCNY(100000)})`)
  assert(rubToCnyExact(3998) === 3998 / 13, '内部 RUB/CNY 换算不提前 round2')
  assert(toRUB(307.54) === 3998.02, `toRUB(307.54) = 3998.02 (实际: ${toRUB(307.54)})`)
}

console.log('C11: 代理费纯函数与阶梯测试——500₽(15₽保底) / 2000₽(40₽) / 15000₽(200₽封顶)')
{
  assert(calculateAgencyFeeRub(500) === 15, `500 RUB -> 15 RUB 保底 (实际: ${calculateAgencyFeeRub(500)})`)
  assert(calculateAgencyFeeRub(0.01) === 15, '0.01 RUB -> 15 RUB')
  assert(calculateAgencyFeeRub(750) === 15, '750 RUB -> 15 RUB')
  assert(calculateAgencyFeeRub(751) === 15.02, '751 RUB -> 15.02 RUB')
  assert(calculateAgencyFeeRub(2000) === 40, `2000 RUB -> 40 RUB (实际: ${calculateAgencyFeeRub(2000)})`)
  assert(calculateAgencyFeeRub(10000) === 200, '10000 RUB -> 200 RUB')
  assert(calculateAgencyFeeRub(15000) === 200, `15000 RUB -> 200 RUB 封顶 (实际: ${calculateAgencyFeeRub(15000)})`)
  assert(calculateAgencyFeeRub(0) === 0, '0 RUB -> 0 RUB')
  assert(calculateAgencyFeeRub(-1) === 0, '负数 -> 0 RUB')
}

console.log('C12: 历史快照不可变保护测试——旧场景保留创建时汇率与配置')
{
  const { project, snap } = makeProject()
  const p = makeScenarioPayloads(project, snap)
  const histScenario = store.createCostScenario({
    projectId: project.id,
    platform: 'OZON',
    name: '历史场景_202607',
    sourceSnapshotId: snap.id,
    inputPayload: p.inputPayload,
    resolvedConfig: {
      exchange_rate: 12,
      currency: 'RUB/CNY',
      calculation_version: 'v0.9',
      rubPerCny: 12,
      agencyFee: { rate: 0.02, min_rub: 15, max_rub: 200 },
      selectedChannel: p.resolvedConfig.selectedChannel,
      calculatorVersion: OZON_CALC_VERSION,
    },
    outputPayload: p.outputPayload,
  })
  const retrieved = store.getCostScenario(histScenario.id)
  assert(retrieved.resolvedConfig.exchange_rate === 12, '历史快照 exchange_rate 保持 12 不变')
  assert(retrieved.resolvedConfig.calculation_version === 'v0.9', '历史快照 calculation_version 保持 v0.9 不变')
  const simulatedCurrent = {
    ...settingsData,
    rub_per_cny: 13,
    agency_fee: { rate: 0.03, min_rub: 20, max_rub: 250 },
  }
  const recalculated = recalculateOzonScenario(retrieved, simulatedCurrent)
  assert(recalculated.costBreakdown.agencyAmtRub === 100, `历史场景仍按 5000×2%=100 RUB（实际 ${recalculated.costBreakdown.agencyAmtRub}）`)
  assert(recalculated.costBreakdown.agencyAmt === 8.33, `历史场景仍按汇率12换算代理费（实际 ${recalculated.costBreakdown.agencyAmt}）`)

  const newCfg = buildOzonResolvedConfig(CHANNEL_ID, simulatedCurrent)
  assert(newCfg.exchange_rate === 13, '新场景读取当前汇率13')
  assert(newCfg.agencyFee.rate === 0.03 && newCfg.agencyFee.min_rub === 20 && newCfg.agencyFee.max_rub === 250, '新场景读取当前3% / 20 / 250配置')

  const legacyScenario = {
    ...retrieved,
    resolvedConfig: { selectedChannel: retrieved.resolvedConfig.selectedChannel, calculatorVersion: OZON_CALC_VERSION },
  }
  const legacyRecalculated = recalculateOzonScenario(legacyScenario, simulatedCurrent)
  assert(legacyRecalculated.costBreakdown.agencyAmtRub === 150, '缺少新字段的旧场景明确回退当前3%配置')
  assert(legacyRecalculated.costBreakdown.agencyAmt === 11.54, '缺少新字段的旧场景明确回退当前汇率13')
}
console.log('C13: 多规格折扣只执行一次——8600×0.6=5160，成交后费用基于5160')
{
  const out = calcRow({ listPrice: 8600, discountRate: 0.6, weight: 1, length: 20, width: 15, height: 10 }, {
    commission: 0, adRate: 0, paymentFee: 0, returnLoss: 0,
  })
  assert(out.price === 5160, `transactionPrice = 5160（实际 ${out.price}）`)
  assert(out.agencyAmtRub === 103.2, `代理费基于5160而非8600（实际 ${out.agencyAmtRub}）`)
}

console.log('C14: Ozon/WB 平台隔离——WB 不读取 Ozon 代理费配置')
{
  const order = { sellerRevenueBaseRub: 3998, commissionRate: 10 }
  const base = calculatePlatformSettlement(order, { rubPerCny: 13 })
  const withOzonAgency = calculatePlatformSettlement(order, {
    rubPerCny: 13,
    agencyFee: { rate: 0.99, min_rub: 999, max_rub: 9999 },
  })
  assert(JSON.stringify(base) === JSON.stringify(withOzonAgency), 'WB 结算结果不受 Ozon agencyFee 配置影响')
}

console.log('C15: WB 中间换算保持全精度——净结算不是展示值相减')
{
  const out = calculatePlatformSettlement({
    sellerRevenueBaseRub: 3998,
    commissionRate: 7,
    acquiringFeeRub: 1,
    promotionCostRub: 1,
    platformOtherDeductionRub: 1,
  }, { rubPerCny: 13 })
  assert(out.platformNetSettlementCny === 285.78, `全精度净结算=285.78（实际 ${out.platformNetSettlementCny}）`)
}

console.log('C16: Ozon 利润使用全精度汇率换算——仅输出阶段四舍五入')
{
  const channel = ALL_CHANNELS.find((item) => item.id === 'express_small')
  const out = calcChannelProfit(channel, 1503, 1, 20, 15, 10, {
    purchaseCost: 0,
    domesticShipping: 0,
    labelingFee: 0,
    commission: 7,
    adRate: 0,
    paymentFee: 0,
    agencyFee: 2,
    returnLoss: 0,
    rubPerCny: 13,
  })
  assert(out.profit === 41.77, `Ozon 全精度利润=41.77（实际 ${out.profit}）`)
}

console.log(`\n===== CostScenario 测试结果: ${pass} 通过 / ${fail} 失败 =====\n`)
if (fail > 0) {
  process.exitCode = 1
}
