'use strict';

const fs = require('fs');
const path = require('path');
const { normalizeRepoPath } = require('./diff');

function normalizeReviewPath(filePath, cwd) {
  const normalized = normalizeRepoPath(filePath);
  if (!cwd) return normalized;
  const absolute = path.isAbsolute(filePath) ? filePath : path.join(cwd, normalized);
  if (path.isAbsolute(absolute) && absolute.startsWith(cwd)) {
    return normalizeRepoPath(path.relative(cwd, absolute));
  }
  return normalized;
}

function loadReviewExclusions(cwd) {
  const filePath = path.join(cwd, '.planning', 'review-exclusions.json');
  if (!fs.existsSync(filePath)) {
    return { path: '.planning/review-exclusions.json', exists: false, version: null, entries: [], errors: [] };
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    return {
      path: '.planning/review-exclusions.json',
      exists: true,
      version: null,
      entries: [],
      errors: [`Invalid JSON: ${error.message}`],
    };
  }

  const entries = [];
  const errors = [];
  const version = typeof data.version === 'number' ? data.version : null;
  if (version !== null && version !== 1) {
    errors.push(`Unsupported exclusions version: ${version}`);
  }
  if (data && data.exclusions !== undefined && !Array.isArray(data.exclusions)) {
    errors.push('exclusions must be an array');
  }
  const rawEntries = Array.isArray(data && data.exclusions) ? data.exclusions : [];
  rawEntries.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      errors.push(`Entry ${index + 1}: exclusion must be an object`);
      return;
    }
    if (!entry.rule_id || typeof entry.rule_id !== 'string') {
      errors.push(`Entry ${index + 1}: rule_id is required`);
      return;
    }
    if (!entry.path || typeof entry.path !== 'string') {
      errors.push(`Entry ${index + 1}: path is required`);
      return;
    }
    if (!entry.reason || typeof entry.reason !== 'string' || entry.reason.trim() === '') {
      errors.push(`Entry ${index + 1}: reason is required`);
      return;
    }
    entries.push({
      rule_id: entry.rule_id,
      path: normalizeReviewPath(entry.path, cwd),
      reason: entry.reason.trim(),
    });
  });

  return { path: '.planning/review-exclusions.json', exists: true, version, entries, errors };
}

function applyReviewExclusions(findings, exclusions, cwd) {
  const activeFindings = [];
  const suppressed = [];
  for (const finding of findings || []) {
    const normalizedPath = normalizeReviewPath(finding.path || '', cwd);
    const match = (exclusions || []).find(entry => entry.rule_id === finding.rule_id && entry.path === normalizedPath);
    if (match) {
      suppressed.push({ rule_id: finding.rule_id, path: normalizedPath, reason: match.reason });
      continue;
    }
    activeFindings.push({ ...finding, path: normalizedPath });
  }
  return { findings: activeFindings, suppressed };
}

module.exports = {
  applyReviewExclusions,
  loadReviewExclusions,
  normalizeReviewPath,
};
