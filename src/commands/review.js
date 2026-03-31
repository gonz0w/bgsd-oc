'use strict';

const fs = require('fs');
const path = require('path');
const { output, error } = require('../lib/output');
const { loadReviewConfig } = require('../lib/review/config');
const { loadReviewExclusions, applyReviewExclusions } = require('../lib/review/exclusions');
const { buildReadinessReport, formatReadiness } = require('../lib/review/readiness');
const { routeReviewFindings } = require('../lib/review/routing');
const { scanReviewTarget } = require('../lib/review/scan');
const { SEVERITY, sortFindingsBySeverity } = require('../lib/review/severity');
const { resolveReviewTarget } = require('../lib/review/target');

function parseArgs(args) {
  const parsed = { base: null, head: null, range: null, findingsFile: null };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--base') parsed.base = args[++i] || null;
    else if (arg === '--head') parsed.head = args[++i] || null;
    else if (arg === '--range') parsed.range = args[++i] || null;
    else if (arg === '--findings-file') parsed.findingsFile = args[++i] || null;
  }
  return parsed;
}

function loadSeedFindings(cwd, findingsFile) {
  if (!findingsFile) return [];
  const resolved = path.isAbsolute(findingsFile) ? findingsFile : path.join(cwd, findingsFile);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
  } catch (err) {
    error(`Unable to read findings file: ${err.message}`);
  }
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.findings)) return data.findings;
  error('Findings file must be a JSON array or an object with a findings array');
}

function summarizeFindings(findings, suppressed, target) {
  const summary = { blocker: 0, warning: 0, info: 0, autofixed: 0, asks: 0, suppressed: suppressed.length, files: target.files.length, target_mode: target.mode };
  for (const finding of findings) {
    const severity = String(finding.severity || 'WARNING').toUpperCase();
    if (severity === 'BLOCKER') summary.blocker += 1;
    else if (severity === 'INFO') summary.info += 1;
    else summary.warning += 1;
    const route = String(finding.route || '').toUpperCase();
    if (route === 'AUTO-FIX') summary.autofixed += 1;
    if (route === 'ASK') summary.asks += 1;
  }
  return summary;
}

function formatFinding(finding) {
  const location = `${finding.path}:${finding.line || 1}`;
  return `- [${finding.route}] ${location} — ${finding.message}`;
}

function formatResult(result) {
  const lines = [`review:scan (${result.target.mode})`];
  if (result.target.status === 'needs-input') {
    lines.push(`- ${result.target.prompt}`);
    if (result.target.suggested_commit_range) lines.push(`- Suggested range: ${result.target.suggested_commit_range.range}`);
  } else {
    lines.push(`- Files: ${result.target.files.length}`);
  }
  for (const warning of result.warnings) lines.push(`- Warning: ${warning.message}`);
  if (result.exclusions.errors.length > 0) lines.push(`- Exclusions errors: ${result.exclusions.errors.join('; ')}`);
  if (result.findings.length === 0 && result.target.status === 'ok') {
    lines.push('- No findings in reviewed diff.');
    return lines.join('\n');
  }

  const bySeverity = new Map([
    [SEVERITY.BLOCKER, []],
    [SEVERITY.WARNING, []],
    [SEVERITY.INFO, []],
  ]);
  for (const finding of sortFindingsBySeverity(result.findings)) {
    bySeverity.get(String(finding.severity || SEVERITY.WARNING).toUpperCase())?.push(finding);
  }
  for (const [severity, findings] of bySeverity.entries()) {
    if (findings.length === 0) continue;
    lines.push(`\n${severity}`);
    for (const finding of findings) lines.push(formatFinding(finding));
  }
  if (result.fix_summaries.length > 0) {
    lines.push('\nAUTO-FIXED');
    for (const fix of result.fix_summaries) lines.push(`- ${fix.path}:${fix.line} — ${fix.summary}`);
  }
  if (result.ask_groups.length > 0) {
    lines.push('\nASK GROUPS');
    for (const group of result.ask_groups) {
      lines.push(`- ${group.theme}: ${group.findings.length} finding(s)`);
    }
  }
  return lines.join('\n');
}

function cmdReviewScan(cwd, args, raw) {
  const options = parseArgs(args);
  const config = loadReviewConfig(cwd);
  const target = resolveReviewTarget(cwd, options);
  const exclusions = loadReviewExclusions(cwd);
  const rawFindings = options.findingsFile ? loadSeedFindings(cwd, options.findingsFile) : scanReviewTarget(cwd, target);
  const filtered = applyReviewExclusions(rawFindings, exclusions.entries, cwd);
  const routed = routeReviewFindings(cwd, filtered.findings, config);
  const suppressed = [...filtered.suppressed, ...routed.suppressed];

  const result = {
    command: 'review:scan',
    status: target.status,
    target,
    warnings: target.warnings || [],
    findings: routed.findings,
    suppressed,
    ask_groups: routed.ask_groups,
    fix_summaries: routed.fix_summaries,
    summary: { ...summarizeFindings(routed.findings, suppressed, target), ...routed.summary },
    config: { confidence_threshold: config.confidence_threshold },
    exclusions: {
      path: config.exclusions_path,
      exists: exclusions.exists,
      version: exclusions.version,
      loaded: exclusions.entries.length,
      errors: exclusions.errors,
    },
  };

  output(result, { formatter: formatResult, rawValue: raw });
}

function cmdReviewReadiness(cwd, args, raw) {
  const result = buildReadinessReport(cwd, args || []);
  output(result, { formatter: formatReadiness, rawValue: raw });
}

module.exports = {
  cmdReviewScan,
  cmdReviewReadiness,
};
