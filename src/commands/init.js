'use strict';

const fs = require('fs');
const path = require('path');
const { output, error, debugLog } = require('../lib/output');
const { banner, sectionHeader, progressBar, formatTable, summaryLine, actionHint, color, SYMBOLS, colorByPercent } = require('../lib/format');
const { loadConfig } = require('../lib/config');
const { safeReadFile, cachedReadFile, findPhaseInternal, resolveModelInternal, getRoadmapPhaseInternal, getMilestoneInfo, getArchivedPhaseDirs, normalizePhaseName, isValidDateString, sanitizeShellArg, pathExistsInternal, generateSlugInternal, getPhaseTree } = require('../lib/helpers');
const { extractFrontmatter } = require('../lib/frontmatter');
const { execGit } = require('../lib/git');
const { getIntentDriftData, getIntentSummary } = require('./intent');
const { autoTriggerEnvScan, formatEnvSummary, readEnvManifest } = require('./env');
const { autoTriggerCodebaseIntel } = require('./codebase');
const { getWorktreeConfig, parseWorktreeListPorcelain, getPhaseFilesModified } = require('./worktree');
const { getStalenessAge } = require('../lib/codebase-intel');

/**
 * Format codebase intel into three structured fields (<500 tokens total) for init injection.
 * Returns { codebase_stats, codebase_conventions, codebase_dependencies } with confidence scores.
 * Each field is null if the underlying data is missing.
 *
 * @param {object|null} intel - Codebase intel data from autoTriggerCodebaseIntel
 * @param {string} [cwd] - Project root (for freshness age calculation)
 * @returns {{ codebase_stats: object|null, codebase_conventions: object|null, codebase_dependencies: object|null, codebase_freshness: object|null }}
 */
function formatCodebaseContext(intel, cwd) {
  if (!intel || !intel.stats) {
    return { codebase_stats: null, codebase_conventions: null, codebase_dependencies: null, codebase_freshness: null };
  }

  // --- codebase_stats (always available if intel exists) ---
  const langs = Object.entries(intel.languages || {})
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([lang, info]) => `${lang}(${info.count})`)
    .join(', ');

  const codebase_stats = {
    total_files: intel.stats.total_files,
    total_lines: intel.stats.total_lines,
    top_languages: langs,
    git_commit: intel.git_commit_hash,
    generated_at: intel.generated_at,
    confidence: 1.0,
  };

  // --- codebase_conventions (from intel.conventions, added by Phase 24) ---
  let codebase_conventions = null;
  try {
    const conv = intel.conventions;
    if (conv) {
      // Extract dominant naming pattern + confidence
      const overallNaming = conv.naming?.overall || {};
      const namingEntries = Object.values(overallNaming);
      let naming = null;
      if (namingEntries.length > 0) {
        const dominant = namingEntries.sort((a, b) => b.confidence - a.confidence)[0];
        const alternatives = namingEntries
          .filter(e => e.pattern !== dominant.pattern && e.confidence >= 20)
          .map(e => e.pattern);
        naming = { dominant: dominant.pattern, confidence: Math.round(dominant.confidence), alternatives };
      }

      // Extract structure summary
      const org = conv.file_organization;
      let structure = null;
      if (org) {
        structure = {
          type: org.structure_type || 'flat',
          test_placement: org.test_placement || 'unknown',
          config_placement: 'root',
        };
      }

      // Extract framework summary
      let framework = null;
      if (conv.frameworks && conv.frameworks.length > 0) {
        const fw = conv.frameworks[0];
        framework = { name: fw.framework || fw.name || 'unknown', patterns_detected: conv.frameworks.length };
      }

      // Compute average confidence
      const scores = [];
      if (naming) scores.push(naming.confidence / 100);
      if (structure) scores.push(0.7); // structure detection is moderate confidence
      const avgConfidence = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : 0.5;

      codebase_conventions = { naming, structure, framework, confidence: avgConfidence };
    }
  } catch (e) {
    debugLog('formatCodebaseContext', 'conventions formatting failed', e);
  }

  // --- codebase_dependencies (from intel.dependencies, added by Phase 25) ---
  let codebase_dependencies = null;
  try {
    const deps = intel.dependencies;
    if (deps) {
      // Top 5 most-imported files from reverse adjacency list
      const rev = deps.reverse || {};
      const topImported = Object.entries(rev)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 5)
        .map(([file, importers]) => `${file}(${importers.length})`);

      codebase_dependencies = {
        total_modules: deps.stats?.total_files_parsed || 0,
        total_edges: deps.stats?.total_edges || 0,
        top_imported: topImported,
        has_cycles: (deps.stats?.cycles || 0) > 0,
        confidence: 0.85,
      };
    }
  } catch (e) {
    debugLog('formatCodebaseContext', 'dependencies formatting failed', e);
  }

  // --- codebase_freshness (top-level advisory for very stale data) ---
  let codebase_freshness = null;
  try {
    if (cwd && typeof getStalenessAge === 'function') {
      const age = getStalenessAge(intel, cwd);
      if (age) {
        const ONE_DAY = 24 * 60 * 60 * 1000;
        if (age.age_ms > ONE_DAY) {
          codebase_freshness = { stale: true, reason: `${Math.round(age.age_ms / (60 * 60 * 1000))}h old` };
        } else if (age.commits_behind > 10) {
          codebase_freshness = { stale: true, reason: `${age.commits_behind} commits behind` };
        }
        // Otherwise null = fresh, no advisory needed
      }
    }
  } catch (e) {
    debugLog('formatCodebaseContext', 'freshness check failed', e);
  }

  return { codebase_stats, codebase_conventions, codebase_dependencies, codebase_freshness };
}

function cmdInitExecutePhase(cwd, phase, raw) {
  if (!phase) {
    error('phase required for init execute-phase');
  }

  const config = loadConfig(cwd);
  const phaseInfo = findPhaseInternal(cwd, phase);
  const milestone = getMilestoneInfo(cwd);

  // Read raw config for gates (not in CONFIG_SCHEMA)
  let rawConfig = {};
  try {
    rawConfig = JSON.parse(fs.readFileSync(path.join(cwd, '.planning', 'config.json'), 'utf-8'));
  } catch (e) { debugLog('init.executePhase', 'raw config read failed', e); }

  const result = {
    // Models
    executor_model: resolveModelInternal(cwd, 'gsd-executor'),
    verifier_model: resolveModelInternal(cwd, 'gsd-verifier'),

    // Config flags
    commit_docs: config.commit_docs,
    parallelization: config.parallelization,
    branching_strategy: config.branching_strategy,
    phase_branch_template: config.phase_branch_template,
    milestone_branch_template: config.milestone_branch_template,
    verifier_enabled: config.verifier,

    // Phase info
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory || null,
    phase_number: phaseInfo?.phase_number || null,
    phase_name: phaseInfo?.phase_name || null,
    phase_slug: phaseInfo?.phase_slug || null,

    // Plan inventory
    plans: phaseInfo?.plans || [],
    summaries: phaseInfo?.summaries || [],
    incomplete_plans: phaseInfo?.incomplete_plans || [],
    plan_count: phaseInfo?.plans?.length || 0,
    incomplete_count: phaseInfo?.incomplete_plans?.length || 0,

    // Branch name (pre-computed)
    branch_name: config.branching_strategy === 'phase' && phaseInfo
      ? config.phase_branch_template
          .replace('{phase}', phaseInfo.phase_number)
          .replace('{slug}', phaseInfo.phase_slug || 'phase')
      : config.branching_strategy === 'milestone'
        ? config.milestone_branch_template
            .replace('{milestone}', milestone.version)
            .replace('{slug}', generateSlugInternal(milestone.name) || 'milestone')
        : null,

    // Milestone info
    milestone_version: milestone.version,
    milestone_name: milestone.name,
    milestone_slug: generateSlugInternal(milestone.name),

    // Gates
    pre_flight_validation: rawConfig.gates?.pre_flight_validation !== false,

    // Worktree parallelism
    worktree_enabled: rawConfig.worktree?.enabled || false,
    worktree_config: {
      base_path: rawConfig.worktree?.base_path || '/tmp/gsd-worktrees',
      sync_files: rawConfig.worktree?.sync_files || ['.env', '.env.local', '.planning/config.json'],
      setup_hooks: rawConfig.worktree?.setup_hooks || [],
      max_concurrent: rawConfig.worktree?.max_concurrent || 3,
    },
    worktree_active: [],
    file_overlaps: [],

    // File existence
    state_exists: pathExistsInternal(cwd, '.planning/STATE.md'),
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
    config_exists: pathExistsInternal(cwd, '.planning/config.json'),
    // File paths
    state_path: '.planning/STATE.md',
    roadmap_path: '.planning/ROADMAP.md',
    config_path: '.planning/config.json',

    // Intent drift advisory (null if no INTENT.md)
    intent_drift: null,

    // Intent summary (null if no INTENT.md)
    intent_summary: null,
  };

  // Advisory intent summary — never crash, never block
  try {
    result.intent_summary = getIntentSummary(cwd);
  } catch (e) {
    debugLog('init.executePhase', 'intent summary failed (non-blocking)', e);
  }

  // Advisory intent drift scoring — never crash, never block
  try {
    const driftData = getIntentDriftData(cwd);
    if (driftData) {
      let advisory = null;
      if (driftData.drift_score <= 15) {
        // Excellent — no advisory needed
        advisory = null;
      } else if (driftData.drift_score <= 35) {
        advisory = 'Intent alignment is good.';
      } else if (driftData.drift_score <= 60) {
        const gapsCount = driftData.signals.coverage_gap.details.length;
        advisory = `⚠ ${gapsCount} outcomes uncovered. Review intent trace.`;
      } else {
        advisory = `⚠ Significant drift detected (score: ${driftData.drift_score}). Run \`intent drift\` for details.`;
      }

      result.intent_drift = {
        score: driftData.drift_score,
        alignment: driftData.alignment,
        gaps_count: driftData.signals.coverage_gap.details.length,
        untraced_plans: driftData.signals.objective_mismatch.plans.length,
        advisory,
      };
    }
    // If no INTENT.md or no outcomes: intent_drift stays null (silent)
  } catch (e) {
    debugLog('init.executePhase', 'intent drift advisory failed (non-blocking)', e);
    // Advisory — never crash. Leave intent_drift as null.
  }

  // Environment context — auto-trigger scan if needed, inject compact summary
  try {
    const envManifest = autoTriggerEnvScan(cwd);
    const envSummary = formatEnvSummary(envManifest);
    result.env_summary = envSummary;
    result.env_languages = envManifest?.languages?.length || 0;
    result.env_stale = false;
  } catch (e) {
    debugLog('init.executePhase', 'env scan failed (non-blocking)', e);
    result.env_summary = null;
    result.env_languages = 0;
    result.env_stale = false;
  }

  // Codebase intelligence — auto-trigger analysis if stale, inject structured context
  try {
    const refreshMode = process.argv.includes('--refresh');
    if (refreshMode) {
      // Clear stale lock file before synchronous re-analysis
      try { fs.unlinkSync(path.join(cwd, '.planning', '.cache', '.analyzing')); } catch { /* ignore */ }
    }
    const codebaseIntel = autoTriggerCodebaseIntel(cwd, { synchronous: refreshMode });
    const ctx = formatCodebaseContext(codebaseIntel, cwd);
    result.codebase_stats = ctx.codebase_stats;
    result.codebase_conventions = ctx.codebase_conventions;
    result.codebase_dependencies = ctx.codebase_dependencies;
    result.codebase_freshness = ctx.codebase_freshness;
  } catch (e) {
    debugLog('init.executePhase', 'codebase intel failed (non-blocking)', e);
    result.codebase_stats = null;
    result.codebase_conventions = null;
    result.codebase_dependencies = null;
    result.codebase_freshness = null;
  }

  // Orchestration intelligence — classify tasks and recommend routing
  try {
    const { classifyPlan, selectExecutionMode } = require('../lib/orchestration');
    const planClassifications = [];
    for (const planFile of (phaseInfo?.incomplete_plans || [])) {
      const planPath = path.join(cwd, phaseInfo.directory, planFile);
      const classification = classifyPlan(planPath, cwd);
      if (classification) planClassifications.push(classification);
    }

    if (planClassifications.length > 0) {
      result.task_routing = {
        plans: planClassifications,
        execution_mode: selectExecutionMode(planClassifications),
        classified_at: new Date().toISOString(),
      };
    } else {
      result.task_routing = null;
    }
  } catch (e) {
    debugLog('init.executePhase', 'orchestration classification failed (non-blocking)', e);
    result.task_routing = null;
  }

  // Worktree context — populate active worktrees and file overlaps when enabled
  try {
    if (result.worktree_enabled) {
      // Get active worktrees for this project
      const wtListResult = execGit(cwd, ['worktree', 'list', '--porcelain']);
      if (wtListResult.exitCode === 0) {
        const wtConfig = getWorktreeConfig(cwd);
        const projectName = path.basename(cwd);
        const projectBase = path.join(wtConfig.base_path, projectName);
        const allWts = parseWorktreeListPorcelain(wtListResult.stdout);
        result.worktree_active = allWts
          .filter(wt => wt.path && wt.path.startsWith(projectBase + '/'))
          .map(wt => ({
            plan_id: path.basename(wt.path),
            branch: wt.branch || null,
            path: wt.path,
          }));
      }

      // File overlap analysis for the phase
      if (phaseInfo?.phase_number) {
        const phasePlans = getPhaseFilesModified(cwd, phaseInfo.phase_number);
        const overlaps = [];
        const checked = new Set();
        for (let i = 0; i < phasePlans.length; i++) {
          for (let j = i + 1; j < phasePlans.length; j++) {
            const a = phasePlans[i];
            const b = phasePlans[j];
            if (a.wave !== b.wave) continue;
            const pairKey = `${a.planId}:${b.planId}`;
            if (checked.has(pairKey)) continue;
            checked.add(pairKey);
            const sharedFiles = a.files_modified.filter(f => b.files_modified.includes(f));
            if (sharedFiles.length > 0) {
              overlaps.push({ plans: [a.planId, b.planId], files: sharedFiles, wave: a.wave });
            }
          }
        }
        result.file_overlaps = overlaps;
      }
    }
  } catch (e) {
    debugLog('init.executePhase', 'worktree context failed (non-blocking)', e);
  }

  if (global._gsdCompactMode) {
    const planPaths = (result.plans || []).map(p => typeof p === 'string' ? p : p.file || p);
    const compactResult = {
      phase_found: result.phase_found,
      phase_dir: result.phase_dir,
      phase_number: result.phase_number,
      phase_name: result.phase_name,
      plans: planPaths,
      incomplete_plans: (result.incomplete_plans || []).map(p => typeof p === 'string' ? p : p.file || p),
      plan_count: result.plan_count,
      incomplete_count: result.incomplete_count,
      branch_name: result.branch_name,
      verifier_enabled: result.verifier_enabled,
      pre_flight_validation: result.pre_flight_validation,
      intent_drift: result.intent_drift ? {
        score: result.intent_drift.score,
        alignment: result.intent_drift.alignment,
        advisory: result.intent_drift.advisory,
      } : null,
      intent_summary: result.intent_summary || null,
      env_summary: result.env_summary || null,
      codebase_stats: result.codebase_stats || null,
      codebase_conventions: result.codebase_conventions || null,
      codebase_dependencies: result.codebase_dependencies || null,
      codebase_freshness: result.codebase_freshness || null,
      worktree_enabled: result.worktree_enabled,
      worktree_config: result.worktree_config,
      worktree_active: result.worktree_active,
      file_overlaps: result.file_overlaps,
      task_routing: result.task_routing || null,
    };
    if (global._gsdManifestMode) {
      compactResult._manifest = {
        files: [
          ...planPaths.map(p => ({ path: result.phase_dir ? `${result.phase_dir}/${p}` : p, required: true })),
          ...(result.state_exists ? [{ path: '.planning/STATE.md', sections: ['Current Position'], required: true }] : []),
          ...(result.roadmap_exists ? [{ path: '.planning/ROADMAP.md', sections: [`Phase ${result.phase_number || ''}`], required: true }] : []),
        ],
      };
    }
    return output(compactResult, raw);
  }

  // Trim null/disabled sections from verbose output to reduce token waste
  if (!result.worktree_enabled) { delete result.worktree_config; delete result.worktree_active; delete result.file_overlaps; }
  if (result.intent_drift === null) delete result.intent_drift;
  if (result.intent_summary === null) delete result.intent_summary;
  if (result.env_summary === null) { delete result.env_summary; delete result.env_languages; delete result.env_stale; }
  if (result.codebase_stats === null) delete result.codebase_stats;
  if (result.codebase_conventions === null) delete result.codebase_conventions;
  if (result.codebase_dependencies === null) delete result.codebase_dependencies;
  if (result.codebase_freshness === null) delete result.codebase_freshness;

  output(result, raw);
}

function cmdInitPlanPhase(cwd, phase, raw) {
  if (!phase) {
    error('phase required for init plan-phase');
  }

  const config = loadConfig(cwd);
  const phaseInfo = findPhaseInternal(cwd, phase);

  const result = {
    // Models
    researcher_model: resolveModelInternal(cwd, 'gsd-phase-researcher'),
    planner_model: resolveModelInternal(cwd, 'gsd-planner'),
    checker_model: resolveModelInternal(cwd, 'gsd-plan-checker'),

    // Workflow flags
    research_enabled: config.research,
    plan_checker_enabled: config.plan_checker,
    commit_docs: config.commit_docs,

    // Phase info
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory || null,
    phase_number: phaseInfo?.phase_number || null,
    phase_name: phaseInfo?.phase_name || null,
    phase_slug: phaseInfo?.phase_slug || null,
    padded_phase: phaseInfo?.phase_number?.padStart(2, '0') || null,

    // Existing artifacts
    has_research: phaseInfo?.has_research || false,
    has_context: phaseInfo?.has_context || false,
    has_plans: (phaseInfo?.plans?.length || 0) > 0,
    plan_count: phaseInfo?.plans?.length || 0,

    // Environment
    planning_exists: pathExistsInternal(cwd, '.planning'),
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),

    // File paths
    state_path: '.planning/STATE.md',
    roadmap_path: '.planning/ROADMAP.md',
    requirements_path: '.planning/REQUIREMENTS.md',

    // Intent context (null if no INTENT.md)
    intent_summary: null,
    intent_path: null,
  };

  // Advisory intent summary — never crash, never block
  try {
    result.intent_summary = getIntentSummary(cwd);
    const intentFile = path.join(cwd, '.planning', 'INTENT.md');
    if (fs.existsSync(intentFile)) {
      result.intent_path = '.planning/INTENT.md';
    }
  } catch (e) {
    debugLog('init.planPhase', 'intent summary failed (non-blocking)', e);
  }

  // Codebase intelligence — auto-trigger analysis if stale, inject structured context
  try {
    const refreshMode = process.argv.includes('--refresh');
    if (refreshMode) {
      try { fs.unlinkSync(path.join(cwd, '.planning', '.cache', '.analyzing')); } catch { /* ignore */ }
    }
    const codebaseIntel = autoTriggerCodebaseIntel(cwd, { synchronous: refreshMode });
    const ctx = formatCodebaseContext(codebaseIntel, cwd);
    result.codebase_stats = ctx.codebase_stats;
    result.codebase_conventions = ctx.codebase_conventions;
    result.codebase_dependencies = ctx.codebase_dependencies;
    result.codebase_freshness = ctx.codebase_freshness;
  } catch (e) {
    debugLog('init.planPhase', 'codebase intel failed (non-blocking)', e);
    result.codebase_stats = null;
    result.codebase_conventions = null;
    result.codebase_dependencies = null;
    result.codebase_freshness = null;
  }

  if (phaseInfo?.directory) {
    // Find *-CONTEXT.md in phase directory
    const phaseDirFull = path.join(cwd, phaseInfo.directory);
    try {
      const files = fs.readdirSync(phaseDirFull);
      const contextFile = files.find(f => f.endsWith('-CONTEXT.md') || f === 'CONTEXT.md');
      if (contextFile) {
        result.context_path = path.join(phaseInfo.directory, contextFile);
      }
      const researchFile = files.find(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md');
      if (researchFile) {
        result.research_path = path.join(phaseInfo.directory, researchFile);
      }
      const verificationFile = files.find(f => f.endsWith('-VERIFICATION.md') || f === 'VERIFICATION.md');
      if (verificationFile) {
        result.verification_path = path.join(phaseInfo.directory, verificationFile);
      }
      const uatFile = files.find(f => f.endsWith('-UAT.md') || f === 'UAT.md');
      if (uatFile) {
        result.uat_path = path.join(phaseInfo.directory, uatFile);
      }
    } catch (e) { debugLog('init.planPhase', 'read phase files failed', e); }
  }

  if (global._gsdCompactMode) {
    const compactResult = {
      phase_found: result.phase_found,
      phase_dir: result.phase_dir,
      phase_number: result.phase_number,
      phase_name: result.phase_name,
      phase_slug: result.phase_slug,
      padded_phase: result.padded_phase,
      has_research: result.has_research,
      has_context: result.has_context,
      has_plans: result.has_plans,
      plan_count: result.plan_count,
      research_enabled: result.research_enabled,
      plan_checker_enabled: result.plan_checker_enabled,
    };
    if (result.intent_summary) compactResult.intent_summary = result.intent_summary;
    if (result.intent_path) compactResult.intent_path = result.intent_path;
    if (result.codebase_stats) compactResult.codebase_stats = result.codebase_stats;
    if (result.codebase_conventions) compactResult.codebase_conventions = result.codebase_conventions;
    if (result.codebase_dependencies) compactResult.codebase_dependencies = result.codebase_dependencies;
    if (result.codebase_freshness) compactResult.codebase_freshness = result.codebase_freshness;
    if (result.context_path) compactResult.context_path = result.context_path;
    if (result.research_path) compactResult.research_path = result.research_path;
    if (result.verification_path) compactResult.verification_path = result.verification_path;
    if (result.uat_path) compactResult.uat_path = result.uat_path;

    if (global._gsdManifestMode) {
      const manifestFiles = [
        { path: '.planning/STATE.md', sections: ['Current Position', 'Accumulated Context'], required: true },
        { path: '.planning/ROADMAP.md', sections: [`Phase ${result.phase_number || ''}`], required: true },
        { path: '.planning/REQUIREMENTS.md', required: true },
      ];
      if (result.context_path) manifestFiles.push({ path: result.context_path, required: false });
      if (result.research_path) manifestFiles.push({ path: result.research_path, required: false });
      if (result.verification_path) manifestFiles.push({ path: result.verification_path, required: false });
      compactResult._manifest = { files: manifestFiles };
    }

    return output(compactResult, raw);
  }

  // Trim null intent fields from verbose output
  if (result.intent_summary === null) delete result.intent_summary;
  if (result.intent_path === null) delete result.intent_path;
  if (result.codebase_stats === null) delete result.codebase_stats;
  if (result.codebase_conventions === null) delete result.codebase_conventions;
  if (result.codebase_dependencies === null) delete result.codebase_dependencies;
  if (result.codebase_freshness === null) delete result.codebase_freshness;

  output(result, raw);
}

function cmdInitNewProject(cwd, raw) {
  const config = loadConfig(cwd);

  // Detect Brave Search API key availability
  const homedir = require('os').homedir();
  const braveKeyFile = path.join(homedir, '.gsd', 'brave_api_key');
  const hasBraveSearch = !!(process.env.BRAVE_API_KEY || fs.existsSync(braveKeyFile));

  // Detect existing code (use fs instead of spawning find + grep + head)
  let hasCode = false;
  let hasPackageFile = false;
  const codeExts = new Set(['.ts', '.js', '.py', '.go', '.rs', '.swift', '.java']);
  const skipDirs = new Set(['node_modules', '.git', 'dist', 'build', '__pycache__']);
  try {
    const scanForCode = (dir, depth) => {
      if (hasCode || depth > 3) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (hasCode) return;
        if (e.isDirectory() && !skipDirs.has(e.name)) {
          scanForCode(path.join(dir, e.name), depth + 1);
        } else if (e.isFile() && codeExts.has(path.extname(e.name))) {
          hasCode = true;
        }
      }
    };
    scanForCode(cwd, 0);
  } catch (e) { debugLog('init.newProject', 'code scan failed', e); }

  hasPackageFile = pathExistsInternal(cwd, 'package.json') ||
                   pathExistsInternal(cwd, 'requirements.txt') ||
                   pathExistsInternal(cwd, 'Cargo.toml') ||
                   pathExistsInternal(cwd, 'go.mod') ||
                   pathExistsInternal(cwd, 'Package.swift');

  const result = {
    // Models
    researcher_model: resolveModelInternal(cwd, 'gsd-project-researcher'),
    synthesizer_model: resolveModelInternal(cwd, 'gsd-research-synthesizer'),
    roadmapper_model: resolveModelInternal(cwd, 'gsd-roadmapper'),

    // Config
    commit_docs: config.commit_docs,

    // Existing state
    project_exists: pathExistsInternal(cwd, '.planning/PROJECT.md'),
    has_codebase_map: pathExistsInternal(cwd, '.planning/codebase'),
    planning_exists: pathExistsInternal(cwd, '.planning'),

    // Brownfield detection
    has_existing_code: hasCode,
    has_package_file: hasPackageFile,
    is_brownfield: hasCode || hasPackageFile,
    needs_codebase_map: (hasCode || hasPackageFile) && !pathExistsInternal(cwd, '.planning/codebase'),

    // Git state
    has_git: pathExistsInternal(cwd, '.git'),

    // Enhanced search
    brave_search_available: hasBraveSearch,

    // File paths
    project_path: '.planning/PROJECT.md',
  };

  if (global._gsdCompactMode) {
    const manifestFiles = [];
    if (result.project_exists) manifestFiles.push({ path: '.planning/PROJECT.md', required: false });
    if (pathExistsInternal(cwd, 'AGENTS.md')) manifestFiles.push({ path: 'AGENTS.md', required: false });

    const compactResult = {
      is_brownfield: result.is_brownfield,
      needs_codebase_map: result.needs_codebase_map,
      has_existing_code: result.has_existing_code,
      has_package_file: result.has_package_file,
      project_exists: result.project_exists,
      has_codebase_map: result.has_codebase_map,
      planning_exists: result.planning_exists,
      has_git: result.has_git,
      brave_search_available: result.brave_search_available,
    };
    if (global._gsdManifestMode) {
      compactResult._manifest = { files: manifestFiles };
    }
    return output(compactResult, raw);
  }

  output(result, raw);
}

function cmdInitNewMilestone(cwd, raw) {
  const config = loadConfig(cwd);
  const milestone = getMilestoneInfo(cwd);

  const result = {
    // Models
    researcher_model: resolveModelInternal(cwd, 'gsd-project-researcher'),
    synthesizer_model: resolveModelInternal(cwd, 'gsd-research-synthesizer'),
    roadmapper_model: resolveModelInternal(cwd, 'gsd-roadmapper'),

    // Config
    commit_docs: config.commit_docs,
    research_enabled: config.research,

    // Current milestone
    current_milestone: milestone.version,
    current_milestone_name: milestone.name,

    // File existence
    project_exists: pathExistsInternal(cwd, '.planning/PROJECT.md'),
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
    state_exists: pathExistsInternal(cwd, '.planning/STATE.md'),

    // File paths
    project_path: '.planning/PROJECT.md',
    roadmap_path: '.planning/ROADMAP.md',
    state_path: '.planning/STATE.md',
  };

  if (global._gsdCompactMode) {
    const manifestFiles = [];
    if (result.project_exists) manifestFiles.push({ path: '.planning/PROJECT.md', required: true });
    if (result.roadmap_exists) manifestFiles.push({ path: '.planning/ROADMAP.md', sections: ['Milestones', 'Progress'], required: true });
    if (result.state_exists) manifestFiles.push({ path: '.planning/STATE.md', sections: ['Accumulated Context'], required: true });

    const compactResult = {
      current_milestone: result.current_milestone,
      current_milestone_name: result.current_milestone_name,
      project_exists: result.project_exists,
      roadmap_exists: result.roadmap_exists,
      state_exists: result.state_exists,
      research_enabled: result.research_enabled,
    };
    if (global._gsdManifestMode) {
      compactResult._manifest = { files: manifestFiles };
    }
    return output(compactResult, raw);
  }

  output(result, raw);
}

function cmdInitQuick(cwd, description, raw) {
  const config = loadConfig(cwd);
  const now = new Date();
  const slug = description ? generateSlugInternal(description)?.substring(0, 40) : null;

  // Find next quick task number
  const quickDir = path.join(cwd, '.planning', 'quick');
  let nextNum = 1;
  try {
    const existing = fs.readdirSync(quickDir)
      .filter(f => /^\d+-/.test(f))
      .map(f => parseInt(f.split('-')[0], 10))
      .filter(n => !isNaN(n));
    if (existing.length > 0) {
      nextNum = Math.max(...existing) + 1;
    }
  } catch (e) { debugLog('init.quick', 'readdir failed', e); }

  const result = {
    // Models
    planner_model: resolveModelInternal(cwd, 'gsd-planner'),
    executor_model: resolveModelInternal(cwd, 'gsd-executor'),
    checker_model: resolveModelInternal(cwd, 'gsd-plan-checker'),
    verifier_model: resolveModelInternal(cwd, 'gsd-verifier'),

    // Config
    commit_docs: config.commit_docs,

    // Quick task info
    next_num: nextNum,
    slug: slug,
    description: description || null,

    // Timestamps
    date: now.toISOString().split('T')[0],
    timestamp: now.toISOString(),

    // Paths
    quick_dir: '.planning/quick',
    task_dir: slug ? `.planning/quick/${nextNum}-${slug}` : null,

    // File existence
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
    planning_exists: pathExistsInternal(cwd, '.planning'),

  };

  // Environment context — inject compact summary
  try {
    const envManifest = autoTriggerEnvScan(cwd);
    result.env_summary = formatEnvSummary(envManifest);
  } catch (e) {
    debugLog('init.quick', 'env scan failed (non-blocking)', e);
    result.env_summary = null;
  }

  if (global._gsdCompactMode) {
    const manifestFiles = [];
    if (pathExistsInternal(cwd, '.planning/STATE.md')) manifestFiles.push({ path: '.planning/STATE.md', sections: ['Current Position'], required: false });

    const compactResult = {
      next_num: result.next_num,
      slug: result.slug,
      description: result.description,
      task_dir: result.task_dir,
      date: result.date,
      planning_exists: result.planning_exists,
      env_summary: result.env_summary || null,
    };
    if (global._gsdManifestMode) {
      compactResult._manifest = { files: manifestFiles };
    }
    return output(compactResult, raw);
  }

  output(result, raw);
}

function cmdInitResume(cwd, raw) {
  const config = loadConfig(cwd);

  // Check for interrupted agent
  let interruptedAgentId = null;
  try {
    interruptedAgentId = fs.readFileSync(path.join(cwd, '.planning', 'current-agent-id.txt'), 'utf-8').trim();
  } catch (e) { debugLog('init.resume', 'read failed', e); }

  const result = {
    // File existence
    state_exists: pathExistsInternal(cwd, '.planning/STATE.md'),
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
    project_exists: pathExistsInternal(cwd, '.planning/PROJECT.md'),
    planning_exists: pathExistsInternal(cwd, '.planning'),

    // File paths
    state_path: '.planning/STATE.md',
    roadmap_path: '.planning/ROADMAP.md',
    project_path: '.planning/PROJECT.md',

    // Agent state
    has_interrupted_agent: !!interruptedAgentId,
    interrupted_agent_id: interruptedAgentId,

    // Config
    commit_docs: config.commit_docs,
  };

  // Environment context — inject compact summary
  try {
    const envManifest = autoTriggerEnvScan(cwd);
    result.env_summary = formatEnvSummary(envManifest);
  } catch (e) {
    debugLog('init.resume', 'env scan failed (non-blocking)', e);
    result.env_summary = null;
  }

  if (global._gsdCompactMode) {
    const manifestFiles = [];
    if (result.state_exists) manifestFiles.push({ path: '.planning/STATE.md', required: true });
    if (result.roadmap_exists) manifestFiles.push({ path: '.planning/ROADMAP.md', sections: ['Progress'], required: true });

    const compactResult = {
      state_exists: result.state_exists,
      planning_exists: result.planning_exists,
      has_interrupted_agent: result.has_interrupted_agent,
      interrupted_agent_id: result.interrupted_agent_id,
      env_summary: result.env_summary || null,
    };
    if (global._gsdManifestMode) {
      compactResult._manifest = { files: manifestFiles };
    }
    return output(compactResult, raw);
  }

  output(result, raw);
}

function cmdInitVerifyWork(cwd, phase, raw) {
  if (!phase) {
    error('phase required for init verify-work');
  }

  const config = loadConfig(cwd);
  const phaseInfo = findPhaseInternal(cwd, phase);

  const result = {
    // Models
    planner_model: resolveModelInternal(cwd, 'gsd-planner'),
    checker_model: resolveModelInternal(cwd, 'gsd-plan-checker'),

    // Config
    commit_docs: config.commit_docs,

    // Phase info
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory || null,
    phase_number: phaseInfo?.phase_number || null,
    phase_name: phaseInfo?.phase_name || null,

    // Existing artifacts
    has_verification: phaseInfo?.has_verification || false,
  };

  if (global._gsdCompactMode) {
    const manifestFiles = [];
    // Include plan and summary files from phase dir
    if (phaseInfo?.directory) {
      try {
        const phaseFiles = fs.readdirSync(path.join(cwd, phaseInfo.directory));
        phaseFiles.filter(f => f.endsWith('-PLAN.md')).forEach(f => {
          manifestFiles.push({ path: `${phaseInfo.directory}/${f}`, required: true });
        });
        phaseFiles.filter(f => f.endsWith('-SUMMARY.md')).forEach(f => {
          manifestFiles.push({ path: `${phaseInfo.directory}/${f}`, required: true });
        });
      } catch (e) { debugLog('init.verifyWork', 'manifest scan failed', e); }
    }
    if (pathExistsInternal(cwd, '.planning/ROADMAP.md')) {
      manifestFiles.push({ path: '.planning/ROADMAP.md', sections: [`Phase ${result.phase_number || ''}`], required: true });
    }

    const compactResult = {
      phase_found: result.phase_found,
      phase_dir: result.phase_dir,
      phase_number: result.phase_number,
      phase_name: result.phase_name,
      has_verification: result.has_verification,
    };
    if (global._gsdManifestMode) {
      compactResult._manifest = { files: manifestFiles };
    }
    return output(compactResult, raw);
  }

  output(result, raw);
}

function cmdInitPhaseOp(cwd, phase, raw) {
  const config = loadConfig(cwd);
  let phaseInfo = findPhaseInternal(cwd, phase);

  // Fallback to ROADMAP.md if no directory exists (e.g., Plans: TBD)
  if (!phaseInfo) {
    const roadmapPhase = getRoadmapPhaseInternal(cwd, phase);
    if (roadmapPhase?.found) {
      const phaseName = roadmapPhase.phase_name;
      phaseInfo = {
        found: true,
        directory: null,
        phase_number: roadmapPhase.phase_number,
        phase_name: phaseName,
        phase_slug: phaseName ? phaseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : null,
        plans: [],
        summaries: [],
        incomplete_plans: [],
        has_research: false,
        has_context: false,
        has_verification: false,
      };
    }
  }

  const result = {
    // Config
    commit_docs: config.commit_docs,
    brave_search: config.brave_search,

    // Phase info
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory || null,
    phase_number: phaseInfo?.phase_number || null,
    phase_name: phaseInfo?.phase_name || null,
    phase_slug: phaseInfo?.phase_slug || null,
    padded_phase: phaseInfo?.phase_number?.padStart(2, '0') || null,

    // Existing artifacts
    has_research: phaseInfo?.has_research || false,
    has_context: phaseInfo?.has_context || false,
    has_plans: (phaseInfo?.plans?.length || 0) > 0,
    has_verification: phaseInfo?.has_verification || false,
    plan_count: phaseInfo?.plans?.length || 0,

    // File existence
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
    planning_exists: pathExistsInternal(cwd, '.planning'),

    // File paths
    state_path: '.planning/STATE.md',
    roadmap_path: '.planning/ROADMAP.md',
    requirements_path: '.planning/REQUIREMENTS.md',
  };

  if (phaseInfo?.directory) {
    const phaseDirFull = path.join(cwd, phaseInfo.directory);
    try {
      const files = fs.readdirSync(phaseDirFull);
      const contextFile = files.find(f => f.endsWith('-CONTEXT.md') || f === 'CONTEXT.md');
      if (contextFile) {
        result.context_path = path.join(phaseInfo.directory, contextFile);
      }
      const researchFile = files.find(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md');
      if (researchFile) {
        result.research_path = path.join(phaseInfo.directory, researchFile);
      }
      const verificationFile = files.find(f => f.endsWith('-VERIFICATION.md') || f === 'VERIFICATION.md');
      if (verificationFile) {
        result.verification_path = path.join(phaseInfo.directory, verificationFile);
      }
      const uatFile = files.find(f => f.endsWith('-UAT.md') || f === 'UAT.md');
      if (uatFile) {
        result.uat_path = path.join(phaseInfo.directory, uatFile);
      }
    } catch (e) { debugLog('init.phaseOp', 'read phase files failed', e); }
  }

  // Codebase intelligence — auto-trigger analysis if stale, inject structured context
  try {
    const refreshMode = process.argv.includes('--refresh');
    if (refreshMode) {
      try { fs.unlinkSync(path.join(cwd, '.planning', '.cache', '.analyzing')); } catch { /* ignore */ }
    }
    const codebaseIntel = autoTriggerCodebaseIntel(cwd, { synchronous: refreshMode });
    const ctx = formatCodebaseContext(codebaseIntel, cwd);
    result.codebase_stats = ctx.codebase_stats;
    result.codebase_conventions = ctx.codebase_conventions;
    result.codebase_dependencies = ctx.codebase_dependencies;
    result.codebase_freshness = ctx.codebase_freshness;
  } catch (e) {
    debugLog('init.phaseOp', 'codebase intel failed (non-blocking)', e);
    result.codebase_stats = null;
    result.codebase_conventions = null;
    result.codebase_dependencies = null;
    result.codebase_freshness = null;
  }

  if (global._gsdCompactMode) {
    const compactResult = {
      phase_found: result.phase_found,
      phase_dir: result.phase_dir,
      phase_number: result.phase_number,
      phase_name: result.phase_name,
      phase_slug: result.phase_slug,
      padded_phase: result.padded_phase,
      has_research: result.has_research,
      has_context: result.has_context,
      has_plans: result.has_plans,
      has_verification: result.has_verification,
      plan_count: result.plan_count,
    };
    if (result.context_path) compactResult.context_path = result.context_path;
    if (result.research_path) compactResult.research_path = result.research_path;
    if (result.verification_path) compactResult.verification_path = result.verification_path;
    if (result.uat_path) compactResult.uat_path = result.uat_path;
    if (result.codebase_stats) compactResult.codebase_stats = result.codebase_stats;
    if (result.codebase_conventions) compactResult.codebase_conventions = result.codebase_conventions;
    if (result.codebase_dependencies) compactResult.codebase_dependencies = result.codebase_dependencies;
    if (result.codebase_freshness) compactResult.codebase_freshness = result.codebase_freshness;

    if (global._gsdManifestMode) {
      const manifestFiles = [
        { path: '.planning/STATE.md', sections: ['Current Position'], required: true },
        { path: '.planning/ROADMAP.md', sections: [`Phase ${result.phase_number || ''}`], required: true },
      ];
      if (pathExistsInternal(cwd, '.planning/REQUIREMENTS.md')) manifestFiles.push({ path: '.planning/REQUIREMENTS.md', required: false });
      if (result.context_path) manifestFiles.push({ path: result.context_path, required: false });
      if (result.research_path) manifestFiles.push({ path: result.research_path, required: false });
      compactResult._manifest = { files: manifestFiles };
    }

    return output(compactResult, raw);
  }

  output(result, raw);
}

function cmdInitTodos(cwd, area, raw) {
  const config = loadConfig(cwd);
  const now = new Date();

  // List todos (reuse existing logic)
  const pendingDir = path.join(cwd, '.planning', 'todos', 'pending');
  let count = 0;
  const todos = [];

  try {
    const files = fs.readdirSync(pendingDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(pendingDir, file), 'utf-8');
        const createdMatch = content.match(/^created:\s*(.+)$/m);
        const titleMatch = content.match(/^title:\s*(.+)$/m);
        const areaMatch = content.match(/^area:\s*(.+)$/m);
        const todoArea = areaMatch ? areaMatch[1].trim() : 'general';

        if (area && todoArea !== area) continue;

        count++;
        todos.push({
          file,
          created: createdMatch ? createdMatch[1].trim() : 'unknown',
          title: titleMatch ? titleMatch[1].trim() : 'Untitled',
          area: todoArea,
          path: path.join('.planning', 'todos', 'pending', file),
        });
      } catch (e) { debugLog('init.todos', 'read todo file failed', e); }
    }
  } catch (e) { debugLog('init.todos', 'read pending dir failed', e); }

  const result = {
    // Config
    commit_docs: config.commit_docs,

    // Timestamps
    date: now.toISOString().split('T')[0],
    timestamp: now.toISOString(),

    // Todo inventory
    todo_count: count,
    todos,
    area_filter: area || null,

    // Paths
    pending_dir: '.planning/todos/pending',
    completed_dir: '.planning/todos/completed',

    // File existence
    planning_exists: pathExistsInternal(cwd, '.planning'),
    todos_dir_exists: pathExistsInternal(cwd, '.planning/todos'),
    pending_dir_exists: pathExistsInternal(cwd, '.planning/todos/pending'),
  };

  if (global._gsdCompactMode) {
    const manifestFiles = result.todos.map(t => ({ path: t.path, required: true }));

    const compactResult = {
      todo_count: result.todo_count,
      todos: result.todos,
      area_filter: result.area_filter,
      date: result.date,
      pending_dir_exists: result.pending_dir_exists,
    };
    if (global._gsdManifestMode) {
      compactResult._manifest = { files: manifestFiles };
    }
    return output(compactResult, raw);
  }

  output(result, raw);
}

function cmdInitMilestoneOp(cwd, raw) {
  const config = loadConfig(cwd);
  const milestone = getMilestoneInfo(cwd);

  // Count phases — use cached phase tree
  let phaseCount = 0;
  let completedPhases = 0;
  const phaseTree = getPhaseTree(cwd);
  phaseCount = phaseTree.size;
  for (const [, entry] of phaseTree) {
    if (entry.summaries.length > 0) completedPhases++;
  }

  // Check archive
  const archiveDir = path.join(cwd, '.planning', 'archive');
  let archivedMilestones = [];
  try {
    archivedMilestones = fs.readdirSync(archiveDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);
  } catch (e) { debugLog('init.milestoneOp', 'readdir failed', e); }

  const result = {
    // Config
    commit_docs: config.commit_docs,

    // Current milestone
    milestone_version: milestone.version,
    milestone_name: milestone.name,
    milestone_slug: generateSlugInternal(milestone.name),

    // Phase counts
    phase_count: phaseCount,
    completed_phases: completedPhases,
    all_phases_complete: phaseCount > 0 && phaseCount === completedPhases,

    // Archive
    archived_milestones: archivedMilestones,
    archive_count: archivedMilestones.length,

    // File existence
    project_exists: pathExistsInternal(cwd, '.planning/PROJECT.md'),
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
    state_exists: pathExistsInternal(cwd, '.planning/STATE.md'),
    archive_exists: pathExistsInternal(cwd, '.planning/archive'),
    phases_dir_exists: pathExistsInternal(cwd, '.planning/phases'),
  };

  if (global._gsdCompactMode) {
    const manifestFiles = [];
    if (result.roadmap_exists) manifestFiles.push({ path: '.planning/ROADMAP.md', sections: ['Milestones', 'Progress'], required: true });
    if (result.state_exists) manifestFiles.push({ path: '.planning/STATE.md', sections: ['Current Position'], required: true });

    const compactResult = {
      milestone_version: result.milestone_version,
      milestone_name: result.milestone_name,
      phase_count: result.phase_count,
      completed_phases: result.completed_phases,
      all_phases_complete: result.all_phases_complete,
      archived_milestones: result.archived_milestones,
      archive_count: result.archive_count,
    };
    if (global._gsdManifestMode) {
      compactResult._manifest = { files: manifestFiles };
    }
    return output(compactResult, raw);
  }

  output(result, raw);
}

function cmdInitMapCodebase(cwd, raw) {
  const config = loadConfig(cwd);

  // Check for existing codebase maps
  const codebaseDir = path.join(cwd, '.planning', 'codebase');
  let existingMaps = [];
  try {
    existingMaps = fs.readdirSync(codebaseDir).filter(f => f.endsWith('.md'));
  } catch (e) { debugLog('init.mapCodebase', 'readdir failed', e); }

  const result = {
    // Models
    mapper_model: resolveModelInternal(cwd, 'gsd-codebase-mapper'),

    // Config
    commit_docs: config.commit_docs,
    search_gitignored: config.search_gitignored,
    parallelization: config.parallelization,

    // Paths
    codebase_dir: '.planning/codebase',

    // Existing maps
    existing_maps: existingMaps,
    has_maps: existingMaps.length > 0,

    // File existence
    planning_exists: pathExistsInternal(cwd, '.planning'),
    codebase_dir_exists: pathExistsInternal(cwd, '.planning/codebase'),
  };

  if (global._gsdCompactMode) {
    const manifestFiles = result.existing_maps.map(m => ({ path: `.planning/codebase/${m}`, required: false }));
    if (pathExistsInternal(cwd, '.planning/PROJECT.md')) manifestFiles.push({ path: '.planning/PROJECT.md', sections: ['Tech Stack'], required: false });

    const compactResult = {
      existing_maps: result.existing_maps,
      has_maps: result.has_maps,
      planning_exists: result.planning_exists,
      codebase_dir_exists: result.codebase_dir_exists,
      parallelization: result.parallelization,
    };
    if (global._gsdManifestMode) {
      compactResult._manifest = { files: manifestFiles };
    }
    return output(compactResult, raw);
  }

  output(result, raw);
}

/**
 * Formatter for init progress — renders branded banner, progress bar, phase table, and action hints.
 * @param {object} result - The init progress result object
 * @returns {string}
 */
function formatInitProgress(result) {
  const lines = [];

  // 1. Branded banner
  lines.push(banner('Progress'));
  lines.push('');

  // 2. Milestone line
  if (result.milestone_version || result.milestone_name) {
    const version = result.milestone_version || '?';
    const name = result.milestone_name || '';
    lines.push(color.bold(`${version}`) + (name ? ` ${color.dim('\u2014')} ${name}` : ''));
    lines.push('');
  }

  // 3. Progress bar
  const completedCount = result.completed_count || 0;
  const phaseCount = result.phase_count || 0;
  const completedPercent = phaseCount > 0 ? Math.round((completedCount / phaseCount) * 100) : 0;
  lines.push(progressBar(completedPercent) + `  ${completedCount}/${phaseCount} phases`);
  lines.push('');

  // 4. Phase table
  if (result.phases && result.phases.length > 0) {
    lines.push(sectionHeader('Phases'));
    const rows = result.phases.map(p => {
      let statusIcon;
      if (p.status === 'complete') statusIcon = color.green(SYMBOLS.check);
      else if (p.status === 'in_progress') statusIcon = color.cyan(SYMBOLS.progress);
      else statusIcon = color.dim(SYMBOLS.pending);
      const plans = p.plan_count > 0 ? `${p.summary_count}/${p.plan_count}` : color.dim('TBD');
      return [p.number, statusIcon + ' ' + (p.status || 'pending'), p.name || '', plans];
    });
    lines.push(formatTable(['#', 'Status', 'Phase', 'Plans'], rows, { maxRows: 20, showAll: true }));
    lines.push('');
  }

  // 5. Current phase
  if (result.current_phase) {
    lines.push(sectionHeader('Current'));
    lines.push(` Phase ${result.current_phase.number}: ${result.current_phase.name || 'unnamed'}`);
    lines.push('');
  }

  // 6. Action hint for next phase
  if (result.next_phase) {
    lines.push(actionHint(`Next: /gsd-discuss-phase ${result.next_phase.number}`));
  }

  // 7. Session diff
  if (result.session_diff && result.session_diff.commit_count > 0) {
    lines.push('');
    lines.push(sectionHeader('Session'));
    lines.push(` ${result.session_diff.commit_count} commits since last session`);
    if (result.session_diff.recent && result.session_diff.recent.length > 0) {
      for (const commit of result.session_diff.recent.slice(0, 3)) {
        lines.push(color.dim(`   ${commit}`));
      }
    }
  }

  // 8. Summary line
  lines.push('');
  const milestoneSuffix = result.milestone_name ? ` \u2014 ${result.milestone_name}` : '';
  lines.push(summaryLine(`${completedCount}/${phaseCount} phases complete${milestoneSuffix}`));

  return lines.join('\n');
}

function cmdInitProgress(cwd, raw) {
  const config = loadConfig(cwd);
  const milestone = getMilestoneInfo(cwd);

  // Analyze phases — only include phases in current milestone range (cached tree)
  const phases = [];
  let currentPhase = null;
  let nextPhase = null;

  const phaseTree = getPhaseTree(cwd);
  for (const [, entry] of phaseTree) {
    const phaseNumber = entry.phaseNumber;

    // Filter to current milestone phase range if available
    if (milestone.phaseRange) {
      const num = parseInt(phaseNumber);
      if (num < milestone.phaseRange.start || num > milestone.phaseRange.end) continue;
    }

    const status = entry.summaries.length >= entry.plans.length && entry.plans.length > 0 ? 'complete' :
                   entry.plans.length > 0 ? 'in_progress' :
                   entry.hasResearch ? 'researched' : 'pending';

    const phaseInfo = {
      number: phaseNumber,
      name: entry.phaseName,
      directory: entry.relPath,
      status,
      plan_count: entry.plans.length,
      summary_count: entry.summaries.length,
      has_research: entry.hasResearch,
    };

    phases.push(phaseInfo);

    // Find current (first incomplete with plans) and next (first pending)
    if (!currentPhase && (status === 'in_progress' || status === 'researched')) {
      currentPhase = phaseInfo;
    }
    if (!nextPhase && status === 'pending') {
      nextPhase = phaseInfo;
    }
  }

  // Check for paused work
  let pausedAt = null;
  try {
    const state = cachedReadFile(path.join(cwd, '.planning', 'STATE.md'));
    const pauseMatch = state.match(/\*\*Paused At:\*\*\s*(.+)/);
    if (pauseMatch) pausedAt = pauseMatch[1].trim();
  } catch (e) { debugLog('init.progress', 'read failed', e); }

  const result = {
    // Models
    executor_model: resolveModelInternal(cwd, 'gsd-executor'),
    planner_model: resolveModelInternal(cwd, 'gsd-planner'),

    // Config
    commit_docs: config.commit_docs,

    // Milestone
    milestone_version: milestone.version,
    milestone_name: milestone.name,

    // Phase overview
    phases,
    phase_count: phases.length,
    completed_count: phases.filter(p => p.status === 'complete').length,
    in_progress_count: phases.filter(p => p.status === 'in_progress').length,

    // Current state
    current_phase: currentPhase,
    next_phase: nextPhase,
    paused_at: pausedAt,
    has_work_in_progress: !!currentPhase,

    // File existence
    project_exists: pathExistsInternal(cwd, '.planning/PROJECT.md'),
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
    state_exists: pathExistsInternal(cwd, '.planning/STATE.md'),
    // File paths
    state_path: '.planning/STATE.md',
    roadmap_path: '.planning/ROADMAP.md',
    project_path: '.planning/PROJECT.md',
    config_path: '.planning/config.json',

    // Session diff (what changed since last session)
    session_diff: getSessionDiffSummary(cwd),

    // Intent summary (null if no INTENT.md)
    intent_summary: null,
  };

  // Advisory intent summary — never crash, never block
  try {
    result.intent_summary = getIntentSummary(cwd);
  } catch (e) {
    debugLog('init.progress', 'intent summary failed (non-blocking)', e);
  }

  // Environment context — auto-trigger scan if needed, inject compact summary
  try {
    const envManifest = autoTriggerEnvScan(cwd);
    result.env_summary = formatEnvSummary(envManifest);
    result.env_languages = envManifest?.languages?.length || 0;
    result.env_stale = false;
  } catch (e) {
    debugLog('init.progress', 'env scan failed (non-blocking)', e);
    result.env_summary = null;
    result.env_languages = 0;
    result.env_stale = false;
  }

  // Codebase intelligence — auto-trigger analysis if stale, inject structured context
  try {
    const refreshMode = process.argv.includes('--refresh');
    if (refreshMode) {
      try { fs.unlinkSync(path.join(cwd, '.planning', '.cache', '.analyzing')); } catch { /* ignore */ }
    }
    const codebaseIntel = autoTriggerCodebaseIntel(cwd, { synchronous: refreshMode });
    const ctx = formatCodebaseContext(codebaseIntel, cwd);
    result.codebase_stats = ctx.codebase_stats;
    result.codebase_conventions = ctx.codebase_conventions;
    result.codebase_dependencies = ctx.codebase_dependencies;
    result.codebase_freshness = ctx.codebase_freshness;
    result.codebase_intel_exists = !!codebaseIntel;
  } catch (e) {
    debugLog('init.progress', 'codebase intel failed (non-blocking)', e);
    result.codebase_stats = null;
    result.codebase_conventions = null;
    result.codebase_dependencies = null;
    result.codebase_freshness = null;
    result.codebase_intel_exists = false;
  }

  if (global._gsdCompactMode) {
    const manifestFiles = [];
    if (result.state_exists) manifestFiles.push({ path: '.planning/STATE.md', sections: ['Current Position'], required: false });
    if (result.roadmap_exists) manifestFiles.push({ path: '.planning/ROADMAP.md', sections: ['Progress'], required: false });

    const compactResult = {
      milestone_version: result.milestone_version,
      milestone_name: result.milestone_name,
      phases: result.phases,
      phase_count: result.phase_count,
      completed_count: result.completed_count,
      in_progress_count: result.in_progress_count,
      current_phase: result.current_phase,
      next_phase: result.next_phase,
      has_work_in_progress: result.has_work_in_progress,
      session_diff: result.session_diff,
      intent_summary: result.intent_summary || null,
      env_summary: result.env_summary || null,
      codebase_stats: result.codebase_stats || null,
      codebase_conventions: result.codebase_conventions || null,
      codebase_dependencies: result.codebase_dependencies || null,
      codebase_freshness: result.codebase_freshness || null,
      codebase_intel_exists: result.codebase_intel_exists || false,
    };
    // Trim null codebase fields from compact output
    if (!compactResult.codebase_stats) delete compactResult.codebase_stats;
    if (!compactResult.codebase_conventions) delete compactResult.codebase_conventions;
    if (!compactResult.codebase_dependencies) delete compactResult.codebase_dependencies;
    if (!compactResult.codebase_freshness) delete compactResult.codebase_freshness;
    if (global._gsdManifestMode) {
      compactResult._manifest = { files: manifestFiles };
    }
    return output(compactResult, { formatter: formatInitProgress });
  }

  // Trim null/empty fields from verbose output to reduce token waste
  if (result.intent_summary === null) delete result.intent_summary;
  if (result.env_summary === null) { delete result.env_summary; delete result.env_languages; delete result.env_stale; }
  if (result.codebase_stats === null) { delete result.codebase_stats; delete result.codebase_intel_exists; }
  if (result.codebase_conventions === null) delete result.codebase_conventions;
  if (result.codebase_dependencies === null) delete result.codebase_dependencies;
  if (result.codebase_freshness === null) delete result.codebase_freshness;
  if (result.paused_at === null) delete result.paused_at;
  if (result.session_diff === null) delete result.session_diff;

  output(result, { formatter: formatInitProgress });
}

function cmdInitMemory(cwd, args, raw) {
  // Parse flags from args array
  const workflowIdx = args.indexOf('--workflow');
  const workflow = workflowIdx !== -1 ? args[workflowIdx + 1] : null;
  const phaseIdx = args.indexOf('--phase');
  const phaseFilter = phaseIdx !== -1 ? args[phaseIdx + 1] : null;
  const compact = args.includes('--compact') || global._gsdCompactMode;

  const maxChars = compact ? 4000 : 8000;
  const trimmed = [];

  // 1. Position — parse STATE.md
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  const stateContent = safeReadFile(statePath);
  const position = {};
  if (stateContent) {
    const phaseMatch = stateContent.match(/\*\*Phase:?\*\*:?\s*(.+)/i);
    if (phaseMatch) position.phase = phaseMatch[1].trim();
    const nameMatch = stateContent.match(/\*\*Phase Name:?\*\*:?\s*(.+)/i);
    if (nameMatch) position.phase_name = nameMatch[1].trim();
    const planMatch = stateContent.match(/\*\*Plan:?\*\*:?\s*(.+)/i);
    if (planMatch) position.plan = planMatch[1].trim();
    const statusMatch = stateContent.match(/\*\*Status:?\*\*:?\s*(.+)/i);
    if (statusMatch) position.status = statusMatch[1].trim();
    const lastMatch = stateContent.match(/\*\*Last [Aa]ctivity:?\*\*:?\s*(.+)/i);
    if (lastMatch) position.last_activity = lastMatch[1].trim();
    const stoppedMatch = stateContent.match(/\*\*Stopped [Aa]t:?\*\*:?\s*(.+)/i);
    if (stoppedMatch) position.stopped_at = stoppedMatch[1].trim();
  }

  // 2. Bookmark — read from memory store
  let bookmark = null;
  const bookmarksPath = path.join(cwd, '.planning', 'memory', 'bookmarks.json');
  const bookmarksContent = safeReadFile(bookmarksPath);
  if (bookmarksContent) {
    try {
      const bookmarks = JSON.parse(bookmarksContent);
      if (Array.isArray(bookmarks) && bookmarks.length > 0) {
        bookmark = bookmarks[0];
        // Drift warning: check if git HEAD changed since bookmark's git_head
        if (bookmark.git_head && phaseFilter && String(bookmark.phase) === String(phaseFilter)) {
          try {
            const headResult = execGit(cwd, ['rev-parse', 'HEAD']);
            if (headResult.exitCode === 0 && headResult.stdout !== bookmark.git_head) {
              // Check if relevant files changed
              const diffResult = execGit(cwd, ['diff', '--name-only', bookmark.git_head, 'HEAD']);
              if (diffResult.exitCode === 0 && diffResult.stdout) {
                const changedFiles = diffResult.stdout.split('\n').filter(Boolean);
                const relevantChanges = changedFiles.filter(f =>
                  (bookmark.last_file && f === bookmark.last_file) ||
                  f.startsWith('.planning/')
                );
                if (relevantChanges.length > 0) {
                  bookmark.drift_warning = `${relevantChanges.length} relevant file(s) changed since bookmark`;
                } else {
                  bookmark.drift_warning = null;
                }
              } else {
                bookmark.drift_warning = null;
              }
            } else {
              bookmark.drift_warning = null;
            }
          } catch (e) {
            debugLog('init.memory', 'git drift check failed', e);
            bookmark.drift_warning = null;
          }
        } else {
          bookmark.drift_warning = null;
        }
      }
    } catch (e) { debugLog('init.memory', 'parse bookmarks failed', e); }
  }

  // 3. Decisions — read from memory store
  let decisions = [];
  const decisionsPath = path.join(cwd, '.planning', 'memory', 'decisions.json');
  const decisionsContent = safeReadFile(decisionsPath);
  if (decisionsContent) {
    try {
      let all = JSON.parse(decisionsContent);
      if (Array.isArray(all)) {
        if (phaseFilter) {
          all = all.filter(d => d.phase && String(d.phase) === String(phaseFilter));
        }
        const limit = compact ? 5 : 10;
        decisions = all.slice(-limit).reverse();
      }
    } catch (e) { debugLog('init.memory', 'parse decisions failed', e); }
  }

  // 4. Blockers/Todos — parse STATE.md sections
  let blockers = [];
  let todos = [];
  if (stateContent) {
    // Extract blockers
    const blockerMatch = stateContent.match(/###\s*Blockers\/Concerns\s*\n([\s\S]*?)(?=\n##|\n###|$)/i);
    if (blockerMatch) {
      blockers = blockerMatch[1].split('\n')
        .filter(l => /^\s*[-*]\s+/.test(l))
        .map(l => l.replace(/^\s*[-*]\s+/, '').trim())
        .filter(Boolean);
    }
    // Extract todos
    const todoMatch = stateContent.match(/###\s*Pending Todos\s*\n([\s\S]*?)(?=\n##|\n###|$)/i);
    if (todoMatch) {
      todos = todoMatch[1].split('\n')
        .filter(l => /^\s*[-*]\s+/.test(l))
        .map(l => l.replace(/^\s*[-*]\s+/, '').trim())
        .filter(Boolean);
    }
  }

  // 5. Lessons — read from memory store
  let lessons = [];
  const lessonsPath = path.join(cwd, '.planning', 'memory', 'lessons.json');
  const lessonsContent = safeReadFile(lessonsPath);
  if (lessonsContent) {
    try {
      let all = JSON.parse(lessonsContent);
      if (Array.isArray(all)) {
        if (phaseFilter) {
          all = all.filter(l => l.phase && String(l.phase) === String(phaseFilter));
        }
        lessons = all.slice(-5);
      }
    } catch (e) { debugLog('init.memory', 'parse lessons failed', e); }
  }

  // 6. Codebase knowledge — based on workflow
  const codebaseDir = path.join(cwd, '.planning', 'codebase');
  let sectionsToLoad = [];
  switch (workflow) {
    case 'execute-phase':
    case 'execute-plan':
      sectionsToLoad = ['CONVENTIONS.md', 'ARCHITECTURE.md'];
      break;
    case 'plan-phase':
      sectionsToLoad = ['ARCHITECTURE.md', 'STACK.md', 'CONCERNS.md'];
      break;
    case 'verify-work':
      sectionsToLoad = ['TESTING.md', 'CONVENTIONS.md'];
      break;
    case 'quick':
      sectionsToLoad = ['CONVENTIONS.md'];
      break;
    default:
      sectionsToLoad = ['ARCHITECTURE.md'];
      break;
  }

  const codebaseContent = {};
  const sectionsLoaded = [];
  for (const section of sectionsToLoad) {
    const filePath = path.join(codebaseDir, section);
    const content = safeReadFile(filePath);
    if (content) {
      // Read first 50 lines
      const lines = content.split('\n').slice(0, 50).join('\n');
      const key = section.replace('.md', '').toLowerCase();
      codebaseContent[key] = lines;
      sectionsLoaded.push(section);
    }
  }

  const codebase = {
    sections_loaded: sectionsLoaded,
    content: codebaseContent,
  };

  // Build result
  const result = {
    position,
    bookmark,
    decisions,
    blockers,
    todos,
    lessons,
    codebase,
    digest_lines: decisions.length + blockers.length + todos.length + lessons.length,
    workflow: workflow || null,
    trimmed,
  };

  // 7. Priority trimming — if JSON exceeds maxChars
  let jsonStr = JSON.stringify(result);
  if (jsonStr.length > maxChars) {
    // First cut: codebase.content → {}
    result.codebase.content = {};
    result.codebase.sections_loaded = [];
    trimmed.push('codebase');
    jsonStr = JSON.stringify(result);
  }
  if (jsonStr.length > maxChars) {
    // Second: lessons to 2
    result.lessons = result.lessons.slice(0, 2);
    trimmed.push('lessons');
    jsonStr = JSON.stringify(result);
  }
  if (jsonStr.length > maxChars) {
    // Third: decisions to 3
    result.decisions = result.decisions.slice(0, 3);
    trimmed.push('decisions');
    jsonStr = JSON.stringify(result);
  }
  if (jsonStr.length > maxChars) {
    // Fourth: todos to 2
    result.todos = result.todos.slice(0, 2);
    trimmed.push('todos');
    jsonStr = JSON.stringify(result);
  }

  // Update digest_lines after trimming
  result.digest_lines = result.decisions.length + result.blockers.length + result.todos.length + result.lessons.length;

  output(result, raw);
}

function getSessionDiffSummary(cwd) {
  try {
    const state = cachedReadFile(path.join(cwd, '.planning', 'STATE.md'));
    let since = null;
    const lastMatch = state.match(/\*\*Last Activity:\*\*\s*(\d{4}-\d{2}-\d{2})/);
    if (lastMatch) since = lastMatch[1];
    const sessionMatch = state.match(/\*\*Last session:\*\*\s*(\S+)/);
    if (sessionMatch && sessionMatch[1] > (since || '')) since = sessionMatch[1].split('T')[0];
    if (!since) return null;
    if (!isValidDateString(since)) {
      debugLog('feature.sessionDiff', `invalid date string rejected: ${since}`);
      return null;
    }

    const gitResult = execGit(cwd, ['log', `--since=${since}`, '--oneline', '--no-merges', '--', '.planning/']);
    const log = gitResult.stdout || '';
    const commits = log ? log.split('\n').filter(Boolean) : [];
    return { since, commit_count: commits.length, recent: commits.slice(0, 5) };
  } catch (e) {
    debugLog('feature.sessionDiff', 'exec failed', e);
    return null;
  }
}

module.exports = {
  cmdInitExecutePhase,
  cmdInitPlanPhase,
  cmdInitNewProject,
  cmdInitNewMilestone,
  cmdInitQuick,
  cmdInitResume,
  cmdInitVerifyWork,
  cmdInitPhaseOp,
  cmdInitTodos,
  cmdInitMilestoneOp,
  cmdInitMapCodebase,
  cmdInitProgress,
  cmdInitMemory,
  getSessionDiffSummary,
};
