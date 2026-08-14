/**
 * ProductScoringSection.jsx — 选品评分面板（编排层，只做展示）
 * 全部计算在 scoringDataAdapter.js（与审计同源）；本组件不实现类目匹配/汇率/CEL/percentile。
 * 评分在 useMemo 中只跑一次，不随 rerender 重算 1000 SKU。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { getDataUrl } from '../../../utils/runtime'
import scoringRules from '../../../generated/scoring_rules'
import settings from '../../../generated/settings'
import { scoreAllCandidates } from '../../../utils/scoring/scoringDataAdapter'
import { rowsToCsv, rowsToXlsx, exportFilename } from '../../../utils/scoring/scoringExport'

const DECISION_STATUS_ZH = { ELIGIBLE: '可执行', REVIEW: '需复核', RESEARCH: '需调研', HOLD: '暂缓', BLOCKED: '不可行' }
const DECISION_ACTION_ZH = {
  SAMPLE_VALIDATION: '样品验证', PILOT_TEST: '小规模试销', WATCH: '观望', DEPRIORITIZE: '暂不优先',
  COLLECT_MARKET_DATA: '补充市场研究', COMPLIANCE_REVIEW: '合规复核', VERIFY_COST: '核实成本',
  NEEDS_DATA: '补充数据', DO_NOT_SAMPLE: '禁止采样',
}
const CONTEXT_ZH = { HIGH: '高置信', MEDIUM: '中置信', LOW: '低置信', LOW_MARKET_CONTEXT: '无市场基准' }
const GAP_ZH = { HIGH_GAP: '强缺口', MEDIUM_GAP: '中缺口', NO_STRONG_GAP_SIGNAL: '无强信号' }
const DIM_LABELS = { demand: '市场需求', competition: '竞争机会', price_opportunity: '价格空间', profitability: '利润可行性', logistics: '物流适配', operations: '运营稳健' }
const GRADE_STYLE = {
  A: 'bg-emerald-100 text-emerald-700', B: 'bg-sky-100 text-sky-700',
  C: 'bg-amber-100 text-amber-700', D: 'bg-rose-100 text-rose-700',
  null: 'bg-gray-100 text-gray-500',
}
// 默认排序：可执行 Decision 优先 → 综合分 → Evidence（86+BLOCKED 不得排在 78+ELIGIBLE 前面）
const DECISION_TIER = { ELIGIBLE: 0, REVIEW: 1, RESEARCH: 2, HOLD: 3, BLOCKED: 4 }

// 列表简版原因：仅对引擎已输出的 status 做中文标签映射（不新增判断规则）
function briefReason(r) {
  if (r.status.includes('BLOCKED_LOGISTICS')) return '物流不可行·禁止采样'
  if (r.status.includes('MARGIN_RISK')) return '毛利为负·核实成本'
  if (r.status.includes('REVIEW_REQUIRED')) return '命中合规词·人工复核'
  if (r.status.includes('LOW_MARKET_CONTEXT')) return '无市场基准·补充调研'
  if (r.status.includes('NEEDS_DATA')) return '关键数据不足·暂不评级'
  return '—'
}

export default function ProductScoringSection() {
  const [candidates, setCandidates] = useState(null)
  const [benchmark, setBenchmark] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
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
    const out = scored.filter((r) => {
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
  }, [scored, fGrade, fDecision, fContext, fGap, fRisk, fCategory])

  const overview = useMemo(() => {
    if (!scored) return null
    const g = { A: 0, B: 0, C: 0, D: 0, null: 0 }
    const d = {}
    for (const r of scored) {
      g[r.grade ?? 'null']++
      d[r.decision.status] = (d[r.decision.status] || 0) + 1
    }
    const avg = scored.filter((r) => r.totalScore !== null)
    return {
      total: scored.length,
      grades: g,
      decisions: d,
      avgScore: avg.length ? avg.reduce((s, r) => s + r.totalScore, 0) / avg.length : null,
      eligible: d.ELIGIBLE || 0,
      highMed: scored.filter((r) => r.context === 'HIGH' || r.context === 'MEDIUM').length,
    }
  }, [scored])

  const selected = selectedIndex != null ? scored.find((r) => r.index === selectedIndex) : null

  if (loading) {
    return (
      <div className="rounded-2xl bg-white/70 border border-morandi-line p-8 text-center text-morandi-text-light">
        选品评分面板加载中（候选数据 + BSR 市场基准）…
      </div>
    )
  }
  if (error || scoredResult.error || !scored) {
    return (
      <div className="rounded-2xl bg-rose-50 border border-rose-200 p-8">
        <h3 className="text-lg font-semibold text-rose-700 mb-2">选品评分面板初始化失败</h3>
        <p className="text-rose-600 text-sm font-mono break-all">{error || scoredResult.error || '未知错误'}</p>
        <p className="text-rose-400 text-xs mt-2">fail-close：不会用旧算法继续显示正常分数。</p>
      </div>
    )
  }

  const dimRow = (key, v) => v && (
    <div className="flex items-center gap-3">
      <span className="w-24 text-sm text-morandi-text-light">{DIM_LABELS[key] || key}</span>
      <div className="flex-1 h-2 rounded bg-gray-100 overflow-hidden">
        <div className="h-full rounded bg-morandi-blue" style={{ width: `${v.available ? (v.score ?? 0) : 0}%` }} />
      </div>
      <span className="w-12 text-right text-sm font-medium">{v.available ? v.score : 'N/A'}</span>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white/70 border border-morandi-line p-5">
        <div className="flex items-baseline justify-between flex-wrap gap-2 mb-4">
          <h2 className="text-xl font-semibold text-morandi-text">选品评分面板</h2>
          <div className="text-xs text-morandi-text-light">
            规则版本 {scoringRules.version} · λ={scoringRules.dimensions.demand.scale_weight}
            {scoreMsRef.current != null && ` · 首次评分 ${scoreMsRef.current} ms`}
            {filterMsRef.current != null && ` · 筛选/排序 ${filterMsRef.current} ms`}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            ['SKU 总数', overview.total],
            ['A', overview.grades.A],
            ['B', overview.grades.B],
            ['C', overview.grades.C],
            ['D', overview.grades.D],
            ['不可评级', overview.grades.null],
            ['可执行(ELIGIBLE)', overview.eligible],
            ['HIGH/MEDIUM', overview.highMed],
            ['平均分', overview.avgScore != null ? overview.avgScore.toFixed(1) : '—'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-morandi-bg p-3">
              <div className="text-xs text-morandi-text-light">{label}</div>
              <div className="text-xl font-semibold text-morandi-text">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 筛选 */}
      <div className="rounded-2xl bg-white/70 border border-morandi-line p-4 flex flex-wrap gap-2 items-center">
        <Select label="等级" value={fGrade} onChange={setFGrade} options={[['ALL', '全部'], ['A', 'A'], ['B', 'B'], ['C', 'C'], ['D', 'D'], ['null', '不可评级']]} />
        <Select label="Decision" value={fDecision} onChange={setFDecision} options={[['ALL', '全部'], ...Object.entries(DECISION_STATUS_ZH)]} />
        <Select label="Context" value={fContext} onChange={setFContext} options={[['ALL', '全部'], ...Object.entries(CONTEXT_ZH)]} />
        <Select label="Supply Gap" value={fGap} onChange={setFGap} options={[['ALL', '全部'], ['HIGH_GAP', '强缺口'], ['MEDIUM_GAP', '中缺口'], ['NONE', '无信号']]} />
        <Select label="风险" value={fRisk} onChange={setFRisk} options={[['ALL', '全部'], ['MARGIN_RISK', '毛利风险'], ['REVIEW_REQUIRED', '合规'], ['BLOCKED_LOGISTICS', '物流'], ['NEEDS_DATA', '数据不足']]} />
        <Select label="类目" value={fCategory} onChange={setFCategory} options={[['ALL', '全部'], ...categories.map((c) => [c, c])]} />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-morandi-text-light">{filtered.length} / {overview.total} 行</span>
          <button
            onClick={() => rowsToXlsx(filtered, XLSX, exportFilename('xlsx'))}
            disabled={filtered.length === 0}
            className="px-3 py-1.5 rounded-lg bg-morandi-primary text-white text-xs font-medium hover:bg-morandi-primary/90 disabled:opacity-50"
          >
            导出 XLSX（{filtered.length}）
          </button>
          <button
            onClick={() => {
              const blob = new Blob([rowsToCsv(filtered)], { type: 'text/csv;charset=utf-8' })
              const a = document.createElement('a')
              a.href = URL.createObjectURL(blob)
              a.download = exportFilename('csv')
              a.click()
              URL.revokeObjectURL(a.href)
            }}
            disabled={filtered.length === 0}
            className="px-3 py-1.5 rounded-lg border border-morandi-line bg-white text-morandi-text text-xs font-medium hover:bg-morandi-bg disabled:opacity-50"
          >
            导出 CSV（{filtered.length}）
          </button>
        </div>
      </div>

      {/* 排名表 */}
      <div className="rounded-2xl bg-white/70 border border-morandi-line overflow-hidden">
        <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead className="sticky top-0 bg-morandi-bg text-morandi-text-light text-xs">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">SKU / 商品名</th>
                <th className="px-3 py-2 text-right">综合分</th>
                <th className="px-3 py-2 text-center">等级</th>
                <th className="px-3 py-2 text-center">Decision</th>
                <th className="px-3 py-2 text-right">市场规模</th>
                <th className="px-3 py-2 text-right">候选表现</th>
                <th className="px-3 py-2 text-right">竞争</th>
                <th className="px-3 py-2 text-right">利润</th>
                <th className="px-3 py-2 text-right">物流</th>
                <th className="px-3 py-2 text-center">Supply Gap</th>
                <th className="px-3 py-2 text-center">Context</th>
                <th className="px-3 py-2 text-left">简版原因</th>
                <th className="px-3 py-2 text-left">风险标记</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const risks = r.status.filter((s) => ['MARGIN_RISK', 'REVIEW_REQUIRED', 'BLOCKED_LOGISTICS', 'NEEDS_DATA'].includes(s))
                return (
                  <tr
                    key={r.index}
                    onClick={() => setSelectedIndex(r.index)}
                    className={`border-t border-morandi-line cursor-pointer hover:bg-morandi-bg transition-colors ${selectedIndex === r.index ? 'bg-sky-50' : ''}`}
                  >
                    <td className="px-3 py-2 text-morandi-text-light">{i + 1}</td>
                    <td className="px-3 py-2 max-w-[260px]">
                      <div className="truncate text-morandi-text" title={r.name}>{r.name}</div>
                      <div className="text-xs text-morandi-text-light truncate">{r.leaf}{r.gradeTentative ? ' · 暂定' : ''}</div>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-morandi-text">{r.totalScore ?? '—'}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${GRADE_STYLE[r.grade ?? 'null']}`}>{r.grade ?? '—'}</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="text-morandi-text">{DECISION_STATUS_ZH[r.decision.status]}</div>
                      <div className="text-xs text-morandi-text-light">{DECISION_ACTION_ZH[r.decision.action] || r.decision.action}</div>
                    </td>
                    <td className="px-3 py-2 text-right">{r.dimensions.demand.marketScaleScore ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{r.dimensions.demand.candidateStrengthScore ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{r.dimensions.competition.available ? r.dimensions.competition.score : '—'}</td>
                    <td className="px-3 py-2 text-right">{r.dimensions.profitability.available ? r.dimensions.profitability.score : '—'}</td>
                    <td className="px-3 py-2 text-right">{r.dimensions.logistics.available ? r.dimensions.logistics.score : '—'}</td>
                    <td className="px-3 py-2 text-center">{r.supplyGap ? GAP_ZH[r.supplyGap.rank] || r.supplyGap.rank : '—'}</td>
                    <td className="px-3 py-2 text-center">{CONTEXT_ZH[r.context]}</td>
                    <td className="px-3 py-2 text-left text-xs text-morandi-text-light whitespace-nowrap">{briefReason(r)}</td>
                    <td className="px-3 py-2 text-left">
                      {risks.length === 0 ? <span className="text-morandi-text-light">—</span> : risks.map((s) => (
                        <span key={s} className="inline-block px-1.5 py-0.5 mr-1 rounded bg-rose-50 text-rose-600 text-xs">
                          {s === 'MARGIN_RISK' ? '毛利' : s === 'REVIEW_REQUIRED' ? '合规' : s === 'BLOCKED_LOGISTICS' ? '物流' : '数据'}
                        </span>
                      ))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 单 SKU 详情 */}
      {selected && (
        <div className="rounded-2xl bg-white/70 border border-morandi-line p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-morandi-text">{selected.name}</h3>
              <div className="text-sm text-morandi-text-light">{selected.categoryFull}（匹配: {selected.matchedProductType || '无'} · {CONTEXT_ZH[selected.context]}{selected.gradeTentative ? ' · 暂定评级' : ''}）</div>
            </div>
            <button onClick={() => setSelectedIndex(null)} className="text-morandi-text-light hover:text-morandi-text">✕ 关闭</button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold text-morandi-text">{selected.totalScore ?? '—'}</span>
                <span className={`px-2 py-0.5 rounded-full text-sm font-semibold ${GRADE_STYLE[selected.grade ?? 'null']}`}>{selected.grade ?? '不可评级'}</span>
                <span className="text-sm text-morandi-text-light">Evidence {Math.round((selected.evidenceCoverage ?? 0) * 100)}%</span>
              </div>
              <div className="text-xs text-morandi-text-light">
                销售额 {selected.sales_rub_28d != null ? Math.round(selected.sales_rub_28d).toLocaleString() + ' ₽' : '—'} · 销量 {selected.units_28d ?? '—'} · 价格 {selected.price_rub != null ? Math.round(selected.price_rub) + ' ₽' : '—'}
              </div>
              <div className="space-y-1.5 pt-2">
                {Object.entries(DIM_LABELS).map(([key, label]) => {
                  const v = selected.dimensions[key]
                  return (
                    <div key={key}>
                      {key === 'demand' && v.available && (
                        <div className="flex items-center gap-3 pl-6 text-xs text-morandi-text-light mb-0.5">
                          <span className="w-16">├ 市场规模</span>
                          <span className="w-10 text-right">{v.marketScaleScore ?? 'N/A'}</span>
                          <span className="w-16 pl-4">└ 候选表现</span>
                          <span className="w-10 text-right">{v.candidateStrengthScore ?? 'N/A'}</span>
                        </div>
                      )}
                      {dimRow(key, v)}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-morandi-text-light mb-1">Why · 优势</div>
                {selected.strengths.length ? selected.strengths.map((s) => <div key={s} className="text-emerald-700">✓ {s}</div>) : <div className="text-morandi-text-light">—</div>}
              </div>
              <div>
                <div className="text-xs text-morandi-text-light mb-1">Why · 风险</div>
                {selected.risks.length ? selected.risks.map((s) => <div key={s} className="text-rose-600">⚠ {s}</div>) : <div className="text-morandi-text-light">—</div>}
              </div>
              {selected.missingMetrics.length > 0 && (
                <div>
                  <div className="text-xs text-morandi-text-light mb-1">缺数据</div>
                  {selected.missingMetrics.map((s) => <div key={s} className="text-morandi-text-light">· {s}</div>)}
                </div>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl bg-morandi-bg p-3">
              <div className="text-xs text-morandi-text-light mb-1">Market Context</div>
              <div>BSR 类型: {selected.matchedProductType || '无匹配'}</div>
              <div>样本 n: {selected.benchmarkSampleSize ?? '—'}</div>
              <div>置信: {CONTEXT_ZH[selected.context]}</div>
              {selected.marketPriceBand && (
                <div>价格带 P25/P50/P75: {Math.round(selected.marketPriceBand.p25)} / {Math.round(selected.marketPriceBand.p50)} / {Math.round(selected.marketPriceBand.p75)} ₽</div>
              )}
            </div>
            <div className="rounded-xl bg-morandi-bg p-3">
              <div className="text-xs text-morandi-text-light mb-1">Supply Gap</div>
              {selected.supplyGap ? (
                <>
                  <div>{GAP_ZH[selected.supplyGap.rank] || selected.supplyGap.rank}（信号 {selected.supplyGap.signal}）</div>
                  <div>需求 {selected.supplyGap.demandRank} · 缺货 {selected.supplyGap.shortageRank} · 进入开放度 {selected.supplyGap.entryOpenness}</div>
                </>
              ) : <div>N/A（无市场基准或可比类型不足）</div>}
            </div>
            <div className="rounded-xl bg-morandi-bg p-3">
              <div className="text-xs text-morandi-text-light mb-1">Decision · 下一步</div>
              <div className="font-semibold">{DECISION_STATUS_ZH[selected.decision.status]} → {DECISION_ACTION_ZH[selected.decision.action] || selected.decision.action}</div>
              <div className="text-xs text-morandi-text-light">{selected.decision.reason}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-morandi-text-light">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-morandi-line bg-white px-2 py-1.5 text-morandi-text text-sm"
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  )
}
