# Phase 52: Cache Integration & Warm-up - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the cache module (built in Phase 51) into all hot-path file readers and add a warm command for pre-population. This is an internal infrastructure phase focused on performance — the cache should work transparently without changing visible behavior.

</domain>

<decisions>
## Implementation Decisions

### Cache warming behavior
- **Mode**: Hybrid — auto-warm on first use, manual for full rebuild
- **Priority**: All `.planning/` files equally
- **Output**: Count of files + time taken
- **Auto-warm message**: Brief message like "Warming cache... X files"

### Test parity strategy
- **Fallback controls**: Both env var (`GSD_CACHE_FORCE_MAP=1`) AND `--no-cache` flag
- **Default**: Cache enabled (normal usage)
- **Verification**: Both modes must pass (run tests twice: cache on + cache off)

### Performance measurement
- **Metrics shown**: Both overall timing + hit/miss breakdown
- **Display**: Verbose only (-v flag)

### Error handling
- **Initialization/read/write failures**: Warn once, then silent fallback for session
- **Corruption**: Detect and rebuild automatically (self-healing)

</decisions>

<specifics>
## Specific Ideas

No specific references — decisions are straightforward infrastructure patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 52-cache-integration-warm-up*
*Context gathered: 2026-03-02*
