---
phase: 14-intent-capture-foundation
plan: 02
subsystem: intent
tags: [intent, cli, crud, show, read, update, id-management, priority-sorting]

requires:
  - phase: 14-intent-capture-foundation
    provides: parseIntentMd/generateIntentMd parser, intent create command, router wiring
provides:
  - cmdIntentShow with compact summary, --full, and section filtering
  - cmdIntentUpdate with granular add/remove/set-priority and section replace
  - intent read alias (JSON output)
  - ID management with gap preservation (DO-XX, SC-XX, C-XX, HM-XX)
  - Priority-sorted outcome display with ANSI color
affects: [14-03, 15-intent-tracing, 16-workflow-integration]

tech-stack:
  added: []
  patterns: [priority-sorted display, ANSI color TTY detection, ID gap preservation, section filtering]

key-files:
  created: []
  modified:
    - src/commands/intent.js
    - src/router.js
    - bin/gsd-tools.cjs

key-decisions:
  - "Compact show targets 10-20 lines with priority-sorted outcomes (P1 first)"
  - "intent read is pure alias for intent show --raw (no separate implementation)"
  - "ID gaps preserved on removal — getNextId() looks at max, not count"
  - "Section-level replace via --value flag, granular ops via --add/--remove/--set-priority"

patterns-established:
  - "Section alias mapping for CLI commands (objective, users, outcomes, criteria, constraints, health)"
  - "ANSI color with TTY detection (process.stdout.isTTY) — plain output when piped"
  - "getNextId() utility for auto-incrementing prefixed IDs with gap preservation"

requirements-completed: [ICAP-03, ICAP-04]

duration: 17min
completed: 2026-02-25
---

# Phase 14 Plan 02: Show/Read + Update Commands Summary

**intent show/read for displaying intent (compact summary, full render, section filter, JSON) and intent update for granular section modifications with auto-ID assignment and revision tracking**

## Performance

- **Duration:** 17 min
- **Started:** 2026-02-25T04:28:04Z
- **Completed:** 2026-02-25T04:45:07Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `intent show` renders compact 10-20 line summary with priority-sorted outcomes (P1 red, P2 yellow, P3 dim on TTY)
- `intent read` returns structured JSON (full or section-filtered); aliased to `show --raw`
- `intent update` supports add/remove/set-priority for list sections, --value for section replace
- Auto-assigns next sequential ID preserving gaps (DO-03 after removing DO-01, not DO-02)
- Revision auto-increments and timestamp updates on every modification

## Task Commits

Each task was committed atomically:

1. **Task 1: intent show and intent read commands** - `bcf78ac` (feat)
2. **Task 2: intent update command with granular operations** - `7aec526` (feat)

## Files Created/Modified
- `src/commands/intent.js` - cmdIntentShow, cmdIntentUpdate, renderCompactSummary, renderSection, colorPriority, getNextId
- `src/router.js` - Routing for intent show, read, update subcommands
- `bin/gsd-tools.cjs` - Rebuilt bundle (414KB)

## Decisions Made
- Compact show targets 10-20 lines — agent-useful density with priority counts and section summaries
- `intent read` is pure alias for `intent show --raw` — one implementation, `read` is syntactic sugar
- ID gaps preserved on removal — `getNextId()` scans max ID number, not list length
- Section-level replace via `--value` flag works for objective and users; list sections use --add/--remove

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
- Parallel Plan 03 agent committed validate code to `src/commands/intent.js` mid-execution, causing Task 2's `cmdIntentUpdate` function body to be included in Plan 03's commit. Router wiring and rebuilt bundle committed separately in Task 2 commit. Functional result is correct — all commands work as designed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All CRUD operations complete (create, show/read, update)
- Plan 03 (validate command) ready to build on this foundation
- Parser round-trips verified through full update cycle
- ID management patterns established for Phase 15 traceability

---
*Phase: 14-intent-capture-foundation*
*Completed: 2026-02-25*
