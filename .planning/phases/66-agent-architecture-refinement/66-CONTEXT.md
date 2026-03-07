# Phase 66: Agent Architecture Refinement — Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Sharpen agent boundaries, validate manifests against actual usage, document handoff contracts, and evaluate merge opportunities — based on stable command surface from prior phases. Requirements: AGENT-01, AGENT-02, AGENT-03, AGENT-04.

</domain>

<decisions>
## Implementation Decisions

### RACI Validation Criteria

- **Medium granularity (15-25 lifecycle steps)** — Sub-stage level, e.g., "plan creation" vs "plan checking" vs "plan approval". Enough to catch real overlaps without being unmaintainable.
- **Scope includes agents AND orchestrators** — Orchestrator commands appear as "responsible for spawning decisions". Shows who decides which agent runs, not just who does the work.
- **Overlap rule: permissive** — Every lifecycle step has exactly one Responsible agent. Multiple agents can be Accountable or Consulted for the same step without triggering a warning. Two R's on the same step = overlap warning.
- **Standalone RACI.md** — Dedicated file in `references/`. Easy to find, easy to validate programmatically. Not embedded in agent manifests.

### Handoff Contract Format & Depth

- **Dual-source: frontmatter + central doc** — Each agent .md declares its inputs/outputs in YAML frontmatter. RACI.md also contains the transition contracts in a human-readable section alongside the matrix.
- **Section-level detail** — Contracts name files AND required sections: e.g., "RESEARCH.md must contain ## Findings, ## Risks, ## Recommendations for Planner to consume". No field-level schemas.
- **Tooling validates contracts** — A gsd-tools command checks that agent outputs match declared contracts (e.g., RESEARCH.md has expected sections before planner runs). Validation produces errors, not just warnings.
- **Contracts live in RACI.md** — One document for both the responsibility matrix and the transition contracts. Keeps agent coordination concerns together.

### Manifest Tightening Approach

- **Runtime measurement for unused field detection** — Instrument agent runs to track which context files are actually read/used. More accurate than static analysis. Requires running real workflows to gather data.
- **Token budgets verified from real runs** — Capture actual token usage from agent invocations. Compare to declared budgets. Adjust budgets to reflect reality.
- **Conservative trimming** — Only remove context fields that are clearly unused (declared but never referenced during real runs). Keep anything ambiguous.
- **Scope includes tool grants** — Also audit tool grants per agent (read, write, edit, bash, etc.). If an agent doesn't need a capability, remove it. Tighten both context and tool access.

### Agent Merge Evaluation Rules

- **Overlap measured by RACI lifecycle steps** — Count how many lifecycle steps two agents share as Responsible. If agent A owns 10 steps and shares 6 with agent B, that's 60% overlap → merge candidate.
- **Merged agents get new names** — Combined agents receive a new name reflecting the merged responsibilities. Both old agents are deleted.
- **Reviewer agent included in evaluation** — The documented-but-undeployed reviewer agent (references/reviewer-agent.md) is evaluated alongside the 11 defined agents. Disposition to be recommended: merge into existing agent, deploy standalone, or remove.
- **No preconceptions** — Let the RACI analysis discover overlaps organically. No agents are pre-targeted for merging.

### Agent's Discretion

- Order of operations (RACI first vs. manifests first vs. parallel)
- Specific instrumentation approach for runtime measurement
- How to capture token usage (host editor APIs, log parsing, estimation)
- RACI.md document layout and formatting
- Which real workflows to run for measurement (coverage vs. effort tradeoff)

</decisions>

<specifics>
## Specific Ideas

- Phase 53 did initial agent consolidation (11→9) and added RACI + token budgets, but RACI.md wasn't persisted. This phase re-creates it with validation tooling.
- The `util:agent` command already exists and can list agents — extend rather than replace.
- Contract validation should integrate naturally into the existing orchestrator flow (e.g., check RESEARCH.md sections before spawning planner).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 66-agent-architecture-refinement*
*Context gathered: 2026-03-07*
