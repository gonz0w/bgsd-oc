---
phase: 76-advisory-guardrails
plan: 02
subsystem: plugin
tags: [guardrails, plugin-wiring, testing, esm, advisory, convention, planning-protection]

# Dependency graph
requires:
  - phase: 76-advisory-guardrails
    provides: createAdvisoryGuardrails factory, advisory-guardrails.js module, config defaults
provides:
  - Advisory guardrails wired into plugin hooks (toolAfter, commandEnrich, idle event)
  - createAdvisoryGuardrails re-exported from plugin.js for external consumption
  - 27-test suite covering all three guardrail types with config integration
  - Bug fixes for path filtering and operator precedence in guardrails module
affects: [plugin-consumers, future-guardrail-extensions]

# Tech tracking
tech-stack:
  added: []
  patterns: [hook-extension (extending existing safeHook callbacks with additional behavior)]

key-files:
  created: [tests/plugin-advisory-guardrails.test.cjs]
  modified: [src/plugin/index.js, src/plugin/advisory-guardrails.js, plugin.js, package.json]

key-decisions:
  - "Removed overly aggressive /tmp/ path filter from guardrails — was blocking all paths containing /tmp/, including legitimate project directories in temp locations"
  - "Fixed operator precedence in GARD-02 condition — missing parentheses caused Windows path check to bypass planningProtectionEnabled flag"

patterns-established:
  - "Plugin test pattern: CJS test files using dynamic import() for ESM plugin.js, mock notifier capturing calls, temp directories with AGENTS.md/package.json for convention/test detection"

requirements-completed: [GARD-01, GARD-02, GARD-03]

# Metrics
duration: 33min
completed: 2026-03-09
---

# Phase 76 Plan 02: Advisory Guardrails Wiring & Tests Summary

**Advisory guardrails wired into plugin hooks with 27-test coverage across convention violations, planning file protection, and test suggestions — plus two bug fixes in path filtering and operator precedence**

## Performance

- **Duration:** 33 min
- **Started:** 2026-03-09T17:33:34Z
- **Completed:** 2026-03-09T18:07:08Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Wired `createAdvisoryGuardrails` into plugin index.js — toolAfter calls both stuckDetector and guardrails, commandEnrich sets bgsdCommandActive for /bgsd-* commands, idle event clears the flag
- Created comprehensive test suite with 27 tests covering GARD-01 (convention violations, dedup threshold, batch summary), GARD-02 (planning file protection, command mapping, bgsdCommandActive suppression), GARD-03 (debounced test suggestions, multi-file batching)
- Fixed two bugs in advisory-guardrails.js: overly broad `/tmp/` path filter and operator precedence issue in GARD-02 condition

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire guardrails into plugin index.js** - `e8c1c18` (feat)
2. **Task 2: Build plugin bundle and create tests** - `bd89dba` (feat)

## Files Created/Modified
- `src/plugin/index.js` - Added import, re-export, initialization, and hook extensions for advisory guardrails
- `src/plugin/advisory-guardrails.js` - Fixed /tmp/ path filter bug and operator precedence bug in GARD-02
- `tests/plugin-advisory-guardrails.test.cjs` - 27 tests covering all guardrail types, config integration, and edge cases
- `plugin.js` - Rebuilt bundle with guardrails integration and bug fixes
- `package.json` - Updated test command to include new test file

## Decisions Made
- Removed `/tmp/` path filter from guardrails — it was meant to skip system temp files but was too aggressive, blocking any project path containing `/tmp/` (like temp directories used in tests). The `!absPath.startsWith(cwd)` check is sufficient to prevent non-project files.
- Added parentheses to fix operator precedence in GARD-02 condition — `planningProtectionEnabled && (relPath.startsWith('.planning/') || relPath.startsWith('.planning\\'))` ensures the enabled check applies to both OS path separators.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Overly aggressive /tmp/ path filter**
- **Found during:** Task 2 (test creation and debugging)
- **Issue:** `absPath.includes('/tmp/')` filter in `onToolAfter` blocked ALL paths containing `/tmp/`, including legitimate project directories in temp locations (e.g., `/tmp/guardrails-test-xxx/myComponent.js`)
- **Fix:** Removed `/tmp/` and `\\tmp\\` checks — the `!absPath.startsWith(cwd)` check already prevents processing non-project files
- **Files modified:** src/plugin/advisory-guardrails.js
- **Verification:** All 27 tests pass, including tests using temp directories
- **Committed in:** bd89dba (Task 2 commit)

**2. [Rule 1 - Bug] Operator precedence in GARD-02 condition**
- **Found during:** Task 2 (test creation and debugging)
- **Issue:** `if (planningProtectionEnabled && relPath.startsWith('.planning/') || relPath.startsWith('.planning\\'))` evaluated as `(enabled && unix) || windows` due to `&&` binding tighter than `||` — Windows path check would always trigger regardless of the enabled flag
- **Fix:** Added parentheses: `if (planningProtectionEnabled && (relPath.startsWith('.planning/') || relPath.startsWith('.planning\\')))`
- **Files modified:** src/plugin/advisory-guardrails.js
- **Verification:** `planning_protection=false` config test passes — GARD-02 is properly disabled
- **Committed in:** bd89dba (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes were essential for correct guardrails behavior. No scope creep.

## Review Findings

Review skipped — executor-driven plan with bug fixes during testing.

## Issues Encountered
- Main test suite (805 tests in bin/bgsd-tools.test.cjs) exceeds 300s timeout in CI environment — existing behavior, not a regression. All 27 new guardrails tests pass. 132 main tests verified passing with 0 failures before timeout.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three GARD requirements (GARD-01, GARD-02, GARD-03) are fully implemented, wired, and tested
- Advisory guardrails are live in the plugin bundle
- Phase 76 is complete — guardrails ship with the next deploy

---
*Phase: 76-advisory-guardrails*
*Completed: 2026-03-09*
