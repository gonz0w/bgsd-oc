description: Canonical planning-family command for planning roadmap gaps and plan-scoped todos
---
<objective>
Use the canonical planning-family entrypoint for phase planning and planning-prep work.
</objective>

<execution_context>
Route first. Do not preload sibling planning-family workflows into context.
</execution_context>

<context>
$ARGUMENTS: Planning-family sub-action plus phase number roadmap details gap target or plan-scoped todo details
</context>

<process>
Treat `/bgsd-plan` as the canonical planning umbrella.

This is an operational command invocation, not a request to inspect or explain the planning-family router itself.
After selecting the route, immediately execute the selected workflow and continue that workflow's planning or planning-prep behavior instead of stopping at routing analysis.

Covered planning-family routes in this slice:

- `phase`, `discuss`, `research`, and `assumptions` for phase-planning and planning-prep flows
- `roadmap add|insert|remove` for roadmap mutation
- `gaps` for the existing milestone-gap planning entrypoint
- `todo add|check` for plan-scoped todo capture and review

Normalize the first argument onto the existing planning-family workflow contract:

- `phase <phase-number> [flags]` → route to `__OPENCODE_CONFIG__/bgsd-oc/workflows/plan-phase.md` with the remaining arguments
- `discuss <phase-number> [flags]` → route to `__OPENCODE_CONFIG__/bgsd-oc/workflows/discuss-phase.md` with the remaining arguments
- `research <phase-number> [flags]` → route to `__OPENCODE_CONFIG__/bgsd-oc/workflows/research-phase.md` with the remaining arguments
- `assumptions <phase-number> [flags]` → route to `__OPENCODE_CONFIG__/bgsd-oc/workflows/list-phase-assumptions.md` with the remaining arguments
- `roadmap add <description>` → route to `__OPENCODE_CONFIG__/bgsd-oc/workflows/add-phase.md` with the remaining arguments after `roadmap add`
- `roadmap insert <after> <description>` → route to `__OPENCODE_CONFIG__/bgsd-oc/workflows/insert-phase.md` with the remaining arguments after `roadmap insert`
- `roadmap remove <phase-number>` → route to `__OPENCODE_CONFIG__/bgsd-oc/workflows/remove-phase.md` with the remaining arguments after `roadmap remove`
- `gaps [milestone-or-context] [flags]` → route to `__OPENCODE_CONFIG__/bgsd-oc/workflows/plan-milestone-gaps.md` with the remaining arguments
- `todo add <description>` → route to `__OPENCODE_CONFIG__/bgsd-oc/workflows/add-todo.md` with the remaining arguments after `todo add`
- `todo check [area]` → route to `__OPENCODE_CONFIG__/bgsd-oc/workflows/check-todos.md` with the remaining arguments after `todo check`

Preserve the remaining arguments after the normalized planning-family prefix so each `/bgsd-plan` sub-action stays behaviorally equivalent to its underlying workflow contract.

Keep `/bgsd-plan` scoped to planning-family behavior only:

- Roadmap mutation belongs under the `roadmap` sub-family.
- Gap planning stays the milestone-gap entrypoint already owned by `__OPENCODE_CONFIG__/bgsd-oc/workflows/plan-milestone-gaps.md` rather than becoming a new generalized gap product.
- Todos remain explicitly plan-scoped under `todo`; do not reopen a standalone general task-management surface.
- Settings and read-only inspection remain separate canonical families.

This normalized contract should be explicit enough for follow-on parity checks across planning sub-actions without redefining behavior again.

After you determine the target route, use the Read tool to load only the selected workflow file:

- `phase` -> `__OPENCODE_CONFIG__/bgsd-oc/workflows/plan-phase.md`
- `discuss` -> `__OPENCODE_CONFIG__/bgsd-oc/workflows/discuss-phase.md`
- `research` -> `__OPENCODE_CONFIG__/bgsd-oc/workflows/research-phase.md`
- `assumptions` -> `__OPENCODE_CONFIG__/bgsd-oc/workflows/list-phase-assumptions.md`
- `roadmap add` -> `__OPENCODE_CONFIG__/bgsd-oc/workflows/add-phase.md`
- `roadmap insert` -> `__OPENCODE_CONFIG__/bgsd-oc/workflows/insert-phase.md`
- `roadmap remove` -> `__OPENCODE_CONFIG__/bgsd-oc/workflows/remove-phase.md`
- `gaps` -> `__OPENCODE_CONFIG__/bgsd-oc/workflows/plan-milestone-gaps.md`
- `todo add` -> `__OPENCODE_CONFIG__/bgsd-oc/workflows/add-todo.md`
- `todo check` -> `__OPENCODE_CONFIG__/bgsd-oc/workflows/check-todos.md`

Do not read non-selected sibling workflows unless the selected workflow explicitly requires them.
</process>
