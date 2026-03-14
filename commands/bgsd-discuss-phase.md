---
description: Discuss and scope a phase before planning
---
<objective>
Discuss implementation decisions for a specific phase, then capture them in CONTEXT.md for downstream agents.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/workflows/discuss-phase.md
</execution_context>

<context>
$ARGUMENTS: Phase number (e.g., 108)
</context>

<process>
Execute the discuss-phase workflow from @__OPENCODE_CONFIG__/bgsd-oc/workflows/discuss-phase.md end-to-end.
Pass phase number from arguments to workflow.
</process>
