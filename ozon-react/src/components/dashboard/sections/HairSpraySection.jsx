import { Download } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { R } from '../dictionary'

export default function HairSpraySection({ stats, data, sprayExporting, sprayStockRef, exportSprayStockPDF }) {
  return (
    <>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-morandi-text mb-4 flex items-center gap-2">
            <span className="text-2xl">🌿</span> 护发精油专项分析 · 规格与价格
          </h3>

          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="bg-emerald-50 rounded-lg p-3 text-center">
              <div className="text-xs text-morandi-text-light">精油产品数</div>
              <div className="text-2xl font-bold text-emerald-700">{stats.sprayAnalysis.totalProducts}</div>
            </div>
            <div className="bg-teal-50 rounded-lg p-3 text-center">
              <div className="text-xs text-morandi-text-light">总销量</div>
              <div className="text-2xl font-bold text-teal-700">{stats.sprayAnalysis.totalQty.toLocaleString()}</div>
            </div>
            <div className="bg-cyan-50 rounded-lg p-3 text-center">
              <div className="text-xs text-morandi-text-light">100ml规格均价</div>
              <div className="text-2xl font-bold text-cyan-700">₽{stats.sprayAnalysis.spray100mlAvgPrice}</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <div className="text-xs text-morandi-text-light">精油喷雾均价</div>
              <div className="text-2xl font-bold text-amber-700">₽{stats.sprayAnalysis.oilSprayAvgPrice}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3">📦 容量分布（按销量）</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.sprayAnalysis.volumeData.slice(0, 10)} layout="vertical" margin={{ left: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={50} />
                  <Tooltip formatter={(v, name) => name === '销量' ? [v.toLocaleString(), name] : [`₽${v}`, name]} />
                  <Bar dataKey="qty" fill="#6EE7B7" name="销量" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3">💰 容量价格区间</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.sprayAnalysis.priceByVolumeData} margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => [`₽${v}`, '']} />
                  <Bar dataKey="minPrice" fill="#A7F3D0" name="最低价" />
                  <Bar dataKey="avgPrice" fill="#6EE7B7" name="均价" />
                  <Bar dataKey="maxPrice" fill="#34D399" name="最高价" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3">✨ 功效分布（按销量）</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.sprayAnalysis.effectData.slice(0, 10)} layout="vertical" margin={{ left: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={50} />
                  <Tooltip formatter={(v, name) => name === '销量' ? [v.toLocaleString(), name] : [v, name]} />
                  <Bar dataKey="qty" fill="#5EEAD4" name="销量" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3">🎯 适用发质分布（按销量）</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.sprayAnalysis.hairTypeData.slice(0, 8)} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={40} />
                  <Tooltip formatter={(v, name) => name === '销量' ? [v.toLocaleString(), name] : [v, name]} />
                  <Bar dataKey="qty" fill="#99F6E4" name="销量" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <h4 className="text-sm font-semibold text-morandi-text mb-3">🏆 TOP10热销护发精油</h4>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-xs">
              <thead><tr className="bg-gray-50"><th className="px-2 py-2 text-left">排名</th><th className="px-2 py-2 text-left">商品名称</th><th className="px-2 py-2 text-center">容量</th><th className="px-2 py-2 text-center">功效</th><th className="px-2 py-2 text-center">适用发质</th><th className="px-2 py-2 text-right">单价(₽)</th><th className="px-2 py-2 text-right">每100ml(₽)</th><th className="px-2 py-2 text-right">销量</th></tr></thead>
              <tbody>
                {stats.sprayAnalysis.top10Products.map((p, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-2 py-2 font-bold text-morandi-text">{i + 1}</td>
                    <td className="px-2 py-2 max-w-[200px] truncate" title={p.name}>{p.name}</td>
                    <td className="px-2 py-2 text-center"><span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[10px]">{p._volume || '-'}</span></td>
                    <td className="px-2 py-2 text-center"><span className="bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded text-[10px]">{p._effects || '-'}</span></td>
                    <td className="px-2 py-2 text-center"><span className="bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded text-[10px]">{p._hairTypes || '-'}</span></td>
                    <td className="px-2 py-2 text-right font-medium">₽{Math.round(p.price).toLocaleString()}</td>
                    <td className="px-2 py-2 text-right">{p._pricePer100ml ? <span className="text-teal-600">₽{p._pricePer100ml}</span> : <span className="text-gray-300">-</span>}</td>
                    <td className="px-2 py-2 text-right font-bold">{(p.qty || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {stats.sprayAnalysis.packagingAnalysis && (
            <div className="border-t border-gray-100 pt-4 mt-4">
              <h4 className="text-sm font-bold text-morandi-text mb-4 flex items-center gap-2">
                <span className="text-lg">📦</span> 正装容量设计与备货量分析
              </h4>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg p-4 border border-emerald-100">
                  <h5 className="text-xs font-bold text-emerald-800 mb-3">🧴 正装 150ml · 主力款</h5>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-morandi-text-light">包材容量</span><span className="font-bold text-emerald-700">150ml</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">市场同类产品数</span><span className="font-bold">{stats.sprayAnalysis.packagingAnalysis.fullSize.marketProductCount}款</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">市场150ml段均价</span><span className="font-bold">₽{stats.sprayAnalysis.packagingAnalysis.fullSize.avgMarketPrice}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">我方150ml定价</span><span className="font-bold text-emerald-700">₽599</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">我方每100ml</span><span className="font-bold text-emerald-600">₽{stats.sprayAnalysis.packagingAnalysis.fullSize.pricePer100ml.toFixed(0)}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">国内兼容性</span><span className="text-[10px] text-emerald-600 font-bold">✅ 150ml为国内主流护发精油容量，包材通用</span></div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-emerald-200 text-[10px] text-emerald-700 space-y-0.5">
                    <div>💡 150ml兼顾俄罗斯大容量偏好和国内标准规格</div>
                    <div>💡 对标竞品100ml定价₽459，150ml容量溢价自然</div>
                    <div>💡 大容量降低单位成本，提升复购周期</div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-lg p-4 border border-cyan-100">
                  <h5 className="text-xs font-bold text-cyan-800 mb-3">🧪 试用装 50ml · 引流款</h5>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-morandi-text-light">包材容量</span><span className="font-bold text-cyan-700">50ml</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">市场同类产品数</span><span className="font-bold">{stats.sprayAnalysis.packagingAnalysis.trialSize.marketProductCount}款</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">市场50ml段均价</span><span className="font-bold">₽{stats.sprayAnalysis.packagingAnalysis.trialSize.avgMarketPrice}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">试用装定价</span><span className="font-bold text-cyan-700">₽{stats.sprayAnalysis.ourSpray.skus[0].ourPriceRUB}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">试用装每100ml</span><span className="font-bold text-cyan-600">₽{stats.sprayAnalysis.packagingAnalysis.trialSize.pricePer100ml.toFixed(0)}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">国内兼容性</span><span className="text-[10px] text-cyan-600 font-bold">✅ 50ml为国内旅行装/试用装标准规格</span></div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-cyan-200 text-[10px] text-cyan-700 space-y-0.5">
                    <div>💡 低价引流降低首次购买门槛</div>
                    <div>💡 试用装→正装转化路径清晰</div>
                    <div>💡 可做"买正装送试用装"促销组合</div>
                  </div>
                </div>
              </div>

              <h5 className="text-xs font-semibold text-morandi-text mb-3">📈 备货量与可销售时间分析</h5>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <div className="text-[10px] text-morandi-text-light">TOP10日均总销量</div>
                  <div className="text-xl font-bold text-amber-700">{stats.sprayAnalysis.packagingAnalysis.top10AvgDailyQty}</div>
                  <div className="text-[10px] text-amber-600">件/天（30天均值）</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <div className="text-[10px] text-morandi-text-light">TOP10单品日均销量</div>
                  <div className="text-xl font-bold text-amber-700">{stats.sprayAnalysis.packagingAnalysis.top10AvgDailyQtyPerProduct}</div>
                  <div className="text-[10px] text-amber-600">件/天/款（30天均值）</div>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <div className="text-[10px] text-morandi-text-light">补货警戒线</div>
                  <div className="text-xl font-bold text-red-700">{stats.sprayAnalysis.packagingAnalysis.reorderPoint}</div>
                  <div className="text-[10px] text-red-600">件（生产{stats.sprayAnalysis.packagingAnalysis.productionDaysDisplay}用量）</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <div className="text-[10px] text-morandi-text-light">180天内新品日均 × 30%</div>
                  <div className="text-xl font-bold text-blue-700">{stats.sprayAnalysis.packagingAnalysis.newProductEstByNewProduct}</div>
                  <div className="text-[10px] text-blue-600">件/天（新品TOP{stats.sprayAnalysis.packagingAnalysis.sprayNewProducts180Count}款，日均{stats.sprayAnalysis.packagingAnalysis.sprayNewProductAvgDailyQtyPerProduct}件×30%）</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <div className="text-[10px] text-morandi-text-light">TOP10单品日均 × 10%</div>
                  <div className="text-xl font-bold text-purple-700">{stats.sprayAnalysis.packagingAnalysis.newProductEstByTop10}</div>
                  <div className="text-[10px] text-purple-600">件/天（TOP10日均{stats.sprayAnalysis.packagingAnalysis.top10AvgDailyQtyPerProduct}件×10%）</div>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3 text-center border-2 border-emerald-200">
                  <div className="text-[10px] text-morandi-text-light">综合预估日均销量</div>
                  <div className="text-xl font-bold text-emerald-700">{stats.sprayAnalysis.packagingAnalysis.newProductEstDailyQty}</div>
                  <div className="text-[10px] text-emerald-600">件/天（双参考均值）</div>
                </div>
              </div>

              <div className="overflow-x-auto mb-4">
                <h5 className="text-xs font-semibold text-morandi-text mb-2">📌 原方案备货</h5>
                <table className="w-full text-xs border border-gray-200 rounded">
                  <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left">规格</th><th className="px-3 py-2 text-center">备货量</th><th className="px-3 py-2 text-center">预估日均销量</th><th className="px-3 py-2 text-center">可销售天数</th><th className="px-3 py-2 text-center">生产周期</th><th className="px-3 py-2 text-center">库存安全评估</th></tr></thead>
                  <tbody>
                    <tr className="border-t border-gray-100 bg-emerald-50/30">
                      <td className="px-3 py-2 font-bold text-emerald-700">🧴 正装 150ml</td>
                      <td className="px-3 py-2 text-center font-bold">{stats.sprayAnalysis.packagingAnalysis.fullSize.stock}件</td>
                      <td className="px-3 py-2 text-center">{stats.sprayAnalysis.packagingAnalysis.newProductEstDailyQty}件/天</td>
                      <td className="px-3 py-2 text-center font-bold">{stats.sprayAnalysis.packagingAnalysis.fullSizeSellDays}天</td>
                      <td className="px-3 py-2 text-center">{stats.sprayAnalysis.packagingAnalysis.productionDaysDisplay}</td>
                      <td className="px-3 py-2 text-center">
                        {stats.sprayAnalysis.packagingAnalysis.fullSizeSellDays > stats.sprayAnalysis.packagingAnalysis.productionDaysMax ? (
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">✅ 安全（可售{stats.sprayAnalysis.packagingAnalysis.fullSizeSellDays}天 &gt; 生产{stats.sprayAnalysis.packagingAnalysis.productionDaysMax}天）</span>
                        ) : (
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">⚠️ 不足（需提前补货）</span>
                        )}
                      </td>
                    </tr>
                    <tr className="border-t border-gray-100 bg-cyan-50/30">
                      <td className="px-3 py-2 font-bold text-cyan-700">🧪 试用装 50ml</td>
                      <td className="px-3 py-2 text-center font-bold">{stats.sprayAnalysis.packagingAnalysis.trialSize.stock}件</td>
                      <td className="px-3 py-2 text-center">{stats.sprayAnalysis.packagingAnalysis.newProductEstDailyQty}件/天</td>
                      <td className="px-3 py-2 text-center font-bold">{stats.sprayAnalysis.packagingAnalysis.trialSizeSellDays}天</td>
                      <td className="px-3 py-2 text-center">{stats.sprayAnalysis.packagingAnalysis.productionDaysDisplay}</td>
                      <td className="px-3 py-2 text-center">
                        {stats.sprayAnalysis.packagingAnalysis.trialSizeSellDays > stats.sprayAnalysis.packagingAnalysis.productionDaysMax ? (
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">✅ 安全（可售{stats.sprayAnalysis.packagingAnalysis.trialSizeSellDays}天 &gt; 生产{stats.sprayAnalysis.packagingAnalysis.productionDaysMax}天）</span>
                        ) : (
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">⚠️ 不足（需提前补货）</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {stats.sprayAnalysis.packagingAnalysis.improvedFullSize && (
                <div className="overflow-x-auto mb-4">
                  <h5 className="text-xs font-semibold text-morandi-text mb-2">🚀 改进备货方案</h5>
                  <table className="w-full text-xs border border-blue-200 rounded">
                    <thead><tr className="bg-blue-50"><th className="px-3 py-2 text-left">规格</th><th className="px-3 py-2 text-center">备货量</th><th className="px-3 py-2 text-center">预估日均销量</th><th className="px-3 py-2 text-center">可销售天数</th><th className="px-3 py-2 text-center">生产周期</th><th className="px-3 py-2 text-center">库存安全评估</th></tr></thead>
                    <tbody>
                      <tr className="border-t border-blue-100 bg-blue-50/30">
                        <td className="px-3 py-2 font-bold text-blue-700">🧴 正装 150ml</td>
                        <td className="px-3 py-2 text-center font-bold">
                          <div>{stats.sprayAnalysis.packagingAnalysis.improvedFullSize.totalStock}件</div>
                          <div className="text-[10px] text-blue-500 font-normal">🇷🇺 俄向{stats.sprayAnalysis.packagingAnalysis.improvedFullSize.stock}件 + 🇨🇳 国内{stats.sprayAnalysis.packagingAnalysis.improvedFullSize.domesticStock}件</div>
                        </td>
                        <td className="px-3 py-2 text-center">{stats.sprayAnalysis.packagingAnalysis.newProductEstDailyQty}件/天</td>
                        <td className="px-3 py-2 text-center font-bold">{stats.sprayAnalysis.packagingAnalysis.improvedFullSize.sellDays}天</td>
                        <td className="px-3 py-2 text-center">{stats.sprayAnalysis.packagingAnalysis.productionDaysDisplay}</td>
                        <td className="px-3 py-2 text-center">
                          {stats.sprayAnalysis.packagingAnalysis.improvedFullSize.sellDays > stats.sprayAnalysis.packagingAnalysis.productionDaysMax ? (
                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">✅ 安全（可售{stats.sprayAnalysis.packagingAnalysis.improvedFullSize.sellDays}天 &gt; 生产{stats.sprayAnalysis.packagingAnalysis.productionDaysMax}天）</span>
                          ) : (
                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">⚠️ 不足（需提前补货）</span>
                          )}
                        </td>
                      </tr>
                      <tr className="border-t border-blue-100 bg-indigo-50/30">
                        <td className="px-3 py-2 font-bold text-indigo-700">🧪 试用装 50ml</td>
                        <td className="px-3 py-2 text-center font-bold">{stats.sprayAnalysis.packagingAnalysis.improvedTrialSize.stock}件</td>
                        <td className="px-3 py-2 text-center">{stats.sprayAnalysis.packagingAnalysis.newProductEstDailyQty}件/天</td>
                        <td className="px-3 py-2 text-center font-bold">{stats.sprayAnalysis.packagingAnalysis.improvedTrialSize.sellDays}天</td>
                        <td className="px-3 py-2 text-center">{stats.sprayAnalysis.packagingAnalysis.productionDaysDisplay}</td>
                        <td className="px-3 py-2 text-center">
                          {stats.sprayAnalysis.packagingAnalysis.improvedTrialSize.sellDays > stats.sprayAnalysis.packagingAnalysis.productionDaysMax ? (
                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">✅ 安全（可售{stats.sprayAnalysis.packagingAnalysis.improvedTrialSize.sellDays}天 &gt; 生产{stats.sprayAnalysis.packagingAnalysis.productionDaysMax}天）</span>
                          ) : (
                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">⚠️ 不足（需提前补货）</span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="mt-2 text-[10px] text-blue-700 space-y-0.5 bg-blue-50 rounded p-2">
                    <div>💡 正装150ml总计{stats.sprayAnalysis.packagingAnalysis.improvedFullSize.totalStock}件（俄向{stats.sprayAnalysis.packagingAnalysis.improvedFullSize.stock}件 + 国内{stats.sprayAnalysis.packagingAnalysis.improvedFullSize.domesticStock}件），俄方可售{stats.sprayAnalysis.packagingAnalysis.improvedFullSize.sellDays}天</div>
                    <div>💡 试用装50ml保持200件不变，可售{stats.sprayAnalysis.packagingAnalysis.improvedTrialSize.sellDays}天</div>
                    <div>💡 150ml包材通用，俄向/国内共享同款包材，降低包材开模成本</div>
                    <div>💡 改进方案俄方正装可覆盖{Math.round(stats.sprayAnalysis.packagingAnalysis.improvedFullSize.sellDays / 30)}个月销售周期，减少补货频次</div>
                  </div>
                </div>
              )}

              <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                <h5 className="text-xs font-bold text-amber-800 mb-2">📋 备货策略建议</h5>
                <div className="text-xs text-amber-700 space-y-1.5 leading-relaxed">
                  <p>• <b>原方案备货</b>：正装150ml × {stats.sprayAnalysis.packagingAnalysis.fullSize.stock}件 + 试用装50ml × {stats.sprayAnalysis.packagingAnalysis.trialSize.stock}件</p>
                  <p>• <b>改进方案备货</b>：正装150ml × {stats.sprayAnalysis.packagingAnalysis.improvedFullSize.totalStock}件（🇷🇺俄向{stats.sprayAnalysis.packagingAnalysis.improvedFullSize.stock}件 + 🇨🇳国内{stats.sprayAnalysis.packagingAnalysis.improvedFullSize.domesticStock}件）+ 试用装50ml × {stats.sprayAnalysis.packagingAnalysis.improvedTrialSize.stock}件</p>
                  <p>• <b>改进可售周期</b>：正装约{stats.sprayAnalysis.packagingAnalysis.improvedFullSize.sellDays}天 / 试用装约{stats.sprayAnalysis.packagingAnalysis.improvedTrialSize.sellDays}天（基于新品保守日均{stats.sprayAnalysis.packagingAnalysis.newProductEstDailyQty}件估算）</p>
                  <p>• <b>补货时机</b>：库存降至<b>{stats.sprayAnalysis.packagingAnalysis.reorderPoint}件</b>时立即下单（覆盖{stats.sprayAnalysis.packagingAnalysis.productionDaysDisplay}生产期）</p>
                  <p>• <b>生产周期</b>：{stats.sprayAnalysis.packagingAnalysis.productionDaysDisplay}，改进方案建议上架后第{Math.max(1, stats.sprayAnalysis.packagingAnalysis.improvedFullSize.sellDays - stats.sprayAnalysis.packagingAnalysis.productionDaysMax)}天启动第二批生产</p>
                  <p>• <b>销量预估依据</b>：双参考估算——180天内喷雾新品TOP{stats.sprayAnalysis.packagingAnalysis.sprayNewProducts180Count}款日均{stats.sprayAnalysis.packagingAnalysis.sprayNewProductAvgDailyQtyPerProduct}件×30%={stats.sprayAnalysis.packagingAnalysis.newProductEstByNewProduct}件/天，TOP10单品日均{stats.sprayAnalysis.packagingAnalysis.top10AvgDailyQtyPerProduct}件×10%={stats.sprayAnalysis.packagingAnalysis.newProductEstByTop10}件/天，综合取均值{stats.sprayAnalysis.packagingAnalysis.newProductEstDailyQty}件/天</p>
                  <p>• <b>容量策略</b>：150ml正装兼容国内市场主流规格，50ml试用装降低首次购买门槛，两规格共享配方仅换包材</p>
                </div>
              </div>
            </div>
          )}

          {stats.sprayAnalysis.packagingAnalysis?.finalStock && (
            <div className="border-t border-gray-100 pt-4 mt-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-morandi-text flex items-center gap-2">
                  <span className="text-lg">📦</span> 精油喷雾备货计算
                </h4>
                <button
                  onClick={exportSprayStockPDF}
                  disabled={sprayExporting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  {sprayExporting ? '导出中...' : '导出PDF'}
                </button>
              </div>

              <div ref={sprayStockRef} className="bg-white p-2">

              <div className="bg-gradient-to-r from-indigo-50 via-emerald-50 to-cyan-50 rounded-lg p-4 mb-4 border border-indigo-100">
                <h5 className="text-xs font-bold text-indigo-800 mb-3">🎯 选品原因与市场容量</h5>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h6 className="text-[11px] font-semibold text-indigo-700">为什么选护发精油喷雾？</h6>
                    <ul className="text-[11px] text-morandi-text space-y-1 leading-relaxed list-none">
                      <li>✅ 市场需求大：喷雾品类共{stats.sprayAnalysis.totalProducts}款产品，30天总销量{stats.sprayAnalysis.totalQty?.toLocaleString()}件，需求旺盛</li>
                      <li>✅ 竞争可切入：TOP10品牌集中度适中，新品牌有机会突围</li>
                      <li>✅ 差异化定位：轻盈不塌·无矿物油·高端修护，填补市场空白</li>
                      <li>✅ 双规格策略：150ml正装主攻复购利润，50ml试用装降低首次购买门槛</li>
                      <li>✅ 搭配销售：50ml试用装可搭配吹风机赠品，带动关联销售</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h6 className="text-[11px] font-semibold text-emerald-700">市场分析</h6>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white/60 rounded p-2 text-center">
                        <div className="text-[10px] text-morandi-text-light">TOP300产品数</div>
                        <div className="text-sm font-bold text-emerald-700">{stats.sprayAnalysis.totalProducts}款</div>
                      </div>
                      <div className="bg-white/60 rounded p-2 text-center">
                        <div className="text-[10px] text-morandi-text-light">30天总销量</div>
                        <div className="text-sm font-bold text-teal-700">{stats.sprayAnalysis.totalQty?.toLocaleString()}件</div>
                      </div>
                      <div className="bg-white/60 rounded p-2 text-center">
                        <div className="text-[10px] text-morandi-text-light">30天总销售额</div>
                        <div className="text-sm font-bold text-indigo-700">¥{Math.round(stats.sprayAnalysis.totalSales * R).toLocaleString()}</div>
                      </div>
                      <div className="bg-white/60 rounded p-2 text-center">
                        <div className="text-[10px] text-morandi-text-light">品类均价</div>
                        <div className="text-sm font-bold text-amber-700">¥{Math.round(stats.sprayAnalysis.sprayAvgPrice * R)}</div>
                      </div>
                      <div className="bg-white/60 rounded p-2 text-center">
                        <div className="text-[10px] text-morandi-text-light">市场集中度</div>
                        <div className="text-[11px] font-bold text-rose-700">TOP3 {stats.sprayAnalysis.sprayMarketConcentration?.toFixed(1)}% / TOP10 {stats.sprayAnalysis.sprayMarketConcentrationTop10?.toFixed(1)}%</div>
                      </div>
                      <div className="bg-white/60 rounded p-2 text-center">
                        <div className="text-[10px] text-morandi-text-light">竞争格局</div>
                        <div className="text-sm font-bold text-green-700">分散型</div>
                        <div className="text-[10px] text-green-500">新品有进入机会</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <h5 className="text-xs font-semibold text-morandi-text mb-3">📊 市场容量分布（按销量占比）</h5>
              <div className="flex items-center gap-4 mb-2 text-[10px]">
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{backgroundColor:'#6EE7B7'}}></span> 销量（件）</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{backgroundColor:'#34D399'}}></span> 销量占比（%）</span>
              </div>
              <div className="mb-4">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stats.sprayAnalysis.packagingAnalysis.volumeDistribution} margin={{ left: 10, top: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
                    <Tooltip formatter={(v, name) => name === '销量占比' ? [`${v}%`, name] : [v.toLocaleString(), name]} />
                    <Bar yAxisId="left" dataKey="qty" fill="#6EE7B7" name="销量" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 10, fill: '#6EE7B7', formatter: (v) => v.toLocaleString() }} />
                    <Bar yAxisId="right" dataKey="pct" fill="#34D399" name="销量占比" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 10, fill: '#34D399', formatter: (v) => `${v}%` }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <h5 className="text-xs font-semibold text-morandi-text mb-3">📋 备货明细</h5>
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-xs border border-indigo-200 rounded">
                  <thead><tr className="bg-indigo-50"><th className="px-3 py-2 text-left">规格</th><th className="px-3 py-2 text-center">用途/渠道</th><th className="px-3 py-2 text-center">数量</th><th className="px-3 py-2 text-center">单瓶</th><th className="px-3 py-2 text-center">总ml</th><th className="px-3 py-2 text-center">小计</th><th className="px-3 py-2 text-center">预估日均</th><th className="px-3 py-2 text-center">可售天数</th><th className="px-3 py-2 text-center">安全评估</th></tr></thead>
                  <tbody>
                    <tr className="border-t border-indigo-100 bg-emerald-50/30">
                      <td className="px-3 py-2 font-bold text-emerald-700" rowSpan="2">🧴 150ml 正装</td>
                      <td className="px-3 py-2 text-center">🇷🇺 俄向销售</td>
                      <td className="px-3 py-2 text-center font-bold">{stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.overseas}件</td>
                      <td className="px-3 py-2 text-center" rowSpan="2">150ml</td>
                      <td className="px-3 py-2 text-center font-bold text-emerald-600" rowSpan="2">{(stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.total * 150).toLocaleString()}ml</td>
                      <td className="px-3 py-2 text-center font-bold text-emerald-700" rowSpan="2">{stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.total}件</td>
                      <td className="px-3 py-2 text-center" rowSpan="1">{stats.sprayAnalysis.packagingAnalysis.newProductEstDailyQty}件/天</td>
                      <td className="px-3 py-2 text-center font-bold" rowSpan="1">{stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.sellDays}天</td>
                      <td className="px-3 py-2 text-center" rowSpan="1">
                        {stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.sellDays > stats.sprayAnalysis.packagingAnalysis.productionDaysMax ? (
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">✅ 安全</span>
                        ) : (
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">⚠️ 不足</span>
                        )}
                      </td>
                    </tr>
                    <tr className="border-t border-indigo-100 bg-emerald-50/15">
                      <td className="px-3 py-2 text-center">🇨🇳 国内备货</td>
                      <td className="px-3 py-2 text-center font-bold">{stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.domestic}件</td>
                      <td className="px-3 py-2 text-center text-gray-400">—</td>
                      <td className="px-3 py-2 text-center text-gray-400">—</td>
                      <td className="px-3 py-2 text-center"><span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-[10px]">国内商城</span></td>
                    </tr>
                    <tr className="border-t border-indigo-100 bg-cyan-50/30">
                      <td className="px-3 py-2 font-bold text-cyan-700" rowSpan="3">🧪 50ml 试用装</td>
                      <td className="px-3 py-2 text-center">💨 吹风机赠品</td>
                      <td className="px-3 py-2 text-center font-bold">{stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.hairDryer}件</td>
                      <td className="px-3 py-2 text-center" rowSpan="3">50ml</td>
                      <td className="px-3 py-2 text-center font-bold text-cyan-600" rowSpan="3">{(stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.total * 50).toLocaleString()}ml</td>
                      <td className="px-3 py-2 text-center font-bold text-cyan-700" rowSpan="3">{stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.total}件</td>
                      <td className="px-3 py-2 text-center text-gray-400">—</td>
                      <td className="px-3 py-2 text-center text-gray-400">—</td>
                      <td className="px-3 py-2 text-center"><span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-[10px]">赠品</span></td>
                    </tr>
                    <tr className="border-t border-indigo-100 bg-cyan-50/20">
                      <td className="px-3 py-2 text-center">🇨🇳 国内备货</td>
                      <td className="px-3 py-2 text-center font-bold">{stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.domestic}件</td>
                      <td className="px-3 py-2 text-center text-gray-400">—</td>
                      <td className="px-3 py-2 text-center text-gray-400">—</td>
                      <td className="px-3 py-2 text-center"><span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-[10px]">国内商城</span></td>
                    </tr>
                    <tr className="border-t border-indigo-100 bg-cyan-50/10">
                      <td className="px-3 py-2 text-center">🇷🇺 俄向销售</td>
                      <td className="px-3 py-2 text-center font-bold">{stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.overseas}件</td>
                      <td className="px-3 py-2 text-center">{stats.sprayAnalysis.packagingAnalysis.newProductEstDailyQty}件/天</td>
                      <td className="px-3 py-2 text-center font-bold">{stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.sellDays}天</td>
                      <td className="px-3 py-2 text-center">
                        {stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.sellDays > stats.sprayAnalysis.packagingAnalysis.productionDaysMax ? (
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">✅ 安全</span>
                        ) : (
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">⚠️ 不足</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-indigo-50 rounded-lg p-3 mb-4 border border-indigo-100">
                <h5 className="text-xs font-bold text-indigo-800 mb-2">📦 总量计算</h5>
                <div className="text-xs text-indigo-700 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded text-[10px] font-bold">50ml</span>
                    <span>💨{stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.hairDryer}件 + 🇨🇳{stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.domestic}件 + 🇷🇺{stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.overseas}件 = <b>{stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.total}件</b> × 50ml = <b>{(stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.total * 50).toLocaleString()}ml</b></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-bold">150ml</span>
                    <span>🇷🇺{stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.overseas}件 + 🇨🇳{stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.domestic}件 = <b>{stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.total}件</b> × 150ml = <b>{(stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.total * 150).toLocaleString()}ml</b></span>
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-indigo-200">
                    <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-bold">合计</span>
                    <span className="font-bold text-indigo-800">{stats.sprayAnalysis.packagingAnalysis.finalStock.totalStock}件 / {(stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.total * 50 + stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.total * 150).toLocaleString()}ml</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="bg-indigo-50 rounded-lg p-3 text-center border border-indigo-100">
                  <div className="text-[10px] text-morandi-text-light">总备货量</div>
                  <div className="text-xl font-bold text-indigo-700">{stats.sprayAnalysis.packagingAnalysis.finalStock.totalStock}</div>
                  <div className="text-[10px] text-indigo-600">件</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
                  <div className="text-[10px] text-morandi-text-light">综合预估日均</div>
                  <div className="text-xl font-bold text-blue-700">{stats.sprayAnalysis.packagingAnalysis.newProductEstDailyQty}</div>
                  <div className="text-[10px] text-blue-600">件/天</div>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center border border-red-100">
                  <div className="text-[10px] text-morandi-text-light">补货警戒线</div>
                  <div className="text-xl font-bold text-red-700">{stats.sprayAnalysis.packagingAnalysis.reorderPoint}</div>
                  <div className="text-[10px] text-red-600">件（{stats.sprayAnalysis.packagingAnalysis.productionDaysDisplay}用量）</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-100">
                  <div className="text-[10px] text-morandi-text-light">生产周期</div>
                  <div className="text-xl font-bold text-amber-700">{stats.sprayAnalysis.packagingAnalysis.productionDaysMin}</div>
                  <div className="text-[10px] text-amber-600">天</div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-indigo-50 to-cyan-50 rounded-lg p-4 border border-indigo-200">
                <h5 className="text-xs font-bold text-indigo-800 mb-2">📋 备货策略总结</h5>
                <div className="text-xs text-indigo-700 space-y-1.5 leading-relaxed">
                  <p>• <b>150ml正装</b>：{stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.total}件（🇷🇺俄向{stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.overseas}件 + 🇨🇳国内{stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.domestic}件），仅俄向{stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.overseas}件参与销量计算，可售{stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.sellDays}天（约{Math.round(stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.sellDays / 30)}个月）</p>
                  <p>• <b>50ml试用装</b>：{stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.total}件（💨吹风机赠品{stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.hairDryer}件 + 🇨🇳国内{stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.domestic}件 + 🇷🇺俄向{stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.overseas}件），仅俄向{stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.overseas}件参与销量计算，可售{stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.sellDays}天</p>
                  <p>• <b>补货时机</b>：库存降至<b>{stats.sprayAnalysis.packagingAnalysis.reorderPoint}件</b>时立即下单（覆盖{stats.sprayAnalysis.packagingAnalysis.productionDaysDisplay}生产期）</p>
                  <p>• <b>销量预估依据</b>：180天内喷雾新品TOP{stats.sprayAnalysis.packagingAnalysis.sprayNewProducts180Count}款日均×30% + TOP10单品日均×10%，综合取均值{stats.sprayAnalysis.packagingAnalysis.newProductEstDailyQty}件/天</p>
                  <p>• <b>容量策略</b>：150ml正装兼顾俄罗斯大容量偏好和国内标准规格，50ml试用装降低首次购买门槛并可搭配吹风机销售</p>
                </div>
              </div>
              </div>
            </div>
          )}

          <div className="border-t border-gray-100 pt-4">
            <h4 className="text-sm font-bold text-morandi-text mb-4 flex items-center gap-2">
              <span className="text-lg">🌿</span> 护发精油市场定位分析
            </h4>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg p-4 border border-emerald-100">
                <h5 className="text-xs font-bold text-emerald-800 mb-2">🌿 我方产品 · {stats.sprayAnalysis.ourSpray.positioning}</h5>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-morandi-text-light">规格</span><span className="font-bold">{stats.sprayAnalysis.ourSpray.skus.map(s => s.volume).join(' / ')}</span></div>
                  <div className="flex justify-between"><span className="text-morandi-text-light">定价</span><span className="font-bold text-emerald-700">₽{stats.sprayAnalysis.ourSpray.skus.map(s => s.ourPriceRUB).join(' / ₽')}</span></div>
                  <div className="flex justify-between"><span className="text-morandi-text-light">每100ml</span><span className="font-bold text-emerald-600">₽{stats.sprayAnalysis.ourSpray.skus.map(s => Math.round(s.ourPriceRUB / parseInt(s.volume) * 100)).join(' / ₽')}</span></div>
                  <div className="flex justify-between"><span className="text-morandi-text-light">采购成本</span><span className="font-bold">¥{stats.sprayAnalysis.ourSpray.skus.map(s => s.priceCNY).join(' / ¥')}</span></div>
                  <div className="flex justify-between"><span className="text-morandi-text-light">物流费</span><span className="font-bold">¥{stats.sprayAnalysis.ourSpray.skus.map(s => s.logistics).join(' / ¥')}</span></div>
                </div>
                <div className="mt-2 pt-2 border-t border-emerald-200">
                  <div className="text-[10px] text-emerald-700 font-bold mb-1">核心配方</div>
                  <div className="text-[10px] text-emerald-600 mb-1.5">{stats.sprayAnalysis.ourSpray.ingredients}</div>
                  <div className="text-[10px] text-emerald-700 space-y-0.5">
                    {stats.sprayAnalysis.ourSpray.features.map((f, i) => (
                      <div key={i}>✓ {f}</div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 border border-red-200">
                <h5 className="text-xs font-bold text-red-700 mb-2">🔴 5款竞品速览</h5>
                <div className="space-y-1.5 text-xs">
                  {stats.sprayAnalysis.competitorsSpray.map(c => (
                    <div key={c.id} className="flex justify-between items-center border-b border-gray-50 pb-1">
                      <span className="font-bold text-red-600">{c.brand}</span>
                      <span className="text-[10px]">{c.volume} / <b>₽{c.priceRUB}</b> / ₽{c.volume === '50ml' ? (c.priceRUB / 50 * 100).toFixed(0) : c.priceRUB}/100ml</span>
                      <span className="text-[10px] text-morandi-text-light">{c.positioning}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-red-200">
                  <div className="text-[10px] text-red-600 space-y-0.5">
                    <div>📌 主流价格带：<b>₽320-500/100ml</b></div>
                    <div>📌 全部为<b>硅油主导派</b>，植物油仅做卖点包装</div>
                    <div>📌 竞品2和5几乎同配方不同品牌，同质化极高</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-white rounded-lg p-3 border border-green-100">
                <h5 className="text-xs font-bold text-green-700 mb-2">💰 三规格利润测算</h5>
                {stats.sprayAnalysis.profitBySku.map((sku, i) => (
                  <div key={i} className="space-y-1 text-xs border-b border-gray-100 pb-2 mb-2 last:border-0 last:pb-0 last:mb-0">
                    <div className="text-[10px] font-bold text-blue-600">{sku.label} {sku.volume} · ₽{sku.ourPriceRUB}</div>
                    <div className="flex justify-between"><span>售价</span><span className="font-bold">₽{sku.ourPriceRUB} ≈ ¥{(sku.ourPriceRUB * R).toFixed(1)}</span></div>
                    <div className="flex justify-between"><span>采购+物流</span><span className="text-red-500">-¥{sku.priceCNY} -¥{sku.logistics}</span></div>
                    <div className="flex justify-between"><span>平台运营费(26%)</span><span className="text-red-500">-₽{Math.round(sku.ourPriceRUB * 0.26)} ≈ -¥{(sku.ourPriceRUB * 0.26 * R).toFixed(1)}</span></div>
                    <div className="border-t border-gray-100 pt-1 flex justify-between font-bold"><span>净利润/单</span><span className={sku.standard.profit >= 0 ? 'text-green-600' : 'text-red-600'}>¥{sku.standard.profit.toFixed(2)}（{sku.standard.rate.toFixed(1)}%）</span></div>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-lg p-3 border border-blue-100">
                <h5 className="text-xs font-bold text-blue-700 mb-2">🚚 物流时效利润对比</h5>
                <table className="w-full text-xs">
                  <thead><tr className="bg-blue-50"><th className="px-2 py-1 text-left">规格</th><th className="px-2 py-1 text-center">🚀 特快<br/><span className="text-[9px] font-normal">5-10天</span></th><th className="px-2 py-1 text-center">📦 标准<br/><span className="text-[9px] font-normal">10-15天</span></th><th className="px-2 py-1 text-center">🚛 经济<br/><span className="text-[9px] font-normal">15-25天</span></th></tr></thead>
                  <tbody>
                    {stats.sprayAnalysis.profitBySku.map((sku, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-2 py-1.5 font-bold">{sku.label}<br/><span className="text-[9px] font-normal text-gray-500">₽{sku.ourPriceRUB}</span></td>
                        <td className="px-2 py-1.5 text-center"><div className={sku.express.profit >= 0 ? 'text-green-600' : 'text-red-600'}>¥{sku.express.profit.toFixed(1)}</div><div className="text-[9px] text-gray-500">{sku.express.rate.toFixed(1)}%</div><div className="text-[9px] text-red-400">运费¥{sku.logistics + 5}</div></td>
                        <td className="px-2 py-1.5 text-center bg-blue-50/50"><div className={sku.standard.profit >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>¥{sku.standard.profit.toFixed(1)}</div><div className="text-[9px] text-gray-500">{sku.standard.rate.toFixed(1)}%</div><div className="text-[9px] text-gray-400">运费¥{sku.logistics}</div></td>
                        <td className="px-2 py-1.5 text-center"><div className={sku.economy.profit >= 0 ? 'text-green-600' : 'text-red-600'}>¥{sku.economy.profit.toFixed(1)}</div><div className="text-[9px] text-gray-500">{sku.economy.rate.toFixed(1)}%</div><div className="text-[9px] text-green-400">运费¥{Math.max(0, sku.logistics - 5)}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-2 text-[10px] text-blue-600 space-y-0.5">
                  <div>💡 特快运费+¥5，适合急需补货/新品冷启动快速到仓</div>
                  <div>💡 标准运费为当前基准，平衡时效与成本</div>
                  <div>💡 经济运费-¥5，适合稳定期大批量补货</div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-3 border border-purple-100">
                <h5 className="text-xs font-bold text-purple-700 mb-2">🎯 竞争定位分析</h5>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-start gap-1.5"><span className="text-green-500 mt-0.5">✓</span><span><b>轻盈不塌</b>：异十二烷+异链烷烃超轻基底，vs 竞品矿物油/厚硅油易油腻</span></div>
                  <div className="flex items-start gap-1.5"><span className="text-green-500 mt-0.5">✓</span><span><b>无矿物油/无色粉</b>：更干净配方，攻击竞品2/5含矿物油+CI色粉</span></div>
                  <div className="flex items-start gap-1.5"><span className="text-green-500 mt-0.5">✓</span><span><b>山茶花提取物</b>：天然修护+抗氧化，竞品普遍缺功能型活性物</span></div>
                  <div className="flex items-start gap-1.5"><span className="text-green-500 mt-0.5">✓</span><span><b>维E防热损伤</b>：吹风/夹发前保护，竞品多数无此功能</span></div>
                  <div className="flex items-start gap-1.5"><span className="text-green-500 mt-0.5">✓</span><span><b>细软发友好</b>：轻盈质地不压塌，对抗竞品1的厚重油腻</span></div>
                  <div className="flex items-start gap-1.5"><span className="text-amber-500 mt-0.5">⚠</span><span><b>即时顺滑感</b>：硅油型竞品"一喷就顺"更明显，我方偏"越用越顺"</span></div>
                  <div className="flex items-start gap-1.5"><span className="text-amber-500 mt-0.5">⚠</span><span><b>光泽感</b>：竞品3的Phenyl Trimethicone反光最强，我方需靠维E+植物油叙事</span></div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-6 mt-6">
            <h4 className="text-base font-bold text-morandi-text mb-5 flex items-center gap-2">
              <span className="text-xl">🧪</span> 竞品成分深度对比分析
            </h4>

            <h5 className="text-sm font-semibold text-morandi-text mb-3">一、竞品基础信息对比（价格/容量/单位成本）</h5>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-xs border border-gray-200 rounded">
                <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left">产品</th><th className="px-3 py-2 text-center">容量</th><th className="px-3 py-2 text-right">售价(₽)</th><th className="px-3 py-2 text-right">₽/100ml</th><th className="px-3 py-2 text-left">价格定位</th></tr></thead>
                <tbody>
                  <tr className="border-t border-gray-100 bg-emerald-50/30"><td className="px-3 py-2 font-bold text-emerald-700">🌿 我方</td><td className="px-3 py-2 text-center">{stats.sprayAnalysis.ourSpray.skus.map(s => s.volume).join('/')}</td><td className="px-3 py-2 text-right font-bold text-emerald-700">{stats.sprayAnalysis.ourSpray.skus.map(s => s.ourPriceRUB).join('-')}</td><td className="px-3 py-2 text-right font-bold text-emerald-700">{stats.sprayAnalysis.ourSpray.skus.map(s => Math.round(s.ourPriceRUB / parseInt(s.volume) * 100)).join('-')}</td><td className="px-3 py-2"><span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[10px]">轻盈高端·中高价位</span></td></tr>
                  {stats.sprayAnalysis.competitorsSpray.map(c => (
                    <tr key={c.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-bold text-red-600">{c.brand}</td>
                      <td className="px-3 py-2 text-center">{c.volume}</td>
                      <td className="px-3 py-2 text-right font-medium">{c.priceRUB}</td>
                      <td className="px-3 py-2 text-right font-bold">{c.volume === '50ml' ? (c.priceRUB / 50 * 100).toFixed(0) : c.priceRUB}</td>
                      <td className="px-3 py-2"><span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">{c.positioning}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-[10px] text-morandi-text-light mt-1.5">📌 俄罗斯护发精油主流价格带：₽320-500/100ml，我方₽{stats.sprayAnalysis.ourSpray.skus.map(s => Math.round(s.ourPriceRUB / parseInt(s.volume) * 100)).join('-')}/100ml处于中高段</div>
            </div>

            <h5 className="text-sm font-semibold text-morandi-text mb-3">二、核心配方结构对比</h5>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-xs border border-gray-200 rounded">
                <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left">模块</th><th className="px-3 py-2 text-left bg-emerald-50">🌿 我方</th><th className="px-3 py-2 text-left bg-red-50">🔴 竞品1</th><th className="px-3 py-2 text-left bg-red-50">🔴 竞品2</th><th className="px-3 py-2 text-left bg-red-50">🔴 竞品3</th><th className="px-3 py-2 text-left bg-red-50">🔴 竞品4</th><th className="px-3 py-2 text-left bg-red-50">🔴 竞品5</th></tr></thead>
                <tbody>
                  <tr className="border-t border-gray-100"><td className="px-3 py-2 font-bold">基底</td><td className="px-3 py-2 bg-emerald-50/30">异十二烷+C13-14异链烷烃</td><td className="px-3 py-2 bg-red-50/30">环戊硅氧烷(D5)</td><td className="px-3 py-2 bg-red-50/30">Cyclomethicone+D5</td><td className="px-3 py-2 bg-red-50/30">环戊硅氧烷(D5)</td><td className="px-3 py-2 bg-red-50/30">D5+D6</td><td className="px-3 py-2 bg-red-50/30">Cyclomethicone+D5</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-3 py-2 font-bold">硅油体系</td><td className="px-3 py-2 bg-emerald-50/30">聚二甲基硅氧烷醇</td><td className="px-3 py-2 bg-red-50/30">Dimethiconol+Amodimethicone</td><td className="px-3 py-2 bg-red-50/30">Dimethicone(厚)</td><td className="px-3 py-2 bg-red-50/30">Dimethiconol+Phenyl Trimethicone</td><td className="px-3 py-2 bg-red-50/30">Dimethiconol</td><td className="px-3 py-2 bg-red-50/30">Dimethicone(厚)</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-3 py-2 font-bold">植物油</td><td className="px-3 py-2 bg-emerald-50/30">山茶花+霍霍巴+橄榄油</td><td className="px-3 py-2 bg-red-50/30">乳木果+夏威夷果</td><td className="px-3 py-2 bg-red-50/30">Argan+Jojoba+Macadamia</td><td className="px-3 py-2 bg-red-50/30">7种植物油+角鲨烷</td><td className="px-3 py-2 bg-red-50/30">夏威夷果+牛油果+甜杏仁</td><td className="px-3 py-2 bg-red-50/30">Argan+Jojoba+Macadamia</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-3 py-2 font-bold">矿物油</td><td className="px-3 py-2 bg-green-50/50 text-green-700">❌ 无 ✅</td><td className="px-3 py-2 bg-red-50/30 text-red-600">✅ 有</td><td className="px-3 py-2 bg-red-50/30 text-red-600">✅ 有</td><td className="px-3 py-2 bg-green-50/50 text-green-700">❌ 无</td><td className="px-3 py-2 bg-green-50/50 text-green-700">❌ 无</td><td className="px-3 py-2 bg-red-50/30 text-red-600">✅ 有</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-3 py-2 font-bold">色粉</td><td className="px-3 py-2 bg-green-50/50 text-green-700">❌ 无 ✅</td><td className="px-3 py-2 bg-green-50/50 text-green-700">❌ 无</td><td className="px-3 py-2 bg-red-50/30 text-red-600">CI47000/CI26100</td><td className="px-3 py-2 bg-green-50/50 text-green-700">❌ 无</td><td className="px-3 py-2 bg-green-50/50 text-green-700">❌ 无</td><td className="px-3 py-2 bg-red-50/30 text-red-600">CI47000/CI26100</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-3 py-2 font-bold">功能活性物</td><td className="px-3 py-2 bg-emerald-50/30">山茶花提取物+维E</td><td className="px-3 py-2 bg-red-50/30">无</td><td className="px-3 py-2 bg-red-50/30">无</td><td className="px-3 py-2 bg-red-50/30">Bisabolol+3种提取物</td><td className="px-3 py-2 bg-red-50/30">BHT(抗氧化)</td><td className="px-3 py-2 bg-red-50/30">无</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-3 py-2 font-bold">香精过敏原</td><td className="px-3 py-2 bg-green-50/50 text-green-700">仅日用香精</td><td className="px-3 py-2 bg-red-50/30 text-red-600">柠檬烯/芳樟醇/香豆素</td><td className="px-3 py-2 bg-red-50/30 text-red-600">含Fragrance</td><td className="px-3 py-2 bg-red-50/30 text-red-600">含香水成分</td><td className="px-3 py-2 bg-red-50/30 text-red-600">己基肉桂醛/柠檬烯/香豆素</td><td className="px-3 py-2 bg-red-50/30 text-red-600">含Fragrance</td></tr>
                </tbody>
              </table>
            </div>

            <h5 className="text-sm font-semibold text-morandi-text mb-3">三、逐个竞品功效推断 + 优缺点</h5>
            <div className="space-y-3 mb-6">
              {stats.sprayAnalysis.competitorsSpray.map(c => (
                <div key={c.id} className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <h6 className="text-sm font-bold text-red-700">🔴 {c.brand}（{c.volume} / ₽{c.priceRUB}）</h6>
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{c.positioning}</span>
                  </div>
                  <div className="text-[10px] text-morandi-text-light mb-2">核心成分：{c.ingredients}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] font-bold text-green-700 mb-1">✅ 优点</div>
                      <div className="text-[10px] text-green-700 space-y-0.5">
                        {c.strengths.map((s, i) => <div key={i}>• {s}</div>)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-red-700 mb-1">❌ 缺点/风险</div>
                      <div className="text-[10px] text-red-700 space-y-0.5">
                        {c.risks.map((r, i) => <div key={i}>• {r}</div>)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <h5 className="text-sm font-semibold text-morandi-text mb-3">四、功效强度排名（消费者感知）</h5>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h6 className="text-sm font-bold text-amber-700 mb-3">✨ 光泽感（亮/反光）</h6>
                <div className="space-y-2">
                  {[{name: '竞品3', val: 5}, {name: '竞品4', val: 4}, {name: '🌿我方', val: 4, isOurs: true}, {name: '竞品2', val: 3}, {name: '竞品5', val: 3}, {name: '竞品1', val: 3}].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className={`text-[10px] w-14 ${item.isOurs ? 'font-bold text-emerald-700' : 'text-gray-600'}`}>{item.name}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-3"><div className={`h-3 rounded-full ${item.isOurs ? 'bg-emerald-400' : 'bg-amber-300'}`} style={{width: `${item.val * 20}%`}}></div></div>
                      <span className="text-[10px] text-gray-500">{item.val}/5</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h6 className="text-sm font-bold text-blue-700 mb-3">🌊 顺滑/柔顺（立刻好梳）</h6>
                <div className="space-y-2">
                  {[{name: '竞品1', val: 5}, {name: '竞品4', val: 5}, {name: '🌿我方', val: 4, isOurs: true}, {name: '竞品2', val: 4}, {name: '竞品3', val: 4}, {name: '竞品5', val: 4}].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className={`text-[10px] w-14 ${item.isOurs ? 'font-bold text-emerald-700' : 'text-gray-600'}`}>{item.name}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-3"><div className={`h-3 rounded-full ${item.isOurs ? 'bg-emerald-400' : 'bg-blue-300'}`} style={{width: `${item.val * 20}%`}}></div></div>
                      <span className="text-[10px] text-gray-500">{item.val}/5</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h6 className="text-sm font-bold text-purple-700 mb-3">💧 厚重滋润（干枯粗硬发）</h6>
                <div className="space-y-2">
                  {[{name: '竞品1', val: 5}, {name: '竞品2', val: 3}, {name: '竞品5', val: 3}, {name: '🌿我方', val: 3, isOurs: true}, {name: '竞品4', val: 2}, {name: '竞品3', val: 2}].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className={`text-[10px] w-14 ${item.isOurs ? 'font-bold text-emerald-700' : 'text-gray-600'}`}>{item.name}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-3"><div className={`h-3 rounded-full ${item.isOurs ? 'bg-emerald-400' : 'bg-purple-300'}`} style={{width: `${item.val * 20}%`}}></div></div>
                      <span className="text-[10px] text-gray-500">{item.val}/5</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h6 className="text-sm font-bold text-emerald-700 mb-3">🍃 轻盈不油腻（细软发）✅我方最强</h6>
                <div className="space-y-2">
                  {[{name: '🌿我方', val: 5, isOurs: true}, {name: '竞品4', val: 5}, {name: '竞品3', val: 4}, {name: '竞品2', val: 2}, {name: '竞品5', val: 2}, {name: '竞品1', val: 1}].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className={`text-[10px] w-14 ${item.isOurs ? 'font-bold text-emerald-700' : 'text-gray-600'}`}>{item.name}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-3"><div className={`h-3 rounded-full ${item.isOurs ? 'bg-emerald-400' : 'bg-teal-300'}`} style={{width: `${item.val * 20}%`}}></div></div>
                      <span className="text-[10px] text-gray-500">{item.val}/5</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <h5 className="text-sm font-semibold text-morandi-text mb-3">五、成分风险点对比（合规/投诉角度）</h5>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-xs border border-gray-200 rounded">
                <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left">风险点</th><th className="px-3 py-2 text-center">涉及竞品</th><th className="px-3 py-2 text-left">风险说明</th></tr></thead>
                <tbody>
                  <tr className="border-t border-gray-100"><td className="px-3 py-2 font-bold text-red-600">香精过敏原</td><td className="px-3 py-2 text-center">竞品1、4</td><td className="px-3 py-2">柠檬烯/芳樟醇/香豆素等，易被敏感用户差评</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-3 py-2 font-bold text-amber-600">矿物油</td><td className="px-3 py-2 text-center">竞品1、2、5</td><td className="px-3 py-2">合规无问题，但高端感降低，高端价位易被挑刺</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-3 py-2 font-bold text-amber-600">色粉CI47000/CI26100</td><td className="px-3 py-2 text-center">竞品2、5</td><td className="px-3 py-2">部分消费者认为"染色添加剂多"</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-3 py-2 font-bold text-amber-600">BHT争议成分</td><td className="px-3 py-2 text-center">竞品4</td><td className="px-3 py-2">合规但存在争议心智，部分消费者抵触</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-3 py-2 font-bold text-amber-600">成分过于复杂</td><td className="px-3 py-2 text-center">竞品3</td><td className="px-3 py-2">提取物多，供应链文件和稳定性风险上升</td></tr>
                </tbody>
              </table>
              <div className="text-[10px] text-morandi-text-light mt-1.5">📌 真正容易引发投诉的是<b>香精致敏</b>和<b>油腻塌发</b>，我方配方均无此风险</div>
            </div>

            <h5 className="text-sm font-semibold text-morandi-text mb-3">六、市场格局结论</h5>
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-4 border border-amber-200 mb-6">
              <div className="text-sm text-amber-800 space-y-2 leading-relaxed">
                <p>• <b>市场主流是硅油体系</b>，不是纯植物油。核心竞争点：顺滑感、光泽感、香味、是否塌发。植物油更多是"卖点包装"</p>
                <p>• <b>价格带非常集中</b>：₽320-400走量款 / ₽480-520高端溢价款，我方₽{stats.sprayAnalysis.ourSpray.skus[0].ourPriceRUB}-{stats.sprayAnalysis.ourSpray.skus[2].ourPriceRUB}覆盖引流到高端全价格段</p>
                <p>• <b>配方同质化极高</b>：竞品2和5几乎同配方不同品牌。想赢不靠配方微调，必须靠<b>香型差异化 + 使用体验(轻盈/不塌) + 文案与功效定位 + 包装高级感</b></p>
              </div>
            </div>

            <h5 className="text-sm font-semibold text-morandi-text mb-3">七、Ozon差异化攻击点（详情页/卖点文案）</h5>
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg p-4 border border-emerald-100 mb-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-sm font-bold text-emerald-800 mb-2">🇷🇺 俄文卖点关键词</div>
                  <div className="space-y-1.5 text-xs text-emerald-700 leading-relaxed">
                    <div>• <b>Не утяжеляет волосы</b> — 不压塌头发（轻盈路线）</div>
                    <div>• <b>Без минерального масла</b> — 不含矿物油</div>
                    <div>• <b>Без красителей</b> — 不含色素</div>
                    <div>• <b>Легкая текстура</b> — 轻盈质地</div>
                    <div>• <b>Термозащита</b> — 防热损伤</div>
                    <div>• <b>Масло камелии</b> — 山茶花油</div>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-bold text-teal-800 mb-2">🎯 竞品无法反击的差异化</div>
                  <div className="space-y-1.5 text-xs text-teal-700 leading-relaxed">
                    <div>✅ 无矿物油 → 竞品1/2/5含矿物油</div>
                    <div>✅ 无色粉 → 竞品2/5含CI47000/CI26100</div>
                    <div>✅ 轻盈不塌发 → 竞品1厚重油腻</div>
                    <div>✅ 山茶花提取物 → 竞品普遍缺功能型活性物</div>
                    <div>✅ 维E防热损伤 → 竞品多数无此功能</div>
                    <div>✅ 细软发友好 → 对抗所有厚重型竞品</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-emerald-50 rounded-lg p-4">
              <h5 className="text-sm font-bold text-emerald-800 mb-3">💡 护发精油上市建议</h5>
              <div className="text-sm text-emerald-700 space-y-2 leading-relaxed">
                <p>• <b>定价策略</b>：{stats.sprayAnalysis.ourSpray.skus[0].volume}₽{stats.sprayAnalysis.ourSpray.skus[0].ourPriceRUB}引流→{stats.sprayAnalysis.ourSpray.skus[1].volume}₽{stats.sprayAnalysis.ourSpray.skus[1].ourPriceRUB}主力→{stats.sprayAnalysis.ourSpray.skus[2].volume}₽{stats.sprayAnalysis.ourSpray.skus[2].ourPriceRUB}大容量溢价，三规格覆盖全价格段，突出"轻盈高端·无矿物油"</p>
                <p>• <b>成本优势</b>：采购¥{stats.sprayAnalysis.ourSpray.skus[0].priceCNY}-{stats.sprayAnalysis.ourSpray.skus[2].priceCNY}+物流¥{stats.sprayAnalysis.ourSpray.skus[0].logistics}-{stats.sprayAnalysis.ourSpray.skus[2].logistics}，三规格净利率{stats.sprayAnalysis.profitBySku.map(s => s.standard.rate.toFixed(1)).join('% / ')}%（陆空标准）</p>
                <p>• <b>定位包装</b>："轻盈不塌、无矿物油/无色素、山茶花修护、防热损伤"，区别于竞品"厚重油腻、矿物油+色粉"</p>
                <p>• <b>目标客群</b>：细软发/染烫受损/追求干净成分女性（高复购），竞品1适合粗硬干枯发</p>
                <p>• <b>标题关键词</b>："масло для волос"（护发精油）、"без минерального масла"（无矿物油）、"термозащита"（防热损伤）、"лёгкое"（轻盈）、"50мл/100мл/150мл"</p>
                <p>• <b>季节策略</b>：全年可售，夏季防热损伤（吹风/日晒）、冬季防干燥，搭配发膜做套装促销</p>
                <p>• <b>一句话总结</b>：俄罗斯护发精油竞品普遍以硅油体系为主，功效集中在顺滑与光泽；低价款通过"成分表豪华化"制造高端感，高价款通过香型与包装溢价。我方最有效的差异化方向是<b>"轻盈不塌 + 不含矿物油/色素 + 高端修护叙事"</b></p>
              </div>
            </div>
          </div>
        </div>
    </>
  )
}
