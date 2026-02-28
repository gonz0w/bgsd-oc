<purpose>
Create executable phase prompts (PLAN.md files) for a roadmap phase. Flow: Research (optional) → Plan → Verify → Done. Orchestrates researcher, planner, and checker agents with revision loop (max 3).
</purpose>

<required_reading>
Read all files referenced by execution_context.
Load ui-brand.md sections as needed via extract-sections.
</required_reading>

<process>

## 1. Initialize

```bash
INIT=$(node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs init plan-phase "$PHASE" --compact)
```

Parse: `researcher_model`, `planner_model`, `checker_model`, `research_enabled`, `plan_checker_enabled`, `commit_docs`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `has_research`, `has_context`, `has_plans`, `plan_count`.

File paths: `state_path`, `roadmap_path`, `requirements_path`, `context_path`, `research_path`, `verification_path`, `uat_path` (null if absent).

Intent fields (from 16-01): `intent_summary` (objective, outcome count, top P1 outcomes — null if no INTENT.md), `intent_path` (path to INTENT.md for @context references — null if absent). Use these to inject intent context into researcher and planner spawns when available.

If no `.planning/`: error — run `/gsd-new-project`.

## 2. Parse Arguments

Extract: phase number, flags (`--research`, `--skip-research`, `--gaps`, `--skip-verify`).
No phase number → detect next unplanned. Phase not found → create dir from slug/padded_phase.

## 3. Validate Phase

```bash
PHASE_INFO=$(node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs roadmap get-phase "${PHASE}")
```
Extract `phase_number`, `phase_name`, `goal`.

## 4. Load CONTEXT.md

If `context_path` exists: use it. If null: ask continue without or run discuss-phase first.

## 5. Handle Research

Skip if: `--gaps`, `--skip-research`, or `research_enabled` false (without `--research` override).
If RESEARCH.md exists and no `--research`: use existing.

Otherwise spawn researcher:

```bash
PHASE_DESC=$(node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs roadmap get-phase "${PHASE}" | jq -r '.section')
PHASE_REQ_IDS=$(echo "$PHASE_DESC" | grep -i "Requirements:" | head -1 | sed 's/.*Requirements:\*\*\s*//' | sed 's/[\[\]]//g')
```

```
Task(
  prompt="Read __OPENCODE_CONFIG__/agents/gsd-phase-researcher.md for instructions.
Research Phase {phase_number}: {phase_name}.
Question: What do I need to know to PLAN this phase well?
Read: {context_path}, {requirements_path}, {state_path}
Also read: .planning/INTENT.md (if it exists — project intent, objective, desired outcomes. Scope research to align with stated intent.)
Phase description: {phase_desc}
Requirement IDs: {phase_req_ids}
Read ./AGENTS.md and .agents/skills/ if they exist.
If .planning/ASSERTIONS.md exists: note existing assertions for this phase's requirements. Research should inform whether existing assertions are sufficient.
Write to: {phase_dir}/{phase_num}-RESEARCH.md",
  subagent_type="general", model="{researcher_model}", description="Research Phase {phase}"
)
```

RESEARCH COMPLETE → continue. RESEARCH BLOCKED → offer context/skip/abort.

## 6. Check Existing Plans

If plans exist: offer add more / view / replan.

## 7. Use Context Paths from INIT

Extract file paths from INIT JSON for planner context.
Check for `.planning/ASSERTIONS.md` existence. If present, set `assertions_path` for planner context.

## 8. Surface Relevant Lessons

```bash
LESSONS=$(node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs search-lessons "${PHASE_NAME}" 2>/dev/null)
```
If found: display and include in planner context. If not: skip silently.

## 8.5. Surface Assertions

If `assertions_path` exists:
```bash
ASSERTIONS=$(node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs assertions list --req ${PHASE_REQ_IDS} 2>/dev/null)
```
Display assertion count and coverage. If none found: note "No assertions for {req_ids} — planner will derive must_haves from requirement text."

## 9. Spawn Planner

```
Task(
  prompt="Read __OPENCODE_CONFIG__/agents/gsd-planner.md for instructions.

Phase: {phase_number}, Mode: {standard|gap_closure}
Read: {state_path}, {roadmap_path}, {requirements_path}, {context_path}, {research_path}, .planning/INTENT.md (if exists)
Read: {assertions_path} (if exists — structured acceptance criteria for requirements)
If --gaps: also read {verification_path}, {uat_path}
Requirement IDs (MUST all appear in plans): {phase_req_ids}
Read ./AGENTS.md and .agents/skills/ if they exist.
If INTENT.md exists: derive plan objectives from desired outcomes (DO-XX). Each plan's objective should trace to at least one desired outcome. Include intent.outcome_ids in PLAN.md frontmatter.
If ASSERTIONS.md exists: for each requirement this phase covers, find its assertions and use must-have assertions as source for must_haves.truths in PLAN.md frontmatter. If no assertions exist for a requirement, derive truths from requirement text + context.

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
Check: requirement coverage, task structure, dependencies, must_haves.",
  subagent_type="gsd-plan-checker", model="{checker_model}", description="Verify Phase {phase} plans"
)
```

PASSED → step 14. ISSUES → revision loop (max 3):

```
Task(
  prompt="Read __OPENCODE_CONFIG__/agents/gsd-planner.md for instructions.
Revision mode. Read: {phase_dir}/*-PLAN.md
Checker issues: {structured_issues}. Make targeted updates, return what changed.",
  subagent_type="general", model="{planner_model}", description="Revise Phase {phase} plans"
)
```

After revision → re-check, increment iteration_count. Max reached → offer force/guidance/abandon.

## 14. Present Final Status

Route to offer_next or auto_advance.

## 15. Auto-Advance

If `--auto` or `config-get workflow.auto_advance` true:
```
Task(prompt="Run /gsd-execute-phase ${PHASE} --auto", subagent_type="general", description="Execute Phase ${PHASE}")
```
PHASE COMPLETE → done. GAPS/FAILED → stop chain, display for manual review.

Otherwise: offer_next.

</process>

<offer_next>
Phase {X} planned: {N} plans in {M} waves. Table of waves/objectives.
Research: completed/existing/skipped. Verification: passed/overridden/skipped.

Next: `/gsd-execute-phase {X}` (after `/clear`).
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
