description: Canonical planning-family command for planning roadmap gaps and plan-scoped todos
---
<objective>
Use the canonical planning-family entrypoint for phase planning and planning-prep work.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/workflows/plan-phase.md
@__OPENCODE_CONFIG__/bgsd-oc/workflows/discuss-phase.md
@__OPENCODE_CONFIG__/bgsd-oc/workflows/research-phase.md
@__OPENCODE_CONFIG__/bgsd-oc/workflows/list-phase-assumptions.md
@__OPENCODE_CONFIG__/bgsd-oc/workflows/add-phase.md
@__OPENCODE_CONFIG__/bgsd-oc/workflows/insert-phase.md
@__OPENCODE_CONFIG__/bgsd-oc/workflows/remove-phase.md
@__OPENCODE_CONFIG__/bgsd-oc/workflows/plan-milestone-gaps.md
@__OPENCODE_CONFIG__/bgsd-oc/workflows/add-todo.md
@__OPENCODE_CONFIG__/bgsd-oc/workflows/check-todos.md
</execution_context>

<context>
$ARGUMENTS: Planning-family sub-action plus phase number roadmap details gap target or plan-scoped todo details
</context>

<process>
Treat `/bgsd-plan` as the canonical planning umbrella.

Covered planning-family routes in this slice:

- `phase`, `discuss`, `research`, and `assumptions` for phase-planning and planning-prep flows
- `roadmap add|insert|remove` for roadmap mutation
- `gaps` for the existing milestone-gap planning entrypoint
- `todo add|check` for plan-scoped todo capture and review

Normalize the first argument onto the existing planning-family workflow contract:

- `phase <phase-number> [flags]` → route to @__OPENCODE_CONFIG__/bgsd-oc/workflows/plan-phase.md with the remaining arguments
- `discuss <phase-number> [flags]` → route to @__OPENCODE_CONFIG__/bgsd-oc/workflows/discuss-phase.md with the remaining arguments
- `research <phase-number> [flags]` → route to @__OPENCODE_CONFIG__/bgsd-oc/workflows/research-phase.md with the remaining arguments
- `assumptions <phase-number> [flags]` → route to @__OPENCODE_CONFIG__/bgsd-oc/workflows/list-phase-assumptions.md with the remaining arguments
- `roadmap add <description>` → route to @__OPENCODE_CONFIG__/bgsd-oc/workflows/add-phase.md with the remaining arguments after `roadmap add`
- `roadmap insert <after> <description>` → route to @__OPENCODE_CONFIG__/bgsd-oc/workflows/insert-phase.md with the remaining arguments after `roadmap insert`
- `roadmap remove <phase-number>` → route to @__OPENCODE_CONFIG__/bgsd-oc/workflows/remove-phase.md with the remaining arguments after `roadmap remove`
- `gaps [milestone-or-context] [flags]` → route to @__OPENCODE_CONFIG__/bgsd-oc/workflows/plan-milestone-gaps.md with the remaining arguments
- `todo add <description>` → route to @__OPENCODE_CONFIG__/bgsd-oc/workflows/add-todo.md with the remaining arguments after `todo add`
- `todo check [area]` → route to @__OPENCODE_CONFIG__/bgsd-oc/workflows/check-todos.md with the remaining arguments after `todo check`

Legacy planning aliases should resolve through these same normalized sub-actions rather than owning separate behavior.

Representative compatibility shims that must stay equivalent to this contract:

- `/bgsd-plan-phase` → `/bgsd-plan phase`
- `/bgsd-add-phase`, `/bgsd-insert-phase`, `/bgsd-remove-phase` → `/bgsd-plan roadmap ...`
- `/bgsd-plan-gaps` → `/bgsd-plan gaps`
- `/bgsd-add-todo`, `/bgsd-check-todos` → `/bgsd-plan todo ...`

Preserve the remaining arguments after the normalized planning-family prefix so canonical and legacy entrypoints stay behaviorally equivalent.

Keep `/bgsd-plan` scoped to planning-family behavior only:

- Roadmap mutation belongs under the `roadmap` sub-family.
- Gap planning stays the milestone-gap entrypoint already owned by @__OPENCODE_CONFIG__/bgsd-oc/workflows/plan-milestone-gaps.md rather than becoming a new generalized gap product.
- Todos remain explicitly plan-scoped under `todo`; do not reopen a standalone general task-management surface.
- Settings and read-only inspection remain separate canonical families.

This normalized contract should be explicit enough for follow-on parity checks to compare canonical and legacy entrypoints without redefining behavior again.
</process>
