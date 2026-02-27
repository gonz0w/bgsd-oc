'use strict';

const fs = require('fs');
const path = require('path');

// ─── Opt-in Performance Profiler ─────────────────────────────────────────────
// Uses node:perf_hooks for timing. Zero-cost when GSD_PROFILE is not set.
// Enable via: GSD_PROFILE=1 gsd-tools <command>
// Baselines written to .planning/baselines/{commandName}-{timestamp}.json

const enabled = process.env.GSD_PROFILE === '1';
const timings = [];

/**
 * Check if profiling is enabled.
 * @returns {boolean}
 */
function isProfilingEnabled() {
  return enabled;
}

/**
 * Create a performance mark.
 * @param {string} label - Mark name
 */
function mark(label) {
  if (!enabled) return;
  const { performance } = require('node:perf_hooks');
  performance.mark(label);
}

/**
 * Measure between two marks.
 * @param {string} label - Measurement name
 * @param {string} startMark - Start mark name
 * @param {string} endMark - End mark name
 */
function measure(label, startMark, endMark) {
  if (!enabled) return;
  const { performance } = require('node:perf_hooks');
  try {
    const m = performance.measure(label, startMark, endMark);
    timings.push({ label, duration_ms: Math.round(m.duration * 100) / 100 });
  } catch (e) {
    // Marks may not exist — silently skip
  }
}

/**
 * Start a timer. Returns a timer object if enabled, null otherwise.
 * @param {string} label - Timer label
 * @returns {{ label: string, start: number } | null}
 */
function startTimer(label) {
  if (!enabled) return null;
  const { performance } = require('node:perf_hooks');
  return { label, start: performance.now() };
}

/**
 * End a timer and record the elapsed time.
 * @param {{ label: string, start: number } | null} timer - Timer from startTimer
 * @returns {{ label: string, duration_ms: number } | null}
 */
function endTimer(timer) {
  if (!enabled || !timer) return null;
  const { performance } = require('node:perf_hooks');
  const duration_ms = Math.round((performance.now() - timer.start) * 100) / 100;
  const entry = { label: timer.label, duration_ms };
  timings.push(entry);
  return entry;
}

/**
 * Get all recorded timings.
 * @returns {Array<{ label: string, duration_ms: number }>}
 */
function getTimings() {
  return [...timings];
}

/**
 * Write timing data to .planning/baselines/{commandName}-{timestamp}.json.
 * Creates .planning/baselines/ if missing. Only writes if profiling is enabled.
 * @param {string} cwd - Working directory
 * @param {string} commandName - Command name for the baseline file
 */
function writeBaseline(cwd, commandName) {
  if (!enabled) return;

  const totalMs = timings.reduce((sum, t) => sum + t.duration_ms, 0);
  const timestamp = new Date().toISOString();
  const safeTimestamp = timestamp.replace(/[:.]/g, '-');

  const baseline = {
    command: commandName,
    timestamp,
    node_version: process.version,
    timings: [...timings],
    total_ms: Math.round(totalMs * 100) / 100,
  };

  const baselinesDir = path.join(cwd, '.planning', 'baselines');
  try {
    fs.mkdirSync(baselinesDir, { recursive: true });
    const filename = `${commandName}-${safeTimestamp}.json`;
    fs.writeFileSync(path.join(baselinesDir, filename), JSON.stringify(baseline, null, 2) + '\n', 'utf-8');
  } catch (e) {
    // Non-blocking — profiling shouldn't crash the tool
    if (process.env.GSD_DEBUG) {
      process.stderr.write(`[GSD_DEBUG] profiler.writeBaseline: ${e.message}\n`);
    }
  }
}

module.exports = { isProfilingEnabled, mark, measure, startTimer, endTimer, getTimings, writeBaseline };
