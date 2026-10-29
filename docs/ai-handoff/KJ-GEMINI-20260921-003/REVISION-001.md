# 003 Revision 001: contract corrections only

State: **deferred, not active**
Dependency: do not interrupt KJ-GEMINI-20260921-006.
Production authorized: false. Implementation authorized: false.

## Scope

After Codex explicitly activates this revision, correct only `docs/ia/TASK07A4C3A_CERTIFICATION_APPLICABILITY_CONTRACT.md` and write delivery records in this 003 directory. Do not modify source, tests, schemas, data, storage keys, formulas, APIs, deployment files, CURRENT_TASK.json or another task's records. Do not self-activate by changing a pointer. Preserve existing executor RESULT.md/tests.json; deliver RESULT-REVISION-001.md and tests-revision-001.json separately.

## Required corrections

1. Define absence separately from a present invalid value. Explain absent, present undefined, null, empty string, false, zero, unknown enum and each valid enum, including JSON serialization limits. Freeze how presence survives fact extraction and how invalid-only profiles are evaluated. Do not use falsiness, `|| ''`, `?? null`, or unconditional property injection where it destroys a required distinction. Apply this to draft baseline, dirty/conflict comparison and audit before/after representation.
2. Define the exact explicit boundary for new-project defaults. Historical missing/empty/all-empty profiles must not acquire applicability fields through reading, opening, no-op saving, notes-only/plan-only changes or requirement CRUD. Remove the promise to upgrade historical records on open/save. Document cross-field validation for explicit assessment changes separately from unrelated operations on existing malformed records; do not silently repair them.
3. Use `certificationApplicabilityNotesPresent` consistently. Specify its type and derivation once and reference it everywhere. Notes length validates format only, not regulatory correctness. Keep certificate attachments/numbers owned by their existing layer; avoid an unimplementable claim that a generic text validator recognizes every certificate number or file path.
4. Remove unsupported product-specific legal conclusions and incorrect exemptReason terminology. Use internal decision labels, not product-category or legal-status guarantees. Preserve stageTransition's current policy: NOT_EVALUATED is not business PASS, and RED/YELLOW require a reason to override rather than being absolutely unoverrideable.
5. Replace self-approved wording with review_ready / pending independent acceptance. Do not imply that approval of this document authorizes implementation.

## Acceptance evidence

- Provide a truth table for absent/present-undefined/null/empty/false/zero/invalid enum/UNASSESSED/REQUIRED/NOT_REQUIRED, paired with assessment completion and justification presence where relevant. Show precedence and one outcome per row.
- Provide JSON before/after examples for historical missing compliance, `{}`, all-empty fields and a nonempty old profile under notes-only, plan-only, CRUD and no-op operations. Demonstrate exact preservation of absent fields and unrelated invalid raw values. Use a separate JS example for undefined, which JSON cannot encode.
- Provide one named fact schema and matching extraction, gate and draft pseudocode without key mismatches.
- Report static checks honestly. No runtime or legal verification claims without evidence. Capture source hashes before/after; changed business files are a scope failure.

## Rollback and handoff

Keep a pre-edit copy/hash of the contract in this task's evidence directory. Roll back only your own document edits if necessary; never reset repository changes. Deliver a concise result, changed-file list, static verification and limitations. Leave dispatch to Codex and preserve the active executor's pointer.
