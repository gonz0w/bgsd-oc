'use strict';

const { applyMechanicalFixes } = require('./fixes');
const { getSeveritySummary, sortFindingsBySeverity } = require('./severity');

function groupAskFindings(findings) {
  const groups = new Map();
  for (const finding of findings || []) {
    const theme = finding.theme || 'general';
    const existing = groups.get(theme) || [];
    existing.push(finding);
    groups.set(theme, existing);
  }
  return [...groups.entries()].map(([theme, themedFindings]) => ({ theme, findings: themedFindings }));
}

function annotate(findings, route, extra) {
  return (findings || []).map(finding => ({ ...finding, route, ...extra }));
}

function routeReviewFindings(cwd, findings, options = {}) {
  const threshold = typeof options.confidence_threshold === 'number' ? options.confidence_threshold : 0.8;
  const suppressed = [];
  const autoFixCandidates = [];
  const askCandidates = [];
  const infoCandidates = [];

  for (const finding of findings || []) {
    if ((finding.confidence ?? 1) < threshold) {
      suppressed.push({ ...finding, suppressed_reason: 'confidence-threshold' });
      continue;
    }
    if (finding.fix && finding.fix.mechanical) {
      autoFixCandidates.push(finding);
      continue;
    }
    if (finding.requires_judgment || finding.fix) {
      askCandidates.push(finding);
      continue;
    }
    infoCandidates.push(finding);
  }

  const appliedFixes = applyMechanicalFixes(cwd, autoFixCandidates);
  const routedAutoFixes = annotate(appliedFixes.applied, 'AUTO-FIX', { fix_applied: true });
  const downgradedAsks = annotate(appliedFixes.failed, 'ASK', { fix_applied: false, route_reason: 'mechanical-fix-degraded' });
  const routedAsks = annotate([...askCandidates, ...downgradedAsks], 'ASK');
  const routedInfos = annotate(infoCandidates, 'INFO');
  const routedFindings = sortFindingsBySeverity([...routedAutoFixes, ...routedAsks, ...routedInfos]);
  const severitySummary = getSeveritySummary(routedFindings);

  return {
    findings: routedFindings,
    ask_groups: groupAskFindings(routedAsks),
    fix_summaries: appliedFixes.summaries,
    suppressed,
    summary: {
      ...severitySummary,
      autofixed: routedAutoFixes.length,
      asks: routedAsks.length,
      suppressed: suppressed.length,
    },
  };
}

module.exports = {
  groupAskFindings,
  routeReviewFindings,
};
