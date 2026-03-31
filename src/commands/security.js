'use strict';

const { output } = require('../lib/output');
const { loadSecurityConfig } = require('../lib/security/config');
const { scanSecurity } = require('../lib/security/scan');
const { formatSecurityFinding, sortSecurityFindingsBySeverity } = require('../lib/security/schema');

function parseArgs(args) {
  const parsed = { target: null, findingsFile: null };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--target') parsed.target = args[++i] || null;
    else if (arg === '--findings-file') parsed.findingsFile = args[++i] || null;
  }
  return parsed;
}

function summarizeFindings(findings) {
  const summary = { blocker: 0, warning: 0, info: 0, total: 0 };
  for (const finding of findings || []) {
    if (finding.severity === 'BLOCKER') summary.blocker += 1;
    else if (finding.severity === 'INFO') summary.info += 1;
    else summary.warning += 1;
    summary.total += 1;
  }
  return summary;
}

function formatResult(result) {
  const lines = [`security:scan (${result.target.mode})`];
  lines.push(`- Target: ${result.target.display_path}`);
  lines.push(`- Confidence threshold: ${(result.config.confidence_threshold * 10).toFixed(1)}/10`);
  lines.push(`- Findings: ${result.summary.total} surfaced, ${result.summary.suppressed} suppressed`);
  for (const warning of result.warnings || []) lines.push(`- Warning: ${warning.message}`);
  if (result.findings.length === 0) {
    lines.push('- No security findings above the configured confidence gate.');
    return lines.join('\n');
  }
  let currentSeverity = null;
  for (const finding of sortSecurityFindingsBySeverity(result.findings)) {
    if (finding.severity !== currentSeverity) {
      currentSeverity = finding.severity;
      lines.push(`\n${currentSeverity}`);
    }
    lines.push(formatSecurityFinding(finding));
  }
  return lines.join('\n');
}

function cmdSecurityScan(cwd, args, raw) {
  const options = parseArgs(args);
  const config = loadSecurityConfig(cwd);
  const result = scanSecurity(cwd, options, config);
  const findings = sortSecurityFindingsBySeverity(result.findings);

  output({
    command: 'security:scan',
    status: 'ok',
    target: result.target,
    warnings: result.warnings,
    findings,
    suppressed: result.suppressed,
    summary: {
      ...summarizeFindings(findings),
      suppressed: result.suppressed.length,
      warnings: result.warnings.length,
    },
    config: {
      confidence_threshold: config.confidence_threshold,
      medium_confidence_threshold: config.medium_confidence_threshold,
      exclusions_path: config.exclusions_path,
    },
    engines: result.engines,
    exclusions: result.exclusions,
  }, { formatter: formatResult, rawValue: raw });
}

module.exports = {
  cmdSecurityScan,
  parseArgs,
};
