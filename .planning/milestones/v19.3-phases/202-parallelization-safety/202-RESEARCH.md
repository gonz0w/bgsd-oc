# Phase 202: Parallelization Safety - Research

**Researched:** 2026-04-05
**Domain:** Node.js concurrent cache safety / Kahn topological sort / JJ workspace proof preservation / Promise.all fan-in coordination
**Confidence:** HIGH

## Summary

Phase 202 implements safety guarantees for parallel workflow execution: mutex-protected shared cache entries (PARALLEL-01), Kahn topological sort verification in `resolvePhaseDependencies` (PARALLEL-02), JJ workspace proof gate preservation on accelerated paths (PARALLEL-03), and `Promise.all` fan-in coordination for `child_process.spawn` workflow stages (PARALLEL-04).

**Critical finding:** `resolvePhaseDependencies` was added in Phase 128 but **removed in Phase 140** (infrastructure pruning, see 140-01-PLAN.md lines 163-191). PARALLEL-02 requires restoring it with Kahn topological sort verification — this is a re-implementation, not an extension.

**Key architectural decisions:**
- Mutex protection uses Node.js built-in `Atomics` and `SharedArrayBuffer` for lock-free concurrent cache access (no new npm dependencies)
- Kahn sort verification runs as a pre-dispatch gate before any parallel fan-out
- JJ proof gate is preserved by running `workspace prove` as an explicit step before parallel dispatch — the proof check may be optimized but is never bypassed
- `Promise.all` fan-in uses `child_process.spawn` with structured result collection

**Primary recommendation:** Implement PARALLEL-01 (mutex cache) first since PARALLEL-03 and PARALLEL-04 depend on safe concurrent cache access. Restore `resolvePhaseDependencies` (PARALLEL-02) as a pure function in `decision-rules.js` with Kahn sort verification. Wire `Promise.all` fan-in as the wave-coordination primitive in the execute-phase workflow.

---

## User Constraints

*(First section — Planner MUST honor these)*

### From Phase Intent and Requirements

| Requirement | Description | Notes |
|-------------|-------------|-------|
| PARALLEL-01 | Mutex-protected cache entries for parallel stages sharing cache layer | Shared PlanningCache must not corrupt on concurrent invalidation |
| PARALLEL-02 | Kahn topological sort verification in `resolvePhaseDependencies` | Restore function removed in Phase 140; verify correct wave ordering |
| PARALLEL-03 | JJ workspace proof gate preserved on all accelerated paths | Proof check may be optimized but NEVER bypassed |
| PARALLEL-04 | `Promise.all` fan-in coordination using `child_process.spawn` | Independent workflow stages coordinate via Promise.all |

### From Existing Decisions

| Decision | Value | Source |
|----------|-------|--------|
| JJ-first execution | All execution flows through `workspace prove` triple-match gate | PROJECT.md v19.0 |
| Kahn topological sort for phase ordering | `resolvePhaseDependencies` uses Kahn sort; declared `depends_on` always wins | PROJECT.md Key Decisions |
| Shared PlanningCache as central acceleration primitive | SQLite-backed cache with statement caching | ARCHITECTURE.md |

### Non-Goals

- Dynamic parallelization — runtime dependency graph auto-detection deferred to v2+
- Removing quality gates — acceleration without regression
- Async I/O rewrite — synchronous I/O is appropriate for CLI tool

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|--------|---------|--------------|
| `node:Atomics` + `SharedArrayBuffer` | Node.js built-in (no import needed) | Mutex/lock-free cache key synchronization for PARALLEL-01 | No new dependencies; lock-free CAS primitives avoid thread-blocking overhead |
| `node:child_process` | Node built-in | Parallel workflow stage spawn for PARALLEL-04 | Already used throughout codebase (execFileSync, spawnSync patterns) |
| `PlanningCache` | Existing (src/lib/planning-cache.js) | Shared cache layer to be mutex-protected | Already handles SQLite persistence; extends with mutex-aware entry API |
| `jj-workspace.js` | Existing (src/lib/jj-workspace.js) | JJ workspace proof gate via `collectWorkspaceProof()` | Already implements triple-match proof; preserved on accelerated paths |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|--------|---------|-------------|
| `node:sqlite` | Node 22.5+ built-in | SQLite backend for PlanningCache | Already in use; mutex-safe statements needed |
| `decision-rules.js` | Existing (src/lib/decision-rules.js) | `resolvePhaseDependencies` lives here | Restore with Kahn sort verification |
| `execute-phase.md` | Existing (workflows/) | Wave-based parallel execution | PARALLEL-04 `Promise.all` fan-in wiring location |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Atomics + SharedArrayBuffer for mutex | `async-mutex` npm package | New dep; Atomics is lock-free and built-in |
| Dedicated mutex daemon process | `worker_threads` MessageChannel | Overkill for cache-key granularity |
| `setTimeout(0)` trick for yielding | `process.nextTick` | Does not provide actual concurrency safety |

---

## Architecture Patterns

### Recommended Project Structure

```
src/
  lib/
    planning-cache.js     # EXTEND: mutex-protected get/set/Invalidate for parallel stages
    decision-rules.js     # EXTEND: restore resolvePhaseDependencies with Kahn sort verification
    jj-workspace.js      # PRESERVE: collectWorkspaceProof unchanged; proof preserved on accelerated paths
  commands/
    workflow.js          # EXTEND: parallel wave execution with Promise.all fan-in
workflows/
  execute-phase.md       # EXTEND: Kahn sort gate + mutex cache warm + Promise.all dispatch
```

### Pattern 1: Mutex-Protected Cache Entries (PARALLEL-01)

When parallel stages share PlanningCache, simultaneous invalidation of the same key must return consistent data. The pattern uses `Atomics` for lock-free compare-and-swap on cache keys:

```javascript
// SharedArrayBuffer + Atomics for lock-free mutex per cache key
const MUTEX_SEGMENT = new SharedArrayBuffer(4); // 4 bytes = 1 int32
const mutexIndex = new Int32Array(MUTEX_SEGMENT);

// Lock acquisition (returns true if acquired)
function acquireMutex(keyIndex) {
  return Atomics.compareExchange(mutexIndex, 0, 0, 1) === 0;
}

// Release mutex
function releaseMutex(keyIndex) {
  Atomics.store(mutexIndex, 0, 0);
}

// Usage in PlanningCache
getMutex(key) {
  // Spin-wait with Atomics waitAsync for non-blocking acquisition
  // On acquisition: read value, release mutex
  // Returns { value, stale } with mutex protection
}
```

**Cache key segmentation:** Use a hash of the cache key to select which mutex slot (from a fixed-size mutex pool) to use, avoiding unbounded mutex count.

### Pattern 2: Kahn Topological Sort Verification (PARALLEL-02)

`resolvePhaseDependencies` was removed in Phase 140. Restore it as a pure function in `decision-rules.js` that:
1. Takes all phases with their `depends_on` declarations
2. Runs Kahn's algorithm to produce wave ordering
3. Verifies the produced order matches declared dependencies
4. Returns `{ ordered_phases, waves, warnings }` with verification that no declared dep is violated

```javascript
/**
 * Kahn topological sort with declared depends_on verification.
 * Returns wave-ordered phases and confirms no dependency violations.
 *
 * @param {Array<{number, depends_on: string[]|null}>} phases
 * @returns {{ ordered_phases: Array, waves: object, verification: { valid: boolean, errors: string[] } }}
 */
function resolvePhaseDependencies(phases) {
  // Build adjacency list from depends_on
  // Compute in-degree for each phase
  // Kahn BFS: process zero-in-degree nodes, emit waves
  // Verification pass: for each edge (dep → node), dep appears before node in output
  // Returns ordered_phases with wave assignments and verification result
}
```

**Wave construction:** Phases with no `depends_on` are wave 1. When a phase's all declared dependencies are in earlier waves, assign it to `max(dep waves) + 1`.

### Pattern 3: JJ Proof Gate Preservation (PARALLEL-03)

The `workspace prove` triple-match gate (`collectWorkspaceProof` in `jj-workspace.js`) must run before any accelerated parallel dispatch. The proof check may be **optimized** (e.g., caching the proof result for N seconds within a wave) but is **never bypassed**:

```javascript
// In execute-phase.md wave execution — BEFORE Promise.all fan-out:
// Fresh proof gate check (optimized caching allowed)
const proof = collectWorkspaceProof(cwd, workspaceName);
// parallel_allowed: boolean — if false, fall back to sequential BEFORE any work
if (!proof.parallel_allowed) {
  // Fall back to Mode B sequential — proof gate preserved
  return executeSequential(wave);
}
// Accelerated path continues — proof was checked
```

**Optimization latitude:** The proof check itself may be optimized (e.g., skip re-checking if same workspace+plan within 30s window), but the gate check itself is never removed or short-circuited to always-pass.

### Pattern 4: Promise.all Fan-In with child_process.spawn (PARALLEL-04)

Wave-coordination uses `Promise.all` to fan out independent workflow stages, each spawned via `child_process.spawn`, with structured result collection:

```javascript
// Wave fan-out coordination
async function executeWaveParallel(wavePlans, cwd) {
  const spawns = wavePlans.map(plan => {
    return new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ['bin/bgsd-tools.cjs', 'execute:plan', plan.plan_id],
        { cwd, stdio: ['pipe', 'pipe', 'pipe'] }
      );
      
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', d => stdout += d);
      child.stderr.on('data', d => stderr += d);
      
      child.on('close', code => {
        resolve({ plan_id: plan.plan_id, code, stdout, stderr });
      });
      child.on('error', reject);
    });
  });
  
  // Fan-in: wait for all simultaneously
  const results = await Promise.all(spawns);
  
  // Collect results — any failure propagates
  return results;
}
```

### Anti-Patterns to Avoid

| Anti-Pattern | Why | Correct Approach |
|--------------|-----|-----------------|
| `Atomics.wait` (blocking) | Blocks the event loop; defeats async benefits | `Atomics.waitAsync` for non-blocking spin-wait |
| Mutex per cache entry (unbounded) | Memory unbounded as entries grow | Fixed-size mutex pool with key-hash slot selection |
| Bypassing `workspace prove` for speed | Breaks v19.0 proof contract | Optimize proof check, never skip it |
| `Promise.all` without structured error handling | One rejection crashes entire wave | Wrap each spawn in structured try/catch, collect errors per-plan |
| Restoring `resolvePhaseDependencies` without verification pass | Declared deps could be violated silently | Always run verification pass confirming no edge violations |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Lock-free cache mutex | Custom mutex with `fs` locks or file-based locks | `Atomics` + `SharedArrayBuffer` | Built-in, no dependencies, lock-free CAS |
| Kahn topological sort | Ad-hoc dependency ordering | Standard Kahn algorithm | Well-understood, deterministic, O(V+E) |
| JJ workspace proof gate | Custom proof check replacing `workspace prove` | `collectWorkspaceProof()` from jj-workspace.js | Already implements triple-match; preserves v19.0 contract |
| Wave fan-in coordination | Custom thread pool or worker_threads | `Promise.all` + `child_process.spawn` | Already used in codebase; natural async coordination |

---

## Common Pitfalls

### Pitfall 1: Mutex Pool Exhaustion
**What goes wrong:** Fixed-size mutex pool with hash-based slot selection can cause false contention — two cache keys map to the same slot and block each other unnecessarily.
**Why it happens:** Simple `hash(key) % poolSize` without considering key access frequency.
**How to avoid:** Use a larger mutex pool (e.g., 256 slots) and accept minor false contention as acceptable trade-off for bounded memory.
**Warning signs:** Parallel stage latency spikes correlate with cache key count (not compute).

### Pitfall 2: Kahn Sort Cycle Without Detection
**What goes wrong:** Circular `depends_on` declarations cause infinite loop in Kahn BFS.
**Why it happens:** Phase definitions may have typos or unintended mutual dependencies.
**How to avoid:** Track visited nodes during BFS; detect cycles explicitly and return `{ valid: false, errors: ['cycle detected: ...'] }`.
**Warning signs:** `execute-phase` hangs with no output during wave ordering.

### Pitfall 3: Proof Gate Caching Stale Results
**What goes wrong:** Proof result cached too long — workspace state changes but stale proof allows unsafe parallel dispatch.
**Why it happens:** Aggressive proof caching for performance.
**How to avoid:** Cache proof results only within a single wave dispatch (one `execute-phase` call); refresh on each wave start.
**Warning signs:** Parallel workspace execution succeeds but subsequent reconcile finds divergent state.

### Pitfall 4: Promise.all Crash on Single Spawn Failure
**What goes wrong:** One failed `child_process.spawn` in the wave rejects the entire `Promise.all`, leaving other spawns uncollected and orphaned.
**Why it happens:** Unhandled spawn error propagates to `Promise.all` rejection.
**How to avoid:** Wrap each spawn in `Promise.race` with a timeout and collect errors per-plan instead of propagating rejection.
**Warning signs:** Wave execution stops at first failed plan without cleaning up sibling processes.

### Pitfall 5: JJ Workspace Proof Gate Re-Added After Removal
**What goes wrong:** Phase 140 removed `resolvePhaseDependencies` from `decision-rules.js`. Attempting to "extend" it would be wrong — it must be re-implemented from scratch.
**Why it happens:** Historical knowledge that the function existed leads to incorrect approach.
**How to avoid:** Treat this as a fresh implementation with Kahn sort, not an extension of previous code.
**Warning signs:** Looking for `resolvePhaseDependencies` in decision-rules.js exports and not finding it.

---

## Code Examples

### Mutex-Protected Cache Get (PARALLEL-01)

```javascript
// In planning-cache.js — extend PlanningCache with mutex-aware operations
const MUTEX_POOL_SIZE = 256; // Fixed pool, hash-based slot selection
const _mutexPool = new Int32Array(MUTEX_POOL_SIZE);

function _mutexSlotForKey(key) {
  // Stable hash to slot index
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) % MUTEX_POOL_SIZE;
}

/**
 * Get a cached value with mutex protection.
 * Non-blocking: uses Atomics.waitAsync for spin-wait.
 *
 * @param {string} key
 * @returns {{ value: object|null, stale: boolean, locked: boolean }}
 */
getMutexValue(key) {
  const slot = _mutexSlotForKey(key);
  
  // Try lock-free read first (no contention path)
  const noWait = Atomics.waitAsync(_mutexPool, slot, 0, 0);
  if (noWait.async) {
    // Wait needed — non-blocking async wait
    return noWait.value.then(() => this._getUnlocked(key));
  }
  
  // Fast path: no contention, read directly
  return this._getUnlocked(key);
}

async _getUnlocked(key) {
  // Actual cache read logic
  const val = this.getComputedValue(key);
  return { value: val, stale: val === null, locked: false };
}

/**
 * Invalidate with mutex protection.
 * Ensures no concurrent read sees intermediate state.
 */
invalidateMutex(key) {
  const slot = _mutexSlotForKey(key);
  // CAS loop
  while (true) {
    const old = Atomics.load(_mutexPool, slot);
    if (Atomics.compareExchange(_mutexPool, slot, old, 1) === old) {
      try {
        this.invalidateFile(key); // actual invalidation
      } finally {
        Atomics.store(_mutexPool, slot, 0);
      }
      return;
    }
    // Contended — yield to event loop
    Atomics.wait(_mutexPool, slot, 1, 1);
  }
}
```

### Kahn Topological Sort with Verification (PARALLEL-02)

```javascript
// In decision-rules.js — restore resolvePhaseDependencies with verification
function resolvePhaseDependencies(state) {
  const { phases = [] } = state || {};
  
  // Build adjacency: phase -> [deps]
  const adj = new Map();
  const inDegree = new Map();
  const phaseByNum = new Map();
  
  for (const p of phases) {
    const num = String(p.number);
    adj.set(num, []);
    inDegree.set(num, 0);
    phaseByNum.set(num, p);
  }
  
  for (const p of phases) {
    const deps = p.depends_on || [];
    for (const dep of deps) {
      if (adj.has(dep)) {
        adj.get(dep).push(String(p.number));
        inDegree.set(String(p.number), (inDegree.get(String(p.number)) || 0) + 1);
      }
    }
  }
  
  // Kahn BFS
  const queue = [];
  const ordered = [];
  
  for (const [num, degree] of inDegree) {
    if (degree === 0) queue.push(num);
  }
  
  while (queue.length > 0) {
    const current = queue.shift();
    ordered.push(current);
    
    for (const neighbor of (adj.get(current) || [])) {
      const newDegree = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }
  
  // Cycle detection
  if (ordered.length !== phases.length) {
    const remaining = phases.filter(p => !ordered.includes(String(p.number)));
    return {
      value: { ordered_phases: [], waves: {}, verification: { valid: false, errors: [`cycle detected involving: ${remaining.map(p => p.number).join(', ')}`] } },
      confidence: 'HIGH',
      rule_id: 'phase-dependencies'
    };
  }
  
  // Wave assignment and verification
  const waves = {};
  for (const num of ordered) {
    const deps = phaseByNum.get(num)?.depends_on || [];
    let wave = 1;
    for (const dep of deps) {
      const depWave = waves[dep] || 1;
      wave = Math.max(wave, depWave + 1);
    }
    waves[num] = wave;
  }
  
  // Verification pass: confirm each declared dep appears before its dependent
  const verificationErrors = [];
  const orderedSet = new Set(ordered);
  for (const num of ordered) {
    const deps = phaseByNum.get(num)?.depends_on || [];
    for (const dep of deps) {
      const depIdx = ordered.indexOf(dep);
      const numIdx = ordered.indexOf(num);
      if (depIdx >= numIdx) {
        verificationErrors.push(`${num} depends on ${dep} but ${dep} does not precede ${num} in ordering`);
      }
    }
  }
  
  return {
    value: {
      ordered_phases: ordered.map(n => phaseByNum.get(n)),
      waves,
      verification: { valid: verificationErrors.length === 0, errors: verificationErrors }
    },
    confidence: 'HIGH',
    rule_id: 'phase-dependencies'
  };
}
```

### JJ Proof Gate Preservation (PARALLEL-03)

```javascript
// In execute-phase.md wave execution — before Promise.all dispatch:
// PARALLEL-03: JJ workspace proof gate check (may be optimized, never bypassed)
const PROOF_CACHE_TTL_MS = 30_000; // Proof valid within a single wave dispatch

let _cachedProof = null;
let _cachedProofTime = 0;

function getWorkspaceProof(cwd, workspaceName) {
  const now = Date.now();
  if (_cachedProof && (now - _cachedProofTime) < PROOF_CACHE_TTL_MS) {
    return _cachedProof;
  }
  // Fresh proof check
  _cachedProof = collectWorkspaceProof(cwd, workspaceName);
  _cachedProofTime = now;
  return _cachedProof;
}

// Before parallel dispatch:
const proof = getWorkspaceProof(cwd, workspaceName);
if (!proof.parallel_allowed) {
  // FALLBACK TO SEQUENTIAL — proof gate preserved, never bypassed
  return executeWaveSequential(wavePlans);
}
// Accelerated parallel path continues — proof was checked
```

### Promise.all Fan-In Coordination (PARALLEL-04)

```javascript
// In workflow/parallel-coordination.js — new module for wave fan-in
const { spawn } = require('child_process');

/**
 * Execute multiple independent plans in parallel using Promise.all fan-in.
 * Each plan spawned as child_process.spawn, results collected via Promise.all.
 *
 * @param {Array<{plan_id: string, plan_path: string}>} plans
 * @param {string} cwd - Project root
 * @param {object} options - { timeout_ms, onProgress }
 * @returns {Promise<Array<{plan_id, code, stdout, stderr, timed_out}>>}
 */
async function fanInParallelSpawns(plans, cwd, options = {}) {
  const { timeout_ms = 300_000, onProgress } = options;
  
  const spawns = plans.map(plan => {
    return new Promise(resolve => {
      const child = spawn(
        process.execPath,
        ['bin/bgsd-tools.cjs', 'execute:plan', plan.plan_id, '--no-interactive'],
        { cwd, stdio: ['pipe', 'pipe', 'pipe'] }
      );
      
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      
      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, timeout_ms);
      
      child.stdout.on('data', d => { stdout += d; });
      child.stderr.on('data', d => { stderr += d; });
      
      child.on('close', code => {
        clearTimeout(timeout);
        resolve({ plan_id: plan.plan_id, code: timedOut ? -1 : code, stdout, stderr, timedOut });
      });
      child.on('error', err => {
        clearTimeout(timeout);
        resolve({ plan_id: plan.plan_id, code: -1, stdout: '', stderr: String(err), timedOut: false });
      });
    });
  });
  
  // Fan-in: wait for all simultaneously
  const results = await Promise.all(spawns);
  
  // Report progress
  if (onProgress) {
    for (const r of results) onProgress(r);
  }
  
  return results;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No mutex protection on shared cache | `Atomics` + `SharedArrayBuffer` lock-free mutex per cache key | Phase 202 (this phase) | Safe parallel cache access |
| `resolvePhaseDependencies` removed (Phase 140) | Kahn sort + verification pass restored | Phase 202 (this phase) | Correct wave ordering preserved |
| JJ proof gate always runs fresh | JJ proof gate may cache within wave dispatch | Phase 202 (this phase) | Faster parallel dispatch, same safety |
| Sequential wave execution per plan | `Promise.all` fan-in across wave plans | Phase 202 (this phase) | True parallel execution |

---

## Open Questions

1. **Mutex pool size selection** — 256 slots is a heuristic. Need empirical data on key cardinality vs false contention. Not blocking — start with 256, instrument false-contention rate via metrics.

2. **Proof cache TTL for PARALLEL-03** — 30s within a wave dispatch is a reasonable default. Should be configurable. Contained in Phase 202 scope.

3. **JJ workspace proof for non-workspace execution** — PARALLEL-03 applies only to workspace-parallel mode (Mode A). Non-workspace (Mode B) sequential execution doesn't need proof gating. Clarify that proof gate is Mode A only.

4. **Error collection granularity in Promise.all** — The pattern collects per-plan results rather than failing fast. This allows partial wave completion reporting. Contained in Phase 202 scope.

---

## Sources

### Primary (HIGH confidence)
- **Local project** — `src/lib/planning-cache.js` (cache layer), `src/lib/jj-workspace.js` (`collectWorkspaceProof`), `src/lib/decision-rules.js` (decision function registry), `workflows/execute-phase.md` (wave execution), `src/lib/orchestration.js` (execution mode selection)
- **REQUIREMENTS.md** — PARALLEL-01 through PARALLEL-04 requirements and traceability
- **PROJECT.md** — JJ workspace proof gate (v19.0), Kahn sort for phase ordering (v12.1)
- **`.planning/research/PITFALLS.md`** — Pitfall 2 (cache races), Pitfall 3 (JJ proof gate) directly relevant
- **`.planning/research/ARCHITECTURE.md`** — Kahn topological sort mentioned in stack

### Secondary (MEDIUM confidence)
- **`.planning/phases/0128-agent-collaboration/0128-01-PLAN.md`** — Historical `resolvePhaseDependencies` design (pre-removal)
- **`.planning/phases/140-infrastructure-pruning/140-01-PLAN.md`** — Confirms `resolvePhaseDependencies` was removed in Phase 140
- **`workflows/execute-phase.md`** — Mode A/B execution patterns, workspace prove wiring

### Tertiary (LOW confidence)
- **Training data for Atomics patterns** — Node.js Atomics semantics well-documented; no project-specific precedent for mutex pool sizing

---

## Phase Requirements

| Requirement | Description | Implementation Location |
|-------------|-------------|----------------------|
| PARALLEL-01 | Mutex-protected cache entries for parallel stages | `src/lib/planning-cache.js` — `getMutexValue`, `invalidateMutex`, mutex pool |
| PARALLEL-02 | Kahn topological sort verification in `resolvePhaseDependencies` | `src/lib/decision-rules.js` — restore `resolvePhaseDependencies` with Kahn BFS + verification pass |
| PARALLEL-03 | JJ workspace proof gate preserved on accelerated paths | `workflows/execute-phase.md` — proof gate before `Promise.all` dispatch; proof may cache within wave |
| PARALLEL-04 | `Promise.all` fan-in coordination with `child_process.spawn` | `src/commands/workflow.js` or new `workflows/parallel-coordination.md` — `fanInParallelSpawns` |

---

## Metadata

**Confidence breakdown:** Stack patterns (HIGH), JJ proof gate preservation (HIGH), Kahn sort restoration (MEDIUM — requires re-implementation from scratch), Promise.all fan-in (HIGH — standard Node.js pattern)

**Research date:** 2026-04-05

**Valid until:** 2026-04-12 (1 week — patterns are stable, implementation details may shift)
