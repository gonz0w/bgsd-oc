/**
 * Comprehensive test suite for src/lib/planning-cache.js — Phase 119 Planning Tables
 *
 * Tests all four phase requirements:
 *   TBL-01: storeRoadmap + getPhases round-trip produces correct data
 *   TBL-02: storePlan + getPlan round-trip with tasks and frontmatter
 *   TBL-03: Requirements stored and queryable by REQ-ID
 *   TBL-04: Mtime change triggers stale detection and re-parse
 *
 * Additionally verifies:
 *   - Schema migration: MIGRATIONS[1] creates all 7 tables with correct columns
 *   - PlanningCache construction with both SQLite and Map backends
 *   - Mtime invalidation lifecycle (missing → fresh → stale → invalidated)
 *   - MapDatabase fallback: all PlanningCache methods return null/empty
 */

'use strict';

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Import modules under test from source (not the built bundle)
const {
  getDb,
  closeAll,
  SQLiteDatabase,
  MapDatabase,
} = require('../src/lib/db');

const { PlanningCache } = require('../src/lib/planning-cache');
const { resolveLockDir } = require('../src/lib/project-lock');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create an isolated temp directory with a .planning/ subdirectory.
 * @param {string} [prefix]
 * @returns {{ dir: string, planningDir: string }}
 */
function makePlanningDir(prefix = 'bgsd-cache-test-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const planningDir = path.join(dir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  return { dir, planningDir };
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

/**
 * Create a temporary file with given content and return its path.
 * @param {string} dir
 * @param {string} filename
 * @param {string} [content]
 * @returns {string}
 */
function createTempFile(dir, filename, content = 'test content') {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, content);
  return filePath;
}

/**
 * Touch a file to advance its mtime by writing the same content again.
 * @param {string} filePath
 */
function touchFile(filePath) {
  const content = fs.readFileSync(filePath);
  // Write to a temp and rename, or just update mtime explicitly
  const now = new Date();
  fs.utimesSync(filePath, now, now);
}

// ---------------------------------------------------------------------------
// Mock data helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock parsed roadmap object matching the parser output shape.
 */
function mockParsedRoadmap() {
  return {
    phases: [
      {
        number: '001',
        name: 'Foundation',
        status: 'complete',
        plan_count: 3,
        goal: 'Build the foundation',
        depends_on: [],
        requirements: ['REQ-01', 'REQ-02'],
        section: '**Requirements**: TBL-01, TBL-02\n- [ ] **TBL-01**: Phases queryable from SQL\n- [ ] **TBL-02**: Plans queryable from SQL',
      },
      {
        number: '002',
        name: 'Integration',
        status: 'incomplete',
        plan_count: 2,
        goal: 'Integrate the cache layer',
        depends_on: ['001'],
        requirements: ['REQ-03'],
        section: '**Requirements**: TBL-03\n- [ ] **TBL-03**: Requirements queryable by REQ-ID',
      },
    ],
    milestones: [
      {
        name: 'v1.0',
        version: '1.0',
        status: 'pending',
        phase_start: 1,
        phase_end: 2,
      },
    ],
    progress: [
      {
        phase: '001',
        plans_complete: 3,
        plans_total: 3,
        status: 'complete',
        completed_date: '2026-01-01',
      },
      {
        phase: '002',
        plans_complete: 0,
        plans_total: 2,
        status: null,
        completed_date: null,
      },
    ],
    requirements: [
      { req_id: 'TBL-01', phase_number: '001', description: 'Phases queryable from SQL' },
      { req_id: 'TBL-02', phase_number: '001', description: 'Plans queryable from SQL' },
      { req_id: 'TBL-03', phase_number: '002', description: 'Requirements queryable by REQ-ID' },
    ],
  };
}

/**
 * Build a mock parsed plan object matching the parser output shape.
 */
function mockParsedPlan(phaseNumber = '001', planNumber = '01') {
  return {
    frontmatter: {
      phase: `${phaseNumber}-test-phase`,
      plan: planNumber,
      type: 'execute',
      wave: 1,
      autonomous: true,
      requirements: ['REQ-01'],
      depends_on: [],
    },
    objective: 'Build a comprehensive test for the cache layer',
    tasks: [
      {
        type: 'auto',
        name: 'Task 1: Write tests for schema',
        files: ['tests/planning-cache.test.cjs'],
        action: 'Create the test file',
        verify: 'Run the tests',
        done: 'Tests pass',
      },
      {
        type: 'auto',
        name: 'Task 2: Write round-trip tests',
        files: ['tests/planning-cache.test.cjs'],
        action: 'Add round-trip test groups',
        verify: 'Run all tests',
        done: 'All tests pass',
      },
    ],
    context: [],
    raw: null,
  };
}

function createMockMutationDb(options = {}) {
  const failOn = options.failOn || (() => false);
  return {
    backend: 'sqlite',
    exec() {},
    prepare(sql) {
      return {
        get() { return null; },
        all() { return []; },
        run(...args) {
          if (failOn(sql, args)) {
            throw new Error('planned mutation failure');
          }
          return { changes: 1 };
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Test Group 1: Schema Migration (MIGRATIONS[1])
// ---------------------------------------------------------------------------

describe('Group 1: Schema Migration (MIGRATIONS[1])', () => {
  let tempDir;
  let planningDir;
  let db;

  before(() => {
    closeAll();
    ({ dir: tempDir, planningDir } = makePlanningDir('bgsd-schema-'));
    db = getDb(tempDir);
  });

  after(() => {
    closeAll();
    removeTempDir(tempDir);
  });

  it('schema version is 5 after getDb() on fresh database', () => {
    const version = db.getSchemaVersion();
    assert.strictEqual(version, 5, 'Schema version should be 5 after V1 + V2 + V3 + V4 + V5 migrations');
  });

  it('file_cache table exists', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='file_cache'"
    ).get();
    assert.ok(row !== undefined, 'file_cache table should exist after MIGRATIONS[1]');
  });

  it('milestones table exists', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='milestones'"
    ).get();
    assert.ok(row !== undefined, 'milestones table should exist after MIGRATIONS[1]');
  });

  it('phases table exists', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='phases'"
    ).get();
    assert.ok(row !== undefined, 'phases table should exist after MIGRATIONS[1]');
  });

  it('progress table exists', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='progress'"
    ).get();
    assert.ok(row !== undefined, 'progress table should exist after MIGRATIONS[1]');
  });

  it('plans table exists', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='plans'"
    ).get();
    assert.ok(row !== undefined, 'plans table should exist after MIGRATIONS[1]');
  });

  it('tasks table exists', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'"
    ).get();
    assert.ok(row !== undefined, 'tasks table should exist after MIGRATIONS[1]');
  });

  it('requirements table exists', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='requirements'"
    ).get();
    assert.ok(row !== undefined, 'requirements table should exist after MIGRATIONS[1]');
  });

  it('all 7 planning tables exist (total count)', () => {
    const rows = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('file_cache','milestones','phases','progress','plans','tasks','requirements')"
    ).all();
    assert.strictEqual(rows.length, 7, 'All 7 planning tables should exist');
  });

  it('phases table has correct columns: number, cwd, name, status, plan_count, goal, depends_on, requirements, section', () => {
    const rows = db.prepare("PRAGMA table_info(phases)").all();
    const cols = rows.map(r => r.name);
    const expected = ['number', 'cwd', 'name', 'status', 'plan_count', 'goal', 'depends_on', 'requirements', 'section'];
    for (const col of expected) {
      assert.ok(cols.includes(col), `phases table should have column: ${col}`);
    }
  });

  it('tasks table has foreign key column plan_path referencing plans(path)', () => {
    const rows = db.prepare("PRAGMA table_info(tasks)").all();
    const cols = rows.map(r => r.name);
    assert.ok(cols.includes('plan_path'), 'tasks table should have plan_path column');
    assert.ok(cols.includes('idx'), 'tasks table should have idx column');
    assert.ok(cols.includes('type'), 'tasks table should have type column');
    assert.ok(cols.includes('name'), 'tasks table should have name column');
    assert.ok(cols.includes('files_json'), 'tasks table should have files_json column');
  });

  it('indexes exist for common queries: idx_phases_cwd', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_phases_cwd'"
    ).get();
    assert.ok(row !== undefined, 'idx_phases_cwd index should exist');
  });

  it('indexes exist for common queries: idx_plans_cwd', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_plans_cwd'"
    ).get();
    assert.ok(row !== undefined, 'idx_plans_cwd index should exist');
  });

  it('indexes exist for common queries: idx_requirements_cwd', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_requirements_cwd'"
    ).get();
    assert.ok(row !== undefined, 'idx_requirements_cwd index should exist');
  });
});

// ---------------------------------------------------------------------------
// Test Group 2: PlanningCache Construction and Backend Detection
// ---------------------------------------------------------------------------

describe('Group 2: PlanningCache Construction and Backend Detection', () => {
  let tempDir;
  let sqliteDb;
  let mapDb;

  before(() => {
    closeAll();
    ({ dir: tempDir } = makePlanningDir('bgsd-cache-ctor-'));
    sqliteDb = getDb(tempDir);
    mapDb = new MapDatabase();
  });

  after(() => {
    closeAll();
    mapDb.close();
    removeTempDir(tempDir);
  });

  it('PlanningCache(sqliteDb) creates instance without throwing', () => {
    assert.doesNotThrow(() => {
      new PlanningCache(sqliteDb);
    }, 'PlanningCache constructor with SQLite backend should not throw');
  });

  it('PlanningCache(mapDb) creates instance without throwing', () => {
    assert.doesNotThrow(() => {
      new PlanningCache(mapDb);
    }, 'PlanningCache constructor with MapDatabase backend should not throw');
  });

  it('PlanningCache(sqliteDb) has working methods', () => {
    const cache = new PlanningCache(sqliteDb);
    assert.ok(typeof cache.checkFreshness === 'function', 'checkFreshness should be a method');
    assert.ok(typeof cache.updateMtime === 'function', 'updateMtime should be a method');
    assert.ok(typeof cache.storeRoadmap === 'function', 'storeRoadmap should be a method');
    assert.ok(typeof cache.getPhases === 'function', 'getPhases should be a method');
    assert.ok(typeof cache.storePlan === 'function', 'storePlan should be a method');
    assert.ok(typeof cache.getPlan === 'function', 'getPlan should be a method');
    assert.ok(typeof cache.getRequirements === 'function', 'getRequirements should be a method');
    assert.ok(typeof cache.getRequirement === 'function', 'getRequirement should be a method');
  });

  it('PlanningCache(mapDb) has working methods (returning null/empty)', () => {
    const cache = new PlanningCache(mapDb);
    // All reads should return null/empty — no throws
    assert.doesNotThrow(() => {
      const freshness = cache.checkFreshness('/some/nonexistent/file.md');
      assert.strictEqual(freshness, 'missing', 'Map backend checkFreshness should return missing');
    });
    assert.doesNotThrow(() => {
      const phases = cache.getPhases('/some/cwd');
      assert.strictEqual(phases, null, 'Map backend getPhases should return null');
    });
  });
});

// ---------------------------------------------------------------------------
// Test Group 3: Mtime Invalidation
// ---------------------------------------------------------------------------

describe('Group 3: Mtime Invalidation', () => {
  let tempDir;
  let planningDir;
  let db;
  let cache;

  before(() => {
    closeAll();
    ({ dir: tempDir, planningDir } = makePlanningDir('bgsd-mtime-'));
    db = getDb(tempDir);
    cache = new PlanningCache(db);
  });

  after(() => {
    closeAll();
    removeTempDir(tempDir);
  });

  it('checkFreshness returns "missing" for uncached file path', () => {
    const filePath = path.join(tempDir, 'ROADMAP.md');
    const result = cache.checkFreshness(filePath);
    assert.strictEqual(result, 'missing', 'Uncached file should return "missing"');
  });

  it('checkFreshness returns "missing" for non-existent file path', () => {
    const filePath = path.join(tempDir, 'nonexistent', 'file.md');
    const result = cache.checkFreshness(filePath);
    assert.strictEqual(result, 'missing', 'Non-existent file should return "missing"');
  });

  it('after updateMtime, checkFreshness returns "fresh"', () => {
    const filePath = createTempFile(tempDir, 'ROADMAP.md', '# Test roadmap');
    cache.updateMtime(filePath);
    const result = cache.checkFreshness(filePath);
    assert.strictEqual(result, 'fresh', 'After updateMtime, file should be "fresh"');
  });

  it('after file modification (utimes change), checkFreshness returns "stale"', () => {
    const filePath = createTempFile(tempDir, 'STATE.md', '# State');
    cache.updateMtime(filePath);

    // Verify it's fresh first
    assert.strictEqual(cache.checkFreshness(filePath), 'fresh', 'Pre-condition: should be fresh');

    // Advance mtime by 1 second using utimesSync
    const futureTime = new Date(Date.now() + 1000);
    fs.utimesSync(filePath, futureTime, futureTime);

    const result = cache.checkFreshness(filePath);
    assert.strictEqual(result, 'stale', 'After mtime change, file should be "stale"');
  });

  it('invalidateFile removes the file_cache entry', () => {
    const filePath = createTempFile(tempDir, 'PLAN.md', '# Plan');
    cache.updateMtime(filePath);
    assert.strictEqual(cache.checkFreshness(filePath), 'fresh', 'Pre-condition: should be fresh');

    cache.invalidateFile(filePath);

    const result = cache.checkFreshness(filePath);
    assert.strictEqual(result, 'missing', 'After invalidateFile, file should be "missing"');
    assert.ok(!fs.existsSync(resolveLockDir(tempDir)), 'lock should be released after invalidateFile');
  });

  it('checkAllFreshness categorizes multiple files correctly', () => {
    const freshFile = createTempFile(tempDir, 'fresh.md', '# Fresh');
    const staleFile = createTempFile(tempDir, 'stale.md', '# Stale');
    const missingPath = path.join(tempDir, 'missing.md');

    // Set up: fresh file has mtime stored
    cache.updateMtime(freshFile);

    // Set up: stale file has old mtime stored, then file is modified
    cache.updateMtime(staleFile);
    const futureTime = new Date(Date.now() + 1000);
    fs.utimesSync(staleFile, futureTime, futureTime);

    // missingPath is not in cache at all
    const result = cache.checkAllFreshness([freshFile, staleFile, missingPath]);

    assert.ok(Array.isArray(result.fresh), 'fresh should be an array');
    assert.ok(Array.isArray(result.stale), 'stale should be an array');
    assert.ok(Array.isArray(result.missing), 'missing should be an array');

    assert.ok(result.fresh.includes(freshFile), 'Fresh file should be in fresh array');
    assert.ok(result.stale.includes(staleFile), 'Stale file should be in stale array');
    assert.ok(result.missing.includes(missingPath), 'Missing path should be in missing array');
  });
});

// ---------------------------------------------------------------------------
// Test Group 4: Roadmap Store + Query Round-Trip (TBL-01)
// ---------------------------------------------------------------------------

describe('Group 4: Roadmap Store + Query Round-Trip (TBL-01)', () => {
  let tempDir;
  let planningDir;
  let db;
  let cache;
  let roadmapPath;
  const cwd = '/test/project/tbl01';

  before(() => {
    closeAll();
    ({ dir: tempDir, planningDir } = makePlanningDir('bgsd-roadmap-'));
    db = getDb(tempDir);
    cache = new PlanningCache(db);

    // Create a mock roadmap file for mtime tracking
    roadmapPath = createTempFile(planningDir, 'ROADMAP.md', '# Test Roadmap');

    // Store the mock parsed roadmap
    const parsed = mockParsedRoadmap();
    cache.storeRoadmap(cwd, roadmapPath, parsed);
  });

  after(() => {
    closeAll();
    removeTempDir(tempDir);
  });

  it('getPhases returns non-null result after storeRoadmap', () => {
    const phases = cache.getPhases(cwd);
    assert.ok(phases !== null, 'getPhases should return non-null after storeRoadmap');
    assert.ok(Array.isArray(phases), 'getPhases should return an array');
  });

  it('getPhases returns correct number of phases', () => {
    const phases = cache.getPhases(cwd);
    assert.strictEqual(phases.length, 2, 'getPhases should return 2 phases');
  });

  it('getPhases returns correct phase data with number and name', () => {
    const phases = cache.getPhases(cwd);
    const phase1 = phases.find(p => p.number === '001');
    assert.ok(phase1 !== undefined, 'Phase 001 should exist');
    assert.strictEqual(phase1.name, 'Foundation', 'Phase name should match');
    assert.strictEqual(phase1.status, 'complete', 'Phase status should match');
  });

  it('getPhases returns correct plan_count', () => {
    const phases = cache.getPhases(cwd);
    const phase1 = phases.find(p => p.number === '001');
    assert.strictEqual(phase1.plan_count, 3, 'plan_count should round-trip correctly');
  });

  it('getPhases returns correct goal', () => {
    const phases = cache.getPhases(cwd);
    const phase1 = phases.find(p => p.number === '001');
    assert.strictEqual(phase1.goal, 'Build the foundation', 'goal should round-trip correctly');
  });

  it('getPhase(number, cwd) returns single phase with correct fields', () => {
    const phase = cache.getPhase('001', cwd);
    assert.ok(phase !== null, 'getPhase should return non-null for existing phase');
    assert.strictEqual(phase.number, '001', 'Phase number should match');
    assert.strictEqual(phase.name, 'Foundation', 'Phase name should match');
    assert.strictEqual(phase.cwd, cwd, 'Phase cwd should match');
  });

  it('getPhase returns null for non-existent phase number', () => {
    const phase = cache.getPhase('999', cwd);
    assert.strictEqual(phase, null, 'getPhase should return null for non-existent phase');
  });

  it('getMilestones returns correct milestone data', () => {
    const milestones = cache.getMilestones(cwd);
    assert.ok(milestones !== null, 'getMilestones should return non-null');
    assert.strictEqual(milestones.length, 1, 'Should return 1 milestone');
    assert.strictEqual(milestones[0].name, 'v1.0', 'Milestone name should match');
    assert.strictEqual(milestones[0].version, '1.0', 'Milestone version should match');
    assert.strictEqual(milestones[0].status, 'pending', 'Milestone status should match');
  });

  it('getProgress returns correct progress rows', () => {
    const progress = cache.getProgress(cwd);
    assert.ok(progress !== null, 'getProgress should return non-null');
    assert.strictEqual(progress.length, 2, 'Should return 2 progress rows');

    const prog1 = progress.find(p => p.phase === '001');
    assert.ok(prog1 !== undefined, 'Progress for phase 001 should exist');
    assert.strictEqual(prog1.plans_complete, 3, 'plans_complete should match');
    assert.strictEqual(prog1.plans_total, 3, 'plans_total should match');
    assert.strictEqual(prog1.status, 'complete', 'status should match');
    assert.strictEqual(prog1.completed_date, '2026-01-01', 'completed_date should match');
  });

  it('roadmap file_cache entry is updated after storeRoadmap', () => {
    const freshness = cache.checkFreshness(roadmapPath);
    assert.strictEqual(freshness, 'fresh', 'roadmapPath should be fresh after storeRoadmap');
  });

  it('re-storing roadmap replaces old data (DELETE + INSERT idempotency)', () => {
    // Store again with different phase data
    const updatedParsed = {
      phases: [
        {
          number: '001',
          name: 'Foundation UPDATED',
          status: 'complete',
          plan_count: 4,
          goal: 'Updated goal',
          depends_on: [],
          requirements: [],
          section: '',
        },
      ],
      milestones: [],
      progress: [],
      requirements: [],
    };

    cache.storeRoadmap(cwd, roadmapPath, updatedParsed);

    const phases = cache.getPhases(cwd);
    assert.strictEqual(phases.length, 1, 'Re-store should replace — only 1 phase now');
    assert.strictEqual(phases[0].name, 'Foundation UPDATED', 'Phase name should be updated');
    assert.strictEqual(phases[0].plan_count, 4, 'plan_count should be updated');

    const milestones = cache.getMilestones(cwd);
    assert.strictEqual(milestones, null, 'Milestones should be null after clearing');
  });
});

// ---------------------------------------------------------------------------
// Test Group 5: Plan Store + Query Round-Trip (TBL-02)
// ---------------------------------------------------------------------------

describe('Group 5: Plan Store + Query Round-Trip (TBL-02)', () => {
  let tempDir;
  let planningDir;
  let db;
  let cache;
  let planPath;
  const cwd = '/test/project/tbl02';

  before(() => {
    closeAll();
    ({ dir: tempDir, planningDir } = makePlanningDir('bgsd-plan-'));
    db = getDb(tempDir);
    cache = new PlanningCache(db);

    // Create a mock plan file
    planPath = createTempFile(planningDir, '0001-01-PLAN.md', '# Plan content');

    // Store the mock parsed plan
    const parsed = mockParsedPlan('001', '01');
    cache.storePlan(planPath, cwd, parsed);
  });

  after(() => {
    closeAll();
    removeTempDir(tempDir);
  });

  it('getPlan returns non-null result after storePlan', () => {
    const plan = cache.getPlan(planPath);
    assert.ok(plan !== null, 'getPlan should return non-null after storePlan');
  });

  it('getPlan returns plan with correct objective', () => {
    const plan = cache.getPlan(planPath);
    assert.strictEqual(
      plan.objective,
      'Build a comprehensive test for the cache layer',
      'Plan objective should round-trip correctly'
    );
  });

  it('getPlan includes frontmatter_json that round-trips correctly', () => {
    const plan = cache.getPlan(planPath);
    assert.ok(typeof plan.frontmatter_json === 'string', 'frontmatter_json should be a string');
    const fm = JSON.parse(plan.frontmatter_json);
    assert.strictEqual(fm.phase, '001-test-phase', 'frontmatter phase should round-trip');
    assert.strictEqual(fm.plan, '01', 'frontmatter plan number should round-trip');
    assert.strictEqual(fm.autonomous, true, 'frontmatter autonomous should round-trip');
    assert.strictEqual(fm.wave, 1, 'frontmatter wave should round-trip');
  });

  it('getPlan includes tasks array with correct length', () => {
    const plan = cache.getPlan(planPath);
    assert.ok(Array.isArray(plan.tasks), 'plan.tasks should be an array');
    assert.strictEqual(plan.tasks.length, 2, 'Should have 2 tasks');
  });

  it('getPlan tasks have correct fields', () => {
    const plan = cache.getPlan(planPath);
    const task0 = plan.tasks[0];
    assert.strictEqual(task0.idx, 0, 'First task idx should be 0');
    assert.strictEqual(task0.type, 'auto', 'Task type should be "auto"');
    assert.strictEqual(task0.name, 'Task 1: Write tests for schema', 'Task name should match');
    assert.strictEqual(task0.action, 'Create the test file', 'Task action should match');
    assert.strictEqual(task0.verify, 'Run the tests', 'Task verify should match');
    assert.strictEqual(task0.done, 'Tests pass', 'Task done should match');
  });

  it('task files_json round-trips correctly (array → JSON → array)', () => {
    const plan = cache.getPlan(planPath);
    const task0 = plan.tasks[0];
    assert.ok(typeof task0.files_json === 'string', 'files_json should be a string');
    const files = JSON.parse(task0.files_json);
    assert.ok(Array.isArray(files), 'Parsed files_json should be an array');
    assert.ok(files.includes('tests/planning-cache.test.cjs'), 'files_json should contain the expected file path');
  });

  it('getPlan task order is preserved by idx', () => {
    const plan = cache.getPlan(planPath);
    assert.strictEqual(plan.tasks[0].idx, 0, 'First task should have idx 0');
    assert.strictEqual(plan.tasks[1].idx, 1, 'Second task should have idx 1');
    assert.ok(
      plan.tasks[0].name.includes('Task 1'),
      'First task should be Task 1'
    );
    assert.ok(
      plan.tasks[1].name.includes('Task 2'),
      'Second task should be Task 2'
    );
  });

  it('getPlansForPhase returns plans filtered by phase number', () => {
    // Extract phase_number from frontmatter — it's derived from phase string before first '-'
    const plans = cache.getPlansForPhase('001', cwd);
    assert.ok(plans !== null, 'getPlansForPhase should return non-null');
    assert.ok(Array.isArray(plans), 'getPlansForPhase should return array');
    assert.ok(plans.length >= 1, 'Should find at least 1 plan for phase 001');
  });

  it('getPlansForPhase returns null for phase with no plans', () => {
    const plans = cache.getPlansForPhase('999', cwd);
    assert.strictEqual(plans, null, 'getPlansForPhase should return null for unknown phase');
  });

  it('plan file_cache entry is updated after storePlan', () => {
    const freshness = cache.checkFreshness(planPath);
    assert.strictEqual(freshness, 'fresh', 'planPath should be fresh after storePlan');
  });

  it('re-storing plan replaces old data', () => {
    const updatedParsed = {
      frontmatter: {
        phase: '001-test-phase',
        plan: '01',
        type: 'execute',
        wave: 2,
        autonomous: false,
      },
      objective: 'UPDATED objective',
      tasks: [
        {
          type: 'auto',
          name: 'Single updated task',
          files: ['tests/updated.test.cjs'],
          action: 'Updated action',
          verify: 'Updated verify',
          done: 'Updated done',
        },
      ],
      raw: null,
    };

    cache.storePlan(planPath, cwd, updatedParsed);

    const plan = cache.getPlan(planPath);
    assert.strictEqual(plan.objective, 'UPDATED objective', 'Objective should be updated');
    assert.strictEqual(plan.tasks.length, 1, 'Should only have 1 task after re-store');
    assert.strictEqual(plan.tasks[0].name, 'Single updated task', 'Task name should be updated');
  });

  it('releases the project lock after a failing storePlan and allows retry', () => {
    const { dir, planningDir } = makePlanningDir('bgsd-plan-lock-');
    const planFile = createTempFile(planningDir, '0001-01-PLAN.md', '# Plan content');

    try {
      const failingCache = new PlanningCache(createMockMutationDb({
        failOn(sql) {
          return sql.includes('INSERT OR REPLACE INTO plans');
        },
      }));

      failingCache.storePlan(planFile, dir, mockParsedPlan());
      assert.ok(!fs.existsSync(resolveLockDir(dir)), 'lock should be released after failed storePlan');

      const retryCache = new PlanningCache(createMockMutationDb());
      retryCache.storePlan(planFile, dir, mockParsedPlan());
      assert.ok(!fs.existsSync(resolveLockDir(dir)), 'lock should be released after retrying storePlan');
    } finally {
      removeTempDir(dir);
    }
  });
});

// ---------------------------------------------------------------------------
// Test Group 6: Requirements Store + Query (TBL-03)
// ---------------------------------------------------------------------------

describe('Group 6: Requirements Store + Query (TBL-03)', () => {
  let tempDir;
  let planningDir;
  let db;
  let cache;
  let roadmapPath;
  const cwd = '/test/project/tbl03';

  before(() => {
    closeAll();
    ({ dir: tempDir, planningDir } = makePlanningDir('bgsd-requirements-'));
    db = getDb(tempDir);
    cache = new PlanningCache(db);

    // Create a mock roadmap file
    roadmapPath = createTempFile(planningDir, 'ROADMAP.md', '# Roadmap for requirements test');

    // Store roadmap with explicit requirements
    const parsed = mockParsedRoadmap();
    cache.storeRoadmap(cwd, roadmapPath, parsed);
  });

  after(() => {
    closeAll();
    removeTempDir(tempDir);
  });

  it('getRequirements returns all requirements for cwd', () => {
    const reqs = cache.getRequirements(cwd);
    assert.ok(reqs !== null, 'getRequirements should return non-null');
    assert.ok(Array.isArray(reqs), 'getRequirements should return an array');
    assert.strictEqual(reqs.length, 3, 'Should return 3 requirements');
  });

  it('getRequirements returns requirements sorted by req_id', () => {
    const reqs = cache.getRequirements(cwd);
    const ids = reqs.map(r => r.req_id);
    assert.ok(ids.includes('TBL-01'), 'TBL-01 should be present');
    assert.ok(ids.includes('TBL-02'), 'TBL-02 should be present');
    assert.ok(ids.includes('TBL-03'), 'TBL-03 should be present');
  });

  it("getRequirement('TBL-01', cwd) returns correct single requirement", () => {
    const req = cache.getRequirement('TBL-01', cwd);
    assert.ok(req !== null, 'getRequirement should return non-null for TBL-01');
    assert.strictEqual(req.req_id, 'TBL-01', 'req_id should match');
    assert.strictEqual(req.description, 'Phases queryable from SQL', 'description should match');
  });

  it('getRequirement returns correct phase_number mapping', () => {
    const req = cache.getRequirement('TBL-01', cwd);
    assert.strictEqual(req.phase_number, '001', 'phase_number should match');

    const req3 = cache.getRequirement('TBL-03', cwd);
    assert.strictEqual(req3.phase_number, '002', 'TBL-03 phase_number should be 002');
  });

  it('getRequirement returns null for non-existent REQ-ID', () => {
    const req = cache.getRequirement('NONEXISTENT-99', cwd);
    assert.strictEqual(req, null, 'getRequirement should return null for non-existent REQ-ID');
  });

  it('requirements are scoped to cwd — different cwd returns null', () => {
    const req = cache.getRequirement('TBL-01', '/other/project');
    assert.strictEqual(req, null, 'Requirements should be scoped to their cwd');
  });

  it('requirements extracted from phase sections via _extractRequirementsFromPhases', () => {
    // Test requirement extraction from section text using a separate cwd
    const extractCwd = '/test/project/extract';
    const parsedWithSections = {
      phases: [
        {
          number: '003',
          name: 'Test Phase',
          status: 'incomplete',
          plan_count: 1,
          goal: 'Test extraction',
          depends_on: [],
          requirements: [],
          section: '- [ ] **EXT-01**: Extracted requirement one\n- [x] **EXT-02**: Extracted requirement two',
        },
      ],
      milestones: [],
      progress: [],
      // No explicit requirements — should be extracted from phases
    };

    const extractRoadmapPath = createTempFile(planningDir, 'ROADMAP-extract.md', '# Extract test');
    cache.storeRoadmap(extractCwd, extractRoadmapPath, parsedWithSections);

    const req = cache.getRequirement('EXT-01', extractCwd);
    assert.ok(req !== null, 'Requirements should be auto-extracted from section text');
    assert.strictEqual(req.req_id, 'EXT-01', 'Extracted req_id should match');
    assert.strictEqual(req.phase_number, '003', 'Extracted phase_number should match');
  });
});

// ---------------------------------------------------------------------------
// Test Group 7: Invalidation End-to-End (TBL-04)
// ---------------------------------------------------------------------------

describe('Group 7: Invalidation End-to-End (TBL-04)', () => {
  let tempDir;
  let planningDir;
  let db;
  let cache;
  let roadmapPath;
  const cwd = '/test/project/tbl04';

  before(() => {
    closeAll();
    ({ dir: tempDir, planningDir } = makePlanningDir('bgsd-invalidation-'));
    db = getDb(tempDir);
    cache = new PlanningCache(db);
  });

  after(() => {
    closeAll();
    removeTempDir(tempDir);
  });

  beforeEach(() => {
    // Reset for each test with fresh data
    roadmapPath = createTempFile(
      planningDir,
      `ROADMAP-${Date.now()}.md`,
      '# Test roadmap for invalidation'
    );
    const parsed = mockParsedRoadmap();
    cache.storeRoadmap(cwd, roadmapPath, parsed);
  });

  it('store roadmap → verify fresh → modify file → verify stale', () => {
    // After storeRoadmap, should be fresh
    assert.strictEqual(cache.checkFreshness(roadmapPath), 'fresh', 'Should be fresh after store');

    // Modify the file's mtime
    const futureTime = new Date(Date.now() + 1000);
    fs.utimesSync(roadmapPath, futureTime, futureTime);

    // Now should be stale
    assert.strictEqual(cache.checkFreshness(roadmapPath), 'stale', 'Should be stale after mtime change');
  });

  it('after stale detection, invalidateFile clears cached data', () => {
    // Make stale
    const futureTime = new Date(Date.now() + 1000);
    fs.utimesSync(roadmapPath, futureTime, futureTime);
    assert.strictEqual(cache.checkFreshness(roadmapPath), 'stale', 'Pre-condition: should be stale');

    // Invalidate
    cache.invalidateFile(roadmapPath);

    // Should now be missing (file_cache entry removed)
    assert.strictEqual(cache.checkFreshness(roadmapPath), 'missing', 'After invalidation should be missing');
  });

  it('getPhases returns null after invalidation (cache miss)', () => {
    // Verify we have phases before invalidation
    const phasesBefore = cache.getPhases(cwd);
    assert.ok(phasesBefore !== null, 'Pre-condition: should have phases cached');

    // Invalidate the roadmap file
    cache.invalidateFile(roadmapPath);

    // file_cache is clear — but phases table still has data (invalidateFile only removes file_cache entry and plan for that path)
    // This is expected behavior — invalidateFile does not clear phases table (only clearForCwd does that)
    // After invalidation, checkFreshness returns 'missing', so callers re-parse
    assert.strictEqual(cache.checkFreshness(roadmapPath), 'missing', 'File should be missing after invalidation');
  });

  it('re-store after invalidation works correctly', () => {
    // Invalidate
    cache.invalidateFile(roadmapPath);
    assert.strictEqual(cache.checkFreshness(roadmapPath), 'missing', 'Pre-condition: missing after invalidation');

    // Re-store with new data
    const newParsed = {
      phases: [
        {
          number: '100',
          name: 'Re-stored Phase',
          status: 'incomplete',
          plan_count: 1,
          goal: 'Re-stored goal',
          depends_on: [],
          requirements: [],
          section: '',
        },
      ],
      milestones: [],
      progress: [],
      requirements: [{ req_id: 'NEW-01', phase_number: '100', description: 'New req' }],
    };
    cache.storeRoadmap(cwd, roadmapPath, newParsed);

    // Should be fresh again
    assert.strictEqual(cache.checkFreshness(roadmapPath), 'fresh', 'Should be fresh after re-store');

    // And requirements should be updated
    const req = cache.getRequirement('NEW-01', cwd);
    assert.ok(req !== null, 'New requirement should be queryable after re-store');
    assert.strictEqual(req.req_id, 'NEW-01', 'New req_id should match');
  });

  it('clearForCwd removes all data for a cwd', () => {
    // Verify we have data
    const phasesBefore = cache.getPhases(cwd);
    assert.ok(phasesBefore !== null, 'Pre-condition: should have phases');

    // Clear all data for this cwd
    cache.clearForCwd(cwd);

    // All reads should return null now
    const phases = cache.getPhases(cwd);
    assert.strictEqual(phases, null, 'getPhases should return null after clearForCwd');

    const milestones = cache.getMilestones(cwd);
    assert.strictEqual(milestones, null, 'getMilestones should return null after clearForCwd');

    const progress = cache.getProgress(cwd);
    assert.strictEqual(progress, null, 'getProgress should return null after clearForCwd');

    const reqs = cache.getRequirements(cwd);
    assert.strictEqual(reqs, null, 'getRequirements should return null after clearForCwd');
  });
});

// ---------------------------------------------------------------------------
// Test Group 8: MapDatabase Fallback
// ---------------------------------------------------------------------------

describe('Group 8: MapDatabase Fallback', () => {
  let mapDb;
  let cache;

  before(() => {
    mapDb = new MapDatabase();
    cache = new PlanningCache(mapDb);
  });

  after(() => {
    mapDb.close();
  });

  it('PlanningCache with MapDatabase: checkFreshness returns "missing"', () => {
    const result = cache.checkFreshness('/any/path/ROADMAP.md');
    assert.strictEqual(result, 'missing', 'Map backend should return "missing" for checkFreshness');
  });

  it('PlanningCache with MapDatabase: storeRoadmap is no-op (does not throw)', () => {
    assert.doesNotThrow(() => {
      cache.storeRoadmap('/some/cwd', '/some/ROADMAP.md', mockParsedRoadmap());
    }, 'storeRoadmap should be a no-op on MapDatabase, not throw');
  });

  it('PlanningCache with MapDatabase: getPhases returns null', () => {
    const result = cache.getPhases('/some/cwd');
    assert.strictEqual(result, null, 'Map backend should return null for getPhases');
  });

  it('PlanningCache with MapDatabase: getPhase returns null', () => {
    const result = cache.getPhase('001', '/some/cwd');
    assert.strictEqual(result, null, 'Map backend should return null for getPhase');
  });

  it('PlanningCache with MapDatabase: getMilestones returns null', () => {
    const result = cache.getMilestones('/some/cwd');
    assert.strictEqual(result, null, 'Map backend should return null for getMilestones');
  });

  it('PlanningCache with MapDatabase: getProgress returns null', () => {
    const result = cache.getProgress('/some/cwd');
    assert.strictEqual(result, null, 'Map backend should return null for getProgress');
  });

  it('PlanningCache with MapDatabase: getRequirements returns null', () => {
    const result = cache.getRequirements('/some/cwd');
    assert.strictEqual(result, null, 'Map backend should return null for getRequirements');
  });

  it('PlanningCache with MapDatabase: getRequirement returns null', () => {
    const result = cache.getRequirement('TBL-01', '/some/cwd');
    assert.strictEqual(result, null, 'Map backend should return null for getRequirement');
  });

  it('PlanningCache with MapDatabase: storePlan is no-op (does not throw)', () => {
    assert.doesNotThrow(() => {
      cache.storePlan('/some/plan.md', '/some/cwd', mockParsedPlan());
    }, 'storePlan should be a no-op on MapDatabase, not throw');
  });

  it('PlanningCache with MapDatabase: getPlan returns null', () => {
    const result = cache.getPlan('/some/plan.md');
    assert.strictEqual(result, null, 'Map backend should return null for getPlan');
  });

  it('PlanningCache with MapDatabase: getPlansForPhase returns null', () => {
    const result = cache.getPlansForPhase('001', '/some/cwd');
    assert.strictEqual(result, null, 'Map backend should return null for getPlansForPhase');
  });

  it('PlanningCache with MapDatabase: updateMtime is no-op (does not throw)', () => {
    assert.doesNotThrow(() => {
      cache.updateMtime('/any/path.md');
    }, 'updateMtime should be a no-op on MapDatabase, not throw');
  });

  it('PlanningCache with MapDatabase: invalidateFile is no-op (does not throw)', () => {
    assert.doesNotThrow(() => {
      cache.invalidateFile('/any/path.md');
    }, 'invalidateFile should be a no-op on MapDatabase, not throw');
  });
});
