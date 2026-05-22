import { useMemo } from 'react'
import { Filter, Target, AlertCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { chartColors } from '../utils/chartConfigs'

const EXCHANGE_RATE = 0.075

export default function PriceBandAnalysis({ data }) {
  const priceBandData = useMemo(() => {
    if (!data || data.length === 0) return null
    
    const priceKeys = ['价格(₽)', '价格', 'Price']
    const priceCol = priceKeys.find(k => data[0]?.[k] !== undefined)
    
    const qtyKeys = ['月销量', '销量', 'Quantity']
    const qtyCol = qtyKeys.find(k => data[0]?.[k] !== undefined)
    
    const salesKeys = ['月销售额(₽)', '销售额(₽)', 'Sales']
    const salesCol = salesKeys.find(k => data[0]?.[k] !== undefined)
    
    const brandKeys = ['品牌', 'Brand']
    const brandCol = brandKeys.find(k => data[0]?.[k] !== undefined)
    
    if (!priceCol) return null
    
    const bands = [
      { name: '入门 (<2K)', min: 0, max: 2000 },
      { name: '中低 (2K-5K)', min: 2000, max: 5000 },
      { name: '中端 (5K-10K)', min: 5000, max: 10000 },
      { name: '中高 (10K-20K)', min: 10000, max: 20000 },
      { name: '高端 (20K-50K)', min: 20000, max: 50000 },
      { name: '奢侈 (>50K)', min: 50000, max: Infinity },
    ]
    
    const products = data.map(row => {
      const price = parseFloat(row[priceCol]) || 0
      const qty = qtyCol ? parseFloat(row[qtyCol]) || 0 : 0
      const sales = salesCol ? parseFloat(row[salesCol]) || 0 : (price * qty)
      const brand = brandCol ? row[brandCol] : 'Unknown'
      
      return { price, qty, sales, brand }
    })
    
    const bandStats = bands.map(band => {
      const productsInBand = products.filter(p => p.price >= band.min && p.price < band.max)
      return {
        name: band.name,
        count: productsInBand.length,
        totalQty: productsInBand.reduce((sum, p) => sum + p.qty, 0),
        totalSales: productsInBand.reduce((sum, p) => sum + p.sales, 0),
        avgPrice: productsInBand.length > 0 
          ? productsInBand.reduce((sum, p) => sum + p.price, 0) / productsInBand.length 
          : 0,
        avgQty: productsInBand.length > 0 
          ? productsInBand.reduce((sum, p) => sum + p.qty, 0) / productsInBand.length 
          : 0,
      }
    }).filter(b => b.count > 0)
    
    const totalProducts = products.length
    const totalSales = products.reduce((sum, p) => sum + p.sales, 0)
    
    const opportunityBand = bandStats.reduce((max, band) => 
      (band.avgQty * (band.count / totalProducts) > max.avgQty * (max.count / totalProducts)) ? band : max
    , bandStats[0])
    
    return {
      bandStats,
      products,
      totalProducts,
      totalSales,
      opportunityBand,
      maxPrice: Math.max(...products.map(p => p.price)),
      minPrice: Math.min(...products.map(p => p.price)),
    }
  }, [data])

  if (!priceBandData) {
    return (
      <div className="insight-card text-center py-12">
        <p className="text-morandi-text-light">数据中未找到价格信息</p>
      </div>
    )
  }

  const { bandStats, totalProducts, totalSales, opportunityBand, maxPrice, minPrice } = priceBandData

  const formatRUB = (v) => `₽${Math.round(v).toLocaleString()}`
  const formatRMB = (v) => `¥${Math.round(v * EXCHANGE_RATE).toLocaleString()}`

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="kpi-card">
          <Filter className="w-6 h-6 text-morandi-primary mb-2" />
          <div className="text-xl font-bold text-morandi-text">{bandStats.length}</div>
          <div className="text-xs text-morandi-text-light">价格带数量</div>
        </div>
        <div className="kpi-card">
          <Target className="w-6 h-6 text-morandi-accent mb-2" />
          <div className="text-xl font-bold text-morandi-text">
            {formatRUB((minPrice + maxPrice) / 2)}
          </div>
          <div className="text-xs text-morandi-text-light">
            {formatRMB((minPrice + maxPrice) / 2)}
          </div>
          <div className="text-xs text-morandi-text-light">价格中位数</div>
        </div>
        <div className="kpi-card">
          <div className="w-6 h-6 rounded-lg bg-morandi-success/10 flex items-center justify-center mb-2">
            <span className="text-morandi-success font-bold text-sm">₽</span>
          </div>
          <div className="text-xl font-bold text-morandi-text">
            {formatRUB(totalSales / totalProducts)}
          </div>
          <div className="text-xs text-morandi-text-light">
            {formatRMB(totalSales / totalProducts)}
          </div>
          <div className="text-xs text-morandi-text-light">件单价</div>
        </div>
        <div className="kpi-card">
          <AlertCircle className="w-6 h-6 text-morandi-warning mb-2" />
          <div className="text-xl font-bold text-morandi-text">{opportunityBand?.name?.split(' ')[0]}</div>
          <div className="text-xs text-morandi-text-light">机会价格带</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="insight-card">
          <h3 className="font-semibold text-morandi-text mb-4">💰 各价格带商品数量</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bandStats}>
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill={chartColors.primary} radius={[4, 4, 0, 0]}>
                  {bandStats.map((entry, index) => (
                    <Cell key={index} fill={chartColors.palette[index % chartColors.palette.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="insight-card">
          <h3 className="font-semibold text-morandi-text mb-4">📊 各价格带平均销量</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bandStats}>
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="avgQty" fill={chartColors.accent} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="insight-card">
        <h3 className="font-semibold text-morandi-text mb-4">📋 价格带详细分析</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">价格带</th>
                <th className="px-3 py-2 text-right">商品数</th>
                <th className="px-3 py-2 text-right">占比</th>
                <th className="px-3 py-2 text-right">总销量</th>
                <th className="px-3 py-2 text-right">总销售额 (₽/¥)</th>
                <th className="px-3 py-2 text-right">平均价格 (₽/¥)</th>
                <th className="px-3 py-2 text-right">平均销量</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bandStats.map((band, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{band.name}</td>
                  <td className="px-3 py-2 text-right">{band.count}</td>
                  <td className="px-3 py-2 text-right">{(band.count / totalProducts * 100).toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right">{band.totalQty.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">
                    <div>{formatRUB(band.totalSales)}</div>
                    <div className="text-xs text-morandi-text-light">{formatRMB(band.totalSales)}</div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div>{formatRUB(band.avgPrice)}</div>
                    <div className="text-xs text-morandi-text-light">{formatRMB(band.avgPrice)}</div>
                  </td>
                  <td className="px-3 py-2 text-right">{Math.round(band.avgQty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
