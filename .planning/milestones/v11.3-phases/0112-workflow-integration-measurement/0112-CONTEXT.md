# Phase 112: Workflow Integration & Measurement - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace LLM reasoning in workflows with deterministic code wherever practical. Audit all ~40 workflows, identify spots where the LLM derives something that code could compute, and replace those derivations with code calls. The goal is leaner workflows with fewer LLM calls — not a framework, not a measurement system, just pragmatic replacements.

</domain>

<decisions>
## Implementation Decisions

### Scope & Approach
- Audit ALL ~40 workflows, not just high-traffic ones
- Replace LLM-derivable logic with deterministic code — if code can compute it, code should compute it
- No decision payload architecture, no config framework, no telemetry system
- This is a pragmatic replacement effort, not an infrastructure build

### Workflow Simplification
- Moderate restructuring: simplify step logic, collapse redundant branches, remove derivation code — but don't rewrite workflows from scratch
- Workflows should gracefully degrade if a code path isn't available — silent fallback to old derivation logic
- Migrate incrementally, one workflow at a time

### Where Code Lives
- Agent's discretion per case — some logic belongs in bgsd-tools.cjs (CLI), some in the plugin hook (pre-compute in bgsd-context), whatever is natural for each replacement
- No mandate to centralize everything in one place

### Measurement
- No persistent telemetry or measurement framework
- Baselines estimated from static analysis of current workflows (count reasoning steps)
- Report is CLI output only — absolute before/after LLM call counts
- Primary metric: LLM call count reduction

### Agent's Discretion
- Decision payload structure (flat vs nested, per-workflow vs per-domain keys)
- How to handle unresolved decisions in the payload (omit key vs explicit null)
- Fallback verbosity — silent fallback chosen (no warnings when falling back to old derivation)

</decisions>

<specifics>
## Specific Ideas

- User explicitly wants to avoid over-engineering — no config toggles, no feature flags, no decision frameworks
- The framing should be "find code-replaceable LLM calls and replace them" not "build a decision engine integration"
- High-traffic workflows (execute-phase, plan-phase, discuss-phase) should be migrated first within the incremental rollout

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 0112-workflow-integration-measurement*
*Context gathered: 2026-03-13*
