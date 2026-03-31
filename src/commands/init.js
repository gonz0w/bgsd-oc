'use strict';

const fs = require('fs');
const path = require('path');
const { output, error, debugLog } = require('../lib/output');
const { getDb } = require('../lib/db');
const { PlanningCache } = require('../lib/planning-cache');
const { banner, sectionHeader, progressBar, formatTable, summaryLine, actionHint, color, SYMBOLS, colorByPercent } = require('../lib/format');
const { loadConfig, readRawConfig } = require('../lib/config');
const { safeReadFile, cachedReadFile, findPhaseInternal, resolveModelInternal, getRoadmapPhaseInternal, getMilestoneInfo, getArchivedPhaseDirs, normalizePhaseName, isValidDateString, sanitizeShellArg, pathExistsInternal, generateSlugInternal, getPhaseTree, normalizePhasePlanFilesTddMetadata, buildPhaseSnapshotInternal, buildPhaseHandoffExpectedFingerprint, getRuntimeFreshness } = require('../lib/helpers');
const { extractFrontmatter } = require('../lib/frontmatter');
const { execGit } = require('../lib/git');
const { buildPhaseHandoffValidation, listPhaseHandoffArtifacts } = require('../lib/phase-handoff');
const { getQuestionTemplate } = require('../lib/questions');
const { getIntentDriftData, getIntentSummary, getEffectiveIntent } = require('./intent');
const { autoTriggerEnvScan, formatEnvSummary, readEnvManifest } = require('./env');
const { autoTriggerCodebaseIntel, readCodebaseIntel } = require('./codebase');
const { createMilestoneLessonSnapshot } = require('./lessons');
const { requireJjForExecution, buildPlanningCapabilityContext } = require('../lib/jj');
const { getPhaseFilesModified, listActiveWorkspaceInventory } = require('./workspace');
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

function getSnapshotArtifacts(snapshot) {
  const artifacts = snapshot?.artifacts || {};
  return {
    context_path: artifacts.context || undefined,
    research_path: artifacts.research || undefined,
    verification_path: artifacts.verification || undefined,
    uat_path: artifacts.uat || undefined,
    plan_paths: Array.isArray(artifacts.plans) ? artifacts.plans : [],
    summary_paths: Array.isArray(artifacts.summaries) ? artifacts.summaries : [],
  };
}

function getSnapshotPhaseInfo(cwd, phase) {
  const snapshot = buildPhaseSnapshotInternal(cwd, phase);
  if (!snapshot?.found) {
    return { snapshot: null, metadata: null, artifacts: getSnapshotArtifacts(null), phaseInfo: null };
  }

  const metadata = snapshot.metadata || {};
  return {
    snapshot,
    metadata,
    artifacts: getSnapshotArtifacts(snapshot),
    phaseInfo: metadata.directory ? findPhaseInternal(cwd, metadata.number || phase) : null,
  };
}

function summarizeRuntimeFreshnessForPlans(cwd, planPaths = []) {
  const filesModified = [];

  for (const planPath of planPaths) {
    const fullPath = path.isAbsolute(planPath) ? planPath : path.join(cwd, planPath);
    const content = safeReadFile(fullPath);
    if (!content) continue;
    const frontmatter = extractFrontmatter(content);
    const files = Array.isArray(frontmatter.files_modified)
      ? frontmatter.files_modified
      : frontmatter.files_modified
        ? [frontmatter.files_modified]
        : [];
    filesModified.push(...files);
  }

  return getRuntimeFreshness(cwd, filesModified);
}

function buildPhaseHandoffOptionContract() {
  const template = getQuestionTemplate('phase-handoff-resume-summary') || {};
  return Array.isArray(template.options)
    ? template.options.map(({ id, label, description }) => ({ id, label, description: description || null }))
    : [
        { id: 'resume', label: 'Resume', description: 'Continue from the latest valid handoff artifact' },
        { id: 'inspect', label: 'Inspect', description: 'Review the active handoff details before continuing' },
        { id: 'restart', label: 'Restart', description: 'Clear the handoff set and restart from discuss' },
      ];
}

function derivePhaseHandoffNextSafeCommand(phase, latestArtifact) {
  const normalizedPhase = normalizePhaseName(String(phase || '')).trim();
  if (!normalizedPhase || !latestArtifact) return null;

  const explicitCommand = latestArtifact.resume_target && typeof latestArtifact.resume_target.next_command === 'string'
    ? latestArtifact.resume_target.next_command.trim()
    : '';
  if (explicitCommand) return explicitCommand;

  const safePhase = /^[A-Za-z0-9._-]+$/.test(normalizedPhase) ? normalizedPhase : sanitizeShellArg(normalizedPhase);
  switch (latestArtifact.step) {
    case 'discuss':
      return `/bgsd-plan research ${safePhase}`;
    case 'research':
      return `/bgsd-plan phase ${safePhase}`;
    case 'plan':
      return `/bgsd-execute-phase ${safePhase}`;
    case 'execute':
      return `/bgsd-verify-work ${safePhase}`;
    default:
      return null;
  }
}

function buildPhaseHandoffResumeSummary(cwd, phase, phaseName) {
  const normalizedPhase = normalizePhaseName(String(phase || '')).trim();
  if (!normalizedPhase) return null;

  const entries = listPhaseHandoffArtifacts(cwd, normalizedPhase);
  if (entries.length === 0) return null;

  const expectedFingerprint = buildPhaseHandoffExpectedFingerprint(cwd, normalizedPhase);
  const validation = buildPhaseHandoffValidation(entries, { phase: normalizedPhase, expected_fingerprint: expectedFingerprint });
  const latestArtifact = validation.latest_valid_artifact || null;
  const extractTddAudits = (artifact) => {
    const audits = artifact && artifact.context && Array.isArray(artifact.context.tdd_audits)
      ? artifact.context.tdd_audits
      : [];
    return audits.map((entry) => ({ ...entry }));
  };
  const latestArtifactFile = validation.valid_artifacts.find((artifact) => (
    latestArtifact
      && artifact.step === latestArtifact.step
      && artifact.run_id === validation.selected_run_id
  )) || null;
  const producedArtifacts = validation.valid_artifacts.map((artifact) => {
    const sourceEntry = entries.find((entry) => entry.valid && entry.file === artifact.file);
    return {
      ...artifact,
      tdd_audits: extractTddAudits(sourceEntry && sourceEntry.artifact),
    };
  });
  const nextSafeCommand = derivePhaseHandoffNextSafeCommand(normalizedPhase, latestArtifact);
  const optionContract = buildPhaseHandoffOptionContract();
  const safePhase = /^[A-Za-z0-9._-]+$/.test(normalizedPhase) ? normalizedPhase : sanitizeShellArg(normalizedPhase);
  const defaultRestartCommands = [
    `node /Users/cam/.config/opencode/bgsd-oc/bin/bgsd-tools.cjs verify:state handoff clear --phase ${normalizedPhase}`,
    `/bgsd-plan discuss ${safePhase}`,
  ];

  return {
    available: true,
    phase: normalizedPhase,
    phase_name: phaseName || null,
    artifact_count: entries.length,
    selected_run_id: validation.selected_run_id,
    expected_fingerprint: expectedFingerprint,
    latest_valid_step: validation.latest_valid_step,
    next_safe_command: nextSafeCommand,
    valid: validation.valid,
    stale_sources: validation.stale_sources,
    options: optionContract,
    inspection: {
      latest_valid_artifact: latestArtifact
        ? {
            file: latestArtifactFile ? latestArtifactFile.file : null,
            step: latestArtifact.step,
            status: latestArtifact.status,
            updated_at: latestArtifact.updated_at,
            summary: latestArtifact.summary || '',
            source_fingerprint: latestArtifact.source_fingerprint,
            resume_target: latestArtifact.resume_target || {},
            tdd_audits: extractTddAudits(latestArtifact),
          }
        : null,
      produced_artifacts: producedArtifacts,
      invalid_artifacts: validation.invalid_artifacts,
    },
    repair_guidance: validation.repair_guidance || {
      action: 'restart',
      message: 'Clear the current handoff artifacts and restart from discuss to rebuild deterministic chain state.',
      commands: defaultRestartCommands,
    },
  };
}

function buildJjPlanningContext(rawConfig) {
  return buildPlanningCapabilityContext({
    workspace: {
      base_path: rawConfig?.workspace?.base_path,
      max_concurrent: rawConfig?.workspace?.max_concurrent,
    },
  });
}

function cmdInitExecutePhase(cwd, phase, raw) {
  if (!phase) {
    error('phase required for init execute-phase');
  }

  const config = loadConfig(cwd);
  requireJjForExecution(cwd, 'init:execute-phase');
  const snapshotInfo = getSnapshotPhaseInfo(cwd, phase);
  const snapshot = snapshotInfo.snapshot;
  const metadata = snapshotInfo.metadata;
  const milestone = getMilestoneInfo(cwd);
  const handoffResumeSummary = buildPhaseHandoffResumeSummary(cwd, metadata?.number || phase, metadata?.name || null);

  // Read raw config for gates and workspace metadata (not in CONFIG_SCHEMA)
  let rawConfig = {};
  try {
    rawConfig = readRawConfig(cwd) || {};
  } catch (e) { debugLog('init.executePhase', 'raw config read failed', e); }

  const result = {
    // Models
    executor_model: resolveModelInternal(cwd, 'bgsd-executor'),
    verifier_model: resolveModelInternal(cwd, 'bgsd-verifier'),

    // Config flags
    commit_docs: config.commit_docs,
    parallelization: config.parallelization,
    branching_strategy: config.branching_strategy,
    phase_branch_template: config.phase_branch_template,
    milestone_branch_template: config.milestone_branch_template,
    verifier_enabled: config.verifier,

    // Phase info
    phase_found: !!snapshot,
    phase_dir: metadata?.directory || null,
    phase_number: metadata?.number || null,
    phase_name: metadata?.name || null,
    phase_slug: metadata?.slug || null,

    // Plan inventory
    plans: snapshotInfo.artifacts.plan_paths.map(planPath => path.basename(planPath)),
    summaries: snapshotInfo.artifacts.summary_paths.map(summaryPath => path.basename(summaryPath)),
    incomplete_plans: snapshot?.execution_context?.incomplete_plans || [],
    plan_count: snapshot?.execution_context?.plan_count || 0,
    incomplete_count: snapshot?.execution_context?.incomplete_count || 0,

    // Branch name (pre-computed)
    branch_name: config.branching_strategy === 'phase' && metadata?.number
      ? config.phase_branch_template
          .replace('{phase}', metadata.number)
          .replace('{slug}', metadata.slug || 'phase')
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

    // JJ workspace execution metadata
    workspace_enabled: true,
    workspace_config: {
      base_path: rawConfig.workspace?.base_path || '/tmp/gsd-workspaces',
      max_concurrent: rawConfig.workspace?.max_concurrent || 3,
    },
    workspace_active: [],
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

    // Trajectory dead-end context (null if no failed approaches)
    previous_attempts: null,
    runtime_freshness: summarizeRuntimeFreshnessForPlans(cwd, snapshot?.artifacts?.plans || []),
  };
  if (handoffResumeSummary) result.resume_summary = handoffResumeSummary;

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

  // Codebase intelligence — read existing intel (fast) or auto-trigger if --refresh
  try {
    const refreshMode = process.argv.includes('--refresh');
    let codebaseIntel;
    if (refreshMode) {
      // --refresh mode: clear lock, run synchronous analysis
      try { fs.unlinkSync(path.join(cwd, '.planning', '.cache', '.analyzing')); } catch { /* ignore */ }
      codebaseIntel = autoTriggerCodebaseIntel(cwd, { synchronous: true });
    } else {
      // Fast path: read existing intel without git staleness check (~100ms savings)
      // Background analysis is triggered by other commands; init just reads cached data
      codebaseIntel = readCodebaseIntel(cwd);
    }
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

  // RAG capabilities — non-blocking advisory
  try {
    const research = require('./research');
    const cliTools = research.detectCliTools(cwd);
    const mcpServers = research.detectMcpServers(cwd);
    const cliAvailable = Object.entries(cliTools)
      .filter(([, t]) => t.available)
      .map(([name]) => name);
    const mcpAvailable = Object.entries(mcpServers)
      .filter(([k, s]) => k !== 'warning' && s.configured && s.enabled)
      .map(([id]) => id);
    const allTools = [...cliAvailable, ...mcpAvailable];
    const ragEnabled = config.rag_enabled !== false;
    const tier = research.calculateTier(cliTools, mcpServers, ragEnabled);

    result.rag_capabilities = {
      tier: tier.number,
      tool_count: allTools.length,
      tools: allTools,
    };
  } catch (e) {
    debugLog('init.executePhase', 'rag capabilities failed (non-blocking)', e);
    result.rag_capabilities = null;
  }

  // Trajectory dead-end context — previous attempts for this phase
  try {
    const { queryDeadEnds, formatDeadEndContext } = require('./trajectory');
    const deadEnds = queryDeadEnds(cwd, { scope: 'phase' });
    if (deadEnds.length > 0) {
      result.previous_attempts = {
        count: deadEnds.length,
        context: formatDeadEndContext(deadEnds, 500),
        entries: deadEnds.slice(0, 5).map(de => ({
          name: de.checkpoint_name,
          attempt: de.attempt,
          reason: de.reason,
          timestamp: de.timestamp,
        })),
      };
    } else {
      result.previous_attempts = null;
    }
  } catch (e) {
    debugLog('init.executePhase', 'trajectory dead-end context failed (non-blocking)', e);
    result.previous_attempts = null;
  }

  // Orchestration intelligence — classify tasks and recommend routing
  try {
    const { classifyPlan, selectExecutionMode } = require('../lib/orchestration');
    const planClassifications = [];
      for (const planFile of (snapshot?.execution_context?.incomplete_plans || [])) {
        const planPath = metadata?.directory ? path.join(cwd, metadata.directory, planFile) : null;
        if (!planPath) continue;
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

  // Workspace context — overlap analysis stays relevant for JJ-backed execution
  try {
    if (metadata?.number) {
      result.workspace_active = listActiveWorkspaceInventory(cwd, metadata.number);
    }
    if (metadata?.number) {
      const phasePlans = getPhaseFilesModified(cwd, metadata.number);
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
  } catch (e) {
    debugLog('init.executePhase', 'workspace context failed (non-blocking)', e);
  }

  // Agent-scoped context — filter output to agent-declared fields
  const agentArg = process.argv.find(a => a.startsWith('--agent='));
  if (agentArg) {
    const agentType = agentArg.split('=')[1];
    if (agentType) {
      const { scopeContextForAgent } = require('../lib/context');
      return output(scopeContextForAgent(result, agentType), raw);
    }
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
      workspace_enabled: result.workspace_enabled,
      workspace_config: result.workspace_config,
      workspace_active: result.workspace_active,
      file_overlaps: result.file_overlaps,
      task_routing: result.task_routing || null,
      previous_attempts: result.previous_attempts || null,
      rag_capabilities: result.rag_capabilities || null,
      runtime_freshness: result.runtime_freshness && result.runtime_freshness.checked ? result.runtime_freshness : null,
    };
    if (result.resume_summary) compactResult.resume_summary = result.resume_summary;
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

  // Trim null sections from verbose output to reduce token waste
  if (result.intent_drift === null) delete result.intent_drift;
  if (result.intent_summary === null) delete result.intent_summary;
  if (result.env_summary === null) { delete result.env_summary; delete result.env_languages; delete result.env_stale; }
  if (result.codebase_stats === null) delete result.codebase_stats;
  if (result.codebase_conventions === null) delete result.codebase_conventions;
  if (result.codebase_dependencies === null) delete result.codebase_dependencies;
  if (result.codebase_freshness === null) delete result.codebase_freshness;
  if (result.previous_attempts === null) delete result.previous_attempts;
  if (result.rag_capabilities === null) delete result.rag_capabilities;
  if (!result.runtime_freshness || !result.runtime_freshness.checked) delete result.runtime_freshness;
  if (!result.resume_summary) delete result.resume_summary;

  output(result, raw);
}

function cmdInitPlanPhase(cwd, phase, raw) {
  if (!phase) {
    error('phase required for init plan-phase');
  }

  const config = loadConfig(cwd);
  const snapshotInfo = getSnapshotPhaseInfo(cwd, phase);
  const snapshot = snapshotInfo.snapshot;
  const metadata = snapshotInfo.metadata;
  const phaseInfo = snapshotInfo.phaseInfo;
  const roadmapPhase = getRoadmapPhaseInternal(cwd, phase);
  const handoffResumeSummary = buildPhaseHandoffResumeSummary(cwd, metadata?.number || phase, metadata?.name || null);
  normalizePhasePlanFilesTddMetadata(cwd, phaseInfo);
  let rawConfig = {};
  try {
    rawConfig = readRawConfig(cwd) || {};
  } catch (e) { debugLog('init.planPhase', 'raw config read failed', e); }

  const result = {
    // Models
    researcher_model: resolveModelInternal(cwd, 'bgsd-phase-researcher'),
    planner_model: resolveModelInternal(cwd, 'bgsd-planner'),
    checker_model: resolveModelInternal(cwd, 'bgsd-plan-checker'),

    // Workflow flags
    research_enabled: config.research,
    plan_checker_enabled: config.plan_checker,
    commit_docs: config.commit_docs,

    // Phase info
    phase_found: !!snapshot,
    phase_dir: metadata?.directory || null,
    phase_number: metadata?.number || null,
    phase_name: metadata?.name || null,
    phase_slug: metadata?.slug || null,
    padded_phase: metadata?.number?.padStart(2, '0') || null,
    tdd: roadmapPhase?.tdd || null,

    // Existing artifacts
    has_research: !!snapshot?.execution_context?.has_research,
    has_context: !!snapshot?.execution_context?.has_context,
    has_plans: (snapshot?.execution_context?.plan_count || 0) > 0,
    plan_count: snapshot?.execution_context?.plan_count || 0,

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
    effective_intent: null,
    jj_planning_context: buildJjPlanningContext(rawConfig),
  };
  if (handoffResumeSummary) result.resume_summary = handoffResumeSummary;

  // Advisory intent summary — never crash, never block
  try {
    result.intent_summary = getIntentSummary(cwd);
    result.effective_intent = getEffectiveIntent(cwd, { phase: metadata?.number || phase });
    const intentFile = path.join(cwd, '.planning', 'INTENT.md');
    if (fs.existsSync(intentFile)) {
      result.intent_path = '.planning/INTENT.md';
    }
  } catch (e) {
    debugLog('init.planPhase', 'intent summary failed (non-blocking)', e);
  }

  // Codebase intelligence — read existing intel (fast) or auto-trigger if --refresh
  try {
    const refreshMode = process.argv.includes('--refresh');
    let codebaseIntel;
    if (refreshMode) {
      try { fs.unlinkSync(path.join(cwd, '.planning', '.cache', '.analyzing')); } catch { /* ignore */ }
      codebaseIntel = autoTriggerCodebaseIntel(cwd, { synchronous: true });
    } else {
      // Fast path: read existing intel without git staleness check (~100ms savings)
      codebaseIntel = readCodebaseIntel(cwd);
    }
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

  // RAG capabilities — non-blocking advisory
  try {
    const research = require('./research');
    const cliTools = research.detectCliTools(cwd);
    const mcpServers = research.detectMcpServers(cwd);
    const cliAvailable = Object.entries(cliTools)
      .filter(([, t]) => t.available)
      .map(([name]) => name);
    const mcpAvailable = Object.entries(mcpServers)
      .filter(([k, s]) => k !== 'warning' && s.configured && s.enabled)
      .map(([id]) => id);
    const allTools = [...cliAvailable, ...mcpAvailable];
    const ragEnabled = config.rag_enabled !== false;
    const tier = research.calculateTier(cliTools, mcpServers, ragEnabled);

    result.rag_capabilities = {
      tier: tier.number,
      tool_count: allTools.length,
      tools: allTools,
    };
  } catch (e) {
    debugLog('init.planPhase', 'rag capabilities failed (non-blocking)', e);
    result.rag_capabilities = null;
  }

  if (snapshot) {
    if (snapshotInfo.artifacts.context_path) result.context_path = snapshotInfo.artifacts.context_path;
    if (snapshotInfo.artifacts.research_path) result.research_path = snapshotInfo.artifacts.research_path;
    if (snapshotInfo.artifacts.verification_path) result.verification_path = snapshotInfo.artifacts.verification_path;
    if (snapshotInfo.artifacts.uat_path) result.uat_path = snapshotInfo.artifacts.uat_path;
  }

  // Agent-scoped context — filter output to agent-declared fields
  const agentArg = process.argv.find(a => a.startsWith('--agent='));
  if (agentArg) {
    const agentType = agentArg.split('=')[1];
    if (agentType) {
      const { scopeContextForAgent } = require('../lib/context');
      return output(scopeContextForAgent(result, agentType), raw);
    }
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
    if (result.effective_intent) compactResult.effective_intent = result.effective_intent;
    if (result.jj_planning_context) compactResult.jj_planning_context = result.jj_planning_context;
    if (result.codebase_stats) compactResult.codebase_stats = result.codebase_stats;
    if (result.codebase_conventions) compactResult.codebase_conventions = result.codebase_conventions;
    if (result.codebase_dependencies) compactResult.codebase_dependencies = result.codebase_dependencies;
    if (result.codebase_freshness) compactResult.codebase_freshness = result.codebase_freshness;
    if (result.context_path) compactResult.context_path = result.context_path;
    if (result.research_path) compactResult.research_path = result.research_path;
    if (result.verification_path) compactResult.verification_path = result.verification_path;
    if (result.uat_path) compactResult.uat_path = result.uat_path;
    if (result.tdd !== null) compactResult.tdd = result.tdd;
    if (result.rag_capabilities) compactResult.rag_capabilities = result.rag_capabilities;
    if (result.resume_summary) compactResult.resume_summary = result.resume_summary;

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
  if (result.effective_intent === null) delete result.effective_intent;
  if (result.rag_capabilities === null) delete result.rag_capabilities;
  if (result.codebase_stats === null) delete result.codebase_stats;
  if (result.codebase_conventions === null) delete result.codebase_conventions;
  if (result.codebase_dependencies === null) delete result.codebase_dependencies;
  if (result.codebase_freshness === null) delete result.codebase_freshness;
  if (!result.resume_summary) delete result.resume_summary;

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
    researcher_model: resolveModelInternal(cwd, 'bgsd-project-researcher'),
    synthesizer_model: resolveModelInternal(cwd, 'bgsd-roadmapper'),  // merged from bgsd-research-synthesizer
    roadmapper_model: resolveModelInternal(cwd, 'bgsd-roadmapper'),

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
  let rawConfig = {};
  try {
    rawConfig = readRawConfig(cwd) || {};
  } catch (e) { debugLog('init.newMilestone', 'raw config read failed', e); }

  const result = {
    // Models
    researcher_model: resolveModelInternal(cwd, 'bgsd-project-researcher'),
    synthesizer_model: resolveModelInternal(cwd, 'bgsd-roadmapper'),  // merged from bgsd-research-synthesizer
    roadmapper_model: resolveModelInternal(cwd, 'bgsd-roadmapper'),

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

    // Advisory planning context
    effective_intent: null,
    jj_planning_context: buildJjPlanningContext(rawConfig),
  };

  try {
    const lessonSnapshot = createMilestoneLessonSnapshot(cwd, milestone);
    result.lesson_snapshot_path = lessonSnapshot.snapshot_path;
    result.lesson_snapshot_generated_at = lessonSnapshot.snapshot.generated_at;
    result.lesson_snapshot_lesson_count = lessonSnapshot.snapshot.source?.lesson_count || 0;
    result.lesson_snapshot_source_hash = lessonSnapshot.snapshot.source?.source_hash || null;
    result.lesson_snapshot_metadata = {
      milestone: lessonSnapshot.snapshot.milestone,
      grouping_version: lessonSnapshot.snapshot.grouping_version,
      source: lessonSnapshot.snapshot.source,
      reused: lessonSnapshot.reused,
    };
    result.remediation_summary = lessonSnapshot.snapshot.compact_summary;
    result.remediation_buckets = Array.isArray(lessonSnapshot.snapshot.buckets)
      ? lessonSnapshot.snapshot.buckets.map(bucket => ({
          id: bucket.id,
          name: bucket.name,
          summary: bucket.summary,
          lesson_ids: Array.isArray(bucket.lesson_ids) ? bucket.lesson_ids : [],
          counts: bucket.counts || null,
        }))
      : [];
  } catch (e) {
    debugLog('init.newMilestone', 'lesson snapshot creation failed (non-blocking)', e);
  }

  try {
    result.effective_intent = getEffectiveIntent(cwd);
  } catch (e) {
    debugLog('init.newMilestone', 'effective intent failed (non-blocking)', e);
  }

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
    if (result.effective_intent) compactResult.effective_intent = result.effective_intent;
    if (result.jj_planning_context) compactResult.jj_planning_context = result.jj_planning_context;
    if (result.lesson_snapshot_path) compactResult.lesson_snapshot_path = result.lesson_snapshot_path;
    if (result.lesson_snapshot_lesson_count != null) compactResult.lesson_snapshot_lesson_count = result.lesson_snapshot_lesson_count;
    if (result.remediation_summary) compactResult.remediation_summary = result.remediation_summary;
    if (global._gsdManifestMode) {
      compactResult._manifest = { files: manifestFiles };
    }
    return output(compactResult, raw);
  }

  output(result, raw);
}

function cmdInitQuick(cwd, description, raw) {
  const config = loadConfig(cwd);
  requireJjForExecution(cwd, 'init:quick');
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
    planner_model: resolveModelInternal(cwd, 'bgsd-planner'),
    executor_model: resolveModelInternal(cwd, 'bgsd-executor'),
    checker_model: resolveModelInternal(cwd, 'bgsd-plan-checker'),
    verifier_model: resolveModelInternal(cwd, 'bgsd-verifier'),

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

  const stateContent = safeReadFile(path.join(cwd, '.planning', 'STATE.md'));
  const currentPhase = parseCurrentPhaseFromState(stateContent);
  const phaseInfo = currentPhase ? findPhaseInternal(cwd, currentPhase) : null;
  const handoffResumeSummary = buildPhaseHandoffResumeSummary(cwd, currentPhase, phaseInfo?.phase_name || null);

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
  if (handoffResumeSummary) result.resume_summary = handoffResumeSummary;

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
    if (result.resume_summary) compactResult.resume_summary = result.resume_summary;
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
  const snapshotInfo = getSnapshotPhaseInfo(cwd, phase);
  const snapshot = snapshotInfo.snapshot;
  const metadata = snapshotInfo.metadata;
  const handoffResumeSummary = buildPhaseHandoffResumeSummary(cwd, metadata?.number || phase, metadata?.name || null);
  let rawConfig = {};
  try {
    rawConfig = readRawConfig(cwd) || {};
  } catch (e) { debugLog('init.verifyWork', 'raw config read failed', e); }

  const result = {
    // Models
    planner_model: resolveModelInternal(cwd, 'bgsd-planner'),
    checker_model: resolveModelInternal(cwd, 'bgsd-plan-checker'),

    // Config
    commit_docs: config.commit_docs,

    // Phase info
    phase_found: !!snapshot,
    phase_dir: metadata?.directory || null,
    phase_number: metadata?.number || null,
    phase_name: metadata?.name || null,

    // Existing artifacts
    has_verification: !!snapshot?.execution_context?.has_verification,

    // Advisory planning + verification context
    effective_intent: null,
    jj_planning_context: buildJjPlanningContext(rawConfig),
  };
  if (handoffResumeSummary) result.resume_summary = handoffResumeSummary;

  try {
    result.effective_intent = getEffectiveIntent(cwd, { phase: metadata?.number || phase });
  } catch (e) {
    debugLog('init.verifyWork', 'effective intent failed (non-blocking)', e);
  }

  if (global._gsdCompactMode) {
    const manifestFiles = [];
    snapshotInfo.artifacts.plan_paths.forEach(file => {
      manifestFiles.push({ path: file, required: true });
    });
    snapshotInfo.artifacts.summary_paths.forEach(file => {
      manifestFiles.push({ path: file, required: true });
    });
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
    if (result.effective_intent) compactResult.effective_intent = result.effective_intent;
    if (result.jj_planning_context) compactResult.jj_planning_context = result.jj_planning_context;
    if (result.resume_summary) compactResult.resume_summary = result.resume_summary;
    if (global._gsdManifestMode) {
      compactResult._manifest = { files: manifestFiles };
    }
    return output(compactResult, raw);
  }

  output(result, raw);
}

function parseCurrentPhaseFromState(stateContent) {
  if (!stateContent) return null;

  const phaseMatch = stateContent.match(/\*\*Phase:\*\*\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (phaseMatch) return phaseMatch[1];

  const focusMatch = stateContent.match(/\*\*Current focus:\*\*\s*Phase\s+([0-9]+(?:\.[0-9]+)?)/i);
  if (focusMatch) return focusMatch[1];

  return null;
}

function parseCurrentPlanFromState(stateContent) {
  if (!stateContent) return null;
  const planMatch = stateContent.match(/\*\*(?:Current Plan|Plan):\*\*\s*([0-9]+)/i);
  return planMatch ? planMatch[1].padStart(2, '0') : null;
}

function buildReviewInitResult(cwd) {
  const config = loadConfig(cwd);
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  const stateContent = safeReadFile(statePath);
  const currentPhase = parseCurrentPhaseFromState(stateContent);
  const phaseInfo = currentPhase ? findPhaseInternal(cwd, currentPhase) : null;
  const currentPlan = parseCurrentPlanFromState(stateContent);

  return {
    review_model: resolveModelInternal(cwd, 'bgsd-reviewer'),
    verifier_model: resolveModelInternal(cwd, 'bgsd-verifier'),
    commit_docs: config.commit_docs,
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory || null,
    phase_number: phaseInfo?.phase_number || currentPhase || null,
    phase_name: phaseInfo?.phase_name || null,
    phase_slug: phaseInfo?.phase_slug || null,
    current_plan: currentPlan,
    plan_path: phaseInfo && currentPlan ? `${phaseInfo.directory}/${phaseInfo.phase_number}-${currentPlan}-PLAN.md` : null,
    workflow_path: 'workflows/review.md',
    review_command: 'review:scan',
    state_path: '.planning/STATE.md',
    roadmap_path: '.planning/ROADMAP.md',
    config_path: '.planning/config.json',
  };
}

function cmdInitReview(cwd, raw) {
  output(buildReviewInitResult(cwd), raw);
}

function buildSecurityInitResult(cwd) {
  const config = loadConfig(cwd);
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  const stateContent = safeReadFile(statePath);
  const currentPhase = parseCurrentPhaseFromState(stateContent);
  const phaseInfo = currentPhase ? findPhaseInternal(cwd, currentPhase) : null;
  const currentPlan = parseCurrentPlanFromState(stateContent);

  return {
    workflow_model: resolveModelInternal(cwd, 'bgsd-executor'),
    verifier_model: resolveModelInternal(cwd, 'bgsd-verifier'),
    commit_docs: config.commit_docs,
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory || null,
    phase_number: phaseInfo?.phase_number || currentPhase || null,
    phase_name: phaseInfo?.phase_name || null,
    phase_slug: phaseInfo?.phase_slug || null,
    current_plan: currentPlan,
    plan_path: phaseInfo && currentPlan ? `${phaseInfo.directory}/${phaseInfo.phase_number}-${currentPlan}-PLAN.md` : null,
    workflow_path: 'workflows/security.md',
    security_command: 'security:scan',
    report_path: phaseInfo ? `${phaseInfo.directory}/security-report.json` : null,
    state_path: '.planning/STATE.md',
    roadmap_path: '.planning/ROADMAP.md',
    config_path: '.planning/config.json',
    exclusions_path: '.planning/security-exclusions.json',
  };
}

function cmdInitSecurity(cwd, raw) {
  output(buildSecurityInitResult(cwd), raw);
}

function buildReleaseInitResult(cwd) {
  const config = loadConfig(cwd);
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  const stateContent = safeReadFile(statePath);
  const currentPhase = parseCurrentPhaseFromState(stateContent);
  const phaseInfo = currentPhase ? findPhaseInternal(cwd, currentPhase) : null;
  const currentPlan = parseCurrentPlanFromState(stateContent);

  return {
    workflow_model: resolveModelInternal(cwd, 'bgsd-executor'),
    verifier_model: resolveModelInternal(cwd, 'bgsd-verifier'),
    commit_docs: config.commit_docs,
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory || null,
    phase_number: phaseInfo?.phase_number || currentPhase || null,
    phase_name: phaseInfo?.phase_name || null,
    phase_slug: phaseInfo?.phase_slug || null,
    current_plan: currentPlan,
    plan_path: phaseInfo && currentPlan ? `${phaseInfo.directory}/${phaseInfo.phase_number}-${currentPlan}-PLAN.md` : null,
    workflow_path: 'workflows/release.md',
    release_commands: {
      bump: 'release:bump',
      changelog: 'release:changelog',
      tag: 'release:tag',
      pr: 'release:pr',
    },
    release_state_path: '.planning/release-state.json',
    state_path: '.planning/STATE.md',
    roadmap_path: '.planning/ROADMAP.md',
    config_path: '.planning/config.json',
  };
}

function cmdInitRelease(cwd, raw) {
  output(buildReleaseInitResult(cwd), raw);
}

function cmdInitPhaseOp(cwd, phase, raw) {
  const config = loadConfig(cwd);
  const snapshotInfo = getSnapshotPhaseInfo(cwd, phase);
  const snapshot = snapshotInfo.snapshot;
  const metadata = snapshotInfo.metadata;
  const handoffResumeSummary = buildPhaseHandoffResumeSummary(cwd, metadata?.number || phase, metadata?.name || null);

  const result = {
    // Config
    commit_docs: config.commit_docs,
    brave_search: config.brave_search,

    // Phase info
    phase_found: !!snapshot,
    phase_dir: metadata?.directory || null,
    phase_number: metadata?.number || null,
    phase_name: metadata?.name || null,
    phase_slug: metadata?.slug || null,
    padded_phase: metadata?.number?.padStart(2, '0') || null,

    // Existing artifacts
    has_research: !!snapshot?.execution_context?.has_research,
    has_context: !!snapshot?.execution_context?.has_context,
    has_plans: (snapshot?.execution_context?.plan_count || 0) > 0,
    has_verification: !!snapshot?.execution_context?.has_verification,
    plan_count: snapshot?.execution_context?.plan_count || 0,

    // File existence
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
    planning_exists: pathExistsInternal(cwd, '.planning'),

    // File paths
    state_path: '.planning/STATE.md',
    roadmap_path: '.planning/ROADMAP.md',
    requirements_path: '.planning/REQUIREMENTS.md',
  };
  if (handoffResumeSummary) result.resume_summary = handoffResumeSummary;

  if (snapshot) {
    if (snapshotInfo.artifacts.context_path) result.context_path = snapshotInfo.artifacts.context_path;
    if (snapshotInfo.artifacts.research_path) result.research_path = snapshotInfo.artifacts.research_path;
    if (snapshotInfo.artifacts.verification_path) result.verification_path = snapshotInfo.artifacts.verification_path;
    if (snapshotInfo.artifacts.uat_path) result.uat_path = snapshotInfo.artifacts.uat_path;
  }

  // Codebase intelligence — read existing intel (fast) or auto-trigger if --refresh
  try {
    const refreshMode = process.argv.includes('--refresh');
    let codebaseIntel;
    if (refreshMode) {
      try { fs.unlinkSync(path.join(cwd, '.planning', '.cache', '.analyzing')); } catch { /* ignore */ }
      codebaseIntel = autoTriggerCodebaseIntel(cwd, { synchronous: true });
    } else {
      // Fast path: read existing intel without git staleness check (~100ms savings)
      codebaseIntel = readCodebaseIntel(cwd);
    }
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
    if (result.resume_summary) compactResult.resume_summary = result.resume_summary;
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
    mapper_model: resolveModelInternal(cwd, 'bgsd-codebase-mapper'),

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
    executor_model: resolveModelInternal(cwd, 'bgsd-executor'),
    planner_model: resolveModelInternal(cwd, 'bgsd-planner'),

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

  // Trigger memory store migration on first access
  try {
    const db = getDb(cwd);
    if (db.backend === 'sqlite') {
      const cache = new PlanningCache(db);
      cache.migrateMemoryStores(cwd);
    }
  } catch (e) {
    debugLog('init.memory', 'memory migration failed', e);
  }

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

  // Try SQLite-first bookmark read
  try {
    const db = getDb(cwd);
    const cache = new PlanningCache(db);
    const sqlBookmark = cache.getBookmarkTop(cwd);
    if (sqlBookmark) {
      bookmark = sqlBookmark;
    }
  } catch (e) {
    debugLog('init.memory', 'SQLite bookmark read failed', e);
  }

  // Fall back to JSON read if bookmark is still null
  if (!bookmark) {
    const bookmarksPath = path.join(cwd, '.planning', 'memory', 'bookmarks.json');
    const bookmarksContent = safeReadFile(bookmarksPath);
    if (bookmarksContent) {
      try {
        const bookmarks = JSON.parse(bookmarksContent);
        if (Array.isArray(bookmarks) && bookmarks.length > 0) {
          bookmark = bookmarks[0];
        }
      } catch (e) { debugLog('init.memory', 'parse bookmarks failed', e); }
    }
  }

  // Drift warning: check if git HEAD changed since bookmark's git_head
  if (bookmark) {
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

  // 3. Decisions — read from memory store
  let decisions = [];

  // Try SQLite-first decisions read
  try {
    const db = getDb(cwd);
    const cache = new PlanningCache(db);
    const sqlResult = cache.searchMemory(cwd, 'decisions', null, {
      phase: phaseFilter,
      limit: compact ? 5 : 10,
    });
    if (sqlResult && sqlResult.entries.length > 0) {
      decisions = sqlResult.entries.reverse(); // Most recent first
    }
  } catch (e) {
    debugLog('init.memory', 'SQLite decision read failed', e);
  }

  // Fall back to JSON if decisions is still empty
  if (decisions.length === 0) {
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

  // Try SQLite-first lessons read
  try {
    const db = getDb(cwd);
    const cache = new PlanningCache(db);
    const sqlResult = cache.searchMemory(cwd, 'lessons', null, {
      phase: phaseFilter,
      limit: 5,
    });
    if (sqlResult && sqlResult.entries.length > 0) {
      lessons = sqlResult.entries;
    }
  } catch (e) {
    debugLog('init.memory', 'SQLite lessons read failed', e);
  }

  // Fall back to JSON if lessons is still empty
  if (lessons.length === 0) {
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
  cmdInitReview,
  cmdInitSecurity,
  cmdInitRelease,
  cmdInitVerifyWork,
  cmdInitPhaseOp,
  cmdInitTodos,
  cmdInitMilestoneOp,
  cmdInitMapCodebase,
  cmdInitProgress,
  cmdInitMemory,
  buildReviewInitResult,
  buildSecurityInitResult,
  buildReleaseInitResult,
};
