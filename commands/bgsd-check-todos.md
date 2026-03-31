description: Compatibility alias for `/bgsd-plan todo check`
---
<objective>
Preserve the legacy todo-check entrypoint while routing to canonical `/bgsd-plan todo check` behavior.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/commands/bgsd-plan.md
</execution_context>

<context>
$ARGUMENTS: Optional plan-scoped todo filter arguments
</context>

<process>
Treat `/bgsd-check-todos` as a compatibility alias only.

Translate the request to canonical `/bgsd-plan todo check $ARGUMENTS` behavior and follow the shared planning-family contract in @__OPENCODE_CONFIG__/bgsd-oc/commands/bgsd-plan.md.

Keep todo review explicitly plan-scoped and do not present this alias as the preferred path.
</process>
