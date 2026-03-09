# Research Summary: v9.1 Dependency-Driven Runtime Acceleration

**Domain:** Faster plugin + CLI behavior through targeted dependency/module adoption
**Researched:** 2026-03-09
**Scope guard:** Benchmark-heavy scope rejected; prioritize direct runtime wins on existing hot paths
**Overall confidence:** HIGH (adoption map + rollout/fallback), MEDIUM-HIGH (exact gain magnitude)

## Executive Direction

v9.1 should accelerate runtime by swapping internal engines behind stable facades, not by adding broad benchmarking infrastructure.

The recommended path is:
1. Reduce plugin validation/bundle overhead (`zod` -> `valibot`).
2. Replace scan/ignore hot paths with optimized traversal (`fast-glob` + `ignore`).
3. Enable repeat-invocation startup gains (Node module compile cache).
4. Remove repeated SQL prepare overhead (`node:sqlite` statement caching).

This preserves command and plugin contracts while improving perceived responsiveness in everyday flows.

## Recommended Dependencies and Runtime Techniques

| Priority | Dependency / Technique | Version | Why now |
|---|---|---:|---|
| P1 | `valibot` | `1.2.0` | Lower plugin schema cost and shipped validator weight on cold path |
| P2 | `fast-glob` | `3.3.3` | Faster high-fanout file discovery and lower JS/syscall traversal overhead |
| P2 | `ignore` | `7.0.5` | Replace repeated `git check-ignore` subprocess churn in scans |
| P3 | Node module compile cache (`module.enableCompileCache`) | Node `>=22.8` API | Faster repeated CLI command startup after warm cache |
| P3 | `node:sqlite` statement cache (`DatabaseSync#createTagStore`) | built-in | Lower tail latency in cache-heavy command flows |

Install command for external packages:

```bash
npm install valibot@1.2.0 fast-glob@3.3.3 ignore@7.0.5
```

## Concrete Replacement Targets in This Repo

### Plugin boundary validation (P1)

- Replace `import { z } from 'zod'` schema definitions with `valibot` in:
  - `src/plugin/tools/bgsd-status.js`
  - `src/plugin/tools/bgsd-plan.js`
  - `src/plugin/tools/bgsd-context.js`
  - `src/plugin/tools/bgsd-validate.js`
  - `src/plugin/tools/bgsd-progress.js`
- Keep I/O contracts unchanged; only internal validator engine changes.

### File scan + ignore hot paths (P2)

- Replace manual recursive traversal and repeated ignore subprocess checks in:
  - `src/lib/codebase-intel.js` (`walkSourceFiles`, `getSourceDirs` path filtering)
  - `src/commands/features.js` high-fanout file scan flows
- Implement adapter seam (`src/lib/adapters/glob.js`) to preserve caller contracts and ease fallback.

### Frontmatter/cache acceleration supporting modules (P2/P3)

- Introduce dual-engine frontmatter adapter pattern where adopted (`gray-matter` primary, existing parser fallback) behind existing `src/lib/frontmatter.js` API.
- Keep `CacheEngine` topology, but optimize internals in `src/lib/cache.js`:
  - enable SQLite statement reuse via tag store
  - keep Map backend fallback untouched

### Startup/runtime technique adoption (P3)

- Enable compile cache early in CLI bootstrap (`src/index.js` and bundled entry behavior in `bin/bgsd-tools.cjs` path) behind env/config guard.

## Rollout and Fallback Strategy

Use dependency flags + shadow-first rollout to avoid behavior regressions.

### Wave 1: Facades and flags (no behavior switch)

1. Add adapters and migration flags (`BGSD_DEP_FAST_GLOB`, `BGSD_DEP_GRAY_MATTER`, `BGSD_DEP_LRU`, `BGSD_DEP_SHADOW_COMPARE`).
2. Keep current implementations as default.
3. Add parity tests for scan outputs and frontmatter parse/stringify behavior.

### Wave 2: Shadow validation

4. Run new engines in compare mode and log mismatches/debug-only telemetry.
5. Resolve parity gaps before enabling defaults.

### Wave 3: Default-on low-risk paths

6. Enable `fast-glob` for read-only discovery flows.
7. Enable bounded cache improvements and SQLite statement caching.
8. Keep in-process fallback active for all adapter failures.

### Wave 4: Parser/default migration completion

9. Enable modern parser engine default only after compatibility parity is stable.
10. Keep legacy parser fallback for one milestone, then remove shadow compare.

### Fallback policy (must keep)

- Any adapter/runtime error falls back to legacy implementation in-process.
- Fallback is silent to normal users; debug detail only under `BGSD_DEBUG=1`.
- Rollback is flag-only; no data migration required.

## Top Adoption Risks (and Controls)

1. **Deploy model breakage (DEP-01):** dependency assumes multi-file/native runtime; gate on single-file bundleability and deploy smoke tests.
2. **Cold-start regression (DEP-02/DEP-06):** "faster" libs add init cost; require lazy-init plan and startup impact note in each adoption PR.
3. **ESM/CJS boundary failures (DEP-03/DEP-07):** plugin/CLI interop drift; require plugin load + CLI smoke + import contract tests.
4. **Node floor incompatibility (DEP-04):** dependency drifts beyond Node 18 support; enforce engine compatibility tests at floor and current LTS.
5. **Behavioral compatibility regressions (DEP-09):** parser/state edge cases change; require legacy fixture parity as hard gate.
6. **Transitive bundle bloat (DEP-06):** performance wins erased by size growth; enforce bundle delta budget and esbuild metafile review.

## Recommended Adoption Sequence (Dependency-First)

1. `valibot` migration in plugin tool schemas (highest user-visible plugin responsiveness potential).
2. `fast-glob` + `ignore` in `codebase-intel` and feature scan flows (largest repo-scale wins).
3. Compile cache enablement for repeated CLI invocations (fast operational win).
4. SQLite statement caching in cache backend (incremental tail latency improvement).

## Out of Scope for v9.1

- Benchmark-harness expansion projects and competitive perf shootouts.
- Full async architecture rewrite of CLI/router/command topology.
- Heavy telemetry/APM dependency additions in plugin hot path.
- Replacing stable modules without hotspot evidence.

## Confidence

| Area | Confidence | Notes |
|---|---|---|
| Dependency shortlist fit (`valibot`, `fast-glob`, `ignore`) | HIGH | Strong alignment with identified hot paths and low-churn integration model |
| Rollout/fallback architecture | HIGH | Shadow mode + flag kill switches minimize regression blast radius |
| Risk controls for deployment/compatibility | HIGH | Directly grounded in repo constraints (single-file CLI, ESM plugin + CJS CLI, backward parsing compatibility) |
| Exact speedup magnitude | MEDIUM-HIGH | Direction is clear; final gains depend on workload mix and migration quality |

---
*Last updated: 2026-03-09*
