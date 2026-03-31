# TDD Reliability PRD

**Status:** Proposed
**Owner:** Future maintenance pass
**Created:** 2026-03-28
**Target Window:** Post-v16.0 follow-up / backlog candidate

## Problem

The repository has a real TDD capability, but it is not reliably selected or enforced.

Current gaps:
- TDD only triggers when a plan is explicitly `type: tdd`
- Planner and checker pressure depends on a phase-level roadmap hint, so eligible work often stays `type: execute`
- TDD instructions are split across multiple markdown files with overlapping or conflicting guidance
- `execute:tdd` gates validate shell exit codes, but do not strongly verify the intended RED/GREEN/REFACTOR state transitions
- Existing tests cover the CLI subcommands in isolation, but not a real end-to-end TDD plan execution flow

Result: TDD is present as a feature, but not dependable as a workflow.

## Goal

Make TDD selection, execution, and verification reliable enough that:
- TDD-eligible work is consistently identified during planning
- `type: tdd` plans execute through a clear RED -> GREEN -> REFACTOR path
- workflow docs, skills, and CLI behavior agree on the same contract
- regressions are caught by automated tests instead of user observation

## Non-Goals

- Force TDD for all work types
- Introduce a new agent just for TDD
- Turn TDD into a blocking global project setting
- Redesign the overall planning system outside the TDD-specific path

## Users and Jobs To Be Done

### User: planner/operator
- Wants TDD to be chosen automatically when a feature is a good fit
- Wants a visible explanation when TDD is skipped

### User: executor
- Wants one unambiguous TDD flow with clear gates and expected commits
- Wants failures to explain what is wrong with the TDD cycle, not just that a command exited non-zero

### User: maintainer
- Wants confidence that TDD still works after future workflow and CLI changes

## Proposed Outcome

### 1. Deterministic TDD selection
- Planner always evaluates TDD eligibility, even if ROADMAP omits a `**TDD:**` field
- ROADMAP `**TDD:**` remains useful, but changes strictness rather than whether TDD is considered at all
- Plans record one short rationale:
  - why TDD was selected, or
  - why TDD was intentionally skipped

### 2. Single source of truth for TDD behavior
- One canonical TDD execution definition owns the RED/GREEN/REFACTOR contract
- Other workflow/skill/docs references point to that source instead of restating overlapping rules
- Terminology and expected artifacts match everywhere

### 3. Stronger execution gates
- RED verifies a newly introduced target test fails for the expected missing behavior
- GREEN verifies that same target test now passes with minimal implementation
- REFACTOR verifies behavior is unchanged and tests still pass
- Anti-pattern detection matches the documented claims closely enough to be trustworthy

### 4. Real verification
- Structural verification rejects malformed `type: tdd` plans
- Integration tests prove a TDD plan can execute end-to-end and produce the expected commit trail

## Requirements

### Functional
1. Planner evaluates TDD eligibility for every implementation plan, not only phases with an explicit TDD roadmap hint.
2. Planner emits a short TDD decision rationale for each plan.
3. Checker validates TDD compliance at three levels:
   - `required`: blocker
   - `recommended`: warning
   - omitted/no hint: informational guidance only
4. `type: tdd` plans must follow one canonical TDD structure.
5. `execute:tdd` must validate RED, GREEN, and REFACTOR using TDD-aware semantics, not just raw command exit status.
6. TDD execution must produce the expected audit trail (phase-aware commits and summary evidence).

### Quality
1. Docs, workflows, skills, and CLI outputs must agree on command names and fields.
2. At least one end-to-end fixture test must exercise a real `type: tdd` plan.
3. Existing non-TDD workflows must remain backward compatible.

## Proposed Delivery Phases

### Phase A: Selection and documentation alignment
- Update planner and checker guidance so TDD eligibility is always evaluated
- Record a TDD decision rationale per plan
- Consolidate overlapping TDD workflow/skill/docs guidance into one canonical path

### Phase B: Execution hardening
- Upgrade `execute:tdd` validation beyond exit-code checks
- Align anti-pattern detection with documented expectations
- Tighten TDD plan-structure verification

### Phase C: Proof and observability
- Add fixture-backed end-to-end TDD execution tests
- Surface TDD selected/skipped rationale in plan or summary output
- Add simple visibility into TDD adoption/failures for future maintenance

## Success Metrics

- TDD-eligible plans are no longer silently emitted as standard execute plans without rationale
- At least one automated end-to-end test proves RED/GREEN/REFACTOR commit flow
- No doc/CLI contract mismatches remain in the TDD path
- Users can tell from planning output why TDD was or was not used

## Risks

- Over-enforcement could push trivial work into heavyweight TDD plans
- Weak heuristics could still misclassify some work without a human override path
- Tightening gate semantics may expose current workflow assumptions and require fixture/test investment

## Open Questions

1. Should omitted ROADMAP `**TDD:**` hints produce info-level checker output or stay planner-only?
2. Where should TDD selected/skipped rationale live long-term: frontmatter, plan body, or checker output?
3. Should RED/GREEN validation track a named target test, a file, or both?

## Recommended First Slice

Start with the smallest high-leverage package:
1. planner/checker always evaluate TDD eligibility
2. add required TDD decision rationale
3. unify markdown sources of truth
4. fix obvious CLI/document contract mismatches

This should make TDD selection noticeably more reliable before investing in deeper gate semantics.
