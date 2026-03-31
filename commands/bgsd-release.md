---
description: Run the single-command release workflow
---
<objective>
Run structured release automation from one command.

Purpose: Start the Phase 148 release workflow from a thin slash-command wrapper so users can preview the release, confirm once, and follow resumable tag/PR guidance without manually chaining subcommands.

Output: The release workflow defined in `workflows/release.md`.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/workflows/release.md
</execution_context>

<context>
$ARGUMENTS: Optional release arguments passed through to the workflow.
</context>

<process>
Execute the release workflow from @__OPENCODE_CONFIG__/bgsd-oc/workflows/release.md end-to-end.
</process>
