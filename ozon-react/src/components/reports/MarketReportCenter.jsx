import { useMemo, useState } from 'react'
import { BookOpen, DoorOpen, ExternalLink, Lightbulb } from 'lucide-react'
import { getAssetUrl } from '../../utils/runtime.js'
import { GENERATED_MARKET_REPORTS } from '../../generated/marketReports.js'

const FEATURED_REPORTS = [
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

const REPORTS = [...FEATURED_REPORTS, ...GENERATED_MARKET_REPORTS]
const GROUP_ORDER = ['精选报告', '汽车生态', '家居与维修', '宠物与生活', '数码产品']

export default function MarketReportCenter() {
  const [activeReportId, setActiveReportId] = useState(REPORTS[0].id)
  const [activeGroup, setActiveGroup] = useState('精选报告')
  const activeReport = REPORTS.find((report) => report.id === activeReportId) || REPORTS[0]
  const reportUrl = getAssetUrl(activeReport.path)
  const groupedReports = useMemo(() => {
    const groups = { 精选报告: FEATURED_REPORTS }
    GENERATED_MARKET_REPORTS.forEach((report) => {
      if (!groups[report.group]) groups[report.group] = []
      groups[report.group].push(report)
    })
    return groups
  }, [])
  const visibleReports = groupedReports[activeGroup] || []

  const selectReport = (report) => {
    setActiveReportId(report.id)
    setActiveGroup(report.group || '精选报告')
  }

  const selectGroup = (group) => {
    setActiveGroup(group)
    const firstReport = groupedReports[group]?.[0]
    if (firstReport) setActiveReportId(firstReport.id)
  }

  return (
    <section className="mx-auto w-full max-w-[1600px]">
      <header className="border-b border-gray-200 pb-4">
        <p className="text-xs font-semibold text-blue-600">市场与选品</p>
        <h1 className="mt-1 text-2xl font-semibold text-morandi-text">市场报告中心</h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-morandi-text-light">
          <span>Ozon 类目深度分析与选品证据档案</span>
          <span className="text-xs text-gray-400">共 {REPORTS.length} 份报告</span>
        </div>
      </header>

      <div className="flex gap-1 overflow-x-auto border-b border-gray-200 pt-4" role="tablist" aria-label="报告分组">
        {GROUP_ORDER.filter((group) => groupedReports[group]?.length).map((group) => (
          <button
            key={group}
            type="button"
            role="tab"
            aria-selected={activeGroup === group}
            onClick={() => selectGroup(group)}
            className={`h-10 shrink-0 border-b-2 px-3 text-sm font-medium transition-colors ${
              activeGroup === group
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-morandi-text-light hover:border-gray-300 hover:text-morandi-text'
            }`}
          >
            {group}
            <span className="ml-1.5 text-xs font-normal text-gray-400">{groupedReports[group].length}</span>
          </button>
        ))}
      </div>

      <div className="grid min-w-0 gap-4 pt-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav className="lg:border-r lg:border-gray-200 lg:pr-4" aria-label={`${activeGroup}报告目录`}>
          <label htmlFor="market-report-select" className="mb-2 block text-xs font-semibold text-morandi-text-light lg:hidden">
            选择报告
          </label>
          <select
            id="market-report-select"
            value={activeReport.id}
            onChange={(event) => selectReport(REPORTS.find((report) => report.id === event.target.value) || REPORTS[0])}
            className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-morandi-text focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 lg:hidden"
          >
            {GROUP_ORDER.filter((group) => groupedReports[group]?.length).map((group) => (
              <optgroup key={group} label={group}>
                {groupedReports[group].map((report) => <option key={report.id} value={report.id}>{report.label}</option>)}
              </optgroup>
            ))}
          </select>

          <div className="hidden max-h-[calc(100vh-15rem)] space-y-1 overflow-y-auto pr-1 lg:block">
            {visibleReports.map((report) => {
              const selected = report.id === activeReport.id
              const Icon = report.icon || BookOpen
              return (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => selectReport(report)}
                  className={`flex w-full items-start gap-2 border-l-2 px-3 py-2.5 text-left transition-colors ${
                    selected
                      ? 'border-blue-600 bg-blue-50 text-blue-800'
                      : 'border-transparent text-morandi-text-light hover:bg-gray-50 hover:text-morandi-text'
                  }`}
                >
                  <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium leading-5">{report.label}</span>
                    <span className="block text-xs text-gray-400">{report.snapshot}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </nav>

        <div id="market-report-panel" role="tabpanel" className="min-w-0">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-blue-600">{activeReport.group || '精选报告'}</p>
              <h2 className="mt-1 text-xl font-semibold text-morandi-text">{activeReport.title}</h2>
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
      </div>
    </section>
  )
}
