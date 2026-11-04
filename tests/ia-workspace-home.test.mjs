/**
 * tests/ia-workspace-home.test.mjs — IA 步骤7 工作台首页聚合契约测试
 *
 * 契约：
 *  WS-1 ProgressOverview 导出默认函数组件，接收 { nodeStatuses, onNodeSelect, openProjectDetail }
 *  WS-2 三个聚合区块组件存在：ProjectBlockCard / CandidateAlertCard / TodoNodeList（workspace/WorkspaceHomeCards.jsx）
 *  WS-3 ProgressOverview 源码包含四区块标题：项目卡点 / 候选预警 / 待办节点 + 原全局进度保留
 *  WS-4 数据只读：ProgressOverview 与 WorkspaceHomeCards 源码不含 persistSet / 任何 store 写函数调用
 *  WS-5 原进度条保留：PRODUCTS 数组（4 产品）与 COLOR_MAP / STATUS_DOT / PHASE_ICONS 仍在
 *  WS-6 跳转接线：调用 openProjectDetail / onNodeSelect('__t6_candidates__')（候选池跳转）
 *  WS-7 空态：三个区块的展示组件均含空态文本（EmptyHint）
 *  WS-8 App.jsx 向 ProgressOverview 传入 openProjectDetail prop
 *  WS-9 未触碰计算引擎：gateEngine / scoringEngine / wbEngine / ozonEngine 零改动（git diff）
 *  WS-10 无新运行时依赖：package.json dependencies 未新增
 *  WS-11 Gate deps 完整性：evaluateProjectGate 调用必须传 scenarios（缺 deps 会让 costing 检查恒 FAIL 误标红）
 *  WS-12 展示组件默认参数：projects/items/topCandidates/pendingCount 均有默认值（漏传不白屏）
 *  WS-13 REVIEW 末阶段显示「已完结」而非「当前阶段」
 */
import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

const ROOT = process.cwd()
const pass = []
const fail = []

function check(name, cond, detail = '') {
  if (cond) { pass.push(name); }
  else { fail.push(`${name}${detail ? ' — ' + detail : ''}`); }
}

function read(rel) {
  return readFileSync(`${ROOT}/${rel}`, 'utf8')
}

// ---------- WS-1 ProgressOverview 组件签名 ----------
const progressSrc = read('ozon-react/src/components/ProgressOverview.jsx')
check('WS-1 ProgressOverview 默认导出函数组件', /export default function ProgressOverview/.test(progressSrc))
check('WS-1 接收 openProjectDetail prop', /openProjectDetail/.test(progressSrc))

// ---------- WS-2 三个区块组件 ----------
const cardsSrc = read('ozon-react/src/components/workspace/WorkspaceHomeCards.jsx')
check('WS-2 ProjectBlockCard 导出', /export function ProjectBlockCard/.test(cardsSrc))
check('WS-2 CandidateAlertCard 导出', /export function CandidateAlertCard/.test(cardsSrc))
check('WS-2 TodoNodeList 导出', /export function TodoNodeList/.test(cardsSrc))

// ---------- WS-3 四区块标题 ----------
check('WS-3 含「项目卡点」标题', progressSrc.includes('项目卡点'))
check('WS-3 含「候选预警」标题', progressSrc.includes('候选预警'))
check('WS-3 含「待办节点」标题', progressSrc.includes('待办节点'))
check('WS-3 原全局进度保留（工作台标题或进度总览）', /工作台|进度总览/.test(progressSrc))

// ---------- WS-4 数据只读 ----------
check('WS-4 ProgressOverview 不含 persistSet', !/persistSet/.test(progressSrc))
check('WS-4 WorkspaceHomeCards 不含 persistSet', !/persistSet/.test(cardsSrc))
const STORE_WRITE_FNS = ['appendLog', 'createProject', 'setProjectLifecycle', 'setProjectStage', 'setWorkflowNode', 'createCostScenario', 'setProjectBaselineScenario', 'createSupplier', 'updateSupplier', 'createSupplierQuote', 'createSampleRecord', 'updateSampleRecord', 'setProjectSupply', 'clearProjectSupply', 'updateProjectProduct', 'updateProjectCompliance', 'createProjectComplianceRequirement', 'updateProjectComplianceRequirement', 'removeProjectComplianceRequirement', 'setCandidateBizStatus', 'setCandidateOwner', 'refreshCandidateSnapshot', 'ensureCandidate', 'syncCandidateMarketEvidence']
const writeCallsInCards = STORE_WRITE_FNS.filter((fn) => new RegExp(`\\b${fn}\\b`).test(cardsSrc))
check('WS-4 WorkspaceHomeCards 不含 store 写函数', writeCallsInCards.length === 0, `发现: ${writeCallsInCards.join(', ')}`)
// ProgressOverview 允许 import 只读函数，但不应调用写函数
const writeCallsInProgress = STORE_WRITE_FNS.filter((fn) => new RegExp(`\\b${fn}\\(`).test(progressSrc))
check('WS-4 ProgressOverview 不调用 store 写函数', writeCallsInProgress.length === 0, `发现: ${writeCallsInProgress.join(', ')}`)

// ---------- WS-5 原进度条保留 ----------
check('WS-5 PRODUCTS 数组保留（4 产品）', /const PRODUCTS = \[/.test(progressSrc) && progressSrc.includes('hairdryer') && progressSrc.includes('pillow') && progressSrc.includes('hairmask') && progressSrc.includes('essentialoil'))
check('WS-5 COLOR_MAP 保留', /const COLOR_MAP =/.test(progressSrc))
check('WS-5 STATUS_DOT 保留', /const STATUS_DOT =/.test(progressSrc))
check('WS-5 PHASE_ICONS 保留', /const PHASE_ICONS =/.test(progressSrc))

// ---------- WS-6 跳转接线 ----------
check('WS-6 调用 openProjectDetail（项目卡跳转）', progressSrc.includes('onOpenProject={openProjectDetail}'))
check('WS-6 候选池跳转 onNodeSelect(__t6_candidates__)', progressSrc.includes("'__t6_candidates__'"))

// ---------- WS-7 空态 ----------
check('WS-7 ProjectBlockCard 含空态', cardsSrc.includes('暂无进行中项目'))
check('WS-7 CandidateAlertCard 含空态', cardsSrc.includes('暂无待处理候选'))
check('WS-7 TodoNodeList 含空态', cardsSrc.includes('暂无进行中节点'))
check('WS-7 EmptyHint 组件存在', /function EmptyHint/.test(cardsSrc))

// ---------- WS-8 App.jsx 传入 openProjectDetail ----------
const appSrc = read('ozon-react/src/App.jsx')
check('WS-8 App.jsx 向 ProgressOverview 传 openProjectDetail', /ProgressOverview.*openProjectDetail/.test(appSrc.replace(/\n/g, ' ')))

// ---------- WS-9 未触碰计算引擎 ----------
try {
  const diff = execSync('git diff --name-only HEAD', { cwd: ROOT, encoding: 'utf8' }).trim()
  const engineFiles = diff.split('\n').filter((f) => /gateEngine|scoringEngine|wbEngine|ozonEngine/.test(f))
  check('WS-9 计算引擎零改动（git diff）', engineFiles.length === 0, `改动: ${engineFiles.join(', ')}`)
} catch {
  check('WS-9 git diff 可执行', false, 'git diff 失败')
}

// ---------- WS-10 无新运行时依赖 ----------
const pkgBefore = execSync('git show HEAD:package.json', { cwd: ROOT, encoding: 'utf8' })
const pkgAfter = read('package.json')
const depBefore = JSON.parse(pkgBefore).dependencies || {}
const depAfter = JSON.parse(pkgAfter).dependencies || {}
const newDeps = Object.keys(depAfter).filter((d) => !(d in depBefore))
check('WS-10 无新运行时依赖', newDeps.length === 0, `新增: ${newDeps.join(', ')}`)

// ---------- WS-11 Gate deps 完整性 ----------
check('WS-11 evaluateProjectGate 传入 deps 对象', /evaluateProjectGate\(\s*p\s*,\s*nextStage\s*,\s*deps\s*\)/.test(progressSrc))
check('WS-11 deps 含 scenarios（getProjectScenarios）', progressSrc.includes('scenarios: getProjectScenarios(p.id)'))
check('WS-11 从 t6Store 导入 getProjectScenarios', /getProjectScenarios/.test(progressSrc.split('\n').find((l) => l.includes('t6Store')) || ''))
// 禁止旧写法：不带 deps 的三参以下调用
check('WS-11 无裸调用 evaluateProjectGate(p, nextStage)', !/evaluateProjectGate\(\s*p\s*,\s*nextStage\s*\)/.test(progressSrc))

// ---------- WS-12 展示组件默认参数 ----------
check('WS-12 ProjectBlockCard projects 默认 []', /ProjectBlockCard\(\{\s*projects\s*=\s*\[\]/.test(cardsSrc))
check('WS-12 CandidateAlertCard pendingCount 默认 0', /pendingCount\s*=\s*0/.test(cardsSrc))
check('WS-12 CandidateAlertCard topCandidates 默认 []', /topCandidates\s*=\s*\[\]/.test(cardsSrc))
check('WS-12 TodoNodeList items 默认 []', /TodoNodeList\(\{\s*items\s*=\s*\[\]/.test(cardsSrc))

// ---------- WS-13 末阶段已完结 ----------
check('WS-13 COMPLETED verdict 样式存在', /COMPLETED:\s*\{/.test(cardsSrc))
check('WS-13 ProgressOverview 对末阶段置 COMPLETED', progressSrc.includes("'COMPLETED'"))
check('WS-13 非法 stage 不渲染原值', cardsSrc.includes("STAGE_LABEL[p.stage] || '未知阶段'"))

// ---------- 输出 ----------
console.log(`\n===== IA 步骤7 工作台首页聚合契约测试: ${pass.length} 通过 / ${fail.length} 失败 =====\n`)
if (fail.length > 0) {
  fail.forEach((f) => console.log(`  ✗ ${f}`))
  console.log()
  process.exit(1)
} else {
  pass.forEach((p) => console.log(`  ✓ ${p}`))
  console.log()
}
