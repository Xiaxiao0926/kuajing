import { useState, useCallback, useEffect, useRef } from 'react'
import { Sparkles, Wand2, Settings, Loader2, AlertCircle, CheckCircle2, Image, Trash2, Download, RefreshCw, Link, Shield, Monitor } from 'lucide-react'

const AI_BASE = '/api/ai'

const PROMPT_TEMPLATES = [
  { label: '白底主图', prompt: 'A professional product photo on pure white background, studio lighting, high resolution, e-commerce style, no shadows' },
  { label: '场景图', prompt: 'A lifestyle product photo in a modern home setting, warm lighting, natural composition, high resolution' },
  { label: '细节图', prompt: 'A close-up product detail photo showing texture and quality, macro photography, studio lighting, white background' },
  { label: '礼盒装', prompt: 'A premium gift box product photo, elegant packaging, festive setting, professional lighting, high resolution' },
  { label: '使用场景', prompt: 'A product in use lifestyle photo, person using the product naturally, bright modern interior, high resolution' },
  { label: '对比图', prompt: 'A before and after comparison product photo, split view, clean layout, professional photography' },
]

export default function AiImageGen() {
  const [prompt, setPrompt] = useState('')
  const [imagePath, setImagePath] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [config, setConfig] = useState({ mode: 'browser', api_key_set: false, access_token_set: false, session_token_set: false, base_url: '', model: 'gpt-image-1', quality: 'high', size: '1024x1024', proxy: '', cdp_port: 9222 })
  const [showConfig, setShowConfig] = useState(false)
  const [configInput, setConfigInput] = useState({ mode: 'browser', api_key: '', access_token: '', session_token: '', base_url: '', model: '', quality: '', size: '', proxy: '', cdp_port: 9222 })
  const [history, setHistory] = useState([])
  const [selectedRefImage, setSelectedRefImage] = useState(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    fetch(`${AI_BASE}/config`).then(r => r.json()).then(d => {
      if (d.success) {
        setConfig(d.data)
        setConfigInput({
          mode: d.data.mode || 'browser',
          api_key: '',
          access_token: '',
          session_token: '',
          base_url: d.data.base_url || '',
          model: d.data.model || 'gpt-image-1',
          quality: d.data.quality || 'high',
          size: d.data.size || '1024x1024',
          proxy: d.data.proxy || '',
          cdp_port: d.data.cdp_port || 9222,
        })
      }
    }).catch(() => {})
  }, [])

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(`${AI_BASE}/images`)
      const data = await res.json()
      if (data.success) setHistory(data.data.images || [])
    } catch {}
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  const saveConfig = useCallback(async () => {
    try {
      const body = {}
      if (configInput.mode) body.mode = configInput.mode
      if (configInput.api_key) body.api_key = configInput.api_key
      if (configInput.access_token) body.access_token = configInput.access_token
      if (configInput.session_token) body.session_token = configInput.session_token
      if (configInput.base_url) body.base_url = configInput.base_url
      if (configInput.model) body.model = configInput.model
      if (configInput.quality) body.quality = configInput.quality
      if (configInput.size) body.size = configInput.size
      if (configInput.proxy !== undefined) body.proxy = configInput.proxy
      if (configInput.cdp_port) body.cdp_port = configInput.cdp_port
      const res = await fetch(`${AI_BASE}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        setShowConfig(false)
        const cfgRes = await fetch(`${AI_BASE}/config`)
        const cfgData = await cfgRes.json()
        if (cfgData.success) setConfig(cfgData.data)
      }
    } catch {}
  }, [configInput])

  const testConnection = useCallback(async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(`${AI_BASE}/test`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setTestResult({ ok: true, message: data.data.message })
      } else {
        setTestResult({ ok: false, message: data.error })
      }
    } catch {
      setTestResult({ ok: false, message: '无法连接后端服务，请确认后端（端口8000）已启动' })
    } finally {
      setTesting(false)
    }
  }, [])

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError('请输入提示词')
      return
    }
    setGenerating(true)
    setError('')
    setResult(null)
    try {
      const body = { prompt }
      if (selectedRefImage) body.image_path = selectedRefImage
      const res = await fetch(`${AI_BASE}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || '生成失败')
        return
      }
      setResult(data.data)
      loadHistory()
    } catch {
      setError('无法连接后端服务，请确认后端（端口8000）已启动')
    } finally {
      setGenerating(false)
    }
  }, [prompt, selectedRefImage, loadHistory])

  const handleDeleteImage = useCallback(async (filename) => {
    try {
      await fetch(`${AI_BASE}/image/${filename}`, { method: 'DELETE' })
      loadHistory()
    } catch {}
  }, [loadHistory])

  const handleUseAsRef = useCallback((filepath) => {
    setImagePath(filepath)
    setSelectedRefImage(filepath)
  }, [])

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImagePath(file.name)
    setSelectedRefImage(null)
  }, [])

  const isConfigured = config.mode === 'browser' ? true : (config.mode === 'web' ? (config.access_token_set || config.session_token_set) : config.api_key_set)

  const modeLabel = config.mode === 'browser' ? '浏览器连接' : config.mode === 'web' ? 'ChatGPT Plus' : config.model

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-bold text-purple-800">AI 图片生成</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-600">
              {modeLabel}
            </span>
            {!isConfigured && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600">未配置</span>
            )}
          </div>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="text-xs px-2.5 py-1 rounded-lg bg-purple-100 text-purple-600 hover:bg-purple-200 flex items-center gap-1"
          >
            <Settings className="w-3 h-3" />配置
          </button>
        </div>

        {showConfig && (
          <div className="p-5 bg-purple-50/30 border-b border-purple-100 space-y-3">
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">使用方式</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfigInput({ ...configInput, mode: 'browser' })}
                  className={`flex-1 text-xs py-2 rounded-lg border transition-colors ${configInput.mode === 'browser' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'}`}
                >
                  <Monitor className="w-3 h-3 inline mr-1" />浏览器连接（推荐）
                </button>
                <button
                  onClick={() => setConfigInput({ ...configInput, mode: 'web' })}
                  className={`flex-1 text-xs py-2 rounded-lg border transition-colors ${configInput.mode === 'web' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'}`}
                >
                  ChatGPT Plus
                </button>
                <button
                  onClick={() => setConfigInput({ ...configInput, mode: 'api' })}
                  className={`flex-1 text-xs py-2 rounded-lg border transition-colors ${configInput.mode === 'api' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'}`}
                >
                  OpenAI API
                </button>
              </div>
            </div>

            {configInput.mode === 'browser' ? (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-[10px] text-green-700 font-medium mb-1.5">🖥️ 浏览器连接模式</p>
                  <p className="text-[9px] text-green-600 leading-relaxed">
                    直接连接你已登录的 Chrome 浏览器，通过浏览器发送请求。<br/>
                    ✅ 无需配置代理 ✅ 无需手动复制 Cookie ✅ 自动复用浏览器登录状态
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-[10px] text-blue-700 font-medium mb-1.5">📋 启动步骤</p>
                  <ol className="text-[9px] text-blue-600 space-y-1 list-decimal list-inside">
                    <li><strong>关闭所有 Chrome 窗口</strong>（包括后台进程）</li>
                    <li>打开命令行（Win+R → cmd），执行以下命令启动 Chrome：
                      <div className="mt-1 bg-white/80 rounded px-2 py-1 font-mono text-[8px] text-blue-800 select-all">
                        start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
                      </div>
                      <div className="mt-0.5 text-[8px] text-blue-400">如果 Chrome 安装在其他位置，请替换路径</div>
                    </li>
                    <li>在打开的 Chrome 中登录 <a href="https://chatgpt.com" target="_blank" rel="noopener noreferrer" className="underline">chatgpt.com</a></li>
                    <li>点击下方「测试连接」验证是否成功</li>
                  </ol>
                </div>

                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">CDP 调试端口</label>
                  <input
                    type="number"
                    value={configInput.cdp_port}
                    onChange={e => setConfigInput({ ...configInput, cdp_port: parseInt(e.target.value) || 9222 })}
                    className="w-32 text-xs border border-purple-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-200 font-mono"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">默认 9222，与启动 Chrome 时的 --remote-debugging-port 参数一致</p>
                </div>

                {testResult && (
                  <div className={`text-xs p-2.5 rounded-lg flex items-start gap-1.5 ${testResult.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {testResult.ok ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />}
                    <span className="whitespace-pre-line">{testResult.message}</span>
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={testConnection}
                    disabled={testing}
                    className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 flex items-center gap-1"
                  >
                    {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
                    {testing ? '测试中...' : '测试连接'}
                  </button>
                  <button onClick={() => setShowConfig(false)} className="text-xs px-3 py-1.5 text-gray-500">取消</button>
                  <button onClick={saveConfig} className="text-xs px-4 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700">保存配置</button>
                </div>
              </div>
            ) : configInput.mode === 'web' ? (
              <div className="space-y-3">
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                  <p className="text-[10px] text-amber-700 font-medium mb-2">🔐 认证方式（选其一即可）</p>
                  <p className="text-[9px] text-amber-600">需要配置代理才能使用此模式，推荐使用「浏览器连接」模式</p>
                </div>
                
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">
                    Session Cookie {config.session_token_set ? '(已设置 ✓)' : '(未设置)'}
                  </label>
                  <input
                    type="password"
                    value={configInput.session_token}
                    onChange={e => setConfigInput({ ...configInput, session_token: e.target.value })}
                    placeholder={config.session_token_set ? '留空保持不变' : '粘贴 __Secure-next-auth.session-token 的值...'}
                    className="w-full text-xs border border-purple-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-200"
                  />
                </div>

                <div className="border-t border-gray-100 pt-3">
                  <label className="text-[10px] text-gray-500 block mb-1">
                    或 Access Token {config.access_token_set ? '(已设置 ✓)' : '(未设置)'}
                  </label>
                  <input
                    type="password"
                    value={configInput.access_token}
                    onChange={e => setConfigInput({ ...configInput, access_token: e.target.value })}
                    placeholder={config.access_token_set ? '留空保持不变' : '粘贴你的 accessToken...'}
                    className="w-full text-xs border border-purple-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-200"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">代理地址</label>
                  <input
                    type="text"
                    value={configInput.proxy}
                    onChange={e => setConfigInput({ ...configInput, proxy: e.target.value })}
                    placeholder="http://127.0.0.1:7890"
                    className="w-full text-xs border border-purple-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-200 font-mono"
                  />
                </div>
                {testResult && (
                  <div className={`text-xs p-2.5 rounded-lg flex items-start gap-1.5 ${testResult.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {testResult.ok ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />}
                    {testResult.message}
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={testConnection}
                    disabled={testing || (!config.access_token_set && !config.session_token_set)}
                    className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 flex items-center gap-1"
                  >
                    {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
                    {testing ? '测试中...' : '测试连接'}
                  </button>
                  <button onClick={() => setShowConfig(false)} className="text-xs px-3 py-1.5 text-gray-500">取消</button>
                  <button onClick={saveConfig} className="text-xs px-4 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700">保存配置</button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">API Key {config.api_key_set ? '(已设置)' : '(未设置)'}</label>
                    <input
                      type="password"
                      value={configInput.api_key}
                      onChange={e => setConfigInput({ ...configInput, api_key: e.target.value })}
                      placeholder={config.api_key_set ? '留空保持不变' : 'sk-...'}
                      className="w-full text-xs border border-purple-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-200"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">API 地址</label>
                    <input
                      type="text"
                      value={configInput.base_url}
                      onChange={e => setConfigInput({ ...configInput, base_url: e.target.value })}
                      placeholder="https://api.openai.com/v1"
                      className="w-full text-xs border border-purple-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">模型</label>
                    <select
                      value={configInput.model}
                      onChange={e => setConfigInput({ ...configInput, model: e.target.value })}
                      className="w-full text-xs border border-purple-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-200"
                    >
                      <option value="gpt-image-1">gpt-image-1 (推荐)</option>
                      <option value="gpt-image-2">gpt-image-2 (最新)</option>
                      <option value="dall-e-3">dall-e-3</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">质量</label>
                    <select
                      value={configInput.quality}
                      onChange={e => setConfigInput({ ...configInput, quality: e.target.value })}
                      className="w-full text-xs border border-purple-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-200"
                    >
                      <option value="low">低质量 (~0.15元/张)</option>
                      <option value="medium">中质量 (~0.5元/张)</option>
                      <option value="high">高质量 (~1.4元/张)</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowConfig(false)} className="text-xs px-3 py-1.5 text-gray-500">取消</button>
                  <button onClick={saveConfig} className="text-xs px-4 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700">保存配置</button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-morandi-text font-medium block mb-1.5">快捷模板</label>
            <div className="flex flex-wrap gap-1.5">
              {PROMPT_TEMPLATES.map((t, i) => (
                <button
                  key={i}
                  onClick={() => setPrompt(t.prompt)}
                  className="text-[10px] px-2.5 py-1 rounded-lg bg-gray-50 text-gray-600 hover:bg-purple-50 hover:text-purple-700 border border-gray-100 hover:border-purple-200 transition-colors"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-morandi-text font-medium block mb-1.5">提示词 (Prompt)</label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="描述你想生成的图片，例如：A professional product photo of a kitchen gadget on white background"
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300 placeholder:text-gray-300 resize-none"
            />
          </div>

          <div>
            <label className="text-xs text-morandi-text font-medium block mb-1.5">参考图片（可选）</label>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={imagePath}
                onChange={e => { setImagePath(e.target.value); setSelectedRefImage(e.target.value || null) }}
                placeholder="输入本地图片路径，或从下方历史中选择"
                className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-200 font-mono"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs px-3 py-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 border border-gray-200 whitespace-nowrap"
              >
                浏览
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
              {imagePath && (
                <button
                  onClick={() => { setImagePath(''); setSelectedRefImage(null) }}
                  className="text-xs px-2 py-2 text-red-500 hover:text-red-700"
                >
                  清除
                </button>
              )}
            </div>
            {selectedRefImage && (
              <p className="text-[10px] text-purple-500 mt-1">已选择参考图片: {selectedRefImage}</p>
            )}
          </div>

          <div className="flex gap-3 items-center">
            <button
              onClick={handleGenerate}
              disabled={generating || !prompt.trim() || !isConfigured}
              className="px-6 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              {generating ? '生成中...（约需10-30秒）' : '生成图片'}
            </button>
            {!isConfigured && (
              <span className="text-xs text-red-500">请先点击右上角「配置」按钮设置</span>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700 whitespace-pre-line">{error}</p>
            </div>
          )}

          {result && result.images && (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">生成成功！</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {result.images.map((img, i) => (
                  <div key={i} className="relative group rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                    {img.url ? (
                      <img src={img.url} alt="" className="w-full aspect-square object-contain" />
                    ) : (
                      <div className="w-full aspect-square flex items-center justify-center text-xs text-red-500">
                        {img.error || '生成失败'}
                      </div>
                    )}
                    {img.url && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex justify-center gap-2 py-1.5">
                        <a href={img.url} download className="text-white text-[10px] flex items-center gap-0.5 hover:text-purple-200">
                          <Download className="w-3 h-3" />下载
                        </a>
                        <button
                          onClick={() => handleUseAsRef(img.filepath)}
                          className="text-white text-[10px] flex items-center gap-0.5 hover:text-purple-200"
                        >
                          <Wand2 className="w-3 h-3" />作为参考图
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-bold text-morandi-text">生成历史</span>
            {history.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">{history.length} 张</span>
            )}
          </div>
          <button onClick={loadHistory} className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />刷新
          </button>
        </div>

        {history.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">暂无生成记录</div>
        ) : (
          <div className="p-4 grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2">
            {history.map((img, i) => (
              <div key={i} className="relative group aspect-square rounded-lg border border-gray-100 overflow-hidden bg-gray-50">
                <img src={img.url} alt="" className="w-full h-full object-contain" />
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleDeleteImage(img.filename)}
                    className="w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <button
                  onClick={() => handleUseAsRef(img.filepath || '')}
                  className="absolute bottom-1 left-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-purple-600 text-white text-[9px] py-0.5 rounded text-center hover:bg-purple-700"
                >
                  作为参考图
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
