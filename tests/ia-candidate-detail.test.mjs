import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  _setAdapterForTests,
  ensureCandidate,
  getCandidate,
  getSnapshot,
  listLogs,
  createSnapshot,
  refreshCandidateSnapshot,
} from '../ozon-react/src/utils/t6/t6Store.js'

function createMemoryAdapter() {
  const store = new Map()
  return {
    get: (k) => (store.has(k) ? JSON.parse(JSON.stringify(store.get(k))) : null),
    set: (k, v) => { store.set(k, JSON.parse(JSON.stringify(v))) },
    keys: () => Array.from(store.keys()),
  }
}

console.log('===== IA Candidate Detail Test Suite =====\n')

const drawerFilePath = path.resolve('ozon-react/src/components/t6/CandidateDetailDrawer.jsx')
const poolFilePath = path.resolve('ozon-react/src/components/t6/CandidatePoolPage.jsx')

// -------------------------------------------------------------
// TEST 1: CandidateDetailDrawer.jsx 物理存在
// -------------------------------------------------------------
console.log('TEST 1: 验证 CandidateDetailDrawer.jsx 存在')
assert.ok(fs.existsSync(drawerFilePath), 'CandidateDetailDrawer.jsx 文件必须存在')
const drawerCode = fs.readFileSync(drawerFilePath, 'utf-8')
console.log('  ✅ CandidateDetailDrawer.jsx 文件存在')

// -------------------------------------------------------------
// TEST 2: CandidatePoolPage 引入 CandidateDetailDrawer
// -------------------------------------------------------------
console.log('TEST 2: 验证 CandidatePoolPage 引入 CandidateDetailDrawer')
const poolCode = fs.readFileSync(poolFilePath, 'utf-8')
assert.match(poolCode, /import\s+CandidateDetailDrawer\s+from\s+['"]\.\/CandidateDetailDrawer['"]/, '必须引入 CandidateDetailDrawer')
console.log('  ✅ CandidatePoolPage 引入 CandidateDetailDrawer')

// -------------------------------------------------------------
// TEST 3: CandidatePoolPage 使用 selectedCandidateId
// -------------------------------------------------------------
console.log('TEST 3: 验证 CandidatePoolPage 使用 selectedCandidateId 状态')
assert.match(poolCode, /const\s+\[selectedCandidateId,\s*setSelectedCandidateId\]\s*=\s*useState\(null\)/, '必须使用 selectedCandidateId')
assert.doesNotMatch(poolCode, /const\s+\[selectedCandidate,\s*setSelectedCandidate\]/, '严禁整对象缓存 selectedCandidate')
console.log('  ✅ 使用 selectedCandidateId 状态驱动')

// -------------------------------------------------------------
// TEST 4: 存在明确的“详情”按钮
// -------------------------------------------------------------
console.log('TEST 4: 验证操作列存在明确的“详情”按钮')
assert.match(poolCode, /<Eye\s+className="h-3\.5\s+w-3\.5"\s*\/>\s*详情/, '操作列必须包含带 Eye 图标的“详情”按钮')
console.log('  ✅ 明确的“详情”按钮存在')

// -------------------------------------------------------------
// TEST 5: 现有“刷新评分”与“创建项目”按钮完好保留
// -------------------------------------------------------------
console.log('TEST 5: 验证现有“刷新评分”与“创建项目”完好保留')
assert.match(poolCode, /刷新评分/, '刷新评分按钮必须保留')
assert.match(poolCode, /创建项目/, '创建项目按钮必须保留')
console.log('  ✅ 原有操作按钮完好保留')

// -------------------------------------------------------------
// TEST 6: CandidateDetailDrawer 仅通过 T6 Store Read API 获取数据
// -------------------------------------------------------------
console.log('TEST 6: 验证使用 getCandidate, getSnapshot, listLogs Read API')
assert.match(drawerCode, /import\s*\{[^}]*getCandidate[^}]*\}\s*from\s*['"][^'"]*t6Store['"]/)
assert.match(drawerCode, /import\s*\{[^}]*getSnapshot[^}]*\}\s*from\s*['"][^'"]*t6Store['"]/)
assert.match(drawerCode, /import\s*\{[^}]*listLogs[^}]*\}\s*from\s*['"][^'"]*t6Store['"]/)
assert.doesNotMatch(drawerCode, /localStorage\.getItem/, '严禁直接读 localStorage')
assert.doesNotMatch(drawerCode, /persistGet/, '严禁直接调用 persistGet')
assert.doesNotMatch(drawerCode, /fetch\(/, '只读详情层严禁发起 fetch API')
console.log('  ✅ 数据读取严格遵守 T6 Store Read API 契约')

// -------------------------------------------------------------
// TEST 7: 严格存在 6 个业务 Tab
// -------------------------------------------------------------
console.log('TEST 7: 验证严格存在 6 个业务 Tab')
assert.match(drawerCode, /id:\s*'overview',\s*label:\s*'概览'/)
assert.match(drawerCode, /id:\s*'market',\s*label:\s*'市场依据'/)
assert.match(drawerCode, /id:\s*'scoring',\s*label:\s*'选品评分'/)
assert.match(drawerCode, /id:\s*'procurement',\s*label:\s*'采购验证'/)
assert.match(drawerCode, /id:\s*'risk',\s*label:\s*'风险与合规'/)
assert.match(drawerCode, /id:\s*'history',\s*label:\s*'决策记录'/)
console.log('  ✅ 6 个固定业务 Tab 校验通过')

// -------------------------------------------------------------
// TEST 8: 市场依据读取 candidate.marketEvidence
// -------------------------------------------------------------
console.log('TEST 8: 验证市场依据 Tab 读取 candidate.marketEvidence 结构')
assert.match(drawerCode, /candidate\.marketEvidence/)
assert.match(drawerCode, /marketEvidence\.mos/)
assert.match(drawerCode, /marketEvidence\.pfs/)
assert.match(drawerCode, /marketEvidence\.gmv/)
assert.match(drawerCode, /marketEvidence\.growth/)
assert.match(drawerCode, /marketEvidence\.buyout/)
assert.match(drawerCode, /marketEvidence\.sellers/)
assert.match(drawerCode, /marketEvidence\.price/)
assert.match(drawerCode, /marketEvidence\.weightG/)
assert.match(drawerCode, /marketEvidence\.heavy/)
assert.match(drawerCode, /marketEvidence\.verdict/)
assert.match(drawerCode, /marketEvidence\.syncedAt/)
console.log('  ✅ 结构化 marketEvidence 字段映射完整')

// -------------------------------------------------------------
// TEST 9: 风险与合规读取 risks, eacStatus, certificationStatus
// -------------------------------------------------------------
console.log('TEST 9: 验证风险与合规 Tab 结构化读取')
assert.match(drawerCode, /marketEvidence(\?\.|\.)risks/)
assert.match(drawerCode, /marketEvidence(\?\.|\.)eacStatus/)
assert.match(drawerCode, /marketEvidence(\?\.|\.)certificationStatus/)
assert.match(drawerCode, /暂无结构化风险标签/, '空风险必须提示暂无结构化标签而非“无风险”')
console.log('  ✅ 风险与合规字段读取与防御文案校验通过')

// -------------------------------------------------------------
// TEST 10: 隔离性检查（未引入评分、采购或立项组件）
// -------------------------------------------------------------
console.log('TEST 10: 验证未引入 ProductScoringSection, ManualProcurementWorkbench, ProjectSetup')
assert.doesNotMatch(drawerCode, /ProductScoringSection/, '严禁引入 ProductScoringSection')
assert.doesNotMatch(drawerCode, /ManualProcurementWorkbench/, '严禁引入 ManualProcurementWorkbench')
assert.doesNotMatch(drawerCode, /ProjectSetup/, '严禁引入 ProjectSetup')
console.log('  ✅ 物理隔离通过')

// -------------------------------------------------------------
// TEST 11: 严禁从 notes 反向正则解析数据
// -------------------------------------------------------------
console.log('TEST 11: 验证未通过 notes 正则解析市场指标')
assert.doesNotMatch(drawerCode, /notes\.match\(/, '严禁对 notes 使用 match')
assert.doesNotMatch(drawerCode, /RegExp/, '严禁引入正则解析')
console.log('  ✅ 零文本反解析保证通过')

// -------------------------------------------------------------
// TEST 12: 存在 MOS/PFS 与 T6 评分快照隔离提示文案
// -------------------------------------------------------------
console.log('TEST 12: 验证存在明确的 MOS/PFS 与 T6 评分隔离提示文案')
assert.match(drawerCode, /Market\s+Intelligence.*MOS.*PFS.*不等同于.*T6/, '必须包含语义明确的隔离提示')
console.log('  ✅ 语义隔离提示文案校验通过')

// -------------------------------------------------------------
// TEST 13: 行为与兼容性测试 (MI Candidate 与 静态评分 Candidate)
// -------------------------------------------------------------
console.log('TEST 13: 内存 Adapter 行为与数据视图兼容性测试')
_setAdapterForTests(createMemoryAdapter())

// Case A: MI Candidate (带 marketEvidence, latestSnapshotId 为 null)
const miCand = ensureCandidate({
  sourceProductId: 'wb-niche-wb_gun_test_1',
  name: '发泡胶枪',
  categoryLeaf: '手动工具',
  source_niche_uid: 'wb_gun_test_1',
  source_run_id: 'RUN-20260917-001',
  source_system: 'WB_MARKET_INTELLIGENCE',
  marketEvidence: {
    schemaVersion: 1,
    nicheUid: 'wb_gun_test_1',
    runId: 'RUN-20260917-001',
    mos: 73.7,
    pfs: 100,
    gmv: 7785641,
    price: 340,
    weightG: 380,
    risks: ['CERT_REQUIRED'],
    eacStatus: 'NOT_REQUIRED',
    certificationStatus: 'SELF_DECLARATION',
  },
}).candidate

const fetchedA = getCandidate(miCand.id)
assert.ok(fetchedA)
assert.equal(fetchedA.latestSnapshotId, null)
assert.equal(fetchedA.marketEvidence.mos, 73.7)
assert.equal(fetchedA.marketEvidence.pfs, 100)
assert.deepEqual(fetchedA.marketEvidence.risks, ['CERT_REQUIRED'])

// Case B: 静态评分 Candidate (无 marketEvidence, 有 latestSnapshotId)
const staticCand = ensureCandidate({
  sourceProductId: 'SP-STATIC-999',
  name: '静态测试洗发水',
  categoryLeaf: '洗护',
}).candidate

const snapRecord = createSnapshot({
  candidateId: staticCand.id,
  sourceProductId: 'SP-STATIC-999',
  scoreResult: { totalScore: 88, grade: 'A' },
})
refreshCandidateSnapshot(staticCand.id, snapRecord.id)

const fetchedB = getCandidate(staticCand.id)
assert.ok(fetchedB)
assert.equal(fetchedB.marketEvidence, undefined, '静态候选无 marketEvidence')
assert.equal(fetchedB.source_niche_uid, undefined, '静态候选无 source_niche_uid')
assert.equal(fetchedB.latestSnapshotId, snapRecord.id, '快照 ID 必须存在')
const fetchedSnap = getSnapshot(fetchedB.latestSnapshotId)
assert.equal(fetchedSnap.scoreResult.totalScore, 88)
assert.equal(fetchedSnap.scoreResult.grade, 'A')

console.log('  ✅ 真实候选实体多形态数据流与快照视图校验通过')

console.log('\n🎉 IA Candidate Detail 全部 13 项测试通过！')
