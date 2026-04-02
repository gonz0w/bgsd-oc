# Roadmap: bGSD Plugin

## Milestones

- ✅ **v18.1 Greenfield Cleanup & CLI Simplification** - Phases 173-180 (shipped 2026-04-01)
- 🚧 **v19.0 Workspace Execution, cmux Coordination & Risk-Based Testing** - Phases 181-187 (active)

## Overview

v19.0 hardens execution control in the order the repo needs it to become trustworthy under parallel JJ work: first prove workspace-root truth and preserve safe fallback behavior, then make verification-route policy explicit early enough to govern risky runtime work, then split plan-local workspace output from shared `.planning/` ownership so finalize becomes the only writer of milestone truth. With those control boundaries in place, the milestone finishes by making partial-wave recovery deterministic and surfacing that real lifecycle through debounced, fail-open `cmux` coordination and readable recovery-first signals rather than noisy polish.

## Phases

- [x] **Phase 181: Workspace Root Truth & Safe Fallback** (completed 2026-04-01) - Runtime-prove JJ workspace pinning before parallel execution is allowed to proceed.
- [x] **Phase 182: Risk-Routed Hardening Proof Policy** (completed 2026-04-01) - Make `skip` / `light` / `full` verification routing govern runtime-hardening work early.
- [x] **Phase 183: Plan-Local Workspace Ownership** (completed 2026-04-02) - Keep workspace execution isolated from shared planning artifacts until finalize.
- [x] **Phase 184: Deterministic Finalize & Partial-Wave Recovery** (completed 2026-04-02) - Finalize shared state once, preserve healthy sibling progress, and keep recovery inspectable.
- [x] **Phase 185: cmux Coordination Backbone** (completed 2026-04-02) - Turn bursty runtime activity into one debounced, bounded, fail-open `cmux` refresh path.
- [x] **Phase 186: cmux Truthful Lifecycle Signals** (completed 2026-04-02) - Show readable workspace-scoped status, progress, logs, and intervention signals for the real execution lifecycle.
- [x] **Phase 187: Reconstruct Phase 182 Verification Coverage** (completed 2026-04-02) - Close the v19.0 blockers by restoring formal verification coverage and fixing the live workflow wording regression.

## Phase Details

### Phase 181: Workspace Root Truth & Safe Fallback
**Goal**: Operators can trust that a workspace-targeted run really executes inside the intended JJ workspace and safely falls back before work starts when that proof is missing
**Depends on**: Phase 180
**Requirements**: JJ-01, JJ-03
**Success Criteria** (what must be TRUE):
  1. Operator can start a workspace-targeted plan and prove the executor's working directory and `jj workspace root` both match the intended workspace.
  2. Repo-relative reads, writes, and plan-local artifact output stay inside the assigned workspace while workspace mode is active.
  3. If workspace pinning proof fails or workspace mode is unavailable, execution falls back to the supported sequential path before plan work begins.
**Plans**: 2/2 plans complete

### Phase 182: Risk-Routed Hardening Proof Policy
**Goal**: Planning, execution, and verification all use one explicit verification-route contract that matches proof cost to blast radius for this milestone's runtime hardening
**Depends on**: Phase 181
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04
**Success Criteria** (what must be TRUE):
  1. Planner and execution artifacts show an explicit `verification_route` of `skip`, `light`, or `full` for implementation work.
  2. Runtime, shared-state, plugin, and generated-artifact changes in this milestone are routed to proof that includes focused behavior checks plus broad regression when risk is high.
  3. Docs-, workflow-, template-, and guidance-only slices can complete with structural or focused proof without defaulting to repeated broad-suite runs.
  4. Verifier output clearly separates missing behavior proof, missing regression proof, and missing human verification.
**Plans**: 2/2 plans complete

### Phase 183: Plan-Local Workspace Ownership
**Goal**: Workspace execution stays plan-local, while shared planning artifacts remain untouched until one explicit finalize path runs from trusted main-checkout state
**Depends on**: Phase 182
**Requirements**: JJ-02, FIN-01
**Success Criteria** (what must be TRUE):
  1. Parallel workspace runs write code edits, summaries, and proof outputs in their assigned workspace instead of mutating shared `.planning/` artifacts directly.
  2. `.planning/STATE.md`, `.planning/ROADMAP.md`, and `.planning/REQUIREMENTS.md` change only through one explicit finalize path after reconcile.
  3. Operator can inspect what a workspace completed before any shared milestone progress is declared complete.
**Plans**: 2/2 plans complete

### Phase 184: Deterministic Finalize & Partial-Wave Recovery
**Goal**: Healthy sibling workspaces can reconcile into one deterministic shared state while stale, divergent, or partially failed work stays inspectable and recoverable
**Depends on**: Phase 183
**Requirements**: FIN-02, FIN-03, FIN-04
**Success Criteria** (what must be TRUE):
  1. Healthy sibling workspaces can reconcile and report useful status even when another workspace in the same wave fails, goes stale, or needs recovery.
  2. Final shared planning state is the same regardless of the order in which healthy workspaces finish or are finalized.
  3. If a workspace becomes stale, divergent, or finalize fails partway through, operator can inspect durable recovery metadata and rerun recovery or finalize from the main checkout without re-executing already-healthy work.
**Plans**: 3/3 plans complete

### Phase 185: cmux Coordination Backbone
**Goal**: `cmux` updates become a trustworthy projection of runtime state because plugin refresh work is debounced, bounded, and quiet when `cmux` is absent or untrusted
**Depends on**: Phase 184
**Requirements**: CMUX-01, CMUX-04
**Success Criteria** (what must be TRUE):
  1. During bursty parallel activity, plugin refreshes coalesce into a debounced, bounded `cmux` pipeline instead of duplicate parse or process storms.
  2. One coordinated refresh cycle produces workspace-scoped `cmux` state from fresh runtime data rather than independent repeated sidebar and attention reads.
  3. When `cmux` is unavailable, unreachable, or not trusted for attachment, execution continues with quiet fail-open behavior instead of noisy errors or misleading status.
**Plans**: 2/2 plans complete

### Phase 186: cmux Truthful Lifecycle Signals
**Goal**: Users can read real execution and recovery state from `cmux` without guessing which workspace is working normally versus waiting on intervention
**Depends on**: Phase 185
**Requirements**: CMUX-02, CMUX-03
**Success Criteria** (what must be TRUE):
  1. User can see truthful workspace-scoped status, progress, and logs for running, blocked, waiting, stale, reconciling, finalize-failed, idle, and complete states.
   2. User receives a clear `cmux` attention signal when human input, stale-workspace recovery, or finalize intervention is required.
   3. Required-intervention states stand out from normal progress so operators can tell where to act without polling raw logs.
**Plans**: 2/2 plans complete

### Phase 187: Reconstruct Phase 182 Verification Coverage
**Goal**: Milestone acceptance can complete because the risk-routing slice regains formal verification evidence and the workflow contract wording regression is removed
**Depends on**: Phase 186
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04
**Gap Closure**: Closes gaps from `v19.0-MILESTONE-AUDIT.md`
**Success Criteria** (what must be TRUE):
  1. Phase 182 has formal verification evidence that satisfies the milestone audit's three-source requirement cross-reference for `TEST-01` through `TEST-04`.
  2. `tests/workflow.test.cjs` no longer fails on the locked rebuilt-runtime proof wording contract tied to `TEST-02`.
  3. Focused proof demonstrates the verification-route contract still distinguishes `skip`, `light`, and `full` coverage expectations across planning, execution, and verifier outputs.
  4. A follow-up milestone audit can treat the verification-routing slice as satisfied instead of blocked.
**Plans**: 2/2 plans complete

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 181. Workspace Root Truth & Safe Fallback | 2/2 | Complete    | 2026-04-01 |
| 182. Risk-Routed Hardening Proof Policy | 2/2 | Complete    | 2026-04-01 |
| 183. Plan-Local Workspace Ownership | 2/2 | Complete    | 2026-04-02 |
| 184. Deterministic Finalize & Partial-Wave Recovery | 3/3 | Complete    | 2026-04-02 |
| 185. cmux Coordination Backbone | 2/2 | Complete    | 2026-04-02 |
| 186. cmux Truthful Lifecycle Signals | 2/2 | Complete    | 2026-04-02 |
| 187. Reconstruct Phase 182 Verification Coverage | 2/2 | Complete   | 2026-04-02 |

---

*Last updated: 2026-04-02 after adding Phase 187 gap-closure planning*
