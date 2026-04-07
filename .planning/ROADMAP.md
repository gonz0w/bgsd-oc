# Roadmap: bGSD Plugin

## Milestones

- ✅ **v19.1 Execution Simplicity, Speculative Decoding & JJ-First UX** - Phases 188-200 (shipped 2026-04-05)
- 🚧 **v19.3 Workflow Acceleration** - Phases 201-203 (active)

## Overview

v19.3 accelerates workflow execution through measurement-grounded caching, fast-mode commands, and safe parallelization. The milestone first establishes a baseline so all subsequent changes have measurable proof of improvement. It then adds TTL-backed routing tables to PlanningCache, implements `--fast`/`--batch` flags to reduce turns on routine work, hardens parallel stages against cache races while preserving the JJ proof gate, and wires state validation after every batched write so correctness is never sacrificed for speed.

## Phases

- [x] **Phase 201: Measurement Foundation & Fast Commands** - Establish baseline telemetry, TTL-backed routing cache, batch freshness checks, and --fast/--batch hot-path commands (completed 2026-04-06)
- [ ] **Phase 202: Parallelization Safety** - Mutex-protected cache entries, Kahn sort verification, preserved JJ proof gate, and Promise.all fan-in coordination
- [x] **Phase 203: State Mutation Safety** - verify:state validate wired after batched writes, batch transaction support, sacred data never batched (completed 2026-04-07)

## Phase Details

### Phase 201: Measurement Foundation & Fast Commands
**Goal**: Establish baseline telemetry before any routing/caching changes and implement fast-mode commands that reduce turns for routine phases
**Depends on**: Phase 200
**Requirements**: ACCEL-01, ACCEL-02, ACCEL-03, ACCEL-04, FAST-01, FAST-02, FAST-03
**Success Criteria** (what must be TRUE):
  1. `workflow:baseline` runs and saves metrics to `.planning/research/ACCEL-BASELINE.json` before any routing/caching changes
  2. `orchestration.js` has adaptive telemetry hooks that log which routing paths are actually taken during execution
  3. `PlanningCache` stores and retrieves TTL-backed computed-value results for `classifyTaskComplexity` and `routeTask` without recomputing
  4. Batch freshness checks read N phase/plan fingerprints in a single SQLite transaction instead of per-file mtime checks
  5. `discuss-phase --fast` batches low-risk clarification choices and reduces turns for routine phases without changing defaults
  6. `verify-work --batch N` batches routine test verification while defaulting to one-at-a-time for ambiguous or high-risk work
  7. `workflow:hotpath` command shows which routing paths are most frequently used based on collected telemetry
**Plans**: 2/2 plans complete

### Phase 202: Parallelization Safety
**Goal**: Parallel stages share cache safely with mutex protection, verified Kahn-sort ordering, and preserved JJ workspace proof gates on all accelerated paths
**Depends on**: Phase 201
**Requirements**: PARALLEL-01, PARALLEL-02, PARALLEL-03, PARALLEL-04
**Success Criteria** (what must be TRUE):
  1. Parallel stages using a shared cache layer acquire mutex-protected entries so simultaneous invalidation of the same key returns consistent data
  2. `resolvePhaseDependencies` Kahn topological sort verification confirms correct parallel wave ordering before dispatch
  3. JJ workspace proof gate is preserved on all accelerated parallel paths — the proof check may be optimized but is never bypassed
  4. `Promise.all` fan-in coordinates independent workflow stage execution using `child_process.spawn` without corrupting shared state
**Plans**: TBD

### Phase 203: State Mutation Safety
**Goal**: Batched state writes are validated by regression checks and never interleave with sacred data mutations
**Depends on**: Phase 202
**Requirements**: STATE-01, STATE-02, STATE-03
**Success Criteria** (what must be TRUE):
  1. `verify:state validate` regression coverage runs after any batched state write in the execute-plan workflow and reports before proceeding
  2. `verify:state complete-plan` extends batch transaction support to non-sacred state mutations with atomic commits
  3. Sacred data writes (decisions, lessons, trajectories, requirements) are never batched — they always use the canonical single-write path
  4. `npm run build` smoke test runs after every plan and fails closed on bundle parity issues
  5. `util:validate-commands --raw` confirms CLI contract validity after any routing change
**Plans**: 1/1 plans complete

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 201. Measurement Foundation & Fast Commands | 0/2 | Complete    | 2026-04-06 |
| 202. Parallelization Safety | 0/TBD | Not started | - |
| 203. State Mutation Safety | 0/TBD | Complete    | 2026-04-07 |

---

*Last updated: 2026-04-07 after Phase 203 completion*
