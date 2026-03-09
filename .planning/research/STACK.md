# Stack Research: Performance Acceleration for bGSD Plugin (v9.1)

> Research date: 2026-03-09  
> Scope: stack additions/changes for profiling, tracing, benchmark harnesses, and safe dependency adoption  
> Milestone context: subsequent milestone after v9.0 embedded plugin architecture  
> Focus: only NEW performance capabilities (not re-documenting existing stack)

---

## Executive Recommendation

Use a **three-layer performance stack**:

1. **Always-on, zero-dependency instrumentation** in existing code paths (`perf_hooks`, trace events, hook timing histograms).
2. **Repeatable benchmark harness** for regressions and before/after proof (`tinybench` for microbench + command-level E2E harness).
3. **On-demand deep diagnostics** (`0x` flamegraphs and optional OpenTelemetry spans when cross-plugin comparisons require distributed traces).

This matches current architecture constraints:
- Keep `bin/bgsd-tools.cjs` single-file deploy intact.
- Keep runtime overhead minimal for normal users.
- Add most tooling as **devDependencies only**.

---

## Current Architecture Constraints That Matter

- CLI is bundled to one file via esbuild (`build.cjs`) and already includes baseline capture (`baseline.cjs`).
- Plugin hot paths are in `src/plugin/index.js` and wrapped via `safeHook` (`src/plugin/safe-hook.js`).
- Existing plugin is event-driven (`event`, `tool.execute.after`, `command.execute.before`, `experimental.*` hooks).
- Project docs and code indicate practical Node baseline is already Node 22.5+ because of `node:sqlite` usage (even though `package.json` still says `>=18`).

Implication: performance dependencies that require Node >=20 are acceptable **if** engines policy is aligned as part of this milestone.

---

## Recommended Stack Additions / Changes

## 1) Benchmark Harness

### Add: `tinybench@6.0.0` (devDependency)

- Why: purpose-built microbenchmark library with simple API and table output, good fit for parser/hot-function benchmarks.
- Use for: `parseState`, `parseRoadmap`, `parsePlan`, `buildSystemPrompt`, `enrichCommand`, and cache hit/miss scenarios.
- Integration points:
  - New folder: `benchmarks/micro/`
  - New scripts:
    - `benchmark:micro`: run tinybench suites
    - `benchmark:compare`: compare current results vs `.planning/baselines/`
- Engine note: tinybench requires Node >=20.

Confidence: HIGH (Context7 docs + npm metadata).

### Keep and upgrade: command-level E2E benchmark harness (custom)

- Continue using custom harness style from `baseline.cjs`, but split into stable benchmark modules:
  - `benchmarks/e2e/cli-latency.cjs`
  - `benchmarks/e2e/plugin-hook-latency.cjs`
  - `benchmarks/e2e/io-footprint.cjs`
- Add percentile reporting (`p50/p95/p99`) and cold vs warm runs.
- Store outputs under `.planning/baselines/perf/` as JSON snapshots.

Confidence: HIGH (repo-tailored recommendation).

---

## 2) Profiling

### Add: `0x@6.0.0` (devDependency, optional in CI)

- Why: single-command Node flamegraph workflow, modern release, practical for pinpointing CPU hot paths in CLI commands.
- Use for: slow commands discovered by benchmark harness (for example `init:*`, `plan:*`, `verify:*`, plugin event handling helpers).
- Integration points:
  - Script: `profile:flame` -> `0x --output-dir .planning/baselines/flame node bin/bgsd-tools.cjs <command>`
  - Keep outputs out of repo history by default (`.gitignore` if needed).
- Important: run only on representative scenarios, not every PR.

Confidence: HIGH (official project README + npm version check).

### Add: Node built-in CPU/heap profiling scripts (no dependency)

- Use Node CLI flags:
  - `--cpu-prof`, `--cpu-prof-dir`, `--cpu-prof-name`
  - `--heap-prof`, `--heap-prof-dir`, `--heap-prof-name`
  - `--trace-event-categories`, `--trace-event-file-pattern`
- Integration points:
  - `scripts/profile-cpu.cjs`
  - `scripts/profile-heap.cjs`
  - `scripts/profile-trace-events.cjs`
- These should target same scenarios used in benchmarks for comparability.

Confidence: HIGH (Node CLI docs + Node tracing docs).

---

## 3) Tracing

### Default: built-in tracing first (`perf_hooks` + trace events)

- Add lightweight timing spans around existing hook wrappers and parser boundaries:
  - `src/plugin/safe-hook.js` (already central timing point)
  - parser modules under `src/plugin/parsers/`
  - command enrich path (`src/plugin/command-enricher.js`)
- Use `perf_hooks.timerify` and `monitorEventLoopDelay` for low-overhead observability in benchmark mode.
- Emit structured timing JSON only when `BGSD_PROFILE=1` (or similar) to avoid normal-runtime overhead.

Confidence: HIGH (Node perf_hooks docs).

### Optional advanced: OpenTelemetry packages (deferred default)

If cross-plugin benchmark infrastructure needs vendor-neutral traces:

- `@opentelemetry/api@1.9.0`
- `@opentelemetry/sdk-trace-node@2.6.0`
- `@opentelemetry/exporter-trace-otlp-http@0.213.0`

Use only behind explicit opt-in env flag (for example `BGSD_OTEL=1`) and in benchmark runs, not default user flows.

Confidence: MEDIUM-HIGH (Context7 docs + npm versions; version families are intentionally mixed in OTEL ecosystem).

---

## 4) Debugging Stuck Processes During Perf Runs

### Add: `why-is-node-running@3.2.2` (devDependency)

- Why: quickly identify dangling handles/timers keeping benchmark runs alive.
- Use for: flaky benchmark/profiler jobs, plugin watcher lifecycle validation.
- Integration:
  - optional preloaded debug mode: `node --import why-is-node-running/include ...`
  - only for local diagnostics and CI failure triage.
- Engine note: requires Node >=20.11.

Confidence: HIGH (official README + npm metadata).

---

## Proposed `package.json` Changes (Milestone-Scoped)

### Dependencies to add now

```json
{
  "devDependencies": {
    "tinybench": "^6.0.0",
    "0x": "^6.0.0",
    "why-is-node-running": "^3.2.2"
  }
}
```

### Dependencies to keep optional/deferred

```json
{
  "devDependencies": {
    "@opentelemetry/api": "^1.9.0",
    "@opentelemetry/sdk-trace-node": "^2.6.0",
    "@opentelemetry/exporter-trace-otlp-http": "^0.213.0"
  }
}
```

### Engine policy change recommended

```json
{
  "engines": {
    "node": ">=22.5"
  }
}
```

Rationale: aligns declared engine with already-shipped `node:sqlite` behavior and avoids accidental use on unsupported runtimes.

---

## Integration Plan by Existing File

- `package.json`
  - Add benchmark/profile scripts and devDependencies above.
  - Align `engines.node` to `>=22.5`.

- `baseline.cjs`
  - Keep as quick baseline entrypoint.
  - Refactor shared measurement primitives into `benchmarks/lib/metrics.cjs` to avoid drift.

- `src/plugin/safe-hook.js`
  - Extend slow-hook logging to include histogram buckets and optional trace IDs when profiling mode is enabled.

- `src/plugin/index.js`
  - Add profiling mode toggles to event + tool hook paths for latency attribution without changing behavior.

- `.planning/baselines/`
  - Add stable schema for benchmark/profiler artifacts (`perf-summary.json`, `cpu/*.cpuprofile`, `trace/*.json`).

---

## What NOT to Add (Important)

1. `clinic` (Clinic.js) as primary profiler.
   - Reason: project states it is not actively maintained and may be inaccurate on newer Node internals.

2. Heavy always-on APM agents in runtime plugin path.
   - Reason: would distort the exact latency you're trying to measure and risk regressions in interactive workflows.

3. Runtime dependencies for benchmarking.
   - Reason: all benchmarking/profiling libs should remain dev-only and never enter bundled CLI output.

4. New database/cache layers for benchmarking data.
   - Reason: JSON artifacts in `.planning/baselines/` are sufficient and preserve current architecture simplicity.

---

## Safe Dependency Adoption Guidance

Use this gate for each new perf dependency:

1. **Scope gate**: must be devDependency unless it directly improves production path.
2. **Engine gate**: must support declared Node engine (or trigger explicit engine policy update).
3. **Bundle gate**: verify `bin/bgsd-tools.cjs` and `plugin.js` size deltas remain within budgets.
4. **Fallback gate**: profiling features must degrade cleanly when tool is absent.
5. **Proof gate**: keep dependency only if benchmark deltas are material and repeatable.

Suggested acceptance thresholds for this milestone:
- >=15% p95 latency improvement on top 3 user-critical commands, or
- >=25% reduction in plugin hook tail latency (`p99`) for high-frequency hooks, or
- clear developer-time savings for regression triage (documented in phase summary).

---

## Install Commands (Implementation Ready)

```bash
npm install -D tinybench@^6.0.0 0x@^6.0.0 why-is-node-running@^3.2.2
```

Optional tracing stack:

```bash
npm install -D @opentelemetry/api@^1.9.0 @opentelemetry/sdk-trace-node@^2.6.0 @opentelemetry/exporter-trace-otlp-http@^0.213.0
```

---

## Confidence Assessment

- Benchmark/profiler package versions: HIGH (npm registry via `npm view` on 2026-03-09).
- Node profiling/tracing capabilities: HIGH (official Node docs + Context7 Node docs).
- OpenTelemetry package recommendation: MEDIUM-HIGH (official docs + Context7; OTEL package versioning remains multi-track by design).
- "Do not add Clinic.js" guidance: HIGH (official repo README explicitly states not actively maintained).

---

## Sources

- Node CLI docs (profiling and trace flags): https://nodejs.org/api/cli.html
- Node tracing docs: https://nodejs.org/api/tracing.html
- Node perf hooks docs: https://nodejs.org/api/perf_hooks.html
- Tinybench docs: https://github.com/tinylibs/tinybench
- 0x docs: https://github.com/davidmarkclements/0x
- why-is-node-running docs: https://github.com/mafintosh/why-is-node-running
- OpenTelemetry JS docs: https://github.com/open-telemetry/opentelemetry-js
- OpenTelemetry SDK Node docs (Context7/official): https://github.com/open-telemetry/opentelemetry-js/tree/main/experimental/packages/opentelemetry-sdk-node
- Clinic.js status note: https://github.com/clinicjs/node-clinic

Version checks executed in this repo environment (2026-03-09):
- `tinybench` 6.0.0
- `0x` 6.0.0
- `why-is-node-running` 3.2.2
- `@opentelemetry/api` 1.9.0
- `@opentelemetry/sdk-trace-node` 2.6.0
- `@opentelemetry/exporter-trace-otlp-http` 0.213.0
- `@opencode-ai/plugin` 1.2.24
