---
phase: 72-rebrand
plan: 02
subsystem: core
tags: [rebrand, agents, migration, install, deploy, naming]
dependency_graph:
  requires:
    - phase: 72-01
      provides: bgsd-tools.cjs CLI binary, BGSD_ env vars, bgsd-oc config paths
  provides:
    - 10 renamed agent files (bgsd-*.md) with __OPENCODE_CONFIG__/bgsd-oc path setup
    - install.js migration logic (get-shit-done -> bgsd-oc)
    - deploy.sh targeting bgsd-oc destination
    - Old agent file cleanup in both install and deploy flows
  affects: [72-03, 72-04]
tech_stack:
  added: []
  patterns: [agent-naming-convention, migration-copy-then-delete]
key_files:
  created: []
  modified:
    - agents/bgsd-codebase-mapper.md
    - agents/bgsd-debugger.md
    - agents/bgsd-executor.md
    - agents/bgsd-github-ci.md
    - agents/bgsd-phase-researcher.md
    - agents/bgsd-plan-checker.md
    - agents/bgsd-planner.md
    - agents/bgsd-project-researcher.md
    - agents/bgsd-roadmapper.md
    - agents/bgsd-verifier.md
    - install.js
    - deploy.sh
decisions:
  - "Used sed for mechanical replacements across all 10 agent files rather than manual editing — consistent, no human error"
  - "Migration in install.js uses copy-then-delete pattern (cpSync + rmSync) per research recommendation for safety"
  - "Agent migration runs before main install to ensure old files are renamed before new ones are deployed"
patterns-established:
  - "__OPENCODE_CONFIG__/bgsd-oc path resolution: __OPENCODE_CONFIG__/bgsd-oc=$(ls -d $HOME/.config/*/bgsd-oc 2>/dev/null | head -1)"
  - "Migration detection: check for old dir AND absence of new dir before migrating"
requirements-completed: [RBND-06, RBND-07]
metrics:
  duration: 9min
  completed: 2026-03-09
  tasks: 2
  files_modified: 12
---

# Phase 72 Plan 02: Agent Files, install.js Migration, deploy.sh Summary

**Renamed all 10 agent files from gsd-*.md to bgsd-*.md with __OPENCODE_CONFIG__/bgsd-oc path setup, added install.js migration logic for seamless get-shit-done→bgsd-oc transition, and updated deploy.sh to target bgsd-oc**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-09T04:10:33Z
- **Completed:** 2026-03-09T04:20:22Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- All 10 agent files renamed to bgsd-*.md with git mv (preserving history)
- Every agent's PATH SETUP updated: GSD_HOME→__OPENCODE_CONFIG__/bgsd-oc, get-shit-done→bgsd-oc, gsd-tools→bgsd-tools
- All agent cross-references updated (gsd-executor→bgsd-executor, gsd-planner→bgsd-planner, etc.)
- install.js now detects existing get-shit-done installations and migrates to bgsd-oc automatically
- install.js cleans up old gsd-*.md agent files after deploying new bgsd-*.md ones
- deploy.sh fully updated to target bgsd-oc with old agent cleanup

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename agent files and update internal references** - `4e703a5` (refactor)
2. **Task 2: Add migration logic to install.js and update deploy.sh** - `d9e990a` (feat)

## Files Created/Modified
- `agents/bgsd-codebase-mapper.md` - Renamed from gsd-*, updated PATH SETUP and cross-refs
- `agents/bgsd-debugger.md` - Renamed from gsd-*, updated PATH SETUP and cross-refs
- `agents/bgsd-executor.md` - Renamed from gsd-*, updated PATH SETUP and cross-refs
- `agents/bgsd-github-ci.md` - Renamed from gsd-*, updated PATH SETUP and cross-refs
- `agents/bgsd-phase-researcher.md` - Renamed from gsd-*, updated PATH SETUP and cross-refs
- `agents/bgsd-plan-checker.md` - Renamed from gsd-*, updated PATH SETUP and cross-refs
- `agents/bgsd-planner.md` - Renamed from gsd-*, updated PATH SETUP and cross-refs
- `agents/bgsd-project-researcher.md` - Renamed from gsd-*, updated PATH SETUP and cross-refs
- `agents/bgsd-roadmapper.md` - Renamed from gsd-*, updated PATH SETUP and cross-refs
- `agents/bgsd-verifier.md` - Renamed from gsd-*, updated PATH SETUP and cross-refs
- `install.js` - Migration logic, DEST→bgsd-oc, agent cleanup, bgsd-tools smoke test
- `deploy.sh` - DEST→bgsd-oc, bgsd-*.md globs, old agent cleanup, bgsd-tools smoke test

## Decisions Made
- Used sed for mechanical replacements across all 10 agent files rather than manual editing — consistent, no human error
- Migration in install.js uses copy-then-delete pattern (cpSync + rmSync) per research recommendation for safety
- Agent migration runs before main install to ensure old files are renamed before new ones are deployed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All agent files now bgsd-*.md with correct internal references
- install.js migration path tested (handles fresh install, migration, and cleanup)
- deploy.sh ready for bgsd-oc deployment
- Plan 03 (workflow/command/template updates) can proceed — all agent dependencies satisfied

## Self-Check: PASSED

All created/modified files verified:
- 10 bgsd-*.md agent files — FOUND
- `install.js` — FOUND
- `deploy.sh` — FOUND
- Commit `4e703a5` — FOUND
- Commit `d9e990a` — FOUND
- 782/782 tests passing

---
*Phase: 72-rebrand*
*Completed: 2026-03-09*
