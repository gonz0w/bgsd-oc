import { readFileSync } from 'fs';
import { join } from 'path';
import { getDb, PlanningCache } from '../lib/db-cache.js';

/**
 * ROADMAP.md parser for in-process reading.
 * Extracts milestones, phases, progress table from .planning/ROADMAP.md.
 *
 * Parsing logic extracted from src/commands/roadmap.js (cmdRoadmapGetPhase)
 * and src/lib/helpers.js (getRoadmapPhaseInternal). Self-contained — no CLI imports.
 *
 * SQLite-first: checks PlanningCache freshness before reading ROADMAP.md.
 * On cache hit, reconstructs the frozen result from SQLite rows.
 * On miss/stale, parses markdown and writes through to PlanningCache.
 */

// Module-level cache: cwd → frozen parsed roadmap
const _cache = new Map();

/**
 * Get a PlanningCache instance for the given cwd.
 * Returns null if db is unavailable (MapDatabase backend returns null from cache ops).
 * @param {string} cwd
 * @returns {PlanningCache|null}
 */
function _getPlanningCache(cwd) {
  try {
    const db = getDb(cwd);
    return new PlanningCache(db);
  } catch {
    return null;
  }
}

/**
 * Parse milestone entries from the roadmap.
 * Handles: - ✅ **vX.Y Name** ... and - 🔵 **vX.Y Name** ...
 */
function parseMilestones(content) {
  const milestones = [];
  const pattern = /[-*]\s*(?:✅|🔵|🔲)\s*\*\*v(\d+(?:\.\d+)*)\s+([^*]+)\*\*([^\n]*)/g;
  let match;

  while ((match = pattern.exec(content)) !== null) {
    const status = match[0].includes('✅') ? 'complete'
      : match[0].includes('🔵') ? 'active'
      : 'pending';

    // Extract phase range if present
    const rangeMatch = match[0].match(/Phases?\s+(\d+)\s*[-–]\s*(\d+)/i);
    const phases = rangeMatch
      ? { start: parseInt(rangeMatch[1], 10), end: parseInt(rangeMatch[2], 10) }
      : null;

    milestones.push(Object.freeze({
      name: match[2].trim(),
      version: 'v' + match[1],
      status,
      phases,
    }));
  }

  return milestones;
}

/**
 * Parse phase list from ## Phase N: Name headers.
 */
function parsePhases(content) {
  const phases = [];
  const pattern = /#{2,4}\s*Phase\s+(\d+(?:\.\d+)?)\s*:\s*([^\n]+)/gi;
  let match;

  while ((match = pattern.exec(content)) !== null) {
    const number = match[1];
    const name = match[2].trim();

    // Extract section content
    const sectionStart = match.index;
    const restOfContent = content.slice(sectionStart);
    const nextHeader = restOfContent.match(/\n#{2,4}\s+Phase\s+\d/i);
    const sectionEnd = nextHeader ? sectionStart + nextHeader.index : content.length;
    const section = content.slice(sectionStart, sectionEnd).trim();

    // Extract goal
    const goalMatch = section.match(/\*\*Goal:?\*\*:?\s*([^\n]+)/i);
    const goal = goalMatch ? goalMatch[1].trim() : null;

    // Extract plan count: **Plans:** X/Y or **Plans:** Y
    const plansMatch = section.match(/\*\*Plans:?\*\*:?\s*(?:(\d+)\/)?(\d+)\s*plan/i);
    const planCount = plansMatch ? parseInt(plansMatch[2], 10) : 0;

    // Check completion status via checkbox - escape all regex special chars
    const escaped = number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const checkboxPattern = new RegExp(`-\\s*\\[x\\]\\s*.*Phase\\s+${escaped}`, 'i');
    const status = checkboxPattern.test(content) ? 'complete' : 'incomplete';

    phases.push(Object.freeze({
      number,
      name,
      status,
      planCount,
      goal,
      section,
    }));
  }

  return phases;
}

/**
 * Parse the progress table from the roadmap.
 * Expects: | Phase | Plans | Status | Completed |
 */
function parseProgressTable(content) {
  const progress = [];
  // Find the progress table
  const tableMatch = content.match(/\|[^\n]*Phase[^\n]*\|[^\n]*Plans?[^\n]*\|[^\n]*Status[^\n]*\|[^\n]*\n\|[-|\s]+\n((?:\|[^\n]+\n?)*)/i);
  if (!tableMatch) return progress;

  const rows = tableMatch[1].trim().split('\n');
  for (const row of rows) {
    const cells = row.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length >= 3) {
      const plansParts = cells[1].match(/(\d+)\/(\d+)/);
      progress.push(Object.freeze({
        phase: cells[0],
        milestone: null, // Can be derived from position if needed
        plansComplete: plansParts ? parseInt(plansParts[1], 10) : 0,
        plansTotal: plansParts ? parseInt(plansParts[2], 10) : 0,
        status: cells[2],
        completed: cells.length >= 4 ? cells[3] || null : null,
      }));
    }
  }

  return progress;
}

/**
 * Build a roadmap result object from SQLite cache rows.
 * Reconstructs the same frozen object shape as the markdown-parsed version.
 * The only acceptable difference: `raw` is null on cache hits.
 *
 * @param {Array} phaseRows - rows from phases table
 * @param {Array} milestoneRows - rows from milestones table
 * @param {Array} progressRows - rows from progress table
 * @param {string} resolvedCwd - Project root (for getPhase SQLite access)
 * @returns {object} Frozen roadmap object
 */
function buildRoadmapFromCache(phaseRows, milestoneRows, progressRows, resolvedCwd) {
  // Reconstruct milestones — schema: { id, cwd, name, version, status, phase_start, phase_end }
  const milestones = (milestoneRows || []).map(row => Object.freeze({
    name: row.name || '',
    version: row.version || null,
    status: row.status || 'pending',
    phases: (row.phase_start != null && row.phase_end != null)
      ? { start: row.phase_start, end: row.phase_end }
      : null,
  }));

  // Reconstruct phases — schema: { number, cwd, name, status, plan_count, goal, depends_on, requirements, section }
  const phases = (phaseRows || []).map(row => Object.freeze({
    number: row.number || '',
    name: row.name || '',
    status: row.status || 'incomplete',
    planCount: row.plan_count != null ? row.plan_count : 0,
    goal: row.goal || null,
    section: row.section || '',
  }));

  // Reconstruct progress — schema: { phase, cwd, plans_complete, plans_total, status, completed_date }
  const progress = (progressRows || []).map(row => Object.freeze({
    phase: row.phase || '',
    milestone: null,
    plansComplete: row.plans_complete != null ? row.plans_complete : 0,
    plansTotal: row.plans_total != null ? row.plans_total : 0,
    status: row.status || '',
    completed: row.completed_date || null,
  }));

  return Object.freeze({
    raw: null, // not stored in cache — consumers needing raw markdown should parse fresh
    milestones,
    phases,
    progress,

    getPhase(num) {
      const numStr = String(num);
      const found = phases.find(p => p.number === numStr);
      if (!found) return null;

      const section = found.section || '';
      const dependsMatch = section.match(/\*\*Depends on:?\*\*:?\s*([^\n]+)/i);
      const dependsOn = dependsMatch ? dependsMatch[1].trim() : null;

      const reqMatch = section.match(/\*\*Requirements:?\*\*:?\s*([^\n]+)/i);
      const requirements = reqMatch ? reqMatch[1].trim() : null;

      const criteriaMatch = section.match(/\*\*Success Criteria\*\*[^\n]*:\s*\n((?:\s*\d+\.\s*[^\n]+\n?)+)/i);
      const successCriteria = criteriaMatch
        ? criteriaMatch[1].trim().split('\n').map(l => l.replace(/^\s*\d+\.\s*/, '').trim()).filter(Boolean)
        : [];

      const plansMatch = section.match(/\*\*Plans:?\*\*:?\s*(?:(\d+)\/)?(\d+)\s*plan/i);
      const plans = plansMatch ? {
        completed: plansMatch[1] ? parseInt(plansMatch[1], 10) : 0,
        total: parseInt(plansMatch[2], 10),
      } : null;

      return Object.freeze({
        number: found.number,
        name: found.name,
        goal: found.goal,
        dependsOn,
        requirements,
        successCriteria,
        plans,
      });
    },

    getMilestone(name) {
      return milestones.find(m =>
        m.name.toLowerCase().includes(name.toLowerCase()) ||
        (m.version && m.version.toLowerCase() === name.toLowerCase())
      ) || null;
    },

    get currentMilestone() {
      return milestones.find(m => m.status === 'active') || null;
    },
  });
}

/**
 * Parse ROADMAP.md from the given working directory (or CWD).
 * Returns a frozen object with structured accessors, or null if file can't be parsed.
 *
 * SQLite-first: checks PlanningCache freshness before reading ROADMAP.md.
 * On cache hit, reconstructs the frozen result from SQLite rows.
 * On miss/stale, parses markdown and writes through to PlanningCache.
 *
 * @param {string} [cwd] - Working directory (defaults to process.cwd())
 * @returns {object|null} Frozen roadmap object or null
 */
export function parseRoadmap(cwd) {
  const resolvedCwd = cwd || process.cwd();

  // Check in-memory cache first (fastest path)
  if (_cache.has(resolvedCwd)) {
    return _cache.get(resolvedCwd);
  }

  const roadmapPath = join(resolvedCwd, '.planning', 'ROADMAP.md');

  // --- SQLite freshness check ---
  const planningCache = _getPlanningCache(resolvedCwd);
  if (planningCache) {
    const freshness = planningCache.checkFreshness(roadmapPath);
    if (freshness === 'fresh') {
      const phaseRows = planningCache.getPhases(resolvedCwd);
      if (phaseRows && phaseRows.length > 0) {
        const milestoneRows = planningCache.getMilestones(resolvedCwd);
        const progressRows = planningCache.getProgress(resolvedCwd);
        const result = buildRoadmapFromCache(phaseRows, milestoneRows || [], progressRows || [], resolvedCwd);
        _cache.set(resolvedCwd, result);
        return result;
      }
      // Fresh mtime but no phase rows — fall through to parse
    }
    // stale or missing — fall through to parse
  }

  // --- Markdown parse ---
  let raw;
  try {
    raw = readFileSync(roadmapPath, 'utf-8');
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
      const found = phases.find(p => p.number === numStr);
      if (!found) return null;

      // Extract additional details from section
      const section = found.section;
      const dependsMatch = section.match(/\*\*Depends on:?\*\*:?\s*([^\n]+)/i);
      const dependsOn = dependsMatch ? dependsMatch[1].trim() : null;

      const reqMatch = section.match(/\*\*Requirements:?\*\*:?\s*([^\n]+)/i);
      const requirements = reqMatch ? reqMatch[1].trim() : null;

      const criteriaMatch = section.match(/\*\*Success Criteria\*\*[^\n]*:\s*\n((?:\s*\d+\.\s*[^\n]+\n?)+)/i);
      const successCriteria = criteriaMatch
        ? criteriaMatch[1].trim().split('\n').map(l => l.replace(/^\s*\d+\.\s*/, '').trim()).filter(Boolean)
        : [];

      // Extract plans info
      const plansMatch = section.match(/\*\*Plans:?\*\*:?\s*(?:(\d+)\/)?(\d+)\s*plan/i);
      const plans = plansMatch ? {
        completed: plansMatch[1] ? parseInt(plansMatch[1], 10) : 0,
        total: parseInt(plansMatch[2], 10),
      } : null;

      return Object.freeze({
        number: found.number,
        name: found.name,
        goal: found.goal,
        dependsOn,
        requirements,
        successCriteria,
        plans,
      });
    },

    getMilestone(name) {
      return milestones.find(m =>
        m.name.toLowerCase().includes(name.toLowerCase()) ||
        m.version.toLowerCase() === name.toLowerCase()
      ) || null;
    },

    get currentMilestone() {
      return milestones.find(m => m.status === 'active') || null;
    },
  });

  // --- Write-through to SQLite ---
  if (planningCache) {
    // Adapt parser field names (camelCase) → storage field names (snake_case)
    const storedPhases = phases.map(p => ({
      number: p.number,
      name: p.name,
      status: p.status,
      plan_count: p.planCount,
      goal: p.goal,
      section: p.section,
    }));
    const storedMilestones = milestones.map(m => ({
      name: m.name,
      version: m.version,
      status: m.status,
      phase_start: m.phases ? m.phases.start : null,
      phase_end: m.phases ? m.phases.end : null,
    }));
    const storedProgress = progress.map(p => ({
      phase: p.phase,
      plans_complete: p.plansComplete,
      plans_total: p.plansTotal,
      status: p.status,
      completed_date: p.completed,
    }));

    planningCache.storeRoadmap(resolvedCwd, roadmapPath, {
      phases: storedPhases,
      milestones: storedMilestones,
      progress: storedProgress,
    });
  }

  _cache.set(resolvedCwd, result);
  return result;
}

/**
 * Invalidate cached roadmap for a given CWD (or all if no CWD).
 * Clears both the in-memory Map cache and SQLite cache entries.
 * @param {string} [cwd] - Specific CWD to invalidate, or all if omitted
 */
export function invalidateRoadmap(cwd) {
  if (cwd) {
    _cache.delete(cwd);
    // Also clear SQLite cache entries for the roadmap file
    try {
      const planningCache = _getPlanningCache(cwd);
      if (planningCache) {
        const roadmapPath = join(cwd, '.planning', 'ROADMAP.md');
        planningCache.invalidateFile(roadmapPath);
      }
    } catch {
      // Non-critical — in-memory cache already cleared
    }
  } else {
    _cache.clear();
    // Cannot clear all SQLite entries without cwd — in-memory clear is sufficient
  }
}
