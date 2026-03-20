'use strict';

const fs = require('fs');
const path = require('path');
const { output, error, debugLog } = require('../lib/output');

/**
 * Questions namespace commands for auditing, listing, and validating question templates.
 * Part of Phase 143: Remaining Workflows & CLI Tools
 */

// ─── questions:audit ──────────────────────────────────────────────────────────

/**
 * Scan all workflow .md files and detect inline questions vs template references.
 * Reports taxonomy compliance percentage.
 *
 * @param {string} cwd - Current working directory
 * @param {boolean} raw - JSON output mode
 */
function cmdQuestionsAudit(cwd, raw) {
  // Detect plugin path to read workflow files
  let pluginDir = process.env.BGSD_PLUGIN_DIR;
  if (!pluginDir) {
    pluginDir = path.resolve(__dirname, '..');
  }
  const workflowsDir = path.join(pluginDir, 'workflows');

  if (!fs.existsSync(workflowsDir)) {
    error('workflows/ directory not found');
  }

  const workflowFiles = fs.readdirSync(workflowsDir)
    .filter(f => f.endsWith('.md'));

  // Patterns for inline questions
  const INLINE_PATTERNS = [
    /question\s*\(\s*\[/g,           // question([
    /Use question:/g,                 // Use question:
    /Ask:/g,                         // Ask:
  ];

  // Pattern for template references
  const TEMPLATE_PATTERN = /questionTemplate\s*\(/g;

  const results = [];
  let totalQuestions = 0;
  let totalTemplates = 0;
  let totalInline = 0;

  for (const file of workflowFiles) {
    const filePath = path.join(workflowsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Count template references
    const templateMatches = content.match(TEMPLATE_PATTERN) || [];
    const templateCount = templateMatches.length;

    // Count inline questions for each pattern
    let inlineCount = 0;
    for (const pattern of INLINE_PATTERNS) {
      const matches = content.match(pattern) || [];
      inlineCount += matches.length;
    }

    totalQuestions += templateCount + inlineCount;
    totalTemplates += templateCount;
    totalInline += inlineCount;

    results.push({
      file,
      templates: templateCount,
      inline: inlineCount,
      total: templateCount + inlineCount,
    });
  }

  // Calculate compliance: templates / total questions
  const compliancePct = totalQuestions > 0
    ? Math.round((totalTemplates / totalQuestions) * 1000) / 10
    : 100;

  // Human-readable output to stderr
  process.stderr.write('\n## Questions Audit\n\n');
  process.stderr.write(`Workflows scanned: ${workflowFiles.length}\n`);
  process.stderr.write(`Total questions found: ${totalQuestions}\n`);
  process.stderr.write(`  - Template references: ${totalTemplates}\n`);
  process.stderr.write(`  - Inline questions: ${totalInline}\n`);
  process.stderr.write(`Compliance: ${compliancePct}%\n\n`);

  // Print table
  const maxNameLen = Math.max(30, ...results.map(r => r.file.length));
  const header = `${'Workflow'.padEnd(maxNameLen)} | Templates | Inline | Total`;
  const sep = '-'.repeat(maxNameLen) + '-+----------+--------+-------';
  process.stderr.write(header + '\n');
  process.stderr.write(sep + '\n');
  for (const r of results) {
    const name = r.file.padEnd(maxNameLen);
    process.stderr.write(`${name} | ${String(r.templates).padStart(9)} | ${String(r.inline).padStart(6)} | ${String(r.total).padStart(5)}\n`);
  }
  process.stderr.write(sep + '\n');
  process.stderr.write(`\nCompliance: ${compliancePct}% taxonomy-compliant\n\n`);

  const result = {
    workflows_scanned: workflowFiles.length,
    total_questions: totalQuestions,
    template_references: totalTemplates,
    inline_questions: totalInline,
    compliance_percent: compliancePct,
    details: results,
  };

  output(result, raw);
}

// ─── questions:list ─────────────────────────────────────────────────────────

/**
 * List all question templates from src/lib/questions.js with taxonomy type and usage count.
 *
 * @param {string} cwd - Current working directory
 * @param {boolean} raw - JSON output mode
 */
function cmdQuestionsList(cwd, raw) {
  // Load OPTION_TEMPLATES
  let templates;
  try {
    const questionsLib = require('../lib/questions');
    templates = questionsLib.OPTION_TEMPLATES;
  } catch (e) {
    error('Could not load src/lib/questions.js: ' + e.message);
  }

  // Detect plugin path to read workflow files for usage counting
  let pluginDir = process.env.BGSD_PLUGIN_DIR;
  if (!pluginDir) {
    pluginDir = path.resolve(__dirname, '..');
  }
  const workflowsDir = path.join(pluginDir, 'workflows');

  // Count usage of each template in workflows
  const usageCounts = {};
  const TEMPLATE_ID_PATTERN = /questionTemplate\s*\(\s*['"]([^'"]+)['"]/g;

  try {
    if (fs.existsSync(workflowsDir)) {
      const workflowFiles = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.md'));
      for (const file of workflowFiles) {
        const content = fs.readFileSync(path.join(workflowsDir, file), 'utf-8');
        let match;
        while ((match = TEMPLATE_ID_PATTERN.exec(content)) !== null) {
          const templateId = match[1];
          usageCounts[templateId] = (usageCounts[templateId] || 0) + 1;
        }
        TEMPLATE_ID_PATTERN.lastIndex = 0;
      }
    }
  } catch (e) {
    debugLog('questions:list', 'failed to count usage', e);
  }

  // Build list
  const templateList = Object.entries(templates).map(([id, template]) => {
    const optionCount = template.options ? template.options.length : 0;
    const usageCount = usageCounts[id] || 0;
    return {
      id,
      type: template.typeHint || 'UNKNOWN',
      option_count: optionCount,
      usage_count: usageCount,
    };
  });

  // Sort by usage count descending
  templateList.sort((a, b) => b.usage_count - a.usage_count);

  // Human-readable output to stderr
  process.stderr.write('\n## Question Templates\n\n');
  process.stderr.write(`Total templates: ${templateList.length}\n\n`);

  const maxIdLen = Math.max(35, ...templateList.map(t => t.id.length));
  const header = `${'Template ID'.padEnd(maxIdLen)} | Type | Options | Usage`;
  const sep = '-'.repeat(maxIdLen) + '-+--------+--------+-------';
  process.stderr.write(header + '\n');
  process.stderr.write(sep + '\n');
  for (const t of templateList) {
    const id = t.id.padEnd(maxIdLen);
    process.stderr.write(`${id} | ${String(t.type).padStart(5)} | ${String(t.option_count).padStart(6)} | ${String(t.usage_count).padStart(5)}\n`);
  }
  process.stderr.write(sep + '\n\n');

  const result = {
    total_templates: templateList.length,
    templates: templateList,
  };

  output(result, raw);
}

// ─── questions:validate ───────────────────────────────────────────────────────

/**
 * Validate all question templates: MIN 3 options, MAX 5 options, escape hatch present,
 * formatting parity across options.
 * Phase 143: warn-only mode (reports issues, does not fail).
 *
 * @param {string} cwd - Current working directory
 * @param {boolean} raw - JSON output mode
 */
function cmdQuestionsValidate(cwd, raw) {
  // Load OPTION_TEMPLATES and OPTION_RULES
  let templates, rules;
  try {
    const questionsLib = require('../lib/questions');
    templates = questionsLib.OPTION_TEMPLATES;
    rules = questionsLib.OPTION_RULES;
  } catch (e) {
    error('Could not load src/lib/questions.js: ' + e.message);
  }

  const issues = [];
  const escapeHatchLabel = rules.ESCAPE_HATCH || 'Something else';
  const minOptions = rules.MIN_OPTIONS || 3;
  const maxOptions = rules.MAX_OPTIONS || 5;

  for (const [id, template] of Object.entries(templates)) {
    const templateIssues = [];

    // Check option count
    const optionCount = template.options ? template.options.length : 0;
    if (optionCount < minOptions) {
      templateIssues.push(`Too few options: ${optionCount} (minimum: ${minOptions})`);
    }
    if (optionCount > maxOptions) {
      templateIssues.push(`Too many options: ${optionCount} (maximum: ${maxOptions})`);
    }

    // Check for escape hatch
    if (template.options && template.options.length > 0) {
      const hasEscapeHatch = template.options.some(o =>
        o.label === escapeHatchLabel || o.isEscapeHatch === true
      );
      if (!hasEscapeHatch) {
        templateIssues.push(`Missing escape hatch: "${escapeHatchLabel}" not found in options`);
      }
    }

    // Check formatting parity (all options should have similar length/grammar/detail)
    if (template.options && template.options.length >= 2) {
      const lengths = template.options.map(o => o.label.length);
      const avgLength = lengths.reduce((s, l) => s + l, 0) / lengths.length;
      const variance = lengths.reduce((s, l) => s + Math.pow(l - avgLength, 2), 0) / lengths.length;
      const stdDev = Math.sqrt(variance);

      // Flag if std dev > 50% of average length (indicates imbalanced options)
      if (avgLength > 0 && stdDev > avgLength * 0.5) {
        templateIssues.push(`Formatting imbalance: std dev ${Math.round(stdDev)} vs avg ${Math.round(avgLength)} chars`);
      }
    }

    if (templateIssues.length > 0) {
      issues.push({
        template_id: id,
        issues: templateIssues,
      });
    }
  }

  // Human-readable output to stderr
  process.stderr.write('\n## Questions Validate\n\n');
  process.stderr.write(`Templates checked: ${Object.keys(templates).length}\n`);
  process.stderr.write(`Issues found: ${issues.length}\n\n`);

  if (issues.length === 0) {
    process.stderr.write('All templates passed validation.\n\n');
  } else {
    for (const item of issues) {
      process.stderr.write(`Template: ${item.template_id}\n`);
      for (const issue of item.issues) {
        process.stderr.write(`  - ${issue}\n`);
      }
      process.stderr.write('\n');
    }
  }

  const result = {
    templates_checked: Object.keys(templates).length,
    issues_found: issues.length,
    issues,
    mode: 'warn-only',
  };

  output(result, raw);
}

module.exports = {
  cmdQuestionsAudit,
  cmdQuestionsList,
  cmdQuestionsValidate,
};
