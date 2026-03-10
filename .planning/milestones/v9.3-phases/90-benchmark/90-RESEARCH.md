# Phase 90: Benchmark - Research

**Researched:** 2026-03-10
**Domain:** Plugin benchmarking, performance measurement, cross-plugin comparison
**Confidence:** HIGH

## Summary

Phase 90 builds a plugin benchmark adapter for cross-plugin comparison and captures baseline metrics for v9.3. The existing codebase already has substantial benchmark infrastructure in `src/lib/cli-tools/bun-runtime.js` that measures startup time, file I/O, nested traversal, and HTTP server performance. This phase extends that infrastructure to create a cross-plugin comparison framework with the following characteristics:

- **Table output by default** with formatted columns for human readability
- **Full metrics via --verbose** flag showing detailed performance data
- **Build-time feature flag** to compile with or without benchmarks (lean production builds)
- **Single run execution** reporting cold start AND warm cache results
- **Undocumented subcommand** `/bgsd-measure` hidden from production users

The existing `benchmarkStartup`, `benchmarkFileIO`, `benchmarkNested`, and `benchmarkHTTPServer` functions provide a solid foundation that can be extended to measure plugin-specific operations.

**Plan status:** 90-01-PLAN.md exists with 4 tasks ready for execution.

**Primary recommendation:** Extend the existing `bun-runtime.js` benchmark infrastructure to create a dedicated `plugin-benchmark.js` module that measures plugin load time, command execution, context loading, and memory usage. Use build-time feature flags to control inclusion in production builds.

---

## User Constraints

(From 90-CONTEXT.md - these are LOCKED and must be honored by the planner)

| Constraint | Detail |
|------------|--------|
| Output format | Table format by default (human-readable, formatted columns) |
| Verbose mode | Full metrics shown on demand with `--verbose` flag |
| No JSON flag | Table only, keep it simple |
| Metrics | All measured: startup time, command execution, memory usage, context load time |
| Feature flag | Build-time feature flag (compile with/without benchmarks) |
| Execution | Single run execution (one execution, report that result) |
| Cold/Warm | Report both cold start and warm cache results |
| CLI name | Undocumented subcommand: `/bgsd-measure` |
| Documentation | Behind a feature flag (not visible in production) |

---

## Standard Stack

### Core

| Library/Pattern | Version | Purpose | Why Standard |
|-----------------|---------|---------|--------------|
| Node.js `process.hrtime.bigint()` | Built-in | High-resolution timing | No deps, nanosecond precision |
| Node.js `process.memoryUsage()` | Built-in | Memory profiling | Built-in, no extra deps |
| `execFileSync` with array args | Built-in | Subprocess timing | Shell injection safe |
| Table output (custom) | Custom | Formatted columns | No CLI table deps |

### Supporting

| Library/Pattern | Version | Purpose | When to Use |
|----------------|---------|---------|-------------|
| Session cache (Map) | Built-in | Cache benchmark results | Avoid re-running same benchmarks |
| Config persistence | `.planning/config.json` | Store baseline metrics | Persist across sessions |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom table formatting | `cli-table3` or `chalk` | Adds dependency, more complex |
| JSON output | Add `--json` flag | Explicitly rejected - keep simple |
| Multiple runs averaging | Single run | Decision: single run execution |
| External benchmarking tool | Custom implementation | Full control, no external deps |

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   └── cli-tools/
│       ├── bun-runtime.js      # EXISTING - runtime benchmarks
│       └── plugin-benchmark.js # NEW - plugin benchmarks
├── commands/
│   ├── runtime.js              # EXISTING - runtime benchmark command
│   └── measure.js              # NEW - /bgsd-measure command
```

### Pattern 1: Extend Existing Benchmark Infrastructure

The existing `bun-runtime.js` pattern should be replicated:

1. **Timing functions** using `Date.now()` or `process.hrtime.bigint()`
2. **Multiple run loops** with array collection
3. **Average calculation** with parseFloat(toFixed(2))
4. **Cleanup** of temporary files/scripts
5. **Result object** with structured `{ value, runs, metadata }`

### Pattern 2: Build-Time Feature Flag

```javascript
// At top of file or in build config
#ifdef INCLUDE_BENCHMARKS
module.exports = { benchmarkPlugin, measureStartup, ... };
#else
module.exports = { /* empty or minimal exports */ };
#endif
```

The build process (esbuild) can use `define` option to set `INCLUDE_BENCHMARKS` based on build target.

### Anti-Patterns to Avoid

- **Multiple execution averaging** - Decision is single run
- **JSON output** - Explicitly rejected
- **External dependencies** - Zero-dependency CLI principle
- **Shell execution** - Use `execFileSync` with array args

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Table formatting | Custom table lib | Simple string padding | Zero deps, adequate |
| High-res timing | `performance.now()` polyfill | `process.hrtime.bigint()` | Built-in, nanosecond |
| Memory measurement | External profiler | `process.memoryUsage()` | Built-in heap stats |
| Subprocess timing | shell-based timing | `execFileSync` with timing | Accurate, safe |

---

## Common Pitfalls

### Pitfall 1: Warm Cache Contamination
**What goes wrong:** Benchmark measures warm cache performance thinking it's cold start.
**Why it happens:** Node.js/module cache persists across runs.
**How to avoid:** Clear require cache or spawn fresh subprocess for each run.
**Warning signs:** Second run significantly faster than first.

### Pitfall 2: GC Interference
**What goes wrong:** Garbage collection runs during measurement, skewing results.
**Why it happens:** V8 GC is non-deterministic.
**How to avoid:** Force GC before measurement if possible, or note GC interference in metadata.
**Warning signs:** Inconsistent memory measurements.

### Pitfall 3: System Noise
**What goes wrong:** Background processes skew CPU/timing measurements.
**Why it happens:** Shared development machine.
**How to avoid:** Run multiple iterations, report variance, note system load.
**Warning signs:** High variance between runs.

### Pitfall 4: Feature Flag Complexity
**What goes wrong:** Build-time flags create code paths that never run in production.
**Why it happens:** Untested code paths in production builds.
**How to avoid:** Ensure both flag states are tested; consider runtime flag as alternative.
**Warning signs:** Benchmarks pass in dev but fail in production.

---

## Code Examples

### Example 1: High-Resolution Timing
```javascript
function measureStartup(scriptPath) {
  const start = process.hrtime.bigint();
  execFileSync('node', [scriptPath], { stdio: 'pipe' });
  const elapsed = Number(process.hrtime.bigint() - start) / 1e6; // ms
  return parseFloat(elapsed.toFixed(2));
}
```

### Example 2: Memory Measurement
```javascript
function measureMemory() {
  const mem = process.memoryUsage();
  return {
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    rss: Math.round(mem.rss / 1024 / 1024),
    external: Math.round(mem.external / 1024 / 1024)
  };
}
```

### Example 3: Table Output
```javascript
function formatTable(headers, rows) {
  const colWidths = headers.map((h, i) => 
    Math.max(h.length, ...rows.map(r => String(r[i]).length))
  );
  const headerRow = headers.map((h, i) => h.padEnd(colWidths[i])).join(' | ');
  const separator = colWidths.map(w => '-'.repeat(w)).join('-+-');
  const dataRows = rows.map(row => 
    row.map((v, i) => String(v).padEnd(colWidths[i])).join(' | ')
  );
  return [headerRow, separator, ...dataRows].join('\n');
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-----------------|--------------|--------|
| Manual timing with `Date.now()` | `process.hrtime.bigint()` | Prior work | Nanosecond precision |
| Shell-based subprocess timing | `execFileSync` with timing | Prior work | More accurate, safer |
| Single workload benchmark | Multi-workload (file I/O, nested, HTTP) | Phase 89 | Realistic performance data |
| No feature flags | Build-time flag planning | Phase 90 (this) | Lean production builds |

---

## Open Questions

1. **How to measure "context load time" specifically?** - The plugin loads multiple parsers (state, roadmap, config, project, intent). Should we measure each parser individually or total context build time?

2. **Cross-plugin comparison framework details:** What plugins are we comparing against? Is this for comparing bGSD to other OpenCode plugins, or comparing bGSD versions?

3. **Where to store baseline metrics?** `.planning/config.json` or a new `.planning/benchmarks/` directory?

4. **Should the benchmark module be in the bundled output?** Decision: build-time feature flag controls this.

## Implementation Notes

**Plan already created:** 90-01-PLAN.md exists with 4 tasks:
- Task 1: Create plugin-benchmark.js module
- Task 2: Create /bgsd-measure command
- Task 3: Build-time feature flag
- Task 4: Capture baseline metrics

**Existing infrastructure confirmed:**
- `benchmarkStartup()` function exists at line 1315 in bin/bgsd-tools.cjs
- Uses `process.hrtime.bigint()` for high-resolution timing
- Uses `execFileSync` with array args for subprocess timing
- Multiple workload types already implemented (file I/O, nested, HTTP)

**Verification approach:**
- Build-time feature flag: Use esbuild `define` option
- Cold/Warm: Measure with cleared module cache vs cached modules
- Context load: Time loading of STATE.md, ROADMAP.md, REQUIREMENTS.md, PROJECT.md

---

## Sources

### Primary (HIGH confidence)

- Node.js built-in APIs: `process.hrtime.bigint()`, `process.memoryUsage()`, `child_process.execFileSync`
- Existing `src/lib/cli-tools/bun-runtime.js` - 601 lines of benchmark patterns used in production

### Secondary (MEDIUM confidence)

- V8 memory heap documentation for interpreting `memoryUsage()` results
- OpenCode plugin architecture from `plugin.js` and `src/plugin/` parsers

### Tertiary (LOW confidence)

- General benchmarking best practices from prior phases

---

## Metadata

**Confidence breakdown:**
- Existing benchmark patterns: HIGH (already in production)
- Build-time feature flags: HIGH (documented in context, proven pattern from Phase 77)
- Cross-plugin comparison: MEDIUM (framework design, specific plugins TBD)
- Context load measurement: MEDIUM (need to define scope)

**Research date:** 2026-03-10
**Re-researched:** 2026-03-10 (re-research)
**Valid until:** Phase 90 completion

---

## Phase Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| BENCH-01 | Plugin benchmark adapter built for cross-plugin comparison | P2 |
| BENCH-02 | Baseline metrics captured for v9.3 | P2 |

### Success Criteria (from ROADMAP.md)

1. Plugin benchmark adapter built for cross-plugin comparison
2. Baseline metrics captured for v9.3
3. Benchmark can measure startup time, command execution, context loading
