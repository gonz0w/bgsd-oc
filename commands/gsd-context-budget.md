---
description: Estimate token usage for a plan file and warn if over context budget
tools:
  read: true
  bash: true
  grep: true
  glob: true
---
<objective>
Estimate token usage for a plan file. Warns when plan content exceeds the configured context window threshold (default: 50% of 200K tokens).
</objective>

<execution_context>
@/home/cam/.config/opencode/get-shit-done/workflows/cmd-context-budget.md
</execution_context>

<process>
Execute the workflow from the execution_context end-to-end.
</process>
