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

Parse `<bgsd-context>` JSON for: `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `plans`, `incomplete_plans`, `plan_count`, `incomplete_count`, `parallelization`, `branching_strategy`, `branch_name`, `executor_model`, `verifier_model`, `verification_route` (from `decisions.verification-routing.value`), `commit_docs`, `pre_flight_validation`, `workspace_enabled`, `workspace_config`, `workspace_active`, `file_overlaps`, `handoff_tool_context`, `capability_level` (from `handoff_tool_context.capability_level`, may be `UNKNOWN`), `resume_summary`.

**`phase_number` is the authoritative phase — it comes from the user's argument as resolved by the bGSD plugin. Never infer or auto-select a different phase.**

**Phase number is required.** If `phase_number` is null or `phase_found` is false:
```
ERROR: Phase number required.
Usage: /bgsd-execute-phase <phase-number> [flags]
Example: /bgsd-execute-phase 92
Use /bgsd-inspect progress to see available phases.
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

<!-- section: handoff_gating -->
<step name="gate_chain_continuation">
Use `resume_summary` as the authoritative continuation contract whenever handoff state exists.

- If `resume_summary` is absent: standalone `/bgsd-execute-phase` works normally.
- If `resume_summary` is present and `latest_valid_step` is `plan` or `execute`: continue from the latest valid artifact instead of guessing from partial summaries, plan counts, or `STATE.md`.
- If `resume_summary.valid` is false: fail closed, present `repair_guidance`, and stop. Do not continue execution on missing or invalid chain state.
- If the newest artifact is corrupt but an older one is valid: trust the latest valid artifact, not the newest file blindly.
- If source drift is detected (`stale_sources` true or the latest artifact fingerprint no longer matches the refreshed phase snapshot's expected fingerprint): warn, rebuild from source, validate that the reconstructed state now matches the current expected fingerprint, and only then allow continuation.
- If the rebuild still cannot produce a valid handoff: stop with repair or restart guidance.
</step>
<!-- /section -->

<!-- section: handle_branching -->
<step name="handle_branching">
**Pre-computed decision:** Use `decisions.branch-handling` value (skip/create/update/use-existing) if present.

**Fallback:** If `branching_strategy` is `"none"`: skip. Otherwise:
```bash
jj bookmark create "$BRANCH_NAME" -r @ 2>/dev/null || jj bookmark set "$BRANCH_NAME" -r @
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

<step name="preflight_workspace_check">
Skip if `workspace_enabled` false. If overlaps within wave → display table (yolo: advisory, proceed; interactive: ask). Display workspace config summary. If `workspace_active` non-empty: display, consider cleanup.
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

**Mode A: Workspace-based parallel** (`workspace_enabled` + parallel + multi-plan wave)

  a. `workspace add {plan_id}` for each runnable plan in the wave so every plan gets its own managed JJ workspace. Fail → fall back to sequential.
  b. Inject codebase context (same as Mode B).
  c. Spawn in workspace dirs: `Task(subagent_type="bgsd-executor", model="{executor_model}", workdir="{workspace_path}", prompt="<objective>Execute plan {plan_number} of phase {phase_number}-{phase_name}. Running in JJ workspace at {workspace_path}.</objective> Tool capability: {capability_level} — agent receives full tool decisions via bgsd-context injection. ...same execution_context, files_to_read, codebase_context, success_criteria as Mode B...")`
  d. Monitor each workspace independently: check `{workspace_path}/.planning/phases/{phase_dir}/{plan_id}-SUMMARY.md`, track commit/summary status per workspace, and keep the plan → workspace mapping visible in wave reporting.
  e. Wait. Separate healthy/successful workspaces from failed or recovery-needed workspaces. Report partial-wave outcomes honestly instead of collapsing the whole wave into one success/failure bit.
  f. Sequential reconcile (smallest plan/workspace name first): run `workspace reconcile {plan_id}` for every completed workspace, use the returned status/recovery preview to reconcile healthy workspaces immediately, and leave stale/divergent/failed workspaces retained for inspection and recovery follow-up without blocking healthy siblings.
  g. Cleanup: keep failed or divergent workspaces during recovery work, and only let `workspace cleanup` remove obsolete failed workspaces after successful phase completion confirms they are no longer needed.

**Mode B: Standard execution** (workspace disabled OR single-plan OR no parallelization)

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

      Verification route: {verification_route}. Apply it as: `skip` = no extra broad-suite reruns beyond explicit plan checks, `light` = focused verification only, `full` = one broad regression gate at plan end or overall verification, never per edit.

      When changed deliverables include generated runtime artifacts (for example `plugin.js` or `bin/bgsd-tools.cjs`), verify against the repo-local current checkout plus the rebuilt local runtime in this repo. Never trust stale generated artifacts: run `npm run build`, then rerun the focused proof against the rebuilt local runtime before reporting success.

      If the phase exposes an explicit phase-intent block, require verification to report a separate Intent Alignment verdict before or alongside Requirement Coverage using the locked ladder `aligned | partial | misaligned`. If the core expected user change did not land, the verdict cannot be `partial`. If the phase lacks the explicit phase-intent block, require `not assessed` / unavailable wording with a plain reason instead of a guessed verdict.

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

4. **Spot-check:** Verify first 2 files from `key-files.created`. `jj log --no-graph -T 'change_id.shortest(8) ++ " " ++ description.first_line() ++ "\n"' | grep "{phase}-{plan}"` ≥1 commit. Check for `## Self-Check: FAILED`. Fail → report, ask "Retry?" or "Continue?".

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
2. Present to user → user responds using questionTemplate() options:
   - human-verify: `questionTemplate('execute-checkpoint-verify', 'SINGLE_CHOICE')` → Pass / Fail / Needs adjustment
   - spot-check failures: `questionTemplate('execute-checkpoint-retry', 'SINGLE_CHOICE')` → Retry / Continue / Skip
   - wave completion: `questionTemplate('execute-wave-continue', 'SINGLE_CHOICE')` → Proceed to next wave / Review current / Pause
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

Before verification or any fresh-context continuation, write or refresh the durable `execute` handoff artifact:

```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:state handoff write \
  --phase "${PHASE_NUMBER}" \
  --step execute \
  --summary "Execution complete for Phase ${PHASE_NUMBER}" \
  --next-command "/bgsd-verify-work ${PHASE_NUMBER}"
```

If the phase already produced canonical `*-TDD-AUDIT.json` proof sidecars, the shared handoff runtime preserves deterministic proof metadata in `context` automatically so resume inspection, the execute → verify boundary, and downstream summary rendering do not silently drop TDD evidence.
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
Assess intent alignment as a separate judgment from requirement coverage using the active phase intent when available.
Use the locked verdict ladder `aligned | partial | misaligned`; if the core expected user change missed, force `misaligned`.
If no explicit phase-intent block exists, report intent alignment as `not assessed` / unavailable with a plain reason instead of guessing.
Surface Intent Alignment before or alongside Requirement Coverage in VERIFICATION.md.
Cross-reference requirement IDs from PLAN frontmatter against REQUIREMENTS.md.
Create VERIFICATION.md.",
  subagent_type="bgsd-verifier",
  model="{verifier_model}"
)
```

Read status from VERIFICATION.md:
- `passed` → update_roadmap
- `human_needed` → present items for human testing
- `gaps_found` → present gap summary, offer `/bgsd-plan gaps {X}`
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

**Otherwise:** Workflow ends. User runs `/bgsd-inspect progress` or invokes transition manually. `transition.md` now includes an advisory lessons review block that surfaces recent lesson captures plus `lessons:suggest` optimization guidance before the next-phase handoff.
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
