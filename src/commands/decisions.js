'use strict';

const { DECISION_REGISTRY, evaluateDecisions } = require('../lib/decision-rules');
const { output } = require('../lib/output');
const { banner, sectionHeader, formatTable, summaryLine, actionHint, color, SYMBOLS } = require('../lib/format');

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
 *
 * @param {string} cwd - Project root
 * @param {string[]} args - CLI arguments
 * @param {boolean} raw - Raw JSON output mode
 */
function cmdDecisionsSavings(cwd, args, raw) {
  const SAVINGS_DATA = [
    { workflow: 'progress.md', before: 7, after: 1, decisions: ['progress-route'] },
    { workflow: 'execute-plan.md', before: 5, after: 1, decisions: ['execution-pattern', 'context-budget-gate', 'previous-check-gate'] },
    { workflow: 'execute-phase.md', before: 4, after: 1, decisions: ['branch-handling', 'ci-gate'] },
    { workflow: 'resume-project.md', before: 5, after: 1, decisions: ['resume-route'] },
    { workflow: 'discuss-phase.md', before: 2, after: 0, decisions: ['auto-advance'] },
    { workflow: 'plan-phase.md', before: 2, after: 0, decisions: ['auto-advance'] },
    { workflow: 'transition.md', before: 3, after: 1, decisions: ['auto-advance', 'branch-handling'] },
    { workflow: 'debug.md', before: 3, after: 1, decisions: ['debug-handler-route', 'model-resolution'] },
    { workflow: 'audit-milestone.md', before: 2, after: 0, decisions: ['model-resolution'] },
  ];

  const workflows = SAVINGS_DATA.map(w => ({
    ...w,
    saved: w.before - w.after,
  }));

  const totalBefore = workflows.reduce((sum, w) => sum + w.before, 0);
  const totalAfter = workflows.reduce((sum, w) => sum + w.after, 0);
  const totalSaved = totalBefore - totalAfter;
  const percentReduction = totalBefore > 0 ? Math.round((totalSaved / totalBefore) * 100) : 0;

  const result = {
    workflows,
    totals: {
      before: totalBefore,
      after: totalAfter,
      saved: totalSaved,
      percent_reduction: percentReduction,
    },
    note: 'Counts are per-invocation. High-traffic workflows multiply savings.',
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
};
