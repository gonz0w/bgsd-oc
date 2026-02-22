---
phase: "04"
plan: "03"
name: "Deploy Script Update"
subsystem: "build"
tags: [deploy, smoke-test, rollback, build-pipeline]
dependency-graph:
  requires:
    - "source module split (04-02)"
    - "esbuild build pipeline (04-01)"
  provides:
    - "deploy.sh with build-before-copy workflow"
    - "post-deploy smoke test with automatic rollback"
    - "src/ copied to destination for debug access"
  affects:
    - "deploy.sh"
tech-stack:
  added: []
  patterns:
    - "Build-before-deploy: npm run build precedes file copy"
    - "Smoke test gate: deployed artifact verified before declaring success"
    - "Automatic rollback: backup restored on smoke test failure"
key-files:
  created: []
  modified:
    - "deploy.sh"
key-decisions:
  - "Smoke test uses current-timestamp --raw as lightweight proof the bundled artifact executes"
  - "|| true on smoke test command to prevent set -e from aborting before rollback logic"
  - "src/ copied to destination for debugging access though bin/gsd-tools.cjs is the execution artifact"
patterns-established:
  - "Deploy script always builds from source before copying — bin/gsd-tools.cjs is never committed as source"
requirements-completed: [BUILD-03]
metrics:
  duration: "1 min"
  completed: "2026-02-22"
  tasks_completed: 1
  tasks_total: 1
  tests_added: 0
  tests_total: 143
---

# Phase 4 Plan 03: Deploy Script Update Summary

**deploy.sh now builds from src/ via npm run build before deploying, with smoke test gate and automatic rollback on failure**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-22T16:07:23Z
- **Completed:** 2026-02-22T16:08:10Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- deploy.sh runs `npm run build` before copying files to destination
- Post-deploy smoke test verifies deployed artifact can execute `current-timestamp --raw`
- Automatic rollback restores backup if smoke test fails
- src/ now copied alongside bin/, workflows/, templates/, references/, VERSION

## Task Commits

Each task was committed atomically:

1. **Task 1: Update deploy.sh with build step and smoke test** - `2bf919a` (feat)

## Files Created/Modified
- `deploy.sh` - Updated from 29 to 50 lines: added build step, smoke test, rollback, src/ copy

## Decisions Made
- Used `current-timestamp --raw` as smoke test command — lightweight, fast, proves the bundled artifact loads and executes correctly
- Added `|| true` after smoke test command to prevent `set -e` from aborting the script before the rollback logic can run on failure
- Copied `src/` to destination for debugging access to individual modules, though the bundled `bin/gsd-tools.cjs` is the actual execution artifact

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 4 (Build System & Module Split) is now complete — all 3 plans executed
- Ready for Phase 5 (Performance & Polish): in-memory file cache, batch grep, configurable context window
- All build infrastructure in place: esbuild pipeline, src/ modules, deploy.sh with build+smoke test

---
*Phase: 04-build-system*
*Completed: 2026-02-22*
