import { join } from 'path';
import { readdirSync } from 'fs';
import { parseState } from './parsers/state.js';
import { parseRoadmap } from './parsers/roadmap.js';
import { parsePlans } from './parsers/plan.js';
import { parseConfig } from './parsers/config.js';
import { parseProject } from './parsers/project.js';
import { parseIntent } from './parsers/intent.js';
import { invalidateState } from './parsers/state.js';
import { invalidateRoadmap } from './parsers/roadmap.js';
import { invalidatePlans } from './parsers/plan.js';
import { getDb, PlanningCache } from './lib/db-cache.js';

/**
 * Perform eager mtime check for all known planning files in the cwd.
 * For any stale files, invalidates their SQLite cache entries so the
 * individual parsers will re-parse them on their first call.
 *
 * Per CONTEXT.md decision: "Check all mtimes eagerly at command startup,
 * re-parse any stale files upfront"
 *
 * @param {string} resolvedCwd
 * @param {number|null} phaseNum - Current phase number (for plan files lookup)
 */
function _eagerMtimeCheck(resolvedCwd, phaseNum) {
  try {
    const db = getDb(resolvedCwd);
    const cache = new PlanningCache(db);

    // Collect all known planning files to check
    const filesToCheck = [
      join(resolvedCwd, '.planning', 'ROADMAP.md'),
      join(resolvedCwd, '.planning', 'STATE.md'),
    ];

    // Add plan files for the current phase
    if (phaseNum) {
      const normalized = String(phaseNum).replace(/^0+/, '') || '0';
      const phasesDir = join(resolvedCwd, '.planning', 'phases');
      try {
        const entries = readdirSync(phasesDir, { withFileTypes: true });
        let dirName = null;
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const dirMatch = entry.name.match(/^(\d+(?:\.\d+)?)-?(.*)/);
          if (!dirMatch) continue;
          const dirPhaseNum = dirMatch[1].replace(/^0+/, '') || '0';
          if (dirPhaseNum === normalized) {
            dirName = entry.name;
            break;
          }
        }
        if (dirName) {
          const phaseDir = join(phasesDir, dirName);
          const files = readdirSync(phaseDir);
          const planFiles = files
            .filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md')
            .map(f => join(phaseDir, f));
          filesToCheck.push(...planFiles);
        }
      } catch {
        // Phase directory not found — skip plan files
      }
    }

    // Bulk freshness check
    const freshnessResult = cache.checkAllFreshness(filesToCheck);

    // Invalidate stale files in SQLite + in-memory caches
    for (const staleFile of freshnessResult.stale) {
      cache.invalidateFile(staleFile);
      // Also clear the in-memory parser caches for stale files
      if (staleFile.endsWith('ROADMAP.md')) {
        invalidateRoadmap(resolvedCwd);
      } else if (staleFile.endsWith('STATE.md')) {
        invalidateState(resolvedCwd);
      } else if (staleFile.endsWith('-PLAN.md') || staleFile.endsWith('PLAN.md')) {
        invalidatePlans(resolvedCwd);
      }
    }
  } catch {
    // Eager mtime check is non-critical — parsers handle stale data themselves
  }
}

/**
 * Unified ProjectState facade over all parsers.
 * Composes data from all 6 parsers into a single frozen object.
 *
 * Performs an eager mtime check at startup to detect file changes and
 * invalidate stale SQLite cache entries before parsers are called.
 * Per CONTEXT.md decision: "Check all mtimes eagerly at command startup"
 *
 * Uses existing parser caches — no additional caching layer needed.
 * Each parser maintains its own Map cache with frozen results.
 *
 * @param {string} [cwd] - Working directory (defaults to process.cwd())
 * @returns {object|null} Frozen project state object, or null if no .planning/
 */
export function getProjectState(cwd) {
  const resolvedCwd = cwd || process.cwd();

  // If no STATE.md exists, there's no .planning/ directory
  const state = parseState(resolvedCwd);
  if (!state) {
    return null;
  }

  // Derive current phase number for plan file discovery
  let phaseNumForCheck = null;
  if (state.phase) {
    const phaseMatch = state.phase.match(/^(\d+)/);
    if (phaseMatch) {
      phaseNumForCheck = parseInt(phaseMatch[1], 10);
    }
  }

  // Eager mtime check: invalidate stale SQLite cache entries upfront
  // This ensures individual parsers will re-parse any changed files
  _eagerMtimeCheck(resolvedCwd, phaseNumForCheck);

  const roadmap = parseRoadmap(resolvedCwd);
  const config = parseConfig(resolvedCwd);
  const project = parseProject(resolvedCwd);
  const intent = parseIntent(resolvedCwd);

  // Derive current phase number from state.phase field
  // Format: "73 — Context Injection" or "73 - Context Injection" or just "73"
  let phaseNum = null;
  if (state.phase) {
    const phaseMatch = state.phase.match(/^(\d+)/);
    if (phaseMatch) {
      phaseNum = parseInt(phaseMatch[1], 10);
    }
  }

  // Get current phase details from roadmap
  let currentPhase = null;
  if (phaseNum && roadmap) {
    currentPhase = roadmap.getPhase(phaseNum);
  }

  // Get current milestone from roadmap
  const currentMilestone = roadmap ? roadmap.currentMilestone : null;

  // Parse plans for current phase and resolve phaseDir
  let plans = Object.freeze([]);
  let phaseDir = null;
  if (phaseNum) {
    plans = parsePlans(phaseNum, resolvedCwd);

    // Resolve phaseDir for current phase (relative path like '.planning/phases/0120-name')
    // This is already computed inside _eagerMtimeCheck — compute it here for the facade.
    // Uses normalized comparison to handle variable-length zero-padding in directory names.
    try {
      const normalized = String(phaseNum).replace(/^0+/, '') || '0';
      const phasesDir = join(resolvedCwd, '.planning', 'phases');
      const entries = readdirSync(phasesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const dirMatch = entry.name.match(/^(\d+(?:\.\d+)?)-?(.*)/);
        if (!dirMatch) continue;
        const dirPhaseNum = dirMatch[1].replace(/^0+/, '') || '0';
        if (dirPhaseNum === normalized) {
          phaseDir = `.planning/phases/${entry.name}`;
          break;
        }
      }
    } catch {
      // Phase directory not found — phaseDir stays null
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
    currentMilestone,
  });
}
