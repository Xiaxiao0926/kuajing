import { ExternalLink } from 'lucide-react'
import { getAssetUrl } from '../../utils/runtime.js'

const REPORT_PATH = 'reports/doors-windows-top10/ozon-doors-windows-top10.html'

export default function DoorWindowHardwareReport() {
  const reportUrl = getAssetUrl(REPORT_PATH)

  return (
    <section className="mx-auto w-full max-w-[1600px]">
      <header className="mb-4 flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-blue-600">市场专题报告</p>
          <h1 className="mt-1 text-2xl font-semibold text-morandi-text">门窗五金 TOP 10 品类分析</h1>
          <p className="mt-1 text-sm text-morandi-text-light">Ozon BSR1000 数据快照 · 2026-09-02</p>
        </div>
        <a
          href={reportUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-morandi-text transition-colors hover:border-blue-300 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <ExternalLink size={16} aria-hidden="true" />
          新窗口打开
        </a>
      </header>

      <iframe
        title="门窗五金 TOP 10 品类详细分析报告"
        src={reportUrl}
        className="h-[calc(100vh-13rem)] min-h-[680px] w-full rounded-md border border-gray-200 bg-white"
      />
    </section>
  )
}
