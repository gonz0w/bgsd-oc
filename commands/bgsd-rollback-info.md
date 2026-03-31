---
description: Compatibility alias for `/bgsd-inspect rollback-info`
---
<objective>
Preserve the legacy rollback-info entrypoint while routing to the canonical inspect rollback-info behavior.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-rollback-info.md
</execution_context>

<context>
$ARGUMENTS: Plan name
</context>

<process>
Treat `/bgsd-rollback-info` as a compatibility alias for `/bgsd-inspect rollback-info`.

Execute the same rollback-info workflow contract used by the canonical inspect family from @__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-rollback-info.md end-to-end with all provided arguments.

Keep this alias read-only and compatibility-focused.
</process>
