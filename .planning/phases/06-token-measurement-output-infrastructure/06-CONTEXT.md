# Phase 6: Token Measurement & Output Infrastructure - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Accurate token counting for all GSD layers, workflow baseline measurement with before/after comparison, and `--fields` flag for selective JSON output filtering. This is infrastructure that enables Phases 7-8 to prove their context reduction targets. Creating new commands or changing workflow content is out of scope — this phase builds the measurement tools.

</domain>

<decisions>
## Implementation Decisions

### Baseline reporting format
- Table output to terminal (not JSON by default)
- Columns: workflow name, token count, rank by size — keep it simple
- Default sort: biggest first (descending tokens) — shows where to focus reduction efforts
- Before/after comparison: side-by-side columns with name | before | after | delta | % change, sorted by biggest reduction

### Token estimation approach
- BPE-accurate (within 5% of ground truth), not a heuristic
- Adding one real dependency is acceptable — use a proper tokenizer library (e.g. gpt-tokenizer, tiktoken)
- Target encoding: cl100k_base (covers both Anthropic and GPT models used with OpenCode)
- Measurement scope: full agent context — workflow file + all referenced files + init command output + template files loaded (not just the workflow .md alone)

### --fields flag behavior
- Dot-notation for nested access: `--fields name,phases.status,milestone.version`
- Missing fields: include as null (caller knows it was requested but absent)
- Arrays: apply field filtering to each element (e.g. `--fields name,status` on array of phases filters each phase object)
- Scope for --fields + output mode: Claude's discretion on whether it affects both JSON and table output or JSON-only

### Measurement command design
- Extend the existing `context-budget` command (not new commands)
- Subcommand pattern: `context-budget baseline`, `context-budget compare`, `context-budget <path>` (existing)
- Baseline results saved to `.planning/baselines/` as timestamped JSON files
- Compare mode: no argument = compare vs most recent saved baseline; provide path = compare vs that specific file
- Workflow discovery: dynamic — scan workflows directory, parse @-references and gsd-tools calls to build dependency graph automatically (no static manifest)

### Claude's Discretion
- Whether --fields affects human-readable table output in addition to JSON
- Exact tokenizer library choice (gpt-tokenizer, tiktoken, js-tiktoken, etc.)
- Baseline file naming convention and JSON schema
- How to handle workflow files that dynamically load different references based on runtime context

</decisions>

<specifics>
## Specific Ideas

- This is the OpenCode version of GSD (not Claude Code) — models used are Anthropic and GPT
- The existing `context-budget` command has a broken `lines * 4` heuristic that this phase replaces
- The project currently has zero npm dependencies — adding one tokenizer library is the first dependency, so pick carefully
- "Full agent context" measurement means the tool needs to understand what files a workflow actually pulls in, not just count the workflow file

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-token-measurement-output-infrastructure*
*Context gathered: 2026-02-22*
