---
description: Canonical read-only diagnostics command family
---
<objective>
Use the canonical diagnostics-family entrypoint for read-only inspection and analysis flows.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/workflows/progress.md
@__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-codebase-impact.md
@__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-trace-requirement.md
@__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-search-decisions.md
@__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-search-lessons.md
@__OPENCODE_CONFIG__/bgsd-oc/workflows/health.md
@__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-velocity.md
@__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-context-budget.md
@__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-session-diff.md
@__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-rollback-info.md
@__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-validate-deps.md
</execution_context>

<context>
$ARGUMENTS: Optional inspect target such as `progress`, `impact <file>`, `trace <requirement>`, `search decisions <query>`, `search lessons <query>`, `health`, `velocity`, `context-budget <phase-or-plan>`, `session-diff`, `rollback-info <plan>`, or `validate-deps <phase>`
</context>

<process>
Treat `/bgsd-inspect` as the canonical read-only diagnostics hub.

Covered inspect family routes in this slice:

- `progress`
- `impact`
- `trace`
- `search decisions`
- `search lessons`
- `health`
- `velocity`
- `context-budget`
- `session-diff`
- `rollback-info`
- `validate-deps`

Normalize the leading arguments onto the existing read-only workflow contracts:

- No sub-action or `progress` -> route to @__OPENCODE_CONFIG__/bgsd-oc/workflows/progress.md
- `impact <files...>` -> route to @__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-codebase-impact.md with the remaining arguments after `impact`
- `trace <requirement>` -> route to @__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-trace-requirement.md with the remaining arguments after `trace`
- `search decisions <query>` -> route to @__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-search-decisions.md with the remaining arguments after `search decisions`
- `search lessons <query>` -> route to @__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-search-lessons.md with the remaining arguments after `search lessons`
- `health [flags]` -> route to @__OPENCODE_CONFIG__/bgsd-oc/workflows/health.md in inspection-only mode with the remaining arguments after `health`
- `velocity` -> route to @__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-velocity.md
- `context-budget <phase-or-plan>` -> route to @__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-context-budget.md with the remaining arguments after `context-budget`
- `session-diff` -> route to @__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-session-diff.md
- `rollback-info <plan>` -> route to @__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-rollback-info.md with the remaining arguments after `rollback-info`
- `validate-deps <phase>` -> route to @__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-validate-deps.md with the remaining arguments after `validate-deps`

Legacy inspection aliases should resolve through these same normalized sub-actions rather than owning separate behavior.

Representative compatibility shims that must stay equivalent to this contract:

- `/bgsd-health` -> `/bgsd-inspect health`
- `/bgsd-impact` -> `/bgsd-inspect impact`
- `/bgsd-trace` -> `/bgsd-inspect trace`
- `/bgsd-search-decisions`, `/bgsd-search-lessons` -> `/bgsd-inspect search ...`
- `/bgsd-velocity`, `/bgsd-context-budget`, `/bgsd-session-diff`, `/bgsd-rollback-info`, `/bgsd-validate-deps` -> `/bgsd-inspect ...`

Preserve the remaining arguments after the normalized inspect prefix so canonical and legacy entrypoints stay behaviorally equivalent.

Excluded from `/bgsd-inspect` even if diagnostically adjacent:

- Mutating actions and repair flows
- Planning and settings families
- Review, security, readiness, and release families

Keep `/bgsd-inspect` limited to this read-only diagnostics boundary so a follow-on alias and regression slice can extend the family without changing its scope.
</process>
