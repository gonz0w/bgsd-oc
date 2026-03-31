# CMUX-First OpenCode UX PRD

## Overview

This document defines a future milestone to make `cmux` the primary ambient UX layer for OpenCode + the bGSD plugin, with rich workspace status, progress, notifications, and agent-awareness driven entirely from plugin-side integrations.

This is a planning artifact only. No implementation is included here.

## Problem

The current plugin already understands meaningful execution state, but that state is not surfaced as a persistent, glanceable UI for users running multiple OpenCode sessions.

- The plugin has hook coverage for command start, idle events, tool completion, notifications, and session-state persistence.
- OpenCode itself is not being changed, so the plugin cannot rely on new first-party sidebar features.
- Users want a richer UX similar to Claude Code, where a sidebar shows whether agents are working, waiting for input, blocked, or idle.
- Today the plugin mostly converts state into prompt context and OS notifications rather than a live control surface.

This creates three gaps:

1. Users cannot quickly tell which OpenCode workspace needs attention.
2. Multi-workspace agent flows feel opaque compared with tools that expose visible run-state.
3. Valuable plugin state exists, but it is underutilized from a UX perspective.

## Goal

Define and eventually deliver a `cmux`-first experience where the bGSD plugin uses `cmux` sidebar metadata, notifications, and logging primitives as the main live HUD for OpenCode sessions.

The result should let a user glance at `cmux` and know:

- whether a workspace is active, idle, blocked, or waiting on input
- what phase/plan/task context is currently in flight
- how far along the current workflow is
- which workspaces need attention right now

## Non-Goals

- Modifying OpenCode core behavior or UI.
- Replacing OpenCode's existing chat/session model.
- Requiring `cmux` for normal plugin operation.
- Building a full custom orchestrator outside the plugin.
- Implementing true per-subagent panes unless reliable agent identity is exposed.

## Current State Summary

### Plugin strengths

- `plugin.js` already has lifecycle hook coverage for command enrichment, idle events, tool completion, and system prompt transforms.
- The plugin already stores structured session state, metrics, todos, blockers, and decisions.
- The notifier pipeline already supports dedupe, rate limiting, warning/critical escalation, and pending context injection.

### UX limitations

- State is not currently mirrored into a persistent visual workspace surface.
- Attention moments are mostly transient notifications rather than durable sidebar state.
- There is no stable mapping between plugin lifecycle state and user-facing statuses like `Working`, `Waiting`, `Blocked`, or `Idle`.

### cmux opportunity

- `cmux` already supports `notify`, `set-status`, `clear-status`, `set-progress`, `clear-progress`, `log`, and `sidebar-state`.
- `cmux` workspaces already expose sidebar metadata meant for AI coding agents.
- `cmux` can be detected inside managed terminals via `CMUX_WORKSPACE_ID`, `CMUX_SURFACE_ID`, and socket/CLI availability.

## User Personas Affected

- Maintainers running bGSD in a single focused `cmux` workspace.
- Power users juggling several OpenCode sessions in parallel.
- Users resuming interrupted work who need fast orientation.
- Users comparing multiple planning or execution branches across workspaces.

## Desired Outcomes

### Workspace awareness

- A user can glance at the `cmux` sidebar and see whether each bGSD workspace is active, waiting, blocked, or idle.
- The active workspace shows concise phase/plan/task context.

### Attention management

- Workspaces that need human input are visibly different from those that are merely running.
- Attention-worthy moments create `cmux` notifications with enough context to act quickly.

### Progress visibility

- Current milestone/phase/plan progress is surfaced through sidebar status and progress bars when available.
- Recent important events are visible through sidebar logs without opening the full session.

### Safe fallback

- When `cmux` is unavailable, the plugin continues working normally with no user-facing breakage.

## Functional Requirements

### FR1: cmux presence detection

The plugin must detect whether it is running inside or alongside a reachable `cmux` environment before attempting UX integration.

### FR2: Primary session state mapping

The plugin must map internal execution state to a small user-facing status model:

- `working`
- `waiting_input`
- `blocked`
- `idle`
- `warning`
- `complete`

### FR3: Sidebar status pill

The plugin must set and clear a `cmux` sidebar status pill that reflects the primary state of the current workspace.

### FR4: Sidebar progress

The plugin must set and clear `cmux` sidebar progress using phase, plan, task, or workflow-derived progress when reliable data exists.

### FR5: Sidebar log stream

The plugin must append concise, meaningful log lines for major lifecycle events such as:

- planner/executor start
- task completion
- pause/resume
- waiting on user input
- blocker detection
- state sync or validation warnings

### FR6: Attention notifications

The plugin must emit `cmux notify` events for attention-worthy moments, especially when the user must act.

### FR7: Noise control

The integration must dedupe repeated updates and rate-limit non-essential writes so the sidebar remains useful.

### FR8: Backward-compatible fallback

If `cmux` is not present or not reachable, the plugin must silently skip the integration and preserve current behavior.

## UX Requirements

### Status language

The workspace should use plain, high-signal labels such as:

- `Working`
- `Input needed`
- `Blocked`
- `Idle`
- `Complete`

### Context labels

When possible, the sidebar should include compact context such as:

- `Phase 155 P02`
- `Task 2/3`
- `Planning`
- `Verifying`

### Log style

Log entries should be short, action-oriented, and operationally useful.

Examples:

- `Planner started for Phase 156`
- `Task 1 complete`
- `Waiting on user decision`
- `State synced`
- `Next: /bgsd-plan-phase 156`

## Proposed Integration Model

### Source of truth

The bGSD plugin remains the source of truth for workflow state.

### UX surface

`cmux` becomes the primary visual surface for that state.

### Adapter boundary

Add a plugin-side adapter responsible for:

- detecting `cmux`
- targeting the current workspace
- translating plugin lifecycle events into `cmux` CLI or socket calls
- suppressing redundant updates

### Event sources

Use the plugin's existing lifecycle coverage as the event spine:

- `command.execute.before`
- `tool.execute.after`
- `event.session.idle`
- notifier events
- persisted session state and planning artifacts

## Risks

### High risk

- OpenCode may not expose enough structured checkpoints to perfectly distinguish `waiting_input` from generic inactivity.
- Per-agent identity may remain fuzzy if child-agent lifecycle is not cleanly surfaced.

### Medium risk

- Over-eager logging could make the sidebar noisy.
- `cmux` socket access mode may restrict calls outside fully managed terminals.
- Progress heuristics may feel misleading if they overfit limited state.

### Low risk

- Basic workspace-level status, progress, and notifications.
- Graceful fallback when `cmux` is absent.

## Open Questions for Later Research

1. What plugin lifecycle signals are reliable enough to represent `waiting_input` distinctly from `idle`?
2. Should the first implementation use `cmux` CLI only, socket API only, or a CLI-first/socket-later strategy?
3. Can child-agent activity be inferred well enough for per-agent sidebar lines, or should the milestone stay workspace-scoped?
4. Should the integration log every major workflow transition or only planner/executor/checkpoint events?
5. How should the plugin behave when `cmux` is installed but socket access mode blocks writes?

## Recommended Milestone Workstreams

1. `cmux` detection and adapter design
2. Session-state to sidebar-state mapping
3. Progress derivation and log policy
4. Waiting/blocker notification semantics
5. Fallback, rate limiting, and failure handling
6. Validation inside real multi-workspace `cmux` sessions

## Recommended Go/No-Go Gates

The milestone should stop and reassess if either of these fail:

- The plugin cannot reliably distinguish enough state to produce trustworthy status labels.
- `cmux` integration cannot run safely without causing noticeable noise or degraded plugin behavior.

## Handoff Notes for Planner and Researcher

- Treat this as a UX + integration milestone, not a core OpenCode modification.
- Prefer workspace-level truth first; add per-agent richness only if agent identity is reliable.
- Bias toward durable sidebar status and progress before ambitious orchestration visuals.
- Validate the real user experience in live `cmux` sessions, not only with synthetic hook tests.
