---
description: Canonical read-only diagnostics command family
---
<objective>
Use the canonical diagnostics-family entrypoint for read-only inspection and analysis flows.
</objective>

<execution_context>
Route first. Do not preload sibling inspect-family workflows into context.
</execution_context>

<context>
$ARGUMENTS: Optional inspect target such as `progress`, `impact <file>`, `trace <requirement>`, `search decisions <query>`, `search lessons <query>`, `health`, `velocity`, `context-budget <phase-or-plan>`, `session-diff`, `rollback-info <plan>`, or `validate-deps <phase>`
</context>

<process>
Treat `/bgsd-inspect` as the canonical read-only diagnostics hub.

This is an operational command invocation, not a request to modify or audit the command family itself.
Do not inspect `commands/bgsd-inspect.md`, wrapper tests, or routing implementation unless the user explicitly asks for command-family implementation work.
After selecting the route, immediately execute the selected workflow and return that workflow's diagnostic result instead of narrating the routing analysis.

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

- No sub-action or `progress` -> route to `__OPENCODE_CONFIG__/bgsd-oc/workflows/progress.md`
- `impact <files...>` -> route to `__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-codebase-impact.md` with the remaining arguments after `impact`
- `trace <requirement>` -> route to `__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-trace-requirement.md` with the remaining arguments after `trace`
- `search decisions <query>` -> route to `__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-search-decisions.md` with the remaining arguments after `search decisions`
- `search lessons <query>` -> route to `__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-search-lessons.md` with the remaining arguments after `search lessons`
- `health [flags]` -> route to `__OPENCODE_CONFIG__/bgsd-oc/workflows/health.md` in inspection-only mode with the remaining arguments after `health`
- `velocity` -> route to `__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-velocity.md`
- `context-budget <phase-or-plan>` -> route to `__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-context-budget.md` with the remaining arguments after `context-budget`
- `session-diff` -> route to `__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-session-diff.md`
- `rollback-info <plan>` -> route to `__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-rollback-info.md` with the remaining arguments after `rollback-info`
- `validate-deps <phase>` -> route to `__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-validate-deps.md` with the remaining arguments after `validate-deps`

Preserve the remaining arguments after the normalized inspect prefix so each `/bgsd-inspect` sub-action stays behaviorally equivalent to its underlying workflow contract.

Excluded from `/bgsd-inspect` even if diagnostically adjacent:

- Mutating actions and repair flows
- Planning and settings families
- Review, security, readiness, and release families

Keep `/bgsd-inspect` limited to this read-only diagnostics boundary so follow-on slices can extend the family without changing its scope.

After you determine the target route, use the Read tool to load only the selected workflow file:

- `progress` -> `__OPENCODE_CONFIG__/bgsd-oc/workflows/progress.md`
- `impact` -> `__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-codebase-impact.md`
- `trace` -> `__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-trace-requirement.md`
- `search decisions` -> `__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-search-decisions.md`
- `search lessons` -> `__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-search-lessons.md`
- `health` -> `__OPENCODE_CONFIG__/bgsd-oc/workflows/health.md`
- `velocity` -> `__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-velocity.md`
- `context-budget` -> `__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-context-budget.md`
- `session-diff` -> `__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-session-diff.md`
- `rollback-info` -> `__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-rollback-info.md`
- `validate-deps` -> `__OPENCODE_CONFIG__/bgsd-oc/workflows/cmd-validate-deps.md`

Do not read non-selected sibling workflows unless the selected workflow explicitly requires them.
</process>
