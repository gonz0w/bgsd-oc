# Architecture Research: Dependency-Driven Acceleration Integration (v9.1)

**Research mode:** Ecosystem -> Architecture integration  
**Scope:** Safe dependency upgrades for CLI, plugin hooks, parsers, cache, and commands  
**Question:** How to reduce latency with minimal architecture churn  
**Date:** 2026-03-09  
**Overall confidence:** HIGH (repo architecture + official docs + Context7)

## Executive Recommendation

Adopt a **facade-first upgrade architecture**: keep existing module boundaries and command contracts, replace only internal engines behind adapters, and ship each dependency in shadow mode before enabling by default.

Use this dependency set (opinionated):

1. **fast-glob** for directory and pattern scans in high-fanout paths.
2. **gray-matter** for frontmatter parse/stringify compatibility with markdown body preservation.
3. **lru-cache** for short-lived hot object caches (parser and metadata cache), while retaining SQLite L2 persistence for file/research cache.

Do **not** rewrite router/commands architecture in v9.1. Keep `src/router.js` and namespace contracts intact; accelerate internals behind stable function signatures.

---

## Integration Map (Replace vs Wrap)

| Surface | Current | Action | Why this is safe |
|---|---|---|---|
| CLI file tree scans | Repeated `fs.readdirSync` walks in helpers/commands | **Wrap + partial replace** with `src/lib/adapters/glob.js` backed by `fast-glob` | Keeps existing callers; adapter can fall back to current sync walk |
| Plugin hooks | `safeHook` wrapper with timeout/retry/circuit breaker | **Keep core, wrap internals** with lightweight timing + deferred I/O policy | Preserves hook contract and existing guardrails |
| Frontmatter parser | Custom parser in `src/lib/frontmatter.js` | **Dual-engine** (`gray-matter` primary, existing parser fallback) | No format breakage during migration; quick rollback path |
| Parser caches | ad-hoc `Map` caches across parser modules | **Replace internal cache impl** with bounded `lru-cache` wrapper | Same cache API, better TTL/size control |
| Persistent cache | `CacheEngine` Map/SQLite split | **Keep architecture; optimize SQLite path** (prepared statements + busy timeout) | No caller changes; preserves Node version fallback logic |
| Commands | Direct helper calls in large command modules | **No command API changes**; route hot read/scan/frontmatter calls through adapters | Avoids churn in 100+ command paths |

---

## New vs Modified Module Plan

### New modules

| Module | Responsibility | Dependency |
|---|---|---|
| `src/lib/adapters/glob.js` | Unified scan API: `scanPlanningTree`, `scanPhaseDirs`, `matchPatterns` | `fast-glob` |
| `src/lib/adapters/frontmatter-engine.js` | Engine selector + normalized parse/stringify contract | `gray-matter` + existing parser |
| `src/lib/adapters/lru.js` | Shared bounded cache factory (`max`, `ttl`) | `lru-cache` |
| `src/lib/migration-flags.js` | Reads upgrade flags and default policy | none |
| `src/lib/compat/frontmatter-equivalence.js` | Optional runtime parity checks in shadow mode | none |

### Modified modules

| Module | Change |
|---|---|
| `src/lib/frontmatter.js` | Convert to facade calling adapter engine; keep exported API identical |
| `src/lib/helpers.js` | Route tree scans and selected directory reads through glob adapter |
| `src/lib/cache.js` | Add SQLite statement reuse strategy + keep Map fallback; use shared LRU helper for in-memory metadata |
| `src/plugin/parsers/*.js` | Replace unbounded Maps with shared LRU factory where safe |
| `src/plugin/safe-hook.js` | Add optional profiling tags only; avoid blocking writes in hook path |
| `src/commands/features.js` / `src/commands/misc.js` / `src/commands/verify.js` | Swap direct scan/frontmatter internals to adapter calls, no output contract changes |
| `tests/*.test.cjs` + `tests/plugin.test.cjs` | Add dual-engine parity tests and fallback tests |

---

## Dependency Design by Subsystem

### 1) CLI and Command Layer

**Use `fast-glob` for high-fanout scans, not for every file access.**

- Replace recursive scan hotspots (`.planning/phases`, milestone archive scans, markdown file discovery) with adapter calls.
- Keep synchronous command semantics by exposing both async and sync adapter methods; prefer sync only where command flow already expects it.
- Preserve existing command outputs and flags; no namespace/routing redesign in this milestone.

**Why:** current latency is dominated by repeated scan patterns in helper/command paths, and this can be improved without changing command contracts.

### 2) Plugin Hooks

**Do not add heavy deps in hook critical path.**

- Keep `safeHook` as the safety boundary.
- Only add dependency-backed logic in precomputed/idle paths (for example cache warmers or analysis jobs), not inside per-event hot paths.
- Continue honoring plugin hook/tool naming and precedence constraints (`bgsd_` tool namespace, no built-in shadowing).

**Why:** plugin docs show hooks run sequentially and plugin tool naming can shadow built-ins; hot-path inflation is risky.

### 3) Parsers and Frontmatter

**Migrate frontmatter via dual-engine adapter with correctness gate.**

- `gray-matter` becomes primary engine for parse/stringify.
- Existing parser remains fallback engine behind flag.
- Shadow mode compares parsed outputs for target files and logs mismatches without failing commands.

**Why:** parser bugs/edge cases are a compatibility risk; dual-engine migration prevents abrupt behavior drift.

### 4) Cache

**Keep two-layer cache architecture; harden internals.**

- Keep Map/SQLite backend selection behavior as-is.
- Add prepared-statement reuse for SQLite operations and configure conservative lock timeout.
- Use `lru-cache` for ephemeral parser metadata caches to avoid unbounded growth.

**Why:** current architecture is already correct for CLI lifecycle; replacing it would create unnecessary churn.

---

## Compatibility and Migration Strategy

### Compatibility contracts (must not change)

- CLI namespace commands and JSON output shape.
- Existing markdown format acceptance (old + new plan/state/roadmap formats).
- Node fallback behavior (`node:sqlite` unavailable -> Map backend).
- Plugin tool and hook registration surface.

### Feature flags

- `BGSD_DEP_FAST_GLOB=0|1` (default: 0 in shadow phase)
- `BGSD_DEP_GRAY_MATTER=0|1` (default: 0 in shadow phase)
- `BGSD_DEP_LRU=0|1` (default: 1 for non-critical caches once parity proven)
- `BGSD_DEP_SHADOW_COMPARE=0|1` (default: 1 during migration)

### Fallback policy

- Any adapter error auto-falls back to existing implementation in-process.
- Fallback emits debug telemetry only (`BGSD_DEBUG=1`), never user-visible failure for normal flows.
- Rollback is flag-only; no data migration required.

---

## Rollout Order (Dependency-Aware)

### Wave 1: Facades + No-op adoption (safe scaffolding)

1. Add adapter modules and flags.
2. Keep old implementations as default.
3. Add parity test harness for frontmatter and scan output.

### Wave 2: Shadow mode validation

4. Enable `fast-glob` + `gray-matter` in shadow compare mode.
5. Record mismatch/latency metrics in baseline artifacts.
6. Fix parity gaps before any default switch.

### Wave 3: Default-on for low-risk paths

7. Turn on `lru-cache` for parser metadata caches.
8. Turn on `fast-glob` for read-only scan operations.
9. Keep fallback enabled and observable.

### Wave 4: Default-on for parser engine

10. Enable `gray-matter` as default frontmatter engine.
11. Keep legacy parser as fallback for one milestone.
12. Remove shadow compare once mismatch rate is negligible and tests are green.

---

## Risk Controls

| Risk | Detection | Mitigation |
|---|---|---|
| Frontmatter semantic drift | Parity tests + shadow mismatch logs | Keep legacy parser fallback; block default switch until parity passes |
| Hook latency regression | Hook p95/p99 before/after profile snapshots | Restrict dependency work out of hot hooks; defer to idle/background |
| Bundle-size growth | Build artifact size gate + startup timing checks | Add only 3 deps; reject large transitive additions |
| Cross-platform path/glob differences | Windows + Linux snapshot tests | Use adapter normalization and absolute-path test matrix |
| SQLite lock behavior changes | Cache stress test with lock contention cases | Configure timeout and conservative retries, keep Map fallback |

---

## Architecture Decision Summary

- **Replace:** internal scan engine (`fast-glob`), bounded in-memory cache primitive (`lru-cache`).
- **Wrap:** frontmatter parsing via adapter (`gray-matter` primary + legacy fallback), command hot paths via helper adapters.
- **Keep:** command router, plugin hook topology, two-layer cache architecture, markdown/CLI compatibility contracts.
- **Rollout:** shadow -> compare -> partial default -> full default, with per-dependency kill switches.

This gives measurable latency improvement potential with low architectural risk because external behavior remains stable and every change has a same-process fallback.

---

## Confidence Assessment

| Area | Level | Reason |
|---|---|---|
| bGSD integration map and module plan | HIGH | Based on current repo structure (`src/router.js`, `src/lib/helpers.js`, `src/lib/frontmatter.js`, `src/lib/cache.js`, plugin modules) |
| fast-glob fit for scan replacement | HIGH | API supports pattern arrays, ignore rules, sync/async modes |
| gray-matter fit for frontmatter migration | HIGH | Explicit parse + stringify APIs aligned with current frontmatter use |
| lru-cache fit for parser caches | HIGH | Bounded cache + ttl options map directly to current ad-hoc cache needs |
| net latency gain size | MEDIUM | Architecture is low-risk, but exact gains depend on benchmark distribution and workload mix |

---

## Sources

1. Repository architecture and hot paths:  
   - `src/router.js`  
   - `src/lib/helpers.js`  
   - `src/lib/frontmatter.js`  
   - `src/lib/cache.js`  
   - `src/plugin/index.js`  
   - `src/plugin/safe-hook.js`  
   - `src/plugin/parsers/state.js`  
   - `src/plugin/parsers/roadmap.js`
2. Context7 `fast-glob` docs: `/mrmlnc/fast-glob` (glob/globSync, ignore, absolute path behavior).
3. Context7 `gray-matter` docs: `/jonschlinkert/gray-matter` (parse/stringify, delimiters).
4. Context7 `lru-cache` docs: `/isaacs/node-lru-cache` (bounded cache options: max/ttl/maxSize).
5. Official OpenCode plugin docs: https://opencode.ai/docs/plugins/ (hook model, load order, custom tool naming/precedence implications).
6. Official Node SQLite docs: https://nodejs.org/api/sqlite.html (`node:sqlite` stability and `DatabaseSync` behavior).
