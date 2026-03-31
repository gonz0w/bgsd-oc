# Intent Cascade PRD

Lightweight product requirements for evolving bGSD intent from a single project document into a cascading project -> milestone -> phase system.

---

## Problem

The current INTENT framework captures useful project-level intent in `.planning/INTENT.md`, but it does not fully model how intent changes across milestone and phase boundaries.

Today:
- Project intent and milestone intent are effectively merged into one file.
- Planner and researcher workflows read project intent, but they do not receive a unified, computed "effective intent".
- Phase-level "why" lives only indirectly in ROADMAP goals and CONTEXT discussion.
- Verifiers can check requirements and outcomes, but they do not consistently evaluate whether work matched the intended reason for building it.

This creates a gap between:
- what we are building (`REQUIREMENTS.md`)
- what phase should deliver (`ROADMAP.md` / `PLAN.md`)
- why this work matters at the project, milestone, and phase levels

---

## Product Goal

Give every relevant agent a lightweight, cascading view of intent so the system understands both the requirement and the reason behind it.

The intent model should:
- stay lightweight and cheap to inject
- cascade cleanly from project to milestone to phase
- pair loosely with requirements, not replace them
- help planners, roadmappers, researchers, verifiers, and UAT flows reason about tradeoffs and alignment
- avoid excessive document sprawl or heavy maintenance burden

---

## Non-Goals

- Replacing `REQUIREMENTS.md` as the source of build scope
- Creating a large narrative strategy document for every phase
- Forcing all workflows to ask long intent questionnaires
- Adding a hidden database or non-markdown intent store

---

## Current State Summary

### Existing strengths

- `INTENT.md` already has a solid project-level schema: objective, users, outcomes, criteria, constraints, health, history.
- `plan:intent` CLI already supports create/show/update/validate/trace/drift.
- Planning workflows already understand that plans should trace to desired outcomes.

### Current limitations

- Only one active intent document exists.
- Milestone review mutates project intent instead of layering milestone intent on top.
- Plugin injection only exposes a small subset of intent data.
- Compaction mostly injects objective text, not the effective merged why.
- Phase-level intent is implicit rather than explicit.
- Some code paths still reflect older assumptions about intent structure.

---

## Proposed Model

### 1. Project intent stays in `INTENT.md`

`INTENT.md` remains the durable north star for the project:
- why the product exists
- who it serves
- desired long-term outcomes
- top-level success criteria and constraints

This file should change slowly.

### 2. Add milestone intent as a separate lightweight layer

Add `.planning/MILESTONE-INTENT.md` for the current milestone.

This document captures:
- why this milestone matters now
- which project outcomes it advances
- what is intentionally prioritized this milestone
- explicit non-goals for this milestone

This avoids overloading project intent with temporary milestone strategy.

### 3. Put phase intent inside phase `CONTEXT.md`

Do not add a separate `PHASE-INTENT.md`.

Instead, extend phase context with a small intent section that answers:
- why this phase exists inside the milestone
- what observable change it should unlock
- what it is not trying to solve

This keeps phase intent near the discussion and planning artifact agents already read.

---

## Cascade Semantics

The system should compute an `effective_intent` object by layering:

1. project intent
2. milestone intent
3. phase intent

The merge should be additive and lightweight:
- project defines the north star
- milestone narrows focus for the current release
- phase gives local purpose for the next planning/execution step

The lower level should refine, not silently overwrite, the higher level.

---

## Proposed File Responsibilities

### `.planning/INTENT.md`

Owns:
- objective
- target users
- desired outcomes
- success criteria
- long-lived constraints
- health metrics
- project-level evolution history

### `.planning/MILESTONE-INTENT.md`

Owns:
- milestone objective
- why now
- targeted project outcomes
- milestone priorities
- milestone non-goals
- milestone-specific constraints or tradeoffs

### `.planning/phases/XX-name/*-CONTEXT.md`

Owns:
- phase boundary
- implementation decisions
- specifics and references
- deferred ideas
- phase intent section for local purpose

---

## Effective Intent Shape

The injected object should stay compact. Example shape:

```json
{
  "project": {
    "objective": "...",
    "top_outcomes": ["DO-01", "DO-02"]
  },
  "milestone": {
    "objective": "...",
    "why_now": "...",
    "focus_outcomes": ["DO-02"]
  },
  "phase": {
    "purpose": "...",
    "user_change": "...",
    "non_goals": ["..."]
  },
  "effective": {
    "summary": "...",
    "priority_outcomes": ["DO-02"],
    "non_goals": ["..."]
  }
}
```

This is the payload agents should receive, not three raw documents pasted blindly into prompts.

---

## Workflow Integration

### New project

- Capture project intent into `INTENT.md`.
- Keep this focused on enduring product intent.

### New milestone

- Review project intent, but do not force milestone strategy into project intent.
- Create or refresh `MILESTONE-INTENT.md`.
- Use it to guide requirements selection and roadmap creation.

### Discuss phase

- Capture explicit phase intent in `CONTEXT.md`.
- Ask for lightweight phase purpose only when it materially affects implementation choices.

### Plan phase

- Inject computed `effective_intent` into researcher and planner spawns.
- Keep plan frontmatter tracing to project outcomes.
- Optionally add milestone or phase intent refs later if needed for auditability.

### Verify work / UAT

- Verify not only that requirements were implemented, but that the delivered behavior aligns with the effective intent for the phase.
- Distinguish requirement coverage from intent alignment.

---

## Agent Injection Targets

Inject effective intent anywhere purpose and alignment matter:

- `bgsd-roadmapper`
- `bgsd-planner`
- `bgsd-phase-researcher`
- `bgsd-verifier`
- `/bgsd-verify-work`
- progress/resume surfaces where compact intent reminders help

Lower priority or optional:
- executor
- debugger
- codebase mapper

The system should prefer compact summaries in hot paths and richer intent only in planning/verification flows.

---

## Why This Is Better

- Preserves a stable project north star
- Prevents milestone churn from polluting project intent
- Makes phase-level why explicit without adding another top-level file
- Gives agents a more useful prompt primitive than raw requirements alone
- Improves verification from "was it built" toward "did we build the right thing for the right reason"

---

## Migration Strategy

### Phase 1: normalize current intent foundation

- Fix stale assumptions in parser/injection paths
- Expand plugin intent parsing beyond objective-only usage
- Standardize summary generation around current `INTENT.md`

### Phase 2: introduce milestone intent

- Add `MILESTONE-INTENT.md` template and CLI support
- Update `/bgsd-new-milestone` to create/review it
- Compute merged intent in init/context builders

### Phase 3: extend phase context

- Add a small intent section to phase `CONTEXT.md`
- Update discuss/plan workflows to consume it

### Phase 4: wire verification and UAT

- Inject `effective_intent` into verifier and verify-work workflows
- Report requirement coverage and intent alignment separately

---

## Acceptance Criteria

- Project, milestone, and phase each have a clear lightweight home for intent
- Planner and roadmapper receive merged effective intent automatically
- Verifier can explain both requirement coverage and intent alignment
- New milestone workflow no longer overloads project intent with temporary priorities
- Phase intent can be captured without creating a separate top-level file
- Prompt injection remains compact enough for hot-path workflows

---

## Open Questions

- Should milestone intent support its own history log, or is milestone archive enough?
- Should plan frontmatter trace only project outcomes, or also milestone/phase intent refs?
- Should intent drift scoring evolve into layered drift scoring (project drift vs milestone drift)?
- Should roadmaps surface milestone intent summary directly in phase definitions?

---

## Recommendation

Adopt this shape:
- project intent: `INTENT.md`
- milestone intent: `MILESTONE-INTENT.md`
- phase intent: embedded in `CONTEXT.md`

And inject a computed `effective_intent` object into planning and verification flows.

This gives bGSD the lightweight cascading intent model it is currently missing without turning intent into a heavyweight planning subsystem.
