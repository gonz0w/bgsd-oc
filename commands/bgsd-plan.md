---
description: Group command for planning operations - project, discuss, research, assumptions, phase
---
<objective>
Router command that delegates to specific planning workflows based on first argument.

**Usage:**
- /bgsd plan project → new-project
- /bgsd plan discuss [phase] → discuss-phase
- /bgsd plan research [phase] → research-phase
- /bgsd plan assumptions [phase] → list-phase-assumptions
- /bgsd plan phase [phase] → plan-phase
</objective>

<execution_context>
Routes to: new-project, discuss-phase, research-phase, list-phase-assumptions, plan-phase
</execution_context>

<context>
$ARGUMENTS: First word is subcommand, rest are passed to target workflow.
</context>

<process>
## Routing Mechanism

The host editor parses `/bgsd plan <subcommand> [args]` as:
- Command: `bgsd-plan`
- Arguments: `<subcommand> [args]`

The bGSD plugin automatically injects project context via `<bgsd-context>` XML block
containing equivalent data to what was previously fetched via init:* CLI commands.

### Subcommand Routing

| Subcommand | Target Workflow | Context Injection |
|-----------|-----------------|-------------------|
| project | new-project.md | Empty/error allowed (new projects) |
| discuss | discuss-phase.md | Phase detected from args |
| research | research-phase.md | Phase detected from args |
| assumptions | list-phase-assumptions.md | Phase detected from args |
| phase | plan-phase.md | Phase detected from args |

Route all arguments to the target workflow unchanged.
</process>
