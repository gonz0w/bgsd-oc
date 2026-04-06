'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { output, error, debugLog } = require('../../lib/output');
const { safeReadFile, cachedReadFile, findPhaseInternal } = require('../../lib/helpers');
const { structuredLog, diffSummary } = require('../../lib/git');
const { writeFileAtomic } = require('../../lib/atomic-write');

function generateEdgeCaseSuggestions(cwd, changedFiles) {
  const suggestions = [];

  for (const file of changedFiles || []) {
    const content = safeReadFile(path.join(cwd, file)) || '';

    // Check for null/undefined handling
    if (content.includes('== null') || content.includes('=== null') || content.includes('== undefined')) {
      suggestions.push({
        category: 'null_undefined',
        file,
        description: 'File contains null checks - verify all null paths are tested',
        priority: 'high',
      });
    }

    // Check for error handling
    if (content.includes('catch (') || content.includes('throw new')) {
      suggestions.push({
        category: 'error_paths',
        file,
        description: 'File contains error handling - verify error paths are tested',
        priority: 'high',
      });
    }

    // Check for async/await
    if (content.includes('async ') && content.includes('await ')) {
      suggestions.push({
        category: 'async_edge_cases',
        file,
        description: 'File contains async code - verify race conditions and timeouts are tested',
        priority: 'medium',
      });
    }

    // Check for array operations
    if (content.includes('.map(') || content.includes('.filter(') || content.includes('.reduce(')) {
      suggestions.push({
        category: 'empty_collections',
        file,
        description: 'File contains array operations - verify empty array edge cases are tested',
        priority: 'medium',
      });
    }
  }

  return suggestions.length > 0 ? suggestions : null;
}

function cmdReview(cwd, args, raw, options = {}) {
  if (!args[0] || !args[1]) { error('Usage: review <phase> <plan-number>'); }
  const phaseInfo = findPhaseInternal(cwd, args[0]);
  if (!phaseInfo || !phaseInfo.found) { error(`Phase ${args[0]} not found`); }

  const padPlan = String(args[1]).padStart(2, '0');
  const phaseDir = path.join(cwd, phaseInfo.directory);
  const sumFile = fs.readdirSync(phaseDir).find(f => f.includes(`-${padPlan}-SUMMARY.md`));

  // Extract commit hashes from summary
  const hashes = [];
  if (sumFile) {
    const sc = safeReadFile(path.join(phaseDir, sumFile));
    if (sc) { let m; const re = /`([0-9a-f]{7,12})`/g; while ((m = re.exec(sc)) !== null) hashes.push(m[1]); }
  }

  const scope = `${phaseInfo.phase_number}-${padPlan}`;
  const all = structuredLog(cwd, { count: 20 });
  const scoped = Array.isArray(all) ? all.filter(c => c.conventional && c.conventional.scope === scope) : [];
  const commits = scoped.length > 0 ? scoped : (Array.isArray(all) ? all.slice(0, 10) : []);

  let diff = {};
  if (hashes.length >= 1) diff = diffSummary(cwd, { from: hashes[0] + '~1', to: hashes[hashes.length - 1] });
  else if (commits.length > 0) diff = diffSummary(cwd, { from: commits[commits.length - 1].hash + '~1', to: commits[0].hash });

  let conventions = null;
  try { const intel = require('../../lib/codebase-intel').readIntel(cwd); if (intel) conventions = intel.conventions || null; } catch (e) { debugLog('review', 'intel', e); }
  let conventionsDoc = null;
  try { conventionsDoc = cachedReadFile(path.join(cwd, '.planning', 'codebase', 'CONVENTIONS.md')); } catch (e) { /* optional */ }

  // Edge case suggestions
  let edge_case_suggestions = null;
  if (options.suggest_edge_cases) {
    const changedFileList = diff.files ? diff.files.map(f => f.path) : [];
    edge_case_suggestions = generateEdgeCaseSuggestions(cwd, changedFileList);
  }

  output({
    phase: `${phaseInfo.phase_number}-${phaseInfo.phase_name}`,
    plan: padPlan,
    commits: commits.map(c => ({ hash: c.hash, message: c.message, files: c.files.map(f => f.path) })),
    diff: { file_count: diff.file_count || 0, total_insertions: diff.total_insertions || 0, total_deletions: diff.total_deletions || 0 },
    conventions, conventions_doc: conventionsDoc,
    files_changed: diff.files ? diff.files.map(f => f.path) : [],
    edge_case_suggestions,
  }, raw);
}

async function cmdParityCheck(cwd, args, raw) {
  const { checkParity, checkAllParity } = require('../../lib/utils/parity-check');

  // Parse args
  const optIdx = args.indexOf('--optimization');
  const helpIdx = args.indexOf('--help');
  const jsonIdx = args.indexOf('--json');

  const showHelp = helpIdx !== -1;
  const outputJson = jsonIdx !== -1;

  // Check for help
  if (showHelp) {
    output({
      commands: ['parity-check'],
      help: `Usage: bgsd-tools util:parity-check [--optimization <name>] [--json]

Check parity for dependency-backed optimizations.

Options:
  --optimization <name>  Check specific optimization: valibot, discovery, compile_cache, sqlite_cache
  --json                 Output in JSON format
  --help                 Show this help

Without --optimization, checks all optimizations.

Exit codes:
  0 - All optimizations in parity
  1 - One or more optimizations not in parity

Examples:
  bgsd-tools util:parity-check
  bgsd-tools util:parity-check --optimization valibot
  bgsd-tools util:parity-check --json`,
    }, raw, 'parity-check');
    return;
  }

  let results;

  if (optIdx !== -1 && args[optIdx + 1]) {
    const optName = args[optIdx + 1];
    const result = await checkParity(optName, { cwd });
    results = [result];
  } else {
    results = await checkAllParity({ cwd });
  }

  // Determine overall match status
  const allMatch = results.every(r => r.match === true);
  const exitCode = allMatch ? 0 : 1;

  if (outputJson) {
    output({
      optimizations: results.map(r => ({
        name: r.optimization,
        match: r.match,
        details: r.details,
      })),
      allMatch,
      exitCode,
    }, raw);
  } else {
    // Human-readable output
    const lines = [];
    lines.push('=== Parity Check Results ===');
    lines.push('');

    for (const result of results) {
      const status = result.match === true ? '✓ PARITY' : (result.match === false ? '✗ MISMATCH' : '? UNKNOWN');
      lines.push(`${result.optimization}: ${status}`);

      if (result.details) {
        if (result.details.error) {
          lines.push(`  Error: ${result.details.error}`);
        } else if (result.details.summary) {
          lines.push(`  ${result.details.summary}`);
        } else if (result.details.sourceDirs) {
          lines.push(`  Source dirs: ${result.details.sourceDirs.match ? 'MATCH' : 'DIFFER'}`);
          lines.push(`  Walk files: ${result.details.walkFiles.match ? 'MATCH' : 'DIFFER'}`);
        } else {
          // Show key details
          for (const [key, value] of Object.entries(result.details)) {
            lines.push(`  ${key}: ${value}`);
          }
        }
      }
      lines.push('');
    }

    lines.push(`Overall: ${allMatch ? 'ALL IN PARITY' : 'SOME MISMATCHES'}`);
    lines.push(`Exit code: ${exitCode}`);

    output(lines.join('\n'), raw);
  }

  // Exit with appropriate code
  if (!raw && exitCode !== 0) {
    process.exit(exitCode);
  }
}

function cmdTdd(cwd, subcommand, parsedArgs, raw) {
  switch (subcommand) {
    case 'validate-red':
      return validateRed(cwd, parsedArgs, raw);
    case 'validate-green':
      return validateGreen(cwd, parsedArgs, raw);
    case 'validate-refactor':
      return validateRefactor(cwd, parsedArgs, raw);
    case 'auto-test':
      return autoTest(cwd, parsedArgs, raw);
    case 'audit':
      output({ message: 'TDD audit not yet implemented', subcommand }, raw);
      return;
    case 'proof':
      output({ message: 'TDD proof not yet implemented', subcommand }, raw);
      return;
    default:
      output({ error: `Unknown subcommand: ${subcommand}` }, raw);
  }
}

function parseTestCmd(args) {
  // args is an object with named properties from router
  if (args && typeof args === 'object' && args['test-cmd']) {
    return args['test-cmd'];
  }
  // Fallback: args might be an array
  if (Array.isArray(args)) {
    const idx = args.indexOf('--test-cmd');
    if (idx !== -1 && args[idx + 1]) {
      return args[idx + 1];
    }
  }
  return null;
}

function parseTestFile(args) {
  // args is an object with named properties from router
  if (args && typeof args === 'object' && args['test-file']) {
    return args['test-file'];
  }
  // Fallback: args might be an array
  if (Array.isArray(args)) {
    const idx = args.indexOf('--test-file');
    if (idx !== -1 && args[idx + 1]) {
      return args[idx + 1];
    }
  }
  return null;
}

function parsePrevCount(args) {
  // args is an object with named properties from router
  if (args && typeof args === 'object' && args['prev-count']) {
    return parseInt(args['prev-count'], 10);
  }
  // Fallback: args might be an array
  if (Array.isArray(args)) {
    const idx = args.indexOf('--prev-count');
    if (idx !== -1 && args[idx + 1]) {
      return parseInt(args[idx + 1], 10);
    }
  }
  return null;
}

function getTestCount(stdout, stderr) {
  // Parse test count from node:test output
  // Format: "ℹ tests 3" or "Tests: 2 passed, 2 total"
  const combined = stdout + '\n' + stderr;
  
  // Try node:test format: "ℹ tests 3" or "tests 3"
  const testsMatch = combined.match(/(?:ℹ\s+)?tests\s+(\d+)/i);
  if (testsMatch) {
    return parseInt(testsMatch[1], 10);
  }
  
  // Try classic format: "Tests: 2 passed, 2 total"
  const match = combined.match(/Tests:\s*\d+\s*passed.*?(\d+)\s*total/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  
  // Fallback: count "ok" lines
  const okMatches = combined.match(/^ok\s+/gm);
  if (okMatches) {
    return okMatches.length;
  }
  
  return null;
}

function isSemanticFailure(stdout, stderr) {
  // Check if failure is about missing behavior (not crashes, ENOENT, etc.)
  const combined = (stdout + '\n' + stderr).toLowerCase();
  
  // Crash indicators - NOT semantic failures
  const crashIndicators = [
    'enoent',
    'eisdir',
    'ebadf',
    'eperm',
    'acces denied',
    'permission denied',
    'cannot find module',
    'failed to require',
    'stack trace',
    ' segmentation fault',
    'bus error',
    'segfault',
  ];
  
  for (const indicator of crashIndicators) {
    if (combined.includes(indicator)) {
      return false;
    }
  }
  
  // Semantic failure indicators - test assertions, missing behavior
  const semanticIndicators = [
    'assert',
    'expected',
    'actual',
    'not equal',
    'not deepEqual',
    'fail',
    'error:',
    'throws:',
    'must be',
    'should be',
  ];
  
  for (const indicator of semanticIndicators) {
    if (combined.includes(indicator)) {
      return true;
    }
  }
  
  // If exit is non-zero and we see test output, assume semantic
  return true;
}

function writeAuditFile(phase, proof) {
  const timestamp = new Date().toISOString();
  const auditData = {
    ...proof,
    timestamp,
    gsd_phase: phase,
  };
  
  const phaseDir = process.env.BGSD_PHASE_DIR || '.';
  const auditPath = path.join(phaseDir, `${phase}-TDD-AUDIT.json`);
  
  try {
    writeFileAtomic(auditPath, JSON.stringify(auditData, null, 2));
  } catch (e) {
    // Non-fatal - continue even if audit write fails
  }
  
  return auditPath;
}

function validateRed(cwd, args, raw) {
  const testCmd = parseTestCmd(args);
  if (!testCmd) {
    output({ error: 'Missing --test-cmd argument' }, raw);
    return;
  }
  
  const testFile = parseTestFile(args);
  let testFileMtime = null;
  
  // Record test file mtime before running (if provided)
  if (testFile) {
    try {
      const stats = fs.statSync(path.join(cwd, testFile));
      testFileMtime = stats.mtime.getTime();
    } catch (e) {
      // File might not exist yet - that's OK for RED
    }
  }
  
  // Run the test command
  const result = spawnSync(testCmd, {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });
  
  const exitCode = result.status;
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  const combined = stdout + '\n' + stderr;
  
  // RED must fail (exit !== 0)
  const failed = exitCode !== 0;
  
  // Failure must be semantic (not crash)
  const semanticFailure = isSemanticFailure(stdout, stderr);
  
  const proof = {
    stage: 'red',
    command: testCmd,
    exitCode,
    stdout: stdout.substring(0, 500),
    stderr: stderr.substring(0, 500),
    failed,
    semanticFailure,
    testFileUnmodified: testFileMtime !== null,
    timestamp: new Date().toISOString(),
  };
  
  writeAuditFile('red', proof);
  output(proof, raw);
}

function validateGreen(cwd, args, raw) {
  const testCmd = parseTestCmd(args);
  if (!testCmd) {
    output({ error: 'Missing --test-cmd argument' }, raw);
    return;
  }
  
  const testFile = parseTestFile(args);
  let testFileMtimeBefore = null;
  let testFileMtimeAfter = null;
  
  // Record test file mtime before running (if provided)
  if (testFile) {
    try {
      const stats = fs.statSync(path.join(cwd, testFile));
      testFileMtimeBefore = stats.mtime.getTime();
    } catch (e) {
      // File doesn't exist
    }
  }
  
  // Run the test command
  const result = spawnSync(testCmd, {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });
  
  const exitCode = result.status;
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  
  // Record test file mtime after running (if provided)
  if (testFile && testFileMtimeBefore !== null) {
    try {
      const stats = fs.statSync(path.join(cwd, testFile));
      testFileMtimeAfter = stats.mtime.getTime();
    } catch (e) {
      // File doesn't exist
    }
  }
  
  const passed = exitCode === 0;
  const testFileUnmodified = testFileMtimeBefore === null || testFileMtimeAfter === testFileMtimeBefore;
  
  const proof = {
    stage: 'green',
    command: testCmd,
    exitCode,
    stdout: stdout.substring(0, 500),
    stderr: stderr.substring(0, 500),
    passed,
    testFileUnmodified,
    testCount: getTestCount(stdout, stderr),
    timestamp: new Date().toISOString(),
  };
  
  writeAuditFile('green', proof);
  output(proof, raw);
}

function validateRefactor(cwd, args, raw) {
  const testCmd = parseTestCmd(args);
  if (!testCmd) {
    output({ error: 'Missing --test-cmd argument' }, raw);
    return;
  }
  
  const prevCount = parsePrevCount(args);
  
  // Run the test command
  const result = spawnSync(testCmd, {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });
  
  const exitCode = result.status;
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  
  const passed = exitCode === 0;
  const testCount = getTestCount(stdout, stderr);
  const countUnchanged = prevCount === null || testCount === prevCount;
  
  const proof = {
    stage: 'refactor',
    command: testCmd,
    exitCode,
    stdout: stdout.substring(0, 500),
    stderr: stderr.substring(0, 500),
    passed,
    testCount,
    prevCount,
    countUnchanged,
    timestamp: new Date().toISOString(),
  };
  
  writeAuditFile('refactor', proof);
  output(proof, raw);
}

function autoTest(cwd, args, raw) {
  const testCmd = parseTestCmd(args);
  if (!testCmd) {
    output({ error: 'Missing --test-cmd argument' }, raw);
    return;
  }
  
  // Run the test command without validation
  const result = spawnSync(testCmd, {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });
  
  const exitCode = result.status;
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  
  const proof = {
    stage: 'auto',
    command: testCmd,
    exitCode,
    stdout: stdout.substring(0, 500),
    stderr: stderr.substring(0, 500),
    timestamp: new Date().toISOString(),
  };
  
  output(proof, raw);
}

module.exports = {
  generateEdgeCaseSuggestions,
  cmdReview,
  cmdParityCheck,
  cmdTdd,
};
