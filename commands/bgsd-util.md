---
description: Group command for utility operations - map, cleanup, help, update, velocity, and more
---
<objective>
Router command that delegates to specific utility workflows based on first argument.

**Usage:**
- /bgsd util map → bgsd-map-codebase
- /bgsd util cleanup → bgsd-cleanup
- /bgsd util help → bgsd-help
- /bgsd util update → bgsd-update
- /bgsd util velocity → bgsd-velocity
- /bgsd util validate-deps → bgsd-validate-deps
- /bgsd util test-run → bgsd-test-run
- /bgsd util trace [req] → bgsd-trace-requirement
- /bgsd util search-decisions [query] → bgsd-search-decisions
- /bgsd util search-lessons [query] → bgsd-search-lessons
- /bgsd util session-diff → bgsd-session-diff
- /bgsd util rollback-info → bgsd-rollback-info
- /bgsd util context-budget → bgsd-context-budget
- /bgsd util impact → bgsd-codebase-impact
- /bgsd util patches → bgsd-reapply-patches
- /bgsd util health → bgsd-health
</objective>

<execution_context>
Routes to: bgsd-map-codebase, bgsd-cleanup, bgsd-help, bgsd-update, bgsd-velocity, bgsd-validate-deps, bgsd-test-run, bgsd-trace-requirement, bgsd-search-decisions, bgsd-search-lessons, bgsd-session-diff, bgsd-rollback-info, bgsd-context-budget, bgsd-codebase-impact, bgsd-reapply-patches, bgsd-health
</execution_context>

<context>
$ARGUMENTS: First word is subcommand, rest are passed to target
</context>

<process>
Parse first argument to determine target command, then route.

Subcommands:
- map → bgsd-map-codebase
- cleanup → bgsd-cleanup
- help → bgsd-help
- update → bgsd-update
- velocity → bgsd-velocity
- validate-deps → bgsd-validate-deps
- test-run → bgsd-test-run
- trace → bgsd-trace-requirement
- search-decisions → bgsd-search-decisions
- search-lessons → bgsd-search-lessons
- session-diff → bgsd-session-diff
- rollback-info → bgsd-rollback-info
- context-budget → bgsd-context-budget
- impact → bgsd-codebase-impact
- patches → bgsd-reapply-patches
- health → bgsd-health

Route all arguments to the target command unchanged.
</process>
