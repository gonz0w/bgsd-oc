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

// ─── Trajectory Pivot ────────────────────────────────────────────────────────

/**
 * Abandon current approach, rewind to a prior checkpoint.
 * Usage: trajectory pivot <checkpoint> --reason "why" [--scope <scope>] [--attempt <N>] [--stash]
 */
function cmdTrajectoryPivot(cwd, args, raw) {
  const { selectiveRewind } = require('../lib/git');

  // Parse subcommand args: args[0] is 'pivot', rest are positional/flags
  const posArgs = [];
  let scope = 'phase';
  let reasonText = null;
  let attemptNum = null;
  let stashFlag = false;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--scope' && args[i + 1]) { scope = args[++i]; continue; }
    if (args[i] === '--reason' && args[i + 1]) { reasonText = args[++i]; continue; }
    if (args[i] === '--attempt' && args[i + 1]) { attemptNum = parseInt(args[++i], 10); continue; }
    if (args[i] === '--stash') { stashFlag = true; continue; }
    if (!args[i].startsWith('-')) posArgs.push(args[i]);
  }

  const name = posArgs[0];
  if (!name) error('Missing checkpoint name. Usage: trajectory pivot <checkpoint> --reason "what failed and why"');
  if (!NAME_RE.test(name)) error(`Invalid checkpoint name "${name}". Use alphanumeric, hyphens, underscores only.`);

  // Step 1 — Dirty working tree check
  let stashUsed = false;
  const statusResult = execGit(cwd, ['status', '--porcelain']);
  if (statusResult.exitCode === 0 && statusResult.stdout) {
    const dirtyNonPlanning = statusResult.stdout.split('\n')
      .filter(line => line.trim() && !line.slice(3).startsWith('.planning/'));
    if (dirtyNonPlanning.length > 0) {
      if (stashFlag) {
        const stashResult = execGit(cwd, ['stash', 'push', '-m', 'gsd-pivot-auto-stash']);
        if (stashResult.exitCode !== 0) error('Failed to auto-stash: ' + stashResult.stderr);
        stashUsed = true;
      } else {
        error('Uncommitted changes detected. Commit or stash before pivoting.\nTo auto-stash: trajectory pivot <checkpoint> --stash');
      }
    }
  }

  // Step 2 — Resolve checkpoint (find target)
  const memDir = path.join(cwd, '.planning', 'memory');
  const trajPath = path.join(memDir, 'trajectory.json');
  let entries = [];
  try {
    const data = fs.readFileSync(trajPath, 'utf-8');
    entries = JSON.parse(data);
    if (!Array.isArray(entries)) entries = [];
  } catch (e) {
    debugLog('trajectory.pivot', 'no trajectory.json found', e);
    entries = [];
  }

  // Filter to matching checkpoints (non-abandoned)
  const matching = entries.filter(e =>
    e.category === 'checkpoint' &&
    e.checkpoint_name === name &&
    e.scope === scope &&
    !(e.tags && e.tags.includes('abandoned'))
  );

  if (matching.length === 0) {
    // Build available checkpoints list
    const allCheckpoints = entries.filter(e => e.category === 'checkpoint' && !(e.tags && e.tags.includes('abandoned')));
    const byName = {};
    for (const cp of allCheckpoints) {
      const key = `${cp.checkpoint_name} (scope: ${cp.scope})`;
      if (!byName[key]) byName[key] = [];
      byName[key].push(cp.attempt);
    }
    const availableList = Object.keys(byName).length > 0
      ? Object.entries(byName).map(([k, v]) => `  ${k} — attempt${v.length > 1 ? 's' : ''} ${v.join(', ')}`).join('\n')
      : '  (none)';
    if (stashUsed) execGit(cwd, ['stash', 'pop']);
    error('Checkpoint "' + name + '" not found (scope: ' + scope + ').\nAvailable checkpoints:\n' + availableList);
  }

  let targetEntry;
  if (attemptNum !== null) {
    targetEntry = matching.find(e => e.attempt === attemptNum);
    if (!targetEntry) {
      if (stashUsed) execGit(cwd, ['stash', 'pop']);
      error('Attempt ' + attemptNum + ' not found for checkpoint "' + name + '" (scope: ' + scope + ').');
    }
  } else {
    // Pick highest attempt number (most recent)
    targetEntry = matching.reduce((best, e) => (!best || e.attempt > best.attempt) ? e : best, null);
  }

  // Step 3 — Capture structured reason
  if (!reasonText) {
    if (stashUsed) execGit(cwd, ['stash', 'pop']);
    error('Reason required. Use --reason "what failed, why, what signals" to record why this approach is being abandoned.');
  }

  // Step 4 — Auto-checkpoint current work as abandoned
  const headResult = execGit(cwd, ['rev-parse', 'HEAD']);
  const currentHeadSha = headResult.exitCode === 0 ? headResult.stdout : 'unknown';

  // Count existing checkpoint entries for same scope+name to determine next attempt number
  const allForName = entries.filter(e =>
    e.category === 'checkpoint' && e.scope === scope && e.checkpoint_name === name
  );
  const abandonedAttempt = allForName.length + 1;
  const abandonedBranchName = `archived/trajectory/${scope}/${name}/attempt-${abandonedAttempt}`;

  // Create abandoned branch (ref only, no checkout)
  const brResult = execGit(cwd, ['branch', abandonedBranchName]);
  if (brResult.exitCode !== 0) {
    debugLog('trajectory.pivot', 'branch creation warning', brResult.stderr);
  }

  // Generate unique journal entry ID
  let id;
  const existingIds = new Set(entries.map(e => e.id));
  do {
    id = 'tj-' + crypto.randomBytes(3).toString('hex');
  } while (existingIds.has(id));

  // Write abandoned journal entry
  const abandonedEntry = {
    id,
    timestamp: new Date().toISOString(),
    category: 'checkpoint',
    text: `Abandoned: ${name} (attempt ${abandonedAttempt})`,
    scope,
    checkpoint_name: name,
    attempt: abandonedAttempt,
    branch: abandonedBranchName,
    git_ref: currentHeadSha,
    description: null,
    metrics: null,
    reason: { text: reasonText },
    tags: ['checkpoint', 'abandoned'],
  };

  entries.push(abandonedEntry);

  // Step 5 — Selective rewind to checkpoint
  const result = selectiveRewind(cwd, { ref: targetEntry.git_ref, confirm: true });
  if (result.error) {
    if (stashUsed) execGit(cwd, ['stash', 'pop']);
    error('Rewind failed: ' + result.error);
  }

  // Pop stash after rewind if used
  if (stashUsed) {
    execGit(cwd, ['stash', 'pop']);
  }

  // Step 6 — Write journal and output
  fs.mkdirSync(memDir, { recursive: true });
  fs.writeFileSync(trajPath, JSON.stringify(entries, null, 2), 'utf-8');

  output({
    pivoted: true,
    checkpoint: name,
    target_ref: targetEntry.git_ref,
    abandoned_branch: abandonedBranchName,
    files_rewound: result.files_changed,
    stash_used: stashUsed,
  }, { formatter: formatPivotResult });
}

/**
 * Format pivot result for TTY output.
 */
function formatPivotResult(result) {
  const lines = [];
  lines.push(banner('TRAJECTORY PIVOT'));
  lines.push('');
  lines.push(summaryLine(`Pivoted to ${color.bold(result.checkpoint)}. Abandoned attempt archived as ${color.cyan(result.abandoned_branch)}.`));
  lines.push('');
  lines.push(`  ${SYMBOLS.check} Target ref: ${color.dim(result.target_ref.slice(0, 7))}`);
  lines.push(`  ${SYMBOLS.check} Files rewound: ${result.files_rewound}`);
  if (result.stash_used) {
    lines.push(`  ${SYMBOLS.warning} Working tree auto-stashed and restored`);
  }
  lines.push('');
  lines.push(actionHint('trajectory list'));
  return lines.join('\n');
}

// ─── Trajectory Compare ──────────────────────────────────────────────────────

/**
 * Compare metrics across all attempts for a named checkpoint.
 * Usage: trajectory compare <name> [--scope <scope>]
 */
function cmdTrajectoryCompare(cwd, args, raw) {
  const posArgs = [];
  let scope = 'phase';

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--scope' && args[i + 1]) { scope = args[++i]; continue; }
    if (!args[i].startsWith('-')) posArgs.push(args[i]);
  }

  const name = posArgs[0];
  if (!name) error('Missing checkpoint name. Usage: trajectory compare <name> [--scope <scope>]');

  // Read trajectory journal
  const trajPath = path.join(cwd, '.planning', 'memory', 'trajectory.json');
  let entries = [];
  try {
    const data = fs.readFileSync(trajPath, 'utf-8');
    entries = JSON.parse(data);
    if (!Array.isArray(entries)) entries = [];
  } catch (e) {
    debugLog('trajectory.compare', 'no trajectory.json found', e);
    entries = [];
  }

  // Filter to matching non-abandoned checkpoints
  const attempts = entries.filter(e =>
    e.category === 'checkpoint' &&
    e.checkpoint_name === name &&
    e.scope === scope &&
    !(e.tags && e.tags.includes('abandoned'))
  ).sort((a, b) => a.attempt - b.attempt);

  if (attempts.length === 0) {
    // Build available checkpoint names for error message
    const allCheckpoints = entries.filter(e => e.category === 'checkpoint' && !(e.tags && e.tags.includes('abandoned')));
    const byName = {};
    for (const cp of allCheckpoints) {
      const key = `${cp.checkpoint_name} (scope: ${cp.scope})`;
      if (!byName[key]) byName[key] = [];
      byName[key].push(cp.attempt);
    }
    const availableList = Object.keys(byName).length > 0
      ? Object.entries(byName).map(([k, v]) => `  ${k} — attempt${v.length > 1 ? 's' : ''} ${v.join(', ')}`).join('\n')
      : '  (none)';
    error('Checkpoint "' + name + '" not found (scope: ' + scope + ').\nAvailable checkpoints:\n' + availableList);
  }

  // Build metrics array from entries
  const metrics = attempts.map(a => ({
    attempt: a.attempt,
    branch: a.branch,
    git_ref: a.git_ref,
    timestamp: a.timestamp,
    tests_pass: a.metrics?.tests?.pass ?? null,
    tests_fail: a.metrics?.tests?.fail ?? null,
    tests_total: a.metrics?.tests?.total ?? null,
    loc_insertions: a.metrics?.loc_delta?.insertions ?? null,
    loc_deletions: a.metrics?.loc_delta?.deletions ?? null,
    complexity: a.metrics?.complexity?.total ?? null,
  }));

  // Identify best/worst per metric
  const bestPerMetric = {};
  const worstPerMetric = {};
  const metricKeys = ['tests_pass', 'tests_fail', 'loc_insertions', 'loc_deletions', 'complexity'];
  const direction = {
    tests_pass: 'higher',
    tests_fail: 'lower',
    loc_insertions: 'lower',
    loc_deletions: 'lower',
    complexity: 'lower',
  };

  for (const key of metricKeys) {
    let bestIdx = -1, worstIdx = -1, bestVal = null, worstVal = null;
    for (let i = 0; i < metrics.length; i++) {
      const val = metrics[i][key];
      if (val === null) continue;
      if (bestVal === null || (direction[key] === 'higher' ? val > bestVal : val < bestVal)) {
        bestVal = val; bestIdx = i;
      }
      if (worstVal === null || (direction[key] === 'higher' ? val < worstVal : val > worstVal)) {
        worstVal = val; worstIdx = i;
      }
    }
    // Only assign best/worst if they differ (skip for single-attempt or tied)
    if (bestIdx !== -1 && bestIdx !== worstIdx) {
      bestPerMetric[key] = bestIdx;
      worstPerMetric[key] = worstIdx;
    }
  }

  const result = {
    checkpoint: name,
    scope,
    attempt_count: metrics.length,
    attempts: metrics,
    best_per_metric: bestPerMetric,
    worst_per_metric: worstPerMetric,
  };

  output(result, { formatter: formatCompareResult });
}

/**
 * Format compare result for TTY output.
 */
function formatCompareResult(result) {
  const lines = [];
  lines.push(banner('TRAJECTORY COMPARE'));
  lines.push('');
  lines.push(`  Checkpoint: ${color.bold(result.checkpoint)} (scope: ${result.scope})`);
  lines.push(`  Attempts: ${result.attempt_count}`);
  lines.push('');

  const headers = ['Attempt', 'Tests Pass', 'Tests Fail', 'LOC +/-', 'Complexity'];
  const rows = result.attempts.map(a => [
    `#${a.attempt}`,
    a.tests_pass !== null ? String(a.tests_pass) : '-',
    a.tests_fail !== null ? String(a.tests_fail) : '-',
    a.loc_insertions !== null ? `+${a.loc_insertions}/-${a.loc_deletions || 0}` : '-',
    a.complexity !== null ? String(a.complexity) : '-',
  ]);

  // Map column indices to metric keys for colorFn
  const colToMetric = [null, 'tests_pass', 'tests_fail', 'loc_insertions', 'complexity'];

  lines.push(formatTable(headers, rows, {
    showAll: true,
    colorFn: (value, colIdx, rowIdx) => {
      if (colIdx === 0) return String(value != null ? value : '');
      const metric = colToMetric[colIdx];
      if (!metric) return String(value != null ? value : '');
      if (result.best_per_metric[metric] === rowIdx) return color.green(String(value != null ? value : ''));
      if (result.worst_per_metric[metric] === rowIdx) return color.red(String(value != null ? value : ''));
      return String(value != null ? value : '');
    },
  }));

  lines.push('');
  lines.push(summaryLine('Best attempt per metric highlighted in green'));
  lines.push(actionHint('trajectory choose <attempt-N>'));

  return lines.join('\n');
}

// ─── Trajectory Choose ───────────────────────────────────────────────────────

/**
 * Select the winning attempt, merge its code, archive non-chosen as tags, clean up branches.
 * Usage: trajectory choose <name> --attempt <N> [--scope <scope>] [--reason "why"]
 */
function cmdTrajectoryChoose(cwd, args, raw) {
  const posArgs = [];
  let scope = 'phase';
  let reasonText = null;
  let attemptNum = null;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--scope' && args[i + 1]) { scope = args[++i]; continue; }
    if (args[i] === '--reason' && args[i + 1]) { reasonText = args[++i]; continue; }
    if (args[i] === '--attempt' && args[i + 1]) { attemptNum = parseInt(args[++i], 10); continue; }
    if (!args[i].startsWith('-')) posArgs.push(args[i]);
  }

  const name = posArgs[0];
  if (!name) error('Missing checkpoint name. Usage: trajectory choose <name> --attempt <N>');
  if (!NAME_RE.test(name)) error(`Invalid checkpoint name "${name}". Use alphanumeric, hyphens, underscores only.`);
  if (attemptNum === null || isNaN(attemptNum)) error('Must specify winning attempt: trajectory choose <name> --attempt <N>');

  // Read trajectory journal
  const memDir = path.join(cwd, '.planning', 'memory');
  const trajPath = path.join(memDir, 'trajectory.json');
  let entries = [];
  try {
    const data = fs.readFileSync(trajPath, 'utf-8');
    entries = JSON.parse(data);
    if (!Array.isArray(entries)) entries = [];
  } catch (e) {
    debugLog('trajectory.choose', 'no trajectory.json found', e);
    entries = [];
  }

  // Find all checkpoint entries for this scope+name
  const allCheckpoints = entries.filter(e =>
    e.category === 'checkpoint' &&
    e.checkpoint_name === name &&
    e.scope === scope
  );

  if (allCheckpoints.length === 0) {
    error('No checkpoints found for "' + name + '" (scope: ' + scope + ').');
  }

  // Find winning entry — must exist and NOT be abandoned
  const winningEntry = allCheckpoints.find(e =>
    e.attempt === attemptNum && !(e.tags && e.tags.includes('abandoned'))
  );

  if (!winningEntry) {
    const available = allCheckpoints
      .filter(e => !(e.tags && e.tags.includes('abandoned')))
      .map(e => e.attempt);
    error('Attempt ' + attemptNum + ' not found (or is abandoned) for checkpoint "' + name + '" (scope: ' + scope + ').\nAvailable non-abandoned attempts: ' + (available.length > 0 ? available.join(', ') : '(none)'));
  }

  // Verify winning branch exists
  const verifyResult = execGit(cwd, ['rev-parse', '--verify', winningEntry.branch]);
  if (verifyResult.exitCode !== 0) {
    error('Branch not found: ' + winningEntry.branch + '. Was it already cleaned up?');
  }

  // Merge winning attempt's code
  const mergeResult = execGit(cwd, ['merge', '--no-ff', winningEntry.branch, '-m', 'trajectory: choose attempt-' + attemptNum + ' for ' + name]);
  if (mergeResult.exitCode !== 0) {
    error('Merge conflict. Resolve manually, then commit.\n' + (mergeResult.stderr || ''));
  }

  // Get HEAD after merge
  const headResult = execGit(cwd, ['rev-parse', 'HEAD']);
  const mergeRef = headResult.exitCode === 0 ? headResult.stdout : 'unknown';

  // Archive non-chosen attempts as tags + delete ALL branches
  const archivedTags = [];
  const deletedBranches = [];

  for (const entry of allCheckpoints) {
    if (!entry.branch) continue;

    // Archive non-winning entries as lightweight tags
    if (entry.attempt !== attemptNum) {
      const tagResult = execGit(cwd, ['tag', entry.branch, entry.git_ref]);
      if (tagResult.exitCode === 0) {
        archivedTags.push(entry.branch);
      } else {
        debugLog('trajectory.choose', 'tag creation warning for ' + entry.branch, tagResult.stderr);
      }
    }

    // Delete ALL trajectory working branches (including winner after merge)
    const delResult = execGit(cwd, ['branch', '-D', entry.branch]);
    if (delResult.exitCode === 0) {
      deletedBranches.push(entry.branch);
    } else {
      debugLog('trajectory.choose', 'branch deletion warning for ' + entry.branch, delResult.stderr);
    }
  }

  // Write journal entry
  let id;
  const existingIds = new Set(entries.map(e => e.id));
  do {
    id = 'tj-' + crypto.randomBytes(3).toString('hex');
  } while (existingIds.has(id));

  const journalEntry = {
    id,
    timestamp: new Date().toISOString(),
    category: 'choose',
    text: `Chosen: ${name} attempt ${attemptNum}`,
    scope,
    checkpoint_name: name,
    chosen_attempt: attemptNum,
    chosen_branch: winningEntry.branch,
    chosen_ref: winningEntry.git_ref,
    reason: reasonText ? { text: reasonText } : null,
    archived_tags: archivedTags,
    deleted_branches: deletedBranches,
    tags: ['choose', 'lifecycle-complete'],
  };

  entries.push(journalEntry);
  fs.mkdirSync(memDir, { recursive: true });
  fs.writeFileSync(trajPath, JSON.stringify(entries, null, 2), 'utf-8');

  // Output
  output({
    chosen: true,
    checkpoint: name,
    scope,
    chosen_attempt: attemptNum,
    chosen_branch: winningEntry.branch,
    merge_ref: mergeRef,
    archived_tags: archivedTags,
    deleted_branches: deletedBranches,
    reason: reasonText || null,
  }, { formatter: formatChooseResult });
}

/**
 * Format choose result for TTY output.
 */
function formatChooseResult(result) {
  const lines = [];
  lines.push(banner('TRAJECTORY CHOOSE'));
  lines.push('');
  lines.push(summaryLine(`Chose attempt ${color.bold('#' + result.chosen_attempt)} for ${color.bold(result.checkpoint)}. Merged and cleaned up.`));
  lines.push('');

  if (result.archived_tags.length > 0) {
    lines.push('  Archived tags:');
    for (const tag of result.archived_tags) {
      lines.push(`    ${SYMBOLS.check} ${color.cyan(tag)}`);
    }
    lines.push('');
  }

  if (result.deleted_branches.length > 0) {
    lines.push('  Deleted branches:');
    for (const br of result.deleted_branches) {
      lines.push(`    ${SYMBOLS.check} ${color.dim(br)}`);
    }
    lines.push('');
  }

  if (result.reason) {
    lines.push(`  ${color.dim('Reason: ' + result.reason)}`);
    lines.push('');
  }

  lines.push(actionHint('trajectory list'));
  return lines.join('\n');
}

module.exports = { cmdTrajectoryCheckpoint, cmdTrajectoryList, cmdTrajectoryPivot, cmdTrajectoryCompare, cmdTrajectoryChoose };
