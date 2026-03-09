<purpose>
Run GitHub CI quality gate: push branch, create PR, monitor code scanning checks, fix issues, and auto-merge. Callable standalone or as post-execution step.
</purpose>

<required_reading>
Read STATE.md before starting.
</required_reading>

<process>

**Step 1: Parse arguments**

Parse `$ARGUMENTS` for optional flags:

- `--branch {name}` — Override branch name (default: auto-generated from scope)
- `--base {branch}` — Target branch (default: `main`)
- `--no-merge` — Skip auto-merge after checks pass
- `--scope {phase-plan or quick-N}` — Context identifier for naming

```bash
BRANCH_NAME=""
BASE_BRANCH="main"
AUTO_MERGE="true"
SCOPE=""

# Parse flags from $ARGUMENTS
# --branch value → BRANCH_NAME
# --base value → BASE_BRANCH
# --no-merge → AUTO_MERGE="false"
# --scope value → SCOPE
# Remaining text → DESCRIPTION
```

---

**Step 2: Validate prerequisites**

```bash
# Check gh CLI authentication
gh auth status 2>&1
```

If not authenticated, error with instructions:
```
ERROR: GitHub CLI not authenticated.
Run: gh auth login
Then retry: /bgsd-github-ci
```

```bash
# Check there are commits to push
COMMITS=$(git log origin/${BASE_BRANCH}..HEAD --oneline 2>/dev/null)
```

If no commits ahead of base:
```
ERROR: Nothing to push. No commits ahead of origin/${BASE_BRANCH}.
```

```bash
# Check remote exists
git remote -v
```

If no remote configured, error:
```
ERROR: No git remote configured. Add one with: git remote add origin <url>
```

---

**Step 3: Determine scope**

If `--scope` provided, use it directly for branch naming and PR title.

Otherwise derive scope:
```bash
# Try STATE.md current position
CURRENT=$(grep "^Last activity:" .planning/STATE.md 2>/dev/null | head -1)

# Fallback: derive from most recent commit
RECENT=$(git log -1 --format="%s" 2>/dev/null)
```

Build branch name:
```bash
BRANCH_NAME="${BRANCH_NAME:-ci/${SCOPE:-$(date +%Y%m%d)}}"
```

Report:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 bGSD ► GITHUB CI QUALITY GATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
◆ Branch: ${BRANCH_NAME}
◆ Base: ${BASE_BRANCH}
◆ Auto-merge: ${AUTO_MERGE}
◆ Scope: ${SCOPE}
```

---

**Step 4: Spawn CI agent**

**Context:** This workflow receives project context via `<bgsd-context>` auto-injected by the bGSD plugin's `command.execute.before` hook. If no `<bgsd-context>` block is present, the plugin is not loaded.

**If no `<bgsd-context>` found:** Stop and tell the user: "bGSD plugin required for v9.0. Install with: npx bgsd-oc"

Parse `executor_model` from `<bgsd-context>` JSON.

```
Task(
  prompt="
Run the GitHub CI quality gate.

<spawned_by>github-ci-workflow</spawned_by>

<ci_parameters>
BRANCH_NAME: ${BRANCH_NAME}
BASE_BRANCH: ${BASE_BRANCH}
AUTO_MERGE: ${AUTO_MERGE}
SCOPE: ${SCOPE}
</ci_parameters>

<files_to_read>
- .planning/STATE.md
- ./AGENTS.md (if exists)
</files_to_read>
",
  subagent_type="bgsd-github-ci",
  model="{executor_model}",
  description="GitHub CI: ${SCOPE}"
)
```

---

**Step 5: Parse and report results**

Parse the agent's structured return. Handle each type:

**If CI COMPLETE:**

Display full summary including timing and decisions:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 bGSD ► CI COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
◆ PR: ${PR_URL}
◆ Status: ${STATUS}
◆ Checks: ${PASSED} passed, ${FIXED} fixed, ${DISMISSED} dismissed
◆ Merge: ${MERGE_STATUS}
◆ Duration: ${TOTAL_TIME} (checks: ${WAIT_TIME}, fixes: ${FIX_TIME})
◆ Decisions: ${DECISION_COUNT} made
```

If fixes were applied or alerts dismissed, display the detail tables from CI COMPLETE.

**If CHECKPOINT REACHED with Type: human-action:**

Display checkpoint details and STOP. User must take action.
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 bGSD ► CI CHECKPOINT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
◆ Type: human-action
◆ PR: ${PR_URL}
◆ Status: ${CHECKPOINT_DETAILS}

Required Action:
${AWAITING}
```

**If CHECKPOINT REACHED with Type: human-verify:**

Display checkpoint details and present options to user.
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 bGSD ► CI CHECKPOINT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
◆ Type: human-verify
◆ PR: ${PR_URL}
◆ Status: ${CHECKPOINT_DETAILS}

Options:
1. Dismiss remaining alerts as acceptable risk
2. Apply manual fixes and re-run: /bgsd-github-ci --branch ${BRANCH_NAME}
3. Close PR without merging
```

---

**Step 6: Record state (direct invocation only)**

If this workflow was invoked directly via `/bgsd-github-ci` (not spawned by execute-phase):

Record CI decisions and session from agent's return:
```bash
BGSD_HOME=$(ls -d $HOME/.config/*/bgsd-oc 2>/dev/null | head -1)

# Record key decisions from CI COMPLETE
node $BGSD_HOME/bin/bgsd-tools.cjs verify:state add-decision \
  --phase "ci" --summary "CI: ${STATUS} - ${PASSED} passed, ${FIXED} fixed, ${DISMISSED} dismissed"

# Update session
node $BGSD_HOME/bin/bgsd-tools.cjs verify:state record-session \
  --stopped-at "CI: ${STATUS} - PR ${PR_URL}"
```

If agent returned a checkpoint (not CI COMPLETE), skip state recording — the user will take action and re-run.

</process>

<success_criteria>
- [ ] gh CLI authenticated
- [ ] Commits exist to push
- [ ] Remote configured
- [ ] CI agent spawned and completed (or checkpoint returned)
- [ ] Results reported to user
</success_criteria>
