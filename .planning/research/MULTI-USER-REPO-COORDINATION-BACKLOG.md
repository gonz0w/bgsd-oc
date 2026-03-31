# Multi-User Repo Coordination Backlog

## Milestone

Make bGSD safe and understandable for multiple users working in the same repository, with explicit ownership, recoverable handoffs, and a clear GitHub integration story.

## Planning Guidance

- This backlog is milestone-scoped, not implementation-ready at task level.
- Favor conservative plan-level coordination before exploring finer-grained task locking.
- Preserve the current single-user path unless multi-user behavior is explicitly enabled.
- Separate human-facing backlog management from machine-safe execution ownership.

## Epic 1: State Model Split

### Outcome

The system has a documented boundary between shared repo state and personal or session-scoped state.

### Backlog

- Inventory which parts of `STATE.md` are truly global versus personal.
- `Decision` Choose whether personal resume state lives in ignored local files, SQLite, or another local store.
- Define which fields remain human-authored versus generated views.
- Define backward-compatible migration from the current shared `STATE.md` model.

## Epic 2: Ownership and Claim Units

### Outcome

The system has one clear default unit of ownership for collaborative work.

### Backlog

- `Decision` Choose plan-level locking as the default or justify a different default.
- Define when phase-level locks are appropriate.
- Define whether task-level claims exist in the first milestone or are deferred.
- Define ownership states such as unclaimed, active, blocked, handoff, released, and stale.

## Epic 3: Lease and Recovery Semantics

### Outcome

Claims can be acquired, renewed, released, and safely recovered when work is abandoned.

### Backlog

- Define claim record fields: owner, timestamps, heartbeat, lease expiry, branch or workspace id, and status.
- `Decision` Define stale-claim reclamation policy: auto-expire, manual takeover, or mixed model.
- Define heartbeat expectations for long-running sessions.
- Define recovery and audit behavior when two users believe they own the same work.

## Epic 4: Execution Isolation Mapping

### Outcome

Ownership maps cleanly onto the actual execution environment.

### Backlog

- Define how claims bind to JJ workspaces, git branches, or other isolation units.
- `Research` Evaluate whether JJ workspace identity is a better ownership anchor than branch naming.
- Define expected behavior when a claimed plan moves to review, verification, or merge.
- Define how isolated execution metadata appears in team-visible coordination state.

## Epic 5: Handoff and Resume UX

### Outcome

One user can pause and another can resume without guesswork.

### Backlog

- Define the minimum handoff payload required to continue unfinished work.
- Define explicit handoff states and resume behavior.
- `Research` Evaluate whether summary artifacts are sufficient for handoff or whether a dedicated handoff record is needed.
- Define how blockers and pending decisions transfer between owners.

## Epic 6: GitHub Issues and Backlog Integration

### Outcome

Teams can use GitHub issues or project boards without confusing them with the machine-safe source of truth.

### Backlog

- `Decision` Choose whether GitHub issues are advisory only, preferred human-facing backlog, or partially authoritative for assignment.
- Define a recommended issue model such as one issue per plan or one issue per larger slice.
- Define label, assignee, and status conventions.
- Define how PR links, blocked status, and handoff notes sync with repo planning artifacts.

## Epic 7: Conflict Detection and Reconciliation

### Outcome

Concurrent updates to shared planning state are prevented, surfaced, or reconciled predictably.

### Backlog

- Define optimistic-concurrency or revision-check expectations for shared state updates.
- Define how conflicting claim mutations are detected.
- `Research` Evaluate whether markdown-only coordination is sufficient or whether a small machine-readable store is required.
- Define what users see when coordination state is stale or conflicting.

## Epic 8: Migration and Compatibility

### Outcome

The multi-user model can land without breaking existing solo workflows.

### Backlog

- Define feature flags or config gates for multi-user coordination.
- Define how current projects adopt the new model incrementally.
- Keep single-user progress, planning, and resume flows simple when collaborative features are off.
- Define docs and onboarding guidance for solo versus team usage.

## Cross-Cutting Unknowns

- Whether a shared markdown-first coordination model can stay pleasant under real team concurrency.
- Whether GitHub issue syncing should be pull-based, push-based, or mostly manual.
- Whether personal state should be invisible to git by default.
- Whether the first milestone should support multiple humans only, or also multiple agent sessions per human.

## Suggested Milestone Sequence

1. State split and ownership model
2. Lease semantics and stale recovery
3. Execution-environment mapping
4. GitHub issue integration policy
5. Handoff and resume flows
6. Conflict handling and migration plan

## Suggested Acceptance Criteria for the Milestone Agent

- The first milestone produces a concrete collaboration model, not just vague concurrency aspirations.
- Plan-level ownership is explicit and testable.
- GitHub usage is clearly described as optional, preferred, or partially authoritative.
- Stale recovery and handoff are included in scope.
- Single-user workflows remain low-friction.
