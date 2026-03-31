# Phase 149: TDD Selection & Contract Alignment - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary
Make TDD choice, rationale, and contract deterministic before execution starts, without adding new execution capabilities beyond selection, checker behavior, and cross-doc alignment.
</domain>

<decisions>
## Implementation Decisions

### TDD selection policy
- Phase 149 lands a minimal deterministic floor for selection: planners default to TDD when work introduces or changes testable behavior with clear expected outcomes.
- Planners skip TDD for clearly docs-only, config-only, or layout-only work.
- The rationale explains how the rule applied in a specific case; rationale does not replace the selection rule.

### Rationale format
- TDD rationale lives in the plan body as a visible callout rather than in frontmatter.
- The rationale should stay short and human-readable so users can see the TDD decision without parsing metadata.

### Checker severity contract
- Checker behavior uses a strict severity ladder.
- `required` TDD hints become blocker-level violations.
- `recommended` TDD hints become warnings.
- Omitted TDD hints still produce informational output rather than silence.

### Canonical TDD contract
- The canonical TDD contract lives in one skill under `skills/`.
- Workflows, docs, CLI help, and tests must align to that skill instead of restating competing rules.
- If the skill and code/tests drift, the skill is treated as correct and implementation/tests must be brought back into alignment.

### Backward compatibility and migration
- Older roadmaps and plans should be normalized automatically when read.
- Normalization is persisted back to disk rather than kept in memory only.
- Compatibility is additive in behavior, but migration is allowed to mutate legacy artifacts in order to keep the contract consistent.

### Agent's Discretion
- Exact wording of the plan-body rationale callout.
- Exact examples used to illustrate the deterministic floor, as long as they preserve the locked rule.
- How persisted normalization is surfaced to users in messaging, as long as automatic rewrite-on-read remains the rule.
</decisions>

<specifics>
## Specific Ideas
- Keep the TDD decision visible directly in each plan body.
- Treat the canonical skill as the operational source of truth for planner/checker behavior.
- Favor deterministic behavior even when it creates migration churn in older planning artifacts.
</specifics>

<stress_tested>
## Stress-Tested Decisions
- **Selection policy**
  - Original decision: TDD selection would be rationale-first, with the exact heuristic left discretionary in Phase 149.
  - Stress-test revision: Phase 149 now locks a minimal deterministic floor: default to TDD for work that introduces or changes testable behavior with clear expected outcomes; skip clearly docs/config/layout-only work.
  - Follow-on clarification: The rationale remains required, but it explains the deterministic rule application instead of replacing the rule.
- All other decisions held up under stress testing without revision.
</stress_tested>

<deferred>
## Deferred Ideas
- None - discussion stayed within phase scope.
</deferred>

---
*Phase: 149-tdd-selection-contract-alignment*
*Context gathered: 2026-03-28*
