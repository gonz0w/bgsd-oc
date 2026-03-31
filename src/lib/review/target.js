'use strict';

const { execGit } = require('../git');
const { parseNameStatus, parseUnifiedDiff } = require('./diff');

function parseStatusEntries(stdout) {
  return String(stdout || '')
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const status = line.slice(0, 2);
      const rawPath = line.slice(3).trim();
      const renamed = rawPath.split(' -> ');
      return { status, path: (renamed[1] || renamed[0]).replace(/\\/g, '/').replace(/^\.\//, '') };
    });
}

function getSuggestedCommitRange(cwd) {
  const head = execGit(cwd, ['rev-parse', 'HEAD']);
  if (head.exitCode !== 0 || !head.stdout) return { base: 'HEAD~1', head: 'HEAD', range: 'HEAD~1...HEAD' };
  const parent = execGit(cwd, ['rev-parse', 'HEAD~1']);
  if (parent.exitCode !== 0 || !parent.stdout) return { base: `${head.stdout}^`, head: head.stdout, range: `${head.stdout}^...${head.stdout}` };
  return { base: parent.stdout, head: head.stdout, range: `${parent.stdout}...${head.stdout}` };
}

function hasNearbyPath(candidate, selectedSet) {
  const candidateParts = candidate.split('/');
  for (const selected of selectedSet) {
    const selectedParts = selected.split('/');
    const sameDir = candidateParts.slice(0, -1).join('/') === selectedParts.slice(0, -1).join('/');
    const sameTopLevel = candidateParts[0] && candidateParts[0] === selectedParts[0];
    if (sameDir || sameTopLevel) return true;
  }
  return false;
}

function buildIncompleteScopeWarnings(statusEntries, selectedFiles) {
  const selectedSet = new Set((selectedFiles || []).map(file => file.path));
  const nearbyUnstaged = statusEntries
    .filter(entry => entry.status[1] !== ' ' && entry.status[1] !== '?' && hasNearbyPath(entry.path, selectedSet))
    .map(entry => entry.path);
  const nearbyUntracked = statusEntries
    .filter(entry => entry.status === '??' && hasNearbyPath(entry.path, selectedSet))
    .map(entry => entry.path);
  if (nearbyUnstaged.length === 0 && nearbyUntracked.length === 0) return [];
  return [{
    code: 'incomplete-scope',
    message: 'Nearby unstaged or untracked changes may make this review scope incomplete.',
    nearby_unstaged: nearbyUnstaged,
    nearby_untracked: nearbyUntracked,
  }];
}

function resolveDiffTarget(cwd, mode, diffArgs, commandInfo) {
  const diffText = execGit(cwd, diffArgs);
  const nameStatusArgs = [...diffArgs.filter(arg => arg !== '--unified=3'), '--name-status', '--find-renames'];
  const nameStatus = execGit(cwd, nameStatusArgs);
  const files = parseUnifiedDiff(diffText.stdout, parseNameStatus(nameStatus.stdout));
  const warnings = buildIncompleteScopeWarnings(parseStatusEntries(execGit(cwd, ['status', '--porcelain']).stdout), files);
  return {
    mode,
    status: 'ok',
    selection_reason: mode === 'staged'
      ? 'Using the staged diff because staged changes are the default review target.'
      : 'Using the explicitly requested commit range.',
    git: { ...commandInfo, incomplete_scope_warning: warnings.length > 0 },
    files,
    warnings,
  };
}

function resolveReviewTarget(cwd, options = {}) {
  const range = options.range || (options.base && options.head ? `${options.base}...${options.head}` : null);
  if (range) {
    return resolveDiffTarget(
      cwd,
      'commit-range',
      ['diff', range, '--unified=3', '--no-color', '--find-renames'],
      { command: ['git', 'diff', range, '--unified=3', '--no-color', '--find-renames'], range }
    );
  }

  const stagedEntries = parseNameStatus(execGit(cwd, ['diff', '--cached', '--name-status', '--find-renames']).stdout);
  if (stagedEntries.length > 0) {
    return resolveDiffTarget(
      cwd,
      'staged',
      ['diff', '--cached', '--unified=3', '--no-color', '--find-renames'],
      { command: ['git', 'diff', '--cached', '--unified=3', '--no-color', '--find-renames'], base: 'HEAD' }
    );
  }

  const untracked = parseStatusEntries(execGit(cwd, ['status', '--porcelain']).stdout)
    .filter(entry => entry.status === '??')
    .map(entry => entry.path);
  return {
    mode: 'needs-input',
    status: 'needs-input',
    selection_reason: 'No staged changes were found, so review:scan returned a promptable fallback instead of broadening scope automatically.',
    git: { command: ['git', 'diff', '--cached', '--unified=3', '--no-color', '--find-renames'], base: 'HEAD' },
    files: [],
    warnings: [],
    prompt: 'No staged changes found. Choose an explicit review target instead of guessing.',
    suggested_mode: 'commit-range',
    suggested_commit_range: getSuggestedCommitRange(cwd),
    fallback: {
      preferred_mode: 'commit-range',
      alternatives: ['commit-range'],
    },
    untracked_decision: untracked.length > 0 ? {
      prompt: 'Untracked files are present. Decide explicitly whether to include them in the review target.',
      recommended: false,
      files: untracked,
    } : null,
  };
}

module.exports = {
  getSuggestedCommitRange,
  resolveReviewTarget,
};
