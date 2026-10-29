/**
 * t6/ProductProfileEditor.jsx — SKU 项目商品档案 (Product Profile V1) 编辑器 (TASK 07A-3B)
 * 
 * 核心契约：
 * 1. 纯 Project-scoped Profile 编辑器，仅接收 projectId 与 onChanged。
 * 2. 字段白名单严格限定为 12 个字段，分为 3 组：基础身份、包装物流事实、产品本体。
 * 3. Required Core 仅为 nameZh 与 categoryLeaf。
 * 4. 重量字段（grossWeightG/netWeightG）必须人工核实录入，严禁自动预填。
 * 5. MARKET_VALIDATION 外包装尺寸安全一次性预填（仅当尚未保存时有效）。
 * 6. 显式保存事务，绝无 onChange / onBlur 自动写入 Store。
 * 7. 严禁展示任何采购价、供应商、售价、佣金、利润、Listing 营销文案或合规结论等跨域商业字段。
 */

import { useState, useMemo, useEffect } from 'react'
import {
  Package,
  Layers,
  Truck,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertTriangle,
  Info,
  Scale,
  Barcode,
  Tag,
} from 'lucide-react'
import {
  getProject,
  getSnapshot,
  resolveSnapshotKind,
  updateProjectProduct,
  isProjectProductEmpty,
  buildInitialProjectProductDraft,
} from '../../utils/t6/t6Store.js'
import Surface from '../ui/Surface.jsx'
import Button from '../ui/Button.jsx'
import Badge from '../ui/Badge.jsx'

export default function ProductProfileEditor({ projectId, onChanged }) {
  const [tick, setTick] = useState(0)
  const [notice, setNotice] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // 1. 从 Store 获取实体事实
  const project = useMemo(() => (projectId ? getProject(projectId) : null), [projectId, tick])
  const snapshot = useMemo(() => {
    return project?.source?.creationSnapshotId ? getSnapshot(project.source.creationSnapshotId) : null
  }, [project])
  const snapshotKind = useMemo(() => resolveSnapshotKind(snapshot), [snapshot])

  // 2. 判定当前商品档案是否已有保存事实
  const hasExistingProduct = useMemo(() => {
    return !isProjectProductEmpty(project?.product)
  }, [project])

  // 3. 构建初始表单状态草稿
  const initialDraft = useMemo(() => {
    if (!project) return null
    if (hasExistingProduct) {
      return project.product
    }
    return buildInitialProjectProductDraft({ project, snapshot })
  }, [project, snapshot, hasExistingProduct])

  // 4. 本地表单状态（支持字符串草稿输入，保存前严格 normalize）
  const [formData, setFormData] = useState({
    nameZh: '',
    categoryLeaf: '',
    variantLabel: '',
    nameRu: '',
    brand: '',
    model: '',
    material: '',
    barcode: '',
    packageDimsL: '',
    packageDimsW: '',
    packageDimsH: '',
    grossWeightG: '',
    netWeightG: '',
    productDimsL: '',
    productDimsW: '',
    productDimsH: '',
  })

  // 同步 initialDraft 到本地表单状态
  useEffect(() => {
    if (!initialDraft) return
    setFormData({
      nameZh: initialDraft.nameZh || '',
      categoryLeaf: initialDraft.categoryLeaf || '',
      variantLabel: initialDraft.variantLabel || '',
      nameRu: initialDraft.nameRu || '',
      brand: initialDraft.brand || '',
      model: initialDraft.model || '',
      material: initialDraft.material || '',
      barcode: initialDraft.barcode || '',
      packageDimsL: initialDraft.packageDimsCm ? String(initialDraft.packageDimsCm[0] ?? '') : '',
      packageDimsW: initialDraft.packageDimsCm ? String(initialDraft.packageDimsCm[1] ?? '') : '',
      packageDimsH: initialDraft.packageDimsCm ? String(initialDraft.packageDimsCm[2] ?? '') : '',
      grossWeightG: initialDraft.grossWeightG != null ? String(initialDraft.grossWeightG) : '',
      netWeightG: initialDraft.netWeightG != null ? String(initialDraft.netWeightG) : '',
      productDimsL: initialDraft.productDimsCm ? String(initialDraft.productDimsCm[0] ?? '') : '',
      productDimsW: initialDraft.productDimsCm ? String(initialDraft.productDimsCm[1] ?? '') : '',
      productDimsH: initialDraft.productDimsCm ? String(initialDraft.productDimsCm[2] ?? '') : '',
    })
    setErrorMsg('')
  }, [initialDraft])

  if (!project) {
    return (
      <div className="py-8 text-center text-sm text-workspace-text-tertiary">
        未找到项目数据
      </div>
    )
  }

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errorMsg) setErrorMsg('')
    if (notice) setNotice('')
  }

  // 重置未保存修改
  const handleReset = () => {
    if (!initialDraft) return
    setFormData({
      nameZh: initialDraft.nameZh || '',
      categoryLeaf: initialDraft.categoryLeaf || '',
      variantLabel: initialDraft.variantLabel || '',
      nameRu: initialDraft.nameRu || '',
      brand: initialDraft.brand || '',
      model: initialDraft.model || '',
      material: initialDraft.material || '',
      barcode: initialDraft.barcode || '',
      packageDimsL: initialDraft.packageDimsCm ? String(initialDraft.packageDimsCm[0] ?? '') : '',
      packageDimsW: initialDraft.packageDimsCm ? String(initialDraft.packageDimsCm[1] ?? '') : '',
      packageDimsH: initialDraft.packageDimsCm ? String(initialDraft.packageDimsCm[2] ?? '') : '',
      grossWeightG: initialDraft.grossWeightG != null ? String(initialDraft.grossWeightG) : '',
      netWeightG: initialDraft.netWeightG != null ? String(initialDraft.netWeightG) : '',
      productDimsL: initialDraft.productDimsCm ? String(initialDraft.productDimsCm[0] ?? '') : '',
      productDimsW: initialDraft.productDimsCm ? String(initialDraft.productDimsCm[1] ?? '') : '',
      productDimsH: initialDraft.productDimsCm ? String(initialDraft.productDimsCm[2] ?? '') : '',
    })
    setErrorMsg('')
    setNotice('已恢复到最近保存状态或初始草稿')
  }

  // 显式保存
  const handleSave = () => {
    setErrorMsg('')
    setNotice('')

    // 1. Required Core 校验
    const trimmedNameZh = formData.nameZh.trim()
    const trimmedCategory = formData.categoryLeaf.trim()
    if (!trimmedNameZh) {
      setErrorMsg('请输入商品中文品名 (nameZh)')
      return
    }
    if (!trimmedCategory) {
      setErrorMsg('请输入叶子类目 (categoryLeaf)')
      return
    }

    // 2. 包装尺寸校验与 normalize
    let packageDimsCm = null
    const pL = formData.packageDimsL.trim()
    const pW = formData.packageDimsW.trim()
    const pH = formData.packageDimsH.trim()
    if (pL === '' && pW === '' && pH === '') {
      packageDimsCm = null
    } else if (pL === '' || pW === '' || pH === '') {
      setErrorMsg('外包装尺寸必须完整填写长、宽、高三项（或全部留空）')
      return
    } else {
      const nL = Number(pL)
      const nW = Number(pW)
      const nH = Number(pH)
      if (!Number.isFinite(nL) || nL <= 0 || !Number.isFinite(nW) || nW <= 0 || !Number.isFinite(nH) || nH <= 0) {
        setErrorMsg('外包装尺寸长、宽、高必须是大于 0 的有效正数')
        return
      }
      packageDimsCm = [nL, nW, nH]
    }

    // 3. 裸机尺寸校验与 normalize
    let productDimsCm = null
    const bL = formData.productDimsL.trim()
    const bW = formData.productDimsW.trim()
    const bH = formData.productDimsH.trim()
    if (bL === '' && bW === '' && bH === '') {
      productDimsCm = null
    } else if (bL === '' || bW === '' || bH === '') {
      setErrorMsg('裸机本体尺寸必须完整填写长、宽、高三项（或全部留空）')
      return
    } else {
      const nL = Number(bL)
      const nW = Number(bW)
      const nH = Number(bH)
      if (!Number.isFinite(nL) || nL <= 0 || !Number.isFinite(nW) || nW <= 0 || !Number.isFinite(nH) || nH <= 0) {
        setErrorMsg('裸机本体尺寸长、宽、高必须是大于 0 的有效正数')
        return
      }
      productDimsCm = [nL, nW, nH]
    }

    // 4. 重量校验与 normalize
    let grossWeightG = null
    const gw = formData.grossWeightG.trim()
    if (gw !== '') {
      const nGw = Number(gw)
      if (!Number.isFinite(nGw) || nGw <= 0) {
        setErrorMsg('含包装毛重必须为大于 0 的有效正数（克）')
        return
      }
      grossWeightG = nGw
    }

    let netWeightG = null
    const nw = formData.netWeightG.trim()
    if (nw !== '') {
      const nNw = Number(nw)
      if (!Number.isFinite(nNw) || nNw <= 0) {
        setErrorMsg('裸机净重必须为大于 0 的有效正数（克）')
        return
      }
      netWeightG = nNw
    }

    // 5. 组装 patch 载荷 (严格 12 字段白名单)
    const patch = {
      nameZh: trimmedNameZh,
      categoryLeaf: trimmedCategory,
      packageDimsCm,
      grossWeightG,
      netWeightG,
      productDimsCm,
      variantLabel: formData.variantLabel.trim(),
      nameRu: formData.nameRu.trim(),
      brand: formData.brand.trim(),
      model: formData.model.trim(),
      material: formData.material.trim(),
      barcode: formData.barcode.trim(),
    }

    try {
      setIsSaving(true)
      updateProjectProduct(projectId, patch, { by: 'user' })
      setNotice('商品档案保存成功，已记入决策日志')
      setTick((t) => t + 1)
      if (onChanged) onChanged('商品档案已更新')
    } catch (err) {
      setErrorMsg(err.message || '保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 顶部标题与状态栏 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-workspace-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-workspace-text">商品档案 (Product Profile)</h2>
            <Badge tone={hasExistingProduct ? 'success' : 'warning'}>
              {hasExistingProduct ? '已建档' : '未建档草稿'}
            </Badge>
            <Badge tone="neutral">单 SKU 项目档案</Badge>
          </div>
          <p className="mt-1 text-xs text-workspace-text-tertiary">
            当前项目的官方 SKU 基础定义。独立于立项快照持续维护，变更将写入项目审计日志。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleReset} disabled={isSaving}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> 重置未保存修改
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={isSaving}>
            <Save className="mr-1.5 h-3.5 w-3.5" /> 保存商品档案
          </Button>
        </div>
      </div>

      {/* 提示信息 / 状态反馈 */}
      {notice && (
        <div className="flex items-center gap-2 rounded border border-workspace-success/30 bg-workspace-success/10 px-3 py-2 text-xs text-workspace-success">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 rounded border border-workspace-danger/30 bg-workspace-danger/10 px-3 py-2 text-xs text-workspace-danger">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 首次初始化草稿提醒 Banner */}
      {!hasExistingProduct && (
        <div className="rounded-lg border border-workspace-border-strong bg-workspace-surface-subtle p-3.5 text-xs text-workspace-text-secondary space-y-1">
          <div className="flex items-center gap-1.5 font-medium text-workspace-text">
            <Info className="h-4 w-4 text-workspace-primary" />
            <span>当前尚未建立商品档案，以下内容仅从立项证据安全预填为草稿，保存后才写入项目。</span>
          </div>
          {snapshotKind === 'SCORING' && (
            <p className="pl-5.5 text-workspace-text-tertiary">
              * 评分数据中的重量和尺寸口径未确认，未自动带入，待人工核实确认。
            </p>
          )}
          {snapshotKind === 'MARKET_VALIDATION' && (
            <p className="pl-5.5 text-workspace-text-tertiary">
              * 已安全带入立项时外包装尺寸；重量来源口径存在冲突，未自动带入净重/毛重，待人工核实确认。
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* === A. 基础身份 (Core Identity) === */}
        <Surface className="p-4 space-y-4">
          <div className="flex items-center gap-2 border-b border-workspace-border pb-2.5">
            <Tag className="h-4 w-4 text-workspace-primary" />
            <h3 className="text-sm font-semibold text-workspace-text">基础身份与通用属性</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="mb-1 block font-medium text-workspace-text">
                中文标准品名 <span className="text-workspace-danger">*</span>
              </label>
              <input
                type="text"
                value={formData.nameZh}
                onChange={(e) => handleChange('nameZh', e.target.value)}
                placeholder="例如：高压发泡胶枪"
                className="w-full rounded border border-workspace-border bg-workspace-surface px-2.5 py-1.5 text-xs text-workspace-text placeholder-workspace-text-tertiary focus:border-workspace-primary focus:outline-none"
              />
              <span className="mt-0.5 block text-[11px] text-workspace-text-tertiary">
                内部官方中文标准名，与项目管理标题区分维护。
              </span>
            </div>

            <div>
              <label className="mb-1 block font-medium text-workspace-text">
                叶子类目 <span className="text-workspace-danger">*</span>
              </label>
              <input
                type="text"
                value={formData.categoryLeaf}
                onChange={(e) => handleChange('categoryLeaf', e.target.value)}
                placeholder="例如：发泡胶枪"
                className="w-full rounded border border-workspace-border bg-workspace-surface px-2.5 py-1.5 text-xs text-workspace-text placeholder-workspace-text-tertiary focus:border-workspace-primary focus:outline-none"
              />
              <span className="mt-0.5 block text-[11px] text-workspace-text-tertiary">
                业务标准叶子类目归属。
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-workspace-text">变体/规格说明</label>
                <input
                  type="text"
                  value={formData.variantLabel}
                  onChange={(e) => handleChange('variantLabel', e.target.value)}
                  placeholder="例如：黑色加强版"
                  className="w-full rounded border border-workspace-border bg-workspace-surface px-2.5 py-1.5 text-xs text-workspace-text placeholder-workspace-text-tertiary focus:border-workspace-primary focus:outline-none"
                />
                <span className="mt-0.5 block text-[11px] text-workspace-text-tertiary">
                  人工录入变体规格，严禁自动推断。
                </span>
              </div>

              <div>
                <label className="mb-1 block font-medium text-workspace-text">俄语参考品名</label>
                <input
                  type="text"
                  value={formData.nameRu}
                  onChange={(e) => handleChange('nameRu', e.target.value)}
                  placeholder="例如：Пистолет для пены"
                  className="w-full rounded border border-workspace-border bg-workspace-surface px-2.5 py-1.5 text-xs text-workspace-text placeholder-workspace-text-tertiary focus:border-workspace-primary focus:outline-none"
                />
                <span className="mt-0.5 block text-[11px] text-workspace-text-tertiary">
                  俄语基础商品名称（非营销文案）。
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-workspace-text">品牌 (Brand)</label>
                <input
                  type="text"
                  value={formData.brand}
                  onChange={(e) => handleChange('brand', e.target.value)}
                  placeholder="例如：PINGPREM"
                  className="w-full rounded border border-workspace-border bg-workspace-surface px-2.5 py-1.5 text-xs text-workspace-text placeholder-workspace-text-tertiary focus:border-workspace-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-workspace-text">型号/款号 (Model)</label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => handleChange('model', e.target.value)}
                  placeholder="例如：PP-FG01"
                  className="w-full rounded border border-workspace-border bg-workspace-surface px-2.5 py-1.5 text-xs text-workspace-text placeholder-workspace-text-tertiary focus:border-workspace-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-workspace-text">主要材质 (Material)</label>
                <input
                  type="text"
                  value={formData.material}
                  onChange={(e) => handleChange('material', e.target.value)}
                  placeholder="例如：铝合金 + 铜嘴"
                  className="w-full rounded border border-workspace-border bg-workspace-surface px-2.5 py-1.5 text-xs text-workspace-text placeholder-workspace-text-tertiary focus:border-workspace-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-workspace-text">商品条码 (Barcode/EAN)</label>
                <input
                  type="text"
                  value={formData.barcode}
                  onChange={(e) => handleChange('barcode', e.target.value)}
                  placeholder="例如：6901234567890"
                  className="w-full rounded border border-workspace-border bg-workspace-surface px-2.5 py-1.5 text-xs text-workspace-text placeholder-workspace-text-tertiary focus:border-workspace-primary focus:outline-none"
                />
              </div>
            </div>
          </div>
        </Surface>

        {/* === B. 包装与物流规格 (Packaging & Logistics) === */}
        <div className="space-y-6">
          <Surface className="p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-workspace-border pb-2.5">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-workspace-primary" />
                <h3 className="text-sm font-semibold text-workspace-text">包装与物流事实</h3>
              </div>
              {!hasExistingProduct && snapshotKind === 'MARKET_VALIDATION' && initialDraft?.packageDimsCm && (
                <Badge tone="info">来自立项时外包装尺寸草稿</Badge>
              )}
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-medium text-workspace-text">
                  外包装尺寸 (长 × 宽 × 高，单位：cm)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={formData.packageDimsL}
                    onChange={(e) => handleChange('packageDimsL', e.target.value)}
                    placeholder="长 (L)"
                    className="w-full rounded border border-workspace-border bg-workspace-surface px-2.5 py-1.5 text-xs text-workspace-text placeholder-workspace-text-tertiary focus:border-workspace-primary focus:outline-none"
                  />
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={formData.packageDimsW}
                    onChange={(e) => handleChange('packageDimsW', e.target.value)}
                    placeholder="宽 (W)"
                    className="w-full rounded border border-workspace-border bg-workspace-surface px-2.5 py-1.5 text-xs text-workspace-text placeholder-workspace-text-tertiary focus:border-workspace-primary focus:outline-none"
                  />
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={formData.packageDimsH}
                    onChange={(e) => handleChange('packageDimsH', e.target.value)}
                    placeholder="高 (H)"
                    className="w-full rounded border border-workspace-border bg-workspace-surface px-2.5 py-1.5 text-xs text-workspace-text placeholder-workspace-text-tertiary focus:border-workspace-primary focus:outline-none"
                  />
                </div>
                <span className="mt-0.5 block text-[11px] text-workspace-text-tertiary">
                  用于国际头程与尾程体积重测算。
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-workspace-text">含包装毛重 (g)</label>
                    <span className="text-[11px] text-workspace-warning font-normal">人工确认</span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={formData.grossWeightG}
                    onChange={(e) => handleChange('grossWeightG', e.target.value)}
                    placeholder="例如：450"
                    className="w-full rounded border border-workspace-border bg-workspace-surface px-2.5 py-1.5 text-xs text-workspace-text placeholder-workspace-text-tertiary focus:border-workspace-primary focus:outline-none"
                  />
                  <span className="mt-0.5 block text-[11px] text-workspace-text-tertiary">
                    用于计算国际运费实重计费档位。
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-workspace-text">裸机净重 (g)</label>
                    <span className="text-[11px] text-workspace-warning font-normal">人工确认</span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={formData.netWeightG}
                    onChange={(e) => handleChange('netWeightG', e.target.value)}
                    placeholder="例如：320"
                    className="w-full rounded border border-workspace-border bg-workspace-surface px-2.5 py-1.5 text-xs text-workspace-text placeholder-workspace-text-tertiary focus:border-workspace-primary focus:outline-none"
                  />
                  <span className="mt-0.5 block text-[11px] text-workspace-text-tertiary">
                    商品裸机本体重量（展示参数）。
                  </span>
                </div>
              </div>
            </div>
          </Surface>

          {/* === C. 产品本体规格 (Physical Product) === */}
          <Surface className="p-4 space-y-4">
            <div className="flex items-center gap-2 border-b border-workspace-border pb-2.5">
              <Package className="h-4 w-4 text-workspace-primary" />
              <h3 className="text-sm font-semibold text-workspace-text">产品本体规格</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-medium text-workspace-text">
                  裸机本体尺寸 (长 × 宽 × 高，单位：cm)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={formData.productDimsL}
                    onChange={(e) => handleChange('productDimsL', e.target.value)}
                    placeholder="长 (L)"
                    className="w-full rounded border border-workspace-border bg-workspace-surface px-2.5 py-1.5 text-xs text-workspace-text placeholder-workspace-text-tertiary focus:border-workspace-primary focus:outline-none"
                  />
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={formData.productDimsW}
                    onChange={(e) => handleChange('productDimsW', e.target.value)}
                    placeholder="宽 (W)"
                    className="w-full rounded border border-workspace-border bg-workspace-surface px-2.5 py-1.5 text-xs text-workspace-text placeholder-workspace-text-tertiary focus:border-workspace-primary focus:outline-none"
                  />
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={formData.productDimsH}
                    onChange={(e) => handleChange('productDimsH', e.target.value)}
                    placeholder="高 (H)"
                    className="w-full rounded border border-workspace-border bg-workspace-surface px-2.5 py-1.5 text-xs text-workspace-text placeholder-workspace-text-tertiary focus:border-workspace-primary focus:outline-none"
                  />
                </div>
                <span className="mt-0.5 block text-[11px] text-workspace-text-tertiary">
                  用于产品详情页规格参数展示，非物流计费依据。
                </span>
              </div>
            </div>
          </Surface>
        </div>
      </div>
    </div>
  )
}
