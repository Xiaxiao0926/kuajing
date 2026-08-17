/**
 * t6/ProjectDetailPage.jsx — SKU 项目详情 Workspace（T6-2A + hardening）
 * 四基础能力：每项目独立 Workflow（右侧 36 节点 Timeline，状态变化留日志、备注草稿 onBlur 保存）
 * / DecisionLog Timeline / 路径 Stage Gate（direction SAME/FORWARD/BACKWARD，FORWARD 逐段聚合，
 * BACKWARD 提示回退不执行前向 Gate；YELLOW/RED 推进必填理由，走 stageTransition domain action）
 * / 生命周期动作。未开发域显示明确占位。
 */
import { useMemo, useState } from 'react'
import {
  Play, Pause, RotateCcw, Archive, Ban, CheckCircle2, AlertTriangle, XCircle,
  MinusCircle, ArrowLeft, GitBranch, FileClock,
} from 'lucide-react'
import {
  getProject, getSnapshot, getLog, setProjectLifecycle, setWorkflowNode, projectProgress,
  createCostScenario, getProjectScenarios, setProjectBaselineScenario,
} from '../../utils/t6/t6Store'
import { evaluateProjectGate, GATE_VERDICTS, GATE_RESULTS } from '../../utils/t6/gateEngine'
import { transitionProjectStage } from '../../utils/t6/stageTransition'
import { PROJECT_STAGES, transitionDirection, isValidStage } from '../../utils/t6/stageModel'
import { buildOzonPrefill, buildOzonScenarioPayload, scenarioSummary } from '../../utils/t6/costScenarioAdapter'
import { getWorkflowTemplate } from '../../data/workflowTemplates/registry'
import OzonCalc from '../OzonCalc'
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
const NODE_STATUS_ZH = { pending: '待办', active: '进行中', done: '完成', skipped: '跳过' }
const LOG_KIND_ZH = {
  status_change: '状态变更', stage_change: '阶段变更', gate_override: '强制推进',
  snapshot_create: '评分快照', project_create: '一键立项', workflow_change: '节点变更', note: '备注',
  cost_scenario_create: '成本场景', cost_baseline_change: '基线切换',
}
const PLACEHOLDERS = {
  product: '产品定义域将在后续版本接入',
  suppliers: '供应商管理将在 T7 接入',
  compliance: '合规数据域将在后续版本接入',
  operations: '订单 / 库存 / 广告数据将在 T8 接入',
}

function WorkflowNodeRow({ node, state, onStatusChange, onNoteSave }) {
  const [draft, setDraft] = useState(state.note || '')
  return (
    <li className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-workspace-surface-subtle">
      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${state.status === 'done' ? 'bg-workspace-success' : state.status === 'active' ? 'bg-workspace-warning' : state.status === 'skipped' ? 'bg-workspace-text-tertiary' : 'bg-workspace-border-strong'}`} />
      <span className={`flex-1 truncate text-[13px] ${state.status === 'done' ? 'text-workspace-text-secondary' : 'text-workspace-text'}`} title={node.title}>
        {node.title}
      </span>
      <select
        value={state.status}
        onChange={(e) => onStatusChange(node.nodeId, e.target.value, draft)}
        className="h-6 rounded border border-workspace-border bg-workspace-surface px-1 text-xs text-workspace-text"
      >
        {Object.entries(NODE_STATUS_ZH).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onNoteSave(node.nodeId, draft)}
        placeholder="备注"
        title="备注（失焦保存）"
        className="h-6 w-20 rounded border border-workspace-border bg-workspace-surface px-1 text-xs text-workspace-text"
      />
    </li>
  )
}

export default function ProjectDetailPage({ projectId, onBack }) {
  const [tick, setTick] = useState(0)
  const [tab, setTab] = useState('overview')
  const [targetStage, setTargetStage] = useState('RESEARCH')
  const [reason, setReason] = useState('')
  const [notice, setNotice] = useState('')
  const [ozonContext, setOzonContext] = useState(null) // { prefill } — Ozon 核算面板项目上下文（显式状态，非残余 activeProjectId）
  const [wbContext, setWbContext] = useState(null) // { prefill } — WB 核算面板项目上下文

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
  const scenarios = useMemo(() => (project ? getProjectScenarios(project.id) : []), [project])

  if (!project) return <EmptyState title="项目不存在" description="请返回 SKU 项目列表" />

  const score = snapshot?.scoreResult
  const progress = projectProgress(project)
  const refresh = (msg) => { if (msg) setNotice(msg); setTick((t) => t + 1) }

  const lifecycleAction = (status, label) => {
    try { setProjectLifecycle(project.id, status, label); refresh(`${label}：已写入决策日志`) }
    catch (e) { refresh(e.message || String(e)) }
  }

  const direction = isValidStage(project.stage) && isValidStage(targetStage)
    ? transitionDirection(project.stage, targetStage)
    : 'INVALID'
  const gateDeps = {
    availableModules: {},
    snapshot: snapshot ? { status: snapshot.scoreResult?.status || [] } : null,
    scenarios,
  }
  const gate = direction === 'FORWARD'
    ? evaluateProjectGate(project, targetStage, gateDeps)
    : null

  const gateTone = { GREEN: 'success', YELLOW: 'warning', RED: 'danger', NOT_EVALUATED: 'neutral' }[gate?.verdict]
  const gateZh = {
    GREEN: '可以推进', YELLOW: '可以推进，但存在风险', RED: '不建议推进',
    NOT_EVALUATED: '依赖模块尚未实现（非通过，非失败）',
  }[gate?.verdict]

  const advanceStage = () => {
    try {
      const res = transitionProjectStage({
        projectId: project.id,
        targetStage,
        deps: gateDeps,
        reason,
      })
      setReason('')
      refresh(`${res.direction === 'BACKWARD' ? '已回退到' : '已推进到'} ${STAGE_ZH[targetStage] || targetStage}`)
    } catch (e) {
      refresh(e.message || String(e))
    }
  }

  // T6-2B1：保存 Ozon 核算面板当前方案为不可变成本场景
  const saveOzonScenario = (data) => {
    try {
      const payload = buildOzonScenarioPayload({ project, inputPayload: data.inputPayload, selectedChannelId: data.selectedChannelId, outputPayload: data.outputPayload })
      const sc = createCostScenario({
        projectId: project.id,
        platform: 'OZON',
        name: `${project.projectCode} Ozon rFBS 场景 #${scenarios.length + 1}`,
        sourceSnapshotId: payload.sourceSnapshotId,
        inputPayload: payload.inputPayload,
        resolvedConfig: payload.resolvedConfig,
        outputPayload: payload.outputPayload,
      })
      setOzonContext(null)
      const s = scenarioSummary(sc)
      refresh(`已保存成本场景（${s.channelName}，毛利率 ${s.profitMarginPct}%）`)
    } catch (e) {
      refresh(e.message || String(e))
    }
  }

  const setBaseline = (scenarioId) => {
    try {
      setProjectBaselineScenario(project.id, scenarioId)
      refresh('基线已切换')
    } catch (e) {
      refresh(e.message || String(e))
    }
  }

  // T6-2B2：保存 WB 核算面板当前方案为不可变成本场景（仅测算参考，绝不自动改基线）
  const saveWbScenario = (data) => {
    try {
      const payload = buildWbScenarioPayload({ project, inputPayload: data.inputPayload, tariff: data.tariff, settings: data.settings, outputs: data.outputs })
      const sc = createCostScenario({
        projectId: project.id,
        platform: 'WB',
        name: `${project.projectCode} WB 订单场景 #${scenarios.length + 1}`,
        sourceSnapshotId: payload.sourceSnapshotId,
        inputPayload: payload.inputPayload,
        resolvedConfig: payload.resolvedConfig,
        outputPayload: payload.outputPayload,
      })
      setWbContext(null)
      const s = scenarioSummary(sc)
      refresh(`已保存 WB 成本场景（${s.channelName}，毛利率 ${s.profitMarginPct}%；仅测算参考，基线需人工设置）`)
    } catch (e) {
      refresh(e.message || String(e))
    }
  }

  const setNode = (nodeId, status, note) => {
    try { setWorkflowNode(project.id, nodeId, status, note); refresh(null) }
    catch (e) { refresh(e.message || String(e)) }
  }
  const saveNodeNote = (nodeId, note) => {
    try { setWorkflowNode(project.id, nodeId, project.workflow.states.find((s) => s.nodeId === nodeId)?.status || 'pending', note); refresh(null) }
    catch (e) { refresh(e.message || String(e)) }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={project.name}
        subtitle={`${project.projectCode} · ${project.marketCode}`}
        actions={
          <>
            {onBack && <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-3.5 w-3.5" /> 返回列表</Button>}
            {project.lifecycleStatus === 'DRAFT' && <Button variant="primary" size="sm" onClick={() => lifecycleAction('ACTIVE', '启动项目')}><Play className="h-3.5 w-3.5" /> 启动</Button>}
            {project.lifecycleStatus === 'ACTIVE' && <Button variant="secondary" size="sm" onClick={() => lifecycleAction('PAUSED', '暂停项目')}><Pause className="h-3.5 w-3.5" /> 暂停</Button>}
            {project.lifecycleStatus === 'PAUSED' && <Button variant="secondary" size="sm" onClick={() => lifecycleAction('ACTIVE', '恢复项目')}><RotateCcw className="h-3.5 w-3.5" /> 恢复</Button>}
            {['DRAFT', 'ACTIVE', 'PAUSED'].includes(project.lifecycleStatus) && <Button variant="ghost" size="sm" onClick={() => lifecycleAction('ARCHIVED', '归档项目')}><Archive className="h-3.5 w-3.5" /></Button>}
            {project.lifecycleStatus !== 'KILLED' && <Button variant="ghost" size="sm" onClick={() => lifecycleAction('KILLED', '淘汰项目')}><Ban className="h-3.5 w-3.5" /></Button>}
          </>
        }
      />

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
                {/* Stage Gate（路径 Gate） */}
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-workspace-text">
                    <GitBranch className="h-4 w-4 text-workspace-text-secondary" /> 阶段推进（Gate 仅建议）
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={targetStage} onChange={setTargetStage} options={PROJECT_STAGES.map((s) => [s, STAGE_ZH[s] || s])} />
                    {direction === 'SAME' && <span className="text-xs text-workspace-text-tertiary">已在目标阶段</span>}
                    {direction === 'BACKWARD' && <Badge tone="warning">阶段回退 · 不执行前向 Gate</Badge>}
                    {direction === 'FORWARD' && gate && (
                      <>
                        <Badge tone={gateTone}>{gateZh}</Badge>
                        {gate.path.length > 1 && (
                          <span className="text-xs text-workspace-text-tertiary">路径：{gate.path.map((s) => STAGE_ZH[s] || s).join(' → ')}</span>
                        )}
                      </>
                    )}
                    <Button
                      variant={gate?.verdict === GATE_VERDICTS.RED ? 'danger' : 'primary'}
                      size="sm"
                      disabled={direction === 'SAME' || direction === 'INVALID'}
                      onClick={advanceStage}
                    >
                      {direction === 'BACKWARD' ? '回退到该阶段' : gate?.verdict === GATE_VERDICTS.RED ? '强制推进（需理由）' : '推进到该阶段'}
                    </Button>
                  </div>
                  {(gate?.verdict === GATE_VERDICTS.YELLOW || gate?.verdict === GATE_VERDICTS.RED || direction === 'BACKWARD') && (
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder={direction === 'BACKWARD' ? '回退原因（可选）' : `${gate?.verdict} 推进理由（必填，写入决策日志）`}
                      className="mt-2 h-8 w-full max-w-md rounded-md border border-workspace-border-strong bg-workspace-surface px-2 text-[13px] text-workspace-text"
                    />
                  )}
                  {direction === 'FORWARD' && gate && gate.checks.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {gate.path.map((stage) => {
                        const stageChecks = gate.checks.filter((c) => c.stage === stage)
                        if (stageChecks.length === 0) return null
                        return (
                          <div key={stage}>
                            <div className="mb-1 text-xs font-medium text-workspace-text-secondary">{STAGE_ZH[stage] || stage}</div>
                            <ul className="space-y-1.5">
                              {stageChecks.map((c) => (
                                <li key={`${c.stage}-${c.id}`} className="flex items-start gap-2 text-[13px]">
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
                        )
                      })}
                    </div>
                  )}
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
            {tab === 'costing' && (
              ozonContext ? (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-medium text-workspace-text">Ozon 核算面板 · 项目 {project.projectCode}</div>
                    <Button variant="ghost" size="sm" onClick={() => setOzonContext(null)}>返回成本场景列表</Button>
                  </div>
                  <OzonCalc
                    projectContext={{
                      projectId: project.id,
                      projectCode: project.projectCode,
                      prefill: ozonContext.prefill,
                      onSaveScenario: saveOzonScenario,
                    }}
                  />
                </div>
              ) : wbContext ? (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-medium text-workspace-text">WB 核算面板 · 项目 {project.projectCode}</div>
                    <Button variant="ghost" size="sm" onClick={() => setWbContext(null)}>返回成本场景列表</Button>
                  </div>
                  <WBCalc
                    projectContext={{
                      projectId: project.id,
                      projectCode: project.projectCode,
                      prefill: wbContext.prefill,
                      onSaveScenario: saveWbScenario,
                    }}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-workspace-text">成本场景（不可变快照，只读列表）</div>
                      <div className="mt-0.5 text-xs text-workspace-text-tertiary">场景一旦保存不可编辑/删除；首个场景自动设为基线；基线毛利率 ≥15% 才可通过 COSTING Gate</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!snapshot}
                        onClick={() => setWbContext({ prefill: buildWbPrefill({ snapshot }) })}
                      >
                        使用 WB 核算
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={!snapshot}
                        onClick={() => setOzonContext({ prefill: buildOzonPrefill({ snapshot }) })}
                      >
                        使用 Ozon 核算
                      </Button>
                    </div>
                  </div>
                  {scenarios.length === 0 ? (
                    <div className="text-[13px] text-workspace-text-tertiary">尚无成本场景——点击「使用 Ozon 核算」或「使用 WB 核算」，预填候选数据后填写真实成本并保存。</div>
                  ) : (
                    <div className="space-y-2">
                      {scenarios.map((sc) => {
                        const s = scenarioSummary(sc)
                        const isBaseline = project.costing?.baselineScenarioId === sc.id
                        return (
                          <div key={sc.id} className="rounded-lg border border-workspace-border p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Badge tone={s.platform === 'WB' ? 'warning' : 'primary'}>{s.platform}</Badge>
                                <span className="text-sm font-medium text-workspace-text">{s.name}</span>
                                {isBaseline && <Badge tone="success">基线</Badge>}
                                {s.platform === 'WB' && !isBaseline && <span className="text-xs text-workspace-text-tertiary">仅测算参考</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-workspace-text-secondary">
                                  {s.channelName} · 售价 ₽{s.priceRub} · 毛利率{' '}
                                  <b className={s.profitMarginPct >= 15 ? 'text-workspace-success' : 'text-workspace-warning'}>{s.profitMarginPct}%</b>
                                </span>
                                {!isBaseline && <Button variant="ghost" size="sm" onClick={() => setBaseline(sc.id)}>设为基线</Button>}
                              </div>
                            </div>
                            <div className="mt-1 text-xs text-workspace-text-tertiary">
                              冻结于 {new Date(s.createdAt).toLocaleString('zh-CN')} · {s.calculatorVersion}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* 跨平台方案比较表（值来自各平台现有核算引擎；不跨平台重新计算费用） */}
                  {scenarios.length > 0 && (
                    <div>
                      <div className="mb-2 text-sm font-semibold text-workspace-text">跨平台方案比较</div>
                      <div className="overflow-x-auto rounded-lg border border-workspace-border">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-workspace-surface-subtle text-workspace-text-secondary">
                              <th className="px-3 py-2 text-left font-medium">平台</th>
                              <th className="px-3 py-2 text-left font-medium">场景</th>
                              <th className="px-3 py-2 text-left font-medium">渠道 / 线路</th>
                              <th className="px-3 py-2 text-right font-medium">售价 ₽</th>
                              <th className="px-3 py-2 text-right font-medium">毛利率</th>
                              <th className="px-3 py-2 text-left font-medium">冻结时间</th>
                              <th className="px-3 py-2 text-left font-medium">基线</th>
                            </tr>
                          </thead>
                          <tbody>
                            {scenarios.map((sc) => {
                              const s = scenarioSummary(sc)
                              const isBaseline = project.costing?.baselineScenarioId === sc.id
                              return (
                                <tr key={sc.id} className="border-t border-workspace-border">
                                  <td className="px-3 py-2"><Badge tone={s.platform === 'WB' ? 'warning' : 'primary'}>{s.platform}</Badge></td>
                                  <td className="px-3 py-2 text-workspace-text">{s.name}</td>
                                  <td className="px-3 py-2 text-workspace-text-secondary">{s.channelName}</td>
                                  <td className="px-3 py-2 text-right tabular-nums text-workspace-text">{s.priceRub}</td>
                                  <td className={`px-3 py-2 text-right tabular-nums font-semibold ${s.profitMarginPct >= 15 ? 'text-workspace-success' : 'text-workspace-warning'}`}>{s.profitMarginPct}%</td>
                                  <td className="px-3 py-2 text-workspace-text-tertiary">{new Date(s.createdAt).toLocaleDateString('zh-CN')}</td>
                                  <td className="px-3 py-2">{isBaseline ? <Badge tone="success">基线</Badge> : '—'}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className="mt-1.5 text-xs text-workspace-text-tertiary">比较值来自各平台现有核算引擎；不跨平台重新计算费用。</p>
                    </div>
                  )}
                </div>
              )
            )}
            {tab !== 'overview' && tab !== 'costing' && (
              <div className="py-8 text-center">
                <div className="text-sm font-medium text-workspace-text">{STAGE_ZH[project.stage]}</div>
                <div className="mt-2 text-[13px] text-workspace-text-tertiary">{PLACEHOLDERS[tab]}</div>
              </div>
            )}
          </div>
        </Surface>

        {/* 右侧：36 节点 Workflow Timeline（每项目独立；状态变化留日志；备注失焦保存） */}
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
                      <WorkflowNodeRow
                        key={n.nodeId}
                        node={n}
                        state={state}
                        onStatusChange={(nodeId, status, note) => setNode(nodeId, status, note)}
                        onNoteSave={saveNodeNote}
                      />
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
