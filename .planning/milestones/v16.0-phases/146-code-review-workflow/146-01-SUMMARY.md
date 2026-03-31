---
phase: 146-code-review-workflow
plan: 01
subsystem: review
tags: [git, review, cli, diff]
requires:
  - phase: 145-structured-agent-memory
    provides: MEMORY-aware workflow foundation and current milestone state
provides:
  - review:scan CLI entrypoint with staged-first target resolution
  - commit-range fallback metadata and incomplete-scope warnings
  - exact rule-plus-path exclusions for .planning/review-exclusions.json
affects: [phase-146-review-workflow, verifier-review-context, future-review-rules]
tech-stack:
  added: []
  patterns: [staged-first review target selection, exact rule-plus-path suppression]
key-files:
  created: [src/commands/review.js, src/lib/review/config.js, src/lib/review/target.js, src/lib/review/diff.js, src/lib/review/exclusions.js, tests/review.test.cjs]
  modified: [src/router.js, src/lib/constants.js, src/lib/command-help.js, bin/bgsd-tools.cjs, bin/manifest.json]
key-decisions:
  - "review:scan returns a promptable commit-range fallback when nothing is staged instead of guessing file scope"
  - "review exclusions require exact rule_id plus normalized repo-relative path and a reason"
patterns-established:
  - "Review target resolution happens before any rule execution and always returns machine-readable metadata"
  - "Suppressed review findings stay out of the live findings list while preserving audit reasons in exclusions metadata"
requirements-completed: [REV-01, REV-05]
one-liner: "Staged-first review:scan target resolution with commit-range fallback, scope warnings, and exact exclusion matching"
duration: 2 min
completed: 2026-03-28
---

# Phase 146 Plan 01: Establish the CLI review surface and diff-target plumbing for Phase 146 Summary

**Staged-first review:scan target resolution with commit-range fallback, scope warnings, and exact exclusion matching**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-28T19:53:42Z
- **Completed:** 2026-03-28T19:55:11Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Added a routed `review:scan` CLI surface with help text and TTY/JSON output support.
- Implemented staged-first target selection, explicit empty-stage fallback metadata, diff hunk parsing, and incomplete-scope warnings.
- Added exact `rule_id + path + reason` exclusion handling plus command-level tests for review target and suppression contracts.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the review command surface and router/help wiring** - `4c5c391` (feat)
2. **Task 2: Implement staged-first target resolution, incomplete-scope warnings, and exclusion matching** - `328dbd0` (feat)
3. **Task 3: Add CLI-contract tests for review target selection and exclusions** - `2c7a3ed` (test)

**Plan metadata:** Recorded in the final documentation commit for this plan.

## Files Created/Modified

- `src/commands/review.js` - `review:scan` command contract and formatted/json output.
- `src/lib/review/config.js` - review config loading with confidence threshold defaults.
- `src/lib/review/target.js` - staged-first target resolution, commit-range fallback, and scope warnings.
- `src/lib/review/diff.js` - unified diff parsing into repo-relative changed-line ranges.
- `src/lib/review/exclusions.js` - exact exclusion loading and matching with required reasons.
- `src/router.js` - review namespace routing.
- `src/lib/constants.js` - `review:scan` help text.
- `src/lib/command-help.js` - command catalog wiring for discovery/help surfaces.
- `tests/review.test.cjs` - CLI-contract coverage for target resolution and exclusions.
- `bin/bgsd-tools.cjs` - rebuilt bundled CLI.
- `bin/manifest.json` - manifest refresh including new review files.

## Decisions Made

- Returned a promptable `commit-range` fallback when no staged diff exists so review scope stays explicit instead of guessing from file paths.
- Treated incomplete-scope warnings as separate metadata from findings so downstream review rules can stay deterministic.
- Matched exclusions only on exact normalized `rule_id + path` pairs and required reasons to keep suppression auditable.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `util:summary-generate` could not infer scoped task commits from the commit message scope, so task hashes were documented manually in this summary.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `review:scan` now provides a stable diff-target/exclusion contract for later rule execution and workflow orchestration work.
- Phase 146 can build review rules and `/bgsd-review` orchestration on top of this command without rediscovering Git scope.

## Self-Check: PASSED

- Found `.planning/phases/146-code-review-workflow/146-01-SUMMARY.md`
- Found task commits `4c5c391`, `328dbd0`, and `2c7a3ed`

---
*Phase: 146-code-review-workflow*
*Completed: 2026-03-28*
