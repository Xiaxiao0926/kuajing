import { useState } from 'react'
import { Calculator } from 'lucide-react'
import {
  toNum, round2, roundUpWeight, selectTariffVersion, selectTariffTier,
  validateParcel, calculateParcelLogistics, calculateOrderLogistics,
  calculatePlatformSettlement, calculateOperatingProfit, compareRoutes, calculateReturnLoss,
  calculateReverseCompensation, calculateTotalLogisticsCost, calculateOperatingProfitV2,
  inferReverseEventType, getOrderLabels,
} from '../../utils/wbEngine'

/**
 * 公式展示组件
 * 直观展示WB核算各步骤的公式与代入值，含异常订单物流总成本公式
 */
export function FormulaDisplay({ form, settings, tariff, logisticsCalc, logisticsCny, profitCalc, reverseCalcResult }) {
  const [showFormula, setShowFormula] = useState(true)
  const rubPerCny = toNum(settings.rubPerCny)
  const qty = Number(form.quantity) || 1
  const parcelCount = Number(form.parcelCount) || 1
  const perWeight = Number(form.actualWeightG) || 0
  const totalWeight = perWeight * qty
  const actualWeightPerParcel = parcelCount > 0 ? totalWeight / parcelCount : 0
  const stepG = toNum(tariff?.weightRoundingG || 100)
  const billableG = logisticsCalc?.parcels?.[0]?.billableWeightG
  const billableKg = logisticsCalc?.parcels?.[0]?.billableWeightKg
  const tier = logisticsCalc?.parcels?.[0]?.tier
  const kgRate = toNum(tier?.kgRateCny)
  const fixedFee = toNum(tier?.fixedFeeCny)
  const singleFee = logisticsCalc?.parcels?.[0]?.feeCny
  const isAbnormal = reverseCalcResult && reverseCalcResult.eventType !== 'none'

  // 利润相关
  const sellerRevenueRub = toNum(form.sellerRevenueRub)
  const commissionRate = toNum(form.commissionRate)
  const commissionCny = profitCalc?.commissionCny
  const salesRevenueCny = profitCalc?.salesRevenueCny
  const netSettlement = profitCalc?.platformNetSettlementCny
  const purchaseCost = toNum(form.purchaseCost) * qty
  const packagingCost = toNum(form.packagingCost) * qty
  const chinaInbound = toNum(form.chinaInbound) * qty
  const operatingProfit = profitCalc?.operatingProfitCny
  const profitMargin = profitCalc?.profitMargin
  const logisticsRatio = profitCalc?.logisticsRatio

  // 异常订单物流总成本
  const fwdUsed = reverseCalcResult?.forwardLogisticsUsedCny
  const revComp = reverseCalcResult?.reverseCompensationUsedCny
  const otherRev = reverseCalcResult?.otherReverseCostCny
  const totalLogistics = reverseCalcResult?.totalLogisticsCostCny

  return (
    <div className="rounded-lg bg-amber-50/40 border border-amber-200 overflow-hidden">
      <button
        onClick={() => setShowFormula(!showFormula)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-amber-50/60 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Calculator className="w-3.5 h-3.5 text-amber-700" />
          <span className="text-xs font-semibold text-amber-800">公式展示</span>
        </span>
        <span className="text-xs text-amber-700">{showFormula ? '收起 ▲' : '展开 ▼'}</span>
      </button>
      {showFormula && (
        <div className="px-3 pb-3 space-y-3 text-xs text-gray-700 leading-relaxed">
          {/* 1. 物流费 */}
          <div>
            <p className="font-semibold text-amber-700 mb-0.5">① 物流费（每包裹独立取整计费）</p>
            <p className="pl-3">实际重量 {perWeight}g × {qty}件 = {totalWeight}g → 每包裹 {actualWeightPerParcel}g</p>
            <p className="pl-3">按{stepG}g向上取整: ⌈{actualWeightPerParcel}/{stepG}⌉ × {stepG} = <span className="font-semibold">{billableG}g</span> = <span className="font-semibold">{billableKg}kg</span>（计费重量）</p>
            <p className="pl-3">命中区间 {tier ? `${tier.minWeightKg}-${tier.maxWeightKg}kg` : '—'}: 费率 {kgRate}元/kg + 固定费 {fixedFee}元</p>
            <p className="pl-3">单包裹物流费 = {billableKg} × {kgRate} + {fixedFee} = <span className="font-semibold text-purple-700">{singleFee}元</span></p>
            <p className="pl-3">{parcelCount}个包裹合计 = {singleFee} × {parcelCount} = <span className="font-bold text-purple-700">{logisticsCny}元</span></p>
          </div>

          {/* 2. 销售收入 */}
          <div className="pt-2 border-t border-amber-200/60">
            <p className="font-semibold text-amber-700 mb-0.5">② 销售收入（卢布→人民币）</p>
            <p className="pl-3">销售收入 = 卖家收入基数 / 汇率 = {sellerRevenueRub}₽ / {rubPerCny} = <span className="font-bold text-green-700">{salesRevenueCny}元</span></p>
          </div>

          {/* 3. 佣金 */}
          <div className="pt-2 border-t border-amber-200/60">
            <p className="font-semibold text-amber-700 mb-0.5">③ 平台佣金</p>
            <p className="pl-3">佣金 = 卖家收入基数 × 佣金率 / 汇率 = {sellerRevenueRub}₽ × {commissionRate}% / {rubPerCny} = <span className="font-bold text-orange-700">{commissionCny}元</span></p>
          </div>

          {/* 4. 平台净结算 */}
          <div className="pt-2 border-t border-amber-200/60">
            <p className="font-semibold text-amber-700 mb-0.5">④ 平台净结算</p>
            <p className="pl-3">净结算 = 销售收入 - 佣金 - 物流费 - 支付费 - 促销费 - 其他扣款</p>
            <p className="pl-3">= {salesRevenueCny} - {commissionCny} - {logisticsCny} - {profitCalc?.acquiringFeeCny || 0} - {profitCalc?.promotionCostCny || 0} - {profitCalc?.platformOtherCny || 0} = <span className="font-bold text-blue-700">{netSettlement}元</span></p>
          </div>

          {/* 5. 异常订单物流总成本（仅异常订单显示） */}
          {isAbnormal && (
            <div className="pt-2 border-t border-amber-200/60 bg-orange-50/40 -mx-3 px-3 py-2">
              <p className="font-semibold text-orange-700 mb-0.5">⑤ 异常订单物流总成本（依据WB条款13.1.14）</p>
              <p className="pl-3">物流总成本 = 正向物流费 + 反向配送赔偿 + 其他退回费</p>
              <p className="pl-3">= {fwdUsed} + {revComp} + {otherRev} = <span className="font-bold text-orange-700">{totalLogistics}元</span></p>
              <p className="pl-3 text-xs text-gray-500 mt-0.5">
                其中：反向赔偿 = CSG × 倍数 = {logisticsCny} × {reverseCalcResult?.multiplier} = {reverseCalcResult?.estimatedReverseCompensationCny}元
                {reverseCalcResult?.calculationBasis === 'actual' && <span className="text-orange-600">（已使用实际账单值覆盖）</span>}
              </p>
            </div>
          )}

          {/* 6. 经营利润 */}
          <div className="pt-2 border-t border-amber-200/60">
            <p className="font-semibold text-amber-700 mb-0.5">{isAbnormal ? '⑥' : '⑤'} 经营利润</p>
            <p className="pl-3">经营利润 = 平台净结算 - 采购成本 - 包装成本 - 国内送仓 - 认证分摊 - 税费 - 其他运营</p>
            <p className="pl-3">= {netSettlement} - {purchaseCost} - {packagingCost} - {chinaInbound} - 0 - 0 - 0 = <span className={`font-bold ${operatingProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{operatingProfit}元</span></p>
          </div>

          {/* 7. 利润率/物流费率 */}
          <div className="pt-2 border-t border-amber-200/60">
            <p className="font-semibold text-amber-700 mb-0.5">{isAbnormal ? '⑦' : '⑥'} 利润率 / 物流费率</p>
            <p className="pl-3">利润率 = 经营利润 / 销售收入 × 100% = {operatingProfit} / {salesRevenueCny} = <span className={`font-bold ${profitMargin >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{profitMargin}%</span></p>
            <p className="pl-3">物流费率 = {isAbnormal ? '物流总成本' : '物流费'} / 销售收入 × 100% = {isAbnormal ? totalLogistics : logisticsCny} / {salesRevenueCny} = <span className="font-bold text-purple-700">{logisticsRatio}%</span></p>
          </div>
        </div>
      )}
    </div>
  )
}

