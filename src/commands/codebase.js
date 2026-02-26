'use strict';

const { output, error, debugLog } = require('../lib/output');
const {
  checkStaleness,
  performAnalysis,
  readIntel,
  writeIntel,
  getGitInfo,
  getChangedFilesSinceCommit,
} = require('../lib/codebase-intel');


/**
 * cmdCodebaseAnalyze — Run codebase analysis (full or incremental).
 *
 * Flags:
 *   --full  Force full analysis even if incremental is possible
 *
 * @param {string} cwd - Project root
 * @param {string[]} args - CLI arguments (after 'codebase analyze')
 * @param {boolean} raw - Raw JSON output mode
 */
function cmdCodebaseAnalyze(cwd, args, raw) {
  const forceFull = args.includes('--full');
  const startMs = Date.now();

  let mode = 'full';
  let previousIntel = null;
  let changedFiles = null;

  // Check if incremental is possible
  if (!forceFull) {
    previousIntel = readIntel(cwd);
    if (previousIntel) {
      const staleness = checkStaleness(cwd);
      if (staleness.stale && staleness.changed_files && staleness.changed_files.length > 0) {
        mode = 'incremental';
        changedFiles = staleness.changed_files;
        debugLog('codebase.analyze', `incremental mode: ${changedFiles.length} changed files`);
      } else if (!staleness.stale) {
        // Already fresh — return existing intel info
        const durationMs = Date.now() - startMs;
        output({
          success: true,
          mode: 'cached',
          files_analyzed: 0,
          total_files: previousIntel.stats.total_files,
          languages: Object.keys(previousIntel.languages),
          duration_ms: durationMs,
          path: '.planning/codebase/codebase-intel.json',
        }, raw);
        return;
      }
      // If stale but no changed_files (commit_missing, etc.), do full analysis
    }
  }

  debugLog('codebase.analyze', `analyzing in ${mode} mode...`);

  const intel = performAnalysis(cwd, {
    incremental: mode === 'incremental',
    previousIntel,
    changedFiles,
  });

  writeIntel(cwd, intel);

  const durationMs = Date.now() - startMs;
  const filesAnalyzed = mode === 'incremental' && changedFiles
    ? changedFiles.length
    : intel.stats.total_files;

  output({
    success: true,
    mode,
    files_analyzed: filesAnalyzed,
    total_files: intel.stats.total_files,
    languages: Object.keys(intel.languages),
    duration_ms: durationMs,
    path: '.planning/codebase/codebase-intel.json',
  }, raw);
}


/**
 * cmdCodebaseStatus — Report codebase intel status (exists, fresh/stale, details).
 *
 * @param {string} cwd - Project root
 * @param {string[]} args - CLI arguments (after 'codebase status')
 * @param {boolean} raw - Raw JSON output mode
 */
function cmdCodebaseStatus(cwd, args, raw) {
  const intel = readIntel(cwd);

  if (!intel) {
    output({
      exists: false,
      message: 'No codebase intel. Run: codebase analyze',
    }, raw);
    return;
  }

  const staleness = checkStaleness(cwd);
  const gitInfo = getGitInfo(cwd);

  if (staleness.stale) {
    // Group changed files by type if available
    let changedGroups = null;
    if (staleness.changed_files && staleness.changed_files.length > 0 && intel.git_commit_hash) {
      changedGroups = groupChangedFiles(cwd, intel.git_commit_hash, staleness.changed_files);
    }

    output({
      exists: true,
      stale: true,
      reason: staleness.reason,
      changed_files: staleness.changed_files || [],
      changed_groups: changedGroups,
      intel_commit: intel.git_commit_hash,
      current_commit: gitInfo.commit_hash,
      generated_at: intel.generated_at,
    }, raw);
  } else {
    output({
      exists: true,
      stale: false,
      generated_at: intel.generated_at,
      git_commit_hash: intel.git_commit_hash,
      total_files: intel.stats.total_files,
      total_lines: intel.stats.total_lines,
      languages: Object.keys(intel.languages),
      languages_detected: intel.stats.languages_detected,
    }, raw);
  }
}


/**
 * Group changed files by type (added/modified/deleted) using git diff-filter.
 *
 * @param {string} cwd - Project root
 * @param {string} fromCommit - Base commit hash
 * @param {string[]} changedFiles - List of changed files
 * @returns {{ added: string[], modified: string[], deleted: string[] }|null}
 */
function groupChangedFiles(cwd, fromCommit, changedFiles) {
  const { execGit } = require('../lib/git');

  const addedResult = execGit(cwd, ['diff', '--name-only', '--diff-filter=A', fromCommit, 'HEAD']);
  const modifiedResult = execGit(cwd, ['diff', '--name-only', '--diff-filter=M', fromCommit, 'HEAD']);
  const deletedResult = execGit(cwd, ['diff', '--name-only', '--diff-filter=D', fromCommit, 'HEAD']);

  const parse = (result) => {
    if (result.exitCode !== 0) return [];
    return result.stdout.split('\n').filter(f => f.trim().length > 0);
  };

  const added = parse(addedResult);
  const modified = parse(modifiedResult);
  const deleted = parse(deletedResult);

  // Only return if we got meaningful data
  if (added.length === 0 && modified.length === 0 && deleted.length === 0) {
    return null;
  }

  return { added, modified, deleted };
}


/**
 * autoTriggerCodebaseIntel — Auto-trigger function for init command integration.
 * Plan 02 will wire this into init commands.
 *
 * Behavior:
 * - If no .planning/ dir: return null
 * - If no existing intel: return null (first run requires explicit `codebase analyze`)
 * - If fresh: return existing intel
 * - If stale: run incremental analysis, write results, return new intel
 * - Never crashes (wrapped in try/catch)
 *
 * @param {string} cwd - Project root
 * @returns {object|null} Intel data or null
 */
function autoTriggerCodebaseIntel(cwd) {
  const fs = require('fs');
  const path = require('path');
  const planningDir = path.join(cwd, '.planning');

  if (!fs.existsSync(planningDir)) return null;

  const intel = readIntel(cwd);
  if (!intel) {
    debugLog('codebase.autoTrigger', 'no existing intel, skipping (first run needs explicit analyze)');
    return null;
  }

  try {
    const staleness = checkStaleness(cwd);
    if (!staleness.stale) {
      debugLog('codebase.autoTrigger', 'intel is fresh');
      return intel;
    }

    debugLog('codebase.autoTrigger', `stale (${staleness.reason}), running incremental analysis`);

    const newIntel = performAnalysis(cwd, {
      incremental: !!(staleness.changed_files && staleness.changed_files.length > 0),
      previousIntel: intel,
      changedFiles: staleness.changed_files || null,
    });

    writeIntel(cwd, newIntel);
    return newIntel;
  } catch (e) {
    debugLog('codebase.autoTrigger', `analysis failed: ${e.message}`);
    return intel; // Return stale data rather than nothing
  }
}


/**
 * readCodebaseIntel — Public read accessor for other commands.
 *
 * @param {string} cwd - Project root
 * @returns {object|null} Parsed intel or null
 */
function readCodebaseIntel(cwd) {
  return readIntel(cwd);
}

/**
 * checkCodebaseIntelStaleness — Public staleness check for other commands.
 *
 * @param {string} cwd - Project root
 * @returns {{ stale: boolean, reason?: string, changed_files?: string[] }}
 */
function checkCodebaseIntelStaleness(cwd) {
  return checkStaleness(cwd);
}


/**
 * cmdCodebaseConventions — Extract and display coding conventions from codebase intel.
 *
 * Flags:
 *   --all         Show all patterns including below-threshold
 *   --threshold N Override default confidence threshold (default: 60)
 *   --json        Alias for --raw (raw JSON output)
 *
 * @param {string} cwd - Project root
 * @param {string[]} args - CLI arguments (after 'codebase conventions')
 * @param {boolean} raw - Raw JSON output mode
 */
function cmdCodebaseConventions(cwd, args, raw) {
  const intel = readIntel(cwd);

  if (!intel) {
    error('No codebase intel. Run: codebase analyze');
    return;
  }

  const { extractConventions } = require('../lib/conventions');

  const showAll = args.includes('--all');
  const thresholdIdx = args.indexOf('--threshold');
  const threshold = thresholdIdx !== -1 ? parseInt(args[thresholdIdx + 1], 10) : 60;

  const conventions = extractConventions(intel, { threshold, showAll, cwd });

  // Persist conventions in intel for reuse by other commands
  intel.conventions = conventions;
  writeIntel(cwd, intel);

  // Build structured output
  const namingPatterns = [];

  // Add overall naming patterns
  for (const [, value] of Object.entries(conventions.naming.overall || {})) {
    namingPatterns.push({
      scope: 'project',
      pattern: value.pattern,
      confidence: value.confidence,
      file_count: value.file_count,
      examples: value.examples,
    });
  }

  // Add per-directory naming patterns
  for (const [dir, value] of Object.entries(conventions.naming.by_directory || {})) {
    namingPatterns.push({
      scope: dir,
      pattern: value.dominant_pattern,
      confidence: value.confidence,
      file_count: value.file_count,
      examples: value.patterns[value.dominant_pattern]
        ? value.patterns[value.dominant_pattern].examples
        : [],
    });
  }

  const frameworkPatterns = conventions.frameworks || [];

  output({
    success: true,
    naming_patterns: namingPatterns,
    file_organization: conventions.file_organization,
    framework_patterns: frameworkPatterns,
    total_conventions: namingPatterns.length + (conventions.file_organization.patterns || []).length + frameworkPatterns.length,
    threshold_used: threshold,
    show_all: showAll,
    extracted_at: conventions.extracted_at,
  }, raw);
}


/**
 * cmdCodebaseRules — Generate an agent-consumable rules document from codebase conventions.
 *
 * Flags:
 *   --threshold N  Override minimum confidence (default: 60)
 *   --max N        Override maximum rules cap (default: 15)
 *
 * If --raw is set, outputs just the rules_text (plain text for direct prompt injection).
 * Otherwise, outputs structured JSON with rules, rules_text, rule_count.
 *
 * @param {string} cwd - Project root
 * @param {string[]} args - CLI arguments (after 'codebase rules')
 * @param {boolean} raw - Raw output mode
 */
function cmdCodebaseRules(cwd, args, raw) {
  const intel = readIntel(cwd);

  if (!intel) {
    error('No codebase intel. Run: codebase analyze');
    return;
  }

  const { extractConventions, generateRules } = require('../lib/conventions');

  // If intel has no conventions, run extraction first (auto-detect on demand)
  let conventions = intel.conventions;
  if (!conventions) {
    debugLog('codebase.rules', 'no cached conventions, running extraction');
    conventions = extractConventions(intel, { cwd });
    intel.conventions = conventions;
    writeIntel(cwd, intel);
  }

  // Parse flags
  const thresholdIdx = args.indexOf('--threshold');
  const threshold = thresholdIdx !== -1 ? parseInt(args[thresholdIdx + 1], 10) : 60;
  const maxIdx = args.indexOf('--max');
  const maxRules = maxIdx !== -1 ? parseInt(args[maxIdx + 1], 10) : 15;

  const result = generateRules(conventions, { threshold, maxRules });

  if (raw) {
    // Raw mode: output just the plain text rules for prompt injection
    process.stdout.write(result.rules_text + '\n');
    return;
  }

  output({
    success: true,
    rules: result.rules,
    rules_text: result.rules_text,
    rule_count: result.rule_count,
    total_conventions: result.total_conventions,
    filtered_count: result.filtered_count,
  }, false);
}


/**
 * cmdCodebaseDeps — Build module dependency graph from import/require/use statements.
 *
 * Parses imports for all source files in intel, builds forward + reverse adjacency lists,
 * stores result in codebase-intel.json, and reports statistics.
 *
 * Flags:
 *   --cycles  (stub — Plan 02 adds Tarjan's SCC cycle detection)
 *
 * @param {string} cwd - Project root
 * @param {string[]} args - CLI arguments (after 'codebase deps')
 * @param {boolean} raw - Raw JSON output mode
 */
function cmdCodebaseDeps(cwd, args, raw) {
  const intel = readIntel(cwd);

  if (!intel) {
    error('No codebase intel. Run: codebase analyze');
    return;
  }

  // --cycles flag stub: Plan 02 will implement Tarjan's SCC cycle detection
  const wantCycles = args.includes('--cycles');
  if (wantCycles) {
    error('Cycle detection not yet implemented. Coming in Plan 02.');
    return;
  }

  const { buildDependencyGraph } = require('../lib/deps');

  // Build the dependency graph
  const graph = buildDependencyGraph(intel);

  // Persist graph in intel
  intel.dependencies = graph;
  writeIntel(cwd, intel);

  // Compute top dependencies (files with highest fan-in / reverse-edge count)
  const topDeps = Object.entries(graph.reverse)
    .map(([file, importers]) => ({ file, imported_by_count: importers.length }))
    .sort((a, b) => b.imported_by_count - a.imported_by_count)
    .slice(0, 10);

  output({
    success: true,
    stats: graph.stats,
    top_dependencies: topDeps,
    built_at: graph.built_at,
  }, raw);
}


module.exports = {
  cmdCodebaseAnalyze,
  cmdCodebaseStatus,
  cmdCodebaseConventions,
  cmdCodebaseRules,
  cmdCodebaseDeps,
  readCodebaseIntel,
  checkCodebaseIntelStaleness,
  autoTriggerCodebaseIntel,
};
