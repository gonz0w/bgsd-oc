# Stack Research — v19.3 Workflow Acceleration

**Domain:** Workflow hot-path optimization, I/O reduction, parallel execution
**Researched:** 2026-04-05
**Confidence:** HIGH

---

## Recommendation

**Do not add new npm dependencies for this milestone.** v19.3 accelerates existing infrastructure through:

1. **Pre-computed routing tables** — store `classifyTaskComplexity` and `routeTask` results in SQLite, eliminating repeated computation on every call
2. **Batch I/O operations** — read-ahead phase/plan fingerprints in a single SQLite transaction instead of per-file mtime checks
3. **SQLite-first hot-path memoization** — extend `PlanningCache` with TTL-backed computed-value storage for routing decisions
4. **Built-in parallelism** — use `Promise.all` with `child_process.spawn` (Node.js built-in) for independent workflow stages

No new packages are needed. The existing `node:sqlite`, `node:child_process`, and `node:fs` APIs are sufficient.

---

<!-- section: compact -->

**Core stack (existing):**

| Technology | Purpose | Version |
|------------|---------|---------|
| `node:sqlite` | Hot-path decision cache with TTL storage | Node 22.5+ built-in |
| `node:child_process` | Parallel stage execution via spawn | Node 22.5+ built-in |
| `PlanningCache` | SQLite-backed mtime cache with batch ops | existing (src/lib/planning-cache.js) |
| `DECISION_REGISTRY` | In-process routing decisions (19 functions) | existing (src/lib/decisions.js) |

**Key supporting libs (existing):** fast-glob (file discovery), valibot (validation), fuse.js (fuzzy search)

**Avoid:** `lru-cache` (CLI is short-lived; Map is sufficient), `worker_threads` (adds complexity without benefit for this workload)

**Install:** `npm install` (no new packages)

<!-- /section -->

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|----------------|
| `node:sqlite` (built-in) | Node 22.5+ | Hot-path routing cache with TTL storage | Already in use for `PlanningCache`; extending with computed-value tables is zero-cost |
| `node:child_process` (built-in) | Node 22.5+ | Parallel workflow stage execution | Enables `spawn()` for independent agents without async I/O rewrite |
| `node:fs` (built-in) | Node 22.5+ | Batch file operations | `fs.readFileSync` batching already sufficient; combine with mtime batch checks |
| `PlanningCache` | existing | SQLite-backed mtime cache | Already handles roadmap/plan/task caching; extend with routing-decision tables |
| `DECISION_REGISTRY` | existing | 19 deterministic routing functions | Already evaluates in-process; pre-compute and store results for repeated calls |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fast-glob` | 3.3.3 | File discovery for batch operations | When reading multiple plan files in a phase |
| `valibot` | 1.2.0 | Schema validation for new routing tables | When adding new routing decision schemas to SQLite |
| `fuse.js` | 7.1.0 | Fuzzy matching for task name lookup | When routing decisions need fuzzy task name matching |
| `acorn` (bundled) | bundled | AST parsing for task complexity | Already used in `orchestration.js` |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `node --test` | Test runner | Existing test suite; add benchmarks for routing hot-path |
| `esbuild` | Bundler | Already in use; no changes needed |
| `npm run build` | Production build | Already validates single-file output |

---

## Installation

No new packages. Ensure existing dependencies are current:

```bash
# Core (no changes — existing packages sufficient)
npm install

# Verify current package versions
npm list fast-glob valibot fuse.js ignore inquirer
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|------------------------|
| `node:sqlite` (built-in) | `better-sqlite3` | If native performance is critical; adds C++ dependency and breaks single-file deploy |
| `node:child_process` (built-in) | `execa` / `spawn-wrap` | If process management complexity grows beyond `spawn()`; adds dependency |
| Map-based LRU | `lru-cache` npm | If CLI lifetime grows beyond short-lived; current Map is sufficient |
| `Promise.all` + `spawn` | `worker_threads` | If CPU-bound parallelism needed; adds significant complexity for marginal gain |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|------------|
| `lru-cache` npm package | CLI processes are short-lived (<5s); Map eviction is not a concern; adds bundle size | Plain `Map` or extend `PlanningCache` with TTL tables |
| `worker_threads` | CPU-bound parallelism not the bottleneck; routing decisions are I/O-bound, not compute-bound | Pre-computed routing tables in SQLite |
| New async I/O infrastructure | "Async I/O rewrite — Synchronous I/O is appropriate for CLI tool" is explicitly out of scope | Batch sync operations with `Promise.all` over `spawn` for parallelism at process level |
| Separate cache service | Over-engineering for CLI tool; SQLite at `.planning/.cache.db` is sufficient | Extend existing `PlanningCache` |

---

## Stack Patterns by Variant

**If accelerating task routing hot-path:**
- Pre-compute `classifyTaskComplexity` results and store in `PlanningCache` with TTL
- Add `routing_decisions` table to SQLite schema: `(plan_path, task_name, complexity_score, recommended_profile, cached_at)`
- Invalidate on plan file mtime change

**If reducing I/O overhead:**
- Add batch `checkAllFreshness` for all phase plans in single SQLite query
- Use `fs.readFileSync` batch reads with `Promise.all` for independent files
- Pre-fetch next-phase metadata during current-phase execution

**If implementing parallel stages:**
- Use `child_process.spawn` with `Promise.all` for independent workflow stages
- `selectExecutionMode` already detects `parallel` mode when same-wave plans exist
- Coordinate via shared SQLite state (one writer at a time via WAL mode)

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `node:sqlite` (built-in) | Node 22.5+ only | Graceful Map fallback on older Node (existing pattern) |
| `valibot@1.2.0` | Node 12+ | Current version is adequate; upgrade if schema performance becomes critical |
| `fast-glob@3.3.3` | Node 12+ | Already matches Node 22.5+ requirement |
| `PlanningCache` (SQLite) | WAL mode enabled | Concurrent reads safe; single-writer coordination via WAL |

---

## Sources

- **Context7** — `node:sqlite` built-in docs, `node:child_process` built-in docs
- **Official docs** — JJ workspace docs (for parallel execution context)
- **Local project** — `src/lib/planning-cache.js`, `src/lib/orchestration.js`, `src/lib/db.js`
- **Decision registry** — 19 routing functions already in-process; pre-computing is additive, not architectural change

---

*Stack research for: v19.3 Workflow Acceleration*
*Researched: 2026-04-05*
