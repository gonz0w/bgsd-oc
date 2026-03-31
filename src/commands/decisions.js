'use strict';

const fs = require('fs');
const path = require('path');
const { DECISION_REGISTRY, evaluateDecisions } = require('../lib/decision-rules');
const { output } = require('../lib/output');
const { banner, sectionHeader, formatTable, summaryLine, actionHint, color, SYMBOLS } = require('../lib/format');
const { resolvePluginDirs } = require('../lib/plugin-paths');

// ─── TTY Formatters ──────────────────────────────────────────────────────────

/**
 * Format decisions:list output for TTY display.
 * Groups rules by category with section headers, summary line.
 *
 * @param {object} data - { rules, summary }
 * @returns {string}
 */
function formatDecisionsList(data) {
  const lines = [];

  lines.push(banner('DECISION RULES'));
  lines.push('');

  // Group by category
  const byCategory = {};
  for (const rule of data.rules) {
    const cat = rule.category;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(rule);
  }

  const categories = Object.keys(byCategory).sort();
  for (const cat of categories) {
    lines.push(sectionHeader(cat));
    const headers = ['Rule ID', 'Confidence', 'Description'];
    const rows = byCategory[cat].map(r => [
      r.id,
      r.confidence_range.join('/'),
      r.description.length > 60 ? r.description.substring(0, 57) + '...' : r.description,
    ]);
    lines.push(formatTable(headers, rows, { showAll: true }));
    lines.push('');
  }

  lines.push(summaryLine(`${data.summary.total_rules} rules across ${data.summary.categories} categories`));
  lines.push(actionHint('Run decisions:inspect <rule_id> for full details'));

  return lines.join('\n');
}

/**
 * Format decisions:inspect output for TTY display.
 *
 * @param {object} data - Single rule registry entry (without resolve function)
 * @returns {string}
 */
function formatDecisionsInspect(data) {
  const lines = [];

  lines.push(banner(`RULE: ${data.id}`));
  lines.push('');
  lines.push(` ${color.bold('Name:')}           ${data.name}`);
  lines.push(` ${color.bold('Category:')}       ${data.category}`);
  lines.push(` ${color.bold('Description:')}    ${data.description}`);
  lines.push(` ${color.bold('Confidence:')}     ${data.confidence_range.join(', ')}`);
  lines.push('');
  lines.push(sectionHeader('Inputs'));
  for (const input of data.inputs) {
    lines.push(`  ${SYMBOLS.bullet} ${input}`);
  }
  lines.push('');
  lines.push(sectionHeader('Outputs'));
  for (const out of data.outputs) {
    lines.push(`  ${SYMBOLS.bullet} ${out}`);
  }
  lines.push('');
  lines.push(actionHint(`Run decisions:evaluate ${data.id} --state '{...}' to test`));

  return lines.join('\n');
}

/**
 * Format decisions:evaluate output for TTY display.
 *
 * @param {object} data - { value, confidence, rule_id, metadata? }
 * @returns {string}
 */
function formatDecisionsEvaluate(data) {
  const lines = [];

  lines.push(banner('DECISION RESULT'));
  lines.push('');
  lines.push(` ${color.bold('Rule:')}        ${data.rule_id}`);

  const confColor = data.confidence === 'HIGH' ? color.green : data.confidence === 'MEDIUM' ? color.yellow : color.red;
  lines.push(` ${color.bold('Confidence:')} ${confColor(data.confidence)}`);
  lines.push(` ${color.bold('Value:')}      ${color.cyan(JSON.stringify(data.value))}`);

  if (data.metadata) {
    lines.push('');
    lines.push(sectionHeader('Metadata'));
    lines.push(`  ${JSON.stringify(data.metadata, null, 2)}`);
  }

  return lines.join('\n');
}


/**
 * Format decisions:savings output for TTY display.
 *
 * @param {object} data - { workflows, totals, note }
 * @returns {string}
 */
function formatDecisionsSavings(data) {
  const lines = [];

  lines.push(banner('DECISION SAVINGS'));
  lines.push('');

  const headers = ['Workflow', 'Before', 'After', 'Saved', 'Decisions Used'];
  const rows = data.workflows.map(w => [
    w.workflow,
    String(w.before),
    String(w.after),
    String(w.saved),
    w.decisions.join(', '),
  ]);
  lines.push(formatTable(headers, rows, { showAll: true }));
  lines.push('');

  const t = data.totals;
  const pctColor = t.percent_reduction >= 70 ? color.green : t.percent_reduction >= 40 ? color.yellow : color.red;
  lines.push(summaryLine(`Total: ${t.before} ${SYMBOLS.arrow || '→'} ${t.after} LLM reasoning steps (${t.saved} saved, ${pctColor(t.percent_reduction + '%')} reduction)`));
  lines.push('');
  lines.push(actionHint(data.note));

  return lines.join('\n');
}


// ─── Workflow Scanning ───────────────────────────────────────────────────────

/**
 * Resolve the workflows directory.
 * Priority: override → resolved plugin workflows directory
 *
 * @param {string} [overrideDir] - Optional explicit workflows directory
 * @returns {string} Path to workflows directory
 */
function resolveWorkflowsDir(overrideDir) {
  if (overrideDir && fs.existsSync(overrideDir)) return overrideDir;
  const { workflowsDir } = resolvePluginDirs();
  return workflowsDir;
}

/**
 * Scan workflow files for Pre-computed decision and value blocks.
 * Returns per-workflow integration point data.
 *
 * @param {string} workflowsDir - Path to workflows directory
 * @returns {{ workflow: string, integration_points: number, decisions: string[], model_precompute: string[], type: string }[]}
 */
function scanWorkflowDecisions(workflowsDir) {
  if (!fs.existsSync(workflowsDir)) return [];

  const files = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.md')).sort();
  const results = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(workflowsDir, file), 'utf-8');

    // Count Pre-computed decision blocks and extract decision names
    const decisionBlocks = content.match(/Pre-computed decision[^:]*:/g) || [];
    const decisionNames = [];
    const decisionMatches = content.matchAll(/decisions\.([a-z][a-z0-9-]*)/g);
    for (const m of decisionMatches) {
      if (!decisionNames.includes(m[1])) decisionNames.push(m[1]);
    }

    // Count Pre-computed value blocks and extract model names
    const valueBlocks = content.match(/Pre-computed value:/g) || [];
    const modelNames = [];
    const modelMatches = content.matchAll(/(executor_model|verifier_model|checker_model)/g);
    // Only count model matches inside Pre-computed value blocks
    if (valueBlocks.length > 0) {
      for (const m of modelMatches) {
        if (!modelNames.includes(m[1])) modelNames.push(m[1]);
      }
    }

    const integrationPoints = decisionBlocks.length + valueBlocks.length;
    if (integrationPoints > 0) {
      results.push({
        workflow: file,
        integration_points: integrationPoints,
        decisions: decisionNames,
        model_precompute: modelNames,
        type: 'measured',
      });
    }
  }

  return results;
}

/**
 * Static reference table of BEFORE LLM reasoning step counts per workflow.
 * These represent the reasoning steps that existed BEFORE the decision engine.
 * They can't be measured dynamically — they are the baseline for comparison.
 */
const BEFORE_ESTIMATES = {
  'progress.md': 7,
  'execute-plan.md': 5,
  'execute-phase.md': 4,
  'resume-project.md': 5,
  'discuss-phase.md': 2,
  'plan-phase.md': 2,
  'transition.md': 3,
  'debug.md': 3,
  'audit-milestone.md': 2,
};

// ─── Command Handlers ────────────────────────────────────────────────────────

/**
 * cmdDecisionsList — List all registered decision rules.
 *
 * @param {string} cwd - Project root
 * @param {string[]} args - CLI arguments
 * @param {boolean} raw - Raw JSON output mode
 */
function cmdDecisionsList(cwd, args, raw) {
  const rules = DECISION_REGISTRY.map(r => ({
    id: r.id,
    name: r.name,
    category: r.category,
    description: r.description,
    inputs: r.inputs,
    outputs: r.outputs,
    confidence_range: r.confidence_range,
  }));

  const categories = [...new Set(rules.map(r => r.category))];

  const result = {
    rules,
    summary: {
      total_rules: rules.length,
      categories: categories.length,
      category_list: categories.sort(),
    },
  };

  output(result, { formatter: formatDecisionsList });
}

/**
 * cmdDecisionsInspect — Show full details of a specific rule.
 *
 * @param {string} cwd - Project root
 * @param {string[]} args - CLI arguments [rule_id, ...]
 * @param {boolean} raw - Raw JSON output mode
 */
function cmdDecisionsInspect(cwd, args, raw) {
  const ruleId = args[0];

  if (!ruleId) {
    const available = DECISION_REGISTRY.map(r => r.id).join(', ');
    const { error: errFn } = require('../lib/output');
    errFn(`Missing rule_id argument.\nAvailable rules: ${available}`);
    return;
  }

  const rule = DECISION_REGISTRY.find(r => r.id === ruleId);

  if (!rule) {
    const available = DECISION_REGISTRY.map(r => r.id).join(', ');
    const { error: errFn } = require('../lib/output');
    errFn(`Rule not found: "${ruleId}"\nAvailable rules: ${available}`);
    return;
  }

  const result = {
    id: rule.id,
    name: rule.name,
    category: rule.category,
    description: rule.description,
    inputs: rule.inputs,
    outputs: rule.outputs,
    confidence_range: rule.confidence_range,
  };

  output(result, { formatter: formatDecisionsInspect });
}

/**
 * cmdDecisionsEvaluate — Run a rule against given state.
 *
 * @param {string} cwd - Project root
 * @param {string[]} args - CLI arguments [rule_id, --state '{json}']
 * @param {boolean} raw - Raw JSON output mode
 */
function cmdDecisionsEvaluate(cwd, args, raw) {
  const ruleId = args[0];
  const { error: errFn } = require('../lib/output');

  if (!ruleId) {
    const available = DECISION_REGISTRY.map(r => r.id).join(', ');
    errFn(`Missing rule_id argument.\nAvailable rules: ${available}`);
    return;
  }

  const rule = DECISION_REGISTRY.find(r => r.id === ruleId);

  if (!rule) {
    const available = DECISION_REGISTRY.map(r => r.id).join(', ');
    errFn(`Rule not found: "${ruleId}"\nAvailable rules: ${available}`);
    return;
  }

  // Parse --state flag
  let state = {};
  const stateIdx = args.indexOf('--state');
  if (stateIdx !== -1 && args[stateIdx + 1]) {
    try {
      state = JSON.parse(args[stateIdx + 1]);
    } catch (e) {
      errFn(`Failed to parse --state JSON: ${e.message}`);
      return;
    }
  }

  // Run the rule
  let result;
  try {
    result = rule.resolve(state);
  } catch (e) {
    errFn(`Rule evaluation failed: ${e.message}`);
    return;
  }

  output(result, { formatter: formatDecisionsEvaluate });
}


/**
 * cmdDecisionsSavings — Report before/after LLM reasoning step counts per workflow.
 * Dynamically scans workflow files for Pre-computed decision/value blocks.
 *
 * @param {string} cwd - Project root
 * @param {string[]} args - CLI arguments [--workflows-dir <path>]
 * @param {boolean} raw - Raw JSON output mode
 */
function cmdDecisionsSavings(cwd, args, raw) {
  // Parse optional --workflows-dir flag
  let overrideDir;
  const dirIdx = args.indexOf('--workflows-dir');
  if (dirIdx !== -1 && args[dirIdx + 1]) {
    overrideDir = args[dirIdx + 1];
  }

  const workflowsDir = resolveWorkflowsDir(overrideDir);
  const scanned = scanWorkflowDecisions(workflowsDir);

  // Build workflow savings: each integration point saves 1 LLM reasoning step
  const workflows = scanned.map(w => {
    const before = BEFORE_ESTIMATES[w.workflow] || w.integration_points;
    const after = Math.max(0, before - w.integration_points);
    return {
      workflow: w.workflow,
      before,
      after,
      saved: before - after,
      decisions: [...w.decisions, ...w.model_precompute],
      integration_points: w.integration_points,
    };
  });

  const totalBefore = workflows.reduce((sum, w) => sum + w.before, 0);
  const totalAfter = workflows.reduce((sum, w) => sum + w.after, 0);
  const totalSaved = totalBefore - totalAfter;
  const percentReduction = totalBefore > 0 ? Math.round((totalSaved / totalBefore) * 100) : 0;

  const result = {
    source: 'scanned',
    workflows_dir: workflowsDir,
    workflows,
    totals: {
      before: totalBefore,
      after: totalAfter,
      saved: totalSaved,
      percent_reduction: percentReduction,
      workflows_scanned: scanned.length,
      total_integration_points: scanned.reduce((sum, w) => sum + w.integration_points, 0),
    },
    note: 'Counts from dynamic workflow scanning. Each Pre-computed block saves 1 LLM reasoning step.',
  };

  output(result, { formatter: formatDecisionsSavings });
}


// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  cmdDecisionsList,
  cmdDecisionsInspect,
  cmdDecisionsEvaluate,
  cmdDecisionsSavings,
  // Exported for testing
  formatDecisionsList,
  formatDecisionsInspect,
  formatDecisionsEvaluate,
  formatDecisionsSavings,
  resolveWorkflowsDir,
  scanWorkflowDecisions,
  BEFORE_ESTIMATES,
};
