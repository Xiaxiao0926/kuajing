/**
 * tests/candidate-identity-backfill.test.mjs
 * 验证 Work Package C：候选身份防错配与历史回填 (Candidate Identity & Legacy Backfill)
 *
 * 验收目标：
 * 1. 无 UID 阻断：利基缺少 nicheUid 时立即阻断推进并抛出标准错误，严禁写入脏数据
 * 2. 同 UID 幂等性：同一 nicheUid 连续推流，保持 candidate.id 唯一不变，created=false，仅刷新 marketEvidence
 * 3. 同名不同类目隔离：同产品名但类目矛盾时，严禁复用旧候选，必须保留旧候选原样并生成独立新候选
 * 4. 身份不充分防护：旧候选类目缺失或为“未分类”时，不盲目回填，生成新候选
 * 5. 冲突 UID 防护：旧候选已记录其他 UID 时，严禁覆盖复用
 * 6. 合法历史回填：同名、同类目、无 UID 冲突时合法回填，保留 candidate.id、sourceProductId、业务状态、负责人与项目引用
 */
import assert from 'node:assert/strict'
import * as t6Store from '../ozon-react/src/utils/t6/t6Store.js'
import { promoteToT6Candidate } from '../ozon-react/src/utils/marketIntelligence/miStore.js'

console.log('===== [TEST SUITE 3] Candidate Identity & Legacy Backfill Test Suite =====\n')

// 隔离内存存储配置
const mem = new Map()
const auditLogsRecorded = []

global.fetch = async (url, opts = {}) => {
  if (String(url).includes('audit-log')) {
    try {
      auditLogsRecorded.push(JSON.parse(opts?.body || '{}'))
    } catch {}
    return { ok: true, json: async () => ({ success: true }) }
  }
  return { ok: true, json: async () => ({}) }
}

t6Store._setAdapterForTests({
  get: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null),
  set: (k, v) => mem.set(k, JSON.stringify(v)),
  remove: (k) => mem.delete(k),
  keys: () => [...mem.keys()],
})

function resetStore() {
  mem.clear()
  auditLogsRecorded.length = 0
}

// ----------------------------------------------------
// 1. 无 UID 阻断测试 (Missing UID fail-close)
// ----------------------------------------------------
console.log('--- 1. 无 UID 阻断测试 (Missing UID Fail-Close) ---')
{
  resetStore()

  // 1.1 缺少 uid / niche_uid 的利基对象
  const nicheWithoutUid = {
    id: 101,
    name: '无UID商品测试',
    category: '家居百货',
    mos: 80,
    price: 50,
  }

  assert.throws(
    () => promoteToT6Candidate(nicheWithoutUid, '测试缺少UID推流'),
    /缺少有效 nicheUid/,
    '缺少 nicheUid 时必须阻断推流并抛出标准错误'
  )

  // 验证 T6 Store 中未写入任何候选记录
  const allCandidates = t6Store.listCandidates()
  assert.strictEqual(allCandidates.length, 0, '阻断推流后 T6 候选池必须为 0，严禁脏数据入库')
  console.log('  ✅ 1.1 无 UID 利基被成功阻断，Store 保持干净 (0 条脏记录)')
}

// ----------------------------------------------------
// 2. 同 UID 幂等性测试 (Same UID Idempotency)
// ----------------------------------------------------
console.log('\n--- 2. 同 UID 幂等性与证据刷新测试 ---')
{
  resetStore()

  const nicheA = {
    id: 201,
    uid: 'wb_niche_foam_gun_001',
    name: '发泡胶枪',
    category: '手动工具及配件',
    mos: 85,
    cfs: 90,
    price: 45,
  }

  // 第一次推流
  const res1 = promoteToT6Candidate(nicheA, '第一次建档', 'RUN-20260917-001')
  assert.ok(res1.candidate, '第一次推流必须成功创建 candidate')
  assert.strictEqual(res1.created, true, '第一次推流 created 必须为 true')
  assert.strictEqual(res1.candidate.sourceProductId, 'wb-niche-wb_niche_foam_gun_001', '必须使用稳定 UID 键')
  assert.strictEqual(res1.candidate.source_niche_uid, 'wb_niche_foam_gun_001')
  const candId = res1.candidate.id

  // 第二次推流（相同 UID，新批次证据）
  const res2 = promoteToT6Candidate(nicheA, '第二次同步证据', 'RUN-20261001-001')
  assert.strictEqual(res2.created, false, '第二次推流 created 必须为 false (防重生效)')
  assert.strictEqual(res2.candidate.id, candId, '候选 ID 必须保持唯一不变')
  assert.strictEqual(res2.candidate.source_run_id, 'RUN-20261001-001', '市场证据批次成功刷新')

  // 验证全局候选总数仍为 1
  assert.strictEqual(t6Store.listCandidates().length, 1, 'Store 内严格只有 1 条候选记录')
  console.log('  ✅ 2.1 同 UID 幂等性验证通过：同一 candidateId，证据无损刷新')
}

// ----------------------------------------------------
// 3. 同名不同类目隔离测试 (Cross-Category Isolation)
// ----------------------------------------------------
console.log('\n--- 3. 同名不同类目防错配隔离测试 ---')
{
  resetStore()

  // 事先存在一条历史候选：名为“发泡胶枪”，但类目是“汽车配件及改装件”，且已立项关联项目
  const legacyAutoCand = t6Store.ensureCandidate({
    sourceProductId: 'wb-niche-发泡胶枪',
    candidateIndex: 1,
    name: '发泡胶枪',
    categoryLeaf: '汽车配件及改装件',
    categoryFull: '汽车配件及改装件',
    notes: '旧汽车五金项目历史数据',
  }).candidate

  // 模拟旧项目引用与业务状态
  t6Store.setCandidateBizStatus(legacyAutoCand.id, '待立项', '旧项目推进中')
  t6Store.setCandidateOwner(legacyAutoCand.id, '李主管')
  const candRec = t6Store.getCandidate(legacyAutoCand.id)
  candRec.projectIds = ['proj-auto-999']
  mem.set(`t6.candidate.${legacyAutoCand.id}`, JSON.stringify(candRec))

  // 现在从市场情报推入一个同名为“发泡胶枪”，但类目为“手动工具及配件”的新利基
  const newToolNiche = {
    id: 301,
    uid: 'wb_niche_hand_tool_002',
    name: '发泡胶枪',
    category: '手动工具及配件',
    mos: 77,
    price: 35,
  }

  const res = promoteToT6Candidate(newToolNiche, '新工具类目推流', 'RUN-20261001-001')

  // 必须创建新候选，绝不可复用汽车配件的旧候选！
  assert.strictEqual(res.created, true, '同名不同类目严禁复用，必须 created=true')
  assert.notStrictEqual(res.candidate.id, legacyAutoCand.id, '新候选 ID 必须独立于旧候选')
  assert.strictEqual(res.candidate.sourceProductId, 'wb-niche-wb_niche_hand_tool_002', '新候选使用自身的 UID 构造 sourceProductId')
  assert.strictEqual(res.candidate.categoryLeaf, '手动工具及配件', '新候选保持手动工具类目')

  // 检查旧候选完好无损
  const preservedLegacy = t6Store.getCandidate(legacyAutoCand.id)
  assert.strictEqual(preservedLegacy.sourceProductId, 'wb-niche-发泡胶枪', '旧候选 sourceProductId 保持原样')
  assert.strictEqual(preservedLegacy.categoryLeaf, '汽车配件及改装件', '旧候选类目未被篡改')
  assert.strictEqual(preservedLegacy.bizStatus, '待立项', '旧候选业务状态保持原样')
  assert.strictEqual(preservedLegacy.owner, '李主管', '旧候选负责人未被覆盖')
  assert.deepStrictEqual(preservedLegacy.projectIds, ['proj-auto-999'], '旧候选的项目引用完好保留')
  assert.strictEqual(preservedLegacy.source_niche_uid, undefined, '旧候选未被错误补入新 UID')

  // 总记录数应为 2
  assert.strictEqual(t6Store.listCandidates().length, 2, 'T6 候选池中两单品互不干扰并存')
  console.log('  ✅ 3.1 同名不同类目成功隔离：未串入新数据，旧候选业务字段与项目引用 100% 完整保留')
}

// ----------------------------------------------------
// 4. 身份信息不充分防误伤测试 (Insufficient Info Protection)
// ----------------------------------------------------
console.log('\n--- 4. 身份信息不充分防误伤测试 ---')
{
  resetStore()

  // 历史候选类目为“未分类”
  const legacyUnclassified = t6Store.ensureCandidate({
    sourceProductId: 'wb-niche-热缩管',
    candidateIndex: 2,
    name: '热缩管',
    categoryLeaf: '未分类',
    categoryFull: '未分类',
  }).candidate

  // 新利基有明确类目“电工电气”
  const nicheElectric = {
    id: 401,
    uid: 'wb_niche_electric_tube_003',
    name: '热缩管',
    category: '电工电气',
    mos: 82,
    price: 12,
  }

  const res = promoteToT6Candidate(nicheElectric, '电工电气热缩管推流')
  // 信息不充分时不盲目回填，创建独立候选
  assert.strictEqual(res.created, true, '旧类目未分类时不自动回填，创建新候选')
  assert.notStrictEqual(res.candidate.id, legacyUnclassified.id)
  assert.strictEqual(res.candidate.sourceProductId, 'wb-niche-wb_niche_electric_tube_003')
  console.log('  ✅ 4.1 旧候选类目信息不充分时安全创建新候选，杜绝盲目挂载')
}

// ----------------------------------------------------
// 5. 冲突 UID 防护测试 (Conflicting UID Protection)
// ----------------------------------------------------
console.log('\n--- 5. 冲突 UID 防护测试 ---')
{
  resetStore()

  // 历史候选已经有另外一个 UID
  const legacyWithOtherUid = t6Store.ensureCandidate({
    sourceProductId: 'wb-niche-万向轮',
    candidateIndex: 3,
    name: '万向轮',
    categoryLeaf: '工业五金',
    categoryFull: '工业五金',
    source_niche_uid: 'wb_niche_wheel_existing_111',
  }).candidate

  // 新利基带不同 UID
  const nicheWheelNew = {
    id: 501,
    uid: 'wb_niche_wheel_different_222',
    name: '万向轮',
    category: '工业五金',
    mos: 70,
    price: 25,
  }

  const res = promoteToT6Candidate(nicheWheelNew, '不同UID利基推流')
  assert.strictEqual(res.created, true, '旧候选已有其他 UID 时严禁复用')
  assert.notStrictEqual(res.candidate.id, legacyWithOtherUid.id)
  assert.strictEqual(res.candidate.source_niche_uid, 'wb_niche_wheel_different_222')
  console.log('  ✅ 5.1 冲突 UID 拦截生效：严禁覆写已有不同 UID 的候选')
}

// ----------------------------------------------------
// 6. 合法历史候选回填测试 (Legitimate Backfill with Strong Identity)
// ----------------------------------------------------
console.log('\n--- 6. 合法历史候选回填与业务数据保留测试 ---')
{
  resetStore()

  // 创建合法历史候选（无 UID，但名、类目、来源ID '601' 均明确且强一致）
  const legacyValid = t6Store.ensureCandidate({
    sourceProductId: 'wb-niche-拖车支轮',
    candidateIndex: 601,
    name: '拖车支轮',
    categoryLeaf: '汽车配件及改装件',
    categoryFull: '汽车配件及改装件',
    notes: '早期市场手工调研候选单品',
    source_niche_id: '601',
    source_system: 'WB_MARKET_INTELLIGENCE',
  }).candidate

  t6Store.setCandidateBizStatus(legacyValid.id, '待立项', '样品审核已通过')
  t6Store.setCandidateOwner(legacyValid.id, '王经理')
  const validRec = t6Store.getCandidate(legacyValid.id)
  validRec.projectIds = ['proj-trailer-001']
  mem.set(`t6.candidate.${legacyValid.id}`, JSON.stringify(validRec))

  // 推入带 UID 的同品类同来源ID拖车支轮
  const nicheTrailer = {
    id: 601,
    uid: 'wb_niche_trailer_wheel_666',
    name: '拖车支轮',
    category: '汽车配件及改装件',
    mos: 80.7,
    cfs: 100,
    price: 244,
  }

  const res = promoteToT6Candidate(nicheTrailer, '历史合法回填推流', 'RUN-20261001-002')

  // 必须合法回填复用旧候选！
  assert.strictEqual(res.created, false, '合法历史候选必须 created=false 成功回填')
  assert.strictEqual(res.candidate.id, legacyValid.id, '必须保持原 candidate.id')
  assert.strictEqual(res.candidate.sourceProductId, 'wb-niche-拖车支轮', '保留原 sourceProductId')
  assert.strictEqual(res.candidate.bizStatus, '待立项', '业务状态绝不被覆盖')
  assert.strictEqual(res.candidate.owner, '王经理', '负责人绝不被覆盖')
  assert.deepStrictEqual(res.candidate.projectIds, ['proj-trailer-001'], '关联项目指针完好保留')
  assert.strictEqual(res.candidate.notes, '早期市场手工调研候选单品', '人工备注绝不丢失')

  // 成功补充新身份字段与新证据
  assert.strictEqual(res.candidate.source_niche_uid, 'wb_niche_trailer_wheel_666', '正确补齐 source_niche_uid')
  assert.strictEqual(res.candidate.source_run_id, 'RUN-20261001-002', '更新最新 run_id')
  assert.strictEqual(res.candidate.source_system, 'WB_MARKET_INTELLIGENCE')

  // Store 内依然保持 1 条记录
  assert.strictEqual(t6Store.listCandidates().length, 1, '回填后无冗余重复候选')
  console.log('  ✅ 6.1 合法历史回填测试完全通过：旧 ID/指针/业务状态/负责人/项目指针无损保留，新 UID 与证据平滑补齐')
}

// ----------------------------------------------------
// 7. 隔离 Store 反例：同名同类不同来源 ID 严禁篡改旧记录 (Source Niche ID Conflict)
// ----------------------------------------------------
console.log('\n--- 7. 来源利基 ID 不一致隔离反例 (旧101 vs 新999 字节级不变断言) ---')
{
  resetStore()

  // 在隔离内存 Store 中创建旧候选：sourceProductId=wb-niche-手套、source_niche_id=101、类目“劳保”，旧 UID 缺失
  const legacyGlove = t6Store.ensureCandidate({
    sourceProductId: 'wb-niche-手套',
    candidateIndex: 101,
    name: '手套',
    categoryLeaf: '劳保',
    categoryFull: '劳保用品',
    notes: '旧批次 101 号手套历史立项单品',
    source_niche_id: '101',
    source_system: 'WB_MARKET_INTELLIGENCE',
  }).candidate

  t6Store.setCandidateBizStatus(legacyGlove.id, '待立项', '已进入工厂样品试制')
  t6Store.setCandidateOwner(legacyGlove.id, '周主管')
  const gloveRec = t6Store.getCandidate(legacyGlove.id)
  gloveRec.projectIds = ['proj-glove-101']
  gloveRec.snapshotIds = ['snap-market-101']
  mem.set(`t6.candidate.${legacyGlove.id}`, JSON.stringify(gloveRec))

  // 记录推送前旧候选的完整字节快照
  const oldGloveSnapshot = JSON.stringify(t6Store.getCandidate(legacyGlove.id))

  // 推送同名同类同来源系统、但 id=999、uid=new-999 的新利基
  const newGloveNiche = {
    id: 999,
    uid: 'new-999',
    name: '手套',
    category: '劳保',
    mos: 92,
    cfs: 95,
    price: 68,
  }

  const res = promoteToT6Candidate(newGloveNiche, '新利基999号推流', 'RUN-20261217-001')

  // 断言：由于 source_niche_id (101 vs 999) 冲突，严禁复用旧候选！
  assert.strictEqual(res.created, true, '同名同类但来源 ID 冲突时必须 created=true，生成全新候选')
  assert.notStrictEqual(res.candidate.id, legacyGlove.id, '新候选 ID 必须与旧候选严格隔离')
  assert.strictEqual(res.candidate.sourceProductId, 'wb-niche-new-999', '新候选使用自身的稳定 UID 键')
  assert.strictEqual(res.candidate.source_niche_id, '999', '新候选记录正确的 999 来源 ID')
  assert.strictEqual(res.candidate.source_niche_uid, 'new-999', '新候选记录正确的 new-999 UID')

  // 严格字节级不变断言：旧候选的内容绝对未被任何修改或覆盖
  const currentOldGlove = JSON.stringify(t6Store.getCandidate(legacyGlove.id))
  assert.strictEqual(
    currentOldGlove,
    oldGloveSnapshot,
    '旧候选必须保持 100% 字节级不变，严禁篡改来源 ID、UID、项目/快照指针与业务备注'
  )

  // 检查 Store 中两个候选并存
  const allCandidates = t6Store.listCandidates()
  assert.strictEqual(allCandidates.length, 2, '候选池中应有两个相互隔离的候选记录')
  console.log('  ✅ 7.1 来源利基 ID 不一致隔离反例验证通过：旧记录 100% 字节级不变，新利基独立建档')
}

// ----------------------------------------------------
// 8. STEP 2 稳定 Product ID 冲突 UID 防护测试
// ----------------------------------------------------
console.log('\n--- 8. STEP 2 稳定 Product ID 冲突 UID 防护测试 ---')
{
  resetStore()

  // 模拟已存在一个候选，其 sourceProductId 相同但内部 source_niche_uid 与当前不一致
  const clashCandidate = t6Store.ensureCandidate({
    sourceProductId: 'wb-niche-uid_clash_test_001',
    candidateIndex: 55,
    name: '测试商品',
    categoryLeaf: '数码配件',
    categoryFull: '数码配件',
    source_niche_uid: 'clashing_old_uid_999',
    source_system: 'WB_MARKET_INTELLIGENCE',
    source_niche_id: '55',
  }).candidate

  const beforeJson = JSON.stringify(t6Store.getCandidate(clashCandidate.id))

  // 尝试用 uid='uid_clash_test_001' 推送
  const incomingNiche = {
    id: 55,
    uid: 'uid_clash_test_001',
    name: '测试商品',
    category: '数码配件',
    mos: 60,
    price: 30,
  }

  // STEP 2 命中 sourceProductId 但发现已有记录绑定了 clashing_old_uid_999，必须阻断推流并抛出冲突异常
  assert.throws(
    () => promoteToT6Candidate(incomingNiche, 'UID冲突推流测试'),
    /身份冲突阻断/,
    '已有候选已绑定其他 UID 时严禁复用，必须抛出身份冲突阻断异常'
  )
  assert.strictEqual(
    JSON.stringify(t6Store.getCandidate(clashCandidate.id)),
    beforeJson,
    '被冲突的已有候选字节级不变'
  )
  console.log('  ✅ 8.1 STEP 2 冲突 UID 防护验证通过：严禁覆盖已有不同 UID 候选，旧候选字节级完整')
}

// ----------------------------------------------------
// 9. STEP 2 隔离反例：稳定 Product ID 相同但旧记录缺少 UID/来源字段，且名称/类目不一致 (Fail-Close)
// ----------------------------------------------------
console.log('\n--- 9. STEP 2 隔离反例：稳定 Product ID 相同但旧记录缺少 UID/来源且名称类目不一致 (Fail-Close) ---')
{
  resetStore()

  // 在隔离内存 Store 中创建旧候选：sourceProductId=wb-niche-u-1，缺少 UID/来源字段，名称 Old，类目 A
  const existingOld = t6Store.ensureCandidate({
    sourceProductId: 'wb-niche-u-1',
    candidateIndex: 10,
    name: 'Old',
    categoryLeaf: 'A',
    categoryFull: 'A',
    notes: '旧无UID项目历史单品',
  }).candidate

  t6Store.setCandidateBizStatus(existingOld.id, '待立项', '历史评审中')
  t6Store.setCandidateOwner(existingOld.id, '老赵')
  const candRec = t6Store.getCandidate(existingOld.id)
  candRec.projectIds = ['proj-legacy-old-100']
  mem.set(`t6.candidate.${existingOld.id}`, JSON.stringify(candRec))

  // 记录旧候选完整快照、Store 条数、审计日志数与决策日志数
  const oldSnapshot = JSON.stringify(t6Store.getCandidate(existingOld.id))
  const logCountBefore = t6Store.listLogs().length
  const auditCountBefore = auditLogsRecorded.length

  // 新利基：UID=u-1 (构造相同的 stableSourceProductId: wb-niche-u-1)，名称 New，类目 B，ID 999
  const newNiche = {
    id: 999,
    uid: 'u-1',
    name: 'New',
    category: 'B',
    mos: 88,
    price: 99,
  }

  // STEP 2 命中 stableSourceProductId，但旧记录缺少 UID/来源字段且名称和类目均冲突，严禁将新证据写入旧候选！
  assert.throws(
    () => promoteToT6Candidate(newNiche, '旧候选名称类目冲突推流'),
    /身份冲突阻断/,
    '稳定 Product ID 相同但旧记录缺少 UID 且名称类目不一致时必须阻断并抛出异常'
  )

  // 断言：旧候选 100% 字节级不变
  assert.strictEqual(
    JSON.stringify(t6Store.getCandidate(existingOld.id)),
    oldSnapshot,
    '旧候选必须保持 100% 字节级不变（严禁被注入新 UID、新证据或篡改名称/类目）'
  )

  // 断言：零新增审计成功日志与决策日志
  assert.strictEqual(auditLogsRecorded.length, auditCountBefore, '阻断推流后严禁产生新增审计成功日志 (0条)')
  assert.strictEqual(t6Store.listLogs().length, logCountBefore, '阻断推流后严禁产生新增决策日志 (0条)')
  assert.strictEqual(t6Store.listCandidates().length, 1, '候选池总数严格保持 1 条')
  console.log('  ✅ 9.1 STEP 2 隔离反例验证通过：旧记录 100% 字节级不变，0 新增审计/决策日志')
}

// ----------------------------------------------------
// 10. STEP 4 / 伪成功防范隔离反例：稳定 Product ID 相同且旧记录 source_system=OTHER，严禁伪报同步成功
// ----------------------------------------------------
console.log('\n--- 10. STEP 4 / 伪成功防范反例：稳定 Product ID 相同且旧记录 source_system=OTHER ---')
{
  resetStore()

  // 在隔离内存 Store 中创建旧候选：sourceProductId=wb-niche-u-step4-other，但 source_system=OTHER
  const existingOther = t6Store.ensureCandidate({
    sourceProductId: 'wb-niche-u-step4-other',
    candidateIndex: 20,
    name: 'OtherCandidate',
    categoryLeaf: 'CatX',
    categoryFull: 'CatX',
    notes: '来自非 WB 系统的历史单品',
    source_system: 'OTHER',
  }).candidate

  t6Store.setCandidateBizStatus(existingOther.id, '观察', '外部系统监控')
  const oldSnapshot = JSON.stringify(t6Store.getCandidate(existingOther.id))
  const logCountBefore = t6Store.listLogs().length
  const auditCountBefore = auditLogsRecorded.length

  // 新利基：UID=u-step4-other，系统 WB_MARKET_INTELLIGENCE
  const incomingOtherNiche = {
    id: 777,
    uid: 'u-step4-other',
    name: 'OtherCandidate',
    category: 'CatX',
    mos: 65,
    price: 40,
  }

  // 严禁 STEP 4 调用 ensureCandidate() 返回旧记录并伪报同步成功！必须显式抛出身份冲突阻断
  assert.throws(
    () => promoteToT6Candidate(incomingOtherNiche, '跨系统 Product ID 占用测试'),
    /身份冲突阻断/,
    '稳定 Product ID 已被 OTHER 系统占用时必须阻断，严禁返回 created=false 并伪报同步成功'
  )

  // 断言：旧候选 100% 字节级不变
  assert.strictEqual(
    JSON.stringify(t6Store.getCandidate(existingOther.id)),
    oldSnapshot,
    '旧候选必须保持 100% 字节级不变'
  )

  // 断言：零新增审计成功日志与决策日志
  assert.strictEqual(auditLogsRecorded.length, auditCountBefore, '严禁产生新增审计成功日志 (0条)')
  assert.strictEqual(t6Store.listLogs().length, logCountBefore, '严禁产生新增决策日志 (0条)')
  assert.strictEqual(t6Store.listCandidates().length, 1, '候选池总数严格保持 1 条')
  console.log('  ✅ 10.1 STEP 4 伪成功防护反例验证通过：成功阻断外部系统占用，旧记录字节级完整，0 审计日志')
}

// ----------------------------------------------------
// 11. STEP 1 跨系统/类目碰撞隔离反例：同 UID 但旧记录显式属于 OTHER 来源系统且类目冲突
// ----------------------------------------------------
console.log('\n--- 11. STEP 1 跨系统/类目碰撞反例：同 UID 但旧记录为 OTHER 且类目不同 ---')
{
  resetStore()

  // 旧候选显式 source_niche_uid=u-step1-cross，source_niche_id=101，source_system=OTHER，类目 CatA
  const existingCross = t6Store.ensureCandidate({
    sourceProductId: 'wb-niche-cross-system-cand-01',
    candidateIndex: 101,
    name: 'OldSystemCandidate',
    categoryLeaf: 'CatA',
    categoryFull: 'CatA',
    source_niche_uid: 'u-step1-cross',
    source_niche_id: '101',
    source_system: 'OTHER',
    notes: '外部 ERP 来源候选单品',
  }).candidate

  t6Store.setCandidateBizStatus(existingCross.id, '待调研', '外部同步商品')
  const candRec = t6Store.getCandidate(existingCross.id)
  candRec.projectIds = ['proj-erp-101']
  candRec.snapshotIds = ['snap-erp-101']
  mem.set(`t6.candidate.${existingCross.id}`, JSON.stringify(candRec))

  const oldSnapshot = JSON.stringify(t6Store.getCandidate(existingCross.id))
  const logCountBefore = t6Store.listLogs().length
  const auditCountBefore = auditLogsRecorded.length

  // 新利基：相同 UID u-step1-cross，但 ID 999，类目 CatB，名称 NewSystemCandidate
  const incomingCrossNiche = {
    id: 999,
    uid: 'u-step1-cross',
    name: 'NewSystemCandidate',
    category: 'CatB',
    mos: 91,
    price: 85,
  }

  // STEP 1 命中 UID 但发现已有记录 source_system=OTHER 且类目/名称冲突，严禁自动覆盖旧来源与证据！
  assert.throws(
    () => promoteToT6Candidate(incomingCrossNiche, '同UID跨系统类目冲突推流'),
    /身份冲突阻断/,
    '同 UID 但旧候选显式为 OTHER 系统或类目冲突时必须阻断，严禁覆盖旧来源与证据'
  )

  // 断言：旧候选 100% 字节级不变（来源系统依然为 OTHER，source_niche_id 依然为 101，未被改写为 WB_MARKET_INTELLIGENCE 或 999）
  const currentCross = t6Store.getCandidate(existingCross.id)
  assert.strictEqual(
    JSON.stringify(currentCross),
    oldSnapshot,
    '旧候选必须保持 100% 字节级不变，严禁改写来源系统与来源 ID'
  )
  assert.strictEqual(currentCross.source_system, 'OTHER', '来源系统保持 OTHER')
  assert.strictEqual(currentCross.source_niche_id, '101', '来源 ID 保持 101')
  assert.strictEqual(currentCross.marketEvidence, undefined, '严禁向跨系统旧记录写入市场证据')

  // 断言：零新增审计成功日志与决策日志
  assert.strictEqual(auditLogsRecorded.length, auditCountBefore, '严禁产生新增审计成功日志 (0条)')
  assert.strictEqual(t6Store.listLogs().length, logCountBefore, '严禁产生新增决策日志 (0条)')
  assert.strictEqual(t6Store.listCandidates().length, 1, '候选池总数严格保持 1 条')
  console.log('  ✅ 11.1 STEP 1 跨系统/类目碰撞反例验证通过：旧记录 100% 字节级不变，0 覆盖，0 审计日志')
}

// ----------------------------------------------------
// 12. 合法跨批次重复推流验证：同 UID、同来源系统、同类目、随批次排名变化正常刷新证据
// ----------------------------------------------------
console.log('\n--- 12. 合法跨批次重复推流验证 (同 UID/来源/类目/名称，不同批次与排名正常刷新) ---')
{
  resetStore()

  const multiRunNiche = {
    id: 10,
    uid: 'wb_niche_legit_repeat_001',
    name: '多批次稳健单品',
    category: '工业五金',
    mos: 85,
    cfs: 90,
    price: 55,
  }

  // 批次 1 初次推流
  const res1 = promoteToT6Candidate(multiRunNiche, '批次1推流', 'RUN-20260917-001')
  assert.strictEqual(res1.created, true, '初次推流 created=true')
  assert.strictEqual(res1.candidate.source_run_id, 'RUN-20260917-001')
  assert.strictEqual(res1.candidate.source_niche_id, '10')
  const candId = res1.candidate.id

  // 批次 2 重复推流（同一单品在新批次中排名变为 15，runId 变为 RUN-20261217-001）
  const multiRunNicheRun2 = {
    ...multiRunNiche,
    id: 15, // 排名变化，符合业务实际
    mos: 89, // 新证据指标
  }

  const auditCountBefore = auditLogsRecorded.length
  const res2 = promoteToT6Candidate(multiRunNicheRun2, '批次2证据刷新', 'RUN-20261217-001')

  assert.strictEqual(res2.created, false, '合法重复推流 created=false 幂等复用')
  assert.strictEqual(res2.candidate.id, candId, '候选 ID 保持一致')
  assert.strictEqual(res2.candidate.source_run_id, 'RUN-20261217-001', 'runId 成功刷新至最新批次')
  assert.strictEqual(res2.candidate.source_niche_id, '15', '来源排名 ID 成功更新为新排名')
  assert.strictEqual(res2.candidate.marketEvidence.runId, 'RUN-20261217-001', '证据 runId 成功更新')
  assert.strictEqual(res2.candidate.marketEvidence.mos, 89, '证据指标无损更新')

  // 断言成功记录审计日志
  assert.strictEqual(auditLogsRecorded.length, auditCountBefore + 1, '合法刷新产生 1 条 T6_PUSH 审计日志')
  assert.strictEqual(t6Store.listCandidates().length, 1, '候选总数严格保持 1 条')
  console.log('  ✅ 12.1 合法跨批次重复推流验证通过：同一 candidateId，证据与最新 runId/排名平滑刷新')
}

// ----------------------------------------------------
// 13. STEP 2 来源身份不足隔离反例：同名同类目但旧记录缺少 UID/来源身份 (REVISION-003 Fail-Close)
// ----------------------------------------------------
console.log('\n--- 13. STEP 2 来源身份不足反例：同名同类目但旧记录缺少 UID/来源身份 (Fail-Close) ---')
{
  resetStore()

  // 旧候选：sourceProductId=wb-niche-u-1，名称“手套”，类目“劳保”，无 source_niche_uid、source_niche_id、source_system
  const existingGlove = t6Store.ensureCandidate({
    sourceProductId: 'wb-niche-u-1',
    candidateIndex: 10,
    name: '手套',
    categoryLeaf: '劳保',
    categoryFull: '劳保',
    notes: '旧无来源字段手套候选单品',
  }).candidate

  t6Store.setCandidateBizStatus(existingGlove.id, '待立项', '待定评审')
  t6Store.setCandidateOwner(existingGlove.id, '张主管')
  const candRec = t6Store.getCandidate(existingGlove.id)
  candRec.projectIds = ['proj-legacy-glove-99']
  mem.set(`t6.candidate.${existingGlove.id}`, JSON.stringify(candRec))

  // 记录旧候选完整快照、Store 条数、审计日志数与决策日志数
  const oldSnapshot = JSON.stringify(t6Store.getCandidate(existingGlove.id))
  const logCountBefore = t6Store.listLogs().length
  const auditCountBefore = auditLogsRecorded.length

  // 新利基：uid=u-1 (构造相同的 stableSourceProductId: wb-niche-u-1)，id=999，名称“手套”，类目“劳保” (同名同类)
  const incomingSameNameCatNiche = {
    id: 999,
    uid: 'u-1',
    name: '手套',
    category: '劳保',
    mos: 85,
    cfs: 90,
    price: 35,
  }

  // 必须阻断！禁止仅凭 candidateName 和 categoryLeaf 相同就调用 syncCandidateMarketEvidence() 覆盖旧记录
  assert.throws(
    () => promoteToT6Candidate(incomingSameNameCatNiche, '同名同类缺少UID旧候选推流'),
    /身份冲突阻断/,
    '稳定 Product ID 相同且同名同类目，但旧记录缺少来源 UID 身份凭据时必须阻断并抛出异常'
  )

  // 断言：旧记录 100% 字节级不变（严禁被写入新 UID、新来源 ID 999、新系统或新市场证据）
  assert.strictEqual(
    JSON.stringify(t6Store.getCandidate(existingGlove.id)),
    oldSnapshot,
    '旧候选必须保持 100% 字节级不变'
  )

  // 断言：候选数不变
  assert.strictEqual(t6Store.listCandidates().length, 1, '候选池总数严格保持 1 条')

  // 断言：零新增成功审计日志与决策日志
  assert.strictEqual(auditLogsRecorded.length, auditCountBefore, '阻断推流后严禁产生新增审计成功日志 (0条)')
  assert.strictEqual(t6Store.listLogs().length, logCountBefore, '阻断推流后严禁产生新增决策日志 (0条)')
  console.log('  ✅ 13.1 STEP 2 来源身份不足反例验证通过：同名同类但旧记录缺少 UID 身份时阻断，旧记录 100% 字节级不变，0 新增审计/决策日志')
}

console.log('\n🎉 [PASS] Candidate Identity & Legacy Backfill 全部测试通过！\n')
