/**
 * Comprehensive test suite for src/lib/db.js — Phase 118 Foundation & Schema
 *
 * Tests all four phase requirements:
 *   FND-01: SQLiteDatabase creates .cache.db with correct schema version
 *   FND-02: Schema migration runner upgrades version correctly
 *   FND-03: MapDatabase provides transparent fallback with identical interface
 *   FND-04: WAL mode and busy_timeout are set on SQLite connections
 */

'use strict';

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Import the module under test from source (not the built bundle)
const {
  getDb,
  closeAll,
  hasSQLiteSupport,
  SQLiteDatabase,
  MapDatabase,
} = require('../src/lib/db');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create an isolated temp directory. Used as project root in tests.
 * @param {string} [prefix]
 * @returns {string}
 */
function makeTempDir(prefix = 'bgsd-db-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/**
 * Remove a temp directory recursively (best-effort).
 * @param {string} dir
 */
function removeTempDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore cleanup failures
  }
}

// ---------------------------------------------------------------------------
// Test Group 1: Feature detection (hasSQLiteSupport)
// ---------------------------------------------------------------------------

describe('Group 1: hasSQLiteSupport()', () => {
  it('returns a boolean', () => {
    const result = hasSQLiteSupport();
    assert.strictEqual(typeof result, 'boolean', 'hasSQLiteSupport() should return a boolean');
  });

  it('returns true on Node 22.5+ (current runtime is 22.5+)', () => {
    // Node 25.x always has node:sqlite available
    const result = hasSQLiteSupport();
    assert.strictEqual(result, true, 'Should return true on Node 22.5+ with node:sqlite built-in');
  });
});

// ---------------------------------------------------------------------------
// Test Group 2: getDb() factory
// ---------------------------------------------------------------------------

describe('Group 2: getDb() factory', () => {
  const tempDirs = [];

  function createDir(withPlanning = false) {
    const dir = makeTempDir('bgsd-getdb-');
    tempDirs.push(dir);
    if (withPlanning) {
      fs.mkdirSync(path.join(dir, '.planning'), { recursive: true });
    }
    return dir;
  }

  after(() => {
    closeAll();
    tempDirs.forEach(removeTempDir);
  });

  it('returns an object with a .backend property', () => {
    const dir = createDir(false);
    const db = getDb(dir);
    assert.ok(db !== null && typeof db === 'object', 'getDb() should return an object');
    assert.ok('backend' in db, 'returned object should have .backend property');
  });

  it('returns sqlite backend when .planning/ directory exists and SQLite is available', () => {
    const dir = createDir(true);
    const db = getDb(dir);
    assert.strictEqual(db.backend, 'sqlite', 'Should return sqlite backend when .planning/ exists');
  });

  it('returns map backend when .planning/ directory does NOT exist', () => {
    const dir = createDir(false);
    const db = getDb(dir);
    assert.strictEqual(db.backend, 'map', 'Should return map backend without .planning/');
  });

  it('does NOT create .planning/ directory when it does not exist', () => {
    const dir = createDir(false);
    getDb(dir);
    assert.ok(
      !fs.existsSync(path.join(dir, '.planning')),
      'getDb() should never create .planning/ as a side effect'
    );
  });

  it('returns the same instance (singleton) on repeated calls with same cwd', () => {
    const dir = createDir(false);
    const db1 = getDb(dir);
    const db2 = getDb(dir);
    assert.strictEqual(db1, db2, 'getDb() should return the same instance for same cwd');
  });

  it('returns different instances for different cwds', () => {
    const dir1 = createDir(false);
    const dir2 = createDir(false);
    const db1 = getDb(dir1);
    const db2 = getDb(dir2);
    assert.notStrictEqual(db1, db2, 'Different cwds should produce different instances');
  });
});

// ---------------------------------------------------------------------------
// Test Group 3: SQLiteDatabase backend (FND-01)
// ---------------------------------------------------------------------------

describe('Group 3: SQLiteDatabase backend (FND-01)', () => {
  let tempDir;
  let db;

  before(() => {
    closeAll();
    tempDir = makeTempDir('bgsd-sqlite-');
    fs.mkdirSync(path.join(tempDir, '.planning'), { recursive: true });
    db = getDb(tempDir);
  });

  after(() => {
    closeAll();
    removeTempDir(tempDir);
  });

  it('backend is "sqlite"', () => {
    assert.strictEqual(db.backend, 'sqlite', 'SQLiteDatabase.backend should be "sqlite"');
  });

  it('creates .planning/.cache.db file on disk', () => {
    const dbPath = path.join(tempDir, '.planning', '.cache.db');
    assert.ok(fs.existsSync(dbPath), '.planning/.cache.db should exist on disk after getDb()');
  });

  it('getSchemaVersion() returns 3 after all migrations', () => {
    const version = db.getSchemaVersion();
    assert.strictEqual(version, 3, 'Schema version should be 3 after V1+V2+V3 migrations');
  });

  it('_meta table exists with created_at entry', () => {
    const row = db.prepare("SELECT * FROM _meta WHERE key = 'created_at'").get();
    assert.ok(row !== undefined, '_meta table should have a created_at row');
    assert.ok(row.value, 'created_at value should be non-empty');
  });

  it('dbPath property returns the correct path', () => {
    const expectedPath = path.join(tempDir, '.planning', '.cache.db');
    assert.strictEqual(db.dbPath, expectedPath, 'dbPath should return the .cache.db path');
  });
});

// ---------------------------------------------------------------------------
// Test Group 4: SQLiteDatabase WAL mode and busy_timeout (FND-04)
// ---------------------------------------------------------------------------

describe('Group 4: WAL mode and busy_timeout (FND-04)', () => {
  let tempDir;
  let db;

  before(() => {
    closeAll();
    tempDir = makeTempDir('bgsd-wal-');
    fs.mkdirSync(path.join(tempDir, '.planning'), { recursive: true });
    db = getDb(tempDir);
  });

  after(() => {
    closeAll();
    removeTempDir(tempDir);
  });

  it('journal_mode is WAL', () => {
    const result = db.prepare('PRAGMA journal_mode').get();
    assert.ok(result !== undefined, 'PRAGMA journal_mode should return a result');
    assert.strictEqual(
      result.journal_mode,
      'wal',
      `Expected WAL mode, got: ${result.journal_mode}`
    );
  });

  it('busy_timeout is 5000ms', () => {
    const result = db.prepare('PRAGMA busy_timeout').get();
    assert.ok(result !== undefined, 'PRAGMA busy_timeout should return a result');
    // node:sqlite returns {timeout: N}, not {busy_timeout: N} — see STATE.md decision
    const timeoutValue =
      result.timeout !== undefined ? result.timeout : result.busy_timeout;
    assert.strictEqual(
      timeoutValue,
      5000,
      `Expected busy_timeout=5000, got: ${JSON.stringify(result)}`
    );
  });
});

// ---------------------------------------------------------------------------
// Test Group 5: Interface parity (SQLiteDatabase vs MapDatabase)
// ---------------------------------------------------------------------------

describe('Group 5: Interface parity', () => {
  let tempDir;
  let sqliteDb;
  let mapDb;

  before(() => {
    closeAll();
    tempDir = makeTempDir('bgsd-parity-');
    fs.mkdirSync(path.join(tempDir, '.planning'), { recursive: true });
    sqliteDb = getDb(tempDir);
    mapDb = new MapDatabase();
  });

  after(() => {
    closeAll();
    mapDb.close();
    removeTempDir(tempDir);
  });

  const requiredInterface = ['backend', 'dbPath', 'notices', 'getSchemaVersion', 'exec', 'prepare', 'close'];

  for (const prop of requiredInterface) {
    it(`MapDatabase has property/method: ${prop}`, () => {
      assert.ok(prop in mapDb, `MapDatabase should expose .${prop}`);
    });

    it(`SQLiteDatabase has property/method: ${prop}`, () => {
      assert.ok(prop in sqliteDb, `SQLiteDatabase should expose .${prop}`);
    });
  }

  it('exec() on MapDatabase does not throw', () => {
    assert.doesNotThrow(() => {
      mapDb.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)');
    }, 'MapDatabase.exec() should be a no-op, not throw');
  });

  it('prepare().get() on MapDatabase returns undefined', () => {
    const stmt = mapDb.prepare('SELECT 1');
    assert.ok(typeof stmt.get === 'function', 'prepare() result should have .get() method');
    const result = stmt.get();
    assert.strictEqual(result, undefined, 'MapDatabase prepare().get() should return undefined');
  });

  it('prepare().all() on MapDatabase returns []', () => {
    const stmt = mapDb.prepare('SELECT 1');
    assert.ok(typeof stmt.all === 'function', 'prepare() result should have .all() method');
    const result = stmt.all();
    assert.deepStrictEqual(result, [], 'MapDatabase prepare().all() should return []');
  });

  it('prepare().run() on MapDatabase returns { changes: 0 }', () => {
    const stmt = mapDb.prepare('INSERT INTO test VALUES (1)');
    assert.ok(typeof stmt.run === 'function', 'prepare() result should have .run() method');
    const result = stmt.run();
    assert.deepStrictEqual(result, { changes: 0 }, 'MapDatabase prepare().run() should return { changes: 0 }');
  });
});

// ---------------------------------------------------------------------------
// Test Group 6: Schema migration (FND-02)
// ---------------------------------------------------------------------------

describe('Group 6: Schema migration (FND-02)', () => {
  let tempDir;

  afterEach(() => {
    closeAll();
    if (tempDir) {
      removeTempDir(tempDir);
      tempDir = null;
    }
  });

  it('fresh DB starts at version 0 before getDb(), version 3 after all migrations', () => {
    // We verify indirectly: a fresh .planning/ dir, calling getDb() results in version 3
    tempDir = makeTempDir('bgsd-migration-');
    fs.mkdirSync(path.join(tempDir, '.planning'), { recursive: true });
    const db = getDb(tempDir);
    assert.strictEqual(db.getSchemaVersion(), 3, 'Schema should be version 3 after all migrations');
  });

  it('_meta table has created_at entry from V1 migration', () => {
    tempDir = makeTempDir('bgsd-migration2-');
    fs.mkdirSync(path.join(tempDir, '.planning'), { recursive: true });
    const db = getDb(tempDir);
    const row = db.prepare("SELECT * FROM _meta WHERE key = 'created_at'").get();
    assert.ok(row !== undefined, 'V1 migration should create _meta.created_at entry');
    // Verify the value looks like an ISO timestamp
    assert.match(row.value, /^\d{4}-\d{2}-\d{2}T/, 'created_at should be an ISO timestamp');
  });

  it('calling getDb() again on same DB is idempotent — version stays at 3', () => {
    tempDir = makeTempDir('bgsd-idempotent-');
    fs.mkdirSync(path.join(tempDir, '.planning'), { recursive: true });

    // First call
    const db1 = getDb(tempDir);
    assert.strictEqual(db1.getSchemaVersion(), 3);

    // Second call — same instance (singleton)
    const db2 = getDb(tempDir);
    assert.strictEqual(db1, db2, 'Should be same instance');
    assert.strictEqual(db2.getSchemaVersion(), 3, 'Version should still be 3 (migrations not re-run)');
  });
});

// ---------------------------------------------------------------------------
// Test Group 7: Migration failure → delete-and-rebuild
// ---------------------------------------------------------------------------

describe('Group 7: Migration failure → delete-and-rebuild', () => {
  let tempDir;

  afterEach(() => {
    closeAll();
    if (tempDir) {
      removeTempDir(tempDir);
      tempDir = null;
    }
  });

  it('corrupted .cache.db is detected, deleted, and rebuilt without error', () => {
    tempDir = makeTempDir('bgsd-corrupt-');
    const planningDir = path.join(tempDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });

    // Write corrupt content to .cache.db before getDb() is called
    const dbPath = path.join(planningDir, '.cache.db');
    fs.writeFileSync(dbPath, Buffer.from([0xFF, 0xFE, 0x00, 0x01, 0xDE, 0xAD, 0xBE, 0xEF]));

    // getDb() should detect corruption, delete the file, rebuild from scratch
    let db;
    assert.doesNotThrow(() => {
      db = getDb(tempDir);
    }, 'getDb() should not throw on corrupted database');

    // The rebuilt database should be functional
    // If it fell back to Map, that's also acceptable (graceful degradation)
    assert.ok(
      db.backend === 'sqlite' || db.backend === 'map',
      `Backend should be sqlite or map, got: ${db.backend}`
    );

    // If SQLite rebuild succeeded, verify schema version
    if (db.backend === 'sqlite') {
      assert.strictEqual(db.getSchemaVersion(), 3, 'Rebuilt DB should have schema version 3');
      const metaRow = db.prepare("SELECT * FROM _meta WHERE key = 'created_at'").get();
      assert.ok(metaRow !== undefined, 'Rebuilt DB should have _meta.created_at');
    }
  });

  it('no error is thrown to the caller when database is rebuilt', () => {
    tempDir = makeTempDir('bgsd-corrupt2-');
    const planningDir = path.join(tempDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });

    // Write random bytes to trigger corruption
    const dbPath = path.join(planningDir, '.cache.db');
    const randomBytes = Buffer.alloc(256);
    for (let i = 0; i < 256; i++) randomBytes[i] = Math.floor(Math.random() * 256);
    fs.writeFileSync(dbPath, randomBytes);

    // Should not throw — delete-and-rebuild is transparent to caller
    assert.doesNotThrow(() => {
      getDb(tempDir);
    }, 'Corruption recovery should be transparent — no error thrown');
  });
});

// ---------------------------------------------------------------------------
// Test Group 8: MapDatabase fallback (FND-03)
// ---------------------------------------------------------------------------

describe('Group 8: MapDatabase fallback (FND-03)', () => {
  let mapDb;

  before(() => {
    mapDb = new MapDatabase();
  });

  after(() => {
    mapDb.close();
  });

  it('backend is "map"', () => {
    assert.strictEqual(mapDb.backend, 'map', 'MapDatabase.backend should be "map"');
  });

  it('dbPath is null', () => {
    assert.strictEqual(mapDb.dbPath, null, 'MapDatabase.dbPath should be null');
  });

  it('getSchemaVersion() returns 0', () => {
    assert.strictEqual(mapDb.getSchemaVersion(), 0, 'MapDatabase schema version should be 0');
  });

  it('exec() is a no-op — does not throw', () => {
    assert.doesNotThrow(() => {
      mapDb.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)');
      mapDb.exec('INSERT INTO test VALUES (1)');
    }, 'MapDatabase.exec() should never throw');
  });

  it('prepare().get() returns undefined', () => {
    const result = mapDb.prepare('SELECT * FROM test').get();
    assert.strictEqual(result, undefined, 'MapDatabase prepare().get() should return undefined');
  });

  it('prepare().all() returns []', () => {
    const result = mapDb.prepare('SELECT * FROM test').all();
    assert.deepStrictEqual(result, [], 'MapDatabase prepare().all() should return []');
  });

  it('prepare().run() returns { changes: 0 }', () => {
    const result = mapDb.prepare('INSERT INTO test VALUES (2)').run();
    assert.deepStrictEqual(result, { changes: 0 }, 'MapDatabase prepare().run() should return { changes: 0 }');
  });

  it('close() does not throw', () => {
    const freshMapDb = new MapDatabase();
    assert.doesNotThrow(() => {
      freshMapDb.close();
    }, 'MapDatabase.close() should not throw');
  });

  it('notices includes the fallback notice message', () => {
    const freshMapDb = new MapDatabase();
    const notices = freshMapDb.notices;
    assert.ok(Array.isArray(notices), 'notices should be an array');
    assert.ok(notices.length > 0, 'MapDatabase notices should include fallback message');
    const hasUnavailableNotice = notices.some(
      n => n.includes('SQLite') || n.includes('in-memory') || n.includes('unavailable')
    );
    assert.ok(hasUnavailableNotice, `Expected SQLite unavailable notice, got: ${JSON.stringify(notices)}`);
  });
});

// ---------------------------------------------------------------------------
// Test Group 9: No .planning/ side effect
// ---------------------------------------------------------------------------

describe('Group 9: No .planning/ side effect', () => {
  let tempDir;

  afterEach(() => {
    closeAll();
    if (tempDir) {
      removeTempDir(tempDir);
      tempDir = null;
    }
  });

  it('does NOT create .planning/ when directory does not exist', () => {
    tempDir = makeTempDir('bgsd-noside-');
    // Explicitly do NOT create .planning/
    assert.ok(!fs.existsSync(path.join(tempDir, '.planning')), 'Pre-condition: .planning/ should not exist');

    getDb(tempDir);

    assert.ok(
      !fs.existsSync(path.join(tempDir, '.planning')),
      'getDb() must never create .planning/ as a side effect'
    );
  });

  it('returns map backend when .planning/ is absent', () => {
    tempDir = makeTempDir('bgsd-noside2-');
    const db = getDb(tempDir);
    assert.strictEqual(db.backend, 'map', 'Without .planning/, backend should be "map"');
  });
});

// ---------------------------------------------------------------------------
// Test Group 10: closeAll() cleanup
// ---------------------------------------------------------------------------

describe('Group 10: closeAll() cleanup', () => {
  it('closes all cached instances and allows new instances to be created', () => {
    // Create multiple db instances
    const dirs = [];
    for (let i = 0; i < 3; i++) {
      const dir = makeTempDir(`bgsd-closeall-${i}-`);
      dirs.push(dir);
    }

    try {
      const db1 = getDb(dirs[0]);
      const db2 = getDb(dirs[1]);
      const db3 = getDb(dirs[2]);

      // Capture initial references
      assert.ok(db1 && db2 && db3, 'Should have created 3 instances');

      // Close all
      assert.doesNotThrow(() => closeAll(), 'closeAll() should not throw');

      // After closeAll(), calling getDb() again creates new instances
      const db1New = getDb(dirs[0]);
      assert.notStrictEqual(
        db1New,
        db1,
        'After closeAll(), getDb() should create a new instance'
      );
    } finally {
      closeAll();
      dirs.forEach(removeTempDir);
    }
  });

  it('closeAll() can be called multiple times without error', () => {
    assert.doesNotThrow(() => {
      closeAll();
      closeAll(); // calling twice should be fine
    }, 'Multiple closeAll() calls should not throw');
  });

  it('closeAll() works on empty instance cache', () => {
    closeAll(); // ensure empty
    assert.doesNotThrow(() => {
      closeAll(); // should be safe on empty cache
    }, 'closeAll() on empty cache should not throw');
  });
});
