import {
  deriveContextLabel as deriveLifecycleContextLabel,
  deriveWorkspaceLifecycleSignal,
} from './cmux-lifecycle-signal.js';

export function derivePrimaryState(projectState) {
  const signal = deriveWorkspaceLifecycleSignal(projectState);
  const priorities = {
    'finalize-failed': 8,
    waiting: 7,
    stale: 6,
    blocked: 5,
    reconciling: 4,
    running: 3,
    complete: 2,
    idle: 1,
  };

  return {
    label: signal.label,
    reason: signal.state,
    priority: priorities[signal.state] || 1,
    severity: signal.severity,
  };
}

export function deriveContextLabel(projectState) {
  return deriveLifecycleContextLabel(projectState);
}

export function deriveProgressSignal(projectState) {
  return deriveWorkspaceLifecycleSignal(projectState).progress;
}

export function deriveCmuxSidebarSnapshot(projectState) {
  const signal = deriveWorkspaceLifecycleSignal(projectState);
  return {
    status: derivePrimaryState(projectState),
    context: signal.context,
    activity: {
      label: signal.hint,
      source: 'lifecycle',
      trustworthy: Boolean(signal.hint),
    },
    progress: signal.progress,
    lifecycle: signal,
  };
}
