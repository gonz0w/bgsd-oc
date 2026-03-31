import { watch } from 'fs';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { invalidateAll } from './parsers/index.js';
import { createLogger } from './logger.js';

/**
 * File watcher with cache invalidation and self-change tracking.
 *
 * Watches `.planning/` directory recursively using fs.watch with AbortController.
 * On external file changes, calls invalidateAll() to clear parser caches.
 * Self-writes are tracked to prevent feedback loops (e.g., idle validator writing
 * STATE.md should not trigger cache invalidation → re-validation).
 *
 * Features:
 * - Recursive fs.watch with AbortController for clean shutdown
 * - Debounced event processing (configurable, default 200ms)
 * - Self-write tracking with auto-clear (200ms timeout)
 * - Graceful degradation on watcher errors
 * - Event count monitoring with configurable cap warning
 *
 * @module file-watcher
 */

/**
 * Create a file watcher instance for a project directory.
 *
 * @param {string} cwd - Project working directory
 * @param {{ debounceMs?: number, maxWatchedPaths?: number, onExternalChange?: Function }} [options] - Configuration
 * @returns {{ start: Function, stop: Function, trackSelfWrite: Function, isWatching: Function }}
 */
export function createFileWatcher(cwd, options = {}) {
  const { debounceMs = 200, maxWatchedPaths = 500, onExternalChange = null } = options;

  const planningDir = join(cwd, '.planning');

  // State
  let controller = null;
  let watching = false;
  let debounceTimer = null;
  let pendingPaths = new Set();
  let eventCount = 0;
  let capWarned = false;

  // Self-write tracking: paths we're about to write (auto-clear after 200ms)
  const selfWrites = new Set();
  const selfWriteTimers = new Map();

  // Lazy logger
  let logger = null;
  function getLogger() {
    if (!logger) {
      const logDir = join(homedir(), '.config', 'opencode');
      logger = createLogger(logDir);
    }
    return logger;
  }

  /**
   * Process accumulated file change events (called after debounce).
   */
  function processPendingEvents() {
    if (pendingPaths.size === 0) return;

    const paths = [...pendingPaths];
    pendingPaths.clear();

    // Filter out self-writes
    const externalPaths = paths.filter(p => !selfWrites.has(p));

    if (externalPaths.length > 0) {
      invalidateAll(cwd);
      if (typeof onExternalChange === 'function') {
        for (const filePath of externalPaths) {
          try {
            onExternalChange(filePath);
          } catch {
            // External change callbacks are best-effort only.
          }
        }
      }
    }
  }

  /**
   * Handle a raw fs.watch event.
   * @param {string} eventType - 'rename' or 'change'
   * @param {string|null} filename - Relative path within watched directory
   */
  function onWatchEvent(eventType, filename) {
    if (!filename) return;

    const fullPath = join(planningDir, filename);

    // Track event count for cap warning
    eventCount++;
    if (!capWarned && eventCount > maxWatchedPaths) {
      capWarned = true;
      getLogger().write('WARN', `File watcher: event count (${eventCount}) exceeds cap (${maxWatchedPaths}). Possible excessive file activity.`);
    }

    // Check self-write
    if (selfWrites.has(fullPath)) {
      return;
    }

    // Accumulate and debounce
    pendingPaths.add(fullPath);

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(processPendingEvents, debounceMs);
  }

  /**
   * Start watching the .planning/ directory.
   * If .planning/ doesn't exist, logs and returns without watching.
   */
  function start() {
    if (watching) return;

    if (!existsSync(planningDir)) {
      getLogger().write('INFO', `File watcher: .planning/ not found at ${cwd}, skipping watch`);
      return;
    }

    try {
      controller = new AbortController();

      watch(planningDir, { recursive: true, signal: controller.signal }, onWatchEvent);

      watching = true;
      eventCount = 0;
      capWarned = false;
    } catch (err) {
      getLogger().write('ERROR', `File watcher: failed to start: ${err.message}`);
      watching = false;
      controller = null;
    }
  }

  /**
   * Stop watching and clean up.
   */
  function stop() {
    if (controller) {
      try {
        controller.abort();
      } catch {
        // AbortController.abort() can throw if already aborted
      }
      controller = null;
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    // Clear all self-write timers
    for (const timer of selfWriteTimers.values()) {
      clearTimeout(timer);
    }
    selfWriteTimers.clear();
    selfWrites.clear();
    pendingPaths.clear();

    watching = false;
  }

  /**
   * Track a self-write to prevent triggering cache invalidation.
   * Path is auto-cleared after 200ms to ensure watcher event has fired.
   *
   * @param {string} filePath - Absolute path of file being written
   */
  function trackSelfWrite(filePath) {
    selfWrites.add(filePath);

    // Clear any existing timer for this path
    const existing = selfWriteTimers.get(filePath);
    if (existing) {
      clearTimeout(existing);
    }

    // Auto-clear after 200ms
    const timer = setTimeout(() => {
      selfWrites.delete(filePath);
      selfWriteTimers.delete(filePath);
    }, 200);

    selfWriteTimers.set(filePath, timer);
  }

  /**
   * Check if the watcher is currently active.
   * @returns {boolean}
   */
  function isWatching() {
    return watching;
  }

  return {
    start,
    stop,
    trackSelfWrite,
    isWatching,
  };
}
