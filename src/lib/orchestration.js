'use strict';

const fs = require('fs');
const path = require('path');
const { debugLog, output, error } = require('./output');
const { extractFrontmatter } = require('./frontmatter');
const { banner, sectionHeader, formatTable, summaryLine, color, SYMBOLS } = require('./format');
const { buildCanonicalModelSettings, resolveModelSelectionFromConfig } = require('./helpers');

// ─── Task XML Parser ─────────────────────────────────────────────────────────

/**
 * Parse task XML blocks from plan content.
 * Matches <task type="...">...</task> blocks and extracts child elements.
 *
 * @param {string} content - Full plan markdown content
 * @returns {Array<{name: string, type: string, files: string[], action: string, verify: string, done: string}>}
 */
function parseTasksFromPlan(content) {
  if (!content || typeof content !== 'string') return [];

  const tasks = [];
  // Match <task ...> through </task> — non-greedy, handles multiline
  const taskBlockRe = /<task\s+type="([^"]*)"[^>]*>([\s\S]*?)<\/task>/g;
  let match;

  while ((match = taskBlockRe.exec(content)) !== null) {
    const type = match[1] || 'auto';
    const body = match[2];

    const task = {
      name: extractElement(body, 'name') || 'Unnamed Task',
      type,
      files: parseFilesList(extractElement(body, 'files')),
      action: extractElement(body, 'action') || '',
      verify: extractElement(body, 'verify') || '',
      done: extractElement(body, 'done') || '',
    };

    tasks.push(task);
  }

  return tasks;
}

/**
 * Extract content from an XML element: <name>content</name>
 * Handles multi-line content and trims whitespace.
 */
function extractElement(body, tagName) {
  const re = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const m = body.match(re);
  return m ? m[1].trim() : null;
}

/**
 * Parse a comma-separated files string into an array.
 */
function parseFilesList(filesStr) {
  if (!filesStr) return [];
  return filesStr.split(',').map(f => f.trim()).filter(Boolean);
}

// ─── Complexity Classifier ───────────────────────────────────────────────────

const COMPLEXITY_LABELS = {
  1: 'trivial',
  2: 'simple',
  3: 'moderate',
  4: 'complex',
  5: 'very_complex',
};

const PROFILE_MAP = {
  1: 'budget',
  2: 'budget',
  3: 'balanced',
  4: 'quality',
  5: 'quality',
};

const PROFILE_PRIORITY = {
  budget: 0,
  balanced: 1,
  quality: 2,
};

const TELEMETRY_LOG_PATH = '.planning/telemetry/routing-log.jsonl';

function hashStableValue(value) {
  const str = JSON.stringify(value || {});
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return String(Math.abs(hash));
}

function hashTaskInputs(task) {
  return hashStableValue({
    name: task?.name,
    type: task?.type,
    files: task?.files,
    action: task?.action,
  });
}

function hashComplexityInputs(complexity) {
  return hashStableValue({
    score: complexity?.score,
    label: complexity?.label,
    profile: complexity?.recommended_profile,
  });
}

/**
 * Append coarse routing telemetry without blocking execution.
 */
function telemetryLog(functionName, inputsHash, outputValue) {
  try {
    const logDir = path.dirname(TELEMETRY_LOG_PATH);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const entry = {
      function: functionName,
      key: inputsHash,
      profile: outputValue?.profile || null,
      model: outputValue?.model || null,
      agent: outputValue?.agent || null,
      timestamp: new Date().toISOString(),
    };
    fs.appendFileSync(TELEMETRY_LOG_PATH, JSON.stringify(entry) + '\n');
  } catch {
    // Non-fatal telemetry only.
  }
}

/**
 * Score a single task 1-5 based on multiple complexity factors.
 *
 * @param {object} task - Parsed task: { name, type, files, action, verify, done }
 * @param {object} context - { cwd: string, depGraph?: { reverse: object } }
 * @returns {{ score: number, label: string, factors: string[], recommended_profile: string, recommended_agent: string }}
 */
function classifyTaskComplexity(task, context) {
  try {
    let score = 1;
    const factors = [];
    const files = task.files || [];
    const action = task.action || '';
    const verify = task.verify || '';
    const type = task.type || 'auto';

    // File count
    if (files.length >= 6) {
      score += 2;
      factors.push(`${files.length} files (high)`);
    } else if (files.length >= 3) {
      score += 1;
      factors.push(`${files.length} files`);
    }

    // Cross-module reach (blast radius)
    if (context && context.depGraph && context.depGraph.reverse) {
      let totalImporters = 0;
      for (const file of files) {
        // Check reverse graph for importers of this file
        // Try both the raw filename and resolved paths
        for (const [key, importers] of Object.entries(context.depGraph.reverse)) {
          if (key === file || key.endsWith('/' + file) || file.endsWith('/' + key)) {
            totalImporters += importers.length;
          }
        }
      }
      if (totalImporters >= 6) {
        score += 2;
        factors.push(`high blast radius (${totalImporters} importers)`);
      } else if (totalImporters >= 3) {
        score += 1;
        factors.push(`moderate blast radius (${totalImporters} importers)`);
      }
    }

    // Test requirements
    const testKeywords = /\btest\b|npm\s+test|pytest|jest|mocha|vitest|go\s+test|mix\s+test/i;
    if (testKeywords.test(action) || testKeywords.test(verify)) {
      score += 1;
      factors.push('has tests');
    }

    // Checkpoint complexity
    if (type === 'checkpoint:decision' || type === 'checkpoint:human-verify') {
      score += 1;
      factors.push(`checkpoint (${type})`);
    }

    // Action length proxy
    if (action.length > 800) {
      score += 1;
      factors.push('complex action (>800 chars)');
    }

    // Clamp to 1-5
    score = Math.max(1, Math.min(5, score));

    const result = {
      score,
      label: COMPLEXITY_LABELS[score],
      factors,
      recommended_profile: PROFILE_MAP[score],
      recommended_agent: 'bgsd-executor',
    };
    telemetryLog('classifyTaskComplexity', hashTaskInputs(task), result);
    return result;
  } catch (e) {
    debugLog('orchestration.classifyTask', 'classification failed', e);
    const result = {
      score: 3,
      label: 'moderate',
      factors: ['classification error — defaulting'],
      recommended_profile: 'balanced',
      recommended_agent: 'bgsd-executor',
    };
    telemetryLog('classifyTaskComplexity', hashTaskInputs(task), result);
    return result;
  }
}

// ─── Plan Classifier ─────────────────────────────────────────────────────────

/**
 * Classify all tasks in a plan file.
 *
 * @param {string} planPath - Absolute or relative path to plan file
 * @param {string} cwd - Project root directory
 * @returns {object|null} Classification result or null on error
 */
function classifyPlan(planPath, cwd) {
  try {
    const absPath = path.isAbsolute(planPath) ? planPath : path.resolve(cwd, planPath);
    const content = fs.readFileSync(absPath, 'utf-8');
    const frontmatter = extractFrontmatter(content);

    // Parse task blocks
    const tasks = parseTasksFromPlan(content);

    // Try to load dependency graph (non-blocking)
    let depGraph = null;
    try {
      const { readIntel } = require('./codebase-intel');
      const { buildDependencyGraph } = require('./deps');
      const intel = readIntel(cwd);
      if (intel) {
        depGraph = buildDependencyGraph(intel);
      }
    } catch (e) {
      debugLog('orchestration.classifyPlan', 'dep graph unavailable (non-blocking)', e);
    }

    const context = { cwd, depGraph };

    // Classify each task
    const classifiedTasks = tasks.map(task => ({
      name: task.name,
      type: task.type,
      files: task.files,
      complexity: classifyTaskComplexity(task, context),
    }));

    const planComplexity = classifiedTasks.length > 0
      ? Math.max(...classifiedTasks.map(t => t.complexity.score))
      : 1;

    const highestProfile = classifiedTasks.reduce((best, t) => {
      const current = PROFILE_PRIORITY[t.complexity.recommended_profile] || 0;
      const bestPriority = PROFILE_PRIORITY[best] || 0;
      return current > bestPriority ? t.complexity.recommended_profile : best;
    }, 'budget');

    return {
      plan: path.basename(absPath),
      wave: parseInt(frontmatter.wave, 10) || 1,
      autonomous: frontmatter.autonomous === 'true' || frontmatter.autonomous === true,
      task_count: classifiedTasks.length,
      tasks: classifiedTasks,
      plan_complexity: planComplexity,
      recommended_profile: highestProfile,
    };
  } catch (e) {
    debugLog('orchestration.classifyPlan', 'plan classification failed', e);
    return null;
  }
}

// ─── Execution Mode Selector ─────────────────────────────────────────────────

/**
 * Determine optimal execution strategy from classified plans.
 *
 * @param {Array} planClassifications - Array of classifyPlan results
 * @returns {{ mode: string, reason: string, waves: object, total_plans: number, total_waves: number, has_checkpoints: boolean }}
 */
function selectExecutionMode(planClassifications) {
  try {
    if (!planClassifications || planClassifications.length === 0) {
      return {
        mode: 'single',
        reason: 'no plans to execute',
        waves: {},
        total_plans: 0,
        total_waves: 0,
        has_checkpoints: false,
      };
    }

    const totalPlans = planClassifications.length;

    // Build wave map
    const waves = {};
    for (const plan of planClassifications) {
      const wave = plan.wave || 1;
      if (!waves[wave]) waves[wave] = [];
      waves[wave].push(plan.plan);
    }
    const totalWaves = Object.keys(waves).length;

    // Check for checkpoints in any task
    const hasCheckpoints = planClassifications.some(plan =>
      plan.tasks && plan.tasks.some(t =>
        t.type && t.type.startsWith('checkpoint:')
      )
    );

    // Decision logic
    if (hasCheckpoints) {
      return {
        mode: 'sequential',
        reason: 'plan has checkpoint tasks requiring human interaction',
        waves,
        total_plans: totalPlans,
        total_waves: totalWaves,
        has_checkpoints: true,
      };
    }

    if (totalPlans === 1) {
      const taskCount = planClassifications[0].task_count || 0;
      if (taskCount <= 2) {
        return {
          mode: 'single',
          reason: `1 plan with ${taskCount} task${taskCount !== 1 ? 's' : ''}`,
          waves,
          total_plans: 1,
          total_waves: totalWaves,
          has_checkpoints: false,
        };
      }
    }

    // Multiple plans in same wave — check for file overlaps
    for (const [wave, plans] of Object.entries(waves)) {
      if (plans.length > 1) {
        return {
          mode: 'parallel',
          reason: `${plans.length} independent plans in wave ${wave}`,
          waves,
          total_plans: totalPlans,
          total_waves: totalWaves,
          has_checkpoints: false,
        };
      }
    }

    if (totalWaves >= 3) {
      return {
        mode: 'pipeline',
        reason: `${totalWaves} waves requiring sequential execution`,
        waves,
        total_plans: totalPlans,
        total_waves: totalWaves,
        has_checkpoints: false,
      };
    }

    // Default: sequential for multi-plan, single-wave
    return {
      mode: 'sequential',
      reason: `${totalPlans} plans across ${totalWaves} wave${totalWaves !== 1 ? 's' : ''}`,
      waves,
      total_plans: totalPlans,
      total_waves: totalWaves,
      has_checkpoints: false,
    };
  } catch (e) {
    debugLog('orchestration.selectMode', 'mode selection failed', e);
    return {
      mode: 'sequential',
      reason: 'mode selection error — defaulting to sequential',
      waves: {},
      total_plans: 0,
      total_waves: 0,
      has_checkpoints: false,
    };
  }
}

// ─── Task Router ─────────────────────────────────────────────────────────────

/**
 * Map complexity score to a shared profile, then resolve the concrete model canonically.
 *
 * @param {object} complexity - { score, label, recommended_profile, ... }
 * @param {object} [config] - configuration object
 * @returns {{ profile: string, model: string, agent: string, reason: string }}
 */
function routeTask(complexity, config, cwd) {
  try {
    const score = complexity?.score || 3;
    const recommendedProfile = complexity?.recommended_profile || PROFILE_MAP[score] || 'balanced';
    const canonicalModelSettings = buildCanonicalModelSettings(config || {});
    const routedConfig = {
      ...(config || {}),
      model_settings: {
        ...canonicalModelSettings,
        default_profile: recommendedProfile,
      },
    };
    const resolved = resolveModelSelectionFromConfig(routedConfig, 'bgsd-executor');

    const result = {
      profile: recommendedProfile,
      model: resolved.model,
      agent: 'bgsd-executor',
      reason: `score ${score} (${complexity.label}) recommends ${recommendedProfile} and resolves canonically`,
    };
    telemetryLog('routeTask', hashComplexityInputs(complexity), result);
    return result;
  } catch (e) {
    debugLog('orchestration.routeTask', 'routing failed', e);
    const resolved = resolveModelSelectionFromConfig({}, 'bgsd-executor');
    const result = {
      profile: 'balanced',
      model: resolved.model,
      agent: 'bgsd-executor',
      reason: 'routing error — defaulting to balanced canonical profile',
    };
    telemetryLog('routeTask', hashComplexityInputs(complexity), result);
    return result;
  }
}

// ─── CLI Command Handlers ────────────────────────────────────────────────────

/**
 * CLI: classify plan <plan-path>
 * Classifies all tasks in a single plan and outputs results.
 */
function cmdClassifyPlan(cwd, args, raw) {
  const planPath = args[0];
  if (!planPath) {
    error('Usage: classify plan <plan-path>');
  }

  const classification = classifyPlan(planPath, cwd);
  if (!classification) {
    error('Failed to classify plan: ' + planPath);
  }

  output(classification, {
    formatter: (result) => {
      const lines = [];
      lines.push(banner('Classify Plan'));
      lines.push('');
      lines.push(sectionHeader(`Plan: ${result.plan}`));
      lines.push(` Wave: ${result.wave}  |  Autonomous: ${result.autonomous}  |  Plan Complexity: ${result.plan_complexity}/5`);
      lines.push(` Recommended Profile: ${color.bold(result.recommended_profile)}`);
      lines.push('');

      // Tasks table
      const headers = ['Task', 'Score', 'Label', 'Profile', 'Factors'];
      const rows = result.tasks.map(t => [
        t.name,
        String(t.complexity.score),
        t.complexity.label,
        t.complexity.recommended_profile,
        t.complexity.factors.join(', ') || 'minimal',
      ]);
      lines.push(formatTable(headers, rows, { showAll: true }));
      lines.push('');
      lines.push(summaryLine(`${result.task_count} tasks classified, plan complexity ${result.plan_complexity}/5`));

      return lines.join('\n');
    },
  });
}

/**
 * CLI: classify phase <phase-number>
 * Classifies all incomplete plans in a phase and shows execution mode.
 */
function cmdClassifyPhase(cwd, args, raw) {
  const phaseNum = args[0];
  if (!phaseNum) {
    error('Usage: classify phase <phase-number>');
  }

  const { findPhaseInternal } = require('./helpers');
  const phaseInfo = findPhaseInternal(cwd, phaseNum);
  if (!phaseInfo) {
    error('Phase not found: ' + phaseNum);
  }

  // Classify all incomplete plans (or all plans if none incomplete)
  const planFiles = phaseInfo.incomplete_plans.length > 0
    ? phaseInfo.incomplete_plans
    : phaseInfo.plans;

  const classifications = [];
  for (const planFile of planFiles) {
    const planPath = path.join(cwd, phaseInfo.directory, planFile);
    const classification = classifyPlan(planPath, cwd);
    if (classification) classifications.push(classification);
  }

  const executionMode = selectExecutionMode(classifications);

  const result = {
    phase: phaseNum,
    phase_name: phaseInfo.phase_name,
    plans_classified: classifications.length,
    plans: classifications,
    execution_mode: executionMode,
  };

  output(result, {
    formatter: (res) => {
      const lines = [];
      lines.push(banner(`Classify Phase ${res.phase}`));
      lines.push('');

      if (res.phase_name) {
        lines.push(` Phase: ${color.bold(res.phase_name)}`);
      }
      lines.push(` Plans classified: ${res.plans_classified}`);
      lines.push('');

      // Per-plan tables
      for (const plan of res.plans) {
        lines.push(sectionHeader(plan.plan));
        lines.push(` Complexity: ${plan.plan_complexity}/5  |  Profile: ${color.bold(plan.recommended_profile)}  |  Tasks: ${plan.task_count}`);

        const headers = ['Task', 'Score', 'Label', 'Factors'];
        const rows = plan.tasks.map(t => [
          t.name,
          String(t.complexity.score),
          t.complexity.label,
          t.complexity.factors.join(', ') || 'minimal',
        ]);
        lines.push(formatTable(headers, rows, { showAll: true }));
        lines.push('');
      }

      // Execution mode summary
      lines.push(sectionHeader('Execution Mode'));
      lines.push(` Mode: ${color.bold(res.execution_mode.mode)}`);
      lines.push(` Reason: ${res.execution_mode.reason}`);
      lines.push(` Waves: ${res.execution_mode.total_waves}  |  Plans: ${res.execution_mode.total_plans}  |  Checkpoints: ${res.execution_mode.has_checkpoints ? 'yes' : 'no'}`);
      lines.push('');
      lines.push(summaryLine(`${res.plans_classified} plans → ${res.execution_mode.mode} execution`));

      return lines.join('\n');
    },
  });
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  classifyTaskComplexity,
  classifyPlan,
  selectExecutionMode,
  parseTasksFromPlan,
  routeTask,
  cmdClassifyPlan,
  cmdClassifyPhase,
};
