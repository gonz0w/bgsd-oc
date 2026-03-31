# Phase 150: TDD Execution Semantics & Proof - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

## Phase Boundary
This phase makes `type: tdd` execution trustworthy by enforcing deterministic RED/GREEN/REFACTOR behavior during execution and by proving that behavior end to end with fixture-backed coverage and an auditable artifact trail. It clarifies execution semantics and proof requirements only; it does not expand TDD selection rules or add broader workflow capabilities.

## Implementation Decisions

### Stage Semantics
- RED validity is anchored to the targeted test failing. The contract should not depend on brittle wording or exact error text, and it does not need to prove the precise root-cause category beyond "the targeted test failed."
- GREEN is targeted-only by default. It should prove the targeted behavior now passes, without requiring a broader smoke set or heuristic minimality checks.
- REFACTOR is also targeted-only by default. It should re-run the same targeted proof used for the step unless a plan explicitly asks for broader verification.

### Target Selection Contract
- Each RED/GREEN/REFACTOR step should declare the exact test command or selector to run. The executor should treat that explicit command as the canonical target instead of inferring a logical test id or widening to file-level targeting.

### Audit Trail Contract
- Because stage validation is intentionally targeted, the audit trail should preserve more concrete proof per step.
- The default proof package should store the exact targeted command, its exit status, and the matched pass/fail evidence for each stage.
- Full raw logs are not required by default; the contract should preserve enough structured evidence to prove the cycle without turning every run into a transcript dump.

### Agent's Discretion
- No major gray areas were delegated to agent discretion. Downstream agents should treat the stage-targeting and audit-shape decisions above as locked.

## Specific Ideas
- Keep one canonical TDD contract for downstream execution work, consistent with Phase 149's contract-alignment work.
- Favor deterministic, explicit per-step targeting over inferred or runner-mapped targeting.
- Increase audit detail specifically because the execution contract is targeted by default.

## Stress-Tested Decisions
- Original decision: RED should require the targeted test to fail, but allow exact failure wording or diff details to vary.
  - Stress-test challenge: A targeted test can fail for the wrong reason and still create false confidence.
  - Final decision: RED still counts when the targeted test fails; failure-cause matching should not become a brittle gate.
- Original decision: GREEN should require the targeted behavior to pass and run the planned verification set.
  - Stress-test revision: GREEN becomes targeted-only by default so small TDD loops stay fast and trustworthy.
  - Follow-on clarification: Each step must name the exact command or selector so targeted-only execution has an unambiguous contract.
- Original decision: REFACTOR should re-run the planned verification set that established GREEN.
  - Stress-test revision: REFACTOR becomes targeted-only by default, matching RED/GREEN unless a plan explicitly broadens verification.
  - Follow-on clarification: The same exact-command targeting rule applies to REFACTOR steps.
- Original decision: Preserve per-stage outcomes, targeted verification evidence, and the resulting commit/summary trail without full raw logs by default.
  - Stress-test revision: Increase the default audit detail now that RED/GREEN/REFACTOR are all targeted.
  - Follow-on clarification: Require the exact targeted command, exit status, and matched result evidence for each stage as the canonical proof package.

## Deferred Ideas
None - discussion stayed within phase scope.

---
*Phase: 150-tdd-execution-semantics-proof*
*Context gathered: 2026-03-28*
