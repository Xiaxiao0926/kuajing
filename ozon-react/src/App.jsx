import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react'
import Sidebar from './components/Sidebar'
import WorkspaceTopbar from './components/workspace/WorkspaceTopbar'
import WorkspacePageErrorBoundary from './components/workspace/WorkspacePageErrorBoundary'
import NodePage from './components/NodePage'
import ProjectSetup from './components/ProjectSetup'
import SupplyChain from './components/SupplyChain'
import CostQuote from './components/CostQuote'
import ProductDefinition from './components/ProductDefinition'
import ComplianceAssessment from './components/ComplianceAssessment'
import NodeOverview from './components/NodeOverview'
import ProgressOverview from './components/ProgressOverview'
import ProjectFlow from './components/ProjectFlow'
import * as XLSX from 'xlsx'
import { cleanData, addPriceCategory, calculateKPIs } from './utils/dataProcessor'
import { syncFromServer, persistGet, persistSet, flushPersistence } from './utils/persist'
import { getDataUrl, requiresAccessSession } from './utils/runtime.js'
import { checkAccessSession, unlockAccess } from './utils/access.js'
import { ROADMAP_PHASES, ALL_NODES } from './data/roadmap'
// P0 hotfix：选品评分页采用静态 import（可靠性优先）。
// T5-2 的 lazy 化在生产 WordPress 环境出现评分页白屏
// （懒加载 chunk 反向依赖入口 chunk 的动态加载链在 WP/LiteSpeed 下不稳定），
// 且 App 本身已静态 import xlsx，lazy 收益不足以承担线上白屏风险。
// 后续如需代码分割优化，单独立项，不在 P0 中处理。
import ProductScoringSection from './components/dashboard/sections/ProductScoringSection'

// 页面级懒加载（T3-4）：低频/重型页面不进入首屏主 bundle
const MarketResearch = lazy(() => import('./components/MarketResearch'))
const OzonCalc = lazy(() => import('./components/OzonCalc'))
const FragrancePricing = lazy(() => import('./components/FragrancePricing'))
const ListingContent = lazy(() => import('./components/ListingContent'))
const WBCalc = lazy(() => import('./components/WBCalc'))

const LazyFallback = () => (
  <div className="flex items-center justify-center py-24 text-sm text-morandi-text-light">页面加载中…</div>
)

const DATA_DIR = getDataUrl().replace(/\/$/, '')

// 页面错误边界的标题映射（仅展示用）
function pageLabelForNode(nodeId) {
  if (nodeId === '__scoring__') return '选品评分'
  if (nodeId === '__project_flow__') return '项目流程总览'
  if (nodeId === '__node_overview__') return '数据与设置'
  if (nodeId === '__progress_overview__') return '工作台'
  const node = ALL_NODES.find((n) => n.id === nodeId)
  return node ? node.title : '页面'
}

function DashboardApp() {
  const [data, setData] = useState(null)
  const [kpis, setKpis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [screenshotMode, setScreenshotMode] = useState(false)
  const [dataFormat, setDataFormat] = useState('old')
  const [autoLoaded, setAutoLoaded] = useState(false)
  const [activeNode, setActiveNode] = useState('n1')
  const [nodeStatuses, setNodeStatuses] = useState(() => {
    try {
      const saved = persistGet('roadmap-statuses')
      return saved || {}
    } catch { return {} }
  })
  const [serverSynced, setServerSynced] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const mainRef = useRef(null)

  useEffect(() => {
    syncFromServer().then(() => {
      const saved = persistGet('roadmap-statuses')
      if (saved && Object.keys(saved).length > 0) setNodeStatuses(saved)
      setServerSynced(true)
    }).catch(() => setServerSynced(true))
  }, [])

  useEffect(() => {
    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') flushPersistence()
    }
    document.addEventListener('visibilitychange', flushWhenHidden)
    return () => {
      document.removeEventListener('visibilitychange', flushWhenHidden)
      flushPersistence()
    }
  }, [])

  useEffect(() => {
    try { persistSet('roadmap-statuses', nodeStatuses) } catch {}
  }, [nodeStatuses])

  const processParsedData = useCallback((parsedData) => {
    if (parsedData.length === 0) throw new Error('未能解析到有效数据')
    const headers = Object.keys(parsedData[0])
    const hasNewFormat = headers.some(h => h.includes('销售额') || h.includes('曝光量') || h.includes('广告费用') || h.includes('转化指数'))
    setDataFormat(hasNewFormat ? 'new' : 'old')
    if (hasNewFormat) { setData(parsedData); setKpis(null) }
    else { const cleaned = cleanData(parsedData); const processed = addPriceCategory(cleaned); const calculatedKPIs = calculateKPIs(processed); setData(processed); setKpis(calculatedKPIs) }
  }, [])

  const parseXlsxArrayBuffer = useCallback((arrayBuffer) => {
    const fileData = new Uint8Array(arrayBuffer)
    const workbook = XLSX.read(fileData, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
    if (jsonData.length < 2) throw new Error('文件数据为空')
    const headers = jsonData[0].map(h => String(h).trim())
    return jsonData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== null && cell !== '')).map(row => {
      const obj = {}
      headers.forEach((header, index) => { obj[header] = row[index] })
      return obj
    })
  }, [])

  useEffect(() => {
    if (autoLoaded) return
    const autoLoadData = async () => {
      try {
        setLoading(true)
        const manifestResp = await fetch(`${DATA_DIR}/manifest.json?t=${Date.now()}`)
        if (!manifestResp.ok) { setLoading(false); return }
        const manifest = await manifestResp.json()
        if (!manifest.files || manifest.files.length === 0) { setLoading(false); return }
        const latestFile = manifest.files.sort((a, b) => b.date.localeCompare(a.date))[0]
        const fileResp = await fetch(`${DATA_DIR}/${latestFile.name}`)
        if (!fileResp.ok) { setLoading(false); return }
        const arrayBuffer = await fileResp.arrayBuffer()
        const parsedData = parseXlsxArrayBuffer(arrayBuffer)
        processParsedData(parsedData)
        setAutoLoaded(true)
      } catch (err) { console.log('Auto-load skipped:', err.message) }
      finally { setLoading(false) }
    }
    autoLoadData()
  }, [autoLoaded, parseXlsxArrayBuffer, processParsedData])

  const parseHTMLFile = (content) => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, 'text/html')
    const table = doc.querySelector('table')
    if (!table) throw new Error('HTML文件中未找到表格')
    const headers = []
    const headerCells = table.querySelectorAll('tr:first-child th, tr:first-child td')
    headerCells.forEach(cell => { headers.push(String(cell.textContent).trim()) })
    const rows = []
    const tbody = table.querySelector('tbody') || table
    const trs = tbody.querySelectorAll('tr')
    trs.forEach(tr => {
      if (tr.querySelector('th')) return
      const cells = tr.querySelectorAll('td')
      if (cells.length === 0) return
      const row = {}
      headers.forEach((header, index) => {
        let value = cells[index]?.textContent || ''
        value = String(value).trim()
        const numValue = parseFloat(value.replace(/[^\d.-]/g, ''))
        if (!isNaN(numValue) && value.match(/^-?\d+([.,]\d+)?$/)) row[header] = numValue
        else row[header] = value
      })
      rows.push(row)
    })
    return rows
  }

  const handleFileUpload = useCallback((file) => {
    setLoading(true); setError(null)
    const isHTML = file.name.endsWith('.html') || file.name.endsWith('.htm')
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        let parsedData = []
        if (isHTML) parsedData = parseHTMLFile(e.target.result)
        else parsedData = parseXlsxArrayBuffer(e.target.result)
        processParsedData(parsedData)
      } catch (err) { console.error('Parse error:', err); setError(err.message || '文件解析失败') }
      finally { setLoading(false) }
    }
    reader.onerror = () => { setError('文件读取失败'); setLoading(false) }
    if (isHTML) reader.readAsText(file)
    else reader.readAsArrayBuffer(file)
  }, [parseXlsxArrayBuffer, processParsedData])

  const handleNodeSelect = (nodeId) => setActiveNode(nodeId)
  const handleStatusChange = (nodeId, status) => {
    setNodeStatuses(prev => ({ ...prev, [nodeId]: status }))
    setLastUpdatedAt(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }))
  }

  const renderContent = () => {
    if (activeNode === '__project_flow__') {
      return <ProjectFlow nodeStatuses={nodeStatuses} onNodeSelect={handleNodeSelect} />
    }
    if (activeNode === '__node_overview__') {
      return <NodeOverview nodeStatuses={nodeStatuses} onNodeSelect={handleNodeSelect} />
    }
    if (activeNode === '__progress_overview__') {
      return <ProgressOverview nodeStatuses={nodeStatuses} onNodeSelect={handleNodeSelect} />
    }
    if (activeNode === '__scoring__') {
      return <ProductScoringSection />
    }
    if (activeNode === 'n1') {
      return (
        <NodePage nodeId={activeNode} status={nodeStatuses[activeNode] || 'pending'} onStatusChange={handleStatusChange}>
          <ProjectSetup onNavigateToResearch={() => setActiveNode('n2')} />
        </NodePage>
      )
    }
    if (activeNode === 'n4') {
      return (
        <NodePage nodeId={activeNode} status={nodeStatuses[activeNode] || 'pending'} onStatusChange={handleStatusChange} wide>
          <Suspense fallback={<LazyFallback />}><OzonCalc /></Suspense>
        </NodePage>
      )
    }
    if (activeNode === 'n36') {
      return (
        <Suspense fallback={<LazyFallback />}>
          <FragrancePricing
            nodeId={activeNode}
            status={nodeStatuses[activeNode] || 'pending'}
            onStatusChange={handleStatusChange}
          />
        </Suspense>
      )
    }
    if (activeNode === 'n2') {
      return (
        <Suspense fallback={<LazyFallback />}>
          <MarketResearch
            data={data}
            kpis={kpis}
            dataFormat={dataFormat}
            onFileUpload={handleFileUpload}
            loading={loading}
            error={error}
            screenshotMode={screenshotMode}
            setScreenshotMode={setScreenshotMode}
          />
        </Suspense>
      )
    }
    if (activeNode === 'n6') {
      return (
        <NodePage nodeId={activeNode} status={nodeStatuses[activeNode] || 'pending'} onStatusChange={handleStatusChange}>
          <SupplyChain />
        </NodePage>
      )
    }
    if (activeNode === 'n5') {
      return (
        <NodePage nodeId={activeNode} status={nodeStatuses[activeNode] || 'pending'} onStatusChange={handleStatusChange}>
          <ProductDefinition />
        </NodePage>
      )
    }
    if (activeNode === 'n8') {
      return (
        <NodePage nodeId={activeNode} status={nodeStatuses[activeNode] || 'pending'} onStatusChange={handleStatusChange}>
          <CostQuote />
        </NodePage>
      )
    }
    if (activeNode === 'n9') {
      return (
        <NodePage nodeId={activeNode} status={nodeStatuses[activeNode] || 'pending'} onStatusChange={handleStatusChange}>
          <ComplianceAssessment />
        </NodePage>
      )
    }
    if (activeNode === 'n14') {
      return (
        <NodePage nodeId={activeNode} status={nodeStatuses[activeNode] || 'pending'} onStatusChange={handleStatusChange} wide>
          <Suspense fallback={<LazyFallback />}><ListingContent /></Suspense>
        </NodePage>
      )
    }
    if (activeNode === 'n39') {
      return (
        <NodePage nodeId={activeNode} status={nodeStatuses[activeNode] || 'pending'} onStatusChange={handleStatusChange} wide>
          <Suspense fallback={<LazyFallback />}><WBCalc /></Suspense>
        </NodePage>
      )
    }
    return (
      <NodePage nodeId={activeNode} status={nodeStatuses[activeNode] || 'pending'} onStatusChange={handleStatusChange} />
    )
  }

  return (
    <div className="fyzsxnb-workspace">
      <div className="fyzsxnb-workspace-inner lg:flex">
        <Sidebar
          onFileUpload={handleFileUpload}
          loading={loading}
          data={data}
          error={error}
          activeNode={activeNode}
          onNodeSelect={handleNodeSelect}
          nodeStatuses={nodeStatuses}
          collapsed={sidebarCollapsed}
        />
        <div className="min-w-0 flex-1">
          <WorkspaceTopbar
            nodeStatuses={nodeStatuses}
            lastUpdatedAt={lastUpdatedAt}
            loading={loading}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(v => !v)}
            onOpenProgress={() => handleNodeSelect('__project_flow__')}
            onUpload={handleFileUpload}
          />
          <div className="sticky top-0 z-20 border-b border-gray-100 bg-white p-3 lg:hidden">
            <label className="block text-xs font-medium text-morandi-text-light" htmlFor="mobile-node-select">
              当前步骤
            </label>
            <select
              id="mobile-node-select"
              value={activeNode}
              onChange={(event) => handleNodeSelect(event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-morandi-text"
            >
              <option value="__project_flow__">项目流程总览</option>
              {ROADMAP_PHASES.map((phase) => (
                <optgroup key={phase.id} label={phase.title}>
                  {phase.nodes.map((node) => (
                    <option key={node.id} value={node.id}>{node.title}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <main ref={mainRef} className="p-3 sm:p-4 lg:p-6">
            <WorkspacePageErrorBoundary
              key={activeNode}
              pageLabel={pageLabelForNode(activeNode)}
            >
              {renderContent()}
            </WorkspacePageErrorBoundary>
          </main>
        </div>
      </div>
    </div>
  )
}

function AccessGate() {
  const [checking, setChecking] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    checkAccessSession().then((result) => {
      if (active) setAuthorized(Boolean(result.authorized))
    }).finally(() => {
      if (active) setChecking(false)
    })
    return () => { active = false }
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!password || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const result = await unlockAccess(password)
      setAuthorized(Boolean(result.authorized))
      setPassword('')
    } catch (requestError) {
      setError(requestError.status === 429 ? '尝试次数过多，请稍后再试。' : '密码不正确，请重新输入。')
    } finally {
      setSubmitting(false)
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-morandi-bg px-5">
        <p className="text-sm text-morandi-text-light">正在验证访问权限…</p>
      </div>
    )
  }

  if (authorized) return <DashboardApp />

  return (
    <div className="flex min-h-screen items-center justify-center bg-morandi-bg px-5 py-12">
      <main className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase text-morandi-primary">FYZSXNB Workspace</p>
        <h1 className="mt-2 text-2xl font-bold text-morandi-text">跨境运营工具</h1>
        <p className="mt-2 text-sm leading-6 text-morandi-text-light">输入访问密码后继续，无需 WordPress 账号。</p>
        <form className="mt-7" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-morandi-text" htmlFor="kuajing-access-password">
            访问密码
          </label>
          <input
            id="kuajing-access-password"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-base text-morandi-text outline-none transition focus:border-morandi-primary focus:ring-2 focus:ring-morandi-primary/20"
          />
          {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
          <button
            type="submit"
            disabled={!password || submitting}
            className="mt-5 w-full rounded-md bg-morandi-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? '正在验证…' : '进入工具'}
          </button>
        </form>
      </main>
    </div>
  )
}

function App() {
  return requiresAccessSession() ? <AccessGate /> : <DashboardApp />
}

export default App
