# Phase 157: Planning Context Cascade - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary
Add milestone-level intent plus compact layered `effective_intent` injection so planning, roadmapping, research, and verification flows can use project vision, current milestone focus, and local phase purpose without pasting raw intent documents. Also expose JJ workspace capability context to planning surfaces in a lightweight way that informs safe parallelism without turning planning into execution-state management.
</domain>

<decisions>
## Implementation Decisions

### High-Impact Decisions
- Milestone intent ownership/update path - Locked. `/bgsd-new-milestone` owns creating and refreshing `.planning/MILESTONE-INTENT.md`; later planning flows read it and warn when context is partial rather than rewriting strategy in multiple places. Reasoning: intent is advisory vision, not the requirement contract, so narrow ownership reduces churn while preserving a readable source of milestone focus.
- `effective_intent` contract - Locked. Inject a compact layered object with small `project`, `milestone`, and `phase` summaries plus a computed `effective` view for summary, priority outcomes, and non-goals. Reasoning: downstream agents need source-layer visibility and a merged takeaway, but hot paths should not regress to raw document dumps.
- Intent layering semantics - Locked. Lower layers refine focus, priorities, and non-goals but do not silently replace the project north star. Reasoning: milestone and phase intent should narrow the vision for the current work, not overwrite enduring project direction.
- Intent vs requirements semantics - Locked. Intent expresses vision, directional priorities, and non-goals; requirements remain the delivery contract for what must be built. Reasoning: this keeps `effective_intent` useful without turning it into a second requirements system.
- JJ planning context behavior - Locked. Phase 157 exposes compact JJ/workspace capability context to planning surfaces, but does not ship a concrete sibling-work recommendation heuristic yet. Reasoning: the phase goal is to make capability visible for planning without locking a premature routing algorithm before the product proves what is actually useful.

### Medium Decisions
- Missing-artifact compatibility - Defaulted. When milestone or phase intent is missing, compute `effective_intent` from the layers that exist and surface a clear warning that intent context is partial; do not silently create new files in hot paths. Reasoning: this preserves migration smoothness for older artifacts without letting advisory intent quietly disappear.
- Traceability in planning artifacts - Locked. Plans and roadmaps should keep compact source references and outcome IDs rather than copying intent prose, while verification surfaces should still be able to check phase intent alignment and milestone audit should validate the full project -> milestone -> phase intent chain. Reasoning: compact refs reduce document bloat, but the review path still needs explicit traceability.

### Low Defaults and Open Questions
- JJ planning context is advisory-only - Defaulted. Planning surfaces can consider workspace-backed sibling parallelism guidance, but JJ context should not become a hard blocker in planning flows.
- Injection targets stay on planning/alignment hot paths - Defaulted. Roadmapper, planner, phase researcher, verifier, and `/bgsd-verify-work` get `effective_intent`; executor and debugger remain out of scope unless later phases prove a need.
- Phase-purpose capture stays lightweight - Defaulted. `CONTEXT.md` should carry a small local-purpose signal only when it materially affects implementation choices.

### Agent's Discretion
- Exact field names and serialization details for the compact `effective_intent` object, as long as the injected payload stays layered, compact, and clearly separates advisory intent from requirements.
- Exact warning wording and metadata shape for partial-intent fallback, as long as missing layers are visible and non-silent.
- Exact JJ capability payload fields, as long as they describe capability context compactly without depending on live workspace inventory.
</decisions>

<specifics>
## Specific Ideas
- The user explicitly distinguished intent from requirements: intent is the vision; requirements are the way to get to the vision.
- The user wants missing intent layers to degrade gracefully but visibly, not through silent fallback.
- The user wants compact references in plans, but also wants verification and milestone audit to preserve a readable full-chain review path.
</specifics>

<stress_tested>
## Stress-Tested Decisions
- Milestone intent ownership/update path held under stress testing. Complaint: narrow ownership could create stale milestone strategy. Outcome: decision held because intent is advisory vision rather than a hard requirement source, so read-time warnings are sufficient protection against drift.
- `effective_intent` semantics were revised during stress testing. Original decision: compact layered object for downstream planning and verification. Stress-test revision: explicitly treat `effective_intent` as vision/priorities/non-goals guidance while requirements remain the delivery contract. Follow-on clarification: lower layers refine but do not replace the project north star.
- JJ planning context behavior was narrowed during stress testing. Original decision: compact capability summary with advisory sibling-work guidance. Stress-test revision: keep compact JJ capability context in scope while deferring the exact planning heuristic/routing behavior instead of locking a vague hint too early. Follow-on clarification: Phase 157 now locks capability-only exposure and avoids live workspace inventory or recommendation automation.
- Traceability expectations sharpened during stress testing. Original decision: use compact refs instead of copying intent prose into plans. Stress-test revision: keep compact refs in planning artifacts, but ensure phase verification checks intent alignment and milestone audit verifies the full intent chain so later review does not become archaeology.
</stress_tested>

<deferred>
## Deferred Ideas
- The exact planning heuristic for how JJ capability context should influence sibling-plan recommendations is deferred for later clarification or implementation proof beyond Phase 157's capability-only scope.
</deferred>

---
*Phase: 157-planning-context-cascade*
*Context gathered: 2026-03-29*
