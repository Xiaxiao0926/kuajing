import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react'
import Sidebar from './components/Sidebar'
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
import { getDataUrl } from './utils/runtime.js'
import { ROADMAP_PHASES } from './data/roadmap'

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

function App() {
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
  const handleStatusChange = (nodeId, status) => setNodeStatuses(prev => ({ ...prev, [nodeId]: status }))

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
    <div className="min-h-screen bg-morandi-bg lg:flex">
      <Sidebar
        onFileUpload={handleFileUpload}
        loading={loading}
        data={data}
        error={error}
        activeNode={activeNode}
        onNodeSelect={handleNodeSelect}
        nodeStatuses={nodeStatuses}
      />
      <div className="sticky top-0 z-20 border-b border-gray-100 bg-white p-3 lg:hidden">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-morandi-text">坪山综合保跨境项目</p>
            <p className="text-[10px] text-morandi-text-light">从选品到放量的全流程导航</p>
          </div>
          <label className="flex-shrink-0 cursor-pointer rounded-md border border-morandi-primary px-2.5 py-1.5 text-xs font-medium text-morandi-primary">
            上传数据
            <input
              type="file"
              accept="*"
              className="hidden"
              disabled={loading}
              onChange={(event) => event.target.files?.[0] && handleFileUpload(event.target.files[0])}
            />
          </label>
        </div>
        <label className="block text-[10px] font-medium text-morandi-text-light" htmlFor="mobile-node-select">
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
      <main ref={mainRef} className="min-w-0 flex-1 p-3 sm:p-4 lg:p-6">
        {renderContent()}
      </main>
    </div>
  )
}

export default App
