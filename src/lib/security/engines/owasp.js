'use strict';

const fs = require('fs');
const path = require('path');
const { normalizeSecurityFinding } = require('../schema');
const { OWASP_RULES, getOwaspCoverageSummary } = require('../rules');

const DEFAULT_EXTENSIONS = new Set(['.js', '.cjs', '.mjs', '.jsx', '.ts', '.tsx']);
const SKIP_DIRS = new Set(['.git', '.jj', '.planning', 'node_modules', 'dist', 'coverage']);

function isCodeFile(filePath) {
  return DEFAULT_EXTENSIONS.has(path.extname(filePath));
}

function walkTargetFiles(rootPath, currentPath = rootPath, files = []) {
  let entries = [];
  try {
    entries = fs.readdirSync(currentPath, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.env.example') {
      if (SKIP_DIRS.has(entry.name)) continue;
    }
    if (SKIP_DIRS.has(entry.name)) continue;
    const absolutePath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      walkTargetFiles(rootPath, absolutePath, files);
      continue;
    }
    if (entry.isFile() && isCodeFile(absolutePath)) {
      files.push(absolutePath);
    }
  }
  return files;
}

function getLineNumber(content, index) {
  return content.slice(0, Math.max(0, index)).split('\n').length;
}

function getLineText(content, lineNumber) {
  return String(content || '').split('\n')[Math.max(0, lineNumber - 1)] || '';
}

function collectRuleFindings(rule, relPath, content, config) {
  const findings = [];
  for (const pattern of rule.patterns || []) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(content)) !== null) {
      const line = getLineNumber(content, match.index);
      findings.push(normalizeSecurityFinding({
        engine: 'owasp',
        rule_id: rule.rule_id,
        owasp: rule.owasp,
        category: rule.category,
        path: relPath,
        line,
        severity: rule.severity,
        confidence: rule.confidence,
        title: rule.title,
        message: rule.title,
        rationale: rule.rationale,
        next_step: rule.next_step,
        evidence: {
          kind: 'pattern',
          line_text: getLineText(content, line).trim(),
          narrowness: rule.narrowness,
        },
        verification: {
          independent_check: `Confirm the matched ${rule.family} pattern on ${relPath}:${line} is reachable with untrusted input.`,
        },
      }, config));
      if (match.index === regex.lastIndex) regex.lastIndex += 1;
    }
  }
  return findings;
}

function runOwaspEngine(cwd, target, config = {}) {
  const absoluteTarget = target && target.path ? target.path : cwd;
  const files = fs.existsSync(absoluteTarget) && fs.statSync(absoluteTarget).isFile()
    ? [absoluteTarget]
    : walkTargetFiles(absoluteTarget);
  const findings = [];

  for (const absoluteFile of files) {
    let content = '';
    try {
      content = fs.readFileSync(absoluteFile, 'utf-8');
    } catch {
      continue;
    }
    const relPath = path.relative(cwd, absoluteFile) || path.basename(absoluteFile);
    for (const rule of OWASP_RULES) {
      findings.push(...collectRuleFindings(rule, relPath, content, config));
    }
  }

  return {
    engine: 'owasp',
    findings,
    registry: getOwaspCoverageSummary(),
    scanned_files: files.map(filePath => path.relative(cwd, filePath) || path.basename(filePath)),
  };
}

module.exports = {
  DEFAULT_EXTENSIONS,
  OWASP_RULES,
  getLineNumber,
  runOwaspEngine,
  walkTargetFiles,
};
