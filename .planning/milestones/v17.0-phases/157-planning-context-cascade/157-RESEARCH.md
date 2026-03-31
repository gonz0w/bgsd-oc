# Phase 157: Planning Context Cascade - Research

**Researched:** 2026-03-29
**Goal:** identify what the planner needs to know to plan Phase 157 well

## Existing Surfaces

- `src/commands/init.js:1659` `cmdInitProgress`, `src/commands/init.js:624` `cmdInitPlanPhase`, and `src/commands/init.js:229` `cmdInitExecutePhase` already inject `intent_summary` via `getIntentSummary()` from `src/commands/intent.js:1593`. These are the main existing intent-injection change points.
- `src/lib/context.js:99` is the agent-scoped filter contract. Today `bgsd-planner`, `bgsd-phase-researcher`, and `bgsd-roadmapper` keep `intent_summary`; `bgsd-verifier` explicitly excludes it. Any new `effective_intent` or JJ planning context that should survive `--agent=` scoping needs manifest updates here.
- `workflows/plan-phase.md:17`-`22` already treats init output as the planning contract, and still names `intent_summary`/`intent_path` explicitly. The same workflow also hardcodes direct `.planning/INTENT.md` reads for researcher and planner spawns at `workflows/plan-phase.md:93`-`103` and `workflows/plan-phase.md:136`-`154`.
- `workflows/new-milestone.md:52`-`75` is the current milestone-intent ownership problem: it explicitly reviews and mutates `.planning/INTENT.md`, and `workflows/new-milestone.md:188`-`211` passes `.planning/INTENT.md` straight into the roadmapper prompt. There is no `.planning/MILESTONE-INTENT.md` support anywhere in code or workflow text.
- `src/commands/init.js:1100` `cmdInitVerifyWork` is very thin and exposes no intent context. `workflows/verify-work.md:57`-`66` compensates by telling the workflow to read `.planning/INTENT.md` directly and derive outcome tests from raw desired outcomes.
- JJ workspace context already exists, but only as execution-state context: `src/commands/init.js:524`-`551` injects live `workspace_active` inventory and `file_overlaps`; `src/commands/workspace.js:144`-`173` and `src/commands/workspace.js:330`-`368` source that from managed workspaces plus plan frontmatter; `src/lib/jj-workspace.js:99`-`175` adds stale/divergent/recovery diagnostics.

## Gaps

- There is no milestone-intent artifact, parser, or helper. Global search shows no implementation references to `MILESTONE-INTENT`, so INT-01 and INT-05 require net-new support rather than wiring existing code.
- There is no `effective_intent` builder. `src/commands/intent.js:1593` only returns a project-level summary, so Phase 157 needs a new compact layered computation path rather than expanding `getIntentSummary()` ad hoc.
- There is no structured phase-intent parser yet. Phase-local purpose currently lives only in prose inside `157-CONTEXT.md`-style files, so the phase layer of `effective_intent` needs a small parser or extractor for a durable context subsection.
- The current planning/verifying flows still rely on raw document reads instead of injected compact context: `workflows/plan-phase.md`, `workflows/new-milestone.md`, and `workflows/verify-work.md` all point agents at `.planning/INTENT.md` directly.
- `bgsd-verifier` does not currently receive intent context through `src/lib/context.js:109`-`117`, and `init:verify-work` does not expose intent fields at all. That leaves INT-04 incomplete even if planner/researcher are updated.
- `src/commands/init.js:903` `cmdInitNewMilestone` currently exposes only milestone version/name plus file paths. If roadmapping is meant to receive compact `effective_intent` and JJ planning capability context consistently, this init contract likely needs to grow.

## Risks/Decisions

- Keep intent separate from requirements. The phase context and PRD both lock this: `effective_intent` is advisory purpose, not a second requirement system.
- Preserve backward compatibility and compact-mode behavior. Nearby tests already expect null intent fields to disappear in compact output (`tests/intent.test.cjs:998`-`1013`), so partial-layer fallback should warn visibly without bloating every hot path.
- Do not source JJ planning context from live workspace inventory. `workspace_active` and `inspectWorkspace()` are execution-state snapshots; they are too volatile and too detailed for planning context, and the phase decision already forbids live inventory.
- Prefer a static capability payload sourced from repo/config semantics: JJ required for execution, workspace-backed parallel waves supported, recovery tooling available, and max concurrency/config shape from `src/commands/workspace.js:11`-`24` plus `src/commands/init.js:344`-`349`. This stays capability-oriented and avoids heuristic overreach.
- Do not plan a sibling-work recommendation heuristic in Phase 157. The payload should say what planning may rely on, not choose sibling plans automatically.

## Suggested Plan Slices

1. **Intent foundation**
   Create `.planning/MILESTONE-INTENT.md` support plus a compact intent-computation helper that layers project, milestone, and phase intent with partial-layer warnings.

2. **Planning context contract**
   Thread `effective_intent` through init/context surfaces used by roadmapper, planner, phase researcher, verifier, and verify-work; update `src/lib/context.js` manifests so scoped agent payloads carry the new field where needed.

3. **Workflow rewiring**
   Update `workflows/new-milestone.md`, `workflows/plan-phase.md`, and `workflows/verify-work.md` to prefer injected compact context over raw `.planning/INTENT.md` dumps, while preserving direct file references only where full-document editing is actually required.

4. **JJ planning capability context**
   Add a compact planning-facing JJ capability payload sourced from static config/capabilities, not `workspace_active`; wire it into roadmapping/planning surfaces as advisory-only context.

## Test Targets

- `tests/intent.test.cjs` - extend init intent coverage from `intent_summary` to `effective_intent`, partial-layer fallback, and milestone-intent presence/absence.
- `tests/init.test.cjs` - extend `init:new-milestone`, `init:plan-phase`, `init:verify-work`, and any compact/manifest assertions that should now surface or omit new fields deterministically.
- `tests/agent.test.cjs` and `tests/enricher-decisions.test.cjs` - update manifest/scoping expectations so planner/researcher/roadmapper/verifier keep the right new fields and low-dependency filtering still behaves silently.
- `tests/workflow.test.cjs` - add wording/contract checks for `workflows/new-milestone.md`, `workflows/plan-phase.md`, and `workflows/verify-work.md` so raw `INTENT.md` assumptions do not creep back.
- `tests/integration.test.cjs` - add at least one end-to-end contract proving planning surfaces receive compact intent plus JJ planning capability context without depending on live workspace inventory.

## One Useful Lesson

- When a context field is meant for subagents, check both the init command and `src/lib/context.js` manifests together. This repo often has the data in init output before agent-scoped filtering drops it, so planning features need contract updates in both places.
