import { readFileSync } from 'fs';
import { join, basename, extname, isAbsolute, resolve } from 'path';
import { homedir } from 'os';
import { createLogger } from './logger.js';

/**
 * Advisory guardrails — non-blocking convention, planning protection, and test
 * suggestion warnings delivered via the notification system.
 *
 * Three guardrail types:
 * - GARD-01: Convention violation warnings on file writes
 * - GARD-02: Planning file protection when .planning/ edited outside workflows
 * - GARD-03: Test-after-edit suggestions (debounced batch)
 *
 * Factory function creates a guardrails instance scoped to a plugin session.
 * All file reads (AGENTS.md, package.json, codebase-intel.json) happen at init
 * time and are cached — no per-call I/O.
 *
 * @module advisory-guardrails
 */

// ─── Inline Naming Classifiers ───────────────────────────────────────────────
// Copied from src/lib/conventions.js (CJS) — plugin is ESM, cannot import CJS.

/** Regex classifiers for file naming patterns */
const NAMING_PATTERNS = {
  camelCase: /^[a-z][a-z0-9]*[A-Z][a-zA-Z0-9]*$/,
  PascalCase: /^[A-Z][a-zA-Z0-9]*[a-z][a-zA-Z0-9]*$/,
  snake_case: /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/,
  'kebab-case': /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/,
  UPPER_SNAKE_CASE: /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/,
};

/**
 * Classify a filename (without extension) into a naming pattern.
 *
 * @param {string} name - Filename without extension
 * @returns {string} Pattern name, 'single-word', or 'mixed'
 */
function classifyName(name) {
  if (/^[a-z][a-z0-9]*$/.test(name)) return 'single-word';
  if (/^[A-Z][A-Z0-9]*$/.test(name)) return 'single-word';

  for (const [pattern, regex] of Object.entries(NAMING_PATTERNS)) {
    if (regex.test(name)) return pattern;
  }
  return 'mixed';
}

// ─── Name Conversion Helper ──────────────────────────────────────────────────

/**
 * Split a filename on case/separator boundaries into word segments.
 * Handles camelCase, PascalCase, snake_case, kebab-case.
 *
 * @param {string} name - Filename without extension
 * @returns {string[]} Lowercase word segments
 */
function splitWords(name) {
  // Replace separators with space, then split camelCase boundaries
  return name
    .replace(/[-_]/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Convert a filename to the target naming convention.
 *
 * @param {string} name - Filename without extension
 * @param {string} convention - Target convention (camelCase, PascalCase, snake_case, kebab-case, UPPER_SNAKE_CASE)
 * @returns {string} Converted name
 */
function toConvention(name, convention) {
  const words = splitWords(name);
  if (words.length === 0) return name;

  switch (convention) {
    case 'kebab-case':
      return words.join('-');
    case 'snake_case':
      return words.join('_');
    case 'camelCase':
      return words[0] + words.slice(1).map(w => w[0].toUpperCase() + w.slice(1)).join('');
    case 'PascalCase':
      return words.map(w => w[0].toUpperCase() + w.slice(1)).join('');
    case 'UPPER_SNAKE_CASE':
      return words.map(w => w.toUpperCase()).join('_');
    default:
      return name;
  }
}

// ─── Static Planning Commands Mapping ────────────────────────────────────────

/** Maps planning file basenames to recommended bGSD commands */
const PLANNING_COMMANDS = {
  'ROADMAP.md': ['/bgsd-add-phase', '/bgsd-remove-phase', '/bgsd-insert-phase'],
  'STATE.md': ['/bgsd-progress', '/bgsd-execute-phase'],
  'PLAN.md': ['/bgsd-plan-phase'],
  'CONTEXT.md': ['/bgsd-discuss-phase'],
  'RESEARCH.md': ['/bgsd-research-phase'],
  'REQUIREMENTS.md': ['/bgsd-new-milestone'],
  'config.json': ['/bgsd-settings'],
  'SUMMARY.md': ['/bgsd-execute-phase'],
  'INTENT.md': ['/bgsd-new-project', '/bgsd-new-milestone'],
};

// ─── Helper: Test File Detection ─────────────────────────────────────────────

/**
 * Check if a file path represents a test file.
 *
 * @param {string} filePath - Absolute or relative file path
 * @returns {boolean}
 */
function isTestFile(filePath) {
  const lower = filePath.toLowerCase();
  return (
    lower.includes('.test.') ||
    lower.includes('.spec.') ||
    lower.includes('__tests__/') ||
    lower.includes('__tests__\\') ||
    /[\\/]tests?[\\/]/.test(lower)
  );
}

// ─── Helper: Load Convention Rules ───────────────────────────────────────────

/**
 * Read AGENTS.md and codebase-intel.json to determine project naming convention.
 * Returns null if no convention can be determined.
 *
 * @param {string} cwd - Working directory
 * @param {number} confidenceThreshold - Minimum confidence for codebase stats
 * @returns {{ dominant: string, confidence: number } | null}
 */
function loadConventionRules(cwd, confidenceThreshold) {
  // Primary: scan AGENTS.md for convention mentions
  try {
    const agentsPath = join(cwd, 'AGENTS.md');
    const content = readFileSync(agentsPath, 'utf-8');
    const conventionNames = ['kebab-case', 'camelCase', 'PascalCase', 'snake_case', 'UPPER_SNAKE_CASE'];
    for (const conv of conventionNames) {
      if (content.includes(conv)) {
        return { dominant: conv, confidence: 100 };
      }
    }
  } catch {
    // No AGENTS.md — fall through to codebase stats
  }

  // Fallback: codebase-intel.json conventions
  try {
    const intelPath = join(cwd, '.planning', 'codebase', 'codebase-intel.json');
    const intel = JSON.parse(readFileSync(intelPath, 'utf-8'));
    if (
      intel.conventions?.naming?.dominant &&
      (intel.conventions.naming.confidence || 0) >= confidenceThreshold
    ) {
      return {
        dominant: intel.conventions.naming.dominant,
        confidence: intel.conventions.naming.confidence,
      };
    }
  } catch {
    // No codebase intel — no convention info
  }

  return null;
}

// ─── Helper: Detect Test Config ──────────────────────────────────────────────

/**
 * Read package.json to find test command and source file extensions.
 *
 * @param {string} cwd - Working directory
 * @returns {{ command: string | null, sourceExts: Set<string> }}
 */
function detectTestConfig(cwd) {
  const result = { command: null, sourceExts: new Set() };

  try {
    const pkgPath = join(cwd, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

    // Test command
    if (pkg.scripts?.test) {
      result.command = `npm test`;
    } else if (pkg.scripts?.check) {
      result.command = `npm run check`;
    }

    // Source extensions for JS projects
    result.sourceExts = new Set(['.js', '.ts', '.cjs', '.mjs', '.jsx', '.tsx']);
  } catch {
    // No package.json — generic fallback
  }

  // Fallback: check for common test runners
  if (!result.command) {
    try {
      const pyProject = join(cwd, 'pyproject.toml');
      readFileSync(pyProject, 'utf-8');
      result.command = 'pytest';
      result.sourceExts = new Set(['.py']);
    } catch {
      // Not a Python project
    }
  }

  return result;
}

// ─── Tools We Process ────────────────────────────────────────────────────────

/** Tool names that modify files and should trigger guardrails */
const WRITE_TOOLS = new Set(['write', 'edit', 'patch']);

// ─── Factory Function ────────────────────────────────────────────────────────

/**
 * Create an advisory guardrails instance.
 *
 * @param {string} cwd - Project working directory
 * @param {object} notifier - Notification system (from notification.js)
 * @param {object} config - Parsed config (from parsers/config.js)
 * @returns {{ onToolAfter: Function, setBgsdCommandActive: Function, clearBgsdCommandActive: Function }}
 */
export function createAdvisoryGuardrails(cwd, notifier, config) {
  // Config values
  const guardConfig = config.advisory_guardrails || {};
  const conventionsEnabled = guardConfig.conventions !== false;
  const planningProtectionEnabled = guardConfig.planning_protection !== false;
  const testSuggestionsEnabled = guardConfig.test_suggestions !== false;
  const dedupThreshold = guardConfig.dedup_threshold || 3;
  const testDebounceMs = guardConfig.test_debounce_ms || 500;
  const confidenceThreshold = guardConfig.convention_confidence_threshold || 70;

  // Lazy logger
  let logger = null;
  function getLogger() {
    if (!logger) {
      const logDir = join(homedir(), '.config', 'opencode');
      logger = createLogger(logDir);
    }
    return logger;
  }

  // Init-time cached data
  const conventionRules = conventionsEnabled ? loadConventionRules(cwd, confidenceThreshold) : null;
  const testConfig = testSuggestionsEnabled ? detectTestConfig(cwd) : { command: null, sourceExts: new Set() };

  // State
  let bgsdCommandActive = false;
  const warnCounts = new Map(); // type → count
  let testBatchTimer = null;
  const testBatchFiles = [];

  /**
   * Flush debounced test suggestions.
   */
  async function flushTestBatch() {
    testBatchTimer = null;
    if (testBatchFiles.length === 0) return;

    const files = [...testBatchFiles];
    testBatchFiles.length = 0;

    const cmdStr = testConfig.command || 'your test suite';
    let message;
    if (files.length === 1) {
      message = `Modified ${basename(files[0])}. Consider running: ${cmdStr}`;
    } else {
      message = `Modified ${files.length} source files. Consider running: ${cmdStr}`;
    }

    try {
      await notifier.notify({
        type: 'advisory-test',
        severity: 'info',
        message,
      });
    } catch (err) {
      getLogger().write('ERROR', `Advisory test suggestion failed: ${err.message}`);
    }
  }

  /**
   * Process a tool.execute.after event for advisory guardrails.
   *
   * @param {object} input - { tool: string, args?: object }
   */
  async function onToolAfter(input) {
    // Master kill switch
    if (guardConfig.enabled === false) return;

    try {
      // Only process file-writing tools
      const toolName = input?.tool;
      if (!toolName || !WRITE_TOOLS.has(toolName)) return;

      // Extract file path
      const filePath = input?.args?.filePath;
      if (!filePath) return;

      // Resolve to absolute path
      const absPath = isAbsolute(filePath) ? filePath : resolve(cwd, filePath);

      // Skip non-project paths
      if (
        absPath.includes('node_modules') ||
        !absPath.startsWith(cwd)
      ) {
        return;
      }

      // Relative path for display
      const relPath = absPath.slice(cwd.length + 1);

      // ── GARD-02: Planning file protection (highest priority) ──────────
      if (planningProtectionEnabled && (relPath.startsWith('.planning/') || relPath.startsWith('.planning\\'))) {
        if (bgsdCommandActive) return; // Workflow-driven — suppress

        const fileBasename = basename(absPath);

        // Check static mapping — try exact match first, then suffix match
        let commands = PLANNING_COMMANDS[fileBasename];
        if (!commands) {
          // Try suffix match for files like 76-01-PLAN.md → PLAN.md
          for (const [pattern, cmds] of Object.entries(PLANNING_COMMANDS)) {
            if (fileBasename.endsWith(pattern)) {
              commands = cmds;
              break;
            }
          }
        }

        if (commands) {
          const cmdStr = commands.join(' or ');
          await notifier.notify({
            type: 'advisory-planning',
            severity: 'warning',
            message: `${fileBasename} was edited directly. Use ${cmdStr} to modify this file safely.`,
          });
        } else {
          await notifier.notify({
            type: 'advisory-planning',
            severity: 'warning',
            message: `File in .planning/ was edited directly. bGSD workflows manage these files automatically.`,
          });
        }

        return; // Don't also run GARD-01 on .planning/ files
      }

      // ── GARD-01: Convention violations ────────────────────────────────
      if (conventionsEnabled && conventionRules) {
        const fileBasename = basename(absPath);
        const ext = extname(fileBasename);
        const nameWithoutExt = ext ? fileBasename.slice(0, -ext.length) : fileBasename;

        const classification = classifyName(nameWithoutExt);

        // Skip single-word and mixed (unclassifiable) names
        if (classification !== 'single-word' && classification !== 'mixed') {
          if (classification !== conventionRules.dominant) {
            const count = (warnCounts.get('convention') || 0) + 1;
            warnCounts.set('convention', count);

            if (count <= dedupThreshold) {
              const suggested = toConvention(nameWithoutExt, conventionRules.dominant) + ext;
              await notifier.notify({
                type: 'advisory-convention',
                severity: 'warning',
                message: `File uses ${classification} naming (${fileBasename}). Project convention is ${conventionRules.dominant}. Consider renaming to ${suggested}.`,
              });
            } else if (count % 5 === 0) {
              await notifier.notify({
                type: 'advisory-convention',
                severity: 'warning',
                message: `${count} convention violations detected. Project convention is ${conventionRules.dominant}.`,
              });
            }
          }
        }
      }

      // ── GARD-03: Test suggestions (debounced) ─────────────────────────
      if (testSuggestionsEnabled && testConfig.command) {
        // Skip test files
        if (isTestFile(absPath)) return;

        // Check source extension
        const ext = extname(absPath);
        if (testConfig.sourceExts.has(ext)) {
          testBatchFiles.push(relPath);

          // Reset debounce timer
          if (testBatchTimer) {
            clearTimeout(testBatchTimer);
          }
          testBatchTimer = setTimeout(flushTestBatch, testDebounceMs);
        }
      }
    } catch (err) {
      getLogger().write('ERROR', `Advisory guardrails error: ${err.message}`);
    }
  }

  /**
   * Mark that a bGSD command is currently executing.
   * Suppresses GARD-02 warnings for workflow-driven .planning/ writes.
   */
  function setBgsdCommandActive() {
    bgsdCommandActive = true;
  }

  /**
   * Clear the bGSD command active flag.
   */
  function clearBgsdCommandActive() {
    bgsdCommandActive = false;
  }

  return {
    onToolAfter,
    setBgsdCommandActive,
    clearBgsdCommandActive,
  };
}
