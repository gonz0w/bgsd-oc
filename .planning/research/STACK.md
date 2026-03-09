# STACK Research: Runtime Acceleration Dependencies for bGSD v9.1

> Research date: 2026-03-09  
> Scope: production runtime speed (plugin hooks + CLI command latency), not benchmark tooling

## Recommendation (Opinionated Shortlist)

Adopt **two dependencies** and **two runtime techniques** that directly target known hot paths in this codebase.

1. **Replace plugin-side Zod schemas with Valibot** (`valibot@1.2.0`) to reduce plugin bundle weight and schema parse overhead.
2. **Replace custom recursive directory walking + repeated git-ignore subprocess checks** with `fast-glob@3.3.3` + `ignore@7.0.5` in codebase/file-scan commands.
3. **Enable Node module compile cache** (`module.enableCompileCache()` / `NODE_COMPILE_CACHE`) for repeated CLI invocations.
4. **Use `node:sqlite` statement caching (`createTagStore`)** in `src/lib/cache.js` to remove repeated `prepare()` overhead.

This is the highest-impact/lowest-complexity set for real-world responsiveness given current architecture and constraints.

---

## Integration-Ready Shortlist

| Priority | Dependency / Technique | Version | Replace / Target in This Repo | Expected Runtime Impact | Migration Risk |
|---|---|---:|---|---|---|
| P1 | Valibot | `1.2.0` | Replace `import { z } from 'zod'` in `src/plugin/tools/bgsd-status.js`, `src/plugin/tools/bgsd-plan.js`, `src/plugin/tools/bgsd-context.js`, `src/plugin/tools/bgsd-validate.js`, `src/plugin/tools/bgsd-progress.js` | **Cold-start + first-tool latency** improvement from smaller plugin bundle and lighter validators (likely noticeable in interactive sessions) | **Medium** (schema syntax migration) |
| P2 | fast-glob | `3.3.3` | Replace manual walkers in `src/lib/codebase-intel.js` (`walkSourceFiles`, parts of `getSourceDirs`) and high-fanout file scans in `src/commands/features.js` | **Large-repo scans**: fewer syscalls/JS loops, lower wall-time for codebase analysis/search-oriented commands | **Medium** (glob semantics parity work) |
| P2 | ignore | `7.0.5` | Replace per-dir `git check-ignore` subprocess use in `src/lib/codebase-intel.js:getSourceDirs` and similar ignore filtering paths | **Spawn reduction**: removes repeated git process overhead during scans; better scaling with many top-level dirs | **Medium** (nested ignore semantics validation needed) |
| P3 | Node module compile cache | Node `>=22.8` API (`module.enableCompileCache`) | Entry path in CLI bootstrap (`src/index.js` / built `bin/bgsd-tools.cjs`) and plugin host launch path where safe | **Repeat invocations**: faster startup/module compilation after warm cache (best for command-heavy sessions) | **Low** (opt-in, easy fallback) |
| P3 | SQLite statement cache | Built-in `node:sqlite` (`DatabaseSync#createTagStore`) | `src/lib/cache.js` (`SQLiteBackend`): replace per-call `db.prepare(...)` with cached tagged statements | **Cache-heavy commands**: lower DB overhead and tighter tail latency on repeated cache get/set/invalidate | **Low** (no external dependency) |

---

## Why These, Specifically (Codebase Fit)

### 1) Valibot over current Zod usage

- Current plugin bundle clearly inlines large Zod payload (seen in built `plugin.js`), while tool schemas are relatively simple object/string/number validators.
- Valibot’s modular API is designed for tree-shaking and smaller shipped code in browser/Node bundles.
- This directly targets plugin cold-path performance where every extra KB and parse path matters.

**Migration pattern (example):**
- `z.object({...})` -> `v.object({...})`
- `z.string().min(1)` -> `v.pipe(v.string(), v.minLength(1))`
- Keep output contracts unchanged.

### 2) fast-glob + ignore for scan-heavy commands

- `src/lib/codebase-intel.js` performs custom recursive sync walks and invokes git ignore checks in traversal-related logic.
- `fast-glob` provides mature, optimized traversal with `cwd`, `ignore`, `absolute`, `onlyFiles`, and sync/async APIs.
- Pairing with `ignore` removes avoidable subprocess churn from `git check-ignore` calls in hot scan flows.

**Adoption boundary:**
- Start with codebase intel + feature-analysis scans (largest traversal surfaces).
- Preserve existing skip behavior (`SKIP_DIRS`, binary-extension filters) as acceptance criteria.

### 3) Node compile cache (no new dependency)

- This CLI is invoked repeatedly in short-lived processes; parse/compile cost is paid often.
- Node’s compile cache persists V8 code cache to disk and can significantly improve subsequent loads when module contents are stable.
- Fits perfectly with bGSD’s frequent command calls and single-file bundled CLI behavior.

**Implementation guidance:**
- Enable early in bootstrap, behind config/env guard.
- Use `.planning/.cache/node-compile-cache` or tmp-based path with cleanup policy.
- Disable during coverage-sensitive test jobs.

### 4) SQLite statement caching in existing cache backend

- `src/lib/cache.js` currently prepares SQL statements repeatedly inside hot methods (`get`, `set`, `invalidate`, research cache operations).
- Node SQLite now provides statement cache utilities (`createTagStore`) for efficient statement reuse.
- Keeps current no-extra-dependency direction while improving DB path efficiency.

**Implementation guidance:**
- Create one tag store in `SQLiteBackend` constructor.
- Replace repeated `db.prepare(...).get/run(...)` calls with cached tagged calls.
- Maintain current fallback to `MapBackend` unchanged.

---

## Suggested Rollout Order

1. **P1: Valibot migration in plugin tool schemas** (highest likely impact on perceived plugin responsiveness).
2. **P2: fast-glob + ignore in `codebase-intel` and file-scan commands** (large repo wins).
3. **P3: Compile cache enablement** (quick win for repeated CLI runs).
4. **P3: SQLite statement cache upgrade** (incremental tail-latency reduction).

---

## What Not To Adopt in This Milestone

- **`better-sqlite3`**: high native-install friction, conflicts with low-overhead deployment ethos; current `node:sqlite` path can be optimized first.
- **Heavy APM/always-on tracing deps**: adds overhead to interactive runtime and misses milestone goal of direct user-visible speed.
- **Worker-thread frameworks for traversal**: complexity/risk too high before exhausting synchronous hot-path fixes above.

---

## Install / Adoption Commands

```bash
npm install valibot@1.2.0 fast-glob@3.3.3 ignore@7.0.5
```

(Compile cache + SQLite statement cache require code changes only; no package install.)

---

## Confidence

- **HIGH**: Node compile cache and SQLite statement-cache recommendations (official Node docs).
- **HIGH**: fast-glob/ignore capability fit for traversal + ignore filtering.
- **MEDIUM-HIGH**: Valibot replacing Zod for smaller runtime footprint (strong docs support; exact latency gain depends on final schema migration and bundle config).

---

## Sources

- Node `node:module` compile cache docs: https://nodejs.org/api/module.html#module-compile-cache
- Node `node:sqlite` docs (`DatabaseSync`, `prepare`, `createTagStore`): https://nodejs.org/api/sqlite.html
- Valibot docs/comparison and modular design notes: https://valibot.dev/
- fast-glob README/API/options: https://github.com/mrmlnc/fast-glob
- npm metadata checks (executed 2026-03-09):
  - `valibot` -> `1.2.0`
  - `fast-glob` -> `3.3.3`
  - `ignore` -> `7.0.5`
