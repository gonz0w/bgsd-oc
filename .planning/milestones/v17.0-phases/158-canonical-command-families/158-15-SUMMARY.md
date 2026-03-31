---
phase: 158-canonical-command-families
plan: 15
subsystem: workflow
tags: [markdown, workflows, command-guidance, regression-tests]
requires:
  - phase: 158-canonical-command-families
    provides: Canonical command-family wrappers and prior guidance updates through Plan 14
provides:
  - Canonical planning-family follow-up wording on the remaining Phase 158 workflow evidence surfaces
  - Focused regression coverage for lifecycle, resume, debug, audit, and phase-management workflow guidance
affects: [phase-158-verification, phase-159-help-surface-command-integrity, workflow-guidance]
tech-stack:
  added: []
  patterns:
    - Workflow next-step guidance should choose the exact canonical planning-family subcommand that matches the intended follow-up action
    - Focused regression files can guard narrow workflow guidance slices without broadening into a full help-surface integrity audit
key-files:
  created: [tests/guidance-workflows-phase-158-gap.test.cjs]
  modified: [workflows/transition.md, workflows/insert-phase.md, workflows/plan-milestone-gaps.md, workflows/resume-project.md, workflows/list-phase-assumptions.md, workflows/debug.md, workflows/audit-milestone.md, workflows/add-phase.md]
key-decisions:
  - Use `/bgsd-plan discuss` for discussion-first follow-ups and `/bgsd-plan phase` only when the workflow is ready for direct planning
  - Standardize gap-oriented workflow suggestions on `/bgsd-plan gaps` instead of legacy `-gaps` aliases or `phase --gaps` examples
  - Keep the new regression suite scoped to the eight workflow evidence files cited by GAP-158-01
patterns-established:
  - Workflow prompts should choose between `/bgsd-plan discuss`, `/bgsd-plan phase`, and `/bgsd-plan gaps` based on the actual next step instead of using one generic planning alias everywhere
  - Canonical workflow guidance regressions should assert the intended canonical subcommand per surface, not only the absence of legacy text
requirements-completed: [CMD-03]
one-liner: "The remaining Phase 158 workflow evidence files now route users through canonical planning-family follow-ups, with focused regression proof"
duration: 4 min
completed: 2026-03-29
---

# Phase 158 Plan 15: Close the remaining workflow-prompt GAP-158-01 surfaces by replacing legacy-preferred planning and gap follow-up commands across the still-shipped workflow evidence files. Summary

**The remaining Phase 158 workflow evidence files now route users through canonical planning-family follow-ups, with focused regression proof**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-29T23:55:00Z
- **Completed:** 2026-03-29T23:59:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Replaced legacy planning and gap aliases on the remaining workflow evidence surfaces with the correct canonical follow-up command for each flow.
- Updated resume and transition guidance to use `/bgsd-plan discuss` versus `/bgsd-plan phase` based on whether context already exists.
- Added a focused regression file that locks the exact workflow guidance surfaces cited by GAP-158-01.

## Task Commits

Each task was committed atomically:

1. **Task 1: Canonicalize lifecycle and phase-management workflow follow-ups** - `6b64fbf` / `pvoszttw` (docs)
2. **Task 2: Canonicalize resume, debug, and audit workflow guidance** - `3cbcc54` / `olknlypk` (docs)
3. **Task 3: Add focused regressions for the remaining workflow guidance evidence surfaces** - `8605121` / `sqpuqwxw` (test)

## Files Created/Modified

- `workflows/transition.md` - Routes no-context follow-ups to `/bgsd-plan discuss` and ready-to-plan follow-ups to `/bgsd-plan phase`.
- `workflows/insert-phase.md` - Points urgent inserted phases to the canonical planning-family command.
- `workflows/plan-milestone-gaps.md` - Uses `/bgsd-plan phase` for the next gap-closure planning step.
- `workflows/add-phase.md` - Updates the next-step planning command to `/bgsd-plan phase`.
- `workflows/resume-project.md` - Switches plan and discuss follow-ups to canonical planning-family commands.
- `workflows/list-phase-assumptions.md` - Rewrites the planning option to `/bgsd-plan phase ${PHASE}`.
- `workflows/debug.md` - Suggests `/bgsd-plan gaps` for fix planning.
- `workflows/audit-milestone.md` - Uses `/bgsd-plan gaps` for gap and tech-debt follow-up routes.
- `tests/guidance-workflows-phase-158-gap.test.cjs` - Adds focused regression coverage for the remaining workflow evidence surfaces.

## Decisions Made

- Differentiated discuss versus phase follow-ups in workflow prompts instead of collapsing everything to `/bgsd-plan phase`.
- Standardized gap-planning workflow prompts on `/bgsd-plan gaps` to match the canonical family map already enforced elsewhere in Phase 158.
- Limited the regression suite to the evidence files named in the verification gap so Phase 158 closes cleanly without starting the larger Phase 159 audit.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- The workflow half of GAP-158-01 is now closed on the cited evidence surfaces.
- Phase 158 is ready for re-verification of CMD-03 at full phase scope.

## Self-Check: PASSED

- Found `.planning/phases/158-canonical-command-families/158-15-SUMMARY.md`
- Found task commits `pvoszttw`, `olknlypk`, and `sqpuqwxw`
