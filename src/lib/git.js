const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { debugLog } = require('./output');

// ─── Git Execution ───────────────────────────────────────────────────────────

/**
 * Execute a git command without spawning a shell.
 * Uses execFileSync('git', args) instead of execSync('git ' + escaped)
 * to bypass shell interpretation overhead (~2ms savings per call).
 */
function execGit(cwd, args) {
  try {
    const stdout = execFileSync('git', args, {
      cwd,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    return { exitCode: 0, stdout: stdout.trim(), stderr: '' };
  } catch (err) {
    debugLog('git.exec', 'exec failed', err);
    return {
      exitCode: err.status ?? 1,
      stdout: (err.stdout ?? '').toString().trim(),
      stderr: (err.stderr ?? '').toString().trim(),
    };
  }
}

// ─── Structured Git Log ──────────────────────────────────────────────────────

/**
 * Returns array of commit objects with file stats.
 * @param {string} cwd - Working directory
 * @param {object} opts - Options: { count, since, until, path, author }
 * @returns {Array<object>} Array of commit objects
 */
function structuredLog(cwd, opts = {}) {
  const count = opts.count || 20;
  const logArgs = ['log', `--format=%H|%an|%ae|%ai|%s`, `-${count}`];

  if (opts.since) logArgs.push(`--since=${opts.since}`);
  if (opts.until) logArgs.push(`--until=${opts.until}`);
  if (opts.author) logArgs.push(`--author=${opts.author}`);
  if (opts.path) logArgs.push('--', opts.path);

  const logResult = execGit(cwd, logArgs);
  if (logResult.exitCode !== 0 || !logResult.stdout) {
    return { error: logResult.stderr || 'No commits found' };
  }

  const lines = logResult.stdout.split('\n').filter(Boolean);
  const commits = [];

  for (const line of lines) {
    const parts = line.split('|');
    if (parts.length < 5) continue;

    const hash = parts[0];
    const author = parts[1];
    const email = parts[2];
    const date = parts[3];
    const message = parts.slice(4).join('|'); // message may contain pipes

    // Get file stats for this commit
    const statResult = execGit(cwd, ['diff-tree', '--no-commit-id', '--numstat', '-r', hash]);
    const files = [];
    let totalInsertions = 0;
    let totalDeletions = 0;

    if (statResult.exitCode === 0 && statResult.stdout) {
      for (const statLine of statResult.stdout.split('\n').filter(Boolean)) {
        const [ins, del, filePath] = statLine.split('\t');
        const insertions = ins === '-' ? 0 : parseInt(ins, 10) || 0;
        const deletions = del === '-' ? 0 : parseInt(del, 10) || 0;
        files.push({ path: filePath, insertions, deletions, binary: ins === '-' });
        totalInsertions += insertions;
        totalDeletions += deletions;
      }
    }

    // Parse conventional commit
    let conventional = null;
    const ccMatch = message.match(/^(\w+)(?:\(([^)]*)\))?:\s*(.+)$/);
    if (ccMatch) {
      conventional = { type: ccMatch[1], scope: ccMatch[2] || null, description: ccMatch[3] };
    }

    commits.push({
      hash,
      author,
      email,
      date,
      message,
      conventional,
      files,
      file_count: files.length,
      total_insertions: totalInsertions,
      total_deletions: totalDeletions,
    });
  }

  return commits;
}

// ─── Diff Summary ────────────────────────────────────────────────────────────

/**
 * Returns diff stats between two refs.
 * @param {string} cwd - Working directory
 * @param {object} opts - Options: { from, to, path }
 * @returns {object} Diff summary with file stats
 */
function diffSummary(cwd, opts = {}) {
  const from = opts.from || 'HEAD~1';
  const to = opts.to || 'HEAD';
  const diffArgs = ['diff', '--numstat', from, to];

  if (opts.path) diffArgs.push('--', opts.path);

  const result = execGit(cwd, diffArgs);
  if (result.exitCode !== 0) {
    return { error: result.stderr || 'diff failed' };
  }

  const files = [];
  let totalInsertions = 0;
  let totalDeletions = 0;

  if (result.stdout) {
    for (const line of result.stdout.split('\n').filter(Boolean)) {
      const [ins, del, filePath] = line.split('\t');
      const insertions = ins === '-' ? 0 : parseInt(ins, 10) || 0;
      const deletions = del === '-' ? 0 : parseInt(del, 10) || 0;
      files.push({ path: filePath, insertions, deletions, binary: ins === '-' });
      totalInsertions += insertions;
      totalDeletions += deletions;
    }
  }

  return {
    from,
    to,
    files,
    file_count: files.length,
    total_insertions: totalInsertions,
    total_deletions: totalDeletions,
  };
}

// ─── Blame ───────────────────────────────────────────────────────────────────

/**
 * Returns line-to-commit/author mapping for a file.
 * @param {string} cwd - Working directory
 * @param {string} filePath - File path relative to repo root
 * @returns {object} Blame data with line mappings
 */
function blame(cwd, filePath) {
  if (!filePath) {
    return { error: 'file path required' };
  }

  const result = execGit(cwd, ['blame', '--porcelain', filePath]);
  if (result.exitCode !== 0) {
    return { error: result.stderr || 'blame failed' };
  }

  const lines = [];
  const uniqueAuthors = new Set();
  const uniqueCommits = new Set();

  // Parse porcelain blame output
  const rawLines = result.stdout.split('\n');
  let currentHash = null;
  let currentAuthor = null;
  let currentDate = null;
  let lineNumber = 0;

  for (const raw of rawLines) {
    // Commit line: 40-char hash followed by line numbers
    const commitMatch = raw.match(/^([0-9a-f]{40})\s+(\d+)\s+(\d+)/);
    if (commitMatch) {
      currentHash = commitMatch[1];
      lineNumber = parseInt(commitMatch[3], 10);
      uniqueCommits.add(currentHash);
      continue;
    }

    // Author line
    if (raw.startsWith('author ')) {
      currentAuthor = raw.slice(7);
      uniqueAuthors.add(currentAuthor);
      continue;
    }

    // Author-time line
    if (raw.startsWith('author-time ')) {
      const epoch = parseInt(raw.slice(12), 10);
      currentDate = new Date(epoch * 1000).toISOString();
      continue;
    }

    // Content line (starts with tab)
    if (raw.startsWith('\t')) {
      lines.push({
        line_number: lineNumber,
        hash: currentHash,
        author: currentAuthor,
        date: currentDate,
        content: raw.slice(1),
      });
    }
  }

  return {
    file: filePath,
    lines,
    unique_authors: [...uniqueAuthors],
    unique_commits: [...uniqueCommits],
  };
}

// ─── Branch Info ─────────────────────────────────────────────────────────────

/**
 * Returns current branch state including detached, shallow, dirty, rebasing.
 * @param {string} cwd - Working directory
 * @returns {object} Branch state information
 */
function branchInfo(cwd) {
  // Current branch name
  const branchResult = execGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const branch = branchResult.exitCode === 0 ? branchResult.stdout : null;

  // HEAD SHA
  const headResult = execGit(cwd, ['rev-parse', 'HEAD']);
  const headSha = headResult.exitCode === 0 ? headResult.stdout : null;

  // Detached HEAD check
  const isDetached = branch === 'HEAD';

  // Shallow repository check
  const shallowResult = execGit(cwd, ['rev-parse', '--is-shallow-repository']);
  const isShallow = shallowResult.exitCode === 0 && shallowResult.stdout === 'true';

  // Dirty files
  const statusResult = execGit(cwd, ['status', '--porcelain']);
  const dirtyLines = statusResult.exitCode === 0 && statusResult.stdout
    ? statusResult.stdout.split('\n').filter(Boolean)
    : [];
  const hasDirtyFiles = dirtyLines.length > 0;
  const dirtyFileCount = dirtyLines.length;

  // Active rebase check
  let gitDir = cwd;
  try {
    const gitDirResult = execGit(cwd, ['rev-parse', '--git-dir']);
    if (gitDirResult.exitCode === 0) {
      gitDir = path.resolve(cwd, gitDirResult.stdout);
    }
  } catch (e) {
    debugLog('git.branchInfo', 'git-dir resolution failed', e);
  }
  const isRebasing = fs.existsSync(path.join(gitDir, 'rebase-merge')) ||
                     fs.existsSync(path.join(gitDir, 'rebase-apply'));

  // Upstream tracking info
  let upstream = null;
  if (!isDetached) {
    const upstreamResult = execGit(cwd, ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}']);
    if (upstreamResult.exitCode === 0 && upstreamResult.stdout) {
      const [ahead, behind] = upstreamResult.stdout.split('\t').map(Number);
      // Get upstream branch name
      const upstreamNameResult = execGit(cwd, ['rev-parse', '--abbrev-ref', '@{upstream}']);
      if (upstreamNameResult.exitCode === 0) {
        const parts = upstreamNameResult.stdout.split('/');
        upstream = {
          remote: parts[0],
          branch: parts.slice(1).join('/'),
          ahead: ahead || 0,
          behind: behind || 0,
        };
      }
    }
  }

  return {
    branch,
    head_sha: headSha,
    is_detached: isDetached,
    is_shallow: isShallow,
    has_dirty_files: hasDirtyFiles,
    dirty_file_count: dirtyFileCount,
    is_rebasing: isRebasing,
    upstream,
  };
}

// ─── Selective Rewind ────────────────────────────────────────────────────────

const PROTECTED_PATHS = ['.planning', 'package.json', 'package-lock.json', 'tsconfig.json', '.gitignore', '.env'];

function isProtectedPath(f) {
  for (const p of PROTECTED_PATHS) if (f === p || f.startsWith(p + '/')) return true;
  return /^tsconfig\..*\.json$/.test(f) || /^\.env\./.test(f);
}

function selectiveRewind(cwd, opts = {}) {
  const { ref, confirm, dryRun } = opts;
  if (!ref) return { error: 'ref is required' };
  if (execGit(cwd, ['rev-parse', '--verify', ref]).exitCode !== 0) return { error: 'Invalid ref: ' + ref };

  const dr = execGit(cwd, ['diff', '--name-status', 'HEAD', ref, '--']);
  const changes = [], nonProt = [];
  let pc = 0;
  if (dr.exitCode === 0 && dr.stdout) {
    for (const line of dr.stdout.split('\n').filter(Boolean)) {
      const p = line.split('\t'), st = p[0], file = p[p.length - 1];
      if (isProtectedPath(file)) pc++; else { changes.push({ file, status: st }); nonProt.push(file); }
    }
  }
  if (dryRun) return { dry_run: true, ref, changes, protected_paths: PROTECTED_PATHS, files_affected: changes.length, files_protected: pc };
  if (!confirm) return { needs_confirm: true, ref, changes, protected_paths: PROTECTED_PATHS, files_affected: changes.length, files_protected: pc, message: 'Pass --confirm to execute rewind' };
  if (!nonProt.length) return { rewound: true, ref, files_changed: 0, files_protected: pc, stash_used: false };

  let stashed = false;
  const sr = execGit(cwd, ['status', '--porcelain']);
  if (sr.exitCode === 0 && sr.stdout && execGit(cwd, ['stash', 'push', '-m', 'gsd-rewind-auto-stash']).exitCode === 0) stashed = true;

  let err = null;
  try {
    if (nonProt.length > 50) {
      const r = execGit(cwd, ['checkout', ref, '--', '.']);
      if (r.exitCode !== 0) err = r.stderr || 'checkout failed';
      else {
        execGit(cwd, ['checkout', 'HEAD', '--', '.planning']);
        for (const pf of PROTECTED_PATHS) if (pf !== '.planning' && execGit(cwd, ['cat-file', '-e', 'HEAD:' + pf]).exitCode === 0) execGit(cwd, ['checkout', 'HEAD', '--', pf]);
        const ls = execGit(cwd, ['ls-tree', '--name-only', 'HEAD']);
        if (ls.exitCode === 0 && ls.stdout) for (const f of ls.stdout.split('\n').filter(Boolean)) if (/^tsconfig\..*\.json$/.test(f) || /^\.env\./.test(f)) execGit(cwd, ['checkout', 'HEAD', '--', f]);
      }
    } else {
      const r = execGit(cwd, ['checkout', ref, '--', ...nonProt]);
      if (r.exitCode !== 0) err = r.stderr || 'checkout failed';
    }
  } catch (e) { err = e.message; }
  if (stashed) execGit(cwd, ['stash', 'pop']);
  if (err) return { error: 'Rewind failed: ' + err, stash_restored: stashed };
  return { rewound: true, ref, files_changed: nonProt.length, files_protected: pc, stash_used: stashed };
}

// ─── Trajectory Branch ───────────────────────────────────────────────────────

function trajectoryBranch(cwd, opts = {}) {
  const { phase, slug, push } = opts;
  if (!phase || !slug) return { error: 'phase and slug are required' };
  const bn = `gsd/trajectory/${phase}-${slug}`;
  const wt = execGit(cwd, ['branch', '--list', 'worktree-*']);
  if (wt.exitCode === 0 && wt.stdout) {
    for (const wb of wt.stdout.split('\n').map(b => b.trim().replace(/^\*\s*/, '')).filter(Boolean))
      if (wb === bn || bn.startsWith(wb) || wb.startsWith(bn)) return { error: `Branch "${bn}" collides with worktree branch "${wb}"` };
  }
  if (execGit(cwd, ['rev-parse', '--verify', bn]).exitCode === 0) return { exists: true, branch: bn };
  const cr = execGit(cwd, ['checkout', '-b', bn]);
  if (cr.exitCode !== 0) return { error: 'Failed to create branch: ' + (cr.stderr || 'unknown') };
  if (push) {
    const pr = execGit(cwd, ['push', '-u', 'origin', bn]);
    return { created: true, branch: bn, pushed: pr.exitCode === 0, ...(pr.exitCode !== 0 ? { push_error: pr.stderr } : {}) };
  }
  return { created: true, branch: bn, pushed: false };
}

module.exports = { execGit, structuredLog, diffSummary, blame, branchInfo, selectiveRewind, trajectoryBranch };
