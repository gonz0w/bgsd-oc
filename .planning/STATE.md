# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-03-09)

**Core value:** Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance
**Current focus:** v9.1 Performance Acceleration & Plugin Benchmarking - roadmap defined, ready for phase planning

## Current Position

**Phase:** 81 of 81 (Safe Adoption Controls and Regression Parity)
**Current Plan:** 03 complete
**Status:** Phase complete
**Last Activity:** 2026-03-10

**Progress:** [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 178 (v1.0-v9.1)
- Average duration: ~15 min/plan
- Total execution time: ~33 hours

**Current milestone profile:**

| Milestone | Phases | Requirements | Status |
|-----------|--------|--------------|--------|
| v9.1 | 5 (77-81) | 12 | Ready for planning |
| Phase 77-validation-engine-modernization P01 | 2 min | 3 tasks | 6 files |
| Phase 77 P02 | 12 min | 3 tasks | 7 files |
| Phase 77 P03 | 6 min | 3 tasks | 1 file |
| Phase 78 P01 | 6 min | 3 tasks | 5 files |
| Phase 78 P02 | 3 min | 3 tasks | 5 files |
| Phase 78 P03 | 11 min | 3 tasks | 4 files |
| Phase 79-startup-compile-cache-acceleration P01 | 5 min | 3 tasks | 4 files |
| Phase 79-startup-compile-cache-acceleration P02 | 10 min | 3 tasks | 3 files |
| Phase 80-sqlite-statement-cache-acceleration P01 | 8 min | 3 tasks | 1 file |
| Phase 81-safe-adoption-controls-and-regression-parity P01 | 7 min | 3 tasks | 4 files |
| Phase 81 P02 | 8 min | 3 tasks | 1 file |
| Phase 81 P03 | 7 min | 2 tasks | 4 files |

## Accumulated Context

### Decisions

- [v9.1 roadmap]: Scope is dependency-driven acceleration only; benchmark-framework expansion remains out of scope.
- [v9.1 roadmap]: Requirements are grouped into five delivery phases (validation, scan/ignore, startup, cache, safety/parity).
- [v9.1 roadmap]: Backward compatibility and rollback controls are treated as explicit milestone outcomes, not implicit assumptions.
- [Phase 77-validation-engine-modernization]: Default plugin validation path now uses valibot with explicit zod fallback flags
- [Phase 77-validation-engine-modernization]: Adapter error normalization keeps invalid-input output contracts identical across validation engines
- [Phase 77]: Completed plugin validation migration to shared adapter schemas with fallback parity
- [Phase 77]: Recorded VALD-01 baseline evidence with 34.48% modern-path improvement against forced fallback
- [Phase 77]: Stabilized `bgsd_context` fallback parity by using a deterministic fixture project for task-context coercion tests
- [Phase 77]: Added explicit `bgsd_progress` adapter wiring evidence without direct fallback flag reads in tool code
- [Phase 78]: Discovery hotspots now route through a dual-path adapter — Enable fast-glob and in-process ignore rollout behind a parity-safe legacy default
- [Phase 78]: Optimized discovery is now the default runtime path — legacy mode available via BGSD_DISCOVERY_MODE=legacy for diagnosis
- [Phase 78]: Source-dir detection is fully equivalent between legacy and optimized; file walk filters gitignored files as an intentional improvement
- [Phase 78]: diagnoseParity() export added for structured mismatch triage with onlyLegacy/onlyOptimized diffs
- [Phase 79-startup-compile-cache-acceleration]: Compile-cache guard uses BGSD_COMPILE_CACHE env var (default disabled for safety)
- [Phase 79-startup-compile-cache-acceleration]: Runtime capability detection identifies Node 10.4+ support, graceful fallback on older runtimes
- [Phase 79-startup-compile-cache-acceleration]: Benchmark shows ~10% startup speedup with compile-cache enabled
- [Phase 79-02]: Created bin/bgsd wrapper script that applies --experimental-code-cache flag before spawning Node
- [Phase 79-02]: RUNT-01 achieved - warm starts are faster (76-102ms) due to Node 22+ compile-cache by default
- [Phase 79-03]: Fixed wrapper to skip flag on Node 22+ - benchmark shows 0% (neutral) vs previous -58% regression
- [Phase 80-sqlite-statement-cache-acceleration]: Statement caching via createTagStore() reduces p50 latency by ~43%, p99 by ~22%
- [Phase 80-sqlite-statement-cache-acceleration]: BGSD_SQLITE_STATEMENT_CACHE env var controls feature (default: enabled on Node 22.5+)
- [Phase 81-safe-adoption-controls-and-regression-parity]: Added optimization flags section to CONFIG_SCHEMA with env var override support
- [Phase 81-safe-adoption-controls-and-regression-parity]: Created util:settings command to display all config including optimization flags
- [Phase 81-02]: Parser backward compatibility verified — parsers gracefully handle missing fields, extra unknown fields, and return null for non-existent files
- [Phase 81-03]: Created generalized parity-check utility and bgsd-tools util:parity-check command for on-demand validation of all dependency-backed optimizations

### Pending Todos

None yet.

### Blockers/Concerns

- Keep single-file CLI deploy behavior intact while adopting external dependencies.
- Preserve Node runtime compatibility through guarded feature flags and fallback paths.

## Session Continuity

**Last session:** 2026-03-10T04:37:00Z
**Stopped at:** Completed 81-03-PLAN.md — Phase 81 complete, milestone v9.1 ready
**Next step:** Milestone v9.1 complete
