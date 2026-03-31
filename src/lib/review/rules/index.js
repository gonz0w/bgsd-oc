'use strict';

const fs = require('fs');
const path = require('path');

const unusedImportsRule = require('./js-unused-import');
const debugLeftoversRule = require('./debug-leftovers');
const trustBoundaryRule = require('./trust-boundary');

const RULES = [unusedImportsRule, debugLeftoversRule, trustBoundaryRule];

function shouldScanPath(filePath) {
  return /\.(?:[cm]?js|jsx|ts|tsx)$/i.test(filePath || '');
}

function createRuleContext(cwd, targetFile) {
  const filePath = path.join(cwd, targetFile.path);
  if (!fs.existsSync(filePath)) return null;
  const source = fs.readFileSync(filePath, 'utf-8');
  const lines = source.split('\n');
  const changedLines = new Set();
  for (const hunk of targetFile.hunks || []) {
    for (let line = hunk.start; line <= hunk.end; line++) changedLines.add(line);
  }
  return {
    cwd,
    file: targetFile,
    source,
    lines,
    changedLines,
    isChangedLine(line) {
      return changedLines.has(line);
    },
  };
}

function runReviewRules(cwd, target) {
  const findings = [];
  for (const file of target.files || []) {
    if (!shouldScanPath(file.path)) continue;
    const context = createRuleContext(cwd, file);
    if (!context) continue;
    for (const rule of RULES) {
      const emitted = rule.scan(context) || [];
      for (const finding of emitted) {
        findings.push({
          ...finding,
          rule_id: finding.rule_id || rule.rule_id,
          path: file.path,
        });
      }
    }
  }

  return findings.map((finding, index) => ({
    id: finding.id || `review-${String(index + 1).padStart(3, '0')}`,
    ...finding,
  }));
}

module.exports = {
  RULES,
  runReviewRules,
};
