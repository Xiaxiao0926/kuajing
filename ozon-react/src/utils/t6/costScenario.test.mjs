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
import { buildOzonPrefill, buildOzonScenarioPayload, scenarioSummary, findOzonChannelRaw, OZON_CALC_VERSION } from './costScenarioAdapter.js'
import { R, ALL_CHANNELS, calcChannelProfit } from '../ozonEngine.js'
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

console.log('C7: buildOzonScenarioPayload——resolvedConfig 冻结渠道完整配置+meta、汇率双语义、引擎输出 verbatim')
{
  const { project, snap } = makeProject()
  const p = makeScenarioPayloads(project, snap)
  const payload = buildOzonScenarioPayload({ project, inputPayload: p.inputPayload, selectedChannelId: CHANNEL_ID, outputPayload: p.outputPayload })
  const cfg = payload.resolvedConfig
  assert(cfg.calculatorVersion === OZON_CALC_VERSION, `calculatorVersion = ${OZON_CALC_VERSION}`)
  assert(cfg.rubToCny === settingsData.ozon_rub_to_cny, `rubToCny = ozon_rub_to_cny (${cfg.rubToCny})`)
  assert(cfg.celRubPerCny === settingsData.rub_per_cny, `celRubPerCny = rub_per_cny (${cfg.celRubPerCny})`)
  assert(cfg.rubToCny !== cfg.celRubPerCny, '两种汇率语义并存且不统一')
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
  // 汇率双语义来自 config 唯一事实源（不应被测试改坏）
  assert(settingsData.rub_per_cny === 12 && settingsData.ozon_rub_to_cny === 0.09, 'config 汇率双语义保持（rub_per_cny=12 / ozon_rub_to_cny=0.09）')
}

console.log(`\n===== CostScenario 测试结果: ${pass} 通过 / ${fail} 失败 =====\n`)
if (fail > 0) process.exit(1)
