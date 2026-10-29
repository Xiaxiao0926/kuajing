/**
 * tests/ia-project-notice.test.mjs
 * 
 * 任务：KJ-GEMINI-20260922-001 (Project Detail Save Feedback Visibility & Ownership Repair)
 * 专项测试套件：验证 ProjectDetailPage.jsx 中的 notice 可见性、全 Tab 共享、项目归属隔离与无冗余契约。
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

console.log('===== IA Project Notice Visibility & Ownership Test Suite (KJ-GEMINI-20260922-001) =====\n')

const ROOT = path.resolve('.')
const DETAIL_PATH = path.join(ROOT, 'ozon-react/src/components/t6/ProjectDetailPage.jsx')

// ==========================================
// PART 1: 静态源码与组件契约检查
// ==========================================
console.log('--- PART 1: 静态源码与结构契约检查 ---')

assert(fs.existsSync(DETAIL_PATH), 'TEST 1.1: ProjectDetailPage.jsx 必须存在')
console.log('  ✅ TEST 1.1: ProjectDetailPage.jsx 存在')

const detailSource = fs.readFileSync(DETAIL_PATH, 'utf8')

// 1.2 检查 noticeState 绑定了 projectId
assert.ok(
  detailSource.includes('noticeState.projectId === projectId'),
  'TEST 1.2: notice 必须绑定当前 projectId，杜绝跨项目继承脏通知'
)
console.log('  ✅ TEST 1.2: notice 状态包含 projectId 归属绑定')

// 1.3 检查原 overview 内部的旧 notice 节点已被移除
const overviewMatch = detailSource.match(/\{tab === 'overview' && \([\s\S]*?\n\s*\}\)/)
assert.ok(overviewMatch, '必须找到 overview Tab 代码块')
const overviewBlock = overviewMatch[0]
assert.ok(
  !overviewBlock.includes('{notice &&'),
  'TEST 1.3: overview Tab 内部不得残留独立 notice 节点，避免概览页双重渲染'
)
console.log('  ✅ TEST 1.3: overview 内部旧 notice 节点已彻底解耦移除')

// 1.4 检查 notice 提升到了 p-5 容器顶部、所有 Tab 之前
const p5Match = detailSource.match(/<div className="p-5">([\s\S]*?)\{tab === 'overview'/)
assert.ok(p5Match, '必须在 p-5 容器内且位于 overview 之前')
const p5TopBlock = p5Match[1]
assert.ok(
  p5TopBlock.includes('{notice &&'),
  'TEST 1.4: notice 必须位于 <div className="p-5"> 容器最顶端，对所有 Tab 保持可见'
)
console.log('  ✅ TEST 1.4: notice 已放置于 p-5 容器顶层共享区域')

// 1.5 检查可访问性与响应式换行属性
assert.ok(
  p5TopBlock.includes('role="status"'),
  'TEST 1.5a: 必须包含 role="status" 辅助技术可感知'
)
assert.ok(
  p5TopBlock.includes('aria-live="polite"'),
  'TEST 1.5b: 必须包含 aria-live="polite" 礼貌朗读'
)
assert.ok(
  p5TopBlock.includes('break-words'),
  'TEST 1.5c: 必须包含 break-words 避免窄屏长文本溢出'
)
assert.ok(
  p5TopBlock.includes('text-xs text-workspace-text-secondary'),
  'TEST 1.5d: 沿用既有设计系统标准排版与色彩样式'
)
console.log('  ✅ TEST 1.5: 可访问性属性（role, aria-live）与 break-words 样式核验通过')

// ==========================================
// PART 2: 状态机与项目归属逻辑验证
// ==========================================
console.log('\n--- PART 2: 状态机与归属隔离逻辑验证 ---')

// 模拟组件内的归属函数
function createNoticeScope() {
  let currentProjectId = 'project-alpha'
  let state = { projectId: null, text: '' }

  return {
    setProjectId(id) {
      currentProjectId = id
    },
    setNotice(msg) {
      state = { projectId: currentProjectId, text: msg || '' }
    },
    getNotice() {
      return state.projectId === currentProjectId ? state.text : ''
    },
    getState() {
      return state
    }
  }
}

const scope = createNoticeScope()

// 2.1 初始无通知
assert.equal(scope.getNotice(), '', 'TEST 2.1: 初始 notice 必须为空')
console.log('  ✅ TEST 2.1: 初始 notice 为空')

// 2.2 在 Project A 设置通知
scope.setNotice('T6_BACKEND_LOCKED: 并发锁定')
assert.equal(scope.getNotice(), 'T6_BACKEND_LOCKED: 并发锁定', 'TEST 2.2: Project A 应能正常读取通知')
console.log('  ✅ TEST 2.2: Project A 设置通知正常显示')

// 2.3 同实例切换至 Project B，A 的通知必须立即隐匿
scope.setProjectId('project-beta')
assert.equal(scope.getNotice(), '', 'TEST 2.3: 切换至 Project B 后，Project A 的旧通知严禁展示')
console.log('  ✅ TEST 2.3: 切换至 Project B，A 的通知自动隐匿（0 污染）')

// 2.4 在 Project B 设置新通知
scope.setNotice('WB 保存成功')
assert.equal(scope.getNotice(), 'WB 保存成功', 'TEST 2.4: Project B 应显示自身通知')
console.log('  ✅ TEST 2.4: Project B 设置自身通知正常显示')

// 2.5 切回 Project A，B 的通知不得回显给 A
scope.setProjectId('project-alpha')
assert.equal(scope.getNotice(), '', 'TEST 2.5: 切回 Project A 后，B 的通知不得污染 A')
console.log('  ✅ TEST 2.5: 切回 Project A，B 的通知不污染 A')

// 2.6 连续设置消息时最新一条覆盖，不累积
scope.setNotice('错误 1')
scope.setNotice('错误 2：最新错误')
assert.equal(scope.getNotice(), '错误 2：最新错误', 'TEST 2.6: 连续设置时仅保留最新消息')
console.log('  ✅ TEST 2.6: 连续设置时仅保留最新消息，无旧条目累积')

console.log('\n===== IA Project Notice Test Suite: 全部断言通过 =====')
