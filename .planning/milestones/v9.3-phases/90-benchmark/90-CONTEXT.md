# Phase 90: Benchmark - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Plugin benchmark adapter built for cross-plugin comparison. Captures baseline metrics for v9.3 including startup time, command execution time, memory usage, and context loading. Users can run benchmarks to measure plugin performance. This is a developer tool, not exposed in production builds.

</domain>

<decisions>
## Implementation Decisions

### Output format
- Table format by default (human-readable, formatted columns)
- Full metrics shown on demand with --verbose flag
- No JSON flag — table only, keep it simple

### Metrics captured
- All metrics measured: startup time, command execution, memory usage, context load time
- Controlled via build-time feature flag (compile with/without benchmarks)
- Feature flag removed in production builds for lean deployment

### Benchmark methodology
- Single run execution (one execution, report that result)
- Report both cold start and warm cache results
- Gives complete picture of cold start vs warm cache performance

### CLI interface
- Undocumented subcommand: `/bgsd-measure`
- Documentation behind a feature flag (not visible in production)
- Keeps user-facing interface clean while accessible for development

### Agent's Discretion
- Exact benchmark command structure and subcommands
- Specific metrics included in "full metrics" view
- How to implement the build-time feature flag

</decisions>

<specifics>
## Specific Ideas

- "This is for developers only" — benchmark tool is internal, not for end users
- "Might want a flag to exclude it from final builds" — implemented as build-time feature flag
- Both cold start and warm cache results for comprehensive performance data

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 90-benchmark*
*Context gathered: 2026-03-10*
