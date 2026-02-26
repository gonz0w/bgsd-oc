# Phase 26: Init Integration & Context Summary - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire codebase analysis (from Phases 24-25) into init commands. Provide a compact summary (<500 tokens) of codebase stats, conventions, and dependency overview in every init output. Auto-trigger quick analysis when data is stale. Analysis failures degrade silently — never crash init commands.

</domain>

<decisions>
## Implementation Decisions

### Summary content & shape
- All three data sources compressed into the budget: file/language stats, convention summary, dependency overview
- Format optimized for agent consumption, not human readability — structured JSON fields
- Per-section confidence scores included (stats confidence, conventions confidence, deps confidence) so agents know how much to trust each section
- Dependency overview granularity: Agent's discretion — pick what fits within the token budget

### Staleness & auto-trigger
- Hybrid staleness detection: commit-based (HEAD changed) OR time-based (>1 hour old)
- Quick mode (<200ms): serve cached data immediately, spawn detached child process for full re-analysis in background
- Lock file mechanism: `.planning/.cache/.analyzing` lock prevents concurrent re-triggers
- Lock file timeout: 5 minutes — if lock older than 5 minutes, assume process died, delete lock, re-trigger
- Detached child process: outlives the init command, runs independently
- Completion signaling: Agent's discretion on atomic write strategy (remove lock + write result, or rename)
- Freshness flagging: only flag data as stale to agents if very stale (>24h or many commits behind), otherwise silent

### Init output integration
- All init commands include codebase analysis fields (init progress, init phase-op, all variants)
- Three separate top-level fields: `codebase_stats`, `codebase_conventions`, `codebase_dependencies`
- JSON structure within each field: Agent's discretion based on existing init output patterns
- Missing data: always include keys with null values — agents know the fields exist but data isn't available

### Failure & degradation
- Silent degradation: null fields, no error fields, init works fine without intel
- `--refresh` flag on init commands: clears cache and runs full analysis synchronously
- Auto-create `.planning/.cache/` directory silently if missing — zero setup
- No-code detection: if no analyzable source files found, skip analysis entirely, set fields to null
- Cache directory gitignored — ephemeral derived data

### Agent's Discretion
- Dependency overview granularity within token budget
- JSON field structure within each top-level summary field
- Atomic write/completion signaling strategy for background analysis
- Exact confidence score scale/format

</decisions>

<specifics>
## Specific Ideas

- Summary is agent-facing, not human-facing — optimize for parseability and token efficiency over readability
- The <200ms quick mode is critical — init commands must never block waiting for analysis
- Detached process model chosen specifically so init returns instantly regardless of analysis state

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 26-init-integration-context-summary*
*Context gathered: 2026-02-26*
