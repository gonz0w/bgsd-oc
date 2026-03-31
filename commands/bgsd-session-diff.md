---
description: Compatibility alias for `/bgsd-inspect session-diff`
---
<objective>
Preserve the legacy session-diff entrypoint while routing to the canonical inspect session-diff behavior.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-session-diff.md
</execution_context>

<context>
$ARGUMENTS: Optional arguments
</context>

<process>
Treat `/bgsd-session-diff` as a compatibility alias for `/bgsd-inspect session-diff`.

Execute the same session-diff workflow contract used by the canonical inspect family from @__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-session-diff.md end-to-end with all provided arguments.

Keep this alias read-only and compatibility-focused.
</process>
