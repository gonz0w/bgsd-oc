# Phase 210: Parallel TDD Safety - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<phase_intent>
## Phase Intent
- **Local Purpose:** Add mutex protection to TDD cache keys to enable safe parallel TDD verification stages
- **Expected User Change:** Before: parallel TDD verification could race on cache writes causing inconsistent audit/proof data. After: mutex per TDD cache key ensures consistent state; bounded parallelism limits resource usage
- **Non-Goals:**
  - Not adding new TDD cache key types (audit/proof/summary already exist)
  - Not changing TDD validator semantics (RED/GREEN/REFACTOR gates)
  - Not implementing general-purpose mutex primitives outside TDD scope
</phase_intent>

<domain>
## Phase Boundary
Extends v19.3 mutex infrastructure (hash-based 256-slot CAS pool) to TDD-specific cache keys (tdd_audit:${plan_path}, tdd_proof:${plan_path}, tdd_summary:${plan_path}). Enables safe parallel fan-out of TDD verification operations within a phase.
</domain>

<decisions>
## Implementation Decisions

### High-Impact Decisions
- **Mutex granularity** — Locked: Shared pool. TDD cache keys use existing 256-slot hash-based mutex pool via `_mutexSlotForKey`. Natural fan-out limited by slot collision rate (same mechanism as v19.3).

### Medium Decisions
- **Blocking vs non-blocking acquire** — Delegated to agent discretion. Planner determines based on usage patterns (serial vs parallel TDD batch contexts).
- **Parallelism bounds** — Locked: CPU-core adaptive. Workers = min(configured_N, cpu_cores). Balances resource efficiency with predictable performance.
- **Cache warming trigger** — Locked: Once per phase. Serial cache-warm at phase start before parallel fan-out ensures fresh state without per-invocation overhead.

### Low Defaults and Open Questions
- **Cache key namespace** — Defaulted: Use `tdd_audit:${plan_path}`, `tdd_proof:${plan_path}`, `tdd_summary:${plan_path}` per roadmap spec.

### Agent's Discretion
- Blocking vs non-blocking acquire behavior (delegated)
</decisions>

<specifics>
## Specific Ideas
- Extend `_mutexSlotForKey` pattern from `src/lib/planning-cache.js` to TDD cache key namespace
- Use existing `_acquireMutex`/`_releaseMutex` CAS operations
- TTL and freshness checks remain as-is from Phase 208
</specifics>

<stress_tested>
## Stress-Tested Decisions
All decisions held up under stress testing — no revisions needed.
</stress_tested>

<deferred>
## Deferred Ideas
None — discussion stayed within phase scope.
</deferred>

---
*Phase: 210-parallel-tdd-safety*
*Context gathered: 2026-04-06*
