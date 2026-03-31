import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { homedir } from 'os';
import { createLogger } from './logger.js';
import { parseState, invalidateState } from './parsers/state.js';
import { parseRoadmap, invalidateRoadmap } from './parsers/roadmap.js';
import { parseConfig, invalidateConfig, buildDefaultConfigText } from './parsers/config.js';

/**
 * Idle validator — debounced STATE.md validation with auto-fix on session idle.
 *
 * Validates STATE.md + ROADMAP.md consistency, config schema, stale progress,
 * and phase completion. Auto-fixes issues silently, routes notifications via notifier.
 *
 * Guards:
 * - Cooldown period (default 5s) prevents rapid re-validation
 * - Re-entry guard prevents concurrent validation runs
 * - Auto-fix loop prevention: no re-validation until user interaction after a fix
 * - Skips during active plan execution (state is expected to be in flux)
 * - Silently skips if no .planning/ directory exists
 * - Never throws — all errors caught and logged
 *
 * @module idle-validator
 */

/**
 * Create an idle validator instance.
 *
 * @param {string} cwd - Project working directory
 * @param {object} notifier - Notification system (from notification.js)
 * @param {object} fileWatcher - File watcher (for trackSelfWrite)
 * @param {object} config - Parsed config (from parsers/config.js)
 * @returns {{ onIdle: Function, onUserInput: Function }}
 */
export function createIdleValidator(cwd, notifier, fileWatcher, config) {
  const planningDir = join(cwd, '.planning');

  // State
  let lastValidation = 0;
  let lastAutoFix = 0;
  let validating = false;

  // Config values
  const cooldownMs = (config.idle_validation?.cooldown_seconds || 5) * 1000;
  const stalenessHours = config.idle_validation?.staleness_threshold_hours || 2;
  const enabled = config.idle_validation?.enabled !== false;

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
   * Read STATE.md raw content.
   * @returns {string|null}
   */
  function readStateMd() {
    try {
      return readFileSync(join(planningDir, 'STATE.md'), 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Read ROADMAP.md raw content.
   * @returns {string|null}
   */
  function readRoadmapMd() {
    try {
      return readFileSync(join(planningDir, 'ROADMAP.md'), 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Write a file with self-write tracking to prevent feedback loops.
   * @param {string} filePath - Absolute path
   * @param {string} content - File content
   */
  function writeTracked(filePath, content) {
    fileWatcher.trackSelfWrite(filePath);
    writeFileSync(filePath, content);
  }

  /**
   * Get last git activity timestamp (epoch seconds).
   * @returns {number|null}
   */
  function getLastGitTimestamp() {
    try {
      const output = execSync('git log -1 --format=%ct', {
        cwd,
        encoding: 'utf-8',
        timeout: 3000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return parseInt(output.trim(), 10) || null;
    } catch {
      return null;
    }
  }

  /**
   * Fix progress bar visual to match percentage.
   * @param {string} raw - STATE.md content
   * @param {number} pct - Percentage value
   * @returns {string|null} Fixed content or null if no fix needed
   */
  function fixProgressBar(raw, pct) {
    const barMatch = raw.match(/\[([\u2588\u2591]+)\]\s*(\d+)%/);
    if (!barMatch) return null;

    const bar = barMatch[1];
    const total = bar.length;
    const filled = (bar.match(/\u2588/g) || []).length;
    const expectedFilled = Math.round(pct / 100 * total);

    if (filled === expectedFilled) return null;

    const newBar = '\u2588'.repeat(expectedFilled) + '\u2591'.repeat(total - expectedFilled);
    return raw.replace(barMatch[0], `[${newBar}] ${pct}%`);
  }

  /**
   * Main idle validation routine.
   * Called on session.idle event.
   */
  async function onIdle() {
    try {
      // Guard: disabled via config
      if (!enabled) return;

      // Guard: no .planning/ directory
      if (!existsSync(planningDir)) return;

      // Guard: cooldown
      if (Date.now() - lastValidation < cooldownMs) return;

      // Guard: auto-fix loop prevention
      if (lastAutoFix > lastValidation) return;

      // Guard: re-entry
      if (validating) return;

      // Guard: active execution — invalidate cache first to get fresh state
      invalidateState(cwd);
      const state = parseState(cwd);
      if (state) {
        const status = (state.status || '').toLowerCase();
        if (status.includes('executing') || status.includes('in progress')) {
          // Check if it's actually stale (not truly executing)
          const lastGit = getLastGitTimestamp();
          if (lastGit) {
            const hoursAgo = (Date.now() / 1000 - lastGit) / 3600;
            if (hoursAgo < stalenessHours) {
              // Recently active — skip (genuinely executing)
              return;
            }
            // Falls through to stale progress detection below
          } else {
            return;
          }
        }
      }

      validating = true;
      let anyFix = false;

      // --- Validation 1: STATE.md + ROADMAP.md cross-check ---
      invalidateRoadmap(cwd);
      const roadmap = parseRoadmap(cwd);
      const stateRaw = readStateMd();

      if (state && roadmap && stateRaw) {
        // Check phase number exists in roadmap
        const phaseMatch = state.phase ? state.phase.match(/^(\d+)/) : null;
        if (phaseMatch) {
          const phaseNum = parseInt(phaseMatch[1], 10);
          const rPhase = roadmap.getPhase(phaseNum);
          if (!rPhase) {
            getLogger().write('WARN', `Idle validation: STATE.md phase ${phaseNum} not found in ROADMAP.md`);
          }

          // Check for phase completion (EVNT-03)
          if (rPhase && rPhase.status === 'complete') {
            // Check if state still points to this completed phase
            // This means phase just completed — notify
            const nextPhase = roadmap.phases.find(p => {
              const pNum = parseInt(p.number, 10);
              return pNum > phaseNum && p.status !== 'complete';
            });

            if (nextPhase) {
              await notifier.notify({
                type: 'phase-complete',
                severity: 'warning',
                message: `Phase ${phaseNum} complete! Next: Phase ${nextPhase.number} (${nextPhase.name}). Verify against this repo's current checkout, and rebuild the local runtime before trusting generated guidance if runtime surfaces changed.`,
                action: `Next: /bgsd-plan phase ${nextPhase.number}`,
              });
            }
          }
        }

        // Progress bar fix
        if (state.progress !== null) {
          const fixed = fixProgressBar(stateRaw, state.progress);
          if (fixed) {
            const statePath = join(planningDir, 'STATE.md');
            writeTracked(statePath, fixed);
            invalidateState(cwd);
            anyFix = true;
            getLogger().write('INFO', `Idle validation: fixed progress bar visual`);
          }
        }
      }

      // --- Validation 2: Config.json schema check ---
      invalidateConfig(cwd);
      const freshConfig = parseConfig(cwd);
      if (freshConfig) {
        // parseConfig returns defaults if file is corrupt,
        // but we want to detect if the file itself is unreadable
        const configPath = join(planningDir, 'config.json');
        if (existsSync(configPath)) {
          try {
            const raw = readFileSync(configPath, 'utf-8');
            JSON.parse(raw); // Just validate it's valid JSON
          } catch {
            // Corrupt config.json — write defaults
            writeTracked(configPath, buildDefaultConfigText());
            invalidateConfig(cwd);
            anyFix = true;
            getLogger().write('WARN', `Idle validation: auto-fixed corrupt config.json with defaults`);
          }
        }
      }

      // --- Validation 3: Stale progress detection ---
      if (state && stateRaw) {
        const status = (state.status || '').toLowerCase();
        if (status.includes('executing') || status.includes('in progress')) {
          const lastGit = getLastGitTimestamp();
          if (lastGit) {
            const hoursAgo = (Date.now() / 1000 - lastGit) / 3600;
            if (hoursAgo >= stalenessHours) {
              // Stale — auto-fix status to "Paused"
              const statePath = join(planningDir, 'STATE.md');
              const updatedRaw = stateRaw.replace(
                /\*\*Status:\*\*\s*.+/i,
                '**Status:** Paused (auto-detected stale)'
              );
              if (updatedRaw !== stateRaw) {
                writeTracked(statePath, updatedRaw);
                invalidateState(cwd);
                anyFix = true;
                getLogger().write('INFO', `Idle validation: auto-fixed stale status (${hoursAgo.toFixed(1)}h idle)`);
              }
            }
          }
        }
      }

      // --- Notify if any fix was applied ---
      if (anyFix) {
        lastAutoFix = Date.now();
        await notifier.notify({
          type: 'state-sync',
          severity: 'info',
          message: 'State synced',
        });
      }

      validating = false;
      lastValidation = Date.now();
    } catch (err) {
      validating = false;
      lastValidation = Date.now();
      getLogger().write('ERROR', `Idle validation error: ${err.message}`);
    }
  }

  /**
   * Reset auto-fix loop prevention flag.
   * Called when user provides input — allows validation to resume.
   */
  function onUserInput() {
    lastAutoFix = 0;
  }

  return {
    onIdle,
    onUserInput,
  };
}
