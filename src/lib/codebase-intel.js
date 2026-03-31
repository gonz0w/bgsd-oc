'use strict';

const fs = require('fs');
const path = require('path');
const { debugLog } = require('./output');
const { execGit } = require('./git');
const { cachedReadFile } = require('./helpers');
const { getEffectiveIntent } = require('../commands/intent');
const {
  LANGUAGE_MAP,
  SKIP_DIRS,
  BINARY_EXTENSIONS,
  getSourceDirs: adapterGetSourceDirs,
  walkSourceFiles: adapterWalkSourceFiles,
} = require('./adapters/discovery');
const { transformJson } = require('./cli-tools');

// ─── Constants ───────────────────────────────────────────────────────────────

/** Return the path to codebase-intel.json for a given project root */
function INTEL_PATH(cwd) {
  return path.join(cwd, '.planning', 'codebase', 'codebase-intel.json');
}

function getDiscoveryOptions() {
  return {
    mode: process.env.BGSD_DISCOVERY_MODE === 'legacy' ? 'legacy' : 'optimized',
    shadowCompare: process.env.BGSD_DISCOVERY_SHADOW === '1',
  };
}


// ─── Source Directory Detection ──────────────────────────────────────────────

/**
 * Auto-detect source directories by walking top-level entries.
 * Returns directories that contain source files (or are known source dirs).
 * Respects .gitignore via `git check-ignore`.
 *
 * @param {string} cwd - Project root
 * @returns {string[]} Array of relative directory paths (e.g., ['src/', 'lib/'])
 */
function getSourceDirs(cwd) {
  return adapterGetSourceDirs(cwd, getDiscoveryOptions());
}


// ─── File Walking ────────────────────────────────────────────────────────────

/**
 * Recursively walk source directories, collecting file paths.
 * Skips SKIP_DIRS and binary files.
 *
 * @param {string} cwd - Project root
 * @param {string[]} sourceDirs - Directories to walk (relative to cwd)
 * @param {Set<string>} skipDirs - Directory names to skip
 * @returns {string[]} Array of file paths relative to cwd
 */
function walkSourceFiles(cwd, sourceDirs, skipDirs) {
  const opts = getDiscoveryOptions();
  return adapterWalkSourceFiles(cwd, sourceDirs, skipDirs || SKIP_DIRS, opts);
}


// ─── File Analysis ───────────────────────────────────────────────────────────

/**
 * Analyze a single file: detect language, count lines, get size and mtime.
 *
 * @param {string} filePath - Absolute path to the file
 * @returns {{ language: string|null, size_bytes: number, lines: number, last_modified: string }}
 */
function analyzeFile(filePath) {
  const ext = path.extname(filePath);
  const language = LANGUAGE_MAP[ext] || null;

  let stat;
  let lines = 0;
  let size_bytes = 0;
  try {
    // Read file first, then fstat the same fd to avoid TOCTOU race
    const fd = fs.openSync(filePath, 'r');
    try {
      stat = fs.fstatSync(fd);
      const content = fs.readFileSync(fd);
      size_bytes = content.length;
      // Count newlines in buffer for performance
      for (let i = 0; i < content.length; i++) {
        if (content[i] === 0x0a) lines++;
      }
      // If file doesn't end with newline but has content, count final line
      if (content.length > 0 && content[content.length - 1] !== 0x0a) {
        lines++;
      }
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return { language, size_bytes: 0, lines: 0, last_modified: null };
  }

  return {
    language,
    size_bytes,
    lines,
    last_modified: stat.mtime.toISOString(),
  };
}


// ─── Git Info ────────────────────────────────────────────────────────────────

/**
 * Get current HEAD commit hash and branch name.
 *
 * @param {string} cwd - Project root
 * @returns {{ commit_hash: string|null, branch: string|null }}
 */
/** Module-level git info cache — avoids redundant git spawns per invocation */
let _gitInfoCache = null;
let _gitInfoCwd = null;

function getGitInfo(cwd) {
  // Return cached result if same cwd (single CLI invocation)
  if (_gitInfoCache && _gitInfoCwd === cwd) {
    return _gitInfoCache;
  }

  // Combine two rev-parse calls into one — saves ~7ms subprocess overhead
  const combinedResult = execGit(cwd, ['rev-parse', 'HEAD', '--abbrev-ref', 'HEAD']);
  let commit_hash = null;
  let branch = null;
  if (combinedResult.exitCode === 0 && combinedResult.stdout) {
    const lines = combinedResult.stdout.split('\n').filter(l => l.trim());
    if (lines.length >= 2) {
      commit_hash = lines[0].trim();
      branch = lines[1].trim();
    }
  }

  const result = { commit_hash, branch };
  _gitInfoCache = result;
  _gitInfoCwd = cwd;
  return result;
}

/**
 * Get files changed since a given commit hash.
 *
 * @param {string} cwd - Project root
 * @param {string} commitHash - Commit hash to diff from
 * @returns {string[]|null} Array of changed file paths, or null if error (signals full rescan)
 */
function getChangedFilesSinceCommit(cwd, commitHash) {
  if (!commitHash) return null;

  const result = execGit(cwd, ['diff', '--name-only', commitHash, 'HEAD']);
  if (result.exitCode !== 0) {
    debugLog('codebase.changedFiles', `git diff failed for ${commitHash}`);
    return null; // Commit no longer exists or other error — full rescan needed
  }

  const files = result.stdout.split('\n').filter(f => f.trim().length > 0);
  return files;
}


// ─── Staleness Detection ─────────────────────────────────────────────────────

/**
 * Check if existing codebase intel is stale.
 *
 * @param {string} cwd - Project root
 * @returns {{ stale: boolean, reason?: string, changed_files?: string[] }}
 */
function checkStaleness(cwd) {
  const intel = readIntel(cwd);

  if (!intel) {
    return { stale: true, reason: 'no_intel' };
  }

  // Strategy 1: Git-based staleness (preferred)
  if (intel.git_commit_hash) {
    // Check if HEAD matches stored hash
    const gitInfo = getGitInfo(cwd);
    if (gitInfo.commit_hash && gitInfo.commit_hash === intel.git_commit_hash) {
      // Strategy 1.5: Time-based staleness (hybrid — even if git says fresh)
      if (intel.generated_at) {
        const ageMs = Date.now() - new Date(intel.generated_at).getTime();
        const ONE_HOUR = 60 * 60 * 1000;
        if (ageMs > ONE_HOUR) {
          return { stale: true, reason: 'time_stale', changed_files: [] };
        }
      }
      return { stale: false };
    }

    // HEAD differs — get changed files
    const changedFiles = getChangedFilesSinceCommit(cwd, intel.git_commit_hash);
    if (changedFiles === null) {
      // Commit no longer exists (rebase, etc.) — full rescan needed
      return { stale: true, reason: 'commit_missing', changed_files: [] };
    }

    if (changedFiles.length > 0) {
      return { stale: true, reason: 'files_changed', changed_files: changedFiles };
    }

    // No files changed but HEAD differs (e.g., empty commits)
    return { stale: false };
  }

  // Strategy 2: Mtime-based fallback (non-git or missing hash)
  if (intel.generated_at) {
    const generatedTime = new Date(intel.generated_at).getTime();
    const sourceDirs = intel.source_dirs || getSourceDirs(cwd);
    const allFiles = walkSourceFiles(cwd, sourceDirs, SKIP_DIRS);
    const changedFiles = [];

    for (const file of allFiles) {
      try {
        const stat = fs.statSync(path.join(cwd, file));
        if (stat.mtimeMs > generatedTime) {
          changedFiles.push(file);
        }
      } catch {
        // File may have been deleted — count as changed
        changedFiles.push(file);
      }
    }

    if (changedFiles.length > 0) {
      return { stale: true, reason: 'mtime_newer', changed_files: changedFiles };
    }

    return { stale: false };
  }

  // No basis for staleness check — assume stale
  return { stale: true, reason: 'no_watermark' };
}


// ─── Analysis Engine ─────────────────────────────────────────────────────────

/**
 * Perform full or incremental codebase analysis.
 *
 * @param {string} cwd - Project root
 * @param {object} options
 * @param {boolean} [options.incremental=false] - Use incremental mode
 * @param {object} [options.previousIntel=null] - Previous intel for incremental mode
 * @param {string[]} [options.changedFiles=null] - Files to re-analyze in incremental mode
 * @returns {object} Complete intel JSON object
 */
function performAnalysis(cwd, options = {}) {
  const { incremental = false, previousIntel = null, changedFiles = null } = options;
  const startMs = Date.now();

  const gitInfo = getGitInfo(cwd);
  const sourceDirs = getSourceDirs(cwd);

  let fileEntries;

  if (incremental && previousIntel && changedFiles) {
    debugLog('codebase.analyze', `incremental: re-analyzing ${changedFiles.length} files`);

    // Start from previous file entries
    fileEntries = { ...previousIntel.files };

    // Remove deleted files (files in previous intel but not on disk)
    for (const filePath of Object.keys(fileEntries)) {
      try {
        fs.statSync(path.join(cwd, filePath));
      } catch {
        // File no longer exists
        delete fileEntries[filePath];
      }
    }

    // Re-analyze changed files
    for (const filePath of changedFiles) {
      const absPath = path.join(cwd, filePath);
      try {
        fs.statSync(absPath);
        const ext = path.extname(filePath);
        if (!BINARY_EXTENSIONS.has(ext)) {
          const result = analyzeFile(absPath);
          fileEntries[filePath] = result;
        }
      } catch {
        // Changed file no longer exists — already removed above
        delete fileEntries[filePath];
      }
    }
  } else {
    debugLog('codebase.analyze', 'full analysis');

    // Full analysis: walk all files
    const allFiles = walkSourceFiles(cwd, sourceDirs, SKIP_DIRS);
    fileEntries = {};

    for (const filePath of allFiles) {
      const absPath = path.join(cwd, filePath);
      const result = analyzeFile(absPath);
      fileEntries[filePath] = result;
    }
  }

  // Build language aggregates
  const languages = {};
  let totalLines = 0;
  let totalFiles = 0;

  for (const [filePath, info] of Object.entries(fileEntries)) {
    totalFiles++;
    totalLines += info.lines || 0;

    const lang = info.language;
    if (!lang) continue;

    if (!languages[lang]) {
      languages[lang] = { count: 0, extensions: new Set(), lines: 0 };
    }
    languages[lang].count++;
    languages[lang].lines += info.lines || 0;
    const ext = path.extname(filePath);
    if (ext) languages[lang].extensions.add(ext);
  }

  // Convert Sets to sorted arrays for JSON serialization
  for (const lang of Object.values(languages)) {
    lang.extensions = [...lang.extensions].sort();
  }

  const durationMs = Date.now() - startMs;

  // Generate agent contexts
  const baseIntel = {
    version: 1,
    generated_at: new Date().toISOString(),
    git_commit_hash: gitInfo.commit_hash,
    git_branch: gitInfo.branch,
    analysis_duration_ms: durationMs,
    source_dirs: sourceDirs,
    languages,
    files: fileEntries,
    stats: {
      total_files: totalFiles,
      total_lines: totalLines,
      languages_detected: Object.keys(languages).length,
    },
  };

  const agentContexts = generateAgentContexts(cwd, baseIntel);

  return {
    ...baseIntel,
    agent_contexts: agentContexts,
  };
}


// ─── Read / Write Intel ──────────────────────────────────────────────────────

/**
 * Read and parse codebase-intel.json.
 * Uses cachedReadFile for <10ms repeated reads.
 *
 * @param {string} cwd - Project root
 * @returns {object|null} Parsed intel or null if missing/invalid
 */
function readIntel(cwd) {
  const intelPath = INTEL_PATH(cwd);
  const content = cachedReadFile(intelPath);
  if (!content) return null;

  try {
    // For large intel files, use jq to quickly get file count before full parse
    // This is an optimization — the full JSON.parse still provides the actual data
    if (content.length > 100 * 1024) {
      const jqResult = transformJson(content, '.files | keys | length', { raw: true });
      if (jqResult.success && !jqResult.usedFallback) {
        debugLog('codebase.readIntel', `large intel: jq reports ${jqResult.result} files`);
      }
    }
    return JSON.parse(content);
  } catch (e) {
    debugLog('codebase.readIntel', 'JSON parse failed', e);
    return null;
  }
}

/**
 * Write intel JSON to .planning/codebase/codebase-intel.json.
 * Ensures directory exists.
 *
 * @param {string} cwd - Project root
 * @param {object} intel - Intel data to write
 */
function writeIntel(cwd, intel) {
  const intelPath = INTEL_PATH(cwd);
  const dir = path.dirname(intelPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(intelPath, JSON.stringify(intel, null, 2) + '\n');
  debugLog('codebase.writeIntel', `wrote ${intelPath}`);
}


// ─── Staleness Age Helper ────────────────────────────────────────────────────

/**
 * Get the age of codebase intel data for freshness flagging.
 * Returns age in milliseconds and commits behind HEAD.
 * Used by formatCodebaseContext in init.js for the codebase_freshness field.
 *
 * @param {object|null} intel - Codebase intel data
 * @param {string} [cwd] - Project root (for git commit counting)
 * @returns {{ age_ms: number, commits_behind: number }|null}
 */
function getStalenessAge(intel, cwd) {
  if (!intel || !intel.generated_at) return null;

  const ageMs = Date.now() - new Date(intel.generated_at).getTime();

  let commitsBehind = 0;
  if (cwd && intel.git_commit_hash) {
    // Fast path: if git HEAD matches intel commit, zero commits behind
    const gitInfo = getGitInfo(cwd); // Uses cached result — no git spawn
    if (gitInfo.commit_hash === intel.git_commit_hash) {
      commitsBehind = 0;
    } else {
      try {
        const result = execGit(cwd, ['rev-list', '--count', `${intel.git_commit_hash}..HEAD`]);
        if (result.exitCode === 0 && result.stdout) {
          commitsBehind = parseInt(result.stdout, 10) || 0;
        }
      } catch (e) {
        debugLog('codebase.getStalenessAge', 'git rev-list failed', e);
      }
    }
  }

  return { age_ms: ageMs, commits_behind: commitsBehind };
}


// ─── Agent Context Generation ─────────────────────────────────────────────────

const AGENT_MANIFESTS = {
  'bgsd-executor': {
    fields: ['phase_dir', 'phase_number', 'phase_name', 'plans', 'incomplete_plans',
             'plan_count', 'incomplete_count', 'branch_name', 'commit_docs',
             'verifier_enabled', 'task_routing', 'env_summary'],
    optional: ['codebase_conventions', 'codebase_dependencies'],
  },
  'bgsd-verifier': {
    fields: ['phase_dir', 'phase_number', 'phase_name', 'plans', 'summaries',
             'verifier_enabled', 'effective_intent'],
    optional: ['codebase_stats'],
  },
  'bgsd-planner': {
    fields: ['phase_dir', 'phase_number', 'phase_name', 'plan_count',
             'research_enabled', 'plan_checker_enabled', 'intent_summary', 'effective_intent'],
    optional: ['codebase_stats', 'codebase_conventions', 'codebase_dependencies',
                'codebase_freshness', 'env_summary'],
  },
  'bgsd-phase-researcher': {
    fields: ['phase_dir', 'phase_number', 'phase_name', 'intent_summary', 'effective_intent'],
    optional: ['codebase_stats', 'env_summary'],
  },
  'bgsd-plan-checker': {
    fields: ['phase_dir', 'phase_number', 'phase_name', 'plans', 'plan_count'],
    optional: ['codebase_stats', 'codebase_dependencies'],
  },
  'bgsd-reviewer': {
    fields: ['phase_dir', 'phase_number', 'phase_name', 'codebase_conventions', 'codebase_dependencies'],
    optional: ['codebase_stats'],
  },
  'bgsd-roadmapper': {
    fields: ['phase_dir', 'phase_number', 'phase_name', 'plan_count', 'intent_summary', 'effective_intent'],
    optional: ['codebase_stats'],
  },
  'bgsd-project-researcher': {
    fields: ['phase_dir', 'phase_number', 'phase_name', 'intent_summary', 'effective_intent'],
    optional: ['codebase_stats', 'env_summary'],
  },
};

/**
 * Generate pre-computed agent contexts for all agent types.
 * Uses existing intel data and phase info to create scoped contexts.
 *
 * @param {string} cwd - Project root
 * @param {object} intel - Current intel object with stats, conventions, dependencies
 * @returns {object} Agent contexts keyed by agent type
 */
function generateAgentContexts(cwd, intel) {
  const contexts = {};
  const generatedAt = new Date().toISOString();

  // Read phase info from STATE.md and ROADMAP.md
  let phaseInfo = { phase: null, current_plan: null, status: null };
  try {
    const statePath = path.join(cwd, '.planning', 'STATE.md');
    if (fs.existsSync(statePath)) {
      const stateContent = fs.readFileSync(statePath, 'utf-8');
      // Match **Phase:** 87 (complete) or **Phase:** 87
      const phaseMatch = stateContent.match(/\*\*Phase:\*\*\s*(\d+)/m);
      const planMatch = stateContent.match(/\*\*Current Plan:\*\*\s*(.+)/m);
      const statusMatch = stateContent.match(/\*\*Status:\*\*\s*(.+)/m);
      if (phaseMatch) phaseInfo.phase = phaseMatch[1];
      if (planMatch) phaseInfo.current_plan = planMatch[1].trim();
      if (statusMatch) phaseInfo.status = statusMatch[1].trim();
    }
  } catch { /* ignore */ }

  // Read ROADMAP.md for plans
  let roadmapInfo = { plans: [], summaries: [] };
  try {
    const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
    if (fs.existsSync(roadmapPath)) {
      const roadmapContent = fs.readFileSync(roadmapPath, 'utf-8');
      // Extract phase plans - simplified parsing
      const phaseMatch = roadmapContent.match(/## Phase \d+.*?\n([\s\S]*?)(?=## Phase|$)/);
      if (phaseMatch) {
        const planMatches = phaseMatch[1].match(/Plan \d+/g) || [];
        roadmapInfo.plans = planMatches.map(p => p.toLowerCase().replace(/ /g, '-'));
      }
    }
  } catch { /* ignore */ }

  // Read config for flags
  let configInfo = { commit_docs: true, verifier: false, research: false, plan_checker: false };
  try {
    const configPath = path.join(cwd, '.planning', 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      configInfo = {
        commit_docs: config.commit_docs !== false,
        verifier: config.verifier === true,
        research: config.research === true,
        plan_checker: config.plan_checker === true,
      };
    }
  } catch { /* ignore */ }

  // Build base context from intel
  const baseContext = {
    phase_dir: phaseInfo.phase ? `phases/${phaseInfo.phase}-quality-and-context` : null,
    phase_number: phaseInfo.phase,
    phase_name: 'Quality and Context',
    plans: roadmapInfo.plans,
    summaries: roadmapInfo.summaries,
    incomplete_plans: [],
    plan_count: roadmapInfo.plans.length,
    incomplete_count: 0,
    branch_name: null,
    commit_docs: configInfo.commit_docs,
    verifier_enabled: configInfo.verifier,
    task_routing: null,
    env_summary: null,
    codebase_stats: intel?.stats ? {
      total_files: intel.stats.total_files,
      total_lines: intel.stats.total_lines,
      git_commit: intel.git_commit_hash,
      generated_at: intel.generated_at,
    } : null,
    codebase_conventions: intel?.conventions || null,
    codebase_dependencies: intel?.dependencies ? {
      total_modules: intel.dependencies.stats?.total_files_parsed || 0,
      total_edges: intel.dependencies.stats?.total_edges || 0,
    } : null,
    codebase_freshness: null,
    research_enabled: configInfo.research,
    plan_checker_enabled: configInfo.plan_checker,
    intent_summary: null,
    effective_intent: null,
  };

  try {
    baseContext.effective_intent = getEffectiveIntent(cwd, phaseInfo.phase ? { phase: phaseInfo.phase } : {});
  } catch (e) {
    debugLog('codebase.generateAgentContexts', 'effective intent unavailable for cached contexts', e);
  }

  // Generate scoped context for each agent type
  for (const [agentType, manifest] of Object.entries(AGENT_MANIFESTS)) {
    const allowed = new Set([...manifest.fields, ...(manifest.optional || [])]);
    const scoped = { _agent: agentType, generated_at: generatedAt };

    for (const key of allowed) {
      if (key in baseContext && baseContext[key] !== undefined && baseContext[key] !== null) {
        scoped[key] = baseContext[key];
      }
    }

    // Calculate savings
    const originalKeys = Object.keys(baseContext).length;
    const scopedKeys = Object.keys(scoped).length - 1; // exclude _agent
    scoped._savings = {
      original_keys: originalKeys,
      scoped_keys: scopedKeys,
      reduction_pct: originalKeys > 0 ? Math.round((1 - scopedKeys / originalKeys) * 100) : 0,
    };

    contexts[agentType] = scoped;
  }

  return contexts;
}


/**
 * Check if intel is stale based on git commit hash.
 * Returns true if hashes differ or if agent_contexts is missing.
 *
 * @param {string} cwd - Project root
 * @returns {boolean} True if intel is stale
 */
function isIntelStale(cwd) {
  const intel = readIntel(cwd);

  if (!intel) return true;

  // Check if agent_contexts exists
  if (!intel.agent_contexts) return true;

  // Check git commit hash
  if (intel.git_commit_hash) {
    const gitInfo = getGitInfo(cwd);
    if (gitInfo.commit_hash && gitInfo.commit_hash !== intel.git_commit_hash) {
      return true;
    }
  }

  return false;
}


/**
 * Read intel with cache validation.
 * Returns cached contexts only when valid, triggers regeneration if stale.
 *
 * @param {string} cwd - Project root
 * @param {boolean} autoRegenerate - If true, regenerate stale intel
 * @returns {object|null} Intel object or null
 */
function readIntelWithCache(cwd, autoRegenerate = false) {
  const intel = readIntel(cwd);

  if (!intel) return null;

  // Check staleness
  if (isIntelStale(cwd)) {
    if (autoRegenerate) {
      // Trigger regeneration via codebase command would go here
      // For now, return null to indicate stale
      return null;
    }
    // Return intel but mark as stale
    return { ...intel, _stale: true };
  }

  return intel;
}


// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  LANGUAGE_MAP,
  SKIP_DIRS,
  getSourceDirs,
  walkSourceFiles,
  getGitInfo,
  getChangedFilesSinceCommit,
  checkStaleness,
  getStalenessAge,
  performAnalysis,
  readIntel,
  writeIntel,
  generateAgentContexts,
  isIntelStale,
  readIntelWithCache,
};
