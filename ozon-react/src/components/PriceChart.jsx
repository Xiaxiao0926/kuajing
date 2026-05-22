import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { chartColors } from '../utils/chartConfigs'

export default function PriceChart({ priceData, data }) {
  if (!priceData || priceData.length === 0) {
    return (
      <div className="insight-card text-center py-12">
        <p className="text-morandi-text-light">数据中未找到价格信息</p>
      </div>
    )
  }

  const priceKeys = ['价格(₽)', '价格', 'Price', 'price']
  const priceCol = priceKeys.find(k => data[0]?.[k] !== undefined)
  
  const histogramData = data
    .map(row => parseFloat(row[priceCol]))
    .filter(p => !isNaN(p))
    .reduce((acc, price) => {
      const bucket = Math.floor(price / 2000) * 2000
      const existing = acc.find(a => a.range === `${bucket}-${bucket + 2000}`)
      if (existing) {
        existing.count++
      } else {
        acc.push({ range: `${bucket}-${bucket + 2000}`, count: 1 })
      }
      return acc
    }, [])
    .sort((a, b) => parseInt(a.range) - parseInt(b.range))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="insight-card">
        <h3 className="font-semibold text-morandi-text mb-4">价格区间分布</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={priceData}>
              <XAxis dataKey="range" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [value, '商品数量']}
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #E8E8E8',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="count" fill={chartColors.accent} radius={[4, 4, 0, 0]}>
                {priceData.map((entry, index) => (
                  <Cell key={index} fill={chartColors.palette[index % chartColors.palette.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="insight-card">
        <h3 className="font-semibold text-morandi-text mb-4">价格分布直方图</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histogramData.slice(0, 15)}>
              <XAxis dataKey="range" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" />
              <YAxis />
              <Tooltip 
                formatter={(value) => [value, '商品数量']}
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #E8E8E8',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="count" fill={chartColors.primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
