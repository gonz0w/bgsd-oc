'use strict';

module.exports = [
  {
    rule_id: 'deserialization-unsafe-loader',
    title: 'Unsafe deserialization helper used on untrusted content',
    family: 'insecure-deserialization',
    category: 'insecure-deserialization',
    owasp: ['A08'],
    severity: 'BLOCKER',
    confidence: 0.9,
    rationale: 'Generic deserialize and unsafe loader APIs are high-signal indicators of insecure deserialization risk.',
    next_step: 'Use a safe parser with schema validation or restrict deserialization to trusted formats.',
    narrowness: 'Only flags direct unsafe loader APIs such as unserialize, deserialize, or yaml.load.',
    patterns: [
      /\bunserialize\s*\(/g,
      /\bdeserialize\s*\(/g,
      /\byaml\.load\s*\(/g,
      /\bjsYaml\.load\s*\(/g,
    ],
  },
];
