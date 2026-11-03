/**
 * tests/ia-context-bar.test.mjs
 *
 * 任务：KUAIJING-IA-REFACTOR-V1 步骤6 Context Bar（上下文贯通）
 * 专项测试套件：验证项目上下文在「项目详情 → 独立核算页（n4/n39）」之间贯通的源码契约：
 *   1. App.jsx 持有 calcContext 状态，n4/n39 独立页按平台注入 projectContext；
 *   2. 独立页保存场景从 t6Store 现取项目数据（禁止闭包快照漂移）；
 *   3. WorkspaceTopbar 渲染上下文指示器（contextPill），点击回项目详情、可退出上下文；
 *   4. ProjectDetailPage 提供「独立页 Ozon/WB 核算」入口，prefill 走 buildOzonPrefill/buildWbPrefill；
 *   5. 预填只影响初始值（mergeTrustedPrefill 契约），不触碰 wbEngine/ozonEngine 计算公式。
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

console.log('===== IA Context Bar Contract Test Suite (KUAIJING-IA-REFACTOR-V1 Step 6) =====\n')

const ROOT = path.resolve('.')
const APP_PATH = path.join(ROOT, 'ozon-react/src/App.jsx')
const TOPBAR_PATH = path.join(ROOT, 'ozon-react/src/components/workspace/WorkspaceTopbar.jsx')
const DETAIL_PATH = path.join(ROOT, 'ozon-react/src/components/t6/ProjectDetailPage.jsx')

const app = fs.readFileSync(APP_PATH, 'utf8')
const topbar = fs.readFileSync(TOPBAR_PATH, 'utf8')
const detail = fs.readFileSync(DETAIL_PATH, 'utf8')

// ==========================================
// PART 1: App.jsx 上下文状态与独立页接线
// ==========================================
console.log('--- PART 1: App.jsx 上下文状态与独立页接线 ---')

assert.ok(app.includes('const [calcContext, setCalcContext] = useState(null)'), 'TEST 1.1: App 持有 calcContext 状态（默认 null = 独立模式）')
console.log('  ✅ TEST 1.1: calcContext 状态存在')

assert.ok(app.includes('const openCalcStandalone = (ctx)'), 'TEST 1.2: openCalcStandalone 处理器存在')
assert.ok(/setActiveNode\(ctx\.platform === 'wb' \? 'n39' : 'n4'\)/.test(app), 'TEST 1.3: 按平台路由到 n39(WB) / n4(Ozon)')
assert.ok(app.includes('const clearCalcContext = () => setCalcContext(null)'), 'TEST 1.4: 可退出项目上下文（回到独立模式）')
console.log('  ✅ TEST 1.2-1.4: 打开/路由/退出处理器齐全')

assert.ok(app.includes('const ozonProjectContext = calcContext && calcContext.platform === \'ozon\''), 'TEST 1.5: n4 分支按平台条件注入 Ozon 项目上下文')
assert.ok(app.includes('<OzonCalc projectContext={ozonProjectContext} />'), 'TEST 1.6: 独立页 OzonCalc 接收 projectContext')
assert.ok(app.includes('const wbProjectContext = calcContext && calcContext.platform === \'wb\''), 'TEST 1.7: n39 分支按平台条件注入 WB 项目上下文')
assert.ok(app.includes('<WBCalc projectContext={wbProjectContext} />'), 'TEST 1.8: 独立页 WBCalc 接收 projectContext')
console.log('  ✅ TEST 1.5-1.8: n4/n39 独立页项目模式接线完成')

// 保存场景必须从 t6Store 现取项目（禁止闭包快照漂移）
assert.ok(app.includes("const project = getProject(ctx.projectId)"), 'TEST 1.9: 独立页保存场景从 t6Store 现取项目数据')
assert.ok(app.includes('const payload = isWb') && app.includes('buildWbScenarioPayload({ project, inputPayload: data.inputPayload'), 'TEST 1.10: WB 保存走 buildWbScenarioPayload（与项目内嵌保存同构）')
assert.ok(app.includes('buildOzonScenarioPayload({ project, inputPayload: data.inputPayload'), 'TEST 1.11: Ozon 保存走 buildOzonScenarioPayload（与项目内嵌保存同构）')
assert.ok(/createCostScenario\(\{/.test(app.slice(app.indexOf('saveContextScenario'))), 'TEST 1.12: 独立页保存走 createCostScenario 冻结不可变场景')
assert.ok(app.includes("openProjectDetail(ctx.projectId)"), 'TEST 1.13: 保存成功后回到项目详情（场景列表可见）')
console.log('  ✅ TEST 1.9-1.13: 场景保存链路无闭包漂移、成功后回项目详情')

// ==========================================
// PART 2: WorkspaceTopbar 上下文指示器
// ==========================================
console.log('--- PART 2: WorkspaceTopbar 上下文指示器 ---')

assert.ok(topbar.includes('contextPill = null'), 'TEST 2.1: Topbar 接受可选 contextPill prop（默认不渲染）')
assert.ok(topbar.includes('{contextPill && ('), 'TEST 2.2: 仅在存在上下文时渲染指示器')
assert.ok(topbar.includes('onClick={contextPill.onClick}'), 'TEST 2.3: 指示器点击回项目详情')
assert.ok(topbar.includes('onClick={contextPill.onClear}'), 'TEST 2.4: 提供退出上下文按钮')
console.log('  ✅ TEST 2.1-2.4: 上下文指示器契约齐全')

// App 侧构造 contextPill
assert.ok(app.includes('contextPill={calcContext ? {'), 'TEST 2.5: App 依据 calcContext 构造 contextPill 传给 Topbar')
console.log('  ✅ TEST 2.5: App → Topbar contextPill 接线')

// ==========================================
// PART 3: ProjectDetailPage 独立页入口
// ==========================================
console.log('--- PART 3: ProjectDetailPage 独立页入口 ---')

assert.ok(detail.includes('onOpenCalcStandalone = null'), 'TEST 3.1: ProjectDetailPage 接受可选 onOpenCalcStandalone prop')
assert.ok(detail.includes('独立页 Ozon 核算') && detail.includes('独立页 WB 核算'), 'TEST 3.2: 成本与物流 Tab 提供两个独立页入口按钮')
assert.ok(detail.includes("platform: 'ozon',") && detail.includes("platform: 'wb',"), 'TEST 3.3: 入口携带平台标识')
assert.ok(detail.includes('prefill: buildOzonPrefill({ snapshot, product: project.product })'), 'TEST 3.4: Ozon prefill 走 buildOzonPrefill（与内嵌模式同一构建器）')
assert.ok(detail.includes('prefill: buildWbPrefill({ snapshot, product: project.product })'), 'TEST 3.5: WB prefill 走 buildWbPrefill（与内嵌模式同一构建器）')
assert.ok(detail.includes('supplyCostReference,'), 'TEST 3.6: 入口携带供应成本参考（正式报价一键采用）')
assert.ok(detail.includes('{onOpenCalcStandalone && ('), 'TEST 3.7: 入口按钮仅在 prop 存在时渲染（向后兼容旧调用方）')
console.log('  ✅ TEST 3.1-3.7: 独立页入口契约齐全')

// App 侧传入
assert.ok(app.includes('onOpenCalcStandalone={openCalcStandalone}'), 'TEST 3.8: App 向 ProjectDetailPage 传入入口处理器')
console.log('  ✅ TEST 3.8: App → ProjectDetailPage 接线')

// ==========================================
// PART 4: 范围红线（不得触碰计算公式 / 预填只影响初始值）
// ==========================================
console.log('--- PART 4: 范围红线 ---')

// prefill 只经 mergeTrustedPrefill 生效（''/null/undefined 不覆盖既有假设）——沿用 UI-4/UI-7 契约
assert.ok(app.includes('supplyCostReference: calcContext.supplyCostReference'), 'TEST 4.1: 上下文传递 supplyCostReference（报价一键采用可用）')
// App 不直接 import 计算引擎（编排层只做接线；计算属于引擎层）
assert.ok(!/from '.\/utils\/(wbEngine|ozonEngine)/.test(app), 'TEST 4.2: App 不直接 import 计算引擎（编排层红线）')
console.log('  ✅ TEST 4.1-4.2: 范围红线通过')

console.log('\n===== IA Context Bar 契约测试全部通过 =====\n')
