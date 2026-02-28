const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { output, error, debugLog } = require('../lib/output');
const { execGit, diffSummary } = require('../lib/git');
const { banner, formatTable, summaryLine, actionHint, color, SYMBOLS, relativeTime } = require('../lib/format');

// ─── Trajectory Checkpoint ───────────────────────────────────────────────────

const NAME_RE = /^[a-zA-Z0-9_-]+$/;

/**
 * Create a named checkpoint branch with auto-collected metrics.
 * Usage: trajectory checkpoint <name> [--scope <scope>] [--description <text>]
 */
function cmdTrajectoryCheckpoint(cwd, args, raw) {
  // Parse subcommand args: args[0] is 'checkpoint', rest are positional/flags
  const posArgs = [];
  let scope = 'phase';
  let description = null;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--scope' && args[i + 1]) { scope = args[++i]; continue; }
    if (args[i] === '--description' && args[i + 1]) { description = args[++i]; continue; }
    if (!args[i].startsWith('-')) posArgs.push(args[i]);
  }

  const name = posArgs[0];
  if (!name) error('Missing checkpoint name. Usage: trajectory checkpoint <name>');
  if (!NAME_RE.test(name)) error(`Invalid checkpoint name "${name}". Use alphanumeric, hyphens, underscores only.`);

  // Check for uncommitted changes (excluding .planning/ metadata)
  const statusResult = execGit(cwd, ['status', '--porcelain']);
  if (statusResult.exitCode === 0 && statusResult.stdout) {
    const dirtyNonPlanning = statusResult.stdout.split('\n')
      .filter(line => line.trim() && !line.slice(3).startsWith('.planning/'));
    if (dirtyNonPlanning.length > 0) {
      error('Uncommitted changes detected. Commit or stash before checkpointing.');
    }
  }

  // Read trajectory journal to determine attempt number
  const memDir = path.join(cwd, '.planning', 'memory');
  const trajPath = path.join(memDir, 'trajectory.json');
  let entries = [];
  try {
    const raw = fs.readFileSync(trajPath, 'utf-8');
    entries = JSON.parse(raw);
    if (!Array.isArray(entries)) entries = [];
  } catch (e) {
    debugLog('trajectory.checkpoint', 'no existing trajectory.json', e);
    entries = [];
  }

  // Count existing checkpoints with same scope+name
  const existing = entries.filter(e =>
    e.category === 'checkpoint' && e.scope === scope && e.checkpoint_name === name
  );
  const attempt = existing.length + 1;
  const branchName = `trajectory/${scope}/${name}/attempt-${attempt}`;

  // Create branch (ref only, no checkout)
  const brResult = execGit(cwd, ['branch', branchName]);
  if (brResult.exitCode !== 0) {
    error(`Failed to create branch "${branchName}": ${brResult.stderr}`);
  }

  // Verify branch was created
  const verifyResult = execGit(cwd, ['rev-parse', '--verify', branchName]);
  if (verifyResult.exitCode !== 0) {
    error(`Branch "${branchName}" was not created successfully.`);
  }

  // Get HEAD SHA
  const headResult = execGit(cwd, ['rev-parse', 'HEAD']);
  const gitRef = headResult.exitCode === 0 ? headResult.stdout : 'unknown';

  // ─── Collect Metrics ────────────────────────────────────────────────────
  const metrics = { tests: null, loc_delta: null, complexity: null };

  // Test count
  try {
    const testOutput = execFileSync('node', ['--test', path.join(cwd, 'bin', 'gsd-tools.test.cjs')], {
      cwd, encoding: 'utf-8', stdio: 'pipe', timeout: 120000,
    });
    metrics.tests = parseTestOutput(testOutput);
  } catch (e) {
    // Tests may fail — still parse output
    const combined = (e.stdout || '') + '\n' + (e.stderr || '');
    metrics.tests = parseTestOutput(combined);
  }

  // LOC delta
  try {
    let diff = diffSummary(cwd, { from: 'HEAD~5', to: 'HEAD' });
    if (diff.error) diff = diffSummary(cwd, { from: 'HEAD~1', to: 'HEAD' });
    if (!diff.error) {
      metrics.loc_delta = {
        insertions: diff.total_insertions,
        deletions: diff.total_deletions,
        files_changed: diff.file_count,
      };
    }
  } catch (e) {
    debugLog('trajectory.checkpoint', 'LOC delta failed', e);
  }

  // Cyclomatic complexity (lightweight — analyze changed files only)
  try {
    const changedFiles = getRecentChangedFiles(cwd);
    let totalComplexity = 0;
    let filesAnalyzed = 0;
    for (const file of changedFiles) {
      if (!file.endsWith('.js')) continue;
      const fullPath = path.join(cwd, file);
      if (!fs.existsSync(fullPath)) continue;
      try {
        const astOut = execFileSync('node', [path.join(cwd, 'bin', 'gsd-tools.cjs'), 'codebase', 'complexity', file], {
          cwd, encoding: 'utf-8', stdio: 'pipe', timeout: 15000,
        });
        const parsed = JSON.parse(astOut);
        if (parsed.module_complexity !== undefined) {
          totalComplexity += parsed.module_complexity;
          filesAnalyzed++;
        }
      } catch (e) {
        debugLog('trajectory.checkpoint', `complexity failed for ${file}`, e);
      }
    }
    metrics.complexity = { total: totalComplexity, files_analyzed: filesAnalyzed };
  } catch (e) {
    debugLog('trajectory.checkpoint', 'complexity collection failed', e);
  }

  // ─── Write Journal Entry ────────────────────────────────────────────────
  let id;
  const existingIds = new Set(entries.map(e => e.id));
  do {
    id = 'tj-' + crypto.randomBytes(3).toString('hex');
  } while (existingIds.has(id));

  const entry = {
    id,
    timestamp: new Date().toISOString(),
    category: 'checkpoint',
    text: `Checkpoint: ${name} (attempt ${attempt})`,
    scope,
    checkpoint_name: name,
    attempt,
    branch: branchName,
    git_ref: gitRef,
    description: description || null,
    metrics,
    tags: ['checkpoint'],
  };

  entries.push(entry);
  fs.mkdirSync(memDir, { recursive: true });
  fs.writeFileSync(trajPath, JSON.stringify(entries, null, 2), 'utf-8');

  // ─── Output ─────────────────────────────────────────────────────────────
  output({
    created: true,
    checkpoint: name,
    branch: branchName,
    attempt,
    git_ref: gitRef,
    metrics,
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseTestOutput(text) {
  const result = { total: 0, pass: 0, fail: 0 };
  if (!text) return result;
  const totalMatch = text.match(/# tests (\d+)/);
  const passMatch = text.match(/# pass (\d+)/);
  const failMatch = text.match(/# fail (\d+)/);
  if (totalMatch) result.total = parseInt(totalMatch[1], 10);
  if (passMatch) result.pass = parseInt(passMatch[1], 10);
  if (failMatch) result.fail = parseInt(failMatch[1], 10);
  return result;
}

function getRecentChangedFiles(cwd) {
  const diff = diffSummary(cwd, { from: 'HEAD~5', to: 'HEAD' });
  if (diff.error || !diff.files) return [];
  return diff.files.map(f => f.path).filter(Boolean);
}

// ─── Trajectory List ─────────────────────────────────────────────────────────

/**
 * List all checkpoints with metadata.
 * Usage: trajectory list [--scope <scope>] [--name <name>] [--limit <N>]
 */
function cmdTrajectoryList(cwd, args, raw) {
  let scopeFilter = null;
  let nameFilter = null;
  let limit = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--scope' && args[i + 1]) { scopeFilter = args[++i]; continue; }
    if (args[i] === '--name' && args[i + 1]) { nameFilter = args[++i]; continue; }
    if (args[i] === '--limit' && args[i + 1]) { limit = parseInt(args[++i], 10); continue; }
  }

  // Read trajectory journal
  const trajPath = path.join(cwd, '.planning', 'memory', 'trajectory.json');
  let entries = [];
  try {
    const data = fs.readFileSync(trajPath, 'utf-8');
    entries = JSON.parse(data);
    if (!Array.isArray(entries)) entries = [];
  } catch (e) {
    debugLog('trajectory.list', 'no trajectory.json found', e);
    entries = [];
  }

  // Filter to checkpoints only
  let checkpoints = entries.filter(e => e.category === 'checkpoint');

  // Apply filters
  if (scopeFilter) {
    checkpoints = checkpoints.filter(e => e.scope === scopeFilter);
  }
  if (nameFilter) {
    checkpoints = checkpoints.filter(e => e.checkpoint_name === nameFilter);
  }

  // Sort newest first
  checkpoints.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Apply limit
  if (limit && limit > 0) {
    checkpoints = checkpoints.slice(0, limit);
  }

  // Compute unique scopes
  const scopes = new Set(checkpoints.map(e => e.scope));

  const result = {
    checkpoints,
    count: checkpoints.length,
    scopes: scopes.size,
  };

  output(result, { formatter: formatTrajectoryList });
}

/**
 * Format trajectory list for TTY output.
 */
function formatTrajectoryList(result) {
  const lines = [];

  lines.push(banner('TRAJECTORY CHECKPOINTS'));

  if (result.count === 0) {
    lines.push('');
    lines.push('  No checkpoints found.');
    lines.push('');
    lines.push(actionHint('trajectory checkpoint <name>'));
    return lines.join('\n');
  }

  // Build table rows
  const headers = ['Name', 'Scope', 'Attempt', 'Ref', 'Tests', 'LOC \u0394', 'Age'];
  const rows = result.checkpoints.map(cp => {
    const ref = cp.git_ref ? cp.git_ref.slice(0, 7) : '-';

    // Tests column
    let testsStr = '-';
    if (cp.metrics && cp.metrics.tests) {
      const t = cp.metrics.tests;
      if (t.fail > 0) {
        testsStr = color.red(`${t.pass}/${t.total} ${SYMBOLS.cross}`);
      } else if (t.total > 0) {
        testsStr = color.green(`${t.pass}/${t.total} ${SYMBOLS.check}`);
      }
    }

    // LOC delta column
    let locStr = '-';
    if (cp.metrics && cp.metrics.loc_delta) {
      const d = cp.metrics.loc_delta;
      locStr = `+${d.insertions || 0}/-${d.deletions || 0}`;
    }

    // Age column
    const age = cp.timestamp ? relativeTime(cp.timestamp) : '-';

    return [
      cp.checkpoint_name || '-',
      cp.scope || '-',
      String(cp.attempt || '-'),
      ref,
      testsStr,
      locStr,
      age,
    ];
  });

  lines.push(formatTable(headers, rows, { showAll: true, maxRows: 50 }));
  lines.push('');
  lines.push(summaryLine(`${result.count} checkpoint${result.count !== 1 ? 's' : ''} (${result.scopes} scope${result.scopes !== 1 ? 's' : ''})`));
  lines.push(actionHint('trajectory compare <name>'));

  return lines.join('\n');
}

module.exports = { cmdTrajectoryCheckpoint, cmdTrajectoryList };
