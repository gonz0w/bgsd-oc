# Phase 205: Wire Parallelization Safety - Research

**Researched:** 2026-04-05
**Domain:** Parallelization safety wiring — Kahn sort wave ordering, mutex-protected cache access, decision rule triggering
**Confidence:** HIGH

## Summary

Phase 205 closes integration gaps identified in the v19.3 audit by wiring three "dead code" islands into live execution paths. The infrastructure already exists (Kahn sort in `resolvePhaseDependencies`, mutex primitives in `PlanningCache`, fan-in spawn in the execute-phase workflow), but it was never connected. This phase makes those connections.

**Primary recommendation:** Set `enrichment.phases = roadmap.phases` in `command-enricher.js` to trigger the Kahn sort decision rule, then route the computed waves into `fanInParallelSpawns` instead of using the frontmatter `wave` field.

## User Constraints

From `REQUIREMENTS.md` (PARALLEL-01, PARALLEL-02):
- Mutex-protected cache entries for parallel stages sharing cache layer
- Kahn topological sort verification in `resolvePhaseDependencies` for correct parallel wave ordering

From `MILESTONE-INTENT.md`:
- Parallel workflow stages where dependencies allow
- Reduced redundant discovery
- Non-goals: rewriting routing architecture, parallelizing inherently sequential operations, adding new dependencies

From `v19.3-MILESTONE-AUDIT.md` gaps:
- **GAP-003:** `resolvePhaseDependencies` Kahn sort never triggered — `enrichment.phases` never set
- **GAP-004:** `getMutexValue`/`invalidateMutex` are dead code — mutex primitives never called
- **FLOW-001:** Parallel wave execution bypasses Kahn sort — uses frontmatter `wave` field instead

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|--------|---------|-------------|
| `node:Atomics` | Node.js built-in | Mutex CAS primitives via `compareExchange`/`wait`/`store` | Built-in, no dependencies, SEMA-free |
| `node:child_process` | Node.js built-in | `spawn` for parallel plan execution | Already used by `fanInParallelSpawns` |
| `Promise.all` | ES2015+ | Fan-in coordination for parallel spawns | Already in `fanInParallelSpawns` |
| `PlanningCache` | Existing | TTL-backed computed-value cache with mutex pool | Already implemented, needs wiring |
| `DECISION_REGISTRY` | Existing | Decision rule evaluation via `evaluateDecisions` | Already in command-enricher |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `SharedArrayBuffer` + `Int32Array` | Node.js built-in | Cross-thread mutex pool backing | Already in `PlanningCache._mutexPool` |
| `resolvePhaseDependencies` | Existing (decision-rules.js:1163) | Kahn topological sort with verification | Needs `enrichment.phases` input to fire |

## Architecture Patterns

### Recommended Project Structure

```
execute-phase workflow
  │
  ├── enrichment.phases set by command-enricher
  │       ↓
  ├── evaluateDecisions(command, enrichment)
  │       ↓
  ├── resolvePhaseDependencies fires (phases input present)
  │       ↓
  └── enrichment.decisions['phase-dependencies'].value.waves
          ↓
fanInParallelSpawns uses Kahn waves
          ↓
Parallel stages call getMutexValue/invalidateMutex
```

### Pattern 1: Decision Rule Triggering

Decision rules fire when their `inputs` are present in the evaluation state. The `resolvePhaseDependencies` rule has `inputs: ['phases']`, meaning it only fires when `state.phases` exists. Currently `enrichment.phases` is never set, so the rule never fires.

**Fix:** Add `enrichment.phases = roadmap.phases` in `src/plugin/command-enricher.js` where other roadmap-derived fields are set (around line 510-517 where `phases_total`/`phases_complete` are set).

### Pattern 2: Kahn Sort Wave Assignment

`resolvePhaseDependencies` returns `{ ordered_phases, waves, verification }` where `waves` is a map of phase-number → wave-number. This should replace the frontmatter `wave` field used by `classifyPlan` → `selectExecutionMode`.

**Current path:**
```
PLAN_INDEX → parsePlans → classifyPlan reads frontmatter.wave → selectExecutionMode groups by wave
```

**Target path:**
```
enrichment.phases → resolvePhaseDependencies → waves from Kahn sort → fanInParallelSpawns uses Kahn waves
```

### Pattern 3: Mutex-Protected Cache Access

`PlanningCache` has a 256-slot mutex pool backed by `SharedArrayBuffer`. `getMutexValue` uses `Atomics.waitAsync` for non-blocking read, `invalidateMutex` uses CAS loop for write protection.

**Usage pattern for parallel cache access:**
```javascript
// Before reading shared cache
const { value, stale, locked } = await cache.getMutexValue(cacheKey);

// After modifying shared cache  
cache.invalidateMutex(cacheKey);
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|------------|-----|
| Topological sort | Custom dependency resolver | `resolvePhaseDependencies` in decision-rules.js | Already implemented with cycle detection and verification |
| Mutex primitives | Custom lock implementation | `getMutexValue`/`invalidateMutex` in PlanningCache | Already implemented with CAS, 256-slot pool, proper acquire/release |
| Parallel fan-in | Custom spawn coordinator | `fanInParallelSpawns` in execute-phase.md workflow | Already implemented with Promise.all, timeout, structured results |
| Wave ordering | Manual wave assignment in frontmatter | Kahn sort from depends_on | Dynamically computed, cycle-verified |

## Common Pitfalls

### Pitfall 1: enrichment.phases Not Set (GAP-003)
**What goes wrong:** `resolvePhaseDependencies` never fires, Kahn sort is never computed
**Why it happens:** `enrichment.phases` is never assigned from `roadmap.phases` in command-enricher.js
**How to avoid:** Add `enrichment.phases = roadmap.phases` where other roadmap-derived fields are set
**Warning signs:** `enrichment.decisions['phase-dependencies']` is undefined after enrichment

### Pitfall 2: Mutex Primitives Dead Code (GAP-004)
**What goes wrong:** `getMutexValue`/`invalidateMutex` exist but parallel cache access doesn't call them
**Why it happens:** No parallel execution path calls the mutex methods — they were implemented but never wired
**How to avoid:** Add mutex calls in `fanInParallelSpawns` when plans access shared cache
**Warning signs:** Code search finds zero callers of `getMutexValue` or `invalidateMutex`

### Pitfall 3: Wave Bypass (FLOW-001)
**What goes wrong:** `fanInParallelSpawns` uses frontmatter `wave` field instead of Kahn sort output
**Why it happens:** `classifyPlan` reads `frontmatter.wave` and `selectExecutionMode` groups by that value
**How to avoid:** Route `enrichment.decisions['phase-dependencies'].value.waves` into the parallel execution path
**Warning signs:** Wave ordering doesn't reflect `depends_on` relationships in roadmap

### Pitfall 4: SharedArrayBuffer in Non-Worker Context
**What goes wrong:** Mutex pool uses `SharedArrayBuffer` but Node.js main thread can't share it with itself
**Why it happens:** `Atomics` operations on a `SharedArrayBuffer` in the same thread that owns it are fine, but the pool was designed for cross-worker synchronization
**How to avoid:** The mutex pool is designed for spin-lock protection within a single process — `Atomics.compareExchange` works correctly even when only one thread accesses it
**Warning signs:** `TypeError: Atomics operation on non-shared memory` (doesn't apply to this use case)

## Code Examples

### Setting enrichment.phases (triggers resolvePhaseDependencies)

In `src/plugin/command-enricher.js` around line 510-517:

```javascript
// milestone-completion (DEC-05): phases_total, phases_complete
try {
  if (roadmap && roadmap.phases && roadmap.phases.length > 0) {
    enrichment.phases_total = roadmap.phases.length;
    enrichment.phases_complete = roadmap.phases.filter(p => p.status === 'complete').length;
    // NEW: Set phases for resolvePhaseDependencies (PARALLEL-02)
    enrichment.phases = roadmap.phases;
    // milestone_name already set above
  }
} catch { /* milestone-completion inputs failed */ }
```

### Using Kahn sort waves in fanInParallelSpawns

In `workflows/execute-phase.md` around line 155, `fanInParallelSpawns` receives plans with Kahn-derived wave info:

```javascript
// Kahn waves come from enrichment.decisions['phase-dependencies'].value.waves
// which maps phase-number → wave-number
const kahnWaves = enrichment.decisions?.['phase-dependencies']?.value?.waves || {};

// fanInParallelSpawns should group by kahnWaves[plan.phase] not frontmatter.wave
```

### Mutex-protected cache access pattern

```javascript
// In parallel spawn handler or shared cache accessor:
const cache = new PlanningCache(db);

// Read with mutex protection (non-blocking)
const { value, stale } = await cache.getMutexValue('shared_cache_key');
if (stale) {
  // recompute and store
  cache.setComputedValue('shared_cache_key', freshValue);
}

// Write with mutex protection (blocking CAS loop)  
cache.invalidateMutex('shared_cache_key');
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static wave from frontmatter | Kahn sort from depends_on | v19.2 (PARALLEL-02 implementation) but never wired | Dynamic dependency-aware wave ordering |
| Unprotected parallel cache | Mutex-protected via Atomics | v19.2 (PARALLEL-01 implementation) but never wired | Race-condition prevention |
| Sequential phase execution | Parallel wave execution via Promise.all | v19.2 (PARALLEL-04 implementation) in workflow | Faster phase execution |
| Manual decision rule inputs | Auto-enrichment from roadmap | v19.1 | Less boilerplate |

## Open Questions

1. **Which specific code path in `fanInParallelSpawns` accesses shared cache that needs mutex protection?** The mutex primitives are implemented but the call sites weren't identified in the audit. The planner should trace through the parallel execution path to find where cache is accessed.

2. **Should Kahn sort waves override frontmatter waves entirely, or be used as a fallback?** The current implementation in `classifyPlan` reads `frontmatter.wave`. If Kahn waves differ, the planner needs to decide whether to use Kahn waves (correct by construction) or fall back to frontmatter (backward compatible).

3. **Is there a verification mechanism for the Kahn sort verification output?** `resolvePhaseDependencies` returns `verification: { valid, errors }`. Should this be logged, surfaced to the user, or block execution on cycle detection?

## Sources

### Primary (HIGH confidence)
- `src/lib/decision-rules.js:1163-1258` — `resolvePhaseDependencies` Kahn sort implementation
- `src/lib/planning-cache.js:169-342` — `getMutexValue`/`invalidateMutex` mutex primitives
- `workflows/execute-phase.md:155-198` — `fanInParallelSpawns` Promise.all fan-in
- `.planning/v19.3-MILESTONE-AUDIT.md` — GAP-003, GAP-004, FLOW-001 gap definitions

### Secondary (MEDIUM confidence)
- `src/plugin/command-enricher.js:510-517` — Where `phases_total`/`phases_complete` are set (insertion point for `enrichment.phases`)
- `src/lib/orchestration.js:285` — Where `frontmatter.wave` is read into plan classification

### Tertiary (LOW confidence)
- `src/commands/misc/config-utils.js:275-300` — `cmdPhasePlanIndex` (doesn't return waves currently)

## Metadata

**Confidence breakdown:** Architecture understanding is HIGH (source code verified). Specific insertion points for mutex calls in `fanInParallelSpawns` is MEDIUM (the audit says mutexes are never called but doesn't specify which parallel path should use them).

**Research date:** 2026-04-05
**Valid until:** When PARALLEL-01 and PARALLEL-02 are verified wired in a subsequent phase
