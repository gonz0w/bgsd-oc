# Architecture Research

**Domain:** Node.js CLI Plugin — Workflow Acceleration II + TDD Reliability (v19.4)
**Researched:** 2026-04-06
**Confidence:** HIGH

<!-- section: compact -->
<architecture_compact>
<!-- Compact view for planners. Keep under 30 lines. -->

**Architecture:** Layered CLI monolith with SQLite planning cache, JJ-first execution gating, and TDD audit sidecar pipeline.

**Major components:**

| Component | Responsibility |
|-----------|----------------|
| `orchestration.js` | Task complexity scoring, execution mode selection, TDD-aware routing |
| `phase-handoff.js` | TDD audit discovery, durable artifact lifecycle with `tdd_audits` context injection |
| `misc/recovery.js` cmdTdd | RED/GREEN/REFACTOR validation stubs → production implementation |
| `decision-rules.js` | TDD commit strategy (`per-phase` granularity) via `resolveCommitStrategy` |
| `cache.js` / `planning-cache.js` | Continued I/O reduction — batch operations, hot-path statement caching |

**Key patterns:** JJ-first execution gating, mtime-based cache invalidation, Kahn topological sort, TDD audit sidecar persistence

**Anti-patterns:** Stub TDD validators left unimplemented, sequential TDD stage execution, per-TDD-stage file reads without caching

**Scaling priority:** cmdTdd stub resolution → TDD audit sidecar wiring → parallel TDD stage execution
</architecture_compact>
<!-- /section -->

<!-- section: standard_architecture -->
## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Workflow Files (markdown)                                     │
│    execute-phase.md · new-milestone.md · plan-phase.md · execute-plan.md         │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │ read + parse
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CLI Router (src/router.js)                                │
│         `execute:tdd <subcommand>` routes to cmdTdd in misc/recovery.js          │
└──────┬──────────────┬──────────────┬──────────────┬───────────────────────────┘
       │              │              │              │
       ▼              ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌──────────────────────────────────┐
│workflow.js  │ │plan/*.js    │ │phase/*.js   │ │misc/recovery.js cmdTdd           │
│- baseline   │ │- create     │ │- handoff    │ │- validate-red (STUB → implement) │
│- compare    │ │- generate   │ │- validate    │ │- validate-green (STUB → impl)   │
│- verify     │ │- find-phase │ │- write       │ │- validate-refactor (STUB → impl)│
└──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └────────────┬───────────────────┘
       │              │              │                       │
       ▼              ▼              ▼                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                  Shared Library Modules (src/lib/)                                  │
│                                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────────┐  │
│  │ orchestration.js │  │ phase-handoff.js  │  │    decision-rules.js        │  │
│  │ • classifyTask   │  │ • discoverTddAudits│  │ • resolveCommitStrategy   │  │
│  │ • routeTask     │  │ • tdd_audits ctx  │  │   (TDD → per-phase)        │  │
│  │ • selectMode   │  │ • mergeHandoffCtx │  │                              │  │
│  └────────┬───────┘  └────────┬──────────┘  └──────────────────────────────┘  │
│           │                  │                                                │
│           └──────────────────┼────────────────────────────────────────────┘
│                              ▼
│                     ┌──────────────────┐
│                     │    cache.js      │
│                     │ PlanningCache    │
│                     │ SQLiteBackend    │
│                     └────────┬─────────┘
│                              │
│                              ▼
│                     ┌────────────────────┐
│                     │  .planning/       │
│                     │  .cache.db (SQLite)│
│                     │  phases/*-TDD-AUDIT│
│                     └────────────────────┘
└──────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `orchestration.js` | Task complexity scoring (1-5), TDD-aware execution mode, hot-path task routing | Pure function classifiers; Kahn sort for wave analysis |
| `phase-handoff.js` | TDD audit sidecar discovery (`discoverPhaseProofContext`), durable artifact lifecycle, `tdd_audits` context injection into handoff payloads | Scans phase dirs for `*-TDD-AUDIT.json`, merges into handoff context |
| `misc/recovery.js cmdTdd` | TDD RED/GREEN/REFACTOR validation — runs exact target command, captures exit code + output snippet, returns structured proof | `child_process.spawnSync` for synchronous validation; structured JSON output |
| `decision-rules.js` | TDD commit strategy resolution — `granularity: per-phase` for TDD plans, `prefix: test` for `type: tdd` | `resolveCommitStrategy()` consuming `is_tdd`, `plan_type`, `task_count`, `files_modified_count` |
| `planning-cache.js` | mtime-based cache for roadmap/plan/task/requirements; batch store operations for reduced write amplification | `PlanningCache` class, lazy statement cache, transaction batching |
| `cache.js` | General LRU cache with SQLite `createTagStore()` statement caching and Map fallback | `CacheEngine` → `SQLiteBackend` / `MapBackend` |

## Recommended Project Structure

```
src/
├── lib/
│   ├── orchestration.js    # [MODIFY — TDD task type awareness in classifyTaskComplexity]
│   ├── phase-handoff.js    # [REUSE — already has TDD audit discovery, no changes needed]
│   ├── planning-cache.js   # [REUSE — batch store ops already designed, may need parallelFreshnessCheck]
│   ├── cache.js            # [REUSE — hot-path batch helpers]
│   ├── context.js          # [REUSE — TDD budget awareness in scopeContextForAgent]
│   ├── decision-rules.js   # [REUSE — resolveCommitStrategy already TDD-aware]
│   └── [existing 46 modules] # [REUSE — no structural changes needed]
├── commands/
│   ├── workflow.js         # [REUSE — structural fingerprint caching for TDD plans]
│   ├── phase.js            # [REUSE — TDD handoff write coordination]
│   ├── misc/
│   │   └── recovery.js     # [MODIFY — cmdTdd stub → production implementation]
│   └── [existing 26 modules] # [REUSE — CLI surface unchanged]
└── [router + index unchanged]
```

### Structure Rationale

- **`misc/recovery.js cmdTdd` is the new implementation target:** The stub at lines 209-223 must become a real TDD validator. All RED/GREEN/REFACTOR subcommands execute here.
- **`phase-handoff.js` already wires TDD audits correctly:** `discoverPhaseProofContext()` scans phase dirs for `*-TDD-AUDIT.json`, `buildPhaseHandoffPayload()` injects `tdd_audits` into context — no changes needed.
- **`orchestration.js` needs TDD type awareness:** `classifyTaskComplexity()` should boost complexity score for `type="tdd"` tasks (TDD is inherently multi-cycle).
- **`context.js` should carry TDD budget awareness:** TDD plans target ~40% context (lower than standard ~50%) — this belongs in `scopeContextForAgent()` decisions.
- **No new directories:** All v19.4 work fits within existing modules — additive only, no structural disruption.
<!-- /section -->

<!-- section: patterns -->
## Architectural Patterns

### Pattern 1: TDD Audit Sidecar Persistence

**What:** Each TDD plan produces a `*-TDD-AUDIT.json` sidecar file in the phase directory, recording RED/GREEN/REFACTOR stage results. `phase-handoff.js discoverPhaseProofContext()` scans and merges these into handoff context.

**When to use:** When TDD proof must survive `execute → verify → summary` transitions and resume/inspect flows.

**Trade-offs:** ✅ Proof survives handoff refreshes · ✅ Visible in resume inspection · ✅ Merged into downstream summaries · ❌ Sidecar file must be written atomically · ❌ Phase dir scanning on every handoff read (mitigate with mtime cache)

**Example:**
```javascript
// misc/recovery.js — cmdTdd validate-red stub → implementation
// Sidecar written: phases/08-name/02-TDD-AUDIT.json
{
  "plan": "02",
  "red": {
    "test_cmd": "npm test -- --testPathPattern=email",
    "exit_code": 1,
    "passed": false,
    "evidence": "FAIL: should reject empty email",
    "timestamp": "2026-04-06T..."
  }
}
```

### Pattern 2: Exact-Command TDD Validation

**What:** Each TDD stage (RED/GREEN/REFACTOR) declares an exact target command. Validation succeeds only when the command produces the expected exit code. Missing command = invalid proof.

**When to use:** All TDD cycle validation. Prevents false-positive "proof" from non-existent test commands.

**Trade-offs:** ✅ Deterministic · ✅ Human-verifiable · ❌ Brittle if test command format changes · ❌ No cross-check against equivalent commands

**Example:**
```javascript
// cmdTdd validate-red — runs testCmd, expects exit code 1 (failure)
const result = spawnSync(testCmd, [], { shell: true });
const passed = result.status === 1;
return { test_cmd: testCmd, exit_code: result.status, passed, evidence: extractFailingSnippet(result.stderr) };
```

### Pattern 3: TDD-Aware Commit Granularity

**What:** `resolveCommitStrategy()` in `decision-rules.js` sets `granularity: per-phase` when `is_tdd: true`, producing one commit per TDD stage (test, feat, refactor) instead of per-task or per-plan.

**When to use:** When TDD plans need atomic per-stage commits with `GSD-Phase` trailers.

**Trade-offs:** ✅ Matches TDD cycle semantics · ✅ Trailers enable later trajectory analysis · ❌ More commits per feature · ❌ Requires `--tdd-phase` flag on commit

**Example:**
```javascript
// decision-rules.js — resolveCommitStrategy
if (is_tdd) {
  granularity = 'per-phase'; // TDD commits at red/green/refactor
}
// git-helpers.js adds --trailer "GSD-Phase: red|green|refactor"
```

### Pattern 4: JJ-First Execution Gating

**What:** All execution entrypoints gate on JJ workspace proof (`workspace prove`) before parallel execution. Falls back safely to sequential when proof is missing.

**When to use:** v19.4 parallel execution improvements must respect JJ-first gating added in v19.0.

**Trade-offs:** ✅ Safe parallel execution with proof · ✅ Fail-open when JJ unavailable · ❌ JJ dependency for parallel mode · ❌ `workspace prove` adds entrypoint latency

### Pattern 5: Batch Freshness Check (v19.3, continued in v19.4)

**What:** `PlanningCache.checkAllFreshness()` fans out `fs.statSync` calls for N files in parallel, aggregates fresh/stale/missing, returns single response.

**When to use:** Hot-path planning cache reads — skip re-parse if all files fresh.

**Trade-offs:** ✅ Near-linear speedup for N files · ✅ Single round-trip to cache · ❌ Fan-out syscall overhead for small N · ❌ mtime precision on network mounts

**Example:**
```javascript
// planning-cache.js — batch freshness
async checkAllFreshness(filePaths) {
  const results = await Promise.all(filePaths.map(fp => this.checkFreshness(fp)));
  return results.every(r => r === 'fresh') ? 'all_fresh' : 'some_stale';
}
```
<!-- /section -->

<!-- section: data_flow -->
## Data Flow

### TDD Validation Flow (v19.4 new implementation)

```
[Executor Agent]
    │
    ▼
[execute:tdd validate-red --test-cmd "npm test"]
    │
    ▼
[misc/recovery.js cmdTdd('validate-red', { 'test-cmd': ... })]
    │  ├─ spawnSync(testCmd, [], { shell: true })
    │  ├─ exit_code === 1 ? RED_VALID : RED_INVALID
    │  └─ writePhaseHandoff → *-TDD-AUDIT.json sidecar
    │
    ▼
[Structured proof payload]
    │  { test_cmd, exit_code, passed, evidence, timestamp }
    │
    ▼
[phase-handoff.js discoverPhaseProofContext()]
    │  └─ scans phase dir for *-TDD-AUDIT.json files
    │
    ▼
[buildPhaseHandoffPayload tdd_audits injection]
    └─ mergeHandoffContexts(carriedContext, discoveredProofContext, ...)
```

### Workflow Hot-Path (v19.3 → v19.4 continuation)

```
[Agent Request: execute-phase]
    │
    ▼
[router.js] namespace route: 'phase:'
    │
    ▼
[orchestration.js] classifyPlan() + classifyTaskComplexity()
    │  ├─ read PLAN.md (or cache if fresh via batch freshness check)
    │  ├─ parse task XML blocks
    │  ├─ score each task 1-5 (TDD-aware boost for type="tdd")
    │  └─ selectExecutionMode() → single | sequential | parallel | pipeline
    │
    ▼
[routeTask()] resolve model + agent from complexity score
    │
    ▼
[context.js] scopeContextForAgent() — filter to agent manifest
    │  └─ TDD budget awareness (~40% for type="tdd" plans)
    │
    ▼
[TDD plan: RED/GREEN/REFACTOR cycle]
    │  ├─ cmdTdd validate-red → TDD-AUDIT.json
    │  ├─ cmdTdd validate-green → TDD-AUDIT.json
    │  └─ cmdTdd validate-refactor → TDD-AUDIT.json
    │
    ▼
[phase-handoff.js writePhaseHandoff()]
    │  ├─ discoverPhaseProofContext() → tdd_audits
    │  ├─ validate artifact
    │  └─ atomic write under project lock
    │
    ▼
[planning-cache.js storePlan()] — write-through to SQLite
```

### State Management

```
[In-memory state]
    │  (module-level Map for single-process caching)

    ▼

[planning-cache.js PlanningCache] — SQLite L2 cache
    │  ├─ mtime-based freshness (fresh/stale/missing)
    │  ├─ planning-specific schemas (phases, plans, tasks, requirements)
    │  └─ lazy prepared statement cache

    ▼

[cache.js CacheEngine] — General LRU cache
    │  ├─ SQLiteBackend with createTagStore() statements
    │  └─ MapBackend fallback for Node <22.5

    ▼

[db.js SQLiteDatabase] — Raw SQLite
     │  ├─ WAL mode for concurrent read/write
     │  └─ PRAGMA busy_timeout = 5000

     ▼

[.planning/.cache.db] — SQLite file on disk
[.planning/phases/*/--TDD-AUDIT.json] — TDD proof sidecars
```
<!-- /section -->

<!-- section: scaling -->
## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|-------------------------|
| 0-1k users | Single-file CLI, SQLite on `.planning/.cache.db`, no changes needed |
| 1k-100k users | Batch freshness checks, parallel handoff writes, TDD audit caching — all additive |
| 100k+ users | Split read/write paths (CQRS), separate cache.db per major milestone, background compaction |

### Scaling Priorities

1. **First bottleneck: cmdTdd stub blocking TDD reliability**
   - `cmdTdd` at lines 209-223 in `misc/recovery.js` is a stub — all TDD validation subcommands return "not yet implemented"
   - Fix: Implement `validate-red`, `validate-green`, `validate-refactor` with `spawnSync` + structured proof
   - Impact: TDD workflow cannot produce verifiable proof without this

2. **Second bottleneck: Sequential TDD stage scanning**
   - `discoverPhaseProofContext()` scans phase dir on every handoff read
   - Fix: Add mtime-based cache for TDD audit discovery results (similar to file_cache freshness pattern)
   - Impact: Phase handoff reads slow when many TDD plans exist

3. **Third bottleneck: TDD context budget not enforced**
   - TDD plans target ~40% context but `scopeContextForAgent()` has no TDD-aware budget
   - Fix: Add TDD budget multiplier in `context.js` when `plan.type === 'tdd'`
   - Impact: TDD plans may over-run context window on complex features
<!-- /section -->

<!-- section: anti_patterns -->
## Anti-Patterns

### Anti-Pattern 1: Stub TDD Validators in Production Path

**What people do:** Leave `cmdTdd` as stub returning "not yet implemented" while TDD workflow references `execute:tdd validate-red` as canonical proof.

**Why it's wrong:** TDD plans cannot produce verifiable RED proof. Executor agents get "TDD audit not yet implemented" and no proof surfaces in summaries.

**Do this instead:** Implement `cmdTdd validate-red/green/refactor` with `spawnSync` execution, exit code checking, and structured proof. Write `*-TDD-AUDIT.json` sidecar for durable proof.

### Anti-Pattern 2: TDD Audit Sidecar Written Without Atomicity

**What people do:** Append to `*-TDD-AUDIT.json` or use non-atomic `fs.writeFileSync` for TDD audit results.

**Why it's wrong:** Concurrent executor runs (parallel wave execution) can corrupt the sidecar or lose audit records.

**Do this instead:** Use `writeFileAtomic()` from `atomic-write.js` — already imported in `phase-handoff.js` and used for handoff artifacts.

### Anti-Pattern 3: TDD Stage Without Source Fingerprint

**What people do:** Write TDD audit without `source_fingerprint` linking it to the plan/phase state at the time of execution.

**Why it's wrong:** Stale proof can be resubmitted as fresh — verification cannot distinguish old from current execution context.

**Do this instead:** Include `source_fingerprint` (plan content hash) in the TDD audit sidecar. `discoverPhaseProofContext` should only surface audits whose fingerprint matches current plan.

### Anti-Pattern 4: Sequential TDD Stage Execution

**What people do:** Execute RED stage, wait, then GREEN stage, wait, then REFACTOR stage — even when they have no data dependency.

**Why it's wrong:** Each stage is independent — running `npm test` is the same command, just expecting different exit codes.

**Do this instead:** For single-file TDD plans, batch the three validation commands into one `cmdTdd batch-validate` that runs all three stages and writes a combined audit sidecar. Fan-out only when stages truly have state dependencies.
<!-- /section -->

<!-- section: integration -->
## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| JJ (Jujutsu) | `execSync` for workspace commands | JJ-first execution gating; `workspace prove` required for parallel mode |
| Test frameworks | `spawnSync` via cmdTdd validators | Jest, Vitest, pytest, Go testing, cargo test — detected by project type |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `router.js` → `misc/recovery.js cmdTdd` | Function call: `lazyMisc().cmdTdd(cwd, tddSub, tddArgs, raw)` | `execute:tdd <subcommand>` namespace |
| `cmdTdd` → `phase-handoff.js` | File write: `*-TDD-AUDIT.json` sidecar | Uses `writeFileAtomic()` |
| `phase-handoff.js` → `cmdTdd` | Context injection: `discoverPhaseProofContext()` reads TDD audits | No direct call — scan + merge pattern |
| `orchestration.js` → `context.js` | Function call | TDD task type awareness propagates through complexity → routing |
| `decision-rules.js` → `git-helpers.js` | `GSD-Phase: red\|green\|refactor` trailer | Via `buildCommitMessage(tddPhase)` |

### Build Order for v19.4

1. **`misc/recovery.js cmdTdd`** — Implement validate-red, validate-green, validate-refactor stubs first (unblocks all downstream TDD proof consumers)
2. **`orchestration.js`** — Add TDD type awareness to `classifyTaskComplexity()` (depends on step 1 for testing)
3. **`context.js`** — Add TDD budget awareness to `scopeContextForAgent()` (depends on step 2)
4. **`planning-cache.js`** — Add batch freshness check for TDD audit sidecar discovery (depends on step 1)
5. **`workflow.js`** — Add TDD plan structural fingerprint caching (depends on step 2)

**Rationale:** cmdTdd is the critical path — all TDD proof flows through it. Implement it first so downstream integration can be tested incrementally.

## Sources

- `.planning/PROJECT.md` — v19.3/v19.4 milestone definitions, TDD-RELIABILITY-PRD backlog seed reference
- `.planning/research/ARCHITECTURE.md` (v19.3) — prior architecture, hot-path acceleration patterns
- `src/commands/misc/recovery.js` — cmdTdd stub (lines 209-223)
- `src/lib/phase-handoff.js` — `discoverPhaseProofContext()`, TDD audit discovery, `tdd_audits` context injection
- `src/lib/orchestration.js` — task complexity scoring, execution mode selection
- `src/lib/decision-rules.js` — `resolveCommitStrategy()` with TDD `per-phase` granularity
- `src/lib/git-helpers.js` — `buildCommitMessage()` with `GSD-Phase` trailer support
- `skills/tdd-execution/SKILL.md` — canonical TDD contract, RED/GREEN/REFACTOR semantics
- `src/router.js` — `execute:tdd` routing to `cmdTdd`

---
*Architecture research for: workflow acceleration II + TDD reliability (v19.4)*
*Researched: 2026-04-06*
