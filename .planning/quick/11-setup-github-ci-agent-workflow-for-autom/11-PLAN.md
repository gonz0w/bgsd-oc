---
phase: quick-11
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - agents/gsd-github-ci.md
  - workflows/github-ci.md
  - commands/bgsd-github-ci.md
autonomous: true
requirements: []

must_haves:
  truths:
    - "Agent can push a branch, create a PR, and poll for check status via gh CLI"
    - "Agent loops on fix-push-recheck when CodeQL/scanning finds issues"
    - "Agent auto-merges PR when all checks pass"
    - "Agent is callable as a Task subagent from execute-phase or quick workflows"
  artifacts:
    - path: "agents/gsd-github-ci.md"
      provides: "CI agent subagent definition with system prompt"
    - path: "workflows/github-ci.md"
      provides: "Workflow orchestration for the CI agent"
    - path: "commands/bgsd-github-ci.md"
      provides: "Slash command wrapper for manual invocation"
  key_links:
    - from: "workflows/github-ci.md"
      to: "agents/gsd-github-ci.md"
      via: "Task() spawn with subagent_type"
      pattern: "subagent_type.*gsd-github-ci"
    - from: "commands/bgsd-github-ci.md"
      to: "workflows/github-ci.md"
      via: "execution_context reference"
      pattern: "github-ci\\.md"
---

<objective>
Create a GitHub CI agent that autonomously handles the push → PR → check → fix → merge loop.

Purpose: Ensure all code changes pass CodeQL/code scanning before merging, with autonomous fix iteration. This becomes a post-execution quality gate callable from workflows.

Output: Agent definition (`agents/gsd-github-ci.md`), orchestrator workflow (`workflows/github-ci.md`), and slash command (`commands/bgsd-github-ci.md`).
</objective>

<context>
@.planning/STATE.md
@agents/gsd-executor.md (for agent structure conventions, frontmatter, commit patterns)
@agents/gsd-verifier.md (for agent structure conventions)
@workflows/execute-phase.md (for Task() spawn patterns, integration point)
@workflows/quick.md (for workflow/command patterns)
@.github/workflows/codeql.yml (existing CI — triggers on PR to main)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create the gsd-github-ci agent definition</name>
  <files>agents/gsd-github-ci.md</files>
  <action>
Create the agent file at `agents/gsd-github-ci.md` following the exact conventions of existing agents (see `gsd-executor.md`, `gsd-verifier.md` for structure).

**Frontmatter:**
```yaml
---
description: Pushes changes to a new branch, creates a PR, monitors code scanning checks, fixes issues in a loop, and auto-merges when clean. Spawned by execute-phase, quick, or manual invocation.
mode: subagent
color: "#00BFFF"
# estimated_tokens: ~4k
tools:
  read: true
  write: true
  edit: true
  bash: true
  grep: true
  glob: true
---
```

**System prompt structure** (follow existing agent patterns — `<role>`, `<execution_flow>`, `<success_criteria>` sections):

Include the standard PATH SETUP block and `<role>` section.

**`<execution_flow>` steps:**

1. **`<step name="parse_input">`** — Accept parameters: `BRANCH_NAME` (optional, default: `ci/{phase}-{plan}` or `ci/quick-{N}`), `BASE_BRANCH` (default: `main`), `MAX_FIX_ITERATIONS` (default: 3), `AUTO_MERGE` (default: true), `MERGE_METHOD` (default: squash).

2. **`<step name="push_branch">`** — Create and push branch:
   ```bash
   git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"
   git push -u origin "$BRANCH_NAME"
   ```
   If push fails with auth error, return checkpoint:human-action with auth steps.

3. **`<step name="create_pr">`** — Create PR using gh CLI:
   ```bash
   PR_URL=$(gh pr create --base "$BASE_BRANCH" --head "$BRANCH_NAME" --title "$PR_TITLE" --body "$PR_BODY" --no-maintainer-edit 2>&1)
   ```
   Extract PR number. If PR already exists, find it: `gh pr list --head "$BRANCH_NAME" --json number,url --jq '.[0]'`
   PR title format: `feat({scope}): {brief description}`
   PR body should summarize what was built (from SUMMARY.md if available, or from the plan objective).

4. **`<step name="wait_for_checks">`** — Poll for check completion:
   ```bash
   gh pr checks "$PR_NUMBER" --watch --fail-fast 2>&1
   ```
   If `--watch` is not supported or times out after 10 minutes, fall back to polling loop:
   ```bash
   while true; do
     STATUS=$(gh pr checks "$PR_NUMBER" --json name,state,conclusion 2>&1)
     # Parse: all "completed"? any "failure"?
     sleep 30
   done
   ```
   Timeout: 15 minutes total. If checks never complete, return checkpoint:human-verify.

5. **`<step name="analyze_failures">`** — If checks fail:
   - Fetch code scanning alerts: `gh api repos/{owner}/{repo}/code-scanning/alerts --jq '.[] | select(.state=="open")'`
   - Also check: `gh pr checks "$PR_NUMBER" --json name,state,conclusion,detailsUrl`
   - Parse alert details: rule ID, description, file path, line number, severity
   - Classify each alert:
     - **True positive** (severity critical/high, clear security issue): Fix it
     - **Likely false positive** (test files, dead code paths, informational): Document and dismiss via `gh api` with reason "false positive" or "won't fix"
   - Log classification reasoning for each alert

6. **`<step name="fix_and_repush">`** — For true positive alerts (iteration loop, max MAX_FIX_ITERATIONS):
   - Read the flagged file(s)
   - Apply fix following the alert's rule guidance
   - Run local validation if available (`npm test`, `npm run build`)
   - Commit fix: `git commit -m "fix(ci): address {rule_id} - {brief description}"`
   - Push: `git push`
   - Return to wait_for_checks step
   - Track iteration count. If MAX_FIX_ITERATIONS exceeded:
     - Return checkpoint:human-verify with remaining alerts, fixes attempted, and recommendation

7. **`<step name="auto_merge">`** — When all checks pass:
   ```bash
   gh pr merge "$PR_NUMBER" --squash --auto --delete-branch
   ```
   If auto-merge not enabled on repo, try: `gh pr merge "$PR_NUMBER" --squash --delete-branch`
   If merge fails (branch protection, review required), return checkpoint:human-action with what's needed.
   After merge, checkout base branch: `git checkout "$BASE_BRANCH" && git pull`

**`<completion_format>`:**
```markdown
## CI COMPLETE

**PR:** {PR_URL}
**Status:** {merged | checks-passed-awaiting-merge | needs-human-review}
**Checks:** {N} passed, {M} fixed, {K} dismissed (false positive)
**Iterations:** {fix_iteration_count}
**Merge:** {squash-merged | pending | skipped}

{If fixes applied:}
### Fixes Applied
| Alert | Rule | File | Fix |
|-------|------|------|-----|
| {id} | {rule_id} | {path} | {description} |

{If dismissed:}
### Dismissed (False Positives)
| Alert | Rule | Reason |
|-------|------|--------|
| {id} | {rule_id} | {reason} |
```

**`<success_criteria>`:**
- [ ] Branch pushed to remote
- [ ] PR created with descriptive title/body
- [ ] All code scanning checks pass (or false positives dismissed with reasoning)
- [ ] PR merged (or checkpoint returned if blocked)
- [ ] Local branch cleaned up (back on base branch)
  </action>
  <verify>File exists at `agents/gsd-github-ci.md` with proper frontmatter (description, mode: subagent, tools), has `<role>`, `<execution_flow>`, `<success_criteria>` sections, follows PATH SETUP pattern from other agents.</verify>
  <done>Agent definition complete with all 7 execution steps covering push → PR → check → fix-loop → merge flow, matching existing agent file conventions.</done>
</task>

<task type="auto">
  <name>Task 2: Create the github-ci workflow and slash command</name>
  <files>workflows/github-ci.md, commands/bgsd-github-ci.md</files>
  <action>
**Workflow file (`workflows/github-ci.md`):**

Create an orchestrator workflow following the pattern of `workflows/quick.md`. Structure:

```markdown
<purpose>
Run GitHub CI quality gate: push branch, create PR, monitor code scanning checks, fix issues, and auto-merge. Callable standalone or as post-execution step.
</purpose>

<required_reading>
Read STATE.md before starting.
</required_reading>

<process>
```

**Steps:**

1. **Parse arguments** — Accept optional args: `--branch {name}`, `--base {branch}`, `--no-merge`, `--scope {phase-plan or quick-N}`. Parse from `$ARGUMENTS`.

2. **Validate prerequisites:**
   - Check `gh auth status` — if not authed, error with instructions
   - Check there are commits to push: `git log origin/main..HEAD --oneline` — if empty, error "Nothing to push"
   - Check remote exists: `git remote -v`

3. **Determine scope** — If `--scope` provided, use it for branch naming and PR title. Otherwise, derive from STATE.md current position or most recent git commit message.

4. **Spawn CI agent:**
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

5. **Report results** — Parse agent return, display CI COMPLETE summary.

**Success criteria section:**
- [ ] gh CLI authenticated
- [ ] Commits exist to push
- [ ] CI agent spawned and completed
- [ ] Results reported

---

**Command file (`commands/bgsd-github-ci.md`):**

Follow the exact pattern of existing commands (thin wrappers). Example from examining the commands directory:

```markdown
---
description: Push, create PR, run code scanning checks, fix issues, and auto-merge
---

<execution_context>
@workflows/github-ci.md
</execution_context>

Run the GitHub CI workflow with arguments: $ARGUMENTS
```

Keep it minimal — commands are thin wrappers that reference workflows.
  </action>
  <verify>
Both files exist: `workflows/github-ci.md` and `commands/bgsd-github-ci.md`. Workflow has `<purpose>`, `<process>` sections with Task() spawn referencing `subagent_type="gsd-github-ci"`. Command has frontmatter with description and `<execution_context>` referencing the workflow.
  </verify>
  <done>Workflow orchestrates the CI agent via Task() spawn with proper argument parsing. Command provides `/bgsd-github-ci` entry point. Both follow existing file conventions.</done>
</task>

<task type="auto">
  <name>Task 3: Document integration points and update AGENTS.md command list</name>
  <files>AGENTS.md</files>
  <action>
Update `AGENTS.md` to include the new command in the appropriate section.

In the **Slash Commands** section, add under **Execution & Verification:** (after the existing entries):
```
- `/bgsd-github-ci` — Push, create PR, run code scanning, fix loop, and auto-merge
```

Update the command count in the line `40 commands available in commands/:` → `41 commands available in commands/:`.

Do NOT modify any other sections of AGENTS.md.
  </action>
  <verify>Run `grep "bgsd-github-ci" AGENTS.md` confirms the entry exists. Run `grep "41 commands" AGENTS.md` confirms updated count.</verify>
  <done>AGENTS.md lists the new `/bgsd-github-ci` command and updated command count. All three files (agent, workflow, command) form a complete, self-consistent system.</done>
</task>

</tasks>

<verification>
- All 3 files exist: `agents/gsd-github-ci.md`, `workflows/github-ci.md`, `commands/bgsd-github-ci.md`
- Agent file has proper frontmatter with `mode: subagent` and tool grants
- Workflow spawns agent via `Task(subagent_type="gsd-github-ci")`
- Command references `workflows/github-ci.md` in execution_context
- AGENTS.md updated with new command entry
- Agent handles the full loop: push → PR → check → classify → fix/dismiss → re-check → merge
</verification>

<success_criteria>
- `/bgsd-github-ci` command exists and references the workflow
- Workflow validates prerequisites (gh auth, commits to push) before spawning agent
- Agent handles push, PR creation, check polling, failure analysis (true vs false positive), fix iteration (max 3), and auto-merge
- Agent returns structured completion format with fix/dismiss details
- AGENTS.md command count and listing updated
</success_criteria>

<output>
After completion, create `.planning/quick/11-setup-github-ci-agent-workflow-for-autom/11-SUMMARY.md`
</output>
