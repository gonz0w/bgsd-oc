---
description: Compatibility alias for `/bgsd-inspect search decisions`
---
<objective>
Preserve the legacy decision-search entrypoint while routing to the canonical inspect search behavior.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-search-decisions.md
</execution_context>

<context>
$ARGUMENTS: Search query
</context>

<process>
Treat `/bgsd-search-decisions` as a compatibility alias for `/bgsd-inspect search decisions`.

Execute the same decision-search workflow contract used by the canonical inspect family from @__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-search-decisions.md end-to-end with all provided arguments.

Keep this alias read-only and compatibility-focused.
</process>
