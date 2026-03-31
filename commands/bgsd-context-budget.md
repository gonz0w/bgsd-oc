---
description: Compatibility alias for `/bgsd-inspect context-budget`
---
<objective>
Preserve the legacy context-budget entrypoint while routing to the canonical inspect context-budget behavior.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-context-budget.md
</execution_context>

<context>
$ARGUMENTS: Optional plan/phase
</context>

<process>
Treat `/bgsd-context-budget` as a compatibility alias for `/bgsd-inspect context-budget`.

Execute the same context-budget workflow contract used by the canonical inspect family from @__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-context-budget.md end-to-end with all provided arguments.

Keep this alias read-only and compatibility-focused.
</process>
