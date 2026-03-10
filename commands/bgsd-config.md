---
description: Group command for configuration operations - settings, profile, validate
---
<objective>
Router command that delegates to specific config workflows based on first argument.

**Usage:**
- /bgsd config → bgsd-settings
- /bgsd config settings → bgsd-settings
- /bgsd config profile → bgsd-set-profile
- /bgsd config validate → bgsd-validate-config
</objective>

<execution_context>
Routes to: bgsd-settings, bgsd-set-profile, bgsd-validate-config
</execution_context>

<context>
$ARGUMENTS: First word is subcommand, rest are passed to target
</context>

<process>
Parse first argument to determine target command, then route.

Subcommands:
- settings → bgsd-settings
- profile → bgsd-set-profile
- validate → bgsd-validate-config

If no subcommand provided, default to bgsd-settings.

Route all arguments to the target command unchanged.
</process>
