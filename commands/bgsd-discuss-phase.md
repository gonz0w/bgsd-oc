description: Compatibility alias for the canonical planning-family discuss action
---
<objective>
Preserve the legacy discuss entrypoint while routing to canonical `/bgsd-plan discuss` behavior.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/commands/bgsd-plan.md
</execution_context>

<context>
$ARGUMENTS: Phase number plus optional compatibility flags (e.g., `108`, `108 --fast`)
</context>

<process>
Treat `/bgsd-discuss-phase` as a compatibility alias only.

Translate the request to canonical `/bgsd-plan discuss $ARGUMENTS` behavior and follow the shared planning-family contract in @__OPENCODE_CONFIG__/bgsd-oc/commands/bgsd-plan.md.

Keep compatibility intact, including legacy flags such as `--fast`, without making this alias the preferred path again.
</process>
