# Phase 203: State Mutation Safety - Research

**Researched:** 2026-04-05
**Domain:** Node.js CLI state mutation safety, SQLite transactions, sacred data protection, bundle integrity
**Confidence:** HIGH

## Summary

Phase 203 adds regression validation, batch transaction support, and sacred data protection to the existing state mutation system. The core architecture is already in place: `PlanningCache` uses SQLite transactions with mutex protection, `state-session-mutator.js` performs dual-write (markdown + SQLite), and sacred stores are already protected from compaction. The gaps are: (1) `verify:state validate` is not wired into execute-plan workflow, (2) no batch transaction API for non-sacred state, (3) sacred data path has no batching guard, (4) no `npm run build` smoke test in workflows, and (5) `util:validate-commands` needs explicit routing-change integration.

**Primary recommendation:** Extend `cmdStateCompletePlan` with batch-write capability gated by store-type check, wire `verify:state validate` as a post-batch checkpoint in execute-plan, add `npm run build` smoke step to execute-phase workflow, and enforce sacred-data single-write path via store-type guard in the batch API.

## User Constraints

*(Must be FIRST section — Planner honors these exactly)*

| Constraint | Value | Source |
|------------|-------|--------|
| Sacred data boundary | decisions, lessons, trajectories, requirements only | 203-CONTEXT.md |
| Validation trigger point | Plan end only (not per-batch) | 203-CONTEXT.md |
| Batch failure recovery | Rollback + report + plan abort | 203-CONTEXT.md |
| Atomicity scope | Single-file only (not cross-file transactions) | 203-CONTEXT.md |
| Smoke test placement | After execute-phase completes (not after planning) | 203-CONTEXT.md |
| Sacred data batching | NEVER — always canonical single-write path | 203-CONTEXT.md |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:sqlite` | bundled | SQLite database for PlanningCache | Already used by project |
| `node:fs` | bundled | Atomic file writes via writeFileAtomic | Already used in json-store-mutator |
| `node:child_process` | bundled | npm run build smoke test, validate-commands | Already used extensively |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `SharedArrayBuffer` + `Atomics` | ES2021 | Mutex pool for concurrent cache access | Already in PlanningCache |
| PlanningCache (existing) | — | TTL-backed computed values, mtime cache | All batch operations |
| `withProjectLock` | existing | Project-level lock for state mutations | Serialize concurrent writes |
| `writeFileAtomic` | existing | Single-file atomic write | All state file writes |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom mutex | `node:async` mutex | Built-in Atomics already faster |
| Cross-file transactions | Write-ahead log | Single-file atomicity already sufficient per locked decision |
| Separate batch queue | Background worker thread | Overkill for CLI synchronous writes |

## Architecture Patterns

### Recommended Project Structure

```
src/
  commands/state.js          # verify:state validate, verify:state complete-plan
  lib/state-session-mutator.js  # applyStateSessionMutation (extend for batch)
  lib/planning-cache.js     # PlanningCache (already has mutex pool, SQLite tx)

workflows/
  execute-plan.md           # Wire verify:state validate post-batch
  execute-phase.md          # Add npm run build smoke test step
```

### Pattern 1: Sacred Data Guard on Batch API

Every batch-write entry point MUST check store type before batching:

```javascript
// Sacred stores use canonical single-write path — NEVER batch
if (SACRED_STORES.includes(store)) {
  // Route to existing single-write path (writeMemoryEntry, storeSessionBundle, etc.)
  return singleWritePath(cwd, store, entry);
}
// Non-sacred: batch-enabled write
return batchEnabledWrite(cwd, store, entry);
```

**Existing code:** `memory.js` already has `SACRED_STORES = ['decisions', 'lessons', 'trajectories']` and skips compaction for sacred stores.

### Pattern 2: Batch Transaction with Validation Gate

After batched writes complete, run regression validation before committing:

```
[Batch Write] → [Rollback-Protected Commit] → [verify:state validate] → [Commit or Abort]
```

**Existing code:** `PlanningCache` already wraps all store operations in `BEGIN/COMMIT/ROLLBACK` transactions (see `storeSessionBundle`, `storeSessionCompletionCore`).

### Pattern 3: Smoke Test as Workflow Step

```
execute-phase workflow:
  [aggregate_results] → [npm run build] → [verify_phase_goal]
```

**Existing code:** `quality.js` already has `isBuildVerificationCommand()` detecting `npm run build`.

### Anti-Patterns to Avoid

| Anti-Pattern | Why Wrong | Correct Pattern |
|--------------|-----------|-----------------|
| Batching sacred data writes | Violates sacred data boundary, interleaves with non-sacred | Use `SACRED_STORES` guard, always single-write |
| Per-batch validation | Per CONTEXT.md: Phase 202 already provides per-batch mutex safety; plan-end validation is the regression gate | `verify:state validate` at plan end only |
| Cross-file atomic transactions | Locked decision: single-file only | Each file commits independently |
| Running smoke test after planning | Locked decision: smoke test after execute-phase only | Smoke test step after `aggregate_results` |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Mutex-protected concurrent cache access | Custom mutex implementation | Existing `PlanningCache._mutexPool` with `Atomics.compareExchange` | Already implemented, stress-tested |
| Single-file atomic write | Raw fs.writeFileSync | `writeFileAtomic` from `atomic-write.js` | Handles partial writes, already used everywhere |
| Sacred store protection | Custom guard logic | Existing `SACRED_STORES` constant in `memory.js` | Already defined, used for compaction |
| Batch freshness check | Per-file mtime check | `PlanningCache.batchCheckFreshness()` | Already uses single SQLite transaction |
| Project-level write serialization | Custom locking | `withProjectLock()` from `project-lock.js` | Already wraps all state mutations |

## Common Pitfalls

### Pitfall 1: Sacred Data Interleaving in Batches
**What goes wrong:** Sacred data (decisions, lessons, trajectories) accidentally included in a batch with non-sacred data, violating the sacred boundary.
**Why it happens:** No store-type check at batch entry point.
**How to avoid:** Add `SACRED_STORES.includes(store)` guard at every batch write entry point.
**Warning signs:** Sacred store appearing in batch operation logs, sacred data changes appearing in same transaction as non-sacred.

### Pitfall 2: Validation Timing Confusion
**What goes wrong:** Planner tries to add per-batch validation instead of plan-end validation.
**Why it happens:** Misunderstanding that "batched state write" means per-batch validation is needed.
**How to avoid:** Phase 202 mutex protection is the per-batch safety. Phase 203 `verify:state validate` is the regression gate (plan-end only).
**Warning signs:** Planner adding validation inside batch loop instead of after all batches complete.

### Pitfall 3: Cross-File Transaction Assumption
**What goes wrong:** Assuming batch transactions can be atomic across multiple STATE.md files or memory stores.
**Why it happens:** Locked decision states single-file only.
**How to avoid:** Each file in a batch commits independently. Validation failure triggers rollback of the batch (not individual files in the batch).
**Warning signs:** Code using multi-file BEGIN TRANSACTION.

### Pitfall 4: Bundle Parity Silent Failures
**What goes wrong:** `npm run build` smoke test not run after plan changes, causing bundle parity drift.
**Why it happens:** No smoke test step in execute-plan or execute-phase workflow.
**How to avoid:** Add `npm run build` step to execute-phase workflow after `aggregate_results`.
**Warning signs:** Build artifacts in `bin/` don't match source in `src/`.

### Pitfall 5: CLI Contract Drift After Routing Changes
**What goes wrong:** Routing changes break `bgsd-tools` subcommands, no validation gate.
**Why it happens:** No `util:validate-commands` after routing-affecting changes.
**How to avoid:** Run `util:validate-commands --raw` after any routing change (locked to Phase 159 pattern).
**Warning signs:** Router tests failing, unknown subcommand errors.

## Code Examples

### Sacred Store Guard (Memory Batch Write)

```javascript
// src/commands/memory.js — existing SACRED_STORES already defined
const SACRED_STORES = ['decisions', 'lessons', 'trajectories'];

// In batch write function:
function batchWriteMemory(cwd, store, entries) {
  // GUARD: Sacred stores never batched
  if (SACRED_STORES.includes(store)) {
    // Route to canonical single-write path
    for (const entry of entries) {
      writeMemoryEntry(cwd, store, entry);  // existing single-write
    }
    return;
  }
  // Non-sacred: batch transaction
  const cache = _getCache(cwd);
  cache.db.exec('BEGIN');
  try {
    for (const entry of entries) {
      writeMemoryEntry(cwd, store, entry);
    }
    cache.db.exec('COMMIT');
  } catch (e) {
    cache.db.exec('ROLLBACK');
    throw e;
  }
}
```

### Batch Transaction API Extension (PlanningCache)

```javascript
// src/lib/planning-cache.js — extend storeSessionBundle for batch
storeSessionBundleBatch(cwd, bundles) {
  if (this._isMap()) return null;
  try {
    this.db.exec('BEGIN');
    for (const bundle of bundles) {
      this.storeSessionBundle(cwd, bundle);  // existing single bundle write
    }
    this.db.exec('COMMIT');
    return { stored: true, count: bundles.length };
  } catch (e) {
    try { this.db.exec('ROLLBACK'); } catch {}
    return null;
  }
}
```

### verify:state validate Wiring (execute-plan workflow step)

```javascript
// workflows/execute-plan.md — new step after update_position
step name="state_validation_gate">
  Run validation after batched state writes complete:
  ```bash
  VALIDATION=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:state validate --raw 2>/dev/null)
  echo "$VALIDATION"
  ```
  If status != 'clean': STOP, report issues, do not proceed to next plan.
</step>
```

### npm run build Smoke Test (execute-phase workflow step)

```javascript
// workflows/execute-phase.md — new step after aggregate_results
step name="bundle_smoke_test">
  ```bash
  BUILD_OUTPUT=$(npm run build 2>&1)
  BUILD_EXIT=$?
  if [ $BUILD_EXIT -ne 0 ]; then
    echo "BUNDLE PARITY FAILURE: $BUILD_OUTPUT"
    exit 1
  fi
  echo "Bundle smoke test: PASS"
  ```
</step>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No state validation gate | verify:state validate with regression checks | Phase 203 (this phase) | Catches plan count drift, stale blockers, position inconsistencies |
| Single-file only writes | Batch transaction API for non-sacred only | Phase 203 (this phase) | Performance improvement for non-critical state writes |
| No sacred data protection | SACRED_STORES guard on batch API | Existing (Phase ~159) | Sacred data always uses single-write path |
| No bundle smoke test | npm run build gate after execute-phase | Phase 203 (this phase) | Catches bundle parity issues early |
| No CLI contract validation | util:validate-commands after routing changes | Phase 159 (existing) | Catches broken commands before user impact |

## Open Questions

1. **Batch size limits:** Agent discretion per CONTEXT.md — is there a practical upper bound based on existing PlanningCache behavior?
2. **Validation report format:** Agent discretion — is there an existing format standard for `verify:state validate` output?
3. **Smoke test exit behavior:** Should bundle parity failure halt the phase or just warn? CONTEXT.md says "fails closed" but doesn't specify exit code handling.

## Sources

### Primary (HIGH confidence)
- `src/commands/state.js` — verify:state validate and complete-plan implementations
- `src/commands/memory.js` — SACRED_STORES definition and existing sacred data handling
- `src/lib/planning-cache.js` — SQLite transactions, mutex pool, batch freshness check
- `src/lib/state-session-mutator.js` — dual-write pattern (markdown + SQLite)
- `workflows/execute-plan.md` — current state mutation points
- `workflows/execute-phase.md` — current workflow structure

### Secondary (MEDIUM confidence)
- `src/lib/atomic-write.js` — writeFileAtomic implementation
- `src/commands/misc/frontmatter.js` — cmdValidateCommands implementation
- `src/lib/commandDiscovery.js` — validateCommandIntegrity for util:validate-commands

### Tertiary (LOW confidence)
- Training data on "best practices for sacred data protection" — overridden by project-specific SACRED_STORES implementation

## Metadata

**Confidence breakdown:** 
- Sacred data boundary: HIGH (code-verified: SACRED_STORES in memory.js)
- Batch transaction support: HIGH (code-verified: PlanningCache already has transactions)
- verify:state validate wiring: HIGH (code-verified: command exists, workflow location confirmed)
- npm run build smoke test: HIGH (code-verified: npm run build detected in quality.js)
- util:validate-commands: HIGH (code-verified: command exists and documented)

**Research date:** 2026-04-05
**Valid until:** Phase 203 implementation complete
