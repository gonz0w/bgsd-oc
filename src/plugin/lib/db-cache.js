/**
 * ESM-native database and cache adapter for plugin parsers.
 *
 * Provides the same interface as src/lib/db.js + src/lib/planning-cache.js
 * but using ESM `import` syntax so it can be bundled into plugin.js without
 * the CJS `__require` wrapper that fails in native ESM context.
 *
 * Design:
 *   - Tries `import { DatabaseSync } from 'node:sqlite'` via dynamic import (async)
 *   - On Node <22.5 or if node:sqlite unavailable: all operations no-op (MapBackend)
 *   - All cache operations are non-fatal — parsers fall through to markdown on any error
 *   - Singleton per cwd (same pattern as CJS getDb)
 *   - Top-level await used to initialize SQLite availability once at module load time
 */

import * as nodeFs from 'node:fs';
import * as nodePath from 'node:path';

// ---------------------------------------------------------------------------
// SQLite availability — initialized at module load via top-level await
// ---------------------------------------------------------------------------

let _DatabaseSync = null;

// Top-level await: try to load node:sqlite dynamically.
// node:sqlite is external in the plugin build — Node.js resolves at runtime.
// Gracefully degrades on Bun, old Node, or any runtime without node:sqlite.
try {
  // eslint-disable-next-line no-undef
  const m = await import('node:sqlite');
  if (m && m.DatabaseSync) {
    _DatabaseSync = m.DatabaseSync;
  }
} catch {
  // node:sqlite unavailable — _DatabaseSync stays null, MapBackend will be used
}

// ---------------------------------------------------------------------------
// MapBackend — no-op fallback
// ---------------------------------------------------------------------------

class MapBackend {
  get backend() { return 'map'; }
  exec() {}
  prepare() {
    return { get: () => undefined, all: () => [], run: () => ({ changes: 0 }) };
  }
  close() {}
}

// ---------------------------------------------------------------------------
// Schema SQL (version 5 — planning tables + memory stores + model_profiles + session state)
// ---------------------------------------------------------------------------

const SCHEMA_V5_SQL = `
  CREATE TABLE IF NOT EXISTS _meta (key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE IF NOT EXISTS file_cache (
    file_path TEXT PRIMARY KEY,
    mtime_ms  INTEGER NOT NULL,
    parsed_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS milestones (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    cwd         TEXT NOT NULL,
    name        TEXT NOT NULL,
    version     TEXT,
    status      TEXT NOT NULL DEFAULT 'pending',
    phase_start INTEGER,
    phase_end   INTEGER
  );
  CREATE TABLE IF NOT EXISTS phases (
    number       TEXT NOT NULL,
    cwd          TEXT NOT NULL,
    name         TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'incomplete',
    plan_count   INTEGER NOT NULL DEFAULT 0,
    goal         TEXT,
    depends_on   TEXT,
    requirements TEXT,
    section      TEXT,
    PRIMARY KEY (number, cwd)
  );
  CREATE TABLE IF NOT EXISTS progress (
    phase          TEXT NOT NULL,
    cwd            TEXT NOT NULL,
    plans_complete INTEGER NOT NULL DEFAULT 0,
    plans_total    INTEGER NOT NULL DEFAULT 0,
    status         TEXT,
    completed_date TEXT,
    PRIMARY KEY (phase, cwd)
  );
  CREATE TABLE IF NOT EXISTS plans (
    path           TEXT PRIMARY KEY,
    cwd            TEXT NOT NULL,
    phase_number   TEXT,
    plan_number    TEXT,
    wave           INTEGER,
    autonomous     INTEGER,
    objective      TEXT,
    task_count     INTEGER NOT NULL DEFAULT 0,
    frontmatter_json TEXT,
    raw            TEXT
  );
  CREATE TABLE IF NOT EXISTS tasks (
    plan_path TEXT NOT NULL,
    idx       INTEGER NOT NULL,
    type      TEXT NOT NULL DEFAULT 'auto',
    name      TEXT,
    files_json TEXT,
    action    TEXT,
    verify    TEXT,
    done      TEXT,
    PRIMARY KEY (plan_path, idx),
    FOREIGN KEY (plan_path) REFERENCES plans(path) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS requirements (
    req_id       TEXT NOT NULL,
    cwd          TEXT NOT NULL,
    phase_number TEXT,
    description  TEXT,
    PRIMARY KEY (req_id, cwd)
  );
  CREATE TABLE IF NOT EXISTS memory_decisions (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    cwd       TEXT NOT NULL,
    summary   TEXT,
    phase     TEXT,
    timestamp TEXT,
    data_json TEXT
  );
  CREATE TABLE IF NOT EXISTS memory_lessons (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    cwd       TEXT NOT NULL,
    summary   TEXT,
    phase     TEXT,
    timestamp TEXT,
    data_json TEXT
  );
  CREATE TABLE IF NOT EXISTS memory_trajectories (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    cwd             TEXT NOT NULL,
    entry_id        TEXT,
    category        TEXT,
    text            TEXT,
    phase           TEXT,
    scope           TEXT,
    checkpoint_name TEXT,
    attempt         INTEGER,
    confidence      TEXT,
    timestamp       TEXT,
    tags_json       TEXT,
    data_json       TEXT
  );
  CREATE TABLE IF NOT EXISTS memory_bookmarks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    cwd         TEXT NOT NULL,
    phase       TEXT,
    plan        TEXT,
    task        INTEGER,
    total_tasks INTEGER,
    git_head    TEXT,
    timestamp   TEXT,
    data_json   TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_phases_cwd ON phases(cwd);
  CREATE INDEX IF NOT EXISTS idx_plans_cwd ON plans(cwd);
  CREATE INDEX IF NOT EXISTS idx_plans_phase ON plans(phase_number);
  CREATE INDEX IF NOT EXISTS idx_tasks_plan ON tasks(plan_path);
  CREATE INDEX IF NOT EXISTS idx_requirements_cwd ON requirements(cwd);
  CREATE INDEX IF NOT EXISTS idx_file_cache_mtime ON file_cache(mtime_ms);
  CREATE INDEX IF NOT EXISTS idx_mem_decisions_cwd ON memory_decisions(cwd);
  CREATE INDEX IF NOT EXISTS idx_mem_decisions_phase ON memory_decisions(phase);
  CREATE INDEX IF NOT EXISTS idx_mem_lessons_cwd ON memory_lessons(cwd);
  CREATE INDEX IF NOT EXISTS idx_mem_lessons_phase ON memory_lessons(phase);
  CREATE INDEX IF NOT EXISTS idx_mem_trajectories_cwd ON memory_trajectories(cwd);
  CREATE INDEX IF NOT EXISTS idx_mem_trajectories_category ON memory_trajectories(category);
  CREATE INDEX IF NOT EXISTS idx_mem_trajectories_phase ON memory_trajectories(phase);
  CREATE INDEX IF NOT EXISTS idx_mem_bookmarks_cwd ON memory_bookmarks(cwd);
  CREATE TABLE IF NOT EXISTS model_profiles (
    agent_type     TEXT NOT NULL,
    cwd            TEXT NOT NULL,
    quality_model  TEXT NOT NULL DEFAULT 'opus',
    balanced_model TEXT NOT NULL DEFAULT 'sonnet',
    budget_model   TEXT NOT NULL DEFAULT 'haiku',
    override_model TEXT,
    PRIMARY KEY (agent_type, cwd)
  );
  CREATE INDEX IF NOT EXISTS idx_model_profiles_cwd ON model_profiles(cwd);
  CREATE TABLE IF NOT EXISTS session_state (
    cwd            TEXT PRIMARY KEY,
    phase_number   TEXT,
    phase_name     TEXT,
    total_phases   INTEGER,
    current_plan   TEXT,
    status         TEXT,
    last_activity  TEXT,
    progress       INTEGER,
    milestone      TEXT,
    data_json      TEXT
  );
  CREATE TABLE IF NOT EXISTS session_metrics (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    cwd         TEXT NOT NULL,
    milestone   TEXT,
    phase       TEXT,
    plan        TEXT,
    duration    TEXT,
    tasks       INTEGER,
    files       INTEGER,
    test_count  INTEGER,
    timestamp   TEXT,
    data_json   TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_session_metrics_cwd ON session_metrics(cwd);
  CREATE INDEX IF NOT EXISTS idx_session_metrics_phase ON session_metrics(phase);
  CREATE TABLE IF NOT EXISTS session_decisions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    cwd         TEXT NOT NULL,
    milestone   TEXT,
    phase       TEXT,
    summary     TEXT,
    rationale   TEXT,
    timestamp   TEXT,
    data_json   TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_session_decisions_cwd ON session_decisions(cwd);
  CREATE INDEX IF NOT EXISTS idx_session_decisions_phase ON session_decisions(phase);
  CREATE TABLE IF NOT EXISTS session_todos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    cwd         TEXT NOT NULL,
    text        TEXT NOT NULL,
    priority    TEXT,
    category    TEXT,
    status      TEXT NOT NULL DEFAULT 'pending',
    created_at  TEXT,
    completed_at TEXT,
    data_json   TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_session_todos_cwd ON session_todos(cwd);
  CREATE INDEX IF NOT EXISTS idx_session_todos_status ON session_todos(status);
  CREATE TABLE IF NOT EXISTS session_blockers (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    cwd            TEXT NOT NULL,
    text           TEXT NOT NULL,
    status         TEXT NOT NULL DEFAULT 'open',
    created_at     TEXT,
    resolved_at    TEXT,
    resolution     TEXT,
    linked_decision_id INTEGER,
    data_json      TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_session_blockers_cwd ON session_blockers(cwd);
  CREATE INDEX IF NOT EXISTS idx_session_blockers_status ON session_blockers(status);
  CREATE TABLE IF NOT EXISTS session_continuity (
    cwd          TEXT PRIMARY KEY,
    last_session TEXT,
    stopped_at   TEXT,
    next_step    TEXT,
    data_json    TEXT
  );
`;

// ---------------------------------------------------------------------------
// SQLiteBackend
// ---------------------------------------------------------------------------

class SQLiteBackend {
  constructor(dbPath) {
    this._dbPath = dbPath;
    this._degraded = false;
    this._db = null;

    try {
      // Try with defensive: false for Node ≥25.5
      try {
        this._db = new _DatabaseSync(dbPath, { timeout: 5000, defensive: false });
      } catch {
        try {
          this._db = new _DatabaseSync(dbPath, { timeout: 5000 });
        } catch {
          this._db = new _DatabaseSync(dbPath);
        }
      }
      try { this._db.exec('PRAGMA busy_timeout = 5000'); } catch {}
      this._db.exec('PRAGMA journal_mode = WAL');
      this._ensureSchema();
    } catch {
      this._degraded = true;
    }
  }

  _ensureSchema() {
    let version = 0;
    try {
      const row = this._db.prepare('PRAGMA user_version').get();
      version = row ? row.user_version : 0;
    } catch {}

    if (version >= 5) return;

    try {
      this._db.exec('BEGIN');
      this._db.exec(SCHEMA_V5_SQL);
      this._db.exec("INSERT OR REPLACE INTO _meta (key, value) VALUES ('created_at', '" + new Date().toISOString() + "')");
      this._db.exec('PRAGMA user_version = 5');
      this._db.exec('COMMIT');
    } catch {
      try { this._db.exec('ROLLBACK'); } catch {}
      // Try delete-and-rebuild
      try {
        this._db.close();
        for (const suffix of ['', '-wal', '-shm']) {
          const fp = this._dbPath + suffix;
          if (nodeFs.existsSync(fp)) try { nodeFs.unlinkSync(fp); } catch {}
        }
        this._db = new _DatabaseSync(this._dbPath);
        this._db.exec('PRAGMA journal_mode = WAL');
        this._db.exec('BEGIN');
        this._db.exec(SCHEMA_V5_SQL);
        this._db.exec("INSERT OR REPLACE INTO _meta (key, value) VALUES ('created_at', '" + new Date().toISOString() + "')");
        this._db.exec('PRAGMA user_version = 5');
        this._db.exec('COMMIT');
      } catch {
        this._degraded = true;
      }
    }
  }

  get backend() { return 'sqlite'; }
  exec(sql) { this._db.exec(sql); }
  prepare(sql) { return this._db.prepare(sql); }
  close() { try { this._db.close(); } catch {} }
}

// ---------------------------------------------------------------------------
// Singleton instance cache
// ---------------------------------------------------------------------------

const _instances = new Map();

/**
 * Get (or create) a backend instance for the given cwd.
 * Returns SQLiteBackend on Node 22.5+, MapBackend otherwise.
 *
 * @param {string} cwd
 * @returns {SQLiteBackend|MapBackend}
 */
export function getDb(cwd) {
  cwd = cwd || process.cwd();
  const resolvedCwd = nodePath.resolve(cwd);

  if (_instances.has(resolvedCwd)) return _instances.get(resolvedCwd);

  let db;
  const planningDir = nodePath.join(resolvedCwd, '.planning');
  const planningExists = nodeFs.existsSync(planningDir);

  if (planningExists && _DatabaseSync) {
    const dbPath = nodePath.join(planningDir, '.cache.db');
    try {
      const instance = new SQLiteBackend(dbPath);
      db = instance._degraded ? new MapBackend() : instance;
    } catch {
      db = new MapBackend();
    }
  } else {
    db = new MapBackend();
  }

  _instances.set(resolvedCwd, db);
  return db;
}

// ---------------------------------------------------------------------------
// PlanningCache — ESM-native (same interface as CJS src/lib/planning-cache.js)
// ---------------------------------------------------------------------------

export class PlanningCache {
  constructor(db) {
    this._db = db;
    this._stmts = {};
  }

  _isMap() { return this._db.backend === 'map'; }

  _stmt(key, sql) {
    if (!this._stmts[key]) this._stmts[key] = this._db.prepare(sql);
    return this._stmts[key];
  }

  checkFreshness(filePath) {
    if (this._isMap()) return 'missing';
    try {
      const row = this._stmt('fc_get', 'SELECT mtime_ms FROM file_cache WHERE file_path = ?').get(filePath);
      if (!row) return 'missing';
      const currentMtime = nodeFs.statSync(filePath).mtimeMs;
      return currentMtime === row.mtime_ms ? 'fresh' : 'stale';
    } catch { return 'missing'; }
  }

  checkAllFreshness(filePaths) {
    const result = { fresh: [], stale: [], missing: [] };
    for (const fp of filePaths) result[this.checkFreshness(fp)].push(fp);
    return result;
  }

  invalidateFile(filePath) {
    if (this._isMap()) return;
    try {
      this._db.exec('BEGIN');
      this._stmt('fc_del', 'DELETE FROM file_cache WHERE file_path = ?').run(filePath);
      this._stmt('plans_del_path', 'DELETE FROM plans WHERE path = ?').run(filePath);
      this._db.exec('COMMIT');
    } catch { try { this._db.exec('ROLLBACK'); } catch {} }
  }

  clearForCwd(cwd) {
    if (this._isMap()) return;
    try {
      this._db.exec('BEGIN');
      this._stmt('ph_del_cwd', 'DELETE FROM phases WHERE cwd = ?').run(cwd);
      this._stmt('ms_del_cwd', 'DELETE FROM milestones WHERE cwd = ?').run(cwd);
      this._stmt('pr_del_cwd', 'DELETE FROM progress WHERE cwd = ?').run(cwd);
      this._stmt('rq_del_cwd', 'DELETE FROM requirements WHERE cwd = ?').run(cwd);
      this._stmt('pl_del_cwd', 'DELETE FROM plans WHERE cwd = ?').run(cwd);
      this._stmt('fc_del_cwd', "DELETE FROM file_cache WHERE file_path LIKE ?").run(cwd + '%');
      this._db.exec('COMMIT');
    } catch { try { this._db.exec('ROLLBACK'); } catch {} }
  }

  _updateMtimeInTx(filePath) {
    try {
      const mtime_ms = nodeFs.statSync(filePath).mtimeMs;
      this._stmt('fc_upsert', "INSERT OR REPLACE INTO file_cache (file_path, mtime_ms, parsed_at) VALUES (?, ?, ?)").run(filePath, mtime_ms, new Date().toISOString());
    } catch {}
  }

  storeRoadmap(cwd, roadmapPath, parsed) {
    if (this._isMap()) return;
    try {
      this._db.exec('BEGIN');
      this._stmt('ph_del_cwd2', 'DELETE FROM phases WHERE cwd = ?').run(cwd);
      this._stmt('ms_del_cwd2', 'DELETE FROM milestones WHERE cwd = ?').run(cwd);
      this._stmt('pr_del_cwd2', 'DELETE FROM progress WHERE cwd = ?').run(cwd);
      this._stmt('rq_del_cwd2', 'DELETE FROM requirements WHERE cwd = ?').run(cwd);

      const phIns = this._stmt('ph_ins', `INSERT OR REPLACE INTO phases (number, cwd, name, status, plan_count, goal, depends_on, requirements, section) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const p of (parsed.phases || [])) {
        phIns.run(p.number || '', cwd, p.name || '', p.status || 'incomplete',
          p.plan_count != null ? p.plan_count : 0, p.goal || null,
          p.depends_on ? JSON.stringify(p.depends_on) : null,
          p.requirements ? JSON.stringify(p.requirements) : null,
          p.section || null);
      }

      const msIns = this._stmt('ms_ins', `INSERT INTO milestones (cwd, name, version, status, phase_start, phase_end) VALUES (?, ?, ?, ?, ?, ?)`);
      for (const m of (parsed.milestones || [])) {
        msIns.run(cwd, m.name || '', m.version || null, m.status || 'pending',
          m.phase_start != null ? m.phase_start : null, m.phase_end != null ? m.phase_end : null);
      }

      const prIns = this._stmt('pr_ins', `INSERT OR REPLACE INTO progress (phase, cwd, plans_complete, plans_total, status, completed_date) VALUES (?, ?, ?, ?, ?, ?)`);
      for (const p of (parsed.progress || [])) {
        prIns.run(p.phase || '', cwd, p.plans_complete != null ? p.plans_complete : 0,
          p.plans_total != null ? p.plans_total : 0, p.status || null, p.completed_date || null);
      }

      const rqIns = this._stmt('rq_ins', `INSERT OR REPLACE INTO requirements (req_id, cwd, phase_number, description) VALUES (?, ?, ?, ?)`);
      const reqs = parsed.requirements || _extractRequirementsFromPhases(parsed.phases || []);
      for (const r of reqs) {
        rqIns.run(r.req_id || r.id || '', cwd, r.phase_number || r.phase || null, r.description || null);
      }

      if (roadmapPath) this._updateMtimeInTx(roadmapPath);
      this._db.exec('COMMIT');
    } catch { try { this._db.exec('ROLLBACK'); } catch {} }
  }

  storePlan(planPath, cwd, parsed) {
    if (this._isMap()) return;
    try {
      this._db.exec('BEGIN');
      this._stmt('pl_del_path', 'DELETE FROM plans WHERE path = ?').run(planPath);
      const fm = parsed.frontmatter || {};
      this._stmt('pl_ins', `INSERT OR REPLACE INTO plans (path, cwd, phase_number, plan_number, wave, autonomous, objective, task_count, frontmatter_json, raw) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(planPath, cwd,
        fm.phase ? String(fm.phase).split('-')[0] : null,
        fm.plan != null ? String(fm.plan) : null,
        fm.wave != null ? fm.wave : null,
        fm.autonomous != null ? (fm.autonomous ? 1 : 0) : null,
        parsed.objective || null,
        (parsed.tasks || []).length,
        JSON.stringify(fm),
        parsed.raw || null);

      const tkIns = this._stmt('tk_ins', `INSERT OR REPLACE INTO tasks (plan_path, idx, type, name, files_json, action, verify, done) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
      for (let i = 0; i < (parsed.tasks || []).length; i++) {
        const t = parsed.tasks[i];
        tkIns.run(planPath, i, t.type || 'auto', t.name || null,
          t.files ? JSON.stringify(t.files) : null, t.action || null, t.verify || null, t.done || null);
      }

      this._updateMtimeInTx(planPath);
      this._db.exec('COMMIT');
    } catch { try { this._db.exec('ROLLBACK'); } catch {} }
  }

  getPhases(cwd) {
    if (this._isMap()) return null;
    try {
      const rows = this._stmt('ph_all', 'SELECT * FROM phases WHERE cwd = ? ORDER BY number').all(cwd);
      return rows.length > 0 ? rows : null;
    } catch { return null; }
  }

  getPhase(number, cwd) {
    if (this._isMap()) return null;
    try {
      const row = this._stmt('ph_one', 'SELECT * FROM phases WHERE number = ? AND cwd = ?').get(number, cwd);
      return row || null;
    } catch { return null; }
  }

  getPlans(cwd) {
    if (this._isMap()) return null;
    try {
      const rows = this._stmt('pl_all', 'SELECT * FROM plans WHERE cwd = ? ORDER BY phase_number, plan_number').all(cwd);
      return rows.length > 0 ? rows : null;
    } catch { return null; }
  }

  getPlan(planPath) {
    if (this._isMap()) return null;
    try {
      const plan = this._stmt('pl_one', 'SELECT * FROM plans WHERE path = ?').get(planPath);
      if (!plan) return null;
      const tasks = this._stmt('tk_for_plan', 'SELECT * FROM tasks WHERE plan_path = ? ORDER BY idx').all(planPath);
      return { ...plan, tasks };
    } catch { return null; }
  }

  getPlansForPhase(phaseNumber, cwd) {
    if (this._isMap()) return null;
    try {
      const rows = this._stmt('pl_phase', 'SELECT * FROM plans WHERE phase_number = ? AND cwd = ? ORDER BY plan_number').all(phaseNumber, cwd);
      return rows.length > 0 ? rows : null;
    } catch { return null; }
  }

  /**
   * Get summary count for a phase by checking which plan paths have matching SUMMARY files on disk.
   * Returns { planCount, summaryCount, summaryFiles } or null on Map backend / error.
   *
   * @param {number|string} phaseNumber - Phase number
   * @param {string} cwd - Working directory
   * @returns {{ planCount: number, summaryCount: number, summaryFiles: string[] } | null}
   */
  getSummaryCount(phaseNumber, cwd) {
    if (this._isMap()) return null;
    try {
      const rows = this._stmt('pl_phase2', 'SELECT path FROM plans WHERE phase_number = ? AND cwd = ? ORDER BY plan_number').all(String(phaseNumber), cwd);
      if (!rows || rows.length === 0) return null;
      const summaryFiles = [];
      for (const row of rows) {
        // Derive summary path from plan path
        const summaryPath = row.path.replace(/-PLAN\.md$/, '-SUMMARY.md');
        const summaryName = summaryPath.split('/').pop();
        if (nodeFs.existsSync(summaryPath)) {
          summaryFiles.push(summaryName);
        }
      }
      return { planCount: rows.length, summaryCount: summaryFiles.length, summaryFiles };
    } catch { return null; }
  }

  /**
   * Get incomplete plan filenames (those without a matching SUMMARY file) for a phase.
   * Returns array of incomplete plan filenames or null on Map backend / error.
   *
   * @param {number|string} phaseNumber - Phase number
   * @param {string} cwd - Working directory
   * @returns {string[] | null}
   */
  getIncompletePlans(phaseNumber, cwd) {
    if (this._isMap()) return null;
    try {
      const rows = this._stmt('pl_phase3', 'SELECT path FROM plans WHERE phase_number = ? AND cwd = ? ORDER BY plan_number').all(String(phaseNumber), cwd);
      if (!rows || rows.length === 0) return null;
      const incomplete = [];
      for (const row of rows) {
        const summaryPath = row.path.replace(/-PLAN\.md$/, '-SUMMARY.md');
        if (!nodeFs.existsSync(summaryPath)) {
          incomplete.push(row.path.split('/').pop());
        }
      }
      return incomplete;
    } catch { return null; }
  }

  getRequirements(cwd) {
    if (this._isMap()) return null;
    try {
      const rows = this._stmt('rq_all', 'SELECT * FROM requirements WHERE cwd = ? ORDER BY req_id').all(cwd);
      return rows.length > 0 ? rows : null;
    } catch { return null; }
  }

  getRequirement(reqId, cwd) {
    if (this._isMap()) return null;
    try {
      const row = this._stmt('rq_one', 'SELECT * FROM requirements WHERE req_id = ? AND cwd = ?').get(reqId, cwd);
      return row || null;
    } catch { return null; }
  }

  getMilestones(cwd) {
    if (this._isMap()) return null;
    try {
      const rows = this._stmt('ms_all', 'SELECT * FROM milestones WHERE cwd = ? ORDER BY id').all(cwd);
      return rows.length > 0 ? rows : null;
    } catch { return null; }
  }

  getProgress(cwd) {
    if (this._isMap()) return null;
    try {
      const rows = this._stmt('pr_all', 'SELECT * FROM progress WHERE cwd = ? ORDER BY phase').all(cwd);
      return rows.length > 0 ? rows : null;
    } catch { return null; }
  }

  /**
   * Get model profile row for a specific cwd and agent type.
   * Falls back to '__defaults__' cwd if no project-specific override exists.
   *
   * @param {string} cwd - Project root directory
   * @param {string} agentType - Agent type (e.g. 'bgsd-planner')
   * @returns {{ quality_model: string, balanced_model: string, budget_model: string, override_model: string|null }|null}
   */
  getModelProfile(cwd, agentType) {
    if (this._isMap()) return null;
    try {
      const row = this._stmt('mp_get_cwd', 'SELECT * FROM model_profiles WHERE agent_type = ? AND cwd = ?').get(agentType, cwd);
      if (row) return row;
      const defaultRow = this._stmt('mp_get_def', "SELECT * FROM model_profiles WHERE agent_type = ? AND cwd = '__defaults__'").get(agentType);
      return defaultRow || null;
    } catch { return null; }
  }

  /**
   * Get all model profiles for a cwd. Falls back to '__defaults__' if none found.
   *
   * @param {string} cwd - Project root directory
   * @returns {Array|null}
   */
  getModelProfiles(cwd) {
    if (this._isMap()) return null;
    try {
      const rows = this._stmt('mp_all_cwd', 'SELECT * FROM model_profiles WHERE cwd = ? ORDER BY agent_type').all(cwd);
      if (rows && rows.length > 0) return rows;
      const defaults = this._stmt('mp_all_def', "SELECT * FROM model_profiles WHERE cwd = '__defaults__' ORDER BY agent_type").all();
      return defaults && defaults.length > 0 ? defaults : null;
    } catch { return null; }
  }

  /**
   * Seed model profile defaults for a project cwd from '__defaults__' rows.
   * No-op if project-specific rows already exist for this cwd.
   *
   * @param {string} cwd - Project root directory
   */
  seedModelDefaults(cwd) {
    if (this._isMap()) return;
    try {
      const existing = this._stmt('mp_count', 'SELECT COUNT(*) AS cnt FROM model_profiles WHERE cwd = ?').get(cwd);
      if (existing && existing.cnt > 0) return;
      const defaults = this._stmt('mp_seed_def', "SELECT * FROM model_profiles WHERE cwd = '__defaults__'").all();
      if (!defaults || defaults.length === 0) return;
      const ins = this._stmt('mp_seed_ins', `INSERT OR IGNORE INTO model_profiles (agent_type, cwd, quality_model, balanced_model, budget_model, override_model) VALUES (?, ?, ?, ?, ?, ?)`);
      this._db.exec('BEGIN');
      for (const row of defaults) {
        ins.run(row.agent_type, cwd, row.quality_model, row.balanced_model, row.budget_model, row.override_model || null);
      }
      this._db.exec('COMMIT');
    } catch { try { this._db.exec('ROLLBACK'); } catch {} }
  }

  // -------------------------------------------------------------------------
  // Session State Operations (Phase 123)
  // -------------------------------------------------------------------------

  storeSessionState(cwd, state) {
    if (this._isMap()) return null;
    try {
      this._stmt('ss_upsert', `INSERT OR REPLACE INTO session_state (cwd, phase_number, phase_name, total_phases, current_plan, status, last_activity, progress, milestone, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(cwd, state.phase_number || null, state.phase_name || null, state.total_phases != null ? state.total_phases : null, state.current_plan || null, state.status || null, state.last_activity || null, state.progress != null ? state.progress : null, state.milestone || null, JSON.stringify(state));
      return { stored: true };
    } catch { return null; }
  }

  getSessionState(cwd) {
    if (this._isMap()) return null;
    try {
      const row = this._stmt('ss_get', 'SELECT * FROM session_state WHERE cwd = ?').get(cwd);
      return row || null;
    } catch { return null; }
  }

  migrateStateFromMarkdown(cwd, parsed) {
    if (this._isMap()) return null;
    try {
      const existing = this._stmt('ss_check', 'SELECT cwd FROM session_state WHERE cwd = ?').get(cwd);
      if (existing) return { migrated: false, reason: 'already_exists' };
      this._db.exec('BEGIN');
      this._stmt('ss_upsert2', `INSERT OR REPLACE INTO session_state (cwd, phase_number, phase_name, total_phases, current_plan, status, last_activity, progress, milestone, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(cwd, parsed.phase_number || null, parsed.phase_name || null, parsed.total_phases != null ? parsed.total_phases : null, parsed.current_plan || null, parsed.status || null, parsed.last_activity || null, parsed.progress != null ? parsed.progress : null, parsed.milestone || null, JSON.stringify(parsed));
      if (Array.isArray(parsed.decisions) && parsed.decisions.length > 0) {
        const ins = this._stmt('ss_dec_ins', 'INSERT INTO session_decisions (cwd, milestone, phase, summary, rationale, timestamp, data_json) VALUES (?, ?, ?, ?, ?, ?, ?)');
        for (const d of parsed.decisions) ins.run(cwd, d.milestone || null, d.phase || null, d.summary || null, d.rationale || null, d.timestamp || null, JSON.stringify(d));
      }
      if (Array.isArray(parsed.metrics) && parsed.metrics.length > 0) {
        const ins = this._stmt('ss_met_ins', 'INSERT INTO session_metrics (cwd, milestone, phase, plan, duration, tasks, files, test_count, timestamp, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        for (const m of parsed.metrics) ins.run(cwd, m.milestone || null, m.phase || null, m.plan || null, m.duration || null, m.tasks != null ? m.tasks : null, m.files != null ? m.files : null, m.test_count != null ? m.test_count : null, m.timestamp || null, JSON.stringify(m));
      }
      if (Array.isArray(parsed.todos) && parsed.todos.length > 0) {
        const ins = this._stmt('ss_todo_ins', 'INSERT INTO session_todos (cwd, text, priority, category, status, created_at, data_json) VALUES (?, ?, ?, ?, ?, ?, ?)');
        for (const t of parsed.todos) ins.run(cwd, t.text || '', t.priority || null, t.category || null, t.status || 'pending', t.created_at || null, JSON.stringify(t));
      }
      if (Array.isArray(parsed.blockers) && parsed.blockers.length > 0) {
        const ins = this._stmt('ss_blk_ins', 'INSERT INTO session_blockers (cwd, text, status, created_at, data_json) VALUES (?, ?, ?, ?, ?)');
        for (const b of parsed.blockers) ins.run(cwd, b.text || '', b.status || 'open', b.created_at || null, JSON.stringify(b));
      }
      if (parsed.continuity) {
        const c = parsed.continuity;
        this._stmt('ss_cont_ins', 'INSERT OR REPLACE INTO session_continuity (cwd, last_session, stopped_at, next_step, data_json) VALUES (?, ?, ?, ?, ?)').run(cwd, c.last_session || null, c.stopped_at || null, c.next_step || null, JSON.stringify(c));
      }
      this._db.exec('COMMIT');
      return { migrated: true };
    } catch { try { this._db.exec('ROLLBACK'); } catch {} return null; }
  }

  writeSessionMetric(cwd, metric) {
    if (this._isMap()) return null;
    try {
      this._stmt('sm_ins', 'INSERT INTO session_metrics (cwd, milestone, phase, plan, duration, tasks, files, test_count, timestamp, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(cwd, metric.milestone || null, metric.phase || null, metric.plan || null, metric.duration || null, metric.tasks != null ? metric.tasks : null, metric.files != null ? metric.files : null, metric.test_count != null ? metric.test_count : null, metric.timestamp || null, JSON.stringify(metric));
      return { inserted: true };
    } catch { return null; }
  }

  getSessionMetrics(cwd, options) {
    if (this._isMap()) return null;
    try {
      const opts = options || {};
      const limit = opts.limit != null ? opts.limit : 100;
      let w = 'cwd = ?'; const p = [cwd];
      if (opts.phase) { w += ' AND phase = ?'; p.push(opts.phase); }
      const total = (this._db.prepare('SELECT COUNT(*) AS cnt FROM session_metrics WHERE ' + w).get(...p) || {}).cnt || 0;
      const rows = this._db.prepare('SELECT * FROM session_metrics WHERE ' + w + ' ORDER BY id DESC LIMIT ?').all(...p, limit);
      return { entries: rows.map(r => { try { return JSON.parse(r.data_json); } catch { return r; } }), total };
    } catch { return null; }
  }

  writeSessionDecision(cwd, decision) {
    if (this._isMap()) return null;
    try {
      this._stmt('sd_ins', 'INSERT INTO session_decisions (cwd, milestone, phase, summary, rationale, timestamp, data_json) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(cwd, decision.milestone || null, decision.phase || null, decision.summary || null, decision.rationale || null, decision.timestamp || null, JSON.stringify(decision));
      return { inserted: true };
    } catch { return null; }
  }

  getSessionDecisions(cwd, options) {
    if (this._isMap()) return null;
    try {
      const opts = options || {};
      const limit = opts.limit != null ? opts.limit : 100;
      const offset = opts.offset != null ? opts.offset : 0;
      let w = 'cwd = ?'; const p = [cwd];
      if (opts.phase) { w += ' AND phase = ?'; p.push(opts.phase); }
      const total = (this._db.prepare('SELECT COUNT(*) AS cnt FROM session_decisions WHERE ' + w).get(...p) || {}).cnt || 0;
      const rows = this._db.prepare('SELECT * FROM session_decisions WHERE ' + w + ' ORDER BY id DESC LIMIT ? OFFSET ?').all(...p, limit, offset);
      return { entries: rows.map(r => { try { return JSON.parse(r.data_json); } catch { return r; } }), total };
    } catch { return null; }
  }

  writeSessionTodo(cwd, todo) {
    if (this._isMap()) return null;
    try {
      const result = this._stmt('st_ins', 'INSERT INTO session_todos (cwd, text, priority, category, status, created_at, data_json) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(cwd, todo.text || '', todo.priority || null, todo.category || null, todo.status || 'pending', todo.created_at || null, JSON.stringify(todo));
      return { inserted: true, id: result ? result.lastInsertRowid : null };
    } catch { return null; }
  }

  getSessionTodos(cwd, options) {
    if (this._isMap()) return null;
    try {
      const opts = options || {};
      const limit = opts.limit != null ? opts.limit : 100;
      let w = 'cwd = ?'; const p = [cwd];
      if (opts.status) { w += ' AND status = ?'; p.push(opts.status); }
      const total = (this._db.prepare('SELECT COUNT(*) AS cnt FROM session_todos WHERE ' + w).get(...p) || {}).cnt || 0;
      const rows = this._db.prepare('SELECT * FROM session_todos WHERE ' + w + ' ORDER BY id DESC LIMIT ?').all(...p, limit);
      return { entries: rows.map(r => { try { return JSON.parse(r.data_json); } catch { return r; } }), total };
    } catch { return null; }
  }

  completeSessionTodo(cwd, id) {
    if (this._isMap()) return null;
    try {
      this._stmt('st_complete', "UPDATE session_todos SET status='completed', completed_at=? WHERE id=? AND cwd=?").run(new Date().toISOString(), id, cwd);
      return { updated: true };
    } catch { return null; }
  }

  writeSessionBlocker(cwd, blocker) {
    if (this._isMap()) return null;
    try {
      const result = this._stmt('sb_ins', 'INSERT INTO session_blockers (cwd, text, status, created_at, data_json) VALUES (?, ?, ?, ?, ?)'
      ).run(cwd, blocker.text || '', blocker.status || 'open', blocker.created_at || null, JSON.stringify(blocker));
      return { inserted: true, id: result ? result.lastInsertRowid : null };
    } catch { return null; }
  }

  getSessionBlockers(cwd, options) {
    if (this._isMap()) return null;
    try {
      const opts = options || {};
      const limit = opts.limit != null ? opts.limit : 100;
      let w = 'cwd = ?'; const p = [cwd];
      if (opts.status) { w += ' AND status = ?'; p.push(opts.status); }
      const total = (this._db.prepare('SELECT COUNT(*) AS cnt FROM session_blockers WHERE ' + w).get(...p) || {}).cnt || 0;
      const rows = this._db.prepare('SELECT * FROM session_blockers WHERE ' + w + ' ORDER BY id DESC LIMIT ?').all(...p, limit);
      return { entries: rows.map(r => { try { return JSON.parse(r.data_json); } catch { return r; } }), total };
    } catch { return null; }
  }

  resolveSessionBlocker(cwd, id, resolution) {
    if (this._isMap()) return null;
    try {
      this._stmt('sb_resolve', "UPDATE session_blockers SET status='resolved', resolved_at=?, resolution=? WHERE id=? AND cwd=?").run(new Date().toISOString(), resolution || null, id, cwd);
      return { updated: true };
    } catch { return null; }
  }

  recordSessionContinuity(cwd, continuity) {
    if (this._isMap()) return null;
    try {
      this._stmt('sc_upsert', 'INSERT OR REPLACE INTO session_continuity (cwd, last_session, stopped_at, next_step, data_json) VALUES (?, ?, ?, ?, ?)'
      ).run(cwd, continuity.last_session || null, continuity.stopped_at || null, continuity.next_step || null, JSON.stringify(continuity));
      return { stored: true };
    } catch { return null; }
  }

  getSessionContinuity(cwd) {
    if (this._isMap()) return null;
    try {
      const row = this._stmt('sc_get', 'SELECT * FROM session_continuity WHERE cwd = ?').get(cwd);
      return row || null;
    } catch { return null; }
  }
}

// ---------------------------------------------------------------------------
// Requirements extraction helper
// ---------------------------------------------------------------------------

function _extractRequirementsFromPhases(phases) {
  const requirements = [];
  for (const phase of phases) {
    const section = phase.section || '';
    if (!section) continue;
    const inlineMatch = section.match(/\*\*Requirements?\*\*:\s*([^\n]+)/i);
    if (inlineMatch) {
      const ids = inlineMatch[1].split(/[,\s]+/).filter(id => /^[A-Z]+-\d+/.test(id));
      for (const id of ids) {
        requirements.push({ req_id: id, phase_number: phase.number || '', description: null });
      }
    }
    const checkboxPattern = /- \[[ x]\] \*\*([A-Z]+-\d+)\*\*:?\s*([^\n]*)/g;
    let match;
    while ((match = checkboxPattern.exec(section)) !== null) {
      requirements.push({ req_id: match[1], phase_number: phase.number || '', description: match[2].trim() || null });
    }
  }
  return requirements;
}
