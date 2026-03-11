---
phase: 91-rich-tty-output
plan: 02
subsystem: cli-output
tags: [cli, error-handling, structured-errors]

# Dependency graph
requires: []
provides:
  - error.js module with BgsdError base class
  - Error subclasses: ValidationError, FileError, CommandError, ConfigError
  - Error formatting with recovery suggestions
  - CLI error handling utilities
affects: [91-03, 91-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [Error types with context (file, line, suggestion, code), "Try:" prefix for recovery]

key-files:
  created: [src/lib/error.js]
  modified: []

key-decisions:
  - "Error formatting uses format.js for color-coded output"
  - "createErrorHandler returns exit code based on isWarning flag"

requirements-completed: [UX-10, UX-12]
one-liner: "Created error.js module with structured error classes and formatted output with recovery suggestions"
---

# Phase 91 Plan 02: error.js Module Summary

**Created error.js module with structured error classes and formatted output with recovery suggestions**

## Performance

- **Duration:** ~3 min
- **Tasks:** 3
- **Files created:** 1

## Accomplishments
- Created BgsdError base class with type, file, line, suggestion, code properties
- Created specific error types: ValidationError, FileError, CommandError, ConfigError
- Added formatError() with color-coded output and recovery suggestions
- Added CLI utilities: createErrorHandler(), wrapAsync(), isBgsdError(), getErrorCode()

## Task Commits

1. **Task 1: Create BgsdError base class** - `7a5764c` (feat)
2. **Task 2: Create error formatting with recovery suggestions** - `7a5764c` (feat)
3. **Task 3: Add error handling utilities** - `7a5764c` (feat)

**Plan metadata:** `7a5764c` (docs: complete plan)

## Files Created/Modified
- `src/lib/error.js` - New error handling module

## Decisions Made
- Uses format.js for consistent color-coded output
- "Try:" prefix for recovery suggestions (green text)
- Error handler exits with code 1 for errors, 0 for warnings

## Deviations from Plan
None - plan executed exactly as written.

## Next Phase Readiness
- error.js complete, ready for debug.js (which uses it)

---
*Phase: 91-rich-tty-output*
*Completed: 2026-03-11*
