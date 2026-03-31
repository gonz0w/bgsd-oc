'use strict';

const { SEVERITY } = require('../severity');

const DEBUG_PATTERNS = [
  { regex: /\bconsole\.(?:log|debug)\s*\(/, label: 'debug logging' },
  { regex: /\bdebugger\b/, label: 'debugger statement' },
];

function scan(context) {
  const findings = [];
  for (let index = 0; index < context.lines.length; index++) {
    const lineNumber = index + 1;
    if (!context.isChangedLine(lineNumber)) continue;
    const sourceLine = context.lines[index];
    const matched = DEBUG_PATTERNS.find(entry => entry.regex.test(sourceLine));
    if (!matched) continue;
    findings.push({
      rule_id: 'debug-leftovers',
      line: lineNumber,
      category: 'maintainability',
      severity: SEVERITY.WARNING,
      confidence: 0.98,
      message: `Changed ${matched.label} should be removed before review completes.`,
      theme: 'debug-cleanup',
      suggested_fix: 'Remove the debug-only statement from the diff.',
      fix: {
        kind: 'line-delete',
        line: lineNumber,
        expected: sourceLine,
        replacement: '',
        mechanical: true,
        summary: `Remove ${matched.label}`,
      },
    });
  }
  return findings;
}

module.exports = {
  rule_id: 'debug-leftovers',
  scan,
};
