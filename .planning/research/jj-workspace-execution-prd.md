# JJ Workspace Execution PRD

Lightweight product requirements for replacing bGSD's Git worktree execution model with a JJ-first workspace and operation-log architecture.

---

## Problem

The current parallel execution model depends on Git worktrees.

Today:
- parallel execution is built around `execute:worktree` lifecycle commands
- execution orchestration assumes isolated Git worktrees that later merge back
- worktree setup, sync, merge, and cleanup add operational fragility
- testing around worktree behavior has been unreliable
- planner and roadmapper do not treat a richer JJ workspace model as a first-class planning capability

This creates a gap between:
- the parallelism bGSD wants to offer
- the operational safety and recovery users need
- the execution topology planners should understand when designing waves

Git worktrees have proven brittle enough that they should no longer remain an optional parallel backend.

---

## Product Goal

Make JJ mandatory for bGSD execution and replace Git worktrees with JJ workspaces plus JJ operation-log recovery.

The new model should:
- require a JJ repo for bGSD execution workflows
- remove Git worktree orchestration entirely
- use JJ workspaces for parallel plan execution
- use JJ's operation log for recovery, rollback, and investigation
- teach planner and roadmapper that cheap parallel workspaces are available
- keep Git only where JJ still depends on it or where Git remains the better integration surface

---

## Non-Goals

- Supporting execution without JJ initialized
- Keeping Git worktree support as a compatibility fallback
- Replacing Git hosting workflows such as PR creation if JJ is not the better tool there
- Allowing multiple agents to write concurrently in the exact same filesystem checkout
- Rewriting unrelated planning concepts just because execution storage changes

---

## Required Product Stance

This effort is intentionally opinionated:

- JJ is required or bGSD execution does not run
- Git worktree support is removed, not deprecated
- Git remains available only for necessary interoperability tasks such as remote hosting and PR flows

---

## Current State Summary

### Existing strengths

- Parallel execution already exists as a distinct execution mode in `workflows/execute-phase.md`
- Worktree state is already surfaced through `init execute-phase`
- Some internal docs and skills already acknowledge JJ as part of the broader VCS direction
- JJ is a good fit for operation-log-based recovery and multi-workspace development

### Current limitations

- The CLI still models parallel execution around Git worktree CRUD and merge-back operations
- Config and docs describe worktree isolation as the main concurrency primitive
- Tests are tightly coupled to Git worktree semantics
- The planner and roadmapper do not actively shape plans around JJ workspace availability
- The repo may be a plain Git repo with no colocated JJ store, which blocks JJ-native behavior entirely

---

## Proposed Model

### 1. JJ becomes a hard prerequisite

bGSD execution workflows must require a colocated JJ repo.

If a project is Git-only:
- execution commands fail with a clear setup error
- the error explains that JJ is required
- the error points the user to the supported initialization path

This is a product decision, not just an implementation detail.

### 2. Replace worktrees with JJ workspaces

Each parallel plan executes in its own JJ workspace.

That workspace should:
- share the same underlying repo/store
- start from a known parent revision or sibling topology chosen for the plan wave
- keep an isolated working copy for the agent
- be cheap to create, inspect, forget, and refresh

The system should stop thinking in terms of:
- create worktree
- copy files
- merge worktree back
- delete worktree branch

And instead think in terms of:
- create workspace
- assign plan workspace name and base revision
- execute plan in workspace
- reconcile resulting JJ changes into the target stack
- forget workspace when complete

### 3. Replace merge-first recovery with operation-log recovery

Recovery should rely on JJ's operation log rather than Git merge abort patterns.

The system should use JJ operations to:
- inspect what changed during a failed execution
- undo the latest bad operation when safe
- restore repo view to a prior known-good operation when needed
- explain divergence and stale workspace state to the user

This becomes the primary safety model for parallel execution.

### 4. Make planner and roadmapper workspace-aware

Planner and roadmapper should understand that JJ workspaces exist and are cheap enough to influence phase design.

They should:
- prefer parallel sibling plans when file overlap is low
- explicitly exploit workspace-backed plan waves where useful
- avoid unnecessary serialization when code can be developed in parallel workspaces
- understand that read-only or analysis-heavy agents may not need a dedicated workspace

This is not only an executor concern. It changes plan design.

---

## Execution Semantics

### Workspace-backed wave execution

For a multi-plan wave:

1. Determine the base revision set for the wave
2. Create one JJ workspace per runnable plan
3. Place each executor in its assigned workspace
4. Track plan-to-workspace mapping in structured execution state
5. Reconcile plan results through JJ-native revision operations
6. Forget temporary workspaces after successful integration or explicit recovery

### Integration strategy

The execution backend should integrate completed work using JJ-native concepts rather than Git merge-back assumptions.

Acceptable integration patterns may include:
- sibling changes created from the same parent and later ordered or rebased
- explicit integration commits or operations when plans truly converge
- bookmark-driven handoff where useful for named execution targets

The implementation should choose one canonical model and document it clearly.

### Stale workspace handling

Because JJ workspaces can become stale when another workspace rewrites shared history, bGSD must handle stale detection explicitly.

The system should:
- detect stale workspaces before and after execution
- refresh stale workspaces with the supported JJ command flow
- surface user-readable diagnostics when a workspace became stale because another plan rewrote shared ancestors

---

## CLI and Config Changes

### Remove worktree commands

Remove the Git worktree command family and its supporting docs/tests.

That includes the current `execute:worktree` lifecycle and associated config surfaces.

### Add JJ workspace execution commands

Introduce JJ-native execution commands for:
- workspace create/add
- workspace list/status
- workspace cleanup/forget
- workspace reconcile/integrate
- operation-log inspect/recover helpers where bGSD benefits from a stable wrapper

Exact command naming can be finalized during planning, but the command model should be JJ-native rather than worktree-shaped.

### Update config shape

Replace the current `worktree` config section with a JJ-focused execution section.

Example concerns:
- JJ required flag or enforced backend marker
- workspace base path or naming rules if needed
- max concurrent workspaces
- sparse pattern policy if later useful
- recovery policy defaults

The final schema should not preserve a fake compatibility `worktree` section.

---

## Agent and Workflow Integration

### Execution workflows

`/bgsd-execute-phase` should:
- stop referencing worktree mode
- expose JJ workspace capability in init context
- use JJ workspace lifecycle in parallel waves
- use JJ operation-log diagnostics in failure paths

### Planning workflows

`/bgsd-plan-phase` should receive compact JJ capability context such as:
- JJ available and required
- workspace-backed parallel execution available
- concurrency limits
- whether the repo topology favors sibling execution

### Roadmapping workflows

`/bgsd-new-project` and `/bgsd-new-milestone` should be able to plan future phases with knowledge that workspace-backed parallelism exists.

That means roadmap suggestions can assume:
- more aggressive parallel waves are viable
- plan decomposition can favor independent sibling slices
- operational recovery is stronger than the current worktree merge model

---

## Git's Remaining Role

Git remains in scope only where it is still necessary or clearly better.

Examples:
- GitHub PR creation and remote interoperability
- underlying Git-backed repo storage used by JJ
- Git-specific operations JJ does not replace well in current bGSD workflows

Git should no longer be the orchestration layer for parallel local execution.

---

## Migration Strategy

### Phase 1: make JJ a required environment assumption

- detect whether the project is a JJ repo
- fail fast for execution workflows when JJ is missing
- update docs, onboarding, and settings to state that JJ is required

### Phase 2: introduce JJ workspace backend

- add JJ workspace lifecycle commands
- replace worktree execution paths in orchestrators and init context
- track active workspaces and stale state

### Phase 3: operation-log recovery

- add operation-log-aware recovery helpers
- update failure handling, diagnostics, and resume flows
- document rollback and investigation patterns around JJ operations

### Phase 4: planner and roadmapper awareness

- inject JJ execution capabilities into planner and roadmapper context
- update plan heuristics for parallel sibling execution
- tune guidance for overlap-heavy versus overlap-light waves

### Phase 5: remove Git worktree code and tests

- delete worktree command implementation
- remove worktree config and docs
- replace worktree tests with JJ workspace coverage

---

## Acceptance Criteria

- bGSD execution workflows fail clearly when JJ is not initialized for the repo
- Git worktree execution code paths are removed
- Parallel plan execution uses JJ workspaces instead of Git worktrees
- Recovery flows use JJ operation-log concepts for undo, restore, and diagnosis
- Planner and roadmapper receive enough JJ capability context to shape faster parallel plans
- Config and docs describe JJ-first execution instead of worktree isolation
- Test coverage exists for workspace lifecycle, stale workspace recovery, and operation-log-based rollback behavior

---

## Risks

- JJ initialization becomes a hard adoption gate for all users
- Workspace reconciliation rules may be conceptually harder than current merge-back wording if not documented well
- Stale workspace behavior can surprise users who are new to JJ
- Existing tests and code paths assume Git worktree branch naming and cleanup semantics
- Some Git-centric integrations may need explicit exceptions rather than being fully JJ-native

---

## Open Questions

- What exact JJ-native integration pattern should become canonical for completed sibling plans?
- Should bGSD auto-bootstrap JJ for users, or require explicit human setup before execution starts?
- Which read-only or analysis-only agents should avoid dedicated workspaces by default?
- Should workspace naming be plan-based only, or also include wave and milestone metadata?
- How much JJ operation history should bGSD surface automatically versus keeping it as an advanced recovery tool?

---

## Recommendation

Adopt a hard JJ-first execution architecture:
- JJ required for execution
- JJ workspaces replace Git worktrees entirely
- JJ operation log becomes the primary local recovery model
- Git remains only for remote interoperability and cases where JJ is not the better tool

This directly addresses the instability of the current worktree implementation while giving bGSD a better foundation for parallel execution, safer recovery, and more workspace-aware planning.
