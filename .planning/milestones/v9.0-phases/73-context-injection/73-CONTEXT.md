# Phase 73: Context Injection - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

The AI always knows current project state without manual init calls. Context is injected via system prompt hooks, compaction preserves full project context across context window resets, and slash commands auto-enrich with project state before their workflows execute.

This phase delivers: system prompt injection, enhanced compaction, and command enrichment. It does NOT deliver custom LLM tools (Phase 74) or event-driven state sync (Phase 75).

</domain>

<decisions>
## Implementation Decisions

### System Prompt Content
- Identifiers + status only: phase number, name, plan, task count, milestone position (e.g., "v9.0 Phase 3/6")
- Include the phase goal sentence for orientation
- Blockers shown only when present (no "Blockers: none")
- Milestone + phase position included (adds ~20 tokens but gives broader orientation)
- No fixed token budget — optimize for "as compact as possible without losing clarity"
- When no project active: inject minimal hint ("bGSD: No active project. Run /bgsd-new-project to start.")

### Compaction Preservation
- Preserve all four artifacts on compaction: current task details, active decisions/blockers, PROJECT.md digest, INTENT.md summary
- Use ProjectState cache (Phase 71) as data source, not fresh file reads
- Format: Structured XML blocks (<project>, <task>, <decisions>, <intent>)
- Skip AGENTS.md conventions — already in system prompt
- Include session continuity hint: derive from conversation first, fall back to STATE.md stopped_at field
- When no .planning/ exists: inject nothing (no empty markers)
- Always inject full artifact set — no config knobs for toggling sections

### Command Enrichment
- All /bgsd-* commands get enriched (no filtering by workflow presence)
- Inject full init equivalent — all paths, flags, settings — so commands don't need to call init themselves
- Existing init:* calls will be REMOVED from workflows (plugin required for v9.0)
- Plugin is required for v9.0 — no graceful degradation without plugin
- Use command.execute.before hook to prepend context (invisible to user)
- Extract init logic into shared src/ modules that both CLI and plugin import
- This shared module extraction happens as part of Phase 73
- Phase-aware: parse command arguments to detect phase number and inject that phase's specific context
- Non-phase commands get project-level context only (milestone, overall progress)

### Failure Behavior
- System prompt hook errors: inject error hint ("bGSD: Failed to load project state. Run /bgsd-health to diagnose.")
- Compaction hook errors: inject error marker (<project-error> tag) so AI knows to recover manually
- Command enrichment hook errors: BLOCK command execution and show error (commands require context)
- Use existing safeHook circuit breaker (3 consecutive failures disables)
- Debounce file reads by 500ms after change events to avoid partial-read issues
- Explicit dependency check on plugin load: verify Phase 71 shared parsers exist before enabling context hooks

</decisions>

<specifics>
## Specific Ideas

- System prompt injection format should be minimal structured text, not markdown or XML — keeps token count low
- The shared module extraction from init:* commands is a significant refactoring task — plan accordingly
- Phase 71's shared parsers (STATE.md, ROADMAP.md, config.json readers) are the foundation — context injection extends them with init-equivalent logic
- Compaction XML blocks should be self-documenting (tag names indicate content) so the AI can parse them without instructions

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 73-context-injection*
*Context gathered: 2026-03-09*
