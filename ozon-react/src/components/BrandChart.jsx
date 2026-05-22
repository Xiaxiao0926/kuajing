import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts'
import { chartColors } from '../utils/chartConfigs'

export default function BrandChart({ brandData, concentration }) {
  if (!brandData || brandData.length === 0) {
    return (
      <div className="insight-card text-center py-12">
        <p className="text-morandi-text-light">数据中未找到品牌信息</p>
      </div>
    )
  }

  const top10Data = brandData.slice(0, 10)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="insight-card">
        <h3 className="font-semibold text-morandi-text mb-4">品牌市场份额</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={top10Data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="count"
                nameKey="brand"
                label={({ name, percent }) => `${name.slice(0, 8)} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {top10Data.map((entry, index) => (
                  <Cell key={entry.brand} fill={chartColors.palette[index % chartColors.palette.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value, name) => [value, name]}
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #E8E8E8',
                  borderRadius: '8px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="insight-card">
        <h3 className="font-semibold text-morandi-text mb-4">品牌商品数量 TOP 15</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={brandData.slice(0, 15)} layout="vertical">
              <XAxis type="number" />
              <YAxis 
                type="category" 
                dataKey="brand" 
                width={80}
                tick={{ fontSize: 11 }}
              />
              <Tooltip />
              <Bar dataKey="count" fill={chartColors.primary} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {concentration && (
        <div className="lg:col-span-2 insight-card">
          <h3 className="font-semibold text-morandi-text mb-4">📊 品牌集中度分析</h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="text-center p-4 bg-morandi-bg rounded-xl">
              <div className="text-3xl font-bold text-morandi-primary mb-1">
                {concentration.cr3}%
              </div>
              <div className="text-sm text-morandi-text-light">CR3 (前3品牌)</div>
            </div>
            <div className="text-center p-4 bg-morandi-bg rounded-xl">
              <div className="text-3xl font-bold text-morandi-secondary mb-1">
                {concentration.cr5}%
              </div>
              <div className="text-sm text-morandi-text-light">CR5 (前5品牌)</div>
            </div>
          </div>
          <p className="mt-4 text-sm text-morandi-text-light">
            {concentration.cr3 > 50 
              ? '⚠️ 市场集中度较高，头部品牌占据主导地位'
              : '✅ 市场竞争相对分散'
            }
          </p>
        </div>
      )}
    </div>
  )
}
