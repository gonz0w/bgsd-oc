---
phase: 158-canonical-command-families
plan: 13
subsystem: workflow
tags: [markdown, javascript, plugin, command-guidance, regression-tests]
requires:
  - phase: 158-canonical-command-families
    provides: Canonical command-family wrappers and earlier canonical guidance updates from Plans 01-12
provides:
  - Canonical-first wording on the last shipped GAP-158-01 docs and workflow surfaces
  - Canonical PLAN.md advisory guidance in source and bundled plugin output
  - Focused regression coverage for the remaining Phase 158 guidance gap
affects: [phase-158-verification, phase-159-help-surface-command-integrity, command-guidance]
tech-stack:
  added: []
  patterns:
    - Canonical planning and settings commands stay primary while legacy aliases are labeled compatibility-only on touched surfaces
    - Plugin advisory wording changes rebuild plugin.js immediately so shipped runtime text matches source
key-files:
  created: [tests/guidance-remaining-surfaces.test.cjs]
  modified: [docs/commands.md, workflows/help.md, workflows/verify-work.md, workflows/new-milestone.md, workflows/execute-phase.md, workflows/settings.md, src/plugin/advisory-guardrails.js, plugin.js]
key-decisions:
  - Preserve legacy aliases only as compatibility notes on touched docs and workflow surfaces instead of removing them outright
  - Keep PLAN.md direct-edit advisories mapped to `/bgsd-plan phase` in both source and the shipped plugin bundle
  - Limit regression coverage to the exact GAP-158-01 evidence files so Phase 158 closes without expanding into Phase 159's broader audit work
patterns-established:
  - Canonical-first help and workflow guidance should name the family subcommand, then mention the legacy alias only as fallback compatibility text
  - Guidance regressions for migration slices can lock exact string surfaces with one focused fixture-backed test file
requirements-completed: [CMD-03]
one-liner: "Canonical `/bgsd-plan phase`, `/bgsd-plan gaps`, and `/bgsd-settings profile` guidance now covers the last Phase 158 docs, workflow, and plugin advisory surfaces with focused regression proof"
duration: 3 min
completed: 2026-03-29
---

# Phase 158 Plan 13: Close the last Phase 158 guidance gap by updating the remaining shipped help, docs, workflow, and plugin advisory surfaces that still prefer legacy planning or settings aliases. Summary

**Canonical `/bgsd-plan phase`, `/bgsd-plan gaps`, and `/bgsd-settings profile` guidance now covers the last Phase 158 docs, workflow, and plugin advisory surfaces with focused regression proof**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-29T23:37:18Z
- **Completed:** 2026-03-29T23:41:15Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Reworded the remaining GAP-158-01 docs and workflow evidence surfaces so canonical planning and settings family commands are the recommended path.
- Updated PLAN.md advisory guardrails to recommend `/bgsd-plan phase` and rebuilt `plugin.js` so the shipped plugin matches the source guidance.
- Added a narrow regression file that reads the touched docs, workflows, advisory source, and plugin bundle to prevent legacy-preferred wording from returning on these surfaces.

## Task Commits

Each task was committed atomically:

1. **Task 1: Canonicalize the remaining docs and workflow guidance surfaces cited by GAP-158-01** - `335cfc0` (docs)
2. **Task 2: Update PLAN.md plugin advisories and rebuild the shipped bundle** - `4631cad` (docs)
3. **Task 3: Add focused regressions for the remaining guidance and advisory surfaces** - `3b78827` (test)

## Files Created/Modified

- `docs/commands.md` - Demotes lingering legacy planning and settings aliases to compatibility-only wording.
- `workflows/help.md` - Surfaces `/bgsd-plan gaps` as the canonical audit-gap command.
- `workflows/verify-work.md` - Routes gap closure handoff through `/bgsd-plan gaps ${PHASE}`.
- `workflows/new-milestone.md` - Recommends `/bgsd-plan phase [N]` for skip-discussion planning.
- `workflows/execute-phase.md` - Offers `/bgsd-plan gaps {X}` after verification gaps.
- `workflows/settings.md` - Rewrites quick commands around `/bgsd-settings profile` and `/bgsd-plan phase`.
- `src/plugin/advisory-guardrails.js` - Changes PLAN.md advisory mapping to `/bgsd-plan phase`.
- `plugin.js` - Bundled plugin output rebuilt with the updated PLAN.md advisory string.
- `tests/guidance-remaining-surfaces.test.cjs` - Focused regression coverage for the remaining GAP-158-01 evidence files.

## Decisions Made

- Kept all touched legacy command mentions as compatibility-only notes instead of removing them, preserving migration behavior while making canonical commands primary.
- Treated the bundled plugin output as part of the same user-facing guidance contract as the source advisory map, so the source wording change was not considered complete until `plugin.js` matched.
- Scoped the new regression file strictly to the named GAP-158-01 evidence surfaces to finish Phase 158 without starting Phase 159's repo-wide integrity audit.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Phase 158 now has canonical-first coverage for the final shipped guidance surfaces called out by GAP-158-01.
- The phase is ready for verification closure and for Phase 159's broader help/reference integrity work.

## Self-Check: PASSED

- Found `.planning/phases/158-canonical-command-families/158-13-SUMMARY.md`
- Found task commits `lunskxpu`, `pnoqklmt`, and `zqowxuvk`
