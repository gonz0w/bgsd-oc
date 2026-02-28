---
phase: 46-checkpoint-snapshot-metrics-collection
plan: 02
subsystem: cli
tags: [trajectory, checkpoint, list, metrics, formatted-output]

# Dependency graph
requires:
  - phase: 46-checkpoint-snapshot-metrics-collection
    provides: trajectory checkpoint command with journal entry persistence
provides:
  - trajectory list command with filtering and formatted TTY output
  - checkpoint discovery and browsing via CLI
affects: [47-pivot-selective-checkout-branch-switching, 48-comparison-diff-scoring-ranking, 50-ux-integration-workflow-polish]

# Tech tracking
tech-stack:
  added: []
  patterns: [dual-mode-output-formatter, relative-time-display, checkpoint-filtering]

key-files:
  created: []
  modified: [src/commands/trajectory.js, src/router.js, src/lib/constants.js, bin/gsd-tools.cjs, bin/gsd-tools.test.cjs]

key-decisions:
  - "Used output(result, { formatter }) pattern for dual JSON/TTY output"
  - "Sort newest-first by default for trajectory list"

patterns-established:
  - "Trajectory list filters: --scope, --name, --limit for checkpoint discovery"
  - "Formatted table output with relative timestamps, test pass/fail coloring, LOC delta"

requirements-completed: [CHKPT-02]

# Metrics
duration: 9min
completed: 2026-02-28
---

# Phase 46 Plan 02: Trajectory List Command Summary

**Trajectory list command with --scope/--name/--limit filters, formatted TTY table showing name, scope, attempt, ref, test results, LOC delta, and relative age**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-28T22:10:00Z
- **Completed:** 2026-02-28T22:19:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created `trajectory list` command with JSON and formatted TTY output
- Implemented filters: `--scope`, `--name`, `--limit` for checkpoint discovery
- Formatted table shows name, scope, attempt, ref, test pass/fail, LOC delta, relative age
- 9 comprehensive tests covering empty state, filtering, sorting, structure, error handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement trajectory list command with formatted output** - `96ae66d` (feat)
2. **Task 2: Add trajectory list tests** - `8109302` (test)

## Files Created/Modified
- `src/commands/trajectory.js` - Added cmdTrajectoryList + formatTrajectoryList formatter (~110 lines)
- `src/router.js` - Added case 'list' routing for trajectory subcommand
- `src/lib/constants.js` - Updated trajectory help text to include list subcommand
- `bin/gsd-tools.cjs` - Rebuilt bundle with trajectory list command
- `bin/gsd-tools.test.cjs` - 9 new trajectory list tests

## Decisions Made
- Used `output(result, { formatter })` pattern for dual-mode JSON/TTY output — consistent with other formatted commands (codebase, intent, state)
- Sort newest-first by default — most recently created checkpoints are most relevant for comparison/pivot decisions

## Deviations from Plan

None - plan executed exactly as written.

## Review Findings

Review skipped — autonomous plan, review context assembly not applicable.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Checkpoint listing fully operational — users can discover all checkpoints before comparing or pivoting
- Ready for Phase 47 (Pivot: Selective Checkout & Branch Switching)
- Ready for Phase 48 (Comparison: Diff Scoring & Ranking) which builds on list output

---
*Phase: 46-checkpoint-snapshot-metrics-collection*
*Completed: 2026-02-28*
