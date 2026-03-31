import { readFileSync, statSync } from 'fs';
import { join, basename, extname, isAbsolute, resolve } from 'path';
import { homedir } from 'os';
import { createLogger } from './logger.js';

/**
 * Advisory guardrails — non-blocking convention, planning protection, and test
 * suggestion warnings delivered via the notification system.
 *
 * Four guardrail types:
 * - GARD-01: Convention violation warnings on file writes
 * - GARD-02: Planning file protection when .planning/ edited outside workflows
 * - GARD-03: Test-after-edit suggestions (debounced batch)
 * - GARD-04: Destructive command detection for bash tool invocations
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
  'ROADMAP.md': ['/bgsd-plan roadmap add', '/bgsd-plan roadmap remove', '/bgsd-plan roadmap insert'],
  'STATE.md': ['/bgsd-inspect progress', '/bgsd-execute-phase'],
  'PLAN.md': ['/bgsd-plan phase [phase]'],
  'CONTEXT.md': ['/bgsd-plan discuss [phase]'],
  'RESEARCH.md': ['/bgsd-plan research [phase]'],
  'REQUIREMENTS.md': ['/bgsd-new-milestone'],
  'config.json': ['/bgsd-settings'],
  'SUMMARY.md': ['/bgsd-execute-phase'],
  'INTENT.md': ['/bgsd-new-project', '/bgsd-new-milestone', '/bgsd-complete-milestone'],
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

/** Tool names that execute shell commands — processed by GARD-04 */
const BASH_TOOLS = new Set(['bash']);

// ─── GARD-04: Destructive Command Detection ─────────────────────────────────

/**
 * Destructive command patterns organized by category with three severity tiers.
 * Structure mirrors SECURITY_PATTERNS from src/commands/skills.js.
 *
 * Severity tiers:
 * - critical: Irreversible data loss (rm -rf, DROP TABLE, format disk)
 * - warning: Dangerous but recoverable (git push --force, kill -9, chmod 777)
 * - info: Context-dependent risk (curl | bash, plain rm, eval)
 */
const DESTRUCTIVE_PATTERNS = [
  // ── Filesystem ──
  { id: 'fs-rm-recursive',    category: 'filesystem',    severity: 'critical', pattern: /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*\b|--recursive)/, description: 'Recursive file deletion (rm -r, rm -rf, rm --recursive)' },
  { id: 'fs-rm-force',        category: 'filesystem',    severity: 'warning',  pattern: /\brm\s+-[a-zA-Z]*f[a-zA-Z]*\b(?!.*-[a-zA-Z]*r)/, description: 'Forced file deletion without recursive (rm -f)' },
  { id: 'fs-rm-plain',        category: 'filesystem',    severity: 'info',     pattern: /\brm\s+(?!-)/, description: 'Plain file deletion (rm)' },
  { id: 'fs-format',          category: 'filesystem',    severity: 'critical', pattern: /\b(mkfs|format)\b/, description: 'Disk formatting' },
  { id: 'fs-dd',              category: 'filesystem',    severity: 'critical', pattern: /\bdd\s+.*of=/, description: 'Raw disk write (dd of=)' },

  // ── Database ──
  { id: 'db-drop-table',      category: 'database',      severity: 'critical', pattern: /\bDROP\s+(TABLE|DATABASE|SCHEMA)\b/i, description: 'Drop database object' },
  { id: 'db-truncate',        category: 'database',      severity: 'critical', pattern: /\bTRUNCATE\s+TABLE\b/i, description: 'Truncate table' },
  { id: 'db-delete-no-where', category: 'database',      severity: 'warning',  pattern: /\bDELETE\s+FROM\s+\w+\s*(?:;|$)/i, description: 'DELETE without WHERE clause' },

  // ── Git ──
  { id: 'git-force-push',     category: 'git',           severity: 'critical', pattern: /\bgit\s+push\s+.*--force\b/, description: 'Force push (rewrite remote history)' },
  { id: 'git-force-push-f',   category: 'git',           severity: 'critical', pattern: /\bgit\s+push\s+-[a-zA-Z]*f/, description: 'Force push shorthand (-f)' },
  { id: 'git-reset-hard',     category: 'git',           severity: 'warning',  pattern: /\bgit\s+reset\s+--hard\b/, description: 'Hard reset (discard uncommitted changes)' },
  { id: 'git-clean-fd',       category: 'git',           severity: 'warning',  pattern: /\bgit\s+clean\s+-[a-zA-Z]*f/, description: 'Force clean untracked files' },

  // ── System ──
  { id: 'sys-kill-9',         category: 'system',        severity: 'warning',  pattern: /\bkill\s+-9\b/, description: 'Force kill process (SIGKILL)' },
  { id: 'sys-chmod-777',      category: 'system',        severity: 'warning',  pattern: /\bchmod\s+777\b/, description: 'World-writable permissions' },
  { id: 'sys-chmod-recursive', category: 'system',       severity: 'warning',  pattern: /\bchmod\s+-[a-zA-Z]*R/, description: 'Recursive permission change' },
  { id: 'sys-chown-recursive', category: 'system',       severity: 'warning',  pattern: /\bchown\s+-[a-zA-Z]*R/, description: 'Recursive ownership change' },
  { id: 'sys-shutdown',       category: 'system',        severity: 'critical', pattern: /\b(shutdown|reboot|halt|poweroff)\b/, description: 'System shutdown/reboot' },
  { id: 'sys-iptables-flush', category: 'system',        severity: 'critical', pattern: /\biptables\s+-F\b/, description: 'Flush firewall rules' },
  { id: 'sys-systemctl-disable', category: 'system',     severity: 'warning',  pattern: /\bsystemctl\s+(disable|stop)\s/, description: 'Disable/stop system service' },

  // ── Supply Chain ──
  { id: 'sc-curl-pipe',       category: 'supply-chain',  severity: 'info',     pattern: /\bcurl\s+.*\|\s*(ba)?sh\b/, description: 'Pipe remote script to shell (curl | bash)' },
  { id: 'sc-wget-pipe',       category: 'supply-chain',  severity: 'info',     pattern: /\bwget\s+.*\|\s*(ba)?sh\b/, description: 'Pipe remote script to shell (wget | bash)' },
  { id: 'sc-eval',            category: 'supply-chain',  severity: 'info',     pattern: /\beval\s+/, description: 'Shell eval (arbitrary code execution)' },
  { id: 'sc-npm-global',      category: 'supply-chain',  severity: 'info',     pattern: /\bnpm\s+install\s+-g\b/, description: 'Global npm package installation' },
  { id: 'sc-pip-sudo',        category: 'supply-chain',  severity: 'info',     pattern: /\bsudo\s+pip\s+install\b/, description: 'Sudo pip install (system-wide)' },
  { id: 'sc-source-remote',   category: 'supply-chain',  severity: 'info',     pattern: /\b(source|\.)\s+<\(\s*curl\b/, description: 'Source remote script (source <(curl ...))' },
];

// ─── Unicode Normalization Pipeline ──────────────────────────────────────────

/**
 * Normalize a command string for pattern matching.
 * Three-step pipeline: NFKD decomposition → strip zero-width chars → strip combining marks.
 *
 * @param {string} raw - Raw command string
 * @returns {string} Normalized ASCII-friendly command
 */
function normalizeCommand(raw) {
  // Step 1: NFKD decomposition — handles fullwidth chars (ｒｍ → rm), ligatures
  let normalized = raw.normalize('NFKD');

  // Step 2: Strip zero-width characters (U+200B-U+200D, U+2060, U+FEFF)
  normalized = normalized.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '');

  // Step 3: Strip combining marks (marks, nonspacing — after NFKD, accented chars decompose)
  normalized = normalized.replace(/[\u0300-\u036F]/g, '');

  return normalized;
}

// ─── Container / Sandbox Detection ───────────────────────────────────────────

/**
 * Detect if running inside a container or sandbox environment.
 * Checks env vars first (fast), then filesystem probes (Linux only).
 * Result is cached at init time — container status doesn't change mid-session.
 *
 * @param {*} configOverride - true/false to force, or 'auto' for detection
 * @returns {boolean}
 */
function detectSandboxEnvironment(configOverride) {
  // Config override takes precedence
  if (configOverride === true) return true;
  if (configOverride === false) return false;
  // 'auto' (default) — run detection

  // Phase 1: Environment variables (fast, no I/O)
  const envSignals = [
    'DOCKER_HOST',
    'SINGULARITY_NAME',
    'MODAL_TASK_ID',
    'DAYTONA_WS_ID',
    'CODESPACES',
    'GITPOD_WORKSPACE_ID',
  ];
  if (envSignals.some(key => process.env[key])) return true;

  // Phase 2: Filesystem probes (Linux only, wrapped in try/catch)
  try { statSync('/.dockerenv'); return true; } catch { /* not in Docker */ }
  try { statSync('/run/.containerenv'); return true; } catch { /* not in container */ }
  try {
    const cgroup = readFileSync('/proc/self/cgroup', 'utf-8');
    if (/docker|containerd|kubepods/i.test(cgroup)) return true;
  } catch { /* not Linux or not in container */ }

  return false;
}

// ─── Custom Pattern Merge ────────────────────────────────────────────────────

/**
 * Merge built-in patterns with user-defined custom patterns.
 * Custom patterns are validated and converted from string to RegExp.
 *
 * @param {Array} builtIn - Built-in DESTRUCTIVE_PATTERNS
 * @param {Array} custom - User custom patterns from config
 * @returns {Array} Merged pattern array
 */
function mergePatterns(builtIn, custom) {
  const merged = [...builtIn];
  for (const cp of custom) {
    if (!cp.id || !cp.pattern || !cp.category || !cp.severity) continue;
    let pattern;
    try {
      pattern = typeof cp.pattern === 'string' ? new RegExp(cp.pattern) : cp.pattern;
    } catch {
      // Invalid regex — skip with warning (logger not available here, skip silently)
      continue;
    }
    merged.push({ ...cp, pattern, custom: true });
  }
  return merged;
}

// ─── Pattern Matching ────────────────────────────────────────────────────────

/**
 * Match a normalized command against the pattern library.
 * Respects disabled patterns and category config.
 *
 * @param {string} normalizedCommand - Normalized command string
 * @param {Array} patterns - Merged pattern array
 * @param {Set} disabledPatterns - Set of disabled pattern IDs
 * @param {object} categoryConfig - Per-category enable/disable config
 * @returns {Array} Array of matching pattern objects
 */
function matchPatterns(normalizedCommand, patterns, disabledPatterns, categoryConfig) {
  const matches = [];
  for (const p of patterns) {
    // Skip disabled patterns
    if (disabledPatterns.has(p.id)) continue;
    // Skip disabled categories
    if (categoryConfig[p.category] === false) continue;
    // Test pattern
    if (p.pattern.test(normalizedCommand)) {
      matches.push(p);
    }
  }
  return matches;
}

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

  // GARD-04: Destructive command detection config
  const destructiveConfig = guardConfig.destructive_commands || {};
  const destructiveEnabled = destructiveConfig.enabled !== false;
  const sandboxMode = destructiveConfig.sandbox_mode ?? 'auto';
  const categoryConfig = destructiveConfig.categories || {};
  const disabledPatterns = new Set(destructiveConfig.disabled_patterns || []);
  const customPatterns = destructiveConfig.custom_patterns || [];

  // GARD-04 init: detect sandbox environment (cached for session lifetime)
  const isSandbox = destructiveEnabled ? detectSandboxEnvironment(sandboxMode) : false;

  // GARD-04 init: merge built-in + custom patterns
  const mergedPatterns = destructiveEnabled ? mergePatterns(DESTRUCTIVE_PATTERNS, customPatterns) : [];

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
      const toolName = input?.tool;
      if (!toolName) return;

      // ── GARD-04: Destructive command detection ────────────────────────
      if (destructiveEnabled && BASH_TOOLS.has(toolName)) {
        const rawCommand = input?.args?.command;
        if (!rawCommand) return;

        const normalized = normalizeCommand(rawCommand);
        const matches = matchPatterns(normalized, mergedPatterns, disabledPatterns, categoryConfig);

        for (const match of matches) {
          // Sandbox suppression: skip WARNING and INFO in sandbox mode
          if (isSandbox && match.severity !== 'critical') continue;

          const behavioral = match.severity === 'critical'
            ? 'Confirm with user before proceeding with this destructive operation.'
            : match.severity === 'warning'
              ? 'Proceed with caution \u2014 this operation may be difficult to reverse.'
              : '';

          try {
            await notifier.notify({
              type: 'advisory-destructive',
              severity: 'info',
              message: `GARD-04: ${rawCommand.slice(0, 80)} matched [${match.id}] (${match.severity.toUpperCase()})${behavioral ? '. ' + behavioral : ''}`,
            });
          } catch (err) {
            getLogger().write('ERROR', `Advisory destructive notification failed: ${err.message}`);
          }
        }
        return; // Don't fall through to GARD-01/02/03 for bash tool
      }

      // Only process file-writing tools for GARD-01/02/03
      if (!WRITE_TOOLS.has(toolName)) return;

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
