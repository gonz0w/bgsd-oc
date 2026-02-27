# Phase 42: Integration & Validation - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Validate that all v7.0 features (Phases 37-41, 43) work end-to-end with measured performance and no regressions. This phase tests and measures — it does not build new features. Fixes to existing v7.0 code are in scope when validation reveals bugs.

</domain>

<decisions>
## Implementation Decisions

### Canary Project Strategy
- Use this project (gsd-opencode) as the canary — self-referential validation
- Run a full cycle: plan-phase → execute-phase → verify-work on Phase 44 (Review Gate Hardening)
- This means Phase 44 gets planned as a real side effect of validation — real work, real pipeline exercise
- If the canary cycle hits problems (agent errors, bad plan output), treat them as bugs in v7.0 features — fix and re-run

### Token Measurement Approach
- Baseline: checkout v6.0 tag, run the same commands, capture token counts
- Measure total tokens consumed during a complete plan→execute→verify workflow cycle
- Use an actual tokenizer (tiktoken or equivalent) for real token counts, not character approximations
- The >=30% savings target is a goal, not a hard gate — measure and document actual savings, ship either way
- Documenting measured token results counts as passing criterion 2, even if savings are below 30%

### Regression Scope & Severity
- All existing tests (574+) plus new tests written for v7.0 features must pass
- Output format regressions detected via Phase 37's contract test snapshots (automated, not manual)
- Bundle budget (1000KB): build and measure file size of bin/gsd-tools.cjs — no permanent CI check needed
- Do NOT write new tests for coverage gaps found during validation — document gaps only

### Pass/Fail Gates
- All five success criteria evaluated as a checklist — all must pass
- Token savings exception: measuring and documenting counts as passing (see above)
- Blocking failures (test failures, bundle bloat) get fixed immediately within this phase
- Minor/deferred findings (token shortfall, test coverage gaps) get documented
- Produce a structured validation report (markdown) with all criterion results, token measurements, and findings

### Agent's Discretion
- Exact tokenizer implementation choice
- v6.0 baseline checkout strategy (tag vs commit hash)
- Validation report structure and formatting
- Order of criterion evaluation

</decisions>

<specifics>
## Specific Ideas

- The canary cycle should exercise Phase 44 planning — this produces real output that validates the entire pipeline
- Token measurement should compare full workflow token consumption, not just individual command output sizes
- Validation report should be a standalone artifact that clearly shows pass/fail per criterion

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 42-integration-validation*
*Context gathered: 2026-02-27*
