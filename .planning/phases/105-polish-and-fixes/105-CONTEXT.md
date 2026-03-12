# Phase 105: Polish & Fixes - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix edge cases and streamline workflow execution. Ensure commands handle confusion gracefully, reduce unnecessary steps in command chains, and provide actionable error messages.

</domain>

<decisions>
## Implementation Decisions

### Command Confusion Handling
- Response style: Suggest correction (like git's "did you mean X?")
- After suggestion: Ask first before applying the fix
- Confidence threshold: High confidence (90%+) required before suggesting
- Fallback: Always show alternatives when no good match found
- Algorithm: Levenshtein distance for command similarity

### Unnecessary Steps
- Priority: Review command chains first
- Approach: Use smart defaults to streamline
- Default source: Project context (active phase, recent work)
- User control: Flag override (--force, --defaults, etc.)

### Error Message Format
- Default format: Plain text
- Content: Detailed with examples
- Suggestions: Show only the best suggestion
- Verbosity: Brief one-liner for errors
- Always include: What went wrong + how to fix it

### Edge Case Categories
- Priority order: Typos → Subcommand errors → Missing args
- Typo detection: Simple (1-2 character difference)
- Missing args: Prompt for value
- Subcommand errors: Suggest correct subcommand

### Agent's Discretion
- Command chaining mistakes: Implement if time permits
- Phase reference errors: Implement if time permits

</decisions>

<specifics>
## Specific Ideas

- User pain: Commands like `/bgsd session progress` and `/bgsd exec quick` had routing issues (fixed in 104)
- Focus now: Polish the error experience when things still go wrong
- Error format: Follow git's model - brief, actionable, with examples

</specifics>

<deferred>
## Deferred Ideas

- Advanced typo detection (transposed words, missing spaces) - can enhance later
- JSON output format for errors - nice-to-have, not critical
- Saved preferences for defaults - flag override is sufficient for v11.1

</deferred>

---

*Phase: 105-polish-and-fixes*
*Context gathered: 2026-03-11*
