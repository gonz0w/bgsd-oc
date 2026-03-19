<!-- section: purpose -->
<purpose>
Execute all plans in a phase using wave-based parallel execution. Orchestrator stays lean — delegates plan execution to subagents.
</purpose>

<core_principle>
Orchestrator coordinates, not executes. Each subagent loads full execute-plan context with fresh 200k window. Discover → deps → waves → spawn → checkpoints → results.
</core_principle>

<required_reading>
Read STATE.md before starting.
</required_reading>
<!-- /section -->

<process>

<!-- section: initialize -->
<step name="initialize" priority="first">
<skill:bgsd-context-init />

Parse `<bgsd-context>` JSON for: `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `plans`, `incomplete_plans`, `plan_count`, `incomplete_count`, `parallelization`, `branching_strategy`, `branch_name`, `executor_model`, `verifier_model`, `commit_docs`, `pre_flight_validation`, `worktree_enabled`, `worktree_config`, `worktree_active`, `file_overlaps`, `handoff_tool_context`, `capability_level` (from `handoff_tool_context.capability_level`).

**`phase_number` is the authoritative phase — it comes from the user's argument as resolved by the bGSD plugin. Never infer or auto-select a different phase.**

**Phase number is required.** If `phase_number` is null or `phase_found` is false:
```
ERROR: Phase number required.
Usage: /bgsd-execute-phase <phase-number> [flags]
Example: /bgsd-execute-phase 92
Use /bgsd-progress to see available phases.
```
Exit.

Extract flags from `$ARGUMENTS`:
```bash
PHASE_NUMBER="${phase_number}"  # from <bgsd-context> — user-provided arg
GAPS_ONLY="false"
[[ "$ARGUMENTS" == *"--gaps-only"* ]] && GAPS_ONLY="true"
CI_FLAG=""
[[ "$ARGUMENTS" == *"--ci"* && "$ARGUMENTS" != *"--no-ci"* ]] && CI_FLAG="force"
[[ "$ARGUMENTS" == *"--no-ci"* ]] && CI_FLAG="skip"
```

`plan_count` 0 → error: no plans found for phase. No STATE.md but `.planning/` exists → offer reconstruct. `parallelization` false → sequential.
</step>
<!-- /section -->

<!-- section: handle_branching -->
<step name="handle_branching">
**Pre-computed decision:** Use `decisions.branch-handling` value (skip/create/update/use-existing) if present.

**Fallback:** If `branching_strategy` is `"none"`: skip. Otherwise:
```bash
git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"
```
</step>
<!-- /section -->

<!-- section: validate_phase -->
<step name="validate_phase">
Report: "Found {plan_count} plans in {phase_dir} ({incomplete_count} incomplete)"
</step>
<!-- /section -->

<!-- section: preflight -->
<step name="preflight_dependency_check">
```bash
DEPS=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:validate-dependencies "${PHASE_NUMBER}" 2>/dev/null)
```
Issues → yolo: log, proceed. Interactive: present, ask proceed/stop.
</step>

<step name="preflight_state_validation">
Skip if `pre_flight_validation` false or `--skip-validate`. Run `verify:state validate --fix` then `verify:state validate`. Display fixed count, status table on warnings/errors. Errors → yolo: continue with banner. Interactive: ask fix or `--skip-validate`.
</step>

<step name="preflight_worktree_check">
Skip if `worktree_enabled` false. If overlaps within wave → display table (yolo: advisory, proceed; interactive: ask). Display worktree config summary. If `worktree_active` non-empty: display, consider cleanup.
</step>

<step name="preflight_convention_check">
Advisory only. Collect `files_modified` from all incomplete plans. Run `codebase context`. Flag naming convention mismatches (confidence >80%): `⚠ Convention advisory: {file_path} — project uses {pattern}`. Forward to executor prompts.
</step>
<!-- /section -->

<!-- section: discover_plans -->
<step name="discover_and_group_plans">
```bash
PLAN_INDEX=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs util:phase-plan-index "${PHASE_NUMBER}")
```

Parse: `plans[]`, `waves`, `incomplete`, `has_checkpoints`. Skip plans with `has_summary: true`. If `GAPS_ONLY=true`: also skip non-gap_closure plans.

Report execution plan table: Wave | Plans | What it builds.
</step>
<!-- /section -->

<!-- section: visualize_execution -->
<step name="visualize_execution_plan">
Display ASCII wave/dependency diagram:
```
📊 Execution Plan:

Wave {N} {parallel|sequential}:
  ┌─ {plan_id}-PLAN.md ({objective, 5-8 words})
  └─ {plan_id}-PLAN.md ({objective, 5-8 words})

Dependencies:
  {plan_id} depends on: {depends_on list}
```
Use `┌─`/`├─`/`└─` for parallel, `──` for single-plan waves. Skip completed plans.
</step>
<!-- /section -->

<!-- section: execute_waves -->
<step name="execute_waves">
Execute each wave in sequence. Within a wave: parallel if `PARALLELIZATION=true`.

**Per wave:**
1. Preview + verify handoff contracts: `verify:handoff --preview` and `verify:agents --verify`
2. Describe what's being built (2-3 sentences from each plan's `<objective>`)
3. Choose execution mode:

**Mode A: Worktree-based parallel** (`worktree_enabled` + parallel + multi-plan wave)

  a. `execute:worktree create {plan_id}` for each plan. Fail → fall back to sequential.
  b. Inject codebase context (same as Mode B).
  c. Spawn in worktree dirs: `Task(subagent_type="bgsd-executor", model="{executor_model}", workdir="{worktree_path}", prompt="<objective>Execute plan {plan_number} of phase {phase_number}-{phase_name}. Running in worktree at {worktree_path}.</objective> Tool capability: {capability_level} — agent receives full tool decisions via bgsd-context injection. ...same execution_context, files_to_read, codebase_context, success_criteria as Mode B...")`
  d. Monitor: check `{worktree_path}/.planning/phases/{phase_dir}/{plan_id}-SUMMARY.md`.
  e. Wait. Separate successes/failures.
  f. Sequential merge (smallest first): `execute:worktree merge {plan_id}`. Run test if configured. Conflicts → "Resolve manually" / "Skip plan" / "Abort wave". Yolo: skip, log.
  g. Cleanup: `execute:worktree cleanup`

**Mode B: Standard execution** (worktree disabled OR single-plan OR no parallelization)

  Before each executor, inject codebase context if available:
  ```bash
  PLAN_FILES=$(node bgsd-tools.cjs util:frontmatter "${PLAN_PATH}" --field files_modified 2>/dev/null)
  [ -n "$PLAN_FILES" ] && CODEBASE_CTX=$(node bgsd-tools.cjs util:codebase context --files ${PLAN_FILES} --plan ${PLAN_PATH} 2>/dev/null)
  ```

  Spawn:
  ```
  Task(
    subagent_type="bgsd-executor", model="{executor_model}",
    prompt="
      <objective>
      Execute plan {plan_number} of phase {phase_number}-{phase_name}.
      Commit each task atomically. Create SUMMARY.md. Update STATE.md and ROADMAP.md.
      </objective>

      <execution_context>
      @__OPENCODE_CONFIG__/bgsd-oc/workflows/execute-plan.md
      @__OPENCODE_CONFIG__/bgsd-oc/templates/summary.md
      Load checkpoints.md sections 'types' and 'guidelines' via extract-sections if plan has autonomous: false.
      Load tdd.md only if plan type is 'tdd'.
      </execution_context>

      Tool capability: {capability_level} — agent receives full tool decisions via bgsd-context injection.

      <files_to_read>
      - {phase_dir}/{plan_file} (Plan)
      - .planning/STATE.md (State)
      - .planning/config.json (Config, if exists)
      - ./AGENTS.md (Project instructions, if exists)
      </files_to_read>

      <codebase_context>
      {CODEBASE_CTX}
      </codebase_context>
      <!-- Include <codebase_context> ONLY if CODEBASE_CTX is non-empty. Omit entirely if unavailable. -->

      <success_criteria>
      - [ ] All tasks executed
      - [ ] Each task committed individually
      - [ ] SUMMARY.md created in plan directory
      - [ ] STATE.md updated with position and decisions
      - [ ] ROADMAP.md updated with plan progress
      </success_criteria>
    "
  )
  ```

4. **Spot-check:** Verify first 2 files from `key-files.created`. `git log --oneline --all --grep="{phase}-{plan}"` ≥1 commit. Check for `## Self-Check: FAILED`. Fail → report, ask "Retry?" or "Continue?".

5. **Failures:** `classifyHandoffIfNeeded` error → spot-check; if pass → treat as success. Real failures → report → ask continue/stop.

6. Execute checkpoint plans between waves — see `checkpoint_handling`.

7. Proceed to next wave.
</step>
<!-- /section -->

<!-- section: checkpoint_handling -->
<step name="checkpoint_handling">
Plans with `autonomous: false` require user interaction.

**Auto-mode** (`config-get workflow.auto_advance`):
- human-verify → auto-approve, log `⚡ Auto-approved checkpoint`
- decision → auto-select first option, log `⚡ Auto-selected: [option]`
- human-action → present to user (can't automate auth gates)

**Standard flow:**
1. Spawn agent → runs until checkpoint → returns structured state
2. Present to user → user responds
3. Spawn continuation agent (NOT resume) with completed_tasks_table, resume_task, user_response
4. Continuation verifies previous commits, continues from resume point
5. Repeat until complete

Parallel checkpoints: agent pauses while others may complete. Present checkpoint, spawn continuation, wait for all before next wave.
</step>
<!-- /section -->

<!-- section: aggregate_results -->
<step name="aggregate_results">
After all waves, report:
- Waves/Plans complete count
- Wave status table
- Plan one-liners from SUMMARYs
- Aggregated issues (or "None")
</step>
<!-- /section -->

<!-- section: close_artifacts -->
<step name="close_parent_artifacts">
**Decimal/polish phases only (X.Y pattern).** Skip for whole-number phases.

1. Derive parent: `PARENT_PHASE="${PHASE_NUMBER%%.*}"`
2. Find parent UAT file via `find-phase`
3. Update gap statuses: `failed` → `resolved`
4. If all resolved: update UAT frontmatter status + timestamp
5. Move debug sessions to `.planning/debug/resolved/`
6. Commit updated artifacts
</step>
<!-- /section -->

<!-- section: ci_quality_gate if="ci_enabled" -->
<step name="ci_quality_gate">
<skill:ci-quality-gate scope="phase-${PHASE_NUMBER}" base_branch="${BASE_BRANCH:-main}" />
</step>
<!-- /section -->

<!-- section: verify_phase_goal -->
<step name="verify_phase_goal">
```
Task(
  prompt="Verify phase {phase_number} goal achievement.
Phase directory: {phase_dir}
Phase goal: {goal from ROADMAP.md}
Phase requirement IDs: {phase_req_ids}
Check must_haves against actual codebase.
Cross-reference requirement IDs from PLAN frontmatter against REQUIREMENTS.md.
Create VERIFICATION.md.",
  subagent_type="bgsd-verifier",
  model="{verifier_model}"
)
```

Read status from VERIFICATION.md:
- `passed` → update_roadmap
- `human_needed` → present items for human testing
- `gaps_found` → present gap summary, offer `/bgsd-plan-phase {X} --gaps`
</step>
<!-- /section -->

<!-- section: update_roadmap -->
<step name="update_roadmap">
```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:validate roadmap --repair 2>/dev/null
COMPLETION=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs plan:phase complete "${PHASE_NUMBER}")
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:commit "docs(phase-{X}): complete phase execution" --files .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md {phase_dir}/*-VERIFICATION.md
```
</step>
<!-- /section -->

<!-- section: offer_next -->
<step name="offer_next">
If `gaps_found`: skip (verify_phase_goal already presented gap-closure path).

**Auto-advance** (`--auto` OR `config-get workflow.auto_advance` true, AND verification passed): read and follow `transition.md` inline, passing `--auto`.

**Otherwise:** Workflow ends. User runs `/bgsd-progress` or invokes transition manually.
</step>
<!-- /section -->

</process>

<!-- section: resumption -->
<resumption>
Re-run `/bgsd-execute-phase {phase}` → discovers completed SUMMARYs → skips them → resumes from first incomplete plan.
</resumption>
<!-- /section -->

<!-- section: success_criteria -->
<success_criteria>
- All plans executed, all verifications pass
- Wave status and one-liners reported
- VERIFICATION.md created
- STATE.md and ROADMAP.md updated
</success_criteria>
<!-- /section -->
