---
description: Parse test output and apply pass/fail gating across test frameworks
tools:
  read: true
  bash: true
  grep: true
  glob: true
---
<objective>
Parse test output and apply pass/fail gating. Detects test framework (ExUnit, Go test, pytest, Node.js test runner) and reports structured results.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/get-shit-done/workflows/cmd-test-run.md
</execution_context>

<process>
Execute the workflow from the execution_context end-to-end.
</process>
