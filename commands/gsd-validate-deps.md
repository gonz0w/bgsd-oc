---
description: Validate phase dependency graph for circular or missing dependencies
tools:
  read: true
  bash: true
  grep: true
  glob: true
---
<objective>
Validate the dependency graph for a phase. Checks that all plan dependencies are satisfiable and flags circular or missing dependencies.
</objective>

<execution_context>
@/home/cam/.config/opencode/get-shit-done/workflows/cmd-validate-deps.md
</execution_context>

<process>
Execute the workflow from the execution_context end-to-end.
</process>
