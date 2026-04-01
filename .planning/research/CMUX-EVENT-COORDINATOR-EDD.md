# CMUX Event Coordinator EDD

## Overview

Engineering design document for a new `cmux-event-coordinator.js` module that prevents CPU overload during parallel subagent execution by debouncing cmux sidebar refresh events and limiting concurrent cmux process spawning.

## Problem

When running parallel subagents, the `tool.execute.after` hook fires on every tool execution with **zero debouncing** or throttling. Each event triggers:
1. `refreshCmuxSidebar()` → `invalidateAll()` + `getProjectState()` + cmux CLI calls
2. `refreshCmuxAttention()` → `invalidateAll()` + `getProjectState()` + cmux CLI calls

With 10 parallel agents running 5 tools each:
- 50 `tool.execute.after` events fire rapidly
- Each event runs `invalidateAll()` + `getProjectState()` (expensive file parsing)
- Each event spawns 2-4 `execFile("cmux", ...)` child processes
- **Total: 100-200 simultaneous cmux processes, each re-parsing all planning files**

This causes the sidebar to enter a feedback loop of updates, resulting in CPU runaway and mac crash.

## Root Causes

| Issue | Location | Severity |
|-------|----------|----------|
| `tool.execute.after` has no debounce | `src/plugin/index.js:432-437` | CRITICAL |
| No rate limiter for cmux processes | `src/plugin/cmux-cli.js:140` | CRITICAL |
| `refreshCmuxSidebar` + `refreshCmuxAttention` both parse files separately | `src/plugin/index.js:304,322` | HIGH |
| No coordination between hook handlers | `src/plugin/index.js:415-436` | MEDIUM |
| File watcher debounce (200ms) doesn't apply to tool events | `src/plugin/file-watcher.js:33` vs `index.js:432` | MEDIUM |
| Attention memory has race conditions | `src/plugin/cmux-attention-sync.js:273-277` | MEDIUM |

## Current Architecture

### Event Flow (Before)

```
tool.execute.after ─────────────────────────────────────────► cmux CLI spawn
     │                                                               │
     ├─► refreshCmuxSidebar()                                        │
     │       ├─► invalidateAll()  ◄── parses all files                │
     │       ├─► getProjectState()                                    │
     │       └─► syncCmuxSidebar() → setStatus, setProgress          │
     │                                                               │
     └─► refreshCmuxAttention()                                      │
             ├─► invalidateAll()  ◄── parses all files (AGAIN)        │
             ├─► getProjectState() (AGAIN)                           │
             └─► syncCmuxAttention() → log, notify                   │
                                                                   │
file.watcher.updated ──► 200ms debounce ──► handleExternal... ──► │
                                                                 cycle repeats
```

### Hook Handlers (Current)

```javascript
// src/plugin/index.js:432-437
const toolAfter = safeHook('tool.execute.after', async (input) => {
  stuckDetector.trackToolCall(input);
  await guardrails.onToolAfter(input);
  await refreshCmuxSidebar({ allowRetry: true });      // ← No debounce
  await refreshCmuxAttention({ allowRetry: true, trigger: { hook: "tool.execute.after", input } });  // ← No debounce
});
```

### refreshCmuxSidebar + refreshCmuxAttention (Current)

```javascript
// src/plugin/index.js:300-337
async function refreshCmuxSidebar(options = {}) {
  const currentCmuxAdapter = await getCurrentCmuxAdapter({ allowRetry: options.allowRetry === true });
  const { invalidateAll } = await import('./parsers/index.js');
  invalidateAll(projectDir);           // ← Called here
  const projectState = getProjectState(projectDir);  // ← Parsed here
  // ...
}

async function refreshCmuxAttention(options = {}) {
  const currentCmuxAdapter = await getCurrentCmuxAdapter({ allowRetry: options.allowRetry === true });
  const { invalidateAll } = await import('./parsers/index.js');
  invalidateAll(projectDir);           // ← Called AGAIN
  const projectState = getProjectState(projectDir);  // ← Parsed AGAIN
  // ...
}
```

## Proposed Solution

### Design Principle

**Two-layer architecture with single point of entry**:
1. **FileWatcher** (200ms debounce + self-write filtering) → calls coordinator
2. **CmuxEventCoordinator** (500ms debounce + semaphore) → single cmux refresh

### New Module: `cmux-event-coordinator.js`

```javascript
/**
 * CmuxEventCoordinator — debounced, throttled cmux sidebar sync.
 *
 * Features:
 * - 500ms debounce: waits for quiet period before refreshing
 * - Batching: accumulates events, does single invalidateAll + getProjectState
 * - Semaphore: max 3 concurrent cmux process spawns
 * - Unified: single refreshCmux() instead of separate sidebar + attention
 *
 * @module cmux-event-coordinator
 */

/**
 * Create a cmux event coordinator instance.
 *
 * @param {object} options
 * @param {string} options.cwd - Project working directory
 * @param {number} options.debounceMs - Quiet period before cmux refresh (default 500)
 * @param {number} options.maxConcurrent - Max concurrent cmux processes (default 3)
 * @param {Function} options.getProjectState - State getter
 * @param {Function} options.syncSidebar - Sidebar sync function
 * @param {Function} options.syncAttention - Attention sync function
 * @returns {{ enqueue: Function, refresh: Function, stop: Function }}
 */
export function createCmuxEventCoordinator(options = {}) {
  const {
    cwd,
    debounceMs = 500,
    maxConcurrent = 3,
    getProjectState,
    syncSidebar,
    syncAttention,
  } = options;

  // State
  let debounceTimer = null;
  let pendingTriggers = [];
  let running = 0;
  let stopped = false;

  /**
   * Enqueue an event trigger (debounced).
   * @param {string} trigger - Hook name or event type
   * @param {object} data - Event data
   */
  function enqueue(trigger, data = {}) {
    if (stopped) return;
    pendingTriggers.push({ trigger, data, timestamp: Date.now() });
    resetDebounce();
  }

  /**
   * Reset debounce timer.
   */
  function resetDebounce() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(flush, debounceMs);
  }

  /**
   * Flush pending events — called after debounce quiet period.
   */
  async function flush() {
    if (stopped || pendingTriggers.length === 0) return;
    if (running >= maxConcurrent) {
      // Retry after a short delay
      debounceTimer = setTimeout(flush, 100);
      return;
    }

    const triggers = pendingTriggers;
    pendingTriggers = [];

    running++;
    try {
      await refreshCmux(triggers);
    } finally {
      running--;
    }
  }

  /**
   * Single unified cmux refresh.
   * Does ONE invalidateAll + ONE getProjectState for all pending triggers.
   */
  async function refreshCmux(triggers) {
    const { invalidateAll } = await import('./parsers/index.js');
    invalidateAll(cwd);

    const projectState = getProjectState(cwd);
    if (!projectState) return;

    // Sidebar sync (parallel)
    await syncSidebar(projectState);

    // Attention sync (parallel)
    await syncAttention(projectState, {
      triggers,
      memory: cmuxAttentionMemory,
    });
  }

  /**
   * Stop the coordinator.
   */
  function stop() {
    stopped = true;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    pendingTriggers = [];
  }

  return { enqueue, stop };
}
```

### Architecture After

```
┌─────────────────────────────────────────────────────────────────┐
│  Event Sources                                                  │
│  ─────────────                                                  │
│  tool.execute.after ──┐                                        │
│  file.watcher.updated ─┼──► CmuxEventCoordinator ──► cmux sync  │
│  session.idle ────────┤     (500ms debounce + semaphore)       │
│  command.executed ─────┘                                        │
└─────────────────────────────────────────────────────────────────┘
         │
         │ (200ms debounce + self-write filtering)
         ▼
   FileWatcher ──► onExternalChange(filePath) ──► coordinator.enqueue()
```

### Hook Handlers (After)

```javascript
// src/plugin/index.js
const cmuxCoordinator = createCmuxEventCoordinator({
  cwd: projectDir,
  debounceMs: config.cmux_event_coordinator?.debounce_ms || 500,
  maxConcurrent: config.cmux_event_coordinator?.max_concurrent || 3,
  getProjectState,
  syncSidebar: (state) => syncCmuxSidebar(cachedAdapter, state),
  syncAttention: (state, opts) => syncCmuxAttention(cachedAdapter, state, opts),
});

// tool.execute.after
const toolAfter = safeHook('tool.execute.after', async (input) => {
  stuckDetector.trackToolCall(input);
  await guardrails.onToolAfter(input);
  cmuxCoordinator.enqueue('tool.execute.after', { input });
});

// event handler (session.idle, file.watcher.updated, command.executed)
const eventHandler = safeHook('event', async ({ event }) => {
  // ... other handling ...
  if (event.type === 'session.idle') {
    await idleValidator.onIdle();
    guardrails.clearBgsdCommandActive();
    cmuxCoordinator.enqueue('session.idle', { event });
  }
  if (event.type === 'file.watcher.updated') {
    // File watcher debounces internally, then calls coordinator
    handleExternalPlanningChange(event.path || event.filePath || null);
    cmuxCoordinator.enqueue('file.watcher.updated', { event });
  }
  if (event.type === 'command.executed') {
    cmuxCoordinator.enqueue('command.executed', { event });
  }
});
```

### FileWatcher Integration

The file watcher keeps its 200ms debounce for self-write filtering, but calls the coordinator on external changes:

```javascript
// src/plugin/file-watcher.js
function createFileWatcher(cwd, options = {}) {
  const { onExternalChange = null, ...rest } = options;

  // ... existing debounce logic ...

  function processPendingEvents() {
    // ... existing filtering logic ...
    if (externalPaths.length > 0) {
      invalidateAll(cwd);
      if (typeof onExternalChange === 'function') {
        for (const filePath of externalPaths) {
          onExternalChange(filePath);  // ← Calls coordinator.enqueue()
        }
      }
    }
  }

  // ... rest unchanged ...
}
```

## Key Design Decisions

### Why 500ms debounce?

- **File watcher uses 200ms** — file changes are lower-frequency and more bursty
- **Tool events are higher-frequency** — 500ms captures the quiet period between tool chains
- **session.idle should be immediate** — but idle fires after 30s of inactivity anyway, so debounce is acceptable

### Why a semaphore instead of a queue?

A queue would serialize all cmux calls, potentially causing long delays. A semaphore (max 3 concurrent) allows batching while preventing process flooding.

### Why keep file watcher debounce separate?

File watcher has **self-write filtering** (prevents feedback loops when the plugin writes files). This is orthogonal to cmux throttling and should remain in the file watcher layer.

## Changes Summary

| File | Change |
|------|--------|
| `src/plugin/cmux-event-coordinator.js` | **NEW** — debounce + semaphore coordinator |
| `src/plugin/file-watcher.js` | `onExternalChange` calls `coordinator.enqueue()` |
| `src/plugin/index.js` | Creates coordinator, all hooks call `coordinator.enqueue()` |
| `src/plugin/parsers/config.js` | Add `cmux_event_coordinator` config section |

## Config Schema

```javascript
// src/plugin/parsers/config.js
const configSchema = {
  // ... existing fields ...
  cmux_event_coordinator: {
    debounce_ms: { type: 'number', default: 500 },
    max_concurrent: { type: 'number', default: 3 },
  },
};
```

## Testing Considerations

1. **Load test**: Simulate 50 rapid tool executions, verify cmux process count stays ≤ 10
2. **Race test**: Verify attention memory updates are atomic
3. **Self-write test**: Verify file watcher self-write filtering still works after changes
4. **Graceful degradation**: If cmux is unavailable, coordinator should shed load gracefully

## Open Questions

1. Should `session.idle` events bypass the debounce for immediate feedback?
2. Should we add a metric for "cmux process pressure" to warn when approaching max concurrent?
3. Should the coordinator persist pending state across plugin restarts?

## Milestone Fit

This EDD is for a **future milestone** focused on:
- **Reliability** — prevents crash-inducing event storms
- **Performance** — reduces redundant parsing by ~50%
- **Consistency** — unified debounce strategy across all event sources

It does **not** change cmux UX behavior — the sidebar still updates with the same information, just more efficiently.
