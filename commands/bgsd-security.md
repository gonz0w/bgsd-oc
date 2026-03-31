---
description: Run the single-command security audit workflow
---
<objective>
Run structured security audit from one command.

Purpose: Start the Phase 147 security workflow from a thin slash-command wrapper so users can launch scan, verifier assessment, exclusion guidance, and final reporting without manually chaining steps.

Output: The security workflow defined in `workflows/security.md`.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/workflows/security.md
</execution_context>

<context>
$ARGUMENTS: Optional security scope arguments passed through to the workflow.
</context>

<process>
Execute the security workflow from @__OPENCODE_CONFIG__/bgsd-oc/workflows/security.md end-to-end.
</process>
