---
phase: 91-rich-tty-output
plan: 04
subsystem: cli-output
tags: [cli, integration, flags]

# Dependency graph
requires:
  - phase: 91-01
    provides: format.js enhancements
  - phase: 91-02
    provides: error.js module
  - phase: 91-03
    provides: debug.js module
provides:
  - Main CLI with new modules integrated
  - CLI flag parsing for color and debug/trace
  - Bundled CLI with all new features
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [Flag parsing before command extraction, npm run build for bundling]

key-files:
  created: []
  modified: [bin/bgsd-tools.cjs, src/router.js]

key-decisions:
  - "Flags parsed before command extraction to avoid 'unknown command' errors"
  - "Format and debug modules use lazy require pattern"

requirements-completed: [UX-01, UX-02, UX-03, UX-10, UX-11, UX-12]
one-liner: "Integrated format.js, error.js, and debug.js into main CLI with working color and debug flags"
---

# Phase 91 Plan 04: Integration Summary

**Integrated format.js, error.js, and debug.js into main CLI with working color and debug flags**

## Performance

- **Duration:** ~5 min
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- Added format, error, debug requires to router.js
- Implemented flag parsing: --debug, --trace, --color, --no-color, --force-color
- Flags properly removed from args before command routing
- Auto-enables colors when debug mode is enabled
- Rebuilt CLI with npm run build

## Task Commits

1. **Task 1: Integrate new modules into main CLI** - `fde6db3` (feat)
2. **Task 2: Add color and debug flag documentation** - `fde6db3` (feat)
3. **Task 3: Verify end-to-end functionality** - `fde6db3` (feat)

**Plan metadata:** `fde6db3` (docs: complete plan)

## Files Created/Modified
- `bin/bgsd-tools.cjs` - Rebuilt CLI with new modules
- `src/router.js` - Added module requires and flag parsing

## Decisions Made
- Flags must be parsed before command extraction to prevent "unknown command" errors
- parseDebugFlags and parseColorFlags modify the args array in-place to remove parsed flags

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

- Phase 91 complete - all modules integrated and working
- CLI now supports --color, --no-color, --force-color, --debug, --trace flags

---
*Phase: 91-rich-tty-output*
*Completed: 2026-03-11*
