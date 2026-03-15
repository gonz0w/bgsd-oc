# Architecture Research — SQLite-First Data Layer Integration

**Domain:** SQLite structured tables integration with existing parser/cache/enricher architecture  
**Researched:** 2026-03-14  
**Confidence:** HIGH  
**Research mode:** Ecosystem — How structured SQLite tables integrate with existing architecture

---

<!-- section: compact -->
<architecture_compact>

**Architecture:** Dual-store layered data access — markdown files remain authority, SQLite serves as structured query cache with git-hash invalidation, parsers gain SQLite-backed persistence via new `DataStore` class sitting between parsers and the existing `CacheEngine`.

**Major components:**

| Component | Responsibility |
|-----------|----------------|
| DataStore (NEW) | Unified SQLite access layer — schema management, migrations, structured CRUD, git-hash invalidation |
| StructuredParsers (MODIFIED) | Parsers write structured rows to DataStore after parsing markdown, read from DataStore when cache is valid |
| QueryAPI (NEW) | SQL query functions replacing subprocess calls — get tasks by status, count plans, filter decisions |
| EnricherV2 (MODIFIED) | Enricher reads pre-computed data from DataStore instead of re-parsing files, eliminating 3x listSummaryFiles |
| MemoryMigrator (NEW) | One-time migration of .planning/memory/*.json into SQLite tables |
| FileWatcher (MODIFIED) | On change, invalidates DataStore entries (not just parser Map caches) |

**Key patterns:** Write-through cache (parse → persist to SQLite), git-hash staleness detection, schema versioning with forward-only migrations, Map L1 → SQLite L2 → markdown L3 data hierarchy

**Anti-patterns:** SQLite as source of truth (markdown is always authority), bypassing DataStore to query db directly, schema changes without migration, dropping Map fallback on Node <22.5

**Scaling priority:** Enricher hot-path latency — currently re-parses files on every /bgsd-* command invocation; SQLite-backed cache eliminates file I/O on warm starts

</architecture_compact>
<!-- /section -->

---

<!-- section: standard_architecture -->
## System Overview

### Current Architecture (Before v12.0)

```
┌──────────────────────────────────────────────────────────────────┐
│                      Plugin Layer (ESM)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ context-     │  │ command-     │  │ tools/               │   │
│  │ builder.js   │  │ enricher.js  │  │ bgsd-{status,plan,   │   │
│  │              │  │              │  │  progress,context}   │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
│         │                 │                      │              │
│         └─────────────────┼──────────────────────┘              │
│                           │                                     │
│                    ┌──────▼──────┐                               │
│                    │ project-    │                               │
│                    │ state.js    │  ← Unified facade             │
│                    └──────┬──────┘                               │
│         ┌─────────────────┼───────────────────────┐             │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐             │
│  │ state.js    │  │ roadmap.js  │  │ plan.js     │  ← 6 parsers│
│  │ (Map cache) │  │ (Map cache) │  │ (Map cache) │  each with  │
│  └─────────────┘  └─────────────┘  └─────────────┘  own Map()  │
│                                                                 │
│  ┌────────────────┐   ┌─────────────────────┐                   │
│  │ file-watcher   │──→│ invalidateAll()     │                   │
│  │ (fs.watch)     │   │ clears all Maps     │                   │
│  └────────────────┘   └─────────────────────┘                   │
├──────────────────────────────────────────────────────────────────┤
│                       CLI Layer (CJS)                           │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐        │
│  │ cache.js     │   │ memory.js    │   │ decision-    │        │
│  │ CacheEngine  │   │ JSON files   │   │ rules.js     │        │
│  │ (SQLite|Map) │   │ (.planning/  │   │ (pure fns)   │        │
│  │ 2 tables:    │   │  memory/)    │   │ 12 rules     │        │
│  │ file_cache,  │   │              │   │              │        │
│  │ research_    │   │              │   │              │        │
│  │   cache      │   │              │   │              │        │
│  └──────────────┘   └──────────────┘   └──────────────┘        │
├──────────────────────────────────────────────────────────────────┤
│                    Filesystem (.planning/)                       │
│  STATE.md  ROADMAP.md  config.json  INTENT.md  PROJECT.md       │
│  phases/*/PLAN.md  memory/*.json  REQUIREMENTS.md               │
└──────────────────────────────────────────────────────────────────┘
```

### Target Architecture (After v12.0)

```
┌──────────────────────────────────────────────────────────────────┐
│                      Plugin Layer (ESM)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ context-     │  │ command-     │  │ tools/               │   │
│  │ builder.js   │  │ enricher.js  │  │ bgsd-{status,plan,   │   │
│  │              │  │ (V2: reads   │  │  progress,context,   │   │
│  │              │  │  from store) │  │  validate}           │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
│         │                 │                      │              │
│         └─────────────────┼──────────────────────┘              │
│                           │                                     │
│                    ┌──────▼──────┐                               │
│                    │ project-    │                               │
│                    │ state.js    │  ← Enhanced facade            │
│                    │ (reads from │     delegates to DataStore    │
│                    │  DataStore) │                               │
│                    └──────┬──────┘                               │
│         ┌─────────────────┼───────────────────────┐             │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐             │
│  │ state.js    │  │ roadmap.js  │  │ plan.js     │  ← Parsers  │
│  │ Map L1 +    │  │ Map L1 +    │  │ Map L1 +    │  persist to │
│  │ DataStore L2│  │ DataStore L2│  │ DataStore L2│  DataStore   │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
│  ┌────────────────┐   ┌─────────────────────────┐               │
│  │ file-watcher   │──→│ invalidateAll() +       │               │
│  │ (fs.watch)     │   │ dataStore.invalidate()  │               │
│  └────────────────┘   └─────────────────────────┘               │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  DataStore (NEW)                          │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐  │   │
│  │  │ phases   │  │ plans    │  │ tasks    │  │ reqs    │  │   │
│  │  │ table    │  │ table    │  │ table    │  │ table   │  │   │
│  │  ├──────────┤  ├──────────┤  ├──────────┤  ├─────────┤  │   │
│  │  │decisions │  │ sessions │  │ memory_  │  │ meta    │  │   │
│  │  │ table    │  │ table    │  │ tables   │  │ table   │  │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────────┤
│                       CLI Layer (CJS)                           │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐        │
│  │ cache.js     │   │ memory.js    │   │ decision-    │        │
│  │ CacheEngine  │   │ (V2: reads/  │   │ rules.js     │        │
│  │ (unchanged)  │   │  writes via  │   │ (V2: new     │        │
│  │ file_cache + │   │  DataStore)  │   │  SQLite-fed  │        │
│  │ research_    │   │              │   │  rules)      │        │
│  │   cache      │   │              │   │              │        │
│  └──────────────┘   └──────────────┘   └──────────────┘        │
├──────────────────────────────────────────────────────────────────┤
│                    Filesystem (.planning/)                       │
│  STATE.md  ROADMAP.md  config.json  INTENT.md  PROJECT.md       │
│  phases/*/PLAN.md  memory/*.json  REQUIREMENTS.md               │
│  (AUTHORITY — always the source of truth for content)           │
└──────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Current | After v12.0 | Change Type |
|-----------|---------|-------------|-------------|
| `src/lib/cache.js` CacheEngine | SQLite file_cache + research_cache with Map fallback | **Unchanged** — continues as file content cache | None |
| `src/plugin/parsers/*.js` (6 parsers) | Read markdown → Map cache → frozen objects | Read markdown → Map L1 + DataStore L2 write-through | Modified |
| `src/plugin/project-state.js` | Composes 6 parsers into frozen facade | Adds DataStore read path — skips parsers when cache valid | Modified |
| `src/plugin/command-enricher.js` | Calls parsePlans 3x, listSummaryFiles 3x | Reads pre-computed counts from DataStore | Modified |
| `src/plugin/file-watcher.js` | fs.watch → invalidateAll() (Map caches) | Also invalidates DataStore entries for changed files | Modified |
| `src/commands/memory.js` | Read/write JSON files in .planning/memory/ | Dual-write: JSON files + DataStore tables | Modified |
| `src/lib/decision-rules.js` | 12 pure rules consuming enrichment state | 18-20 rules, new ones consuming SQLite-backed state | Modified |
| **DataStore (NEW)** | N/A | Unified SQLite access: schema, migrations, CRUD, queries | New |
| **QueryAPI (NEW)** | N/A | SQL query functions for workflows (count, filter, aggregate) | New |
| **MemoryMigrator (NEW)** | N/A | One-time JSON → SQLite migration for memory stores | New |

<!-- /section -->

---

<!-- section: patterns -->
## Architectural Patterns

### Pattern 1: Write-Through Structured Cache

**What:** When a parser reads and parses a markdown file, it simultaneously writes the structured data as rows into SQLite. On subsequent reads, if the SQLite cache is valid (git-hash matches), the parser returns data from SQLite without re-reading the file.

**When to use:** Every parser (state, roadmap, plan, config, project, intent).

**Trade-offs:**
- Pro: Cross-invocation persistence — CLI exits and re-enters without re-parsing
- Pro: SQL queries replace file-scanning (e.g., "count plans in phase 73")
- Con: Schema must stay backward-compatible as markdown formats evolve
- Con: Two code paths (parse-and-store vs read-from-store) need testing

**Data flow:**

```
Request for state data
        │
        ▼
    Map L1 hit? ──yes──→ Return frozen object
        │ no
        ▼
    DataStore L2 hit? ──yes──→ Validate git-hash
        │ no                       │
        ▼                    valid? ──yes──→ Hydrate, cache in Map L1, return
    Read file from disk            │ no
        │                          ▼
        ▼                    Invalidate L2 entry
    Parse markdown                 │
        │                          │
        ▼                          │
    Store in Map L1 ◄──────────────┘
        │
        ▼
    Write to DataStore L2
        │
        ▼
    Return frozen object
```

**Example:**

```javascript
// In src/plugin/parsers/state.js (modified)
export function parseState(cwd) {
  const resolvedCwd = cwd || process.cwd();

  // L1: Map cache (in-process, same as today)
  if (_cache.has(resolvedCwd)) {
    return _cache.get(resolvedCwd);
  }

  // L2: DataStore (cross-invocation persistence)
  const store = getDataStore();
  if (store) {
    const cached = store.getState(resolvedCwd);
    if (cached && store.isValid(resolvedCwd, 'STATE.md')) {
      _cache.set(resolvedCwd, cached);
      return cached;
    }
  }

  // L3: Parse from filesystem (current logic)
  const raw = readFileSync(join(resolvedCwd, '.planning', 'STATE.md'), 'utf-8');
  const result = Object.freeze({ /* ... parsed fields ... */ });

  // Write-through to both caches
  _cache.set(resolvedCwd, result);
  if (store) {
    store.setState(resolvedCwd, result);
  }

  return result;
}
```

### Pattern 2: Git-Hash Staleness Detection

**What:** Instead of checking file mtime (which the current CacheEngine already does for file_cache), structured cache entries store the git commit hash at write time. On read, compare current HEAD hash with stored hash. If different, the cache may be stale — re-validate via mtime or content hash.

**When to use:** DataStore entries for parsed planning data.

**Trade-offs:**
- Pro: More reliable than mtime alone — mtime can be reset by git checkout/rebase
- Pro: A single git hash check covers all files (one `git rev-parse HEAD` per invocation)
- Con: Requires a git call on startup (execSync ~5ms)
- Con: Uncommitted changes aren't captured by git hash — need file hash fallback

**Implementation:**

```javascript
// In DataStore
_meta table: { key TEXT PRIMARY KEY, value TEXT }

// On startup: store current git hash
const currentHash = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
this._setMeta('git_hash', currentHash);

// On cache read: compare
isValid(cwd, filename) {
  const storedHash = this._getMeta('git_hash');
  if (storedHash !== this._currentHash) {
    // Git state changed — check file-level staleness
    const filePath = join(cwd, '.planning', filename);
    const currentMtime = statSync(filePath).mtimeMs;
    const storedMtime = this._getFileMtime(cwd, filename);
    return currentMtime === storedMtime;
  }
  return true; // Same git hash = same files
}
```

**Decision:** Use a **hybrid approach**: git-hash for bulk invalidation (new commit = re-check everything), plus per-file mtime for fine-grained staleness within the same commit. This handles both `git checkout` scenarios and live editing.

### Pattern 3: Dual-Store Authority (Markdown + SQLite)

**What:** Markdown files remain the source of truth for all planning data. SQLite is a derived cache that can always be regenerated from markdown. This means:
1. Writes go to markdown first, then SQLite
2. On conflict, markdown wins
3. If SQLite is corrupted/deleted, everything rebuilds from markdown
4. STATE.md continues to be human-readable and git-tracked

**When to use:** ALL structured data operations.

**Trade-offs:**
- Pro: Git history, human readability, and AI agent compatibility preserved
- Pro: SQLite corruption is recoverable (just delete cache.db and re-parse)
- Pro: No migration risk — existing .planning/ directories work unchanged
- Con: Two representations to keep in sync (mitigated by write-through pattern)
- Con: Some queries need to parse markdown for data not in the schema

**Rules:**
1. **Never modify markdown via SQLite** — always read/write markdown with existing patterns
2. **SQLite is disposable** — `rm cache.db` is always safe
3. **Schema additions are append-only** — never rename/remove columns in place
4. **Markdown is the backup** — if DataStore returns null, fall through to file parsing

### Pattern 4: Schema Versioning with Forward-Only Migrations

**What:** A `_schema_version` meta key tracks the current schema version. On DataStore initialization, if the stored version is lower than the code's expected version, migration functions run sequentially. Migrations only add tables/columns — never drop or rename.

**When to use:** Every schema change across versions.

**Implementation:**

```javascript
const SCHEMA_VERSION = 3; // Bump on every schema change

class DataStore {
  _migrate() {
    const current = this._getSchemaVersion();

    if (current < 1) {
      this.db.exec(`
        CREATE TABLE phases (...)
        CREATE TABLE plans (...)
        CREATE TABLE tasks (...)
      `);
    }
    if (current < 2) {
      this.db.exec(`
        CREATE TABLE decisions (...)
        CREATE TABLE lessons (...)
      `);
    }
    if (current < 3) {
      this.db.exec(`
        ALTER TABLE tasks ADD COLUMN estimated_minutes INTEGER
      `);
    }

    this._setSchemaVersion(SCHEMA_VERSION);
  }
}
```

**Trade-offs:**
- Pro: Always forward-compatible — old databases upgrade automatically
- Pro: No data loss — append-only schema changes
- Con: Cannot remove dead columns/tables without a major version bump
- Con: Migration chain grows over time (acceptable for a CLI tool)

### Pattern 5: MapBackend Fallback Preservation

**What:** The existing Map fallback for Node <22.5 must be preserved for all new functionality. DataStore operations are gated behind `getDataStore()` which returns null when SQLite is unavailable. All callers use `if (store) { ... }` guards.

**When to use:** Every DataStore consumer.

**Example:**

```javascript
// Safe pattern — used everywhere
const store = getDataStore();
if (store) {
  const cached = store.getPhases(cwd);
  if (cached) return cached;
}
// Fall through to existing Map-based path
```

**Trade-offs:**
- Pro: Zero-regression on older Node versions
- Pro: Map path remains the tested, proven code path
- Con: Two code paths to maintain and test
- Con: Map-only users don't get cross-invocation persistence (acceptable — they don't today either)

<!-- /section -->

---

<!-- section: data_flow -->
## Data Flow

### Current Enricher Flow (Before v12.0)

```
/bgsd-* command invoked
    │
    ▼
enrichCommand() called
    │
    ├──→ getProjectState()
    │       ├──→ parseState()      → readFileSync STATE.md → Map cache
    │       ├──→ parseRoadmap()    → readFileSync ROADMAP.md → Map cache
    │       ├──→ parseConfig()     → readFileSync config.json → Map cache
    │       ├──→ parseProject()    → readFileSync PROJECT.md → Map cache
    │       ├──→ parseIntent()     → readFileSync INTENT.md → Map cache
    │       └──→ parsePlans()      → readdirSync + readFileSync *-PLAN.md → Map cache
    │
    ├──→ parsePlans() AGAIN (for plan_count derivation)  ← DUPLICATION
    │
    ├──→ listSummaryFiles() x3                           ← DUPLICATION
    │       └──→ readdirSync + filter 3 times
    │
    ├──→ evaluateDecisions()
    │       └──→ 12 pure rules on enrichment object
    │
    └──→ Serialize to <bgsd-context> JSON
```

**Problem:** On a cold start (first invocation after cache clear), the enricher:
- Reads 6 markdown files from disk
- Calls `parsePlans()` 3 times (once in getProjectState, twice in enricher)
- Calls `listSummaryFiles()` 3 times (scanning phase directory each time)
- All results are Map-cached but only for this process invocation

### Target Enricher Flow (After v12.0)

```
/bgsd-* command invoked
    │
    ▼
enrichCommand() called
    │
    ├──→ getProjectState()
    │       │
    │       ├──→ DataStore.isValid(cwd)?
    │       │       │
    │       │     yes → Return pre-built enrichment from DataStore
    │       │       │     (single row read, ~0.1ms)
    │       │       │
    │       │      no → Parse all files (existing logic)
    │       │             │
    │       │             ├──→ Write structured rows to DataStore
    │       │             └──→ Pre-compute enrichment fields
    │       │                   ├──→ plan_count, summary_count  (SQL COUNT)
    │       │                   ├──→ incomplete_plans            (SQL query)
    │       │                   ├──→ task_types                  (SQL query)
    │       │                   └──→ Store pre-computed enrichment
    │       │
    │       └──→ Return frozen project state
    │
    ├──→ evaluateDecisions()  ← Same pure functions, richer inputs
    │
    └──→ Serialize to <bgsd-context> JSON
```

**Improvement:** On warm starts (DataStore cache valid):
- Zero file I/O — all data from SQLite
- Zero duplication — plan_count and summary_count are pre-computed
- Single validation check (git-hash + mtime) instead of 6 file reads
- Enrichment result is pre-computed and cached as a JSON blob

### Memory Store Data Flow (Migration)

```
BEFORE:                              AFTER:
.planning/memory/                    .planning/memory/
  decisions.json ──read/write──→       decisions.json ──read────→ (authority)
  lessons.json   ──read/write──→       lessons.json   ──read────→ (authority)
  trajectory.json──read/write──→       trajectory.json──read────→ (authority)
  bookmarks.json ──read/write──→       bookmarks.json ──read────→ (authority)

                                     DataStore (SQLite):
                                       decisions ──────→ indexed, queryable
                                       lessons ────────→ indexed, queryable
                                       trajectories ──→ indexed, queryable
                                       bookmarks ─────→ indexed, queryable

Write path:
  1. Write to JSON file (existing behavior, preserves git tracking)
  2. Write to DataStore table (for query acceleration)

Read path (queries):
  1. Check DataStore first (SQL WHERE/ORDER BY/LIMIT)
  2. Fall back to JSON file read + in-memory filter (existing behavior)

Migration (one-time):
  On first DataStore init, scan .planning/memory/*.json
  Import all entries into corresponding SQLite tables
  Store migration timestamp in _meta table
```

### File Watcher Integration

```
File change detected by fs.watch
    │
    ▼
Debounce (200ms, existing)
    │
    ▼
Filter out self-writes (existing)
    │
    ▼
invalidateAll(cwd)        ← Existing: clears all Map caches
    │
    ▼
dataStore.invalidateFile(  ← NEW: marks DataStore entries stale
  cwd, changedFilename     
)
    │
    ▼
Next enricher call will:
  - Miss Map L1 (cleared)
  - Miss DataStore L2 (marked stale)
  - Re-parse from filesystem
  - Re-populate both caches
```

<!-- /section -->

---

<!-- section: scaling -->
## Schema Design

### Structured Tables

```sql
-- Meta table for schema version and git hash tracking
CREATE TABLE IF NOT EXISTS _meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Phases extracted from ROADMAP.md
CREATE TABLE IF NOT EXISTS phases (
  cwd          TEXT NOT NULL,
  number       TEXT NOT NULL,       -- "73", "73.1"
  name         TEXT NOT NULL,
  status       TEXT NOT NULL,       -- 'complete', 'incomplete'
  goal         TEXT,
  plan_count   INTEGER DEFAULT 0,
  depends_on   TEXT,                -- JSON array of phase numbers
  git_hash     TEXT NOT NULL,       -- git hash when cached
  file_mtime   REAL NOT NULL,       -- ROADMAP.md mtime when cached
  PRIMARY KEY (cwd, number)
);

-- Plans extracted from PLAN.md files
CREATE TABLE IF NOT EXISTS plans (
  cwd          TEXT NOT NULL,
  phase_number TEXT NOT NULL,
  plan_number  TEXT NOT NULL,       -- "01", "02"
  path         TEXT NOT NULL,       -- relative path to PLAN.md
  objective    TEXT,
  task_count   INTEGER DEFAULT 0,
  has_summary  INTEGER DEFAULT 0,   -- 1 if matching SUMMARY.md exists
  frontmatter  TEXT,                -- JSON blob of frontmatter
  git_hash     TEXT NOT NULL,
  file_mtime   REAL NOT NULL,
  PRIMARY KEY (cwd, phase_number, plan_number)
);

-- Tasks extracted from PLAN.md <task> elements
CREATE TABLE IF NOT EXISTS tasks (
  cwd          TEXT NOT NULL,
  phase_number TEXT NOT NULL,
  plan_number  TEXT NOT NULL,
  task_number  INTEGER NOT NULL,    -- 1-indexed
  name         TEXT,
  type         TEXT DEFAULT 'auto', -- 'auto', 'checkpoint:decision', etc.
  files        TEXT,                -- JSON array
  action       TEXT,
  verify       TEXT,
  done         TEXT,
  status       TEXT DEFAULT 'pending', -- 'pending', 'complete'
  PRIMARY KEY (cwd, phase_number, plan_number, task_number),
  FOREIGN KEY (cwd, phase_number, plan_number) REFERENCES plans(cwd, phase_number, plan_number)
);

-- Requirements from REQUIREMENTS.md
CREATE TABLE IF NOT EXISTS requirements (
  cwd          TEXT NOT NULL,
  req_id       TEXT NOT NULL,       -- "TEST-01", "CMD-03"
  text         TEXT NOT NULL,
  status       TEXT NOT NULL,       -- 'validated', 'active', 'oos'
  phase        TEXT,                -- phase number if mapped
  plan         TEXT,                -- plan number if mapped
  git_hash     TEXT NOT NULL,
  PRIMARY KEY (cwd, req_id)
);

-- Decisions from memory store + STATE.md
CREATE TABLE IF NOT EXISTS decisions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  cwd          TEXT NOT NULL,
  phase        TEXT,
  text         TEXT NOT NULL,
  timestamp    TEXT NOT NULL,       -- ISO 8601
  source       TEXT NOT NULL        -- 'state.md', 'memory'
);
CREATE INDEX IF NOT EXISTS idx_decisions_cwd ON decisions(cwd);
CREATE INDEX IF NOT EXISTS idx_decisions_phase ON decisions(cwd, phase);

-- Lessons from memory store
CREATE TABLE IF NOT EXISTS lessons (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  cwd          TEXT NOT NULL,
  phase        TEXT,
  text         TEXT NOT NULL,
  timestamp    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lessons_cwd ON lessons(cwd);

-- Trajectories from memory store
CREATE TABLE IF NOT EXISTS trajectories (
  id           TEXT NOT NULL,       -- "tj-abc123" format
  cwd          TEXT NOT NULL,
  category     TEXT NOT NULL,       -- 'decision', 'observation', etc.
  text         TEXT NOT NULL,
  phase        TEXT,
  confidence   TEXT,                -- 'high', 'medium', 'low'
  tags         TEXT,                -- JSON array
  references   TEXT,                -- JSON array
  timestamp    TEXT NOT NULL,
  PRIMARY KEY (id, cwd)
);
CREATE INDEX IF NOT EXISTS idx_traj_cwd ON trajectories(cwd);
CREATE INDEX IF NOT EXISTS idx_traj_category ON trajectories(cwd, category);

-- Session state (replacing parts of STATE.md for machine access)
CREATE TABLE IF NOT EXISTS session_state (
  cwd          TEXT PRIMARY KEY,
  phase        TEXT,
  current_plan TEXT,
  progress     INTEGER,
  status       TEXT,
  last_activity TEXT,
  git_hash     TEXT NOT NULL,
  updated_at   TEXT NOT NULL        -- ISO 8601
);

-- Pre-computed enrichment cache
CREATE TABLE IF NOT EXISTS enrichment_cache (
  cwd          TEXT PRIMARY KEY,
  data         TEXT NOT NULL,       -- Full JSON enrichment blob
  git_hash     TEXT NOT NULL,
  computed_at  TEXT NOT NULL
);
```

### Schema Sizing

| Table | Expected Rows (per project) | Growth Rate |
|-------|---------------------------|-------------|
| _meta | 3-5 | Static |
| phases | 5-20 | Per milestone |
| plans | 10-50 | Per phase |
| tasks | 50-200 | Per plan |
| requirements | 20-100 | Per milestone |
| decisions | 50-500 | Per session |
| lessons | 20-200 | Per milestone |
| trajectories | 20-200 | Per session |
| session_state | 1 | Static |
| enrichment_cache | 1 | Static |

Total: Under 2000 rows for a mature project. SQLite handles this trivially.

<!-- /section -->

---

<!-- section: anti_patterns -->
## Anti-Patterns to Avoid

### Anti-Pattern 1: SQLite as Source of Truth

**What people do:** Write data to SQLite first and generate markdown from it.  
**Why it's wrong:** Markdown files are git-tracked, human-readable, and consumed by AI agents. Making SQLite authoritative means git diffs become meaningless and .planning/ directories become useless without the SQLite database.  
**Do this instead:** Always write markdown first, then update SQLite as a derived cache. If SQLite is deleted, everything should rebuild transparently.

### Anti-Pattern 2: Direct Database Access from Multiple Modules

**What people do:** Import DatabaseSync in every module and run raw SQL.  
**Why it's wrong:** Schema coupling spreads across the codebase, making migrations impossible and SQL injection likely.  
**Do this instead:** ALL database access goes through DataStore class methods. No raw SQL outside DataStore. The existing CacheEngine pattern (encapsulated backend) is the model.

### Anti-Pattern 3: Eager Table Population on Startup

**What people do:** Parse every markdown file and populate every table on first CLI invocation.  
**Why it's wrong:** Most CLI commands need only 1-2 tables worth of data. Parsing all files to populate all tables adds 100-500ms startup cost that most invocations don't benefit from.  
**Do this instead:** Lazy population — tables are populated when first queried. Use the existing parser call chain: when `parseState()` is called, it populates the `session_state` table. When `parsePlans()` is called, it populates `plans` and `tasks` tables.

### Anti-Pattern 4: Breaking the Map Fallback Path

**What people do:** Make SQLite a hard dependency and remove Map-based caching.  
**Why it's wrong:** Map fallback exists because `node:sqlite` is Stability 1.2 (Release Candidate). Removing it breaks backward compatibility with Node <22.5 and removes the safety net if SQLite has bugs.  
**Do this instead:** Every DataStore consumer uses `if (store) { ... }` guards. The Map-based path remains the default path. DataStore is a performance accelerator, not a requirement.

### Anti-Pattern 5: Storing Raw Markdown in SQLite

**What people do:** Store the entire ROADMAP.md content as a TEXT blob in SQLite and re-parse it from there.  
**Why it's wrong:** This is what the existing `file_cache` table already does. Structured tables should store *parsed, queryable data* — not raw file content. Having both raw blobs and structured rows creates confusion about which to read.  
**Do this instead:** Structured tables store extracted fields only (name, status, count). The `file_cache` table in CacheEngine already handles raw content caching. Don't duplicate it.

### Anti-Pattern 6: Schema Migrations That Drop Data

**What people do:** `DROP TABLE IF EXISTS phases; CREATE TABLE phases (...)` on version bump.  
**Why it's wrong:** Destroys cached data unnecessarily. Since markdown is the authority, the data would be re-parsed, but this causes a cold-start performance hit on every upgrade.  
**Do this instead:** Forward-only migrations: `ALTER TABLE ... ADD COLUMN`, `CREATE TABLE IF NOT EXISTS`. Never DROP in normal operation.

<!-- /section -->

---

<!-- section: integration -->
## Integration Points

### New vs. Modified Components

| Component | Type | Files | Dependencies |
|-----------|------|-------|-------------|
| DataStore | **NEW** | `src/lib/datastore.js` | `node:sqlite` (optional), `src/lib/cache.js` (for db path pattern) |
| QueryAPI | **NEW** | `src/lib/query.js` | DataStore |
| MemoryMigrator | **NEW** | `src/lib/memory-migrator.js` | DataStore, `src/commands/memory.js` (for store paths) |
| state.js parser | MODIFIED | `src/plugin/parsers/state.js` | DataStore (optional) |
| roadmap.js parser | MODIFIED | `src/plugin/parsers/roadmap.js` | DataStore (optional) |
| plan.js parser | MODIFIED | `src/plugin/parsers/plan.js` | DataStore (optional) |
| project-state.js | MODIFIED | `src/plugin/project-state.js` | DataStore (optional) |
| command-enricher.js | MODIFIED | `src/plugin/command-enricher.js` | DataStore (via project-state) |
| file-watcher.js | MODIFIED | `src/plugin/file-watcher.js` | DataStore (for invalidation) |
| memory.js | MODIFIED | `src/commands/memory.js` | DataStore (dual-write) |
| decision-rules.js | MODIFIED | `src/lib/decision-rules.js` | New rules consuming DataStore queries |
| parsers/index.js | MODIFIED | `src/plugin/parsers/index.js` | DataStore (invalidateAll extension) |

### Internal Boundaries

| Boundary | Communication | Direction | Notes |
|----------|---------------|-----------|-------|
| Parsers → DataStore | Direct method calls | Write-through | Parsers call `store.setPhases()`, `store.setPlans()`, etc. |
| ProjectState → DataStore | Direct method calls | Read | `getProjectState()` checks DataStore before calling parsers |
| Enricher → ProjectState | Existing facade | Read | No change — enricher still calls getProjectState() |
| FileWatcher → DataStore | Method call on invalidation | Write | `dataStore.invalidateFile(cwd, filename)` |
| Memory.js → DataStore | Dual-write | Write | After JSON file write, also write to DataStore table |
| QueryAPI → DataStore | Direct method calls | Read | Exposes high-level query functions for CLI commands |
| CacheEngine → DataStore | **None** | Isolated | CacheEngine keeps its own db connection and tables (file_cache, research_cache). DataStore manages a separate database or separate tables in the same database |

### Database Location Decision

**Option A: Separate database file** — DataStore uses `~/.config/oc/bgsd-oc/data.db`, CacheEngine keeps `cache.db`.  
**Option B: Same database file** — DataStore adds tables to the existing `cache.db`.

**Recommendation: Option B (same database)**. Reasons:
1. Single SQLite connection — no overhead from opening two databases
2. DataStore can reuse CacheEngine's DatabaseSync instance via constructor injection
3. Schema versioning via `_meta` table doesn't conflict with CacheEngine's tables
4. Single backup/delete path for troubleshooting

**However**, DataStore and CacheEngine must remain architecturally separate classes. DataStore does NOT inherit from or compose CacheEngine. They share a database connection, not an API.

### Project-Local vs. Global Database

The existing CacheEngine stores its database globally (`~/.config/oc/bgsd-oc/cache.db`) — shared across all projects. This is correct for file content caching.

For structured planning data, **project-local storage** is required because:
- Phase/plan/task data is project-specific
- Memory stores are per-project (.planning/memory/)
- Git-hash invalidation is per-repository

**Decision:** DataStore uses the project's `.planning/.cache.db` file (gitignored). This keeps structured data co-located with the project it describes. The CacheEngine's global `cache.db` continues unchanged for file content caching.

```
~/.config/oc/bgsd-oc/cache.db      ← CacheEngine (global file cache)
/project/.planning/.cache.db        ← DataStore (project-specific structured data)
```

Add `.cache.db` to `.planning/.gitignore` (or the project's `.gitignore`).

## Build Order (Dependency-Aware)

The components have a strict dependency chain. Build in this order:

### Wave 1: Foundation (no downstream dependents yet)

| # | Component | Depends On | Enables |
|---|-----------|------------|---------|
| 1 | **DataStore class** | node:sqlite (existing) | Everything else |
| 2 | **Schema + migrations** | DataStore | Table consumers |
| 3 | **Git-hash invalidation** | DataStore, git.js | Cache validity checks |

DataStore must be built first — it's the foundation all other components depend on. Include Map fallback (return null from `getDataStore()` when SQLite unavailable).

### Wave 2: Parser Integration (depends on Wave 1)

| # | Component | Depends On | Enables |
|---|-----------|------------|---------|
| 4 | **Parser write-through** (state, roadmap, plan) | DataStore | Structured cache population |
| 5 | **project-state.js enhancement** | Parser write-through | DataStore read path |
| 6 | **parsers/index.js invalidation** | DataStore | File watcher integration |
| 7 | **file-watcher.js extension** | DataStore, parsers/index.js | Change-driven invalidation |

Parsers can be modified independently (state.js, roadmap.js, plan.js are independent of each other). The index.js and file-watcher changes depend on at least one parser being done.

### Wave 3: Enricher Acceleration (depends on Wave 2)

| # | Component | Depends On | Enables |
|---|-----------|------------|---------|
| 8 | **Enricher V2** — read from DataStore | project-state enhanced, DataStore | Eliminates 3x duplication |
| 9 | **enrichment_cache table** | Enricher V2, DataStore | Pre-computed enrichment |

This is the highest-impact change — eliminates the 3x listSummaryFiles and 2x parsePlans duplication in command-enricher.js.

### Wave 4: Memory Migration (independent, can parallel with Wave 2-3)

| # | Component | Depends On | Enables |
|---|-----------|------------|---------|
| 10 | **Memory tables schema** | DataStore | Memory store queries |
| 11 | **MemoryMigrator** | Memory tables, memory.js | One-time JSON import |
| 12 | **memory.js dual-write** | Memory tables, MemoryMigrator | Ongoing sync |
| 13 | **QueryAPI for memory** | Memory tables | CLI query commands |

Memory migration is largely independent of parser integration. The main dependency is DataStore existing.

### Wave 5: Decision Rules Expansion (depends on Wave 2-3)

| # | Component | Depends On | Enables |
|---|-----------|------------|---------|
| 14 | **New decision rules** (6-8 rules) | DataStore queries, enricher V2 | Richer workflow routing |
| 15 | **Enricher decision integration** | New rules, enricher V2 | Pre-computed decisions |

New rules consume SQLite-backed state (e.g., "has this phase been attempted before?", "what's the average task completion rate?").

### Wave 6: Session State (depends on Wave 2)

| # | Component | Depends On | Enables |
|---|-----------|------------|---------|
| 16 | **session_state table population** | DataStore, state parser | Cross-invocation session |
| 17 | **STATE.md as generated view** | session_state, state parser | Reduced STATE.md manipulation |

This is the most architecturally aggressive change — making STATE.md a generated output rather than the primary store for session state. It should be last because it changes the authority model for session data.

## Sources

1. **src/lib/cache.js** — Existing CacheEngine with SQLiteBackend and MapBackend (752 lines, reviewed in full)
2. **src/plugin/parsers/*.js** — 6 in-process parsers with Map caches (state: 101 lines, roadmap: 220 lines, plan: 258 lines, config: 155 lines)
3. **src/plugin/command-enricher.js** — Command enrichment with 3x duplication identified (340 lines)
4. **src/plugin/project-state.js** — Unified facade composing 6 parsers (67 lines)
5. **src/plugin/file-watcher.js** — fs.watch with invalidateAll() integration (202 lines)
6. **src/commands/memory.js** — JSON file-based memory stores (378 lines)
7. **src/lib/decision-rules.js** — 12 pure decision functions with registry (467 lines)
8. **src/plugin/context-builder.js** — System prompt and compaction context builders (387 lines)
9. **src/plugin/tools/bgsd-progress.js** — STATE.md mutation with file locking (324 lines)
10. **Node.js v25.8.1 SQLite documentation** — Stability 1.2 Release Candidate, DatabaseSync API, SQLTagStore, Session/Changeset support
11. **PROJECT.md** — v12.0 milestone context, architecture constraints, key decisions (293 lines)

---

*Architecture research for: SQLite-First Data Layer Integration*  
*Researched: 2026-03-14*  
*Confidence: HIGH — All findings verified against source code and Node.js documentation*

<!-- /section -->
