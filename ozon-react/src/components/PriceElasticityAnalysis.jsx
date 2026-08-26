import { useMemo } from 'react'
import { Search, Target, Zap } from 'lucide-react'
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts'
import { chartColors } from '../utils/chartConfigs'
import { R as EXCHANGE_RATE } from '../utils/ozonEngine'

export default function PriceElasticityAnalysis({ data }) {
  const elasticityData = useMemo(() => {
    if (!data || data.length === 0) return null
    
    const priceKeys = ['价格(₽)', '价格', 'Price']
    const priceCol = priceKeys.find(k => data[0]?.[k] !== undefined)
    
    const qtyKeys = ['月销量', '销量', 'Quantity']
    const qtyCol = qtyKeys.find(k => data[0]?.[k] !== undefined)
    
    const brandKeys = ['品牌', 'Brand']
    const brandCol = brandKeys.find(k => data[0]?.[k] !== undefined)
    
    const nameKeys = ['商品名称', '产品名称', 'name', 'title']
    const nameCol = nameKeys.find(k => data[0]?.[k] !== undefined)
    
    if (!priceCol || !qtyCol) return null
    
    const products = data.map(row => {
      const price = parseFloat(row[priceCol]) || 0
      const qty = parseFloat(row[qtyCol]) || 0
      const sales = price * qty
      const brand = brandCol ? row[brandCol] || 'Other' : 'Other'
      const name = nameCol ? row[nameCol] : 'Unknown'
      
      return { price, qty, sales, brand, name }
    }).filter(p => p.price > 0 && p.qty > 0)
    
    const avgQty = products.reduce((sum, p) => sum + p.qty, 0) / products.length
    const qtyStd = Math.sqrt(products.reduce((sum, p) => sum + Math.pow(p.qty - avgQty, 2), 0) / products.length)
    
    const opportunityProducts = products.filter(p => 
      p.price > 5000 && p.qty >= avgQty * 0.5
    )
    
    const vacuumZone = products.filter(p => 
      p.price > 5000 && p.qty > avgQty
    )
    
    const brandColors = {}
    const uniqueBrands = [...new Set(products.map(p => p.brand))]
    uniqueBrands.forEach((brand, idx) => {
      brandColors[brand] = chartColors.palette[idx % chartColors.palette.length]
    })
    
    const chartData = products.map(p => ({
      ...p,
      color: brandColors[p.brand],
      isOpportunity: p.price > 5000 && p.qty >= avgQty * 0.5,
      isVacuum: p.price > 5000 && p.qty > avgQty
    }))
    
    return {
      chartData,
      brandColors,
      avgQty: Math.round(avgQty),
      qtyStd: Math.round(qtyStd),
      opportunityCount: opportunityProducts.length,
      vacuumCount: vacuumZone.length,
      maxPrice: Math.max(...products.map(p => p.price)),
      maxQty: Math.max(...products.map(p => p.qty)),
      maxSales: Math.max(...products.map(p => p.sales))
    }
  }, [data])

  if (!elasticityData) {
    return (
      <div className="insight-card text-center py-12">
        <p className="text-morandi-text-light">数据中未找到价格和销量信息</p>
      </div>
    )
  }

  const { chartData, brandColors, avgQty, opportunityCount, vacuumCount, maxPrice, maxQty, maxSales } = elasticityData

  const formatRUB = (v) => `₽${Math.round(v).toLocaleString()}`
  const formatRMB = (v) => `¥${Math.round(v * EXCHANGE_RATE).toLocaleString()}`

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="kpi-card">
          <Search className="w-6 h-6 text-morandi-primary mb-2" />
          <div className="text-xl font-bold text-morandi-text">{avgQty}</div>
          <div className="text-xs text-morandi-text-light">平均月销量</div>
        </div>
        <div className="kpi-card">
          <Zap className="w-6 h-6 text-morandi-warning mb-2" />
          <div className="text-xl font-bold text-morandi-text">{opportunityCount}</div>
          <div className="text-xs text-morandi-text-light">品质替代机会点</div>
        </div>
        <div className="kpi-card">
          <Target className="w-6 h-6 text-morandi-success mb-2" />
          <div className="text-xl font-bold text-morandi-text">{vacuumCount}</div>
          <div className="text-xs text-morandi-text-light">真空地带产品</div>
        </div>
        <div className="kpi-card">
          <div className="w-6 h-6 rounded-lg bg-morandi-accent/10 flex items-center justify-center mb-2">
            <span className="text-morandi-accent font-bold">₽</span>
          </div>
          <div className="text-xl font-bold text-morandi-text">
            {Math.round(chartData.filter(p => p.price > 5000).reduce((sum, p) => sum + p.sales, 0) / 1000000)}M
          </div>
          <div className="text-xs text-morandi-text-light">高价区销售额</div>
        </div>
      </div>

      <div className="insight-card">
        <h3 className="font-semibold text-morandi-text mb-4">
          💎 价格弹性象标图 - 寻找蓝海机会
        </h3>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <XAxis 
                type="number" 
                dataKey="price" 
                name="价格" 
                unit="₽" 
                domain={[0, maxPrice * 1.1]}
                tick={{ fontSize: 11 }}
                label={{ value: '价格 (₽)', position: 'bottom', offset: 0 }}
              />
              <YAxis 
                type="number" 
                dataKey="qty" 
                name="销量"
                unit="" 
                domain={[0, maxQty * 1.1]}
                tick={{ fontSize: 11 }}
                label={{ value: '月销量', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload
                    return (
                      <div className="bg-white p-3 shadow-lg rounded-lg border border-gray-100 text-sm">
                        <p className="font-medium">{data.name?.slice(0, 30)}</p>
                        <p className="text-morandi-text-light">品牌: {data.brand}</p>
                        <p>价格: {formatRUB(data.price)} ({formatRMB(data.price)})</p>
                        <p>月销量: {data.qty.toLocaleString()}</p>
                        <p>销售额: {formatRUB(data.sales)} ({formatRMB(data.sales)})</p>
                        {data.isVacuum && <p className="text-green-600 font-medium">⭐ 真空地带</p>}
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Legend />
              
              <line x1={5000} x2={5000} y1={0} y2={maxQty * 1.1} stroke="#E57373" strokeDasharray="5 5" />
              <line x1={0} x2={maxPrice * 1.1} y1={avgQty} y2={avgQty} stroke="#E57373" strokeDasharray="5 5" />
              
              <Scatter 
                name="普通产品" 
                data={chartData.filter(p => !p.isOpportunity)} 
                fill="#9E9E9E"
                opacity={0.6}
              />
              <Scatter 
                name="品质替代机会" 
                data={chartData.filter(p => p.isOpportunity && !p.isVacuum)} 
                fill="#FF9800"
              />
              <Scatter 
                name="真空地带 ⭐" 
                data={chartData.filter(p => p.isVacuum)} 
                fill="#4CAF50"
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 p-3 bg-morandi-bg rounded-lg">
          <p className="text-sm text-morandi-text-light">
            💡 <strong>图表说明：</strong>右上角区域（价格 &gt; 5000₽/¥375 且销量高于平均）为"品质替代"真空地带，高价但销量稳定，代表蓝海机会点。绿色气泡为高机会产品，橙色为次优机会。
          </p>
        </div>
      </div>

      {chartData.filter(p => p.isVacuum).length > 0 && (
        <div className="insight-card">
          <h3 className="font-semibold text-morandi-text mb-4">⭐ 真空地带产品清单 (高价稳定销量)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">产品名称</th>
                  <th className="px-3 py-2 text-left">品牌</th>
                  <th className="px-3 py-2 text-right">价格 (₽/¥)</th>
                  <th className="px-3 py-2 text-right">月销量</th>
                  <th className="px-3 py-2 text-right">销售额 (₽/¥)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {chartData.filter(p => p.isVacuum).slice(0, 10).map((p, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-3 py-2 max-w-xs truncate">{p.name}</td>
                    <td className="px-3 py-2">{p.brand}</td>
                    <td className="px-3 py-2 text-right">
                      <div>{formatRUB(p.price)}</div>
                      <div className="text-xs text-morandi-text-light">{formatRMB(p.price)}</div>
                    </td>
                    <td className="px-3 py-2 text-right">{p.qty.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">
                      <div>{formatRUB(p.sales)}</div>
                      <div className="text-xs text-morandi-text-light">{formatRMB(p.sales)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
