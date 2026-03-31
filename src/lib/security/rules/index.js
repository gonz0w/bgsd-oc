'use strict';

const jsInjectionRules = require('./js-injection');
const unsafeExecRules = require('./unsafe-exec');
const authMisconfigRules = require('./auth-misconfig');
const configMisuseRules = require('./config-misuse');
const xssRules = require('./xss');
const xxeRules = require('./xxe');
const accessControlRules = require('./access-control');
const insecureDeserializationRules = require('./insecure-deserialization');
const loggingGapRules = require('./logging-gaps');

const OWASP_CATEGORY_METADATA = [
  {
    category: 'injection',
    owasp: ['A03'],
    coverage: 'direct-rule',
    note: 'Curated query, eval, and shell-injection sinks only.',
  },
  {
    category: 'broken-authentication',
    owasp: ['A07'],
    coverage: 'direct-rule',
    note: 'High-signal auth misuse such as jwt.decode without verify.',
  },
  {
    category: 'sensitive-data-exposure',
    owasp: ['A02'],
    coverage: 'direct-rule',
    note: 'Narrow cryptographic misuse coverage via weak-hash detection.',
  },
  {
    category: 'xml-external-entities',
    owasp: ['A05'],
    coverage: 'direct-rule',
    note: 'Only explicit XXE-enabling parser options are reported.',
  },
  {
    category: 'broken-access-control',
    owasp: ['A01'],
    coverage: 'direct-rule',
    note: 'Only explicit authorization bypass markers are reported in v1.',
  },
  {
    category: 'security-misconfiguration',
    owasp: ['A05'],
    coverage: 'direct-rule',
    note: 'Covers explicit TLS disablement and wildcard CORS misconfigurations.',
  },
  {
    category: 'cross-site-scripting',
    owasp: ['A03'],
    coverage: 'direct-rule',
    note: 'Only direct raw HTML sinks are reported.',
  },
  {
    category: 'insecure-deserialization',
    owasp: ['A08'],
    coverage: 'direct-rule',
    note: 'Only explicit unsafe loader APIs are reported.',
  },
  {
    category: 'known-vulnerable-components',
    owasp: ['A06'],
    coverage: 'delegated-family',
    engine: 'dependencies',
    note: 'Phase 147 plan 02 ships the OWASP registry mapping; dependency findings land in plan 03.',
  },
  {
    category: 'insufficient-logging-monitoring',
    owasp: ['A09'],
    coverage: 'direct-rule',
    note: 'Only explicit silent catch blocks are reported to keep v1 high-signal.',
  },
];

const OWASP_RULES = [
  ...jsInjectionRules,
  ...unsafeExecRules,
  ...authMisconfigRules,
  ...configMisuseRules,
  ...xssRules,
  ...xxeRules,
  ...accessControlRules,
  ...insecureDeserializationRules,
  ...loggingGapRules,
];

function getOwaspRegistry() {
  return {
    rules: OWASP_RULES.map(rule => ({ ...rule })),
    coverage: OWASP_CATEGORY_METADATA.map(entry => ({ ...entry })),
  };
}

function getOwaspCoverageSummary() {
  return OWASP_CATEGORY_METADATA.map(entry => ({
    ...entry,
    implemented_by: OWASP_RULES.filter(rule => rule.category === entry.category).map(rule => rule.rule_id),
  }));
}

module.exports = {
  OWASP_RULES,
  OWASP_CATEGORY_METADATA,
  getOwaspCoverageSummary,
  getOwaspRegistry,
};
