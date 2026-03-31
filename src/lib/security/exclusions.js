'use strict';

const fs = require('fs');
const path = require('path');
const { normalizeRepoPath } = require('../review/diff');

function normalizeSecurityPath(filePath, cwd) {
  const normalized = normalizeRepoPath(filePath);
  if (!cwd) return normalized;
  const absolute = path.isAbsolute(filePath) ? filePath : path.join(cwd, normalized);
  if (path.isAbsolute(absolute) && absolute.startsWith(cwd)) {
    return normalizeRepoPath(path.relative(cwd, absolute));
  }
  return normalized;
}

function isValidDate(value) {
  return !Number.isNaN(Date.parse(value));
}

function loadSecurityExclusions(cwd) {
  const filePath = path.join(cwd, '.planning', 'security-exclusions.json');
  if (!fs.existsSync(filePath)) {
    return { path: '.planning/security-exclusions.json', exists: false, version: null, entries: [], expired: [], errors: [] };
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    return {
      path: '.planning/security-exclusions.json',
      exists: true,
      version: null,
      entries: [],
      expired: [],
      errors: [`Invalid JSON: ${error.message}`],
    };
  }

  const entries = [];
  const expired = [];
  const errors = [];
  const version = typeof data.version === 'number' ? data.version : null;
  if (version !== null && version !== 1) errors.push(`Unsupported exclusions version: ${version}`);
  if (data && data.exclusions !== undefined && !Array.isArray(data.exclusions)) errors.push('exclusions must be an array');

  const today = new Date();
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
    if (!entry.expires_at || typeof entry.expires_at !== 'string' || entry.expires_at.trim() === '') {
      errors.push(`Entry ${index + 1}: expires_at is required`);
      return;
    }
    if (!isValidDate(entry.expires_at)) {
      errors.push(`Entry ${index + 1}: expires_at must be a valid date`);
      return;
    }
    const normalized = {
      rule_id: entry.rule_id,
      path: normalizeSecurityPath(entry.path, cwd),
      fingerprint: entry.fingerprint ? String(entry.fingerprint) : null,
      reason: entry.reason.trim(),
      expires_at: entry.expires_at,
    };
    if (new Date(entry.expires_at) < today) {
      expired.push(normalized);
      return;
    }
    entries.push(normalized);
  });

  return { path: '.planning/security-exclusions.json', exists: true, version, entries, expired, errors };
}

function matchesSecurityExclusion(finding, entry) {
  if (entry.rule_id !== finding.rule_id) return false;
  if (entry.path !== normalizeRepoPath(finding.path || '')) return false;
  const findingFingerprint = finding.fingerprint ? String(finding.fingerprint) : null;
  if (findingFingerprint || entry.fingerprint) {
    return findingFingerprint === (entry.fingerprint ? String(entry.fingerprint) : null);
  }
  return true;
}

function applySecurityExclusions(findings, exclusions, cwd) {
  const activeFindings = [];
  const suppressed = [];
  for (const finding of findings || []) {
    const normalizedFinding = {
      ...finding,
      path: normalizeSecurityPath(finding.path || '', cwd),
    };
    const match = (exclusions || []).find(entry => matchesSecurityExclusion(normalizedFinding, entry));
    if (match) {
      suppressed.push({
        rule_id: normalizedFinding.rule_id,
        path: normalizedFinding.path,
        fingerprint: normalizedFinding.fingerprint || null,
        reason: match.reason,
        suppressed_reason: 'security-exclusion',
      });
      continue;
    }
    activeFindings.push(normalizedFinding);
  }
  return { findings: activeFindings, suppressed };
}

module.exports = {
  applySecurityExclusions,
  loadSecurityExclusions,
  matchesSecurityExclusion,
  normalizeSecurityPath,
};
