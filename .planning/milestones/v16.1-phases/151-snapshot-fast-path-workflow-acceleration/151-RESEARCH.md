# Phase 151: Snapshot & Fast-Path Workflow Acceleration - Research

**Date:** 2026-03-28
**Status:** Ready for planning
**Phase:** 151-snapshot-fast-path-workflow-acceleration
**Requirements:** FLOW-01, FLOW-02, FLOW-03, FLOW-04, FLOW-05

## What matters for planning

Phase 151 is a workflow-acceleration phase, not a product-expansion phase. The roadmap wording should be interpreted through `151-CONTEXT.md`:

- `FLOW-04` should be planned as default `discuss-phase` acceleration first, not as a new long-lived split UX. A `--fast` flag can exist only as compatibility surface.
- `FLOW-02` should be planned as an atomic core plus optional tail write model, not a giant all-or-nothing transaction across every planning artifact.
- `FLOW-03` can trust same-session cache reuse until bGSD itself writes planning state; every bGSD-owned write must invalidate the relevant cache before reuse.
- `FLOW-05` should optimize the clean path first: cheap grouped verification, then exact drill-down only for failing groups.

That means the phase is mostly about collapsing existing repeated reads/writes and reusing already-built cache layers, not inventing a new planning architecture.

## Existing implementation to reuse

### 1. Phase discovery and file-read caching already exist

- `src/lib/helpers.js` already has `cachedReadFile()`, `cachedReaddirSync()`, and a per-invocation `getPhaseTree(cwd)` cache.
- `findPhaseInternal()` already reuses the phase tree and returns the core phase inventory used by init flows.
- The current phase tree already knows plans, summaries, incomplete plans, and artifact presence (`has_context`, `has_research`, `has_verification`).

Planning implication: `phase:snapshot` should be built on top of `getPhaseTree()`, `findPhaseInternal()`, and `getRoadmapPhaseInternal()` rather than introducing a second discovery path.

### 2. PlanningCache already covers most of the data shape needed later

- `src/lib/planning-cache.js` already stores roadmap phases, requirements, plans, tasks, and session-state tables.
- `getPlan()`, `getPlansForPhase()`, `getRequirements()`, `getSessionState()`, `getSessionMetrics()`, `getSessionDecisions()`, and session continuity methods already exist.
- Map fallback semantics are already defined: cache reads return `null`/empty and markdown remains canonical.

Planning implication: even though FLOW-06 is Phase 152, Phase 151 should shape `phase:snapshot` so it can later swap plan-index reads from markdown parsing to `PlanningCache` without changing the command contract.

### 3. Init flows already expose the duplication to remove

The main duplication is concentrated in `src/commands/init.js`:

- `cmdInitPlanPhase()` and `cmdInitPhaseOp()` both rediscover context/research/verification/UAT files with fresh `readdirSync()` scans.
- `cmdInitExecutePhase()` reuses `findPhaseInternal()` for plan inventory but still does its own extra enrichment passes.
- `cmdInitVerifyWork()` rescans the phase directory to build manifest entries for plans and summaries.

Planning implication: a shared phase snapshot builder can become the common read primitive for `init:plan-phase`, `init:execute-phase`, `init:verify-work`, and `init:phase-op` with the smallest surface-area win.

### 4. State mutation is already logically one event, but implemented as many commands

- `workflows/execute-plan.md` currently calls `verify:state advance-plan`, `update-progress`, `record-metric`, `add-decision`, and `record-session` sequentially, then separately updates roadmap and requirements.
- `src/commands/state.js` implements each write independently and writes `STATE.md` repeatedly.
- The plugin tool `src/plugin/tools/bgsd-progress.js` already shows one place where a lock-based multi-step state mutation pattern exists.
- Session-state tables in `PlanningCache` already support position, metrics, decisions, blockers, todos, and continuity.

Planning implication: FLOW-02 should likely add a new `verify:state complete-plan`-style command in `src/commands/state.js`, borrowing the locking/structured-mutation ideas from `src/plugin/tools/bgsd-progress.js`, while keeping markdown as canonical output.

### 5. Workflow acceleration is mostly workflow-doc + init-contract work

- `workflows/discuss-phase.md` is intentionally high-turn today and explicitly forbids batching the 3-5 stress-test challenges into one message.
- `workflows/verify-work.md` is explicitly one-test-at-a-time today, though it already has a note that writes are batched on issue / every 5 passes / completion.

Planning implication:

- discuss acceleration must be selective: accelerate gray-area selection and low-risk clarification, but do not break the one-challenge-per-turn stress-test contract unless the workflow wording is intentionally revised.
- verify batching can safely focus on routine test presentation and state-write cadence, because the workflow already tolerates batched writes and grouped follow-up patterns in other parts of the codebase.

## Likely implementation clusters

### Cluster A: Shared snapshot/read path

Primary files:

- `src/lib/helpers.js`
- `src/commands/init.js`
- `src/commands/misc.js` or `src/commands/phase.js`
- `src/router.js`
- `src/lib/constants.js`
- `tests/init.test.cjs`
- `tests/plan.test.cjs`
- `tests/integration.test.cjs`

Likely work:

- add a `phase:snapshot` command or equivalent helper-backed command surface
- centralize phase artifact discovery so init commands stop re-scanning phase directories independently
- decide whether `util:phase-plan-index` is reused internally by snapshot or whether its logic is absorbed into a richer snapshot builder
- preserve compact and manifest-friendly output contracts for current init commands

### Cluster B: Batched finalization/write path

Primary files:

- `src/commands/state.js`
- `workflows/execute-plan.md`
- `src/lib/planning-cache.js`
- `tests/state.test.cjs`
- `tests/session-state.test.cjs`
- `tests/integration.test.cjs`

Likely work:

- introduce a batched state finalization command for plan completion
- make progress/current-plan/decision updates the atomic core
- treat metrics/continuity as optional tail writes with explicit warnings if they fail
- invalidate markdown/file caches after writes so subsequent snapshot/init commands do not reuse stale data

### Cluster C: Discuss/verify workflow acceleration

Primary files:

- `workflows/discuss-phase.md`
- `workflows/verify-work.md`
- `commands/` wrappers if args/help text change
- `tests/discuss-phase-workflow.test.cjs`
- likely new workflow/contract tests for verify batching

Likely work:

- reinterpret `--fast` as default-flow optimization for discuss, with optional alias/flag compatibility if needed
- add grouped verify presentation/reporting rules without replacing one-at-a-time as the default path
- keep locked decisions, deferred ideas, agent discretion, and checkpoint safety explicit in any accelerated path

## Interpreting the roadmap wording correctly

### FLOW-04: roadmap text vs phase context

`REQUIREMENTS.md` and `ROADMAP.md` still say `discuss-phase --fast`, but `151-CONTEXT.md` explicitly revises that direction. Plan for:

- default `discuss-phase` becoming faster on low-risk phases
- optional `--fast` only if needed for compatibility or rollout safety
- no separate long-term product model where “normal” and “fast” discuss diverge in meaning

Practical planning consequence: treat this as a workflow-doc and orchestration-shape change, not a new command family.

### FLOW-05: roadmap text vs likely implementation

The roadmap says `verify-work --batch N` while phase context says grouped verification must stay cheap on the clean path and exact on failures. Plan for:

- configurable grouped test presentation/reporting
- exact replay only for failed groups
- default one-at-a-time mode preserved

This is closer to a two-stage verification algorithm than a simple “present N tests each turn” shortcut.

## Good plan split candidates

A 3-plan split looks strongest; a 4-plan split is safer if verification batching grows.

### Recommended 3-plan split

1. **Snapshot primitive + init reuse**
   - Add shared phase snapshot builder/command.
   - Refactor `init:plan-phase`, `init:execute-phase`, `init:verify-work`, and `init:phase-op` to reuse it.
   - Cover FLOW-01 and most of FLOW-03.

2. **Batched plan finalization**
   - Add new `verify:state` batch subcommand.
   - Update `workflows/execute-plan.md` to call one finalization command instead of five state commands.
   - Cover FLOW-02 and cache invalidation rules after writes.

3. **Discuss/verify acceleration**
   - Update discuss workflow toward faster default low-risk clarification.
   - Add grouped verify mode with clean-path summary and failing-group drill-down.
   - Cover FLOW-04 and FLOW-05.

### Safer 4-plan split

1. Snapshot command contract.
2. Init flow adoption + cache reuse/invalidation cleanup.
3. Batched state finalization.
4. Discuss/verify workflow acceleration.

This split is better if command-contract changes and workflow-doc changes should not land together.

## Main risks and coupling

### 1. Snapshot drift or overlap with existing init outputs

Risk:

- snapshot becomes a second semi-duplicated contract beside `init:*` outputs
- init commands keep custom fields and only partially converge, limiting ROI

Mitigation:

- define one internal snapshot builder first, then derive init outputs from it
- keep init-specific enrichment layered on top instead of recomputing discovery

### 2. Cache staleness after bGSD-owned writes

Risk:

- `getPhaseTree()` and file caches are trusted within a CLI invocation, but Phase 151 wants reuse across high-traffic flows
- stale reads after `STATE.md`, roadmap, requirements, or phase file updates would create misleading snapshots

Mitigation:

- make bGSD-owned write commands explicitly invalidate file/phase/planning caches after success
- test write-then-read sequences, not just cold reads

### 3. Batched state update changes more than `STATE.md`

Risk:

- `execute-plan.md` currently also updates roadmap and requirements after state mutations
- a new “complete-plan” command could accidentally absorb too much and become fragile

Mitigation:

- keep command boundary explicit: atomic core state transition first; roadmap/requirements side effects can remain separate unless they clearly belong in the same durable event
- follow the context decision: atomic core plus optional tail, not universal transactionality

### 4. Discuss acceleration can break current stress-test guarantees

Risk:

- current discuss workflow has explicit one-challenge-per-turn behavior, already covered by tests
- naive batching would violate existing workflow contract and reduce quality

Mitigation:

- accelerate earlier low-risk clarification steps first
- leave the stress-test section mostly intact unless requirements explicitly justify revising the contract and tests

### 5. Single-file CLI and backward compatibility constraints

Risk:

- new commands/helpers can sprawl across source and built output
- output contract changes could break existing workflows or snapshots

Mitigation:

- keep markdown artifacts canonical
- make new JSON fields additive where possible
- ensure `build.cjs` still bundles to one `bin/bgsd-tools.cjs`
- preserve Map fallback behavior and existing command shapes

## Verification ideas

### High-value tests

- `tests/init.test.cjs`: assert init commands reuse the new snapshot behavior while preserving manifest entries and compact output shape
- `tests/plan.test.cjs`: extend phase-plan-index coverage or add snapshot-specific equivalents for plans, waves, incomplete plans, and checkpoint detection
- `tests/state.test.cjs`: add a full `verify:state complete-plan` happy-path and partial-tail-failure coverage
- `tests/session-state.test.cjs`: verify dual-write correctness for session_state, metrics, decisions, and continuity during batched finalization
- `tests/integration.test.cjs`: add write-then-snapshot and snapshot-then-init sequences to catch invalidation bugs
- workflow contract tests: protect discuss stress-test constraints and verify-work default-vs-batch wording

### Specific scenarios worth testing

- snapshot on phase with no directory yet but roadmap section exists
- snapshot after a state write in the same session/process path
- init manifest output before and after snapshot adoption
- complete-plan when core write succeeds but continuity/metrics tail fails
- verify batch with all-pass group vs one failing group requiring exact drill-down
- discuss default flow on low-risk phase vs ambiguous phase to ensure fast path does not skip needed decisions

## Backward compatibility / architecture guardrails

- Keep markdown files canonical and human-readable; JSON snapshot output is additive.
- Preserve Map backend behavior in `PlanningCache`; acceleration must degrade to cache misses, not failures.
- Do not require SQLite for any new command.
- Keep command output additive where possible so existing workflows survive.
- Wire new CLI surfaces through the normal places (`src/router.js`, `src/lib/constants.js`) and keep the built single-file CLI model intact.
- Prefer internal helper consolidation over public command proliferation; Phase 151 is an acceleration phase, so reducing duplicate logic matters as much as adding a new command.

## Bottom line

The implementation naturally clusters into three areas:

1. shared snapshot/read-path consolidation around `helpers.js`, `init.js`, and current plan indexing
2. batched state finalization around `state.js`, `PlanningCache`, and `execute-plan.md`
3. workflow-level discuss/verify acceleration with careful preservation of existing contracts

The biggest planning risks are stale-cache bugs after bGSD-owned writes, overreaching batch finalization scope, and accidentally treating `discuss-phase --fast` as a separate long-term UX instead of accelerating the default flow.

The safest plan is to land read-path consolidation first, then write-path batching, then workflow behavior changes.
