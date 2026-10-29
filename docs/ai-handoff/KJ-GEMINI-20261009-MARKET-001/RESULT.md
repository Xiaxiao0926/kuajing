# RESULT.md — 市场分析面板数据正确性修正执行报告 (Revision 003)

> **任务编号**：KJ-GEMINI-20261009-MARKET-001  
> **任务标题**：市场分析面板数据正确性修正  
> **执行角色**：Gemini  
> **独立验收角色**：Codex  
> **修订版本**：Revision 003 (Addressing Third Acceptance Review Blocking Items from `REVIEW.md` line 59-67 & `REVISION-003.md`)  
> **完成状态**：`review_ready`  
> **部署状态**：`not_deployed`（纯本地代码修正与测试，未执行生产部署，零线上写操作）  
> **公开验证状态**：`not_performed`  
> **基线 HEAD**：`de0cecf107e670e1c0d9cf393c50b92ab85afdee` (分支 `feat/platform-calc-parity-20261009`)  

---

## 一、Revision 003 独立验收阻断项修订落实报告

本修订严格依照 `REVISION-003.md` 与 Codex 三次独立验收报告 `REVIEW.md`（59-67行）的阻断项实施。严格遵守 `AGENTS.md` 铁律：
- 零超范围修改：仅修改授权文件 `ozon-react/src/utils/marketIntelligence/miStore.js`、`tests/candidate-identity-backfill.test.mjs` 及交接目录；
- 未修改任何运费/利润/佣金计算公式（`wbEngine.js`、`ozonEngine.js`、`wb_calc.py` 逐字未动）；
- 未触碰 `t6Store.js`；
- 未清理、还原或归功于本轮之外的既有工作树修改；
- 保持 `production_authorized=false`、`deployment_status=not_deployed`。

---

### 1. 阻断项 1：STEP 2 来源身份不足的同名同类目旧候选严禁自动复用与覆写（`miStore.js`）

#### (1) 核查发现的问题分析
- 在 Revision 002 中，`miStore.js` STEP 2 存在 `hasIdenticalNameAndCat` 回退逻辑：
  当稳定 Product ID 命中旧候选，即使旧候选完全缺失 `source_niche_uid`、`source_niche_id` 和 `source_system` 来源身份凭据，只要其 `candidateName` 和 `categoryLeaf/categoryFull` 碰巧与新利基一致（例如均为“手套/劳保”），就会被判定为同一商品并调用 `syncCandidateMarketEvidence()`。
- 这会导致旧候选被改写并强行写入新 UID `u-1` 及新来源 ID 999。
- 业务本质上：名称和类目仅是文本描述，不能证明来源身份。在来源信息不充分时自动覆写旧记录，违背了“信息不足严禁自动同步”的安全原则。此外，由于稳定 `sourceProductId` 已被该不可信记录占用，STEP 4 亦无法安全创建新记录，必须在 STEP 2 执行 fail-close 阻断。

#### (2) 落实方案与代码改动
1. **彻底移除 `hasIdenticalNameAndCat` 弱身份复用逻辑**：
   在 `miStore.js`（lines 369-378）中，严格要求已存在记录必须具备与当前利基一致的 `source_niche_uid`：
   ```javascript
   // 5. 来源身份校验：必须具备与当前利基一致的 source_niche_uid，禁止仅凭名称/类目相同自动复用
   if (byProduct.source_niche_uid && byProduct.source_niche_uid === nicheUid) {
     existing = byProduct
   } else {
     // 旧记录缺少可证明当前来源的 UID 身份凭据，且 stableSourceProductId 已被占用，必须阻断
     throw new Error(
       `MI_STORE: 身份冲突阻断：已有候选 (${byProduct.id}) 占用了 sourceProductId (${stableSourceProductId}) 但缺少当前来源 UID 身份凭据，禁止自动同步覆盖，需人工核实`
     )
   }
   ```
2. **保持原有合法路径不受误伤**：
   - **合法跨批次重复推流**：同 UID、同 WB 来源系统、同名同类目利基在后续批次变动排名时（Scenario 12），因 `source_niche_uid === nicheUid` 成立，平滑通过并刷新最新批次证据与审计日志；
   - **STEP 3 Legacy Name-Key 回填**：旧候选按 `wb-niche-${niche.name}` 索引且严格匹配 `source_niche_id === String(nicheId)` 的历史场景不受影响；
   - **STEP 4 伪成功防护**：任何底层已有不可信记录导致的非 `created` 状态依然被 `if (!created) throw new Error(...)` 严格防御拦截。

#### (3) 隔离反例验证（`tests/candidate-identity-backfill.test.mjs` Scenario 13）
- **构造反例场景**：
  - 旧候选：`sourceProductId = 'wb-niche-u-1'`，名称“手套”，类目“劳保”，完全缺少 `source_niche_uid`、`source_niche_id`、`source_system`，业务状态“待立项”，负责人“张主管”，关联项目 `proj-legacy-glove-99`；
  - 新利基：`uid = 'u-1'`（构造出相同的 `stableSourceProductId: wb-niche-u-1`），`id = 999`，名称“手套”，类目“劳保”（同名同类目）。
- **实测结果**：
  - 修复前：该用例在旧逻辑下因 `hasIdenticalNameAndCat` 被自动复用，断言抛出异常失败（`Missing expected exception`）；
  - 修复后：调用 `promoteToT6Candidate()` 明确捕获 `/身份冲突阻断/` 异常；
  - 断言验证：旧候选 100% 字节级不变（未写入新 UID、新 ID 999 或市场证据）；候选池总数严格保持 1 条不变；新增成功审计日志数为 0；新增决策日志数为 0。
- 全部 13 组身份防护与隔离反例测试 100% 通过。

---

### 2. 阻断项 2：增量证据与回滚包边界如实标注（`evidence/`）

#### (1) 核查发现的问题分析
- 在 Revision 002 中提交的 `evidence/revision-002-incremental.diff` 实质上是 `git diff HEAD` 相对仓库基线 HEAD 的累积差异，不仅包含 Revision 001 的内容，而且因 Git 未跟踪 `tests/candidate-identity-backfill.test.mjs` 等文件，导致未跟踪文件被遗漏；
- 该 diff 不能准确反映 Revision 001 到 002 的单一轮次增量，更不能作为完整的回滚包直接应用到脏工作树中。

#### (2) 证据归档与边界厘清
1. **本轮（Revision 003）真实增量证据**：
   - 在开始修改前，已备份本轮修改前目标文件至 `docs/ai-handoff/KJ-GEMINI-20261009-MARKET-001/evidence/pre-revision-003-targets/`：
     - `miStore.js`
     - `candidate-identity-backfill.test.mjs`
   - 记录其执行前元数据与 SHA-256：`evidence/pre-revision-003-target-metadata.json`；
   - 生成真实的 Revision 003 纯增量 diff：`docs/ai-handoff/KJ-GEMINI-20261009-MARKET-001/evidence/revision-003-incremental.diff`。该 diff 完整覆盖 `miStore.js` 与未跟踪的 `tests/candidate-identity-backfill.test.mjs` 的变更。
2. **历史证据边界澄清**：
   - **`revision-002-incremental.diff`**：记录的是相对仓库基线 HEAD（`de0cecf1`）的累积 git 差异，未包含 Git 未跟踪的测试文件，仅供审查参考，**不可作为针对工作树的回滚补丁**；
   - **`revision-003-incremental.diff`**：为 Revision 002 结束态与 Revision 003 交付态之间的**真实前后增量差异**，包含未跟踪测试文件的增量，可清晰审计本轮改动的精确范围。
3. **工作树完整性维护**：
   - 本轮未清理、未还原、未变动任何工作树中的其他未提交/未跟踪文件，保持工作区状态客观真实。

---

## 二、Revision 003 目标文件与元数据清单

### 1. 本轮修改的生产文件（共 1 个）
- `ozon-react/src/utils/marketIntelligence/miStore.js`（移除 `hasIdenticalNameAndCat`，STEP 2 强制来源 UID 校验）

### 2. 本轮修改的测试文件（共 1 个）
- `tests/candidate-identity-backfill.test.mjs`（新增 Section 13 隔离反例，共 13 组全绿）

### 3. 交付目标文件 SHA-256 清单（全 11 个目标文件）
详见 `docs/ai-handoff/KJ-GEMINI-20261009-MARKET-001/evidence/post-execution-target-metadata.json`：
```json
{
  "recorded_at": "2026-10-12T03:25:25.967Z",
  "files": [
    {
      "path": "ozon-react/src/utils/marketAnalysis/purityFilter.js",
      "sha256": "3731C508D461B5D51ACAFDA40CDE245BC3C0A25FE1192CD12085E7AAE3A0027F"
    },
    {
      "path": "ozon-react/src/components/marketIntelligence/components/ManualProcurementWorkbench.jsx",
      "sha256": "32A54BA3A0E933A8E0261094F5C33E88C769D06C7064FCAF67314749A5BCAEE7"
    },
    {
      "path": "ozon-react/src/components/marketIntelligence/MarketIntelligenceApp.jsx",
      "sha256": "F5CB5EF8CE26D8D0793903B765625325E5550A43EF74EFD7F556520606F9CEEF"
    },
    {
      "path": "ozon-react/src/components/MarketResearch.jsx",
      "sha256": "1A7C2239197DD84DDA057AD43D295B2114C060F7075BBACCFA1AE0F10B54A446"
    },
    {
      "path": "ozon-react/src/utils/marketAnalysis/priceBands.js",
      "sha256": "9AF86FF1AB0CB778F3347A1E53CAFB3F5EEF665B003E6017F58955C2A036ABDF"
    },
    {
      "path": "ozon-react/src/components/PurityPipelinePage.jsx",
      "sha256": "4C12DE214ACF4F4C03D35A215525EC6689B5D7D1C6002FFEFE487AE27C56B64A"
    },
    {
      "path": "ozon-react/src/utils/marketIntelligence/miStore.js",
      "sha256": "1B48461087A2F35E6D07F4A0065B73DBBB415C7CA0512FD623068E8C24088B2F"
    },
    {
      "path": "tests/candidate-identity-backfill.test.mjs",
      "sha256": "BE9EC50241CAFB85EACA9F4FA9C6C75C48DCF8D0C818096F712445BD381E1604"
    },
    {
      "path": "tests/price-weighted-quantiles.test.mjs",
      "sha256": "5D6A058BB66F7E01628C6A7DAB55126CA762B6D1CED63E6100CB7168CDDE2F18"
    },
    {
      "path": "tests/market-embedded-isolation.test.mjs",
      "sha256": "43AE187B1C58CA770963A7EBDCBA115BDF65A7F0C5EB6A909611116A4F523180"
    },
    {
      "path": "tests/ia-procurement-identity.test.mjs",
      "sha256": "4F07198AA33FE1570B353F0B5F1B5C64EFC34E5E7CB469E0723AA1C8CC7846E3"
    }
  ]
}
```
*注：除本次修改的 `miStore.js` 和 `candidate-identity-backfill.test.mjs` 外，其余 9 个交付文件哈希值与 Revision 002 保持逐字节一致。*

---

## 三、真实测试与构建执行结果汇总

所有测试套件及构建命令均在本地真实执行，无口头声称，退出码全为 0：

| # | 命令 | 退出码 | 结果概要 |
|---|---|---|---|
| 1 | `node tests/candidate-identity-backfill.test.mjs` | `0` | 13 组全绿：含无 UID 阻断、同 UID 幂等性、同名不同类目隔离、信息不充分防误伤、冲突 UID 拦截、合法回填、旧101 vs 新999隔离、STEP 2 缺少字段反例、STEP 4 外部系统反例、STEP 1 跨系统反例、合法跨批次复推，以及**新增场景 13 同名同类缺少 UID 阻断与字节级不变断言** |
| 2 | `node tests/market-embedded-isolation.test.mjs` | `0` | 20 项断言全绿：7 项静态契约 + 6 项 embedded 真实组件零写入 + 7 项 standalone 完整上传确认与队列清空断言，0 次 deferred 警告 |
| 3 | `node tests/price-weighted-quantiles.test.mjs` | `0` | 8 组全绿：核心反例 (10元销量1000 vs 100元销量1 -> 加权 P50 必为 10)、负数/区间安全归零、千位符保留、端到端 pipeline 加权分位数验证 |
| 4 | `node tests/ia-procurement-identity.test.mjs` | `0` | 15 项全绿：UID 优先级、更名安全、同名防碰撞、runId 显式传递、无 UID 异常隔离与草稿 100% 保留 |
| 5 | `npm run test:market` | `0` | 130 项全绿：specParser (36) + purityFilter (45) + pipeline.e2e (49) 全绿 |
| 6 | `npm run test:t6` | `0` | 170+ 项全绿：WB 场景 (53) + T6 UI 契约 (26) + T7-1 供应链 (43) + 工厂试跑 (8) 等全绿 |
| 7 | `npm test` | `0` | 129 项全绿：FBP (29) + 黄金评分案例 (56) + Python 跨境核算 (44) 全绿 |
| 8 | `npm run test:golden` | `0` | 76 项黄金案例全部通过（0 失败） |
| 9 | `npm run test:sync` | `0` | 双端对拍零差异（16 重量边界 + 2 版本边界 + scoring_rules 一致性） |
| 10 | `npm run build --prefix ozon-react` | `0` | Vite 构建成功（3234 模块转换成功，零语法/JSX错误，耗时 11.88s） |

---

## 四、交接声明

本任务 Revision 003 针对三次独立验收报告中的 P1（同名同类缺少来源 UID 自动覆写）与 P2（增量证据边界与未跟踪文件）已全面彻底解决。
- 任务状态现置为：**`review_ready`**；
- 任务指针置于：`docs/ai-handoff/CURRENT_TASK.json` 与 `STATUS.json`（`claimed_by: null`, `last_executor: "Gemini"`）；
- 部署授权严格保持：`production_authorized=false`、`deployment_status=not_deployed`（零生产环境写入，未执行 Git push）；
- 交付 Codex 进行第四次独立验收。
