/**
 * scoring/ScoringOverview.jsx — 决策 KPI 区（T5-4）
 * 5-6 个决策 KPI + 紧凑 A/B/C/D 分布 + 一条决策概览；不做九个多彩大块。
 * 全部统计自 ScoredProduct[]（引擎输出），不在组件内重算业务判断。
 */
import KpiStat from '../ui/KpiStat'

export default function ScoringOverview({ rows }) {
  const gradeCount = { A: 0, B: 0, C: 0, D: 0, null: 0 }
  const decisionCount = {}
  const contextCount = { highMed: 0 }
  for (const r of rows) {
    gradeCount[r.grade ?? 'null']++
    decisionCount[r.decision.status] = (decisionCount[r.decision.status] || 0) + 1
    if (r.context === 'HIGH' || r.context === 'MEDIUM') contextCount.highMed++
  }
  const eligible = decisionCount.ELIGIBLE || 0
  const reviewHold = (decisionCount.REVIEW || 0) + (decisionCount.HOLD || 0)

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiStat label="候选 SKU" value={rows.length.toLocaleString()} />
        <KpiStat label="可执行" value={eligible} tone="success" sub={rows.length ? `${((eligible / rows.length) * 100).toFixed(1)}%` : '—'} />
        <KpiStat label="B 级机会" value={gradeCount.B} tone="primary" />
        <KpiStat label="高/中市场置信" value={contextCount.highMed} />
        <KpiStat label="待复核" value={reviewHold} tone="warning" sub="REVIEW + HOLD" />
        <KpiStat label="不可评级" value={gradeCount.null} tone="neutral" sub="证据不足" />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-workspace-text-secondary">
        <span className="tabular-nums">
          分布：A {gradeCount.A} · B {gradeCount.B} · C {gradeCount.C} · D {gradeCount.D}
        </span>
        <span className="text-workspace-text-tertiary">
          当前机会结构：B 级为主 · 高/中置信 {contextCount.highMed} · 可执行 {eligible} · {gradeCount.null} 条数据不足
        </span>
      </div>
    </div>
  )
}
