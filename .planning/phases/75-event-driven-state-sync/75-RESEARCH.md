# Phase 75: Event-Driven State Sync - Research

**Researched:** 2026-03-09
**Domain:** Plugin event hooks, file system watching, editor notifications, idle validation
**Confidence:** HIGH

## Summary

Phase 75 adds four event-driven behaviors to the bGSD plugin: idle validation (EVNT-01), file watcher cache invalidation (EVNT-02), phase completion notifications (EVNT-03), and stuck/loop detection notifications (EVNT-04). The host editor provides native support for all four through its plugin event system: `session.idle` fires when the LLM goes idle, `file.watcher.updated` fires on filesystem changes, `tool.execute.after` provides tool call interception for stuck detection, and the plugin context's `$` shell API enables OS-level notifications.

The existing codebase already has the exact infrastructure needed: `invalidateAll()` clears all parser caches, `bgsd_validate` contains all validation logic, `safeHook` provides error boundaries, and the plugin's `getProjectState()` facade gives unified state access. The implementation is primarily about wiring existing capabilities into event handlers.

**Primary recommendation:** Use the host editor's native `event` hook to subscribe to `session.idle`, `file.watcher.updated`, and `tool.execute.after` events. Do NOT implement custom file watchers with `fs.watch` — the editor already provides `file.watcher.updated` events. Implement notification delivery via `osascript` (macOS) / `notify-send` (Linux) for critical notifications and context injection via `experimental.chat.system.transform` for routine notifications.

## User Constraints

These are locked decisions from CONTEXT.md that MUST be honored in planning:

1. **Idle validation auto-fixes silently** — correct STATE.md inconsistencies, log the fix, don't interrupt the user
2. **Validation scope:** STATE.md + ROADMAP.md cross-check + config.json schema validity + stale progress detection — NOT full plan-level cross-check
3. **Stale progress:** plans marked in-progress with no recent git activity get auto-fixed to paused; threshold configurable via settings
4. **"Idle" definition:** no LLM output AND no user typing/input for configured threshold (default 5s) — `session.idle` event from host editor
5. **Idle threshold configurable** via config.json settings
6. **Skip validation during active plan execution** (state is expected to be in flux)
7. **After auto-fix, don't re-validate until next user interaction** (prevents fix loops)
8. **If no `.planning/` directory, silently skip validation**
9. **Swallow all exceptions** — never let validation crash the plugin
10. **Minimal toast after auto-fix** (e.g., "State synced") — not detailed
11. **Idle validation disableable** via config.json toggle (`idle_validation.enabled`)
12. **File watcher scope:** `.planning/` files, `config.json`, and any files referenced by state
13. **Watch all file events:** creates, modifications, and deletes
14. **Configurable debounce** timing for handling rapid successive edits
15. **Plugin tracks own writes** — ignore self-changes to prevent feedback loops
16. **Use native OS file watchers** (fs.watch or similar) — not polling
17. **Reasonable cap on watched paths** (~500), log warning if exceeded
18. **External edits trigger cache invalidation only** — next read returns fresh data, no immediate validation
19. **Start watching after `.planning/` directory confirmed to exist** (not on plugin load, not lazy)
20. **Watcher errors: log and degrade gracefully** — skip that path, continue watching others
21. **No manual cache refresh command** — watcher handles everything
22. **Dual-channel notifications by severity:** important events → OS/editor system notifications; routine → agent context injection
23. **System notifications: severity-based persistence** — routine auto-dismiss, critical stays until dismissed
24. **Include suggested next action** in notifications (e.g., "Phase 72 complete. Next: /bgsd-plan-phase 73")
25. **Phase completion notifications include summary stats** (plans, tasks, duration)
26. **Per-category controls AND severity threshold** — layered notification configuration
27. **Deduplicate related events** within a time window into single notification
28. **Rate limiting** to prevent notification storms (cap at reasonable rate, queue/drop excess)
29. **Context-injected notifications use structured XML tags** (`<bgsd-notification type="phase-complete">...</bgsd-notification>`)
30. **Notification history:** last 10-20 notifications accessible via command + slash command wrapper (`/bgsd-notifications`)
31. **Do Not Disturb mode:** suppresses routine notifications, critical (stuck) still comes through; DND summary on resume
32. **Sound configurable per severity** (off by default)
33. **Stuck/loop trigger:** same tool call producing exact same error message 3+ times
34. **Also detect spinning:** non-error repetitive patterns (same tool call sequence repeating); configurable threshold
35. **Error loop threshold (default 3) configurable** via config.json
36. **On detection:** toast + inject system message to agent context + suggest pause for user input
37. **Notification includes diagnostic detail** (which tool, what error, how many failures)
38. **Counter resets** on user input OR on successful tool call
39. **Escalation:** if stuck detection fires 2nd time same session, stronger warning

## Phase Requirements

| Req ID | Description | How Addressed |
|--------|-------------|---------------|
| EVNT-01 | Session idle handler auto-validates STATE.md consistency (debounced, 5s minimum cooldown) | `event` hook subscribes to `session.idle`, runs validation with debounce, auto-fixes STATE.md |
| EVNT-02 | File watcher invalidates in-memory state cache when `.planning/` files change | `event` hook subscribes to `file.watcher.updated` OR native `fs.watch` with recursive option, calls `invalidateAll()` |
| EVNT-03 | Toast notifications fire on phase completion events | Detect phase completion in `tool.execute.after` (when bgsd_progress advances) or via state comparison on idle |
| EVNT-04 | Toast notifications fire on stuck/loop detection (3+ repeated failures) | Track tool calls in `tool.execute.after`, detect repetition patterns, fire notification |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `fs.watch` | v18+ (built-in) | File system watching | Native, zero dependencies, recursive support on Linux/macOS since Node 19.1+ |
| Node.js `fs` | v18+ (built-in) | File reading/writing for auto-fix | Already used throughout plugin |
| AbortController | v18+ (built-in) | Clean watcher shutdown | Standard cancellation pattern for fs.watch |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `osascript` (macOS) | System | OS-level notifications | Critical notifications on macOS |
| `notify-send` (Linux) | System | OS-level notifications | Critical notifications on Linux |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `fs.watch` (native) | chokidar | chokidar adds 500KB+ dependency; zero-dependency rule prohibits it |
| Custom `fs.watch` | Host editor's `file.watcher.updated` event | Editor event is simpler but may not cover all `.planning/` files or config.json; unclear what scope the editor watches |
| `notify-send` / `osascript` | Host editor's `client` SDK | Official docs don't show a direct toast API callable from plugins; `tui.toast.show` is listed as an event type but not clearly documented as callable |

## Architecture Patterns

### Recommended Project Structure

```
src/plugin/
  index.js              # Plugin entry point — wire new event handlers here
  idle-validator.js     # NEW: Idle validation logic + auto-fix
  file-watcher.js       # NEW: File watcher + cache invalidation
  notification.js       # NEW: Notification delivery (OS + context injection)
  stuck-detector.js     # NEW: Stuck/loop detection + counter tracking
  logger.js             # EXISTING: Reuse for all new logging
  safe-hook.js          # EXISTING: Wrap all new handlers
  parsers/index.js      # EXISTING: invalidateAll() for cache clearing
  project-state.js      # EXISTING: getProjectState() for validation reads
  tools/bgsd-validate.js # EXISTING: Validation logic (extract shared helpers)
```

### Pattern 1: Event Handler Registration

The plugin's `event` hook receives ALL events and dispatches by type. Use a single `event` handler that routes to subsystems:

```javascript
export const BgsdPlugin = async ({ directory, client, $ }) => {
  const idleValidator = createIdleValidator(directory);
  const stuckDetector = createStuckDetector();
  const notifier = createNotifier($, directory);
  
  return {
    // ...existing hooks...
    event: safeHook('event', async ({ event }) => {
      switch (event.type) {
        case 'session.idle':
          await idleValidator.onIdle();
          break;
        case 'file.watcher.updated':
          // Host editor file watcher — invalidate caches
          fileWatcher.onFileChanged(event);
          break;
      }
    }),
    'tool.execute.after': safeHook('tool.execute.after', async (input) => {
      stuckDetector.trackToolCall(input);
    }),
  };
};
```

### Pattern 2: Self-Change Tracking (Feedback Loop Prevention)

The idle validator writes to STATE.md, which triggers the file watcher, which invalidates caches. Track own writes:

```javascript
const selfWrites = new Set(); // paths we're about to write

function writeSelfTracked(filePath, content) {
  selfWrites.add(filePath);
  writeFileSync(filePath, content, 'utf-8');
  // Clear after brief delay to ensure watcher event has fired
  setTimeout(() => selfWrites.delete(filePath), 100);
}

function onFileChanged(filePath) {
  if (selfWrites.has(filePath)) return; // Ignore our own writes
  invalidateAll(cwd);
}
```

### Pattern 3: Debounced Validation with Re-entry Guard

```javascript
function createIdleValidator(cwd) {
  let lastValidation = 0;
  let lastAutoFix = 0;
  let validating = false;
  const COOLDOWN_MS = 5000; // minimum 5s between validations
  
  return {
    async onIdle() {
      const now = Date.now();
      // Skip if recently auto-fixed (wait for user interaction)
      if (lastAutoFix > lastValidation) return;
      // Skip if within cooldown
      if (now - lastValidation < COOLDOWN_MS) return;
      // Skip if already running
      if (validating) return;
      
      validating = true;
      try {
        const issues = runValidation(cwd);
        if (issues.autoFixable.length > 0) {
          applyAutoFixes(issues.autoFixable);
          lastAutoFix = Date.now();
          // Show minimal toast
        }
      } finally {
        lastValidation = Date.now();
        validating = false;
      }
    }
  };
}
```

### Pattern 4: Notification Delivery — Dual Channel

```javascript
function createNotifier($, directory) {
  const history = []; // Ring buffer of last 20 notifications
  let dndMode = false;
  let pendingContext = []; // Notifications to inject into next system prompt
  
  async function notify(notification) {
    history.push({ ...notification, timestamp: Date.now() });
    if (history.length > 20) history.shift();
    
    if (dndMode && notification.severity !== 'critical') return;
    
    if (notification.severity === 'critical' || notification.severity === 'warning') {
      // OS notification
      await sendOsNotification($, notification);
    }
    
    // Queue for context injection
    pendingContext.push(notification);
  }
  
  function drainPendingContext() {
    const items = [...pendingContext];
    pendingContext = [];
    return items;
  }
  
  return { notify, drainPendingContext, history };
}
```

### Pattern 5: Stuck/Loop Detection State Machine

```javascript
function createStuckDetector() {
  const toolHistory = []; // last N tool calls
  let errorStreak = new Map(); // toolName+error -> count
  let escalationLevel = 0;

  function trackToolCall(input) {
    const key = `${input.tool}:${input.error || ''}`;
    
    if (input.error) {
      const count = (errorStreak.get(key) || 0) + 1;
      errorStreak.set(key, count);
      if (count >= threshold) {
        fireStuckNotification(input, count, escalationLevel);
        escalationLevel++;
      }
    } else {
      // Success resets counters
      errorStreak.clear();
    }
  }
  
  function onUserInput() {
    errorStreak.clear();
    escalationLevel = 0;
  }
  
  return { trackToolCall, onUserInput };
}
```

### Anti-Patterns to Avoid

1. **Don't poll for file changes** — use event-driven approach exclusively (host editor events + fs.watch if needed)
2. **Don't validate during active plan execution** — check for execution state before running validation
3. **Don't use synchronous file operations in event handlers** — async handlers required to avoid blocking the editor
4. **Don't create a custom caching layer** — reuse existing parser cache invalidation (`invalidateAll()`)
5. **Don't store notification state globally** — scope to plugin instance to support multiple sessions
6. **Don't fire notifications from within safeHook error boundary** — notifications should be the outermost layer

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File system watching | Custom polling or inotify wrapper | Node.js `fs.watch` with `{ recursive: true }` + host editor `file.watcher.updated` events | Native support, zero dependencies |
| Cache invalidation | Custom cache management | Existing `invalidateAll()` from `parsers/index.js` | Already implemented and tested |
| Error boundaries | Custom try-catch wrappers | Existing `safeHook()` from `safe-hook.js` | Has retry, timeout, circuit breaker, correlation logging |
| STATE.md validation | New validation logic | Existing `bgsd_validate` logic from `tools/bgsd-validate.js` | Already comprehensive — extract shared helpers |
| Project state access | Direct file reads | Existing `getProjectState()` from `project-state.js` | Cached, frozen, unified facade |
| Shell command execution | `child_process.exec` | Host editor's `$` (Bun shell API) passed in plugin context | Cross-platform, properly sandboxed |
| STATE.md manipulation | New regex/string manipulation | Existing helpers from `bgsd-progress.js` (`updateProgress`, `addBlocker`, `recordDecision`) | Already tested STATE.md mutation patterns |

## Common Pitfalls

### Pitfall 1: Feedback Loop Between Auto-Fix and File Watcher
**What goes wrong:** Idle validation writes to STATE.md → file watcher sees change → invalidates cache → triggers re-read → idle fires again → infinite loop
**Why it happens:** File system events don't distinguish between self-writes and external writes
**How to avoid:** Track own writes in a Set, clear after brief delay. After auto-fix, skip validation until next user interaction.
**Warning signs:** Log shows rapid repeated validation runs, STATE.md written multiple times in quick succession

### Pitfall 2: fs.watch Recursive Portability
**What goes wrong:** `fs.watch({ recursive: true })` fails silently on older Linux kernels
**Why it happens:** Recursive watching added to Linux in Node.js v19.1.0 (inotify-based). Node v18 doesn't support recursive on Linux.
**How to avoid:** Target Node 18+ is our requirement — but recursive may not be reliable. Consider the host editor's `file.watcher.updated` event as primary mechanism, with `fs.watch` as fallback only if editor events don't cover needed paths.
**Warning signs:** Watcher stops reporting changes after `.planning/` subdirectory creation

### Pitfall 3: Event Ordering and Race Conditions
**What goes wrong:** File watcher fires cache invalidation AFTER validation read but BEFORE validation write
**Why it happens:** Event handlers are async; multiple events can interleave
**How to avoid:** Use mutex/flag (`validating = true`) to prevent re-entrant validation. Use debounce for file watcher events.
**Warning signs:** Validation reads stale data despite watcher being active

### Pitfall 4: Notification Storm During Bulk Operations
**What goes wrong:** User manually edits 10 files in `.planning/` → 10 file watcher events → 10 notifications
**Why it happens:** Each file change fires independently
**How to avoid:** Debounce file watcher events (e.g., 200ms window). Rate-limit notifications. Deduplicate within time window.
**Warning signs:** Multiple "State synced" toasts in rapid succession

### Pitfall 5: Stuck Detection False Positives
**What goes wrong:** Normal retry behavior (e.g., permission retry) triggers stuck detection
**Why it happens:** Threshold too low or pattern matching too broad
**How to avoid:** Only match exact same error string, not similar errors. Configurable threshold (default 3). Reset on any successful tool call.
**Warning signs:** Stuck notification fires during normal git operations or build retries

### Pitfall 6: Bundle Size Impact of New Modules
**What goes wrong:** Adding 4+ new modules significantly increases plugin.js bundle
**Why it happens:** Each new module adds code; bundler includes all transitively
**How to avoid:** New modules should use only existing imports (fs, path, etc). No new npm dependencies. Keep modules small and focused.
**Warning signs:** Plugin build shows >50KB increase

## Code Examples

### Event Handler Registration (from official docs, HIGH confidence)

```javascript
// From OpenCode plugin docs — event subscription pattern
export const Plugin = async ({ project, client, $, directory }) => {
  return {
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        // session went idle — run validation
      }
      if (event.type === "file.watcher.updated") {
        // file changed — invalidate caches
      }
    },
    "tool.execute.after": async (input) => {
      // Track tool execution for stuck detection
      // input.tool — tool name
      // input.args — tool arguments
      // input.sessionID — session identifier
    },
  };
};
```

### OS Notification via $ Shell API (from official docs, HIGH confidence)

```javascript
// macOS notification
await $`osascript -e 'display notification "Phase 75 complete!" with title "bGSD"'`;

// Linux notification (best effort)
await $`notify-send "bGSD" "Phase 75 complete!"`.quiet();
```

### Context Injection for Routine Notifications (from existing codebase, HIGH confidence)

```javascript
// Inject notification into system prompt via existing hook
"experimental.chat.system.transform": async (input, output) => {
  const pending = notifier.drainPendingContext();
  if (pending.length > 0) {
    const xml = pending.map(n => 
      `<bgsd-notification type="${n.type}" severity="${n.severity}">${n.message}</bgsd-notification>`
    ).join('\n');
    output.system.push(xml);
  }
};
```

### fs.watch with AbortController (from Node.js docs, HIGH confidence)

```javascript
const controller = new AbortController();
const watcher = fs.watch('.planning', { 
  recursive: true, 
  signal: controller.signal 
}, (eventType, filename) => {
  // eventType: 'rename' or 'change'
  // filename: relative path within watched directory
  invalidateAll(cwd);
});

// Clean shutdown
controller.abort(); // stops the watcher
```

### config.json Settings for Phase 75 Features

```json
{
  "idle_validation": {
    "enabled": true,
    "cooldown_seconds": 5,
    "staleness_threshold_hours": 2
  },
  "notifications": {
    "enabled": true,
    "os_notifications": true,
    "dnd_mode": false,
    "rate_limit_per_minute": 5,
    "sound": false
  },
  "stuck_detection": {
    "error_threshold": 3,
    "spinning_threshold": 5
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual `init:state` subprocess calls | Plugin `getProjectState()` in-process | Phase 73 (v9.0) | Foundation for idle validation — no subprocess overhead |
| No file watching | Host editor emits `file.watcher.updated` events | Current host editor version | Plugin can react to file changes without custom watchers |
| `console.log` for feedback | Host editor supports `session.idle`, `tool.execute.after` events | Current host editor version | Structured event system replaces ad-hoc logging |
| No notification support | Host editor `$` shell API + OS notification commands | Current host editor version | Cross-platform notification delivery |
| Subprocess `gsd-tools validate` | In-process `bgsd_validate` tool | Phase 74 (v9.0) | Validation logic already in plugin — reusable for idle validation |

## Open Questions

1. **`file.watcher.updated` event scope:** Does the host editor's file watcher cover `.planning/` subdirectories and `config.json`? If not, we need `fs.watch` as primary watcher. **Recommendation:** Implement both — use editor events when available, supplement with `fs.watch` for `.planning/` directory.

2. **`file.watcher.updated` event data:** What properties does the event object carry? Path? Event type? **Recommendation:** Test empirically during implementation. Fall back to full `invalidateAll()` if path data is unavailable.

3. **`tui.toast.show` — callable or receive-only?** Listed as TUI event but docs don't show how to fire it from a plugin. May be a receive-only event for the TUI to display. **Recommendation:** Use OS notifications (`osascript`/`notify-send`) for critical notifications and context injection for routine ones. Don't depend on `tui.toast.show` being callable.

4. **Active plan execution detection:** How to know if a plan is actively executing? **Recommendation:** Check STATE.md `Status` field for "executing" or similar. Or track via `tool.execute.before/after` for bgsd_progress tool calls.

5. **Session ID availability in `event` handler:** The event handler receives `{ event }` — does `session.idle` include session ID? **Recommendation:** Track session state with Maps keyed by session ID (pattern from community guide).

## Sources

### Primary (HIGH confidence)
- **OpenCode Plugin Docs** — https://opencode.ai/docs/plugins/ — Official documentation, verified 2026-03-09. Confirms `event` hook, event types (`session.idle`, `file.watcher.updated`, `tool.execute.after`), `$` shell API, custom tools pattern.
- **Node.js fs.watch API** — https://nodejs.org/api/fs.html — Official Node.js docs. `fs.watch(path, { recursive: true, signal })` with AbortController support. Recursive on Linux since Node 19.1+.
- **Existing Codebase** — `src/plugin/` directory. All parsers, `invalidateAll()`, `safeHook()`, `getProjectState()`, `bgsd_validate`, `bgsd_progress` already implemented.

### Secondary (MEDIUM confidence)
- **OpenCode Plugins Guide (community)** — https://gist.github.com/johnlindquist/0adf1032b4e84942f3e1050aba3c5e4a — Comprehensive community guide, January 2026. Detailed examples of event handlers, session state management, tool interception. Aligns with official docs.

### Tertiary (LOW confidence)
- **`tui.toast.show` callability** — Listed in official event types but no documentation on how to fire it from plugin code. May be receive-only. LOW confidence on toast API availability.

## Metadata

**Confidence breakdown:**
- EVNT-01 (Idle validation): HIGH — `session.idle` event confirmed in official docs + community guide
- EVNT-02 (File watcher): HIGH for `fs.watch`, MEDIUM for `file.watcher.updated` event data
- EVNT-03 (Phase completion notifications): HIGH — detection via state comparison + OS notification delivery
- EVNT-04 (Stuck detection): HIGH — `tool.execute.after` confirmed, pattern matching straightforward

**Research date:** 2026-03-09
**Valid until:** 2026-06-09 (3 months — host editor plugin API may change)
