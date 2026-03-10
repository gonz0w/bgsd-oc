---
description: Execute all plans in a phase with wave-based parallelization
---
<objective>
Execute all plans in a phase using wave-based parallel execution.

Orchestrator stays lean: discover plans, analyze dependencies, group into waves, spawn subagents, collect results. Each subagent loads the full execute-plan context and handles its own plan.

Context budget: ~15% orchestrator, 100% fresh per subagent.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/workflows/execute-phase.md
</execution_context>

<context>
Phase: $ARGUMENTS

**Flag reference** (apply ONLY when the literal flag text appears in $ARGUMENTS above):
- `--gaps-only` — Execute only gap closure plans (plans with `gap_closure: true` in frontmatter). Use after verify-work creates fix plans.

If $ARGUMENTS does not contain `--gaps-only`, execute ALL incomplete plans normally. Do NOT infer or default to gaps-only mode.

Context files are resolved inside the workflow via `bgsd-tools init execute-phase` and per-subagent `<files_to_read>` blocks.
</context>

<process>
Execute the execute-phase workflow from @__OPENCODE_CONFIG__/bgsd-oc/workflows/execute-phase.md end-to-end.
Preserve all workflow gates (wave execution, checkpoint handling, verification, state updates, routing).
</process>
