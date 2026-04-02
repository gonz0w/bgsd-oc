function normalizeText(value) {
  return String(value || '').trim();
}

function lowerText(value) {
  return normalizeText(value).toLowerCase();
}

function hasPattern(value, pattern) {
  return pattern.test(lowerText(value));
}

function extractSection(state, sectionName) {
  if (!state) return null;
  if (typeof state.getSection === 'function') {
    return state.getSection(sectionName);
  }

  const raw = String(state.raw || '');
  if (!raw) return null;

  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = raw.match(new RegExp(`##\\s*${escaped}\\s*\\n([\\s\\S]*?)(?=\\n##|$)`, 'i'));
  return match ? match[1].trim() : null;
}

function extractBlockerLines(state) {
  const section = extractSection(state, 'Blockers/Concerns');
  if (!section) return [];

  return section
    .split('\n')
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter((line) => line && !/^none(?:\.|\s|$)/i.test(line));
}

function extractContinuityText(state) {
  return normalizeText(extractSection(state, 'Session Continuity'));
}

function parsePhaseNumber(state, currentPhase) {
  const fromState = normalizeText(state?.phase).match(/^(\d+(?:\.\d+)?)/);
  if (fromState) return fromState[1];
  return currentPhase?.number ? String(currentPhase.number) : null;
}

function parsePlanNumber(state) {
  const match = normalizeText(state?.currentPlan).match(/(\d+)/);
  return match ? match[1].padStart(2, '0') : null;
}

function buildStructuralLabel(state, currentPhase) {
  const phaseNumber = parsePhaseNumber(state, currentPhase);
  const planNumber = parsePlanNumber(state);
  if (phaseNumber && planNumber) return `Phase ${phaseNumber} P${planNumber}`;
  if (phaseNumber) return `Phase ${phaseNumber}`;
  return null;
}

function buildSignalText(state) {
  return [normalizeText(state?.status), extractContinuityText(state)].filter(Boolean).join(' ').trim();
}

function deriveWorkflowLabel(state) {
  const signal = lowerText(buildSignalText(state));

  if (/\bverif(?:y|ying|ication)\b/.test(signal)) return 'Verifying';
  if (/\bplan(?:ning)?\b/.test(signal) || /ready to plan/.test(signal)) return 'Planning';
  if (/\bexecut(?:e|ing|ion)?\b/.test(signal) || /\bin progress\b/.test(signal) || /\bworking\b/.test(signal) || /\brunning\b/.test(signal)) {
    return 'Executing';
  }

  return null;
}

function getLatestNotification(notificationHistory, predicate) {
  const entries = Array.isArray(notificationHistory) ? notificationHistory : [];
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (predicate(entry)) return entry;
  }
  return null;
}

function getStructuredBlockingReason(state) {
  const candidates = [
    state?.blocking_reason,
    state?.recovery_summary?.blocking_reason,
    state?.recovery_summary?.status,
  ];

  for (const value of candidates) {
    const normalized = lowerText(value).replace(/_/g, '-');
    if (normalized) return normalized;
  }

  return null;
}

function isHumanGate(state) {
  const signal = `${buildSignalText(state)} ${extractBlockerLines(state).join(' ')}`.trim();
  return /(ready to plan|input needed|await(?:ing)? (?:reply|response|approval|review|decision)|needs? (?:reply|response|approval|review|decision)|checkpoint|manual (?:setup|action|step)|auth|login|sign in|required reply|human action)/i.test(signal);
}

function isFinalizeFailed(state, notificationHistory) {
  const blockingReason = getStructuredBlockingReason(state);
  if (blockingReason === 'finalize-failed') return true;
  if (hasPattern(state?.status, /finalize[\s_-]*failed|finalize failure|finalization failed/)) return true;
  return Boolean(getLatestNotification(notificationHistory, (entry) => /finalize/i.test(entry?.message) && lowerText(entry?.severity) === 'critical'));
}

function isStale(state, notificationHistory) {
  const blockingReason = getStructuredBlockingReason(state);
  if (blockingReason === 'stale') return true;
  if (hasPattern(state?.status, /\bstale\b|update-stale|workspace stale/)) return true;
  return Boolean(getLatestNotification(notificationHistory, (entry) => /stale/i.test(entry?.message)));
}

function isBlocked(state, notificationHistory) {
  if (hasPattern(state?.status, /\bblocked\b|hard stop|cannot continue|fatal|failure|failed|error/)) {
    return !isHumanGate(state) && !isFinalizeFailed(state, notificationHistory) && !isStale(state, notificationHistory);
  }

  const blockerLines = extractBlockerLines(state);
  if (blockerLines.some((line) => /(cannot continue|hard stop|fatal|failure|broken|repair required|critical)/i.test(line))
    && blockerLines.every((line) => !/(auth|manual|decision|approval|reply|review|stale|finalize)/i.test(line))) {
    return true;
  }

  const latestCritical = getLatestNotification(notificationHistory, (entry) => lowerText(entry?.severity) === 'critical');
  return Boolean(latestCritical);
}

function isReconciling(state) {
  const status = lowerText(state?.status);
  return /reconcil|recovering|finalizing|finalising|merging/.test(status);
}

function isComplete(state, currentPhase) {
  if (typeof state?.progress === 'number' && state.progress >= 100) return true;
  if (hasPattern(state?.status, /complete|completed|done|finished/)) return true;
  return lowerText(currentPhase?.status) === 'complete';
}

function isRunning(state) {
  const workflowLabel = deriveWorkflowLabel(state);
  if (workflowLabel) return true;
  return hasPattern(state?.status, /in progress|working|active|running/);
}

function deriveContextLabel(projectState) {
  const state = projectState?.state || {};
  const currentPhase = projectState?.currentPhase || null;
  const workflowLabel = deriveWorkflowLabel(state);

  if (workflowLabel) {
    return { label: workflowLabel, source: 'workflow', trustworthy: true };
  }

  const structuralLabel = buildStructuralLabel(state, currentPhase);
  if (structuralLabel) {
    return { label: structuralLabel, source: 'structure', trustworthy: true };
  }

  return { label: null, source: 'none', trustworthy: false };
}

function buildHint(stateName, projectState) {
  const state = projectState?.state || {};
  const notificationHistory = projectState?.notificationHistory || [];
  const signalText = normalizeText(state.status);
  const blockerLines = extractBlockerLines(state);
  const latestCritical = getLatestNotification(notificationHistory, (entry) => lowerText(entry?.severity) === 'critical');
  const latestWarning = getLatestNotification(notificationHistory, (entry) => lowerText(entry?.severity) === 'warning');

  if (stateName === 'finalize-failed') {
    return 'Finalize needs intervention';
  }

  if (stateName === 'waiting') {
    if (/auth|login|sign in/i.test(signalText)) return 'Login required';
    if (/decision/i.test(signalText)) return 'Decision required';
    if (/review|approval|checkpoint/i.test(signalText)) return 'Checkpoint waiting for review';
    return 'Waiting for input';
  }

  if (stateName === 'stale') {
    return 'Workspace recovery required';
  }

  if (stateName === 'blocked') {
    return normalizeText(blockerLines[0] || latestCritical?.message || latestWarning?.message || signalText || 'Blocked by error');
  }

  if (stateName === 'reconciling') {
    return signalText || 'Reconciling workspace state';
  }

  if (stateName === 'running') {
    if (signalText && !/^in progress$/i.test(signalText)) return signalText;
    const workflowLabel = deriveWorkflowLabel(state);
    if (workflowLabel === 'Verifying') return 'Verification running';
    if (workflowLabel === 'Planning') return 'Planning in progress';
    return 'Execution running';
  }

  if (stateName === 'complete') {
    return 'Latest plan complete';
  }

  return 'Awaiting work';
}

function deriveStateName(projectState) {
  const state = projectState?.state || {};
  const notificationHistory = projectState?.notificationHistory || [];
  const currentPhase = projectState?.currentPhase || null;

  if (isFinalizeFailed(state, notificationHistory)) return 'finalize-failed';
  if (isHumanGate(state)) return 'waiting';
  if (isStale(state, notificationHistory)) return 'stale';
  if (isBlocked(state, notificationHistory)) return 'blocked';
  if (isReconciling(state)) return 'reconciling';
  if (isComplete(state, currentPhase)) return 'complete';
  if (isRunning(state)) return 'running';
  return 'idle';
}

function toLabel(stateName) {
  const labels = {
    'finalize-failed': 'Finalize failed',
    waiting: 'Waiting',
    stale: 'Stale',
    blocked: 'Blocked',
    reconciling: 'Reconciling',
    running: 'Running',
    complete: 'Complete',
    idle: 'Idle',
  };

  return labels[stateName] || 'Idle';
}

function toSeverity(stateName) {
  if (['finalize-failed', 'waiting', 'stale', 'blocked'].includes(stateName)) return 'needs-human';
  return 'quiet';
}

function deriveProgress(stateName, projectState, hint) {
  const state = projectState?.state || {};
  if (['finalize-failed', 'waiting', 'stale', 'blocked'].includes(stateName)) {
    return { mode: 'hidden' };
  }

  if (typeof state.progress === 'number' && Number.isFinite(state.progress)) {
    return {
      mode: 'exact',
      value: Math.max(0, Math.min(100, state.progress)) / 100,
      label: parsePhaseNumber(state, projectState?.currentPhase) ? `Phase ${parsePhaseNumber(state, projectState?.currentPhase)}` : 'Progress',
    };
  }

  if (stateName === 'running' || stateName === 'reconciling') {
    return {
      mode: 'activity',
      label: hint,
    };
  }

  return { mode: 'hidden' };
}

export function deriveWorkspaceLifecycleSignal(projectState) {
  const stateName = deriveStateName(projectState);
  const context = deriveContextLabel(projectState);
  const hint = buildHint(stateName, projectState);

  return {
    state: stateName,
    label: toLabel(stateName),
    severity: toSeverity(stateName),
    hint,
    context,
    progress: deriveProgress(stateName, projectState, hint),
  };
}

export { deriveContextLabel, deriveWorkflowLabel, extractBlockerLines, parsePhaseNumber, parsePlanNumber };
