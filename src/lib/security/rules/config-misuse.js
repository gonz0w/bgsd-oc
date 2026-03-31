'use strict';

module.exports = [
  {
    rule_id: 'config-tls-verification-disabled',
    title: 'TLS verification disabled',
    family: 'security-misconfiguration',
    category: 'security-misconfiguration',
    owasp: ['A05'],
    severity: 'BLOCKER',
    confidence: 0.94,
    rationale: 'Disabling TLS verification removes transport trust checks and is a high-signal production risk.',
    next_step: 'Require certificate verification and scope any local bypass to non-production tooling only.',
    narrowness: 'Only flags explicit disablement patterns such as rejectUnauthorized:false or NODE_TLS_REJECT_UNAUTHORIZED=0.',
    patterns: [
      /rejectUnauthorized\s*:\s*false/g,
      /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0['"]?/g,
    ],
  },
  {
    rule_id: 'config-permissive-cors-wildcard',
    title: 'Permissive wildcard CORS configuration',
    family: 'security-misconfiguration',
    category: 'security-misconfiguration',
    owasp: ['A05'],
    severity: 'WARNING',
    confidence: 0.84,
    rationale: 'Wildcard cross-origin access is often broader than intended for authenticated flows.',
    next_step: 'Restrict allowed origins to an explicit allowlist.',
    narrowness: 'Only flags direct origin:* style configuration.',
    patterns: [
      /origin\s*:\s*['"]\*['"]/g,
    ],
  },
];
