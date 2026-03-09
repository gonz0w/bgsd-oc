import { existsSync, mkdirSync, statSync, appendFileSync, copyFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

const MAX_LOG_SIZE = 512 * 1024; // 512KB

/**
 * Generate an 8-char hex correlation ID.
 * @returns {string} e.g. "a1b2c3d4"
 */
export function generateCorrelationId() {
  return randomBytes(4).toString('hex');
}

/**
 * Create a file-based error logger with rotation.
 *
 * @param {string} logDir - Directory for the log file (e.g. ~/.config/opencode)
 * @returns {{ write: (level: string, message: string, correlationId?: string, extra?: object) => void }}
 */
export function createLogger(logDir) {
  const logPath = join(logDir, 'bgsd-plugin.log');
  const rotatedPath = logPath + '.1';

  function ensureDir() {
    try {
      if (!existsSync(logDir)) {
        mkdirSync(logDir, { recursive: true });
      }
    } catch {
      // Best-effort — if we can't create the dir, writes will fail silently
    }
  }

  function rotate() {
    try {
      const stat = statSync(logPath);
      if (stat.size >= MAX_LOG_SIZE) {
        // Rotate: overwrite .log.1 with current log
        copyFileSync(logPath, rotatedPath);
        writeFileSync(logPath, '');
      }
    } catch {
      // File doesn't exist yet or can't stat — no rotation needed
    }
  }

  /**
   * Write a log entry.
   * @param {string} level - Log level (ERROR, WARN, INFO, DEBUG)
   * @param {string} message - Log message
   * @param {string} [correlationId] - Optional correlation ID
   * @param {object} [extra] - Optional extra data (stack trace, etc.)
   */
  function write(level, message, correlationId, extra) {
    try {
      ensureDir();
      rotate();

      const timestamp = new Date().toISOString();
      const corrPart = correlationId ? ` [${correlationId}]` : '';
      let line = `[${timestamp}] [${level}]${corrPart} ${message}\n`;

      if (extra) {
        if (extra.stack) {
          line += `  Stack: ${extra.stack}\n`;
        }
        if (extra.hookName) {
          line += `  Hook: ${extra.hookName}\n`;
        }
        if (extra.elapsed) {
          line += `  Elapsed: ${extra.elapsed}ms\n`;
        }
      }

      appendFileSync(logPath, line);

      // Also write errors to stderr for immediate visibility
      if (level === 'ERROR') {
        process.stderr.write(`[bGSD]${corrPart} ${message}\n`);
      }
    } catch {
      // Last resort: try stderr
      try {
        process.stderr.write(`[bGSD] Logger write failed: ${message}\n`);
      } catch {
        // Truly nothing we can do
      }
    }
  }

  return { write };
}
