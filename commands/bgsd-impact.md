---
description: Compatibility alias for `/bgsd-inspect impact`
---
<objective>
Preserve the legacy impact entrypoint while routing to the canonical inspect impact behavior.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-codebase-impact.md
</execution_context>

<context>
$ARGUMENTS: Optional module/file
</context>

<process>
Treat `/bgsd-impact` as a compatibility alias for `/bgsd-inspect impact`.

Execute the same impact workflow contract used by the canonical inspect family from @__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-codebase-impact.md end-to-end with all provided arguments.

Keep this alias read-only and compatibility-focused.
</process>
