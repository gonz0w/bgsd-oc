'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { normalizeSecurityFinding } = require('../schema');

const SKIP_DIRS = new Set(['.git', '.jj', '.planning', 'node_modules', 'dist', 'coverage']);
const MAX_FILE_SIZE_BYTES = 512 * 1024;
const TEXT_EXTENSIONS = new Set([
  '', '.cjs', '.conf', '.crt', '.cs', '.env', '.example', '.go', '.graphql', '.hcl', '.ini', '.java', '.js', '.json', '.jsx',
  '.key', '.kts', '.md', '.mjs', '.pem', '.php', '.properties', '.py', '.rb', '.rs', '.sample', '.sh', '.sql', '.tf', '.toml',
  '.ts', '.tsx', '.txt', '.yaml', '.yml',
]);

const SECRET_RULES = [
  {
    rule_id: 'secret-aws-access-key',
    title: 'Possible AWS access key committed in source',
    category: 'sensitive-data-exposure',
    owasp: ['A02', 'A07'],
    severity: 'BLOCKER',
    confidence: 0.96,
    kind: 'provider',
    rationale: 'AWS access key prefixes are highly specific and should not be stored in source control.',
    next_step: 'Move the credential to environment or secret storage and rotate the exposed key.',
    pattern: /\b((?:AKIA|ASIA|AGPA|AIDA|AROA|AIPA)[A-Z0-9]{16})\b/g,
  },
  {
    rule_id: 'secret-github-token',
    title: 'Possible GitHub token committed in source',
    category: 'sensitive-data-exposure',
    owasp: ['A02', 'A07'],
    severity: 'BLOCKER',
    confidence: 0.96,
    kind: 'provider',
    rationale: 'GitHub personal and app tokens are credential material and should not be committed.',
    next_step: 'Revoke the token in GitHub, move it to secret storage, and update the workflow to read it from environment.',
    pattern: /\b((?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,255})\b/g,
  },
  {
    rule_id: 'secret-slack-token',
    title: 'Possible Slack token committed in source',
    category: 'sensitive-data-exposure',
    owasp: ['A02', 'A07'],
    severity: 'BLOCKER',
    confidence: 0.95,
    kind: 'provider',
    rationale: 'Slack token prefixes are service-specific and indicate reusable credentials.',
    next_step: 'Revoke the Slack token, move it to secret storage, and rotate any downstream integrations using it.',
    pattern: /\b(xox(?:a|b|p|r|s)-[A-Za-z0-9-]{10,})\b/g,
  },
  {
    rule_id: 'secret-private-key',
    title: 'Private key material committed in source',
    category: 'sensitive-data-exposure',
    owasp: ['A02'],
    severity: 'BLOCKER',
    confidence: 0.99,
    kind: 'private-key',
    rationale: 'Private key blocks are highly sensitive cryptographic material and should never live in the repo.',
    next_step: 'Remove the key from source control, replace it with a reference to secure storage, and rotate the key pair.',
    pattern: /-----BEGIN ([A-Z ]*PRIVATE KEY)-----[\s\S]*?-----END \1-----/g,
  },
  {
    rule_id: 'secret-generic-assignment',
    title: 'Possible hardcoded secret assigned in source',
    category: 'sensitive-data-exposure',
    owasp: ['A02', 'A07'],
    severity: 'WARNING',
    confidence: 0.78,
    kind: 'generic',
    rationale: 'Secret-like variable names paired with credential-shaped values are likely hardcoded secrets.',
    next_step: 'Move the value to environment or secure config, then add a finding-specific exclusion only if it is an intentional fixture.',
    pattern: /\b([A-Za-z0-9_.-]*(?:api[_-]?key|secret|token|password|passwd|client[_-]?secret|access[_-]?token)[A-Za-z0-9_.-]*)\b\s*[:=]\s*(["'`]?)([^\n"'`]{8,}|[A-Za-z0-9+/_=-]{12,})\2/g,
  },
];

function shouldSkipEntry(entry) {
  if (SKIP_DIRS.has(entry.name)) return true;
  return entry.name.startsWith('.') && entry.name !== '.env' && entry.name !== '.env.example';
}

function isProbablyTextFile(filePath, stat, content) {
  if (!stat.isFile() || stat.size > MAX_FILE_SIZE_BYTES) return false;
  if (TEXT_EXTENSIONS.has(path.extname(filePath))) return true;
  return !content.includes('\u0000');
}

function walkSecretFiles(rootPath, currentPath = rootPath, files = []) {
  let entries = [];
  try {
    entries = fs.readdirSync(currentPath, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (shouldSkipEntry(entry)) continue;
    const absolutePath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      walkSecretFiles(rootPath, absolutePath, files);
      continue;
    }
    if (!entry.isFile()) continue;
    let stat;
    let content;
    try {
      stat = fs.statSync(absolutePath);
      content = fs.readFileSync(absolutePath, 'utf-8');
    } catch {
      continue;
    }
    if (isProbablyTextFile(absolutePath, stat, content)) {
      files.push({ absolutePath, content });
    }
  }
  return files;
}

function getLineNumber(content, index) {
  return content.slice(0, Math.max(0, index)).split('\n').length;
}

function redactSecret(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '***REDACTED***';
  if (text.includes('PRIVATE KEY')) return '-----BEGIN … PRIVATE KEY-----';
  if (text.length <= 6) return '***REDACTED***';
  return `${text.slice(0, 4)}…${text.slice(-2)}`;
}

function buildFingerprint(ruleId, relPath, line, secretValue) {
  return crypto
    .createHash('sha256')
    .update(`${ruleId}\n${relPath}\n${line}\n${String(secretValue || '').trim()}`)
    .digest('hex')
    .slice(0, 16);
}

function adjustGenericConfidence(secretValue, variableName) {
  const value = String(secretValue || '');
  const variable = String(variableName || '').toLowerCase();
  const hasMixedCharset = /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value);
  const base = hasMixedCharset ? 0.84 : 0.72;
  if (variable.includes('password')) return Math.max(base, 0.82);
  return base;
}

function createSecretFinding(rule, relPath, line, secretValue, extra, config) {
  const confidence = rule.kind === 'generic'
    ? adjustGenericConfidence(secretValue, extra && extra.variable_name)
    : rule.confidence;
  return normalizeSecurityFinding({
    engine: 'secrets',
    rule_id: rule.rule_id,
    title: rule.title,
    message: rule.title,
    category: rule.category,
    owasp: rule.owasp,
    path: relPath,
    line,
    severity: rule.severity,
    confidence,
    fingerprint: buildFingerprint(rule.rule_id, relPath, line, secretValue),
    rationale: rule.rationale,
    next_step: rule.next_step,
    evidence: {
      kind: rule.kind,
      redacted: true,
      match_preview: redactSecret(secretValue),
      variable_name: extra && extra.variable_name ? extra.variable_name : null,
    },
    verification: {
      independent_check: `Confirm ${relPath}:${line} contains a real credential and replace it with environment-backed configuration or an explicit finding-level exclusion if it is intentional test data.`,
    },
  }, config);
}

function collectSecretFindings(relPath, content, config) {
  const findings = [];
  for (const rule of SECRET_RULES) {
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    let match;
    while ((match = regex.exec(content)) !== null) {
      const secretValue = rule.kind === 'generic' ? match[3] : match[1];
      const line = getLineNumber(content, match.index);
      findings.push(createSecretFinding(rule, relPath, line, secretValue, {
        variable_name: rule.kind === 'generic' ? match[1] : null,
      }, config));
      if (match.index === regex.lastIndex) regex.lastIndex += 1;
    }
  }
  return findings;
}

function runSecretsEngine(cwd, target, config = {}) {
  const absoluteTarget = target && target.path ? target.path : cwd;
  const files = fs.existsSync(absoluteTarget) && fs.statSync(absoluteTarget).isFile()
    ? [{ absolutePath: absoluteTarget, content: fs.readFileSync(absoluteTarget, 'utf-8') }]
    : walkSecretFiles(absoluteTarget);
  const findings = [];

  for (const file of files) {
    const relPath = path.relative(cwd, file.absolutePath) || path.basename(file.absolutePath);
    findings.push(...collectSecretFindings(relPath, file.content, config));
  }

  return {
    engine: 'secrets',
    findings,
    registry: SECRET_RULES.map(rule => ({
      rule_id: rule.rule_id,
      kind: rule.kind,
      severity: rule.severity,
      owasp: rule.owasp,
    })),
    scanned_files: files.map(file => path.relative(cwd, file.absolutePath) || path.basename(file.absolutePath)),
  };
}

module.exports = {
  SECRET_RULES,
  buildFingerprint,
  collectSecretFindings,
  redactSecret,
  runSecretsEngine,
  walkSecretFiles,
};
