'use strict';

const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function clamp(value, min, max, fallback) {
  const parsed = toNumber(value);
  if (parsed === null) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function toInteger(value, fallback) {
  const parsed = toNumber(value);
  if (parsed === null) return fallback;
  return Math.max(0, Math.floor(parsed));
}

function normalizeVersion(value, fallback = '0.1.0') {
  const normalized = String(value || '').trim().replace(/^v/, '');
  return /^\d+\.\d+\.\d+$/.test(normalized) ? normalized : fallback;
}

function loadReleaseConfig(cwd) {
  const configPath = path.join(cwd, '.planning', 'config.json');
  const raw = readJson(configPath) || {};
  const release = raw.release && typeof raw.release === 'object' ? raw.release : {};

  return {
    path: configPath,
    initial_version: normalizeVersion(release.initial_version ?? release.initialVersion, '0.1.0'),
    ambiguity_ratio_threshold: clamp(
      release.ambiguity_ratio_threshold ?? release.ambiguityRatioThreshold ?? release.conventional_ratio_threshold,
      0,
      1,
      0.6
    ),
    max_unknown_commits: toInteger(
      release.max_unknown_commits ?? release.maxUnknownCommits,
      1
    ),
    changelog_path: 'CHANGELOG.md',
    summary_root: path.join('.planning', 'phases'),
  };
}

module.exports = {
  loadReleaseConfig,
  normalizeVersion,
};
