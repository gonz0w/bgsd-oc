---
phase: 158-canonical-command-families
plan: 09
subsystem: workflow
tags: [markdown, workflows, commands, planning, regressions]
requires:
  - phase: 158-canonical-command-families
    provides: Canonical `/bgsd-plan` family routing and locked plan-versus-gap subcommand boundaries
provides:
  - Canonical planning-family next-step guidance in `progress` and `discuss-phase`
  - Focused regression coverage for progress/discuss workflow prompt surfaces in GAP-158-01
affects:
  - phase-158-follow-on-plans
  - phase-159-help-surface-command-integrity
tech-stack:
  added: []
  patterns:
    - Workflow next-step messaging should prefer canonical family subcommands while keeping legacy aliases compatibility-only elsewhere
    - Focused guidance regressions can lock individual workflow prompt surfaces without expanding into broader help-surface audits
key-files:
  created: [tests/guidance-workflows.test.cjs]
  modified: [workflows/progress.md, workflows/discuss-phase.md]
key-decisions:
  - Use `/bgsd-plan phase` for ready-to-plan and auto-advance prompts while reserving `/bgsd-plan gaps` for gap-planning follow-ups
  - Add a dedicated workflow-guidance regression file scoped only to `progress.md` and `discuss-phase.md`
patterns-established:
  - "Canonical workflow follow-ups: progress and discuss prompts should recommend `/bgsd-plan` subcommands, not legacy top-level aliases"
  - "Gap-slice regression tests: add one focused test file per touched workflow/doc surface instead of broadening unrelated workflow suites"
requirements-completed: [CMD-03]
one-liner: "Progress and discuss workflow prompts now route planning follow-ups through `/bgsd-plan phase|gaps` with focused regressions blocking legacy-preferred guidance"
duration: 2min
completed: 2026-03-29
---

# Phase 158 Plan 09: Close the progress/discuss workflow-prompt portion of GAP-158-01 by replacing the remaining legacy planning guidance surfaced from those next-step workflows. Summary

**Progress and discuss workflow prompts now route planning follow-ups through `/bgsd-plan phase|gaps` with focused regressions blocking legacy-preferred guidance**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-29 17:11:57 -0600
- **Completed:** 2026-03-29 17:13:40 -0600
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Rewrote the `progress` workflow's planning follow-ups so ready-to-plan and gap-fix routes prefer `/bgsd-plan phase` and `/bgsd-plan gaps`.
- Updated `discuss-phase` next-step, `--skip-research`, and auto-advance prompts to point at canonical planning-family commands instead of `/bgsd-plan-phase`.
- Added a narrow regression file that fails if these workflow surfaces drift back to legacy-preferred planning guidance.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite progress and post-discuss guidance to canonical planning-family forms** - `555cab1` (docs)
2. **Task 2: Lock canonical progress/discuss prompts with focused guidance regressions** - `3d69a8b` (test)

## Files Created/Modified

- `tests/guidance-workflows.test.cjs` [+39/-0]
- `workflows/discuss-phase.md` [+4/-4]
- `workflows/progress.md` [+5/-5]

## Decisions Made

- Used `/bgsd-plan gaps` specifically for the UAT-gap route in `progress.md` so gap closure stays on the canonical planning-family branch rather than reusing the phase-planning alias.
- Kept regression coverage in a dedicated `tests/guidance-workflows.test.cjs` file so this GAP-158-01 slice stays limited to the touched workflow prompts.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The plan's focused verification target did not exist yet, so I authored `tests/guidance-workflows.test.cjs` before the task commits and used `jj commit <paths>` to keep the workflow edits and regression coverage in separate atomic commits.

## Next Phase Readiness

- GAP-158-01 is now closed for the progress/discuss workflow surfaces, leaving the remaining legacy-guidance cleanup to the other planned Phase 158 slices.
- Phase 159 can build on these canonical next-step patterns when auditing broader help and command-reference surfaces.

## Self-Check: PASSED

- Found `.planning/phases/158-canonical-command-families/158-09-SUMMARY.md`.
- Verified task commits `555cab18` and `3d69a8b9` in `jj log`.

---
*Phase: 158-canonical-command-families*
*Completed: 2026-03-29*
