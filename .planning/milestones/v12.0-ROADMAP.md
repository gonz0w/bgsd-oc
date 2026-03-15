# Roadmap: bGSD Plugin — v12.0 SQLite-First Data Layer

## Overview

This milestone transforms SQLite from a dumb file cache into the structured data backbone for all workflow operations. Foundation work (DataStore class, schema versioning, migrations) enables everything that follows. Parser integration populates structured tables with write-through caching. Enricher acceleration eliminates hot-path duplication for the biggest user-visible speedup. Memory store migration carefully moves sacred data to SQLite while preserving JSON backups. New deterministic decision rules consume SQLite-backed state. Finally, session state moves to SQLite with STATE.md becoming a generated view — the most architecturally aggressive change, saved for last when the data layer is proven stable.

## Phases

- [x] **Phase 118: Foundation & Schema** - DataStore class with schema versioning, migration runner, WAL mode, and Map fallback (completed 2026-03-14)
- [x] **Phase 119: Parser Integration & Planning Tables** - Write-through cache for parsers with git-hash + mtime invalidation (completed 2026-03-14)
- [x] **Phase 120: Enricher Acceleration** - Eliminate 3x/2x parser duplication with SQL-backed enrichment (completed 2026-03-14)
- [x] **Phase 121: Memory Store Migration** - Sacred data (decisions, lessons, trajectories, bookmarks) to SQLite with JSON backup (completed 2026-03-14)
- [x] **Phase 122: Decision Rules** - Six new deterministic decision functions consuming SQLite state (completed 2026-03-14)
- [x] **Phase 123: Session State** - Session persistence in SQLite with STATE.md as generated view (completed 2026-03-15)

## Phase Details

### Phase 118: Foundation & Schema
**Goal**: Every bGSD command has access to a reliable, version-managed SQLite database with automatic schema migrations and graceful fallback on older Node versions
**Depends on**: Nothing (first phase)
**Requirements**: FND-01, FND-02, FND-03, FND-04
**Success Criteria** (what must be TRUE):
  1. User can run any bGSD command on Node 22.5+ and have `.planning/.cache.db` created automatically with correct schema version
  2. User can upgrade bGSD versions and have schema migrations run transparently on first command — no data loss, no manual steps
  3. User can run any bGSD command on Node <22.5 and have all features work identically via Map fallback with no errors
  4. User can run concurrent bGSD commands (multiple terminals, git hooks) without database locking errors
**Plans**: 3/3 plans complete

### Phase 119: Parser Integration & Planning Tables
**Goal**: Parsed planning data (phases, plans, tasks, requirements) persists in SQLite across invocations — queries replace markdown re-parsing on cache hit
**Depends on**: Phase 118
**Requirements**: TBL-01, TBL-02, TBL-03, TBL-04
**Success Criteria** (what must be TRUE):
  1. User can query phase data from SQLite without triggering ROADMAP.md parsing when cache is valid
  2. User can query plan metadata (frontmatter, task counts, status) from SQLite without re-reading plan markdown files
  3. User can look up requirements by REQ-ID and see phase mappings from SQLite
  4. User can edit a planning markdown file and have SQLite cache automatically invalidated on next command via git-hash + mtime check
**Plans**: 3/3 plans complete
  - Plan 01 (Wave 1): Schema + PlanningCache core layer
  - Plan 02 (Wave 2): Parser integration with SQLite-first write-through
  - Plan 03 (Wave 3): Comprehensive test suite

### Phase 120: Enricher Acceleration
**Goal**: The command enricher serves all workflow data from SQLite on warm starts — zero redundant parser calls, measurably faster command startup
**Depends on**: Phase 119
**Requirements**: ENR-01, ENR-02, ENR-03
**Success Criteria** (what must be TRUE):
  1. User can run any `/bgsd-*` command and have enrichment complete with zero redundant parser calls (no 3x listSummaryFiles, no 2x parsePlans)
  2. User can run commands with warm SQLite cache and have enrichment data served from SQL queries instead of file re-parsing
  3. User can observe measurably faster command startup with warm SQLite cache compared to cold start (target: enricher <50ms on warm)
**Plans**: 2/2 plans complete
  - Plan 01 (Wave 1): Eliminate duplication + SQLite-first enrichment queries
  - Plan 02 (Wave 2): Timing instrumentation, background warm-up, test suite

### Phase 121: Memory Store Migration
**Goal**: Sacred data (decisions, lessons, trajectories, bookmarks) is searchable via SQL queries while JSON files are preserved as git-trackable backups
**Depends on**: Phase 118
**Requirements**: MEM-01, MEM-02, MEM-03
**Success Criteria** (what must be TRUE):
  1. User can search decisions, lessons, and trajectories via SQL queries without JSON.parse of entire files
  2. User can verify that all sacred data was migrated to SQLite with zero loss — JSON backup files remain untouched on disk
  3. User can add new bookmarks and have them written to both SQLite and JSON (dual-write ensures no data loss during transition)
**Plans**: 3/3 plans complete
  - Plan 01 (Wave 1): Schema migration + PlanningCache memory methods
  - Plan 02 (Wave 2): Dual-write integration + SQL-powered reads
  - Plan 03 (Wave 3): Comprehensive test suite

### Phase 122: Decision Rules
**Goal**: Six new deterministic decision functions resolve common workflow questions from SQLite-backed state — no subprocess calls, no LLM inference needed
**Depends on**: Phase 120
**Requirements**: DEC-01, DEC-02, DEC-03, DEC-04, DEC-05, DEC-06
**Success Criteria** (what must be TRUE):
  1. User can have model selection resolved deterministically from config + agent role without subprocess calls
  2. User can have verification routing, research gate, and phase readiness resolved deterministically from SQLite-backed state
  3. User can have milestone completion and commit strategy resolved deterministically from roadmap/change data
  4. User can run `decisions list` and see all 6 new rules registered alongside existing v11.3 rules
**Plans**: 2/2 plans complete
  - Plan 01 (Wave 1): DB migration + decision functions + PlanningCache methods
  - Plan 02 (Wave 2): Enricher integration + model consumer migration + test suite

### Phase 123: Session State
**Goal**: Session state (position, metrics, accumulated context) lives in SQLite — STATE.md becomes a generated view ensuring markdown and SQL are always consistent
**Depends on**: Phase 119
**Requirements**: SES-01, SES-02, SES-03
**Success Criteria** (what must be TRUE):
  1. User can have current position, last activity, and performance metrics persist in SQLite across invocations without parsing STATE.md
  2. User can regenerate STATE.md from SQLite state and get identical content — SQL is the programmatic source of truth
  3. User can view accumulated context (decisions, todos, blockers) from SQLite without parsing STATE.md
**Plans**: 3/3 plans complete
  - Plan 01 (Wave 1): Schema migration + PlanningCache session state methods
  - Plan 02 (Wave 2): SQL-first state commands + STATE.md regeneration
  - Plan 03 (Wave 3): Plugin-side SQLite reads + comprehensive test suite

## Progress

**Execution Order:**
Phases execute in numeric order: 118 → 119 → 120 → 121 → 122 → 123

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 118. Foundation & Schema | 3/3 | Complete    | 2026-03-14 |
| 119. Parser Integration & Planning Tables | 2/3 | Complete    | 2026-03-14 |
| 120. Enricher Acceleration | 2/2 | Complete    | 2026-03-14 |
| 121. Memory Store Migration | 0/3 | Complete    | 2026-03-14 |
| 122. Decision Rules | 2/2 | Complete    | 2026-03-14 |
| 123. Session State | 2/3 | Complete    | 2026-03-15 |
