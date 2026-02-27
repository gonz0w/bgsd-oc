'use strict';

const { debugLog } = require('./output');

// ─── Token Estimation ────────────────────────────────────────────────────────

let _estimateTokenCount = null;

/**
 * Lazy-load tokenx's estimateTokenCount function.
 * Falls back to character-based heuristic if tokenx fails to load.
 */
function getTokenizer() {
  if (_estimateTokenCount !== null) return _estimateTokenCount;
  try {
    const tokenx = require('tokenx');
    _estimateTokenCount = tokenx.estimateTokenCount;
    debugLog('context.tokenizer', 'tokenx loaded successfully');
  } catch (e) {
    debugLog('context.tokenizer', 'tokenx load failed, using fallback', e);
    _estimateTokenCount = (text) => Math.ceil(String(text).length / 4);
  }
  return _estimateTokenCount;
}

/**
 * Estimate token count for a text string using tokenx (~96% accuracy for prose).
 * Falls back to Math.ceil(text.length / 4) if tokenx fails.
 *
 * @param {string} text - Text to estimate tokens for
 * @returns {number} Estimated token count
 */
function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  try {
    const fn = getTokenizer();
    return fn(text);
  } catch (e) {
    debugLog('context.estimateTokens', 'estimation failed, using fallback', e);
    return Math.ceil(text.length / 4);
  }
}

/**
 * Estimate token count for a JSON-serializable object.
 *
 * @param {*} obj - Object to serialize and estimate
 * @returns {number} Estimated token count of JSON.stringify(obj)
 */
function estimateJsonTokens(obj) {
  if (obj === undefined || obj === null) return 0;
  try {
    return estimateTokens(JSON.stringify(obj));
  } catch (e) {
    debugLog('context.estimateJsonTokens', 'stringify failed', e);
    return 0;
  }
}

/**
 * Check token count against budget.
 *
 * @param {number} tokens - Token count to check
 * @param {object} config - Config with context_window and context_target_percent
 * @returns {{ tokens: number, percent: number, warning: boolean, recommendation: string|null }}
 */
function checkBudget(tokens, config = {}) {
  const contextWindow = config.context_window || 200000;
  const targetPercent = config.context_target_percent || 50;
  const percent = Math.round((tokens / contextWindow) * 100);
  const warning = percent > targetPercent;

  let recommendation = null;
  if (percent > 80) {
    recommendation = 'Critical: exceeds 80% of context window. Split into smaller units.';
  } else if (percent > 60) {
    recommendation = 'High: exceeds 60% of context window. Consider reducing scope.';
  } else if (percent > targetPercent) {
    recommendation = `Above target: exceeds ${targetPercent}% target. Monitor closely.`;
  }

  return { tokens, percent, warning, recommendation };
}

/**
 * Convenience: estimate tokens for text and check budget in one call.
 *
 * @param {string} text - Text to estimate
 * @param {object} config - Config with context_window and context_target_percent
 * @returns {{ tokens: number, percent: number, warning: boolean, recommendation: string|null }}
 */
function isWithinBudget(text, config = {}) {
  const tokens = estimateTokens(text);
  return checkBudget(tokens, config);
}

// ─── Agent Context Manifests ─────────────────────────────────────────────────

const AGENT_MANIFESTS = {
  'gsd-executor': {
    fields: ['phase_dir', 'phase_number', 'phase_name', 'plans', 'incomplete_plans',
             'plan_count', 'incomplete_count', 'branch_name', 'commit_docs',
             'verifier_enabled', 'task_routing', 'env_summary'],
    optional: ['codebase_conventions', 'codebase_dependencies'],
    exclude: ['intent_drift', 'intent_summary', 'worktree_config', 'worktree_active',
              'file_overlaps', 'codebase_freshness', 'codebase_stats'],
  },
  'gsd-verifier': {
    fields: ['phase_dir', 'phase_number', 'phase_name', 'plans', 'summaries',
             'verifier_enabled'],
    optional: ['codebase_stats'],
    exclude: ['intent_drift', 'intent_summary', 'task_routing', 'worktree_config',
              'worktree_active', 'file_overlaps', 'env_summary', 'branch_name',
              'codebase_conventions', 'codebase_dependencies'],
  },
  'gsd-planner': {
    fields: ['phase_dir', 'phase_number', 'phase_name', 'plan_count',
             'research_enabled', 'plan_checker_enabled', 'intent_summary'],
    optional: ['codebase_stats', 'codebase_conventions', 'codebase_dependencies',
               'codebase_freshness', 'env_summary'],
    exclude: ['task_routing', 'worktree_config', 'worktree_active', 'file_overlaps',
              'branch_name'],
  },
  'gsd-phase-researcher': {
    fields: ['phase_dir', 'phase_number', 'phase_name', 'intent_summary'],
    optional: ['codebase_stats', 'env_summary'],
    exclude: ['task_routing', 'worktree_config', 'worktree_active', 'file_overlaps',
              'branch_name', 'verifier_enabled', 'plans', 'incomplete_plans'],
  },
  'gsd-plan-checker': {
    fields: ['phase_dir', 'phase_number', 'phase_name', 'plans', 'plan_count'],
    optional: ['codebase_stats', 'codebase_dependencies'],
    exclude: ['intent_drift', 'intent_summary', 'task_routing', 'worktree_config',
              'worktree_active', 'file_overlaps', 'env_summary', 'branch_name'],
  },
};

/**
 * Filter init output to agent-declared fields.
 * @param {object} result - Full init output object
 * @param {string} agentType - Agent type key (e.g. 'gsd-executor')
 * @returns {object} Scoped result with _agent and _savings metadata
 */
function scopeContextForAgent(result, agentType) {
  const manifest = AGENT_MANIFESTS[agentType];
  if (!manifest || !result) return result;

  const originalKeys = Object.keys(result).length;
  const allowed = new Set([...manifest.fields, ...manifest.optional]);
  const scoped = { _agent: agentType };

  for (const key of allowed) {
    if (key in result && result[key] !== undefined && result[key] !== null) {
      scoped[key] = result[key];
    } else if (manifest.fields.includes(key) && key in result) {
      // Required fields: include even if null
      scoped[key] = result[key];
    }
  }

  const scopedKeys = Object.keys(scoped).length - 1; // exclude _agent
  scoped._savings = {
    original_keys: originalKeys,
    scoped_keys: scopedKeys,
    reduction_pct: originalKeys > 0 ? Math.round((1 - scopedKeys / originalKeys) * 100) : 0,
  };

  return scoped;
}

/**
 * Compress STATE.md markdown to essential fields (70-80% reduction).
 * @param {string} stateRaw - Raw STATE.md content
 * @returns {object} Compact state object
 */
function compactPlanState(stateRaw) {
  if (!stateRaw || typeof stateRaw !== 'string') {
    return { phase: null, progress: null, status: null, last_activity: null, decisions: [], blockers: [] };
  }

  let phase = null, progress = null, status = null, lastActivity = null;

  // Extract Current Position fields
  const phaseMatch = stateRaw.match(/^Phase:\s*(\S+)/m);
  if (phaseMatch) phase = phaseMatch[1];

  const planMatch = stateRaw.match(/^Plan:\s*(.+)$/m);
  if (planMatch) progress = planMatch[1].trim();

  const statusMatch = stateRaw.match(/^Status:\s*(.+)$/m);
  if (statusMatch) status = statusMatch[1].trim();

  const activityMatch = stateRaw.match(/^Last activity:\s*(\S+)/m);
  if (activityMatch) lastActivity = activityMatch[1];

  // Extract last 5 decisions (lines starting with "- Phase")
  const decisions = [];
  const decisionRe = /^- Phase .+$/gm;
  let m;
  while ((m = decisionRe.exec(stateRaw)) !== null) {
    decisions.push(m[0].replace(/^- /, ''));
  }

  // Extract blockers
  const blockers = [];
  const blockerSection = stateRaw.match(/### Blockers\/Concerns\n([\s\S]*?)(?:\n## |\n$|$)/);
  if (blockerSection) {
    const lines = blockerSection[1].trim().split('\n').filter(l => l.startsWith('- '));
    for (const line of lines) {
      const text = line.replace(/^- /, '').trim();
      if (text && text.toLowerCase() !== 'none' && text.toLowerCase() !== 'none.') {
        blockers.push(text);
      }
    }
  }

  return {
    phase,
    progress,
    status,
    last_activity: lastActivity,
    decisions: decisions.slice(-5),
    blockers,
  };
}

/**
 * Compress dependency graph data to essentials (50-60% reduction).
 * @param {object} depData - Full codebase_dependencies object
 * @returns {object} Compact dep graph object
 */
function compactDepGraph(depData) {
  if (!depData || typeof depData !== 'object') return {};

  return {
    total_modules: depData.total_modules || 0,
    total_edges: depData.total_edges || 0,
    top_imported: Array.isArray(depData.top_imported) ? depData.top_imported.slice(0, 5) : [],
    has_cycles: !!depData.has_cycles,
  };
}

// ─── Task-Scoped Context Builder ─────────────────────────────────────────────

/**
 * Score a candidate file's relevance to the current task.
 * Duplicated from codebase.js to avoid circular imports (~15 lines).
 *
 * @param {string} file - Candidate file path
 * @param {string[]} taskFiles - Direct task files (score 1.0)
 * @param {{ forward: object, reverse: object }} graph - Dep graph adjacency
 * @param {string[]} planFiles - Files from plan's files_modified
 * @param {Set<string>} recentFiles - Recently modified files
 * @returns {{ score: number, reason: string }}
 */
function scoreTaskFile(file, taskFiles, graph, planFiles, recentFiles) {
  if (taskFiles.includes(file)) return { score: 1.0, reason: 'direct task file' };

  let score = 0;
  const reasons = [];

  // Check 1-hop: file imported by or imports a task file
  for (const tf of taskFiles) {
    if ((graph.forward[tf] || []).includes(file)) {
      score += 0.7; reasons.push('imported by task file'); break;
    }
    if ((graph.reverse[tf] || []).includes(file)) {
      score += 0.5; reasons.push('imports task file'); break;
    }
  }

  if (planFiles.includes(file)) { score += 0.3; reasons.push('in plan scope'); }
  if (recentFiles.has(file)) { score += 0.2; reasons.push('recently modified'); }

  return { score: Math.min(score, 1.0), reason: reasons.join(', ') || 'none' };
}

/**
 * Build task-scoped context: only files relevant to the current task.
 * Uses dep graph for 1-hop traversal, relevance scoring, and token budgeting.
 *
 * @param {string} cwd - Project root
 * @param {string[]} taskFiles - Files listed in the task's files element
 * @param {object} [options] - Options
 * @param {string[]} [options.planFiles] - Files from plan's files_modified
 * @param {number} [options.tokenBudget] - Max tokens for output (default 3000)
 * @param {boolean} [options.includeSignatures] - Include AST signatures (default true)
 * @returns {object} { task_files, context_files, stats }
 */
function buildTaskContext(cwd, taskFiles, options) {
  const opts = options || {};
  const planFiles = opts.planFiles || [];
  const tokenBudget = opts.tokenBudget || 3000;
  const includeSignatures = opts.includeSignatures !== false;

  if (!taskFiles || taskFiles.length === 0) {
    return { task_files: [], context_files: [], stats: { candidates_found: 0, files_included: 0, files_excluded: 0, token_estimate: 0, reduction_pct: 0 } };
  }

  // Load dep graph from intel (lazy require to keep bundle lean)
  let graph = { forward: {}, reverse: {} };
  try {
    const { readIntel } = require('./codebase-intel');
    const intel = readIntel(cwd);
    if (intel && intel.dependencies) {
      graph = intel.dependencies;
    } else if (intel) {
      const { buildDependencyGraph } = require('./deps');
      graph = buildDependencyGraph(intel);
    }
  } catch { /* fallback: empty graph, just task files */ }

  // Gather 1-hop candidates from dep graph
  const candidateSet = new Set(taskFiles);
  for (const tf of taskFiles) {
    for (const dep of (graph.forward[tf] || [])) candidateSet.add(dep);
    for (const dep of (graph.reverse[tf] || [])) candidateSet.add(dep);
  }

  // Score recent files
  let recentFiles = new Set();
  try {
    const { execGit } = require('./git');
    const result = execGit(cwd, ['log', '-10', '--name-only', '--pretty=format:', '--no-merges']);
    if (result.exitCode === 0) recentFiles = new Set(result.stdout.split('\n').filter(f => f.trim()));
  } catch { /* no git info */ }

  // Score all candidates
  const scored = [];
  for (const file of candidateSet) {
    const { score, reason } = scoreTaskFile(file, taskFiles, graph, planFiles, recentFiles);
    if (score >= 0.3) scored.push({ path: file, score, reason });
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Optionally add AST signatures
  if (includeSignatures) {
    try {
      const { extractSignatures } = require('./ast');
      const path = require('path');
      for (const entry of scored) {
        if (entry.score < 1.0) { // Skip full task files, signatures for context files only
          const result = extractSignatures(path.resolve(cwd, entry.path));
          if (result.signatures && result.signatures.length > 0) {
            entry.signatures = result.signatures.map(s => ({ name: s.name, type: s.type, params: s.params }));
          }
        }
      }
    } catch { /* AST not available */ }
  }

  // Enforce token budget — drop lowest-scored files first
  const allCandidates = scored.length;
  let tokenEstimate = estimateJsonTokens(scored);
  while (tokenEstimate > tokenBudget && scored.length > 1) {
    scored.pop(); // Remove lowest-scored
    tokenEstimate = estimateJsonTokens(scored);
  }

  const fullEstimate = allCandidates > scored.length
    ? Math.round(tokenEstimate * allCandidates / Math.max(scored.length, 1))
    : tokenEstimate;
  const reductionPct = fullEstimate > 0 ? Math.round((1 - tokenEstimate / fullEstimate) * 100) : 0;

  return {
    task_files: taskFiles,
    context_files: scored,
    stats: {
      candidates_found: allCandidates,
      files_included: scored.length,
      files_excluded: allCandidates - scored.length,
      token_estimate: tokenEstimate,
      reduction_pct: Math.max(reductionPct, 0),
    },
  };
}

module.exports = {
  estimateTokens, estimateJsonTokens, checkBudget, isWithinBudget,
  AGENT_MANIFESTS, scopeContextForAgent, compactPlanState, compactDepGraph,
  buildTaskContext,
};
