---
description: Show module dependencies and blast radius for given files
tools:
  read: true
  bash: true
  grep: true
  glob: true
---
<objective>
Show module dependencies for given files. Analyzes which modules import/reference the specified files, helping assess the blast radius of changes.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/get-shit-done/workflows/cmd-codebase-impact.md
</execution_context>

<process>
Execute the workflow from the execution_context end-to-end.
</process>
