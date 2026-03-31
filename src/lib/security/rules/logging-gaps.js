'use strict';

module.exports = [
  {
    rule_id: 'logging-empty-catch-block',
    title: 'Catch block suppresses failure without logging or rethrowing',
    family: 'logging-monitoring',
    category: 'insufficient-logging-monitoring',
    owasp: ['A09'],
    severity: 'WARNING',
    confidence: 0.83,
    rationale: 'Silent failure handling creates explicit monitoring blind spots during security incidents.',
    next_step: 'Log or rethrow the error with enough context for investigation.',
    narrowness: 'Only flags empty catch blocks or catch blocks that return/continue without any logging or throw.',
    patterns: [
      /catch\s*\([^)]*\)\s*\{\s*\}/g,
      /catch\s*\([^)]*\)\s*\{\s*(?:return\s+[^;]+;|continue;|break;)\s*\}/g,
    ],
  },
];
