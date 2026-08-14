import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { R } from '../dictionary'

export default function HairMaskSection({ stats, data }) {
  return (
    <>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-morandi-text mb-4 flex items-center gap-2">
            <span className="text-2xl">💇‍♀️</span> 发膜专项分析 · 规格与价格
          </h3>

          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="bg-pink-50 rounded-lg p-3 text-center">
              <div className="text-xs text-morandi-text-light">发膜产品数</div>
              <div className="text-2xl font-bold text-pink-700">{stats.hairMaskAnalysis.totalProducts}</div>
            </div>
            <div className="bg-violet-50 rounded-lg p-3 text-center">
              <div className="text-xs text-morandi-text-light">总销量</div>
              <div className="text-2xl font-bold text-violet-700">{stats.hairMaskAnalysis.totalQty.toLocaleString()}</div>
            </div>
            <div className="bg-rose-50 rounded-lg p-3 text-center">
              <div className="text-xs text-morandi-text-light">300g规格均价</div>
              <div className="text-2xl font-bold text-rose-700">₽{stats.hairMaskAnalysis.mask300gAvgPrice}</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <div className="text-xs text-morandi-text-light">竞品对标价</div>
              <div className="text-2xl font-bold text-red-700">₽{stats.hairMaskAnalysis.competitorMask.priceRUB}<span className="text-xs font-normal">/{stats.hairMaskAnalysis.competitorMask.weight}</span></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3">📦 规格分布（按销量）</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.hairMaskAnalysis.weightData.slice(0, 10)} layout="vertical" margin={{ left: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={50} />
                  <Tooltip formatter={(v, name) => name === '销量' ? [v.toLocaleString(), name] : [`₽${v}`, name]} />
                  <Bar dataKey="qty" fill="#D4A0B0" name="销量" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3">💰 规格价格区间</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.hairMaskAnalysis.priceByWeightData} margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => [`₽${v}`, '']} />
                  <Bar dataKey="minPrice" fill="#E8D5C4" name="最低价" />
                  <Bar dataKey="avgPrice" fill="#D4A0B0" name="均价" />
                  <Bar dataKey="maxPrice" fill="#C3B4D1" name="最高价" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3">✨ 功效分布（按销量）</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.hairMaskAnalysis.effectData.slice(0, 10)} layout="vertical" margin={{ left: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={50} />
                  <Tooltip formatter={(v, name) => name === '销量' ? [v.toLocaleString(), name] : [v, name]} />
                  <Bar dataKey="qty" fill="#C3B4D1" name="销量" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3">🎯 适用发质分布（按销量）</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.hairMaskAnalysis.hairTypeData.slice(0, 8)} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={40} />
                  <Tooltip formatter={(v, name) => name === '销量' ? [v.toLocaleString(), name] : [v, name]} />
                  <Bar dataKey="qty" fill="#B4BEC9" name="销量" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <h4 className="text-sm font-semibold text-morandi-text mb-3">🏆 TOP10热销发膜</h4>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-xs">
              <thead><tr className="bg-gray-50"><th className="px-2 py-2 text-left">排名</th><th className="px-2 py-2 text-left">商品名称</th><th className="px-2 py-2 text-center">规格</th><th className="px-2 py-2 text-center">功效</th><th className="px-2 py-2 text-center">适用发质</th><th className="px-2 py-2 text-right">单价(₽)</th><th className="px-2 py-2 text-right">每100ml/g(₽)</th><th className="px-2 py-2 text-right">销量</th></tr></thead>
              <tbody>
                {stats.hairMaskAnalysis.top10Products.map((p, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-2 py-2 font-bold text-morandi-text">{i + 1}</td>
                    <td className="px-2 py-2 max-w-[200px] truncate" title={p.name}>{p.name}</td>
                    <td className="px-2 py-2 text-center"><span className="bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded text-[10px]">{p._weight || '-'}</span></td>
                    <td className="px-2 py-2 text-center"><span className="bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded text-[10px]">{p._effects || '-'}</span></td>
                    <td className="px-2 py-2 text-center"><span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px]">{p._hairTypes || '-'}</span></td>
                    <td className="px-2 py-2 text-right font-medium">₽{Math.round(p.price).toLocaleString()}</td>
                    <td className="px-2 py-2 text-right">{p._pricePer100ml ? <span className="text-indigo-600">₽{p._pricePer100ml}</span> : <span className="text-gray-300">-</span>}</td>
                    <td className="px-2 py-2 text-right font-bold">{(p.qty || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h4 className="text-sm font-bold text-morandi-text mb-4 flex items-center gap-2">
              <span className="text-lg">🐟</span> 鱼子酱发膜市场定位分析
            </h4>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-gradient-to-br from-amber-50 to-pink-50 rounded-lg p-4 border border-amber-100">
                <h5 className="text-xs font-bold text-amber-800 mb-2">🐟 我方产品 · {stats.hairMaskAnalysis.ourMask.positioning}</h5>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-morandi-text-light">规格</span><span className="font-bold">{stats.hairMaskAnalysis.ourMask.weight}</span></div>
                  <div className="flex justify-between"><span className="text-morandi-text-light">定价</span><span className="font-bold text-blue-700">₽{stats.hairMaskAnalysis.ourMask.ourPriceRUB} ≈ ¥{(stats.hairMaskAnalysis.ourMask.ourPriceRUB * R).toFixed(1)}</span></div>
                  <div className="flex justify-between"><span className="text-morandi-text-light">采购成本</span><span className="font-bold">¥{stats.hairMaskAnalysis.ourMask.priceCNY}</span></div>
                  <div className="flex justify-between"><span className="text-morandi-text-light">物流费</span><span className="font-bold">¥{stats.hairMaskAnalysis.ourMask.logistics}</span></div>
                  <div className="flex justify-between"><span className="text-morandi-text-light">每100g</span><span className="font-bold text-blue-600">₽{(stats.hairMaskAnalysis.ourMask.ourPriceRUB / 300 * 100).toFixed(1)}</span></div>
                </div>
                <div className="mt-2 pt-2 border-t border-amber-200">
                  <div className="text-[10px] text-amber-700 space-y-0.5">
                    {stats.hairMaskAnalysis.ourMask.features.map((f, i) => (
                      <div key={i}>✓ {f}</div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 border border-red-200">
                <h5 className="text-xs font-bold text-red-700 mb-2">🔴 竞品 · 粉色鱼子酱发膜</h5>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-morandi-text-light">规格</span><span className="font-bold">{stats.hairMaskAnalysis.competitorMask.weight}</span></div>
                  <div className="flex justify-between"><span className="text-morandi-text-light">售价</span><span className="font-bold text-red-600">₽{stats.hairMaskAnalysis.competitorMask.priceRUB} ≈ ¥{(stats.hairMaskAnalysis.competitorMask.priceRUB * R).toFixed(1)}</span></div>
                  <div className="flex justify-between"><span className="text-morandi-text-light">每100g</span><span className="font-bold text-red-600">₽{(stats.hairMaskAnalysis.competitorMask.priceRUB / 350 * 100).toFixed(1)}</span></div>
                  <div className="flex justify-between"><span className="text-morandi-text-light">定位</span><span className="text-[10px] font-bold text-red-600">重修护·厚膜·强顺滑·沙龙老派</span></div>
                  <div className="flex justify-between"><span className="text-morandi-text-light">适合发质</span><span className="text-[10px]">粗硬发/干枯炸毛发</span></div>
                  <div className="flex justify-between"><span className="text-morandi-text-light">核心短板</span><span className="text-[10px] text-red-600">含DMDM甲醛释放体+Parabens</span></div>
                </div>
                <div className="mt-2 pt-2 border-t border-red-200">
                  <div className="text-[10px] text-red-600 space-y-0.5">
                    <div>❌ DMDM Hydantoin（甲醛释放体）</div>
                    <div>❌ Methylparaben / Propylparaben（防腐酯）</div>
                    <div>⚠️ 易塌发/油腻/头皮负担大</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-white rounded-lg p-3 border border-green-100">
                <h5 className="text-xs font-bold text-green-700 mb-2">💰 利润测算</h5>
                <div className="space-y-1 text-xs border-b border-gray-100 pb-2 mb-2">
                  <div className="text-[10px] font-bold text-blue-600">方案A：竞品对标价₽{stats.hairMaskAnalysis.competitorMask.priceRUB}</div>
                  <div className="flex justify-between"><span>售价</span><span className="font-bold">₽{stats.hairMaskAnalysis.competitorMask.priceRUB} ≈ ¥{(stats.hairMaskAnalysis.competitorMask.priceRUB * R).toFixed(1)}</span></div>
                  <div className="flex justify-between"><span>采购+物流</span><span className="text-red-500">-¥{stats.hairMaskAnalysis.ourMask.priceCNY} -¥{stats.hairMaskAnalysis.ourMask.logistics}</span></div>
                  <div className="flex justify-between"><span>平台运营费(26%)</span><span className="text-red-500">-₽{Math.round(stats.hairMaskAnalysis.competitorMask.priceRUB * 0.26)} ≈ -¥{(stats.hairMaskAnalysis.competitorMask.priceRUB * 0.26 * R).toFixed(1)}</span></div>
                  <div className="border-t border-gray-100 pt-1 flex justify-between font-bold"><span>净利润/单</span><span className={stats.hairMaskAnalysis.profitAtCompetitor.profit >= 0 ? 'text-green-600' : 'text-red-600'}>¥{stats.hairMaskAnalysis.profitAtCompetitor.profit.toFixed(2)}（{stats.hairMaskAnalysis.profitAtCompetitor.rate.toFixed(1)}%）</span></div>
                </div>
                <div className="space-y-1 text-xs border-b border-gray-100 pb-2 mb-2">
                  <div className="text-[10px] font-bold text-green-600">方案B：我方定价₽{stats.hairMaskAnalysis.ourMask.ourPriceRUB}（溢价{Math.round((stats.hairMaskAnalysis.ourMask.ourPriceRUB / stats.hairMaskAnalysis.competitorMask.priceRUB - 1) * 100)}%，突出温和高端）</div>
                  <div className="flex justify-between"><span>售价</span><span className="font-bold">₽{stats.hairMaskAnalysis.ourMask.ourPriceRUB} ≈ ¥{(stats.hairMaskAnalysis.ourMask.ourPriceRUB * R).toFixed(1)}</span></div>
                  <div className="flex justify-between"><span>采购+物流</span><span className="text-red-500">-¥{stats.hairMaskAnalysis.ourMask.priceCNY} -¥{stats.hairMaskAnalysis.ourMask.logistics}</span></div>
                  <div className="flex justify-between"><span>平台运营费(26%)</span><span className="text-red-500">-₽{Math.round(stats.hairMaskAnalysis.ourMask.ourPriceRUB * 0.26)} ≈ -¥{(stats.hairMaskAnalysis.ourMask.ourPriceRUB * 0.26 * R).toFixed(1)}</span></div>
                  <div className="border-t border-gray-100 pt-1 flex justify-between font-bold"><span>净利润/单</span><span className={stats.hairMaskAnalysis.profitAtOurPrice.profit >= 0 ? 'text-green-600' : 'text-red-600'}>¥{stats.hairMaskAnalysis.profitAtOurPrice.profit.toFixed(2)}（{stats.hairMaskAnalysis.profitAtOurPrice.rate.toFixed(1)}%）</span></div>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="text-[10px] font-bold text-gray-500">按300g规格均价 ₽{stats.hairMaskAnalysis.mask300gAvgPrice}</div>
                  <div className="flex justify-between"><span>售价</span><span className="font-bold">₽{stats.hairMaskAnalysis.mask300gAvgPrice} ≈ ¥{(stats.hairMaskAnalysis.mask300gAvgPrice * R).toFixed(1)}</span></div>
                  <div className="flex justify-between"><span>采购+物流</span><span className="text-red-500">-¥{stats.hairMaskAnalysis.ourMask.priceCNY} -¥{stats.hairMaskAnalysis.ourMask.logistics}</span></div>
                  <div className="flex justify-between"><span>平台运营费(26%)</span><span className="text-red-500">-₽{Math.round(stats.hairMaskAnalysis.mask300gAvgPrice * 0.26)} ≈ -¥{(stats.hairMaskAnalysis.mask300gAvgPrice * 0.26 * R).toFixed(1)}</span></div>
                  <div className="border-t border-gray-100 pt-1 flex justify-between font-bold"><span>净利润/单</span><span className={stats.hairMaskAnalysis.profitAt300gAvg.profit >= 0 ? 'text-green-600' : 'text-red-600'}>¥{stats.hairMaskAnalysis.profitAt300gAvg.profit.toFixed(2)}（{stats.hairMaskAnalysis.profitAt300gAvg.rate.toFixed(1)}%）</span></div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-3 border border-purple-100">
                <h5 className="text-xs font-bold text-purple-700 mb-2">🎯 竞争定位分析</h5>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-start gap-1.5"><span className="text-green-500 mt-0.5">✓</span><span><b>温和低敏</b>：无Parabens/无甲醛释放体，竞品致命短板</span></div>
                  <div className="flex items-start gap-1.5"><span className="text-green-500 mt-0.5">✓</span><span><b>轻盈不塌</b>：D5挥发型硅油+硅弹性体，细软发友好</span></div>
                  <div className="flex items-start gap-1.5"><span className="text-green-500 mt-0.5">✓</span><span><b>深层修护</b>：阳离子水解小麦蛋白+BTMS，受损修护逻辑更完整</span></div>
                  <div className="flex items-start gap-1.5"><span className="text-green-500 mt-0.5">✓</span><span><b>出口合规</b>：现代防腐体系，EAC认证更顺畅</span></div>
                  <div className="flex items-start gap-1.5"><span className="text-amber-500 mt-0.5">⚠</span><span><b>极致顺滑感</b>：竞品厚膜型配方"一洗就顺"更猛，我方更偏轻盈高级感</span></div>
                  <div className="flex items-start gap-1.5"><span className="text-amber-500 mt-0.5">⚠</span><span><b>鱼子酱排位</b>：提取物排位靠后时需配合故事包装强化卖点</span></div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-6 mt-6">
            <h4 className="text-base font-bold text-morandi-text mb-5 flex items-center gap-2">
              <span className="text-xl">🧪</span> 竞品成分深度对比分析
            </h4>

            <h5 className="text-sm font-semibold text-morandi-text mb-3">一、核心配方结构对比</h5>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm border border-gray-200 rounded">
                <thead><tr className="bg-gray-50"><th className="px-4 py-3 text-left">模块</th><th className="px-4 py-3 text-left bg-blue-50">🐟 我方鱼子酱发膜</th><th className="px-4 py-3 text-left bg-red-50">🔴 竞品粉色鱼子酱发膜</th></tr></thead>
                <tbody>
                  <tr className="border-t border-gray-100"><td className="px-4 py-3 font-bold">基底脂肪醇</td><td className="px-4 py-3 bg-blue-50/50">鲸蜡硬脂醇 + 鲸蜡醇</td><td className="px-4 py-3 bg-red-50/50">Cetearyl Alcohol（鲸蜡硬脂醇）</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-4 py-3 font-bold">调理剂体系</td><td className="px-4 py-3 bg-blue-50/50">BTMS + 硬脂基三甲基氯化铵 + 阳离子蛋白</td><td className="px-4 py-3 bg-red-50/50">Steartrimonium + Behenoyl PG-Trimonium + Cetrimonium + 阳离子瓜尔胶</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-4 py-3 font-bold">硅油体系</td><td className="px-4 py-3 bg-blue-50/50">D5 + Amodimethicone + 硅弹性体（轻盈）</td><td className="px-4 py-3 bg-red-50/50">Dimethicone + Amodimethicone + Dimethiconol（更厚重）</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-4 py-3 font-bold">成膜增稠</td><td className="px-4 py-3 bg-blue-50/50">羟乙基纤维素</td><td className="px-4 py-3 bg-red-50/50">Polyquaternium-7 + 阳离子瓜尔胶（膜感更强）</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-4 py-3 font-bold">保湿体系</td><td className="px-4 py-3 bg-blue-50/50">甘油 + 丁二醇 + 双丙甘醇（三重保湿）</td><td className="px-4 py-3 bg-red-50/50">甘油（较简单）</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-4 py-3 font-bold">防腐体系</td><td className="px-4 py-3 bg-green-50/50 text-green-700">苯氧乙醇 + 乙基己基甘油 + 苯甲酸钠 ✅温和</td><td className="px-4 py-3 bg-red-50/50 text-red-600">DMDM Hydantoin + Parabens ❌老派强力</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-4 py-3 font-bold">卖点成分</td><td className="px-4 py-3 bg-blue-50/50">鱼子酱提取物 + 阳离子水解小麦蛋白</td><td className="px-4 py-3 bg-red-50/50">鱼子酱提取物 + 多种色粉/云母（偏视觉包装）</td></tr>
                </tbody>
              </table>
            </div>

            <h5 className="text-sm font-semibold text-morandi-text mb-3">二、功效表现对比</h5>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h6 className="text-sm font-bold text-blue-700 mb-2">顺滑度</h6>
                <div className="text-xs space-y-2 leading-relaxed">
                  <div><b>竞品更强（短期）</b>：Dimethicone+Dimethiconol更厚重包裹，Polyquaternium-7形成明显顺滑膜</div>
                  <div><b>我方更高级</b>：D5+硅弹性体带来轻盈丝滑感，BTMS更现代柔软不粘</div>
                  <div className="text-blue-600 font-bold mt-2 pt-2 border-t border-blue-100">结论：竞品更猛，我方更舒服、更耐用</div>
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h6 className="text-sm font-bold text-blue-700 mb-2">修护感</h6>
                <div className="text-xs space-y-2 leading-relaxed">
                  <div><b>竞品</b>：偏"表面修护"，靠硅油+成膜聚合物形成涂层</div>
                  <div><b>我方</b>：阳离子水解小麦蛋白（吸附型修护）+BTMS+氨端硅油（受损部位定向吸附）</div>
                  <div className="text-blue-600 font-bold mt-2 pt-2 border-t border-blue-100">结论：我方更适合做"染烫修护""发芯护理"卖点</div>
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h6 className="text-sm font-bold text-green-700 mb-2">蓬松感/不塌发 ✅我方优势</h6>
                <div className="text-xs space-y-2 leading-relaxed">
                  <div><b>我方</b>：D5挥发型硅油+硅弹性体（轻盈触感），细软发友好</div>
                  <div><b>竞品</b>：Dimethicone+Dimethiconol膜厚+Polyquaternium-7使发丝贴合，易塌</div>
                  <div className="text-green-600 font-bold mt-2 pt-2 border-t border-green-100">结论：细软发人群选我方，粗硬干枯发选竞品</div>
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h6 className="text-sm font-bold text-green-700 mb-2">刺激性/敏感风险 ✅我方优势</h6>
                <div className="text-xs space-y-2 leading-relaxed">
                  <div><b>竞品风险高</b>：DMDM Hydantoin（甲醛释放体）+ Parabens，"不够干净""易过敏""孕妇慎用"</div>
                  <div><b>我方风险低</b>：苯氧乙醇+乙基己基甘油+苯甲酸钠，现代温和体系</div>
                  <div className="text-green-600 font-bold mt-2 pt-2 border-t border-green-100">结论：我方适合Clean Beauty/温和修护/敏感发质，更容易长期复购</div>
                </div>
              </div>
            </div>

            <h5 className="text-sm font-semibold text-morandi-text mb-3">三、合规与出口风险</h5>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                <h6 className="text-sm font-bold text-green-700 mb-2">✅ 我方：低风险</h6>
                <div className="text-xs text-green-700 space-y-1.5 leading-relaxed">
                  <div>• 配方更干净，走EAC Declaration更顺</div>
                  <div>• 无MI/MCI，整体审核风险更低</div>
                  <div>• 现代防腐体系，安全评估文件更简洁</div>
                </div>
              </div>
              <div className="bg-red-50 rounded-lg p-4 border border-red-100">
                <h6 className="text-sm font-bold text-red-700 mb-2">❌ 竞品：高风险</h6>
                <div className="text-xs text-red-700 space-y-1.5 leading-relaxed">
                  <div>• 含DMDM+Paraben，审核文件要求更严</div>
                  <div>• 需额外浓度与安全评估报告</div>
                  <div>• 俄代可能要求更多测试</div>
                </div>
              </div>
            </div>

            <h5 className="text-sm font-semibold text-morandi-text mb-3">四、Ozon差异化攻击点（详情页/卖点文案）</h5>
            <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-4 border border-blue-100 mb-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-sm font-bold text-blue-800 mb-2">🇷🇺 俄文卖点关键词</div>
                  <div className="space-y-1.5 text-xs text-blue-700 leading-relaxed">
                    <div>• <b>Без парабенов</b> — 不含Parabens</div>
                    <div>• <b>Без формальдегидных доноров</b> — 不含甲醛释放体</div>
                    <div>• <b>Легкая формула, не утяжеляет волосы</b> — 轻盈配方，不压塌头发</div>
                    <div>• <b>Восстановление после окрашивания</b> — 染烫修护</div>
                    <div>• <b>Гладкость и блеск после первого применения</b> — 一次使用即可柔顺光泽</div>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-bold text-green-800 mb-2">🎯 竞品无法反击的差异化</div>
                  <div className="space-y-1.5 text-xs text-green-700 leading-relaxed">
                    <div>✅ 无Parabens → 竞品含Methylparaben/Propylparaben</div>
                    <div>✅ 无甲醛释放体 → 竞品含DMDM Hydantoin</div>
                    <div>✅ 轻盈不塌发 → 竞品厚膜易塌</div>
                    <div>✅ 染烫修护逻辑 → 竞品偏表面涂层</div>
                    <div>✅ 敏感发质可用 → 竞品过敏风险高</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <h5 className="text-sm font-bold text-blue-800 mb-3">💡 鱼子酱发膜上市建议</h5>
              <div className="text-sm text-blue-700 space-y-2 leading-relaxed">
                <p>• <b>定价策略</b>：对标竞品350g/₽350，我方300g定价₽{stats.hairMaskAnalysis.ourMask.ourPriceRUB}，突出"温和高端"而非低价竞争</p>
                <p>• <b>成本优势</b>：采购仅¥{stats.hairMaskAnalysis.ourMask.priceCNY}+物流¥{stats.hairMaskAnalysis.ourMask.logistics}，按₽{stats.hairMaskAnalysis.ourMask.ourPriceRUB}定价净利率{stats.hairMaskAnalysis.profitAtOurPrice.rate.toFixed(1)}%</p>
                <p>• <b>定位包装</b>："轻奢修护、顺滑但不塌、温和高端、适合染烫受损"，区别于竞品"重修护厚膜老派"</p>
                <p>• <b>目标客群</b>：染烫发质/细软发/俄罗斯女性日常长期护理（高复购），竞品更适合粗硬发</p>
                <p>• <b>标题关键词</b>："икра"（鱼子酱）、"без парабенов"（无Parabens）、"глубокое питание"（深层滋养）、"салонный уход"（沙龙护理）、"300г"</p>
                <p>• <b>季节策略</b>：9-3月为发膜旺季（供暖季干燥），8月备货上架积累评价，10月旺季冲刺</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
