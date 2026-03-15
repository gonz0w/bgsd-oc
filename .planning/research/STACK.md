# Stack Research — SQLite-First Data Layer

**Domain:** Structured SQLite schema management, migrations, and query patterns for zero-dependency Node.js CLI
**Researched:** 2026-03-14
**Confidence:** HIGH (node:sqlite API verified via official Node.js docs v25.8.1, existing codebase patterns inspected)

<!-- section: compact -->
<stack_compact>
<!-- Compact view for planners. Keep under 25 lines. -->

**Core stack:** No new dependencies. Everything built on existing `node:sqlite` (DatabaseSync) already in `src/lib/cache.js`.

| Technology | Purpose | Version |
|------------|---------|---------|
| node:sqlite (DatabaseSync) | Structured tables, prepared statements, transactions | Node 22.5+ (Stability 1.2 RC) |
| SQLTagStore (createTagStore) | Cached prepared statements via tagged template literals | Node 24.9+ (fallback: db.prepare()) |
| PRAGMA user_version | Schema version tracking for migrations | SQLite built-in |

**Key patterns:** Version-gated migrations via `PRAGMA user_version`, inline SQL schema strings (no migration files), `db.exec()` for DDL, tagged templates for DML, `INSERT OR REPLACE` for upserts, `JSON_EXTRACT()` for structured data in TEXT columns, `BEGIN IMMEDIATE` transactions for batch writes.

**Avoid:** ORMs (knex, drizzle, sequelize — adds dependencies), better-sqlite3 (duplicates built-in), migration file systems (overkill for single-file deploy), WAL mode (unnecessary for single-process CLI), async SQLite APIs (CLI is synchronous).

**Install:** No installation needed — zero new dependencies.
</stack_compact>
<!-- /section -->

<!-- section: recommended_stack -->
## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| node:sqlite DatabaseSync | Node 22.5+ | Synchronous SQLite database access | Already in use for cache.js. Zero-dependency, built into Node.js, synchronous API matches CLI architecture. Stability 1.2 (Release Candidate) as of v25.7.0. |
| SQLTagStore (createTagStore) | Node 24.9+ | LRU-cached prepared statements via tagged template literals | Already used in cache.js for statement caching. Automatic parameterization prevents SQL injection. Cache reuses parsed SQL across invocations within a process. |
| PRAGMA user_version | SQLite built-in | Integer schema version number stored in database header | No tables needed. Atomic read/write. Survives database copy. Zero overhead. Standard pattern for embedded SQLite migrations. |
| STRICT tables | SQLite 3.37+ (2021-11) | Type enforcement on columns | Catches type errors at write time rather than silently coercing. Node.js bundles SQLite 3.45+ so STRICT is always available. |
| JSON1 extension | SQLite built-in | JSON_EXTRACT, JSON_SET for structured TEXT columns | Available by default in Node.js SQLite. Enables querying into JSON blobs stored in TEXT columns without full schema decomposition. |

### Supporting Patterns (No Libraries)

| Pattern | Purpose | When to Use |
|---------|---------|-------------|
| `BEGIN IMMEDIATE...COMMIT` wrapping | Batch write transactions | When inserting/updating multiple rows (e.g., populating all phases from ROADMAP.md parse). 10-100x faster than individual writes. |
| `INSERT OR REPLACE INTO` | Upsert pattern | When refreshing parsed data — re-parse overwrites stale rows. Simpler than INSERT...ON CONFLICT UPDATE for full-row replacement. |
| `INSERT...ON CONFLICT DO UPDATE SET` | Selective upsert | When only some columns should update (e.g., updating task status without touching task definition). |
| `CREATE INDEX IF NOT EXISTS` | Idempotent index creation | Always. Run alongside table creation so indexes exist from first use. |
| `statement.iterate()` | Memory-efficient row iteration | When processing large result sets (available since Node 23.4/22.13). Falls back to `.all()` on older Node. |
| Named parameters (`$name`, `:name`) | Readable parameterized queries | For complex queries with many parameters. `allowBareNamedParameters` is `true` by default. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `PRAGMA table_info(tableName)` | Schema introspection | Verify table structure in tests. Returns column name, type, notnull, default, pk. |
| `PRAGMA user_version` | Migration version check | `db.prepare('PRAGMA user_version').get()` returns `{user_version: N}`. Set with `db.exec('PRAGMA user_version = N')`. |
| `PRAGMA integrity_check` | Database health verification | Use in `bgsd-health` command. Returns `[{integrity_check: 'ok'}]` when healthy. |
| `.columns()` method | Statement column metadata | New in Node 23.11/22.16. Introspect column names, types, origin tables for debugging. |

## Installation

```bash
# No installation needed — zero new dependencies
# All capabilities come from node:sqlite (built into Node.js 22.5+)
# Existing fallback to Map backend (cache.js) covers Node < 22.5
```
<!-- /section -->

<!-- section: architecture_patterns -->
## Schema Management Pattern

### Version-Gated Inline Migrations

The recommended pattern for single-file CLI tools is **version-gated inline migrations** using `PRAGMA user_version`. No migration files, no migration table, no timestamp tracking.

```javascript
// Schema versions — each version is an idempotent migration function
const SCHEMA_VERSION = 3;

const MIGRATIONS = {
  // Version 1: Initial structured tables
  1: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS phases (
        number TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'incomplete',
        goal TEXT,
        plan_count INTEGER DEFAULT 0,
        depends_on TEXT,
        milestone_version TEXT,
        git_hash TEXT,
        updated_at REAL NOT NULL
      ) STRICT
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_phases_status ON phases(status)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_phases_milestone ON phases(milestone_version)`);
    // ... more tables
  },

  // Version 2: Add memory store tables
  2: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS decisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        phase TEXT,
        timestamp TEXT NOT NULL,
        context TEXT
      ) STRICT
    `);
    // ... more tables
  },

  // Version 3: Add session state
  3: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS session_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at REAL NOT NULL
      ) STRICT
    `);
  },
};

function migrateDatabase(db) {
  const { user_version: currentVersion } = db.prepare('PRAGMA user_version').get();

  if (currentVersion >= SCHEMA_VERSION) return; // Already up to date

  // Run all migrations from current+1 to target
  db.exec('BEGIN IMMEDIATE');
  try {
    for (let v = currentVersion + 1; v <= SCHEMA_VERSION; v++) {
      if (MIGRATIONS[v]) {
        MIGRATIONS[v](db);
      }
    }
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
```

**Why this pattern:**
- **No migration files to deploy** — migrations are code, bundled into the single CJS file
- **Idempotent** — `CREATE TABLE IF NOT EXISTS` means re-running is safe
- **Transactional** — entire migration is atomic; partial failure rolls back
- **Forward-only** — no downgrade migrations (CLI deploys forward; rollback = re-deploy previous version)
- **Version-gated** — each migration only runs once via `user_version` tracking
- **Zero dependencies** — uses only SQLite built-ins

### Key Constraints for This Project

1. **Migrations must be inline code** — no `.sql` files (single-file deploy via esbuild)
2. **Migrations run at database open** — lazy migration on first access, transparent to callers
3. **Existing `file_cache` and `research_cache` tables are untouched** — new tables coexist
4. **`CREATE TABLE IF NOT EXISTS` on every migration** — safe re-execution after crashes
5. **No `ALTER TABLE` for column renames** — SQLite doesn't support it well; create new table + copy instead

## Query Builder Pattern

### No ORM, No Query Builder Library — Tagged Template Literals

The `node:sqlite` `SQLTagStore` (createTagStore) IS the query builder. Tagged templates provide:
- Automatic parameterization (SQL injection prevention)
- Statement caching (prepared statement reuse)
- Clean readable syntax

```javascript
// EXISTING pattern from cache.js — already proven in production
const sql = db.createTagStore();

// Simple queries
const phase = sql.get`SELECT * FROM phases WHERE number = ${phaseNum}`;
const tasks = sql.all`SELECT * FROM tasks WHERE plan_id = ${planId} ORDER BY position`;

// Inserts
sql.run`INSERT OR REPLACE INTO phases (number, name, status, updated_at)
        VALUES (${num}, ${name}, ${status}, ${Date.now()})`;

// Complex queries with multiple params
const filtered = sql.all`
  SELECT t.*, p.name as plan_name
  FROM tasks t
  JOIN plans p ON t.plan_id = p.id
  WHERE t.status = ${status}
  AND p.phase_number = ${phaseNum}
  ORDER BY t.position
`;
```

**Fallback for Node < 24.9 (no createTagStore):**

```javascript
// Use db.prepare() directly — same API, no caching
const phase = db.prepare('SELECT * FROM phases WHERE number = ?').get(phaseNum);
const tasks = db.prepare('SELECT * FROM tasks WHERE plan_id = ? ORDER BY position').all(planId);
```

### Dynamic Query Building Without an ORM

For queries with optional filters (common in CLI commands), use SQL string concatenation with parameterized values:

```javascript
function queryTasks(db, filters = {}) {
  const conditions = ['1=1']; // Always-true base
  const params = [];

  if (filters.phase) {
    conditions.push('phase_number = ?');
    params.push(filters.phase);
  }
  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters.planId) {
    conditions.push('plan_id = ?');
    params.push(filters.planId);
  }

  const sql = `SELECT * FROM tasks WHERE ${conditions.join(' AND ')} ORDER BY position`;
  return db.prepare(sql).all(...params);
}
```

**Note:** Dynamic queries can't use `createTagStore` because the SQL string varies. Use `db.prepare()` for dynamic queries. This is fine — dynamic queries are infrequent (CLI commands) while hot-path queries (enricher, context builder) use fixed SQL via tag store.

## Database Architecture

### Separate Database Files vs Single Database

**Recommendation: Extend the existing `cache.db` file.**

Rationale:
- Existing `cache.db` already lives at `~/.config/oc/bgsd-oc/cache.db`
- Adding tables to the same file avoids managing multiple database connections
- Single `DatabaseSync` instance means single statement cache
- cache.js `SQLiteBackend` already handles directory creation and fallback
- Planning data tables simply coexist with `file_cache` and `research_cache`

**Alternative considered:** Separate `planning.db` per-project (in `.planning/`).
- Pro: Project-portable, git-ignorable, no cross-project pollution
- Con: Requires second DatabaseSync instance, doubles connection overhead
- **Verdict:** Use per-project database in `.planning/.cache/bgsd.db` for structured planning data. Keep `cache.db` for global file/research cache. Planning data is project-scoped by nature.

**Revised recommendation: Two database files, clear separation.**

| Database | Location | Content | Lifetime |
|----------|----------|---------|----------|
| `cache.db` | `~/.config/oc/bgsd-oc/cache.db` | file_cache, research_cache | Global, ephemeral |
| `bgsd.db` | `.planning/.cache/bgsd.db` | phases, plans, tasks, decisions, session_state, memory stores | Per-project, derived from markdown |

This separation is better because:
- Planning data is project-specific (parsed from `.planning/` markdown files)
- Global cache is cross-project (file content by path)
- Deleting `.planning/` cleanly removes all project data including derived SQLite
- `.planning/.cache/` is already gitignored
- Different invalidation strategies: cache = mtime-based, planning = git-hash-based

## Git-Hash Invalidation

### Detecting When Parsed Data Is Stale

Planning data in SQLite is derived from markdown files. When markdown changes (via git or manual edit), SQLite data must be refreshed.

```javascript
// Store source hash alongside parsed data
const HASH_TABLE = `
  CREATE TABLE IF NOT EXISTS source_hashes (
    file_path TEXT PRIMARY KEY,
    content_hash TEXT NOT NULL,
    parsed_at REAL NOT NULL
  ) STRICT
`;

function isStale(db, filePath, currentContent) {
  const hash = require('crypto').createHash('md5')
    .update(currentContent).digest('hex');
  const row = db.prepare(
    'SELECT content_hash FROM source_hashes WHERE file_path = ?'
  ).get(filePath);
  return !row || row.content_hash !== hash;
}

function markFresh(db, filePath, currentContent) {
  const hash = require('crypto').createHash('md5')
    .update(currentContent).digest('hex');
  db.prepare(
    'INSERT OR REPLACE INTO source_hashes (file_path, content_hash, parsed_at) VALUES (?, ?, ?)'
  ).run(filePath, hash, Date.now());
}
```

**Alternative: git commit hash.** Store the last git HEAD hash. If HEAD changes, invalidate everything. Simpler but coarser — any commit invalidates all data, even unrelated files.

**Recommendation:** Per-file content hashing for surgical invalidation. MD5 is fine (not security-sensitive, just change detection). Crypto is already a Node built-in used in the project.
<!-- /section -->

<!-- section: performance -->
## Performance Considerations

### Transaction Batching

**Critical for write performance.** SQLite without explicit transactions wraps each statement in its own transaction. For N inserts, that's N filesystem syncs.

```javascript
// BAD: 50 inserts = 50 transactions = 50 fsync calls (~500ms)
for (const phase of phases) {
  db.prepare('INSERT INTO phases ...').run(phase.number, phase.name);
}

// GOOD: 1 transaction = 1 fsync call (~5ms)
db.exec('BEGIN IMMEDIATE');
try {
  for (const phase of phases) {
    db.prepare('INSERT INTO phases ...').run(phase.number, phase.name);
  }
  db.exec('COMMIT');
} catch (e) {
  db.exec('ROLLBACK');
  throw e;
}
```

**Use `BEGIN IMMEDIATE` (not `BEGIN`).** IMMEDIATE acquires a RESERVED lock immediately, preventing deadlocks when another connection tries to write. For a single-process CLI this is technically unnecessary but costs nothing and is defensive.

### WAL Mode: Not Recommended

WAL (Write-Ahead Logging) mode benefits concurrent readers/writers. This CLI tool is:
- Single-process (no concurrent access)
- Short-lived (CLI invocation < 5s)
- Single-threaded (synchronous DatabaseSync)

WAL adds complexity (WAL + SHM sidecar files) with no benefit. Keep the default `journal_mode=DELETE`.

**Exception:** If the plugin (long-running process in the host editor) and the CLI tool need to access the same database simultaneously, WAL would be needed. But the recommendation is separate databases (plugin uses cache.db, CLI uses project-scoped bgsd.db), so this doesn't apply.

### Indexing Strategy

**Index columns used in WHERE, JOIN, and ORDER BY clauses.** For planning data:

```sql
-- Phases: queried by number (PK), status, milestone
CREATE INDEX IF NOT EXISTS idx_phases_status ON phases(status);
CREATE INDEX IF NOT EXISTS idx_phases_milestone ON phases(milestone_version);

-- Plans: queried by phase, status
CREATE INDEX IF NOT EXISTS idx_plans_phase ON plans(phase_number);
CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status);

-- Tasks: queried by plan, status, position ordering
CREATE INDEX IF NOT EXISTS idx_tasks_plan ON tasks(plan_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_plan_position ON tasks(plan_id, position);

-- Decisions: queried by phase, searched by text
CREATE INDEX IF NOT EXISTS idx_decisions_phase ON decisions(phase);

-- Session state: queried by key (PK — no additional index needed)
```

**Don't over-index.** Each index slows writes. For a dataset of <1000 rows total (typical planning project), full table scans are sub-millisecond anyway. Index only the columns that appear in hot-path WHERE clauses.

### Statement Caching Strategy

**Reuse the existing `createTagStore()` pattern** from cache.js. For the new structured database:

```javascript
class StructuredDB {
  constructor(dbPath) {
    const { DatabaseSync } = require('node:sqlite');
    this.db = new DatabaseSync(dbPath);
    this._migrate();

    // Create tag store for hot-path queries
    try {
      this.sql = this.db.createTagStore();
    } catch {
      this.sql = null; // Fallback: use db.prepare() directly
    }
  }

  getPhase(number) {
    if (this.sql) {
      return this.sql.get`SELECT * FROM phases WHERE number = ${number}`;
    }
    return this.db.prepare('SELECT * FROM phases WHERE number = ?').get(number);
  }
}
```

### Read Performance: Queries vs File Parsing

Expected improvement from SQLite over re-parsing markdown on every invocation:

| Operation | Current (md parse) | SQLite query | Speedup |
|-----------|-------------------|--------------|---------|
| Get current phase | Read + regex ROADMAP.md (~50KB) | `SELECT * FROM phases WHERE number = ?` | ~10-50x |
| List all tasks for plan | Read + XML parse PLAN.md (~5KB) | `SELECT * FROM tasks WHERE plan_id = ?` | ~5-20x |
| Get session state | Read + regex STATE.md (~2KB) | `SELECT * FROM session_state WHERE key = ?` | ~3-10x |
| List all decisions | Read + JSON.parse decisions.json | `SELECT * FROM decisions ORDER BY timestamp` | ~2-5x (similar) |
| Get enricher context | 3x listSummaryFiles + 2x parsePlans | Pre-computed queries | ~5-30x (eliminates duplication) |

Largest win: eliminating the 3x `listSummaryFiles` and 2x `parsePlans` duplication in the enricher hot path.
<!-- /section -->

<!-- section: alternatives -->
## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| node:sqlite DatabaseSync | better-sqlite3 | Never for this project — adds npm dependency, duplicates built-in capability |
| PRAGMA user_version migrations | knex migrations | Projects with multiple databases, team migrations, rollback needs |
| Tagged template literals (SQLTagStore) | kysely query builder | Projects needing type-safe SQL composition with TypeScript |
| Inline migration functions | .sql migration files | Projects deployed via package manager where file structure is preserved |
| Per-file content hashing | git pre-commit hooks | Projects where only committed changes matter (not WIP edits) |
| BEGIN IMMEDIATE transactions | WAL mode | Multi-process concurrent database access |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| better-sqlite3 | Adds native dependency, breaks single-file deploy, duplicates node:sqlite | node:sqlite DatabaseSync (built-in) |
| knex / drizzle / sequelize | Adds dependency, ORM overhead, overkill for ~10 tables | Raw SQL via db.prepare() and SQLTagStore |
| TypeORM / Prisma | Massive dependencies, async-only, schema file management | Raw SQL (tables are simple, queries are straightforward) |
| Migration file directories | Single-file deploy can't include .sql files | Inline migration functions gated by PRAGMA user_version |
| WAL journal mode | Creates WAL + SHM sidecar files, unnecessary for single-process CLI | Default DELETE journal mode |
| FTS5 (full-text search) | Over-engineering for <1000 rows of planning data | LIKE queries or application-level search |
| ATTACH DATABASE | Complexity of cross-database joins, locking coordination | Separate DatabaseSync instances when needed |
| Async node:sqlite (if added) | CLI is synchronous by design, async adds complexity | DatabaseSync (synchronous) |
<!-- /section -->

<!-- section: patterns -->
## Stack Patterns by Variant

**If adding tables to existing cache.db (simplest):**
- Extend `SQLiteBackend._initSchema()` in cache.js
- Add migration logic to existing constructor
- Pro: Single connection, existing fallback, minimal code change
- Con: Global database has project-specific data; cleanup is harder

**If using per-project database (recommended):**
- New `src/lib/db.js` module alongside cache.js
- Separate DatabaseSync instance opening `.planning/.cache/bgsd.db`
- Pro: Clean project isolation, gitignored, portable
- Con: Second database connection (negligible overhead for CLI lifetime)

**If data needs to be shared between plugin and CLI:**
- Plugin reads from project-scoped bgsd.db via `parseState(cwd)` pattern
- CLI writes to bgsd.db during operations
- Both use `timeout` option (added Node 24.0/22.16) for busy-wait
- Consider WAL mode ONLY if both access simultaneously

**If Node version < 22.5 (Map fallback):**
- Existing MapBackend pattern from cache.js applies
- Structured data falls back to current behavior (parse markdown every time)
- No SQLite tables created, no migration runs
- Feature-gate: `if (db) { queryFromSQLite() } else { parseFromMarkdown() }`
<!-- /section -->

<!-- section: compatibility -->
## Version Compatibility

| Feature | Minimum Node | Notes |
|---------|-------------|-------|
| DatabaseSync basic (prepare, exec, get, run, all) | 22.5.0 | Core API, available since introduction |
| statement.iterate() | 22.13.0 / 23.4.0 | Memory-efficient iteration, fallback to .all() |
| createTagStore() (SQLTagStore) | 24.9.0 | Statement caching via tagged templates. Fallback: db.prepare() |
| enableForeignKeyConstraints option | 22.5.0 | Enabled by default. Use for referential integrity. |
| database.isTransaction | 22.16.0 / 24.0.0 | Check if inside transaction. Useful for nested transaction guard. |
| timeout option (busy timeout) | 22.16.0 / 24.0.0 | Millisecond busy-wait for locked databases |
| database.isOpen | 22.15.0 / 23.11.0 | Check if connection is open |
| Symbol.dispose | 22.15.0 / 23.11.0 | Automatic cleanup with `using` keyword |
| statement.columns() | 22.16.0 / 23.11.0 | Column metadata introspection |
| STRICT tables | SQLite 3.37.0+ | Always available (Node bundles 3.45+) |
| JSON1 (JSON_EXTRACT, etc.) | SQLite 3.9.0+ | Always available (Node bundles 3.45+) |
| PRAGMA user_version | All SQLite versions | Always available |

### Critical Compatibility Note

The project's minimum Node version is 22.5+ (set in PROJECT.md constraints). The `package.json` still says `>=18` but that's stale. For the structured data layer:

- **Must work on Node 22.5+** — all DatabaseSync core APIs available
- **createTagStore() requires Node 24.9+** — use feature detection with fallback to db.prepare()
- **Cache.js already implements this fallback pattern** — reuse it

```javascript
// Pattern from existing cache.js — proven in production
try {
  this.sql = this.db.createTagStore();
} catch {
  this.sql = null;
}

// Usage with fallback
getPhase(number) {
  return this.sql
    ? this.sql.get`SELECT * FROM phases WHERE number = ${number}`
    : this.db.prepare('SELECT * FROM phases WHERE number = ?').get(number);
}
```

## Type Conversion Reference

From official Node.js docs (verified v25.8.1):

| SQLite Type | JavaScript Write | JavaScript Read |
|-------------|-----------------|-----------------|
| NULL | null | null |
| INTEGER | number or bigint | number (or bigint if readBigInts=true) |
| REAL | number | number |
| TEXT | string | string |
| BLOB | TypedArray or DataView | Uint8Array |

**Implications for planning data:**
- Use INTEGER for counts, positions, timestamps (as epoch ms)
- Use TEXT for names, descriptions, JSON blobs, ISO dates
- Use REAL for floating-point metrics only
- Boolean columns: store as INTEGER (0/1), read as number
- Arrays/objects: serialize to TEXT via JSON.stringify, query via JSON_EXTRACT()
- **Do NOT use BLOB** — all planning data is text-representable

## Sources

- [Node.js v25.8.1 SQLite documentation](https://nodejs.org/api/sqlite.html) — Full API reference, verified all features and version availability (HIGH confidence)
- `src/lib/cache.js` source inspection — Existing DatabaseSync usage, SQLTagStore pattern, MapBackend fallback (HIGH confidence)
- `src/plugin/parsers/*.js` source inspection — Current markdown parsing patterns that SQLite queries will replace (HIGH confidence)
- `src/commands/memory.js` source inspection — Current JSON file-based memory stores (decisions, lessons, trajectories, bookmarks) to migrate (HIGH confidence)
- `.planning/PROJECT.md` — Milestone goals, constraints, architecture decisions (HIGH confidence)
- SQLite documentation (sqlite.org) — PRAGMA user_version, STRICT tables, JSON1 extension, transaction behavior (HIGH confidence, stable API)

---
*Stack research for: SQLite-First Data Layer (v12.0 milestone)*
*Researched: 2026-03-14*
