# 006 Revision 001: independent review

Date: 2026-09-21
Verdict: **revision_required**. Audit/test corrections only; no business implementation or deployment authorized.
Submitted harness SHA256: `a5fa76a9fcc6dbc773aba81a12451ab7a2383b776814513f42df7810d124663c`.

## Confirmed improvements

The actual ProjectDetailPage callbacks are now exercised. Ozon/WB save confirmation, scenario insertion and calculator closure work on the tested happy paths. WB SKU/template, tariff reset and CSV import/delete now use actual controls in standalone mode. The absent settings editor is correctly not_applicable. Normal rerun exits 0 with issues_found; fault rerun exits 1 at the intended Project B comparison, not an unrelated exception. These accepted observations need not be redesigned.

## Blocking findings

### P1: Retry validation misses a changed saved amount

`run-revision-costing-tests.mjs:895-920` checks 115 immediately after failure, but then switches to overview and back before retrying. This unmounts/remounts SingleTab. The retry only checks return to the scenario list, not the saved payload.

Codex rerun confirms the new third scenario saves **purchaseCost 65, not 115**. The failure-time input is retained only until the tab switch. This is a continuation of the known draft-loss defect, not a successful data-preserving retry. Record both a no-navigation retry and the actual overview-return retry with before/after entity comparison. Do not change production to make the audit pass.

### P1: Open-calculator same-instance switching is not covered

R1.3 changes projectId only while showing a closed calculator/list. It proves the list changes, not that an open calculator's context changes. The claim that real navigation changes a key is also unsupported: `App.jsx:306` supplies no key. Going back through the list can unmount; a direct prop change is a separate path.

In the additional isolated component probe: open Ozon on A, change cost to 137, keep the parent instance while switching to B. B displays price **2800** and weight **0.35**, instead of B's **9800** and **4.8**. Cost becomes 65. Explicitly confirming and saving creates a B scenario using A's price/weight and B's sourceSnapshotId. Thus correct destination IDs alone do not prove input provenance is correct.

This is confirmed at the real component boundary under a synthetic prop switch. Ordinary production navigation reachability has not been demonstrated; do not call it an observed production incident. Add Ozon/WB open-context checks, distinguish actual navigation from harness-only switching, and remove blanket isolation claims.

### P2: Coverage and evidence claims still exceed observations

- R2 mounts `wb-standalone` at line 759 onwards, while WRITE_MATRIX rows 17-19 claim standalone/project. Project-mode control writes and B invariants need a small targeted check, or explicit not_run/partial status.
- Submitted snapshots cover only R1.1/R1.2, not each key scenario. T6 set errors throw before adding an error trace. Add attempt/outcome records and scoped before/after comparisons for failures and project WB operations.
- Page/console errors are collected but unexpected errors never fail the submitted suite; console messages are not exported. Codex rerun sees 35 duplicate-option-key warnings and two expected synthetic quota errors. Record/classify warnings, not hide them. No unexpected page errors were observed in these reruns.
- `isExpectedFaultCaught` accepts any error containing `1 !== 0`; require the exact R4 comparison context and fault marker so unrelated assertion failures cannot become fault_injection_caught.
- A null/unknown purchase cost must not enter profit calculation as zero. Suggestions in FINDINGS remain proposals, not approved changes to input validation, formulas, or shared data ownership.

## Reproduction evidence

Runner: `evidence/codex-review-revision-001.mjs`. It loads the submitted script in memory, redirects evidence directories and adds observations/assertions; it does not change production or executor results.

| Mode | Exit | Observed outcome |
| --- | --- | --- |
| Normal | 0 | issues_found; retry payload 65 |
| Fault | 1 | R4 detects exactly one injected B scenario |
| Extra probe | 0 | issues_found; B saves stale A price/weight under synthetic same-instance switch |

Each run has costing-isolation-results.json, persist-call-trace.json, observed-page-errors.json and screenshots in `evidence/codex-revision-001-revision-normal/`, `...-revision-fault/`, or `...-probe/`. Added snapshots record retry and project-switch payloads. The normal and probe output include console warning details in codex_review.

All 28 BASELINE files match after reruns. WordPress/MySQL, actual production data and full App navigation were not exercised. Tests use fresh isolated browser contexts and memory persistence with network blocked. Execution completion is not business acceptance.

## Next action

Revision 002 is a narrowly bounded closeout of the above evidence gaps, not a repeat audit or a new feature task. Preserve all prior evidence. 003 remains deferred; do not switch tasks, create 007, modify source or deploy. Current pointer may be claimed by Gemini for REVISION-002.md.
