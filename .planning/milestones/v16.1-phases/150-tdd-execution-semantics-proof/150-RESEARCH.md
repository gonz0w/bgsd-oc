# Phase 150 Research: TDD Execution Semantics & Proof

**Researched:** 2026-03-28
**Question:** What does an agent need to know to PLAN Phase 150 well?

## Bottom Line

Phase 150 should be planned as execution-hardening work on the plugin, not as a product-facing TDD feature. The natural shape is:

1. **TDD-05 semantic contract + validator implementation**
2. **TDD-06 end-to-end proof + audit-trail verification**

TDD-06 depends on TDD-05. If the audit trail expands beyond current summary plumbing, either fold that into TDD-05 or add a small bridge plan between them.

## Current Architecture And Likely Change Surface

### Core implementation today

- `src/commands/misc.js:1536` implements `cmdTdd()`.
- Current `validate-red`, `validate-green`, and `validate-refactor` only shell out to `--test-cmd` and treat success/failure as `exitCode !== 0` or `=== 0` (`src/commands/misc.js:1554`).
- Current `auto-test` returns `passed`, `exit_code`, and `output_snippet`, but no target identity or semantic evidence (`src/commands/misc.js:1562`).
- Current `detect-antipattern` is file-shape only: non-test files in RED, test-file edits in GREEN, over-mocking heuristic (`src/commands/misc.js:1566`).

### Current contract/docs surfaces that must stay aligned

- Canonical authority: `skills/tdd-execution/SKILL.md:11`.
- Detailed reference: `skills/tdd-execution/tdd-reference.md:11`.
- Executor workflow: `workflows/tdd.md:1`.
- Main execution workflow hook-in: `workflows/execute-plan.md:111`.
- TDD plan template: `templates/plans/tdd.md:1`.
- CLI help surfaces: `src/lib/constants.js:419`, `src/lib/command-help.js:157`.

### Audit-trail / proof plumbing already in place

- TDD phase trailers are already supported by `execute:commit` via `--tdd-phase` -> `GSD-Phase: red|green|refactor` (`src/commands/misc.js:646`).
- Summary generation exists in `util:summary-generate` (`src/commands/misc.js:2167`).
- But summary generation is task-oriented, not TDD-phase-oriented: it maps commits to task names by order (`src/commands/misc.js:2262`).
- `structuredLog()` only reads git subject lines via `--format=%H|...|%s`; it does not read commit body/trailers (`src/lib/git.js:41`). That means existing summary plumbing cannot currently prove `GSD-Phase` trailers.

### Files/subsystems most likely to change

- `src/commands/misc.js`
- `src/lib/git.js`
- `workflows/tdd.md`
- `workflows/execute-plan.md`
- `skills/tdd-execution/SKILL.md`
- `skills/tdd-execution/tdd-reference.md`
- `templates/plans/tdd.md`
- `templates/summary.md` and/or summary-generation behavior if proof must be visible in SUMMARY
- `src/lib/constants.js` and maybe `src/lib/command-help.js` if output contract/help text changes
- Tests: `tests/agent.test.cjs`, `tests/workflow.test.cjs`, `tests/summary-generate.test.cjs`, plus likely a new TDD integration test file

## Boundaries From Phase 149 That Must Stay Intact

Phase 149 locked the pre-execution contract and explicitly deferred semantic enforcement:

- One canonical TDD contract source remains `skills/tdd-execution/SKILL.md` (`.planning/STATE.md:104`).
- Phase 149 stops at selection/rationale/severity alignment and does **not** absorb Phase 150 semantics (`.planning/STATE.md:105`, `.planning/STATE.md:109`).
- Required/recommended/omitted hint behavior must remain blocker/warning/info and must not be reopened by Phase 150 (`.planning/STATE.md:108`).
- `type: tdd` remains the dedicated plan form for one feature through RED -> GREEN -> REFACTOR (`skills/tdd-execution/SKILL.md:116`, `templates/plans/tdd.md:24`).
- Existing command names should stay canonical: `validate-red`, `validate-green`, `validate-refactor`, `auto-test`, `detect-antipattern` (`skills/tdd-execution/SKILL.md:29`, `src/lib/constants.js:426`).

Practical implication: Phase 150 should deepen validator semantics and proof, not rename surfaces or re-litigate TDD selection rules.

## Natural Plan Splits And Dependencies

### Recommended split

#### Plan 150-01 - TDD-05 semantic validator contract

Scope:

- Upgrade `execute:tdd` from exit-code-only checks to TDD-aware stage validation.
- Treat the exact declared test command as the canonical target, matching `150-CONTEXT.md:16`.
- Return a richer proof payload per stage: target command, exit status, and matched pass/fail evidence, matching `150-CONTEXT.md:19`.
- Align skill/workflow/template/help wording to the new semantic contract without breaking Phase 149 boundaries.
- Add targeted command-level tests for validator semantics.

Why first:

- TDD-06 proof needs a stable machine-readable proof contract before E2E fixtures can assert it.

#### Plan 150-02 - TDD-06 end-to-end proof and audit trail

Scope:

- Add a fixture-backed temp repo with a real `type: tdd` plan.
- Exercise a full RED/GREEN/(optional REFACTOR) sequence using real commands, commits, and summary generation.
- Assert expected git artifacts: conventional commit types plus `GSD-Phase` trailers.
- Assert expected summary/audit evidence exists and is stable enough for review.

Why second:

- This locks the implemented semantics in a realistic execution trace instead of only command-unit tests.

### Optional bridge plan if needed

If summary/audit requirements prove larger than expected, split out a small middle plan:

- **Plan 150-02:** proof/audit plumbing in git/summary layers
- **Plan 150-03:** end-to-end fixture proving the full path

That split is justified if commit-trailer visibility or SUMMARY shape changes touch enough non-validator code to deserve isolated verification.

## Risks, Test Strategy, And Proof Considerations

### Major risks

- **False confidence from brittle semantics:** Phase context explicitly says RED should prove targeted failure, but not exact wording/root cause (`150-CONTEXT.md:12`). Overly specific matching will be fragile across runners.
- **Target ambiguity:** current contract historically assumes `--test-cmd`; Phase 150 needs explicit exact-command targeting, not inferred logical test IDs (`150-CONTEXT.md:17`).
- **Audit gap:** current summary tooling does not parse commit trailers and is not stage-aware (`src/lib/git.js:41`, `src/commands/misc.js:2262`).
- **Workflow/summary mismatch:** `workflows/tdd.md:165` says each phase produces one commit, while generic summary generation still assumes task-ordered commits and `templates/summary.md:76` only notes TDD may have multiple commits.
- **No existing true executor E2E harness:** current coverage is mostly contract/unit/temp-repo command tests, not a full `type: tdd` plan proof.
- **Backward compatibility:** existing `execute:tdd` callers and tests expect the current subcommands and basic fields; changes should extend rather than silently replace output.

### Best-fit test strategy

1. **Keep command-level tests** in `tests/agent.test.cjs` for validator success/failure semantics.
2. **Add fixture-backed integration tests** using temp git repos, like `tests/summary-generate.test.cjs`, because that pattern already exists and is low-friction.
3. **Create at least one real `type: tdd` plan fixture** with:
   - plan frontmatter
   - explicit target commands per stage
   - failing RED command
   - passing GREEN command
   - optional REFACTOR proof
4. **Assert the audit trail at multiple levels**:
   - validator JSON output
   - git history / commit trailers
   - SUMMARY content or other chosen proof artifact
5. **Keep raw-log requirements minimal** per phase context; prefer structured evidence fields over transcript snapshots (`150-CONTEXT.md:21`).

### What the proof artifact likely needs to show

- exact target command used for RED/GREEN/REFACTOR
- exit status for each run
- matched pass/fail evidence snippet for each stage
- resulting `test(...)`, `feat(...)`, and optional `refactor(...)` commits
- `GSD-Phase` trailers present in git history
- stable summary/audit-trail representation that future tooling can inspect

## Existing Test And Fixture Baseline

### What exists now

- `tests/agent.test.cjs:373` covers help text and basic `execute:tdd` validator behavior.
- `tests/agent.test.cjs:461` covers `GSD-Phase` trailer creation on commit.
- `tests/workflow.test.cjs:798` and related Phase 149 tests lock contract wording and the Phase 150 boundary.
- `tests/summary-generate.test.cjs:25` already shows the preferred temp-repo + plan + scoped-commit fixture pattern.

### What does not exist yet

- No clear repository test currently proves a real `type: tdd` plan executes end-to-end and leaves the expected proof trail.
- No current summary-generation test asserts TDD stage evidence, exact target commands, or trailer-derived phase data.

## Should Phase 150 Plans Be `type: execute` Or `type: tdd`?

**Recommendation: use `type: execute` plans for Phase 150 implementation work.**

Rationale:

- The phase changes plugin orchestration, validator semantics, git/summary plumbing, docs, and tests across many files.
- `type: tdd` is meant for one feature with a tight RED -> GREEN -> REFACTOR cycle and explicit behavior-first implementation (`skills/tdd-execution/SKILL.md:118`).
- Phase 150 work is infrastructure/tooling hardening, not a single product behavior that cleanly fits one dedicated TDD feature plan.
- The thing under test should be a `type: tdd` fixture plan, but the implementation plans themselves should stay `type: execute`.

## Planning Notes For The Planner

- Keep Phase 149 terms and command names intact; extend semantics, do not rename surfaces.
- Treat proof shape as part of the implementation contract early, not as a last-minute test concern.
- Decide early whether SUMMARY is the canonical audit-trail surface or whether validator JSON plus git history is the canonical source and SUMMARY only summarizes it.
- If trailer visibility is required in summaries, plan explicit work in `src/lib/git.js` / summary generation rather than assuming it already exists.

## Recommended Planning Shape

- **Plan 01 (`type: execute`)**: semantic validator contract, richer proof payload, workflow/skill/help alignment, focused validator tests
- **Plan 02 (`type: execute`)**: fixture-backed real `type: tdd` execution proof, commit/audit-trail assertions, summary/proof verification
- **Optional Plan 03 (`type: execute`)**: only if audit-trail plumbing into SUMMARY becomes large enough to split from validator work

---
*Phase: 150-tdd-execution-semantics-proof*
*Research completed: 2026-03-28*
