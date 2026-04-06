'use strict';

const fs = require('fs');
const path = require('path');
const { output, error, debugLog } = require('../../lib/output');
const { loadConfig, isGitIgnored } = require('../../lib/config');
const { execGit } = require('../../lib/git');
const { execJj, classifyPathScopedCommitFallback } = require('../../lib/jj');

function preCommitChecks(cwd, force) {
  if (force) return { passed: true, failures: [] };

  const failures = [];

  // 1. Shallow clone check
  const shallowResult = execGit(cwd, ['rev-parse', '--is-shallow-repository']);
  if (shallowResult.exitCode === 0 && shallowResult.stdout === 'true') {
    failures.push({
      check: 'shallow_clone',
      message: 'Shallow clone detected.',
      fix: 'git fetch --unshallow',
    });
  }

  // 2. Detached HEAD check
  const symbolicResult = execGit(cwd, ['symbolic-ref', '-q', 'HEAD']);
  if (symbolicResult.exitCode !== 0) {
    failures.push({
      check: 'detached_head',
      message: 'Detached HEAD.',
      fix: 'git checkout <branch>',
    });
  }

  // 3. Active rebase check
  let gitDir = cwd;
  try {
    const gitDirResult = execGit(cwd, ['rev-parse', '--git-dir']);
    if (gitDirResult.exitCode === 0) {
      gitDir = path.resolve(cwd, gitDirResult.stdout);
    }
  } catch (e) {
    debugLog('preCommitChecks', 'git-dir resolution failed', e);
  }
  if (fs.existsSync(path.join(gitDir, 'rebase-merge')) || fs.existsSync(path.join(gitDir, 'rebase-apply'))) {
    failures.push({
      check: 'active_rebase',
      message: 'Rebase in progress.',
      fix: 'git rebase --continue or git rebase --abort',
    });
  }

  // 4. Dirty working tree (files outside .planning/)
  const statusResult = execGit(cwd, ['status', '--porcelain']);
  if (statusResult.exitCode === 0 && statusResult.stdout) {
    const dirtyNonPlanning = statusResult.stdout.split('\n').filter(line => {
      if (!line.trim()) return false;
      // Porcelain format: XY PATH or XY PATH -> PATH (for renames)
      // execGit trims stdout, which can strip leading space from the first line's
      // status column (e.g., " M .planning/foo" becomes "M .planning/foo").
      // Use a regex to robustly extract the file path after status chars.
      const match = line.match(/^[A-Z? ]{1,2}\s+(.+)/);
      if (!match) return false;
      const filePath = match[1].trim();
      // Handle renamed files: "R  old -> new"
      const actualPath = filePath.includes(' -> ') ? filePath.split(' -> ')[1] : filePath;
      return !actualPath.startsWith('.planning/') && !actualPath.startsWith('.planning\\');
    });
    if (dirtyNonPlanning.length > 0) {
      failures.push({
        check: 'dirty_tree',
        message: `Dirty working tree (${dirtyNonPlanning.length} files).`,
        fix: 'git stash or commit changes first',
      });
    }
  }

  return { passed: failures.length === 0, failures };
}

function buildCommitMessage(message, agentType, tddPhase) {
  const trailers = [];
  if (agentType) {
    trailers.push(`Agent-Type: ${agentType}`);
  }
  if (tddPhase && ['red', 'green', 'refactor'].includes(tddPhase)) {
    trailers.push(`GSD-Phase: ${tddPhase}`);
  }

  return trailers.length > 0 ? `${message}\n\n${trailers.join('\n')}` : message;
}

function hasPathScopedChanges(cwd, files) {
  const statusResult = execGit(cwd, ['status', '--porcelain', '--untracked-files=all', '--', ...files]);
  return statusResult.exitCode === 0 && !!statusResult.stdout;
}

function runJjPathScopedCommit(cwd, message, filesToStage, agentType, tddPhase) {
  if (!hasPathScopedChanges(cwd, filesToStage)) {
    return { committed: false, hash: null, reason: 'nothing_to_commit' };
  }

  const commitResult = execJj(cwd, ['commit', '-m', buildCommitMessage(message, agentType, tddPhase), ...filesToStage]);
  if (commitResult.exitCode !== 0) {
    const stderr = commitResult.stderr || '';
    const stdout = commitResult.stdout || '';
    if (/nothing to commit|No changes selected|No changes/i.test(`${stdout}\n${stderr}`)) {
      return { committed: false, hash: null, reason: 'nothing_to_commit' };
    }
    return { committed: false, hash: null, reason: 'nothing_to_commit', error: stderr || stdout || 'JJ path-scoped commit failed' };
  }

  const hashResult = execGit(cwd, ['rev-parse', '--short', 'HEAD']);
  const hash = hashResult.exitCode === 0 ? hashResult.stdout : null;
  return {
    committed: true,
    hash,
    reason: 'committed',
    agent_type: agentType || null,
    tdd_phase: tddPhase || null,
    commit_path: 'jj_fallback',
  };
}

function cmdCommit(cwd, message, files, raw, amend, force, agentType, tddPhase) {
  if (!message && !amend) {
    error('commit message required');
  }

  const config = loadConfig(cwd);

  // Check commit_docs config
  if (!config.commit_docs) {
    const result = { committed: false, hash: null, reason: 'skipped_commit_docs_false' };
    output(result, raw, 'skipped');
    return;
  }

  // Check if .planning is gitignored
  if (isGitIgnored(cwd, '.planning')) {
    const result = { committed: false, hash: null, reason: 'skipped_gitignored' };
    output(result, raw, 'skipped');
    return;
  }

  // Pre-commit repo-state validation
  const filesToStage = files && files.length > 0 ? files : ['.planning/'];
  const checks = preCommitChecks(cwd, force);
  if (!checks.passed) {
    const fallback = classifyPathScopedCommitFallback(cwd, checks.failures, filesToStage);
    if (fallback.supported) {
      const result = runJjPathScopedCommit(cwd, message, filesToStage, agentType, tddPhase);
      if (result.committed) {
        output(result, raw, result.hash || 'committed');
        return;
      }
      output(result, raw, result.reason === 'nothing_to_commit' ? 'nothing' : 'blocked');
      return;
    }
    process.exitCode = 2;
    const result = { committed: false, hash: null, reason: 'pre_commit_blocked', failures: checks.failures };
    output(result, raw, 'blocked');
    return;
  }

  // Stage files
  for (const file of filesToStage) {
    execGit(cwd, ['add', file]);
  }

  // Commit
  const commitArgs = amend ? ['commit', '--amend', '--no-edit'] : ['commit', '-m', message];
  if (agentType) {
    commitArgs.push('--trailer', `Agent-Type: ${agentType}`);
  }
  if (tddPhase && ['red', 'green', 'refactor'].includes(tddPhase)) {
    commitArgs.push('--trailer', `GSD-Phase: ${tddPhase}`);
  }
  const commitResult = execGit(cwd, commitArgs);
  if (commitResult.exitCode !== 0) {
    if (commitResult.stdout.includes('nothing to commit') || commitResult.stderr.includes('nothing to commit')) {
      const result = { committed: false, hash: null, reason: 'nothing_to_commit' };
      output(result, raw, 'nothing');
      return;
    }
    const result = { committed: false, hash: null, reason: 'nothing_to_commit', error: commitResult.stderr };
    output(result, raw, 'nothing');
    return;
  }

  // Get short hash
  const hashResult = execGit(cwd, ['rev-parse', '--short', 'HEAD']);
  const hash = hashResult.exitCode === 0 ? hashResult.stdout : null;
  const result = { committed: true, hash, reason: 'committed', agent_type: agentType || null, tdd_phase: tddPhase || null };
  output(result, raw, hash || 'committed');
}

function cmdVerifySummary(cwd, summaryPath, checkFileCount, raw) {
  if (!summaryPath) {
    error('summary-path required');
  }

  const { cachedReadFile } = require('../../lib/helpers');

  const fullPath = path.join(cwd, summaryPath);
  const checkCount = checkFileCount || 2;

  // Check 1: Summary exists
  if (!fs.existsSync(fullPath)) {
    const result = {
      passed: false,
      checks: {
        summary_exists: false,
        files_created: { checked: 0, found: 0, missing: [] },
        commits_exist: false,
        self_check: 'not_found',
      },
      errors: ['SUMMARY.md not found'],
    };
    output(result, raw, 'failed');
    return;
  }

  const content = cachedReadFile(fullPath);
  const errors = [];

  // Check 2: Spot-check files mentioned in summary
  const mentionedFiles = new Set();
  // Pattern 1: Only match actual file paths (starting with ./ ../ or /) not command strings
  // Commands like `npm run test -- tests/foo.test.cjs` won't match because they don't start with ./ ../ or /
  const pathPattern = /`(\.\/[^`]+|\.\.\/[^`]+|\/[^`]+)`/g;
  // Pattern 2: Handle Created/Modified/Added/Updated/Edited: `path` format
  const createdPattern = /(?:Created|Modified|Added|Updated|Edited):\s*`([^`]+)`/gi;

  let m;
  while ((m = pathPattern.exec(content)) !== null) {
    const filePath = m[1];
    // Already validated by pattern - only paths starting with ./ ../ or / reach here
    if (filePath && !filePath.includes(' ') && !filePath.includes('|') && !filePath.includes('&')) {
      mentionedFiles.add(filePath);
    }
  }

  while ((m = createdPattern.exec(content)) !== null) {
    const filePath = m[1];
    if (filePath && !filePath.startsWith('http') && filePath.includes('/')) {
      mentionedFiles.add(filePath);
    }
  }

  const filesToCheck = Array.from(mentionedFiles).slice(0, checkCount);
  const missing = [];
  for (const file of filesToCheck) {
    if (!fs.existsSync(path.join(cwd, file))) {
      missing.push(file);
    }
  }

  // Check 3: Commits exist
  const commitHashPattern = /\b[0-9a-f]{7,40}\b/g;
  const hashes = content.match(commitHashPattern) || [];
  let commitsExist = false;
  if (hashes.length > 0) {
    for (const hash of hashes.slice(0, 3)) {
      const result = execGit(cwd, ['cat-file', '-t', hash]);
      if (result.exitCode === 0 && result.stdout === 'commit') {
        commitsExist = true;
        break;
      }
    }
  }

  // Check 4: Self-check section
  let selfCheck = 'not_found';
  const selfCheckPattern = /##\s*(?:Self[- ]?Check|Verification|Quality Check)/i;
  if (selfCheckPattern.test(content)) {
    const passPattern = /(?:all\s+)?(?:pass|✓|✅|complete|succeeded)/i;
    const failPattern = /(?:fail|✗|❌|incomplete|blocked)/i;
    const checkSection = content.slice(content.search(selfCheckPattern));
    if (failPattern.test(checkSection)) {
      selfCheck = 'failed';
    } else if (passPattern.test(checkSection)) {
      selfCheck = 'passed';
    }
  }

  if (missing.length > 0) errors.push('Missing files: ' + missing.join(', '));
  if (!commitsExist && hashes.length > 0) errors.push('Referenced commit hashes not found in git history');
  if (selfCheck === 'failed') errors.push('Self-check section indicates failure');

  const checks = {
    summary_exists: true,
    files_created: { checked: filesToCheck.length, found: filesToCheck.length - missing.length, missing },
    commits_exist: commitsExist,
    self_check: selfCheck,
  };

  const passed = missing.length === 0 && selfCheck !== 'failed';
  const result = { passed, checks, errors };
  output(result, raw, passed ? 'passed' : 'failed');
}

module.exports = {
  preCommitChecks,
  buildCommitMessage,
  hasPathScopedChanges,
  runJjPathScopedCommit,
  cmdCommit,
  cmdVerifySummary,
};
