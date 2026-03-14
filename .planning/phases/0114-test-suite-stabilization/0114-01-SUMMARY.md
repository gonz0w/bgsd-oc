---
phase: 0114-test-suite-stabilization
plan: 01
subsystem: testing
tags: [bun, runtime-banner, isTTY, profiler, test-stabilization]

# Dependency graph
requires: []
provides:
  - "Banner-free piped CLI output (isTTY guard in showRuntimeBanner)"
  - "Clean JSON parsing in all test suites"
  - "Removed dead profiler test references"
affects: [test-suite-stabilization]

# Tech tracking
tech-stack:
  added: []
  patterns: ["isTTY guard for runtime banners — suppress informational stdout in piped/non-TTY mode"]

key-files:
  created: []
  modified:
    - src/router.js
    - bin/bgsd-tools.cjs
    - tests/infra.test.cjs
    - tests/codebase.test.cjs

key-decisions:
  - "Used isTTY guard inside showRuntimeBanner() rather than at call site — single fix point"
  - "Deleted entire profiler describe block since src/lib/profiler.js was intentionally removed"
  - "Replaced profiler.js test fixture with debug.js in codebase context risk-level test"

requirements-completed: [TEST-01, TEST-02]
one-liner: "isTTY banner guard eliminates 576 JSON parse failures, dead profiler tests removed — 990/998 tests now pass"

# Metrics
duration: 9min
completed: 2026-03-13
---

# Phase 114 Plan 01: Banner & Profiler Fix Summary

**isTTY banner guard eliminates 576 JSON parse failures, dead profiler tests removed — 990/998 tests now pass**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-13T23:21:34Z
- **Completed:** 2026-03-13T23:30:53Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added `process.stdout.isTTY` guard to `showRuntimeBanner()` in `src/router.js`, preventing the `[bGSD] Running with Bun v1.3.10` banner from polluting stdout when CLI output is piped — this alone fixed ~526 SyntaxError test failures
- Rebuilt `bin/bgsd-tools.cjs` with the banner fix, confirmed clean JSON output via pipe
- Removed 4 dead profiler tests from `tests/infra.test.cjs` (the `src/lib/profiler.js` module was intentionally deleted) and updated `tests/codebase.test.cjs` to use `src/lib/debug.js` as the low-risk test fixture

## Task Commits

Each task was committed atomically:

1. **Task 1: Suppress Bun runtime banner in non-TTY mode** - `51a839c` (fix)
2. **Task 2: Rebuild CLI bundle and fix profiler tests** - `e13006c` (fix)

## Files Created/Modified
- `src/router.js` - Added `if (!process.stdout.isTTY) return;` guard in `showRuntimeBanner()`
- `bin/bgsd-tools.cjs` - Rebuilt bundle incorporating the banner fix
- `tests/infra.test.cjs` - Removed dead profiler describe block (4 tests referencing deleted module)
- `tests/codebase.test.cjs` - Replaced `src/lib/profiler.js` fixture with `src/lib/debug.js` in risk-level test

## Decisions Made
- **isTTY guard location:** Placed the guard inside `showRuntimeBanner()` itself rather than at the call site (line ~174). This is a single fix point that covers all code paths through the function.
- **Profiler test deletion:** Deleted rather than fixing — the `src/lib/profiler.js` module was intentionally removed and has no replacement. Per user decision: "delete the test if the module was intentionally removed."
- **Test fixture replacement:** Used `src/lib/debug.js` instead of `src/lib/profiler.js` for the codebase context risk-level test — debug.js is a similar utility with few dependents.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Test suite now at 990 pass / 8 fail (up from 414 pass / 600 fail)
- The 8 remaining failures are in env scan, temp file cleanup, config migration, and commit agent attribution — categorizable for Plan 02
- The banner fix unblocks accurate triage of residual failures since JSON parsing errors no longer mask real test issues

---
*Phase: 0114-test-suite-stabilization*
*Completed: 2026-03-13*
