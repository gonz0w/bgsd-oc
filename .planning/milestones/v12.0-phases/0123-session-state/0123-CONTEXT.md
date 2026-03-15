# Phase 123: Session State - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Session state (position, metrics, accumulated context) moves from STATE.md parsing to SQLite as the programmatic source of truth. STATE.md becomes a generated view — regenerated from SQLite data — ensuring markdown and SQL are always consistent.

</domain>

<decisions>
## Implementation Decisions

### Migration Behavior
- Auto-migrate silently on first access — no user action or explicit command required
- No backup of original STATE.md needed (it gets regenerated from SQLite anyway)
- Best-effort parse of existing STATE.md — same tolerance as current parsers, no special handling for manual edits
- Check STATE.md freshness each run (mtime or hash) rather than flagging migration as done once — supports ongoing external edits

### Generated View Format
- Improved format allowed — this is an opportunity to clean up STATE.md layout since it's now generated
- Position and metrics are the most important at-a-glance sections — prioritize these at the top
- No auto-generated marker (no `<!-- Generated -->` comment) — keep it looking like a normal markdown file
- Sections that move to SQLite-only (detailed decision history, blocker logs, etc.) should be omitted from STATE.md — only show what's useful for at-a-glance reading

### State Granularity
- All state data becomes queryable in SQLite: position tracking, decisions, performance metrics, blockers, session continuity
- Decisions stored as individual rows (one per decision) with columns for key, value, confidence, timestamp, context
- Append-only history for all state changes — enables timeline queries and historical analysis
- Metrics: store both raw events (task completed at time X) AND cache pre-computed metrics for fast access
- Todos extended with metadata beyond current STATE.md fields: priority, category, created/completed timestamps
- Blockers track full lifecycle: created date, resolved date, resolution notes, linked decision
- Session continuity stores position info only (phase/plan/task, stopped-at, resume hints) — no file tracking
- Cross-milestone queries supported — all state has a milestone column enabling queries across milestone boundaries

### Sync Model
- SQL-first writes: all state changes go to SQLite first, then STATE.md is regenerated from SQL data
- STATE.md regeneration batched per command — write to SQL during command execution, regenerate MD once when command completes
- Manual STATE.md edits are re-imported into SQLite on detection (mtime/hash change)
- On conflict between SQLite and manual STATE.md edit, STATE.md wins — manual edits are treated as intentional user corrections

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

*Phase: 0123-session-state*
*Context gathered: 2026-03-14*
