---
description: Group command for roadmap management - add, insert, remove
---
<objective>
Router command that delegates to specific roadmap workflows based on first argument.

**Usage:**
- /bgsd roadmap add → bgsd-add-phase
- /bgsd roadmap insert [phase] [position] → bgsd-insert-phase
- /bgsd roadmap remove [phase] → bgsd-remove-phase
</objective>

<execution_context>
Routes to: bgsd-add-phase, bgsd-insert-phase, bgsd-remove-phase
</execution_context>

<context>
$ARGUMENTS: First word is subcommand, rest are passed to target
</context>

<process>
Parse first argument to determine target command, then route.

Subcommands:
- add → bgsd-add-phase
- insert → bgsd-insert-phase
- remove → bgsd-remove-phase

Route all arguments to the target command unchanged.
</process>
