# Phase 51: Cache Foundation - Research

**Researched:** 2026-03-02
**Domain:** Node.js SQLite persistent caching, file staleness detection
**Confidence:** HIGH

## Summary

Phase 51 implements persistent read caching for the bGSD plugin using `node:sqlite` (available in Node.js v22.5+), with graceful fallback to in-memory Map for older Node versions. The cache validates freshness via mtime comparison on every read, providing transparent consistency. This is a foundational module that creates a cache interface to be wired into hot paths in Phase 52.

**Primary recommendation:** Use `node:sqlite` with `DatabaseSync` API, implement LRU eviction with configurable TTL, and create transparent Map fallback for Node <22.5 that requires zero code changes from callers.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- CLI commands: `gsd-tools cache status`, `gsd-tools cache clear`, `gsd-tools cache warm`
- `cache status` reports: backend type (SQLite vs Map fallback), entry count, hit/miss statistics, memory usage
- No config option to disable cache — always active
- Cache warm-up: both manual (`gsd-tools cache warm`) and automatic (lazy on first read)
- Staleness detection: combination of file modification + TTL
- File change detection: check mtime on every read (stat + mtime comparison)
- Maximum cache size: configurable, default 1000 entries (LRU eviction)
- Manual invalidation: `gsd-tools cache clear` clears all entries
- Node version detection: check `process.version` at runtime
- When SQLite unavailable: use in-memory Map as transparent fallback
- Startup logging: warn when SQLite unavailable, using Map fallback
- Force Map fallback: environment variable `GSD_CACHE_FORCE_MAP=1`
- Write-through invalidation: immediately invalidate cache entry when file is written via gsd-tools
- External change detection: check mtime on every read
- Consistency model: last-write-wins
- No checksum verification — trust filesystem

### Agent's Discretion
- Exact TTL value (e.g., 1 hour default)
- LRU eviction implementation details
- Memory usage reporting format
- Warning message wording

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope

---

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CACHE-01 | SQLite read cache module persists parsed data across CLI invocations using `node:sqlite` (DatabaseSync) | node:sqlite provides synchronous DatabaseSync API for persistent storage; can store file path → content mappings |
| CACHE-02 | Cache validates freshness via mtime on every read, re-parses on stale | fs.statSync() provides mtime; comparing mtime on each read detects external changes |
| CACHE-03 | Any file write through gsd-tools invalidates the corresponding cache entry | Modify existing invalidateFileCache() to also clear SQLite entry |
| CACHE-04 | Cache gracefully degrades to in-memory Map on Node <22.5 (no crashes, no warnings) | Check process.version; node:sqlite only available in v22.5+ |

</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node:sqlite | built-in (v22.5+) | Persistent SQLite cache | Native Node.js module, no external dependencies, synchronous API matches CLI paradigm |
| node:fs | built-in | mtime stat for staleness detection | Required for file modification detection |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| In-memory Map | built-in | Fallback cache for Node <22.5 | When node:sqlite unavailable or GSD_CACHE_FORCE_MAP=1 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| node:sqlite | better-sqlite3 | better-sqlite3 requires native addon, breaks single-file deploy; node:sqlite is built-in |
| node:sqlite | sql.js (WASM) | sql.js is async and adds ~500KB; node:sqlite is synchronous and built-in |
| Map fallback | No fallback | Would break Node <22.5; graceful degradation is requirement |

---

## Architecture Patterns

### Recommended Module Structure
```
src/lib/
├── cache.js          # Cache module (new file)
│   ├── CacheEngine  # Class: handles SQLite/Map backend selection
│   ├── get(key)     # Read with staleness check
│   ├── set(key, val, mtime)  # Write with mtime tracking
│   ├── invalidate(key)       # Remove entry
│   ├── clear()      # Clear all entries
│   ├── warm(files)  # Pre-populate cache
│   └── status()     # Get cache statistics
```

### Pattern 1: Cache Engine with Backend Selection
**What:** Abstraction layer that selects SQLite or Map based on Node version
**When to use:** Always — this is the core pattern
**Example:**
```javascript
// Source: Context7 node:sqlite + Node.js docs
const sqlite = require('node:sqlite');
const fs = require('node:fs');

class CacheEngine {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 1000;
    this.ttl = options.ttl || 3600000; // 1 hour default
    this.backend = this._selectBackend();
  }

  _selectBackend() {
    // Check environment variable first
    if (process.env.GSD_CACHE_FORCE_MAP === '1') {
      console.warn('[cache] GSD_CACHE_FORCE_MAP=1, using Map fallback');
      return new MapFallback();
    }

    // Check Node version for SQLite availability
    const nodeVersion = parseInt(process.version.slice(1).split('.')[0], 10);
    const nodeMinor = parseInt(process.version.split('.')[1], 10);
    
    // node:sqlite available in v22.5+
    if (nodeVersion > 22 || (nodeVersion === 22 && nodeMinor >= 5)) {
      try {
        return new SQLiteBackend(this.maxSize);
      } catch (e) {
        console.warn('[cache] SQLite unavailable, using Map fallback:', e.message);
        return new MapFallback();
      }
    }
    
    console.warn('[cache] Node <22.5, using Map fallback');
    return new MapFallback();
  }
}
```

### Pattern 2: Staleness Detection with mtime
**What:** Check file modification time on every read to detect external changes
**When to use:** Every cache read
**Example:**
```javascript
// Source: Node.js fs documentation
function isStale(cachedMtime, filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.mtimeMs > cachedMtime;
  } catch (e) {
    return true; // File doesn't exist = stale
  }
}
```

### Pattern 3: LRU Eviction
**What:** When cache reaches max size, remove least recently used entry
**When to use:** On cache set when at capacity
**Example:**
```javascript
// Source: Common LRU pattern for Map
class MapBackend {
  constructor(maxSize = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  set(key, value, mtime) {
    // If key exists, delete to update order
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, { value, mtime, accessed: Date.now() });
  }
}
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQLite database | Custom file format | node:sqlite | Built-in, well-tested, handles concurrency |
| Cache eviction | Complex algorithms | Simple LRU with Map | 1000 entries is small; Map maintains insertion order |
| Persistent storage | JSON files | node:sqlite | Atomic writes, concurrent safety, queryable |

**Key insight:** node:sqlite is the standard Node.js solution for synchronous SQLite operations. Building a custom file-based cache risks corruption and doesn't provide the same atomicity guarantees.

---

## Common Pitfalls

### Pitfall 1: node:sqlite Import in CommonJS
**What goes wrong:** `require('sqlite')` fails — module requires `node:` prefix
**Why it happens:** node:sqlite must be imported with `require('node:sqlite')` per Node.js docs
**How to avoid:** Always use `require('node:sqlite')` — the `node:` prefix is mandatory
**Warning signs:** `ERR_REQUIRE_ESM` or module not found errors

### Pitfall 2: Not Checking Node Version
**What goes wrong:** Crashes on Node <22.5 when node:sqlite doesn't exist
**Why it happens:** node:sqlite was introduced in v22.5.0
**How to avoid:** Check `process.version` before attempting to import/use node:sqlite
**Warning signs:** Module import errors on older Node versions

### Pitfall 3: Stale Cache on External Write
**What goes wrong:** Cache returns old content after file is modified externally
**Why it happens:** Not checking mtime on read — only checking on write
**How to avoid:** Always validate mtime on every cache read
**Warning signs:** Tests pass but users see stale content after git pull

### Pitfall 4: Blocking Event Loop
**What goes wrong:** Large cache operations freeze CLI responsiveness
**Why it happens:** DatabaseSync is synchronous and blocks
**How to avoid:** Keep cache operations small; this is acceptable for CLI since operations are <5ms typically
**Warning signs:** Commands hang during cache warm-up with many files

---

## Code Examples

### SQLite Backend Implementation
```javascript
// Source: Context7 node:sqlite documentation
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('path');

class SQLiteBackend {
  constructor(maxSize = 1000) {
    const dbPath = path.join(process.env.XDG_CONFIG_HOME || 
                      path.join(process.env.HOME, '.config'), 
                      'oc', 'get-shit-done', 'cache.db');
    
    // Ensure directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    this.db = new DatabaseSync(dbPath);
    this._initSchema();
    this.maxSize = maxSize;
    this.stats = { hits: 0, misses: 0 };
  }

  _initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS file_cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        mtime REAL NOT NULL,
        created REAL NOT NULL,
        accessed REAL NOT NULL
      )
    `);
  }

  get(key) {
    const stmt = this.db.prepare('SELECT * FROM file_cache WHERE key = ?');
    const row = stmt.get(key);
    
    if (!row) {
      this.stats.misses++;
      return null;
    }
    
    // Check if stale by mtime
    try {
      const stats = fs.statSync(key);
      if (stats.mtimeMs > row.mtime) {
        this.invalidate(key);
        this.stats.misses++;
        return null;
      }
    } catch (e) {
      this.invalidate(key);
      this.stats.misses++;
      return null;
    }
    
    // Update access time
    this.db.prepare('UPDATE file_cache SET accessed = ? WHERE key = ?')
      .run(Date.now(), key);
    
    this.stats.hits++;
    return row.value;
  }

  set(key, value) {
    const mtime = fs.statSync(key).mtimeMs;
    const now = Date.now();
    
    // LRU eviction
    const count = this.db.prepare('SELECT COUNT(*) as cnt FROM file_cache').get().cnt;
    if (count >= this.maxSize) {
      const oldest = this.db.prepare(
        'SELECT key FROM file_cache ORDER BY accessed ASC LIMIT 1'
      ).get();
      if (oldest) {
        this.db.prepare('DELETE FROM file_cache WHERE key = ?').run(oldest.key);
      }
    }
    
    this.db.prepare(`
      INSERT OR REPLACE INTO file_cache (key, value, mtime, created, accessed)
      VALUES (?, ?, ?, ?, ?)
    `).run(key, value, mtime, now, now);
  }

  invalidate(key) {
    this.db.prepare('DELETE FROM file_cache WHERE key = ?').run(key);
  }

  clear() {
    this.db.prepare('DELETE FROM file_cache').run();
  }

  status() {
    const count = this.db.prepare('SELECT COUNT(*) as cnt FROM file_cache').get().cnt;
    return { type: 'SQLite', count, ...this.stats };
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| In-memory Map (single invocation) | Persistent SQLite + Map fallback | v8.0 Phase 51 | Cache survives CLI invocations |
| No staleness detection | mtime-based validation | v8.0 Phase 51 | Fresh content after external changes |
| No warm-up | Manual + auto warm-up | v8.0 Phase 51 | Fast first-read after checkout |

**Deprecated/outdated:**
- better-sqlite3: Requires native compilation, breaks single-file deploy
- sql.js: WASM-based, async-only, adds significant bundle size

---

## Open Questions

1. **Cache database location**
   - What we know: Should be in XDG_CONFIG_HOME or ~/.config
   - What's unclear: Should it be per-project or global?
   - Recommendation: Global is simpler; per-project adds complexity but isolation. CONTEXT.md implies global (no per-project config option).

2. **TTL default value**
   - What we know: Agent's discretion — recommendation is 1 hour
   - What's unclear: Is 1 hour optimal for CLI usage patterns?
   - Recommendation: Default to 1 hour, allow config override

3. **Memory usage reporting for SQLite**
   - What we know: Need to report "memory usage" but SQLite uses file-based storage
   - What's unclear: Should we report file size or estimate in-memory pages?
   - Recommendation: Report database file size as proxy for memory usage

---

## Sources

### Primary (HIGH confidence)
- Context7 /nodejs/node - node:sqlite DatabaseSync API documentation
- Node.js official docs - https://github.com/nodejs/node/blob/main/doc/api/sqlite.md

### Secondary (MEDIUM confidence)
- Existing cachedReadFile implementation in src/lib/helpers.js (understanding current architecture)

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH - node:sqlite is well-documented, stable API
- Architecture: HIGH - Clear pattern from existing code + node:sqlite docs
- Pitfalls: HIGH - All identified pitfalls are documented in Node.js docs

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (30 days — Node.js APIs are stable)
