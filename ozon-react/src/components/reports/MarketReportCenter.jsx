import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { BookOpen, DoorOpen, ExternalLink, Lightbulb, Loader2, RefreshCw, Upload } from 'lucide-react'
import { getAssetUrl } from '../../utils/runtime.js'
import { listServerFiles, uploadServerFile } from '../../utils/serverFiles.js'
import {
  buildUploadedMarketReport,
  getMarketImportType,
  isUploadedMarketReport,
  parseMarketReportJson,
  stableMarketReportId,
} from '../../utils/marketReportAnalysis.js'
import { GENERATED_MARKET_REPORTS } from '../../generated/marketReports.js'
import UploadedMarketReport from './UploadedMarketReport.jsx'

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

const STATIC_REPORTS = [...FEATURED_REPORTS, ...GENERATED_MARKET_REPORTS]
const GROUP_ORDER = ['导入报告', '精选报告', '汽车生态', '家居与维修', '宠物与生活', '数码产品']
const SOURCE_NAMESPACE = 'market-report-sources'
const REPORT_NAMESPACE = 'market-report-json'

function parseWorkbook(arrayBuffer, fileType) {
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!firstSheet) throw new Error(`${fileType} 中没有可读取的数据表。`)
  return XLSX.utils.sheet_to_json(firstSheet, { defval: null })
}

async function parseImportFile(file, fileType) {
  if (fileType === 'JSON') return parseMarketReportJson(await file.text())
  return parseWorkbook(await file.arrayBuffer(), fileType)
}

export default function MarketReportCenter() {
  const [activeReportId, setActiveReportId] = useState(STATIC_REPORTS[0].id)
  const [activeGroup, setActiveGroup] = useState('精选报告')
  const [uploadedReports, setUploadedReports] = useState([])
  const [loadingUploaded, setLoadingUploaded] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [publishStatus, setPublishStatus] = useState(null)
  const fileInputRef = useRef(null)
  const reports = useMemo(() => [...uploadedReports, ...STATIC_REPORTS], [uploadedReports])
  const activeReport = reports.find((report) => report.id === activeReportId) || reports[0]
  const reportUrl = activeReport?.path ? getAssetUrl(activeReport.path) : ''
  const groupedReports = useMemo(() => {
    const groups = { 导入报告: uploadedReports, 精选报告: FEATURED_REPORTS }
    GENERATED_MARKET_REPORTS.forEach((report) => {
      if (!groups[report.group]) groups[report.group] = []
      groups[report.group].push(report)
    })
    return groups
  }, [uploadedReports])
  const visibleReports = groupedReports[activeGroup] || []

  const loadUploadedReports = useCallback(async () => {
    setLoadingUploaded(true)
    try {
      const files = await listServerFiles(REPORT_NAMESPACE)
      const loaded = await Promise.all(files
        .filter((file) => file.name.toLowerCase().endsWith('.json') && file.downloadUrl)
        .map(async (file) => {
          try {
            const response = await fetch(file.downloadUrl, { credentials: 'same-origin', cache: 'no-store' })
            if (!response.ok) return null
            const report = await response.json()
            return isUploadedMarketReport(report) ? { ...report, serverDownloadUrl: file.downloadUrl } : null
          } catch {
            return null
          }
        }))
      setUploadedReports(loaded.filter(Boolean).sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt))))
    } finally {
      setLoadingUploaded(false)
    }
  }, [])

  useEffect(() => { loadUploadedReports() }, [loadUploadedReports])

  const selectReport = (report) => {
    setActiveReportId(report.id)
    setActiveGroup(report.group || '精选报告')
  }

  const selectGroup = (group) => {
    setActiveGroup(group)
    const firstReport = groupedReports[group]?.[0]
    if (firstReport) setActiveReportId(firstReport.id)
  }

  const handleImport = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || publishing) return
    setPublishing(true)
    setPublishStatus({ type: 'working', text: '正在解析数据文件…' })
    try {
      const fileType = getMarketImportType(file.name)
      if (!fileType) throw new Error('仅支持 .xlsx、.xls、.csv 和 .json 文件。')
      if (file.size > 50 * 1024 * 1024) throw new Error('文件超过 50 MB，无法上传。')
      const rawRows = await parseImportFile(file, fileType)
      const report = buildUploadedMarketReport(rawRows, { sourceFile: file.name, sourceFormat: fileType })

      setPublishStatus({ type: 'working', text: `正在备份原始 ${fileType}…` })
      const sourceResult = await uploadServerFile(SOURCE_NAMESPACE, file)
      if (!sourceResult?.file) throw new Error(`服务器未确认原始 ${fileType} 备份。`)

      setPublishStatus({ type: 'working', text: '正在发布报告…' })
      const reportFileName = `${stableMarketReportId(file.name)}.json`
      const publishedReport = { ...report, sourceBackup: sourceResult.file.name }
      const reportFile = new File([JSON.stringify(publishedReport)], reportFileName, { type: 'application/json' })
      const reportResult = await uploadServerFile(REPORT_NAMESPACE, reportFile)
      if (!reportResult?.file) throw new Error('服务器未确认报告发布。')

      const readyReport = { ...publishedReport, serverDownloadUrl: reportResult.file.downloadUrl }
      setUploadedReports((current) => [readyReport, ...current.filter((item) => item.id !== readyReport.id)])
      setActiveGroup('导入报告')
      setActiveReportId(readyReport.id)
      setPublishStatus({ type: 'success', text: `“${readyReport.label}”已发布并完成服务器备份。` })
    } catch (error) {
      setPublishStatus({ type: 'error', text: error.message || '导入发布失败。' })
    } finally {
      setPublishing(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-[1600px]">
      <header className="border-b border-gray-200 pb-4">
        <p className="text-xs font-semibold text-blue-600">市场与选品</p>
        <h1 className="mt-1 text-2xl font-semibold text-morandi-text">市场报告中心</h1>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-morandi-text-light">
            <span>Ozon 类目深度分析与选品证据档案</span>
            <span className="text-xs text-gray-400">共 {reports.length} 份报告</span>
          </div>
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.json" className="hidden" onChange={handleImport} />
            <button
              type="button"
              onClick={loadUploadedReports}
              disabled={loadingUploaded || publishing}
              title="刷新服务器报告"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 bg-white text-morandi-text-light hover:border-blue-300 hover:text-blue-700 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loadingUploaded ? 'animate-spin' : ''} aria-hidden="true" />
              <span className="sr-only">刷新服务器报告</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={publishing}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {publishing ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}
              {publishing ? '正在发布' : '导入并发布'}
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-400">支持 Excel、CSV 和 JSON；浏览器本地解析，原始文件与聚合报告保存到服务器私有备份，同名文件再次导入会保留旧版本。</p>
        {publishStatus && (
          <p className={`mt-3 text-sm ${publishStatus.type === 'error' ? 'text-red-700' : publishStatus.type === 'success' ? 'text-emerald-700' : 'text-blue-700'}`} role={publishStatus.type === 'error' ? 'alert' : 'status'}>
            {publishStatus.text}
          </p>
        )}
      </header>

      <div className="flex gap-1 overflow-x-auto border-b border-gray-200 pt-4" role="tablist" aria-label="报告分组">
        {GROUP_ORDER.filter((group) => group !== '导入报告' || loadingUploaded || groupedReports[group]?.length).filter((group) => groupedReports[group]?.length || group === '导入报告').map((group) => (
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
            <span className="ml-1.5 text-xs font-normal text-gray-400">{groupedReports[group]?.length || 0}</span>
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
            onChange={(event) => selectReport(reports.find((report) => report.id === event.target.value) || reports[0])}
            className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-morandi-text focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 lg:hidden"
          >
            {GROUP_ORDER.filter((group) => groupedReports[group]?.length).map((group) => (
              <optgroup key={group} label={group}>
                {(groupedReports[group] || []).map((report) => <option key={report.id} value={report.id}>{report.label}</option>)}
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
            {activeReport.kind === 'uploaded' ? (
              <span className="inline-flex h-9 shrink-0 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-800">服务器已发布</span>
            ) : (
              <a
                href={reportUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-morandi-text transition-colors hover:border-blue-300 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <ExternalLink size={16} aria-hidden="true" />
                新窗口打开
              </a>
            )}
          </div>

          {activeReport.kind === 'uploaded' ? (
            <UploadedMarketReport key={activeReport.id} report={activeReport} />
          ) : (
            <iframe
              key={activeReport.id}
              title={activeReport.frameTitle}
              src={reportUrl}
              className="h-[calc(100vh-16rem)] min-h-[680px] w-full rounded-md border border-gray-200 bg-white"
            />
          )}
        </div>
      </div>
    </section>
  )
}
