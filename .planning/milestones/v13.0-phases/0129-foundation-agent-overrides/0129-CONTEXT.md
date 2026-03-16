# Phase 129: Foundation & Agent Overrides - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

CLI commands for managing project-local agent overrides in `.opencode/agents/`. Users can create overrides from global agents, view diffs between local and global, and sync upstream changes. Includes YAML frontmatter validation and content sanitization to prevent silent failures from system-prompt mangling.

</domain>

<decisions>
## Implementation Decisions

### Override Creation (`agent:override <name>`)
- Full copy of the global agent file (complete replica, not a minimal scaffold)
- If agent is already overridden locally: hard-error with message pointing to `agent:diff` or `agent:sync`
- Validation at creation time: only `name:` field required in YAML frontmatter
- Output on success: just the file path created (no hints or suggestions)
- If `<name>` doesn't match any global agent: error with fuzzy suggestion of closest match
- Auto-create `.opencode/agents/` directory silently if it doesn't exist
- Local override uses same filename as the global agent (e.g., `bgsd-executor.md`)
- Don't touch `.gitignore` — user decides whether to commit or ignore overrides

### Diff Presentation (`agent:diff <name>`)
- Standard unified diff format (like `git diff`)
- If no local override exists: hard-error with hint to use `agent:override <name>`
- If no differences: silent exit (exit code 0, no output)

### Sync Behavior (`agent:sync <name>`)
- Show summary of what changed (e.g., "3 sections modified"), then prompt accept/reject
- Accept/reject granularity: whole file (all or nothing)
- No backup of old local version before overwriting — user has git
- If user rejects: just exit, no follow-up
- If no differences: silent exit (exit code 0, no output)
- One agent at a time only — no `--all` flag
- If no local override exists: hard-error with hint (same as diff)

### Validation & Sanitization
- YAML validation: parse the frontmatter block; on failure, hard-error with line number
- Only `name:` field required in frontmatter — everything else optional
- Validation runs on write only (during `agent:override` creation)
- Content sanitization guards against both editor-name mangling (Anthropic auth plugin) AND structural injection
- Build generic sanitization layer (not just known patterns) to handle future mangling patterns
- When mangling detected: auto-fix silently, no user action needed

### List Output (`agent:list-local`)
- Columnar table format
- Show ALL global agents, annotate scope: `global` or `local-override`
- Columns: Name, Scope, Drift indicator
- Drift shown as symbols: checkmark (in sync) or delta (drifted)
- Drift column only populated for agents that have local overrides

### Agent's Discretion
- No areas deferred to agent discretion — all decisions captured above

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

*Phase: 0129-foundation-agent-overrides*
*Context gathered: 2026-03-15*
