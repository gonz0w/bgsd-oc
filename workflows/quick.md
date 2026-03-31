<purpose>
Execute small ad-hoc tasks with bGSD guarantees. Spawns planner + executor, tracks in `.planning/quick/`. `--full` adds plan-checking (max 2 iterations) and verification.
</purpose>

<process>

<!-- section: parse_args -->
**Step 1: Parse arguments**

| Flag | Effect |
|------|--------|
| `--full` | `$FULL_MODE=true` (enables plan-check + verify) |
| `--ci` | Force CI gate |
| `--no-ci` | Skip CI gate |

Remaining text → `$DESCRIPTION`. If empty, prompt. If still empty, re-prompt.
If `$FULL_MODE`: banner `bGSD ► QUICK TASK (FULL MODE)`.
<!-- /section -->

<!-- section: initialize -->
**Step 2: Initialize**

<skill:bgsd-context-init />

Extract: `planner_model`, `executor_model`, `checker_model`, `verifier_model`, `commit_docs`, `next_num`, `slug`, `date`, `quick_dir`, `roadmap_exists`. If `roadmap_exists` false: error.
<!-- /section -->

<!-- section: create_task_dir -->
**Step 3: Create task directory**

```bash
QUICK_DIR=".planning/quick/${next_num}-${slug}"
mkdir -p "$QUICK_DIR"
```

Report: `Creating quick task ${next_num}: ${DESCRIPTION} — Directory: ${QUICK_DIR}`
<!-- /section -->

<!-- section: spawn_planner -->
**Step 4: Spawn planner**

```
Task(
  prompt="Mode: ${FULL_MODE?'quick-full':'quick'} | Dir: ${QUICK_DIR} | Task: ${DESCRIPTION}
Read: .planning/STATE.md, AGENTS.md, .agents/skills/
SINGLE plan, 1-3 tasks, no research. ${FULL_MODE?'~40% context, must_haves required (truths/artifacts/key_links). Each task: files/action/verify/done.':'~30% context.'}
Write: ${QUICK_DIR}/${next_num}-PLAN.md | Return: ## PLANNING COMPLETE",
  subagent_type="bgsd-planner",
  model="{planner_model}",
  description="Quick plan: ${DESCRIPTION}"
)
```

Verify plan exists. If not found, error.
<!-- /section -->

<!-- section: plan_checker -->
**Step 4.5: Plan-checker (--full only)**

Skip if NOT `$FULL_MODE`.

```
Task(
  prompt="Check ${QUICK_DIR}/${next_num}-PLAN.md for task: ${DESCRIPTION}. Verify: coverage, files/action/verify/done, key links, 1-3 task scope, must_haves. Skip ROADMAP checks. Return ## VERIFICATION PASSED or ## ISSUES FOUND.",
  subagent_type="bgsd-plan-checker",
  model="{checker_model}",
  description="Check quick plan: ${DESCRIPTION}"
)
```

- `## VERIFICATION PASSED` → Step 5
- `## ISSUES FOUND` → revision loop (max 2):

```
Task(
  prompt="Read __OPENCODE_CONFIG__/agents/bgsd-planner.md. Revise ${QUICK_DIR}/${next_num}-PLAN.md. Issues: ${structured_issues}. Targeted updates only, do NOT replan. Return what changed. Before returning, perform one lessons reflection using the existing lessons subsystem: review your full subagent-visible conversation and tool history for one durable prompt, workflow, tooling, or agent-behavior improvement; if found, capture at most one structured lesson with `bgsd-tools lessons:capture`.",
  subagent_type="general",
  model="{planner_model}",
  description="Revise quick plan: ${DESCRIPTION}"
)
```

Re-run checker. If iteration_count >= 2: show issues, offer 1) Force proceed, 2) Abort.
<!-- /section -->

<!-- section: spawn_executor -->
**Step 5: Spawn executor**

```
Task(
  prompt="Execute quick task ${next_num}: ${DESCRIPTION}
Read: ${QUICK_DIR}/${next_num}-PLAN.md, .planning/STATE.md, AGENTS.md, .agents/skills/
Execute all tasks atomically. Summary: ${QUICK_DIR}/${next_num}-SUMMARY.md. Do NOT update ROADMAP.md.",
  subagent_type="bgsd-executor",
  model="{executor_model}",
  description="Execute: ${DESCRIPTION}"
)
```

Verify summary exists. `classifyHandoffIfNeeded` error → check summary + git log; if present, treat as success.
<!-- /section -->

<!-- section: ci_quality_gate if="ci_enabled" -->
**Step 5.25: CI quality gate (optional)**

```bash
CI_ENABLED=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs util:config-get workflow.ci_gate 2>/dev/null || echo "false")
```

Run if CI enabled or `--ci` flag. Skip if `--no-ci`.

<skill:ci-quality-gate scope="quick-${next_num}" base_branch="main" auto_merge="true" />
<!-- /section -->

<!-- section: verification -->
**Step 5.5: Verification (--full only)**

Skip if NOT `$FULL_MODE`. Banner: `bGSD ► VERIFYING RESULTS`

```
Task(
  prompt="Verify quick task: ${DESCRIPTION}. Read: ${QUICK_DIR}/${next_num}-PLAN.md. Check must_haves vs codebase. Create: ${QUICK_DIR}/${next_num}-VERIFICATION.md.",
  subagent_type="bgsd-verifier",
  model="{verifier_model}",
  description="Verify: ${DESCRIPTION}"
)
```

Check status: `grep "^status:" "${QUICK_DIR}/${next_num}-VERIFICATION.md" | cut -d: -f2 | tr -d ' '`

`passed`→Verified, continue | `human_needed`→display items, Needs Review, continue | `gaps_found`→show gaps, offer re-run or accept.
<!-- /section -->

<!-- section: update_state -->
**Step 6: Update STATE.md**

Find/create `### Quick Tasks Completed` (after `### Blockers/Concerns`). Full mode: 6-col table (#+Desc+Date+Commit+Status+Dir); standard: 5-col. Match existing format. Append row. Update last activity.
<!-- /section -->

<!-- section: final_commit -->
**Step 7: Final commit**

```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:commit "docs(quick-${next_num}): ${DESCRIPTION}" --files ${file_list}
```

Files: PLAN.md + SUMMARY.md + STATE.md (+ full: VERIFICATION.md). Print completion banner.
<!-- /section -->

</process>

<!-- section: success_criteria -->
<success_criteria>
- [ ] User provides task description; `--full` parsed
- [ ] Directory created at `.planning/quick/NNN-slug/`
- [ ] PLAN.md created by planner; (--full) checker validates (≤2 iterations)
- [ ] SUMMARY.md created by executor; (--full) VERIFICATION.md created
- [ ] STATE.md updated; artifacts committed
</success_criteria>
<!-- /section -->
