/**
 * Parser barrel — re-exports all planning file parsers.
 * Provides a single import point for all parser functions.
 */

export { parseState, invalidateState } from './state.js';
export { parseRoadmap, invalidateRoadmap } from './roadmap.js';
export { parsePlan, parsePlans, invalidatePlans } from './plan.js';
export { parseConfig, invalidateConfig } from './config.js';
export { parseProject, invalidateProject } from './project.js';
export { parseIntent, invalidateIntent } from './intent.js';

import { invalidateState } from './state.js';
import { invalidateRoadmap } from './roadmap.js';
import { invalidatePlans } from './plan.js';
import { invalidateConfig } from './config.js';
import { invalidateProject } from './project.js';
import { invalidateIntent } from './intent.js';
import { getDb, PlanningCache } from '../lib/db-cache.js';

/**
 * Invalidate all parser caches for a given CWD (or all if no CWD).
 * Clears both in-memory Map caches and SQLite cache entries for the cwd.
 * Useful when files have been written and need re-reading.
 *
 * @param {string} [cwd] - Specific CWD to invalidate, or all if omitted
 */
export function invalidateAll(cwd) {
  invalidateState(cwd);
  invalidateRoadmap(cwd);
  invalidatePlans(cwd);
  invalidateConfig(cwd);
  invalidateProject(cwd);
  invalidateIntent(cwd);

  // Also clear SQLite cache entries for this cwd
  if (cwd) {
    try {
      const db = getDb(cwd);
      const cache = new PlanningCache(db);
      cache.clearForCwd(cwd);
    } catch {
      // Non-critical — in-memory caches already cleared
    }
  }
}

/**
 * Invalidate SQLite planning cache entries for a given CWD.
 * Does NOT clear the in-memory Map caches (use invalidateAll for both).
 *
 * @param {string} cwd - Project root directory
 */
export function invalidatePlanningCache(cwd) {
  if (!cwd) return;
  try {
    const db = getDb(cwd);
    const cache = new PlanningCache(db);
    cache.clearForCwd(cwd);
  } catch {
    // Non-critical
  }
}
