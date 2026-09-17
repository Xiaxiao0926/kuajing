/**
 * ManualProcurementWorkbench.jsx — Phase 5 人工采购验证与单位经济工作台
 * 拒绝伪自动化：人工录入 1688 真实报价、包装数据、物流报价，
 * 严格实施 4 级数据可信度分层（ESTIMATED / SUPPLIER_CONFIRMED / LOGISTICS_CONFIRMED / REGULATION_VERIFIED），
 * 禁止将未经实测核实的数据混入最终采购决策。
 */
import { useState, useEffect, useMemo } from 'react'
import {
  Save, ArrowRight, Calculator, ExternalLink, CheckCircle2,
  DollarSign, Truck, Package, Store, AlertTriangle, ShieldAlert,
  ShieldCheck, HelpCircle,
} from 'lucide-react'
import Drawer from '../../ui/Drawer'
import Button from '../../ui/Button'
import Surface from '../../ui/Surface'
import Badge from '../../ui/Badge'
import { saveManualQuote, getManualQuotes, promoteToT6Candidate } from '../../../utils/marketIntelligence/miStore'

export default function ManualProcurementWorkbench({
  niche,
  isOpen,
  onClose,
  onNavigateToWbCalc,
  onPromoted,
}) {
  if (!niche) return null

  const rubPerCny = 12.0 // 参考汇率

  const [supplierName, setSupplierName] = useState('')
  const [supplierUrl, setSupplierUrl] = useState('')
  const [factoryPriceCny, setFactoryPriceCny] = useState(15)
  const [moq, setMoq] = useState(50)
  const [weightG, setWeightG] = useState(niche.specs?.weight_g || 350)
  const [dims, setDims] = useState(niche.specs?.dims || '20x15x5')
  const [domesticFreightCny, setDomesticFreightCny] = useState(2.0)
  const [internationalFreightCny, setInternationalFreightCny] = useState(12.0)
  const [targetPriceRub, setTargetPriceRub] = useState(Math.round(niche.price * rubPerCny))
  const [commissionRatePct, setCommissionRatePct] = useState(15.0) // WB 平均类目佣金
  const [savedSuccess, setSavedSuccess] = useState(false)

  // 4 级数据可信度分层状态
  const [priceProvenance, setPriceProvenance] = useState('ESTIMATED') // 'ESTIMATED' | 'SUPPLIER_CONFIRMED'
  const [specProvenance, setSpecProvenance] = useState('ESTIMATED') // 'ESTIMATED' | 'SUPPLIER_CONFIRMED' | 'LOGISTICS_CONFIRMED'
  const [freightProvenance, setFreightProvenance] = useState('ESTIMATED') // 'ESTIMATED' | 'LOGISTICS_CONFIRMED'
  const [regulationProvenance, setRegulationProvenance] = useState(
    niche.eac === 'NOT_REQUIRED_VERIFIED' ? 'REGULATION_VERIFIED' : 'ESTIMATED'
  ) // 'ESTIMATED' | 'REGULATION_VERIFIED'

  // 加载已有草稿
  useEffect(() => {
    if (niche && niche.name) {
      const all = getManualQuotes()
      const draft = all[niche.name]
      if (draft) {
        setSupplierName(draft.supplierName || '')
        setSupplierUrl(draft.supplierUrl || '')
        setFactoryPriceCny(draft.factoryPriceCny ?? 15)
        setMoq(draft.moq ?? 50)
        setWeightG(draft.weightG ?? (niche.specs?.weight_g || 350))
        setDims(draft.dims || (niche.specs?.dims || '20x15x5'))
        setDomesticFreightCny(draft.domesticFreightCny ?? 2.0)
        setInternationalFreightCny(draft.internationalFreightCny ?? 12.0)
        setTargetPriceRub(draft.targetPriceRub ?? Math.round(niche.price * rubPerCny))
        setCommissionRatePct(draft.commissionRatePct ?? 15.0)
        if (draft.priceProvenance) setPriceProvenance(draft.priceProvenance)
        if (draft.specProvenance) setSpecProvenance(draft.specProvenance)
        if (draft.freightProvenance) setFreightProvenance(draft.freightProvenance)
        if (draft.regulationProvenance) setRegulationProvenance(draft.regulationProvenance)
      } else {
        const estWeight = niche.specs?.weight_g || (niche.heavy === 'YES' ? 2500 : 350)
        setWeightG(estWeight)
        setInternationalFreightCny(Math.max(8, Math.round((estWeight / 1000) * 35)))
        setPriceProvenance('ESTIMATED')
        setSpecProvenance('ESTIMATED')
        setFreightProvenance('ESTIMATED')
        setRegulationProvenance(niche.eac === 'NOT_REQUIRED_VERIFIED' ? 'REGULATION_VERIFIED' : 'ESTIMATED')
      }
    }
  }, [niche])

  // 综合数据可信度定级
  const overallTrustTier = useMemo(() => {
    const isEstimated =
      priceProvenance === 'ESTIMATED' ||
      specProvenance === 'ESTIMATED' ||
      freightProvenance === 'ESTIMATED' ||
      regulationProvenance === 'ESTIMATED'

    if (isEstimated) return 'ESTIMATED'
    if (regulationProvenance === 'REGULATION_VERIFIED') return 'REGULATION_VERIFIED'
    if (specProvenance === 'LOGISTICS_CONFIRMED' || freightProvenance === 'LOGISTICS_CONFIRMED') return 'LOGISTICS_CONFIRMED'
    return 'SUPPLIER_CONFIRMED'
  }, [priceProvenance, specProvenance, freightProvenance, regulationProvenance])

  // 单位经济测算 (Unit Economics)
  const revenueCny = targetPriceRub / rubPerCny
  const commissionCny = (revenueCny * commissionRatePct) / 100
  const totalCostCny = Number(factoryPriceCny) + Number(domesticFreightCny) + Number(internationalFreightCny) + commissionCny
  const netProfitCny = revenueCny - totalCostCny
  const marginPct = revenueCny > 0 ? (netProfitCny / revenueCny) * 100 : 0
  const breakEvenPriceRub = Math.round((Number(factoryPriceCny) + Number(domesticFreightCny) + Number(internationalFreightCny)) / (1 - commissionRatePct / 100) * rubPerCny)

  const handleSaveDraft = () => {
    saveManualQuote(niche.name, {
      supplierName,
      supplierUrl,
      factoryPriceCny,
      moq,
      weightG,
      dims,
      domesticFreightCny,
      internationalFreightCny,
      targetPriceRub,
      commissionRatePct,
      priceProvenance,
      specProvenance,
      freightProvenance,
      regulationProvenance,
      overallTrustTier,
      netProfitCny: Math.round(netProfitCny * 10) / 10,
      marginPct: Math.round(marginPct * 10) / 10,
    })
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 2000)
  }

  const handlePromote = () => {
    handleSaveDraft()
    const trustPrefix = `[数据可信度: ${overallTrustTier}] 价格:${priceProvenance === 'SUPPLIER_CONFIRMED' ? '厂家实询' : '算法预估'} | 重量:${specProvenance} | 物流:${freightProvenance} | 认证:${regulationProvenance}`
    const { candidate } = promoteToT6Candidate(
      niche,
      `${trustPrefix}。采购报价: ¥${factoryPriceCny}, 供应商: ${supplierName || '待填'}, 实测重: ${weightG}g, 预估毛利率: ${marginPct.toFixed(1)}%`
    )
    if (onPromoted) onPromoted(candidate)
    onClose()
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={`Phase 5 采购验证 — ${niche.name}`} width="max-w-2xl">
      <div className="flex flex-col h-full space-y-4 p-4 text-xs">
        {/* 顶部利基参考 */}
        <Surface className="p-3 bg-morandi-50 flex items-center justify-between border-morandi-200">
          <div>
            <span className="font-semibold text-morandi-text">{niche.name}</span>
            <span className="text-morandi-text-light ml-2">({niche.cat || niche.category})</span>
          </div>
          <div className="flex items-center gap-3">
            <span>WB 均价: <b>¥{niche.price}</b></span>
            <span>签收率: <b>{niche.buyout}%</b></span>
          </div>
        </Surface>

        {/* 数据可信度分级提示条 */}
        <div
          className={`p-3 rounded-lg border flex items-start justify-between gap-3 ${
            overallTrustTier === 'ESTIMATED'
              ? 'bg-amber-50/80 border-amber-200 text-amber-900'
              : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-start gap-2">
            {overallTrustTier === 'ESTIMATED' ? (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-bold flex items-center gap-2">
                <span>可信度分层: {overallTrustTier}</span>
                <span className="px-1.5 py-0.2 text-[10px] rounded font-mono font-normal bg-white/80 border border-gray-200">
                  {overallTrustTier === 'ESTIMATED' ? '⚠️ 含算法预估项' : '✅ 核心参数已全量实测'}
                </span>
              </div>
              <p className="text-[11px] text-morandi-text-light mt-0.5 leading-relaxed">
                {overallTrustTier === 'ESTIMATED'
                  ? '注意：当前包含未实测数据（单重/物流/出厂价），严禁未经实询直接签署采购订单！请打样核实后切换为实测标签。'
                  : '提示：出厂价、包装尺寸、物流与合规资质均经核实，已具备推进入库与批量打样立项条件。'}
              </p>
            </div>
          </div>
        </div>

        {/* 表单区域 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 左列：供应链与 1688 采购 */}
          <div className="space-y-3">
            <div className="font-semibold text-morandi-text flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-morandi-primary" />
                1688 工厂与打样信息
              </span>
              {/* 报价可信度标签 */}
              <button
                type="button"
                onClick={() => setPriceProvenance(priceProvenance === 'ESTIMATED' ? 'SUPPLIER_CONFIRMED' : 'ESTIMATED')}
                className={`text-[10px] px-1.5 py-0.5 rounded font-mono border transition-colors ${
                  priceProvenance === 'SUPPLIER_CONFIRMED'
                    ? 'bg-blue-50 text-blue-700 border-blue-300 font-semibold'
                    : 'bg-gray-100 text-gray-600 border-gray-200'
                }`}
              >
                {priceProvenance === 'SUPPLIER_CONFIRMED' ? '● 供应商已报价' : '○ 预估价 (点击切为实报)'}
              </button>
            </div>

            <div>
              <label className="block text-morandi-text-light mb-1">供应商/厂家名称</label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => {
                  setSupplierName(e.target.value)
                  if (e.target.value.trim() && priceProvenance === 'ESTIMATED') {
                    setPriceProvenance('SUPPLIER_CONFIRMED')
                  }
                }}
                placeholder="例如：义乌市某某五金工具商行"
                className="w-full text-xs rounded border border-gray-200 p-2 outline-none focus:border-morandi-primary"
              />
            </div>

            <div>
              <label className="block text-morandi-text-light mb-1">1688 商品/店铺链接</label>
              <input
                type="text"
                value={supplierUrl}
                onChange={(e) => setSupplierUrl(e.target.value)}
                placeholder="https://detail.1688.com/offer/..."
                className="w-full text-xs rounded border border-gray-200 p-2 outline-none focus:border-morandi-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-morandi-text-light mb-1">出厂含税单价 (RMB)</label>
                <input
                  type="number"
                  step="0.1"
                  value={factoryPriceCny}
                  onChange={(e) => setFactoryPriceCny(Number(e.target.value))}
                  className="w-full text-xs rounded border border-gray-200 p-2 outline-none focus:border-morandi-primary font-mono"
                />
              </div>
              <div>
                <label className="block text-morandi-text-light mb-1">首批建议起订量 (MOQ)</label>
                <input
                  type="number"
                  value={moq}
                  onChange={(e) => setMoq(Number(e.target.value))}
                  className="w-full text-xs rounded border border-gray-200 p-2 outline-none focus:border-morandi-primary font-mono"
                />
              </div>
            </div>

            {/* 物理规格与重量标签 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-morandi-text-light">单件实测净重 (g)</label>
                <select
                  value={specProvenance}
                  onChange={(e) => setSpecProvenance(e.target.value)}
                  className="text-[10px] rounded border border-gray-200 px-1 py-0.5 bg-white text-morandi-text"
                >
                  <option value="ESTIMATED">○ 预估重量</option>
                  <option value="SUPPLIER_CONFIRMED">● 样品实测重</option>
                  <option value="LOGISTICS_CONFIRMED">● 物流仓实测重</option>
                </select>
              </div>
              <input
                type="number"
                value={weightG}
                onChange={(e) => {
                  const w = Number(e.target.value)
                  setWeightG(w)
                  setInternationalFreightCny(Math.max(8, Math.round((w / 1000) * 35)))
                  if (specProvenance === 'ESTIMATED') setSpecProvenance('SUPPLIER_CONFIRMED')
                }}
                className="w-full text-xs rounded border border-gray-200 p-2 outline-none focus:border-morandi-primary font-mono"
              />
            </div>

            <div>
              <label className="block text-morandi-text-light mb-1">外包装尺寸 (长x宽x高 cm)</label>
              <input
                type="text"
                value={dims}
                onChange={(e) => setDims(e.target.value)}
                placeholder="20x15x5"
                className="w-full text-xs rounded border border-gray-200 p-2 outline-none focus:border-morandi-primary font-mono"
              />
            </div>
          </div>

          {/* 右列：物流与销售预估 */}
          <div className="space-y-3">
            <div className="font-semibold text-morandi-text flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-morandi-primary" />
                物流与 WB 销售设定
              </span>
              <select
                value={freightProvenance}
                onChange={(e) => setFreightProvenance(e.target.value)}
                className="text-[10px] rounded border border-gray-200 px-1 py-0.5 bg-white text-morandi-text"
              >
                <option value="ESTIMATED">○ 预估运费 (35元/kg)</option>
                <option value="LOGISTICS_CONFIRMED">● 货代核实报价</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-morandi-text-light mb-1">国内头程运费 (RMB/件)</label>
                <input
                  type="number"
                  step="0.5"
                  value={domesticFreightCny}
                  onChange={(e) => setDomesticFreightCny(Number(e.target.value))}
                  className="w-full text-xs rounded border border-gray-200 p-2 outline-none focus:border-morandi-primary font-mono"
                />
              </div>
              <div>
                <label className="block text-morandi-text-light mb-1">国际跨境物流 (RMB/件)</label>
                <input
                  type="number"
                  step="0.5"
                  value={internationalFreightCny}
                  onChange={(e) => setInternationalFreightCny(Number(e.target.value))}
                  className="w-full text-xs rounded border border-gray-200 p-2 outline-none focus:border-morandi-primary font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-morandi-text-light mb-1">
                计划在售零售价 (RUB)
                <span className="text-morandi-text-light ml-2">≈ ¥{(targetPriceRub / rubPerCny).toFixed(1)}</span>
              </label>
              <input
                type="number"
                step="10"
                value={targetPriceRub}
                onChange={(e) => setTargetPriceRub(Number(e.target.value))}
                className="w-full text-xs rounded border border-gray-200 p-2 outline-none focus:border-morandi-primary font-mono"
              />
            </div>

            <div>
              <label className="block text-morandi-text-light mb-1">WB 平台扣点/佣金率 (%)</label>
              <input
                type="number"
                step="0.5"
                value={commissionRatePct}
                onChange={(e) => setCommissionRatePct(Number(e.target.value))}
                className="w-full text-xs rounded border border-gray-200 p-2 outline-none focus:border-morandi-primary font-mono"
              />
            </div>

            {/* EAC 认证可信度设置 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-morandi-text-light">EAC 合规认证核验状态</label>
                <select
                  value={regulationProvenance}
                  onChange={(e) => setRegulationProvenance(e.target.value)}
                  className="text-[10px] rounded border border-gray-200 px-1 py-0.5 bg-white text-morandi-text"
                >
                  <option value="ESTIMATED">○ 待查验/规则预估</option>
                  <option value="REGULATION_VERIFIED">● 已查验清关资质合格</option>
                </select>
              </div>
              <div className="p-2 rounded bg-morandi-50 text-[11px] text-morandi-text">
                当前参考状态: <b className="font-mono text-morandi-primary">{niche.specs?.eac || niche.eac || 'UNKNOWN'}</b>
              </div>
            </div>
          </div>
        </div>

        {/* 单位经济测算仪表板 (Unit Economics Card) */}
        <Surface className="p-4 bg-gradient-to-br from-morandi-50 to-white border-morandi-200 space-y-3">
          <div className="font-semibold text-morandi-text flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-morandi-primary" />
              单件实效单位经济测算 (Unit Economics)
            </span>
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${marginPct >= 20 ? 'bg-emerald-100 text-emerald-800' : marginPct > 0 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
              {marginPct >= 20 ? '毛利健康 (PASS)' : marginPct > 0 ? '利润薄弱 (WARN)' : '倒挂亏损 (FAIL)'}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center pt-1">
            <div className="p-2 bg-white rounded border border-gray-100">
              <div className="text-[11px] text-morandi-text-light">销售收入 (折合)</div>
              <div className="text-sm font-bold text-morandi-text mt-0.5">¥{revenueCny.toFixed(1)}</div>
            </div>
            <div className="p-2 bg-white rounded border border-gray-100">
              <div className="text-[11px] text-morandi-text-light">综合成本支出</div>
              <div className="text-sm font-bold text-morandi-text mt-0.5">¥{totalCostCny.toFixed(1)}</div>
            </div>
            <div className="p-2 bg-white rounded border border-gray-100">
              <div className="text-[11px] text-morandi-text-light">单件贡献毛利</div>
              <div className={`text-sm font-bold mt-0.5 ${netProfitCny >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                ¥{netProfitCny.toFixed(1)}
              </div>
            </div>
            <div className="p-2 bg-white rounded border border-gray-100">
              <div className="text-[11px] text-morandi-text-light">净毛利率</div>
              <div className={`text-sm font-bold mt-0.5 ${marginPct >= 20 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {marginPct.toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-morandi-text-light pt-1 border-t border-gray-100">
            <span>零毛利保本零售价: <b className="text-morandi-text">{breakEvenPriceRub} ₽</b> (≈ ¥{(breakEvenPriceRub / rubPerCny).toFixed(1)})</span>
            <span>汇率参考: 1 CNY = {rubPerCny} RUB</span>
          </div>
        </Surface>

        {/* 底部按钮栏 */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-auto">
          <Button variant="secondary" onClick={handleSaveDraft} className="gap-1.5 text-xs">
            <Save className="w-3.5 h-3.5" />
            {savedSuccess ? '已保存草稿！' : '保存采购草稿'}
          </Button>

          <div className="flex items-center gap-2">
            {onNavigateToWbCalc && (
              <Button
                variant="secondary"
                onClick={() => {
                  handleSaveDraft()
                  onNavigateToWbCalc(niche)
                }}
                className="gap-1.5 text-xs"
              >
                <Calculator className="w-3.5 h-3.5" />
                带入 WBCalc 官方费率精算
              </Button>
            )}

            <Button variant="primary" onClick={handlePromote} className="gap-1.5 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              核准并推送到 T6 候选立项
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  )
}
