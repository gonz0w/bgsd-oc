# Project Research Summary

**Project:** bGSD Plugin — v12.0 SQLite-First Data Layer
**Domain:** Structured SQLite schema management for zero-dependency Node.js CLI
**Researched:** 2026-03-14
**Confidence:** HIGH

<!-- section: compact -->
<compact_summary>
<!-- The compact summary is the DEFAULT view for orchestrators and planners.
     Keep it under 30 lines. Synthesizes all 4 research areas.
     Full sections below are loaded on-demand via extract-sections. -->

**Summary:** Transform SQLite from a dumb file cache into the structured data backbone for all workflow operations. The recommended approach uses `node:sqlite` DatabaseSync (already in production via cache.js) with version-gated inline migrations via `PRAGMA user_version`, per-project database at `.planning/.cache.db`, and a write-through cache pattern where markdown remains authority and SQLite is a derived query layer. The primary risk is stale cache from uncommitted edits, mitigated by hybrid git-hash + mtime invalidation.

**Recommended stack:** node:sqlite DatabaseSync (structured tables + prepared statements), PRAGMA user_version (schema versioning), SQLTagStore/createTagStore (statement caching with db.prepare() fallback), STRICT tables (type enforcement), JSON1 extension (querying JSON TEXT columns)

**Architecture:** Dual-store layered data access — markdown authority, SQLite query cache, Map L1 → SQLite L2 → markdown L3 hierarchy with DataStore class, modified parsers, accelerated enricher, and memory migrator

**Top pitfalls:**
1. **node:sqlite API drift** — feature-detect capabilities at runtime, use only v22.5 baseline API for core paths
2. **Schema migration in single-file deploy** — embed versioned migration array in code, use PRAGMA user_version, run on every db open
3. **Stale cache after uncommitted edits** — combine git-hash for cross-session staleness with mtime checks for within-session freshness
4. **Sacred data loss during memory migration** — never delete JSON files, two-phase migrate-then-verify, keep JSON as backup indefinitely
5. **Database locking under concurrent invocations** — WAL mode + busy timeout from day one

**Suggested phases:**
1. **Foundation & Schema** — DataStore class, migration runner, WAL/locking, capability detection (enables everything)
2. **Parser Integration & Invalidation** — Write-through cache for parsers, git-hash + mtime invalidation, file-watcher hookup
3. **Enricher Acceleration** — Replace 3x listSummaryFiles / 2x parsePlans with SQL queries, pre-computed enrichment cache
4. **Memory Store Migration** — decisions/lessons/bookmarks/trajectories from JSON to SQLite, sacred data protection
5. **Decision Rules & Session State** — New SQLite-backed decision rules, session state persistence, STATE.md as generated view

**Confidence:** HIGH | **Gaps:** Concurrent access stress testing needed; enricher V2 query design needs benchmarking against real projects
</compact_summary>
<!-- /section -->

<!-- section: executive_summary -->
## Executive Summary

The v12.0 milestone transforms SQLite from a simple file content cache (two tables in cache.js) into the structured data backbone for all bGSD workflow operations. Research confirms this is achievable using only the existing `node:sqlite` DatabaseSync API — zero new dependencies. The recommended architecture follows the "derived index" pattern used by tools like Turborepo and Jujutsu: markdown files remain the source of truth for all human-facing data, while SQLite provides a fast queryable index over parsed structures. A new `DataStore` class manages per-project databases at `.planning/.cache.db` (gitignored), separate from the global file cache.

The highest-impact deliverable is enricher acceleration: the current `command-enricher.js` calls `parsePlans()` 2x and `listSummaryFiles()` 3x on every command invocation, re-reading files that were already parsed. With structured SQLite tables, the enricher becomes a single SQL query on warm starts — estimated 5-30x speedup for the hot path. Schema versioning via `PRAGMA user_version` with inline migration functions (no migration files) fits the single-file deploy model perfectly.

The primary risks are cache staleness from uncommitted edits (mitigated by hybrid git-hash + mtime invalidation), sacred data loss during memory store migration (mitigated by keeping JSON backups indefinitely), and node:sqlite API drift between Node versions (mitigated by runtime capability detection using only the v22.5 baseline API for core paths). All risks have established mitigation patterns verified against the existing codebase.
<!-- /section -->

<!-- section: key_findings -->
## Key Findings

### Recommended Stack

No new dependencies. Everything builds on the existing `node:sqlite` DatabaseSync already proven in `src/lib/cache.js`. The stack leverages SQLite built-ins (PRAGMA user_version, STRICT tables, JSON1 extension) and Node.js built-ins (crypto for content hashing) exclusively.

**Core technologies:**
- **node:sqlite DatabaseSync**: Synchronous SQLite access — already in production, zero-dependency, matches CLI's synchronous architecture. Stability 1.2 (Release Candidate) as of Node v25.7.0.
- **PRAGMA user_version**: Integer schema version stored in database header — no migration tables needed, atomic read/write, zero overhead. Standard pattern for embedded SQLite applications.
- **SQLTagStore (createTagStore)**: LRU-cached prepared statements via tagged template literals — already used in cache.js. Requires Node 24.9+ with automatic fallback to `db.prepare()` for Node 22.5+.
- **STRICT tables**: Type enforcement at write time — catches coercion errors early. Available in all Node.js-bundled SQLite versions (3.45+).
- **JSON1 extension (JSON_EXTRACT, json_each)**: Query into JSON TEXT columns without full schema decomposition — built into Node.js SQLite, enables flexible querying of arrays and nested objects stored as TEXT.

**Key patterns:** Version-gated inline migrations, `BEGIN IMMEDIATE` transactions for batch writes, `INSERT OR REPLACE` for upserts, per-file content hashing for surgical cache invalidation, Map L1 → SQLite L2 → markdown L3 data hierarchy.

**What to avoid:** ORMs (adds dependencies), better-sqlite3 (duplicates built-in), migration file systems (incompatible with single-file deploy), WAL mode for global cache (unnecessary for single-process), async SQLite APIs (CLI is synchronous by design).

### Expected Features

**Must have (table stakes):**
- Structured planning tables (phases, plans, tasks, requirements, decisions) — eliminates re-parsing markdown on every CLI invocation
- Schema versioning with migration runner — forward-compatible upgrades without data loss
- Git-hash + mtime invalidation — ensures cached data stays fresh after edits and commits
- Enricher deduplication/acceleration — fixes 3x listSummaryFiles and 2x parsePlans calls
- Session state persistence — position and metrics in SQLite, STATE.md becomes generated view
- Backward-compatible Map fallback — graceful degradation on Node < 22.5

**Should have (differentiators):**
- Cross-entity SQL queries — "show decisions from phase X" via JOINs (impossible with JSON files)
- Memory store migration — decisions/lessons/bookmarks/trajectories from JSON to indexed SQLite tables
- Query-based decision inputs — decision rules consume SQL directly instead of enricher JSON
- Atomic multi-file updates — wrap related writes in transactions (prevents partial-write corruption)

**Defer (v2+):**
- FTS5 full-text search — current volumes (<1000 entries) don't justify overhead
- Materialized enrichment views with triggers — only when benchmarked as bottleneck
- WAL mode for parallel agent access — when multi-agent parallelism is attempted
- SQLite session/changeset tracking — when undo/redo or audit trail needed

### Architecture Approach

The target architecture adds a `DataStore` class as a unified SQLite access layer sitting between parsers and consumers. Parsers gain write-through persistence: on parse, they write structured rows to DataStore; on subsequent reads, they check DataStore validity before re-parsing. The enricher reads pre-computed data from DataStore instead of re-scanning files. Memory stores dual-write to both JSON (for git tracking) and SQLite (for indexed queries). Two database files with clear separation: global `cache.db` for file/research cache (unchanged), per-project `.planning/.cache.db` for structured planning data.

**Major components:**
1. **DataStore (NEW)** — Unified SQLite access: schema management, migrations, structured CRUD, git-hash + mtime invalidation. Located at `src/lib/datastore.js`.
2. **Modified Parsers (state.js, roadmap.js, plan.js)** — Write-through cache: parse markdown → persist rows to DataStore → read from DataStore when cache is valid.
3. **Enricher V2 (MODIFIED)** — Reads pre-computed counts and metadata from DataStore instead of re-parsing files. Eliminates 3x listSummaryFiles and 2x parsePlans duplication.
4. **MemoryMigrator (NEW)** — One-time migration of `.planning/memory/*.json` into SQLite tables with sacred data protection and round-trip verification.
5. **QueryAPI (NEW)** — SQL query functions replacing subprocess calls for CLI commands (count plans, filter decisions, aggregate metrics).

### Critical Pitfalls

1. **node:sqlite API drift between Node versions** — The API gained 15+ new methods between v22.5 and v22.22. Create a capability detection layer; use only v22.5 baseline API for core paths; wrap optional features (createTagStore, iterate, aggregate) behind runtime checks.

2. **Schema migration in single-file deploy** — `CREATE TABLE IF NOT EXISTS` is NOT a migration; it silently preserves old schemas missing new columns. Use `PRAGMA user_version` with an append-only migration array embedded in code. Never delete migrations. Test upgrades from version 0 AND every intermediate version.

3. **Stale cache after uncommitted file edits** — Git-hash invalidation is blind to working-directory changes. Use hybrid invalidation: git-hash for cross-session staleness, file mtime for within-session freshness. Always check source file mtime before trusting SQLite cache.

4. **Sacred data loss during memory store migration** — Never delete JSON files during migration. Two-phase approach: copy JSON → SQLite (additive), then verify round-trip equality for every entry. Only switch read path after verification passes.

5. **Database locking under concurrent invocations** — Plugin hooks, multiple terminals, and git hooks can trigger concurrent access. Enable WAL mode and set busy timeout from the very first database open. Test with 5 simultaneous CLI processes.
<!-- /section -->

<!-- section: roadmap_implications -->
## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation & Schema Design
**Rationale:** DataStore is the foundation all other components depend on. Schema versioning must exist before any structured tables are created. WAL mode and capability detection are prerequisites, not afterthoughts.
**Delivers:** DataStore class with schema management, migration runner, PRAGMA user_version tracking, WAL mode + busy timeout, node:sqlite capability detection layer, Map fallback guard pattern.
**Addresses:** Schema versioning (P1), backward-compatible fallback (P1)
**Avoids:** API drift (Pitfall 1), schema migration breakage (Pitfall 2), Map/SQLite divergence (Pitfall 3), database locking (Pitfall 6)

### Phase 2: Parser Integration & Cache Invalidation
**Rationale:** Parsers are the writers to DataStore — they must work before any consumers (enricher, CLI) can read. Invalidation strategy must be proven before caching derived data.
**Delivers:** Write-through cache for state/roadmap/plan parsers, git-hash + mtime invalidation logic, file-watcher integration with DataStore invalidation, structured tables for phases/plans/tasks.
**Uses:** DataStore (Phase 1), existing parser architecture, existing file-watcher
**Implements:** Write-through structured cache pattern, git-hash staleness detection
**Avoids:** Stale cache (Pitfall 5), enricher duplication creating new duplication (Pitfall 9)

### Phase 3: Enricher Acceleration
**Rationale:** Highest-impact single change — eliminates the hot-path duplication that affects every command invocation. Depends on parsers populating DataStore (Phase 2).
**Delivers:** Enricher V2 reading from DataStore, pre-computed enrichment cache table, elimination of 3x listSummaryFiles / 2x parsePlans, measurable latency reduction.
**Uses:** DataStore (Phase 1), populated tables (Phase 2)
**Implements:** Pre-computed enrichment view, single-query enrichment path

### Phase 4: Memory Store Migration
**Rationale:** Independent of enricher work, but depends on DataStore foundation. Sacred data protection makes this high-risk and requires careful migration with verification.
**Delivers:** SQLite tables for decisions/lessons/bookmarks/trajectories, one-time JSON import with round-trip verification, dual-write for ongoing sync, JSON backups preserved, cross-entity SQL queries.
**Uses:** DataStore (Phase 1), schema migration runner
**Avoids:** Sacred data loss (Pitfall 8), JSON-to-SQLite type coercion (Pitfall 4)

### Phase 5: Decision Rules & Session State
**Rationale:** Depends on enricher acceleration (Phase 3) for query-based inputs and parser integration (Phase 2) for session state. Most architecturally aggressive change (STATE.md becomes generated view).
**Delivers:** 6-8 new decision rules consuming SQLite-backed state, session state persistence in SQLite, STATE.md as generated view, QueryAPI for CLI commands.
**Uses:** DataStore (Phase 1), enricher V2 (Phase 3), structured tables (Phase 2)
**Implements:** Query-based decision inputs, session continuity across invocations

### Phase Ordering Rationale

- **Foundation first** (Phase 1): DataStore, migrations, and locking are prerequisites for everything. Building these first avoids retrofitting migration support later (a known pitfall).
- **Parsers before consumers** (Phase 2 before 3): The write-through pattern requires parsers to populate tables before the enricher can read from them. Invalidation must be proven before caching derived data.
- **Enricher is highest-impact** (Phase 3): Every `/bgsd-*` command triggers the enricher. Fixing the 3x/2x duplication delivers measurable latency reduction for all users.
- **Memory migration is independent** (Phase 4): Can theoretically run in parallel with Phase 3, but sacred data handling requires focused attention. Sequencing after enricher reduces risk.
- **Session state is most aggressive** (Phase 5): Changes the authority model for STATE.md from "source of truth" to "generated view." Should come last when the data layer is proven stable.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Complex integration across 6 parsers; need to verify write-through pattern doesn't break existing frozen object contracts
- **Phase 4:** Sacred data migration needs real-data testing; JSON entry shapes may vary across project histories

Phases with standard patterns (skip research-phase):
- **Phase 1:** Well-documented SQLite patterns (PRAGMA user_version, WAL mode), existing cache.js as template
- **Phase 3:** Clear target (eliminate duplication), existing enricher code well-analyzed
- **Phase 5:** Decision rules follow established pure-function pattern from v11.3
<!-- /section -->

<!-- section: confidence -->
## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies already in production (node:sqlite in cache.js). API verified against official Node.js v25.8.1 docs. Zero new dependencies. |
| Features | HIGH | Feature list derived directly from PROJECT.md v12.0 targets. Prioritization validated against codebase analysis of 6 parsers, enricher, and memory stores. |
| Architecture | HIGH | Architecture patterns verified against existing cache.js implementation. Write-through cache, Map fallback, and git-hash invalidation are extensions of proven patterns. |
| Pitfalls | HIGH | All pitfalls verified against existing codebase. API drift validated by comparing Node v22.5 and v25.x docs. Schema migration patterns from SQLite official docs. |

**Overall confidence:** HIGH

### Gaps to Address

- **Concurrent access stress testing:** WAL mode + busy timeout is the recommended pattern, but actual behavior under 5+ simultaneous CLI invocations on the per-project `.planning/.cache.db` has not been benchmarked. Validate during Phase 1 implementation.
- **Enricher V2 query design:** The exact SQL queries for pre-computed enrichment need benchmarking against real projects with 20+ phases and 50+ plans to verify the claimed 5-30x speedup. Design during Phase 3 planning.
- **Memory store entry shape variance:** Older projects may have decision/lesson entries with different field shapes than current format. Migration code needs to handle variable schemas gracefully. Investigate during Phase 4 planning.
- **Bundle size impact:** Research estimates 50-100KB growth. Actual impact depends on how SQL strings compress under esbuild minification. Monitor after each phase against the 1000KB budget.
<!-- /section -->

<!-- section: sources -->
## Sources

### Primary (HIGH confidence)
- Node.js v25.8.1 SQLite documentation — Full API reference, DatabaseSync, SQLTagStore, all feature availability dates
- Node.js v22.x SQLite documentation — Baseline API (Stability 1.1), minimum version compatibility
- SQLite official documentation (sqlite.org) — PRAGMA user_version, STRICT tables, JSON1, ALTER TABLE limitations, WAL mode
- Existing codebase analysis — cache.js (752 lines), command-enricher.js (340 lines), project-state.js (67 lines), 6 plugin parsers, decision-rules.js (467 lines), memory.js (378 lines), init.js memory store access
- PROJECT.md — v12.0 milestone goals, constraints, architecture decisions

### Secondary (MEDIUM confidence)
- Ben Johnson / Fly.io "All-In on Server-Side SQLite" (2022) — Architecture patterns for SQLite as application database
- Comparable tool analysis — Fossil SCM, Turborepo, Nx, Jujutsu patterns for SQLite-backed CLI tools

---
*Research completed: 2026-03-14*
*Ready for roadmap: yes*
<!-- /section -->
