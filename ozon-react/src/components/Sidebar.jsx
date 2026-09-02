/**
 * Sidebar.jsx — Workspace 主导航（T5-2 IA 重构）
 * 主导航 = 业务模块（回答"我要去哪"）；原 36 节点工作流降级为「项目执行进度」checklist（底部可展开），
 * 所有功能入口保留（含未读更新标记与数据源面板）。
 * 折叠态：64px 图标窄轨。状态只读自 props，本组件不做业务计算。
 */
import { useState, useRef, useEffect } from 'react'
import {
  Upload, FileSpreadsheet, Loader2, FolderOpen, ChevronDown, ChevronRight, CheckCircle2, Info, GitBranch,
  LayoutDashboard, Search, Target, ClipboardList, Store, Truck, FileText, Package, Factory, ShieldCheck, Wallet, Database, BarChart3, Warehouse,
  Inbox, FolderKanban, Layers,
} from 'lucide-react'
import { ROADMAP_PHASES } from '../data/roadmap'
import { persistGet, persistSet } from '../utils/persist'
import { getDataUrl } from '../utils/runtime.js'

const DATA_DIR = getDataUrl().replace(/\/$/, '')

const stripEmoji = (s) => String(s || '').replace(/^[^\u4e00-\u9fa5A-Za-z]+/, '').trim()

// 业务模块主导航（T5-2 IA）；id 一律指向既有节点/页面，不新增功能
const NAV_SECTIONS = [
  {
    id: 'workspace', label: '工作台', icon: LayoutDashboard,
    items: [{ id: '__progress_overview__', label: '工作台', icon: LayoutDashboard }],
  },
  {
    id: 'market', label: '市场与选品', icon: BarChart3,
    items: [
      { id: 'n2', label: '市场调研', icon: Search },
      { id: '__purity_analysis__', label: '选品市场分析', icon: Layers },
      { id: '__scoring__', label: '选品评分', icon: Target },
      { id: 'n1', label: '立项决策', icon: ClipboardList },
    ],
  },
  {
    id: 'platform', label: '平台运营', icon: Store,
    items: [
      { id: 'n4', label: 'Ozon', icon: Store },
      { id: 'n39', label: 'Wildberries', icon: Truck },
      { id: 'n14', label: 'Listing', icon: FileText },
    ],
  },
  {
    id: 'goods', label: '商品中心', icon: Package,
    items: [
      { id: '__t6_candidates__', label: '候选池', icon: Inbox },
      { id: '__t6_projects__', label: 'SKU 项目', icon: FolderKanban },
      { id: 'n5', label: '商品档案', icon: Package },
    ],
  },
  {
    id: 'supply', label: '供应链', icon: Factory,
    items: [{ id: 'n6', label: '供应链', icon: Factory }],
  },
  {
    id: 'logistics', label: '物流与成本', icon: Truck,
    items: [
      { id: 'n8', label: '物流与成本', icon: Truck },
      { id: '__fbp_calc__', label: 'FBP 边境仓核算', icon: Warehouse },
    ],
  },
  {
    id: 'compliance', label: '合规与账号', icon: ShieldCheck,
    items: [{ id: 'n9', label: '合规与账号', icon: ShieldCheck }],
  },
  {
    id: 'finance', label: '回款与财务', icon: Wallet,
    items: [{ id: 'n31', label: '回款与财务', icon: Wallet }],
  },
  {
    id: 'data', label: '数据与设置', icon: Database,
    items: [{ id: '__node_overview__', label: '数据与设置', icon: Database }],
  },
]

export default function Sidebar({ onFileUpload, loading, data, error, activeNode, onNodeSelect, nodeStatuses, collapsed }) {
  const fileInputRef = useRef(null)
  const [availableFiles, setAvailableFiles] = useState([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [expandedSections, setExpandedSections] = useState({ market: true, platform: true })
  const [showDataPanel, setShowDataPanel] = useState(false)
  const [showProgress, setShowProgress] = useState(false)
  const [expandedPhases, setExpandedPhases] = useState({ 'phase-1': true })

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

  const toggleSection = (id) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }))
  }
  const togglePhase = (phaseId) => {
    setExpandedPhases(prev => ({ ...prev, [phaseId]: !prev[phaseId] }))
  }

  const getNodeStatus = (nodeId) => nodeStatuses?.[nodeId] || 'pending'
  const hasUnreadUpdate = (nodeId) => {
    const updates = persistGet('node-updates') || {}
    const list = updates[nodeId] || []
    if (list.length === 0) return false
    const readTime = persistGet(`node-update-read-${nodeId}`)
    if (!readTime) return true
    return list.some(u => u.time > parseInt(readTime))
  }
  const markUpdatesRead = (nodeId) => {
    persistSet(`node-update-read-${nodeId}`, String(Date.now()))
  }

  const allNodes = ROADMAP_PHASES.flatMap((p) => p.nodes)
  const doneCount = allNodes.filter((n) => getNodeStatus(n.id) === 'done').length
  const totalCount = allNodes.length
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  const isActive = (id) => activeNode === id

  // ---- 折叠窄轨（64px，图标导航） ----
  if (collapsed) {
    const flatIcons = []
    for (const sec of NAV_SECTIONS) {
      if (sec.items.length === 1) flatIcons.push({ id: sec.items[0].id, icon: sec.items[0].icon, label: sec.items[0].label })
      else sec.items.forEach((it) => flatIcons.push({ id: it.id, icon: it.icon, label: it.label }))
    }
    return (
      <aside className="sticky top-0 hidden h-screen w-16 flex-shrink-0 flex-col items-center border-r border-workspace-border bg-workspace-surface py-3 lg:flex">
        <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-workspace-primary text-sm font-bold text-white">K</div>
        <div className="flex-1 w-full space-y-1 overflow-y-auto px-2">
          {flatIcons.map((it) => {
            const Icon = it.icon
            return (
              <button
                key={it.id}
                onClick={() => onNodeSelect(it.id)}
                title={it.label}
                className={`relative flex h-9 w-full items-center justify-center rounded-md ${isActive(it.id) ? 'bg-workspace-primary-soft text-workspace-primary' : 'text-workspace-text-secondary hover:bg-workspace-surface-subtle'}`}
              >
                {isActive(it.id) && <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded bg-workspace-primary" />}
                <Icon className="h-4 w-4" />
              </button>
            )
          })}
        </div>
        <label className="mt-2 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-workspace-text-secondary hover:bg-workspace-surface-subtle" title="上传数据">
          <Upload className="h-4 w-4" />
          <input type="file" accept="*" className="hidden" disabled={loading} onChange={handleFileChange} />
        </label>
      </aside>
    )
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-[232px] flex-shrink-0 flex-col border-r border-workspace-border bg-workspace-surface lg:flex">
      {/* 品牌区（56-64px） */}
      <div className="flex h-16 flex-shrink-0 items-center gap-2.5 border-b border-workspace-border px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-workspace-primary text-sm font-bold text-white">K</div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-workspace-text">Kuajing Workspace</p>
          <p className="truncate text-xs text-workspace-text-tertiary">FYZSXNB 跨境运营</p>
        </div>
      </div>

      {/* 业务模块主导航 */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {NAV_SECTIONS.map((section) => {
          const hasChildren = section.items.length > 1
          const expanded = expandedSections[section.id]
          if (!hasChildren) {
            const item = section.items[0]
            const Icon = item.icon
            return (
              <button
                key={section.id}
                onClick={() => onNodeSelect(item.id)}
                className={`relative mb-0.5 flex h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors ${isActive(item.id) ? 'bg-workspace-primary-soft font-semibold text-workspace-primary' : 'text-workspace-text hover:bg-workspace-surface-subtle'}`}
              >
                {isActive(item.id) && <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded bg-workspace-primary" />}
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            )
          }
          const SectionIcon = section.icon
          return (
            <div key={section.id} className="mb-0.5">
              <button
                onClick={() => toggleSection(section.id)}
                className="flex h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium text-workspace-text transition-colors hover:bg-workspace-surface-subtle"
              >
                <SectionIcon className="h-4 w-4 flex-shrink-0 text-workspace-text-secondary" />
                <span className="flex-1 truncate text-left">{section.label}</span>
                {expanded ? <ChevronDown className="h-3.5 w-3.5 text-workspace-text-tertiary" /> : <ChevronRight className="h-3.5 w-3.5 text-workspace-text-tertiary" />}
              </button>
              {expanded && (
                <div className="ml-3 border-l border-workspace-border pl-1">
                  {section.items.map((item) => {
                    const Icon = item.icon
                    return (
                      <button
                        key={item.id}
                        onClick={() => onNodeSelect(item.id)}
                        className={`relative mb-0.5 flex h-9 w-full items-center gap-2 rounded-md px-2 text-[13px] transition-colors ${isActive(item.id) ? 'bg-workspace-primary-soft font-medium text-workspace-primary' : 'text-workspace-text-secondary hover:bg-workspace-surface-subtle'}`}
                      >
                        {isActive(item.id) && <span className="absolute left-0 top-1/2 h-3.5 w-[2px] -translate-y-1/2 rounded bg-workspace-primary" />}
                        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* 底部块一：数据源 */}
      <div className="flex-shrink-0 border-t border-workspace-border px-2 py-2">
        <button
          onClick={() => setShowDataPanel(!showDataPanel)}
          className="flex h-9 w-full items-center justify-between rounded-lg px-2.5 text-[13px] text-workspace-text-secondary hover:bg-workspace-surface-subtle"
        >
          <span className="flex items-center gap-2.5"><FolderOpen className="h-4 w-4" /> 数据源</span>
          {showDataPanel ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        {showDataPanel && (
          <div className="mt-1 space-y-2 px-1">
            <div
              className={`border-2 border-dashed rounded-md p-2.5 text-center cursor-pointer transition-all ${loading ? 'border-workspace-primary bg-workspace-primary-soft' : 'border-workspace-border hover:border-workspace-primary hover:bg-workspace-surface-subtle'}`}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
              onDrop={handleDrop}
              onClick={() => !loading && fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" accept="*" className="hidden" onChange={handleFileChange} disabled={loading} />
              {loading ? (
                <div className="flex items-center justify-center gap-1"><Loader2 className="h-4 w-4 animate-spin text-workspace-primary" /><span className="text-xs text-workspace-text-secondary">解析中...</span></div>
              ) : (
                <div className="flex items-center justify-center gap-1"><Upload className="h-3.5 w-3.5 text-workspace-primary" /><span className="text-xs">上传数据</span></div>
              )}
            </div>
            {availableFiles.length > 0 && (
              <div className="max-h-24 space-y-0.5 overflow-y-auto">
                {availableFiles.map((f, i) => (
                  <button key={i} onClick={() => handleLoadRemote(f.name)} disabled={loadingFiles} className="group flex w-full items-center gap-1.5 rounded px-2 py-1 text-left hover:bg-workspace-surface-subtle disabled:opacity-50">
                    <FileSpreadsheet className="h-3.5 w-3.5 flex-shrink-0 text-workspace-success" />
                    <p className="truncate text-xs font-medium text-workspace-text group-hover:text-workspace-primary">{f.name}</p>
                  </button>
                ))}
              </div>
            )}
            {data && !error && (
              <div className="flex items-center gap-1 rounded bg-workspace-success-soft p-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-workspace-success" />
                <span className="text-xs text-workspace-success">已加载 {data.length} 条</span>
              </div>
            )}
            {error && <p className="px-1 text-xs text-workspace-danger">{error}</p>}
          </div>
        )}
      </div>

      {/* 底部块二：项目执行进度（原 36 节点工作流 checklist，入口不丢失） */}
      <div className="flex-shrink-0 border-t border-workspace-border px-3 py-2.5">
        <button
          onClick={() => setShowProgress(!showProgress)}
          className="flex w-full items-center justify-between text-[13px] text-workspace-text"
        >
          <span className="flex items-center gap-2"><GitBranch className="h-4 w-4 text-workspace-text-secondary" /> 项目执行进度</span>
          <span className="text-xs text-workspace-text-secondary">{doneCount}/{totalCount}</span>
        </button>
        <div className="mt-2 h-1.5 rounded-full bg-workspace-surface-subtle">
          <div className="h-full rounded-full bg-workspace-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        {showProgress && (
          <div className="mt-2 max-h-64 space-y-0.5 overflow-y-auto">
            {ROADMAP_PHASES.map((phase) => {
              const phaseDone = phase.nodes.filter(n => getNodeStatus(n.id) === 'done').length
              const expanded = expandedPhases[phase.id]
              return (
                <div key={phase.id}>
                  <button
                    onClick={() => togglePhase(phase.id)}
                    className="flex h-8 w-full items-center gap-1.5 rounded px-1.5 text-xs hover:bg-workspace-surface-subtle"
                  >
                    <span>{expanded ? <ChevronDown className="h-3 w-3 text-gray-400" /> : <ChevronRight className="h-3 w-3 text-gray-400" />}</span>
                    <span className="flex-1 truncate text-left font-medium text-workspace-text">{stripEmoji(phase.title)}</span>
                    <span className="text-[11px] text-workspace-text-secondary">{phaseDone}/{phase.nodes.length}</span>
                  </button>
                  {expanded && (
                    <div className="ml-3 space-y-0.5 border-l border-workspace-border pl-1.5">
                      {phase.nodes.map((node) => {
                        const status = getNodeStatus(node.id)
                        const hasUpdate = hasUnreadUpdate(node.id)
                        return (
                          <button
                            key={node.id}
                            onClick={() => { onNodeSelect(node.id); markUpdatesRead(node.id) }}
                            className={`flex h-7 w-full items-center gap-1.5 rounded px-1.5 text-xs text-left ${isActive(node.id) ? 'bg-workspace-primary/10 font-medium text-workspace-primary' : 'text-workspace-text hover:bg-workspace-surface-subtle'}`}
                          >
                            <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${status === 'done' ? 'bg-workspace-success-soft0' : status === 'in_progress' ? 'bg-workspace-warning' : 'bg-workspace-border-strong'}`} />
                            <span className="flex-1 truncate">{node.title}</span>
                            {hasUpdate && (
                              <span className="relative flex-shrink-0">
                                <Info className="h-3 w-3 text-workspace-primary" />
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}
