import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * STATE.md parser for in-process reading.
 * Extracts structured data from .planning/STATE.md without spawning CLI subprocesses.
 *
 * Parsing logic extracted from src/commands/state.js (stateExtractField pattern)
 * and src/lib/helpers.js (safeReadFile). Self-contained — no CLI imports.
 */

// Module-level cache: cwd → frozen parsed state
const _cache = new Map();

/**
 * Extract a **FieldName:** value from STATE.md content.
 * Uses the same regex pattern as stateExtractField in the CLI.
 */
function extractField(content, fieldName) {
  const pattern = new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*(.+)`, 'i');
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}

/**
 * Extract a ## Section from STATE.md content.
 * Returns the content between the section header and the next ## header or end of file.
 */
function extractSection(content, sectionName) {
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`##\\s*${escaped}\\s*\\n([\\s\\S]*?)(?=\\n##|$)`, 'i');
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}

/**
 * Extract progress percentage from progress bar like [█████░░░░░] 50%
 */
function extractProgress(content) {
  const match = content.match(/\[[\u2588\u2591]+\]\s*(\d+)%/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Parse STATE.md from the given working directory (or CWD).
 * Returns a frozen object with structured accessors, or null if file can't be parsed.
 *
 * @param {string} [cwd] - Working directory (defaults to process.cwd())
 * @returns {object|null} Frozen state object or null
 */
export function parseState(cwd) {
  const resolvedCwd = cwd || process.cwd();

  // Check cache
  if (_cache.has(resolvedCwd)) {
    return _cache.get(resolvedCwd);
  }

  const statePath = join(resolvedCwd, '.planning', 'STATE.md');

  let raw;
  try {
    raw = readFileSync(statePath, 'utf-8');
  } catch {
    return null;
  }

  if (!raw || raw.trim().length === 0) {
    return null;
  }

  const result = Object.freeze({
    raw,
    phase: extractField(raw, 'Phase'),
    currentPlan: extractField(raw, 'Current Plan'),
    status: extractField(raw, 'Status'),
    lastActivity: extractField(raw, 'Last Activity'),
    progress: extractProgress(raw),
    getField(name) {
      return extractField(raw, name);
    },
    getSection(name) {
      return extractSection(raw, name);
    },
  });

  _cache.set(resolvedCwd, result);
  return result;
}

/**
 * Invalidate cached state for a given CWD (or all if no CWD).
 * @param {string} [cwd] - Specific CWD to invalidate, or all if omitted
 */
export function invalidateState(cwd) {
  if (cwd) {
    _cache.delete(cwd);
  } else {
    _cache.clear();
  }
}
