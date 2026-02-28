---
phase: 37-foundation-safety-net
plan: 02
subsystem: testing
tags: [contract-tests, snapshots, profiling, perf-hooks, baselines]

requires:
  - phase: 37-01
    provides: git intelligence and pre-commit safety checks
provides:
  - "Consumer contract tests for all init/state JSON outputs with hybrid snapshot approach"
  - "Full snapshot comparison for init-phase-op and state-read with diff-style output"
  - "Field-level additive-safe contract checking for init-plan-phase, init-new-project, init-execute-phase, state-read, init-progress"
  - "GSD_UPDATE_SNAPSHOTS=1 snapshot bootstrap/update mechanism"
  - "Opt-in performance profiler via GSD_PROFILE=1 with zero overhead when disabled"
  - "Baseline JSON capture to .planning/baselines/ with command, timestamp, node_version, timings, total_ms"
affects: [all-init-commands, state-commands, agent-workflows, orchestration]

tech-stack:
  added:
    - "node:perf_hooks (performance.now)"
  patterns:
    - "Hybrid snapshot testing: full snapshots for critical outputs, field-level contracts for others"
    - "Opt-in profiling via environment variable with process exit hook"
    - "Additive-safe contract: new fields pass, removed/renamed fields fail"

key-files:
  created:
    - "src/lib/profiler.js"
    - "test/__snapshots__/init-phase-op.json"
    - "test/__snapshots__/state-read.json"
  modified:
    - "bin/gsd-tools.test.cjs"
    - "src/router.js"
    - "src/lib/constants.js"
    - "bin/gsd-tools.cjs"

key-decisions:
  - "Hybrid snapshot strategy: full snapshots for init-phase-op and state-read (most consumed by agents), field-level contracts for all others"
  - "Profiler uses process exit hook to capture timing data after command completion"
  - "init new-project contract uses actual field names (planning_exists, has_existing_code) not plan-proposed names (has_planning, has_roadmap)"

patterns-established:
  - "snapshotCompare: deep-compare with diff-style output, GSD_UPDATE_SNAPSHOTS=1 for update"
  - "contractCheck: additive-safe field validation with type checking"
  - "Profiler integration: startTimer in main(), endTimer+writeBaseline in process exit hook"

requirements-completed: [SAFE-01, SAFE-02]

duration: 12min
completed: 2026-02-27
---

# Phase 37 Plan 02: Contract Tests & Profiler Summary

**Hybrid snapshot + field-level contract tests for all init/state JSON outputs, opt-in GSD_PROFILE=1 performance profiler writing timing baselines to .planning/baselines/**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-27T13:58:20Z
- **Completed:** 2026-02-27T14:10:57Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Built consumer contract test infrastructure with snapshotCompare (diff-style output) and contractCheck (additive-safe field validation)
- Full snapshot tests for init-phase-op and state-read critical outputs with GSD_UPDATE_SNAPSHOTS=1 mechanism
- Field-level contract tests for init-plan-phase, init-new-project, init-execute-phase, state-read fields, init-progress
- Created opt-in performance profiler (src/lib/profiler.js) with zero overhead when GSD_PROFILE is unset
- Integrated profiler into router.js with process exit hook for automatic baseline capture
- 12 new tests (8 contract + 4 profiler), 599 total, zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Consumer contract tests with hybrid snapshot approach** - `aad211c` (feat)
2. **Task 2: Performance profiler module with baseline capture** - `ba7c632` (feat)

## Files Created/Modified
- `src/lib/profiler.js` - Opt-in performance profiler using node:perf_hooks
- `test/__snapshots__/init-phase-op.json` - Full snapshot fixture for init phase-op output
- `test/__snapshots__/state-read.json` - Full snapshot fixture for state read output
- `bin/gsd-tools.test.cjs` - 12 new tests (8 contract, 4 profiler)
- `src/router.js` - Profiler integration with process exit hook
- `src/lib/constants.js` - Added COMMAND_HELP entry for profile
- `bin/gsd-tools.cjs` - Rebuilt bundle with profiler and contract tests

## Decisions Made
- Hybrid snapshot strategy: full snapshots for init-phase-op and state-read (most consumed by agents), field-level contracts for all others
- Profiler uses process exit hook to capture timing data since output() calls process.exit()
- Contract test for init new-project uses actual field names (planning_exists, has_existing_code, is_brownfield) matching the source code

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Contract test safety net complete — any field rename/removal in init or state outputs will be caught
- Performance profiler ready — GSD_PROFILE=1 captures timing baselines for benchmarking
- Phase 37 complete, ready for Phase 38 (next phase in v7.0 roadmap)

---
*Phase: 37-foundation-safety-net*
*Completed: 2026-02-27*
