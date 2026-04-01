# Risk-Based Testing Policy

**Project:** bGSD Plugin
**Author:** OpenCode
**Date:** 2026-03-31
**Status:** Backlog policy proposal
**Companion PRD:** `.planning/resources/RISK-BASED-TESTING-PRD.md`

## Purpose

This policy defines how much testing is required for a change in this repo and what kind of proof each testing layer is expected to provide.

It is intended to guide future milestone planning, phase planning, plan verification design, and documentation alignment.

## Core Principle

Testing layers must be selected by purpose and blast radius, not repeated by habit.

Use different layers to answer different questions:
- TDD gates answer: "Did we build the intended behavior correctly?"
- focused verification answers: "Does the touched slice work in context?"
- broad regression answers: "Did we break unrelated behavior?"
- human verification answers: "Does the result actually feel or behave right in ways automation cannot fully prove?"

## Canonical Rules

1. TDD behavior proof is mandatory for `type: tdd` plans.
2. Task `<verify>` must be the narrowest proof that the changed task works.
3. Plan `<verification>` must add new signal beyond task `<verify>` rather than repeating it by default.
4. Broad suites are not default proof for all work; they are risk-triggered proof.
5. Docs-, templates-, workflows-, and wrapper-heavy work should use structural or focused verification unless runtime semantics changed.
6. Human verification remains mandatory for visual, experiential, or external-environment requirements that automation cannot prove well.

## Required Testing Layers

### Layer 1: TDD gate proof

Applies when:
- plan `type` is `tdd`

Required contract:
- RED proves the exact declared target command fails
- GREEN proves the exact declared target command passes
- REFACTOR proves the exact declared target command still passes

Required outputs:
- stage-specific proof payloads
- expected `test(...)`, `feat(...)`, and optional `refactor(...)` commit trail
- no implementation-before-RED and no skipped gates

Notes:
- GREEN and REFACTOR stay targeted-only by default
- TDD does not automatically imply a broad suite run

### Layer 2: Focused verification

Applies when:
- a task changes code, runtime behavior, parser behavior, command behavior, or generated output that can be proven narrowly

Preferred proofs:
- `node --test <file>...`
- `npm run test:file -- <file>`
- direct CLI smoke command
- fixture-backed targeted test
- structural file or content verification when execution would add no real signal

Rule:
- prefer proof attached directly to the touched behavior or touched files

### Layer 3: Broad regression gate

Applies when:
- the change is broad, cross-cutting, infrastructure-level, or has unclear blast radius

Typical proofs:
- `npm test`
- one broad project regression command
- broad rebuild plus final smoke verification for generated runtime artifacts

Rule:
- run at most once at the end of plan execution or overall verification unless a plan explicitly explains why another run adds new signal

### Layer 4: Human verification

Applies when:
- design quality, UX feel, real-time behavior, or external integration needs a human check

Rule:
- automation may support the check, but must not claim full proof if the acceptance criterion is inherently human or environment dependent

## Verification Route Selection

Every implementation plan should explicitly choose one verification route:
- `skip`
- `light`
- `full`

### `skip`

Choose `skip` when:
- the plan is docs-only, workflow-only, template-only, or guidance-only
- structural verification is sufficient
- there is no credible extra signal from a broader runtime test

Expected behavior:
- no extra broad-suite reruns beyond explicit structural or plan checks

### `light`

Choose `light` by default when:
- the change has a narrow, well-understood touched surface
- targeted tests or smoke commands can prove the slice directly
- the blast radius is limited

Expected behavior:
- use focused verification only
- broad suites are not required unless execution discovers unexpected broader coupling

### `full`

Choose `full` when:
- shared runtime behavior, shared parser behavior, router behavior, or global execution semantics changed
- generated runtime artifacts need trustworthy rebuilt proof
- compatibility cleanup or large refactor may affect multiple command families
- the planner cannot confidently bound the blast radius

Expected behavior:
- one broad regression gate at end of plan or overall verification
- avoid rerunning the same broad command after each edit

## Change-Type Matrix

### Docs, templates, prompts, workflow wording

Default route:
- `skip`

Typical proof:
- file existence/content checks
- command-surface integrity checks
- link/reference consistency checks

Broad suite:
- not required unless runtime behavior also changed

### Narrow business logic or parser behavior

Default route:
- `light`

Typical proof:
- TDD exact target command if applicable
- targeted unit or fixture tests
- narrow smoke verification

Broad suite:
- optional, only if the logic is shared widely or coupling is unclear

### Command behavior in one narrow surface

Default route:
- `light`

Typical proof:
- direct CLI smoke run
- targeted command tests
- touched-file regressions

Broad suite:
- not required unless shared dispatch, alias resolution, or global output shaping changed

### Router, shared helpers, normalization, registry, alias model, global semantics

Default route:
- `full`

Typical proof:
- focused touched-slice proof first
- one broad regression gate second

### Generated artifact changes (`plugin.js`, `bin/bgsd-tools.cjs`)

Default route:
- `light` if the source change is narrow and touched-slice proof is strong
- `full` if the source change affects shared runtime behavior or many command families

Typical proof:
- rebuild artifact
- prove the artifact and source agree for the touched behavior
- add broad regression if blast radius is broad

## Planner Policy

Future planners should follow these rules:

1. Every implementation plan should state a verification route.
2. `light` is the default unless the planner can name a concrete reason for `skip` or `full`.
3. If `full` is selected, the plan should state the blast-radius reason in one sentence.
4. Task `<verify>` commands should prove only the delta introduced by that task.
5. Plan `<verification>` should prove aggregate or cross-task behavior that task checks did not already cover.
6. A broad suite should not appear repeatedly in multiple task `<verify>` blocks and again in `<verification>` unless the plan explains the added signal.

## Executor Policy

Future execution guidance should follow these rules:

1. Do not run broad suites after each logical file change.
2. Preserve TDD gate checks exactly as the mandatory behavior-proof layer for `type: tdd` plans.
3. When targeted proof already passed, do not retry the same hanging broad gate repeatedly.
4. If a broad suite is red for unrelated reasons, record that baseline separately from the touched-slice result.
5. If execution discovers broader-than-expected coupling, it may promote `light` to `full`, but must document why.

## Verifier Policy

Future verifier guidance should follow these rules:

1. Prefer focused proof attached to touched behavior before reaching for broad suite output.
2. Treat broad-suite results as regression evidence, not as the only acceptable form of correctness proof.
3. Distinguish between:
   - missing behavior proof
   - missing regression proof
   - missing human verification
4. Report when a plan paid for broad regression without adding meaningful new signal so the policy can improve over time.

## Documentation Alignment Requirements

Future implementation should align repo docs to this policy.

At minimum:
- TDD docs should stop implying that every edit requires a broad suite rerun
- TDD docs should distinguish targeted behavior proof from optional broad regression proof
- workflow docs, plan templates, and verifier guidance should use compatible route-selection language

## Exceptions

The policy allows stricter testing than the default when any of the following is true:
- the touched area has a history of hidden coupling
- the changed behavior is difficult to isolate credibly with targeted tests
- the change affects plan parsing, roadmap parsing, state mutation, or other highly shared workflow contracts
- the operator explicitly wants a higher-confidence broad regression gate

The policy does not allow weaker testing when:
- a TDD plan has not completed its RED / GREEN / REFACTOR proof
- the task has no credible focused proof for changed runtime behavior
- the acceptance criteria inherently require human verification

## Recommended Implementation Steps

1. add a planner-facing rubric for `skip` / `light` / `full`
2. align `docs/tdd.md` with the targeted-gate contract
3. update templates and workflows so broad suites require rationale
4. add lightweight audit checks for repeated expensive verification with no new signal

## Acceptance Criteria For Future Milestone

- planners can explain route selection without guesswork
- narrow plans default to `light` instead of broad-suite repetition
- docs/workflow-only plans no longer default to unnecessary full-suite runs
- broad regression remains present for truly cross-cutting work
- repo docs no longer conflict on whether TDD implies broad testing after each edit
