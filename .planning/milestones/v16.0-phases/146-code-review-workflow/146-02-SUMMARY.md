---
phase: 146-code-review-workflow
plan: 02
subsystem: review
tags: [review, cli, autofix, confidence]
requires:
  - phase: 145-structured-agent-memory
    provides: MEMORY-aware execution baseline and milestone state tracking
  - phase: 146-code-review-workflow
    provides: staged-first review target resolution and exclusion matching from plan 01
provides:
  - diff-scoped rule execution for changed hunks only
  - centralized AUTO-FIX, ASK, and INFO routing with confidence gating
  - mechanical patch validation that downgrades failed fixes into ASK findings
affects: [phase-146-review-workflow, phase-147-security-audit, verifier-review-context]
tech-stack:
  added: []
  patterns: [diff-scoped rule registry, mechanical line-level patch validation, severity-led review output]
key-files:
  created: [src/lib/review/scan.js, src/lib/review/rules/index.js, src/lib/review/rules/js-unused-import.js, src/lib/review/rules/debug-leftovers.js, src/lib/review/rules/trust-boundary.js, src/lib/review/fixes.js, src/lib/review/routing.js]
  modified: [src/commands/review.js, src/lib/review/severity.js, tests/review.test.cjs]
key-decisions:
  - "Keep the initial rule set intentionally small and high precision: unused imports, debug leftovers, and trust-boundary markers"
  - "Route all user-visible findings through one post-detection gate so confidence, autofix, ASK batching, and output shaping stay consistent"
patterns-established:
  - "Review rules emit raw findings first; routing decides whether each finding becomes AUTO-FIX, ASK, INFO, or suppressed"
  - "Mechanical fixes validate against exact current file lines and degrade to ASK instead of aborting the scan"
requirements-completed: [REV-01, REV-02, REV-03]
one-liner: "Diff-scoped review rules with confidence gating, silent mechanical fixes, and themed ASK batching for review:scan"
duration: 9 min
completed: 2026-03-28
---

# Phase 146 Plan 02: Build the diff-scoped rule engine, confidence gate, and fix-first routing Summary

**Diff-scoped review rules with confidence gating, silent mechanical fixes, and themed ASK batching for review:scan**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-28T20:00:00Z
- **Completed:** 2026-03-28T20:09:44Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Added a diff-scoped scanner that runs a deliberately small high-precision rule set only on changed hunks.
- Centralized confidence gating, mechanical autofix application, ASK grouping, and severity-led report shaping.
- Expanded review tests to cover low-confidence suppression, autofix downgrade behavior, themed ASK batching, and quiet pretty output.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the diff-scoped scan pipeline and initial high-precision rule registry** - `3a31bf8` (feat)
2. **Task 2: Add central routing, mechanical fix validation, and severity-led output shaping** - `dff3365` (feat)
3. **Task 3: Expand review tests for confidence gating, auto-fix downgrades, and ask batching** - `40df1c0` (test)

**Plan metadata:** Recorded in the final documentation commit for this plan.

## Files Created/Modified

- `src/lib/review/scan.js` - diff-scoped rule execution entrypoint for changed review targets.
- `src/lib/review/rules/index.js` - review rule registry and changed-line execution context.
- `src/lib/review/rules/js-unused-import.js` - high-confidence unused import detection with mechanical fix payloads.
- `src/lib/review/rules/debug-leftovers.js` - debug logging and debugger detection with silent-fix support.
- `src/lib/review/rules/trust-boundary.js` - trust-boundary heuristics that route to user review.
- `src/lib/review/fixes.js` - exact line-level patch validation and apply/degrade helpers.
- `src/lib/review/routing.js` - centralized confidence gate, routing, ASK grouping, and autofix handling.
- `src/commands/review.js` - severity-led formatted output plus routed review JSON payload assembly.
- `src/lib/review/severity.js` - normalized severity ordering and summary helpers.
- `tests/review.test.cjs` - end-to-end routing, suppression, autofix, and pretty-output coverage.

## Decisions Made

- Started with only three rule families so the first shipped scanner stays trustworthy instead of chasing broad linter-style coverage.
- Kept confidence handling entirely in the routing layer so rules can focus on detection and emit richer raw metadata.
- Validated mechanical fixes against exact file lines and downgraded failures to ASK so one stale patch cannot abort the whole review.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Local verification required rebuilding `bin/bgsd-tools.cjs`, but bundled artifacts were left out of task commits because the worktree already contained unrelated user changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `review:scan` now emits routed findings and grouped ASK payloads that `/bgsd-review` can consume directly.
- Phase 147 can reuse the same scan → route → summarize structure for security-oriented rule packs.

## Self-Check: PASSED

- Found `.planning/phases/146-code-review-workflow/146-02-SUMMARY.md`
- Found task commits `3a31bf8`, `dff3365`, and `40df1c0`

---
*Phase: 146-code-review-workflow*
*Completed: 2026-03-28*
