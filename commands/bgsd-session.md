---
description: Group command for session operations - resume, pause, progress
---
<objective>
Router command that delegates to specific session workflows based on first argument.

**Usage:**
- /bgsd session resume → bgsd-resume-work
- /bgsd session pause → bgsd-pause-work
- /bgsd session progress → bgsd-progress
</objective>

<execution_context>
Routes to: bgsd-resume-work, bgsd-pause-work, bgsd-progress
</execution_context>

<context>
$ARGUMENTS: First word is subcommand, rest are passed to target
</context>

<process>
Parse first argument to determine target command, then route.

Subcommands:
- resume → bgsd-resume-work
- pause → bgsd-pause-work
- progress → bgsd-progress

Route all arguments to the target command unchanged.
</process>
