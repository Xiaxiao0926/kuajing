# 006 Revision 002: audit closeout

Date: 2026-09-22. Reviewer: Codex.
Verdict: **accepted_with_known_limitations** for the bounded LOCAL AUDIT only. Business verdict remains **issues_found**. No deployment authorization.
Submitted runner SHA256: `93bf4e001c30379b9952ffab832ccb05a5543dd6eb8bc486e53e457ac3a3921e`.

## Independently confirmed

Reviewer runner: `evidence/codex-review-revision-002.mjs`. It instruments the submitted script in memory and preserves executor evidence. Real components/callbacks run with memory persistence and blocked network.

| Check | Result |
| --- | --- |
| Normal review run | Exit 0; issues_found |
| Injected corruption run | Exit 1; intended R5 B-scenario assertion and CORRUPTED_SCENARIO_INJECTED_FROM_A marker |
| Failure, retry without navigation | Saved purchaseCost 115 |
| Failure, overview then return/retry | Saved purchaseCost 65; draft-loss defect confirmed |
| WB project shared controls | Real clicks/imports; reviewer deep comparison confirms ALL T6 entities unchanged |
| Failed scenario write | Full-store before/after deep comparison unchanged; trace records attempted input |
| Ozon open-context A/B prop switch | Synthetic component probe confirms A price/weight persisted under B |
| WB open-context A/B prop switch, added by Codex | B shows A's 2800 RUB and 350 g instead of 9800 RUB and 4800 g; confirmation resets; explicit confirmation saves stale inputs under B with B sourceSnapshotId |
| Runtime errors | Two expected synthetic quota errors; no unexpected page errors or unclassified console errors |
| Baseline | HEAD unchanged; all 28 frozen files match |

Evidence: `evidence/codex-revision-002-normal/` and `evidence/codex-revision-002-fault/`, each with results, storage trace, page errors, console messages and screenshots. Added WB probe raises duplicate-key warnings to 90; Gemini's narrower run recorded 55. These are classified observations, not a performance/regression measurement.

## Authoritative corrections and limits

1. The pasted summary misdescribes notice handling. The real parent catches the save exception and updates notice; overview DOES show it, costing does not. The cause is rendering placement, not absent exception propagation. Initialization uses useState here, not the summary's useMemo.
2. Navigation is statically inspected, not end-to-end proven. App.jsx uses activeNode/activeProjectId and supplies no detail key; onBack changes activeNode, not a selectedProjectId variable. The inspected list-to-detail path unmounts old detail. No direct user path for the synthetic same-instance switch was found. Do not claim universal production unreachability or an observed production incident.
3. Gemini omitted the requested WB open-context probe and asserted counts rather than full equality. Codex supplied that probe and full T6/full-store comparisons above; another broad audit revision is unnecessary.
4. The submitted suite does not fully fail on arbitrary console errors and exempts fault mode from its final pageerror check. The reviewer wrapper exports logs and checks unclassified console/page errors in BOTH modes. Use this stricter boundary for regressions; the original green exit alone is insufficient.
5. WordPress/MySQL, cross-device conflict recovery, full App navigation and current production assets remain not_run. No release assurance follows from these local tests.

## Unfixed risks and next order

- P1: empty project procurement cost inherits unrelated historical cost. Separate unknown/assumed/confirmed-input decision required; no zero/null workaround or engine change authorized.
- P1: unsaved calculator input disappears on tab/unmount. Later task must cover actual leave/cancel/discard paths, not merely beforeunload.
- P1 at component boundary: stale Ozon/WB prefill under same-instance project switch. Fix ownership before adding direct project navigation; present user-path exposure is unproven.
- P2: notice hidden in costing. First narrow implementation: KJ-GEMINI-20260922-001, local only.
- Follow-up: standalone persistence-error feedback, duplicate WB route keys and shared-tool scope labels. Not fixed here.

The next task repairs notice visibility only, not all risks. Each further change and every deployment needs its own gate. Archived 003 remains deferred.
