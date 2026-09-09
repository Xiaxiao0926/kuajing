const number = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 })

function formatRub(value) {
  if (!Number.isFinite(value)) return '—'
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)} 十亿 ₽`
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)} 百万 ₽`
  return `${number.format(value)} ₽`
}

function formatRatio(value, digits = 1) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : '—'
}

function Metric({ label, value, coverage }) {
  return (
    <div className="border-t-2 border-blue-700 bg-white px-4 py-3">
      <p className="text-xs text-morandi-text-light">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-morandi-text">{value}</p>
      {coverage !== undefined ? <p className="mt-1 text-xs text-gray-400">字段覆盖 {coverage}%</p> : null}
    </div>
  )
}

export default function MarketDecisionBrief({ brief }) {
  if (!brief?.marketDimensions) return null
  const { demand, supply, marketing, fulfillment, newness } = brief.marketDimensions

  return (
    <section className="mb-5 border border-gray-200 bg-[#f6f8f9] p-4 sm:p-5" aria-label="市场判断与选品建议">
      <div className="flex flex-col gap-1 border-b border-gray-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-blue-700">DECISION BRIEF</p>
          <h3 className="mt-1 text-xl font-semibold text-morandi-text">市场判断与首轮选品依据</h3>
        </div>
        <p className="text-xs text-morandi-text-light">BSR 样本内部分析，不等同 Ozon 全市场规模</p>
      </div>

      <div className="mt-4 grid gap-px border border-gray-200 bg-gray-200 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="180 天内新品" value={`${newness.freshCount} 个`} coverage={newness.listingDateCoverage} />
        <Metric label="新品销售额占比" value={`${newness.freshRevenueShare}%`} />
        <Metric label="下单转化率中位数" value={formatRatio(demand.orderConversionMedian)} coverage={demand.orderConversionCoverage} />
        <Metric label="缺货天数中位数" value={Number.isFinite(supply.stockoutMedian) ? `${number.format(supply.stockoutMedian)} 天` : '—'} coverage={supply.stockoutCoverage} />
        <Metric label="签收率中位数" value={formatRatio(fulfillment.signRateMedian)} coverage={fulfillment.signRateCoverage} />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.05fr_1.95fr]">
        <div>
          <h4 className="text-sm font-semibold text-morandi-text">五维市场信号</h4>
          <dl className="mt-3 divide-y divide-gray-200 border-y border-gray-200 bg-white text-sm">
            <div className="flex justify-between gap-4 px-4 py-3"><dt>需求漏斗</dt><dd className="text-right text-morandi-text-light">访问率 {formatRatio(demand.visitRate, 2)} · 加购 {formatRatio(demand.cartAddMedian)}</dd></div>
            <div className="flex justify-between gap-4 px-4 py-3"><dt>供给压力</dt><dd className="text-right text-morandi-text-light">错失销售额 {formatRub(supply.missedRevenue)}</dd></div>
            <div className="flex justify-between gap-4 px-4 py-3"><dt>库存覆盖</dt><dd className="text-right text-morandi-text-light">{Number.isFinite(supply.inventoryCoverMedian) ? `${number.format(supply.inventoryCoverMedian)} 天` : '—'} · 覆盖 {supply.inventoryCoverCoverage}%</dd></div>
            <div className="flex justify-between gap-4 px-4 py-3"><dt>促销依赖</dt><dd className="text-right text-morandi-text-light">促销活跃 {marketing.promoActiveShare ?? '—'}% · 广告活跃 {marketing.adActiveShare ?? '—'}%</dd></div>
            <div className="flex justify-between gap-4 px-4 py-3"><dt>履约结构</dt><dd className="text-right text-morandi-text-light">FBO/Ozon {fulfillment.fboShare ?? '—'}% · 模式覆盖 {fulfillment.deliveryCoverage}%</dd></div>
          </dl>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-morandi-text">给国内工厂的选品动作</h4>
          <div className="mt-3 space-y-3">
            {(brief.recommendations || []).map((item, index) => {
              const record = typeof item === 'string' ? { title: `建议 ${index + 1}`, recommendation: item, evidence: [], confidence: '待核验' } : item
              return (
                <div key={`${record.title}-${index}`} className="border-l-4 border-emerald-600 bg-white px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-morandi-text">{record.title}</p>
                    <span className="shrink-0 text-xs font-medium text-emerald-700">{record.confidence}置信度</span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-morandi-text-light">{record.recommendation}</p>
                  {record.evidence?.length ? <p className="mt-2 text-xs leading-5 text-gray-500">数据依据：{record.evidence.join(' · ')}</p> : null}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mt-7">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <h4 className="text-sm font-semibold text-morandi-text">上架 180 天内新品对标链接</h4>
          <p className="text-xs text-morandi-text-light">按样本销售额排序，须返回 Ozon 页面复核在售状态、评价和规格</p>
        </div>
        {(brief.newProducts || []).length ? (
          <div className="mt-3 max-h-[480px] overflow-auto border border-gray-200 bg-white">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="sticky top-0 bg-[#244b61] text-white">
                <tr><th className="p-3 text-left">#</th><th className="p-3 text-left">新品</th><th className="p-3 text-left">类型</th><th className="p-3 text-right">已上架</th><th className="p-3 text-right">销售额</th><th className="p-3 text-right">销量</th><th className="p-3 text-right">均价</th></tr>
              </thead>
              <tbody>
                {brief.newProducts.map((item, index) => (
                  <tr key={`${item.url}-${index}`} className="border-t border-gray-100 even:bg-gray-50">
                    <td className="p-3">{index + 1}</td>
                    <td className="max-w-[380px] p-3 font-medium text-blue-800"><a href={item.url} target="_blank" rel="noreferrer" className="hover:underline">{item.name}</a></td>
                    <td className="p-3">{item.type}</td>
                    <td className="p-3 text-right tabular-nums">{item.ageDays} 天</td>
                    <td className="p-3 text-right tabular-nums">{formatRub(item.revenue)}</td>
                    <td className="p-3 text-right tabular-nums">{Number.isFinite(item.sales) ? number.format(item.sales) : '—'}</td>
                    <td className="p-3 text-right tabular-nums">{formatRub(item.avgPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">当前没有同时满足有效日期、180 天窗口和有效商品链接的记录，不跨日期补位。</p>
        )}
      </div>
    </section>
  )
}
