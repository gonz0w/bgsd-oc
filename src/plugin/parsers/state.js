import { readFileSync } from 'fs';
import { join } from 'path';
import { getDb, PlanningCache } from '../lib/db-cache.js';

/**
 * STATE.md parser for in-process reading.
 * Extracts structured data from .planning/STATE.md without spawning CLI subprocesses.
 *
 * SQLite-first: attempts to read from SQLite session tables on warm starts,
 * falling back to markdown parsing on cache miss. On Map backend, always parses markdown.
 *
 * Parsing logic extracted from src/commands/state.js (stateExtractField pattern)
 * and src/lib/helpers.js (safeReadFile). Self-contained — no CLI imports.
 */

// Module-level cache: cwd → frozen parsed state
const _cache = new Map();

/**
 * Extract a **FieldName:** value from STATE.md content.
 * Uses the same regex pattern as stateExtractField in the CLI.
 */
function extractField(content, fieldName) {
  const pattern = new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*(.+)`, 'i');
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}

/**
 * Extract a ## Section from STATE.md content.
 * Returns the content between the section header and the next ## header or end of file.
 */
function extractSection(content, sectionName) {
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`##\\s*${escaped}\\s*\\n([\\s\\S]*?)(?=\\n##|$)`, 'i');
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}

/**
 * Extract progress percentage from progress bar like [█████░░░░░] 50%
 */
function extractProgress(content) {
  const match = content.match(/\[[\u2588\u2591]+\]\s*(\d+)%/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Parse STATE.md from the given working directory (or CWD).
 * Returns a frozen object with structured accessors, or null if file can't be parsed.
 *
 * On warm starts (SQLite backend with session_state row populated), serves structured
 * data directly from SQLite without parsing STATE.md markdown. Falls back to markdown
 * parsing when:
 *   - SQLite backend unavailable (Map fallback)
 *   - session_state table has no row for this cwd (cold start / pre-migration)
 *
 * The returned frozen object always has the same interface regardless of source:
 *   - raw: STATE.md content (always read from disk for consumers expecting markdown)
 *   - phase, currentPlan, status, lastActivity, progress: primary fields
 *   - getField(name): read a **Field:** value
 *   - getSection(name): read a ## Section
 *   - getDecisions(options): query session_decisions from SQLite (or null on Map)
 *   - getTodos(options): query session_todos from SQLite (or null on Map)
 *   - getBlockers(options): query session_blockers from SQLite (or null on Map)
 *   - getMetrics(options): query session_metrics from SQLite (or null on Map)
 *
 * @param {string} [cwd] - Working directory (defaults to process.cwd())
 * @returns {object|null} Frozen state object or null
 */
export function parseState(cwd) {
  const resolvedCwd = cwd || process.cwd();

  // Check in-memory cache
  if (_cache.has(resolvedCwd)) {
    return _cache.get(resolvedCwd);
  }

  const statePath = join(resolvedCwd, '.planning', 'STATE.md');

  // ─── SQLite-first path ────────────────────────────────────────────────────
  // Attempt to read primary fields from SQLite session_state. If successful,
  // we avoid parsing STATE.md for structured fields (warm start optimization).
  // We still read raw from disk so consumers that need markdown content can
  // use result.raw.

  let sqlRow = null;
  let db = null;
  let cache = null;

  try {
    db = getDb(resolvedCwd);
    if (db.backend === 'sqlite') {
      cache = new PlanningCache(db);
      sqlRow = cache.getSessionState(resolvedCwd);
    }
  } catch {
    // SQLite unavailable — fall through to markdown parsing
    sqlRow = null;
  }

  // Always read STATE.md content for raw field (consumers may need it)
  let raw;
  try {
    raw = readFileSync(statePath, 'utf-8');
  } catch {
    return null;
  }

  if (!raw || raw.trim().length === 0) {
    return null;
  }

  let result;

  if (sqlRow && db && cache) {
    // ─── Warm start: serve structured fields from SQLite ───────────────────
    // Primary fields come from SQLite columns; getField/getSection fall back
    // to parsing raw markdown for unknown fields.
    const _db = db;
    const _cache_ref = cache;

    result = Object.freeze({
      raw,
      // Primary fields from SQLite columns
      phase: sqlRow.phase_number
        ? (sqlRow.total_phases
          ? `${sqlRow.phase_number} of ${sqlRow.total_phases}${sqlRow.phase_name ? ` (${sqlRow.phase_name})` : ''}`
          : sqlRow.phase_number)
        : extractField(raw, 'Phase'),
      currentPlan: sqlRow.current_plan || extractField(raw, 'Current Plan'),
      status: sqlRow.status || extractField(raw, 'Status'),
      lastActivity: sqlRow.last_activity || extractField(raw, 'Last Activity'),
      progress: sqlRow.progress != null ? sqlRow.progress : extractProgress(raw),

      // getField falls back to markdown parsing for fields not in SQLite
      getField(name) {
        // For well-known fields, prefer SQLite
        const nameLower = name.toLowerCase().replace(/\s+/g, '_');
        if (nameLower === 'phase' || nameLower === 'phase_number') {
          return sqlRow.phase_number || extractField(raw, name);
        }
        if (nameLower === 'current_plan' || name === 'Current Plan') {
          return sqlRow.current_plan || extractField(raw, name);
        }
        if (nameLower === 'status') {
          return sqlRow.status || extractField(raw, name);
        }
        if (nameLower === 'last_activity' || name === 'Last Activity') {
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
        } catch { return null; }
      },
      getTodos(options) {
        try {
          return _cache_ref.getSessionTodos(resolvedCwd, options);
        } catch { return null; }
      },
      getBlockers(options) {
        try {
          return _cache_ref.getSessionBlockers(resolvedCwd, options);
        } catch { return null; }
      },
      getMetrics(options) {
        try {
          return _cache_ref.getSessionMetrics(resolvedCwd, options);
        } catch { return null; }
      },
    });
  } else {
    // ─── Cold start / Map fallback: parse markdown ─────────────────────────
    // SQLite has no session_state row yet (pre-migration) or backend is Map.
    // All fields come from markdown parsing.
    const _db_ref = db;
    const _cache_fallback = cache;

    result = Object.freeze({
      raw,
      phase: extractField(raw, 'Phase'),
      currentPlan: extractField(raw, 'Current Plan'),
      status: extractField(raw, 'Status'),
      lastActivity: extractField(raw, 'Last Activity'),
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
        try { return _cache_fallback.getSessionDecisions(resolvedCwd, options); } catch { return null; }
      },
      getTodos(options) {
        if (!_cache_fallback || _cache_fallback._isMap()) return null;
        try { return _cache_fallback.getSessionTodos(resolvedCwd, options); } catch { return null; }
      },
      getBlockers(options) {
        if (!_cache_fallback || _cache_fallback._isMap()) return null;
        try { return _cache_fallback.getSessionBlockers(resolvedCwd, options); } catch { return null; }
      },
      getMetrics(options) {
        if (!_cache_fallback || _cache_fallback._isMap()) return null;
        try { return _cache_fallback.getSessionMetrics(resolvedCwd, options); } catch { return null; }
      },
    });
  }

  _cache.set(resolvedCwd, result);
  return result;
}

/**
 * Invalidate cached state for a given CWD (or all if no CWD).
 * Clears both the in-memory Map cache and the SQLite session_state row so
 * the next parseState() call re-parses STATE.md from disk (ensures fresh reads
 * after external STATE.md modifications, e.g. in tests).
 *
 * @param {string} [cwd] - Specific CWD to invalidate, or all if omitted
 */
export function invalidateState(cwd) {
  if (cwd) {
    _cache.delete(cwd);
    // Also clear related SQLite session tables so the next call re-reads from disk
    // and no stale derived views survive a mutation.
    try {
      const db = getDb(cwd);
      if (db.backend === 'sqlite') {
        const tables = [
          'session_state',
          'session_metrics',
          'session_decisions',
          'session_todos',
          'session_blockers',
          'session_continuity',
        ];
        for (const table of tables) {
          db.prepare(`DELETE FROM ${table} WHERE cwd = ?`).run(cwd);
        }
      }
    } catch { /* non-fatal — in-memory cache already cleared */ }
  } else {
    _cache.clear();
    // Cannot efficiently clear all cwd SQLite rows here — callers should
    // use invalidateState(specificCwd) when they know the project directory.
  }
}
