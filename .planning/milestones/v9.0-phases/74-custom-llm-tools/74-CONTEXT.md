# Phase 74: Custom LLM Tools - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Five native LLM-callable tools (`bgsd_status`, `bgsd_progress`, `bgsd_context`, `bgsd_plan`, `bgsd_validate`) with Zod schemas that replace hot-path CLI subprocess calls. Agents get faster, typed access to common operations without shell overhead. Tools depend on Phase 73 ProjectState cache.

</domain>

<decisions>
## Implementation Decisions

### Tool response shape
- Agent's discretion on uniform envelope vs tool-specific shapes
- Errors must be actionable: include what went wrong AND what to do (e.g. "Phase 99 not found. Run /bgsd-progress to see available phases.")
- Distinguish error types: validation_error (bad args from LLM) vs runtime_error (operational failures like missing files)
- bgsd_status includes basic phase info (name, goal, deps) alongside execution state
- Agent's discretion on whether tools return objects (framework stringifies) or strings directly
- Return complete data — no truncation or size caps
- No metadata (timing, cache freshness) in responses
- Fields always present with null for missing data — predictable shape, never omit fields
- Clean redesign of JSON shapes for LLM consumption — don't carry over CLI field name quirks
- Detailed multi-line tool descriptions explaining purpose, when to use, and what each param does
- Use Zod coercion (z.coerce) for numbers and booleans — be lenient with LLM type mismatches
- Minimal signatures — few/no optional args per tool. Each tool does one thing simply
- No versioning in responses — we control both producer and consumer
- Specific "no project" response (not an error) when .planning/ doesn't exist, with guidance to run /bgsd-new-project
- bgsd_status includes full task list with statuses (not just current task + %)
- Agent's discretion on bgsd_validate returning all checks vs only failures

### Registration & discovery
- One file per tool in `src/plugin/tools/` directory (e.g. `src/plugin/tools/bgsd-status.js`) plus an index
- Agent's discretion on registration mechanism (new export vs init hook)
- Tool names: `bgsd_status`, `bgsd_progress`, `bgsd_context`, `bgsd_plan`, `bgsd_validate` (bgsd_ prefix, underscore)
- Agent's discretion on whether tools reuse CLI internal parsers or have independent implementation
- Source files in `src/plugin/tools/` alongside existing plugin source
- Both unit tests per tool AND integration tests for registration/callability
- Zod bundled as dev dependency into plugin.js during build — zero runtime dependencies preserved
- Conditional registration: tools only appear when .planning/ directory exists
- Dynamic registration: tools register on-the-fly when .planning/ is created mid-session (no editor restart)
- No concern about plugin.js bundle size increase from tools + Zod

### bgsd_progress behavior
- Can update: mark tasks complete, update blockers, record decisions to STATE.md, advance plan position
- File update only — no git commits. Agent handles commits separately
- Strict validation: enforce ordering rules, error if skipping tasks or doing things out of sequence
- Basic file locking to prevent concurrent write corruption
- Returns updated state snapshot after changes (new progress %, current task, next task)
- Batch operations supported: accept array of operations in one call
- Undo supported: can un-complete tasks, remove blockers, etc. (bidirectional updates)
- Single 'action' parameter design: action: 'complete-task' | 'add-blocker' | 'record-decision' | 'advance' | 'uncomplete-task' | 'remove-blocker' — keeps tool count at 5
- Invalidate ProjectState cache after writes so next read gets fresh data

### Scope of each tool
- **bgsd_status**: Execution state only — current phase, plan, task list with statuses, blockers, progress %. No milestone/project-level info
- **bgsd_context**: Accepts optional task number (defaults to current). Returns file paths, line ranges, and summaries — not actual file contents. Agent reads files itself
- **bgsd_plan**: Two modes — no args returns roadmap summary (all phases with status); phase number arg returns detailed phase info (goal, requirements, success criteria, deps) PLUS plan contents (tasks, estimates) if plans exist
- **bgsd_validate**: Validates everything (STATE.md, ROADMAP.md, PLAN.md, requirement traceability). Auto-fixes trivial formatting issues, reports the rest. Issues categorized by severity: error, warning, info
- Strict separation: each piece of data lives in exactly one tool. Minimize overlap between tool responses
- Agent's discretion on where "current task info" lives (status vs context boundary)
- Tools strictly require Phase 73 ProjectState cache — error if cache not available

### Agent's Discretion
- Uniform envelope vs tool-specific response shapes
- Object return vs string return (framework stringify vs tool stringify)
- Registration mechanism (new 'tools' export vs init hook)
- CLI internal reuse vs independent implementation
- bgsd_validate: all checks vs failures only
- Current task info ownership (status vs context)

</decisions>

<specifics>
## Specific Ideas

- Error messages should be actionable like CLI tools: "Phase 99 not found. Run /bgsd-progress to see available phases." — not just "not found"
- Two error types modeled after HTTP patterns: 4xx (validation_error — you called it wrong) vs 5xx (runtime_error — something broke)
- bgsd_plan's dual-mode design: no args = roadmap overview, phase arg = deep dive. Similar to `git log` vs `git log <branch>`
- bgsd_progress as a single tool with action parameter rather than splitting into sub-tools — keeps the total at exactly 5 tools
- Dynamic tool registration when .planning/ appears mid-session — seamless new-project experience

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 74-custom-llm-tools*
*Context gathered: 2026-03-09*
