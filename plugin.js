var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/plugin/lib/db-cache.js
import * as nodeFs from "node:fs";
import * as nodePath from "node:path";
function getDb(cwd) {
  cwd = cwd || process.cwd();
  const resolvedCwd = nodePath.resolve(cwd);
  if (_instances.has(resolvedCwd)) return _instances.get(resolvedCwd);
  let db;
  const planningDir = nodePath.join(resolvedCwd, ".planning");
  const planningExists = nodeFs.existsSync(planningDir);
  if (planningExists && _DatabaseSync) {
    const dbPath = nodePath.join(planningDir, ".cache.db");
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
function _extractRequirementsFromPhases(phases) {
  const requirements = [];
  for (const phase of phases) {
    const section = phase.section || "";
    if (!section) continue;
    const inlineMatch = section.match(/\*\*Requirements?\*\*:\s*([^\n]+)/i);
    if (inlineMatch) {
      const ids = inlineMatch[1].split(/[,\s]+/).filter((id) => /^[A-Z]+-\d+/.test(id));
      for (const id of ids) {
        requirements.push({ req_id: id, phase_number: phase.number || "", description: null });
      }
    }
    const checkboxPattern = /- \[[ x]\] \*\*([A-Z]+-\d+)\*\*:?\s*([^\n]*)/g;
    let match;
    while ((match = checkboxPattern.exec(section)) !== null) {
      requirements.push({ req_id: match[1], phase_number: phase.number || "", description: match[2].trim() || null });
    }
  }
  return requirements;
}
var _DatabaseSync, MapBackend, SCHEMA_V5_SQL, SQLiteBackend, _instances, PlanningCache;
var init_db_cache = __esm({
  async "src/plugin/lib/db-cache.js"() {
    _DatabaseSync = null;
    try {
      const m = await import("node:sqlite");
      if (m && m.DatabaseSync) {
        _DatabaseSync = m.DatabaseSync;
      }
    } catch {
    }
    MapBackend = class {
      get backend() {
        return "map";
      }
      exec() {
      }
      prepare() {
        return { get: () => void 0, all: () => [], run: () => ({ changes: 0 }) };
      }
      close() {
      }
    };
    SCHEMA_V5_SQL = `
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
    SQLiteBackend = class {
      constructor(dbPath) {
        this._dbPath = dbPath;
        this._degraded = false;
        this._db = null;
        try {
          try {
            this._db = new _DatabaseSync(dbPath, { timeout: 5e3, defensive: false });
          } catch {
            try {
              this._db = new _DatabaseSync(dbPath, { timeout: 5e3 });
            } catch {
              this._db = new _DatabaseSync(dbPath);
            }
          }
          try {
            this._db.exec("PRAGMA busy_timeout = 5000");
          } catch {
          }
          this._db.exec("PRAGMA journal_mode = WAL");
          this._ensureSchema();
        } catch {
          this._degraded = true;
        }
      }
      _ensureSchema() {
        let version = 0;
        try {
          const row = this._db.prepare("PRAGMA user_version").get();
          version = row ? row.user_version : 0;
        } catch {
        }
        if (version >= 5) return;
        try {
          this._db.exec("BEGIN");
          this._db.exec(SCHEMA_V5_SQL);
          this._db.exec("INSERT OR REPLACE INTO _meta (key, value) VALUES ('created_at', '" + (/* @__PURE__ */ new Date()).toISOString() + "')");
          this._db.exec("PRAGMA user_version = 5");
          this._db.exec("COMMIT");
        } catch {
          try {
            this._db.exec("ROLLBACK");
          } catch {
          }
          try {
            this._db.close();
            for (const suffix of ["", "-wal", "-shm"]) {
              const fp = this._dbPath + suffix;
              if (nodeFs.existsSync(fp)) try {
                nodeFs.unlinkSync(fp);
              } catch {
              }
            }
            this._db = new _DatabaseSync(this._dbPath);
            this._db.exec("PRAGMA journal_mode = WAL");
            this._db.exec("BEGIN");
            this._db.exec(SCHEMA_V5_SQL);
            this._db.exec("INSERT OR REPLACE INTO _meta (key, value) VALUES ('created_at', '" + (/* @__PURE__ */ new Date()).toISOString() + "')");
            this._db.exec("PRAGMA user_version = 5");
            this._db.exec("COMMIT");
          } catch {
            this._degraded = true;
          }
        }
      }
      get backend() {
        return "sqlite";
      }
      exec(sql) {
        this._db.exec(sql);
      }
      prepare(sql) {
        return this._db.prepare(sql);
      }
      close() {
        try {
          this._db.close();
        } catch {
        }
      }
    };
    _instances = /* @__PURE__ */ new Map();
    PlanningCache = class {
      constructor(db) {
        this._db = db;
        this._stmts = {};
      }
      _isMap() {
        return this._db.backend === "map";
      }
      _stmt(key, sql) {
        if (!this._stmts[key]) this._stmts[key] = this._db.prepare(sql);
        return this._stmts[key];
      }
      checkFreshness(filePath) {
        if (this._isMap()) return "missing";
        try {
          const row = this._stmt("fc_get", "SELECT mtime_ms FROM file_cache WHERE file_path = ?").get(filePath);
          if (!row) return "missing";
          const currentMtime = nodeFs.statSync(filePath).mtimeMs;
          return currentMtime === row.mtime_ms ? "fresh" : "stale";
        } catch {
          return "missing";
        }
      }
      checkAllFreshness(filePaths) {
        const result = { fresh: [], stale: [], missing: [] };
        for (const fp of filePaths) result[this.checkFreshness(fp)].push(fp);
        return result;
      }
      invalidateFile(filePath) {
        if (this._isMap()) return;
        try {
          this._db.exec("BEGIN");
          this._stmt("fc_del", "DELETE FROM file_cache WHERE file_path = ?").run(filePath);
          this._stmt("plans_del_path", "DELETE FROM plans WHERE path = ?").run(filePath);
          this._db.exec("COMMIT");
        } catch {
          try {
            this._db.exec("ROLLBACK");
          } catch {
          }
        }
      }
      clearForCwd(cwd) {
        if (this._isMap()) return;
        try {
          this._db.exec("BEGIN");
          this._stmt("ph_del_cwd", "DELETE FROM phases WHERE cwd = ?").run(cwd);
          this._stmt("ms_del_cwd", "DELETE FROM milestones WHERE cwd = ?").run(cwd);
          this._stmt("pr_del_cwd", "DELETE FROM progress WHERE cwd = ?").run(cwd);
          this._stmt("rq_del_cwd", "DELETE FROM requirements WHERE cwd = ?").run(cwd);
          this._stmt("pl_del_cwd", "DELETE FROM plans WHERE cwd = ?").run(cwd);
          this._stmt("fc_del_cwd", "DELETE FROM file_cache WHERE file_path LIKE ?").run(cwd + "%");
          this._db.exec("COMMIT");
        } catch {
          try {
            this._db.exec("ROLLBACK");
          } catch {
          }
        }
      }
      _updateMtimeInTx(filePath) {
        try {
          const mtime_ms = nodeFs.statSync(filePath).mtimeMs;
          this._stmt("fc_upsert", "INSERT OR REPLACE INTO file_cache (file_path, mtime_ms, parsed_at) VALUES (?, ?, ?)").run(filePath, mtime_ms, (/* @__PURE__ */ new Date()).toISOString());
        } catch {
        }
      }
      storeRoadmap(cwd, roadmapPath, parsed) {
        if (this._isMap()) return;
        try {
          this._db.exec("BEGIN");
          this._stmt("ph_del_cwd2", "DELETE FROM phases WHERE cwd = ?").run(cwd);
          this._stmt("ms_del_cwd2", "DELETE FROM milestones WHERE cwd = ?").run(cwd);
          this._stmt("pr_del_cwd2", "DELETE FROM progress WHERE cwd = ?").run(cwd);
          this._stmt("rq_del_cwd2", "DELETE FROM requirements WHERE cwd = ?").run(cwd);
          const phIns = this._stmt("ph_ins", `INSERT OR REPLACE INTO phases (number, cwd, name, status, plan_count, goal, depends_on, requirements, section) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
          for (const p of parsed.phases || []) {
            phIns.run(
              p.number || "",
              cwd,
              p.name || "",
              p.status || "incomplete",
              p.plan_count != null ? p.plan_count : 0,
              p.goal || null,
              p.depends_on ? JSON.stringify(p.depends_on) : null,
              p.requirements ? JSON.stringify(p.requirements) : null,
              p.section || null
            );
          }
          const msIns = this._stmt("ms_ins", `INSERT INTO milestones (cwd, name, version, status, phase_start, phase_end) VALUES (?, ?, ?, ?, ?, ?)`);
          for (const m of parsed.milestones || []) {
            msIns.run(
              cwd,
              m.name || "",
              m.version || null,
              m.status || "pending",
              m.phase_start != null ? m.phase_start : null,
              m.phase_end != null ? m.phase_end : null
            );
          }
          const prIns = this._stmt("pr_ins", `INSERT OR REPLACE INTO progress (phase, cwd, plans_complete, plans_total, status, completed_date) VALUES (?, ?, ?, ?, ?, ?)`);
          for (const p of parsed.progress || []) {
            prIns.run(
              p.phase || "",
              cwd,
              p.plans_complete != null ? p.plans_complete : 0,
              p.plans_total != null ? p.plans_total : 0,
              p.status || null,
              p.completed_date || null
            );
          }
          const rqIns = this._stmt("rq_ins", `INSERT OR REPLACE INTO requirements (req_id, cwd, phase_number, description) VALUES (?, ?, ?, ?)`);
          const reqs = parsed.requirements || _extractRequirementsFromPhases(parsed.phases || []);
          for (const r of reqs) {
            rqIns.run(r.req_id || r.id || "", cwd, r.phase_number || r.phase || null, r.description || null);
          }
          if (roadmapPath) this._updateMtimeInTx(roadmapPath);
          this._db.exec("COMMIT");
        } catch {
          try {
            this._db.exec("ROLLBACK");
          } catch {
          }
        }
      }
      storePlan(planPath, cwd, parsed) {
        if (this._isMap()) return;
        try {
          this._db.exec("BEGIN");
          this._stmt("pl_del_path", "DELETE FROM plans WHERE path = ?").run(planPath);
          const fm = parsed.frontmatter || {};
          this._stmt(
            "pl_ins",
            `INSERT OR REPLACE INTO plans (path, cwd, phase_number, plan_number, wave, autonomous, objective, task_count, frontmatter_json, raw) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            planPath,
            cwd,
            fm.phase ? String(fm.phase).split("-")[0] : null,
            fm.plan != null ? String(fm.plan) : null,
            fm.wave != null ? fm.wave : null,
            fm.autonomous != null ? fm.autonomous ? 1 : 0 : null,
            parsed.objective || null,
            (parsed.tasks || []).length,
            JSON.stringify(fm),
            parsed.raw || null
          );
          const tkIns = this._stmt("tk_ins", `INSERT OR REPLACE INTO tasks (plan_path, idx, type, name, files_json, action, verify, done) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
          for (let i = 0; i < (parsed.tasks || []).length; i++) {
            const t = parsed.tasks[i];
            tkIns.run(
              planPath,
              i,
              t.type || "auto",
              t.name || null,
              t.files ? JSON.stringify(t.files) : null,
              t.action || null,
              t.verify || null,
              t.done || null
            );
          }
          this._updateMtimeInTx(planPath);
          this._db.exec("COMMIT");
        } catch {
          try {
            this._db.exec("ROLLBACK");
          } catch {
          }
        }
      }
      getPhases(cwd) {
        if (this._isMap()) return null;
        try {
          const rows = this._stmt("ph_all", "SELECT * FROM phases WHERE cwd = ? ORDER BY number").all(cwd);
          return rows.length > 0 ? rows : null;
        } catch {
          return null;
        }
      }
      getPhase(number, cwd) {
        if (this._isMap()) return null;
        try {
          const row = this._stmt("ph_one", "SELECT * FROM phases WHERE number = ? AND cwd = ?").get(number, cwd);
          return row || null;
        } catch {
          return null;
        }
      }
      getPlans(cwd) {
        if (this._isMap()) return null;
        try {
          const rows = this._stmt("pl_all", "SELECT * FROM plans WHERE cwd = ? ORDER BY phase_number, plan_number").all(cwd);
          return rows.length > 0 ? rows : null;
        } catch {
          return null;
        }
      }
      getPlan(planPath) {
        if (this._isMap()) return null;
        try {
          const plan = this._stmt("pl_one", "SELECT * FROM plans WHERE path = ?").get(planPath);
          if (!plan) return null;
          const tasks = this._stmt("tk_for_plan", "SELECT * FROM tasks WHERE plan_path = ? ORDER BY idx").all(planPath);
          return { ...plan, tasks };
        } catch {
          return null;
        }
      }
      getPlansForPhase(phaseNumber, cwd) {
        if (this._isMap()) return null;
        try {
          const rows = this._stmt("pl_phase", "SELECT * FROM plans WHERE phase_number = ? AND cwd = ? ORDER BY plan_number").all(phaseNumber, cwd);
          return rows.length > 0 ? rows : null;
        } catch {
          return null;
        }
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
          const rows = this._stmt("pl_phase2", "SELECT path FROM plans WHERE phase_number = ? AND cwd = ? ORDER BY plan_number").all(String(phaseNumber), cwd);
          if (!rows || rows.length === 0) return null;
          const summaryFiles = [];
          for (const row of rows) {
            const summaryPath = row.path.replace(/-PLAN\.md$/, "-SUMMARY.md");
            const summaryName = summaryPath.split("/").pop();
            if (nodeFs.existsSync(summaryPath)) {
              summaryFiles.push(summaryName);
            }
          }
          return { planCount: rows.length, summaryCount: summaryFiles.length, summaryFiles };
        } catch {
          return null;
        }
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
          const rows = this._stmt("pl_phase3", "SELECT path FROM plans WHERE phase_number = ? AND cwd = ? ORDER BY plan_number").all(String(phaseNumber), cwd);
          if (!rows || rows.length === 0) return null;
          const incomplete = [];
          for (const row of rows) {
            const summaryPath = row.path.replace(/-PLAN\.md$/, "-SUMMARY.md");
            if (!nodeFs.existsSync(summaryPath)) {
              incomplete.push(row.path.split("/").pop());
            }
          }
          return incomplete;
        } catch {
          return null;
        }
      }
      getRequirements(cwd) {
        if (this._isMap()) return null;
        try {
          const rows = this._stmt("rq_all", "SELECT * FROM requirements WHERE cwd = ? ORDER BY req_id").all(cwd);
          return rows.length > 0 ? rows : null;
        } catch {
          return null;
        }
      }
      getRequirement(reqId, cwd) {
        if (this._isMap()) return null;
        try {
          const row = this._stmt("rq_one", "SELECT * FROM requirements WHERE req_id = ? AND cwd = ?").get(reqId, cwd);
          return row || null;
        } catch {
          return null;
        }
      }
      getMilestones(cwd) {
        if (this._isMap()) return null;
        try {
          const rows = this._stmt("ms_all", "SELECT * FROM milestones WHERE cwd = ? ORDER BY id").all(cwd);
          return rows.length > 0 ? rows : null;
        } catch {
          return null;
        }
      }
      getProgress(cwd) {
        if (this._isMap()) return null;
        try {
          const rows = this._stmt("pr_all", "SELECT * FROM progress WHERE cwd = ? ORDER BY phase").all(cwd);
          return rows.length > 0 ? rows : null;
        } catch {
          return null;
        }
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
          const row = this._stmt("mp_get_cwd", "SELECT * FROM model_profiles WHERE agent_type = ? AND cwd = ?").get(agentType, cwd);
          if (row) return row;
          const defaultRow = this._stmt("mp_get_def", "SELECT * FROM model_profiles WHERE agent_type = ? AND cwd = '__defaults__'").get(agentType);
          return defaultRow || null;
        } catch {
          return null;
        }
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
          const rows = this._stmt("mp_all_cwd", "SELECT * FROM model_profiles WHERE cwd = ? ORDER BY agent_type").all(cwd);
          if (rows && rows.length > 0) return rows;
          const defaults = this._stmt("mp_all_def", "SELECT * FROM model_profiles WHERE cwd = '__defaults__' ORDER BY agent_type").all();
          return defaults && defaults.length > 0 ? defaults : null;
        } catch {
          return null;
        }
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
          const existing = this._stmt("mp_count", "SELECT COUNT(*) AS cnt FROM model_profiles WHERE cwd = ?").get(cwd);
          if (existing && existing.cnt > 0) return;
          const defaults = this._stmt("mp_seed_def", "SELECT * FROM model_profiles WHERE cwd = '__defaults__'").all();
          if (!defaults || defaults.length === 0) return;
          const ins = this._stmt("mp_seed_ins", `INSERT OR IGNORE INTO model_profiles (agent_type, cwd, quality_model, balanced_model, budget_model, override_model) VALUES (?, ?, ?, ?, ?, ?)`);
          this._db.exec("BEGIN");
          for (const row of defaults) {
            ins.run(row.agent_type, cwd, row.quality_model, row.balanced_model, row.budget_model, row.override_model || null);
          }
          this._db.exec("COMMIT");
        } catch {
          try {
            this._db.exec("ROLLBACK");
          } catch {
          }
        }
      }
      // -------------------------------------------------------------------------
      // Session State Operations (Phase 123)
      // -------------------------------------------------------------------------
      storeSessionState(cwd, state) {
        if (this._isMap()) return null;
        try {
          this._stmt(
            "ss_upsert",
            `INSERT OR REPLACE INTO session_state (cwd, phase_number, phase_name, total_phases, current_plan, status, last_activity, progress, milestone, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(cwd, state.phase_number || null, state.phase_name || null, state.total_phases != null ? state.total_phases : null, state.current_plan || null, state.status || null, state.last_activity || null, state.progress != null ? state.progress : null, state.milestone || null, JSON.stringify(state));
          return { stored: true };
        } catch {
          return null;
        }
      }
      getSessionState(cwd) {
        if (this._isMap()) return null;
        try {
          const row = this._stmt("ss_get", "SELECT * FROM session_state WHERE cwd = ?").get(cwd);
          return row || null;
        } catch {
          return null;
        }
      }
      migrateStateFromMarkdown(cwd, parsed) {
        if (this._isMap()) return null;
        try {
          const existing = this._stmt("ss_check", "SELECT cwd FROM session_state WHERE cwd = ?").get(cwd);
          if (existing) return { migrated: false, reason: "already_exists" };
          this._db.exec("BEGIN");
          this._stmt(
            "ss_upsert2",
            `INSERT OR REPLACE INTO session_state (cwd, phase_number, phase_name, total_phases, current_plan, status, last_activity, progress, milestone, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(cwd, parsed.phase_number || null, parsed.phase_name || null, parsed.total_phases != null ? parsed.total_phases : null, parsed.current_plan || null, parsed.status || null, parsed.last_activity || null, parsed.progress != null ? parsed.progress : null, parsed.milestone || null, JSON.stringify(parsed));
          if (Array.isArray(parsed.decisions) && parsed.decisions.length > 0) {
            const ins = this._stmt("ss_dec_ins", "INSERT INTO session_decisions (cwd, milestone, phase, summary, rationale, timestamp, data_json) VALUES (?, ?, ?, ?, ?, ?, ?)");
            for (const d of parsed.decisions) ins.run(cwd, d.milestone || null, d.phase || null, d.summary || null, d.rationale || null, d.timestamp || null, JSON.stringify(d));
          }
          if (Array.isArray(parsed.metrics) && parsed.metrics.length > 0) {
            const ins = this._stmt("ss_met_ins", "INSERT INTO session_metrics (cwd, milestone, phase, plan, duration, tasks, files, test_count, timestamp, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            for (const m of parsed.metrics) ins.run(cwd, m.milestone || null, m.phase || null, m.plan || null, m.duration || null, m.tasks != null ? m.tasks : null, m.files != null ? m.files : null, m.test_count != null ? m.test_count : null, m.timestamp || null, JSON.stringify(m));
          }
          if (Array.isArray(parsed.todos) && parsed.todos.length > 0) {
            const ins = this._stmt("ss_todo_ins", "INSERT INTO session_todos (cwd, text, priority, category, status, created_at, data_json) VALUES (?, ?, ?, ?, ?, ?, ?)");
            for (const t of parsed.todos) ins.run(cwd, t.text || "", t.priority || null, t.category || null, t.status || "pending", t.created_at || null, JSON.stringify(t));
          }
          if (Array.isArray(parsed.blockers) && parsed.blockers.length > 0) {
            const ins = this._stmt("ss_blk_ins", "INSERT INTO session_blockers (cwd, text, status, created_at, data_json) VALUES (?, ?, ?, ?, ?)");
            for (const b of parsed.blockers) ins.run(cwd, b.text || "", b.status || "open", b.created_at || null, JSON.stringify(b));
          }
          if (parsed.continuity) {
            const c = parsed.continuity;
            this._stmt("ss_cont_ins", "INSERT OR REPLACE INTO session_continuity (cwd, last_session, stopped_at, next_step, data_json) VALUES (?, ?, ?, ?, ?)").run(cwd, c.last_session || null, c.stopped_at || null, c.next_step || null, JSON.stringify(c));
          }
          this._db.exec("COMMIT");
          return { migrated: true };
        } catch {
          try {
            this._db.exec("ROLLBACK");
          } catch {
          }
          return null;
        }
      }
      writeSessionMetric(cwd, metric) {
        if (this._isMap()) return null;
        try {
          this._stmt(
            "sm_ins",
            "INSERT INTO session_metrics (cwd, milestone, phase, plan, duration, tasks, files, test_count, timestamp, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
          ).run(cwd, metric.milestone || null, metric.phase || null, metric.plan || null, metric.duration || null, metric.tasks != null ? metric.tasks : null, metric.files != null ? metric.files : null, metric.test_count != null ? metric.test_count : null, metric.timestamp || null, JSON.stringify(metric));
          return { inserted: true };
        } catch {
          return null;
        }
      }
      getSessionMetrics(cwd, options) {
        if (this._isMap()) return null;
        try {
          const opts = options || {};
          const limit = opts.limit != null ? opts.limit : 100;
          let w = "cwd = ?";
          const p = [cwd];
          if (opts.phase) {
            w += " AND phase = ?";
            p.push(opts.phase);
          }
          const total = (this._db.prepare("SELECT COUNT(*) AS cnt FROM session_metrics WHERE " + w).get(...p) || {}).cnt || 0;
          const rows = this._db.prepare("SELECT * FROM session_metrics WHERE " + w + " ORDER BY id DESC LIMIT ?").all(...p, limit);
          return { entries: rows.map((r) => {
            try {
              return JSON.parse(r.data_json);
            } catch {
              return r;
            }
          }), total };
        } catch {
          return null;
        }
      }
      writeSessionDecision(cwd, decision) {
        if (this._isMap()) return null;
        try {
          this._stmt(
            "sd_ins",
            "INSERT INTO session_decisions (cwd, milestone, phase, summary, rationale, timestamp, data_json) VALUES (?, ?, ?, ?, ?, ?, ?)"
          ).run(cwd, decision.milestone || null, decision.phase || null, decision.summary || null, decision.rationale || null, decision.timestamp || null, JSON.stringify(decision));
          return { inserted: true };
        } catch {
          return null;
        }
      }
      getSessionDecisions(cwd, options) {
        if (this._isMap()) return null;
        try {
          const opts = options || {};
          const limit = opts.limit != null ? opts.limit : 100;
          const offset = opts.offset != null ? opts.offset : 0;
          let w = "cwd = ?";
          const p = [cwd];
          if (opts.phase) {
            w += " AND phase = ?";
            p.push(opts.phase);
          }
          const total = (this._db.prepare("SELECT COUNT(*) AS cnt FROM session_decisions WHERE " + w).get(...p) || {}).cnt || 0;
          const rows = this._db.prepare("SELECT * FROM session_decisions WHERE " + w + " ORDER BY id DESC LIMIT ? OFFSET ?").all(...p, limit, offset);
          return { entries: rows.map((r) => {
            try {
              return JSON.parse(r.data_json);
            } catch {
              return r;
            }
          }), total };
        } catch {
          return null;
        }
      }
      writeSessionTodo(cwd, todo) {
        if (this._isMap()) return null;
        try {
          const result = this._stmt(
            "st_ins",
            "INSERT INTO session_todos (cwd, text, priority, category, status, created_at, data_json) VALUES (?, ?, ?, ?, ?, ?, ?)"
          ).run(cwd, todo.text || "", todo.priority || null, todo.category || null, todo.status || "pending", todo.created_at || null, JSON.stringify(todo));
          return { inserted: true, id: result ? result.lastInsertRowid : null };
        } catch {
          return null;
        }
      }
      getSessionTodos(cwd, options) {
        if (this._isMap()) return null;
        try {
          const opts = options || {};
          const limit = opts.limit != null ? opts.limit : 100;
          let w = "cwd = ?";
          const p = [cwd];
          if (opts.status) {
            w += " AND status = ?";
            p.push(opts.status);
          }
          const total = (this._db.prepare("SELECT COUNT(*) AS cnt FROM session_todos WHERE " + w).get(...p) || {}).cnt || 0;
          const rows = this._db.prepare("SELECT * FROM session_todos WHERE " + w + " ORDER BY id DESC LIMIT ?").all(...p, limit);
          return { entries: rows.map((r) => {
            try {
              return JSON.parse(r.data_json);
            } catch {
              return r;
            }
          }), total };
        } catch {
          return null;
        }
      }
      completeSessionTodo(cwd, id) {
        if (this._isMap()) return null;
        try {
          this._stmt("st_complete", "UPDATE session_todos SET status='completed', completed_at=? WHERE id=? AND cwd=?").run((/* @__PURE__ */ new Date()).toISOString(), id, cwd);
          return { updated: true };
        } catch {
          return null;
        }
      }
      writeSessionBlocker(cwd, blocker) {
        if (this._isMap()) return null;
        try {
          const result = this._stmt(
            "sb_ins",
            "INSERT INTO session_blockers (cwd, text, status, created_at, data_json) VALUES (?, ?, ?, ?, ?)"
          ).run(cwd, blocker.text || "", blocker.status || "open", blocker.created_at || null, JSON.stringify(blocker));
          return { inserted: true, id: result ? result.lastInsertRowid : null };
        } catch {
          return null;
        }
      }
      getSessionBlockers(cwd, options) {
        if (this._isMap()) return null;
        try {
          const opts = options || {};
          const limit = opts.limit != null ? opts.limit : 100;
          let w = "cwd = ?";
          const p = [cwd];
          if (opts.status) {
            w += " AND status = ?";
            p.push(opts.status);
          }
          const total = (this._db.prepare("SELECT COUNT(*) AS cnt FROM session_blockers WHERE " + w).get(...p) || {}).cnt || 0;
          const rows = this._db.prepare("SELECT * FROM session_blockers WHERE " + w + " ORDER BY id DESC LIMIT ?").all(...p, limit);
          return { entries: rows.map((r) => {
            try {
              return JSON.parse(r.data_json);
            } catch {
              return r;
            }
          }), total };
        } catch {
          return null;
        }
      }
      resolveSessionBlocker(cwd, id, resolution) {
        if (this._isMap()) return null;
        try {
          this._stmt("sb_resolve", "UPDATE session_blockers SET status='resolved', resolved_at=?, resolution=? WHERE id=? AND cwd=?").run((/* @__PURE__ */ new Date()).toISOString(), resolution || null, id, cwd);
          return { updated: true };
        } catch {
          return null;
        }
      }
      recordSessionContinuity(cwd, continuity) {
        if (this._isMap()) return null;
        try {
          this._stmt(
            "sc_upsert",
            "INSERT OR REPLACE INTO session_continuity (cwd, last_session, stopped_at, next_step, data_json) VALUES (?, ?, ?, ?, ?)"
          ).run(cwd, continuity.last_session || null, continuity.stopped_at || null, continuity.next_step || null, JSON.stringify(continuity));
          return { stored: true };
        } catch {
          return null;
        }
      }
      getSessionContinuity(cwd) {
        if (this._isMap()) return null;
        try {
          const row = this._stmt("sc_get", "SELECT * FROM session_continuity WHERE cwd = ?").get(cwd);
          return row || null;
        } catch {
          return null;
        }
      }
    };
  }
});

// src/plugin/parsers/state.js
import { readFileSync } from "fs";
import { join as join4 } from "path";
function extractField(content, fieldName) {
  const pattern = new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*(.+)`, "i");
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}
function extractSection(content, sectionName) {
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`##\\s*${escaped}\\s*\\n([\\s\\S]*?)(?=\\n##|$)`, "i");
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}
function extractProgress(content) {
  const match = content.match(/\[[\u2588\u2591]+\]\s*(\d+)%/);
  return match ? parseInt(match[1], 10) : null;
}
function parseState(cwd) {
  const resolvedCwd = cwd || process.cwd();
  if (_cache.has(resolvedCwd)) {
    return _cache.get(resolvedCwd);
  }
  const statePath = join4(resolvedCwd, ".planning", "STATE.md");
  let sqlRow = null;
  let db = null;
  let cache = null;
  try {
    db = getDb(resolvedCwd);
    if (db.backend === "sqlite") {
      cache = new PlanningCache(db);
      sqlRow = cache.getSessionState(resolvedCwd);
    }
  } catch {
    sqlRow = null;
  }
  let raw;
  try {
    raw = readFileSync(statePath, "utf-8");
  } catch {
    return null;
  }
  if (!raw || raw.trim().length === 0) {
    return null;
  }
  let result;
  if (sqlRow && db && cache) {
    const _db = db;
    const _cache_ref = cache;
    result = Object.freeze({
      raw,
      // Primary fields from SQLite columns
      phase: sqlRow.phase_number ? sqlRow.total_phases ? `${sqlRow.phase_number} of ${sqlRow.total_phases}${sqlRow.phase_name ? ` (${sqlRow.phase_name})` : ""}` : sqlRow.phase_number : extractField(raw, "Phase"),
      currentPlan: sqlRow.current_plan || extractField(raw, "Current Plan"),
      status: sqlRow.status || extractField(raw, "Status"),
      lastActivity: sqlRow.last_activity || extractField(raw, "Last Activity"),
      progress: sqlRow.progress != null ? sqlRow.progress : extractProgress(raw),
      // getField falls back to markdown parsing for fields not in SQLite
      getField(name) {
        const nameLower = name.toLowerCase().replace(/\s+/g, "_");
        if (nameLower === "phase" || nameLower === "phase_number") {
          return sqlRow.phase_number || extractField(raw, name);
        }
        if (nameLower === "current_plan" || name === "Current Plan") {
          return sqlRow.current_plan || extractField(raw, name);
        }
        if (nameLower === "status") {
          return sqlRow.status || extractField(raw, name);
        }
        if (nameLower === "last_activity" || name === "Last Activity") {
          return sqlRow.last_activity || extractField(raw, name);
        }
        return extractField(raw, name);
      },
      getSection(name) {
        return extractSection(raw, name);
      },
      // ─── SQLite-backed query methods (SES-03) ──────────────────────────
      // Returns structured data from SQLite without parsing STATE.md sections.
      // Returns null on Map backend — callers should fall back to getSection().
      getDecisions(options) {
        try {
          return _cache_ref.getSessionDecisions(resolvedCwd, options);
        } catch {
          return null;
        }
      },
      getTodos(options) {
        try {
          return _cache_ref.getSessionTodos(resolvedCwd, options);
        } catch {
          return null;
        }
      },
      getBlockers(options) {
        try {
          return _cache_ref.getSessionBlockers(resolvedCwd, options);
        } catch {
          return null;
        }
      },
      getMetrics(options) {
        try {
          return _cache_ref.getSessionMetrics(resolvedCwd, options);
        } catch {
          return null;
        }
      }
    });
  } else {
    const _db_ref = db;
    const _cache_fallback = cache;
    result = Object.freeze({
      raw,
      phase: extractField(raw, "Phase"),
      currentPlan: extractField(raw, "Current Plan"),
      status: extractField(raw, "Status"),
      lastActivity: extractField(raw, "Last Activity"),
      progress: extractProgress(raw),
      getField(name) {
        return extractField(raw, name);
      },
      getSection(name) {
        return extractSection(raw, name);
      },
      // Query methods return null on Map backend or cold start
      getDecisions(options) {
        if (!_cache_fallback || _cache_fallback._isMap()) return null;
        try {
          return _cache_fallback.getSessionDecisions(resolvedCwd, options);
        } catch {
          return null;
        }
      },
      getTodos(options) {
        if (!_cache_fallback || _cache_fallback._isMap()) return null;
        try {
          return _cache_fallback.getSessionTodos(resolvedCwd, options);
        } catch {
          return null;
        }
      },
      getBlockers(options) {
        if (!_cache_fallback || _cache_fallback._isMap()) return null;
        try {
          return _cache_fallback.getSessionBlockers(resolvedCwd, options);
        } catch {
          return null;
        }
      },
      getMetrics(options) {
        if (!_cache_fallback || _cache_fallback._isMap()) return null;
        try {
          return _cache_fallback.getSessionMetrics(resolvedCwd, options);
        } catch {
          return null;
        }
      }
    });
  }
  _cache.set(resolvedCwd, result);
  return result;
}
function invalidateState(cwd) {
  if (cwd) {
    _cache.delete(cwd);
    try {
      const db = getDb(cwd);
      if (db.backend === "sqlite") {
        const tables = [
          "session_state",
          "session_metrics",
          "session_decisions",
          "session_todos",
          "session_blockers",
          "session_continuity"
        ];
        for (const table of tables) {
          db.prepare(`DELETE FROM ${table} WHERE cwd = ?`).run(cwd);
        }
      }
    } catch {
    }
  } else {
    _cache.clear();
  }
}
var _cache;
var init_state = __esm({
  async "src/plugin/parsers/state.js"() {
    await init_db_cache();
    _cache = /* @__PURE__ */ new Map();
  }
});

// src/plugin/parsers/roadmap.js
import { readFileSync as readFileSync2, writeFileSync as writeFileSync2 } from "fs";
import { join as join5 } from "path";
function normalizeTddHintValue(value) {
  if (value === null || value === void 0) return null;
  const raw = String(value).trim().toLowerCase().replace(/^['"]|['"]$/g, "");
  if (!raw) return null;
  const tokenMatch = raw.match(/^(required|require|mandatory|must|enforced|recommended|recommend|suggested|prefer(?:red)?|true|yes|y|false|no|n|skip(?:ped)?|omit(?:ted)?|none|n\/a|na|not applicable)\b/);
  const token = tokenMatch ? tokenMatch[1] : raw;
  if (["required", "require", "mandatory", "must", "enforced"].includes(token)) return "required";
  if (["recommended", "recommend", "suggested", "prefer", "preferred", "true", "yes", "y"].includes(token)) return "recommended";
  if (["false", "no", "n", "skip", "skipped", "omit", "omitted", "none", "n/a", "na", "not applicable"].includes(token)) return null;
  return null;
}
function normalizeRoadmapTddMetadata(raw) {
  if (!raw || typeof raw !== "string") return { content: raw, changed: false };
  let changed = false;
  const content = raw.replace(/^(\*\*TDD:?\*\*:?\s*)([^\n]*)$/gim, (match, _prefix, value) => {
    const normalized = normalizeTddHintValue(value);
    const canonical = normalized ? `**TDD:** ${normalized}` : "";
    if (canonical !== match) changed = true;
    return canonical;
  }).replace(/\n{3,}/g, "\n\n");
  return { content, changed };
}
function readRoadmapWithTddNormalization(cwd) {
  const roadmapPath = join5(cwd, ".planning", "ROADMAP.md");
  let raw;
  try {
    raw = readFileSync2(roadmapPath, "utf-8");
  } catch {
    return null;
  }
  const normalized = normalizeRoadmapTddMetadata(raw);
  if (normalized.changed) {
    writeFileSync2(roadmapPath, normalized.content, "utf-8");
    return normalized.content;
  }
  return raw;
}
function _getPlanningCache(cwd) {
  try {
    const db = getDb(cwd);
    return new PlanningCache(db);
  } catch {
    return null;
  }
}
function parseMilestones(content) {
  const milestones = [];
  const pattern = /[-*]\s*(?:✅|🔵|🔲)\s*\*\*v(\d+(?:\.\d+)*)\s+([^*]+)\*\*([^\n]*)/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const status = match[0].includes("\u2705") ? "complete" : match[0].includes("\u{1F535}") ? "active" : "pending";
    const rangeMatch = match[0].match(/Phases?\s+(\d+)\s*[-–]\s*(\d+)/i);
    const phases = rangeMatch ? { start: parseInt(rangeMatch[1], 10), end: parseInt(rangeMatch[2], 10) } : null;
    milestones.push(Object.freeze({
      name: match[2].trim(),
      version: "v" + match[1],
      status,
      phases
    }));
  }
  return milestones;
}
function parsePhases(content) {
  const phases = [];
  const pattern = /#{2,4}\s*Phase\s+(\d+(?:\.\d+)?)\s*:\s*([^\n]+)/gi;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const number = match[1];
    const name = match[2].trim();
    const sectionStart = match.index;
    const restOfContent = content.slice(sectionStart);
    const nextHeader = restOfContent.match(/\n#{2,4}\s+Phase\s+\d/i);
    const sectionEnd = nextHeader ? sectionStart + nextHeader.index : content.length;
    const section = content.slice(sectionStart, sectionEnd).trim();
    const goalMatch = section.match(/\*\*Goal:?\*\*:?\s*([^\n]+)/i);
    const goal = goalMatch ? goalMatch[1].trim() : null;
    const plansMatch = section.match(/\*\*Plans:?\*\*:?\s*(?:(\d+)\/)?(\d+)\s*plan/i);
    const planCount = plansMatch ? parseInt(plansMatch[2], 10) : 0;
    const tddMatch = section.match(/\*\*TDD:?\*\*:?\s*([^\n]+)/i);
    const tdd = tddMatch ? normalizeTddHintValue(tddMatch[1]) : null;
    const escaped = number.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const checkboxPattern = new RegExp(`-\\s*\\[x\\]\\s*.*Phase\\s+${escaped}`, "i");
    const status = checkboxPattern.test(content) ? "complete" : "incomplete";
    phases.push(Object.freeze({
      number,
      name,
      status,
      planCount,
      goal,
      tdd,
      section
    }));
  }
  return phases;
}
function parseProgressTable(content) {
  const progress = [];
  const tableMatch = content.match(/\|[^\n]*Phase[^\n]*\|[^\n]*Plans?[^\n]*\|[^\n]*Status[^\n]*\|[^\n]*\n\|[-|\s]+\n((?:\|[^\n]+\n?)*)/i);
  if (!tableMatch) return progress;
  const rows = tableMatch[1].trim().split("\n");
  for (const row of rows) {
    const cells = row.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length >= 3) {
      const plansParts = cells[1].match(/(\d+)\/(\d+)/);
      progress.push(Object.freeze({
        phase: cells[0],
        milestone: null,
        // Can be derived from position if needed
        plansComplete: plansParts ? parseInt(plansParts[1], 10) : 0,
        plansTotal: plansParts ? parseInt(plansParts[2], 10) : 0,
        status: cells[2],
        completed: cells.length >= 4 ? cells[3] || null : null
      }));
    }
  }
  return progress;
}
function buildRoadmapFromCache(phaseRows, milestoneRows, progressRows, resolvedCwd) {
  const milestones = (milestoneRows || []).map((row) => Object.freeze({
    name: row.name || "",
    version: row.version || null,
    status: row.status || "pending",
    phases: row.phase_start != null && row.phase_end != null ? { start: row.phase_start, end: row.phase_end } : null
  }));
  const phases = (phaseRows || []).map((row) => {
    const sec = row.section || "";
    const tddMatch = sec.match(/\*\*TDD:?\*\*:?\s*([^\n]+)/i);
    return Object.freeze({
      number: row.number || "",
      name: row.name || "",
      status: row.status || "incomplete",
      planCount: row.plan_count != null ? row.plan_count : 0,
      goal: row.goal || null,
      tdd: tddMatch ? normalizeTddHintValue(tddMatch[1]) : null,
      section: sec
    });
  });
  const progress = (progressRows || []).map((row) => Object.freeze({
    phase: row.phase || "",
    milestone: null,
    plansComplete: row.plans_complete != null ? row.plans_complete : 0,
    plansTotal: row.plans_total != null ? row.plans_total : 0,
    status: row.status || "",
    completed: row.completed_date || null
  }));
  return Object.freeze({
    raw: null,
    // not stored in cache — consumers needing raw markdown should parse fresh
    milestones,
    phases,
    progress,
    getPhase(num) {
      const numStr = String(num);
      const found = phases.find((p) => p.number === numStr);
      if (!found) return null;
      const section = found.section || "";
      const dependsMatch = section.match(/\*\*Depends on:?\*\*:?\s*([^\n]+)/i);
      const dependsOn = dependsMatch ? dependsMatch[1].trim() : null;
      const reqMatch = section.match(/\*\*Requirements:?\*\*:?\s*([^\n]+)/i);
      const requirements = reqMatch ? reqMatch[1].trim() : null;
      const criteriaMatch = section.match(/\*\*Success Criteria\*\*[^\n]*:\s*\n((?:\s*\d+\.\s*[^\n]+\n?)+)/i);
      const successCriteria = criteriaMatch ? criteriaMatch[1].trim().split("\n").map((l) => l.replace(/^\s*\d+\.\s*/, "").trim()).filter(Boolean) : [];
      const plansMatch = section.match(/\*\*Plans:?\*\*:?\s*(?:(\d+)\/)?(\d+)\s*plan/i);
      const plans = plansMatch ? {
        completed: plansMatch[1] ? parseInt(plansMatch[1], 10) : 0,
        total: parseInt(plansMatch[2], 10)
      } : null;
      const tddMatch2 = section.match(/\*\*TDD:?\*\*:?\s*([^\n]+)/i);
      const tdd = tddMatch2 ? normalizeTddHintValue(tddMatch2[1]) : found.tdd;
      return Object.freeze({
        number: found.number,
        name: found.name,
        goal: found.goal,
        tdd,
        dependsOn,
        requirements,
        successCriteria,
        plans
      });
    },
    getMilestone(name) {
      return milestones.find(
        (m) => m.name.toLowerCase().includes(name.toLowerCase()) || m.version && m.version.toLowerCase() === name.toLowerCase()
      ) || null;
    },
    get currentMilestone() {
      return milestones.find((m) => m.status === "active") || null;
    }
  });
}
function parseRoadmap(cwd) {
  const resolvedCwd = cwd || process.cwd();
  if (_cache2.has(resolvedCwd)) {
    return _cache2.get(resolvedCwd);
  }
  const roadmapPath = join5(resolvedCwd, ".planning", "ROADMAP.md");
  const planningCache = _getPlanningCache(resolvedCwd);
  if (planningCache) {
    const freshness = planningCache.checkFreshness(roadmapPath);
    if (freshness === "fresh") {
      const phaseRows = planningCache.getPhases(resolvedCwd);
      if (phaseRows && phaseRows.length > 0) {
        const milestoneRows = planningCache.getMilestones(resolvedCwd);
        const progressRows = planningCache.getProgress(resolvedCwd);
        const result2 = buildRoadmapFromCache(phaseRows, milestoneRows || [], progressRows || [], resolvedCwd);
        _cache2.set(resolvedCwd, result2);
        return result2;
      }
    }
  }
  let raw;
  try {
    raw = readRoadmapWithTddNormalization(resolvedCwd) || readFileSync2(roadmapPath, "utf-8");
  } catch {
    return null;
  }
  if (!raw || raw.trim().length === 0) {
    return null;
  }
  const milestones = parseMilestones(raw);
  const phases = parsePhases(raw);
  const progress = parseProgressTable(raw);
  const result = Object.freeze({
    raw,
    milestones,
    phases,
    progress,
    getPhase(num) {
      const numStr = String(num);
      const found = phases.find((p) => p.number === numStr);
      if (!found) return null;
      const section = found.section;
      const dependsMatch = section.match(/\*\*Depends on:?\*\*:?\s*([^\n]+)/i);
      const dependsOn = dependsMatch ? dependsMatch[1].trim() : null;
      const reqMatch = section.match(/\*\*Requirements:?\*\*:?\s*([^\n]+)/i);
      const requirements = reqMatch ? reqMatch[1].trim() : null;
      const criteriaMatch = section.match(/\*\*Success Criteria\*\*[^\n]*:\s*\n((?:\s*\d+\.\s*[^\n]+\n?)+)/i);
      const successCriteria = criteriaMatch ? criteriaMatch[1].trim().split("\n").map((l) => l.replace(/^\s*\d+\.\s*/, "").trim()).filter(Boolean) : [];
      const plansMatch = section.match(/\*\*Plans:?\*\*:?\s*(?:(\d+)\/)?(\d+)\s*plan/i);
      const plans = plansMatch ? {
        completed: plansMatch[1] ? parseInt(plansMatch[1], 10) : 0,
        total: parseInt(plansMatch[2], 10)
      } : null;
      return Object.freeze({
        number: found.number,
        name: found.name,
        goal: found.goal,
        tdd: found.tdd,
        dependsOn,
        requirements,
        successCriteria,
        plans
      });
    },
    getMilestone(name) {
      return milestones.find(
        (m) => m.name.toLowerCase().includes(name.toLowerCase()) || m.version.toLowerCase() === name.toLowerCase()
      ) || null;
    },
    get currentMilestone() {
      return milestones.find((m) => m.status === "active") || null;
    }
  });
  if (planningCache) {
    const storedPhases = phases.map((p) => ({
      number: p.number,
      name: p.name,
      status: p.status,
      plan_count: p.planCount,
      goal: p.goal,
      section: p.section
    }));
    const storedMilestones = milestones.map((m) => ({
      name: m.name,
      version: m.version,
      status: m.status,
      phase_start: m.phases ? m.phases.start : null,
      phase_end: m.phases ? m.phases.end : null
    }));
    const storedProgress = progress.map((p) => ({
      phase: p.phase,
      plans_complete: p.plansComplete,
      plans_total: p.plansTotal,
      status: p.status,
      completed_date: p.completed
    }));
    planningCache.storeRoadmap(resolvedCwd, roadmapPath, {
      phases: storedPhases,
      milestones: storedMilestones,
      progress: storedProgress
    });
  }
  _cache2.set(resolvedCwd, result);
  return result;
}
function invalidateRoadmap(cwd) {
  if (cwd) {
    _cache2.delete(cwd);
    try {
      const planningCache = _getPlanningCache(cwd);
      if (planningCache) {
        const roadmapPath = join5(cwd, ".planning", "ROADMAP.md");
        planningCache.invalidateFile(roadmapPath);
      }
    } catch {
    }
  } else {
    _cache2.clear();
  }
}
var _cache2;
var init_roadmap = __esm({
  async "src/plugin/parsers/roadmap.js"() {
    await init_db_cache();
    _cache2 = /* @__PURE__ */ new Map();
  }
});

// src/plugin/parsers/plan.js
import { readFileSync as readFileSync3, readdirSync } from "fs";
import { join as join6, dirname } from "path";
function _getPlanningCache2(cwd) {
  try {
    const db = getDb(cwd);
    return new PlanningCache(db);
  } catch {
    return null;
  }
}
function _cwdFromPlanPath(planPath) {
  let dir = dirname(planPath);
  while (dir !== dirname(dir)) {
    if (dir.endsWith("/.planning") || dir.includes("/.planning/")) {
      const planningIdx = dir.indexOf("/.planning");
      if (planningIdx !== -1) {
        return dir.slice(0, planningIdx) || "/";
      }
    }
    dir = dirname(dir);
  }
  return null;
}
function _buildPlanFromCache(planRow) {
  const frontmatter = planRow.frontmatter_json ? JSON.parse(planRow.frontmatter_json) : {};
  const tasks = (planRow.tasks || []).map((t) => Object.freeze({
    type: t.type || "auto",
    name: t.name || null,
    files: t.files_json ? JSON.parse(t.files_json) : [],
    action: t.action || null,
    verify: t.verify || null,
    done: t.done || null
  }));
  return Object.freeze({
    raw: null,
    // not stored in cache
    path: planRow.path,
    frontmatter: Object.freeze(frontmatter),
    objective: planRow.objective || null,
    context: null,
    // not stored separately — available on fresh parse
    tasks: Object.freeze(tasks),
    verification: null,
    // not stored separately
    successCriteria: null,
    // not stored separately
    output: null
    // not stored separately
  });
}
function extractFrontmatter(content) {
  if (!content || typeof content !== "string") return {};
  if (!content.startsWith("---\n")) return {};
  const frontmatter = {};
  const match = content.match(FM_DELIMITERS);
  if (!match) return frontmatter;
  const yaml = match[1];
  const lines = yaml.split("\n");
  let stack = [{ obj: frontmatter, key: null, indent: -1 }];
  for (const line of lines) {
    if (line.trim() === "") continue;
    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1].length : 0;
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const current = stack[stack.length - 1];
    const keyMatch = line.match(FM_KEY_VALUE);
    if (keyMatch) {
      const key = keyMatch[2];
      const value = keyMatch[3].trim();
      if (value === "" || value === "[") {
        current.obj[key] = value === "[" ? [] : {};
        current.key = null;
        stack.push({ obj: current.obj[key], key: null, indent });
      } else if (value.startsWith("[") && value.endsWith("]")) {
        current.obj[key] = value.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
        current.key = null;
      } else {
        current.obj[key] = value.replace(/^["']|["']$/g, "");
        current.key = null;
      }
    } else if (line.trim().startsWith("- ")) {
      const itemValue = line.trim().slice(2).replace(/^["']|["']$/g, "");
      if (typeof current.obj === "object" && !Array.isArray(current.obj) && Object.keys(current.obj).length === 0) {
        const parent = stack.length > 1 ? stack[stack.length - 2] : null;
        if (parent) {
          for (const k of Object.keys(parent.obj)) {
            if (parent.obj[k] === current.obj) {
              parent.obj[k] = [itemValue];
              current.obj = parent.obj[k];
              break;
            }
          }
        }
      } else if (Array.isArray(current.obj)) {
        current.obj.push(itemValue);
      }
    }
  }
  return frontmatter;
}
function extractXmlSection(content, tagName) {
  const pattern = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`);
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}
function extractTasks(content) {
  const tasksSection = extractXmlSection(content, "tasks");
  if (!tasksSection) return [];
  const tasks = [];
  const taskPattern = /<task\s+([^>]*)>([\s\S]*?)<\/task>/g;
  let match;
  while ((match = taskPattern.exec(tasksSection)) !== null) {
    const attrs = match[1];
    const body = match[2];
    const typeMatch = attrs.match(/type="([^"]+)"/);
    const type = typeMatch ? typeMatch[1] : "auto";
    const nameMatch = body.match(/<name>([\s\S]*?)<\/name>/);
    const filesMatch = body.match(/<files>([\s\S]*?)<\/files>/);
    const actionMatch = body.match(/<action>([\s\S]*?)<\/action>/);
    const verifyMatch = body.match(/<verify>([\s\S]*?)<\/verify>/);
    const doneMatch = body.match(/<done>([\s\S]*?)<\/done>/);
    tasks.push(Object.freeze({
      type,
      name: nameMatch ? nameMatch[1].trim() : null,
      files: filesMatch ? filesMatch[1].trim().split(",").map((f) => f.trim()).filter(Boolean) : [],
      action: actionMatch ? actionMatch[1].trim() : null,
      verify: verifyMatch ? verifyMatch[1].trim() : null,
      done: doneMatch ? doneMatch[1].trim() : null
    }));
  }
  return tasks;
}
function parsePlan(planPath, cwd) {
  if (_planCache.has(planPath)) {
    return _planCache.get(planPath);
  }
  const resolvedCwd = cwd || _cwdFromPlanPath(planPath) || process.cwd();
  const planningCache = _getPlanningCache2(resolvedCwd);
  if (planningCache) {
    const freshness = planningCache.checkFreshness(planPath);
    if (freshness === "fresh") {
      const planRow = planningCache.getPlan(planPath);
      if (planRow) {
        const result2 = _buildPlanFromCache(planRow);
        _planCache.set(planPath, result2);
        return result2;
      }
    }
  }
  let raw;
  try {
    raw = readFileSync3(planPath, "utf-8");
  } catch {
    return null;
  }
  if (!raw || raw.trim().length === 0) {
    return null;
  }
  const frontmatter = extractFrontmatter(raw);
  const tasks = extractTasks(raw);
  const result = Object.freeze({
    raw,
    path: planPath,
    frontmatter: Object.freeze(frontmatter),
    objective: extractXmlSection(raw, "objective"),
    context: extractXmlSection(raw, "context"),
    tasks,
    verification: extractXmlSection(raw, "verification"),
    successCriteria: extractXmlSection(raw, "success_criteria"),
    output: extractXmlSection(raw, "output")
  });
  if (planningCache) {
    planningCache.storePlan(planPath, resolvedCwd, result);
  }
  _planCache.set(planPath, result);
  return result;
}
function parsePlans(phaseNum, cwd) {
  const resolvedCwd = cwd || process.cwd();
  const cacheKey = `${resolvedCwd}:${phaseNum}`;
  if (_plansCache.has(cacheKey)) {
    return _plansCache.get(cacheKey);
  }
  const normalized = String(phaseNum).replace(/^0+/, "") || "0";
  const phasesDir = join6(resolvedCwd, ".planning", "phases");
  let phaseDir = null;
  try {
    const entries = readdirSync(phasesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dirMatch = entry.name.match(/^(\d+(?:\.\d+)?)-?(.*)/);
      if (!dirMatch) continue;
      const dirPhaseNum = dirMatch[1].replace(/^0+/, "") || "0";
      if (dirPhaseNum === normalized) {
        phaseDir = join6(phasesDir, entry.name);
        break;
      }
    }
  } catch {
    return Object.freeze([]);
  }
  if (!phaseDir) {
    return Object.freeze([]);
  }
  let planFiles;
  try {
    const files = readdirSync(phaseDir);
    planFiles = files.filter((f) => f.endsWith("-PLAN.md") || f === "PLAN.md").sort();
  } catch {
    return Object.freeze([]);
  }
  const planningCache = _getPlanningCache2(resolvedCwd);
  if (planningCache && planFiles.length > 0) {
    const planPaths = planFiles.map((f) => join6(phaseDir, f));
    const freshnessResult = planningCache.checkAllFreshness(planPaths);
    if (freshnessResult.stale.length === 0 && freshnessResult.missing.length === 0) {
      const phaseNumStr = String(phaseNum);
      const cachedRows = planningCache.getPlansForPhase(phaseNumStr, resolvedCwd);
      if (cachedRows && cachedRows.length === planFiles.length) {
        const plans2 = cachedRows.map((row) => {
          const planRow = planningCache.getPlan(row.path);
          if (!planRow) return null;
          const result = _buildPlanFromCache(planRow);
          _planCache.set(row.path, result);
          return result;
        }).filter(Boolean);
        if (plans2.length === planFiles.length) {
          const frozen2 = Object.freeze(plans2);
          _plansCache.set(cacheKey, frozen2);
          return frozen2;
        }
      }
    }
  }
  const plans = planFiles.map((f) => parsePlan(join6(phaseDir, f), resolvedCwd)).filter(Boolean);
  const frozen = Object.freeze(plans);
  _plansCache.set(cacheKey, frozen);
  return frozen;
}
function invalidatePlans(cwd) {
  if (cwd) {
    for (const key of _plansCache.keys()) {
      if (key.startsWith(cwd + ":")) {
        _plansCache.delete(key);
      }
    }
    const planPaths = [];
    for (const key of _planCache.keys()) {
      if (key.startsWith(cwd)) {
        _planCache.delete(key);
        planPaths.push(key);
      }
    }
    try {
      const planningCache = _getPlanningCache2(cwd);
      if (planningCache) {
        for (const planPath of planPaths) {
          planningCache.invalidateFile(planPath);
        }
      }
    } catch {
    }
  } else {
    _planCache.clear();
    _plansCache.clear();
  }
}
var _planCache, _plansCache, FM_DELIMITERS, FM_KEY_VALUE;
var init_plan = __esm({
  async "src/plugin/parsers/plan.js"() {
    await init_db_cache();
    _planCache = /* @__PURE__ */ new Map();
    _plansCache = /* @__PURE__ */ new Map();
    FM_DELIMITERS = /^---\n([\s\S]+?)\n---/;
    FM_KEY_VALUE = /^(\s*)([a-zA-Z0-9_-]+):\s*(.*)/;
  }
});

// src/lib/constants.js
var require_constants = __commonJS({
  "src/lib/constants.js"(exports, module) {
    var VALID_TRAJECTORY_SCOPES = ["task", "plan", "phase"];
    var MODEL_PROFILES = {
      "bgsd-planner": { quality: "opus", balanced: "opus", budget: "sonnet" },
      "bgsd-roadmapper": { quality: "opus", balanced: "sonnet", budget: "sonnet" },
      "bgsd-executor": { quality: "opus", balanced: "sonnet", budget: "sonnet" },
      "bgsd-phase-researcher": { quality: "opus", balanced: "sonnet", budget: "haiku" },
      "bgsd-project-researcher": { quality: "opus", balanced: "sonnet", budget: "haiku" },
      "bgsd-debugger": { quality: "opus", balanced: "sonnet", budget: "sonnet" },
      "bgsd-codebase-mapper": { quality: "sonnet", balanced: "haiku", budget: "haiku" },
      "bgsd-verifier": { quality: "sonnet", balanced: "sonnet", budget: "haiku" },
      "bgsd-plan-checker": { quality: "sonnet", balanced: "sonnet", budget: "haiku" }
    };
    var CONFIG_SCHEMA = {
      model_profile: { type: "string", default: "balanced", description: "Active model profile (quality/balanced/budget)", aliases: [], nested: null },
      commit_docs: { type: "boolean", default: true, description: "Auto-commit planning docs", aliases: [], nested: { section: "planning", field: "commit_docs" } },
      search_gitignored: { type: "boolean", default: false, description: "Include gitignored files in searches", aliases: [], nested: { section: "planning", field: "search_gitignored" } },
      branching_strategy: { type: "string", default: "none", description: "Git branching strategy", aliases: [], nested: { section: "git", field: "branching_strategy" } },
      phase_branch_template: { type: "string", default: "bgsd/phase-{phase}-{slug}", description: "Phase branch name template", aliases: [], nested: { section: "git", field: "phase_branch_template" } },
      milestone_branch_template: { type: "string", default: "bgsd/{milestone}-{slug}", description: "Milestone branch name template", aliases: [], nested: { section: "git", field: "milestone_branch_template" } },
      research: { type: "boolean", default: true, description: "Enable research phase", aliases: ["research_enabled"], nested: { section: "workflow", field: "research" } },
      plan_checker: { type: "boolean", default: true, description: "Enable plan checking", aliases: [], nested: { section: "workflow", field: "plan_check" } },
      verifier: { type: "boolean", default: true, description: "Enable verification phase", aliases: [], nested: { section: "workflow", field: "verifier" } },
      parallelization: { type: "boolean", default: true, description: "Enable parallel plan execution", aliases: [], nested: null, coerce: "parallelization" },
      brave_search: { type: "boolean", default: false, description: "Enable Brave Search API", aliases: [], nested: null },
      mode: { type: "string", default: "interactive", description: "Execution mode (interactive or yolo)", aliases: [], nested: null },
      depth: { type: "string", default: "standard", description: "Planning depth", aliases: [], nested: null },
      test_commands: { type: "object", default: {}, description: "Test commands by framework", aliases: [], nested: null },
      test_gate: { type: "boolean", default: true, description: "Block plan completion on test failure", aliases: [], nested: null },
      context_window: { type: "number", default: 2e5, description: "Context window size in tokens", aliases: [], nested: null },
      context_target_percent: { type: "number", default: 50, description: "Target context utilization percent (1-100)", aliases: [], nested: null },
      runtime: { type: "string", default: "auto", description: "Runtime to use (auto/bun/node)", aliases: [], nested: null },
      workspace_base_path: { type: "string", default: "/tmp/gsd-workspaces", description: "Base path for managed JJ execution workspaces", aliases: [], nested: { section: "workspace", field: "base_path" } },
      workspace_max_concurrent: { type: "number", default: 3, description: "Maximum managed JJ workspaces per project", aliases: [], nested: { section: "workspace", field: "max_concurrent" } },
      // ─── RAG Research Pipeline ───
      rag_enabled: { type: "boolean", default: true, description: "Enable RAG-powered research pipeline", aliases: [], nested: { section: "workflow", field: "rag" } },
      rag_timeout: { type: "number", default: 30, description: "Per-tool research timeout in seconds", aliases: [], nested: { section: "workflow", field: "rag_timeout" } },
      ytdlp_path: { type: "string", default: "", description: "Path to yt-dlp binary (auto-detects if empty)", aliases: [], nested: null },
      nlm_path: { type: "string", default: "", description: "Path to notebooklm-py binary (auto-detects if empty)", aliases: [], nested: null },
      mcp_config_path: { type: "string", default: "", description: "Path to MCP server config file (auto-detects if empty)", aliases: [], nested: null },
      // ─── Dependency-Backed Optimizations ───
      optimization: { type: "object", default: {}, description: "Optimization flags for dependency-backed features", aliases: [], nested: null },
      optimization_valibot: { type: "boolean", default: true, description: "Use valibot for schema validation", aliases: [], nested: { section: "optimization", field: "valibot" }, env: "BGSD_DEP_VALIBOT" },
      optimization_discovery: { type: "string", default: "optimized", description: "File discovery mode", aliases: [], nested: { section: "optimization", field: "discovery" }, env: "BGSD_DISCOVERY_MODE", values: ["optimized", "legacy"] },
      optimization_compile_cache: { type: "boolean", default: false, description: "Enable Node.js compile-cache", aliases: [], nested: { section: "optimization", field: "compile_cache" }, env: "BGSD_COMPILE_CACHE" },
      optimization_sqlite_cache: { type: "boolean", default: true, description: "SQLite statement caching", aliases: [], nested: { section: "optimization", field: "sqlite_cache" }, env: "BGSD_SQLITE_STATEMENT_CACHE" },
      // ─── CLI Tool Toggles ───
      tools_ripgrep: { type: "boolean", default: true, description: "Enable ripgrep for content search", aliases: [], nested: { section: "tools", field: "ripgrep" } },
      tools_fd: { type: "boolean", default: true, description: "Enable fd for file discovery", aliases: [], nested: { section: "tools", field: "fd" } },
      tools_jq: { type: "boolean", default: true, description: "Enable jq for JSON transformation", aliases: [], nested: { section: "tools", field: "jq" } },
      tools_yq: { type: "boolean", default: true, description: "Enable yq for YAML transformation", aliases: [], nested: { section: "tools", field: "yq" } },
      tools_ast_grep: { type: "boolean", default: true, description: "Enable ast-grep for syntax-aware code search", aliases: [], nested: { section: "tools", field: "ast_grep" } },
      tools_sd: { type: "boolean", default: true, description: "Enable sd for fast text replacement", aliases: [], nested: { section: "tools", field: "sd" } },
      tools_hyperfine: { type: "boolean", default: true, description: "Enable hyperfine for command benchmarking", aliases: [], nested: { section: "tools", field: "hyperfine" } },
      tools_bat: { type: "boolean", default: true, description: "Enable bat for syntax highlighting", aliases: [], nested: { section: "tools", field: "bat" } },
      tools_gh: { type: "boolean", default: true, description: "Enable gh for GitHub operations", aliases: [], nested: { section: "tools", field: "gh" } }
    };
    var COMMAND_HELP = {
      "util:codebase context": `Usage: bgsd-tools util:codebase context --files <file1> [file2] ... [--plan <path>]
       bgsd-tools util:codebase context --task <file1,file2,...> [--plan <path>] [--budget <tokens>]

Assemble per-file architectural context from cached intel.

Mode 1 (--files): Full context with imports, dependents, conventions, risk levels.
Mode 2 (--task):  Task-scoped context using dep graph + relevance scoring.
  Returns only files relevant to the task with scores and optional AST signatures.

Options:
  --files <paths>    Target file paths for full context mode
  --task <paths>     Comma-separated task files for scoped context mode
  --plan <path>      Plan file for scope signal (reads files_modified)
  --budget <tokens>  Token budget for task-scoped output (default: 3000)

Output (--task): { task_files, context_files: [{path, score, reason, signatures?}], stats }

Examples:
  bgsd-tools util:codebase context --files src/lib/ast.js
  bgsd-tools util:codebase context --task src/lib/ast.js,src/router.js --budget 2000`,
      "util:codebase ast": `Usage: bgsd-tools util:codebase ast <file>

Extract function, class, and method signatures from a source file.

For JS/TS: Uses acorn AST parsing with TypeScript stripping.
For Python, Go, Rust, Ruby, Elixir, Java, PHP: Uses regex-based extraction.

Arguments:
  file   Source file path to analyze

Output: { file, language, signatures: [{name, type, params, line, async, generator}], count }

Examples:
  bgsd-tools util:codebase ast src/lib/ast.js
  bgsd-tools util:codebase ast app.py`,
      "util:codebase exports": `Usage: bgsd-tools util:codebase exports <file>

Extract the export surface from a JS/TS module.

Detects ESM exports (named, default, re-exports) and CJS exports
(module.exports, exports patterns). Reports module type (esm/cjs/mixed).

Arguments:
  file   Source file path to analyze

Output: { file, type, named, default, re_exports, cjs_exports }

Examples:
  bgsd-tools util:codebase exports src/lib/ast.js
  bgsd-tools util:codebase exports src/router.js`,
      "util:codebase complexity": `Usage: bgsd-tools util:codebase complexity <file>

Compute per-function cyclomatic complexity for a source file.

For JS/TS: Uses acorn AST to walk each function body, counting branching
nodes (if, for, while, switch, catch, ternary, logical operators) and
tracking max nesting depth.

For other languages: Uses regex approximation counting branching keywords.

Arguments:
  file   Source file path to analyze

Output: { file, module_complexity, functions: [{name, line, complexity, nesting_max}] }

Color coding (formatted mode): green(1-5), yellow(6-10), red(11+)

Examples:
  bgsd-tools util:codebase complexity src/router.js
  bgsd-tools util:codebase complexity src/lib/ast.js`,
      "util:codebase repo-map": `Usage: bgsd-tools util:codebase repo-map [--budget <tokens>]

Generate a compact repository map from AST signatures.

Walks all source files, extracts function/class/method signatures and
exports, then builds a compact text summary sorted by signature density.
Designed for agent context injection (~1k tokens by default).

Options:
  --budget <tokens>   Token budget for output (default: 1000)

Output (raw): { summary, files_included, total_signatures, token_estimate }
Output (formatted): The summary text directly

Examples:
  bgsd-tools util:codebase repo-map
  bgsd-tools util:codebase repo-map --budget 500`,
      "execute:trajectory": `Usage: bgsd-tools execute:trajectory <subcommand> [options]

Trajectory engineering commands.

Subcommands:
  checkpoint <name>  Create named checkpoint with auto-metrics
    --scope <scope>       Scope level (default: phase)
    --description <text>  Optional context description
  list               List all checkpoints with metrics
    --scope <scope>       Filter by scope
    --name <name>         Filter by checkpoint name
    --limit <N>           Limit results
  compare <name>     Compare metrics across all attempts for a checkpoint
    --scope <scope>       Scope level (default: phase)
  pivot <checkpoint>   Abandon current approach, rewind to checkpoint
    --scope <scope>       Scope level (default: phase)
    --reason <text>       Why this approach is being abandoned (required)
    --attempt <N>         Target specific attempt (default: most recent)
    --stash               Auto-stash dirty working tree before pivot
  choose <name> --attempt <N>   Select winner, archive rest, clean up
    --scope <scope>       Scope level (default: phase)
    --reason <text>       Why this attempt was chosen (recorded in journal)
  dead-ends              Query journal for failed approaches
    --scope <scope>       Filter by scope (task, plan, phase)
    --name <name>         Filter by checkpoint name
    --limit <N>           Max results (default: 10)
    --token-cap <N>       Token cap for context output (default: 500)

Creates a git branch at trajectory/<scope>/<name>/attempt-N and writes a
journal entry to the trajectories memory store with test count, LOC delta,
and cyclomatic complexity metrics.

Examples:
  bgsd-tools execute:trajectory checkpoint explore-auth
  bgsd-tools execute:trajectory checkpoint try-redis --scope task --description "Redis caching approach"
  bgsd-tools execute:trajectory list
  bgsd-tools execute:trajectory list --scope phase --limit 5
  bgsd-tools execute:trajectory compare my-feat
  bgsd-tools execute:trajectory pivot explore-auth --reason "JWT approach too complex"
  bgsd-tools execute:trajectory choose my-feat --attempt 2 --reason "Better test coverage"
  bgsd-tools execute:trajectory dead-ends
  bgsd-tools execute:trajectory dead-ends --scope task --limit 5`,
      "execute:trajectory compare": `Usage: bgsd-tools execute:trajectory compare <name> [--scope <scope>]

Compare metrics across all attempts for a named checkpoint.
Shows test results, LOC delta, and cyclomatic complexity side-by-side.
Best values highlighted green, worst highlighted red.

Arguments:
  name              Checkpoint name to compare attempts for

Options:
  --scope <scope>   Scope level (default: phase)

Output: { checkpoint, scope, attempt_count, attempts, best_per_metric, worst_per_metric }

Examples:
  bgsd-tools execute:trajectory compare my-feat
  bgsd-tools execute:trajectory compare try-redis --scope task`,
      "execute:trajectory choose": `Usage: bgsd-tools execute:trajectory choose <name> --attempt <N> [--scope <scope>] [--reason "rationale"]

Select the winning attempt, merge its code, archive non-chosen attempts as tags,
and delete all trajectory working branches.

Arguments:
  name              Checkpoint name to finalize

Options:
  --attempt <N>     Required. The winning attempt number
  --scope <scope>   Scope level (default: phase)
  --reason "text"   Why this attempt was chosen (recorded in journal)

What happens:
  1. Winning attempt branch is merged into current branch (--no-ff)
  2. Non-chosen attempt branches are archived as lightweight git tags
  3. All trajectory working branches are deleted (tags preserved)
  4. Journal records the choice with rationale

Examples:
  bgsd-tools execute:trajectory choose my-feat --attempt 2
  bgsd-tools execute:trajectory choose try-redis --scope task --attempt 1 --reason "Lower complexity"`,
      "execute:trajectory pivot": `Usage: bgsd-tools execute:trajectory pivot <checkpoint> --reason "what failed and why"

Abandon current approach with recorded reasoning and rewind to checkpoint.
Auto-checkpoints current work as abandoned attempt before rewinding.

Arguments:
  checkpoint          Name of checkpoint to rewind to

Options:
  --scope <scope>     Scope level (default: phase)
  --reason <text>     Structured reason for abandoning (required)
  --attempt <N>       Target specific attempt number (default: most recent)
  --stash             Auto-stash dirty working tree before pivot

Output: { pivoted, checkpoint, target_ref, abandoned_branch, files_rewound, stash_used }

Examples:
  bgsd-tools execute:trajectory pivot explore-auth --reason "JWT approach too complex, session-based simpler"
  bgsd-tools execute:trajectory pivot try-redis --scope task --reason "Redis overkill for this cache size"
  bgsd-tools execute:trajectory pivot my-feature --attempt 2 --reason "Attempt 2 had better foundation"`,
      "execute:trajectory dead-ends": `Usage: bgsd-tools execute:trajectory dead-ends [--scope <scope>] [--name <name>] [--limit <N>] [--token-cap <N>]

Query journal for failed approaches (pivot/abandon entries).
Shows "what NOT to do" context with reasons from pivot entries.

Options:
  --scope <scope>   Filter by scope (task, plan, phase)
  --name <name>     Filter by checkpoint name
  --limit <N>       Max results (default: 10)
  --token-cap <N>   Token cap for context output (default: 500)

Output: { dead_ends, count, scope_filter, name_filter, context }

Examples:
  bgsd-tools execute:trajectory dead-ends
  bgsd-tools execute:trajectory dead-ends --scope task --limit 5`,
      "util:classify plan": `Usage: bgsd-tools util:classify plan <plan-path>

Classify all tasks in a plan file with 1-5 complexity scores.

Scoring factors: file count, cross-module blast radius, test requirements,
checkpoint complexity, action length.

Model mapping: score 1-2 \u2192 sonnet, score 3 \u2192 sonnet, score 4-5 \u2192 opus

Output: { plan, wave, autonomous, task_count, tasks: [{name, complexity}], plan_complexity, recommended_model }

Examples:
  bgsd-tools util:classify plan .planning/phases/39-orchestration-intelligence/39-01-PLAN.md`,
      "util:classify phase": `Usage: bgsd-tools util:classify phase <phase-number>

Classify all incomplete plans in a phase and determine execution mode.

Execution modes:
  single      1 plan with 1-2 tasks
  parallel    Multiple plans in same wave, no file overlaps
  sequential  Plans with checkpoint tasks
  pipeline    Plans spanning 3+ waves

Output: { phase, plans_classified, plans: [...], execution_mode: { mode, reason, waves } }

Examples:
  bgsd-tools util:classify phase 39
  bgsd-tools util:classify phase 38`,
      "util:git": `Usage: bgsd-tools util:git <log|diff-summary|blame|branch-info|rewind|trajectory-branch> [options]

Structured git intelligence \u2014 JSON output for agents and workflows.

Subcommands:
  log [--count N] [--since D] [--until D] [--author A] [--path P]
    Structured commit log with file stats and conventional commit parsing.
  diff-summary [--from ref] [--to ref] [--path P]
    Diff stats between two refs (default: HEAD~1..HEAD).
  blame <file>
    Line-to-commit/author mapping for a file.
  branch-info
    Current branch state: detached, shallow, dirty, rebasing, upstream.
  rewind --ref <ref> [--confirm] [--dry-run]
    Selective code rewind protecting .planning/ and root configs.
    Shows diff summary of changes. --dry-run previews without modifying.
    --confirm executes the rewind. Auto-stashes dirty working tree.
  trajectory-branch --phase <N> --slug <name> [--push]
    Create branch in gsd/trajectory/{phase}-{slug} namespace.
    Local-only by default. --push to push to origin.

Examples:
  bgsd-tools util:git log --count 5
  bgsd-tools util:git diff-summary --from main --to HEAD
  bgsd-tools util:git blame src/router.js
  bgsd-tools util:git branch-info
  bgsd-tools util:git rewind --ref HEAD~3 --dry-run
  bgsd-tools util:git rewind --ref abc123 --confirm
  bgsd-tools util:git trajectory-branch --phase 45 --slug decision-journal`,
      // ─── Namespaced Command Help (user-facing only) ──────────────────────────────
      // plan namespace
      "plan:intent": `Usage: bgsd-tools plan:intent <subcommand> [options]

Manage project intent in INTENT.md.

Subcommands:
  create      Create a new INTENT.md
  show        Display intent summary
  read        Read intent as JSON
  update      Update INTENT.md sections
  validate    Validate INTENT.md structure
  trace       Traceability matrix
  drift       Drift analysis`,
      "plan:intent show": `Usage: bgsd-tools plan:intent show [section] [--full]

Display intent summary from INTENT.md.`,
      "plan:requirements": `Usage: bgsd-tools plan:requirements mark-complete <ids>

Mark requirement IDs as complete.`,
      "plan:roadmap": `Usage: bgsd-tools plan:roadmap <subcommand> [args]

Roadmap operations.

Subcommands:
  get-phase <phase>   Extract phase section from ROADMAP.md
  analyze             Full roadmap parse with disk status
  update-plan-progress <N>  Update progress table row from disk`,
      "plan:phases": `Usage: bgsd-tools plan:phases list [options]

List phase directories with metadata.`,
      "plan:find-phase": `Usage: bgsd-tools plan:find-phase <phase>

Find a phase directory by number.`,
      "plan:milestone": `Usage: bgsd-tools plan:milestone complete <version> [options]

Complete a milestone.`,
      "plan:phase": `Usage: bgsd-tools plan:phase <subcommand> [args]

Phase lifecycle operations.

Subcommands:
  next-decimal <phase>   Calculate next decimal phase
  add <description>       Append new phase
  insert <after> <desc>  Insert decimal phase
  remove <phase> [--force]  Remove phase
  complete <phase>       Mark phase done`,
      "phase:snapshot": `Usage: bgsd-tools phase:snapshot <phase>

Return a compact phase snapshot with metadata, requirement IDs, artifact paths,
plan index data, and common execution context in one additive payload.`,
      // execute namespace
      "execute:commit": `Usage: bgsd-tools execute:commit <message> [--files f1 f2 ...] [--amend] [--agent <type>]

Commit planning documents to git.`,
      "execute:rollback-info": `Usage: bgsd-tools execute:rollback-info <plan-id>

Show commits and revert command for a plan.`,
      "execute:session-diff": `Usage: bgsd-tools execute:session-diff

Show git commits since last session activity.`,
      "execute:session-summary": `Usage: bgsd-tools execute:session-summary

Session handoff summary.`,
      "execute:velocity": `Usage: bgsd-tools execute:velocity

Calculate planning velocity and completion forecast.`,
      "workspace": `Usage: bgsd-tools workspace <subcommand> [options]

Manage JJ workspaces for local execution isolation and recovery.

Subcommands:
  add <plan-id>                Create a managed JJ workspace for a plan
  list                         List managed JJ workspaces for this project
  forget <plan-id|name>        Stop tracking a managed workspace
  cleanup                      Forget managed workspaces and delete their directories
  reconcile <plan-id|name>     Inspect recovery state and preview reconcile actions`,
      "workspace list": `Usage: bgsd-tools workspace list

List the JJ workspaces managed under this project's configured workspace base path, including recovery-needed runs.`,
      "workspace add": `Usage: bgsd-tools workspace add <plan-id>

Create a managed JJ workspace using the deterministic phase-plan workspace name.`,
      "workspace forget": `Usage: bgsd-tools workspace forget <plan-id|workspace-name>

Forget a managed JJ workspace without deleting its directory.`,
      "workspace cleanup": `Usage: bgsd-tools workspace cleanup

Forget every managed JJ workspace for this project and remove only directories that are no longer needed after recovery work.`,
      "workspace reconcile": `Usage: bgsd-tools workspace reconcile <plan-id|workspace-name>

Inspect a managed JJ workspace, report JJ-backed recovery context, and preview reconcile actions before follow-up mutation.`,
      "execute:tdd": `Usage: bgsd-tools execute:tdd <subcommand> [options]

Canonical TDD contract command surfaces.

Shared contract: RED / GREEN / REFACTOR phases with exact-command validation and
structured proof documented in skills/tdd-execution/SKILL.md.

Subcommands:
  validate-red --test-cmd "cmd"       Verify exact target fails (missing target is invalid)
  validate-green --test-cmd "cmd"     Verify exact target passes
  validate-refactor --test-cmd "cmd"  Verify exact target still passes
  auto-test --test-cmd "cmd"          Run target, report proof payload
  detect-antipattern --phase <p> --files <files>
                                        Check for TDD contract drift`,
      "execute:test-run": `Usage: bgsd-tools execute:test-run

Run project tests and parse output.`,
      // verify namespace
      "verify:state": `Usage: bgsd-tools verify:state <subcommand> [options]

Manage project state in STATE.md.

Subcommands:
  load | get <field> | update <field> <value> | patch --key value ...
  advance-plan | update-progress | handoff <write|show|validate|clear>
  record-metric --phase P --plan N --duration D [--tasks T] [--files F]
  add-decision --phase P --summary S [--rationale R]
  add-blocker --text "..." | resolve-blocker --text "..."
  record-session --stopped-at "..." [--resume-file path]
  validate [--fix]`,
      "verify:verify": `Usage: bgsd-tools verify:verify <subcommand> [args]

Verification suite for planning documents.

Subcommands:
  plan-structure <file>        Check PLAN.md structure
  phase-completeness <phase>   Check all plans have summaries
  references <file>            Check @-refs and paths resolve
  commits <h1> [h2] ...       Batch verify commit hashes
  artifacts <plan-file>        Check must_haves.artifacts
  key-links <plan-file>        Check must_haves.key_links
  analyze-plan <plan-file>     Analyze plan complexity
  deliverables [--plan file]   Run tests + verify deliverables
  requirements                 Check REQUIREMENTS.md coverage
  regression [--before f] [--after f]  Detect regressions
  plan-wave <phase-dir>        Check file conflicts
  plan-deps <phase-dir>        Check dependency cycles
  quality [--plan f] [--phase N]  Composite quality score`,
      "verify:assertions": `Usage: bgsd-tools verify:assertions <subcommand> [options]

Manage structured acceptance criteria.

Subcommands:
  list [--req SREQ-01]    List assertions by requirement
  validate                Check assertion format and coverage`,
      "verify:search-decisions": `Usage: bgsd-tools verify:search-decisions <query>

Search decisions in STATE.md and archives.`,
      "verify:search-lessons": `Usage: bgsd-tools verify:search-lessons <query>

Search .planning/memory/lessons.json for relevant lessons.`,
      "verify:review": `Usage: bgsd-tools verify:review <phase> <plan>

Review context for reviewer agent.`,
      "review:scan": `Usage: bgsd-tools review:scan [--range A...B | --base A --head B] [--findings-file path]

Resolve a deterministic review target before any review rules run.

Default behavior:
  - Uses the staged diff when staged changes exist
  - Returns a promptable fallback when nothing is staged
  - Emits incomplete-scope warnings for nearby unstaged/untracked work
  - Applies exact rule_id + path exclusions from .planning/review-exclusions.json

Options:
  --range A...B          Review an explicit commit range
  --base A --head B      Equivalent explicit commit-range form
  --findings-file path   Seed findings JSON before exclusion filtering (useful for tests/workflows)

  Examples:
  bgsd-tools review:scan
  bgsd-tools review:scan --range HEAD~1...HEAD
  bgsd-tools review:scan --findings-file .planning/tmp/findings.json`,
      "review:readiness": `Usage: bgsd-tools review:readiness [--pretty]

Return an advisory readiness snapshot for the current repository state.

Checks:
  - tests passing
  - lint clean
  - review findings resolved
  - security findings resolved
  - TODO markers in current diff
  - changelog updated in current diff

Output:
  - JSON when piped
  - terse advisory board in TTY/--pretty mode

This command is advisory-only and never blocks release flow.`,
      "security:scan": `Usage: bgsd-tools security:scan [--target path] [--findings-file path]

Run the deterministic security scan pipeline.

Default behavior:
  - Scans the current repository root unless --target narrows scope
  - Normalizes all engine findings into one security contract
  - Applies confidence bands (high, medium, low) with a default 8/10 high gate
  - Loads finding-level exclusions from .planning/security-exclusions.json

Options:
  --target path          Explicit scan target (defaults to repo root)
  --findings-file path   Seed findings JSON before exclusion filtering (useful for tests/workflows)

  Examples:
  bgsd-tools security:scan
  bgsd-tools security:scan --target src
  bgsd-tools security:scan --findings-file .planning/tmp/security-findings.json`,
      "release:bump": `Usage: bgsd-tools release:bump [--override <major|minor|patch>] [--version <x.y.z>]

Preview the proposed release version from conventional commits since the last tag.

The command is advisory-only and never mutates git state. Manual overrides beat automatic inference.`,
      "release:changelog": `Usage: bgsd-tools release:changelog [--override <major|minor|patch>] [--version <x.y.z>]

Preview grouped release notes from plan summaries plus conventional commits since the last tag.

The command is advisory-only and never writes tags, branches, PRs, or changelog changes.`,
      "release:tag": `Usage: bgsd-tools release:tag

Scaffolded release command surface for Phase 148.

This command is routed and help-visible now; tag automation lands in later plans.`,
      "release:pr": `Usage: bgsd-tools release:pr

Scaffolded release command surface for Phase 148.

This command is routed and help-visible now; PR automation lands in later plans.`,
      "verify:context-budget": `Usage: bgsd-tools verify:context-budget <subcommand|path> [options]

Measure token consumption across workflows.

Subcommands:
  <path>                    Estimate tokens for a file
  baseline                  Measure all workflows, save baseline
  compare [baseline-path]   Compare current vs baseline`,
      "verify:token-budget": `Usage: bgsd-tools verify:token-budget

Show token counts for workflow files vs budgets.`,
      "verify:handoff": `Usage: bgsd-tools verify:handoff [options]

Validate agent handoff context transfer.

Options:
  --preview              Show what context would transfer between agents
  --from <agent>        Source agent name
  --to <agent>          Target agent name
  --validate <context>  Validate handoff completeness (state|plan|tasks|summary|all)

Examples:
  bgsd-tools verify:handoff --preview --from planner --to executor
  bgsd-tools verify:handoff --validate state`,
      "verify:agents": `Usage: bgsd-tools verify:agents [options]

Verify agent boundary contracts and capabilities.

Options:
  --verify              Verify specific agent contract
  --contracts           Show all handoff contracts
  --check-overlap       Check for capability overlap
  --from <agent>        Source agent name
  --to <agent>          Target agent name

Examples:
  bgsd-tools verify:agents --contracts
  bgsd-tools verify:agents --verify --from planner --to executor
  bgsd-tools verify:agents --check-overlap`,
      // util namespace
      "util:config-get": `Usage: bgsd-tools util:config-get <key.path>

Get configuration value from .planning/config.json.`,
      "util:config-set": `Usage: bgsd-tools util:config-set <key.path> <value>

Set configuration value in .planning/config.json.`,
      "util:config-migrate": `Usage: bgsd-tools util:config-migrate

Migrate .planning/config.json to match CONFIG_SCHEMA.
Adds missing keys with default values. Never overwrites existing values.
Creates backup before writing changes.`,
      "util:env": `Usage: bgsd-tools util:env <subcommand> [options]

Detect project languages, tools, and runtimes.

Subcommands:
  scan [--force] [--verbose]  Detect and write manifest
  status                      Check manifest freshness`,
      "util:current-timestamp": `Usage: bgsd-tools util:current-timestamp [format]

Return current UTC timestamp.`,
      "util:list-todos": `Usage: bgsd-tools util:list-todos [area]

Count and enumerate pending todos.`,
      "util:todo": `Usage: bgsd-tools util:todo complete <filename>

Mark todo as complete.`,
      "util:memory": `Usage: bgsd-tools util:memory <subcommand> [options]

Persistent memory store.

Subcommands:
  write --store <name> --entry '{json}'   Write entry
  read --store <name> [options]           Read entries
  list                                    List stores
  ensure-dir                              Create directory
  compact [--store <name>] [--threshold N]  Compact old entries`,
      "memory:list": `Usage: bgsd-tools memory:list

List canonical MEMORY.md entries grouped by section.

Outputs the same five sections users edit in .planning/MEMORY.md:
  Active / Recent
  Project Facts
  User Preferences
  Environment Patterns
  Correction History`,
      "memory:add": `Usage: bgsd-tools memory:add --section "Project Facts" --text "..." [options]

Add a structured entry to .planning/MEMORY.md.

Required:
  --section <name>   One of the canonical MEMORY.md sections
  --text <text>      Human-readable memory text

Optional:
  --type <type>      project-fact | user-preference | environment-pattern | correction
  --source <text>    Provenance note
  --keep <value>     Pin hint such as always
  --status <value>   Status marker such as active/inactive
  --expires <date>   Optional expiry date
  --replaces <id>    Stable memory ID this entry supersedes`,
      "memory:remove": `Usage: bgsd-tools memory:remove --id MEM-001

Remove a single MEMORY.md entry by stable ID.`,
      "memory:prune": `Usage: bgsd-tools memory:prune [--threshold 90] [--apply]

Preview stale structured-memory entries before deletion.

Default behavior is preview-only. Use --apply to actually delete candidates.
Candidates protect Active / Recent entries and Keep: always markers.`,
      "util:mcp": `Usage: bgsd-tools util:mcp <subcommand> [options]

MCP server management.

Subcommands:
  profile [--window N] [--apply] [--restore]  Manage profiles`,
      "util:classify": `Usage: bgsd-tools util:classify <plan|phase> <path-or-number>

Classify complexity and recommend execution strategy.`,
      "util:frontmatter": `Usage: bgsd-tools util:frontmatter <subcommand> <file> [options]

CRUD operations on YAML frontmatter.

Subcommands:
  get <file> [--field key]        Extract frontmatter as JSON
  set <file> --field k --value v  Update single field
  merge <file> --data '{json}'    Merge JSON into frontmatter
  validate <file> --schema type   Validate format`,
      "util:validate-commands": `Usage: bgsd-tools util:validate-commands

Validate command registry - checks help text alignment with routing.

Compares COMMAND_HELP keys against router implementations to detect:
- Commands in help that have no routing
- Missing help text for implemented commands
- Format inconsistencies (space vs colon)

Exit code 0 if all valid, non-zero if issues found.`,
      "util:validate-artifacts": `Usage: bgsd-tools util:validate-artifacts

Validate planning artifacts for structural issues.

Checks:
- MILESTONES.md: Balanced headers, valid date formats
- PROJECT.md: Balanced <details> tags, no strikethrough in out-of-scope
- Required files exist: STATE.md, ROADMAP.md

Exit code 0 if all valid, non-zero if errors found.`,
      "util:progress": `Usage: bgsd-tools util:progress [format]

Render progress in various formats.`,
      "util:websearch": `Usage: bgsd-tools util:websearch <query> [--limit N] [--freshness day|week|month]

Search web via Brave Search API.`,
      "util:history-digest": `Usage: bgsd-tools util:history-digest [--limit N] [--phases N1,N2] [--slim]

Aggregate all SUMMARY.md data into digest.`,
      "util:trace-requirement": `Usage: bgsd-tools util:trace-requirement <req-id>

Trace requirement from spec to files on disk.`,
      "util:codebase": `Usage: bgsd-tools util:codebase <subcommand> [options]

Codebase intelligence.

Subcommands:
  analyze                  Full codebase analysis
  status                   Current codebase status
  conventions              Extract code conventions
  rules                    Extract linting rules
  deps                     Dependency analysis
  impact                   Module blast radius
  context                  Architectural context
  lifecycle                Lifecycle analysis
  ast                      Function signatures
  exports                  Export surface
  complexity               Cyclomatic complexity
  repo-map                 Repository map`,
      "util:cache": `Usage: bgsd-tools util:cache <subcommand> [options]

Cache management.

Subcommands:
  status                   Show cache backend and entry count
  clear                    Clear cache
  warm [files...]          Pre-populate cache`,
      "util:agent": `Usage: bgsd-tools util:agent <subcommand> [options]

Agent management.

Subcommands:
  audit                                Audit agent lifecycle coverage against RACI matrix
  list                                 List all agents
  list-local                           List project-local overrides in .opencode/agents/
  override <name>                      Create a local override from the installed agent
  diff <name>                          Show diff between local and installed agent
  sync <name> [--accept|--reject]      Review or apply upstream agent updates
  validate-contracts [--phase N]       Check agent outputs match declared contracts`,
      // research namespace
      "research": `Usage: bgsd-tools research <subcommand> [options]

Research infrastructure commands.

Subcommands:
  capabilities    Report available research tools, tier, and recommendations
  yt-search       Search YouTube via yt-dlp with filtering and quality scoring
  yt-transcript   Extract clean plain-text transcript from YouTube video
  collect         Orchestrate multi-source collection pipeline with tier degradation
  nlm-create      Create a NotebookLM notebook
  nlm-add-source  Add a source (URL, file, YouTube) to a NotebookLM notebook`,
      "research capabilities": `Usage: bgsd-tools research capabilities

Report available research tools, current degradation tier, and recommendations.

Detects: yt-dlp (YouTube), notebooklm-py (RAG synthesis), Brave Search MCP, Context7 MCP, Exa MCP.
Shows: 4-tier degradation level, per-tool status, install hints for missing tools.

Output: { rag_enabled, current_tier, tiers, cli_tools, mcp_servers, recommendations }`,
      "research:capabilities": `Usage: bgsd-tools research:capabilities

Report available research tools, current degradation tier, and recommendations.

Detects: yt-dlp (YouTube), notebooklm-py (RAG synthesis), Brave Search MCP, Context7 MCP, Exa MCP.
Shows: 4-tier degradation level, per-tool status, install hints for missing tools.

Output: { rag_enabled, current_tier, tiers, cli_tools, mcp_servers, recommendations }`,
      "research yt-search": `Usage: bgsd-tools research yt-search "topic" [options]

Search YouTube via yt-dlp and return structured, filtered, quality-scored results.

Arguments:
  topic              Search query (required)

Options:
  --count N          Pre-filter result count (default: 10)
  --max-age DAYS     Maximum video age in days (default: 730 = ~2 years)
  --min-duration SEC Minimum duration in seconds (default: 300 = 5 min)
  --max-duration SEC Maximum duration in seconds (default: 3600 = 60 min)
  --min-views N      Minimum view count (default: 0)

Output: { query, pre_filter_count, post_filter_count, results: [{ id, title, channel, duration, view_count, upload_date, url, description, quality_score }] }

Quality score (0-100): Recency (40pts) + Views (30pts log-scale) + Duration (30pts bell curve at 15-20min).

Examples:
  bgsd-tools research yt-search "nodejs streams tutorial"
  bgsd-tools research:yt-search "react hooks" --count 5 --min-views 1000`,
      "research:yt-search": `Usage: bgsd-tools research:yt-search "topic" [options]

Search YouTube via yt-dlp and return structured, filtered, quality-scored results.

Arguments:
  topic              Search query (required)

Options:
  --count N          Pre-filter result count (default: 10)
  --max-age DAYS     Maximum video age in days (default: 730 = ~2 years)
  --min-duration SEC Minimum duration in seconds (default: 300 = 5 min)
  --max-duration SEC Maximum duration in seconds (default: 3600 = 60 min)
  --min-views N      Minimum view count (default: 0)

Output: { query, pre_filter_count, post_filter_count, results: [{ id, title, channel, duration, view_count, upload_date, url, description, quality_score }] }

Quality score (0-100): Recency (40pts) + Views (30pts log-scale) + Duration (30pts bell curve at 15-20min).

Examples:
  bgsd-tools research:yt-search "nodejs streams tutorial"
  bgsd-tools research:yt-search "react hooks" --count 5 --min-views 1000`,
      "research yt-transcript": `Usage: bgsd-tools research yt-transcript <video-id|url> [options]

Extract clean plain-text transcript from a YouTube video via yt-dlp subtitle download.

Arguments:
  video-id|url       YouTube video ID or full URL (required)

Options:
  --timestamps       Preserve [HH:MM:SS] timestamp markers (default: stripped)
  --lang LANG        Subtitle language code (default: en)

Output: { video_id, has_subtitles, language, auto_generated, transcript, word_count, char_count }

When no subtitles are available: { video_id, has_subtitles: false, message: "No subtitles available" }
When yt-dlp is missing: { error: "yt-dlp not installed", install_hint: "pip install yt-dlp" }

Full transcript is always returned \u2014 no truncation in JSON output.

Examples:
  bgsd-tools research yt-transcript dQw4w9WgXcQ
  bgsd-tools research:yt-transcript "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  bgsd-tools research yt-transcript dQw4w9WgXcQ --timestamps
  bgsd-tools research:yt-transcript dQw4w9WgXcQ --lang es`,
      "research:yt-transcript": `Usage: bgsd-tools research:yt-transcript <video-id|url> [options]

Extract clean plain-text transcript from a YouTube video via yt-dlp subtitle download.

Arguments:
  video-id|url       YouTube video ID or full URL (required)

Options:
  --timestamps       Preserve [HH:MM:SS] timestamp markers (default: stripped)
  --lang LANG        Subtitle language code (default: en)

Output: { video_id, has_subtitles, language, auto_generated, transcript, word_count, char_count }

When no subtitles are available: { video_id, has_subtitles: false, message: "No subtitles available" }
When yt-dlp is missing: { error: "yt-dlp not installed", install_hint: "pip install yt-dlp" }

Full transcript is always returned \u2014 no truncation in JSON output.

Examples:
  bgsd-tools research:yt-transcript dQw4w9WgXcQ
  bgsd-tools research:yt-transcript "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  bgsd-tools research:yt-transcript dQw4w9WgXcQ --timestamps
  bgsd-tools research:yt-transcript dQw4w9WgXcQ --lang es`,
      "research collect": `Usage: bgsd-tools research collect "topic" [options]

Orchestrate multi-source collection from Brave Search and YouTube with 4-tier degradation.

Arguments:
  topic              Search query (required)

Options:
  --quick            Bypass pipeline entirely, return tier 4 with empty sources

Output: { tier, tier_name, query, source_count, sources, timing, agent_context }

Tiers:
  1 \u2014 Full RAG (all tools + NotebookLM synthesis)
  2 \u2014 Sources without synthesis (YouTube + MCP, LLM synthesizes)
  3 \u2014 Brave/Context7 only (web search, no video)
  4 \u2014 Pure LLM (no external sources)

Pipeline stages:
  [1/3] Web sources via Brave Search API (util:websearch subprocess)
  [2/3] YouTube search + top-video transcript (research:yt-search/yt-transcript)
  [3/3] Context7 availability note (MCP \u2014 agent accesses directly)

agent_context contains XML-tagged source data for LLM consumption at Tier 2/3.
At Tier 4 (--quick or no tools), agent_context is empty string.

Examples:
  bgsd-tools research collect "nodejs subprocess patterns"
  bgsd-tools research:collect --quick "test query"
  bgsd-tools research:collect "react hooks" --pretty`,
      "research:collect": `Usage: bgsd-tools research:collect "topic" [options]

Orchestrate multi-source collection from Brave Search and YouTube with 4-tier degradation.

Arguments:
  topic              Search query (required)

Options:
  --quick            Bypass pipeline entirely, return tier 4 with empty sources

Output: { tier, tier_name, query, source_count, sources, timing, agent_context }

Tiers:
  1 \u2014 Full RAG (all tools + NotebookLM synthesis)
  2 \u2014 Sources without synthesis (YouTube + MCP, LLM synthesizes)
  3 \u2014 Brave/Context7 only (web search, no video)
  4 \u2014 Pure LLM (no external sources)

Pipeline stages:
  [1/3] Web sources via Brave Search API (util:websearch subprocess)
  [2/3] YouTube search + top-video transcript (research:yt-search/yt-transcript)
  [3/3] Context7 availability note (MCP \u2014 agent accesses directly)

agent_context contains XML-tagged source data for LLM consumption at Tier 2/3.
At Tier 4 (--quick or no tools), agent_context is empty string.

Examples:
  bgsd-tools research:collect "nodejs subprocess patterns"
  bgsd-tools research:collect --quick "test query"
  bgsd-tools research:collect "react hooks" --pretty`,
      "research nlm-create": `Usage: bgsd-tools research nlm-create "title"

Create a NotebookLM notebook and return its ID.

Arguments:
  title              Notebook title (required)

Checks binary availability and auth health before execution.
Missing binary returns install hint. Expired auth returns re-auth instructions.

Output: { notebook_id, title, raw_output }
Error: { error, install_hint | reauth_command }

Examples:
  bgsd-tools research nlm-create "GSD Research Notes"
  bgsd-tools research:nlm-create "Phase 59 Sources"`,
      "research:nlm-create": `Usage: bgsd-tools research:nlm-create "title"

Create a NotebookLM notebook and return its ID.

Arguments:
  title              Notebook title (required)

Checks binary availability and auth health before execution.
Missing binary returns install hint. Expired auth returns re-auth instructions.

Output: { notebook_id, title, raw_output }
Error: { error, install_hint | reauth_command }

Examples:
  bgsd-tools research:nlm-create "GSD Research Notes"
  bgsd-tools research:nlm-create "Phase 59 Sources"`,
      "research nlm-add-source": `Usage: bgsd-tools research nlm-add-source <notebook-id> "source-url-or-path"

Add a source (URL, YouTube URL, local file) to a NotebookLM notebook.

Arguments:
  notebook-id        Notebook ID from nlm-create (required)
  source-url-or-path Source URL or local file path (required)

Sets the active notebook first, then adds the source. Uses 60s timeout for source processing.
Checks binary availability and auth health before execution.

Output: { notebook_id, source_url, raw_output }
Error: { error, install_hint | reauth_command | details }

Examples:
  bgsd-tools research nlm-add-source abc123 "https://example.com/docs"
  bgsd-tools research:nlm-add-source abc123 "https://youtube.com/watch?v=xxx"
  bgsd-tools research:nlm-add-source abc123 "./docs/research.pdf"`,
      "research:nlm-add-source": `Usage: bgsd-tools research:nlm-add-source <notebook-id> "source-url-or-path"

Add a source (URL, YouTube URL, local file) to a NotebookLM notebook.

Arguments:
  notebook-id        Notebook ID from nlm-create (required)
  source-url-or-path Source URL or local file path (required)

Sets the active notebook first, then adds the source. Uses 60s timeout for source processing.
Checks binary availability and auth health before execution.

Output: { notebook_id, source_url, raw_output }
Error: { error, install_hint | reauth_command | details }

Examples:
  bgsd-tools research:nlm-add-source abc123 "https://example.com/docs"
  bgsd-tools research:nlm-add-source abc123 "https://youtube.com/watch?v=xxx"
  bgsd-tools research:nlm-add-source abc123 "./docs/research.pdf"`,
      "research nlm-ask": `Usage: bgsd-tools research nlm-ask <notebook-id> "question" [--new]

Ask a question against a NotebookLM notebook and receive a grounded answer with citations.

Arguments:
  notebook-id  Notebook ID to ask against (required)
  question     Question text (required, remaining positional args joined)

Options:
  --new        Start a fresh conversation (clears conversation history)

Sets the active notebook first, then sends the question. Uses 30s timeout.
Checks binary availability and auth health before execution.

Output: { notebook_id, question, answer, references, raw_output }
Error: { error, install_hint | reauth_command | details }

Examples:
  bgsd-tools research nlm-ask abc123 "What are the key themes?"
  bgsd-tools research:nlm-ask abc123 "Summarize implementation approach" --new`,
      "research:nlm-ask": `Usage: bgsd-tools research:nlm-ask <notebook-id> "question" [--new]

Ask a question against a NotebookLM notebook and receive a grounded answer with citations.

Arguments:
  notebook-id  Notebook ID to ask against (required)
  question     Question text (required, remaining positional args joined)

Options:
  --new        Start a fresh conversation (clears conversation history)

Sets the active notebook first, then sends the question. Uses 30s timeout.
Checks binary availability and auth health before execution.

Output: { notebook_id, question, answer, references, raw_output }
Error: { error, install_hint | reauth_command | details }

Examples:
  bgsd-tools research:nlm-ask abc123 "What are the key themes?"
  bgsd-tools research:nlm-ask abc123 "Summarize implementation approach" --new`,
      "research nlm-report": `Usage: bgsd-tools research nlm-report <notebook-id> [--type TYPE] [--prompt "text"]

Generate a structured report from a NotebookLM notebook.

Arguments:
  notebook-id  Notebook ID to generate report from (required)

Options:
  --type TYPE   Report type: briefing-doc (default), study-guide, blog-post
  --prompt "text"  Custom report prompt (optional)

Uses 60s timeout \u2014 report generation is slow. Sets active notebook first.
Checks binary availability and auth health before execution.

Output: { notebook_id, report_type, content, raw_output }
Error: { error, install_hint | reauth_command | details }

Examples:
  bgsd-tools research nlm-report abc123 --type briefing-doc
  bgsd-tools research:nlm-report abc123 --type study-guide
  bgsd-tools research:nlm-report abc123 --prompt "Focus on security implications"`,
      "research:nlm-report": `Usage: bgsd-tools research:nlm-report <notebook-id> [--type TYPE] [--prompt "text"]

Generate a structured report from a NotebookLM notebook.

Arguments:
  notebook-id  Notebook ID to generate report from (required)

Options:
  --type TYPE   Report type: briefing-doc (default), study-guide, blog-post
  --prompt "text"  Custom report prompt (optional)

Uses 60s timeout \u2014 report generation is slow. Sets active notebook first.
Checks binary availability and auth health before execution.

Output: { notebook_id, report_type, content, raw_output }
Error: { error, install_hint | reauth_command | details }

Examples:
  bgsd-tools research:nlm-report abc123 --type briefing-doc
  bgsd-tools research:nlm-report abc123 --type study-guide
  bgsd-tools research:nlm-report abc123 --prompt "Focus on security implications"`,
      "research:collect --resume": "Resume interrupted research session from last completed stage",
      "research collect --resume": "Resume interrupted research session from last completed stage",
      "research:score": `Usage: bgsd-tools research:score <path>

Score a RESEARCH.md file and return a structured quality profile.

Arguments:
  path    Path to a RESEARCH.md file (required)

Analyzes source count, confidence breakdown, official docs presence, source age,
flagged gaps, and multi-source conflicts. Writes cache to research-score.json
in the same directory.

Output: {
  source_count: number,
  high_confidence_pct: number,
  oldest_source_days: number,
  has_official_docs: boolean,
  confidence_level: "HIGH" | "MEDIUM" | "LOW",
  flagged_gaps: [{ gap, severity, suggestion }],
  conflicts: [{ claim, source_a, source_b }]
}

Examples:
  bgsd-tools research:score .planning/phases/0133-enhanced-research-workflow/0133-RESEARCH.md
  bgsd-tools research:score .planning/research/STACK.md --raw`,
      "research:gaps": `Usage: bgsd-tools research:gaps <path>

Extract flagged gaps from a cached research quality profile.

Arguments:
  path    Path to a RESEARCH.md file (required \u2014 used to locate research-score.json cache)

Note: Reads from research-score.json cache in the same directory as <path>.
Run research:score first to generate the cache.

Output: { flagged_gaps: [{ gap, severity, suggestion }] }
Error: { error: "No cached score found. Run research:score first." }

Examples:
  bgsd-tools research:gaps .planning/phases/0133-enhanced-research-workflow/0133-RESEARCH.md
  bgsd-tools research:gaps .planning/research/STACK.md --raw`,
      // audit namespace
      // decisions namespace
      "decisions:list": `Usage: bgsd-tools decisions:list

List all registered decision rules with category, confidence range, and description.

Groups rules by category with section headers. Shows total rules and categories.

Output: { rules, summary: { total_rules, categories, category_list } }

Examples:
  bgsd-tools decisions:list
  bgsd-tools decisions:list --raw`,
      "decisions:inspect": `Usage: bgsd-tools decisions:inspect <rule_id>

Show full details of a specific decision rule.

Arguments:
  rule_id    The rule identifier (e.g., progress-route, context-gate)

Output: { id, name, category, description, inputs, outputs, confidence_range }

If rule not found, shows available rule IDs.

Examples:
  bgsd-tools decisions:inspect progress-route
  bgsd-tools decisions:inspect context-gate --raw`,
      "decisions:evaluate": `Usage: bgsd-tools decisions:evaluate <rule_id> [--state '{json}']

Evaluate a decision rule against a given state object.

Arguments:
  rule_id          The rule identifier to evaluate

Options:
  --state '{json}' JSON state object with input values for the rule

Output: { value, confidence, rule_id, metadata? }

If --state is omitted, evaluates with empty state (default values).

Examples:
  bgsd-tools decisions:evaluate context-gate --state '{"context_present":true}'
  bgsd-tools decisions:evaluate progress-route --state '{"plan_count":3,"summary_count":1,"roadmap_exists":true,"project_exists":true,"state_exists":true}'
  bgsd-tools decisions:evaluate auto-advance --state '{"auto_advance_config":true}' --raw`,
      "decisions:savings": `Usage: bgsd-tools decisions:savings

Show before/after LLM reasoning step counts per workflow.

Reports savings from decision offloading \u2014 how many LLM reasoning steps
each workflow used to perform vs how many remain after pre-computed decisions.

Output: { workflows: [{workflow, before, after, saved, decisions}], totals: {before, after, saved, percent_reduction}, note }

Examples:
  bgsd-tools decisions:savings
  bgsd-tools decisions:savings --raw`,
      "audit:scan": `Usage: bgsd-tools audit:scan

Scan workflows and agents for LLM-offloadable decisions with rubric scoring and token estimates.

Scans all workflow .md files and agent definitions for decision points where
the LLM currently reasons about things that deterministic code could handle.
Each candidate is scored against a 7-criteria rubric (3 critical + 4 preferred)
and assigned a token savings estimate.

Output: { candidates, offloadable, keep_in_llm, summary }

Summary includes: total_candidates, offloadable_count, keep_count,
estimated_total_savings, savings_by_category

Examples:
  bgsd-tools audit:scan
  bgsd-tools audit:scan --raw`,
      // Missing COMMAND_HELP entries - adding per plan 115-04
      // util namespace (20 commands)
      "util:settings": `Usage: bgsd-tools util:settings [key]

List all bGSD settings or get a specific value.

Arguments:
  key          Optional key path (e.g., "model_profile", "workflow.auto_advance")

Output: All settings with current values, types, and defaults, or single value.

Examples:
  bgsd-tools util:settings
  bgsd-tools util:settings model_profile`,
      "util:parity-check": `Usage: bgsd-tools util:parity-check

Check feature parity between production config and development config.

Compares settings in .planning/config.json against expected production defaults
and reports any gaps or mismatches.

Output: { parity_ok, differences: [...] }

Examples:
  bgsd-tools util:parity-check`,
      "util:resolve-model": `Usage: bgsd-tools util:resolve-model <agent-type>

Resolve which model to use for a given agent type based on profile settings.

Arguments:
  agent-type    Agent type (e.g., "bgsd-planner", "bgsd-executor")

Uses model_profile config (quality/balanced/budget) to select appropriate model.

Output: { agent_type, profile, resolved_model, quality_model, balanced_model, budget_model }

Examples:
  bgsd-tools util:resolve-model bgsd-planner
  bgsd-tools util:resolve-model bgsd-executor`,
      "util:verify-path-exists": `Usage: bgsd-tools util:verify-path-exists <path>

Verify that a path exists in the project.

Arguments:
  path         Path to verify (file or directory)

Returns whether the path exists and its type (file/directory).

Output: { path, exists: true|false, type: "file"|"directory"|"none" }

Examples:
  bgsd-tools util:verify-path-exists .planning/STATE.md
  bgsd-tools util:verify-path-exists src/lib`,
      "util:config-ensure-section": `Usage: bgsd-tools util:config-ensure-section

Ensure all required sections exist in .planning/config.json.

Creates missing sections with empty defaults. Does not overwrite existing values.

Output: { added: [...], existing: [...], config_ensured: true }

Examples:
  bgsd-tools util:config-ensure-section`,
      "util:scaffold": `Usage: bgsd-tools util:scaffold <type> [--path path]

Scaffold common planning files and structures.

Arguments:
  type         Type to scaffold (plan|phase|milestone|summary)

Options:
  --path       Target path for scaffold operation

Output: { scaffolded: [...], errors: [...] }

Examples:
  bgsd-tools util:scaffold plan --path .planning/phases/99-test
  bgsd-tools util:scaffold phase`,
      "util:phase-plan-index": `Usage: bgsd-tools util:phase-plan-index <phase>

Build or update phase plan index file.

Arguments:
  phase        Phase number or directory

Creates/updates .planning/phases/{phase}/INDEX.json with plan metadata.

Output: { phase, plans_indexed, index_path }

Examples:
  bgsd-tools util:phase-plan-index 99
  bgsd-tools util:phase-plan-index .planning/phases/99-test`,
      "util:state-snapshot": `Usage: bgsd-tools util:state-snapshot

Create a point-in-time snapshot of STATE.md.

Captures current phase, plan position, blockers, decisions, and metrics.

Output: { timestamp, phase, plan, position, blockers: [...], decisions: [...] }

Examples:
  bgsd-tools util:state-snapshot`,
      "util:summary-extract": `Usage: bgsd-tools util:summary-extract <summary-path> [fields...]

Extract specific fields from a SUMMARY.md file.

Arguments:
  summary-path  Path to SUMMARY.md file
  fields       Field names to extract (default: all)

Output: JSON with extracted field values.

Examples:
  bgsd-tools util:summary-extract .planning/phases/01-foundation/01-01-SUMMARY.md one-liner
  bgsd-tools util:summary-extract .planning/phases/01-foundation/01-01-SUMMARY.md`,
      "util:summary-generate": `Usage: bgsd-tools util:summary-generate <phase> <plan>

Generate SUMMARY.md scaffold from PLAN.md.

Arguments:
  phase        Phase number (e.g., "01", "99")
  plan         Plan number (e.g., "01", "04")

Creates a structured SUMMARY.md template based on PLAN.md frontmatter and tasks.

Output: JSON with generated sections and todo_remaining count.

Examples:
  bgsd-tools util:summary-generate 01 01
  bgsd-tools util:summary-generate 99 04`,
      "util:quick-summary": `Usage: bgsd-tools util:quick-summary [options]

Generate a quick task summary from current state.

Options:
  --plan <path>    Plan file to summarize
  --format         Output format (text|json)

Output: Summary of tasks, completion status, and time estimates.

Examples:
  bgsd-tools util:quick-summary
  bgsd-tools util:quick-summary --plan .planning/phases/01-foundation/01-01-PLAN.md`,
      "util:extract-sections": `Usage: bgsd-tools util:extract-sections <file> <section>...

Extract specific sections from a markdown file.

Arguments:
  file         Source markdown file
  sections     Section names to extract (e.g., "context", "tasks")

Output: JSON with section content.

Examples:
  bgsd-tools util:extract-sections .planning/PROJECT.md description goals`,
      "util:tools": `Usage: bgsd-tools util:tools [options]

Check status of external tools and dependencies.

Options:
  --detailed    Show detailed version info
  --json        Output as JSON

Detects: Node.js, Bun, git, yt-dlp, notebooklm-py, MCP servers.

Output: { tools: [...], all_available: true|false }

Examples:
  bgsd-tools util:tools
  bgsd-tools util:tools --detailed`,
      "util:runtime": `Usage: bgsd-tools util:runtime [options]

Show runtime information and benchmarks.

Options:
  --benchmark   Run quick benchmark
  --details     Show detailed timing

Reports runtime version, memory usage, and command execution times.

Output: { runtime, version, memory, benchmark_results: {...} }

Examples:
  bgsd-tools util:runtime
  bgsd-tools util:runtime --benchmark`,
      "util:recovery": `Usage: bgsd-tools util:recovery <subcommand> [options]

Auto-recovery and stuck task resolution.

Subcommands:
  analyze <error>     Analyze error and suggest fix
  checkpoint <json>  Restore from checkpoint
  stuck <task-id>     Diagnose why task is stuck

Examples:
  bgsd-tools util:recovery analyze "Cannot read property 'foo' of undefined"
  bgsd-tools util:recovery checkpoint '{"files":["a.js"],"type":"auto"}'
  bgsd-tools util:recovery stuck task-123`,
      "util:history": `Usage: bgsd-tools util:history [options]

Lookup command history and recent activity.

Options:
  --limit N         Number of entries (default: 10)
  --command <cmd>   Filter by command
  --since <date>    Filter since date

Output: { entries: [...], count }

Examples:
  bgsd-tools util:history
  bgsd-tools util:history --limit 20
  bgsd-tools util:history --command util:settings`,
      "util:examples": `Usage: bgsd-tools util:examples [command]

Show usage examples for a command or list all examples.

Arguments:
  command      Optional command to get examples for

Output: { examples: [...] }

Examples:
  bgsd-tools util:examples
  bgsd-tools util:examples util:codebase`,
      "util:analyze-deps": `Usage: bgsd-tools util:analyze-deps [path]

Analyze dependencies for a file or entire project.

Arguments:
  path         Optional file or directory path

Output: { dependencies: [...], dev_dependencies: [...], circular: [...] }

Examples:
  bgsd-tools util:analyze-deps
  bgsd-tools util:analyze-deps src/lib/utils.js`,
      "util:estimate-scope": `Usage: bgsd-tools util:estimate-scope <plan-path>

Estimate token scope for executing a plan.

Arguments:
  plan-path    Path to PLAN.md file

Analyzes task count, file modifications, and complexity to estimate context budget.

Output: { estimated_tokens, tasks, files, complexity, recommendation }

Examples:
  bgsd-tools util:estimate-scope .planning/phases/01-foundation/01-01-PLAN.md`,
      "util:test-coverage": `Usage: bgsd-tools util:test-coverage [options]

Show test coverage information.

Options:
  --summary     Show summary only
  --file <path> Coverage for specific file

Output: { lines_covered, lines_total, percentage, uncovered_lines: [...] }

Examples:
  bgsd-tools util:test-coverage
  bgsd-tools util:test-coverage --summary`,
      // verify namespace (7 commands)
      "verify:regression": `Usage: bgsd-tools verify:regression [options]

Detect regressions by comparing before/after states.

Options:
  --before <ref>    Before commit/tag (default: HEAD~1)
  --after <ref>     After commit/tag (default: HEAD)
  --plan <path>    Check plan-specific regressions

Runs test suite and compares outputs to detect behavioral changes.

Output: { regressions_found: N, details: [...] }

Examples:
  bgsd-tools verify:regression
  bgsd-tools verify:regression --before main --after HEAD
  bgsd-tools verify:regression --plan .planning/phases/01-foundation/01-01-PLAN.md`,
      "verify:quality": `Usage: bgsd-tools verify:quality [options]

Run composite quality checks on planning documents.

Options:
  --plan <path>    Check specific plan
  --phase <N>      Check entire phase
  --score          Show numeric score

Checks: structure, references, must_haves, key_links, dependencies.

Output: { quality_score, issues: [...], warnings: [...] }

Examples:
  bgsd-tools verify:quality
  bgsd-tools verify:quality --phase 01
  bgsd-tools verify:quality --plan .planning/phases/01-foundation/01-01-PLAN.md --score`,
      "verify:summary": `Usage: bgsd-tools verify:summary <summary-path>

Verify SUMMARY.md completeness and correctness.

Arguments:
  summary-path  Path to SUMMARY.md file

Checks: required sections, frontmatter completeness, task commit references.

Output: { valid: true|false, issues: [...], completeness_score }

Examples:
  bgsd-tools verify:summary .planning/phases/01-foundation/01-01-SUMMARY.md`,
      "verify:validate consistency": `Usage: bgsd-tools verify:validate consistency

Validate consistency across planning documents.

Checks: phase numbers match directories, plan numbers are sequential,
references resolve correctly, no orphaned files.

Output: { consistent: true|false, issues: [...] }

Examples:
  bgsd-tools verify:validate consistency`,
      "verify:validate health": `Usage: bgsd-tools verify:validate health [options]

Validate project health indicators.

Options:
  --detailed     Show detailed health metrics

Checks: test pass rate, recent commit activity, blocker count, phase progress.

Output: { healthy: true|false, metrics: {...}, recommendations: [...] }

Examples:
  bgsd-tools verify:validate health
  bgsd-tools verify:validate health --detailed`,
      "verify:validate-dependencies": `Usage: bgsd-tools verify:validate-dependencies

Validate phase and plan dependencies.

Checks: no circular dependencies, all required phases exist,
plan depends_on references valid.

Output: { valid: true|false, cycles: [...], missing: [...], warnings: [...] }

Examples:
  bgsd-tools verify:validate-dependencies`,
      "verify:validate-config": `Usage: bgsd-tools verify:validate-config [options]

Validate .planning/config.json against schema.

Options:
  --fix          Auto-fix trivial issues
  --detailed     Show detailed validation results

Checks: required keys present, types correct, defaults applied.

Output: { valid: true|false, issues: [...], fixed: [...] }

Examples:
  bgsd-tools verify:validate-config
  bgsd-tools verify:validate-config --fix`,
      // cache namespace (5 commands)
      "cache:research-stats": `Usage: bgsd-tools cache:research-stats

Show research cache statistics.

Reports entry count, hits, and misses for research results cached via
the research:collect command.

Output: { count, hits, misses, hit_rate_percent }

Examples:
  bgsd-tools cache:research-stats`,
      "cache:research-clear": `Usage: bgsd-tools cache:research-clear

Clear all research cache entries.

Removes cached research results from the research_cache table.
Does not affect general file cache.

Output: { cleared: true, entries_removed: N }

Examples:
  bgsd-tools cache:research-clear`,
      "cache:status": `Usage: bgsd-tools cache:status

Show cache backend type and entry count.

Reports which cache backend is active (memory/SQLite) and total entries.

Output: { backend, count, hits, misses }

Examples:
  bgsd-tools cache:status`,
      "cache:clear": `Usage: bgsd-tools cache:clear

Clear all cache entries.

Removes all entries from the active cache backend.
Does not affect research cache.

Output: { cleared: true, entries_removed: N }

Examples:
  bgsd-tools cache:clear`,
      "cache:warm": `Usage: bgsd-tools cache:warm [files...]

Pre-populate cache with file contents.

Arguments:
  files        Optional file paths to cache (default: all .planning/ files)

Discovers and caches planning documents for faster subsequent access.

Output: { warmed: N, elapsed_ms: M }

Examples:
  bgsd-tools cache:warm
  bgsd-tools cache:warm .planning/STATE.md .planning/ROADMAP.md`,
      // lessons namespace (Phase 130)
      "lessons:capture": `Usage: bgsd-tools lessons:capture --title <text> --severity <level> --type <type> --root-cause <text> --prevention <text> --agents <list>

Capture a structured lesson entry to .planning/memory/lessons.json.

Required options:
  --title <text>        Short description of the lesson
  --severity <level>    LOW | MEDIUM | HIGH | CRITICAL
  --type <type>         workflow | agent-behavior | tooling | environment
  --root-cause <text>   What caused the issue
  --prevention <text>   Rule to prevent recurrence
  --agents <list>       Comma-separated affected agent types

Output: { captured, id, title, severity, type, entry_count }

Examples:
  bgsd-tools lessons:capture --title "Missing validation" --severity HIGH --type tooling --root-cause "No input checks" --prevention "Add input validation" --agents bgsd-executor
  bgsd-tools lessons:capture --title "Auth failure" --severity CRITICAL --type agent-behavior --root-cause "Token expired" --prevention "Check expiry before use" --agents "bgsd-executor,bgsd-planner"`,
      "lessons:list": `Usage: bgsd-tools lessons:list [options]

List structured lesson entries with optional filters.

Options:
  --type <type>         Filter by type (workflow | agent-behavior | tooling | environment)
  --severity <level>    Filter by severity (LOW | MEDIUM | HIGH | CRITICAL)
  --since <date>        Filter by date >= ISO date (e.g. 2026-03-01)
  --limit <N>           Maximum results (default: 20)
  --query <text>        Substring search on title, root_cause, prevention_rule

Output: { entries, count, filtered_total, total, filters }

Examples:
  bgsd-tools lessons:list
  bgsd-tools lessons:list --type agent-behavior --severity HIGH
  bgsd-tools lessons:list --since 2026-03-01 --limit 5
  bgsd-tools lessons:list --query "auth"`,
      "lessons:analyze": `Usage: bgsd-tools lessons:analyze [--agent <name>]

Analyze recurrent patterns in the lesson store, grouped by affected agent and type.
Only shows groups with \u22652 supporting lessons (noise filter).

Options:
  --agent <name>    Filter results to a specific agent (e.g., bgsd-executor)

Output: { groups, group_count, total_lessons_analyzed, filter }

Each group contains:
  - agent, pattern_type, count, severity_distribution
  - common_root_causes, lessons (id, title, date, severity)

Examples:
  bgsd-tools lessons:analyze
  bgsd-tools lessons:analyze --agent bgsd-executor`,
      "lessons:suggest": `Usage: bgsd-tools lessons:suggest [--agent <name>]

Generate structured improvement suggestions from lesson patterns.
Excludes type:environment entries (migrated free-form lessons).
Only generates suggestions for groups with \u22652 supporting lessons.
Advisory only \u2014 never auto-applied.

Options:
  --agent <name>    Filter suggestions to a specific agent

Output: { suggestions, suggestion_count, advisory_note, filter }

Each suggestion contains:
  - agent, suggestion_type (behavioral|workflow|tooling|general)
  - summary, supporting_lessons (count + ids), severity, prevention_rules

Examples:
  bgsd-tools lessons:suggest
  bgsd-tools lessons:suggest --agent bgsd-executor`,
      "lessons:deviation-capture": `Usage: bgsd-tools lessons:deviation-capture --rule <number> --failure-count <number> --behavioral-change <text> --agent <name>

Captures a deviation recovery pattern as a structured lesson entry.
Only Rule 1 (code bug) recoveries are captured \u2014 all other rules are silently filtered.
Capped at 3 entries per milestone to prevent noise.

Options:
  --rule               Deviation rule number (1=bug, 2=missing, 3=blocking, 4=architectural)
  --failure-count      Number of failed attempts before successful recovery
  --behavioral-change  Description of what behavioral change fixed the issue
  --agent              Name of the agent that performed the recovery

Examples:
  bgsd-tools lessons:deviation-capture --rule 1 --failure-count 2 --behavioral-change "Added null check before property access" --agent bgsd-executor
  bgsd-tools lessons:deviation-capture --rule 3 --failure-count 1 --behavioral-change "Reinstalled deps" --agent bgsd-executor  # \u2192 silently filtered (Rule 3)`,
      "lessons:compact": `Usage: bgsd-tools lessons:compact [--threshold <N>]

Deduplicate the lesson store by normalized root_cause when entry count exceeds threshold.
Groups entries with identical root causes, keeps the latest entry per group.
Merges unique prevention rules and preserves highest severity across the group.

Options:
  --threshold <N>   Compaction threshold (default: 100). If count < threshold, no-op.

Output when below threshold: { compacted: false, reason, count, threshold }
Output when compacted:       { compacted: true, before, after, removed, groups_merged }

Examples:
  bgsd-tools lessons:compact
  bgsd-tools lessons:compact --threshold 50`,
      "skills:list": `Usage: bgsd-tools skills:list

List all installed project-local skills with their descriptions and scan status.

Skills are stored in .agents/skills/<name>/SKILL.md within the project.

Output: Array of { name, description, scan_status } or "No skills installed."

Examples:
  bgsd-tools skills:list`,
      "skills:install": `Usage: bgsd-tools skills:install --source <github-url> [--confirm]
         bgsd-tools skills:install <owner/repo> [--confirm]

Install a skill from a GitHub repository with mandatory 41-pattern security scan.

The install pipeline:
  1. Fetch repository contents via GitHub API (no git clone required)
  2. Verify SKILL.md exists in repo root (required)
  3. Run 41-pattern security scan across all files
  4. DANGEROUS findings: hard block \u2014 install is refused, no override
  5. WARN findings: show count, prompt confirmation (or use --confirm to auto-accept)
  6. Write skill to .agents/skills/<name>/ on confirmation
  7. Log to .agents/skill-audit.json

Options:
  --source <url>   GitHub URL (https://github.com/owner/repo or owner/repo)
  --confirm        Auto-accept warn-level findings without interactive prompt

Examples:
  bgsd-tools skills:install --source owner/my-skill
  bgsd-tools skills:install https://github.com/owner/my-skill --confirm`,
      "skills:validate": `Usage: bgsd-tools skills:validate --name <skill-name> [--verbose]

Re-scan an installed skill against the 41-pattern security scanner.
Useful after manual edits or to verify an existing skill's safety.

Options:
  --name <name>   Name of the installed skill to validate
  --verbose       Show full matched code snippets for each finding

Output: Scan report with severity-first grouping (dangerous > warn > info), category
checklist (\u2713/\u2717 per category), count summary, and overall verdict.

Examples:
  bgsd-tools skills:validate --name my-skill
  bgsd-tools skills:validate --name my-skill --verbose`,
      "skills:remove": `Usage: bgsd-tools skills:remove --name <skill-name>

Remove an installed project-local skill. Deletes the skill directory from
.agents/skills/<name>/ and logs the removal to .agents/skill-audit.json.

Options:
  --name <name>   Name of the installed skill to remove

Examples:
  bgsd-tools skills:remove --name my-skill`,
      "workflow:baseline": `Usage: bgsd-tools workflow:baseline

Measure token counts and structural fingerprints for all workflow files.
Saves a versioned snapshot to .planning/baselines/workflow-baseline-{timestamp}.json.

The structural fingerprint per workflow includes:
  - task_calls:       Task() function call counts
  - cli_commands:     bgsd-tools invocations in code blocks
  - section_markers:  <!-- section: ... --> markers
  - question_blocks:  <question> blocks
  - xml_tags:         <step>, <process>, <purpose> tags

Output (stderr): Human-readable table with token counts and structural element counts.
Output (stdout): JSON snapshot with { version, timestamp, workflow_count, total_tokens, workflows: [...] }

Examples:
  bgsd-tools workflow:baseline
  bgsd-tools workflow:baseline --raw`,
      "workflow:compare": `Usage: bgsd-tools workflow:compare [<snapshot-a>] [<snapshot-b>]

Compare two workflow baseline snapshots to see per-workflow token deltas.

Modes:
  Two args:   Compare snapshot-a to snapshot-b
  One arg:    Compare snapshot-a to current workflow state
  No args:    Compare the two most recent baselines in .planning/baselines/

Output (stderr): Comparison table with per-workflow before/after/delta/% columns.
Output (stdout): JSON with { snapshot_a, snapshot_b, summary: { before_total, after_total, delta, percent_change, workflows_improved, workflows_unchanged, workflows_worsened }, workflows: [...] }

Examples:
  bgsd-tools workflow:compare
  bgsd-tools workflow:compare .planning/baselines/workflow-baseline-2026-01-01T00-00-00-000Z.json
  bgsd-tools workflow:compare baseline-a.json baseline-b.json`,
      "workflow:savings": `Usage: bgsd-tools workflow:savings

Generate a cumulative token savings table showing the reduction journey across milestones:
  Original (pre-Phase 135) \u2192 Post-Compression (Phase 135) \u2192 Post-Elision (Phase 137)

Loads Phase 134 and Phase 135 baselines from .planning/baselines/ if available.
Falls back to hardcoded Phase 135 SUMMARY values if disk baselines unavailable.
The post-elision column shows current workflow token counts (all conditional sections removed).

Output:
  | Workflow | Original | Compressed | Post-Elision | Total % |

Options:
  --raw   JSON output

Examples:
  bgsd-tools workflow:savings
  bgsd-tools workflow:savings --raw`,
      // questions namespace
      "questions:audit": `Usage: bgsd-tools questions:audit [--json]

Scan all workflows, identify inline question text vs template references.
Reports taxonomy compliance percentage.

Options:
  --json    Machine-readable JSON output (default: human-readable Markdown)

Examples:
  bgsd-tools questions:audit
  bgsd-tools questions:audit --json`,
      "questions:list": `Usage: bgsd-tools questions:list [--json]

List all question templates in src/lib/questions.js with taxonomy type and usage count per workflow.

Options:
  --json    Machine-readable JSON output (default: human-readable Markdown)

Examples:
  bgsd-tools questions:list
  bgsd-tools questions:list --json`,
      "questions:validate": `Usage: bgsd-tools questions:validate [--json]

Validate all question templates have 3-5 options, formatting parity, and escape hatches.
Phase 143: warn-only mode (reports issues, does not block).

Options:
  --json    Machine-readable JSON output (default: human-readable Markdown)

Examples:
  bgsd-tools questions:validate
  bgsd-tools questions:validate --json`
    };
    module.exports = { MODEL_PROFILES, CONFIG_SCHEMA, COMMAND_HELP, VALID_TRAJECTORY_SCOPES };
  }
});

// src/lib/config-contract.js
var require_config_contract = __commonJS({
  "src/lib/config-contract.js"(exports, module) {
    var { CONFIG_SCHEMA } = require_constants();
    function isPlainObject(value) {
      return !!value && typeof value === "object" && !Array.isArray(value);
    }
    function cloneValue(value) {
      if (Array.isArray(value)) return value.map(cloneValue);
      if (isPlainObject(value)) {
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]));
      }
      return value;
    }
    function deepMerge(base, override) {
      if (override === void 0) return cloneValue(base);
      if (Array.isArray(override)) return cloneValue(override);
      if (!isPlainObject(base) || !isPlainObject(override)) return cloneValue(override);
      const result = cloneValue(base);
      for (const [key, value] of Object.entries(override)) {
        if (isPlainObject(value) && isPlainObject(result[key])) {
          result[key] = deepMerge(result[key], value);
        } else {
          result[key] = cloneValue(value);
        }
      }
      return result;
    }
    function deepFreeze(value) {
      if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
      Object.freeze(value);
      for (const entry of Object.values(value)) {
        deepFreeze(entry);
      }
      return value;
    }
    function getSchemaLookupValue(rawConfig, key, def) {
      if (!isPlainObject(rawConfig)) return void 0;
      if (rawConfig[key] !== void 0) return rawConfig[key];
      if (def.nested) {
        const section = rawConfig[def.nested.section];
        if (isPlainObject(section) && section[def.nested.field] !== void 0) {
          return section[def.nested.field];
        }
        if (def.nested.section === "workflow" && def.nested.field === "plan_check" && isPlainObject(section)) {
          if (section.plan_checker !== void 0) return section.plan_checker;
        }
      }
      for (const alias of def.aliases || []) {
        if (rawConfig[alias] !== void 0) return rawConfig[alias];
      }
      return void 0;
    }
    function normalizeSchemaValue(rawValue, def) {
      if (rawValue === void 0) return cloneValue(def.default);
      if (def.coerce === "parallelization") {
        if (typeof rawValue === "boolean") return rawValue;
        if (isPlainObject(rawValue) && rawValue.enabled !== void 0) return Boolean(rawValue.enabled);
        return cloneValue(def.default);
      }
      return cloneValue(rawValue);
    }
    function preferredSchemaPath(key, def) {
      return def.nested ? `${def.nested.section}.${def.nested.field}` : key;
    }
    function shouldSkipMigrationForCompatibility(config, key, def) {
      if (!def.nested || def.nested.section !== "workspace") return false;
      if (config[key] !== void 0) return false;
      if (isPlainObject(config.workspace)) return false;
      return true;
    }
    function setByPath(target, keyPath, value) {
      const keys = keyPath.split(".").filter(Boolean);
      if (keys.length === 0) throw new Error("keyPath is required");
      let current = target;
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (key === "__proto__" || key === "constructor" || key === "prototype") {
          throw new Error("Cannot set prototype properties");
        }
        if (!isPlainObject(current[key])) current[key] = {};
        current = current[key];
      }
      const lastKey = keys[keys.length - 1];
      if (lastKey === "__proto__" || lastKey === "constructor" || lastKey === "prototype") {
        throw new Error("Cannot set prototype properties");
      }
      current[lastKey] = cloneValue(value);
      return target;
    }
    function buildDefaultConfig2(options = {}) {
      let result = {};
      for (const [key, def] of Object.entries(CONFIG_SCHEMA)) {
        if (def.nested) {
          if (!isPlainObject(result[def.nested.section])) result[def.nested.section] = {};
          result[def.nested.section][def.nested.field] = cloneValue(def.default);
        } else {
          result[key] = cloneValue(def.default);
        }
      }
      if (options.overrides) {
        result = deepMerge(result, options.overrides);
      }
      return result;
    }
    function normalizeConfig2(rawConfig, options = {}) {
      const parsed = isPlainObject(rawConfig) ? rawConfig : {};
      const result = {};
      for (const [key, def] of Object.entries(CONFIG_SCHEMA)) {
        result[key] = normalizeSchemaValue(getSchemaLookupValue(parsed, key, def), def);
      }
      const extraDefaults = options.extraDefaults || {};
      for (const [key, defaultValue] of Object.entries(extraDefaults)) {
        if (Object.prototype.hasOwnProperty.call(result, key)) continue;
        const rawValue = parsed[key];
        if (rawValue === void 0) {
          result[key] = cloneValue(defaultValue);
        } else if (isPlainObject(defaultValue) && isPlainObject(rawValue)) {
          result[key] = deepMerge(defaultValue, rawValue);
        } else {
          result[key] = cloneValue(rawValue);
        }
      }
      return options.freeze === false ? result : deepFreeze(result);
    }
    function migrateConfig(rawConfig) {
      const config = isPlainObject(rawConfig) ? cloneValue(rawConfig) : {};
      const migratedKeys = [];
      const unchangedKeys = [];
      for (const [key, def] of Object.entries(CONFIG_SCHEMA)) {
        if (shouldSkipMigrationForCompatibility(config, key, def)) {
          continue;
        }
        const existingValue = getSchemaLookupValue(config, key, def);
        const targetPath = preferredSchemaPath(key, def);
        if (existingValue !== void 0) {
          unchangedKeys.push(targetPath);
          continue;
        }
        setByPath(config, targetPath, def.default);
        migratedKeys.push(targetPath);
      }
      return { config, migratedKeys, unchangedKeys };
    }
    function applyConfigValue(rawConfig, keyPath, value, options = {}) {
      const base = options.withDefaults ? deepMerge(buildDefaultConfig2(options.withDefaults), rawConfig || {}) : cloneValue(rawConfig || {});
      return setByPath(base, keyPath, value);
    }
    function serializeConfig2(config) {
      return JSON.stringify(config, null, 2) + "\n";
    }
    module.exports = {
      applyConfigValue,
      buildDefaultConfig: buildDefaultConfig2,
      deepMerge,
      isPlainObject,
      migrateConfig,
      normalizeConfig: normalizeConfig2,
      serializeConfig: serializeConfig2
    };
  }
});

// src/plugin/parsers/config.js
import { readFileSync as readFileSync4 } from "fs";
import { join as join7 } from "path";
function parseConfig(cwd) {
  const resolvedCwd = cwd || process.cwd();
  if (_cache3.has(resolvedCwd)) {
    return _cache3.get(resolvedCwd);
  }
  const configPath = join7(resolvedCwd, ".planning", "config.json");
  let parsed = {};
  try {
    const raw = readFileSync4(configPath, "utf-8");
    parsed = JSON.parse(raw);
  } catch {
    const defaults = normalizeConfig({}, { extraDefaults: CONFIG_DEFAULTS });
    _cache3.set(resolvedCwd, defaults);
    return defaults;
  }
  const frozen = normalizeConfig(parsed, { extraDefaults: CONFIG_DEFAULTS });
  _cache3.set(resolvedCwd, frozen);
  return frozen;
}
function buildDefaultConfigText() {
  return serializeConfig(buildDefaultConfig());
}
function invalidateConfig(cwd) {
  if (cwd) {
    _cache3.delete(cwd);
  } else {
    _cache3.clear();
  }
}
var import_config_contract, buildDefaultConfig, normalizeConfig, serializeConfig, _cache3, CONFIG_DEFAULTS;
var init_config = __esm({
  "src/plugin/parsers/config.js"() {
    import_config_contract = __toESM(require_config_contract());
    ({ buildDefaultConfig, normalizeConfig, serializeConfig } = import_config_contract.default);
    _cache3 = /* @__PURE__ */ new Map();
    CONFIG_DEFAULTS = Object.freeze({
      staleness_threshold: 2,
      // Phase 75: Event-driven state sync settings
      idle_validation: Object.freeze({
        enabled: true,
        cooldown_seconds: 5,
        staleness_threshold_hours: 2
      }),
      notifications: Object.freeze({
        enabled: true,
        os_notifications: true,
        dnd_mode: false,
        rate_limit_per_minute: 5,
        sound: false
      }),
      stuck_detection: Object.freeze({
        error_threshold: 3,
        spinning_threshold: 5
      }),
      file_watcher: Object.freeze({
        debounce_ms: 200,
        max_watched_paths: 500
      }),
      // Phase 76: Advisory guardrails settings
      advisory_guardrails: Object.freeze({
        enabled: true,
        conventions: true,
        planning_protection: true,
        test_suggestions: true,
        convention_confidence_threshold: 70,
        dedup_threshold: 3,
        test_debounce_ms: 500,
        // Phase 144: Destructive command detection (GARD-04)
        destructive_commands: Object.freeze({
          enabled: true,
          sandbox_mode: "auto",
          categories: Object.freeze({
            filesystem: true,
            database: true,
            git: true,
            system: true,
            "supply-chain": true
          }),
          disabled_patterns: [],
          custom_patterns: []
        })
      })
    });
  }
});

// src/plugin/parsers/project.js
import { readFileSync as readFileSync5 } from "fs";
import { join as join8 } from "path";
function parseProject(cwd) {
  const resolvedCwd = cwd || process.cwd();
  if (_cache4.has(resolvedCwd)) {
    return _cache4.get(resolvedCwd);
  }
  const projectPath = join8(resolvedCwd, ".planning", "PROJECT.md");
  let raw;
  try {
    raw = readFileSync5(projectPath, "utf-8");
  } catch {
    return null;
  }
  if (!raw || raw.trim().length === 0) {
    return null;
  }
  const coreValueMatch = raw.match(/##\s*Core\s+Value\s*\n+([^\n]+)/i) || raw.match(/\*\*Core\s+[Vv]alue:?\*\*:?\s*([^\n]+)/i);
  const coreValue = coreValueMatch ? coreValueMatch[1].trim() : null;
  const techStackMatch = raw.match(/Tech\s+stack:\s*([^\n]+)/i) || raw.match(/\*\*Tech:?\*\*:?\s*([^\n]+)/i);
  const techStack = techStackMatch ? techStackMatch[1].trim() : null;
  const milestoneMatch = raw.match(/##\s*Current\s+Milestone:\s*([^\n]+)/i);
  const currentMilestone = milestoneMatch ? milestoneMatch[1].trim() : null;
  const result = Object.freeze({
    raw,
    coreValue,
    techStack,
    currentMilestone
  });
  _cache4.set(resolvedCwd, result);
  return result;
}
function invalidateProject(cwd) {
  if (cwd) {
    _cache4.delete(cwd);
  } else {
    _cache4.clear();
  }
}
var _cache4;
var init_project = __esm({
  "src/plugin/parsers/project.js"() {
    _cache4 = /* @__PURE__ */ new Map();
  }
});

// src/plugin/parsers/intent.js
import { readFileSync as readFileSync6 } from "fs";
import { join as join9 } from "path";
function parseIntent(cwd) {
  const resolvedCwd = cwd || process.cwd();
  if (_cache5.has(resolvedCwd)) {
    return _cache5.get(resolvedCwd);
  }
  const intentPath = join9(resolvedCwd, ".planning", "INTENT.md");
  let raw;
  try {
    raw = readFileSync6(intentPath, "utf-8");
  } catch {
    return null;
  }
  if (!raw || raw.trim().length === 0) {
    return null;
  }
  const objectiveMatch = raw.match(/<objective>([\s\S]*?)<\/objective>/);
  const objective = objectiveMatch ? objectiveMatch[1].trim() : null;
  const outcomesMatch = raw.match(/<outcomes>([\s\S]*?)<\/outcomes>/);
  const outcomes = [];
  if (outcomesMatch) {
    const outcomesContent = outcomesMatch[1];
    const entryPattern = /-\s*(DO-\d+)\s*(?:\[P\d+\])?\s*:\s*([^\n]+)/g;
    let match;
    while ((match = entryPattern.exec(outcomesContent)) !== null) {
      outcomes.push(Object.freeze({
        id: match[1],
        text: match[2].trim()
      }));
    }
  }
  const result = Object.freeze({
    raw,
    objective,
    outcomes: Object.freeze(outcomes)
  });
  _cache5.set(resolvedCwd, result);
  return result;
}
function invalidateIntent(cwd) {
  if (cwd) {
    _cache5.delete(cwd);
  } else {
    _cache5.clear();
  }
}
var _cache5;
var init_intent = __esm({
  "src/plugin/parsers/intent.js"() {
    _cache5 = /* @__PURE__ */ new Map();
  }
});

// src/plugin/parsers/index.js
var parsers_exports = {};
__export(parsers_exports, {
  invalidateAll: () => invalidateAll,
  invalidateConfig: () => invalidateConfig,
  invalidateIntent: () => invalidateIntent,
  invalidatePlanningCache: () => invalidatePlanningCache,
  invalidatePlans: () => invalidatePlans,
  invalidateProject: () => invalidateProject,
  invalidateRoadmap: () => invalidateRoadmap,
  invalidateState: () => invalidateState,
  parseConfig: () => parseConfig,
  parseIntent: () => parseIntent,
  parsePlan: () => parsePlan,
  parsePlans: () => parsePlans,
  parseProject: () => parseProject,
  parseRoadmap: () => parseRoadmap,
  parseState: () => parseState
});
function invalidateAll(cwd) {
  invalidateState(cwd);
  invalidateRoadmap(cwd);
  invalidatePlans(cwd);
  invalidateConfig(cwd);
  invalidateProject(cwd);
  invalidateIntent(cwd);
  if (cwd) {
    try {
      const db = getDb(cwd);
      const cache = new PlanningCache(db);
      cache.clearForCwd(cwd);
    } catch {
    }
  }
}
function invalidatePlanningCache(cwd) {
  if (!cwd) return;
  try {
    const db = getDb(cwd);
    const cache = new PlanningCache(db);
    cache.clearForCwd(cwd);
  } catch {
  }
}
var init_parsers = __esm({
  async "src/plugin/parsers/index.js"() {
    await init_state();
    await init_roadmap();
    await init_plan();
    init_config();
    init_project();
    init_intent();
    await init_state();
    await init_roadmap();
    await init_plan();
    init_config();
    init_project();
    init_intent();
    await init_db_cache();
  }
});

// src/lib/planning-cache.js
var require_planning_cache = __commonJS({
  "src/lib/planning-cache.js"(exports, module) {
    "use strict";
    var fs = __require("fs");
    var PlanningCache2 = class {
      /**
       * @param {import('./db').SQLiteDatabase|import('./db').MapDatabase} db
       */
      constructor(db) {
        this._db = db;
        this._stmts = {};
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
        return this._db.backend === "map";
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
        if (this._isMap()) return "missing";
        try {
          const row = this._stmt(
            "file_cache_get",
            "SELECT mtime_ms FROM file_cache WHERE file_path = ?"
          ).get(filePath);
          if (!row) return "missing";
          const currentMtime = fs.statSync(filePath).mtimeMs;
          return currentMtime === row.mtime_ms ? "fresh" : "stale";
        } catch {
          return "missing";
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
            "file_cache_upsert",
            "INSERT OR REPLACE INTO file_cache (file_path, mtime_ms, parsed_at) VALUES (?, ?, ?)"
          ).run(filePath, mtime_ms, (/* @__PURE__ */ new Date()).toISOString());
        } catch {
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
          this._db.exec("BEGIN");
          this._stmt(
            "file_cache_delete",
            "DELETE FROM file_cache WHERE file_path = ?"
          ).run(filePath);
          this._stmt(
            "plans_delete_by_path",
            "DELETE FROM plans WHERE path = ?"
          ).run(filePath);
          this._db.exec("COMMIT");
        } catch {
          try {
            this._db.exec("ROLLBACK");
          } catch {
          }
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
          this._db.exec("BEGIN");
          this._stmt("phases_delete_cwd", "DELETE FROM phases WHERE cwd = ?").run(cwd);
          this._stmt("milestones_delete_cwd", "DELETE FROM milestones WHERE cwd = ?").run(cwd);
          this._stmt("progress_delete_cwd", "DELETE FROM progress WHERE cwd = ?").run(cwd);
          this._stmt("requirements_delete_cwd", "DELETE FROM requirements WHERE cwd = ?").run(cwd);
          const phaseInsert = this._stmt(
            "phases_insert",
            `INSERT OR REPLACE INTO phases
         (number, cwd, name, status, plan_count, goal, depends_on, requirements, section)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          );
          for (const phase of parsed.phases || []) {
            phaseInsert.run(
              phase.number || "",
              cwd,
              phase.name || "",
              phase.status || "incomplete",
              phase.plan_count != null ? phase.plan_count : 0,
              phase.goal || null,
              phase.depends_on ? JSON.stringify(phase.depends_on) : null,
              phase.requirements ? JSON.stringify(phase.requirements) : null,
              phase.section || null
            );
          }
          const msInsert = this._stmt(
            "milestones_insert",
            `INSERT INTO milestones (cwd, name, version, status, phase_start, phase_end)
         VALUES (?, ?, ?, ?, ?, ?)`
          );
          for (const ms of parsed.milestones || []) {
            msInsert.run(
              cwd,
              ms.name || "",
              ms.version || null,
              ms.status || "pending",
              ms.phase_start != null ? ms.phase_start : null,
              ms.phase_end != null ? ms.phase_end : null
            );
          }
          const progInsert = this._stmt(
            "progress_insert",
            `INSERT OR REPLACE INTO progress
         (phase, cwd, plans_complete, plans_total, status, completed_date)
         VALUES (?, ?, ?, ?, ?, ?)`
          );
          for (const prog of parsed.progress || []) {
            progInsert.run(
              prog.phase || "",
              cwd,
              prog.plans_complete != null ? prog.plans_complete : 0,
              prog.plans_total != null ? prog.plans_total : 0,
              prog.status || null,
              prog.completed_date || null
            );
          }
          const reqInsert = this._stmt(
            "requirements_insert",
            `INSERT OR REPLACE INTO requirements (req_id, cwd, phase_number, description)
         VALUES (?, ?, ?, ?)`
          );
          const requirements = parsed.requirements || _extractRequirementsFromPhases2(parsed.phases || []);
          for (const req of requirements) {
            reqInsert.run(
              req.req_id || req.id || "",
              cwd,
              req.phase_number || req.phase || null,
              req.description || null
            );
          }
          if (roadmapPath) {
            this._updateMtimeInTx(roadmapPath);
          }
          this._db.exec("COMMIT");
        } catch (e) {
          try {
            this._db.exec("ROLLBACK");
          } catch {
          }
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
          this._db.exec("BEGIN");
          this._stmt(
            "plans_delete_path",
            "DELETE FROM plans WHERE path = ?"
          ).run(planPath);
          const fm = parsed.frontmatter || {};
          this._stmt(
            "plans_insert",
            `INSERT OR REPLACE INTO plans
         (path, cwd, phase_number, plan_number, wave, autonomous, objective, task_count, frontmatter_json, raw)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            planPath,
            cwd,
            fm.phase ? String(fm.phase).split("-")[0] : null,
            fm.plan != null ? String(fm.plan) : null,
            fm.wave != null ? fm.wave : null,
            fm.autonomous != null ? fm.autonomous ? 1 : 0 : null,
            parsed.objective || null,
            (parsed.tasks || []).length,
            JSON.stringify(fm),
            parsed.raw || null
          );
          const taskInsert = this._stmt(
            "tasks_insert",
            `INSERT OR REPLACE INTO tasks
         (plan_path, idx, type, name, files_json, action, verify, done)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          );
          for (let i = 0; i < (parsed.tasks || []).length; i++) {
            const task = parsed.tasks[i];
            taskInsert.run(
              planPath,
              i,
              task.type || "auto",
              task.name || null,
              task.files ? JSON.stringify(task.files) : null,
              task.action || null,
              task.verify || null,
              task.done || null
            );
          }
          this._updateMtimeInTx(planPath);
          this._db.exec("COMMIT");
        } catch (e) {
          try {
            this._db.exec("ROLLBACK");
          } catch {
          }
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
            "file_cache_upsert_tx",
            "INSERT OR REPLACE INTO file_cache (file_path, mtime_ms, parsed_at) VALUES (?, ?, ?)"
          ).run(filePath, mtime_ms, (/* @__PURE__ */ new Date()).toISOString());
        } catch {
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
            "phases_all",
            "SELECT * FROM phases WHERE cwd = ? ORDER BY number"
          ).all(cwd);
          return rows.length > 0 ? rows : null;
        } catch {
          return null;
        }
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
            "phase_by_number",
            "SELECT * FROM phases WHERE number = ? AND cwd = ?"
          ).get(number, cwd);
          return row || null;
        } catch {
          return null;
        }
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
            "plans_all",
            "SELECT * FROM plans WHERE cwd = ? ORDER BY phase_number, plan_number"
          ).all(cwd);
          return rows.length > 0 ? rows : null;
        } catch {
          return null;
        }
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
            "plan_by_path",
            "SELECT * FROM plans WHERE path = ?"
          ).get(planPath);
          if (!plan) return null;
          const tasks = this._stmt(
            "tasks_for_plan",
            "SELECT * FROM tasks WHERE plan_path = ? ORDER BY idx"
          ).all(planPath);
          return { ...plan, tasks };
        } catch {
          return null;
        }
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
            "plans_for_phase",
            "SELECT * FROM plans WHERE phase_number = ? AND cwd = ? ORDER BY plan_number"
          ).all(phaseNumber, cwd);
          return rows.length > 0 ? rows : null;
        } catch {
          return null;
        }
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
            "requirements_all",
            "SELECT * FROM requirements WHERE cwd = ? ORDER BY req_id"
          ).all(cwd);
          return rows.length > 0 ? rows : null;
        } catch {
          return null;
        }
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
            "requirement_by_id",
            "SELECT * FROM requirements WHERE req_id = ? AND cwd = ?"
          ).get(reqId, cwd);
          return row || null;
        } catch {
          return null;
        }
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
            "milestones_all",
            "SELECT * FROM milestones WHERE cwd = ? ORDER BY id"
          ).all(cwd);
          return rows.length > 0 ? rows : null;
        } catch {
          return null;
        }
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
            "progress_all",
            "SELECT * FROM progress WHERE cwd = ? ORDER BY phase"
          ).all(cwd);
          return rows.length > 0 ? rows : null;
        } catch {
          return null;
        }
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
          const existing = this._stmt(
            "mem_dec_count",
            "SELECT COUNT(*) AS cnt FROM memory_decisions WHERE cwd = ?"
          ).get(cwd);
          if (existing && existing.cnt > 0) {
            return result;
          }
          const memoryDir = __require("path").join(cwd, ".planning", "memory");
          try {
            const raw = __require("fs").readFileSync(__require("path").join(memoryDir, "decisions.json"), "utf8");
            const entries = JSON.parse(raw);
            if (Array.isArray(entries) && entries.length > 0) {
              const ins = this._stmt(
                "mem_dec_ins",
                "INSERT INTO memory_decisions (cwd, summary, phase, timestamp, data_json) VALUES (?, ?, ?, ?, ?)"
              );
              this._db.exec("BEGIN");
              for (const entry of entries) {
                ins.run(cwd, entry.summary || null, entry.phase || null, entry.timestamp || null, JSON.stringify(entry));
                result.migrated.decisions++;
              }
              this._db.exec("COMMIT");
            }
          } catch {
            result.skipped.push("decisions");
          }
          try {
            const raw = __require("fs").readFileSync(__require("path").join(memoryDir, "lessons.json"), "utf8");
            const entries = JSON.parse(raw);
            if (Array.isArray(entries) && entries.length > 0) {
              const ins = this._stmt(
                "mem_les_ins",
                "INSERT INTO memory_lessons (cwd, summary, phase, timestamp, data_json) VALUES (?, ?, ?, ?, ?)"
              );
              this._db.exec("BEGIN");
              for (const entry of entries) {
                ins.run(cwd, entry.summary || null, entry.phase || null, entry.timestamp || null, JSON.stringify(entry));
                result.migrated.lessons++;
              }
              this._db.exec("COMMIT");
            }
          } catch {
            result.skipped.push("lessons");
          }
          try {
            const raw = __require("fs").readFileSync(__require("path").join(memoryDir, "trajectory.json"), "utf8");
            const entries = JSON.parse(raw);
            if (Array.isArray(entries) && entries.length > 0) {
              const ins = this._stmt(
                "mem_trj_ins",
                "INSERT INTO memory_trajectories (cwd, entry_id, category, text, phase, scope, checkpoint_name, attempt, confidence, timestamp, tags_json, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
              );
              this._db.exec("BEGIN");
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
              this._db.exec("COMMIT");
            }
          } catch {
            result.skipped.push("trajectories");
          }
          try {
            const raw = __require("fs").readFileSync(__require("path").join(memoryDir, "bookmarks.json"), "utf8");
            const entries = JSON.parse(raw);
            if (Array.isArray(entries) && entries.length > 0) {
              const ins = this._stmt(
                "mem_bkm_ins",
                "INSERT INTO memory_bookmarks (cwd, phase, plan, task, total_tasks, git_head, timestamp, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
              );
              this._db.exec("BEGIN");
              for (let i = entries.length - 1; i >= 0; i--) {
                const entry = entries[i];
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
              this._db.exec("COMMIT");
            }
          } catch {
            result.skipped.push("bookmarks");
          }
        } catch {
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
        try {
          let table, searchCols, orderBy;
          switch (store) {
            case "decisions":
              table = "memory_decisions";
              searchCols = "(summary LIKE ? OR data_json LIKE ?)";
              orderBy = "timestamp DESC";
              break;
            case "lessons":
              table = "memory_lessons";
              searchCols = "(summary LIKE ? OR data_json LIKE ?)";
              orderBy = "timestamp DESC";
              break;
            case "trajectories":
              table = "memory_trajectories";
              searchCols = "(text LIKE ? OR data_json LIKE ?)";
              orderBy = "id DESC";
              break;
            case "bookmarks":
              table = "memory_bookmarks";
              searchCols = "(phase LIKE ? OR data_json LIKE ?)";
              orderBy = "timestamp DESC";
              break;
            default:
              return null;
          }
          let params, whereClauses;
          if (query) {
            const likePattern = "%" + query + "%";
            params = [cwd, likePattern, likePattern];
            whereClauses = `cwd = ? AND ${searchCols}`;
          } else {
            params = [cwd];
            whereClauses = "cwd = ?";
          }
          if (opts.phase) {
            whereClauses += " AND phase = ?";
            params.push(opts.phase);
          }
          if (opts.category && store === "trajectories") {
            whereClauses += " AND category = ?";
            params.push(opts.category);
          }
          const countSql = `SELECT COUNT(*) AS cnt FROM ${table} WHERE ${whereClauses}`;
          const countRow = this._db.prepare(countSql).get(...params);
          const total = countRow ? countRow.cnt : 0;
          const dataSql = `SELECT * FROM ${table} WHERE ${whereClauses} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
          const rows = this._db.prepare(dataSql).all(...params, limit, offset);
          const entries = rows.map((row) => {
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
            case "decisions":
              this._stmt(
                "mem_dec_write",
                "INSERT INTO memory_decisions (cwd, summary, phase, timestamp, data_json) VALUES (?, ?, ?, ?, ?)"
              ).run(cwd, entry.summary || null, entry.phase || null, entry.timestamp || null, JSON.stringify(entry));
              break;
            case "lessons":
              this._stmt(
                "mem_les_write",
                "INSERT INTO memory_lessons (cwd, summary, phase, timestamp, data_json) VALUES (?, ?, ?, ?, ?)"
              ).run(cwd, entry.summary || null, entry.phase || null, entry.timestamp || null, JSON.stringify(entry));
              break;
            case "trajectories":
              this._stmt(
                "mem_trj_write",
                "INSERT INTO memory_trajectories (cwd, entry_id, category, text, phase, scope, checkpoint_name, attempt, confidence, timestamp, tags_json, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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
            case "bookmarks":
              this._stmt(
                "mem_bkm_write",
                "INSERT INTO memory_bookmarks (cwd, phase, plan, task, total_tasks, git_head, timestamp, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
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
          decisions: "memory_decisions",
          lessons: "memory_lessons",
          trajectories: "memory_trajectories",
          bookmarks: "memory_bookmarks"
        };
        const table = tableMap[store];
        if (!table) return;
        try {
          this._db.prepare(`DELETE FROM ${table} WHERE cwd = ?`).run(cwd);
        } catch {
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
            "mem_bkm_top",
            "SELECT * FROM memory_bookmarks WHERE cwd = ? ORDER BY id DESC LIMIT 1"
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
      // -------------------------------------------------------------------------
      // Model Profile Operations (Phase 122)
      // -------------------------------------------------------------------------
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
          const row = this._stmt(
            "mp_get_cwd",
            "SELECT * FROM model_profiles WHERE agent_type = ? AND cwd = ?"
          ).get(agentType, cwd);
          if (row) return row;
          const defaultRow = this._stmt(
            "mp_get_default",
            "SELECT * FROM model_profiles WHERE agent_type = ? AND cwd = '__defaults__'"
          ).get(agentType);
          return defaultRow || null;
        } catch {
          return null;
        }
      }
      /**
       * Upsert a model profile row for a specific cwd and agent type.
       *
       * @param {string} cwd - Project root directory
       * @param {string} agentType - Agent type
       * @param {{ quality_model?: string, balanced_model?: string, budget_model?: string, override_model?: string }} profile
       */
      storeModelProfile(cwd, agentType, profile) {
        if (this._isMap()) return;
        try {
          this._stmt(
            "mp_upsert",
            `INSERT OR REPLACE INTO model_profiles
         (agent_type, cwd, quality_model, balanced_model, budget_model, override_model)
         VALUES (?, ?, ?, ?, ?, ?)`
          ).run(
            agentType,
            cwd,
            profile.quality_model || "opus",
            profile.balanced_model || "sonnet",
            profile.budget_model || "haiku",
            profile.override_model || null
          );
        } catch {
        }
      }
      /**
       * Get all model profiles for a cwd.
       * Falls back to '__defaults__' rows for any agent type without a cwd-specific row.
       *
       * @param {string} cwd - Project root directory
       * @returns {Array|null} Array of model profile rows, or null on miss/error
       */
      getModelProfiles(cwd) {
        if (this._isMap()) return null;
        try {
          const rows = this._stmt(
            "mp_all_cwd",
            "SELECT * FROM model_profiles WHERE cwd = ? ORDER BY agent_type"
          ).all(cwd);
          if (rows && rows.length > 0) return rows;
          const defaults = this._stmt(
            "mp_all_defaults",
            "SELECT * FROM model_profiles WHERE cwd = '__defaults__' ORDER BY agent_type"
          ).all();
          return defaults && defaults.length > 0 ? defaults : null;
        } catch {
          return null;
        }
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
          const existing = this._stmt(
            "mp_count_cwd",
            "SELECT COUNT(*) AS cnt FROM model_profiles WHERE cwd = ?"
          ).get(cwd);
          if (existing && existing.cnt > 0) return;
          const defaults = this._stmt(
            "mp_seed_defaults",
            "SELECT * FROM model_profiles WHERE cwd = '__defaults__'"
          ).all();
          if (!defaults || defaults.length === 0) return;
          const ins = this._stmt(
            "mp_seed_insert",
            `INSERT OR IGNORE INTO model_profiles
         (agent_type, cwd, quality_model, balanced_model, budget_model, override_model)
         VALUES (?, ?, ?, ?, ?, ?)`
          );
          this._db.exec("BEGIN");
          for (const row of defaults) {
            ins.run(row.agent_type, cwd, row.quality_model, row.balanced_model, row.budget_model, row.override_model || null);
          }
          this._db.exec("COMMIT");
        } catch {
          try {
            this._db.exec("ROLLBACK");
          } catch {
          }
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
          this._db.exec("BEGIN");
          this._stmt("clear_phases_cwd", "DELETE FROM phases WHERE cwd = ?").run(cwd);
          this._stmt("clear_milestones_cwd", "DELETE FROM milestones WHERE cwd = ?").run(cwd);
          this._stmt("clear_progress_cwd", "DELETE FROM progress WHERE cwd = ?").run(cwd);
          this._stmt("clear_requirements_cwd", "DELETE FROM requirements WHERE cwd = ?").run(cwd);
          const planPaths = this._stmt(
            "clear_plan_paths",
            "SELECT path FROM plans WHERE cwd = ?"
          ).all(cwd).map((r) => r.path);
          for (const planPath of planPaths) {
            this._stmt(
              "clear_tasks_for_plan",
              "DELETE FROM tasks WHERE plan_path = ?"
            ).run(planPath);
          }
          this._stmt("clear_plans_cwd", "DELETE FROM plans WHERE cwd = ?").run(cwd);
          this._stmt(
            "clear_file_cache_cwd",
            "DELETE FROM file_cache WHERE file_path LIKE ? || '%'"
          ).run(cwd);
          this._db.exec("COMMIT");
        } catch {
          try {
            this._db.exec("ROLLBACK");
          } catch {
          }
        }
      }
      // -------------------------------------------------------------------------
      // Session State Operations (Phase 123)
      // -------------------------------------------------------------------------
      /**
       * Upsert current position into session_state.
       *
       * @param {string} cwd - Project root directory
       * @param {object} state - Position state fields:
       *   { phase_number, phase_name, total_phases, current_plan, status, last_activity, progress, milestone }
       */
      storeSessionState(cwd, state) {
        if (this._isMap()) return null;
        try {
          this._stmt(
            "ss_upsert",
            `INSERT OR REPLACE INTO session_state
         (cwd, phase_number, phase_name, total_phases, current_plan, status, last_activity, progress, milestone, data_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            cwd,
            state.phase_number || null,
            state.phase_name || null,
            state.total_phases != null ? state.total_phases : null,
            state.current_plan || null,
            state.status || null,
            state.last_activity || null,
            state.progress != null ? state.progress : null,
            state.milestone || null,
            JSON.stringify(state)
          );
          return { stored: true };
        } catch {
          return null;
        }
      }
      /**
       * Get session_state row for cwd.
       *
       * @param {string} cwd - Project root directory
       * @returns {object|null} State row, or null on miss
       */
      getSessionState(cwd) {
        if (this._isMap()) return null;
        try {
          const row = this._stmt(
            "ss_get",
            "SELECT * FROM session_state WHERE cwd = ?"
          ).get(cwd);
          return row || null;
        } catch {
          return null;
        }
      }
      /**
       * One-time import from parsed STATE.md data.
       * Populates session_state, session_decisions, session_metrics, session_todos,
       * session_blockers, session_continuity from the parsed object.
       * Idempotent — skips if session_state row already exists for cwd.
       *
       * @param {string} cwd - Project root directory
       * @param {object} parsed - Parsed STATE.md data with fields:
       *   { phase_number, phase_name, total_phases, current_plan, status, last_activity, progress, milestone,
       *     decisions, metrics, todos, blockers, continuity }
       * @returns {{ migrated: boolean }|null}
       */
      migrateStateFromMarkdown(cwd, parsed) {
        if (this._isMap()) return null;
        try {
          const existing = this._stmt(
            "ss_check",
            "SELECT cwd FROM session_state WHERE cwd = ?"
          ).get(cwd);
          if (existing) return { migrated: false, reason: "already_exists" };
          this._db.exec("BEGIN");
          this._stmt(
            "ss_upsert2",
            `INSERT OR REPLACE INTO session_state
         (cwd, phase_number, phase_name, total_phases, current_plan, status, last_activity, progress, milestone, data_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            cwd,
            parsed.phase_number || null,
            parsed.phase_name || null,
            parsed.total_phases != null ? parsed.total_phases : null,
            parsed.current_plan || null,
            parsed.status || null,
            parsed.last_activity || null,
            parsed.progress != null ? parsed.progress : null,
            parsed.milestone || null,
            JSON.stringify(parsed)
          );
          if (Array.isArray(parsed.decisions) && parsed.decisions.length > 0) {
            const decIns = this._stmt(
              "ss_dec_ins",
              "INSERT INTO session_decisions (cwd, milestone, phase, summary, rationale, timestamp, data_json) VALUES (?, ?, ?, ?, ?, ?, ?)"
            );
            for (const d of parsed.decisions) {
              decIns.run(cwd, d.milestone || null, d.phase || null, d.summary || null, d.rationale || null, d.timestamp || null, JSON.stringify(d));
            }
          }
          if (Array.isArray(parsed.metrics) && parsed.metrics.length > 0) {
            const metIns = this._stmt(
              "ss_met_ins",
              "INSERT INTO session_metrics (cwd, milestone, phase, plan, duration, tasks, files, test_count, timestamp, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );
            for (const m of parsed.metrics) {
              metIns.run(cwd, m.milestone || null, m.phase || null, m.plan || null, m.duration || null, m.tasks != null ? m.tasks : null, m.files != null ? m.files : null, m.test_count != null ? m.test_count : null, m.timestamp || null, JSON.stringify(m));
            }
          }
          if (Array.isArray(parsed.todos) && parsed.todos.length > 0) {
            const todoIns = this._stmt(
              "ss_todo_ins",
              "INSERT INTO session_todos (cwd, text, priority, category, status, created_at, data_json) VALUES (?, ?, ?, ?, ?, ?, ?)"
            );
            for (const t of parsed.todos) {
              todoIns.run(cwd, t.text || "", t.priority || null, t.category || null, t.status || "pending", t.created_at || null, JSON.stringify(t));
            }
          }
          if (Array.isArray(parsed.blockers) && parsed.blockers.length > 0) {
            const blkIns = this._stmt(
              "ss_blk_ins",
              "INSERT INTO session_blockers (cwd, text, status, created_at, data_json) VALUES (?, ?, ?, ?, ?)"
            );
            for (const b of parsed.blockers) {
              blkIns.run(cwd, b.text || "", b.status || "open", b.created_at || null, JSON.stringify(b));
            }
          }
          if (parsed.continuity) {
            const c = parsed.continuity;
            this._stmt(
              "ss_cont_ins",
              "INSERT OR REPLACE INTO session_continuity (cwd, last_session, stopped_at, next_step, data_json) VALUES (?, ?, ?, ?, ?)"
            ).run(cwd, c.last_session || null, c.stopped_at || null, c.next_step || null, JSON.stringify(c));
          }
          this._db.exec("COMMIT");
          return { migrated: true };
        } catch {
          try {
            this._db.exec("ROLLBACK");
          } catch {
          }
          return null;
        }
      }
      /**
       * Insert a performance metric row.
       *
       * @param {string} cwd - Project root directory
       * @param {object} metric - { milestone, phase, plan, duration, tasks, files, test_count, timestamp }
       * @returns {{ inserted: boolean }|null}
       */
      writeSessionMetric(cwd, metric) {
        if (this._isMap()) return null;
        try {
          this._stmt(
            "sm_ins",
            "INSERT INTO session_metrics (cwd, milestone, phase, plan, duration, tasks, files, test_count, timestamp, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
          ).run(
            cwd,
            metric.milestone || null,
            metric.phase || null,
            metric.plan || null,
            metric.duration || null,
            metric.tasks != null ? metric.tasks : null,
            metric.files != null ? metric.files : null,
            metric.test_count != null ? metric.test_count : null,
            metric.timestamp || null,
            JSON.stringify(metric)
          );
          return { inserted: true };
        } catch {
          return null;
        }
      }
      /**
       * Query session_metrics for cwd.
       *
       * @param {string} cwd - Project root directory
       * @param {{ phase?: string, limit?: number }} [options]
       * @returns {{ entries: object[], total: number }|null}
       */
      getSessionMetrics(cwd, options) {
        if (this._isMap()) return null;
        try {
          const opts = options || {};
          const limit = opts.limit != null ? opts.limit : 100;
          let whereClauses = "cwd = ?";
          const params = [cwd];
          if (opts.phase) {
            whereClauses += " AND phase = ?";
            params.push(opts.phase);
          }
          const countRow = this._db.prepare("SELECT COUNT(*) AS cnt FROM session_metrics WHERE " + whereClauses).get(...params);
          const total = countRow ? countRow.cnt : 0;
          const rows = this._db.prepare("SELECT * FROM session_metrics WHERE " + whereClauses + " ORDER BY id DESC LIMIT ?").all(...params, limit);
          const entries = rows.map((r) => {
            try {
              return JSON.parse(r.data_json);
            } catch {
              return r;
            }
          });
          return { entries, total };
        } catch {
          return null;
        }
      }
      /**
       * Insert a decision row.
       *
       * @param {string} cwd - Project root directory
       * @param {object} decision - { milestone, phase, summary, rationale, timestamp }
       * @returns {{ inserted: boolean }|null}
       */
      writeSessionDecision(cwd, decision) {
        if (this._isMap()) return null;
        try {
          this._stmt(
            "sd_ins",
            "INSERT INTO session_decisions (cwd, milestone, phase, summary, rationale, timestamp, data_json) VALUES (?, ?, ?, ?, ?, ?, ?)"
          ).run(
            cwd,
            decision.milestone || null,
            decision.phase || null,
            decision.summary || null,
            decision.rationale || null,
            decision.timestamp || null,
            JSON.stringify(decision)
          );
          return { inserted: true };
        } catch {
          return null;
        }
      }
      /**
       * Replace the touched session bundle in one SQLite transaction.
       *
       * Used by canonical mutators that compute one next model before writing
       * STATE.md and SQLite.
       *
       * @param {string} cwd
       * @param {{ state?: object, decisions?: object[], blockers?: object[], continuity?: object|null }} bundle
       * @returns {{ stored: boolean }|null}
       */
      storeSessionBundle(cwd, bundle) {
        if (this._isMap()) return null;
        try {
          this._db.exec("BEGIN");
          if (bundle && Object.prototype.hasOwnProperty.call(bundle, "state")) {
            const state = bundle.state || {};
            this._stmt(
              "ss_upsert_bundle",
              `INSERT OR REPLACE INTO session_state
           (cwd, phase_number, phase_name, total_phases, current_plan, status, last_activity, progress, milestone, data_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(
              cwd,
              state.phase_number || null,
              state.phase_name || null,
              state.total_phases != null ? state.total_phases : null,
              state.current_plan || null,
              state.status || null,
              state.last_activity || null,
              state.progress != null ? state.progress : null,
              state.milestone || null,
              JSON.stringify(state)
            );
          }
          if (bundle && Object.prototype.hasOwnProperty.call(bundle, "decisions")) {
            this._stmt("sd_delete_bundle", "DELETE FROM session_decisions WHERE cwd = ?").run(cwd);
            const decisions = Array.isArray(bundle.decisions) ? bundle.decisions : [];
            if (decisions.length > 0) {
              const insertDecision = this._stmt(
                "sd_insert_bundle",
                "INSERT INTO session_decisions (cwd, milestone, phase, summary, rationale, timestamp, data_json) VALUES (?, ?, ?, ?, ?, ?, ?)"
              );
              for (const decision of decisions) {
                insertDecision.run(
                  cwd,
                  decision.milestone || null,
                  decision.phase || null,
                  decision.summary || null,
                  decision.rationale || null,
                  decision.timestamp || null,
                  JSON.stringify(decision)
                );
              }
            }
          }
          if (bundle && Object.prototype.hasOwnProperty.call(bundle, "blockers")) {
            this._stmt("sb_delete_bundle", "DELETE FROM session_blockers WHERE cwd = ?").run(cwd);
            const blockers = Array.isArray(bundle.blockers) ? bundle.blockers : [];
            if (blockers.length > 0) {
              const insertBlocker = this._stmt(
                "sb_insert_bundle",
                "INSERT INTO session_blockers (cwd, text, status, created_at, data_json) VALUES (?, ?, ?, ?, ?)"
              );
              for (const blocker of blockers) {
                insertBlocker.run(
                  cwd,
                  blocker.text || "",
                  blocker.status || "open",
                  blocker.created_at || null,
                  JSON.stringify(blocker)
                );
              }
            }
          }
          if (bundle && Object.prototype.hasOwnProperty.call(bundle, "continuity")) {
            if (bundle.continuity) {
              this._stmt(
                "sc_upsert_bundle",
                "INSERT OR REPLACE INTO session_continuity (cwd, last_session, stopped_at, next_step, data_json) VALUES (?, ?, ?, ?, ?)"
              ).run(
                cwd,
                bundle.continuity.last_session || null,
                bundle.continuity.stopped_at || null,
                bundle.continuity.next_step || null,
                JSON.stringify(bundle.continuity)
              );
            } else {
              this._stmt("sc_delete_bundle", "DELETE FROM session_continuity WHERE cwd = ?").run(cwd);
            }
          }
          this._db.exec("COMMIT");
          return { stored: true };
        } catch {
          try {
            this._db.exec("ROLLBACK");
          } catch {
          }
          return null;
        }
      }
      /**
       * Write the durable plan-completion core in one SQLite transaction.
       * Upserts session_state and appends any provided decision rows together.
       *
       * @param {string} cwd
       * @param {{ state: object, decisions?: object[] }} payload
       * @returns {{ stored: boolean, decisions_written: number }|null}
       */
      storeSessionCompletionCore(cwd, payload) {
        if (this._isMap()) return null;
        try {
          const state = payload?.state || {};
          const decisions = Array.isArray(payload?.decisions) ? payload.decisions : [];
          this._db.exec("BEGIN");
          this._stmt(
            "ss_upsert_completion_core",
            `INSERT OR REPLACE INTO session_state
         (cwd, phase_number, phase_name, total_phases, current_plan, status, last_activity, progress, milestone, data_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            cwd,
            state.phase_number || null,
            state.phase_name || null,
            state.total_phases != null ? state.total_phases : null,
            state.current_plan || null,
            state.status || null,
            state.last_activity || null,
            state.progress != null ? state.progress : null,
            state.milestone || null,
            JSON.stringify(state)
          );
          if (decisions.length > 0) {
            const insertDecision = this._stmt(
              "sd_ins_completion_core",
              "INSERT INTO session_decisions (cwd, milestone, phase, summary, rationale, timestamp, data_json) VALUES (?, ?, ?, ?, ?, ?, ?)"
            );
            for (const decision of decisions) {
              insertDecision.run(
                cwd,
                decision.milestone || null,
                decision.phase || null,
                decision.summary || null,
                decision.rationale || null,
                decision.timestamp || null,
                JSON.stringify(decision)
              );
            }
          }
          this._db.exec("COMMIT");
          return { stored: true, decisions_written: decisions.length };
        } catch {
          try {
            this._db.exec("ROLLBACK");
          } catch {
          }
          return null;
        }
      }
      /**
       * Query session_decisions for cwd.
       *
       * @param {string} cwd - Project root directory
       * @param {{ phase?: string, limit?: number, offset?: number }} [options]
       * @returns {{ entries: object[], total: number }|null}
       */
      getSessionDecisions(cwd, options) {
        if (this._isMap()) return null;
        try {
          const opts = options || {};
          const limit = opts.limit != null ? opts.limit : 100;
          const offset = opts.offset != null ? opts.offset : 0;
          let whereClauses = "cwd = ?";
          const params = [cwd];
          if (opts.phase) {
            whereClauses += " AND phase = ?";
            params.push(opts.phase);
          }
          const countRow = this._db.prepare("SELECT COUNT(*) AS cnt FROM session_decisions WHERE " + whereClauses).get(...params);
          const total = countRow ? countRow.cnt : 0;
          const rows = this._db.prepare("SELECT * FROM session_decisions WHERE " + whereClauses + " ORDER BY id DESC LIMIT ? OFFSET ?").all(...params, limit, offset);
          const entries = rows.map((r) => {
            try {
              return JSON.parse(r.data_json);
            } catch {
              return r;
            }
          });
          return { entries, total };
        } catch {
          return null;
        }
      }
      /**
       * Insert a todo row.
       *
       * @param {string} cwd - Project root directory
       * @param {object} todo - { text, priority, category, status, created_at }
       * @returns {{ inserted: boolean, id: number }|null}
       */
      writeSessionTodo(cwd, todo) {
        if (this._isMap()) return null;
        try {
          const result = this._stmt(
            "st_ins",
            "INSERT INTO session_todos (cwd, text, priority, category, status, created_at, data_json) VALUES (?, ?, ?, ?, ?, ?, ?)"
          ).run(
            cwd,
            todo.text || "",
            todo.priority || null,
            todo.category || null,
            todo.status || "pending",
            todo.created_at || null,
            JSON.stringify(todo)
          );
          return { inserted: true, id: result ? result.lastInsertRowid : null };
        } catch {
          return null;
        }
      }
      /**
       * Query session_todos for cwd.
       *
       * @param {string} cwd - Project root directory
       * @param {{ status?: string, limit?: number }} [options]
       * @returns {{ entries: object[], total: number }|null}
       */
      getSessionTodos(cwd, options) {
        if (this._isMap()) return null;
        try {
          const opts = options || {};
          const limit = opts.limit != null ? opts.limit : 100;
          let whereClauses = "cwd = ?";
          const params = [cwd];
          if (opts.status) {
            whereClauses += " AND status = ?";
            params.push(opts.status);
          }
          const countRow = this._db.prepare("SELECT COUNT(*) AS cnt FROM session_todos WHERE " + whereClauses).get(...params);
          const total = countRow ? countRow.cnt : 0;
          const rows = this._db.prepare("SELECT * FROM session_todos WHERE " + whereClauses + " ORDER BY id DESC LIMIT ?").all(...params, limit);
          const entries = rows.map((r) => {
            try {
              return JSON.parse(r.data_json);
            } catch {
              return r;
            }
          });
          return { entries, total };
        } catch {
          return null;
        }
      }
      /**
       * Mark a todo as completed.
       *
       * @param {string} cwd - Project root directory
       * @param {number} id - Todo row ID
       * @returns {{ updated: boolean }|null}
       */
      completeSessionTodo(cwd, id) {
        if (this._isMap()) return null;
        try {
          this._stmt(
            "st_complete",
            "UPDATE session_todos SET status='completed', completed_at=? WHERE id=? AND cwd=?"
          ).run((/* @__PURE__ */ new Date()).toISOString(), id, cwd);
          return { updated: true };
        } catch {
          return null;
        }
      }
      /**
       * Insert a blocker row.
       *
       * @param {string} cwd - Project root directory
       * @param {object} blocker - { text, status, created_at }
       * @returns {{ inserted: boolean, id: number }|null}
       */
      writeSessionBlocker(cwd, blocker) {
        if (this._isMap()) return null;
        try {
          const result = this._stmt(
            "sb_ins",
            "INSERT INTO session_blockers (cwd, text, status, created_at, data_json) VALUES (?, ?, ?, ?, ?)"
          ).run(
            cwd,
            blocker.text || "",
            blocker.status || "open",
            blocker.created_at || null,
            JSON.stringify(blocker)
          );
          return { inserted: true, id: result ? result.lastInsertRowid : null };
        } catch {
          return null;
        }
      }
      /**
       * Query session_blockers for cwd.
       *
       * @param {string} cwd - Project root directory
       * @param {{ status?: string, limit?: number }} [options]
       * @returns {{ entries: object[], total: number }|null}
       */
      getSessionBlockers(cwd, options) {
        if (this._isMap()) return null;
        try {
          const opts = options || {};
          const limit = opts.limit != null ? opts.limit : 100;
          let whereClauses = "cwd = ?";
          const params = [cwd];
          if (opts.status) {
            whereClauses += " AND status = ?";
            params.push(opts.status);
          }
          const countRow = this._db.prepare("SELECT COUNT(*) AS cnt FROM session_blockers WHERE " + whereClauses).get(...params);
          const total = countRow ? countRow.cnt : 0;
          const rows = this._db.prepare("SELECT * FROM session_blockers WHERE " + whereClauses + " ORDER BY id DESC LIMIT ?").all(...params, limit);
          const entries = rows.map((r) => {
            try {
              return JSON.parse(r.data_json);
            } catch {
              return r;
            }
          });
          return { entries, total };
        } catch {
          return null;
        }
      }
      /**
       * Mark a blocker as resolved.
       *
       * @param {string} cwd - Project root directory
       * @param {number} id - Blocker row ID
       * @param {string} resolution - Resolution description
       * @returns {{ updated: boolean }|null}
       */
      resolveSessionBlocker(cwd, id, resolution) {
        if (this._isMap()) return null;
        try {
          this._stmt(
            "sb_resolve",
            "UPDATE session_blockers SET status='resolved', resolved_at=?, resolution=? WHERE id=? AND cwd=?"
          ).run((/* @__PURE__ */ new Date()).toISOString(), resolution || null, id, cwd);
          return { updated: true };
        } catch {
          return null;
        }
      }
      /**
       * Upsert session continuity data.
       *
       * @param {string} cwd - Project root directory
       * @param {object} continuity - { last_session, stopped_at, next_step }
       * @returns {{ stored: boolean }|null}
       */
      recordSessionContinuity(cwd, continuity) {
        if (this._isMap()) return null;
        try {
          this._stmt(
            "sc_upsert",
            "INSERT OR REPLACE INTO session_continuity (cwd, last_session, stopped_at, next_step, data_json) VALUES (?, ?, ?, ?, ?)"
          ).run(
            cwd,
            continuity.last_session || null,
            continuity.stopped_at || null,
            continuity.next_step || null,
            JSON.stringify(continuity)
          );
          return { stored: true };
        } catch {
          return null;
        }
      }
      /**
       * Get session_continuity row for cwd.
       *
       * @param {string} cwd - Project root directory
       * @returns {object|null}
       */
      getSessionContinuity(cwd) {
        if (this._isMap()) return null;
        try {
          const row = this._stmt(
            "sc_get",
            "SELECT * FROM session_continuity WHERE cwd = ?"
          ).get(cwd);
          return row || null;
        } catch {
          return null;
        }
      }
    };
    function _extractRequirementsFromPhases2(phases) {
      const requirements = [];
      for (const phase of phases) {
        const section = phase.section || "";
        if (!section) continue;
        const inlineMatch = section.match(/\*\*Requirements?\*\*:\s*([^\n]+)/i);
        if (inlineMatch) {
          const ids = inlineMatch[1].split(/[,\s]+/).filter((id) => /^[A-Z]+-\d+/.test(id));
          for (const id of ids) {
            requirements.push({
              req_id: id,
              phase_number: phase.number || "",
              description: null
            });
          }
        }
        const checkboxPattern = /- \[[ x]\] \*\*([A-Z]+-\d+)\*\*:?\s*([^\n]*)/g;
        let match;
        while ((match = checkboxPattern.exec(section)) !== null) {
          requirements.push({
            req_id: match[1],
            phase_number: phase.number || "",
            description: match[2].trim() || null
          });
        }
      }
      return requirements;
    }
    module.exports = { PlanningCache: PlanningCache2 };
  }
});

// src/lib/questions.js
var require_questions = __commonJS({
  "src/lib/questions.js"(exports, module) {
    var TAXONOMY = {
      BINARY: "BINARY",
      // Yes/No type questions
      SINGLE_CHOICE: "SINGLE_CHOICE",
      // Pick one from options
      MULTI_CHOICE: "MULTI_CHOICE",
      // Pick multiple from options
      RANKING: "RANKING",
      // Order options by preference
      FILTERING: "FILTERING",
      // Filter/categorize items
      EXPLORATION: "EXPLORATION",
      // Open-ended exploration
      CLARIFICATION: "CLARIFICATION"
      // Clarify ambiguous points
    };
    var OPTION_RULES = {
      MIN_OPTIONS: 3,
      MAX_OPTIONS: 5,
      DIVERSITY_DIMENSIONS: ["certainty", "scope", "approach", "priority"],
      FORMATTING_PARITY: true,
      ESCAPE_HATCH: "Something else",
      ESCAPE_HATCH_POSITION: "last"
    };
    var OPTION_TEMPLATES = {
      // Example templates (add more as needed)
      // 'goal-clarity': {
      //   question: 'What level of goal clarity do you need?',
      //   options: [
      //     { id: 'fuzzy', label: 'Fuzzy — direction only', diversity: { certainty: 0.2 } },
      //     { id: 'medium', label: 'Medium — target without deadline', diversity: { certainty: 0.5 } },
      //     { id: 'precise', label: 'Precise — target with deadline', diversity: { certainty: 0.8 } }
      //   ],
      //   toneVariants: {
      //     casual: 'How clear is your goal right now?',
      //     formal: 'What level of goal clarity is required for this phase?'
      //   },
      //   typeHint: 'SINGLE_CHOICE'
      // }
      // discuss-phase workflow templates
      "discuss-context-existing": {
        question: "What would you like to do with the existing context?",
        options: [
          { id: "update", label: "Update it", diversity: { approach: 0.3 } },
          { id: "view", label: "View it", diversity: { approach: 0.6 } },
          { id: "skip", label: "Skip", diversity: { approach: 1 } }
        ],
        typeHint: "SINGLE_CHOICE"
      },
      "discuss-replan-warning": {
        question: "Phase already has plans. How do you want to proceed?",
        options: [
          { id: "continue", label: "Continue and replan after", diversity: { certainty: 0.3 } },
          { id: "view", label: "View existing plans", diversity: { certainty: 0.6 } },
          { id: "cancel", label: "Cancel", diversity: { certainty: 1 } }
        ],
        typeHint: "SINGLE_CHOICE"
      },
      "discuss-gray-areas": {
        question: "How should we handle these ranked gray areas?",
        options: [
          { id: "work-ranked", label: "Work high to low", description: "Resolve High-impact gray areas first, then continue only as far as needed", diversity: { certainty: 0.8 } },
          { id: "review-ranked", label: "Review the ranking", description: "Inspect why each gray area was ranked before we start resolving them", diversity: { certainty: 0.5 } }
        ],
        typeHint: "SINGLE_CHOICE"
      },
      "discuss-low-risk-path": {
        question: "How should we handle these low-risk defaults?",
        options: [
          { id: "lock-defaults", label: "Lock defaults and continue", description: "Accept the proposed defaults, keep them distinct from hard locks, and move on to any remaining gray areas", diversity: { certainty: 0.8 } },
          { id: "discuss-one", label: "Discuss one of them", description: "Pull a proposed default back into the normal clarification loop before locking it", diversity: { certainty: 0.4 } },
          { id: "skip-defaults", label: "Skip defaults", description: "Do not record these yet \u2014 continue with the normal gray-area menu", diversity: { certainty: 0.2 } }
        ],
        typeHint: "SINGLE_CHOICE"
      },
      "discuss-socratic-continue": {
        question: "More questions about this area, or move to next?",
        options: [
          { id: "more", label: "Keep refining", diversity: { certainty: 0.4 } },
          { id: "next", label: "Next area", diversity: { certainty: 0.8 } }
        ],
        typeHint: "SINGLE_CHOICE"
      },
      "discuss-conflict-resolution": {
        question: "How should we handle this tension?",
        options: [
          { id: "lock", label: "Lock a direction", description: "Make this a concrete phase decision now", diversity: { certainty: 0.8 } },
          { id: "default", label: "Use a default", description: "Prefer a default pattern unless a later detail forces an exception", diversity: { approach: 0.6 } },
          { id: "delegate", label: "Agent decides", description: "Leave this to downstream planning or execution within stated constraints", diversity: { approach: 0.4 } },
          { id: "defer", label: "Defer and note it", description: "Record the tradeoff but leave the final choice for a later phase or context", diversity: { scope: 0.2 } }
        ],
        typeHint: "SINGLE_CHOICE"
      },
      "discuss-stress-test-response": {
        question: "Any of those points change your thinking?",
        options: [
          { id: "proceed", label: "No changes \u2014 proceed", diversity: { certainty: 0.8 } },
          { id: "revisit", label: "Changed something \u2014 check knock-on effects", description: "Record the revision and immediately validate downstream gray areas", diversity: { certainty: 0.3 } }
        ],
        typeHint: "SINGLE_CHOICE"
      },
      // execute-phase workflow templates
      "phase-handoff-resume-summary": {
        question: "How should we continue from this handoff?",
        options: [
          { id: "resume", label: "Resume", description: "Continue from the latest valid handoff artifact", diversity: { certainty: 0.8 } },
          { id: "inspect", label: "Inspect", description: "Review the active handoff details before continuing", diversity: { certainty: 0.5 } },
          { id: "restart", label: "Restart", description: "Clear the handoff set and restart from discuss", diversity: { certainty: 0.2 } }
        ],
        typeHint: "SINGLE_CHOICE"
      },
      "execute-checkpoint-verify": {
        question: "Verification result:",
        options: [
          { id: "pass", label: "Pass", diversity: { certainty: 1 } },
          { id: "fail", label: "Fail", diversity: { certainty: 0 } },
          { id: "adjust", label: "Needs adjustment", diversity: { certainty: 0.5 } }
        ],
        typeHint: "SINGLE_CHOICE"
      },
      "execute-checkpoint-retry": {
        question: "How do you want to proceed?",
        options: [
          { id: "retry", label: "Retry", diversity: { certainty: 0.3 } },
          { id: "continue", label: "Continue", diversity: { certainty: 0.7 } },
          { id: "skip", label: "Skip", diversity: { certainty: 1 } }
        ],
        typeHint: "SINGLE_CHOICE"
      },
      "execute-wave-continue": {
        question: "Wave complete \u2014 what next?",
        options: [
          { id: "proceed", label: "Proceed to next wave", diversity: { certainty: 0.8 } },
          { id: "review", label: "Review current wave", diversity: { certainty: 0.5 } },
          { id: "pause", label: "Pause", diversity: { certainty: 0.2 } }
        ],
        typeHint: "SINGLE_CHOICE"
      },
      // plan-phase workflow templates
      "plan-phase-context": {
        question: "How would you like to proceed?",
        options: [
          { id: "continue-without", label: "Continue without context", diversity: { certainty: 0.3 } },
          { id: "discuss-first", label: "Run discuss-phase first", diversity: { certainty: 0.7 } }
        ],
        typeHint: "SINGLE_CHOICE"
      },
      "plan-phase-existing": {
        question: "What would you like to do with existing plans?",
        options: [
          { id: "add-more", label: "Add more plans", diversity: { scope: 0.3 } },
          { id: "view", label: "View existing plans", diversity: { scope: 0.5 } },
          { id: "replan", label: "Replan", diversity: { scope: 0.8 } }
        ],
        typeHint: "SINGLE_CHOICE"
      },
      "plan-phase-high-impact-gray-area": {
        question: "This high-impact gray area will change the plan. How should we handle it?",
        options: [
          { id: "lock", label: "Lock a direction", description: "Decide now so the planner can commit to a concrete structure", diversity: { certainty: 0.8 } },
          { id: "default", label: "Use a default", description: "Adopt the safest default and continue planning with it explicitly recorded", diversity: { certainty: 0.5 } },
          { id: "delegate", label: "Agent decides", description: "Let the planner choose within stated constraints and record that discretion", diversity: { certainty: 0.3 } },
          { id: "defer", label: "Defer and constrain", description: "Keep the choice open, but record the limit so planning does not guess beyond it", diversity: { certainty: 0.2 } }
        ],
        typeHint: "SINGLE_CHOICE"
      },
      "plan-phase-checker-passed": {
        question: "Verification passed. How would you like to proceed?",
        options: [
          { id: "continue", label: "Continue", diversity: { certainty: 0.5 } },
          { id: "view-plans", label: "View plans", diversity: { certainty: 0.7 } }
        ],
        typeHint: "SINGLE_CHOICE"
      },
      "plan-phase-checker-issues": {
        question: "Verification found issues. How would you like to proceed?",
        options: [
          { id: "force", label: "Force continue", diversity: { certainty: 0.3 } },
          { id: "guidance", label: "Get guidance", diversity: { certainty: 0.5 } },
          { id: "abandon", label: "Abandon", diversity: { certainty: 0.9 } }
        ],
        typeHint: "SINGLE_CHOICE"
      },
      // transition workflow templates
      "transition-complete": {
        question: "Ready to mark done and move to next phase?",
        options: [
          { id: "mark-done", label: "Mark done", diversity: { certainty: 0.8 } },
          { id: "cancel", label: "Cancel", diversity: { certainty: 0.2 } }
        ],
        typeHint: "SINGLE_CHOICE"
      },
      "transition-incomplete": {
        question: "What would you like to do with incomplete plans?",
        options: [
          { id: "continue", label: "Continue current phase", diversity: { certainty: 0.3 } },
          { id: "mark-complete", label: "Mark complete anyway", diversity: { certainty: 0.6 } },
          { id: "review", label: "Review what's left", diversity: { certainty: 0.9 } }
        ],
        typeHint: "SINGLE_CHOICE"
      },
      "transition-next-route": {
        question: "What would you like to do next?",
        options: [
          { id: "more-phases", label: "Plan more phases", diversity: { certainty: 0.4 } },
          { id: "milestone-complete", label: "Complete milestone", diversity: { certainty: 0.8 } }
        ],
        typeHint: "SINGLE_CHOICE"
      },
      // verify-work workflow templates
      "verify-session-resume": {
        question: "Which would you like to do?",
        options: [
          { id: "resume", label: "Resume existing session", diversity: { certainty: 0.8 } },
          { id: "start-new", label: "Start new session", diversity: { certainty: 0.6 } }
        ],
        typeHint: "SINGLE_CHOICE"
      },
      "verify-test-response": {
        question: "How did the test go?",
        options: [
          { id: "pass", label: "Pass \u2014 it works as expected", diversity: { certainty: 1 } },
          { id: "fail", label: "Fail \u2014 something is wrong", diversity: { certainty: 0.3 } },
          { id: "skip", label: "Skip \u2014 cannot test right now", diversity: { certainty: 0.5 } }
        ],
        typeHint: "SINGLE_CHOICE"
      },
      "verify-complete-issues": {
        question: "Issues were found. What would you like to do?",
        options: [
          { id: "diagnose", label: "Diagnose issues \u2014 find root causes", diversity: { approach: 0.7 } },
          { id: "next-phase", label: "Suggest next phase \u2014 defer issues", diversity: { approach: 0.4 } }
        ],
        typeHint: "SINGLE_CHOICE"
      },
      "verify-diagnose": {
        question: "How should issues be handled?",
        options: [
          { id: "spawn", label: "Spawn debug agents \u2014 auto-investigate", diversity: { approach: 0.8 } },
          { id: "manual", label: "Manual handling \u2014 I will address", diversity: { approach: 0.3 } }
        ],
        typeHint: "SINGLE_CHOICE"
      },
      // settings workflow templates
      "settings-model-profile": {
        question: "Which model profile for agents?",
        options: [
          { id: "quality", label: "Quality", description: "Opus everywhere except verification (highest cost)", diversity: { certainty: 1 } },
          { id: "balanced", label: "Balanced (Recommended)", description: "Opus for planning, Sonnet for execution/verification", diversity: { certainty: 0.6 } },
          { id: "budget", label: "Budget", description: "Sonnet for writing, Haiku for research/verification (lowest cost)", diversity: { certainty: 0.3 } }
        ],
        typeHint: "SINGLE_CHOICE"
      },
      "settings-plan-researcher": {
        question: "Spawn Plan Researcher? (researches domain before planning)",
        options: [
          { id: "yes", label: "Yes", description: "Research phase goals before planning", diversity: { certainty: 1 } },
          { id: "no", label: "No", description: "Skip research, plan directly", diversity: { certainty: 0 } }
        ],
        typeHint: "BINARY"
      },
      "settings-plan-checker": {
        question: "Spawn Plan Checker? (verifies plans before execution)",
        options: [
          { id: "yes", label: "Yes", description: "Verify plans meet phase goals", diversity: { certainty: 1 } },
          { id: "no", label: "No", description: "Skip plan verification", diversity: { certainty: 0 } }
        ],
        typeHint: "BINARY"
      },
      "settings-execution-verifier": {
        question: "Spawn Execution Verifier? (verifies phase completion)",
        options: [
          { id: "yes", label: "Yes", description: "Verify must-haves after execution", diversity: { certainty: 1 } },
          { id: "no", label: "No", description: "Skip post-execution verification", diversity: { certainty: 0 } }
        ],
        typeHint: "BINARY"
      },
      "settings-auto-advance": {
        question: "Auto-advance pipeline? (discuss \u2192 plan \u2192 execute automatically)",
        options: [
          { id: "no", label: "No (Recommended)", description: "Manual /clear + paste between stages", diversity: { certainty: 0.8 } },
          { id: "yes", label: "Yes", description: "Chain stages via Task() subagents (same isolation)", diversity: { certainty: 0.2 } }
        ],
        typeHint: "BINARY"
      },
      "settings-branching-strategy": {
        question: "Git branching strategy?",
        options: [
          { id: "none", label: "None (Recommended)", description: "Commit directly to current branch", diversity: { certainty: 0.8 } },
          { id: "per-phase", label: "Per Phase", description: "Create branch for each phase (gsd/phase-{N}-{name})", diversity: { certainty: 0.5 } },
          { id: "per-milestone", label: "Per Milestone", description: "Create branch for entire milestone (gsd/{version}-{name})", diversity: { certainty: 0.2 } }
        ],
        typeHint: "SINGLE_CHOICE"
      },
      "settings-save-defaults": {
        question: "Save these as default settings for all new projects?",
        options: [
          { id: "yes", label: "Yes", description: "New projects start with these settings (saved to ~/.gsd/defaults.json)", diversity: { certainty: 1 } },
          { id: "no", label: "No", description: "Only apply to this project", diversity: { certainty: 0 } }
        ],
        typeHint: "BINARY"
      },
      // new-milestone workflow templates
      "new-milestone-goals": {
        question: "What do you want to build next?",
        options: [
          { id: "explore-features", label: "Explore features", diversity: { scope: 0.3 } },
          { id: "explore-priorities", label: "Clarify priorities", diversity: { priority: 0.5 } },
          { id: "explore-constraints", label: "Identify constraints", diversity: { scope: 0.7 } },
          { id: "explore-scope", label: "Discuss scope", diversity: { scope: 0.9 } }
        ],
        typeHint: "EXPLORATION"
      },
      "new-milestone-version": {
        question: "Confirm milestone version?",
        options: [
          { id: "yes", label: "Yes, proceed with suggested version", diversity: { certainty: 1 } },
          { id: "no", label: "No, I want to adjust", diversity: { certainty: 0 } }
        ],
        typeHint: "BINARY"
      },
      "new-milestone-research": {
        question: "Research the domain ecosystem for new features before defining requirements?",
        options: [
          { id: "research-first", label: "Research first (Recommended)", diversity: { scope: 0.8 } },
          { id: "skip-research", label: "Skip research", diversity: { scope: 0.2 } }
        ],
        typeHint: "SINGLE_CHOICE"
      },
      "new-milestone-skills": {
        question: "Install recommended project-local skills before defining requirements?",
        options: [
          { id: "yes", label: "Yes", diversity: { certainty: 1 } },
          { id: "no", label: "No", diversity: { certainty: 0 } }
        ],
        typeHint: "BINARY"
      },
      "new-milestone-scope-category": {
        question: "Select categories to scope for this milestone",
        options: [
          { id: "category-1", label: "Category 1", diversity: { scope: 0.2 } },
          { id: "category-2", label: "Category 2", diversity: { scope: 0.4 } },
          { id: "category-3", label: "Category 3", diversity: { scope: 0.6 } },
          { id: "none", label: "None for this milestone", diversity: { scope: 1 } }
        ],
        typeHint: "MULTI_CHOICE"
      },
      // check-todos workflow templates
      "check-todos-roadmap-action": {
        question: "This todo relates to Phase [N]: [name]. What would you like to do?",
        options: [
          { id: "work-now", label: "Work on it now", diversity: { certainty: 1 } },
          { id: "add-to-plan", label: "Add to phase plan", diversity: { certainty: 0.7 } },
          { id: "brainstorm", label: "Brainstorm approach", diversity: { certainty: 0.4 } },
          { id: "put-back", label: "Put it back", diversity: { certainty: 0.2 } }
        ],
        typeHint: "SINGLE_CHOICE"
      },
      "check-todos-general-action": {
        question: "What would you like to do with this todo?",
        options: [
          { id: "work-now", label: "Work on it now", diversity: { certainty: 1 } },
          { id: "create-phase", label: "Create a phase", diversity: { certainty: 0.7 } },
          { id: "brainstorm", label: "Brainstorm approach", diversity: { certainty: 0.4 } },
          { id: "put-back", label: "Put it back", diversity: { certainty: 0.2 } }
        ],
        typeHint: "SINGLE_CHOICE"
      },
      // add-todo workflow templates
      "add-todo-duplicate-action": {
        question: "Similar todo exists: [title]. What would you like to do?",
        options: [
          { id: "skip", label: "Skip", diversity: { certainty: 0.8 } },
          { id: "replace", label: "Replace", diversity: { certainty: 0.5 } },
          { id: "add-anyway", label: "Add anyway", diversity: { certainty: 0.2 } }
        ],
        typeHint: "SINGLE_CHOICE"
      },
      // update workflow templates
      "update-proceed": {
        question: "Proceed with update?",
        options: [
          { id: "yes", label: "Yes, update now", diversity: { certainty: 1 } },
          { id: "no", label: "No, cancel", diversity: { certainty: 0 } }
        ],
        typeHint: "BINARY"
      },
      // cleanup workflow templates
      "cleanup-proceed": {
        question: "Proceed with archiving?",
        options: [
          { id: "yes", label: "Yes \u2014 archive listed phases", diversity: { certainty: 1 } },
          { id: "cancel", label: "Cancel", diversity: { certainty: 0 } }
        ],
        typeHint: "BINARY"
      },
      // complete-milestone workflow templates
      "complete-milestone-push": {
        question: "Push to remote?",
        options: [
          { id: "yes", label: "Yes", diversity: { certainty: 1 } },
          { id: "no", label: "No", diversity: { certainty: 0 } }
        ],
        typeHint: "BINARY"
      }
    };
    function getQuestionTemplate(id, context = {}) {
      const template = OPTION_TEMPLATES[id];
      if (!template) {
        return null;
      }
      const tone = context.tone || "formal";
      let questionText = template.question;
      if (template.toneVariants && template.toneVariants[tone]) {
        questionText = template.toneVariants[tone];
      }
      const escapeHatch = buildEscapeHatch(template.options);
      return {
        question: questionText,
        options: template.options,
        escapeHatch,
        typeHint: template.typeHint || null
      };
    }
    function buildEscapeHatch(options) {
      const position = OPTION_RULES.ESCAPE_HATCH_POSITION;
      const base = {
        id: "escape-hatch",
        label: OPTION_RULES.ESCAPE_HATCH,
        isEscapeHatch: true
      };
      if (position === "last") {
        return base;
      } else if (position === "first") {
        return { ...base, position: "first" };
      }
      return base;
    }
    function generateRuntimeOptions(type, context = {}) {
      const count = context.count || OPTION_RULES.MIN_OPTIONS;
      const includeEscapeHatch = context.includeEscapeHatch !== false;
      const targetCount = includeEscapeHatch ? count - 1 : count;
      const constrainedCount = Math.min(
        Math.max(targetCount, OPTION_RULES.MIN_OPTIONS),
        includeEscapeHatch ? OPTION_RULES.MAX_OPTIONS - 1 : OPTION_RULES.MAX_OPTIONS
      );
      const optionGenerators = {
        [TAXONOMY.BINARY]: (ctx) => [
          { id: "yes", label: "Yes", diversity: { certainty: 1 } },
          { id: "no", label: "No", diversity: { certainty: 0 } }
        ],
        [TAXONOMY.SINGLE_CHOICE]: generateSingleChoiceOptions,
        [TAXONOMY.MULTI_CHOICE]: generateMultiChoiceOptions,
        [TAXONOMY.RANKING]: generateRankingOptions,
        [TAXONOMY.FILTERING]: generateFilteringOptions,
        [TAXONOMY.EXPLORATION]: generateExplorationOptions,
        [TAXONOMY.CLARIFICATION]: generateClarificationOptions
      };
      const generator = optionGenerators[type];
      if (!generator) {
        return [];
      }
      let options = generator(constrainedCount, context);
      if (context.diversityNeeds && Array.isArray(context.diversityNeeds)) {
        options = applyDiversityConstraints(options, context.diversityNeeds);
      }
      if (includeEscapeHatch) {
        const escapeHatch = buildEscapeHatch(options);
        if (OPTION_RULES.ESCAPE_HATCH_POSITION === "last") {
          options.push(escapeHatch);
        } else {
          options.unshift(escapeHatch);
        }
      }
      return options;
    }
    function generateSingleChoiceOptions(count, context) {
      const certainty = context.certainty || 0.5;
      const options = [];
      for (let i = 0; i < count; i++) {
        const level = (i + 1) / count;
        options.push({
          id: `option-${i}`,
          label: `Option ${i + 1}`,
          diversity: { certainty: level }
        });
      }
      return options;
    }
    function generateMultiChoiceOptions(count, context) {
      const options = [];
      const dimensions = OPTION_RULES.DIVERSITY_DIMENSIONS;
      for (let i = 0; i < count; i++) {
        const dim = dimensions[i % dimensions.length];
        options.push({
          id: `option-${i}`,
          label: `Option ${i + 1}`,
          diversity: { [dim]: (i + 1) / count }
        });
      }
      return options;
    }
    function generateRankingOptions(count, context) {
      const options = [];
      for (let i = 0; i < count; i++) {
        options.push({
          id: `rank-${i}`,
          label: `Rank ${i + 1}`,
          rank: i + 1,
          diversity: { priority: (i + 1) / count }
        });
      }
      return options;
    }
    function generateFilteringOptions(count, context) {
      const options = [];
      const categories = context.categories || ["Include", "Exclude", "Maybe"];
      for (let i = 0; i < Math.min(count, categories.length); i++) {
        options.push({
          id: `filter-${i}`,
          label: categories[i],
          diversity: { scope: (i + 1) / categories.length }
        });
      }
      return options;
    }
    function generateExplorationOptions(count, context) {
      const explorationTypes = [
        { id: "explore-constraints", label: "Identify constraints", diversity: { scope: 0.3 } },
        { id: "explore-risks", label: "Explore risks", diversity: { certainty: 0.4 } },
        { id: "explore-alternatives", label: "Consider alternatives", diversity: { approach: 0.5 } },
        { id: "explore-priorities", label: "Clarify priorities", diversity: { priority: 0.6 } },
        { id: "explore-stakeholders", label: "Understand stakeholders", diversity: { scope: 0.7 } }
      ];
      return explorationTypes.slice(0, count);
    }
    function generateClarificationOptions(count, context) {
      const clarificationTypes = [
        { id: "clarify-goal", label: "Clarify the goal", diversity: { certainty: 0.3 } },
        { id: "clarify-scope", label: "Clarify scope", diversity: { scope: 0.4 } },
        { id: "clarify-approach", label: "Clarify approach", diversity: { approach: 0.5 } },
        { id: "clarify-timeline", label: "Clarify timeline", diversity: { priority: 0.6 } }
      ];
      return clarificationTypes.slice(0, count);
    }
    function applyDiversityConstraints(options, diversityNeeds) {
      const dimensions = OPTION_RULES.DIVERSITY_DIMENSIONS;
      const coveredDimensions = /* @__PURE__ */ new Set();
      options.forEach((option) => {
        if (option.diversity) {
          Object.keys(option.diversity).forEach((dim) => {
            coveredDimensions.add(dim);
          });
        }
      });
      return options;
    }
    module.exports = {
      TAXONOMY,
      OPTION_RULES,
      OPTION_TEMPLATES,
      getQuestionTemplate,
      generateRuntimeOptions
    };
  }
});

// src/lib/decision-rules.js
var require_decision_rules = __commonJS({
  "src/lib/decision-rules.js"(exports, module) {
    function resolveContextGate(state) {
      const present = Boolean(state && state.context_present);
      return { value: present, confidence: "HIGH", rule_id: "context-gate" };
    }
    function resolveProgressRoute(state) {
      const {
        plan_count = 0,
        summary_count = 0,
        uat_gap_count = 0,
        current_phase,
        highest_phase,
        roadmap_exists = false,
        project_exists = false,
        state_exists = false
      } = state || {};
      if (!state_exists && !roadmap_exists && !project_exists) {
        return { value: "no-project", confidence: "HIGH", rule_id: "progress-route" };
      }
      if (!state_exists) {
        return { value: "no-state", confidence: "HIGH", rule_id: "progress-route" };
      }
      if (!roadmap_exists && project_exists) {
        return { value: "F", confidence: "HIGH", rule_id: "progress-route" };
      }
      if (uat_gap_count > 0) {
        return { value: "E", confidence: "HIGH", rule_id: "progress-route" };
      }
      if (summary_count < plan_count) {
        return { value: "A", confidence: "HIGH", rule_id: "progress-route" };
      }
      if (summary_count === plan_count && plan_count > 0) {
        return current_phase < highest_phase ? { value: "C", confidence: "HIGH", rule_id: "progress-route" } : { value: "D", confidence: "HIGH", rule_id: "progress-route" };
      }
      if (plan_count === 0) {
        return { value: "B", confidence: "HIGH", rule_id: "progress-route" };
      }
      return { value: "F", confidence: "MEDIUM", rule_id: "progress-route" };
    }
    function resolveResumeRoute(state) {
      const {
        has_state = false,
        has_roadmap = false,
        has_plans = false,
        has_incomplete_plans = false,
        has_blockers = false,
        phase_complete = false
      } = state || {};
      if (!has_state) {
        return { value: "initialize", confidence: "HIGH", rule_id: "resume-route" };
      }
      if (has_blockers) {
        return { value: "resolve-blockers", confidence: "HIGH", rule_id: "resume-route" };
      }
      if (has_incomplete_plans) {
        return { value: "continue-execution", confidence: "HIGH", rule_id: "resume-route" };
      }
      if (phase_complete && has_roadmap) {
        return { value: "next-phase", confidence: "HIGH", rule_id: "resume-route" };
      }
      if (has_plans && !has_incomplete_plans) {
        return { value: "verify-or-advance", confidence: "MEDIUM", rule_id: "resume-route" };
      }
      if (!has_plans && has_roadmap) {
        return { value: "plan-phase", confidence: "HIGH", rule_id: "resume-route" };
      }
      return { value: "review-state", confidence: "MEDIUM", rule_id: "resume-route" };
    }
    function resolveExecutionPattern(state) {
      const { task_types = [] } = state || {};
      const hasDecisionCheckpoints = task_types.some(
        (t) => typeof t === "string" && t.startsWith("checkpoint:decision")
      );
      const hasOtherCheckpoints = task_types.some(
        (t) => typeof t === "string" && t.startsWith("checkpoint:") && !t.startsWith("checkpoint:decision")
      );
      if (hasDecisionCheckpoints) {
        return { value: "C", confidence: "HIGH", rule_id: "execution-pattern" };
      }
      if (hasOtherCheckpoints) {
        return { value: "B", confidence: "HIGH", rule_id: "execution-pattern" };
      }
      return { value: "A", confidence: "HIGH", rule_id: "execution-pattern" };
    }
    function resolveContextBudgetGate(state) {
      const { warning = false, mode = "interactive" } = state || {};
      if (!warning) {
        return { value: "proceed", confidence: "HIGH", rule_id: "context-budget-gate" };
      }
      if (mode === "yolo") {
        return { value: "warn", confidence: "HIGH", rule_id: "context-budget-gate" };
      }
      return { value: "stop", confidence: "HIGH", rule_id: "context-budget-gate" };
    }
    function resolvePreviousCheckGate(state) {
      const {
        has_previous_summary = false,
        has_unresolved_issues = false,
        has_blockers = false
      } = state || {};
      if (!has_previous_summary) {
        return { value: "proceed", confidence: "HIGH", rule_id: "previous-check-gate" };
      }
      if (has_blockers) {
        return { value: "block", confidence: "HIGH", rule_id: "previous-check-gate" };
      }
      if (has_unresolved_issues) {
        return { value: "warn", confidence: "HIGH", rule_id: "previous-check-gate" };
      }
      return { value: "proceed", confidence: "HIGH", rule_id: "previous-check-gate" };
    }
    function resolveCiGate(state) {
      const {
        ci_enabled = false,
        has_test_command = false,
        tests_passing = true
      } = state || {};
      if (!ci_enabled) {
        return { value: "skip", confidence: "HIGH", rule_id: "ci-gate" };
      }
      if (!has_test_command) {
        return { value: "warn", confidence: "HIGH", rule_id: "ci-gate" };
      }
      if (!tests_passing) {
        return { value: "warn", confidence: "HIGH", rule_id: "ci-gate" };
      }
      return { value: "run", confidence: "HIGH", rule_id: "ci-gate" };
    }
    function resolvePlanExistenceRoute(state) {
      const {
        plan_count = 0,
        has_research = false,
        has_context = false,
        deps_complete,
        has_blockers
      } = state || {};
      if (plan_count > 0) {
        if (has_blockers) {
          return { value: "blocked-deps", confidence: "HIGH", rule_id: "plan-existence-route" };
        }
        if (deps_complete === false) {
          return { value: "blocked-deps", confidence: "HIGH", rule_id: "plan-existence-route" };
        }
        if (has_context) {
          return { value: "ready", confidence: "HIGH", rule_id: "plan-existence-route" };
        }
        return { value: "has-plans", confidence: "HIGH", rule_id: "plan-existence-route" };
      }
      if (!has_context && !has_research) {
        return { value: "missing-context", confidence: "HIGH", rule_id: "plan-existence-route" };
      }
      if (has_research || has_context) {
        return { value: "needs-planning", confidence: "HIGH", rule_id: "plan-existence-route" };
      }
      return { value: "needs-research", confidence: "HIGH", rule_id: "plan-existence-route" };
    }
    function resolveBranchHandling(state) {
      const {
        branching_strategy = "none",
        has_branch = false,
        branch_behind = false
      } = state || {};
      if (branching_strategy === "none") {
        return { value: "skip", confidence: "HIGH", rule_id: "branch-handling" };
      }
      if (!has_branch) {
        return { value: "create", confidence: "MEDIUM", rule_id: "branch-handling" };
      }
      if (branch_behind) {
        return { value: "update", confidence: "MEDIUM", rule_id: "branch-handling" };
      }
      return { value: "use-existing", confidence: "MEDIUM", rule_id: "branch-handling" };
    }
    function resolveAutoAdvance(state) {
      const {
        auto_advance_config = false,
        auto_flag = false
      } = state || {};
      const shouldAdvance = Boolean(auto_advance_config || auto_flag);
      return { value: shouldAdvance, confidence: "HIGH", rule_id: "auto-advance" };
    }
    function resolvePhaseArgParse(state) {
      const { raw_arg } = state || {};
      if (raw_arg === void 0 || raw_arg === null || raw_arg === "") {
        return { value: null, confidence: "HIGH", rule_id: "phase-arg-parse" };
      }
      const str = String(raw_arg).trim();
      const match = str.match(/^(?:phase\s+)?(\d+(?:\.\d+)?)/i);
      if (match) {
        const num = parseFloat(match[1]);
        if (!isNaN(num) && num > 0) {
          return { value: num, confidence: "HIGH", rule_id: "phase-arg-parse" };
        }
      }
      return { value: null, confidence: "HIGH", rule_id: "phase-arg-parse" };
    }
    function resolveDebugHandlerRoute(state) {
      const { return_type } = state || {};
      if (!return_type || typeof return_type !== "string") {
        return { value: "manual", confidence: "MEDIUM", rule_id: "debug-handler-route" };
      }
      const type = return_type.toLowerCase();
      if (type === "fix" || type === "auto-fix") {
        return { value: "fix", confidence: "MEDIUM", rule_id: "debug-handler-route" };
      }
      if (type === "plan" || type === "needs-plan") {
        return { value: "plan", confidence: "MEDIUM", rule_id: "debug-handler-route" };
      }
      if (type === "continue" || type === "resolved") {
        return { value: "continue", confidence: "MEDIUM", rule_id: "debug-handler-route" };
      }
      return { value: "manual", confidence: "MEDIUM", rule_id: "debug-handler-route" };
    }
    function resolveModelSelection(state) {
      const {
        agent_type,
        model_profile = "balanced",
        db
      } = state || {};
      if (db && agent_type) {
        try {
          const { PlanningCache: PlanningCache2 } = require_planning_cache();
          const cache = new PlanningCache2(db);
          const profile = cache.getModelProfile(process.cwd(), agent_type);
          if (profile) {
            if (profile.override_model) {
              return { value: { tier: model_profile, model: profile.override_model }, confidence: "HIGH", rule_id: "model-selection" };
            }
            const tierKey = model_profile + "_model";
            if (profile[tierKey]) {
              return { value: { tier: model_profile, model: profile[tierKey] }, confidence: "HIGH", rule_id: "model-selection" };
            }
          }
        } catch {
        }
      }
      const { MODEL_PROFILES } = require_constants();
      if (agent_type && MODEL_PROFILES[agent_type]) {
        const agentProfile = MODEL_PROFILES[agent_type];
        const model = agentProfile[model_profile] || agentProfile.balanced || "sonnet";
        return { value: { tier: model_profile, model }, confidence: "HIGH", rule_id: "model-selection" };
      }
      return { value: { tier: model_profile, model: "sonnet" }, confidence: "HIGH", rule_id: "model-selection" };
    }
    function resolveVerificationRouting(state) {
      const {
        task_count = 0,
        files_modified_count = 0,
        has_test_command = true,
        verifier_enabled = true
      } = state || {};
      if (!verifier_enabled) {
        return { value: "skip", confidence: "HIGH", rule_id: "verification-routing" };
      }
      if (task_count <= 2 && files_modified_count <= 4) {
        return { value: "light", confidence: "HIGH", rule_id: "verification-routing" };
      }
      return { value: "full", confidence: "HIGH", rule_id: "verification-routing" };
    }
    function resolveResearchGate(state) {
      const {
        research_enabled = true,
        has_research = false,
        has_context = false,
        phase_has_external_deps = false
      } = state || {};
      if (!research_enabled) {
        return { value: { run: false, depth: null }, confidence: "HIGH", rule_id: "research-gate" };
      }
      if (has_research) {
        return { value: { run: false, depth: null }, confidence: "HIGH", rule_id: "research-gate" };
      }
      if (phase_has_external_deps) {
        return { value: { run: true, depth: "deep" }, confidence: "HIGH", rule_id: "research-gate" };
      }
      if (!has_context) {
        return { value: { run: true, depth: "quick" }, confidence: "HIGH", rule_id: "research-gate" };
      }
      return { value: { run: false, depth: null }, confidence: "HIGH", rule_id: "research-gate" };
    }
    function resolveMilestoneCompletion(state) {
      const {
        phases_total = 0,
        phases_complete = 0,
        has_incomplete_plans = false,
        milestone_name
      } = state || {};
      if (phases_complete === phases_total && !has_incomplete_plans) {
        return { value: { ready: true, action: "complete" }, confidence: "HIGH", rule_id: "milestone-completion" };
      }
      if (phases_complete === phases_total - 1) {
        return { value: { ready: false, action: "finish-last-phase" }, confidence: "HIGH", rule_id: "milestone-completion" };
      }
      return { value: { ready: false, action: "continue" }, confidence: "HIGH", rule_id: "milestone-completion" };
    }
    function resolveCommitStrategy(state) {
      const {
        task_count = 0,
        plan_type = "",
        files_modified_count = 0,
        is_tdd = false
      } = state || {};
      let granularity;
      if (is_tdd) {
        granularity = "per-phase";
      } else if (task_count <= 1) {
        granularity = "per-plan";
      } else {
        granularity = "per-task";
      }
      let prefix;
      let confidence = "HIGH";
      if (plan_type === "tdd") {
        prefix = "test";
      } else if (files_modified_count === 0) {
        prefix = "docs";
      } else {
        prefix = "feat";
        confidence = "MEDIUM";
      }
      return { value: { granularity, prefix }, confidence, rule_id: "commit-strategy" };
    }
    var DECISION_REGISTRY = [
      {
        id: "context-gate",
        name: "Context Gate Check",
        category: "state-assessment",
        description: "Checks if bgsd-context is present (enricher loaded)",
        inputs: ["context_present"],
        outputs: ["boolean"],
        confidence_range: ["HIGH"],
        resolve: resolveContextGate
      },
      {
        id: "progress-route",
        name: "Progress Workflow Route Selection",
        category: "workflow-routing",
        description: "Determines which route (A-F) the progress workflow should take",
        inputs: ["plan_count", "summary_count", "uat_gap_count", "current_phase", "highest_phase", "roadmap_exists", "project_exists", "state_exists"],
        outputs: ["route_letter"],
        confidence_range: ["HIGH", "MEDIUM"],
        resolve: resolveProgressRoute
      },
      {
        id: "resume-route",
        name: "Resume Project Next-Action",
        category: "workflow-routing",
        description: "Determines the next action when resuming a project",
        inputs: ["has_state", "has_roadmap", "has_plans", "has_incomplete_plans", "has_blockers", "phase_complete"],
        outputs: ["action_string"],
        confidence_range: ["HIGH", "MEDIUM"],
        resolve: resolveResumeRoute
      },
      {
        id: "execution-pattern",
        name: "Execution Pattern Selection",
        category: "execution-mode",
        description: "Determines execute-plan Pattern A/B/C based on task types",
        inputs: ["task_types"],
        outputs: ["pattern_letter"],
        confidence_range: ["HIGH"],
        resolve: resolveExecutionPattern
      },
      {
        id: "context-budget-gate",
        name: "Context Budget Warning Gate",
        category: "state-assessment",
        description: "Checks if plan execution should proceed based on context budget",
        inputs: ["warning", "mode"],
        outputs: ["proceed_warn_stop"],
        confidence_range: ["HIGH"],
        resolve: resolveContextBudgetGate
      },
      {
        id: "previous-check-gate",
        name: "Previous Summary Blocker Check",
        category: "state-assessment",
        description: "Checks if previous SUMMARY has unresolved issues or blockers",
        inputs: ["has_previous_summary", "has_unresolved_issues", "has_blockers"],
        outputs: ["proceed_warn_block"],
        confidence_range: ["HIGH"],
        resolve: resolvePreviousCheckGate
      },
      {
        id: "ci-gate",
        name: "CI Quality Gate Check",
        category: "execution-mode",
        description: "Determines whether to run CI, skip, or warn about configuration",
        inputs: ["ci_enabled", "has_test_command", "tests_passing"],
        outputs: ["run_skip_warn"],
        confidence_range: ["HIGH"],
        resolve: resolveCiGate
      },
      {
        id: "plan-existence-route",
        name: "Plan Existence Route",
        category: "workflow-routing",
        description: "Determines if a phase has plans or needs planning/research (extended: blocked-deps, ready, missing-context)",
        inputs: ["plan_count", "has_research", "has_context", "deps_complete", "has_blockers"],
        outputs: ["routing_advice"],
        confidence_range: ["HIGH"],
        resolve: resolvePlanExistenceRoute
      },
      {
        id: "branch-handling",
        name: "Branch Merge Strategy",
        category: "configuration",
        description: "Determines branch handling strategy based on config and state",
        inputs: ["branching_strategy", "has_branch", "branch_behind"],
        outputs: ["strategy"],
        confidence_range: ["HIGH", "MEDIUM"],
        resolve: resolveBranchHandling
      },
      {
        id: "auto-advance",
        name: "Auto-Advance Config Check",
        category: "configuration",
        description: "Determines if plan should auto-advance to next plan after completion",
        inputs: ["auto_advance_config", "auto_flag"],
        outputs: ["boolean"],
        confidence_range: ["HIGH"],
        resolve: resolveAutoAdvance
      },
      {
        id: "phase-arg-parse",
        name: "Phase Argument Parser",
        category: "argument-parsing",
        description: "Parses a raw argument string into a phase number",
        inputs: ["raw_arg"],
        outputs: ["number_or_null"],
        confidence_range: ["HIGH"],
        resolve: resolvePhaseArgParse
      },
      {
        id: "debug-handler-route",
        name: "Debug Return Handler Route",
        category: "workflow-routing",
        description: "Determines action based on debug return type (fix/plan/manual/continue)",
        inputs: ["return_type"],
        outputs: ["action_string"],
        confidence_range: ["MEDIUM"],
        resolve: resolveDebugHandlerRoute
      },
      // Phase 122: New rules
      {
        id: "model-selection",
        name: "Model Selection",
        category: "configuration",
        description: "Resolves concrete model string for an agent type and tier, SQLite-backed with static fallback",
        inputs: ["agent_type", "model_profile", "db"],
        outputs: ["{ tier, model }"],
        confidence_range: ["HIGH"],
        resolve: resolveModelSelection
      },
      {
        id: "verification-routing",
        name: "Verification Routing",
        category: "workflow-routing",
        description: "Determines full, light, or skip verification based on plan complexity",
        inputs: ["task_count", "files_modified_count", "has_test_command", "verifier_enabled"],
        outputs: ["full|light|skip"],
        confidence_range: ["HIGH"],
        resolve: resolveVerificationRouting
      },
      {
        id: "research-gate",
        name: "Research Gate",
        category: "workflow-routing",
        description: "Determines if research should run and at what depth (deep/quick)",
        inputs: ["research_enabled", "has_research", "has_context", "phase_has_external_deps"],
        outputs: ["{ run, depth }"],
        confidence_range: ["HIGH"],
        resolve: resolveResearchGate
      },
      {
        id: "milestone-completion",
        name: "Milestone Completion Check",
        category: "state-assessment",
        description: "Determines milestone completion readiness and next action",
        inputs: ["phases_total", "phases_complete", "has_incomplete_plans", "milestone_name"],
        outputs: ["{ ready, action }"],
        confidence_range: ["HIGH"],
        resolve: resolveMilestoneCompletion
      },
      {
        id: "commit-strategy",
        name: "Commit Strategy",
        category: "execution-mode",
        description: "Determines commit granularity (per-task/per-plan/per-phase) and prefix (feat/test/docs)",
        inputs: ["task_count", "plan_type", "files_modified_count", "is_tdd"],
        outputs: ["{ granularity, prefix }"],
        confidence_range: ["HIGH", "MEDIUM"],
        resolve: resolveCommitStrategy
      },
      // Phase 141: Question taxonomy decision functions
      {
        id: "resolve-question-type",
        name: "Question Type Resolution",
        category: "question-routing",
        description: "Determines TAXONOMY type for a workflow step",
        inputs: ["workflow_id", "step_id"],
        outputs: ["TAXONOMY enum value"],
        confidence_range: ["HIGH"],
        resolve: resolveQuestionType
      },
      {
        id: "resolve-option-generation",
        name: "Option Generation Strategy",
        category: "question-routing",
        description: "Determines pre-authored vs runtime generation approach",
        inputs: ["questionType", "context"],
        outputs: ["pre-authored" | "runtime"],
        confidence_range: ["HIGH"],
        resolve: resolveOptionGeneration
      },
      // Phase 127: Tool routing decision functions
      {
        id: "file-discovery-mode",
        name: "File Discovery Mode",
        category: "tool-routing",
        description: "Recommends file discovery tool (fd vs node) based on tool availability and task scope",
        inputs: ["tool_availability", "scope"],
        outputs: ["fd|node"],
        confidence_range: ["HIGH"],
        resolve: resolveFileDiscoveryMode
      },
      {
        id: "search-mode",
        name: "Search Mode",
        category: "tool-routing",
        description: "Recommends search tool (ripgrep vs fd vs node) based on tool availability and .gitignore requirements",
        inputs: ["tool_availability", "needs_gitignore_respect"],
        outputs: ["ripgrep|fd|node"],
        confidence_range: ["HIGH"],
        resolve: resolveSearchMode
      },
      {
        id: "structural-search-mode",
        name: "Structural Search Mode",
        category: "tool-routing",
        description: "Recommends syntax-aware search tool (ast-grep vs ripgrep vs node) based on tool availability",
        inputs: ["tool_availability"],
        outputs: ["ast-grep|ripgrep|node"],
        confidence_range: ["HIGH"],
        resolve: resolveStructuralSearchMode
      },
      {
        id: "json-transform-mode",
        name: "JSON Transform Mode",
        category: "tool-routing",
        description: "Recommends JSON transform tool (jq vs node) based on tool availability",
        inputs: ["tool_availability"],
        outputs: ["jq|node"],
        confidence_range: ["HIGH"],
        resolve: resolveJsonTransformMode
      },
      {
        id: "yaml-transform-mode",
        name: "YAML Transform Mode",
        category: "tool-routing",
        description: "Recommends YAML transform tool (yq vs node) based on tool availability",
        inputs: ["tool_availability"],
        outputs: ["yq|node"],
        confidence_range: ["HIGH"],
        resolve: resolveYamlTransformMode
      },
      {
        id: "text-replace-mode",
        name: "Text Replace Mode",
        category: "tool-routing",
        description: "Recommends text replacement tool (sd vs node) based on tool availability",
        inputs: ["tool_availability"],
        outputs: ["sd|node"],
        confidence_range: ["HIGH"],
        resolve: resolveTextReplaceMode
      },
      {
        id: "benchmark-mode",
        name: "Benchmark Mode",
        category: "tool-routing",
        description: "Recommends benchmark tool (hyperfine vs node) based on tool availability",
        inputs: ["tool_availability"],
        outputs: ["hyperfine|node"],
        confidence_range: ["HIGH"],
        resolve: resolveBenchmarkMode
      }
    ];
    var { TAXONOMY, OPTION_TEMPLATES } = require_questions();
    function resolveQuestionType(state) {
      const { workflow_id, step_id } = state || {};
      const questionTypeMap = {
        "discuss-phase:gray-areas": TAXONOMY.MULTI_CHOICE,
        "discuss-phase:conflict-resolution": TAXONOMY.CLARIFICATION,
        "discuss-phase:continue": TAXONOMY.SINGLE_CHOICE,
        "discuss-phase:stress-test-response": TAXONOMY.SINGLE_CHOICE,
        "new-milestone:goal-type": TAXONOMY.SINGLE_CHOICE,
        "new-milestone:priority-set": TAXONOMY.RANKING,
        "new-milestone:constraint-add": TAXONOMY.FILTERING,
        "plan-phase:task-breakdown": TAXONOMY.MULTI_CHOICE,
        "plan-phase:dependency-add": TAXONOMY.FILTERING,
        "plan-phase:priority-order": TAXONOMY.RANKING,
        "verify-work:criteria-select": TAXONOMY.MULTI_CHOICE,
        "verify-work:pass-fail": TAXONOMY.BINARY,
        "execute-phase:tool-select": TAXONOMY.SINGLE_CHOICE,
        "execute-phase:parallel-tasks": TAXONOMY.MULTI_CHOICE,
        "transition:direction-select": TAXONOMY.SINGLE_CHOICE,
        "transition:risk-assess": TAXONOMY.FILTERING
      };
      const key = `${workflow_id}:${step_id}`;
      const type = questionTypeMap[key];
      if (type) {
        return { value: type, confidence: "HIGH", rule_id: "resolve-question-type" };
      }
      return { value: TAXONOMY.SINGLE_CHOICE, confidence: "HIGH", rule_id: "resolve-question-type" };
    }
    function resolveOptionGeneration(state) {
      const { questionType, context = {} } = state || {};
      if (!questionType) {
        return { value: "runtime", confidence: "HIGH", rule_id: "resolve-option-generation" };
      }
      const templateId = context.templateId || questionType.toLowerCase();
      const template = OPTION_TEMPLATES[templateId];
      if (template) {
        return { value: "pre-authored", confidence: "HIGH", rule_id: "resolve-option-generation" };
      }
      return { value: "runtime", confidence: "HIGH", rule_id: "resolve-option-generation" };
    }
    function resolveFileDiscoveryMode(state) {
      const { tool_availability = {}, scope } = state || {};
      if (scope === "single-file") {
        return { value: "node", confidence: "HIGH", rule_id: "file-discovery-mode" };
      }
      if (tool_availability.fd === true) {
        return { value: "fd", confidence: "HIGH", rule_id: "file-discovery-mode" };
      }
      return { value: "node", confidence: "HIGH", rule_id: "file-discovery-mode" };
    }
    function resolveSearchMode(state) {
      const { tool_availability = {}, needs_gitignore_respect = true } = state || {};
      if (tool_availability.ripgrep === true) {
        return { value: "ripgrep", confidence: "HIGH", rule_id: "search-mode" };
      }
      if (tool_availability.fd === true && needs_gitignore_respect) {
        return { value: "fd", confidence: "HIGH", rule_id: "search-mode" };
      }
      return { value: "node", confidence: "HIGH", rule_id: "search-mode" };
    }
    function resolveStructuralSearchMode(state) {
      const { tool_availability = {} } = state || {};
      if (tool_availability.ast_grep === true) {
        return { value: "ast-grep", confidence: "HIGH", rule_id: "structural-search-mode" };
      }
      if (tool_availability.ripgrep === true) {
        return { value: "ripgrep", confidence: "HIGH", rule_id: "structural-search-mode" };
      }
      return { value: "node", confidence: "HIGH", rule_id: "structural-search-mode" };
    }
    function resolveJsonTransformMode(state) {
      const { tool_availability = {} } = state || {};
      if (tool_availability.jq === true) {
        return { value: "jq", confidence: "HIGH", rule_id: "json-transform-mode" };
      }
      return { value: "node", confidence: "HIGH", rule_id: "json-transform-mode" };
    }
    function resolveYamlTransformMode(state) {
      const { tool_availability = {} } = state || {};
      if (tool_availability.yq === true) {
        return { value: "yq", confidence: "HIGH", rule_id: "yaml-transform-mode" };
      }
      return { value: "node", confidence: "HIGH", rule_id: "yaml-transform-mode" };
    }
    function resolveTextReplaceMode(state) {
      const { tool_availability = {} } = state || {};
      if (tool_availability.sd === true) {
        return { value: "sd", confidence: "HIGH", rule_id: "text-replace-mode" };
      }
      return { value: "node", confidence: "HIGH", rule_id: "text-replace-mode" };
    }
    function resolveBenchmarkMode(state) {
      const { tool_availability = {} } = state || {};
      if (tool_availability.hyperfine === true) {
        return { value: "hyperfine", confidence: "HIGH", rule_id: "benchmark-mode" };
      }
      return { value: "node", confidence: "HIGH", rule_id: "benchmark-mode" };
    }
    function evaluateDecisions2(command, state) {
      if (!state || typeof state !== "object") return {};
      const results = {};
      const stateKeys = new Set(Object.keys(state));
      for (const rule of DECISION_REGISTRY) {
        const hasInput = rule.inputs.some((input) => stateKeys.has(input));
        if (hasInput) {
          try {
            results[rule.id] = rule.resolve(state);
          } catch (_e) {
            results[rule.id] = { value: null, confidence: "LOW", rule_id: rule.id, error: true };
          }
        }
      }
      return results;
    }
    module.exports = {
      // Individual decision functions
      resolveContextGate,
      resolveProgressRoute,
      resolveResumeRoute,
      resolveExecutionPattern,
      resolveContextBudgetGate,
      resolvePreviousCheckGate,
      resolveCiGate,
      resolvePlanExistenceRoute,
      resolveBranchHandling,
      resolveAutoAdvance,
      resolvePhaseArgParse,
      resolveDebugHandlerRoute,
      // Phase 122: New decision functions
      resolveModelSelection,
      resolveVerificationRouting,
      resolveResearchGate,
      resolveMilestoneCompletion,
      resolveCommitStrategy,
      // Phase 141: Question taxonomy decision functions
      resolveQuestionType,
      resolveOptionGeneration,
      // Phase 127: Tool routing decision functions
      resolveFileDiscoveryMode,
      resolveSearchMode,
      resolveStructuralSearchMode,
      resolveJsonTransformMode,
      resolveYamlTransformMode,
      resolveTextReplaceMode,
      resolveBenchmarkMode,
      // Registry and aggregator
      DECISION_REGISTRY,
      evaluateDecisions: evaluateDecisions2
    };
  }
});

// src/plugin/index.js
import { existsSync as existsSync9 } from "fs";
import { join as join20 } from "path";

// src/plugin/safe-hook.js
import { homedir } from "os";
import { join as join2 } from "path";
import { randomBytes as randomBytes2 } from "crypto";

// src/plugin/logger.js
import { existsSync, mkdirSync, statSync, fstatSync, appendFileSync, copyFileSync, writeFileSync, openSync, ftruncateSync, closeSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
var MAX_LOG_SIZE = 512 * 1024;
function createLogger(logDir) {
  const logPath = join(logDir, "bgsd-plugin.log");
  const rotatedPath = logPath + ".1";
  function ensureDir() {
    try {
      if (!existsSync(logDir)) {
        mkdirSync(logDir, { recursive: true });
      }
    } catch {
    }
  }
  function rotate() {
    try {
      const fd = openSync(logPath, "r+");
      const stat = fstatSync(fd);
      if (stat.size >= MAX_LOG_SIZE) {
        try {
          copyFileSync(logPath, rotatedPath);
        } catch {
        }
        try {
          ftruncateSync(fd, 0);
        } catch {
        }
      }
      closeSync(fd);
    } catch {
    }
  }
  function write(level, message, correlationId, extra) {
    try {
      ensureDir();
      rotate();
      const timestamp = (/* @__PURE__ */ new Date()).toISOString();
      const corrPart = correlationId ? ` [${correlationId}]` : "";
      let line = `[${timestamp}] [${level}]${corrPart} ${message}
`;
      if (extra) {
        if (extra.stack) {
          line += `  Stack: ${extra.stack}
`;
        }
        if (extra.hookName) {
          line += `  Hook: ${extra.hookName}
`;
        }
        if (extra.elapsed) {
          line += `  Elapsed: ${extra.elapsed}ms
`;
        }
      }
      appendFileSync(logPath, line);
      const emitToStderr = extra?.emitToStderr !== false;
      if (level === "ERROR" && emitToStderr) {
        process.stderr.write(`[bGSD]${corrPart} ${message}
`);
      }
    } catch {
      try {
        process.stderr.write(`[bGSD] Logger write failed: ${message}
`);
      } catch {
      }
    }
  }
  return { write };
}

// src/plugin/safe-hook.js
function safeHook(name, fn, options = {}) {
  const { timeout = 5e3 } = options;
  let consecutiveFailures = 0;
  let disabled = false;
  let logger = null;
  function getLogger() {
    if (!logger) {
      const logDir = join2(homedir(), ".config", "opencode");
      logger = createLogger(logDir);
    }
    return logger;
  }
  function generateCorrelationId() {
    return randomBytes2(4).toString("hex");
  }
  function withTimeout(promise, ms) {
    return new Promise((resolve3, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Hook "${name}" timed out after ${ms}ms`));
      }, ms);
      promise.then((result) => {
        clearTimeout(timer);
        resolve3(result);
      }).catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }
  function writeOperatorMessage(message) {
    try {
      process.stderr.write(`[bGSD] ${message}
`);
    } catch {
    }
  }
  return async function wrappedHook(input, output) {
    if (disabled) {
      return;
    }
    if (process.env.BGSD_DEBUG === "1") {
      return fn(input, output);
    }
    const correlationId = generateCorrelationId();
    const startTime = Date.now();
    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await withTimeout(fn(input, output), timeout);
        consecutiveFailures = 0;
        const elapsed = Date.now() - startTime;
        if (elapsed > 500) {
          getLogger().write("WARN", `Slow hook: ${name} took ${elapsed}ms`, correlationId, {
            hookName: name,
            elapsed
          });
        }
        return result;
      } catch (err) {
        lastError = err;
      }
    }
    consecutiveFailures++;
    const errorMessage = `Hook "${name}" failed: ${lastError.message}`;
    getLogger().write("ERROR", errorMessage, correlationId, {
      hookName: name,
      stack: lastError.stack,
      emitToStderr: false
    });
    writeOperatorMessage(`Hook failed: ${name} [${correlationId}] - ${lastError.message}`);
    if (consecutiveFailures >= 3) {
      disabled = true;
      getLogger().write("ERROR", `Circuit breaker tripped: hook "${name}" disabled after ${consecutiveFailures} consecutive failures`, correlationId, {
        hookName: name,
        emitToStderr: false
      });
      writeOperatorMessage(`Hook ${name} disabled after ${consecutiveFailures} consecutive failures [${correlationId}]`);
    }
  };
}

// src/plugin/debug-contract.js
function isTruthyDebugValue(value) {
  if (value === void 0 || value === null) return false;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  return normalized !== "" && normalized !== "0" && normalized !== "false" && normalized !== "off";
}
function isDebugEnabled(options = {}) {
  const env = options.env || process.env;
  if (isTruthyDebugValue(env && env.BGSD_DEBUG)) {
    return true;
  }
  if (options.allowVerbose === false) {
    return false;
  }
  return global._gsdCompactMode === false;
}
function writeDebugDiagnostic(prefix, message, options = {}) {
  if (!isDebugEnabled(options)) {
    return false;
  }
  process.stderr.write(`${prefix} ${message}
`);
  return true;
}

// src/plugin/tool-registry.js
var TOOL_NAME_PATTERN = /^bgsd_[a-z][a-z0-9_]*$/;
var BGSD_PREFIX = "bgsd_";
function createToolRegistry(safeHookFn) {
  const registry = /* @__PURE__ */ new Map();
  function registerTool(name, definition) {
    let normalized = name;
    if (!normalized.startsWith(BGSD_PREFIX)) {
      normalized = BGSD_PREFIX + normalized;
    }
    if (!TOOL_NAME_PATTERN.test(normalized)) {
      throw new Error(`Tool name must be snake_case: ${normalized}`);
    }
    if (registry.has(normalized)) {
      writeDebugDiagnostic("[bGSD:tool-registry]", `Tool '${normalized}' already registered \u2014 overwriting`);
    }
    const wrappedDefinition = { ...definition };
    if (typeof wrappedDefinition.execute === "function") {
      wrappedDefinition.execute = safeHookFn("tool:" + normalized, wrappedDefinition.execute);
    }
    registry.set(normalized, {
      name: normalized,
      ...wrappedDefinition
    });
    return normalized;
  }
  function getTools2() {
    const tools = {};
    for (const [name, def] of registry) {
      tools[name] = def;
    }
    return tools;
  }
  return { registerTool, getTools: getTools2 };
}

// src/plugin/context-builder.js
import { existsSync as existsSync3, readFileSync as readFileSync7 } from "fs";
import { join as join11 } from "path";

// src/plugin/project-state.js
await init_state();
await init_roadmap();
await init_plan();
init_config();
init_project();
init_intent();
await init_state();
await init_roadmap();
await init_plan();
await init_db_cache();
import { join as join10 } from "path";
import { readdirSync as readdirSync2 } from "fs";
function _eagerMtimeCheck(resolvedCwd, phaseNum) {
  try {
    const db = getDb(resolvedCwd);
    const cache = new PlanningCache(db);
    const filesToCheck = [
      join10(resolvedCwd, ".planning", "ROADMAP.md"),
      join10(resolvedCwd, ".planning", "STATE.md")
    ];
    if (phaseNum) {
      const normalized = String(phaseNum).replace(/^0+/, "") || "0";
      const phasesDir = join10(resolvedCwd, ".planning", "phases");
      try {
        const entries = readdirSync2(phasesDir, { withFileTypes: true });
        let dirName = null;
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const dirMatch = entry.name.match(/^(\d+(?:\.\d+)?)-?(.*)/);
          if (!dirMatch) continue;
          const dirPhaseNum = dirMatch[1].replace(/^0+/, "") || "0";
          if (dirPhaseNum === normalized) {
            dirName = entry.name;
            break;
          }
        }
        if (dirName) {
          const phaseDir = join10(phasesDir, dirName);
          const files = readdirSync2(phaseDir);
          const planFiles = files.filter((f) => f.endsWith("-PLAN.md") || f === "PLAN.md").map((f) => join10(phaseDir, f));
          filesToCheck.push(...planFiles);
        }
      } catch {
      }
    }
    const freshnessResult = cache.checkAllFreshness(filesToCheck);
    for (const staleFile of freshnessResult.stale) {
      cache.invalidateFile(staleFile);
      if (staleFile.endsWith("ROADMAP.md")) {
        invalidateRoadmap(resolvedCwd);
      } else if (staleFile.endsWith("STATE.md")) {
        invalidateState(resolvedCwd);
      } else if (staleFile.endsWith("-PLAN.md") || staleFile.endsWith("PLAN.md")) {
        invalidatePlans(resolvedCwd);
      }
    }
  } catch {
  }
}
function getProjectState(cwd) {
  const resolvedCwd = cwd || process.cwd();
  const state = parseState(resolvedCwd);
  if (!state) {
    return null;
  }
  let phaseNumForCheck = null;
  if (state.phase) {
    const phaseMatch = state.phase.match(/^(\d+)/);
    if (phaseMatch) {
      phaseNumForCheck = parseInt(phaseMatch[1], 10);
    }
  }
  _eagerMtimeCheck(resolvedCwd, phaseNumForCheck);
  const roadmap = parseRoadmap(resolvedCwd);
  const config = parseConfig(resolvedCwd);
  const project = parseProject(resolvedCwd);
  const intent = parseIntent(resolvedCwd);
  let phaseNum = null;
  if (state.phase) {
    const phaseMatch = state.phase.match(/^(\d+)/);
    if (phaseMatch) {
      phaseNum = parseInt(phaseMatch[1], 10);
    }
  }
  let currentPhase = null;
  if (phaseNum && roadmap) {
    currentPhase = roadmap.getPhase(phaseNum);
  }
  const currentMilestone = roadmap ? roadmap.currentMilestone : null;
  let plans = Object.freeze([]);
  let phaseDir = null;
  if (phaseNum) {
    plans = parsePlans(phaseNum, resolvedCwd);
    try {
      const normalized = String(phaseNum).replace(/^0+/, "") || "0";
      const phasesDir = join10(resolvedCwd, ".planning", "phases");
      const entries = readdirSync2(phasesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const dirMatch = entry.name.match(/^(\d+(?:\.\d+)?)-?(.*)/);
        if (!dirMatch) continue;
        const dirPhaseNum = dirMatch[1].replace(/^0+/, "") || "0";
        if (dirPhaseNum === normalized) {
          phaseDir = `.planning/phases/${entry.name}`;
          break;
        }
      }
    } catch {
    }
  }
  return Object.freeze({
    state,
    roadmap,
    config,
    project,
    intent,
    plans,
    phaseDir,
    currentPhase,
    currentMilestone
  });
}

// src/plugin/token-budget.js
var TOKEN_BUDGET = 500;
function countTokens(text) {
  if (!text || typeof text !== "string") return 0;
  return Math.ceil(text.length / 4);
}

// src/plugin/context-builder.js
var MEMORY_FILE = join11(".planning", "MEMORY.md");
var MEMORY_SECTIONS = [
  "Active / Recent",
  "Project Facts",
  "User Preferences",
  "Environment Patterns",
  "Correction History"
];
var MEMORY_SECTION_DEFAULT_TYPE = {
  "Active / Recent": "project-fact",
  "Project Facts": "project-fact",
  "User Preferences": "user-preference",
  "Environment Patterns": "environment-pattern",
  "Correction History": "correction"
};
var MEMORY_ENTRY_METADATA_ORDER = ["Added", "Updated", "Source", "Keep", "Status", "Expires", "Replaces"];
var MEMORY_BLOCK_PATTERNS = [
  {
    category: "instruction-override",
    patterns: [
      /ignore\s+(all\s+)?previous\s+instructions?/i,
      /\byou\s+are\s+now\b/i,
      /\bnew\s+instructions?\b/i,
      /<system>|\[inst\]/i
    ]
  },
  {
    category: "exfiltration",
    patterns: [
      /reveal\s+(your\s+)?system\s+prompt/i,
      /show\s+(hidden|system)\s+instructions/i,
      /(print|output|dump)\s+(the\s+)?(env|environment|secret|secrets)/i,
      /prompt\s+leak/i
    ]
  },
  {
    category: "tool-bypass",
    patterns: [
      /always\s+use\s+bash/i,
      /force\s+tool\s+call/i,
      /(skip|bypass|disable).{0,24}(guardrails|confirmation|approval|approvals)/i,
      /(tool|command).{0,24}(bypass|override)/i
    ]
  }
];
function buildTrajectoryBlock(state, plans) {
  try {
    const parts = [];
    if (state && state.phase) {
      const phaseMatch = state.phase.match(/^(\d+)/);
      if (phaseMatch) {
        parts.push(`Current: Phase ${phaseMatch[1]}`);
      }
    }
    if (plans && plans.length > 0) {
      const completedPlans = [];
      const executedPlans = [];
      for (const plan of plans) {
        if (plan.executed || plan.completed) {
          completedPlans.push(plan.frontmatter?.plan || "?");
        }
        if (plan.executed) {
          executedPlans.push(plan.frontmatter?.plan || "?");
        }
      }
      if (completedPlans.length > 0) {
        parts.push(`Completed: ${completedPlans.join(", ")}`);
      }
      if (executedPlans.length > 0) {
        parts.push(`Executed: ${executedPlans.join(", ")}`);
      }
    }
    if (parts.length === 0) return null;
    return `<trajectory>
${parts.join("\n")}
</trajectory>`;
  } catch {
    return null;
  }
}
function buildSacredBlock(intent, roadmap) {
  try {
    const parts = [];
    if (intent && intent.objective) {
      parts.push(`Objective: ${intent.objective}`);
    }
    if (intent && intent.items && intent.items.length > 0) {
      const keyItems = intent.items.slice(0, 3);
      for (const item of keyItems) {
        if (item.id && item.id.startsWith("DO-")) {
          parts.push(`${item.id}: ${item.text || item.description || ""}`);
        }
      }
    }
    if (roadmap && roadmap.currentMilestone) {
      const ms = roadmap.currentMilestone;
      parts.push(`Milestone: ${ms.version || ms.name || "Current"}`);
      if (ms.status) {
        parts.push(`Status: ${ms.status}`);
      }
    }
    if (roadmap && roadmap.phases) {
      const currentPhase = roadmap.phases.find((p) => p.status === "current");
      if (currentPhase) {
        parts.push(`Phase: ${currentPhase.num}: ${currentPhase.name}`);
      }
    }
    if (parts.length === 0) return null;
    return `<sacred>
${parts.join("\n")}
</sacred>`;
  } catch {
    return null;
  }
}
function normalizeMemorySection(section) {
  if (!section) return null;
  const trimmed = String(section).trim().toLowerCase();
  return MEMORY_SECTIONS.find((name) => name.toLowerCase() === trimmed) || null;
}
function normalizeMemoryType(type, section) {
  const trimmed = String(type || "").trim().toLowerCase();
  return trimmed || MEMORY_SECTION_DEFAULT_TYPE[section] || "project-fact";
}
function canonicalMetadataKey(key) {
  if (!key) return null;
  const trimmed = String(key).trim().toLowerCase();
  return MEMORY_ENTRY_METADATA_ORDER.find((name) => name.toLowerCase() === trimmed) || null;
}
function createEmptyStructuredMemory() {
  return {
    title: "# Agent Memory",
    sections: MEMORY_SECTIONS.map((name) => ({ name, entries: [] }))
  };
}
function structuredMemoryToMap(doc) {
  const map = /* @__PURE__ */ new Map();
  for (const section of doc.sections) {
    map.set(section.name, section);
  }
  return map;
}
function parseStructuredMemory(content) {
  const lines = String(content || "").replace(/\r\n/g, "\n").split("\n");
  const doc = createEmptyStructuredMemory();
  const sectionMap = structuredMemoryToMap(doc);
  let currentSection = null;
  let currentEntry = null;
  function finalizeEntry() {
    if (!currentSection || !currentEntry) return;
    currentSection.entries.push(currentEntry);
    currentEntry = null;
  }
  for (const line of lines) {
    const sectionMatch = line.match(/^##\s+(.+?)\s*$/);
    if (sectionMatch) {
      finalizeEntry();
      currentSection = sectionMap.get(normalizeMemorySection(sectionMatch[1]));
      continue;
    }
    if (!currentSection) continue;
    const entryMatch = line.match(/^\-\s+\*\*(MEM-\d+)\*\*(?:\s+\[([^\]]+)\])?\s+(.+?)\s*$/);
    if (entryMatch) {
      finalizeEntry();
      currentEntry = {
        id: entryMatch[1],
        type: normalizeMemoryType(entryMatch[2], currentSection.name),
        text: entryMatch[3].trim(),
        metadata: {}
      };
      continue;
    }
    const metadataMatch = line.match(/^\s{2,}-\s+([^:]+):\s*(.*?)\s*$/);
    if (metadataMatch && currentEntry) {
      const key = canonicalMetadataKey(metadataMatch[1]);
      if (key) currentEntry.metadata[key] = metadataMatch[2];
    }
  }
  finalizeEntry();
  return doc;
}
function normalizeMemoryForScan(raw) {
  let normalized = String(raw || "").normalize("NFKD");
  normalized = normalized.replace(/[\u200B-\u200D\u2060\uFEFF]/g, "");
  normalized = normalized.replace(/[\u0300-\u036F]/g, "");
  return normalized.toLowerCase().replace(/\s+/g, " ").trim();
}
function redactBlockedSnippet(value, max = 56) {
  const collapsed = String(value || "").replace(/\s+/g, " ").trim();
  if (!collapsed) return "[redacted]";
  const preview = collapsed.slice(0, max);
  const visible = preview.slice(0, 18);
  const masked = preview.slice(18).replace(/[A-Za-z0-9]/g, "\u2022");
  return `${visible}${masked}${collapsed.length > max ? "\u2026" : ""}`;
}
function classifyBlockedMemoryEntry(rawText) {
  const normalizedText = normalizeMemoryForScan(rawText);
  for (const matcher of MEMORY_BLOCK_PATTERNS) {
    if (matcher.patterns.some((pattern) => pattern.test(rawText) || pattern.test(normalizedText))) {
      return matcher.category;
    }
  }
  return null;
}
function summarizeBlockedEntries(blockedEntries) {
  const grouped = /* @__PURE__ */ new Map();
  for (const entry of blockedEntries) {
    const existing = grouped.get(entry.category) || { category: entry.category, count: 0, snippet: entry.snippet };
    existing.count += 1;
    grouped.set(entry.category, existing);
  }
  return [...grouped.values()];
}
function renderMemorySnapshot(doc) {
  const lines = ["<bgsd-memory>"];
  for (const sectionName of MEMORY_SECTIONS) {
    const section = doc.sections.find((item) => item.name === sectionName);
    if (!section || section.entries.length === 0) continue;
    lines.push(sectionName);
    for (const entry of section.entries) {
      lines.push(`- ${entry.id} [${entry.type}] ${entry.text}`);
    }
  }
  lines.push("</bgsd-memory>");
  return lines.length > 2 ? lines.join("\n") : "";
}
function buildMemorySnapshot(cwd) {
  const memoryPath = join11(cwd || process.cwd(), MEMORY_FILE);
  if (!existsSync3(memoryPath)) {
    return {
      exists: false,
      text: "",
      blockedWarnings: [],
      budgetWarning: null
    };
  }
  let doc;
  try {
    doc = parseStructuredMemory(readFileSync7(memoryPath, "utf-8"));
  } catch {
    return {
      exists: true,
      text: "",
      blockedWarnings: [{ category: "parse-failure", count: 1, snippet: "MEMORY.md could not be parsed" }],
      budgetWarning: null
    };
  }
  const safeDoc = createEmptyStructuredMemory();
  const safeSectionMap = structuredMemoryToMap(safeDoc);
  const blockedEntries = [];
  for (const section of doc.sections) {
    const targetSection = safeSectionMap.get(section.name);
    for (const entry of section.entries) {
      const rawText = `${entry.id} ${entry.type} ${entry.text}`;
      const category = classifyBlockedMemoryEntry(rawText);
      if (category) {
        blockedEntries.push({
          category,
          snippet: redactBlockedSnippet(entry.text)
        });
        continue;
      }
      targetSection.entries.push(entry);
    }
  }
  const text = renderMemorySnapshot(safeDoc);
  const tokenCount = countTokens(text);
  const budgetWarning = text && tokenCount > Math.floor(TOKEN_BUDGET * 0.5) ? `MEMORY.md snapshot is using ~${tokenCount} tokens; consider pruning if prompt space feels tight.` : null;
  return {
    exists: true,
    text,
    blockedWarnings: summarizeBlockedEntries(blockedEntries),
    budgetWarning
  };
}
function buildSystemPrompt(cwd, options = {}) {
  let projectState;
  try {
    projectState = getProjectState(cwd);
  } catch {
    return "<bgsd>Failed to load project state. Run /bgsd-inspect health to diagnose.</bgsd>";
  }
  if (!projectState) {
    return "<bgsd>No active project. Run /bgsd-new-project to start.</bgsd>";
  }
  const { state, roadmap, currentPhase, currentMilestone, plans } = projectState;
  if (!state || !state.phase) {
    return "<bgsd>Failed to load project state. Run /bgsd-inspect health to diagnose.</bgsd>";
  }
  const phaseMatch = state.phase.match(/^(\d+)\s*(?:—|-|–)\s*(.+)/);
  const phaseNum = phaseMatch ? phaseMatch[1] : state.phase;
  const phaseName = phaseMatch ? phaseMatch[2].trim() : "";
  let planInfo = "";
  if (state.currentPlan && state.currentPlan !== "Not started") {
    const currentPlanMatch = state.currentPlan.match(/(\d+)/);
    const planNum = currentPlanMatch ? currentPlanMatch[1].padStart(2, "0") : null;
    if (planNum && plans.length > 0) {
      const plan = plans.find(
        (p) => p.frontmatter && p.frontmatter.plan === planNum
      );
      if (plan) {
        const totalTasks = plan.tasks ? plan.tasks.length : 0;
        planInfo = ` | Plan: P${planNum} (${totalTasks} tasks)`;
      } else {
        planInfo = ` | Plan: P${planNum}`;
      }
    } else {
      planInfo = ` | Plan: ${state.currentPlan}`;
    }
  } else {
    planInfo = " | Ready to plan";
  }
  let milestoneInfo = "";
  if (currentMilestone && roadmap) {
    const milestonePhases = currentMilestone.phases;
    if (milestonePhases) {
      const totalPhases = milestonePhases.end - milestonePhases.start + 1;
      const currentPhaseNum = parseInt(phaseNum, 10);
      const phasePosition = currentPhaseNum - milestonePhases.start + 1;
      milestoneInfo = ` | ${currentMilestone.version} ${phasePosition}/${totalPhases} phases`;
    } else {
      milestoneInfo = ` | ${currentMilestone.version}`;
    }
  }
  let goalLine = "";
  if (currentPhase && currentPhase.goal) {
    goalLine = `
Goal: ${currentPhase.goal}`;
  }
  let blockerLine = "";
  if (state.raw) {
    const blockersSection = state.getSection("Blockers/Concerns");
    if (blockersSection) {
      const blockerLines = blockersSection.split("\n").map((l) => l.replace(/^-\s*/, "").trim()).filter((l) => l && l !== "None" && l !== "None." && !l.startsWith("None \u2014"));
      if (blockerLines.length > 0) {
        blockerLine = `
Blocker: ${blockerLines[0]}`;
      }
    }
  }
  const memorySnapshot = options && typeof options === "object" ? options.memorySnapshot || "" : "";
  const prompt = `<bgsd>
Phase ${phaseNum}: ${phaseName}${planInfo}${milestoneInfo}${goalLine}${blockerLine}
</bgsd>${memorySnapshot ? `
${memorySnapshot}` : ""}`;
  const tokenCount = countTokens(prompt);
  if (tokenCount > TOKEN_BUDGET) {
    writeDebugDiagnostic("[bGSD:context-budget]", `System prompt injection exceeds budget: ${tokenCount} tokens (budget: ${TOKEN_BUDGET})`);
  }
  return prompt;
}
function buildCompactionContext(cwd) {
  let projectState;
  try {
    projectState = getProjectState(cwd);
  } catch {
    return "<project-error>Failed to load project state for compaction. Run /bgsd-inspect health to diagnose.</project-error>";
  }
  if (!projectState) {
    return null;
  }
  const { state, project, intent, plans, currentPhase, roadmap } = projectState;
  const blocks = [];
  try {
    const sacredBlock = buildSacredBlock(intent, roadmap);
    if (sacredBlock) {
      blocks.push(sacredBlock);
    }
  } catch {
  }
  try {
    if (project) {
      const parts = [];
      if (project.coreValue) parts.push(`Core value: ${project.coreValue}`);
      if (project.techStack) parts.push(`Tech: ${project.techStack}`);
      if (parts.length > 0) {
        blocks.push(`<project>
${parts.join("\n")}
</project>`);
      }
    }
  } catch {
  }
  try {
    if (state && state.phase) {
      const phaseMatch = state.phase.match(/^(\d+)\s*(?:—|-|–)\s*(.+)/);
      const phaseNum = phaseMatch ? phaseMatch[1] : state.phase;
      const phaseName = phaseMatch ? phaseMatch[2].trim() : "";
      let taskLine = `Phase ${phaseNum}: ${phaseName}`;
      if (state.currentPlan && plans && plans.length > 0) {
        const planNumMatch = state.currentPlan.match(/(\d+)/);
        const planNum = planNumMatch ? planNumMatch[1].padStart(2, "0") : null;
        if (planNum) {
          const plan = plans.find((p) => p.frontmatter && p.frontmatter.plan === planNum);
          if (plan && plan.tasks && plan.tasks.length > 0) {
            const totalTasks = plan.tasks.length;
            taskLine += ` \u2014 Plan P${planNum}, ${totalTasks} tasks`;
            const firstTask = plan.tasks[0];
            if (firstTask.name) {
              taskLine += `
Current: ${firstTask.name}`;
            }
            if (firstTask.files && firstTask.files.length > 0) {
              taskLine += `
Files: ${firstTask.files.join(", ")}`;
            }
          } else {
            taskLine += ` \u2014 Plan P${planNum}`;
          }
        }
      }
      blocks.push(`<task-state>
${taskLine}
</task-state>`);
    }
  } catch {
  }
  try {
    if (state && state.raw) {
      const decisionsSection = state.getSection("Decisions");
      if (decisionsSection) {
        const decisionLines = decisionsSection.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("- "));
        if (decisionLines.length > 0) {
          const last3 = decisionLines.slice(-3);
          blocks.push(`<decisions>
${last3.join("\n")}
</decisions>`);
        }
      }
    }
  } catch {
  }
  try {
    if (intent && intent.objective) {
      blocks.push(`<intent>
Objective: ${intent.objective}
</intent>`);
    }
  } catch {
  }
  try {
    if (state && state.raw) {
      const sessionSection = state.getSection("Session Continuity");
      if (sessionSection) {
        const stoppedAt = sessionSection.match(/\*\*Stopped at:\*\*\s*(.+)/i);
        const nextStep = sessionSection.match(/\*\*Next step:\*\*\s*(.+)/i);
        const parts = [];
        if (stoppedAt) parts.push(`Stopped at: ${stoppedAt[1].trim()}`);
        if (nextStep) parts.push(`Next step: ${nextStep[1].trim()}`);
        if (parts.length > 0) {
          blocks.push(`<session>
${parts.join("\n")}
</session>`);
        }
      }
    }
  } catch {
  }
  try {
    const trajectoryBlock = buildTrajectoryBlock(state, plans);
    if (trajectoryBlock) {
      blocks.push(trajectoryBlock);
    }
  } catch {
  }
  if (blocks.length === 0) {
    return null;
  }
  return blocks.join("\n\n");
}

// src/plugin/command-enricher.js
await init_parsers();
var import_decision_rules = __toESM(require_decision_rules());
await init_db_cache();

// src/plugin/tool-availability.js
import { execFileSync } from "child_process";
import { existsSync as existsSync4, readFileSync as readFileSync8 } from "fs";
import { dirname as dirname2, join as join12 } from "path";
import { fileURLToPath } from "url";
var TOOL_NAMES = ["ripgrep", "fd", "jq", "yq", "ast_grep", "sd", "hyperfine", "bat", "gh"];
var TOOL_CACHE_TTL_MS = 30 * 60 * 1e3;
function createUnknownToolAvailability() {
  return Object.fromEntries(TOOL_NAMES.map((name) => [name, null]));
}
function computeCapabilityLevel(toolAvailability) {
  const values = Object.values(toolAvailability || {});
  const knownCount = values.filter((value) => value === true || value === false).length;
  if (knownCount === 0) return "UNKNOWN";
  const toolCount = values.filter((value) => value === true).length;
  if (toolCount >= 5) return "HIGH";
  if (toolCount <= 1) return "LOW";
  return "MEDIUM";
}
function getCachePath(projectDir) {
  return join12(projectDir, ".planning", ".cache", "tools.json");
}
function resolveCliPath() {
  const currentDir = dirname2(fileURLToPath(import.meta.url));
  const candidates = [
    process.env.BGSD_PLUGIN_DIR ? join12(process.env.BGSD_PLUGIN_DIR, "bin", "bgsd-tools.cjs") : null,
    join12(currentDir, "..", "..", "bin", "bgsd-tools.cjs"),
    join12(currentDir, "bin", "bgsd-tools.cjs"),
    join12(currentDir, "..", "bin", "bgsd-tools.cjs")
  ];
  for (const candidate of candidates) {
    if (candidate && existsSync4(candidate)) return candidate;
  }
  throw new Error("Could not locate bgsd-tools.cjs");
}
function mapResultsToAvailability(results) {
  const availability = createUnknownToolAvailability();
  for (const toolName of TOOL_NAMES) {
    if (results && Object.prototype.hasOwnProperty.call(results, toolName)) {
      availability[toolName] = Boolean(results[toolName] && results[toolName].available);
    }
  }
  return availability;
}
function mapDetectToolsOutput(entries) {
  const availability = createUnknownToolAvailability();
  if (!Array.isArray(entries)) return availability;
  for (const entry of entries) {
    const toolName = entry && typeof entry.name === "string" ? entry.name : null;
    if (toolName && TOOL_NAMES.includes(toolName)) {
      availability[toolName] = entry.available === true ? true : entry.available === false ? false : null;
    }
  }
  return availability;
}
function inspectToolCache(projectDir) {
  const cachePath = getCachePath(projectDir);
  if (!existsSync4(cachePath)) {
    return { state: "missing", cachePath, timestamp: null, ageMs: null, results: null };
  }
  try {
    const cacheData = JSON.parse(readFileSync8(cachePath, "utf-8"));
    if (!cacheData || typeof cacheData !== "object" || !cacheData.timestamp || !cacheData.results) {
      return { state: "malformed", cachePath, timestamp: null, ageMs: null, results: null };
    }
    const ageMs = Date.now() - cacheData.timestamp;
    return {
      state: ageMs < TOOL_CACHE_TTL_MS ? "fresh" : "stale",
      cachePath,
      timestamp: cacheData.timestamp,
      ageMs,
      results: cacheData.results
    };
  } catch {
    return { state: "malformed", cachePath, timestamp: null, ageMs: null, results: null };
  }
}
function refreshToolAvailability(projectDir) {
  const cliPath = resolveCliPath();
  const output = execFileSync(process.execPath, [cliPath, "detect:tools", "--raw"], {
    cwd: projectDir,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  const parsed = JSON.parse(String(output || "[]").trim() || "[]");
  return mapDetectToolsOutput(parsed);
}
function getToolAvailability(projectDir, options = {}) {
  const { refreshIfNeeded = true } = options;
  const cache = inspectToolCache(projectDir);
  if (cache.state === "fresh") {
    return {
      tool_availability: mapResultsToAvailability(cache.results),
      tool_availability_meta: {
        state: "fresh",
        source: "cache",
        cache_path: cache.cachePath,
        cache_timestamp: cache.timestamp,
        cache_age_ms: cache.ageMs,
        cache_ttl_ms: TOOL_CACHE_TTL_MS
      }
    };
  }
  if (refreshIfNeeded) {
    try {
      const refreshed = refreshToolAvailability(projectDir);
      const refreshedCache = inspectToolCache(projectDir);
      return {
        tool_availability: refreshed,
        tool_availability_meta: {
          state: "fresh",
          source: "cli-refresh",
          refresh_reason: cache.state,
          cache_path: refreshedCache.cachePath,
          cache_timestamp: refreshedCache.timestamp,
          cache_age_ms: refreshedCache.ageMs,
          cache_ttl_ms: TOOL_CACHE_TTL_MS
        }
      };
    } catch (error) {
      return {
        tool_availability: createUnknownToolAvailability(),
        tool_availability_meta: {
          state: "unknown",
          source: "fallback",
          refresh_reason: cache.state,
          refresh_error: error.message || String(error),
          cache_path: cache.cachePath,
          cache_timestamp: cache.timestamp,
          cache_age_ms: cache.ageMs,
          cache_ttl_ms: TOOL_CACHE_TTL_MS
        }
      };
    }
  }
  return {
    tool_availability: createUnknownToolAvailability(),
    tool_availability_meta: {
      state: cache.state === "fresh" ? "fresh" : "unknown",
      source: cache.state === "fresh" ? "cache" : "fallback",
      cache_path: cache.cachePath,
      cache_timestamp: cache.timestamp,
      cache_age_ms: cache.ageMs,
      cache_ttl_ms: TOOL_CACHE_TTL_MS
    }
  };
}

// src/plugin/command-enricher.js
import { readdirSync as readdirSync3, existsSync as existsSync5, readFileSync as readFileSync9 } from "fs";
import { join as join13 } from "path";
function enrichCommand(input, output, cwd) {
  if (!input || !output) return;
  const command = input.command || input.parts && input.parts[0] || "";
  if (!command.startsWith("bgsd-")) return;
  const _t0 = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  const resolvedCwd = cwd || process.cwd();
  let projectState;
  try {
    projectState = getProjectState(resolvedCwd);
  } catch (err) {
    if (output.parts) {
      output.parts.unshift({
        type: "text",
        text: '<bgsd-context>\n{"error": "Failed to load project state. Run /bgsd-inspect health to diagnose."}\n</bgsd-context>'
      });
    }
    return;
  }
  if (!projectState) {
    if (command !== "bgsd-new-project" && command !== "bgsd-help") {
      if (output.parts) {
        output.parts.unshift({
          type: "text",
          text: '<bgsd-context>\n{"error": "No .planning/ directory found. Run /bgsd-new-project to initialize."}\n</bgsd-context>'
        });
      }
    }
    return;
  }
  const { state, config, roadmap, currentPhase, currentMilestone, plans: statePlans, phaseDir: statePhaseDir } = projectState;
  const enrichment = {
    // Paths
    planning_dir: ".planning",
    state_path: ".planning/STATE.md",
    roadmap_path: ".planning/ROADMAP.md",
    config_path: ".planning/config.json",
    // Config flags
    commit_docs: config ? config.commit_docs : true,
    branching_strategy: config ? config.branching_strategy || "none" : "none",
    verifier_enabled: config ? config.verifier : true,
    research_enabled: config ? config.research : true,
    // Milestone
    milestone: currentMilestone ? currentMilestone.version : null,
    milestone_name: currentMilestone ? currentMilestone.name : null
  };
  const phaseNum = detectPhaseArg(input.parts, input.command, input.arguments);
  let effectivePhaseNum = phaseNum;
  let plans = null;
  let summaryFiles = null;
  const ensurePlans = (num) => {
    if (!plans && num) {
      plans = parsePlans(num, resolvedCwd);
    }
    return plans;
  };
  const ensureSummaryFiles = (phaseDirFull) => {
    if (summaryFiles === null) {
      summaryFiles = listSummaryFiles(phaseDirFull);
    }
    return summaryFiles;
  };
  if (phaseNum) {
    const phaseDir = resolvePhaseDir(phaseNum, resolvedCwd);
    if (phaseDir) {
      enrichment.phase_dir = phaseDir;
      enrichment.phase_number = String(phaseNum);
      if (roadmap) {
        const phase = roadmap.getPhase(phaseNum);
        if (phase) {
          enrichment.phase_name = phase.name;
          enrichment.phase_slug = `${String(phaseNum).padStart(2, "0")}-${toSlug(phase.name)}`;
          if (phase.goal) enrichment.phase_goal = phase.goal;
        }
      }
      let sqlUsedInPhaseArg = false;
      try {
        const db = getDb(resolvedCwd);
        const cache = new PlanningCache(db);
        const sqlResult = cache.getSummaryCount(phaseNum, resolvedCwd);
        const incompleteSql = cache.getIncompletePlans(phaseNum, resolvedCwd);
        if (sqlResult !== null && incompleteSql !== null) {
          const planRows = cache.getPlansForPhase(String(phaseNum), resolvedCwd);
          if (planRows && planRows.length > 0) {
            enrichment.plans = planRows.map((p) => p.path ? p.path.split("/").pop() : null).filter(Boolean);
          }
          enrichment.incomplete_plans = incompleteSql;
          summaryFiles = sqlResult.summaryFiles;
          sqlUsedInPhaseArg = true;
        }
      } catch {
      }
      if (!sqlUsedInPhaseArg) {
        try {
          const p = ensurePlans(phaseNum);
          if (p && p.length > 0) {
            enrichment.plans = p.map((pl) => pl.path ? pl.path.split("/").pop() : null).filter(Boolean);
            const phaseDirFull = join13(resolvedCwd, phaseDir);
            const sf = ensureSummaryFiles(phaseDirFull);
            enrichment.incomplete_plans = enrichment.plans.filter((planFile) => {
              const summaryFile = planFile.replace("-PLAN.md", "-SUMMARY.md");
              return !sf.includes(summaryFile);
            });
          }
        } catch {
        }
      }
    }
  } else if (state && state.phase) {
    const currentPhaseMatch = state.phase.match(/^(\d+)/);
    if (currentPhaseMatch) {
      const curPhaseNum = parseInt(currentPhaseMatch[1], 10);
      effectivePhaseNum = curPhaseNum;
      enrichment.phase_number = String(curPhaseNum);
      if (currentPhase) {
        enrichment.phase_name = currentPhase.name;
      }
      const resolvedPhaseDir = statePhaseDir || resolvePhaseDir(curPhaseNum, resolvedCwd);
      if (resolvedPhaseDir) {
        enrichment.phase_dir = resolvedPhaseDir;
      }
      if (statePlans && statePlans.length > 0) {
        plans = statePlans;
      }
    }
  }
  try {
    if (enrichment.phase_dir) {
      const phaseDirFull = join13(resolvedCwd, enrichment.phase_dir);
      if (!enrichment.plans) {
        let sqlUsed = false;
        try {
          const db = getDb(resolvedCwd);
          const cache = new PlanningCache(db);
          const sqlResult = cache.getSummaryCount(effectivePhaseNum, resolvedCwd);
          const incompleteSql = cache.getIncompletePlans(effectivePhaseNum, resolvedCwd);
          if (sqlResult !== null && incompleteSql !== null) {
            const planRows = cache.getPlansForPhase(String(effectivePhaseNum), resolvedCwd);
            if (planRows && planRows.length > 0) {
              enrichment.plans = planRows.map((p) => p.path ? p.path.split("/").pop() : null).filter(Boolean);
            }
            enrichment.incomplete_plans = incompleteSql;
            summaryFiles = sqlResult.summaryFiles;
            sqlUsed = true;
          }
        } catch {
        }
        if (!sqlUsed) {
          const p = ensurePlans(effectivePhaseNum);
          if (p && p.length > 0) {
            enrichment.plans = p.map((pl) => pl.path ? pl.path.split("/").pop() : null).filter(Boolean);
            const sf2 = ensureSummaryFiles(phaseDirFull);
            enrichment.incomplete_plans = enrichment.plans.filter((planFile) => {
              const summaryFile = planFile.replace("-PLAN.md", "-SUMMARY.md");
              return !sf2.includes(summaryFile);
            });
          }
        }
      }
      enrichment.plan_count = enrichment.plans ? enrichment.plans.length : 0;
      const sf = ensureSummaryFiles(phaseDirFull);
      enrichment.summary_count = sf.length;
      enrichment.uat_gap_count = countDiagnosedUatGaps(phaseDirFull);
    }
  } catch {
  }
  try {
    if (enrichment.phase_dir && effectivePhaseNum) {
      const paddedPhase = String(effectivePhaseNum).padStart(4, "0");
      enrichment.has_research = existsSync5(join13(resolvedCwd, enrichment.phase_dir, paddedPhase + "-RESEARCH.md"));
      enrichment.has_context = existsSync5(join13(resolvedCwd, enrichment.phase_dir, paddedPhase + "-CONTEXT.md"));
    }
  } catch {
  }
  try {
    if (enrichment.incomplete_plans && enrichment.incomplete_plans.length > 0 && effectivePhaseNum) {
      const p = ensurePlans(effectivePhaseNum);
      if (p && p.length > 0) {
        const firstIncompleteName = enrichment.incomplete_plans[0];
        const incompletePlan = p.find((pl) => pl.path && pl.path.endsWith(firstIncompleteName));
        if (incompletePlan && incompletePlan.tasks) {
          enrichment.task_types = incompletePlan.tasks.map((t) => t.type).filter(Boolean);
        }
      }
    }
  } catch {
  }
  try {
    enrichment.state_exists = existsSync5(join13(resolvedCwd, ".planning/STATE.md"));
    enrichment.project_exists = existsSync5(join13(resolvedCwd, ".planning/PROJECT.md"));
    enrichment.roadmap_exists = existsSync5(join13(resolvedCwd, ".planning/ROADMAP.md"));
  } catch {
  }
  try {
    if (effectivePhaseNum) {
      enrichment.current_phase = effectivePhaseNum;
    }
    if (roadmap && roadmap.phases && roadmap.phases.length > 0) {
      enrichment.highest_phase = Math.max(...roadmap.phases.map((p) => parseFloat(p.number)).filter((n) => !isNaN(n)));
    } else {
      enrichment.highest_phase = null;
    }
  } catch {
    enrichment.highest_phase = null;
  }
  try {
    if (enrichment.phase_dir) {
      const phaseDirFull = join13(resolvedCwd, enrichment.phase_dir);
      const sf = ensureSummaryFiles(phaseDirFull);
      enrichment.has_previous_summary = sf.length > 0;
      if (sf.length > 0) {
        const lastSummary = [...sf].sort().pop();
        const content = readFileSync9(join13(phaseDirFull, lastSummary), "utf-8");
        enrichment.has_unresolved_issues = content.includes("unresolved") || content.includes("Unresolved");
        enrichment.has_blockers = content.includes("blocker") || content.includes("Blocker");
      } else {
        enrichment.has_unresolved_issues = false;
        enrichment.has_blockers = false;
      }
    }
  } catch {
  }
  try {
    enrichment.ci_enabled = config ? Boolean(config.ci) : false;
    enrichment.has_test_command = Boolean(config && config.test_command);
  } catch {
  }
  try {
    const COMMAND_TO_AGENT = {
      "bgsd-execute-phase": "bgsd-executor",
      "bgsd-execute-plan": "bgsd-executor",
      "bgsd-quick": "bgsd-executor",
      "bgsd-quick-task": "bgsd-executor",
      "bgsd-settings": "bgsd-executor",
      "bgsd-set-profile": "bgsd-executor",
      "bgsd-validate-config": "bgsd-executor",
      "bgsd-inspect": "bgsd-executor",
      "bgsd-plan": "bgsd-planner",
      "bgsd-plan-phase": "bgsd-planner",
      "bgsd-discuss-phase": "bgsd-planner",
      "bgsd-research-phase": "bgsd-phase-researcher",
      "bgsd-verify-work": "bgsd-verifier",
      "bgsd-audit-milestone": "bgsd-verifier",
      "bgsd-github-ci": "bgsd-verifier",
      "bgsd-map-codebase": "bgsd-codebase-mapper",
      "bgsd-debug": "bgsd-debugger"
    };
    const agentType = COMMAND_TO_AGENT[command] || null;
    if (agentType) {
      enrichment.agent_type = agentType;
    }
    enrichment.model_profile = config ? config.model_profile || "balanced" : "balanced";
    try {
      enrichment.db = getDb(resolvedCwd);
    } catch {
    }
  } catch {
  }
  try {
    if (enrichment.incomplete_plans && enrichment.incomplete_plans.length > 0 && effectivePhaseNum) {
      const p = ensurePlans(effectivePhaseNum);
      if (p && p.length > 0) {
        const firstIncompleteName = enrichment.incomplete_plans[0];
        const incompletePlan = p.find((pl) => pl.path && pl.path.endsWith(firstIncompleteName));
        if (incompletePlan && incompletePlan.frontmatter) {
          const filesModified = incompletePlan.frontmatter.files_modified;
          if (Array.isArray(filesModified)) {
            enrichment.files_modified_count = filesModified.length;
          }
        }
        if (incompletePlan && incompletePlan.tasks) {
          enrichment.task_count = incompletePlan.tasks.length;
        }
      }
    }
  } catch {
  }
  try {
    if (enrichment.phase_goal) {
      const goal = enrichment.phase_goal.toLowerCase();
      enrichment.phase_has_external_deps = /api|external|integration|webhook|oauth|stripe|github/.test(goal);
    } else {
      enrichment.phase_has_external_deps = false;
    }
  } catch {
  }
  try {
    if (enrichment.incomplete_plans && enrichment.incomplete_plans.length > 0 && effectivePhaseNum) {
      const p = ensurePlans(effectivePhaseNum);
      if (p && p.length > 0) {
        const firstIncompleteName = enrichment.incomplete_plans[0];
        const incompletePlan = p.find((pl) => pl.path && pl.path.endsWith(firstIncompleteName));
        if (incompletePlan && incompletePlan.frontmatter && incompletePlan.frontmatter.depends_on) {
          const deps = incompletePlan.frontmatter.depends_on;
          if (Array.isArray(deps) && deps.length > 0 && roadmap) {
            let allComplete = true;
            for (const dep of deps) {
              const depNum = parseFloat(String(dep).replace(/[^0-9.]/g, ""));
              if (!isNaN(depNum)) {
                const depPhase = roadmap.getPhase ? roadmap.getPhase(depNum) : null;
                if (depPhase && depPhase.status !== "complete") {
                  allComplete = false;
                  break;
                }
              }
            }
            enrichment.deps_complete = allComplete;
          } else {
            enrichment.deps_complete = true;
          }
        } else {
          enrichment.deps_complete = true;
        }
      }
    }
  } catch {
  }
  try {
    if (roadmap && roadmap.phases && roadmap.phases.length > 0) {
      enrichment.phases_total = roadmap.phases.length;
      enrichment.phases_complete = roadmap.phases.filter((p) => p.status === "complete").length;
    }
  } catch {
  }
  try {
    if (enrichment.incomplete_plans && enrichment.incomplete_plans.length > 0 && effectivePhaseNum) {
      const p = ensurePlans(effectivePhaseNum);
      if (p && p.length > 0) {
        const firstIncompleteName = enrichment.incomplete_plans[0];
        const incompletePlan = p.find((pl) => pl.path && pl.path.endsWith(firstIncompleteName));
        if (incompletePlan && incompletePlan.frontmatter) {
          const planType = incompletePlan.frontmatter.type || "execute";
          enrichment.plan_type = planType;
          enrichment.is_tdd = planType === "tdd";
        }
      }
    }
  } catch {
  }
  try {
    const toolContext = getToolAvailability(resolvedCwd, { refreshIfNeeded: true });
    enrichment.tool_availability = toolContext.tool_availability;
    enrichment.tool_availability_meta = toolContext.tool_availability_meta;
  } catch {
    enrichment.tool_availability = { ripgrep: null, fd: null, jq: null, yq: null, ast_grep: null, sd: null, hyperfine: null, bat: null, gh: null };
    enrichment.tool_availability_meta = { state: "unknown", source: "fallback" };
  }
  try {
    const localAgentsDir = join13(resolvedCwd, ".opencode", "agents");
    if (existsSync5(localAgentsDir)) {
      const localAgentFiles = readdirSync3(localAgentsDir).filter((f) => f.endsWith(".md"));
      enrichment.local_agent_overrides = localAgentFiles.map((f) => f.replace(".md", ""));
    } else {
      enrichment.local_agent_overrides = [];
    }
  } catch {
    enrichment.local_agent_overrides = [];
  }
  try {
    const skillsDir = join13(resolvedCwd, ".agents", "skills");
    if (existsSync5(skillsDir)) {
      const skillEntries = readdirSync3(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
      const skills = [];
      for (const entry of skillEntries) {
        const skillMdPath = join13(skillsDir, entry.name, "SKILL.md");
        if (existsSync5(skillMdPath)) {
          let description = "";
          try {
            const content = readFileSync9(skillMdPath, "utf8");
            const descMatch = content.match(/^description:\s*(.+)$/m);
            if (descMatch) {
              description = descMatch[1].trim().replace(/^["']|["']$/g, "");
            } else {
              const purposeMatch = content.match(/## Purpose\s*\n+(.+)/);
              if (purposeMatch) description = purposeMatch[1].trim();
            }
          } catch {
          }
          skills.push({ name: entry.name, description });
        }
      }
      enrichment.installed_skills = skills;
    } else {
      enrichment.installed_skills = [];
    }
  } catch {
    enrichment.installed_skills = [];
  }
  try {
    const ta = enrichment.tool_availability || {};
    const capabilityLevel = computeCapabilityLevel(ta);
    enrichment.handoff_tool_context = { capability_level: capabilityLevel };
  } catch {
    enrichment.handoff_tool_context = { capability_level: "UNKNOWN" };
  }
  try {
    const decisions = (0, import_decision_rules.evaluateDecisions)(command, enrichment);
    if (decisions && Object.keys(decisions).length > 0) {
      enrichment.decisions = decisions;
    }
  } catch {
  }
  const _elapsed = typeof performance !== "undefined" && performance.now ? performance.now() - _t0 : Date.now() - _t0;
  enrichment._enrichment_ms = parseFloat(_elapsed.toFixed(3));
  writeDebugDiagnostic("[bgsd-enricher]", `${command} enriched in ${_elapsed.toFixed(1)}ms`);
  if (output.parts) {
    output.parts.unshift({
      type: "text",
      text: `<bgsd-context>
${JSON.stringify(enrichment, null, 2)}
</bgsd-context>`
    });
  }
  if (output.parts && output.parts.length > 1) {
    let sectionsElided = 0;
    const allElidedNames = [];
    let totalTokensSaved = 0;
    for (let idx = 1; idx < output.parts.length; idx++) {
      const part = output.parts[idx];
      if (!part || typeof part.text !== "string") continue;
      if (!part.text.includes("<!-- section:") || !part.text.includes('if="')) continue;
      const result = elideConditionalSections(part.text, enrichment);
      if (result.sections_elided > 0) {
        part.text = result.text;
        sectionsElided += result.sections_elided;
        allElidedNames.push(...result.elided_names);
        totalTokensSaved += result.tokens_saved_estimate;
      }
      if (result.warnings && result.warnings.length > 0) {
        part._elisionWarnings = result.warnings;
      }
    }
    const allDanglingWarnings = [];
    for (let idx = 1; idx < output.parts.length; idx++) {
      const part = output.parts[idx];
      if (part && part._elisionWarnings) {
        allDanglingWarnings.push(...part._elisionWarnings);
        delete part._elisionWarnings;
      }
    }
    if (sectionsElided > 0) {
      enrichment._elision = {
        sections_elided: sectionsElided,
        elided_names: allElidedNames,
        tokens_saved_estimate: totalTokensSaved
      };
      if (allDanglingWarnings.length > 0) {
        enrichment._elision.dangling_warnings = allDanglingWarnings;
      }
      if (output.parts[0] && output.parts[0].text) {
        enrichment.elision_applied = true;
        output.parts[0].text = `<bgsd-context>
${JSON.stringify(enrichment, null, 2)}
</bgsd-context>`;
      }
      if (isDebugEnabled()) {
        writeDebugDiagnostic("[bgsd-enricher]", `elision: removed ${sectionsElided} sections (${allElidedNames.join(", ")}) ~${totalTokensSaved} tokens saved`);
        if (allDanglingWarnings.length > 0) {
          writeDebugDiagnostic("[bgsd-enricher]", `dangling references found: ${allDanglingWarnings.map((w) => w.section).join(", ")}`);
        }
      }
    } else if (allDanglingWarnings.length > 0 && isDebugEnabled()) {
      writeDebugDiagnostic("[bgsd-enricher]", `dangling references found (no elision): ${allDanglingWarnings.map((w) => w.section).join(", ")}`);
    }
  }
}
function detectPhaseArg(parts, commandStr, argumentsStr) {
  if (parts && Array.isArray(parts)) {
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (typeof part === "string") {
        const match = part.match(/^(\d+)$/);
        if (match) {
          return parseInt(match[1], 10);
        }
      }
    }
  }
  if (argumentsStr && typeof argumentsStr === "string") {
    const trimmed = argumentsStr.trim();
    const directMatch = trimmed.match(/^(\d+)$/);
    if (directMatch) {
      return parseInt(directMatch[1], 10);
    }
    const phaseMatch = trimmed.match(/^(?:phase\s+)?(\d+)/i);
    if (phaseMatch) {
      return parseInt(phaseMatch[1], 10);
    }
  }
  if (commandStr && typeof commandStr === "string") {
    const match = commandStr.match(/bgsd-\S+\s+(\d+)(?:\s|$)/);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  return null;
}
function resolvePhaseDir(phaseNum, cwd) {
  const normalized = String(phaseNum).replace(/^0+/, "") || "0";
  const phasesDir = join13(cwd, ".planning", "phases");
  try {
    const entries = readdirSync3(phasesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dirMatch = entry.name.match(/^(\d+(?:\.\d+)?)-?(.*)/);
      if (!dirMatch) continue;
      const dirPhaseNum = dirMatch[1].replace(/^0+/, "") || "0";
      if (dirPhaseNum === normalized) {
        return `.planning/phases/${entry.name}`;
      }
    }
  } catch {
  }
  return null;
}
function listSummaryFiles(phaseDir) {
  try {
    if (!existsSync5(phaseDir)) return [];
    const files = readdirSync3(phaseDir);
    return files.filter((f) => f.endsWith("-SUMMARY.md"));
  } catch {
    return [];
  }
}
function countDiagnosedUatGaps(phaseDir) {
  try {
    if (!existsSync5(phaseDir)) return 0;
    const allFiles = readdirSync3(phaseDir);
    const uatFiles = allFiles.filter((f) => f.endsWith("-UAT.md"));
    let count = 0;
    for (const uf of uatFiles) {
      try {
        const content = readFileSync9(join13(phaseDir, uf), "utf-8");
        if (content.includes("status: diagnosed")) count++;
      } catch {
      }
    }
    return count;
  } catch {
    return 0;
  }
}
function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function elideConditionalSections(text, enrichment) {
  if (!text || typeof text !== "string") {
    return { text: text || "", sections_elided: 0, elided_names: [], tokens_saved_estimate: 0 };
  }
  if (!enrichment || typeof enrichment !== "object") {
    return { text, sections_elided: 0, elided_names: [], tokens_saved_estimate: 0 };
  }
  const CONDITIONAL_OPEN_RE = /<!--\s*section:\s*(\S+)\s+if="([^"]+)"\s*-->/g;
  const SECTION_CLOSE = "<!-- /section -->";
  let result = text;
  let sectionsElided = 0;
  const elidedNames = [];
  let tokensSaved = 0;
  const matches = [];
  let m;
  const re = new RegExp(CONDITIONAL_OPEN_RE.source, "g");
  while ((m = re.exec(text)) !== null) {
    matches.push({
      fullMatch: m[0],
      name: m[1],
      condition: m[2],
      startIndex: m.index
    });
  }
  for (let i = matches.length - 1; i >= 0; i--) {
    const { fullMatch, name, condition, startIndex } = matches[i];
    const shouldKeep = evaluateElisionCondition(condition, enrichment);
    if (shouldKeep) continue;
    const closeIndex = result.indexOf(SECTION_CLOSE, startIndex + fullMatch.length);
    let sectionStart = startIndex;
    let sectionEnd;
    if (closeIndex === -1) {
      sectionEnd = result.length;
    } else {
      sectionEnd = closeIndex + SECTION_CLOSE.length;
    }
    const removedContent = result.slice(sectionStart, sectionEnd);
    tokensSaved += Math.ceil(removedContent.length / 4);
    const afterSection = result.slice(sectionEnd);
    const trailingNewline = afterSection.startsWith("\n") ? "\n" : "";
    result = result.slice(0, sectionStart) + afterSection.slice(trailingNewline.length);
    sectionsElided++;
    elidedNames.unshift(name);
  }
  const warnings = [];
  if (elidedNames.length > 0) {
    const lines = result.split("\n");
    for (const name of elidedNames) {
      const wordRe = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
      const matchingLines = lines.filter((line) => wordRe.test(line));
      if (matchingLines.length > 0) {
        warnings.push({ section: name, references: matchingLines });
      }
    }
  }
  return {
    text: result,
    sections_elided: sectionsElided,
    elided_names: elidedNames,
    tokens_saved_estimate: tokensSaved,
    warnings
  };
}
function evaluateElisionCondition(key, enrichment) {
  if (!key) return true;
  if (Object.prototype.hasOwnProperty.call(enrichment, key)) {
    const val = enrichment[key];
    if (val === "true") return true;
    if (val === "false") return false;
    return Boolean(val);
  }
  if (enrichment.decisions && typeof enrichment.decisions === "object") {
    const decision = enrichment.decisions[key];
    if (decision !== void 0 && decision !== null) {
      const val = typeof decision === "object" ? decision.value : decision;
      if (val === "true") return true;
      if (val === "false") return false;
      return Boolean(val);
    }
  }
  return true;
}

// src/plugin/tools/bgsd-status.js
var bgsd_status = {
  description: "Get current bGSD execution state \u2014 phase, plan, tasks, progress, blockers.\n\nCall this to understand where the project is right now. Returns structured JSON with the current phase number and name, active plan, full task list with completion statuses, progress percentage, and any blockers.\n\nRequires an active bGSD project (.planning/ directory).",
  args: {},
  async execute(args, context) {
    try {
      const projectDir = context?.directory || process.cwd();
      const projectState = getProjectState(projectDir);
      if (!projectState) {
        return JSON.stringify({
          status: "no_project",
          message: "No .planning/ directory found. Run /bgsd-new-project to initialize a project."
        });
      }
      const { state, plans } = projectState;
      let phase = null;
      if (state.phase) {
        const phaseMatch = state.phase.match(/^(\d+)\s*[—\-]\s*(.+)/);
        if (phaseMatch) {
          phase = { number: phaseMatch[1], name: phaseMatch[2].trim() };
        } else {
          const numOnly = state.phase.match(/^(\d+)/);
          phase = numOnly ? { number: numOnly[1], name: null } : null;
        }
      }
      let plan = null;
      if (state.currentPlan && state.currentPlan !== "Not started") {
        plan = { id: state.currentPlan, status: state.status || "in_progress" };
      }
      let blockers = [];
      const blockersSection = state.getSection("Blockers/Concerns");
      if (blockersSection) {
        blockers = blockersSection.split("\n").map((line) => line.replace(/^[-*]\s*/, "").trim()).filter((line) => line.length > 0 && line.toLowerCase() !== "none");
      }
      const tasks = [];
      for (const p of plans) {
        const planId = p.frontmatter.plan ? "P" + String(p.frontmatter.plan).padStart(2, "0") : null;
        for (let i = 0; i < p.tasks.length; i++) {
          const t = p.tasks[i];
          tasks.push({
            plan: planId,
            task: i + 1,
            name: t.name || null,
            files: t.files || [],
            status: "pending"
          });
        }
      }
      const result = {
        phase,
        plan,
        progress: state.progress !== null ? state.progress : null,
        tasks,
        blockers
      };
      return JSON.stringify(result);
    } catch (err) {
      return JSON.stringify({
        error: "runtime_error",
        message: "Failed to read project state: " + err.message
      });
    }
  }
};

// src/plugin/tools/bgsd-plan.js
import { z } from "zod";
await init_roadmap();
await init_plan();
var bgsd_plan = {
  description: "Get roadmap overview or detailed phase information.\n\nTwo modes:\n- No args: returns all phases with status, goal, and plan count (roadmap summary)\n- With phase number: returns detailed phase info (goal, requirements, success criteria, dependencies) plus plan contents (tasks, objectives) if plans exist\n\nUse no-args mode to understand project structure. Use phase mode to dive into specific phase details.",
  args: {
    phase: z.coerce.number().optional().describe("Phase number to get details for. Omit for roadmap overview.")
  },
  async execute(args, context) {
    try {
      const projectDir = context?.directory || process.cwd();
      const projectState = getProjectState(projectDir);
      if (!projectState) {
        return JSON.stringify({
          status: "no_project",
          message: "No .planning/ directory found. Run /bgsd-new-project to initialize a project."
        });
      }
      const { roadmap } = projectState;
      if (!roadmap) {
        return JSON.stringify({
          error: "runtime_error",
          message: "ROADMAP.md could not be parsed. Run /bgsd-inspect health to diagnose."
        });
      }
      if (args.phase !== void 0 && args.phase !== null && isNaN(Number(args.phase))) {
        return JSON.stringify({
          error: "validation_error",
          message: "Invalid input: expected number, received NaN"
        });
      }
      if (args.phase === void 0 || args.phase === null) {
        const phases = roadmap.phases.map((p) => ({
          number: p.number,
          name: p.name,
          status: p.status,
          goal: p.goal,
          planCount: p.planCount
        }));
        const currentMilestone = roadmap.currentMilestone ? { name: roadmap.currentMilestone.name, version: roadmap.currentMilestone.version, status: roadmap.currentMilestone.status } : null;
        return JSON.stringify({ phases, currentMilestone });
      }
      const phaseDetail = roadmap.getPhase(args.phase);
      if (!phaseDetail) {
        return JSON.stringify({
          error: "validation_error",
          message: `Phase ${args.phase} not found in roadmap. Call bgsd_plan with no args to see available phases.`
        });
      }
      const plans = parsePlans(args.phase, projectDir);
      const planData = plans.map((p) => ({
        plan: p.frontmatter.plan || null,
        wave: p.frontmatter.wave || null,
        objective: p.objective || null,
        tasks: p.tasks.map((t) => ({
          name: t.name,
          type: t.type,
          files: t.files
        })),
        requirements: p.frontmatter.requirements || []
      }));
      return JSON.stringify({
        phase: {
          number: phaseDetail.number,
          name: phaseDetail.name,
          goal: phaseDetail.goal,
          dependsOn: phaseDetail.dependsOn,
          requirements: phaseDetail.requirements,
          successCriteria: phaseDetail.successCriteria,
          plans: planData
        }
      });
    } catch (err) {
      return JSON.stringify({
        error: "runtime_error",
        message: "Failed to read roadmap data: " + err.message
      });
    }
  }
};

// src/plugin/tools/bgsd-context.js
import { z as z2 } from "zod";
var bgsd_context = {
  description: "Get task-scoped context for the current or specified task.\n\nReturns file paths, line ranges, and summaries relevant to a specific task \u2014 not actual file contents (use the Read tool for that).\n\nDefaults to the current task from STATE.md. Pass a task number to get context for a different task in the current plan.",
  args: {
    task: z2.coerce.number().optional().describe("Task number within current plan. Defaults to current task.")
  },
  async execute(args, context) {
    try {
      const projectDir = context?.directory || process.cwd();
      const projectState = getProjectState(projectDir);
      if (!projectState) {
        return JSON.stringify({
          status: "no_project",
          message: "No .planning/ directory found. Run /bgsd-new-project to initialize a project."
        });
      }
      const { plans } = projectState;
      const phaseNumber = projectState.state?.phase?.match(/^(\d+(?:\.\d+)?)/)?.[1] || null;
      if (!plans || plans.length === 0) {
        const nextCommand = phaseNumber ? `/bgsd-plan phase ${phaseNumber}` : "/bgsd-inspect progress";
        return JSON.stringify({
          error: "validation_error",
          message: phaseNumber ? `No plans found for current phase. Run ${nextCommand} to create plans.` : `No plans found for the active phase. Run ${nextCommand} to confirm the current phase before planning.`
        });
      }
      let currentPlan = plans[0];
      if (projectState.state.currentPlan) {
        const planNum = projectState.state.currentPlan.match(/(\d+)/);
        if (planNum) {
          const found = plans.find(
            (p) => p.frontmatter.plan === planNum[1] || p.frontmatter.plan === parseInt(planNum[1], 10)
          );
          if (found) currentPlan = found;
        }
      }
      const planId = currentPlan.frontmatter.plan ? "P" + String(currentPlan.frontmatter.plan).padStart(2, "0") : null;
      if (args.task !== void 0 && args.task !== null && isNaN(Number(args.task))) {
        return JSON.stringify({
          error: "validation_error",
          message: "Invalid input: expected number, received NaN"
        });
      }
      const taskNumber = args.task;
      const taskIndex = taskNumber ? taskNumber - 1 : 0;
      const totalTasks = currentPlan.tasks.length;
      if (taskIndex < 0 || taskIndex >= totalTasks) {
        return JSON.stringify({
          error: "validation_error",
          message: `Task ${taskNumber} not found. Current plan has ${totalTasks} task${totalTasks !== 1 ? "s" : ""}.`
        });
      }
      const task = currentPlan.tasks[taskIndex];
      return JSON.stringify({
        task: {
          number: taskIndex + 1,
          name: task.name || null,
          files: task.files || [],
          action: task.action || null,
          done: task.done || null
        },
        plan: {
          id: planId,
          objective: currentPlan.objective || null,
          verification: currentPlan.verification || null,
          filesModified: currentPlan.frontmatter.files_modified || []
        }
      });
    } catch (err) {
      return JSON.stringify({
        error: "runtime_error",
        message: "Failed to read task context: " + err.message
      });
    }
  }
};

// src/plugin/tools/bgsd-validate.js
var bgsd_validate = {
  description: "Validate bGSD project state, roadmap, plans, and requirement traceability.\n\nRuns comprehensive checks across all planning files. Auto-fixes trivial formatting issues (like progress bar mismatches). Reports remaining issues categorized by severity: error (must fix), warning (should fix), info (note).\n\nReturns all issues found. An empty issues array means everything is valid.",
  args: {},
  async execute(args, context) {
    try {
      const projectDir = context?.directory || process.cwd();
      const projectState = getProjectState(projectDir);
      if (!projectState) {
        return JSON.stringify({
          status: "no_project",
          message: "No .planning/ directory found. Run /bgsd-new-project to initialize a project."
        });
      }
      const { state, roadmap, plans } = projectState;
      const issues = [];
      if (!state.phase) {
        issues.push({ severity: "error", check: "state_phase", message: "STATE.md missing **Phase:** field" });
      } else if (roadmap) {
        const phaseMatch = state.phase.match(/^(\d+)/);
        if (phaseMatch) {
          const phaseNum = phaseMatch[1];
          const found = roadmap.phases.find((p) => p.number === phaseNum);
          if (!found) {
            issues.push({ severity: "error", check: "state_phase", message: `STATE.md phase ${phaseNum} not found in ROADMAP.md` });
          }
        }
      }
      if (!state.currentPlan) {
        issues.push({ severity: "warning", check: "state_plan", message: "STATE.md missing **Current Plan:** field" });
      }
      if (state.progress === null) {
        issues.push({ severity: "warning", check: "state_progress", message: "STATE.md missing progress bar or percentage" });
      } else if (state.progress < 0 || state.progress > 100) {
        issues.push({ severity: "error", check: "state_progress", message: `STATE.md progress ${state.progress}% out of range (0-100)` });
      }
      if (!state.lastActivity) {
        issues.push({ severity: "warning", check: "state_activity", message: "STATE.md missing **Last Activity:** field" });
      } else {
        const dateTest = Date.parse(state.lastActivity);
        if (isNaN(dateTest)) {
          issues.push({ severity: "warning", check: "state_activity", message: `STATE.md Last Activity date invalid: ${state.lastActivity}` });
        }
      }
      if (!roadmap) {
        issues.push({ severity: "error", check: "roadmap_exists", message: "ROADMAP.md could not be parsed" });
      } else {
        for (const phase of roadmap.phases) {
          if (!phase.goal) {
            issues.push({ severity: "warning", check: "roadmap_goals", message: `Phase ${phase.number} (${phase.name}) missing goal` });
          }
        }
        const phaseNums = roadmap.phases.map((p) => parseInt(p.number, 10)).sort((a, b) => a - b);
        for (let i = 1; i < phaseNums.length; i++) {
          const gap = phaseNums[i] - phaseNums[i - 1];
          if (gap > 1) {
            issues.push({ severity: "info", check: "roadmap_sequence", message: `Phase number gap: ${phaseNums[i - 1]} to ${phaseNums[i]}` });
          }
        }
        const currentMilestone = roadmap.currentMilestone;
        if (currentMilestone && currentMilestone.phases) {
          const milestonePhases = roadmap.phases.filter((p) => {
            const num = parseInt(p.number, 10);
            return num >= currentMilestone.phases.start && num <= currentMilestone.phases.end;
          });
          const hasIncomplete = milestonePhases.some((p) => p.status !== "complete");
          if (!hasIncomplete && milestonePhases.length > 0) {
            issues.push({ severity: "info", check: "roadmap_milestone", message: "Current milestone has no incomplete phases \u2014 may need to advance" });
          }
        }
      }
      if (plans && plans.length > 0) {
        for (const plan of plans) {
          const planId = plan.frontmatter.plan ? `P${String(plan.frontmatter.plan).padStart(2, "0")}` : "unknown";
          const fm = plan.frontmatter;
          if (!fm.phase) {
            issues.push({ severity: "error", check: "plan_frontmatter", message: `${planId}: missing 'phase' in frontmatter` });
          }
          if (!fm.plan) {
            issues.push({ severity: "error", check: "plan_frontmatter", message: `${planId}: missing 'plan' in frontmatter` });
          }
          if (!fm.type) {
            issues.push({ severity: "warning", check: "plan_frontmatter", message: `${planId}: missing 'type' in frontmatter` });
          }
          for (let i = 0; i < plan.tasks.length; i++) {
            const task = plan.tasks[i];
            if (!task.name) {
              issues.push({ severity: "warning", check: "plan_tasks", message: `${planId} Task ${i + 1}: missing name` });
            }
            if (!task.action) {
              issues.push({ severity: "warning", check: "plan_tasks", message: `${planId} Task ${i + 1}: missing action element` });
            }
          }
        }
      }
      if (roadmap && plans && plans.length > 0) {
        const planReqIds = /* @__PURE__ */ new Set();
        for (const plan of plans) {
          const reqs = plan.frontmatter.requirements;
          if (Array.isArray(reqs)) {
            for (const r of reqs) planReqIds.add(r);
          }
        }
        if (state.phase) {
          const phaseMatch = state.phase.match(/^(\d+)/);
          if (phaseMatch) {
            const phaseDetail = roadmap.getPhase(parseInt(phaseMatch[1], 10));
            if (phaseDetail && phaseDetail.requirements) {
              const roadmapReqs = phaseDetail.requirements.split(",").map((r) => r.trim()).filter((r) => r.length > 0);
              for (const req of roadmapReqs) {
                if (!planReqIds.has(req)) {
                  issues.push({ severity: "warning", check: "req_traceability", message: `Requirement ${req} in roadmap not covered by any plan` });
                }
              }
              const roadmapReqSet = new Set(roadmapReqs);
              for (const req of planReqIds) {
                if (!roadmapReqSet.has(req)) {
                  issues.push({ severity: "info", check: "req_traceability", message: `Requirement ${req} in plans but not in roadmap phase requirements` });
                }
              }
            }
          }
        }
      }
      if (state.progress !== null && state.raw) {
        const barMatch = state.raw.match(/[\u2588\u2591]+\]\s*(\d+)%/);
        if (barMatch) {
          const bar = barMatch[0];
          const pct = parseInt(barMatch[1], 10);
          const filledMatch = bar.match(/\u2588/g);
          const filled = filledMatch ? filledMatch.length : 0;
          const totalMatch = bar.match(/[\u2588\u2591]/g);
          const total = totalMatch ? totalMatch.length : 0;
          const expectedFilled = Math.round(pct / 100 * total);
          if (filled !== expectedFilled) {
            issues.push({ severity: "info", check: "state_progress_bar", message: `Progress bar visual (${filled}/${total} filled) doesn't match ${pct}% \u2014 could be auto-fixed` });
          }
        }
      }
      const errors = issues.filter((i) => i.severity === "error").length;
      const warnings = issues.filter((i) => i.severity === "warning").length;
      const info = issues.filter((i) => i.severity === "info").length;
      return JSON.stringify({
        valid: errors === 0,
        issues,
        summary: { errors, warnings, info }
      });
    } catch (err) {
      return JSON.stringify({
        error: "runtime_error",
        message: "Failed to validate project: " + err.message
      });
    }
  }
};

// src/plugin/tools/bgsd-progress.js
import { z as z3 } from "zod";
import { execFileSync as execFileSync2 } from "child_process";
import { existsSync as existsSync6 } from "fs";
import { dirname as dirname3, join as join14 } from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
await init_state();
await init_plan();
var VALID_ACTIONS = ["complete-task", "uncomplete-task", "add-blocker", "remove-blocker", "record-decision", "advance"];
function resolveCliPath2() {
  const currentDir = dirname3(fileURLToPath2(import.meta.url));
  const candidates = [
    process.env.BGSD_PLUGIN_DIR ? join14(process.env.BGSD_PLUGIN_DIR, "bin", "bgsd-tools.cjs") : null,
    join14(currentDir, "..", "..", "..", "bin", "bgsd-tools.cjs"),
    join14(currentDir, "bin", "bgsd-tools.cjs"),
    join14(currentDir, "..", "bin", "bgsd-tools.cjs")
  ];
  for (const candidate of candidates) {
    if (candidate && existsSync6(candidate)) return candidate;
  }
  throw new Error("Could not locate bgsd-tools.cjs");
}
function runCanonicalStateCommand(projectDir, args) {
  const cliPath = resolveCliPath2();
  const output = execFileSync2(process.execPath, [cliPath, "verify:state", ...args], {
    cwd: projectDir,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  return JSON.parse(String(output || "{}").trim() || "{}");
}
var bgsd_progress = {
  description: "Update bGSD project progress \u2014 mark tasks complete, add/remove blockers, record decisions, advance plan.\n\nSingle tool with an action parameter:\n- complete-task: Mark the next pending task as complete\n- uncomplete-task: Un-complete the last completed task\n- add-blocker: Add a blocker to STATE.md\n- remove-blocker: Remove a blocker by index\n- record-decision: Record a decision to STATE.md\n- advance: Advance to next plan (when current plan is complete)\n\nUpdates files on disk (STATE.md, PLAN.md). Does NOT create git commits \u2014 the agent handles commits separately.\n\nReturns updated state snapshot after the change.",
  args: {
    action: z3.enum(VALID_ACTIONS).describe("The progress action to perform"),
    value: z3.string().optional().describe("Value for the action: blocker text for add-blocker, blocker index (1-based) for remove-blocker, decision text for record-decision. Not needed for complete-task, uncomplete-task, advance.")
  },
  async execute(args, context) {
    const projectDir = context?.directory || process.cwd();
    try {
      if (!args.action || !VALID_ACTIONS.includes(args.action)) {
        return JSON.stringify({
          error: "validation_error",
          message: `Invalid option: expected one of ${VALID_ACTIONS.map((a) => `"${a}"`).join("|")}`
        });
      }
      const projectState = getProjectState(projectDir);
      if (!projectState) {
        return JSON.stringify({
          status: "no_project",
          message: "No .planning/ directory found. Run /bgsd-new-project to initialize a project."
        });
      }
      if ((args.action === "add-blocker" || args.action === "record-decision") && !args.value) {
        return JSON.stringify({
          error: "validation_error",
          message: `Action '${args.action}' requires a 'value' parameter.`
        });
      }
      if (args.action === "remove-blocker" && !args.value) {
        return JSON.stringify({
          error: "validation_error",
          message: "Action 'remove-blocker' requires a 'value' parameter (blocker index, 1-based)."
        });
      }
      const { state } = projectState;
      let actionResult = null;
      switch (args.action) {
        case "complete-task": {
          const currentProgress = state.progress !== null ? state.progress : 0;
          const newProgress = Math.min(100, currentProgress + 10);
          runCanonicalStateCommand(projectDir, ["patch", `--Progress`, String(newProgress)]);
          actionResult = `Progress updated to ${newProgress}%`;
          break;
        }
        case "uncomplete-task": {
          const currentProgress = state.progress !== null ? state.progress : 0;
          const newProgress = Math.max(0, currentProgress - 10);
          runCanonicalStateCommand(projectDir, ["patch", `--Progress`, String(newProgress)]);
          actionResult = `Progress reverted to ${newProgress}%`;
          break;
        }
        case "add-blocker": {
          runCanonicalStateCommand(projectDir, ["add-blocker", "--text", args.value]);
          actionResult = `Blocker added: ${args.value}`;
          break;
        }
        case "remove-blocker": {
          const idx = parseInt(args.value, 10);
          if (isNaN(idx) || idx < 1) {
            return JSON.stringify({
              error: "validation_error",
              message: "remove-blocker value must be a positive integer (1-based index)."
            });
          }
          const blockers = listOpenBlockers(state.raw || "");
          if (blockers.error) {
            return JSON.stringify({
              error: "validation_error",
              message: blockers.error
            });
          }
          if (idx > blockers.entries.length) {
            return JSON.stringify({
              error: "validation_error",
              message: `Blocker index ${idx} out of range. Found ${blockers.entries.length} blocker(s).`
            });
          }
          runCanonicalStateCommand(projectDir, ["resolve-blocker", "--text", blockers.entries[idx - 1]]);
          actionResult = `Blocker ${idx} removed`;
          break;
        }
        case "record-decision": {
          const phaseTag = state.phase ? state.phase.match(/^(\d+)/)?.[1] || "?" : "?";
          runCanonicalStateCommand(projectDir, ["add-decision", "--phase", phaseTag, "--summary", args.value]);
          actionResult = `Decision recorded: ${args.value}`;
          break;
        }
        case "advance": {
          const result = runCanonicalStateCommand(projectDir, ["advance-plan"]);
          actionResult = result.advanced === false ? "No current plan advanced" : `Advanced to Plan ${String(result.current_plan).padStart(2, "0")}`;
          break;
        }
      }
      invalidateState(projectDir);
      invalidatePlans(projectDir);
      const freshState = getProjectState(projectDir);
      const fresh = freshState ? freshState.state : null;
      return JSON.stringify({
        success: true,
        action: args.action,
        result: actionResult,
        state: {
          phase: fresh ? fresh.phase : null,
          plan: fresh ? fresh.currentPlan : null,
          progress: fresh ? fresh.progress : null,
          status: fresh ? fresh.status : null
        }
      });
    } catch (err) {
      return JSON.stringify({
        error: "runtime_error",
        message: "Failed to update progress: " + err.message
      });
    }
  }
};
function listOpenBlockers(content) {
  const match = content.match(/(###\s*(?:Blockers|Blockers\/Concerns|Concerns)\s*\n)([\s\S]*?)(?=\n###|\n## |$)/i);
  if (!match) {
    return { error: "No Blockers/Concerns section found in STATE.md" };
  }
  const entries = match[2].split("\n").map((line) => line.match(/^\s*[-*]\s+(.+)$/)?.[1]?.trim() || null).filter((line) => line && !/^none(?: yet)?\.?$/i.test(line));
  return { entries };
}

// src/plugin/tools/index.js
function getTools(registry) {
  registry.registerTool("status", bgsd_status);
  registry.registerTool("plan", bgsd_plan);
  registry.registerTool("context", bgsd_context);
  registry.registerTool("validate", bgsd_validate);
  registry.registerTool("progress", bgsd_progress);
  return registry.getTools();
}

// src/plugin/notification.js
import { homedir as homedir2 } from "os";
import { join as join15 } from "path";
function createNotifier($, directory) {
  const MAX_HISTORY = 20;
  const DEFAULT_RATE_LIMIT = 5;
  const DEDUP_WINDOW_MS = 5e3;
  const history = [];
  let pendingContext = [];
  let dndMode = false;
  let dndSuppressedCount = 0;
  let rateLimitTimestamps = [];
  let rateLimitPerMinute = DEFAULT_RATE_LIMIT;
  const recentKeys = /* @__PURE__ */ new Map();
  let logger = null;
  function getLogger() {
    if (!logger) {
      const logDir = join15(homedir2(), ".config", "opencode");
      logger = createLogger(logDir);
    }
    return logger;
  }
  async function sendOsNotification(message) {
    if (!$) return;
    try {
      const safeMsg = String(message).replace(/["`$\\]/g, "\\$&");
      if (process.platform === "darwin") {
        await $`osascript -e ${'display notification "' + safeMsg + '" with title "bGSD"'}`.quiet();
      } else {
        await $`notify-send "bGSD" ${safeMsg}`.quiet();
      }
    } catch (err) {
      getLogger().write("WARN", `OS notification failed: ${err.message}`);
    }
  }
  function isDuplicate(notification) {
    const key = `${notification.type}:${notification.message}`;
    const now = Date.now();
    const lastSeen = recentKeys.get(key);
    if (lastSeen && now - lastSeen < DEDUP_WINDOW_MS) {
      return true;
    }
    recentKeys.set(key, now);
    for (const [k, ts] of recentKeys) {
      if (now - ts > DEDUP_WINDOW_MS) {
        recentKeys.delete(k);
      }
    }
    return false;
  }
  function checkRateLimit() {
    const now = Date.now();
    const windowStart = now - 6e4;
    rateLimitTimestamps = rateLimitTimestamps.filter((ts) => ts > windowStart);
    if (rateLimitTimestamps.length >= rateLimitPerMinute) {
      return false;
    }
    rateLimitTimestamps.push(now);
    return true;
  }
  async function notify(notification) {
    const { type, severity, message, action } = notification;
    const timestamp = Date.now();
    const entry = { type, severity, message, action, timestamp };
    history.push(entry);
    if (history.length > MAX_HISTORY) {
      history.shift();
    }
    if (isDuplicate(notification)) {
      return;
    }
    if (!checkRateLimit()) {
      getLogger().write("WARN", `Rate limit exceeded, dropping notification: ${type}`);
      return;
    }
    if (dndMode && severity !== "critical") {
      dndSuppressedCount++;
      return;
    }
    if (severity === "critical" || severity === "warning") {
      await sendOsNotification(message);
    }
    pendingContext.push({ type, severity, message, timestamp });
  }
  function drainPendingContext() {
    const items = [...pendingContext];
    pendingContext = [];
    return items;
  }
  function getHistory() {
    return [...history];
  }
  function setDnd(enabled) {
    dndMode = !!enabled;
    if (!enabled) {
      const count = dndSuppressedCount;
      dndSuppressedCount = 0;
      if (count > 0) {
        pendingContext.push({
          type: "dnd-summary",
          severity: "info",
          message: `${count} notification${count === 1 ? "" : "s"} suppressed during DND. DND summaries are informational only and are not replayable by command.`,
          timestamp: Date.now()
        });
      }
      return count;
    }
  }
  function resetCounters() {
    rateLimitTimestamps = [];
  }
  function setRateLimit(limit) {
    if (typeof limit === "number" && limit > 0) {
      rateLimitPerMinute = limit;
    }
  }
  return {
    notify,
    drainPendingContext,
    getHistory,
    setDnd,
    resetCounters,
    setRateLimit
  };
}

// src/plugin/file-watcher.js
await init_parsers();
import { watch } from "fs";
import { existsSync as existsSync7 } from "fs";
import { join as join16 } from "path";
import { homedir as homedir3 } from "os";
function createFileWatcher(cwd, options = {}) {
  const { debounceMs = 200, maxWatchedPaths = 500, onExternalChange = null } = options;
  const planningDir = join16(cwd, ".planning");
  let controller = null;
  let watching = false;
  let debounceTimer = null;
  let pendingPaths = /* @__PURE__ */ new Set();
  let eventCount = 0;
  let capWarned = false;
  const selfWrites = /* @__PURE__ */ new Set();
  const selfWriteTimers = /* @__PURE__ */ new Map();
  let logger = null;
  function getLogger() {
    if (!logger) {
      const logDir = join16(homedir3(), ".config", "opencode");
      logger = createLogger(logDir);
    }
    return logger;
  }
  function processPendingEvents() {
    if (pendingPaths.size === 0) return;
    const paths = [...pendingPaths];
    pendingPaths.clear();
    const externalPaths = paths.filter((p) => !selfWrites.has(p));
    if (externalPaths.length > 0) {
      invalidateAll(cwd);
      if (typeof onExternalChange === "function") {
        for (const filePath of externalPaths) {
          try {
            onExternalChange(filePath);
          } catch {
          }
        }
      }
    }
  }
  function onWatchEvent(eventType, filename) {
    if (!filename) return;
    const fullPath = join16(planningDir, filename);
    eventCount++;
    if (!capWarned && eventCount > maxWatchedPaths) {
      capWarned = true;
      getLogger().write("WARN", `File watcher: event count (${eventCount}) exceeds cap (${maxWatchedPaths}). Possible excessive file activity.`);
    }
    if (selfWrites.has(fullPath)) {
      return;
    }
    pendingPaths.add(fullPath);
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(processPendingEvents, debounceMs);
  }
  function start() {
    if (watching) return;
    if (!existsSync7(planningDir)) {
      getLogger().write("INFO", `File watcher: .planning/ not found at ${cwd}, skipping watch`);
      return;
    }
    try {
      controller = new AbortController();
      watch(planningDir, { recursive: true, signal: controller.signal }, onWatchEvent);
      watching = true;
      eventCount = 0;
      capWarned = false;
    } catch (err) {
      getLogger().write("ERROR", `File watcher: failed to start: ${err.message}`);
      watching = false;
      controller = null;
    }
  }
  function stop() {
    if (controller) {
      try {
        controller.abort();
      } catch {
      }
      controller = null;
    }
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    for (const timer of selfWriteTimers.values()) {
      clearTimeout(timer);
    }
    selfWriteTimers.clear();
    selfWrites.clear();
    pendingPaths.clear();
    watching = false;
  }
  function trackSelfWrite(filePath) {
    selfWrites.add(filePath);
    const existing = selfWriteTimers.get(filePath);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      selfWrites.delete(filePath);
      selfWriteTimers.delete(filePath);
    }, 200);
    selfWriteTimers.set(filePath, timer);
  }
  function isWatching() {
    return watching;
  }
  return {
    start,
    stop,
    trackSelfWrite,
    isWatching
  };
}

// src/plugin/idle-validator.js
import { existsSync as existsSync8, readFileSync as readFileSync10, writeFileSync as writeFileSync3 } from "fs";
import { join as join17 } from "path";
import { execSync } from "child_process";
import { homedir as homedir4 } from "os";
await init_state();
await init_roadmap();
init_config();
function createIdleValidator(cwd, notifier, fileWatcher, config) {
  const planningDir = join17(cwd, ".planning");
  let lastValidation = 0;
  let lastAutoFix = 0;
  let validating = false;
  const cooldownMs = (config.idle_validation?.cooldown_seconds || 5) * 1e3;
  const stalenessHours = config.idle_validation?.staleness_threshold_hours || 2;
  const enabled = config.idle_validation?.enabled !== false;
  let logger = null;
  function getLogger() {
    if (!logger) {
      const logDir = join17(homedir4(), ".config", "opencode");
      logger = createLogger(logDir);
    }
    return logger;
  }
  function readStateMd() {
    try {
      return readFileSync10(join17(planningDir, "STATE.md"), "utf-8");
    } catch {
      return null;
    }
  }
  function readRoadmapMd() {
    try {
      return readFileSync10(join17(planningDir, "ROADMAP.md"), "utf-8");
    } catch {
      return null;
    }
  }
  function writeTracked(filePath, content) {
    fileWatcher.trackSelfWrite(filePath);
    writeFileSync3(filePath, content);
  }
  function getLastGitTimestamp() {
    try {
      const output = execSync("git log -1 --format=%ct", {
        cwd,
        encoding: "utf-8",
        timeout: 3e3,
        stdio: ["pipe", "pipe", "pipe"]
      });
      return parseInt(output.trim(), 10) || null;
    } catch {
      return null;
    }
  }
  function fixProgressBar(raw, pct) {
    const barMatch = raw.match(/\[([\u2588\u2591]+)\]\s*(\d+)%/);
    if (!barMatch) return null;
    const bar = barMatch[1];
    const total = bar.length;
    const filled = (bar.match(/\u2588/g) || []).length;
    const expectedFilled = Math.round(pct / 100 * total);
    if (filled === expectedFilled) return null;
    const newBar = "\u2588".repeat(expectedFilled) + "\u2591".repeat(total - expectedFilled);
    return raw.replace(barMatch[0], `[${newBar}] ${pct}%`);
  }
  async function onIdle() {
    try {
      if (!enabled) return;
      if (!existsSync8(planningDir)) return;
      if (Date.now() - lastValidation < cooldownMs) return;
      if (lastAutoFix > lastValidation) return;
      if (validating) return;
      invalidateState(cwd);
      const state = parseState(cwd);
      if (state) {
        const status = (state.status || "").toLowerCase();
        if (status.includes("executing") || status.includes("in progress")) {
          const lastGit = getLastGitTimestamp();
          if (lastGit) {
            const hoursAgo = (Date.now() / 1e3 - lastGit) / 3600;
            if (hoursAgo < stalenessHours) {
              return;
            }
          } else {
            return;
          }
        }
      }
      validating = true;
      let anyFix = false;
      invalidateRoadmap(cwd);
      const roadmap = parseRoadmap(cwd);
      const stateRaw = readStateMd();
      if (state && roadmap && stateRaw) {
        const phaseMatch = state.phase ? state.phase.match(/^(\d+)/) : null;
        if (phaseMatch) {
          const phaseNum = parseInt(phaseMatch[1], 10);
          const rPhase = roadmap.getPhase(phaseNum);
          if (!rPhase) {
            getLogger().write("WARN", `Idle validation: STATE.md phase ${phaseNum} not found in ROADMAP.md`);
          }
          if (rPhase && rPhase.status === "complete") {
            const nextPhase = roadmap.phases.find((p) => {
              const pNum = parseInt(p.number, 10);
              return pNum > phaseNum && p.status !== "complete";
            });
            if (nextPhase) {
              await notifier.notify({
                type: "phase-complete",
                severity: "warning",
                message: `Phase ${phaseNum} complete! Next: Phase ${nextPhase.number} (${nextPhase.name}). Verify against this repo's current checkout, and rebuild the local runtime before trusting generated guidance if runtime surfaces changed.`,
                action: `Next: /bgsd-plan phase ${nextPhase.number}`
              });
            }
          }
        }
        if (state.progress !== null) {
          const fixed = fixProgressBar(stateRaw, state.progress);
          if (fixed) {
            const statePath = join17(planningDir, "STATE.md");
            writeTracked(statePath, fixed);
            invalidateState(cwd);
            anyFix = true;
            getLogger().write("INFO", `Idle validation: fixed progress bar visual`);
          }
        }
      }
      invalidateConfig(cwd);
      const freshConfig = parseConfig(cwd);
      if (freshConfig) {
        const configPath = join17(planningDir, "config.json");
        if (existsSync8(configPath)) {
          try {
            const raw = readFileSync10(configPath, "utf-8");
            JSON.parse(raw);
          } catch {
            writeTracked(configPath, buildDefaultConfigText());
            invalidateConfig(cwd);
            anyFix = true;
            getLogger().write("WARN", `Idle validation: auto-fixed corrupt config.json with defaults`);
          }
        }
      }
      if (state && stateRaw) {
        const status = (state.status || "").toLowerCase();
        if (status.includes("executing") || status.includes("in progress")) {
          const lastGit = getLastGitTimestamp();
          if (lastGit) {
            const hoursAgo = (Date.now() / 1e3 - lastGit) / 3600;
            if (hoursAgo >= stalenessHours) {
              const statePath = join17(planningDir, "STATE.md");
              const updatedRaw = stateRaw.replace(
                /\*\*Status:\*\*\s*.+/i,
                "**Status:** Paused (auto-detected stale)"
              );
              if (updatedRaw !== stateRaw) {
                writeTracked(statePath, updatedRaw);
                invalidateState(cwd);
                anyFix = true;
                getLogger().write("INFO", `Idle validation: auto-fixed stale status (${hoursAgo.toFixed(1)}h idle)`);
              }
            }
          }
        }
      }
      if (anyFix) {
        lastAutoFix = Date.now();
        await notifier.notify({
          type: "state-sync",
          severity: "info",
          message: "State synced"
        });
      }
      validating = false;
      lastValidation = Date.now();
    } catch (err) {
      validating = false;
      lastValidation = Date.now();
      getLogger().write("ERROR", `Idle validation error: ${err.message}`);
    }
  }
  function onUserInput() {
    lastAutoFix = 0;
  }
  return {
    onIdle,
    onUserInput
  };
}

// src/plugin/stuck-detector.js
import { homedir as homedir5 } from "os";
import { join as join18 } from "path";
function createStuckDetector(notifier, config) {
  const errorThreshold = config.stuck_detection?.error_threshold || 3;
  const spinningThreshold = config.stuck_detection?.spinning_threshold || 5;
  const errorStreaks = /* @__PURE__ */ new Map();
  let escalationLevel = 0;
  const recentCalls = [];
  const MAX_RECENT_CALLS = 50;
  let logger = null;
  function getLogger() {
    if (!logger) {
      const logDir = join18(homedir5(), ".config", "opencode");
      logger = createLogger(logDir);
    }
    return logger;
  }
  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0;
    }
    return hash.toString(36);
  }
  function detectSpinning() {
    if (recentCalls.length < spinningThreshold * 2) return null;
    for (let seqLen = spinningThreshold; seqLen >= 2; seqLen--) {
      if (recentCalls.length < seqLen * 2) continue;
      const lastCalls = recentCalls.slice(-seqLen * 2);
      const seq1 = lastCalls.slice(0, seqLen).map((c) => c.key).join("|");
      const seq2 = lastCalls.slice(seqLen).map((c) => c.key).join("|");
      if (seq1 === seq2) {
        let repeatCount = 2;
        for (let i = 3; i <= Math.floor(recentCalls.length / seqLen); i++) {
          const start = recentCalls.length - seqLen * i;
          if (start < 0) break;
          const seqN = recentCalls.slice(start, start + seqLen).map((c) => c.key).join("|");
          if (seqN === seq2) {
            repeatCount = i;
          } else {
            break;
          }
        }
        return { length: seqLen, repeatCount };
      }
    }
    return null;
  }
  async function trackToolCall(input) {
    try {
      const toolName = input.tool || "unknown";
      const error = input.error || null;
      const argsStr = JSON.stringify(input.args || {});
      const argsHash = simpleHash(argsStr);
      const callKey = `${toolName}:${argsHash}`;
      recentCalls.push({ key: callKey, tool: toolName });
      if (recentCalls.length > MAX_RECENT_CALLS) {
        recentCalls.shift();
      }
      if (error) {
        const errorKey = `${toolName}:${error}`;
        const count = (errorStreaks.get(errorKey) || 0) + 1;
        errorStreaks.set(errorKey, count);
        if (count >= errorThreshold) {
          escalationLevel++;
          const escalated = escalationLevel >= 2;
          const prefix = escalated ? "ESCALATED \u2014 " : "";
          await notifier.notify({
            type: "stuck-error",
            severity: "critical",
            message: `${prefix}Stuck: ${toolName} failed ${count}x \u2014 "${error}"`,
            action: "Consider pausing for user input"
          });
          getLogger().write("WARN", `Stuck detection: ${toolName} error loop (${count}x): ${error}`);
        }
      } else {
        errorStreaks.clear();
      }
      const spinning = detectSpinning();
      if (spinning && spinning.length >= spinningThreshold) {
        await notifier.notify({
          type: "stuck-spinning",
          severity: "warning",
          message: `Spinning: same ${spinning.length}-call sequence repeated ${spinning.repeatCount}x`,
          action: "Consider a different approach"
        });
        getLogger().write("WARN", `Stuck detection: spinning pattern (${spinning.length}-call sequence, ${spinning.repeatCount}x)`);
      }
    } catch (err) {
      getLogger().write("ERROR", `Stuck detector error: ${err.message}`);
    }
  }
  function onUserInput() {
    errorStreaks.clear();
    escalationLevel = 0;
    recentCalls.length = 0;
  }
  return {
    trackToolCall,
    onUserInput
  };
}

// src/plugin/advisory-guardrails.js
import { readFileSync as readFileSync11, statSync as statSync3 } from "fs";
import { join as join19, basename, extname, isAbsolute, resolve as resolve2 } from "path";
import { homedir as homedir6 } from "os";
var NAMING_PATTERNS = {
  camelCase: /^[a-z][a-z0-9]*[A-Z][a-zA-Z0-9]*$/,
  PascalCase: /^[A-Z][a-zA-Z0-9]*[a-z][a-zA-Z0-9]*$/,
  snake_case: /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/,
  "kebab-case": /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/,
  UPPER_SNAKE_CASE: /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/
};
function classifyName(name) {
  if (/^[a-z][a-z0-9]*$/.test(name)) return "single-word";
  if (/^[A-Z][A-Z0-9]*$/.test(name)) return "single-word";
  for (const [pattern, regex] of Object.entries(NAMING_PATTERNS)) {
    if (regex.test(name)) return pattern;
  }
  return "mixed";
}
function splitWords(name) {
  return name.replace(/[-_]/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2").toLowerCase().split(/\s+/).filter(Boolean);
}
function toConvention(name, convention) {
  const words = splitWords(name);
  if (words.length === 0) return name;
  switch (convention) {
    case "kebab-case":
      return words.join("-");
    case "snake_case":
      return words.join("_");
    case "camelCase":
      return words[0] + words.slice(1).map((w) => w[0].toUpperCase() + w.slice(1)).join("");
    case "PascalCase":
      return words.map((w) => w[0].toUpperCase() + w.slice(1)).join("");
    case "UPPER_SNAKE_CASE":
      return words.map((w) => w.toUpperCase()).join("_");
    default:
      return name;
  }
}
var PLANNING_COMMANDS = {
  "ROADMAP.md": ["/bgsd-plan roadmap add", "/bgsd-plan roadmap remove", "/bgsd-plan roadmap insert"],
  "STATE.md": ["/bgsd-inspect progress", "/bgsd-execute-phase"],
  "PLAN.md": ["/bgsd-plan phase [phase]"],
  "CONTEXT.md": ["/bgsd-plan discuss [phase]"],
  "RESEARCH.md": ["/bgsd-plan research [phase]"],
  "REQUIREMENTS.md": ["/bgsd-new-milestone"],
  "config.json": ["/bgsd-settings"],
  "SUMMARY.md": ["/bgsd-execute-phase"],
  "INTENT.md": ["/bgsd-new-project", "/bgsd-new-milestone", "/bgsd-complete-milestone"]
};
function isTestFile(filePath) {
  const lower = filePath.toLowerCase();
  return lower.includes(".test.") || lower.includes(".spec.") || lower.includes("__tests__/") || lower.includes("__tests__\\") || /[\\/]tests?[\\/]/.test(lower);
}
function loadConventionRules(cwd, confidenceThreshold) {
  try {
    const agentsPath = join19(cwd, "AGENTS.md");
    const content = readFileSync11(agentsPath, "utf-8");
    const conventionNames = ["kebab-case", "camelCase", "PascalCase", "snake_case", "UPPER_SNAKE_CASE"];
    for (const conv of conventionNames) {
      if (content.includes(conv)) {
        return { dominant: conv, confidence: 100 };
      }
    }
  } catch {
  }
  try {
    const intelPath = join19(cwd, ".planning", "codebase", "codebase-intel.json");
    const intel = JSON.parse(readFileSync11(intelPath, "utf-8"));
    if (intel.conventions?.naming?.dominant && (intel.conventions.naming.confidence || 0) >= confidenceThreshold) {
      return {
        dominant: intel.conventions.naming.dominant,
        confidence: intel.conventions.naming.confidence
      };
    }
  } catch {
  }
  return null;
}
function detectTestConfig(cwd) {
  const result = { command: null, sourceExts: /* @__PURE__ */ new Set() };
  try {
    const pkgPath = join19(cwd, "package.json");
    const pkg = JSON.parse(readFileSync11(pkgPath, "utf-8"));
    if (pkg.scripts?.test) {
      result.command = `npm test`;
    } else if (pkg.scripts?.check) {
      result.command = `npm run check`;
    }
    result.sourceExts = /* @__PURE__ */ new Set([".js", ".ts", ".cjs", ".mjs", ".jsx", ".tsx"]);
  } catch {
  }
  if (!result.command) {
    try {
      const pyProject = join19(cwd, "pyproject.toml");
      readFileSync11(pyProject, "utf-8");
      result.command = "pytest";
      result.sourceExts = /* @__PURE__ */ new Set([".py"]);
    } catch {
    }
  }
  return result;
}
var WRITE_TOOLS = /* @__PURE__ */ new Set(["write", "edit", "patch"]);
var BASH_TOOLS = /* @__PURE__ */ new Set(["bash"]);
var DESTRUCTIVE_PATTERNS = [
  // ── Filesystem ──
  { id: "fs-rm-recursive", category: "filesystem", severity: "critical", pattern: /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*\b|--recursive)/, description: "Recursive file deletion (rm -r, rm -rf, rm --recursive)" },
  { id: "fs-rm-force", category: "filesystem", severity: "warning", pattern: /\brm\s+-[a-zA-Z]*f[a-zA-Z]*\b(?!.*-[a-zA-Z]*r)/, description: "Forced file deletion without recursive (rm -f)" },
  { id: "fs-rm-plain", category: "filesystem", severity: "info", pattern: /\brm\s+(?!-)/, description: "Plain file deletion (rm)" },
  { id: "fs-format", category: "filesystem", severity: "critical", pattern: /\b(mkfs|format)\b/, description: "Disk formatting" },
  { id: "fs-dd", category: "filesystem", severity: "critical", pattern: /\bdd\s+.*of=/, description: "Raw disk write (dd of=)" },
  // ── Database ──
  { id: "db-drop-table", category: "database", severity: "critical", pattern: /\bDROP\s+(TABLE|DATABASE|SCHEMA)\b/i, description: "Drop database object" },
  { id: "db-truncate", category: "database", severity: "critical", pattern: /\bTRUNCATE\s+TABLE\b/i, description: "Truncate table" },
  { id: "db-delete-no-where", category: "database", severity: "warning", pattern: /\bDELETE\s+FROM\s+\w+\s*(?:;|$)/i, description: "DELETE without WHERE clause" },
  // ── Git ──
  { id: "git-force-push", category: "git", severity: "critical", pattern: /\bgit\s+push\s+.*--force\b/, description: "Force push (rewrite remote history)" },
  { id: "git-force-push-f", category: "git", severity: "critical", pattern: /\bgit\s+push\s+-[a-zA-Z]*f/, description: "Force push shorthand (-f)" },
  { id: "git-reset-hard", category: "git", severity: "warning", pattern: /\bgit\s+reset\s+--hard\b/, description: "Hard reset (discard uncommitted changes)" },
  { id: "git-clean-fd", category: "git", severity: "warning", pattern: /\bgit\s+clean\s+-[a-zA-Z]*f/, description: "Force clean untracked files" },
  // ── System ──
  { id: "sys-kill-9", category: "system", severity: "warning", pattern: /\bkill\s+-9\b/, description: "Force kill process (SIGKILL)" },
  { id: "sys-chmod-777", category: "system", severity: "warning", pattern: /\bchmod\s+777\b/, description: "World-writable permissions" },
  { id: "sys-chmod-recursive", category: "system", severity: "warning", pattern: /\bchmod\s+-[a-zA-Z]*R/, description: "Recursive permission change" },
  { id: "sys-chown-recursive", category: "system", severity: "warning", pattern: /\bchown\s+-[a-zA-Z]*R/, description: "Recursive ownership change" },
  { id: "sys-shutdown", category: "system", severity: "critical", pattern: /\b(shutdown|reboot|halt|poweroff)\b/, description: "System shutdown/reboot" },
  { id: "sys-iptables-flush", category: "system", severity: "critical", pattern: /\biptables\s+-F\b/, description: "Flush firewall rules" },
  { id: "sys-systemctl-disable", category: "system", severity: "warning", pattern: /\bsystemctl\s+(disable|stop)\s/, description: "Disable/stop system service" },
  // ── Supply Chain ──
  { id: "sc-curl-pipe", category: "supply-chain", severity: "info", pattern: /\bcurl\s+.*\|\s*(ba)?sh\b/, description: "Pipe remote script to shell (curl | bash)" },
  { id: "sc-wget-pipe", category: "supply-chain", severity: "info", pattern: /\bwget\s+.*\|\s*(ba)?sh\b/, description: "Pipe remote script to shell (wget | bash)" },
  { id: "sc-eval", category: "supply-chain", severity: "info", pattern: /\beval\s+/, description: "Shell eval (arbitrary code execution)" },
  { id: "sc-npm-global", category: "supply-chain", severity: "info", pattern: /\bnpm\s+install\s+-g\b/, description: "Global npm package installation" },
  { id: "sc-pip-sudo", category: "supply-chain", severity: "info", pattern: /\bsudo\s+pip\s+install\b/, description: "Sudo pip install (system-wide)" },
  { id: "sc-source-remote", category: "supply-chain", severity: "info", pattern: /\b(source|\.)\s+<\(\s*curl\b/, description: "Source remote script (source <(curl ...))" }
];
function normalizeCommand(raw) {
  let normalized = raw.normalize("NFKD");
  normalized = normalized.replace(/[\u200B-\u200D\u2060\uFEFF]/g, "");
  normalized = normalized.replace(/[\u0300-\u036F]/g, "");
  return normalized;
}
function detectSandboxEnvironment(configOverride) {
  if (configOverride === true) return true;
  if (configOverride === false) return false;
  const envSignals = [
    "DOCKER_HOST",
    "SINGULARITY_NAME",
    "MODAL_TASK_ID",
    "DAYTONA_WS_ID",
    "CODESPACES",
    "GITPOD_WORKSPACE_ID"
  ];
  if (envSignals.some((key) => process.env[key])) return true;
  try {
    statSync3("/.dockerenv");
    return true;
  } catch {
  }
  try {
    statSync3("/run/.containerenv");
    return true;
  } catch {
  }
  try {
    const cgroup = readFileSync11("/proc/self/cgroup", "utf-8");
    if (/docker|containerd|kubepods/i.test(cgroup)) return true;
  } catch {
  }
  return false;
}
function mergePatterns(builtIn, custom) {
  const merged = [...builtIn];
  for (const cp of custom) {
    if (!cp.id || !cp.pattern || !cp.category || !cp.severity) continue;
    let pattern;
    try {
      pattern = typeof cp.pattern === "string" ? new RegExp(cp.pattern) : cp.pattern;
    } catch {
      continue;
    }
    merged.push({ ...cp, pattern, custom: true });
  }
  return merged;
}
function matchPatterns(normalizedCommand, patterns, disabledPatterns, categoryConfig) {
  const matches = [];
  for (const p of patterns) {
    if (disabledPatterns.has(p.id)) continue;
    if (categoryConfig[p.category] === false) continue;
    if (p.pattern.test(normalizedCommand)) {
      matches.push(p);
    }
  }
  return matches;
}
function createAdvisoryGuardrails(cwd, notifier, config) {
  const guardConfig = config.advisory_guardrails || {};
  const conventionsEnabled = guardConfig.conventions !== false;
  const planningProtectionEnabled = guardConfig.planning_protection !== false;
  const testSuggestionsEnabled = guardConfig.test_suggestions !== false;
  const dedupThreshold = guardConfig.dedup_threshold || 3;
  const testDebounceMs = guardConfig.test_debounce_ms || 500;
  const confidenceThreshold = guardConfig.convention_confidence_threshold || 70;
  const destructiveConfig = guardConfig.destructive_commands || {};
  const destructiveEnabled = destructiveConfig.enabled !== false;
  const sandboxMode = destructiveConfig.sandbox_mode ?? "auto";
  const categoryConfig = destructiveConfig.categories || {};
  const disabledPatterns = new Set(destructiveConfig.disabled_patterns || []);
  const customPatterns = destructiveConfig.custom_patterns || [];
  const isSandbox = destructiveEnabled ? detectSandboxEnvironment(sandboxMode) : false;
  const mergedPatterns = destructiveEnabled ? mergePatterns(DESTRUCTIVE_PATTERNS, customPatterns) : [];
  let logger = null;
  function getLogger() {
    if (!logger) {
      const logDir = join19(homedir6(), ".config", "opencode");
      logger = createLogger(logDir);
    }
    return logger;
  }
  const conventionRules = conventionsEnabled ? loadConventionRules(cwd, confidenceThreshold) : null;
  const testConfig = testSuggestionsEnabled ? detectTestConfig(cwd) : { command: null, sourceExts: /* @__PURE__ */ new Set() };
  let bgsdCommandActive = false;
  const warnCounts = /* @__PURE__ */ new Map();
  let testBatchTimer = null;
  const testBatchFiles = [];
  async function flushTestBatch() {
    testBatchTimer = null;
    if (testBatchFiles.length === 0) return;
    const files = [...testBatchFiles];
    testBatchFiles.length = 0;
    const cmdStr = testConfig.command || "your test suite";
    let message;
    if (files.length === 1) {
      message = `Modified ${basename(files[0])}. Consider running: ${cmdStr}`;
    } else {
      message = `Modified ${files.length} source files. Consider running: ${cmdStr}`;
    }
    try {
      await notifier.notify({
        type: "advisory-test",
        severity: "info",
        message
      });
    } catch (err) {
      getLogger().write("ERROR", `Advisory test suggestion failed: ${err.message}`);
    }
  }
  async function onToolAfter(input) {
    if (guardConfig.enabled === false) return;
    try {
      const toolName = input?.tool;
      if (!toolName) return;
      if (destructiveEnabled && BASH_TOOLS.has(toolName)) {
        const rawCommand = input?.args?.command;
        if (!rawCommand) return;
        const normalized = normalizeCommand(rawCommand);
        const matches = matchPatterns(normalized, mergedPatterns, disabledPatterns, categoryConfig);
        for (const match of matches) {
          if (isSandbox && match.severity !== "critical") continue;
          const behavioral = match.severity === "critical" ? "Confirm with user before proceeding with this destructive operation." : match.severity === "warning" ? "Proceed with caution \u2014 this operation may be difficult to reverse." : "";
          try {
            await notifier.notify({
              type: "advisory-destructive",
              severity: "info",
              message: `GARD-04: ${rawCommand.slice(0, 80)} matched [${match.id}] (${match.severity.toUpperCase()})${behavioral ? ". " + behavioral : ""}`
            });
          } catch (err) {
            getLogger().write("ERROR", `Advisory destructive notification failed: ${err.message}`);
          }
        }
        return;
      }
      if (!WRITE_TOOLS.has(toolName)) return;
      const filePath = input?.args?.filePath;
      if (!filePath) return;
      const absPath = isAbsolute(filePath) ? filePath : resolve2(cwd, filePath);
      if (absPath.includes("node_modules") || !absPath.startsWith(cwd)) {
        return;
      }
      const relPath = absPath.slice(cwd.length + 1);
      if (planningProtectionEnabled && (relPath.startsWith(".planning/") || relPath.startsWith(".planning\\"))) {
        if (bgsdCommandActive) return;
        const fileBasename = basename(absPath);
        let commands = PLANNING_COMMANDS[fileBasename];
        if (!commands) {
          for (const [pattern, cmds] of Object.entries(PLANNING_COMMANDS)) {
            if (fileBasename.endsWith(pattern)) {
              commands = cmds;
              break;
            }
          }
        }
        if (commands) {
          const cmdStr = commands.join(" or ");
          await notifier.notify({
            type: "advisory-planning",
            severity: "warning",
            message: `${fileBasename} was edited directly. Use ${cmdStr} to modify this file safely.`
          });
        } else {
          await notifier.notify({
            type: "advisory-planning",
            severity: "warning",
            message: `File in .planning/ was edited directly. bGSD workflows manage these files automatically.`
          });
        }
        return;
      }
      if (conventionsEnabled && conventionRules) {
        const fileBasename = basename(absPath);
        const ext = extname(fileBasename);
        const nameWithoutExt = ext ? fileBasename.slice(0, -ext.length) : fileBasename;
        const classification = classifyName(nameWithoutExt);
        if (classification !== "single-word" && classification !== "mixed") {
          if (classification !== conventionRules.dominant) {
            const count = (warnCounts.get("convention") || 0) + 1;
            warnCounts.set("convention", count);
            if (count <= dedupThreshold) {
              const suggested = toConvention(nameWithoutExt, conventionRules.dominant) + ext;
              await notifier.notify({
                type: "advisory-convention",
                severity: "warning",
                message: `File uses ${classification} naming (${fileBasename}). Project convention is ${conventionRules.dominant}. Consider renaming to ${suggested}.`
              });
            } else if (count % 5 === 0) {
              await notifier.notify({
                type: "advisory-convention",
                severity: "warning",
                message: `${count} convention violations detected. Project convention is ${conventionRules.dominant}.`
              });
            }
          }
        }
      }
      if (testSuggestionsEnabled && testConfig.command) {
        if (isTestFile(absPath)) return;
        const ext = extname(absPath);
        if (testConfig.sourceExts.has(ext)) {
          testBatchFiles.push(relPath);
          if (testBatchTimer) {
            clearTimeout(testBatchTimer);
          }
          testBatchTimer = setTimeout(flushTestBatch, testDebounceMs);
        }
      }
    } catch (err) {
      getLogger().write("ERROR", `Advisory guardrails error: ${err.message}`);
    }
  }
  function setBgsdCommandActive() {
    bgsdCommandActive = true;
  }
  function clearBgsdCommandActive() {
    bgsdCommandActive = false;
  }
  return {
    onToolAfter,
    setBgsdCommandActive,
    clearBgsdCommandActive
  };
}

// src/plugin/index.js
init_config();
await init_state();
await init_roadmap();
await init_plan();
init_config();
init_project();
init_intent();
await init_parsers();
var BgsdPlugin = async ({ directory, $ }) => {
  const registry = createToolRegistry(safeHook);
  const projectDir = directory || process.cwd();
  const config = parseConfig(projectDir);
  const notifier = createNotifier($, projectDir);
  try {
    if (existsSync9(join20(projectDir, ".planning"))) {
      getToolAvailability(projectDir, { refreshIfNeeded: true });
    }
  } catch {
  }
  const memorySnapshotState = {
    text: null,
    stale: false,
    staleNoticeSent: false,
    buildWarningsSent: false
  };
  async function notifyMemorySnapshotBuildWarnings(snapshot) {
    if (memorySnapshotState.buildWarningsSent || !snapshot) return;
    for (const warning of snapshot.blockedWarnings || []) {
      const message = warning.category === "parse-failure" ? "MEMORY.md could not be parsed, so no memory snapshot was injected." : `Blocked ${warning.count} MEMORY.md entr${warning.count === 1 ? "y" : "ies"} (${warning.category}): ${warning.snippet}`;
      await notifier.notify({
        type: "memory-blocked",
        severity: "info",
        message
      });
    }
    if (snapshot.budgetWarning) {
      await notifier.notify({
        type: "memory-budget",
        severity: "info",
        message: snapshot.budgetWarning
      });
    }
    memorySnapshotState.buildWarningsSent = true;
  }
  async function getOrBuildMemorySnapshot(cwd) {
    if (memorySnapshotState.text !== null) {
      return memorySnapshotState.text;
    }
    const snapshot = buildMemorySnapshot(cwd);
    memorySnapshotState.text = snapshot.text || "";
    await notifyMemorySnapshotBuildWarnings(snapshot);
    return memorySnapshotState.text;
  }
  async function handleExternalPlanningChange(filePath) {
    if (!filePath || !filePath.endsWith(join20(".planning", "MEMORY.md"))) {
      return;
    }
    if (memorySnapshotState.text === null || memorySnapshotState.stale) {
      return;
    }
    memorySnapshotState.stale = true;
    if (!memorySnapshotState.staleNoticeSent) {
      memorySnapshotState.staleNoticeSent = true;
      await notifier.notify({
        type: "memory-stale",
        severity: "info",
        message: "MEMORY.md changed on disk; restart or refresh the session to load the new snapshot."
      });
    }
  }
  const fileWatcher = createFileWatcher(projectDir, {
    debounceMs: config.file_watcher?.debounce_ms || 200,
    maxPaths: config.file_watcher?.max_watched_paths || 500,
    onExternalChange: (filePath) => {
      void handleExternalPlanningChange(filePath);
    }
  });
  const idleValidator = createIdleValidator(projectDir, notifier, fileWatcher, config);
  const stuckDetector = createStuckDetector(notifier, config);
  const guardrails = createAdvisoryGuardrails(projectDir, notifier, config);
  fileWatcher.start();
  setTimeout(() => {
    try {
      getProjectState(projectDir);
    } catch {
      writeDebugDiagnostic("[bgsd-plugin]", "background warm-up failed (non-fatal)");
    }
  }, 0);
  const compacting = safeHook("compacting", async (input, output) => {
    const projectDir2 = directory || process.cwd();
    const ctx = buildCompactionContext(projectDir2);
    if (ctx && output && output.context) {
      output.context.push(ctx);
    }
  });
  const systemTransform = safeHook("system.transform", async (input, output) => {
    const sysDir = directory || process.cwd();
    const memorySnapshot = await getOrBuildMemorySnapshot(sysDir);
    const prompt = buildSystemPrompt(sysDir, { memorySnapshot });
    if (prompt && output && output.system) {
      output.system.push(prompt);
    }
    const pending = notifier.drainPendingContext();
    if (pending.length > 0 && output && output.system) {
      const xml = pending.map(
        (n) => `<bgsd-notification type="${n.type}" severity="${n.severity}">${n.message}${n.action ? ` Action: ${n.action}` : ""}</bgsd-notification>`
      ).join("\n");
      output.system.push(xml);
    }
  });
  const commandEnrich = safeHook("command.enrich", async (input, output) => {
    const cmdDir = directory || process.cwd();
    if (input?.command && input.command.startsWith("bgsd-")) {
      guardrails.setBgsdCommandActive();
    }
    enrichCommand(input, output, cmdDir);
  });
  const eventHandler = safeHook("event", async ({ event }) => {
    if (event.type === "session.idle") {
      await idleValidator.onIdle();
      guardrails.clearBgsdCommandActive();
    }
    if (event.type === "file.watcher.updated") {
      const { invalidateAll: invalidateAll2 } = await init_parsers().then(() => parsers_exports);
      invalidateAll2(projectDir);
      await handleExternalPlanningChange(event.path || event.filePath || null);
    }
  });
  const toolAfter = safeHook("tool.execute.after", async (input) => {
    stuckDetector.trackToolCall(input);
    await guardrails.onToolAfter(input);
  });
  return {
    "experimental.session.compacting": compacting,
    "experimental.chat.system.transform": systemTransform,
    "command.execute.before": commandEnrich,
    "event": eventHandler,
    "tool.execute.after": toolAfter,
    tool: getTools(registry)
  };
};
export {
  BgsdPlugin,
  buildCompactionContext,
  buildMemorySnapshot,
  buildSystemPrompt,
  createAdvisoryGuardrails,
  createFileWatcher,
  createIdleValidator,
  createNotifier,
  createStuckDetector,
  createToolRegistry,
  elideConditionalSections,
  enrichCommand,
  getProjectState,
  invalidateAll,
  invalidateConfig,
  invalidateIntent,
  invalidatePlans,
  invalidateProject,
  invalidateRoadmap,
  invalidateState,
  parseConfig,
  parseIntent,
  parsePlan,
  parsePlans,
  parseProject,
  parseRoadmap,
  parseState,
  safeHook
};
