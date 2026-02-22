const fs = require('fs');
const path = require('path');

// ─── Temp File Cleanup ───────────────────────────────────────────────────────

const _tmpFiles = [];

process.on('exit', () => {
  for (const f of _tmpFiles) {
    try { fs.unlinkSync(f); } catch {}
  }
});

// ─── Output Functions ────────────────────────────────────────────────────────

function output(result, raw, rawValue) {
  if (raw && rawValue !== undefined) {
    process.stdout.write(String(rawValue));
  } else {
    const json = JSON.stringify(result, null, 2);
    // Large payloads exceed Claude Code's Bash tool buffer (~50KB).
    // Write to tmpfile and output the path prefixed with @file: so callers can detect it.
    if (json.length > 50000) {
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

module.exports = { _tmpFiles, output, error, debugLog };
