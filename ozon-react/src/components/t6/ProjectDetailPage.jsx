/**
 * t6/ProjectDetailPage.jsx — SKU 项目详情 Workspace（T6-2A）
 * 四基础能力：每项目独立 Workflow（右侧 36 节点 Timeline）/ DecisionLog Timeline /
 * Stage Gate（纯函数建议 + 人工推进，RED 强制推进必填理由）/ 生命周期动作。
 * 未开发域显示明确占位（"供应商管理将在 T7 接入"），不做半成品 CRUD。
 */
import { useMemo, useState } from 'react'
import {
  Play, Pause, RotateCcw, Archive, Ban, CheckCircle2, AlertTriangle, XCircle,
  MinusCircle, ArrowLeft, GitBranch, FileClock,
} from 'lucide-react'
import {
  getProject, getSnapshot, getLog, setProjectLifecycle, setProjectStage,
  setWorkflowNode, appendLog, projectProgress,
} from '../../utils/t6/t6Store'
import { evaluateProjectGate, GATE_VERDICTS, GATE_RESULTS } from '../../utils/t6/gateEngine'
import { getWorkflowTemplate } from '../../data/workflowTemplates/registry'
import Surface from '../ui/Surface'
import PageHeader from '../ui/PageHeader'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import Select from '../ui/Select'
import EmptyState from '../ui/EmptyState'
import ScoreCell from '../scoring/ScoreCell'
import DecisionBadge from '../scoring/DecisionBadge'
import ContextBadge from '../scoring/ContextBadge'

const LIFECYCLE_TONE = { DRAFT: 'neutral', ACTIVE: 'success', PAUSED: 'warning', ARCHIVED: 'neutral', KILLED: 'danger' }
const LIFECYCLE_ZH = { DRAFT: '草稿', ACTIVE: '进行中', PAUSED: '暂缓', ARCHIVED: '已归档', KILLED: '已淘汰' }
const STAGE_ZH = {
  PIPELINE: '候选观察', RESEARCH: '市场调研', COSTING: '成本核算', SAMPLING: '样品阶段',
  COMPLIANCE: '合规认证', PRODUCTION: '生产物流', LAUNCH: '上架启动', OPERATIONS: '运营放量', REVIEW: '复盘迭代',
}
const STAGES = ['PIPELINE', 'RESEARCH', 'COSTING', 'SAMPLING', 'COMPLIANCE', 'PRODUCTION', 'LAUNCH', 'OPERATIONS', 'REVIEW']
const NODE_STATUS_ZH = { pending: '待办', active: '进行中', done: '完成', skipped: '跳过' }
const LOG_KIND_ZH = {
  status_change: '状态变更', stage_change: '阶段变更', gate_override: '强制推进',
  snapshot_create: '评分快照', project_create: '一键立项', note: '备注',
}

const PLACEHOLDERS = {
  product: '产品定义域将在后续版本接入',
  suppliers: '供应商管理将在 T7 接入',
  costing: '成本场景与 Ozon/WB 联动将在 T6-2B 接入',
  compliance: '合规数据域将在后续版本接入',
  operations: '订单 / 库存 / 广告数据将在 T8 接入',
}

export default function ProjectDetailPage({ projectId, onBack }) {
  const [tick, setTick] = useState(0)
  const [tab, setTab] = useState('overview')
  const [targetStage, setTargetStage] = useState('RESEARCH')
  const [overrideReason, setOverrideReason] = useState('')
  const [notice, setNotice] = useState('')

  const project = useMemo(() => { void tick; return projectId ? getProject(projectId) : null }, [projectId, tick])
  const snapshot = useMemo(() => (project?.source?.creationSnapshotId ? getSnapshot(project.source.creationSnapshotId) : null), [project])
  const template = useMemo(() => getWorkflowTemplate(project?.workflow?.templateVersion || 'roadmap-v1'), [project])
  const logs = useMemo(() => {
    if (!project) return []
    return (project.decisionLog || [])
      .map((id) => getLog(id))
      .filter(Boolean)
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
  }, [project])

  if (!project) {
    return <EmptyState title="项目不存在" description="项目可能已被删除，请返回 SKU 项目列表" />
  }

  const score = snapshot?.scoreResult
  const progress = projectProgress(project)
  const refresh = (msg) => { if (msg) setNotice(msg); setTick((t) => t + 1) }

  const lifecycleAction = (status, label) => {
    try {
      setProjectLifecycle(project.id, status, label)
      refresh(`${label}：已写入决策日志`)
    } catch (e) {
      refresh(e.message || String(e))
    }
  }

  const gate = evaluateProjectGate(project, targetStage, {
    availableModules: {}, // T6-2A：所有依赖域尚未实现
    snapshot: snapshot ? { status: snapshot.scoreResult?.status || [] } : null,
  })

  const advanceStage = () => {
    const reason = overrideReason.trim()
    if (gate.verdict === GATE_VERDICTS.RED && !reason) {
      refresh('强制推进必须填写理由（写入决策日志）')
      return
    }
    if (targetStage === project.stage) { refresh('目标阶段与当前阶段相同'); return }
    try {
      if (gate.verdict === GATE_VERDICTS.RED) {
        appendLog({ subjectType: 'project', subjectId: project.id, projectId: project.id, kind: 'gate_override', from: project.stage, to: targetStage, reason })
      }
      setProjectStage(project.id, targetStage, reason || `Gate ${gate.verdict} 推进`)
      setOverrideReason('')
      refresh(`阶段已推进 → ${STAGE_ZH[targetStage] || targetStage}`)
    } catch (e) {
      refresh(e.message || String(e))
    }
  }

  const setNode = (nodeId, status, note) => {
    try {
      setWorkflowNode(project.id, nodeId, status, note || '')
      refresh(null)
    } catch (e) {
      refresh(e.message || String(e))
    }
  }

  const gateTone = { GREEN: 'success', YELLOW: 'warning', RED: 'danger', NOT_EVALUATED: 'neutral' }[gate.verdict]
  const gateZh = { GREEN: '可以推进', YELLOW: '可以推进，但存在风险', RED: '不建议推进', NOT_EVALUATED: '依赖模块尚未实现' }[gate.verdict]

  return (
    <div className="space-y-4">
      <PageHeader
        title={project.name}
        subtitle={`${project.projectCode} · ${project.marketCode}`}
        actions={
          <>
            {onBack && (
              <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-3.5 w-3.5" /> 返回列表</Button>
            )}
            {project.lifecycleStatus === 'DRAFT' && <Button variant="primary" size="sm" onClick={() => lifecycleAction('ACTIVE', '启动项目')}><Play className="h-3.5 w-3.5" /> 启动</Button>}
            {project.lifecycleStatus === 'ACTIVE' && <Button variant="secondary" size="sm" onClick={() => lifecycleAction('PAUSED', '暂停项目')}><Pause className="h-3.5 w-3.5" /> 暂停</Button>}
            {project.lifecycleStatus === 'PAUSED' && <Button variant="secondary" size="sm" onClick={() => lifecycleAction('ACTIVE', '恢复项目')}><RotateCcw className="h-3.5 w-3.5" /> 恢复</Button>}
            {['DRAFT', 'ACTIVE', 'PAUSED'].includes(project.lifecycleStatus) && <Button variant="ghost" size="sm" onClick={() => lifecycleAction('ARCHIVED', '归档项目')}><Archive className="h-3.5 w-3.5" /></Button>}
            {project.lifecycleStatus !== 'KILLED' && <Button variant="ghost" size="sm" onClick={() => lifecycleAction('KILLED', '淘汰项目')}><Ban className="h-3.5 w-3.5" /></Button>}
          </>
        }
      />

      {/* 状态与立项快照摘要 */}
      <Surface className="flex flex-wrap items-center gap-4 p-4">
        <Badge tone={LIFECYCLE_TONE[project.lifecycleStatus]}>{LIFECYCLE_ZH[project.lifecycleStatus]}</Badge>
        <Badge tone="primary">{STAGE_ZH[project.stage] || project.stage}</Badge>
        {score && (
          <span className="flex items-center gap-2 text-[13px] text-workspace-text-secondary">
            立项评分 <ScoreCell score={score.totalScore} grade={score.grade} tentative={score.gradeTentative} />
            <DecisionBadge status={score.decision.status} action={score.decision.action} withAction />
            <ContextBadge context={score.context} />
          </span>
        )}
        <span className="text-xs text-workspace-text-tertiary">
          立项时间 {snapshot ? new Date(snapshot.createdAt).toLocaleString('zh-CN') : '—'} · 规则 {snapshot?.versions?.rulesVersion || '—'}
        </span>
      </Surface>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        {/* 主内容：六 Tab */}
        <Surface>
          <div className="flex flex-wrap gap-1 border-b border-workspace-border px-2 pt-2">
            {[['overview', '概览'], ['product', '产品'], ['suppliers', '供应链'], ['costing', '成本与物流'], ['compliance', '合规'], ['operations', '运营']].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`rounded-t-md px-3 py-2 text-[13px] font-medium transition-colors ${tab === id ? 'border-b-2 border-workspace-primary text-workspace-primary' : 'text-workspace-text-secondary hover:text-workspace-text'}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {tab === 'overview' && (
              <div className="space-y-6">
                {/* Stage Gate */}
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-workspace-text">
                    <GitBranch className="h-4 w-4 text-workspace-text-secondary" /> 阶段推进（Gate 仅建议）
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={targetStage}
                      onChange={setTargetStage}
                      options={STAGES.map((s) => [s, STAGE_ZH[s] || s])}
                    />
                    <Badge tone={gateTone}>{gateZh}</Badge>
                    <Button
                      variant={gate.verdict === GATE_VERDICTS.RED ? 'danger' : 'primary'}
                      size="sm"
                      disabled={targetStage === project.stage}
                      onClick={advanceStage}
                    >
                      {gate.verdict === GATE_VERDICTS.RED ? '强制推进（需理由）' : '推进到该阶段'}
                    </Button>
                  </div>
                  {gate.verdict === GATE_VERDICTS.RED && (
                    <input
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="强制推进理由（必填，写入决策日志）"
                      className="mt-2 h-8 w-full max-w-md rounded-md border border-workspace-border-strong bg-workspace-surface px-2 text-[13px] text-workspace-text"
                    />
                  )}
                  <ul className="mt-3 space-y-1.5">
                    {gate.checks.map((c) => (
                      <li key={c.id} className="flex items-start gap-2 text-[13px]">
                        {c.result === GATE_RESULTS.PASS && <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-workspace-success" />}
                        {c.result === GATE_RESULTS.WARN && <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-workspace-warning" />}
                        {c.result === GATE_RESULTS.FAIL && <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-workspace-danger" />}
                        {c.result === GATE_RESULTS.NOT_EVALUATED && <MinusCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-workspace-text-tertiary" />}
                        <span className="text-workspace-text">{c.label}</span>
                        {c.message && <span className="text-xs text-workspace-text-tertiary">· {c.message}</span>}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* DecisionLog Timeline */}
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-workspace-text">
                    <FileClock className="h-4 w-4 text-workspace-text-secondary" /> 决策日志
                  </div>
                  {logs.length === 0 ? (
                    <div className="text-[13px] text-workspace-text-tertiary">暂无记录</div>
                  ) : (
                    <ul className="space-y-2 border-l border-workspace-border pl-4">
                      {logs.map((l) => (
                        <li key={l.id} className="relative text-[13px]">
                          <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-workspace-primary" />
                          <div className="text-xs text-workspace-text-tertiary">
                            {new Date(l.at).toLocaleString('zh-CN')} · {LOG_KIND_ZH[l.kind] || l.kind}
                            {l.from || l.to ? ` · ${l.from || '∅'} → ${l.to}` : ''}
                          </div>
                          {l.reason && <div className="text-workspace-text">{l.reason}</div>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {notice && <div className="text-xs text-workspace-text-secondary">{notice}</div>}
              </div>
            )}
            {tab !== 'overview' && (
              <div className="py-8 text-center">
                <div className="text-sm font-medium text-workspace-text">{STAGE_ZH[project.stage]}</div>
                <div className="mt-2 text-[13px] text-workspace-text-tertiary">{PLACEHOLDERS[tab]}</div>
              </div>
            )}
          </div>
        </Surface>

        {/* 右侧：36 节点 Workflow Timeline（每项目独立） */}
        <Surface className="max-h-[calc(100vh-260px)] overflow-y-auto p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold text-workspace-text">
              <GitBranch className="h-4 w-4 text-workspace-text-secondary" /> 项目进度
            </span>
            <span className="tabular-nums text-xs text-workspace-text-secondary">{progress.done} / {progress.total}</span>
          </div>
          <div className="mb-3 h-1.5 rounded-full bg-workspace-surface-subtle">
            <div className="h-full rounded-full bg-workspace-primary" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
          </div>
          {template?.phases.map((phase) => {
            const nodes = template.nodes.filter((n) => n.phaseId === phase.phaseId)
            return (
              <div key={phase.phaseId} className="mb-3">
                <div className="text-xs font-semibold text-workspace-text-tertiary">{phase.title}</div>
                <ul className="mt-1 space-y-0.5">
                  {nodes.map((n) => {
                    const state = project.workflow.states.find((s) => s.nodeId === n.nodeId) || { status: 'pending', note: '' }
                    return (
                      <li key={n.nodeId} className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-workspace-surface-subtle">
                        <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${state.status === 'done' ? 'bg-workspace-success' : state.status === 'active' ? 'bg-workspace-warning' : state.status === 'skipped' ? 'bg-workspace-text-tertiary' : 'bg-workspace-border-strong'}`} />
                        <span className={`flex-1 truncate text-[13px] ${state.status === 'done' ? 'text-workspace-text-secondary' : 'text-workspace-text'}`} title={n.title}>
                          {n.title}
                        </span>
                        <select
                          value={state.status}
                          onChange={(e) => setNode(n.nodeId, e.target.value, state.note)}
                          className="h-6 rounded border border-workspace-border bg-workspace-surface px-1 text-xs text-workspace-text"
                        >
                          {Object.entries(NODE_STATUS_ZH).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                        <input
                          value={state.note || ''}
                          onChange={(e) => setNode(n.nodeId, state.status, e.target.value)}
                          placeholder="备注"
                          className="h-6 w-20 rounded border border-workspace-border bg-workspace-surface px-1 text-xs text-workspace-text"
                        />
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </Surface>
      </div>
    </div>
  )
}
