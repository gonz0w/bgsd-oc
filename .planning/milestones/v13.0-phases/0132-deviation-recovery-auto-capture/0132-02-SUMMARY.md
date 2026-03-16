---
phase: 0132-deviation-recovery-auto-capture
plan: 02
subsystem: cli
tags:
  - lessons
  - deviation-recovery
  - workflow
  - help-text

requires:
  - phase: 0132-deviation-recovery-auto-capture Plan 01
    provides: lessons:deviation-capture CLI command with Rule-1 filter and 3-cap
provides:
  - deviation_auto_capture section in execute-plan.md workflow with Rule-1 invocation
  - complete COMMAND_HELP entry for lessons:deviation-capture in constants.js
  - COMMAND_RELATED entry for lessons:deviation-capture in command-help.js
affects:
  - workflows/execute-plan.md (executor agents will see and follow deviation capture instructions)
  - 0133-enhanced-research-workflow (any phase reading execute-plan.md)

tech-stack:
  added: []
  patterns:
    - "deviation_auto_capture: fire CLI hook only after successful Rule-1 recovery, never blocking"

key-files:
  created: []
  modified:
    - workflows/execute-plan.md
    - src/lib/constants.js
    - src/lib/command-help.js
    - bin/bgsd-tools.cjs

key-decisions:
  - "Rule-3 explicitly excluded in workflow text (not just internally) — dual layer prevents accidental invocation"
  - "COMMAND_RELATED entry added for lessons:deviation-capture linking to lessons:capture and lessons:list"

requirements-completed: [DEVCAP-02, DEVCAP-03, DEVCAP-04]
one-liner: "Deviation auto-capture hook wired into execute-plan.md + complete help/discovery metadata for lessons:deviation-capture"

duration: 5min
completed: 2026-03-15
---

# Phase 132 Plan 02: Deviation Auto-Capture Hook + Help Metadata Summary

**Deviation auto-capture hook wired into execute-plan.md + complete help/discovery metadata for lessons:deviation-capture**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-15T22:23:19Z
- **Completed:** 2026-03-15T22:28:47Z
- **Tasks:** 2
- **Files modified:** 4 source files + rebuild

## Accomplishments

- Added `<deviation_auto_capture>` section to `workflows/execute-plan.md` immediately after `</deviation_rules>`, with clear invocation instructions for executor agents to call `lessons:deviation-capture` after successful Rule-1 (Bug) recoveries
- Explicitly excluded Rule-3 (Blocking/environmental) failures in the workflow text, providing a dual-layer guard (command filters internally + workflow text says not to invoke)
- Added complete `COMMAND_HELP` entry for `lessons:deviation-capture` to `constants.js` with full usage, options, and examples including a Rule-3 silently-filtered example; added `COMMAND_RELATED` entry in `command-help.js`; rebuild passed, 1564 tests pass (1 pre-existing failure unrelated to this work)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add deviation auto-capture hook to execute-plan.md** - `07c2de4` (feat)
2. **Task 2: Add help/discovery metadata + rebuild + test** - `561d630` (feat)

## Files Created/Modified

- `workflows/execute-plan.md` — Added `<deviation_auto_capture>` section with CLI invocation, rules, and exclusions
- `src/lib/constants.js` — Added `'lessons:deviation-capture'` COMMAND_HELP entry with full usage/options/examples
- `src/lib/command-help.js` — Added `COMMAND_RELATED` entry `['lessons:capture', 'lessons:list']`
- `bin/bgsd-tools.cjs` — Rebuilt from source (all source changes bundled)

## Decisions Made

- Rule-3 explicitly excluded in workflow text AND the command filters internally — dual-layer prevents accidental invocation even if an executor misreads the rule numbering
- `COMMAND_RELATED` for `lessons:deviation-capture` links to `lessons:capture` and `lessons:list` since these are the most natural related commands for a user exploring the lessons namespace

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The `bgsd_status returns structured data from live project` test was failing (1 failure reported). Verified via `git stash` + re-run that this is a pre-existing failure unrelated to this plan's changes — same failure existed before any of Plan 02's edits. No action required.

## Next Phase Readiness

- Phase 132 complete: all 4 DEVCAP requirements (01-04) are now implemented
  - DEVCAP-01: `autonomousRecoveries` typo fix (Plan 01)
  - DEVCAP-02: `lessons:deviation-capture` CLI with Rule-1 filter (Plan 01)
  - DEVCAP-03: 3-per-milestone cap (Plan 01)
  - DEVCAP-04: non-blocking error handling (Plan 01 + Plan 02)
  - Plan 02: workflow hook + help/discovery metadata (this plan)
- Ready to proceed to Phase 133 (Enhanced Research Workflow: structured quality profile + conflict detection)

---
*Phase: 0132-deviation-recovery-auto-capture*
*Completed: 2026-03-15*
