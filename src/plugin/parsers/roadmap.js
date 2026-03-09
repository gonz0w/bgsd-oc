import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * ROADMAP.md parser for in-process reading.
 * Extracts milestones, phases, progress table from .planning/ROADMAP.md.
 *
 * Parsing logic extracted from src/commands/roadmap.js (cmdRoadmapGetPhase)
 * and src/lib/helpers.js (getRoadmapPhaseInternal). Self-contained — no CLI imports.
 */

// Module-level cache: cwd → frozen parsed roadmap
const _cache = new Map();

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

    // Check completion status via checkbox
    const escaped = number.replace(/\./g, '\\.');
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
 * Parse ROADMAP.md from the given working directory (or CWD).
 * Returns a frozen object with structured accessors, or null if file can't be parsed.
 *
 * @param {string} [cwd] - Working directory (defaults to process.cwd())
 * @returns {object|null} Frozen roadmap object or null
 */
export function parseRoadmap(cwd) {
  const resolvedCwd = cwd || process.cwd();

  // Check cache
  if (_cache.has(resolvedCwd)) {
    return _cache.get(resolvedCwd);
  }

  const roadmapPath = join(resolvedCwd, '.planning', 'ROADMAP.md');

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

  _cache.set(resolvedCwd, result);
  return result;
}

/**
 * Invalidate cached roadmap for a given CWD (or all if no CWD).
 * @param {string} [cwd] - Specific CWD to invalidate, or all if omitted
 */
export function invalidateRoadmap(cwd) {
  if (cwd) {
    _cache.delete(cwd);
  } else {
    _cache.clear();
  }
}
