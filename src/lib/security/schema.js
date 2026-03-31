'use strict';

const { normalizeRepoPath } = require('../review/diff');

const SECURITY_SEVERITY = {
  BLOCKER: 'BLOCKER',
  WARNING: 'WARNING',
  INFO: 'INFO',
};

const CONFIDENCE_BANDS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

const SEVERITY_ORDER = {
  [SECURITY_SEVERITY.BLOCKER]: 0,
  [SECURITY_SEVERITY.WARNING]: 1,
  [SECURITY_SEVERITY.INFO]: 2,
};

function normalizeSeverity(value, fallback = SECURITY_SEVERITY.WARNING) {
  const normalized = String(value || '').toUpperCase();
  return Object.prototype.hasOwnProperty.call(SEVERITY_ORDER, normalized) ? normalized : fallback;
}

function normalizeConfidence(value, fallback = 0.8) {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  if (numeric > 1) return Math.max(0, Math.min(1, numeric / 10));
  return Math.max(0, Math.min(1, numeric));
}

function inferConfidenceBand(confidence, explicitBand, thresholds = {}) {
  const normalizedExplicit = String(explicitBand || '').toLowerCase();
  if (normalizedExplicit === CONFIDENCE_BANDS.HIGH || normalizedExplicit === CONFIDENCE_BANDS.MEDIUM || normalizedExplicit === CONFIDENCE_BANDS.LOW) {
    return normalizedExplicit;
  }
  const highThreshold = typeof thresholds.confidence_threshold === 'number' ? thresholds.confidence_threshold : 0.8;
  const mediumThreshold = typeof thresholds.medium_confidence_threshold === 'number' ? thresholds.medium_confidence_threshold : 0.5;
  if (confidence >= highThreshold) return CONFIDENCE_BANDS.HIGH;
  if (confidence >= mediumThreshold) return CONFIDENCE_BANDS.MEDIUM;
  return CONFIDENCE_BANDS.LOW;
}

function normalizeSecurityFinding(input, options = {}) {
  const confidence = normalizeConfidence(input && input.confidence, options.confidence_threshold ?? 0.8);
  const confidenceBand = inferConfidenceBand(confidence, input && input.confidence_band, options);
  const path = normalizeRepoPath(input && input.path ? input.path : '');
  return {
    id: input && input.id ? String(input.id) : `${String(input && input.engine || 'security')}:${String(input && input.rule_id || 'unknown')}:${path}:${input && input.line ? input.line : 1}`,
    engine: String(input && input.engine || 'security'),
    rule_id: String(input && input.rule_id || 'security-unknown'),
    owasp: Array.isArray(input && input.owasp) ? input.owasp.map(String) : [],
    category: input && input.category ? String(input.category) : 'security',
    path,
    line: Number.isInteger(input && input.line) && input.line > 0 ? input.line : 1,
    severity: normalizeSeverity(input && input.severity),
    confidence,
    confidence_band: confidenceBand,
    title: String(input && input.title || input && input.message || 'Security finding'),
    message: String(input && input.message || input && input.title || 'Security finding'),
    rationale: String(input && input.rationale || input && input.message || 'Security finding detected.'),
    next_step: String(input && input.next_step || 'Review the finding and apply the recommended remediation.'),
    fingerprint: input && input.fingerprint ? String(input.fingerprint) : null,
    location: {
      path,
      line: Number.isInteger(input && input.line) && input.line > 0 ? input.line : 1,
      column: Number.isInteger(input && input.column) && input.column > 0 ? input.column : null,
    },
    evidence: input && typeof input.evidence === 'object' && input.evidence ? input.evidence : {},
    verification: input && typeof input.verification === 'object' && input.verification ? input.verification : {
      independent_check: 'Not provided',
    },
  };
}

function getFindingIdentity(finding) {
  return [
    String(finding.rule_id || ''),
    normalizeRepoPath(finding.path || ''),
    finding.fingerprint ? String(finding.fingerprint) : '',
  ].join('::');
}

function sortSecurityFindingsBySeverity(findings) {
  return [...(findings || [])].sort((left, right) => {
    const severityDiff = (SEVERITY_ORDER[normalizeSeverity(left.severity)] ?? 99) - (SEVERITY_ORDER[normalizeSeverity(right.severity)] ?? 99);
    if (severityDiff !== 0) return severityDiff;
    if ((left.path || '') !== (right.path || '')) return String(left.path || '').localeCompare(String(right.path || ''));
    return (left.line || 0) - (right.line || 0);
  });
}

function formatSecurityFinding(finding) {
  const owasp = Array.isArray(finding.owasp) && finding.owasp.length > 0 ? `[${finding.owasp.join(',')}] ` : '';
  const engine = finding.engine ? `${String(finding.engine).toUpperCase()} / ` : '';
  const category = finding.category ? `${finding.category}` : 'security';
  return `- ${owasp}[${finding.confidence_band.toUpperCase()} ${(finding.confidence * 10).toFixed(1)}/10] ${finding.path}:${finding.line} — ${engine}${category} — ${finding.message} | Why: ${finding.rationale} | Next: ${finding.next_step}`;
}

module.exports = {
  CONFIDENCE_BANDS,
  SECURITY_SEVERITY,
  formatSecurityFinding,
  getFindingIdentity,
  inferConfidenceBand,
  normalizeConfidence,
  normalizeSecurityFinding,
  normalizeSeverity,
  sortSecurityFindingsBySeverity,
};
