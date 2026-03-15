# Feature Research: SQLite-First Data Layer for CLI Tools

**Domain:** SQLite-as-application-database for CLI development tools
**Researched:** 2026-03-14
**Confidence:** HIGH (Node.js official docs, SQLite official docs, codebase analysis of 6 parsers + cache.js + enricher + memory stores)

<!-- section: compact -->
<features_compact>
<!-- Compact view for planners. Keep under 30 lines. -->

**Table stakes (must have):**
- Structured planning tables (phases, plans, tasks, decisions, requirements) — eliminates re-parsing markdown on every invocation
- Git-hash invalidation — SQLite rows keyed by source file hash, stale on any commit touching `.planning/`
- Session state in SQLite — current position, metrics, accumulated context; STATE.md becomes generated view
- Memory store migration — decisions.json, lessons.json, trajectories.json, bookmarks.json into SQLite tables with indexes
- Enricher deduplication — pre-compute all workflow data from SQLite, eliminate 3x listSummaryFiles / 2x parsePlans calls
- Schema versioning — `schema_version` table with migration runner for forward-compatible upgrades

**Differentiators:**
- Query-based decision inputs — decision rules consume SQL queries directly instead of enricher-derived JSON
- Cross-entity queries — "show all decisions for phase X that affected task Y" via JOINs (impossible with JSON files)
- Materialized views for hot paths — pre-joined enrichment data refreshed on write, not computed on every read
- Incremental parse cache — parse markdown once, store structured rows, invalidate per-file not per-session

**Defer (v2+):** FTS5 full-text search over decisions/lessons, WAL-mode read replicas for parallel agents, SQLite session/changeset tracking, backup/restore commands for planning databases

**Key dependencies:** Schema versioning requires migration runner; memory migration requires schema; enricher acceleration requires structured tables; query-based decisions require enricher acceleration
</features_compact>
<!-- /section -->

<!-- section: feature_landscape -->
## Feature Landscape

### Table Stakes (Users Expect These)

Features that must exist for the SQLite data layer to be useful. Without these, the migration adds complexity without benefit.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Planning data tables | Eliminate re-parsing ROADMAP.md, STATE.md, PLAN.md on every CLI invocation; structured data enables SQL queries | HIGH | 5-7 tables: `phases`, `plans`, `tasks`, `requirements`, `decisions`, `lessons`, `sessions`. Each mirrors existing parser output. Must handle the full regex surface area (309+ patterns) |
| Git-hash invalidation | Data becomes stale when `.planning/` files change; must detect and re-parse automatically | MEDIUM | Store `file_path + git_hash` or `mtime` per row. On CLI startup, compare current hash/mtime to stored. Invalidate affected rows only. Current `cache.js` already does mtime-based invalidation for file cache |
| Schema versioning with migrations | Database schema will evolve across milestones; users must upgrade without data loss | MEDIUM | `CREATE TABLE schema_meta (version INTEGER, applied_at TEXT)`. Migration runner executes numbered scripts in a transaction. Pattern used by every serious SQLite application (Fossil, Firefox, Android) |
| Session state persistence | Current position, metrics, accumulated context stored in SQL; STATE.md becomes a generated view | HIGH | `sessions` table stores phase, plan, task, status, metrics JSON, timestamps. STATE.md writer generates markdown from SQL row. Biggest behavioral change: STATE.md is no longer the source of truth |
| Memory store migration | decisions.json, lessons.json, trajectories.json, bookmarks.json → SQLite tables | MEDIUM | 4 JSON files → 4 tables. Each has well-defined structure (from init.js L1659-1754). Must preserve sacred data protection (compaction guard). Migration script reads existing JSON, inserts rows, renames JSON to `.bak` |
| Enricher deduplication | Fix the 3x `listSummaryFiles` and 2x `parsePlans` calls in command-enricher.js | LOW | Replace file-scanning enrichment logic with single SQL query. The enricher currently does: parse state → parse roadmap → find phase dir → list plans → list summaries → count UAT files → evaluate decisions. With SQLite: `SELECT * FROM enrichment_cache WHERE cwd = ?` |
| Backward-compatible fallback | Must work when SQLite unavailable (Node < 22.5) or database corrupt | MEDIUM | Existing MapBackend pattern in cache.js. Structured data layer follows same pattern: SQLite preferred, markdown re-parsing as fallback. Never crash if DB missing |

### Differentiators (Competitive Advantage)

Features that transform SQLite from "faster cache" into "structured data backbone." These make the architecture qualitatively different.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Cross-entity SQL queries | "Show decisions from phase 73 that mention cache" — impossible with separate JSON files, trivial with JOINs | LOW | Consequence of having structured tables. No extra code needed beyond schema design. Enables `/bgsd-search-decisions` to use SQL instead of reading/filtering JSON |
| Query-based decision inputs | Decision rules consume SQL results directly instead of enricher-computed JSON | MEDIUM | Current `decision-rules.js` functions take `(state)` objects. New: functions can call `getDecisionContext(ruleId)` which runs a cached SQL query. Eliminates enricher as intermediary for some rules |
| Materialized enrichment view | Pre-joined table with all enricher fields, refreshed on write triggers | HIGH | `CREATE TABLE enrichment_view AS SELECT ...` updated via SQLite triggers on insert/update to planning tables. Enricher reads one row instead of running 8+ queries. Tricky: triggers must be maintained as schema evolves |
| Incremental parse-and-store | Parse markdown file → store structured rows → only re-parse when file changes | MEDIUM | Different from file cache (which stores raw text). This stores parsed structures: phases array, tasks array, etc. Parse once, query many times. Invalidate per-file via git hash or mtime |
| Atomic multi-file updates | Update phase status + task completion + metrics in one transaction | LOW | `db.exec('BEGIN'); ... db.exec('COMMIT');` wraps multiple updates. Currently, bgsd-tools writes STATE.md + PLAN.md + memory JSON separately — any crash mid-write corrupts state |
| Session continuity across invocations | CLI knows "last 5 commands, their durations, what changed" without reading git log | MEDIUM | `sessions` table with invocation log. Enables velocity metrics, stuck detection, and resume intelligence. Currently some of this lives in memory stores |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems in a CLI tool context.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Full ORM layer | "Structured data needs an ORM" | Adds massive dependency, fights single-file deploy, overkill for CLI. ORMs solve problems CLI tools don't have (connection pooling, lazy loading, migrations across servers) | Direct `node:sqlite` with prepared statements and thin helper functions. The `SQLTagStore` API already provides ergonomic parameterized queries |
| Async SQLite operations | "Modern Node.js should be async" | `node:sqlite` is `DatabaseSync` — synchronous by design. CLI tools are single-threaded, short-lived (<5s). Async adds complexity (promises, error handling) for zero benefit in this context. The project explicitly lists "Async I/O rewrite" as out of scope | Keep synchronous. `DatabaseSync` is the correct choice for CLI tools |
| Real-time file watching for invalidation | "Detect .planning/ changes automatically" | CLI tools are invocation-based, not long-running. File watching (fs.watch/chokidar) adds complexity, platform differences, and race conditions. The enricher already runs fresh on each command | Invalidation on CLI startup via mtime/hash comparison. Takes <1ms for typical `.planning/` directory |
| SQLite as the ONLY data format | "Move everything to SQLite, drop markdown" | Markdown files ARE the user interface. Users read ROADMAP.md, edit STATE.md, commit PLAN.md to git. SQLite is the machine interface. Removing markdown breaks git diffs, human readability, and the entire workflow model | Hybrid: markdown is source of truth for human-facing data, SQLite is derived structured cache that accelerates machine access. STATE.md becomes a generated view |
| FTS5 full-text search | "Search across all decisions and lessons" | Adds index maintenance overhead, increases DB size, requires FTS5 extension availability. Current decision/lesson volumes (<1000 entries) don't need full-text search — simple LIKE queries suffice | Defer to v2+. Use `WHERE content LIKE '%term%'` for now. FTS5 when volumes justify it |
| WAL-mode for concurrent access | "Multiple CLI processes might run simultaneously" | CLI invocations are sequential (human-driven). WAL mode adds the `-wal` and `-shm` sidecar files, complicates backup/restore, and the project's deploy model (single-file copy) doesn't handle sidecar files well | Default journal mode (DELETE). If concurrent access needed later, WAL can be enabled with a pragma |
| Per-project SQLite database | "Each project should have its own .planning/data.db" | Makes `.planning/` directory heavier, adds binary file to git (bad for diffs/merges), increases project setup complexity | Keep DB in user config dir (`~/.config/oc/bgsd-oc/data.db`) alongside existing `cache.db`. Scope data by project path. Multiple projects share one DB file with path-based partitioning |
<!-- /section -->

<!-- section: dependencies -->
## Feature Dependencies

```
[Schema Versioning + Migration Runner]
    └──requires──> [Database initialization (already exists in cache.js)]

[Planning Data Tables]
    └──requires──> [Schema Versioning]

[Memory Store Migration]
    └──requires──> [Schema Versioning]
    └──requires──> [Planning Data Tables] (for foreign keys to phases/plans)

[Enricher Acceleration]
    └──requires──> [Planning Data Tables]
    └──requires──> [Session State Persistence]

[Query-Based Decision Inputs]
    └──requires──> [Enricher Acceleration]
    └──requires──> [Planning Data Tables]

[Materialized Enrichment View]
    └──requires──> [Planning Data Tables]
    └──requires──> [Session State Persistence]
    └──enhances──> [Enricher Acceleration]

[Git-Hash Invalidation]
    └──enhances──> [Planning Data Tables]
    └──enhances──> [Incremental Parse-and-Store]

[New Deterministic Decisions]
    └──requires──> [Query-Based Decision Inputs]
    └──requires──> [Planning Data Tables]
```

### Dependency Notes

- **Planning Data Tables requires Schema Versioning:** Tables will evolve; must have migration path from day one. Retrofitting migrations is painful.
- **Memory Store Migration requires Planning Data Tables:** Decisions and lessons reference phases/plans by number. With proper tables, these become foreign key relationships instead of string matching.
- **Enricher Acceleration requires Planning Data Tables:** The enricher's job is to assemble data from multiple sources. If those sources are already in SQL, the enricher becomes a single query instead of 8+ file operations.
- **Query-Based Decision Inputs requires Enricher Acceleration:** Decision rules currently receive pre-computed `(state)` objects from the enricher. With SQL-backed data, they can query directly, but only after the data layer exists.
- **Materialized Enrichment View enhances Enricher Acceleration:** Optional optimization. Pre-join the most common enrichment query so the enricher reads one row. Only worth it if enrichment query is measured as a bottleneck.
- **Git-Hash Invalidation enhances Planning Data Tables:** Not strictly required (mtime works), but git-hash gives stronger guarantees. If a file is reverted to a prior state, mtime changes but content hash matches cache — avoiding unnecessary re-parse.
<!-- /section -->

<!-- section: data_placement -->
## Data Placement: What Belongs Where

Critical architectural decision: which data lives in SQLite vs markdown vs both.

### SQLite Only (Machine Data)

Data that humans never read directly. No markdown representation needed.

| Data | Current Location | Why SQLite Only |
|------|-----------------|-----------------|
| File cache (raw text) | `cache.db` file_cache table | Already there. Purely machine optimization |
| Research cache | `cache.db` research_cache table | Already there. TTL-based, no human relevance |
| Parser output cache | Per-parser `new Map()` (in-memory, lost between invocations) | Structured parse results. Humans read the source markdown, not parsed JSON |
| Enrichment cache | Computed fresh on every command | Derived data. Assembled from multiple sources for machine consumption |
| Session metrics | Partially in memory stores, partially in STATE.md | Invocation count, timing, velocity — pure machine data |
| Invocation log | Not stored today | Which commands ran, when, how long. Enables velocity/stuck detection |

### Markdown Only (Human Data)

Data that humans read, edit, and commit to git. SQLite never writes these.

| Data | Why Markdown Only |
|------|-------------------|
| ROADMAP.md | Humans review phase structure, goals, dependencies. Git diff shows what changed |
| PLAN.md files | Humans review task lists, verify instructions. Agents follow plan text |
| INTENT.md | Human-authored goals and success criteria |
| PROJECT.md | Project identity, constraints, decisions — human-curated |
| SUMMARY.md files | Post-execution narrative. Human reviews and commits |
| RESEARCH.md files | Research findings. Human reviews conclusions |

### Both (Derived from Markdown, Cached in SQLite)

Markdown is source of truth. SQLite stores parsed/structured version for fast queries.

| Data | Markdown Source | SQLite Derived |
|------|----------------|----------------|
| Phase list | ROADMAP.md `## Phase N:` headers | `phases` table: number, name, goal, status, depends_on |
| Plan metadata | PLAN.md frontmatter + XML sections | `plans` table: phase_id, plan_number, objective, task_count, status |
| Task list | PLAN.md `<task>` elements | `tasks` table: plan_id, name, type, files, status |
| Requirements | REQUIREMENTS.md checkboxes | `requirements` table: id, text, status, phase, plan |
| Current state | STATE.md `**Field:** Value` | `sessions` table: phase, plan, status, progress, last_activity |

### Both (SQLite is Source, Markdown is Generated View)

SQLite is source of truth. Markdown file is generated for human readability.

| Data | SQLite Source | Markdown Generated |
|------|--------------|-------------------|
| Session state | `sessions` table (position, metrics) | STATE.md — regenerated on each state change |
| Decisions | `decisions` table | decisions.json kept for backward compat during migration period |
| Lessons | `lessons` table | lessons.json kept for backward compat during migration period |
| Bookmarks | `bookmarks` table | bookmarks.json kept for backward compat during migration period |
<!-- /section -->

<!-- section: query_patterns -->
## Query Patterns for Planning Data

Real queries the CLI tool would run against structured planning data.

### Hot Path Queries (Every Invocation)

```sql
-- Enricher: get current project state (replaces 6+ file reads)
SELECT s.phase, s.plan, s.status, s.progress, s.last_activity,
       p.name as phase_name, p.goal as phase_goal
FROM sessions s
LEFT JOIN phases p ON s.phase = p.number
WHERE s.project_path = ?;

-- Enricher: get plan/summary counts for current phase
SELECT
  COUNT(*) FILTER (WHERE type = 'plan') as plan_count,
  COUNT(*) FILTER (WHERE type = 'summary') as summary_count
FROM plan_files
WHERE phase_number = ?;

-- Decision rule input: check if context gate is satisfied
SELECT 1 FROM sessions WHERE project_path = ? AND phase IS NOT NULL;
```

### Warm Path Queries (Specific Commands)

```sql
-- Progress route: determine which workflow path to take
SELECT
  s.phase, s.status,
  (SELECT COUNT(*) FROM plans WHERE phase_number = s.phase) as plan_count,
  (SELECT COUNT(*) FROM summaries WHERE phase_number = s.phase) as summary_count,
  (SELECT MAX(number) FROM phases) as highest_phase,
  (SELECT COUNT(*) FROM uat_gaps WHERE phase_number = s.phase AND status = 'diagnosed') as uat_gap_count
FROM sessions s
WHERE s.project_path = ?;

-- Search decisions across phases
SELECT d.*, p.name as phase_name
FROM decisions d
LEFT JOIN phases p ON d.phase = p.number
WHERE d.content LIKE '%' || ? || '%'
ORDER BY d.created_at DESC;

-- Velocity metrics: recent session durations
SELECT command, duration_ms, started_at
FROM invocations
WHERE project_path = ?
ORDER BY started_at DESC
LIMIT 20;
```

### Cold Path Queries (Rare Operations)

```sql
-- Requirement traceability: which plans cover which requirements
SELECT r.id, r.text, r.status, p.phase_number, p.plan_number
FROM requirements r
LEFT JOIN requirement_plan_map rpm ON r.id = rpm.requirement_id
LEFT JOIN plans p ON rpm.plan_id = p.id
ORDER BY r.id;

-- Phase dependency validation
SELECT p1.number, p1.name, p1.depends_on, p2.status as dependency_status
FROM phases p1
LEFT JOIN phases p2 ON p1.depends_on LIKE '%' || p2.number || '%'
WHERE p2.status != 'complete' AND p1.depends_on IS NOT NULL;
```
<!-- /section -->

<!-- section: migration_patterns -->
## Memory Store Migration Patterns

How to migrate from JSON files to SQLite tables without data loss.

### Migration Strategy: Gradual with Dual-Write

1. **Phase 1 — Schema + Import:** Create SQLite tables. On first run, detect existing JSON files and import all records. Rename JSON to `.json.migrated`.
2. **Phase 2 — Dual Write:** Write to both SQLite and JSON for one milestone. JSON serves as backup. If SQLite fails, fall back to JSON.
3. **Phase 3 — SQLite Only:** Remove JSON writing. Keep import capability for projects that haven't migrated yet.

### Table Designs for Memory Stores

```sql
-- Decisions (from decisions.json)
CREATE TABLE decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_path TEXT NOT NULL,
  phase TEXT,
  plan TEXT,
  decision TEXT NOT NULL,
  rationale TEXT,
  outcome TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sacred INTEGER NOT NULL DEFAULT 0  -- compaction protection
);
CREATE INDEX idx_decisions_project ON decisions(project_path);
CREATE INDEX idx_decisions_phase ON decisions(project_path, phase);

-- Lessons (from lessons.json)
CREATE TABLE lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_path TEXT NOT NULL,
  phase TEXT,
  lesson TEXT NOT NULL,
  category TEXT,
  impact TEXT,  -- HIGH/MEDIUM/LOW
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sacred INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_lessons_project ON lessons(project_path);

-- Bookmarks (from bookmarks.json)
CREATE TABLE bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_path TEXT NOT NULL,
  phase TEXT,
  plan TEXT,
  task TEXT,
  last_file TEXT,
  git_head TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_bookmarks_project ON bookmarks(project_path);

-- Trajectories (from trajectories.json / trajectory decision journal)
CREATE TABLE trajectories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_path TEXT NOT NULL,
  phase TEXT,
  plan TEXT,
  task TEXT,
  level TEXT,  -- 'task', 'plan', 'phase'
  type TEXT,   -- 'checkpoint', 'pivot', 'dead-end'
  reason TEXT,
  branch TEXT,
  metrics TEXT,  -- JSON blob
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sacred INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_trajectories_project ON trajectories(project_path);
```

### Sacred Data Protection in SQLite

Current memory stores have "sacred data protection" — compaction guards that prevent automated cleanup from deleting important entries. In SQLite:

- `sacred INTEGER NOT NULL DEFAULT 0` column on all memory tables
- Sacred rows: `sacred = 1`, never auto-deleted
- Compaction query: `DELETE FROM decisions WHERE sacred = 0 AND created_at < datetime('now', '-30 days') AND project_path = ?`
- Import preserves sacred flags from JSON source
<!-- /section -->

<!-- section: mvp -->
## MVP Definition

### Launch With (v12.0 Phase 1-2)

Minimum viable structured data layer — enough to prove the architecture and deliver measurable speedup.

- [ ] Schema versioning with migration runner — foundation for all subsequent work
- [ ] Planning data tables (phases, plans, tasks) — populated from markdown parsers on first run
- [ ] Git-hash or mtime invalidation — ensure cached data stays fresh
- [ ] Enricher acceleration — replace file-scanning with SQL queries, fix 3x/2x duplication
- [ ] Session state in SQLite — position and metrics, STATE.md becomes generated view
- [ ] Backward-compatible Map fallback — graceful degradation on Node < 22.5

### Add After Validation (v12.0 Phase 3-4)

Features to add once core tables and enricher are working.

- [ ] Memory store migration (decisions, lessons, bookmarks, trajectories) — triggered when structured tables proven stable
- [ ] Cross-entity queries for search commands — `/bgsd-search-decisions` uses SQL
- [ ] Query-based decision inputs — decision rules consume SQL instead of enricher JSON
- [ ] New deterministic decisions (6-8 rules) — leverage SQL-backed state for faster evaluation
- [ ] Atomic multi-file updates — wrap related writes in transactions

### Future Consideration (v13+)

Features to defer until the data layer is battle-tested.

- [ ] FTS5 full-text search — when decision/lesson volumes justify it (>1000 entries)
- [ ] Materialized enrichment views with triggers — when enrichment query is measured bottleneck
- [ ] WAL mode for parallel agent access — when multi-agent parallelism is attempted
- [ ] SQLite session/changeset tracking — when undo/redo or audit trail is needed
- [ ] Database backup/restore CLI commands — when users request data portability
- [ ] Per-project database option — when config-dir approach proves limiting
<!-- /section -->

<!-- section: prioritization -->
## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Schema versioning + migrations | HIGH | LOW | P1 |
| Planning data tables (phases, plans, tasks) | HIGH | HIGH | P1 |
| Git-hash/mtime invalidation | HIGH | MEDIUM | P1 |
| Enricher deduplication/acceleration | HIGH | MEDIUM | P1 |
| Session state persistence | HIGH | HIGH | P1 |
| Backward-compatible fallback | HIGH | MEDIUM | P1 |
| Memory store migration | MEDIUM | MEDIUM | P2 |
| Cross-entity SQL queries | MEDIUM | LOW | P2 |
| Query-based decision inputs | MEDIUM | MEDIUM | P2 |
| New deterministic decisions | MEDIUM | MEDIUM | P2 |
| Atomic multi-file updates | MEDIUM | LOW | P2 |
| FTS5 full-text search | LOW | MEDIUM | P3 |
| Materialized enrichment views | LOW | HIGH | P3 |
| WAL mode | LOW | LOW | P3 |
| Session/changeset tracking | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for v12.0 launch — defines the milestone
- P2: Should have in v12.0 — add in later phases if time permits
- P3: Future consideration — defer to v13+
<!-- /section -->

<!-- section: competitors -->
## Comparable CLI Tool Patterns

Tools that use SQLite as an application database (not just cache).

| Pattern | Example Tools | How They Do It | Our Approach |
|---------|---------------|----------------|--------------|
| SQLite as app file format | Fossil SCM, Firefox, Android | Single DB file IS the application state. All data in tables. | Hybrid: markdown is human interface, SQLite is machine interface. DB is derived cache, not source of truth for human-facing data |
| Git-backed + SQLite index | Jujutsu (jj), various IDEs | Git stores content, SQLite indexes it for fast queries | Similar: `.planning/` markdown in git, SQLite indexes parsed structures |
| Structured cache with invalidation | Turborepo, Nx | Hash-based cache keys, structured task graph in memory/SQLite | Our git-hash invalidation follows this pattern exactly |
| Session persistence for CLI | GitHub CLI (gh), AWS CLI | Store auth, preferences, history in config-dir SQLite/JSON | We extend to store planning state, metrics, invocation history |
| Schema migrations in embedded DB | Django (with SQLite), Alembic, knex | Numbered migration files, `schema_version` table, transaction-wrapped | Same pattern, but simpler: single `schema_meta` table, JS migration functions, no ORM |

### Key Insight from Comparable Tools

The strongest pattern across successful CLI tools with SQLite backends is the **"derived index" model**: the canonical data lives in files (often in a git repo), and SQLite provides a fast queryable index over that data. This is exactly the hybrid markdown+SQLite architecture described in this research.

Tools that make SQLite the SOLE source of truth (like Fossil) work well for their domain but require users to interact through the tool exclusively. Our users interact with markdown files directly (reading, editing, committing), so SQLite must be a derived layer, not the primary store — with the notable exception of pure machine data (session metrics, invocation logs, parse caches) where SQLite IS the primary store.

## Sources

- Node.js official documentation: `node:sqlite` API (v25.8.1, Stability 1.2 Release Candidate) — [HIGH confidence]
- SQLite official documentation: "SQLite As An Application File Format" whitepaper — [HIGH confidence]
- Existing codebase analysis: `src/lib/cache.js` (752 lines), `src/plugin/command-enricher.js` (340 lines), `src/plugin/project-state.js` (67 lines), 6 plugin parsers, `src/lib/decision-rules.js` (467 lines), `src/commands/init.js` memory store access (L1640-1770) — [HIGH confidence, direct source]
- Ben Johnson / Fly.io: "All-In on Server-Side SQLite" (2022) — architecture patterns — [MEDIUM confidence, web article]
- PROJECT.md v12.0 target features — [HIGH confidence, direct source]
<!-- /section -->

---
*Feature research for: SQLite-first data layer in CLI development tools*
*Researched: 2026-03-14*
