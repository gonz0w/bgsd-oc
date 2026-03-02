# Architecture Research: v8.0 Performance & Agent Architecture

**Domain:** SQLite cache layer, agent consolidation, and command grouping integration for existing 34-module CLI  
**Researched:** 2026-03-01  
**Overall confidence:** HIGH  
**Mode:** Integration architecture for existing codebase

## Executive Summary

v8.0 adds three structural changes to a 34-module CLI that bundles to a single file: (1) a SQLite read cache layer using Node.js built-in `node:sqlite`, (2) agent role consolidation from 11 to ~8-9 agents, and (3) command grouping via subcommand patterns. The central integration question: **how do these changes thread through the existing module structure without breaking the esbuild single-file bundle, the synchronous I/O model, or the 751-test contract surface?**

The answer: **`node:sqlite` (`DatabaseSync`) provides zero-dependency synchronous SQLite via the existing `external: ['node:*']` esbuild pattern — no native addon, no bundle size impact, no new npm dependency. A new `src/lib/cache.js` module wraps it with the existing `cachedReadFile` interface pattern. Agent consolidation is purely markdown file changes (merging system prompts) with matching AGENT_MANIFESTS updates in `context.js`. Command consolidation reorganizes the router's switch statement without changing CLI behavior — old command names become aliases.**

### Critical Constraint: Node.js Version

The project currently specifies `"node": ">=18"` in `package.json`. `node:sqlite` is available from Node.js v22.5.0+ (experimental) and stable in v25+. **The minimum version must be bumped to `>=22.5.0`** with a `--experimental-sqlite` flag requirement, or to `>=23.x` where it stabilizes. On the current development platform (Node.js v25.7.0), `node:sqlite` works without any experimental flags and has been verified to deliver 2.9ms for 1000 reads and 4.4ms for 1000 inserts in benchmarking.

**Alternative if version bump is rejected:** Fall back to `better-sqlite3` (native addon, requires shipping `.node` binary alongside the bundle) or stay with the current Map-based in-memory cache + JSON file approach. The architecture below assumes `node:sqlite` because it perfectly matches the existing constraints (synchronous, zero dependencies, externalized by esbuild).

## System Overview

### Current Architecture (34 modules)

```
src/index.js → src/router.js → src/commands/*.js (14 modules)
                                   ↓ imports
                                src/lib/*.js (18 modules)
                                   ↓ produces
                                bin/gsd-tools.cjs (single file, ~1058KB)
```

**Module inventory:**
- **Commands (14):** init, state, roadmap, phase, verify, features, misc, memory, intent, env, mcp, worktree, codebase, trajectory
- **Libraries (18):** helpers, output, format, config, constants, context, frontmatter, git, profiler, regex-cache, ast, codebase-intel, conventions, deps, lifecycle, orchestration, review/severity, review/stage-review, recovery/stuck-detector
- **Infrastructure (2):** router, index

**Data flow for context loading (current):**
```
Workflow starts
  → gsd-tools init execute-phase <N>
    → loadConfig() reads .planning/config.json (cached in Map)
    → findPhaseInternal() reads .planning/phases/ tree (cached in Map)
    → cachedReadFile() reads ROADMAP.md, STATE.md, etc. (cached in Map)
    → autoTriggerCodebaseIntel() reads/writes codebase-intel.json
    → Output JSON to stdout
  → Agent reads JSON, loads referenced files via Read tool
```

**Key characteristics preserved by v8.0:**
- Synchronous I/O throughout (no async rewrite)
- Map-based in-memory cache per CLI invocation (~5s lifetime)
- Markdown files are authoritative (never generated from cache)
- JSON-over-stdout interface to consuming agents
- esbuild bundles everything except `node:*` builtins

### v8.0 Target Architecture

```
src/index.js → src/router.js → src/commands/*.js (14 → 13 modules)
                                   ↓ imports
                                src/lib/*.js (18 → 19 modules)
                                   ↓ new module
                                src/lib/cache.js  ← NEW: SQLite cache layer
                                   ↓ uses
                                node:sqlite (DatabaseSync) ← Node.js built-in
                                   ↓ stores
                                .planning/.cache/gsd-cache.db ← SQLite file
```

## Component 1: SQLite Cache Layer (`src/lib/cache.js`)

### What It Replaces

The current caching is a **per-invocation in-memory Map** in `helpers.js`:

```javascript
// Current: dies when CLI process exits
const fileCache = new Map();  // file contents
const dirCache = new Map();   // directory listings
let _phaseTreeCache = null;   // phase tree
let _milestoneCache = null;   // milestone info
```

This means every CLI invocation re-reads ROADMAP.md, STATE.md, config.json, codebase-intel.json, and the entire phase tree from disk. For a project with 20 phases, each containing 3 plans, that's ~70+ file reads per `init execute-phase` call.

### What SQLite Cache Provides

A **cross-invocation persistent cache** that survives process exit:

```javascript
// New: survives across CLI invocations
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('.planning/.cache/gsd-cache.db');
```

**Performance verified on target platform:**
- 1000 reads: 2.9ms (vs ~50-100ms for 1000 file reads)
- 1000 writes: 4.4ms
- Zero native addon — Node.js built-in
- Zero bundle size impact — already externalized by `external: ['node:*']`

### Schema Design

```sql
-- File content cache with hash-based staleness
CREATE TABLE IF NOT EXISTS file_cache (
  path TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  hash TEXT NOT NULL,        -- SHA-256 of content for staleness
  mtime_ms INTEGER NOT NULL, -- File mtime at cache time
  size_bytes INTEGER NOT NULL,
  cached_at INTEGER NOT NULL  -- Date.now() at cache time
);

-- Parsed/computed data cache (structured results)
CREATE TABLE IF NOT EXISTS parsed_cache (
  key TEXT PRIMARY KEY,       -- e.g., 'phase_tree', 'milestone_info', 'roadmap_phases'
  value TEXT NOT NULL,        -- JSON-serialized
  depends_on TEXT,            -- JSON array of file paths this depends on
  cached_at INTEGER NOT NULL
);

-- Metadata
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

### Module Interface (`src/lib/cache.js`)

```javascript
'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { debugLog } = require('./output');

let _db = null;
let _cwd = null;

/**
 * Get or create the cache database for a project.
 * Lazy initialization — only opens DB when first used.
 * Falls back to null if node:sqlite unavailable (graceful degradation).
 */
function getCache(cwd) {
  if (_db && _cwd === cwd) return _db;
  try {
    const { DatabaseSync } = require('node:sqlite');
    const cacheDir = path.join(cwd, '.planning', '.cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    const dbPath = path.join(cacheDir, 'gsd-cache.db');
    _db = new DatabaseSync(dbPath);
    _db.exec('PRAGMA journal_mode=WAL');
    _db.exec('PRAGMA synchronous=NORMAL');
    _initSchema(_db);
    _cwd = cwd;
    return _db;
  } catch (e) {
    debugLog('cache.init', 'SQLite unavailable, falling back to in-memory', e);
    _db = null;
    return null;
  }
}

/**
 * Read a file through cache. Returns content if cache hit is valid
 * (mtime unchanged), otherwise reads from disk and updates cache.
 * 
 * Drop-in replacement for cachedReadFile pattern.
 */
function cachedRead(cwd, filePath) { /* ... */ }

/**
 * Read a parsed/computed result from cache.
 * Returns null if any dependency file has changed.
 */
function cachedParsed(cwd, key) { /* ... */ }

/**
 * Store a parsed/computed result with its file dependencies.
 */
function storeParsed(cwd, key, value, dependsOn) { /* ... */ }

/**
 * Invalidate cache entries for a specific file path.
 * Called after writes (same as existing invalidateFileCache pattern).
 */
function invalidate(cwd, filePath) { /* ... */ }

/**
 * Clear the entire cache. Used during milestone transitions.
 */
function clearAll(cwd) { /* ... */ }
```

### Integration Points with Existing Modules

| Existing Module | Current Pattern | v8.0 Change | Risk |
|---|---|---|---|
| `helpers.js` → `cachedReadFile()` | In-memory Map | Delegate to `cache.js`, keep Map as L1 | LOW — same interface |
| `helpers.js` → `getPhaseTree()` | Module-level variable | Store in `parsed_cache`, invalidate on phase dir changes | LOW — same return shape |
| `helpers.js` → `getMilestoneInfo()` | Module-level variable | Store in `parsed_cache`, invalidate on ROADMAP.md change | LOW |
| `config.js` → `loadConfig()` | Map keyed by cwd | Delegate to `cache.js` for cross-invocation persistence | LOW |
| `codebase-intel.js` → `readIntel()` | Uses `cachedReadFile` | Gets cache for free via helpers.js delegation | ZERO — transparent |
| `init.js` → all init commands | Build result objects from multiple file reads | Dramatic speedup from cached reads | ZERO — transparent |
| `commands/memory.js` | Reads/writes JSON files directly | NO CHANGE — memory.json stays as-is (sacred data) | ZERO |
| `commands/trajectory.js` | Reads/writes trajectory.json directly | NO CHANGE — sacred data, not cached | ZERO |

### Staleness Strategy

**Two-layer cache with fast validation:**

```
L1: In-memory Map (lives for CLI invocation, ~5s)
  ↓ miss
L2: SQLite (lives across invocations, validated by mtime)
  ↓ miss or stale
L3: Filesystem read (authoritative source)
```

**Staleness check (< 1ms):**
```javascript
function isStale(cwd, filePath) {
  const db = getCache(cwd);
  if (!db) return true; // No cache → always read from disk
  
  const row = db.prepare('SELECT mtime_ms FROM file_cache WHERE path = ?').get(filePath);
  if (!row) return true; // Not cached
  
  try {
    const stat = fs.statSync(path.join(cwd, filePath));
    return stat.mtimeMs !== row.mtime_ms;
  } catch {
    return true; // File deleted
  }
}
```

**Parsed cache invalidation:**
```javascript
function isParsedStale(cwd, key) {
  const db = getCache(cwd);
  if (!db) return true;
  
  const row = db.prepare('SELECT depends_on FROM parsed_cache WHERE key = ?').get(key);
  if (!row) return true;
  
  const deps = JSON.parse(row.depends_on || '[]');
  return deps.some(dep => isStale(cwd, dep));
}
```

### Graceful Degradation

**If `node:sqlite` is unavailable** (Node.js < 22.5, or experimental flag not set), `getCache()` returns `null` and every function falls through to the existing Map-based cache. No behavior change, no crash. This is critical for backward compatibility.

```javascript
function cachedRead(cwd, filePath) {
  // L1: In-memory (existing behavior)
  if (fileCache.has(filePath)) return fileCache.get(filePath);
  
  // L2: SQLite (new, optional)
  const db = getCache(cwd);
  if (db && !isStale(cwd, filePath)) {
    const row = db.prepare('SELECT content FROM file_cache WHERE path = ?').get(filePath);
    if (row) {
      fileCache.set(filePath, row.content); // Populate L1
      return row.content;
    }
  }
  
  // L3: Filesystem (existing behavior)
  const content = safeReadFile(filePath);
  if (content !== null) {
    fileCache.set(filePath, content); // L1
    if (db) { /* store in SQLite L2 */ }
  }
  return content;
}
```

### Build Impact

**esbuild configuration — no changes needed:**
```javascript
// build.js already externalizes node:*
external: ['node:*', 'child_process', 'fs', 'path', ...]
```

`node:sqlite` is a Node.js built-in module. It's already covered by the `'node:*'` glob in the externals array. **Zero bundle size impact. No new npm dependencies.**

### .gitignore Addition

```
# Add to .planning/.gitignore
.cache/
```

The SQLite cache file is project-local, ephemeral, and should never be committed. The `.cache/` directory already exists (used for `.analyzing` lock file) but the SQLite DB and WAL/SHM files need explicit gitignore.

## Component 2: Agent Architecture Consolidation

### Current Agent Inventory (11 agents)

| Agent | Lines | Role | Workflow Spawner |
|---|---|---|---|
| `gsd-executor` | 481 | Execute plans, make commits | execute-phase |
| `gsd-verifier` | 569 | Verify phase goal achievement | verify-phase, verify-work |
| `gsd-planner` | 1195 | Create phase plans | plan-phase |
| `gsd-plan-checker` | 653 | Check plans before execution | plan-phase |
| `gsd-phase-researcher` | 516 | Research before planning | plan-phase, research-phase |
| `gsd-project-researcher` | 635 | Research domain for roadmap | new-project, new-milestone |
| `gsd-research-synthesizer` | 248 | Merge research outputs | new-project |
| `gsd-roadmapper` | 653 | Create roadmap from research | new-project |
| `gsd-codebase-mapper` | 768 | Explore and document codebase | map-codebase |
| `gsd-debugger` | 1214 | Debug with scientific method | debug, diagnose-issues |
| `gsd-integration-checker` | 446 | Verify cross-phase wiring | (manual) |

**Total: 7,378 lines across 11 agent definitions.**

### Overlap Analysis

**Research overlap (project-researcher ↔ phase-researcher):**
- `gsd-project-researcher` researches domain ecosystems before roadmap creation
- `gsd-phase-researcher` researches specific implementation approaches before planning
- **Overlap:** Both use Context7, web search, and the same tool chain. Both write RESEARCH.md-style outputs. Both use confidence levels.
- **Difference:** Scope (project-level vs phase-level), output format (`.planning/research/*.md` vs `.planning/phases/NN-xxx/RESEARCH.md`)
- **Verdict: Keep separate.** Different scopes, different spawners, different output contracts. Merging would create a 1100+ line agent with conditional logic. The project system prompt in `gsd-project-researcher` (this file!) is already specialized for ecosystem research.

**Verification overlap (verifier ↔ plan-checker ↔ integration-checker):**
- `gsd-verifier`: Post-execution verification — "did the code achieve the goal?"
- `gsd-plan-checker`: Pre-execution verification — "will the plan achieve the goal?"
- `gsd-integration-checker`: Cross-phase verification — "do phases work together?"
- **Overlap:** All three do "goal-backward" analysis. All check codebase artifacts.
- **Difference:** Timing (pre-plan, post-execution, post-milestone), scope (single plan, single phase, cross-phase)
- **Verdict: Merge `gsd-integration-checker` into `gsd-verifier`.** Integration checking is verification at a wider scope. The verifier already has the goal-backward methodology; adding cross-phase wiring checks is a natural extension. The integration-checker is rarely used independently and at 446 lines can fold cleanly into the verifier's framework.

**Synthesis overlap (research-synthesizer ↔ roadmapper):**
- `gsd-research-synthesizer`: Reads 4 research files, writes SUMMARY.md
- `gsd-roadmapper`: Reads SUMMARY.md + research, creates ROADMAP.md
- **Overlap:** Both consume research outputs. Sequential in the workflow.
- **Verdict: Merge `gsd-research-synthesizer` into `gsd-roadmapper`.** The synthesizer is only 248 lines and always feeds the roadmapper. The roadmapper can do the synthesis as a first step. This eliminates a subagent spawn and the handoff overhead. The workflow currently: spawn 4 researchers → spawn synthesizer → spawn roadmapper. New: spawn 4 researchers → spawn roadmapper (which synthesizes first).

**Codebase mapper overlap with codebase-intel:**
- `gsd-codebase-mapper`: Agent that explores and writes docs (STACK.md, ARCHITECTURE.md, etc.)
- `codebase-intel.js`: Automated analysis (file stats, deps, conventions)
- **Overlap:** Both analyze codebase structure
- **Difference:** Mapper produces human-readable docs; intel produces machine-readable JSON
- **Verdict: Keep separate.** Different purposes, different outputs.

### Consolidation Plan

| Action | From | To | Lines Saved | Impact |
|---|---|---|---|---|
| **Merge** | `gsd-integration-checker` (446) | → `gsd-verifier` | ~350 | Adds cross-phase verification mode |
| **Merge** | `gsd-research-synthesizer` (248) | → `gsd-roadmapper` | ~200 | Adds synthesis as roadmapper's first step |
| **Keep** | `gsd-project-researcher` (635) | unchanged | 0 | Distinct scope from phase-researcher |
| **Keep** | `gsd-phase-researcher` (516) | unchanged | 0 | Distinct scope from project-researcher |
| **Keep** | `gsd-planner` (1195) | unchanged | 0 | Core, unique role |
| **Keep** | `gsd-plan-checker` (653) | unchanged | 0 | Pre-execution vs post-execution |
| **Keep** | `gsd-executor` (481) | unchanged | 0 | Core, unique role |
| **Keep** | `gsd-debugger` (1214) | unchanged | 0 | Unique methodology |
| **Keep** | `gsd-codebase-mapper` (768) | unchanged | 0 | Unique output format |

**Result: 11 agents → 9 agents. ~550 lines eliminated. Under the 12-agent cap.**

### Integration Points

**`context.js` AGENT_MANIFESTS:**
```javascript
// Remove: 'gsd-integration-checker' (folded into verifier)
// No entry existed for gsd-research-synthesizer or gsd-roadmapper (not in manifests)
// Existing verifier manifest may need field additions for cross-phase mode
```

**Workflow files affected:**
```
workflows/verify-work.md      → Add --mode=integration option
workflows/complete-milestone.md → Update to use verifier with integration mode
workflows/new-project.md      → Remove synthesizer spawn step; roadmapper handles synthesis
```

**Init commands affected:**
```
init.js cmdInitVerifyWork()    → No change (already supports verifier)
init.js cmdInitNewProject()    → Remove synthesizer_model field
init.js cmdInitNewMilestone()  → Remove synthesizer_model field
```

### Agent Responsibility Matrix (Post-Consolidation)

| Lifecycle Stage | Agent | Produces | Consumes |
|---|---|---|---|
| **Project Setup** | project-researcher | `.planning/research/*.md` | PROJECT.md, web sources |
| **Project Setup** | roadmapper (+synthesis) | ROADMAP.md, REQUIREMENTS.md | research/*.md |
| **Codebase Discovery** | codebase-mapper | `.planning/codebase/*.md` | Source code |
| **Phase Planning** | phase-researcher | `RESEARCH.md` | ROADMAP.md, codebase docs |
| **Phase Planning** | planner | `PLAN.md` files | RESEARCH.md, CONTEXT.md |
| **Phase Planning** | plan-checker | Pass/Fail + feedback | PLAN.md, ROADMAP.md |
| **Execution** | executor | Code changes, SUMMARY.md | PLAN.md, STATE.md |
| **Verification** | verifier (+integration) | VERIFICATION.md | Code, SUMMARY.md, cross-phase |
| **Debugging** | debugger | Debug session files | Code, test output |

## Component 3: Command Consolidation

### Current Command Sprawl

The router's switch statement has **54 top-level cases** mapping to 14 lazy-loaded command modules. Some commands are already subcommand-grouped (state, verify, phase, etc.), but many are flat:

**Already grouped (good pattern):**
- `state update|get|patch|validate|...` (10 subcommands)
- `verify plan-structure|phase-completeness|...` (13 subcommands)
- `phase next-decimal|add|insert|remove|complete` (5 subcommands)
- `codebase analyze|status|conventions|...` (12 subcommands)
- `memory write|read|list|compact` (5 subcommands)
- `intent create|show|update|validate|trace|drift` (7 subcommands)
- `git log|diff-summary|blame|branch-info|rewind|trajectory-branch` (6 subcommands)
- `trajectory checkpoint|list|pivot|compare|choose|dead-ends` (6 subcommands)

**Ungrouped candidates for consolidation:**

| Current Flat Command | Proposed Group | Subcommand |
|---|---|---|
| `find-phase` | `phase find` | Move from misc to phase module |
| `phases list` | `phase list` | Already nearly there |
| `requirements mark-complete` | `phase requirements-complete` | Or keep separate |
| `milestone complete` | `milestone complete` | Already grouped |
| `session-diff` | `session diff` | New group |
| `session-summary` | `session summary` | New group |
| `context-budget [path]` | `context budget` | New group or keep |
| `context-budget baseline` | `context baseline` | |
| `context-budget compare` | `context compare` | |
| `context-budget measure` | `context measure` | |
| `test-run` | `test run` | New group |
| `test-coverage` | `test coverage` | New group |
| `search-decisions` | `search decisions` | New group |
| `search-lessons` | `search lessons` | New group |
| `validate-dependencies` | `validate deps` | Merge into validate |
| `validate-config` | `validate config` | Merge into validate |
| `codebase-impact` | `codebase impact` | Already exists in codebase! |
| `rollback-info` | `plan rollback` | New group |
| `velocity` | `progress velocity` | Or keep |
| `quick-summary` | `quick summary` | Group with quick |
| `extract-sections` | Internal/keep | Utility command |
| `token-budget` | `context tokens` | Group with context |
| `trace-requirement` | `verify trace` | Merge into verify |
| `mcp-profile` | `mcp profile` | Already exists! Duplicate case |
| `list-todos` | `todo list` | Group with todo |
| `generate-slug` | Internal/keep | Utility command |
| `current-timestamp` | Internal/keep | Utility command |
| `verify-path-exists` | Internal/keep | Utility command |
| `config-ensure-section` | `config ensure` | New group |
| `config-set` | `config set` | New group |
| `config-get` | `config get` | New group |
| `config-migrate` | `config migrate` | New group |
| `history-digest` | `state history` | Group with state |

### Consolidation Strategy

**Principle: Group by domain, alias old names for backward compatibility.**

The router already supports subcommand patterns. Consolidation means:
1. Move handler logic to the appropriate command module
2. Add the new subcommand route in the existing switch case
3. Keep the old flat case as an alias (one-liner redirect)

**Example: `search-decisions` → `search decisions`**

```javascript
// Router: add new group
case 'search': {
  const sub = args[1];
  if (sub === 'decisions') lazyFeatures().cmdSearchDecisions(cwd, args.slice(2).join(' '), raw);
  else if (sub === 'lessons') lazyFeatures().cmdSearchLessons(cwd, args.slice(2).join(' '), raw);
  else error('Unknown search subcommand. Available: decisions, lessons');
  break;
}

// Router: keep old as alias
case 'search-decisions': {
  lazyFeatures().cmdSearchDecisions(cwd, args.slice(1).join(' '), raw);
  break;
}
```

### Proposed New Groups

| Group | Subcommands | Module | Notes |
|---|---|---|---|
| `config` | `get`, `set`, `ensure`, `migrate` | misc.js (or new config-cmd.js) | Currently 4 separate top-level commands |
| `search` | `decisions`, `lessons` | features.js | Currently 2 separate commands |
| `session` | `diff`, `summary` | features.js | Currently 2 separate commands |
| `test` | `run`, `coverage` | features.js | Currently 2 separate commands |
| `context` | `budget`, `baseline`, `compare`, `measure`, `tokens` | features.js | Currently split across context-budget and token-budget |

### Router Impact

**Lines reduced:** ~40-60 cases → ~30-35 cases (keeping aliases)
**Module changes:** Primarily `router.js` reorganization. No command module logic changes.
**Breaking changes:** NONE — old command names continue to work as aliases.
**COMMAND_HELP in constants.js:** Add compound help entries for new groups.

### features.js Candidate Split

`features.js` currently handles 15+ unrelated commands (session-diff, context-budget, test-run, search-decisions, velocity, rollback-info, etc.). This is the "misc overflow" module. Consider splitting into:

| New Module | Commands Moved | Rationale |
|---|---|---|
| `src/commands/search.js` | searchDecisions, searchLessons | Domain: cross-session search |
| `src/commands/session.js` | sessionDiff, sessionSummary | Domain: session management |
| Keep in features.js | velocity, rollbackInfo, contextBudget, testRun, etc. | Remaining utility commands |

**Impact on module count:** 14 commands → 15-16 commands (but with better domain cohesion)
**Bundle impact:** Zero — same code, different files, same bundle.

## Data Flow Changes

### Before: Context Loading (v7.1)

```
CLI invocation
  → readFileSync(.planning/config.json)     ~1ms
  → readdirSync(.planning/phases/)          ~1ms
  → readFileSync(ROADMAP.md)                ~1ms
  → readFileSync(STATE.md)                  ~1ms
  → readFileSync(INTENT.md)                 ~1ms
  → readFileSync(env-manifest.json)         ~1ms
  → readFileSync(codebase-intel.json)       ~2ms (300KB+)
  → readFileSync(each PLAN.md)              ~1ms × N
  → Parse each file (regex, frontmatter)    ~2-5ms
  ─────────────────────────────────────
  Total: 15-25ms for init execute-phase

  Next invocation: repeat everything from scratch
```

### After: Context Loading (v8.0)

```
CLI invocation
  → Open SQLite (.planning/.cache/gsd-cache.db)  ~2ms (first), ~0ms (already open)
  → stat(.planning/config.json)                   ~0.1ms
    → Cache hit: return from SQLite                ~0.05ms
  → stat(.planning/phases/) subtree               ~0.5ms
    → Cache hit: return parsed phase tree          ~0.05ms
  → stat(ROADMAP.md)                              ~0.1ms
    → Cache hit: return content                    ~0.05ms
  → ... (all file reads check mtime, return cached)
  ─────────────────────────────────────
  Total: ~3-5ms for init execute-phase (cache warm)
         15-25ms (cache cold, same as before)

  Next invocation: only re-reads files with changed mtime
```

**Expected speedup: 3-5x for repeated invocations** (which is the common case — agents invoke gsd-tools multiple times per session).

## Build Order (Dependency Chain)

### Phase 1: SQLite Cache Foundation
**New module:** `src/lib/cache.js`
**Dependencies:** `node:sqlite`, `output.js` (debugLog), `fs`, `path`, `crypto`
**Depends on:** Nothing new — uses existing debugLog pattern
**Changes to existing:** NONE in this phase — cache.js is standalone

### Phase 2: Cache Integration
**Modified modules:** `helpers.js` (wire cachedReadFile → cache.js), `config.js` (wire loadConfig → cache.js)
**Dependencies:** `cache.js` from Phase 1
**Changes:** Replace Map-based cache with two-layer (Map + SQLite) cache in helpers.js
**Risk mitigation:** Keep Map as L1, SQLite as L2. If SQLite fails, Map works exactly as before.
**Test impact:** All 751 tests should pass unchanged (same interface, same behavior)

### Phase 3: Parsed Data Caching
**Modified modules:** `helpers.js` (getPhaseTree, getMilestoneInfo → parsed_cache)
**Dependencies:** Cache integration from Phase 2
**New pattern:** `cachedParsed(cwd, key)` / `storeParsed(cwd, key, value, dependsOn)`
**Test impact:** May need contract test snapshot updates if output format changes (it shouldn't)

### Phase 4: Agent Consolidation
**Modified files:** `agents/gsd-verifier.md`, `agents/gsd-roadmapper.md`
**Deleted files:** `agents/gsd-integration-checker.md`, `agents/gsd-research-synthesizer.md`
**Modified modules:** `context.js` (AGENT_MANIFESTS), `init.js` (remove synthesizer_model)
**Modified workflows:** `new-project.md`, `verify-work.md`, `complete-milestone.md`
**Dependencies:** Independent of cache work — can parallelize with Phases 1-3
**Test impact:** Contract test snapshots for init new-project output (synthesizer_model removed)

### Phase 5: Command Consolidation
**Modified module:** `router.js` (add group cases, keep alias cases)
**Modified module:** `constants.js` (COMMAND_HELP entries for new groups)
**Dependencies:** Independent — can parallelize with Phase 4
**Test impact:** CLI integration tests for renamed commands
**Optional:** Split features.js into domain modules (search.js, session.js)

### Phase 6: Performance Profiling & Optimization
**Dependencies:** Cache layer from Phases 1-3 must be complete
**Activity:** Run GSD_PROFILE=1 across all init commands, compare baselines
**Modified modules:** Any hot paths identified by profiling
**Produces:** `.planning/baselines/` comparison data

## Patterns to Follow

### Pattern 1: Lazy-Require with Graceful Degradation
**What:** Load `node:sqlite` only when first needed, fall back if unavailable
**When:** Any module that touches the cache
**Example:**
```javascript
function getCache(cwd) {
  if (_db && _cwd === cwd) return _db;
  try {
    const { DatabaseSync } = require('node:sqlite');
    // ... initialize
  } catch (e) {
    debugLog('cache.init', 'SQLite unavailable', e);
    return null; // Caller uses existing Map cache
  }
}
```
**Why:** Preserves backward compatibility with Node.js 18-21.

### Pattern 2: Mtime-Based Staleness (Not Hash-Based)
**What:** Check file mtime before reading from cache, skip hash computation
**When:** Every cached file read
**Why:** `fs.statSync()` is ~0.1ms vs `fs.readFileSync()` + SHA-256 at ~1-5ms. Mtime comparison is sufficient for a build tool (files don't change content without mtime changing in normal workflows).
**Exception:** Git operations can preserve mtime. For critical paths, store content hash as secondary validation.

### Pattern 3: Alias-Based Command Migration
**What:** New grouped commands + old names as aliases, never remove old names
**When:** Every command consolidation
**Example:**
```javascript
case 'config': { /* new grouped handler */ break; }
case 'config-set': { lazyMisc().cmdConfigSet(cwd, args[1], args[2], raw); break; } // alias
```
**Why:** Workflows, agent prompts, and user muscle memory reference old command names.

### Pattern 4: Module-Level Singleton Database
**What:** Single SQLite connection per process, cached in module scope
**When:** All cache access
**Why:** Opening a SQLite connection is ~2ms. The CLI runs for ~5 seconds max. One connection is sufficient. No need for connection pooling or cleanup — Node.js process exit closes it.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Caching Write-Through to Markdown
**What:** Generating markdown from SQLite data
**Why bad:** Markdown files are the authoritative source. If the cache generates markdown, you lose the human-editable, git-tracked source of truth.
**Instead:** Cache is READ-ONLY for markdown content. All writes go to filesystem first, then invalidate cache.

### Anti-Pattern 2: Replacing memory.json with SQLite
**What:** Migrating sacred stores (decisions, lessons, trajectories) to SQLite
**Why bad:** Sacred stores are human-readable JSON, designed for cross-session persistence with specific compaction/protection semantics. They're small files (< 100KB). Moving them to SQLite gains nothing and loses readability.
**Instead:** Keep memory.json stores as-is. Cache them for read performance if needed.

### Anti-Pattern 3: Caching Git Operations
**What:** Storing `execGit()` results in SQLite
**Why bad:** Git state changes between invocations (commits, branch switches). Cache invalidation for git data is complex and error-prone.
**Instead:** Git operations remain uncached. They're fast enough (< 50ms each) and always need to reflect current state.

### Anti-Pattern 4: Conditional Agent Logic
**What:** One agent with `if (mode === 'verify') ... else if (mode === 'integrate') ...`
**Why bad:** Agent system prompts are already large (500-1200 lines). Adding conditional branching makes them harder to maintain and increases token cost for the irrelevant branch.
**Instead:** When merging agents, integrate the methodology naturally (e.g., verifier gains "scope: phase | integration" parameter, not a mode switch).

### Anti-Pattern 5: Breaking Command Names
**What:** Renaming `config-set` to only `config set` without keeping the alias
**Why bad:** Every workflow .md file, every slash command wrapper, and every test references the old name. Breaking it cascades through 45+ files.
**Instead:** Always keep aliases. Old names are thin redirects.

## Scalability Considerations

| Concern | Current (v7.1) | v8.0 (cache) | At 100 phases |
|---|---|---|---|
| Init startup time | 15-25ms | 3-5ms (warm) | 50-100ms → 5-10ms |
| Cache DB size | N/A | ~1-5MB | ~10-20MB |
| File reads per invocation | 70+ | 2-5 (stat only) | 200+ → 10-15 |
| Agent count | 11 | 9 | 9 (cap at 12) |
| Router cases | ~54 | ~35 + aliases | Same (grouped) |
| Bundle size | 1058KB | ~1060KB (+2KB cache.js) | Same |

## Node.js Version Decision Matrix

| Option | Min Version | Flag Required | Native Addon | Bundle Impact | Risk |
|---|---|---|---|---|---|
| **`node:sqlite` (recommended)** | ≥22.5.0 | `--experimental-sqlite` on 22.x, none on 25+ | None | Zero | Version bump |
| `better-sqlite3` | ≥14 | None | Yes (.node file) | +200KB addon | Build complexity |
| Stay with Map cache | ≥18 | None | None | Zero | No cross-invocation benefit |
| `sql.js` (WASM) | ≥18 | None | None | +1.5MB WASM | Huge bundle bloat |

**Recommendation:** Use `node:sqlite` with a version bump to `"node": ">=22.5.0"`. The project runs on Node.js v25.7.0 in practice. The >=18 constraint is a formality that can be updated. If backward compat with Node 18-21 is critical, implement `cache.js` with graceful degradation (returns null, falls back to Map).

## File Change Summary

### New Files
| File | Purpose | Lines (est.) |
|---|---|---|
| `src/lib/cache.js` | SQLite cache layer | ~150-200 |

### Modified Files
| File | Change | Risk |
|---|---|---|
| `src/lib/helpers.js` | Wire cachedReadFile to two-layer cache | LOW |
| `src/lib/config.js` | Wire loadConfig to cache | LOW |
| `src/lib/context.js` | Update AGENT_MANIFESTS (remove integration-checker) | LOW |
| `src/commands/init.js` | Remove synthesizer_model from new-project/new-milestone | LOW |
| `src/router.js` | Add group cases, keep aliases | LOW |
| `src/lib/constants.js` | Add COMMAND_HELP for new groups | LOW |
| `package.json` | Bump engines.node to >=22.5.0 | MEDIUM |
| `build.js` | No changes needed | ZERO |

### Deleted Files
| File | Reason |
|---|---|
| `agents/gsd-integration-checker.md` | Merged into gsd-verifier |
| `agents/gsd-research-synthesizer.md` | Merged into gsd-roadmapper |

### Modified Agent Files
| File | Change |
|---|---|
| `agents/gsd-verifier.md` | Add cross-phase integration verification mode |
| `agents/gsd-roadmapper.md` | Add synthesis step before roadmap creation |

### Modified Workflow Files
| File | Change |
|---|---|
| `workflows/new-project.md` | Remove synthesizer spawn; roadmapper handles synthesis |
| `workflows/verify-work.md` | Add --integration mode option |
| `workflows/complete-milestone.md` | Use verifier with integration mode |

## Sources

- **Node.js v25.7.0 `node:sqlite`:** Verified working on target platform, synchronous API via `DatabaseSync`, no experimental flag needed on v25+
- **better-sqlite3 Context7 docs:** `/wiselibs/better-sqlite3` — synchronous API, native addon, nativeBinding path option (HIGH confidence)
- **Node.js official docs:** `node:sqlite` Stability 1.1 (Active Development) as of v22.x, with `--experimental-sqlite` flag
- **Existing codebase analysis:** Full read of router.js (947 lines), helpers.js (946 lines), context.js (389 lines), init.js (1400+ lines), memory.js (378 lines), codebase-intel.js (570 lines), config.js (76 lines), output.js (196 lines), profiler.js (116 lines), build.js (94 lines), all 11 agent definitions
- **Benchmarks:** Conducted on target platform — `node:sqlite` in-memory: 1000 reads in 2.9ms, 1000 inserts in 4.4ms, WAL mode file-based: 100 inserts in 1.9ms
