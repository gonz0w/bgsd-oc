---
phase: 165-jj-execution-repo-local-verification
plan: 03
subsystem: verification
tags: [jj, workflow, plugin, runtime-freshness, bundle-parity]
requires:
  - phase: 165-02
    provides: repo-local deliverables verification and runtime freshness metadata for current-checkout validation
provides:
  - workflow guidance that tells executors and verifiers to rebuild repo-local runtimes before trusting generated artifacts
  - plugin runtime notifications aligned with repo-local current-checkout and rebuilt-runtime truth
  - JJ temp-repo proof that plugin runtime freshness clears only after the rebuilt local bundle matches touched source
affects: [phase-166, execute-phase, verify-work, plugin-runtime, local-runtime-guidance]
tech-stack:
  added: []
  patterns:
    - workflow prompts now require repo-local current-checkout proof plus rebuilt local runtime validation for generated artifacts
    - plugin runtime freshness uses the most-specific source-to-artifact mapping so src/plugin changes target plugin.js instead of unrelated bundles
key-files:
  created:
    - .planning/phases/165-jj-execution-repo-local-verification/165-03-SUMMARY.md
  modified:
    - workflows/execute-phase.md
    - workflows/verify-work.md
    - src/lib/helpers.js
    - src/plugin/idle-validator.js
    - bin/bgsd-tools.cjs
    - plugin.js
    - tests/workflow.test.cjs
    - tests/guidance-command-integrity-templates-runtime.test.cjs
    - tests/integration.test.cjs
key-decisions:
  - "Execution and verification workflows now tell agents to trust repo-local current-checkout evidence only after rebuilding local generated runtimes."
  - "Runtime freshness matching now prefers the most-specific source prefix so plugin-only edits require plugin.js parity instead of unrelated CLI bundle rebuilds."
  - "Idle validator phase-complete notifications now remind users to verify against the local checkout and rebuild generated runtime guidance when runtime surfaces changed."
patterns-established:
  - "When a touched source file feeds a shipped runtime artifact, workflow wording and runtime notifications must explicitly name the local rebuild step."
  - "JJ temp-repo verification proof should exercise repo-local source-to-bundle truth instead of trusting static text alone."
requirements-completed: [EXEC-03, VERIFY-03]
one-liner: "Repo-local execute, verify, and plugin runtime guidance now require rebuilt local artifacts before trusting generated workflow behavior"
duration: 10 min
completed: 2026-03-30
---

# Phase 165 Plan 03: JJ Execution & Repo-Local Verification Summary

**Repo-local execute, verify, and plugin runtime guidance now require rebuilt local artifacts before trusting generated workflow behavior**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-30T20:06:10Z
- **Completed:** 2026-03-30T20:15:50Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- Taught execute and verify workflows to prove runtime-sensitive changes against the repo-local current checkout plus the rebuilt local runtime.
- Fixed plugin runtime freshness matching so `src/plugin/*` edits validate against `plugin.js` without false CLI-bundle stale reports, then rebuilt shipped bundles.
- Added workflow, runtime, and JJ temp-repo regressions that lock source-to-bundle parity and repo-local rebuilt-runtime proof together.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add workflow and runtime regressions for rebuild-aware local guidance** - `f4770c2` (fix)
2. **Task 2: Update execution and verify workflows to teach repo-local rebuilt-runtime truth** - `6924ab2` (docs)
3. **Task 3: Rebuild plugin runtime output and lock bundle parity** - `58c0e4e` (fix)

**Plan metadata:** Recorded in the final docs commit that captures summary, state, and roadmap updates.

## Files Created/Modified
- `tests/integration.test.cjs` - JJ temp-repo proofs for repo-local CLI and plugin runtime freshness behavior
- `src/lib/helpers.js` - most-specific runtime freshness mapping so plugin edits validate the correct rebuilt local artifact
- `bin/bgsd-tools.cjs` - rebuilt CLI bundle carrying the runtime freshness matching fix
- `workflows/execute-phase.md` - executor guidance now requires repo-local current-checkout plus rebuilt-runtime proof
- `workflows/verify-work.md` - verifier guidance now rebuilds local runtime artifacts before asking users to trust generated output
- `tests/workflow.test.cjs` - workflow contract regression for repo-local rebuilt-runtime wording
- `src/plugin/idle-validator.js` - phase-complete notification now reminds users to verify against the repo-local checkout and rebuilt runtime guidance
- `plugin.js` - rebuilt shipped plugin runtime aligned with idle-validator guidance
- `tests/guidance-command-integrity-templates-runtime.test.cjs` - source/bundle parity regressions for canonical guidance and repo-local rebuild messaging

## Decisions Made
- Repo-local workflow prompts must call out `npm run build` explicitly when validation depends on generated runtime artifacts.
- Plugin runtime freshness matching now resolves overlapping source prefixes by choosing the most specific runtime artifact mapping.
- Runtime notifications should reinforce the same repo-local rebuilt-runtime contract that workflows and verifier checks enforce.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] Plugin source edits were also marked stale against the CLI bundle**
- **Found during:** Task 1 (Add workflow and runtime regressions for rebuild-aware local guidance)
- **Issue:** `src/plugin/idle-validator.js` matched the broad `src/` freshness rule, so plugin-only edits still failed deliverables verification until `bin/bgsd-tools.cjs` existed.
- **Fix:** Updated runtime freshness matching to choose the most-specific source prefix, letting plugin-only edits validate against `plugin.js` as intended.
- **Files modified:** `src/lib/helpers.js`, `bin/bgsd-tools.cjs`, `tests/integration.test.cjs`
- **Verification:** `node --test --test-name-pattern "^deliverables verification follows active checkout freshness instead of stale local bundle assumptions$|^plugin runtime freshness follows repo-local source-to-bundle truth in a JJ temp repo$" tests/integration.test.cjs`
- **Committed in:** `f4770c2`

---

**Total deviations:** 1 auto-fixed (Rule 3: 1)
**Impact on plan:** Needed to make the planned plugin rebuilt-runtime proof truthful. Scope stayed inside Phase 165 runtime freshness behavior.

## Review Findings

Review skipped — execution summary only.

## Issues Encountered
- The broad plan-end `node --test tests/workflow.test.cjs tests/guidance-command-integrity-templates-runtime.test.cjs tests/integration.test.cjs` gate still reports three unrelated pre-existing integration failures: `full state lifecycle`, `full project lifecycle`, and `state load output structure`.
- Focused regressions for workflow guidance, source/bundle parity, and JJ temp-repo runtime freshness all passed after rebuilding the local bundles.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 165 is ready to close: execute, verify, and plugin runtime surfaces now agree on repo-local rebuilt-runtime truth.
- Phase 166 can build on a shipped baseline where workflow guidance, runtime notifications, and JJ temp-repo verification all point at the same local-checkout evidence contract.

## Self-Check: PASSED

- FOUND: `.planning/phases/165-jj-execution-repo-local-verification/165-03-SUMMARY.md`
- FOUND: `f4770c2` task commit
- FOUND: `6924ab2` task commit
- FOUND: `58c0e4e` task commit

---
*Phase: 165-jj-execution-repo-local-verification*
*Completed: 2026-03-30*
