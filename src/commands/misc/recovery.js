'use strict';

const fs = require('fs');
const path = require('path');
const { output, error, debugLog } = require('../../lib/output');
const { safeReadFile, cachedReadFile, findPhaseInternal } = require('../../lib/helpers');
const { structuredLog, diffSummary } = require('../../lib/git');

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
  const { output } = require('../../lib/output');

  // Handle TDD subcommands
  if (subcommand === 'audit') {
    output({ message: 'TDD audit not yet implemented', subcommand }, raw);
    return;
  }
  if (subcommand === 'proof') {
    output({ message: 'TDD proof not yet implemented', subcommand }, raw);
    return;
  }

  output({ message: 'TDD command not yet implemented', subcommand, args: parsedArgs }, raw);
}

module.exports = {
  generateEdgeCaseSuggestions,
  cmdReview,
  cmdParityCheck,
  cmdTdd,
};
