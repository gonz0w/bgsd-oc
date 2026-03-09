---
phase: 76-advisory-guardrails
plan: 01
subsystem: plugin
tags: [guardrails, conventions, notifications, esm, advisory]

# Dependency graph
requires:
  - phase: 75-event-driven-state-sync
    provides: notification system, file watcher, stuck detector, config parser with nested object merge
provides:
  - createAdvisoryGuardrails factory function with onToolAfter hook
  - GARD-01 convention violation detection with inline naming classifiers
  - GARD-02 planning file protection with static command mapping
  - GARD-03 debounced test suggestion batching
  - advisory_guardrails config defaults with shallow merge support
affects: [76-advisory-guardrails plan 02 (wiring into index.js)]

# Tech tracking
tech-stack:
  added: []
  patterns: [inline-classifiers (CJS→ESM boundary), static-command-mapping, debounced-notification-batching]

key-files:
  created: [src/plugin/advisory-guardrails.js]
  modified: [src/plugin/parsers/config.js]

key-decisions:
  - "Inline NAMING_PATTERNS and classifyName from conventions.js — plugin is ESM, cannot import CJS modules"
  - "Convention source priority: AGENTS.md first, codebase-intel.json fallback with configurable confidence threshold"
  - "Test suggestions use setTimeout-based debounce (not file watcher debounce) for batch notification"

patterns-established:
  - "Inline CJS classifier pattern: copy small utility functions rather than importing across module boundaries"
  - "Advisory notification types: advisory-convention, advisory-planning, advisory-test"

requirements-completed: [GARD-01, GARD-02, GARD-03]

# Metrics
duration: 14min
completed: 2026-03-09
---

# Phase 76 Plan 01: Advisory Guardrails Module Summary

**Advisory guardrails factory with convention violation detection, planning file protection, and debounced test suggestions — all three GARD requirements in a self-contained ESM module**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-09T17:16:12Z
- **Completed:** 2026-03-09T17:30:45Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `advisory-guardrails.js` with `createAdvisoryGuardrails` factory exporting `onToolAfter`, `setBgsdCommandActive`, and `clearBgsdCommandActive`
- Implemented all three guardrail types: GARD-01 (convention violations with inline naming classifiers), GARD-02 (planning file protection with static command mapping), GARD-03 (debounced test suggestions)
- Added `advisory_guardrails` config defaults to `CONFIG_DEFAULTS` with shallow merge support via `NESTED_OBJECT_KEYS`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create advisory-guardrails.js module** - `abfc1e1` (feat)
2. **Task 2: Add advisory_guardrails config defaults** - `e86d1d1` (feat)

## Files Created/Modified
- `src/plugin/advisory-guardrails.js` - Advisory guardrails factory with convention, planning, and test suggestion checks
- `src/plugin/parsers/config.js` - Added advisory_guardrails defaults and NESTED_OBJECT_KEYS entry

## Decisions Made
- Inlined NAMING_PATTERNS and classifyName from src/lib/conventions.js — plugin is ESM, CJS imports would break the bundle
- Convention detection reads AGENTS.md first (keyword scan), falls back to codebase-intel.json with configurable confidence threshold (default 70%)
- Test suggestions use setTimeout debounce (500ms default) to batch multiple source file edits into a single notification
- bgsdCommandActive flag used to suppress GARD-02 warnings during bGSD workflow execution

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Advisory guardrails module is complete and ready for wiring into index.js (Plan 02)
- Config defaults are in place for user customization
- All three GARD requirements implemented, pending integration testing in Plan 02

---
*Phase: 76-advisory-guardrails*
*Completed: 2026-03-09*
