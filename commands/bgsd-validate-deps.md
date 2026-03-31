---
description: Compatibility alias for `/bgsd-inspect validate-deps`
---
<objective>
Preserve the legacy dependency-validation entrypoint while routing to the canonical inspect validate-deps behavior.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-validate-deps.md
</execution_context>

<context>
$ARGUMENTS: Optional phase number
</context>

<process>
Treat `/bgsd-validate-deps` as a compatibility alias for `/bgsd-inspect validate-deps`.

Execute the same dependency-validation workflow contract used by the canonical inspect family from @__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-validate-deps.md end-to-end with all provided arguments.

Keep this alias read-only and compatibility-focused.
</process>
