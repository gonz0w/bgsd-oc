---
description: Group command for todo operations - add, check
---
<objective>
Router command that delegates to specific todo workflows based on first argument.

**Usage:**
- /bgsd todo add [task] → bgsd-add-todo
- /bgsd todo check → bgsd-check-todos
</objective>

<execution_context>
Routes to: bgsd-add-todo, bgsd-check-todos
</execution_context>

<context>
$ARGUMENTS: First word is subcommand, rest are passed to target
</context>

<process>
Parse first argument to determine target command, then route.

Subcommands:
- add → bgsd-add-todo
- check → bgsd-check-todos

Route all arguments to the target command unchanged.
</process>
