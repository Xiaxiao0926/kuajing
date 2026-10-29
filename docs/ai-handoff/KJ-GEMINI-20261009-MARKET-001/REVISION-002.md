# KJ-GEMINI-20261009-MARKET-001 Revision 002

状态：`revision_required`。保留 `TASK.md` 与 `REVISION-001.md` 的数据保护、范围冻结及禁止生产写入规则。此次只修二次验收留下的身份错配和上传测试证据，不重构市场系统。

## 1. 所有候选复用路径先验身份检查

在 `miStore.js` STEP 1、STEP 2、STEP 3 及 STEP 4 调用 `ensureCandidate()` 前，对命中候选的 UID、来源系统、可用来源 ID 和明确类目做一致性判断。明确冲突必须 fail-close，信息不足不能自动同步到旧候选。当前稳定 Product ID 已被不可信旧记录占用时，不能让 STEP 4 靠 `ensureCandidate()` 返回旧记录并伪报同步成功；明确抛出需人工核对的身份冲突即可。合法同 UID、同来源的跨批次重复推流仍应正常刷新证据，不因 runId 变化一律阻断。

补三条隔离 Store 反例并断言旧记录字节级不变、零新增审计成功日志：

- STEP 2：稳定 Product ID 相同但旧记录缺少 UID/来源字段，且名称、类目不一致，不得将新证据写入旧候选。
- STEP 4：稳定 Product ID 相同、旧记录 `source_system=OTHER`，不得返回 `created=false` 并报告已同步；应阻断或按事先论证的唯一新键安全建档。
- STEP 1：UID 相同但旧记录显式不同来源系统/类目/来源 ID，不得覆盖旧来源与证据。若来源 ID 只是随批次变动的排名，须在测试中明确区分它与真正稳定身份，至少显式跨系统和类目冲突不得自动覆盖。

## 2. 独立模式上传测试要证明成功，不仅请求触发

`tests/market-embedded-isolation.test.mjs` 继续使用真实组件和拦截请求，绝不写真实服务器。模拟上传请求的完整成功响应与 IndexedDB 队列生命周期；直接断言文件输入的 `onChange` 存在、触发后上传结果已确认或队列已清空、组件没有进入 `Server persistence deferred` 分支。失败响应另有明确失败/排队断言也可保留，但不能替代成功路径。嵌入模式零写入断言不能退化。

## 3. 交付

只改 `miStore.js`、对应身份测试、`market-embedded-isolation.test.mjs` 及本任务目录的报告/证据；确需其它文件先说明原因。保留执行前已有工作树改动，记录本轮增量 diff、目标哈希，重跑四个定向测试、`npm run test:market`、`npm run test:t6`、`npm test`、`npm run test:golden`、`npm run test:sync` 与 React 构建。修完只置 `review_ready`，等待 Codex 独立验收。`production_authorized=false`、`deployment_status=not_deployed` 不变。
