# Phase 141: Taxonomy & Infrastructure - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary
Question taxonomy infrastructure — define TAXONOMY enum, build prompts.js template library (or questions.js), implement option generation rules, add decision routing functions to DECISION_REGISTRY.
</domain>

<decisions>
## Implementation Decisions

### Taxonomy Design
- **Start with 7 types** (BINARY, SINGLE_CHOICE, MULTI_CHOICE, RANKING, FILTERING, EXPLORATION, CLARIFICATION) — comprehensive coverage enables better downstream decision routing
- **Consolidate later if unused** — after 1-2 milestones of usage data, prune rarely-used types
- **Benefit goes to downstream agents** — more specific types = better option generation routing for planners/executors

### Template Storage
- **Separate questions.js module** — clean separation from prompts.js which handles CLI prompts; easier to audit
- **If questions.js grows too large** — split into prompts/ + questions/ submodules in subsequent phase
- **Templates reviewed via agent** — questions:audit CLI command with periodic agent review
- **Template contains OPTIONS ONLY** — question text stays in workflow; templates provide option sets
- **Parameterized tone** — templates accept tone parameter (formal/casual) for flexibility
- **Author discretion on formatting** — templates provide guidance, not enforced rules (title case, punctuation, etc.)

### Option Generation
- **Hybrid approach** — pre-authored for common questions, structured runtime generation for novel/edge cases
- **Runtime generation uses diversity constraints** — options must span certainty/scope/approach/priority dimensions
- **Pre-authored sets designed from scratch** — not extracted from existing workflows (quality over convenience)
- **Benefit: quality control** — hybrid ensures coverage without sacrificing option quality

### Workflow Integration
- **Function call** (questionTemplate(id, context)) over CLI — direct call is faster than subprocess
- **Replace <question> tags** — workflows use questionTemplate(id) directly instead of XML tags
- **Incremental migration per phase** — Phase 142 migrates primary workflows, Phase 143 does rest
- **Graceful fallback** — if template missing, function returns inline text; backward compatible
- **Decision functions run at execution time** — always fresh data, not pre-computed at enrichment

### Agent's Discretion
- Specific option wording within templates (authors choose phrasing)
- Internal structure of questions.js module (as long as questionTemplate signature is consistent)
</decisions>

<specifics>
## Specific Ideas
- TAXONOMY enum: BINARY, SINGLE_CHOICE, MULTI_CHOICE, RANKING, FILTERING, EXPLORATION, CLARIFICATION
- Option generation rules: MIN 3, MAX 5, diversity across dimensions, escape hatch ("Something else")
- questionTemplate(id, type, context) function signature
- resolveQuestionType and resolveOptionGeneration added to DECISION_REGISTRY
</specifics>

<stress_tested>
## Stress-Tested Decisions
- Template storage REVISED to questions.js (was prompts.js) — cleaner separation despite more files
- Option authoring REVISED to design fresh (was extract from existing) — quality over convenience
- All other decisions held up under stress testing:
  - 7-type taxonomy (defended: can consolidate later)
  - Hybrid option generation (defended: ensures coverage)
  - Replace <question> tags (defended: graceful fallback prevents cascading failures)
  - Execution-time decision computation (defended: always fresh)
</stress_tested>

<deferred>
## Deferred Ideas
None — discussion stayed within phase scope
</deferred>

---
*Phase: 141-taxonomy-infrastructure*
*Context gathered: 2026-03-19*
