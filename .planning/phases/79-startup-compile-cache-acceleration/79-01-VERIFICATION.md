---
phase: 79-startup-compile-cache-acceleration
verified: 2026-03-09
status: gaps_found
score: 33
gaps:
  - id: 1
    category: functional
    severity: blocker
    description: "Compile-cache flag is never actually applied to Node process - detection works but feature doesn't function"
    evidence: |
      - getCompileCacheArgs() returns ['--experimental-code-cache'] when enabled
      - But these args are never used to start Node
      - CLI cannot add startup flags to its own running process
      - Benchmark measures baseline vs baseline (no actual compile-cache)
  - id: 2
    category: performance
    severity: blocker
    description: "Benchmark shows -6% speedup (slower), not improvement - opposite of claimed goal"
    evidence: |
      - compile-cache-benchmark.json: speedup_percent: -6
      - Claims 10% improvement in SUMMARY but actual data shows negative
      - This is expected since compile-cache is never actually enabled
  - id: 3
    category: requirement
    severity: blocker
    description: "RUNT-01 NOT ACHIEVED - repeated CLI invocations do NOT start faster"
    evidence: |
      - Goal: "User can get faster repeated CLI invocation startup through compile-cache enablement"
      - Actual: Compile-cache is never enabled, no speedup occurs
---

# Phase 79 Verification Report

## Goal Achievement

**Phase Goal:** Repeated CLI invocations start faster through guarded compile-cache usage without runtime breakage.

| Truth | Status | Evidence |
|-------|--------|----------|
| Repeated CLI invocations start faster with warm-cache module compilation | ✗ FAILED | Benchmark shows -6% (slower), not faster. Compile-cache never actually enabled. |
| Compile-cache can be explicitly enabled/disabled via config or environment guard | ✓ VERIFIED | BGSD_COMPILE_CACHE env var works, isCompileCacheEnabled() reads it |
| Unsupported runtimes automatically fall back to current behavior without breakage | ✓ VERIFIED | detectCompileCacheSupport() returns supported:false for old Node, graceful fallback |

## Required Artifacts

| Artifact | Path | Status | Details |
|----------|------|--------|---------|
| CLI entry point with compile-cache support | bin/bgsd-tools.cjs | ✓ VERIFIED | Exists, bundled with runtime-capabilities |
| Runtime capability detection | src/lib/runtime-capabilities.js | ✓ VERIFIED | Exists, 195 lines, exports detectCompileCacheSupport |
| Benchmark script | benchmark-compile-cache.cjs | ✓ VERIFIED | Exists, 127 lines |
| Benchmark results | .planning/baselines/compile-cache-benchmark.json | ✓ VERIFIED | Exists with results |

### Artifact Quality (3-Level Check)

| Artifact | Exists | Substantive | Wired | Notes |
|----------|--------|-------------|-------|-------|
| src/lib/runtime-capabilities.js | ✓ | ✓ | ✓ | 195 lines, real implementation |
| bin/bgsd-tools.cjs | ✓ | ✓ | ✓ | Bundled correctly |
| benchmark-compile-cache.cjs | ✓ | ✓ | N/A | Measures but doesn't actually enable cache |

## Key Link Verification

| From | To | Via | Status | Notes |
|------|----|-----|--------|-------|
| bin/bgsd-tools.cjs | src/lib/runtime-capabilities.js | require at startup | ✓ WIRED | Required in router.js line 5 |

## Requirements Coverage

| Requirement | Phase | Status | Evidence |
|-------------|-------|--------|----------|
| RUNT-01: Faster repeated CLI via compile-cache | 79 | ✗ NOT ACHIEVED | Feature detection works but compile-cache never enabled |
| RUNT-03: Fallback on unsupported runtimes | 79 | ✓ ACHIEVED | Unsupported detection returns {supported:false}, graceful skip |

## Anti-Patterns Found

| Pattern | Severity | Location | Description |
|---------|----------|----------|-------------|
| False performance claim | 🛑 Blocker | 79-01-SUMMARY.md:49 | Claims "10% benchmark improvement" but actual benchmark shows -6% |
| Non-functional feature | 🛑 Blocker | src/lib/runtime-capabilities.js | getCompileCacheArgs() returns args but they're never applied |

## Human Verification Required

| Item | Reason | Status |
|------|--------|--------|
| Compile-cache functional test | Cannot verify programmatically - requires Node process with flag | Needs human to run: `node --experimental-code-cache bin/bgsd-tools.cjs util:current-timestamp` |

## Gaps Summary

### Blocker: Compile-Cache Never Enabled

The implementation has a fundamental architectural flaw:

1. **What was built:** Detection code that returns the `--experimental-code-cache` flag when enabled
2. **What's missing:** The actual application of this flag to the Node process
3. **Why it matters:** The CLI cannot modify its own startup flags after the process has started

**Root cause:** The `--experimental-code-cache` flag must be passed when starting Node.js, before the process begins. Setting `BGSD_COMPILE_CACHE=1` in the environment doesn't add this flag - it just sets an environment variable that the code reads but can't act on.

**To fix:** The implementation would need to either:
- Be a wrapper script that adds the flag before spawning Node (like a shell wrapper)
- Or use a different approach that doesn't require startup flags

### Blocker: Benchmark Shows Negative Speedup

The benchmark results in `compile-cache-benchmark.json` show:
- `speedup_ms: -5`
- `speedup_percent: -6`

This is the opposite of the goal. The SUMMARY claims "10% benchmark improvement" but the actual data shows the feature makes things slightly slower (due to the detection overhead, since compile-cache is never actually active).

---

## Verification Conclusion

**Status:** gaps_found

**Score:** 33/100

**Summary:** The compile-cache detection infrastructure is in place (artifacts exist and are wired correctly), but the core feature does NOT function. The `--experimental-code-cache` flag is never actually applied to the Node process, so repeated CLI invocations do NOT start faster. This is a fundamental implementation gap that blocks RUNT-01 achievement.

**Required for gap closure:**
1. Implement actual compile-cache enablement (requires wrapper script or different approach)
2. Re-run benchmark with actual compile-cache enabled
3. Update SUMMARY with accurate performance data
