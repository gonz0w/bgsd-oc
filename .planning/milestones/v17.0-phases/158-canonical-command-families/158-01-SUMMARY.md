---
phase: 158-canonical-command-families
plan: 01
subsystem: commands
tags:
  - commands
  - markdown
  - manifest
  - install
  - deploy
  - tests
requires:
  - phase: 157-planning-context-cascade
    provides: compact milestone and phase intent context that Phase 158 command-family migration builds on
provides:
  - Canonical `/bgsd-quick`, `/bgsd-plan`, and `/bgsd-inspect` wrapper surface for the migration baseline
  - Manifest-backed deploy and install inventory for canonical wrappers plus compatibility aliases
  - Regression coverage that locks quick-wrapper parity and canonical wrapper shipment
affects:
  - phase-158-follow-on-plans
  - phase-159-help-surface-command-integrity
tech-stack:
  added: []
  patterns:
    - Canonical wrapper plus compatibility-alias shim routing to shared workflow contracts
    - Manifest-driven command shipping for canonical wrappers and legacy aliases together
key-files:
  created:
    - commands/bgsd-plan.md
    - commands/bgsd-inspect.md
  modified:
    - commands/bgsd-quick.md
    - commands/bgsd-quick-task.md
    - bin/manifest.json
    - deploy.sh
    - install.js
    - tests/workflow.test.cjs
    - tests/integration.test.cjs
key-decisions:
  - Keep `/bgsd-plan` and `/bgsd-inspect` as thin canonical wrappers that route to existing workflows until later family-routing plans expand them
  - Preserve manifest.json as the single inventory truth so deploy and install stay in sync for canonical wrappers and aliases
  - Lock parity with narrow wrapper-and-inventory tests instead of broad Phase 159 help-surface coverage
patterns-established:
  - "Canonical-first wrapper wording: preferred commands state canon status while aliases explicitly declare compatibility-only posture"
  - "Migration-baseline tests verify both command wording parity and manifest-backed shipment of canonical wrappers"
requirements-completed: [CMD-01, CMD-02, CMD-03]
one-liner: "Canonical `/bgsd-quick`, scaffolded `/bgsd-plan` and `/bgsd-inspect` wrappers, and manifest-backed parity tests for command-family migration"
duration: 4 min
completed: 2026-03-29
---

# Phase 158 Plan 01: Establish the canonical wrapper surface and deployment inventory for Phase 158 so quick entry, planning, and inspection families can shrink the visible command footprint without breaking existing command files. Summary

**Canonical `/bgsd-quick`, scaffolded `/bgsd-plan` and `/bgsd-inspect` wrappers, and manifest-backed parity tests for command-family migration**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-29T21:39:54Z
- **Completed:** 2026-03-29T21:44:09Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Promoted `/bgsd-quick` to the clearly preferred quick-entry wrapper and reduced `/bgsd-quick-task` to compatibility-only wording while keeping both on the same quick workflow contract.
- Added real canonical `/bgsd-plan` and `/bgsd-inspect` wrappers that route through existing planning and read-only inspection workflows without pulling Phase 159 cleanup into this slice.
- Updated manifest-backed shipping metadata plus focused tests so deploy/install inventory and wrapper parity stay migration-safe.

## Task Commits

Each task was committed atomically:

1. **Task 1: Promote canonical quick entry and add family wrapper scaffolds** - `61dadbf` (feat)
2. **Task 2: Align manifest, deploy, and install inventory with the canonical wrappers** - `39c7cd6` (chore)
3. **Task 3: Add migration-baseline regression coverage for wrapper parity** - `bf2166d` (test)

## Files Created/Modified

- `commands/bgsd-quick.md` - Recasts quick as the canonical entrypoint while keeping the existing quick workflow.
- `commands/bgsd-quick-task.md` - Declares the legacy quick-task name as a compatibility-only alias to the same workflow contract.
- `commands/bgsd-plan.md` - Adds the first canonical planning-family wrapper scaffold.
- `commands/bgsd-inspect.md` - Adds the first canonical read-only inspection-family wrapper scaffold.
- `bin/manifest.json` - Ships the new canonical wrappers alongside existing aliases.
- `deploy.sh` - Keeps deployment comments aligned with manifest-driven canonical-plus-compatibility shipping.
- `install.js` - Aligns installer help/documentation wording with the new manifest-backed wrapper inventory.
- `tests/workflow.test.cjs` - Locks canonical quick wording and executable wrapper scaffold contracts.
- `tests/integration.test.cjs` - Locks manifest inventory and deploy/install parity expectations for the migration baseline.

## Decisions Made

- Used thin wrapper scaffolds for `/bgsd-plan` and `/bgsd-inspect` instead of prematurely routing all family sub-actions, because later Phase 158 plans own the deeper family-contract expansion.
- Kept deploy/install changes narrowly manifest- and wording-focused, since the existing manifest-driven shipping path already provides the required canonical/alias symmetry.
- Added wrapper-parity tests only for the directly touched command surface so this plan stayed within Phase 158 scope and left broader help/reference cleanup to Phase 159.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The plan's `verify:references` command was unavailable in the current CLI build. I verified the new wrapper targets by confirming referenced workflow paths directly in the command files and by passing the targeted workflow/integration test suite instead.

## Next Phase Readiness

- Canonical wrapper files now exist, ship through the manifest, and have parity coverage, so follow-on Phase 158 plans can safely repoint legacy planning and inspection commands into these new family hubs.
- No blockers found for the next command-family routing slices.

## Self-Check

PASSED

---
*Phase: 158-canonical-command-families*
*Completed: 2026-03-29*
