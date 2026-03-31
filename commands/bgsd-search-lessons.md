---
description: Compatibility alias for `/bgsd-inspect search lessons`
---
<objective>
Preserve the legacy lesson-search entrypoint while routing to the canonical inspect search behavior.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-search-lessons.md
</execution_context>

<context>
$ARGUMENTS: Search query
</context>

<process>
Treat `/bgsd-search-lessons` as a compatibility alias for `/bgsd-inspect search lessons`.

Execute the same lesson-search workflow contract used by the canonical inspect family from @__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-search-lessons.md end-to-end with all provided arguments.

Keep this alias read-only and compatibility-focused.
</process>
