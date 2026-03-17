# Phase 137: Section-Level Loading & Conditional Elision - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary
The enricher applies conditional elision to workflow content on load — stripping sections that don't apply based on bgsd-context decisions. Agents can additionally use `extract-sections` for per-step section loading when needed. Combined approach: enricher handles elision, agents handle section selection.
</domain>

<decisions>
## Implementation Decisions

### Section Selection Mechanism
- Combined approach: enricher applies conditional elision on full workflow load; agents use `bgsd-tools util:extract-sections` for per-step section selection when needed
- No per-step tracking in the enricher — agents are responsible for requesting specific sections via existing CLI infrastructure
- Section markers from Phase 135 are already installed in all 10 workflows

### Conditional Elision Markers
- HTML comment marker format: `<!-- section: name if="decision_key" -->` ... `<!-- /section -->`
- Condition attribute embedded in the opening section marker — self-documenting, no external mapping file
- Single conditions only per marker — compound logic lives in decision rules (e.g., create a `tdd_with_tests` rule rather than `is_tdd AND has_test_command`)
- Always use dedicated conditional sections, even for small (2-3 line) fragments — consistency over reading flow; if a workflow has too many sections it should be split into multiple workflows

### Decision-to-Feature Mapping
- `is_tdd` / `plan_type === 'tdd'` controls TDD-specific content (execute-plan)
- `ci_enabled` / `has_test_command` controls CI quality gate content (execute-phase, quick)
- `verifier_enabled` controls verification routing content (execute-phase, execute-plan)
- Deviation-capture content is always-on (no elision condition currently)

### Enricher Integration Point
- Enricher does elision in-process (no subprocess overhead)
- **NEEDS INVESTIGATION:** Verify whether `command.execute.before` hook fires before or after `@` reference resolution in output.parts
  - If AFTER: modify output.parts in-place (strip conditional sections from existing workflow content)
  - If BEFORE: enricher reads workflow file directly and injects elided content — but must avoid duplicating content with the editor's `@` reference resolution (may need to remove `@` references from command files)
- This is a blocking design question — first task in planning should verify hook timing

### Regression Safety
- Structural fingerprint comparison using `workflow:verify-structure` (Phase 134 infrastructure)
- Before/after snapshots: baseline with all conditions ON, comparison with conditions OFF; verify delta matches expected conditional content
- Post-elision reference checking: scan remaining content for references to elided section names, flag dangling references as errors
- Token savings reported as per-workflow table: original tokens, post-compression tokens (Phase 135), post-elision tokens (Phase 137), cumulative reduction %

### Agent's Discretion
- Exact refactoring of existing workflow content into conditional sections — planner/executor decides where to draw section boundaries based on actual content analysis
- Whether `extract-sections` needs any enhancements for agent-driven per-step loading, or works as-is
</decisions>

<specifics>
## Specific Ideas
- Marker syntax: `<!-- section: tdd_commit if="is_tdd" -->` — condition as attribute on existing section marker format
- Per-workflow savings table should follow Phase 135 summary format with added "post-elision" column
- Reference checking after elision should be lightweight — scan for section name strings in remaining content
</specifics>

<stress_tested>
## Stress-Tested Decisions
- **Section explosion for tiny fragments** — held: consistency matters more than line count; humans rarely read raw workflows; overly large workflows should be split
- **Enricher integration point (duplicate content)** — REVISED: original "read-and-inject" approach risks doubling token count. Captured as "needs investigation" — must verify hook timing before committing to approach
- **Dangling cross-section references** — added reference checking after elision (not in original discussion)
- **Compound conditions** — held: single conditions only, compound logic in decision rules
</stress_tested>

<deferred>
## Deferred Ideas
None — discussion stayed within phase scope
</deferred>

---
*Phase: 137-section-level-loading-conditional-elision*
*Context gathered: 2026-03-16*
