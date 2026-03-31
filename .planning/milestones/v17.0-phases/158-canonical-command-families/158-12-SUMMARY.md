---
phase: 158-canonical-command-families
plan: 12
subsystem: testing
tags:
  - plugin
  - testing
  - canonical-commands
  - runtime-guidance
  - regression
requires:
  - phase: 158-canonical-command-families
    provides: canonical plugin runtime guidance updates from Plan 11 for missing-plan and next-phase notices
provides:
  - Focused regression coverage for missing-plan plugin guidance preferring `/bgsd-plan phase`
  - Focused regression coverage for idle-validator next-phase action wording staying canonical-first
affects:
  - phase-158-gap-closure
  - phase-159-help-surface-command-integrity
tech-stack:
  added: []
  patterns:
    - Temp-project plugin tool assertions for surfaced runtime guidance
    - Bundle-exported function string assertions for canonical notification actions
key-files:
  created: []
  modified:
    - tests/plugin.test.cjs
key-decisions:
  - "Assert missing-plan guidance through bgsd_context execution so the test protects surfaced plugin output, not only source text."
  - "Assert next-phase guidance through the bundled createIdleValidator export so canonical action wording is locked without requiring a full editor notification harness."
patterns-established:
  - "Plugin runtime copy changes should gain focused regressions in tests/plugin.test.cjs at the exact surfaced guidance point."
requirements-completed: [CMD-03]
one-liner: "Focused plugin regressions now lock canonical `/bgsd-plan phase` guidance in missing-plan tool output and idle-validator next-step notices"
duration: 4min
completed: 2026-03-29
---

# Phase 158 Plan 12: Add focused regression coverage for the canonical plugin runtime guidance introduced in the plugin gap-closure slice. Summary

**Focused plugin regressions now lock canonical `/bgsd-plan phase` guidance in missing-plan tool output and idle-validator next-step notices**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-29 17:17:18 -0600
- **Completed:** 2026-03-29 17:21:00 -0600
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added a temp-project plugin test that proves missing-plan guidance returned by `bgsd_context` recommends `/bgsd-plan phase`.
- Added a focused regression that locks the idle-validator next-step action to canonical planning-family wording.
- Closed the remaining plugin-runtime regression-proof gap from Plan 11 without broadening scope beyond the touched guidance surfaces.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add missing-plan runtime guidance assertions** - `0c748c3` (test)
2. **Task 2: Add next-phase notification action assertions** - `ded6755` (test)

## Files Created/Modified

- `tests/plugin.test.cjs` [+32/-0]

## Decisions Made

- Asserted missing-plan guidance through live plugin tool execution so the regression protects user-visible runtime output.
- Asserted next-phase action wording through the bundled `createIdleValidator` export so the canonical string stays protected in shipped plugin runtime code.

## Deviations from Plan

None - plan executed exactly as written.

## Review Findings

Review skipped — gap closure plan.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 158 now has focused plugin regression proof for both runtime guidance surfaces updated in Plan 11.
- Verification can treat the plugin-runtime slice of CMD-03 as durably covered rather than depending on manual bundle/source inspection.

## Self-Check: PASSED

- Found summary file: `.planning/phases/158-canonical-command-families/158-12-SUMMARY.md`
- Found task commit: `0c748c39`
- Found task commit: `ded67559`

---
*Phase: 158-canonical-command-families*
*Completed: 2026-03-29*
