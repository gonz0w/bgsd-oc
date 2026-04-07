# Requirements: bGSD Plugin v19.4

**Defined:** 2026-04-06
**Core Value:** Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance.

## v19.4 Requirements

Requirements for v19.4 Workflow Acceleration II + TDD Reliability. Each maps to roadmap phases.

### Workflow Acceleration

- [x] **ACCEL-01**: `/bgsd-deliver-phase --fresh-step-context` pipeline works end-to-end — each step runs in fresh context, reads from snapshot+handoff, writes compact output, clears context, chains to next step
- [x] **ACCEL-02**: Stop points at checkpoints and interactive decisions are preserved through the full deliver-phase chain
- [x] **ACCEL-03**: JJ workspace proof gate remains mandatory on all deliver-phase paths — never bypassed by --fast or acceleration flags
- [x] **ACCEL-04**: Fresh-context chaining works after `/clear` — session can be cleared mid-chain and resumed from disk truth

### TDD Reliability

- [x] **TDD-01**: `execute:tdd validate-red` verifies test FAILED for expected missing behavior (not just exit code ≠ 0)
- [x] **TDD-02**: `execute:tdd validate-green` verifies test PASSED + test file NOT modified during GREEN phase
- [x] **TDD-03**: `execute:tdd validate-refactor` verifies all tests still pass + no new behavior added (test count unchanged)
- [x] **TDD-04**: TDD plan structure verification rejects malformed `type:tdd` plans at planning-time — required fields (test_file, impl_files, steps with RED/GREEN/REFACTOR sequence) are present and correctly ordered
- [x] **TDD-05**: TDD E2E fixture proves RED→GREEN→REFACTOR commit trail in actual repo — automated end-to-end validation of full TDD cycle
- [x] **TDD-06**: TDD rationale visibility in plan output — selected/skipped rationale surfaced in plan output and summary rendering
- [x] **TDD-07**: Planner evaluates TDD eligibility for every implementation plan, not only phases with explicit ROADMAP TDD hint
- [x] **TDD-08**: TDD decision rationale field on every `type:tdd` plan — structured in frontmatter, why TDD was selected or intentionally skipped

### Non-Regression (Must Not Break)

- [x] **REGR-01**: phase:snapshot continues to work as single CLI call replacing repeated phase discovery
- [x] **REGR-02**: verify:state complete-plan continues to work as atomic batched state mutation
- [x] **REGR-03**: Phase handoff artifacts (XX-HANDOFF.json) continue to enable fresh-context chaining between workflow steps
- [x] **REGR-04**: PlanningCache-backed plan reads continue to work with SQLite-first git-hash+mtime invalidation
- [x] **REGR-05**: Mutex-protected cache continues to prevent race corruption in parallel stages
- [x] **REGR-06**: Kahn topological sort with cycle detection continues to order parallel waves correctly
- [x] **REGR-07**: discuss-phase --fast and verify-work --batch N continue to work as shipped in v19.3
- [x] **REGR-08**: Deterministic TDD selection with rationale visibility continues as shipped in v16.1

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Workflow Acceleration (Future)

- **ACCEL-F1**: Dynamic parallelization — runtime dependency graph analysis to auto-detect parallelizable segments
- **ACCEL-F2**: Planner quality benchmark — measure plan quality delta between self-check-only and self-check+checker phases

### TDD Reliability (Future)

- **TDD-F1**: Dynamic TDD agent spawning per phase — pre-planned parallel waves already shipped, dynamic spawning deferred
- **TDD-F2**: TDD coverage analysis — measure what percentage of codebase has TDD test coverage

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Async I/O rewrite | CLI tool with short-lived processes (<5s); sync I/O appropriate; batching and caching shipped in v19.3 |
| Remove interactive discuss/verify steps | Loses quality gate value; defeats structured decision-making purpose; --fast and --batch reduce turns without removing checks |
| Subagent isolation per TDD phase | High coordination overhead; expensive per-task spawn cost; context compaction + file restriction gates already sufficient |
| Dynamic agent spawning | Violates agent cap of 9; pre-planned parallel waves via Kahn sort already shipped |
| Bundle dependency additions | No new npm dependencies — existing stack sufficient for v19.4 |
| CLI command surface changes | Non-goal per milestone intent; preserves backward compatibility |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status | Notes |
|-------------|-------|--------|-------|
| ACCEL-01 | Phase 207 | Complete | Fresh-context chaining pipeline |
| ACCEL-02 | Phase 207 | Complete | Checkpoint preservation |
| ACCEL-03 | Phase 207 | Complete | JJ proof gate mandatory |
| ACCEL-04 | Phase 207 | Complete | /clear-safe resumption |
| TDD-01 | Phase 206 | Complete | RED gate semantic validation |
| TDD-02 | Phase 211 | Complete | GREEN gate semantic validation |
| TDD-03 | Phase 211 | Complete | REFACTOR gate semantic validation |
| TDD-04 | Phase 211 | Complete | Plan structure verification at planning-time |
| TDD-05 | Phase 206 | Complete | E2E fixture for TDD cycle |
| TDD-06 | Phase 212 | Complete | Rationale visibility in output |
| TDD-07 | Phase 211 | Complete | Eligibility evaluation for ALL plans |
| TDD-08 | Phase 211 | Complete | Rationale field in plan frontmatter |
| REGR-01 | All phases | Regression | Must not break phase:snapshot |
| REGR-02 | All phases | Regression | Must not break verify:state complete-plan |
| REGR-03 | All phases | Regression | Must not break handoff artifacts |
| REGR-04 | All phases | Regression | Must not break PlanningCache |
| REGR-05 | All phases | Regression | Must not break mutex cache |
| REGR-06 | All phases | Regression | Must not break Kahn sort |
| REGR-07 | All phases | Regression | Must not break --fast/--batch modes |
| REGR-08 | All phases | Regression | Must not break TDD selection |

**Coverage:**
- v19.4 requirements: 17 total (8 P1, 4 P2, 5 non-regression)
- Mapped to phases: 5 phases
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-06*
*Last updated: 2026-04-06 during v19.4 milestone initialization*
