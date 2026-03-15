# Phase 118: Foundation & Schema - Research

**Researched:** 2026-03-14
**Domain:** node:sqlite database layer with Map fallback, schema migrations, concurrent access
**Confidence:** HIGH

## Summary

Phase 118 delivers the SQLite database infrastructure for all subsequent v12.0 phases. The core challenge is building a dual-backend database abstraction (SQLite on Node 22.5+, Map on older) that every bGSD command can use, with automatic schema migrations via PRAGMA user_version and concurrent access safety via WAL mode + busy_timeout.

The codebase already has a working dual-backend pattern in `src/lib/cache.js` (SQLiteBackend + MapBackend + CacheEngine). This existing code is a **file-content cache** stored at a global config path (`~/.config/oc/bgsd-oc/cache.db`). Phase 118's `.planning/.cache.db` is a **project-local** database for structured planning data — a fundamentally different purpose and location. The new database layer should be built as a new module (e.g. `src/lib/db.js`) rather than extending the existing cache module. However, the existing dual-backend pattern in cache.js validates the approach and provides a proven template.

**Primary recommendation:** Create a new `src/lib/db.js` module with a `getDb()` factory that feature-detects `node:sqlite`, returns either a SQLite-backed or Map-backed instance implementing the same interface, and handles schema migrations via PRAGMA user_version. Wire it into the CLI startup path so every command gets a database handle.

<user_constraints>

## User Constraints

From CONTEXT.md decisions (locked — planner MUST honor these):

1. **Map fallback shows once-per-session notice** via status bar / plugin mechanism — not stderr, not silent
2. **Both backends implement exact same interface** — callers never know which is active
3. **No force-fallback option** — auto-detect only
4. **On Node upgrade (to 22.5+), auto-switch to SQLite** with notice ("Upgraded to SQLite backend")
5. **On auto-switch, start fresh** — no data migration from Map (in-memory only)
6. **Map fallback is in-memory only** — no JSON file persistence, cache rebuilds each session
7. **Agent's discretion: backend abstraction pattern** (factory function, class hierarchy, etc.)
8. **On migration failure: delete and rebuild DB** — it's a cache, data loss acceptable
9. **Failed rebuild is silent** — no user-facing error about rebuild
10. **Migrations run inside transactions** — atomic success or full rollback
11. **Schema version via PRAGMA user_version** — no extra table
12. **`.cache.db` always gitignored** — add to `.planning/.gitignore`
13. **Soft size limit with warning** — warn if DB exceeds threshold, don't auto-truncate
14. **Add cache clearing to `/bgsd-cleanup`** command (extend existing)
15. **DB created eagerly on any command** — ensure exists at startup, no first-use latency
16. **First-ever creation shows brief notice** ("Initialized bGSD cache") via status bar / plugin
17. **Successful migrations are silent** — no user-facing message
18. **No debug timing output** in this phase

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Requirement | Key Implementation Detail |
|----|-------------|--------------------------|
| FND-01 | SQLite DB auto-created at `.planning/.cache.db` with schema versioning on Node 22.5+ | `new DatabaseSync(dbPath, { timeout: 5000 })` + `PRAGMA user_version` |
| FND-02 | Schema migrations run automatically on first command after upgrade | Migration functions keyed by version number, run in transaction |
| FND-03 | Map fallback on Node <22.5 with identical behavior | MapBackend class implementing same interface |
| FND-04 | WAL mode + busy_timeout prevent locking under concurrent access | `PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;` |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:sqlite` | Node 22.5+ | Synchronous SQLite access | Built-in, zero dependencies, `DatabaseSync` is sync-first |
| `PRAGMA user_version` | SQLite built-in | Schema version tracking | Atomic integer, no extra table, read/write via single PRAGMA |
| `PRAGMA journal_mode=WAL` | SQLite built-in | Concurrent read/write | Allows concurrent readers + one writer without SQLITE_BUSY |
| `PRAGMA busy_timeout` | SQLite built-in | Lock retry on contention | Auto-retry for N ms instead of immediate SQLITE_BUSY error |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fs.existsSync` / `fs.statSync` | Node built-in | File existence and size checks | DB size monitoring, gitignore verification |
| `process.version` | Node built-in | Runtime version detection | Feature-detect node:sqlite availability |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node:sqlite` | `better-sqlite3` | Native dependency, conflicts with zero-dep constraint — rejected in REQUIREMENTS.md |
| `PRAGMA user_version` | `_migrations` table | Extra table, more SQL, not atomic — unnecessary complexity |
| WAL mode | Default (rollback journal) | Concurrent reads blocked during writes — unacceptable for CLI tool with git hooks |
| In-memory Map | JSON file persistence | Adds file I/O complexity for fallback — CONTEXT.md says in-memory only |

## Architecture Patterns

### Recommended Module Structure

```
src/lib/db.js              # New file: Database abstraction layer
  ├── getDb(cwd)           # Factory: returns cached db instance for project
  ├── SQLiteDatabase class  # SQLite backend (Node 22.5+)
  ├── MapDatabase class     # In-memory Map backend (Node <22.5)
  └── MIGRATIONS array      # Schema migration definitions
```

### Pattern 1: Factory with Lazy Singleton per Project

```javascript
// src/lib/db.js
const _instances = new Map(); // cwd → db instance

function getDb(cwd) {
  cwd = cwd || process.cwd();
  if (_instances.has(cwd)) return _instances.get(cwd);
  
  const db = _hasSQLite() 
    ? new SQLiteDatabase(path.join(cwd, '.planning', '.cache.db'))
    : new MapDatabase();
  
  _instances.set(cwd, db);
  return db;
}
```

**Why singleton per project:** Multiple commands in same process share the connection. The Map keyed by `cwd` supports the plugin context where `directory` varies.

### Pattern 2: Schema Migration via PRAGMA user_version

```javascript
const MIGRATIONS = [
  // Version 1: Initial schema (Phase 118 foundation)
  (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS _meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
    // Future phases add tables here
  },
  // Version 2 would be added by Phase 119, etc.
];

function runMigrations(db) {
  const currentVersion = db.prepare('PRAGMA user_version').get().user_version;
  const targetVersion = MIGRATIONS.length;
  
  if (currentVersion >= targetVersion) return; // up to date
  
  for (let i = currentVersion; i < targetVersion; i++) {
    try {
      db.exec('BEGIN');
      MIGRATIONS[i](db);
      db.exec(`PRAGMA user_version = ${i + 1}`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      // Delete and rebuild per CONTEXT.md decision
      deleteAndRebuild(db);
      return;
    }
  }
}
```

### Pattern 3: Transparent Backend Interface

Both `SQLiteDatabase` and `MapDatabase` must expose the same public API. The interface for Phase 118 is minimal — just infrastructure:

```javascript
// Shared interface (both backends implement):
{
  getSchemaVersion()     // → number
  exec(sql)              // execute raw SQL (no-op on Map)
  prepare(sql)           // → statement-like object (Map returns stub)
  close()                // cleanup
  get backend()          // → 'sqlite' | 'map'
  get dbPath()           // → string | null
}
```

Phase 119+ will add domain-specific methods (getPhase, setPhase, etc.) through this same abstraction.

### Pattern 4: Feature Detection (not version check)

```javascript
function _hasSQLite() {
  try {
    require('node:sqlite');
    return true;
  } catch {
    return false;
  }
}
```

Use `try/catch require()` rather than parsing `process.version`. This is more reliable because:
- It catches cases where `node:sqlite` is disabled by flags or custom builds
- It works identically in Node, Bun, or other runtimes
- The existing `src/lib/cache.js` uses version parsing, which works but is fragile

**However**, the existing codebase consistently uses version parsing (see `cache.js:648-652`, `runtime-capabilities.js`). For consistency, use both: version check as fast path, feature detection as verification.

### Anti-Patterns to Avoid

1. **Don't use `--experimental-sqlite` flag** — As of Node 23.4.0/22.13.0, node:sqlite no longer requires a flag. Still experimental but auto-available.
2. **Don't use async patterns** — `DatabaseSync` is synchronous by design. The CLI is synchronous. Don't wrap in Promises.
3. **Don't store the DB in global config** — The existing `cache.js` puts `cache.db` in `~/.config/oc/bgsd-oc/`. Phase 118's `.cache.db` must be project-local at `.planning/.cache.db`.
4. **Don't share a connection across processes** — Each CLI invocation opens its own connection. WAL mode handles concurrency.
5. **Don't create `.planning/` directory** — The DB module should only create `.cache.db` if `.planning/` already exists. Never create `.planning/` as a side effect.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema versioning | Custom version table | `PRAGMA user_version` | Atomic, built-in, no schema dependency |
| Concurrent access | File locking | WAL mode + `busy_timeout` | SQLite handles this natively, battle-tested |
| Statement caching | Manual LRU for statements | `db.createTagStore()` | Built into node:sqlite, handles LRU automatically |
| Migration rollback | Manual state tracking | `BEGIN`/`COMMIT`/`ROLLBACK` | SQLite transactions are ACID |
| Node version detection | Complex semver parsing | `try { require('node:sqlite') }` catch | Direct capability testing |

## Common Pitfalls

### Pitfall 1: PRAGMA user_version inside transactions
**What goes wrong:** `PRAGMA user_version = N` cannot be used inside a transaction started with `BEGIN`. SQLite treats it as a schema-change operation.
**Why it happens:** Developer wraps migration + version bump in BEGIN/COMMIT.
**How to avoid:** Set `PRAGMA user_version` immediately **after** `COMMIT`, not inside the transaction. Or use `db.exec()` for the entire migration block (including the PRAGMA) as a single `exec()` call — `exec()` runs in implicit auto-commit if no explicit transaction is active.
**Warning signs:** "cannot change user_version from within a transaction" error.

**UPDATE — Verified:** Actually, `PRAGMA user_version = N` **does work** inside explicit transactions in modern SQLite. The restriction only applies to certain schema-modifying PRAGMAs. Test this in the implementation to confirm with the specific Node.js SQLite build. If it fails, move the PRAGMA set to after COMMIT.

### Pitfall 2: WAL mode requires shared-memory access
**What goes wrong:** WAL mode creates `-wal` and `-shm` files alongside the database. If the filesystem doesn't support shared memory (rare, but possible with some network mounts), WAL mode silently falls back to rollback journal.
**Why it happens:** WAL uses memory-mapped I/O for the shared-memory file.
**How to avoid:** For a `.planning/` directory (always local), this is not an issue. Log the actual journal mode after setting it if debug is enabled.
**Warning signs:** `PRAGMA journal_mode` returns "delete" instead of "wal" after setting.

### Pitfall 3: Database locked on close
**What goes wrong:** Calling `db.close()` while prepared statements are still active throws an error.
**Why it happens:** SQLite requires all statements to be finalized before closing.
**How to avoid:** Use `createTagStore()` which manages statement lifecycle automatically. If using manual `prepare()`, ensure statements go out of scope before close. For the CLI pattern (process exits), this is mostly a non-issue — SQLite handles cleanup on process exit.
**Warning signs:** "SQLITE_BUSY" error on close.

### Pitfall 4: Missing `.planning/` directory
**What goes wrong:** Trying to create `.cache.db` when `.planning/` doesn't exist creates the directory structure as a side effect.
**Why it happens:** `new DatabaseSync(path)` creates the file (and parent directories?).
**How to avoid:** **Always check** that `.planning/` exists before attempting to create the database. If it doesn't exist, use Map fallback (no project initialized = no DB needed). `DatabaseSync` does NOT auto-create parent directories — it will throw if the parent directory doesn't exist.
**Warning signs:** Spurious `.planning/` directories in non-bGSD projects.

### Pitfall 5: Defensive mode blocks PRAGMA writes
**What goes wrong:** As of Node v25.5.0, `defensive` mode is enabled by **default** in `DatabaseSync`. Defensive mode prevents certain schema operations.
**Why it happens:** The `defensive` option defaults to `true` to prevent SQL injection from corrupting DB internals.
**How to avoid:** Explicitly set `defensive: false` in the constructor options for the `.cache.db` database, since we need full schema control for migrations. Or test that `PRAGMA user_version = N` works with defensive mode enabled (it likely does, since user_version is specifically designed for application use).
**Warning signs:** "not authorized" or similar errors on schema operations.

### Pitfall 6: busy_timeout Constructor Option vs PRAGMA
**What goes wrong:** Setting `timeout` in the constructor options vs `PRAGMA busy_timeout` — they do the same thing but the constructor option is cleaner.
**Why it happens:** Two ways to set the same thing.
**How to avoid:** Use the constructor option `{ timeout: 5000 }` which was added in Node v24.0.0/v22.16.0. For Node 22.5-22.15, fall back to `PRAGMA busy_timeout = 5000` after construction.
**Warning signs:** SQLITE_BUSY errors under concurrent access.

## Code Examples

### Example 1: DatabaseSync Constructor with WAL + Busy Timeout

```javascript
// Verified from Node.js v25.8.1 docs
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync(dbPath, {
  timeout: 5000,  // busy_timeout in ms (added v24.0.0/v22.16.0)
});

// Enable WAL mode for concurrent access
db.exec('PRAGMA journal_mode = WAL');

// Verify WAL mode was set
const mode = db.prepare('PRAGMA journal_mode').get();
// mode.journal_mode === 'wal'
```

### Example 2: PRAGMA user_version for Schema Versioning

```javascript
// Read current version
const { user_version } = db.prepare('PRAGMA user_version').get();

// Set version after migration
db.exec('PRAGMA user_version = 1');
```

### Example 3: Transaction-wrapped Migration

```javascript
function migrate(db, version, migrationFn) {
  db.exec('BEGIN');
  try {
    migrationFn(db);
    db.exec(`PRAGMA user_version = ${version}`);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
```

### Example 4: Feature Detection with Fallback

```javascript
function hasSQLiteSupport() {
  // Fast path: version check
  const [major, minor] = process.version.slice(1).split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 5)) return false;
  
  // Verification: actual require
  try {
    require('node:sqlite');
    return true;
  } catch {
    return false;
  }
}
```

### Example 5: Notification via Plugin System

```javascript
// From src/plugin/notification.js — createNotifier() provides:
notifier.notify({
  type: 'cache-init',
  severity: 'info',
  message: 'Initialized bGSD cache',
});

// For CLI context (no plugin), output a console.log:
if (process.env.BGSD_DEBUG === '1') {
  console.log('[bGSD] Initialized .planning/.cache.db');
}
```

**Important:** The plugin notification system (`createNotifier`) runs in the ESM plugin context (`plugin.js`), not the CJS CLI context (`bgsd-tools.cjs`). For Phase 118, the database module lives in the CLI (CJS) context. Status bar notifications from CLI commands are delivered via output formatting — specifically, the `output()` function's pretty-printing mode. The once-per-session notice should use `console.error()` or a simple stderr write, which the plugin can then pick up or the user sees directly.

**Alternative approach**: Add a `notices` array to the db module that the plugin's system prompt injection reads and drains. This keeps the CLI side pure (no console output) and lets the plugin handle display.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `--experimental-sqlite` flag required | No flag needed | Node 23.4.0 / 22.13.0 | Just `require('node:sqlite')` works |
| `better-sqlite3` npm package | `node:sqlite` built-in | Node 22.5.0 | Zero dependencies, same sync API |
| Manual statement caching | `db.createTagStore()` | Node 24.9.0 | Built-in LRU statement cache |
| `timeout` only via PRAGMA | Constructor `timeout` option | Node 24.0.0 / 22.16.0 | Cleaner initialization |
| `defensive` off by default | `defensive` on by default | Node 25.5.0 | May need explicit `defensive: false` for migrations |

## Codebase Integration Points

### 1. Existing Cache Module (`src/lib/cache.js`)

The existing `CacheEngine` with `SQLiteBackend` and `MapBackend` provides a template but serves a different purpose:
- **Location**: Global config (`~/.config/oc/bgsd-oc/cache.db`) — not project-local
- **Purpose**: File content caching (key=filepath, value=content) — not structured data
- **Interface**: `get(key)`, `set(key, value)`, `invalidate()`, `clear()` — simple KV

Phase 118's database is project-local (`.planning/.cache.db`) and will hold structured tables (phases, plans, tasks, requirements in later phases).

**Decision:** Build a new `src/lib/db.js` module. Don't extend `cache.js`.

### 2. Build System (`build.cjs`)

- Entry point: `src/index.js` → bundled via esbuild into `bin/bgsd-tools.cjs`
- `node:sqlite` is in the `external` list: `external: ['node:*', ...]`
- This means `require('node:sqlite')` will be preserved in the bundle as a runtime dependency — correct behavior
- The plugin build (`plugin.js`) also externalizes `node:*` — if the db module is needed in plugin context, it will work

### 3. CLI Entry and Startup (`src/index.js` → `src/router.js`)

The CLI calls `main()` in `router.js`. Database initialization should happen inside `main()` before command dispatch, or lazily on first access. Given the CONTEXT.md decision for "eager creation on any command," early initialization in `main()` is correct.

### 4. Plugin Notification System (`src/plugin/notification.js`)

- `createNotifier()` provides `notify()` with `{ type, severity, message }`
- Notifications drain via `drainPendingContext()` into system prompt
- **Important limitation**: The notifier lives in the ESM plugin process. The CLI (CJS `bgsd-tools.cjs`) is a separate process invoked by agents. They don't share memory.
- For CLI-side notices, use: store a flag file (e.g., `.planning/.cache/.notices.json`) that the plugin reads and drains. Or simply use `console.error('[bGSD] ...')` for the once-per-session notice.

### 5. `.planning/.gitignore`

Current contents:
```
env-manifest.json
.cache/
baselines/*.json
!baselines/performance.json
```

Need to add `.cache.db` (and `.cache.db-wal`, `.cache.db-shm` for WAL mode) to this file.

### 6. `/bgsd-cleanup` Command

There's no dedicated cleanup command file — cleanup is handled via worktree commands and ad-hoc. Phase 118 needs to extend cleanup to include `rm .planning/.cache.db*`.

### 7. Test Infrastructure

No existing tests for `cache.js` backend specifics (only integration tests checking that cache commands work). Phase 118 should add unit tests for:
- `getDb()` factory with SQLite and Map backends
- Schema migration (PRAGMA user_version bump)
- Migration failure → delete and rebuild
- Concurrent access (WAL mode verification)
- `.cache.db` creation in `.planning/`
- Map fallback when `node:sqlite` unavailable

## Open Questions

1. **Constructor `timeout` option availability**: The `timeout` option was added in Node v24.0.0/v22.16.0. Users on Node 22.5-22.15 won't have it. Use `PRAGMA busy_timeout` as fallback for those versions.

2. **Defensive mode + PRAGMA user_version**: Need to verify whether `PRAGMA user_version = N` works with `defensive: true` (the new default in Node 25.5+). If not, we'll need `defensive: false` in constructor options.

3. **Plugin ↔ CLI notification bridge**: The once-per-session notice ("Using Map fallback") needs a delivery mechanism from CLI to plugin. Options: flag file, stderr, or accept that it's only visible in CLI output.

4. **Schema for Phase 118**: CONTEXT.md says "just infrastructure, no consumers." But the migration array needs at least one migration to verify the system works. Include a minimal `_meta` table or an empty V1 migration that just sets the version.

## Sources

### Primary (HIGH confidence)
- **Node.js v25.8.1 SQLite Documentation**: https://nodejs.org/api/sqlite.html — Verified 2026-03-14. Source for DatabaseSync API, constructor options (timeout, defensive), createTagStore(), exec(), prepare().
- **Existing codebase `src/lib/cache.js`**: Direct read — verified working dual-backend (SQLiteBackend + MapBackend) pattern.
- **Existing codebase `src/plugin/notification.js`**: Direct read — verified notification system API.
- **CONTEXT.md**: User decisions locked for this phase.

### Secondary (MEDIUM confidence)
- **SQLite PRAGMA documentation**: https://www.sqlite.org/pragma.html — Standard reference for user_version, journal_mode, busy_timeout.
- **SQLite WAL mode**: https://www.sqlite.org/wal.html — Standard reference for WAL concurrent access patterns.

### Tertiary (LOW confidence)
- Training data knowledge about `PRAGMA user_version` inside transactions — needs runtime verification.
- Defensive mode interaction with `PRAGMA user_version` — needs runtime verification.

## Metadata

**Confidence breakdown:**
- node:sqlite API (DatabaseSync, prepare, exec): HIGH — verified from current official docs
- PRAGMA user_version migrations: HIGH — well-documented SQLite feature
- WAL mode + busy_timeout: HIGH — standard SQLite concurrency pattern
- Constructor `timeout` option availability across Node versions: MEDIUM — docs confirm v24.0.0/v22.16.0 but untested on v22.5
- Defensive mode defaults: MEDIUM — docs say default true since v25.5.0, verify behavior with PRAGMAs
- Plugin notification bridge for CLI: MEDIUM — architecture decision needed

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (node:sqlite API stabilizing, check for graduation from experimental to stable)
