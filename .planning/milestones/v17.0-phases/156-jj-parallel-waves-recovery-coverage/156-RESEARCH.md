# Phase 156: JJ Parallel Waves, Recovery & Coverage - Research

**Researched:** 2026-03-29
**Domain:** JJ workspace parallel execution, stale recovery, and repo-wide JJ-first coverage
**Confidence:** HIGH

## User Constraints

- Keep the supported recovery flow inside the existing `workspace` surface rather than introducing a separate recovery command family.
- Make every recovery path preview-first. Even obvious stale cases should show the proposed action before mutation.
- Let unaffected plans in a wave finish and reconcile independently; failed or divergent workspaces must be reported separately instead of blocking the whole wave.
- Keep failed workspaces and recovery breadcrumbs available until the phase finishes successfully, then let normal end-of-phase cleanup remove obsolete failed workspaces.
- Keep help/config/docs/tests JJ-first. Do not reintroduce Git worktree fallback language.

## Phase Requirements

| Requirement | What this phase must make true |
|-------------|--------------------------------|
| JJ-03 | Multi-plan execution waves create, track, and reconcile one JJ workspace per runnable plan |
| JJ-04 | Execution flows detect stale or divergent workspaces and provide JJ operation-log-backed diagnostics plus supported recovery helpers |
| JJ-06 | Config, docs, help, and tests teach and validate the JJ-first workspace lifecycle, stale handling, and recovery model |

## Summary

Phase 155 shipped the JJ gate and the first workspace lifecycle shell, but the real Phase 156 behavior is still mostly deferred. The current repo already routes execution through a top-level `workspace` command family and teaches workspace-based waves in `workflows/execute-phase.md`, but the implementation still stops short of live workspace tracking, stale/divergent classification, op-log diagnostics, recovery previews, and partial-wave recovery semantics. `workspace reconcile` is explicitly validate-only, `workspace_active` is always empty in `init:execute-phase`, and the test suite only covers add/list/forget/cleanup plus the narrow Phase 155 reconcile wrapper.

The biggest repo-wide inconsistency is JJ-first coverage: runtime now rejects legacy `worktree` config, but shipped config templates still publish `worktree` blocks. That means Phase 156 must treat coverage as more than docs polish; it includes aligning templates, schema/help text, and regression tests with the workspace-first contract that Phase 155 already made authoritative.

The cleanest planning split is: first harden the workspace command layer with status classification, op-log diagnostics, preview-first recovery, and retained failure breadcrumbs; then wire those richer workspace semantics into execute-phase init and wave orchestration; finally align config/help/templates/tests so maintainers see and validate the supported JJ-first model everywhere.

**Primary recommendation:** Plan Phase 156 as three execution plans: workspace recovery core, execute-wave integration, and JJ-first coverage alignment.

## Existing Codebase Reality

### Primary touchpoints

| Area | Current state | Planning implication |
|------|---------------|----------------------|
| `src/commands/workspace.js` | Real JJ add/list/forget/cleanup wrappers, but `reconcile` is validate-only and no stale/divergent logic exists | Main implementation anchor for JJ-04 and failed-run inspection/recovery |
| `src/commands/init.js` | Exposes `workspace_*` fields and file-overlap analysis, but `workspace_active` is always `[]` | Needs live workspace/run state and wave-oriented recovery context for executors |
| `workflows/execute-phase.md` | Already describes workspace-based parallel waves, but still says stale/conflict handling is deferred to Phase 156 | Must be upgraded from placeholder wording to executable recovery/partial-wave guidance |
| `src/lib/context.js` | Passes workspace metadata to execution agents | Must stay aligned with any richer `workspace_active` and recovery fields |
| `templates/config.json`, `templates/config-full.json` | Still publish legacy `worktree` config blocks | Must be migrated to supported `workspace` config and JJ-first defaults |
| `src/lib/constants.js`, `src/lib/command-help.js`, `src/lib/commandDiscovery.js` | Already workspace-first, but help text still reflects the narrow Phase 155 lifecycle | Need updated recovery/inspection wording and config schema alignment |
| `tests/workspace.test.cjs` | Covers add/list/forget/cleanup and validate-only reconcile in real JJ repos | Needs stale/divergent/recovery/partial-cleanup coverage |
| `tests/init.test.cjs`, `tests/integration.test.cjs`, `tests/workflow.test.cjs`, `tests/contracts.test.cjs` | Cover init, handoff, and workflow contracts broadly | Need assertions that execution surfaces expose active workspaces and JJ-first recovery guidance |

### Gaps against phase goal

- No live `workspace_active` inventory in execute init.
- No JJ operation-log-backed diagnostics in source or tests.
- No preview-first recovery contract for stale or divergent workspaces.
- No explicit partial-wave success/failure reporting contract beyond workflow prose.
- No recovery-aware cleanup behavior for failed workspaces during execution vs end-of-phase cleanup.
- No JJ-first config template coverage despite runtime rejection of `worktree` config.

## Recommended Architecture Patterns

### Pattern 1: Workspace state classification at the command layer

Keep workspace status, stale detection, op-log inspection, and preview/apply recovery in the `workspace` command family so execution workflows consume one stable contract instead of reconstructing JJ state ad hoc.

Recommended output shape additions:

- `status`: `healthy`, `stale`, `divergent`, `missing`, `forgotten`, `unknown`
- `diagnostics`: short JJ-backed evidence plus relevant op-log slices
- `recovery_preview`: what command(s) bGSD would run and why
- `recovery_allowed`: whether the case is safe for preview/apply automation

### Pattern 2: Execution treats workspace outcomes per plan, not per whole wave

Wave orchestration should separate:

- successful plan workspaces that can reconcile now
- failed/divergent workspaces that must remain inspectable
- advisory wave-level summary that reports partial completion honestly

Do not collapse the whole wave into one success/failure bit.

### Pattern 3: Coverage alignment is part of the shipped contract

Because templates currently contradict runtime behavior, Phase 156 should treat config/help/template/test alignment as product work, not backlog cleanup. Config schema, examples, workflow wording, and regression suites should all point to the same `workspace` contract.

## Likely Plan Boundaries

### Plan A: Workspace diagnostics and recovery core

Focus files:

- `src/commands/workspace.js`
- new JJ workspace helper under `src/lib/`
- `tests/workspace.test.cjs`
- `tests/helpers.cjs` if shared JJ fixtures need extension

What it should deliver:

- live managed-workspace status classification
- stale/divergent diagnostics backed by JJ commands and op log
- preview-first recovery through existing `workspace` commands
- recovery-aware cleanup semantics that preserve failed breadcrumbs until explicitly safe to delete

### Plan B: Execute-wave integration and partial-wave reporting

Focus files:

- `src/commands/init.js`
- `src/lib/context.js`
- `workflows/execute-phase.md`
- `tests/init.test.cjs`
- `tests/integration.test.cjs`

What it should deliver:

- non-empty `workspace_active` execution context
- execution guidance that uses recovery previews and partial-wave outcomes
- supported reconcile/recovery sequencing for successful vs failed workspaces

### Plan C: JJ-first config/help/template/test alignment

Focus files:

- `templates/config.json`
- `templates/config-full.json`
- `src/lib/constants.js`
- `src/lib/config.js`
- `src/lib/command-help.js`
- `src/lib/commandDiscovery.js`
- `tests/contracts.test.cjs`
- `tests/workflow.test.cjs`

What it should deliver:

- shipped config examples use `workspace`, not `worktree`
- config/help/discovery text reflects recovery-capable JJ workspaces
- regression coverage proves repo-facing guidance matches runtime behavior

## Risks and Planning Implications

### Risk 1: JJ CLI output parsing drift

Recovery and op-log diagnostics will depend on real JJ output. Favor narrow helpers with test fixtures that lock the expected parsing contract.

### Risk 2: Preview vs apply separation

The user locked preview-first recovery. Planning should keep detection/preview and apply behavior clearly separated so safe previews never mutate state accidentally.

### Risk 3: Cleanup timing

`workspace cleanup` currently deletes everything it manages. Phase 156 needs a clearer distinction between active recovery retention and final post-success cleanup so failed state is not erased too early.

### Risk 4: Coverage drift across docs and runtime

Templates, help text, and tests already drift from runtime on config shape. Any implementation plan touching workspace behavior should assume one follow-up plan is required to align repo-facing surfaces.

## Assertions Assessment

No `.planning/ASSERTIONS.md` exists for this project, so Phase 156 must derive must-haves directly from the requirement text, roadmap goal, and locked context decisions.

## High-Impact Ambiguity Check

No unresolved High-impact planning blocker remains after `156-CONTEXT.md`.

- Recovery surface location is locked: extend existing `workspace` commands.
- Recovery posture is locked: preview-first before mutation.
- Wave behavior is locked: unaffected plans may complete and reconcile independently.

The remaining open points are implementation-shape details, not planning blockers.

## Sources

### Primary (HIGH confidence)

- Local codebase: `src/commands/workspace.js`, `src/commands/init.js`, `src/lib/context.js`, `workflows/execute-phase.md`, `templates/config.json`, `templates/config-full.json`, `src/lib/constants.js`, `src/lib/config.js`, `tests/workspace.test.cjs`, `tests/init.test.cjs`, `tests/integration.test.cjs`, `tests/workflow.test.cjs`
- Phase 155 artifacts: `.planning/phases/155-jj-execution-gate-workspace-lifecycle/155-02-PLAN.md`, `.planning/phases/155-jj-execution-gate-workspace-lifecycle/155-02-SUMMARY.md`
- Current phase context: `.planning/phases/156-jj-parallel-waves-recovery-coverage/156-CONTEXT.md`

### Secondary (MEDIUM confidence)

- Product intent: `.planning/INTENT.md`
- Requirements and roadmap: `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`

## Metadata

**Confidence breakdown:** HIGH for current repo gaps, deferred Phase 155 scope, and the need for config/help/test alignment; MEDIUM for the exact JJ command mix used to diagnose stale vs divergent workspaces because the implementation has not landed yet.  
**Research date:** 2026-03-29  
**Valid until:** Re-check if Plan A changes the `workspace` JSON contract or if JJ CLI output expectations change.
