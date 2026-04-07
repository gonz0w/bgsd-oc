# Phase 202: Parallelization Safety - Research

**Researched:** 2026-04-06
**Domain:** parallel workflow orchestration / shared-cache concurrency / JJ workspace safety
**Confidence:** HIGH

## User Constraints

- Scope is limited to PARALLEL-01..PARALLEL-04.
- Preserve sequential fallback; parallel mode is an optimization, not a replacement.
- Do not bypass the JJ workspace proof gate.
- Do not add new dependencies.
- Shared planning artifacts remain single-writer unless explicitly finalized.

## Summary

Phase 202 should be implemented as gated parallelism, not blanket concurrency. The repo already has the key building blocks: `PlanningCache.batchCheckFreshness()` uses a single SQLite transaction for bulk freshness checks, `collectWorkspaceProof()` already decides whether parallel execution is safe, and `lifecycle.js` already contains Kahn-style ordering logic. What is missing is a narrow concurrency guard for shared cache entries plus a deterministic fan-out/fan-in path for independent stages.

Primary recommendation: reuse the existing lock/transaction primitives, add per-entry cache mutex semantics, then dispatch only dependency-free waves after workspace proof succeeds. Keep the proof gate and the dependency sorter as hard preconditions; `Promise.all` should only coordinate already-approved children, never decide eligibility.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | 22.22.2 / 22.x LTS | Runtime for the CLI and built-ins | Matches current docs and ships `node:sqlite` / `node:child_process` |
| `node:sqlite` | 22.5+ | SQLite-backed cache and transaction support | Already used by `PlanningCache`; synchronous APIs fit CLI hot paths |
| `node:child_process` | Built-in | Spawn independent workflow stages | Required for process-level fan-out |
| `Promise.all` | ECMAScript built-in | Fan-in for independent stage results | Correct ordering and fail-fast semantics for coordinated waves |
| `jj` CLI | External tool | Workspace proof / execution root validation | Existing safety gate for parallel mode |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `PlanningCache` | Existing (`src/lib/planning-cache.js`) | Shared planning cache and batch freshness | Use for cache reads/writes and freshness checks |
| `withProjectLock` | Existing (`src/lib/project-lock.js`) | Coarse project-level mutex | Use as the nearest reusable lock primitive when shared state must serialize |
| `lifecycle.js` Kahn sort | Existing | Dependency wave ordering | Use or extract for `resolvePhaseDependencies` verification |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-entry mutex semantics | Custom async-mutex package | Adds dependencies and diverges from current zero-dependency posture |
| Child process fan-out via shell | `exec()` / shell scripts | Worse quoting/safety; easier to bypass proof gates |
| Ad hoc dependency ordering | New sort implementation | Duplicate logic; existing Kahn logic already exists in-repo |
| Per-file freshness checks | Repeated `fs.statSync` loops | Slower and more race-prone than the existing batch transaction path |

## Architecture Patterns

### Recommended Project Structure

```
src/
  lib/
    planning-cache.js   # shared cache + batch freshness + mutexed entry access
    jj-workspace.js     # workspace proof gate
    lifecycle.js        # Kahn topological sort / wave ordering
    project-lock.js     # coarse lock primitive to reuse where needed
  commands/
    phase.js            # wave dispatch / fan-out coordination
```

### Pattern 1: Gated Parallel Dispatch

1. Validate workspace proof first.
2. Verify dependency waves with Kahn ordering.
3. Spawn only independent stages.
4. Fan in with `Promise.all`.
5. Keep shared-state writes out of the parallel section.

### Pattern 2: Per-Key Cache Critical Section

Parallel stages may read shared cache data, but simultaneous invalidation of the same key must be serialized. Use a key-scoped mutex or lock discipline around cache mutation; do not rely on SQLite transaction boundaries alone for cross-stage coordination.

### Pattern 3: Deterministic Wave Ordering

Use Kahn topological sort to produce waves before dispatch. The order must be computed before spawning children so completion order cannot change scheduling order.

### Anti-Patterns to Avoid

- Treating `Promise.all` as a scheduler instead of a collector
- Letting parallel stages write shared planning artifacts directly
- Replacing the JJ proof gate with a warning
- Reimplementing Kahn sorting from scratch
- Using shell `exec()` for stage spawning

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Shared cache serialization | New npm mutex library | Key-scoped lock discipline / existing project lock patterns | Keeps the stack dependency-free |
| Bulk freshness validation | Per-file `stat` loop | `PlanningCache.batchCheckFreshness()` | Already transactional and batch-oriented |
| Parallel eligibility | Prompt-only trust | `collectWorkspaceProof()` gate | Verifies cwd/root parity with JJ evidence |
| Wave ordering | Custom ad hoc order logic | Kahn topological sort | Existing in-repo pattern; deterministic and testable |
| Stage fan-out | Shell script wrapper | `child_process.spawn()` | Safer process control and no shell quoting hazards |

## Common Pitfalls

### Pitfall 1: Cache Stampede on Shared Keys
**What goes wrong:** Two stages invalidate or refresh the same key at once and one writes stale or partial data.
**Why it happens:** SQLite transactions protect a single connection, not the whole parallel workflow.
**How to avoid:** Serialize cache mutation per key or per protected region.
**Warning signs:** Intermittent stale reads after concurrent stage startup.

### Pitfall 2: Proof Gate Regression
**What goes wrong:** Parallel execution starts in a workspace that does not match intended root, observed cwd, and `jj workspace root`.
**Why it happens:** Optimizations make the proof check advisory instead of mandatory.
**How to avoid:** Keep `parallel_allowed` as the hard dispatch gate.
**Warning signs:** Parallel mode works in some dirs but silently falls back or misroutes in nested paths.

### Pitfall 3: `Promise.all` Fail-Fast Leaves Orphans
**What goes wrong:** One stage rejects and the others keep running without cleanup.
**Why it happens:** `Promise.all` rejects on the first failure.
**How to avoid:** Attach explicit child-process cleanup / abort behavior around the fan-in.
**Warning signs:** Stray stage processes after an early error.

### Pitfall 4: Ordering Assumptions
**What goes wrong:** Completion order is mistaken for dependency order.
**Why it happens:** Parallel execution finishes in nondeterministic order.
**How to avoid:** Compute waves up front with Kahn sorting and only then dispatch.
**Warning signs:** Rare ordering bugs that only appear under load.

### Pitfall 5: Old Runtime Assumptions
**What goes wrong:** Code assumes `node:sqlite` exists on every runtime.
**Why it happens:** The package supports Node >=18, but built-in `node:sqlite` is only available on Node 22.5+.
**How to avoid:** Preserve the existing Map fallback and treat SQLite as capability-gated.
**Warning signs:** Cache paths throw on older Node builds or Bun.

## Code Examples

Verified patterns from current sources.

```js
// Batch freshness already uses a single transaction.
this._db.exec('BEGIN');
const rows = this._stmt('file_cache_batch_get',
  `SELECT file_path, mtime_ms FROM file_cache WHERE file_path IN (${placeholders})`
).all(...filePaths);
this._db.exec('COMMIT');
```

```js
// Kahn ordering already exists for lifecycle chains.
while (queue.length > 0) {
  const current = queue.shift();
  sorted.push(current);
  // decrement in-degree for downstream nodes
}
```

```js
// Workspace proof must match intended root, observed cwd, and jj root.
const proof = collectWorkspaceProof(cwd, workspaceName, cwd);
if (!proof.parallel_allowed) {
  // fall back to sequential mode
}
```

```js
// Spawn independent stages without shell expansion.
const child = spawn(process.execPath, [gsdBin, 'codebase', 'analyze', '--raw'], {
  detached: true,
  stdio: 'ignore',
});
child.unref();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-file freshness checks | SQLite batch transaction | Phase 201 | Fewer round trips, less I/O |
| Serial stage execution | Wave-based parallel dispatch | Phase 202 target | Better throughput without unsafe overlap |
| Advisory workspace guidance | JJ proof-based eligibility | Phase 181/202 line | Safer execution root selection |
| Shell-based spawning | Direct `child_process.spawn()` | Current Node guidance | Safer quoting and better control |

## Open Questions

- Should the new cache mutex be file-lock based, row-lock based, or reuse `withProjectLock()` semantics at a narrower scope?
- Should `resolvePhaseDependencies` live in `lifecycle.js` or in the phase command surface as a thin verifier wrapper?
- What cleanup policy should run for spawned children after the first `Promise.all` rejection?

## Sources

### Primary (HIGH confidence)

- `.planning/REQUIREMENTS.md` (PARALLEL-01..04, out-of-scope notes)
- `.planning/ROADMAP.md` (Phase 202 goal and success criteria)
- `src/lib/planning-cache.js` (batch freshness, computed-value cache, transaction pattern)
- `src/lib/jj-workspace.js` (workspace proof gate)
- `src/lib/lifecycle.js` (existing Kahn topological sort)
- `src/lib/project-lock.js` (existing lock primitive)
- `src/commands/workspace.js` (workspace prove wiring)

### Secondary (MEDIUM confidence)

- Node.js child process docs: https://nodejs.org/docs/latest-v22.x/api/child_process.html#child_processspawncommand-args-options
- Node.js SQLite docs: https://nodejs.org/docs/latest-v22.x/api/sqlite.html

### Tertiary (LOW confidence)

- MDN Promise.all: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all

## Metadata

**Confidence breakdown:** HIGH on in-repo behavior, MEDIUM on runtime API guidance, LOW on any non-verified implementation detail
**Research date:** 2026-04-06
**Valid until:** 2026-07-06
