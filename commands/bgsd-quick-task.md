---
description: Compatibility alias for the canonical quick-entry command
---
<objective>
Preserve the legacy quick-task entrypoint while routing to the canonical quick workflow.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/workflows/quick.md
</execution_context>

<context>
$ARGUMENTS: Task description or quick-execution request
</context>

<process>
Treat `/bgsd-quick-task` as a compatibility alias only.

Execute the same quick workflow contract used by `/bgsd-quick` from @__OPENCODE_CONFIG__/bgsd-oc/workflows/quick.md end-to-end with all provided arguments.
</process>
