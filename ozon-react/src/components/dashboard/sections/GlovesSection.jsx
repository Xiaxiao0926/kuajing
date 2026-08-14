import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts'
import { R, fmtCNY, fmtCNYFull } from '../dictionary'

export default function GlovesSection({ stats, data, CC }) {
  return (
    <>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4">🧤 丁腈手套专项分析</h3>
          <div className="grid grid-cols-5 gap-3 mb-6">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-700">{stats.nitrileGlovesData.total}</div>
              <div className="text-xs text-blue-600">丁腈手套商品数</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-700">{stats.nitrileGlovesData.shareOfCategory}%</div>
              <div className="text-xs text-green-600">占类目比例</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-purple-700">¥{fmtCNY(stats.nitrileGlovesData.totalSales)}</div>
              <div className="text-xs text-purple-600">总销售额</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-orange-700">{stats.nitrileGlovesData.totalQty?.toLocaleString()}</div>
              <div className="text-xs text-orange-600">总销量(件)</div>
            </div>
            <div className="bg-pink-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-pink-700">₽{Math.round(stats.nitrileGlovesData.avgPrice).toLocaleString()}</div>
              <div className="text-xs text-pink-600">平均单价</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 mb-6">
            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3">🎨 颜色分布</h4>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={stats.nitrileGlovesData.colorData.slice(0, 6)} layout="vertical" margin={{ left: 50 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v, n) => n === 'sales' ? `¥${fmtCNYFull(v)}` : n === 'qty' ? `${v}件` : v} />
                  <Bar dataKey="qty" fill="#8B9DC3" name="销量" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50"><th className="px-2 py-1 text-left">颜色</th><th className="px-2 py-1 text-right">销量(件)</th><th className="px-2 py-1 text-right">销量占比</th></tr></thead>
                  <tbody>
                    {stats.nitrileGlovesData.colorData.slice(0, 5).map((c, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-2 py-1 font-medium">{c.name}</td>
                        <td className="px-2 py-1 text-right font-semibold">{c.qty?.toLocaleString()}</td>
                        <td className="px-2 py-1 text-right">{c.share}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3">📏 尺码分布</h4>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={stats.nitrileGlovesData.sizeData} layout="vertical" margin={{ left: 40 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v, n) => n === 'qty' ? `${v}件` : n === 'count' ? `${v}款` : v} />
                  <Bar dataKey="qty" fill="#D4A5A5" name="销量" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50"><th className="px-2 py-1 text-left">尺码</th><th className="px-2 py-1 text-right">销量(件)</th><th className="px-2 py-1 text-right">销量占比</th></tr></thead>
                  <tbody>
                    {stats.nitrileGlovesData.sizeData.map((s, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-2 py-1 font-medium">{s.name}</td>
                        <td className="px-2 py-1 text-right font-semibold">{s.qty?.toLocaleString()}</td>
                        <td className="px-2 py-1 text-right">{s.share}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3">📦 包装规格</h4>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={stats.nitrileGlovesData.packData} cx="50%" cy="50%" innerRadius={40} outerRadius={75} paddingAngle={2} dataKey="count" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {stats.nitrileGlovesData.packData.map((_, i) => <Cell key={i} fill={CC[i % CC.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, n, p) => [`${v}款 (${p.payload.qty?.toLocaleString()}件)`, p.payload.name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50"><th className="px-2 py-1 text-left">规格</th><th className="px-2 py-1 text-right">销量(件)</th><th className="px-2 py-1 text-right">销量占比</th></tr></thead>
                  <tbody>
                    {stats.nitrileGlovesData.packData.map((p, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-2 py-1 font-medium">{p.name}</td>
                        <td className="px-2 py-1 text-right font-semibold">{p.qty?.toLocaleString()}</td>
                        <td className="px-2 py-1 text-right">{p.share}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3">🏥 用途场景分布</h4>
              <div className="flex flex-wrap gap-2">
                {stats.nitrileGlovesData.useData.map((u, i) => (
                  <span key={i} className="px-3 py-1.5 bg-blue-50 text-blue-800 rounded-full text-xs font-medium">
                    {u.name} <span className="font-normal">({u.count}款)</span>
                  </span>
                ))}
              </div>
              {stats.nitrileGlovesData.useData.length === 0 && (
                <p className="text-xs text-morandi-text-light">未识别到明确用途标签</p>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3">💰 价格区间分布</h4>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={stats.nitrileGlovesData.priceData}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v, n, p) => [`${v}款 (${p.payload.qty?.toLocaleString()}件, 均₽${Math.round(p.payload.avgPrice)})`, '商品数']} />
                  <Bar dataKey="qty" fill="#C3B4D1" name="销量" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mb-6">
            <h4 className="text-sm font-semibold text-morandi-text mb-3">🏆 TOP 10 丁腈手套品牌</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-gray-50"><th className="px-2 py-2 text-left">排名</th><th className="px-2 py-2 text-left">品牌</th><th className="px-2 py-2 text-right">商品数</th><th className="px-2 py-2 text-right">销量</th><th className="px-2 py-2 text-right">销售额(¥)</th></tr></thead>
                <tbody>
                  {stats.nitrileGlovesData.brandData.map((b, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-2 py-2"><span className={`inline-block w-5 h-5 rounded-full text-xs text-center leading-5 ${i < 3 ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-600'}`}>{i + 1}</span></td>
                      <td className="px-2 py-2 font-medium">{b.name}</td>
                      <td className="px-2 py-2 text-right">{b.count}</td>
                      <td className="px-2 py-2 text-right">{b.qty?.toLocaleString()}</td>
                      <td className="px-2 py-2 text-right font-medium">¥{fmtCNYFull(b.sales)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mb-6">
            <h4 className="text-sm font-semibold text-morandi-text mb-3">🔥 热销商品 TOP 10（按销量）</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-gray-50"><th className="px-2 py-2 text-left">排名</th><th className="px-2 py-2 text-left">商品名称</th><th className="px-2 py-2 text-center">颜色</th><th className="px-2 py-2 text-center">尺码</th><th className="px-2 py-2 text-center">规格</th><th className="px-2 py-2 text-center">场景</th><th className="px-2 py-2 text-center">发货</th><th className="px-2 py-2 text-right">单价(₽)</th><th className="px-2 py-2 text-right">单只价(₽)</th><th className="px-2 py-2 text-right">销量</th><th className="px-2 py-2 text-right">预估利润率</th></tr></thead>
                <tbody>
                  {stats.nitrileGlovesData.topProducts.map((p, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-2 py-2"><span className={`inline-block w-5 h-5 rounded-full text-xs text-center leading-5 ${i < 3 ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'}`}>{i + 1}</span></td>
                      <td className="px-2 py-2 font-medium max-w-[250px] truncate" title={p.name}>{p.name}</td>
                      <td className="px-2 py-2 text-center">{p._color ? <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">{p._color}</span> : <span className="text-gray-300">-</span>}</td>
                      <td className="px-2 py-2 text-center">{p._size ? <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{p._size}</span> : <span className="text-gray-300">-</span>}</td>
                      <td className="px-2 py-2 text-center">{p._pack ? <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-xs">{p._pack}</span> : <span className="text-gray-300">-</span>}</td>
                      <td className="px-2 py-2 text-center">{p._use ? <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-xs">{p._use}</span> : <span className="text-gray-300">-</span>}</td>
                      <td className="px-2 py-2 text-center">{p._shipType ? <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${p._shipType === 'FBO' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{p._shipType}</span> : <span className="text-gray-300">-</span>}</td>
                      <td className="px-2 py-2 text-right font-medium">₽{Math.round(p.price).toLocaleString()}</td>
                      <td className="px-2 py-2 text-right font-medium">{p._pricePerPiece ? <span className="text-indigo-600">₽{p._pricePerPiece}</span> : <span className="text-gray-300">-</span>}</td>
                      <td className="px-2 py-2 text-right font-bold text-red-600">{p.qty?.toLocaleString()}</td>
                      <td className="px-2 py-2 text-right">
                        {p._grossRate ? (
                          <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${parseFloat(p._grossRate) >= 20 ? 'bg-green-100 text-green-700' : parseFloat(p._grossRate) >= 10 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                            {p._grossRate}%
                          </span>
                        ) : <span className="text-gray-300">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-morandi-text flex items-center gap-2">
                <span className="text-lg">🎯</span> 我方产品竞争雷达图{stats.competitorAnalysis?.compIs100pcs && <span className="text-[10px] text-amber-600 ml-1">（基于{stats.competitorAnalysis?.compProductCount}款100只装产品）</span>}
              </h4>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span>我方产品</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-300 inline-block"></span>市场平均</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart outerRadius={110} data={stats.competitorAnalysis?.radarData || []}>
                    <PolarGrid stroke="#e0e0e0" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
                    <Radar name="市场平均" dataKey="avg" stroke="#9CA3AF" fill="#9CA3AF" fillOpacity={0.15} strokeWidth={1.5} strokeDasharray="4 4" />
                    <Radar name="我方产品" dataKey="us" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.25} strokeWidth={2} />
                    <Tooltip formatter={(v, name, props) => {
                      const note = name === '我方产品' ? props.payload?.usNote : props.payload?.avgNote
                      return [`${v}分（${note}）`, name]
                    }} />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3">
                <div className="bg-white rounded-lg p-3 border border-blue-100">
                  <h5 className="text-xs font-bold text-blue-700 mb-2">我方产品参数</h5>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between"><span className="text-morandi-text-light">采购成本</span><span className="font-bold text-morandi-text">¥38/盒(100只)</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">Ozon手续费</span><span className="font-bold text-morandi-text">12%</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">物流费</span><span className="font-bold text-morandi-text">¥20/单</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">单只克重</span><span className="font-bold text-morandi-text">8.5g（高克重）</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">颜色</span><span className="font-bold text-morandi-text">🟢黑色 🟠橙色</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">尺码</span><span className="font-bold text-morandi-text">M码</span></div>
                    <div className="flex justify-between col-span-2"><span className="text-morandi-text-light">定位</span><span className="font-bold text-morandi-text">重型防滑手套 | 非一次性 | 双面防滑 | 无乳胶</span></div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-3 border border-green-100">
                  <h5 className="text-xs font-bold text-green-700 mb-2">💰 利润测算（实际售价）</h5>
                  <div className="space-y-1 text-xs border-b border-gray-100 pb-2 mb-2">
                    <div className="text-[10px] font-bold text-gray-500 mb-1">50只装 Safe Grip ₽{stats.competitorAnalysis?.ourPrice50}</div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">售价</span><span className="font-bold">₽{stats.competitorAnalysis?.ourPrice50} ≈ ¥{(stats.competitorAnalysis?.ourPrice50 * R).toFixed(1)}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">采购成本（50只）</span><span className="text-red-500">-¥{stats.competitorAnalysis?.ourPurchase50}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">物流费</span><span className="text-red-500">-¥{stats.competitorAnalysis?.ourLogistics50}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">Ozon手续费(12%)</span><span className="text-red-500">-₽{stats.competitorAnalysis?.ozonFee50} ≈ -¥{(stats.competitorAnalysis?.ozonFee50 * R).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">广告费(10%)</span><span className="text-red-500">-₽{stats.competitorAnalysis?.adFee50} ≈ -¥{(stats.competitorAnalysis?.adFee50 * R).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">汇损(1%)</span><span className="text-red-500">-₽{stats.competitorAnalysis?.exchangeLoss50} ≈ -¥{(stats.competitorAnalysis?.exchangeLoss50 * R).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">售后(3%)</span><span className="text-red-500">-₽{stats.competitorAnalysis?.afterSales50} ≈ -¥{(stats.competitorAnalysis?.afterSales50 * R).toFixed(2)}</span></div>
                    <div className="border-t border-gray-100 pt-1 flex justify-between font-bold"><span>净利润/单</span><span className={parseFloat(stats.competitorAnalysis?.profit50) >= 0 ? 'text-green-600' : 'text-red-600'}>¥{stats.competitorAnalysis?.profit50}（{stats.competitorAnalysis?.profitRate50}%）</span></div>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="text-[10px] font-bold text-gray-500 mb-1">100只装 Steel Grip ₽{stats.competitorAnalysis?.ourPrice100}</div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">售价</span><span className="font-bold">₽{stats.competitorAnalysis?.ourPrice100} ≈ ¥{(stats.competitorAnalysis?.ourPrice100 * R).toFixed(1)}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">采购成本</span><span className="text-red-500">-¥{stats.competitorAnalysis?.ourCostCNY}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">物流费</span><span className="text-red-500">-¥{stats.competitorAnalysis?.ourLogistics}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">Ozon手续费(12%)</span><span className="text-red-500">-₽{stats.competitorAnalysis?.ozonFee100} ≈ -¥{(stats.competitorAnalysis?.ozonFee100 * R).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">广告费(10%)</span><span className="text-red-500">-₽{stats.competitorAnalysis?.adFee100} ≈ -¥{(stats.competitorAnalysis?.adFee100 * R).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">汇损(1%)</span><span className="text-red-500">-₽{stats.competitorAnalysis?.exchangeLoss100} ≈ -¥{(stats.competitorAnalysis?.exchangeLoss100 * R).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">售后(3%)</span><span className="text-red-500">-₽{stats.competitorAnalysis?.afterSales100} ≈ -¥{(stats.competitorAnalysis?.afterSales100 * R).toFixed(2)}</span></div>
                    <div className="border-t border-gray-100 pt-1 flex justify-between font-bold"><span className="text-morandi-text">净利润/单</span><span className={parseFloat(stats.competitorAnalysis?.profit100) >= 0 ? 'text-green-600' : 'text-red-600'}>¥{stats.competitorAnalysis?.profit100} {parseFloat(stats.competitorAnalysis?.profit100) < 0 && '⚠️'}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">净利率</span><span className={`font-bold ${parseFloat(stats.competitorAnalysis?.profitRate100) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{stats.competitorAnalysis?.profitRate100}%</span></div>
                  </div>
                  <p className="text-[10px] text-amber-600 mt-1.5 bg-amber-50 rounded px-2 py-1">💡 费用结构：Ozon 12% + 广告 10% + 汇损 1% + 售后 3% = 合计26%平台运营费。我方为<b>重型防滑手套</b>，非一次性产品，高克重8.5g支撑溢价</p>
                </div>

                <div className="bg-white rounded-lg p-3 border border-purple-100">
                  <h5 className="text-xs font-bold text-purple-700 mb-2">📊 竞争力分析</h5>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-start gap-1.5"><span className="text-green-500 mt-0.5">✓</span><span><b>产品质量95分</b>：8.5g高克重远超市场5-6g，耐用性碾压同类</span></div>
                    <div className="flex items-start gap-1.5"><span className="text-green-500 mt-0.5">✓</span><span><b>合规认证80分</b>：无乳胶过敏是差异化卖点，医疗/美容场景加分</span></div>
                    <div className="flex items-start gap-1.5"><span className="text-green-500 mt-0.5">✓</span><span><b>供货稳定90分</b>：国内采购稳定，无断货风险</span></div>
                    <div className="flex items-start gap-1.5"><span className="text-amber-500 mt-0.5">⚠</span><span><b>市场熟悉度50分</b>：需积累俄文评价和店铺评分</span></div>
                    <div className="flex items-start gap-1.5"><span className="text-amber-500 mt-0.5">⚠</span><span><b>品牌故事65分</b>：需包装"中国智造+高克重耐用"故事</span></div>
                  </div>
                  <div className="mt-2 bg-amber-50 rounded px-2 py-1.5 text-[10px] text-amber-700 border border-amber-200">
                    ⚡ <b>重型防滑手套</b>：我方产品为重型防滑手套，非一次性产品！8.5g高克重+双面防滑，与市场5-6g薄款一次性手套形成代差，价格偏高合理
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <h4 className="text-sm font-semibold text-morandi-text mb-4 flex items-center gap-2">
              <span className="text-lg">⚔️</span> 我方产品 vs {stats.competitorAnalysis?.compIs100pcs ? '100只装' : 'TOP10'}热销品 综合对比
            </h4>

            <div className="grid grid-cols-2 gap-6 mb-5">
              <div>
                <h5 className="text-xs font-bold text-morandi-text mb-3 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>我方产品（重型防滑手套，非一次性，8.5g高克重）
                </h5>
                <div className="bg-blue-50 rounded-lg p-3 space-y-2 text-xs">
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">实际售价</span><span className="font-bold text-blue-700">50只 ₽{stats.competitorAnalysis?.ourPrice50} / 100只 ₽{stats.competitorAnalysis?.ourPrice100}</span></div>
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">采购成本</span><span className="font-bold">¥{stats.competitorAnalysis?.ourCostCNY}/盒(100只)</span></div>
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">克重</span><span className="font-bold text-green-600">8.5g（高克重重型）</span></div>
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">100只装净利率</span><span className={`font-bold ${parseFloat(stats.competitorAnalysis?.profitRate100) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{stats.competitorAnalysis?.profitRate100}%</span></div>
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">100只装净利润</span><span className={`font-bold ${parseFloat(stats.competitorAnalysis?.profit100) >= 0 ? 'text-green-600' : 'text-red-600'}`}>¥{stats.competitorAnalysis?.profit100}</span></div>
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">颜色</span><span className="font-bold">🟢黑色 🟠橙色</span></div>
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">尺码</span><span className="font-bold">M码</span></div>
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">规格</span><span className="font-bold">50只/100只</span></div>
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">定位</span><span className="text-[10px] font-bold text-red-600">重型防滑手套 | 非一次性 | 双面防滑 | 无乳胶</span></div>
                </div>
              </div>

              <div>
                <h5 className="text-xs font-bold text-morandi-text mb-3 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-gray-400 inline-block"></span>{stats.competitorAnalysis?.compIs100pcs ? '100只装' : 'TOP10'}热销品（{stats.competitorAnalysis?.compProductCount}款均价）
                </h5>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-xs">
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">均价</span><span className="font-bold">₽{stats.competitorAnalysis?.top10AvgPrice}</span></div>
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">价格区间</span><span className="font-bold">₽{stats.competitorAnalysis?.top10MinPrice} - ₽{stats.competitorAnalysis?.top10MaxPrice}</span></div>
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">平均销量/品</span><span className="font-bold">{stats.competitorAnalysis?.top10AvgQty?.toLocaleString()}件</span></div>
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">预估净利率</span><span className="font-bold text-amber-600">{stats.competitorAnalysis?.top10AvgGross}%</span></div>
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">TOP颜色</span><span className="font-bold">{stats.competitorAnalysis?.top10Colors?.slice(0, 3).join('、') || '-'}</span></div>
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">TOP尺码</span><span className="font-bold">{stats.competitorAnalysis?.top10Sizes?.slice(0, 3).join('、') || '-'}</span></div>
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">TOP规格</span><span className="font-bold">{stats.competitorAnalysis?.top10Packs?.slice(0, 3).join('、') || '-'}</span></div>
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">发货方式</span><span className="font-bold">FBO {stats.competitorAnalysis?.top10FboRatio}% / FBS {stats.competitorAnalysis?.top10FbsRatio}%</span></div>
                </div>
              </div>
            </div>

            <div className="mb-5">
              <h5 className="text-xs font-bold text-morandi-text mb-3">📊 多维度对比评分</h5>
              <div className="space-y-2">
                {[
                  { label: '产品质量（克重）', our: 95, top10: Math.min(70, 50 + Math.round(stats.competitorAnalysis?.top10AvgPricePerPiece || 0)), ourNote: '8.5g重型防滑', top10Note: '普通克重' },
                  { label: '价格竞争力', our: Math.round(Math.max(30, 100 - (stats.competitorAnalysis?.ourPrice100 / 100 / Math.max(parseFloat(stats.competitorAnalysis?.top10AvgPricePerPiece) || 0.1) - 1) * 50)), top10: 65, ourNote: `₽${(stats.competitorAnalysis?.ourPrice100 / 100).toFixed(1)}/只`, top10Note: `₽${stats.competitorAnalysis?.top10AvgPricePerPiece}/只` },
                  { label: '利润空间', our: parseFloat(stats.competitorAnalysis?.profitRate100 || 0) >= 15 ? 85 : 70, top10: parseFloat(stats.competitorAnalysis?.top10AvgGross || 0) >= 15 ? 80 : 65, ourNote: '净利率' + stats.competitorAnalysis?.profitRate100 + '%', top10Note: '净利率' + stats.competitorAnalysis?.top10AvgGross + '%' },
                  { label: '供货稳定性', our: 90, top10: 70, ourNote: '国内采购稳定', top10Note: '依赖本地供应' },
                  { label: '克重品质', our: 95, top10: 55, ourNote: '8.5g高克重', top10Note: '5-6g普通克重' },
                  { label: '合规认证', our: 80, top10: 55, ourNote: '无乳胶认证', top10Note: '认证参差不齐' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-28 text-xs text-morandi-text text-right">{item.label}</div>
                    <div className="flex-1 relative h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div className="absolute left-0 top-0 h-full bg-blue-500 rounded-full flex items-center justify-end pr-2" style={{ width: `${item.our}%` }}>
                        <span className="text-white text-[10px] font-bold">{item.our}</span>
                      </div>
                      <div className="absolute top-0 h-full rounded-full border-2 border-dashed border-gray-400" style={{ left: `${item.top10}%` }}>
                        <span className="absolute -top-4 text-[9px] text-gray-500 whitespace-nowrap">{item.top10}分</span>
                      </div>
                    </div>
                    <div className="w-4 text-center"><span className="text-blue-500 text-xs font-bold">↑</span></div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-morandi-text-light mt-2">蓝色条=我方产品 | 虚线=TOP10平均 | ↑表示我方占优</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 rounded-lg p-3">
                <h5 className="text-xs font-bold text-green-700 mb-2">✅ 我方优势</h5>
                <div className="space-y-1 text-[11px] text-green-700">
                  <p>• <b>重型防滑定位</b>：8.5g高克重双面防滑，非一次性产品，耐用性远超市场5-6g薄款</p>
                  <p>• <b>无乳胶过敏</b>：差异化卖点，医疗/美容/工业场景加分</p>
                  <p>• <b>成本优势</b>：¥38/100只，规模化后成本可控</p>
                  <p>• <b>供货稳定</b>：国内供应链稳定，无断货风险</p>
                  <p>• <b>实际验证</b>：50只₽{stats.competitorAnalysis?.ourPrice50}、100只₽{stats.competitorAnalysis?.ourPrice100}已在售，价格体系已验证</p>
                </div>
              </div>
              <div className="bg-amber-50 rounded-lg p-3">
                <h5 className="text-xs font-bold text-amber-700 mb-2">⚠️ 我方劣势与应对</h5>
                <div className="space-y-1 text-[11px] text-amber-700">
                  <p>• <b>市场熟悉度低</b>：需积累俄文评价，建议送样给KOL测评</p>
                  <p>• <b>品牌认知为零</b>：需包装"重型防滑手套专家"故事，突出非一次性定位</p>
                  <p>• <b>价格偏高</b>：需强调重型防滑≠一次性，Listing中突出"8.5g高克重""双面防滑"差异化</p>
                  <p>• <b>物流成本</b>：¥20/单偏高，可考虑FBS降低物流成本</p>
                  <p>• <b>平台费用高</b>：Ozon12%+广告10%+汇损1%+售后3%=26%，需控制广告投放ROI</p>
                </div>
              </div>
            </div>

            <div className="mt-4 bg-blue-50 rounded-lg p-3">
              <h5 className="text-xs font-bold text-blue-800 mb-2">💡 综合建议</h5>
              <div className="text-xs text-blue-700 space-y-1">
                <p>• <b>产品定位</b>：重型防滑手套，非一次性产品！8.5g高克重+双面防滑，与市场5-6g薄款形成代差</p>
                <p>• <b>价格合理性</b>：100只₽{stats.competitorAnalysis?.ourPrice100}（¥{(stats.competitorAnalysis?.ourPrice100 * R).toFixed(0)}）看似偏高，但重型防滑手套单价应与一次性手套区分，强调"耐用=更划算"</p>
                <p>• <b>费用结构</b>：平台运营费合计26%（Ozon12%+广告10%+汇损1%+售后3%），100只装净利率{stats.competitorAnalysis?.profitRate100}%，50只装净利率{stats.competitorAnalysis?.profitRate50}%</p>
                <p>• 标题关键词：加入"8.5g"、"высокая плотность"（高密度）、"без латекса"（无乳胶）、"двойное покрытие"（双面涂层）、"многоразовые"（可重复使用）</p>
                <p>• 主图策略：突出克重数据对比，用数字"8.5g"做差异化卖点，附上一次性手套对比图强调耐用性</p>
                <p>• <b>溢价策略</b>：在Listing中强调"8.5g高克重=更耐用"、"双面防滑=更安全"、"非一次性=更划算"三大卖点，支撑高价位段定价</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <h5 className="text-sm font-semibold text-blue-800 mb-2">💡 丁腈手套选品建议</h5>
            <div className="text-xs text-blue-700 space-y-1">
              <p>• 丁腈手套占类目 <strong>{stats.nitrileGlovesData.shareOfCategory}%</strong>，是手套类目的主力材质</p>
              {stats.nitrileGlovesData.colorData.length > 0 && (
                <p>• 最热颜色: <strong>{stats.nitrileGlovesData.colorData[0]?.name}</strong>，占比 {stats.nitrileGlovesData.colorData[0]?.share}%</p>
              )}
              {stats.nitrileGlovesData.sizeData.length > 0 && stats.nitrileGlovesData.sizeData[0]?.name !== '未标注' && (
                <p>• 最热尺码: <strong>{stats.nitrileGlovesData.sizeData[0]?.name}</strong>，建议主推此尺码</p>
              )}
              {stats.nitrileGlovesData.useData.length > 0 && (
                <p>• 主要用途: <strong>{stats.nitrileGlovesData.useData.slice(0, 3).map(u => u.name).join('、')}</strong></p>
              )}
              {stats.nitrileGlovesData.packData.length > 0 && (
                <p>• 热销规格: <strong>{stats.nitrileGlovesData.packData[0]?.name}</strong>，建议按此规格打包销售</p>
              )}
              <p>• 丁腈材质优势: 无乳胶过敏风险、耐化学腐蚀、触感灵敏，适合医疗、美容、清洁等多场景</p>
              <p>• 建议: 黑色/蓝色丁腈手套是市场主流，100只装是热销规格，可重点布局</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
