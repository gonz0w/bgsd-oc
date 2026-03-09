# Architecture Research: v9.1 Performance Acceleration Integration

**Research mode:** Ecosystem + integration architecture  
**Scope:** Benchmarking, telemetry, and optimization integration into existing bGSD plugin + CLI  
**Date:** 2026-03-09  
**Overall confidence:** HIGH (repo + OpenCode/Node official docs), MEDIUM (optional OpenTelemetry export)

## Executive Recommendation

Use a **three-layer performance architecture** that keeps hot-path overhead near-zero:

1. **Instrumentation layer (always-on, ultra-light):** in-process timing around CLI commands, plugin hooks, cache ops, parser calls.
2. **Collection layer (local-first):** append-only NDJSON events + rollup snapshots under `.planning/perf/`.
3. **Analysis layer (on-demand):** benchmark runner and regression gate commands that read collected artifacts and enforce budgets.

Do **not** make OTLP/OpenTelemetry the default runtime path for this project. Keep it as an optional export adapter behind a flag, because the core workload is short-lived CLI invocations plus latency-sensitive plugin hooks.

---

## Current Integration Points (What Already Exists)

From current codebase:

- CLI profiling exists in `src/lib/profiler.js` and `src/router.js` via `BGSD_PROFILE=1` and baseline JSON write.
- CLI cache instrumentation surfaces hit/miss stats in `src/lib/cache.js`.
- Plugin hook timing exists implicitly via `safeHook` slow-warning logic in `src/plugin/safe-hook.js`.
- Build already produces artifacts in `.planning/baselines/` via `build.cjs` and `baseline.cjs`.
- Plugin event surface is rich (`session.*`, `tool.execute.*`, `file.watcher.updated`, `command.execute.before`) in `src/plugin/index.js`.

Implication: this milestone should be an **architectural unification**, not a greenfield telemetry system.

---

## Target Integration Map

```text
                           +-------------------------------+
                           |   bgsd tools / plugin hooks   |
                           +---------------+---------------+
                                           |
                           (light timers + tags + counters)
                                           |
                +--------------------------+--------------------------+
                |                                                     |
     +----------v----------+                              +-----------v-----------+
     | CLI Perf Emitter    |                              | Plugin Perf Emitter   |
     | src/lib/telemetry.js|                              | src/plugin/telemetry.js|
     +----------+----------+                              +-----------+-----------+
                |                                                     |
                +--------------------------+--------------------------+
                                           |
                            canonical event schema (v1)
                                           |
                             +-------------v-------------+
                             | local perf sink            |
                             | .planning/perf/events.ndjson|
                             +-------------+-------------+
                                           |
                          +----------------+----------------+
                          |                                 |
             +------------v-----------+          +----------v-----------+
             | rollup/aggregation     |          | benchmark harness    |
             | perf snapshots + p95   |          | reproducible suites   |
             +------------+-----------+          +----------+-----------+
                          |                                 |
                          +----------------+----------------+
                                           |
                               +-----------v------------+
                               | regression gate command |
                               | fail/warn on budgets    |
                               +------------------------+
```

---

## New Components (Explicit)

| Component | Path | Purpose | Notes |
|---|---|---|---|
| Perf event contract | `references/perf-event-schema-v1.json` | Single schema for CLI+plugin telemetry records | Stabilizes downstream analysis |
| CLI telemetry emitter | `src/lib/telemetry.js` | Zero-dependency event emit + buffered flush | Reuses `node:perf_hooks` timings |
| Plugin telemetry emitter | `src/plugin/telemetry.js` | Hook/tool latency events + correlation IDs | Integrates with `safeHook` |
| Local perf sink | `src/lib/perf-sink.js` | NDJSON append + rotation + bounded file size | Writes `.planning/perf/events.ndjson` |
| Rollup engine | `src/lib/perf-rollup.js` | Compute p50/p95/p99, error rates, cache efficiency by key | Generates `.planning/perf/snapshots/*.json` |
| Benchmark harness | `src/commands/benchmark.js` | Scenario suites: cold CLI, warm CLI, plugin hook latency | Use tinybench for micro + existing macro scripts |
| Performance gate command | `src/commands/perf-gate.js` | Compare current snapshot vs baseline budgets | CI-friendly JSON output |
| Plugin perf tool | `src/plugin/tools/bgsd-perf.js` | Read-only perf summary for agent consumption | No mutation |
| Perf config block | `.planning/config.json` (`performance` section) | Feature flags, sampling rates, budgets | Backward-compatible defaults |

---

## Modified Components (Explicit)

| Component | Change | Integration point |
|---|---|---|
| `src/lib/profiler.js` | Convert from raw timing array to emitter-backed spans; keep old API surface | Existing `startTimer/endTimer/writeBaseline` callers remain valid |
| `src/router.js` | Emit command lifecycle events (`command.start`, `command.end`, `command.error`) | Namespace, subcommand, raw/prettified mode tags |
| `src/lib/cache.js` | Emit cache events (`cache.hit/miss/invalidate`) and duration for DB operations | Adds latency attribution to cache backend selection |
| `src/plugin/safe-hook.js` | Emit hook timing + failure counters via plugin telemetry module | Replace WARN-only slow detection with structured events |
| `src/plugin/index.js` | Wire telemetry emitter into hooks and tools; add `bgsd_perf` tool registration | Keeps existing hook behavior unchanged |
| `src/plugin/logger.js` | Add structured perf log channel (optional) and correlation-id linking | Avoid duplicate writes when telemetry enabled |
| `build.cjs` | Add perf artifact validation + optional benchmark stage (`BGSD_BENCH_ON_BUILD=1`) | Prevent accidental perf schema drift |
| `tests/plugin.test.cjs` | Assert telemetry wiring does not break existing exports and tool map | Regression safety |
| `tests/*.test.cjs` | Add perf schema, rollup, and gate tests | Budget logic correctness |

---

## Data Flow Changes

### 1) Runtime Telemetry Flow

1. CLI or plugin operation starts.
2. Timing source captures start (`performance.now()` from `node:perf_hooks`, stable API).
3. Emitter builds normalized event:
   - `ts`, `runtime` (`cli|plugin`), `name`, `duration_ms`, `status`, `tags`, `corr_id`.
4. Sink batches and appends NDJSON (size-capped, rotated).
5. Rollup job compacts raw events into snapshots keyed by:
   - command/hook/tool name, namespace, cache backend, phase.

### 2) Benchmark Flow

1. `benchmark run --suite <name>` executes reproducible scenarios.
2. Microbench (tinybench) validates hot utility regressions.
3. Macrobench executes real commands/hooks over fixture project(s).
4. Baseline and candidate snapshots saved under `.planning/perf/snapshots/`.
5. `perf-gate` compares deltas and exits pass/warn/fail.

### 3) Optimization Loop

1. Identify top regressions by p95 and absolute milliseconds.
2. Link to owning module via tags (e.g., `src/lib/cache.js`).
3. Implement targeted fix.
4. Re-run suite + gate.
5. Persist decision note to planning docs.

---

## Build Order (Dependency-Aware)

### Wave 1: Contract + Non-invasive Instrumentation Foundation

1. Add telemetry schema and sink (`perf-event-schema-v1.json`, `perf-sink.js`).
2. Add CLI emitter (`src/lib/telemetry.js`) with **no-op default**.
3. Adapt `src/lib/profiler.js` to dual-write old baseline format + new event format.

Dependency reason: everything else depends on a stable event contract and low-risk emitter.

### Wave 2: CLI Integration and Aggregation

4. Wire router + cache events (`src/router.js`, `src/lib/cache.js`).
5. Add rollup engine and snapshot format.
6. Add command `util:benchmark` and `util:perf-gate` read paths.

Dependency reason: benchmark/gate require telemetry data and rollups.

### Wave 3: Plugin Integration

7. Add `src/plugin/telemetry.js`.
8. Wire `safeHook` + plugin hooks/tools in `src/plugin/index.js`.
9. Add plugin read-only perf tool `bgsd_perf`.

Dependency reason: plugin should emit to already-stable contract from Wave 1.

### Wave 4: Regression Enforcement + Developer UX

10. Add perf budgets in config and defaults parser merge.
11. Add CI-safe perf gate output (`json`, `tty`) and threshold policies.
12. Add docs + migration notes + troubleshooting.

Dependency reason: enforce only after signal quality is validated.

---

## Migration-Safe Rollout Strategy

Use controlled flags and shadow mode to avoid breaking current workflows.

### Phase A: Shadow Emit (Default)

- `BGSD_PERF_TELEMETRY=1` enables emitters.
- No command behavior changes; telemetry write failures are non-blocking.
- Existing `BGSD_PROFILE=1` behavior remains unchanged.

### Phase B: Read + Compare

- Enable benchmark and rollup commands for maintainers.
- Publish baseline snapshots from current main branch.
- Validate schema stability and event volume.

### Phase C: Advisory Gates

- `util:perf-gate` returns WARN status on regressions above thresholds.
- CI reports regressions but does not fail builds yet.

### Phase D: Enforced Gates (Selective)

- Block only for critical suites (`init`, `state`, plugin hook p95) and only if regression exceeds configured budget and min absolute ms.
- Keep escape hatch: `BGSD_PERF_GATE=off` for emergency releases.

### Rollback Plan

- One-flag disable (`BGSD_PERF_TELEMETRY=0`) returns system to pre-v9.1 behavior.
- Event files can be ignored; no data migration required.
- No schema dependency in core runtime path.

---

## Dependency and Library Decisions

### Recommended

- **Use Node `perf_hooks` as primary instrumentation API** (stable in Node docs).
- **Use tinybench for deterministic microbench tasks** (dev-only).
- **Keep current local file telemetry as primary storage** (fits single-file deploy and offline workflows).

### Optional (Not default)

- **OpenTelemetry export adapter** for external dashboards, disabled by default.
  - Reason: useful for advanced org observability, but adds startup/config complexity for CLI-first workloads.
  - If enabled, only export rollups or sampled events, not every hook call.

### Not Recommended for default path

- Full always-on OTLP SDK boot in CLI hot path.
- Replacing local perf storage with remote-only telemetry.
- Plugin-time network exporters in synchronous hooks.

---

## Critical Integration Rules

- Keep plugin and CLI perf APIs **append-only and backward-compatible**.
- Never let telemetry writes fail user commands/hooks.
- Enforce bounded storage (`max file size`, rotation, snapshot pruning).
- Tag every event with runtime origin (`cli` vs `plugin`) to avoid attribution confusion.
- Keep old baseline outputs during transition (`.planning/baselines/*`) until perf-gate is fully adopted.

---

## Confidence and Gaps

### Confidence by section

- Integration points in current code: **HIGH**
- Hook/tool architecture and event surface: **HIGH**
- Build/deploy compatibility assumptions: **HIGH**
- Optional OTEL export recommendation: **MEDIUM** (depends on operational needs and collector presence)

### What might be missing

- Exact benchmark scenarios for competitor parity are not yet codified (needs milestone-specific suite definition).
- CI runtime budget impact of full benchmark suite needs a measured cap (likely split fast vs full).

---

## Sources

1. Project codebase (`src/router.js`, `src/lib/profiler.js`, `src/lib/cache.js`, `src/plugin/index.js`, `src/plugin/safe-hook.js`, `build.cjs`, `baseline.cjs`) — local authoritative architecture.
2. OpenCode plugin docs: https://opencode.ai/docs/plugins/ (hooks, load order, custom tools, event model).
3. Context7 OpenCode Plugins: `/websites/opencode_ai_plugins` (hook list, custom tool patterns).
4. Node perf hooks docs: https://nodejs.org/api/perf_hooks.html (stable performance APIs).
5. Node sqlite docs: https://nodejs.org/api/sqlite.html (`node:sqlite` status and behavior).
6. Context7 Tinybench: `/tinylibs/tinybench` (benchmark harness patterns).
7. Context7 OpenTelemetry JS: `/open-telemetry/opentelemetry-js` (optional exporter architecture).
