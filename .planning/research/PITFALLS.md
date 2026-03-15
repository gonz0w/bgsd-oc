# Pitfalls Research

**Domain:** Adding structured SQLite tables to an existing Node.js CLI tool (node:sqlite Stability 1.2)
**Researched:** 2026-03-14
**Confidence:** HIGH (verified against official Node.js docs for v22.x and v25.x, existing codebase analysis)

<!-- section: compact -->
<pitfalls_compact>
<!-- Compact view for planners. Keep under 25 lines. -->

**Top pitfalls:**
1. **node:sqlite API drift between Node versions** — pin minimum version, feature-detect new APIs like `createTagStore`/`prepare` options, wrap in try-catch (Schema design phase)
2. **Schema migration in single-file deploy** — embed versioned migration array in code, use `PRAGMA user_version`, run on every db open (Schema design phase)
3. **Map/SQLite behavioral divergence** — structured tables have NO Map equivalent; dual-backend only for cache layer, new tables are SQLite-only with graceful error on Node <22.5 (Schema design phase)
4. **JSON-to-SQLite data loss from type coercion** — SQLite has 5 types; arrays/booleans/nested objects need explicit serialization strategy per column (Migration phase)
5. **Stale parsed-data cache after markdown file edits** — git-hash invalidation alone is insufficient; combine mtime checks with content-hash for sub-second accuracy (Invalidation phase)
6. **Database locking in concurrent CLI invocations** — WAL mode + busy timeout prevent SQLITE_BUSY crashes (Schema design phase)
7. **Bundle size explosion from new table modules** — each structured table adds schema + queries + migration code; budget 50KB headroom (All phases)

**Tech debt traps:** schema-less TEXT blobs pretending to be structured, skipping foreign keys for speed, hardcoding column lists instead of using introspection, silencing all SQLite errors

**Security risks:** SQL injection in dynamic column/table names, unvalidated user data in decision/lesson stores, db file permissions too open

**"Looks done but isn't" checks:**
- Schema migration: verify upgrade FROM every prior version, not just current-1
- Map fallback: verify CLI still works fully on Node <22.5 (graceful degradation, not crash)
- Cache invalidation: verify editing a markdown file immediately reflects in next CLI invocation
- Memory store migration: verify sacred data (decisions, lessons) preserved with zero data loss
</pitfalls_compact>
<!-- /section -->

<!-- section: critical_pitfalls -->
## Critical Pitfalls

### Pitfall 1: node:sqlite API Drift Between Node Versions

**What goes wrong:**
Code written against Node 25.x APIs (`createTagStore`, `prepare(sql, options)`, `database.limits`, `database.aggregate`, `enableDefensive`, `setAuthorizer`) breaks on Node 22.5–22.12 where these don't exist. The project already uses `createTagStore()` (added in v24.9.0) — but the current code wraps it in try-catch. As v12.0 adds more structured table code, the surface area for version-dependent APIs expands dramatically.

Specific API gaps between v22.5 (minimum) and current Node versions:
- `createTagStore()` — added v24.9.0, not available in v22.x at all
- `database.prepare(sql, options)` — options parameter (readBigInts, returnArrays, etc.) added in v22.18.0+, not in v22.5
- `database.aggregate()` — added v22.16.0, not in v22.5–v22.15
- `database.isOpen` — added v22.15.0
- `database.isTransaction` — added v22.16.0
- `database.limits` — added v25.8.0 only
- `database.enableDefensive()` — added v25.1.0 only
- `defensive` constructor option — added v25.5.0 (default: true), absent in v22.x
- `timeout` constructor option — added v22.16.0
- `Statement.columns()` — added v22.16.0
- `Statement.iterate()` — added v22.13.0

**Why it happens:**
Stability 1.2 (Release Candidate) means the API is "feature complete" but still evolving across minor releases. The jump from v22.5 to v22.22 alone added 15+ new methods. Developers test on their current Node version and don't realize features aren't available on the minimum supported version.

**How to avoid:**
1. Create a capability detection layer: `sqliteCapabilities()` returning `{ hasTagStore, hasAggregate, hasTimeout, hasIterate, hasPrepareOptions }` based on actual feature probing (not version parsing)
2. All new structured table code must use only the v22.5 baseline API: `DatabaseSync`, `exec`, `prepare`, `StatementSync.get/all/run`
3. Wrap optional features (tag store, iterate, aggregate) behind capability checks
4. Add a CI matrix test running against Node 22.5 specifically (not just "latest")
5. Document which node:sqlite APIs are "safe baseline" vs "enhanced" in a capabilities map

**Warning signs:**
- Tests pass on developer machine but fail on CI with older Node
- `TypeError: db.createTagStore is not a function` in production
- Statement options silently ignored (no error, but behavior differs)
- Using `PRAGMA` features that require newer SQLite versions bundled with newer Node

**Phase to address:**
Schema design phase (first phase) — establish the API baseline before any structured tables are written.

---

### Pitfall 2: Schema Migration in Single-File Deploy

**What goes wrong:**
The CLI deploys as a single CJS file via `deploy.sh`. There's no migration runner, no version tracking, no schema diff tooling. When structured tables change between versions (adding columns, changing types, adding indexes), the existing `cache.db` on the user's machine has the old schema. `CREATE TABLE IF NOT EXISTS` doesn't add new columns — it silently succeeds with the old schema, and new code expecting those columns gets `undefined` values or INSERT failures.

Currently `cache.js` uses only `CREATE TABLE IF NOT EXISTS` with no versioning:
```sql
CREATE TABLE IF NOT EXISTS file_cache (key TEXT PRIMARY KEY, value TEXT, mtime REAL, ...)
CREATE TABLE IF NOT EXISTS research_cache (key TEXT PRIMARY KEY, value TEXT, ...)
```
This works for the current simple cache tables but will fail catastrophically when structured tables need to evolve.

**Why it happens:**
Schema migration tools (knex, prisma, drizzle) assume a project directory with migration files. Single-file CLIs can't ship migration directories. Developers forget that `CREATE TABLE IF NOT EXISTS` is NOT a migration — it only handles table creation, not table modification.

**How to avoid:**
1. Use `PRAGMA user_version` as the schema version tracker (integer, persisted in the .db file itself)
2. Embed migrations as a versioned array in the code:
   ```js
   const MIGRATIONS = [
     { version: 1, up: 'CREATE TABLE phases (...)' },
     { version: 2, up: 'ALTER TABLE phases ADD COLUMN status TEXT DEFAULT "pending"' },
     { version: 3, up: 'CREATE INDEX idx_phases_status ON phases (status)' },
   ];
   ```
3. Run migrations inside a transaction on every database open:
   ```js
   const current = db.prepare('PRAGMA user_version').get().user_version;
   for (const m of MIGRATIONS.filter(m => m.version > current)) {
     db.exec(m.up);
     db.exec(`PRAGMA user_version = ${m.version}`);
   }
   ```
4. **CRITICAL**: SQLite does NOT support `ALTER TABLE DROP COLUMN` before SQLite 3.35.0 (Node 22 ships 3.45+, so safe). But SQLite does NOT support `ALTER TABLE MODIFY COLUMN` at all. Column type changes require create-new-table-copy-data-drop-old-rename pattern.
5. Never delete migrations — the array is append-only
6. Test migration FROM version 0 (fresh install) AND from every intermediate version

**Warning signs:**
- "table X has no column named Y" errors after deploy
- Data silently missing because old schema doesn't have new columns
- Users reporting "works on fresh install, breaks on upgrade"
- Tests always use `:memory:` (fresh schema) and never test migration paths

**Phase to address:**
Schema design phase (first phase) — migration framework must exist before any tables are created.

---

### Pitfall 3: Map/SQLite Backend Divergence for Structured Data

**What goes wrong:**
The existing `CacheEngine` has clean dual-backend parity: `MapBackend` and `SQLiteBackend` expose identical `get/set/invalidate/clear` interfaces. This works because the cache is a simple key-value store. But v12.0's structured tables (phases, plans, tasks, requirements, decisions) need SQL queries: `SELECT * FROM tasks WHERE plan_id = ? AND status = 'pending'`, `JOIN` across tables, aggregate queries. There is no way to maintain a Map-based equivalent for relational queries without reimplementing a query engine.

**Why it happens:**
Developers assume the dual-backend pattern extends to all new SQLite usage. They try to build a Map-based "fallback" for structured queries, which either: (a) becomes a full in-memory database reimplementation, or (b) silently returns different results than the SQLite path, or (c) gets abandoned halfway, leaving broken code paths.

**How to avoid:**
1. **Accept that structured tables are SQLite-only.** The Map fallback exists for the file cache (backward compatibility). New structured data tables do NOT need a Map equivalent.
2. On Node <22.5: structured table features return graceful errors (`{ error: 'requires Node 22.5+', fallback: true }`) and the CLI falls back to the current markdown-parsing behavior.
3. The cache layer (`CacheEngine`) keeps its dual-backend for file/research caching.
4. New structured data gets its own module (e.g., `src/lib/data-store.js`) that requires SQLite directly and fails fast if unavailable.
5. Document the architecture split clearly:
   - **Cache layer** (cache.js): dual-backend, backward compatible
   - **Data layer** (data-store.js): SQLite-only, graceful degradation to markdown parsing

**Warning signs:**
- A `MapBackend` class growing methods like `queryByPlanId()` or `joinPhasesAndTasks()`
- Test files with `if (backend === 'map') skip()` scattered everywhere
- "TODO: implement map fallback" comments accumulating
- Different test suites for Map vs SQLite paths

**Phase to address:**
Schema design phase — architectural decision must be made before any structured table code is written. Document in KEY DECISIONS.

---

### Pitfall 4: JSON-to-SQLite Data Loss from Type Coercion

**What goes wrong:**
The memory stores (decisions.json, lessons.json, trajectories.json, bookmarks.json) contain nested JSON with arrays, booleans, objects, and mixed types. SQLite has 5 types: NULL, INTEGER, REAL, TEXT, BLOB. When migrating:
- JavaScript `true`/`false` → SQLite INTEGER 1/0 (but reading back gives `1`/`0`, not `true`/`false`)
- JavaScript arrays → must be JSON.stringify'd into TEXT (but what about querying array contents?)
- JavaScript `undefined` → SQLite NULL (but JSON.parse of NULL is not `undefined`)
- JavaScript objects → TEXT via JSON.stringify (nested querying impossible without JSON1 extension)
- JavaScript Date strings → TEXT (sortable only if ISO 8601 format)
- Large integers → may exceed JavaScript `Number.MAX_SAFE_INTEGER` (SQLite INTEGER is 64-bit)

Example from existing `decisions.json`:
```json
{
  "decision": "Use node:sqlite over better-sqlite3",
  "rationale": "Preserves single-file deploy",
  "tags": ["architecture", "dependency"],
  "confidence": "high",
  "timestamp": "2026-03-10T..."
}
```
The `tags` array needs a design decision: store as JSON TEXT, or normalize into a junction table?

**Why it happens:**
JSON is schemaless and JavaScript is dynamically typed. Developers map JSON fields directly to SQLite columns without thinking about round-trip fidelity. The data "looks right" on write but comes back wrong on read.

**How to avoid:**
1. Define explicit type mapping for every column before migration:
   - Scalars (string, number) → native SQLite types
   - Booleans → INTEGER with explicit `=== 1` on read
   - Arrays → JSON TEXT with `json_each()` for queries (SQLite JSON1 is built-in)
   - Objects → JSON TEXT with `json_extract()` for queries
   - Dates → TEXT in ISO 8601 (lexicographic sort works)
2. Write round-trip tests: `JSON → SQLite → JSON === original` for every store
3. Use `STRICT` tables where possible to catch type mismatches at write time
4. Consider a `_raw_json TEXT` column alongside structured columns for lossless storage during transition
5. **Sacred data protection**: decisions.json and lessons.json are marked "sacred" — migration MUST be reversible. Keep JSON files as backup until verified.

**Warning signs:**
- `typeof value === 'boolean'` checks failing after SQLite read
- Array fields returning as strings `"[\"a\",\"b\"]"` instead of arrays
- Tests comparing objects failing on `undefined` vs `null`
- Date sorting producing wrong order

**Phase to address:**
Schema design phase (type mapping) + Migration phase (round-trip verification).

---

### Pitfall 5: Stale Cache After Markdown File Edits

**What goes wrong:**
v12.0's core promise is "parsed roadmap, plan metadata, phase mappings survive between CLI invocations with git-hash invalidation." But git-hash invalidation has a fatal gap: **edits that haven't been committed yet.** User edits STATE.md or a PLAN.md file → runs a CLI command → gets stale data from SQLite because the git hash hasn't changed. The existing `file_cache` uses `mtime` comparison (line 148-149 of cache.js), but the new structured tables will parse and store derived data (task counts, completion status, phase mappings) that don't map 1:1 to a single file's mtime.

Additionally, the plugin parsers (state.js, roadmap.js, plan.js) each have their own `new Map()` caches that are per-process (lines 13 in each parser file). These Map caches and the SQLite cache can disagree if one is invalidated but not the other.

**Why it happens:**
Git-hash invalidation is elegant for committed state but blind to working-directory changes. Developers assume "git hash changed = data changed" when in reality the edit lifecycle is: edit file → CLI reads stale cache → user confused → commits → cache invalidates → next read correct. This means every edit has a stale window.

**How to avoid:**
1. **Two-level invalidation**: git-hash for cross-session staleness + file mtime for within-session staleness
2. For derived data (parsed phases, task status), store the source file's mtime AND content hash alongside the parsed result
3. On read: check source file mtime first (fast fs.statSync), only query SQLite if mtime matches
4. The plugin file-watcher already detects file changes — hook it into SQLite invalidation for specific tables
5. Consider a `source_files TEXT` column in each structured table storing the JSON array of files that contributed to that row, with their mtimes
6. **Invalidation cascade**: changing ROADMAP.md invalidates phases table, which cascades to plans, which cascades to tasks

**Warning signs:**
- Users reporting "I edited the file but the command shows old data"
- Inconsistency between `cat .planning/STATE.md` and `bgsd-tools state:show`
- Tests passing because they always start fresh but production having stale reads
- Plugin system prompt showing different data than CLI commands

**Phase to address:**
Invalidation strategy phase — after schema design but before any structured tables store derived data.

---

### Pitfall 6: Database Locking Under Concurrent Invocations

**What goes wrong:**
The CLI tool may be invoked concurrently: multiple terminal tabs, plugin hooks (idle-validator, file-watcher, stuck-detector), and manual CLI calls running simultaneously. SQLite's default journal mode uses exclusive locks — one writer blocks all readers. Without WAL mode and busy timeout, concurrent invocations get `SQLITE_BUSY` errors that manifest as mysterious "database is locked" crashes.

The current `cache.js` constructor doesn't set WAL mode or busy timeout:
```js
this.db = new DatabaseSync(this.dbPath);
this._initSchema();
```

**Why it happens:**
SQLite is often described as "serverless" — developers assume it handles concurrency like a server database. In reality, default SQLite is single-writer with file-level locking. CLI tools seem "single process" until you consider: editor plugin background hooks, multiple terminal sessions, git hooks, etc.

**How to avoid:**
1. Enable WAL mode immediately after opening: `this.db.exec('PRAGMA journal_mode=WAL')`
2. Set busy timeout (available since v22.16.0 as constructor option, use PRAGMA for v22.5):
   `this.db.exec('PRAGMA busy_timeout=5000')` — 5 seconds
3. Wrap all multi-statement operations in explicit transactions:
   ```js
   db.exec('BEGIN');
   try { /* operations */ db.exec('COMMIT'); }
   catch (e) { db.exec('ROLLBACK'); throw e; }
   ```
4. Use `INSERT OR REPLACE` (already done in cache.js) rather than SELECT-then-INSERT patterns
5. Keep transactions short — parse data in JavaScript, then do a single batch INSERT
6. Test concurrent access explicitly: spawn 10 CLI processes simultaneously, verify no SQLITE_BUSY

**Warning signs:**
- "database is locked" errors appearing sporadically
- Plugin hooks failing silently (caught by try-catch)
- Data corruption when editing files while CLI is running
- Tests never failing because they run serially

**Phase to address:**
Schema design phase — WAL mode and busy timeout must be set before any new tables are created. This is a prerequisite, not an afterthought.

---

### Pitfall 7: Test Suite Regression from SQLite Dependency

**What goes wrong:**
The existing 1008 tests don't test SQLite paths — there are zero test files for cache.js. When v12.0 adds structured tables that many commands depend on, the test suite faces several risks:
1. Tests that worked with markdown parsing now depend on SQLite initialization
2. Tests running on CI with Node <22.5 crash instead of using fallback paths
3. `:memory:` databases in tests don't exercise migration paths
4. Parallel test execution causes database file contention
5. Test isolation breaks — one test's SQLite writes affect another test

**Why it happens:**
The existing test suite tests CLI commands via `execFileSync` against fixture files. SQLite adds a stateful dependency that persists between test runs (the .db file). Developers add SQLite code to existing commands without updating the test strategy.

**How to avoid:**
1. **Every test file that touches SQLite must use `:memory:` databases** — never shared file-backed databases
2. Create a test helper: `createTestDb()` that returns an in-memory DatabaseSync with schema applied
3. Add explicit test categories: `--sqlite` flag to run SQLite-specific tests, default tests must pass without SQLite
4. Add a CI job running with `BGSD_CACHE_FORCE_MAP=1` to verify fallback paths
5. Migration tests must use temp file databases (not `:memory:`) to test the file-backed migration path
6. Test both "fresh install" (no db) and "upgrade" (existing db with old schema) scenarios
7. Aim for the new SQLite-specific tests to be isolated — don't modify existing passing tests

**Warning signs:**
- Test suite suddenly takes 3x longer (database I/O)
- Flaky tests that pass individually but fail in parallel
- `SQLITE_BUSY` errors in test output
- Tests leaking `.db` files in the test directory

**Phase to address:**
Schema design phase (test strategy) + every subsequent phase (test discipline).

---

### Pitfall 8: Sacred Data Loss During Memory Store Migration

**What goes wrong:**
decisions.json, lessons.json, and trajectories.json are marked as "sacred" — they're protected from compaction and represent accumulated project intelligence. Migrating this data to SQLite tables creates a one-way door: if the migration has bugs (wrong encoding, missing fields, truncated entries), the sacred data is corrupted with no recovery path. The current `memory.js` module explicitly protects these stores from compaction (line 9 of memory.js: `const SACRED_STORES = ['decisions', 'lessons', 'trajectories']`).

**Why it happens:**
Developers treat data migration as a one-shot operation: read JSON, write SQLite, delete JSON. They don't account for: partial failures (migration crashes halfway), encoding issues (Unicode in decision text), or field evolution (old entries have different shapes than new entries). Sacred data accumulated over months of project work is irreplaceable.

**How to avoid:**
1. **Never delete JSON files during migration.** Keep them as backup indefinitely.
2. Migration runs in two phases:
   - Phase A: Copy JSON → SQLite (additive only, JSON untouched)
   - Phase B: Verify SQLite content matches JSON exactly (round-trip test)
   - Only after Phase B passes does the system start reading from SQLite
3. Add a `migration_status` table tracking: `{ store, json_count, sqlite_count, verified_at, json_hash }`
4. On every startup, if JSON file mtime > last migration time, re-sync (handles manual JSON edits)
5. Provide a `memory:export --format=json` command that can reconstruct JSON from SQLite at any time
6. Schema must handle variable entry shapes — old entries may lack fields added in later versions

**Warning signs:**
- JSON file deleted before verification
- Sacred store counts differ between JSON and SQLite
- Migration has no rollback path
- Tests use synthetic data instead of real memory store fixtures

**Phase to address:**
Memory store migration phase — this is a dedicated phase because sacred data is irreplaceable.

---

### Pitfall 9: Enricher Duplication Fix Creating New Duplication

**What goes wrong:**
v12.0 targets "fix duplication (3x listSummaryFiles, 2x parsePlans)" in the enricher by pre-computing data from SQLite. But the fix can create a new form of duplication: SQLite tables storing data that's ALSO being parsed from markdown on every invocation. If the enricher reads from SQLite but other code paths still parse markdown directly, the system has two sources of truth that can disagree. The plugin parsers (state.js, roadmap.js, plan.js) each have their own Map caches — adding SQLite as a third caching layer creates three potential sources of disagreement.

**Why it happens:**
Incremental migration means both paths (markdown parsing and SQLite query) coexist for a period. Developers fix the enricher to use SQLite but forget that 15 other code paths still call `parseRoadmap()`, `parseState()`, `parsePlan()` directly. The enricher shows SQLite data, the CLI shows parsed markdown data, and they disagree.

**How to avoid:**
1. Define a clear data flow direction: **Markdown → Parser → SQLite → Consumers**
2. Parsers become the ONLY writers to SQLite structured tables
3. All consumers (enricher, CLI commands, plugin) read from SQLite, never parse markdown directly
4. Phase the migration by data type, not by consumer:
   - Phase A: phases table (roadmap data)
   - Phase B: plans/tasks tables (plan data)
   - Phase C: session state table (STATE.md data)
5. For each data type, migrate ALL consumers at once — no mixed reading
6. The plugin parsers' Map caches should be replaced by SQLite reads (not layered on top)

**Warning signs:**
- Different commands showing different completion percentages
- Plugin system prompt disagreeing with `bgsd-tools state:show`
- "Fixed in enricher but not in CLI" bugs
- Three cache layers: parser Map → CacheEngine Map/SQLite → structured tables SQLite

**Phase to address:**
Enricher acceleration phase — but the architecture decision must happen in schema design phase.

---

### Pitfall 10: Bundle Size Explosion

**What goes wrong:**
Each structured table needs: schema definition, migration SQL, query functions, type mapping, validation, and tests. The current bundle is 837KB against a 1550KB budget. Adding 6-8 new structured tables with their query layers can easily add 50-100KB to the bundle. If the data layer module is not carefully structured, it becomes the largest source file in the bundle (like `helpers.js` or `verify.js` today).

**Why it happens:**
SQL queries are verbose strings. Each table needs CRUD operations, each with multiple query variants (by id, by status, by parent, bulk insert, etc.). Developers write one module per table, each with inline SQL, creating many similar modules. The minifier can't compress SQL strings well.

**How to avoid:**
1. Use a shared query builder pattern — not an ORM, but helper functions that construct SQL from table metadata
2. Keep all SQL in a single `schema.js` module — colocated SQL is easier to minify and deduplicate
3. Monitor bundle size after every phase: `npm run build` already reports per-module sizes
4. Set a per-phase bundle budget: +30KB max per phase, never exceed 1000KB total
5. Reuse existing patterns: the current `db.prepare(SQL).run(params)` pattern is already compact

**Warning signs:**
- Build warnings about bundle size approaching budget
- New modules appearing in the >50KB warning list
- SQL strings duplicated across modules
- Data layer becoming larger than the entire commands directory

**Phase to address:**
All phases — monitor continuously. Set bundle size check in build.cjs.
<!-- /section -->

<!-- section: tech_debt -->
## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store everything as JSON TEXT blobs in SQLite | Fast migration, no schema design needed | Can't query individual fields, can't index, can't enforce constraints — just a slower JSON file | Never for structured data; OK for truly opaque blobs (e.g., raw research results) |
| Skip foreign keys between tables | Simpler schema, fewer migration headaches | Orphaned rows accumulate, data integrity degrades silently, queries return partial results | Only during initial development with plan to enable before shipping |
| Use `db.exec()` for all writes (no prepared statements) | Simpler code, no statement lifecycle management | SQL injection risk with dynamic values, no parameter binding, no statement caching | Never for user-supplied or variable data |
| Hardcode column lists in INSERT/SELECT | Works today, easy to understand | Every schema change requires updating multiple code locations | Only if you have a test that verifies columns match schema |
| Silence all SQLite errors with empty catch blocks | CLI never crashes, matches current cache.js pattern | Data silently lost, bugs invisible, corruption undetected | Only for cache layer (already established pattern); never for structured data |
| Test only with `:memory:` databases | Fast tests, no file cleanup needed | Migration paths never tested, file locking never tested, WAL mode behavior different | OK for unit tests; integration tests must use file-backed db |
| `CREATE TABLE IF NOT EXISTS` as migration strategy | Simple, no version tracking needed | Can never add columns, change types, add constraints, or create indexes after initial deploy | Only for the initial v12.0 release if you're confident the schema won't change (it will) |

## Integration Gotchas

Common mistakes when connecting SQLite structured tables to existing systems.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Plugin parsers (state.js, roadmap.js, plan.js) | Layering SQLite reads ON TOP of existing Map caches, creating 3 cache layers | Replace Map caches with SQLite reads; one source of truth |
| Enricher (command-enricher.js) | Fixing duplication by adding SQLite reads alongside existing `parsePlans()` calls | Route ALL enricher data through SQLite; remove direct parser calls |
| Memory stores (memory.js) | Migrating JSON→SQLite and deleting JSON files | Keep JSON as backup; add migration_status tracking; verify before switching read path |
| Build pipeline (build.cjs) | Not validating new SQLite-dependent code in smoke test | Add `BGSD_CACHE_FORCE_MAP=1` smoke test variant |
| File watcher (file-watcher.js) | Not invalidating SQLite structured tables when source markdown changes | Hook file-watcher events to table-specific invalidation |
| Decision rules (decision-rules.js) | Querying SQLite for every decision evaluation (12 rules × N invocations) | Pre-load decision inputs during enrichment phase, query SQLite once per invocation |
| esbuild bundler | `node:sqlite` in external array already — but new data layer modules may import patterns that esbuild doesn't tree-shake | Verify metafile analysis shows expected module sizes; avoid circular imports in data layer |
<!-- /section -->

<!-- section: performance -->
## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Running migrations on every CLI invocation | Startup time increases 50-200ms even when no migration needed | Check `PRAGMA user_version` first (single fast read), skip if current; cache version check result for process lifetime | Always — even a no-op `BEGIN; COMMIT` adds measurable latency |
| Parsing ALL markdown files into SQLite on first run | 10+ second startup on large projects (50+ plans, 20+ phases) | Lazy population: parse on demand, cache aggressively; background pre-population via plugin idle hooks | Projects with >20 plans across >5 phases |
| SELECT N+1 queries (fetch phases, then for each phase fetch plans, then for each plan fetch tasks) | CLI command goes from 50ms to 500ms+ as project grows | Use JOINs or batch queries; pre-compute common aggregations in summary views | Projects with >30 tasks across >5 plans |
| JSON.parse on every SQLite TEXT read | CPU spike when reading many rows with JSON columns | Parse lazily (only when field accessed); cache parsed results; consider storing frequently-queried fields as native SQLite columns alongside JSON blob | Tables with >100 rows with JSON columns |
| No indexes on query columns | Queries degrade from instant to noticeable at scale | Add indexes for: status columns, foreign keys, timestamp columns used in ORDER BY | Tables with >500 rows (not a concern initially but matters for decisions/lessons over time) |
| Opening database connection per CLI command | 10-30ms overhead per invocation for WAL mode sync + schema check | Module-level singleton pattern (current cache.js already does this); consider connection pooling for plugin | Every invocation — this is cumulative and noticeable |
<!-- /section -->

<!-- section: security -->
## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Dynamic table/column names from user input | SQL injection even with prepared statements (parameterization doesn't protect identifiers) | Whitelist table/column names; never interpolate user input into SQL identifiers |
| Database file with 0644 permissions | Other users on shared machines can read project decisions, lessons, trajectories — may contain sensitive project context | Create with `0600` permissions (owner read/write only); verify after creation |
| Storing unvalidated markdown in SQLite TEXT | Injection into generated STATE.md or SUMMARY.md views — malicious content in decisions could corrupt planning documents | Sanitize on write to SQLite, not just on read-back; validate against expected shapes |
| WAL file (.db-wal) and shared memory file (.db-shm) left behind | These contain recent writes in plaintext; `deploy.sh` or cleanup scripts might miss them | Include `*.db-wal` and `*.db-shm` in cleanup operations; `PRAGMA wal_checkpoint(TRUNCATE)` before backup/deploy |
| Sensitive data in SQLite without encryption | CLI db stored in `~/.config/oc/bgsd-oc/cache.db` — not encrypted, accessible to any process running as the user | Acceptable for this use case (planning metadata, not secrets); document that sensitive data should not be stored in decisions/lessons |
<!-- /section -->

<!-- section: ux -->
## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Silent fallback to markdown parsing when SQLite is unavailable | User doesn't know they're getting degraded performance; can't diagnose slow commands | Log once per session: "SQLite unavailable (Node <22.5), using markdown parsing (slower)" |
| Migration runs on first command, blocking the user | `bgsd-tools state:show` takes 5s instead of 50ms on first run after upgrade | Show progress: "Migrating planning data to SQLite (one-time, ~3s)..." |
| Schema corruption requires manual db deletion | User gets cryptic SQLite errors, has to find and delete cache.db manually | Add `cache:reset` command that safely recreates the database; auto-detect corruption and offer repair |
| Different data freshness between CLI and plugin | Plugin shows stale data, CLI shows current data (or vice versa) | Unified invalidation: both CLI and plugin read from same SQLite; file-watcher invalidates for both |
| Error messages expose SQLite internals | "SQLITE_CONSTRAINT: UNIQUE constraint failed: phases.number" is meaningless to users | Catch SQLite errors, translate to user-friendly messages: "Phase 3 already exists. Use --force to replace." |
<!-- /section -->

<!-- section: looks_done -->
## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Schema migration:** Often missing upgrade tests FROM prior versions — verify migration works from v0 (fresh) AND from each intermediate version, not just latest-1
- [ ] **Map fallback:** Often missing end-to-end test on Node <22.5 — verify `BGSD_CACHE_FORCE_MAP=1 node bin/bgsd-tools.cjs state:show` produces correct output
- [ ] **Cache invalidation:** Often missing "edit file then immediately query" test — verify modifying STATE.md and immediately running a CLI command reflects the edit
- [ ] **Sacred data migration:** Often missing round-trip verification — verify `JSON.parse(sqlite_row.value)` deep-equals original JSON for EVERY entry, including edge cases (Unicode, empty arrays, null fields)
- [ ] **Concurrent access:** Often missing multi-process test — verify spawning 5 simultaneous CLI invocations produces no SQLITE_BUSY errors
- [ ] **Bundle size:** Often missing post-migration size check — verify `npm run build` stays under 1000KB after all data layer code is added
- [ ] **Plugin integration:** Often missing system prompt consistency check — verify plugin's `buildSystemPrompt()` and CLI's `init:context` agree on current phase/plan/status
- [ ] **Error recovery:** Often missing corruption handling — verify deleting cache.db and running any command triggers clean recreation, not a crash
- [ ] **Deploy pipeline:** Often missing `deploy.sh` update — verify deployment copies no extra files and handles db-less installations
- [ ] **Existing tests:** Often missing regression check — verify all 1008 existing tests still pass after adding SQLite dependencies (especially with `BGSD_CACHE_FORCE_MAP=1`)
<!-- /section -->

<!-- section: recovery -->
## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Schema migration breaks | MEDIUM | Delete cache.db, let CLI recreate from scratch (data re-parsed from markdown). If sacred data in SQLite only: restore from JSON backup files |
| Data loss during memory migration | HIGH if JSON deleted, LOW if JSON preserved | If JSON backup exists: re-run migration from JSON. If not: attempt SQLite `.dump` recovery, manual data reconstruction from git history |
| API drift between Node versions | LOW | Feature-detect at runtime, fall back to baseline API. If new API was required: pin minimum Node version higher |
| Stale cache causing wrong behavior | LOW | `cache:clear` or delete cache.db. Fix: add mtime check to the affected table's read path |
| Database locking errors | LOW | Enable WAL mode + busy timeout. If db is corrupted from locking: delete and recreate |
| Bundle size over budget | MEDIUM | Audit per-module sizes via build-analysis.json, identify largest SQL modules, extract shared patterns, consider lazy loading |
| Test suite regression | MEDIUM | Bisect: run with `BGSD_CACHE_FORCE_MAP=1` to isolate SQLite-specific failures. Fix data layer or add proper mocking |
| Sacred data corruption in SQLite | HIGH | Restore from JSON backup. If no backup: extract from git history of `.planning/memory/*.json` files. Prevention: never delete JSON backups |
| Enricher data disagreement | LOW | Clear all caches, restart plugin. Fix: ensure single data flow direction (markdown → SQLite → consumers) |
| Concurrent access corruption | MEDIUM | `PRAGMA integrity_check` on the database. If corrupted: delete and recreate. Prevention: WAL mode + busy timeout + explicit transactions |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| API drift between Node versions | Schema design (first phase) | CI matrix includes Node 22.5; capability detection tested |
| Schema migration in single-file deploy | Schema design (first phase) | Migration test from v0 and each intermediate version passes |
| Map/SQLite backend divergence | Schema design (first phase) | Architecture documented; no Map fallback code for structured tables |
| JSON-to-SQLite type coercion | Schema design + Migration | Round-trip tests pass for every data type; STRICT tables used |
| Stale cache after markdown edits | Invalidation strategy | Edit-then-read test passes within same second |
| Database locking | Schema design (first phase) | WAL mode verified; concurrent 5-process test passes |
| Test suite regression | Every phase | 1008+ tests pass after each phase; `BGSD_CACHE_FORCE_MAP=1` CI job green |
| Sacred data loss | Memory store migration | JSON backups preserved; migration_status verified; round-trip equality confirmed |
| Enricher duplication | Enricher acceleration | No duplicate parsing calls; all consumers read from SQLite |
| Bundle size explosion | Every phase | Build stays under 1000KB; per-phase budget of +30KB enforced |
<!-- /section -->

<!-- section: sources -->
## Sources

- **Node.js v22.x SQLite docs** (Stability 1.1): https://nodejs.org/docs/latest-v22.x/api/sqlite.html — baseline API, active development
- **Node.js v25.x SQLite docs** (Stability 1.2): https://nodejs.org/api/sqlite.html — release candidate, shows API additions (`createTagStore`, `defensive`, `limits`, `aggregate`, `setAuthorizer`)
- **Existing codebase analysis**: `src/lib/cache.js` (752 lines), `src/commands/memory.js` (378 lines), plugin parsers, build.cjs, parity-check.js
- **SQLite documentation**: https://www.sqlite.org/pragma.html — PRAGMA user_version for schema versioning, PRAGMA journal_mode for WAL
- **SQLite ALTER TABLE limitations**: https://www.sqlite.org/lang_altertable.html — no MODIFY COLUMN, DROP COLUMN only in SQLite 3.35+
- **PROJECT.md**: v12.0 milestone goals, existing architecture decisions, constraints

---
*Pitfalls research for: Adding structured SQLite tables to bgsd-tools CLI (v12.0)*
*Researched: 2026-03-14*
