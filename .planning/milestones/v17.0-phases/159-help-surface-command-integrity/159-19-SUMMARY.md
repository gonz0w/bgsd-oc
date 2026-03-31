---
phase: 159-help-surface-command-integrity
plan: 19
subsystem: docs
tags: [skills, command-integrity, validation, markdown]
provides:
  - Remaining skill guidance now uses current canonical CLI command forms
  - Focused regression coverage for the final skill-content blocker slice
affects: [phase-159-verification, command-guidance, skill-surfaces]
tech-stack:
  added: []
  patterns:
    - Direct-file command-guidance regression for validator-clean skill surfaces
key-files:
  created:
    - tests/guidance-command-integrity-skill-tail.test.cjs
  modified:
    - skills/skill-index/SKILL.md
    - skills/planner-dependency-graph/SKILL.md
key-decisions:
  - "Use the current namespaced `bgsd-tools verify:verify plan-wave <phase-dir>` example in skill guidance to match the shipped CLI surface."
  - "Keep the skill-index phase lookup entry explicitly metadata-oriented while updating it to the canonical `bgsd-tools plan:find-phase` route."
patterns-established:
  - "Skill-tail regressions should read shipped skill files directly and also pass the shared command-integrity validator."
requirements-completed: [CMD-06]
one-liner: "Canonicalized planner skill command guidance and added a focused regression for the final skill-content blocker slice"
duration: 3 min
completed: 2026-03-30
---

# Phase 159 Plan 19: Close the remaining skill-content blocker slice by fixing the last two skill files still cited by verification. Summary

**Canonicalized planner skill command guidance and added a focused regression for the final skill-content blocker slice**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-30T04:20:01Z
- **Completed:** 2026-03-30T04:23:04Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Replaced the stale `bgsd-tools verify:plan-wave` example in `skills/planner-dependency-graph/SKILL.md` with the supported namespaced command form.
- Updated `skills/skill-index/SKILL.md` so the phase-argument-parsing metadata points to the canonical `bgsd-tools plan:find-phase` route.
- Added a direct-file regression plus shared-validator proof for the two remaining skill surfaces cited by Phase 159 verification.

## Task Commits

Each task was committed atomically:

1. **Task 1: Canonicalize the remaining skill-content guidance** - `b6b3316` (docs)
2. **Task 2: Lock the skill-content slice with direct regression coverage** - `f75708c` (test)

## Files Created/Modified

- `skills/planner-dependency-graph/SKILL.md` [+1/-1]
- `skills/skill-index/SKILL.md` [+1/-1]
- `tests/guidance-command-integrity-skill-tail.test.cjs` [+43/-0]

## Decisions Made

- Kept the fix scoped to the two skill files named by `159-VERIFICATION.md` so this gap-closure plan stayed surgical.
- Used a dedicated regression file for the skill tail so the final blocker slice has direct proof without reopening already-clean surfaces.

## Deviations from Plan

None - plan executed exactly as written.

## Review Findings

Review skipped — reason: gap closure plan.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The final skill-content blocker slice cited by Phase 159 verification is now canonicalized and regression-covered.
- Phase verification can continue against the remaining non-skill surfaced-guidance gaps without revisiting these two files unless command families change again.

## Self-Check

PASSED

- Found summary file: `.planning/phases/159-help-surface-command-integrity/159-19-SUMMARY.md`
- Verified task commits: `nqzwtzus`, `wuvlulvv`

---
*Phase: 159-help-surface-command-integrity*
*Completed: 2026-03-30*
