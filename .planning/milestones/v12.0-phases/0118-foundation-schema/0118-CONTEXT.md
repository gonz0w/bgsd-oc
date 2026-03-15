# Phase 118: Foundation & Schema - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Provide every bGSD command with a reliable, version-managed SQLite database (`.planning/.cache.db`) with automatic schema migrations and graceful Map fallback on Node <22.5. This phase delivers the database layer foundation — no consumers, no cache population, just the infrastructure.

</domain>

<decisions>
## Implementation Decisions

### Fallback Transparency
- Map fallback on Node <22.5 shows a **once-per-session notice** via the **status bar / plugin** mechanism — not stderr, not silent
- Both SQLite and Map backends implement the **exact same interface** — callers never know which is active
- **No force-fallback option** — auto-detect only, keep it simple
- When Node is upgraded from <22.5 to 22.5+, **auto-switch to SQLite with a notice** ("Upgraded to SQLite backend")
- On auto-switch, **start fresh** — no data migration from Map (it's in-memory only anyway)
- Map fallback is **in-memory only** — no JSON file persistence, cache rebuilds each session

### Agent's Discretion: Backend Pattern
- Agent decides the abstraction pattern (factory function, class hierarchy, etc.) for the dual-backend interface

### Migration Failure Behavior
- On migration failure: **delete and rebuild** the DB from scratch — it's a cache, data loss is acceptable
- Failed rebuild is **silent** — no user-facing error message about the rebuild itself
- Migrations run inside **transactions** — atomic success or full rollback
- Schema version tracked via **PRAGMA user_version** — simple, atomic, no extra table

### Cache Lifecycle
- `.cache.db` is **always gitignored** — add to `.planning/.gitignore`
- **Soft size limit with warning** — warn if DB exceeds threshold but don't auto-truncate
- **Add cache clearing to /bgsd-cleanup** command (extend existing command)
- DB created **eagerly on any command** — ensure it exists at startup, no first-use latency surprises

### Startup Messaging
- First-ever creation shows a **brief notice** ("Initialized bGSD cache") via **status bar / plugin**
- Successful schema migrations are **silent** — no user-facing message
- **No debug timing output** in this phase — keep it simple

</decisions>

<specifics>
## Specific Ideas

- Status bar / plugin is the consistent delivery mechanism for all notices (fallback mode, first creation, Node upgrade switch)
- "It's just a cache" philosophy governs all failure/recovery decisions — delete and rebuild is always acceptable
- PRAGMA user_version is the version tracking mechanism — no migrations table

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 0118-foundation-schema*
*Context gathered: 2026-03-14*
