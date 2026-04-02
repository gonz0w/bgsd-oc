# Roadmap Template

Template for `.planning/ROADMAP.md`.

## Initial Roadmap (v1.0 Greenfield)

```markdown
# Roadmap: [Project Name]

## Overview

[One paragraph describing the journey from start to finish]

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: [Name]** - [One-line description]
- [ ] **Phase 2: [Name]** - [One-line description]
- [ ] **Phase 3: [Name]** - [One-line description]
- [ ] **Phase 4: [Name]** - [One-line description]

## Phase Details

### Phase 1: [Name]
**Goal**: [What this phase delivers]
**Depends on**: Nothing (first phase)
**Requirements**: [REQ-01, REQ-02, REQ-03]  <!-- brackets optional, parser handles both formats -->
**TDD**: recommended  <!-- optional: recommended | required | omit if not applicable -->
**Success Criteria** (what must be TRUE):
  1. [Observable behavior from user perspective]
  2. [Observable behavior from user perspective]
  3. [Observable behavior from user perspective]
**Plans**: [Number of plans, e.g., "3 plans" or "TBD"]

Plans:
- [ ] 01-01: [Brief description of first plan]
- [ ] 01-02: [Brief description of second plan]
- [ ] 01-03: [Brief description of third plan]

### Phase 2: [Name]
**Goal**: [What this phase delivers]
**Depends on**: Phase 1
**Requirements**: [REQ-04, REQ-05]
**Success Criteria** (what must be TRUE):
  1. [Observable behavior from user perspective]
  2. [Observable behavior from user perspective]
**Plans**: [Number of plans]

Plans:
- [ ] 02-01: [Brief description]
- [ ] 02-02: [Brief description]

### Phase 2.1: Critical Fix (INSERTED)
**Goal**: [Urgent work inserted between phases]
**Depends on**: Phase 2
**Success Criteria** (what must be TRUE):
  1. [What the fix achieves]
**Plans**: 1 plan

Plans:
- [ ] 02.1-01: [Description]

### Phase 3: [Name]
**Goal**: [What this phase delivers]
**Depends on**: Phase 2
**Requirements**: [REQ-06, REQ-07, REQ-08]
**Success Criteria** (what must be TRUE):
  1. [Observable behavior from user perspective]
  2. [Observable behavior from user perspective]
  3. [Observable behavior from user perspective]
**Plans**: [Number of plans]

Plans:
- [ ] 03-01: [Brief description]
- [ ] 03-02: [Brief description]

### Phase 4: [Name]
**Goal**: [What this phase delivers]
**Depends on**: Phase 3
**Requirements**: [REQ-09, REQ-10]
**Success Criteria** (what must be TRUE):
  1. [Observable behavior from user perspective]
  2. [Observable behavior from user perspective]
**Plans**: [Number of plans]

Plans:
- [ ] 04-01: [Brief description]

## Progress

**Execution Order:**
Phases execute in numeric order: 2 → 2.1 → 2.2 → 3 → 3.1 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. [Name] | 0/3 | Not started | - |
| 2. [Name] | 0/2 | Not started | - |
| 3. [Name] | 0/2 | Not started | - |
| 4. [Name] | 0/1 | Not started | - |
```

<guidelines>
**Initial planning (v1.0):**
- Phase count depends on depth setting (quick: 3-5, standard: 5-8, comprehensive: 8-12)
- Each phase delivers something coherent
- Phases can have 1+ plans (split if >3 tasks or multiple subsystems)
- Plans use naming: {phase}-{plan}-PLAN.md (e.g., 01-02-PLAN.md)
- No time estimates (this isn't enterprise PM)
- Progress table updated by execute workflow
- Draft notes may start uncertain, but once ROADMAP.md and STATE.md are written the phase plan counts must be numeric and execution-ready so downstream execution helpers never depend on `TBD` or similar placeholders

**CRITICAL — Checklist/section parity:**
- Every `### Phase N:` detail section MUST have a matching `- [ ] **Phase N: ...**` checklist entry
- Every checklist entry MUST have a matching `### Phase N:` detail section
- Mismatches cause `phase complete` to misidentify the last phase and prematurely declare milestone complete
- Run `validate roadmap` to detect and `validate roadmap --repair` to fix parity issues

**TDD field (optional):**
- `recommended` — Planner should prefer the dedicated TDD template for business logic, validation, and algorithms; checker reports non-TDD eligible-plan mismatches as warnings
- `required` — All plans with testable behavior should use the dedicated TDD template; checker reports violations as blockers
- Omit the field when TDD doesn't apply (config, UI layout, documentation phases); checker still reports the deterministic TDD selection path as info instead of staying silent
- This field controls Phase 149 selection/rationale severity only; it does **not** add Phase 150 `execute:tdd` semantic enforcement by itself
- The planner still must make a visible `> **TDD Decision:** Selected|Skipped` callout for every implementation plan; `Selected` maps to `type: tdd`, `Skipped` maps to `type: execute`
- A visible TDD decision alone does not justify `type: tdd`; use `type: execute` unless the plan actually uses the dedicated TDD template and structure
- The checker validates both plan eligibility and decision/type consistency

**Plan authoring guardrails:**
- Use stable verifier tokens in plan metadata: one exact expected marker per `contains` entry, not comma-separated prose bundles
- Keep task `<verify>` commands narrow and delta-specific; reserve plan `<verification>` for the aggregate final proof only
- Write command mentions for comparison or legacy context as reference-only placeholders, not runnable-looking malformed examples
- For validator-change slices, approval-time proof should stay on build plus targeted tests until the validator update lands

**Success criteria:**
- 2-5 observable behaviors per phase (from user's perspective)
- Cross-checked against requirements during roadmap creation
- Flow downstream to `must_haves` in plan-phase
- Verified by verify-work after execution
- Format: "User can [action]" or "[Thing] works/exists"

**After milestones ship:**
- Collapse completed milestones in `<details>` tags
- Add new milestone sections for upcoming work
- Keep continuous phase numbering (never restart at 01)
- When recreating a cleared active roadmap, inspect the most recent archived milestone roadmap first so the live milestone-grouped shape stays consistent
</guidelines>

<status_values>
- `Not started` - Haven't begun
- `In progress` - Currently working
- `Complete` - Done (add completion date)
- `Deferred` - Pushed to later (with reason)
</status_values>

## Milestone-Grouped Roadmap (After v1.0 Ships)

After completing first milestone, reorganize with milestone groupings:

```markdown
# Roadmap: [Project Name]

## Milestones

- ✅ **v1.0 MVP** - Phases 1-4 (shipped YYYY-MM-DD)
- 🚧 **v1.1 [Name]** - Phases 5-6 (in progress)
- 📋 **v2.0 [Name]** - Phases 7-10 (planned)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) - SHIPPED YYYY-MM-DD</summary>

### Phase 1: [Name]
**Goal**: [What this phase delivers]
**Plans**: 3 plans

Plans:
- [x] 01-01: [Brief description]
- [x] 01-02: [Brief description]
- [x] 01-03: [Brief description]

[... remaining v1.0 phases ...]

</details>

### 🚧 v1.1 [Name] (In Progress)

**Milestone Goal:** [What v1.1 delivers]

#### Phase 5: [Name]
**Goal**: [What this phase delivers]
**Depends on**: Phase 4
**Plans**: 2 plans

Plans:
- [ ] 05-01: [Brief description]
- [ ] 05-02: [Brief description]

[... remaining v1.1 phases ...]

### 📋 v2.0 [Name] (Planned)

**Milestone Goal:** [What v2.0 delivers]

[... v2.0 phases ...]

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | YYYY-MM-DD |
| 2. Features | v1.0 | 2/2 | Complete | YYYY-MM-DD |
| 5. Security | v1.1 | 0/2 | Not started | - |
```

**Notes:**
- Milestone emoji: ✅ shipped, 🚧 in progress, 📋 planned
- Completed milestones collapsed in `<details>` for readability
- Current/future milestones expanded
- Continuous phase numbering (01-99)
- Progress table includes milestone column
