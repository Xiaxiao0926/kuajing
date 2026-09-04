import { useState } from 'react'
import { DoorOpen, ExternalLink, Lightbulb } from 'lucide-react'
import { getAssetUrl } from '../../utils/runtime.js'

const REPORTS = [
  {
    id: 'lighting',
    label: '照明与车灯',
    title: 'Ozon 车灯照明市场深度分析',
    snapshot: '2026-09-04',
    source: 'Ozon 卖家中心 BSR1000',
    sample: '1,000 SKU',
    path: 'reports/ozon-lighting-deep-analysis/index.html',
    frameTitle: 'Ozon 车灯照明市场深度分析报告',
    icon: Lightbulb,
  },
  {
    id: 'door-window',
    label: '门窗五金',
    title: '门窗五金 TOP 10 品类分析',
    snapshot: '2026-09-02',
    source: 'Ozon 卖家中心 BSR1000',
    sample: '1,000 SKU',
    path: 'reports/doors-windows-top10/ozon-doors-windows-top10.html',
    frameTitle: '门窗五金 TOP 10 品类详细分析报告',
    icon: DoorOpen,
  },
]

export default function MarketReportCenter() {
  const [activeReportId, setActiveReportId] = useState(REPORTS[0].id)
  const activeReport = REPORTS.find((report) => report.id === activeReportId) || REPORTS[0]
  const reportUrl = getAssetUrl(activeReport.path)

  return (
    <section className="mx-auto w-full max-w-[1600px]">
      <header className="border-b border-gray-200 pb-4">
        <p className="text-xs font-semibold text-blue-600">市场与选品</p>
        <h1 className="mt-1 text-2xl font-semibold text-morandi-text">市场报告中心</h1>
        <p className="mt-1 text-sm text-morandi-text-light">Ozon 类目深度分析与选品证据档案</p>
      </header>

      <div className="flex gap-1 overflow-x-auto border-b border-gray-200 pt-4" role="tablist" aria-label="市场报告">
        {REPORTS.map((report) => {
          const Icon = report.icon
          const selected = report.id === activeReport.id
          return (
            <button
              key={report.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="market-report-panel"
              onClick={() => setActiveReportId(report.id)}
              className={`inline-flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors ${
                selected
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-morandi-text-light hover:border-gray-300 hover:text-morandi-text'
              }`}
            >
              <Icon size={16} aria-hidden="true" />
              {report.label}
              <span className="text-xs font-normal text-gray-400">{report.snapshot.slice(5)}</span>
            </button>
          )
        })}
      </div>

      <div id="market-report-panel" role="tabpanel" className="pt-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-morandi-text">{activeReport.title}</h2>
            <p className="mt-1 text-sm text-morandi-text-light">
              数据快照 {activeReport.snapshot} · {activeReport.source} · {activeReport.sample}
            </p>
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
        </div>

        <iframe
          key={activeReport.id}
          title={activeReport.frameTitle}
          src={reportUrl}
          className="h-[calc(100vh-16rem)] min-h-[680px] w-full rounded-md border border-gray-200 bg-white"
        />
      </div>
    </section>
  )
}
