---
description: Push, create PR, run code scanning checks, fix issues, and auto-merge
---
<objective>
Run the GitHub CI quality gate: push branch, create PR, monitor code scanning checks, fix issues in a loop, and auto-merge when clean.

Callable standalone or as a post-execution step from execute-phase or quick workflows.

**Options:**
- `--branch {name}` — Override branch name
- `--base {branch}` — Target branch (default: main)
- `--no-merge` — Skip auto-merge after checks pass
- `--scope {id}` — Context identifier (e.g., `phase-01`, `quick-11`)
</objective>

<execution_context>
@__OPENCODE_CONFIG__/get-shit-done/workflows/github-ci.md
</execution_context>

<context>
$ARGUMENTS

Context files are resolved inside the workflow and delegated via `<files_to_read>` blocks.
</context>

<process>
Execute the github-ci workflow from @__OPENCODE_CONFIG__/get-shit-done/workflows/github-ci.md end-to-end.
Preserve all workflow gates (prerequisite validation, agent spawn, result reporting).
</process>
