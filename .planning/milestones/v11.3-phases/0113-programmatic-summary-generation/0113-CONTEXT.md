# Phase 113: Programmatic Summary Generation - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a `summary:generate` CLI command that pre-builds SUMMARY.md from git history, plan metadata, and STATE.md — reducing LLM summary writing from full authorship to filling in judgment sections. The command extracts deterministic data programmatically and leaves only subjective/analytical sections for the LLM.

</domain>

<decisions>
## Implementation Decisions

### Data Extraction Scope
- Use commit hashes recorded in STATE.md as the primary source for identifying plan commits
- Fall back to git log message pattern matching if STATE.md has no commit hashes for the plan
- Performance timing: prefer STATE.md session data, fall back to git commit timestamps
- Infer frontmatter fields (subsystem, tags, key-files) from file paths — derive subsystem from directory, tags from file types, key-files from most-changed files

### LLM Judgment Sections
- Five judgment sections for LLM to fill: one-liner, accomplishments, decisions made, deviations, and lessons learned
- Placeholders use TODO markers with hints: `TODO: accomplishments (2-3 bullets, what changed and why)`
- Commit list and file change data appear inline in the scaffold (not hidden/collapsed) so the LLM can reference them when writing judgment sections

### Command Interface
- Command writes scaffold directly to disk (no stdout mode)
- If SUMMARY.md already exists: merge/preserve — regenerate data-driven sections but keep any LLM-written sections (detect by checking for TODO markers; if markers are gone, section was filled)
- Validate output against `verify:summary` before writing
- Brief status line output: path written, counts of commits/files/TODOs remaining
- If STATE.md lacks commit hashes, fall back to git log pattern matching rather than erroring
- No --dry-run flag needed — merge/preserve behavior is safe enough

### Agent's Discretion
- File diff baseline approach (parent of first commit vs accumulated per-commit diffs)
- Argument interface design (follow existing CLI patterns in the project)
- Integration point in execute-plan workflow (after tasks complete, before/replacing LLM summary step)

</decisions>

<specifics>
## Specific Ideas

- TODO markers should include contextual hints, e.g. `TODO: accomplishments (2-3 bullets, what changed and why)` — not bare markers
- The executor workflow should explicitly list remaining TODO sections when handing the scaffold to the LLM, rather than relying on the LLM to discover them
- The command is workflow-internal only — not exposed as a standalone user-facing command
- On generation failure, graceful fallback to current full-authorship approach with a warning logged

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 0113-programmatic-summary-generation*
*Context gathered: 2026-03-13*
