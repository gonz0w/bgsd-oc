# CMUX-First OpenCode UX Backlog

## Milestone

Make `cmux` the primary live UX surface for OpenCode + bGSD without changing OpenCode itself.

## Planning Guidance

- This backlog is milestone-scoped, not implementation-ready at task level.
- Prioritize trustworthy session-level signals before attempting per-agent UI richness.
- Favor graceful fallback and low-noise behavior over maximal instrumentation.

## Epic 1: cmux Detection and Adapter

### Outcome

The plugin can safely detect `cmux` and target the active workspace with a single integration layer.

### Backlog

- Inventory the safest `cmux` presence checks: env vars, CLI, socket, and access mode behavior.
- `Decision` Choose CLI-first, socket-first, or hybrid adapter architecture.
- Define workspace targeting behavior for `CMUX_WORKSPACE_ID` and fallback cases.
- Define failure handling when `cmux` is installed but unreachable.

## Epic 2: State Mapping

### Outcome

Plugin lifecycle state maps cleanly to stable user-facing sidebar status.

### Backlog

- Define canonical workspace states: `working`, `waiting_input`, `blocked`, `idle`, `warning`, `complete`.
- `Research` Audit existing plugin hooks and notifier events for signal quality.
- `Decision` Define exact rules for transitioning between `waiting_input` and `idle`.
- Define blocker precedence over other statuses.

## Epic 3: Sidebar Status and Progress

### Outcome

The user gets glanceable status and progress from every active bGSD workspace.

### Backlog

- Define the sidebar status-pill vocabulary and label format.
- Define progress derivation from phase/plan/task/session state.
- `Research` Validate which progress sources are trustworthy enough for live display.
- Define when progress should be hidden rather than guessed.

## Epic 4: Sidebar Log and Attention UX

### Outcome

The user can understand recent events and react quickly when a workspace needs attention.

### Backlog

- Define the minimal useful sidebar log event set.
- Map checkpoints, blockers, warnings, and completions to `cmux notify`.
- `Decision` Decide whether command start events belong in the log or only major milestones.
- Tune dedupe and rate-limiting policy to avoid spam.

## Epic 5: Multi-Workspace and Agent Awareness

### Outcome

The integration works well when several OpenCode sessions run in parallel.

### Backlog

- Validate workspace-level behavior across multiple active `cmux` workspaces.
- `Research` Determine whether child-agent identity is reliably observable.
- `Decision` Decide whether the first milestone is session-only or includes limited agent-level detail.
- Define how unread attention states should clear after the user returns.

## Epic 6: Validation and Fallback

### Outcome

The feature improves UX in `cmux` without harming non-`cmux` usage.

### Backlog

- Define the fallback contract when `cmux` is absent.
- Validate rate limits, dedupe, and failure handling under noisy sessions.
- Validate that non-`cmux` OpenCode workflows behave unchanged.
- Run real end-to-end `cmux` sessions to confirm the UX is materially better, not just technically integrated.
