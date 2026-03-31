# Workflow Acceleration PRD

**Project:** bGSD Plugin
**Author:** OpenCode
**Date:** 2026-03-28
**Status:** Backlog - Post-v16.0
**Target window:** After current milestone completion

## Problem

The core repeated workflow (`/bgsd-discuss-phase -> /bgsd-research-phase -> /bgsd-plan-phase -> /bgsd-execute-phase -> /bgsd-verify-work`) delivers high-quality results but feels slower than it should for daily use.

The slowdown is driven less by raw Node.js execution and more by orchestration overhead:
- repeated phase and artifact discovery across workflow steps
- repeated markdown parsing and repeated CLI calls for the same phase metadata
- high agent hop count in the happy path
- intentionally high-turn interactive steps in discuss and verify
- fragmented state updates that rewrite `STATE.md` multiple times per plan

## Goal

Make the core phase-delivery workflow materially faster while preserving:
- discussion quality
- low-context execution discipline
- checkpoint safety
- backward compatibility with existing `.planning/` artifacts
- single-file CLI deployment model

## Non-Goals

- Replacing markdown planning artifacts with a database-only system
- Removing interactive discuss or verify workflows entirely
- Breaking existing commands or forcing users onto a new workflow shape
- Adding heavy runtime dependencies without a clear ROI

## User Needs

### Primary user need
- As a repeat bGSD user, I want the normal discuss/research/plan/execute/verify loop to feel fast and lightweight without giving up structured outputs and quality gates.

### Secondary user needs
- I want to chain steps together without keeping one huge context window alive.
- I want fresh context between steps so I can `/clear` safely.
- I want the workflow to resume from compact on-disk state rather than conversation history.
- I want quick modes for routine work and deeper modes for ambiguous or risky phases.

## Key Insight

The right optimization is not "one giant agent session." The right optimization is "one chained workflow with tiny handoffs."

Each step should run in a fresh context window, read a compact phase handoff artifact, do its job, write a compact result, and exit. This preserves low context usage while enabling end-to-end chaining.

## Current Bottlenecks

### 1. Repeated phase metadata lookups
- `workflows/plan-phase.md` re-fetches roadmap phase data even after init has already resolved the phase.
- `workflows/research-phase.md` and `workflows/execute-phase.md` do additional phase discovery and artifact discovery that could come from a single precomputed snapshot.

### 2. Repeated directory and artifact scans
- `src/commands/init.js` performs repeated `readdirSync()` scans to rediscover `CONTEXT`, `RESEARCH`, `VERIFICATION`, `UAT`, plans, and summaries.
- This duplicates information already available through `findPhaseInternal()` and the cached phase tree.

### 3. Plan indexing reparses markdown unnecessarily
- `src/commands/misc.js` `cmdPhasePlanIndex()` rereads every plan file and reparses frontmatter/tasks even though the codebase already has SQLite-backed plan cache infrastructure.

### 4. Fragmented state mutations
- `workflows/execute-plan.md` updates plan advancement, progress, metrics, decisions, and continuity with multiple CLI calls.
- `src/commands/state.js` rewrites `STATE.md` repeatedly for what is logically one plan-completion event.

### 5. Too many agent hops in the happy path
- Research, planning, checking, revision loops, execution, verification, and gap closure can create a large number of agent boundaries even when the phase is straightforward.

### 6. High-turn interactive steps
- `discuss-phase` intentionally stretches decisions across multiple turns.
- `verify-work` presents one test per turn.
- Great for precision, slow for frequent use.

## Existing Strengths To Preserve

- `src/lib/helpers.js` phase-tree caching
- `src/lib/planning-cache.js` SQLite-backed planning cache
- `src/commands/research.js` research caching and resume support
- agent-scoped context trimming in `src/lib/context.js`
- markdown artifacts as durable human-readable interfaces

## Product Direction

Introduce a new acceleration layer that keeps the existing commands intact, while adding:
- shared phase snapshots
- compact machine-readable handoffs between steps
- batched state mutation commands
- optional fast modes for discuss and verify
- a fresh-context chained workflow for end-to-end delivery

## Proposed Solution

### A. Shared phase snapshot
Add a new CLI command, tentatively:
- `phase:snapshot <phase>`

It returns one compact structured object containing:
- phase metadata
- phase section text
- requirement IDs
- existing artifact paths
- plan index and wave map
- incomplete plans
- assertion coverage summary
- relevant lesson summary

This replaces repeated calls to disparate helpers such as roadmap phase lookup, plan indexing, and ad hoc artifact discovery.

### B. Compact handoff artifact for chained fresh-context execution
Add a durable file per phase, tentatively:
- `.planning/phases/XX-name/XX-HANDOFF.json`

It acts as the small, structured source of truth for cross-step chaining.

Suggested shape:

```json
{
  "phase": "146",
  "goal": "...",
  "requirements": ["REQ-1", "REQ-2"],
  "discussion": {
    "locked_decisions": [],
    "agent_discretion": [],
    "deferred": [],
    "open_questions": []
  },
  "research": {
    "standard_stack": [],
    "patterns": [],
    "pitfalls": [],
    "dont_hand_roll": []
  },
  "planning": {
    "plan_count": 0,
    "waves": [],
    "objectives": []
  },
  "execution": {
    "completed_plans": [],
    "remaining_plans": []
  },
  "verification": {
    "status": "pending",
    "gaps": []
  }
}
```

This enables chaining with fresh context windows:
- run one step
- write compact handoff update
- clear context
- next step reads the handoff only

### C. Batched plan-finalization mutations
Add a command like:
- `verify:state complete-plan`

It should atomically perform the currently fragmented work of:
- advance plan position
- update progress
- record metrics
- record decisions
- record session continuity
- optionally update roadmap/requirements side effects

This reduces repeated reads and writes of `STATE.md` and related planning artifacts.

### D. Fast interaction modes
Add optional modes without removing current high-quality defaults:

#### Discuss fast mode
- `discuss-phase --fast`
- batch low-risk clarification choices
- batch stress-test objections into one turn when appropriate
- still preserve locked decisions and deferred ideas

#### Verify batch mode
- `verify-work --batch 3`
- present 3 tests at a time for routine UI or CLI verification
- preserve one-at-a-time mode as default for ambiguous or high-risk testing

### E. Reduced agent hop count
Shorten the happy path by collapsing redundant boundaries where safe:
- planner performs a built-in self-check against checker rules before returning
- standalone checker spawn becomes conditional (`--strict`, low confidence, or failed self-check)
- gap-closure path remains available, but standard path gets fewer hops

### F. Fresh-context chained workflow
Add a new orchestrator command, tentatively:
- `/bgsd-deliver-phase <phase> --fresh-step-context`

Behavior:
- each step runs in a fresh agent/context window
- each step reads from compact handoff + phase snapshot
- each step writes compact output back to disk
- discussion remains interactive
- no step depends on prior chat transcript

Execution model:
1. Discuss if context is missing or decisions are incomplete
2. Research if missing or stale
3. Plan if missing or invalid
4. Execute plans
5. Verify phase goal
6. Optionally launch conversational UAT

## Quick Wins

### 1. Add `phase:snapshot`
Highest ROI read-path optimization. Replace repeated phase discovery, artifact lookup, and plan indexing with one CLI call.

### 2. Add batched `verify:state complete-plan`
Highest ROI write-path optimization. Replace the multi-call `STATE.md` mutation sequence with one logical transaction.

### 3. Reuse cached phase-tree data in init commands
Stop rescanning phase directories in multiple `init` flows for artifact path discovery.

### 4. Add `discuss-phase --fast`
Reduce user turns for routine phases while preserving the normal mode.

### 5. Add `verify-work --batch N`
Reduce repeated UAT turn overhead for easy-to-verify phases.

## Medium Refactors

### 1. Move `phase-plan-index` onto PlanningCache-backed reads
Use cached parsed plan/task data rather than rereading markdown files on each call.

### 2. Extend init output with more precomputed fields
Push more orchestration-time lookups into init/snapshot generation:
- requirement IDs
- phase section
- assertion coverage summary
- lesson summary
- plan wave map

### 3. Planner self-check before checker spawn
Fold a first-pass checker rubric into the planner prompt and reserve explicit checker spawns for stricter or lower-confidence cases.

### 4. Add handoff update command
Create a dedicated command such as `phase:handoff update` to merge step outputs into `XX-HANDOFF.json` safely and deterministically.

## Major Refactor

### Fresh-context delivery pipeline
Build a coded orchestration path that chains discuss/research/plan/execute/verify while explicitly avoiding long-lived context windows.

Principles:
- every step is resumable
- every step is restartable from disk state
- every step uses compact machine-readable handoffs
- raw transcripts are not required downstream
- human-readable markdown remains canonical for review, while JSON handoffs optimize token usage

## Requirements

### Functional requirements
- Users can chain the standard phase workflow without keeping one large context window alive.
- Each chained step can execute in a fresh context window.
- Discussion outcomes are preserved in a compact structured form that downstream steps can consume.
- Existing standalone commands continue to work.
- Fast modes are optional and do not replace the current default quality-focused behavior.

### Performance requirements
- Reduce repeated orchestration-time CLI calls for phase metadata and artifact discovery.
- Reduce per-plan `STATE.md` rewrite count during execution.
- Reduce average user turns required for discuss and verify in fast modes.

### Compatibility requirements
- No breaking changes to existing `.planning/ROADMAP.md`, `STATE.md`, `PLAN.md`, `SUMMARY.md`, `CONTEXT.md`, or `RESEARCH.md` files.
- `XX-HANDOFF.json` is additive.
- Commands degrade gracefully if the handoff file does not exist.

## Success Metrics

- Fewer CLI round-trips per phase workflow invocation
- Lower average wall-clock time for standard phase delivery
- Lower average user-turn count for discuss and verify in fast modes
- No regression in existing workflow correctness or checkpoint safety
- Chained fresh-context workflow can complete end-to-end with explicit `/clear`-safe boundaries

## Risks

### 1. Dual-source drift
Risk: markdown artifacts and handoff JSON diverge.
Mitigation: markdown remains canonical for human review; handoff is generated/updated deterministically from command outputs.

### 2. Over-optimization damages quality
Risk: fewer turns and fewer agents reduce decision quality.
Mitigation: keep current defaults, make fast paths opt-in, and preserve strict mode.

### 3. Increased complexity in orchestration code
Risk: optimization logic becomes harder to maintain than the workflows it replaces.
Mitigation: land quick wins first, measure, then introduce the chained fresh-context pipeline incrementally.

## Rollout Plan

### Phase 1: Quick wins
- add `phase:snapshot`
- add `verify:state complete-plan`
- remove duplicate artifact discovery in init flows
- add `discuss-phase --fast`
- add `verify-work --batch`

### Phase 2: Refactor reads and handoffs
- move plan indexing onto PlanningCache-backed reads
- add `phase:handoff update`
- generate and maintain `XX-HANDOFF.json`

### Phase 3: Fresh-context chaining
- add `/bgsd-deliver-phase --fresh-step-context`
- chain substeps through snapshot + handoff artifacts
- preserve stop points for checkpoints and interactive decisions

## Recommendation

Prioritize the quick wins first. They attack the highest-friction overhead without changing the product model.

Then build the fresh-context delivery pipeline as the long-term answer to "single command without giant context." That direction aligns with the existing bGSD architecture: durable planning artifacts, resumability, and CLI-first determinism.

## Backlog Placement

This PRD is intended as a post-v16.0 backlog item and seed proposal for a future phase focused on workflow acceleration, fresh-context chaining, and orchestration efficiency.
