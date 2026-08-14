import { useState, useMemo, useEffect } from 'react'
import { Search } from 'lucide-react'
import { loadCommissionData } from './format'

/**
 * 商品类目选择器
 * - 先选类目（dropdown）
 * - 再选商品（datalist 或 dropdown，根据类目过滤）
 * - 选中商品后自动回调佣金率
 */
export function CategoryProductPicker({ value, onChange, compact = false }) {
  const [data, setData] = useState(null)
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    loadCommissionData().then(setData)
  }, [])

  const valueCategory = value?.category || ''
  const valueProduct = value?.product || ''
  const valueCommission = value?.commission ?? null

  // 当前类目下的商品列表
  const productsInCategory = useMemo(() => {
    if (!data || !valueCategory) return []
    return data.items.filter((it) => it.category === valueCategory)
  }, [data, valueCategory])

  // 关键词搜索结果（跨类目）
  const searchResults = useMemo(() => {
    if (!data || !keyword.trim()) return []
    const kw = keyword.trim().toLowerCase()
    return data.items.filter((it) =>
      it.product.toLowerCase().includes(kw) || it.category.toLowerCase().includes(kw)
    ).slice(0, 30)
  }, [data, keyword])

  const handleCategoryChange = (cat) => {
    onChange({ category: cat, product: '', commission: null })
  }
  const handleProductChange = (prodName) => {
    if (!valueCategory) {
      // 未选类目，尝试从搜索匹配
      const matched = (data?.items || []).find((it) => it.product === prodName)
      if (matched) {
        onChange({ category: matched.category, product: matched.product, commission: matched.commission })
      } else {
        onChange({ category: '', product: prodName, commission: null })
      }
      return
    }
    const matched = productsInCategory.find((it) => it.product === prodName)
    if (matched) {
      onChange({ category: valueCategory, product: matched.product, commission: matched.commission })
    } else {
      onChange({ category: valueCategory, product: prodName, commission: null })
    }
  }
  const handlePickSearch = (item) => {
    onChange({ category: item.category, product: item.product, commission: item.commission })
    setKeyword('')
  }

  if (!data) {
    return <div className="text-xs text-gray-400">加载WB佣金数据中...</div>
  }

  return (
    <div className={`space-y-2 ${compact ? '' : 'p-3 bg-gray-50 rounded-lg border border-gray-200'}`}>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">WB类目</label>
          <select
            value={valueCategory}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
          >
            <option value="">— 选择类目 —</option>
            {data.categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">
            商品名称
            {valueCommission !== null && (
              <span className="ml-2 text-orange-600 font-semibold">佣金 {valueCommission}%</span>
            )}
          </label>
          <input
            type="text"
            list="wb-product-list"
            value={valueProduct}
            onChange={(e) => handleProductChange(e.target.value)}
            placeholder={valueCategory ? `从 ${productsInCategory.length} 个商品中选择或输入` : '输入关键词搜索'}
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
          />
          <datalist id="wb-product-list">
            {(valueCategory ? productsInCategory : searchResults).map((it, i) => (
              <option key={i} value={it.product}>{it.category} · {it.commission}%</option>
            ))}
          </datalist>
        </div>
      </div>
      {!valueCategory && (
        <div className="relative">
          <Search className="w-3 h-3 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="跨类目搜索商品（如：玩具、化妆品、电器）"
            className="w-full text-sm border border-gray-200 rounded-lg pl-7 pr-2 py-1.5 bg-white"
          />
          {keyword.trim() && searchResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {searchResults.slice(0, 20).map((it, i) => (
                <button
                  key={i}
                  onClick={() => handlePickSearch(it)}
                  className="w-full text-left px-3 py-1.5 hover:bg-orange-50 border-b border-gray-100 last:border-0"
                >
                  <span className="text-xs text-gray-700">{it.product}</span>
                  <span className="text-xs text-gray-400 ml-2">{it.category}</span>
                  <span className="text-xs text-orange-600 ml-2 font-semibold">{it.commission}%</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {valueCategory && productsInCategory.length > 0 && (
        <p className="text-xs text-gray-400">
          当前类目「{valueCategory}」共 {productsInCategory.length} 个商品
          {productsInCategory[0] && (
            <>，佣金范围 {Math.min(...productsInCategory.map((p) => p.commission))}%-{Math.max(...productsInCategory.map((p) => p.commission))}%</>
          )}
        </p>
      )}
    </div>
  )
}
