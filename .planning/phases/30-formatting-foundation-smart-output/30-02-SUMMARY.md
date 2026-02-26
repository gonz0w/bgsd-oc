---
phase: 30-formatting-foundation-smart-output
plan: 02
subsystem: formatting
tags: [tty-detection, output-mode, pretty-flag, brand-rename, cli-output, json, piped]

# Dependency graph
requires:
  - phase: 30-formatting-foundation-smart-output
    provides: "src/lib/format.js formatting primitives module"
provides:
  - "TTY-aware output mode switching in output.js (formatted vs json)"
  - "outputMode() and status() exports for downstream command renderers"
  - "--pretty flag for forced formatted output when piped"
  - "All workflow files updated — no --raw flags remain"
  - "Brand renamed to bGSD / Get Stuff Done"
affects: [phase-31, phase-32, phase-33, phase-34]

# Tech tracking
tech-stack:
  added: []
  patterns: [tty-auto-detection, dual-mode-output, stderr-status-messages, pretty-flag-override]

key-files:
  created: []
  modified: [src/lib/output.js, src/router.js, src/lib/constants.js, README.md, AGENTS.md, workflows/help.md]

key-decisions:
  - "Backward compat: boolean options in output() still work as legacy raw mode during migration"
  - "--raw silently accepted as no-op in router.js (backward compat for external callers)"
  - "Graceful fallback: commands without formatter still produce JSON in formatted mode"
  - "Brand renamed in titles/headings only — command names (/gsd-*) unchanged"

patterns-established:
  - "Output mode: global._gsdOutputMode set by router.js, read by outputMode()"
  - "Formatters: output(result, { formatter }) for TTY-aware rendering"
  - "Status: status(message) writes to stderr, visible even when stdout is piped"
  - "Pretty: --pretty flag forces formatted mode when piped (e.g., | less -R)"

requirements-completed: [OUT-01, OUT-02, OUT-03, OUT-04]

# Metrics
duration: 4min
completed: 2026-02-26
---

# Phase 30 Plan 02: Smart Output Mode Summary

**TTY auto-detection routes output (formatted for terminal, JSON for piped), --raw removed from router and all 22 workflow files, --pretty flag added, brand renamed to bGSD (Get Stuff Done)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-26T22:21:52Z
- **Completed:** 2026-02-26T22:26:23Z
- **Tasks:** 2
- **Files modified:** 28

## Accomplishments
- Built dual-mode output routing in output.js with outputJSON() helper, outputMode() export, and status() for stderr
- Removed --raw flag from router.js and replaced with TTY auto-detection + --pretty flag
- Removed --raw from all 22 workflow .md files (32 instances) and all COMMAND_HELP strings in constants.js (144 instances)
- Renamed brand from "GSD (Get Shit Done)" to "bGSD (Get Stuff Done)" in README.md, AGENTS.md, and workflows/help.md
- Full backward compatibility maintained — existing boolean-arg command handlers keep working

## Task Commits

Each task was committed atomically:

1. **Task 1: TTY auto-detection, output mode switching, and --pretty flag** - `5af1d4b` (feat)
2. **Task 2: Remove --raw from all workflow files and rename brand to bGSD** - `8261325` (feat)

## Files Created/Modified
- `src/lib/output.js` - Dual-mode output routing with outputJSON(), outputMode(), status() exports
- `src/router.js` - TTY auto-detection, --pretty flag, --raw removed (silently accepted as no-op)
- `src/lib/constants.js` - All COMMAND_HELP strings updated, --raw removed, --pretty added
- `README.md` - Brand renamed to bGSD (Get Stuff Done) in title
- `AGENTS.md` - Brand renamed in project description
- `workflows/help.md` - Brand renamed in intro text
- 22 workflow .md files - All --raw flags removed from gsd-tools invocations

## Decisions Made
- Backward compat strategy: output(result, boolean) still works as legacy mode — prevents breaking existing command handlers during migration period (Phases 32-34)
- --raw silently accepted as no-op rather than erroring — external scripts that still pass --raw won't break
- Graceful JSON fallback for commands without formatter — un-migrated commands produce JSON even in TTY mode
- Brand rename limited to title/heading/intro text — command names (/gsd-*) and code-level identifiers left unchanged

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed duplicate module.exports in router.js**
- **Found during:** Task 1 (router.js modification)
- **Issue:** router.js had `module.exports = { main };` duplicated on lines 774-776
- **Fix:** Removed the duplicate export line
- **Files modified:** src/router.js
- **Verification:** File loads correctly, no runtime errors
- **Committed in:** 5af1d4b (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor cleanup, no scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Output infrastructure complete — format.js (Plan 01) + output mode routing (Plan 02) ready for command renderers
- Phases 32-34 can migrate individual commands from output(result, raw) to output(result, { formatter })
- Phase 31 (quality gates) can add test coverage for output mode switching
- All existing commands still work via backward compatibility layer

---
*Phase: 30-formatting-foundation-smart-output*
*Completed: 2026-02-26*
