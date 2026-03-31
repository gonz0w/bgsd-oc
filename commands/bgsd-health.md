---
description: Compatibility alias for `/bgsd-inspect health`
---
<objective>
Preserve the legacy health entrypoint while routing to the canonical inspect health behavior.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/workflows/health.md
</execution_context>

<context>
$ARGUMENTS: Optional read-only health inspection arguments
</context>

<process>
Treat `/bgsd-health` as a compatibility alias for `/bgsd-inspect health`.

Execute the same health inspection workflow contract used by the canonical inspect family from @__OPENCODE_CONFIG__/bgsd-oc/workflows/health.md end-to-end with all provided arguments.

Keep this alias read-only and compatibility-focused. Do not expand it into repair or other mutating flows through the inspect family.
</process>
