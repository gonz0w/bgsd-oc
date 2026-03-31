---
phase: 159-help-surface-command-integrity
plan: 15
subsystem: workflows
tags: [commands, workflows, validation, guidance]
requires:
  - phase: 159-help-surface-command-integrity
    provides: canonical gap-closure guidance patterns and direct-file regressions from Plan 13
provides:
  - canonical discuss-phase progress fallback and phase-aware standalone guidance wording
  - focused regression coverage for the discuss-phase blocker slice
affects: [workflows, tests, verification]
tech-stack:
  added: []
  patterns: [direct-file workflow guidance regression, reference-only shorthand labeling]
key-files:
  created:
    - tests/guidance-command-integrity-workflow-prep-b.test.cjs
  modified:
    - workflows/discuss-phase.md
key-decisions:
  - "Use `/bgsd-inspect progress` for missing-phase guidance so users get the canonical executable phase discovery path."
  - "Keep the generic standalone discuss form as explicitly reference-only `/bgsd-plan discuss [phase]` text so the workflow never advertises a bare runnable command."
patterns-established:
  - "Workflow-prep regressions should read the exact shipped workflow file and assert both textual guidance and validator acceptance."
requirements-completed: [CMD-06]
one-liner: "Discuss-phase guidance now routes missing-phase recovery through `/bgsd-inspect progress` and labels standalone discuss usage as reference-only with a required phase placeholder"
duration: 1 min
completed: 2026-03-30
---

# Phase 159 Plan 15: Close the discuss-phase blocker slice by fixing the remaining stale progress and missing-phase guidance in that workflow. Summary

**Discuss-phase guidance now routes missing-phase recovery through `/bgsd-inspect progress` and labels standalone discuss usage as reference-only with a required phase placeholder**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-29 22:21:25 -0600
- **Completed:** 2026-03-29 22:21:32 -0600
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Replaced the stale `/bgsd-progress` fallback in `workflows/discuss-phase.md` with canonical `/bgsd-inspect progress` guidance.
- Reworded the generic discuss entrypoint mention so it uses explicit reference-only `/bgsd-plan discuss [phase]` wording instead of a bare runnable command.
- Added a focused regression that reads the shipped workflow file directly and verifies the shared command-integrity validator accepts the slice.

## Task Commits

Each task was committed atomically:

1. **Task 1: Canonicalize the discuss-phase guidance slice** - `ce522bb` (docs)
2. **Task 2: Lock the discuss-phase slice with direct regression coverage** - `9291c74` (test)

## Files Created/Modified

- `workflows/discuss-phase.md` - Canonicalized the phase-discovery fallback and reference-only standalone discuss wording.
- `tests/guidance-command-integrity-workflow-prep-b.test.cjs` - Locks the discuss-phase blocker slice with direct file assertions plus validator coverage.

## Decisions Made

- Use `/bgsd-inspect progress` whenever this workflow tells users how to discover available phases, because the legacy progress alias is no longer canonical.
- Treat the generic standalone discuss form as reference-only `/bgsd-plan discuss [phase]` text so users are never shown a bare discuss command they cannot run literally.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- The discuss-phase blocker cited by `159-VERIFICATION.md` is now covered by direct workflow regression proof.
- Remaining Phase 159 gap-closure work can continue on the other untouched workflow, runtime, and skill slices without reopening this file.

## Self-Check: PASSED

- FOUND: `.planning/phases/159-help-surface-command-integrity/159-15-SUMMARY.md`
- FOUND: `pxsltttt` task commit for discuss-phase guidance cleanup
- FOUND: `szvlywrs` task commit for discuss-phase regression coverage

---
*Phase: 159-help-surface-command-integrity*
*Completed: 2026-03-30*
