/**
 * Severity Classification System
 * 
 * BLOCKER: Prevents task completion, must fix before proceeding
 * WARNING: Should fix, but task can proceed
 * INFO: FYI, no action required
 */

const SEVERITY = {
  BLOCKER: 'BLOCKER',
  WARNING: 'WARNING',
  INFO: 'INFO'
};

/**
 * Classification rules for determining severity
 */
const CLASSIFICATION_RULES = [
  {
    pattern: /syntax error|parse error|cannot import|cannot require/i,
    severity: SEVERITY.BLOCKER,
    reason: 'Code cannot run'
  },
  {
    pattern: /missing|undefined|null reference|cannot read property/i,
    severity: SEVERITY.BLOCKER,
    reason: 'Runtime error will occur'
  },
  {
    pattern: /security|vulnerability|injection|expose|credential/i,
    severity: SEVERITY.BLOCKER,
    reason: 'Security risk'
  },
  {
    pattern: /deprecated|obsolete|outdated/i,
    severity: SEVERITY.WARNING,
    reason: 'Will need updating soon'
  },
  {
    pattern: /unused|unreachable|dead code/i,
    severity: SEVERITY.WARNING,
    reason: 'Code smell'
  },
  {
    pattern: /complexity|nesting|cognitive/i,
    severity: SEVERITY.WARNING,
    reason: 'Maintainability concern'
  },
  {
    pattern: /note|tip|consider|suggestion/i,
    severity: SEVERITY.INFO,
    reason: 'Optional improvement'
  }
];

/**
 * Classify a finding's severity
 * @param {Object} finding - Finding to classify
 * @returns {string} Severity level
 */
function classifySeverity(finding) {
  const message = finding.message || '';
  
  for (const rule of CLASSIFICATION_RULES) {
    if (rule.pattern.test(message)) {
      return {
        severity: rule.severity,
        reason: rule.reason
      };
    }
  }
  
  // Default to WARNING if no rule matches
  return { severity: SEVERITY.WARNING, reason: 'No specific classification' };
}

/**
 * Create a finding with severity
 * @param {Object} options - Finding options
 * @returns {Object} Finding with severity
 */
function createFinding({ type, message, location, suggestion, autoClassify = true }) {
  const finding = {
    type,
    message,
    location,
    suggestion
  };
  
  if (autoClassify) {
    const classification = classifySeverity(finding);
    finding.severity = classification.severity;
    finding.classificationReason = classification.reason;
  } else {
    finding.severity = SEVERITY.INFO;
  }
  
  return finding;
}

/**
 * Filter findings by severity
 * @param {Array} findings - Array of findings
 * @param {string} minSeverity - Minimum severity to include
 * @returns {Array} Filtered findings
 */
function filterBySeverity(findings, minSeverity = SEVERITY.INFO) {
  const severityOrder = { BLOCKER: 0, WARNING: 1, INFO: 2 };
  const minLevel = severityOrder[minSeverity];
  
  return findings.filter(f => severityOrder[f.severity] <= minLevel);
}

/**
 * Get summary of findings by severity
 * @param {Array} findings - Array of findings
 * @returns {Object} Summary counts
 */
function getSeveritySummary(findings) {
  return {
    blocker: findings.filter(f => f.severity === SEVERITY.BLOCKER).length,
    warning: findings.filter(f => f.severity === SEVERITY.WARNING).length,
    info: findings.filter(f => f.severity === SEVERITY.INFO).length,
    total: findings.length
  };
}

/**
 * Check if findings prevent task completion
 * @param {Array} findings - Array of findings
 * @returns {boolean} True if any blocker prevents completion
 */
function blocksCompletion(findings) {
  return findings.some(f => f.severity === SEVERITY.BLOCKER);
}

module.exports = {
  SEVERITY,
};
