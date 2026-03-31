description: Compatibility alias for `/bgsd-plan todo add`
---
<objective>
Preserve the legacy todo-add entrypoint while routing to canonical `/bgsd-plan todo add` behavior.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/commands/bgsd-plan.md
</execution_context>

<context>
$ARGUMENTS: Plan-scoped todo description
</context>

<process>
Treat `/bgsd-add-todo` as a compatibility alias only.

Translate the request to canonical `/bgsd-plan todo add $ARGUMENTS` behavior and follow the shared planning-family contract in @__OPENCODE_CONFIG__/bgsd-oc/commands/bgsd-plan.md.

Keep todo capture explicitly plan-scoped and do not present this alias as the preferred path.
</process>
