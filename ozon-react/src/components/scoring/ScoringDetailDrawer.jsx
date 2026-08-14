/**
 * scoring/ScoringDetailDrawer.jsx — 单 SKU 决策详情（T5-4）
 * 结构：商品 → 总分+Decision（Decision 视觉优先）→ 市场需求（市场规模/候选表现双分量必须显示）
 * → 商业可行性五维横条 → Supply Gap → 为什么值得做/主要风险（buildExplanations 输出）
 * → 市场基准 → 下一步。不使用 emoji；N/A 显示 —（tooltip 说明证据不足）。
 */
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import Drawer from '../ui/Drawer'
import ScoreCell from './ScoreCell'
import DecisionBadge from './DecisionBadge'
import ContextBadge from './ContextBadge'

const GAP_ZH = { HIGH_GAP: '强供应缺口', MEDIUM_GAP: '中等缺口', NO_STRONG_GAP_SIGNAL: '暂无强信号' }

const DIM_LABELS = {
  competition: '竞争机会',
  price_opportunity: '价格空间',
  profitability: '利润可行性',
  logistics: '物流适配',
  operations: '运营稳健',
}

function ScoreBar({ label, value }) {
  const available = value !== null && value !== undefined
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 flex-shrink-0 text-[13px] text-workspace-text-secondary">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-workspace-surface-subtle">
        {available && <div className="h-full rounded-full bg-workspace-primary" style={{ width: `${value}%` }} />}
      </div>
      {available ? (
        <span className="tabular-nums w-8 text-right text-[13px] font-medium text-workspace-text">{value}</span>
      ) : (
        <span
          className="w-8 text-right text-[13px] text-workspace-text-tertiary"
          title="该维度因证据覆盖不足未参与评分。"
        >
          —
        </span>
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="border-b border-workspace-border py-4 first:pt-0 last:border-b-0">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-workspace-text-tertiary">{title}</div>
      {children}
    </div>
  )
}

export default function ScoringDetailDrawer({ row, open, onClose }) {
  if (!row) return null
  const d = row.dimensions?.demand
  return (
    <Drawer open={open} onClose={onClose} title="商品决策详情" width={440}>
      {/* 商品 */}
      <div className="text-sm font-semibold leading-snug text-workspace-text">{row.name}</div>
      <div className="mt-0.5 text-xs text-workspace-text-secondary">
        {row.categoryFull || row.leaf}
        {row.matchedProductType ? ` · BSR: ${row.matchedProductType}` : ' · 无 BSR 匹配'}
      </div>

      {/* 总分 + Decision（Decision 优先于 Score） */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="text-[22px] font-semibold leading-none text-workspace-text tabular-nums">
          {row.totalScore ?? '—'}
        </div>
        <ScoreCell score={null} grade={row.grade} tentative={row.gradeTentative} />
        <DecisionBadge status={row.decision.status} action={row.decision.action} withAction />
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-workspace-text-secondary">
        <span className="tabular-nums">Evidence {Math.round((row.evidenceCoverage ?? 0) * 100)}%</span>
        <ContextBadge context={row.context} />
        {row.gradeTentative && (
          <span className="rounded-[5px] bg-workspace-warning-soft px-1.5 py-0.5 text-workspace-warning">评级暂定</span>
        )}
      </div>

      {/* 市场需求（双分量必须显示） */}
      <Section title="市场需求">
        {d ? (
          <div className="space-y-2.5">
            <ScoreBar label="市场规模" value={d.marketScaleScore} />
            <ScoreBar label="候选相对表现" value={d.candidateStrengthScore} />
            <div className="flex items-center gap-3">
              <span className="w-20 flex-shrink-0 text-[13px] font-medium text-workspace-text">综合需求</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-workspace-surface-subtle">
                {d.available && <div className="h-full rounded-full bg-workspace-primary" style={{ width: `${d.score}%` }} />}
              </div>
              <span className="tabular-nums w-8 text-right text-[13px] font-semibold text-workspace-text">
                {d.available ? d.score : '—'}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-[13px] text-workspace-text-tertiary">—</div>
        )}
      </Section>

      {/* 商业可行性五维 */}
      <Section title="商业可行性">
        <div className="space-y-2.5">
          {Object.entries(DIM_LABELS).map(([key, label]) => {
            const v = row.dimensions?.[key]
            return <ScoreBar key={key} label={label} value={v?.available ? v.score : null} />
          })}
        </div>
      </Section>

      {/* Supply Gap */}
      <Section title="Supply Gap">
        {row.supplyGap ? (
          <div className="text-[13px] text-workspace-text">
            {GAP_ZH[row.supplyGap.rank] || row.supplyGap.rank}
            <span className="ml-2 tabular-nums text-xs text-workspace-text-secondary">
              信号 {row.supplyGap.signal} · 需求 {row.supplyGap.demandRank} · 缺货 {row.supplyGap.shortageRank}
            </span>
          </div>
        ) : (
          <div className="text-[13px] text-workspace-text-tertiary">无市场基准</div>
        )}
      </Section>

      {/* 为什么值得做 / 主要风险（全部来自 buildExplanations） */}
      <Section title="为什么值得做">
        {row.strengths.length > 0 ? (
          <ul className="space-y-1.5">
            {row.strengths.map((s) => (
              <li key={s} className="flex items-start gap-2 text-[13px] leading-snug text-workspace-text">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-workspace-success" />
                {s}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-[13px] text-workspace-text-tertiary">—</div>
        )}
      </Section>
      <Section title="主要风险">
        {row.risks.length > 0 ? (
          <ul className="space-y-1.5">
            {row.risks.map((s) => (
              <li key={s} className="flex items-start gap-2 text-[13px] leading-snug text-workspace-danger">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-[13px] text-workspace-text-tertiary">—</div>
        )}
        {row.missingMetrics.length > 0 && (
          <div className="mt-2 text-xs text-workspace-text-tertiary">
            缺数据：{row.missingMetrics.join('、')}
          </div>
        )}
      </Section>

      {/* 市场基准 */}
      <Section title="市场基准">
        <div className="space-y-1 text-[13px] text-workspace-text">
          <div>BSR 类型：{row.matchedProductType || '无匹配'}</div>
          <div>样本 n：{row.benchmarkSampleSize ?? '—'}</div>
          {row.marketPriceBand && (
            <div className="tabular-nums">
              价格 P25 / P50 / P75：{Math.round(row.marketPriceBand.p25)} / {Math.round(row.marketPriceBand.p50)} / {Math.round(row.marketPriceBand.p75)} ₽
            </div>
          )}
          <div>Context：{row.context}</div>
        </div>
      </Section>

      {/* 下一步 */}
      <Section title="下一步">
        <div className="flex items-center gap-2">
          <DecisionBadge status={row.decision.status} action={row.decision.action} withAction />
        </div>
      </Section>
    </Drawer>
  )
}
