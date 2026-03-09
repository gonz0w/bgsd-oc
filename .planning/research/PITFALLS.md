# Domain Pitfalls: v9.1 Performance Acceleration (Plugin + CLI Integration)

**Domain:** Aggressive performance optimization for an already-optimized OpenCode plugin and `bgsd-tools` CLI integration
**Researched:** 2026-03-09
**Confidence:** HIGH overall (Node.js API docs, OpenCode plugin/custom-tools docs, VS Code extension performance guidance, Hyperfine benchmarking docs)

## What Fails Most Often (and Hurts the Most)

These are the highest-risk mistakes teams make when "going fast" on plugin performance work.

| # | Pitfall | Why it is high-risk | Severity | Confidence |
|---|---|---|---|---|
| 1 | Optimizing without stable baseline/SLOs | Teams ship "faster" changes that regress real workflows | CRITICAL | HIGH |
| 2 | Measuring only warm-path or only microbenchmarks | Improvements do not translate to real user latency | CRITICAL | HIGH |
| 3 | Blocking the plugin event loop with sync I/O / sync subprocesses | UI/session responsiveness degrades under load | CRITICAL | HIGH |
| 4 | Over-instrumentation in hot paths | Profiling overhead becomes the bottleneck itself | HIGH | HIGH |
| 5 | Cache invalidation bugs in multi-layer caches (Map + SQLite + file cache) | Fast-but-wrong state creates silent correctness regressions | CRITICAL | MEDIUM-HIGH |
| 6 | Aggressive lazy loading on hot paths | Reduced startup cost but worse p95/p99 first-use latency | HIGH | HIGH |
| 7 | Hook fan-out and event storms (`session.idle`, file watchers) | Repeated work multiplies CPU/I/O cost unexpectedly | HIGH | HIGH |
| 8 | Tool name collisions or expensive tool wrappers | Core tools are shadowed or slowed in every call | HIGH | HIGH |
| 9 | Plugin interaction assumptions (hook ordering, shared mutable output) | Cross-plugin behavior becomes nondeterministic | HIGH | HIGH |
| 10 | No performance regression gates in CI | Drift accumulates and gains disappear within 1-2 phases | CRITICAL | HIGH |

---

## Critical Pitfalls (Must Plan Explicitly)

### 1) No Baseline Contract Before Optimization

**What goes wrong**
- Work starts with "let's make it faster" but no fixed scenario set, no p50/p95/p99 targets, and no acceptance thresholds.

**Why it happens**
- Existing performance work in prior milestones creates overconfidence; teams skip measurement discipline.

**Consequences**
- Local wins, user-perceived regressions, and constant re-tuning loops.

**Prevention (concrete)**
- Define 5-10 canonical workloads (cold start, warm start, common commands, long session idle/resume, compaction).
- Track **wall time + event-loop delay + command counts + cache hit ratio** per workload.
- Set explicit budgets (example): `startup <= X ms`, `hot command p95 <= Y ms`, `event loop p99 delay <= Z ms`.

**Detection signals**
- PR says "faster" but has no before/after table.
- Bench numbers are single-run, no variance (`stddev` missing).
- Different engineers report contradictory results on same change.

**Address in phase planning**
- **Phase 1 (Benchmark Harness + SLOs):** mandatory gate before any optimization phase.

---

### 2) Benchmarking Artifacts: Warm-only, Micro-only, or Non-reproducible Runs

**What goes wrong**
- Benchmarks measure idealized loops, not real plugin/CLI end-to-end paths.

**Why it happens**
- Microbench tools are easy to run; end-to-end harnesses are harder to keep deterministic.

**Consequences**
- "Win" in isolated function tests, loss in actual command latency.

**Prevention (concrete)**
- Use two lanes:
  - **Macro/E2E:** representative workflow timing.
  - **Micro:** only for hotspot diagnosis.
- For CLI timing, use warmup + prepare controls (Hyperfine):
  - warmup runs for steady-state
  - prepare/reset steps for cold-state comparability
- Report distribution (mean + sigma + min/max), not only fastest run.

**Detection signals**
- Huge improvement in microbench, no measurable E2E change.
- Re-running same benchmark flips winner.
- Only one cache state (always warm or always cold) appears in reports.

**Address in phase planning**
- **Phase 1:** benchmark methodology + fixtures.
- **Phase 2:** hotspot exploration only after macro regressions are proven.

---

### 3) Sync APIs in Plugin Hooks (Event Loop Blocking)

**What goes wrong**
- `readFileSync`, `execSync`, `execFileSync`, or heavy sync crypto/parsing in hooks causes pauses during assistant/tool flow.

**Why it happens**
- CLI patterns are copied into long-lived plugin runtime where blocking hurts interactivity.

**Consequences**
- Stutters, delayed responses, "frozen" feel after tool calls.

**Prevention (concrete)**
- Enforce async-only rule in plugin hot paths.
- Put expensive work behind debounce, queue, or worker boundaries.
- Add event-loop delay monitoring (`monitorEventLoopDelay`) in benchmark mode.

**Detection signals**
- Spikes in event-loop delay histogram during plugin events.
- `session.idle` or tool hooks correlate with latency cliffs.
- User reports "response done, then pause" behavior.

**Address in phase planning**
- **Phase 2 (Latency Attribution):** identify blocking call sites.
- **Phase 3 (Optimization Implementation):** mandatory async migration for critical paths.

---

### 4) Cache Correctness Regressions from Multi-Layer Caching

**What goes wrong**
- L1/L2 caches return stale data due to invalidation misses, key collisions, or scope mistakes.

**Why it happens**
- Performance work focuses on hit rate, not semantic correctness and invalidation guarantees.

**Consequences**
- Fast responses with wrong state; hardest class of bug to detect early.

**Prevention (concrete)**
- Define cache key contract: include scope (`cwd/worktree/phase/plan/version`) explicitly.
- Add bounded TTL + explicit invalidation on known writes.
- Build invariants tests: "same input+state => same output", "state mutation invalidates affected keys only".
- Track stale-read counters in profiling runs.

**Detection signals**
- Inconsistent outputs between raw mode and cached mode.
- "Fix only appears after restart" or "second run differs from first" reports.
- Sudden hit-rate jump with unexplained correctness bugs.

**Address in phase planning**
- **Phase 3:** cache changes implemented with invariant tests.
- **Phase 4 (Regression Safeguards):** correctness checks before speed checks pass.

---

### 5) Missing Performance Gates in CI/Verification

**What goes wrong**
- Gains are real once, then slowly erased by unrelated work.

**Why it happens**
- Functional tests exist, but no performance budgets as merge gates.

**Consequences**
- Repeated "re-optimization" milestones and unstable user experience.

**Prevention (concrete)**
- Add benchmark smoke suite in CI on stable hardware profile (or controlled runner class).
- Gate on regression thresholds (example): `>10% p95 regression blocks`, `5-10% warns`.
- Store rolling baseline artifacts (JSON/CSV) per branch and compare in PR.

**Detection signals**
- Performance regressions found weeks later by users.
- No trend line available for milestone comparisons.

**Address in phase planning**
- **Phase 4:** CI perf gates, reporting dashboards, and rollback criteria.

---

## High-Risk Pitfalls (Usually Missed Until Late)

### 6) Over-Instrumentation in Hot Paths

**What goes wrong:** too many timers/logs per call inflate runtime and I/O.

**Prevention**
- Sample (1:N) in production-like runs.
- Keep fine-grained tracing behind feature flags.
- Prefer aggregate counters for default path.

**Detection signals**
- Turning on profiler changes behavior more than code changes.
- CPU profile dominated by metrics/logging code.

**Phase placement**
- **Phase 2:** design instrumentation budget and sampling policy.

---

### 7) Startup-Only Wins, First-Use Regressions (Lazy Loading Misapplied)

**What goes wrong:** startup improves, but first command after startup is much slower.

**Prevention**
- Benchmark both `startup` and `first-hot-command` latency.
- Preload only critical small modules; lazy-load heavy optional paths.
- Use trigger-aware prefetch after `onStartupFinished`-style windows.

**Detection signals**
- "App opens faster, first action feels worse" feedback.
- p95 first-use latency climbs while startup metric improves.

**Phase placement**
- **Phase 3:** apply with dual-metric acceptance (`startup` + `first-use`).

---

### 8) Event Storms from Hooks/Watchers

**What goes wrong:** one user action causes multiple hook executions and repeated expensive operations.

**Prevention**
- Coalesce events by key + time window.
- Add idempotency tokens and cooldowns per handler.
- For file watchers, handle platform caveats and inode/rename behavior explicitly.

**Detection signals**
- Operation count per user action >1 unexpectedly.
- CPU usage spikes with minimal user interaction.

**Phase placement**
- **Phase 2:** observe event fan-out.
- **Phase 3:** implement debounce/coalescing/idempotency.

---

### 9) Tool Shadowing / Wrapper Overhead in Custom Tools

**What goes wrong:** custom tool names override built-ins or wrappers add expensive serialization/process overhead to every call.

**Prevention**
- Enforce `bgsd_` prefix for all custom tools.
- Use denylist checks for built-in names.
- Benchmark wrapper overhead separately (serialization + subprocess cost).

**Detection signals**
- Sudden latency increase across unrelated tool calls.
- Unexpected tool behavior after plugin load.

**Phase placement**
- **Phase 1:** naming and tool-boundary policy.
- **Phase 3:** overhead reduction for high-frequency tools.

---

### 10) Cross-Plugin Interaction Nondeterminism

**What goes wrong:** assumptions about hook order and untouched output objects break when other plugins are present.

**Prevention**
- Treat hook inputs/outputs as already-mutated state.
- Run compatibility matrix with common plugin combinations.
- Keep transformations minimal and explicit.

**Detection signals**
- Repro only in user setups with additional plugins.
- Inconsistent behavior between clean and real-world environments.

**Phase placement**
- **Phase 4:** compatibility soak tests before milestone sign-off.

---

## Phase Planning Matrix (Where Each Pitfall Must Be Handled)

| Planning Phase | Pitfalls to handle here | Required output |
|---|---|---|
| Phase 1: Baseline + Methodology | #1, #2, #9 | Benchmark spec, SLO budgets, tool naming/boundary contract |
| Phase 2: Profiling + Attribution | #3, #6, #8 | Hot-path attribution report, instrumentation budget, event fan-out map |
| Phase 3: Optimization Implementation | #3, #4, #7, #8, #9 | Code changes with dual metrics (startup + first-use) and cache invariants tests |
| Phase 4: Regression Safeguards + Rollout | #5, #10 (+verify #1-#9) | CI perf gates, compatibility matrix, rollback thresholds, trend dashboard |

---

## Practical Prevention Checklist (Use as Plan Exit Criteria)

- Every optimization PR includes before/after metrics for at least one canonical workload.
- Every benchmark report includes run count, warm/cold context, and variance.
- No sync blocking APIs in plugin hot paths unless explicitly justified and measured.
- Cache changes ship with invalidation contract tests.
- Event handlers have debounce/coalescing/idempotency where repeat firing is possible.
- CI blocks regressions beyond agreed thresholds.

---

## Sources

Primary/authoritative:
- Node.js `fs` docs (sync APIs block event loop; watch caveats): https://nodejs.org/api/fs.html
- Node.js `child_process` docs (sync process APIs block): https://nodejs.org/api/child_process.html
- Node.js `perf_hooks` docs (`performance.now`, `monitorEventLoopDelay`, observers): https://nodejs.org/api/perf_hooks.html
- OpenCode plugins docs (load order, hooks, events, compaction behavior): https://opencode.ai/docs/plugins/
- OpenCode custom tools docs (name collisions, context, tool surface): https://opencode.ai/docs/custom-tools/
- VS Code extension activation/performance guidance (`*` vs `onStartupFinished`, activation events): https://code.visualstudio.com/api/references/activation-events

Benchmark methodology:
- Hyperfine README/docs (warmup, prepare, variance-aware CLI benchmarking): https://github.com/sharkdp/hyperfine

Project context used:
- `.planning/PROJECT.md`
- `.planning/STATE.md`

---

*Roadmap implication:* do not treat performance as a single implementation phase. Split into **baseline -> attribution -> optimization -> regression-gating** or regressions are highly likely.
