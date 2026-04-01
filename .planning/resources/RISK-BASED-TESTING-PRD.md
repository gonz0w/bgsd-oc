# Risk-Based Testing PRD

**Project:** bGSD Plugin
**Author:** OpenCode
**Date:** 2026-03-31
**Status:** Backlog
**Target window:** Future milestone focused on testing strategy, verification cost, and workflow alignment

## Problem

This repo uses TDD to build many changes and also runs broader verification at plan or phase end.

That is directionally correct, but the current system risks spending too much test effort in low-signal areas while still leaving some higher-risk areas under-specified.

Current tension:
- TDD already proves the intended behavior for a narrow change
- task and plan verification can also prove the touched slice
- broad suites are still valuable for regression detection
- but repeating broad suites for docs, prompts, wrappers, or tightly scoped logic can add cost without adding much new signal

The repo also has some contract drift:
- newer workflow guidance prefers targeted checks first and reserves broad suites for end-of-plan or end-of-phase use
- older TDD docs still describe heavier "run the suite after each edit" and "all tests pass" expectations

Result: the testing model is conceptually strong, but not yet consistently calibrated to change risk.

## Goal

Define a repo-wide testing strategy that keeps TDD strong, reduces redundant verification, and makes broad-suite usage explicit and risk-based.

The future state should:
- preserve RED -> GREEN -> REFACTOR discipline for true TDD work
- distinguish behavior proof from regression proof
- make targeted verification the default for narrow changes
- reserve broad regression suites for changes whose blast radius justifies the cost
- align planner, executor, verifier, and docs on one shared testing policy

## Non-Goals

- Removing TDD from the repo
- Forcing a full-suite run after every task or every edit
- Replacing human verification for visual, UX, or external-service behavior
- Rewriting the whole planning system just to change test wording
- Eliminating broad regression gates entirely

## Primary User Need

As a maintainer or agent planning work in this repo, I want clear rules for how much testing is enough for a given change, so that I can spend verification effort where it adds real signal and avoid paying for redundant proof.

## Why This Matters Now

The repo already contains the beginnings of a risk-based model:
- TDD gates validate exact declared target commands
- execute workflows distinguish `skip`, `light`, and `full` verification routes
- planner guidance already says task verification should be the narrowest proof that the task works

But that intent is not yet fully turned into one explicit product policy.

Without a canonical testing PRD:
- milestone planning may over-prescribe broad verification for low-risk work
- contributors may follow older, heavier guidance instead of newer targeted guidance
- the repo will keep paying verification cost unevenly across work types

## Current State Summary

### What is working

- TDD plans already have a strict RED / GREEN / REFACTOR contract
- workflow guidance already says GREEN and REFACTOR stay targeted-only by default
- planner guidance already discourages repeating the same broad verification command across task and plan layers
- verifier guidance already prefers focused behavioral proof over broad `npm test --test-name-pattern` style runs

### What is not yet settled

- the repo still contains older docs that imply broader testing than the newer execution workflow requires
- there is no single decision table that tells planners when `skip`, `light`, or `full` is appropriate
- "phase-end comprehensive suite" is still treated too generically instead of as a risk decision
- docs-, workflow-, wrapper-, and prompt-heavy work do not have a crisp low-cost verification contract

## Product Direction

Adopt an explicit layered testing model:

1. **TDD proof** proves the newly introduced behavior.
2. **Task verification** proves the changed slice works in the local context.
3. **Plan or phase regression** proves unrelated behavior was not broken, but only when the risk justifies broad-suite cost.
4. **Human verification** remains mandatory for appearance, flow, or external effects that automation cannot prove well.

This makes testing additive by purpose, not repetitive by habit.

## Testing Layers

### Layer 1: TDD gate proof

Required when a plan is `type: tdd`.

Purpose:
- prove the feature contract was written first
- prove the implementation made the targeted test pass
- prove refactoring preserved behavior

Default shape:
- RED validates exact target fails
- GREEN validates exact target passes
- REFACTOR validates the same target still passes

This layer answers: "Did we build the intended behavior correctly?"

### Layer 2: Focused task verification

Required for nearly all code-changing tasks, TDD or non-TDD.

Purpose:
- prove the touched command, file, route, parser, or behavior actually works in context
- catch obvious integration mistakes near the changed slice

Preferred examples:
- explicit `node --test <file>` lists
- `npm run test:file -- <file>`
- direct CLI smoke runs
- targeted parser or fixture tests
- structural verification for docs or wrappers when executable tests add no signal

This layer answers: "Does the touched slice work where it lives?"

### Layer 3: Broad regression gate

Optional by default. Required only for broad, risky, or infrastructure-level work.

Purpose:
- detect collateral regressions outside the targeted slice
- provide confidence for cross-cutting changes

Typical triggers:
- router or command dispatch changes
- shared parser or helper behavior used widely across namespaces
- generated runtime artifacts like `plugin.js` or `bin/bgsd-tools.cjs`
- test infrastructure, build pipeline, model-selection core, or state-management changes
- wide refactors with unclear blast radius

This layer answers: "Did we break other things that targeted checks would miss?"

### Layer 4: Human verification

Required when automation cannot fully prove the requirement.

Typical triggers:
- visual appearance
- prompt quality and UX feel
- interactive flow quality
- third-party integration behavior that needs a real environment

This layer answers: "Does the result actually feel or behave right to a human?"

## Verification Routes

### `skip`

Use when:
- the plan already has sufficient explicit proof
- changes are docs-only, guidance-only, wrapper-only, or structurally testable without broader execution
- no additional broad regression signal would be created

Contract:
- no extra broad-suite reruns beyond explicit task or plan checks

### `light`

Use by default for most narrow implementation work.

Use when:
- the change has a clear touched slice
- targeted tests or smoke runs can directly prove the behavior
- blast radius is limited and understood

Contract:
- focused verification only
- prefer narrow commands attached to the changed behavior

### `full`

Use when the change is broad, risky, or infrastructure-level.

Use when:
- many commands or subsystems share the touched logic
- runtime artifacts must be rebuilt for trustworthy proof
- the change modifies core planner/executor/verifier semantics
- the change removes or simplifies compatibility logic with potential unknown coupling

Contract:
- one broad regression gate at plan end or overall verification
- never rerun the same broad suite after every edit

## Decision Matrix

### TDD + focused verification is usually enough

Applies to:
- isolated business logic
- single parser or helper with tight file-level test coverage
- small command behavior changes with direct smoke proof

Expected route:
- `light`

### Structural verification is usually enough

Applies to:
- docs
- workflow wording
- templates
- planner guidance
- command wrappers that do not change runtime semantics

Expected route:
- `skip` or `light`, depending on whether a focused smoke check adds signal

### Broad regression should still run

Applies to:
- router/dispatch changes
- command registry or alias behavior
- plan parsing, roadmap parsing, or shared markdown normalization
- plugin/runtime bundle generation
- global output shaping or shared execution semantics
- large-scale simplification or compatibility cleanup

Expected route:
- `full`

## Requirements

### Functional

1. The repo must define one canonical testing policy that distinguishes TDD proof, focused verification, broad regression, and human verification.
2. Planner guidance must include a decision rule for selecting `skip`, `light`, or `full`.
3. Task `<verify>` guidance must remain the narrowest proof that the changed task works.
4. Plan `<verification>` guidance must represent only aggregate, cross-task, or final proof not already covered by task `<verify>` blocks.
5. TDD plans must keep exact-command RED / GREEN / REFACTOR gates as the mandatory behavior-proof layer.
6. Docs-heavy, wrapper-heavy, and workflow-heavy work must have an explicit low-cost verification contract.
7. Broad-suite reruns must be justified by blast radius, not performed by default.

### Documentation

1. Older TDD docs must be aligned with the newer targeted-only execution contract.
2. Planner, executor, verifier, templates, and docs must use compatible language about what each verification layer proves.
3. The repo should contain at least one decision table or rubric that future milestone planners can reuse directly.

### Quality

1. Future plans should reduce repeated use of the same expensive command across task `<verify>` and plan `<verification>` unless the second run adds explicit new signal.
2. Future verification should be cheaper for low-risk work without lowering confidence for broad-risk work.
3. Test strategy changes must preserve backward compatibility with existing planning artifacts where practical.

## Proposed Milestone Slices

### Slice A: Policy codification

- create one canonical testing strategy reference
- define `skip` / `light` / `full` selection rules
- define change-type examples and expected verification levels

### Slice B: Contract alignment

- update TDD docs to match current targeted gate semantics
- align workflow, planner, verifier, and template wording
- remove or rewrite older guidance that implies unnecessary broad-suite repetition

### Slice C: Planner integration

- teach milestone and phase planning artifacts to record the chosen verification route with rationale
- add prompts or checks so plans explain why `full` is needed when selected
- add prompts or checks so docs-heavy plans avoid unnecessary broad suites

### Slice D: Evidence and feedback

- add lightweight review or audit checks for repeated expensive verification
- capture lessons when a broad gate added no new signal or when skipping it caused missed regressions
- refine the risk rubric with repo-local evidence over time

## Success Metrics

- future plans use `light` as the default for narrow code changes and `full` only when blast radius is clearly broader
- docs and workflow-only plans stop prescribing unnecessary broad test-suite runs
- TDD remains mandatory where selected, but no longer implies blanket broad-suite repetition
- planner and verifier language converge on one shared layered-testing model
- maintainers can explain why a given phase used `skip`, `light`, or `full` without guesswork

## Risks

- over-optimizing for speed could remove regression coverage from changes that are broader than they first appear
- under-specified routing rules could make different planners apply the policy inconsistently
- documentation alignment without planner integration may not change behavior enough
- some "narrow" changes may still hide broad coupling in legacy areas of the repo

## Open Questions

1. Should `full` be selected at plan creation time only, or may execution promote `light` to `full` when blast radius turns out larger than expected?
2. Should docs-only and workflow-only plans record `skip` explicitly in the plan body for traceability?
3. Should generated-artifact changes automatically require `full`, or only when the underlying source change is itself broad?

## Recommended First Slice

Start with policy and contract alignment:

1. codify the layered testing model
2. add a planner-facing decision matrix for `skip` / `light` / `full`
3. align `docs/tdd.md` and related references with the targeted-only execution contract
4. update milestone and phase planning language so broad suites require explicit rationale

This is the smallest slice that should reduce unnecessary testing cost without weakening confidence.

## Planner Pickup Notes

This PRD is intended as a future milestone-planning input.

When a milestone planner consumes it, the resulting milestone should likely:
- include at least one planning/documentation slice and one enforcement/integration slice
- treat testing strategy as a workflow/product contract issue, not only a docs cleanup
- preserve backward compatibility with existing plan artifacts while improving future plan quality
