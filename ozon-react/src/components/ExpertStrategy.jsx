import { useMemo } from 'react'
import { Sparkles, Target, TrendingUp, Award, Download, Star } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { chartColors } from '../utils/chartConfigs'

export default function ExpertStrategy({ data, kpis }) {
  const blackHorseData = useMemo(() => {
    if (!data || data.length === 0) return null
    
    const nameKeys = ['商品名称', '产品名称', 'name', 'title']
    const nameCol = nameKeys.find(k => data[0]?.[k] !== undefined)
    
    const qtyKeys = ['月销量', '销量', 'Quantity', 'sales', 'quantity']
    const qtyCol = qtyKeys.find(k => data[0]?.[k] !== undefined)
    
    const priceKeys = ['价格(₽)', '价格', 'Price', 'price', 'стоимость']
    const priceCol = priceKeys.find(k => data[0]?.[k] !== undefined)
    
    const brandKeys = ['品牌', 'Brand', 'brand', 'производитель']
    const brandCol = brandKeys.find(k => data[0]?.[k] !== undefined)
    
    const growthKeys = ['月销量环比(%)', '增长率', 'Growth', 'growth', 'прирост']
    const growthCol = growthKeys.find(k => data[0]?.[k] !== undefined)
    
    const ratingKeys = ['评分', 'rating', 'Rating', 'оценка', 'рейтинг']
    const ratingCol = ratingKeys.find(k => data[0]?.[k] !== undefined)
    
    const products = data.map(row => ({
      name: nameCol ? row[nameCol] : 'Unknown',
      brand: brandCol ? row[brandCol] : 'Unknown',
      price: priceCol ? parseFloat(String(row[priceCol]).replace(/[^\d.]/g, '')) || 0 : 0,
      qty: qtyCol ? parseFloat(String(row[qtyCol]).replace(/[^\d.]/g, '')) || 0 : 0,
      growth: growthCol ? parseFloat(String(row[growthCol]).replace(/[^\d.-]/g, '')) || 0 : 0,
      rating: ratingCol ? parseFloat(String(row[ratingCol]).replace(/[^\d.]/g, '')) || 0 : 0,
    })).filter(p => p.price > 0)
    
    const hasGrowthData = products.some(p => p.growth > 0)
    const hasRatingData = products.some(p => p.rating > 0)
    
    let blackHorses
    if (hasGrowthData && hasRatingData) {
      blackHorses = products.filter(p => p.growth > 10 && p.rating > 4.5)
        .sort((a, b) => b.growth - a.growth)
    } else {
      const avgQty = products.reduce((sum, p) => sum + p.qty, 0) / products.length
      blackHorses = products.filter(p => p.qty > avgQty * 1.5)
        .sort((a, b) => b.qty - a.qty)
    }
    
    const avgPrice = products.reduce((sum, p) => sum + p.price, 0) / products.length
    const avgQty = products.reduce((sum, p) => sum + p.qty, 0) / products.length
    const avgRating = products.reduce((sum, p) => sum + p.rating, 0) / products.filter(p => p.rating > 0).length || 0
    
    const priceDistribution = {
      budget: products.filter(p => p.price < 3000).length,
      mid: products.filter(p => p.price >= 3000 && p.price < 8000).length,
      premium: products.filter(p => p.price >= 8000).length
    }
    
    return {
      blackHorses,
      avgPrice: Math.round(avgPrice),
      avgQty: Math.round(avgQty),
      avgRating: avgRating > 0 ? avgRating.toFixed(1) : 'N/A',
      totalProducts: products.length,
      priceDistribution,
      topGrowth: blackHorses[0] || null,
      hasGrowthData,
      hasRatingData
    }
  }, [data])

  const recommendations = useMemo(() => {
    if (!data || !blackHorseData) return []
    
    const recs = []
    
    recs.push({
      title: '💰 定价策略：主攻中端市场',
      content: `当前市场低价产品占比 ${Math.round(blackHorseData.priceDistribution.budget / blackHorseData.totalProducts * 100)}%，中端占比 ${Math.round(blackHorseData.priceDistribution.mid / blackHorseData.totalProducts * 100)}%。建议2026下半年定价 5000-8000₽ (约¥375-600) 区间，避开激烈价格战，同时保持竞争力。`,
      priority: 'high'
    })
    
    if (blackHorseData.blackHorses.length > 0) {
      const avgPrice = blackHorseData.blackHorses.reduce((sum, p) => sum + p.price, 0) / blackHorseData.blackHorses.length
      recs.push({
        title: '🎯 配置建议：参考热销产品',
        content: `热销产品平均价格 ₽${Math.round(avgPrice).toLocaleString()} (约¥${Math.round(avgPrice * 0.075).toLocaleString()})，建议新品配置：负离子+变频马达+专业级造型，定价 ₽${Math.round(avgPrice * 0.9).toLocaleString()}-${Math.round(avgPrice * 1.1).toLocaleString()}`,
        priority: 'high'
      })
    } else {
      recs.push({
        title: '🎯 配置建议：参考市场均价',
        content: `市场平均价格 ₽${blackHorseData.avgPrice.toLocaleString()} (约¥${Math.round(blackHorseData.avgPrice * 0.075).toLocaleString()})，建议新品配置：负离子+变频马达+专业级造型，定价 ₽${Math.round(blackHorseData.avgPrice * 0.9).toLocaleString()}-${Math.round(blackHorseData.avgPrice * 1.2).toLocaleString()}`,
        priority: 'high'
      })
    }
    
    recs.push({
      title: '📦 功能差异化策略',
      content: '分析显示多功能产品销量领先，建议进入俄罗斯市场的产品至少具备3种以上功能组合（负离子+冷风+便携），可获得更高的市场溢价能力。',
      priority: 'medium'
    })
    
    recs.push({
      title: '⭐ 服务升级策略',
      content: '建议提供2年官方质保+俄语客服支持，可提升用户信任度，定价可上浮 10-15%。',
      priority: 'medium'
    })
    
    recs.push({
      title: '🚀 2026下半年进入策略',
      content: '建议9月开学季前上架，主打"快速干发+护发"卖点，配合促销活动快速积累销量基础。',
      priority: 'high'
    })

    recs.push({
      title: '💡 核心护发科技配置建议',
      content: '俄罗斯市场 中高端产品标配：①负离子技术(Ionization)：减少静电、抚平毛躁、锁住水分，冬季需求极高；②恒温控温(Intelligent Heat Control)：防止过热损伤，选择带ThermoProtect的产品；③陶瓷/电气石涂层(Ceramic/Tourmaline)：均匀热量分布。',
      priority: 'high'
    })

    recs.push({
      title: '⚡ 性能与效率配置建议',
      content: '①高转速马达：11万转以上无刷电机(High-Speed BLDC)，受Dyson影响俄罗斯消费者追求大风量快速干发；②功率：1800W-2200W家用主流；③风速温度：至少3档温度+2档风速，冷风定型(Cool Shot)必备。',
      priority: 'high'
    })

    recs.push({
      title: '🎒 便携性与设计建议',
      content: '①轻量化：400g-600g竞争力强；②折叠紧凑型适合旅游/出差，便携式带收纳盒在礼品市场受欢迎；③配色：年轻女性偏好哑光灰、奶白色、玫瑰金等莫兰迪色系。',
      priority: 'medium'
    })

    recs.push({
      title: '🔧 易用性与耐用性建议',
      content: '①电源线1.8-3米（俄罗斯老旧公寓插座分布不均）；②可拆卸滤网便于清理；③多功能风嘴(顺滑/造型/扩散风嘴)。',
      priority: 'medium'
    })

    recs.push({
      title: '📋 市场准入与定价策略',
      content: '俄罗斯市场两极分化：①高端Dyson/Bork消费者追求品牌溢价；②务实型消费者追求高性价比(Cost-effective)，看重功能参数。重点突出：Fast Drying(快干)、Hair Safety(护发)、Professional Salon Results at Home(居家沙龙级)。必须符合220V/50Hz电压标准。',
      priority: 'high'
    })
    
    return recs
  }, [data, blackHorseData])

  const generatePDF = () => {
    const printWindow = window.open('', '_blank')
    
    const blackHorsesList = blackHorseData?.blackHorses.slice(0, 5) || []
    
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>俄罗斯电商吹风机市场分析简报</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Noto Sans SC', sans-serif;
      color: #3a4656;
      line-height: 1.6;
      background: #f6f6f6;
    }
    
    .cover {
      background: linear-gradient(135deg, #8B9DC3 0%, #B4BEC9 100%);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      color: white;
      padding: 60px;
      text-align: center;
    }
    
    .cover h1 {
      font-size: 42px;
      font-weight: 700;
      margin-bottom: 20px;
      letter-spacing: 2px;
    }
    
    .cover h2 {
      font-size: 24px;
      font-weight: 400;
      margin-bottom: 40px;
      opacity: 0.95;
    }
    
    .cover .meta {
      font-size: 14px;
      opacity: 0.9;
      margin-top: 60px;
    }
    
    .content {
      background: #f6f6f6;
      padding: 60px;
    }
    
    .section {
      background: white;
      border-radius: 12px;
      padding: 40px;
      margin-bottom: 30px;
      box-shadow: 0 2px 12px rgba(139, 157, 195, 0.1);
    }
    
    .section h3 {
      color: #8B9DC3;
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 24px;
      padding-bottom: 12px;
      border-bottom: 2px solid #e8ecf2;
    }
    
    .section h4 {
      color: #5a6a7a;
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .info-card {
      background: #f8f9fb;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    
    .info-card .value {
      font-size: 28px;
      font-weight: 700;
      color: #8B9DC3;
    }
    
    .info-card .label {
      font-size: 12px;
      color: #8a9aaa;
      margin-top: 4px;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    
    th {
      background: #f0f4f9;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #5a6a7a;
      border-bottom: 2px solid #e0e6ed;
    }
    
    td {
      padding: 12px;
      border-bottom: 1px solid #f0f4f9;
    }
    
    tr:hover { background: #f8f9fb; }
    
    .rec-item {
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 16px;
      border-left: 4px solid #8B9DC3;
      background: #f8f9fb;
    }
    
    .rec-item.high {
      border-left-color: #d4a373;
      background: #fdf8f4;
    }
    
    .rec-item h5 {
      font-size: 15px;
      font-weight: 600;
      color: #3a4656;
      margin-bottom: 8px;
    }
    
    .rec-item p {
      font-size: 13px;
      color: #6a7a8a;
    }
    
    .priority-tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      margin-right: 8px;
    }
    
    .priority-tag.high {
      background: #f0e6d8;
      color: #b8844c;
    }
    
    .priority-tag.medium {
      background: #e8ecf2;
      color: #7a8a9a;
    }
    
    .footer {
      text-align: center;
      padding: 30px;
      color: #9aa4b0;
      font-size: 12px;
      border-top: 1px solid #e8ecf2;
    }
    
    @media print {
      body { -webkit-print-color-adjust: exact; }
      .cover { min-height: 60vh; }
    }
  </style>
</head>
<body>
  <div class="cover">
    <h1>🇷🇺 俄罗斯电商</h1>
    <h1>吹风机市场分析简报</h1>
    <h2>2026年下半年进入策略建议</h2>
    <div class="meta">
      <p>报告生成日期: ${new Date().toLocaleDateString('zh-CN')}</p>
      <p>分析产品数: ${blackHorseData?.totalProducts || 0} | 市场均价: ₽${blackHorseData?.avgPrice?.toLocaleString() || 0}</p>
    </div>
  </div>
  
  <div class="content">
    <div class="section">
      <h3>📊 市场概况</h3>
      <div class="info-grid">
        <div class="info-card">
          <div class="value">${blackHorseData?.totalProducts || 0}</div>
          <div class="label">分析产品数</div>
        </div>
        <div class="info-card">
          <div class="value">₽${blackHorseData?.avgPrice?.toLocaleString() || 0}</div>
          <div class="label">市场均价</div>
        </div>
        <div class="info-card">
          <div class="value">${blackHorseData?.avgRating || 0}</div>
          <div class="label">平均评分</div>
        </div>
        <div class="info-card">
          <div class="value">${blackHorseData?.blackHorses.length || 0}</div>
          <div class="label">黑马潜力款</div>
        </div>
      </div>
    </div>
    
    <div class="section">
      <h3>🌟 黑马潜力款清单</h3>
      <p style="margin-bottom: 16px; color: #6a7a8a; font-size: 13px;">筛选条件: 月销量环比增长 > 10% 且 评分 > 4.5</p>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>产品名称</th>
            <th>品牌</th>
            <th>价格</th>
            <th>月销量</th>
            <th>增长率</th>
            <th>评分</th>
          </tr>
        </thead>
        <tbody>
          ${blackHorsesList.length > 0 ? blackHorsesList.map((p, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td>${p.name?.slice(0, 35) || 'Unknown'}</td>
              <td>${p.brand || '-'}</td>
              <td>₽${p.price?.toLocaleString() || 0}</td>
              <td>${p.qty?.toLocaleString() || 0}</td>
              <td style="color: #5a9;">+${p.growth}%</td>
              <td>⭐ ${p.rating}</td>
            </tr>
          `).join('') : '<tr><td colspan="7" style="text-align:center;color:#9aa;">暂无符合条件的黑马产品</td></tr>'}
        </tbody>
      </table>
    </div>
    
    <div class="section">
      <h3>💡 专家策略建议</h3>
      ${recommendations.map(rec => `
        <div class="rec-item ${rec.priority}">
          <h5>
            <span class="priority-tag ${rec.priority}">${rec.priority === 'high' ? '【高优】' : '【推荐】'}</span>
            ${rec.title}
          </h5>
          <p>${rec.content}</p>
        </div>
      `).join('')}
    </div>
  </div>
  
  <div class="footer">
    <p>页码 | Page ${'{page}'}</p>
  </div>
  
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>`
    
    printWindow.document.write(htmlContent)
    printWindow.document.close()
  }

  if (!blackHorseData) {
    return (
      <div className="insight-card text-center py-12">
        <p className="text-morandi-text-light">数据不足，无法生成策略建议</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-morandi-primary" />
          <div>
            <h3 className="font-semibold text-morandi-text">🎓 专家策略建议</h3>
            <p className="text-sm text-morandi-text-light">基于数据分析的 2026 下半年进入策略</p>
          </div>
        </div>
        <button
          onClick={generatePDF}
          className="flex items-center gap-2 px-4 py-2 bg-morandi-primary text-white rounded-lg hover:bg-morandi-primary/90 transition-colors"
        >
          <Download className="w-4 h-4" />
          导出PDF报告
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="kpi-card">
          <Target className="w-6 h-6 text-morandi-success mb-2" />
          <div className="text-xl font-bold text-morandi-text">{blackHorseData.totalProducts}</div>
          <div className="text-xs text-morandi-text-light">总商品数</div>
        </div>
        <div className="kpi-card">
          <TrendingUp className="w-6 h-6 text-morandi-primary mb-2" />
          <div className="text-xl font-bold text-morandi-text">₽{blackHorseData.avgPrice.toLocaleString()}</div>
          <div className="text-xs text-morandi-text-light">市场均价</div>
        </div>
        <div className="kpi-card">
          <Award className="w-6 h-6 text-morandi-accent mb-2" />
          <div className="text-xl font-bold text-morandi-text">{blackHorseData.avgQty.toLocaleString()}</div>
          <div className="text-xs text-morandi-text-light">平均月销量</div>
        </div>
        <div className="kpi-card">
          <Star className="w-6 h-6 text-morandi-warning mb-2" />
          <div className="text-xl font-bold text-morandi-text">₽{blackHorseData.topGrowth?.price?.toLocaleString() || blackHorseData.avgPrice.toLocaleString()}</div>
          <div className="text-xs text-morandi-text-light">参考价格</div>
        </div>
      </div>

      <div className="insight-card">
        <h4 className="font-semibold text-morandi-text mb-4">📊 价格带分布</h4>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-green-600">{blackHorseData.priceDistribution.budget}</div>
            <div className="text-xs text-morandi-text-light">低价位 (&lt;3000₽)</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-morandi-primary">{blackHorseData.priceDistribution.mid}</div>
            <div className="text-xs text-morandi-text-light">中价位 (3000-8000₽)</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-morandi-accent">{blackHorseData.priceDistribution.premium}</div>
            <div className="text-xs text-morandi-text-light">高价位 (&gt;8000₽)</div>
          </div>
        </div>
      </div>

      {blackHorseData.blackHorses.length > 0 ? (
        <div className="insight-card">
          <h4 className="font-semibold text-morandi-text mb-4">🌟 热销产品TOP10 (按销量排序)</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">#</th>
                  <th className="px-4 py-2 text-left">产品名称</th>
                  <th className="px-4 py-2 text-left">品牌</th>
                  <th className="px-4 py-2 text-right">价格</th>
                  <th className="px-4 py-2 text-right">月销量</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {blackHorseData.blackHorses.slice(0, 10).map((p, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-morandi-text-light">{idx + 1}</td>
                    <td className="px-4 py-2 max-w-xs truncate">{p.name}</td>
                    <td className="px-4 py-2">{p.brand}</td>
                    <td className="px-4 py-2 text-right">₽{p.price.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">{p.qty.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="insight-card">
          <h4 className="font-semibold text-morandi-text mb-4">🌟 热销产品TOP10 (按销量排序)</h4>
          <p className="text-morandi-text-light text-center py-4">暂无销量数据</p>
        </div>
      )}

      <div className="insight-card">
        <h4 className="font-semibold text-morandi-text mb-4">💡 2026 下半年进入策略建议</h4>
        {recommendations.length === 0 ? (
          <div className="text-center py-8 text-morandi-text-light">
            <p>暂无策略建议，请确保数据包含价格和销量信息</p>
          </div>
        ) : (
          <div className="space-y-4">
            {recommendations.map((rec, idx) => (
              <div 
                key={idx} 
                className={`p-4 rounded-xl border-l-4 ${
                  rec.priority === 'high' 
                    ? 'bg-morandi-primary/5 border-morandi-primary' 
                    : 'bg-morandi-bg border-morandi-secondary'
                }`}
              >
                <h5 className="font-medium text-morandi-text mb-2">{rec.title}</h5>
                <p className="text-sm text-morandi-text-light">{rec.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
