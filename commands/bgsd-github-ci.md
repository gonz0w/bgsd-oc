---
description: CI workflow - push, create PR, run code scanning, fix loop, and auto-merge
---
<objective>
Execute CI workflow: push changes, create PR, run code scanning, fix issues in loop, auto-merge.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/workflows/github-ci.md
</execution_context>

<context>
$ARGUMENTS: Optional arguments
</context>

<process>
Execute the github-ci workflow from `__OPENCODE_CONFIG__/bgsd-oc/workflows/github-ci.md` end-to-end.
</process>
