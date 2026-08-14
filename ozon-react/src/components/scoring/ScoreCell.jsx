/**
 * scoring/ScoreCell.jsx — 分数 + 等级合并单元（T5-4）
 * Score 是机会质量；Grade 小型 badge；Decision 在视觉层级上高于本单元（由表格列序保证）。
 */
const GRADE_TONE = {
  A: 'success',
  B: 'info',
  C: 'warning',
  D: 'danger',
}

export default function ScoreCell({ score, grade, tentative = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="tabular-nums text-[13px] font-semibold text-workspace-text">
        {score ?? '—'}
      </span>
      <span
        className={`rounded-[5px] px-1.5 py-0.5 text-xs font-semibold leading-none ${
          grade == null
            ? 'bg-workspace-surface-subtle text-workspace-text-tertiary'
            : grade === 'A' ? 'bg-workspace-success-soft text-workspace-success'
            : grade === 'B' ? 'bg-workspace-primary-soft text-workspace-primary'
            : grade === 'C' ? 'bg-workspace-warning-soft text-workspace-warning'
            : 'bg-workspace-danger-soft text-workspace-danger'
        }`}
      >
        {grade ?? '—'}{tentative ? ' · 暂定' : ''}
      </span>
    </span>
  )
}

export { GRADE_TONE }
