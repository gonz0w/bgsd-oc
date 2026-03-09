---
phase: 75-event-driven-state-sync
plan: 02
subsystem: plugin
tags: [idle-validation, stuck-detection, event-handlers, notifications, state-sync, auto-fix]

# Dependency graph
requires:
  - phase: 75-event-driven-state-sync
    provides: notification.js, file-watcher.js, config defaults (Plan 01)
  - phase: 74-custom-llm-tools
    provides: safeHook error boundaries, tool patterns
  - phase: 73-plugin-context-engine
    provides: parser cache system, context builder, invalidateAll()
provides:
  - idle validation with auto-fix for STATE.md/ROADMAP.md/config.json
  - stuck/loop detection with critical notifications on error loops
  - phase completion detection with toast notifications
  - 7-hook plugin with event and tool.execute.after handlers
  - /bgsd-notifications command for notification history
affects: [76-advisory-guardrails]

# Tech tracking
tech-stack:
  added: [execSync-git-log]
  patterns: [event-dispatch-via-hook, dual-hook-wiring, auto-fix-loop-prevention, error-streak-tracking, spinning-sequence-detection]

key-files:
  created:
    - src/plugin/idle-validator.js
    - src/plugin/stuck-detector.js
    - commands/bgsd-notifications.md
  modified:
    - src/plugin/index.js
    - build.cjs

key-decisions:
  - "Idle validator uses execSync('git log -1 --format=%ct') for stale progress detection — synchronous but wrapped in try/catch with 3s timeout"
  - "Spinning detection uses simple string hash of args for O(1) comparison — no crypto needed for pattern matching"
  - "Event handler uses dynamic import for invalidateAll to avoid circular dependency at module level"
  - "Plugin factory signature extended from ({directory}) to ({directory, $}) for shell API access by notifier"

patterns-established:
  - "Auto-fix loop prevention: lastAutoFix timestamp compared to lastValidation, onUserInput resets"
  - "Error streak tracking: Map of errorKey→count, cleared on successful call"
  - "Escalation levels: escalationLevel counter increments on each stuck detection, stronger messaging on repeat"

requirements-completed: [EVNT-01, EVNT-02, EVNT-03, EVNT-04]

# Metrics
duration: 42min
completed: 2026-03-09
---

# Phase 75 Plan 02: Event Wiring Summary

**Idle validation with STATE.md auto-fix, stuck/loop detection with critical notifications, 7-hook plugin wiring, and build validation for 4 event modules**

## Performance

- **Duration:** 42 min
- **Started:** 2026-03-09T15:09:44Z
- **Completed:** 2026-03-09T15:51:58Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Idle validator auto-fixes STATE.md/ROADMAP.md inconsistencies, corrupt config.json, stale progress, and progress bar visuals on session idle
- Stuck detector catches error loops (3+ same error) with critical notifications and spinning patterns (repeated call sequences) with warnings
- Plugin index.js wired with 7 hooks: session.created, shell.env, compacting, system.transform (now with notification injection), command.enrich, event (idle + file change dispatch), tool.execute.after (stuck detection)
- Build validates 16 critical exports and 4 event modules in plugin.js

## Task Commits

Each task was committed atomically:

1. **Task 1: Create idle validator and stuck detector modules** - `c6b89ef` (feat)
2. **Task 2: Wire event handlers into plugin index.js** - `966ebc8` (feat)
3. **Task 3: Build validation + notifications slash command** - `630a6f3` (feat)

## Files Created/Modified
- `src/plugin/idle-validator.js` - Debounced idle validation with auto-fix for STATE.md, config, stale progress, phase completion detection
- `src/plugin/stuck-detector.js` - Tool call repetition tracker with error loop and spinning pattern detection
- `src/plugin/index.js` - Updated with 7 hooks, event subsystem initialization, notification context injection
- `build.cjs` - Added requiredExports for 4 event modules + event module validation step
- `commands/bgsd-notifications.md` - Thin slash command wrapper for notification history
- `plugin.js` - Rebuilt ESM bundle with all new modules (586KB)
- `bin/manifest.json` - Updated with new command file

## Decisions Made
- Idle validator uses synchronous `execSync('git log -1 --format=%ct')` for stale progress detection — wrapped in try/catch with 3s timeout, acceptable for idle-time operation
- Spinning detection uses simple 32-bit string hash for args comparison — lightweight, no need for cryptographic hash
- Event handler uses dynamic `import()` for parsers/index.js invalidateAll to avoid potential circular dependency at module load time
- Plugin factory signature extended to receive `$` (shell API) from host editor context for OS notification delivery
- 992 tests pass with zero regressions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 4 EVNT requirements implemented and wired: idle validation (EVNT-01), file watcher cache invalidation (EVNT-02), phase completion notifications (EVNT-03), stuck/loop detection (EVNT-04)
- Phase 75 complete — ready for Phase 76 (Advisory Guardrails) which extends the notification system with advisory types
- Plugin now has 7 hooks, 5 tools, 6 parsers, and 4 event subsystems

---
*Phase: 75-event-driven-state-sync*
*Completed: 2026-03-09*
