import { getProjectState } from './project-state.js';
import { parsePlans } from './parsers/index.js';
import { readdirSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Command enrichment for /bgsd-* slash commands.
 * Prepends init-equivalent project context as a <bgsd-context> XML block
 * so workflows don't need to call init:* subprocesses.
 *
 * Only intercepts commands starting with 'bgsd-'. Non-bgsd commands
 * are passed through untouched.
 *
 * Phase-aware: if command arguments contain a phase number, enrichment
 * includes phase-specific context (phase dir, plans, goal).
 *
 * @module command-enricher
 */

/**
 * Enrich a /bgsd-* command with project context.
 *
 * @param {object} input - Command input { command: string, parts: string[] }
 * @param {object} output - Mutable output { parts: string[] }
 * @param {string} [cwd] - Working directory
 */
export function enrichCommand(input, output, cwd) {
  if (!input || !output) return;

  // Extract command name from input
  const command = input.command || (input.parts && input.parts[0]) || '';

  // Only intercept /bgsd-* commands
  if (!command.startsWith('bgsd-')) return;

  const resolvedCwd = cwd || process.cwd();

  let projectState;
  try {
    projectState = getProjectState(resolvedCwd);
  } catch (err) {
    // Enrichment failure — tell agent to run /bgsd-health
    if (output.parts) {
      output.parts.unshift(
        '<bgsd-context>\n{"error": "Failed to load project state. Run /bgsd-health to diagnose."}\n</bgsd-context>'
      );
    }
    return;
  }

  // No .planning/ — only bgsd-new-project and bgsd-help work without it
  if (!projectState) {
    if (command !== 'bgsd-new-project' && command !== 'bgsd-help') {
      if (output.parts) {
        output.parts.unshift(
          '<bgsd-context>\n{"error": "No .planning/ directory found. Run /bgsd-new-project to initialize."}\n</bgsd-context>'
        );
      }
    }
    return;
  }

  const { state, config, roadmap, currentPhase, currentMilestone } = projectState;

  // Build enrichment object (init-equivalent JSON)
  const enrichment = {
    // Paths
    planning_dir: '.planning',
    state_path: '.planning/STATE.md',
    roadmap_path: '.planning/ROADMAP.md',
    config_path: '.planning/config.json',

    // Config flags
    commit_docs: config ? config.commit_docs : true,
    branching_strategy: config ? (config.branching_strategy || 'none') : 'none',
    verifier_enabled: config ? config.verifier : true,
    research_enabled: config ? config.research : true,

    // Milestone
    milestone: currentMilestone ? currentMilestone.version : null,
    milestone_name: currentMilestone ? currentMilestone.name : null,
  };

  // Phase-aware detection: scan command parts for a phase number argument
  const phaseNum = detectPhaseArg(input.parts);

  if (phaseNum) {
    // Phase-specific enrichment
    const phaseDir = resolvePhaseDir(phaseNum, resolvedCwd);
    if (phaseDir) {
      enrichment.phase_dir = phaseDir;
      enrichment.phase_number = String(phaseNum);

      // Get phase details from roadmap
      if (roadmap) {
        const phase = roadmap.getPhase(phaseNum);
        if (phase) {
          enrichment.phase_name = phase.name;
          enrichment.phase_slug = `${String(phaseNum).padStart(2, '0')}-${toSlug(phase.name)}`;
          if (phase.goal) enrichment.phase_goal = phase.goal;
        }
      }

      // Get plans for this phase
      try {
        const plans = parsePlans(phaseNum, resolvedCwd);
        if (plans && plans.length > 0) {
          enrichment.plans = plans.map(p => p.path ? p.path.split('/').pop() : null).filter(Boolean);

          // Find incomplete plans (no matching SUMMARY)
          const phaseDirFull = join(resolvedCwd, phaseDir);
          const summaryFiles = listSummaryFiles(phaseDirFull);
          enrichment.incomplete_plans = enrichment.plans.filter(planFile => {
            const summaryFile = planFile.replace('-PLAN.md', '-SUMMARY.md');
            return !summaryFiles.includes(summaryFile);
          });
        }
      } catch { /* skip plan enumeration on failure */ }
    }
  } else if (state && state.phase) {
    // No explicit phase arg — use current phase from STATE.md
    const currentPhaseMatch = state.phase.match(/^(\d+)/);
    if (currentPhaseMatch) {
      const curPhaseNum = parseInt(currentPhaseMatch[1], 10);
      enrichment.phase_number = String(curPhaseNum);

      if (currentPhase) {
        enrichment.phase_name = currentPhase.name;
      }

      const phaseDir = resolvePhaseDir(curPhaseNum, resolvedCwd);
      if (phaseDir) {
        enrichment.phase_dir = phaseDir;
      }
    }
  }

  // Prepend enrichment as <bgsd-context> XML block
  if (output.parts) {
    output.parts.unshift(
      `<bgsd-context>\n${JSON.stringify(enrichment, null, 2)}\n</bgsd-context>`
    );
  }
}

/**
 * Detect a phase number from command arguments.
 * Scans for a standalone digit pattern (e.g., "73", "01").
 *
 * @param {string[]} parts - Command parts array
 * @returns {number|null} Phase number or null
 */
function detectPhaseArg(parts) {
  if (!parts || !Array.isArray(parts)) return null;

  // Skip the first part (command name), scan remaining args
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (typeof part === 'string') {
      const match = part.match(/^(\d{1,3})$/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
  }
  return null;
}

/**
 * Resolve a phase number to its directory path (relative).
 *
 * @param {number} phaseNum - Phase number
 * @param {string} cwd - Working directory
 * @returns {string|null} Relative path like '.planning/phases/73-context-injection' or null
 */
function resolvePhaseDir(phaseNum, cwd) {
  const numStr = String(phaseNum).padStart(2, '0');
  const phasesDir = join(cwd, '.planning', 'phases');

  try {
    const entries = readdirSync(phasesDir);
    const dirName = entries.find(d => d.startsWith(numStr + '-') || d === numStr);
    if (dirName) {
      return `.planning/phases/${dirName}`;
    }
  } catch { /* phases dir doesn't exist */ }

  return null;
}

/**
 * List SUMMARY files in a phase directory.
 *
 * @param {string} phaseDir - Full path to phase directory
 * @returns {string[]} Array of SUMMARY filenames
 */
function listSummaryFiles(phaseDir) {
  try {
    if (!existsSync(phaseDir)) return [];
    const files = readdirSync(phaseDir);
    return files.filter(f => f.endsWith('-SUMMARY.md'));
  } catch {
    return [];
  }
}

/**
 * Convert a phase name to a URL-safe slug.
 *
 * @param {string} name - Phase name
 * @returns {string} Slugified name
 */
function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
