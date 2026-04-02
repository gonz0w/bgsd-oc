# Roadmap: bGSD Plugin

## Milestones

- ✅ **v19.0 Workspace Execution, cmux Coordination & Risk-Based Testing** - Phases 181-187 (shipped 2026-04-02)
- 🚧 **v19.1 Execution Simplicity, Speculative Decoding & JJ-First UX** - Phases 188-193 (active)

## Overview

v19.1 should land in the order the repo now needs: first remove JJ/Git correctness drift so bookmark/workspace truth is the local operating model, then add deterministic simplification analysis before expanding into a bounded refactor loop, and finally tighten agent, workflow, and template output contracts once the new artifact shapes are stable enough to benchmark. This roadmap follows the approved JJ-first UX, simplify, and speculative-decoding EDDs while keeping Git interop explicit but secondary.

## Phases

- [ ] **Phase 188: JJ Repo-State Correctness & Detached-HEAD Safety** - Make JJ-backed repos healthy by default even when Git is detached and expose bookmark-native repo state.
- [ ] **Phase 189: JJ-First Vocabulary & Interop-Safe Guidance** - Teach bookmark/workspace language everywhere local JJ behavior is the real source of truth.
- [ ] **Phase 190: Canonical Bookmark Lifecycle & Branch-Heavy Migration** - Compute and reuse canonical bookmark names for work ownership and move at least one branch-heavy surface onto bookmark semantics.
- [ ] **Phase 191: Simplification Targeting & Analysis Baseline** - Identify phase-touched simplification targets and emit deterministic analysis before any automation loop runs.
- [ ] **Phase 192: Bounded Simplification Loop & Verification Handoff** - Add the simplify decision step, refactor-only loop, and post-simplification proof handoff.
- [ ] **Phase 193: Stable Output Contracts & Measured Speculation Readiness** - Tighten structured output frames and prove the contract changes with measurable validation.

## Phase Details

### Phase 188: JJ Repo-State Correctness & Detached-HEAD Safety
**Goal**: Operators can trust JJ-backed repos as healthy local workspaces without false detached-HEAD failures and can inspect bookmark state directly
**Depends on**: Phase 187
**Requirements**: JJUX-02, JJUX-03
**Success Criteria** (what must be TRUE):
  1. User can run JJ-backed commit or health flows in a colocated repo without detached Git HEAD being treated as a generic failure.
  2. User can inspect bookmark existence, tracked status, target revision, and conflict state without relying on checked-out Git branch state.
  3. JJ-backed diagnostics prioritize `jj root`, `jj status`, and bookmark state, while detached HEAD is shown only as informational context when relevant.
**Plans**: 0 plans

### Phase 189: JJ-First Vocabulary & Interop-Safe Guidance
**Goal**: Users see one consistent JJ-first local mental model across help, workflows, docs, and runtime guidance while Git branch wording remains only where remote interop needs it
**Depends on**: Phase 188
**Requirements**: JJUX-01, JJUX-05
**Success Criteria** (what must be TRUE):
  1. User sees bookmark and workspace terminology as the default local vocabulary across JJ-first help, workflows, prompts, and runtime guidance.
  2. User can tell when a surface is describing local JJ ownership versus remote Git branch interoperability without mixed or drifting terminology.
  3. A colocated JJ repo user is guided toward `jj status`, `jj bookmark list`, and related JJ diagnostics instead of generic Git branch advice.
**Plans**: 0 plans

### Phase 190: Canonical Bookmark Lifecycle & Branch-Heavy Migration
**Goal**: Phase, milestone, and checkpoint-style work use canonical bookmark naming and bookmark lifecycle actions instead of Git branch assumptions
**Depends on**: Phase 189
**Requirements**: JJUX-04
**Success Criteria** (what must be TRUE):
  1. When bGSD starts or resumes phase or milestone work, it computes and reuses a canonical bookmark name for that line of work.
  2. User can see whether bGSD created, set, reused, or skipped a bookmark and whether a remote Git mapping is involved.
  3. At least one branch-heavy workflow surface behaves in bookmark terms rather than requiring Git branch checkout semantics.
**Plans**: 0 plans

### Phase 191: Simplification Targeting & Analysis Baseline
**Goal**: Users can identify which phase-touched files are real simplification targets and get deterministic simplification analysis before automation changes the code
**Depends on**: Phase 190
**Requirements**: SIMP-01, SIMP-02
**Success Criteria** (what must be TRUE):
  1. User can inspect a phase's touched files and see source targets separated from test or reference files.
  2. User can run simplification analysis for touched source files and receive structured JSON opportunities covering duplication, dead code, complexity, and clarity issues.
  3. Simplification analysis is deterministic enough that two humans can compare runs by stable fields, scores, and ranked opportunity shape instead of free-form prose.
**Plans**: 0 plans

### Phase 192: Bounded Simplification Loop & Verification Handoff
**Goal**: Execution can decide when simplification is warranted, run a bounded refactor-only simplify loop, and verify against the post-simplification state
**Depends on**: Phase 191
**Requirements**: SIMP-03, SIMP-04, SIMP-05
**Success Criteria** (what must be TRUE):
  1. After execution aggregation and before verification, bGSD can run a bounded simplification decision step that either skips clean output or starts simplification for justified opportunities.
  2. When simplification is warranted, user can run a refactor-only simplify loop that stops automatically at the configured threshold, improvement boundary, or max iterations without changing behavior.
  3. Verification and handoff artifacts reflect the post-simplification codebase, with before/after reporting that shows what changed and why proof applies to the simplified result.
**Plans**: 0 plans

### Phase 193: Stable Output Contracts & Measured Speculation Readiness
**Goal**: Agent, workflow, and template outputs become structurally predictable enough to reduce avoidable token variance and support measured speculation-oriented validation
**Depends on**: Phase 192
**Requirements**: SPEC-01, SPEC-02, SPEC-03, SPEC-04, SPEC-05, SPEC-06
**Success Criteria** (what must be TRUE):
  1. Structured agent outputs begin directly with required anchored frames instead of conversational preambles.
  2. Shared enums, key ordering, and section shapes stay consistent across planning, summary, verification, and workflow communication surfaces.
  3. Research-heavy and summary-heavy outputs use tighter canonical contracts that humans can compare run-to-run without schema drift or avoidable prose variance.
  4. Users can inspect measurable before/after validation showing contract hardening improved structural predictability or token-efficiency signals, rather than relying on unproven claims.
**Plans**: 0 plans

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 188. JJ Repo-State Correctness & Detached-HEAD Safety | 0/0 | Not started | - |
| 189. JJ-First Vocabulary & Interop-Safe Guidance | 0/0 | Not started | - |
| 190. Canonical Bookmark Lifecycle & Branch-Heavy Migration | 0/0 | Not started | - |
| 191. Simplification Targeting & Analysis Baseline | 0/0 | Not started | - |
| 192. Bounded Simplification Loop & Verification Handoff | 0/0 | Not started | - |
| 193. Stable Output Contracts & Measured Speculation Readiness | 0/0 | Not started | - |

---

*Last updated: 2026-04-02 after creating the v19.1 milestone roadmap*
