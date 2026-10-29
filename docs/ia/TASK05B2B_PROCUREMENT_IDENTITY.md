# KUAIJING-IA-REFACTOR-V1 · TASK 05B-2B 实施报告
## Phase 5 Procurement UID 稳定身份与 Legacy Backfill

> **实施性质**：Phase 5 采购验证数据身份加固。  
> **核心目标**：根除 `ManualProcurementWorkbench` 与 `mi_manual_procurement_quotes` 长期存在的 `niche.name` 脆弱索引问题，实现 UID-first 稳定机器身份与 Legacy 别名双向兼容。  
> **实施边界**：仅加固采购身份解析与存储链路；禁止修改 Candidate UI、禁止复制采购数据到 Candidate、禁止创建新 Store。

---

### 一、旧 NAME_KEYED 问题审计

在 TASK 05B-2A 审计中发现：
1. **调用参数截断**：`ManualProcurementWorkbench.jsx` 在执行 `handleSaveDraft` 时调用了 `saveManualQuote(niche.name, quoteData)`。虽然底层 `miStore.js` 支持对象入参并尝试读取 `nicheIdentifier?.uid`，但由于前端直接传递了字符串 `niche.name`，导致 `typeof nicheIdentifier === 'string'`，`nicheUid` 始终为 `null`。
2. **纯名称索引的脆弱性**：`getManualQuotes()` 持久化表完全按商品中文名索引（如 `quotes['发泡胶枪']`）。当俄罗斯市场情报中的利基更名（例如“发泡胶枪”重命名为“聚氨酯发泡胶枪”）、同名不同规格利基碰撞、或 Candidate 名称被微调时，采购草稿与报价数据立刻断链丢失。
3. **数据跨系统失联**：在 TASK 05A-2 中，我们已经为 Candidate 建立了稳定的 `source_niche_uid`（如 `wb_niche_d0198d600bed`），但因为 Phase 5 未能记录和索引该 UID，导致 Candidate 无法通过稳定机器身份关联到对应的采购验证数据。

---

### 二、UID-first Lookup 策略

新建纯函数模块 [`ozon-react/src/utils/marketIntelligence/procurementIdentity.js`](file:///d:/ozon/ozon-react/src/utils/marketIntelligence/procurementIdentity.js)，确立三步稳定查找契约：

```javascript
export function findProcurementQuote(quotes, niche) {
  if (!quotes || typeof quotes !== 'object') return null
  const { uid, name } = buildProcurementIdentity(niche)

  // STEP 1: 优先以 UID 匹配稳定机器身份
  if (uid && quotes[uid]) return quotes[uid]

  // STEP 2: 降级回退到 Legacy Name 匹配历史数据
  if (name && quotes[name]) return quotes[name]

  // STEP 3: 均未命中返回 null
  return null
}
```

* **UID 解析优先级**：`resolveProcurementNicheUid(niche)` 严格按 `uid > niche_uid` 优先级解析，空字符串归一为 `null`，严禁伪造。
* **零 Fuzzy Match**：完全基于精准 key 索引，坚决杜绝模糊字符串包含匹配。

---

### 三、UID + Name 双键兼容写入

在 [`ozon-react/src/utils/marketIntelligence/miStore.js`](file:///d:/ozon/ozon-react/src/utils/marketIntelligence/miStore.js#L226-L245) 的 `saveManualQuote` 中实施双键写入：

```javascript
export function saveManualQuote(nicheIdentifier, quoteData, oldData = null) {
  const all = getManualQuotes()
  const { uid: nicheUid, name: nicheName } = typeof nicheIdentifier === 'string'
    ? { uid: null, name: nicheIdentifier.trim() }
    : buildProcurementIdentity(nicheIdentifier)

  const entry = {
    ...quoteData,
    uid: nicheUid,
    name: nicheName,
    updatedAt: new Date().toISOString(),
  }

  // 1. 保留 Name 别名以保持旧系统与历史页面完全兼容
  if (nicheName) {
    all[nicheName] = entry
  }
  // 2. 建立 UID 稳定主键索引
  if (nicheUid) {
    all[nicheUid] = entry
  }
  persistSet(PERSIST_KEY_MANUAL_QUOTES, all)
  ...
}
```

* **双键定位同一数据**：`all[uid]` 与 `all[name]` 指向同一个 Quote 对象，避免产生两份独立记录。
* **真实 UID 保全**：`entry.uid` 始终保存有效 `nicheUid`，不再出现 `uid: null` 降级。

---

### 四、Legacy Backfill 机制

* **非侵入式原地平滑回填**：不运行批量迁移脚本，也不在组件 Mount 时静默重写存储，避免污染历史冷数据。
* **显式触发机制**：
  1. 用户打开历史旧利基（历史存储中仅有 `quotes['发泡胶枪']`，`uid` 为 `null`）。
  2. `ManualProcurementWorkbench` 挂载时通过 `findProcurementQuote(all, niche)` 触发 STEP 2 回退，安全读取到旧名称报价。
  3. 用户在表单中核实/修改并点击 [保存采购草稿] 时，`saveManualQuote(niche, ...)` 接收完整的 `niche` 对象，自动补齐 `quotes[niche.uid]` 索引，并将 `quotes[niche.name].uid` 同步更新为有效 UID。
  4. 既有旧数据在用户下一次正常编辑保存时即完成无感升级。

---

### 五、Rename Safety（利基更名安全性）

* **业务痛点**：以往选品批次更替或人工优化品类名称后，原利基的 1688 报价、出厂价、实测尺寸全部丢失。
* **加固保障**：
  * 利基更名前：`quotes['UID-A']` 与 `quotes['发泡胶枪']` 均可查。
  * 利基更名为“聚氨酯发泡胶枪”后：`findProcurementQuote` 第一步通过 `UID-A` 精确命中原采购数据，表单完整还原。
  * 再次保存后：`quotes['UID-A']` 继续指向最新数据，同时自动建立新名称别名 `quotes['聚氨酯发泡胶枪']`。

---

### 六、Same-name Different-UID Safety（同名不同 UID 防碰撞）

* **业务痛点**：两个不同细分市场或不同规格的利基同名为“防护手套”（如一个为丁腈劳保，一个为医用乳胶），在旧机制下会导致后保存的报价覆盖前一个报价。
* **加固保障**：
  * `UID-GLOVE-NITRILE` 保存丁腈手套报价（出厂价 ¥2.5）。
  * `UID-GLOVE-LATEX` 保存乳胶手套报价（出厂价 ¥4.0）。
  * 机器定位严格优先使用各自的 UID，`findProcurementQuote(quotes, nicheA)` 和 `findProcurementQuote(quotes, nicheB)` 分别读取到各自独立报价，彻底杜绝数据串扰。

---

### 七、Candidate Identity 可定位性

* Candidate 在 TASK 05A-2 中已固化结构化来源字段：
  * `candidate.source_niche_uid`
  * `candidate.candidateName`
* 经本次采购身份加固后，Candidate 上下文可直接调用：
  ```javascript
  const quote = findProcurementQuote(quotes, {
    uid: candidate.source_niche_uid,
    name: candidate.candidateName,
  })
  ```
  实现 100% 确定性的精准定位，为后续 Candidate Detail 采购展示提供了坚实的数据底座。

---

### 八、安全边界说明（本轮明确未做项）

* **未修改 Candidate UI**：`CandidateDetailDrawer.jsx` 保持 4 个 Tab，未新增采购 Tab（留待 TASK 05B-2C）。
* **未复制采购数据至 Candidate**：严格维护单一事实源原则，Phase 5 采购数据事实源保持在 `mi_manual_procurement_quotes`。
* **未修改 T6 Store Schema**：未向 `t6.candidate` 注入任何冗余采购字段。
* **未改动原有推候选链路**：`ManualProcurementWorkbench` 内部推送 T6 候选时继续传递原始 `niche` 对象，保留原有的 Notes 文本拼接兼容。
* **未改动 Persistence Key**：维持 `mi_manual_procurement_quotes`，杜绝数据存储版本分裂。

---

### 九、自动化测试套件验证结果

新建专项契约与行为测试套件 [`tests/ia-procurement-identity.test.mjs`](file:///d:/ozon/tests/ia-procurement-identity.test.mjs)，包含 13 项关键断言：
```text
===== IA Procurement Identity Test Suite =====

TEST 1: UID Resolver 优先级与空串防御
  ✅ UID 解析优先级 (uid > niche_uid) 与空串归一通过
TEST 2: buildProcurementIdentity 结构契约
  ✅ buildProcurementIdentity 返回标准 { uid, name } 契约通过
TEST 3: UID lookup 优先级高于 name
  ✅ UID 命中时优先返回 UID 记录通过
TEST 4: Legacy Name 回退读取
  ✅ Legacy Name 回退与无记录返回 null 通过
TEST 5: 新记录保存写入 UID 索引
  ✅ saveManualQuote 成功建立 UID 索引通过
TEST 6: 新记录保存保留 Name Alias
  ✅ saveManualQuote 双键写入保留 Name Alias 通过
TEST 7: entry.uid 存储真实 UID
  ✅ entry.uid 保持真实 UID 而非 null 校验通过
TEST 8: 无 UID 的 Legacy Niche 兼容
  ✅ 无 UID 纯名称保存与读取兼容通过
TEST 9: 利基更名安全性 (Rename Safety)
  ✅ Rename 场景下基于 UID 的稳定数据延续校验通过
TEST 10: 同名不同 UID 物理隔离与防碰撞
  ✅ 同名不同 UID 物理隔离，各自报价互不串扰通过
TEST 11: Candidate Identity 对拍测试 (通过 source_niche_uid 定位 Phase 5)
  ✅ Candidate.source_niche_uid 对拍定位 Phase 5 报价通过
TEST 12: Legacy Quote Backfill 测试
  ✅ Legacy Quote Backfill 机制验证通过
TEST 13: ManualProcurementWorkbench 源码契约校验
  ✅ ManualProcurementWorkbench 契约与调用链校验通过

🎉 IA Procurement Identity 全部 13 项测试通过！
```
