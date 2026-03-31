---
description: Compatibility alias for `/bgsd-inspect progress`
---
<objective>
Preserve the legacy progress entrypoint while routing to the canonical inspect progress behavior.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/workflows/progress.md
</execution_context>

<context>
$ARGUMENTS: Optional progress arguments
</context>

<process>
Treat `/bgsd-progress` as a compatibility alias for `/bgsd-inspect progress`.

Execute the same progress workflow contract used by the canonical inspect family from @__OPENCODE_CONFIG__/bgsd-oc/workflows/progress.md end-to-end with all provided arguments.

Keep this alias read-only and compatibility-focused.
</process>
