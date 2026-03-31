'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { normalizeSecurityFinding } = require('../schema');

const MANIFEST_FILES = ['package.json', 'requirements.txt', 'go.mod'];

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function safeReadText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function normalizeVersionSpec(value) {
  return String(value || '').trim().replace(/^[=v]+/, '');
}

function inferEvidenceQuality(record) {
  if (record.lockfile && record.resolved_version) return 'resolved';
  const spec = normalizeVersionSpec(record.version_spec);
  if (!spec) return 'unknown';
  if (/^[0-9]+(?:\.[0-9A-Za-z-]+)*$/.test(spec)) return 'pinned';
  if (/^==\s*/.test(String(record.version_spec || ''))) return 'pinned';
  return 'range-only';
}

function scoreDependencyConfidence(record, advisory) {
  const quality = inferEvidenceQuality(record);
  const severity = String(advisory && advisory.severity || 'WARNING').toUpperCase();
  let score = 0.66;
  if (quality === 'resolved') score = 0.93;
  else if (quality === 'pinned') score = 0.84;
  else if (quality === 'range-only') score = 0.64;
  if (severity === 'BLOCKER') score += 0.02;
  return Math.max(0.5, Math.min(0.99, score));
}

function classifyVersionSource(record) {
  if (record.lockfile) return 'lockfile';
  if (inferEvidenceQuality(record) === 'pinned') return 'manifest-exact';
  if (inferEvidenceQuality(record) === 'range-only') return 'manifest-range';
  return 'manifest';
}

function parsePackageJson(cwd) {
  const packageJsonPath = path.join(cwd, 'package.json');
  const pkg = safeReadJson(packageJsonPath);
  if (!pkg) return [];
  const lockfile = safeReadJson(path.join(cwd, 'package-lock.json')) || safeReadJson(path.join(cwd, 'npm-shrinkwrap.json'));
  const resolvedVersions = new Map();
  if (lockfile && lockfile.packages && typeof lockfile.packages === 'object') {
    Object.entries(lockfile.packages).forEach(([pkgPath, meta]) => {
      if (!pkgPath || !meta || !meta.version) return;
      const segments = String(pkgPath).split('node_modules/');
      const packageName = segments[segments.length - 1];
      if (packageName) resolvedVersions.set(packageName, String(meta.version));
    });
  }

  const sections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
  const records = [];
  sections.forEach(section => {
    const deps = pkg[section] && typeof pkg[section] === 'object' ? pkg[section] : {};
    Object.entries(deps).forEach(([name, versionSpec]) => {
      const resolvedVersion = resolvedVersions.get(name) || null;
      records.push({
        ecosystem: 'npm',
        package_name: name,
        manifest: 'package.json',
        path: 'package.json',
        section,
        version_spec: String(versionSpec),
        resolved_version: resolvedVersion,
        line: 1,
        lockfile: resolvedVersion ? 'package-lock.json' : null,
      });
    });
  });
  return records;
}

function parseRequirements(cwd) {
  const filePath = path.join(cwd, 'requirements.txt');
  const content = safeReadText(filePath);
  if (!content) return [];
  return content.split(/\r?\n/).flatMap((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return [];
    const match = trimmed.match(/^([A-Za-z0-9_.-]+)\s*(==|>=|<=|~=|>|<)?\s*([^\s;]+)?/);
    if (!match) return [];
    const operator = match[2] || '';
    const version = match[3] || '';
    return [{
      ecosystem: 'PyPI',
      package_name: match[1],
      manifest: 'requirements.txt',
      path: 'requirements.txt',
      version_spec: `${operator}${version}`.trim(),
      resolved_version: operator === '==' ? version : null,
      line: index + 1,
      lockfile: null,
    }];
  });
}

function parseGoMod(cwd) {
  const filePath = path.join(cwd, 'go.mod');
  const content = safeReadText(filePath);
  if (!content) return [];
  return content.split(/\r?\n/).flatMap((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) return [];
    const match = trimmed.match(/^(?:require\s+)?([A-Za-z0-9./_-]+)\s+(v[^\s]+)$/);
    if (!match) return [];
    return [{
      ecosystem: 'Go',
      package_name: match[1],
      manifest: 'go.mod',
      path: 'go.mod',
      version_spec: match[2],
      resolved_version: match[2],
      line: index + 1,
      lockfile: null,
    }];
  });
}

function collectDependencyRecords(cwd) {
  return [
    ...parsePackageJson(cwd),
    ...parseRequirements(cwd),
    ...parseGoMod(cwd),
  ].map(record => ({
    ...record,
    evidence_quality: inferEvidenceQuality(record),
    version_source: classifyVersionSource(record),
  }));
}

function buildFixtureQueries(records) {
  const fixtureMap = new Map();
  records.forEach(record => {
    const key = `${record.ecosystem}:${record.package_name}`;
    if (!fixtureMap.has(key)) fixtureMap.set(key, []);
    fixtureMap.get(key).push(record);
  });
  return fixtureMap;
}

function advisoryMatchesRecord(advisory, record) {
  if (!advisory || advisory.package !== record.package_name) return false;
  const exactVersion = normalizeVersionSpec(record.resolved_version || record.version_spec);
  if (advisory.versions && Array.isArray(advisory.versions) && advisory.versions.length > 0) {
    return advisory.versions.includes(exactVersion);
  }
  if (advisory.range_substrings && Array.isArray(advisory.range_substrings)) {
    return advisory.range_substrings.some(fragment => String(record.version_spec || '').includes(fragment));
  }
  return true;
}

function loadFixtureAdvisories(records, config) {
  const fixturePath = config && config.advisory_fixture_path;
  if (!fixturePath) return [];
  const resolved = path.isAbsolute(fixturePath) ? fixturePath : path.join(process.cwd(), fixturePath);
  const data = safeReadJson(resolved);
  if (!data || !Array.isArray(data.advisories)) return [];
  const recordMap = buildFixtureQueries(records);
  return data.advisories.flatMap(advisory => {
    const key = `${advisory.ecosystem}:${advisory.package}`;
    const matches = recordMap.get(key) || [];
    return matches.filter(record => advisoryMatchesRecord(advisory, record)).map(record => ({ advisory, record }));
  });
}

function queryOsv(records, config) {
  if (config && config.advisory_fixture_path) return [];
  const queriable = records.filter(record => record.resolved_version);
  if (queriable.length === 0) return [];
  const url = (config && config.advisory_backend_url) || 'https://api.osv.dev/v1/querybatch';
  const script = [
    'const fs = require("fs");',
    'const input = JSON.parse(fs.readFileSync(0, "utf8"));',
    'fetch(input.url, {',
    '  method: "POST",',
    '  headers: { "content-type": "application/json" },',
    '  body: JSON.stringify({ queries: input.queries }),',
    '}).then(async (res) => {',
    '  if (!res.ok) throw new Error(`HTTP ${res.status}`);',
    '  process.stdout.write(await res.text());',
    '}).catch((err) => {',
    '  process.stderr.write(String(err.message || err));',
    '  process.exit(1);',
    '});',
  ].join(' ');

  try {
    const payload = JSON.stringify({
      url,
      queries: queriable.map(record => ({
        package: { ecosystem: record.ecosystem, name: record.package_name },
        version: normalizeVersionSpec(record.resolved_version),
      })),
    });
    const stdout = execFileSync(process.execPath, ['-e', script], {
      input: payload,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const data = JSON.parse(stdout || '{}');
    const results = Array.isArray(data.results) ? data.results : [];
    return results.flatMap((result, index) => {
      const record = queriable[index];
      const vulns = Array.isArray(result && result.vulns) ? result.vulns : [];
      return vulns.map(vuln => ({
        record,
        advisory: {
          id: vuln.id,
          summary: vuln.summary || vuln.details || 'Known vulnerable dependency version',
          severity: mapOsvSeverity(vuln),
          fixed_version: extractFixedVersion(vuln),
          references: Array.isArray(vuln.references) ? vuln.references.map(ref => ref.url).filter(Boolean) : [],
        },
      }));
    });
  } catch {
    return [];
  }
}

function mapOsvSeverity(vuln) {
  const severities = Array.isArray(vuln && vuln.severity) ? vuln.severity : [];
  const score = severities.map(entry => Number(String(entry.score || '').split('/')[0])).find(Number.isFinite);
  if (score >= 9) return 'BLOCKER';
  if (score >= 4) return 'WARNING';
  return 'INFO';
}

function extractFixedVersion(vuln) {
  const affected = Array.isArray(vuln && vuln.affected) ? vuln.affected : [];
  for (const item of affected) {
    const ranges = Array.isArray(item.ranges) ? item.ranges : [];
    for (const range of ranges) {
      const events = Array.isArray(range.events) ? range.events : [];
      const fixed = events.find(event => event.fixed);
      if (fixed && fixed.fixed) return fixed.fixed;
    }
  }
  return null;
}

function formatDependencyMessage(record, advisory) {
  const versionText = record.resolved_version || record.version_spec || 'unknown version';
  return `${record.package_name} (${versionText}) matches advisory ${advisory.id || advisory.summary || 'record'}`;
}

function formatDependencyNextStep(record, advisory) {
  const fixedVersion = advisory.fixed_version ? `Upgrade to ${advisory.fixed_version}` : 'Upgrade to a non-vulnerable release';
  if (record.evidence_quality === 'range-only') {
    return `${fixedVersion}, then confirm the resolved install from a lockfile or exact version because the manifest currently uses a loose range.`;
  }
  return `${fixedVersion} and regenerate the lockfile or deployment artifact so the fixed version is actually resolved.`;
}

function toDependencyFinding(record, advisory, config) {
  const confidence = scoreDependencyConfidence(record, advisory);
  const severity = advisory.severity || 'WARNING';
  return normalizeSecurityFinding({
    engine: 'dependencies',
    rule_id: `dependency-${String(record.package_name).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    title: `Dependency advisory for ${record.package_name}`,
    message: formatDependencyMessage(record, advisory),
    category: 'known-vulnerable-components',
    owasp: ['A06'],
    path: record.path,
    line: record.line || 1,
    severity,
    confidence,
    rationale: advisory.summary || 'Shared advisory backend reported a vulnerable dependency version.',
    next_step: formatDependencyNextStep(record, advisory),
    evidence: {
      kind: 'advisory',
      ecosystem: record.ecosystem,
      package_name: record.package_name,
      version_spec: record.version_spec,
      resolved_version: record.resolved_version,
      evidence_quality: record.evidence_quality,
      version_source: record.version_source,
      fixed_version: advisory.fixed_version || null,
      references: advisory.references || [],
    },
    verification: {
      independent_check: record.resolved_version
        ? `Confirm ${record.package_name}@${record.resolved_version} is still resolved in ${record.lockfile || record.manifest} and upgrade it.`
        : `Resolve the installed version for ${record.package_name} from a lockfile or deployment artifact before treating this as fully confirmed.`,
    },
  }, config);
}

function dedupeMatches(matches) {
  const seen = new Set();
  return matches.filter(match => {
    const key = `${match.record.ecosystem}:${match.record.package_name}:${match.record.path}:${match.advisory.id || match.advisory.summary}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function runDependencyEngine(cwd, target, config = {}) {
  const targetPath = target && target.path ? target.path : cwd;
  const isRepoRoot = path.resolve(targetPath) === path.resolve(cwd);
  if (!isRepoRoot) {
    return {
      engine: 'dependencies',
      findings: [],
      registry: MANIFEST_FILES,
      scanned_files: [],
    };
  }

  const records = collectDependencyRecords(cwd);
  const fixtureMatches = loadFixtureAdvisories(records, config);
  const osvMatches = queryOsv(records, config);
  const matches = dedupeMatches([...fixtureMatches, ...osvMatches]);
  const findings = matches.map(match => toDependencyFinding(match.record, match.advisory, config));

  return {
    engine: 'dependencies',
    findings,
    registry: MANIFEST_FILES,
    scanned_files: MANIFEST_FILES.filter(file => fs.existsSync(path.join(cwd, file))),
  };
}

module.exports = {
  MANIFEST_FILES,
  collectDependencyRecords,
  inferEvidenceQuality,
  runDependencyEngine,
  scoreDependencyConfidence,
};
