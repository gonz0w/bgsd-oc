const path = require('path');

const { getDb } = require('./db');
const { cachedReadFile, invalidateFileCache } = require('./helpers');
const { PlanningCache } = require('./planning-cache');
const { withProjectLock } = require('./project-lock');
const { writeFileAtomic } = require('./atomic-write');
const { SACRED_STORES } = require('../commands/memory');

// Sacred data boundary: decisions, lessons, trajectories, requirements
// These always use the canonical single-write path and are NEVER batched.
const SACRED_DATA_STORES = new Set(['decisions', 'lessons', 'trajectories', 'requirements']);

/**
 * Check if a store can be batched.
 * Sacred stores (decisions, lessons, trajectories, requirements) return false.
 * @param {string} store
 * @returns {boolean} true if store can be batched, false if sacred
 */
function canBatch(store) {
  return !SACRED_DATA_STORES.has(store);
}

const DECISIONS_SECTION_PATTERN = /(###?\s*(?:Decisions|Decisions Made|Accumulated.*Decisions)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
const BLOCKERS_SECTION_PATTERN = /(###?\s*(?:Blockers|Blockers\/Concerns|Concerns)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;

function getFieldExtractRegex(fieldName) {
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:\\*\\*${escaped}:\\*\\*|${escaped}:)\\s*(.+)`, 'i');
}

function getFieldReplaceRegex(fieldName) {
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`((?:\\*\\*${escaped}:\\*\\*|${escaped}:)\\s*)(.*)`, 'i');
}

function extractField(content, fieldName) {
  const match = content.match(getFieldExtractRegex(fieldName));
  return match ? match[1].trim() : null;
}

function replaceField(content, fieldName, value) {
  const pattern = getFieldReplaceRegex(fieldName);
  if (!pattern.test(content)) return null;
  return content.replace(pattern, `$1${value}`);
}

function parsePhaseDisplay(value) {
  if (!value) return {};
  const match = value.match(/^(\d+(?:\.\d+)?)\s+of\s+(\d+)\s*(?:\(([^)]+)\))?/);
  if (!match) {
    return { phase_number: value };
  }
  return {
    phase_number: match[1],
    total_phases: parseInt(match[2], 10),
    phase_name: match[3] || null,
  };
}

function parseStateMarkdown(content) {
  const decisions = [];
  const blockers = [];
  const decisionsMatch = content.match(DECISIONS_SECTION_PATTERN);
  if (decisionsMatch) {
    for (const line of decisionsMatch[2].split('\n')) {
      const bulletMatch = line.match(/^\s*-\s+\[([^\]]+)\]:\s*(.+)$/);
      if (!bulletMatch) continue;
      const rest = bulletMatch[2];
      const dashIdx = rest.indexOf(' — ');
      decisions.push({
        phase: bulletMatch[1],
        summary: dashIdx === -1 ? rest.trim() : rest.slice(0, dashIdx).trim(),
        rationale: dashIdx === -1 ? null : rest.slice(dashIdx + 3).trim(),
        timestamp: null,
        milestone: null,
      });
    }
  }

  const blockersMatch = content.match(BLOCKERS_SECTION_PATTERN);
  if (blockersMatch) {
    for (const line of blockersMatch[2].split('\n')) {
      const bulletMatch = line.match(/^\s*-\s+(.+)$/);
      if (!bulletMatch) continue;
      const text = bulletMatch[1].trim();
      if (/^none(?: yet)?\.?$/i.test(text)) continue;
      blockers.push({ text, status: 'open', created_at: null });
    }
  }

  const progressMatch = content.match(/\[[\u2588\u2591]+\]\s*(\d+)%/);
  const phaseDisplay = extractField(content, 'Phase');
  const phaseParts = parsePhaseDisplay(phaseDisplay);

  return {
    state: {
      phase_number: phaseParts.phase_number || null,
      phase_name: phaseParts.phase_name || null,
      total_phases: phaseParts.total_phases || null,
      phase_display: phaseDisplay,
      current_focus: extractField(content, 'Current focus'),
      current_plan: extractField(content, 'Current Plan'),
      total_plans_in_phase: extractField(content, 'Total Plans in Phase'),
      status: extractField(content, 'Status'),
      last_activity: extractField(content, 'Last Activity'),
      progress: progressMatch ? parseInt(progressMatch[1], 10) : null,
      milestone: null,
    },
    decisions,
    blockers,
    continuity: {
      last_session: extractField(content, 'Last session') || extractField(content, 'Last Date'),
      stopped_at: extractField(content, 'Stopped at') || extractField(content, 'Stopped At'),
      next_step: extractField(content, 'Resume file') || extractField(content, 'Resume File') || extractField(content, 'Next step'),
    },
  };
}

function buildCache(cwd) {
  return new PlanningCache(getDb(cwd));
}

function loadCanonicalModel(cwd, content, cache) {
  const parsed = parseStateMarkdown(content);
  const state = cache && !cache._isMap() ? cache.getSessionState(cwd) : null;
  const decisionsResult = cache && !cache._isMap() ? cache.getSessionDecisions(cwd, { limit: 500 }) : null;
  const blockersResult = cache && !cache._isMap() ? cache.getSessionBlockers(cwd, { limit: 500 }) : null;
  const continuity = cache && !cache._isMap() ? cache.getSessionContinuity(cwd) : null;

  return {
    rawContent: content,
    state: {
      phase_number: state?.phase_number || parsed.state.phase_number || null,
      phase_name: state?.phase_name || parsed.state.phase_name || null,
      total_phases: state?.total_phases != null ? state.total_phases : parsed.state.total_phases,
      phase_display: parsed.state.phase_display,
      current_focus: parsed.state.current_focus || null,
      current_plan: state?.current_plan || parsed.state.current_plan || null,
      total_plans_in_phase: parsed.state.total_plans_in_phase,
      status: state?.status || parsed.state.status || null,
      last_activity: state?.last_activity || parsed.state.last_activity || null,
      progress: state?.progress != null ? state.progress : parsed.state.progress,
      milestone: state?.milestone || null,
    },
    decisions: decisionsResult ? decisionsResult.entries.slice().reverse() : parsed.decisions,
    blockers: blockersResult ? blockersResult.entries.slice().reverse() : parsed.blockers,
    continuity: continuity
      ? {
          last_session: continuity.last_session || null,
          stopped_at: continuity.stopped_at || null,
          next_step: continuity.next_step || null,
        }
      : parsed.continuity,
  };
}

function cloneModel(model) {
  return JSON.parse(JSON.stringify(model));
}

function applyPatchOperation(model, patches) {
  const updated = [];
  const failed = [];
  for (const [field, value] of Object.entries(patches || {})) {
    const normalized = field.toLowerCase();
    if (normalized === 'status') {
      model.state.status = value;
      updated.push(field);
    } else if (normalized === 'last activity' || normalized === 'last_activity') {
      model.state.last_activity = value;
      updated.push(field);
    } else if (normalized === 'current plan' || normalized === 'current_plan') {
      model.state.current_plan = String(value);
      updated.push(field);
    } else if (normalized === 'total plans in phase' || normalized === 'total_plans_in_phase') {
      model.state.total_plans_in_phase = String(value);
      updated.push(field);
    } else if (normalized === 'current focus' || normalized === 'current_focus') {
      model.state.current_focus = String(value);
      updated.push(field);
    } else if (normalized === 'progress') {
      const parsed = parseInt(value, 10);
      model.state.progress = Number.isNaN(parsed) ? value : parsed;
      updated.push(field);
    } else if (normalized === 'phase') {
      model.state.phase_display = String(value);
      Object.assign(model.state, parsePhaseDisplay(String(value)));
      updated.push(field);
    } else {
      failed.push(field);
    }
  }
  return { updated, failed };
}

function applyOperation(model, operation, cwd) {
  const now = new Date().toISOString();
  switch (operation.type) {
    case 'patch':
      return applyPatchOperation(model, operation.patches);
    case 'appendDecision':
      model.decisions.push({
        phase: operation.phase ? `Phase ${operation.phase}` : null,
        summary: operation.summary,
        rationale: operation.rationale || null,
        timestamp: now,
        milestone: null,
      });
      return { added: true };
    case 'appendBlocker':
      model.blockers.push({ text: operation.text, status: 'open', created_at: now });
      return { added: true };
    case 'resolveBlocker': {
      const target = model.blockers.find((blocker) => blocker.status !== 'resolved' && blocker.text && blocker.text.toLowerCase().includes(operation.text.toLowerCase()));
      if (target) {
        target.status = 'resolved';
        target.resolved_at = now;
        target.resolution = 'Resolved';
      }
      return { resolved: true };
    }
    case 'recordContinuity':
      model.continuity = {
        last_session: now,
        stopped_at: operation.stopped_at || null,
        next_step: operation.resume_file || 'None',
      };
      return { recorded: true };
    case 'completePlanCore': {
      const currentPlan = parseInt(model.state.current_plan, 10);
      const totalPlans = operation.total_plans_in_phase != null
        ? parseInt(operation.total_plans_in_phase, 10)
        : parseInt(model.state.total_plans_in_phase, 10);
      if (Number.isNaN(currentPlan) || Number.isNaN(totalPlans)) {
        throw new Error('Cannot parse Current Plan or Total Plans in Phase from STATE.md');
      }
      const nextPlan = operation.current_plan != null
        ? parseInt(operation.current_plan, 10)
        : (currentPlan >= totalPlans ? currentPlan : currentPlan + 1);
      const nextStatus = operation.status || (nextPlan >= totalPlans ? 'Phase complete — ready for verification' : 'Ready to execute');
      model.state.current_plan = String(nextPlan);
      model.state.total_plans_in_phase = String(totalPlans);
      model.state.status = nextStatus;
      if (operation.current_focus) {
        model.state.current_focus = operation.current_focus;
      }
      model.state.last_activity = new Date().toISOString().split('T')[0];
      model.state.progress = operation.progress_percent;
      if (operation.decision_summary) {
        model.decisions.push({
          phase: operation.phase ? `Phase ${operation.phase}` : null,
          summary: operation.decision_summary,
          rationale: operation.decision_rationale || null,
          timestamp: now,
          milestone: null,
        });
      }
      return {
        completed: true,
        core: {
          previous_plan: currentPlan,
          current_plan: nextPlan,
          total_plans: totalPlans,
          status: nextStatus,
          progress: operation.progress_percent,
          decision_recorded: !!operation.decision_summary,
        },
      };
    }
    default:
      throw new Error(`Unsupported mutation type: ${operation.type}`);
  }
}

function renderProgress(content, progress) {
  const percent = progress != null ? Number(progress) : 0;
  const clamped = Number.isFinite(percent) ? Math.max(0, Math.min(100, Math.round(percent))) : 0;
  const barWidth = 10;
  const filled = Math.round(clamped / 100 * barWidth);
  const bar = `[${'█'.repeat(filled)}${'░'.repeat(barWidth - filled)}] ${clamped}%`;
  const fieldPattern = /(\*\*Progress:\*\*\s*).*/i;
  const inlinePattern = /(Progress:\s*)\[[\u2588\u2591]+\]\s*\d+%/;
  if (fieldPattern.test(content)) return content.replace(fieldPattern, `$1${bar}`);
  if (inlinePattern.test(content)) return content.replace(inlinePattern, `$1${bar}`);
  return content;
}

function renderDecisionSection(content, decisions) {
  const body = decisions.length === 0
    ? 'None yet.\n'
    : decisions.map((decision) => {
        const phase = decision.phase || '?';
        return `- [${phase}]: ${decision.summary || ''}${decision.rationale ? ` — ${decision.rationale}` : ''}`;
      }).join('\n') + '\n';
  return DECISIONS_SECTION_PATTERN.test(content)
    ? content.replace(DECISIONS_SECTION_PATTERN, `$1${body}`)
    : content;
}

function renderBlockerSection(content, blockers) {
  const openBlockers = blockers.filter((blocker) => blocker.status !== 'resolved');
  const body = openBlockers.length === 0
    ? 'None\n'
    : openBlockers.map((blocker) => `- ${blocker.text}`).join('\n') + '\n';
  return BLOCKERS_SECTION_PATTERN.test(content)
    ? content.replace(BLOCKERS_SECTION_PATTERN, `$1${body}`)
    : content;
}

function renderContinuity(content, continuity) {
  const nextStep = continuity?.next_step || 'None';
  const lastSession = continuity?.last_session || new Date().toISOString();
  let next = content;
  const fieldUpdates = [
    ['Last session', lastSession],
    ['Last Date', lastSession],
    ['Stopped at', continuity?.stopped_at || 'None'],
    ['Stopped At', continuity?.stopped_at || 'None'],
    ['Resume file', nextStep],
    ['Resume File', nextStep],
    ['Next step', nextStep],
  ];
  for (const [field, value] of fieldUpdates) {
    const replaced = replaceField(next, field, value);
    if (replaced) next = replaced;
  }
  return next;
}

function renderStateMarkdown(content, model) {
  let next = content;

  if (model.state.phase_display) {
    const replaced = replaceField(next, 'Phase', model.state.phase_display);
    if (replaced) next = replaced;
  }

  const stateFieldUpdates = [
    ['Current Plan', model.state.current_plan],
    ['Total Plans in Phase', model.state.total_plans_in_phase],
    ['Status', model.state.status],
    ['Last Activity', model.state.last_activity],
    ['Current focus', model.state.current_focus],
  ];
  for (const [field, value] of stateFieldUpdates) {
    const replaced = replaceField(next, field, value);
    if (replaced) next = replaced;
  }

  next = renderProgress(next, model.state.progress);
  next = renderDecisionSection(next, model.decisions);
  next = renderBlockerSection(next, model.blockers);
  next = renderContinuity(next, model.continuity);

  return next;
}

function persistModel(cwd, cache, model, options = {}) {
  if (!cache || cache._isMap()) return { stored: false, skipped: true };
  if (typeof options.beforeStoreBundle === 'function') {
    options.beforeStoreBundle(model);
  }
  const result = cache.storeSessionBundle(cwd, {
    state: {
      phase_number: model.state.phase_number || null,
      phase_name: model.state.phase_name || null,
      total_phases: model.state.total_phases != null ? model.state.total_phases : null,
      current_focus: model.state.current_focus || null,
      current_plan: model.state.current_plan || null,
      total_plans_in_phase: model.state.total_plans_in_phase || null,
      status: model.state.status || null,
      last_activity: model.state.last_activity || null,
      progress: model.state.progress != null ? model.state.progress : null,
      milestone: model.state.milestone || null,
    },
    decisions: model.decisions,
    blockers: model.blockers,
    continuity: model.continuity,
  });
  if (!result) {
    throw new Error('SQLite bundle write failed');
  }
  return result;
}

function validateOperationAgainstContent(content, operation) {
  if (operation.type === 'appendDecision' && !DECISIONS_SECTION_PATTERN.test(content)) {
    throw new Error('Decisions section not found in STATE.md');
  }
  if ((operation.type === 'appendBlocker' || operation.type === 'resolveBlocker') && !BLOCKERS_SECTION_PATTERN.test(content)) {
    throw new Error('Blockers section not found in STATE.md');
  }
}

function applyStateSessionMutation(cwd, operation, options = {}) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  return withProjectLock(cwd, () => {
    const cache = buildCache(cwd);
    if (!cache._isMap() && typeof options.reimportState !== 'function') {
      try {
        const { _checkAndReimportState } = require('../commands/state');
        _checkAndReimportState(cwd, cache);
      } catch {}
    } else if (typeof options.reimportState === 'function') {
      options.reimportState(cwd, cache);
    }

    const originalContent = cachedReadFile(statePath);
    if (!originalContent) {
      throw new Error('STATE.md not found');
    }
    validateOperationAgainstContent(originalContent, operation);

    const currentModel = loadCanonicalModel(cwd, originalContent, cache);
    const nextModel = cloneModel(currentModel);
    const result = applyOperation(nextModel, operation, cwd);
    const nextContent = renderStateMarkdown(originalContent, nextModel);

    try {
      writeFileAtomic(statePath, nextContent);
      persistModel(cwd, cache, nextModel, options);
      invalidateFileCache(statePath);
      if (!cache._isMap()) cache.updateMtime(statePath);
      return { ...result, model: nextModel };
    } catch (error) {
      try {
        writeFileAtomic(statePath, originalContent);
        invalidateFileCache(statePath);
        if (!cache._isMap()) cache.updateMtime(statePath);
      } catch {}
      throw error;
    }
  });
}

module.exports = {
  applyStateSessionMutation,
  parseStateMarkdown,
  renderStateMarkdown,
  canBatch,
};
