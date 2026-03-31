'use strict';

module.exports = [
  {
    rule_id: 'auth-jwt-decode-without-verify',
    title: 'JWT payload decoded without signature verification',
    family: 'auth-misconfig',
    category: 'broken-authentication',
    owasp: ['A07'],
    severity: 'BLOCKER',
    confidence: 0.89,
    rationale: 'jwt.decode reads attacker-controlled claims without proving token integrity.',
    next_step: 'Use signature verification before trusting token claims.',
    narrowness: 'Only flags direct jwt.decode usage.',
    patterns: [
      /\bjwt\.decode\s*\(/g,
    ],
  },
  {
    rule_id: 'crypto-weak-hash-algorithm',
    title: 'Weak hash algorithm used for security-sensitive code',
    family: 'crypto-misuse',
    category: 'sensitive-data-exposure',
    owasp: ['A02'],
    severity: 'WARNING',
    confidence: 0.86,
    rationale: 'MD5 and SHA-1 are weak choices for password or integrity-sensitive security flows.',
    next_step: 'Replace weak hashing with a modern password or integrity primitive appropriate to the use case.',
    narrowness: 'Only flags direct createHash calls using md5 or sha1.',
    patterns: [
      /createHash\s*\(\s*['"](?:md5|sha1)['"]\s*\)/g,
    ],
  },
];
