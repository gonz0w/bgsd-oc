import { getProjectState } from './project-state.js';
import { parsePlans } from './parsers/index.js';
import { evaluateDecisions } from '../lib/decision-rules.js';
import { getDb, PlanningCache } from './lib/db-cache.js';
import { readdirSync, existsSync, readFileSync } from 'fs';
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
 * @param {object} input - Command input { command: string, sessionID: string, arguments: string }
 * @param {object} output - Mutable output { parts: Part[] } where Part is { type: string, text: string, ... }
 * @param {string} [cwd] - Working directory
 */
export function enrichCommand(input, output, cwd) {
  if (!input || !output) return;

  // Extract command name from input
  const command = input.command || (input.parts && input.parts[0]) || '';

  // Only intercept /bgsd-* commands
  if (!command.startsWith('bgsd-')) return;

  // ENR-03: Record start time for enrichment duration measurement
  const _t0 = (typeof performance !== 'undefined' && performance.now)
    ? performance.now()
    : Date.now();

  const resolvedCwd = cwd || process.cwd();

  let projectState;
  try {
    projectState = getProjectState(resolvedCwd);
  } catch (err) {
    // Enrichment failure — tell agent to run /bgsd-health
    if (output.parts) {
      output.parts.unshift({
        type: 'text',
        text: '<bgsd-context>\n{"error": "Failed to load project state. Run /bgsd-health to diagnose."}\n</bgsd-context>',
      });
    }
    return;
  }

  // No .planning/ — only bgsd-new-project and bgsd-help work without it
  if (!projectState) {
    if (command !== 'bgsd-new-project' && command !== 'bgsd-help') {
      if (output.parts) {
        output.parts.unshift({
          type: 'text',
          text: '<bgsd-context>\n{"error": "No .planning/ directory found. Run /bgsd-new-project to initialize."}\n</bgsd-context>',
        });
      }
    }
    return;
  }

  const { state, config, roadmap, currentPhase, currentMilestone, plans: statePlans, phaseDir: statePhaseDir } = projectState;

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

  // Resolve effective phase number (explicit arg or current from STATE.md)
  let effectivePhaseNum = phaseNum;

  // ── Single parsePlans / listSummaryFiles allocation ────────────────────────
  // `plans` is populated at most once per invocation. All downstream logic
  // references this cached result — no second parsePlans call anywhere.
  // `summaryFiles` is populated at most once — all three former call sites
  // now reference this cached result.
  let plans = null;          // parsed plan objects for the effective phase
  let summaryFiles = null;   // SUMMARY filenames in the phase dir

  /**
   * Ensure plans are loaded exactly once for the given phase number.
   * Reuses the `plans` variable via closure — call this instead of
   * calling parsePlans directly.
   */
  const ensurePlans = (num) => {
    if (!plans && num) {
      plans = parsePlans(num, resolvedCwd);
    }
    return plans;
  };

  /**
   * Ensure summaryFiles are loaded exactly once for the phase dir.
   * Reuses the `summaryFiles` variable via closure — call this instead of
   * calling listSummaryFiles directly.
   */
  const ensureSummaryFiles = (phaseDirFull) => {
    if (summaryFiles === null) {
      summaryFiles = listSummaryFiles(phaseDirFull);
    }
    return summaryFiles;
  };

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

      // Try SQLite-first path for plan/summary data
      let sqlUsedInPhaseArg = false;
      try {
        const db = getDb(resolvedCwd);
        const cache = new PlanningCache(db);
        const sqlResult = cache.getSummaryCount(phaseNum, resolvedCwd);
        const incompleteSql = cache.getIncompletePlans(phaseNum, resolvedCwd);

        if (sqlResult !== null && incompleteSql !== null) {
          // Warm SQLite cache — use SQL results directly, skip parsePlans + listSummaryFiles
          const planRows = cache.getPlansForPhase(String(phaseNum), resolvedCwd);
          if (planRows && planRows.length > 0) {
            enrichment.plans = planRows.map(p => p.path ? p.path.split('/').pop() : null).filter(Boolean);
          }
          enrichment.incomplete_plans = incompleteSql;
          summaryFiles = sqlResult.summaryFiles;
          sqlUsedInPhaseArg = true;
        }
      } catch { /* fall through to parsePlans */ }

      if (!sqlUsedInPhaseArg) {
        // Cold cache / Map backend — use parsePlans (single call via ensurePlans)
        try {
          const p = ensurePlans(phaseNum);
          if (p && p.length > 0) {
            enrichment.plans = p.map(pl => pl.path ? pl.path.split('/').pop() : null).filter(Boolean);
            const phaseDirFull = join(resolvedCwd, phaseDir);
            const sf = ensureSummaryFiles(phaseDirFull);
            enrichment.incomplete_plans = enrichment.plans.filter(planFile => {
              const summaryFile = planFile.replace('-PLAN.md', '-SUMMARY.md');
              return !sf.includes(summaryFile);
            });
          }
        } catch { /* skip plan enumeration on failure */ }
      }
    }
  } else if (state && state.phase) {
    // No explicit phase arg — use current phase from STATE.md
    const currentPhaseMatch = state.phase.match(/^(\d+)/);
    if (currentPhaseMatch) {
      const curPhaseNum = parseInt(currentPhaseMatch[1], 10);
      effectivePhaseNum = curPhaseNum;
      enrichment.phase_number = String(curPhaseNum);

      if (currentPhase) {
        enrichment.phase_name = currentPhase.name;
      }

      // Use phaseDir from ProjectState facade (already resolved in getProjectState)
      // This avoids a redundant resolvePhaseDir call (which would readdirSync) for
      // the current phase. Fall back to resolvePhaseDir only if not available.
      const resolvedPhaseDir = statePhaseDir || resolvePhaseDir(curPhaseNum, resolvedCwd);
      if (resolvedPhaseDir) {
        enrichment.phase_dir = resolvedPhaseDir;
      }

      // Reuse plans from projectState (already parsed in getProjectState)
      // This avoids a redundant parsePlans call for the current phase.
      if (statePlans && statePlans.length > 0) {
        plans = statePlans;
      }
    }
  }

  // ─── Extended enrichment inputs for decision rules ─────────────────────────
  // Purely additive — each derivation wrapped in try/catch

  // Plan/summary counts (for progress-route, plan-existence-route rules)
  try {
    if (enrichment.phase_dir) {
      const phaseDirFull = join(resolvedCwd, enrichment.phase_dir);

      if (!enrichment.plans) {
        // Plan enumeration may not have run yet (else-if / current phase branch)
        // Try SQLite-first, then fall back to ensurePlans (at most one parsePlans call)
        let sqlUsed = false;
        try {
          const db = getDb(resolvedCwd);
          const cache = new PlanningCache(db);
          const sqlResult = cache.getSummaryCount(effectivePhaseNum, resolvedCwd);
          const incompleteSql = cache.getIncompletePlans(effectivePhaseNum, resolvedCwd);

          if (sqlResult !== null && incompleteSql !== null) {
            const planRows = cache.getPlansForPhase(String(effectivePhaseNum), resolvedCwd);
            if (planRows && planRows.length > 0) {
              enrichment.plans = planRows.map(p => p.path ? p.path.split('/').pop() : null).filter(Boolean);
            }
            enrichment.incomplete_plans = incompleteSql;
            summaryFiles = sqlResult.summaryFiles;
            sqlUsed = true;
          }
        } catch { /* fall through */ }

        if (!sqlUsed) {
          // Cold cache — use plans from projectState or parse once via ensurePlans
          const p = ensurePlans(effectivePhaseNum);
          if (p && p.length > 0) {
            enrichment.plans = p.map(pl => pl.path ? pl.path.split('/').pop() : null).filter(Boolean);
            const sf = ensureSummaryFiles(phaseDirFull);
            enrichment.incomplete_plans = enrichment.plans.filter(planFile => {
              const summaryFile = planFile.replace('-PLAN.md', '-SUMMARY.md');
              return !sf.includes(summaryFile);
            });
          }
        }
      }

      enrichment.plan_count = enrichment.plans ? enrichment.plans.length : 0;

      // Ensure summaryFiles are loaded (no-op if already populated above)
      const sf = ensureSummaryFiles(phaseDirFull);
      enrichment.summary_count = sf.length;

      // UAT gap count: scan for *-UAT.md with "status: diagnosed"
      enrichment.uat_gap_count = countDiagnosedUatGaps(phaseDirFull);
    }
  } catch { /* plan/summary count derivation failed */ }

  // File existence checks for plan-existence-route and state-assessment rules
  try {
    if (enrichment.phase_dir && effectivePhaseNum) {
      const paddedPhase = String(effectivePhaseNum).padStart(4, '0');
      enrichment.has_research = existsSync(join(resolvedCwd, enrichment.phase_dir, paddedPhase + '-RESEARCH.md'));
      enrichment.has_context = existsSync(join(resolvedCwd, enrichment.phase_dir, paddedPhase + '-CONTEXT.md'));
    }
  } catch { /* file existence check failed */ }

  // Task types for execution-pattern rule (from first incomplete plan)
  // Reuses already-loaded `plans` variable via ensurePlans — no additional
  // parsePlans call (ensurePlans is a no-op if plans already set).
  try {
    if (enrichment.incomplete_plans && enrichment.incomplete_plans.length > 0 && effectivePhaseNum) {
      const p = ensurePlans(effectivePhaseNum);
      if (p && p.length > 0) {
        const firstIncompleteName = enrichment.incomplete_plans[0];
        const incompletePlan = p.find(pl => pl.path && pl.path.endsWith(firstIncompleteName));
        if (incompletePlan && incompletePlan.tasks) {
          enrichment.task_types = incompletePlan.tasks.map(t => t.type).filter(Boolean);
        }
      }
    }
  } catch { /* task type extraction failed */ }

  // State-assessment file existence
  try {
    enrichment.state_exists = existsSync(join(resolvedCwd, '.planning/STATE.md'));
    enrichment.project_exists = existsSync(join(resolvedCwd, '.planning/PROJECT.md'));
    enrichment.roadmap_exists = existsSync(join(resolvedCwd, '.planning/ROADMAP.md'));
  } catch { /* state assessment failed */ }

  // Current and highest phase numbers
  try {
    if (effectivePhaseNum) {
      enrichment.current_phase = effectivePhaseNum;
    }
    if (roadmap && roadmap.phases && roadmap.phases.length > 0) {
      enrichment.highest_phase = Math.max(...roadmap.phases.map(p => parseFloat(p.number)).filter(n => !isNaN(n)));
    } else {
      enrichment.highest_phase = null;
    }
  } catch { enrichment.highest_phase = null; }

  // Previous summary checks (for previous-check-gate rule)
  // Reuses cached summaryFiles via ensureSummaryFiles — no additional
  // listSummaryFiles call (ensureSummaryFiles is a no-op if already loaded).
  try {
    if (enrichment.phase_dir) {
      const phaseDirFull = join(resolvedCwd, enrichment.phase_dir);
      const sf = ensureSummaryFiles(phaseDirFull);
      enrichment.has_previous_summary = sf.length > 0;
      if (sf.length > 0) {
        const lastSummary = [...sf].sort().pop();
        const content = readFileSync(join(phaseDirFull, lastSummary), 'utf-8');
        enrichment.has_unresolved_issues = content.includes('unresolved') || content.includes('Unresolved');
        enrichment.has_blockers = content.includes('blocker') || content.includes('Blocker');
      } else {
        enrichment.has_unresolved_issues = false;
        enrichment.has_blockers = false;
      }
    }
  } catch { /* previous summary check failed */ }

  // CI gate inputs
  try {
    enrichment.ci_enabled = config ? Boolean(config.ci) : false;
    enrichment.has_test_command = Boolean(config && config.test_command);
  } catch { /* CI config check failed */ }

  // ─── Phase 122: Inputs for new/expanded decision rules ────────────────────
  // model-selection (DEC-01): agent_type derived from command name
  try {
    const COMMAND_TO_AGENT = {
      'bgsd-execute-phase':    'bgsd-executor',
      'bgsd-execute-plan':     'bgsd-executor',
      'bgsd-quick':            'bgsd-executor',
      'bgsd-quick-task':       'bgsd-executor',
      'bgsd-plan-phase':       'bgsd-planner',
      'bgsd-discuss-phase':    'bgsd-planner',
      'bgsd-research-phase':   'bgsd-phase-researcher',
      'bgsd-verify-work':      'bgsd-verifier',
      'bgsd-audit-milestone':  'bgsd-verifier',
      'bgsd-github-ci':        'bgsd-verifier',
      'bgsd-map-codebase':     'bgsd-codebase-mapper',
      'bgsd-debug':            'bgsd-debugger',
    };
    const agentType = COMMAND_TO_AGENT[command] || null;
    if (agentType) {
      enrichment.agent_type = agentType;
    }
    enrichment.model_profile = config ? (config.model_profile || 'balanced') : 'balanced';
    // db handle passed to model-selection rule for SQLite-backed lookup
    try {
      enrichment.db = getDb(resolvedCwd);
    } catch { /* db unavailable — rule falls back to static */ }
  } catch { /* model-selection inputs failed */ }

  // verification-routing (DEC-02): files_modified_count from first incomplete plan frontmatter
  try {
    if (enrichment.incomplete_plans && enrichment.incomplete_plans.length > 0 && effectivePhaseNum) {
      const p = ensurePlans(effectivePhaseNum);
      if (p && p.length > 0) {
        const firstIncompleteName = enrichment.incomplete_plans[0];
        const incompletePlan = p.find(pl => pl.path && pl.path.endsWith(firstIncompleteName));
        if (incompletePlan && incompletePlan.frontmatter) {
          const filesModified = incompletePlan.frontmatter.files_modified;
          if (Array.isArray(filesModified)) {
            enrichment.files_modified_count = filesModified.length;
          }
        }
        // task_count from first incomplete plan task count
        if (incompletePlan && incompletePlan.tasks) {
          enrichment.task_count = incompletePlan.tasks.length;
        }
      }
    }
    // verifier_enabled already set above from config
  } catch { /* verification-routing inputs failed */ }

  // research-gate (DEC-03): phase_has_external_deps heuristic
  try {
    if (enrichment.phase_goal) {
      const goal = enrichment.phase_goal.toLowerCase();
      enrichment.phase_has_external_deps = /api|external|integration|webhook|oauth|stripe|github/.test(goal);
    } else {
      enrichment.phase_has_external_deps = false;
    }
    // research_enabled already set above from config
  } catch { /* research-gate inputs failed */ }

  // plan-existence-route expansion (DEC-04): deps_complete
  try {
    if (enrichment.incomplete_plans && enrichment.incomplete_plans.length > 0 && effectivePhaseNum) {
      const p = ensurePlans(effectivePhaseNum);
      if (p && p.length > 0) {
        const firstIncompleteName = enrichment.incomplete_plans[0];
        const incompletePlan = p.find(pl => pl.path && pl.path.endsWith(firstIncompleteName));
        if (incompletePlan && incompletePlan.frontmatter && incompletePlan.frontmatter.depends_on) {
          const deps = incompletePlan.frontmatter.depends_on;
          if (Array.isArray(deps) && deps.length > 0 && roadmap) {
            // Check if all depends_on phases are complete (have summaries)
            let allComplete = true;
            for (const dep of deps) {
              const depNum = parseFloat(String(dep).replace(/[^0-9.]/g, ''));
              if (!isNaN(depNum)) {
                const depPhase = roadmap.getPhase ? roadmap.getPhase(depNum) : null;
                if (depPhase && depPhase.status !== 'complete') {
                  allComplete = false;
                  break;
                }
              }
            }
            enrichment.deps_complete = allComplete;
          } else {
            enrichment.deps_complete = true; // no deps → complete
          }
        } else {
          enrichment.deps_complete = true; // no depends_on field
        }
      }
    }
  } catch { /* deps_complete check failed */ }

  // milestone-completion (DEC-05): phases_total, phases_complete
  try {
    if (roadmap && roadmap.phases && roadmap.phases.length > 0) {
      enrichment.phases_total = roadmap.phases.length;
      enrichment.phases_complete = roadmap.phases.filter(p => p.status === 'complete').length;
      // milestone_name already set above
    }
  } catch { /* milestone-completion inputs failed */ }

  // commit-strategy (DEC-06): plan_type, is_tdd, task_count
  try {
    if (enrichment.incomplete_plans && enrichment.incomplete_plans.length > 0 && effectivePhaseNum) {
      const p = ensurePlans(effectivePhaseNum);
      if (p && p.length > 0) {
        const firstIncompleteName = enrichment.incomplete_plans[0];
        const incompletePlan = p.find(pl => pl.path && pl.path.endsWith(firstIncompleteName));
        if (incompletePlan && incompletePlan.frontmatter) {
          const planType = incompletePlan.frontmatter.type || 'execute';
          enrichment.plan_type = planType;
          enrichment.is_tdd = planType === 'tdd';
        }
      }
    }
  } catch { /* commit-strategy inputs failed */ }

  // In-process decision evaluation (ENGINE-02: no subprocess overhead)
  try {
    const decisions = evaluateDecisions(command, enrichment);
    if (decisions && Object.keys(decisions).length > 0) {
      enrichment.decisions = decisions;
    }
  } catch { /* decision evaluation failure is non-fatal */ }

  // ENR-03: Record elapsed enrichment time (underscore prefix = internal/debug field)
  const _elapsed = (typeof performance !== 'undefined' && performance.now)
    ? performance.now() - _t0
    : Date.now() - _t0;
  enrichment._enrichment_ms = parseFloat(_elapsed.toFixed(3));

  // Debug logging when BGSD_DEBUG is set or NODE_ENV === 'development'
  if (process.env.BGSD_DEBUG || process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.error(`[bgsd-enricher] ${command} enriched in ${_elapsed.toFixed(1)}ms`);
  }

  // Prepend enrichment as <bgsd-context> XML block
  if (output.parts) {
    output.parts.unshift({
      type: 'text',
      text: `<bgsd-context>\n${JSON.stringify(enrichment, null, 2)}\n</bgsd-context>`,
    });
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
 * Count UAT files with "status: diagnosed" in a phase directory.
 * Delegates directory read to avoid direct readdirSync in enrichCommand body.
 *
 * @param {string} phaseDir - Full path to phase directory
 * @returns {number} Count of diagnosed UAT gaps
 */
function countDiagnosedUatGaps(phaseDir) {
  try {
    if (!existsSync(phaseDir)) return 0;
    const allFiles = readdirSync(phaseDir);
    const uatFiles = allFiles.filter(f => f.endsWith('-UAT.md'));
    let count = 0;
    for (const uf of uatFiles) {
      try {
        const content = readFileSync(join(phaseDir, uf), 'utf-8');
        if (content.includes('status: diagnosed')) count++;
      } catch { /* skip unreadable UAT files */ }
    }
    return count;
  } catch { return 0; }
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
