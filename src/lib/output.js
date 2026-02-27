const fs = require('fs');
const path = require('path');

// ─── Temp File Cleanup ───────────────────────────────────────────────────────

const _tmpFiles = [];

process.on('exit', () => {
  for (const f of _tmpFiles) {
    try { fs.unlinkSync(f); } catch {}
  }
});

// ─── Field Filtering ─────────────────────────────────────────────────────────

/**
 * Filter an object to include only the specified fields.
 * Supports dot-notation for nested access: "phases.status"
 * For arrays, applies filtering to each element.
 * Missing fields are included as null.
 *
 * @param {*} obj - Object or array to filter
 * @param {string[]} fields - Field names (may use dot-notation)
 * @returns {*} Filtered object
 */
function filterFields(obj, fields) {
  if (obj === null || obj === undefined) return obj;

  // If array, filter each element
  if (Array.isArray(obj)) {
    return obj.map(item => filterFields(item, fields));
  }

  if (typeof obj !== 'object') return obj;

  const result = {};
  for (const field of fields) {
    const parts = field.split('.');
    if (parts.length === 1) {
      // Top-level field
      result[field] = field in obj ? obj[field] : null;
      // If the value is an array, don't filter it (no sub-fields specified)
    } else {
      // Dot-notation: walk the path
      const topKey = parts[0];
      const rest = parts.slice(1).join('.');
      if (!(topKey in obj)) {
        result[topKey] = null;
      } else {
        const val = obj[topKey];
        if (Array.isArray(val)) {
          // Apply sub-field filtering to each array element
          result[topKey] = val.map(item => {
            if (typeof item === 'object' && item !== null) {
              return filterFields(item, [rest]);
            }
            return item;
          });
        } else if (typeof val === 'object' && val !== null) {
          // Merge with existing filtered result for this key
          const existing = result[topKey] || {};
          const nested = filterFields(val, [rest]);
          result[topKey] = typeof existing === 'object' && !Array.isArray(existing)
            ? { ...existing, ...nested }
            : nested;
        } else {
          result[topKey] = val;
        }
      }
    }
  }
  return result;
}

// ─── Output Mode ─────────────────────────────────────────────────────────────

/**
 * Returns the current output mode: 'formatted', 'json', or 'pretty'.
 * Set by router.js at startup via global._gsdOutputMode.
 * Defaults to 'json' (safe for piped/scripted contexts).
 */
function outputMode() {
  return global._gsdOutputMode || 'json';
}

// ─── JSON Output ─────────────────────────────────────────────────────────────

/**
 * Write result as JSON to stdout. Handles field filtering and large payload
 * tmpfile fallback. Extracted from output() for dual-mode routing.
 */
function outputJSON(result, rawValue) {
  // In json mode, ALWAYS output structured JSON — ignore rawValue.
  // rawValue was a legacy --raw feature for plain text output.
  // With TTY auto-detection, piped contexts get JSON, TTY gets formatted.
  // rawValue is only honored in formatted/pretty mode (for commands that
  // produce simple text output like current-timestamp, generate-slug).
  const mode = global._gsdOutputMode || 'json';
  if (rawValue !== undefined && mode !== 'json') {
    process.stdout.write(String(rawValue));
    return;
  }
  let filtered = result;
  if (global._gsdRequestedFields && typeof result === 'object' && result !== null) {
    filtered = filterFields(result, global._gsdRequestedFields);
  }
  const json = JSON.stringify(filtered, null, 2);
  // Large payloads exceed OpenCode's Bash tool buffer (~50KB).
  // Write to tmpfile and output the path prefixed with @file: so callers can detect it.
  // GSD_NO_TMPFILE: skip file redirect (used by context-budget measure to capture full output)
  if (json.length > 50000 && !process.env.GSD_NO_TMPFILE) {
    const tmpPath = path.join(require('os').tmpdir(), `gsd-${Date.now()}.json`);
    fs.writeFileSync(tmpPath, json, 'utf-8');
    _tmpFiles.push(tmpPath);
    process.stdout.write('@file:' + tmpPath);
  } else {
    process.stdout.write(json);
  }
}

// ─── Output Functions ────────────────────────────────────────────────────────

/**
 * Primary output function with dual-mode routing.
 *
 * Modes (set by global._gsdOutputMode):
 *   'json'      — JSON to stdout (piped, default, backward-compat)
 *   'formatted' — Human-readable via formatter function (TTY)
 *   'pretty'    — Same as formatted, forced via --pretty flag
 *
 * @param {*} result - Data to output
 * @param {object|boolean} options - { rawValue, formatter } or legacy boolean (raw flag)
 *   rawValue:  If provided, write as plain string (bypasses JSON/formatting)
 *   formatter: function(result) => string — renders human-readable output
 *
 * Backward compatibility: if options is boolean, treat as legacy raw mode
 * (JSON output). This ensures all existing command handlers keep working
 * during migration. Individual commands get migrated to output(result, { formatter })
 * in Phases 32-34.
 */
function output(result, options) {
  // Legacy backward compatibility: output(result, raw) or output(result, raw, rawValue)
  if (typeof options === 'boolean') {
    outputJSON(result, arguments[2]);
    process.exit(process.exitCode || 0);
    return;
  }

  const opts = options || {};
  const mode = outputMode();

  if (mode === 'json') {
    // JSON mode — existing behavior (field filtering, tmpfile for large payloads)
    outputJSON(result, opts.rawValue);
  } else {
    // Formatted/pretty mode — use formatter if provided, else graceful fallback to JSON
    if (opts.formatter) {
      const formatted = opts.formatter(result);
      process.stdout.write(formatted + '\n');
    } else {
      // Graceful fallback: commands not yet migrated still produce JSON
      outputJSON(result, opts.rawValue);
    }
  }
  // Respect process.exitCode if set by commands (e.g. intent validate sets 1 for invalid)
  process.exit(process.exitCode || 0);
}

// ─── Status Output (stderr) ─────────────────────────────────────────────────

/**
 * Write a status/progress message to stderr.
 * Visible to the user even when stdout is piped to JSON.
 * Use for progress indicators, timing info, diagnostic messages.
 *
 * @param {string} message - Status message to display
 */
function status(message) {
  process.stderr.write(message + '\n');
}

// ─── Error & Debug ───────────────────────────────────────────────────────────

function error(message) {
  process.stderr.write('Error: ' + message + '\n');
  process.exit(1);
}

function debugLog(context, message, err) {
  if (!process.env.GSD_DEBUG) return;
  let line = `[GSD_DEBUG] ${context}: ${message}`;
  if (err) line += ` | ${err.message || err}`;
  process.stderr.write(line + '\n');
}

module.exports = { _tmpFiles, filterFields, output, outputMode, status, error, debugLog };
