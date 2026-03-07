# Technology Stack: v8.2 Cleanup, Performance & Validation

**Project:** bGSD Plugin
**Researched:** 2026-03-06
**Focus:** Dead code detection, bundle size analysis, performance profiling, architecture validation tooling
**Overall confidence:** HIGH (all tools verified via Context7, npm registry, and official docs)

## Executive Summary

v8.2 is a hardening milestone. No new runtime dependencies should be added to the bundle. All tools recommended here are **dev-only** (installed as devDependencies) or **already built-in** to Node.js and esbuild. The existing project already has the most critical piece — a custom profiler (`src/lib/profiler.js`) using `node:perf_hooks` with opt-in `GSD_PROFILE=1` gating. The goal is to complement it with external tools for one-time audits, not to add permanent runtime infrastructure.

**Key architectural constraint:** This is a single-file CJS bundle (~1216KB, 37 source files) deployed via file copy. No new runtime dependencies. All tooling is for development/CI analysis only.

**Critical finding: esbuild already has `metafile: true` and `analyzeMetafile()` built in.** The project's `build.js` tracks bundle size but doesn't use metafile analysis. Adding `metafile: true` to the existing build gives per-module byte attribution for free — no new tool needed.

**Knip is the right tool for dead code detection** in this CommonJS codebase. It explicitly supports CJS `require()`/`module.exports` without TypeScript, has 100+ plugins, and can auto-fix unused exports with `--fix`. Version 5.85.0, actively maintained (weekly releases), 1.7M weekly downloads.

**Madge is the right tool for architecture validation** — circular dependency detection and dependency graph visualization for CJS/ESM. Version 8.0.0, 1.7M weekly downloads, zero-config for CommonJS.

**Node.js built-in `--cpu-prof` is sufficient for CLI profiling.** No external profiling tool needed for a short-lived CLI process. The existing `GSD_PROFILE=1` custom profiler handles operational timing; `--cpu-prof` covers V8-level CPU analysis when deeper investigation is needed.

## Recommended Stack

### Dead Code Detection

| Technology | Version | Purpose | Why |
|---|---|---|---|
| knip | ^5.85.0 | Find unused files, exports, dependencies | Understands CJS `require()`/`module.exports`, project-wide analysis (not file-level like ESLint), auto-fix with `--fix`, 100+ framework plugins, no TypeScript required |

**Configuration for this project:**

```json
{
  "$schema": "https://unpkg.com/knip@5/schema.json",
  "entry": ["src/index.js", "build.js", "test/**/*.cjs"],
  "project": ["src/**/*.js"],
  "ignore": ["bin/gsd-tools.cjs", "bin/gsd-tools.test.cjs"],
  "ignoreDependencies": ["esbuild"]
}
```

**Why knip over alternatives:**

| Alternative | Verdict | Why Not |
|---|---|---|
| ESLint `no-unused-vars` | Insufficient | File-level only — can't detect cross-module dead exports |
| ts-prune | Wrong tool | TypeScript-only, maintenance mode, superseded by knip |
| depcheck | Partial overlap | Finds unused npm deps but not unused exports/files — knip does both |
| Manual grep for unused exports | Error-prone | Static analysis requires import graph traversal, not text search |

**Usage pattern (dev-only, not CI-gated initially):**

```bash
# Full audit — find all unused code
npx knip

# Production mode — ignore test files
npx knip --production

# Auto-fix unused exports (review first!)
npx knip --fix --dry-run
npx knip --fix
```

**Confidence:** HIGH — verified via Context7 docs, npm registry (5.85.0, Feb 2026), and knip.dev official documentation. CJS support explicitly documented with examples.

### Bundle Size Analysis

| Technology | Version | Purpose | Why |
|---|---|---|---|
| esbuild (existing) | 0.27.3 | Per-module byte attribution via metafile | Already a devDependency; `metafile: true` + `analyzeMetafile()` gives complete bundle composition at zero cost |

**No new tool needed.** The existing `build.js` should be enhanced to:

1. Add `metafile: true` to the esbuild config
2. Call `esbuild.analyzeMetafile(result.metafile)` after build
3. Write metafile JSON for historical tracking

**Current bundle composition (measured):**

| Component | Size | % of Bundle | Notes |
|---|---|---|---|
| acorn (npm dep) | 230.2KB | 18.9% | JS parser for AST intelligence — largest single module |
| tokenx (npm dep) | 6.1KB | 0.5% | BPE token estimation — minimal |
| src/ (37 files) | ~978KB | 80.6% | Application code |
| **Total** | **~1216KB** | **100%** | Budget: 1500KB |

**Top source modules by size (optimization targets):**

| Module | Size | % | Potential Action |
|---|---|---|---|
| src/commands/verify.js | 74.6KB | 6.1% | Audit for dead code paths |
| src/router.js | 72.0KB | 5.9% | 100+ command routes — review for stale entries |
| src/lib/constants.js | 71.9KB | 5.9% | Large regex/constant blocks — audit for unused patterns |
| src/commands/features.js | 71.8KB | 5.9% | Audit for dead code |
| src/commands/init.js | 70.1KB | 5.8% | 20 imports — review for unused |
| src/commands/research.js | 56.9KB | 4.7% | v8.1 RAG — likely has dead paths |
| src/commands/intent.js | 54.8KB | 4.5% | Audit for unused command handlers |

**Visualization (optional, for one-time deep analysis):**

```bash
# Upload metafile to esbuild's official analyzer
# https://esbuild.github.io/analyze/

# Or use CLI analysis
node -e "
const esbuild = require('esbuild');
esbuild.build({ ...config, metafile: true }).then(async r => {
  console.log(await esbuild.analyzeMetafile(r.metafile, { verbose: true }));
});
"
```

**Confidence:** HIGH — esbuild metafile API verified via Context7 (`/evanw/esbuild`). `analyzeMetafile()` available since esbuild 0.12.26 (2021). No additional dependency needed.

### Performance Profiling

| Technology | Version | Purpose | Why |
|---|---|---|---|
| `node:perf_hooks` (existing) | Node.js 22.5+ | Operational timing (command-level) | Already integrated as `GSD_PROFILE=1` — zero-cost when disabled |
| `node --cpu-prof` (built-in) | Node.js 22.5+ | V8 CPU profiling for hot path analysis | Generates `.cpuprofile` files viewable in Chrome DevTools — no install needed |

**No external profiler needed.** This is a short-lived CLI process (<5s typical execution). The two profiling layers are:

1. **Operational profiling** (existing `GSD_PROFILE=1`): Measures labeled spans (e.g., "parse ROADMAP.md", "read config"). Writes JSON baselines to `.planning/baselines/`. Already has comparison tooling in `src/commands/profiler.js`.

2. **V8 CPU profiling** (built-in, for deep dives only):
```bash
# Generate V8 CPU profile
node --cpu-prof --cpu-prof-dir=.planning/baselines bin/gsd-tools.cjs init --raw

# Analyze in Chrome DevTools:
# 1. Open chrome://inspect → "Open dedicated DevTools for Node"
# 2. Performance tab → Load profile → select .cpuprofile file
```

**Why NOT external profiling tools:**

| Tool | Verdict | Why Not |
|---|---|---|
| clinic.js | Overkill | Designed for long-running servers, not CLI tools (<5s). Requires global install. Adds complexity for a one-time investigation. |
| @platformatic/flame | Wrong fit | Requires Node.js >= 22.6, designed for server profiling with start/stop toggle. CLI processes exit too fast for flamegraph collection. |
| 0x | Marginal value | Flamegraph wrapper around V8 profiling — `--cpu-prof` gives the same data without a dependency. 0x adds startup overhead that distorts CLI profiling. |
| N|Solid | Wrong tier | Enterprise APM — wrong scale for a dev tool CLI. |

**What to actually profile (hot paths identified from existing baselines):**

- `init` command startup (parses ROADMAP.md, STATE.md, PLAN.md, config)
- `constants.js` loading (71.9KB of regex patterns — compilation cost)
- `router.js` command dispatch (100+ route registrations on every invocation)
- File cache hit rates (`src/lib/cache.js` L1/L2 cache effectiveness)

**Confidence:** HIGH — Node.js `--cpu-prof` verified via official Node.js docs and `node --help` output on this system. Existing profiler code reviewed (`src/lib/profiler.js`).

### Architecture Validation

| Technology | Version | Purpose | Why |
|---|---|---|---|
| madge | ^8.0.0 | Circular dependency detection, dependency graph | 1.7M weekly downloads, supports CJS, visual SVG graph output via Graphviz, JSON export for scripting |

**Usage pattern:**

```bash
# Find circular dependencies
npx madge --circular src/

# Generate dependency graph (requires graphviz)
npx madge --image .planning/research/dependency-graph.svg src/index.js

# JSON output for scripting
npx madge --json src/ > .planning/research/dependency-tree.json

# Check specific module's dependants (who imports this?)
npx madge --depends src/lib/helpers.js src/
```

**Architecture validation script (suggested):**

```bash
#!/bin/bash
# .planning/scripts/validate-architecture.sh

echo "=== Circular Dependencies ==="
npx madge --circular src/
CIRCULAR=$?

echo "=== Dependency Count per Module ==="
npx madge --json src/ | node -e "
const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
Object.entries(data)
  .map(([f,deps]) => [f, deps.length])
  .sort((a,b) => b[1] - a[1])
  .slice(0, 15)
  .forEach(([f,n]) => console.log(n + ' deps: ' + f));
"

exit $CIRCULAR
```

**Why madge over alternatives:**

| Alternative | Verdict | Why Not |
|---|---|---|
| dependency-cruiser | Overpowered | Full rule engine for dependency policies — useful for large teams with CI enforcement, overkill for a single-developer CLI tool. 100+ config options. |
| eslint-plugin-import `no-cycle` | Slow | O(n^2) analysis per file — too slow for ongoing use. Good for CI but madge is faster for ad-hoc audits. |
| Custom acorn-based analysis | Already exists | `src/lib/ast.js` has export/import analysis but doesn't do cycle detection. Extending it would duplicate madge's well-tested graph traversal. |
| Built-in `src/lib/deps.js` | Different scope | Analyzes target project dependencies (6 languages), not self-analysis of gsd-tools source. |

**Confidence:** HIGH — verified via Context7 (`/pahen/madge`), npm registry (v8.0.0), and official GitHub README. CJS support is a primary feature.

## What NOT to Add

These tools were considered and explicitly rejected for this milestone:

| Tool | Category | Why Not |
|---|---|---|
| size-limit | Bundle budget | `build.js` already tracks bundle size with a 1500KB budget and fails on overage. Adding size-limit would duplicate existing functionality. |
| bundlewatch | Bundle CI | Same — existing `bundle-size.json` baseline tracking is sufficient. |
| webpack-bundle-analyzer | Visualization | Wrong bundler. esbuild's built-in `analyzeMetafile()` serves the same purpose. |
| @viz-kit/esbuild-analyzer | Visualization | Interactive treemap is nice for exploration but esbuild's text analysis + official web analyzer (esbuild.github.io/analyze/) is sufficient. |
| depcheck | Unused deps | knip already detects unused dependencies AND unused exports. depcheck would be redundant. |
| eslint-plugin-unused-imports | Dead imports | knip catches these project-wide. ESLint rule is file-scoped. |
| ts-morph / jscodeshift | AST transforms | Automated large-scale refactoring — wrong tool for a 37-file project where changes should be manual and reviewed. |
| c8 / nyc | Code coverage | Test coverage ≠ dead code detection. High coverage doesn't mean all exports are used. knip solves the actual problem. |
| TypeScript `noUnusedLocals` | Dead local vars | This is a plain JS project. Also file-scoped, not project-scoped. |

## Installation

```bash
# Dev dependencies only — nothing enters the bundle
npm install -D knip madge
```

**Total new devDependencies: 2** (knip + madge). Both are dev-only and never touch the production bundle.

**No changes to runtime dependencies.** The existing `dependencies` (acorn, tokenx) and `devDependencies` (esbuild) are unchanged.

## Integration with Existing Tooling

| Existing Tool | Integration Point |
|---|---|
| `build.js` (esbuild) | Add `metafile: true`, call `analyzeMetafile()`, write metafile JSON |
| `GSD_PROFILE=1` profiler | No change — continues to provide operational timing |
| `src/commands/profiler.js` compare | No change — continues to compare baselines |
| `npm test` (762+ tests) | No change — knip is run separately, not as part of test suite |
| `deploy.sh` | No change — knip/madge are dev tools, not deployment concerns |

## Recommended npm Scripts

```json
{
  "scripts": {
    "build": "node build.js",
    "test": "node --test bin/gsd-tools.test.cjs",
    "lint:dead-code": "knip",
    "lint:dead-code:fix": "knip --fix",
    "lint:circular": "madge --circular src/",
    "lint:deps": "madge --json src/ | node -e \"const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));Object.entries(d).map(([f,deps])=>[f,deps.length]).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([f,n])=>console.log(n+' deps: '+f))\"",
    "analyze": "node build.js && echo '--- Bundle Analysis ---' && node -e \"const e=require('esbuild');const fs=require('fs');const m=JSON.parse(fs.readFileSync('.planning/baselines/metafile.json','utf8'));e.analyzeMetafile(m,{verbose:true}).then(console.log)\""
  }
}
```

## Sources

| Source | Type | Confidence |
|---|---|---|
| Context7 `/evanw/esbuild` — metafile/analyzeMetafile API | Official docs | HIGH |
| Context7 `/webpro-nl/knip` — CJS configuration, entry points | Official docs | HIGH |
| Context7 `/pahen/madge` — circular detection, CLI usage | Official docs | HIGH |
| npm registry — knip@5.85.0 (Feb 2026) | Version verification | HIGH |
| npm registry — madge@8.0.0 | Version verification | HIGH |
| npm registry — esbuild@0.27.3 (installed) | Version verification | HIGH |
| knip.dev/guides/working-with-commonjs | Official docs | HIGH |
| esbuild.github.io/api/#metafile | Official docs | HIGH |
| nodejs.org/en/learn/diagnostics | Official docs | HIGH |
| push-based.io/article/advanced-cpu-profiling-in-node | Community (verified) | MEDIUM |
| Direct measurement: `esbuild.analyzeMetafile()` on this project | Empirical | HIGH |
| Direct measurement: `node --help` on Node.js 22.5+ | Empirical | HIGH |
