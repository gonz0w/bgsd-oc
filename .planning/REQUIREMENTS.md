# Requirements — v12.0 SQLite-First Data Layer

## Foundation & Schema

- [x] **FND-01**: User can run any bGSD command on Node 22.5+ and have a project-local SQLite database automatically created at `.planning/.cache.db` with schema versioning
- [x] **FND-02**: User can upgrade to a new bGSD version and have schema migrations run automatically on first command, preserving all existing data
- [x] **FND-03**: User can run any bGSD command on Node <22.5 and have all features work via Map fallback with no errors
- [x] **FND-04**: User can run bGSD commands with WAL mode and busy timeout enabled, preventing database locking under concurrent invocations

## Planning Tables

- [x] **TBL-01**: User can query phases from SQLite instead of re-parsing ROADMAP.md on cache hit
- [x] **TBL-02**: User can query plans (frontmatter, task counts, completion status) from SQLite instead of re-parsing plan markdown
- [x] **TBL-03**: User can query requirements from SQLite with REQ-ID lookups and phase mapping
- [x] **TBL-04**: User can trust that SQLite planning data stays fresh via git-hash + mtime hybrid invalidation after edits and commits

## Enricher Acceleration

- [ ] **ENR-01**: User can run any `/bgsd-*` command and have the enricher complete without redundant parser calls (zero 3x/2x duplication)
- [ ] **ENR-02**: User can run commands with warm SQLite cache and have enrichment data served from SQL queries instead of file re-parsing
- [ ] **ENR-03**: User can observe measurably faster command startup when SQLite cache is warm vs cold

## Memory Store Migration

- [ ] **MEM-01**: User can search decisions, lessons, and trajectories via SQL queries without full JSON.parse of entire files
- [ ] **MEM-02**: User can trust that sacred data (decisions, lessons, trajectories) is migrated to SQLite while JSON backup files are preserved
- [ ] **MEM-03**: User can add new bookmarks and have them written to both SQLite and JSON (dual-write during transition)

## Decision Rules

- [ ] **DEC-01**: User can have model selection resolved deterministically from config + agent role without subprocess calls
- [ ] **DEC-02**: User can have verification routing resolved deterministically from config + plan state
- [ ] **DEC-03**: User can have research gate resolved deterministically from config + file existence
- [ ] **DEC-04**: User can have phase readiness resolved deterministically from roadmap + plan + blocker state
- [ ] **DEC-05**: User can have milestone completion resolved deterministically from roadmap progress data
- [ ] **DEC-06**: User can have commit strategy resolved deterministically from config + change state

## Session State

- [ ] **SES-01**: User can have current position, last activity, and performance metrics persisted in SQLite across invocations
- [ ] **SES-02**: User can have STATE.md regenerated from SQLite state, ensuring markdown and SQL are always consistent
- [ ] **SES-03**: User can view accumulated context (decisions, todos, blockers) from SQLite without parsing STATE.md

## Future Requirements

_None deferred — all 6 categories selected for v12.0._

## Out of Scope

- **ORM layer** — Zero-dependency constraint; raw SQL with prepared statements is sufficient
- **Async SQLite (node:sqlite/promises)** — CLI is synchronous by design; async adds complexity without benefit
- **Full-text search (FTS5)** — Overkill for planning data volumes; simple LIKE queries sufficient
- **SQLite as only format** — Markdown files must remain human-readable and git-trackable
- **Migration file system** — Incompatible with single-file deploy; inline migration functions only
- **better-sqlite3** — Duplicates built-in node:sqlite; adds native dependency

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FND-01 | Phase 118 | Complete |
| FND-02 | Phase 118 | Complete |
| FND-03 | Phase 118 | Complete |
| FND-04 | Phase 118 | Complete |
| TBL-01 | Phase 119 | Complete |
| TBL-02 | Phase 119 | Complete |
| TBL-03 | Phase 119 | Complete |
| TBL-04 | Phase 119 | Complete |
| ENR-01 | Phase 120 | Pending |
| ENR-02 | Phase 120 | Pending |
| ENR-03 | Phase 120 | Pending |
| MEM-01 | Phase 121 | Pending |
| MEM-02 | Phase 121 | Pending |
| MEM-03 | Phase 121 | Pending |
| DEC-01 | Phase 122 | Pending |
| DEC-02 | Phase 122 | Pending |
| DEC-03 | Phase 122 | Pending |
| DEC-04 | Phase 122 | Pending |
| DEC-05 | Phase 122 | Pending |
| DEC-06 | Phase 122 | Pending |
| SES-01 | Phase 123 | Pending |
| SES-02 | Phase 123 | Pending |
| SES-03 | Phase 123 | Pending |
