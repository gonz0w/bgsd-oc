# Phase 119: Parser Integration & Planning Tables - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Parsed planning data (phases, plans, tasks, requirements) persists in SQLite across invocations — queries replace markdown re-parsing on cache hit. All existing commands that read planning data switch to SQLite queries in this phase.

</domain>

<decisions>
## Implementation Decisions

### Cache Invalidation Behavior
- Use **mtime only** for detecting markdown file changes (no git hash checks)
- Invalidation is **per-file** — only re-parse the specific file(s) that changed
- **No manual cache-bust command** — cache should self-heal automatically
- Check all mtimes **eagerly at command startup**, re-parse any stale files upfront before the command proceeds

### Table Schema Design
- Use **normalized tables** with foreign keys — separate tables for phases, plans, tasks, requirements, etc.
- **Store raw markdown snippets** alongside parsed fields to enable output reconstruction without re-reading files
- On schema change, **destroy and rebuild** the entire DB from markdown — no versioned migrations
- **Store computed/derived values** (progress percentages, task counts, completion status) during parse for faster reads

### Data Freshness Guarantees
- **Never serve stale data** — if freshness can't be verified, always fall back to re-parsing markdown
- Use **write-through** caching — when a command writes to a markdown file, update the SQLite cache in the same operation
- DB file lives **inside .planning/** directory
- Gitignore policy: **user decides** — don't auto-add to .gitignore

### Migration from Parsing to Queries
- **Convert all commands** that read planning data to use SQLite queries in this phase (not incremental)
- Support **transparent parse-on-miss** — if data isn't in SQLite, command triggers parse + insert automatically (self-healing)
- **Keep existing parsers as-is** — cache layer calls current parsers and stores their output in SQLite
- Caching is **silent** — no performance logging or timing output, just invisibly faster

### Agent's Discretion
None — all areas had explicit decisions from the user.

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for SQLite schema and caching implementation.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 0119-parser-integration-planning-tables*
*Context gathered: 2026-03-14*
