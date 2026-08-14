import { Eye, ShoppingCart, DollarSign, Package, Target, BarChart3, Truck, Percent, Crown } from 'lucide-react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts'
import { R, fmtCNY, fmtCNYFull } from '../dictionary'
import { KPICard } from '../Cards'

export default function HeaderOverview({ stats, data, CC, showAllSizes, setShowAllSizes, showAllMaterials, setShowAllMaterials }) {
  return (
    <>
      <div className="bg-gradient-to-r from-morandi-primary to-morandi-secondary rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">📊 Ozon电商市场深度分析</h1>
        <p className="opacity-90">所属类目: {stats.topCategory} | 数据维度: {data.length} 个商品 | {stats.brandCount} 个品牌 | 报告日期: {new Date().toLocaleDateString('zh-CN')} | 汇率: 1₽=¥0.09</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KPICard icon={<DollarSign className="w-5 h-5" />} title="总销售额" value={`¥${fmtCNY(stats.totalSales)}`} sub={`₽${fmtCNY(stats.totalSales / R)}`} trend={stats.totalSales > 50000000 ? 'up' : 'neutral'} />
        <KPICard icon={<Package className="w-5 h-5" />} title="总销量" value={stats.totalQty.toLocaleString()} sub={`${stats.productCount}个商品`} trend="up" />
        <KPICard icon={<Eye className="w-5 h-5" />} title="曝光量" value={stats.totalExposure.toLocaleString()} sub={`CTR ${stats.avgClickRate}%`} trend="neutral" />
        <KPICard icon={<Target className="w-5 h-5" />} title="广告投入" value={`¥${fmtCNY(stats.totalAdCost)}`} sub={`₽${fmtCNY(stats.totalAdCost / R)}`} trend={stats.totalAdCost > 100000 ? 'down' : 'neutral'} />
        <KPICard icon={<Percent className="w-5 h-5" />} title="平均毛利率" value={stats.avgGross != null && stats.avgGross > 0 ? `${stats.avgGross.toFixed(1)}%` : '未知'} sub="预估毛利率" trend={stats.avgGross != null && stats.avgGross > 30 ? 'up' : 'neutral'} />
        <KPICard icon={<ShoppingCart className="w-5 h-5" />} title="加购率" value={`${stats.avgCartRate?.toFixed(2)}%`} sub="购物车转化" trend="neutral" />
        <KPICard icon={<BarChart3 className="w-5 h-5" />} title="平均客单价" value={`¥${Math.round(stats.avgPrice * R).toLocaleString()}`} sub={`₽${Math.round(stats.avgPrice).toLocaleString()}`} trend="neutral" />
        <KPICard icon={<Crown className="w-5 h-5" />} title="市场集中度" value={`${stats.marketConcentration?.toFixed(0)}%`} sub="Top3品牌占比" trend={stats.marketConcentration > 50 ? 'down' : 'up'} />
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-morandi-text mb-4">🌡️ 俄罗斯电商市场季节销量波动</h3>
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.seasonalData} margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `¥${v}`} tick={{ fontSize: 10 }} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]?.payload
                  return (
                    <div className="bg-white p-3 shadow-lg rounded-lg text-xs border">
                      <p className="font-medium mb-1">{d?.month}</p>
                      <p className="text-blue-600">销量指数: {d?.salesIndex}%</p>
                      <p className="text-orange-600">均价(¥): {Math.round(d?.avgPrice).toLocaleString()}</p>
                      <p className="text-green-600">搜索热度: {d?.searchIndex}%</p>
                      <p className="text-purple-600 mt-1 font-medium">{d?.insight}</p>
                    </div>
                  )
                }} />
                <Line yAxisId="left" type="monotone" dataKey="salesIndex" stroke="#8B9DC3" strokeWidth={2.5} dot={{ r: 4, fill: '#8B9DC3' }} name="销量指数" />
                <Line yAxisId="left" type="monotone" dataKey="searchIndex" stroke="#4CAF50" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: '#4CAF50' }} name="搜索热度" />
                <Line yAxisId="right" type="monotone" dataKey="avgPrice" stroke="#FF9800" strokeWidth={2} dot={{ r: 3, fill: '#FF9800' }} name="均价(¥)" />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-6 mt-2 text-xs text-morandi-text-light">
              <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#8B9DC3] inline-block"></span> 销量指数</span>
              <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#4CAF50] inline-block border-dashed"></span> 搜索热度</span>
              <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#FF9800] inline-block"></span> 均价(¥)</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="bg-red-50 rounded-lg p-3">
              <div className="text-xs text-red-500 font-medium mb-1">🔥 旺季 ({stats.seasonalAdvice?.peak?.months || '10月-2月'})</div>
              <div className="text-xs text-red-600">{stats.seasonalAdvice?.peak?.text || '黑五/圣诞/新年促销叠加，销量可达淡季2-3倍'}</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-xs text-blue-500 font-medium mb-1">❄️ 平季 ({stats.seasonalAdvice?.shoulder?.months || '3月-5月'})</div>
              <div className="text-xs text-blue-600">{stats.seasonalAdvice?.shoulder?.text || '春季需求回落但仍稳定，适合新品上架测试市场反应'}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 font-medium mb-1">📉 淡季 ({stats.seasonalAdvice?.low?.months || '6月-9月'})</div>
              <div className="text-xs text-gray-600">{stats.seasonalAdvice?.low?.text || '夏季需求最低，但细分品类仍有小高峰'}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 border border-green-200">
              <div className="text-xs text-green-600 font-medium mb-1">💡 进入时机建议</div>
              <div className="text-xs text-green-700">{stats.seasonalAdvice?.entry || '建议旺季前2个月备货入仓，旺季前1个月启动广告，旺季首月冲刺销量'}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4 flex items-center gap-2"><Crown className="w-5 h-5 text-morandi-primary" /> 品牌销售额TOP10</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={stats.topBrands} layout="vertical" margin={{ left: 80 }}>
              <XAxis type="number" tickFormatter={(v) => `¥${fmtCNY(v)}`} />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => [`¥${fmtCNYFull(v)}`, '销售额']} />
              <Bar dataKey="sales" fill="#8B9DC3" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4 flex items-center gap-2"><Truck className="w-5 h-5 text-morandi-primary" /> 发货模式分布</h3>
          {stats.shippingData.filter(d => d.name !== '未知').length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie data={stats.shippingData.filter(d => d.name !== '未知')} cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={2} dataKey="count" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {stats.shippingData.filter(d => d.name !== '未知').map((_, i) => <Cell key={i} fill={CC[i % CC.length]} />)}
              </Pie>
              <Tooltip formatter={(v, n) => n === 'qty' ? `${v}个` : `${v}款`} />
            </PieChart>
          </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[320px] text-morandi-text-light">
              <div className="text-center">
                <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">当前数据不含发货模式信息</p>
                <p className="text-xs mt-1">上传包含FBO/FBS字段的数据可查看分布</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-morandi-text mb-4 flex items-center gap-2"><Truck className="w-5 h-5 text-morandi-primary" /> FBS vs FBO 发货方式销量对比</h3>
        {stats.fbsFboChartData.length > 0 ? (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.fbsFboChartData} margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tickFormatter={(v) => v.toLocaleString()} tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `¥${fmtCNY(v)}`} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v, n) => n === '销量' || n === 'qty' ? `${Math.round(v).toLocaleString()}个` : `¥${fmtCNYFull(v)}`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="qty" fill="#8B9DC3" name="销量" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="sales" fill="#D4C4B0" name="销售额" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            {stats.fbsFboChartData.map((item, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-3 h-3 rounded-full ${i === 0 ? 'bg-[#8B9DC3]' : i === 1 ? 'bg-[#D4C4B0]' : 'bg-[#C3B4D1]'}`}></span>
                  <span className="text-sm font-medium text-morandi-text">{item.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-morandi-text-light">销量:</span> <strong>{item.qty.toLocaleString()}</strong></div>
                  <div><span className="text-morandi-text-light">销售额:</span> <strong>¥{fmtCNYFull(item.sales)}</strong></div>
                  <div><span className="text-morandi-text-light">商品数:</span> <strong>{item.count}</strong></div>
                  <div><span className="text-morandi-text-light">均价:</span> <strong>¥{Math.round(item.avgPrice * R).toLocaleString()}</strong></div>
                </div>
              </div>
            ))}
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <div className="text-xs text-blue-600 font-medium mb-1">💡 发货方式建议</div>
              <div className="text-xs text-blue-700">
                {stats.fbsFboChartData.length > 0 && (() => {
                  const top = [...stats.fbsFboChartData].sort((a, b) => b.qty - a.qty)[0]
                  return `${top.name}模式销量最高，建议新卖家优先选择${top.name}以获取更多流量`
                })()}
              </div>
            </div>
          </div>
        </div>
        ) : (
          <div className="flex items-center justify-center h-[200px] text-morandi-text-light">
            <div className="text-center">
              <Truck className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">当前数据不含FBO/FBS发货模式信息</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4">💰 价格带分布与市场竞争</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.priceData}>
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis yAxisId="left" tickFormatter={(v) => `¥${fmtCNY(v)}`} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}个`} />
              <Tooltip formatter={(v, n) => n === 'count' ? `${v}个` : `¥${fmtCNYFull(v)}`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="sales" fill="#8B9DC3" name="销售额" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="count" fill="#D4C4B0" name="产品数" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="bg-gray-50"><th className="px-2 py-2 text-left">价格带</th><th className="px-2 py-2 text-right">商品数</th><th className="px-2 py-2 text-right">占比</th><th className="px-2 py-2 text-right">总销售额(¥)</th><th className="px-2 py-2 text-right">平均价格(¥)</th><th className="px-2 py-2 text-right">平均日销</th></tr></thead>
              <tbody>
                {stats.priceData.map((p, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-2 py-2 font-medium">{p.name}</td>
                    <td className="px-2 py-2 text-right">{p.count}</td>
                    <td className="px-2 py-2 text-right">{(p.count / stats.productCount * 100).toFixed(1)}%</td>
                    <td className="px-2 py-2 text-right font-medium">¥{fmtCNYFull(p.sales)}</td>
                    <td className="px-2 py-2 text-right">¥{fmtCNYFull(p.sales / p.qty || 0)}</td>
                    <td className="px-2 py-2 text-right">{Math.round(p.qty / 30).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4">📊 各价格带广告投入分析</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.priceData}>
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis yAxisId="left" tickFormatter={(v) => `¥${fmtCNY(v)}`} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v, n) => n === 'avgAdRatio' ? `${v.toFixed(1)}%` : `¥${fmtCNYFull(v)}`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="avgAdCost" fill="#FF9800" name="平均广告费" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="avgAdRatio" fill="#7C4DFF" name="广告占比" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="bg-gray-50"><th className="px-2 py-2 text-left">价格带</th><th className="px-2 py-2 text-right">总广告费(¥)</th><th className="px-2 py-2 text-right">平均广告费(¥)</th><th className="px-2 py-2 text-right">广告占比</th><th className="px-2 py-2 text-right">ROI</th><th className="px-2 py-2 text-left">建议</th></tr></thead>
              <tbody>
                {stats.priceData.map((p, i) => {
                  const r = p.avgAdRatio || 0
                  const roi = p.avgAdCost > 0 && p.avgPrice > 0 ? (p.avgPrice / p.avgAdCost).toFixed(1) : '-'
                  const sug = r > 10 ? '⚠️占比过高' : r > 5 ? '适中' : '✅可增加'
                  return (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-2 py-2 font-medium">{p.name}</td>
                      <td className="px-2 py-2 text-right">¥{fmtCNYFull(p.adCost)}</td>
                      <td className="px-2 py-2 text-right">¥{fmtCNYFull(p.avgAdCost)}</td>
                      <td className="px-2 py-2 text-right"><span className={`px-1 py-0.5 rounded text-xs ${r > 10 ? 'bg-red-100 text-red-700' : r > 5 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{r.toFixed(2)}%</span></td>
                      <td className="px-2 py-2 text-right font-medium">{roi}</td>
                      <td className="px-2 py-2 text-morandi-text-light">{sug}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {stats.isPillowCategory && stats.sizeMaterialData && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4">📐 尺寸与材质统计分析</h3>
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-700">{stats.sizeMaterialData.sizeData.length}</div>
              <div className="text-xs text-blue-600">尺寸规格数</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-700">{stats.sizeMaterialData.materialData.length}</div>
              <div className="text-xs text-green-600">材质类型数</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-purple-700">{stats.sizeMaterialData.topSize}</div>
              <div className="text-xs text-purple-600">最热尺寸</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-orange-700">{stats.sizeMaterialData.topMaterial}</div>
              <div className="text-xs text-orange-600">最热材质</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3 flex items-center gap-2">📏 尺寸分布 <span className="text-xs text-morandi-text-light font-normal">识别率 {stats.sizeMaterialData.sizeCoverage}%</span></h4>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.sizeMaterialData.sizeData.slice(0, 8)} layout="vertical" margin={{ left: 60 }}>
                  <XAxis type="number" tickFormatter={v => `¥${fmtCNY(v)}`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v, n) => n === 'sales' ? `¥${fmtCNYFull(v)}` : n === 'count' ? `${v}款` : v} />
                  <Bar dataKey="sales" fill="#8B9DC3" name="销售额" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50"><th className="px-2 py-1 text-left">尺寸(cm)</th><th className="px-2 py-1 text-right">商品数</th><th className="px-2 py-1 text-right">占比</th><th className="px-2 py-1 text-right">销售额(¥)</th><th className="px-2 py-1 text-right">均价(¥)</th></tr></thead>
                  <tbody>
                    {stats.sizeMaterialData.sizeData.slice(0, showAllSizes ? undefined : 10).map((s, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-2 py-1 font-medium">{s.name}</td>
                        <td className="px-2 py-1 text-right">{s.count}</td>
                        <td className="px-2 py-1 text-right">{s.share}%</td>
                        <td className="px-2 py-1 text-right font-medium">¥{fmtCNYFull(s.sales)}</td>
                        <td className="px-2 py-1 text-right">¥{Math.round(s.avgPrice * R).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {stats.sizeMaterialData.sizeData.length > 10 && (
                  <button onClick={() => setShowAllSizes(!showAllSizes)} className="mt-2 w-full text-center text-xs text-morandi-primary hover:underline py-1">
                    {showAllSizes ? '收起' : `展开全部 ${stats.sizeMaterialData.sizeData.length} 个尺寸`}
                  </button>
                )}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3 flex items-center gap-2">🧵 材质分布 <span className="text-xs text-morandi-text-light font-normal">识别率 {stats.sizeMaterialData.materialCoverage}%</span></h4>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={stats.sizeMaterialData.materialData} cx="50%" cy="50%" innerRadius={50} outerRadius={95} paddingAngle={2} dataKey="count" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {stats.sizeMaterialData.materialData.map((_, i) => <Cell key={i} fill={CC[i % CC.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, n, p) => [`${v}款 (¥${fmtCNYFull(p.payload.sales)})`, p.payload.name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50"><th className="px-2 py-1 text-left">材质</th><th className="px-2 py-1 text-right">商品数</th><th className="px-2 py-1 text-right">占比</th><th className="px-2 py-1 text-right">销售额(¥)</th><th className="px-2 py-1 text-right">均价(¥)</th></tr></thead>
                  <tbody>
                    {stats.sizeMaterialData.materialData.slice(0, showAllMaterials ? undefined : 10).map((m, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-2 py-1 font-medium">{m.name}</td>
                        <td className="px-2 py-1 text-right">{m.count}</td>
                        <td className="px-2 py-1 text-right">{m.share}%</td>
                        <td className="px-2 py-1 text-right font-medium">¥{fmtCNYFull(m.sales)}</td>
                        <td className="px-2 py-1 text-right">¥{Math.round(m.avgPrice * R).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {stats.sizeMaterialData.materialData.length > 10 && (
                  <button onClick={() => setShowAllMaterials(!showAllMaterials)} className="mt-2 w-full text-center text-xs text-morandi-primary hover:underline py-1">
                    {showAllMaterials ? '收起' : `展开全部 ${stats.sizeMaterialData.materialData.length} 种材质`}
                  </button>
                )}
              </div>
            </div>
          </div>

          {stats.sizeMaterialData.crossData.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3">🔗 尺寸×材质交叉分析 (TOP组合)</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50"><th className="px-2 py-1 text-left">排名</th><th className="px-2 py-1 text-left">尺寸(cm)</th><th className="px-2 py-1 text-left">材质</th><th className="px-2 py-1 text-right">商品数</th><th className="px-2 py-1 text-right">销售额(¥)</th><th className="px-2 py-1 text-right">均价(¥)</th><th className="px-2 py-1 text-right">销量</th></tr></thead>
                  <tbody>
                    {stats.sizeMaterialData.crossData.slice(0, 15).map((c, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-2 py-1"><span className={`inline-block w-5 h-5 rounded-full text-xs text-center leading-5 ${i < 3 ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-600'}`}>{i + 1}</span></td>
                        <td className="px-2 py-1 font-medium">{c.size}</td>
                        <td className="px-2 py-1"><span className="px-2 py-0.5 bg-morandi-primary/10 text-morandi-primary rounded-full text-xs">{c.material}</span></td>
                        <td className="px-2 py-1 text-right">{c.count}</td>
                        <td className="px-2 py-1 text-right font-medium">¥{fmtCNYFull(c.sales)}</td>
                        <td className="px-2 py-1 text-right">¥{Math.round(c.avgPrice * R).toLocaleString()}</td>
                        <td className="px-2 py-1 text-right">{c.qty.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 bg-amber-50 rounded-lg p-4">
                <h5 className="text-sm font-semibold text-amber-800 mb-2">💡 尺寸×材质选品建议</h5>
                <div className="text-xs text-amber-700 space-y-1">
                  <p>• 最热组合: <strong>{stats.sizeMaterialData.crossData[0]?.size} + {stats.sizeMaterialData.crossData[0]?.material}</strong>，共{stats.sizeMaterialData.crossData[0]?.count}款商品，销售额¥{fmtCNYFull(stats.sizeMaterialData.crossData[0]?.sales || 0)}</p>
                  {stats.sizeMaterialData.crossData.length > 1 && (
                    <p>• 次热组合: <strong>{stats.sizeMaterialData.crossData[1]?.size} + {stats.sizeMaterialData.crossData[1]?.material}</strong>，共{stats.sizeMaterialData.crossData[1]?.count}款商品</p>
                  )}
                  {(() => {
                    const topCross = stats.sizeMaterialData.crossData[0]
                    const avgAll = stats.totalSales / stats.totalQty
                    const premiumVs = topCross && avgAll > 0 ? ((topCross.avgPrice / avgAll - 1) * 100).toFixed(1) : 0
                    return <p>• 最热组合均价{premiumVs >= 0 ? '高于' : '低于'}市场均价{Math.abs(premiumVs)}%，{premiumVs >= 0 ? '存在溢价空间' : '有价格竞争优势'}</p>
                  })()}
                  {stats.sizeMaterialData.sizeData.length > 0 && (
                    <p>• 尺寸建议: 主推{stats.sizeMaterialData.topSize}规格，{stats.sizeMaterialData.sizeData.length > 1 ? `同时布局${stats.sizeMaterialData.sizeData[1]?.name}差异化规格` : '可考虑拓展其他规格'}</p>
                  )}
                  {stats.sizeMaterialData.materialData.length > 0 && (
                    <p>• 材质建议: 主打{stats.sizeMaterialData.topMaterial}材质，{stats.sizeMaterialData.materialData.length > 1 ? `关注${stats.sizeMaterialData.materialData[1]?.name}等新兴材质趋势` : '可探索更多材质选择'}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {stats.isHairCareCategory && stats.ingredientData && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4">🧪 成分与功效分析</h3>
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="bg-pink-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-pink-700">{stats.ingredientData.allIngredients.length}</div>
              <div className="text-xs text-pink-600">识别成分数</div>
            </div>
            <div className="bg-violet-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-violet-700">{stats.ingredientData.categoryData.length}</div>
              <div className="text-xs text-violet-600">成分类别数</div>
            </div>
            <div className="bg-rose-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-rose-700">{stats.ingredientData.topIngredient}</div>
              <div className="text-xs text-rose-600">最热成分</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-amber-700">{stats.ingredientData.topCategory}</div>
              <div className="text-xs text-amber-600">最热类别</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3 flex items-center gap-2">📊 成分类别分布 <span className="text-xs text-morandi-text-light font-normal">识别率 {stats.ingredientData.coverage}%</span></h4>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={stats.ingredientData.categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={100} paddingAngle={2} dataKey="count" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {stats.ingredientData.categoryData.map((_, i) => <Cell key={i} fill={CC[i % CC.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, n, p) => [`${v}款 (¥${fmtCNYFull(p.payload.sales)})`, p.payload.name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50"><th className="px-2 py-1 text-left">类别</th><th className="px-2 py-1 text-right">商品数</th><th className="px-2 py-1 text-right">销售额(¥)</th><th className="px-2 py-1 text-right">均价(¥)</th></tr></thead>
                  <tbody>
                    {stats.ingredientData.categoryData.map((c, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-2 py-1 font-medium">{c.name}</td>
                        <td className="px-2 py-1 text-right">{c.count}</td>
                        <td className="px-2 py-1 text-right font-medium">¥{fmtCNYFull(c.sales)}</td>
                        <td className="px-2 py-1 text-right">¥{Math.round(c.avgPrice * R).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3">🏆 热门成分排行 TOP15</h4>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stats.ingredientData.allIngredients.slice(0, 15)} layout="vertical" margin={{ left: 70 }}>
                  <XAxis type="number" tickFormatter={v => `¥${fmtCNY(v)}`} />
                  <YAxis type="category" dataKey="zh" tick={{ fontSize: 10 }} width={65} />
                  <Tooltip formatter={(v, n) => n === 'sales' ? `¥${fmtCNYFull(v)}` : n === 'count' ? `${v}款` : v} />
                  <Bar dataKey="sales" fill="#D4A5A5" name="销售额" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50"><th className="px-2 py-1 text-left">成分</th><th className="px-2 py-1 text-left">类别</th><th className="px-2 py-1 text-right">商品数</th><th className="px-2 py-1 text-right">占比</th><th className="px-2 py-1 text-right">销售额(¥)</th></tr></thead>
                  <tbody>
                    {stats.ingredientData.allIngredients.slice(0, 15).map((ing, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-2 py-1 font-medium">{ing.zh}</td>
                        <td className="px-2 py-1"><span className="px-1.5 py-0.5 bg-pink-50 text-pink-700 rounded text-xs">{ing.category}</span></td>
                        <td className="px-2 py-1 text-right">{ing.count}</td>
                        <td className="px-2 py-1 text-right">{ing.share}%</td>
                        <td className="px-2 py-1 text-right font-medium">¥{fmtCNYFull(ing.sales)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            {stats.ingredientData.proteinIngredients.length > 0 && (
              <div className="bg-blue-50 rounded-lg p-4">
                <h5 className="text-xs font-semibold text-blue-800 mb-2">🧬 蛋白质成分</h5>
                <div className="space-y-1">
                  {stats.ingredientData.proteinIngredients.map((ing, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-blue-700">{ing.zh}</span>
                      <span className="text-blue-600">{ing.count}款 · {ing.share}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {stats.ingredientData.oilIngredients.length > 0 && (
              <div className="bg-amber-50 rounded-lg p-4">
                <h5 className="text-xs font-semibold text-amber-800 mb-2">🫒 油脂成分</h5>
                <div className="space-y-1">
                  {stats.ingredientData.oilIngredients.map((ing, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-amber-700">{ing.zh}</span>
                      <span className="text-amber-600">{ing.count}款 · {ing.share}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {stats.ingredientData.plantIngredients.length > 0 && (
              <div className="bg-green-50 rounded-lg p-4">
                <h5 className="text-xs font-semibold text-green-800 mb-2">🌿 植物成分</h5>
                <div className="space-y-1">
                  {stats.ingredientData.plantIngredients.map((ing, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-green-700">{ing.zh}</span>
                      <span className="text-green-600">{ing.count}款 · {ing.share}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {stats.ingredientData.effectIngredients.length > 0 && (
            <div className="mb-6 bg-violet-50 rounded-lg p-4">
              <h5 className="text-xs font-semibold text-violet-800 mb-3">✨ 功效成分热度</h5>
              <div className="flex flex-wrap gap-2">
                {stats.ingredientData.effectIngredients.map((ing, i) => {
                  const maxSales = stats.ingredientData.effectIngredients[0]?.sales || 1
                  const intensity = Math.max(0.3, ing.sales / maxSales)
                  return (
                    <span key={i} className="px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: `rgba(139, 92, 246, ${intensity * 0.3})`, color: `rgba(91, 33, 182, ${0.5 + intensity * 0.5})` }}>
                      {ing.zh} <span className="font-normal">({ing.count}款)</span>
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {stats.ingredientData.hairTypeIngredients.length > 0 && (
            <div className="mb-6 bg-cyan-50 rounded-lg p-4">
              <h5 className="text-xs font-semibold text-cyan-800 mb-3">💇 适用发质分布</h5>
              <div className="flex flex-wrap gap-2">
                {stats.ingredientData.hairTypeIngredients.map((ing, i) => (
                  <span key={i} className="px-3 py-1.5 bg-cyan-100 text-cyan-800 rounded-full text-xs font-medium">
                    {ing.zh} <span className="font-normal">({ing.count}款 · {ing.share}%)</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {stats.ingredientData.topPairs.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-morandi-text mb-3">🔗 成分组合分析 TOP10</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50"><th className="px-2 py-1 text-left">排名</th><th className="px-2 py-1 text-left">成分组合</th><th className="px-2 py-1 text-right">商品数</th><th className="px-2 py-1 text-right">销售额(¥)</th></tr></thead>
                  <tbody>
                    {stats.ingredientData.topPairs.map((p, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-2 py-1"><span className={`inline-block w-5 h-5 rounded-full text-xs text-center leading-5 ${i < 3 ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-600'}`}>{i + 1}</span></td>
                        <td className="px-2 py-1 font-medium">{p.pair}</td>
                        <td className="px-2 py-1 text-right">{p.count}</td>
                        <td className="px-2 py-1 text-right font-medium">¥{fmtCNYFull(p.sales)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-rose-50 rounded-lg p-4">
            <h5 className="text-sm font-semibold text-rose-800 mb-2">💡 成分选品建议</h5>
            <div className="text-xs text-rose-700 space-y-1">
              <p>• 最热成分: <strong>{stats.ingredientData.topIngredient}</strong>，最热类别: <strong>{stats.ingredientData.topCategory}</strong></p>
              {stats.ingredientData.topPairs.length > 0 && (
                <p>• 黄金组合: <strong>{stats.ingredientData.topPairs[0]?.pair}</strong>，共{stats.ingredientData.topPairs[0]?.count}款商品，建议主打此成分搭配</p>
              )}
              {stats.ingredientData.proteinIngredients.length > 0 && stats.ingredientData.oilIngredients.length > 0 && (
                <p>• 蛋白质+油脂组合是高端护发核心卖点，角蛋白+摩洛哥坚果油等搭配溢价能力强</p>
              )}
              {stats.ingredientData.effectIngredients.length > 0 && (
                <p>• 功效宣称: <strong>{stats.ingredientData.effectIngredients.slice(0, 3).map(e => e.zh).join('、')}</strong> 是市场主流功效方向</p>
              )}
              {stats.ingredientData.hairTypeIngredients.length > 0 && (
                <p>• 细分发质: <strong>{stats.ingredientData.hairTypeIngredients[0]?.zh}</strong> 需求最大，可针对性开发专属配方</p>
              )}
              {stats.ingredientData.plantIngredients.length > 0 && (
                <p>• 植物提取趋势: <strong>{stats.ingredientData.plantIngredients[0]?.zh}</strong> 最受欢迎，天然成分是增长点</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
