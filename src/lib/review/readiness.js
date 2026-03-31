'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { execGit } = require('../git');

const CHECK_ORDER = [
  ['tests', 'Tests'],
  ['lint', 'Lint'],
  ['review', 'Review findings'],
  ['security', 'Security findings'],
  ['todo_diff', 'TODOs in diff'],
  ['changelog', 'Changelog'],
];

function supportsColor() {
  if ('NO_COLOR' in process.env) return false;
  if (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== '0') return true;
  return !!process.stdout.isTTY;
}

function colorize(text, kind) {
  if (!supportsColor()) return String(text);
  const codes = {
    green: ['32', '39'],
    red: ['31', '39'],
    yellow: ['33', '39'],
    cyan: ['36', '39'],
    dim: ['2', '22'],
    bold: ['1', '22'],
  };
  const pair = codes[kind];
  if (!pair) return String(text);
  return `\x1b[${pair[0]}m${text}\x1b[${pair[1]}m`;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function loadPackageJson(cwd) {
  const packagePath = path.join(cwd, 'package.json');
  if (!fs.existsSync(packagePath)) return null;
  return readJson(packagePath);
}

function runNpmScript(cwd, scriptName) {
  const pkg = loadPackageJson(cwd);
  if (!pkg || !pkg.scripts || typeof pkg.scripts[scriptName] !== 'string' || !pkg.scripts[scriptName].trim()) {
    return {
      status: 'skip',
      reason: `package.json does not define a ${scriptName} script`,
      evidence: { script: scriptName, command: null, exit_code: null },
    };
  }

  try {
    execFileSync('npm', ['run', scriptName, '--silent'], {
      cwd,
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout: 120000,
    });
    return {
      status: 'pass',
      reason: `npm run ${scriptName} passed`,
      evidence: { script: scriptName, command: `npm run ${scriptName} --silent`, exit_code: 0 },
    };
  } catch (err) {
    return {
      status: 'fail',
      reason: `npm run ${scriptName} failed`,
      evidence: {
        script: scriptName,
        command: `npm run ${scriptName} --silent`,
        exit_code: err.status ?? 1,
        stderr: String(err.stderr || '').trim() || null,
      },
    };
  }
}

function findReportPath(cwd, names) {
  for (const name of names) {
    const candidate = path.join(cwd, name);
    if (fs.existsSync(candidate)) return candidate;
  }

  const phaseRoot = path.join(cwd, '.planning', 'phases');
  if (!fs.existsSync(phaseRoot)) return null;
  const phaseDirs = fs.readdirSync(phaseRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  for (const entry of phaseDirs) {
    for (const name of names) {
      const candidate = path.join(phaseRoot, entry.name, path.basename(name));
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function extractOpenFindingCount(report) {
  if (!report || typeof report !== 'object') return null;
  if (typeof report.open_findings === 'number') return report.open_findings;
  if (typeof report.unresolved_findings === 'number') return report.unresolved_findings;
  if (typeof report.summary?.total === 'number') return report.summary.total;
  if (typeof report.summary?.open === 'number') return report.summary.open;
  if (typeof report.summary?.remaining === 'number') return report.summary.remaining;
  if (Array.isArray(report.findings)) return report.findings.length;
  if (Array.isArray(report.unresolved)) return report.unresolved.length;
  return null;
}

function evaluateReportCheck(cwd, label, names) {
  const reportPath = findReportPath(cwd, names);
  if (!reportPath) {
    return {
      status: 'skip',
      reason: `${label} report not found`,
      evidence: { path: null, open_findings: null },
    };
  }

  const report = readJson(reportPath);
  if (!report) {
    return {
      status: 'skip',
      reason: `${label} report could not be parsed`,
      evidence: { path: path.relative(cwd, reportPath), open_findings: null },
    };
  }

  const openFindings = extractOpenFindingCount(report);
  if (openFindings === null) {
    return {
      status: 'skip',
      reason: `${label} report has no deterministic finding count`,
      evidence: { path: path.relative(cwd, reportPath), open_findings: null },
    };
  }

  return {
    status: openFindings === 0 ? 'pass' : 'fail',
    reason: openFindings === 0 ? `${label} report shows no open findings` : `${label} report shows ${openFindings} open finding(s)`,
    evidence: { path: path.relative(cwd, reportPath), open_findings: openFindings },
  };
}

function evaluateTodoDiff(cwd) {
  const result = execGit(cwd, ['diff', 'HEAD', '--unified=0', '--no-color', '--no-ext-diff']);
  if (result.exitCode !== 0) {
    return {
      status: 'skip',
      reason: 'git diff could not be evaluated',
      evidence: { todo_count: null, error: result.stderr || null },
    };
  }

  const matches = String(result.stdout || '')
    .split('\n')
    .filter((line) => /^\+(?!\+\+)/.test(line) && /\b(TODO|FIXME|XXX)\b/i.test(line));

  return {
    status: matches.length === 0 ? 'pass' : 'fail',
    reason: matches.length === 0 ? 'No TODO markers found in current diff' : `${matches.length} TODO marker(s) found in current diff`,
    evidence: { todo_count: matches.length, samples: matches.slice(0, 3).map((line) => line.slice(1).trim()) },
  };
}

function evaluateChangelog(cwd) {
  const changelogPath = path.join(cwd, 'CHANGELOG.md');
  if (!fs.existsSync(changelogPath)) {
    return {
      status: 'skip',
      reason: 'CHANGELOG.md not found',
      evidence: { path: 'CHANGELOG.md', modified: null },
    };
  }

  const result = execGit(cwd, ['diff', 'HEAD', '--name-only', '--', 'CHANGELOG.md']);
  if (result.exitCode !== 0) {
    return {
      status: 'skip',
      reason: 'CHANGELOG.md diff could not be evaluated',
      evidence: { path: 'CHANGELOG.md', modified: null, error: result.stderr || null },
    };
  }

  const modified = String(result.stdout || '').split('\n').includes('CHANGELOG.md');
  return {
    status: modified ? 'pass' : 'fail',
    reason: modified ? 'CHANGELOG.md is updated in the current diff' : 'CHANGELOG.md is present but not updated in the current diff',
    evidence: { path: 'CHANGELOG.md', modified },
  };
}

function normalizeCheck(key, label, result) {
  return {
    key,
    label,
    status: result.status,
    reason: result.reason,
    evidence: result.evidence || {},
  };
}

function buildReadinessReport(cwd) {
  const ordered = [
    normalizeCheck('tests', 'Tests', runNpmScript(cwd, 'test')),
    normalizeCheck('lint', 'Lint', runNpmScript(cwd, 'lint')),
    normalizeCheck('review', 'Review findings', evaluateReportCheck(cwd, 'Review', ['.planning/review-report.json'])),
    normalizeCheck('security', 'Security findings', evaluateReportCheck(cwd, 'Security', ['.planning/security-report.json'])),
    normalizeCheck('todo_diff', 'TODOs in diff', evaluateTodoDiff(cwd)),
    normalizeCheck('changelog', 'Changelog', evaluateChangelog(cwd)),
  ];

  const checks = {};
  const summary = { pass: 0, fail: 0, skip: 0, total: ordered.length };
  for (const check of ordered) {
    checks[check.key] = check;
    summary[check.status] += 1;
  }

  return {
    command: 'review:readiness',
    status: 'ok',
    advisory: true,
    ready: summary.fail === 0 && summary.skip === 0,
    generated_at: new Date().toISOString(),
    ordered_checks: ordered,
    checks,
    summary,
  };
}

function formatStatusCell(status) {
  if (status === 'pass') return colorize('PASS', 'green');
  if (status === 'fail') return colorize('FAIL', 'red');
  return colorize('SKIP', 'yellow');
}

function formatReadiness(result) {
  const lines = [];
  lines.push(`${colorize('review:readiness', 'bold')} ${colorize('(advisory)', 'cyan')}`);
  lines.push(`Ready: ${result.ready ? colorize('yes', 'green') : colorize('not yet', 'yellow')}`);
  lines.push(`Board: ${result.summary.pass} pass, ${result.summary.fail} fail, ${result.summary.skip} skip`);
  lines.push('');

  for (const [key, label] of CHECK_ORDER) {
    const check = result.checks[key];
    lines.push(`${formatStatusCell(check.status)}  ${label}`);
  }

  const details = result.ordered_checks.filter((check) => check.status !== 'pass');
  if (details.length > 0) {
    lines.push('');
    lines.push(colorize('Details', 'bold'));
    for (const check of details) {
      lines.push(`- ${check.label}: ${check.reason}`);
    }
  }

  lines.push('');
  lines.push(colorize('Advisory only — this report never blocks release flow.', 'dim'));
  return lines.join('\n');
}

module.exports = {
  buildReadinessReport,
  formatReadiness,
};
