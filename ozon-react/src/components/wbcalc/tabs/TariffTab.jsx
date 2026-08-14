import { CheckCircle2, XCircle, Download, Upload } from 'lucide-react'
import {
  DEFAULT_SETTINGS, DEFAULT_TARIFFS, CSV_COLUMNS,
  REVERSE_EVENT_TYPE, REVERSE_EVENT_LABEL, DEFAULT_REVERSE_MULTIPLIER, NEEDS_BILL_CONFIRMATION,
} from '../../../utils/wbConfig'

// ===================== 费率管理 =====================
export function TariffTab({ tariffs, onSaveTariffs }) {
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(tariffs, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'wb_tariffs.json'; a.click()
    URL.revokeObjectURL(url)
  }
  const importJson = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result)
        onSaveTariffs(imported)
        alert('导入成功')
      } catch (err) { alert('导入失败: ' + err.message) }
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-morandi-text">当前费率 ({tariffs.length})</h4>
          <div className="flex gap-2">
            <button onClick={exportJson} className="text-xs px-2 py-1 rounded bg-white border border-gray-200 hover:bg-gray-50 flex items-center gap-1">
              <Download className="w-3 h-3" />导出JSON
            </button>
            <label className="text-xs px-2 py-1 rounded bg-white border border-gray-200 hover:bg-gray-50 flex items-center gap-1 cursor-pointer">
              <Upload className="w-3 h-3" />导入JSON
              <input type="file" accept=".json" onChange={importJson} className="hidden" />
            </label>
            <button onClick={() => { if (confirm('重置为默认费率？')) onSaveTariffs(DEFAULT_TARIFFS) }} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600">
              重置默认
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                {['线路ID', '名称', '仓库', '时效(天)', '最大重量(kg)', '三边和(cm)', '单边(cm)', '生效日期', '失效', '启用', '费率区间'].map((h) => (
                  <th key={h} className="px-2 py-2 text-left text-gray-500 font-semibold border-b border-gray-200 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tariffs.map((t, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-gray-700">{t.routeId}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-gray-700">{t.routeName}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-gray-600">{t.warehouseCode || '—'}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-gray-600">{t.etaMinDays}-{t.etaMaxDays}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-right text-gray-600">{t.maxWeightKg}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-right text-gray-600">{t.maxSumDimensionsCm}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-right text-gray-600">{t.maxSingleSideCm}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-gray-600">{t.effectiveFrom}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-gray-600">{t.effectiveTo || '—'}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100">{t.active !== false ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-gray-400" />}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-xs text-gray-500">{(t.tiers || []).map((tier) => `${tier.minWeightKg}-${tier.maxWeightKg}kg: ${tier.kgRateCny}+${tier.fixedFeeCny}`).join(' | ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
        <p className="font-semibold mb-1">⚠️ 费率管理说明</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>修改费率前请提示影响的预计订单数量</li>
          <li>新订单使用新版本，历史订单保留原费率版本</li>
          <li>重算历史订单时必须明确提示并保留重算前结果</li>
          <li>跨境订单（DPX）不得叠加俄罗斯境内"首升+续升"体积费</li>
          <li>当前费率按实际重量计费，不使用体积重</li>
        </ul>
      </div>
    </div>
  )
}

