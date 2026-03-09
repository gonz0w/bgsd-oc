# Feature Landscape: Performance Acceleration & Benchmarking (v9.1)

**Domain:** plugin benchmarking, latency attribution, responsiveness optimization, and regression prevention for bGSD plugin workflows.
**Researched:** 2026-03-09
**Milestone context:** Subsequent milestone after v9.0; existing cache/profiling foundations are already present.

## Scope Positioning

This milestone should prioritize measurable speed work over broad new capability work.

- **Primary outcome:** lower end-to-end latency for high-frequency flows.
- **Secondary outcome:** durable benchmark and regression guardrails so gains do not erode.
- **Explicit non-goal:** feature-surface expansion that adds overhead without measurable latency impact.

## Sources and Confidence

| Source | URL | Use in This Doc | Confidence |
|--------|-----|------------------|------------|
| OpenCode plugin docs (events, hooks, custom tools) | https://opencode.ai/docs/plugins/ | What can be instrumented and intercepted | HIGH |
| VS Code activation events reference | https://code.visualstudio.com/api/references/activation-events | Modern plugin startup/lazy activation patterns | HIGH |
| JetBrains Plugin SDK: PSI Performance | https://plugins.jetbrains.com/docs/intellij/psi-performance.html | Caching, repeated expensive call avoidance, load boundaries | HIGH |
| OpenTelemetry metrics supplementary guidelines | https://opentelemetry.io/docs/specs/otel/metrics/supplementary-guidelines/ | Cardinality/memory tradeoffs for telemetry design | HIGH |
| Existing project docs (`PROJECT.md`, `MILESTONES.md`) | local planning files | Dependency mapping to current bGSD capabilities | HIGH |

## Table Stakes (Must Ship in v9.1)

These are baseline expectations for a performance milestone and should be treated as required scope.

| Feature | Complexity | Depends On Existing Capability | Why It Is Table Stakes |
|---------|------------|-------------------------------|------------------------|
| **Canonical benchmark suite for top user journeys** (`init`, `plan`, `execute`, plugin tool paths) | M | v8.0 profiler instrumentation + baseline comparison tool | No performance claim is trustworthy without repeatable baselines and fixed scenarios. |
| **Latency budget definitions per flow** (p50/p95 targets and fail thresholds) | S | Existing command timing output + token estimation data | Prevents "faster in anecdotes, slower in aggregate" outcomes. |
| **Phase-level latency attribution breakdown** (CLI parse, file I/O, cache hit/miss, plugin hook overhead, subprocess/tool calls) | M | Existing cached reads + plugin hook system + debug logging | Enables targeted fixes instead of blind tuning. |
| **Cold vs warm run separation** in all benchmarks | S | SQLite L1/L2 cache behavior introduced in v8.0 | Current architecture is cache-sensitive; mixed metrics hide regressions. |
| **Performance regression gate in test workflow** (advisory first, block on mature thresholds) | M | Existing test gate and verification patterns | Locks in gains after milestone completion. |
| **Hot-path modernization pass** (replace avoidable subprocess/sync overhead in highest-frequency paths only) | L | v9.0 native tool architecture + namespace command routing | Most practical source of real responsiveness gains now that broad architecture exists. |
| **Benchmark fixture standardization** (small/medium/large `.planning/` projects) | M | Existing planning templates and parser suite | Prevents overfitting to a single repo shape. |

## Differentiators (High-Leverage, Not Strictly Required)

These are strong "modern plugin" signals that improve long-term advantage once table stakes are stable.

| Feature | Complexity | Depends On Existing Capability | Why It Differentiates |
|---------|------------|-------------------------------|-----------------------|
| **Competitive benchmark adapter** (run same workload profile against selected modern plugins/workflows) | L | New benchmark harness + existing workflow corpus | Converts "we are faster" from assumption into market-relative evidence. |
| **Auto-generated performance trend report per milestone** (delta vs last shipped baseline) | M | Existing milestone lifecycle docs + profiler output | Makes perf progress visible to roadmap and verification phases. |
| **Adaptive hook cost control** (defer expensive work to `session.idle`/post-response windows) | M | Event-driven sync added in v9.0 | Improves perceived responsiveness without dropping functionality. |
| **Profile-guided feature flags** for expensive optional behaviors | M | Existing config and guardrail infrastructure | Allows safe rollout and quick rollback of risky optimizations. |
| **Microbenchmark harness for parser/regex hotspots** | M | 309+ regex parsing footprint + node:test infrastructure | Catches local slowdowns before they impact end-to-end timings. |
| **Token-cost vs latency joined dashboard** | M | tokenx integration + command profiling data | Supports balanced optimization (speed without token blowup). |

## Anti-Features (Explicitly Out of Scope)

These are common performance-project traps that should be rejected in milestone planning.

| Anti-Feature | Why Not in v9.1 |
|--------------|-----------------|
| **"Async rewrite everything" initiative** | Project explicitly treats sync I/O as acceptable for CLI ergonomics; broad rewrites carry high risk and weak ROI for this milestone. |
| **Massive telemetry cardinality expansion** (per-file/per-line high-cardinality tags) | OTel guidance warns about memory/cardinality blowups; this can degrade performance while measuring it. |
| **Benchmarking every command equally** | Most commands are low-frequency; focus on top user journeys for meaningful wins. |
| **Cross-host synthetic benchmarks with no fixture control** | Produces noisy, non-actionable data; fixture and environment control is mandatory first. |
| **Large dependency adoption before proving hotspot impact** | Increases bundle size and startup risk; violates "selective modernization" goal. |
| **Premature background worker architecture** | Adds complexity and coordination cost before current bottlenecks are isolated. |
| **Perf work without regression gate integration** | Gains will drift back within 1-2 milestones. |

## Dependency Mapping to Current System

### Existing capabilities to leverage directly

| Existing Capability | Enables |
|---------------------|---------|
| v8.0 profiler instrumentation + baseline comparison | Benchmark suite, attribution, trend reporting |
| SQLite L1/L2 cache + Map fallback | Cold/warm profiling and cache ROI analysis |
| v9.0 native plugin hooks/tools | Hook overhead attribution and tool-path optimization |
| 766+ tests and pre-commit gates | Regression-gate integration |
| Namespace command routing + modular src split | Isolated hotspot optimization by domain |
| tokenx estimation | Token/latency tradeoff scoring |

### Net-new capabilities needed this milestone

| New Capability | Complexity | Consumed By |
|----------------|------------|-------------|
| Reproducible benchmark runner (`bench:*` commands or equivalent) | M | Table-stakes benchmark suite |
| Latency budget config format (per flow thresholds) | S | Regression gating and CI reporting |
| Scenario fixtures for `.planning/` project sizes | M | Cold/warm and scale testing |
| Attribution schema (segment names + timers) | M | Root-cause analysis and trend reports |

## Recommended MVP Feature Set (v9.1)

Ship this set first before any differentiators:

1. Canonical benchmark suite for top 6-8 flows.
2. Cold/warm separated metrics with p50/p95 reporting.
3. Latency attribution across CLI, hooks, cache, and tool calls.
4. 2-3 highest-impact hot-path optimizations proven by before/after benchmarks.
5. Advisory regression gate integrated into normal test workflow.

This MVP is sufficient to claim a real "performance acceleration" milestone without scope drift.

## Complexity Summary

| Bucket | Count | Notes |
|--------|-------|-------|
| Small (S) | 3 | Mostly definitions/configuration and reporting structure |
| Medium (M) | 10 | Core benchmark, attribution, and guardrail work |
| Large (L) | 2 | Competitive adapter and major hot-path modernization |

## Confidence Notes

- **HIGH confidence:** benchmark-first, lazy/deferred activation patterns, cache-aware profiling, and cardinality control principles.
- **MEDIUM confidence:** exact shape of competitive benchmark adapter due to variation across external plugin ecosystems.
- **LOW confidence:** none in this scoped recommendation.
