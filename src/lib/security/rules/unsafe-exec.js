'use strict';

module.exports = [
  {
    rule_id: 'js-unsafe-child-process-interpolation',
    title: 'Possible shell injection through child_process execution',
    family: 'unsafe-exec',
    category: 'injection',
    owasp: ['A03'],
    severity: 'BLOCKER',
    confidence: 0.92,
    rationale: 'Interpolated or concatenated shell commands passed to exec are a direct injection sink.',
    next_step: 'Use execFile/spawn argument arrays and validate untrusted values before execution.',
    narrowness: 'Only flags exec-style calls with template literals, concatenation, or shell:true.',
    patterns: [
      /\bexec(?:Sync)?\s*\(\s*`[^`$]*\$\{[^}]+\}[^`]*`/g,
      /\bexec(?:Sync)?\s*\([^\n;]*\+[^\n;]*/g,
      /\bspawn\s*\([^\n;]*\{[^}]*shell\s*:\s*true/gs,
    ],
  },
];
