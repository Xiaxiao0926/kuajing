/**
 * workspace/WorkspaceTopbar.jsx — 工作台顶栏（编排层）
 * 项目状态条：项目/市场/当前阶段/进度/最近更新 + [更新数据][项目进度]。
 * 数据全部来自 App 传入（nodeStatuses / ROADMAP_PHASES），本组件不做业务计算。
 */
import { Upload, GitBranch, PanelLeft, PanelLeftClose } from 'lucide-react'
import { useRef } from 'react'
import { ROADMAP_PHASES } from '../../data/roadmap'

const stripEmoji = (s) => String(s || '').replace(/^[^\u4e00-\u9fa5A-Za-z]+/, '').trim()

export default function WorkspaceTopbar({
  nodeStatuses,
  lastUpdatedAt,
  loading,
  collapsed,
  onToggleCollapse,
  onOpenProgress,
  onUpload,
}) {
  const fileInputRef = useRef(null)
  const allNodes = ROADMAP_PHASES.flatMap((p) => p.nodes)
  const done = allNodes.filter((n) => (nodeStatuses?.[n.id] || 'pending') === 'done').length
  const total = allNodes.length
  // 当前阶段 = 第一个还有未完成节点的阶段
  const currentPhase = ROADMAP_PHASES.find((p) => p.nodes.some((n) => (nodeStatuses?.[n.id] || 'pending') !== 'done'))
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  const handleFileChange = (e) => {
    const files = e.target.files
    if (files.length > 0) onUpload(files[0])
  }

  return (
    <div className="flex h-[60px] items-center gap-3 border-b border-workspace-border bg-workspace-surface px-3 lg:px-5">
      <button
        onClick={onToggleCollapse}
        title={collapsed ? '展开侧栏' : '收起侧栏'}
        className="hidden h-8 w-8 items-center justify-center rounded-md text-workspace-text-secondary hover:bg-workspace-surface-subtle lg:flex"
      >
        {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </button>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] font-semibold text-workspace-text">坪山综合保税项目</span>
          <span className="hidden rounded bg-workspace-surface-subtle px-1.5 py-0.5 text-xs text-workspace-text-secondary sm:inline">俄罗斯 · Ozon / Wildberries</span>
        </div>
        <div className="text-xs text-workspace-text-tertiary">Workspace</div>
      </div>

      <div className="mx-1 hidden h-6 w-px bg-workspace-border md:block" />

      <div className="hidden items-center gap-6 md:flex">
        <div className="flex flex-col">
          <span className="text-xs text-workspace-text-tertiary">当前阶段</span>
          <span className="text-[13px] font-medium text-workspace-text">{currentPhase ? stripEmoji(currentPhase.title) : '—'}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-workspace-text-tertiary">进度</span>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-24 rounded-full bg-workspace-surface-subtle">
              <div className="h-full rounded-full bg-workspace-primary" style={{ width: `${pct}%` }} />
            </div>
            <span className="tabular-nums text-[13px] font-medium text-workspace-text">{done} / {total}</span>
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-workspace-text-tertiary">最近更新</span>
          <span className="tabular-nums text-[13px] font-medium text-workspace-text">{lastUpdatedAt || '—'}</span>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-workspace-border-strong bg-workspace-surface px-3 text-[13px] font-medium text-workspace-text hover:bg-workspace-surface-subtle">
          <Upload className="h-3.5 w-3.5" />
          {loading ? '解析中…' : '更新数据'}
          <input ref={fileInputRef} type="file" accept="*" className="hidden" disabled={loading} onChange={handleFileChange} />
        </label>
        <button
          onClick={onOpenProgress}
          className="flex h-8 items-center gap-1.5 rounded-md bg-workspace-primary px-3 text-[13px] font-medium text-white hover:bg-[#2a50d6]"
        >
          <GitBranch className="h-3.5 w-3.5" />
          项目进度
        </button>
      </div>
    </div>
  )
}
