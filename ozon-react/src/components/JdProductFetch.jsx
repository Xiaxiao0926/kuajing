import { useState, useCallback } from 'react'
import { Search, Download, CheckCircle2, AlertCircle, Loader2, Image, ExternalLink, Package, Trash2 } from 'lucide-react'

const API_BASE = 'http://localhost:8000/api/jd'

function parseSkuId(input) {
  const trimmed = input.trim()
  const patterns = [
    /item\.jd\.com\/(\d+)/,
    /item\.jd\.com\/(\d+)\.html/,
    /sku=(\d+)/,
    /^(\d{6,15})$/,
  ]
  for (const p of patterns) {
    const m = trimmed.match(p)
    if (m) return m[1]
  }
  return null
}

export default function JdProductFetch() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [product, setProduct] = useState(null)
  const [images, setImages] = useState([])
  const [error, setError] = useState('')
  const [savedProducts, setSavedProducts] = useState(null)
  const [showSaved, setShowSaved] = useState(false)

  const fetchProduct = useCallback(async () => {
    const skuId = parseSkuId(input)
    if (!skuId) {
      setError('无法识别商品ID，请输入京东商品链接或SKU ID')
      return
    }
    setLoading(true)
    setError('')
    setProduct(null)
    setImages([])
    try {
      const res = await fetch(`${API_BASE}/goods/${skuId}`)
      const data = await res.json()
      if (!data.success) {
        setError(data.error || '获取商品信息失败')
        return
      }
      setProduct(data.data)
    } catch (e) {
      setError('无法连接后端服务，请确认 jd-union-service 已启动（端口8000）')
    } finally {
      setLoading(false)
    }
  }, [input])

  const downloadImages = useCallback(async () => {
    if (!product) return
    setDownloading(true)
    try {
      const res = await fetch(`${API_BASE}/fetch-images/${product.sku_id}`, { method: 'POST' })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || '下载图片失败')
        return
      }
      setImages(data.data.downloaded || [])
    } catch (e) {
      setError('下载图片请求失败')
    } finally {
      setDownloading(false)
    }
  }, [product])

  const loadSavedProducts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/products`)
      const data = await res.json()
      if (data.success) {
        setSavedProducts(data.data)
      }
    } catch {}
  }, [])

  const toggleSaved = () => {
    if (!showSaved) loadSavedProducts()
    setShowSaved(!showSaved)
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-morandi-text">京东商品采集</h2>
        <p className="text-[10px] text-morandi-text-light mt-0.5">输入京东商品链接，自动获取标题、图片、详情等资料到本地</p>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold text-morandi-text">🔍 输入商品链接</span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && fetchProduct()}
            placeholder="粘贴京东链接，如 https://item.jd.com/100038004356.html"
            className="flex-1 text-sm text-morandi-text border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 placeholder:text-gray-300 bg-white"
          />
          <button
            onClick={fetchProduct}
            disabled={loading || !input.trim()}
            className="px-5 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? '获取中...' : '获取资料'}
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-2">支持格式：京东商品链接 / SKU ID（纯数字）</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-red-700">{error}</p>
            {error.includes('无法连接') && (
              <p className="text-xs text-red-500 mt-1">
                启动命令：<code className="bg-red-100 px-1.5 py-0.5 rounded text-[11px]">cd d:\ozon\jd-union-service && uvicorn app:app --port 8000 --reload</code>
              </p>
            )}
          </div>
        </div>
      )}

      {product && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-bold text-blue-700">商品详情</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600">SKU: {product.sku_id}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={downloadImages}
                disabled={downloading}
                className="text-xs px-3 py-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600 disabled:opacity-40 flex items-center gap-1 transition-colors"
              >
                {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                {downloading ? '下载中...' : '下载图片到本地'}
              </button>
              {product.material_url && (
                <a href={product.material_url} target="_blank" rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-morandi-text hover:bg-gray-200 flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" />京东原页
                </a>
              )}
            </div>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-1">
                {product.img_url ? (
                  <img
                    src={product.img_url}
                    alt={product.title}
                    className="w-full aspect-square object-contain rounded-lg border border-gray-100 bg-white"
                    referrerPolicy="no-referrer"
                    onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
                  />
                ) : null}
                <div className={`w-full aspect-square rounded-lg border border-gray-100 bg-gray-50 items-center justify-center ${product.img_url ? 'hidden' : 'flex'}`}>
                  <Image className="w-12 h-12 text-gray-300" />
                </div>
                {images.length > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      <span className="text-xs font-medium text-green-700">已下载 {images.length} 张图片</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {images.map((img, i) => (
                        <div key={i} className="aspect-square rounded border border-gray-100 bg-gray-50 flex items-center justify-center">
                          <Image className="w-4 h-4 text-gray-300" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:col-span-2 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-morandi-text leading-snug">{product.title || '未知商品'}</h3>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                    <span className="text-[10px] text-red-500 block">售价</span>
                    <span className="text-lg font-bold text-red-600">¥{product.price || '-'}</span>
                  </div>
                  {product.original_price && (
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <span className="text-[10px] text-gray-400 block">原价</span>
                      <span className="text-lg font-bold text-gray-400 line-through">¥{product.original_price}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {product.shop_name && (
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <span className="text-[10px] text-gray-400 block">店铺</span>
                      <span className="text-sm font-medium text-morandi-text">{product.shop_name}</span>
                    </div>
                  )}
                  {product.comment_num > 0 && (
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <span className="text-[10px] text-gray-400 block">评价数</span>
                      <span className="text-sm font-medium text-morandi-text">{product.comment_num.toLocaleString()}</span>
                    </div>
                  )}
                  {product.good_comments_share && (
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <span className="text-[10px] text-gray-400 block">好评率</span>
                      <span className="text-sm font-medium text-morandi-text">{product.good_comments_share}%</span>
                    </div>
                  )}
                  {product.category_info && (
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <span className="text-[10px] text-gray-400 block">类目</span>
                      <span className="text-sm font-medium text-morandi-text">{typeof product.category_info === 'string' ? product.category_info : JSON.stringify(product.category_info)}</span>
                    </div>
                  )}
                </div>

                {product.specs && (
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <span className="text-[10px] text-gray-400 block mb-1">规格参数</span>
                    <p className="text-sm text-morandi-text leading-relaxed">{typeof product.specs === 'string' ? product.specs : JSON.stringify(product.specs)}</p>
                  </div>
                )}

                <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                  <span className="text-[10px] text-amber-600 block mb-1">数据状态</span>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs flex items-center gap-1 text-amber-700">
                      <CheckCircle2 className="w-3 h-3" />商品信息已缓存
                    </span>
                    <span className={`text-xs flex items-center gap-1 ${images.length > 0 ? 'text-green-700' : 'text-gray-400'}`}>
                      {images.length > 0 ? <CheckCircle2 className="w-3 h-3" /> : <Download className="w-3 h-3" />}
                      {images.length > 0 ? `${images.length}张图片已下载` : '图片未下载'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <button
          onClick={toggleSaved}
          className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-morandi-text-light" />
            <span className="text-sm font-semibold text-morandi-text">已采集商品</span>
            {savedProducts && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{savedProducts.total} 个</span>}
          </div>
          <span className="text-xs text-morandi-text-light">{showSaved ? '收起' : '展开'}</span>
        </button>

        {showSaved && savedProducts && (
          <div className="border-t border-gray-100">
            {savedProducts.total === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">暂无已采集商品</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {Object.entries(savedProducts.products).map(([skuId, item]) => (
                  <div key={skuId} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50/50">
                    {item.img_url ? (
                      <img src={item.img_url} alt="" className="w-10 h-10 rounded object-contain border border-gray-100" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-gray-50 border border-gray-100 flex items-center justify-center">
                        <Image className="w-4 h-4 text-gray-300" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-morandi-text truncate">{item.title}</p>
                      <p className="text-[10px] text-gray-400">SKU: {skuId} · ¥{item.price || '-'}</p>
                    </div>
                    <button
                      onClick={() => { setInput(skuId); fetchProduct() }}
                      className="text-xs px-2.5 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                    >
                      查看
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
