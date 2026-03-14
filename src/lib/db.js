'use strict';

/**
 * Dual-backend database abstraction layer for bGSD project-local storage.
 *
 * Provides a reliable, version-managed SQLite database at `.planning/.cache.db`
 * with automatic schema migrations and transparent Map fallback on Node <22.5.
 *
 * Usage:
 *   const { getDb, closeAll, hasSQLiteSupport } = require('./lib/db');
 *   const db = getDb(process.cwd());
 *   console.log(db.backend); // 'sqlite' | 'map'
 *
 * Design principles:
 *   - Zero external dependencies — only node:sqlite (built-in), fs, path
 *   - CJS module (bundled into bgsd-tools.cjs)
 *   - Both backends expose identical public interface
 *   - Migration failures trigger delete-and-rebuild (it's just a cache)
 *   - Notices array accumulates status messages for the plugin to drain
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Warn if .cache.db exceeds this size in bytes (50 MB) */
const DB_SIZE_WARN_BYTES = 50 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Feature detection
// ---------------------------------------------------------------------------

/**
 * Detect whether node:sqlite is available on this runtime.
 *
 * Uses a dual approach for consistency with the existing codebase:
 *   1. Fast path: version check (Node <22.5 cannot have node:sqlite)
 *   2. Verification: try { require('node:sqlite') } — catches custom builds,
 *      flags, or runtimes (Bun) that don't support it despite the version
 *
 * @returns {boolean}
 */
function hasSQLiteSupport() {
  // Fast path: parse process.version
  const match = process.version.replace(/^v/, '').match(/^(\d+)\.(\d+)/);
  if (match) {
    const major = parseInt(match[1], 10);
    const minor = parseInt(match[2], 10);
    if (major < 22 || (major === 22 && minor < 5)) {
      return false;
    }
  }

  // Verification: actual require
  try {
    require('node:sqlite');
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Schema migrations
// ---------------------------------------------------------------------------

/**
 * MIGRATIONS array — indexed by version number (0-based).
 * MIGRATIONS[0] upgrades schema from version 0 → 1.
 * Future phases append to this array.
 *
 * Each migration function receives the raw DatabaseSync instance.
 */
const MIGRATIONS = [
  // Version 1: Phase 118 foundation — minimal schema to verify migration system
  function migration_v1(rawDb) {
    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS _meta (
        key   TEXT PRIMARY KEY,
        value TEXT
      )
    `);
    // Use a prepared statement so we can parameterize the timestamp
    const stmt = rawDb.prepare(
      "INSERT OR REPLACE INTO _meta (key, value) VALUES ('created_at', ?)"
    );
    stmt.run(new Date().toISOString());
  },
];

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Run forward schema migrations on a SQLiteDatabase instance.
 * Migrations run inside explicit transactions for atomicity.
 * On any failure, calls _deleteAndRebuild().
 *
 * @param {SQLiteDatabase} dbInstance
 */
function _runMigrations(dbInstance) {
  let currentVersion;
  try {
    currentVersion = dbInstance.getSchemaVersion();
  } catch (e) {
    // Cannot read version — treat as uninitialized
    currentVersion = 0;
  }

  const targetVersion = MIGRATIONS.length;
  if (currentVersion >= targetVersion) {
    return; // Already up to date
  }

  for (let i = currentVersion; i < targetVersion; i++) {
    try {
      dbInstance.exec('BEGIN');
      MIGRATIONS[i](dbInstance._db);

      // PRAGMA user_version inside a transaction — verified to work in modern
      // SQLite. If it fails here, we catch and ROLLBACK then rebuild.
      dbInstance.exec('PRAGMA user_version = ' + (i + 1));
      dbInstance.exec('COMMIT');
    } catch (e) {
      try {
        dbInstance.exec('ROLLBACK');
      } catch {
        // ROLLBACK may fail if BEGIN never succeeded — ignore
      }
      // Migration failed → delete and rebuild from scratch
      _deleteAndRebuild(dbInstance);
      return;
    }
  }
}

/**
 * Delete the database files and re-open + re-migrate from scratch.
 * If rebuild also fails, sets dbInstance._degraded = true so getDb() can
 * swap to a MapDatabase.
 *
 * @param {SQLiteDatabase} dbInstance
 */
function _deleteAndRebuild(dbInstance) {
  const dbPath = dbInstance._dbPath;

  // Close the current connection
  try {
    dbInstance._db.close();
  } catch {
    // Ignore close errors
  }

  // Delete the database file and WAL/SHM companions
  for (const suffix of ['', '-wal', '-shm']) {
    const filePath = dbPath + suffix;
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // If we can't delete, the rebuild will likely fail too — continue
      }
    }
  }

  // Re-open and re-run all migrations from scratch
  try {
    const { DatabaseSync } = require('node:sqlite');
    dbInstance._db = _openSQLiteDb(DatabaseSync, dbPath);
    _runMigrations(dbInstance);
  } catch {
    // Rebuild failed — mark as degraded (caller will switch to MapDatabase)
    dbInstance._degraded = true;
  }
}

/**
 * Open a DatabaseSync connection with WAL mode and busy_timeout.
 * Handles the constructor `timeout` option availability difference:
 *   - Node ≥22.16 / ≥24.0: supports { timeout: N } constructor option
 *   - Node 22.5–22.15: must use PRAGMA busy_timeout after construction
 *
 * Also handles Node 25.5+ defensive mode default.
 *
 * @param {typeof import('node:sqlite').DatabaseSync} DatabaseSync
 * @param {string} dbPath
 * @returns {import('node:sqlite').DatabaseSync}
 */
function _openSQLiteDb(DatabaseSync, dbPath) {
  let rawDb;

  // Try constructor with timeout option (Node ≥22.16/24.0)
  // Also explicitly set defensive: false for Node ≥25.5 where default is true,
  // since we need full schema control for PRAGMA user_version migrations.
  try {
    rawDb = new DatabaseSync(dbPath, { timeout: 5000, defensive: false });
  } catch {
    // Fallback: constructor without options (Node 22.5–22.15)
    // Or fallback without defensive option (older Node that doesn't recognize it)
    try {
      rawDb = new DatabaseSync(dbPath, { timeout: 5000 });
    } catch {
      // Last resort: plain constructor
      rawDb = new DatabaseSync(dbPath);
    }
  }

  // Set busy_timeout via PRAGMA as well (belt-and-suspenders for older Node)
  try {
    rawDb.exec('PRAGMA busy_timeout = 5000');
  } catch {
    // Not critical — constructor timeout may already be set
  }

  // Enable WAL mode for concurrent read/write access
  rawDb.exec('PRAGMA journal_mode = WAL');

  return rawDb;
}

// ---------------------------------------------------------------------------
// SQLiteDatabase class
// ---------------------------------------------------------------------------

/**
 * SQLite backend — project-local database at `.planning/.cache.db`.
 * Requires Node.js 22.5+ with node:sqlite built-in.
 */
class SQLiteDatabase {
  /**
   * @param {string} dbPath - Absolute path to .planning/.cache.db
   */
  constructor(dbPath) {
    this._dbPath = dbPath;
    this._backend = 'sqlite';
    this._notices = [];
    this._degraded = false;

    const { DatabaseSync } = require('node:sqlite');
    this._db = _openSQLiteDb(DatabaseSync, dbPath);

    // Run schema migrations
    _runMigrations(this);

    // Verify WAL mode took effect
    try {
      const modeResult = this._db.prepare('PRAGMA journal_mode').get();
      if (modeResult && modeResult.journal_mode !== 'wal') {
        this._notices.push('WAL mode not active — using ' + modeResult.journal_mode);
      }
    } catch {
      // Non-critical verification
    }

    // Verify busy_timeout
    try {
      const btResult = this._db.prepare('PRAGMA busy_timeout').get();
      if (btResult && btResult.busy_timeout !== 5000) {
        // Re-apply via PRAGMA if constructor didn't take
        this._db.exec('PRAGMA busy_timeout = 5000');
      }
    } catch {
      // Non-critical
    }

    // DB size monitoring (soft limit with warning)
    this._checkSize();
  }

  /** @returns {'sqlite'} */
  get backend() {
    return 'sqlite';
  }

  /** @returns {string} Absolute path to the .cache.db file */
  get dbPath() {
    return this._dbPath;
  }

  /**
   * Drain accumulated notices.
   * @returns {string[]} Notice messages (cleared after read)
   */
  get notices() {
    const n = this._notices.slice();
    this._notices = [];
    return n;
  }

  /**
   * Read the current schema version from PRAGMA user_version.
   * @returns {number}
   */
  getSchemaVersion() {
    const result = this._db.prepare('PRAGMA user_version').get();
    return result ? result.user_version : 0;
  }

  /**
   * Execute raw SQL (no return value).
   * @param {string} sql
   */
  exec(sql) {
    this._db.exec(sql);
  }

  /**
   * Prepare a SQL statement.
   * @param {string} sql
   * @returns {import('node:sqlite').StatementSync}
   */
  prepare(sql) {
    return this._db.prepare(sql);
  }

  /**
   * Close the database connection.
   */
  close() {
    try {
      this._db.close();
    } catch {
      // Ignore errors on close
    }
  }

  /**
   * Check the database file size and add a notice if over the soft limit.
   * @private
   */
  _checkSize() {
    try {
      const stat = fs.statSync(this._dbPath);
      if (stat.size > DB_SIZE_WARN_BYTES) {
        this._notices.push(
          'Cache database exceeds 50MB — consider running cache:clear'
        );
      }
    } catch {
      // File may not exist yet on first open — ignore
    }
  }
}

// ---------------------------------------------------------------------------
// MapDatabase class
// ---------------------------------------------------------------------------

/**
 * In-memory Map backend — transparent fallback on Node <22.5.
 * Implements the same public interface as SQLiteDatabase.
 * All data is ephemeral — rebuilt each CLI session.
 */
class MapDatabase {
  constructor() {
    this._stores = new Map();
    this._version = 0;
    this._backend = 'map';
    this._dbPath = null;
    this._notices = ['Using in-memory cache (SQLite unavailable)'];
  }

  /** @returns {'map'} */
  get backend() {
    return 'map';
  }

  /** @returns {null} */
  get dbPath() {
    return null;
  }

  /**
   * Drain accumulated notices.
   * @returns {string[]} Notice messages (cleared after read)
   */
  get notices() {
    const n = this._notices.slice();
    this._notices = [];
    return n;
  }

  /**
   * Return the simulated schema version.
   * @returns {number}
   */
  getSchemaVersion() {
    return this._version;
  }

  /**
   * No-op — Map backend does not execute SQL.
   * @param {string} _sql
   */
  exec(_sql) {
    // no-op
  }

  /**
   * Return a stub statement object with the same interface as StatementSync.
   * @param {string} _sql
   * @returns {{ get: function(): undefined, all: function(): [], run: function(): {changes: number} }}
   */
  prepare(_sql) {
    return {
      get: () => undefined,
      all: () => [],
      run: () => ({ changes: 0 }),
    };
  }

  /**
   * Clear all in-memory stores.
   */
  close() {
    this._stores.clear();
  }
}

// ---------------------------------------------------------------------------
// Instance cache (per-cwd singleton)
// ---------------------------------------------------------------------------

const _instances = new Map();

// ---------------------------------------------------------------------------
// getDb factory
// ---------------------------------------------------------------------------

/**
 * Get (or create) a database instance for the given working directory.
 *
 * - Returns the same instance on repeated calls with the same cwd (singleton)
 * - Returns SQLiteDatabase on Node 22.5+ if `.planning/` exists
 * - Returns MapDatabase if `.planning/` doesn't exist or node:sqlite is unavailable
 * - Does NOT create `.planning/` — never a side effect
 *
 * @param {string} [cwd] - Project root directory (defaults to process.cwd())
 * @returns {SQLiteDatabase|MapDatabase}
 */
function getDb(cwd) {
  cwd = cwd || process.cwd();
  const resolvedCwd = path.resolve(cwd);

  // Return cached instance
  if (_instances.has(resolvedCwd)) {
    return _instances.get(resolvedCwd);
  }

  let db;

  // Check .planning/ directory exists (required for SQLite db creation)
  const planningDir = path.join(resolvedCwd, '.planning');
  const planningExists = fs.existsSync(planningDir);

  if (planningExists && hasSQLiteSupport()) {
    const dbPath = path.join(planningDir, '.cache.db');
    const isNewDb = !fs.existsSync(dbPath);

    try {
      db = new SQLiteDatabase(dbPath);

      if (db._degraded) {
        // Migration failure caused degradation — fall back to Map
        db = new MapDatabase();
      } else if (isNewDb) {
        // First-ever creation notice
        db._notices.push('Initialized bGSD cache');
      }
    } catch {
      // SQLiteDatabase constructor threw — fall back to Map
      db = new MapDatabase();
    }
  } else {
    db = new MapDatabase();
  }

  _instances.set(resolvedCwd, db);
  return db;
}

// ---------------------------------------------------------------------------
// closeAll
// ---------------------------------------------------------------------------

/**
 * Close all cached database instances and clear the instance cache.
 * Useful for tests and process cleanup.
 */
function closeAll() {
  for (const [, instance] of _instances) {
    try {
      instance.close();
    } catch {
      // Ignore close errors
    }
  }
  _instances.clear();
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  getDb,
  closeAll,
  hasSQLiteSupport,
  SQLiteDatabase,
  MapDatabase,
  MIGRATIONS,
};
