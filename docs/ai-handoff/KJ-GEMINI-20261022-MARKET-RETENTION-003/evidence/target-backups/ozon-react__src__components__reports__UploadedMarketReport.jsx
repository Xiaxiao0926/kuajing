import MarketDecisionBrief from './MarketDecisionBrief.jsx'

const number = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 })

function formatRub(value) {
  if (!Number.isFinite(value)) return '—'
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)} 十亿 ₽`
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)} 百万 ₽`
  return `${number.format(value)} ₽`
}

function formatCount(value) {
  if (!Number.isFinite(value)) return '—'
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)} 百万`
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)} 千`
  return number.format(value)
}

function BarList({ items, valueKey = 'revenue', suffix = '₽' }) {
  const max = Math.max(...items.map((item) => Number(item[valueKey]) || 0), 1)
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={`${item.name || item.label}-${index}`}>
          <div className="mb-1 flex items-center justify-between gap-3 text-xs">
            <span className="min-w-0 truncate font-medium text-morandi-text">{item.name || item.label}</span>
            <span className="shrink-0 tabular-nums text-morandi-text-light">
              {valueKey === 'revenue' ? formatRub(item[valueKey]) : `${number.format(item[valueKey])} ${suffix}`}
            </span>
          </div>
          <div className="h-2 overflow-hidden bg-gray-100">
            <div className="h-full bg-blue-600" style={{ width: `${Math.max(2, (Number(item[valueKey]) || 0) / max * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function UploadedMarketReport({ report }) {
  const operations = report.operations || {}
  const quality = report.quality || {}

  return (
    <article className="overflow-hidden border border-gray-200 bg-white">
      <header className="border-b-4 border-emerald-600 bg-[#173a50] px-5 py-8 text-white sm:px-8 sm:py-10">
        <p className="text-xs font-semibold text-emerald-200">OZON BSR1000 · 自动生成报告</p>
        <h3 className="mt-2 text-3xl font-semibold leading-tight text-white sm:text-4xl">{report.label}市场分析</h3>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">
          以导入的商品级记录观察类目规模、价格结构、品牌和卖家集中度。销售额为主排序口径，不将榜单样本外推为 Ozon 全站市场规模。
        </p>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-300">
          <span>数据快照 {report.snapshot}</span><span>{report.sample}</span><span>源文件 {report.sourceFile}</span>
        </div>
      </header>

      <div className="p-4 sm:p-6">
        <div className="grid gap-px border border-gray-200 bg-gray-200 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ['样本销售额', formatRub(report.kpis.totalRevenue), '以卢布为主口径'],
            ['已记录销量', `${formatCount(report.kpis.totalSales)} 件`, `字段覆盖 ${quality.salesCoverage}%`],
            ['销售额 / 销量', formatRub(report.kpis.unitRevenue), '统计比值，不等同标价'],
            ['产品类型', number.format(report.kpis.typeCount), '按清洗表字段'],
            ['品牌 / 卖家', `${report.kpis.brandCount} / ${report.kpis.sellerCount}`, '排除未知桶'],
          ].map(([label, value, hint]) => (
            <div key={label} className="bg-white p-4">
              <p className="text-xs text-morandi-text-light">{label}</p>
              <p className="mt-1 text-xl font-semibold text-morandi-text">{value}</p>
              <p className="mt-1 text-xs text-gray-400">{hint}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>{quality.level}</strong>
          <span className="ml-2 text-amber-900">销量缺失 {quality.missingSales} 条，均价缺失 {quality.missingAveragePrice} 条，SKU 重复 {quality.duplicateSku} 条，产品链接重复 {quality.duplicateUrl} 条。</span>
        </div>

        <section className="mt-8">
          <h4 className="text-lg font-semibold text-morandi-text">核心发现</h4>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {report.insights.map((insight, index) => (
              <div key={insight} className="border border-gray-200 p-4 text-sm leading-6 text-morandi-text">
                <span className="mr-2 font-semibold text-red-700">0{index + 1}</span>{insight}
              </div>
            ))}
          </div>
        </section>

        <div className="mt-8"><MarketDecisionBrief brief={report} /></div>

        <section className="mt-8 grid gap-5 xl:grid-cols-2">
          <div className="border border-gray-200 p-4">
            <h4 className="mb-4 text-sm font-semibold text-morandi-text">头部产品类型</h4>
            <BarList items={report.topTypes} />
          </div>
          <div className="border border-gray-200 p-4">
            <h4 className="mb-4 text-sm font-semibold text-morandi-text">价格带销售额</h4>
            <BarList items={report.priceBands.map((item) => ({ ...item, name: item.label }))} />
          </div>
          <div className="border border-gray-200 p-4">
            <h4 className="mb-4 text-sm font-semibold text-morandi-text">头部品牌</h4>
            <BarList items={report.topBrands} />
          </div>
          <div className="border border-gray-200 p-4">
            <h4 className="mb-4 text-sm font-semibold text-morandi-text">头部卖家</h4>
            <BarList items={report.topSellers} />
          </div>
        </section>

        <section className="mt-8">
          <h4 className="text-lg font-semibold text-morandi-text">运营字段覆盖</h4>
          <div className="mt-3 grid gap-px border border-gray-200 bg-gray-200 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['签收率中位数', operations.signRateMedian === null ? '—' : `${(operations.signRateMedian * 100).toFixed(1)}%`, operations.signRateCoverage],
              ['无库存天数中位数', operations.stockoutMedian === null ? '—' : `${operations.stockoutMedian} 天`, operations.stockoutCoverage],
              ['有促销记录占比', operations.promoActiveShare === null ? '—' : `${operations.promoActiveShare}%`, operations.promoCoverage],
              ['有推广记录占比', operations.adActiveShare === null ? '—' : `${operations.adActiveShare}%`, operations.adCoverage],
            ].map(([label, value, coverage]) => (
              <div key={label} className="bg-white p-4">
                <p className="text-xs text-morandi-text-light">{label}</p>
                <p className="mt-1 text-lg font-semibold text-morandi-text">{value}</p>
                <p className="mt-1 text-xs text-gray-400">字段覆盖 {coverage}%</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h4 className="text-lg font-semibold text-morandi-text">头部商品观察</h4>
          <p className="mt-1 text-sm text-morandi-text-light">按销售额排序；点击商品名可返回 Ozon 页面继续核验。</p>
          <div className="mt-3 max-h-[560px] overflow-auto border border-gray-200">
            <table className="min-w-[860px] w-full text-sm">
              <thead className="sticky top-0 bg-[#244b61] text-white">
                <tr><th className="p-3 text-left">#</th><th className="p-3 text-left">产品</th><th className="p-3 text-left">类型</th><th className="p-3 text-left">品牌</th><th className="p-3 text-right">销售额(₽)</th><th className="p-3 text-right">销量</th><th className="p-3 text-right">均价(₽)</th></tr>
              </thead>
              <tbody>
                {report.topProducts.map((item, index) => (
                  <tr key={`${item.url}-${index}`} className="border-t border-gray-100 even:bg-gray-50">
                    <td className="p-3">{index + 1}</td>
                    <td className="max-w-[360px] p-3 font-medium text-blue-800">{item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="hover:underline">{item.name}</a> : item.name}</td>
                    <td className="p-3">{item.type}</td><td className="p-3">{item.brand}</td>
                    <td className="p-3 text-right tabular-nums">{number.format(item.revenue)}</td>
                    <td className="p-3 text-right tabular-nums">{item.sales === null ? '—' : number.format(item.sales)}</td>
                    <td className="p-3 text-right tabular-nums">{item.avgPrice === null ? '—' : number.format(item.avgPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="mt-8 border-t border-gray-200 pt-4 text-xs leading-5 text-morandi-text-light">
          {report.persistenceNote || '原始数据与本报告 JSON 均保存于服务器私有目录。榜单样本适合比较内部结构；利润决策仍需补齐采购价、物流、退货、税费、合规与实时汇率。'}
        </footer>
      </div>
    </article>
  )
}
