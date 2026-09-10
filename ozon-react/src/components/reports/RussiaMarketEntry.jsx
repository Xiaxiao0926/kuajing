const number = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 })

function formatRub(value) {
  if (!Number.isFinite(value)) return '—'
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)} 十亿 ₽`
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)} 百万 ₽`
  return `${number.format(value)} ₽`
}

function formatRatio(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '—'
}

function formatChange(value, suffix = '%') {
  if (!Number.isFinite(value)) return '—'
  return `${value > 0 ? '+' : ''}${number.format(value)}${suffix}`
}

function ContextMetric({ label, value, hint }) {
  return (
    <div className="border-l-2 border-red-700 bg-white px-4 py-3">
      <p className="text-xs text-morandi-text-light">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-morandi-text">{value}</p>
      {hint ? <p className="mt-1 text-xs leading-5 text-gray-400">{hint}</p> : null}
    </div>
  )
}

export default function RussiaMarketEntry({ entry }) {
  if (!entry?.context) return null
  const { context, cohortComparison, competition, logisticsFit, typeOpportunities, method, gaps } = entry
  const sector = context.sector

  return (
    <section className="mt-8 min-w-0 border-t border-gray-300 pt-7" aria-label="俄罗斯市场进入分析">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-red-700">RUSSIA MARKET FIT</p>
          <h4 className="mt-1 text-lg font-semibold text-morandi-text">俄罗斯市场进入分析</h4>
        </div>
        <p className="text-xs text-morandi-text-light">外部市场口径截至 {context.asOf}</p>
      </div>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-morandi-text-light">
        俄罗斯线上零售仍在增长，但绝大部分成交发生在本土商店和平台。对国内工厂而言，中国直发更适合验证 SKU，跑通后仍需评估本地库存、俄语内容与履约能力。
      </p>

      <div className="mt-4 grid gap-px border border-gray-200 bg-gray-200 sm:grid-cols-2 xl:grid-cols-5">
        <ContextMetric label="线上零售规模" value={`${context.overall.turnoverRubTrillion} 万亿 ₽`} hint="2026 年上半年" />
        <ContextMetric label="同比增长" value={`+${context.overall.yoyGrowthPct}%`} hint="俄罗斯全网零售" />
        <ContextMetric label="线上占社会零售" value={`${context.overall.onlineRetailSharePct}%`} hint="宏观渠道渗透率" />
        <ContextMetric label="本土平台与商店" value={`${context.overall.domesticPlatformSharePct}%`} hint={`直接跨境 ${context.overall.crossBorderSharePct}%`} />
        <ContextMetric
          label={sector?.label || '类目宏观口径'}
          value={sector?.sharePct !== null && sector?.sharePct !== undefined ? `${sector.sharePct}%` : '未提供份额'}
          hint={sector?.growthText || '当前报告未匹配到可比大类'}
        />
      </div>
      {sector ? <p className="mt-2 text-xs leading-5 text-gray-500">宏观数据是俄罗斯全网近似大类，不是本报告 Ozon 子类目的市场份额，不能与样本销售额直接相乘。</p> : null}

      <div className="mt-7 grid min-w-0 gap-6 xl:grid-cols-2">
        <div className="min-w-0">
          <h5 className="text-sm font-semibold text-morandi-text">新品能否追上成熟品</h5>
          <p className="mt-1 text-sm leading-6 text-morandi-text-light">比较同一快照中 0–180 天新品与 181 天以上成熟品，判断“新品多”是否真的转化为单位 SKU 表现。</p>
          <div className="mt-3 overflow-auto border border-gray-200 bg-white">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-[#244b61] text-white"><tr><th className="p-3 text-left">指标</th><th className="p-3 text-right">新品</th><th className="p-3 text-right">成熟品</th><th className="p-3 text-right">差异</th></tr></thead>
              <tbody>
                <tr className="border-t border-gray-100"><td className="p-3">样本 SKU</td><td className="p-3 text-right">{cohortComparison.fresh.rows}</td><td className="p-3 text-right">{cohortComparison.mature.rows}</td><td className="p-3 text-right">—</td></tr>
                <tr className="border-t border-gray-100 bg-gray-50"><td className="p-3">单位 SKU 销售额</td><td className="p-3 text-right">{formatRub(cohortComparison.fresh.revenuePerSku)}</td><td className="p-3 text-right">{formatRub(cohortComparison.mature.revenuePerSku)}</td><td className="p-3 text-right">{Number.isFinite(cohortComparison.revenuePerSkuRatio) ? `${cohortComparison.revenuePerSkuRatio}×` : '—'}</td></tr>
                <tr className="border-t border-gray-100"><td className="p-3">均价中位数</td><td className="p-3 text-right">{formatRub(cohortComparison.fresh.avgPriceMedian)}</td><td className="p-3 text-right">{formatRub(cohortComparison.mature.avgPriceMedian)}</td><td className="p-3 text-right">{formatChange(cohortComparison.avgPriceDeltaPct)}</td></tr>
                <tr className="border-t border-gray-100 bg-gray-50"><td className="p-3">下单转化率中位数</td><td className="p-3 text-right">{formatRatio(cohortComparison.fresh.orderConversionMedian)}</td><td className="p-3 text-right">{formatRatio(cohortComparison.mature.orderConversionMedian)}</td><td className="p-3 text-right">{formatChange(cohortComparison.orderConversionDeltaPct)}</td></tr>
                <tr className="border-t border-gray-100"><td className="p-3">缺货天数中位数</td><td className="p-3 text-right">{Number.isFinite(cohortComparison.fresh.stockoutMedian) ? `${number.format(cohortComparison.fresh.stockoutMedian)} 天` : '—'}</td><td className="p-3 text-right">{Number.isFinite(cohortComparison.mature.stockoutMedian) ? `${number.format(cohortComparison.mature.stockoutMedian)} 天` : '—'}</td><td className="p-3 text-right">{formatChange(cohortComparison.stockoutDeltaDays, ' 天')}</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 border-l-2 border-blue-600 pl-3 text-sm leading-6 text-morandi-text">{cohortComparison.interpretation}</p>
        </div>

        <div className="min-w-0">
          <h5 className="text-sm font-semibold text-morandi-text">竞争与跨境测试性</h5>
          <p className="mt-1 text-sm leading-6 text-morandi-text-light">集中度用于判断头部壁垒；体积和价值密度用于判断中国直发测试是否经济，不替代完整利润核算。</p>
          <dl className="mt-3 divide-y divide-gray-200 border-y border-gray-200 bg-white text-sm">
            <div className="flex justify-between gap-4 px-4 py-3"><dt>品牌集中度</dt><dd className="text-right">{competition.brandConcentration} · HHI {competition.brandHhi ?? '—'}</dd></div>
            <div className="flex justify-between gap-4 px-4 py-3"><dt>卖家集中度</dt><dd className="text-right">{competition.sellerConcentration} · HHI {competition.sellerHhi ?? '—'}</dd></div>
            <div className="flex justify-between gap-4 px-4 py-3"><dt>未知/无品牌销售额</dt><dd className="text-right">{competition.whiteLabelRevenueShare}%</dd></div>
            <div className="flex justify-between gap-4 px-4 py-3"><dt>商品体积中位数 / P75</dt><dd className="text-right">{Number.isFinite(logisticsFit.volumeMedian) ? `${number.format(logisticsFit.volumeMedian)} L` : '—'} / {Number.isFinite(logisticsFit.volumeP75) ? `${number.format(logisticsFit.volumeP75)} L` : '—'}</dd></div>
            <div className="flex justify-between gap-4 px-4 py-3"><dt>价格价值密度中位数</dt><dd className="text-right">{Number.isFinite(logisticsFit.pricePerLiterMedian) ? `${formatRub(logisticsFit.pricePerLiterMedian)} / L` : '—'}</dd></div>
            <div className="flex justify-between gap-4 px-4 py-3"><dt>≤5 L 首轮筛选占比</dt><dd className="text-right">{logisticsFit.compactTestShare === null ? '—' : `${logisticsFit.compactTestShare}%`} · 字段覆盖 {logisticsFit.volumeCoverage}%</dd></div>
          </dl>
          <p className="mt-2 text-xs leading-5 text-gray-500">{competition.caveat} {logisticsFit.caveat}</p>
        </div>
      </div>

      <div className="mt-8">
        <h5 className="text-sm font-semibold text-morandi-text">品类进入优先级</h5>
        <p className="mt-1 text-sm leading-6 text-morandi-text-light">这是同一报告内部的探索排序，优先找“有需求、新品能跑、供给有波动、白牌仍有空间且便于跨境测试”的产品类型。</p>
        <div className="mt-3 max-h-[500px] overflow-auto border border-gray-200 bg-white">
          <table className="w-full min-w-[1060px] text-sm">
            <thead className="sticky top-0 bg-[#244b61] text-white">
              <tr><th className="p-3 text-left">优先级</th><th className="p-3 text-left">产品类型</th><th className="p-3 text-right">探索分</th><th className="p-3 text-right">销售额占比</th><th className="p-3 text-right">新品销售额占比</th><th className="p-3 text-right">单位 SKU 销售额</th><th className="p-3 text-right">缺货中位数</th><th className="p-3 text-right">未知品牌占比</th><th className="p-3 text-right">证据覆盖</th></tr>
            </thead>
            <tbody>
              {(typeOpportunities || []).map((item) => (
                <tr key={item.name} className="border-t border-gray-100 even:bg-gray-50">
                  <td className="p-3 font-medium text-blue-800">{item.decision}</td><td className="p-3 font-medium">{item.name}</td><td className="p-3 text-right tabular-nums">{item.score ?? '—'}</td><td className="p-3 text-right tabular-nums">{item.revenueShare}%</td><td className="p-3 text-right tabular-nums">{item.freshRevenueShare}%</td><td className="p-3 text-right tabular-nums">{formatRub(item.revenuePerSku)}</td><td className="p-3 text-right tabular-nums">{Number.isFinite(item.stockoutMedian) ? `${number.format(item.stockoutMedian)} 天` : '—'}</td><td className="p-3 text-right tabular-nums">{item.whiteLabelRevenueShare}%</td><td className="p-3 text-right tabular-nums">{item.evidenceCoverage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs leading-5 text-gray-500">{method.scoreWeights} {method.decisionRule} {method.boundary}</p>
      </div>

      <div className="mt-8 grid min-w-0 gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <h5 className="text-sm font-semibold text-morandi-text">进入俄罗斯前的法规预筛</h5>
          <p className="mt-2 text-sm leading-6 text-morandi-text-light">{context.compliance.summary}</p>
          {context.compliance.rules.length ? (
            <ul className="mt-3 space-y-2 text-sm leading-6 text-morandi-text">
              {context.compliance.rules.map((rule) => <li key={rule.code} className="border-l-2 border-amber-500 pl-3"><strong>{rule.code}</strong>：{rule.note}</li>)}
            </ul>
          ) : <p className="mt-3 border-l-2 border-amber-500 pl-3 text-sm text-morandi-text">{context.compliance.summary}</p>}
        </div>
        <div className="min-w-0">
          <h5 className="text-sm font-semibold text-morandi-text">进一步提高置信度需要什么</h5>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-morandi-text">
            {gaps.map((gap) => <li key={gap} className="flex gap-2"><span className="text-red-700">•</span><span>{gap}</span></li>)}
          </ul>
        </div>
      </div>

      <details className="mt-7 border-t border-gray-200 pt-4 text-sm">
        <summary className="cursor-pointer font-medium text-blue-800">查看俄罗斯外部证据来源</summary>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-morandi-text-light">
          {context.sources.map((source) => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer" className="font-medium text-blue-800 hover:underline">{source.title}</a><span> · {source.publisher}{source.asOf ? ` · 截至 ${source.asOf}` : ''}</span></li>)}
        </ul>
      </details>
    </section>
  )
}
