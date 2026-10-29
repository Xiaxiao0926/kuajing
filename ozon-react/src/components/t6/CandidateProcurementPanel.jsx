/**
 * t6/CandidateProcurementPanel.jsx — 候选商品 Phase 5 采购验证只读面板与 Gateway
 * 契约（TASK 05B-2C 冻结）：
 *  - 纯只读与导航引导：不直接修改采购数据、不升级 Candidate Schema、不将采购数据拷贝进 Candidate
 *  - 身份解析：优先基于 source_niche_uid 做 UID 稳定查找；仅对 WB_MARKET_INTELLIGENCE 候选回退 Legacy 名称匹配
 *  - 静态候选隔离：非 MI 且无 UID 的候选绝对不通过名称自动关联采购记录
 *  - 禁止正则提取：严禁通过正则解析 candidate.notes 获取采购字段
 *  - 明确标示：全局市场情报验证池不会自动按当前 Candidate 预过滤
 */
import { useMemo } from 'react'
import { ExternalLink, AlertCircle, CheckCircle2, ShieldCheck, Truck, Building2, Package } from 'lucide-react'
import Surface from '../ui/Surface'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import { getManualQuotes } from '../../utils/marketIntelligence/miStore'
import { findProcurementQuote } from '../../utils/marketIntelligence/procurementIdentity'

export default function CandidateProcurementPanel({ candidate, onOpenProcurement }) {
  const isMiCandidate = candidate?.source_system === 'WB_MARKET_INTELLIGENCE'
  const hasUid = Boolean(candidate?.source_niche_uid)

  const { quote, associationType } = useMemo(() => {
    if (!candidate) return { quote: null, associationType: 'NONE' }

    const quotes = getManualQuotes() || {}

    // Case A: 有 source_niche_uid -> UID 稳定查找
    if (hasUid) {
      const q = findProcurementQuote(quotes, {
        uid: candidate.source_niche_uid,
        name: candidate.candidateName,
      })
      if (q) return { quote: q, associationType: 'UID' }
    }

    // Case B: 无 source_niche_uid，但来自 WB_MARKET_INTELLIGENCE -> 回退 Legacy 名称匹配
    if (!hasUid && isMiCandidate) {
      const q = findProcurementQuote(quotes, {
        name: candidate.candidateName,
      })
      if (q) return { quote: q, associationType: 'LEGACY_NAME' }
    }

    // Case C: 静态或非 MI 候选且无 UID -> 绝不按名称关联
    return { quote: null, associationType: 'NONE' }
  }, [candidate, hasUid, isMiCandidate])

  const hasQuote = Boolean(quote)

  const dimsText = useMemo(() => {
    if (!quote?.dims) return '—'
    const { lengthCm, widthCm, heightCm } = quote.dims
    if (lengthCm != null && widthCm != null && heightCm != null) {
      return `${lengthCm} × ${widthCm} × ${heightCm} cm`
    }
    return typeof quote.dims === 'string' ? quote.dims : '—'
  }, [quote])

  return (
    <div className="space-y-4 text-xs">
      {/* 报价数据展示 */}
      {hasQuote ? (
        <Surface className="p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-workspace-border pb-3">
            <div>
              <h3 className="text-xs font-semibold text-workspace-text flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-workspace-success" />
                Phase 5 采购验证记录
              </h3>
              <p className="text-[11px] text-workspace-text-tertiary mt-0.5">
                更新时间: {quote.updatedAt ? new Date(quote.updatedAt).toLocaleString('zh-CN') : '—'}
              </p>
            </div>
            {associationType === 'UID' ? (
              <Badge tone="success">UID 稳定关联</Badge>
            ) : (
              <Badge tone="warning">Legacy 名称关联</Badge>
            )}
          </div>

          {/* 供应商与采购成本 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
            <div className="p-2.5 bg-workspace-surface-subtle rounded border border-workspace-border">
              <span className="text-workspace-text-tertiary block text-[11px]">供应商</span>
              <span className="text-xs font-semibold text-workspace-text mt-1 block truncate" title={quote.supplierName}>
                {quote.supplierName || '—'}
              </span>
            </div>
            <div className="p-2.5 bg-workspace-surface-subtle rounded border border-workspace-border">
              <span className="text-workspace-text-tertiary block text-[11px]">出厂单价 (CNY)</span>
              <span className="text-base font-bold text-workspace-text tabular-nums">
                {quote.factoryPriceCny != null ? `¥${quote.factoryPriceCny}` : '—'}
              </span>
            </div>
            <div className="p-2.5 bg-workspace-surface-subtle rounded border border-workspace-border">
              <span className="text-workspace-text-tertiary block text-[11px]">起订量 (MOQ)</span>
              <span className="text-base font-bold text-workspace-text tabular-nums">
                {quote.moq != null ? quote.moq : '—'}
              </span>
            </div>
            <div className="p-2.5 bg-workspace-surface-subtle rounded border border-workspace-border">
              <span className="text-workspace-text-tertiary block text-[11px]">实测单重 (g)</span>
              <span className="text-base font-bold text-workspace-text tabular-nums">
                {quote.weightG != null ? `${quote.weightG}g` : '—'}
              </span>
            </div>
          </div>

          {/* 物流与单位经济 */}
          <div className="pt-2 border-t border-workspace-border/60 space-y-2">
            <span className="font-semibold text-workspace-text text-[11px]">单位经济与物流测算：</span>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-workspace-text-tertiary">包装尺寸：</span>
                <span className="font-medium text-workspace-text font-mono">{dimsText}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-workspace-text-tertiary">国内运费：</span>
                <span className="font-medium text-workspace-text">
                  {quote.domesticFreightCny != null ? `¥${quote.domesticFreightCny}` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-workspace-text-tertiary">国际头程：</span>
                <span className="font-medium text-workspace-text">
                  {quote.internationalFreightCny != null ? `¥${quote.internationalFreightCny}` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-workspace-text-tertiary">目标售价：</span>
                <span className="font-medium text-workspace-text">
                  {quote.targetPriceRub != null ? `${quote.targetPriceRub} ₽` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-workspace-text-tertiary">预估净利：</span>
                <span className="font-semibold text-workspace-text">
                  {quote.netProfitCny != null ? `¥${quote.netProfitCny}` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-workspace-text-tertiary">预估毛利率：</span>
                <span className={`font-semibold ${Number(quote.marginPct) >= 20 ? 'text-workspace-success' : 'text-workspace-text'}`}>
                  {quote.marginPct != null ? `${quote.marginPct}%` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* 凭证来源与可信度 */}
          <div className="pt-2 border-t border-workspace-border/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-workspace-text text-[11px]">数据凭证与可信度等级：</span>
              {quote.overallTrustTier && (
                <Badge tone={quote.overallTrustTier === 'TIER1_CONFIRMED' ? 'success' : 'neutral'}>
                  {quote.overallTrustTier}
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-workspace-text-secondary">
              <div>价格凭证: {quote.priceProvenance || '—'}</div>
              <div>规格凭证: {quote.specProvenance || '—'}</div>
              <div>物流凭证: {quote.freightProvenance || '—'}</div>
              <div>合规凭证: {quote.regulationProvenance || '—'}</div>
            </div>
            {quote.supplierUrl && (
              <div className="pt-1 text-[11px] text-workspace-text-tertiary truncate">
                供应商链接: <a href={quote.supplierUrl} target="_blank" rel="noreferrer" className="text-workspace-primary hover:underline">{quote.supplierUrl}</a>
              </div>
            )}
          </div>
        </Surface>
      ) : (
        <Surface className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-workspace-text">Phase 5 采购验证状态</h3>
            <Badge tone="warning">暂无采购验证数据</Badge>
          </div>

          <div className="p-3 rounded bg-amber-50/80 border border-amber-200 text-amber-900 text-[11px] space-y-1.5">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600 mt-0.5" />
              <div className="leading-relaxed">
                当前 Candidate 暂无关联的 Phase 5 人工采购验证记录。
              </div>
            </div>
            {isMiCandidate ? (
              <div className="pl-6 text-amber-800 text-[11px] leading-relaxed">
                当前候选来源于 WB Market Intelligence。若已在 Phase 5 工作台录入报价，系统将优先根据 UID 关联；若尚未录入，可通过下方入口前往产品验证池进行录入。
              </div>
            ) : (
              <div className="pl-6 text-amber-800 text-[11px] leading-relaxed">
                当前候选为非 Market Intelligence 来源或静态历史数据，系统不会仅凭名称自动关联采购记录。
              </div>
            )}
          </div>
        </Surface>
      )}

      {/* Gateway CTA 引导卡片 */}
      <Surface className="p-4 bg-workspace-surface-subtle border border-workspace-border space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-xs font-semibold text-workspace-text">市场情报产品验证池 (Phase 5)</h4>
            <p className="text-[11px] text-workspace-text-tertiary mt-1 leading-relaxed">
              当前市场情报产品验证池为全局视图，不会自动筛选或定位到当前 Candidate。
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={onOpenProcurement}
            className="flex-shrink-0 gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            打开市场情报验证池
          </Button>
        </div>
      </Surface>
    </div>
  )
}
