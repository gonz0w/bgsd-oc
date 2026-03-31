description: Compatibility alias for the canonical planning-family research action
---
<objective>
Preserve the legacy research entrypoint while routing to canonical `/bgsd-plan research` behavior.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/commands/bgsd-plan.md
</execution_context>

<context>
$ARGUMENTS: Phase number (e.g., 108)
</context>

<process>
Treat `/bgsd-research-phase` as a compatibility alias only.

Translate the request to canonical `/bgsd-plan research $ARGUMENTS` behavior and follow the shared planning-family contract in @__OPENCODE_CONFIG__/bgsd-oc/commands/bgsd-plan.md.

Do not present this alias as the preferred path.
</process>
