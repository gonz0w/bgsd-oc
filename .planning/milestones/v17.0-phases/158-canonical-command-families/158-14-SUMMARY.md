---
phase: 158-canonical-command-families
plan: 14
subsystem: docs
tags: [markdown, docs, command-guidance, regression-tests]
requires:
  - phase: 158-canonical-command-families
    provides: Canonical command-family wrappers and prior Phase 158 guidance migrations through Plan 13
provides:
  - Canonical planning and settings wording on the remaining Phase 158 documentation evidence surfaces
  - Focused regression coverage for the architecture, planning, agent, expert, configuration, and troubleshooting docs gap
affects: [phase-158-verification, phase-159-help-surface-command-integrity, command-guidance]
tech-stack:
  added: []
  patterns:
    - Remaining shipped documentation examples should prefer canonical planning and settings family commands while keeping legacy aliases compatibility-only where needed
    - Narrow regression tests can lock exact canonical replacements on targeted evidence surfaces without widening into the broader Phase 159 audit
key-files:
  created: [tests/guidance-docs-phase-158-gap.test.cjs]
  modified: [docs/architecture.md, docs/planning-system.md, docs/agents.md, docs/expert-guide.md, docs/configuration.md, docs/troubleshooting.md]
key-decisions:
  - Keep the touched docs focused on canonical `/bgsd-plan ...` and `/bgsd-settings profile` examples instead of preserving legacy aliases as peer options
  - Use `/bgsd-plan gaps` for the expert-guide gap-planning examples so the remaining docs align with the locked canonical planning-family map
  - Limit regression coverage to the exact GAP-158-01 documentation evidence files cited by the verification report
patterns-established:
  - Documentation examples in Phase 158 should name the canonical family subcommand directly rather than teaching a legacy top-level alias first
  - Focused guidance regressions should assert both the expected canonical string and the absence of the legacy-preferred example on each touched surface
requirements-completed: [CMD-03]
one-liner: "The remaining Phase 158 documentation evidence files now teach canonical planning and settings family commands first, with focused regression proof"
duration: 4 min
completed: 2026-03-29
---

# Phase 158 Plan 14: Close the remaining documentation-reference GAP-158-01 surfaces by replacing legacy-preferred planning, gap, and settings examples across the still-shipped docs evidence files. Summary

**The remaining Phase 158 documentation evidence files now teach canonical planning and settings family commands first, with focused regression proof**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-29T23:54:00Z
- **Completed:** 2026-03-29T23:58:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Replaced the remaining legacy-preferred planning and settings examples in architecture, planning-system, agents, expert-guide, configuration, and troubleshooting docs with canonical family commands.
- Kept the expert-guide gap-planning references aligned with the canonical `/bgsd-plan gaps` route instead of older top-level aliases.
- Added a focused regression file that locks the exact documentation surfaces cited by GAP-158-01.

## Task Commits

Each task was committed atomically:

1. **Task 1: Canonicalize the remaining architecture and operational docs examples** - `51114ee` / `qpromtsx` (docs)
2. **Task 2: Canonicalize the remaining expert-guide planning and gap examples** - `94646a0` / `svrswuxp` (docs)
3. **Task 3: Add focused regressions for the remaining doc guidance evidence surfaces** - `d852ef9` / `yzpxzqml` (test)

## Files Created/Modified

- `docs/architecture.md` - Switches the data-flow planning example to canonical `/bgsd-plan phase`.
- `docs/planning-system.md` - Renames the planning command in the artifact-creation walkthrough to `/bgsd-plan phase`.
- `docs/agents.md` - Updates planner, plan-checker, and researcher spawn examples to canonical planning-family commands.
- `docs/expert-guide.md` - Rewrites remaining planning, research, and gap examples to canonical planning-family forms.
- `docs/configuration.md` - Changes the quick profile-switch example to `/bgsd-settings profile`.
- `docs/troubleshooting.md` - Points skip-verify recovery guidance at `/bgsd-plan phase`.
- `tests/guidance-docs-phase-158-gap.test.cjs` - Adds focused regression coverage for the remaining documentation evidence surfaces.

## Decisions Made

- Treated the listed documentation files as the full Plan 14 scope instead of widening into a repo-wide docs sweep.
- Standardized the remaining expert-guide gap examples on `/bgsd-plan gaps` so the docs match the canonical planning family already shipped elsewhere.
- Locked the touched guidance with exact-string regression assertions to keep future edits from reintroducing legacy-preferred wording.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- The documentation half of GAP-158-01 is now closed on the cited evidence surfaces.
- Phase 158 verification can now focus on the remaining workflow prompt gap and then re-check CMD-03 at phase scope.

## Self-Check: PASSED

- Found `.planning/phases/158-canonical-command-families/158-14-SUMMARY.md`
- Found task commits `qpromtsx`, `svrswuxp`, and `yzpxzqml`
