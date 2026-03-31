description: Compatibility alias for `/bgsd-plan gaps`
---
<objective>
Preserve the legacy gap-planning entrypoint while routing to canonical `/bgsd-plan gaps` behavior.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/commands/bgsd-plan.md
</execution_context>

<context>
$ARGUMENTS: Optional milestone or planning context arguments
</context>

<process>
Treat `/bgsd-plan-gaps` as a compatibility alias only.

Translate the request to canonical `/bgsd-plan gaps $ARGUMENTS` behavior and follow the shared planning-family contract in @__OPENCODE_CONFIG__/bgsd-oc/commands/bgsd-plan.md.

Keep this alias limited to the existing gap-planning entrypoint; do not turn it back into a preferred standalone surface.
</process>
