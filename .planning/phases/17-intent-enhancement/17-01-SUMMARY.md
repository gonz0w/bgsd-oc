---
phase: 17-intent-enhancement
plan: 01
subsystem: intent
tags: [history, evolution-tracking, parser, generator, intent-update]

# Dependency graph
requires:
  - phase: 14-intent-capture-foundation
    provides: parseIntentMd, generateIntentMd, cmdIntentUpdate, cmdIntentShow, cmdIntentValidate
provides:
  - History parsing in parseIntentMd (returns history array)
  - History generation in generateIntentMd (writes <history> section)
  - Auto-logging of intent changes with milestone context on update
  - --reason flag for custom reasoning on intent updates
  - Evolution summary in compact show and full history section view
  - Advisory history validation (warnings, not blocking)
affects: [intent-commands, templates, tests]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Auto-logging pattern: snapshot before, diff after, append to history"
    - "Advisory validation: warnings array separate from blocking issues"

key-files:
  created: []
  modified:
    - src/lib/helpers.js
    - src/commands/intent.js
    - bin/gsd-tools.cjs
    - bin/gsd-tools.test.cjs
    - templates/intent.md

key-decisions:
  - "History entries grouped by milestone+date, newest first"
  - "Advisory-only validation: history warnings don't fail validate"
  - "--reason flag parsed and removed from args before section processing"

patterns-established:
  - "Auto-logging: snapshot section IDs before mutation, diff after, create history changes"
  - "Advisory warnings: separate warnings array from blocking issues in validate"

requirements-completed: [ICAP-06]

# Metrics
duration: 9min
completed: 2026-02-25
---

# Phase 17 Plan 01: Intent Evolution Tracking Summary

**History section in INTENT.md with auto-logging on update, evolution summary in show, and milestone-grouped change entries with reasoning**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-25T11:00:22Z
- **Completed:** 2026-02-25T11:09:25Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- parseIntentMd() now parses `<history>` sections into structured milestone entries (backward compatible — empty array when absent)
- generateIntentMd() writes `<history>` sections only when entries exist (no empty section in old files)
- cmdIntentUpdate() auto-logs what changed (Added/Modified/Removed) with milestone context from ROADMAP.md
- `--reason` flag allows custom reasoning on any intent update
- `intent show` displays evolution summary in compact view; `intent show history` renders full history
- `intent validate` accepts optional history with advisory warnings (never fails on history issues)
- 8 new integration tests covering parse, update auto-logging, --reason flag, show, and validate

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend parser, generator, and update command with history tracking** - `60c8627` (feat)
2. **Task 2: Update template reference and add integration tests** - `a4fa5fd` (test)

## Files Created/Modified
- `src/lib/helpers.js` - parseIntentMd parses `<history>` section, generateIntentMd writes it
- `src/commands/intent.js` - cmdIntentUpdate auto-logs history, cmdIntentShow renders evolution, cmdIntentValidate accepts optional history
- `bin/gsd-tools.cjs` - Rebuilt bundle (447KB / 450KB budget)
- `bin/gsd-tools.test.cjs` - 8 new integration tests for history feature
- `templates/intent.md` - Documents `<history>` section format, rules 5-6, updated examples

## Decisions Made
- History entries are grouped by milestone+date (newest first), matching how ROADMAP.md tracks active milestone
- Advisory-only validation for history: separate `warnings` array from blocking `issues` — history problems never cause validate to fail
- `--reason` flag is parsed and stripped from args before section processing to avoid interference with other flags

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- History tracking complete, ready for Plan 17-02 (guided intent questionnaire)
- All existing tests pass with zero regressions
- Bundle within 450KB budget (447KB)

---
*Phase: 17-intent-enhancement*
*Completed: 2026-02-25*
