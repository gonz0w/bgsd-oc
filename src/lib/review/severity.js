const SEVERITY = {
  BLOCKER: 'BLOCKER',
  WARNING: 'WARNING',
  INFO: 'INFO'
};
const SEVERITY_ORDER = {
  [SEVERITY.BLOCKER]: 0,
  [SEVERITY.WARNING]: 1,
  [SEVERITY.INFO]: 2,
};

function normalizeSeverity(value, fallback = SEVERITY.WARNING) {
  const normalized = String(value || '').toUpperCase();
  return Object.prototype.hasOwnProperty.call(SEVERITY_ORDER, normalized) ? normalized : fallback;
}

function compareSeverity(left, right) {
  return (SEVERITY_ORDER[normalizeSeverity(left)] ?? 99) - (SEVERITY_ORDER[normalizeSeverity(right)] ?? 99);
}

function sortFindingsBySeverity(findings) {
  return [...(findings || [])].sort((left, right) => {
    const severityDiff = compareSeverity(left.severity, right.severity);
    if (severityDiff !== 0) return severityDiff;
    if ((left.path || '') !== (right.path || '')) return String(left.path || '').localeCompare(String(right.path || ''));
    return (left.line || 0) - (right.line || 0);
  });
}

function getSeveritySummary(findings) {
  const summary = { blocker: 0, warning: 0, info: 0, total: 0 };
  for (const finding of findings || []) {
    const severity = normalizeSeverity(finding.severity);
    if (severity === SEVERITY.BLOCKER) summary.blocker += 1;
    else if (severity === SEVERITY.INFO) summary.info += 1;
    else summary.warning += 1;
    summary.total += 1;
  }
  return summary;
}

function blocksCompletion(findings) {
  return (findings || []).some(finding => normalizeSeverity(finding.severity) === SEVERITY.BLOCKER);
}

module.exports = {
  SEVERITY,
  SEVERITY_ORDER,
  compareSeverity,
  normalizeSeverity,
  sortFindingsBySeverity,
  getSeveritySummary,
  blocksCompletion,
};
