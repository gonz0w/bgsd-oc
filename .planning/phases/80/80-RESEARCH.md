# Phase 80 Research: SQLite Statement Cache Acceleration

**Phase:** 80
**Requirement:** RUNT-02
**Researched:** 2026-03-10

## Requirement

**RUNT-02**: User can get reduced cache-layer tail latency through SQLite statement caching.

## Goal

Cache-heavy command paths show lower tail latency through SQLite statement caching with compatibility fallback.

## Success Criteria

1. User can run cache-heavy flows and observe reduced high-percentile latency.
2. Maintainer can verify statement caching can be bypassed safely when runtime support is unavailable.

## Existing Research Context

See: `.planning/research/SUMMARY.md` (lines 16, 28, 59, 112)

### Key Findings from Project Research

- **P3 Priority**: `node:sqlite` statement cache (`DatabaseSync#createTagStore`) — built-in, lower tail latency in cache-heavy command flows
- **Implementation target**: Enable SQLite statement reuse via tag store in `src/lib/cache.js`
- **Wave 3 rollout**: Enable bounded cache improvements and SQLite statement caching after shadow validation

## Technical Details

### Current State

The `SQLiteBackend` class in `src/lib/cache.js` currently:
- Uses `db.prepare()` for each cache operation (get/set)
- Creates a new prepared statement on every call
- This adds overhead for repeated cache operations in hot paths

### Optimization Target

Use `DatabaseSync#createTagStore()` to create reusable tagged statements:
- Pre-compile SQL statements once
- Reuse across multiple get/set operations
- Reduce CPU overhead in cache-heavy command flows

### Fallback Requirements

- Must work on Node.js 22.5+ where `node:sqlite` is available
- Must gracefully handle when statement caching API is unavailable
- Must maintain Map backend as fallback
- Must preserve existing cache contracts (mtime validation, TTL, LRU eviction)

## Codebase Context

### Files to Modify

- `src/lib/cache.js` — SQLiteBackend class (lines 62-97 for get, ~100+ for set)

### Existing Patterns

- Phase 51 established the SQLite backend with `node:sqlite`
- Phase 79 added compile-cache with env var guard (`BGSD_COMPILE_CACHE`)
- Pattern: use env var for opt-in, check capability at runtime, graceful fallback

## Implementation Considerations

1. **API Usage**: `createTagStore()` returns a store with `.get(key)` and `.set)` methods
2(key, value. **Migration**: Can keep existing `prepare()` path as fallback if tag store fails
3. **Testing**: Benchmark before/after to verify tail latency reduction
4. **Debugging**: Add `BGSD_DEBUG=1` output for cache statistics

## Risk Assessment

- **Risk**: Low — uses built-in Node.js API, existing fallback infrastructure
- **Compatibility**: Node 22.5+ required (already stated in PROJECT.md)
- **Rollback**: Flag-based disable (`BGSD_SQLITE_STATEMENT_CACHE=0`)

---

*Research source: Project research SUMMARY.md, existing cache.js implementation*
