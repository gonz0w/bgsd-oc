---
description: Group command for execution operations - phase, quick, ci
---
<objective>
Router command that delegates to specific execution workflows based on first argument.

**Usage:**
- /bgsd exec phase [phase] → bgsd-execute-phase
- /bgsd exec quick → bgsd-quick
- /bgsd exec ci → bgsd-github-ci
</objective>

<execution_context>
Routes to: bgsd-execute-phase, bgsd-quick, bgsd-github-ci
</execution_context>

<context>
$ARGUMENTS: First word is subcommand, rest are passed to target
</context>

<process>
Parse first argument to determine target command, then route.

Subcommands:
- phase → bgsd-execute-phase
- quick → bgsd-quick
- ci → bgsd-github-ci

Route all arguments to the target command unchanged.
</process>
