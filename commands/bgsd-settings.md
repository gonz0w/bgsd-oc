---
description: Canonical settings-family command for configuration profile switching and validation
---
<objective>
Use the canonical settings-family entrypoint for workflow configuration, model-profile switching, and config validation.
</objective>

<execution_context>
Route first. Do not preload sibling settings-family workflows into context.
</execution_context>

<context>
$ARGUMENTS: Optional settings sub-action such as `profile <name>`, `validate [config-path]`, or direct settings arguments
</context>

<process>
Treat `/bgsd-settings` as the canonical settings family.

Normalize the leading arguments onto the existing settings workflows:

- No sub-action or direct settings arguments -> `__OPENCODE_CONFIG__/bgsd-oc/workflows/settings.md`
- `profile <name>` -> `__OPENCODE_CONFIG__/bgsd-oc/workflows/set-profile.md` with the remaining arguments after `profile`
- `validate [config-path]` -> `__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-validate-config.md` with the remaining arguments after `validate`

Preserve the remaining arguments after the normalized settings-family prefix so each `/bgsd-settings` sub-action stays behaviorally equivalent to its underlying workflow contract.

Keep `/bgsd-settings` separate from the canonical planning and read-only inspection families.

After you determine the target route, use the Read tool to load only the selected workflow file:

- default settings flow -> `__OPENCODE_CONFIG__/bgsd-oc/workflows/settings.md`
- `profile` -> `__OPENCODE_CONFIG__/bgsd-oc/workflows/set-profile.md`
- `validate` -> `__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-validate-config.md`

Do not read non-selected sibling workflows unless the selected workflow explicitly requires them.
</process>
