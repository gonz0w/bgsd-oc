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

function normalizeThreshold(value, fallback) {
  const parsed = toNumber(value);
  if (parsed === null) return fallback;
  if (parsed > 1) return Math.max(0, Math.min(1, parsed / 10));
  return Math.max(0, Math.min(1, parsed));
}

function loadSecurityConfig(cwd) {
  const configPath = path.join(cwd, '.planning', 'config.json');
  const raw = readJson(configPath) || {};
  const security = raw.security && typeof raw.security === 'object' ? raw.security : {};

  return {
    path: configPath,
    cwd,
    confidence_threshold: normalizeThreshold(
      security.confidence_threshold ?? security.confidenceThreshold ?? security.threshold,
      0.8
    ),
    medium_confidence_threshold: normalizeThreshold(
      security.medium_confidence_threshold ?? security.mediumConfidenceThreshold ?? security.medium_threshold,
      0.5
    ),
    exclusions_path: path.join('.planning', 'security-exclusions.json'),
    advisory_backend_url: security.advisory_backend_url || security.advisoryBackendUrl || null,
    advisory_fixture_path: security.advisory_fixture_path || security.advisoryFixturePath || process.env.BGSD_SECURITY_ADVISORY_FIXTURES || null,
  };
}

module.exports = {
  loadSecurityConfig,
  normalizeThreshold,
};
