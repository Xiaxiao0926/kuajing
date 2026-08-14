/**
 * scoring/ScoringTable.jsx — SKU 决策表（T5-4）
 * 列序即视觉优先级：商品 → Score+Grade → Decision → 市场规模/候选表现 → 竞争/利润/物流 → Gap → Context → 风险。
 * 默认排序契约（Decision 优先 → 综合分 → Evidence）由父组件在 filtered 中保证。
 */
import DataTable from '../ui/DataTable'
import ScoreCell from './ScoreCell'
import DecisionBadge from './DecisionBadge'
import ContextBadge from './ContextBadge'
import RiskIndicators from './RiskIndicators'

const GAP_ZH = { HIGH_GAP: '强供应缺口', MEDIUM_GAP: '中等缺口', NO_STRONG_GAP_SIGNAL: '暂无强信号' }

const dim = (r, key) => (r.dimensions[key]?.available ? r.dimensions[key].score : null)

export default function ScoringTable({ rows, selectedIndex, onSelect }) {
  return (
    <DataTable
      minHeight={480}
      maxHeight="calc(100vh - 430px)"
      className="min-w-[1280px]"
      head={
        <>
          <th className="px-3 py-2.5 font-medium">商品</th>
          <th className="px-3 py-2.5 font-medium">分数</th>
          <th className="px-3 py-2.5 font-medium">Decision</th>
          <th className="px-3 py-2.5 text-right font-medium">市场规模</th>
          <th className="px-3 py-2.5 text-right font-medium">候选表现</th>
          <th className="px-3 py-2.5 text-right font-medium">竞争</th>
          <th className="px-3 py-2.5 text-right font-medium">利润</th>
          <th className="px-3 py-2.5 text-right font-medium">物流</th>
          <th className="px-3 py-2.5 font-medium">Gap</th>
          <th className="px-3 py-2.5 font-medium">Context</th>
          <th className="px-3 py-2.5 font-medium">风险</th>
        </>
      }
    >
      {rows.map((r) => {
        const selected = selectedIndex === r.index
        return (
          <tr
            key={r.index}
            onClick={() => onSelect(r.index)}
            className={`cursor-pointer border-b border-workspace-border transition-colors ${
              selected ? 'bg-workspace-primary-soft' : 'hover:bg-workspace-surface-subtle'
            }`}
          >
            {selected && <span className="absolute" />}
            <td className={`relative h-[52px] max-w-[300px] px-3 py-2 ${selected ? 'border-l-2 border-workspace-primary' : 'border-l-2 border-transparent'}`}>
              <div className="truncate text-[13px] font-medium text-workspace-text" title={r.name}>{r.name}</div>
              <div className="truncate text-xs text-workspace-text-tertiary">{r.leaf}</div>
            </td>
            <td className="px-3 py-2"><ScoreCell score={r.totalScore} grade={r.grade} tentative={r.gradeTentative} /></td>
            <td className="px-3 py-2"><DecisionBadge status={r.decision.status} action={r.decision.action} withAction /></td>
            <td className="tabular-nums px-3 py-2 text-right text-[13px] text-workspace-text">
              {r.dimensions.demand.marketScaleScore ?? '—'}
            </td>
            <td className="tabular-nums px-3 py-2 text-right text-[13px] text-workspace-text">
              {r.dimensions.demand.candidateStrengthScore ?? '—'}
            </td>
            <td className="tabular-nums px-3 py-2 text-right text-[13px] text-workspace-text">{dim(r, 'competition') ?? '—'}</td>
            <td className="tabular-nums px-3 py-2 text-right text-[13px] text-workspace-text">{dim(r, 'profitability') ?? '—'}</td>
            <td className="tabular-nums px-3 py-2 text-right text-[13px] text-workspace-text">{dim(r, 'logistics') ?? '—'}</td>
            <td className="px-3 py-2 text-xs text-workspace-text-secondary">
              {r.supplyGap ? (GAP_ZH[r.supplyGap.rank] || r.supplyGap.rank) : '无市场基准'}
            </td>
            <td className="px-3 py-2"><ContextBadge context={r.context} /></td>
            <td className="px-3 py-2"><RiskIndicators status={r.status} /></td>
          </tr>
        )
      })}
    </DataTable>
  )
}
