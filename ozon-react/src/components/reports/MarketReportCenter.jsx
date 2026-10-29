import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { BookOpen, DoorOpen, ExternalLink, Lightbulb, Loader2, RefreshCw, RotateCcw, Upload } from 'lucide-react'
import { getAssetUrl } from '../../utils/runtime.js'
import { listServerFiles, uploadServerFile } from '../../utils/serverFiles.js'
import {
  buildUploadedMarketReport,
  getMarketImportType,
  isUploadedMarketReport,
  parseMarketReportJson,
} from '../../utils/marketReportAnalysis.js'
import {
  buildSafeSourceBackupName,
  computeSha256Hex,
  createFrozenImportAttempt,
  extractValidFilenameDate,
  validateConfirmedCollectionDateInput,
} from '../../utils/marketReport/retentionContract.js'
import { GENERATED_MARKET_REPORTS } from '../../generated/marketReports.js'
import { RECENT_MARKET_REPORTS } from '../../generated/recentMarketReports.js'
import { FEATURED_MARKET_BRIEFS } from '../../generated/featuredMarketBriefs.js'
import MarketDecisionBrief from './MarketDecisionBrief.jsx'
import MarketReportImportConfirm from './MarketReportImportConfirm.jsx'
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
    decisionBrief: FEATURED_MARKET_BRIEFS.lighting,
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
    decisionBrief: FEATURED_MARKET_BRIEFS['door-window'],
    icon: DoorOpen,
  },
]

const STATIC_REPORTS = [...FEATURED_REPORTS, ...RECENT_MARKET_REPORTS, ...GENERATED_MARKET_REPORTS]
const GROUP_ORDER = ['导入报告', '精选报告', '汽车生态', '家居与维修', '宠物与生活', '数码产品']
const SOURCE_NAMESPACE = 'market-report-sources'
const REPORT_NAMESPACE = 'market-report-json'

function parseWorkbook(arrayBuffer, fileType) {
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!firstSheet) throw new Error(`${fileType} 中没有可读取的数据表。`)
  return XLSX.utils.sheet_to_json(firstSheet, { defval: null, raw: fileType !== 'CSV' })
}

function parseImportBytes(arrayBuffer, fileType) {
  if (fileType === 'JSON') {
    const textValue = new TextDecoder('utf-8').decode(new Uint8Array(arrayBuffer))
    return parseMarketReportJson(textValue)
  }
  return parseWorkbook(arrayBuffer, fileType)
}

function formatShortTimestamp(isoString) {
  if (!isoString) return '时间未记录'
  const raw = String(isoString).trim()
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/u.test(raw)) {
    return `${raw.slice(0, 10)} ${raw.slice(11, 19)}`
  }
  return raw
}

function formatRevisionShortTag(report) {
  const rawId = String(report.provenance?.importId || report.id || '').replace(/^uploaded-/u, '')
  return rawId ? `#${rawId.slice(0, 8)}` : ''
}

function formatUploadedSnapshotSummary(report) {
  if (report.snapshot === null || report.quality?.collectionDateKnown === false) {
    return '采集日:未知（未评估）'
  }
  if (report.provenance) {
    const originMap = {
      filename: '文件名确认',
      user: '人工确认',
      unknown: '未知',
    }
    const originLabel = originMap[report.provenance.collectionDateOrigin] || '已确认'
    return `采集日:${report.snapshot}（${originLabel}）`
  }
  return `快照:${report.snapshot}（历史未核验）`
}

function formatSelectOptionLabel(report) {
  if (report.kind !== 'uploaded') return report.label
  const originalFile = report.provenance?.originalFileName || report.sourceFile || '未知文件'
  const snapshotPart = formatUploadedSnapshotSummary(report)
  const timePart = formatShortTimestamp(report.provenance?.importedAt || report.publishedAt)
  const shortTag = formatRevisionShortTag(report)
  return `${report.label} · ${originalFile} · ${snapshotPart} · 导入:${timePart} ${shortTag}`.trim()
}

export default function MarketReportCenter({ storageAdapter = null } = {}) {
  const [activeReportId, setActiveReportId] = useState(STATIC_REPORTS[0].id)
  const [activeGroup, setActiveGroup] = useState('精选报告')
  const [uploadedReports, setUploadedReports] = useState([])
  const [loadingUploaded, setLoadingUploaded] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [publishStatus, setPublishStatus] = useState(null)
  const [importDraft, setImportDraft] = useState(null)
  const [pendingAttempt, setPendingAttempt] = useState(null)
  const pendingAttemptRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    pendingAttemptRef.current = pendingAttempt
  }, [pendingAttempt])

  const reports = useMemo(() => [...uploadedReports, ...STATIC_REPORTS], [uploadedReports])
  const activeReport = reports.find((report) => report.id === activeReportId) || reports[0]
  const reportUrl = activeReport?.path ? getAssetUrl(activeReport.path) : ''
  const groupedReports = useMemo(() => {
    const groups = { 导入报告: uploadedReports, 精选报告: FEATURED_REPORTS }
    ;[...RECENT_MARKET_REPORTS, ...GENERATED_MARKET_REPORTS].forEach((report) => {
      if (!groups[report.group]) groups[report.group] = []
      groups[report.group].push(report)
    })
    return groups
  }, [uploadedReports])
  const visibleReports = groupedReports[activeGroup] || []

  const loadUploadedReports = useCallback(async () => {
    setLoadingUploaded(true)
    try {
      const files = await (storageAdapter?.listServerFiles
        ? storageAdapter.listServerFiles(REPORT_NAMESPACE)
        : listServerFiles(REPORT_NAMESPACE))
      const loaded = await Promise.all((files || [])
        .filter((file) => file?.name?.toLowerCase().endsWith('.json') && file.downloadUrl)
        .map(async (file) => {
          try {
            if (storageAdapter?.fetchReportJson) {
              const report = await storageAdapter.fetchReportJson(file)
              return isUploadedMarketReport(report) ? { ...report, serverDownloadUrl: file.downloadUrl } : null
            }
            const response = await fetch(file.downloadUrl, { credentials: 'same-origin', cache: 'no-store' })
            if (!response.ok) return null
            const report = await response.json()
            return isUploadedMarketReport(report) ? { ...report, serverDownloadUrl: file.downloadUrl } : null
          } catch {
            return null
          }
        }))
      const validReports = loaded
        .filter(Boolean)
        .sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || ''))
          || String(b.id).localeCompare(String(a.id)))
      setUploadedReports(validReports)

      const activePending = pendingAttemptRef.current
      if (activePending) {
        const reconciled = validReports.find(
          (item) => item.id === activePending.reportId
            && item.sourceBackup === activePending.expectedSourceBackupName,
        )
        if (reconciled) {
          setPendingAttempt(null)
          setActiveGroup('导入报告')
          setActiveReportId(reconciled.id)
          setPublishStatus({
            type: 'success',
            text: `服务器已确认“${reconciled.label}”（${reconciled.id}）发布完成，源备份 ${reconciled.sourceBackup} 已关联。`,
          })
        }
      }
    } finally {
      setLoadingUploaded(false)
    }
  }, [storageAdapter])

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

  const executeAttemptUpload = async (attempt) => {
    if (!attempt || publishing) return
    setPublishing(true)
    try {
      let confirmedSourceName = attempt.confirmedSourceBackup
      if (!confirmedSourceName) {
        setPublishStatus({
          type: 'working',
          text: `正在备份原始 ${attempt.fileType}（${attempt.expectedSourceBackupName}）…`,
        })
        const file = attempt.sourceBackupFile
        const sourceResult = await (storageAdapter?.uploadServerFile
          ? storageAdapter.uploadServerFile(SOURCE_NAMESPACE, file)
          : uploadServerFile(SOURCE_NAMESPACE, file))
        if (!sourceResult?.file?.name) {
          throw new Error(`服务器未确认原始 ${attempt.fileType} 备份。`)
        }
        attempt.markSourceConfirmed(sourceResult.file.name)
        confirmedSourceName = attempt.confirmedSourceBackup
      }

      const artifacts = attempt.getFrozenReportArtifacts()
      if (!artifacts?.reportFile || !artifacts?.publishedReport) {
        throw new Error('冻结报告载荷尚未完成源文件关联验证。')
      }

      setPublishStatus({
        type: 'working',
        text: `源文件已确认（${confirmedSourceName}），正在发布报告版本 ${attempt.reportFileName}…`,
      })
      const reportFile = artifacts.reportFile
      const reportResult = await (storageAdapter?.uploadServerFile
        ? storageAdapter.uploadServerFile(REPORT_NAMESPACE, reportFile)
        : uploadServerFile(REPORT_NAMESPACE, reportFile))
      if (!reportResult?.file?.name) {
        throw new Error('服务器未确认报告发布。')
      }
      if (reportResult.file.name !== attempt.reportFileName) {
        throw new Error(`服务器确认的报告文件名（${reportResult.file.name}）与预期版本（${attempt.reportFileName}）不一致。`)
      }

      const readyReport = {
        ...artifacts.publishedReport,
        serverDownloadUrl: reportResult.file.downloadUrl,
      }
      setUploadedReports((current) => [
        readyReport,
        ...current.filter((item) => item.id !== readyReport.id),
      ])
      setPendingAttempt(null)
      setActiveGroup('导入报告')
      setActiveReportId(readyReport.id)
      setPublishStatus({
        type: 'success',
        text: `“${readyReport.label}”（版本 ${readyReport.id}）已发布并完成服务器确认，源文件备份为 ${readyReport.sourceBackup}。`,
      })
    } catch (error) {
      const rawMessage = error?.message || '导入发布失败。'
      const isQueued = /queued|队列|retry automatically/iu.test(rawMessage)
      const stageHint = attempt.confirmedSourceBackup
        ? `源文件备份（${attempt.confirmedSourceBackup}）已确认，但报告版本（${attempt.reportFileName}）尚未获服务器确认`
        : `原始源文件（${attempt.expectedSourceBackupName}）尚未获服务器确认，未上传报告 JSON`
      setPendingAttempt(attempt)
      setPublishStatus({
        type: isQueued ? 'pending' : 'error',
        text: `${isQueued ? '等待队列确认' : '发布未完成'}：${stageHint}。原因：${rawMessage} 可点击“重试此版本发布”复用同一版本 ID 与冻结内容重试。`,
      })
    } finally {
      setPublishing(false)
    }
  }

  const handleImport = async (event) => {
    const selectedFile = event.target.files?.[0]
    event.target.value = ''
    if (!selectedFile || publishing) return
    setPublishStatus({ type: 'working', text: '正在解析数据文件并计算 SHA-256 指纹…' })
    try {
      const fileType = getMarketImportType(selectedFile.name)
      if (!fileType) throw new Error('仅支持 .xlsx、.xls、.csv 和 .json 文件。')
      if (selectedFile.size > 50 * 1024 * 1024) throw new Error('文件超过 50 MB，无法上传。')
      const rawBytes = await selectedFile.arrayBuffer()
      const rawRows = parseImportBytes(rawBytes, fileType)
      buildUploadedMarketReport(rawRows, {
        sourceFile: selectedFile.name,
        sourceFormat: fileType,
        snapshot: null,
      })

      const sourceSha256 = await computeSha256Hex(rawBytes)
      const expectedSourceBackupName = buildSafeSourceBackupName(selectedFile.name, sourceSha256)
      const prefilledFilenameDate = extractValidFilenameDate(selectedFile.name)

      setImportDraft({
        file: selectedFile,
        rawBytes,
        rawRows,
        rowCount: rawRows.length,
        byteLength: rawBytes.byteLength,
        fileType,
        sourceSha256,
        expectedSourceBackupName,
        prefilledFilenameDate,
        dateInput: prefilledFilenameDate || '',
        dateUnknown: false,
        validationError: null,
      })
      setPublishStatus({
        type: 'working',
        text: `已解析“${selectedFile.name}”（${rawRows.length} 条记录），请确认采集日期后发布。`,
      })
    } catch (error) {
      setImportDraft(null)
      setPublishStatus({ type: 'error', text: error.message || '文件解析失败。' })
    }
  }

  const handleConfirmImport = async () => {
    if (!importDraft || publishing) return
    try {
      validateConfirmedCollectionDateInput({
        dateUnknown: importDraft.dateUnknown,
        dateInput: importDraft.dateInput,
        prefilledFilenameDate: importDraft.prefilledFilenameDate,
      })
    } catch (validationErr) {
      setImportDraft((current) => (current ? { ...current, validationError: validationErr.message } : current))
      setPublishStatus({ type: 'error', text: validationErr.message })
      return
    }

    try {
      const attempt = await createFrozenImportAttempt({
        file: importDraft.file,
        rawBytes: importDraft.rawBytes,
        rawRows: importDraft.rawRows,
        fileType: importDraft.fileType,
        dateUnknown: importDraft.dateUnknown,
        dateInput: importDraft.dateInput,
        prefilledFilenameDate: importDraft.prefilledFilenameDate,
        buildReportFn: buildUploadedMarketReport,
        ...(storageAdapter?.uuidFn ? { uuidFn: storageAdapter.uuidFn } : {}),
        ...(storageAdapter?.nowFn ? { nowFn: storageAdapter.nowFn } : {}),
      })
      setImportDraft(null)
      setPendingAttempt(attempt)
      await executeAttemptUpload(attempt)
    } catch (error) {
      setPublishStatus({ type: 'error', text: error.message || '创建导入任务失败。' })
    }
  }

  const handleCancelImport = () => {
    if (publishing) return
    setImportDraft(null)
    setPublishStatus({ type: 'working', text: '已取消本次导入确认，未向服务器上传任何文件。' })
  }

  const handleRetryPendingAttempt = async () => {
    if (!pendingAttempt || publishing) return
    await executeAttemptUpload(pendingAttempt)
  }

  const handleDiscardPendingAttempt = () => {
    if (publishing) return
    setPendingAttempt(null)
    setPublishStatus({ type: 'working', text: '已放弃未完成的发布尝试。' })
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
              data-testid="refresh-server-reports-btn"
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
              data-testid="trigger-import-file-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={publishing}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {publishing ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}
              {publishing ? '正在发布' : '导入并发布'}
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-400">支持 Excel、CSV 和 JSON；浏览器本地解析并按 SHA-256 指纹留存原始文件，每次确认导入生成独立报告版本，同名文件不会覆盖历史报告或不同内容的源文件。</p>
        {publishStatus && (
          <p
            data-testid="publish-status-message"
            className={`mt-3 text-sm ${
              publishStatus.type === 'error'
                ? 'text-red-700'
                : publishStatus.type === 'pending'
                  ? 'text-amber-800'
                  : publishStatus.type === 'success'
                    ? 'text-emerald-700'
                    : 'text-blue-700'
            }`}
            role={publishStatus.type === 'error' ? 'alert' : 'status'}
          >
            {publishStatus.text}
          </p>
        )}

        <MarketReportImportConfirm
          draft={importDraft}
          publishing={publishing}
          onDateInputChange={(value) => setImportDraft((current) => (current
            ? { ...current, dateInput: value, validationError: null }
            : current))}
          onDateUnknownChange={(checked) => setImportDraft((current) => (current
            ? { ...current, dateUnknown: checked, validationError: null }
            : current))}
          onConfirm={handleConfirmImport}
          onCancel={handleCancelImport}
        />

        {pendingAttempt && !importDraft ? (
          <div
            className="mt-3 flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 sm:flex-row sm:items-center sm:justify-between"
            data-testid="pending-attempt-banner"
          >
            <div className="min-w-0 space-y-0.5">
              <p className="font-semibold">
                待确认发布版本：{pendingAttempt.reportId}（原始文件：{pendingAttempt.originalFileName}）
              </p>
              <p className="text-amber-900">
                源备份标识：{pendingAttempt.expectedSourceBackupName}（{pendingAttempt.confirmedSourceBackup ? '服务器已确认源备份' : '源备份待确认'}） · 冻结时间：{formatShortTimestamp(pendingAttempt.publishedAt)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                data-testid="retry-frozen-attempt-btn"
                onClick={handleRetryPendingAttempt}
                disabled={publishing}
                className="inline-flex h-8 items-center gap-1.5 rounded bg-amber-800 px-3 text-xs font-medium text-white hover:bg-amber-900 disabled:opacity-50"
              >
                <RotateCcw size={13} aria-hidden="true" />
                重试此版本发布
              </button>
              <button
                type="button"
                data-testid="discard-frozen-attempt-btn"
                onClick={handleDiscardPendingAttempt}
                disabled={publishing}
                className="inline-flex h-8 items-center rounded border border-amber-300 bg-white px-2.5 text-xs text-amber-900 hover:bg-amber-100 disabled:opacity-50"
              >
                放弃
              </button>
            </div>
          </div>
        ) : null}
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
                {(groupedReports[group] || []).map((report) => (
                  <option key={report.id} value={report.id}>
                    {formatSelectOptionLabel(report)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          <div className="hidden max-h-[calc(100vh-15rem)] space-y-1 overflow-y-auto pr-1 lg:block">
            {visibleReports.map((report) => {
              const selected = report.id === activeReport.id
              const Icon = report.icon || BookOpen
              const isUploaded = report.kind === 'uploaded'
              const originalFileName = report.provenance?.originalFileName || report.sourceFile
              return (
                <button
                  key={report.id}
                  type="button"
                  data-testid={`report-nav-item-${report.id}`}
                  onClick={() => selectReport(report)}
                  className={`flex w-full items-start gap-2 border-l-2 px-3 py-2.5 text-left transition-colors ${
                    selected
                      ? 'border-blue-600 bg-blue-50 text-blue-800'
                      : 'border-transparent text-morandi-text-light hover:bg-gray-50 hover:text-morandi-text'
                  }`}
                >
                  <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium leading-5">{report.label}</span>
                    {isUploaded ? (
                      <>
                        <span className="block truncate text-[11px] text-gray-500" title={originalFileName}>
                          源文件：{originalFileName}
                        </span>
                        <span className="block text-[11px] text-gray-500">
                          {formatUploadedSnapshotSummary(report)}
                        </span>
                        <span className="block truncate text-[11px] text-gray-400">
                          导入：{formatShortTimestamp(report.provenance?.importedAt || report.publishedAt)} {formatRevisionShortTag(report)}
                        </span>
                      </>
                    ) : (
                      <span className="block text-xs text-gray-400">{report.snapshot}</span>
                    )}
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
              {activeReport.kind === 'uploaded' ? (
                <p className="mt-1 text-sm text-morandi-text-light" data-testid="active-report-meta-line">
                  {formatUploadedSnapshotSummary(activeReport)} · 源文件 {activeReport.provenance?.originalFileName || activeReport.sourceFile} · 导入于 {formatShortTimestamp(activeReport.provenance?.importedAt || activeReport.publishedAt)} · {activeReport.sample}
                </p>
              ) : (
                <p className="mt-1 text-sm text-morandi-text-light">
                  数据快照 {activeReport.snapshot} · {activeReport.source} · {activeReport.sample}
                </p>
              )}
            </div>
            {activeReport.kind === 'uploaded' || activeReport.kind === 'embedded' ? (
              <span className="inline-flex h-9 shrink-0 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-800">{activeReport.kind === 'uploaded' ? '服务器已发布' : '随网站发布'}</span>
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

          {activeReport.kind === 'uploaded' || activeReport.kind === 'embedded' ? (
            <UploadedMarketReport key={activeReport.id} report={activeReport} />
          ) : (
            <>
              <MarketDecisionBrief brief={activeReport.decisionBrief} />
              <iframe
                key={activeReport.id}
                title={activeReport.frameTitle}
                src={reportUrl}
                className="h-[calc(100vh-16rem)] min-h-[680px] w-full rounded-md border border-gray-200 bg-white"
              />
            </>
          )}
        </div>
      </div>
    </section>
  )
}
