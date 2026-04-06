# Pitfalls Research

**Domain:** Workflow Acceleration Improvements (v19.3)
**Researched:** 2026-04-05
**Confidence:** HIGH

<!-- section: compact -->
<pitfalls_compact>
<!-- Compact view for planners. Keep under 25 lines. -->

**Top pitfalls:**
1. **Optimizing without measurement** — baseline hot-path profiling must precede any routing/caching changes (Phase 201)
2. **Cache invalidation races** — parallel stages can stale-refresh same entries, corrupting shared state (Phase 202)
3. **Breaking JJ workspace proof gates** — acceleration must not bypass `workspace prove` triple-match safety (Phase 202)

**Tech debt traps:** Hardcoding hot-path assumptions, batching without I/O pattern analysis, skipping baseline measurement

**Security risks:** Faster routing does not change permission model; parallel stages still need single-writer finalize contracts

**"Looks done but isn't" checks:**
- Workflow routing: verify decision latency < 5ms p50 after changes
- Caching: verify cache hit rate improves and invalidation is consistent
- Parallelization: verify dependency order preserved and no race conditions
</pitfalls_compact>
<!-- /section -->

<!-- section: critical_pitfalls -->
## Critical Pitfalls

### Pitfall 1: Optimizing Without Measurement Baseline

**What goes wrong:**
Acceleration work changes routing, caching, or parallelization behavior, but without a pre-change baseline there is no way to verify improvement, detect regressions, or know which change caused a regression when something breaks.

**Why it happens:**
It feels productive to implement the "obvious" optimization first. The workflow measurement infrastructure exists (`workflow:baseline`, `workflow:compare`) but appears optional when timelines are tight.

**How to avoid:**
1. In Phase 201, run `workflow:baseline` against the current codebase and record results in the research directory
2. Any acceleration change must show before/after metrics in the PR
3. If metrics do not improve, revert the change

**Warning signs:**
- No baseline saved before making routing/caching/batching changes
- Latency numbers claimed without citing measured baseline
- Discussion of "obviously faster" without data

**Phase to address:** Phase 201 — Measurement Foundation

---

### Pitfall 2: Cache Invalidation Races in Parallel Stages

**What goes wrong:**
When parallel workflow stages share a cache layer, simultaneous invalidation of the same entry (or simultaneous reads during invalidation) can return stale data, crash with "undefined helper" errors, or corrupt the shared cache state. This has been a recurring issue — the lessons show 10+ cache-related failures from cold-cache warmup bugs, undefined helper references, and stale cache reads after writes.

**Why it happens:**
The existing L1/L2 cache (Map + SQLite) was designed for single-writer sequential workflows. Parallel stages add concurrent readers and writers without synchronization beyond what the single-file CLI's process-boundary isolation provides.

**How to avoid:**
1. Before parallel stages share a cache, add mutex/locking at the cache key level
2. Ensure `workspace prove` proof is fresh before parallel fan-out
3. Wire one serial cache-warm call before any parallel cache-dependent operations (lesson: a57404a6)
4. Always retry cache-dependent operations once on transient crash before escalating

**Warning signs:**
- Parallel stages hit the same cache key simultaneously
- `writeDebugDiagnostic is not defined` or `createPlanMetadataContext is not defined` errors in parallel paths
- Stale data returned after cache invalidation in concurrent context

**Phase to address:** Phase 202 — Parallelization Safety

---

### Pitfall 3: Bypassing JJ Workspace Proof Gates

**What goes wrong:**
Workflow acceleration may create pressure to short-circuit `workspace prove` gates or replace JJ-first execution paths with faster alternatives. This breaks the v19.0 contract that all execution flows through trusted finalize paths with proof verification.

**Why it happens:**
Proof gates add latency. When acceleration goals are measured in milliseconds, the `workspace prove` triple-match check feels like overhead to eliminate.

**How to avoid:**
1. Never remove or short-circuit the `workspace prove` gate
2. Any "fallback to sequential" acceleration must preserve the proof requirement as the triggering condition
3. If the proof check itself is slow, optimize the proof check, not the bypassing of it

**Warning signs:**
- Discussion of "skipping workspace prove for acceleration"
- New execution paths that bypass JJ workspace mode
- Fallback logic that doesn't require proof

**Phase to address:** Phase 202 — Parallelization Safety

---

### Pitfall 4: Breaking Backward Compatibility in State Mutations

**What goes wrong:**
The existing dual-store pattern (SQLite + STATE.md) and the verification helpers (`verify:state complete-plan`, `verify:verify artifacts`) have had repeated compatibility issues with STATE.md format changes. Faster state mutations through batching could introduce new format variations that break existing parsers.

**Why it happens:**
Multiple lessons document how `complete-plan` fails when STATE.md format does not match expected headings, how requirement checkbox parsing expects both bold and backtick formats, and how plan metadata context can be undefined. Batching state writes increases the surface area for format drift.

**How to avoid:**
1. Any batched state write must support both old and new STATE.md formats
2. Run `verify:state validate` against live STATE.md after any batched write
3. Add regression coverage for the current STATE.md shape before batching changes
4. Never batch sacred data writes — only cache/non-critical state

**Warning signs:**
- New state write paths that don't use the canonical mutation contracts
- Batch operations that skip the SQLite→STATE.md dual-write path
- STATE.md format changes without backward-compatible parsing

**Phase to address:** Phase 203 — State Mutation Safety

---

### Pitfall 5: Hot-Path Assumption Drift

**What goes wrong:**
The "hot path" for task routing is identified once during research but real usage patterns change. Optimizing the wrong path wastes effort and may slow down the actual hot path if cache/parallel resources are exhausted on low-value work.

**Why it happens:**
Workflow hot paths are discovered through profiling at a point in time. User behavior, project size, and phase complexity change which operations are actually on the critical path.

**How to avoid:**
1. Build profiling hooks into the acceleration work, not just the baseline
2. Log which operations are actually hitting fast-path vs slow-path
3. Make hot-path detection adaptive — don't hardcode routing decisions

**Warning signs:**
- Hot-path profile assumed from memory rather than measured
- No telemetry on which routing path is actually taken
- Discussion of "the hot path" without referencing measurement data

**Phase to address:** Phase 201 — Measurement Foundation
<!-- /section -->

<!-- section: tech_debt -->
## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip `workflow:baseline` measurement | Faster to start coding | No way to verify improvement or detect regression | Never — baseline is mandatory |
| Hardcode hot-path routing decision | Simpler code | Breaks when usage patterns shift | Only for Phase 201 prototyping, must be adaptive in production |
| Batch all state writes | Fewer I/O operations | Single batch failure corrupts multiple fields; harder to debug | Only for non-sacred cache data; sacred data (decisions, lessons) always synchronous |
| Parallelize without dependency sort | Easier fan-out | Race conditions on shared resources, corrupted cache state | Never without Kahn topological sort + mutex protection on shared cache keys |
| Replace SQLite cache with in-memory-only | Simpler deployment | Cache lost on process restart; no cross-invocation persistence | Only for read-only ephemeral data |
| Skip bundled-runtime smoke test | Faster build | Source works but bundle crashes (recurring issue — lessons 7bd4451d, 17c2bb71) | Never for any CLI behavior change |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| JJ workspace execution | Parallel stages bypass `workspace prove` | All parallel stages still require fresh proof before fan-out |
| SQLite L2 cache | Concurrent writes during parallel stages cause WAL contention or "database locked" | Add mutex per key; serialize writes to same cache entry |
| Bundle vs source parity | Source changes work but bundle crashes (recurring lesson pattern) | Always run `npm run build` + smoke test after any src/ change before claiming acceleration |
| State mutation batching | Batch writes drift from canonical STATE.md format | Run `verify:state validate` after every batch operation |
| TDD validator commands | Stubbed validators (`'not yet implemented'`) force manual proof | Implement validators before routing plans to TDD flow (lessons cde03562, 95c5d10a) |
<!-- /section -->

<!-- section: performance -->
## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Cache stampede | All parallel workers invalidate same key simultaneously, hammering the slow path | Implement mutex or lease per cache key before invalidation | More than 2 parallel workers hitting the same cache entry |
| Hot-path memoization without invalidation | Cached routing decision used long after underlying state changes | Add TTL or state-version-gated invalidation | Projects with long-running phases or multi-session execution |
| Batching without I/O pattern analysis | Batch overhead exceeds I/O savings for sparse writes | Profile actual I/O patterns before batching; batch only contiguous writes | Batching fewer than ~5 contiguous operations |
| Parallelization of already-sequential bottlenecks | Fan-out overhead (process spawn, queue management) exceeds parallelization gain | Measure sequential baseline first; parallelization only where parallel time < sequential time | Tasks with <10ms per-stage duration |
| Aggressive caching of parser results | Stale parser output after format changes (lesson bce8f4c8) | Invalidate parser caches when lifecycle hooks recompute state from disk | Any STATE.md or PLAN.md format change |
<!-- /section -->

<!-- section: security -->
## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Faster routing bypassing permission checks | Acceleration layer skips authorization guards embedded in slow paths | Ensure all fast-path routes go through the same permission checks as slow paths |
| Parallel stages writing to shared state without locks | Race condition corrupts sacred data (decisions, lessons, trajectories) | Mutex per shared resource; sacred data always single-writer |
| Cache poisoning via stale entries | Fast path returns invalidated routing/state data | Use git-hash + mtime hybrid invalidation (existing pattern from v12.0) |
| Unbounded parallel fan-out | Resource exhaustion from unlimited concurrent stages | Always use bounded parallelism with explicit max-concurrency |
<!-- /section -->

<!-- section: ux -->
## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Acceleration that makes behavior non-deterministic | Same command produces different results; users cannot reproduce issues | Preserve deterministic execution order unless explicitly parallel |
| Faster feedback with less visibility | Commands complete quickly but give no signal on what happened | Preserve diagnostic output even in fast-path mode |
| Silent fallback to slow path | User thinks acceleration is active but system fell back silently | Log when fallback occurs: "Accelerated path unavailable, using sequential fallback" |
| Latency improvements without throughput improvement | Per-command latency drops but overall throughput unchanged | Measure both latency (per-command time) and throughput (commands/second) |
<!-- /section -->

<!-- section: looks_done -->
## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Hot-path routing:** Often missing TTL or invalidation — verify routing cache invalidates on state changes
- [ ] **Batched I/O:** Often missing error recovery — verify batch failure rolls back cleanly without partial state
- [ ] **Parallelization:** Often missing dependency order verification — verify Kahn topological sort is enforced
- [ ] **Cache acceleration:** Often missing cross-invocation persistence test — verify cache survives process restart
- [ ] **Measurement:** Often missing post-change comparison — verify `workflow:compare` shows measurable improvement
- [ ] **Bundle parity:** Often missing smoke test — verify `npm run build` succeeds and CLI behaves identically to source
<!-- /section -->

<!-- section: recovery -->
## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Cache race corruption | MEDIUM | Force Map cache (`GSD_CACHE_FORCE_MAP=1`), rebuild cache from disk truth, retry operation |
| Bundle crash after source fix | LOW | Run `npm run build`, verify with `util:validate-commands --raw` before declaring fix complete |
| Parallelization race condition | HIGH | Disable parallel fan-out, revert to sequential, fix mutex logic, re-enable incrementally |
| Hot-path misidentification | MEDIUM | Re-run `workflow:baseline`, compare actual hot-path against assumed path, adjust routing |
| Batched write failure | MEDIUM | Delete batched output, re-run canonical synchronous path, verify STATE.md integrity |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Optimizing without baseline | Phase 201 | `workflow:baseline` saved and cited in PR |
| Cache invalidation races | Phase 202 | Parallel stages use mutex-protected cache; no crash on concurrent invalidation |
| JJ proof gate bypass | Phase 202 | `workspace prove` remains required; accelerated paths still trigger proof check |
| State mutation compatibility | Phase 203 | `verify:state validate` passes after any state write |
| Hot-path assumption drift | Phase 201 | Adaptive profiling telemetry in place |
| Bundle parity failures | All phases | `npm run build` smoke test always green |
<!-- /section -->

<!-- section: sources -->
## Sources

- Project lessons: `.planning/memory/lessons.json` (recurring cache/verifier/bundle patterns from v17–v19)
- Workflow measurement: `workflow:baseline`, `workflow:compare`, `workflow:verify-structure` (v14.0)
- JJ workspace execution: v19.0 milestone deliverables (workspace proof triple-match gate)
- SQLite caching: v12.0 DataStore schema, hybrid git-hash + mtime invalidation
- Parallelization safety: existing Kahn topological sort in `resolvePhaseDependencies` (v12.1)

---
*Pitfalls research for: workflow-acceleration-v19.3*
*Researched: 2026-04-05*
