/**
 * scoring/ScoringPageHeader.jsx — 评分页头（T5-4）
 * 主视觉只有标题 + 副标题 + 导出；规则版本/λ/耗时等 meta 由调用方放底部 meta 行。
 */
import { FileDown } from 'lucide-react'
import PageHeader from '../ui/PageHeader'
import Button from '../ui/Button'

export default function ScoringPageHeader({ total, filteredCount, onExportXlsx, onExportCsv }) {
  return (
    <PageHeader
      title="选品评分"
      subtitle={`俄罗斯市场 · ${total} 个候选 SKU · 规则 V1`}
      actions={
        <>
          <Button variant="secondary" onClick={onExportCsv} disabled={filteredCount === 0}>
            <FileDown className="h-3.5 w-3.5" />
            CSV（{filteredCount}）
          </Button>
          <Button variant="primary" onClick={onExportXlsx} disabled={filteredCount === 0}>
            <FileDown className="h-3.5 w-3.5" />
            导出 XLSX（{filteredCount}）
          </Button>
        </>
      }
    />
  )
}
