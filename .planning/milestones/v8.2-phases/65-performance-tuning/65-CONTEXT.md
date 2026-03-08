# Phase 65: Performance Tuning — Context

## Phase Boundary

**Goal:** Profile and optimize hot paths, reduce bundle size, and improve init command timing — data-driven from Phase 61 baselines.

**Requirements:** PERF-01, PERF-02, PERF-03, PERF-04

**Baselines (from `.planning/baselines/performance.json`):**
- Bundle size: 1153KB
- Init timing: ~130-210ms (median ~132ms)
- File reads per run: 531
- File writes per run: 90
- Source files: 40, total lines: 31,096

## Decisions

### Bundle Size Strategy

- **Lazy-load acorn (230KB)** — Move from top-level require to inline require() inside AST functions. Acorn is only needed for codebase-intel operations, not every command.
- **Single-file architecture is no longer a constraint** — Splitting gsd-tools.cjs into multiple files is acceptable if it improves performance. Deploy manifest already tracks files.
- **Code splitting is in scope** — If splitting commands into separate chunks improves cold start or memory, do it. The deploy.sh manifest-based sync handles multi-file deployments.
- **No specific bundle size target** — Goal is efficiency, not a number. Reduce what's meaningful to reduce.
- **No trimming of constants.js** — The 38KB constants module was already cleaned in Phase 63. Leave it.
- **Router at 47KB is acceptable** — That's the cost of 180+ command routes.

### Init Command Optimization

- **Primary hot paths:** `init:plan-phase`, `init:execute-phase`, `init:phase-op` — these are called by agents constantly.
- **Add caching where it makes sense** — The Phase 51-52 cache layer exists but may not cover init paths. Extend if beneficial.
- **Stale-but-fast is acceptable** — Cache parsed roadmap/state/phase data with short TTL. Consecutive agent calls in the same session should not re-parse the same files.
- **"Light init" paths** — Commands that don't need AST/codebase-intel should skip loading those modules entirely. Not every init variant needs the full module graph.

### File I/O Reduction

- **Profile first, then fix** — Instrument hot paths to measure where reads actually happen before optimizing. Don't guess.
- **Intelligent timestamp-based caching** — Cache file parse results keyed on file mtime. If another agent (or the same agent) already parsed ROADMAP.md and it hasn't changed, serve from cache.
- **Enable profiling mode** — `GSD_PROFILE=1` environment variable to show I/O stats during development. Off by default.
- **Suspicion of significant waste** — 531 reads feels high. Expect redundant re-parsing of ROADMAP.md, STATE.md, and phase directories across a single command lifecycle.

### Profiling Scope & Completion

- **Profile all commands** — Not just init. Include verify, plan, state, and other frequently-used namespaces.
- **No hard timing target** — Looking to improve, not hit a specific number. Measurable improvement over baselines is sufficient.
- **One-time optimization pass** — No ongoing CI performance tracking needed after this phase.
- **Architectural changes are in scope** — If profiling reveals that the best wins require restructuring (e.g., splitting init, making codebase-intel a background process, reorganizing the module graph), those changes are allowed in this phase.

## Agent's Discretion

- Specific cache TTL values (30s, 60s, etc.) — choose based on profiling data
- Which modules to split vs. lazy-load — decide based on measured impact
- Profiling instrumentation approach — use existing profiler.js infrastructure or extend it
- Order of optimization (bundle first vs. I/O first vs. init first) — sequence based on dependency analysis
- Whether to use dynamic `import()` or conditional `require()` for lazy loading

## Deferred Ideas

- **AST as MCP server** — Discussed but deferred. AST is used internally by gsd-tools (codebase-intel, convention extraction), not just agent-facing. Moving to MCP would add cross-process complexity. Lazy-loading within gsd-tools is the right approach for now.
- **Constants.js trimming** — Already cleaned in Phase 63. Not revisiting.
- **Ongoing CI performance tracking** — One-time pass for this milestone. Could revisit in a future milestone if performance regresses.
