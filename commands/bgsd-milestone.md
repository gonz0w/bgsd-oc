---
description: Group command for milestone operations - new, complete, audit, gaps
---
<objective>
Router command that delegates to specific milestone workflows based on first argument.

**Usage:**
- /bgsd milestone new → bgsd-new-milestone
- /bgsd milestone complete → bgsd-complete-milestone
- /bgsd milestone audit → bgsd-audit-milestone
- /bgsd milestone gaps → bgsd-plan-milestone-gaps
</objective>

<execution_context>
Routes to: bgsd-new-milestone, bgsd-complete-milestone, bgsd-audit-milestone, bgsd-plan-milestone-gaps
</execution_context>

<context>
$ARGUMENTS: First word is subcommand, rest are passed to target
</context>

<process>
Parse first argument to determine target command, then route.

Subcommands:
- new → bgsd-new-milestone
- complete → bgsd-complete-milestone
- audit → bgsd-audit-milestone
- gaps → bgsd-plan-milestone-gaps

Route all arguments to the target command unchanged.
</process>
