<purpose>
Create executable phase prompts (PLAN.md files) for a roadmap phase. Flow: Research (optional) → Plan → Verify → Done. Orchestrates researcher, planner, and checker agents with revision loop (max 3).
</purpose>

<required_reading>
Read all files referenced by execution_context.
</required_reading>

<process>

## 1. Initialize

**Context:** This workflow receives project context via `<bgsd-context>` auto-injected by the bGSD plugin's `command.execute.before` hook. If no `<bgsd-context>` block is present, the plugin is not loaded.

**If no `<bgsd-context>` found:** Stop and tell the user: "bGSD plugin required for v9.0. Install with: npx bgsd-oc"

Parse `<bgsd-context>` JSON for: `researcher_model`, `planner_model`, `checker_model`, `research_enabled`, `plan_checker_enabled`, `commit_docs`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `has_research`, `has_context`, `has_plans`, `plan_count`, `resume_summary`, `effective_intent`, `jj_planning_context`.

This workflow is the `/bgsd-plan phase` branch of the broader canonical planning family. Roadmap mutation, milestone-gap planning entry, and plan-scoped todo actions normalize through `/bgsd-plan` onto their own existing workflows instead of expanding this phase-planning workflow into a general planning catch-all.

Reference-only compatibility note for future parity checks: the legacy single-purpose planning aliases should remain behaviorally equivalent to their canonical planning-family routes, while roadmap, gaps, and todo work now belongs to sibling `/bgsd-plan roadmap|gaps|todo` branches rather than this workflow.

File paths: `state_path`, `roadmap_path`, `requirements_path`, `context_path`, `research_path`, `verification_path`, `uat_path` (null if absent).

Planning-alignment context (from Phase 157): `effective_intent` is the default compact contract for project + milestone + phase purpose. `jj_planning_context` is advisory capability context only — no live workspace inventory, no automatic sibling-plan routing, and no `workspace_active` dependency.

When overlap evidence is strong (file ownership, plan boundaries, or other explicit low-risk signals), planners and roadmappers may manually prefer safe low-overlap sibling work. Keep that preference advisory and human-directed rather than heuristic auto-routing.

If no `.planning/`: error — run `/bgsd-new-project`.

## 2. Parse Arguments

Extract: phase number from `phase_number` in `<bgsd-context>`, flags (`--research`, `--skip-research`, `--gaps`, `--skip-verify`) from `$ARGUMENTS`.

**Phase number is required.** If `phase_number` is null or `phase_found` is false:
```
ERROR: Phase number required.
Usage: /bgsd-plan phase <phase-number> [flags]
Example: /bgsd-plan phase 92
Use /bgsd-inspect progress to see available phases.
```
Exit.

Phase directory not found on disk → create dir from `padded_phase` and `phase_slug` from `<bgsd-context>`.

## 2.5. Gate Active Chain Continuation

Treat handoff-driven planning as additive rather than mandatory:

- If `resume_summary` is absent: standalone `/bgsd-plan phase <phase-number>` works normally, and the legacy standalone phase alias remains reference-only compatibility guidance.
- If `resume_summary` is present and `latest_valid_step == "research"`: planning may continue from the latest valid artifact.
- If `resume_summary` is present and `valid` is false: fail closed, present `repair_guidance`, and stop instead of inferring continuation from `STATE.md`, existing PLANs, or other partial disk state.
- If the latest valid handoff points to an earlier or later step than `research`: stop with repair or restart guidance rather than guessing whether to regenerate or skip work.
- If source files changed during the run (`stale_sources` or equivalent freshness failure): warn, rebuild from source, validate that the reconstructed handoff state now matches the current expected fingerprint, and only then continue.

Use the Phase 152 resume-summary contract as the single re-entry surface: exact options are `resume`, `inspect`, and `restart`, and targeting must stay latest-valid-artifact based.

## 3. Validate Phase

```bash
PHASE_INFO=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs plan:roadmap get-phase "${PHASE}")
```
Extract `phase_number`, `phase_name`, `goal`, `tdd` (TDD hint: `recommended`, `required`, or null when omitted — planner still must make an explicit selected/skipped TDD decision for every implementation plan).

## 4. Load CONTEXT.md

If `context_path` exists: use it. If null: use `questionTemplate('plan-phase-context', 'SINGLE_CHOICE')`.

## 4.5. High-Impact Gray Area Gate

Before spawning the planner, do a narrow decision-gap scan.

- If discuss was completed and CONTEXT.md clearly records High-impact decisions or explicit High dispositions, do not reopen them.
- If discussion was skipped, CONTEXT.md is missing, or the context leaves major High gray areas unresolved, identify only the High-impact ambiguities that would materially change plan structure, sequencing, interfaces, migration, or user-visible behavior.
- Do not broaden this into a full discuss session. No angry-user step here.
- Do not ask about Medium or Low gray areas unless a supposedly lower-ranked item has become High because of planning consequences.

For each unresolved High gray area that has big planning impact:
- state why it matters to planning
- ask one focused question with concrete alternatives
- record the outcome as Locked, Defaulted, Delegated, or Deferred before planning continues

If there are no unresolved High gray areas with major planning impact, continue silently.

## 5. Handle Research

Skip if: `--gaps`, `--skip-research`, or `research_enabled` false (without `--research` override).
If RESEARCH.md exists and no `--research`: use existing.

Otherwise spawn researcher:

```bash
PHASE_DESC=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs plan:roadmap get-phase "${PHASE}" | jq -r '.section')
PHASE_REQ_IDS=$(echo "$PHASE_DESC" | grep -i "Requirements:" | head -1 | sed 's/.*Requirements:\*\*\s*//' | sed 's/[\[\]]//g')
```

```
Task(
  prompt="Read __OPENCODE_CONFIG__/agents/bgsd-phase-researcher.md for instructions.
Research Phase {phase_number}: {phase_name}.
Question: What do I need to know to PLAN this phase well?
Read: {context_path}, {requirements_path}, {state_path}
Use injected `effective_intent` as the default planning-alignment contract for project, milestone, and phase purpose.
Use injected `jj_planning_context` only as advisory capability context — do not depend on live workspace inventory and do not auto-route sibling work.
If low-overlap evidence is explicit, you may note a manual preference for safe sibling work; otherwise ignore it.
Only inspect raw intent source docs when direct source-text review is actually required.
Phase description: {phase_desc}
Requirement IDs: {phase_req_ids}
Read ./AGENTS.md and .agents/skills/ if they exist.
If .planning/ASSERTIONS.md exists: note existing assertions for this phase's requirements. Research should inform whether existing assertions are sufficient.
Before returning, perform one lessons reflection using the existing lessons subsystem: review your full subagent-visible conversation and tool history for one durable prompt, workflow, tooling, or agent-behavior improvement; if found, capture at most one structured lesson with `bgsd-tools lessons:capture`.
Write to: {phase_dir}/{phase_num}-RESEARCH.md",
  subagent_type="general", model="{researcher_model}", description="Research Phase {phase}"
)
```

RESEARCH COMPLETE → continue. RESEARCH BLOCKED → offer context/skip/abort.

## 6. Check Existing Plans

If plans exist: use `questionTemplate('plan-phase-existing', 'SINGLE_CHOICE')`.

## 7. Use Context Paths from INIT

Extract file paths from INIT JSON for planner context.
Check for `.planning/ASSERTIONS.md` existence. If present, set `assertions_path` for planner context.

## 8. Surface Relevant Lessons

```bash
LESSONS=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs lessons:list --query "${PHASE_NAME}" --limit 8 2>/dev/null)
```
If found: display and include the strongest structured matches in planner context, emphasizing `title`, `severity`, `type`, `affected_agents`, and `prevention_rule` so the planner can adapt tasks and must_haves. If not: skip silently.

## 8.5. Surface Assertions

If `assertions_path` exists:
```bash
ASSERTIONS=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:assertions list --req ${PHASE_REQ_IDS} 2>/dev/null)
```
Display assertion count and coverage. If none found: note "No assertions for {req_ids} — planner will derive must_haves from requirement text."

## 9. Spawn Planner

```
Task(
  prompt="Read __OPENCODE_CONFIG__/agents/bgsd-planner.md for instructions.

Phase: {phase_number}, Mode: {standard|gap_closure}
Read: {state_path}, {roadmap_path}, {requirements_path}, {context_path}, {research_path}
Read: {assertions_path} (if exists — structured acceptance criteria for requirements)
If --gaps: also read {verification_path}, {uat_path}
Requirement IDs (MUST all appear in plans): {phase_req_ids}
Before plans are treated as approval-ready, run `verify:verify plan-structure`. Then run `verify:verify analyze-plan` and fix any realism blockers. Do not rely on `must_haves` field presence alone — artifacts/key_links must be verifier-consumable under the shared metadata contract, and command drift, stale paths, unavailable validation steps, task-order verify hazards, and overscope risk must be resolved before handoff.
Read ./AGENTS.md and .agents/skills/ if they exist.
Use injected `effective_intent` as the normal contract for project north star plus milestone/phase focus. Derive plan objectives from its relevant desired outcomes (DO-XX). Each plan's objective should trace to at least one desired outcome. Include intent.outcome_ids in PLAN.md frontmatter.
Use injected `jj_planning_context` as advisory-only capability context. Do not inspect live workspace inventory, and do not invent an automatic sibling-plan recommendation heuristic.
If file ownership or plan overlap evidence clearly shows low risk, you may manually prefer safe low-overlap sibling work while keeping the final choice explicit and human-readable.
Only read raw intent source docs if direct editing or source-text quoting is truly required.
If ASSERTIONS.md exists: for each requirement this phase covers, find its assertions and use must-have assertions as source for must_haves.truths in PLAN.md frontmatter. If no assertions exist for a requirement, derive truths from requirement text + context.
Treat High-impact gray areas in CONTEXT.md as planning-critical. Do not guess past unresolved High items; require a visible disposition or planner-side clarification before locking plan structure.
TDD hint for this phase: {tdd} (from ROADMAP.md **TDD:** field — 'recommended', 'required', or null when omitted). Regardless of hint value, planner MUST evaluate every implementation plan and record an explicit visible body callout in the plan: `> **TDD Decision:** Selected|Skipped — ...`.
Use the deterministic floor exactly: default to `Selected` when work introduces or changes testable behavior with clear expected outcomes; use `Skipped` for clearly docs-only, config-only, layout-only, or other non-behavioral/tooling work. `recommended` upgrades TDD-eligible `type: execute` plans to checker warnings; `required` upgrades them to blockers; omitted hints still produce checker info so the TDD decision path is visible instead of silent. Keep the rationale short, human-readable, and out of frontmatter. Stay within Phase 149 scope: selection/rationale severity only, not Phase 150 `execute:tdd` semantic enforcement.

Before returning, perform one lessons reflection using the existing lessons subsystem: review your full subagent-visible conversation and tool history for one durable prompt, workflow, tooling, or agent-behavior improvement; if found, capture at most one structured lesson with `bgsd-tools lessons:capture`.

Output: PLAN.md files with frontmatter, XML tasks, verification, must_haves.",
  subagent_type="general", model="{planner_model}", description="Plan Phase {phase}"
)
```

PLANNING COMPLETE → check/skip. CHECKPOINT → handle. INCONCLUSIVE → offer retry.

## 10-12. Checker + Revision Loop

If `--skip-verify` or checker disabled: skip to 14.

```
Task(
  prompt="Verify Phase {phase} plans.
Read: {phase_dir}/*-PLAN.md, {roadmap_path}, {requirements_path}, {context_path}
Run and honor `verify:verify plan-structure` and `verify:verify analyze-plan` for each plan before approval. Treat malformed or inconclusive verifier-facing `must_haves` artifacts/key_links metadata as blockers rather than a mere field-presence issue, and block approval on command drift, stale paths, unavailable validation steps, task-order verify hazards, or overscope risk.
Check: requirement coverage, task structure, dependencies, must_haves.",
  subagent_type="bgsd-plan-checker", model="{checker_model}", description="Verify Phase {phase} plans"
)
```

PASSED → use `questionTemplate('plan-phase-checker-passed', 'SINGLE_CHOICE')`. ISSUES → revision loop (max 3):

```
Task(
  prompt="Read __OPENCODE_CONFIG__/agents/bgsd-planner.md for instructions.
Revision mode. Read: {phase_dir}/*-PLAN.md
Checker issues: {structured_issues}. Make targeted updates, return what changed.
Before returning, perform one lessons reflection using the existing lessons subsystem: review your full subagent-visible conversation and tool history for one durable prompt, workflow, tooling, or agent-behavior improvement; if found, capture at most one structured lesson with `bgsd-tools lessons:capture`.",
  subagent_type="general", model="{planner_model}", description="Revise Phase {phase} plans"
)
```

After revision → re-check, increment iteration_count. Max reached → use `questionTemplate('plan-phase-checker-issues', 'SINGLE_CHOICE')`.

## 14. Present Final Status

Before presenting final status or `--auto` continuation, write or refresh the durable `plan` handoff artifact:

```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:state handoff write \
  --phase "${PHASE}" \
  --step plan \
  --summary "Plans ready for execution in Phase ${PHASE}" \
  --next-command "/bgsd-execute-phase ${PHASE}"
```

Route to offer_next or auto_advance.

## 15. Auto-Advance

**Pre-computed decision:** If `decisions.auto-advance` exists in `<bgsd-context>`, use its `.value` (boolean). Skip config/flag check below.

**Fallback** (if decisions not available):

If `--auto` or `config-get workflow.auto_advance` true:
```
Task(prompt="Run /bgsd-execute-phase ${PHASE} --auto. Before returning, perform one lessons reflection using the existing lessons subsystem: review your full subagent-visible conversation and tool history for one durable prompt, workflow, tooling, or agent-behavior improvement; if found, capture at most one structured lesson with `bgsd-tools lessons:capture`.", subagent_type="general", description="Execute Phase ${PHASE}")
```
PHASE COMPLETE → done. GAPS/FAILED → stop chain, display for manual review.

Otherwise: offer_next.

## Tool-Aware Planning Guidance

When `tool_availability` is present in bgsd-context:
- **All tools available:** Tasks can assume fast file discovery and search — standard task sizing applies
- **Some tools missing:** Same task count and granularity — tasks describe goals ("search for X"), executors resolve tool choice at runtime via resolve functions
- **No change to plan structure:** Task decomposition is tool-agnostic. Tool selection is an executor concern, not a planner concern. Do not add extra tasks or increase estimates based on tool absence.

This guidance implements the AGENT-01 principle: abstract tool choice away from plans.

</process>

<offer_next>
Phase {X} planned: {N} plans in {M} waves. Table of waves/objectives.
Research: completed/existing/skipped. Verification: passed/overridden/skipped.

Next: `/bgsd-execute-phase {X}` (after `/clear`).
Also: review plans, re-research.
</offer_next>

<success_criteria>
- [ ] Phase validated, directory created if needed
- [ ] CONTEXT.md loaded and passed to all agents
- [ ] Research completed (unless skipped/exists)
- [ ] Plans created with valid frontmatter
- [ ] Verification passed or user override
- [ ] User knows next steps
</success_criteria>
