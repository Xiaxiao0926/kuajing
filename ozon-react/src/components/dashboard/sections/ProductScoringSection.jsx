/**
 * ProductScoringSection.jsx — 选品评分工作台（编排层）
 * 计算与 T4 完全一致：scoringDataAdapter → scoreProduct → buildExplanations → ScoredProduct[]；
 * 本组件只编排展示子组件（scoring/*），不复制任何评分判断。
 * 评分在 useMemo 中只跑一次；默认排序契约 = Decision 优先级 → 综合分 → Evidence（86+BLOCKED 不插队）。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { getDataUrl } from '../../../utils/runtime'
import scoringRules from '../../../generated/scoring_rules'
import settings from '../../../generated/settings'
import { scoreAllCandidates } from '../../../utils/scoring/scoringDataAdapter'
import { rowsToCsv, rowsToXlsx, exportFilename } from '../../../utils/scoring/scoringExport'
import {
  ensureCandidate, refreshCandidateSnapshot, buildScoringSnapshot,
  createProject, setProjectLifecycle,
} from '../../../utils/t6/t6Store'
import LoadingState from '../../ui/LoadingState'
import ErrorState from '../../ui/ErrorState'
import Surface from '../../ui/Surface'
import ScoringPageHeader from '../../scoring/ScoringPageHeader'
import ScoringOverview from '../../scoring/ScoringOverview'
import ScoringToolbar from '../../scoring/ScoringToolbar'
import ScoringTable from '../../scoring/ScoringTable'
import ScoringDetailDrawer from '../../scoring/ScoringDetailDrawer'

// 默认排序：可执行 Decision 优先 → 综合分 → Evidence（冻结契约，T4-4B）
const DECISION_TIER = { ELIGIBLE: 0, REVIEW: 1, RESEARCH: 2, HOLD: 3, BLOCKED: 4 }

export default function ProductScoringSection() {
  const [candidates, setCandidates] = useState(null)
  const [benchmark, setBenchmark] = useState(null)
  const [datasetDoc, setDatasetDoc] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [t6Notice, setT6Notice] = useState('')
  const scoreMsRef = useRef(null)
  const filterMsRef = useRef(null)

  // 数据加载（独立于市场分析数据）
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const [cRes, bRes] = await Promise.all([
          fetch(`${getDataUrl('scoring_candidates.json')}?t=${Date.now()}`),
          fetch(`${getDataUrl('bsr_market_benchmarks.json')}?t=${Date.now()}`),
        ])
        if (!cRes.ok || !bRes.ok) throw new Error(`数据加载失败: ${cRes.status}/${bRes.status}`)
        const cDoc = await cRes.json()
        const bDoc = await bRes.json()
        if (!Array.isArray(cDoc.candidates) || cDoc.candidates.length === 0) throw new Error('scoring_candidates.json 无候选数据')
        if (cancelled) return
        setCandidates(cDoc.candidates)
        setBenchmark(bDoc)
        setDatasetDoc(cDoc)
      } catch (e) {
        if (!cancelled) setError(e.message || String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // 评分只跑一次（useMemo）；fail-close 错误随 memo 结果返回（渲染期不 setState）
  const scoredResult = useMemo(() => {
    if (!candidates || !benchmark) return { rows: null, error: null }
    try {
      const t0 = performance.now()
      const rows = scoreAllCandidates({ candidates, benchmark, rules: scoringRules, rubPerCny: settings.rub_per_cny })
      scoreMsRef.current = Math.round(performance.now() - t0)
      return { rows, error: null }
    } catch (e) {
      return { rows: null, error: e.message || String(e) }
    }
  }, [candidates, benchmark])
  const scored = scoredResult.rows

  const [search, setSearch] = useState('')
  const [fGrade, setFGrade] = useState('ALL')
  const [fDecision, setFDecision] = useState('ALL')
  const [fContext, setFContext] = useState('ALL')
  const [fGap, setFGap] = useState('ALL')
  const [fRisk, setFRisk] = useState('ALL')
  const [fCategory, setFCategory] = useState('ALL')
  const [selectedIndex, setSelectedIndex] = useState(null)

  const categories = useMemo(() => (scored ? [...new Set(scored.map((r) => r.leaf))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'zh')) : []), [scored])

  const filtered = useMemo(() => {
    if (!scored) return []
    const t0 = performance.now()
    const q = search.trim().toLowerCase()
    const out = scored.filter((r) => {
      if (q && !`${r.name} ${r.leaf} ${r.categoryFull}`.toLowerCase().includes(q)) return false
      if (fGrade !== 'ALL' && (r.grade ?? 'null') !== fGrade) return false
      if (fDecision !== 'ALL' && r.decision.status !== fDecision) return false
      if (fContext !== 'ALL' && r.context !== fContext) return false
      if (fGap !== 'ALL') {
        if (fGap === 'NONE' && r.supplyGap) return false
        if (fGap !== 'NONE' && (!r.supplyGap || r.supplyGap.rank !== fGap)) return false
      }
      if (fRisk !== 'ALL' && !r.status.includes(fRisk)) return false
      if (fCategory !== 'ALL' && r.leaf !== fCategory) return false
      return true
    })
    out.sort((a, b) => {
      const ta = DECISION_TIER[a.decision.status] ?? 9
      const tb = DECISION_TIER[b.decision.status] ?? 9
      if (ta !== tb) return ta - tb
      const sa = a.totalScore ?? -1
      const sb = b.totalScore ?? -1
      if (sa !== sb) return sb - sa
      return (b.evidenceCoverage ?? 0) - (a.evidenceCoverage ?? 0)
    })
    filterMsRef.current = Math.round(performance.now() - t0)
    return out
  }, [scored, search, fGrade, fDecision, fContext, fGap, fRisk, fCategory])

  if (loading) {
    return <LoadingState text="正在载入候选 SKU 与市场基准…" />
  }
  if (error || scoredResult.error || !scored) {
    return (
      <ErrorState
        title="选品评分初始化失败"
        message={error || scoredResult.error || '未知错误'}
        onRetry={() => window.location.reload()}
      />
    )
  }

  const selected = selectedIndex != null ? scored.find((r) => r.index === selectedIndex) : null

  // ---- T6-1：候选池 / 一键立项（快照不可变，写入走 t6Store） ----
  const canonicalFor = (row) => (candidates && row && Number.isInteger(row.index) ? candidates[row.index] : null)

  const buildSnap = (row, candidateId = null) => buildScoringSnapshot({
    scored: row,
    canonical: canonicalFor(row),
    benchmarkMeta: benchmark?.meta,
    benchmarkDoc: benchmark,
    rules: scoringRules,
    datasetVersion: `${datasetDoc?.source || 'candidates'}#${datasetDoc?.generatedAt || '?'}`,
    candidateId,
  })

  const handleAddCandidate = (row) => {
    try {
      const canonical = canonicalFor(row)
      if (!canonical) { setT6Notice('缺少该 SKU 的候选数据'); return }
      const { candidate } = ensureCandidate({
        sourceProductId: canonical.source_product_id ?? '',
        candidateIndex: row.index,
        name: row.name,
        categoryLeaf: row.leaf,
        categoryFull: row.categoryFull,
      })
      const snap = buildSnap(row, candidate.id)
      refreshCandidateSnapshot(candidate.id, snap.id)
      setT6Notice(`已加入候选：${row.name}（快照 ${snap.id.slice(0, 8)}…）`)
    } catch (e) {
      setT6Notice(e.message || String(e))
    }
  }

  const handleCreateProject = (row) => {
    try {
      const canonical = canonicalFor(row)
      if (!canonical) { setT6Notice('缺少该 SKU 的候选数据'); return }
      const { candidate } = ensureCandidate({
        sourceProductId: canonical.source_product_id ?? '',
        candidateIndex: row.index,
        name: row.name,
        categoryLeaf: row.leaf,
        categoryFull: row.categoryFull,
      })
      // T6-1 hardening：一键立项永远冻结用户眼前看到的当前评分——
      // 每次生成新快照（更新 latestSnapshotId），绝不复用旧快照。
      const snap = buildSnap(row, candidate.id)
      refreshCandidateSnapshot(candidate.id, snap.id)
      const project = createProject({ candidateId: candidate.id, creationSnapshotId: snap.id })
      setProjectLifecycle(project.id, 'ACTIVE', '一键立项后启动')
      setT6Notice(`已创建项目 ${project.projectCode}（立项快照 ${snap.id.slice(0, 8)}…）`)
    } catch (e) {
      setT6Notice(e.message || String(e))
    }
  }

  return (
    <div className="space-y-4">
      <ScoringPageHeader
        total={scored.length}
        filteredCount={filtered.length}
        onExportXlsx={() => rowsToXlsx(filtered, XLSX, exportFilename('xlsx'))}
        onExportCsv={() => {
          const blob = new Blob([rowsToCsv(filtered)], { type: 'text/csv;charset=utf-8' })
          const a = document.createElement('a')
          a.href = URL.createObjectURL(blob)
          a.download = exportFilename('csv')
          a.click()
          URL.revokeObjectURL(a.href)
        }}
      />

      <ScoringOverview rows={scored} />

      <Surface>
        <ScoringToolbar
          search={search}
          onSearch={setSearch}
          fGrade={fGrade} setFGrade={setFGrade}
          fDecision={fDecision} setFDecision={setFDecision}
          fContext={fContext} setFContext={setFContext}
          fGap={fGap} setFGap={setFGap}
          fRisk={fRisk} setFRisk={setFRisk}
          fCategory={fCategory} setFCategory={setFCategory}
          categories={categories}
          filteredCount={filtered.length}
          totalCount={scored.length}
        />
        {filtered.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-workspace-text-secondary">
            没有符合当前筛选条件的 SKU
          </div>
        ) : (
          <ScoringTable
            rows={filtered}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            onAddCandidate={handleAddCandidate}
          />
        )}
      </Surface>

      {/* 底部 meta（规则/λ/性能 + T6 操作反馈，不进主视觉） */}
      <div className="flex items-center gap-3 text-xs text-workspace-text-tertiary">
        <span>规则 V1 · λ {scoringRules.dimensions.demand.scale_weight}</span>
        <span>{selectedIndex != null ? `已选 #${selectedIndex}` : '未选择 SKU'}</span>
        {scoreMsRef.current != null && <span className="hidden md:inline">首次评分 {scoreMsRef.current} ms</span>}
        {filterMsRef.current != null && <span className="hidden md:inline">筛选 {filterMsRef.current} ms</span>}
        {t6Notice && <span className="text-workspace-text-secondary">{t6Notice}</span>}
      </div>

      <ScoringDetailDrawer
        row={selected}
        open={selectedIndex != null}
        onClose={() => setSelectedIndex(null)}
        onAddCandidate={handleAddCandidate}
        onCreateProject={handleCreateProject}
      />
    </div>
  )
}
