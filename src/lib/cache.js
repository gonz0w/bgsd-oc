'use strict';

const fs = require('fs');
const path = require('path');

// Cache statistics - module level
const stats = { hits: 0, misses: 0 };

// Research cache statistics - module level
const researchStats = { hits: 0, misses: 0 };

/**
 * SQLite backend for persistent cache storage.
 * Uses node:sqlite (available in Node.js v22.5+) with optional statement caching.
 */
class SQLiteBackend {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 1000;
    this.ttl = options.ttl || 3600000;

    // Determine database path following XDG_CONFIG_HOME convention
    const configHome = process.env.XDG_CONFIG_HOME || path.join(process.env.HOME || '/root', '.config');
    const bgsdConfigDir = path.join(configHome, 'oc', 'bgsd-oc');
    this.dbPath = path.join(bgsdConfigDir, 'cache.db');

    // Ensure directory exists
    if (!fs.existsSync(bgsdConfigDir)) {
      fs.mkdirSync(bgsdConfigDir, { recursive: true });
    }

    // Initialize database
    const { DatabaseSync } = require('node:sqlite');
    this.db = new DatabaseSync(this.dbPath);
    this._initSchema();

    // Initialize statement cache if available and enabled
    this.statementCache = null;
    this._initStatementCache();
  }

  /**
   * Initialize statement caching using createTagStore().
   * The tag store uses template literal tags for cached prepared statements.
   */
  _initStatementCache() {
    const envValue = process.env.BGSD_SQLITE_STATEMENT_CACHE;
    
    // Default: enabled if not explicitly disabled, and Node >= 22.5
    let enabled = true;
    if (envValue === '0') {
      enabled = false;
    } else if (envValue === '1') {
      enabled = true;
    } else {
      // Default behavior: check Node version
      const nodeVersion = parseInt(process.version.slice(1).split('.')[0], 10);
      const nodeMinor = parseInt(process.version.split('.')[1], 10);
      enabled = nodeVersion > 22 || (nodeVersion === 22 && nodeMinor >= 5);
    }

    if (!enabled) {
      if (process.env.BGSD_DEBUG === '1') {
        console.log('[Cache] Statement caching disabled via BGSD_SQLITE_STATEMENT_CACHE');
      }
      return;
    }

    try {
      // Create tag store for statement caching
      this.statementCache = this.db.createTagStore();
      
      // Create helper functions that use the tag store with cached statements
      // The tag store caches prepared statements based on the SQL string
      this._cachedStatements = {
        // File cache operations
        getFile: (key) => this.statementCache.get`SELECT * FROM file_cache WHERE key = ${key}`,
        updateAccess: (accessed, key) => this.statementCache.run`UPDATE file_cache SET accessed = ${accessed} WHERE key = ${key}`,
        countFile: () => this.statementCache.get`SELECT COUNT(*) as cnt FROM file_cache`,
        getOldest: () => this.statementCache.get`SELECT key FROM file_cache ORDER BY accessed ASC LIMIT 1`,
        deleteFile: (key) => this.statementCache.run`DELETE FROM file_cache WHERE key = ${key}`,
        insertFile: (key, value, mtime, created, accessed) => 
          this.statementCache.run`INSERT OR REPLACE INTO file_cache (key, value, mtime, created, accessed) VALUES (${key}, ${value}, ${mtime}, ${created}, ${accessed})`,
        
        // Research cache operations
        getResearch: (key) => this.statementCache.get`SELECT * FROM research_cache WHERE key = ${key}`,
        deleteResearch: (key) => this.statementCache.run`DELETE FROM research_cache WHERE key = ${key}`,
        countResearch: () => this.statementCache.get`SELECT COUNT(*) as cnt FROM research_cache`,
        getOldestResearch: () => this.statementCache.get`SELECT key FROM research_cache ORDER BY accessed ASC LIMIT 1`,
        insertResearch: (key, value, created, accessed, expires) =>
          this.statementCache.run`INSERT OR REPLACE INTO research_cache (key, value, created, accessed, expires) VALUES (${key}, ${value}, ${created}, ${accessed}, ${expires})`,
        updateResearchAccess: (accessed, key) => this.statementCache.run`UPDATE research_cache SET accessed = ${accessed} WHERE key = ${key}`,
        
        // Clear operations
        clearFile: () => this.statementCache.run`DELETE FROM file_cache`,
        clearResearch: () => this.statementCache.run`DELETE FROM research_cache`,
      };

      if (process.env.BGSD_DEBUG === '1') {
        console.log('[Cache] Statement caching enabled via createTagStore()');
      }
    } catch (e) {
      // Fall back to regular prepare() if tag store creation fails
      this.statementCache = null;
      if (process.env.BGSD_DEBUG === '1') {
        console.log('[Cache] Statement caching unavailable:', e.message);
      }
    }
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
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS research_cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created REAL NOT NULL,
        accessed REAL NOT NULL,
        expires REAL NOT NULL
      )
    `);
  }

  /**
   * Get value from cache with staleness check.
   * Returns null if not found or stale.
   */
  get(key) {
    try {
      // Use cached statement if available, otherwise prepare new one
      const stmt = this._cachedStatements?.getFile || this.db.prepare('SELECT * FROM file_cache WHERE key = ?');
      const row = stmt.get(key);

      if (!row) {
        stats.misses++;
        return null;
      }

      // Check if stale by comparing mtime
      try {
        const fileStats = fs.statSync(key);
        if (fileStats.mtimeMs > row.mtime) {
          this.invalidate(key);
          stats.misses++;
          return null;
        }
      } catch (e) {
        // File doesn't exist or can't be accessed - treat as stale
        this.invalidate(key);
        stats.misses++;
        return null;
      }

      // Update access time - use cached statement if available
      if (this._cachedStatements?.updateAccess) {
        this._cachedStatements.updateAccess(Date.now(), key);
      } else {
        this.db.prepare('UPDATE file_cache SET accessed = ? WHERE key = ?')
          .run(Date.now(), key);
      }

      stats.hits++;
      return row.value;
    } catch (e) {
      stats.misses++;
      return null;
    }
  }

  /**
   * Set value in cache with LRU eviction.
   */
  set(key, value) {
    try {
      let mtime = Date.now();
      try {
        const fileStats = fs.statSync(key);
        mtime = fileStats.mtimeMs;
      } catch (e) {
        // File doesn't exist, use current time
      }

      const now = Date.now();

      // LRU eviction: remove oldest if at capacity - use cached statements if available
      const countResult = this._cachedStatements?.countFile 
        ? this._cachedStatements.countFile()
        : this.db.prepare('SELECT COUNT(*) as cnt FROM file_cache').get();
      if (countResult.cnt >= this.maxSize) {
        const oldest = this._cachedStatements?.getOldest 
          ? this._cachedStatements.getOldest()
          : this.db.prepare('SELECT key FROM file_cache ORDER BY accessed ASC LIMIT 1').get();
        if (oldest) {
          if (this._cachedStatements?.deleteFile) {
            this._cachedStatements.deleteFile(oldest.key);
          } else {
            this.db.prepare('DELETE FROM file_cache WHERE key = ?').run(oldest.key);
          }
        }
      }

      // Insert or replace - use cached statement if available
      if (this._cachedStatements?.insertFile) {
        this._cachedStatements.insertFile(key, value, mtime, now, now);
      } else {
        this.db.prepare(`
          INSERT OR REPLACE INTO file_cache (key, value, mtime, created, accessed)
          VALUES (?, ?, ?, ?, ?)
        `).run(key, value, mtime, now, now);
      }
    } catch (e) {
      // Silently fail on cache write errors
    }
  }

  /**
   * Invalidate a specific cache entry.
   */
  invalidate(key) {
    try {
      if (this._cachedStatements?.deleteFile) {
        this._cachedStatements.deleteFile(key);
      } else {
        this.db.prepare('DELETE FROM file_cache WHERE key = ?').run(key);
      }
    } catch (e) {
      // Silently fail
    }
  }

  /**
   * Clear all cache entries.
   */
  clear() {
    try {
      if (this._cachedStatements?.clearFile) {
        this._cachedStatements.clearFile();
      } else {
        this.db.prepare('DELETE FROM file_cache').run();
      }
    } catch (e) {
      // Silently fail
    }
  }

  /**
   * Get cache status.
   */
  status() {
    try {
      const countResult = this._cachedStatements?.countFile 
        ? this._cachedStatements.countFile()
        : this.db.prepare('SELECT COUNT(*) as cnt FROM file_cache').get();
      return {
        backend: 'SQLite',
        count: countResult.cnt,
        hits: stats.hits,
        misses: stats.misses,
        dbPath: this.dbPath,
        statementCache: this.statementCache !== null
      };
    } catch (e) {
      return {
        backend: 'SQLite',
        count: 0,
        hits: stats.hits,
        misses: stats.misses,
        error: e.message,
        statementCache: false
      };
    }
  }

  /**
   * Warm cache with files.
   */
  warm(files) {
    let warmed = 0;
    for (const filePath of files) {
      try {
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          this.set(filePath, content);
          warmed++;
        }
      } catch (e) {
        // Skip files that can't be read
      }
    }
    return warmed;
  }

  /**
   * Get research result from cache.
   * Returns null if not found or expired.
   */
  getResearch(key) {
    try {
      const row = this._cachedStatements?.getResearch 
        ? this._cachedStatements.getResearch(key)
        : this.db.prepare('SELECT * FROM research_cache WHERE key = ?').get(key);

      if (!row) {
        researchStats.misses++;
        return null;
      }

      // Check TTL expiry
      if (Date.now() > row.expires) {
        if (this._cachedStatements?.deleteResearch) {
          this._cachedStatements.deleteResearch(key);
        } else {
          this.db.prepare('DELETE FROM research_cache WHERE key = ?').run(key);
        }
        researchStats.misses++;
        return null;
      }

      // Update access time - use cached statement if available
      if (this._cachedStatements?.updateResearchAccess) {
        this._cachedStatements.updateResearchAccess(Date.now(), key);
      } else {
        this.db.prepare('UPDATE research_cache SET accessed = ? WHERE key = ?')
          .run(Date.now(), key);
      }

      researchStats.hits++;
      return JSON.parse(row.value);
    } catch (e) {
      researchStats.misses++;
      return null;
    }
  }

  /**
   * Set research result in cache with TTL and LRU eviction.
   */
  setResearch(key, value, ttlMs = 3600000) {
    try {
      const serialized = JSON.stringify(value);
      const now = Date.now();

      // LRU eviction: remove oldest if at capacity - use cached statements if available
      const countResult = this._cachedStatements?.countResearch
        ? this._cachedStatements.countResearch()
        : this.db.prepare('SELECT COUNT(*) as cnt FROM research_cache').get();
      if (countResult.cnt >= this.maxSize) {
        const oldest = this._cachedStatements?.getOldestResearch
          ? this._cachedStatements.getOldestResearch()
          : this.db.prepare('SELECT key FROM research_cache ORDER BY accessed ASC LIMIT 1').get();
        if (oldest) {
          if (this._cachedStatements?.deleteResearch) {
            this._cachedStatements.deleteResearch(oldest.key);
          } else {
            this.db.prepare('DELETE FROM research_cache WHERE key = ?').run(oldest.key);
          }
        }
      }

      // Insert or replace - use cached statement if available
      if (this._cachedStatements?.insertResearch) {
        this._cachedStatements.insertResearch(key, serialized, now, now, now + ttlMs);
      } else {
        this.db.prepare(`
          INSERT OR REPLACE INTO research_cache (key, value, created, accessed, expires)
          VALUES (?, ?, ?, ?, ?)
        `).run(key, serialized, now, now, now + ttlMs);
      }
    } catch (e) {
      // Silently fail on cache write errors
    }
  }

  /**
   * Clear all research cache entries.
   */
  clearResearch() {
    try {
      if (this._cachedStatements?.clearResearch) {
        this._cachedStatements.clearResearch();
      } else {
        this.db.prepare('DELETE FROM research_cache').run();
      }
    } catch (e) {
      // Silently fail
    }
  }

  /**
   * Get research cache status.
   */
  statusResearch() {
    try {
      const countResult = this._cachedStatements?.countResearch
        ? this._cachedStatements.countResearch()
        : this.db.prepare('SELECT COUNT(*) as cnt FROM research_cache').get();
      return {
        count: countResult.cnt,
        hits: researchStats.hits,
        misses: researchStats.misses,
      };
    } catch (e) {
      return { count: 0, hits: researchStats.hits, misses: researchStats.misses };
    }
  }
}

/**
 * In-memory Map backend for Node <22.5 or forced fallback.
 * Provides LRU eviction via Map insertion order.
 */
class MapBackend {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 1000;
    this.ttl = options.ttl || 3600000;
    this.cache = new Map();
    this.researchMap = new Map();
  }

  /**
   * Get value from cache with staleness check.
   * Returns null if not found or stale.
   */
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      stats.misses++;
      return null;
    }

    // Check if stale by comparing mtime
    try {
      const fileStats = fs.statSync(key);
      if (fileStats.mtimeMs > entry.mtime) {
        this.cache.delete(key);
        stats.misses++;
        return null;
      }
    } catch (e) {
      // File doesn't exist or can't be accessed
      this.cache.delete(key);
      stats.misses++;
      return null;
    }

    // Update access order (delete and re-insert for LRU)
    const value = entry.value;
    this.cache.delete(key);
    this.cache.set(key, {
      value,
      mtime: entry.mtime,
      created: entry.created,
      accessed: Date.now()
    });

    stats.hits++;
    return value;
  }

  /**
   * Set value in cache with LRU eviction.
   */
  set(key, value) {
    // Get current mtime if file exists
    let mtime = Date.now();
    try {
      const fileStats = fs.statSync(key);
      mtime = fileStats.mtimeMs;
    } catch (e) {
      // File doesn't exist, use current time
    }

    const now = Date.now();

    // If key exists, remove it first (will be re-added)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // LRU eviction: remove oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      mtime,
      created: now,
      accessed: now
    });
  }

  /**
   * Invalidate a specific cache entry.
   */
  invalidate(key) {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries.
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache status.
   */
  status() {
    return {
      backend: 'Map',
      count: this.cache.size,
      hits: stats.hits,
      misses: stats.misses,
      maxSize: this.maxSize
    };
  }

  /**
   * Warm cache with files.
   */
  warm(files) {
    let warmed = 0;
    for (const filePath of files) {
      try {
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          this.set(filePath, content);
          warmed++;
        }
      } catch (e) {
        // Skip files that can't be read
      }
    }
    return warmed;
  }

  /**
   * Get research result from cache.
   * Returns null if not found or expired.
   */
  getResearch(key) {
    const entry = this.researchMap.get(key);
    if (!entry) {
      researchStats.misses++;
      return null;
    }

    // Check TTL expiry
    if (Date.now() > entry.expires) {
      this.researchMap.delete(key);
      researchStats.misses++;
      return null;
    }

    // LRU re-insert (delete + set to maintain insertion order)
    this.researchMap.delete(key);
    this.researchMap.set(key, { ...entry, accessed: Date.now() });

    researchStats.hits++;
    return JSON.parse(entry.value);
  }

  /**
   * Set research result in cache with TTL and LRU eviction.
   */
  setResearch(key, value, ttlMs = 3600000) {
    const now = Date.now();

    // Remove if already exists (to update LRU order)
    if (this.researchMap.has(key)) {
      this.researchMap.delete(key);
    }

    // LRU eviction at maxSize
    if (this.researchMap.size >= this.maxSize) {
      const oldestKey = this.researchMap.keys().next().value;
      if (oldestKey) {
        this.researchMap.delete(oldestKey);
      }
    }

    this.researchMap.set(key, {
      value: JSON.stringify(value),
      created: now,
      accessed: now,
      expires: now + ttlMs,
    });
  }

  /**
   * Clear all research cache entries.
   */
  clearResearch() {
    this.researchMap.clear();
  }

  /**
   * Get research cache status.
   */
  statusResearch() {
    return {
      count: this.researchMap.size,
      hits: researchStats.hits,
      misses: researchStats.misses,
    };
  }
}

/**
 * CacheEngine - Main cache class with backend selection.
 * Provides a unified interface for SQLite and Map backends.
 */
class CacheEngine {
  /**
   * Create a new CacheEngine instance.
   * @param {Object} options - Configuration options
   * @param {number} options.maxSize - Maximum cache entries (default: 1000)
   * @param {number} options.ttl - Time to live in ms (default: 3600000 = 1 hour)
   */
  constructor(options = {}) {
    this.maxSize = options.maxSize || 1000;
    this.ttl = options.ttl || 3600000;
    this.backend = this._selectBackend();
  }

  /**
   * Select the appropriate backend based on Node version and environment.
   */
  _selectBackend() {
    // Check environment variable first - force Map fallback
    if (process.env.BGSD_CACHE_FORCE_MAP === '1') {
      return new MapBackend({ maxSize: this.maxSize, ttl: this.ttl });
    }

    // Check Node version for SQLite availability
    const nodeVersion = parseInt(process.version.slice(1).split('.')[0], 10);
    const nodeMinor = parseInt(process.version.split('.')[1], 10);

    // node:sqlite available in v22.5+
    const supportsSQLite = nodeVersion > 22 || (nodeVersion === 22 && nodeMinor >= 5);

    if (supportsSQLite) {
      try {
        return new SQLiteBackend({ maxSize: this.maxSize, ttl: this.ttl });
      } catch (e) {
        // SQLite failed to initialize, fall back to Map
        return new MapBackend({ maxSize: this.maxSize, ttl: this.ttl });
      }
    }

    // Node < 22.5 - use Map fallback
    return new MapBackend({ maxSize: this.maxSize, ttl: this.ttl });
  }

  /**
   * Get value from cache.
   * @param {string} key - Cache key (typically file path)
   * @returns {string|null} Cached value or null if not found/stale
   */
  get(key) {
    return this.backend.get(key);
  }

  /**
   * Set value in cache.
   * @param {string} key - Cache key (typically file path)
   * @param {string} value - Value to cache
   */
  set(key, value) {
    this.backend.set(key, value);
  }

  /**
   * Invalidate a specific cache entry.
   * @param {string} key - Cache key to invalidate
   */
  invalidate(key) {
    this.backend.invalidate(key);
  }

  /**
   * Clear all cache entries.
   */
  clear() {
    this.backend.clear();
  }

  /**
   * Get cache status information.
   * @returns {Object} Status object with backend type, count, and stats
   */
  status() {
    return this.backend.status();
  }

  /**
   * Warm cache with files.
   * @param {string[]} files - Array of file paths to cache
   * @returns {number} Number of files warmed
   */
  warm(files) {
    return this.backend.warm(files);
  }

  /**
   * Get research result from cache.
   * @param {string} key - Cache key (query string)
   * @returns {object|null} Cached research result or null
   */
  getResearch(key) {
    return this.backend.getResearch(key);
  }

  /**
   * Set research result in cache.
   * @param {string} key - Cache key (query string)
   * @param {object} value - Research result to cache
   * @param {number} [ttlMs] - TTL in milliseconds (default: 1 hour)
   */
  setResearch(key, value, ttlMs) {
    this.backend.setResearch(key, value, ttlMs);
  }

  /**
   * Clear all research cache entries.
   */
  clearResearch() {
    this.backend.clearResearch();
  }

  /**
   * Get research cache status.
   * @returns {{ count: number, hits: number, misses: number }}
   */
  statusResearch() {
    return this.backend.statusResearch();
  }
}

module.exports = { CacheEngine };
