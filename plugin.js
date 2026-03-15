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
        db.prepare("DELETE FROM session_state WHERE cwd = ?").run(cwd);
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
import { readFileSync as readFileSync2 } from "fs";
import { join as join5 } from "path";
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
    const escaped = number.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const checkboxPattern = new RegExp(`-\\s*\\[x\\]\\s*.*Phase\\s+${escaped}`, "i");
    const status = checkboxPattern.test(content) ? "complete" : "incomplete";
    phases.push(Object.freeze({
      number,
      name,
      status,
      planCount,
      goal,
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
  const phases = (phaseRows || []).map((row) => Object.freeze({
    number: row.number || "",
    name: row.name || "",
    status: row.status || "incomplete",
    planCount: row.plan_count != null ? row.plan_count : 0,
    goal: row.goal || null,
    section: row.section || ""
  }));
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
      return Object.freeze({
        number: found.number,
        name: found.name,
        goal: found.goal,
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
    raw = readFileSync2(roadmapPath, "utf-8");
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
  const numStr = String(phaseNum).padStart(2, "0");
  const phasesDir = join6(resolvedCwd, ".planning", "phases");
  let phaseDir = null;
  try {
    const entries = readdirSync(phasesDir);
    const dirName = entries.find((d) => d.startsWith(numStr + "-") || d === numStr);
    if (dirName) {
      phaseDir = join6(phasesDir, dirName);
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
    const defaults = Object.freeze({ ...CONFIG_DEFAULTS });
    _cache3.set(resolvedCwd, defaults);
    return defaults;
  }
  const result = {};
  for (const [key, defaultValue] of Object.entries(CONFIG_DEFAULTS)) {
    if (parsed[key] !== void 0) {
      if (key === "parallelization") {
        if (typeof parsed[key] === "boolean") {
          result[key] = parsed[key];
        } else if (typeof parsed[key] === "object" && parsed[key] !== null && "enabled" in parsed[key]) {
          result[key] = parsed[key].enabled;
        } else {
          result[key] = defaultValue;
        }
      } else if (NESTED_OBJECT_KEYS.has(key)) {
        if (typeof parsed[key] === "object" && parsed[key] !== null) {
          result[key] = Object.freeze({ ...defaultValue, ...parsed[key] });
        } else {
          result[key] = defaultValue;
        }
      } else {
        result[key] = parsed[key];
      }
    } else if (parsed.workflow && ["research", "plan_checker", "verifier"].includes(key)) {
      const nestedKey = key === "plan_checker" ? "plan_check" : key;
      if (parsed.workflow[nestedKey] !== void 0) {
        result[key] = parsed.workflow[nestedKey];
      } else if (parsed.workflow[key] !== void 0) {
        result[key] = parsed.workflow[key];
      } else {
        result[key] = defaultValue;
      }
    } else {
      result[key] = defaultValue;
    }
  }
  const frozen = Object.freeze(result);
  _cache3.set(resolvedCwd, frozen);
  return frozen;
}
function invalidateConfig(cwd) {
  if (cwd) {
    _cache3.delete(cwd);
  } else {
    _cache3.clear();
  }
}
var _cache3, CONFIG_DEFAULTS, NESTED_OBJECT_KEYS;
var init_config = __esm({
  "src/plugin/parsers/config.js"() {
    _cache3 = /* @__PURE__ */ new Map();
    CONFIG_DEFAULTS = Object.freeze({
      mode: "interactive",
      depth: "standard",
      model_profile: "balanced",
      commit_docs: true,
      branching_strategy: "none",
      phase_branch_template: "phase-{number}-{name}",
      milestone_branch_template: "{version}",
      parallelization: false,
      research: true,
      plan_checker: true,
      verifier: true,
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
        test_debounce_ms: 500
      })
    });
    NESTED_OBJECT_KEYS = /* @__PURE__ */ new Set([
      "idle_validation",
      "notifications",
      "stuck_detection",
      "file_watcher",
      "advisory_guardrails"
    ]);
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
      tools_bat: { type: "boolean", default: true, description: "Enable bat for syntax highlighting", aliases: [], nested: { section: "tools", field: "bat" } },
      tools_gh: { type: "boolean", default: true, description: "Enable gh for GitHub operations", aliases: [], nested: { section: "tools", field: "gh" } }
    };
    var COMMAND_HELP = {
      "util:codebase context": `Usage: bgsd-tools codebase context --files <file1> [file2] ... [--plan <path>]
       bgsd-tools codebase context --task <file1,file2,...> [--plan <path>] [--budget <tokens>]

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
  bgsd-tools codebase context --files src/lib/ast.js
  bgsd-tools codebase context --task src/lib/ast.js,src/router.js --budget 2000`,
      "util:codebase ast": `Usage: bgsd-tools codebase ast <file>

Extract function, class, and method signatures from a source file.

For JS/TS: Uses acorn AST parsing with TypeScript stripping.
For Python, Go, Rust, Ruby, Elixir, Java, PHP: Uses regex-based extraction.

Arguments:
  file   Source file path to analyze

Output: { file, language, signatures: [{name, type, params, line, async, generator}], count }

Examples:
  bgsd-tools codebase ast src/lib/ast.js
  bgsd-tools codebase ast app.py`,
      "util:codebase exports": `Usage: bgsd-tools codebase exports <file>

Extract the export surface from a JS/TS module.

Detects ESM exports (named, default, re-exports) and CJS exports
(module.exports, exports patterns). Reports module type (esm/cjs/mixed).

Arguments:
  file   Source file path to analyze

Output: { file, type, named, default, re_exports, cjs_exports }

Examples:
  bgsd-tools codebase exports src/lib/ast.js
  bgsd-tools codebase exports src/router.js`,
      "util:codebase complexity": `Usage: bgsd-tools codebase complexity <file>

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
  bgsd-tools codebase complexity src/router.js
  bgsd-tools codebase complexity src/lib/ast.js`,
      "util:codebase repo-map": `Usage: bgsd-tools codebase repo-map [--budget <tokens>]

Generate a compact repository map from AST signatures.

Walks all source files, extracts function/class/method signatures and
exports, then builds a compact text summary sorted by signature density.
Designed for agent context injection (~1k tokens by default).

Options:
  --budget <tokens>   Token budget for output (default: 1000)

Output (raw): { summary, files_included, total_signatures, token_estimate }
Output (formatted): The summary text directly

Examples:
  bgsd-tools codebase repo-map
  bgsd-tools codebase repo-map --budget 500`,
      "execute:trajectory": `Usage: bgsd-tools trajectory <subcommand> [options]

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
  bgsd-tools trajectory checkpoint explore-auth
  bgsd-tools trajectory checkpoint try-redis --scope task --description "Redis caching approach"
  bgsd-tools trajectory list
  bgsd-tools trajectory list --scope phase --limit 5
  bgsd-tools trajectory compare my-feat
  bgsd-tools trajectory pivot explore-auth --reason "JWT approach too complex"
  bgsd-tools trajectory choose my-feat --attempt 2 --reason "Better test coverage"
  bgsd-tools trajectory dead-ends
  bgsd-tools trajectory dead-ends --scope task --limit 5`,
      "execute:trajectory compare": `Usage: bgsd-tools trajectory compare <name> [--scope <scope>]

Compare metrics across all attempts for a named checkpoint.
Shows test results, LOC delta, and cyclomatic complexity side-by-side.
Best values highlighted green, worst highlighted red.

Arguments:
  name              Checkpoint name to compare attempts for

Options:
  --scope <scope>   Scope level (default: phase)

Output: { checkpoint, scope, attempt_count, attempts, best_per_metric, worst_per_metric }

Examples:
  bgsd-tools trajectory compare my-feat
  bgsd-tools trajectory compare try-redis --scope task`,
      "execute:trajectory choose": `Usage: bgsd-tools trajectory choose <name> --attempt <N> [--scope <scope>] [--reason "rationale"]

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
  bgsd-tools trajectory choose my-feat --attempt 2
  bgsd-tools trajectory choose try-redis --scope task --attempt 1 --reason "Lower complexity"`,
      "execute:trajectory pivot": `Usage: bgsd-tools trajectory pivot <checkpoint> --reason "what failed and why"

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
  bgsd-tools trajectory pivot explore-auth --reason "JWT approach too complex, session-based simpler"
  bgsd-tools trajectory pivot try-redis --scope task --reason "Redis overkill for this cache size"
  bgsd-tools trajectory pivot my-feature --attempt 2 --reason "Attempt 2 had better foundation"`,
      "execute:trajectory dead-ends": `Usage: bgsd-tools trajectory dead-ends [--scope <scope>] [--name <name>] [--limit <N>] [--token-cap <N>]

Query journal for failed approaches (pivot/abandon entries).
Shows "what NOT to do" context with reasons from pivot entries.

Options:
  --scope <scope>   Filter by scope (task, plan, phase)
  --name <name>     Filter by checkpoint name
  --limit <N>       Max results (default: 10)
  --token-cap <N>   Token cap for context output (default: 500)

Output: { dead_ends, count, scope_filter, name_filter, context }

Examples:
  bgsd-tools trajectory dead-ends
  bgsd-tools trajectory dead-ends --scope task --limit 5`,
      "util:classify plan": `Usage: bgsd-tools classify plan <plan-path>

Classify all tasks in a plan file with 1-5 complexity scores.

Scoring factors: file count, cross-module blast radius, test requirements,
checkpoint complexity, action length.

Model mapping: score 1-2 \u2192 sonnet, score 3 \u2192 sonnet, score 4-5 \u2192 opus

Output: { plan, wave, autonomous, task_count, tasks: [{name, complexity}], plan_complexity, recommended_model }

Examples:
  bgsd-tools classify plan .planning/phases/39-orchestration-intelligence/39-01-PLAN.md`,
      "util:classify phase": `Usage: bgsd-tools classify phase <phase-number>

Classify all incomplete plans in a phase and determine execution mode.

Execution modes:
  single      1 plan with 1-2 tasks
  parallel    Multiple plans in same wave, no file overlaps
  sequential  Plans with checkpoint tasks
  pipeline    Plans spanning 3+ waves

Output: { phase, plans_classified, plans: [...], execution_mode: { mode, reason, waves } }

Examples:
  bgsd-tools classify phase 39
  bgsd-tools classify phase 38`,
      "util:git": `Usage: bgsd-tools git <log|diff-summary|blame|branch-info|rewind|trajectory-branch> [options]

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
  bgsd-tools git log --count 5
  bgsd-tools git diff-summary --from main --to HEAD
  bgsd-tools git blame src/router.js
  bgsd-tools git branch-info
  bgsd-tools git rewind --ref HEAD~3 --dry-run
  bgsd-tools git rewind --ref abc123 --confirm
  bgsd-tools git trajectory-branch --phase 45 --slug decision-journal`,
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
      "execute:worktree": `Usage: bgsd-tools execute:worktree <subcommand> [options]

Manage git worktrees for parallel execution.

Subcommands:
  create <plan-id>    Create isolated worktree
  list                List active worktrees
  remove <plan-id>    Remove a worktree
  cleanup             Remove all worktrees
  merge <plan-id>     Merge worktree back
  check-overlap       Check for file overlaps`,
      "execute:tdd": `Usage: bgsd-tools execute:tdd <subcommand> [options]

TDD validation gates.

Subcommands:
  validate-red --test-cmd "cmd"       Verify test fails
  validate-green --test-cmd "cmd"     Verify test passes
  validate-refactor --test-cmd "cmd" Same as validate-green
  auto-test --test-cmd "cmd"         Run test, report result`,
      "execute:test-run": `Usage: bgsd-tools execute:test-run

Run project tests and parse output.`,
      // verify namespace
      "verify:state": `Usage: bgsd-tools verify:state <subcommand> [options]

Manage project state in STATE.md.

Subcommands:
  load | get <field> | update <field> <value> | patch --key value ...
  advance-plan | update-progress
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

Search tasks/lessons.md for patterns.`,
      "verify:review": `Usage: bgsd-tools verify:review <phase> <plan>

Review context for reviewer agent.`,
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
      "lessons:migrate": `Usage: bgsd-tools lessons:migrate

Migrate free-form lessons.md to structured format.

Searches for lessons.md at:
  - <cwd>/lessons.md
  - <cwd>/tasks/lessons.md
  - <cwd>/.planning/lessons.md

Each heading section becomes a structured entry with:
  - type: environment
  - severity: MEDIUM (default)
  - prevention_rule: "Migrated from free-form lessons \u2014 review and update"
  - affected_agents: [] (review and populate)

Output: { migrated, sources, entry_count }

Examples:
  bgsd-tools lessons:migrate`,
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
  bgsd-tools skills:remove --name my-skill`
    };
    module.exports = { MODEL_PROFILES, CONFIG_SCHEMA, COMMAND_HELP, VALID_TRAJECTORY_SCOPES };
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
        id: "json-transform-mode",
        name: "JSON Transform Mode",
        category: "tool-routing",
        description: "Recommends JSON transformation tool (jq vs javascript) based on complexity and tool availability",
        inputs: ["tool_availability", "json_complexity"],
        outputs: ["jq|javascript"],
        confidence_range: ["HIGH"],
        resolve: resolveJsonTransformMode
      },
      // Phase 128: Agent collaboration decision functions
      {
        id: "agent-capability-level",
        name: "Agent Capability Level",
        category: "state-assessment",
        description: "Scores agent capability based on available tool count",
        inputs: ["tool_availability"],
        outputs: ["HIGH|MEDIUM|LOW"],
        confidence_range: ["HIGH"],
        resolve: resolveAgentCapabilityLevel
      },
      {
        id: "phase-dependencies",
        name: "Phase Dependency Sequencing",
        category: "workflow-routing",
        description: "Sequences phases accounting for dependencies and tool capabilities",
        inputs: ["phases", "tool_availability"],
        outputs: ["{ ordered_phases, warnings }"],
        confidence_range: ["HIGH", "MEDIUM"],
        resolve: resolvePhaseDependencies
      }
    ];
    function resolveFileDiscoveryMode(state) {
      const { tool_availability = {}, scope } = state || {};
      if (!scope || scope === "single-file") {
        return { value: "node", confidence: "HIGH", rule_id: "file-discovery-mode" };
      }
      if ((scope === "directory" || scope === "project-wide") && tool_availability.fd === true) {
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
    function resolveJsonTransformMode(state) {
      const { tool_availability = {}, json_complexity } = state || {};
      if (!json_complexity || json_complexity === "simple") {
        return { value: "javascript", confidence: "HIGH", rule_id: "json-transform-mode" };
      }
      if (json_complexity === "complex" && tool_availability.jq === true) {
        return { value: "jq", confidence: "HIGH", rule_id: "json-transform-mode" };
      }
      return { value: "javascript", confidence: "HIGH", rule_id: "json-transform-mode" };
    }
    function resolveAgentCapabilityLevel(state) {
      const { tool_availability = {} } = state || {};
      const tools = ["ripgrep", "fd", "jq", "yq", "bat", "gh"];
      const count = tools.filter((t) => tool_availability[t] === true).length;
      if (count >= 5) {
        return { value: "HIGH", confidence: "HIGH", rule_id: "agent-capability-level" };
      }
      if (count >= 2) {
        return { value: "MEDIUM", confidence: "HIGH", rule_id: "agent-capability-level" };
      }
      return {
        value: "LOW",
        confidence: "HIGH",
        rule_id: "agent-capability-level",
        metadata: { warning: "Low tool availability \u2014 agent proceeding with limited capabilities" }
      };
    }
    function resolvePhaseDependencies(state) {
      const rawPhases = (state || {}).phases;
      const phases = Array.isArray(rawPhases) ? rawPhases : [];
      const { tool_availability = {} } = state || {};
      if (!phases.length) {
        return { value: { ordered_phases: [], warnings: [] }, confidence: "HIGH", rule_id: "phase-dependencies" };
      }
      const warnings = [];
      const depMap = {};
      const allNumbers = [];
      for (const phase of phases) {
        const num = phase.number;
        allNumbers.push(num);
        depMap[num] = Array.isArray(phase.depends_on) ? phase.depends_on : [];
      }
      const inDegree = {};
      const adjList = {};
      for (const num of allNumbers) {
        inDegree[num] = inDegree[num] || 0;
        adjList[num] = adjList[num] || [];
      }
      for (const num of allNumbers) {
        for (const dep of depMap[num]) {
          inDegree[num] = (inDegree[num] || 0) + 1;
          if (!adjList[dep]) adjList[dep] = [];
          adjList[dep].push(num);
        }
      }
      const queue = allNumbers.filter((n) => inDegree[n] === 0);
      function sortByToolReadiness(nums) {
        return [...nums].sort((a, b) => {
          const phaseA = phases.find((p) => p.number === a) || {};
          const phaseB = phases.find((p) => p.number === b) || {};
          const reqA = Array.isArray(phaseA.tool_requirements) ? phaseA.tool_requirements : [];
          const reqB = Array.isArray(phaseB.tool_requirements) ? phaseB.tool_requirements : [];
          const nameA = String(phaseA.name || phaseA.number || "").toLowerCase();
          const nameB = String(phaseB.name || phaseB.number || "").toLowerCase();
          const isDiscoveryA = /discovery|detect|scan/.test(nameA);
          const isDiscoveryB = /discovery|detect|scan/.test(nameB);
          const isAnalysisA = /analysis|transform|complex/.test(nameA);
          const isAnalysisB = /analysis|transform|complex/.test(nameB);
          if (isDiscoveryA && isAnalysisB) return -1;
          if (isDiscoveryB && isAnalysisA) return 1;
          const readyA = reqA.filter((t) => tool_availability[t] === true).length;
          const readyB = reqB.filter((t) => tool_availability[t] === true).length;
          if (readyA !== readyB) return readyB - readyA;
          return 0;
        });
      }
      const sorted = sortByToolReadiness(queue);
      const result = [];
      const visited = /* @__PURE__ */ new Set();
      while (sorted.length > 0) {
        const num = sorted.shift();
        if (visited.has(num)) continue;
        visited.add(num);
        result.push(num);
        const phase = phases.find((p) => p.number === num) || {};
        const reqs = Array.isArray(phase.tool_requirements) ? phase.tool_requirements : [];
        const missingTools = reqs.filter((t) => tool_availability[t] !== true);
        if (missingTools.length > 0) {
          warnings.push("Phase " + num + " has suboptimal tool readiness (missing: " + missingTools.join(", ") + ")");
        }
        const readyNext = [];
        for (const dependent of adjList[num] || []) {
          inDegree[dependent]--;
          if (inDegree[dependent] === 0) {
            readyNext.push(dependent);
          }
        }
        const sortedNext = sortByToolReadiness(readyNext);
        sorted.unshift(...sortedNext);
      }
      for (const num of allNumbers) {
        if (!visited.has(num)) {
          result.push(num);
          warnings.push("Phase " + num + " may be part of a dependency cycle");
        }
      }
      const confidence = warnings.length > 0 ? "MEDIUM" : "HIGH";
      return { value: { ordered_phases: result, warnings }, confidence, rule_id: "phase-dependencies" };
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
      // Phase 127: Tool routing decision functions
      resolveFileDiscoveryMode,
      resolveSearchMode,
      resolveJsonTransformMode,
      // Phase 128: Agent collaboration decision functions
      resolveAgentCapabilityLevel,
      resolvePhaseDependencies,
      // Registry and aggregator
      DECISION_REGISTRY,
      evaluateDecisions: evaluateDecisions2
    };
  }
});

// src/plugin/index.js
import { join as join18 } from "path";
import { homedir as homedir7 } from "os";

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
      if (level === "ERROR") {
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
      stack: lastError.stack
    });
    console.log(`[bGSD] Hook failed: ${name} [${correlationId}]`);
    if (consecutiveFailures >= 3) {
      disabled = true;
      console.log(`[bGSD] Hook ${name} disabled after repeated failures`);
      getLogger().write("ERROR", `Circuit breaker tripped: hook "${name}" disabled after ${consecutiveFailures} consecutive failures`, correlationId, {
        hookName: name
      });
    }
  };
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
      console.warn(`[bGSD] Tool '${normalized}' already registered \u2014 overwriting`);
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
      const numStr = String(phaseNum).padStart(2, "0");
      const phasesDir = join10(resolvedCwd, ".planning", "phases");
      try {
        const entries = readdirSync2(phasesDir);
        const dirName = entries.find((d) => d.startsWith(numStr + "-") || d === numStr);
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
      const numStr = String(phaseNum).padStart(2, "0");
      const phasesDir = join10(resolvedCwd, ".planning", "phases");
      const entries = readdirSync2(phasesDir);
      const dirName = entries.find((d) => d.startsWith(numStr + "-") || d === numStr);
      if (dirName) {
        phaseDir = `.planning/phases/${dirName}`;
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
function buildSystemPrompt(cwd) {
  let projectState;
  try {
    projectState = getProjectState(cwd);
  } catch {
    return "<bgsd>Failed to load project state. Run /bgsd-health to diagnose.</bgsd>";
  }
  if (!projectState) {
    return "<bgsd>No active project. Run /bgsd-new-project to start.</bgsd>";
  }
  const { state, roadmap, currentPhase, currentMilestone, plans } = projectState;
  if (!state || !state.phase) {
    return "<bgsd>Failed to load project state. Run /bgsd-health to diagnose.</bgsd>";
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
  const prompt = `<bgsd>
Phase ${phaseNum}: ${phaseName}${planInfo}${milestoneInfo}${goalLine}${blockerLine}
</bgsd>`;
  const tokenCount = countTokens(prompt);
  if (tokenCount > TOKEN_BUDGET) {
    console.warn(`[bGSD] System prompt injection exceeds budget: ${tokenCount} tokens (budget: ${TOKEN_BUDGET})`);
  }
  return prompt;
}
function buildCompactionContext(cwd) {
  let projectState;
  try {
    projectState = getProjectState(cwd);
  } catch {
    return "<project-error>Failed to load project state for compaction. Run /bgsd-health to diagnose.</project-error>";
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
import { readdirSync as readdirSync3, existsSync as existsSync3, readFileSync as readFileSync7 } from "fs";
import { join as join11 } from "path";
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
        text: '<bgsd-context>\n{"error": "Failed to load project state. Run /bgsd-health to diagnose."}\n</bgsd-context>'
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
  const phaseNum = detectPhaseArg(input.parts);
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
            const phaseDirFull = join11(resolvedCwd, phaseDir);
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
      const phaseDirFull = join11(resolvedCwd, enrichment.phase_dir);
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
      enrichment.has_research = existsSync3(join11(resolvedCwd, enrichment.phase_dir, paddedPhase + "-RESEARCH.md"));
      enrichment.has_context = existsSync3(join11(resolvedCwd, enrichment.phase_dir, paddedPhase + "-CONTEXT.md"));
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
    enrichment.state_exists = existsSync3(join11(resolvedCwd, ".planning/STATE.md"));
    enrichment.project_exists = existsSync3(join11(resolvedCwd, ".planning/PROJECT.md"));
    enrichment.roadmap_exists = existsSync3(join11(resolvedCwd, ".planning/ROADMAP.md"));
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
      const phaseDirFull = join11(resolvedCwd, enrichment.phase_dir);
      const sf = ensureSummaryFiles(phaseDirFull);
      enrichment.has_previous_summary = sf.length > 0;
      if (sf.length > 0) {
        const lastSummary = [...sf].sort().pop();
        const content = readFileSync7(join11(phaseDirFull, lastSummary), "utf-8");
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
    const CACHE_TTL_MS = 5 * 60 * 1e3;
    const cacheFilePath = join11(resolvedCwd, ".planning", ".cache", "tools.json");
    let toolAvailability = { ripgrep: false, fd: false, jq: false, yq: false, bat: false, gh: false };
    if (existsSync3(cacheFilePath)) {
      try {
        const cacheData = JSON.parse(readFileSync7(cacheFilePath, "utf-8"));
        if (cacheData && cacheData.timestamp && Date.now() - cacheData.timestamp < CACHE_TTL_MS && cacheData.results) {
          for (const toolName of ["ripgrep", "fd", "jq", "yq", "bat", "gh"]) {
            toolAvailability[toolName] = Boolean(cacheData.results[toolName] && cacheData.results[toolName].available);
          }
        }
      } catch {
      }
    }
    enrichment.tool_availability = toolAvailability;
  } catch {
    enrichment.tool_availability = { ripgrep: false, fd: false, jq: false, yq: false, bat: false, gh: false };
  }
  try {
    const localAgentsDir = join11(resolvedCwd, ".opencode", "agents");
    if (existsSync3(localAgentsDir)) {
      const localAgentFiles = readdirSync3(localAgentsDir).filter((f) => f.endsWith(".md"));
      enrichment.local_agent_overrides = localAgentFiles.map((f) => f.replace(".md", ""));
    } else {
      enrichment.local_agent_overrides = [];
    }
  } catch {
    enrichment.local_agent_overrides = [];
  }
  try {
    const skillsDir = join11(resolvedCwd, ".agents", "skills");
    if (existsSync3(skillsDir)) {
      const skillEntries = readdirSync3(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
      const skills = [];
      for (const entry of skillEntries) {
        const skillMdPath = join11(skillsDir, entry.name, "SKILL.md");
        if (existsSync3(skillMdPath)) {
          let description = "";
          try {
            const content = readFileSync7(skillMdPath, "utf8");
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
    const availableTools = Object.entries(ta).filter(([, available]) => available === true).map(([name]) => name);
    const toolCount = availableTools.length;
    let capabilityLevel = "MEDIUM";
    if (toolCount >= 5) capabilityLevel = "HIGH";
    else if (toolCount <= 1) capabilityLevel = "LOW";
    enrichment.handoff_tool_context = {
      available_tools: availableTools,
      // tool names only — no descriptions/schemas per CONTEXT.md
      tool_count: toolCount,
      capability_level: capabilityLevel
    };
  } catch {
    enrichment.handoff_tool_context = { available_tools: [], tool_count: 0, capability_level: "LOW" };
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
  if (process.env.BGSD_DEBUG || process.env.NODE_ENV === "development") {
    console.error(`[bgsd-enricher] ${command} enriched in ${_elapsed.toFixed(1)}ms`);
  }
  if (output.parts) {
    output.parts.unshift({
      type: "text",
      text: `<bgsd-context>
${JSON.stringify(enrichment, null, 2)}
</bgsd-context>`
    });
  }
}
function detectPhaseArg(parts) {
  if (!parts || !Array.isArray(parts)) return null;
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (typeof part === "string") {
      const match = part.match(/^(\d{1,3})$/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
  }
  return null;
}
function resolvePhaseDir(phaseNum, cwd) {
  const numStr = String(phaseNum).padStart(2, "0");
  const phasesDir = join11(cwd, ".planning", "phases");
  try {
    const entries = readdirSync3(phasesDir);
    const dirName = entries.find((d) => d.startsWith(numStr + "-") || d === numStr);
    if (dirName) {
      return `.planning/phases/${dirName}`;
    }
  } catch {
  }
  return null;
}
function listSummaryFiles(phaseDir) {
  try {
    if (!existsSync3(phaseDir)) return [];
    const files = readdirSync3(phaseDir);
    return files.filter((f) => f.endsWith("-SUMMARY.md"));
  } catch {
    return [];
  }
}
function countDiagnosedUatGaps(phaseDir) {
  try {
    if (!existsSync3(phaseDir)) return 0;
    const allFiles = readdirSync3(phaseDir);
    const uatFiles = allFiles.filter((f) => f.endsWith("-UAT.md"));
    let count = 0;
    for (const uf of uatFiles) {
      try {
        const content = readFileSync7(join11(phaseDir, uf), "utf-8");
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
          message: "ROADMAP.md could not be parsed. Run /bgsd-health to diagnose."
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
      if (!plans || plans.length === 0) {
        return JSON.stringify({
          error: "validation_error",
          message: "No plans found for current phase. Run /bgsd-plan-phase to create plans."
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
await init_state();
await init_plan();
await init_db_cache();
import { readFileSync as readFileSync8, writeFileSync as writeFileSync2, mkdirSync as mkdirSync2, rmdirSync, existsSync as existsSync4, statSync as statSync3 } from "fs";
import { join as join12 } from "path";
var LOCK_STALE_MS = 1e4;
var VALID_ACTIONS = ["complete-task", "uncomplete-task", "add-blocker", "remove-blocker", "record-decision", "advance"];
var bgsd_progress = {
  description: "Update bGSD project progress \u2014 mark tasks complete, add/remove blockers, record decisions, advance plan.\n\nSingle tool with an action parameter:\n- complete-task: Mark the next pending task as complete\n- uncomplete-task: Un-complete the last completed task\n- add-blocker: Add a blocker to STATE.md\n- remove-blocker: Remove a blocker by index\n- record-decision: Record a decision to STATE.md\n- advance: Advance to next plan (when current plan is complete)\n\nUpdates files on disk (STATE.md, PLAN.md). Does NOT create git commits \u2014 the agent handles commits separately.\n\nReturns updated state snapshot after the change.",
  args: {
    action: z3.enum(VALID_ACTIONS).describe("The progress action to perform"),
    value: z3.string().optional().describe("Value for the action: blocker text for add-blocker, blocker index (1-based) for remove-blocker, decision text for record-decision. Not needed for complete-task, uncomplete-task, advance.")
  },
  async execute(args, context) {
    const projectDir = context?.directory || process.cwd();
    const lockDir = join12(projectDir, ".planning", ".lock");
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
      try {
        mkdirSync2(lockDir);
      } catch (lockErr) {
        if (lockErr.code === "EEXIST") {
          try {
            const lockStat = statSync3(lockDir);
            const age = Date.now() - lockStat.mtimeMs;
            if (age > LOCK_STALE_MS) {
              rmdirSync(lockDir);
              mkdirSync2(lockDir);
            } else {
              return JSON.stringify({
                error: "runtime_error",
                message: "Another operation in progress. Try again."
              });
            }
          } catch {
            return JSON.stringify({
              error: "runtime_error",
              message: "Failed to check lock status. Try again."
            });
          }
        } else {
          throw lockErr;
        }
      }
      try {
        const statePath = join12(projectDir, ".planning", "STATE.md");
        let content = readFileSync8(statePath, "utf-8");
        const { state } = projectState;
        let actionResult = null;
        let sqliteCache = null;
        try {
          const db = getDb(projectDir);
          if (db.backend === "sqlite") {
            sqliteCache = new PlanningCache(db);
          }
        } catch {
        }
        switch (args.action) {
          case "complete-task": {
            const currentProgress = state.progress !== null ? state.progress : 0;
            const step = 10;
            const newProgress = Math.min(100, currentProgress + step);
            if (sqliteCache) {
              try {
                const sessionState = sqliteCache.getSessionState(projectDir);
                if (sessionState) {
                  sqliteCache.storeSessionState(projectDir, { ...sessionState, progress: newProgress, last_activity: (/* @__PURE__ */ new Date()).toISOString().split("T")[0] });
                }
              } catch {
              }
            }
            content = updateProgress(content, newProgress);
            actionResult = `Progress updated to ${newProgress}%`;
            break;
          }
          case "uncomplete-task": {
            const currentProgress = state.progress !== null ? state.progress : 0;
            const step = 10;
            const newProgress = Math.max(0, currentProgress - step);
            if (sqliteCache) {
              try {
                const sessionState = sqliteCache.getSessionState(projectDir);
                if (sessionState) {
                  sqliteCache.storeSessionState(projectDir, { ...sessionState, progress: newProgress });
                }
              } catch {
              }
            }
            content = updateProgress(content, newProgress);
            actionResult = `Progress reverted to ${newProgress}%`;
            break;
          }
          case "add-blocker": {
            if (sqliteCache) {
              try {
                sqliteCache.writeSessionBlocker(projectDir, {
                  text: args.value,
                  status: "open",
                  created_at: (/* @__PURE__ */ new Date()).toISOString()
                });
              } catch {
              }
            }
            content = addBlocker(content, args.value);
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
            const result = removeBlocker(content, idx);
            if (result.error) {
              return JSON.stringify({
                error: "validation_error",
                message: result.error
              });
            }
            if (sqliteCache) {
              try {
                const blockersResult = sqliteCache.getSessionBlockers(projectDir, { status: "open", limit: 100 });
                const blockers = blockersResult ? blockersResult.entries : [];
                const sorted = blockers.slice().reverse();
                const target = sorted[idx - 1];
                if (target && target._id != null) {
                  sqliteCache.resolveSessionBlocker(projectDir, target._id, "Removed");
                }
              } catch {
              }
            }
            content = result.content;
            actionResult = `Blocker ${idx} removed`;
            break;
          }
          case "record-decision": {
            if (sqliteCache) {
              try {
                const phaseTag = state.phase ? state.phase.match(/^(\d+)/)?.[1] || "?" : "?";
                sqliteCache.writeSessionDecision(projectDir, {
                  phase: `Phase ${phaseTag}`,
                  summary: args.value,
                  rationale: null,
                  timestamp: (/* @__PURE__ */ new Date()).toISOString(),
                  milestone: null
                });
              } catch {
              }
            }
            content = recordDecision(content, args.value, state.phase);
            actionResult = `Decision recorded: ${args.value}`;
            break;
          }
          case "advance": {
            const result = advancePlan(content, state.currentPlan);
            if (sqliteCache && result.newPlanNum) {
              try {
                const sessionState = sqliteCache.getSessionState(projectDir);
                if (sessionState) {
                  sqliteCache.storeSessionState(projectDir, {
                    ...sessionState,
                    current_plan: String(result.newPlanNum),
                    last_activity: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
                  });
                }
              } catch {
              }
            }
            content = result.content;
            actionResult = result.message;
            break;
          }
        }
        writeFileSync2(statePath, content, "utf-8");
        if (sqliteCache) {
          try {
            sqliteCache.updateMtime(statePath);
          } catch {
          }
        }
        try {
          rmdirSync(lockDir);
        } catch {
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
      } finally {
        try {
          rmdirSync(lockDir);
        } catch {
        }
      }
    } catch (err) {
      try {
        rmdirSync(lockDir);
      } catch {
      }
      return JSON.stringify({
        error: "runtime_error",
        message: "Failed to update progress: " + err.message
      });
    }
  }
};
function updateProgress(content, newPercent) {
  const barLength = 10;
  const filled = Math.round(newPercent / 100 * barLength);
  const empty = barLength - filled;
  const newBar = "\u2588".repeat(filled) + "\u2591".repeat(empty);
  const progressLine = `**Progress:** [${newBar}] ${newPercent}%`;
  const replaced = content.replace(
    /\*\*Progress:\*\*\s*\[[\u2588\u2591]+\]\s*\d+%/,
    progressLine
  );
  return replaced;
}
function addBlocker(content, blockerText) {
  const sectionPattern = /(### Blockers\/Concerns\s*\n)([\s\S]*?)(\n###|\n## |$)/;
  const match = content.match(sectionPattern);
  if (!match) {
    return content + "\n### Blockers/Concerns\n\n- " + blockerText + "\n";
  }
  const header = match[1];
  let body = match[2];
  const after = match[3];
  if (body.trim().toLowerCase() === "none" || body.trim() === "") {
    body = "\n- " + blockerText + "\n";
  } else {
    body = body.trimEnd() + "\n- " + blockerText + "\n";
  }
  return content.replace(sectionPattern, header + body + after);
}
function removeBlocker(content, index) {
  const sectionPattern = /(### Blockers\/Concerns\s*\n)([\s\S]*?)(\n###|\n## |$)/;
  const match = content.match(sectionPattern);
  if (!match) {
    return { error: "No Blockers/Concerns section found in STATE.md" };
  }
  const header = match[1];
  const body = match[2];
  const after = match[3];
  const lines = body.split("\n").filter((l) => l.match(/^[-*]\s+/));
  if (index > lines.length || index < 1) {
    return { error: `Blocker index ${index} out of range. Found ${lines.length} blocker(s).` };
  }
  lines.splice(index - 1, 1);
  let newBody;
  if (lines.length === 0) {
    newBody = "\nNone\n";
  } else {
    newBody = "\n" + lines.join("\n") + "\n";
  }
  return { content: content.replace(sectionPattern, header + newBody + after) };
}
function recordDecision(content, decisionText, phase) {
  const phaseTag = phase ? phase.match(/^(\d+)/)?.[1] || "?" : "?";
  const entry = `- [Phase ${phaseTag}]: ${decisionText}`;
  const sectionPattern = /(### Decisions\s*\n)([\s\S]*?)(\n###|\n## |$)/;
  const match = content.match(sectionPattern);
  if (!match) {
    return content + "\n### Decisions\n\n" + entry + "\n";
  }
  const header = match[1];
  let body = match[2];
  const after = match[3];
  body = body.trimEnd() + "\n" + entry + "\n";
  return content.replace(sectionPattern, header + body + after);
}
function advancePlan(content, currentPlan) {
  if (!currentPlan) {
    return { content, message: "No current plan to advance from", newPlanNum: null };
  }
  const planNumMatch = currentPlan.match(/(\d+)\s*(?:pending|$)/i) || currentPlan.match(/(\d+)/);
  if (!planNumMatch) {
    return { content, message: `Could not parse plan number from: ${currentPlan}`, newPlanNum: null };
  }
  const currentNum = parseInt(planNumMatch[1], 10);
  const nextNum = currentNum + 1;
  const nextPlanStr = `Plan ${String(currentNum).padStart(2, "0")} complete, Plan ${String(nextNum).padStart(2, "0")} pending`;
  const updated = content.replace(
    /\*\*Current Plan:\*\*\s*[^\n]+/,
    `**Current Plan:** ${nextPlanStr}`
  );
  return { content: updated, message: `Advanced to Plan ${String(nextNum).padStart(2, "0")}`, newPlanNum: nextNum };
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
import { join as join13 } from "path";
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
      const logDir = join13(homedir2(), ".config", "opencode");
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
          message: `${count} notification${count === 1 ? "" : "s"} suppressed during DND. Use /bgsd-notifications to review.`,
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
import { existsSync as existsSync5 } from "fs";
import { join as join14 } from "path";
import { homedir as homedir3 } from "os";
function createFileWatcher(cwd, options = {}) {
  const { debounceMs = 200, maxWatchedPaths = 500 } = options;
  const planningDir = join14(cwd, ".planning");
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
      const logDir = join14(homedir3(), ".config", "opencode");
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
    }
  }
  function onWatchEvent(eventType, filename) {
    if (!filename) return;
    const fullPath = join14(planningDir, filename);
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
    if (!existsSync5(planningDir)) {
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
import { existsSync as existsSync6, readFileSync as readFileSync9, writeFileSync as writeFileSync3 } from "fs";
import { join as join15 } from "path";
import { execSync } from "child_process";
import { homedir as homedir4 } from "os";
await init_state();
await init_roadmap();
init_config();
function createIdleValidator(cwd, notifier, fileWatcher, config) {
  const planningDir = join15(cwd, ".planning");
  let lastValidation = 0;
  let lastAutoFix = 0;
  let validating = false;
  const cooldownMs = (config.idle_validation?.cooldown_seconds || 5) * 1e3;
  const stalenessHours = config.idle_validation?.staleness_threshold_hours || 2;
  const enabled = config.idle_validation?.enabled !== false;
  let logger = null;
  function getLogger() {
    if (!logger) {
      const logDir = join15(homedir4(), ".config", "opencode");
      logger = createLogger(logDir);
    }
    return logger;
  }
  function readStateMd() {
    try {
      return readFileSync9(join15(planningDir, "STATE.md"), "utf-8");
    } catch {
      return null;
    }
  }
  function readRoadmapMd() {
    try {
      return readFileSync9(join15(planningDir, "ROADMAP.md"), "utf-8");
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
      if (!existsSync6(planningDir)) return;
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
                message: `Phase ${phaseNum} complete! Next: Phase ${nextPhase.number} (${nextPhase.name})`,
                action: `Next: /bgsd-plan-phase ${nextPhase.number}`
              });
            }
          }
        }
        if (state.progress !== null) {
          const fixed = fixProgressBar(stateRaw, state.progress);
          if (fixed) {
            const statePath = join15(planningDir, "STATE.md");
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
        const configPath = join15(planningDir, "config.json");
        if (existsSync6(configPath)) {
          try {
            const raw = readFileSync9(configPath, "utf-8");
            JSON.parse(raw);
          } catch {
            const defaults = {
              mode: "interactive",
              depth: "standard",
              model_profile: "balanced",
              commit_docs: true
            };
            writeTracked(configPath, JSON.stringify(defaults, null, 2) + "\n");
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
              const statePath = join15(planningDir, "STATE.md");
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
import { join as join16 } from "path";
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
      const logDir = join16(homedir5(), ".config", "opencode");
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
import { readFileSync as readFileSync10 } from "fs";
import { join as join17, basename, extname, isAbsolute, resolve as resolve2 } from "path";
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
  "ROADMAP.md": ["/bgsd-add-phase", "/bgsd-remove-phase", "/bgsd-insert-phase"],
  "STATE.md": ["/bgsd-progress", "/bgsd-execute-phase"],
  "PLAN.md": ["/bgsd-plan-phase"],
  "CONTEXT.md": ["/bgsd-discuss-phase"],
  "RESEARCH.md": ["/bgsd-research-phase"],
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
    const agentsPath = join17(cwd, "AGENTS.md");
    const content = readFileSync10(agentsPath, "utf-8");
    const conventionNames = ["kebab-case", "camelCase", "PascalCase", "snake_case", "UPPER_SNAKE_CASE"];
    for (const conv of conventionNames) {
      if (content.includes(conv)) {
        return { dominant: conv, confidence: 100 };
      }
    }
  } catch {
  }
  try {
    const intelPath = join17(cwd, ".planning", "codebase", "codebase-intel.json");
    const intel = JSON.parse(readFileSync10(intelPath, "utf-8"));
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
    const pkgPath = join17(cwd, "package.json");
    const pkg = JSON.parse(readFileSync10(pkgPath, "utf-8"));
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
      const pyProject = join17(cwd, "pyproject.toml");
      readFileSync10(pyProject, "utf-8");
      result.command = "pytest";
      result.sourceExts = /* @__PURE__ */ new Set([".py"]);
    } catch {
    }
  }
  return result;
}
var WRITE_TOOLS = /* @__PURE__ */ new Set(["write", "edit", "patch"]);
function createAdvisoryGuardrails(cwd, notifier, config) {
  const guardConfig = config.advisory_guardrails || {};
  const conventionsEnabled = guardConfig.conventions !== false;
  const planningProtectionEnabled = guardConfig.planning_protection !== false;
  const testSuggestionsEnabled = guardConfig.test_suggestions !== false;
  const dedupThreshold = guardConfig.dedup_threshold || 3;
  const testDebounceMs = guardConfig.test_debounce_ms || 500;
  const confidenceThreshold = guardConfig.convention_confidence_threshold || 70;
  let logger = null;
  function getLogger() {
    if (!logger) {
      const logDir = join17(homedir6(), ".config", "opencode");
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
      if (!toolName || !WRITE_TOOLS.has(toolName)) return;
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
  const bgsdHome = join18(homedir7(), ".config", "opencode", "bgsd-oc");
  const registry = createToolRegistry(safeHook);
  const projectDir = directory || process.cwd();
  const config = parseConfig(projectDir);
  const notifier = createNotifier($, projectDir);
  const fileWatcher = createFileWatcher(projectDir, {
    debounceMs: config.file_watcher?.debounce_ms || 200,
    maxPaths: config.file_watcher?.max_watched_paths || 500
  });
  const idleValidator = createIdleValidator(projectDir, notifier, fileWatcher, config);
  const stuckDetector = createStuckDetector(notifier, config);
  const guardrails = createAdvisoryGuardrails(projectDir, notifier, config);
  fileWatcher.start();
  setTimeout(() => {
    try {
      getProjectState(projectDir);
    } catch {
      if (process.env.BGSD_DEBUG) {
        console.error("[bgsd-plugin] background warm-up failed (non-fatal)");
      }
    }
  }, 0);
  const shellEnv = safeHook("shell.env", async (input, output) => {
    if (!output || !output.env) return;
    output.env.BGSD_HOME = bgsdHome;
  });
  const compacting = safeHook("compacting", async (input, output) => {
    const projectDir2 = directory || process.cwd();
    const ctx = buildCompactionContext(projectDir2);
    if (ctx && output && output.context) {
      output.context.push(ctx);
    }
  });
  const systemTransform = safeHook("system.transform", async (input, output) => {
    const sysDir = directory || process.cwd();
    const prompt = buildSystemPrompt(sysDir);
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
    }
  });
  const toolAfter = safeHook("tool.execute.after", async (input) => {
    stuckDetector.trackToolCall(input);
    await guardrails.onToolAfter(input);
  });
  return {
    "shell.env": shellEnv,
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
  buildSystemPrompt,
  createAdvisoryGuardrails,
  createFileWatcher,
  createIdleValidator,
  createNotifier,
  createStuckDetector,
  createToolRegistry,
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
