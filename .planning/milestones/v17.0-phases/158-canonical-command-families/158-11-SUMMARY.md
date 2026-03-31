---
phase: 158-canonical-command-families
plan: 11
subsystem: plugin
tags:
  - plugin
  - canonical-commands
  - runtime-guidance
  - bundle
  - planning
requires:
  - phase: 158-canonical-command-families
    provides: canonical planning-family routing and CMD-03 gap evidence from earlier Phase 158 plans and verification
provides:
  - Canonical `/bgsd-plan phase` guidance in plugin missing-plan notices
  - Canonical `/bgsd-plan phase` next-step action in idle phase-complete notifications
  - Rebuilt `plugin.js` bundle aligned with the updated source guidance
affects:
  - phase-158-gap-closure
  - phase-159-help-surface-command-integrity
tech-stack:
  added: []
  patterns:
    - Plugin runtime guidance strings must prefer canonical command-family wording while legacy aliases remain compatibility-only
    - Source-side plugin wording changes require rebuilding `plugin.js` so shipped runtime output matches source
key-files:
  created: []
  modified:
    - src/plugin/tools/bgsd-context.js
    - src/plugin/idle-validator.js
    - plugin.js
key-decisions:
  - Keep the scope limited to surfaced runtime notices and bundled parity rather than changing alias inventories or unrelated plugin references
  - Treat the plugin bundle rebuild as a separate atomic task so shipped runtime text stays auditable against the source edit
patterns-established:
  - "Canonical runtime guidance: plugin notices should recommend `/bgsd-plan phase` instead of legacy planning aliases"
  - "Bundle honesty: after plugin source wording changes, rebuild and commit `plugin.js` separately so shipped output matches runtime source"
requirements-completed: [CMD-03]
one-liner: "Plugin runtime missing-plan and next-phase notices now point to `/bgsd-plan phase`, and the shipped `plugin.js` bundle matches that canonical guidance"
duration: 2 min
completed: 2026-03-29
---

# Phase 158 Plan 11: Close the plugin-runtime portion of GAP-158-01 by replacing the remaining legacy planning guidance surfaced from plugin tools and idle notifications. Summary

**Plugin runtime missing-plan and next-phase notices now point to `/bgsd-plan phase`, and the shipped `plugin.js` bundle matches that canonical guidance**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-29T23:12:10Z
- **Completed:** 2026-03-29T23:14:27Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Updated the plugin task-context tool so missing-plan guidance now recommends the canonical planning-family command.
- Updated idle phase-complete notifications so the suggested next action is `/bgsd-plan phase <n>` instead of the legacy alias.
- Rebuilt the shipped plugin bundle so the runtime artifact matches the updated canonical wording in source.

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace legacy planning guidance in plugin source notices** - `7c1f8fe9` (fix)
2. **Task 2: Rebuild the shipped plugin bundle after source guidance changes** - `c250a878` (chore)

## Files Created/Modified

- `src/plugin/tools/bgsd-context.js` - Switches the missing-plan notice from `/bgsd-plan-phase` to `/bgsd-plan phase`.
- `src/plugin/idle-validator.js` - Switches the next-phase notification action to `/bgsd-plan phase <number>`.
- `plugin.js` - Rebuilds the shipped plugin artifact with the updated canonical runtime guidance.

## Decisions Made

- Limited the source change to the two surfaced runtime notices called out by GAP-158-01 so alias compatibility wiring remains unchanged.
- Kept the source wording change and bundle rebuild as separate task commits for clearer runtime-versus-artifact traceability.

## Deviations from Plan

None - plan executed exactly as written.

## Review Findings

Review skipped — gap closure plan.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The plugin runtime guidance slice of GAP-158-01 now prefers the canonical planning-family wording in both source and shipped bundle output.
- Phase 158 follow-on regression coverage can now assert canonical plugin notices without carrying forward stale runtime strings.

## Self-Check: PASSED

- Found summary file: `.planning/phases/158-canonical-command-families/158-11-SUMMARY.md`
- Found task commit: `7c1f8fe9`
- Found task commit: `c250a878`

---
*Phase: 158-canonical-command-families*
*Completed: 2026-03-29*
