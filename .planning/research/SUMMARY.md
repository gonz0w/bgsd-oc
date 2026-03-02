# Project Research Summary

**Project:** bGSD Plugin v8.0 — Performance & Agent Architecture
**Domain:** CLI tool optimization — SQLite caching, agent consolidation, command restructuring
**Researched:** 2026-03-01
**Confidence:** HIGH

<!-- section: compact -->
<compact_summary>
<!-- The compact summary is the DEFAULT view for orchestrators and planners.
     Keep it under 30 lines. Synthesizes all 4 research areas.
     Full sections below are loaded on-demand via extract-sections. -->

**Summary:** v8.0 adds a SQLite read cache for cross-invocation markdown parsing, consolidates 11 agents to 9, and groups CLI commands under ~12 namespaces. The primary recommendation is to use `node:sqlite` (Node.js built-in) with graceful fallback, bumping minimum Node to ≥22.5. The key risk is cache staleness — the cache must never override markdown as the source of truth.

**Recommended stack:** `node:sqlite` (DatabaseSync) for cache, `node:perf_hooks` (existing) for profiling, hand-rolled router (existing) for CLI dispatch — zero new npm dependencies

**Architecture:** Two-layer cache (in-memory Map L1 + SQLite L2) behind existing `cachedReadFile()` interface; mtime-based staleness; graceful degradation to Map-only on Node <22.5

**Top pitfalls:**
1. Native SQLite addon breaks single-file deploy — use `node:sqlite` built-in, not `better-sqlite3`
2. Cache becomes source of truth over markdown — mtime-based invalidation on every read, write-through invalidation on every mutation
3. Agent consolidation breaks workflow spawn chains — build dependency map BEFORE merging; alias-first migration

**Suggested phases:**
1. Cache Foundation — SQLite module with staleness detection and graceful fallback (must ship first)
2. Cache Integration — Wire into helpers.js/config.js; two-layer cache; verify 751 tests identical
3. Agent Consolidation — Merge integration-checker→verifier, synthesizer→roadmapper (11→9 agents)
4. Command Consolidation — Group commands under namespaces; alias old names; backward compat
5. Profiler & Performance Validation — Hot-path instrumentation; baseline comparison; prove speedup
6. Polish & Documentation — Cache warm-up, milestone docs, token budget enforcement

**Confidence:** HIGH | **Gaps:** `node:sqlite` stability (RC not Stable), optimal cache-vs-parse tradeoff needs benchmarking
</compact_summary>
<!-- /section -->

<!-- section: executive_summary -->
## Executive Summary

The v8.0 milestone targets three structural improvements to the bGSD CLI tool: (1) replacing the per-invocation in-memory Map cache with a persistent SQLite cache that survives process exit, (2) consolidating 11 agent definitions down to 9 by merging overlapping roles, and (3) grouping 40+ top-level CLI commands under ~12 namespaced parents. All four research streams converged on a clear recommendation: **use `node:sqlite` (Node.js built-in `DatabaseSync`) for the cache layer, requiring a minimum Node.js version bump to ≥22.5.** This adds zero npm dependencies, zero bundle size impact, and fits naturally into the existing esbuild externalization pattern (`external: ['node:*']`). The alternative — `better-sqlite3` — is the superior SQLite library in isolation, but its native C++ addon fundamentally breaks the single-file deploy model that `deploy.sh` relies on.

The architecture is conservative by design. The SQLite cache sits behind the existing `cachedReadFile()` interface as an L2 layer beneath the in-memory Map (L1). If `node:sqlite` is unavailable (user on Node 18-21), the system gracefully degrades to the current Map-only behavior — zero crashes, zero degradation. Markdown files remain the authoritative source of truth; the cache is a disposable read accelerator that can be nuked at any time via `gsd-tools cache clear`. The expected performance gain is 3-5x for repeated invocations (the common case during agent sessions), dropping `init execute-phase` from 15-25ms to 3-5ms on warm cache.

The key risks are cache coherence (stale data after external file edits), agent spawn reference breakage during consolidation, and command rename cascading through 751 tests and 27+ workflow files. All three are mitigatable with established patterns: mtime-based invalidation, dependency mapping before any agent removal, and alias-based command migration. The research is high-confidence across all four areas, drawing from official Node.js docs, Context7 library documentation, codebase analysis of all 34 source modules, and benchmarks run on the target platform.
<!-- /section -->

<!-- section: key_findings -->
## Key Findings

### Recommended Stack

No new npm dependencies are needed. The entire v8.0 stack change is a single Node.js built-in module (`node:sqlite`) plus refactoring of existing code.

**Core technologies:**
- **`node:sqlite` (DatabaseSync):** Persistent SQLite cache — synchronous API matches CLI's sync I/O model; zero bundle impact via existing `external: ['node:*']`; available since Node 22.5, Release Candidate (Stability 1.2) in Node 25.7. Requires bumping `package.json` engines from `>=18` to `>=22.5`.
- **`node:perf_hooks` (existing):** Performance profiling — already integrated in `src/lib/profiler.js`; needs sub-operation timing added to hot paths (markdown parsing, git ops, AST analysis), not a new library.
- **Hand-rolled CLI router (existing):** Command dispatch — 947-line router already implements lazy-loading, subcommand routing, flag parsing. Frameworks (Commander.js, yargs) rejected: add 50-200KB dependency for marginal benefit, require rewriting all 100+ command handlers.

**Critical technology decision — `node:sqlite` vs `better-sqlite3`:**

STACK.md recommended `better-sqlite3` for its mature API and proven performance. ARCHITECTURE.md and PITFALLS.md recommended `node:sqlite` for deployment simplicity. **This summary resolves the disagreement in favor of `node:sqlite`** because the single-file deploy constraint is non-negotiable — `deploy.sh` copies files without `node_modules/`, and adding native addon distribution would add platform-specific complexity to every deployment. The performance difference (<1ms for typical workloads) is immaterial for a CLI that reads <100 cached entries per invocation.

| Criterion | `node:sqlite` (Recommended) | `better-sqlite3` (Rejected) |
|-----------|----------------------------|------------------------------|
| Deploy model | Preserves single-file deploy | Breaks it — requires native .node addon copy |
| Bundle impact | 0KB (built-in) | 0KB bundle + ~10MB in node_modules |
| npm dependencies | Zero | One (with transitive deps) |
| Node.js minimum | ≥22.5 (bump required) | ≥14 (no bump needed) |
| API stability | RC (Stability 1.2) | Stable (mature) |
| Graceful fallback | try/catch → Map cache | try/catch → Map cache |

**What NOT to add:** sql.js (WASM, +1MB bundle), Commander.js/yargs (unnecessary framework), clinic.js (server profiler, wrong paradigm), knex/drizzle (ORM for 5 tables), lru-cache (Map works fine for <5s processes).

### Expected Features

**Must have (table stakes) — directly addresses v8.0 milestone goals:**
- **SQLite read cache with mtime-based staleness** — eliminates redundant markdown parsing across invocations
- **Cache invalidation on file write** — extend existing `invalidateFileCache()` to also clear SQLite entries
- **Agent responsibility matrix (RACI)** — documents which of 12 agents owns each lifecycle step
- **Deterministic agent context loading** — manifest-driven file assembly replaces ad-hoc conditional includes
- **Subcommand consolidation** — group 40+ top-level commands under ~12 namespaces with consistent grammar
- **Performance profiler hot-path coverage** — extend GSD_PROFILE to markdown parsing, git ops, AST analysis

**Should have (differentiators):**
- **Agent lifecycle gap/overlap audit** — automated report showing uncovered lifecycle steps
- **Milestone documentation generation** — auto-generate CHANGELOG section from git log + STATE.md
- **Baseline comparison reporting** — `gsd-tools profiler compare` to prove performance improvement
- **Command alias backward compatibility** — old names route to new subcommand homes with deprecation warnings

**Defer to v9+:**
- Full async I/O rewrite (wrong paradigm for <5s CLI)
- Agent self-spawning (caps at 12 agents by design)
- Cross-project cache sharing
- Parsed-result caching (validate raw-content caching first)

### Architecture Approach

The v8.0 architecture adds one new module (`src/lib/cache.js`, ~150-200 lines) and modifies 7 existing modules without changing the fundamental data flow. The cache is a transparent two-layer system: in-memory Map (L1, per-invocation) backed by SQLite (L2, cross-invocation), with mtime-based staleness checks costing <0.1ms per file.

**Major components:**
1. **SQLite Cache Layer (`src/lib/cache.js`)** — Singleton `DatabaseSync` connection, lazy-initialized on first cache-eligible read. Schema: `file_cache` (path, content, mtime_ms, size_bytes) + `parsed_cache` (key, value, depends_on) + `meta`. WAL mode. Falls back to null if `node:sqlite` unavailable.
2. **Agent Consolidation** — Merge `gsd-integration-checker` (446 lines) into `gsd-verifier` (adds cross-phase verification mode). Merge `gsd-research-synthesizer` (248 lines) into `gsd-roadmapper` (adds synthesis as first step). Result: 11→9 agents, ~550 lines eliminated.
3. **Command Consolidation** — New namespace groups (`config`, `search`, `session`, `test`, `context`). ~15-20 commands need relocating. Old names kept as aliases. Router stays switch-based.

### Critical Pitfalls

1. **Native SQLite addon breaks single-file deploy** — `better-sqlite3` requires a platform-specific `.node` binary that esbuild cannot bundle. Use `node:sqlite` (built-in) instead. If `node:sqlite` is unavailable, degrade to Map cache, not to a native addon.

2. **Cache becomes source of truth over markdown** — Persistent cache introduces staleness risk that didn't exist with per-invocation Map cache. Every cached read must check mtime. Every write must invalidate. Run full test suite with cache enabled AND disabled — results must be identical.

3. **Agent consolidation breaks workflow spawn chains** — Agent names are string references scattered across 41+ command wrappers and 27+ workflow files. Build complete dependency map BEFORE removing any agent definition. Rename-first, merge-second.

4. **Command rename breaks tests and consumers** — 751 tests, 27+ workflows, and 11 agent prompts reference CLI commands by string. Use alias-based migration: old names work as thin redirects, emit deprecation warning to stderr, remove in v9.0.

5. **`node:sqlite` experimental status** — API has changed between Node versions. Pin to stable API surface (`DatabaseSync`, `prepare`, `run`, `get`, `all`, `exec`). Graceful fallback on older versions. Test on Node 22 LTS and current Node.
<!-- /section -->

<!-- section: roadmap_implications -->
## Implications for Roadmap

Based on research, suggested phase structure (6 phases):

### Phase 1: Cache Foundation
**Rationale:** Every subsequent feature depends on the cache layer being correct. Technology choice (`node:sqlite` vs alternatives) gates all other cache work. Graceful degradation must be proven first.
**Delivers:** `src/lib/cache.js` module with open/close/get/set/invalidate; SQLite schema; mtime-based staleness; try/catch fallback to null; `.planning/.cache/` directory with .gitignore; `package.json` engines bump to `>=22.5`.
**Addresses:** SQLite cache module, cache staleness detection, cache invalidation on write
**Avoids:** P1 (native addon), P2 (cache as source of truth), P5 (node:sqlite experimental), P6 (schema coupling)

### Phase 2: Cache Integration & Verification
**Rationale:** Cache module exists but isn't wired in. This phase threads it through `helpers.js` and `config.js` — the two modules that do the most file reads. Must prove 751 tests pass identically with and without cache.
**Delivers:** Two-layer cache (Map L1 + SQLite L2) in `cachedReadFile()`, `loadConfig()`, `getPhaseTree()`, `getMilestoneInfo()`. Performance baselines before/after.
**Uses:** `node:sqlite` from Phase 1, existing `cachedReadFile()` interface
**Implements:** L1/L2 cache architecture from ARCHITECTURE.md
**Avoids:** P2 (stale data — verified by dual-mode testing)

### Phase 3: Agent Consolidation
**Rationale:** Independent of cache work — can parallelize with Phases 1-2. Agent merges are markdown file changes + manifest updates + workflow reference updates. Must be atomic (all references updated in same commit).
**Delivers:** 9 agents (down from 11). `gsd-verifier` gains cross-phase integration mode. `gsd-roadmapper` gains synthesis step. Updated `AGENT_MANIFESTS` in context.js. Updated workflows.
**Addresses:** Agent responsibility matrix, deterministic context loading
**Avoids:** P3 (spawn reference breakage — dependency map built first)

### Phase 4: Command Consolidation
**Rationale:** Depends on nothing but the existing router. Groups ~15-20 orphan commands under namespaces. Old names become aliases. Smallest blast radius when done with alias-first approach.
**Delivers:** ~12 namespaced command groups. `COMMAND_ALIASES` map in constants.js. Deprecation warnings on old names. Updated `COMMAND_HELP` entries.
**Addresses:** Subcommand consolidation, command alias backward compatibility
**Avoids:** P4 (rename breaks tests — aliases ensure both names work)

### Phase 5: Profiler & Performance Validation
**Rationale:** Must come AFTER cache integration (Phase 2) to measure actual improvement. Extends existing `profiler.js` — no new dependencies.
**Delivers:** Hot-path timing in helpers.js, git.js, ast.js, frontmatter.js. `gsd-tools profiler compare` command. Cache hit/miss rate reporting. Documented performance delta vs v7.1 baselines.
**Addresses:** Performance profiler hot-path coverage, baseline comparison reporting
**Avoids:** Performance regression going undetected

### Phase 6: Polish & DX Improvements
**Rationale:** Nice-to-have features that build on proven cache and agent foundation. Lower priority, higher value once the core is stable.
**Delivers:** Cache warm-up command (`gsd-tools cache warm`), agent lifecycle gap/overlap audit, milestone documentation generation, agent context token budget enforcement.
**Addresses:** Remaining differentiator features from FEATURES.md
**Avoids:** Over-building before core is validated

### Phase Ordering Rationale

- **Phase 1 before Phase 2:** Cache module must exist and have proven graceful degradation before being wired into the hot path of every CLI invocation.
- **Phase 2 before Phase 5:** Can't measure performance improvement until cache is integrated. Profiling without cache gives a false baseline.
- **Phase 3 independent of 1-2:** Agent consolidation is markdown + manifest changes. No code dependency on cache. Could run in parallel.
- **Phase 4 independent of 1-3:** Command consolidation is pure router refactoring. No dependency on cache or agent changes.
- **Phase 3 before Phase 6:** Agent lifecycle audit (Phase 6) depends on the RACI matrix defined during consolidation (Phase 3).
- **Phase 6 last:** Polish features have the lowest blast radius and depend on everything being stable first.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Cache Foundation):** Research `node:sqlite` API surface across Node 22.5→25.7; verify WAL mode behavior on target platforms; benchmark mtime vs hash-based staleness.
- **Phase 3 (Agent Consolidation):** Research the full spawn dependency graph — requires reading all 41 command wrappers and 27 workflow files to map every agent reference.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Cache Integration):** Well-established pattern — wiring a cache behind an existing interface. The `cachedReadFile()` contract is documented and tested.
- **Phase 4 (Command Consolidation):** Standard refactoring — add switch cases, keep old ones as aliases. The audit already identified all ~15-20 commands that need relocating.
- **Phase 5 (Profiler):** Uses existing `profiler.js` infrastructure. Adding `startTimer`/`endTimer` calls. No new patterns needed.
<!-- /section -->

<!-- section: confidence -->
## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All three tech choices verified via official docs + Context7. `node:sqlite` API tested on target platform (Node 25.7.0). `better-sqlite3` rejection has clear rationale. |
| Features | HIGH | Feature list derived from codebase audit of all 34 modules + existing AGENTIC-AUDIT.md. Dependency graph validated against actual import chains. |
| Architecture | HIGH | Architecture designed against actual module inventory. Integration points verified by reading source code. Benchmark data collected on target platform. |
| Pitfalls | HIGH | Sourced from esbuild docs (native addon limitation), Node.js docs (node:sqlite stability), codebase analysis, and prior v7.1 pitfall research. |

**Overall confidence: HIGH**

### Gaps to Address

- **`node:sqlite` long-term stability:** Currently Stability 1.2 (Release Candidate) — not yet Stable. Mitigation: abstraction layer in `cache.js`, graceful fallback to Map. Monitor Node.js release notes.
- **Cache-vs-parse tradeoff:** Research assumes caching raw file content (not parsed results) is sufficient. If regex parsing (not I/O) is the bottleneck, Phase 2 may need revision. Validate with benchmarks in Phase 5.
- **Node.js version adoption:** Bumping minimum from ≥18 to ≥22.5 may affect users on older LTS. Node 18 EOL was September 2025. Node 20 EOL is April 2026. The bump is reasonable but needs documentation.
- **STACK.md vs ARCHITECTURE.md disagreement:** STACK.md recommends `better-sqlite3`; ARCHITECTURE.md and PITFALLS.md recommend `node:sqlite`. Resolved in favor of `node:sqlite` because single-file deploy is non-negotiable. If `node:sqlite` proves unstable, fallback is enhanced Map cache with JSON persistence — NOT `better-sqlite3`.
<!-- /section -->

<!-- section: sources -->
## Sources

### Primary (HIGH confidence)
- Node.js v25.7.0 `node:sqlite` docs — Stability 1.2 RC, DatabaseSync synchronous API, available since v22.5.0
- better-sqlite3 Context7 docs (v12.6.2) — synchronous API, WAL mode, prepared statements, native addon architecture
- esbuild Context7 docs + issues #2674, #2830 — native .node addons cannot be bundled; must use external flag
- Existing codebase analysis — router.js (947 lines), helpers.js (946 lines), context.js (389 lines), init.js (1400+ lines), profiler.js (116 lines), all 11 agent definitions, build.js, deploy.sh
- Target platform benchmarks — node:sqlite 1000 reads in 2.9ms, 1000 inserts in 4.4ms

### Secondary (MEDIUM confidence)
- better-sqlite3 issue #1367 — Claude Code distribution pattern (external native dep)
- better-sqlite3 issue #1411 — Build failures on Node 25; native compilation fragility
- Commander.js/yargs feature comparison — bundle size analysis for CLI framework alternatives
- RACI matrix methodology (Asana) — responsibility assignment patterns for multi-agent systems

### Tertiary (needs validation)
- `node:sqlite` API stability across Node 22.5→25.7 — some options changed defaults (defensive mode). Pin API surface during implementation.
- WAL mode on network filesystems — SQLite docs warn about corruption. Needs platform detection if NFS support is required.

---
*Research completed: 2026-03-01*
*Ready for roadmap: yes*
