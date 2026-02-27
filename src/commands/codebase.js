'use strict';

const fs = require('fs');
const path = require('path');
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

  // Preserve conventions, dependencies, lifecycle from previous intel (populated by separate commands)
  if (previousIntel) {
    if (previousIntel.conventions && !intel.conventions) intel.conventions = previousIntel.conventions;
    if (previousIntel.dependencies && !intel.dependencies) intel.dependencies = previousIntel.dependencies;
    if (previousIntel.lifecycle && !intel.lifecycle) intel.lifecycle = previousIntel.lifecycle;
  }

  writeIntel(cwd, intel);

  const durationMs = Date.now() - startMs;
  const filesAnalyzed = mode === 'incremental' && changedFiles
    ? changedFiles.length
    : intel.stats.total_files;

  // Clean up lock file after analysis completes (background or foreground)
  try { fs.unlinkSync(path.join(cwd, '.planning', '.cache', '.analyzing')); } catch { /* ignore */ }

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
 * spawnBackgroundAnalysis — Spawn a detached child process to run codebase analysis.
 *
 * Uses a lock file (.planning/.cache/.analyzing) to prevent concurrent triggers.
 * Lock file auto-expires after 5 minutes (stale lock cleanup).
 * Never throws — all errors are caught and logged.
 *
 * @param {string} cwd - Project root
 */
function spawnBackgroundAnalysis(cwd) {
  try {
    const lockPath = path.join(cwd, '.planning', '.cache', '.analyzing');

    // Check lock file — skip if already running
    try {
      const lockStat = fs.statSync(lockPath);
      const lockAgeMs = Date.now() - lockStat.mtimeMs;
      const LOCK_TIMEOUT = 5 * 60 * 1000; // 5 minutes
      if (lockAgeMs < LOCK_TIMEOUT) {
        debugLog('codebase.bgAnalysis', 'lock file exists, skipping');
        return;
      }
      // Lock is stale — clean up and proceed
      debugLog('codebase.bgAnalysis', 'stale lock detected, cleaning up');
      fs.unlinkSync(lockPath);
    } catch (e) {
      if (e.code !== 'ENOENT') {
        debugLog('codebase.bgAnalysis', 'lock check error', e);
        return;
      }
    }

    // Ensure .cache directory exists
    const cacheDir = path.join(cwd, '.planning', '.cache');
    try { fs.mkdirSync(cacheDir, { recursive: true }); } catch { /* ignore */ }

    // Create lock file
    try { fs.writeFileSync(lockPath, String(process.pid)); } catch { return; }

    // Spawn detached analysis
    try {
      const { spawn } = require('child_process');
      const gsdBin = path.resolve(__dirname, '../../bin/gsd-tools.cjs');
      const child = spawn(process.execPath, [gsdBin, 'codebase', 'analyze', '--raw'], {
        cwd,
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, GSD_BG_ANALYSIS: '1' },
      });
      child.unref();
      debugLog('codebase.bgAnalysis', `spawned background analysis (pid: ${child.pid})`);
    } catch (e) {
      debugLog('codebase.bgAnalysis', 'spawn failed', e);
      // Clean up lock on spawn failure
      try { fs.unlinkSync(lockPath); } catch { /* ignore */ }
    }
  } catch (e) {
    debugLog('codebase.bgAnalysis', 'unexpected error', e);
  }
}


/**
 * autoTriggerCodebaseIntel — Auto-trigger function for init command integration.
 *
 * Behavior:
 * - If no .planning/ dir: return null
 * - If no existing intel: return null (first run requires explicit `codebase analyze`)
 * - If fresh: return existing intel
 * - If stale + synchronous mode (--refresh): run full analysis, write, return new intel
 * - If stale + non-blocking (default): return stale data immediately, spawn background analysis
 * - Never crashes (wrapped in try/catch)
 *
 * @param {string} cwd - Project root
 * @param {{ synchronous?: boolean }} [options] - Options
 * @returns {object|null} Intel data or null
 */
function autoTriggerCodebaseIntel(cwd, options) {
  const opts = options || {};
  const synchronous = opts.synchronous || false;
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

    if (synchronous) {
      // --refresh mode: block and run full analysis
      debugLog('codebase.autoTrigger', `stale (${staleness.reason}), running synchronous analysis (--refresh)`);

      const newIntel = performAnalysis(cwd, {
        incremental: !!(staleness.changed_files && staleness.changed_files.length > 0),
        previousIntel: intel,
        changedFiles: staleness.changed_files || null,
      });

      // Preserve conventions, dependencies, lifecycle from previous intel (populated by separate commands)
      if (intel.conventions && !newIntel.conventions) {
        newIntel.conventions = intel.conventions;
      }
      if (intel.dependencies && !newIntel.dependencies) {
        newIntel.dependencies = intel.dependencies;
      }
      if (intel.lifecycle && !newIntel.lifecycle) {
        newIntel.lifecycle = intel.lifecycle;
      }

      writeIntel(cwd, newIntel);
      return newIntel;
    }

    // Non-blocking: return stale data, spawn background analysis
    debugLog('codebase.autoTrigger', `stale (${staleness.reason}), returning cached + spawning background`);
    spawnBackgroundAnalysis(cwd);
    return intel; // Return existing (stale) data immediately
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

  output({
    success: true,
    rules: result.rules,
    rules_text: result.rules_text,
    rule_count: result.rule_count,
    total_conventions: result.total_conventions,
    filtered_count: result.filtered_count,
  }, raw, result.rules_text + '\n');
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

  const wantCycles = args.includes('--cycles');

  const { buildDependencyGraph, findCycles } = require('../lib/deps');

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

  const result = {
    success: true,
    stats: graph.stats,
    top_dependencies: topDeps,
    built_at: graph.built_at,
  };

  // Add cycle detection if requested
  if (wantCycles) {
    result.cycles = findCycles(graph);
  }

  output(result, raw);
}


/**
 * cmdCodebaseImpact — Show transitive dependents for given files using dependency graph.
 *
 * Uses getTransitiveDependents for BFS traversal of reverse edges.
 * Auto-builds dependency graph if not present in intel.
 *
 * @param {string} cwd - Project root
 * @param {string[]} args - CLI arguments (file paths, after 'codebase impact')
 * @param {boolean} raw - Raw JSON output mode
 */
function cmdCodebaseImpact(cwd, args, raw) {
  const filePaths = args.filter(a => !a.startsWith('-'));

  if (!filePaths || filePaths.length === 0) {
    error('Usage: codebase impact <file1> [file2] ...');
    return;
  }

  const intel = readIntel(cwd);

  if (!intel) {
    error('No codebase intel. Run: codebase analyze');
    return;
  }

  const { buildDependencyGraph, getTransitiveDependents } = require('../lib/deps');

  // Auto-build graph if not present in intel
  let graph = intel.dependencies;
  if (!graph) {
    debugLog('codebase.impact', 'no dependency graph in intel, building...');
    graph = buildDependencyGraph(intel);
    intel.dependencies = graph;
    writeIntel(cwd, intel);
  }

  const files = [];
  for (const filePath of filePaths) {
    const result = getTransitiveDependents(graph, filePath);
    files.push(result);
  }

  output({
    success: true,
    files,
  }, raw);
}


/**
 * cmdCodebaseLifecycle — Build and display lifecycle analysis (execution order relationships).
 *
 * Detects migration ordering, framework-specific initialization patterns, and
 * produces DAG chains showing what must run before what.
 *
 * @param {string} cwd - Project root
 * @param {string[]} args - CLI arguments (after 'codebase lifecycle')
 * @param {boolean} raw - Raw JSON output mode
 */
function cmdCodebaseLifecycle(cwd, args, raw) {
  const intel = readIntel(cwd);

  if (!intel) {
    error('No codebase intel. Run: codebase analyze');
    return;
  }

  const { buildLifecycleGraph } = require('../lib/lifecycle');

  const lifecycle = buildLifecycleGraph(intel, cwd);

  // Cache in intel
  intel.lifecycle = lifecycle;
  writeIntel(cwd, intel);

  // Human-readable output (non-raw mode)
  if (!raw) {
    const lines = [];

    if (lifecycle.nodes.length === 0) {
      lines.push('No lifecycle patterns detected.');
    } else {
      lines.push(`Lifecycle Analysis (${lifecycle.nodes.length} nodes, ${lifecycle.chains.length} chains)`);
      lines.push('');

      for (let i = 0; i < lifecycle.chains.length; i++) {
        const chain = lifecycle.chains[i];
        const nodeMap = {};
        for (let n = 0; n < lifecycle.nodes.length; n++) {
          nodeMap[lifecycle.nodes[n].id] = lifecycle.nodes[n];
        }

        let chainStr;
        if (chain.length <= 5) {
          chainStr = chain.map(function(id) {
            var node = nodeMap[id];
            return node ? node.file_or_step : id;
          }).join(' → ');
        } else {
          // Show first 3, ..., last
          var first3 = chain.slice(0, 3).map(function(id) {
            var node = nodeMap[id];
            return node ? node.file_or_step : id;
          });
          var last = nodeMap[chain[chain.length - 1]];
          chainStr = first3.join(' → ') + ' → ... +' + (chain.length - 4) + ' more → ' + (last ? last.file_or_step : chain[chain.length - 1]);
        }

        lines.push('  Chain ' + (i + 1) + ': ' + chainStr);
      }

      if (lifecycle.cycles.length > 0) {
        lines.push('');
        lines.push('WARNING: ' + lifecycle.cycles.length + ' cycle(s) detected');
        for (let c = 0; c < lifecycle.cycles.length; c++) {
          lines.push('  Cycle: ' + lifecycle.cycles[c].join(' → '));
        }
      }
    }

    process.stderr.write(lines.join('\n') + '\n');
  }

  output({
    success: true,
    nodes: lifecycle.nodes.length,
    edges: lifecycle.stats.edge_count,
    chains: lifecycle.chains,
    cycles: lifecycle.cycles,
    detectors_used: lifecycle.detectors_used,
    stats: lifecycle.stats,
    built_at: lifecycle.built_at,
  }, raw);
}


// ─── Per-File Context Assembly (Phase 27) ───────────────────────────────────

/**
 * Score relevance of a file relative to target files.
 *
 * Weights (per CONTEXT.md locked decisions, NON-NEGOTIABLE):
 * - Graph distance (50%): 1-hop = +0.50, 2-hop = +0.25, 3+ = 0
 * - Plan scope (30%): file in plan's files_modified = +0.30
 * - Git recency (20%): file modified in last N commits = +0.20
 *
 * @param {string} file - File to score
 * @param {string[]} targetFiles - The files the user requested context for
 * @param {{ forward: object, reverse: object }} graph - Dependency graph
 * @param {string[]} planFiles - Files listed in current plan's files_modified
 * @param {Set<string>} recentFiles - Files modified in last N commits
 * @returns {number} Score between 0.0 and 1.0
 */
function scoreRelevance(file, targetFiles, graph, planFiles, recentFiles) {
  // Target files themselves always get 1.0
  if (targetFiles.includes(file)) return 1.0;

  let score = 0;

  // Graph distance (50% weight)
  let is1Hop = false;
  let is2Hop = false;

  for (const target of targetFiles) {
    // Check 1-hop: file is direct import or dependent of target
    const fwd = graph.forward[target] || [];
    const rev = graph.reverse[target] || [];
    if (fwd.includes(file) || rev.includes(file)) {
      is1Hop = true;
      break; // Short-circuit on first 1-hop match
    }
  }

  if (!is1Hop) {
    // Check 2-hop: for each target's 1-hop neighbors, is file in their forward/reverse?
    outer:
    for (const target of targetFiles) {
      const neighbors = [...(graph.forward[target] || []), ...(graph.reverse[target] || [])];
      for (const neighbor of neighbors) {
        const nFwd = graph.forward[neighbor] || [];
        const nRev = graph.reverse[neighbor] || [];
        if (nFwd.includes(file) || nRev.includes(file)) {
          is2Hop = true;
          break outer; // Short-circuit on first 2-hop match
        }
      }
    }
  }

  if (is1Hop) score += 0.50;
  else if (is2Hop) score += 0.25;

  // Plan scope (30% weight)
  if (planFiles.includes(file)) score += 0.30;

  // Git recency (20% weight)
  if (recentFiles.has(file)) score += 0.20;

  return score;
}

/**
 * Get set of files modified in the last N git commits.
 *
 * @param {string} cwd - Project root
 * @param {number} [commitCount=10] - Number of commits to check
 * @returns {Set<string>} Set of file paths modified recently
 */
function getRecentlyModifiedFiles(cwd, commitCount = 10) {
  const { execGit } = require('../lib/git');
  try {
    const result = execGit(cwd, ['log', `-${commitCount}`, '--name-only', '--pretty=format:', '--no-merges']);
    if (result.exitCode !== 0) return new Set();
    return new Set(result.stdout.split('\n').filter(f => f.trim().length > 0));
  } catch {
    return new Set();
  }
}

/**
 * Read plan frontmatter and extract files_modified list.
 *
 * @param {string} cwd - Project root
 * @param {string|null} planPath - Path to plan file (relative or absolute)
 * @returns {string[]} List of file paths from plan's files_modified, or []
 */
function getPlanFiles(cwd, planPath) {
  if (!planPath) return [];
  try {
    const { extractFrontmatter } = require('../lib/frontmatter');
    const resolved = path.resolve(cwd, planPath);
    const content = fs.readFileSync(resolved, 'utf-8');
    const fm = extractFrontmatter(content);
    if (Array.isArray(fm.files_modified)) return fm.files_modified;
    if (typeof fm.files_modified === 'string' && fm.files_modified.trim()) return [fm.files_modified];
  } catch (e) {
    debugLog('context.planFiles', 'read failed', e);
  }
  return [];
}

/**
 * Enforce token budget on context output with graceful degradation.
 *
 * Degradation order (per CONTEXT.md, applied to ALL files equally):
 * 1. Trim dependents to top 3
 * 2. Trim imports to top 3
 * 3. Remove conventions
 * 4. Remove imports and dependents (keep file + risk_level only)
 * 5. Last resort: drop lowest-scored files one by one
 *
 * @param {object} fileContexts - Map of file path → context object
 * @param {number} [maxTokens=5000] - Token budget cap
 * @returns {{ files: object, truncated: boolean, omitted_files: number }}
 */
function enforceTokenBudget(fileContexts, maxTokens = 5000) {
  const { estimateJsonTokens } = require('../lib/context');

  // Build full output wrapper for estimation
  const buildOutput = (files) => ({
    success: true,
    files,
    file_count: Object.keys(files).length,
    truncated: false,
  });

  // Check if full output fits
  let tokens = estimateJsonTokens(buildOutput(fileContexts));
  if (tokens <= maxTokens) {
    return { files: fileContexts, truncated: false, omitted_files: 0 };
  }

  // Deep clone to avoid mutating originals
  const cloned = JSON.parse(JSON.stringify(fileContexts));

  // Degradation levels — applied to ALL files equally (CONTEXT.md atomic rule)
  const levels = [
    // Level 1: Trim dependents to top 3
    (ctx) => { if (ctx.dependents) ctx.dependents = ctx.dependents.slice(0, 3); },
    // Level 2: Trim imports to top 3
    (ctx) => { if (ctx.imports) ctx.imports = ctx.imports.slice(0, 3); },
    // Level 3: Remove conventions
    (ctx) => { ctx.conventions = null; },
    // Level 4: Remove imports and dependents entirely (keep file + risk_level only)
    (ctx) => { ctx.imports = undefined; ctx.dependents = undefined; },
  ];

  for (const degrade of levels) {
    for (const key of Object.keys(cloned)) {
      degrade(cloned[key]);
    }
    tokens = estimateJsonTokens(buildOutput(cloned));
    if (tokens <= maxTokens) {
      return { files: cloned, truncated: true, omitted_files: 0 };
    }
  }

  // Last resort: drop lowest-scored files one by one
  const entries = Object.entries(cloned)
    .sort((a, b) => (b[1].relevance_score || 0) - (a[1].relevance_score || 0));

  const originalCount = entries.length;
  const kept = {};

  // Add files from highest score to lowest until budget is hit
  for (const [key, val] of entries) {
    kept[key] = val;
    tokens = estimateJsonTokens(buildOutput(kept));
    if (tokens > maxTokens && Object.keys(kept).length > 1) {
      delete kept[key];
      break;
    }
  }

  return {
    files: kept,
    truncated: true,
    omitted_files: originalCount - Object.keys(kept).length,
  };
}

/**
 * Compute risk level for a file based on fan-in and cycle membership.
 *
 * @param {string} file - File path
 * @param {{ forward: object, reverse: object }} graph - Dependency graph
 * @param {Set<string>} cycleFiles - Set of files involved in cycles
 * @returns {"high"|"caution"|"normal"}
 */
function computeRiskLevel(file, graph, cycleFiles) {
  const dependentCount = (graph.reverse[file] || []).length;
  if (dependentCount > 10) return 'high';
  if (cycleFiles.has(file)) return 'caution';
  return 'normal';
}

/**
 * Match conventions applicable to a specific file.
 *
 * Returns naming pattern (by directory first, fallback to overall) and
 * matching framework patterns based on file extension/path.
 *
 * @param {string} file - File path
 * @param {object|null} conventions - Conventions data from intel
 * @returns {{ naming: { pattern: string, confidence: number }|null, frameworks: object[] }|null}
 */
function matchFileConventions(file, conventions) {
  if (!conventions) return null;

  const dir = path.dirname(file);
  const ext = path.extname(file);
  let naming = null;

  // Check directory-specific naming first
  if (conventions.naming && conventions.naming.by_directory && conventions.naming.by_directory[dir]) {
    const dirConv = conventions.naming.by_directory[dir];
    naming = { pattern: dirConv.dominant_pattern, confidence: dirConv.confidence };
  }
  // Fall back to overall naming
  else if (conventions.naming && conventions.naming.overall) {
    // Find the dominant overall pattern (highest confidence)
    let best = null;
    let bestConf = 0;
    for (const [, value] of Object.entries(conventions.naming.overall)) {
      if (value.confidence > bestConf) {
        bestConf = value.confidence;
        best = value.pattern;
      }
    }
    if (best) {
      naming = { pattern: best, confidence: bestConf };
    }
  }

  // Match framework patterns by file extension/path
  const matchingFrameworks = [];
  if (conventions.frameworks && Array.isArray(conventions.frameworks)) {
    for (const fw of conventions.frameworks) {
      // Match by evidence (file paths) or by extension relevance
      if (fw.evidence && Array.isArray(fw.evidence)) {
        const matches = fw.evidence.some(e => {
          // Check if evidence file shares extension or directory with target
          if (e.endsWith('/')) {
            // Directory evidence: check if file is under this dir
            return file.startsWith(e) || dir.startsWith(e.replace(/\/$/, ''));
          }
          return path.extname(e) === ext || path.dirname(e) === dir;
        });
        if (matches) {
          matchingFrameworks.push({
            framework: fw.framework,
            pattern: fw.pattern,
            confidence: fw.confidence,
          });
        }
      }
    }
  }

  if (!naming && matchingFrameworks.length === 0) return null;

  return { naming, frameworks: matchingFrameworks };
}

/**
 * cmdCodebaseContext — Assemble per-file architectural context from cached intel.
 *
 * Returns 1-hop imports/dependents, convention info, risk level, and relevance
 * scores for each requested file. Enforces 5K token budget with graceful degradation.
 *
 * Flags:
 *   --files <file1> [file2] ...  Target file paths
 *   --plan <path>                Plan file for scope signal (reads files_modified)
 *
 * @param {string} cwd - Project root
 * @param {string[]} args - CLI arguments (after 'codebase context')
 * @param {boolean} raw - Raw JSON output mode
 */
function cmdCodebaseContext(cwd, args, raw) {
  // Parse --files flag: collect all args after --files until next flag
  const filesIdx = args.indexOf('--files');
  let filePaths = [];

  if (filesIdx !== -1) {
    for (let i = filesIdx + 1; i < args.length; i++) {
      if (args[i].startsWith('--')) break;
      filePaths.push(args[i]);
    }
  } else {
    // No --files flag: treat all non-flag args as file paths
    filePaths = args.filter(a => !a.startsWith('--'));
  }

  // Parse optional --plan flag for plan-scope scoring signal
  const planIdx = args.indexOf('--plan');
  const planPath = planIdx !== -1 ? args[planIdx + 1] : null;

  if (!filePaths.length) {
    error('Usage: codebase context --files <file1> [file2] ...');
    return;
  }

  const intel = readIntel(cwd);
  if (!intel) {
    error('No codebase intel. Run: codebase analyze');
    return;
  }

  const { buildDependencyGraph, findCycles } = require('../lib/deps');
  const { extractConventions } = require('../lib/conventions');

  // Auto-build dependency graph if missing
  let graph = intel.dependencies;
  if (!graph) {
    debugLog('codebase.context', 'no dependency graph in intel, building...');
    graph = buildDependencyGraph(intel);
    intel.dependencies = graph;
    writeIntel(cwd, intel);
  }

  // Auto-extract conventions if missing
  let conventions = intel.conventions;
  if (!conventions) {
    debugLog('codebase.context', 'no conventions in intel, extracting...');
    conventions = extractConventions(intel, { cwd });
    intel.conventions = conventions;
    writeIntel(cwd, intel);
  }

  // Get cycle data for risk assessment
  const cycleData = findCycles(graph);
  const cycleFiles = new Set();
  for (const scc of cycleData.cycles) {
    for (const f of scc) cycleFiles.add(f);
  }

  // Get scoring signals
  const planFiles = getPlanFiles(cwd, planPath);
  const recentFiles = getRecentlyModifiedFiles(cwd);

  // Assemble per-file context
  const filesResult = {};

  for (const file of filePaths) {
    // Check if file exists in graph
    if (!graph.forward[file] && !graph.reverse[file]) {
      filesResult[file] = {
        status: 'no-data',
        imports: [],
        dependents: [],
        conventions: null,
        risk_level: 'normal',
        relevance_score: scoreRelevance(file, filePaths, graph, planFiles, recentFiles),
      };
      continue;
    }

    // 1-hop imports, sorted by fan-in (most-imported first), capped at 8
    const imports = [...(graph.forward[file] || [])];
    imports.sort((a, b) => {
      const scoreA = scoreRelevance(a, filePaths, graph, planFiles, recentFiles);
      const scoreB = scoreRelevance(b, filePaths, graph, planFiles, recentFiles);
      if (scoreB !== scoreA) return scoreB - scoreA;
      // Tiebreaker: fan-in count
      return (graph.reverse[b] || []).length - (graph.reverse[a] || []).length;
    });
    const cappedImports = imports.slice(0, 8);

    // 1-hop dependents, sorted by relevance score first, fan-out as tiebreaker, capped at 8
    const dependents = [...(graph.reverse[file] || [])];
    dependents.sort((a, b) => {
      const scoreA = scoreRelevance(a, filePaths, graph, planFiles, recentFiles);
      const scoreB = scoreRelevance(b, filePaths, graph, planFiles, recentFiles);
      if (scoreB !== scoreA) return scoreB - scoreA;
      // Tiebreaker: fan-out count
      return (graph.forward[b] || []).length - (graph.forward[a] || []).length;
    });
    const cappedDependents = dependents.slice(0, 8);

    // Risk level
    const riskLevel = computeRiskLevel(file, graph, cycleFiles);

    // Convention matching
    const fileConventions = matchFileConventions(file, conventions);

    // Relevance score for this file
    const relevanceScore = scoreRelevance(file, filePaths, graph, planFiles, recentFiles);

    filesResult[file] = {
      imports: cappedImports,
      dependents: cappedDependents,
      conventions: fileConventions,
      risk_level: riskLevel,
      relevance_score: relevanceScore,
    };
  }

  // Enforce token budget (5K cap with graceful degradation)
  const budgetResult = enforceTokenBudget(filesResult);

  const result = {
    success: true,
    files: budgetResult.files,
    file_count: filePaths.length,
    truncated: budgetResult.truncated,
    omitted_files: budgetResult.omitted_files,
  };

  if (raw) {
    output(result, raw);
  } else {
    // Human-readable table output
    const lines = [];
    lines.push('');
    lines.push('File Context Summary');
    lines.push('═'.repeat(80));
    lines.push('');

    for (const [file, ctx] of Object.entries(budgetResult.files)) {
      if (ctx.status === 'no-data') {
        lines.push(`  ${file}  [no data]`);
        lines.push('');
        continue;
      }

      const riskBadge = ctx.risk_level === 'high' ? '🔴 HIGH'
        : ctx.risk_level === 'caution' ? '🟡 CAUTION'
        : '🟢 normal';
      const namingStr = ctx.conventions && ctx.conventions.naming
        ? `${ctx.conventions.naming.pattern} (${ctx.conventions.naming.confidence}%)`
        : '-';
      const scoreStr = ctx.relevance_score !== undefined
        ? ` | Score: ${ctx.relevance_score.toFixed(2)}`
        : '';

      lines.push(`  ${file}`);
      lines.push(`    Risk: ${riskBadge}  |  Naming: ${namingStr}${scoreStr}`);

      if (ctx.imports) {
        lines.push(`    Imports (${ctx.imports.length}): ${ctx.imports.length > 0 ? ctx.imports.join(', ') : 'none'}`);
      }
      if (ctx.dependents) {
        lines.push(`    Dependents (${ctx.dependents.length}): ${ctx.dependents.length > 0 ? ctx.dependents.join(', ') : 'none'}`);
      }

      if (ctx.conventions && ctx.conventions.frameworks && ctx.conventions.frameworks.length > 0) {
        lines.push(`    Frameworks: ${ctx.conventions.frameworks.map(f => f.framework).join(', ')}`);
      }
      lines.push('');
    }

    if (budgetResult.truncated) {
      lines.push(`  ⚠ Output truncated to fit 5K token budget (${budgetResult.omitted_files} files omitted)`);
      lines.push('');
    }

    process.stderr.write(lines.join('\n') + '\n');
    output(result, false);
  }
}


module.exports = {
  cmdCodebaseAnalyze,
  cmdCodebaseStatus,
  cmdCodebaseConventions,
  cmdCodebaseRules,
  cmdCodebaseDeps,
  cmdCodebaseImpact,
  cmdCodebaseLifecycle,
  cmdCodebaseContext,
  readCodebaseIntel,
  checkCodebaseIntelStaleness,
  autoTriggerCodebaseIntel,
  spawnBackgroundAnalysis,
  // Exported for testing (Plan 02)
  scoreRelevance,
  getRecentlyModifiedFiles,
  getPlanFiles,
  enforceTokenBudget,
  computeRiskLevel,
  matchFileConventions,
};
