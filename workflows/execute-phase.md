<purpose>
Execute all plans in a phase using wave-based parallel execution. Orchestrator stays lean — delegates plan execution to subagents.
</purpose>

<core_principle>
Orchestrator coordinates, not executes. Each subagent loads the full execute-plan context with fresh 200k context. Orchestrator: discover → deps → waves → spawn → checkpoints → results.
</core_principle>

<required_reading>
Read STATE.md before starting.
</required_reading>

<process>

<step name="initialize" priority="first">
**Context:** This workflow receives project context via `<bgsd-context>` auto-injected by the bGSD plugin's `command.execute.before` hook. If no `<bgsd-context>` block is present, the plugin is not loaded.

**If no `<bgsd-context>` found:** Stop and tell the user: "bGSD plugin required for v9.0. Install with: npx bgsd-oc"

Parse PHASE_ARG to extract phase number and flags:

- Extract first numeric argument as PHASE_NUMBER
- GAPS_ONLY defaults to false — only set true if the literal string `--gaps-only` appears in PHASE_ARG

```bash
# Extract phase number (first numeric argument) and flags from PHASE_ARG
if [[ "$PHASE_ARG" =~ ^([0-9]+) ]]; then
  PHASE_NUMBER="${BASH_REMATCH[1]}"
elif [[ "$PHASE_ARG" =~ ^([0-9]+\.[0-9]+) ]]; then
  PHASE_NUMBER="${BASH_REMATCH[1]}"
else
  echo "ERROR: Invalid phase number: $PHASE_ARG"
  exit 1
fi

# GAPS_ONLY is false unless the user explicitly passed --gaps-only
# Do NOT infer gaps-only from context — only from the literal flag in PHASE_ARG
GAPS_ONLY="false"
if [[ "$PHASE_ARG" == *"--gaps-only"* ]]; then
  GAPS_ONLY="true"
fi

# CI quality gate flag: --ci forces CI, --no-ci skips it, otherwise check config
CI_FLAG=""
if [[ "$PHASE_ARG" == *"--ci"* ]] && [[ "$PHASE_ARG" != *"--no-ci"* ]]; then
  CI_FLAG="force"
elif [[ "$PHASE_ARG" == *"--no-ci"* ]]; then
  CI_FLAG="skip"
fi
```

Parse `<bgsd-context>` JSON for: `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `plans`, `incomplete_plans`, `plan_count`, `incomplete_count`, `parallelization`, `branching_strategy`, `branch_name`, `executor_model`, `verifier_model`, `commit_docs`, `pre_flight_validation`, `worktree_enabled`, `worktree_config`, `worktree_active`, `file_overlaps`.

If `phase_found` false or `plan_count` 0 → error. No STATE.md but `.planning/` exists → offer reconstruct. `parallelization` false → sequential execution.
</step>

<step name="handle_branching">
If `branching_strategy` is `"none"`: skip.
Otherwise use pre-computed `branch_name`:
```bash
git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"
```
</step>

<step name="validate_phase">
Report: "Found {plan_count} plans in {phase_dir} ({incomplete_count} incomplete)"
</step>

<step name="preflight_dependency_check">
```bash
DEPS=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:validate-dependencies "${PHASE_NUMBER}" 2>/dev/null)
```

Parse for `valid` (bool) and `issues` (array). If valid or command fails: continue silently.

If issues found — yolo/auto: log warning, proceed. Interactive: present issues, ask proceed/stop.
</step>

<step name="preflight_state_validation">
If `pre_flight_validation` is false (from init JSON) or `--skip-validate` flag: skip silently.

Otherwise, run auto-fix first, then validate:

```bash
# Auto-fix what we can
FIX_RESULT=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:state validate --fix 2>/dev/null)
# Then check for remaining issues
VALIDATE_RESULT=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:state validate 2>/dev/null)
```

Parse `FIX_RESULT` for `fixes_applied` array. If non-empty: display "Pre-flight auto-fixed: {count} issue(s)".

Parse `VALIDATE_RESULT` for `status` field:
- `"clean"`: Display "Pre-flight: OK" and continue
- `"warnings"`: Display warning table, continue execution
- `"errors"`: Display error table. In yolo/auto mode: display errors but continue with warning banner. In interactive mode: ask user to fix or proceed with `--skip-validate`.

Error classification:
- position errors + count mismatches = "error" (blocking in interactive)
- staleness = "warn" (non-blocking)

Display format when issues exist:

```
| Type | Location | Expected | Actual | Severity |
```
</step>

<step name="preflight_worktree_check">
If `worktree_enabled` is false from init JSON: skip silently.

Otherwise:

1. Check `file_overlaps` from init JSON. If overlaps exist within a wave:
   - Display overlap table:

   ```
   | Plan A   | Plan B   | Shared Files              | Wave |
   | -------- | -------- | ------------------------- | ---- |
   | {plan_a} | {plan_b} | {files, comma-separated}  | {N}  |
   ```

   - In yolo/auto mode: log warning `⚠ File overlaps detected (advisory) — merge-tree will catch real conflicts`, proceed
   - In interactive mode: ask "Proceed with overlap risk?" or "Adjust wave grouping?"

2. Display worktree config summary:

   ```
   ◆ Worktree parallelism: enabled
     Base: {worktree_config.base_path}
     Max concurrent: {worktree_config.max_concurrent}
     Active worktrees: {worktree_active.length}
     File overlaps: {file_overlaps.length} (advisory)
   ```

3. If `worktree_active` is non-empty: display active worktree table. Consider whether stale worktrees should be cleaned first.
</step>

<step name="preflight_convention_check">
Advisory naming convention check (never blocks execution).

1. **Collect files** from all incomplete plans via `frontmatter --field files_modified`, deduplicate.
2. **Run** `codebase context --files ${ALL_FILES}`. If fails/empty: skip silently.
3. **Flag** files where detected `conventions.naming.pattern` differs from file path and `confidence` > 80%.
4. **Display** advisory: `⚠ Convention advisory: {file_path} — project uses {pattern} ({confidence}%)`. No output if no mismatches.
5. **Forward** warnings to executor spawn prompts' `<codebase_context>` block.
</step>

<step name="discover_and_group_plans">
```bash
PLAN_INDEX=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs util:phase-plan-index "${PHASE_NUMBER}")
```

Parse: `plans[]` (id, wave, autonomous, objective, task_count, has_summary), `waves`, `incomplete`, `has_checkpoints`.

Skip plans with `has_summary: true`. If GAPS_ONLY=true: also skip non-gap_closure plans (check frontmatter for `gap_closure: true`).

Report execution plan table: Wave | Plans | What it builds.
</step>

<step name="visualize_execution_plan">
Display ASCII wave/dependency diagram from `$PLAN_INDEX`:

```
📊 Execution Plan:

Wave {N} {parallel|sequential}:
  ┌─ {plan_id}-PLAN.md ({objective, 5-8 words})
  └─ {plan_id}-PLAN.md ({objective, 5-8 words})

Dependencies:
  {plan_id} depends on: {depends_on list}
```

Use `┌─`/`├─`/`└─` for parallel plans, `──` for single-plan waves. Skip completed plans.
</step>

<step name="execute_waves">
Execute each wave in sequence. Within a wave: parallel if `PARALLELIZATION=true`.

**For each wave:**

1. **Describe what's being built** — read each plan's `<objective>`, extract what/why in 2-3 sentences.

2. **Choose execution mode** based on `worktree_enabled` AND wave has >1 plan AND `PARALLELIZATION=true`:

   **Mode A: Worktree-based parallel execution** (worktree_enabled + parallel + multi-plan wave)

   a. **Create worktrees** for each plan in wave:
      ```bash
      node bgsd-tools.cjs execute:worktree create {plan_id}
      ```
      Record each worktree path from output. If create fails (e.g., max_concurrent), fall back to sequential.
      If setup_status is `failed`: skip that plan, mark as setup-failed, continue with remaining.

   b. **Inject codebase context** (same as Mode B):
      ```bash
PLAN_FILES=$(node bgsd-tools.cjs util:frontmatter "${PLAN_PATH}" --field files_modified 2>/dev/null)
if [ -n "$PLAN_FILES" ]; then
  CODEBASE_CTX=$(node bgsd-tools.cjs util:codebase context --files ${PLAN_FILES} --plan ${PLAN_PATH} 2>/dev/null)
      fi
      ```
      If `CODEBASE_CTX` is non-empty, include the `<codebase_context>` block in the spawn prompt. If commands fail or return empty, omit the block entirely (graceful no-op).

   c. **Spawn executor agents** in worktree directories:
      ```
      Task(
        subagent_type="bgsd-executor",
        model="{executor_model}",
        workdir="{worktree_path}",
        prompt="
          <objective>
          Execute plan {plan_number} of phase {phase_number}-{phase_name}.
          Commit each task atomically. Create SUMMARY.md. Update STATE.md and ROADMAP.md.
          NOTE: You are running in a worktree at {worktree_path}. All file operations use this directory.
          </objective>
          ...same execution_context, files_to_read as Mode B...

          <codebase_context>
          Architectural context for files this plan modifies.
          Use this to understand import relationships, naming conventions, and risk levels.

          {CODEBASE_CTX}
          </codebase_context>
          <!-- Include <codebase_context> block ONLY if CODEBASE_CTX is non-empty. Omit entirely if codebase intel unavailable. -->

          ...same success_criteria as Mode B...
        "
      )
      ```

   d. **Monitor progress** — after spawning all agents, periodically display:
      ```
      ◆ Wave {N} progress:
        ┌─ {plan_id}: ◆ running ({elapsed}m)
        ├─ {plan_id}: ✓ complete (SUMMARY.md found)
        └─ {plan_id}: ◆ running ({elapsed}m)
      ```
      Detection: check if `{worktree_path}/.planning/phases/{phase_dir}/{plan_id}-SUMMARY.md` exists.

   e. **Wait for all agents** — collect results from all Task() returns.
      Let all agents finish even if one fails (per CONTEXT.md decision).
      Separate: successes (SUMMARY.md exists in worktree) and failures.

   f. **Sequential merge** — for each completed plan (in plan-number order, smallest first):
      ```bash
      node bgsd-tools.cjs execute:worktree merge {plan_id}
      ```
      After EACH merge: run test command if configured in config.json (`test_command` field).
      If merge fails (real conflicts): offer options:
        - "Resolve manually" → present conflicting files, wait for user to fix, type "done"
        - "Skip this plan" → mark plan as merge-failed, continue to next
        - "Abort wave" → stop merging, report what succeeded
      In yolo/auto mode: skip conflicting plan, log warning, continue.

   g. **Cleanup** — after all merges (or failure handling):
      ```bash
      node bgsd-tools.cjs execute:worktree cleanup
      ```

   h. **Continue** to next wave.

   **Mode B: Standard execution** (worktree_enabled false OR single-plan wave OR parallelization false)

   **Before spawning each executor**, inject codebase context if available:
   ```bash
   PLAN_FILES=$(node bgsd-tools.cjs util:frontmatter "${PLAN_PATH}" --field files_modified 2>/dev/null)
   if [ -n "$PLAN_FILES" ]; then
     CODEBASE_CTX=$(node bgsd-tools.cjs util:codebase context --files ${PLAN_FILES} --plan ${PLAN_PATH} 2>/dev/null)
   fi
   ```
   If `CODEBASE_CTX` is non-empty, include the `<codebase_context>` block below. If the commands fail or return empty, omit the block entirely (graceful no-op).

   Spawn executor agents in main working directory:

   ```
   Task(
     subagent_type="bgsd-executor",
     model="{executor_model}",
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

       <files_to_read>
       Read these files at execution start using the Read tool:
       - {phase_dir}/{plan_file} (Plan)
       - .planning/STATE.md (State)
       - .planning/config.json (Config, if exists)
       - ./AGENTS.md (Project instructions, if exists)
       </files_to_read>

       <codebase_context>
       Architectural context for files this plan modifies.
       Use this to understand import relationships, naming conventions, and risk levels.

       {CODEBASE_CTX}
       </codebase_context>
       <!-- Include <codebase_context> block ONLY if CODEBASE_CTX is non-empty. Omit entirely if codebase intel unavailable. -->

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

3. **Wait** for all agents in wave to complete.

4. **Spot-check claims:**
   - Verify first 2 files from `key-files.created` exist on disk
   - `git log --oneline --all --grep="{phase}-{plan}"` returns ≥1 commit
   - Check for `## Self-Check: FAILED` marker

   If spot-check fails: report which plan, ask "Retry?" or "Continue?".
   If pass: report what was built from SUMMARY.md.

5. **Handle failures:**
   - **classifyHandoffIfNeeded bug:** If agent reports "failed" with `classifyHandoffIfNeeded is not defined` → runtime bug, not bGSD. Spot-check; if pass → treat as success.
   - Real failures: report → ask continue/stop → dependent plans may also fail.

6. **Execute checkpoint plans** between waves — see `checkpoint_handling`.

7. **Proceed to next wave.**
</step>

<step name="checkpoint_handling">
Plans with `autonomous: false` require user interaction.

**Auto-mode** (`config-get workflow.auto_advance`):
- human-verify → auto-approve, log `⚡ Auto-approved checkpoint`
- decision → auto-select first option, log `⚡ Auto-selected: [option]`
- human-action → present to user (auth gates can't be automated)

**Standard flow:**
1. Spawn agent → runs until checkpoint → returns structured state (completed tasks table, current task, checkpoint details, what's awaited)
2. Present to user
3. User responds
4. **Spawn continuation agent** (NOT resume) with completed_tasks_table, resume_task, user_response
5. Continuation verifies previous commits, continues from resume point
6. Repeat until plan completes

Checkpoints in parallel waves: agent pauses while others may complete. Present checkpoint, spawn continuation, wait for all before next wave.
</step>

<step name="aggregate_results">
After all waves, report:
- Waves/Plans complete count
- Wave status table
- Plan one-liners from SUMMARYs
- Aggregated issues (or "None")
</step>

<step name="close_parent_artifacts">
**Decimal/polish phases only (X.Y pattern).** Skip for whole-number phases.

1. Derive parent: `PARENT_PHASE="${PHASE_NUMBER%%.*}"`
2. Find parent UAT file via `find-phase`
3. Update gap statuses: `failed` → `resolved`
4. If all gaps resolved: update UAT frontmatter status + timestamp
5. Move resolved debug sessions to `.planning/debug/resolved/`
6. Commit updated artifacts
</step>

<step name="ci_quality_gate">
**Optional CI quality gate — push, PR, code scanning, fix loop, auto-merge.**

Determine if CI gate should run using `CI_FLAG` from initialize step:
- `CI_FLAG="force"` → run CI regardless of config
- `CI_FLAG="skip"` → skip CI regardless of config
- `CI_FLAG=""` → check config:

```bash
CI_ENABLED=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs util:config-get workflow.ci_gate 2>/dev/null || echo "false")
```

**If CI enabled:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 bGSD ► CI QUALITY GATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
◆ Pushing branch, creating PR, running code scanning...
```

```
Task(
  prompt="
Run the GitHub CI quality gate.

<ci_parameters>
BRANCH_NAME: ci/phase-${PHASE_NUMBER}
BASE_BRANCH: ${BASE_BRANCH:-main}
AUTO_MERGE: true
SCOPE: phase-${PHASE_NUMBER}
</ci_parameters>

<files_to_read>
- .planning/STATE.md
- ./AGENTS.md (if exists)
</files_to_read>
",
  subagent_type="bgsd-github-ci",
  model="{executor_model}",
  description="GitHub CI: phase-${PHASE_NUMBER}"
)
```

**Handle CI result:**
- `## CI COMPLETE` with `Status: merged` → continue to verify_phase_goal (code is now on base branch)
- `## CHECKPOINT REACHED` with `human-action` → present to user, wait for resolution, then continue
- `## CHECKPOINT REACHED` with `human-verify` → present remaining alerts, offer: 1) Dismiss and merge, 2) Abort CI (continue without merge)

**If CI disabled:** Skip silently, continue to verify_phase_goal.
</step>

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

<step name="update_roadmap">
```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:validate roadmap --repair 2>/dev/null
COMPLETION=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs plan:phase complete "${PHASE_NUMBER}")
```

CLI handles: phase checkbox, Progress table, plan count, STATE.md advance, REQUIREMENTS.md traceability.
Note: `validate roadmap --repair` ensures checklist/section parity before phase completion, preventing false `is_last_phase` detection.

```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:commit "docs(phase-{X}): complete phase execution" --files .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md {phase_dir}/*-VERIFICATION.md
```
</step>

<step name="offer_next">
If `gaps_found`: skip (verify_phase_goal already presented gap-closure path).

**Auto-advance** (`--auto` flag OR `config-get workflow.auto_advance` true, AND verification passed):
Read and follow `transition.md` inline, passing `--auto` flag.

**Otherwise:** Workflow ends. User runs `/bgsd-progress` or invokes transition manually.
</step>

</process>

<resumption>
Re-run `/bgsd-execute-phase {phase}` → discovers completed SUMMARYs → skips them → resumes from first incomplete plan.
</resumption>
