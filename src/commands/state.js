const fs = require('fs');
const path = require('path');
const { output, error, debugLog } = require('../lib/output');
const { loadConfig } = require('../lib/config');
const { safeReadFile, cachedReadFile, invalidateFileCache, normalizePhaseName, findPhaseInternal, getPhaseTree } = require('../lib/helpers');
const { execGit } = require('../lib/git');
const { banner, sectionHeader, formatTable, summaryLine, actionHint, color, SYMBOLS, progressBar, box } = require('../lib/format');
const { getDb } = require('../lib/db');
const { PlanningCache } = require('../lib/planning-cache');

// ─── Pre-compiled Regex Cache ────────────────────────────────────────────────
// Avoids repeated `new RegExp()` construction in hot paths like stateExtractField/stateReplaceField
const _fieldRegexCache = new Map();

function getFieldExtractRegex(fieldName) {
  const key = `extract:${fieldName}`;
  if (_fieldRegexCache.has(key)) return _fieldRegexCache.get(key);
  const pattern = new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*(.+)`, 'i');
  _fieldRegexCache.set(key, pattern);
  return pattern;
}

function getFieldReplaceRegex(fieldName) {
  const key = `replace:${fieldName}`;
  if (_fieldRegexCache.has(key)) return _fieldRegexCache.get(key);
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(\\*\\*${escaped}:\\*\\*\\s*)(.*)`, 'i');
  _fieldRegexCache.set(key, pattern);
  return pattern;
}

// ─── SQLite Helpers ──────────────────────────────────────────────────────────

/**
 * Get a PlanningCache instance for the given cwd.
 * @param {string} cwd
 * @returns {PlanningCache}
 */
function _getCache(cwd) {
  const db = getDb(cwd);
  return new PlanningCache(db);
}

/**
 * Check STATE.md mtime against file_cache — re-import if STATE.md was manually edited.
 * "STATE.md wins on conflict" per CONTEXT.md.
 *
 * @param {string} cwd
 * @param {PlanningCache} cache
 */
function _checkAndReimportState(cwd, cache) {
  if (cache._isMap()) return;

  try {
    const statePath = path.join(cwd, '.planning', 'STATE.md');
    const freshness = cache.checkFreshness(statePath);

    if (freshness === 'stale') {
      // STATE.md has been modified externally — re-import into SQLite
      const content = safeReadFile(statePath);
      if (content) {
        const parsed = _parseStateMdForMigration(content);
        // Force re-import by deleting existing session_state row first
        try {
          const db = getDb(cwd);
          db.prepare('DELETE FROM session_state WHERE cwd = ?').run(cwd);
        } catch { /* ignore */ }
        cache.migrateStateFromMarkdown(cwd, parsed);
        cache.updateMtime(statePath);
      }
    } else if (freshness === 'missing') {
      // No mtime record — check if session_state row exists
      const existing = cache.getSessionState(cwd);
      if (!existing) {
        // No SQLite data at all — do initial migration
        const content = safeReadFile(statePath);
        if (content) {
          const parsed = _parseStateMdForMigration(content);
          cache.migrateStateFromMarkdown(cwd, parsed);
          cache.updateMtime(statePath);
        }
      }
    }
  } catch { /* non-fatal — state commands fall back to regex */ }
}

/**
 * Parse STATE.md content into the structure expected by migrateStateFromMarkdown.
 * Extracts position, decisions, metrics, todos, blockers, and continuity.
 *
 * @param {string} content - Raw STATE.md content
 * @returns {object} Parsed state object
 */
function _parseStateMdForMigration(content) {
  const extractField = (fieldName) => {
    const pattern = new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*(.+)`, 'i');
    const match = content.match(pattern);
    return match ? match[1].trim() : null;
  };

  // Extract position
  const phaseRaw = extractField('Phase');
  let phase_number = null;
  let phase_name = null;
  let total_phases = null;
  if (phaseRaw) {
    // Format: "122 of 123 (Decision Rules) — COMPLETE"
    const phaseMatch = phaseRaw.match(/^(\d+(?:\.\d+)?)\s+of\s+(\d+)\s*(?:\(([^)]+)\))?/);
    if (phaseMatch) {
      phase_number = phaseMatch[1];
      total_phases = parseInt(phaseMatch[2], 10);
      phase_name = phaseMatch[3] || null;
    } else {
      phase_number = phaseRaw;
    }
  }

  const current_plan = extractField('Current Plan');
  const status = extractField('Status');
  const last_activity = extractField('Last Activity');

  // Extract progress
  const progressMatch = content.match(/\[[\u2588\u2591]+\]\s*(\d+)%/);
  const progress = progressMatch ? parseInt(progressMatch[1], 10) : null;

  // Extract milestone from Recent Trend or Performance Metrics section
  const milestoneMatch = content.match(/v[\d.]+/);
  const milestone = milestoneMatch ? milestoneMatch[0] : null;

  // Extract decisions (bullet list format: "- [Phase X]: summary — rationale")
  const decisions = [];
  const decisionsSectionMatch = content.match(/###?\s*(?:Decisions|Accumulated.*Decisions)\s*\n([\s\S]*?)(?=\n###?|\n##[^#]|$)/i);
  if (decisionsSectionMatch) {
    const lines = decisionsSectionMatch[1].split('\n');
    for (const line of lines) {
      const bulletMatch = line.match(/^-\s+\[([^\]]+)\]:\s*(.+)/);
      if (bulletMatch) {
        const phaseTag = bulletMatch[1];
        const rest = bulletMatch[2];
        const dashIdx = rest.indexOf(' — ');
        const summary = dashIdx !== -1 ? rest.slice(0, dashIdx).trim() : rest.trim();
        const rationale = dashIdx !== -1 ? rest.slice(dashIdx + 3).trim() : null;
        decisions.push({ phase: phaseTag, summary, rationale, timestamp: null, milestone: null });
      }
    }
  }

  // Extract metrics (Recent Trend bullet format: "- v12.0 Phase X Plan Y: Zm, N tasks, F files")
  const metrics = [];
  const trendMatch = content.match(/\*\*Recent Trend:\*\*\n([\s\S]*?)(?=\n\*\*|\n##|$)/i);
  if (trendMatch) {
    const lines = trendMatch[1].split('\n');
    for (const line of lines) {
      const metricMatch = line.match(/^-\s+(v[\d.]+)\s+Phase\s+(\S+)\s+Plan\s+(\S+):\s+(\S+),\s+(\d+)\s+tasks?,\s+(\d+)\s+files?/i);
      if (metricMatch) {
        metrics.push({
          milestone: metricMatch[1],
          phase: metricMatch[2],
          plan: metricMatch[3],
          duration: metricMatch[4],
          tasks: parseInt(metricMatch[5], 10),
          files: parseInt(metricMatch[6], 10),
          test_count: null,
          timestamp: null,
        });
      }
    }
  }

  // Extract todos
  const todos = [];
  const todosMatch = content.match(/###?\s*(?:Pending Todos|Todos|Open Todos)\s*\n([\s\S]*?)(?=\n###?|\n##[^#]|$)/i);
  if (todosMatch) {
    const lines = todosMatch[1].split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') && !/^none\.?$/i.test(trimmed.slice(2))) {
        todos.push({ text: trimmed.slice(2), status: 'pending', created_at: null });
      }
    }
  }

  // Extract blockers
  const blockers = [];
  const blockersMatch = content.match(/###?\s*(?:Blockers|Blockers\/Concerns|Concerns)\s*\n([\s\S]*?)(?=\n###?|\n##[^#]|$)/i);
  if (blockersMatch) {
    const lines = blockersMatch[1].split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') && !/^none\.?$/i.test(trimmed.slice(2))) {
        blockers.push({ text: trimmed.slice(2), status: 'open', created_at: null });
      }
    }
  }

  // Extract session continuity
  let continuity = null;
  const lastSessionRaw = extractField('Last session') || extractField('Last Date');
  const stoppedAt = extractField('Stopped at') || extractField('Stopped At');
  const nextStep = extractField('Next step') || extractField('Resume File');
  if (lastSessionRaw || stoppedAt || nextStep) {
    continuity = {
      last_session: lastSessionRaw,
      stopped_at: stoppedAt,
      next_step: nextStep,
    };
  }

  return {
    phase_number,
    phase_name,
    total_phases,
    current_plan,
    status,
    last_activity,
    progress,
    milestone,
    decisions,
    metrics,
    todos,
    blockers,
    continuity,
  };
}

/**
 * Generate STATE.md content from SQLite session data.
 * Reads all session tables and renders the canonical STATE.md format.
 *
 * @param {string} cwd
 * @param {PlanningCache} cache
 * @returns {string|null} Generated STATE.md content, or null if SQLite unavailable
 */
function generateStateMd(cwd, cache) {
  if (cache._isMap()) return null;

  try {
    const state = cache.getSessionState(cwd);
    if (!state) return null;

    const decisionsResult = cache.getSessionDecisions(cwd, { limit: 200 });
    const decisions = decisionsResult ? decisionsResult.entries : [];

    const metricsResult = cache.getSessionMetrics(cwd, { limit: 50 });
    const metrics = metricsResult ? metricsResult.entries : [];

    const todosResult = cache.getSessionTodos(cwd, { status: 'pending', limit: 100 });
    const todos = todosResult ? todosResult.entries : [];

    const blockersResult = cache.getSessionBlockers(cwd, { status: 'open', limit: 100 });
    const blockers = blockersResult ? blockersResult.entries : [];

    const continuity = cache.getSessionContinuity(cwd);

    const today = new Date().toISOString().split('T')[0];

    // ─── Build progress bar ─────────────────────────────────────────────────
    const progressPct = state.progress != null ? state.progress : 0;
    const barWidth = 10;
    const filled = Math.round(progressPct / 100 * barWidth);
    const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);
    const progressStr = `[${bar}] ${progressPct}%`;

    // ─── Build velocity section ─────────────────────────────────────────────
    const totalCompleted = metrics.length;
    const lastMetric = metrics.length > 0 ? metrics[0] : null;
    const lastMilestone = lastMetric ? (lastMetric.milestone || 'v1.0') : 'v1.0';
    const lastPhase = lastMetric ? lastMetric.phase : '?';
    const lastPlan = lastMetric ? lastMetric.plan : '?';

    let avgDuration = '-';
    if (metrics.length > 0) {
      const durationsMin = metrics
        .map(m => {
          const d = String(m.duration || '');
          const numMatch = d.match(/(\d+)/);
          return numMatch ? parseInt(numMatch[1], 10) : null;
        })
        .filter(n => n !== null);
      if (durationsMin.length > 0) {
        avgDuration = String(Math.round(durationsMin.reduce((a, b) => a + b, 0) / durationsMin.length));
      }
    }

    let totalHours = '-';
    if (metrics.length > 0) {
      const totalMin = metrics
        .map(m => {
          const d = String(m.duration || '');
          const numMatch = d.match(/(\d+)/);
          return numMatch ? parseInt(numMatch[1], 10) : 0;
        })
        .reduce((a, b) => a + b, 0);
      totalHours = String(Math.round(totalMin / 60 * 10) / 10);
    }

    // Recent trend (last 7-10 entries)
    const recentMetrics = metrics.slice(0, 10);
    const trendLines = recentMetrics.map(m => {
      const ms = m.milestone || 'v1.0';
      const ph = m.phase || '?';
      const pl = m.plan || '?';
      const dur = m.duration || '?';
      const tasks = m.tasks != null ? m.tasks : '-';
      const files = m.files != null ? m.files : '-';
      const testCount = m.test_count != null ? ` (${m.test_count} tests)` : '';
      return `- ${ms} Phase ${ph} Plan ${pl}: ${dur}, ${tasks} tasks, ${files} files${testCount}`;
    });

    // ─── Build decisions section ────────────────────────────────────────────
    let decisionsBlock;
    if (decisions.length === 0) {
      decisionsBlock = 'None.';
    } else {
      decisionsBlock = decisions
        .slice()
        .reverse() // oldest first
        .map(d => {
          const phaseTag = d.phase || '?';
          const summary = d.summary || '';
          const rationale = d.rationale ? ` — ${d.rationale}` : '';
          return `- [${phaseTag}]: ${summary}${rationale}`;
        })
        .join('\n');
    }

    // ─── Build todos section ────────────────────────────────────────────────
    const pendingTodos = todos.filter(t => t.status === 'pending' || !t.status);
    const todosBlock = pendingTodos.length === 0
      ? 'None.'
      : pendingTodos.map(t => `- ${t.text}`).join('\n');

    // ─── Build blockers section ─────────────────────────────────────────────
    const openBlockers = blockers.filter(b => b.status === 'open' || !b.status);
    const blockersBlock = openBlockers.length === 0
      ? 'None.'
      : openBlockers.map(b => `- ${b.text}`).join('\n');

    // ─── Build session continuity section ──────────────────────────────────
    const lastSession = continuity ? (continuity.last_session || today) : today;
    const stoppedAt = continuity ? (continuity.stopped_at || 'None') : 'None';
    const nextStep = continuity ? (continuity.next_step || 'None') : 'None';

    // ─── Assemble the full STATE.md ────────────────────────────────────────
    const phaseNum = state.phase_number || '?';
    const totalPhases = state.total_phases != null ? state.total_phases : '?';
    const phaseName = state.phase_name || '';
    const phaseStatus = state.status || '';
    const phaseField = `${phaseNum} of ${totalPhases}${phaseName ? ` (${phaseName})` : ''}${phaseStatus ? ` — ${phaseStatus}` : ''}`;

    const lines = [
      '# Project State',
      '',
      '## Project Reference',
      '',
      `See: \`.planning/PROJECT.md\` (updated ${today})`,
      '',
      '**Core value:** Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance',
      `**Current focus:** Phase ${phaseNum}${phaseName ? ` — ${phaseName}` : ''}`,
      '',
      '## Current Position',
      '',
      `**Phase:** ${phaseField}`,
      `**Current Plan:** ${state.current_plan || 'Not started'}`,
      `**Status:** ${state.status || ''}`,
      `**Last Activity:** ${state.last_activity || today}`,
      '',
      `Progress: ${progressStr}`,
      '',
      '## Performance Metrics',
      '',
      '**Velocity:**',
      `- Total plans completed: ${totalCompleted}${lastMetric ? ` (${lastMilestone} Phase ${lastPhase} Plan ${lastPlan})` : ''}`,
      `- Average duration: ~${avgDuration}min/plan`,
      `- Total execution time: ~${totalHours} hours`,
      '',
      '**Recent Trend:**',
    ];

    if (trendLines.length > 0) {
      lines.push(...trendLines);
    } else {
      lines.push('- No metrics yet');
    }

    lines.push('- Trend: Stable');
    lines.push('');
    lines.push('*Updated after each plan completion*');
    lines.push('');
    lines.push('## Accumulated Context');
    lines.push('');
    lines.push('### Decisions');
    lines.push('');
    lines.push(decisionsBlock);
    lines.push('');
    lines.push('### Roadmap Evolution');
    lines.push('');
    lines.push('- 6 phases (118-123) mapped from 21 requirements across 6 categories');
    lines.push('- Phase 121 (Memory Store) depends only on 118 — can potentially parallelize with 119/120');
    lines.push('');
    lines.push('### Pending Todos');
    lines.push('');
    lines.push(todosBlock);
    lines.push('');
    lines.push('### Blockers/Concerns');
    lines.push('');
    lines.push(blockersBlock);
    lines.push('');
    lines.push('## Session Continuity');
    lines.push('');
    lines.push(`**Last session:** ${lastSession}`);
    lines.push(`**Stopped at:** ${stoppedAt}`);
    lines.push(`**Next step:** ${nextStep}`);

    return lines.join('\n') + '\n';
  } catch (e) {
    debugLog('state.generateStateMd', 'failed to generate STATE.md from SQLite', e);
    return null;
  }
}

// ─── State Formatters ────────────────────────────────────────────────────────

/**
 * Formatter for state show — renders branded state card with config and file status.
 * @param {object} result - The state load result object
 * @returns {string}
 */
function formatStateShow(result) {
  const lines = [];
  const c = result.config || {};

  // 1. Branded banner
  lines.push(banner('State'));
  lines.push('');

  // 2. Configuration section
  lines.push(sectionHeader('Configuration'));
  const configItems = [
    ['model_profile', c.model_profile || 'default'],
    ['commit_docs', String(c.commit_docs ?? 'true')],
    ['branching_strategy', c.branching_strategy || 'none'],
    ['parallelization', String(c.parallelization ?? 'false')],
  ];
  for (const [key, val] of configItems) {
    lines.push(` ${color.dim(key + ':')} ${val}`);
  }
  lines.push('');

  // 3. Files section
  lines.push(sectionHeader('Files'));
  const fileChecks = [
    ['STATE.md', result.state_exists],
    ['ROADMAP.md', result.roadmap_exists],
    ['config.json', result.config_exists],
  ];
  for (const [name, exists] of fileChecks) {
    const icon = exists ? color.green(SYMBOLS.check) : color.red(SYMBOLS.cross);
    lines.push(` ${icon} ${name}`);
  }
  lines.push('');

  // 4. Summary
  lines.push(summaryLine('State loaded'));

  return lines.join('\n');
}

/**
 * Formatter for state update-progress — renders success box or warning.
 * @param {object} result - The update-progress result object
 * @returns {string}
 */
function formatStateUpdateProgress(result) {
  const lines = [];

  if (result.updated) {
    lines.push(box(`Progress updated: ${result.percent}%`, 'success'));
    lines.push('');
    lines.push(progressBar(result.percent));
    lines.push(` ${result.completed}/${result.total} plans`);
  } else {
    lines.push(box(result.reason || 'Update failed', 'warning'));
  }

  return lines.join('\n');
}

// ─── State Commands ──────────────────────────────────────────────────────────

function cmdStateLoad(cwd, raw) {
  const config = loadConfig(cwd);
  const planningDir = path.join(cwd, '.planning');

  // Auto-migrate existing STATE.md into SQLite on first access
  try {
    const cache = _getCache(cwd);
    if (!cache._isMap()) {
      _checkAndReimportState(cwd, cache);
    }
  } catch { /* non-fatal */ }

  const stateContent = cachedReadFile(path.join(planningDir, 'STATE.md'));
  const stateRaw = stateContent || '';
  const stateExists = stateRaw.length > 0;

  // Use try/catch on statSync instead of existsSync to avoid double syscalls
  let configExists = false;
  let roadmapExists = false;
  try { fs.statSync(path.join(planningDir, 'config.json')); configExists = true; } catch {}
  try { fs.statSync(path.join(planningDir, 'ROADMAP.md')); roadmapExists = true; } catch {}

  const result = {
    config,
    state_raw: stateRaw,
    state_exists: stateExists,
    roadmap_exists: roadmapExists,
    config_exists: configExists,
  };

  // Legacy rawValue: condensed key=value format for formatted/pretty mode
  const c = config;
  const rawLines = [
    `model_profile=${c.model_profile}`,
    `commit_docs=${c.commit_docs}`,
    `branching_strategy=${c.branching_strategy}`,
    `phase_branch_template=${c.phase_branch_template}`,
    `milestone_branch_template=${c.milestone_branch_template}`,
    `parallelization=${c.parallelization}`,
    `research=${c.research}`,
    `plan_checker=${c.plan_checker}`,
    `verifier=${c.verifier}`,
    `config_exists=${configExists}`,
    `roadmap_exists=${roadmapExists}`,
    `state_exists=${stateExists}`,
  ].join('\n');

  output(result, { formatter: formatStateShow, rawValue: rawLines });
}

function cmdStateGet(cwd, section, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  const content = cachedReadFile(statePath);
  if (!content) {
    error('STATE.md not found');
  }

  if (!section) {
    output({ content }, raw, content);
    return;
  }

  // Check for **field:** value (pre-compiled regex)
  const fieldMatch = content.match(getFieldReplaceRegex(section));
  if (fieldMatch) {
    const val = fieldMatch[2].trim();
    output({ [section]: val }, raw, val);
    return;
  }

  // Check for ## Section
  const fieldEscaped = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sectionPattern = new RegExp(`##\\s*${fieldEscaped}\\s*\n([\\s\\S]*?)(?=\\n##|$)`, 'i');
  const sectionMatch = content.match(sectionPattern);
  if (sectionMatch) {
    output({ [section]: sectionMatch[1].trim() }, raw, sectionMatch[1].trim());
    return;
  }

  output({ error: `Section or field "${section}" not found` }, raw, '');
}

function cmdStatePatch(cwd, patches, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');

  // SQL-first: write to SQLite, then patch STATE.md via regex (preserves format)
  try {
    const cache = _getCache(cwd);
    if (!cache._isMap()) {
      _checkAndReimportState(cwd, cache);
      const state = cache.getSessionState(cwd);
      if (state) {
        const fieldMap = {
          'status': 'status',
          'last activity': 'last_activity',
          'last_activity': 'last_activity',
          'current_plan': 'current_plan',
          'current plan': 'current_plan',
          'progress': 'progress',
          'phase': 'phase_number',
        };
        const updatedState = {
          phase_number: state.phase_number,
          phase_name: state.phase_name,
          total_phases: state.total_phases,
          current_plan: state.current_plan,
          status: state.status,
          last_activity: state.last_activity,
          progress: state.progress,
          milestone: state.milestone,
        };
        let anyMapped = false;
        for (const [field, value] of Object.entries(patches)) {
          const col = fieldMap[field.toLowerCase()];
          if (col) {
            updatedState[col] = value;
            anyMapped = true;
          }
        }
        if (anyMapped) {
          cache.storeSessionState(cwd, updatedState);
        }
        // Fall through to regex path to update STATE.md
      }
    }
  } catch { /* non-fatal */ }

  let content = cachedReadFile(statePath);
  if (!content) {
    error('STATE.md not found');
  }

  const results = { updated: [], failed: [] };

  for (const [field, value] of Object.entries(patches)) {
    const pattern = getFieldReplaceRegex(field);
    if (pattern.test(content)) {
      content = content.replace(pattern, `$1${value}`);
      results.updated.push(field);
    } else {
      results.failed.push(field);
    }
  }

  if (results.updated.length > 0) {
    fs.writeFileSync(statePath, content, 'utf-8');
    invalidateFileCache(statePath);
    try { _getCache(cwd).updateMtime(statePath); } catch {}
  }

  output(results, raw, results.updated.length > 0 ? 'true' : 'false');
}

function cmdStateUpdate(cwd, field, value) {
  if (!field || value === undefined) {
    error('field and value required for state update');
  }

  const statePath = path.join(cwd, '.planning', 'STATE.md');

  // SQL-first: write to SQLite, then update STATE.md via regex (preserves format)
  try {
    const cache = _getCache(cwd);
    if (!cache._isMap()) {
      _checkAndReimportState(cwd, cache);
      const state = cache.getSessionState(cwd);
      if (state) {
        // Map field name to session_state column
        const fieldLower = field.toLowerCase();
        const fieldMap = {
          'status': 'status',
          'last activity': 'last_activity',
          'last_activity': 'last_activity',
          'current plan': 'current_plan',
          'current_plan': 'current_plan',
          'phase': 'phase_number',
          'progress': 'progress',
        };
        const col = fieldMap[fieldLower];
        if (col) {
          const updatedState = {
            phase_number: state.phase_number,
            phase_name: state.phase_name,
            total_phases: state.total_phases,
            current_plan: state.current_plan,
            status: state.status,
            last_activity: state.last_activity,
            progress: state.progress,
            milestone: state.milestone,
          };
          updatedState[col] = value;
          cache.storeSessionState(cwd, updatedState);
        }
        // Always fall through to regex to update STATE.md format correctly
      }
    }
  } catch { /* non-fatal — fall through */ }

  let content = cachedReadFile(statePath);
  if (!content) {
    output({ updated: false, reason: 'STATE.md not found' });
    return;
  }

  const pattern = getFieldReplaceRegex(field);
  if (pattern.test(content)) {
    content = content.replace(pattern, `$1${value}`);
    fs.writeFileSync(statePath, content, 'utf-8');
    invalidateFileCache(statePath);
    try { _getCache(cwd).updateMtime(statePath); } catch {}
    output({ updated: true });
  } else {
    output({ updated: false, reason: `Field "${field}" not found in STATE.md` });
  }
}

// ─── State Progression Engine ────────────────────────────────────────────────

function stateExtractField(content, fieldName) {
  const pattern = getFieldExtractRegex(fieldName);
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}

function stateReplaceField(content, fieldName, newValue) {
  const pattern = getFieldReplaceRegex(fieldName);
  if (pattern.test(content)) {
    return content.replace(pattern, `$1${newValue}`);
  }
  return null;
}

function cmdStateAdvancePlan(cwd, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  const today = new Date().toISOString().split('T')[0];

  let content = cachedReadFile(statePath);
  if (!content) { output({ error: 'STATE.md not found' }, raw); return; }
  const currentPlan = parseInt(stateExtractField(content, 'Current Plan'), 10);
  const totalPlans = parseInt(stateExtractField(content, 'Total Plans in Phase'), 10);

  if (isNaN(currentPlan) || isNaN(totalPlans)) {
    output({ error: 'Cannot parse Current Plan or Total Plans in Phase from STATE.md' }, raw);
    return;
  }

  let advanced, resultObj;
  if (currentPlan >= totalPlans) {
    content = stateReplaceField(content, 'Status', 'Phase complete — ready for verification') || content;
    content = stateReplaceField(content, 'Last Activity', today) || content;
    advanced = false;
    resultObj = { advanced: false, reason: 'last_plan', current_plan: currentPlan, total_plans: totalPlans, status: 'ready_for_verification' };
  } else {
    const newPlan = currentPlan + 1;
    content = stateReplaceField(content, 'Current Plan', String(newPlan)) || content;
    content = stateReplaceField(content, 'Status', 'Ready to execute') || content;
    content = stateReplaceField(content, 'Last Activity', today) || content;
    advanced = true;
    resultObj = { advanced: true, previous_plan: currentPlan, current_plan: newPlan, total_plans: totalPlans };
  }

  fs.writeFileSync(statePath, content, 'utf-8');
  invalidateFileCache(statePath);

  // SQL-first: also update SQLite session state
  try {
    const cache = _getCache(cwd);
    if (!cache._isMap()) {
      _checkAndReimportState(cwd, cache);
      const state = cache.getSessionState(cwd);
      if (state) {
        const updatedState = {
          ...state,
          current_plan: advanced ? String(resultObj.current_plan) : String(currentPlan),
          status: advanced ? 'Ready to execute' : 'Phase complete — ready for verification',
          last_activity: today,
        };
        cache.storeSessionState(cwd, updatedState);
        cache.updateMtime(statePath);
      }
    }
  } catch { /* non-fatal */ }

  output(resultObj, raw, advanced ? 'true' : 'false');
}

function cmdStateRecordMetric(cwd, options, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  const { phase, plan, duration, tasks, files } = options;

  if (!phase || !plan || !duration) {
    output({ error: 'phase, plan, and duration required' }, raw);
    return;
  }

  // SQL-first: write metric to SQLite
  try {
    const cache = _getCache(cwd);
    if (!cache._isMap()) {
      _checkAndReimportState(cwd, cache);
      const metric = {
        phase: String(phase),
        plan: String(plan),
        duration: String(duration),
        tasks: tasks != null ? parseInt(tasks, 10) : null,
        files: files != null ? parseInt(files, 10) : null,
        timestamp: new Date().toISOString(),
      };
      cache.writeSessionMetric(cwd, metric);
      // Fall through to regex path to also update STATE.md
    }
  } catch { /* non-fatal */ }

  let content = cachedReadFile(statePath);
  if (!content) { output({ error: 'STATE.md not found' }, raw); return; }

  // Find Performance Metrics section and its table
  const metricsPattern = /(##\s*Performance Metrics[\s\S]*?\n\|[^\n]+\n\|[-|\s]+\n)([\s\S]*?)(?=\n##|\n$|$)/i;
  const metricsMatch = content.match(metricsPattern);

  if (metricsMatch) {
    const tableHeader = metricsMatch[1];
    let tableBody = metricsMatch[2].trimEnd();
    const newRow = `| Phase ${phase} P${plan} | ${duration} | ${tasks || '-'} tasks | ${files || '-'} files |`;

    if (tableBody.trim() === '' || tableBody.includes('None yet')) {
      tableBody = newRow;
    } else {
      tableBody = tableBody + '\n' + newRow;
    }

    content = content.replace(metricsPattern, `${tableHeader}${tableBody}\n`);
    fs.writeFileSync(statePath, content, 'utf-8');
    invalidateFileCache(statePath);
    try { _getCache(cwd).updateMtime(statePath); } catch {}
    output({ recorded: true, phase, plan, duration }, raw, 'true');
  } else {
    output({ recorded: false, reason: 'Performance Metrics section not found in STATE.md' }, raw, 'false');
  }
}

function cmdStateUpdateProgress(cwd, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');

  // Count summaries across all phases — use cached phase tree
  let totalPlans = 0;
  let totalSummaries = 0;

  const phaseTree = getPhaseTree(cwd);
  for (const [, entry] of phaseTree) {
    totalPlans += entry.plans.length;
    totalSummaries += entry.summaries.length;
  }

  const percent = totalPlans > 0 ? Math.round(totalSummaries / totalPlans * 100) : 0;
  const barWidth = 10;
  const filled = Math.round(percent / 100 * barWidth);
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);
  const progressStr = `[${bar}] ${percent}%`;

  // SQL-first: update progress in SQLite
  try {
    const cache = _getCache(cwd);
    if (!cache._isMap()) {
      _checkAndReimportState(cwd, cache);
      const state = cache.getSessionState(cwd);
      if (state) {
        cache.storeSessionState(cwd, { ...state, progress: percent });
        // Fall through to regex path
      }
    }
  } catch { /* non-fatal */ }

  let content = cachedReadFile(statePath);
  if (!content) { output({ error: 'STATE.md not found' }, raw); return; }

  // Handle both **Progress:** and Progress: bar-only formats
  const progressFieldPattern = /(\*\*Progress:\*\*\s*).*/i;
  const progressBarPattern = /(Progress:\s*)\[[\u2588\u2591]+\]\s*\d+%/;

  if (progressFieldPattern.test(content)) {
    content = content.replace(progressFieldPattern, `$1${progressStr}`);
    fs.writeFileSync(statePath, content, 'utf-8');
    invalidateFileCache(statePath);
    try { _getCache(cwd).updateMtime(statePath); } catch {}
    output({ updated: true, percent, completed: totalSummaries, total: totalPlans, bar: progressStr }, { formatter: formatStateUpdateProgress, rawValue: progressStr });
  } else if (progressBarPattern.test(content)) {
    content = content.replace(progressBarPattern, `$1${progressStr}`);
    fs.writeFileSync(statePath, content, 'utf-8');
    invalidateFileCache(statePath);
    try { _getCache(cwd).updateMtime(statePath); } catch {}
    output({ updated: true, percent, completed: totalSummaries, total: totalPlans, bar: progressStr }, { formatter: formatStateUpdateProgress, rawValue: progressStr });
  } else {
    output({ updated: false, reason: 'Progress field not found in STATE.md' }, { formatter: formatStateUpdateProgress, rawValue: 'false' });
  }
}

function cmdStateAddDecision(cwd, options, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  const { phase, summary, rationale } = options;
  if (!summary) { output({ error: 'summary required' }, raw); return; }
  const entry = `- [Phase ${phase || '?'}]: ${summary}${rationale ? ` — ${rationale}` : ''}`;

  // SQL-first: write decision to SQLite
  try {
    const cache = _getCache(cwd);
    if (!cache._isMap()) {
      _checkAndReimportState(cwd, cache);
      const decision = {
        phase: phase ? `Phase ${phase}` : null,
        summary,
        rationale: rationale || null,
        timestamp: new Date().toISOString(),
        milestone: null,
      };
      cache.writeSessionDecision(cwd, decision);
      // Fall through to regex path to update STATE.md
    }
  } catch { /* non-fatal */ }

  let content = cachedReadFile(statePath);
  if (!content) { output({ error: 'STATE.md not found' }, raw); return; }

  // Find Decisions section (various heading patterns)
  const sectionPattern = /(###?\s*(?:Decisions|Decisions Made|Accumulated.*Decisions)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
  const match = content.match(sectionPattern);

  if (match) {
    let sectionBody = match[2];
    // Remove placeholders
    sectionBody = sectionBody.replace(/None yet\.?\s*\n?/gi, '').replace(/No decisions yet\.?\s*\n?/gi, '');
    sectionBody = sectionBody.trimEnd() + '\n' + entry + '\n';
    content = content.replace(sectionPattern, `${match[1]}${sectionBody}`);
    fs.writeFileSync(statePath, content, 'utf-8');
    invalidateFileCache(statePath);
    try { _getCache(cwd).updateMtime(statePath); } catch {}
    output({ added: true, decision: entry }, raw, 'true');
  } else {
    output({ added: false, reason: 'Decisions section not found in STATE.md' }, raw, 'false');
  }
}

function cmdStateAddBlocker(cwd, text, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (!text) { output({ error: 'text required' }, raw); return; }

  // SQL-first: write blocker to SQLite
  try {
    const cache = _getCache(cwd);
    if (!cache._isMap()) {
      _checkAndReimportState(cwd, cache);
      const blocker = {
        text,
        status: 'open',
        created_at: new Date().toISOString(),
      };
      cache.writeSessionBlocker(cwd, blocker);
      // Fall through to regex path to update STATE.md
    }
  } catch { /* non-fatal */ }

  let content = cachedReadFile(statePath);
  if (!content) { output({ error: 'STATE.md not found' }, raw); return; }
  const entry = `- ${text}`;

  const sectionPattern = /(###?\s*(?:Blockers|Blockers\/Concerns|Concerns)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
  const match = content.match(sectionPattern);

  if (match) {
    let sectionBody = match[2];
    sectionBody = sectionBody.replace(/None\.?\s*\n?/gi, '').replace(/None yet\.?\s*\n?/gi, '');
    sectionBody = sectionBody.trimEnd() + '\n' + entry + '\n';
    content = content.replace(sectionPattern, `${match[1]}${sectionBody}`);
    fs.writeFileSync(statePath, content, 'utf-8');
    invalidateFileCache(statePath);
    try { _getCache(cwd).updateMtime(statePath); } catch {}
    output({ added: true, blocker: text }, raw, 'true');
  } else {
    output({ added: false, reason: 'Blockers section not found in STATE.md' }, raw, 'false');
  }
}

function cmdStateResolveBlocker(cwd, text, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (!text) { output({ error: 'text required' }, raw); return; }

  // SQL-first: resolve blocker in SQLite
  try {
    const cache = _getCache(cwd);
    if (!cache._isMap()) {
      _checkAndReimportState(cwd, cache);
      // Find blocker by text match in SQLite
      const blockersResult = cache.getSessionBlockers(cwd, { status: 'open', limit: 100 });
      const blockers = blockersResult ? blockersResult.entries : [];
      const blocker = blockers.find(b => b.text && b.text.toLowerCase().includes(text.toLowerCase()));
      if (blocker && blocker._id != null) {
        cache.resolveSessionBlocker(cwd, blocker._id, 'Resolved');
      }
      // Fall through to regex path to update STATE.md
    }
  } catch { /* non-fatal */ }

  let content = cachedReadFile(statePath);
  if (!content) { output({ error: 'STATE.md not found' }, raw); return; }

  const sectionPattern = /(###?\s*(?:Blockers|Blockers\/Concerns|Concerns)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
  const match = content.match(sectionPattern);

  if (match) {
    const sectionBody = match[2];
    const lines = sectionBody.split('\n');
    const filtered = lines.filter(line => {
      if (!line.startsWith('- ')) return true;
      return !line.toLowerCase().includes(text.toLowerCase());
    });

    let newBody = filtered.join('\n');
    // If section is now empty, add placeholder
    if (!newBody.trim() || !newBody.includes('- ')) {
      newBody = 'None\n';
    }

    content = content.replace(sectionPattern, `${match[1]}${newBody}`);
    fs.writeFileSync(statePath, content, 'utf-8');
    invalidateFileCache(statePath);
    try { _getCache(cwd).updateMtime(statePath); } catch {}
    output({ resolved: true, blocker: text }, raw, 'true');
  } else {
    output({ resolved: false, reason: 'Blockers section not found in STATE.md' }, raw, 'false');
  }
}

function cmdStateRecordSession(cwd, options, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  const now = new Date().toISOString();

  // SQL-first: record session continuity in SQLite
  try {
    const cache = _getCache(cwd);
    if (!cache._isMap()) {
      _checkAndReimportState(cwd, cache);
      const continuity = {
        last_session: now,
        stopped_at: options.stopped_at || null,
        next_step: options.resume_file || 'None',
      };
      cache.recordSessionContinuity(cwd, continuity);
      // Fall through to regex path to update STATE.md
    }
  } catch { /* non-fatal */ }

  let content = cachedReadFile(statePath);
  if (!content) { output({ error: 'STATE.md not found' }, raw); return; }
  const updated = [];

  // Update Last session / Last Date
  let result = stateReplaceField(content, 'Last session', now);
  if (result) { content = result; updated.push('Last session'); }
  result = stateReplaceField(content, 'Last Date', now);
  if (result) { content = result; updated.push('Last Date'); }

  // Update Stopped at
  if (options.stopped_at) {
    result = stateReplaceField(content, 'Stopped At', options.stopped_at);
    if (!result) result = stateReplaceField(content, 'Stopped at', options.stopped_at);
    if (result) { content = result; updated.push('Stopped At'); }
  }

  // Update Resume file
  const resumeFile = options.resume_file || 'None';
  result = stateReplaceField(content, 'Resume File', resumeFile);
  if (!result) result = stateReplaceField(content, 'Resume file', resumeFile);
  if (result) { content = result; updated.push('Resume File'); }

  if (updated.length > 0) {
    fs.writeFileSync(statePath, content, 'utf-8');
    invalidateFileCache(statePath);
    try { _getCache(cwd).updateMtime(statePath); } catch {}
    output({ recorded: true, updated }, raw, 'true');
  } else {
    output({ recorded: false, reason: 'No session fields found in STATE.md' }, raw, 'false');
  }
}

// ─── State Validation Engine ─────────────────────────────────────────────────

function cmdStateValidate(cwd, options, raw) {
  const planningDir = path.join(cwd, '.planning');
  const roadmapPath = path.join(planningDir, 'ROADMAP.md');
  const statePath = path.join(planningDir, 'STATE.md');
  const phasesDir = path.join(planningDir, 'phases');

  const issues = [];
  const fixesApplied = [];

  const roadmapContent = safeReadFile(roadmapPath);
  const stateContent = safeReadFile(statePath);

  if (!roadmapContent && !stateContent) {
    output({
      status: 'errors',
      issues: [{ type: 'missing_files', location: '.planning/', expected: 'ROADMAP.md and STATE.md', actual: 'Neither found', severity: 'error' }],
      fixes_applied: [],
      summary: 'Found 1 error and 0 warnings',
    }, raw);
    return;
  }

  // ─── Check 1: Plan count drift (SVAL-01) ────────────────────────────────
  if (roadmapContent) {
    const phasePattern = /#{2,4}\s*Phase\s+(\d+(?:\.\d+)?)\s*:\s*([^\n]+)/gi;
    let phaseMatch;

    while ((phaseMatch = phasePattern.exec(roadmapContent)) !== null) {
      const phaseNum = phaseMatch[1];
      const normalized = normalizePhaseName(phaseNum);

      // Find the phase section to extract plan count claims
      const sectionStart = phaseMatch.index;
      const restOfContent = roadmapContent.slice(sectionStart);
      const nextHeader = restOfContent.match(/\n#{2,4}\s+Phase\s+\d/i);
      const sectionEnd = nextHeader ? sectionStart + nextHeader.index : roadmapContent.length;
      const section = roadmapContent.slice(sectionStart, sectionEnd);

      // Extract claimed plan count from "**Plans:** N/M plans" or "**Plans:** N plans"
      const plansMatch = section.match(/\*\*Plans:?\*\*:?\s*(?:(\d+)\/)?(\d+)\s*plan/i);
      const claimedPlanCount = plansMatch ? parseInt(plansMatch[2], 10) : null;
      const claimedSummaryCount = plansMatch && plansMatch[1] ? parseInt(plansMatch[1], 10) : null;

      // Count actual files on disk — use cached phase tree
      let diskPlanCount = 0;
      let diskSummaryCount = 0;
      let phaseDirName = null;

      const phaseTree = getPhaseTree(cwd);
      const cachedPhase = phaseTree.get(normalized);
      if (cachedPhase) {
        phaseDirName = cachedPhase.dirName;
        diskPlanCount = cachedPhase.plans.length;
        diskSummaryCount = cachedPhase.summaries.length;
      }

      // Compare plan count
      if (claimedPlanCount !== null && claimedPlanCount !== diskPlanCount && phaseDirName) {
        issues.push({
          type: 'plan_count_drift',
          location: `ROADMAP.md Phase ${phaseNum}`,
          expected: `${diskPlanCount} plans on disk`,
          actual: `ROADMAP claims ${claimedPlanCount} plans`,
          severity: 'error',
        });

        // Auto-fix if requested
        if (options.fix) {
          try {
            let updatedRoadmap = safeReadFile(roadmapPath) || roadmapContent;
            const phaseEscaped = phaseNum.replace(/\./g, '\\.');

            // Fix plan count in "**Plans:** X/Y plans" or "**Plans:** Y plans"
            const fixPattern = new RegExp(
              `(#{2,4}\\s*Phase\\s+${phaseEscaped}[\\s\\S]*?\\*\\*Plans:?\\*\\*:?\\s*)(?:\\d+\\/)?\\d+(\\s*plan)`,
              'i'
            );
            const fixMatch = updatedRoadmap.match(fixPattern);
            if (fixMatch) {
              const newText = claimedSummaryCount !== null
                ? `${fixMatch[1]}${diskSummaryCount}/${diskPlanCount}${fixMatch[2]}`
                : `${fixMatch[1]}${diskPlanCount}${fixMatch[2]}`;
              updatedRoadmap = updatedRoadmap.replace(fixPattern, newText);
              fs.writeFileSync(roadmapPath, updatedRoadmap, 'utf-8');

              // Auto-commit the fix
              execGit(cwd, ['add', roadmapPath]);
              execGit(cwd, ['commit', '-m', `fix(state): correct phase ${phaseNum} plan count ${claimedPlanCount} → ${diskPlanCount}`]);

              fixesApplied.push({
                phase: phaseNum,
                field: 'plan_count',
                old: String(claimedPlanCount),
                new: String(diskPlanCount),
              });
            }
          } catch (e) { debugLog('state.validate', 'auto-fix failed for phase ' + phaseNum, e); }
        }
      }

      // Compare completion status: checkbox checked but not all summaries present
      if (phaseDirName && diskPlanCount > 0) {
        const checkboxPattern = new RegExp(`-\\s*\\[x\\]\\s*.*Phase\\s+${phaseNum.replace(/\./g, '\\.')}`, 'i');
        const isMarkedComplete = checkboxPattern.test(roadmapContent);

        if (isMarkedComplete && diskSummaryCount < diskPlanCount) {
          issues.push({
            type: 'completion_drift',
            location: `ROADMAP.md Phase ${phaseNum}`,
            expected: `${diskPlanCount} summaries for completion`,
            actual: `${diskSummaryCount} summaries on disk`,
            severity: 'error',
          });
        }
      }
    }
  }

  // ─── Check 2: Position validation (SVAL-02) ─────────────────────────────
  if (stateContent) {
    const phaseFieldMatch = stateContent.match(/\*\*Phase:\*\*\s*(\d+(?:\.\d+)?)\s+of\s+(\d+)/i);
    if (phaseFieldMatch) {
      const currentPhaseNum = phaseFieldMatch[1];
      const phaseInfo = findPhaseInternal(cwd, currentPhaseNum);

      if (!phaseInfo) {
        issues.push({
          type: 'position_missing',
          location: 'STATE.md Phase field',
          expected: `Phase ${currentPhaseNum} directory exists`,
          actual: 'Phase directory not found',
          severity: 'error',
        });
      } else if (phaseInfo.plans.length > 0 && phaseInfo.summaries.length >= phaseInfo.plans.length) {
        issues.push({
          type: 'position_completed',
          location: 'STATE.md Phase field',
          expected: 'Active phase with incomplete plans',
          actual: `Phase ${currentPhaseNum} is fully complete (${phaseInfo.summaries.length}/${phaseInfo.plans.length})`,
          severity: 'warn',
        });
      }
    }
  }

  // ─── Check 3: Activity staleness (SVAL-03) ──────────────────────────────
  if (stateContent) {
    const activityMatch = stateContent.match(/\*\*Last Activity:\*\*\s*(\S+)/i);
    if (activityMatch) {
      const declaredDate = activityMatch[1];
      const declaredTime = new Date(declaredDate).getTime();

      // Get most recent .planning/ commit date
      const gitResult = execGit(cwd, ['log', '-1', '--format=%ci', '--', '.planning/']);
      if (gitResult.exitCode === 0 && gitResult.stdout) {
        const gitDate = gitResult.stdout.split(' ')[0]; // Extract YYYY-MM-DD from git date
        const gitTime = new Date(gitDate).getTime();

        // Stale if declared timestamp is >24 hours older than most recent git commit
        const dayMs = 24 * 60 * 60 * 1000;
        if (!isNaN(declaredTime) && !isNaN(gitTime) && (gitTime - declaredTime) > dayMs) {
          issues.push({
            type: 'activity_stale',
            location: 'STATE.md Last Activity',
            expected: `Recent date near ${gitDate}`,
            actual: `Declared ${declaredDate}`,
            severity: 'warn',
          });
        }
      }
    }
  }

  // ─── Check 5: Blocker/todo staleness (SVAL-05) ──────────────────────────
  if (stateContent) {
    const config = loadConfig(cwd);
    const stalenessThreshold = config.staleness_threshold || 2;

    // Count completed plans across all phases — use cached phase tree
    let totalCompletedPlans = 0;
    const phaseTreeForBlockers = getPhaseTree(cwd);
    for (const [, entry] of phaseTreeForBlockers) {
      totalCompletedPlans += entry.summaries.length;
    }

    // Check blockers section
    const blockerSection = stateContent.match(/###?\s*(?:Blockers|Blockers\/Concerns|Concerns)\s*\n([\s\S]*?)(?=\n###?|\n##[^#]|$)/i);
    if (blockerSection) {
      const blockerBody = blockerSection[1].trim();
      if (blockerBody && !/^none\.?$/i.test(blockerBody) && !/^none yet\.?$/i.test(blockerBody)) {
        const blockerLines = blockerBody.split('\n').filter(l => l.startsWith('- '));
        if (blockerLines.length > 0 && totalCompletedPlans >= stalenessThreshold) {
          for (const line of blockerLines) {
            issues.push({
              type: 'stale_blocker',
              location: 'STATE.md Blockers',
              expected: `Resolved within ${stalenessThreshold} completed plans`,
              actual: `"${line.slice(2).trim()}" still open after ${totalCompletedPlans} completed plans`,
              severity: 'warn',
            });
          }
        }
      }
    }

    // Check pending todos section
    const todoSection = stateContent.match(/###?\s*(?:Pending Todos|Todos|Open Todos)\s*\n([\s\S]*?)(?=\n###?|\n##[^#]|$)/i);
    if (todoSection) {
      const todoBody = todoSection[1].trim();
      if (todoBody && !/^none\.?$/i.test(todoBody) && !/^none yet\.?$/i.test(todoBody)) {
        const todoLines = todoBody.split('\n').filter(l => l.startsWith('- '));
        if (todoLines.length > 0 && totalCompletedPlans >= stalenessThreshold) {
          for (const line of todoLines) {
            issues.push({
              type: 'stale_todo',
              location: 'STATE.md Pending Todos',
              expected: `Resolved within ${stalenessThreshold} completed plans`,
              actual: `"${line.slice(2).trim()}" still open after ${totalCompletedPlans} completed plans`,
              severity: 'warn',
            });
          }
        }
      }
    }
  }

  // ─── Build result ───────────────────────────────────────────────────────
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warnCount = issues.filter(i => i.severity === 'warn').length;

  let status = 'clean';
  if (errorCount > 0) status = 'errors';
  else if (warnCount > 0) status = 'warnings';

  const summary = status === 'clean'
    ? 'State validation passed — no issues found'
    : `Found ${errorCount} error${errorCount !== 1 ? 's' : ''} and ${warnCount} warning${warnCount !== 1 ? 's' : ''}`;

  output({
    status,
    issues,
    fixes_applied: fixesApplied,
    summary,
  }, raw);
}

/**
 * Regenerate STATE.md from SQLite data.
 * Exported for use by bgsd-progress.js and CLI subcommand.
 *
 * @param {string} cwd
 */
function cmdStateRegenerate(cwd, raw) {
  try {
    const cache = _getCache(cwd);
    if (cache._isMap()) {
      output({ regenerated: false, reason: 'SQLite not available' }, raw, 'false');
      return;
    }
    const statePath = path.join(cwd, '.planning', 'STATE.md');
    const generated = generateStateMd(cwd, cache);
    if (generated) {
      fs.writeFileSync(statePath, generated, 'utf-8');
      invalidateFileCache(statePath);
      cache.updateMtime(statePath);
      output({ regenerated: true }, raw, 'true');
    } else {
      output({ regenerated: false, reason: 'No session data in SQLite' }, raw, 'false');
    }
  } catch (e) {
    output({ regenerated: false, reason: e.message }, raw, 'false');
  }
}

module.exports = {
  cmdStateLoad,
  cmdStateGet,
  cmdStatePatch,
  cmdStateUpdate,
  cmdStateAdvancePlan,
  cmdStateRecordMetric,
  cmdStateUpdateProgress,
  cmdStateAddDecision,
  cmdStateAddBlocker,
  cmdStateResolveBlocker,
  cmdStateRecordSession,
  cmdStateValidate,
  cmdStateRegenerate,
  generateStateMd,
  _getCache,
  _checkAndReimportState,
};
