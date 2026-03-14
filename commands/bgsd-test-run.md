---
description: Parse test output with pass/fail gating
---
<objective>
Parse test output with pass/fail gating.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-test-run.md
</execution_context>

<context>
$ARGUMENTS: Test command output
</context>

<process>
Execute the cmd-test-run workflow from @__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-test-run.md end-to-end.
</process>
