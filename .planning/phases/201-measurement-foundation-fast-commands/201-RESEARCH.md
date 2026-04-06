# Phase 201: Measurement Foundation & Fast Commands - Research

**Researched:** 2026-04-05
**Domain:** CLI workflow orchestration / SQLite hot-path memoization / adaptive telemetry
**Confidence:** HIGH

## Summary

Phase 201 establishes the measurement and fast-command infrastructure that all subsequent acceleration phases depend on. The core work is: (1) run `workflow:baseline` and save results to `.planning/research/ACCEL-BASELINE.json` before any routing/caching changes; (2) add adaptive telemetry hooks to `orchestration.js` so routing path hits are logged at execution time; (3) extend `PlanningCache` with TTL-backed computed-value tables for `classifyTaskComplexity` and `routeTask`; (4) implement batch freshness checks as a single SQLite transaction; (5) add `--fast` flag to `discuss-phase`; (6) wire `--batch N` flag in `verify-work`; (7) add `workflow:hotpath` command. All work uses existing `node:sqlite`, `PlanningCache`, and `orchestration.js` infrastructure — no new npm dependencies.

**Primary recommendation:** Implement telemetry hooks and TTL-backed computed-value tables first (ACCEL-02, ACCEL-03), since all subsequent routing/cache changes depend on this infrastructure. `workflow:baseline` output path change (ACCEL-01) is a one-liner. Batch freshness (ACCEL-04) is a small SQL refactor. `--fast`/`--batch` flags (FAST-01, FAST-02) are workflow-level additions. `workflow:hotpath` (FAST-03) depends on telemetry data existing first.

---

## User Constraints

*(First section — Planner MUST honor these)*

### From CONTEXT.md (Locked Decisions)

| Decision | Value | Notes |
|----------|-------|-------|
| PlanningCache TTL strategy | Hybrid: file-hash primary + 10min TTL fallback | File changes invalidate immediately; 10min TTL catches edge cases (copied files with old mtime) |
| "Routine" criteria for `--fast` | ≤2 low-ranked gray areas | Phases with few low-risk gray areas qualify for fast mode |
| Batch size for `verify-work --batch` | N=1 for verify, N=5 for routine check | Risk-aware default; configurable |
| Telemetry granularity | Coarse + frequency (route name + hit count) | Good signal-to-noise for hotpath analysis |
| Freshness criteria for SQLite batch checks | TTL primary, mtime fallback for critical paths | Hybrid approach |
| ACCEL-BASELINE.json format | JSON with named fields | Easy to extend |
| `workflow:hotpath` output format | Clarification deferred | Not blocking |

### From Stress-Tested Decisions

| Original | Revised | Follow-on |
|----------|---------|-----------|
| 60s fixed TTL for PlanningCache | File-hash hybrid with 10min TTL fallback | None needed — hybrid handles mtime edge case |

### Non-Goals (from Phase Intent)

- Parallelization safety (Phase 202)
- State mutation safety (Phase 203)
- Permanent cache storage beyond session (TTL-backed only)

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|--------|---------|--------------|
| `node:sqlite` | Node 22.5+ built-in | Hot-path routing cache with TTL storage | Already in use for PlanningCache; extends to computed-value tables |
| `node:child_process` | Node built-in | Parallel workflow stage spawn (Phase 202) | Already used throughout codebase |
| `PlanningCache` | Existing (src/lib/planning-cache.js) | SQLite-backed mtime cache with file_cache table | Already handles roadmap/plan/task caching; extends with routing-decision tables |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|--------|---------|-------------|
| `DECISION_REGISTRY` | Existing (19 routing functions) | Routing decisions for classifyTaskComplexity and routeTask | Pre-compute and store results for repeated calls |
| Statement caching (`createTagStore()`) | Existing | ~43% p50 latency reduction on repeated SQL | Already shippe; no changes needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fixed TTL for PlanningCache | 60s fixed TTL | Fails on copied files with old mtime; hybrid is better |
| Fine-grained telemetry | Per-call detailed telemetry | Too noisy; coarse + frequency is sufficient per CONTEXT.md |
| N=1 for all verify-work batches | Uniform batch size | Risk-aware batching (N=1 for verify, N=5 for routine) preserves safety |

---

## Architecture Patterns

### Recommended Project Structure

```
src/
  lib/
    orchestration.js      # EXTEND: add telemetry hooks
    planning-cache.js     # EXTEND: TTL-computed tables, batch freshness
  commands/
    workflow.js           # EXTEND: ACCEL-BASELINE.json path, workflow:hotpath
workflows/
  discuss-phase.md        # EXTEND: --fast flag, low_risk_fast_path enhancement
  verify-work.md         # EXTEND: --batch N flag wiring
```

### Pattern 1: TTL-Backed Computed-Value Cache

The core acceleration primitive. Store results of expensive deterministic functions (`classifyTaskComplexity`, `routeTask`) in SQLite with TTL. On call:
1. Compute input hash (task structure + context → stable key)
2. Check TTL-computed table for fresh entry
3. If fresh: return cached result
4. If stale/missing: compute, store with TTL, return

**Hybrid invalidation** (stress-tested): File-hash primary invalidation catches direct file changes; 10min TTL catches edge cases like copied files with old mtime.

**Schema pattern** (extend `file_cache` table or add new `computed_values` table):
```sql
CREATE TABLE IF NOT EXISTS computed_values (
  key TEXT PRIMARY KEY,        -- e.g., "classifyTaskComplexity:<hash>"
  value_json TEXT NOT NULL,
  ttl_ms INTEGER NOT NULL,     -- absolute expiry timestamp
  created_at TEXT NOT NULL
);
```

### Pattern 2: Adaptive Telemetry Hook

In `orchestration.js`, wrap the hot-path functions with telemetry logging:
```javascript
// Each call logs: { function, inputs_hash, output, timestamp }
// The log is append-only and consumed by workflow:hotpath
function telemetryLog(functionName, inputsHash, output) { ... }
```

Coarse + frequency telemetry (per CONTEXT.md): just route name + hit count. No per-call detailed tracing.

### Pattern 3: Batch Freshness Check

Replace per-file mtime check loop with single SQLite transaction:
```javascript
// BEFORE (per-file, N queries)
for (const fp of filePaths) {
  const status = this.checkFreshness(fp);  // N SQLite calls
}

// AFTER (single transaction)
batchCheckFreshness(filePaths) {
  // Single SELECT with IN clause + mtime comparison
  // Returns { fresh: [], stale: [], missing: [] }
}
```

### Anti-Patterns to Avoid

| Anti-Pattern | Why | Correct Approach |
|--------------|-----|-----------------|
| Hardcoded hot-path assumptions | Usage patterns drift; hardcoded routing fails when reality changes | Adaptive telemetry + coarse frequency logging |
| Fine-grained per-call tracing | Too noisy; obscures signal | Coarse + frequency (route name + hit count) only |
| Fixed TTL without file-hash | Fails on copied files with old mtime | Hybrid file-hash + 10min TTL fallback |
| Per-file freshness checks without transaction | N SQLite calls instead of 1 | Single SELECT with IN clause in one transaction |
| --fast that bypasses locked decisions | Quality regression | Only batches low-risk items; locked/deferred never touched |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TTL-backed computed-value storage | Custom Map with manual expiry | Extend PlanningCache with computed_values table | Already handles SQLite persistence, migration, and statement caching |
| Routing path telemetry | Custom event emitter or log files | Extend orchestration.js with append-only telemetry log | Minimal intrusion; already in the hot path |
| Batch freshness checks | Per-file fs.statSync loops | Single SQLite SELECT with IN clause + transaction | Already uses SQLite; keeps I/O on the fast path |
| Hot-path command infrastructure | New top-level CLI family | Extend workflow.js with workflow:hotpath command | Follows existing workflow:* command pattern |

---

## Common Pitfalls

### Pitfall 1: Optimizing Without Baseline
**What goes wrong:** ACCEL-01 requires saving `.planning/research/ACCEL-BASELINE.json` before any routing/caching changes. Without this baseline, no subsequent measurement can prove improvement.
**Why it happens:** The existing `workflow:baseline` saves to `.planning/baselines/`, not `.planning/research/ACCEL-BASELINE.json`. This is a separate output path.
**How to avoid:** The success criterion explicitly names the output path. Implement as a path variant of the existing `workflow:baseline` command, not a new command.
**Warning signs:** New routing/cache code merged before ACCEL-BASELINE.json exists.

### Pitfall 2: TTL Expiry Edge Case (Copied Files)
**What goes wrong:** Fixed TTL (e.g., 60s) plus mtime-based invalidation fails when a file is copied to a new location — the mtime may be old but the content is new.
**Why it happens:** mtime only checks "when file changed", not "what content hash is".
**How to avoid:** Hybrid approach (stress-tested): file-hash primary, 10min TTL fallback. File changes invalidate immediately via hash; TTL catches edge cases.
**Warning signs:** Cache returns stale data after file copy operations.

### Pitfall 3: Telemetry Without Production Path
**What goes wrong:** Telemetry hooks added to orchestration.js but telemetry data never consumed — `workflow:hotpath` command missing or non-functional.
**Why it happens:** FAST-03 (`workflow:hotpath`) depends on telemetry data from ACCEL-02 (telemetry hooks). If implemented out of order, hotpath shows empty results.
**How to avoid:** Implement telemetry hooks (ACCEL-02) before `workflow:hotpath` (FAST-03). Verify telemetry data accumulates before building the display command.
**Warning signs:** `workflow:hotpath` output is empty or shows "no data" despite multiple routing operations.

### Pitfall 4: --fast Batching Excludes Locked Decisions
**What goes wrong:** `--fast` mode skips important gray-area discussions because it batches too aggressively.
**Why it happens:** The `low_risk_fast_path` section (discuss-phase.md lines 126-154) already has the right guard: "This fast path only compresses low-risk clarification. It must not bypass locked decisions, deferred ideas, or agent-discretion capture."
**How to avoid:** The `--fast` flag must wire into the existing `low_risk_fast_path` step, not replace the full discussion flow. Only low-ranked gray areas qualify.
**Warning signs:** High or medium gray areas resolved without user interaction in `--fast` mode.

### Pitfall 5: Batch Freshness Transaction Failure
**What goes wrong:** Batch freshness check uses a transaction, but if any file is deleted mid-batch, the whole transaction fails.
**Why it happens:** SQLite transactions fail if any statement references a missing file (for mtime check).
**How to avoid:** Catch individual file errors within the batch; treat missing files as `missing` category; only wrap the SELECT in transaction for atomicity on success case.
**Warning signs:** Batch freshness check throws on valid but recently-deleted files.

---

## Code Examples

### TTL-Backed Computed-Value Storage (ACCEL-03)

```javascript
// In planning-cache.js — extend PlanningCache class
const COMPUTED_TTL_MS = 10 * 60 * 1000; // 10 minutes (stress-tested hybrid value)

/**
 * Get a cached computed value if fresh (TTL not expired).
 * @param {string} key - Computed value key (e.g., "classifyTaskComplexity:<hash>")
 * @returns {object|null} Cached value or null if missing/stale
 */
getComputedValue(key) {
  if (this._isMap()) return null;
  try {
    const row = this._stmt(
      'cv_get',
      'SELECT value_json, ttl_ms FROM computed_values WHERE key = ?'
    ).get(key);
    if (!row) return null;
    if (Date.now() > row.ttl_ms) {
      // Expired — delete and return null
      this._stmt('cv_del', 'DELETE FROM computed_values WHERE key = ?').run(key);
      return null;
    }
    return JSON.parse(row.value_json);
  } catch {
    return null;
  }
}

/**
 * Store a computed value with TTL.
 * @param {string} key
 * @param {object} value
 * @param {number} ttlMs - TTL in milliseconds (default: 10min)
 */
setComputedValue(key, value, ttlMs = COMPUTED_TTL_MS) {
  if (this._isMap()) return;
  try {
    this._stmt(
      'cv_upsert',
      'INSERT OR REPLACE INTO computed_values (key, value_json, ttl_ms, created_at) VALUES (?, ?, ?, ?)'
    ).run(key, JSON.stringify(value), Date.now() + ttlMs, new Date().toISOString());
  } catch {
    // Non-fatal
  }
}
```

### Batch Freshness Check — Single Transaction (ACCEL-04)

```javascript
// In planning-cache.js — replace checkAllFreshness loop with batch
/**
 * Bulk freshness check in a SINGLE SQLite transaction.
 * Returns files categorized by freshness status.
 *
 * @param {string[]} filePaths
 * @returns {{ fresh: string[], stale: string[], missing: string[] }}
 */
batchCheckFreshness(filePaths) {
  const result = { fresh: [], stale: [], missing: [] };
  if (this._isMap()) {
    for (const fp of filePaths) result.missing.push(fp);
    return result;
  }
  if (filePaths.length === 0) return result;

  try {
    this._db.exec('BEGIN');
    // Single SELECT with IN clause — one SQLite call
    const placeholders = filePaths.map(() => '?').join(',');
    const rows = this._db.prepare(
      `SELECT file_path, mtime_ms FROM file_cache WHERE file_path IN (${placeholders})`
    ).all(...filePaths);
    const rowMap = {};
    for (const row of rows) rowMap[row.file_path] = row.mtime_ms;

    for (const fp of filePaths) {
      const cachedMtime = rowMap[fp];
      if (cachedMtime === undefined) {
        result.missing.push(fp);
        continue;
      }
      try {
        const currentMtime = fs.statSync(fp).mtimeMs;
        if (currentMtime === cachedMtime) result.fresh.push(fp);
        else result.stale.push(fp);
      } catch {
        result.missing.push(fp);
      }
    }
    this._db.exec('COMMIT');
  } catch {
    try { this._db.exec('ROLLBACK'); } catch { /* ignore */ }
    // Fallback to per-file on transaction failure
    for (const fp of filePaths) {
      const status = this.checkFreshness(fp);
      result[status].push(fp);
    }
  }
  return result;
}
```

### Telemetry Hook in orchestration.js (ACCEL-02)

```javascript
// In orchestration.js — add telemetryLog function and wrap hot-path calls
const TELEMETRY_LOG_PATH = '.planning/telemetry/routing-log.jsonl';

/**
 * Log routing telemetry (append-only, coarse + frequency).
 * @param {string} functionName - e.g., "classifyTaskComplexity", "routeTask"
 * @param {string} inputsHash - stable hash of inputs for deduplication
 * @param {object} output - routed output
 */
function telemetryLog(functionName, inputsHash, output) {
  try {
    const logDir = path.dirname(TELEMETRY_LOG_PATH);
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const entry = {
      function: functionName,
      key: inputsHash,
      profile: output?.profile || null,
      model: output?.model || null,
      agent: output?.agent || null,
      timestamp: new Date().toISOString(),
    };
    fs.appendFileSync(TELEMETRY_LOG_PATH, JSON.stringify(entry) + '\n');
  } catch {
    // Non-fatal — telemetry must never block routing
  }
}

// Wrap classifyTaskComplexity — compute stable hash from task structure
function classifyTaskComplexity(task, context) {
  const result = _classifyTaskComplexityImpl(task, context);
  const hash = hashTaskInputs(task); // stable hash of task + context
  telemetryLog('classifyTaskComplexity', hash, result);
  return result;
}

// Wrap routeTask
function routeTask(complexity, config, cwd) {
  const result = _routeTaskImpl(complexity, config, cwd);
  const hash = hashComplexityInputs(complexity);
  telemetryLog('routeTask', hash, result);
  return result;
}
```

### discuss-phase --fast Flag Wiring (FAST-01)

The existing `low_risk_fast_path` step (discuss-phase.md lines 126-154) already provides the fast-path logic. The `--fast` flag should:
1. Auto-qualify phases with ≤2 low-ranked gray areas as "routine"
2. Present low-risk defaults as a single batch confirmation
3. Preserve locked decisions and deferred ideas unchanged

```javascript
// In discuss-phase.md step initialization — parse --fast flag
// Added to the initialize step's argument parsing:
// Parse --fast flag
const isFast = /--fast\b/.test(argsStr);
if (isFast && lowGrayAreaCount <= 2) {
  // Skip present_gray_areas; go directly to low_risk_fast_path
  // ... but still run customer_stress_test
}
```

### verify-work --batch N Flag Wiring (FAST-02)

Already parsed in verify-work.md (line 22). The batch mode logic needs implementation:
```javascript
// In verify-work.md extract_tests or present_tests step:
// --batch N: group N tests, present together
// Default (no --batch): one test at a time
// High-risk/ambiguous tests: always exact item-level even in batch mode
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-plan mtime cache check (N queries) | Batch freshness in single SQLite transaction | Phase 201 (this phase) | 1 query instead of N |
| No routing telemetry | Coarse frequency telemetry hooks | Phase 201 (this phase) | Enables workflow:hotpath analysis |
| No computed-value caching in PlanningCache | TTL-backed computed-value tables | Phase 201 (this phase) | Eliminates repeated classifyTaskComplexity/routeTask computation |
| No --fast mode in discuss-phase | --fast flag batches low-risk items | Phase 201 (this phase) | Fewer user turns for routine phases |
| No --batch mode in verify-work | --batch N flag for routine verification | Phase 201 (this phase) | Fewer user turns during UAT |
| workflow:baseline saves to baselines/ | ACCEL-BASELINE.json in research/ | Phase 201 (this phase) | Pre-change baseline for measurement |
| No workflow:hotpath | workflow:hotpath command | Phase 201 (this phase) | Visibility into actual routing patterns |

---

## Open Questions

1. **`workflow:hotpath` output format** — CONTEXT.md marks this as "clarification needed later." The telemetry log stores route name + hit count; the display command needs format definition (text table? JSON? ASCII chart?). Not blocking — implement with placeholder format, refine later.

2. **Telemetry log rotation** — The append-only JSONL telemetry log could grow indefinitely. Should `workflow:hotpath` also include log rotation or size limits? Contained in Phase 201 scope (TTL-backed cache handles the data side; log rotation is a future concern).

3. **Hot-path detection threshold** — At what hit count does a route qualify as "hot"? Need empirical data from baseline run. CONTEXT.md says "coarse + frequency" — frequency bucketing is TBD after baseline.

4. **Interaction between `--fast` and `low_risk_fast_path`** — The existing step already has fast-path logic. Need to verify the flag wiring doesn't duplicate or conflict with the existing step flow.

---

## Sources

### Primary (HIGH confidence)
- **Local project** — `src/lib/orchestration.js` (classifyTaskComplexity, routeTask, selectExecutionMode), `src/lib/planning-cache.js` (checkFreshness, checkAllFreshness, file_cache table), `src/commands/workflow.js` (workflow:baseline, workflow:compare, workflow:verify-structure)
- **CONTEXT.md** — Phase 201 locked decisions, stress-tested TTL revision, non-goals
- **REQUIREMENTS.md** — ACCEL-01 through ACCEL-04, FAST-01 through FAST-03 requirements and traceability

### Secondary (MEDIUM confidence)
- **`.planning/research/FEATURES.md`** — Feature inventory, prioritization, dependency graph for v19.3
- **`.planning/research/PITFALLS.md`** — Pitfall 1 (optimizing without baseline), Pitfall 5 (hot-path assumption drift) directly relevant
- **`.planning/research/SUMMARY.md`** — Stack recommendations (TTL-backed computed-value tables, batch freshness, node:sqlite)
- **`workflow.test.cjs`** — Existing workflow:baseline test patterns and output format

### Tertiary (LOW confidence)
- **Training data for node:sqlite TTL patterns** — No specific TTL-backed table pattern in project docs; derived from existing `file_cache` table pattern and stress-tested TTL decision

---

## Phase Requirements

| Requirement | Description | Implementation Location |
|-------------|-------------|----------------------|
| ACCEL-01 | workflow:baseline saves to .planning/research/ACCEL-BASELINE.json | `src/commands/workflow.js` — path variant |
| ACCEL-02 | Adaptive telemetry hooks in orchestration.js | `src/lib/orchestration.js` — wrap classifyTaskComplexity and routeTask |
| ACCEL-03 | TTL-backed computed-value tables in PlanningCache | `src/lib/planning-cache.js` — getComputedValue, setComputedValue |
| ACCEL-04 | Batch freshness checks in single SQLite transaction | `src/lib/planning-cache.js` — batchCheckFreshness |
| FAST-01 | discuss-phase --fast flag | `workflows/discuss-phase.md` — --fast flag parsing + low_risk_fast_path wiring |
| FAST-02 | verify-work --batch N flag | `workflows/verify-work.md` — --batch N parsing + batch display logic |
| FAST-03 | workflow:hotpath command | `src/commands/workflow.js` — new command consuming telemetry log |
