'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { output, error, debugLog } = require('../lib/output');
const { extractFrontmatter } = require('../lib/frontmatter');
const { requireJjForExecution } = require('../lib/jj');
const { applyWaveRecoveryMetadata, collectWorkspaceProof, comparablePath, inspectWorkspace } = require('../lib/jj-workspace');

const WORKSPACE_DEFAULTS = {
  base_path: '/tmp/gsd-workspaces',
  max_concurrent: 3,
};

function readWorkspaceConfig(cwd) {
  try {
    const configPath = path.join(cwd, '.planning', 'config.json');
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return { ...WORKSPACE_DEFAULTS, ...(raw.workspace || {}) };
  } catch (err) {
    debugLog('workspace.config', 'using default workspace config', err);
    return { ...WORKSPACE_DEFAULTS };
  }
}

function getProjectName(cwd) {
  return path.basename(cwd);
}

function parsePlanId(planId) {
  if (!planId) return null;
  const match = String(planId).match(/^(\d+(?:\.\d+)?)-(\d+)$/);
  if (!match) return null;
  return { phase: match[1], plan: match[2] };
}

function toWorkspaceName(planId) {
  const parsed = parsePlanId(planId);
  if (!parsed) return null;
  return `${parsed.phase.padStart(2, '0')}-${parsed.plan.padStart(2, '0')}`;
}

function getWorkspacePath(cwd, workspaceName) {
  const config = readWorkspaceConfig(cwd);
  return path.join(config.base_path, getProjectName(cwd), workspaceName);
}

function execJj(cwd, args) {
  try {
    const stdout = execFileSync('jj', args, {
      cwd,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    return { exitCode: 0, stdout: stdout.trim(), stderr: '' };
  } catch (err) {
    return {
      exitCode: err.status ?? 1,
      stdout: (err.stdout ?? '').toString().trim(),
      stderr: (err.stderr ?? '').toString().trim(),
    };
  }
}

function getCurrentWorkspaceRoot(cwd) {
  const result = execJj(cwd, ['workspace', 'root']);
  return result.exitCode === 0 ? result.stdout.trim() : cwd;
}

function parseWorkspaceList(stdout) {
  if (!stdout) return [];
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([^:]+):\s+(\S+)\s+(\S+)\s*(.*)$/);
      if (!match) return null;
      return {
        name: match[1].trim(),
        change_id: match[2],
        commit_id: match[3],
        description: (match[4] || '').trim() || null,
      };
    })
    .filter(Boolean);
}

function getWorkspaceInfo(cwd, name) {
  const rootResult = execJj(cwd, ['workspace', 'root', '--name', name]);
  const root = rootResult.exitCode === 0 ? rootResult.stdout.trim() : null;
  if (!root) return null;

  const logResult = execJj(root, ['log', '-r', '@', '--no-graph', '-T', 'change_id.shortest(8) ++ "\t" ++ commit_id.shortest(8) ++ "\t" ++ description.first_line()']);
  let change_id = null;
  let commit_id = null;
  let description = null;
  if (logResult.exitCode === 0 && logResult.stdout) {
    const [changePart, commitPart, ...descParts] = logResult.stdout.split('\t');
    change_id = changePart || null;
    commit_id = commitPart || null;
    description = descParts.join('\t').trim() || null;
  }

  return {
    name,
    path: comparablePath(root),
    current: comparablePath(root) === comparablePath(getCurrentWorkspaceRoot(cwd)),
    exists_on_disk: fs.existsSync(root),
    change_id,
    commit_id,
    description,
    plan_id: parsePlanId(name) ? name : null,
  };
}

function listManagedWorkspaces(cwd) {
  const config = readWorkspaceConfig(cwd);
  const projectBase = comparablePath(path.join(config.base_path, getProjectName(cwd)));
  const listResult = execJj(cwd, ['workspace', 'list']);
  if (listResult.exitCode !== 0) {
    error(`Failed to list workspaces: ${listResult.stderr}`);
  }

  return parseWorkspaceList(listResult.stdout)
    .map((entry) => getWorkspaceInfo(cwd, entry.name))
    .filter(Boolean)
    .filter((entry) => {
      const workspacePath = comparablePath(entry.path);
      return workspacePath && projectBase && workspacePath.startsWith(projectBase + path.sep);
    });
}

function enrichWorkspaceInventory(workspaces) {
  const grouped = new Map();
  for (const workspace of workspaces) {
    const planPhase = workspace.plan_id
      ? ((parsePlanId(workspace.plan_id)?.phase || '').replace(/^0+/, '') || '0')
      : null;
    const key = planPhase || '__ungrouped__';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(workspace);
  }

  const enriched = [];
  for (const group of grouped.values()) {
    for (const workspace of group) {
      const siblings = group.filter((candidate) => candidate.name !== workspace.name);
      enriched.push(applyWaveRecoveryMetadata(workspace, siblings));
    }
  }

  return enriched.sort((a, b) => a.name.localeCompare(b.name));
}

function summarizeWorkspaceInventory(workspaces) {
  const summary = {
    healthy: [],
    finalized: [],
    staged_ready: [],
    recovery_needed: [],
    finalize_failed: [],
    gating_sibling: null,
    recovery_summary: null,
  };

  for (const workspace of workspaces || []) {
    const planId = workspace.plan_id || workspace.name;
    if (!planId) continue;
    if (workspace.status === 'healthy') summary.healthy.push(planId);
    if (workspace.status === 'finalized') summary.finalized.push(planId);
    if (workspace.status === 'staged_ready') summary.staged_ready.push(planId);
    if (workspace.recovery_needed && workspace.status !== 'staged_ready') summary.recovery_needed.push(planId);
    if (workspace.status === 'finalize_failed') summary.finalize_failed.push(planId);
  }

  const preferredRecovery = (workspaces || []).find((workspace) => workspace.status === 'staged_ready' && workspace.recovery_summary)
    || (workspaces || []).find((workspace) => workspace.recovery_needed && workspace.recovery_summary)
    || null;

  if (preferredRecovery) {
    summary.gating_sibling = preferredRecovery.gating_sibling || null;
    summary.recovery_summary = preferredRecovery.recovery_summary;
  }

  return summary;
}

function listActiveWorkspaceInventory(cwd, phaseNumber) {
  const normalizedPhase = phaseNumber == null
    ? null
    : (String(phaseNumber).replace(/^0+/, '') || '0');
  const phasePlans = normalizedPhase ? getPhaseFilesModified(cwd, normalizedPhase) : [];
  const planMap = new Map(
    phasePlans.map((plan) => [plan.planId, plan])
  );

  const phaseWorkspaces = listManagedWorkspaces(cwd)
    .map((workspace) => {
      const inspected = inspectWorkspace(workspace);
      const plan = planMap.get(inspected.plan_id);
      const planPhase = inspected.plan_id
        ? ((parsePlanId(inspected.plan_id)?.phase || '').replace(/^0+/, '') || '0')
        : null;

      return {
        ...inspected,
        phase_matches_execution: normalizedPhase ? planPhase === normalizedPhase : true,
        tracked_plan: plan ? {
          plan_id: plan.planId,
          wave: plan.wave,
          files_modified: plan.files_modified,
        } : null,
      };
    })
    .filter((workspace) => normalizedPhase ? workspace.phase_matches_execution : true);

  return enrichWorkspaceInventory(phaseWorkspaces);
}

function resolveWorkspaceTarget(cwd, target) {
  if (!target) return null;
  const normalized = toWorkspaceName(target) || target;
  return listManagedWorkspaces(cwd).find((workspace) => workspace.name === normalized) || null;
}

function formatWorkspaceTable(workspaces) {
  if (!workspaces.length) return 'No managed JJ workspaces for this project.\n';
  const lines = [
    'Workspace | Plan   | Status    | Current | Change   | Commit   | Path',
    '--------- | ------ | --------- | ------- | -------- | -------- | ----',
  ];
  for (const workspace of workspaces) {
    lines.push(`${workspace.name.padEnd(9)} | ${(workspace.plan_id || '-').padEnd(6)} | ${String(workspace.status || 'unknown').padEnd(9)} | ${(workspace.current ? 'yes' : 'no').padEnd(7)} | ${String(workspace.change_id || '-').padEnd(8)} | ${String(workspace.commit_id || '-').padEnd(8)} | ${workspace.path}`);
  }
  return lines.join('\n') + '\n';
}

function cmdWorkspaceAdd(cwd, planId, raw) {
  requireJjForExecution(cwd, 'workspace add');
  if (!planId) {
    error('Usage: bgsd-tools workspace add <plan-id>');
  }

  const workspaceName = toWorkspaceName(planId);
  if (!workspaceName) {
    error(`Invalid plan ID "${planId}". Expected format: NN-MM (for example 155-02)`);
  }

  const config = readWorkspaceConfig(cwd);
  const managed = listManagedWorkspaces(cwd);
  if (managed.some((workspace) => workspace.name === workspaceName)) {
    error(`Workspace ${workspaceName} already exists.`);
  }
  if (managed.length >= config.max_concurrent) {
    error(`Max concurrent workspaces (${config.max_concurrent}) reached. Forget or cleanup a workspace first.`);
  }

  const projectBase = path.join(config.base_path, getProjectName(cwd));
  fs.mkdirSync(projectBase, { recursive: true });
  const workspacePath = path.join(projectBase, workspaceName);
  if (fs.existsSync(workspacePath)) {
    error(`Workspace path already exists on disk: ${workspacePath}`);
  }

  const addResult = execJj(cwd, ['workspace', 'add', workspacePath, '--name', workspaceName]);
  if (addResult.exitCode !== 0) {
    error(`Failed to add workspace: ${addResult.stderr || addResult.stdout}`);
  }

  const workspace = getWorkspaceInfo(cwd, workspaceName);
  output({
    added: true,
    plan_id: workspaceName,
    workspace: workspace || {
      name: workspaceName,
      plan_id: workspaceName,
      path: workspacePath,
    },
  }, raw);
}

function cmdWorkspaceList(cwd, raw) {
  requireJjForExecution(cwd, 'workspace list');
  const workspaces = enrichWorkspaceInventory(listManagedWorkspaces(cwd).map((workspace) => inspectWorkspace(workspace)));
  output({ workspaces, summary: summarizeWorkspaceInventory(workspaces) }, raw, formatWorkspaceTable(workspaces));
}

function cmdWorkspaceForget(cwd, target, raw) {
  requireJjForExecution(cwd, 'workspace forget');
  if (!target) {
    error('Usage: bgsd-tools workspace forget <plan-id|workspace-name>');
  }

  const workspace = resolveWorkspaceTarget(cwd, target);
  if (!workspace) {
    error(`No managed workspace found for ${target}.`);
  }

  const forgetResult = execJj(cwd, ['workspace', 'forget', workspace.name]);
  if (forgetResult.exitCode !== 0) {
    error(`Failed to forget workspace ${workspace.name}: ${forgetResult.stderr || forgetResult.stdout}`);
  }

  output({
    forgotten: true,
    workspace: {
      ...workspace,
      exists_on_disk: fs.existsSync(workspace.path),
    },
  }, raw);
}

function cmdWorkspaceCleanup(cwd, raw) {
  requireJjForExecution(cwd, 'workspace cleanup');
  const workspaces = listManagedWorkspaces(cwd).map((workspace) => inspectWorkspace(workspace));
  const cleaned = [];
  const retained = [];

  for (const workspace of workspaces) {
    if (workspace.recovery_needed) {
      retained.push({
        ...workspace,
        retained: true,
        reason: `Preserved ${workspace.status} workspace for inspection and recovery.`,
      });
      continue;
    }

    const forgetResult = execJj(cwd, ['workspace', 'forget', workspace.name]);
    if (forgetResult.exitCode !== 0) {
      debugLog('workspace.cleanup', `failed to forget ${workspace.name}`, forgetResult.stderr || forgetResult.stdout);
      continue;
    }
    try {
      fs.rmSync(workspace.path, { recursive: true, force: true });
    } catch (err) {
      debugLog('workspace.cleanup', `failed to delete ${workspace.path}`, err);
    }
    cleaned.push({
      ...workspace,
      removed_from_disk: !fs.existsSync(workspace.path),
    });
  }

  output({ cleaned: cleaned.length, retained: retained.length, workspaces: cleaned, retained_workspaces: retained }, raw);
}

function cmdWorkspaceReconcile(cwd, target, raw) {
  requireJjForExecution(cwd, 'workspace reconcile');
  if (!target) {
    error('Usage: bgsd-tools workspace reconcile <plan-id|workspace-name>');
  }

  const workspace = resolveWorkspaceTarget(cwd, target);
  if (!workspace) {
    error(`No managed workspace found for ${target}.`);
  }

  const inspected = inspectWorkspace(workspace);
  const parsed = parsePlanId(inspected.plan_id || inspected.name || '');
  const phaseInventory = parsed ? listActiveWorkspaceInventory(cwd, parsed.phase) : [];
  const enriched = phaseInventory.find((entry) => entry.name === inspected.name) || applyWaveRecoveryMetadata(inspected, []);

  output({
    reconciled: enriched.status === 'healthy',
    mode: 'preview',
    workspace: enriched,
    status: enriched.status,
    result_manifest: enriched.result_manifest,
    diagnostics: enriched.diagnostics,
    recovery_allowed: enriched.recovery_allowed,
    recovery_preview: enriched.recovery_preview,
    recovery_summary: enriched.recovery_summary,
    message: enriched.recovery_needed
      ? 'Preview only: inspect the JJ-backed diagnostics and recovery proposal before choosing any mutation.'
      : enriched.result_manifest?.quarantine
        ? 'Preview only: inspect the quarantined workspace result manifest before finalize.'
        : 'Preview only: workspace reconcile remains preview-only; inspect the summary first and review direct proof for major completion claims or risky runtime/shared-state work.',
  }, raw);
}

function cmdWorkspaceProve(cwd, target, raw) {
  requireJjForExecution(cwd, 'workspace prove');
  if (!target) {
    error('Usage: bgsd-tools workspace prove <plan-id|workspace-name>');
  }

  const workspaceName = toWorkspaceName(target) || target;
  const proof = collectWorkspaceProof(cwd, workspaceName, cwd);
  output(proof, raw);
}

function getPhaseFilesModified(cwd, phaseNumber) {
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const normalizedPhase = String(phaseNumber).replace(/^0+/, '') || '0';
  const results = [];

  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    let phaseDir = null;
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dirMatch = entry.name.match(/^(\d+(?:\.\d+)?)-?(.*)/);
      if (!dirMatch) continue;
      const dirPhaseNum = dirMatch[1].replace(/^0+/, '') || '0';
      if (dirPhaseNum === normalizedPhase) {
        phaseDir = entry;
        break;
      }
    }
    if (!phaseDir) return results;

    const phasePath = path.join(phasesDir, phaseDir.name);
    const planFiles = fs.readdirSync(phasePath).filter((file) => file.match(/^\d+-\d+-PLAN\.md$/));

    for (const planFile of planFiles) {
      const content = fs.readFileSync(path.join(phasePath, planFile), 'utf-8');
      const fm = extractFrontmatter(content);
      const idMatch = planFile.match(/^(\d+-\d+)-PLAN\.md$/);
      if (!idMatch) continue;
      results.push({
        planId: idMatch[1],
        wave: String(fm.wave || '0'),
        files_modified: fm.files_modified || [],
      });
    }
  } catch (err) {
    debugLog('workspace.overlap', 'error reading phase plans', err);
  }

  return results;
}

module.exports = {
  cmdWorkspaceAdd,
  cmdWorkspaceList,
  cmdWorkspaceForget,
  cmdWorkspaceCleanup,
  cmdWorkspaceProve,
  cmdWorkspaceReconcile,
  getPhaseFilesModified,
  listManagedWorkspaces,
  listActiveWorkspaceInventory,
  parsePlanId,
  summarizeWorkspaceInventory,
};
