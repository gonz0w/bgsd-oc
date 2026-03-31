'use strict';

const fs = require('fs');
const path = require('path');
const { loadReleaseHistory } = require('./history');
const { buildReleaseBump } = require('./bump');

const TYPE_LABELS = {
  feat: 'Features',
  fix: 'Fixes',
  docs: 'Documentation',
  chore: 'Chores',
  refactor: 'Refactors',
  perf: 'Performance',
  test: 'Tests',
  build: 'Build',
  ci: 'CI',
  style: 'Style',
  revert: 'Reverts',
  other: 'Other changes',
};

function baselineChangelog() {
  return [
    '# Changelog',
    '',
    'All notable changes to this project will be documented in this file.',
    '',
    '## Unreleased',
    '',
    '_No unreleased release notes drafted yet._',
    '',
  ].join('\n');
}

function groupCommitEntries(commits) {
  const groups = new Map();
  for (const commit of commits) {
    const type = commit.conventional?.type || 'other';
    const key = TYPE_LABELS[type] ? type : 'other';
    if (!groups.has(key)) groups.set(key, []);
    const description = commit.conventional?.description || commit.message;
    const prefix = commit.conventional?.breaking ? 'BREAKING: ' : '';
    groups.get(key).push({
      hash: commit.short_hash,
      text: `${prefix}${description}`,
    });
  }
  return [...groups.entries()].map(([type, entries]) => ({
    type,
    label: TYPE_LABELS[type],
    entries,
  }));
}

function buildDraftEntry(version, history) {
  const date = new Date().toISOString().slice(0, 10);
  const highlights = history.summary_files
    .map((entry) => entry.one_liner || entry.title)
    .filter(Boolean);
  const groups = groupCommitEntries(history.commits);

  const lines = [`## [${version}] - ${date}`, ''];
  if (highlights.length > 0) {
    lines.push('### Highlights', '');
    for (const item of highlights) lines.push(`- ${item}`);
    lines.push('');
  }

  for (const group of groups) {
    if (group.entries.length === 0) continue;
    lines.push(`### ${group.label}`, '');
    for (const entry of group.entries) {
      lines.push(`- ${entry.text} (${entry.hash})`);
    }
    lines.push('');
  }

  return {
    version,
    date,
    highlights,
    groups,
    markdown: lines.join('\n').trim() + '\n',
  };
}

function buildFilePreview(existingContent, entryMarkdown) {
  const source = existingContent && existingContent.trim() ? existingContent : baselineChangelog();
  const unreleasedMarker = '## Unreleased';
  if (!source.includes(unreleasedMarker)) {
    return `${baselineChangelog()}\n${entryMarkdown}`.trim() + '\n';
  }

  return source.replace(unreleasedMarker, `${unreleasedMarker}\n\n${entryMarkdown.trim()}\n`);
}

function buildReleaseChangelog(cwd, options = {}) {
  const bump = buildReleaseBump(cwd, options);
  const history = loadReleaseHistory(cwd);
  const changelogPath = path.join(cwd, 'CHANGELOG.md');
  const exists = fs.existsSync(changelogPath);
  const existingContent = exists ? fs.readFileSync(changelogPath, 'utf-8') : '';
  const draft = buildDraftEntry(bump.proposed_version, history);

  return {
    command: 'release:changelog',
    status: 'ok',
    advisory: true,
    dry_run: true,
    changelog_path: 'CHANGELOG.md',
    target_version: bump.proposed_version,
    latest_tag: history.latest_tag,
    baseline_created: !exists,
    summary_files: history.summary_files,
    groups: draft.groups,
    draft_markdown: draft.markdown,
    file_preview: buildFilePreview(existingContent, draft.markdown),
    ambiguity: bump.ambiguity,
  };
}

function formatReleaseChangelog(result) {
  const lines = [];
  lines.push('release:changelog (dry-run)');
  lines.push(`- Target version: ${result.target_version}`);
  if (result.latest_tag) lines.push(`- Last tag: ${result.latest_tag}`);
  lines.push(`- Summary notes: ${result.summary_files.length}`);
  lines.push(`- Commit groups: ${result.groups.map((group) => `${group.label} (${group.entries.length})`).join(', ') || 'none'}`);
  lines.push('');
  lines.push(result.draft_markdown.trim());
  return lines.join('\n');
}

module.exports = {
  baselineChangelog,
  buildReleaseChangelog,
  formatReleaseChangelog,
};
