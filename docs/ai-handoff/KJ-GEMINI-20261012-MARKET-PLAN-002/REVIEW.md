# Codex independent review

Reviewed: 2026-10-22. Verdict: `accepted_with_known_limitations` (planning evidence only).

## Verified baseline

- HEAD remains `de0cecf107e670e1c0d9cf393c50b92ab85afdee`, branch `feat/platform-calc-parity-20261009`.
- All 11 file hashes recorded in BASELINE.json match the current files. This verifies those files against the delivered baseline; it does not prove that every repository file was untouched during Gemini's investigation.
- All seven requested deliverables exist. CURRENT_TASK and task STATUS were `review_ready`, with no claimant.
- Existing uncommitted and untracked work is preserved. No production access or deployment was performed by this review.

## Accepted findings

1. `marketReportAnalysis.js:504-525` assigns the same report identity to different contents with the same filename. `MarketReportCenter.jsx:137-144` also derives the uploaded JSON name from that filename, while its in-memory list replaces matching IDs. PHP `upload_file` replaces the active file after preserving changed bytes in file-backups. Historical versions therefore cease to be separately selectable in the current UI. This is a high-priority retention problem, not proof of irreversible deletion.
2. `marketReportAnalysis.js:524` falls back to the import day's UTC date when a filename has no date. Synthetic checks confirm that the same listing moves out of the 180-day cohort when a later snapshot date is substituted. The report should distinguish collection date, import timestamp and publication attempt timestamp.
3. Source upload and report upload are separate operations. The existing queue can retry either file after the initiating component reports an error. Recovery must account for pending uploads and delayed success; an upload error alone does not prove that no remote file exists.
4. The report center downloads each listed JSON before rendering the uploaded collection. Request count scales with report count. Latency and memory impact have not been measured in this review.
5. Factory selection cards and report-to-candidate provenance are useful next-stage improvements. They remain proposed scope pending a separate implementation contract.

## Corrections that supersede Gemini's implementation cards

- **Do not deduplicate by SKU alone.** The supplied example has two rows with different revenue. It proves additive aggregation, not which row is erroneous. Repeated SKU/URL may represent separate periods, shops or variants. Until row grain is established, preserve rows and totals, expose duplicate warnings and state that totals are row sums. Automatic first/last/max selection is not authorized.
- **Protect original source files as well as report JSON.** Changing report IDs alone leaves old reports pointing at an active source filename that can later contain different bytes. New source backups need content-derived filenames and each report must reference the server-confirmed name and fingerprint.
- **A fingerprint is not a revision identity.** Equal source bytes may be intentionally reinterpreted with a corrected date. Use a separate import/revision identity, frozen within one attempt and its retries; preserve the source fingerprint as provenance.
- **Date unknown is not zero new products.** Unknown collection date must produce an explicit unavailable cohort state throughout counts, shares, recommendations, age displays and scores; a null snapshot alone is insufficient.
- **Do not infer full market scale or automatic Gate changes.** The proposal for factory-card field omissions to block project creation and for mandatory structured overrides changes business rules and exceeds this slice. `stageTransition.js` already logs `by` and `reason`; these are not authenticated role enforcement. No new compliance or commercial approval machinery is approved here.
- **Do not promise constant total work or instant loading.** One summary-list request still carries O(N) metadata. Legacy reports lacking summaries require a compatibility strategy. Existing top-product and new-product arrays are capped at 15 and 12, so absent virtualization alone is not a demonstrated performance defect.
- `safeUrl` verifies HTTP(S) URL syntax; it does not verify that a product is available or that a URL belongs to Ozon. Sample provenance and a universal 28-day reporting period are not established by this audit.
- Gemini's five console-print checks are investigative observations, not five independent assertion suites or browser integration tests. Its `DATA_FLOW.md` heading also retains a stale `running` label; STATUS.json is authoritative.

## Independent checks

- All 11 delivered source hashes matched: read-only Node SHA-256 comparison, exit 0.
- Six synthetic assertion groups: filename collision; unknown snapshot fallback; cohort sensitivity to snapshot; missing listing date; future listing date; repeated identity aggregation. Inline Node assertion execution exited 0. The collision ID was `uploaded-997badee`; the fallback date on this review was `2026-10-22`.
- `node ozon-react/src/utils/marketReportAnalysis.test.mjs`: exit 0, output `uploaded market report analysis tests passed`. No guessed assertion count.
- No full business suite, browser runtime, production upload or restore test was run because this turn changes handoff documents only. The next implementation requires regression and component-level evidence.

## Approved next step

The user's request to continue optimization authorizes preparing a local Gemini implementation task. `KJ-GEMINI-20261022-MARKET-RETENTION-003/TASK.md` is the authoritative next contract; the dated implementation IDs in Gemini's ROADMAP are proposals, not active tasks.

Priority order: (1) source/report retention and date truthfulness; (2) recoverable imports and measured report loading; (3) factory selection cards with explicit provenance. Duplicate-row policy requires evidence of row grain before changing aggregate semantics.

The planning task is archived with known limitations above. Only the new task is ready. Production authorization remains false; previous local acceptance is not deployment evidence.
