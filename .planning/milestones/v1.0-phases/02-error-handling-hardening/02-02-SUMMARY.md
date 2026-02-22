---
phase: "02"
plan: "02"
subsystem: "cli-hardening"
one-liner: "Shell sanitization helpers, strict date validation, --fixed-strings for grep, and temp file cleanup on process exit"
tags: [security, shell-injection, temp-files, cleanup, hardening]
dependency-graph:
  requires:
    - "02-01 debugLog helper"
  provides:
    - "sanitizeShellArg() reusable shell escaping"
    - "isValidDateString() strict date validation"
    - "Temp file cleanup handler"
  affects:
    - "getSessionDiffSummary()"
    - "cmdSessionDiff()"
    - "cmdCodebaseImpact()"
    - "output() function"
tech-stack:
  added: []
  patterns:
    - "Single-quote escaping for shell args"
    - "Strict regex validation before interpolation"
    - "process.on(exit) for resource cleanup"
key-files:
  created: []
  modified:
    - "bin/gsd-tools.cjs"
    - "bin/gsd-tools.test.cjs"
key-decisions:
  - "Reusable sanitizeShellArg over inline escaping: Extracted the same pattern used in execGit() to a standalone helper for consistent reuse"
  - "isValidDateString as separate guard: Strict YYYY-MM-DD regex prevents any non-date from reaching --since args, even though the regex extractor already strips most metacharacters"
  - "--fixed-strings for grep: Literal matching is both safer (no regex injection) and more correct (module names contain dots and brackets)"
  - "Module-level _tmpFiles array: Tracks all temp files created during CLI lifetime, cleaned up by process.on(exit) handler"
metrics:
  duration: "5 min"
  completed: "2026-02-22"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
  tests_added: 9
---

# Phase 2 Plan 02: Shell Sanitization + Temp File Cleanup Summary

Shell sanitization helpers, strict date validation, --fixed-strings for grep, and temp file cleanup on process exit.

## What Was Done

### Task 1: Shell Sanitization and Strict Date Validation

Added two helper functions near the other CLI helpers:

1. **`sanitizeShellArg(arg)`** — Wraps string in single quotes with internal single-quote escaping (`'` → `'\''`). Same pattern already used in `execGit()`, now extracted for reuse.

2. **`isValidDateString(str)`** — Validates against strict `/^\d{4}-\d{2}-\d{2}$/` regex. Returns boolean.

Fixed 5 unguarded `execSync` sites:
- `getSessionDiffSummary()` — Added `isValidDateString()` guard + `sanitizeShellArg()` for `--since`
- `cmdSessionDiff()` (3 sites) — Added `isValidDateString()` guard at top, then used `sanitizeShellArg()` for all three `--since` interpolations
- `cmdCodebaseImpact()` — Changed `grep -rl "${pattern}"` to `grep -rl --fixed-strings ${sanitizeShellArg(pattern)}`

### Task 2: Temp File Cleanup and Tests

**Cleanup mechanism:**
- Added `const _tmpFiles = [];` at module level (after requires)
- Added `process.on('exit', ...)` handler that calls `fs.unlinkSync()` for each tracked file
- Wired `_tmpFiles.push(tmpPath)` into `output()` function where large JSON is written to tmpdir

**New tests (9 total):**

Shell sanitization (5 tests):
- Date extraction strips trailing metacharacters (regex defense)
- Valid dates are accepted and produce correct output
- Backtick injection rejected (regex won't match)
- `$()` injection rejected (regex won't match)
- `--fixed-strings` prevents grep regex errors with special characters

Temp file cleanup (4 tests):
- `process.on('exit')` handler is registered in source
- `_tmpFiles.push` is wired into `output()` function
- No temp files remain after CLI invocation
- Cleanup logic correctly removes tracked files

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

- `npm test`: 127 pass, 1 fail (pre-existing `roadmap analyze` test — unchanged)
- `grep -c 'sanitizeShellArg' bin/gsd-tools.cjs`: 4 occurrences (1 definition + 3 usage sites)
- `grep -c 'isValidDateString' bin/gsd-tools.cjs`: 3 occurrences (1 definition + 2 validation sites)
- `grep 'fixed-strings' bin/gsd-tools.cjs`: Present in cmdCodebaseImpact grep call
- `grep 'process.on.*exit' bin/gsd-tools.cjs`: Cleanup handler registered

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `1aafbde` | feat(02-02): add shell sanitization and strict date validation |
| 2 | `c79d357` | test(02-02): add temp file cleanup and hardening tests |
