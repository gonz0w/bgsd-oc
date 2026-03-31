description: Compatibility alias for `/bgsd-plan roadmap insert`
---
<objective>
Preserve the legacy roadmap-insert entrypoint while routing to canonical `/bgsd-plan roadmap insert` behavior.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/commands/bgsd-plan.md
</execution_context>

<context>
$ARGUMENTS: Position and phase description
</context>

<process>
Treat `/bgsd-insert-phase` as a compatibility alias only.

Translate the request to canonical `/bgsd-plan roadmap insert $ARGUMENTS` behavior and follow the shared planning-family contract in @__OPENCODE_CONFIG__/bgsd-oc/commands/bgsd-plan.md.

Do not present this alias as the preferred path.
</process>
