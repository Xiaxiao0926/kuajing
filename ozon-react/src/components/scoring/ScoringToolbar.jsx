/**
 * scoring/ScoringToolbar.jsx — 筛选工具条（T5-4）
 * 搜索为第一筛选入口（280-360px）；筛选状态由父组件持有（纯展示编排）。
 */
import Toolbar from '../ui/Toolbar'
import SearchInput from '../ui/SearchInput'
import Select from '../ui/Select'

const GRADE_OPTIONS = [['ALL', '全部等级'], ['A', 'A'], ['B', 'B'], ['C', 'C'], ['D', 'D'], ['null', '不可评级']]
const DECISION_OPTIONS = [
  ['ALL', '全部 Decision'],
  ['ELIGIBLE', '可推进'],
  ['REVIEW', '合规复核'],
  ['RESEARCH', '补市场数据'],
  ['HOLD', '暂缓'],
  ['BLOCKED', '阻塞'],
]
const CONTEXT_OPTIONS = [
  ['ALL', '全部 Context'],
  ['HIGH', '高置信'],
  ['MEDIUM', '中置信'],
  ['LOW', '低置信'],
  ['LOW_MARKET_CONTEXT', '缺市场数据'],
]
const GAP_OPTIONS = [
  ['ALL', '全部 Gap'],
  ['HIGH_GAP', '强供应缺口'],
  ['MEDIUM_GAP', '中等缺口'],
  ['NONE', '暂无强信号'],
]
const RISK_OPTIONS = [
  ['ALL', '全部风险'],
  ['MARGIN_RISK', '毛利风险'],
  ['REVIEW_REQUIRED', '合规'],
  ['BLOCKED_LOGISTICS', '物流'],
  ['NEEDS_DATA', '数据不足'],
]

export default function ScoringToolbar({
  search, onSearch,
  fGrade, setFGrade,
  fDecision, setFDecision,
  fContext, setFContext,
  fGap, setFGap,
  fRisk, setFRisk,
  fCategory, setFCategory,
  categories,
  filteredCount, totalCount,
}) {
  return (
    <Toolbar
      left={
        <>
          <SearchInput value={search} onChange={onSearch} placeholder="搜索商品 / SKU / 类目" />
          <Select value={fGrade} onChange={setFGrade} options={GRADE_OPTIONS} />
          <Select value={fDecision} onChange={setFDecision} options={DECISION_OPTIONS} />
          <Select value={fContext} onChange={setFContext} options={CONTEXT_OPTIONS} />
          <Select value={fGap} onChange={setFGap} options={GAP_OPTIONS} />
          <Select value={fRisk} onChange={setFRisk} options={RISK_OPTIONS} />
          <Select value={fCategory} onChange={setFCategory} options={[['ALL', '全部类目'], ...categories.map((c) => [c, c])]} />
        </>
      }
      right={
        <span className="tabular-nums text-xs text-workspace-text-secondary whitespace-nowrap">
          {filteredCount} / {totalCount} 行
        </span>
      }
    />
  )
}
