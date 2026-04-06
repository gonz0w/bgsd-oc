# Feature Research

**Domain:** CLI workflow orchestration / bGSD plugin acceleration
**Researched:** 2026-04-05
**Confidence:** HIGH for feature inventory; MEDIUM for prioritization — actual ROI requires measurement against this repo's workflow traces

<!-- section: compact -->
<features_compact>
**Table stakes (already shipped or built-in):**
- phase:snapshot — single CLI call replacing repeated phase discovery calls
- verify:state complete-plan — atomic batched state mutation replacing fragmented multi-call sequences
- phase-handoff artifacts — durable machine-readable chaining contract between workflow steps
- PlanningCache-backed plan reads — SQLite-first parsed plan/task data avoiding markdown reparse

**Differentiators (v19.3 net new):**
- Workflow hot-path task routing — planner self-check, conditional checker spawn, fewer agent hops on happy path
- I/O batching layer — consolidate sequential file reads into one snapshot, batch related state mutations
- Parallel workflow stages — Kahn topological sort of phase/task dependencies enables parallel wave execution where dependencies allow

**Defer (v2+):** end-to-end fresh-context chained delivery pipeline (/bgsd-deliver-phase), autonomous agent team coordination, dynamic agent spawning

**Key dependencies:** parallel stages require correct dependency graph; planner self-check must not degrade plan quality; batching must not hide state drift
</features_compact>
<!-- /section -->

<!-- section: feature_landscape -->
## Feature Landscape

### Table Stakes (Users Expect These)

Features already shipped or required by existing workflows. v19.3 must not regress these.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| phase:snapshot | Replaces repeated phase discovery calls; PRD quick-win shipped in v16.1 | LOW | Already in `src/commands/phase.js`; returns compact structured phase metadata |
| verify:state complete-plan | Atomic batched state mutation replacing fragmented multi-call STATE.md sequences | LOW | Already in `src/commands/state.js`; advances position, records metrics, updates progress in one call |
| Phase handoff artifacts (XX-HANDOFF.json / phase-handoff.js) | Enables fresh-context chaining between discuss/research/plan/execute/verify steps | MEDIUM | `src/lib/phase-handoff.js` ships full validation, versioning, write/clear; consumed by init.js for resume_summary |
| PlanningCache-backed plan reads | Avoids re-reading/re-parsing every plan markdown file on each call | LOW | SQLite-first with git-hash+mtime hybrid invalidation; in production path since v16.1 |
| Snapshot-backed init reuse | High-traffic workflows (discuss-phase, plan-phase) reuse cached snapshot instead of rescanning | LOW | Shared `phase:snapshot` output consumed by init flows; prevents repeated discovery cost |
| Cached plan indexing | Plan wave map and incomplete plan list pre-computed and cached | LOW | Built on PlanningCache; avoids per-call plan directory scans |
| Durable handoff artifacts | Fresh-context resume reads from compact disk artifact, not conversation history | MEDIUM | phase-handoff.js with versioned schema; rebuilds on stale/corrupted artifact detection |

### Differentiators (Competitive Advantage)

New features targeted by v19.3. These are where the milestone delivers net-new value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Workflow hot-path task routing | Fewer agent hops on happy path; planner does built-in self-check against checker rubric before spawning standalone checker | MEDIUM | Collapses redundant planner→checker boundary for straightforward phases; strict/low-confidence cases still spawn checker explicitly |
| Parallel workflow stages | Kahn topological sort of task/plan dependencies enables concurrent execution of independent waves | HIGH | Requires correct dependency graph; must preserve checkpoint safety; applies to execution waves within a phase |
| I/O batching layer | Consolidates sequential file reads (phase snapshot + plan index + artifact discovery) into one snapshot call; batches related state mutations | MEDIUM | `phase:snapshot` is the read-batching primitive; `verify:state complete-plan` is the write-batching primitive; new work extends coverage |
| discuss-phase --fast | Batch low-risk clarification choices into one turn; reduces user turns for routine phases | LOW | Opt-in flag; preserves locked decisions and deferred ideas; default mode unchanged |
| verify-work --batch N | Present N tests at a time for routine UI/CLI verification | LOW | Default remains one-at-a-time for high-risk/abiguous cases; batch mode for routine verification |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for this codebase's constraints.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| One giant agent session for entire phase | Eliminates handoff overhead; feels faster | Violates bGSD's low-context discipline; destroys resumability; makes /clear unsafe | Fresh-context chained workflow with compact handoffs (already in PRD, deferred to v2) |
| Remove discuss/verify interactive steps entirely | Speeds up workflow | Loses quality gate value; defeats the structured decision-making purpose | Fast modes (--fast, --batch) that reduce turns without removing quality checks |
| Async I/O rewrite | Dramatically faster I/O | CLI tool with short-lived processes (<5s); async adds complexity without proportional gain | Batching and caching deliver most gains within sync model |
| Dynamic agent spawning | Maximizes parallelism | Coordination overhead exceeds benefit for pre-planned parallelism; violates agent cap of 9 | Pre-planned parallel waves via Kahn topological sort |
| Real-time everything (live cmux updates for all state changes) | Best observability | Notification spam; token waste;违背 cmux's semantic attention-key cooldowns | Trust-first snapshot with cooldowns (already shipped in v19.0) |
<!-- /section -->

<!-- section: dependencies -->
## Feature Dependencies

```
[phase:snapshot] ──already shipped──> [read-batching foundation]
[snapshot-backed init reuse] ──already shipped──> [phase snapshot consumer]

[planner self-check] ──requires──> [checker rubric accessible to planner]
[conditional checker spawn] ──requires──> [planner self-check verdict]
[parallel workflow stages] ──requires──> [correct task/plan dependency graph]
[parallel workflow stages] ──requires──> [JJ workspace proof gate]
[I/O batching] ──enhances──> [phase:snapshot] ──enhances──> [all workflow steps]

[discuss-phase --fast] ──independent of──> [parallel workflow stages]
[verify-work --batch N] ──independent of──> [parallel workflow stages]
```

### Dependency Notes

- **planner self-check requires checker rubric:** Planner must have access to checker validation rules at plan-comparison time; without this the self-check cannot replicate checker judgment.
- **parallel stages require correct dependency graph:** If depends_on metadata is incomplete or wrong, parallel execution will violate phase semantics. A Kahn topological sort must be validated before parallel dispatch.
- **I/O batching enhances phase:snapshot:** The read-batching win comes from `phase:snapshot` covering more artifact types (requirements, assertions, lessons) in one call vs. N sequential calls.
- **parallel stages require JJ workspace proof gate:** Parallel execution of waves within a phase still requires the `workspace prove` triple-match gate from v19.0 before work starts.
- **discuss-phase --fast and verify-work --batch are independent of parallel stages:** These are user-facing efficiency features that don't depend on parallel execution infrastructure.
<!-- /section -->

<!-- section: mvp -->
## MVP Definition

### Launch With (v19.3)

Minimum viable acceleration on top of v19.1's shipped foundation.

- [ ] **Planner self-check before checker spawn** — Planner folds in checker rubric for straightforward phases; standalone checker spawns only on strict flag, low confidence, or failed self-check. Reduces agent hop count without degrading quality.
- [ ] **discuss-phase --fast** — Batch low-risk clarification choices; reduce turns for routine phases. Opt-in flag; current default unchanged.
- [ ] **verify-work --batch N** — Batch routine test verification (N configurable). Default stays one-at-a-time for ambiguous/high-risk.
- [ ] **I/O coverage audit for phase:snapshot** — Extend snapshot to include all repeated discovery calls currently made by discuss-phase, research-phase, plan-phase workflows. One call should replace N sequential lookups.

### Add After Validation (v19.3.x)

Features that depend on MVP success and measurement.

- [ ] **Parallel workflow stage dispatch** — Implement Kahn topological sort over phase task dependencies; dispatch independent waves concurrently. Requires validated dependency graph and workspace proof gate.
- [ ] **Batched state mutation for execute-plan** — Replace multiple sequential CLI calls (advance position, update progress, record metrics, record decisions) with a single `verify:state complete-plan` call in the execute workflow path.
- [ ] **Cached handoff validation** — Pre-validate handoff artifact freshness against source fingerprint at snapshot time, not just at resume time.

### Future Consideration (v2+)

Features deferred until core acceleration contract is validated.

- [ ] `/bgsd-deliver-phase --fresh-step-context` — End-to-end fresh-context chained delivery pipeline; each step reads from snapshot + handoff, writes compact output, clears context, chains to next step.
- [ ] **Planner quality benchmark** — Measure plan quality delta between self-check-only and self-check+checker phases; calibrate when checker spawn is truly needed.
- [ ] **Dynamic parallelization** — Runtime dependency graph analysis to auto-detect parallelizable segments vs. sequential requirements.
<!-- /section -->

<!-- section: prioritization -->
## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Planner self-check before checker spawn | HIGH — reduces agent hops on happy path | MEDIUM — requires rubric access, conditional spawn logic | P1 |
| discuss-phase --fast | MEDIUM — reduces turns for routine phases | LOW — flag-based opt-in, no core logic change | P1 |
| verify-work --batch N | MEDIUM — reduces UAT turn overhead | LOW — flag-based opt-in, no core logic change | P1 |
| phase:snapshot I/O coverage audit | HIGH — foundational read-batching multiplier | MEDIUM — survey all workflow calls, extend snapshot schema | P1 |
| Parallel workflow stage dispatch | HIGH — core milestone differentiator | HIGH — dependency graph correctness, concurrent dispatch, recovery | P2 |
| Batched state mutation in execute-plan | MEDIUM — replaces fragmented multi-call sequences | LOW — wire existing verify:state complete-plan into execute workflow | P2 |
| Cached handoff validation | LOW — optimization of existing behavior | MEDIUM — fingerprint computation at snapshot time | P3 |

**Priority key:**
- P1: Must ship in v19.3 — core acceleration features on critical path
- P2: Should ship in v19.3.x if MVP validates — natural extensions
- P3: Nice to have, evaluate after P1+P2

**Confidence:** MEDIUM — planner self-check quality threshold, parallel-stage correctness boundary, and --fast/--batch user-turn reduction all need repo-local measurement before claims are final.
<!-- /section -->

<!-- section: competitors -->
## Competitor Feature Analysis

| Feature | Traditional Planning Tools | Chat-based AI Workflows | Our Approach |
|---------|--------------------------|------------------------|--------------|
| Phase snapshot | Manual re-discovery each step | Context passed implicitly | Single CLI call; disk-backed; human-readable + machine-parseable |
| Batched state completion | Fragmented tool calls per step | Stateless per-message | Atomic `verify:state complete-plan`; one durable write |
| Planner self-check | N/A (no equivalent) | Relies on LLM self-critique | Formal checker rubric consumed at plan time; conditional human spawn |
| Fast interaction modes | Full manual process | No quality gates | Opt-in efficiency without removing quality checks |
| Parallel stages | Sequential phases only | Single-context giant session | Kahn sort over explicit dependencies; JJ workspace-gated |

## Sources

- `.planning/research/completed/WORKFLOW-ACCELERATION-PRD.md` — primary PRD input for this milestone
- `.planning/PROJECT.md` — v19.3 milestone goal and current state
- `src/lib/phase-handoff.js` — existing handoff artifact implementation
- `src/commands/phase.js` — existing phase:snapshot implementation
- `src/commands/state.js` — existing verify:state complete-plan implementation
- v16.1 shipment notes (PROJECT.md lines 89-97) — phase:snapshot, batched complete-plan, snapshot-backed init reuse
- v17.1 shipment notes (PROJECT.md lines 66-75) — shared mutation contracts, canonical must_haves, disk-truth completion repair

---
*Feature research for: v19.3 Workflow Acceleration*
*Researched: 2026-04-05*
