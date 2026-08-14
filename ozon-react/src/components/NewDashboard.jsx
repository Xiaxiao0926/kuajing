import { useState, useRef } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { useDashboardStats } from './dashboard/useDashboardStats'
import HeaderOverview from './dashboard/sections/HeaderOverview'
import HairMaskSection from './dashboard/sections/HairMaskSection'
import HairSpraySection from './dashboard/sections/HairSpraySection'
import GlovesSection from './dashboard/sections/GlovesSection'
import InsightsSections from './dashboard/sections/InsightsSections'

/**
 * 市场调研面板（编排层）
 * 数据计算：dashboard/useDashboardStats.js
 * 展示区块：dashboard/sections/*.jsx
 * 词库/格式化工具：dashboard/dictionary.js
 */
export default function NewDashboard({ data, kpis }) {
  const [showAllSizes, setShowAllSizes] = useState(false)
  const [showAllMaterials, setShowAllMaterials] = useState(false)
  const [sprayExporting, setSprayExporting] = useState(false)
  const sprayStockRef = useRef(null)
  const stats = useDashboardStats(data)

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <div className="text-6xl mb-6">📊</div>
          <h2 className="text-2xl font-semibold text-morandi-text mb-3">新版市场分析面板</h2>
          <p className="text-morandi-text-light">请上传Ozon分析报告数据开始分析</p>
        </div>
      </div>
    )
  }

  const CC = ['#8B9DC3', '#B4BEC9', '#C3B4D1', '#D4C4B0', '#E8D5C4', '#F0E6E0', '#D9E5D6', '#A8C5DA']

  const exportSprayStockPDF = async () => {
    setSprayExporting(true)
    try {
      const element = sprayStockRef.current
      if (!element) { setSprayExporting(false); return }
      const canvas = await html2canvas(element, { scale: 3, useCORS: true, logging: false, backgroundColor: '#ffffff' })
      const imgWidth = 210
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      const pdf = new jsPDF('p', 'mm', [imgWidth, imgHeight])
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight)
      pdf.save('精油喷雾备货计算.pdf')
    } catch (err) { console.error('Export error:', err); alert('导出失败') }
    finally { setSprayExporting(false) }
  }

  return (
    <div className="space-y-6">
      <HeaderOverview
        stats={stats}
        data={data}
        CC={CC}
        showAllSizes={showAllSizes}
        setShowAllSizes={setShowAllSizes}
        showAllMaterials={showAllMaterials}
        setShowAllMaterials={setShowAllMaterials}
      />
      {stats.isHairMaskCategory && stats.hairMaskAnalysis && (
        <HairMaskSection stats={stats} data={data} />
      )}
      {stats.isSprayCategory && stats.sprayAnalysis && (
        <HairSpraySection
          stats={stats}
          data={data}
          sprayExporting={sprayExporting}
          sprayStockRef={sprayStockRef}
          exportSprayStockPDF={exportSprayStockPDF}
        />
      )}
      {stats.isGlovesCategory && stats.nitrileGlovesData && (
        <GlovesSection stats={stats} data={data} CC={CC} />
      )}
      <InsightsSections stats={stats} data={data} />
    </div>
  )
}
