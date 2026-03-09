# Research Summary: v9.1 Performance Acceleration & Plugin Benchmarking

**Domain:** Performance acceleration for bGSD CLI + plugin workflows
**Researched:** 2026-03-09
**Overall confidence:** HIGH (stack/integration), MEDIUM-HIGH (optional OTEL path)

## Executive Summary

v9.1 should be run as a measurement-first milestone: establish reproducible benchmarks and budgets, attribute where latency is spent, optimize only proven hot paths, then enforce regression gates.

The strongest strategy is a three-layer performance model:
1. Always-on lightweight instrumentation (`perf_hooks`, low-overhead timers, structured tags).
2. Local-first collection and benchmark artifacts (`.planning/perf/` and `.planning/baselines/perf/`).
3. On-demand analysis and gating (`benchmark` + `perf-gate` workflows with p50/p95/p99 comparisons).

This keeps runtime overhead low for normal users while making optimization claims auditable and repeatable.

## Stack Additions (Recommended)

### Add now (devDependency)

| Package | Role in v9.1 | Why now |
|---|---|---|
| `tinybench@^6.0.0` | Deterministic microbench suite for parser/hotspot checks | Needed to catch local regressions before E2E impact |
| `0x@^6.0.0` | Flamegraph profiling for slow command diagnosis | Fast path-to-root-cause after regressions are found |
| `why-is-node-running@^3.2.2` | Diagnoses stuck benchmark/profiler runs | Reduces CI/local perf-debug time |

### Built-in capabilities to standardize

- Node profiling flags: `--cpu-prof`, `--heap-prof`, trace events.
- `perf_hooks` APIs: `performance.now`, `timerify`, `monitorEventLoopDelay`.
- Existing baseline tooling (`baseline.cjs`) refactored into reusable benchmark primitives.

### Optional/deferred stack

- OpenTelemetry export path (`@opentelemetry/*`) behind explicit opt-in (`BGSD_OTEL=1`), not on default runtime path.

### Engine alignment

- Raise declared engine to `node >=22.5` to match existing `node:sqlite` usage and avoid unsupported environments.

## Feature Table Stakes (Must Ship)

1. Canonical benchmark suite for top user journeys (`init`, `plan`, `execute`, plugin tool paths).
2. Cold vs warm run separation in all reports.
3. Latency budgets per flow (p50/p95 plus fail/warn thresholds).
4. Phase-level latency attribution (CLI parse, I/O, cache, hooks, tool wrappers/subprocesses).
5. Regression gate integrated into normal verification workflow (advisory first, enforce later).
6. Fixture standardization for small/medium/large `.planning/` project shapes.
7. Hot-path modernization focused only on the top measured bottlenecks.

## Architecture Approach

Use an integration-first architecture that unifies existing profiler/hook timing work rather than introducing a separate telemetry system.

### Target design

- **Instrumentation layer (always-on, ultra-light):** emit normalized timing events from CLI and plugin hot paths.
- **Collection layer (local-first):** append-only NDJSON event sink with bounded size + rotation.
- **Analysis layer (on-demand):** rollups (`p50/p95/p99`, cache efficiency, error rates), benchmark suites, perf-gate comparisons.

### Core components to add

- `references/perf-event-schema-v1.json`
- `src/lib/telemetry.js`
- `src/plugin/telemetry.js`
- `src/lib/perf-sink.js`
- `src/lib/perf-rollup.js`
- `src/commands/benchmark.js`
- `src/commands/perf-gate.js`

### Rollout model

1. Shadow emit (`BGSD_PERF_TELEMETRY=1`) with non-blocking writes.
2. Benchmark + compare mode for maintainers.
3. Advisory CI gates.
4. Selective enforced gates on critical suites with emergency escape hatch.

## Top Pitfalls to Avoid

1. Optimizing before baseline/SLO contract exists.
2. Micro-only or warm-only benchmarking that misses real user latency.
3. Sync APIs in plugin hot paths blocking the event loop.
4. Over-instrumentation turning telemetry overhead into the bottleneck.
5. Multi-layer cache invalidation correctness regressions.
6. Missing CI performance gates causing gains to decay within 1-2 phases.
7. Event storms from hooks/watchers without debounce/coalescing.
8. Tool shadowing/wrapper overhead from poorly bounded custom tools.

## Recommended Phase Strategy for Milestone v9.1

### Phase 1: Baseline + Methodology Contract

- Define canonical workloads, fixture matrix, and flow budgets.
- Implement benchmark lane split (macro/E2E + micro).
- Establish tool naming/boundary policy and report format.
- **Exit criteria:** repeatable before/after reports with cold+warm context and variance.

### Phase 2: Profiling + Attribution

- Ship unified event schema and emitters (CLI + plugin).
- Capture command/hook/cache/tool attribution and event-loop delay.
- Set instrumentation sampling policy to cap measurement overhead.
- **Exit criteria:** top regressions ranked by p95 and absolute ms with owning module tags.

### Phase 3: Targeted Optimizations

- Implement 2-3 highest-impact fixes only (proven by attribution).
- Remove sync blocking from critical plugin paths.
- Apply cache safety/invalidation contract tests with each cache change.
- **Exit criteria:** measurable p95/p99 improvements and no correctness regressions.

### Phase 4: Regression Safeguards + Rollout

- Add advisory then enforced perf-gate thresholds in CI.
- Add compatibility soak checks for multi-plugin environments.
- Publish milestone trend snapshot and rollback thresholds.
- **Exit criteria:** gate active for critical suites and stable trend over multiple runs.

## Milestone Acceptance Targets (Suggested)

- >=15% p95 latency improvement on top 3 critical command/tool flows, or
- >=25% p99 tail reduction on high-frequency plugin hooks, or
- clear triage-time reduction via benchmark + profiling workflow evidence.

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| Stack additions (`tinybench`, `0x`, Node profiling APIs) | HIGH | Versions and compatibility verified in research |
| Unified architecture and rollout sequencing | HIGH | Matches existing plugin/CLI integration points |
| Pitfall model and prevention controls | HIGH | Strong agreement across Node/plugin benchmarking guidance |
| Optional OTEL export path | MEDIUM-HIGH | Useful but environment-dependent and not needed by default |

---
*Last updated: 2026-03-09*
