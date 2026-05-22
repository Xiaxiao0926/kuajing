import { useState, useMemo } from 'react'
import { Search, Download, ChevronUp, ChevronDown } from 'lucide-react'

export default function DataTable({ data }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [selectedColumns, setSelectedColumns] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20

  const columns = useMemo(() => {
    if (!data || data.length === 0) return []
    return Object.keys(data[0])
  }, [data])

  useMemo(() => {
    if (columns.length > 0 && selectedColumns.length === 0) {
      setSelectedColumns(columns.slice(0, 8))
    }
  }, [columns])

  const filteredData = useMemo(() => {
    if (!data) return []
    if (!searchTerm) return data
    
    const term = searchTerm.toLowerCase()
    return data.filter(row => 
      Object.values(row).some(val => 
        String(val).toLowerCase().includes(term)
      )
    )
  }, [data, searchTerm])

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData
    
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.key]
      const bVal = b[sortConfig.key]
      
      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal
      }
      
      const aStr = String(aVal).toLowerCase()
      const bStr = String(bVal).toLowerCase()
      
      if (sortConfig.direction === 'asc') {
        return aStr.localeCompare(bStr)
      }
      return bStr.localeCompare(aStr)
    })
  }, [filteredData, sortConfig])

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedData.slice(start, start + pageSize)
  }, [sortedData, currentPage])

  const totalPages = Math.ceil(sortedData.length / pageSize)

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const handleDownloadCSV = () => {
    const headers = selectedColumns.join(',')
    const rows = sortedData.map(row => 
      selectedColumns.map(col => {
        const val = row[col]
        if (typeof val === 'string' && val.includes(',')) {
          return `"${val}"`
        }
        return val
      }).join(',')
    ).join('\n')
    
    const csv = '\uFEFF' + headers + '\n' + rows
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'ozon_hair_dryer_data.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const toggleColumn = (col) => {
    setSelectedColumns(prev => 
      prev.includes(col) 
        ? prev.filter(c => c !== col)
        : [...prev, col]
    )
  }

  if (!data) return null

  return (
    <div className="insight-card">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3 flex-1 min-w-64">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索数据..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-morandi-primary/20 focus:border-morandi-primary"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <select
            value={selectedColumns.length > 0 ? selectedColumns.join(',') : ''}
            onChange={(e) => {
              const cols = e.target.value.split(',').filter(Boolean)
              setSelectedColumns(cols)
            }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-morandi-primary/20"
          >
            <option value="">选择显示列</option>
            {columns.map(col => (
              <option key={col} value={columns.join(',')}>
                全选 ({columns.length})
              </option>
            ))}
          </select>
          
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 px-4 py-2 bg-morandi-primary text-white rounded-lg hover:bg-morandi-primary/90 transition-colors"
          >
            <Download className="w-4 h-4" />
            下载 CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {selectedColumns.map(col => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center gap-1">
                    {col}
                    {sortConfig.key === col && (
                      sortConfig.direction === 'asc' 
                        ? <ChevronUp className="w-4 h-4" />
                        : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedData.map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                {selectedColumns.map(col => (
                  <td key={col} className="px-4 py-3 text-sm text-gray-700">
                    {row[col] !== null && row[col] !== undefined ? String(row[col]) : '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
        <p className="text-sm text-morandi-text-light">
          显示 {paginatedData.length} / {sortedData.length} 条记录
        </p>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 border border-gray-200 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            上一页
          </button>
          <span className="text-sm text-morandi-text-light">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border border-gray-200 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  )
}
