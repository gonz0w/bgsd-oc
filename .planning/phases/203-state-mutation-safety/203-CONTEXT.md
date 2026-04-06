# Phase 203: State Mutation Safety - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<phase_intent>
## Phase Intent
- **Local Purpose:** Add regression validation, batch transaction support, and sacred data protection to the state mutation system.
- **Expected User Change:** Before: batched state writes had no validation gate and sacred data could theoretically interleave with batch writes. After: `verify:state validate` runs at plan end, sacred data uses single-write path only, batched non-sacred writes are single-file atomic with rollback-on-failure, and `npm run build` smoke test gates plan completion.
- **Non-Goals:**
  - Adding new state types or changing STATE.md schema structure
  - Replacing the existing verify:state commands with new primitives
  - Implementing cross-plan or session-level transactions
</phase_intent>

<domain>
## Phase Boundary
This phase delivers batch transaction support for non-sacred state, regression validation for batched writes, and enforcement that sacred data (decisions, lessons, trajectories, requirements) always uses single-write paths. It extends the existing `verify:state` infrastructure rather than replacing it.
</domain>

<decisions>
## Implementation Decisions

### High-Impact Decisions
- **Sacred Data Boundary** — Locked. Sacred data = decisions, lessons, trajectories, requirements only. These always use the canonical single-write path. No batching of sacred data under any circumstance.
- **Validation Trigger Point** — Locked. `verify:state validate` runs at plan end only (after all batched writes complete), not after each individual batch. Validation runs once as a gating checkpoint before plan completion.
- **Batch Failure Recovery** — Locked. On validation failure: rollback all changes in the batch and report failure. Plan aborts with clear error. No partial state left behind.

### Medium Decisions
- **Atomicity Scope** — Locked. Single-file = atomic. Each file in a batch commits independently. Multi-file transactions are not atomic across files. If one file write fails, others remain committed (unless rollback triggered by validation failure).
- **Smoke Test Placement** — Locked. `npm run build` smoke test runs once after execute-phase completes, not after planning. Serves as final gate before plan completion.
- **util:validate-commands** — Defaulted. Runs once after any routing change, consistent with Phase 159 pattern. Agent discretion for exact placement within execute-phase.

### Low Defaults and Open Questions
- **Validation Report Format** — Untouched. Agent discretion to format output clearly. No specific format mandated.
- **Batch Size Limits** — Untouched. Agent discretion for reasonable batch sizes. No explicit limits specified.

### Agent's Discretion
- Validation report formatting details
- Batch size implementation details
- Exact smoke test integration point within execute-phase
</decisions>

<specifics>
## Specific Ideas
- `verify:state complete-plan` extends batch transaction support (not a new command, an extension of existing behavior)
- Sacred data writes never batched — always canonical single-write path
- Phase 202 parallelization safety is a prerequisite; this phase builds on that infrastructure
</specifics>

<stress_tested>
## Stress-Tested Decisions
All decisions held up under stress testing — no revisions needed. Power-user challenged: plan-end validation timing (wanted per-batch validation). Decision: plan-end only is correct because Phase 202 already provides per-batch safety via mutex-protected parallel writes; plan-end validation is the regression gate, not the per-write safety mechanism.
</stress_tested>

<deferred>
## Deferred Ideas
None — discussion stayed within phase scope.
</deferred>

---
*Phase: 203-state-mutation-safety*
*Context gathered: 2026-04-05*
