# Phase 52: Cache Integration & Warm-up - Research

**Researched:** 2026-03-02
**Domain:** Node.js CLI caching, SQLite persistence, performance optimization
**Confidence:** HIGH

## Summary

Phase 51 already implemented the core `CacheEngine` with SQLite/Map backends, `cachedReadFile` wrapper, and cache invalidation on writes. Phase 52 focuses on wiring the cache into all hot-path file readers, implementing the `cache warm` command to auto-discover `.planning/` files, adding `--no-cache` flag, and verifying test parity between cache-enabled and cache-disabled modes.

**Primary recommendation:** Implement auto-discovery in `cache warm` to find all `.planning/` files when no paths provided, add `--no-cache` flag to router, and systematically replace remaining `fs.readFileSync` calls with `cachedReadFile` in hot-path commands.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Mode**: Hybrid — auto-warm on first use, manual for full rebuild
- **Priority**: All `.planning/` files equally
- **Output**: Count of files + time taken
- **Auto-warm message**: Brief message like "Warming cache... X files"

### Agent's Discretion
- Exact hot-path file readers to wire (can be determined by profiling or code analysis)
- Test parity verification approach (run tests twice or use separate test suites)

### Deferred Ideas (OUT OF SCOPE)
- Cache analytics dashboard (CACHE-F03) — future phase
- Cross-project cache sharing (CACHE-F02) — future phase
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CACHE-05 | User can pre-populate cache via `cache warm` command after checkout or pull | Current `cache warm` requires explicit file paths; needs auto-discovery for all `.planning/` files |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node:sqlite | v22.5+ | SQLite cache backend | Built-in, no deps, per Phase 51 decision |
| node:fs | built-in | File system operations | Core Node.js |
| Map | built-in | L1 in-memory cache fallback | Core JavaScript, for Node <22.5 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| XDG_CONFIG_HOME | env var | Cache database location | Following convention per Phase 51 |

**Installation:** No additional packages — uses existing node:sqlite

## Architecture Patterns

### Project Structure
```
src/
├── lib/
│   ├── cache.js          # CacheEngine (already built in Phase 51)
│   ├── helpers.js        # cachedReadFile wrapper (already exists)
│   └── ...
├── commands/
│   ├── cache.js          # cache status/clear/warm commands
│   └── ...
└── router.js             # CLI entry point, needs --no-cache flag
```

### Pattern 1: Cache-Enabled File Reading
**What:** Use `cachedReadFile` instead of direct `fs.readFileSync`
**When to use:** For any file that is read multiple times during CLI invocation
**Example:**
```javascript
// Instead of:
const content = fs.readFileSync(filePath, 'utf-8');

// Use:
const { cachedReadFile } = require('../lib/helpers');
const content = cachedReadFile(filePath);
```

### Pattern 2: Cache Warm with Auto-Discovery
**What:** Discover all `.planning/` files when no paths provided
**When to use:** In `cache warm` command
**Example:**
```javascript
// In commands/cache.js - cmdCacheWarm
function cmdCacheWarm(cwd, args, raw) {
  const filePaths = args.slice(1);
  
  let resolvedPaths;
  if (filePaths.length === 0) {
    // Auto-discover all .planning/ files
    resolvedPaths = discoverPlanningFiles(cwd);
  } else {
    // Use provided paths
    resolvedPaths = filePaths.map(p => path.isAbsolute(p) ? p : path.join(cwd, p));
  }
  
  // ... warm cache and report timing
}
```

### Pattern 3: Cache Bypass Flag
**What:** Add `--no-cache` flag to force Map fallback
**When to use:** For test parity verification
**Example:**
```javascript
// In router.js - global flag parsing
const noCacheIdx = args.indexOf('--no-cache');
if (noCacheIdx !== -1) {
  process.env.GSD_CACHE_FORCE_MAP = '1';
  args.splice(noCacheIdx, 1);
}
```

### Anti-Patterns to Avoid
- **Direct fs.readFileSync in hot paths:** Many commands still use direct reads — should migrate to `cachedReadFile`
- **Silent cache failures:** Cache should fail silently with fallback, not crash (already implemented in Phase 51)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cache persistence | Custom file-based cache | node:sqlite | Already in Phase 51 |
| LRU eviction | Custom algorithm | Map insertion order / SQLite | Already implemented |
| mtime staleness check | Custom comparison | fs.statSync comparison | Already implemented |

**Key insight:** Cache infrastructure is complete from Phase 51. Phase 52 is about integration and usability.

## Common Pitfalls

### Pitfall 1: Incomplete Cache Wiring
**What goes wrong:** Some hot-path file readers still use direct `fs.readFileSync`, causing cache to provide minimal benefit
**Why it happens:** Many commands were written before cache existed, haven't been migrated
**How to avoid:** Identify hot-path commands (init, phase, verify) and systematically replace reads
**Warning signs:** Second invocation not noticeably faster than first

### Pitfall 2: Test Parity Failures
**What goes wrong:** Tests pass with cache but fail without (or vice versa)
**Why it happens:** Cache may mask file system state inconsistencies
**How to avoid:** Run full test suite with both `GSD_CACHE_FORCE_MAP=1` and without
**Warning signs:** Flaky tests that only fail intermittently

### Pitfall 3: Auto-warm Performance Hit
**What goes wrong:** Auto-warm on first read adds latency to every command
**Why it happens:** Warming happens synchronously before returning cached content
**How to avoid:** Use hybrid mode — manual warm for full rebuild, lazy populate on first read (already designed in CONTEXT.md)

## Code Examples

### Hot-Path Commands to Wire (Priority Order)
Based on grep analysis, these commands use direct `fs.readFileSync` extensively:

1. **phase.js** — 20+ direct reads, most critical
2. **init.js** — 8+ direct reads, used for execute-phase
3. **verify.js** — 6+ direct reads
4. **misc.js** — 15+ direct reads

### Verified Auto-Discovery Pattern
```javascript
// Discover all .planning/ files recursively
function discoverPlanningFiles(cwd) {
  const planningDir = path.join(cwd, '.planning');
  const files = [];
  
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath); // recurse
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }
  
  walk(planningDir);
  return files;
}
```

### Verified Timing Output Pattern
```javascript
// Report count and timing
const start = Date.now();
const warmed = cacheEngine.warm(resolvedPaths);
const elapsed = Date.now() - start;

output({ 
  warmed, 
  elapsed_ms: elapsed,
  files_per_sec: Math.round(warmed / (elapsed / 1000))
}, raw, `Warmed ${warmed} files in ${elapsed}ms`);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No caching | SQLite + Map L1/L2 | Phase 51 | Major speedup on repeated reads |
| Manual cache population | Auto-warm on first use | Phase 52 (this) | Transparent warming |
| env var only | env var + --no-cache flag | Phase 52 (this) | Easier testing |

**Deprecated/outdated:**
- None relevant to this phase

## Open Questions

1. **Which specific hot-path readers matter most?**
   - What we know: phase.js, init.js, verify.js have most direct reads
   - What's unclear: Which specific files are read most frequently during `init execute-phase`
   - Recommendation: Profile first to identify top 10 files, wire those first

2. **Should auto-warm happen on startup or lazily?**
   - What we know: CONTEXT.md specifies hybrid mode
   - What's unclear: Performance impact of lazy warming on first command
   - Recommendation: Lazy warming (on-demand) is simpler and matches "auto-warm on first use"

3. **How to measure "measurably faster" for success criteria #3?**
   - What we know: Need to compare first vs second invocation timing
   - What's unclear: What threshold constitutes "measurable" (10%? 50%?)
   - Recommendation: Report timing delta in verbose mode, let user judge

## Sources

### Primary (HIGH confidence)
- Existing code in `src/lib/cache.js` — CacheEngine implementation
- Existing code in `src/lib/helpers.js` — cachedReadFile wrapper
- CONTEXT.md — Phase 52 requirements and decisions

### Secondary (MEDIUM confidence)
- Node.js documentation for node:sqlite (Phase 51 research)
- XDG Base Directory Specification for config path

### Tertiary (LOW confidence)
- None needed — implementation details are in existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses existing Phase 51 implementation
- Architecture: HIGH - Clear pattern from existing code
- Pitfalls: MEDIUM - Based on grep analysis, may need validation

**Research date:** 2026-03-02
**Valid until:** 30 days (stable domain)
