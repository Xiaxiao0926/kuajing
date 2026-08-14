import { TrendingUp, Sparkles, Star, Zap, Truck } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ScatterChart, Scatter } from 'recharts'
import { R, fmtCNY, fmtCNYFull } from '../dictionary'
import { RecommendationCard } from '../Cards'

export default function InsightsSections({ stats, data }) {
  return (
    <>
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-morandi-text mb-4">📈 功能关键词分布 (俄/英/中对照)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={stats.featureData.slice(0, 8)} layout="vertical">
            <XAxis type="number" />
            <YAxis type="category" dataKey="zh" width={70} tick={{ fontSize: 9 }} />
            <Tooltip formatter={(v) => [`¥${fmtCNYFull(v)}`, '销售额']} />
            <Bar dataKey="sales" fill="#C3B4D1" name="销售额" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-gray-50"><th className="px-2 py-2 text-left">中文</th><th className="px-2 py-2 text-left">俄语</th><th className="px-2 py-2 text-left">英语</th><th className="px-2 py-2 text-right">产品数</th><th className="px-2 py-2 text-right">销售额(¥)</th><th className="px-2 py-2 text-right">均价(¥)</th><th className="px-2 py-2 text-right">溢价</th><th className="px-2 py-2 text-left">说明</th></tr></thead>
            <tbody>
              {stats.featureData.map((f, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-2 py-2 font-medium">{f.zh}</td>
                  <td className="px-2 py-2 text-morandi-secondary italic">{f.ru}</td>
                  <td className="px-2 py-2 text-gray-600">{f.en}</td>
                  <td className="px-2 py-2 text-right">{f.count}</td>
                  <td className="px-2 py-2 text-right font-medium">¥{fmtCNYFull(f.sales)}</td>
                  <td className="px-2 py-2 text-right">¥{fmtCNYFull(f.avgPrice)}</td>
                  <td className="px-2 py-2 text-right">
                    {f.premium > 0 ? (
                      <span className="px-1 py-0.5 bg-green-100 text-green-700 rounded text-xs">+{f.premium}%</span>
                    ) : f.premium < 0 ? (
                      <span className="px-1 py-0.5 bg-red-100 text-red-600 rounded text-xs">{f.premium}%</span>
                    ) : (
                      <span className="px-1 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">0%</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-morandi-text-light max-w-[150px] truncate">{f.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-morandi-text mb-4">🔍 不同价格带产品功能分析</h3>
        <div className="space-y-4">
          {stats.priceBandFeatureData.map((band, i) => (
            <div key={i} className="border border-gray-100 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-morandi-primary/10 text-morandi-primary rounded-full text-sm font-medium">{band.band}</span>
                  <span className="text-xs text-morandi-text-light">{band.productCount}个商品</span>
                </div>
                <div className="flex gap-4 text-xs text-morandi-text-light">
                  <span>总销售额: <strong className="text-morandi-text">¥{fmtCNYFull(band.totalSales)}</strong></span>
                  <span>均价: <strong className="text-morandi-text">¥{Math.round(band.avgPrice * R).toLocaleString()}</strong></span>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {band.features.map((f, j) => (
                  <div key={j} className="bg-gray-50 rounded-lg p-2 text-center">
                    <div className="text-sm font-medium text-morandi-text">{f.name}</div>
                    <div className="text-xs text-morandi-secondary italic">{f.ru}</div>
                    <div className="text-xs text-morandi-text-light">{f.count}款 · 渗透率{f.penetration}%</div>
                    <div className="text-xs text-morandi-primary font-medium">¥{fmtCNYFull(f.avgPrice)}</div>
                  </div>
                ))}
                {band.features.length === 0 && <div className="col-span-5 text-xs text-morandi-text-light text-center py-2">该价格带无显著功能关键词</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-morandi-text mb-4 flex items-center gap-2"><Star className="w-5 h-5 text-yellow-500" /> 销量TOP15产品</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 bg-gray-50"><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">产品名称</th><th className="px-3 py-2 text-left">品牌</th><th className="px-3 py-2 text-right">价格(¥)</th><th className="px-3 py-2 text-right">销量</th><th className="px-3 py-2 text-right">销售额(¥)</th><th className="px-3 py-2 text-right">毛利率</th><th className="px-3 py-2 text-left">发货</th><th className="px-3 py-2 text-left">上架时间</th></tr></thead>
            <tbody>
              {stats.topProducts.map((p, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-3 py-2"><span className={`inline-block w-5 h-5 rounded-full text-xs flex items-center justify-center ${i < 3 ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-600'}`}>{i + 1}</span></td>
                  <td className="px-3 py-2 max-w-[200px]">
                    <div className="text-gray-700 truncate">{p.name}</div>
                    {p.zhTags.length > 0 && <div className="text-xs text-morandi-secondary">{p.zhTags.join(' · ')}</div>}
                  </td>
                  <td className="px-3 py-2 text-morandi-secondary font-medium">{p.brand}</td>
                  <td className="px-3 py-2 text-right">¥{Math.round(p.price * R).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-bold text-morandi-primary">{p.qty.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">¥{fmtCNYFull(p.sales)}</td>
                  <td className="px-3 py-2 text-right"><span className={`px-2 py-0.5 rounded text-xs ${p.gross != null && p.gross > 0 ? (p.gross > 30 ? 'bg-green-100 text-green-700' : p.gross > 15 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700') : 'bg-gray-100 text-gray-500'}`}>{p.gross != null && p.gross > 0 ? `${p.gross.toFixed(1)}%` : '未知'}</span></td>
                  <td className="px-3 py-2 text-xs">{p.shipping}</td>
                  <td className="px-3 py-2 text-xs text-morandi-text-light">{p.date || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-morandi-text mb-4 flex items-center gap-2"><Truck className="w-5 h-5 text-blue-500" /> 📦 FBS发货方式销量TOP15</h3>
        {stats.fbsTopProducts && stats.fbsTopProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100 bg-gray-50"><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">产品名称</th><th className="px-3 py-2 text-left">品牌</th><th className="px-3 py-2 text-right">价格(¥)</th><th className="px-3 py-2 text-right">销量</th><th className="px-3 py-2 text-right">销售额(¥)</th><th className="px-3 py-2 text-right">毛利率</th><th className="px-3 py-2 text-left">发货模式</th><th className="px-3 py-2 text-left">上架时间</th></tr></thead>
              <tbody>
                {stats.fbsTopProducts.map((p, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-3 py-2"><span className={`inline-block w-5 h-5 rounded-full text-xs flex items-center justify-center ${i < 3 ? 'bg-blue-400 text-white' : 'bg-gray-100 text-gray-600'}`}>{i + 1}</span></td>
                    <td className="px-3 py-2 max-w-[200px]">
                      <div className="text-gray-700 truncate">{p.name}</div>
                      {p.zhTags.length > 0 && <div className="text-xs text-morandi-secondary">{p.zhTags.join(' · ')}</div>}
                    </td>
                    <td className="px-3 py-2 text-morandi-secondary font-medium">{p.brand}</td>
                    <td className="px-3 py-2 text-right">¥{Math.round(p.price * R).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-bold text-blue-600">{p.qty.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">¥{fmtCNYFull(p.sales)}</td>
                    <td className="px-3 py-2 text-right"><span className={`px-2 py-0.5 rounded text-xs ${p.gross != null && p.gross > 0 ? (p.gross > 30 ? 'bg-green-100 text-green-700' : p.gross > 15 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700') : 'bg-gray-100 text-gray-500'}`}>{p.gross != null && p.gross > 0 ? `${p.gross.toFixed(1)}%` : '未知'}</span></td>
                    <td className="px-3 py-2 text-xs">{p.shipping}</td>
                    <td className="px-3 py-2 text-xs text-morandi-text-light">{p.date || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 bg-blue-50 rounded-lg p-3">
              <div className="text-xs text-blue-700">
                <strong>FBS模式说明:</strong> FBS(卖家自发货)模式共{stats.fbsTopProducts.length}个产品，总销量{stats.fbsTopProducts.reduce((s, p) => s + p.qty, 0).toLocaleString()}件。
                适合有海外仓或本地发货能力的卖家。
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">📦</div>
            <p className="text-morandi-text-light">暂无FBS发货方式的产品数据</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-morandi-text mb-4 flex items-center gap-2"><Sparkles className="w-5 h-5 text-morandi-primary" /> 🆕 新品分析 (180天内上架)</h3>
        {stats.newProducts180 && stats.newProducts180.length > 0 ? (
          <div>
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{stats.newProductsStats.count}</div>
                <div className="text-xs text-green-500">新品数量</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.newProductsStats.totalQty.toLocaleString()}</div>
                <div className="text-xs text-blue-500">新品总销量</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-purple-600">¥{fmtCNY(stats.newProductsStats.totalSales)}</div>
                <div className="text-xs text-purple-500">新品总销售额</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-600">¥{Math.round(stats.newProductsStats.avgPrice * R).toLocaleString()}</div>
                <div className="text-xs text-orange-500">新品平均价格</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-100 bg-gray-50"><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">产品名称</th><th className="px-3 py-2 text-left">品牌</th><th className="px-3 py-2 text-right">价格(¥)</th><th className="px-3 py-2 text-right">销量</th><th className="px-3 py-2 text-right">销售额(¥)</th><th className="px-3 py-2 text-right">发货方式</th><th className="px-3 py-2 text-right">上架日期</th></tr></thead>
                    <tbody>
                      {stats.newProducts180.map((p, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-3 py-2"><span className={`inline-block w-5 h-5 rounded-full text-xs flex items-center justify-center ${i < 3 ? 'bg-green-400 text-white' : 'bg-gray-100 text-gray-600'}`}>{i + 1}</span></td>
                          <td className="px-3 py-2 max-w-[200px]">
                            <div className="text-gray-700 truncate">{p.name}</div>
                            {p.zhTags.length > 0 && <div className="text-xs text-morandi-secondary">{p.zhTags.join(' · ')}</div>}
                          </td>
                          <td className="px-3 py-2 text-morandi-secondary font-medium">{p.brand}</td>
                          <td className="px-3 py-2 text-right">¥{Math.round(p.price * R).toLocaleString()}</td>
                          <td className="px-3 py-2 text-right font-bold text-green-600">{p.qty.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right">¥{fmtCNYFull(p.sales)}</td>
                          <td className="px-3 py-2 text-xs">{p.shipping}</td>
                          <td className="px-3 py-2 text-xs text-morandi-text-light">{p.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-morandi-text-light font-medium mb-2">🏷️ 新品品牌分布</div>
                  <div className="flex flex-wrap gap-1">
                    {stats.newProductsStats.topBrands.map((b, i) => (
                      <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">{b}</span>
                    ))}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-morandi-text-light font-medium mb-2">💰 新品价格带分布</div>
                  <div className="space-y-1">
                    {stats.newProductsStats.priceBandDist.map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-morandi-text">{p.name}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-morandi-primary rounded-full" style={{ width: `${(p.count / stats.newProductsStats.count * 100)}%` }} />
                          </div>
                          <span className="text-morandi-text-light w-8 text-right">{p.count}个</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                  <div className="text-xs text-green-600 font-medium mb-1">💡 新品洞察</div>
                  <div className="text-xs text-green-700">
                    {stats.newProducts180.length > 0 ? (
                      <>
                        近180天上架新品{stats.newProductsStats.count}个，占总量{(stats.newProductsStats.count / stats.productCount * 100).toFixed(1)}%。
                        销量最高为{stats.newProducts180[0]?.brand}品牌，定价¥{Math.round(stats.newProducts180[0]?.price * R).toLocaleString()}。
                        新品均价¥{Math.round(stats.newProductsStats.avgPrice * R).toLocaleString()}
                        {stats.newProductsStats.avgPrice * R > stats.avgPrice * R ? '，高于' : '，低于'}市场均价¥{Math.round(stats.avgPrice * R).toLocaleString()}。
                      </>
                    ) : '暂无新品数据'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">📦</div>
            <p className="text-morandi-text-light">暂无180天内上架的新品数据</p>
            <p className="text-xs text-morandi-text-light mt-1">请确认数据中包含"商品卡创建日期"字段</p>
          </div>
        )}
      </div>

      {/* 运营策略分析板块 */}
      {stats.operationStrategy && (stats.operationStrategy.promoStats.count > 0 || stats.operationStrategy.adStats.count > 0) && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4 flex items-center gap-2">
            <span className="text-2xl">📊</span> 运营策略分析 (促销 & 推广)
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {/* 促销策略分析 */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-morandi-text mb-2">🎯 促销策略</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-red-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-red-600">{stats.operationStrategy.promoStats.count}</div>
                  <div className="text-xs text-red-500">参与促销产品</div>
                </div>
                <div className="bg-orange-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-orange-600">{stats.operationStrategy.promoStats.highDiscount}</div>
                  <div className="text-xs text-orange-500">高折扣(≥20%)</div>
                </div>
              </div>
              {stats.operationStrategy.promoEffect && (
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-morandi-text-light">平均折扣:</span>
                    <span className="font-medium">{stats.operationStrategy.promoEffect.avgDiscount.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-morandi-text-light">平均促销天数:</span>
                    <span className="font-medium">{stats.operationStrategy.promoEffect.avgPromoDays.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-morandi-text-light">促销产品均销:</span>
                    <span className="font-medium">{Math.round(stats.operationStrategy.promoEffect.avgSales).toLocaleString()}</span>
                  </div>
                </div>
              )}
              <div className="bg-red-50 rounded-lg p-2 border border-red-100">
                <div className="text-xs text-red-700">
                  <strong>促销建议:</strong> {stats.operationStrategy.promoStats.count > stats.productCount * 0.5 ? '促销竞争激烈，建议差异化促销时机' : '促销参与度不高，有促销红利机会'}
                </div>
              </div>
            </div>
            
            {/* 推广策略分析 */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-morandi-text mb-2">📢 推广策略</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-blue-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-blue-600">{stats.operationStrategy.adStats.count}</div>
                  <div className="text-xs text-blue-500">参与推广产品</div>
                </div>
                <div className="bg-indigo-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-indigo-600">{stats.operationStrategy.adStats.highDuration}</div>
                  <div className="text-xs text-indigo-500">长期推广(≥50%)</div>
                </div>
              </div>
              {stats.operationStrategy.adEffect && (
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-morandi-text-light">平均推广天数:</span>
                    <span className="font-medium">{stats.operationStrategy.adEffect.avgAdDays.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-morandi-text-light">推广产品均销:</span>
                    <span className="font-medium">{Math.round(stats.operationStrategy.adEffect.avgSales).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-morandi-text-light">平均广告费用:</span>
                    <span className="font-medium">¥{fmtCNY(stats.operationStrategy.adEffect.avgAdCost)}</span>
                  </div>
                </div>
              )}
              <div className="bg-blue-50 rounded-lg p-2 border border-blue-100">
                <div className="text-xs text-blue-700">
                  <strong>推广建议:</strong> {stats.operationStrategy.adStats.count > stats.productCount * 0.5 ? '推广竞争激烈，需优化投放效率' : '推广参与度不高，有广告红利机会'}
                </div>
              </div>
            </div>
            
            {/* 最佳实践 */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-morandi-text mb-2">🏆 高销产品运营策略</div>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {stats.operationStrategy.bestPractice.map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                    <div className="min-w-0">
                      <span className="text-morandi-text truncate block">{p.name}</span>
                      <span className="text-morandi-secondary">{p.strategy}</span>
                    </div>
                    <span className="font-bold text-morandi-primary ml-2">{p.qty.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="bg-green-50 rounded-lg p-2 border border-green-100">
                <div className="text-xs text-green-700">
                  <strong>策略洞察:</strong> {stats.operationStrategy.insight}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4 flex items-center gap-2"><Zap className="w-5 h-5 text-green-500" /> 高潜力产品TOP10</h3>
          <div className="mb-3 bg-green-50 rounded-lg p-2 border border-green-200">
            <div className="text-xs text-green-700">
              <strong>📐 潜力指数计算方法:</strong> 综合指数 {'='} 销量×0.4 {'+'} 潜力指数原始值×0.6。原始潜力指数来自数据表，按(销量×0.3 {'+'} 曝光量×0.3 {'+'} 转化率×0.4)综合计算
            </div>
          </div>
          <div className="space-y-2">
            {stats.highPotential.map((p, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                  <div className="min-w-0">
                    <span className="text-sm text-morandi-text truncate block">{p.name.slice(0, 25)}</span>
                    {p.zhTags.length > 0 && <span className="text-xs text-morandi-secondary">{p.zhTags.slice(0, 2).join(' · ')}</span>}
                    <span className="text-xs text-green-600 font-medium">✓ {p.selectReason}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <div className="font-bold text-morandi-primary">{p.qty > 0 ? p.qty.toLocaleString() : (p.potential || 0).toFixed(0)}</div>
                  <div className="text-xs text-morandi-text-light">销量</div>
                  <div className="font-bold text-green-600 text-sm">¥{Math.round(p.price * R).toLocaleString()}</div>
                  <div className="text-xs text-morandi-text-light">售价</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-purple-500" /> 真空地带产品 (高价高销)</h3>
          <div className="mb-3 bg-purple-50 rounded-lg p-2 border border-purple-200">
            <div className="text-xs text-purple-700">
              <strong>📐 筛选条件:</strong> 价格 {'>'} 市场均价 且 销量 {'>'} 市场平均销量。代表高价高销的蓝海市场，竞争较少但要求产品有足够竞争力
            </div>
          </div>
          <div className="space-y-2">
            {stats.vacuumZone.length > 0 ? stats.vacuumZone.map((p, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg hover:bg-purple-100">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-purple-200 text-purple-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm text-morandi-text truncate">{p.name.slice(0, 20)}</p>
                    {p.zhTags.length > 0 && <p className="text-xs text-morandi-secondary">{p.zhTags.slice(0, 2).join(' · ')}</p>}
                    <span className="text-xs text-purple-600 font-medium">✓ {p.selectReason}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <div className="font-bold text-purple-600">{p.qty.toLocaleString()}</div>
                  <div className="text-xs text-purple-400">销量</div>
                  <div className="font-bold text-purple-700 text-sm">¥{Math.round(p.price * R).toLocaleString()}</div>
                  <div className="text-xs text-purple-400">售价</div>
                </div>
              </div>
            )) : <p className="text-center text-morandi-text-light py-8">暂无高价高销量产品</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4">📈 价格-销量散点图 (蓝海识别)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
              <XAxis dataKey="price" name="价格" tickFormatter={(v) => `¥${Math.round(v * R)}`} tick={{ fontSize: 10 }} />
              <YAxis dataKey="qty" name="销量" tick={{ fontSize: 10 }} />
              <Tooltip content={({ active, payload }) => active && payload?.length ? (
                <div className="bg-white p-2 shadow-lg rounded text-xs">
                  <p className="font-medium">{payload[0].payload.name}</p>
                  <p>价格: ¥{Math.round(payload[0].payload.price * R).toLocaleString()}</p>
                  <p>销量: {payload[0].payload.qty.toLocaleString()}</p>
                </div>
              ) : null} />
              <Scatter data={stats.priceElasticity.slice(0, 50)} fill="#8B9DC3" />
            </ScatterChart>
          </ResponsiveContainer>
          <div className="mt-3 bg-blue-50 rounded-lg p-3">
            <div className="text-xs text-blue-700">
              <strong>💡 分析洞察:</strong> {stats.priceScatterAnalysis.insight}
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4">🔍 价格带销量分析</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-xs text-green-600 mb-1">低价区 (30%)</div>
                <div className="text-lg font-bold text-green-700">{stats.priceScatterAnalysis.lowPrice.count}个</div>
                <div className="text-xs text-green-600">均销{Math.round(stats.priceScatterAnalysis.lowPrice.avgQty).toLocaleString()}</div>
                <div className="text-xs text-green-500">¥{Math.round(stats.priceScatterAnalysis.lowPrice.avgPrice * R).toLocaleString()}</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-xs text-blue-600 mb-1">中价区 (40%)</div>
                <div className="text-lg font-bold text-blue-700">{stats.priceScatterAnalysis.midPrice.count}个</div>
                <div className="text-xs text-blue-600">均销{Math.round(stats.priceScatterAnalysis.midPrice.avgQty).toLocaleString()}</div>
                <div className="text-xs text-blue-500">¥{Math.round(stats.priceScatterAnalysis.midPrice.avgPrice * R).toLocaleString()}</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <div className="text-xs text-purple-600 mb-1">高价区 (30%)</div>
                <div className="text-lg font-bold text-purple-700">{stats.priceScatterAnalysis.highPrice.count}个</div>
                <div className="text-xs text-purple-600">均销{Math.round(stats.priceScatterAnalysis.highPrice.avgQty).toLocaleString()}</div>
                <div className="text-xs text-purple-500">¥{Math.round(stats.priceScatterAnalysis.highPrice.avgPrice * R).toLocaleString()}</div>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-morandi-text-light font-medium mb-2">🎯 高销量低竞争产品 (蓝海机会)</div>
              {stats.priceScatterAnalysis.highSalesLowComp.length > 0 ? (
                <div className="space-y-1">
                  {stats.priceScatterAnalysis.highSalesLowComp.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-morandi-text truncate max-w-[150px]">{p.name.slice(0, 20)}</span>
                      <span className="text-morandi-secondary">¥{Math.round(p.price * R).toLocaleString()}</span>
                      <span className="font-bold text-green-600">{p.qty.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-morandi-text-light">暂无高销量低竞争产品</div>
              )}
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
              <div className="text-xs text-yellow-700">
                <strong>价格-销量相关系数:</strong> {stats.priceScatterAnalysis.priceCorrelation.toFixed(2)}
                <span className="ml-2">{Math.abs(stats.priceScatterAnalysis.priceCorrelation) < 0.3 ? '⚡ 弱相关' : stats.priceScatterAnalysis.priceCorrelation < 0 ? '📉 负相关' : '📈 正相关'}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4">💹 广告ROI TOP10 (高回报产品)</h3>
          <div className="space-y-2 max-h-[320px] overflow-y-auto">
            {stats.adEfficiency.slice(0, 10).map((p, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-blue-50 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i < 3 ? 'bg-yellow-400 text-white' : 'bg-blue-100 text-blue-600'}`}>{i + 1}</span>
                  <div className="min-w-0">
                    <span className="text-sm text-morandi-text truncate block font-medium">{p.name.slice(0, 20)}</span>
                    {p.zhTags.length > 0 && <span className="text-xs text-morandi-secondary">{p.zhTags.slice(0, 2).join(' · ')}</span>}
                    <span className="text-xs text-morandi-text-light block">广告占比{p.adRatio.toFixed(2)}% · 销售¥{fmtCNYFull(p.sales)}</span>
                  </div>
                </div>
                <div className="text-right ml-2 flex-shrink-0">
                  <span className={`font-bold text-sm block ${p.roi > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ROI {(p.roi * 100).toFixed(0)}%
                  </span>
                  <span className="text-xs text-morandi-text-light">
                    {p.salesMultiple?.toFixed(1)}倍回报
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 bg-blue-50 rounded-lg p-2 text-xs text-blue-700">
            <strong>ROI计算:</strong> (销售额-广告费)/广告费，广告费=销售额×广告占比%。ROI&gt;0表示盈利
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4">📊 高ROI产品策略分析</h3>
          {stats.adEfficiency.length > 0 ? (() => {
            const top10 = stats.adEfficiency.slice(0, 10)
            const avgRoi = top10.reduce((s, p) => s + p.roi, 0) / top10.length
            const avgAdRatio = top10.reduce((s, p) => s + p.adRatio, 0) / top10.length
            const avgPrice = top10.reduce((s, p) => s + p.price, 0) / top10.length
            const commonTags = {}
            top10.forEach(p => {
              p.zhTags.forEach(tag => {
                commonTags[tag] = (commonTags[tag] || 0) + 1
              })
            })
            const topTags = Object.entries(commonTags).sort((a, b) => b[1] - a[1]).slice(0, 3)
            const priceBand = avgPrice < 1000 ? '低价位' : avgPrice < 3000 ? '中价位' : '高价位'
            
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-green-50 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-green-600">{avgRoi === Infinity ? '∞' : `${(avgRoi * 100).toFixed(0)}%`}</div>
                    <div className="text-xs text-green-500">平均ROI</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-blue-600">{avgAdRatio.toFixed(2)}%</div>
                    <div className="text-xs text-blue-500">平均广告占比</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-purple-600">¥{Math.round(avgPrice * R).toLocaleString()}</div>
                    <div className="text-xs text-purple-500">平均售价</div>
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-morandi-text-light font-medium mb-2">🏷️ 高ROI产品共同特征</div>
                  <div className="flex flex-wrap gap-1">
                    {topTags.map(([tag, count], i) => (
                      <span key={i} className="px-2 py-1 bg-morandi-primary/10 text-morandi-primary rounded text-xs">{tag} ({count}/10)</span>
                    ))}
                    {topTags.length === 0 && <span className="text-xs text-morandi-text-light">暂无共同特征</span>}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-xs text-morandi-text-light font-medium">💡 策略建议</div>
                  <div className="p-2 rounded-lg border-l-4 border-green-500 bg-green-50">
                    <div className="text-xs text-green-700">
                      <strong>定价策略:</strong> 高ROI产品集中在{priceBand}区间(¥{Math.round(avgPrice * R).toLocaleString()})，建议新品的定价参考此区间
                    </div>
                  </div>
                  <div className="p-2 rounded-lg border-l-4 border-blue-500 bg-blue-50">
                    <div className="text-xs text-blue-700">
                      <strong>广告投放:</strong> 平均广告占比{avgAdRatio.toFixed(2)}%即可实现高回报，{avgAdRatio < 5 ? '属于低投入高回报模式' : avgAdRatio < 10 ? '属于中等投入模式' : '需要较高广告投入'}，建议控制在此范围内
                    </div>
                  </div>
                  <div className="p-2 rounded-lg border-l-4 border-purple-500 bg-purple-50">
                    <div className="text-xs text-purple-700">
                      <strong>产品差异化:</strong> {topTags.length > 0 ? `TOP10高ROI产品中${topTags[0][0]}出现${topTags[0][1]}次，是该品类的核心竞争力` : '建议通过功能差异化提升ROI'}
                    </div>
                  </div>
                </div>
                
                <div className="bg-yellow-50 rounded-lg p-2 border border-yellow-200">
                  <div className="text-xs text-yellow-700">
                    <strong>⚠️ 风险提示:</strong> {avgRoi > 2 ? '当前高ROI产品回报率极高，可能面临竞争加剧风险，建议尽快建立品牌壁垒' : avgRoi > 0.5 ? 'ROI表现良好，可持续投入' : 'ROI相对较低，需优化广告效率或提升客单价'}
                  </div>
                </div>
              </div>
            )
          })() : (
            <div className="text-center py-8 text-morandi-text-light">暂无广告ROI数据</div>
          )}
        </div>
      </div>

      {/* 无广告投入高销产品板块 */}
      {stats.noAdHighSales && stats.noAdHighSales.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4 flex items-center gap-2">
            <span className="text-2xl">🌟</span> 无广告投入高销产品TOP10 (自然流量爆款)
          </h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {stats.noAdHighSales.map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg hover:from-green-100 hover:to-emerald-100 transition-colors border border-green-100">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i < 3 ? 'bg-green-500 text-white' : 'bg-green-200 text-green-700'}`}>{i + 1}</span>
                      <div className="min-w-0">
                        <span className="text-sm text-morandi-text truncate block font-medium">{p.name.slice(0, 22)}</span>
                        {p.zhTags.length > 0 && <span className="text-xs text-morandi-secondary">{p.zhTags.slice(0, 2).join(' · ')}</span>}
                        <span className="text-xs text-morandi-text-light block">{p.brand} · ¥{Math.round(p.price * R).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <div className="font-bold text-green-600">{p.qty.toLocaleString()}</div>
                      <div className="text-xs text-green-500">销量</div>
                      <div className="font-bold text-emerald-600 text-sm">¥{fmtCNYFull(p.sales)}</div>
                      <div className="text-xs text-emerald-500">销售额</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.noAdHighSales.length}</div>
                  <div className="text-xs text-green-500">无广告高销产品</div>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-emerald-600">{stats.noAdHighSales.reduce((s, p) => s + p.qty, 0).toLocaleString()}</div>
                  <div className="text-xs text-emerald-500">总销量</div>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-morandi-text-light font-medium mb-2">🏷️ 共同特征</div>
                {(() => {
                  const tagCount = {}
                  stats.noAdHighSales.forEach(p => {
                    p.zhTags.forEach(tag => { tagCount[tag] = (tagCount[tag] || 0) + 1 })
                  })
                  const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 3)
                  return (
                    <div className="flex flex-wrap gap-1">
                      {topTags.map(([tag, count], i) => (
                        <span key={i} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">{tag} ({count}/10)</span>
                      ))}
                      {topTags.length === 0 && <span className="text-xs text-morandi-text-light">暂无共同特征</span>}
                    </div>
                  )
                })()}
              </div>
              
              <div className="space-y-2">
                <div className="text-xs text-morandi-text-light font-medium">💡 成功因素分析</div>
                <div className="p-2 rounded-lg border-l-4 border-green-500 bg-green-50">
                  <div className="text-xs text-green-700">
                    <strong>自然流量优势:</strong> 这些产品零广告投入却获得高销量，说明具备强大的自然搜索排名或口碑传播能力
                  </div>
                </div>
                <div className="p-2 rounded-lg border-l-4 border-blue-500 bg-blue-50">
                  <div className="text-xs text-blue-700">
                    <strong>产品竞争力:</strong> {(() => {
                      const avgPrice = stats.noAdHighSales.reduce((s, p) => s + p.price, 0) / stats.noAdHighSales.length
                      return `平均售价¥${Math.round(avgPrice * R).toLocaleString()}，${avgPrice < stats.avgPrice ? '低于市场均价，价格竞争力强' : '高于市场均价，品质/品牌溢价能力强'}`
                    })()}
                  </div>
                </div>
                <div className="p-2 rounded-lg border-l-4 border-purple-500 bg-purple-50">
                  <div className="text-xs text-purple-700">
                    <strong>学习借鉴:</strong> 建议分析这些产品的标题关键词、主图设计、评价管理策略，复制其成功模式
                  </div>
                </div>
              </div>
              
              <div className="bg-yellow-50 rounded-lg p-2 border border-yellow-200">
                <div className="text-xs text-yellow-700">
                  <strong>⚠️ 注意:</strong> 无广告产品依赖自然流量，需持续优化SEO和用户体验，防止排名下滑
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4">📊 品牌市场份额</h3>
          <div className="space-y-3">
            {stats.topBrands.slice(0, 5).map((brand) => (
              <div key={brand.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{brand.name}</span>
                  <span className="text-morandi-text-light">{brand.share}%</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-morandi-primary to-morandi-secondary rounded-full" style={{ width: `${brand.share}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4">🎯 核心运营指标</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">¥{Math.round(stats.avgPrice * R).toLocaleString()}</div>
              <div className="text-xs text-blue-500">平均客单价</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.avgGross != null && stats.avgGross > 0 ? `${stats.avgGross.toFixed(1)}%` : '未知'}</div>
              <div className="text-xs text-green-500">平均毛利率</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-purple-600">¥{fmtCNY(stats.totalAdCost)}</div>
              <div className="text-xs text-purple-500">广告总投入</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.avgCartRate?.toFixed(2)}%</div>
              <div className="text-xs text-orange-500">加购转化率</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4">🚀 新品进入机会分析</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg">
              <div>
                <div className="text-sm text-morandi-text-light">市场竞争格局</div>
                <div className="text-xl font-bold text-green-600">{stats.marketPower}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-morandi-text-light">HHI指数</div>
                <div className="text-xl font-bold text-morandi-primary">{stats.hhi.toFixed(0)}</div>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-morandi-text-light mb-2">💎 蓝海价格带机会</div>
              {stats.underservedPrices.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {stats.underservedPrices.map((p, i) => (
                    <span key={i} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">¥{Math.round(p.price * R)} (±¥{Math.round(300 * R)}) 仅{p.count}个竞品</span>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-morandi-text-light">各价格带竞争较充分</span>
              )}
            </div>
            <div className="space-y-2">
              <div className="text-xs text-morandi-text-light font-medium">📋 进入建议</div>
              <div className="p-3 rounded-lg border-l-4 border-blue-500 bg-blue-50">
                <div className="font-medium text-sm text-morandi-text">价格空白</div>
                <div className="text-xs text-morandi-text-light mt-1">{stats.underservedPrices.length > 0 ? `建议在¥${Math.round(stats.underservedPrices[0].price * R)}附近定价，竞争少` : '各价格带竞争较充分'}</div>
              </div>
              <div className="p-3 rounded-lg border-l-4 border-green-500 bg-green-50">
                <div className="font-medium text-sm text-morandi-text">功能空白</div>
                <div className="text-xs text-morandi-text-light mt-1">{stats.featureData.length > 0 ? `${stats.featureData[stats.featureData.length - 1]?.zh}功能竞品少，可差异化` : '功能覆盖较全'}</div>
              </div>
              <div className="p-3 rounded-lg border-l-4 border-purple-500 bg-purple-50">
                <div className="font-medium text-sm text-morandi-text">品牌机会</div>
                <div className="text-xs text-morandi-text-light mt-1">{stats.marketPower === '竞争型' ? '市场分散，适合新品牌进入' : `头部品牌占${stats.marketConcentration.toFixed(0)}%市场`}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4">🏛️ 市场竞争垄断度分析</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <div className="text-xs text-red-500">Top1品牌</div>
                <div className="font-bold text-red-600">{stats.topBrands[0]?.name || '-'}</div>
                <div className="text-sm text-red-400">{stats.topBrands[0]?.share || 0}%</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 text-center">
                <div className="text-xs text-orange-500">Top3品牌</div>
                <div className="font-bold text-orange-600">{stats.marketConcentration?.toFixed(1) || 0}%</div>
                <div className="text-sm text-orange-400">市场份额</div>
              </div>
            </div>
            <div className="text-xs text-morandi-text-light font-medium">🏆 品牌层级与壁垒</div>
            <div className="space-y-2">
              {stats.brandPower?.slice(0, 6).map((brand, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-400 text-white' : i < 3 ? 'bg-orange-400 text-white' : 'bg-blue-400 text-white'}`}>{i + 1}</span>
                    <span className="text-sm font-medium">{brand.name}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${brand.powerLevel === '绝对龙头' ? 'bg-yellow-100 text-yellow-700' : brand.powerLevel === '强势品牌' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>{brand.powerLevel}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${brand.barrierLevel === '高壁垒' ? 'bg-red-100 text-red-700' : brand.barrierLevel === '中壁垒' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{brand.barrierLevel}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-morandi-text-light mb-2">📊 垄断指数解读</div>
              <div className="text-sm">
                {stats.hhi > 2500 ? <span className="text-red-600">⚠️ 市场高度集中，头部品牌壁垒高，新进入者需要差异化突破</span> : stats.hhi > 1500 ? <span className="text-yellow-600">⚡ 市场中等集中，存在突围机会，建议聚焦细分人群</span> : <span className="text-green-600">✅ 市场分散竞争充分，新品牌有较好进入机会</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-morandi-text mb-4 flex items-center gap-2"><Sparkles className="w-5 h-5 text-morandi-primary" /> 💡 策略建议</h3>
        <div className="grid grid-cols-3 gap-4">
          <RecommendationCard title="💰 定价策略" content={(() => {
            const bestBand = stats.priceData.reduce((best, p) => {
              const ratio = p.count > 0 ? p.sales / p.count : 0
              return ratio > (best.ratio || 0) ? { ...p, ratio } : best
            }, {})
            const topSalesBand = [...stats.priceData].sort((a, b) => b.sales - a.sales)[0]
            return `建议定价${topSalesBand?.name || '¥75-375'}区间，该区间总销售额¥${fmtCNYFull(topSalesBand?.sales || 0)}，单品产出最高为${bestBand?.name || '中端'}区间`
          })()} color="blue" />
          <RecommendationCard title="📦 发货建议" content={(() => {
            const topShipping = [...stats.fbsFboChartData].sort((a, b) => b.qty - a.qty)[0]
            return topShipping ? `${topShipping.name}模式销量最高(${topShipping.qty.toLocaleString()}件)，建议优先选择${topShipping.name}以获取更多流量` : 'FBO+FBS模式占比最高，建议优先采用FBO+FBS'
          })()} color="green" />
          <RecommendationCard title="🎯 差异化" content={(() => {
            const topFeature = stats.featureData[0]
            const lowFeature = stats.featureData[stats.featureData.length - 1]
            return topFeature ? `${topFeature.zh}(${topFeature.count}款)最受欢迎，${lowFeature?.zh || ''}竞品少可差异化` : '功能覆盖较全'
          })()} color="purple" />
          <RecommendationCard title="📈 市场机会" content={`Top3品牌占${stats.marketConcentration?.toFixed(1)}%市场，${stats.marketConcentration > 60 ? '集中度高，需差异化突破' : stats.marketConcentration > 40 ? '中等集中，存在突围空间' : '市场分散，新品牌机会大'}`} color="orange" />
          <RecommendationCard title="⚡ 广告投放" content={(() => {
            const totalAdRatio = stats.totalSales > 0 ? (stats.totalAdCost / stats.totalSales * 100) : 0
            return `整体广告占比${totalAdRatio.toFixed(2)}%，${totalAdRatio > 10 ? '占比偏高，建议优化投放效率' : totalAdRatio > 5 ? '占比适中，高ROI产品可增加' : '占比较低，有加大投放空间'}`
          })()} color="red" />
          <RecommendationCard title="🎯 黑马机会" content={(() => {
            const vacuumCount = stats.vacuumZone.length
            const newCount = stats.newProducts180?.length || 0
            return `真空地带(高价高销)${vacuumCount}个蓝海机会，近180天新品${newCount}个${newCount > 0 ? '，新品有成功先例' : ''}`
          })()} color="teal" />
        </div>
      </div>

      <div className="bg-gradient-to-r from-morandi-primary/10 to-morandi-secondary/10 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-morandi-text mb-4">🌟 市场进入策略建议</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4 border-l-4 border-morandi-primary">
            <h4 className="font-semibold text-morandi-text mb-2">💡 产品差异化</h4>
            <p className="text-sm text-morandi-text-light">{stats.featureData.length > 0 ? `基于数据TOP功能关键词"${stats.featureData[0]?.zh}"，重点配置热门功能，同时关注"${stats.featureData[stats.featureData.length - 1]?.zh}"等差异化方向` : '重点配置热门功能，打造差异化卖点'}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border-l-4 border-green-500">
            <h4 className="font-semibold text-morandi-text mb-2">⚡ 性能与品质</h4>
            <p className="text-sm text-morandi-text-light">俄罗斯消费者重视产品品质和耐用性，建议通过认证和品质保证提升信任度</p>
          </div>
          <div className="bg-white rounded-lg p-4 border-l-4 border-purple-500">
            <h4 className="font-semibold text-morandi-text mb-2">📦 发货与物流</h4>
            <p className="text-sm text-morandi-text-light">{stats.fbsFboChartData.length > 0 ? `市场主流发货方式为${[...stats.fbsFboChartData].sort((a, b) => b.qty - a.qty)[0]?.name}，建议新卖家优先选择以获取平台流量倾斜` : 'FBO+FBS模式可兼顾流量和灵活性'}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border-l-4 border-orange-500">
            <h4 className="font-semibold text-morandi-text mb-2">🔧 市场准入</h4>
            <p className="text-sm text-morandi-text-light">{stats.marketConcentration > 50 ? `市场集中度${stats.marketConcentration.toFixed(0)}%，头部壁垒高，建议从细分品类切入` : `市场集中度${stats.marketConcentration.toFixed(0)}%，竞争相对分散，有较好进入机会`}。必须符合EAC认证标准</p>
          </div>
        </div>
      </div>
    </>
  )
}
