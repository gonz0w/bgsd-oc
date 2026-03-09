---
phase: 71-plugin-architecture-safety
plan: 01
subsystem: infra
tags: [esbuild, esm, plugin, error-boundary, circuit-breaker, logging]

# Dependency graph
requires: []
provides:
  - "Dual CJS+ESM build pipeline (bin/gsd-tools.cjs + plugin.js)"
  - "safeHook universal error boundary with retry, timeout, circuit breaker"
  - "File-based error logger with 512KB cap and rotation"
  - "ESM plugin entry point with all hooks wrapped in safeHook"
affects: [71-02-PLAN, 72-status-bar-hooks, 73-prompt-context-engine, 74-custom-tools-framework, 75-event-driven-state-sync, 76-plugin-rebrand]

# Tech tracking
tech-stack:
  added: []
  patterns: [dual-build-pipeline, safe-hook-wrapper, circuit-breaker, correlation-id-logging]

key-files:
  created:
    - "src/plugin/index.js"
    - "src/plugin/safe-hook.js"
    - "src/plugin/logger.js"
  modified:
    - "build.cjs"
    - "plugin.js"
    - "bin/gsd-tools.test.cjs"

key-decisions:
  - "Plugin source files use ESM import syntax (not CJS) for clean esbuild ESM output"
  - "Universal safeHook wrapper (not type-specific) — one function for all hook types"
  - "Logger initialized lazily on first error to avoid creating log file when no errors occur"

patterns-established:
  - "ESM plugin source: src/plugin/ files use ESM imports, esbuild converts to ESM output"
  - "safeHook pattern: wrap any hook fn with safeHook(name, fn, options) for universal error boundary"
  - "Correlation ID logging: 8-char hex ID links toast messages to log file entries"

requirements-completed: [PFND-01, PFND-02]

# Metrics
duration: 19min
completed: 2026-03-09
---

# Phase 71 Plan 01: Build Pipeline & Error Boundary Summary

**Dual CJS+ESM esbuild pipeline with universal safeHook error boundary wrapping all plugin hooks — retry, timeout, circuit breaker, and correlation-ID logging**

## Performance

- **Duration:** 19 min
- **Started:** 2026-03-09T02:41:00Z
- **Completed:** 2026-03-09T03:00:52Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Dual build: `npm run build` produces both bin/gsd-tools.cjs (CJS, 1165KB) and plugin.js (ESM, 5KB) from the same source tree
- ESM output validated at build time — zero `require()` calls allowed, build fails if CJS leaks detected
- safeHook error boundary: 2-attempt retry, configurable timeout (5s default), circuit breaker (3 consecutive failures), BGSD_DEBUG bypass
- File-based error logger with 512KB cap, log rotation, and correlation IDs for easy toast-to-log lookup
- All 3 existing plugin hooks wrapped in safeHook — errors never crash the host process
- 4 new build validation tests (770 total, all pass)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create plugin source structure and dual ESM build target** - `d3ff4bc` (feat)
2. **Task 2: Implement safeHook error boundary with retry, timeout, circuit breaker, and logging** - `6fecc36` (feat)
3. **Task 3: Wire safeHook into plugin entry point — wrap all existing hooks** - `d30d04f` (feat)

## Files Created/Modified
- `src/plugin/index.js` - ESM plugin entry point, all hooks wrapped in safeHook
- `src/plugin/safe-hook.js` - Universal error boundary with retry, timeout, circuit breaker
- `src/plugin/logger.js` - File-based error logger with 512KB cap and rotation
- `build.cjs` - Added ESM build target (esbuild format: esm), CJS leak validation, plugin size tracking
- `plugin.js` - Now generated build output (was hand-written), ESM format
- `bin/gsd-tools.test.cjs` - 4 new ESM plugin build tests

## Decisions Made
- Plugin source uses ESM imports (not CJS require) — esbuild natively produces clean ESM output without `__require` shims
- Universal safeHook wrapper chosen over type-specific wrappers — simpler, hook signature is uniform across all plugin hooks
- Logger lazily initialized on first error — avoids creating log file for projects with no hook failures

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plugin source switched from CJS to ESM imports**
- **Found during:** Task 1 (Create plugin source structure)
- **Issue:** Plan specified CJS source (`require`/`module.exports`) for `src/plugin/` files, but esbuild's CJS→ESM conversion with externalized Node.js builtins produces `__require()` shims that fail the CJS leak validation
- **Fix:** Used ESM import syntax directly in `src/plugin/` files — esbuild handles them natively and produces clean ESM output with zero require() calls
- **Files modified:** src/plugin/index.js, src/plugin/logger.js, src/plugin/safe-hook.js
- **Verification:** `grep -c 'require(' plugin.js` returns 0, `node -e "import('./plugin.js').then(m => console.log(typeof m.BgsdPlugin))"` prints "function"
- **Committed in:** d3ff4bc (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix — CJS source produced invalid ESM output. ESM source is the correct approach for clean esbuild ESM output. No scope creep.

## Issues Encountered
None — plan executed smoothly after the CJS→ESM source fix.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ESM plugin build pipeline ready for Phase 71 Plan 02 (shared parsers, tool registry)
- safeHook pattern established for wrapping all future hooks and tool handlers
- Plugin entry point ready for additional exports (parsers, tool registry)

---
*Phase: 71-plugin-architecture-safety*
*Completed: 2026-03-09*
