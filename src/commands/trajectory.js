const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { output, error, debugLog } = require('../lib/output');
const { execGit, diffSummary } = require('../lib/git');

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

  // Check for uncommitted changes
  const status = execGit(cwd, ['status', '--porcelain']);
  if (status.exitCode === 0 && status.stdout) {
    error('Uncommitted changes detected. Commit or stash before checkpointing.');
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

module.exports = { cmdTrajectoryCheckpoint };
