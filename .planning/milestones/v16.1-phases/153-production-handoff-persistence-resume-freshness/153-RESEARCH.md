# Phase 153: Production Handoff Persistence & Resume Freshness - Research

**Date:** 2026-03-28
**Status:** Ready for planning
**Phase:** 153-production-handoff-persistence-resume-freshness
**Requirements:** FLOW-07
**Desired outcome:** DO-116

## What matters for planning

Phase 153 is a gap-closure phase, not a new architecture phase. Phase 152 already delivered the handoff schema, validation rules, resume-summary contract, and workflow wording. The remaining work is production wiring:

- `src/lib/phase-handoff.js` already supports durable per-step artifacts, latest-valid selection, stale fingerprint blocking, and repair guidance.
- `src/commands/state.js:1343` exposes the only real writer today: `verify:state handoff write|show|validate|clear`.
- `src/commands/init.js:206` builds `resume_summary`, but currently calls `buildPhaseHandoffValidation(entries, { phase })` with no expected fingerprint, so real init entrypoints do not enforce stale-source blocking.
- The workflow files consume `resume_summary` as if durable handoffs already exist, but repo search shows `verify:state handoff write` is only exercised in tests, not wired into the normal discuss -> research -> plan -> execute -> verify path.

Planning implication: keep the existing artifact contract and close the two missing wires:

1. production steps must write/refresh handoff artifacts themselves
2. init resume entrypoints must validate against a current expected fingerprint

## Current implementation state

### Already implemented and reusable

- `src/lib/phase-handoff.js`
  - Validates schema and required fields.
  - Selects the latest valid run and latest valid step.
  - Fails closed on stale fingerprint mismatch when `expected_fingerprint` is supplied.
- `src/commands/state.js:1350`
  - Writes artifacts with `phase`, `step`, `run_id`, `source_fingerprint`, `summary`, and `resume_target`.
  - Exposes validate/show/clear for inspection and recovery.
- `src/commands/init.js:206`
  - Produces `resume_summary` with `resume` / `inspect` / `restart` options.
  - Surfaces latest-valid fallback and repair guidance.
- Workflow contracts are already aligned for fail-closed continuation:
  - `workflows/discuss-phase.md:57`
  - `workflows/research-phase.md:60`
  - `workflows/plan-phase.md:40`
  - `workflows/execute-phase.md:49`
  - `workflows/verify-work.md:27`
  - `workflows/transition.md:158`

### Production wiring gap

- No non-test production path writes handoff artifacts automatically.
  - Evidence: repo search for `verify:state handoff write` only finds `tests/state.test.cjs`, `tests/init.test.cjs`, and `tests/integration.test.cjs`.
- Real resume entrypoints do not pass an expected fingerprint.
  - `src/commands/init.js:213` validates artifacts without `expected_fingerprint`.
  - `src/lib/phase-handoff.js:170` only marks `stale_sources` when that fingerprint is provided.
- Milestone audit already names these as the unsatisfied gap:
  - `.planning/v16.1-MILESTONE-AUDIT.md:52`
  - `.planning/v16.1-MILESTONE-AUDIT.md:71`
  - `.planning/v16.1-MILESTONE-AUDIT.md:137`
  - `.planning/v16.1-MILESTONE-AUDIT.md:139`

## Most relevant files for the fix

### Core code

- `src/lib/phase-handoff.js` - artifact schema, selection, stale validation, repair guidance
- `src/commands/state.js` - current handoff write/validate command surface; likely reusable for production writes
- `src/commands/init.js` - real resume entrypoints; current freshness gap lives here
- `src/lib/helpers.js` - likely best place to derive a stable phase/source fingerprint from current canonical artifacts
- `src/commands/misc.js` - only relevant as downstream Phase 154 dependency because summary generation reads `TDD-AUDIT.json`

### Workflow surfaces that must stay in sync

- `workflows/discuss-phase.md`
- `workflows/research-phase.md`
- `workflows/plan-phase.md`
- `workflows/execute-phase.md`
- `workflows/verify-work.md`
- `workflows/transition.md`

These already describe the intended behavior. Phase 153 should only update them if production behavior or fingerprint/rebuild wording changes.

### Tests to extend first

- `tests/state.test.cjs` - artifact write/replace/stale validation unit coverage
- `tests/init.test.cjs` - resume-summary behavior at real entrypoints; best place to prove expected-fingerprint enforcement
- `tests/integration.test.cjs` - current cross-step handoff tests; best place to add production-style self-writing chain coverage
- `tests/workflow.test.cjs` - wording/contract safety net if workflow docs change
- `tests/discuss-phase-workflow.test.cjs` - only if discuss restart wording changes

## Recommended plan split

### Plan 01: Production handoff write path

Goal: make the normal phase-delivery chain produce durable artifacts without test-only/manual setup.

Natural tasks:

- Add one shared runtime helper for handoff payload creation so production callers do not hand-build `run_id`, `source_fingerprint`, `resume_target`, and summary fields inconsistently.
- Wire the actual chain entry/exit points to write or refresh handoff artifacts for `discuss`, `research`, `plan`, and `execute` at durable checkpoints.
- Keep same-phase replacement behavior and standalone fallback unchanged.
- Add focused integration coverage proving artifacts are created by production wiring, not by direct test seeding.

Primary files:

- `src/commands/state.js`
- `src/lib/phase-handoff.js`
- likely `src/commands/init.js` and/or a new helper in `src/lib/`
- `tests/integration.test.cjs`
- possibly workflow docs if the durable checkpoint wording changes

### Plan 02: Resume freshness enforcement

Goal: enforce stale-source blocking at real resume entrypoints.

Natural tasks:

- Define the expected source fingerprint from current canonical phase inputs.
- Pass that fingerprint through `buildPhaseHandoffResumeSummary()` / init entrypoints before exposing resumable state.
- Fail closed when artifacts are stale, while preserving inspect/latest-valid/repair behavior.
- Add init-level and integration tests for stale artifacts, partial corruption, and rebuilt-valid continuation.

Primary files:

- `src/commands/init.js`
- `src/lib/helpers.js` or new shared fingerprint helper
- `src/lib/phase-handoff.js`
- `tests/init.test.cjs`
- `tests/integration.test.cjs`

### Plan 03: End-to-end regression lock and workflow cleanup

Goal: prove the production chain is now self-producing and freshness-aware, without taking on Phase 154 proof persistence yet.

Natural tasks:

- Add one realistic regression that drives discuss/research/plan/execute resume transitions through production wiring.
- Verify corrupt newest + older valid fallback, stale-source block, and standalone no-handoff behavior still hold together.
- Tighten workflow wording only where runtime behavior changed or became more specific.

Primary files:

- `tests/integration.test.cjs`
- `tests/init.test.cjs`
- `workflows/*.md` only if wording drift remains

## Dependencies and execution order

- Plan 01 first: there is no real FLOW-07 closure until production paths actually write artifacts.
- Plan 02 second: freshness enforcement depends on real artifacts and a stable fingerprint source.
- Plan 03 last: integrated regression should prove the final composed behavior after both runtime gaps are closed.

If scope needs compression, Plans 02 and 03 can be merged, but Plan 01 should stay separate.

## Risks and regressions to protect

### 1. Breaking standalone commands

Risk:

- `/bgsd-plan-phase`, `/bgsd-execute-phase`, or `/bgsd-verify-work` start requiring handoff state for ordinary one-off use.

Protect with:

- existing standalone-fallback expectations in `tests/integration.test.cjs:823`
- explicit additive behavior in workflow docs

### 2. False stale-source blocks

Risk:

- fingerprint is derived from volatile or irrelevant fields, causing resume to fail even when canonical inputs are unchanged.

Protect with:

- derive freshness from stable planning artifacts only
- add tests for unchanged-source resume success and meaningful-source-change failure

### 3. Inconsistent writers across steps

Risk:

- each workflow step invents a different `run_id`, summary shape, or resume target, making replacement and selection unreliable.

Protect with:

- one shared write helper
- behavior tests that assert same-run progression across multiple steps

### 4. Replacing old artifacts too early

Risk:

- a new run clears prior artifacts before the new durable checkpoint is valid.

Protect with:

- keep the current write-then-select-then-replace semantics in `src/lib/phase-handoff.js:223`
- add tests for failed/invalid write attempts not deleting the previous valid run

### 5. Scope creep into Phase 154

Risk:

- Phase 153 starts trying to persist `TDD-AUDIT.json` and solve end-to-end proof carry-through.

Protect with:

- keep this phase focused on FLOW-07 production wiring and freshness
- leave `src/commands/misc.js:2323` proof persistence work for Phase 154

## Verification ideas

- Add a production-style integration that no longer seeds handoffs with direct `verify:state handoff write` calls for the happy path.
- Add init-entrypoint tests that show stale artifacts are marked invalid only when the current expected fingerprint differs.
- Keep corrupt-newest/latest-valid fallback tests green while freshness is added.
- Re-run targeted suites first:
  - `node --test tests/state.test.cjs`
  - `node --test tests/init.test.cjs`
  - `node --test tests/integration.test.cjs`
- Finish with `npm test` and `npm run build` because this repo ships a bundled single-file CLI.

## Assertions context

- No phase-specific assertions artifact was found for Phase 153.
- Existing evidence is test-contract based, mainly in `tests/state.test.cjs`, `tests/init.test.cjs`, and `tests/integration.test.cjs`.

## Planning recommendation

Plan this phase as a narrow wiring closure:

- do not redesign the handoff schema
- do not invent a second resume model
- do not pull TDD proof persistence into scope
- focus on self-writing production handoffs, real fingerprint enforcement, and one strong end-to-end regression
