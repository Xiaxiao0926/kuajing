import { useMemo, useState } from 'react'
import { AlertTriangle, ExternalLink, Factory, FlaskConical } from 'lucide-react'
import { COMPARISON_LEVELS, FACTORY_TRIAL_CANDIDATES, FACTORY_TRIAL_META } from '../../data/factoryTrialCandidates'
import Surface from '../ui/Surface'
import SearchInput from '../ui/SearchInput'
import Select from '../ui/Select'
import Badge from '../ui/Badge'
import Drawer from '../ui/Drawer'

const LANE_LABELS = { lighting: '便携照明', hardware: '工业配件' }
const PRIORITY_LABELS = { 1: '首批', 2: '小批', 3: '待补证' }
const PRIORITY_TONES = { 1: 'success', 2: 'primary', 3: 'warning' }
const COMPARISON_TONES = {
  same_series: 'primary',
  similar_spec: 'success',
  similar_function: 'neutral',
  same_use: 'neutral',
  missing: 'warning',
}
function DetailSection({ title, children }) {
  return (
    <section className="border-b border-workspace-border py-4 first:pt-0 last:border-b-0">
      <h4 className="mb-2 text-xs font-semibold uppercase text-workspace-text-tertiary">{title}</h4>
      {children}
    </section>
  )
}

function BulletList({ items, tone = 'text-workspace-text' }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => <li key={item} className={`text-[13px] leading-5 ${tone}`}>· {item}</li>)}
    </ul>
  )
}

export default function FactoryTrialCandidatesSection() {
  const [query, setQuery] = useState('')
  const [lane, setLane] = useState('all')
  const [priority, setPriority] = useState('all')
  const [comparison, setComparison] = useState('all')
  const [selected, setSelected] = useState(null)

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return FACTORY_TRIAL_CANDIDATES.filter((item) => {
      if (lane !== 'all' && item.lane !== lane) return false
      if (priority !== 'all' && String(item.priority) !== priority) return false
      if (comparison === 'available' && item.comparator.comparisonLevel === 'missing') return false
      if (comparison === 'missing' && item.comparator.comparisonLevel !== 'missing') return false
      if (!needle) return true
      return [item.model, item.category, item.supplier, item.testAngle, item.comparator.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    })
  }, [query, lane, priority, comparison])

  const firstBatch = FACTORY_TRIAL_CANDIDATES.filter((item) => item.priority === 1).length
  const benchmarked = FACTORY_TRIAL_CANDIDATES.filter((item) => item.comparator.comparisonLevel !== 'missing').length

  return (
    <section className="space-y-2.5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Factory className="h-4 w-4 text-workspace-primary" />
            <h3 className="text-base font-semibold text-workspace-text">工厂试卖候选</h3>
          </div>
          <p className="mt-1 text-xs text-workspace-text-secondary">目录粗选与俄罗斯公开在售商品对标；不进入原评分引擎，不产生虚假分数。</p>
        </div>
        <span className="text-xs text-workspace-text-tertiary">数据版本 {FACTORY_TRIAL_META.version}</span>
      </div>

      <Surface>
        <div className="grid grid-cols-2 border-b border-workspace-border md:grid-cols-4">
          {[
            ['候选', FACTORY_TRIAL_CANDIDATES.length, '款'],
            ['首批测试', firstBatch, '款'],
            ['已有对标', benchmarked, '款'],
            ['待补对标', FACTORY_TRIAL_CANDIDATES.length - benchmarked, '款'],
          ].map(([label, value, unit], index) => (
            <div key={label} className={`px-4 py-3 ${index % 2 ? '' : 'border-r border-workspace-border'} md:border-r md:last:border-r-0`}>
              <div className="text-xs text-workspace-text-secondary">{label}</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-workspace-text">{value}<span className="ml-1 text-xs font-normal text-workspace-text-tertiary">{unit}</span></div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-workspace-border px-4 py-3">
          <SearchInput value={query} onChange={setQuery} placeholder="搜索型号 / 类目 / 对标商品" />
          <Select value={lane} onChange={setLane} options={[["all", "全部品类"], ["lighting", "便携照明"], ["hardware", "工业配件"]]} />
          <Select value={priority} onChange={setPriority} options={[["all", "全部优先级"], ["1", "首批测试"], ["2", "小批测试"], ["3", "待补证"]]} />
          <Select value={comparison} onChange={setComparison} options={[["all", "全部对标状态"], ["available", "已有对标"], ["missing", "待补对标"]]} />
          <span className="ml-auto text-xs text-workspace-text-tertiary">显示 {rows.length} / {FACTORY_TRIAL_CANDIDATES.length}</span>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[1260px] border-collapse text-[13px]">
            <thead className="sticky top-0 z-10 bg-workspace-surface-subtle">
              <tr className="border-b border-workspace-border text-left text-xs font-medium text-workspace-text-secondary">
                <th className="px-4 py-2.5">工厂候选</th>
                <th className="px-3 py-2.5">优先级</th>
                <th className="px-3 py-2.5">目录依据</th>
                <th className="px-3 py-2.5">俄罗斯对标</th>
                <th className="px-3 py-2.5">可比程度</th>
                <th className="px-3 py-2.5 text-right">公开价</th>
                <th className="px-3 py-2.5">试卖判断</th>
                <th className="px-3 py-2.5">下一缺口</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} onClick={() => setSelected(item)} className="cursor-pointer border-b border-workspace-border transition-colors hover:bg-workspace-surface-subtle">
                  <td className="max-w-[230px] px-4 py-3">
                    <div className="font-semibold text-workspace-text">{item.model}</div>
                    <div className="mt-0.5 text-xs text-workspace-text-secondary">{item.category} · {LANE_LABELS[item.lane]}</div>
                  </td>
                  <td className="px-3 py-3"><Badge tone={PRIORITY_TONES[item.priority]}>{PRIORITY_LABELS[item.priority]}</Badge></td>
                  <td className="max-w-[210px] px-3 py-3 text-xs leading-5 text-workspace-text-secondary">{item.catalogueRef}</td>
                  <td className="max-w-[270px] px-3 py-3">
                    {item.comparator.url ? (
                      <a href={item.comparator.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="inline-flex items-start gap-1 font-medium leading-5 text-workspace-primary hover:underline">
                        {item.comparator.name}<ExternalLink className="mt-0.5 h-3 w-3 flex-shrink-0" />
                      </a>
                    ) : <span className="text-workspace-text-tertiary">尚无匹配商品</span>}
                    <div className="mt-0.5 text-xs text-workspace-text-tertiary">{item.comparator.merchant || '需继续检索'}</div>
                  </td>
                  <td className="px-3 py-3"><Badge tone={COMPARISON_TONES[item.comparator.comparisonLevel]}>{COMPARISON_LEVELS[item.comparator.comparisonLevel]}</Badge></td>
                  <td className="px-3 py-3 text-right tabular-nums text-workspace-text">
                    {item.comparator.priceRub === null ? '—' : `${item.comparator.priceRub.toLocaleString('ru-RU')} ₽`}
                    <div className="mt-0.5 text-[11px] text-workspace-text-tertiary">{item.comparator.checkedAt}</div>
                  </td>
                  <td className="max-w-[220px] px-3 py-3">
                    <div className="font-medium text-workspace-text">{item.decision}</div>
                    <div className="mt-0.5 line-clamp-2 text-xs leading-5 text-workspace-text-secondary">{item.testAngle}</div>
                  </td>
                  <td className="max-w-[220px] px-3 py-3 text-xs leading-5 text-workspace-text-secondary">{item.confirmationNeeded.slice(0, 2).join('、')}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan="8" className="px-4 py-10 text-center text-sm text-workspace-text-tertiary">没有符合筛选条件的候选</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-start gap-2 bg-workspace-surface-subtle px-4 py-3 text-xs leading-5 text-workspace-text-secondary">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-workspace-warning" />
          <span>{FACTORY_TRIAL_META.evidenceBoundary} “同用途/近似功能”不能当作同款，缺工厂报价与包装数据时不输出利润结论。</span>
        </div>
      </Surface>

      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} title="工厂候选与对标详情" width={480}>
        {selected && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold text-workspace-text">{selected.model}</span>
              <Badge tone={PRIORITY_TONES[selected.priority]}>{PRIORITY_LABELS[selected.priority]}</Badge>
              <Badge tone={COMPARISON_TONES[selected.comparator.comparisonLevel]}>{COMPARISON_LEVELS[selected.comparator.comparisonLevel]}</Badge>
            </div>
            <div className="mt-1 text-sm text-workspace-text-secondary">{selected.category} · {selected.supplier}</div>

            <DetailSection title="试卖判断">
              <div className="flex items-start gap-2 rounded-md bg-workspace-primary-soft px-3 py-2.5">
                <FlaskConical className="mt-0.5 h-4 w-4 flex-shrink-0 text-workspace-primary" />
                <div>
                  <div className="text-[13px] font-semibold text-workspace-text">{selected.decision}</div>
                  <p className="mt-1 text-[13px] leading-5 text-workspace-text-secondary">{selected.testAngle}</p>
                </div>
              </div>
            </DetailSection>

            <DetailSection title="目录事实">
              <div className="mb-2 text-xs text-workspace-text-tertiary">{selected.catalogueRef}</div>
              <BulletList items={selected.catalogueClaims} />
            </DetailSection>

            <DetailSection title="俄罗斯对标">
              {selected.comparator.url ? (
                <>
                  <a href={selected.comparator.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-semibold text-workspace-primary hover:underline">
                    {selected.comparator.name}<ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <div className="mt-1 text-xs text-workspace-text-secondary">
                    {selected.comparator.merchant} · {selected.comparator.priceRub === null ? '价格待复核' : `${selected.comparator.priceRub.toLocaleString('ru-RU')} ₽`} · 核价 {selected.comparator.checkedAt}
                  </div>
                </>
              ) : <div className="text-[13px] text-workspace-text-tertiary">尚无匹配商品</div>}
              <p className="mt-2 text-[13px] leading-5 text-workspace-text-secondary">{selected.comparator.evidence}</p>
            </DetailSection>

            <DetailSection title="询价前必须补齐">
              <BulletList items={selected.confirmationNeeded} />
            </DetailSection>

            <DetailSection title="证据边界">
              <BulletList items={selected.caveats} tone="text-workspace-warning" />
            </DetailSection>
          </>
        )}
      </Drawer>
    </section>
  )
}
