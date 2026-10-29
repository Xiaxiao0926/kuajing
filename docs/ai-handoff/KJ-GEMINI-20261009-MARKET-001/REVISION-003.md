# KJ-GEMINI-20261009-MARKET-001 Revision 003

状态：`revision_required`。延续 `TASK.md`、`REVISION-001.md` 与 `REVISION-002.md` 的范围、数据保护和禁止生产写入规则。本轮只修 STEP 2 身份不足的复用条件与证据标注，不展开新的市场系统重构。

## 1. STEP 2 不能以同名同类目代替来源身份

`miStore.js` 中稳定 `sourceProductId` 命中已有候选时，如果旧记录没有可证明当前来源的 UID/来源身份，禁止仅凭 `candidateName` 和 `categoryLeaf/categoryFull` 相同就调用 `syncCandidateMarketEvidence()`。对于稳定 Product ID 已被占用的情况，明确抛出需人工核实的身份冲突，保持旧候选原样，不能落入 STEP 4 的 `ensureCandidate()` 后伪报成功。合法同 UID、同 WB 来源的跨批次重复推流必须继续通过；原先按 name-key 的 STEP 3 合法回填场景也不能被误伤。

在隔离 Store 新增反例：旧候选 `sourceProductId=wb-niche-u-1`、名称“手套”、类目“劳保”，无 `source_niche_uid`、`source_niche_id`、`source_system`；新利基 `uid=u-1`、`id=999`、同名同类。必须阻断，断言旧记录字节级不变、候选数不变、零新增成功审计/决策日志。反例应在修复前失败、修复后通过，并保留现有 12 个身份测试。

## 2. 纠正增量证据

修改前先记录本轮 `miStore.js` 与目标测试文件的副本和 SHA-256。提交本轮真实前后差异；对未跟踪测试文件，不能只用 `git diff HEAD` 冒充增量。将既有 `revision-002-incremental.diff` 在报告中如实说明为相对 HEAD 的累积差异且不含未跟踪测试，不得当作完整回滚包。不要清理、还原或归功于本轮之外的工作树改动。

## 3. 交付门

仅修改 `ozon-react/src/utils/marketIntelligence/miStore.js`、`tests/candidate-identity-backfill.test.mjs` 和本任务交接目录。重跑身份测试、嵌入隔离测试、分位测试、采购身份测试，以及 `npm run test:market`、`npm run test:t6`、`npm test`、`npm run test:golden`、`npm run test:sync`、React 构建。更新 `RESULT.md`、`tests.json`、目标哈希与真实增量证据；置 `review_ready` 后停止等待 Codex 独立验收。`production_authorized=false`、`deployment_status=not_deployed` 不变。
