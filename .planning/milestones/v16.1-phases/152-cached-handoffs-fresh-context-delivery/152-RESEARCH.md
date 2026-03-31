# Phase 152: Cached Handoffs & Fresh-Context Delivery - Research

**Date:** 2026-03-28
**Status:** Ready for planning
**Phase:** 152-cached-handoffs-fresh-context-delivery
**Requirements:** FLOW-06, FLOW-07, FLOW-08

## User Constraints

- Treat chained fresh-context delivery as additive acceleration on top of today's standalone commands, not as a replacement flow.
- Only `discuss` may restart cleanly without prior chain state; `research`, `plan`, `execute`, and `verify` must fail closed with explicit repair or restart guidance when chain state is missing or invalid.
- Store per-step artifacts for `discuss`, `research`, `plan`, `execute`, and `verify`; a new run for the same phase replaces the prior same-phase artifact set.
- Do not add a separate pointer/current artifact. Resume target must be derived from the latest valid per-step artifact.
- Fresh-context return must show a summary first and offer `resume`, `inspect`, or `restart`; do not silently continue.
- Same-run cached plan data is acceptable until source files change; on change, warn, rebuild from source, then continue only if reconstructed state validates.
- Fold the chain behavior into existing yolo/auto-advance behavior as the power-user fast path instead of adding a separate persistence mode.
- Keep markdown artifacts canonical and human-readable; JSON handoff state is an additive machine-oriented layer.

## What matters for planning

Phase 152 is not a new workflow family. The existing `discuss -> research -> plan -> execute -> verify` loop already exists across `workflows/discuss-phase.md`, `workflows/research-phase.md`, `workflows/plan-phase.md`, `workflows/execute-phase.md`, and `workflows/verify-work.md`. The planning job is to add a deterministic cross-window resume layer around that loop.

The most important interpretation is: the chain should reuse existing per-step contracts, phase snapshot data, and yolo auto-advance behavior rather than inventing a parallel orchestration model. The planner should bias toward a thin state machine plus handoff artifacts, not a large workflow rewrite.

## Internal evidence to reuse

### 1. Phase snapshot already centralizes most phase discovery

- `src/lib/helpers.js:752` builds `buildPhaseSnapshotInternal()` with roadmap metadata, artifact paths, plan inventory, waves, incomplete plans, and execution context.
- `src/commands/init.js:154` wraps that snapshot for `init:execute-phase`, `init:verify-work`, and `init:phase-op`.
- `src/commands/phase.js:21` exposes `phase:snapshot` as the compact shared contract from Phase 151.

Planning implication: handoff artifacts should prefer snapshot-derived metadata and paths instead of duplicating phase discovery logic.

### 2. Plan parsing already has a cache-backed path, but CLI plan indexing still reparses markdown

- Plugin parsers already use `PlanningCache` for single-plan and per-phase plan reads in `src/plugin/parsers/plan.js:219` and `src/plugin/parsers/plan.js:292`.
- `PlanningCache.getPlan()` and `getPlansForPhase()` already exist in `src/lib/planning-cache.js:417` and `src/lib/planning-cache.js:441`.
- `src/commands/misc.js:991` still implements `util:phase-plan-index` by scanning the phase directory, reading every plan, parsing frontmatter, and counting tasks directly from markdown.
- `workflows/execute-phase.md:87` still shells to `util:phase-plan-index` during normal phase execution.

Planning implication: FLOW-06 has a crisp target. Replace the current markdown-heavy `util:phase-plan-index` path with a `PlanningCache`-backed read that falls back safely when the cache is cold, stale, or running in Map mode.

### 3. There is already one proven resumable JSON-state pattern

- Release flow persists deterministic step-by-step state in `.planning/release-state.json` via `src/lib/release/state.js:6`.
- `src/lib/release/mutate.js:65` and `src/lib/release/pr.js:104` show a practical pattern: persist progress after each safe step, compute `last_safe_completed_step`, block on missing prerequisites, and emit explicit `next_safe_command` guidance.
- `workflows/release.md` already documents reading the state file and resuming from the next safe step instead of blindly restarting.

Planning implication: the handoff artifact format should copy the release-state design principles: deterministic JSON, explicit current status, safe resume target, and clear restart/repair guidance.

### 4. Session continuity exists, but is too coarse for chain resume by itself

- `src/commands/state.js:1145` records `Stopped at` and `Resume file` into `STATE.md` and SQLite continuity tables.
- `src/plugin/context-builder.js:591` only injects a small `<session>` hint from `STATE.md`.
- `workflows/transition.md:143` still thinks in terms of a single session continuity line, not durable multi-step handoffs.

Planning implication: Phase 152 should not overload `STATE.md` continuity to become the chain source of truth. Use it as a user-facing hint, while the per-step handoff JSON artifacts hold the machine state.

### 5. Existing workflows already contain the chain edges

- `workflows/discuss-phase.md:349` can auto-advance to `/bgsd-plan-phase {PHASE} --auto`.
- `workflows/plan-phase.md:159` can auto-advance to `/bgsd-execute-phase {PHASE} --auto`.
- `workflows/execute-phase.md:285` can auto-advance into `transition.md`.
- `workflows/verify-work.md` already has resume/restart semantics for UAT sessions.

Planning implication: FLOW-08 should wire these existing edges into a fresh-context chain, not replace them with a brand new mega-command unless that command is only a thin entrypoint.

## Practical implementation clusters

### Cluster A: Cached plan index adoption

Primary files:

- `src/commands/misc.js`
- `src/lib/planning-cache.js`
- `src/lib/helpers.js`
- `src/router.js`
- `tests/plan.test.cjs`
- `tests/init.test.cjs`
- `tests/integration.test.cjs`

Likely work:

- Refactor `util:phase-plan-index` to try `PlanningCache.getPlansForPhase()` and `getPlan()` first.
- Preserve current JSON contract (`plans`, `waves`, `incomplete`, `has_checkpoints`) so existing workflows do not need a contract rewrite.
- Decide where task counts come from: either extend cached plan-index data enough to avoid markdown reads, or explicitly drop task counts from this command if they are not consumed.
- Keep markdown fallback for cold cache, stale cache, and Map backend.

Why it should land early:

- It is the least coupled requirement and directly unblocks the chain from reparsing plans on every invocation.
- It reuses Phase 151 cache/snapshot work without committing to handoff schema yet.

### Cluster B: Durable phase handoff artifact layer

Primary files:

- likely new `src/lib/phase-handoff.js` or similar
- `src/commands/init.js`
- `src/commands/state.js`
- `src/lib/helpers.js`
- `src/lib/constants.js`
- `src/router.js`
- `tests/state.test.cjs`
- `tests/init.test.cjs`
- `tests/integration.test.cjs`

Likely work:

- Define one per-step artifact schema for `discuss`, `research`, `plan`, `execute`, and `verify`.
- Add a write/update command surface that stores the artifact after each step reaches a durable checkpoint.
- Add a resume-inspection command/helper that scans the current phase artifact set, validates artifacts newest-first, and picks the latest valid step as the resume target.
- On new run start for the same phase, replace prior same-phase artifacts as one set instead of accumulating stale files.
- Update session continuity to point at the visible resume summary entrypoint, not to become the canonical handoff state.

Recommended artifact fields:

- `version`, `phase_number`, `phase_slug`, `run_id`, `step`, `status`, `updated_at`
- `source_snapshot` with enough phase metadata to detect drift
- `artifacts` listing relevant markdown/json files produced so far
- `resume` block with `next_command`, `latest_valid_step`, and restart/repair hints
- `validation` block with freshness fingerprints for files the next step depends on

Avoid:

- full prompt transcripts
- duplicate pointer artifact
- schema that embeds large copies of markdown content

### Cluster C: Resume summary and fail-closed gating

Primary files:

- `src/commands/init.js`
- relevant command wrappers in `commands/`
- possibly `workflows/discuss-phase.md`, `workflows/research-phase.md`, `workflows/plan-phase.md`, `workflows/execute-phase.md`, `workflows/verify-work.md`
- `src/lib/questions.js`
- workflow contract tests

Likely work:

- Add a resume summary surface that shows current phase, latest valid step, produced artifacts, and next safe action.
- Support exactly three user choices on re-entry: `resume`, `inspect`, `restart`.
- Make `research`, `plan`, `execute`, and `verify` explicitly stop when chain state is missing/invalid instead of inferring continuation from partial disk state.
- Keep `discuss` as the only step allowed to restart cleanly with no prior chain state.

Most important design rule:

- Resume target selection must be artifact-derived and validation-backed, not guessed from `STATE.md`, plan counts, or whichever markdown file happens to exist.

### Cluster D: Yolo/auto-advance chain integration

Primary files:

- `workflows/discuss-phase.md`
- `workflows/plan-phase.md`
- `workflows/execute-phase.md`
- `workflows/transition.md`
- possibly command wrappers in `commands/`
- workflow tests

Likely work:

- Treat yolo/`--auto` as the trigger for generating and consuming handoff artifacts across fresh context windows.
- Keep interactive mode behavior mostly unchanged except for the new resume summary when artifacts exist.
- Ensure standalone `/bgsd-plan-phase`, `/bgsd-execute-phase`, and `/bgsd-verify-work` still work normally when no chain artifact exists.

Planning implication:

- This should be the last cluster, after cache-backed plan reads and handoff state validation exist.

## Reuse targets

- `buildPhaseSnapshotInternal()` in `src/lib/helpers.js:752` for compact phase metadata and artifact paths.
- `PlanningCache` interfaces in `src/lib/planning-cache.js:417` and `src/lib/planning-cache.js:441` for cached plan reads.
- Release state helpers in `src/lib/release/state.js:12` and `src/lib/release/state.js:27` as the best local precedent for deterministic resumable JSON.
- `verify:state complete-plan` behavior in `src/commands/state.js:1197` as an example of durable core plus warning-only tail work.
- `verify-work` grouped resume/restart semantics in `workflows/verify-work.md:27` and `workflows/verify-work.md:107` as a user-facing resume UX reference.

## Pitfalls to plan around

### 1. Two competing sources of truth

Risk:

- chain state ends up split across handoff JSON, `STATE.md` continuity, and whatever markdown artifacts exist on disk

Mitigation:

- make per-step handoff JSON the machine source of truth
- keep `STATE.md` as human-oriented summary only
- derive resume target from latest valid handoff artifact, never from a separate pointer

### 2. Cached plan data hides external edits

Risk:

- same-run cache trust becomes wrong after users edit plan files, summaries, or roadmap artifacts outside the chain

Mitigation:

- persist source fingerprints/mtimes in the handoff artifact
- compare on resume or step transition
- if changed: warn, rebuild from source, then validate reconstructed state before allowing continuation

### 3. Overreaching chain semantics break standalone commands

Risk:

- `/bgsd-plan-phase` or `/bgsd-execute-phase` start requiring chain state even for ordinary one-off use

Mitigation:

- keep chain behavior additive and opt-in through yolo/explicit resume paths
- gate fail-closed logic only when a command is trying to continue an active chain run

### 4. Artifact replacement becomes lossy or racy

Risk:

- replacing prior same-phase artifacts can delete the only recoverable state too early

Mitigation:

- write the new artifact set first, validate it, then remove the old same-phase set
- define run identity clearly so cleanup is deterministic

### 5. Scope creep into full transcript/session management

Risk:

- implementation drifts toward storing prompt history, arbitrary chat state, or generalized session restoration

Mitigation:

- keep artifacts compact and step-oriented
- persist only the minimum state needed to deterministically choose the next workflow command and verify freshness

## Verification ideas

### High-value tests

- `tests/plan.test.cjs`: cached `util:phase-plan-index` hot-path, cold-path fallback, stale-cache rebuild, Map-backend fallback.
- `tests/init.test.cjs`: resume summary output, latest-valid-artifact selection, interactive options shape (`resume` / `inspect` / `restart`).
- `tests/state.test.cjs`: handoff artifact write/update validation and same-phase replacement behavior.
- `tests/integration.test.cjs`: full `discuss -> plan -> execute` or `plan -> execute -> verify` chain through fresh invocations with source edits between steps.
- workflow contract tests: yolo/auto-advance uses handoff artifacts; standalone commands still work without them.

### Specific scenarios worth testing

- latest artifact is corrupt but previous artifact is valid -> resume should pick the latest valid artifact, not the newest file blindly
- handoff exists for `research`, but required source file changed -> warn, rebuild, validate, then either continue or fail closed
- handoff missing for `plan`/`execute`/`verify` -> command stops with repair/restart guidance
- no chain state for `discuss` -> clean start still works
- same phase started twice -> old artifact set is replaced, no pointer file required
- cached plan index after a plan file edit -> stale cache does not survive incorrectly into execution grouping

## Recommended plan split

A 3-plan split is the strongest default.

### Recommended 3-plan split

1. **Cached plan index adoption**
   - Move `util:phase-plan-index` to `PlanningCache`-backed reads with safe fallback.
   - Reuse the new path in current execution/init surfaces where practical.
   - Covers FLOW-06 and establishes freshness expectations for later handoffs.

2. **Durable handoff artifacts + resume selection**
   - Add per-step handoff schema, write/update helpers, validation, latest-valid-artifact selection, and repair/restart guidance.
   - Add resume summary surface with `resume` / `inspect` / `restart`.
   - Covers FLOW-07 and the hardest fail-closed semantics.

3. **Fresh-context chain wiring through yolo/auto-advance**
   - Wire discuss/research/plan/execute/verify transitions to produce and consume handoff artifacts.
   - Fold chain behavior into existing auto/yolo path while preserving standalone command behavior.
   - Covers FLOW-08.

### Safer 4-plan split

1. Cache-backed plan index.
2. Handoff artifact schema + command helpers.
3. Resume UX + fail-closed gating.
4. Yolo/auto-advance workflow wiring.

Use the 4-plan version if resume UX touches more workflow text and init surfaces than expected.

## Bottom line

Plan Phase 152 as a thin deterministic chain layer built on Phase 151's snapshot/read consolidation, not as a new orchestration system. The clearest sequence is:

1. stop reparsing plans for phase indexing
2. add compact per-step resumable handoff artifacts with validation
3. wire those artifacts into existing yolo/auto-advance workflow edges

The biggest risks are stale-source continuation, duplicate sources of truth, and accidentally making standalone commands depend on chain state. The safest plan keeps handoff JSON compact, derives resume from the latest valid artifact, and fails closed everywhere except `discuss`.
