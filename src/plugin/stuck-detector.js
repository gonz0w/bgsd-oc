import { homedir } from 'os';
import { join } from 'path';
import { createLogger } from './logger.js';

/**
 * Stuck/loop detector — tracks tool call patterns for error loops and spinning.
 *
 * Monitors tool.execute.after events for:
 * - Error loops: same tool+error combination repeating N+ times (EVNT-04)
 * - Spinning: same sequence of tool calls repeating consecutively
 *
 * Routes notifications via notifier. Escalates on repeated detection.
 * Resets all counters on user input.
 *
 * @module stuck-detector
 */

/**
 * Create a stuck detector instance.
 *
 * @param {object} notifier - Notification system (from notification.js)
 * @param {object} config - Parsed config (from parsers/config.js)
 * @returns {{ trackToolCall: Function, onUserInput: Function }}
 */
export function createStuckDetector(notifier, config) {
  // Config values
  const errorThreshold = config.stuck_detection?.error_threshold || 3;
  const spinningThreshold = config.stuck_detection?.spinning_threshold || 5;

  // State
  const errorStreaks = new Map(); // key → count
  let escalationLevel = 0;

  // Spinning detection: recent tool calls as [toolName, argsHash] tuples
  const recentCalls = [];
  const MAX_RECENT_CALLS = 50; // Keep last 50 calls for pattern detection

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
   * Simple string hash for args comparison.
   * @param {string} str - String to hash
   * @returns {string} Simple hash
   */
  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  /**
   * Detect repeating sequence in recent calls.
   * Looks for a sequence of length >= spinningThreshold that repeats consecutively.
   *
   * @returns {{ length: number, repeatCount: number }|null}
   */
  function detectSpinning() {
    if (recentCalls.length < spinningThreshold * 2) return null;

    // Try sequence lengths from spinningThreshold down to 2
    for (let seqLen = spinningThreshold; seqLen >= 2; seqLen--) {
      // Check if the last seqLen*2 calls are the same sequence repeated
      if (recentCalls.length < seqLen * 2) continue;

      const lastCalls = recentCalls.slice(-seqLen * 2);
      const seq1 = lastCalls.slice(0, seqLen).map(c => c.key).join('|');
      const seq2 = lastCalls.slice(seqLen).map(c => c.key).join('|');

      if (seq1 === seq2) {
        // Count how many times this sequence repeats
        let repeatCount = 2;
        for (let i = 3; i <= Math.floor(recentCalls.length / seqLen); i++) {
          const start = recentCalls.length - seqLen * i;
          if (start < 0) break;
          const seqN = recentCalls.slice(start, start + seqLen).map(c => c.key).join('|');
          if (seqN === seq2) {
            repeatCount = i;
          } else {
            break;
          }
        }
        return { length: seqLen, repeatCount };
      }
    }

    return null;
  }

  /**
   * Track a tool call event.
   * Called on tool.execute.after hook.
   *
   * @param {object} input - Tool execution result { tool: string, args?: object, error?: string }
   */
  async function trackToolCall(input) {
    try {
      const toolName = input.tool || 'unknown';
      const error = input.error || null;
      const argsStr = JSON.stringify(input.args || {});
      const argsHash = simpleHash(argsStr);
      const callKey = `${toolName}:${argsHash}`;

      // Track for spinning detection
      recentCalls.push({ key: callKey, tool: toolName });
      if (recentCalls.length > MAX_RECENT_CALLS) {
        recentCalls.shift();
      }

      // --- Error loop detection (EVNT-04) ---
      if (error) {
        const errorKey = `${toolName}:${error}`;
        const count = (errorStreaks.get(errorKey) || 0) + 1;
        errorStreaks.set(errorKey, count);

        if (count >= errorThreshold) {
          escalationLevel++;
          const escalated = escalationLevel >= 2;
          const prefix = escalated ? 'ESCALATED — ' : '';

          await notifier.notify({
            type: 'stuck-error',
            severity: 'critical',
            message: `${prefix}Stuck: ${toolName} failed ${count}x — "${error}"`,
            action: 'Consider pausing for user input',
          });

          getLogger().write('WARN', `Stuck detection: ${toolName} error loop (${count}x): ${error}`);
        }
      } else {
        // Success — clear error streaks (not spinning history)
        errorStreaks.clear();
      }

      // --- Spinning detection ---
      const spinning = detectSpinning();
      if (spinning && spinning.length >= spinningThreshold) {
        await notifier.notify({
          type: 'stuck-spinning',
          severity: 'warning',
          message: `Spinning: same ${spinning.length}-call sequence repeated ${spinning.repeatCount}x`,
          action: 'Consider a different approach',
        });

        getLogger().write('WARN', `Stuck detection: spinning pattern (${spinning.length}-call sequence, ${spinning.repeatCount}x)`);
      }
    } catch (err) {
      getLogger().write('ERROR', `Stuck detector error: ${err.message}`);
    }
  }

  /**
   * Reset all counters.
   * Called on user input — clears error streaks, escalation, and spinning history.
   */
  function onUserInput() {
    errorStreaks.clear();
    escalationLevel = 0;
    recentCalls.length = 0;
  }

  return {
    trackToolCall,
    onUserInput,
  };
}
