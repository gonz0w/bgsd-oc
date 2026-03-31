---
description: Compatibility alias for `/bgsd-settings profile`
---
<objective>
Preserve the legacy profile-switch entrypoint while routing to canonical `/bgsd-settings profile` behavior.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/commands/bgsd-settings.md
</execution_context>

<context>
$ARGUMENTS: Optional profile name
</context>

<process>
Treat `/bgsd-set-profile` as a compatibility alias only.

Translate the request to canonical `/bgsd-settings profile $ARGUMENTS` behavior and follow the shared settings-family contract in @__OPENCODE_CONFIG__/bgsd-oc/commands/bgsd-settings.md.

Do not present this alias as the preferred path.
</process>
