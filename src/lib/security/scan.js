'use strict';

const fs = require('fs');
const path = require('path');
const { normalizeSecurityFinding } = require('./schema');
const { loadSecurityExclusions, applySecurityExclusions } = require('./exclusions');
const { runOwaspEngine } = require('./engines/owasp');
const { runSecretsEngine } = require('./engines/secrets');
const { runDependencyEngine } = require('./engines/dependencies');

function loadSeedFindings(cwd, findingsFile) {
  if (!findingsFile) return [];
  const resolved = path.isAbsolute(findingsFile) ? findingsFile : path.join(cwd, findingsFile);
  const data = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.findings)) return data.findings;
  return [];
}

function resolveSecurityTarget(cwd, explicitTarget) {
  const relative = explicitTarget ? String(explicitTarget) : '.';
  const absolute = path.resolve(cwd, relative);
  const displayPath = path.relative(cwd, absolute) || '.';
  return {
    mode: explicitTarget ? 'explicit' : 'repo-root',
    path: absolute,
    display_path: displayPath,
  };
}

function scanSecurity(cwd, options = {}, config = {}) {
  const target = resolveSecurityTarget(cwd, options.target);
  const seededFindings = loadSeedFindings(cwd, options.findingsFile);
  const engineRuns = options.findingsFile
    ? [{ engine: 'seed', findings: seededFindings.map(finding => normalizeSecurityFinding(finding, config)), registry: [] }]
    : [
      runOwaspEngine(cwd, target, config),
      runSecretsEngine(cwd, target, config),
      runDependencyEngine(cwd, target, config),
    ];
  const normalizedFindings = engineRuns.flatMap(run => run.findings).map(finding => normalizeSecurityFinding(finding, config));
  const exclusions = loadSecurityExclusions(cwd);
  const exclusionFiltered = applySecurityExclusions(normalizedFindings, exclusions.entries, cwd);
  const findings = [];
  const suppressed = [...exclusionFiltered.suppressed];
  const warnings = [];

  for (const finding of exclusionFiltered.findings) {
    if (finding.confidence_band === 'low') {
      suppressed.push({
        rule_id: finding.rule_id,
        path: finding.path,
        fingerprint: finding.fingerprint || null,
        suppressed_reason: 'confidence-band',
      });
      continue;
    }
    findings.push(finding);
  }

  for (const entry of exclusions.expired) {
    warnings.push({
      code: 'expired-exclusion',
      message: `Expired exclusion ${entry.rule_id} for ${entry.path} (${entry.expires_at}) is no longer applied.`,
      rule_id: entry.rule_id,
      path: entry.path,
      expires_at: entry.expires_at,
    });
  }

  return {
    target,
    findings,
    suppressed,
    warnings,
    engines: engineRuns.map(run => ({
      engine: run.engine,
      findings: run.findings.length,
      registry: run.registry || [],
      scanned_files: run.scanned_files || [],
    })),
    exclusions: {
      path: config.exclusions_path || '.planning/security-exclusions.json',
      exists: exclusions.exists,
      version: exclusions.version,
      loaded: exclusions.entries.length,
      expired: exclusions.expired.length,
      errors: exclusions.errors,
    },
  };
}

module.exports = {
  resolveSecurityTarget,
  scanSecurity,
};
