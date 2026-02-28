<purpose>
Execute small ad-hoc tasks with bGSD guarantees (atomic commits, STATE.md tracking). Spawns planner + executor, tracks in `.planning/quick/`. With `--full`: adds plan-checking (max 2 iterations) and verification.
</purpose>

<required_reading>
Read all execution_context files before starting.
</required_reading>

<process>
**Step 1: Parse arguments and get task description**

Parse `$ARGUMENTS` for `--full` flag → `$FULL_MODE` (true/false). Remaining text → `$DESCRIPTION`.

If `$DESCRIPTION` empty, prompt:
```
question(header: "Quick Task", question: "What do you want to do?", followUp: null)
```
If still empty, re-prompt: "Please provide a task description."

If `$FULL_MODE`:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 bGSD ► QUICK TASK (FULL MODE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
◆ Plan checking + verification enabled
```

---

**Step 2: Initialize**

```bash
INIT=$(node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs init quick "$DESCRIPTION" --compact)
```

Parse JSON for: `planner_model`, `executor_model`, `checker_model`, `verifier_model`, `commit_docs`, `next_num`, `slug`, `date`, `timestamp`, `quick_dir`, `task_dir`, `roadmap_exists`, `planning_exists`.

**If `roadmap_exists` false:** Error — run `/gsd-new-project` first.

---

**Step 3: Create task directory**

```bash
QUICK_DIR=".planning/quick/${next_num}-${slug}"
mkdir -p "$QUICK_DIR"
```

Report: `Creating quick task ${next_num}: ${DESCRIPTION} — Directory: ${QUICK_DIR}`

---

**Step 4: Spawn planner (quick mode)**

```
Task(
  prompt="
<planning_context>
**Mode:** ${FULL_MODE ? 'quick-full' : 'quick'}
**Directory:** ${QUICK_DIR}
**Description:** ${DESCRIPTION}

<files_to_read>
- .planning/STATE.md
- ./AGENTS.md (if exists)
</files_to_read>

**Project skills:** Check .agents/skills/ (if exists) — read SKILL.md files
</planning_context>

<constraints>
- SINGLE plan, 1-3 focused tasks, no research phase
${FULL_MODE ? '- Target ~40% context, generate must_haves (truths, artifacts, key_links)' : '- Target ~30% context (simple, focused)'}
${FULL_MODE ? '- Each task MUST have files, action, verify, done fields' : ''}
</constraints>

<output>
Write plan to: ${QUICK_DIR}/${next_num}-PLAN.md
Return: ## PLANNING COMPLETE with plan path
</output>
",
  subagent_type="gsd-planner",
  model="{planner_model}",
  description="Quick plan: ${DESCRIPTION}"
)
```

Verify plan exists at `${QUICK_DIR}/${next_num}-PLAN.md`. If not found, error.

---

**Step 4.5: Plan-checker loop (only when `$FULL_MODE`)**

Skip if NOT `$FULL_MODE`.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 bGSD ► CHECKING PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
◆ Spawning plan checker...
```

```
Task(
  prompt="
<verification_context>
**Mode:** quick-full
**Task Description:** ${DESCRIPTION}

<files_to_read>
- ${QUICK_DIR}/${next_num}-PLAN.md
</files_to_read>

**Scope:** Quick task — skip ROADMAP phase goal checks.
</verification_context>

<check_dimensions>
- Requirement coverage, task completeness (files/action/verify/done), key links real, scope sanity (1-3 tasks), must_haves traceable
- Skip: context compliance, cross-plan deps, ROADMAP alignment
</check_dimensions>

<expected_output>
## VERIFICATION PASSED or ## ISSUES FOUND (structured list)
</expected_output>
",
  subagent_type="gsd-plan-checker",
  model="{checker_model}",
  description="Check quick plan: ${DESCRIPTION}"
)
```

**Handle return:**
- `## VERIFICATION PASSED` → proceed to Step 5
- `## ISSUES FOUND` → revision loop (max 2 iterations)

**Revision loop:** If iteration_count < 2, re-spawn planner with issues:

```
Task(
  prompt="First, read __OPENCODE_CONFIG__/agents/gsd-planner.md for your role.\n\n
<revision_context>
**Mode:** quick-full (revision)
<files_to_read>
- ${QUICK_DIR}/${next_num}-PLAN.md
</files_to_read>
**Checker issues:** ${structured_issues}
</revision_context>
Make targeted updates. Do NOT replan from scratch. Return what changed.",
  subagent_type="general",
  model="{planner_model}",
  description="Revise quick plan: ${DESCRIPTION}"
)
```

After revision → re-run checker, increment iteration_count. If >= 2: show remaining issues, offer: 1) Force proceed, 2) Abort.

---

**Step 5: Spawn executor**

```
Task(
  prompt="
Execute quick task ${next_num}.

<files_to_read>
- ${QUICK_DIR}/${next_num}-PLAN.md
- .planning/STATE.md
- ./AGENTS.md (if exists)
- .agents/skills/ (if exists — list skills, read SKILL.md, follow relevant rules)
</files_to_read>

<constraints>
- Execute all tasks, commit each atomically
- Create summary at: ${QUICK_DIR}/${next_num}-SUMMARY.md
- Do NOT update ROADMAP.md
</constraints>
",
  subagent_type="gsd-executor",
  model="{executor_model}",
  description="Execute: ${DESCRIPTION}"
)
```

Verify summary exists. If executor reports "failed" with `classifyHandoffIfNeeded` error — check summary file + git log; if present, treat as successful.

---

**Step 5.5: Verification (only when `$FULL_MODE`)**

Skip if NOT `$FULL_MODE`.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 bGSD ► VERIFYING RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
◆ Spawning verifier...
```

```
Task(
  prompt="Verify quick task goal achievement.
Task directory: ${QUICK_DIR}
Task goal: ${DESCRIPTION}

<files_to_read>
- ${QUICK_DIR}/${next_num}-PLAN.md
</files_to_read>

Check must_haves against codebase. Create VERIFICATION.md at ${QUICK_DIR}/${next_num}-VERIFICATION.md.",
  subagent_type="gsd-verifier",
  model="{verifier_model}",
  description="Verify: ${DESCRIPTION}"
)
```

Read verification status:
```bash
grep "^status:" "${QUICK_DIR}/${next_num}-VERIFICATION.md" | cut -d: -f2 | tr -d ' '
```

| Status | Action |
|--------|--------|
| `passed` | `VERIFICATION_STATUS = "Verified"`, continue |
| `human_needed` | Display items, `VERIFICATION_STATUS = "Needs Review"`, continue |
| `gaps_found` | Display gaps, offer: 1) Re-run executor, 2) Accept. `VERIFICATION_STATUS = "Gaps"` |

---

**Step 6: Update STATE.md**

**6a.** Check for `### Quick Tasks Completed` section in STATE.md.

**6b.** If missing, insert after `### Blockers/Concerns`:

Full mode table: `| # | Description | Date | Commit | Status | Directory |`
Standard table: `| # | Description | Date | Commit | Directory |`

If table exists, match its column format. If adding --full to project with existing headerless-Status table, add Status column.

**6c.** Append row with `next_num`, `DESCRIPTION`, `date`, `commit_hash`, (optional `VERIFICATION_STATUS`), directory link.

**6d.** Update last activity: `Last activity: ${date} - Completed quick task ${next_num}: ${DESCRIPTION}`

---

**Step 7: Final commit and completion**

Build file list: `${QUICK_DIR}/${next_num}-PLAN.md`, `${QUICK_DIR}/${next_num}-SUMMARY.md`, `.planning/STATE.md`, (if full mode: `${QUICK_DIR}/${next_num}-VERIFICATION.md`)

```bash
node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs commit "docs(quick-${next_num}): ${DESCRIPTION}" --files ${file_list}
commit_hash=$(git rev-parse --short HEAD)
```

**If `$FULL_MODE`:**
```
bGSD > QUICK TASK COMPLETE (FULL MODE)
Quick Task ${next_num}: ${DESCRIPTION}
Summary: ${QUICK_DIR}/${next_num}-SUMMARY.md
Verification: ${QUICK_DIR}/${next_num}-VERIFICATION.md (${VERIFICATION_STATUS})
Commit: ${commit_hash}
Ready for next task: /gsd-quick
```

**If NOT `$FULL_MODE`:**
```
bGSD > QUICK TASK COMPLETE
Quick Task ${next_num}: ${DESCRIPTION}
Summary: ${QUICK_DIR}/${next_num}-SUMMARY.md
Commit: ${commit_hash}
Ready for next task: /gsd-quick
```
</process>

<success_criteria>
- [ ] ROADMAP.md validation passes
- [ ] User provides task description
- [ ] `--full` flag parsed when present
- [ ] Directory created at `.planning/quick/NNN-slug/`
- [ ] `${next_num}-PLAN.md` created by planner
- [ ] (--full) Plan checker validates, revision loop capped at 2
- [ ] `${next_num}-SUMMARY.md` created by executor
- [ ] (--full) `${next_num}-VERIFICATION.md` created by verifier
- [ ] STATE.md updated with quick task row
- [ ] Artifacts committed
</success_criteria>
