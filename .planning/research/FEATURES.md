# Feature Research — v19.4 Workflow Acceleration II + TDD Reliability

**Domain:** CLI workflow orchestration + TDD reliability hardening
**Researched:** 2026-04-06
**Confidence:** HIGH for feature inventory (from shipped v19.3 + existing PRDs); MEDIUM for TDD Phase B/C specifics — execution gate semantics need repo-local fixture validation before final claims

---

<!-- section: compact -->
<features_compact>
**Table stakes (already shipped, v19.4 must not regress):**
- phase:snapshot — single CLI call replacing repeated phase discovery (shipped v16.1)
- verify:state complete-plan — atomic batched state mutation (shipped v16.1)
- Phase handoff artifacts (XX-HANDOFF.json) — durable chaining contract between workflow steps (shipped v16.1)
- PlanningCache-backed plan reads — SQLite-first parsed plan/task data (shipped v16.1)
- Mutex-protected cache entries for parallel stages (shipped v19.3)
- Kahn topological sort with cycle detection in resolvePhaseDependencies (shipped v19.3)
- Promise.all fan-in parallel coordination (shipped v19.3)
- discuss-phase --fast, verify-work --batch N (shipped v19.3)
- Deterministic TDD selection with rationale visibility and canonical TDD contract (shipped v16.1)

**Differentiators (v19.4 net new):**
- /bgsd-deliver-phase --fresh-step-context — end-to-end fresh-context chaining pipeline; each step runs in fresh context, reads from snapshot+handoff, writes compact output, chains to next step
- TDD RED/GREEN/REFACTOR gate semantics — TDD-aware validation beyond exit-code checks; verifies correct state transitions, no test file modification during GREEN, no new behavior during REFACTOR
- TDD plan structure verification — structural validation rejecting malformed type:tdd plans; enforced at planning-time, not just at execute-time
- TDD fixture-backed E2E tests — automated end-to-end fixture proving RED→GREEN→REFACTOR commit trail
- TDD rationale visibility — selected/skipped rationale surfaced in plan output and summary rendering

**Defer (v2+):** dynamic autonomous agent team coordination, dynamic agent spawning, runtime dependency graph auto-detection

**Key dependencies:** /bgsd-deliver-phase requires phase:snapshot + handoff artifacts + PlanningCache (all shipped); TDD Phase B gates require existing execute:tdd infrastructure; TDD Phase C E2E requires Phase B gates implemented first
</features_compact>
<!-- /section -->

---

<!-- section: feature_landscape -->
## Feature Landscape

### Table Stakes (Users Expect These)

Features already shipped. v19.4 must not regress these.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| phase:snapshot | Single CLI call replacing repeated phase discovery + plan indexing | LOW | Shipped v16.1; consumed by discuss-phase, research-phase, plan-phase workflows |
| verify:state complete-plan | Atomic batched state mutation replacing fragmented multi-call STATE.md sequences | LOW | Shipped v16.1; advances position, records metrics, updates progress in one call |
| Phase handoff artifacts (XX-HANDOFF.json) | Enables fresh-context chaining between discuss/research/plan/execute/verify steps | MEDIUM | Shipped v16.1; src/lib/phase-handoff.js with full validation, versioning, write/clear |
| PlanningCache-backed plan reads | Avoids re-reading/re-parsing every plan markdown file on each call | LOW | SQLite-first with git-hash+mtime hybrid invalidation; in production since v16.1 |
| Snapshot-backed init reuse | High-traffic workflows reuse cached snapshot instead of rescanning | LOW | Shared phase:snapshot output consumed by init flows; prevents repeated discovery cost |
| Mutex-protected cache for parallel stages | Prevents cache race corruption when parallel workers hit same key | MEDIUM | Shipped v19.3 via Atomics+SharedArrayBuffer CAS primitives |
| Kahn topological sort with cycle detection | Orders parallel waves correctly; prevents violation of depends_on constraints | MEDIUM | Shipped v19.3; verified in resolvePhaseDependencies |
| Promise.all fan-in parallel coordination | Coordinates concurrent dispatch of independent waves | MEDIUM | Shipped v19.3; fanInParallelSpawns with bounded concurrency |
| discuss-phase --fast | Batch low-risk clarification choices into one turn | LOW | Shipped v19.3; opt-in flag; preserves locked decisions and deferred ideas |
| verify-work --batch N | Present N tests at a time for routine UI/CLI verification | LOW | Shipped v19.3; default stays one-at-a-time for ambiguous/high-risk |
| Deterministic TDD selection with rationale | Planner always evaluates TDD eligibility; records why selected or skipped | MEDIUM | Shipped v16.1; canonical TDD contract across planner, checker, workflows, templates |
| execute:tdd with exact-command RED/GREEN/REFACTOR validation | Validates TDD phase transitions with structured proof payloads | MEDIUM | Shipped v16.1; trailer-aware summary rendering in TDD audit sidecars |
| TDD audit sidecars through resumable handoffs | Durable proof delivery survives execute→verify→summary transitions | MEDIUM | Shipped v16.1; proof continuity visible in resume inspection and downstream summaries |

### Differentiators (v19.4 Net New)

The value-add of this milestone. These features continue v19.3's acceleration and harden TDD reliability.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| `/bgsd-deliver-phase --fresh-step-context` | End-to-end fresh-context chaining pipeline — each step runs in fresh context, reads from compact handoff + snapshot, writes compact output, chains to next step. Eliminates giant context window requirement while preserving resumability. | HIGH | Major new orchestration path; requires phase:snapshot + handoff + PlanningCache (all shipped); stop points at checkpoints and interactive decisions preserved |
| TDD RED/GREEN/REFACTOR gate semantics | Validates state transitions beyond exit codes: RED must show test FAILED for expected missing behavior; GREEN must show test PASSED with no test file modification; REFACTOR must show all tests still pass with no new behavior added | MEDIUM | Extends existing execute:tdd with TDD-aware semantics; gaps from TDD-RELIABILITY-PRD Phase B |
| TDD plan structure verification | Structural validation rejecting malformed type:tdd plans at planning-time (not just execute-time); ensures required fields, step sequence, and test/impl file pairs are present | MEDIUM | Extends existing plan structure validation; TDD-RELIABILITY-PRD Phase B |
| TDD fixture-backed E2E tests | Automated end-to-end fixture proving RED→GREEN→REFACTOR commit trail works in actual repo; catches drift in TDD contract before users hit it | MEDIUM | Requires Phase B gates implemented first; TDD-RELIABILITY-PRD Phase C |
| TDD rationale visibility in output | Selected/skipped rationale surfaced in plan output and summary rendering; users can tell from planning output why TDD was or was not used | LOW | Extends existing rationale visibility from v16.1; TDD-RELIABILITY-PRD Phase C |
| TDD eligibility evaluation for ALL plans | Planner evaluates TDD eligibility for every implementation plan, not only phases with explicit ROADMAP TDD hint; ensures eligible work is not silently skipped | MEDIUM | Closes TDD-RELIABILITY-PRD Phase A gap; planner already has canonical TDD contract (v16.1) |
| TDD decision rationale field in plans | Required TDD decision rationale field on every plan — why TDD was selected, or why it was intentionally skipped | LOW | Extends v16.1 rationale visibility; TDD-RELIABILITY-PRD Phase A |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for this codebase's constraints.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| One giant agent session for entire phase | Eliminates handoff overhead; feels faster | Violates bGSD's low-context discipline; destroys resumability; makes /clear unsafe | Fresh-context chained workflow with compact handoffs (/bgsd-deliver-phase) |
| Force TDD for all work types | Maximum test coverage | Overhead on trivial work; violates TDD opt-in philosophy | TDD eligibility evaluation that recommends but never forces |
| Async I/O rewrite | Dramatically faster I/O | CLI tool with short-lived processes (<5s); async adds complexity without proportional gain | Batching and caching (already shipped in v19.3) |
| Remove interactive discuss/verify steps entirely | Speeds up workflow | Loses quality gate value; defeats structured decision-making purpose | Fast modes (--fast, --batch) that reduce turns without removing quality checks |
| Subagent isolation per TDD phase | Strongest TDD guarantees | High coordination overhead; expensive per-task spawn cost | Context compaction + phase-specific file restriction gates (already sufficient per TDD-EXECUTION research) |
| Dynamic agent spawning | Maximizes parallelism | Coordination overhead exceeds benefit; violates agent cap of 9 | Pre-planned parallel waves via Kahn topological sort (already shipped) |
<!-- /section -->

---

<!-- section: dependencies -->
## Feature Dependencies

```
[/bgsd-deliver-phase --fresh-step-context]
    └──requires──> [phase:snapshot] ──already shipped──> [read-batching foundation]
    └──requires──> [XX-HANDOFF.json handoff artifacts] ──already shipped──> [chaining contract]
    └──requires──> [PlanningCache] ──already shipped──> [cache layer]
    └──requires──> [JJ workspace proof gate] ──already shipped──> [safety]

[TDD Phase B gates]
    └──requires──> [execute:tdd infrastructure] ──already shipped v16.1──> [existing TDD flow]
    └──requires──> [TDD Phase A rationale field] ──v19.4──> [Phase B gates use rationale]

[TDD Phase C E2E fixture]
    └──requires──> [TDD Phase B gates] ──v19.4 Phase B──> [gate semantics implemented]
    └──requires──> [deterministic TDD selection] ──already shipped v16.1──> [canonical contract]

[TDD plan structure verification]
    └──requires──> [canonical TDD contract] ──already shipped v16.1──> [structure definition]
    └──requires──> [existing plan validation infrastructure] ──already shipped──> [validation hooks]

[TDD rationale visibility]
    └──requires──> [TDD Phase A decision rationale field] ──v19.4 Phase A──> [rationale stored]
    └──enhances──> [existing TDD rationale visibility] ──already shipped v16.1──> [extends to plan output]

[TDD eligibility evaluation for ALL plans]
    └──enhances──> [deterministic TDD selection] ──already shipped v16.1──> [evaluation always happens]
    └──requires──> [checker rubric accessible to planner] ──already shipped──> [rubric exists]
```

### Dependency Notes

- **/bgsd-deliver-phase requires JJ workspace proof gate:** The fresh-context chaining pipeline still requires `workspace prove` triple-match gate before any work starts. Accelerated paths may optimize the proof check but never bypass it.
- **TDD Phase C E2E requires Phase B gates implemented first:** Fixture tests validate gate semantics. Cannot write meaningful E2E without the gate behavior defined.
- **TDD Phase B gates require Phase A rationale field:** The rationale field is the data substrate that Phase B gates operate on.
- **deliver-phase is independent of TDD work:** Both are v19.4 targets but have no shared implementation dependency. They can be built and tested independently.
<!-- /section -->

---

<!-- section: mvp -->
## MVP Definition

### Launch With (v19.4)

Minimum viable: deliver-phase fresh-context chaining + TDD Phase B/C hardening.

- [ ] **`/bgsd-deliver-phase --fresh-step-context`** — End-to-end fresh-context chaining pipeline; each step reads from snapshot + handoff, writes compact output, clears context, chains to next. Stop points at checkpoints and interactive decisions preserved. Validates that the full discuss→research→plan→execute→verify chain works with fresh context windows.
- [ ] **TDD RED/GREEN/REFACTOR gate semantics** — execute:tdd extended with TDD-aware semantics: RED verifies test FAILED for expected missing behavior (not just exit code ≠ 0); GREEN verifies test PASSED + test file NOT modified during GREEN; REFACTOR verifies all tests still pass + no new behavior added (test count unchanged). Closes TDD-RELIABILITY-PRD Phase B.
- [ ] **TDD plan structure verification** — Structural validation rejecting malformed type:tdd plans at planning-time; ensures required fields (test_file, impl_files, steps with RED/GREEN/REFACTOR phases) are present and correctly ordered. Closes TDD-RELIABILITY-PRD Phase B.
- [ ] **TDD fixture-backed E2E tests** — At least one automated end-to-end fixture proving RED→GREEN→REFACTOR commit trail in actual repo. Validates the full TDD cycle produces the expected proof payload and commit trail. Closes TDD-RELIABILITY-PRD Phase C.

### Add After Validation (v19.4.x)

Features that depend on MVP success.

- [ ] **TDD rationale visibility in plan output** — Selected/skipped rationale surfaced in plan output and summary rendering. Default on; users can tell from planning output why TDD was or was not used. Closes TDD-RELIABILITY-PRD Phase C.
- [ ] **TDD eligibility evaluation for ALL plans** — Planner evaluates TDD eligibility for every implementation plan, not only phases with explicit ROADMAP TDD hint. Records rationale for both selected and skipped cases. Closes TDD-RELIABILITY-PRD Phase A.
- [ ] **TDD decision rationale field in plans** — Required field on every type:tdd plan — why TDD was selected, or why TDD was intentionally skipped. Structured in frontmatter for machine readability. Closes TDD-RELIABILITY-PRD Phase A.

### Future Consideration (v2+)

Features deferred until core contracts are validated.

- [ ] **Dynamic parallelization** — Runtime dependency graph analysis to auto-detect parallelizable segments vs. sequential requirements
- [ ] **Planner quality benchmark** — Measure plan quality delta between self-check-only and self-check+checker phases; calibrate when checker spawn is truly needed
- [ ] **Autonomous agent team coordination** — Pre-planned parallel waves already shipped; dynamic spawning deferred indefinitely
<!-- /section -->

---

<!-- section: prioritization -->
## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| /bgsd-deliver-phase --fresh-step-context | HIGH — enables single-command end-to-end delivery without giant context window | HIGH — new orchestration path, requires careful resume/checkpoint integration | P1 |
| TDD RED/GREEN/REFACTOR gate semantics | HIGH — closes core TDD reliability gap; makes TDD dependable, not accidental | MEDIUM — extends existing execute:tdd, adds file-diff checks per phase | P1 |
| TDD plan structure verification | MEDIUM — catches malformed TDD plans early, not at execute-time | MEDIUM — extends existing plan structure validation hooks | P1 |
| TDD fixture-backed E2E tests | HIGH — proves TDD contract works end-to-end; prevents future drift | MEDIUM — requires Phase B gates first, then fixture setup | P1 |
| TDD rationale visibility in plan output | MEDIUM — closes TDD-RELIABILITY-PRD Phase C; improves operator visibility | LOW — extends existing rationale rendering | P2 |
| TDD eligibility evaluation for ALL plans | MEDIUM — closes TDD-RELIABILITY-PRD Phase A gap; ensures eligible work not skipped | MEDIUM — requires planner to always call TDD evaluation | P2 |
| TDD decision rationale field | MEDIUM — structured rationale enables downstream consumers (gates, summaries) | LOW — frontmatter field addition | P2 |

**Priority key:**
- P1: Must ship in v19.4 — core differentiators; blocking for each other
- P2: Should ship in v19.4.x — important but can follow P1 delivery
- P3: Nice to have, evaluate after P1+P2

**Confidence:** MEDIUM — TDD Phase B gate semantics (RED/GREEN/REFACTOR specific checks) need repo-local fixture validation before claims are final. deliver-phase complexity is well-understood from v19.3 parallelization work.
<!-- /section -->

---

<!-- section: competitors -->
## Competitor Feature Analysis

| Feature | Traditional Planning Tools | Chat-based AI Workflows | Our Approach |
|---------|--------------------------|------------------------|--------------|
| Fresh-context chained delivery | N/A — no equivalent | Single giant session (no chaining) | Compact disk-backed handoffs; /clear-safe; resumable from disk truth |
| TDD RED/GREEN/REFACTOR gates | Manual discipline only | Exit-code only | TDD-aware semantics: file-diff per phase, test-not-modified check, no-new-behavior enforcement |
| TDD plan structure verification | N/A | N/A | Structural validation at planning-time for type:tdd plans |
| TDD E2E fixture tests | N/A | N/A | Automated fixture proving RED→GREEN→REFACTOR commit trail |
| TDD rationale visibility | N/A | N/A | Rationale field in plan output and summary rendering |

## Sources

- `.planning/research/completed/WORKFLOW-ACCELERATION-PRD.md` — workflow acceleration PRD (quick wins shipped v19.3; fresh-context chaining deferred)
- `.planning/research/completed/TDD-RELIABILITY-PRD.md` — TDD reliability PRD (Phase A partially shipped v16.1; Phase B/C remain)
- `.planning/research/completed/TDD-EXECUTION.md` — TDD execution patterns research (Superpowers, alexop.dev, Steve Kinney patterns documented)
- `.planning/milestones/v19.3-REQUIREMENTS.md` — v19.3 shipped requirements (ACCEL, FAST, PARALLEL, STATE, BUNDLE)
- `.planning/ROADMAP.md` — v19.3 shipped 2026-04-06; v19.4 is next milestone
- `src/commands/phase.js` — phase:snapshot implementation (shipped v16.1)
- `src/commands/state.js` — verify:state complete-plan implementation (shipped v16.1)
- `src/lib/phase-handoff.js` — handoff artifact lifecycle (shipped v16.1)
- `src/lib/planning-cache.js` — SQLite-backed planning cache (shipped v12.0+)
- `src/commands/execute.js` — execute:tdd implementation (shipped v16.1)

---
*Feature research for: v19.4 Workflow Acceleration II + TDD Reliability*
*Researched: 2026-04-06*
