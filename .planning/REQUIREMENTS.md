# Requirements: v19.3 Workflow Acceleration

**Defined:** 2026-04-05
**Core Value:** Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance.

## Categories

### ACCEL — Acceleration Infrastructure

- [x] **ACCEL-01:** Run `workflow:baseline` before any routing/caching changes and save baseline metrics to `.planning/research/ACCEL-BASELINE.json`
- [x] **ACCEL-02:** Add adaptive hot-path telemetry hooks to `orchestration.js` that log which routing paths are actually taken
- [x] **ACCEL-03:** Extend `PlanningCache` with TTL-backed computed-value tables for `classifyTaskComplexity` and `routeTask` results
- [x] **ACCEL-04:** Add batch freshness check to `PlanningCache` that reads N phase/plan fingerprints in a single SQLite transaction instead of per-file mtime checks

### FAST — Fast Mode Commands

- [x] **FAST-01:** Add `discuss-phase --fast` flag that batches low-risk clarification choices and reduces turns for routine phases
- [x] **FAST-02:** Add `verify-work --batch N` flag that batches routine test verification (default stays one-at-a-time for ambiguous/high-risk)
- [x] **FAST-03:** Add `workflow:hotpath` command that shows which routing paths are most frequently used based on telemetry

### PARALLEL — Parallelization

- [ ] **PARALLEL-01:** Add mutex-protected cache entries for parallel stages sharing cache layer
- [ ] **PARALLEL-02:** Add Kahn topological sort verification to `resolvePhaseDependencies` to ensure correct parallel wave ordering
- [ ] **PARALLEL-03:** Preserve JJ workspace proof gate on all accelerated parallel paths — proof check may be optimized but never bypassed
- [ ] **PARALLEL-04:** Add `Promise.all` fan-in coordination for independent workflow stage execution using `child_process.spawn`

### STATE — State Mutation Safety

- [x] **STATE-01:** Wire `verify:state validate` regression coverage into execute-plan workflow after any batched state write
- [x] **STATE-02:** Extend `verify:state complete-plan` with batch transaction support for non-sacred state mutations
- [x] **STATE-03:** Never batch sacred data writes (decisions, lessons, trajectories, requirements) — only cache/non-critical state

### BUNDLE — Bundle Integrity

- [x] **BUNDLE-01:** Run `npm run build` smoke test after every plan — bundle parity failures are a recurring issue pattern
- [x] **BUNDLE-02:** Run `util:validate-commands --raw` to confirm CLI contract after any routing change

## Traceability

| Requirement | Phase | Source |
|-------------|-------|--------|
| ACCEL-01 | 201 | Pitfalls #1 (measure first) |
| ACCEL-02 | 201 | Pitfalls #5 (adaptive telemetry) |
| ACCEL-03 | 201 | Stack (SQLite routing cache) |
| ACCEL-04 | 201 | Stack (batch I/O) |
| FAST-01 | 201 | Features (--fast mode) |
| FAST-02 | 201 | Features (--batch mode) |
| FAST-03 | 201 | Features (hot-path visibility) |
| PARALLEL-01 | 202 | Pitfalls #2 (cache races) |
| PARALLEL-02 | 202 | Architecture (Kahn sort) |
| PARALLEL-03 | 202 | Pitfalls #3 (JJ proof gate) |
| PARALLEL-04 | 202 | Stack (Promise.all spawn) |
| STATE-01 | 203 | Pitfalls #4 (state compatibility) |
| STATE-02 | 203 | Features (batched state) |
| STATE-03 | 203 | Pitfalls #4 (sacred data) |
| BUNDLE-01 | All | Pitfalls (bundle parity) |
| BUNDLE-02 | All | Architecture (CLI contract) |

## Out of Scope

- Async I/O rewrite — synchronous I/O is appropriate for CLI tool
- New npm dependencies — all work uses existing `node:sqlite`, `node:child_process`, `PlanningCache`
- Dynamic parallelization — runtime dependency graph auto-detection deferred to v2+
- Removing quality gates — acceleration without regression

## Future Requirements

- `/bgsd-deliver-phase --fresh-step-context` — end-to-end fresh-context chained delivery pipeline
- Dynamic parallelization — runtime dependency graph analysis to auto-detect parallelizable segments
- Planner self-check quality threshold calibration — when does self-check match standalone checker quality?
