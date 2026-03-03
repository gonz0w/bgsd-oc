# Phase 51: Cache Foundation - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

SQLite cache module with staleness detection, write invalidation, and graceful degradation for Node version compatibility. This is a foundational module — it provides caching but doesn't yet wire it into hot paths (Phase 52).

</domain>

<decisions>
## Implementation Decisions

### Cache Interface
- CLI commands: `gsd-tools cache status`, `gsd-tools cache clear`, `gsd-tools cache warm`
- `cache status` reports: backend type (SQLite vs Map fallback), entry count, hit/miss statistics, memory usage
- No config option to disable cache — always active
- Cache warm-up: both manual (`gsd-tools cache warm`) and automatic (lazy on first read)

### Invalidation Strategy
- Staleness detection: combination of file modification + TTL
- File change detection: check mtime on every read (stat + mtime comparison)
- Maximum cache size: configurable, default 1000 entries (LRU eviction)
- Manual invalidation: `gsd-tools cache clear` clears all entries

### Fallback Behavior
- Node version detection: check `process.version` at runtime
- When SQLite unavailable: use in-memory Map as transparent fallback
- Startup logging: warn when SQLite unavailable, using Map fallback
- Force Map fallback: environment variable `GSD_CACHE_FORCE_MAP=1`

### Data Consistency
- Write-through invalidation: immediately invalidate cache entry when file is written via gsd-tools
- External change detection: check mtime on every read
- Consistency model: last-write-wins
- No checksum verification — trust filesystem

### Agent's Discretion
- Exact TTL value (e.g., 1 hour default)
- LRU eviction implementation details
- Memory usage reporting format
- Warning message wording

</decisions>

<specifics>
## Specific Ideas

- "gsd-tools cache status" should feel like familiar status commands — show backend, entry count, stats
- Cache should be invisible to users who don't invoke commands — lazy loading
- Fallback must be transparent — no code changes needed when switching between SQLite and Map

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 51-cache-foundation*
*Context gathered: 2026-03-02*
