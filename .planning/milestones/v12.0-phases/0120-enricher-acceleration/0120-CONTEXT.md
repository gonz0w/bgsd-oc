# Phase 120: Enricher Acceleration - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

The command enricher serves all workflow data from SQLite on warm starts — zero redundant parser calls, measurably faster command startup. The enricher currently calls `parseRoadmap`, `parsePlan`, `listSummaryFiles`, etc. on every `/bgsd-*` command invocation. This phase rewires the enricher to query SQLite first (populated by Phase 119), falling back to parsers only on cache miss.

</domain>

<decisions>
## Implementation Decisions

### Warm-up Strategy
- **Lazy parse-and-store on miss**: When a query finds no cached data, parse the file, store result in SQLite, then return it. Only cache what's actually needed — no eager full-table population on first call.
- **Cache full parse results**: When a file IS parsed (e.g., roadmap for one phase), store ALL data from that parse (all phases). The parse cost is already paid; marginal storage cost is near-zero.
- **Mtime check per call**: Compare file mtime against cached timestamp on each enricher call. Re-parse if file is newer. Correctness over speed — `stat()` is cheap.
- **Background warm on plugin load**: When the plugin initializes (editor startup), kick off a background cache warm-up so the first user command already has a warm cache.

### Agent's Discretion
- Cache invalidation implementation details (exact mtime storage format, comparison logic)
- Fallback and degradation behavior on SQLite corruption or missing DB
- Timing observability approach (debug logging, metrics format)
- Whether to batch mtime checks or check per-file individually

</decisions>

<specifics>
## Specific Ideas

- The plugin's `command.enrich` hook is the integration point — it currently builds the enrichment object from scratch each call
- Phase 119 provides the SQLite tables with parsed planning data
- The <50ms warm-start target from success criteria should guide implementation tradeoffs

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 120-enricher-acceleration*
*Context gathered: 2026-03-14*
