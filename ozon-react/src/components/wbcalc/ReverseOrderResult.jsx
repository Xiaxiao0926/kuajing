import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  toNum, round2, roundUpWeight, selectTariffVersion, selectTariffTier,
  validateParcel, calculateParcelLogistics, calculateOrderLogistics,
  calculatePlatformSettlement, calculateOperatingProfit, compareRoutes, calculateReturnLoss,
  calculateReverseCompensation, calculateTotalLogisticsCost, calculateOperatingProfitV2,
  inferReverseEventType, getOrderLabels,
} from '../../utils/wbEngine'
import { fmtCny } from './format'

// ===================== 异常订单费用结果展示 =====================
export function ReverseOrderResult({ result }) {
  const [showSteps, setShowSteps] = useState(false)
  const labels = getOrderLabels({}, result)

  const labelColorMap = {
    green: 'bg-green-100 text-green-700 border-green-300',
    orange: 'bg-orange-100 text-orange-700 border-orange-300',
    red: 'bg-red-100 text-red-700 border-red-300',
    yellow: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    gray: 'bg-gray-100 text-gray-700 border-gray-300',
  }

  return (
    <div className="bg-orange-50/50 border border-orange-200 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h5 className="text-sm font-semibold text-orange-700">异常订单费用</h5>
        <div className="flex gap-1">
          {labels.map((lbl, i) => (
            <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full border ${labelColorMap[lbl.color] || labelColorMap.gray}`}>
              {lbl.text}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
        <div className="bg-white rounded p-2 border border-gray-200">
          <p className="text-[10px] text-gray-500">异常类型</p>
          <p className="font-semibold text-gray-700">{result.eventLabel}</p>
        </div>
        <div className="bg-white rounded p-2 border border-gray-200">
          <p className="text-[10px] text-gray-500">赔偿倍数</p>
          <p className="font-semibold text-orange-700">{result.multiplier}× CSG</p>
        </div>
        <div className="bg-white rounded p-2 border border-gray-200">
          <p className="text-[10px] text-gray-500">CSG基数</p>
          <p className="font-semibold text-gray-700">{fmtCny(result.csgTotalCny)}</p>
        </div>
        <div className="bg-white rounded p-2 border border-gray-200">
          <p className="text-[10px] text-gray-500">计算依据</p>
          <p className="font-semibold text-gray-700">{result.calculationBasis === 'actual' ? '实际账单' : '预计公式'}</p>
        </div>

        <div className="bg-white rounded p-2 border border-gray-200">
          <p className="text-[10px] text-gray-500">正向费(预计)</p>
          <p className="text-gray-700">{fmtCny(result.estimatedForwardLogisticsCny)}</p>
        </div>
        <div className="bg-white rounded p-2 border border-gray-200">
          <p className="text-[10px] text-gray-500">正向费(实际)</p>
          <p className="text-gray-700">{result.actualForwardLogisticsCny !== null ? fmtCny(result.actualForwardLogisticsCny) : '—'}</p>
        </div>
        <div className="bg-white rounded p-2 border border-gray-200">
          <p className="text-[10px] text-gray-500">反向赔偿(预计)</p>
          <p className="text-gray-700">{fmtCny(result.estimatedReverseCompensationCny)}</p>
        </div>
        <div className="bg-white rounded p-2 border border-gray-200">
          <p className="text-[10px] text-gray-500">反向赔偿(实际)</p>
          <p className="text-gray-700">{result.actualReverseCompensationCny !== null ? fmtCny(result.actualReverseCompensationCny) : '—'}</p>
        </div>

        <div className="bg-white rounded p-2 border border-gray-200">
          <p className="text-[10px] text-gray-500">其他退回/销毁</p>
          <p className="text-gray-700">{fmtCny(result.otherReverseCostCny)}</p>
        </div>
        <div className="bg-white rounded p-2 border border-gray-200">
          <p className="text-[10px] text-gray-500">预计物流总损失</p>
          <p className="font-semibold text-gray-700">{fmtCny(result.estimatedTotalCny)}</p>
        </div>
        <div className="bg-white rounded p-2 border border-gray-200">
          <p className="text-[10px] text-gray-500">实际物流总损失</p>
          <p className="font-semibold text-orange-700">{fmtCny(result.actualTotalCny)}</p>
        </div>
        <div className="bg-white rounded p-2 border border-gray-200">
          <p className="text-[10px] text-gray-500">预计vs实际差异</p>
          <p className={`font-semibold ${result.varianceCny !== 0 ? 'text-red-600' : 'text-gray-700'}`}>{fmtCny(result.varianceCny)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-purple-50 border border-purple-200 rounded p-2 text-center">
          <p className="text-[10px] text-gray-500">正向使用值</p>
          <p className="text-sm font-bold text-purple-700">{fmtCny(result.forwardLogisticsUsedCny)}</p>
          <p className="text-[9px] text-gray-400">{result.forwardSource}</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded p-2 text-center">
          <p className="text-[10px] text-gray-500">反向使用值</p>
          <p className="text-sm font-bold text-purple-700">{fmtCny(result.reverseCompensationUsedCny)}</p>
        </div>
      </div>

      <div className="bg-red-50 border border-red-200 rounded p-2 text-center">
        <p className="text-[10px] text-gray-500">物流总成本</p>
        <p className="text-lg font-bold text-red-700">{fmtCny(result.totalLogisticsCostCny)}</p>
      </div>

      {result.needsBillConfirmation && (
        <div className="rounded bg-yellow-50 border border-yellow-300 p-2 flex items-center gap-2">
          <AlertTriangle className="w-3 h-3 text-yellow-600" />
          <span className="text-[11px] text-yellow-700">⚠️ 此场景暂按 {result.multiplier}×CSG 测算，需以WB实际账单确认为准</span>
        </div>
      )}

      <button onClick={() => setShowSteps(!showSteps)} className="text-xs text-orange-600 hover:text-orange-700">
        {showSteps ? '收起' : '展开'}计算过程
      </button>
      {showSteps && (
        <div className="bg-gray-50 rounded p-2 max-h-48 overflow-y-auto">
          {result.steps.map((s, i) => (
            <p key={i} className={`text-[11px] text-gray-600 ${s.startsWith('=====') ? 'font-semibold mt-2' : ''}`}>{s}</p>
          ))}
        </div>
      )}
    </div>
  )
}

