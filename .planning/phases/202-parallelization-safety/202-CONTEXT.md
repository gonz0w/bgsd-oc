# Phase 202: Parallelization Safety - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<phase_intent>
## Phase Intent
- **Local Purpose:** Make parallel workflow stages safe when they share cache and execution coordination.
- **Expected User Change:** Parallel runs can fan out without corrupting shared cache state, order-sensitive work is verified before dispatch, and the JJ proof gate still protects accelerated paths.
  - Before: shared cache mutation could race when stages ran at once.
  - After: shared cache mutation is serialized through the existing project lock path.
  - Before: wave ordering and child cleanup behavior were implicit.
  - After: dependency ordering is verified in the lifecycle layer and spawned children are allowed to finish before the failure is handled.
- **Non-Goals:**
  - Reworking the parallel feature into dynamic auto-discovery of dependencies.
  - Adding new dependencies or replacing the existing JJ proof gate.
  - Changing unrelated state-mutation safety work, which belongs to the next phase.
</phase_intent>

<domain>
## Phase Boundary
This phase delivers safe parallel execution for the PARALLEL-01..04 requirements: mutex-protected shared cache access, verified dependency wave ordering, preserved JJ workspace proof gates, and `Promise.all` fan-in over independent spawned stages.
</domain>

<decisions>
## Implementation Decisions

### High-Impact Decisions
- Cache mutation guard — **Locked**. Reuse `withProjectLock()` semantics at a narrower scope for cache mutation. Reasoning: it keeps the stack dependency-free and fits the existing project lock model without introducing a new mutex system.
- Wave cleanup on `Promise.all` rejection — **Deferred**. Let already-started children finish, then handle the failure. Reasoning: treat sibling completion as a testing question first rather than guessing the cleanup policy.
- Dependency verification location — **Locked**. Keep `resolvePhaseDependencies` verification in `src/lib/lifecycle.js`. Reasoning: the Kahn-sort logic already lives there, so the verification stays with the ordering implementation.

### Medium Decisions
- None yet.

### Low Defaults and Open Questions
- Parallel wave sibling cleanup impact — **Deferred** until testing shows whether continued siblings matter in practice.

### Agent's Discretion
- None.
</decisions>

<specifics>
## Specific Ideas
- Preserve the existing JJ proof gate on all accelerated paths.
- Use Kahn ordering before dispatch so completion order cannot redefine scheduling order.
- Keep shared-state writes out of the parallel section.
</specifics>

<stress_tested>
## Stress-Tested Decisions
- `withProjectLock()` for cache mutation held up under stress testing, but the key-vs-global lock tradeoff remains a possible later refinement if testing shows contention.
- Letting started children finish on failure was challenged as potentially noisy; the cleanup policy remains open until testing proves whether sibling completion matters.
</stress_tested>

<deferred>
## Deferred Ideas
- Fine-grained sibling cleanup policy for rejected parallel waves.
- Any broader parallelization strategy beyond the fixed PARALLEL-01..04 scope.
</deferred>

---
*Phase: 202-Parallelization Safety*
*Context gathered: 2026-04-06*
