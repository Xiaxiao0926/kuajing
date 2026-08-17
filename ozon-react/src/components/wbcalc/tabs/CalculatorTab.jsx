import { useState } from 'react'
import { Info, AlertTriangle, XCircle } from 'lucide-react'
import {
  toNum, round2, roundUpWeight, selectTariffVersion, selectTariffTier,
  validateParcel, calculateParcelLogistics, calculateOrderLogistics,
  calculatePlatformSettlement, calculateOperatingProfit, compareRoutes, calculateReturnLoss,
  calculateReverseCompensation, calculateTotalLogisticsCost, calculateOperatingProfitV2,
  inferReverseEventType, getOrderLabels,
} from '../../../utils/wbEngine'
import { fmtCny, fmtRub, fmtPct } from '../format'
import { CategoryProductPicker } from '../CategoryProductPicker'
import { MetricCard } from '../MetricCard'
import { FormulaDisplay } from '../FormulaDisplay'
import { ReverseOrderForm } from '../ReverseOrderForm'
import { ReverseOrderResult } from '../ReverseOrderResult'

// ===================== 单订单核算器 =====================
const FORM_DEFAULTS = {
  productName: '', actualWeightG: 100, lengthCm: 20, widthCm: 15, heightCm: 10,
  purchaseCost: 0, packagingCost: 0, quantity: 1, parcelCount: 1,
  routeId: '', sellerRevenueRub: 1000, commissionRate: 25,
  chinaInbound: 0, promotionCostRub: 0, status: '已签收',
  useSku: false, selectedSkuIdx: 0,
  category: '', commissionAutoMatched: false,
  // V2 异常订单字段
  reverseEventType: 'none',
  reverseCompensationMultiplier: '',
  actualForwardLogisticsCny: '',
  actualReverseCompensationCny: '',
  otherReverseCostCny: 0,
  forwardFeeApplied: true,
  inventoryRecoveryRate: 0,
}

export function CalculatorTab({ settings, tariffs, skus, onSaveOrder, onSaveSkus, projectContext = null }) {
  // T6-2B2：项目上下文预填只生效一次（key 按 projectId 强制重挂）；佣金/成本/线路假设绝不预填
  const [form, setForm] = useState(() => {
    const defaults = { ...FORM_DEFAULTS, routeId: tariffs[0]?.routeId || '' }
    if (projectContext?.prefill) return { ...defaults, ...projectContext.prefill }
    return defaults
  })
  const [showSteps, setShowSteps] = useState(false)

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const selectedSku = form.useSku && skus.length > 0 ? skus[form.selectedSkuIdx] : null
  const tariff = tariffs.find((t) => t.routeId === form.routeId)

  // 计算
  const perParcelWeight = form.actualWeightG * form.quantity / form.parcelCount
  const parcels = Array.from({ length: form.parcelCount }, () => ({
    actualWeightG: perParcelWeight, lengthCm: form.lengthCm, widthCm: form.widthCm, heightCm: form.heightCm,
  }))
  const logisticsCalc = tariff ? calculateOrderLogistics(parcels, tariff) : null
  const logisticsCny = logisticsCalc ? logisticsCalc.totalFeeCny : 0

  const orderData = {
    sellerRevenueBaseRub: form.sellerRevenueRub,
    commissionBaseRub: form.sellerRevenueRub,
    commissionRate: form.commissionRate,
    acquiringFeeRub: 0,
    promotionCostRub: form.promotionCostRub,
    platformOtherDeductionRub: 0,
    otherOperatingCostCny: 0,
    taxCostCny: 0,
  }
  const skuData = {
    purchaseCostCny: form.purchaseCost * form.quantity,
    packagingCostCny: form.packagingCost * form.quantity,
    chinaInboundCostCny: form.chinaInbound * form.quantity,
    certificationAllocationCny: 0,
  }
  const profitCalc = calculateOperatingProfit(orderData, skuData, settings, logisticsCny)

  // V2: 反向配送赔偿计算
  const reverseOrderData = {
    ...orderData,
    reverseEventType: form.reverseEventType,
    reverseCompensationMultiplier: form.reverseCompensationMultiplier,
    estimatedForwardLogisticsCny: logisticsCny, // 正向CSG
    actualForwardLogisticsCny: form.actualForwardLogisticsCny,
    actualReverseCompensationCny: form.actualReverseCompensationCny,
    otherReverseCostCny: form.otherReverseCostCny,
    forwardFeeApplied: form.forwardFeeApplied,
    inventoryRecoveryRate: form.inventoryRecoveryRate,
    parcels: Array.from({ length: form.parcelCount }, () => ({
      actualWeightG: perParcelWeight,
    })),
  }
  const reverseCalcResult = tariff ? calculateTotalLogisticsCost(reverseOrderData, tariff) : null

  // 盈亏平衡
  const rubPerCny = toNum(settings.rubPerCny)
  const commissionPct = form.commissionRate / 100
  const fixedCost = form.purchaseCost * form.quantity + form.packagingCost * form.quantity + form.chinaInbound * form.quantity + logisticsCny
  const bePriceRub = commissionPct < 1 && rubPerCny > 0 ? (fixedCost * rubPerCny) / (1 - commissionPct) : null

  // T6-2B2：项目模式下把当前方案冻结为不可变成本场景（wbEngine 输出 verbatim）
  const saveScenario = () => {
    if (!projectContext?.onSaveScenario || !tariff) return
    projectContext.onSaveScenario({
      inputPayload: {
        productName: form.productName,
        actualWeightG: toNum(form.actualWeightG),
        lengthCm: toNum(form.lengthCm),
        widthCm: toNum(form.widthCm),
        heightCm: toNum(form.heightCm),
        quantity: toNum(form.quantity),
        parcelCount: toNum(form.parcelCount),
        routeId: form.routeId,
        sellerRevenueRub: toNum(form.sellerRevenueRub),
        commissionRate: toNum(form.commissionRate),
        promotionCostRub: toNum(form.promotionCostRub),
        purchaseCost: toNum(form.purchaseCost),
        packagingCost: toNum(form.packagingCost),
        chinaInbound: toNum(form.chinaInbound),
        status: form.status,
        reverseEventType: form.reverseEventType,
        reverseCompensationMultiplier: form.reverseCompensationMultiplier,
        actualForwardLogisticsCny: form.actualForwardLogisticsCny,
        actualReverseCompensationCny: form.actualReverseCompensationCny,
        otherReverseCostCny: toNum(form.otherReverseCostCny),
        forwardFeeApplied: form.forwardFeeApplied,
        inventoryRecoveryRate: toNum(form.inventoryRecoveryRate),
      },
      tariff,
      settings,
      outputs: { logisticsCalc, profitCalc, reverseCalcResult, breakEvenPriceRub: bePriceRub },
    })
  }

  const inputField = (label, key, unit, opts = {}) => (
    <div>
      <label className="text-xs font-medium text-gray-500 mb-1 block">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={form[key]}
          onChange={(e) => update(key, e.target.value)}
          step="any"
          className="w-full text-sm text-morandi-text border border-gray-200 rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:ring-1 focus:ring-orange-200 focus:border-orange-300 bg-white"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">{unit}</span>
      </div>
    </div>
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 输入 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
        {projectContext && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-700">
            正在为项目 <b>{projectContext.projectCode}</b> 核算：已预填候选真实数据（名称/重量/尺寸/参考售价）。
            WB 佣金率、线路与成本假设请自行填写；售价仅作参考。
          </div>
        )}
        <h4 className="text-sm font-semibold text-morandi-text">输入参数</h4>

        {skus.length > 0 && (
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={form.useSku} onChange={(e) => update('useSku', e.target.checked)} className="rounded" />
            从SKU库选择
          </label>
        )}
        {form.useSku && skus.length > 0 && (
          <select
            value={form.selectedSkuIdx}
            onChange={(e) => {
              const idx = Number(e.target.value)
              update('selectedSkuIdx', idx)
              const s = skus[idx]
              if (s) setForm((f) => ({
                ...f, selectedSkuIdx: idx, productName: s.productNameCn || '',
                category: s.category || '', commissionAutoMatched: false,
                actualWeightG: s.actualUnitWeightG || 100, lengthCm: s.productLengthCm || 20,
                widthCm: s.productWidthCm || 15, heightCm: s.productHeightCm || 10,
                purchaseCost: s.purchaseCostCny || 0, packagingCost: s.packagingCostCny || 0,
                chinaInbound: s.chinaInboundCostCny || 0, routeId: s.defaultRouteId || f.routeId,
                sellerRevenueRub: s.targetSalePriceRub || 1000, commissionRate: s.commissionRate || 25,
              }))
            }}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
          >
            {skus.map((s, i) => <option key={i} value={i}>{s.skuId} - {s.productNameCn}</option>)}
          </select>
        )}

        <div className="grid grid-cols-2 gap-3">
          {inputField('含包装重量', 'actualWeightG', 'g')}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">佣金率(%)</label>
            <div className="relative">
              <input
                type="number"
                value={form.commissionRate}
                onChange={(e) => update('commissionRate', e.target.value)}
                step="any"
                className={`w-full text-sm border rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:ring-1 focus:ring-orange-200 focus:border-orange-300 bg-white ${
                  form.commissionAutoMatched ? 'border-orange-300 bg-orange-50/50' : 'border-gray-200'
                }`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">%</span>
            </div>
            {form.commissionAutoMatched && (
              <p className="text-[10px] text-orange-600 mt-0.5">✓ 已从佣金表自动匹配</p>
            )}
          </div>
        </div>

        {/* 类目+商品选择器 */}
        <CategoryProductPicker
          value={{ category: form.category || '', product: form.productName || '', commission: form.commissionAutoMatched ? toNum(form.commissionRate) : null }}
          onChange={(v) => {
            setForm((f) => ({
              ...f,
              category: v.category,
              productName: v.product,
              commissionRate: v.commission !== null ? v.commission : f.commissionRate,
              commissionAutoMatched: v.commission !== null,
            }))
          }}
          compact
        />

        <div className="grid grid-cols-3 gap-3">
          {inputField('长', 'lengthCm', 'cm')}
          {inputField('宽', 'widthCm', 'cm')}
          {inputField('高', 'heightCm', 'cm')}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {inputField('数量', 'quantity', '件')}
          {inputField('包裹数(标签数)', 'parcelCount', '个')}
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">物流线路</label>
          <select value={form.routeId} onChange={(e) => update('routeId', e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
            {tariffs.map((t) => <option key={t.routeId} value={t.routeId}>{t.routeName} ({t.etaMinDays}-{t.etaMaxDays}天)</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            {inputField('卖家收入基数', 'sellerRevenueRub', '₽')}
            {projectContext?.prefill?.sellerRevenueRub !== undefined && (
              <p className="text-[10px] text-gray-400 mt-0.5">来自候选市场的参考售价（可修改）</p>
            )}
          </div>
          {inputField('促销费', 'promotionCostRub', '₽')}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {inputField('采购成本', 'purchaseCost', '¥')}
          {inputField('包装成本', 'packagingCost', '¥')}
          {inputField('国内送仓费', 'chinaInbound', '¥')}
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">订单状态</label>
          <select value={form.status} onChange={(e) => {
            const newStatus = e.target.value
            // 根据订单状态自动推断反向事件类型
            const statusToEvent = {
              '已签收': 'none', '发货前取消': 'cancelled_before_handover',
              '买家拒收': 'refused_or_unclaimed', '超期未领取': 'refused_or_unclaimed',
              '签收后退货': 'buyer_returned', '丢失/破损': 'manual',
            }
            const inferredEvent = statusToEvent[newStatus] || 'none'
            setForm((f) => ({
              ...f, status: newStatus,
              reverseEventType: inferredEvent,
              reverseCompensationMultiplier: '',
              // 交仓前取消默认无正向费
              forwardFeeApplied: inferredEvent !== 'cancelled_before_handover',
            }))
          }}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
            {['待发货', '已交DPX', '运输中', '已签收', '买家拒收', '超期未领取', '签收后退货', '发货前取消', '丢失/破损', '已赔付', '其他异常'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* 异常订单配置（仅当反向事件类型不为none时显示） */}
      {form.reverseEventType !== 'none' && (
        <ReverseOrderForm form={form} update={update} tariff={tariff} />
      )}

      {/* 结果 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
        <h4 className="text-sm font-semibold text-morandi-text">核算结果</h4>

        <div className="grid grid-cols-3 gap-2">
          <MetricCard label="计费重量" value={logisticsCalc?.parcels[0]?.billableWeightKg ? `${logisticsCalc.parcels[0].billableWeightKg}kg` : '—'} />
          <MetricCard label="包裹数" value={form.parcelCount} />
          <MetricCard label="物流费" value={fmtCny(logisticsCny)} color="text-purple-700" />
          <MetricCard label="销售收入" value={fmtCny(profitCalc.salesRevenueCny)} color="text-green-700" />
          <MetricCard label="平台净结算" value={fmtCny(profitCalc.platformNetSettlementCny)} color="text-blue-700" />
          <MetricCard label="经营利润" value={fmtCny(profitCalc.operatingProfitCny)} color={profitCalc.operatingProfitCny >= 0 ? 'text-emerald-700' : 'text-red-600'} />
          <MetricCard label="利润率" value={fmtPct(profitCalc.profitMargin)} />
          <MetricCard label="物流费率" value={fmtPct(profitCalc.logisticsRatio)} />
          <MetricCard label="成本ROI" value={fmtPct(profitCalc.costRoi)} />
        </div>

        {/* 公式展示 */}
        <FormulaDisplay
          form={form}
          settings={settings}
          tariff={tariff}
          logisticsCalc={logisticsCalc}
          logisticsCny={logisticsCny}
          profitCalc={profitCalc}
          reverseCalcResult={reverseCalcResult}
        />

        {/* 异常订单费用模块 */}
        {reverseCalcResult && reverseCalcResult.eventType !== 'none' && (
          <ReverseOrderResult result={reverseCalcResult} />
        )}

        {/* 预警 */}
        {profitCalc.profitMargin !== null && profitCalc.profitMargin < settings.profitMarginThreshold && (
          <div className="rounded-lg bg-orange-50 border border-orange-200 p-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-600" />
            <span className="text-xs text-orange-700">利润率 {fmtPct(profitCalc.profitMargin)} 低于阈值 {settings.profitMarginThreshold}%</span>
          </div>
        )}
        {profitCalc.operatingProfitCny < 0 && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-2 flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-600" />
            <span className="text-xs text-red-700">负毛利！</span>
          </div>
        )}
        {/* 重量跳档提醒 */}
        {logisticsCalc?.parcels.map((p, i) => p.validation?.messages.filter((m) => m.includes('291-300') || m.includes('91-100') || m.includes('191-200')).map((msg, j) => (
          <div key={`${i}-${j}`} className="rounded-lg bg-blue-50 border border-blue-200 p-2 flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600" />
            <span className="text-xs text-blue-700">{msg}</span>
          </div>
        )))}

        {/* 盈亏平衡 */}
        {bePriceRub !== null && (
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
            <p className="text-xs text-gray-500 mb-1">💡 盈亏平衡分析</p>
            <p className="text-sm text-gray-700">盈亏平衡售价: <span className="font-bold">{fmtRub(bePriceRub)}</span></p>
            {form.sellerRevenueRub < bePriceRub ? (
              <p className="text-xs text-red-600 mt-1">当前售价低于平衡点，差额 {fmtRub(bePriceRub - form.sellerRevenueRub)}</p>
            ) : (
              <p className="text-xs text-emerald-700 mt-1">当前售价高于平衡点，安全边际 {fmtRub(form.sellerRevenueRub - bePriceRub)}</p>
            )}
          </div>
        )}

        {/* 计算明细 */}
        <button onClick={() => setShowSteps(!showSteps)} className="text-xs text-orange-600 hover:text-orange-700">
          {showSteps ? '收起' : '展开'}计算明细
        </button>
        {showSteps && (
          <div className="bg-gray-50 rounded-lg p-3 space-y-1 max-h-64 overflow-y-auto">
            <p className="text-xs font-semibold text-gray-600">物流计算</p>
            {logisticsCalc?.parcels.map((p, i) => (
              <div key={i} className="space-y-0.5">
                <p className="text-[11px] font-semibold text-gray-600">包裹 #{p.parcelIndex}</p>
                {p.steps.map((s, j) => <p key={j} className="text-[11px] text-gray-500 pl-3">{s}</p>)}
              </div>
            ))}
            <p className="text-xs font-semibold text-gray-600 mt-2">利润计算</p>
            {profitCalc.steps.map((s, i) => <p key={i} className="text-[11px] text-gray-500 pl-3">{s}</p>)}
          </div>
        )}

        {/* 保存 */}
        {projectContext && (
          <button
            onClick={saveScenario}
            disabled={!tariff || !form.productName}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-2 rounded-lg"
          >
            保存此方案到项目（不可变成本场景）
          </button>
        )}
        <button
          onClick={() => {
            if (!form.productName) { alert('请填写商品名称'); return }
            const skuId = `SKU-${Date.now()}`
            const newSku = {
              skuId,
              productNameCn: form.productName,
              category: form.category || '',
              actualUnitWeightG: toNum(form.actualWeightG) * toNum(form.quantity),
              purchaseCostCny: toNum(form.purchaseCost) * toNum(form.quantity),
              packagingCostCny: toNum(form.packagingCost) * toNum(form.quantity),
              chinaInboundCostCny: toNum(form.chinaInbound) * toNum(form.quantity),
              targetSalePriceRub: toNum(form.sellerRevenueRub),
              commissionRate: toNum(form.commissionRate),
              adCostRate: toNum(form.promotionCostRub) > 0 && toNum(form.sellerRevenueRub) > 0
                ? Math.round((toNum(form.promotionCostRub) / toNum(form.sellerRevenueRub)) * 1000) / 10
                : 0,
              commissionAutoMatched: !!form.commissionAutoMatched,
              productLengthCm: toNum(form.lengthCm),
              productWidthCm: toNum(form.widthCm),
              productHeightCm: toNum(form.heightCm),
              defaultRouteId: form.routeId,
              active: true,
              createdAt: new Date().toISOString(),
            }
            onSaveSkus([...skus, newSku])
            alert(`已保存为SKU模板：${skuId}\n可在「SKU利润表」Tab 查看`)
          }}
          className="w-full bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium py-2 rounded-lg"
        >
          保存为SKU模板
        </button>
      </div>
    </div>
  )
}
