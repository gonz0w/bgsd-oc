# Requirements: bGSD Plugin v9.1

**Defined:** 2026-03-09
**Core Value:** Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance

## v9.1 Requirements

Requirements for v9.1 Performance Acceleration & Plugin Benchmarking milestone (dependency-driven scope). Each maps to roadmap phases.

### Validation Engine Modernization

- [x] **VALD-01**: User can run plugin tools with lower schema-validation overhead by replacing Zod hot-path usage with a lighter validator engine.
- [x] **VALD-02**: User receives identical tool behavior and output contracts after validator migration.
- [x] **VALD-03**: Maintainer can enable fallback to legacy validation path if compatibility issues appear.

### File Discovery and Ignore Optimization

- [x] **SCAN-01**: User can run file-heavy commands faster via optimized traversal (`fast-glob`) in discovery hotspots.
- [x] **SCAN-02**: User can avoid repeated ignore subprocess overhead by using in-process ignore matching (`ignore`).
- [x] **SCAN-03**: Maintainer can preserve exact file-selection parity with legacy scan behavior.

### Startup and Cache Runtime Gains

- [x] **RUNT-01**: User can get faster repeated CLI invocation startup through compile-cache enablement (guarded by config/env).
- [ ] **RUNT-02**: User can get reduced cache-layer tail latency through SQLite statement caching.
- [x] **RUNT-03**: User can keep current behavior on unsupported runtimes via automatic fallback paths.

### Safe Dependency Adoption and Rollback

- [ ] **SAFE-01**: Maintainer can toggle each dependency-backed optimization independently using explicit config/env flags.
- [ ] **SAFE-02**: User can rely on backward compatibility for existing `.planning/` artifacts after dependency migrations.
- [ ] **SAFE-03**: Maintainer can validate each dependency adoption with parity checks and no functional regressions in core flows.

## Future Requirements

### Performance and Telemetry Enhancements

- **PERF-01**: Competitive plugin benchmark adapter for cross-plugin comparison
- **PERF-02**: Expanded telemetry/APM export path for performance observability

## Out of Scope

| Feature | Reason |
|---------|--------|
| Broad async rewrite of all CLI/plugin internals | High churn and risk for v9.1; dependency-first wins are prioritized |
| Dependency additions without hotspot evidence | Avoids bundle bloat and unnecessary complexity |
| Large benchmark framework expansion in v9.1 | User requested direct runtime wins over benchmark-heavy scope |

## Traceability

| Requirement | Phase | Status | Test Command |
|-------------|-------|--------|--------------|
| VALD-01 | Phase 77 | Complete | npm test |
| VALD-02 | Phase 77 | Complete | npm test |
| VALD-03 | Phase 77 | Complete | npm test |
| SCAN-01 | Phase 78 | Complete | npm test |
| SCAN-02 | Phase 78 | Complete | npm test |
| SCAN-03 | Phase 78 | Complete | npm test |
| RUNT-01 | Phase 79 | Complete | bin/bgsd wrapper with Node version guard |
| RUNT-02 | Phase 80 | Pending | npm test |
| RUNT-03 | Phase 79 | Complete | bin/bgsd wrapper fallback logic |
| SAFE-01 | Phase 81 | Pending | npm test |
| SAFE-02 | Phase 81 | Pending | npm test |
| SAFE-03 | Phase 81 | Pending | npm test |

**Coverage:**
- v9.1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

---
*Requirements defined: 2026-03-09*
*Last updated: 2026-03-10 after phase 79 verification*
