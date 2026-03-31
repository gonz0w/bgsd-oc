import { homedir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { createLogger } from './logger.js';

/**
 * Universal error boundary for all plugin hooks.
 *
 * Wraps any hook function with:
 * - Retry (1 silent retry before logging)
 * - Timeout (default 5s)
 * - Circuit breaker (auto-disable after 3 consecutive failures)
 * - Correlation ID logging
 * - Slow hook detection (>500ms)
 * - BGSD_DEBUG=1 bypass for development
 *
 * @param {string} name - Hook identifier (used in logs and toasts)
 * @param {Function} fn - The hook function (input, output) => Promise<void>
 * @param {{ timeout?: number }} [options] - Configuration
 * @returns {Function} Wrapped hook function with same signature
 */
export function safeHook(name, fn, options = {}) {
  const { timeout = 5000 } = options;

  // Per-hook instance state (closure)
  let consecutiveFailures = 0;
  let disabled = false;

  // Lazy-initialized logger — only created on first error
  let logger = null;

  function getLogger() {
    if (!logger) {
      const logDir = join(homedir(), '.config', 'opencode');
      logger = createLogger(logDir);
    }
    return logger;
  }

  /**
   * Generate an 8-char hex correlation ID.
   */
  function generateCorrelationId() {
    return randomBytes(4).toString('hex');
  }

  /**
   * Race a function call against a timeout.
   */
  function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Hook "${name}" timed out after ${ms}ms`));
      }, ms);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  function writeOperatorMessage(message) {
    try {
      process.stderr.write(`[bGSD] ${message}\n`);
    } catch {
      // Best effort only
    }
  }

  return async function wrappedHook(input, output) {
    // Circuit breaker: skip if disabled
    if (disabled) {
      return;
    }

    // Debug bypass: let exceptions propagate for development
    if (process.env.BGSD_DEBUG === '1') {
      return fn(input, output);
    }

    const correlationId = generateCorrelationId();
    const startTime = Date.now();

    // Retry loop: 2 attempts
    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await withTimeout(fn(input, output), timeout);

        // Success — reset failure count
        consecutiveFailures = 0;

        // Slow hook detection
        const elapsed = Date.now() - startTime;
        if (elapsed > 500) {
          getLogger().write('WARN', `Slow hook: ${name} took ${elapsed}ms`, correlationId, {
            hookName: name,
            elapsed,
          });
        }

        return result; // Hook/tool succeeded — pass through return value
      } catch (err) {
        lastError = err;
        // Attempt 1: silent retry — continue to attempt 2
        // Attempt 2: fall through to failure handling
      }
    }

    // Both attempts failed
    consecutiveFailures++;

    // Log error to file AND stderr
    const errorMessage = `Hook "${name}" failed: ${lastError.message}`;
    getLogger().write('ERROR', errorMessage, correlationId, {
      hookName: name,
      stack: lastError.stack,
      emitToStderr: false,
    });
    writeOperatorMessage(`Hook failed: ${name} [${correlationId}] - ${lastError.message}`);

    // Circuit breaker: disable after 3 consecutive failures
    if (consecutiveFailures >= 3) {
      disabled = true;
      getLogger().write('ERROR', `Circuit breaker tripped: hook "${name}" disabled after ${consecutiveFailures} consecutive failures`, correlationId, {
        hookName: name,
        emitToStderr: false,
      });
      writeOperatorMessage(`Hook ${name} disabled after ${consecutiveFailures} consecutive failures [${correlationId}]`);
    }
  };
}
