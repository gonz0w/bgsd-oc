---
description: Canonical settings-family command for configuration profile switching and validation
---
<objective>
Use the canonical settings-family entrypoint for workflow configuration, model-profile switching, and config validation.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/workflows/settings.md
@__OPENCODE_CONFIG__/bgsd-oc/workflows/set-profile.md
@__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-validate-config.md
</execution_context>

<context>
$ARGUMENTS: Optional settings sub-action such as `profile <name>`, `validate [config-path]`, or direct settings arguments
</context>

<process>
Treat `/bgsd-settings` as the canonical settings family.

Normalize the leading arguments onto the existing settings workflows:

- No sub-action or direct settings arguments -> @__OPENCODE_CONFIG__/bgsd-oc/workflows/settings.md
- `profile <name>` -> @__OPENCODE_CONFIG__/bgsd-oc/workflows/set-profile.md with the remaining arguments after `profile`
- `validate [config-path]` -> @__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-validate-config.md with the remaining arguments after `validate`

Representative compatibility shims that must stay equivalent to this contract:

- `/bgsd-set-profile` -> `/bgsd-settings profile`
- `/bgsd-validate-config` -> `/bgsd-settings validate`

Preserve the remaining arguments after the normalized settings-family prefix so canonical and legacy entrypoints stay behaviorally equivalent.

Keep `/bgsd-settings` separate from the canonical planning and read-only inspection families.
</process>
