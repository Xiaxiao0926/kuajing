/**
 * t6/ProjectListPage.jsx — SKU 项目列表（T6-1，T6-2A 简化）
 * 项目卡片：编号/名称/lifecycleStatus/stage/进度 N/36/立项快照(Score+Decision+Context)/下一步。
 * 整卡可点击 → 打开项目详情（T6-2A：生命周期动作收敛到详情页，不再在列表内嵌按钮/窗口输入）。
 */
import { useMemo } from 'react'
import { listProjects, getSnapshot, projectProgress } from '../../utils/t6/t6Store'
import Surface from '../ui/Surface'
import PageHeader from '../ui/PageHeader'
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

export default function ProjectListPage({ onOpenProject }) {
  const projects = useMemo(
    () => [...listProjects()].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))),
    [],
  )

  return (
    <div className="space-y-4">
      <PageHeader title="SKU 项目" subtitle="已决定研究/开发的产品现在做到哪里" />
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
              <Surface
                key={project.id}
                className="cursor-pointer p-5 transition-colors hover:border-workspace-primary"
                onClick={() => onOpenProject?.(project.id)}
              >
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
