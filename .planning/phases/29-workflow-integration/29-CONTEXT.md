# Phase 29: Workflow Integration - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire codebase intelligence (from Phases 23-28) into the GSD workflow .md files so agents automatically receive architectural context during execution. This is workflow-level integration — modifying .md prompt files, not the CLI tool itself.

</domain>

<decisions>
## Implementation Decisions

### Execute-phase integration (WKFL-01)
- Execute-phase workflow spawns executor agents with `<files_to_read>` blocks — add `codebase context --files` call for the plan's `files_modified` list
- Context injection happens in the executor spawn prompt, not in the plan itself — plans stay clean, workflow adds context at spawn time
- Pass context as a `<codebase_context>` block in the executor prompt so agents can reference it during implementation
- Only inject if codebase intel exists — graceful no-op if `codebase analyze` hasn't been run

### Pre-flight convention check (WKFL-02)  
- Add a pre-flight step in execute-phase that runs `codebase context --files` for all files in the wave's plans
- Flag files where naming conventions differ from project conventions (e.g., creating a camelCase file in a kebab-case project)
- This is advisory only — log warnings, never block execution
- Convention warnings go in the executor prompt so the agent knows about them during implementation

### Codebase-impact graph integration (WKFL-03)
- `codebase-impact` command already exists — update it to use cached dependency graph from `intel.dependencies` when available
- Fall back to current behavior (scanning files) when no cached graph exists
- This is a CLI enhancement, not a workflow change — but it completes the intelligence loop

### Agent's Discretion
- Exact prompt formatting for injected codebase context
- How to handle large context (many files) — truncation strategy
- Whether to inject lifecycle info alongside task-scoped context
- Error handling for failed codebase queries (silent skip vs warning)

</decisions>

<specifics>
## Specific Ideas

- The workflow .md files live in `workflows/` — execute-phase.md and plan-phase.md are the main targets
- Keep changes minimal — add codebase context injection points, don't restructure workflows
- The `codebase context --files` command from Phase 27 is the primary integration point
- Convention warnings should feel like linter warnings — helpful, not blocking

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 29-workflow-integration*
*Context gathered: 2026-02-26*
