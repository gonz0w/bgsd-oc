'use strict';

module.exports = [
  {
    rule_id: 'js-sql-template-injection',
    title: 'Possible SQL template interpolation reaches a query sink',
    family: 'code-injection',
    category: 'injection',
    owasp: ['A03'],
    severity: 'BLOCKER',
    confidence: 0.93,
    rationale: 'Direct template interpolation inside a query call is a high-signal SQL injection pattern.',
    next_step: 'Use parameter binding or a query builder instead of string interpolation.',
    narrowness: 'Only flags direct template literals passed into common query sink APIs.',
    patterns: [
      /(?:query|execute|raw|prepare)\s*\(\s*`[^`$]*\$\{[^}]+\}[^`]*`/g,
    ],
  },
  {
    rule_id: 'js-eval-user-input',
    title: 'Possible code injection via eval-style execution',
    family: 'code-injection',
    category: 'injection',
    owasp: ['A03'],
    severity: 'BLOCKER',
    confidence: 0.9,
    rationale: 'eval/new Function style execution is high risk when fed dynamic input.',
    next_step: 'Remove dynamic code execution or replace it with an allowlisted interpreter.',
    narrowness: 'Only flags direct eval/new Function usage.',
    patterns: [
      /\beval\s*\(/g,
      /\bnew\s+Function\s*\(/g,
    ],
  },
];
