---
description: Group command for planning operations - project, discuss, research, assumptions, phase
---
<objective>
Router command that delegates to specific planning workflows based on first argument.

**Usage:**
- /bgsd plan project → bgsd-new-project
- /bgsd plan discuss [phase] → bgsd-discuss-phase
- /bgsd plan research [phase] → bgsd-research-phase
- /bgsd plan assumptions [phase] → bgsd-list-phase-assumptions
- /bgsd plan phase [phase] → bgsd-plan-phase
</objective>

<execution_context>
Routes to: bgsd-new-project, bgsd-discuss-phase, bgsd-research-phase, bgsd-list-phase-assumptions, bgsd-plan-phase
</execution_context>

<context>
$ARGUMENTS: First word is subcommand, rest are passed to target
</context>

<process>
Parse first argument to determine target command, then route.

Subcommands:
- project → bgsd-new-project
- discuss → bgsd-discuss-phase  
- research → bgsd-research-phase
- assumptions → bgsd-list-phase-assumptions
- phase → bgsd-plan-phase

Route all arguments to the target command unchanged.
</process>
