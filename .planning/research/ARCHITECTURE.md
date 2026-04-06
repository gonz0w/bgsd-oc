# Architecture Research

**Domain:** Node.js CLI Plugin — Workflow Acceleration (v19.3)
**Researched:** 2026-04-05
**Confidence:** HIGH

<!-- section: compact -->
<architecture_compact>
<!-- Compact view for planners. Keep under 30 lines. -->

**Architecture:** Layered CLI monolith with SQLite-backed planning cache, agent manifests, and workflow pipelines.

**Major components:**

| Component | Responsibility |
|-----------|----------------|
| `orchestration.js` | Task complexity classification, execution mode selection, task routing |
| `planning-cache.js` | SQLite-backed mtime-tracked cache for roadmap/plan/task/requirements data |
| `cache.js` | General LRU cache with SQLite/Map dual-backend and statement caching |
| `phase-handoff.js` | Durable phase-step artifact lifecycle with validation and resume support |
| `context.js` | Token budgeting, agent manifests, task-scoped context building |
| `workflow.js` | Workflow measurement, structural fingerprints, comparison and savings tracking |

**Key patterns:** mtime-based cache invalidation, declarative agent manifests, Kahn topological sort for parallel waves, statement caching via `createTagStore`

**Anti-patterns:** Blocking I/O on hot paths, eager full-file reads, redundant parsing, single-threaded stage execution

**Scaling priority:** Task routing latency → cache write amplification → wave parallelization bottlenecks
</architecture_compact>
<!-- /section -->

<!-- section: standard_architecture -->
## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Workflow Files (markdown)                       │
│    execute-phase.md · new-milestone.md · plan-phase.md · etc.      │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ read + parse
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CLI Router (src/router.js)                   │
│            Namespace routing: workflow: · plan: · verify:           │
└──────┬──────────────┬──────────────┬──────────────┬───────────┘
       │              │              │              │
       ▼              ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│workflow.js   │ │plan/*.js    │ │phase/*.js   │ │research/*.js│
│- baseline    │ │- create     │ │- handoff    │ │- collect    │
│- compare     │ │- generate   │ │- validate   │ │- capabilities│
│- verify      │ │- find-phase │ │- write      │ │- web search │
└──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
       │              │              │              │
       ▼              ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Shared Library Modules (src/lib/)                  │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │ orchestration.js │  │ planning-cache.js│  │   context.js    │   │
│  │ • classifyTask   │  │ • checkFreshness │  │ • scopeContext   │   │
│  │ • selectMode     │  │ • storePlan/Road │  │ • buildTaskCtx   │   │
│  │ • routeTask     │  │ • getPhase/Plan  │  │ • checkBudget   │   │
│  └────────┬────────┘  └────────┬────────┘  └────────┬─────────┘   │
│           │                    │                    │              │
│           └────────────────────┼────────────────────┘              │
│                                ▼                                   │
│                     ┌──────────────────┐                           │
│                     │    cache.js      │                           │
│                     │ CacheEngine      │                           │
│                     │ SQLiteBackend    │◄──── statement caching     │
│                     │ MapBackend       │◄──── LRU fallback         │
│                     └────────┬─────────┘                           │
│                              │                                      │
│                              ▼                                      │
│                     ┌──────────────────┐                           │
│                     │    db.js         │                           │
│                     │ SQLiteDatabase   │◄──── WAL mode             │
│                     │ MapDatabase      │◄──── Node <22.5 fallback  │
│                     └────────┬─────────┘                           │
└──────────────────────────────┼─────────────────────────────────────┘
                               │
                               ▼
                    ┌────────────────────┐
                    │  .planning/       │
                    │  .cache.db (SQLite)│
                    │  ROADMAP.md       │
                    │  STATE.md          │
                    │  phases/*.md       │
                    └────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `orchestration.js` | Task complexity scoring (1-5), execution mode selection (single/sequential/parallel/pipeline), hot-path task routing with model profile resolution | Pure function classifiers, Kahn sort for wave analysis |
| `planning-cache.js` | mtime-based cache for roadmap/plan/task/requirements with SQLite persistence and dual-write backup | `PlanningCache` class wrapping `db.js`, lazy statement cache |
| `cache.js` | General LRU cache (file content, research results) with SQLite `createTagStore()` statement caching and TTL | `CacheEngine` → `SQLiteBackend` / `MapBackend` |
| `phase-handoff.js` | Durable phase-step artifact lifecycle (discuss→research→plan→execute→verify) with run_id grouping, stale-source detection, and atomic writes | `writePhaseHandoff` under `withProjectLock` |
| `context.js` | Token budgeting, agent manifest filtering, task-scoped file relevance scoring | `scopeContextForAgent()`, `buildTaskContext()` |
| `workflow.js` | Workflow token measurement, structural fingerprint extraction (Task calls, CLI commands, section markers), baseline comparison | `extractStructuralFingerprint()`, `cmdWorkflowBaseline/Compare/VerifyStructure` |

## Recommended Project Structure

```
src/
├── lib/
│   ├── orchestration.js    # [REUSE — add classifyTaskBatch, parallelWaveRouter]
│   ├── planning-cache.js   # [REUSE — add batchStore, parallelFreshnessCheck]
│   ├── cache.js            # [REUSE — add workflowCache, hot-path batch helpers]
│   ├── phase-handoff.js    # [REUSE — add parallelHandoffWrite, batchValidate]
│   ├── context.js          # [REUSE — add routeTaskBatch, hotPathBudget]
│   └── [existing 47 modules]  # [REUSE — no structural changes needed]
├── commands/
│   ├── workflow.js         # [REUSE — add workflow:hotpath, workflow:batch]
│   ├── phase.js            # [REUSE — add phase:parallel-execute]
│   └── [existing 27 modules] # [REUSE — CLI surface unchanged]
└── [router + index unchanged]
```

### Structure Rationale

- **`orchestration.js` is the routing brain:** Adding batch task classification and parallel wave routing here keeps hot-path decisions centralized.
- **`planning-cache.js` owns persistence:** New batch store methods belong here — cache is already the write-through layer.
- **`cache.js` is the general acceleration layer:** Workflow-specific caching (structural fingerprints, hot-path results) lives here with existing SQLite backend.
- **`phase-handoff.js` is the durable artifact layer:** Parallel write support adds without changing the validation contract.
- **No new directories:** All acceleration fits within existing modules — additive only, no structural disruption.
<!-- /section -->

<!-- section: patterns -->
## Architectural Patterns

### Pattern 1: mtime-Based Cache Invalidation

**What:** File-level cache freshness checked by comparing stored `mtime_ms` against current `fs.statSync(filePath).mtimeMs`.

**When to use:** Any planning artifact (ROADMAP.md, PLAN.md, phase context) where file-level granularity is sufficient and atomic updates are rare.

**Trade-offs:** ✅ O(1) check, no re-parse needed · ✅ Aligns with editor file-watcher semantics · ❌ Coarse: any write to file marks all derived data stale · ❌ Sub-file changes invisible (e.g., append-only STATE.md)

**Example:**
```javascript
// planning-cache.js — checkFreshness()
const row = this._stmt('file_cache_get', 'SELECT mtime_ms FROM file_cache WHERE file_path = ?').get(filePath);
if (!row) return 'missing';
const currentMtime = fs.statSync(filePath).mtimeMs;
return currentMtime === row.mtime_ms ? 'fresh' : 'stale';
```

### Pattern 2: Declarative Agent Manifests

**What:** Per-agent `AGENT_MANIFESTS` objects declare `fields` (required), `optional`, and `exclude` lists. `scopeContextForAgent()` applies set subtraction to produce a scoped result.

**When to use:** Token budget management where different agents need different slices of the same init output.

**Trade-offs:** ✅ Single source of truth · ✅ Zero agent code changes when fields shift · ✅ Silent filtering (agents can't game the contract) · ❌ Manifest drift risk — needs `workflow:verify-structure`-style baseline tracking

**Example:**
```javascript
// context.js — AGENT_MANIFESTS
const AGENT_MANIFESTS = {
  'bgsd-executor': {
    tool_dependency_level: 'high',
    fields: ['phase_dir', 'phase_number', 'phase_name', 'plans', ...],
    optional: ['codebase_conventions', ...],
    exclude: ['intent_drift', ...],
  },
};
// scopeContextForAgent(result, 'bgsd-executor') → filtered object
```

### Pattern 3: Kahn Topological Sort for Parallel Wave Execution

**What:** `resolvePhaseDependencies()` uses Kahn's algorithm to order phases by `depends_on`, declaring winners when declared deps beat discovered graph.

**When to use:** When phases have declared dependencies and parallel execution is desired but correctness is non-negotiable.

**Trade-offs:** ✅ Deterministic, extensible · ✅ Declared deps always win (proven correct) · ❌ Cycle detection required · ❌ Single-node bottleneck if one phase is serial by nature

**Example:**
```javascript
// Already in decision-rules.js — DECISION_REGISTRY entry
resolvePhaseDependencies: { confidence: 'HIGH', fn: (phase, allPhases) => { ...Kahn sort... } }
```

### Pattern 4: Lazy Statement Cache via `createTagStore()`

**What:** SQLite statement templates cached via `db.createTagStore()` tagged template literal, avoiding `db.prepare()` overhead on hot paths.

**When to use:** Repeated CLI invocations hitting the same SQL shapes (file_cache reads, plan lookups, session_state writes).

**Trade-offs:** ✅ ~43% p50 latency reduction, ~22% p99 reduction (measured v9.1) · ✅ Backward-compatible fallback · ❌ `createTagStore()` is Node ≥22.5 only · ❌ No cross-statement query plan sharing

**Example:**
```javascript
// cache.js — SQLiteBackend._initStatementCache()
this.statementCache = this.db.createTagStore();
this._cachedStatements = {
  getFile: (key) => this.statementCache.get`SELECT * FROM file_cache WHERE key = ${key}`,
  insertFile: (key, value, mtime, created, accessed) =>
    this.statementCache.run`INSERT OR REPLACE INTO file_cache ...`,
};
```

### Pattern 5: Batch-Parallel Stage Execution with Dependency Gating

**What:** Stages that are independent (same wave, non-overlapping file sets) execute in parallel; results fan-in before the next dependent stage.

**When to use:** Research collection (web + YouTube run independently), parallel plan execution within a wave.

**Trade-offs:** ✅ Near-linear speedup for N independent stages · ✅ Non-blocking: slow stage doesn't block fast stage · ❌ Fan-in barrier adds latency for skewed stage durations · ❌ Complexity in retry/failure recovery

**Example:**
```javascript
// research.js — cmdResearchCollect (sequential stages, but web + YouTube are parallelizable)
// Current: Stage 1 web → Stage 2 YouTube → Stage 3 Context7 → Stage 4 NLM
// Acceleration: Promise.all([collectWebSources(), collectYouTubeSources()]) as first fan-in
```
<!-- /section -->

<!-- section: data_flow -->
## Data Flow

### Request Flow: Workflow Hot-Path

```
[Agent Request: execute-phase]
    │
    ▼
[router.js] namespace route: 'workflow:' / 'phase:' / 'plan:'
    │
    ▼
[orchestration.js] classifyPlan() + classifyTaskComplexity()
    │  ├─ read PLAN.md from disk (or cache if fresh)
    │  ├─ parse task XML blocks
    │  ├─ score each task 1-5 on complexity
    │  └─ selectExecutionMode() → single | sequential | parallel | pipeline
    │
    ▼
[routeTask()] resolve model + agent from complexity score
    │
    ▼
[context.js] scopeContextForAgent() — filter to agent manifest
    │  └─ token budget check → warn if >50% context window
    │
    ▼
[Agent Execution]
    │
    ▼
[Phase Handoff Write] phase-handoff.js writePhaseHandoff()
    │  ├─ validate artifact
    │  ├─ atomic write under project lock
    │  └─ prune old run artifacts
    │
    ▼
[planning-cache.js] storePlan() — write-through to SQLite
    │  └─ mtime updated for cache invalidation
    │
    ▼
[cache.js] CacheEngine.set() — general LRU cache for next access
```

### State Management

```
[In-memory state]
    │  (module-level Map for single-process caching)
    │
    ▼
[planning-cache.js PlanningCache] — SQLite L2 cache
    │  ├─ mtime-based freshness (fresh/stale/missing)
    │  ├─ planning-specific schemas (phases, plans, tasks, requirements)
    │  └─ lazy prepared statement cache
    │
    ▼
[cache.js CacheEngine] — General LRU cache
    │  ├─ SQLiteBackend with createTagStore() statements
    │  └─ MapBackend fallback for Node <22.5
    │
    ▼
[db.js SQLiteDatabase] — Raw SQLite
     │  ├─ WAL mode for concurrent read/write
     │  └─ PRAGMA busy_timeout = 5000
     │
     ▼
[.planning/.cache.db] — SQLite file on disk
```

### Key Data Flows for v19.3 Acceleration

1. **Hot-path task routing:** `orchestration.classifyTask` → `routeTask` → `context.scopeContextForAgent` → agent manifest (sub-10ms target)

2. **Batch freshness check:** `PlanningCache.checkAllFreshness()` for N files → fan-out `fs.statSync` calls → aggregated fresh/stale/missing → single cache response (vs N individual checks)

3. **Parallel workflow stages:** Phase handoff artifacts for independent steps written concurrently via `Promise.all()` with `withProjectLock` coordination

4. **Workflow structural caching:** `workflow.js extractStructuralFingerprint()` results cached in `CacheEngine` — re-parsing only on mtime change
<!-- /section -->

<!-- section: scaling -->
## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|-------------------------|
| 0-1k users | Single-file CLI, SQLite on `.planning/.cache.db`, no changes needed |
| 1k-100k users | Batch freshness checks, parallel handoff writes, workflow fingerprint cache — all additive |
| 100k+ users | Split read/write paths (CQRS), separate cache.db per major milestone, background compaction |

### Scaling Priorities

1. **First bottleneck: Redundant file I/O on hot paths**
   - `orchestration.classifyPlan()` re-reads PLAN.md even when cached
   - Fix: wire `PlanningCache.checkFreshness()` into classifyPlan read path — skip parse if fresh
   - Fix: `batchStore()` for N plans in one transaction vs N individual writes

2. **Second bottleneck: Sequential stage execution in research pipeline**
   - `cmdResearchCollect` runs web → YouTube → Context7 → NLM sequentially
   - Fix: Fan-out web + YouTube as `Promise.all()`, merge before Context7 stage
   - Fix: NLM synthesis (most expensive) made async with session persistence

3. **Third bottleneck: Single-threaded task routing for large plans**
   - `classifyTaskComplexity` scores tasks serially
   - Fix: `classifyTaskBatch()` using `Promise.allSettled()` for independent task scoring
   - Fix: pre-computed complexity metadata in plan frontmatter (offload from runtime)
<!-- /section -->

<!-- section: anti_patterns -->
## Anti-Patterns

### Anti-Pattern 1: Eager Full-File Read Without Freshness Check

**What people do:** Read `ROADMAP.md` or `PLAN.md` from disk on every CLI invocation, re-parsing 309+ regex patterns every time.

**Why it's wrong:** Silent O(n) parse on every agent request. With 45 workflows × multiple calls per session, this compounds quickly.

**Do this instead:** `PlanningCache.checkFreshness()` → `fresh` → skip parse and return cached data. Parse only on `stale`/`missing`.

### Anti-Pattern 2: N+1 SQLite Writes

**What people do:** Write plan data one row at a time in a loop, with individual transactions.

**Why it's wrong:** Each write triggers WAL flush + fsync. 10 plans × 5 writes each = 50 round trips.

**Do this instead:** `batchStore()` wraps all N plan writes in a single `BEGIN...COMMIT` transaction. Also batch `updateMtime()` calls.

### Anti-Pattern 3: Sequential Fan-Out for Independent Stages

**What people do:** Execute independent workflow stages (`collectWebSources()` then `collectYouTubeSources()`) sequentially even when they have no data dependency.

**Why it's wrong:** YouTube search takes 2-5s — blocking it behind a 200ms web search doubles wall-clock time.

**Do this instead:** `Promise.all([collectWebSources(), collectYouTubeSources()])` for Tier 2+. Merge results before next stage.

### Anti-Pattern 4: Hard-Coded Sleep for Rate Limiting

**What people do:** `setTimeout(resolve, 100)` between parallel operations to "avoid rate limits."

**Why it's wrong:** No-op on fast machines, too slow on slow ones. Doesn't actually throttle.

**Do this instead:** Batching with bounded concurrency (`p-limit`), or exponential backoff only on 429 responses.
<!-- /section -->

<!-- section: integration -->
## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Context7 MCP | Web-fetch via MCP tool in agent | Non-blocking; agent accesses directly |
| Brave Search | `execFileSync` subprocess via `util:websearch` | Research collection stage 1; graceful degradation if unavailable |
| yt-dlp | `execFileSync` subprocess | Research stage 2; VTT parsing in-process |
| NotebookLM | Python CLI subprocess | Tier 1 synthesis only; auth health probe before use |
| JJ (Jujutsu) | `execSync` for workspace commands | JJ-first execution gating; safe fallback |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `router.js` → `commands/*.js` | Function call (synchronous) | Namespace routing dispatches to command handlers |
| `commands/workflow.js` → `lib/orchestration.js` | Function call | Workflow measurement → task classification pipeline |
| `orchestration.js` → `context.js` | Function call | Complexity scoring → agent manifest scoping |
| `context.js` → `cache.js` | Function call | Cached agent context lookup |
| `planning-cache.js` → `db.js` | SQLite via prepared statements | Write-through cache layer |
| `cache.js` → `db.js` | SQLite via `createTagStore()` | General LRU cache with statement caching |
| `phase-handoff.js` → `planning-cache.js` | No direct dependency | Handoffs are file-based artifacts; cache is separate |

## Sources

- `.planning/PROJECT.md` — v19.3 milestone definition, current state
- `src/lib/orchestration.js` — Task routing, complexity classification
- `src/lib/planning-cache.js` — SQLite-backed mtime-tracked cache
- `src/lib/cache.js` — `CacheEngine` with `SQLiteBackend`/`MapBackend`
- `src/lib/phase-handoff.js` — Phase artifact lifecycle
- `src/lib/context.js` — Agent manifests, token budgeting
- `src/commands/workflow.js` — Workflow measurement and structural fingerprints
- `src/commands/research.js` — Research pipeline with tiered degradation

---
*Architecture research for: workflow acceleration (v19.3)*
*Researched: 2026-04-05*
