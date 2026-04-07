# Phase 203: State Mutation Safety - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<phase_intent>
## Phase Intent
- **Local Purpose:** Make batched state mutation safe by validating batched writes before progression and keeping sacred data on the canonical single-write path.
- **Expected User Change:** After a batched state write, the workflow validates the result before continuing; unsafe writes stop the run instead of silently proceeding. Non-sacred state can be committed atomically in a batch, while sacred data like decisions, lessons, trajectories, and requirements still write one at a time. Example: a bad batch fails closed instead of corrupting later steps.
- **Non-Goals:**
  - Redesigning the roadmap or expanding state mutation beyond this safety work
  - Batching sacred data writes
  - Changing command routing beyond the validation checks already called out in the roadmap
</phase_intent>

<domain>
## Phase Boundary
This phase delivers safety controls around state mutation: validation after batched writes, atomic batch support for non-sacred state, and strict exclusion of sacred data from batching.
</domain>

<decisions>
## Implementation Decisions

### High-Impact Decisions
- Batch failure handling — Locked. Allow one automatic retry for transient write/validation glitches, then fail closed and roll back non-sacred batch mutations atomically if the batch still does not validate.
- Sacred data isolation — Locked. Decisions, lessons, trajectories, and requirements always use the canonical single-write path and are never included in batched writes.

### Medium Decisions
- Post-write validation gate — Locked. `verify:state validate` runs after any batched state write in the execute-plan flow before progression continues.
- Atomic batch scope — Locked. `verify:state complete-plan` expands batch transaction support only to non-sacred state mutations.

### Low Defaults and Open Questions
- Build smoke and routing checks — Defaulted. Keep the roadmap's post-plan `npm run build` smoke test and `util:validate-commands --raw` contract check as fixed guardrails.

### Agent's Discretion
None.
</decisions>

<specifics>
## Specific Ideas
- The roadmap explicitly calls out validation after batched writes, atomic commits for non-sacred mutations, and never batching sacred writes.
- The safety goal is fail-closed behavior, not silent recovery.
</specifics>

<stress_tested>
## Stress-Tested Decisions
- Original decision: fail closed immediately on validation failure.
- Stress-test revision: allow one automatic retry for transient write/validation glitches before failing closed.
- Follow-on clarification: if the retry still fails, stop and roll back non-sacred batched mutations; do not continue on a suspect batch.
</stress_tested>

<deferred>
## Deferred Ideas
None — discussion stayed within phase scope.
</deferred>

---
*Phase: 203-State Mutation Safety*
*Context gathered: 2026-04-06*
