'use strict';

/**
 * PlanningCache — mtime-based cache layer for planning file data.
 *
 * Wraps a db instance (SQLiteDatabase or MapDatabase) with planning-specific
 * read/write operations for roadmap phases, plans, tasks, and requirements.
 *
 * Design principles:
 *   - MapDatabase backend → all reads return null/empty (transparent cache miss)
 *   - All store operations are wrapped in transactions for atomicity
 *   - Prepared statements are created lazily and cached on the instance
 *   - mtime_ms comparison drives stale/fresh/missing decisions
 *
 * Usage:
 *   const { getDb } = require('./db');
 *   const { PlanningCache } = require('./planning-cache');
 *   const db = getDb(cwd);
 *   const cache = new PlanningCache(db);
 *   const freshness = cache.checkFreshness('/path/to/ROADMAP.md');
 */

const fs = require('fs');

// ---------------------------------------------------------------------------
// PlanningCache class
// ---------------------------------------------------------------------------

class PlanningCache {
  /**
   * @param {import('./db').SQLiteDatabase|import('./db').MapDatabase} db
   */
  constructor(db) {
    this._db = db;
    this._stmts = {}; // lazy prepared statement cache
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Whether the backend is a MapDatabase (no persistent storage).
   * @returns {boolean}
   * @private
   */
  _isMap() {
    return this._db.backend === 'map';
  }

  /**
   * Get or create a lazy prepared statement.
   * @param {string} key - Unique identifier for caching
   * @param {string} sql
   * @returns {import('node:sqlite').StatementSync}
   * @private
   */
  _stmt(key, sql) {
    if (!this._stmts[key]) {
      this._stmts[key] = this._db.prepare(sql);
    }
    return this._stmts[key];
  }

  // -------------------------------------------------------------------------
  // Mtime Invalidation
  // -------------------------------------------------------------------------

  /**
   * Check whether a file's cached mtime matches its current mtime.
   *
   * @param {string} filePath - Absolute or relative file path
   * @returns {'fresh'|'stale'|'missing'} - missing if no cache entry or any error
   */
  checkFreshness(filePath) {
    if (this._isMap()) return 'missing';

    try {
      const row = this._stmt(
        'file_cache_get',
        'SELECT mtime_ms FROM file_cache WHERE file_path = ?'
      ).get(filePath);

      if (!row) return 'missing';

      const currentMtime = fs.statSync(filePath).mtimeMs;
      return currentMtime === row.mtime_ms ? 'fresh' : 'stale';
    } catch {
      return 'missing';
    }
  }

  /**
   * Store the current mtime of a file in file_cache.
   *
   * @param {string} filePath
   */
  updateMtime(filePath) {
    if (this._isMap()) return;

    try {
      const mtime_ms = fs.statSync(filePath).mtimeMs;
      this._stmt(
        'file_cache_upsert',
        "INSERT OR REPLACE INTO file_cache (file_path, mtime_ms, parsed_at) VALUES (?, ?, ?)"
      ).run(filePath, mtime_ms, new Date().toISOString());
    } catch {
      // Non-critical — ignore errors updating mtime
    }
  }

  /**
   * Bulk freshness check for multiple files.
   *
   * @param {string[]} filePaths
   * @returns {{ fresh: string[], stale: string[], missing: string[] }}
   */
  checkAllFreshness(filePaths) {
    const result = { fresh: [], stale: [], missing: [] };
    for (const fp of filePaths) {
      const status = this.checkFreshness(fp);
      result[status].push(fp);
    }
    return result;
  }

  /**
   * Remove file_cache entry for a file and all dependent data.
   * For roadmap files: removes phases, milestones, progress, requirements.
   * For plan files: removes plan + tasks.
   *
   * @param {string} filePath
   */
  invalidateFile(filePath) {
    if (this._isMap()) return;

    try {
      this._db.exec('BEGIN');
      this._stmt(
        'file_cache_delete',
        'DELETE FROM file_cache WHERE file_path = ?'
      ).run(filePath);
      // Also remove plan+tasks if filePath is a plan path
      this._stmt(
        'plans_delete_by_path',
        'DELETE FROM plans WHERE path = ?'
      ).run(filePath);
      this._db.exec('COMMIT');
    } catch {
      try { this._db.exec('ROLLBACK'); } catch { /* ignore */ }
    }
  }

  // -------------------------------------------------------------------------
  // Store Operations (write-through)
  // -------------------------------------------------------------------------

  /**
   * Store parsed roadmap data for a project.
   * Deletes all existing phases/milestones/progress/requirements for cwd,
   * then inserts fresh data. Updates file_cache mtime for roadmapPath.
   *
   * @param {string} cwd - Project root directory
   * @param {string} roadmapPath - Path to ROADMAP.md
   * @param {object} parsed - Output from roadmap parser
   * @param {Array} [parsed.phases]
   * @param {Array} [parsed.milestones]
   * @param {Array} [parsed.progress]
   * @param {Array} [parsed.requirements]
   */
  storeRoadmap(cwd, roadmapPath, parsed) {
    if (this._isMap()) return;

    try {
      this._db.exec('BEGIN');

      // Delete existing data for this cwd
      this._stmt('phases_delete_cwd', 'DELETE FROM phases WHERE cwd = ?').run(cwd);
      this._stmt('milestones_delete_cwd', 'DELETE FROM milestones WHERE cwd = ?').run(cwd);
      this._stmt('progress_delete_cwd', 'DELETE FROM progress WHERE cwd = ?').run(cwd);
      this._stmt('requirements_delete_cwd', 'DELETE FROM requirements WHERE cwd = ?').run(cwd);

      // Insert phases
      const phaseInsert = this._stmt(
        'phases_insert',
        `INSERT OR REPLACE INTO phases
         (number, cwd, name, status, plan_count, goal, depends_on, requirements, section)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const phase of (parsed.phases || [])) {
        phaseInsert.run(
          phase.number || '',
          cwd,
          phase.name || '',
          phase.status || 'incomplete',
          phase.plan_count != null ? phase.plan_count : 0,
          phase.goal || null,
          phase.depends_on ? JSON.stringify(phase.depends_on) : null,
          phase.requirements ? JSON.stringify(phase.requirements) : null,
          phase.section || null
        );
      }

      // Insert milestones
      const msInsert = this._stmt(
        'milestones_insert',
        `INSERT INTO milestones (cwd, name, version, status, phase_start, phase_end)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      for (const ms of (parsed.milestones || [])) {
        msInsert.run(
          cwd,
          ms.name || '',
          ms.version || null,
          ms.status || 'pending',
          ms.phase_start != null ? ms.phase_start : null,
          ms.phase_end != null ? ms.phase_end : null
        );
      }

      // Insert progress
      const progInsert = this._stmt(
        'progress_insert',
        `INSERT OR REPLACE INTO progress
         (phase, cwd, plans_complete, plans_total, status, completed_date)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      for (const prog of (parsed.progress || [])) {
        progInsert.run(
          prog.phase || '',
          cwd,
          prog.plans_complete != null ? prog.plans_complete : 0,
          prog.plans_total != null ? prog.plans_total : 0,
          prog.status || null,
          prog.completed_date || null
        );
      }

      // Insert requirements (explicit list or extracted from phases)
      const reqInsert = this._stmt(
        'requirements_insert',
        `INSERT OR REPLACE INTO requirements (req_id, cwd, phase_number, description)
         VALUES (?, ?, ?, ?)`
      );
      const requirements = parsed.requirements || _extractRequirementsFromPhases(parsed.phases || []);
      for (const req of requirements) {
        reqInsert.run(
          req.req_id || req.id || '',
          cwd,
          req.phase_number || req.phase || null,
          req.description || null
        );
      }

      // Update file_cache mtime
      if (roadmapPath) {
        this._updateMtimeInTx(roadmapPath);
      }

      this._db.exec('COMMIT');
    } catch (e) {
      try { this._db.exec('ROLLBACK'); } catch { /* ignore */ }
      // Store failures are non-fatal — cache will be rebuilt on next access
    }
  }

  /**
   * Store a parsed plan and its tasks.
   * Deletes existing plan+tasks for planPath, then inserts fresh data.
   * Updates file_cache mtime for planPath.
   *
   * @param {string} planPath - Absolute path to the plan file
   * @param {string} cwd - Project root directory
   * @param {object} parsed - Output from plan parser
   * @param {object} [parsed.frontmatter]
   * @param {Array} [parsed.tasks]
   * @param {string} [parsed.objective]
   * @param {string} [parsed.raw]
   */
  storePlan(planPath, cwd, parsed) {
    if (this._isMap()) return;

    try {
      this._db.exec('BEGIN');

      // Delete existing plan (CASCADE deletes tasks)
      this._stmt(
        'plans_delete_path',
        'DELETE FROM plans WHERE path = ?'
      ).run(planPath);

      // Insert plan row
      const fm = parsed.frontmatter || {};
      this._stmt(
        'plans_insert',
        `INSERT OR REPLACE INTO plans
         (path, cwd, phase_number, plan_number, wave, autonomous, objective, task_count, frontmatter_json, raw)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        planPath,
        cwd,
        fm.phase ? String(fm.phase).split('-')[0] : null,
        fm.plan != null ? String(fm.plan) : null,
        fm.wave != null ? fm.wave : null,
        fm.autonomous != null ? (fm.autonomous ? 1 : 0) : null,
        parsed.objective || null,
        (parsed.tasks || []).length,
        JSON.stringify(fm),
        parsed.raw || null
      );

      // Insert task rows
      const taskInsert = this._stmt(
        'tasks_insert',
        `INSERT OR REPLACE INTO tasks
         (plan_path, idx, type, name, files_json, action, verify, done)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (let i = 0; i < (parsed.tasks || []).length; i++) {
        const task = parsed.tasks[i];
        taskInsert.run(
          planPath,
          i,
          task.type || 'auto',
          task.name || null,
          task.files ? JSON.stringify(task.files) : null,
          task.action || null,
          task.verify || null,
          task.done || null
        );
      }

      // Update file_cache mtime
      this._updateMtimeInTx(planPath);

      this._db.exec('COMMIT');
    } catch (e) {
      try { this._db.exec('ROLLBACK'); } catch { /* ignore */ }
    }
  }

  /**
   * Update file_cache mtime inside an existing transaction.
   * @param {string} filePath
   * @private
   */
  _updateMtimeInTx(filePath) {
    try {
      const mtime_ms = fs.statSync(filePath).mtimeMs;
      this._stmt(
        'file_cache_upsert_tx',
        "INSERT OR REPLACE INTO file_cache (file_path, mtime_ms, parsed_at) VALUES (?, ?, ?)"
      ).run(filePath, mtime_ms, new Date().toISOString());
    } catch {
      // File may not exist — ignore
    }
  }

  // -------------------------------------------------------------------------
  // Query Operations (cache reads)
  // -------------------------------------------------------------------------

  /**
   * Get all phases for a project.
   * @param {string} cwd
   * @returns {Array|null} - Array of phase rows, or null if none cached
   */
  getPhases(cwd) {
    if (this._isMap()) return null;
    try {
      const rows = this._stmt(
        'phases_all',
        'SELECT * FROM phases WHERE cwd = ? ORDER BY number'
      ).all(cwd);
      return rows.length > 0 ? rows : null;
    } catch { return null; }
  }

  /**
   * Get a single phase by number and cwd.
   * @param {string} number
   * @param {string} cwd
   * @returns {object|null}
   */
  getPhase(number, cwd) {
    if (this._isMap()) return null;
    try {
      const row = this._stmt(
        'phase_by_number',
        'SELECT * FROM phases WHERE number = ? AND cwd = ?'
      ).get(number, cwd);
      return row || null;
    } catch { return null; }
  }

  /**
   * Get all plans for a project.
   * @param {string} cwd
   * @returns {Array|null}
   */
  getPlans(cwd) {
    if (this._isMap()) return null;
    try {
      const rows = this._stmt(
        'plans_all',
        'SELECT * FROM plans WHERE cwd = ? ORDER BY phase_number, plan_number'
      ).all(cwd);
      return rows.length > 0 ? rows : null;
    } catch { return null; }
  }

  /**
   * Get a single plan with its tasks.
   * @param {string} planPath
   * @returns {object|null} - Plan row with `.tasks` array, or null on miss
   */
  getPlan(planPath) {
    if (this._isMap()) return null;
    try {
      const plan = this._stmt(
        'plan_by_path',
        'SELECT * FROM plans WHERE path = ?'
      ).get(planPath);
      if (!plan) return null;

      const tasks = this._stmt(
        'tasks_for_plan',
        'SELECT * FROM tasks WHERE plan_path = ? ORDER BY idx'
      ).all(planPath);

      return { ...plan, tasks };
    } catch { return null; }
  }

  /**
   * Get all plans for a specific phase.
   * @param {string} phaseNumber
   * @param {string} cwd
   * @returns {Array|null}
   */
  getPlansForPhase(phaseNumber, cwd) {
    if (this._isMap()) return null;
    try {
      const rows = this._stmt(
        'plans_for_phase',
        'SELECT * FROM plans WHERE phase_number = ? AND cwd = ? ORDER BY plan_number'
      ).all(phaseNumber, cwd);
      return rows.length > 0 ? rows : null;
    } catch { return null; }
  }

  /**
   * Get all requirements for a project.
   * @param {string} cwd
   * @returns {Array|null}
   */
  getRequirements(cwd) {
    if (this._isMap()) return null;
    try {
      const rows = this._stmt(
        'requirements_all',
        'SELECT * FROM requirements WHERE cwd = ? ORDER BY req_id'
      ).all(cwd);
      return rows.length > 0 ? rows : null;
    } catch { return null; }
  }

  /**
   * Get a single requirement by req_id and cwd.
   * @param {string} reqId
   * @param {string} cwd
   * @returns {object|null}
   */
  getRequirement(reqId, cwd) {
    if (this._isMap()) return null;
    try {
      const row = this._stmt(
        'requirement_by_id',
        'SELECT * FROM requirements WHERE req_id = ? AND cwd = ?'
      ).get(reqId, cwd);
      return row || null;
    } catch { return null; }
  }

  /**
   * Get all milestones for a project.
   * @param {string} cwd
   * @returns {Array|null}
   */
  getMilestones(cwd) {
    if (this._isMap()) return null;
    try {
      const rows = this._stmt(
        'milestones_all',
        'SELECT * FROM milestones WHERE cwd = ? ORDER BY id'
      ).all(cwd);
      return rows.length > 0 ? rows : null;
    } catch { return null; }
  }

  /**
   * Get all progress entries for a project.
   * @param {string} cwd
   * @returns {Array|null}
   */
  getProgress(cwd) {
    if (this._isMap()) return null;
    try {
      const rows = this._stmt(
        'progress_all',
        'SELECT * FROM progress WHERE cwd = ? ORDER BY phase'
      ).all(cwd);
      return rows.length > 0 ? rows : null;
    } catch { return null; }
  }

  // -------------------------------------------------------------------------
  // Memory Store Operations (decisions, lessons, trajectories, bookmarks)
  // -------------------------------------------------------------------------

  /**
   * One-time JSON → SQLite migration for memory stores.
   * Reads .planning/memory/{decisions,lessons,trajectory,bookmarks}.json and
   * inserts all entries into the corresponding memory_* tables.
   * Idempotent — skips migration if any entries already exist for this cwd.
   *
   * @param {string} cwd - Project root directory
   * @returns {{ migrated: { decisions: number, lessons: number, trajectories: number, bookmarks: number }, skipped: string[] }|null}
   */
  migrateMemoryStores(cwd) {
    if (this._isMap()) return null;

    const result = { migrated: { decisions: 0, lessons: 0, trajectories: 0, bookmarks: 0 }, skipped: [] };

    try {
      // Check if already migrated (any existing entries for this cwd)
      const existing = this._stmt(
        'mem_dec_count',
        'SELECT COUNT(*) AS cnt FROM memory_decisions WHERE cwd = ?'
      ).get(cwd);
      if (existing && existing.cnt > 0) {
        return result; // Already migrated
      }

      const memoryDir = require('path').join(cwd, '.planning', 'memory');

      // decisions.json
      try {
        const raw = require('fs').readFileSync(require('path').join(memoryDir, 'decisions.json'), 'utf8');
        const entries = JSON.parse(raw);
        if (Array.isArray(entries) && entries.length > 0) {
          const ins = this._stmt(
            'mem_dec_ins',
            'INSERT INTO memory_decisions (cwd, summary, phase, timestamp, data_json) VALUES (?, ?, ?, ?, ?)'
          );
          this._db.exec('BEGIN');
          for (const entry of entries) {
            ins.run(cwd, entry.summary || null, entry.phase || null, entry.timestamp || null, JSON.stringify(entry));
            result.migrated.decisions++;
          }
          this._db.exec('COMMIT');
        }
      } catch { result.skipped.push('decisions'); }

      // lessons.json
      try {
        const raw = require('fs').readFileSync(require('path').join(memoryDir, 'lessons.json'), 'utf8');
        const entries = JSON.parse(raw);
        if (Array.isArray(entries) && entries.length > 0) {
          const ins = this._stmt(
            'mem_les_ins',
            'INSERT INTO memory_lessons (cwd, summary, phase, timestamp, data_json) VALUES (?, ?, ?, ?, ?)'
          );
          this._db.exec('BEGIN');
          for (const entry of entries) {
            ins.run(cwd, entry.summary || null, entry.phase || null, entry.timestamp || null, JSON.stringify(entry));
            result.migrated.lessons++;
          }
          this._db.exec('COMMIT');
        }
      } catch { result.skipped.push('lessons'); }

      // trajectory.json
      try {
        const raw = require('fs').readFileSync(require('path').join(memoryDir, 'trajectory.json'), 'utf8');
        const entries = JSON.parse(raw);
        if (Array.isArray(entries) && entries.length > 0) {
          const ins = this._stmt(
            'mem_trj_ins',
            'INSERT INTO memory_trajectories (cwd, entry_id, category, text, phase, scope, checkpoint_name, attempt, confidence, timestamp, tags_json, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          );
          this._db.exec('BEGIN');
          for (const entry of entries) {
            ins.run(
              cwd,
              entry.id || null,
              entry.category || null,
              entry.text || null,
              entry.phase || null,
              entry.scope || null,
              entry.checkpoint_name || null,
              entry.attempt != null ? entry.attempt : null,
              entry.confidence || null,
              entry.timestamp || null,
              entry.tags ? JSON.stringify(entry.tags) : null,
              JSON.stringify(entry)
            );
            result.migrated.trajectories++;
          }
          this._db.exec('COMMIT');
        }
      } catch { result.skipped.push('trajectories'); }

      // bookmarks.json
      try {
        const raw = require('fs').readFileSync(require('path').join(memoryDir, 'bookmarks.json'), 'utf8');
        const entries = JSON.parse(raw);
        if (Array.isArray(entries) && entries.length > 0) {
          const ins = this._stmt(
            'mem_bkm_ins',
            'INSERT INTO memory_bookmarks (cwd, phase, plan, task, total_tasks, git_head, timestamp, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          );
          this._db.exec('BEGIN');
          for (const entry of entries) {
            ins.run(
              cwd,
              entry.phase || null,
              entry.plan || null,
              entry.task != null ? entry.task : null,
              entry.total_tasks != null ? entry.total_tasks : null,
              entry.git_head || null,
              entry.timestamp || null,
              JSON.stringify(entry)
            );
            result.migrated.bookmarks++;
          }
          this._db.exec('COMMIT');
        }
      } catch { result.skipped.push('bookmarks'); }

    } catch {
      // Outer error — return what we have
    }

    return result;
  }

  /**
   * LIKE-based SQL search across a memory store.
   *
   * @param {string} cwd - Project root directory
   * @param {'decisions'|'lessons'|'trajectories'|'bookmarks'} store
   * @param {string} query - Text to search (uses %query% LIKE pattern)
   * @param {{ phase?: string, category?: string, limit?: number, offset?: number }} [options]
   * @returns {{ entries: object[], total: number }|null}
   */
  searchMemory(cwd, store, query, options) {
    if (this._isMap()) return null;

    const opts = options || {};
    const limit = opts.limit != null ? opts.limit : 50;
    const offset = opts.offset != null ? opts.offset : 0;
    const likePattern = '%' + query + '%';

    try {
      let table, searchCols, orderBy;
      switch (store) {
        case 'decisions':
          table = 'memory_decisions';
          searchCols = '(summary LIKE ? OR data_json LIKE ?)';
          orderBy = 'timestamp DESC';
          break;
        case 'lessons':
          table = 'memory_lessons';
          searchCols = '(summary LIKE ? OR data_json LIKE ?)';
          orderBy = 'timestamp DESC';
          break;
        case 'trajectories':
          table = 'memory_trajectories';
          searchCols = '(text LIKE ? OR data_json LIKE ?)';
          orderBy = 'id DESC';
          break;
        case 'bookmarks':
          table = 'memory_bookmarks';
          searchCols = '(phase LIKE ? OR data_json LIKE ?)';
          orderBy = 'timestamp DESC';
          break;
        default:
          return null;
      }

      const params = [cwd, likePattern, likePattern];
      let whereClauses = `cwd = ? AND ${searchCols}`;

      if (opts.phase) {
        whereClauses += ' AND phase = ?';
        params.push(opts.phase);
      }
      if (opts.category && store === 'trajectories') {
        whereClauses += ' AND category = ?';
        params.push(opts.category);
      }

      // Count query
      const countSql = `SELECT COUNT(*) AS cnt FROM ${table} WHERE ${whereClauses}`;
      const countRow = this._db.prepare(countSql).get(...params);
      const total = countRow ? countRow.cnt : 0;

      // Data query
      const dataSql = `SELECT * FROM ${table} WHERE ${whereClauses} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
      const rows = this._db.prepare(dataSql).all(...params, limit, offset);

      const entries = rows.map(row => {
        try {
          const parsed = JSON.parse(row.data_json);
          return { ...parsed, _id: row.id };
        } catch {
          return { ...row };
        }
      });

      return { entries, total };
    } catch {
      return null;
    }
  }

  /**
   * Insert a single entry into a memory store table (for dual-write).
   * Does NOT touch JSON files — caller's responsibility.
   *
   * @param {string} cwd - Project root directory
   * @param {'decisions'|'lessons'|'trajectories'|'bookmarks'} store
   * @param {object} entry - Entry to insert
   * @returns {{ inserted: boolean }|null}
   */
  writeMemoryEntry(cwd, store, entry) {
    if (this._isMap()) return null;

    try {
      switch (store) {
        case 'decisions':
          this._stmt(
            'mem_dec_write',
            'INSERT INTO memory_decisions (cwd, summary, phase, timestamp, data_json) VALUES (?, ?, ?, ?, ?)'
          ).run(cwd, entry.summary || null, entry.phase || null, entry.timestamp || null, JSON.stringify(entry));
          break;
        case 'lessons':
          this._stmt(
            'mem_les_write',
            'INSERT INTO memory_lessons (cwd, summary, phase, timestamp, data_json) VALUES (?, ?, ?, ?, ?)'
          ).run(cwd, entry.summary || null, entry.phase || null, entry.timestamp || null, JSON.stringify(entry));
          break;
        case 'trajectories':
          this._stmt(
            'mem_trj_write',
            'INSERT INTO memory_trajectories (cwd, entry_id, category, text, phase, scope, checkpoint_name, attempt, confidence, timestamp, tags_json, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).run(
            cwd,
            entry.id || null,
            entry.category || null,
            entry.text || null,
            entry.phase || null,
            entry.scope || null,
            entry.checkpoint_name || null,
            entry.attempt != null ? entry.attempt : null,
            entry.confidence || null,
            entry.timestamp || null,
            entry.tags ? JSON.stringify(entry.tags) : null,
            JSON.stringify(entry)
          );
          break;
        case 'bookmarks':
          this._stmt(
            'mem_bkm_write',
            'INSERT INTO memory_bookmarks (cwd, phase, plan, task, total_tasks, git_head, timestamp, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          ).run(
            cwd,
            entry.phase || null,
            entry.plan || null,
            entry.task != null ? entry.task : null,
            entry.total_tasks != null ? entry.total_tasks : null,
            entry.git_head || null,
            entry.timestamp || null,
            JSON.stringify(entry)
          );
          break;
        default:
          return null;
      }
      return { inserted: true };
    } catch {
      return null;
    }
  }

  /**
   * Delete all entries for a memory store and cwd.
   * Used for re-migration or test cleanup.
   *
   * @param {string} cwd - Project root directory
   * @param {'decisions'|'lessons'|'trajectories'|'bookmarks'} store
   */
  clearMemoryStore(cwd, store) {
    if (this._isMap()) return;

    const tableMap = {
      decisions: 'memory_decisions',
      lessons: 'memory_lessons',
      trajectories: 'memory_trajectories',
      bookmarks: 'memory_bookmarks',
    };
    const table = tableMap[store];
    if (!table) return;

    try {
      this._db.prepare(`DELETE FROM ${table} WHERE cwd = ?`).run(cwd);
    } catch {
      // Non-fatal
    }
  }

  /**
   * Get the most recent bookmark for a project.
   *
   * @param {string} cwd - Project root directory
   * @returns {object|null}
   */
  getBookmarkTop(cwd) {
    if (this._isMap()) return null;

    try {
      const row = this._stmt(
        'mem_bkm_top',
        'SELECT * FROM memory_bookmarks WHERE cwd = ? ORDER BY id DESC LIMIT 1'
      ).get(cwd);
      if (!row) return null;
      try {
        return JSON.parse(row.data_json);
      } catch {
        return { ...row };
      }
    } catch {
      return null;
    }
  }

  /**
   * Clear all cached data for a given project root directory.
   * Removes all rows from phases, milestones, progress, requirements, plans, tasks,
   * and file_cache where cwd matches. Used for full cache reset (e.g. invalidateAll).
   *
   * @param {string} cwd - Project root directory
   */
  clearForCwd(cwd) {
    if (this._isMap()) return;

    try {
      this._db.exec('BEGIN');

      this._stmt('clear_phases_cwd', 'DELETE FROM phases WHERE cwd = ?').run(cwd);
      this._stmt('clear_milestones_cwd', 'DELETE FROM milestones WHERE cwd = ?').run(cwd);
      this._stmt('clear_progress_cwd', 'DELETE FROM progress WHERE cwd = ?').run(cwd);
      this._stmt('clear_requirements_cwd', 'DELETE FROM requirements WHERE cwd = ?').run(cwd);

      // Delete plans and their tasks (tasks cascade via FK) for this cwd
      const planPaths = this._stmt(
        'clear_plan_paths',
        'SELECT path FROM plans WHERE cwd = ?'
      ).all(cwd).map(r => r.path);
      for (const planPath of planPaths) {
        this._stmt(
          'clear_tasks_for_plan',
          'DELETE FROM tasks WHERE plan_path = ?'
        ).run(planPath);
      }
      this._stmt('clear_plans_cwd', 'DELETE FROM plans WHERE cwd = ?').run(cwd);

      // Clear file_cache entries for files under this cwd (path starts with cwd)
      this._stmt(
        'clear_file_cache_cwd',
        "DELETE FROM file_cache WHERE file_path LIKE ? || '%'"
      ).run(cwd);

      this._db.exec('COMMIT');
    } catch {
      try { this._db.exec('ROLLBACK'); } catch { /* ignore */ }
    }
  }
}

// ---------------------------------------------------------------------------
// Requirements extraction helper
// ---------------------------------------------------------------------------

/**
 * Extract requirements from roadmap phase sections.
 * Looks for:
 *   - `**Requirements**: REQ-01, REQ-02` in section text
 *   - `- [ ] **REQ-ID**: description` patterns
 *
 * @param {Array} phases - Array of phase objects with optional .section property
 * @returns {Array<{req_id: string, phase_number: string, description: string}>}
 */
function _extractRequirementsFromPhases(phases) {
  const requirements = [];

  for (const phase of phases) {
    const section = phase.section || '';
    if (!section) continue;

    // Match `**Requirements**: REQ-01, REQ-02` inline list
    const inlineMatch = section.match(/\*\*Requirements?\*\*:\s*([^\n]+)/i);
    if (inlineMatch) {
      const ids = inlineMatch[1].split(/[,\s]+/).filter(id => /^[A-Z]+-\d+/.test(id));
      for (const id of ids) {
        requirements.push({
          req_id: id,
          phase_number: phase.number || '',
          description: null,
        });
      }
    }

    // Match `- [ ] **REQ-ID**: description` patterns
    const checkboxPattern = /- \[[ x]\] \*\*([A-Z]+-\d+)\*\*:?\s*([^\n]*)/g;
    let match;
    while ((match = checkboxPattern.exec(section)) !== null) {
      requirements.push({
        req_id: match[1],
        phase_number: phase.number || '',
        description: match[2].trim() || null,
      });
    }
  }

  return requirements;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { PlanningCache };
