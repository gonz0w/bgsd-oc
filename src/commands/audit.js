'use strict';

const fs = require('fs');
const path = require('path');
const { output, error, debugLog } = require('../lib/output');

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Decision indicator patterns for workflow/agent markdown scanning.
 * Each pattern targets a specific type of LLM decision point.
 */
const DECISION_INDICATORS = [
  // Explicit routing/choice tables
  { pattern: /\|\s*Condition\s*\|\s*(?:Meaning|Action|Route)\s*\|/i, type: 'routing-table' },
  { pattern: /\|\s*(?:Route|Pattern)\s+[A-F]\b/i, type: 'named-route' },

  // Conditional logic requiring LLM judgment
  { pattern: /\bIf\s+.*(?:ask|offer|present|suggest|route|classify)\b/i, type: 'decision-conditional' },
  { pattern: /\b(?:choose|decide|determine|select|pick)\s+(?:the|which|a|an|between)\b/i, type: 'decision-verb' },

  // Option presentation (LLM picks for user)
  { pattern: /options?:\s*\n\s*-/i, type: 'option-list' },
  { pattern: /(?:offer|present).*(?:options?|choice)/i, type: 'option-offering' },

  // Classification/inference
  { pattern: /\b(?:infer|classify|categorize)\b.*\b(?:severity|priority|type|category)\b/i, type: 'classification' },
  { pattern: /\b(?:severity|priority)\b.*\b(?:infer|classify|determine|assess)\b/i, type: 'classification' },

  // Rule application
  { pattern: /\b(?:heuristic|rule|criteria)\b.*\b(?:apply|check|use)\b/i, type: 'rule-application' },
  { pattern: /\b(?:apply|check|use)\b.*\b(?:heuristic|rule|criteria)\b/i, type: 'rule-application' },
];

/**
 * False positive filters — procedural conditionals that are NOT LLM decisions.
 */
const FALSE_POSITIVE_PATTERNS = [
  /\bIf\s+(?:file|directory|path)\s+(?:exists|missing|not found)\b/i,
  /\bIf\s+(?:no|not)\s+(?:file|directory|command|tool|config)\b/i,
  /\bIf\s+.*(?:\.exists|existsSync|readFileSync|statSync)\b/i,
  /\bIf\s+(?:error|failure|exitCode|exit\s*code)\b/i,
  /\bIf\s+(?:--\w+|flag)\s+(?:is\s+)?(?:set|present|provided)\b/i,
  /\bIf\s+(?:no\s+)?(?:changes?|diff|modifications?)\b/i,
  /```[\s\S]*?```/g,  // Skip code blocks entirely
];

/**
 * Decision category mapping from indicators.
 */
const CATEGORY_MAP = {
  'routing-table': 'workflow-routing',
  'named-route': 'workflow-routing',
  'decision-conditional': 'workflow-routing',
  'decision-verb': 'execution-mode',
  'option-list': 'template-selection',
  'option-offering': 'template-selection',
  'classification': 'severity-classification',
  'rule-application': 'state-assessment',
};

/**
 * Token estimation categories with ranges and midpoints.
 */
const TOKEN_CATEGORIES = {
  simple_lookup: {
    label: 'Simple Lookup',
    range: [50, 100],
    midpoint: 75,
  },
  conditional_chain: {
    label: 'Conditional Chain',
    range: [200, 500],
    midpoint: 350,
  },
  multi_step_reasoning: {
    label: 'Multi-Step Reasoning',
    range: [300, 800],
    midpoint: 550,
  },
  context_overhead: {
    label: 'Context Overhead',
    range: [100, 300],
    midpoint: 200,
  },
};

/**
 * Map decision categories to token estimation categories.
 */
const CATEGORY_TOKEN_MAP = {
  'workflow-routing': 'conditional_chain',
  'model-selection': 'simple_lookup',
  'execution-mode': 'conditional_chain',
  'state-assessment': 'conditional_chain',
  'severity-classification': 'multi_step_reasoning',
  'file-resolution': 'simple_lookup',
  'template-selection': 'simple_lookup',
};

/**
 * Workflow frequency classification for token savings estimation.
 */
const WORKFLOW_FREQUENCY = {
  // Every-session workflows (high frequency)
  'progress.md': { type: 'every-session', per_session: 3 },
  'resume-project.md': { type: 'every-session', per_session: 1 },
  'execute-plan.md': { type: 'every-session', per_session: 2 },
  'execute-phase.md': { type: 'every-session', per_session: 1 },
  'quick.md': { type: 'every-session', per_session: 1 },

  // Per-phase workflows (medium frequency)
  'plan-phase.md': { type: 'per-phase', per_session: 0.5 },
  'research-phase.md': { type: 'per-phase', per_session: 0.3 },
  'discuss-phase.md': { type: 'per-phase', per_session: 0.3 },
  'verify-work.md': { type: 'per-phase', per_session: 0.5 },

  // Rare workflows (low frequency)
  'new-project.md': { type: 'rare', per_session: 0.05 },
  'new-milestone.md': { type: 'rare', per_session: 0.1 },
  'complete-milestone.md': { type: 'rare', per_session: 0.1 },
};


// ─── Scanner ─────────────────────────────────────────────────────────────────

/**
 * Resolve the plugin home directory for scanning workflows and agents.
 * Follows the pattern from agent.js resolveBgsdPaths().
 *
 * @returns {{ workflowsDir: string, agentsDir: string }}
 */
function resolvePluginDirs() {
  // In development: __dirname is src/commands/, so plugin root is ../../
  // In production bundle: __dirname is inside bin/, resolve via BGSD_HOME
  const BGSD_HOME = process.env.BGSD_HOME ||
    path.resolve(__dirname, '..', '..');

  const workflowsDir = path.join(BGSD_HOME, 'workflows');
  const agentsDir = path.join(path.dirname(BGSD_HOME), 'agents');

  // Fallback: if running from dev workspace, workflows are at project root
  if (!fs.existsSync(workflowsDir)) {
    const devWorkflows = path.resolve(__dirname, '..', '..', 'workflows');
    const devAgents = path.resolve(__dirname, '..', '..', 'agents');
    return { workflowsDir: devWorkflows, agentsDir: devAgents };
  }

  return { workflowsDir, agentsDir };
}

/**
 * Read all markdown files from a directory.
 *
 * @param {string} dir - Directory path
 * @returns {{ name: string, content: string, path: string }[]}
 */
function readMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) {
    debugLog('audit.scan', `directory not found: ${dir}`);
    return [];
  }

  try {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    return files.map(f => {
      const filePath = path.join(dir, f);
      try {
        return { name: f, content: fs.readFileSync(filePath, 'utf-8'), path: filePath };
      } catch (e) {
        debugLog('audit.scan', `failed to read: ${filePath}`, e);
        return null;
      }
    }).filter(Boolean);
  } catch (e) {
    debugLog('audit.scan', `failed to read directory: ${dir}`, e);
    return [];
  }
}

/**
 * Check if a matched line is a false positive (procedural conditional, not a decision).
 *
 * @param {string} line - The matched line
 * @param {string} context - Surrounding context
 * @returns {boolean}
 */
function isFalsePositive(line, context) {
  for (const fp of FALSE_POSITIVE_PATTERNS) {
    if (fp.global) {
      // For code block detection, check the context
      if (context.match(fp)) {
        // Check if the line is inside a code block
        const lines = context.split('\n');
        let inCodeBlock = false;
        for (const l of lines) {
          if (/^```/.test(l.trim())) inCodeBlock = !inCodeBlock;
          if (l === line && inCodeBlock) return true;
        }
      }
    } else if (fp.test(line)) {
      return true;
    }
  }
  return false;
}

/**
 * Generate a unique candidate ID from file name, indicator type, and line number.
 *
 * @param {string} fileName - Source file name
 * @param {string} type - Indicator type
 * @param {number} lineNum - Line number
 * @returns {string}
 */
function generateCandidateId(fileName, type, lineNum) {
  const prefix = fileName.includes('agent') || fileName.startsWith('bgsd-') ? 'AG' : 'WF';
  const baseName = fileName.replace(/\.md$/, '').replace(/[^a-zA-Z0-9-]/g, '-');
  const shortType = type.replace(/-/g, '_');
  return `${prefix}-${baseName}-${shortType}-L${lineNum}`;
}

/**
 * Extract surrounding context lines around a match.
 *
 * @param {string[]} lines - All lines of the file
 * @param {number} lineIdx - Index of the matched line (0-based)
 * @param {number} [before=5] - Lines before
 * @param {number} [after=5] - Lines after
 * @returns {string}
 */
function extractContext(lines, lineIdx, before, after) {
  before = before || 5;
  after = after || 5;
  const start = Math.max(0, lineIdx - before);
  const end = Math.min(lines.length - 1, lineIdx + after);
  return lines.slice(start, end + 1).join('\n');
}

/**
 * Scan a single markdown file for decision points.
 *
 * @param {{ name: string, content: string, path: string }} file
 * @returns {object[]} Array of candidate objects
 */
function scanFile(file) {
  const candidates = [];
  const lines = file.content.split('\n');
  const seenLines = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const indicator of DECISION_INDICATORS) {
      if (indicator.pattern.test(line)) {
        // Skip if this line was already matched by another indicator
        const lineKey = `${i}`;
        if (seenLines.has(lineKey)) continue;

        const context = extractContext(lines, i);

        // Filter false positives
        if (isFalsePositive(line, context)) continue;

        seenLines.add(lineKey);

        const category = CATEGORY_MAP[indicator.type] || 'workflow-routing';
        const lineNum = i + 1;

        candidates.push({
          id: generateCandidateId(file.name, indicator.type, lineNum),
          source_file: file.name,
          line: lineNum,
          indicator_type: indicator.type,
          category: category,
          matched_text: line.trim().substring(0, 200),
          context: context.substring(0, 500),
        });

        break; // One match per line
      }
    }
  }

  return candidates;
}

/**
 * Scan all workflow and agent files for decision candidates.
 *
 * @returns {object[]} Array of all candidates
 */
function scanAll() {
  const { workflowsDir, agentsDir } = resolvePluginDirs();

  debugLog('audit.scan', `scanning workflows: ${workflowsDir}`);
  debugLog('audit.scan', `scanning agents: ${agentsDir}`);

  const workflowFiles = readMarkdownFiles(workflowsDir);
  const agentFiles = readMarkdownFiles(agentsDir);

  debugLog('audit.scan', `found ${workflowFiles.length} workflow files, ${agentFiles.length} agent files`);

  const candidates = [];
  for (const file of [...workflowFiles, ...agentFiles]) {
    const fileCandidates = scanFile(file);
    candidates.push(...fileCandidates);
  }

  return candidates;
}


// ─── Rubric Scorer ───────────────────────────────────────────────────────────

/**
 * Assess whether a candidate has finite inputs.
 *
 * @param {object} candidate
 * @returns {boolean}
 */
function assessFiniteInputs(candidate) {
  const category = candidate.category;
  // Categories with naturally finite inputs
  if (['workflow-routing', 'model-selection', 'execution-mode', 'state-assessment', 'file-resolution'].includes(category)) {
    return true;
  }
  // Template selection passes for mechanical selection
  if (category === 'template-selection') {
    const context = (candidate.context || '').toLowerCase();
    // If it references enums, tables, or finite sets
    if (/\b(?:table|lookup|enum|switch|case)\b/.test(context)) return true;
    // Option lists with bounded items
    if (/options?:\s*\n\s*-/i.test(context)) return true;
    return true; // Default pass for template selection
  }
  // Severity classification: passes for keyword-based, fails for complex text
  if (category === 'severity-classification') {
    const context = (candidate.context || '').toLowerCase();
    if (/\b(?:keyword|pattern|regex|match)\b/.test(context)) return true;
    if (/\b(?:assess|judge|evaluate|understand)\b/.test(context)) return false;
    return true; // Default pass — most severity patterns are keyword-based
  }
  return false;
}

/**
 * Assess whether a candidate produces deterministic output.
 *
 * @param {object} candidate
 * @returns {boolean}
 */
function assessDeterministic(candidate) {
  const category = candidate.category;
  // Workflow routing: same state → same route
  if (['workflow-routing', 'model-selection', 'execution-mode', 'state-assessment', 'file-resolution'].includes(category)) {
    return true;
  }
  // Template selection: passes for mechanical, fails for creative
  if (category === 'template-selection') {
    const context = (candidate.context || '').toLowerCase();
    if (/\b(?:creative|generate|brainstorm|suggest\s+new)\b/.test(context)) return false;
    return true;
  }
  // Severity classification: mixed
  if (category === 'severity-classification') {
    const context = (candidate.context || '').toLowerCase();
    if (/\b(?:code\s+quality|review|assess\s+(?:quality|style))\b/.test(context)) return false;
    return true;
  }
  return false;
}

/**
 * Assess whether a candidate requires no natural language understanding.
 *
 * @param {object} candidate
 * @returns {boolean}
 */
function assessNoNLU(candidate) {
  const category = candidate.category;
  // Most categories don't need NLU
  if (['workflow-routing', 'model-selection', 'execution-mode', 'state-assessment', 'file-resolution'].includes(category)) {
    return true;
  }
  // Template selection: fails if it requires understanding content
  if (category === 'template-selection') {
    const context = (candidate.context || '').toLowerCase();
    if (/\b(?:understand|interpret|read.*context|meaning)\b/.test(context)) return false;
    return true;
  }
  // Severity classification: fails for NLU-based severity inference
  if (category === 'severity-classification') {
    const context = (candidate.context || '').toLowerCase();
    if (/\b(?:infer|from\s+(?:user|text|description)|natural\s+language)\b/.test(context)) return false;
    // Check for severity from keywords (passes) vs from text understanding (fails)
    if (/\b(?:keyword|pattern|regex|match|indicator)\b/.test(context)) return true;
    return true; // Default pass
  }
  return false;
}

/**
 * Assess whether a candidate executes with high frequency.
 *
 * @param {object} candidate
 * @returns {boolean}
 */
function assessFrequency(candidate) {
  const fileName = candidate.source_file;
  const freq = WORKFLOW_FREQUENCY[fileName];
  if (freq && freq.type === 'every-session') return true;
  // Agent files are loaded every session
  if (fileName.startsWith('bgsd-')) return true;
  return false;
}

/**
 * Assess whether a candidate is low complexity to implement.
 *
 * @param {object} candidate
 * @returns {boolean}
 */
function assessComplexity(candidate) {
  const category = candidate.category;
  // Simple categories are typically lookup tables
  if (['workflow-routing', 'model-selection', 'file-resolution', 'template-selection'].includes(category)) {
    return true;
  }
  return false;
}

/**
 * Assess whether a similar pattern already exists in the codebase.
 *
 * @param {object} candidate
 * @returns {boolean}
 */
function assessExistingPattern(candidate) {
  const category = candidate.category;
  // These patterns already exist in code
  if (category === 'model-selection') return true;  // util:resolve-model
  if (category === 'state-assessment') return true;  // plan:roadmap analyze
  if (category === 'severity-classification') return true;  // src/lib/review/severity.js
  if (category === 'workflow-routing') return true;  // command-enricher.js pre-computes some
  return false;
}

/**
 * Assess whether changing the decision affects few downstream consumers.
 *
 * @param {object} candidate
 * @returns {boolean}
 */
function assessBlastRadius(candidate) {
  const category = candidate.category;
  // Most decisions are self-contained within their workflow
  if (['workflow-routing', 'execution-mode', 'template-selection', 'file-resolution'].includes(category)) {
    return true;
  }
  // Model selection affects many agents
  if (category === 'model-selection') return false;
  // Severity classification affects downstream verification
  if (category === 'severity-classification') return false;
  return true;
}

/**
 * Score a candidate against the 7-criteria rubric.
 *
 * @param {object} candidate
 * @returns {{ passes: boolean, criteria: object, preferred_score: number, total_score: number, rationale: string }}
 */
function scoreCandidate(candidate) {
  const criteria = {
    // 3 Critical (must ALL pass for offloading)
    finite_inputs: assessFiniteInputs(candidate),
    deterministic_output: assessDeterministic(candidate),
    no_nlu_needed: assessNoNLU(candidate),
    // 4 Preferred (nice to have)
    high_frequency: assessFrequency(candidate),
    low_complexity: assessComplexity(candidate),
    existing_pattern: assessExistingPattern(candidate),
    low_blast_radius: assessBlastRadius(candidate),
  };

  const passes = criteria.finite_inputs && criteria.deterministic_output && criteria.no_nlu_needed;
  const preferred_score = [criteria.high_frequency, criteria.low_complexity, criteria.existing_pattern, criteria.low_blast_radius].filter(Boolean).length;
  const total_score = passes ? 3 + preferred_score : 0;

  let rationale = '';
  if (!passes) {
    const failed = [];
    if (!criteria.finite_inputs) failed.push('inputs are not finite/bounded');
    if (!criteria.deterministic_output) failed.push('output is not deterministic');
    if (!criteria.no_nlu_needed) failed.push('requires natural language understanding');
    rationale = `Keep in LLM: ${failed.join('; ')}`;
  }

  return { passes, criteria, preferred_score, total_score, rationale };
}


// ─── Token Estimator ─────────────────────────────────────────────────────────

/**
 * Estimate token savings for a candidate.
 *
 * @param {object} candidate - Candidate with category and source_file
 * @returns {{ category: string, label: string, per_invocation: number, frequency: number, per_session: number }}
 */
function estimateTokenSavings(candidate) {
  const tokenCategory = CATEGORY_TOKEN_MAP[candidate.category] || 'conditional_chain';
  const tokenInfo = TOKEN_CATEGORIES[tokenCategory];
  const perInvocation = tokenInfo.midpoint;

  // Estimate frequency from workflow type
  const freq = WORKFLOW_FREQUENCY[candidate.source_file];
  let perSession = 1;
  if (freq) {
    perSession = freq.per_session;
  } else if (candidate.source_file.startsWith('bgsd-')) {
    // Agent files are loaded each session
    perSession = 1;
  } else {
    perSession = 0.3; // Default for unknown workflows
  }

  return {
    category: tokenCategory,
    label: tokenInfo.label,
    per_invocation: perInvocation,
    frequency: perSession,
    per_session: Math.round(perInvocation * perSession),
  };
}


// ─── Command Handler ─────────────────────────────────────────────────────────

/**
 * cmdAuditScan — Scan workflows/agents for LLM-offloadable decisions
 * with rubric scoring and token estimates.
 *
 * @param {string} cwd - Project root
 * @param {string[]} args - CLI arguments
 * @param {boolean} raw - Raw JSON output mode
 */
function cmdAuditScan(cwd, args, raw) {
  // Run scanner
  const allCandidates = scanAll();

  // Score each candidate
  const scoredCandidates = allCandidates.map(candidate => {
    const rubric = scoreCandidate(candidate);
    const token_estimate = estimateTokenSavings(candidate);
    return { ...candidate, rubric, token_estimate };
  });

  // Partition into offloadable vs keep-in-LLM
  const offloadable = scoredCandidates
    .filter(c => c.rubric.passes)
    .sort((a, b) => b.rubric.total_score - a.rubric.total_score);

  const keep_in_llm = scoredCandidates
    .filter(c => !c.rubric.passes)
    .sort((a, b) => b.rubric.total_score - a.rubric.total_score);

  // Calculate summary statistics
  const totalSavings = offloadable.reduce((sum, c) => sum + c.token_estimate.per_session, 0);
  const savingsByCategory = {};
  for (const c of offloadable) {
    const cat = c.category;
    if (!savingsByCategory[cat]) savingsByCategory[cat] = 0;
    savingsByCategory[cat] += c.token_estimate.per_session;
  }

  const result = {
    candidates: scoredCandidates,
    offloadable,
    keep_in_llm,
    summary: {
      total_candidates: scoredCandidates.length,
      offloadable_count: offloadable.length,
      keep_count: keep_in_llm.length,
      estimated_total_savings: totalSavings,
      savings_by_category: savingsByCategory,
    },
  };

  output(result, raw);
}


// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  cmdAuditScan,
  // Exported for testing
  scoreCandidate,
  estimateTokenSavings,
  scanAll,
  resolvePluginDirs,
};
