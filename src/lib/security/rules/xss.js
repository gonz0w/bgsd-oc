'use strict';

module.exports = [
  {
    rule_id: 'xss-dangerously-set-inner-html',
    title: 'Raw HTML sink used without sanitization guard',
    family: 'xss',
    category: 'cross-site-scripting',
    owasp: ['A03'],
    severity: 'WARNING',
    confidence: 0.88,
    rationale: 'Direct HTML sinks like innerHTML and dangerouslySetInnerHTML are explicit XSS risk points.',
    next_step: 'Prefer safe text rendering or sanitize the HTML before assigning it to a raw sink.',
    narrowness: 'Only flags direct raw HTML sink APIs.',
    patterns: [
      /dangerouslySetInnerHTML/g,
      /\.innerHTML\s*=/g,
      /document\.write\s*\(/g,
    ],
  },
];
