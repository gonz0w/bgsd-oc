const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const { runGsdTools, cleanup } = require('./helpers.cjs');
const { getOwaspCoverageSummary } = require('../src/lib/security/rules');

function createSecurityProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-security-'));
  fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({}));
  fs.writeFileSync(path.join(tmpDir, 'src', 'tracked.js'), 'module.exports = 1;\n');
  execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com" && git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git add -A && git commit -m "init: setup"', { cwd: tmpDir, stdio: 'pipe' });
  return tmpDir;
}

function writeAdvisoryFixture(tmpDir, advisories) {
  const fixturePath = path.join(tmpDir, '.planning', 'advisories.json');
  fs.writeFileSync(fixturePath, JSON.stringify({ advisories }, null, 2));
  fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({
    security: {
      advisory_fixture_path: fixturePath,
    },
  }, null, 2));
  return fixturePath;
}

describe('security:scan', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createSecurityProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns deterministic json shape with shared finding schema', () => {
    const findingsPath = path.join(tmpDir, 'findings.json');
    fs.writeFileSync(findingsPath, JSON.stringify({ findings: [{
      engine: 'owasp',
      rule_id: 'js-sql-injection',
      path: 'src/tracked.js',
      line: 2,
      severity: 'BLOCKER',
      confidence: 0.93,
      confidence_band: 'high',
      message: 'Possible SQL injection',
      rationale: 'String interpolation reaches a query sink.',
      next_step: 'Use parameterized queries.',
      verification: { independent_check: 'manual sink/source inspection' }
    }] }, null, 2));

    const result = runGsdTools(`security:scan --findings-file ${findingsPath}`, tmpDir);
    assert.ok(result.success, result.error);
    const output = JSON.parse(result.output);

    assert.strictEqual(output.command, 'security:scan');
    assert.strictEqual(output.target.mode, 'repo-root');
    assert.strictEqual(output.findings.length, 1);
    assert.strictEqual(output.findings[0].confidence_band, 'high');
    assert.strictEqual(output.findings[0].verification.independent_check, 'manual sink/source inspection');
  });

  test('high and medium confidence findings stay visible while low confidence is suppressed', () => {
    const findingsPath = path.join(tmpDir, 'findings.json');
    fs.writeFileSync(findingsPath, JSON.stringify({ findings: [
      {
        engine: 'owasp',
        rule_id: 'high-confidence',
        path: 'src/tracked.js',
        line: 1,
        severity: 'BLOCKER',
        confidence: 0.92,
        confidence_band: 'high',
        message: 'high confidence issue',
        next_step: 'fix high confidence issue'
      },
      {
        engine: 'owasp',
        rule_id: 'medium-confidence',
        path: 'src/tracked.js',
        line: 2,
        severity: 'WARNING',
        confidence: 0.61,
        confidence_band: 'medium',
        message: 'medium confidence issue',
        next_step: 'review medium confidence issue'
      },
      {
        engine: 'owasp',
        rule_id: 'low-confidence',
        path: 'src/tracked.js',
        line: 3,
        severity: 'INFO',
        confidence: 0.2,
        confidence_band: 'low',
        message: 'low confidence issue',
        next_step: 'ignore for now'
      }
    ] }, null, 2));

    const result = runGsdTools(`security:scan --findings-file ${findingsPath}`, tmpDir);
    assert.ok(result.success, result.error);
    const output = JSON.parse(result.output);

    assert.deepStrictEqual(output.findings.map(finding => finding.confidence_band), ['high', 'medium']);
    assert.strictEqual(output.suppressed.length, 1);
    assert.strictEqual(output.suppressed[0].suppressed_reason, 'confidence-band');
  });

  test('security exclusions match exact finding identity and expired entries warn instead of suppressing', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'security-exclusions.json'), JSON.stringify({
      version: 1,
      exclusions: [
        {
          rule_id: 'secret-api-key',
          path: 'src/tracked.js',
          fingerprint: 'match-me',
          reason: 'known fixture',
          expires_at: '2099-01-01'
        },
        {
          rule_id: 'secret-api-key',
          path: 'src/tracked.js',
          fingerprint: 'expired-entry',
          reason: 'stale fixture',
          expires_at: '2020-01-01'
        }
      ]
    }, null, 2));
    const findingsPath = path.join(tmpDir, 'findings.json');
    fs.writeFileSync(findingsPath, JSON.stringify({ findings: [
      {
        engine: 'secrets',
        rule_id: 'secret-api-key',
        path: 'src/tracked.js',
        line: 1,
        severity: 'BLOCKER',
        confidence: 0.95,
        confidence_band: 'high',
        fingerprint: 'match-me',
        message: 'fixture secret',
        next_step: 'rotate the credential'
      },
      {
        engine: 'secrets',
        rule_id: 'secret-api-key',
        path: 'src/tracked.js',
        line: 2,
        severity: 'BLOCKER',
        confidence: 0.95,
        confidence_band: 'high',
        fingerprint: 'keep-me',
        message: 'real secret',
        next_step: 'rotate the credential'
      },
      {
        engine: 'secrets',
        rule_id: 'secret-api-key',
        path: 'src/tracked.js',
        line: 3,
        severity: 'WARNING',
        confidence: 0.95,
        confidence_band: 'high',
        fingerprint: 'expired-entry',
        message: 'expired exclusion should not hide this',
        next_step: 'review exclusion file'
      }
    ] }, null, 2));

    const result = runGsdTools(`security:scan --findings-file ${findingsPath}`, tmpDir);
    assert.ok(result.success, result.error);
    const output = JSON.parse(result.output);

    assert.strictEqual(output.findings.length, 2);
    assert.strictEqual(output.suppressed.length, 1);
    assert.strictEqual(output.suppressed[0].fingerprint, 'match-me');
    assert.ok(output.warnings.some(warning => warning.code === 'expired-exclusion'));
  });

  test('exclusions require reason and expiry metadata', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'security-exclusions.json'), JSON.stringify({
      version: 1,
      exclusions: [
        { rule_id: 'missing-reason', path: 'src/tracked.js', expires_at: '2099-01-01' },
        { rule_id: 'missing-expiry', path: 'src/tracked.js', reason: 'documented' }
      ]
    }, null, 2));

    const result = runGsdTools('security:scan', tmpDir);
    assert.ok(result.success, result.error);
    const output = JSON.parse(result.output);

    assert.ok(output.exclusions.errors.some(msg => msg.includes('reason is required')));
    assert.ok(output.exclusions.errors.some(msg => msg.includes('expires_at is required')));
  });

  test('pretty output stays severity-led and explicit about confidence bands', () => {
    const findingsPath = path.join(tmpDir, 'findings.json');
    fs.writeFileSync(findingsPath, JSON.stringify({ findings: [{
      engine: 'owasp',
      rule_id: 'medium-confidence',
      path: 'src/tracked.js',
      line: 2,
      severity: 'WARNING',
      confidence: 0.61,
      confidence_band: 'medium',
      message: 'medium confidence issue',
      next_step: 'review medium confidence issue'
    }] }, null, 2));

    const result = runGsdTools(`security:scan --pretty --findings-file ${findingsPath}`, tmpDir);
    assert.ok(result.success, result.error);
    assert.ok(result.output.includes('WARNING'));
    assert.ok(result.output.includes('[MEDIUM 6.1/10]'));
    assert.ok(result.output.includes('Why:'));
  });

  test('secrets engine redacts values, keeps repo-wide scanning on, and supports finding-specific exclusions', () => {
    fs.mkdirSync(path.join(tmpDir, 'tests', 'fixtures'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'tests', 'fixtures', 'sample.env'), 'API_KEY="ghp_1234567890abcdefghijABCDEFGHIJ"\n');

    let result = runGsdTools('security:scan --target tests', tmpDir);
    assert.ok(result.success, result.error);
    let output = JSON.parse(result.output);

    const secretFinding = output.findings.find(finding => finding.engine === 'secrets');
    assert.ok(secretFinding, 'expected secret finding from fixture path');
    assert.strictEqual(secretFinding.path, 'tests/fixtures/sample.env');
    assert.strictEqual(secretFinding.evidence.redacted, true);
    assert.ok(!JSON.stringify(secretFinding).includes('ghp_1234567890abcdefghijABCDEFGHIJ'), 'secret value must be redacted');
    assert.ok(secretFinding.fingerprint, 'fingerprint should be present for finding-specific suppression');

    fs.writeFileSync(path.join(tmpDir, '.planning', 'security-exclusions.json'), JSON.stringify({
      version: 1,
      exclusions: [{
        rule_id: secretFinding.rule_id,
        path: secretFinding.path,
        fingerprint: secretFinding.fingerprint,
        reason: 'intentional sample credential fixture',
        expires_at: '2099-01-01',
      }],
    }, null, 2));

    result = runGsdTools('security:scan --target tests', tmpDir);
    assert.ok(result.success, result.error);
    output = JSON.parse(result.output);
    assert.strictEqual(output.findings.filter(finding => finding.engine === 'secrets').length, 0);
    assert.ok(output.suppressed.some(item => item.fingerprint === secretFinding.fingerprint));
  });

  test('dependency engine reports severity, remediation, and confidence from evidence quality', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'dep-scan-test',
      version: '1.0.0',
      dependencies: {
        minimist: '^0.0.8',
        lodash: '4.17.20',
      },
    }, null, 2));
    fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), JSON.stringify({
      name: 'dep-scan-test',
      lockfileVersion: 3,
      packages: {
        '': {
          name: 'dep-scan-test',
          version: '1.0.0',
        },
        'node_modules/lodash': {
          version: '4.17.20',
        },
      },
    }, null, 2));
    fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), 'flask==0.5\n');
    writeAdvisoryFixture(tmpDir, [
      {
        ecosystem: 'npm',
        package: 'lodash',
        id: 'OSV-LODASH-1',
        summary: 'Prototype pollution in lodash 4.17.20',
        severity: 'BLOCKER',
        fixed_version: '4.17.21',
        versions: ['4.17.20'],
      },
      {
        ecosystem: 'npm',
        package: 'minimist',
        id: 'OSV-MINIMIST-1',
        summary: 'Loose minimist range may resolve to a vulnerable release',
        severity: 'WARNING',
        fixed_version: '1.2.8',
        range_substrings: ['^0.0.8'],
      },
      {
        ecosystem: 'PyPI',
        package: 'flask',
        id: 'OSV-FLASK-1',
        summary: 'Flask 0.5 contains a known security issue',
        severity: 'WARNING',
        fixed_version: '2.3.0',
        versions: ['0.5'],
      },
    ]);

    const result = runGsdTools('security:scan', tmpDir);
    assert.ok(result.success, result.error);
    const output = JSON.parse(result.output);

    const dependencyFindings = output.findings.filter(finding => finding.engine === 'dependencies');
    assert.strictEqual(dependencyFindings.length, 3);

    const resolved = dependencyFindings.find(finding => finding.evidence.package_name === 'lodash');
    const rangeOnly = dependencyFindings.find(finding => finding.evidence.package_name === 'minimist');
    const pinned = dependencyFindings.find(finding => finding.evidence.package_name === 'flask');

    assert.strictEqual(resolved.evidence.evidence_quality, 'resolved');
    assert.strictEqual(pinned.evidence.evidence_quality, 'pinned');
    assert.strictEqual(rangeOnly.evidence.evidence_quality, 'range-only');
    assert.ok(resolved.confidence > pinned.confidence && pinned.confidence > rangeOnly.confidence, 'confidence should follow evidence quality');
    assert.ok(String(resolved.next_step).includes('4.17.21'));
    assert.ok(String(rangeOnly.next_step).includes('lockfile'));
  });

  test('multi-engine scan produces one severity-led report with explicit confidence labels', () => {
    fs.writeFileSync(path.join(tmpDir, 'src', 'app.js'), [
      'const apiKey = "ghp_1234567890abcdefghijABCDEFGHIJ";',
      'db.query(`SELECT * FROM users WHERE id = ${userId}`);',
      '',
    ].join('\n'));
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'full-scan-test',
      version: '1.0.0',
      dependencies: {
        lodash: '4.17.20',
      },
    }, null, 2));
    fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), JSON.stringify({
      name: 'full-scan-test',
      lockfileVersion: 3,
      packages: {
        '': { name: 'full-scan-test', version: '1.0.0' },
        'node_modules/lodash': { version: '4.17.20' },
      },
    }, null, 2));
    writeAdvisoryFixture(tmpDir, [{
      ecosystem: 'npm',
      package: 'lodash',
      id: 'OSV-LODASH-1',
      summary: 'Prototype pollution in lodash 4.17.20',
      severity: 'BLOCKER',
      fixed_version: '4.17.21',
      versions: ['4.17.20'],
    }]);

    const prettyResult = runGsdTools('security:scan --pretty', tmpDir);
    assert.ok(prettyResult.success, prettyResult.error);
    assert.ok(prettyResult.output.includes('BLOCKER'));
    assert.ok(prettyResult.output.includes('OWASP / injection') || prettyResult.output.includes('OWASP /'));
    assert.ok(prettyResult.output.includes('SECRETS / sensitive-data-exposure'));
    assert.ok(prettyResult.output.includes('DEPENDENCIES / known-vulnerable-components'));
    assert.ok(prettyResult.output.includes('[HIGH'));

    const jsonResult = runGsdTools('security:scan', tmpDir);
    assert.ok(jsonResult.success, jsonResult.error);
    const output = JSON.parse(jsonResult.output);
    assert.ok(output.findings.some(finding => finding.engine === 'owasp'));
    assert.ok(output.findings.some(finding => finding.engine === 'secrets'));
    assert.ok(output.findings.some(finding => finding.engine === 'dependencies'));
    assert.deepStrictEqual(output.findings.map(finding => finding.severity), [...output.findings.map(finding => finding.severity)].sort((a, b) => ({ BLOCKER: 0, WARNING: 1, INFO: 2 }[a] - { BLOCKER: 0, WARNING: 1, INFO: 2 }[b])));
  });

  test('OWASP registry truthfully maps every promised SEC-01 category', () => {
    const coverage = getOwaspCoverageSummary();
    const categories = new Set(coverage.map(entry => entry.category));

    [
      'injection',
      'broken-authentication',
      'sensitive-data-exposure',
      'xml-external-entities',
      'broken-access-control',
      'security-misconfiguration',
      'cross-site-scripting',
      'insecure-deserialization',
      'known-vulnerable-components',
      'insufficient-logging-monitoring',
    ].forEach(category => assert.ok(categories.has(category), `missing OWASP category mapping for ${category}`));

    const dependencyCoverage = coverage.find(entry => entry.category === 'known-vulnerable-components');
    assert.strictEqual(dependencyCoverage.coverage, 'delegated-family');
    assert.strictEqual(dependencyCoverage.engine, 'dependencies');
    assert.ok(String(dependencyCoverage.note).includes('plan 03'));
  });

  test('shared scan pipeline emits OWASP findings with category mapping, rationale, and next steps', () => {
    fs.writeFileSync(path.join(tmpDir, 'src', 'injection.js'), "db.query(`SELECT * FROM users WHERE id = ${userId}`);\n");
    fs.writeFileSync(path.join(tmpDir, 'src', 'auth.js'), "const claims = jwt.decode(token);\nconst digest = createHash('md5');\n");
    fs.writeFileSync(path.join(tmpDir, 'src', 'config.js'), "https.request(url, { rejectUnauthorized: false });\nconst cors = { origin: '*' };\n");
    fs.writeFileSync(path.join(tmpDir, 'src', 'ui.jsx'), "el.innerHTML = userContent;\n");
    fs.writeFileSync(path.join(tmpDir, 'src', 'xml.js'), "parseXml(data, { resolveEntities: true });\n");
    fs.writeFileSync(path.join(tmpDir, 'src', 'access.js'), "const route = { skipAuthorization: true };\n");
    fs.writeFileSync(path.join(tmpDir, 'src', 'deserialize.js'), "const parsed = yaml.load(body);\n");
    fs.writeFileSync(path.join(tmpDir, 'src', 'logging.js'), "try { work(); } catch (err) { return null; }\n");

    const result = runGsdTools('security:scan --target src', tmpDir);
    assert.ok(result.success, result.error);
    const output = JSON.parse(result.output);

    assert.strictEqual(output.engines[0].engine, 'owasp');
    assert.ok(output.engines[0].registry.length >= 10, 'registry should expose honest category coverage');
    assert.ok(output.findings.length >= 8, 'representative OWASP findings should be emitted');
    assert.ok(output.findings.every(finding => Array.isArray(finding.owasp) && finding.owasp.length >= 1), 'findings should retain OWASP categories');
    assert.ok(output.findings.every(finding => typeof finding.rationale === 'string' && finding.rationale.length > 10), 'findings should retain rationale text');
    assert.ok(output.findings.every(finding => typeof finding.next_step === 'string' && finding.next_step.length > 10), 'findings should retain next-step guidance');

    const categories = new Set(output.findings.map(finding => finding.category));
    [
      'injection',
      'broken-authentication',
      'sensitive-data-exposure',
      'security-misconfiguration',
      'cross-site-scripting',
      'xml-external-entities',
      'broken-access-control',
      'insecure-deserialization',
      'insufficient-logging-monitoring',
    ].forEach(category => assert.ok(categories.has(category), `expected finding for ${category}`));
  });

  test('help is routed and documented', () => {
    const result = runGsdTools('security:scan --help', tmpDir);
    assert.ok(result.success, result.error);
  });
});
