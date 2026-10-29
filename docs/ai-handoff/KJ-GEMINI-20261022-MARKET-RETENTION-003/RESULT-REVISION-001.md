# KJ-GEMINI-20261022-MARKET-RETENTION-003 — Revision 001 Delivery Result

- **Task ID**: `KJ-GEMINI-20261022-MARKET-RETENTION-003`（Revision 001）
- **Title**: 报告版本与源文件留存、采集日期真实性修复（修订：源文件下载闭环 + 测试记录纠偏）
- **Executor**: Luna
- **Date**: 2026-10-28
- **Hand-off Status**: `review_ready`（`claimed_by: null`，`last_executor: "Luna"`）
- **Authorization & Deployment State**:
  - `local_implementation_authorized`: `true`
  - `production_authorized`: `false`
  - `deployment_status`: `not_deployed`
  - `public_verification_status`: `not_performed`

---

## 1. 修订范围

依据 `REVISION-001.md`，本修订完成两项修复（均已实现并通过测试）：

1. **P1 源文件下载闭环**：为 `UploadedMarketReport` 增加"下载原始源文件"入口，补齐报告留存链路的用户取回操作。
2. **P2 纠偏**：移除采集日期校验中合同未规定的 1970-2100 年份限制；以真实命令与日志重建 Revision 001 权威测试记录 `tests-revision-001.json`，保留 Gemini 原始 `tests.json` 作为历史证据。

---

## 2. 新旧行为对比摘要

### A. 源文件下载闭环（P1）

| 方面 | 旧行为 | 新行为 |
|---|---|---|
| **原始源文件取回** | 报告页面（`UploadedMarketReport.jsx`）仅展示原文件名、指纹和备份名称，没有任何原始文件下载/打开入口；源文件虽已按 SHA-256 备份，用户无法从报告页面取回。 | 新增"下载原始源文件"按钮（lucide `Download` 图标），通过 `sourceDownload.js` 精确绑定当前报告 `sourceBackup` 记录的备份名称取回，绝不按原始文件名、子串、最新批次或报告标题猜测。 |
| **下载安全与完整性** | 无取回逻辑。 | 仅接受同源 HTTP(S) 下载地址（用现有受保护接口 + 凭据），下载原始字节后校验 SHA-256 与记录的字节长度；不匹配、文件缺失或请求失败均给出可操作的错误且不落盘错误文件。旧版报告有精确绑定但无哈希时按未校验来源标签下载，不伪造来源、不改已存记录。 |
| **状态与竞态** | 无。 | 提供加载/错误/重试状态；`AbortController` + 请求序号守卫防止报告切换时在途下载的竞态污染状态；无备份记录的历史报告按钮禁用并显示"此历史报告未记录源文件备份"。 |

### B. 采集日期年份限制移除与测试记录纠偏（P2）

| 方面 | 旧行为 | 新行为 |
|---|---|---|
| **年份范围** | `retentionContract.js` 在严格日历日期校验之外额外限制 1970-2100，`1969-12-31`、`2101-01-01` 被错误拒绝（该限制为合同未规定）。 | 移除任意年份限制，接受 0001-9999 的真实格里高利历日期；正确处理 `Date.UTC` 对 0-99 年的特殊行为（解析与 `computeUtcAgeDays` 两处），拒绝 0000 与不可能日期。历史 listing-date 解析与业务公式未改动。 |
| **测试记录** | `tests.json` 将 `npm test` 展开为与当前 `package.json` 实际入口不一致的脚本链，其覆盖数量不能作为当前全量测试证明。 | 新权威记录 `tests-revision-001.json`：命令行摘自实际日志的 `> command` 行与当前 `package.json`，记录真实退出状态与日志路径；不虚构断言总数，重复执行不计为独立覆盖。`tests.json` 原样保留为历史证据。 |

---

## 3. 改动文件清单

| 文件 | 变更 | 说明 |
|---|---|---|
| `ozon-react/src/utils/marketReport/sourceDownload.js` | 新增 | 精确绑定报告 `sourceBackup` 名称、同源 HTTP(S) URL 校验、SHA-256 + 字节长度校验、防重复/防猜测、失败可重试。 |
| `ozon-react/src/components/reports/UploadedMarketReport.jsx` | 修改 | 增加"下载原始源文件"按钮：lucide `Download` 图标、加载/错误/重试状态、`AbortController` + 请求序号守卫防报告切换竞态；无备份报告禁用并显示"此历史报告未记录源文件备份"。 |
| `ozon-react/src/utils/marketReport/retentionContract.js` | 修改 | 移除 1970-2100 任意年份限制，接受 0001-9999 真实格里高利历日期，正确处理 `Date.UTC` 对 0-99 年的特殊行为。 |
| `tests/market-report-retention.test.mjs` | 修改 | 配合年份限制移除的针对性边界测试（0001/0099/0100、1969、2101、9999、闰日及既有 0/180/181 天 cohort）。 |
| `tests/market-report-source-download.test.mjs` | 新增 | 源文件下载焦点测试：精确绑定、完整性、旧版报告、来源校验与重试失败路径。 |
| `package.json` | 修改 | 注册 `test:market-retention`（`node tests/market-report-retention.test.mjs && npm run test:market-source-download`）与 `test:market-source-download`（`node tests/market-report-source-download.test.mjs`）。 |
| 任务目录内文件 | 新增/修改 | `tests-revision-001.json`（新增，权威测试记录）、`RESULT-REVISION-001.md`（本文件）、`STATUS.json` / `CURRENT_TASK.json`（状态交接）；`evidence/revision-001/` 下的日志、harness 脚本与截图为执行证据。 |

Gemini 原始 `tests.json` 未改动，作为历史证据保留。

---

## 4. 测试与证据清单

- **权威测试记录**：`tests-revision-001.json`（真实命令、真实退出状态、日志路径与限制说明）。
- **日志证据**（`evidence/revision-001/`，均通过，退出码 0）：
  - `npm-test-final.log` / `npm-test.log` — `npm test` 全量链路（按当前 package.json 实际入口）
  - `test-market-final.log` / `test-market.log` — `npm run test:market` 链路（含 retention 与 source-download）
  - `test-source-download.log` — `npm run test:market-source-download`（PASS）
  - `npm-test-golden.log` — 76/76 通过；`npm-test-sync.log` — 双端对拍零差异
  - `test-report-integration.log` — 集成合同通过；`test-market-report-quality.log` — 24 份报告质量校验通过
  - `npm-build-final.log` / `npm-build.log` — `vite build` 干净完成（8.37s / 9.41s）
  - `browser-harness.log` — 真实 Chrome + Vite + 本地 Mock API harness 完成
- **浏览器截图证据**（`evidence/revision-001/`）：`confirm-step`、`source-download-success`、`source-download-switch-reset`、`pending-retry`、`reloaded-revisions`、`duplicate-warning` 各场景（其中 source-download-switch-reset 与 duplicate-warning 仅有 desktop 1366x900 一份，其余含 desktop 1366x900 与 narrow 390x844 两份）。请求/载荷证据见 `browser-request-payload-evidence.json`。

---

## 5. 已知限制

1. **硬刷新导入恢复为既有遗留限制**：源文件上传失败后整页刷新，IndexedDB 队列可继续补传，但组件内冻结任务状态丢失，无法自动补建报告；属已交接的后续任务范围，非本轮完成项。
2. **未部署、未做生产验证**：本轮 `deployment_status: not_deployed`、`public_verification_status: not_performed`；全部验证基于本地 Mock API 与合成数据，未触及生产 WordPress 端点。
3. **后端响应仅确认备份文件名**：服务器响应确认的是备份文件名，不能视为服务器端对内容哈希的独立验证；完整性校验由客户端对下载字节复核 SHA-256 与字节长度完成。
4. **测试记录边界**：各日志未内嵌 exit code 行，焦点两条测试的 exit 0 由 reviewer 独立复跑确认；日志无精确断言总数输出，不虚构；`npm test` 与 `npm run test:market` 的链内重复执行不计为独立覆盖。

---

## 6. 复核与验收

2026-10-28，GLM-5.3 复核通过（代码抽查 + `npm run test:market-retention` 与 `npm run test:market-source-download` 独立复跑，均 PASS / exit 0）。本文件与 `tests-revision-001.json` 为 Revision 001 的交付记录；最终验收由需求方决定。
