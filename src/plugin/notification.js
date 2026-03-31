import { homedir } from 'os';
import { join } from 'path';
import { createLogger } from './logger.js';

/**
 * Notification delivery system — dual-channel (OS + context injection).
 *
 * Factory function creates a notifier scoped to a plugin instance.
 * Notifications route by severity:
 * - critical/warning → OS notification + context queue
 * - info → context queue only (suppressed by DND)
 *
 * Features:
 * - Ring buffer history (last 20 notifications)
 * - DND mode (suppress routine, pass critical)
 * - Rate limiting (sliding window per minute)
 * - Deduplication (type+message within debounce window)
 *
 * @module notification
 */

/**
 * Create a notifier instance scoped to a plugin session.
 *
 * @param {object|null} $ - Shell API for OS notifications (Bun shell from plugin context)
 * @param {string} directory - Project directory (used for logger path resolution)
 * @returns {{ notify: Function, drainPendingContext: Function, getHistory: Function, setDnd: Function, resetCounters: Function }}
 */
export function createNotifier($, directory) {
  const MAX_HISTORY = 20;
  const DEFAULT_RATE_LIMIT = 5; // per minute
  const DEDUP_WINDOW_MS = 5000; // 5s deduplication window

  // State
  const history = [];
  let pendingContext = [];
  let dndMode = false;
  let dndSuppressedCount = 0;

  // Rate limiting: sliding window of timestamps
  let rateLimitTimestamps = [];
  let rateLimitPerMinute = DEFAULT_RATE_LIMIT;

  // Deduplication: recent notification keys
  const recentKeys = new Map(); // key → timestamp

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
   * Send an OS-level notification (best-effort, silent failure).
   * macOS uses osascript, Linux uses notify-send.
   */
  async function sendOsNotification(message) {
    if (!$) return;
    try {
      // Properly escape for shell - escape all shell metacharacters
      const safeMsg = String(message).replace(/["`$\\]/g, '\\$&');
      if (process.platform === 'darwin') {
        await $`osascript -e ${"display notification \"" + safeMsg + "\" with title \"bGSD\""}`.quiet();
      } else {
        await $`notify-send "bGSD" ${safeMsg}`.quiet();
      }
    } catch (err) {
      getLogger().write('WARN', `OS notification failed: ${err.message}`);
    }
  }

  /**
   * Check if a notification is a duplicate within the dedup window.
   * @param {object} notification
   * @returns {boolean}
   */
  function isDuplicate(notification) {
    const key = `${notification.type}:${notification.message}`;
    const now = Date.now();
    const lastSeen = recentKeys.get(key);
    if (lastSeen && (now - lastSeen) < DEDUP_WINDOW_MS) {
      return true;
    }
    recentKeys.set(key, now);
    // Clean old entries
    for (const [k, ts] of recentKeys) {
      if (now - ts > DEDUP_WINDOW_MS) {
        recentKeys.delete(k);
      }
    }
    return false;
  }

  /**
   * Check rate limit (sliding window per minute).
   * @returns {boolean} true if within limit, false if exceeded
   */
  function checkRateLimit() {
    const now = Date.now();
    const windowStart = now - 60000;
    // Remove timestamps outside the window
    rateLimitTimestamps = rateLimitTimestamps.filter(ts => ts > windowStart);
    if (rateLimitTimestamps.length >= rateLimitPerMinute) {
      return false; // Rate exceeded
    }
    rateLimitTimestamps.push(now);
    return true;
  }

  /**
   * Route and deliver a notification.
   *
   * @param {object} notification - { type: string, severity: 'info'|'warning'|'critical', message: string, action?: string }
   */
  async function notify(notification) {
    const { type, severity, message, action } = notification;
    const timestamp = Date.now();

    // Always add to history (ring buffer)
    const entry = { type, severity, message, action, timestamp };
    history.push(entry);
    if (history.length > MAX_HISTORY) {
      history.shift();
    }

    // Deduplication check
    if (isDuplicate(notification)) {
      return;
    }

    // Rate limiting
    if (!checkRateLimit()) {
      getLogger().write('WARN', `Rate limit exceeded, dropping notification: ${type}`);
      return;
    }

    // DND mode: suppress non-critical
    if (dndMode && severity !== 'critical') {
      dndSuppressedCount++;
      return;
    }

    // OS notification for critical/warning
    if (severity === 'critical' || severity === 'warning') {
      await sendOsNotification(message);
    }

    // Queue for context injection (all severities that pass DND + rate limit)
    pendingContext.push({ type, severity, message, timestamp });
  }

  /**
   * Drain pending context-injection notifications.
   * Returns and clears the pending queue.
   *
   * @returns {Array<{type: string, severity: string, message: string, timestamp: number}>}
   */
  function drainPendingContext() {
    const items = [...pendingContext];
    pendingContext = [];
    return items;
  }

  /**
   * Get notification history (read-only copy).
   * @returns {Array<object>} Last 20 notifications
   */
  function getHistory() {
    return [...history];
  }

  /**
   * Toggle Do Not Disturb mode.
   * When DND ends (enabled=false), returns count of suppressed notifications.
   *
   * @param {boolean} enabled - true to enable DND, false to disable
   * @returns {number|undefined} Count of suppressed notifications when disabling DND
   */
  function setDnd(enabled) {
    dndMode = !!enabled;
    if (!enabled) {
      const count = dndSuppressedCount;
      dndSuppressedCount = 0;
      if (count > 0) {
        // Queue a summary notification for context injection
        pendingContext.push({
          type: 'dnd-summary',
          severity: 'info',
          message: `${count} notification${count === 1 ? '' : 's'} suppressed during DND. DND summaries are informational only and are not replayable by command.`,
          timestamp: Date.now(),
        });
      }
      return count;
    }
  }

  /**
   * Reset rate limit counters.
   * Called on user input to allow fresh notification delivery.
   */
  function resetCounters() {
    rateLimitTimestamps = [];
  }

  /**
   * Update rate limit setting (called when config changes).
   * @param {number} limit - New rate limit per minute
   */
  function setRateLimit(limit) {
    if (typeof limit === 'number' && limit > 0) {
      rateLimitPerMinute = limit;
    }
  }

  return {
    notify,
    drainPendingContext,
    getHistory,
    setDnd,
    resetCounters,
    setRateLimit,
  };
}
