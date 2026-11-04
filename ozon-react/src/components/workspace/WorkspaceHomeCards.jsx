/**
 * WorkspaceHomeCards.jsx — 工作台首页三个聚合区块（IA 步骤7）
 * 纯展示组件，只编排不计算；数据由 ProgressOverview 只读取数后传入。
 * 契约：禁止调用任何写操作（localStorage 写入 / store mutation）。
 */
import { CheckCircle2, AlertTriangle, Clock, ChevronRight, Inbox, Target } from 'lucide-react'

const STAGE_LABEL = {
  PIPELINE: '管线',
  RESEARCH: '调研',
  COSTING: '成本',
  SAMPLING: '样品',
  COMPLIANCE: '合规',
  PRODUCTION: '生产',
  LAUNCH: '上架',
  OPERATIONS: '运营',
  REVIEW: '复盘',
}

const VERDICT_STYLE = {
  GREEN: { dot: 'bg-green-500', text: 'text-green-700', label: '可推进' },
  YELLOW: { dot: 'bg-amber-500', text: 'text-amber-700', label: '有预警' },
  RED: { dot: 'bg-red-500', text: 'text-red-700', label: '有阻断' },
  NOT_EVALUATED: { dot: 'bg-gray-400', text: 'text-gray-500', label: '未评估' },
  SAME: { dot: 'bg-gray-300', text: 'text-gray-400', label: '当前阶段' },
  BACKWARD: { dot: 'bg-gray-300', text: 'text-gray-400', label: '回退' },
  COMPLETED: { dot: 'bg-blue-500', text: 'text-blue-700', label: '已完结' },
}

function EmptyHint({ icon: Icon, text }) {
  return (
    <div className="flex items-center gap-2 py-3 text-[11px] text-morandi-text-light">
      <Icon className="w-3.5 h-3.5" />
      <span>{text}</span>
    </div>
  )
}

/** 区块1：项目卡点 — ACTIVE 项目的阶段/进度/Gate 概要 */
export function ProjectBlockCard({ projects = [], onOpenProject }) {
  if (!projects || projects.length === 0) {
    return <EmptyHint icon={Inbox} text="暂无进行中项目。候选立项后以 DRAFT 创建，在项目详情启动为「进行中」即显示在此。" />
  }
  return (
    <div className="space-y-2">
      {projects.map((p) => {
        const v = VERDICT_STYLE[p.gateVerdict] || VERDICT_STYLE.NOT_EVALUATED
        return (
          <button
            key={p.id}
            onClick={() => onOpenProject?.(p.id)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-100 hover:border-morandi-primary/30 hover:bg-gray-50/50 transition-colors text-left group"
          >
            <div className="flex flex-col items-center flex-shrink-0">
              <span className={`w-2 h-2 rounded-full ${v.dot}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-morandi-text truncate">{p.name || p.projectCode}</span>
                <span className="text-[9px] text-morandi-text-light flex-shrink-0">{p.projectCode}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 flex-shrink-0">{STAGE_LABEL[p.stage] || '未知阶段'}</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden min-w-[40px]">
                  <div className="h-full bg-morandi-primary rounded-full" style={{ width: `${p.pct}%` }} />
                </div>
                <span className="text-[9px] text-morandi-text-light flex-shrink-0">{p.done}/{p.total}</span>
              </div>
              {p.blockingReasons && p.blockingReasons.length > 0 && (
                <div className="text-[9px] text-red-500 mt-0.5 truncate">阻断：{p.blockingReasons[0]}</div>
              )}
            </div>
            <div className="flex-shrink-0 text-right">
              <span className={`text-[9px] font-medium ${v.text}`}>{v.label}</span>
              <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-morandi-primary mt-0.5" />
            </div>
          </button>
        )
      })}
    </div>
  )
}

/** 区块2：候选预警 — 待调研/待立项计数 + Top N 高分候选 */
export function CandidateAlertCard({ pendingCount = 0, topCandidates = [], onOpenPool }) {
  if (pendingCount === 0 && topCandidates.length === 0) {
    return <EmptyHint icon={Target} text="暂无待处理候选。市场机会中的候选加入候选池后将在此预警。" />
  }
  return (
    <div className="space-y-2">
      {pendingCount > 0 && (
        <button
          onClick={() => onOpenPool?.()}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-amber-50 border border-amber-100 hover:bg-amber-50/70 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[11px] font-medium text-amber-700">待调研 / 待立项</span>
          </div>
          <span className="text-sm font-bold text-amber-700">{pendingCount}</span>
        </button>
      )}
      {topCandidates.length > 0 && (
        <div className="space-y-1">
          <div className="text-[9px] text-morandi-text-light px-1">高分候选 Top {topCandidates.length}</div>
          {topCandidates.map((c) => (
            <button
              key={c.id}
              onClick={() => onOpenPool?.()}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 transition-colors text-left group"
            >
              <span className="text-[9px] font-bold text-morandi-primary w-8 text-right flex-shrink-0">{c.score != null ? c.score : '—'}</span>
              <span className="text-[11px] text-morandi-text truncate group-hover:text-morandi-primary">{c.name}</span>
              <span className="text-[9px] px-1 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">{c.bizStatus}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** 区块3：待办节点 — 各项目 workflow 中 status=active 的节点聚合 */
export function TodoNodeList({ items = [], onOpenProject }) {
  if (!items || items.length === 0) {
    return <EmptyHint icon={Clock} text="暂无进行中节点。在项目详情推进 workflow 节点后，将在此显示。" />
  }
  return (
    <div className="space-y-1">
      {items.map((it, idx) => (
        <button
          key={`${it.projectId}-${it.nodeId}-${idx}`}
          onClick={() => onOpenProject?.(it.projectId)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 transition-colors text-left group"
        >
          <Clock className="w-3 h-3 text-amber-500 flex-shrink-0" />
          <span className="text-[11px] text-morandi-text truncate group-hover:text-morandi-primary flex-1">{it.title}</span>
          <span className="text-[9px] text-morandi-text-light flex-shrink-0">{it.projectCode}</span>
          <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-morandi-primary flex-shrink-0" />
        </button>
      ))}
    </div>
  )
}
