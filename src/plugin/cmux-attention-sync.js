import { deriveCmuxSidebarSnapshot } from './cmux-sidebar-snapshot.js';
import { shouldEmitAttentionEvent } from './cmux-attention-policy.js';

function normalizeText(value) {
  return String(value || '').trim();
}

function lowerText(value) {
  return normalizeText(value).toLowerCase();
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

function parsePhaseNumber(state, currentPhase) {
  const fromState = normalizeText(state?.phase).match(/^(\d+(?:\.\d+)?)/);
  if (fromState) return fromState[1];
  return currentPhase?.number ? String(currentPhase.number) : null;
}

function parsePlanNumber(state) {
  const match = normalizeText(state?.currentPlan).match(/(\d+)/);
  return match ? match[1].padStart(2, '0') : null;
}

function extractContinuityText(state) {
  return normalizeText(extractSection(state, 'Session Continuity'));
}

function buildSignalText(projectState) {
  const state = projectState?.state || {};
  return [normalizeText(state.status), extractContinuityText(state)].filter(Boolean).join(' ').trim();
}

function findLatestNotification(notificationHistory, severity) {
  const normalizedSeverity = lowerText(severity);
  const entries = Array.isArray(notificationHistory) ? notificationHistory : [];
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (lowerText(entry?.severity) === normalizedSeverity) {
      return entry;
    }
  }
  return null;
}

function shouldConsiderStartEvent(trigger = {}) {
  return ['startup', 'file.watcher.updated', 'file.watcher.external', 'command.executed'].includes(trigger.hook);
}

function buildStartEvent(projectState, workspaceId) {
  const snapshot = deriveCmuxSidebarSnapshot(projectState);
  const phase = parsePhaseNumber(projectState?.state, projectState?.currentPhase);
  const plan = parsePlanNumber(projectState?.state);
  const identity = `${phase || 'unknown'}:${plan || 'unknown'}`;

  if (snapshot.context?.label === 'Planning') {
    return {
      workspaceId,
      phase,
      plan,
      kind: 'planner-start',
      identity,
      message: phase && plan ? `Phase ${phase} plan ${plan} started` : 'Planning started',
    };
  }

  if (snapshot.context?.label === 'Executing' || snapshot.context?.label === 'Verifying') {
    return {
      workspaceId,
      phase,
      plan,
      kind: 'executor-start',
      identity,
      message: phase && plan ? `Phase ${phase} plan ${plan} running` : 'Execution started',
    };
  }

  if (snapshot.status?.label === 'Working') {
    return {
      workspaceId,
      phase,
      plan,
      kind: 'workflow-start',
      identity,
      message: 'Workflow started',
    };
  }

  return null;
}

function isTaskCompletionTrigger(input = {}) {
  if (input?.error) return false;
  return ['task', 'task()'].includes(lowerText(input.tool));
}

function buildTaskCompletionEvent(projectState, workspaceId, input = {}) {
  const phase = parsePhaseNumber(projectState?.state, projectState?.currentPhase);
  const plan = parsePlanNumber(projectState?.state);
  const taskName = normalizeText(input?.args?.task || input?.task || input?.name || 'Task');

  return {
    workspaceId,
    phase,
    plan,
    kind: 'task-complete',
    identity: taskName.toLowerCase(),
    message: `${taskName} complete`,
  };
}

function buildBoundaryEvent(projectState, workspaceId, signalText) {
  const phase = parsePhaseNumber(projectState?.state, projectState?.currentPhase);
  const plan = parsePlanNumber(projectState?.state);
  const lowerSignal = lowerText(signalText);
  const phaseStatus = lowerText(projectState?.currentPhase?.status);

  if (/workflow complete|workflow completed|milestone complete|all work complete/.test(lowerSignal)) {
    return {
      workspaceId,
      phase,
      plan,
      kind: 'workflow-complete',
      identity: phase || 'workflow',
      message: 'Workflow complete',
    };
  }

  if (phaseStatus === 'complete' || /\bphase complete\b/.test(lowerSignal)) {
    return {
      workspaceId,
      phase,
      plan,
      kind: 'phase-complete',
      identity: phase || 'phase',
      message: phase ? `Phase ${phase} complete` : 'Phase complete',
    };
  }

  if (/\bplan complete\b/.test(lowerSignal) || /completed .*?-plan\.md/.test(lowerSignal)) {
    return {
      workspaceId,
      phase,
      plan,
      kind: 'plan-complete',
      identity: `${phase || 'unknown'}:${plan || 'unknown'}`,
      message: phase && plan ? `Phase ${phase} plan ${plan} complete` : 'Plan complete',
    };
  }

  return null;
}

function buildAttentionCandidate(projectState, cmuxAdapter, trigger = {}) {
  const state = projectState?.state || {};
  const notificationHistory = projectState?.notificationHistory || [];
  const workspaceId = cmuxAdapter?.workspaceId || 'workspace:unknown';
  const signalText = buildSignalText(projectState);
  const lowerSignal = lowerText(signalText);
  const blockerLines = extractBlockerLines(state);
  const latestCritical = findLatestNotification(notificationHistory, 'critical');
  const latestWarning = findLatestNotification(notificationHistory, 'warning');
  const boundaryEvent = buildBoundaryEvent(projectState, workspaceId, signalText);

  if (boundaryEvent) {
    return boundaryEvent;
  }

  if (shouldConsiderStartEvent(trigger)) {
    const hasEscalationSignal = /checkpoint|warning|blocked|blocker|failure|error|auth|manual action/.test(lowerSignal)
      || blockerLines.length > 0
      || Boolean(latestCritical || latestWarning);
    if (!hasEscalationSignal) {
      const startEvent = buildStartEvent(projectState, workspaceId);
      if (startEvent) return startEvent;
    }
  }

  if (/\bcheckpoint\b/.test(lowerSignal)) {
    return {
      workspaceId,
      phase: parsePhaseNumber(state, projectState?.currentPhase),
      plan: parsePlanNumber(state),
      kind: 'checkpoint',
      identity: lowerSignal || 'checkpoint',
      message: 'Checkpoint waiting for input',
    };
  }

  if (/input needed|await(?:ing)?|needs? (?:reply|response|approval|review|decision)|manual action|required reply|human action|auth|login|sign in/.test(lowerSignal)) {
    return {
      workspaceId,
      phase: parsePhaseNumber(state, projectState?.currentPhase),
      plan: parsePlanNumber(state),
      kind: 'waiting-input',
      identity: lowerSignal || 'waiting-input',
      message: 'Waiting for input',
    };
  }

  if (blockerLines.length > 0 || latestCritical || /\bblocked\b|hard stop|cannot continue|fatal|failure|failed|error/.test(lowerSignal)) {
    const blockerMessage = normalizeText(blockerLines[0] || latestCritical?.message || signalText || 'Blocker needs attention');
    return {
      workspaceId,
      phase: parsePhaseNumber(state, projectState?.currentPhase),
      plan: parsePlanNumber(state),
      kind: 'blocker',
      identity: lowerText(blockerMessage),
      message: blockerMessage,
    };
  }

  if (latestWarning || /warning|stale|spinning|degraded|attention/.test(lowerSignal)) {
    const warningMessage = normalizeText(latestWarning?.message || signalText || 'Warning needs attention');
    return {
      workspaceId,
      phase: parsePhaseNumber(state, projectState?.currentPhase),
      plan: parsePlanNumber(state),
      kind: 'warning',
      identity: lowerText(latestWarning?.type || warningMessage),
      message: warningMessage,
    };
  }

  if (trigger.hook === 'tool.execute.after' && isTaskCompletionTrigger(trigger.input)) {
    return buildTaskCompletionEvent(projectState, workspaceId, trigger.input);
  }

  return null;
}

function getWorkspaceKindMap(memory, workspaceId) {
  let kindMap = memory.lastEventKeys.get(workspaceId);
  if (!kindMap) {
    kindMap = new Map();
    memory.lastEventKeys.set(workspaceId, kindMap);
  }
  return kindMap;
}

function getLastEvent(memory, workspaceId, kind) {
  const kindMap = memory.lastEventKeys.get(workspaceId);
  if (!kindMap || !kindMap.has(kind)) return null;
  const key = kindMap.get(kind);
  return {
    key,
    lastEmittedAt: memory.lastEmittedAt.get(`${workspaceId}:${kind}`) || 0,
  };
}

function rememberEvent(memory, workspaceId, event, now) {
  const kindMap = getWorkspaceKindMap(memory, workspaceId);
  kindMap.set(event.kind, event.key);
  memory.lastEmittedAt.set(`${workspaceId}:${event.kind}`, now);
}

export function createAttentionMemory() {
  return {
    lastEmittedAt: new Map(),
    lastEventKeys: new Map(),
  };
}

export async function syncCmuxAttention(cmuxAdapter, projectState, options = {}) {
  if (!cmuxAdapter || typeof cmuxAdapter.log !== 'function' || typeof cmuxAdapter.notify !== 'function') {
    return { emitted: false, reason: 'missing-adapter' };
  }

  const memory = options.memory || createAttentionMemory();
  const now = Number(options.now ?? Date.now());
  const candidate = buildAttentionCandidate(projectState, cmuxAdapter, options.trigger || {});

  if (!candidate) {
    return { emitted: false, reason: 'no-meaningful-event' };
  }

  const decision = shouldEmitAttentionEvent({ ...candidate, now }, {
    lastEvent: getLastEvent(memory, candidate.workspaceId, candidate.kind),
  });

  if (!decision.emit) {
    return { emitted: false, reason: decision.reason, event: decision.event };
  }

  if (decision.event?.log) {
    await cmuxAdapter.log(decision.event.log.message, decision.event.log);
  }

  if (decision.event?.notify) {
    await cmuxAdapter.notify(decision.event.notify);
  }

  rememberEvent(memory, candidate.workspaceId, decision.event, now);
  return { emitted: true, reason: decision.reason, event: decision.event };
}
