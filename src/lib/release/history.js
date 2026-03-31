'use strict';

const fs = require('fs');
const path = require('path');
const { execGit, structuredLog } = require('../git');
const { loadReleaseConfig, normalizeVersion } = require('./config');

const KNOWN_TYPES = new Set(['feat', 'fix', 'docs', 'chore', 'refactor', 'perf', 'test', 'build', 'ci', 'style', 'revert']);

function parseConventionalMessage(subject, body) {
  const match = String(subject || '').match(/^(\w+)(?:\(([^)]+)\))?(!)?:\s+(.+)$/);
  if (!match) return null;
  const type = match[1];
  return {
    type,
    scope: match[2] || null,
    breaking: match[3] === '!' || /BREAKING[ -]CHANGE:/i.test(String(body || '')),
    description: match[4],
    known: KNOWN_TYPES.has(type),
  };
}

function getCommitBody(cwd, hash) {
  const result = execGit(cwd, ['show', '-s', '--format=%B', hash]);
  return result.exitCode === 0 ? result.stdout : '';
}

function getLatestTag(cwd) {
  const result = execGit(cwd, ['describe', '--tags', '--abbrev=0']);
  if (result.exitCode !== 0 || !result.stdout) return null;
  return result.stdout.trim();
}

function getCommitCount(cwd, latestTag) {
  const range = latestTag ? `${latestTag}..HEAD` : 'HEAD';
  const result = execGit(cwd, ['rev-list', '--count', range]);
  const parsed = Number.parseInt(result.stdout, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readPackageVersion(cwd) {
  const packagePath = path.join(cwd, 'package.json');
  if (!fs.existsSync(packagePath)) return null;
  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
    return normalizeVersion(pkg.version, null);
  } catch {
    return null;
  }
}

function extractVersionFromTag(tag) {
  if (!tag) return null;
  return normalizeVersion(tag, null);
}

function parseSummaryFile(cwd, relativePath) {
  const fullPath = path.join(cwd, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  const text = fs.readFileSync(fullPath, 'utf-8');
  const oneLiner = text.match(/^one-liner:\s*"?(.+?)"?$/m)?.[1] || null;
  const title = text.match(/^#\s+(.+)$/m)?.[1] || null;
  return {
    path: relativePath,
    one_liner: oneLiner,
    title,
  };
}

function collectSummaryFiles(cwd, commits) {
  const seen = new Set();
  const summaries = [];
  for (const commit of commits) {
    for (const file of commit.files || []) {
      if (!/-SUMMARY\.md$/.test(file.path) || seen.has(file.path)) continue;
      seen.add(file.path);
      const parsed = parseSummaryFile(cwd, file.path);
      if (parsed) summaries.push(parsed);
    }
  }
  return summaries;
}

function summarizeCommits(commits) {
  const summary = {
    total: commits.length,
    conventional: 0,
    non_conventional: 0,
    unknown_conventional: 0,
    breaking: 0,
    feat: 0,
    fix: 0,
    docs: 0,
    chore: 0,
    other: 0,
  };

  for (const commit of commits) {
    if (commit.conventional) {
      summary.conventional += 1;
      if (!commit.conventional.known) summary.unknown_conventional += 1;
      if (commit.conventional.breaking) summary.breaking += 1;
      if (commit.conventional.type === 'feat') summary.feat += 1;
      else if (commit.conventional.type === 'fix') summary.fix += 1;
      else if (commit.conventional.type === 'docs') summary.docs += 1;
      else if (commit.conventional.type === 'chore') summary.chore += 1;
      else summary.other += 1;
    } else {
      summary.non_conventional += 1;
    }
  }

  return summary;
}

function detectAmbiguity(history, config) {
  const reasons = [];
  const summary = history.summary;
  const ratio = summary.total > 0 ? summary.conventional / summary.total : 0;

  if (!history.latest_tag) reasons.push('No prior tag found; using package version as release baseline.');
  if (summary.total === 0) reasons.push('No commits found since the release baseline.');
  if (summary.total > 0 && summary.conventional === 0) {
    reasons.push('No conventional commits found in release history.');
  } else if (summary.total > 0 && ratio < config.ambiguity_ratio_threshold) {
    reasons.push(`Mostly non-conventional history (${summary.conventional}/${summary.total} commits follow conventional format).`);
  }
  if (summary.unknown_conventional > config.max_unknown_commits) {
    reasons.push(`History includes ${summary.unknown_conventional} unsupported conventional commit type(s).`);
  }

  return {
    ambiguous: reasons.length > 0,
    reasons,
    conventional_ratio: ratio,
  };
}

function loadReleaseHistory(cwd) {
  const config = loadReleaseConfig(cwd);
  const latestTag = getLatestTag(cwd);
  const commitCount = getCommitCount(cwd, latestTag);
  const rawCommits = commitCount > 0 ? structuredLog(cwd, { count: Math.max(commitCount, 1) }) : [];
  const commits = Array.isArray(rawCommits) ? rawCommits.slice(0, commitCount).map((commit) => {
    const body = getCommitBody(cwd, commit.hash);
    const conventional = parseConventionalMessage(commit.message, body);
    return {
      ...commit,
      body,
      short_hash: String(commit.hash || '').slice(0, 7),
      conventional,
    };
  }) : [];

  const currentVersion = extractVersionFromTag(latestTag) || readPackageVersion(cwd) || config.initial_version;
  const summaryFiles = collectSummaryFiles(cwd, commits);
  const summary = summarizeCommits(commits);
  const ambiguity = detectAmbiguity({ latest_tag: latestTag, commits, summary }, config);

  return {
    latest_tag: latestTag,
    current_version: currentVersion,
    commits,
    summary_files: summaryFiles,
    summary,
    ambiguity,
  };
}

module.exports = {
  KNOWN_TYPES,
  loadReleaseHistory,
  parseConventionalMessage,
};
