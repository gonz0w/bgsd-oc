---
description: Show git commits since last planning session activity
tools:
  read: true
  bash: true
  grep: true
  glob: true
---
<objective>
Show git commits since last activity. Useful for understanding what changed since the last planning session.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/get-shit-done/workflows/cmd-session-diff.md
</execution_context>

<process>
Execute the workflow from the execution_context end-to-end.
</process>
