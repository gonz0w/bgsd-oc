# Phase 104: Zero Friction - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove clarification loops and add smart defaults for ambiguous commands. Ensure commands execute deterministically on first attempt without analysis/hunting phases.

</domain>

<decisions>
## Implementation Decisions

### Help-Command Alignment
- Build-time sync: Generate help from registry + validate on mismatch
- Both inline (in command files) and central help files generated
- Single source of truth: Command registry generates all help
- Error experience: Suggest closest match + show all alternatives
- Matching: Exact matching only
- Command metadata: Central registry (config.json)
- No deprecation - remove old commands directly
- Output formats: Both markdown (for /commands/) and JSON (for programmatic access)
- Discovery: Both autocomplete and fuzzy search
- Organization: By function (planning, execution, etc.)
- Validation: CI validates + build fails if out of sync
- Help display: In slash command files, built into /bgsd for fastest execution

### Ambiguity Handling
- Default behavior: Prompt user when ambiguous
- Prompt style: Show options, user selects one to execute
- Trigger: Threshold-based (60%+ confidence = auto, below = prompt)
- Options shown: Top option + "not what you meant?" override
- Learning: System learns from user choices to improve future suggestions
- Storage: Local only (never sent externally)
- Typos: Both - suggest correction if very close, try to match if ambiguous
- User control: Can clear learned preferences

### Override Mechanism
- Explicit intent: Both full command syntax and flags (--force, --exact)
- Matching priority: Prefer exact, allow fuzzy as fallback
- Exact not found: Confirm with user before executing fuzzy match
- Override scope: This time only (not remembered)
- Custom aliases: Supported
- Alias storage: In config file
- Alias syntax: Simple (like shell aliases: alias "p" = "plan phase")

### Context-Based Defaults
- Context source: Project state (planning context)
- Planning context includes: Active phase, current milestone, recent tasks
- When clear: Use defaults automatically
- When unclear: Prompt user for clarification

</decisions>

<specifics>
## Specific Ideas

- User pain: Commands like `/bgsd session progress` and `/bgsd exec quick` don't route correctly even when typed exactly as help shows
- Root cause: Help text and command routing not aligned
- Desired outcome: Deterministic routing - what help shows should work on first try, no "figure it out" phase
- No analysis/hunting should happen - commands should just work

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope

</deferred>

---

*Phase: 104-zero-friction*
*Context gathered: 2026-03-11*
