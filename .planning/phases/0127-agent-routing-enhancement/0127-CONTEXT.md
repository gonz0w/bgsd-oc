# Phase 127: Agent Routing Enhancement - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable agents to make informed routing decisions based on available tools, task complexity, and required capabilities. This phase adds tool availability detection and resolve functions that recommend the right tool for file discovery, search, and JSON transformation tasks.

</domain>

<decisions>
## Implementation Decisions

### Fallback Behavior
- Silent fallback when preferred tool is unavailable — no warnings or errors, just use the next-best option
- Best-effort fallback chains — provide Node.js fallback where natural (ripgrep -> Node.js search), skip where no reasonable fallback exists (bat -> nothing)
- Hardcoded fallback chains — no config.json override for fallback order
- Cache tool availability at startup — check once when bgsd-tools loads, reuse for the session
- Use `which`/`command -v` for detection — don't run the tool to verify, just check existence
- tool_availability is just true/false per tool — no version info
- Expose tool_availability in bgsd-context JSON AND use internally for resolve functions — agents can see availability and resolve functions use it for routing
- Resolve functions return just the tool name — no reason or rationale attached

### Plan Sizing Impact
- Same tasks regardless of tool availability — tasks are the same count/granularity whether tools are present or not
- No plan adjustment for missing tools — don't increase estimates or add workaround tasks when falling back to Node.js
- Abstract tool choice away from plans — tasks describe goals ("search for X"), executor calls resolve functions at runtime
- Plan decomposition heuristics live in workflow markdown — add guidance to planner workflow text, not a separate module in bgsd-tools.cjs

### Agent's Discretion
- Decision output shape — resolve functions return format is up to implementation
- Complexity thresholds — what constitutes "simple" vs "complex" for JSON ops and file discovery scope

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

*Phase: 0127-agent-routing-enhancement*
*Context gathered: 2026-03-15*
