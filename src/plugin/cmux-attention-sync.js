import { deriveCmuxSidebarSnapshot } from './cmux-sidebar-snapshot.js';
import { shouldEmitAttentionEvent } from './cmux-attention-policy.js';

const INTERVENTION_STATES = new Set(['waiting', 'stale', 'finalize-failed']);
const LOG_ONLY_STATES = new Set(['blocked', 'running', 'reconciling', 'complete', 'idle']);

function normalizeText(value) {
  return String(value || '').trim();
}

function lowerText(value) {
  return normalizeText(value).toLowerCase();
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

function buildStartEvent(snapshot, workspaceId) {
  const projectState = snapshot?.projectState || {};
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

function buildSignalEntry(projectState, cmuxAdapter) {
  const snapshot = deriveCmuxSidebarSnapshot(projectState);
  const workspaceId = cmuxAdapter?.workspaceId || 'workspace:unknown';
  const phase = parsePhaseNumber(projectState?.state, projectState?.currentPhase);
  const plan = parsePlanNumber(projectState?.state);
  const lifecycle = snapshot.lifecycle || {};
  const hint = normalizeText(snapshot.activity?.label || lifecycle.hint || lifecycle.label || lifecycle.state);
  const context = normalizeText(snapshot.context?.label || lifecycle.context?.label || '');
  const identity = [lifecycle.state, phase || 'none', plan || 'none', hint || 'none'].join(':');

  return {
    workspaceId,
    phase,
    plan,
    lifecycle,
    hint,
    context,
    identity,
    snapshot,
    projectState,
  };
}

function buildInterventionEvent(entry) {
  return {
    workspaceId: entry.workspaceId,
    phase: entry.phase,
    plan: entry.plan,
    kind: entry.lifecycle.state,
    identity: entry.identity,
    message: entry.hint || entry.lifecycle.label || 'Intervention required',
  };
}

function buildResolvedEvent(entry, previous) {
  const previousLabel = normalizeText(previous?.lifecycle?.label || previous?.lifecycle?.state || 'Intervention');
  const currentMessage = entry.hint || entry.lifecycle.label || 'State updated';
  return {
    workspaceId: entry.workspaceId,
    phase: entry.phase,
    plan: entry.plan,
    kind: entry.lifecycle.state,
    identity: `${previous?.identity || 'unknown'}->${entry.identity}`,
    message: `${previousLabel} resolved — ${currentMessage}`,
  };
}

function buildAttentionCandidate(projectState, cmuxAdapter, trigger = {}, previousEntry = null) {
  const entry = buildSignalEntry(projectState, cmuxAdapter);
  const currentState = entry.lifecycle?.state;
  const previousState = previousEntry?.lifecycle?.state || null;

  if (INTERVENTION_STATES.has(currentState)) {
    return {
      candidate: buildInterventionEvent(entry),
      entry,
    };
  }

  if (currentState === 'blocked') {
    return {
      candidate: {
        workspaceId: entry.workspaceId,
        phase: entry.phase,
        plan: entry.plan,
        kind: currentState,
        identity: entry.identity,
        message: entry.hint || 'Blocked by error',
      },
      entry,
    };
  }

  if (previousEntry && INTERVENTION_STATES.has(previousState) && LOG_ONLY_STATES.has(currentState) && previousState !== currentState) {
    return {
      candidate: buildResolvedEvent(entry, previousEntry),
      entry,
    };
  }

  if (!previousEntry && ['startup', 'file.watcher.updated', 'file.watcher.external', 'command.executed'].includes(trigger.hook)) {
    const startEvent = buildStartEvent({ ...entry.snapshot, projectState }, entry.workspaceId);
    if (startEvent) {
      return {
        candidate: startEvent,
        entry,
      };
    }
  }

  if (trigger.hook === 'tool.execute.after' && isTaskCompletionTrigger(trigger.input)) {
    return {
      candidate: buildTaskCompletionEvent(projectState, entry.workspaceId, trigger.input),
      entry,
    };
  }

  return { candidate: null, entry };
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
    lastLifecycleByWorkspace: new Map(),
  };
}

export async function syncCmuxAttention(cmuxAdapter, projectState, options = {}) {
  if (!cmuxAdapter || typeof cmuxAdapter.log !== 'function' || typeof cmuxAdapter.notify !== 'function') {
    return { emitted: false, reason: 'missing-adapter' };
  }

  const memory = options.memory || createAttentionMemory();
  const now = Number(options.now ?? Date.now());
  const previousEntry = memory.lastLifecycleByWorkspace.get(cmuxAdapter?.workspaceId || 'workspace:unknown') || null;
  const { candidate, entry } = buildAttentionCandidate(projectState, cmuxAdapter, options.trigger || {}, previousEntry);
  memory.lastLifecycleByWorkspace.set(entry.workspaceId, entry);

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
