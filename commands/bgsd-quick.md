---
description: Canonical quick-entry command
---
<objective>
Use the canonical quick-entry path for fast one-off execution.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/workflows/quick.md
</execution_context>

<context>
$ARGUMENTS: Task description or quick-execution request
</context>

<process>
Treat `/bgsd-quick` as the preferred quick-entry command.

Execute the quick workflow from @__OPENCODE_CONFIG__/bgsd-oc/workflows/quick.md end-to-end with all provided arguments.
</process>
