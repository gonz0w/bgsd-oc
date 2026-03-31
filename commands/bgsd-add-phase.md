description: Compatibility alias for `/bgsd-plan roadmap add`
---
<objective>
Preserve the legacy roadmap-add entrypoint while routing to canonical `/bgsd-plan roadmap add` behavior.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/commands/bgsd-plan.md
</execution_context>

<context>
$ARGUMENTS: Phase description
</context>

<process>
Treat `/bgsd-add-phase` as a compatibility alias only.

Translate the request to canonical `/bgsd-plan roadmap add $ARGUMENTS` behavior and follow the shared planning-family contract in @__OPENCODE_CONFIG__/bgsd-oc/commands/bgsd-plan.md.

Do not present this alias as the preferred path.
</process>
