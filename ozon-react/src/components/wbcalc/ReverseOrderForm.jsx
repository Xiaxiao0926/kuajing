import { AlertTriangle } from 'lucide-react'
import {
  DEFAULT_SETTINGS, DEFAULT_TARIFFS, CSV_COLUMNS,
  REVERSE_EVENT_TYPE, REVERSE_EVENT_LABEL, DEFAULT_REVERSE_MULTIPLIER, NEEDS_BILL_CONFIRMATION,
} from '../../utils/wbConfig'

// ===================== 异常订单配置表单 =====================
export function ReverseOrderForm({ form, update, tariff }) {
  const eventType = form.reverseEventType
  const eventLabel = REVERSE_EVENT_LABEL[eventType] || '未知'
  const defaultMult = DEFAULT_REVERSE_MULTIPLIER[eventType] ?? 0
  const needsConfirm = NEEDS_BILL_CONFIRMATION[eventType]

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-600" />
          <span className="text-sm font-semibold text-orange-700">异常订单配置</span>
        </div>
        {needsConfirm && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-300">
            待账单确认
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">反向事件类型</label>
          <select value={eventType} onChange={(e) => {
            const newType = e.target.value
            update('reverseEventType', newType)
            // 切换事件类型时重置倍数为默认
            update('reverseCompensationMultiplier', '')
            // 交仓前取消默认无正向费
            update('forwardFeeApplied', newType !== 'cancelled_before_handover')
          }}
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
            {Object.entries(REVERSE_EVENT_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">
            赔偿倍数 (默认 {defaultMult}×)
          </label>
          <input
            type="number"
            value={form.reverseCompensationMultiplier}
            onChange={(e) => update('reverseCompensationMultiplier', e.target.value)}
            placeholder={`默认 ${defaultMult}`}
            step="any"
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">
            实际正向物流费 (¥)
            <span className="text-[10px] text-gray-400 ml-1">留空用预计值</span>
          </label>
          <input
            type="number"
            value={form.actualForwardLogisticsCny}
            onChange={(e) => update('actualForwardLogisticsCny', e.target.value)}
            placeholder="留空"
            step="any"
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">
            实际反向赔偿 (¥)
            <span className="text-[10px] text-gray-400 ml-1">留空用预计值</span>
          </label>
          <input
            type="number"
            value={form.actualReverseCompensationCny}
            onChange={(e) => update('actualReverseCompensationCny', e.target.value)}
            placeholder="留空"
            step="any"
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">其他退回/销毁费 (¥)</label>
          <input
            type="number"
            value={form.otherReverseCostCny}
            onChange={(e) => update('otherReverseCostCny', e.target.value)}
            step="any"
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">库存回收率 (%)</label>
          <input
            type="number"
            value={form.inventoryRecoveryRate}
            onChange={(e) => update('inventoryRecoveryRate', e.target.value)}
            step="any"
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">正向费是否发生</label>
          <select value={String(form.forwardFeeApplied)} onChange={(e) => update('forwardFeeApplied', e.target.value === 'true')}
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
            <option value="true">是</option>
            <option value="false">否</option>
          </select>
        </div>
      </div>

      <div className="text-[10px] text-orange-700 bg-orange-100/50 rounded p-2">
        <p className="font-semibold mb-1">📋 说明（依据WB服务条款13.1.14）</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>未运出中国或买家退货：1×CSG赔偿</li>
          <li>清关失败退回中国：2×CSG赔偿（默认总风险2×CSG，不自动叠加为3×CSG）</li>
          <li>拒收/未领取：暂按1×CSG测算，最终以WB实际账单为准</li>
          <li>交仓前取消：正向费和赔偿均为0</li>
          <li>实际账单值优先于预计公式，但预计值和差异仍保留</li>
          <li>不叠加俄罗斯境内"8元首升+2元续升"体积运费</li>
        </ul>
      </div>
    </div>
  )
}

