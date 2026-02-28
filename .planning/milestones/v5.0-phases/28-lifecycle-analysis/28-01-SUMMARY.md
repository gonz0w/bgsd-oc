---
phase: 28-lifecycle-analysis
plan: 01
subsystem: codebase-intelligence
tags: [lifecycle, dag, topological-sort, migration-ordering, elixir-phoenix, detector-registry]

# Dependency graph
requires:
  - phase: 25-dependency-graph
    provides: findCycles() Tarjan's SCC for cycle detection
  - phase: 23-infrastructure-storage
    provides: readIntel()/writeIntel() for codebase-intel.json caching
provides:
  - LIFECYCLE_DETECTORS extensible registry (generic-migrations + elixir-phoenix detectors)
  - buildLifecycleGraph() function producing DAG with nodes, chains, cycles
  - Topological sort (Kahn's algorithm) with connected component grouping
  - Migration node capping at 20 per directory with summary node
affects: [28-02, 29-workflow-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [lifecycle-detector-registry, dag-chain-flattening, kahn-topological-sort]

key-files:
  created: [src/lib/lifecycle.js]
  modified: []

key-decisions:
  - "Detector registry follows FRAMEWORK_DETECTORS pattern from conventions.js for consistency"
  - "Migration cap at 20 most recent per directory keeps token budget manageable for large projects"
  - "Phoenix detector gates on intel.conventions.frameworks — skips if conventions not yet extracted"
  - "Symmetry enforcement as post-processing step rather than per-detector to avoid duplicate logic"

patterns-established:
  - "LIFECYCLE_DETECTORS: extensible array of { name, detect(intel), extractLifecycle(intel, cwd) } objects"
  - "DAG node shape: { id, file_or_step, type, must_run_before[], must_run_after[], framework, confidence }"
  - "Chain flattening: connected components → Kahn's topological sort → filter length > 1"

requirements-completed: [LIFE-01, LIFE-02, LIFE-03]

# Metrics
duration: 4min
completed: 2026-02-26
---

# Phase 28 Plan 01: Core Lifecycle Library Summary

**Lifecycle detector registry with generic migration ordering and Elixir/Phoenix initialization patterns, producing DAG chains via Kahn's topological sort**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-26T17:50:58Z
- **Completed:** 2026-02-26T17:55:52Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Created `src/lib/lifecycle.js` with extensible `LIFECYCLE_DETECTORS` registry matching the `FRAMEWORK_DETECTORS` pattern
- Generic migration detector correctly orders numbered/timestamped files across `migrations/`, `db/migrate/`, and `priv/*/migrations/` directories
- Elixir/Phoenix detector identifies config→boot→migration→seed→router lifecycle chain
- Validated against real project data

## Task Commits

Each task was committed atomically:

1. **Task 1: Create lifecycle.js with detector registry and DAG builder** - `79b8b05` (feat)
2. **Task 2: Verify lifecycle detection** - No code changes (verification-only task, all tests passed)

## Files Created/Modified
- `src/lib/lifecycle.js` - Core lifecycle analysis library with LIFECYCLE_DETECTORS registry, buildLifecycleGraph(), topological sort, chain flattening, and cycle detection integration via findCycles from deps.js

## Decisions Made
- Followed `FRAMEWORK_DETECTORS` pattern from `src/lib/conventions.js` for detector registry — proven extensible pattern
- Migration cap at 20 per directory with summary node for older migrations — keeps output under 1K tokens
- Phoenix detector gates on `intel.conventions.frameworks` from Phase 24 — doesn't re-detect frameworks
- Symmetry enforcement done as single post-processing pass rather than per-detector to avoid duplication
- `var` declaration style used at module level consistent with codebase conventions

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `src/lib/lifecycle.js` ready for Plan 02 to wire into CLI commands (`cmdCodebaseLifecycle()`)
- Module exports `LIFECYCLE_DETECTORS` and `buildLifecycleGraph` for command integration
- Caching will be added in Plan 02 (writing lifecycle results to `intel.lifecycle`)

---
*Phase: 28-lifecycle-analysis*
*Completed: 2026-02-26*
