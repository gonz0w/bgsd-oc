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

```bash
INIT=$(node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs init:execute-phase 2>/dev/null || echo '{"executor_model":"default"}')
```

Parse `executor_model` from init JSON.

```
Task(
  prompt="
Run the GitHub CI quality gate.

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
  subagent_type="gsd-github-ci",
  model="{executor_model}",
  description="GitHub CI: ${SCOPE}"
)
```

---

**Step 5: Report results**

Parse agent return for CI COMPLETE structure.

Display summary:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 bGSD ► CI COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
◆ PR: ${PR_URL}
◆ Status: ${STATUS}
◆ Checks: ${PASSED} passed, ${FIXED} fixed, ${DISMISSED} dismissed
◆ Merge: ${MERGE_STATUS}
```

If agent returned checkpoint (auth gate, merge blocked, fix limit):
- Display checkpoint details
- Provide next steps to user

</process>

<success_criteria>
- [ ] gh CLI authenticated
- [ ] Commits exist to push
- [ ] Remote configured
- [ ] CI agent spawned and completed (or checkpoint returned)
- [ ] Results reported to user
</success_criteria>
