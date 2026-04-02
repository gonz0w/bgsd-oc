import { existsSync } from 'fs';
import { join } from 'path';
import { safeHook } from './safe-hook.js';
import { createToolRegistry } from './tool-registry.js';
import { buildSystemPrompt, buildCompactionContext, buildMemorySnapshot } from './context-builder.js';
import { enrichCommand } from './command-enricher.js';
import { getProjectState } from './project-state.js';
import { getTools } from './tools/index.js';
import { createNotifier } from './notification.js';
import { createFileWatcher } from './file-watcher.js';
import { createIdleValidator } from './idle-validator.js';
import { createStuckDetector } from './stuck-detector.js';
import { createAdvisoryGuardrails } from './advisory-guardrails.js';
import { createCmuxRefreshBackbone } from './cmux-refresh-backbone.js';
import { createAttachedCmuxAdapter, createNoopCmuxAdapter, resolveCmuxAvailability, suppressionReason } from './cmux-targeting.js';
import { syncCmuxSidebar } from './cmux-sidebar-sync.js';
import { createAttentionMemory, syncCmuxAttention } from './cmux-attention-sync.js';
import { parseConfig } from './parsers/config.js';
import { invalidateAll } from './parsers/index.js';
import { writeDebugDiagnostic } from './debug-contract.js';
import { getToolAvailability } from './tool-availability.js';

const cmuxAdapterCache = new Map();
const cmuxAdapterRetryState = new Map();
const CMUX_RETRY_COOLDOWN_MS = 3000;
const NON_RETRYABLE_CMUX_SUPPRESSION_REASONS = new Set([
  'missing-env',
  'workspace-mismatch',
  'surface-mismatch',
  'missing-methods',
  'access-mode-off',
  'access-mode-blocked',
]);

function buildCmuxCacheKey(projectDir, env = process.env) {
  return JSON.stringify({
    projectDir,
    workspaceId: env.CMUX_WORKSPACE_ID || null,
    surfaceId: env.CMUX_SURFACE_ID || null,
    socketPath: env.CMUX_SOCKET_PATH || null,
    socketMode: env.CMUX_SOCKET_MODE || null,
  });
}

async function getCachedCmuxAdapter(projectDir, options = {}) {
  const env = options.env || process.env;
  const cacheKey = buildCmuxCacheKey(projectDir, env);
  const allowRetry = options.allowRetry === true;
  const now = Number(options.now ?? Date.now());
  const cmuxClient = options.client
    || (typeof options.ping === 'function'
      || typeof options.setStatus === 'function'
      || typeof options.sidebarState === 'function'
      ? options
      : null);

  if (cmuxAdapterCache.has(cacheKey)) {
    const cachedAdapter = await cmuxAdapterCache.get(cacheKey);
    const suppressionReason = cachedAdapter?.suppressionReason || cachedAdapter?.verdict?.suppressionReason || null;
    const retryableSuppression = suppressionReason === null
      || !NON_RETRYABLE_CMUX_SUPPRESSION_REASONS.has(suppressionReason);
    const lastRetryAt = cmuxAdapterRetryState.get(cacheKey) || 0;

    if (!allowRetry || cachedAdapter?.attached || !retryableSuppression || (now - lastRetryAt) < CMUX_RETRY_COOLDOWN_MS) {
      return cachedAdapter;
    }

    cmuxAdapterRetryState.set(cacheKey, now);
    cmuxAdapterCache.delete(cacheKey);
  }

  const adapterPromise = (async () => {
    try {
      const resolveAvailability = typeof options.resolveAvailability === 'function'
        ? options.resolveAvailability
        : resolveCmuxAvailability;
      const verdict = await resolveAvailability({
        projectDir,
        env,
        cmux: cmuxClient,
        command: options.command,
        timeoutMs: options.timeoutMs,
        maxBuffer: options.maxBuffer,
      });
      if (verdict?.attached) {
        return createAttachedCmuxAdapter(verdict, {
          projectDir,
          env,
          cmux: cmuxClient,
          command: options.command,
          timeoutMs: options.timeoutMs,
          maxBuffer: options.maxBuffer,
        });
      }
      return createNoopCmuxAdapter(verdict);
    } catch (error) {
      writeDebugDiagnostic('[bgsd-plugin]', `cmux initialization failed (non-fatal): ${error.message || String(error)}`);
      return createNoopCmuxAdapter({
        available: false,
        attached: false,
        mode: 'none',
        suppressionReason: 'cmux-init-failed',
        workspaceId: null,
        surfaceId: null,
        writeProven: false,
      });
    }
  })();

  cmuxAdapterCache.set(cacheKey, adapterPromise);
  return adapterPromise;
}

function clearCachedCmuxAdapter(projectDir, options = {}) {
  const env = options.env || process.env;
  const cacheKey = buildCmuxCacheKey(projectDir, env);
  cmuxAdapterCache.delete(cacheKey);
  cmuxAdapterRetryState.delete(cacheKey);
}

function buildCmuxSuppressionNotification(cmuxAdapter) {
  const reason = suppressionReason(cmuxAdapter);
  if (!reason || cmuxAdapter?.attached) return null;

  if (cmuxAdapter?.mode !== 'managed' || !cmuxAdapter?.workspaceId) {
    return null;
  }

  const detailByReason = {
    'write-probe-failed': 'workspace write probe failed',
    'workspace-mismatch': 'workspace identity did not match this terminal',
    'surface-mismatch': 'surface identity did not match this terminal',
    'identify-unavailable': 'cmux could not confirm terminal identity',
    'missing-env': 'required cmux workspace environment is incomplete',
    'missing-methods': 'cmux capability metadata did not expose legacy sidebar commands',
    'capabilities-unavailable': 'cmux capabilities could not be read',
    'access-mode-off': 'cmux socket access is turned off',
  };

  const detail = detailByReason[reason] || reason.replace(/-/g, ' ');
  return {
    type: 'cmux-suppressed',
    severity: 'info',
    message: `bGSD cmux integration suppressed: ${detail}. Sidebar status, logs, and notifications stay off for this session.`,
  };
}

export function resetCmuxAdapterCache() {
  cmuxAdapterCache.clear();
  cmuxAdapterRetryState.clear();
}

// Re-export parsers, tool registry, and safeHook for external consumption
export { parseState, invalidateState } from './parsers/state.js';
export { parseRoadmap, invalidateRoadmap } from './parsers/roadmap.js';
export { parsePlan, parsePlans, invalidatePlans } from './parsers/plan.js';
export { parseConfig, invalidateConfig } from './parsers/config.js';
export { parseProject, invalidateProject } from './parsers/project.js';
export { parseIntent, invalidateIntent } from './parsers/intent.js';
export { invalidateAll } from './parsers/index.js';
export { getProjectState } from './project-state.js';
export { buildSystemPrompt, buildCompactionContext, buildMemorySnapshot } from './context-builder.js';
export { enrichCommand, elideConditionalSections } from './command-enricher.js';
export { createToolRegistry } from './tool-registry.js';
export { safeHook } from './safe-hook.js';
export { createNotifier } from './notification.js';
export { createFileWatcher } from './file-watcher.js';
export { createIdleValidator } from './idle-validator.js';
export { createStuckDetector } from './stuck-detector.js';
export { createAdvisoryGuardrails } from './advisory-guardrails.js';
export { syncCmuxSidebar, BGSD_STATE_KEY, BGSD_CONTEXT_KEY, BGSD_ACTIVITY_KEY } from './cmux-sidebar-sync.js';

/**
 * bGSD (Get Stuff Done) — Plugin Entry Point
 *
 * Provides session lifecycle integration for the bGSD planning system:
 * - Session greeting with plugin availability notice
 * - System prompt injection with current project state (Phase 73 P01)
 * - Enhanced compaction with structured XML context preservation (Phase 73 P02)
 * - Command enrichment: auto-injects init-equivalent context for /bgsd-* commands (Phase 73 P02)
 * - In-process parsers for STATE.md, ROADMAP.md, PLAN.md, config.json, PROJECT.md, INTENT.md
 * - Unified ProjectState facade for cached data access
 * - Tool registry with bgsd_ prefix enforcement
 * - Event-driven state sync: idle validation, file watching, stuck detection (Phase 75)
 * - Notification system with dual-channel routing (OS + context injection)
 * - Advisory guardrails: convention, planning file, test suggestion warnings (Phase 76)
 *
 * Hooks registered (5 total):
 * 1. experimental.chat.system.transform — compact system prompt + notification injection
 * 2. experimental.session.compacting — structured XML context preservation
 * 3. command.execute.before — slash command enrichment
 * 4. event — session.idle + file.watcher.updated dispatch
 * 5. tool.execute.after — stuck/loop detection
 *
 * All hooks are wrapped in safeHook for universal error boundary protection:
 * retry, timeout, circuit breaker, correlation-ID logging.
 *
 * Hook signature: (input, output) => Promise<void>
 * Source uses ESM imports — esbuild produces clean ESM output.
 */
export const BgsdPlugin = async ({ directory, $, cmux } = {}) => {
  // Initialize tool registry
  const registry = createToolRegistry(safeHook);

  // Initialize Phase 75 event subsystems
  const projectDir = directory || process.cwd();
  const cmuxOptions = cmux || {};
  const config = parseConfig(projectDir);
  const notifier = createNotifier($, projectDir);
  let cmuxAdapter = await getCachedCmuxAdapter(projectDir, cmuxOptions);
  const cmuxAttentionMemory = createAttentionMemory();
  const cmuxSuppressionNotification = buildCmuxSuppressionNotification(cmuxAdapter);

  async function getCurrentCmuxAdapter(options = {}) {
    cmuxAdapter = await getCachedCmuxAdapter(projectDir, {
      ...cmuxOptions,
      ...options,
    });
    return cmuxAdapter;
  }

  if (cmuxSuppressionNotification) {
    await notifier.notify(cmuxSuppressionNotification);
  }

  // Best-effort tool cache warmup so first subagent handoffs have fresh availability data.
  try {
    if (existsSync(join(projectDir, '.planning'))) {
      getToolAvailability(projectDir, { refreshIfNeeded: true });
    }
  } catch {
    // Tool cache warmup is advisory only.
  }

  const memorySnapshotState = {
    text: null,
    stale: false,
    staleNoticeSent: false,
    buildWarningsSent: false,
  };

  async function notifyMemorySnapshotBuildWarnings(snapshot) {
    if (memorySnapshotState.buildWarningsSent || !snapshot) return;

    for (const warning of snapshot.blockedWarnings || []) {
      const message = warning.category === 'parse-failure'
        ? 'MEMORY.md could not be parsed, so no memory snapshot was injected.'
        : `Blocked ${warning.count} MEMORY.md entr${warning.count === 1 ? 'y' : 'ies'} (${warning.category}): ${warning.snippet}`;
      await notifier.notify({
        type: 'memory-blocked',
        severity: 'info',
        message,
      });
    }

    if (snapshot.budgetWarning) {
      await notifier.notify({
        type: 'memory-budget',
        severity: 'info',
        message: snapshot.budgetWarning,
      });
    }

    memorySnapshotState.buildWarningsSent = true;
  }

  async function getOrBuildMemorySnapshot(cwd) {
    if (memorySnapshotState.text !== null) {
      return memorySnapshotState.text;
    }

    const snapshot = buildMemorySnapshot(cwd);
    memorySnapshotState.text = snapshot.text || '';
    await notifyMemorySnapshotBuildWarnings(snapshot);
    return memorySnapshotState.text;
  }

  async function handleExternalPlanningChange(filePath) {
    if (!filePath || !filePath.endsWith(join('.planning', 'MEMORY.md'))) {
      return;
    }
    if (memorySnapshotState.text === null || memorySnapshotState.stale) {
      return;
    }

    memorySnapshotState.stale = true;
    if (!memorySnapshotState.staleNoticeSent) {
      memorySnapshotState.staleNoticeSent = true;
      await notifier.notify({
        type: 'memory-stale',
        severity: 'info',
        message: 'MEMORY.md changed on disk; restart or refresh the session to load the new snapshot.',
      });
    }
  }

  const fileWatcher = createFileWatcher(projectDir, {
    debounceMs: config.file_watcher?.debounce_ms || 200,
    maxPaths: config.file_watcher?.max_watched_paths || 500,
    onExternalChange: (filePath) => {
      void handleExternalPlanningChange(filePath);
      void handleExternalCmuxPlanningChange(filePath);
    },
  });
  const idleValidator = createIdleValidator(projectDir, notifier, fileWatcher, config);
  const stuckDetector = createStuckDetector(notifier, config);
  const guardrails = createAdvisoryGuardrails(projectDir, notifier, config);

  const cmuxRefreshBackbone = createCmuxRefreshBackbone({
    projectDir,
    invalidateAll,
    getProjectState,
    getCurrentCmuxAdapter,
    getNotificationHistory: () => notifier.getHistory(),
    syncCmuxSidebar,
    syncCmuxAttention,
    attentionMemory: cmuxAttentionMemory,
    onError(error) {
      writeDebugDiagnostic('[bgsd-plugin]', `cmux coordinated refresh failed (non-fatal): ${error.message || String(error)}`);
    },
  });

  function isPlanningFilePath(filePath) {
    return typeof filePath === 'string' && filePath.includes(join('.planning', ''));
  }

  async function enqueueCmuxRefresh(trigger = {}, options = {}) {
    const filePath = trigger.filePath || trigger.event?.path || trigger.event?.filePath || null;
    const wakeSuppressedCmux = isPlanningFilePath(filePath)
      && !filePath.endsWith(join('.planning', 'MEMORY.md'))
      && !cmuxAdapter?.attached
      && Boolean(suppressionReason(cmuxAdapter));

    if (wakeSuppressedCmux) {
      clearCachedCmuxAdapter(projectDir, cmuxOptions);
    }

    return options.immediate === true
      ? cmuxRefreshBackbone.refreshNow(trigger, options)
      : cmuxRefreshBackbone.enqueue(trigger, options);
  }

  async function handleExternalCmuxPlanningChange(filePath) {
    if (!filePath || filePath.endsWith(join('.planning', 'MEMORY.md'))) {
      return;
    }

    clearCachedCmuxAdapter(projectDir, cmuxOptions);
    await enqueueCmuxRefresh({ hook: 'file.watcher.external', filePath }, { allowRetry: true });
  }

  // Start file watcher for .planning/ directory
  fileWatcher.start();
  await enqueueCmuxRefresh({ hook: 'startup' }, { immediate: true });

  // ENR-03: Background cache warm-up — non-blocking, runs after plugin init completes.
  // Calls getProjectState to trigger parsing + SQLite write-through for all planning files,
  // so the first user command hits a warm cache.
  // Per CONTEXT.md decision: "Background warm on plugin load: When the plugin initializes
  // (editor startup), kick off background cache warm-up so the first user command already
  // has a warm cache."
  setTimeout(() => {
    try {
      getProjectState(projectDir);
    } catch {
      // Warm-up failure is non-fatal — enricher falls back to cold-cache parse
      writeDebugDiagnostic('[bgsd-plugin]', 'background warm-up failed (non-fatal)');
    }
  }, 0);

  // Enhanced compaction: structured XML blocks preserving project, task, decisions, intent, session
  // Replaces Phase 71's raw STATE.md dump with rich context per CONTEXT.md decisions
  const compacting = safeHook('compacting', async (input, output) => {
    const projectDir = directory || process.cwd();
    const ctx = buildCompactionContext(projectDir);
    if (ctx && output && output.context) {
      output.context.push(ctx);
    }
  });

  const systemTransform = safeHook('system.transform', async (input, output) => {
    const sysDir = directory || process.cwd();
    const memorySnapshot = await getOrBuildMemorySnapshot(sysDir);
    const prompt = buildSystemPrompt(sysDir, { memorySnapshot });
    if (prompt && output && output.system) {
      output.system.push(prompt);
    }

    // Drain pending notifications into system context
    const pending = notifier.drainPendingContext();
    if (pending.length > 0 && output && output.system) {
      const xml = pending.map(n =>
        `<bgsd-notification type="${n.type}" severity="${n.severity}">${n.message}${n.action ? ` Action: ${n.action}` : ''}</bgsd-notification>`
      ).join('\n');
      output.system.push(xml);
    }
  });

  // Command enrichment: auto-inject init-equivalent context for all /bgsd-* commands
  // Prepends <bgsd-context> JSON block to output.parts before workflow execution
  const commandEnrich = safeHook('command.enrich', async (input, output) => {
    const cmdDir = directory || process.cwd();
    const normalizedCommand = typeof input?.command === 'string'
      ? input.command.trim().replace(/^\//, '').split(/\s+/, 1)[0]
      : '';
    // Set guardrails flag for bGSD commands — suppresses planning file warnings
    if (normalizedCommand.startsWith('bgsd-')) {
      guardrails.setBgsdCommandActive();
    }
    enrichCommand(input, output, cmdDir);
  });

  // Event handler: session.idle triggers validation, file.watcher.updated triggers cache invalidation
  const eventHandler = safeHook('event', async ({ event }) => {
    if (event.type === 'session.idle') {
      await idleValidator.onIdle();
      guardrails.clearBgsdCommandActive();
      await enqueueCmuxRefresh({ hook: 'session.idle', event }, { allowRetry: true });
    }
    if (event.type === 'file.watcher.updated') {
      await handleExternalPlanningChange(event.path || event.filePath || null);
      await enqueueCmuxRefresh({ hook: 'file.watcher.updated', event }, { allowRetry: true });
    }
    if (event.type === 'command.executed') {
      await enqueueCmuxRefresh({ hook: 'command.executed', event }, { allowRetry: true });
    }
  });

  // Tool execution tracking for stuck/loop detection + advisory guardrails
  const toolAfter = safeHook('tool.execute.after', async (input) => {
    stuckDetector.trackToolCall(input);
    await guardrails.onToolAfter(input);
    await enqueueCmuxRefresh({ hook: 'tool.execute.after', input }, { allowRetry: true });
  });

  return {
    'experimental.session.compacting': compacting,
    'experimental.chat.system.transform': systemTransform,
    'command.execute.before': commandEnrich,
    'event': eventHandler,
    'tool.execute.after': toolAfter,
    get cmuxAdapter() {
      return cmuxAdapter;
    },
    tool: getTools(registry),
  };
};
