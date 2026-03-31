'use strict';

const { SEVERITY } = require('../severity');

const TRUST_BOUNDARY_PATTERNS = [
  /\bexec\s*\(/,
  /\bspawn\s*\(/,
  /\bdangerouslySetInnerHTML\b/,
  /\bquery\s*\(\s*`[^`]*\$\{/,
  /child_process/,
];

function scan(context) {
  const findings = [];
  for (let index = 0; index < context.lines.length; index++) {
    const lineNumber = index + 1;
    if (!context.isChangedLine(lineNumber)) continue;
    const sourceLine = context.lines[index];
    if (!TRUST_BOUNDARY_PATTERNS.some(pattern => pattern.test(sourceLine))) continue;
    findings.push({
      rule_id: 'trust-boundary',
      line: lineNumber,
      category: 'security',
      severity: SEVERITY.WARNING,
      confidence: 0.9,
      message: 'Changed trust-boundary code needs explicit review before automation can treat it as safe.',
      theme: 'trust-boundary',
      suggested_fix: 'Confirm the boundary is validated or route this finding for manual review.',
      requires_judgment: true,
    });
  }
  return findings;
}

module.exports = {
  rule_id: 'trust-boundary',
  scan,
};
