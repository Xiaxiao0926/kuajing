/**
 * t6/CandidatePoolPage.jsx — 候选池（T6-1）
 * 数据流：scoring_candidates/bsr 加载一次 → scoreAllCandidates 一次（useMemo，同 T4 适配层）
 * → t6Store 候选/快照/日志。人工 bizStatus 与模型 Grade/Decision 并列展示。
 */
import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, FolderPlus } from 'lucide-react'
import { getDataUrl } from '../../utils/runtime'
import scoringRules from '../../generated/scoring_rules'
import settings from '../../generated/settings'
import { scoreAllCandidates } from '../../utils/scoring/scoringDataAdapter'
import {
  listCandidates, getSnapshot, refreshCandidateSnapshot, buildScoringSnapshot,
  createProject, setCandidateBizStatus, setCandidateOwner, setProjectLifecycle,
} from '../../utils/t6/t6Store'
import Surface from '../ui/Surface'
import PageHeader from '../ui/PageHeader'
import Button from '../ui/Button'
import Select from '../ui/Select'
import EmptyState from '../ui/EmptyState'
import ScoreCell from '../scoring/ScoreCell'
import DecisionBadge from '../scoring/DecisionBadge'
import ContextBadge from '../scoring/ContextBadge'

const BIZ_STATUS = [['观察', '观察'], ['待调研', '待调研'], ['待立项', '待立项'], ['暂缓', '暂缓'], ['淘汰', '淘汰']]

export default function CandidatePoolPage() {
  const [tick, setTick] = useState(0)
  const [notice, setNotice] = useState('')
  const [dataset, setDataset] = useState(null)
  const [benchmark, setBenchmark] = useState(null)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [cRes, bRes] = await Promise.all([
          fetch(`${getDataUrl('scoring_candidates.json')}?t=${Date.now()}`),
          fetch(`${getDataUrl('bsr_market_benchmarks.json')}?t=${Date.now()}`),
        ])
        if (!cRes.ok || !bRes.ok) throw new Error(`数据加载失败: ${cRes.status}/${bRes.status}`)
        const cDoc = await cRes.json()
        const bDoc = await bRes.json()
        if (cancelled) return
        setDataset(cDoc)
        setBenchmark(bDoc)
      } catch (e) {
        if (!cancelled) setLoadError(e.message || String(e))
      }
    })()
    return () => { cancelled = true }
  }, [])

  const scoredByProductId = useMemo(() => {
    if (!dataset || !benchmark) return new Map()
    try {
      const rows = scoreAllCandidates({ candidates: dataset.candidates, benchmark, rules: scoringRules, rubPerCny: settings.rub_per_cny })
      const map = new Map()
      rows.forEach((r, i) => map.set(String(dataset.candidates[i]?.source_product_id ?? ''), { row: r, canonical: dataset.candidates[i] }))
      return map
    } catch (e) {
      setLoadError(e.message || String(e))
      return new Map()
    }
  }, [dataset, benchmark])

  const candidates = useMemo(() => {
    void tick
    return [...listCandidates()].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
  }, [tick])

  const flush = (msg) => { setNotice(msg); setTick((t) => t + 1) }

  const makeSnapshot = (entry, candidateId = null) => {
    if (!entry) return null
    return buildScoringSnapshot({
      scored: entry.row,
      canonical: entry.canonical,
      benchmarkMeta: benchmark?.meta,
      benchmarkDoc: benchmark,
      rules: scoringRules,
      datasetVersion: `${dataset.source || 'candidates'}#${dataset.generatedAt || '?'}`,
      candidateId,
    })
  }

  const handleAddOrRefresh = (cand) => {
    const entry = scoredByProductId.get(String(cand.sourceProductId))
    if (!entry) { flush('未找到该商品的当前评分数据'); return }
    const snap = makeSnapshot(entry, cand.id)
    refreshCandidateSnapshot(cand.id, snap)
    flush(`已刷新评分快照（${entry.row.totalScore} ${entry.row.grade}）`)
  }

  const handleCreateProject = (cand) => {
    const entry = scoredByProductId.get(String(cand.sourceProductId))
    const snap = cand.latestSnapshotId ? getSnapshot(cand.latestSnapshotId) : makeSnapshot(entry, cand.id)
    if (!snap) { flush('缺少评分快照，无法立项'); return }
    const project = createProject({ candidate: cand, creationSnapshot: snap })
    setProjectLifecycle(project.id, 'ACTIVE', '一键立项后启动')
    flush(`已创建项目 ${project.projectCode}`)
  }

  const snapshotView = (cand) => {
    const snap = cand.latestSnapshotId ? getSnapshot(cand.latestSnapshotId) : null
    return snap?.scoreResult || null
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="候选池"
        subtitle="从 1000 个候选里选什么——人工业务状态与模型评分并列展示"
        actions={notice ? <span className="text-xs text-workspace-text-secondary">{notice}</span> : undefined}
      />
      {loadError && <div className="rounded-lg bg-workspace-danger-soft px-4 py-3 text-sm text-workspace-danger">{loadError}</div>}
      <Surface>
        {candidates.length === 0 ? (
          <EmptyState title="候选池为空" description="到「选品评分」页点击 [加入候选]，商品会出现在这里" />
        ) : (
          <div className="overflow-auto">
            <table className="w-full min-w-[1180px] border-collapse text-[13px]">
              <thead className="sticky top-0 z-10 bg-workspace-surface-subtle">
                <tr className="border-b border-workspace-border text-left text-xs font-medium text-workspace-text-secondary">
                  <th className="px-4 py-2.5">商品</th>
                  <th className="px-3 py-2.5">评分</th>
                  <th className="px-3 py-2.5">Decision</th>
                  <th className="px-3 py-2.5">Context</th>
                  <th className="px-3 py-2.5 text-right">市场规模</th>
                  <th className="px-3 py-2.5 text-right">候选表现</th>
                  <th className="px-3 py-2.5 text-right">利润</th>
                  <th className="px-3 py-2.5 text-right">物流</th>
                  <th className="px-3 py-2.5">Supply Gap</th>
                  <th className="px-3 py-2.5">负责人</th>
                  <th className="px-3 py-2.5">状态</th>
                  <th className="px-3 py-2.5 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((cand) => {
                  const snap = snapshotView(cand)
                  const hasProject = (cand.projectIds || []).length > 0
                  return (
                    <tr key={cand.id} className="border-b border-workspace-border hover:bg-workspace-surface-subtle">
                      <td className="max-w-[260px] px-4 py-2.5">
                        <div className="truncate font-medium text-workspace-text" title={cand.candidateName}>{cand.candidateName}</div>
                        <div className="truncate text-xs text-workspace-text-tertiary">{cand.categoryLeaf}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <ScoreCell score={snap?.totalScore ?? null} grade={snap?.grade ?? null} tentative={snap?.gradeTentative} />
                      </td>
                      <td className="px-3 py-2.5">
                        {snap ? <DecisionBadge status={snap.decision.status} action={snap.decision.action} withAction /> : '—'}
                      </td>
                      <td className="px-3 py-2.5">{snap ? <ContextBadge context={snap.context} /> : '—'}</td>
                      <td className="tabular-nums px-3 py-2.5 text-right text-workspace-text">{snap?.dimensions?.demand?.marketScaleScore ?? '—'}</td>
                      <td className="tabular-nums px-3 py-2.5 text-right text-workspace-text">{snap?.dimensions?.demand?.candidateStrengthScore ?? '—'}</td>
                      <td className="tabular-nums px-3 py-2.5 text-right text-workspace-text">{snap?.dimensions?.profitability?.available ? snap.dimensions.profitability.score : '—'}</td>
                      <td className="tabular-nums px-3 py-2.5 text-right text-workspace-text">{snap?.dimensions?.logistics?.available ? snap.dimensions.logistics.score : '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-workspace-text-secondary">{snap?.supplyGap ? snap.supplyGap.rank : '无市场基准'}</td>
                      <td className="px-3 py-2.5">
                        <input
                          value={cand.owner || ''}
                          placeholder="—"
                          onChange={(e) => setCandidateOwner(cand.id, e.target.value)}
                          className="w-20 rounded border border-workspace-border bg-workspace-surface px-1.5 py-1 text-xs text-workspace-text"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Select value={cand.bizStatus} onChange={(v) => { setCandidateBizStatus(cand.id, v, ''); flush(`状态 → ${v}`) }} options={BIZ_STATUS} />
                          {hasProject && <span className="rounded-[5px] bg-workspace-primary-soft px-1.5 py-0.5 text-xs text-workspace-primary">已产生项目</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button variant="ghost" size="sm" onClick={() => handleAddOrRefresh(cand)} title="刷新评分（生成新快照，旧快照不变）">
                            <RefreshCw className="h-3.5 w-3.5" /> 刷新评分
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => handleCreateProject(cand)}>
                            <FolderPlus className="h-3.5 w-3.5" /> 创建项目
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Surface>
      <div className="text-xs text-workspace-text-tertiary">
        评分快照不可变：刷新评分生成新快照，历史依据永久保留（规则 V1 · 引擎 t4-frozen-1）
      </div>
    </div>
  )
}
