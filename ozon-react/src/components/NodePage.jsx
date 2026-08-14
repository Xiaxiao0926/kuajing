/**
 * NodePage.jsx — 流程节点页面包装（T5-5 Legacy Harmonization）
 * 展示层统一：白 Surface + 语义色只用于状态图标/文字；不用 emoji、不用整块彩色背景。
 * 状态流转逻辑零变化（pending/active/done）。
 */
import { CheckCircle2, Circle, Zap } from 'lucide-react'
import { NODE_DETAILS, ROADMAP_PHASES } from '../data/roadmap'
import Surface from './ui/Surface'
import SectionHeader from './ui/SectionHeader'
import Button from './ui/Button'

const stripEmoji = (s) => String(s || '').replace(/^[^\u4e00-\u9fa5A-Za-z]+/, '').trim()

export default function NodePage({ nodeId, status, onStatusChange, children, wide }) {
  const detail = NODE_DETAILS[nodeId]
  const phase = ROADMAP_PHASES.find(p => p.nodes.some(n => n.id === nodeId))

  if (!detail) return null

  const checklistMeta = {
    active: { title: '执行清单', tone: 'warning' },
    pending: { title: '待办事项', tone: 'neutral' },
    done: { title: '已完成事项', tone: 'success' },
  }[status] || { title: '待办事项', tone: 'neutral' }

  return (
    <div className={wide ? 'max-w-full' : 'mx-auto max-w-5xl'}>
      <div className="mb-5">
        <div className="mb-1 text-xs text-workspace-text-tertiary">{phase ? stripEmoji(phase.title) : ''}</div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[22px] font-semibold tracking-[-0.01em] text-workspace-text">{detail.title}</h2>
          <div className="flex items-center gap-2">
            {status === 'done' ? (
              <Button variant="secondary" size="sm" onClick={() => onStatusChange(nodeId, 'pending')}>
                <CheckCircle2 className="h-3.5 w-3.5 text-workspace-success" /> 已完成
              </Button>
            ) : status === 'active' ? (
              <>
                <Button variant="primary" size="sm" onClick={() => onStatusChange(nodeId, 'done')}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> 标记完成
                </Button>
                <Button variant="secondary" size="sm" onClick={() => onStatusChange(nodeId, 'pending')}>取消</Button>
              </>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => onStatusChange(nodeId, 'active')}>
                <Zap className="h-3.5 w-3.5 text-workspace-warning" /> 开始执行
              </Button>
            )}
          </div>
        </div>
        <p className="mt-1 text-[13px] text-workspace-text-secondary">{detail.desc}</p>
      </div>

      {detail.checklist && (
        <Surface className="mb-5 p-5">
          <SectionHeader title={checklistMeta.title} />
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {detail.checklist.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] leading-snug text-workspace-text">
                {status === 'done' ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-workspace-success" />
                ) : status === 'active' ? (
                  <Circle className="mt-0.5 h-4 w-4 flex-shrink-0 text-workspace-warning" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 flex-shrink-0 text-workspace-border-strong" />
                )}
                {item}
              </li>
            ))}
          </ul>
        </Surface>
      )}

      {children}
    </div>
  )
}
