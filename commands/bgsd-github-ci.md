---
description: GitHub CI quality gate — push branch, create PR, run code scanning, fix issues, auto-merge
---
<objective>
Run GitHub CI quality gate: push branch, create PR, monitor code scanning checks, fix issues, and auto-merge.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/workflows/github-ci.md
</execution_context>

<context>
Arguments: $ARGUMENTS
- --branch {name} — Override branch name
- --base {branch} — Target branch (default: main)
- --no-merge — Skip auto-merge
- --scope {phase-plan or quick-N} — Context identifier
</context>

<process>
Execute the github-ci workflow from @__OPENCODE_CONFIG__/bgsd-oc/workflows/github-ci.md end-to-end.
</process>
