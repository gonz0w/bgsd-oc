# Phase 110: Audit & Decision Framework - Context

**Gathered:** 2026-03-13 (revised)
**Status:** Ready for planning

<domain>
## Phase Boundary

Scan the codebase for places where LLM calls handle deterministic work that code could do, then directly replace those LLM calls with inline code logic. This is a combined audit-and-fix phase — no separate catalog tool, no engine abstraction, no CLI introspection commands.

**Rescoped from original roadmap:** Phases 110 and 111 were originally separate (audit catalog + decision engine). User decided to collapse into one pragmatic phase: find the waste, fix it inline. Phase 111 remains on the roadmap — its fate will be decided after this phase completes.

</domain>

<decisions>
## Implementation Decisions

### Approach
- Quick scan through workflows, agents, hooks, and plugins to identify LLM waste — then fix as you go
- No formal catalog document or CLI scan tool — analysis is baked into the implementation process
- Three categories to scan: model selection logic, routing/classification, and template generation

### Code Placement
- All decision logic goes inline where the LLM call currently lives — no new modules or abstractions
- No shared utility/helper files — keep fixes local to their call sites

### Rule Format (if any logic is extracted)
- Hybrid: simple decisions as lookup tables/data, complex decisions as functions
- Rich metadata on any decision logic (name, description, when-applicable)
- No versioning — contract tests catch regressions

### LLM Fallback
- Hard replace — if it's deterministic, rip out the LLM call entirely
- No confidence bands, no fallback to LLM for edge cases
- Code handles it, period

### Validation
- All existing tests must pass (762+ test suite)
- Add targeted tests for each replaced decision point to prevent regressions

### Phase 111 Disposition
- Keep on roadmap for now — decide after this phase whether it's still needed
- If all LLM waste is handled here, 111 may be removed or repurposed

</decisions>

<specifics>
## Specific Ideas

- `util:classify` subcommand may be dead code — verify during scan, remove if unused rather than optimizing
- Model selection logic in model-profiles skill is a known area of LLM interpretation that could be code

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope (and actually tightened it)

</deferred>

---

*Phase: 0110-audit-decision-framework*
*Context gathered: 2026-03-13*
