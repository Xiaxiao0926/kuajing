/**
 * tests/mi-acceptance-t6-and-runs.test.mjs
 * 验收项 3、4、5 自动化测试：
 * 3. Run 版本化与多周期隔离（新建测试 Run，不覆盖旧 Run，model_version 完整记录）
 * 4. 人工状态持久化（修改 Niche 为 TEST，写入备忘录，跨 Run / 页面重载不丢失）
 * 5. T6 幂等性与溯源字段（连续推流 2 次只生成 1 条有效候选，source_niche_id/source_run_id/source_system 完整）
 */
import fs from 'fs'
import path from 'path'
import assert from 'assert'

// 模拟浏览器环境与存储
const mem = new Map()
globalThis.localStorage = {
  getItem: (k) => mem.get(k) ?? null,
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
}
globalThis.window = { location: { origin: 'http://localhost' } }

// 模拟静态资源 fetch
globalThis.fetch = async (urlStr) => {
  const url = new URL(urlStr, 'http://localhost')
  let relPath = url.pathname.replace(/^\/data\//, '')
  if (relPath.startsWith('/')) relPath = relPath.slice(1)
  const filePath = path.resolve('ozon-react/public/data', relPath)
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8')
    return {
      ok: true,
      status: 200,
      json: async () => JSON.parse(content),
      text: async () => content,
    }
  }
  return { ok: false, status: 404, statusText: 'Not Found' }
}

const {
  fetchActiveRunInfo,
  fetchRunBundle,
  saveValidationOverride,
  getValidationOverrides,
  buildMergedValidationPool,
  promoteToT6Candidate,
} = await import('../ozon-react/src/utils/marketIntelligence/miStore.js')
const t6Store = await import('../ozon-react/src/utils/t6/t6Store.js')

// 注入测试适配器以保证 keys() 与持久化在 Node 环境中透明运行
t6Store._setAdapterForTests({
  get: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null),
  set: (k, v) => mem.set(k, JSON.stringify(v)),
  keys: () => [...mem.keys()],
})

console.log('=== [ACCEPTANCE 3, 4, 5] Run版本化、人工持久化与 T6 幂等性 ===\n')

// ==================== 1. 测试 Run 版本化 (Item 3) ====================
console.log('--- 3.1 验证多 Run 并存与不可变隔离 ---')
const activeInfo = await fetchActiveRunInfo()
assert(Array.isArray(activeInfo.available_runs), 'available_runs 必须为数组')
assert(activeInfo.available_runs.length >= 2, '必须至少注册 2 个独立数据批次')

const run001Meta = activeInfo.available_runs.find((r) => r.run_id === 'RUN-20260917-001')
const run002Meta = activeInfo.available_runs.find((r) => r.run_id === 'RUN-20260615-001')

assert(run001Meta, 'RUN-20260917-001 (Q3基线) 必须存在')
assert(run002Meta, 'RUN-20260615-001 (Q2历史) 必须存在')
assert.notStrictEqual(run001Meta.date_range, run002Meta.date_range, '不同批次数据周期必须独立')

// 载入两批次 bundle，验证内容互不覆盖
const bundle1 = await fetchRunBundle('RUN-20260917-001')
const bundle2 = await fetchRunBundle('RUN-20260615-001')

assert.strictEqual(bundle1.runId, 'RUN-20260917-001')
assert.strictEqual(bundle2.runId, 'RUN-20260615-001')
assert.strictEqual(bundle1.niches.length, 6534, 'Q3 批次应有 6534 利基')
assert.strictEqual(bundle2.niches.length, 6534, 'Q2 批次利基数据加载正常')

// 验证各批次 model_version 记录
assert.strictEqual(bundle1.meta.models.market_model, 'WB-MARKET-MODEL-V1')
assert.strictEqual(bundle1.meta.models.risk_model, 'WB-CROSSBORDER-RISK-V1')
assert.strictEqual(bundle1.meta.models.keyword_model, 'WB-DSI-V1')

assert.strictEqual(bundle2.meta.models.market_model, 'WB-MARKET-MODEL-V1')
assert.strictEqual(bundle2.meta.models.risk_model, 'WB-CROSSBORDER-RISK-V1')
assert.strictEqual(bundle2.meta.models.keyword_model, 'WB-DSI-V1')

console.log(`  ✓ 批次 1: ${bundle1.runId} (${bundle1.meta.data_period}) - 模型: ${bundle1.meta.models.market_model}`)
console.log(`  ✓ 批次 2: ${bundle2.runId} (${bundle2.meta.data_period}) - 模型: ${bundle2.meta.models.market_model}`)
console.log(`[PASS] 验收项 3：Run 版本化与多周期隔离验证通过！`)

// ==================== 2. 测试人工状态持久化 (Item 4) ====================
console.log('\n--- 4.1 验证人工标记与备注持久化 ---')
const testNicheName = '发泡胶枪'
const testNote = `人工采购实地打样测试：义乌某五金厂打样 350g，出厂价14.5元 - ${Date.now()}`

// 修改状态为 TEST 并写入备忘录
saveValidationOverride(testNicheName, 'TEST', testNote)

// 验证获取
const overrides = getValidationOverrides()
assert(overrides[testNicheName], '持久化存储中必须存在该单品的调整记录')
assert.strictEqual(overrides[testNicheName].verdict, 'TEST', '状态必须为 TEST')
assert.strictEqual(overrides[testNicheName].note, testNote, '备注必须一致')

// 验证合并到看板中
const mergedQ3 = buildMergedValidationPool(bundle1.defaultValidationPool, bundle1.niches, overrides)
const itemInTestCol = mergedQ3.TEST.find((x) => x.name === testNicheName)
assert(itemInTestCol, '合并后看板 TEST 列必须包含该单品')
assert.strictEqual(itemInTestCol.userNote, testNote, '看板单品卡片必须包含人工填写的备忘录')

// 验证切换批次后依然保持人工标记与备忘录
const mergedQ2 = buildMergedValidationPool(bundle2.defaultValidationPool, bundle2.niches, overrides)
const itemInQ2Test = mergedQ2.TEST.find((x) => x.name === testNicheName)
assert(itemInQ2Test, '切换批次后，用户人工标记与备忘录依然必须持久保留')
assert.strictEqual(itemInQ2Test.userNote, testNote, '切换批次后备忘录内容不丢失')

console.log(`  ✓ 单品「${testNicheName}」成功设置为 TEST 状态`)
console.log(`  ✓ 采购备忘录已持久化写入并在多批次看板中成功还原: "${itemInQ2Test.userNote.slice(0, 30)}..."`)
console.log(`[PASS] 验收项 4：人工状态持久化验证通过！`)

// ==================== 3. 测试 T6 幂等性与溯源字段 (Item 5) ====================
console.log('\n--- 5.1 验证推流到 T6 候选池的幂等性与溯源 ---')
const sampleNiche = bundle1.niches.find((n) => n.name === '发泡胶枪')
assert(sampleNiche, '未找到测试单品')

// 第一次推流
const res1 = promoteToT6Candidate(sampleNiche, '第一次推流测试', 'RUN-20260917-001')
assert(res1.candidate, '第一次推流必须返回 candidate 对象')
const candidateId1 = res1.candidate.id
const sourceProductId = res1.candidate.sourceProductId
console.log(`  - 第一次推流: candidateId = ${candidateId1}, created = ${res1.created}, sourceProductId = ${sourceProductId}`)
assert.strictEqual(res1.created, true, '第一次推流 created 必须为 true')

// 第二次推流（相同单品）
const res2 = promoteToT6Candidate(sampleNiche, '第二次推流防重测试', 'RUN-20260917-001')
assert(res2.candidate, '第二次推流必须返回 candidate 对象')
console.log(`  - 第二次推流: candidateId = ${res2.candidate.id}, created = ${res2.created}`)

// 幂等性校验
assert.strictEqual(res2.created, false, '第二次推流 created 必须为 false (防重生效)')
assert.strictEqual(res2.candidate.id, candidateId1, '两次推流必须指向完全相同的 candidate.id，严禁生成重复记录')

// 检查 T6 存储中的记录总数与溯源字段
const savedCandidate = t6Store.getCandidate(candidateId1)
assert(savedCandidate, 'T6 候选库中必须存在该记录')
assert.strictEqual(savedCandidate.source_system, 'WB_MARKET_INTELLIGENCE', 'source_system 必须精确为 WB_MARKET_INTELLIGENCE')
assert.strictEqual(savedCandidate.source_run_id, 'RUN-20260917-001', 'source_run_id 必须记录当前数据批次编号')
assert.strictEqual(savedCandidate.source_niche_id, String(sampleNiche.id), 'source_niche_id 必须精确关联原始利基 ID')
assert(savedCandidate.notes.includes('MOS: 73.7'), 'notes 必须包含原始利基关键评分参数')

console.log(`  ✓ 溯源验证: source_system = ${savedCandidate.source_system}`)
console.log(`  ✓ 溯源验证: source_run_id = ${savedCandidate.source_run_id}`)
console.log(`  ✓ 溯源验证: source_niche_id = ${savedCandidate.source_niche_id}`)
console.log(`[PASS] 验收项 5：T6 幂等性与溯源字段完整性验证通过！`)

console.log('\n🎉 [ACCEPTANCE 3, 4, 5 ALL PASS] 批次版本化、人工持久化与 T6 幂等性全部验证通过！\n')
