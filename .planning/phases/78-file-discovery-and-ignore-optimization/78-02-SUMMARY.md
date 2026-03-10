---
phase: 78-file-discovery-and-ignore-optimization
plan: 02
subsystem: infra
tags: [discovery, fast-glob, ignore, codebase-intel, optimized-default]

# Dependency graph
requires:
  - phase: 78-file-discovery-and-ignore-optimization
    provides: "Dual-path discovery adapter with legacy and optimized engines"
provides:
  - "Optimized-by-default discovery for all file-heavy scan flows"
  - "Eliminated per-entry git check-ignore subprocess overhead from hot paths"
  - "Diagnostic controls (BGSD_DISCOVERY_MODE=legacy, shadow compare) for maintainers"
  - "Behavioral tests proving optimized path activation and subprocess absence"
affects: [codebase-analysis, repo-map, scan-performance, startup-latency]

# Tech tracking
tech-stack:
  added: []
  patterns: [optimized-by-default, diagnostic-toggle, behavioral-source-assertions]

key-files:
  created: []
  modified: [src/lib/adapters/discovery.js, src/lib/codebase-intel.js, tests/codebase.test.cjs, bin/bgsd-tools.cjs]

key-decisions:
  - "Flipped DEFAULT_MODE from legacy to optimized — legacy is now opt-in via BGSD_DISCOVERY_MODE=legacy"
  - "Added getActiveMode() export for runtime mode introspection in diagnostics and tests"
  - "No command-layer changes needed — adapter abstraction from Plan 01 made cutover transparent"

patterns-established:
  - "Default-optimized with explicit legacy fallback env var pattern"
  - "Behavioral source assertions: test function bodies for subprocess usage patterns"

requirements-completed: [SCAN-01, SCAN-02]
one-liner: "Discovery hot paths now default to optimized in-process traversal, eliminating per-entry git check-ignore subprocess overhead with 8 behavioral tests proving activation."

# Metrics
duration: 3min
completed: 2026-03-10
---

# Phase 78 Plan 02: Optimized Discovery Default Summary

**Discovery hot paths now default to optimized in-process traversal, eliminating per-entry git check-ignore subprocess overhead with 8 behavioral tests proving activation.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-10T02:55:24Z
- **Completed:** 2026-03-10T02:58:49Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Flipped discovery default from legacy (subprocess-per-entry) to optimized (in-process ignore matching via fast-glob + ignore library)
- Verified command wiring compatibility — analyze, status, and background analysis flows remain stable with zero command-layer changes
- Added 8 behavioral tests covering optimized default activation, subprocess absence, legacy availability, and diagnostic controls

## Task Commits

Each task was committed atomically:

1. **Task 1: Switch hotspot discovery flows to optimized default with guard rails** - `096fe36` (feat)
2. **Task 2: Validate command wiring and compatibility after optimized cutover** - `be78d74` (refactor)
3. **Task 3: Add behavioral tests for optimized default and ignore subprocess elimination** - `10a12e8` (test)

## Files Created/Modified
- `src/lib/adapters/discovery.js` - Flipped DEFAULT_MODE to optimized; added getActiveMode() export for diagnostics
- `src/lib/codebase-intel.js` - Updated getDiscoveryOptions() to default to optimized mode
- `tests/codebase.test.cjs` - Added 8 behavioral tests for optimized default path verification
- `bin/bgsd-tools.cjs` - Rebuilt CLI bundle reflecting optimized discovery default
- `bin/manifest.json` - Updated build manifest

## Decisions Made
- Flipped the default rather than adding a feature flag — the adapter seam from Plan 01 already provides the diagnostic toggle via BGSD_DISCOVERY_MODE env var
- No command-layer changes: the adapter abstraction cleanly decoupled discovery internals from command wiring
- Used behavioral source assertions (inspecting function bodies for subprocess patterns) to create tests that remain robust across refactors

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Optimized discovery is now the default runtime path for all file-heavy scan flows
- Legacy mode remains available via `BGSD_DISCOVERY_MODE=legacy` for diagnosis
- Shadow comparison via `BGSD_DISCOVERY_SHADOW=1` available for parity verification
- Ready for Plan 03 to address any remaining optimization gaps

---
*Phase: 78-file-discovery-and-ignore-optimization*
*Completed: 2026-03-10*
