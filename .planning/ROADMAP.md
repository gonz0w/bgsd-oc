# Roadmap: bGSD Plugin v9.1 Performance Acceleration & Plugin Benchmarking

## Overview

This milestone delivers dependency-driven performance acceleration for the plugin and CLI by modernizing validation, speeding file discovery, improving startup/cache runtime paths, and shipping rollback-safe controls that preserve existing behavior.

## Milestones

- 🚧 **v9.1 Performance Acceleration & Plugin Benchmarking** - Phases 77-81 (in progress)
- ✅ Previous milestones shipped - see `.planning/MILESTONES.md`

## Phases

- [x] **Phase 77: Validation Engine Modernization** - Replace hot-path validator internals with lower-overhead execution while preserving contracts. (completed 2026-03-10)
- [x] **Phase 78: File Discovery and Ignore Optimization** - Speed high-fanout scans and remove ignore subprocess overhead with parity guarantees. (completed 2026-03-10)
- [x] **Phase 79: Startup Compile-Cache Acceleration** - Improve repeated CLI startup through guarded compile-cache enablement and fallback behavior. (completed 2026-03-10)
- [x] **Phase 80: SQLite Statement Cache Acceleration** - Reduce cache-layer tail latency through statement reuse with runtime-safe fallback. (completed 2026-03-10)
- [ ] **Phase 81: Safe Adoption Controls and Regression Parity** - Provide independent optimization toggles and enforce backward-compatible core flows.

## Phase Details

### Phase 77: Validation Engine Modernization
**Goal**: Users run plugin tools with lower validation overhead while seeing the same outputs and fallback safety.
**Depends on**: Phase 76 (completed)
**Requirements**: VALD-01, VALD-02, VALD-03
**Success Criteria** (what must be TRUE):
  1. User can run plugin tools and observe lower validation-related latency on hot paths.
  2. User sees unchanged command behavior and output contracts after the validator engine migration.
  3. Maintainer can switch to a legacy validation path when compatibility issues are detected.
**Plans**: 3/3 plans complete

### Phase 78: File Discovery and Ignore Optimization
**Goal**: File-heavy workflows complete faster while preserving exact legacy file-selection behavior.
**Depends on**: Phase 77
**Requirements**: SCAN-01, SCAN-02, SCAN-03
**Success Criteria** (what must be TRUE):
  1. User can run file-heavy commands and observe faster end-to-end discovery in large repositories.
  2. User can execute scan flows without repeated `git check-ignore` subprocess overhead.
  3. Maintainer can confirm optimized scan outputs match legacy file-selection parity.
**Plans**: 3/3 plans complete

### Phase 79: Startup Compile-Cache Acceleration
**Goal**: Repeated CLI invocations start faster through guarded compile-cache usage without runtime breakage.
**Depends on**: Phase 78
**Requirements**: RUNT-01, RUNT-03
**Success Criteria** (what must be TRUE):
  1. User can run repeated CLI commands and observe faster warm-start startup behavior.
  2. Maintainer can enable or disable compile-cache acceleration via explicit config or environment guard.
  3. User on unsupported runtimes sees current behavior preserved through automatic fallback.
**Plans**: 3/3 plans complete

### Phase 80: SQLite Statement Cache Acceleration
**Goal**: Cache-heavy command paths show lower tail latency through SQLite statement caching with compatibility fallback.
**Depends on**: Phase 79
**Requirements**: RUNT-02
**Success Criteria** (what must be TRUE):
  1. User can run cache-heavy flows and observe reduced high-percentile latency.
  2. Maintainer can verify statement caching can be bypassed safely when runtime support is unavailable.
**Plans**: 1/1 complete

### Phase 81: Safe Adoption Controls and Regression Parity
**Goal**: Dependency-backed optimizations are independently controllable and remain backward compatible in core planning workflows.
**Depends on**: Phase 80
**Requirements**: SAFE-01, SAFE-02, SAFE-03
**Success Criteria** (what must be TRUE):
  1. Maintainer can toggle each dependency-backed optimization independently using explicit flags.
  2. User can continue using existing `.planning/` artifacts with no compatibility break after migrations.
  3. Maintainer can run parity checks and validate no functional regressions in core flows.
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 77. Validation Engine Modernization | 3/3 | Complete   | 2026-03-10 |
| 78. File Discovery and Ignore Optimization | 3/3 | Complete    | 2026-03-10 |
| 79. Startup Compile-Cache Acceleration | 3/3 | Complete    | 2026-03-10 |
| 80. SQLite Statement Cache Acceleration | 1/1 | Complete    | 2026-03-10 |
| 81. Safe Adoption Controls and Regression Parity | 0/TBD | Not started | - |
