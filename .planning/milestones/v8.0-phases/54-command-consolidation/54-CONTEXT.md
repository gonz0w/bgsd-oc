# Phase 54: Command Consolidation - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

CLI commands are organized under logical namespaces with zero orphan commands. This is purely about command organization and naming — no new functionality added.

</domain>

<decisions>
## Implementation Decisions

### Namespace Structure
- **Grouping:** By lifecycle stage (Init, Plan, Execute, Verify, Utility)
- **Syntax:** `lifecycle:command` (e.g., `init:new`, `plan:intent create`)
- **Aliases:** None — only new names work (no backward compatibility)
- **Help output:** Grouped by namespace

### Naming Convention
- **Case:** kebab-case for all commands (e.g., `session-summary`, `intent-create`)
- **Scope:** All commands — rename existing to kebab-case
- **Prefix:** No `gsd-` prefix (unbranding from OpenCode)
- **References:** All workflow and agent references updated to new names

### Backward Compatibility
- **Old names:** Remove entirely — immediate breakage, no aliases
- **Migration:** User will adapt to new names
- **Help command:** `/bgsd-help` (prefixed to avoid conflict with OpenCode's `/help`)

### Orphan Criteria
- **Definition:** Commands with no related siblings
- **Handling:** Internal-only commands hidden from user UI
- **Internal commands:** generate-slug, current-timestamp, summary-extract, history-digest, extract-sections, template, test-coverage, quick-summary, config-migrate, mcp, mcp-profile, env, resolve-model, classify, websearch, codebase-* commands, validate-config, frontmatter, progress

</decisions>

<specifics>
## Specific Ideas

### Lifecycle Grouping
- **Init**: init, scaffold, generate-slug
- **Plan**: intent, requirements, roadmap, phases, find-phase, milestone
- **Execute**: commit, rollback-info, session-diff, session-summary, velocity, worktree, tdd, test-run, profile
- **Verify**: state, verify, assertions, search-decisions, search-lessons, review, context-budget, token-budget
- **Utility**: config-get, config-set, env, current-timestamp, list-todos, todo, memory, mcp, classify, frontmatter, progress, websearch, history-digest, trace-requirement, codebase

### Command to rename
- All flat names → namespace:kebab-case
- e.g., `intent create` → `plan:intent create`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 54-command-consolidation*
*Context gathered: 2026-03-02*
