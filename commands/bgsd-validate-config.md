---
description: Compatibility alias for `/bgsd-settings validate`
---
<objective>
Preserve the legacy config-validation entrypoint while routing to canonical `/bgsd-settings validate` behavior.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/commands/bgsd-settings.md
</execution_context>

<context>
$ARGUMENTS: Optional config path
</context>

<process>
Treat `/bgsd-validate-config` as a compatibility alias only.

Translate the request to canonical `/bgsd-settings validate $ARGUMENTS` behavior and follow the shared settings-family contract in @__OPENCODE_CONFIG__/bgsd-oc/commands/bgsd-settings.md.

Keep validation scoped to settings-family behavior and do not present this alias as the preferred path.
</process>
