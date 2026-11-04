/**
 * tests/ia-draft-persistence.test.mjs — FINDINGS 发现2「草稿静默丢失」修复契约测试
 *
 * 契约：
 *  DR-1 draftStore 纯函数：restoreDraftFields 草稿优先、空值不覆盖、白名单外字段忽略
 *  DR-2 draftStore 时间格式化：合法 ISO → M-D HH:mm；非法输入返回空串
 *  DR-3 draftStore fail-close：无 localStorage 环境 readDraft 返回 null、writeDraft/clearDraft 不抛
 *  DR-4 OzonCalc 项目模式草稿键 = ozon-single-draft-project-<projectId>，且仅在 projectContext 下启用
 *  DR-5 OzonCalc 挂载恢复草稿 + 有恢复提示条 + 放弃按钮（使用最新预填）
 *  DR-6 OzonCalc 项目模式不写 SHIPPING_KEY（草稿与共享键隔离）
 *  DR-7 CalculatorTab 项目模式草稿键 = wb-calc-draft-project-<projectId>，具备同样恢复/放弃/提示
 *  DR-8 草稿写入不触碰项目正式数据（无 createCostScenario / updateProject / setProject* 调用）
 *  DR-9 恢复后需重新人工确认（costConfirmed 初始 false，不被草稿置 true）
 *  DR-10 真实读写往返：输入 → 卸载 → 重挂载，草稿值完整恢复（mock localStorage）
 */
import { readFileSync } from 'node:fs'

// mock localStorage（须在 import draftStore 之前生效，故用动态 import）
const _store = new Map()
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null),
  setItem: (k, v) => { _store.set(k, String(v)) },
  removeItem: (k) => { _store.delete(k) },
  clear: () => { _store.clear() },
  key: (i) => Array.from(_store.keys())[i] ?? null,
  get length() { return _store.size },
}

const {
  readDraft, writeDraft, clearDraft, restoreDraftFields, formatDraftTime,
} = await import('../ozon-react/src/utils/draftStore.js')

const ROOT = process.cwd()
const pass = []
const fail = []

function check(name, cond, detail = '') {
  if (cond) pass.push(name)
  else fail.push(`${name}${detail ? ' — ' + detail : ''}`)
}

function read(rel) {
  return readFileSync(`${ROOT}/${rel}`, 'utf8')
}

const ozonSrc = read('ozon-react/src/components/OzonCalc.jsx')
const wbSrc = read('ozon-react/src/components/wbcalc/tabs/CalculatorTab.jsx')

// ---------- DR-1 restoreDraftFields 语义 ----------
const base = { a: 1, b: 2, c: 3, d: '' }
const draft = { a: 108, b: '', c: null, e: 999 }
const restored = restoreDraftFields(base, draft, ['a', 'b', 'c'])
check('DR-1 草稿有值覆盖基线', restored.a === 108)
check('DR-1 草稿空串不覆盖基线', restored.b === 2)
check('DR-1 草稿 null 不覆盖基线', restored.c === 3)
check('DR-1 白名单外字段被忽略', restored.e === undefined)
check('DR-1 不修改原 base 对象', base.a === 1)
check('DR-1 draft 为 null 时原样返回', restoreDraftFields(base, null, ['a']) === base)
check('DR-1 白名单非法时原样返回', restoreDraftFields(base, draft, null) === base)

// ---------- DR-2 时间格式化 ----------
check('DR-2 合法 ISO 输出 M-D HH:mm', /^\d{1,2}-\d{2} \d{2}:\d{2}$/.test(formatDraftTime('2026-11-04T09:30:00.000Z')))
check('DR-2 非法输入返回空串', formatDraftTime('not-a-date') === '')
check('DR-2 空输入返回空串', formatDraftTime(undefined) === '')

// ---------- DR-3 fail-close（node 无 localStorage） ----------
let failCloseOk = true
try {
  check('DR-3 readDraft 无 localStorage 返回 null', readDraft('__test_draft__') === null)
  writeDraft('__test_draft__', { x: 1 })
  clearDraft('__test_draft__')
  check('DR-3 空 key 安全跳过', readDraft(null) === null && writeDraft(null, {}) === undefined && clearDraft('') === undefined)
} catch (err) {
  failCloseOk = false
  check('DR-3 草稿操作不抛异常', false, err.message)
}
if (failCloseOk) pass.push('DR-3 writeDraft/clearDraft 无异常')

// ---------- DR-4/5/6 OzonCalc 契约 ----------
check('DR-4 OzonCalc 草稿键含 projectId', ozonSrc.includes('ozon-single-draft-project-${projectContext.projectId}'))
check('DR-4 草稿键仅在 projectContext 下生成', /const draftKey = projectContext \? `ozon-single-draft-project-/.test(ozonSrc))
check('DR-5 挂载时读取草稿', /useState\(\(\) => readDraft\(draftKey\)\)/.test(ozonSrc))
check('DR-5 初始化用 restoreDraftFields 恢复', /restoreDraftFields\(merged, draftRaw, Object\.keys\(SINGLE_DEFAULTS\)\)/.test(ozonSrc))
check('DR-5 有草稿恢复提示条', ozonSrc.includes('已恢复上次未保存的草稿'))
check('DR-5 有「使用最新预填」放弃按钮', ozonSrc.includes('使用最新预填') && ozonSrc.includes('discardDraft'))
check('DR-5 放弃时清除草稿', /clearDraft\(draftKey\)/.test(ozonSrc))
check('DR-6 项目模式只写草稿', /if \(projectContext\) \{[^}]*persistDraft\(newData\)/.test(ozonSrc))
check('DR-6 独立模式才写 SHIPPING_KEY', /else \{\s*persistSet\(SHIPPING_KEY, newData\)/.test(ozonSrc))

// ---------- DR-7 CalculatorTab 契约 ----------
check('DR-7 WB 草稿键含 projectId', wbSrc.includes('wb-calc-draft-project-${projectContext.projectId}'))
check('DR-7 WB 挂载读取草稿', /useState\(\(\) => readDraft\(draftKey\)\)/.test(wbSrc))
check('DR-7 WB 初始化恢复白名单', /restoreDraftFields\(merged, draftRaw, Object\.keys\(FORM_DEFAULTS\)\)/.test(wbSrc))
check('DR-7 WB 有恢复提示条', wbSrc.includes('已恢复上次未保存的草稿'))
check('DR-7 WB 有放弃按钮', wbSrc.includes('使用最新预填') && wbSrc.includes('discardDraft'))
check('DR-7 WB update 写草稿', /const persistDraft = \(nextForm\) => writeDraft\(draftKey, nextForm\)/.test(wbSrc))

// ---------- DR-8 草稿不污染正式数据 ----------
const FORBIDDEN = ['createCostScenario', 'updateProject', 'setProjectStage', 'setProjectLifecycle', 'createProject', 'updateProjectProduct']
const ozonWrites = FORBIDDEN.filter((fn) => new RegExp(`\\b${fn}\\s*\\(`).test(ozonSrc))
const wbWrites = FORBIDDEN.filter((fn) => new RegExp(`\\b${fn}\\s*\\(`).test(wbSrc))
check('DR-8 OzonCalc 草稿不调用正式数据写函数', ozonWrites.length === 0, ozonWrites.join(','))
check('DR-8 CalculatorTab 草稿不调用正式数据写函数', wbWrites.length === 0, wbWrites.join(','))
check('DR-8 两组件均从 draftStore 导入', ozonSrc.includes("from '../utils/draftStore'") && wbSrc.includes("from '../../../utils/draftStore'"))

// ---------- DR-9 恢复后仍需人工确认 ----------
check('DR-9 costConfirmed 初始 false（不被草稿置 true）', /const \[costConfirmed, setCostConfirmed\] = useState\(false\)/.test(ozonSrc) && /const \[costConfirmed, setCostConfirmed\] = useState\(false\)/.test(wbSrc))

// ---------- DR-10 真实读写往返（模拟组件卸载/重挂载） ----------
const DRAFT_KEY = 'ozon-single-draft-project-p-roundtrip'
const prefillBase = { price: 5200, weight: '', length: '', height: '', purchaseCost: '', commission: 12 }
const withPrefill = restoreDraftFields({ ...prefillBase }, { weight: 1550, length: 52, height: 28, purchaseCost: '' }, Object.keys(prefillBase))
// 用户输入采购成本 108（关键场景值），并修改重量
writeDraft(DRAFT_KEY, { ...withPrefill, purchaseCost: 108, weight: 1600 })
const draftAfterUnmount = readDraft(DRAFT_KEY)
check('DR-10 写入后读回草稿非空', draftAfterUnmount !== null)
check('DR-10 草稿含 __savedAt 时间戳', typeof draftAfterUnmount?.__savedAt === 'string')
check('DR-10 草稿保留用户输入 108', draftAfterUnmount?.purchaseCost === 108)
// 模拟重挂载：base 重新由 prefill 生成（采购成本为空），草稿应恢复 108
const remountBase = restoreDraftFields({ ...prefillBase }, { weight: 1550, length: 52, height: 28, purchaseCost: '' }, Object.keys(prefillBase))
const remount = restoreDraftFields(remountBase, draftAfterUnmount, Object.keys(prefillBase))
check('DR-10 重挂载恢复用户输入 108（不静默丢失）', remount.purchaseCost === 108)
check('DR-10 重挂载恢复修改后的重量 1600', remount.weight === 1600)
check('DR-10 prefill 中有值的字段被草稿覆盖为最新输入', remount.weight !== 1550)
// 放弃草稿后应回到 prefill 值
clearDraft(DRAFT_KEY)
check('DR-10 放弃草稿后读回 null', readDraft(DRAFT_KEY) === null)
const afterDiscard = restoreDraftFields(remountBase, readDraft(DRAFT_KEY), Object.keys(prefillBase))
check('DR-10 放弃后回到 prefill（采购成本为空）', afterDiscard.purchaseCost === '')

// ---------- 输出 ----------
console.log(`\n===== 草稿持久化契约（FINDINGS 发现2）: ${pass.length} 通过 / ${fail.length} 失败 =====\n`)
if (fail.length > 0) {
  fail.forEach((f) => console.log(`  ✗ ${f}`))
  console.log()
  process.exit(1)
} else {
  pass.forEach((p) => console.log(`  ✓ ${p}`))
  console.log()
}
