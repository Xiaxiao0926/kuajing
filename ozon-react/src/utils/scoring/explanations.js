/**
 * scoring/explanations.js — 评分解释生成（纯函数）
 * 依据 T4-1B §6 输出契约：strengths / risks / missingMetrics。
 * 口径铁律（context 分级，不得把 domain 基准伪装成产品类型基准）：
 *   - HIGH / MEDIUM（type 基准）→ 可写"超过同类市场 X 商品"；
 *   - LOW（domain 基准 / shrinkage）→ 只能写"对应 BSR 市场域"；
 *   - LOW_MARKET_CONTEXT（无映射）→ 只能写"候选池表现前 X%"。
 */
import { percentileRankFromQuantiles, benchmarkQuantiles } from './normalization.js'

const fmt = (v) => (v === null || v === undefined ? '—' : Math.round(v))

/**
 * @param {object} c canonical 候选行
 * @param {object} result scoreProduct 输出
 * @param {object} marketContext {context, benchmark, matchedType}
 * @returns {{strengths: string[], risks: string[], missingMetrics: string[]}}
 */
export function buildExplanations(c, result, marketContext) {
  const strengths = []
  const risks = []
  const missing = []
  const ctx = marketContext || { context: 'LOW_MARKET_CONTEXT', benchmark: null, matchedType: null }
  const marketAware = ctx.benchmark !== null
  // HIGH/MEDIUM = type 基准；LOW = domain 基准；LOW_MARKET_CONTEXT = 无基准
  const isTypeBenchmark = ctx.context === 'HIGH' || ctx.context === 'MEDIUM'
  const marketLabel = () => (isTypeBenchmark ? `同类市场 ${ctx.matchedType || '该类型'}` : '对应 BSR 市场域')

  const dim = (k) => result.dimensions[k]
  const poolWording = (key, label, percentile) =>
    `候选池表现前 ${fmt(100 - (percentile ?? 0))}%（${label}）`

  // ---- demand ----
  const d = dim('demand')
  if (d && d.available) {
    const salesSub = d.subs.find((s) => s.key === 'sales_rub_28d')
    if (salesSub && salesSub.score != null && salesSub.score >= 75) {
      if (marketAware) {
        const qs = benchmarkQuantiles(ctx.benchmark, 'sales_28d')
        const rank = qs ? percentileRankFromQuantiles(c.sales_rub_28d, qs) : null
        strengths.push(`28天销售额达到${marketLabel()}前 ${fmt(100 - rank)}% 水平`)
      } else {
        strengths.push(poolWording('sales', '28天销售额', salesSub.score))
      }
    }
  } else if (d && !d.available) {
    missing.push('市场需求（子指标覆盖不足）')
  }

  // ---- competition ----
  const comp = dim('competition')
  if (!comp.available && ctx.context === 'LOW_MARKET_CONTEXT') {
    missing.push('竞争机会（无 BSR 市场基准）')
  } else if (comp.available && comp.score >= 70) {
    strengths.push('市场集中度较低，竞争结构可切入')
  } else if (comp.available && comp.score < 40) {
    risks.push('头部集中度偏高，切入难度大')
  }

  // ---- price ----
  const pr = dim('price_opportunity')
  if (!pr.available && ctx.context === 'LOW_MARKET_CONTEXT') {
    missing.push('价格空间（无 BSR 市场基准）')
  } else if (pr.available) {
    const band = pr.subs.find((s) => s.key === 'price_band_match')
    if (band && band.score === 30) {
      risks.push('价格带错配：候选价格低于市场主成交带下限')
    } else if (band && band.score === 40) {
      risks.push('价格带错配：候选价格高于市场主成交带上限')
    } else if (band && band.score === 60) {
      risks.push('价格处于市场主带的边缘区间')
    } else if (band && band.score === 100) {
      strengths.push('价格落在市场主成交带（P25-P75）内')
    }
  }

  // ---- profitability ----
  const pf = dim('profitability')
  if (c.gross_margin != null && c.gross_margin < 0) {
    risks.push(`预估毛利率为负（${c.gross_margin}%），需成本复核`)
  } else if (pf.available && pf.score >= 70) {
    strengths.push('利润可行性代理分较高（毛利/佣金/广告负担综合）')
  }

  // ---- logistics ----
  const lg = dim('logistics')
  if (result.status.includes('BLOCKED_LOGISTICS')) {
    risks.push('无可用 CEL 渠道，当前跨境物流不可行')
  } else if (lg.available && lg.score >= 70) {
    strengths.push('跨境物流适配良好（渠道/运费占比/计费重量）')
  } else if (lg.available && lg.score < 45) {
    risks.push('物流成本占比偏高或计费重量不利')
  }

  // ---- operations ----
  const op = dim('operations')
  if (op.available && op.score < 40) {
    risks.push('运营稳健性偏低（签收率/缺货/库存）')
  }

  // ---- supply gap ----
  if (result.supplyGap && result.supplyGap.rank === 'HIGH_GAP') {
    strengths.push(`供应缺口信号强：${marketLabel()}需求高且缺货/错失销售显著，卖家集中度不构成壁垒`)
  } else if (result.supplyGap && result.supplyGap.rank === 'MEDIUM_GAP') {
    strengths.push('存在中等供应缺口信号，值得进一步验证')
  }

  // ---- context / gates ----
  if (ctx.context === 'LOW_MARKET_CONTEXT') {
    risks.push('缺少对应 BSR 市场基准，评级为暂定，建议先补市场研究')
  }
  if (result.status.includes('MARGIN_RISK')) {
    risks.push('毛利率为负（MARGIN_RISK），利润维度封顶处理')
  }
  if (result.status.includes('REVIEW_REQUIRED')) {
    risks.push('商品名称命中合规关键词，需人工合规复核')
  }
  if (result.status.includes('NEEDS_DATA')) {
    risks.push('关键字段证据不足，评分数值仅供参考')
  }

  return { strengths, risks, missingMetrics: missing }
}
