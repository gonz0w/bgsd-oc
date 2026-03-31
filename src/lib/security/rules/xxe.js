'use strict';

module.exports = [
  {
    rule_id: 'xml-external-entity-enabled',
    title: 'XML parser enables external entity expansion',
    family: 'xxe',
    category: 'xml-external-entities',
    owasp: ['A05'],
    severity: 'BLOCKER',
    confidence: 0.91,
    rationale: 'Entity expansion and DTD loading options are high-signal XXE enablement patterns.',
    next_step: 'Disable external entity expansion and DTD processing in XML parser configuration.',
    narrowness: 'Only flags explicit entity-expansion parser options.',
    patterns: [
      /resolveEntities\s*:\s*true/g,
      /loadExternalDtd\s*:\s*true/g,
      /noent\s*:\s*true/g,
      /expandEntities\s*:\s*true/g,
    ],
  },
];
