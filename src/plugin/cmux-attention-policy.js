const LOG_ONLY_KINDS = new Set(['planner-start', 'executor-start', 'task-complete', 'state-sync', 'blocked', 'running', 'reconciling', 'complete', 'idle']);
const NOTIFY_KINDS = new Set(['waiting', 'stale', 'finalize-failed']);

function normalizeText(value, fallback = 'unknown') {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

function normalizeLevel(kind) {
  if (kind === 'blocked' || kind === 'finalize-failed') return 'error';
  if (kind === 'waiting' || kind === 'stale') return 'warning';
  if (kind === 'complete') return 'success';
  if (kind === 'task-complete') return 'progress';
  return 'info';
}

function buildLogMessage(event) {
  return normalizeText(event.message, normalizeText(event.kind));
}

function buildNotifyPayload(event, message) {
  if (!NOTIFY_KINDS.has(event.kind)) return null;

  return {
    title: 'bGSD',
    subtitle: event.phase ? `Phase ${event.phase}` : undefined,
    body: message,
    level: normalizeLevel(event.kind),
  };
}

export function buildAttentionEventKey(event = {}) {
  return [
    normalizeText(event.workspaceId),
    normalizeText(event.kind),
    normalizeText(event.phase, 'none'),
    normalizeText(event.plan, 'none'),
    normalizeText(event.task, 'none'),
    normalizeText(event.identity, 'default'),
  ].join(':');
}

export function classifyAttentionEvent(event = {}) {
  const message = buildLogMessage(event);
  const key = buildAttentionEventKey(event);
  const kind = normalizeText(event.kind);
  const logAllowed = LOG_ONLY_KINDS.has(kind) || NOTIFY_KINDS.has(kind);
  const notify = buildNotifyPayload({ ...event, kind }, message);
  const cooldownMs = NOTIFY_KINDS.has(kind) ? 300000 : 0;

  return {
    key,
    kind,
    cooldownMs,
    interruptive: Boolean(notify),
    log: logAllowed
      ? {
          level: normalizeLevel(kind),
          message,
          source: 'bgsd',
        }
      : null,
    notify,
  };
}

export function shouldEmitAttentionEvent(event = {}, options = {}) {
  const classifiedEvent = classifyAttentionEvent(event);
  const lastEvent = options.lastEvent || null;

  if (!lastEvent || lastEvent.key !== classifiedEvent.key) {
    return { emit: true, reason: 'first-occurrence', event: classifiedEvent };
  }

  if (!classifiedEvent.cooldownMs) {
    return { emit: false, reason: 'duplicate', event: classifiedEvent };
  }

  const currentTime = Number(event.now ?? Date.now());
  const lastSeen = Number(lastEvent.lastEmittedAt ?? lastEvent.now ?? 0);

  if ((currentTime - lastSeen) < classifiedEvent.cooldownMs) {
    return { emit: false, reason: 'cooldown-active', event: classifiedEvent };
  }

  return {
    emit: true,
    reason: 'cooldown-expired',
    event: {
      ...classifiedEvent,
      lastEmittedAt: currentTime,
    },
  };
}
