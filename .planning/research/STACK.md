# Technology Stack: v8.0 Performance & Agent Architecture

**Project:** bGSD Plugin
**Researched:** 2026-03-01
**Focus:** SQLite read cache, performance profiling, CLI command consolidation
**Overall confidence:** HIGH

## Executive Summary

The v8.0 stack question has three parts: (1) SQLite for caching parsed markdown, (2) performance profiling tooling, and (3) CLI subcommand consolidation. The critical finding: **better-sqlite3 is the right SQLite library**, despite requiring native addon management. The alternative `node:sqlite` built-in is only a Release Candidate (Stability 1.2) in Node.js 25.x and still experimental in the project's Node 18+ target. sql.js (WASM) adds ~1MB to the bundle and requires async initialization, violating the synchronous CLI design. better-sqlite3's native addon breaks single-file bundling, but the solution is **external declaration in esbuild + deploy-time copy** — a proven pattern used by Claude Code itself.

For performance profiling: **the existing `src/lib/profiler.js` is already the right foundation** — it uses `node:perf_hooks` which is available since Node.js 8. Enhancement means adding sub-command timing granularity, not new libraries.

For CLI consolidation: **no framework needed**. The existing hand-rolled router is already implementing a subcommand pattern. Consolidation is a refactoring task, not a dependency task.

## Recommended Stack

### SQLite: better-sqlite3

| Technology | Version | Purpose | Why |
|---|---|---|---|
| better-sqlite3 | ^12.6.2 | Read cache for parsed markdown content | Synchronous API matches CLI design, fastest SQLite binding for Node.js, battle-tested (3,977 npm dependents), prepared statements for structured queries |

**Why better-sqlite3 over alternatives:**

| Option | Verdict | Reason |
|---|---|---|
| **better-sqlite3** | **USE THIS** | Synchronous API, fastest perf, 12.6.2 current, widely deployed |
| `node:sqlite` | NOT YET | Only Stability 1.2 (Release Candidate) in Node 25.7.0. Still experimental in Node 22 LTS (requires `--experimental-sqlite` flag on 22.5-22.12, no flag needed 22.13+ but still experimental). Project targets Node 18+ — `node:sqlite` doesn't exist there. Would require bumping minimum to Node 22.13+ and accepting experimental status. |
| sql.js (WASM) | NO | Async initialization (`initSqlJs()` returns a Promise), adds ~1MB WASM binary, requires two-file distribution (.js + .wasm), 2-5x slower than native binding for sequential operations. CLI runs synchronous, short-lived processes. |
| sqlite3 (node-sqlite3) | NO | Async-only API, deprecated in favor of `node:sqlite`, callback-based. Wrong paradigm for synchronous CLI. |

**Confidence: HIGH** — better-sqlite3 API verified via Context7 (v12.6.2 docs, 181 code snippets). `node:sqlite` status verified via official Node.js 25.7.0 docs (Stability 1.2 Release Candidate). sql.js async requirement verified via GitHub README.

### esbuild Integration: External + Deploy Copy

| Technology | Version | Purpose | Why |
|---|---|---|---|
| esbuild (existing) | ^0.27.3 | Bundle with better-sqlite3 marked external | Native .node addons cannot be bundled into a single JS file — esbuild explicitly documents this limitation |

**Critical: better-sqlite3 is a native addon.** It includes a compiled `.node` binary (C++ binding to SQLite). This **cannot** be bundled into the single-file `gsd-tools.cjs`. The solution:

```javascript
// build.js addition
external: [
  'node:*', 'child_process', 'fs', /* ...existing... */,
  'better-sqlite3'  // NEW: native addon, cannot be bundled
],
```

**Deploy strategy:** `deploy.sh` copies `better-sqlite3` from `node_modules/` alongside the deployed `gsd-tools.cjs`. The `require('better-sqlite3')` resolves via Node's standard module resolution at runtime.

**This is a proven pattern.** Claude Code itself distributes better-sqlite3 as an external native dependency (see [better-sqlite3 issue #1367](https://github.com/WiseLibs/better-sqlite3/issues/1367)). Some users hit `NODE_MODULE_VERSION` mismatch issues, but those only arise when mixing different Node.js versions — not an issue when the tool runs on the user's own Node.js installation.

**Confidence: HIGH** — esbuild's external behavior for native addons verified via esbuild docs (Context7, issues #2674, #2830). Claude Code's use of better-sqlite3 as external dep confirmed via GitHub issue.

### Performance Profiling: node:perf_hooks (existing)

| Technology | Version | Purpose | Why |
|---|---|---|---|
| node:perf_hooks (existing) | Node.js built-in | Performance measurement | Already integrated in profiler.js, available since Node.js 8, zero dependencies, `performance.mark()/measure()` is W3C standard API |

**No new library needed.** The existing `src/lib/profiler.js` (116 lines) already provides:
- `startTimer(label)` / `endTimer(timer)` — high-resolution timing
- `mark(label)` / `measure(label, start, end)` — named measurement spans
- `writeBaseline(cwd, commandName)` — persisted timing data to `.planning/baselines/`
- Zero-cost when `GSD_PROFILE` is not set (all functions early-return)

**What to enhance** (code changes, not new deps):
1. Add `startTimer`/`endTimer` calls inside hot paths (file reads, markdown parsing, regex matching)
2. Add sub-operation timing in the router (pre-command, command, post-command)
3. Add a `gsd-tools profile <command>` wrapper that auto-enables `GSD_PROFILE=1` and formats results
4. Add baseline comparison: read previous baseline JSON, compute delta percentages

**Confidence: HIGH** — `node:perf_hooks` stable since Node.js 12. Existing profiler.js reviewed directly.

### CLI Command Consolidation: Hand-rolled (existing pattern)

| Technology | Version | Purpose | Why |
|---|---|---|---|
| Custom router (existing) | N/A | Subcommand dispatch | Already implements lazy-loading, switch-based routing for 100+ commands. Adding a framework would increase bundle size for marginal benefit. |

**No framework needed.** The existing router.js (947 lines) already implements:
- Lazy module loading (16 lazy loaders)
- Subcommand routing (e.g., `state update`, `verify plan-structure`, `codebase ast`)
- Global flag parsing (`--pretty`, `--verbose`, `--compact`, `--manifest`, `--fields`)
- Help dispatch via `COMMAND_HELP` lookup
- Performance profiling integration

**Alternatives considered and rejected:**

| Framework | Bundle Size | Why Not |
|---|---|---|
| Commander.js | ~50KB | Adds arg parsing abstraction the router already handles. Would require rewriting all 100+ command dispatches. Marginal benefit for significant churn. |
| yargs | ~200KB | Even heavier. Designed for complex option parsing — our commands use positional args and simple flags. |
| oclif | ~500KB+ | Enterprise CLI framework with plugins, hooks, lifecycle. Total overkill for a single-file CLI tool. |
| citty / clerc | ~10-20KB | Lightweight, but still adds dependency for something the router already does well. |

**What consolidation actually means** (architecture, not dependencies):
1. Group related top-level commands under parent commands (e.g., `gsd-tools config get` already works, but `config-set`, `config-get`, `config-ensure-section`, `config-migrate` are also separate top-level commands)
2. Add route aliases so `gsd-tools config set` and `gsd-tools config-set` both work (backward compat)
3. Potentially add a registration pattern instead of a giant switch statement

**Confidence: HIGH** — router.js reviewed directly. Framework alternatives researched via web search.

## What NOT to Add

| Temptation | Why Resist |
|---|---|
| **node:sqlite** | Not available in Node.js 18 (project minimum). Experimental/RC status even in Node 22+/25. Would force minimum version bump to 22.13+ AND users would see `ExperimentalWarning` on every CLI invocation. Revisit when it reaches Stability 2 (Stable) in an LTS release. |
| **sql.js** | Async initialization breaks synchronous CLI flow. ~1MB WASM binary inflates bundle from 1058KB to ~2058KB (nearly doubling it). Two-file distribution (.js + .wasm) complicates deploy. 2-5x slower than native for the sequential single-process use case. |
| **Commander.js / yargs** | Adds bundled weight for marginal benefit. Current router is already lazy-loading, subcommand-aware, and handles all 100+ commands. Framework migration would touch every command handler. |
| **clinic.js / 0x / pprof** | Heavy profiling tools designed for long-running servers. CLI tool runs for <5 seconds. `node:perf_hooks` with manual instrumentation is the correct approach for short-lived processes. |
| **lru-cache** | For in-memory caching. The existing `Map()` caches in `helpers.js`, `frontmatter.js`, `config.js`, `regex-cache.js` work perfectly because CLI is a single invocation (<5s). No eviction needed. SQLite replaces the cross-invocation persistence need. |
| **knex / kysely / drizzle** | SQL query builders. The cache schema is ~5 tables with simple CRUD. Raw prepared statements via better-sqlite3 are simpler, faster, and add zero overhead. |
| **node-sqlite3-wasm** | WASM port targeting Node.js with filesystem persistence. Still slower than native binding. Solves a problem (browser compat) we don't have. |

## Dependencies Summary

### New Runtime Dependencies

| Package | Version | Bundle Impact | Install Impact |
|---|---|---|---|
| better-sqlite3 | ^12.6.2 | 0KB (external) | ~10MB in node_modules (includes prebuilt native binaries for multiple platforms) |

### New Dev Dependencies

None.

### Updated Existing

| Package | Current | Update To | Reason |
|---|---|---|---|
| esbuild | ^0.27.3 | (keep) | Current version handles externals correctly |
| acorn | ^8.16.0 | (keep) | No changes needed |
| tokenx | ^1.3.0 | (keep) | No changes needed |

## Installation

```bash
# Add SQLite
npm install better-sqlite3

# Verify native compilation
node -e "const db = require('better-sqlite3')(':memory:'); console.log('SQLite OK')"
```

### build.js Changes

```javascript
// Add to external array in esbuild.build()
external: [
  'node:*', 'child_process', 'fs', 'path', 'os', 'crypto', 'util',
  'stream', 'events', 'buffer', 'url', 'querystring',
  'http', 'https', 'net', 'tls', 'zlib',
  'better-sqlite3'  // Native addon — cannot be bundled
],
```

### deploy.sh Changes

```bash
# After copying bin/gsd-tools.cjs to deploy target:
# Copy better-sqlite3 native module alongside it
DEPLOY_DIR="$HOME/.config/oc/get-shit-done"
cp bin/gsd-tools.cjs "$DEPLOY_DIR/bin/"

# Copy the native module directory
mkdir -p "$DEPLOY_DIR/node_modules/better-sqlite3"
cp -r node_modules/better-sqlite3/lib "$DEPLOY_DIR/node_modules/better-sqlite3/"
cp -r node_modules/better-sqlite3/build "$DEPLOY_DIR/node_modules/better-sqlite3/"
cp node_modules/better-sqlite3/package.json "$DEPLOY_DIR/node_modules/better-sqlite3/"

# Also need bindings and file-uri-to-path (better-sqlite3's dependencies)
for dep in bindings file-uri-to-path; do
  if [ -d "node_modules/$dep" ]; then
    mkdir -p "$DEPLOY_DIR/node_modules/$dep"
    cp -r "node_modules/$dep"/* "$DEPLOY_DIR/node_modules/$dep/"
  fi
done
```

## SQLite Cache Architecture (Informing ARCHITECTURE.md)

### Cache Layer Design

The SQLite database lives at `.planning/cache/gsd-cache.db`. It is a **read cache** — markdown files remain the authoritative source. The cache accelerates repeated parsing by storing pre-parsed structured data.

```
Markdown Files (authoritative)
    │
    ▼
[Parser Layer] ─── parse on cache miss ──→ [SQLite Cache]
    │                                           │
    ▼                                           ▼
  Results ◄─── cache hit (mtime check) ─── Cached Results
```

### Cache Invalidation Strategy

| Strategy | How It Works | When to Use |
|---|---|---|
| mtime-based | Store `file_mtime` in cache row. On read, `stat()` the file. If mtime differs, re-parse. | Default for all files |
| Hash-based | Store `content_hash` (SHA-256) in cache row. On read, hash file content. If hash differs, re-parse. | For files where mtime might be unreliable (e.g., git operations that preserve mtime) |
| Explicit invalidation | After any `state update`, `phase complete`, etc., invalidate affected cache rows. | After write operations through gsd-tools |

**Recommendation: mtime-based** for the common case (it's a single `fs.statSync` call, much cheaper than re-reading + re-hashing). Fall back to hash-based if mtime proves unreliable in practice.

### better-sqlite3 Usage Pattern

```javascript
const Database = require('better-sqlite3');

// Open/create cache database
const db = new Database(cachePath);
db.pragma('journal_mode = WAL');    // Faster writes, concurrent reads
db.pragma('synchronous = NORMAL');  // Good performance, acceptable durability for cache

// Create schema
db.exec(`
  CREATE TABLE IF NOT EXISTS file_cache (
    file_path TEXT PRIMARY KEY,
    file_mtime REAL NOT NULL,
    content_hash TEXT,
    parsed_data TEXT NOT NULL,  -- JSON-serialized parsed result
    parse_time_ms REAL,
    cached_at TEXT DEFAULT (datetime('now'))
  )
`);

// Prepared statements (reused across calls)
const getStmt = db.prepare('SELECT * FROM file_cache WHERE file_path = ?');
const putStmt = db.prepare(`
  INSERT OR REPLACE INTO file_cache (file_path, file_mtime, content_hash, parsed_data, parse_time_ms)
  VALUES (?, ?, ?, ?, ?)
`);

// Cache lookup
function getCached(filePath) {
  const stat = fs.statSync(filePath);
  const row = getStmt.get(filePath);
  if (row && row.file_mtime === stat.mtimeMs) {
    return JSON.parse(row.parsed_data);  // Cache hit
  }
  return null;  // Cache miss — caller must parse and call putCached()
}
```

### Graceful Degradation

**Critical design principle:** If better-sqlite3 is unavailable (compilation failure, missing native module), the tool must still work. The cache is an optimization, not a requirement.

```javascript
let db = null;
try {
  const Database = require('better-sqlite3');
  db = new Database(cachePath);
  db.pragma('journal_mode = WAL');
} catch (e) {
  // Native module not available — run without cache
  debugLog('cache', 'SQLite unavailable, running without cache', e.message);
}
```

This matches the existing pattern where `GSD_DEBUG` logging is opt-in, profiling is opt-in, and every feature degrades gracefully.

## Node.js Version Implications

| Node.js Version | SQLite Status | Impact on Project |
|---|---|---|
| 18.x (current min) | `node:sqlite` not available | better-sqlite3 is the only option |
| 20.x | `node:sqlite` not available | better-sqlite3 is the only option |
| 22.5 - 22.12 | `node:sqlite` experimental, requires `--experimental-sqlite` flag | Impractical for CLI tool |
| 22.13+ | `node:sqlite` experimental, no flag needed but emits `ExperimentalWarning` | Usable but noisy |
| 23.4+ | `node:sqlite` experimental, no flag needed | Usable but still experimental |
| 25.7+ | `node:sqlite` Release Candidate (Stability 1.2) | Getting close but not stable yet |

**Recommendation:** Keep Node.js 18+ minimum. Use better-sqlite3 now. When `node:sqlite` reaches Stability 2 (Stable) in an LTS release, consider migrating. The cache module should abstract the SQLite provider behind a clean interface to make this future migration easy.

## Future-Proofing: node:sqlite Migration Path

The better-sqlite3 API and `node:sqlite` API are intentionally similar (node:sqlite was designed to be a compatible replacement). A future migration would be straightforward:

```javascript
// Current (better-sqlite3)
const Database = require('better-sqlite3');
const db = new Database(path);

// Future (node:sqlite) — almost identical API
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(path);
```

Both use `db.prepare(sql)`, `stmt.get()`, `stmt.all()`, `stmt.run()` with the same signatures. The `node:sqlite` module was explicitly modeled after better-sqlite3.

**Action:** Create a `src/lib/cache.js` module that encapsulates SQLite access. All cache consumers go through this module, never importing better-sqlite3 directly. When `node:sqlite` stabilizes, only `cache.js` needs to change.

## Sources

| Source | Type | Confidence | Key Finding |
|---|---|---|---|
| [better-sqlite3 Context7 docs (v12.6.2)](https://github.com/wiselibs/better-sqlite3) | Context7 | HIGH | Synchronous API, WAL mode, prepared statements |
| [Node.js sqlite docs (v25.7.0)](https://nodejs.org/api/sqlite.html) | Official docs | HIGH | Stability 1.2 (Release Candidate), available since 22.5 |
| [esbuild Context7 docs](https://github.com/evanw/esbuild) | Context7 | HIGH | External declaration for native .node addons |
| [esbuild issue #2674 — sqlite3 with esbuild](https://github.com/evanw/esbuild/issues/2674) | GitHub issue | HIGH | Confirms native addons cannot be bundled |
| [better-sqlite3 issue #1367 — Claude Code distribution](https://github.com/WiseLibs/better-sqlite3/issues/1367) | GitHub issue | HIGH | Real-world example of external better-sqlite3 in CLI distribution |
| [sql.js GitHub](https://github.com/sql-js/sql.js) | GitHub README | HIGH | Async initialization required, WASM binary distribution |
| [Node.js perf_hooks docs](https://nodejs.org/api/perf_hooks.html) | Official docs | HIGH | Stable API, performance.mark/measure |
| Existing codebase: `src/lib/profiler.js` | Direct review | HIGH | Already uses perf_hooks, opt-in via GSD_PROFILE |
| Existing codebase: `src/router.js` | Direct review | HIGH | 947 lines, 16 lazy loaders, switch-based dispatch |
| Existing codebase: `src/lib/helpers.js` | Direct review | HIGH | Map-based in-memory cache, works for single invocation |
