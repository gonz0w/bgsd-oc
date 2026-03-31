'use strict';

module.exports = [
  {
    rule_id: 'access-control-auth-bypass-flag',
    title: 'Explicit auth or authorization bypass flag present',
    family: 'access-control',
    category: 'broken-access-control',
    owasp: ['A01'],
    severity: 'BLOCKER',
    confidence: 0.9,
    rationale: 'Explicit bypass flags are a high-signal route to broken access control in production code.',
    next_step: 'Remove the bypass flag or gate it to isolated test-only fixtures.',
    narrowness: 'Only flags explicit allowAnonymous/skipAuthorization/bypassAuth style markers.',
    patterns: [
      /allowAnonymous\s*:\s*true/g,
      /skipAuthorization\s*:\s*true/g,
      /bypassAuth\s*:\s*true/g,
      /authorize\s*:\s*false/g,
    ],
  },
];
