---
phase: 0132-deviation-recovery-auto-capture
plan: 01
subsystem: cli
tags:
  - commonjs
  - json
  - javascript
  - lessons
  - deviation-recovery
provides:
  - lessons:deviation-capture CLI command with Rule-1 filter and 3-per-milestone cap
  - Fixed autonomousRecoveries metric increment in autoRecovery.js
  - deviation-recovery type in LESSON_SCHEMA.type_values
affects:
  - execute-phase workflow (future: can now invoke lessons:deviation-capture after Rule-1 auto-fix)
  - lessons:analyze and lessons:suggest (will see deviation-recovery type entries)
tech-stack:
  added: []
  patterns:
    - "Non-blocking CLI: swallow all errors in deviation-capture so it never blocks execution"
    - "Rule filter before cap check: cheap filter first, expensive store read only when needed"
key-files:
  created: []
  modified:
    - src/lib/recovery/autoRecovery.js
    - src/commands/lessons.js
    - src/router.js
    - src/lib/command-help.js
    - src/lib/commandDiscovery.js
key-decisions:
  - "deviation-recovery added as 5th type in LESSON_SCHEMA.type_values — allows existing validateLesson() to gate entries without schema changes"
  - "Rule-1-only filter is integer equality (parseInt) not string comparison — prevents bypass via string '1'"
  - "Cap is per-milestone via count of type=deviation-recovery entries — simple, zero config, aligns with workflow reset per milestone"
  - "Non-blocking error handling: try/catch wraps entire cmdDeviationCapture body — any error is swallowed and debug-logged"
patterns-established:
  - "Non-blocking command pattern: wrap entire function body in try/catch, log via debugLog, never throw to caller"
requirements-completed:
  - DEVCAP-01
  - DEVCAP-02
  - DEVCAP-03
  - DEVCAP-04
one-liner: "Fixed autonomousRecoveries typo in autoRecovery.js + added lessons:deviation-capture CLI with Rule-1 filter, 3-per-milestone cap, and non-blocking error handling"
duration: 8min
completed: 2026-03-15
---

# Phase 132 Plan 01: Deviation Recovery Auto-Capture Foundation Summary

**Fixed autonomousRecoveries typo in autoRecovery.js + added lessons:deviation-capture CLI with Rule-1 filter, 3-per-milestone cap, and non-blocking error handling**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-15T22:11:57Z
- **Completed:** 2026-03-15T22:20:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Fixed 1-character typo `autonomousRecoverles` → `autonomousRecoveries` on line 188 of autoRecovery.js so the recovery metric now actually increments (declaration on line 116 was always correct, only the increment was broken)
- Added `cmdDeviationCapture` to lessons.js with Rule-1-only filter (silently exits for rules 2, 3, 4), 3-entry cap per milestone, structured DEVCAP fields (deviation_rule, failure_count, behavioral_change, affected_agents), and full non-blocking error handling via try/catch
- Wired `lessons:deviation-capture` route in router.js, extended `parseLessonsOptions` with `--rule`, `--failure-count`, `--behavioral-change`, `--agent` flags, and updated command-help.js + commandDiscovery.js discovery lists

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix autonomousRecoverles typo + add deviation-capture command** - `edc4b16` (feat)
2. **Task 2: Wire lessons:deviation-capture route + rebuild** - `3732c0f` (feat)

## Files Created/Modified

- `src/lib/recovery/autoRecovery.js` - Fixed autonomousRecoveries typo on line 188
- `src/commands/lessons.js` - Added deviation-recovery to type_values, added cmdDeviationCapture function and export
- `src/router.js` - Extended parseLessonsOptions with deviation-capture flags, added deviation-capture route
- `src/lib/command-help.js` - Added lessons:deviation-capture to Lessons group and command descriptions
- `src/lib/commandDiscovery.js` - Added deviation-capture to NAMESPACE_GROUPS.lessons.commands and COMMAND_TREE
- `bin/bgsd-tools.cjs` - Rebuilt bundle incorporating all source changes
- `bin/manifest.json` - Updated manifest
- `plugin.js` - Rebuilt ESM plugin
- `skills/skill-index/SKILL.md` - Regenerated skill index

## Decisions Made

- `deviation-recovery` added as 5th type in `LESSON_SCHEMA.type_values` — allows existing `validateLesson()` to gate entries without schema changes
- Rule-1-only filter uses `parseInt` integer equality, not string comparison — prevents accidental bypass via string `'1'`
- Cap is per-milestone by counting `type === 'deviation-recovery'` entries in the store — simple, zero config, aligns with workflow reset per milestone
- Non-blocking error handling: entire `cmdDeviationCapture` body wrapped in try/catch — any error is swallowed and debug-logged, never blocks execution

## Deviations from Plan

None - plan executed exactly as written.

## Review Findings

Review skipped — gap closure plan / checkpoint plan / review context unavailable

## Issues Encountered

None.

## Next Phase Readiness

- `lessons:deviation-capture` CLI is fully operational and ready for the execute-phase workflow to invoke it after successful Rule-1 auto-fixes
- The autonomousRecoveries metric now correctly increments, so recovery telemetry in STATE.md will be accurate
- Phase 132 Plan 02 (if any) or Phase 133 (Enhanced Research Workflow) can proceed immediately

---
*Phase: 0132-deviation-recovery-auto-capture*
*Completed: 2026-03-15*
