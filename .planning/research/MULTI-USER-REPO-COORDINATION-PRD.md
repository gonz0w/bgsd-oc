# Multi-User Repo Coordination PRD

## Overview

This document defines a future milestone to make bGSD workable for multiple humans and agent sessions operating in the same repository at the same time.

This is a planning artifact only. No implementation is included here.

## Problem

The current planning model is strong for a single active operator, but it still assumes one shared live cursor for the repo.

- `STATE.md` acts like one canonical current position and one resume point.
- Session continuity is written as if one person or one active session owns the next step.
- Parallel execution support exists, but it focuses on isolated plan execution rather than long-lived team coordination.
- There is no first-class concept of ownership, lease, lock expiry, or handoff between collaborators.
- GitHub issues can complement planning, but they are not currently defined as part of the coordination model.

This creates five practical risks:

1. Two users can resume or execute the same plan without realizing it.
2. Shared state can become noisy or conflicting when multiple people update it.
3. There is no durable assignment model for phase, plan, or task ownership.
4. Human-readable backlog management and machine-readable execution state are blended together.
5. Teams cannot tell whether GitHub issues should be the source of truth, a mirror, or just an optional convenience.

## Goal

Define and eventually deliver a collaboration model where multiple users can safely use bGSD in one repo without corrupting planning state, duplicating work, or losing clarity about ownership.

The result should make it clear:

- what state is global versus personal
- what unit of work can be claimed
- how claims are acquired, renewed, and released
- how abandoned work is detected and recovered
- whether GitHub issues are advisory, mirrored, or authoritative for any part of the workflow

## Non-Goals

- Building a hosted multi-tenant backend service.
- Solving general project management for teams outside the repo.
- Replacing git, JJ, or normal branch/PR workflows.
- Designing real-time collaborative editing of markdown planning files.
- Implementing permissions, org auth, or enterprise identity systems.
- Implementing the milestone in this round.

## Primary Decision to Resolve

Before planning implementation, the milestone must decide which coordination model bGSD is actually targeting.

### Option A: Git-first coordination

Repo files remain the canonical source of truth. Locks, assignments, and team-visible state live in `.planning/` and move through normal version control.

### Option B: GitHub-assisted coordination

`.planning/` remains canonical for structure and planning artifacts, while GitHub issues and assignees become the main human coordination surface.

### Option C: Hybrid coordination with machine lock store

`.planning/` remains canonical for roadmap and plan artifacts, GitHub issues become the team-facing workflow surface, and a small machine-readable lock or assignment store handles ownership and lease semantics.

Current evidence suggests Option C is the strongest default because it separates human coordination from machine-safe concurrency control.

## Current State Summary

### State model

- `STATE.md` is a living project state file with one current position, one session continuity section, and one set of blockers and todos.
- `ROADMAP.md` and phase plan files are global artifacts shared by the repo.
- The architecture already describes a SQLite-backed local data layer and generated state view, but this is local to a checkout rather than a team-shared coordination backend.

### Execution model

- The system already supports parallel execution concepts and isolated execution environments.
- Worktree or workspace-style isolation reduces code overlap risk, but it does not by itself solve ownership or assignment conflict.

### Collaboration gap

- There is no first-class lock record for a phase, plan, or task.
- There is no lease expiry, heartbeat, abandonment detection, or explicit handoff state.
- There is no model for multiple personal resume cursors in the same repo.

### GitHub opportunity

- GitHub issues, assignees, labels, and projects are a plausible team-facing coordination layer.
- GitHub issues are good at visibility and discussion, but weak at atomic compare-and-set style updates.
- The milestone must decide whether GitHub is an optional mirror, a preferred planning UX, or part of the canonical coordination contract.

## User Personas Affected

- Two maintainers working different plans in the same active milestone.
- A reviewer or verifier picking up work after another contributor pauses.
- A team lead using GitHub issues or project boards to understand ownership and blockers.
- An individual contributor running multiple local sessions or agent flows against one repo.

## Desired Outcomes

### Safe parallel work

- Multiple users can work in the same repo without accidentally claiming the same plan.
- Shared planning state stays trustworthy under concurrent use.

### Clear ownership

- Every active plan has a visible owner or is explicitly unclaimed.
- Handoffs and blocked work are durable and easy to understand.

### Recoverable coordination

- Abandoned or stale work can be detected and reclaimed safely.
- The system distinguishes active ownership from stale claims.

### Practical project management

- Teams can use GitHub issues or a similar backlog surface without duplicating all machine state by hand.
- Backlog and assignment workflows are understandable by humans, not only agents.

## Functional Requirements

### FR1: Global versus personal state separation

The milestone must define which planning data is shared repo state and which data is user- or session-scoped.

### FR2: Claimable work units

The system must define the claimable unit of ownership: phase, plan, task, or a combination with explicit defaults.

### FR3: Lease-based ownership model

Claims must support acquisition, renewal, expiry, release, and takeover rules.

### FR4: Stale-work recovery

The system must define how stale or abandoned work is detected and how another user safely recovers it.

### FR5: Branch or workspace affinity

The coordination model must define how ownership maps to branch names, JJ workspaces, git worktrees, or equivalent isolated execution environments.

### FR6: Handoff state

The system must support explicit handoff metadata so one user can pause and another can continue with minimal ambiguity.

### FR7: GitHub issue integration policy

The milestone must define whether GitHub issues are:

- optional and advisory only
- the preferred human-facing backlog
- partially authoritative for assignment state

### FR8: Conflict-resistant updates

The coordination model must define how conflicting updates are prevented, detected, or reconciled when multiple users touch shared planning state.

### FR9: Backlog visibility

Future milestone candidates and multi-user work items must be representable in a human-readable backlog without depending on one shared `STATE.md` cursor.

## Recommended Product Shape

The future milestone should start from this opinionated baseline unless later research disproves it:

- Global planning artifacts stay in `.planning/`.
- Personal resume state becomes namespaced or local rather than living in one shared live cursor.
- Plan-level locking is the default ownership unit.
- Task-level locking is optional and only used for exceptional collaboration within one plan.
- Phase-level locking is reserved for planning and re-planning, not everyday execution.
- GitHub issues are used as the human-facing backlog and assignment surface.
- A small machine-readable store handles lock state, lease timestamps, and revision checks.

## Proposed Conceptual Model

### Global state

Shared artifacts such as roadmap, plans, verification status, and team-visible assignment status.

### Personal state

Local resume pointers, temporary notes, and per-user continuity that should not force merge conflicts in shared repo state.

### Claim record

Each active claim should be able to represent at least:

- work unit id
- owner
- claimed at
- last heartbeat
- lease expiry
- branch or workspace id
- status such as active, blocked, handoff, released, stale

### Revision-aware updates

Any mutation of shared coordination state should assume optimistic concurrency and check whether the targeted revision is still current.

## Success Criteria

The milestone is successful when all of the following are true:

1. The system has a documented split between global and personal state.
2. Teams can claim and release plan ownership without relying on tribal knowledge.
3. Stale or abandoned work can be reclaimed safely.
4. The preferred GitHub integration model is explicit.
5. Shared planning state remains understandable and conflict-resistant under multiple active users.
6. Handoffs between collaborators are part of the model, not an afterthought.

## Constraints

- Preserve the existing single-user workflow as the default low-friction path.
- Avoid turning the planning system into a heavyweight external PM platform.
- Avoid requiring GitHub for repos that use bGSD purely locally.
- Respect existing `.planning/` documents and favor backward-compatible evolution.
- Avoid coupling the first milestone to real-time networking or hosted infrastructure.

## Risks

### High risk

- Shared markdown files such as `STATE.md` may remain merge-conflict magnets if they continue to hold one live cursor for all collaborators.
- GitHub issues may appear authoritative to humans while drifting from actual on-disk execution state.
- Overly coarse locking could slow teams down and create unnecessary bureaucracy.

### Medium risk

- Supporting both git-only and GitHub-assisted modes may add product complexity.
- Lease expiry rules may feel too aggressive or too weak without real usage data.
- Personal versus shared state boundaries may be unclear at first.

### Low risk

- Adding milestone-level backlog artifacts and planning guidance.
- Starting with plan-level ownership before exploring finer-grained task locking.

## Open Questions for Later Research

These should be left to a later milestone researcher rather than prematurely answered here:

1. Should personal state live in repo files, ignored local files, SQLite, or a mixed model?
2. Should claims be recorded in markdown, JSON, SQLite, or a generated hybrid representation?
3. Should JJ workspace metadata become the primary execution-ownership anchor instead of git branch names?
4. How should a stale lock be reclaimed: automatic expiry, manual override, or explicit takeover flow?
5. What is the minimum GitHub integration that still feels genuinely useful?
6. Should GitHub issues map one-to-one with plans, or only with larger milestones and epics?
7. What workflow should exist for handoff from one user to another during an unfinished plan?
8. How should verification behave when multiple owned plans converge in one phase?
9. Which parts of current `STATE.md` should move to generated views versus durable source records?

## Suggested Milestone Shape

The first milestone for this topic should likely proceed in this order:

1. Define the state split and ownership model.
2. Choose the claim unit and lease semantics.
3. Define a minimal machine-readable lock store.
4. Define optional GitHub issue and project-board integration.
5. Define handoff and stale-work recovery flows.
6. Plan backward-compatible migration from the current single-user `STATE.md` model.

## Suggested Acceptance Criteria for the Milestone Agent

- The milestone starts by clarifying ownership semantics before adding UI or automation layers.
- GitHub issue integration is scoped as support for coordination, not a premature replacement for core planning artifacts.
- The design preserves a clean single-user mode.
- The first implementation slice is plan-level and conservative rather than phase-wide and heavy-handed.
- The milestone includes stale-claim recovery and handoff behavior, not just happy-path claiming.
