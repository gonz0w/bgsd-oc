---
description: Compatibility alias for `/bgsd-inspect velocity`
---
<objective>
Preserve the legacy velocity entrypoint while routing to the canonical inspect velocity behavior.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-velocity.md
</execution_context>

<context>
$ARGUMENTS: Optional arguments
</context>

<process>
Treat `/bgsd-velocity` as a compatibility alias for `/bgsd-inspect velocity`.

Execute the same velocity workflow contract used by the canonical inspect family from @__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-velocity.md end-to-end with all provided arguments.

Keep this alias read-only and compatibility-focused.
</process>
