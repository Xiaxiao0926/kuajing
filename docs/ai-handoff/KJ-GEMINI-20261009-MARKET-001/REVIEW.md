# KJ-GEMINI-20261009-MARKET-001 Codex 独立验收

- 日期：2026-10-09
- 结论：`revision_required`
- 当前本地代码四个目标文件的 SHA-256 与 `evidence/post-execution-target-metadata.json` 一致；本次审核未修改业务代码、业务数据或生产环境。
- 绿色测试仅证明已覆盖场景通过，不能替代任务书明确要求的真实组件副作用验证与遗漏的身份反例。

## 阻断项

### P1. 同名同类目的旧候选仍可被错配

`ozon-react/src/utils/marketIntelligence/miStore.js` 的 legacy 分支只要求类目相等、UID/来源不冲突，没有核对旧记录的 `source_niche_id`、`source_run_id`。在隔离内存 Store 中创建旧候选 `sourceProductId=wb-niche-手套`、`source_niche_id=101`、类目“劳保”，再推送同名同类目但 `uid=new-999`、`id=999` 的利基，实际返回 `created=false`、同一个 candidate ID，旧记录的来源 ID 被改为 999，候选总数仍为 1。此行为违反 TASK.md 的“同名同类但身份不充分不得盲目回填”。

另外 STEP 2 按稳定 `sourceProductId` 找到候选后未核对已有 `source_niche_uid` 是否与本次 UID 冲突。身份必须在任何证据同步前核验。

### P1. 嵌入隔离测试没有运行真实组件

`tests/market-embedded-isolation.test.mjs` 前半段是源码字符串断言，后半段的 `simulateProcessAndSave` / `simulateHandleLoadFile` / `simulateUploadToServer` / `simulateHandleDeleteSaved` 是在测试文件中重写的模拟函数，不会调用 `MarketResearch.jsx`。因此通过结果不能证明真实组件的 `dbPut`、服务端上传/删除、`mr-active-file` 在 embedded 模式下均为 0 次，也不能证明独立页面回归。`RESULT.md` 和 `tests.json` 将其描述为运行时副作用验证，证据等级失真。任务书明确要求组件或浏览器交互测试，单纯字符串检查不算完成。

### P1. 原始销量解析会把负数和区间转成正权重

`ozon-react/src/utils/marketAnalysis/purityFilter.js` 的 `extractQty` 通过 `replace(/[^\d.]/g, '')` 去掉负号及区间连字符。实跑：`extractQty({销量:'-5'}) === 5`，`extractQty({销量:'5-10'}) === 510`。新分位函数只检查已解析的 `_purity.qty > 0`，故无法兑现“负数/无效销量不进入权重”的端到端承诺。现有 `price-weighted-quantiles.test.mjs` 只手工构造 `_purity.qty=-5`，漏测原始输入链路。

## 必须纳入同轮修订的调用链风险

- `ozon-react/src/components/marketIntelligence/components/ManualProcurementWorkbench.jsx` 先保存采购草稿、再无 try/catch 地调用 `promoteToT6Candidate`。历史批次的无 UID 利基会抛错，用户没有明确的推流失败反馈，且抽屉后续流程中断。本地三个批次里，`RUN-20260615-001` 与 `RUN-20260917-001` 各有 6534 条利基、均无 UID；当前 `RUN-20261217-001` 的 6534 条有 UID。无 UID 阻断本身符合任务书，但调用方必须正确呈现。
- 该工作台调用推流时未传 `runId`，落入 `miStore.js` 的旧默认值 `RUN-20260917-001`。当前活跃批次为 `RUN-20261217-001`，因此经此入口推送的证据批次可能被错误标记。父组件已有 `currentRunId`，应显式传入。

## 非阻断口径问题

`priceBands.js` 的原 `medianPrice` 对偶数个 SKU 使用 `prices[Math.floor(n/2)]`，例如价格 10 与 100 返回 100。保留该历史值可以，但 UI/文档不能笼统称为通常意义上的算术“中位价”；请明确为“上中位值/排序第 floor(n/2)+1 位”或提出兼容性受控的更正。

## 独立实跑

| 验证 | 结果 |
| --- | --- |
| `node tests/market-embedded-isolation.test.mjs` | exit 0；但只含字符串检查与复制的模拟函数 |
| `node tests/price-weighted-quantiles.test.mjs` | exit 0；未覆盖原始销量解析 |
| `node tests/candidate-identity-backfill.test.mjs` | exit 0；未覆盖同名同类不同来源 ID |
| `npm test` | exit 0；默认脚本不包含上述三个新测试，不能称为它们的集成覆盖 |
| `npm run test:golden` | exit 0，76/76 |
| `npm run test:sync` | exit 0，双端对拍零差异 |
| `npm --prefix ozon-react run build` | exit 0；仅本地构建，非部署 |

## 决定

保持 `not_deployed` / `not_performed`，不接受当前 `review_ready` 声明。按 `REVISION-001.md` 做最小返工后重新提交 `RESULT.md`、`tests.json` 与增量证据；不得复用旧测试结论充作修订后验证。Codex 再次独立验收前，不激活后续任务、不发布。

## Revision 001 二次独立验收（2026-10-10）

结论：`revision_required`。Gemini 执行途中出现过 API EOF，但本地指针、结果及 11 个目标文件 SHA-256 均已核对，确实交到 `review_ready`；连接错误本身不作为拒收理由。原四项中，legacy 101/999 反例、真实组件挂载、原始销量解析及采购面板的错误呈现代码均有实质进展。以下仍阻断验收：

1. **P1，稳定 ID 冲突仍可静默复用或伪成功。** `miStore.js` STEP 2 在已有 `sourceProductId=wb-niche-u-1` 但缺少 UID/来源字段时，仅检查显式冲突就复用；隔离 Store 实跑：旧候选名称 Old、类目 A，新利基 UID `u-1`、名称 New、类目 B、ID 999，结果 `created=false`、复用旧 ID、旧市场证据被写入新 UID。若旧候选显式 `source_system=OTHER`，STEP 2 跳过它，但 STEP 4 的 `ensureCandidate()` 仍按相同 Product ID 返回旧候选，`created=false` 且来源字段未更新，调用方却会显示“信息已同步更新”。任何复用判定都必须在 `ensureCandidate()` 前完成；不能把“未创建”误当“已同步”。
2. **P1，STEP 1 只凭 UID 绕过来源冲突。** 旧候选 `source_niche_uid=u-1`、`source_niche_id=101`、`source_system=OTHER`、类目 A，新利基相同 UID、ID 999、类目 B；隔离 Store 实跑返回 `created=false`，旧候选被改写为 `source_system=WB_MARKET_INTELLIGENCE`、来源 ID 999。UID 相同不自动证明其它显式矛盾字段可被覆盖。不同批次中合法的同 UID 复推仍须保留。
3. **P2，上传成功证据不足。** 新的 `market-embedded-isolation.test.mjs` 确实挂载真实 React 组件，不再是 `simulate*`。但独立模式测试输出 `Server persistence deferred: response.json is not a function`，仍以 `serverUploadCount >= 1` 判绿。它只证明上传请求被发起，不能证明原上传/保存路径成功。测试还把 `onChange` 是否存在放进可跳过的 `if`。补齐成功响应、真实回调与最终持久化结果断言，避免把失败后的队列重试当成成功。

独立实跑：四个定向测试、`npm run test:market`、`npm run test:t6`、`npm test`、`npm run test:golden`、`npm run test:sync`、`npm run build --prefix ozon-react` 均 exit 0。构建有大 chunk 警告，不作为本任务阻断。上述额外隔离反例在当前测试集中缺失，因此绿色结果不覆盖身份错配。未修改生产代码，未部署，未公开验证。最小返工见 `REVISION-002.md`。

## Revision 002 三次独立验收（2026-10-12）

结论：`revision_required`。二次验收的显式 UID/跨系统/跨类目冲突反例已被实际代码拦截；真实组件测试的独立模式上传成功路径现有完整模拟响应和队列清空断言，实跑无 deferred 警告。11 个交付目标文件哈希与当前文件一致。仍有以下问题：

1. **P1，STEP 2 对身份不足的同名同类目旧候选仍自动写回。** `miStore.js` 的 `hasIdenticalNameAndCat` 使旧候选即使完全没有 `source_niche_uid`、`source_niche_id` 和 `source_system`，只要碰巧占有 `sourceProductId=wb-niche-u-1` 且名称、类目均为“手套/劳保”，就被当成新 UID `u-1` 的同一商品。隔离内存 Store 实跑返回 `created=false`、复用旧 ID、旧记录内容改变并写入新 UID/来源 ID 999。名称和类目只是描述，不能证明来源身份。此路径不符合 `REVISION-001.md` 的“旧字段缺失、冲突或无法证明同一来源时不得自动写回”和 `REVISION-002.md` 的“信息不足不能自动同步”。现有 Scenario 9 仅覆盖名称和类目不同，漏掉完全相同但来源字段全缺的反例。
2. **P2，本轮回滚证据名称与实际内容不符。** `evidence/revision-002-incremental.diff` 是 `git diff` 相对仓库 HEAD 的累积差异，不是 Revision 001 到 002 的增量；`tests/candidate-identity-backfill.test.mjs` 和 `tests/market-embedded-isolation.test.mjs` 未跟踪，未被该命令纳入。需如实标记证据边界，并为下一次修订保存执行前目标文件副本与真正增量差异，不得用它直接回滚整个脏工作树。

本次独立实跑：四个定向测试、`npm run test:market`、`npm run test:t6`、`npm test`、`npm run test:golden`、`npm run test:sync`、`npm run build --prefix ozon-react` 全部 exit 0。通过的测试没有覆盖第 1 项反例。未修改生产代码或测试，未部署，未公开验证。最小返工见 `REVISION-003.md`。

## Revision 003 最终独立验收（2026-10-12）

结论：`accepted`（仅本地实施验收，非部署授权）。

- `miStore.js` STEP 2 现要求旧候选 `source_niche_uid` 与当前真实 UID 一致，不再以同名同类作为来源身份。独立隔离 Store 复测：旧候选占用 `wb-niche-u-1`，名称“手套”、类目“劳保”，但无 UID、来源 ID 和来源系统；推送 `uid=u-1`、`id=999` 后明确阻断，旧记录字节级不变，候选数保持 1。新增 Scenario 13 覆盖此反例；合法同 UID 跨批次复推及有来源 ID 的历史回填场景仍通过。
- Revision 003 的两份执行前备份 SHA-256 与元数据一致；`revision-003-incremental.diff` 对比备份与当前文件，包含此前未跟踪测试文件的新增场景。`RESULT.md` 已将旧 `revision-002-incremental.diff` 正确标为相对 HEAD 的累积差异，不把它当作回滚补丁。11 个目标文件当前 SHA-256 均与交付元数据一致。
- Codex 独立实跑四个定向测试、`npm run test:market`、`npm run test:t6`、`npm test`、`npm run test:golden`、`npm run test:sync`、`npm run build --prefix ozon-react`，10 条命令均 exit 0。React 构建仍提示大 chunk，但不影响本任务数据正确性验收。

验收边界：未做真实生产服务器上传、真实浏览器端到端或公开站点验证；这些不得由本地成功测试推定。`production_authorized=false`、`deployment_status=not_deployed`、`public_verification_status=not_performed` 保持不变。未修改生产代码、业务数据或其它未关联工作树文件；不自动激活下一任务。
