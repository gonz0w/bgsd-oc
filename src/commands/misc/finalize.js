'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { output, error } = require('../../lib/output');
const { extractFrontmatter } = require('../../lib/frontmatter');
const { applyWaveRecoveryMetadata, comparablePath, inspectWorkspace } = require('../../lib/jj-workspace');
const { listManagedWorkspaces, parsePlanId } = require('../workspace');

const TOOLS_PATH = process.argv[1];
const CANONICAL_MUTATORS = [
  'verify:state complete-plan',
  'plan:roadmap update-plan-progress',
  'plan:requirements mark-complete',
];

function toWorkspaceName(target) {
  const parsed = parsePlanId(target);
  if (!parsed) return target;
  return `${parsed.phase.padStart(2, '0')}-${parsed.plan.padStart(2, '0')}`;
}

function resolveWorkspace(cwd, target) {
  const workspaceName = toWorkspaceName(target);
  return listManagedWorkspaces(cwd).find((workspace) => workspace.name === workspaceName) || null;
}

function comparePlanOrder(left, right) {
  const leftParsed = parsePlanId(left?.plan_id || left?.name || left || '');
  const rightParsed = parsePlanId(right?.plan_id || right?.name || right || '');
  if (!leftParsed || !rightParsed) {
    return String(left?.plan_id || left?.name || left || '').localeCompare(String(right?.plan_id || right?.name || right || ''));
  }
  const phaseCmp = Number(leftParsed.phase) - Number(rightParsed.phase);
  if (phaseCmp !== 0) return phaseCmp;
  return Number(leftParsed.plan) - Number(rightParsed.plan);
}

function execCanonical(cwd, args) {
  execFileSync(process.execPath, [TOOLS_PATH, ...args], {
    cwd,
    stdio: 'pipe',
    encoding: 'utf-8',
  });
}

function requireTrustedMainCheckout(cwd, workspace) {
  if (!workspace) return;
  if (comparablePath(cwd) === comparablePath(workspace.path)) {
    error('execute:finalize-plan must run from trusted main-checkout state, not from the target workspace');
  }
}

function requireTrustedMainForWave(cwd, workspaces) {
  if (workspaces.some((workspace) => comparablePath(cwd) === comparablePath(workspace.path))) {
    error('execute:finalize-wave must run from trusted main-checkout state, not from a managed workspace');
  }
}

function requireResultManifest(workspaceInfo) {
  if (!workspaceInfo.result_manifest?.summary_path) {
    error('Finalize blocked: missing proof or summary metadata for the workspace result manifest');
  }
  if (workspaceInfo.result_manifest.proof_buckets?.behavior === 'required' && !workspaceInfo.result_manifest.proof_path) {
    error('Finalize blocked: missing proof for a route that requires direct proof review');
  }
}

function requireHealthyEligibility(workspaceInfo) {
  if (workspaceInfo.status !== 'healthy') {
    error(`Finalize blocked: workspace status is ${workspaceInfo.status}, not healthy`);
  }
  const violation = workspaceInfo.result_manifest?.shared_planning_violation;
  if (violation?.quarantine) {
    error('Finalize blocked: quarantined or policy-violating boundary behavior must stay inspectable for human review');
  }
}

function promoteWorkspaceArtifacts(mainCwd, workspaceInfo) {
  for (const relPath of [workspaceInfo.result_manifest?.summary_path, workspaceInfo.result_manifest?.proof_path]) {
    if (!relPath) continue;
    const fromPath = path.join(workspaceInfo.path, relPath);
    const toPath = path.join(mainCwd, relPath);
    fs.mkdirSync(path.dirname(toPath), { recursive: true });
    fs.copyFileSync(fromPath, toPath);
  }
}

function readPlanRequirements(mainCwd, planId) {
  const phasesDir = path.join(mainCwd, '.planning', 'phases');
  for (const entry of fs.readdirSync(phasesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const planPath = path.join(phasesDir, entry.name, `${planId}-PLAN.md`);
    if (!fs.existsSync(planPath)) continue;
    const content = fs.readFileSync(planPath, 'utf-8');
    const match = content.match(/requirements:\n((?:\s+-\s+[^\n]+\n?)+)/i);
    if (!match) return [];
    return match[1]
      .split('\n')
      .map((line) => line.match(/-\s+(.+)$/))
      .filter(Boolean)
      .map((entryMatch) => entryMatch[1].trim());
  }
  return [];
}

function resolvePhaseDirectory(cwd, phaseArg) {
  const phasesDir = path.join(cwd, '.planning', 'phases');
  if (!fs.existsSync(phasesDir)) return null;

  const normalized = String(phaseArg || '').trim();
  const normalizedNumber = normalized.replace(/^0+/, '') || '0';
  return fs.readdirSync(phasesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .find((entry) => {
      if (entry.name === normalized) return true;
      const match = entry.name.match(/^(\d+(?:\.\d+)?)-/);
      return match && ((match[1].replace(/^0+/, '') || '0') === normalizedNumber);
    }) || null;
}

function listWavePlans(cwd, phaseArg, waveArg) {
  const phaseDir = resolvePhaseDirectory(cwd, phaseArg);
  if (!phaseDir) return null;

  const phasePath = path.join(cwd, '.planning', 'phases', phaseDir.name);
  const targetWave = String(waveArg || '1');
  const plans = fs.readdirSync(phasePath)
    .filter((file) => /^\d+(?:\.\d+)?-\d+-PLAN\.md$/.test(file))
    .map((file) => {
      const fullPath = path.join(phasePath, file);
      const frontmatter = extractFrontmatter(fs.readFileSync(fullPath, 'utf-8'));
      const planId = file.replace(/-PLAN\.md$/, '');
      return {
        plan_id: planId,
        wave: String(frontmatter.wave || '0'),
        phase_dir: phaseDir.name,
        plan_path: fullPath,
        requirements: Array.isArray(frontmatter.requirements) ? frontmatter.requirements.map((entry) => String(entry)) : [],
        files_modified: Array.isArray(frontmatter.files_modified) ? frontmatter.files_modified : [],
      };
    })
    .filter((plan) => plan.wave === targetWave)
    .sort(comparePlanOrder);

  return {
    phase_dir: phaseDir.name,
    phase_path: phasePath,
    phase_number: (phaseDir.name.match(/^(\d+(?:\.\d+)?)-/) || [null, String(phaseArg || '')])[1],
    wave: targetWave,
    plans,
  };
}

function getMainSummaryPath(cwd, phaseDirName, planId) {
  const summaryPath = path.join(cwd, '.planning', 'phases', phaseDirName, `${planId}-SUMMARY.md`);
  return fs.existsSync(summaryPath)
    ? path.posix.join('.planning', 'phases', phaseDirName, `${planId}-SUMMARY.md`)
    : null;
}

function createFinalizedPlaceholder(cwd, phaseDirName, planId) {
  const summaryPath = getMainSummaryPath(cwd, phaseDirName, planId);
  if (!summaryPath) return null;
  return {
    name: planId,
    plan_id: planId,
    path: null,
    status: 'finalized',
    recovery_needed: false,
    result_manifest: {
      plan_id: planId,
      summary_path: summaryPath,
      shared_planning_violation: { quarantine: false },
    },
    recovery_preview: null,
  };
}

function buildWaveRecoveryPayload(phaseInfo, blocker, finalizedPlans, stagedReadyPlans) {
  return {
    phase: phaseInfo.phase_dir,
    wave: phaseInfo.wave,
    status: blocker ? 'recovery-needed' : 'finalized',
    finalized: finalizedPlans,
    staged_ready: stagedReadyPlans,
    gating_sibling: blocker?.plan_id || blocker?.name || null,
    blocking_reason: blocker?.blocking_reason || null,
    next_command: blocker?.recovery_summary?.next_command || null,
    proof_artifacts: blocker?.recovery_summary?.proof_artifacts || null,
  };
}

function writeWaveRecoverySummary(cwd, phaseInfo, payload) {
  const phaseNumber = String(phaseInfo.phase_number || '').replace(/^0+/, '') || '0';
  const outputPath = path.join(phaseInfo.phase_path, `${phaseNumber}-wave-${phaseInfo.wave}-recovery.json`);
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2) + '\n');
  return path.posix.join('.planning', 'phases', phaseInfo.phase_dir, `${phaseNumber}-wave-${phaseInfo.wave}-recovery.json`);
}

function finalizeWorkspacePlan(cwd, workspaceInfo, planMeta) {
  const parsed = parsePlanId(workspaceInfo.plan_id || workspaceInfo.name || '');
  if (!parsed) {
    error(`Unable to parse plan identifier for ${workspaceInfo.name || workspaceInfo.plan_id}.`);
  }

  requireHealthyEligibility(workspaceInfo);
  requireResultManifest(workspaceInfo);
  promoteWorkspaceArtifacts(cwd, workspaceInfo);
  execCanonical(cwd, [
    'verify:state',
    'complete-plan',
    '--phase', parsed.phase,
    '--plan', parsed.plan,
    '--duration', '1 min',
    '--tasks', '2',
    '--files', String((planMeta?.files_modified || []).length || 1),
    '--stopped-at', `Completed ${(workspaceInfo.plan_id || workspaceInfo.name)}-PLAN.md`,
    '--resume-file', 'None',
  ]);
  execCanonical(cwd, ['plan:roadmap', 'update-plan-progress', parsed.phase]);
  if ((planMeta?.requirements || []).length > 0) {
    execCanonical(cwd, ['plan:requirements', 'mark-complete', ...planMeta.requirements]);
  }
}

function cmdExecuteFinalizePlan(cwd, target, raw) {
  if (!target) {
    error('Usage: bgsd-tools execute:finalize-plan <plan-id|workspace-name>');
  }

  const workspace = resolveWorkspace(cwd, target);
  if (!workspace) {
    error(`No managed workspace found for ${target}.`);
  }

  requireTrustedMainCheckout(cwd, workspace);

  const workspaceInfo = inspectWorkspace(workspace);
  requireHealthyEligibility(workspaceInfo);
  requireResultManifest(workspaceInfo);

  const planId = workspaceInfo.plan_id || target;
  const parsed = parsePlanId(planId);
  const requirements = readPlanRequirements(cwd, planId);

  promoteWorkspaceArtifacts(cwd, workspaceInfo);
  execCanonical(cwd, ['verify:state', 'complete-plan', '--phase', parsed.phase, '--plan', parsed.plan, '--duration', '1 min', '--tasks', '2', '--files', '7', '--stopped-at', `Completed ${planId}-PLAN.md`, '--resume-file', 'None']);
  execCanonical(cwd, ['plan:roadmap', 'update-plan-progress', parsed.phase]);
  if (requirements.length > 0) {
    execCanonical(cwd, ['plan:requirements', 'mark-complete', ...requirements]);
  }

  output({
    finalized: true,
    workspace: {
      name: workspaceInfo.name,
      plan_id: workspaceInfo.plan_id,
      path: workspaceInfo.path,
    },
    result_manifest: workspaceInfo.result_manifest,
    mutators: CANONICAL_MUTATORS,
  }, raw);
}

function cmdExecuteFinalizeWave(cwd, args, raw) {
  const phaseArg = Array.isArray(args) ? args[0] : null;
  const waveIdx = Array.isArray(args) ? args.indexOf('--wave') : -1;
  const waveArg = waveIdx !== -1 ? args[waveIdx + 1] : '1';
  if (!phaseArg) {
    error('Usage: bgsd-tools execute:finalize-wave <phase-number|phase-dir> [--wave <number>]');
  }

  const phaseInfo = listWavePlans(cwd, phaseArg, waveArg);
  if (!phaseInfo || phaseInfo.plans.length === 0) {
    error(`No wave ${waveArg} plans found for phase ${phaseArg}.`);
  }

  const workspaceMap = new Map(listManagedWorkspaces(cwd).map((workspace) => [workspace.name, workspace]));
  const presentWorkspaces = phaseInfo.plans
    .map((plan) => workspaceMap.get(toWorkspaceName(plan.plan_id)))
    .filter(Boolean);
  requireTrustedMainForWave(cwd, presentWorkspaces);

  const inventory = phaseInfo.plans.map((plan) => {
    const workspace = workspaceMap.get(toWorkspaceName(plan.plan_id));
    if (workspace) return inspectWorkspace(workspace);
    return createFinalizedPlaceholder(cwd, phaseInfo.phase_dir, plan.plan_id) || {
      name: plan.plan_id,
      plan_id: plan.plan_id,
      path: null,
      status: 'missing',
      recovery_needed: true,
      result_manifest: {
        plan_id: plan.plan_id,
        summary_path: null,
        inspection_level: 'direct-proof',
        shared_planning_violation: { quarantine: false },
      },
      recovery_preview: null,
    };
  });

  const enriched = inventory.map((workspace) => {
    const siblings = inventory.filter((candidate) => candidate.plan_id !== workspace.plan_id);
    return applyWaveRecoveryMetadata(workspace, siblings);
  }).sort(comparePlanOrder);

  const planMetaById = new Map(phaseInfo.plans.map((plan) => [plan.plan_id, plan]));
  const finalizedPlans = [];
  const stagedReadyPlans = [];
  let blocker = null;

  for (const workspace of enriched) {
    if (workspace.status === 'finalized') {
      finalizedPlans.push(workspace.plan_id);
      continue;
    }
    if (workspace.status === 'healthy' && !blocker) {
      finalizeWorkspacePlan(cwd, workspace, planMetaById.get(workspace.plan_id));
      finalizedPlans.push(workspace.plan_id);
      continue;
    }
    if (!blocker) {
      blocker = workspace;
    }
    if (workspace.status === 'staged_ready') {
      stagedReadyPlans.push(workspace.plan_id);
    }
  }

  const payload = buildWaveRecoveryPayload(phaseInfo, blocker, finalizedPlans, stagedReadyPlans);
  const recovery_summary_path = writeWaveRecoverySummary(cwd, phaseInfo, payload);
  output({
    finalized: !blocker,
    status: payload.status,
    phase: phaseInfo.phase_dir,
    wave: phaseInfo.wave,
    finalized_plans: finalizedPlans,
    staged_ready_plans: stagedReadyPlans,
    gating_sibling: payload.gating_sibling,
    blocking_reason: payload.blocking_reason,
    next_command: payload.next_command,
    recovery_summary_path,
    proof_artifacts: payload.proof_artifacts,
  }, raw);
}

module.exports = {
  cmdExecuteFinalizePlan,
  cmdExecuteFinalizeWave,
};
