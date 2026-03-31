'use strict';

const { loadReleaseHistory } = require('./history');

function isSemver(value) {
  return /^\d+\.\d+\.\d+$/.test(String(value || '').trim().replace(/^v/, ''));
}

function normalizeOverride(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  if (['major', 'minor', 'patch'].includes(normalized)) {
    return { kind: 'bump', value: normalized };
  }
  const semver = normalized.replace(/^v/, '');
  if (isSemver(semver)) {
    return { kind: 'version', value: semver };
  }
  return null;
}

function incrementVersion(version, bump) {
  const [major, minor, patch] = String(version).split('.').map((part) => Number.parseInt(part, 10) || 0);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function deriveAutomaticBump(history) {
  if (history.ambiguity.ambiguous) {
    return {
      bump: 'patch',
      next_version: incrementVersion(history.current_version, 'patch'),
      source: 'conservative-fallback',
      reason: history.ambiguity.reasons.join(' '),
    };
  }

  if (history.summary.breaking > 0) {
    return {
      bump: 'major',
      next_version: incrementVersion(history.current_version, 'major'),
      source: 'conventional-commits',
      reason: 'Breaking conventional commits detected since the last tag.',
    };
  }

  if (history.summary.feat > 0) {
    return {
      bump: 'minor',
      next_version: incrementVersion(history.current_version, 'minor'),
      source: 'conventional-commits',
      reason: 'Feature commits detected since the last tag.',
    };
  }

  return {
    bump: 'patch',
    next_version: incrementVersion(history.current_version, 'patch'),
    source: 'conventional-commits',
    reason: 'Only patch-level conventional commits were detected since the last tag.',
  };
}

function buildReleaseBump(cwd, options = {}) {
  const history = loadReleaseHistory(cwd);
  const override = normalizeOverride(options.override || options.version || null);
  const automatic = deriveAutomaticBump(history);

  let recommendation = automatic;
  let overrideInfo = null;
  if (override) {
    recommendation = override.kind === 'version'
      ? {
        bump: 'manual',
        next_version: override.value,
        source: 'manual-override',
        reason: `Manual version override selected: ${override.value}.`,
      }
      : {
        bump: override.value,
        next_version: incrementVersion(history.current_version, override.value),
        source: 'manual-override',
        reason: `Manual bump override selected: ${override.value}.`,
      };
    overrideInfo = {
      input: options.override || options.version,
      kind: override.kind,
      applied: true,
    };
  }

  return {
    command: 'release:bump',
    status: 'ok',
    advisory: true,
    dry_run: true,
    current_version: history.current_version,
    latest_tag: history.latest_tag,
    proposed_bump: recommendation.bump,
    proposed_version: recommendation.next_version,
    source: recommendation.source,
    reason: recommendation.reason,
    ambiguity: {
      ...history.ambiguity,
      fallback_bump: history.ambiguity.ambiguous ? 'patch' : null,
    },
    override: overrideInfo,
    commits_analyzed: history.summary.total,
    summary: history.summary,
  };
}

function formatReleaseBump(result) {
  const lines = [];
  lines.push('release:bump (dry-run)');
  lines.push(`- Current version: ${result.current_version}`);
  lines.push(`- Proposed version: ${result.proposed_version}`);
  lines.push(`- Proposed bump: ${result.proposed_bump}`);
  lines.push(`- Source: ${result.source}`);
  if (result.latest_tag) lines.push(`- Last tag: ${result.latest_tag}`);
  if (result.ambiguity.ambiguous) {
    lines.push(`- Ambiguity: yes (${result.ambiguity.fallback_bump} fallback)`);
    for (const reason of result.ambiguity.reasons) lines.push(`  - ${reason}`);
  } else {
    lines.push('- Ambiguity: none');
  }
  lines.push(`- Reason: ${result.reason}`);
  return lines.join('\n');
}

module.exports = {
  buildReleaseBump,
  formatReleaseBump,
  incrementVersion,
  normalizeOverride,
};
