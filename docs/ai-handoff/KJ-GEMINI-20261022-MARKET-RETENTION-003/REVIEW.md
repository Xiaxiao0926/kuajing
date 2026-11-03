# 验收报告（REVIEW）— KJ-GEMINI-20261022-MARKET-RETENTION-003

- **验收日期**：2026-11-03
- **验收人**：GLM-5.3（Lead，经用户授权执行「策划-推进-审核」闭环；巡查取证由独立只读子体完成）
- **验收对象**：`docs/ai-handoff/KJ-GEMINI-20261022-MARKET-RETENTION-003/`（TASK.md 合同 + RESULT.md + REVISION-001 + tests-revision-001.json）
- **结论**：**accepted_with_known_limitations**（核心范围通过；限制逐项列于 §4，均不阻断）

---

## 1. 验收依据链

1. **2026-10-28 独立读出**：`CODEX-LUNA-READOUT-20261028.md` — Luna 只读代码审阅 + Codex 复跑 4 项测试全过，识别 P1（源文件下载入口缺失）与 P2（测试记录展开过时、年份 1970-2100 超合同）问题，未推翻实现。
2. **Revision-001**：补齐源文件下载闭环（UploadedMarketReport 下载按钮 + `sourceDownload.js`）、年份范围放宽为 0001-9999、`tests-revision-001.json` 纠偏测试记录（all_passed: true，日志留存于 evidence/revision-001/）。
3. **2026-11-03 验收前巡查**（独立只读子体，报告全文见验收人工作记录）：
   - 合同符合性：A1-A5（版本冻结/SHA-256 源备份/provenance 加法式/失败保冻结态/legacy 并列可读）、B1-B5（导入确认/严格日历校验/snapshot:null 抑制/unknown→not_evaluated 传播/0-180 边界）、C（聚合不去重+重复警告）逐条核对源码行号，全部落实。
   - 授权范围：`8e97bea` 提交恰好只含授权文件，无越权；未跟踪文件与执行前基线一致。
   - 测试实测（2026-11-03 复跑）：`npm run test:market-retention` exit 0（场景 1-8 + source-download PASS）；`node tests/report-integration.test.mjs` exit 0；`node tests/market-report-quality.test.mjs` exit 0（24 份报告）。
   - 全量回归：`npm test` exit 0（含 wbEngine/exchangeRate/scoring/t6/market/fbp/scoring-golden/python 全链）。

## 2. 伪绿排查结论

RESULT.md 记录的部分工作区哈希与磁盘字节不符，**已排除伪绿嫌疑**：经 git 对象库逐字节核对（ee3630a/8e97bea blob 与记录一致），差异 100% 由 `core.autocrlf=true` 检出行尾转换造成（例：MarketReportImportConfirm 6,260B(LF) → 6,405B(CRLF)）。哈希以 git blob（LF）为准。

## 3. 已核实的非阻断项处置

| 项 | 处置 |
|---|---|
| `CURRENT_TASK.json` authorized_files 漏列 3 个已授权新文件（MarketReportImportConfirm.jsx / sourceDownload.js / market-report-source-download.test.mjs） | 属指针清单不完整而非越权；已在本任务 `STATUS.json` 补记，见 §5 |
| tests.json（10-26 原始记录）npm test 展开过时 | 已由 tests-revision-001.json 明确纠偏并标注关系，处理诚实，予以接受 |
| browser harness 未在验收前巡查中复跑 | harness 脚本、日志、10 张截图、payload 证据齐全，且 tests-revision-001.json 记录 reviewer 于 10-28 独立复跑；不阻断 |

## 4. 已知限制（accepted_with_known_limitations 依据）

1. **未部署、未公开验证**：`deployment_status: not_deployed`，`public_verification_status: not_performed`。生产 WordPress 端的下载、权限、备份恢复、多设备行为未验证。上线前必须在生产做一次源文件上传→下载闭环抽验。
2. 源文件上传失败后整页刷新：IndexedDB 队列能补传源文件，但组件内冻结任务状态（pendingAttempt）丢失，不能自动补建报告（`serverFiles.js:138` / `MarketReportCenter.jsx:224`）。已在 RESULT.md 披露，属后续任务范围。
3. 共享 IndexedDB 队列幂等依赖、界面长哈希/内部状态词可读性优化：后续可读性任务处理。

## 5. 后续登记

- 上述限制 2-3 已由 `docs/ai-handoff/BACKLOG.md` 跟踪；限制 1（生产验证）为部署门，未过不得宣称端到端完成。
- 本任务 `STATUS.json` 已按协议把状态封存为 `accepted_with_known_limitations`，并补记授权清单勘误。
- 下一任务：`KJ-GLM-20261103-WORKSPACE-001`（IA 步骤7 工作台首页聚合），任务书见其目录；当前指针已切换。

## 6. 哈希口径备注（防后续验收者误判）

本任务产物哈希一律以 **git blob（LF）** 为准；工作区因 `core.autocrlf=true` 检出为 CRLF，字节大小与哈希会与记录不同，这不是内容篡改。
