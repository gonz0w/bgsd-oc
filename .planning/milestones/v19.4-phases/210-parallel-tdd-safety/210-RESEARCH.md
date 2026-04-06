# Phase 210: Parallel TDD Safety - Research

**Researched:** 2026-04-06
**Domain:** Node.js Atomics CAS mutex extension — TDD cache key namespace
**Confidence:** HIGH

## Summary

Phase 210 extends v19.3's hash-based 256-slot CAS mutex pool to TDD-specific cache keys (`tdd_audit:${plan_path}`, `tdd_proof:${plan_path}`, `tdd_summary:${plan_path}`). The mutex primitives (`getMutexValue`, `invalidateMutex`, `_mutexSlotForKey`, `_acquireMutex`, `_releaseMutex`) already exist in `src/lib/planning-cache.js` and are wired for `spawn_*` keys in `fanInParallelSpawns` (execute-phase.md:178,201,206). The TDD cache keys are new namespace additions — no existing code conflicts.

**Primary recommendation:** Extend `_mutexSlotForKey` to TDD key namespace, wire `getMutexValue`/`invalidateMutex` at TDD verification write points, use blocking CAS acquire for TDD cache writes (higher correctness requirement than spawn coordination).

## User Constraints

- Mutex granularity is LOCKED — shared 256-slot pool via `_mutexSlotForKey`
- Parallelism bounds are LOCKED — CPU-core adaptive (`min(configured_N, cpu_cores)`)
- Cache warming trigger is LOCKED — once per phase, serial, before parallel fan-out
- Blocking vs non-blocking acquire is DELEGATED to planner discretion
- Do NOT implement new mutex primitives — extend existing ones only

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `Atomics` | built-in (ES2020) | CAS primitives for mutex pool | Already used in v19.3 `_acquireMutex`/`_releaseMutex` |
| `SharedArrayBuffer` + `Int32Array` | built-in | 256-slot mutex pool backing | Already used in `PlanningCache._mutexPool` |
| `PlanningCache` | v19.3 existing | Cache layer with `getMutexValue`/`invalidateMutex` | Already wired for spawn keys; extends to TDD keys |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `os.cpus()` | Node.js built-in | CPU core count for adaptive parallelism | Bounded worker pool sizing |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Blocking CAS loop for TDD writes | Non-blocking `getMutexValue` pattern | TDD cache writes need stronger consistency guarantees than spawn coordination — blocking CAS is correct |
| Per-key mutex map | 256-slot shared pool | Shared pool is already implemented and verified; per-key adds complexity without benefit |

## Architecture Patterns

### Recommended Project Structure
```
src/lib/planning-cache.js   # extends getMutexValue/invalidateMutex to tdd_* key namespace
workflows/execute-phase.md  # adds TDD cache warming + parallel fan-out with mutex protection
```

### Pattern 1: Mutex-Protected TDD Cache Write
```
// Before parallel TDD fan-out: serial cache warm
cache.invalidateMutex(`tdd_audit:${planPath}`);
cache.invalidateMutex(`tdd_proof:${planPath}`);
cache.invalidateMutex(`tdd_summary:${planPath}`);

// During parallel verification:
// Worker A reads
const { value: auditVal } = await cache.getMutexValue(`tdd_audit:${planPath}`);
// Worker B writes same key → CAS blocks until A releases
// Worker A releases
cache.invalidateMutex(`tdd_audit:${planPath}`);
```

### Anti-Patterns to Avoid
- **Don't call `setComputedValue` on TDD keys without mutex protection** — will race
- **Don't use `getComputedValue` for TDD reads in parallel context** — can read stale data during concurrent invalidation
- **Don't increase mutex pool size** — 256 slots already provide sufficient fan-out for TDD workloads

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TDD cache race protection | Custom locking per key | Existing `getMutexValue`/`invalidateMutex` | Already implemented with CAS; adding custom locks creates maintenance burden |
| Parallel TDD coordination | Message queue or external broker | Shared `PlanningCache` + mutex pool | In-process, zero network, already wired in v19.3 |
| Mutex slot selection | Lock manager or external registry | `_mutexSlotForKey` djb2 hash | Already deterministic and tested |

## Common Pitfalls

### Pitfall 1: Forgetting to warm cache before parallel fan-out
**What goes wrong:** First parallel worker hits empty cache, recomputes, while second worker also hits empty cache and recomputes — both race to write the same key.
**Why it happens:** No serial cache warm before parallel fan-out.
**How to avoid:** Implement serial cache warm call at phase start before spawning parallel workers.
**Warning signs:** TDD audit shows duplicate timestamp entries or interleaved JSON.

### Pitfall 2: Releasing mutex on wrong slot after key remapping
**What goes wrong:** `_mutexSlotForKey` maps two different TDD keys to the same slot — releasing slot 42 after `tdd_audit:planA` inadvertently frees lock for `tdd_audit:planB`.
**Why it happens:** djb2 hash can collide; 256-slot pool means ~1/256 chance per additional key. Not a problem for 3 TDD keys, but scales with concurrency.
**How to avoid:** Design tasks so same-key races are the concern, not cross-key collisions. 256-slot collision rate is acceptable for TDD workloads.
**Warning signs:** Tests pass individually but fail under parallel batch.

### Pitfall 3: Map backend silently skips mutex operations
**What goes wrong:** `PlanningCache` with Map backend (no SQLite) returns `null` from `getMutexValue` — mutex is a no-op.
**Why it happens:** `_isMap()` check in `getMutexValue` returns `null` directly, bypassing mutex entirely.
**How to avoid:** Verify SQLite backend is active before relying on mutex protection; Map backend should not be used for parallel TDD workloads.
**Warning signs:** `backend: "map"` in cache notices output.

## Code Examples

### Existing mutex primitives (planning-cache.js:169-342)
```javascript
// Line 81: djb2 hash for slot selection
_mutexSlotForKey(key) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) % MUTEX_POOL_SIZE; // 256
}

// Line 97: CAS acquire
_acquireMutex(slot) {
  return Atomics.compareExchange(this._mutexPool, slot, 0, 1) === 0;
}

// Line 106: Release
_releaseMutex(slot) {
  Atomics.store(this._mutexPool, slot, 0);
}

// Line 169: Non-blocking read
getMutexValue(key) {
  const slot = this._mutexSlotForKey(key);
  const noWait = Atomics.waitAsync(this._mutexPool, slot, 0, 0);
  if (noWait.async) return noWait.value.then(() => this._getUnlocked(key));
  return Promise.resolve(this._getUnlocked(key));
}

// Line 325: Blocking invalidation with CAS loop
invalidateMutex(key) {
  const slot = this._mutexSlotForKey(key);
  while (true) {
    const old = Atomics.load(this._mutexPool, slot);
    if (Atomics.compareExchange(this._mutexPool, slot, old, 1) === old) {
      try { this.invalidateFile(key); }
      finally { this._releaseMutex(slot); }
      return;
    }
    Atomics.wait(this._mutexPool, slot, 1, 1); // 1ms yield
  }
}
```

### Existing TDD verification write points (state.js)
```javascript
// state.js:1528-1578 — tdd_audit validation checks
type: 'tdd_audit_missing'  // TDD audit file absent
type: 'tdd_audit_invalid'  // TDD audit file malformed
type: 'tdd_audit_empty'    // TDD audit file has no stages
type: 'tdd_audit_commit_missing' // commit missing from audit
```

### Existing fanInParallelSpawns pattern (execute-phase.md:168-208)
```javascript
// Shared cache for parallel spawn coordination (mutex-protected)
const cache = new PlanningCache({});

// Mutex-protected cache read for shared state before spawning
const { value: cachedResult } = await cache.getMutexValue(`spawn_${plan.plan_id}`);

// ... spawn child process ...

// Mutex-protected cache invalidation after spawn completes
cache.invalidateMutex(`spawn_${plan.plan_id}`);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|-------------|------------------|--------------|--------|
| No mutex on TDD cache keys | Extend mutex pool to `tdd_audit:${plan_path}`, `tdd_proof:${plan_path}`, `tdd_summary:${plan_path}` | Phase 210 (this phase) | Enables safe parallel TDD verification |
| `spawn_*` keys only | TDD key namespace | Phase 210 | Expands mutex coverage to TDD-specific keys |
| Non-blocking acquire for spawn coordination | Blocking CAS for TDD writes | Phase 210 (planner discretion) | Stronger consistency for TDD cache writes |

## Open Questions

1. **Blocking vs non-blocking acquire for TDD writes**: Context says delegated to agent discretion. Planner should evaluate whether TDD cache writes need blocking (higher consistency, blocks worker) or non-blocking (workers proceed, retry on conflict). Given TDD audit/proof data correctness requirements, blocking CAS is likely correct.
2. **TDD cache warming implementation**: Serial cache warm at phase start — which specific function call sequence? Likely `invalidateMutex` on all three TDD keys for all plans in phase, followed by `getMutexValue` to prime.
3. **Existing TDD cache key usage**: Do any existing code paths already write to `tdd_audit`, `tdd_proof`, or `tdd_summary` keys without mutex? Need to verify no existing callers before wiring.

## Sources

### Primary (HIGH confidence)
- `src/lib/planning-cache.js` — mutex primitives, `_mutexSlotForKey`, `_acquireMutex`, `_releaseMutex`, `getMutexValue`, `invalidateMutex` (lines 28-342)
- `workflows/execute-phase.md` — `fanInParallelSpawns` with existing mutex calls (lines 168-208)
- `.planning/phases/210-parallel-tdd-safety/210-CONTEXT.md` — locked decisions, phase boundary, stress-tested decisions
- `.planning/REQUIREMENTS.md` — REGR-01 through REGR-08 regression requirements

### Secondary (MEDIUM confidence)
- `.planning/milestones/v19.3-phases/205-wire-parallelization-safety/205-RESEARCH.md` — mutex infrastructure details, GAP-004 analysis
- `.planning/milestones/v19.3-phases/202-parallelization-safety/202-01-PLAN.md` — mutex primitive design rationale
- `.planning/research/PITFALLS.md` — cache invalidation races in parallel TDD stages

### Tertiary (LOW confidence)
- Memory of TDD cache race scenarios from earlier research (unverified by live parallel test)

## Metadata

**Confidence breakdown:** Architecture understanding is HIGH (source verified). Implementation insertion points for TDD mutex calls are MEDIUM (exact call sites not yet identified). Parallel test verification is LOW (no live parallel TDD workload test in codebase).

**Research date:** 2026-04-06

**Valid until:** 2026-04-13 (1 week — decisions are locked in CONTEXT.md, no scope uncertainty)
