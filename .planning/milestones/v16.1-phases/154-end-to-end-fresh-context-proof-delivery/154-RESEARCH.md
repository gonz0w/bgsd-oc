# Phase 154: End-to-End Fresh-Context Proof Delivery - Research

**Date:** 2026-03-29
**Status:** Ready for planning
**Phase:** 154-end-to-end-fresh-context-proof-delivery
**Requirements:** TDD-06, FLOW-08
**Desired outcomes:** DO-115, DO-116

## What matters for planning

Phase 154 is another gap-closure phase. Phase 150 already proved isolated TDD proof capture and rendering; Phase 153 already proved production handoff persistence and stale-source enforcement. The remaining milestone gap is the seam between them: production fresh-context chaining still does not self-produce, preserve, and re-render TDD proof artifacts end to end.

Planning implication: keep Phase 150 semantics and Phase 153 handoff contracts intact. Add only the missing production proof-delivery plumbing plus one composed regression that proves the full discuss -> research -> plan -> execute -> verify path with TDD proof preserved.

## Current implementation state

### Already implemented and reusable

- `src/commands/misc.js:2323` reads `{phase}-{plan}-TDD-AUDIT.json` and `src/commands/misc.js:2566` renders the TDD audit section when the sidecar exists.
- `tests/integration.test.cjs:510` and `tests/summary-generate.test.cjs:510` already prove the summary/audit contract for a real `type: tdd` fixture, including `GSD-Phase` trailers and machine-readable proof.
- `src/lib/phase-handoff.js:229` and `src/commands/state.js:1350` already support durable handoff payloads with `context` data via `verify:state handoff write --data`.
- `src/commands/init.js:206` already exposes `resume_summary` with latest-valid fallback, stale detection, and inspect/restart guidance.
- `workflows/discuss-phase.md:310`, `workflows/research-phase.md:179`, `workflows/plan-phase.md:169`, `workflows/execute-phase.md:240`, and `workflows/verify-work.md:126` already wire the production handoff chain itself.

### Actual gap

- No production code writes `TDD-AUDIT.json`; repo search only finds test fixtures and summary readers.
- `workflows/tdd.md:65`, `workflows/tdd.md:105`, and `workflows/tdd.md:136` tell executors to preserve structured proof, but they do not say how to persist it durably.
- `workflows/execute-phase.md:240` and `workflows/verify-work.md:126` write durable handoffs, but currently carry no proof payload.
- `src/lib/phase-handoff.js:273` stores only the explicit `context` passed for the current write; it does not inherit prior-step context, so proof metadata would be dropped on later handoff writes unless every downstream step re-passes it or the library merges it.
- `tests/integration.test.cjs:1001` proves the Phase 153 chain behavior, but it seeds the chain with direct `verify:state handoff write` calls and never proves real TDD proof persistence or rendering through that chain.

## Minimal closure shape

The narrowest vertical slice that satisfies both open requirements is:

1. a real `type: tdd` production path writes a deterministic proof artifact without test-only manual setup;
2. the execute -> verify fresh-context boundary preserves enough proof state for downstream inspection or reuse;
3. summary generation can still render the proof after resume; and
4. one integrated regression proves the composed flow.

That means Phase 154 should avoid reopening:

- `execute:tdd` validator semantics from Phase 150;
- selection/severity rules from Phase 149;
- handoff freshness rules from Phase 153;
- broad workflow redesigns or a second continuation model.

## Most relevant files for the fix

### Core runtime

- `src/commands/misc.js` - current proof reader/renderer; likely needs the smallest additive production-proof helper or fallback lookup.
- `src/lib/phase-handoff.js` - likely needs context carry-forward if proof metadata is preserved through handoff payloads instead of only by disk sidecar.
- `src/commands/state.js` - existing handoff write surface already accepts `--data`; likely best reuse point for execute/verify proof metadata.
- `src/commands/init.js` - only if resume inspection should surface preserved proof metadata or artifact paths explicitly.

### Workflow surfaces

- `workflows/tdd.md` - canonical production place where RED/GREEN/REFACTOR proof exists; currently prose-only preservation.
- `workflows/execute-plan.md` - summary generation happens here; likely place to ensure proof artifact exists before `util:summary-generate` runs.
- `workflows/execute-phase.md` - execute handoff write point; likely place to carry proof path/metadata into the resumable chain.
- `workflows/verify-work.md` - verify handoff write point; likely place to preserve proof through the final downstream step.

### Tests

- `tests/integration.test.cjs` - primary milestone regression location; already contains both the isolated TDD proof fixture and the Phase 153 production-chain fixture.
- `tests/summary-generate.test.cjs` - summary rendering safety net if proof lookup behavior becomes additive.
- `tests/init.test.cjs` - only needed if `resume_summary.inspection` grows to surface proof metadata/path.
- `tests/workflow.test.cjs` - only if workflow wording changes.

## Recommended plan split

### Plan 01: Production proof persistence plumbing

Goal: make the real TDD execution path self-produce and preserve durable proof artifacts.

Natural tasks:

- Add one additive production write path for `TDD-AUDIT.json` from the real TDD workflow/output instead of relying on fixture-only `fs.writeFileSync(...)` setup.
- Decide one canonical preservation contract for fresh-context chaining:
  - either carry proof metadata/path in handoff `context`,
  - or guarantee the durable sidecar is materialized before execute/verify handoff transitions and remains the canonical downstream source.
- If handoff context is used, make context inheritance deterministic so later step writes do not silently drop proof metadata.

Primary files:

- `workflows/tdd.md`
- `workflows/execute-plan.md`
- `workflows/execute-phase.md`
- `workflows/verify-work.md`
- `src/commands/misc.js`
- `src/lib/phase-handoff.js`
- `src/commands/state.js`

### Plan 02: Downstream rendering and composed proof regression

Goal: prove the production fresh-context chain preserves and re-renders proof end to end.

Natural tasks:

- Extend the existing production-chain integration to use a real `type: tdd` fixture instead of manual handoff-only seeding.
- Assert the chain still preserves latest-valid fallback and stale-source behavior while also keeping TDD proof available to summary/verification steps.
- Lock any additive summary or resume-inspection behavior with focused tests.
- Reconcile wording only if runtime behavior becomes more specific.

Primary files:

- `tests/integration.test.cjs`
- `tests/summary-generate.test.cjs`
- `tests/init.test.cjs` (if resume inspection changes)
- `tests/workflow.test.cjs` (if wording changes)

If plan sizing feels tight, keep this as 2 plans. Do not split out a third plan unless the proof-carry contract ends up needing a distinct `init`/inspection surface.

## Dependency order

1. Land proof production first; otherwise any end-to-end regression still depends on manual fixture seeding.
2. Then add the composed regression against the real production chain.
3. Only update init/workflow contract tests for behavior that actually changed.

## Key risks to protect

### 1. Reopening old scope

Risk:

- touching `execute:tdd` semantics, commit-trailer logic, or stale-fingerprint rules that already passed in earlier phases.

Protect with:

- keep changes additive around proof persistence and lookup only;
- leave `src/lib/git.js` and the Phase 150 validator contract untouched unless a regression proves otherwise.

### 2. Proof metadata drops at later handoff writes

Risk:

- execute captures proof, but verify overwrites the active handoff without carrying it forward.

Protect with:

- one explicit carry-forward rule in `src/lib/phase-handoff.js` or one canonical sidecar-on-disk rule that downstream steps reuse.

### 3. Summary rendering still depends on manual fixture setup

Risk:

- tests keep passing only because they write `TDD-AUDIT.json` directly.

Protect with:

- at least one integration that reaches `util:summary-generate` after a production-created proof artifact exists.

### 4. Breaking standalone fresh-context behavior

Risk:

- `/bgsd-plan-phase`, `/bgsd-execute-phase`, or `/bgsd-verify-work` start requiring proof state for non-TDD or standalone use.

Protect with:

- preserve Phase 152/153 standalone fallback tests;
- keep proof persistence additive and conditional on real `type: tdd` flows.

## Verification ideas

- Start from the existing isolated TDD proof fixture in `tests/integration.test.cjs:510` and the production-chain fixture in `tests/integration.test.cjs:1001`; combine them instead of inventing a new harness.
- Assert three things in one composed test: fresh-context resume stays valid, `TDD-AUDIT.json` survives the chain, and generated summary output still contains the TDD audit trail.
- Re-run targeted suites first:
  - `node --test tests/integration.test.cjs`
  - `node --test tests/summary-generate.test.cjs`
  - `node --test tests/init.test.cjs`
- Finish with `npm run build`; broad `npm test` is still known to include unrelated pre-existing failures.

## Planning recommendation

Plan Phase 154 as a narrow milestone-closure phase:

- use the existing TDD proof file contract instead of inventing a new audit format;
- use the existing handoff chain instead of inventing a new continuation model;
- make production TDD execution self-write the proof artifact;
- preserve that proof through execute/verify fresh-context transitions;
- prove the full chain in one realistic regression.
