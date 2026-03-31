description: Compatibility alias for `/bgsd-plan roadmap remove`
---
<objective>
Preserve the legacy roadmap-remove entrypoint while routing to canonical `/bgsd-plan roadmap remove` behavior.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/commands/bgsd-plan.md
</execution_context>

<context>
$ARGUMENTS: Phase number to remove
</context>

<process>
Treat `/bgsd-remove-phase` as a compatibility alias only.

Translate the request to canonical `/bgsd-plan roadmap remove $ARGUMENTS` behavior and follow the shared planning-family contract in @__OPENCODE_CONFIG__/bgsd-oc/commands/bgsd-plan.md.

Do not present this alias as the preferred path.
</process>
