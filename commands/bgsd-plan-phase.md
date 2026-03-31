description: Compatibility alias for the canonical planning-family phase action
---
<objective>
Preserve the legacy phase-planning entrypoint while routing to the canonical `/bgsd-plan phase` behavior.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/commands/bgsd-plan.md
</execution_context>

<context>
$ARGUMENTS: Phase number plus optional planning flags (e.g., `108 --skip-research`)
</context>

<process>
Treat `/bgsd-plan-phase` as a compatibility alias only.

Translate the request to canonical `/bgsd-plan phase $ARGUMENTS` behavior and follow the shared planning-family contract in @__OPENCODE_CONFIG__/bgsd-oc/commands/bgsd-plan.md.

Do not present this alias as the preferred path.
</process>
