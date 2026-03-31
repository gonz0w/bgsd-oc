---
phase: 148-review-readiness-release-pipeline
plan: 01
subsystem: release
tags: [readiness, release, advisory, cli, testing]
requires:
  - phase: 146-code-review-workflow
    provides: review command routing and structured downstream contracts
  - phase: 147-security-audit-workflow
    provides: security scan contract reused by readiness reporting
provides:
  - advisory review:readiness JSON and board formatter
  - routed release:bump/changelog/tag/pr command scaffolds
  - fixture-backed readiness contract tests
affects: [148-02, 148-03, 148-04, workflows/release.md]
tech-stack:
  added: []
  patterns: [advisory readiness classification, board-first TTY formatting, release namespace scaffolding]
key-files:
  created: [src/commands/release.js, src/lib/review/readiness.js, tests/review-readiness.test.cjs]
  modified: [src/commands/review.js, src/router.js, src/lib/constants.js, src/lib/command-help.js, bin/bgsd-tools.cjs, plugin.js, bin/manifest.json]
key-decisions:
  - "Readiness executes test/lint checks when scripts exist, but missing scripts or reports degrade to explicit skip reasons."
  - "TODO and changelog readiness evaluate the current git diff so the command stays deterministic and advisory-only."
  - "Phase 148 reserves only release:bump/changelog/tag/pr surfaces instead of introducing a generic release framework."
patterns-established:
  - "Advisory readiness contract: pass/fail/skip with stable keys and secondary detail reasons."
  - "Release namespace scaffolds can ship before underlying automation so workflow/help wiring lands early."
requirements-completed: [READY-01, READY-02]
one-liner: "Advisory review:readiness contract with deterministic pass/fail/skip checks and routed release scaffolds"
duration: 5min
completed: 2026-03-28
---

# Phase 148 Plan 01: Review Readiness & Release Pipeline Summary

**Advisory review:readiness contract with deterministic pass/fail/skip checks and routed release scaffolds**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-28T22:38:59Z
- **Completed:** 2026-03-28T22:44:07Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- Added routed `review:readiness` and `release:*` command surfaces through the normal router/help flow.
- Implemented a shared readiness helper that classifies tests, lint, review, security, TODO diff, and changelog checks into explicit pass/fail/skip results.
- Locked the advisory JSON contract and board-first pretty output with focused readiness tests.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the routed readiness/release command surfaces and help wiring** - `c9e7df6` (feat)
2. **Task 2: Implement deterministic readiness checks with explicit skip reasons and color-coded board formatting** - `2b32a26` (feat)
3. **Task 3: Add readiness contract tests for advisory semantics and board output** - `6356185` (test)

**Plan metadata:** Pending final docs commit

## Files Created/Modified
- `src/commands/release.js` - Scaffolds routed `release:bump`, `release:changelog`, `release:tag`, and `release:pr` commands.
- `src/lib/review/readiness.js` - Collects deterministic readiness checks and renders advisory board output.
- `src/commands/review.js` - Routes `review:readiness` through the shared helper beside `review:scan`.
- `src/router.js` - Registers the new review and release namespace routes plus help fallbacks.
- `src/lib/constants.js` - Documents readiness and release help text.
- `src/lib/command-help.js` - Adds readiness/release command catalog metadata and aliases.
- `tests/review-readiness.test.cjs` - Covers JSON contract, skip/fail classification, advisory pretty output, and release scaffold routing.
- `bin/bgsd-tools.cjs` - Bundled CLI artifact rebuilt with the new readiness and release surfaces.
- `plugin.js` - Rebuilt plugin artifact after CLI changes.
- `bin/manifest.json` - Refreshed build manifest.

## Decisions Made
- Readiness runs real `npm run test` and `npm run lint` scripts when configured, but reports missing scripts as `skip` instead of guessing failure.
- Review and security readiness rely on deterministic report artifacts when present and otherwise surface explicit skip reasons.
- The command stays advisory-only even when checks fail, so downstream release work can inspect readiness without hidden blocking semantics.

## Deviations from Plan

None - plan executed exactly as written.

## Review Findings

Review skipped — execution summary only; no post-execution review workflow was run for this plan.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 148 now has a stable advisory readiness contract and a reserved release command namespace for semver/changelog/tag/PR work.
- Later plans can build on the readiness JSON contract without reclassifying pass/fail/skip behavior.

## Self-Check: PASSED

- Found `.planning/phases/148-review-readiness-release-pipeline/148-01-SUMMARY.md`
- Verified task commits `c9e7df6`, `2b32a26`, and `6356185`
