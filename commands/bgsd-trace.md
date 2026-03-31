---
description: Compatibility alias for `/bgsd-inspect trace`
---
<objective>
Preserve the legacy trace entrypoint while routing to the canonical inspect trace behavior.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-trace-requirement.md
</execution_context>

<context>
$ARGUMENTS: Requirement identifier
</context>

<process>
Treat `/bgsd-trace` as a compatibility alias for `/bgsd-inspect trace`.

Execute the same trace workflow contract used by the canonical inspect family from @__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-trace-requirement.md end-to-end with all provided arguments.

Keep this alias read-only and compatibility-focused.
</process>
