# Phase 64: Command & Workflow Cleanup - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Clean the CLI command surface: remove stale/obsolete commands, hide internal-only commands from users, consolidate overlapping commands into fewer top-level entries, and migrate all references from flat command forms to namespaced forms. The backward-compat router block is removed. All 762+ tests must still pass.

</domain>

<decisions>
## Implementation Decisions

### Stale command criteria
- Remove both non-functional AND obsolete commands (commands that work but serve no current purpose — superseded or one-time-use)
- Hard remove from router entirely — no tombstone messages, no deprecation warnings, just "Unknown command" if called
- Delete corresponding slash command .md wrapper files alongside router removal
- No target command count — remove what's dead, whatever count remains is fine

### Internal vs user-facing line
- Internal-only CLI calls (init:execute-phase, verify:state, util:* etc.) stay in the router for agent/workflow use
- Remove user-facing slash command .md wrappers for internal-only commands — users should not see these
- Use Phase 62 audit data as starting point, cross-reference against actual workflow/agent usage to verify classification
- Agent decides per-command whether an internal wrapper has value as agent documentation or should be deleted outright
- Clean up help output to only show user-facing commands — internal commands excluded from help

### Consolidation strategy
- Remove both duplicate legacy forms (flat name aliases of namespaced commands) AND semantically overlapping commands
- When commands merge, hard remove the old name — no aliases, no deprecation period
- Colon namespacing stays for CLI (gsd-tools.cjs namespace:command)
- Slash command alignment: RESEARCH whether the host editor supports colon or alternative separators in command filenames. If it does, align slash commands to match CLI namespacing. If not, accept the split — CLI uses colons, slash commands stay /bgsd-verb-noun
- Backward-compat router block removed immediately (not after migration verification)
- Semantically similar command merges: agent proposes merges in the plan for review before execution — don't just make the call

### Reference migration scope
- Update ALL .md files in the project (not just deployed files)
- Also update references in source code, comments, help strings, and test descriptions — everything, not just markdown
- Remove backward-compat tests entirely (not convert to error tests)
- Final verification: grep sweep to confirm zero old-form references remain AND all tests must pass

### Agent's Discretion
- Which specific commands qualify as stale/obsolete (based on audit + usage analysis)
- Whether internal command wrappers should be deleted or kept as agent reference docs (case by case)
- Exact merge groupings for semantically similar commands (proposed in plan for review)

</decisions>

<specifics>
## Specific Ideas

- The colon namespacing at CLI level (plan:phase, init:progress) has never translated to slash commands (/bgsd-plan-phase) because the editor maps filenames to command names. Research whether the editor supports alternative separators before accepting the split.
- Phase 62 identified 281 commands (namespaced + legacy) — high count is largely from duplicate forms, not missing functionality. Use that audit as the baseline.
- "Remove immediately" philosophy throughout — no deprecation periods, no tombstones, no transition aliases. Clean break.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 64-command-workflow-cleanup*
*Context gathered: 2026-03-07*
