# Research: Phase 204 Wire Batch State API

## Gap Closure Context

This phase closes GAP-001, GAP-002, and FLOW-002 from v19.3 audit.

### GAP-001: storeSessionBundleBatch is Dead Code
- **Location:** `planning-cache.js:1316`
- **Status:** Fully implemented with BEGIN/COMMIT/ROLLBACK transaction support
- **Problem:** Zero callers in execute-plan workflow

### GAP-002: canBatch Guard is Dead Code
- **Location:** `state-session-mutator.js:20`
- **Logic:** `return !SACRED_DATA_STORES.has(store)` where sacred = `['decisions', 'lessons', 'trajectories', 'requirements']`
- **Problem:** Never called — no routing logic between batch vs single-write paths

### FLOW-002: Batch State API Never Invoked
- **Problem:** execute-plan workflow does not call storeSessionBundleBatch

## Source Analysis

### storeSessionBundleBatch (planning-cache.js:1316)
```javascript
storeSessionBundleBatch(cwd, bundles) {
  // Full transaction support with BEGIN/COMMIT/ROLLBACK
  // Handles: state, decisions, blockers, continuity per bundle
}
```

### canBatch (state-session-mutator.js:20)
```javascript
function canBatch(store) {
  return !SACRED_DATA_STORES.has(store);
}
```

## Integration Requirements

1. **Call storeSessionBundleBatch** from execute-plan workflow for applicable state mutations
2. **Add canBatch routing** to decide batch vs single-write paths based on store type
3. **Ensure sacred data stores** (decisions, lessons, trajectories, requirements) always use single-write path
4. **Batch path** must include BEGIN/COMMIT/ROLLBACK transaction support

## Success Criteria

From ROADMAP.md:
1. `storeSessionBundleBatch` is called from execute-plan workflow for applicable state mutations
2. `canBatch` guard routes between batch and single-write paths based on store type
3. Batch path includes BEGIN/COMMIT/ROLLBACK transaction support
4. `execute-plan --dry-run` shows batch path being selected for non-sacred stores

## Requirements Coverage

| REQ-ID | Description | Gap |
|--------|-------------|-----|
| STATE-02 | Batch transaction support | GAP-001: storeSessionBundleBatch never called |
| STATE-03 | canBatch guard for sacred data | GAP-002: canBatch never used |
| BUNDLE-01 | npm run build after plans | FLOW-002: batch API not wired |
| BUNDLE-02 | CLI contract validation | FLOW-002: batch API not wired |
