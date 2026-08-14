import { useState, useRef, useEffect } from 'react'
import { Upload, FileSpreadsheet, Loader2, RefreshCw, FolderOpen, ChevronDown, ChevronRight, CheckCircle2, Zap, Bell, Info, GitBranch } from 'lucide-react'
import { ROADMAP_PHASES } from '../data/roadmap'
import { persistGet, persistSet } from '../utils/persist'
import { getDataUrl } from '../utils/runtime.js'

const DATA_DIR = getDataUrl().replace(/\/$/, '')

export default function Sidebar({ onFileUpload, loading, data, error, activeNode, onNodeSelect, nodeStatuses }) {
  const fileInputRef = useRef(null)
  const [availableFiles, setAvailableFiles] = useState([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [expandedPhases, setExpandedPhases] = useState({ 'phase-1': true })
  const [showDataPanel, setShowDataPanel] = useState(false)

  useEffect(() => {
    const fetchManifest = async () => {
      try {
        setLoadingFiles(true)
        const resp = await fetch(`${DATA_DIR}/manifest.json?t=${Date.now()}`)
        if (resp.ok) {
          const manifest = await resp.json()
          setAvailableFiles(manifest.files || [])
        }
      } catch {
        setAvailableFiles([])
      } finally {
        setLoadingFiles(false)
      }
    }
    fetchManifest()
    const interval = setInterval(fetchManifest, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation() }
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation()
    const files = e.dataTransfer.files
    if (files.length > 0) onFileUpload(files[0])
  }
  const handleFileChange = (e) => {
    const files = e.target.files
    if (files.length > 0) onFileUpload(files[0])
  }
  const handleLoadRemote = async (fileName) => {
    try {
      setLoadingFiles(true)
      const resp = await fetch(`${DATA_DIR}/${fileName}`)
      if (!resp.ok) throw new Error('下载失败')
      const blob = await resp.blob()
      const file = new File([blob], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      onFileUpload(file)
    } catch (err) {
      console.error('Load remote file error:', err)
    } finally {
      setLoadingFiles(false)
    }
  }

  const togglePhase = (phaseId) => {
    setExpandedPhases(prev => ({ ...prev, [phaseId]: !prev[phaseId] }))
  }

  const getNodeStatus = (nodeId) => nodeStatuses?.[nodeId] || 'pending'

  const getNodeUpdates = (nodeId) => {
    const updates = persistGet('node-updates') || {}
    return updates[nodeId] || []
  }

  const hasUnreadUpdate = (nodeId) => {
    const updates = getNodeUpdates(nodeId)
    const readTime = persistGet(`node-update-read-${nodeId}`)
    if (updates.length === 0) return false
    if (!readTime) return true
    return updates.some(u => u.time > parseInt(readTime))
  }

  const markUpdatesRead = (nodeId) => {
    persistSet(`node-update-read-${nodeId}`, String(Date.now()))
  }

  const getPhaseProgress = (phase) => {
    const done = phase.nodes.filter(n => getNodeStatus(n.id) === 'done').length
    return { done, total: phase.nodes.length, pct: phase.nodes.length > 0 ? Math.round(done / phase.nodes.length * 100) : 0 }
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-64 flex-shrink-0 flex-col border-r border-gray-100 bg-white lg:flex">
      <div className="p-4 border-b border-gray-100">
        <h1 className="text-lg font-bold text-morandi-text flex items-center gap-2">
          <span className="text-xl">🗺️</span>
          坪山综合保跨境项目
        </h1>
        <p className="text-[10px] text-morandi-text-light mt-0.5">从选品到放量的全流程导航</p>
      </div>

      <div className="px-3 py-2 border-b border-gray-50">
        <button
          onClick={() => setShowDataPanel(!showDataPanel)}
          className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-gray-50 text-xs text-morandi-text-light"
        >
          <span className="flex items-center gap-1"><FolderOpen className="w-3 h-3" /> 数据源</span>
          {showDataPanel ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        {showDataPanel && (
          <div className="mt-1 space-y-2">
            <div
              className={`border-2 border-dashed rounded-lg p-2.5 text-center cursor-pointer transition-all ${loading ? 'border-morandi-primary bg-morandi-primary/5' : 'border-gray-200 hover:border-morandi-primary hover:bg-gray-50'}`}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => !loading && fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" accept="*" className="hidden" onChange={handleFileChange} disabled={loading} />
              {loading ? (
                <div className="flex items-center justify-center gap-1"><Loader2 className="w-4 h-4 text-morandi-primary animate-spin" /><span className="text-xs text-morandi-text-light">解析中...</span></div>
              ) : (
                <div className="flex items-center justify-center gap-1"><Upload className="w-3.5 h-3.5 text-morandi-primary" /><span className="text-xs text-morandi-text">上传数据</span></div>
              )}
            </div>
            {availableFiles.length > 0 && (
              <div className="space-y-0.5 max-h-24 overflow-y-auto">
                {availableFiles.map((f, i) => (
                  <button key={i} onClick={() => handleLoadRemote(f.name)} disabled={loadingFiles} className="w-full text-left px-2 py-1 rounded hover:bg-gray-50 transition-colors group disabled:opacity-50">
                    <div className="flex items-center gap-1.5">
                      <FileSpreadsheet className="w-3 h-3 text-green-500 flex-shrink-0" />
                      <p className="text-[10px] font-medium text-morandi-text truncate group-hover:text-morandi-primary">{f.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {data && !error && (
              <div className="p-1.5 bg-green-50 rounded flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                <span className="text-[10px] text-green-700">已加载 {data.length} 条</span>
              </div>
            )}
            {error && <p className="text-[10px] text-red-600 px-1">{error}</p>}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        <button
          onClick={() => onNodeSelect('__project_flow__')}
          className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all w-full ${activeNode === '__project_flow__' ? 'bg-morandi-primary/10 text-morandi-primary border border-morandi-primary/20' : 'bg-gray-50 text-morandi-text hover:bg-gray-100 border border-transparent'}`}
        >
          <GitBranch className="w-3.5 h-3.5" />
          项目流程总览
        </button>
        <div className="space-y-1">
          {ROADMAP_PHASES.map((phase) => {
            const progress = getPhaseProgress(phase)
            const isExpanded = expandedPhases[phase.id]
            return (
              <div key={phase.id}>
                <button
                  onClick={() => togglePhase(phase.id)}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <span className="text-xs flex-shrink-0">{isExpanded ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}</span>
                  <span className="text-xs font-semibold text-morandi-text flex-1 text-left">{phase.title}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${progress.pct === 100 ? 'bg-green-100 text-green-700' : progress.pct > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                    {progress.done}/{progress.total}
                  </span>
                </button>
                {isExpanded && (
                  <div className="ml-3 border-l-2 border-gray-100 pl-0 space-y-0.5 mt-0.5 mb-1">
                    {phase.nodes.map((node) => {
                      const status = getNodeStatus(node.id)
                      const isActive = activeNode === node.id
                      const hasUpdate = hasUnreadUpdate(node.id)
                      return (
                        <button
                          key={node.id}
                          onClick={() => { onNodeSelect(node.id); markUpdatesRead(node.id) }}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-left ${isActive ? 'bg-morandi-primary/10 text-morandi-primary' : 'hover:bg-gray-50 text-morandi-text'}`}
                        >
                          <span className={`text-xs truncate flex-1 ${isActive ? 'font-semibold' : 'font-medium'}`}>{node.title}</span>
                          {node.dashboard && (
                            <span className="flex-shrink-0 text-[8px] px-1 py-0.5 bg-blue-100 text-blue-600 rounded">数据</span>
                          )}
                          <span className="relative flex-shrink-0">
                            <Info className={`w-3.5 h-3.5 ${hasUpdate ? 'text-morandi-primary' : 'text-gray-300'}`} />
                            {hasUpdate && (
                              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white" />
                            )}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="p-3 border-t border-gray-100">
        <div className="flex items-center justify-between text-[10px] text-morandi-text-light">
          <span>总进度</span>
          <span>{ROADMAP_PHASES.flatMap(p => p.nodes).filter(n => getNodeStatus(n.id) === 'done').length}/{ROADMAP_PHASES.flatMap(p => p.nodes).length}</span>
        </div>
        <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-morandi-primary to-morandi-secondary rounded-full transition-all duration-500"
            style={{ width: `${ROADMAP_PHASES.flatMap(p => p.nodes).filter(n => getNodeStatus(n.id) === 'done').length / ROADMAP_PHASES.flatMap(p => p.nodes).length * 100}%` }}
          />
        </div>
      </div>
    </aside>
  )
}
