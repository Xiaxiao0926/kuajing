/**
 * t6/costScenarioAdapter.js — 成本场景冻结适配（T6-2B1 Ozon / T6-2B2 WB）
 * 职责：把"候选/项目上下文 + 核算面板当前输入 + 引擎输出"冻结成不可变 CostScenario 载荷。
 * 冻结规则（需求方锁定）：
 *  - Ozon 预填只取 price_rub / weight_kg / dims / commission_rfbs（绝不取 fbs/fbo/fbp，
 *    绝不虚构 purchaseCost/domesticShipping/labelingFee/adRate/paymentFee/agencyFee/returnLoss）
 *  - resolvedConfig 不复制费率：冻结 config/ozon_channels.json 的完整渠道配置（含 source/source_date/verified_by meta）
 *  - 汇率双语义共存：rubToCny=ozon_rub_to_cny（引擎实际使用）、celRubPerCny=rub_per_cny（CEL 资费上下文存档），禁止统一
 *  - outputPayload 冻结核算引擎输出原文（calcChannelProfit 结果 verbatim）
 */
import { getProject, getSnapshot } from './t6Store.js'
import settingsData from '../../generated/settings.js'
import channelsData from '../../generated/ozon_channels.js'

export const OZON_CALC_VERSION = 'ozon-rfbs-single-v1'
export const WB_CALC_VERSION = 'wb-order-v2'

/**
 * Ozon 单规格测算预填：只带"候选真实数据"字段，成本类字段一律留空（绝不虚构）。
 * price = sourceInputs.price_rub（SingleTab 实际售价语义，绝不 ×0.6）
 * commission = commission_rfbs 仅限（rFBS 自发货；绝不回退 fbs/fbo/fbp）
 * @param {{ snapshot: object }} args
 */
export function buildOzonPrefill({ snapshot }) {
  const si = snapshot?.sourceInputs || {}
  const dims = Array.isArray(si.dims) && si.dims.length >= 3 ? si.dims : null
  return {
    price: si.price_rub ?? '',
    weight: si.weight_kg ?? '',
    length: dims ? dims[0] : '',
    width: dims ? dims[1] : '',
    height: dims ? dims[2] : '',
    commission: si.commission_rfbs ?? '',
    // 以下字段由用户在核算面板填写真实值；预填一律留空（不虚构）
    purchaseCost: '',
    domesticShipping: '',
    labelingFee: '',
    adRate: '',
    paymentFee: '',
    agencyFee: '',
    returnLoss: '',
  }
}

/** 按 id 在 config/ozon_channels.json（唯一事实源）中定位原始渠道记录 */
export function findOzonChannelRaw(channelId) {
  for (const g of channelsData.groups) {
    const ch = g.channels.find((c) => c.id === channelId)
    if (ch) return ch
  }
  return null
}

/**
 * 冻结解析配置：渠道完整配置（含 meta）+ 汇率双上下文 + 计算器版本。
 * 不复制费率数值；直接引用 config 原始记录。
 */
export function buildOzonResolvedConfig(selectedChannelId) {
  const raw = findOzonChannelRaw(selectedChannelId)
  if (!raw) throw new Error(`T6_COST: 渠道 ${selectedChannelId} 不在 config/ozon_channels.json（fail-close）`)
  return {
    rubToCny: settingsData.ozon_rub_to_cny,
    celRubPerCny: settingsData.rub_per_cny,
    selectedChannel: {
      ...raw,
      meta: {
        source: channelsData.source,
        source_date: channelsData.source_date,
        verified_by: channelsData.verified_by,
      },
    },
    calculatorVersion: OZON_CALC_VERSION,
  }
}

/**
 * 组装 Ozon 成本场景载荷（供 store.createCostScenario）。
 * - 校验项目存在 + 立项快照存在（归属一致性由 store 校验）
 * - inputPayload = 核算面板全部真实输入（含用户填写的成本字段）
 * - outputPayload = calcChannelProfit 输出原文（verbatim）
 */
export function buildOzonScenarioPayload({ project, inputPayload, selectedChannelId, outputPayload }) {
  if (!project) throw new Error('T6_COST: 项目不存在')
  if (!inputPayload) throw new Error('T6_COST: inputPayload 必填')
  if (!outputPayload) throw new Error('T6_COST: outputPayload 必填（引擎输出原文）')
  const snap = getSnapshot(project.source.creationSnapshotId)
  if (!snap) throw new Error(`T6_COST: 立项快照 ${project.source.creationSnapshotId} 不存在（场景上下文缺失）`)
  return {
    platform: 'OZON',
    sourceSnapshotId: snap.id,
    inputPayload: JSON.parse(JSON.stringify(inputPayload)),
    resolvedConfig: buildOzonResolvedConfig(selectedChannelId),
    outputPayload: JSON.parse(JSON.stringify(outputPayload)),
  }
}

/** 数值安全取值：null/undefined/''/NaN → null（绝不 Number(null)→0） */
function num(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * 项目模式预填合并（T6-2B hotfix）：
 * 只有"有值"的 project prefill 才覆盖 base；'' / null / undefined 一律不覆盖，
 * 防止把既有成本/费率假设清成 0（从而算出虚假高利润基线）。
 * OzonCalc 与 CalculatorTab 共用同一实现。
 */
export function mergeTrustedPrefill(base, prefill) {
  const trusted = Object.fromEntries(
    Object.entries(prefill || {}).filter(([, v]) => v !== '' && v !== null && v !== undefined),
  )
  return { ...base, ...trusted }
}

/** 场景统一摘要（OZON/WB 通用字段，供项目成本列表与跨平台比较表使用） */
export function scenarioSummary(scenario) {
  if (!scenario) return null
  const cfg = scenario.resolvedConfig || {}
  const out = scenario.outputPayload || {}
  const isWb = scenario.platform === 'WB'
  const pc = out.profitCalc || {}
  const cb = out.costBreakdown || {}
  // WB 平台费用 = 佣金+支付+促销+其他扣款（均为引擎输出字段）；OZON = costBreakdown.platformAmt
  const wbPlatformCost = [pc.commissionCny, pc.acquiringFeeCny, pc.promotionCostCny, pc.platformOtherCny].every((v) => num(v) !== null)
    ? Math.round((pc.commissionCny + pc.acquiringFeeCny + pc.promotionCostCny + pc.platformOtherCny) * 100) / 100
    : null
  return {
    id: scenario.id,
    platform: scenario.platform,
    name: scenario.name,
    createdAt: scenario.createdAt,
    channelId: isWb ? (cfg.tariff?.routeId ?? null) : (cfg.selectedChannel?.id ?? null),
    channelName: isWb ? (cfg.tariff?.routeName ?? null) : (cfg.selectedChannel?.name ?? null),
    priceRub: isWb ? (scenario.inputPayload?.sellerRevenueRub ?? null) : (scenario.inputPayload?.price ?? null),
    // 物流成本：WB=logisticsCalc.totalFeeCny；OZON=costBreakdown.crossBorderCost（均来自各引擎输出原文，不跨平台重算）
    logisticsCostCny: isWb ? num(out.logisticsCalc?.totalFeeCny) : num(cb.crossBorderCost),
    // 平台费用：WB=佣金+支付+促销+其他扣款；OZON=costBreakdown.platformAmt
    platformCostCny: isWb ? wbPlatformCost : num(cb.platformAmt),
    profitCny: isWb ? num(pc.operatingProfitCny) : num(out.profit),
    profitMarginPct: isWb ? num(pc.profitMargin) : num(out.profitRate),
    calculatorVersion: cfg.calculatorVersion ?? null,
  }
}

/** 基线毛利率统一取值（OZON: outputPayload.profitRate；WB: outputPayload.profitCalc.profitMargin）；供 Gate 判定 */
export function scenarioMarginPct(scenario) {
  if (!scenario) return null
  const out = scenario.outputPayload || {}
  const raw = scenario.platform === 'WB' ? out.profitCalc?.profitMargin : out.profitRate
  return num(raw)
}

// ---------- T6-2B2 WB ----------

/**
 * WB 单订单核算预填：只带候选真实数据 5 项。
 * - actualWeightG = weight_kg × 1000（克）
 * - sellerRevenueRub ← price_rub，仅作参考售价（标记"来自候选市场的参考售价"）
 * - 绝不预填佣金：WB 佣金/线路/成本假设全部由用户填写（即使 commission_rfbs 存在也绝不带入）
 */
export function buildWbPrefill({ snapshot }) {
  const si = snapshot?.sourceInputs || {}
  const dims = Array.isArray(si.dims) && si.dims.length >= 3 ? si.dims : null
  const weightKg = Number(si.weight_kg)
  return {
    productName: si.name ?? '',
    actualWeightG: Number.isFinite(weightKg) && weightKg > 0 ? Math.round(weightKg * 1000) : '',
    lengthCm: dims ? dims[0] : '',
    widthCm: dims ? dims[1] : '',
    heightCm: dims ? dims[2] : '',
    sellerRevenueRub: si.price_rub ?? '', // 参考售价（来源：候选市场价），可修改
  }
}

/**
 * 冻结 WB 费率版本完整快照（不是只存 routeId）：
 * tariff = 用户实际选用的费率版本记录（tariffId/routeId/routeName/effectiveFrom/effectiveTo/
 *           weightRoundingG/limits(尺寸/重量限制)/tiers/反向规则(reverse_to_ru_warehouse_included)/source_name）
 * settings = 引擎实际用到的设置子集（含进入利润公式的 taxMethod/taxRate；不含则不完整，无法复算历史场景）
 */
export function buildWbResolvedConfig({ tariff, settings }) {
  if (!tariff) throw new Error('T6_COST: WB 费率版本缺失（无法冻结）')
  if (!settings) throw new Error('T6_COST: WB 设置缺失（无法冻结）')
  return {
    tariff: JSON.parse(JSON.stringify(tariff)),
    settings: {
      // 进入利润公式（wbEngine calculatePlatformSettlement / calculateOperatingProfit）
      rubPerCny: settings.rubPerCny,
      taxMethod: settings.taxMethod,
      taxRate: settings.taxRate,
      // 展示/提示用阈值 + 汇率生效日（存档上下文）
      exchangeRateEffectiveFrom: settings.exchangeRateEffectiveFrom,
      profitMarginThreshold: settings.profitMarginThreshold,
      logisticsRatioThreshold: settings.logisticsRatioThreshold,
    },
    calculatorVersion: WB_CALC_VERSION,
  }
}

/**
 * 组装 WB 成本场景载荷（供 store.createCostScenario）。
 * inputPayload = 单订单核算全部真实输入（含反向配送字段）
 * outputs = wbEngine 输出原文（logisticsCalc / profitCalc / reverseCalcResult / breakEvenPriceRub）
 */
export function buildWbScenarioPayload({ project, inputPayload, tariff, settings, outputs }) {
  if (!project) throw new Error('T6_COST: 项目不存在')
  if (!inputPayload) throw new Error('T6_COST: inputPayload 必填')
  if (!outputs || !outputs.profitCalc) throw new Error('T6_COST: outputs 必填（wbEngine 输出原文）')
  const snap = getSnapshot(project.source.creationSnapshotId)
  if (!snap) throw new Error(`T6_COST: 立项快照 ${project.source.creationSnapshotId} 不存在（场景上下文缺失）`)
  return {
    platform: 'WB',
    sourceSnapshotId: snap.id,
    inputPayload: JSON.parse(JSON.stringify(inputPayload)),
    resolvedConfig: buildWbResolvedConfig({ tariff, settings }),
    outputPayload: JSON.parse(JSON.stringify(outputs)),
  }
}
