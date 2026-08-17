/**
 * t6/ProjectListPage.jsx — SKU 项目列表（T6-1）
 * 项目卡片：编号/名称/lifecycleStatus/stage/进度 N/36/立项快照(Score+Decision+Context)/下一步。
 * 生命周期动作（启动/暂停/恢复/归档/淘汰）→ DecisionLog 留痕；PAUSED 恢复保留原 stage。
 */
import { useMemo, useState } from 'react'
import { Play, Pause, RotateCcw, Archive, Ban } from 'lucide-react'
import { listProjects, getSnapshot, setProjectLifecycle, projectProgress } from '../../utils/t6/t6Store'
import Surface from '../ui/Surface'
import PageHeader from '../ui/PageHeader'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import EmptyState from '../ui/EmptyState'
import ScoreCell from '../scoring/ScoreCell'
import DecisionBadge from '../scoring/DecisionBadge'
import ContextBadge from '../scoring/ContextBadge'

const LIFECYCLE_TONE = {
  DRAFT: 'neutral', ACTIVE: 'success', PAUSED: 'warning', ARCHIVED: 'neutral', KILLED: 'danger',
}
const LIFECYCLE_ZH = { DRAFT: '草稿', ACTIVE: '进行中', PAUSED: '暂缓', ARCHIVED: '已归档', KILLED: '已淘汰' }
const STAGE_ZH = {
  PIPELINE: '候选观察', RESEARCH: '市场调研', COSTING: '成本核算', SAMPLING: '样品阶段',
  COMPLIANCE: '合规认证', PRODUCTION: '生产物流', LAUNCH: '上架启动', OPERATIONS: '运营放量', REVIEW: '复盘迭代',
}

export default function ProjectListPage() {
  const [tick, setTick] = useState(0)
  const [notice, setNotice] = useState('')

  const projects = useMemo(() => {
    void tick
    return [...listProjects()].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
  }, [tick])

  const act = (project, status, label) => {
    const reason = window.prompt(`${label}原因（写入决策日志，建议填写）:`) || ''
    try {
      setProjectLifecycle(project.id, status, reason || label)
      setNotice(`${project.projectCode} → ${LIFECYCLE_ZH[status]}`)
      setTick((t) => t + 1)
    } catch (e) {
      setNotice(e.message || String(e))
      setTick((t) => t + 1)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="SKU 项目"
        subtitle="已决定研究/开发的产品现在做到哪里"
        actions={notice ? <span className="text-xs text-workspace-text-secondary">{notice}</span> : undefined}
      />
      {projects.length === 0 ? (
        <Surface>
          <EmptyState title="还没有 SKU 项目" description="到「候选池」对候选商品点击 [创建项目]，或到「选品评分」Drawer 一键立项" />
        </Surface>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {projects.map((project) => {
            const snap = project.source.creationSnapshotId ? getSnapshot(project.source.creationSnapshotId) : null
            const score = snap?.scoreResult
            const progress = projectProgress(project)
            const nextNodeId = project.workflow.states.find((s) => s.status !== 'done' && s.status !== 'skipped')
            return (
              <Surface key={project.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-xs font-medium text-workspace-text-tertiary">{project.projectCode}</span>
                      <Badge tone={LIFECYCLE_TONE[project.lifecycleStatus] || 'neutral'}>{LIFECYCLE_ZH[project.lifecycleStatus] || project.lifecycleStatus}</Badge>
                    </div>
                    <h3 className="mt-1 truncate text-sm font-semibold text-workspace-text" title={project.name}>{project.name}</h3>
                    <div className="mt-0.5 text-xs text-workspace-text-secondary">
                      当前阶段：{STAGE_ZH[project.stage] || project.stage}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    {project.lifecycleStatus === 'DRAFT' && (
                      <Button variant="primary" size="sm" onClick={() => act(project, 'ACTIVE', '启动项目')}><Play className="h-3.5 w-3.5" /> 启动</Button>
                    )}
                    {project.lifecycleStatus === 'ACTIVE' && (
                      <Button variant="secondary" size="sm" onClick={() => act(project, 'PAUSED', '暂停项目')}><Pause className="h-3.5 w-3.5" /> 暂停</Button>
                    )}
                    {project.lifecycleStatus === 'PAUSED' && (
                      <Button variant="secondary" size="sm" onClick={() => act(project, 'ACTIVE', '恢复项目')}><RotateCcw className="h-3.5 w-3.5" /> 恢复</Button>
                    )}
                    {['DRAFT', 'ACTIVE', 'PAUSED'].includes(project.lifecycleStatus) && (
                      <Button variant="ghost" size="sm" onClick={() => act(project, 'ARCHIVED', '归档项目')}><Archive className="h-3.5 w-3.5" /></Button>
                    )}
                    {project.lifecycleStatus !== 'KILLED' && (
                      <Button variant="ghost" size="sm" onClick={() => act(project, 'KILLED', '淘汰项目')}><Ban className="h-3.5 w-3.5" /></Button>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-workspace-surface-subtle">
                    <div className="h-full rounded-full bg-workspace-primary" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
                  </div>
                  <span className="tabular-nums text-xs text-workspace-text-secondary">{progress.done} / {progress.total}</span>
                </div>

                {score && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px]">
                    <ScoreCell score={score.totalScore} grade={score.grade} tentative={score.gradeTentative} />
                    <DecisionBadge status={score.decision.status} action={score.decision.action} withAction />
                    <ContextBadge context={score.context} />
                  </div>
                )}

                <div className="mt-3 border-t border-workspace-border pt-2.5 text-xs text-workspace-text-secondary">
                  下一步：{nextNodeId ? nextNodeId.nodeId : '全部完成'}
                  {snap && <span className="ml-2 text-workspace-text-tertiary">立项快照 {new Date(snap.createdAt).toLocaleDateString('zh-CN')} · 规则 {snap.versions?.rulesVersion}</span>}
                </div>
              </Surface>
            )
          })}
        </div>
      )}
    </div>
  )
}
