---
phase: 79-startup-compile-cache-acceleration
plan: "02"
verified: 2026-03-10
status: gaps_found
score: 20
gaps:
  - id: 1
    category: functional
    severity: blocker
    description: "Compile-cache makes startup SLOWER instead of faster - opposite of goal"
    evidence: |
      - Benchmark shows: baseline 101ms vs compile-cache 160ms
      - speedup_percent: -58% (58% WORSE!)
      - This is the opposite of the phase goal: "Repeated CLI invocations start faster"
      - Root cause: Node 22+ has compile-cache enabled by default, adding explicit flag adds overhead
  - id: 2
    category: requirement
    severity: blocker
    description: "RUNT-01 NOT ACHIEVED - repeated CLI invocations do NOT start faster"
    evidence: |
      - Goal: "User can get faster repeated CLI invocation startup through compile-cache enablement"
      - Actual: Enable compile-cache makes startup 58% SLOWER
      - This is fundamentally opposite to the requirement
---

# Phase 79 Verification Report (Re-Verification)

## Goal Achievement

**Phase Goal:** Repeated CLI invocations start faster through guarded compile-cache usage without runtime breakage.

| Truth | Status | Evidence |
|-------|--------|----------|
| Repeated CLI invocations start faster with warm-cache module compilation | ✗ FAILED | Benchmark shows -58% (MUCH slower), not faster. Compile-cache adds overhead on Node 22+. |
| Compile-cache can be explicitly enabled/disabled via config or environment guard | ✓ VERIFIED | BGSD_COMPILE_CACHE env var works, wrapper reads it correctly |
| Unsupported runtimes automatically fall back to current behavior without breakage | ✓ VERIFIED | Wrapper has fallback logic, gracefully handles errors |

## Required Artifacts

| Artifact | Path | Status | Details |
|----------|------|--------|---------|
| CLI wrapper with compile-cache support | bin/bgsd | ✓ VERIFIED | Exists, 21 lines, executable |
| CLI entry point | bin/bgsd-tools.cjs | ✓ VERIFIED | Exists, unchanged |
| Runtime capability detection | src/lib/runtime-capabilities.js | ✓ VERIFIED | Exists |
| Benchmark script | benchmark-compile-cache.cjs | ✓ VERIFIED | Updated to use wrapper |
| Benchmark results | .planning/baselines/compile-cache-benchmark.json | ✓ VERIFIED | Shows -58% speedup (worse!) |

### Artifact Quality (3-Level Check)

| Artifact | Exists | Substantive | Wired | Notes |
|----------|--------|-------------|-------|-------|
| bin/bgsd | ✓ | ✓ | ✓ | Wrapper applies --experimental-code-cache when enabled |
| src/lib/runtime-capabilities.js | ✓ | ✓ | ✓ | Detection code exists |
| benchmark-compile-cache.cjs | ✓ | ✓ | ✓ | Correctly uses wrapper |

## Key Link Verification

| From | To | Via | Status | Notes |
|------|----|-----|--------|-------|
| bin/bgsd | bin/bgsd-tools.cjs | spawn with node | ✓ WIRED | Wrapper correctly spawns CLI |

## Requirements Coverage

| Requirement | Phase | Status | Evidence |
|-------------|-------|--------|----------|
| RUNT-01: Faster repeated CLI via compile-cache | 79 | ✗ NOT ACHIEVED | Compile-cache makes startup 58% SLOWER |
| RUNT-03: Fallback on unsupported runtimes | 79 | ✓ ACHIEVED | Wrapper has graceful fallback |

## Anti-Patterns Found

| Pattern | Severity | Location | Description |
|---------|----------|----------|-------------|
| Counter-productive performance fix | 🛑 Blocker | bin/bgsd, benchmark | Adding compile-cache makes startup SLOWER, not faster |
| Incompatible with modern Node | 🛑 Blocker | Implementation | Node 22+ has compile-cache enabled by default, explicit flag causes overhead |

## Human Verification Required

| Item | Reason | Status |
|------|--------|--------|
| Compile-cache behavior on older Node | Cannot verify programmatically - requires Node 18-20 | Needs human to test |

## Gaps Summary

### Blocker: Compile-Cache Causes Slower Startup

The implementation exists and is wired correctly, but has a fundamental flaw:

1. **What was built:** A wrapper script (bin/bgsd) that adds --experimental-code-cache flag
2. **What's happening:** On Node 22+, compile-cache is enabled by default. Adding the explicit flag adds overhead instead of improving performance.
3. **Evidence:** Benchmark shows:
   - Without compile-cache: median 101ms
   - With compile-cache: median 160ms
   - Speedup: -58% (58% WORSE!)

4. **Root cause:** The --experimental-code-cache flag is deprecated in Node 22+ because compile-cache is now enabled by default. Adding the flag causes extra processing/validation overhead.

### Why This Matters

The phase goal is "Repeated CLI invocations start faster through guarded compile-cache usage". The implementation does the OPPOSITE - it makes startup slower.

**To fix:** Need to either:
- Remove the --experimental-code-cache flag entirely (since Node 22+ has it by default)
- OR add detection to NOT pass the flag on Node 22+
- OR use a different performance optimization approach

---

## Verification Conclusion

**Status:** gaps_found

**Score:** 20/100

**Summary:** The bin/bgsd wrapper was created to fix the previous gap (compile-cache flag never applied), and it does apply the flag correctly. However, a new critical gap was discovered: on modern Node.js (22+), the --experimental-code-cache flag is deprecated because compile-cache is enabled by default. Adding the explicit flag actually adds overhead, making startup 58% SLOWER instead of faster. This is the opposite of the phase goal.

**Required for gap closure:**
1. Update wrapper to NOT pass --experimental-code-cache flag on Node 22+ (already has cache by default)
2. Re-run benchmark to confirm positive speedup
3. Update SUMMARY with accurate performance data
