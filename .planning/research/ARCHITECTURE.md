# v19.0 Architecture Integration: JJ Workspace Hardening + cmux Coordination + Risk-Based Testing

## Executive recommendation

v19.0 should be implemented as **one execution-control architecture milestone**, not three unrelated slices.

- **JJ workspaces** become the isolation boundary for plan-local execution.
- **Main checkout + orchestrator/CLI** become the **single writer** for shared planning state.
- **cmux** becomes a **read-mostly observability surface** fed from orchestrator/plugin state, never a second source of truth.
- **Risk-based testing policy** becomes a **planning + execution contract** that determines how much proof each plan must produce before it is eligible for reconcile/finalize.

That keeps the repo aligned with an existing project pattern: one truthful routed source rather than parallel drift-prone surfaces.

## Architecture goal for v19.0

Move from today's model:

1. prompts describe JJ-parallel execution,
2. plan executors may still touch shared `.planning/` state directly,
3. plugin cmux refreshes are per-event and expensive,
4. verification routing exists, but policy alignment is still partially contractual,

to this model:

1. **workspace-pinned execution is runtime-enforced**,
2. **workspace execution is plan-local only**,
3. **reconcile/finalize runs once from the main checkout**,
4. **cmux reads from one coordinated event spine**,
5. **testing policy gates reconcile eligibility by explicit route (`skip` / `light` / `full`)**.

---

## Recommended subsystem boundaries

### 1) Execution isolation boundary (new durable boundary)

**Owner:** JJ workspace runtime + execute-phase orchestration

**Plan-local, workspace-owned state:**

- source code edits
- plan-local generated artifacts
- `*-SUMMARY.md` for the plan
- plan-scoped proof artifacts such as targeted test outputs / TDD audit sidecars
- workspace-local JJ status and recovery breadcrumbs

**Not workspace-owned:**

- `.planning/STATE.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- shared bookmarks / session continuity / aggregate progress
- phase-wide completion decisions

**Why:** JJ docs explicitly support multiple workspaces backed by one repo and note that a workspace can become stale when another workspace rewrites the working-copy commit. That makes workspace isolation good for plan execution, but poor as the authority for shared project progress. Source: Jujutsu working copy/workspaces docs (`jj workspace add`, `jj workspace root`, `jj workspace update-stale`). Confidence: **HIGH**.

### 2) Shared-state finalization boundary (modified durable boundary)

**Owner:** main checkout finalize pipeline

Shared planning artifacts must be derived only after reconcile from the current main-checkout truth. Existing code already points in this direction:

- `src/commands/workspace.js` already treats `workspace reconcile` as preview-oriented
- `src/lib/jj-workspace.js` already classifies workspace health/recovery states
- `src/commands/state.js` and `src/commands/roadmap.js` already centralize canonical mutation of `STATE.md` / `ROADMAP.md`

**Recommendation:** add an explicit **finalize surface** rather than letting plan executors continue mutating shared artifacts directly.

Best fit:

- keep `workspace reconcile` for per-workspace inspection/recovery
- add a new **phase-level finalize command family** as the only mutator of shared planning state after a wave or phase

Suggested command shape:

- `workspace reconcile <plan-id>` = inspect / merge / collect plan result metadata
- `state complete-plan ...` and `roadmap update-plan-progress ...` remain internal building blocks
- **new:** `execute:finalize-wave` or `workspace finalize-wave`
- **new:** `execute:finalize-phase` or `workspace finalize-phase`

I recommend **`execute:` finalize commands**, because finalize is orchestration semantics, not raw workspace lifecycle.

### 3) Runtime observability boundary (modified durable boundary)

**Owner:** plugin event coordinator + cmux adapter

cmux should remain a projection of trusted project state, not an independent event processor. The EDD is right: `src/plugin/index.js` currently does duplicate `invalidateAll()` + `getProjectState()` work inside both `refreshCmuxSidebar()` and `refreshCmuxAttention()` for tool/file/idle events.

**Recommendation:** introduce `src/plugin/cmux-event-coordinator.js` as the single intake point for plugin-driven cmux refresh.

Responsibilities:

- debounce noisy lifecycle events
- batch triggers
- do one parse/invalidate pass
- call sidebar + attention sync from one fresh snapshot
- apply backpressure/semaphore to cmux process spawning

This keeps cmux attached to the same single-source-of-truth principle as finalize.

### 4) Verification policy boundary (modified durable boundary)

**Owner:** planner/executor/verifier policy contract

Risk-based testing should not live only in docs. It needs to shape execution eligibility:

- `skip` plans may finalize with structural proof only
- `light` plans must produce focused behavioral proof
- `full` plans must produce focused proof plus one broad regression gate at plan end / overall verification

Existing seed:

- `src/lib/decision-rules.js` already exposes `resolveVerificationRouting()`
- `workflows/execute-phase.md` already injects `verification_route`

**Recommendation:** treat `verification_route` as a durable field that must travel through:

1. planning artifact,
2. executor prompt/runtime,
3. summary/proof metadata,
4. finalize eligibility,
5. verifier reporting.

Right now the architecture is only partially there; v19.0 should make it authoritative.

---

## New vs modified modules

## New modules / surfaces

### A. Execution finalize coordinator

**New likely module(s):**

- `src/commands/execute/finalize.js` or `src/commands/execute-finalize.js`
- possibly shared helpers in `src/lib/workspace-finalize.js`

**Purpose:**

- consume per-plan reconcile outputs
- sort deterministic finalize order
- recalculate shared progress from disk truth
- update `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`, bookmarks/session continuity exactly once
- emit structured finalize report for plugin/cmux/verifier

### B. Workspace result manifest / reconcile metadata

**New likely module(s):**

- `src/lib/workspace-reconcile.js`
- or a plan-result manifest helper under `src/lib/plan-result.js`

**Purpose:**

- define the metadata a workspace must hand back before finalize
- e.g. `plan_id`, `workspace_name`, `summary_path`, `jj_status`, `commit/change ids`, proof status, verification route, touched files, reconcile outcome

### C. cmux event coordinator

**New module (already proposed by EDD):**

- `src/plugin/cmux-event-coordinator.js`

**Purpose:** single debounced event spine for sidebar + attention updates.

### D. Verification-route evidence normalizer

**New likely module(s):**

- `src/lib/verification-route.js`
- or `src/lib/verification-proof.js`

**Purpose:**

- normalize what proof is required for `skip` / `light` / `full`
- let finalize and verifier reason over the same structure instead of free-form summary prose

## Modified existing modules

### JJ workspace + reconcile path

- `src/commands/workspace.js`
  - extend from add/list/forget/cleanup/reconcile-preview to real reconcile + finalize integration
- `src/lib/jj-workspace.js`
  - keep workspace health classification, add richer reconcile-readiness diagnostics
- `src/router.js`
  - expose new finalize commands
- `src/lib/router-contract.js`
  - keep routed source of truth aligned
- `src/lib/commandDiscovery.js`
  - surface new finalize verbs/help

### Execution orchestration path

- `workflows/execute-phase.md`
  - stop implying executors update shared planning state directly in workspace mode
  - replace with “workspace writes plan-local outputs; orchestrator finalizes shared state from main checkout”
- possibly `workflows/execute-plan.md`
  - make summary/proof outputs explicit inputs to finalization
- `src/lib/orchestration.js`
  - optionally use blast-radius signals to help verification-route promotion and build-order decisions

### Shared planning state path

- `src/commands/state.js`
  - remain canonical writer for state mutations, but invoked by finalize instead of parallel executors
- `src/commands/roadmap.js`
  - same role for plan/phase progress recomputation
- any `REQUIREMENTS.md` tracing/update command path
  - finalize should update requirement completion only after reconcile truth is known

### Plugin / cmux path

- `src/plugin/index.js`
  - replace direct repeated refresh calls with coordinator enqueue
- `src/plugin/file-watcher.js`
  - route external planning changes through coordinator
- `src/plugin/cmux-sidebar-sync.js`
  - unchanged responsibility; becomes downstream consumer of coordinated snapshot
- `src/plugin/cmux-attention-sync.js`
  - unchanged responsibility; also downstream consumer
- `src/plugin/parsers/config.js`
  - add `cmux_event_coordinator` config block
- `src/plugin/project-state.js`
  - remains the data facade; should be called once per coordinator flush, not once per sink

### Testing policy alignment path

- `src/lib/decision-rules.js`
  - evolve `resolveVerificationRouting()` from simple heuristic to explicit policy-aligned routing inputs
- plan/template/workflow surfaces that carry `verification_route`
- verifier/reporting prompts and docs that distinguish missing behavior proof vs missing regression proof

---

## State ownership boundaries

## Durable ownership model

### Workspace owns

- checked-out working copy for one plan
- plan-local code delta
- plan-local proof collection
- plan-local summary draft / final summary artifact
- workspace health + JJ op-log breadcrumbs

### Main checkout owns

- shared `.planning/` truth
- cross-plan aggregation
- current phase/plan/session position
- roadmap progress table
- requirement completion rollup
- cleanup decisions for preserved failed/divergent workspaces

### Plugin/cmux owns

- ephemeral UX projection only
- no planning truth
- no reconcile authority

### Verifier owns

- judgment on whether the delivered proof satisfies the selected risk route
- not the mutation of shared state itself

## Important boundary rule

**A workspace may claim completion; only finalize may declare shared progress complete.**

That single sentence should drive the whole milestone.

---

## Recommended reconcile/finalize flow

## Phase/wave lifecycle

1. **Plan selection**
   - orchestrator groups runnable plans by wave
   - verification route is known for each plan

2. **Workspace provisioning**
   - `workspace add <plan-id>`
   - runtime-spawn contract pins executor to that workspace root

3. **Plan execution in workspace**
   - executor writes code + plan-local outputs only
   - executor does **not** mutate shared `STATE.md` / `ROADMAP.md` in workspace mode

4. **Workspace inspection / reconcile intake**
   - `workspace reconcile <plan-id>` gathers health + result manifest
   - classify workspace as `healthy`, `stale`, `divergent`, `failed`, `missing`

5. **Eligibility check before finalize**
   - verify required proof for `skip` / `light` / `full`
   - healthy code reconcile is necessary but not sufficient; proof contract must also pass

6. **Deterministic finalize from main checkout**
   - reconcile healthy workspaces in stable order
   - recompute shared planning state from disk truth
   - write shared artifacts once

7. **Post-finalize projection**
   - plugin invalidates once
   - cmux coordinator emits one consolidated UX update

8. **Cleanup**
   - clean healthy obsolete workspaces
   - preserve stale/divergent/failed workspaces until operator chooses recovery/forget path

## Deterministic ordering recommendation

Use **smallest `plan_id` / workspace name first** within a wave, then wave order.

Reason:

- matches current execute-phase wording
- stable for humans
- easy to prove in tests
- avoids completion-order nondeterminism

## Failure behavior recommendation

- **healthy sibling plans should still finalize** even if another workspace is stale/divergent/failed
- failed workspaces become retained artifacts with recovery previews
- if code reconcile succeeds but shared-state finalize fails, keep a durable finalize report marking:
  - code landed / partial finalize
  - shared-state mutation incomplete
  - rerun finalize from main checkout only

This avoids re-executing plans when only aggregation failed.

---

## Build order and dependency reasoning

## Recommended build order

### 1. Runtime workspace pinning contract

**Why first:** nothing else is trustworthy until “run in workspace X” is a real runtime guarantee.

Deliverables:

- authoritative spawn contract for workspace `workdir`
- workflow wording aligned to only guaranteed behavior

### 2. Shared-state ownership split

**Why second:** once workspaces are real, prevent them from writing global planning state.

Deliverables:

- executor/workflow contract: workspace mode is plan-local only
- identify exactly which outputs stay local vs centralized

### 3. Reconcile metadata + finalize command surface

**Why third:** after ownership is split, the system needs an explicit way to bring good work back.

Deliverables:

- result manifest schema
- deterministic finalize commands
- partial-wave handling

### 4. cmux event coordinator integration

**Why fourth:** once execution/reconcile lifecycle is explicit, cmux can project the real lifecycle instead of raw noisy hooks.

Deliverables:

- coordinator module
- plugin hook rewiring
- stable status/progress/log semantics tied to finalize/recovery states

### 5. Risk-based testing policy wiring

**Why fifth:** policy should gate finalize eligibility, but it is easier to enforce cleanly after execution/reconcile surfaces exist.

Deliverables:

- durable `verification_route` carriage end-to-end
- proof normalization for finalize/verifier
- workflow/template/doc alignment

### 6. End-to-end proof / regression suite

**Why last:** only after architecture boundaries exist can tests prove deterministic same-end-state behavior.

Deliverables:

- same-wave multi-workspace integration tests
- partial-wave recovery tests
- finalize-order invariance tests
- sequential fallback non-regression tests
- cmux pressure / debounce tests

## Dependency graph summary

- **pinning** is prerequisite to meaningful workspace execution
- **ownership split** is prerequisite to safe parallelism
- **finalize surface** is prerequisite to deterministic shared-state truth
- **cmux coordination** depends on explicit lifecycle states to display
- **risk-based testing enforcement** depends on finalize/readiness checkpoints
- **E2E proof** depends on all of the above

---

## Durable architecture moves vs optional follow-ons

## Durable moves (recommend for v19.0)

1. **Runtime-enforced workspace pinning**
2. **Single-writer shared-state finalize pipeline from main checkout**
3. **Plan-local-only workspace execution contract**
4. **Deterministic reconcile/finalize ordering**
5. **cmux event coordinator with one parse/snapshot per flush**
6. **End-to-end carriage of `verification_route` into finalize eligibility**

## Optional follow-on ideas (not required for v19.0)

1. **Per-plan / per-workspace cmux drill-down views**
   - useful later, but workspace-level truth first is enough

2. **Automatic stale-workspace repair for safe cases**
   - `jj workspace update-stale` is a good candidate only after base finalize flow is solid

3. **Promotion of `light` → `full` based on observed blast radius**
   - valuable, but can follow initial policy wiring

4. **Persisted finalize journal / replay tooling**
   - helpful for recovery, but not required to establish the boundary

5. **Socket-native cmux adapter**
   - CLI-first is enough for this milestone if coordination/backpressure is solved

---

## Likely touched subsystems/files

### Highest-probability code files

- `src/commands/workspace.js`
- `src/lib/jj-workspace.js`
- `src/router.js`
- `src/lib/router-contract.js`
- `src/lib/commandDiscovery.js`
- `src/commands/state.js`
- `src/commands/roadmap.js`
- `src/lib/decision-rules.js`
- `src/lib/orchestration.js`
- `src/plugin/index.js`
- `src/plugin/file-watcher.js`
- `src/plugin/project-state.js`
- `src/plugin/cmux-sidebar-sync.js`
- `src/plugin/cmux-attention-sync.js`
- `src/plugin/parsers/config.js`
- **new:** `src/plugin/cmux-event-coordinator.js`
- **new:** finalize/reconcile helper module(s) under `src/commands/execute*` and/or `src/lib/*`

### Likely workflow/docs surfaces

- `workflows/execute-phase.md`
- `workflows/execute-plan.md`
- plan/templates carrying verification-route semantics
- risk-based testing reference docs and verifier/planner wording

---

## Confidence assessment

| Area | Confidence | Why |
|---|---|---|
| JJ workspace isolation should be plan-local, single-writer shared state should finalize from main checkout | HIGH | Strong alignment between backlog, current code, and JJ official workspace/stale-working-copy docs |
| cmux should use a debounced coordinator | HIGH | Current plugin code duplicates parse/sync work; EDD and cmux CLI docs strongly support a unified adapter-driven approach |
| risk-based testing should gate finalize eligibility, not just docs wording | MEDIUM-HIGH | PRD/policy are explicit, current code already carries `verification_route`, but exact storage/proof schema still needs implementation design |
| exact command namespace for finalize (`execute:*` vs `workspace:*`) | MEDIUM | Architectural fit favors `execute:*`, but this is a product-surface choice rather than a protocol necessity |

## Sources

- `.planning/research/JJ-WORKSPACE-PARALLEL-EXECUTION-BACKLOG.md`
- `.planning/research/CMUX-EVENT-COORDINATOR-EDD.md`
- `.planning/research/CMUX-FIRST-UX-PRD.md`
- `.planning/resources/RISK-BASED-TESTING-PRD.md`
- `.planning/resources/RISK-BASED-TESTING-POLICY.md`
- `src/commands/workspace.js`
- `src/lib/jj-workspace.js`
- `src/plugin/index.js`
- `src/plugin/cmux-targeting.js`
- `src/plugin/cmux-sidebar-sync.js`
- `src/plugin/cmux-attention-sync.js`
- `src/plugin/project-state.js`
- `src/lib/decision-rules.js`
- `workflows/execute-phase.md`
- Jujutsu official docs: https://docs.jj-vcs.dev/latest/working-copy/ and https://docs.jj-vcs.dev/latest/cli-reference/
- cmux docs via Context7 (`/manaflow-ai/cmux`) covering `set-status`, `clear-status`, `set-progress`, `clear-progress`, `log`, `notify`, `sidebar-state`, and managed-workspace environment targeting
