function isPlanningChange(trigger = {}) {
  const filePath = typeof trigger.filePath === 'string'
    ? trigger.filePath
    : typeof trigger.event?.path === 'string'
      ? trigger.event.path
      : typeof trigger.event?.filePath === 'string'
        ? trigger.event.filePath
        : null;

  return Boolean(filePath && filePath.includes('.planning/'));
}

function mergeHooks(current = [], nextHook) {
  const hooks = Array.isArray(current) ? current.slice(0, 8) : [];
  if (!nextHook || hooks.includes(nextHook)) {
    return hooks;
  }

  hooks.push(nextHook);
  return hooks.slice(-8);
}

function mergeTriggerDetail(previous = null, incoming = {}) {
  const next = incoming && typeof incoming === 'object' ? incoming : {};
  const merged = {
    ...(previous || {}),
    ...next,
  };

  merged.hook = next.hook || previous?.hook || 'unknown';
  merged.hooks = mergeHooks(previous?.hooks, next.hook);

  if (next.input !== undefined) {
    merged.input = next.input;
  } else if (previous?.input !== undefined) {
    merged.input = previous.input;
  }

  if (next.event !== undefined) {
    merged.event = next.event;
  } else if (previous?.event !== undefined) {
    merged.event = previous.event;
  }

  if (next.filePath !== undefined) {
    merged.filePath = next.filePath;
  } else if (previous?.filePath !== undefined) {
    merged.filePath = previous.filePath;
  }

  merged.planningChange = Boolean(previous?.planningChange || isPlanningChange(next));
  return merged;
}

export function createCmuxRefreshBackbone(options = {}) {
  const {
    projectDir,
    debounceMs = 200,
    invalidateAll = () => {},
    getProjectState = () => null,
    getCurrentCmuxAdapter = async () => null,
    getNotificationHistory = () => [],
    syncCmuxSidebar = async () => null,
    syncCmuxAttention = async () => null,
    attentionMemory,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
    onError = () => {},
  } = options;

  let timer = null;
  let inFlight = null;
  let rerunRequested = false;
  let pendingTrigger = null;
  let pendingAllowRetry = false;

  function clearScheduledTimer() {
    if (!timer) return;
    clearTimeoutFn(timer);
    timer = null;
  }

  function recordPendingTrigger(trigger, executionOptions = {}) {
    pendingTrigger = mergeTriggerDetail(pendingTrigger, trigger);
    pendingAllowRetry = pendingAllowRetry || executionOptions.allowRetry === true;
  }

  async function runCycle() {
    clearScheduledTimer();
    if (inFlight) {
      return inFlight;
    }

    const trigger = pendingTrigger || mergeTriggerDetail(null, { hook: 'unknown' });
    const allowRetry = pendingAllowRetry;
    pendingTrigger = null;
    pendingAllowRetry = false;

    inFlight = (async () => {
      try {
        invalidateAll(projectDir);
        const currentCmuxAdapter = await getCurrentCmuxAdapter({ allowRetry });
        const projectState = await getProjectState(projectDir);
        if (!projectState) {
          return null;
        }

        const payload = {
          ...projectState,
          notificationHistory: getNotificationHistory(),
        };

        await syncCmuxSidebar(currentCmuxAdapter, payload);
        await syncCmuxAttention(currentCmuxAdapter, payload, {
          memory: attentionMemory,
          trigger,
        });

        return payload;
      } catch (error) {
        onError(error, trigger);
        return null;
      } finally {
        inFlight = null;
        if (rerunRequested) {
          rerunRequested = false;
          void runCycle();
        }
      }
    })();

    return inFlight;
  }

  function schedule(trigger, executionOptions = {}) {
    recordPendingTrigger(trigger, executionOptions);

    if (inFlight) {
      rerunRequested = true;
      return inFlight;
    }

    if (executionOptions.immediate === true) {
      return runCycle();
    }

    clearScheduledTimer();
    timer = setTimeoutFn(() => {
      void runCycle();
    }, Math.max(0, debounceMs));
    return null;
  }

  function enqueue(trigger = {}, executionOptions = {}) {
    return schedule(trigger, executionOptions);
  }

  function refreshNow(trigger = {}, executionOptions = {}) {
    return schedule(trigger, {
      ...executionOptions,
      immediate: true,
    });
  }

  function dispose() {
    clearScheduledTimer();
    pendingTrigger = null;
    pendingAllowRetry = false;
    rerunRequested = false;
  }

  return {
    enqueue,
    refreshNow,
    dispose,
  };
}

export { mergeTriggerDetail };
