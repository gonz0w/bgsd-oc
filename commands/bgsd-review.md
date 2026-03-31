---
description: Run the single-command code review workflow
---
<objective>
Run structured code review from one command.

Purpose: Start the Phase 146 review workflow from a thin slash-command wrapper so users can launch scan, question batching, judgment review, and final reporting without manually chaining steps.

Output: The review workflow defined in `workflows/review.md`.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/workflows/review.md
</execution_context>

<context>
$ARGUMENTS: Optional review scope arguments passed through to the workflow.
</context>

<process>
Execute the review workflow from @__OPENCODE_CONFIG__/bgsd-oc/workflows/review.md end-to-end.
</process>
