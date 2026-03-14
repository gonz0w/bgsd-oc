# Phase 121: Memory Store Migration - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate sacred data (decisions, lessons, trajectories, bookmarks) from JSON files to SQLite for SQL-based search and queries, while preserving JSON files as git-trackable backups. Existing commands become faster/richer by using SQL under the hood.

</domain>

<decisions>
## Implementation Decisions

### Migration Trigger
- Auto-migrate on first run — detect missing SQLite tables and migrate silently on any bgsd-tools command
- If migration fails partway (e.g., corrupt JSON), abort and retry on next run — no partial migrations
- Silent unless errors — no output on successful migration
- Migration is idempotent — JSON is always the source, SQLite can be rebuilt from it at any time by deleting the DB

### Search Interface
- Enhance existing commands (e.g., /bgsd-search-decisions) to use SQL under the hood — no new user-facing commands
- Primary search mode is full-text search across content ("find decisions mentioning auth")
- Rich results — include phase number, date, and a snippet showing the match in context
- Expose a bgsd-tools subcommand (e.g., `memory:search --type decisions --query 'auth'`) so agents (researcher, planner) can query sacred data programmatically

### Dual-Write Boundaries
- JSON is always canonical — source of truth lives in JSON files committed to git
- Dual-write is transitional — a future phase will evaluate and potentially drop JSON writes
- Best effort on both writes — write to both stores, warn if one fails, don't roll back the other

### Data Modeling
- Separate tables per sacred data type — decisions, lessons, trajectories, bookmarks each have their own table
- Use SQLite FTS5 for full-text search with ranking and fast lookups
- Schema mirrors JSON structure — columns match JSON fields directly for easy back-and-forth mapping
- SQLite database lives inside `.planning/` (project-scoped), matching current JSON file location

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 0121-memory-store-migration*
*Context gathered: 2026-03-14*
