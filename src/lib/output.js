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

// ─── Output Functions ────────────────────────────────────────────────────────

function output(result, raw, rawValue) {
  if (raw && rawValue !== undefined) {
    process.stdout.write(String(rawValue));
  } else {
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
  process.exit(0);
}

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

module.exports = { _tmpFiles, filterFields, output, error, debugLog };
