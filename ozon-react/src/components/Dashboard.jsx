import { useMemo } from 'react'
import KPICards from './KPICards'
import BrandChart from './BrandChart'
import PriceChart from './PriceChart'
import DataTable from './DataTable'
import PotentialProductsAnalysis from './PotentialProductsAnalysis'
import PopularFeaturesAnalysis from './PopularFeaturesAnalysis'
import PriceBandAnalysis from './PriceBandAnalysis'
import PriceElasticityAnalysis from './PriceElasticityAnalysis'
import ExpertStrategy from './ExpertStrategy'
import { getBrandDistribution, getPriceDistribution, getConcentration } from '../utils/dataProcessor'

export default function Dashboard({ data, kpis, screenshotMode = false }) {
  const brandData = useMemo(() => data ? getBrandDistribution(data) : [], [data])
  const priceData = useMemo(() => data ? getPriceDistribution(data) : [], [data])
  const concentration = useMemo(() => data ? getConcentration(data) : null, [data])

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <div className="text-6xl mb-6">💨</div>
          <h2 className="text-2xl font-semibold text-morandi-text mb-3">
            欢迎使用吹风机市场分析平台
          </h2>
          <p className="text-morandi-text-light">
            请在左侧上传您的 Excel 或 HTML 数据文件开始分析
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-8 ${screenshotMode ? 'screenshot-mode' : ''}`}>
      {screenshotMode && (
        <div className="text-center py-2 bg-workspace-success-soft border border-green-200 rounded-lg mb-4">
          <span className="text-workspace-success font-medium">📸 截图模式已开启 - 可使用屏幕截图工具</span>
        </div>
      )}
      
      <div>
        <h1 className="text-2xl font-bold text-morandi-text mb-2">
          🇷🇺 俄罗斯电商吹风机市场深度分析
        </h1>
        <p className="text-morandi-text-light">
          数据维度: {data.length} 条记录 × {Object.keys(data[0] || {}).length} 个字段
        </p>
      </div>

      <section>
        <h2 className="section-title">📈 全局 KPI 看板</h2>
        <KPICards kpis={kpis} />
      </section>

      <section>
        <h2 className="section-title">🏷️ 品牌市占率分析</h2>
        <BrandChart brandData={brandData} concentration={concentration} />
      </section>

      <section>
        <h2 className="section-title">💰 价格区间分布</h2>
        <PriceChart priceData={priceData} data={data} />
      </section>

      <section>
        <h2 className="section-title">🎯 潜力产品分析</h2>
        <PotentialProductsAnalysis data={data} />
      </section>

      <section>
        <h2 className="section-title">🔥 热门产品功能分析</h2>
        <PopularFeaturesAnalysis data={data} />
      </section>

      <section>
        <h2 className="section-title">💎 产品价格带分析</h2>
        <PriceBandAnalysis data={data} />
      </section>

      <section>
        <h2 className="section-title">🔍 价格弹性与真空地带识别</h2>
        <PriceElasticityAnalysis data={data} />
      </section>

      <section>
        <h2 className="section-title">🎓 专家策略建议</h2>
        <ExpertStrategy data={data} kpis={kpis} />
      </section>

      <section>
        <h2 className="section-title">📋 数据透视表</h2>
        <DataTable data={data} />
      </section>
    </div>
  )
}
