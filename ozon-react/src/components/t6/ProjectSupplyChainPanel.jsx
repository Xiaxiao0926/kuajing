/**
 * t6/ProjectSupplyChainPanel.jsx — SKU 项目 T7 供应链管理工作台
 * 
 * 核心职责：
 * 1. 供应商管理：项目级供应商列表、新增、基础字段修改（name, contact, notes）。无删除。
 * 2. 报价版本树：按供应商查看不可变报价版本（v1, v2...）、新增报价版本（Store 自动自增版本）。无编辑/删除。
 * 3. 样品打样跟踪：创建样品记录（初始必为 ordered）、按 Store 状态机前向推进（ordered → arrived → tested → approved|rejected）。终态不可变。
 * 4. 正式供应方案：选定正式供应方案（setProjectSupply）、二次确认清除（clearProjectSupply）。
 * 
 * 契约铁律：
 * - 纯 Project-scoped，严禁直接读写 localStorage/IndexedDB/fetch，全部走 t6Store public API。
 * - 绝不引入 Phase 5 采购询价逻辑，保持 NO_BRIDGE 契约。
 * - 绝不伪造系统字段，version/id/createdAt 严禁由前台生成或伪造。
 */
import { useMemo, useState } from 'react'
import {
  Factory, Plus, Pencil, CheckCircle2, AlertTriangle, XCircle, Clock,
  Truck, FileText, ChevronRight, ShieldCheck, Layers, ArrowRight, RotateCcw
} from 'lucide-react'
import {
  getProject, getSupplier, getProjectSuppliers, createSupplier, updateSupplier,
  getSupplierQuote, getSupplierQuotes, createSupplierQuote,
  getProjectSamples, createSampleRecord, updateSampleRecord,
  setProjectSupply, clearProjectSupply
} from '../../utils/t6/t6Store.js'
import Surface from '../ui/Surface.jsx'
import Button from '../ui/Button.jsx'
import Badge from '../ui/Badge.jsx'
import EmptyState from '../ui/EmptyState.jsx'

const SAMPLE_STATUS_ZH = {
  ordered: '已下单',
  arrived: '已到样',
  tested: '已测试',
  approved: '已通过',
  rejected: '已淘汰',
}

const SAMPLE_STATUS_TONE = {
  ordered: 'neutral',
  arrived: 'info',
  tested: 'warning',
  approved: 'success',
  rejected: 'danger',
}

export default function ProjectSupplyChainPanel({ projectId, onChanged }) {
  const [tick, setTick] = useState(0)
  const [selectedSupplierId, setSelectedSupplierId] = useState(null)
  const [notice, setNotice] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // 供应商表单状态
  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [supplierFormData, setSupplierFormData] = useState({ name: '', contact: '', notes: '' })
  const [editingSupplierId, setEditingSupplierId] = useState(null)
  const [editSupplierData, setEditSupplierData] = useState({ name: '', contact: '', notes: '' })

  // 报价表单状态
  const [showQuoteForm, setShowQuoteForm] = useState(false)
  const [quoteFormData, setQuoteFormData] = useState({
    unitPriceCny: '',
    currency: 'CNY',
    moq: '0',
    exw: false,
    fob: false,
    packagingSpec: '',
    toolingFeeCny: '',
    sampleFeeCny: '',
    leadTimeDays: '0',
    paymentTerms: '',
    remark: '',
  })

  // 打样表单状态
  const [showSampleForm, setShowSampleForm] = useState(false)
  const [sampleFormData, setSampleFormData] = useState({
    supplierId: '',
    quoteId: '',
    trackNo: '',
    notes: '',
  })

  // 打样流转中的输入状态
  const [testingSampleId, setTestingSampleId] = useState(null)
  const [testResultInput, setTestResultInput] = useState('')

  // 清除供应方案二次确认状态
  const [confirmClearSupply, setConfirmClearSupply] = useState(false)

  // 实时从 Store 读取数据
  const project = useMemo(() => { void tick; return projectId ? getProject(projectId) : null }, [projectId, tick])
  const suppliers = useMemo(() => { void tick; return projectId ? getProjectSuppliers(projectId) : [] }, [projectId, tick])
  const samples = useMemo(() => { void tick; return projectId ? getProjectSamples(projectId) : [] }, [projectId, tick])

  // 自动设置选中的供应商
  const activeSupplierId = useMemo(() => {
    if (selectedSupplierId && suppliers.some(s => s.id === selectedSupplierId)) {
      return selectedSupplierId
    }
    if (project?.supply?.supplierId && suppliers.some(s => s.id === project.supply.supplierId)) {
      return project.supply.supplierId
    }
    return suppliers[0]?.id || null
  }, [selectedSupplierId, suppliers, project])

  const selectedSupplier = useMemo(() => {
    return suppliers.find(s => s.id === activeSupplierId) || null
  }, [suppliers, activeSupplierId])

  const quotes = useMemo(() => {
    void tick
    if (!activeSupplierId) return []
    return getSupplierQuotes(activeSupplierId).sort((a, b) => (b.version || 0) - (a.version || 0))
  }, [activeSupplierId, tick])

  const supply = project?.supply ?? null
  const supplySupplier = useMemo(() => supply ? getSupplier(supply.supplierId) : null, [supply, tick])
  const supplyQuote = useMemo(() => supply ? getSupplierQuote(supply.quoteId) : null, [supply, tick])

  const refresh = (msg = '', err = '') => {
    setNotice(msg)
    setErrorMsg(err)
    setTick(t => t + 1)
    if (onChanged) onChanged(msg)
  }

  // --- 供应商动作 ---
  const handleCreateSupplier = (e) => {
    e.preventDefault()
    if (!supplierFormData.name.trim()) {
      setErrorMsg('供应商名称必填')
      return
    }
    try {
      const created = createSupplier({
        projectId,
        name: supplierFormData.name.trim(),
        contact: supplierFormData.contact.trim(),
        notes: supplierFormData.notes.trim(),
      })
      setSupplierFormData({ name: '', contact: '', notes: '' })
      setShowSupplierForm(false)
      setSelectedSupplierId(created.id)
      refresh(`新增供应商「${created.name}」成功`)
    } catch (err) {
      setErrorMsg(err.message || String(err))
    }
  }

  const handleStartEditSupplier = (s) => {
    setEditingSupplierId(s.id)
    setEditSupplierData({ name: s.name || '', contact: s.contact || '', notes: s.notes || '' })
  }

  const handleUpdateSupplier = (id) => {
    if (!editSupplierData.name.trim()) {
      setErrorMsg('供应商名称必填')
      return
    }
    try {
      const updated = updateSupplier(id, {
        name: editSupplierData.name.trim(),
        contact: editSupplierData.contact.trim(),
        notes: editSupplierData.notes.trim(),
      })
      setEditingSupplierId(null)
      refresh(`供应商「${updated.name}」信息已更新`)
    } catch (err) {
      setErrorMsg(err.message || String(err))
    }
  }

  // --- 报价版本动作 ---
  const handleCreateQuote = (e) => {
    e.preventDefault()
    if (!activeSupplierId) {
      setErrorMsg('请先选择供应商')
      return
    }
    const unitPrice = Number(quoteFormData.unitPriceCny)
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setErrorMsg('报价单价必须为非负有效数值')
      return
    }
    try {
      const created = createSupplierQuote({
        supplierId: activeSupplierId,
        unitPriceCny: unitPrice,
        currency: quoteFormData.currency || 'CNY',
        moq: quoteFormData.moq === '' ? 0 : Number(quoteFormData.moq),
        exw: Boolean(quoteFormData.exw),
        fob: Boolean(quoteFormData.fob),
        packagingSpec: quoteFormData.packagingSpec.trim(),
        toolingFeeCny: quoteFormData.toolingFeeCny === '' ? null : Number(quoteFormData.toolingFeeCny),
        sampleFeeCny: quoteFormData.sampleFeeCny === '' ? null : Number(quoteFormData.sampleFeeCny),
        leadTimeDays: quoteFormData.leadTimeDays === '' ? 0 : Number(quoteFormData.leadTimeDays),
        paymentTerms: quoteFormData.paymentTerms.trim(),
        remark: quoteFormData.remark.trim(),
      })
      setShowQuoteForm(false)
      setQuoteFormData({
        unitPriceCny: '', currency: 'CNY', moq: '0', exw: false, fob: false,
        packagingSpec: '', toolingFeeCny: '', sampleFeeCny: '', leadTimeDays: '0',
        paymentTerms: '', remark: '',
      })
      refresh(`报价版本 v${created.version} 添加成功`)
    } catch (err) {
      setErrorMsg(err.message || String(err))
    }
  }

  // --- 正式供应方案动作 ---
  const handleSetSupply = (supplierId, quoteId, note = '') => {
    try {
      setProjectSupply(projectId, { supplierId, quoteId, note })
      setConfirmClearSupply(false)
      refresh('正式供应方案已更新')
    } catch (err) {
      setErrorMsg(err.message || String(err))
    }
  }

  const handleClearSupply = () => {
    try {
      clearProjectSupply(projectId)
      setConfirmClearSupply(false)
      refresh('已清除正式供应方案')
    } catch (err) {
      setErrorMsg(err.message || String(err))
    }
  }

  // --- 打样记录动作 ---
  const handleOpenSampleModal = (prefSupplierId = '', prefQuoteId = '') => {
    setSampleFormData({
      supplierId: prefSupplierId || activeSupplierId || (suppliers[0]?.id || ''),
      quoteId: prefQuoteId || '',
      trackNo: '',
      notes: '',
    })
    setShowSampleForm(true)
  }

  const handleCreateSample = (e) => {
    e.preventDefault()
    if (!sampleFormData.supplierId) {
      setErrorMsg('请选择打样供应商')
      return
    }
    try {
      const created = createSampleRecord({
        projectId,
        supplierId: sampleFormData.supplierId,
        quoteId: sampleFormData.quoteId || null,
        status: 'ordered',
        trackNo: sampleFormData.trackNo.trim(),
        notes: sampleFormData.notes.trim(),
      })
      setShowSampleForm(false)
      setSampleFormData({ supplierId: '', quoteId: '', trackNo: '', notes: '' })
      refresh('打样记录已创建')
    } catch (err) {
      setErrorMsg(err.message || String(err))
    }
  }

  const handleAdvanceSampleStatus = (sampleId, targetStatus, patch = {}) => {
    try {
      updateSampleRecord(sampleId, { status: targetStatus, ...patch })
      setTestingSampleId(null)
      setTestResultInput('')
      refresh(`样品状态推进为 ${SAMPLE_STATUS_ZH[targetStatus] || targetStatus}`)
    } catch (err) {
      setErrorMsg(err.message || String(err))
    }
  }

  return (
    <div className="space-y-6">
      {/* 提示与错误通知 */}
      {notice && (
        <div className="flex items-center justify-between rounded-md bg-workspace-success-soft p-3 text-xs text-workspace-success">
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> {notice}</span>
          <button type="button" onClick={() => setNotice('')} className="text-workspace-text-tertiary hover:text-workspace-text">✕</button>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center justify-between rounded-md bg-workspace-danger-soft p-3 text-xs text-workspace-danger">
          <span className="flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> {errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg('')} className="text-workspace-text-tertiary hover:text-workspace-text">✕</button>
        </div>
      )}

      {/* 1. 当前正式供应方案 (Active Supply Plan) */}
      <Surface className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-workspace-border pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-workspace-primary" />
            <h3 className="text-sm font-semibold text-workspace-text">正式供应方案 (Active Supply Plan)</h3>
          </div>
          {supply && (
            <div>
              {!confirmClearSupply ? (
                <Button variant="ghost" size="sm" onClick={() => setConfirmClearSupply(true)}>
                  清除供应方案
                </Button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-workspace-danger font-medium">确认清除？</span>
                  <Button variant="danger" size="sm" onClick={handleClearSupply}>确认清除</Button>
                  <Button variant="secondary" size="sm" onClick={() => setConfirmClearSupply(false)}>取消</Button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="pt-3">
          {!supply ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-workspace-border py-4 text-center">
              <span className="text-xs font-medium text-workspace-text-secondary">尚未确定正式供应方案</span>
              <p className="mt-1 text-xs text-workspace-text-tertiary">
                请在下方选择或新增供应商及其报价版本，点击「设为正式方案」锁定采购基准。
              </p>
            </div>
          ) : (
            <div className="grid gap-4 rounded-lg bg-workspace-surface-subtle p-3 text-xs sm:grid-cols-2 md:grid-cols-4">
              <div>
                <span className="text-workspace-text-tertiary">正式供应商</span>
                <div className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-workspace-text">
                  <Factory className="h-3.5 w-3.5 text-workspace-text-secondary" />
                  {supplySupplier?.name || supply.supplierId}
                </div>
              </div>
              <div>
                <span className="text-workspace-text-tertiary">选定报价版本</span>
                <div className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-workspace-text">
                  <Badge tone="primary">v{supplyQuote?.version ?? '—'}</Badge>
                  <span className="text-workspace-success">¥{supplyQuote?.unitPriceCny ?? '—'}</span>
                  <span className="text-workspace-text-tertiary">({supplyQuote?.currency ?? 'CNY'})</span>
                </div>
              </div>
              <div>
                <span className="text-workspace-text-tertiary">条款与交期</span>
                <div className="mt-1 text-[13px] text-workspace-text">
                  MOQ: <b>{supplyQuote?.moq ?? 0}</b> 件 · 交期: <b>{supplyQuote?.leadTimeDays ?? 0}</b> 天
                </div>
              </div>
              <div>
                <span className="text-workspace-text-tertiary">选定时间与操作人</span>
                <div className="mt-1 text-xs text-workspace-text-secondary">
                  {new Date(supply.selectedAt).toLocaleString('zh-CN')} · {supply.selectedBy || 'user'}
                </div>
                {supply.note && <div className="mt-0.5 text-xs text-workspace-text-tertiary">备注: {supply.note}</div>}
              </div>
            </div>
          )}
        </div>
      </Surface>

      {/* 2. 供应商与报价版本管理 (Suppliers & Quote Versions) */}
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* 左列：供应商列表 */}
        <Surface className="p-4">
          <div className="mb-3 flex items-center justify-between border-b border-workspace-border pb-2.5">
            <div className="flex items-center gap-1.5">
              <Factory className="h-4 w-4 text-workspace-text-secondary" />
              <h3 className="text-sm font-semibold text-workspace-text">项目供应商</h3>
              <span className="text-xs text-workspace-text-tertiary">({suppliers.length})</span>
            </div>
            {!showSupplierForm && (
              <Button variant="primary" size="sm" onClick={() => { setShowSupplierForm(true); setEditingSupplierId(null); }}>
                <Plus className="h-3 w-3" /> 新增
              </Button>
            )}
          </div>

          {/* 新增供应商表单 */}
          {showSupplierForm && (
            <form onSubmit={handleCreateSupplier} className="mb-3 space-y-2 rounded-lg border border-workspace-primary/30 bg-workspace-surface-subtle p-3 text-xs">
              <div className="font-semibold text-workspace-text">新增供应商</div>
              <div>
                <label className="block text-workspace-text-secondary">供应商名称 *</label>
                <input
                  type="text"
                  value={supplierFormData.name}
                  onChange={(e) => setSupplierFormData(p => ({ ...p, name: e.target.value }))}
                  placeholder="例如：揭阳市某某五金塑料厂"
                  className="mt-1 h-7 w-full rounded border border-workspace-border bg-workspace-surface px-2 text-xs"
                  required
                />
              </div>
              <div>
                <label className="block text-workspace-text-secondary">联系方式</label>
                <input
                  type="text"
                  value={supplierFormData.contact}
                  onChange={(e) => setSupplierFormData(p => ({ ...p, contact: e.target.value }))}
                  placeholder="电话 / 微信 / 联系人"
                  className="mt-1 h-7 w-full rounded border border-workspace-border bg-workspace-surface px-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-workspace-text-secondary">备注</label>
                <textarea
                  value={supplierFormData.notes}
                  onChange={(e) => setSupplierFormData(p => ({ ...p, notes: e.target.value }))}
                  placeholder="主营类目、打样历史或信誉评价"
                  className="mt-1 h-12 w-full rounded border border-workspace-border bg-workspace-surface p-1 text-xs"
                />
              </div>
              <div className="flex justify-end gap-1.5 pt-1">
                <Button variant="secondary" size="sm" onClick={() => setShowSupplierForm(false)}>取消</Button>
                <Button variant="primary" size="sm" type="submit">保存供应商</Button>
              </div>
            </form>
          )}

          {/* 供应商列表 */}
          {suppliers.length === 0 ? (
            <div className="py-8 text-center text-xs text-workspace-text-tertiary">
              暂无供应商，点击上方「新增」录入
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-[500px]">
              {suppliers.map((sup) => {
                const isSelected = activeSupplierId === sup.id
                const isFormal = supply?.supplierId === sup.id
                const isEditing = editingSupplierId === sup.id
                const quoteCount = sup.quotes?.length ?? 0
                const sampleCount = samples.filter(sm => sm.supplierId === sup.id).length

                if (isEditing) {
                  return (
                    <div key={sup.id} className="rounded-lg border border-workspace-primary p-2.5 text-xs bg-workspace-surface space-y-2">
                      <div className="font-medium text-workspace-text">编辑供应商</div>
                      <input
                        type="text"
                        value={editSupplierData.name}
                        onChange={(e) => setEditSupplierData(p => ({ ...p, name: e.target.value }))}
                        className="h-7 w-full rounded border border-workspace-border px-2 text-xs"
                        placeholder="供应商名称"
                      />
                      <input
                        type="text"
                        value={editSupplierData.contact}
                        onChange={(e) => setEditSupplierData(p => ({ ...p, contact: e.target.value }))}
                        className="h-7 w-full rounded border border-workspace-border px-2 text-xs"
                        placeholder="联系方式"
                      />
                      <textarea
                        value={editSupplierData.notes}
                        onChange={(e) => setEditSupplierData(p => ({ ...p, notes: e.target.value }))}
                        className="h-12 w-full rounded border border-workspace-border p-1 text-xs"
                        placeholder="备注"
                      />
                      <div className="flex justify-end gap-1.5">
                        <Button variant="secondary" size="sm" onClick={() => setEditingSupplierId(null)}>取消</Button>
                        <Button variant="primary" size="sm" onClick={() => handleUpdateSupplier(sup.id)}>保存</Button>
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={sup.id}
                    onClick={() => setSelectedSupplierId(sup.id)}
                    className={`cursor-pointer rounded-lg border p-3 transition-all ${
                      isSelected
                        ? 'border-workspace-primary bg-workspace-primary-soft/20 shadow-sm'
                        : 'border-workspace-border hover:border-workspace-border-strong hover:bg-workspace-surface-subtle'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[13px] font-semibold text-workspace-text">{sup.name}</span>
                        {isFormal && <Badge tone="success">正式方案</Badge>}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleStartEditSupplier(sup); }}
                        className="text-workspace-text-tertiary hover:text-workspace-primary"
                        title="编辑基础信息"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-workspace-text-secondary">
                      <span>联系方式: <b>{sup.contact || '—'}</b></span>
                    </div>

                    {sup.notes && (
                      <p className="mt-1 line-clamp-2 text-xs text-workspace-text-tertiary">
                        {sup.notes}
                      </p>
                    )}

                    <div className="mt-2.5 flex items-center justify-between border-t border-workspace-border pt-2 text-[11px] text-workspace-text-tertiary">
                      <span>报价: <b>{quoteCount}</b> 版 · 样品: <b>{sampleCount}</b> 个</span>
                      <span className="flex items-center text-workspace-primary font-medium">
                        报价详情 <ChevronRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Surface>

        {/* 右列：当前选中供应商的报价版本树 */}
        <Surface className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-workspace-border pb-2.5">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-workspace-text-secondary" />
              <h3 className="text-sm font-semibold text-workspace-text">
                {selectedSupplier ? `「${selectedSupplier.name}」报价版本树` : '供应商报价版本'}
              </h3>
              {quotes.length > 0 && <span className="text-xs text-workspace-text-tertiary">({quotes.length} 个版本)</span>}
            </div>
            {selectedSupplier && !showQuoteForm && (
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => handleOpenSampleModal(selectedSupplier.id)}>
                  发起打样
                </Button>
                <Button variant="primary" size="sm" onClick={() => setShowQuoteForm(true)}>
                  <Plus className="h-3 w-3" /> 新增报价版本
                </Button>
              </div>
            )}
          </div>

          {!selectedSupplier ? (
            <div className="py-12 text-center text-xs text-workspace-text-tertiary">
              请从左侧选择一个供应商以查看或追加不可变报价版本
            </div>
          ) : (
            <div>
              {/* 新增报价版本表单 */}
              {showQuoteForm && (
                <form onSubmit={handleCreateQuote} className="mb-4 rounded-lg border border-workspace-primary/40 bg-workspace-surface-subtle p-3.5 text-xs space-y-3">
                  <div className="flex items-center justify-between font-semibold text-workspace-text">
                    <span>录入新报价版本（版本号由 Store 自动追加）</span>
                    <span className="text-[11px] font-normal text-workspace-text-tertiary">已有报价不可覆盖或修改</span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                    <div>
                      <label className="block text-workspace-text-secondary">报价单价 *</label>
                      <div className="mt-1 flex items-center">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={quoteFormData.unitPriceCny}
                          onChange={(e) => setQuoteFormData(p => ({ ...p, unitPriceCny: e.target.value }))}
                          placeholder="例如：35.5"
                          className="h-7 w-full rounded-l border border-workspace-border bg-workspace-surface px-2 text-xs"
                          required
                        />
                        <select
                          value={quoteFormData.currency}
                          onChange={(e) => setQuoteFormData(p => ({ ...p, currency: e.target.value }))}
                          className="h-7 rounded-r border border-l-0 border-workspace-border bg-workspace-surface px-1 text-xs"
                        >
                          <option value="CNY">CNY (¥)</option>
                          <option value="RUB">RUB (₽)</option>
                          <option value="USD">USD ($)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-workspace-text-secondary">最小起订量 (MOQ)</label>
                      <input
                        type="number"
                        min="0"
                        value={quoteFormData.moq}
                        onChange={(e) => setQuoteFormData(p => ({ ...p, moq: e.target.value }))}
                        className="mt-1 h-7 w-full rounded border border-workspace-border bg-workspace-surface px-2 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-workspace-text-secondary">生产交期 (天)</label>
                      <input
                        type="number"
                        min="0"
                        value={quoteFormData.leadTimeDays}
                        onChange={(e) => setQuoteFormData(p => ({ ...p, leadTimeDays: e.target.value }))}
                        className="mt-1 h-7 w-full rounded border border-workspace-border bg-workspace-surface px-2 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-workspace-text-secondary">模具费 (¥)</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={quoteFormData.toolingFeeCny}
                        onChange={(e) => setQuoteFormData(p => ({ ...p, toolingFeeCny: e.target.value }))}
                        placeholder="无则留空"
                        className="mt-1 h-7 w-full rounded border border-workspace-border bg-workspace-surface px-2 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-workspace-text-secondary">样品费 (¥)</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={quoteFormData.sampleFeeCny}
                        onChange={(e) => setQuoteFormData(p => ({ ...p, sampleFeeCny: e.target.value }))}
                        placeholder="无则留空"
                        className="mt-1 h-7 w-full rounded border border-workspace-border bg-workspace-surface px-2 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-workspace-text-secondary">贸易条款</label>
                      <div className="mt-1 flex items-center gap-3 pt-1">
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={quoteFormData.exw}
                            onChange={(e) => setQuoteFormData(p => ({ ...p, exw: e.target.checked }))}
                          /> EXW
                        </label>
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={quoteFormData.fob}
                            onChange={(e) => setQuoteFormData(p => ({ ...p, fob: e.target.checked }))}
                          /> FOB
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-workspace-text-secondary">包装规格说明</label>
                      <input
                        type="text"
                        value={quoteFormData.packagingSpec}
                        onChange={(e) => setQuoteFormData(p => ({ ...p, packagingSpec: e.target.value }))}
                        placeholder="例如：彩盒+气泡袋，一箱40个"
                        className="mt-1 h-7 w-full rounded border border-workspace-border bg-workspace-surface px-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-workspace-text-secondary">付款方式</label>
                      <input
                        type="text"
                        value={quoteFormData.paymentTerms}
                        onChange={(e) => setQuoteFormData(p => ({ ...p, paymentTerms: e.target.value }))}
                        placeholder="例如：30%定金，尾款发货前结清"
                        className="mt-1 h-7 w-full rounded border border-workspace-border bg-workspace-surface px-2 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-workspace-text-secondary">报价备注</label>
                    <textarea
                      value={quoteFormData.remark}
                      onChange={(e) => setQuoteFormData(p => ({ ...p, remark: e.target.value }))}
                      placeholder="价格有效期、原材料涨价约定等"
                      className="mt-1 h-12 w-full rounded border border-workspace-border bg-workspace-surface p-1.5 text-xs"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1 border-t border-workspace-border">
                    <Button variant="secondary" size="sm" onClick={() => setShowQuoteForm(false)}>取消</Button>
                    <Button variant="primary" size="sm" type="submit">保存报价版本</Button>
                  </div>
                </form>
              )}

              {/* 报价列表 */}
              {quotes.length === 0 ? (
                <div className="py-8 text-center text-xs text-workspace-text-tertiary">
                  暂无报价版本，点击「新增报价版本」录入初版报价
                </div>
              ) : (
                <div className="space-y-3 overflow-x-auto">
                  {quotes.map((q) => {
                    const isFormalQuote = supply?.supplierId === selectedSupplier.id && supply?.quoteId === q.id
                    return (
                      <div
                        key={q.id}
                        className={`rounded-lg border p-3.5 text-xs transition-all ${
                          isFormalQuote
                            ? 'border-workspace-success bg-workspace-success-soft/10 shadow-sm'
                            : 'border-workspace-border bg-workspace-surface'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-workspace-border pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-workspace-text">v{q.version}</span>
                            <span className="text-base font-semibold text-workspace-success">¥{q.unitPriceCny}</span>
                            <span className="text-xs text-workspace-text-tertiary">({q.currency})</span>
                            {isFormalQuote && <Badge tone="success">当前正式方案</Badge>}
                          </div>
                          <div className="flex items-center gap-2">
                            {!isFormalQuote ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleSetSupply(selectedSupplier.id, q.id)}
                              >
                                设为正式方案
                              </Button>
                            ) : null}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenSampleModal(selectedSupplier.id, q.id)}
                            >
                              以此报价打样
                            </Button>
                          </div>
                        </div>

                        <div className="mt-2.5 grid gap-2 sm:grid-cols-2 md:grid-cols-4 text-workspace-text-secondary">
                          <div>MOQ: <b className="text-workspace-text">{q.moq ? `${q.moq} 件` : '不限'}</b></div>
                          <div>交期: <b className="text-workspace-text">{q.leadTimeDays ? `${q.leadTimeDays} 天` : '—'}</b></div>
                          <div>条款: <b className="text-workspace-text">{[q.exw && 'EXW', q.fob && 'FOB'].filter(Boolean).join('/') || '—'}</b></div>
                          <div>包装: <span className="text-workspace-text">{q.packagingSpec || '—'}</span></div>
                          <div>模具费: <span className="text-workspace-text">{q.toolingFeeCny != null ? `¥${q.toolingFeeCny}` : '—'}</span></div>
                          <div>样品费: <span className="text-workspace-text">{q.sampleFeeCny != null ? `¥${q.sampleFeeCny}` : '—'}</span></div>
                          <div>付款方式: <span className="text-workspace-text">{q.paymentTerms || '—'}</span></div>
                          <div>录入时间: <span className="text-workspace-text-tertiary">{new Date(q.createdAt).toLocaleDateString('zh-CN')}</span></div>
                        </div>

                        {q.remark && (
                          <div className="mt-2 rounded bg-workspace-surface-subtle p-1.5 text-xs text-workspace-text-tertiary">
                            备注: {q.remark}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </Surface>
      </div>

      {/* 3. 样品打样记录 (Sample Records & State Machine) */}
      <Surface className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-workspace-border pb-2.5">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-workspace-text-secondary" />
            <h3 className="text-sm font-semibold text-workspace-text">打样记录与物理流转</h3>
            <span className="text-xs text-workspace-text-tertiary">({samples.length} 条记录)</span>
          </div>
          {!showSampleForm && suppliers.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => handleOpenSampleModal()}>
              <Plus className="h-3 w-3" /> 新增打样
            </Button>
          )}
        </div>

        {/* 新增打样表单 */}
        {showSampleForm && (
          <form onSubmit={handleCreateSample} className="mb-4 rounded-lg border border-workspace-border bg-workspace-surface-subtle p-3.5 text-xs space-y-3">
            <div className="font-semibold text-workspace-text">创建打样记录（初始状态: ordered 已下单）</div>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              <div>
                <label className="block text-workspace-text-secondary">打样供应商 *</label>
                <select
                  value={sampleFormData.supplierId}
                  onChange={(e) => setSampleFormData(p => ({ ...p, supplierId: e.target.value, quoteId: '' }))}
                  className="mt-1 h-7 w-full rounded border border-workspace-border bg-workspace-surface px-2 text-xs"
                  required
                >
                  <option value="">请选择供应商</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-workspace-text-secondary">关联报价版本（可选）</label>
                <select
                  value={sampleFormData.quoteId}
                  onChange={(e) => setSampleFormData(p => ({ ...p, quoteId: e.target.value }))}
                  className="mt-1 h-7 w-full rounded border border-workspace-border bg-workspace-surface px-2 text-xs"
                  disabled={!sampleFormData.supplierId}
                >
                  <option value="">不关联特定报价</option>
                  {sampleFormData.supplierId && getSupplierQuotes(sampleFormData.supplierId).map(q => (
                    <option key={q.id} value={q.id}>v{q.version} (¥{q.unitPriceCny})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-workspace-text-secondary">快递运单号</label>
                <input
                  type="text"
                  value={sampleFormData.trackNo}
                  onChange={(e) => setSampleFormData(p => ({ ...p, trackNo: e.target.value }))}
                  placeholder="顺丰 / 中通等单号"
                  className="mt-1 h-7 w-full rounded border border-workspace-border bg-workspace-surface px-2 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-workspace-text-secondary">打样要求与规格备注</label>
              <textarea
                value={sampleFormData.notes}
                onChange={(e) => setSampleFormData(p => ({ ...p, notes: e.target.value }))}
                placeholder="材质要求、打样颜色、特殊定制项等"
                className="mt-1 h-12 w-full rounded border border-workspace-border bg-workspace-surface p-1.5 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1 border-t border-workspace-border">
              <Button variant="secondary" size="sm" onClick={() => setShowSampleForm(false)}>取消</Button>
              <Button variant="primary" size="sm" type="submit">下单打样</Button>
            </div>
          </form>
        )}

        {/* 样品列表 */}
        {samples.length === 0 ? (
          <div className="py-8 text-center text-xs text-workspace-text-tertiary">
            暂无打样记录。点击上方「新增打样」跟踪样品物理到货与测试。
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-workspace-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-workspace-surface-subtle text-workspace-text-secondary">
                  <th className="px-3 py-2 text-left font-medium">供应商</th>
                  <th className="px-3 py-2 text-left font-medium">关联报价</th>
                  <th className="px-3 py-2 text-left font-medium">状态</th>
                  <th className="px-3 py-2 text-left font-medium">运单号</th>
                  <th className="px-3 py-2 text-left font-medium">到样时间</th>
                  <th className="px-3 py-2 text-left font-medium">测试结论</th>
                  <th className="px-3 py-2 text-left font-medium">备注</th>
                  <th className="px-3 py-2 text-right font-medium">状态机操作</th>
                </tr>
              </thead>
              <tbody>
                {samples.map((sm) => {
                  const sSupplier = getSupplier(sm.supplierId)
                  const sQuote = sm.quoteId ? getSupplierQuote(sm.quoteId) : null
                  const isTesting = testingSampleId === sm.id

                  return (
                    <tr key={sm.id} className="border-t border-workspace-border hover:bg-workspace-surface-subtle/50">
                      <td className="px-3 py-2 font-medium text-workspace-text">{sSupplier?.name || sm.supplierId}</td>
                      <td className="px-3 py-2 text-workspace-text-secondary">
                        {sQuote ? `v${sQuote.version} (¥${sQuote.unitPriceCny})` : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={SAMPLE_STATUS_TONE[sm.status] || 'neutral'}>
                          {SAMPLE_STATUS_ZH[sm.status] || sm.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 tabular-nums text-workspace-text-secondary">{sm.trackNo || '—'}</td>
                      <td className="px-3 py-2 tabular-nums text-workspace-text-tertiary">
                        {sm.arrivedAt ? new Date(sm.arrivedAt).toLocaleDateString('zh-CN') : '—'}
                      </td>
                      <td className="px-3 py-2 text-workspace-text">
                        {isTesting ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={testResultInput}
                              onChange={(e) => setTestResultInput(e.target.value)}
                              placeholder="录入测试结论"
                              className="h-6 w-32 rounded border border-workspace-border px-1 text-xs"
                            />
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleAdvanceSampleStatus(sm.id, 'tested', { testResult: testResultInput })}
                            >
                              确认
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setTestingSampleId(null)}>取消</Button>
                          </div>
                        ) : (
                          sm.testResult || '—'
                        )}
                      </td>
                      <td className="px-3 py-2 text-workspace-text-tertiary max-w-xs truncate" title={sm.notes}>{sm.notes || '—'}</td>
                      <td className="px-3 py-2 text-right">
                        {sm.status === 'ordered' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleAdvanceSampleStatus(sm.id, 'arrived')}
                          >
                            标记到样
                          </Button>
                        )}
                        {sm.status === 'arrived' && !isTesting && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => { setTestingSampleId(sm.id); setTestResultInput(sm.testResult || ''); }}
                          >
                            完成测试
                          </Button>
                        )}
                        {sm.status === 'tested' && (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="primary"
                              size="sm"
                              className="bg-workspace-success hover:bg-workspace-success"
                              onClick={() => handleAdvanceSampleStatus(sm.id, 'approved')}
                            >
                              通过
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleAdvanceSampleStatus(sm.id, 'rejected')}
                            >
                              淘汰
                            </Button>
                          </div>
                        )}
                        {(sm.status === 'approved' || sm.status === 'rejected') && (
                          <span className="text-xs text-workspace-text-tertiary font-medium">终态冻结</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Surface>
    </div>
  )
}
