'use strict';

const fs = require('fs');
const path = require('path');
const { extractFrontmatter } = require('./frontmatter');
const { execJj } = require('./jj');

const OP_LOG_LIMIT = 5;
const WORKSPACE_FALLBACK_REASON = 'workspace proof missing or mismatched before work start';
const SHARED_PLANNING_FILES = [
  '.planning/STATE.md',
  '.planning/ROADMAP.md',
  '.planning/REQUIREMENTS.md',
];

function toPosixPath(targetPath) {
  return String(targetPath || '').split(path.sep).join('/');
}

function comparablePath(targetPath) {
  if (!targetPath) return null;
  try {
    return fs.realpathSync.native(targetPath);
  } catch {
    return path.resolve(targetPath);
  }
}

function collectWorkspaceProof(repoCwd, workspaceName, observedCwd = repoCwd) {
  const normalizedObservedCwd = comparablePath(observedCwd);
  const intendedRootResult = workspaceName
    ? execJj(repoCwd, ['workspace', 'root', '--name', workspaceName])
    : { exitCode: 1, stdout: '', stderr: 'Workspace name is required.', error: null };
  const observedJjRootResult = execJj(observedCwd, ['workspace', 'root']);

  const intendedRoot = intendedRootResult.exitCode === 0
    ? comparablePath(intendedRootResult.stdout.trim())
    : null;
  const observedJjRoot = observedJjRootResult.exitCode === 0
    ? comparablePath(observedJjRootResult.stdout.trim())
    : null;
  const parallelAllowed = Boolean(
    intendedRoot
    && normalizedObservedCwd
    && observedJjRoot
    && intendedRoot === normalizedObservedCwd
    && normalizedObservedCwd === observedJjRoot
  );

  return {
    workspace_name: workspaceName || null,
    intended_root: intendedRoot,
    observed_cwd: normalizedObservedCwd,
    observed_jj_root: observedJjRoot,
    parallel_allowed: parallelAllowed,
    fallback_reason: parallelAllowed ? null : WORKSPACE_FALLBACK_REASON,
    evidence: {
      intended_root_lookup: {
        command: workspaceName ? `jj workspace root --name ${workspaceName}` : null,
        exit_code: intendedRootResult.exitCode,
      },
      observed_jj_root_lookup: {
        command: 'jj workspace root',
        exit_code: observedJjRootResult.exitCode,
      },
    },
  };
}

function summarizeLines(text, limit = 4) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function parseOpLogEntries(stdout) {
  return String(stdout || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, ...rest] = line.split('\t');
      return {
        id: (id || '').trim(),
        summary: rest.join('\t').trim() || null,
      };
    })
    .filter((entry) => entry.id);
}

function parseStatusPaths(stdout) {
  return String(stdout || '')
    .split('\n')
    .map((line) => line.trim())
    .map((line) => line.match(/^[AMDRC?]\s+(.+)$/))
    .filter(Boolean)
    .map((match) => toPosixPath(match[1].trim()));
}

function findPlanFile(workspaceRoot, planId) {
  const phasesDir = path.join(workspaceRoot, '.planning', 'phases');
  if (!fs.existsSync(phasesDir)) return null;

  for (const entry of fs.readdirSync(phasesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(phasesDir, entry.name, `${planId}-PLAN.md`);
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

function findLocalArtifact(workspaceRoot, planId, suffix) {
  const phasesDir = path.join(workspaceRoot, '.planning', 'phases');
  if (!fs.existsSync(phasesDir)) return null;

  for (const entry of fs.readdirSync(phasesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(phasesDir, entry.name, `${planId}${suffix}`);
    if (fs.existsSync(candidate)) {
      return toPosixPath(path.relative(workspaceRoot, candidate));
    }
  }

  return null;
}

function getPlanMetadata(workspaceRoot, planId) {
  const planPath = findPlanFile(workspaceRoot, planId);
  if (!planPath) return null;

  try {
    const content = fs.readFileSync(planPath, 'utf-8');
    const frontmatter = extractFrontmatter(content);
    return {
      plan_path: toPosixPath(path.relative(workspaceRoot, planPath)),
      verification_route: String(frontmatter.verification_route || 'skip'),
      files_modified: Array.isArray(frontmatter.files_modified) ? frontmatter.files_modified : [],
    };
  } catch {
    return null;
  }
}

function getProofBuckets(verificationRoute) {
  if (verificationRoute === 'light' || verificationRoute === 'full') {
    return {
      behavior: 'required',
      regression: 'required',
      human: 'not required',
    };
  }

  return {
    behavior: 'not required',
    regression: 'not required',
    human: 'not required',
  };
}

function claimsMajorCompletion(summaryPath, workspaceRoot) {
  if (!summaryPath) return false;
  try {
    const content = fs.readFileSync(path.join(workspaceRoot, summaryPath), 'utf-8');
    return /phase complete|milestone complete|all tasks done|major completion/i.test(content);
  } catch {
    return false;
  }
}

function isRiskySurface(filePath) {
  return /^(src\/|bin\/|plugin\.js$|workflows\/|\.planning\/(STATE|ROADMAP|REQUIREMENTS)\.md$)/.test(filePath);
}

function getInspectionLevel(planMetadata, summaryPath, workspaceRoot) {
  const filesModified = planMetadata?.files_modified || [];
  const verificationRoute = planMetadata?.verification_route || 'skip';
  const risky = verificationRoute === 'full' || filesModified.some((filePath) => isRiskySurface(String(filePath)));
  return risky || claimsMajorCompletion(summaryPath, workspaceRoot) ? 'direct-proof' : 'summary-first';
}

function classifySharedPlanningViolation(changedPaths) {
  const files = SHARED_PLANNING_FILES.filter((filePath) => changedPaths.includes(filePath));
  if (files.length === 0) {
    return {
      status: 'none',
      files: [],
      quarantine: false,
      repair_candidate: false,
      summary: 'No direct shared planning writes detected.',
    };
  }

  if (files.length === 1) {
    return {
      status: 'repairable',
      files,
      quarantine: false,
      repair_candidate: true,
      summary: 'First clearly containable shared-planning write detected; repair before finalize.',
    };
  }

  return {
    status: 'quarantine',
    files,
    quarantine: true,
    repair_candidate: false,
    summary: 'Repeated or serious shared-planning writes detected; quarantine before finalize.',
  };
}

function createResultManifest(workspace, statusOutput) {
  const planMetadata = workspace.path && workspace.plan_id ? getPlanMetadata(workspace.path, workspace.plan_id) : null;
  const summaryPath = workspace.path && workspace.plan_id ? findLocalArtifact(workspace.path, workspace.plan_id, '-SUMMARY.md') : null;
  const tddAuditPath = workspace.path && workspace.plan_id ? findLocalArtifact(workspace.path, workspace.plan_id, '-TDD-AUDIT.json') : null;
  const changedPaths = parseStatusPaths(statusOutput);
  const sharedPlanningViolation = classifySharedPlanningViolation(changedPaths);

  return {
    plan_id: workspace.plan_id || null,
    workspace_name: workspace.name,
    workspace_root: workspace.path,
    plan_path: planMetadata?.plan_path || null,
    summary_path: summaryPath,
    proof_path: tddAuditPath,
    verification_route: planMetadata?.verification_route || 'skip',
    proof_buckets: getProofBuckets(planMetadata?.verification_route || 'skip'),
    inspection_level: getInspectionLevel(planMetadata, summaryPath, workspace.path),
    shared_planning_violation: sharedPlanningViolation,
    quarantine: sharedPlanningViolation.quarantine,
  };
}

function createRecoveryPreview(workspace, status, statusResult) {
  if (status === 'stale') {
    return {
      summary: 'Preview only: refresh the stale working copy with JJ before any cleanup.',
      automated_apply_allowed: true,
      commands: [
        {
          command: `jj -R ${JSON.stringify(workspace.path)} workspace update-stale`,
          purpose: 'Refresh the workspace files to the latest recorded operation',
        },
      ],
      risks: [],
    };
  }

  if (status === 'divergent') {
    return {
      summary: 'Preview only: the workspace has unresolved conflicts and needs manual resolution.',
      automated_apply_allowed: false,
      commands: [
        {
          command: `jj -R ${JSON.stringify(workspace.path)} status`,
          purpose: 'Inspect the conflicted working copy and confirm the affected files',
        },
        {
          command: `jj -R ${JSON.stringify(workspace.path)} resolve`,
          purpose: 'Resolve the conflicted files in the workspace manually',
        },
      ],
      risks: summarizeLines(statusResult.stderr || statusResult.stdout, 2),
    };
  }

  if (status === 'missing') {
    return {
      summary: 'Workspace root is no longer present on disk. Inspect before forgetting or recreating it.',
      automated_apply_allowed: false,
      commands: [
        {
          command: `jj workspace root --name ${workspace.name}`,
          purpose: 'Confirm JJ still tracks the workspace name',
        },
        {
          command: `node bin/bgsd-tools.cjs workspace forget ${workspace.name}`,
          purpose: 'Forget the missing workspace once breadcrumbs are no longer needed',
        },
      ],
      risks: ['Disk path missing; cleanup would discard the last tracked workspace reference.'],
    };
  }

  if (status === 'failed') {
    return {
      summary: 'Workspace inspection failed unexpectedly. Preserve breadcrumbs and inspect JJ errors first.',
      automated_apply_allowed: false,
      commands: [
        {
          command: `jj -R ${JSON.stringify(workspace.path)} status`,
          purpose: 'Retry the failing JJ status command directly for full diagnostics',
        },
      ],
      risks: summarizeLines(statusResult.stderr || statusResult.stdout, 2),
    };
  }

  return null;
}

function inspectWorkspace(workspace) {
  const diagnostics = {
    workspace: {
      name: workspace.name,
      path: workspace.path,
      plan_id: workspace.plan_id,
      change_id: workspace.change_id,
      commit_id: workspace.commit_id,
    },
    evidence: [],
    op_log: [],
  };

  const rootExists = !!workspace.path && fs.existsSync(workspace.path);
  if (!rootExists) {
    const status = 'missing';
    diagnostics.evidence.push({
      kind: 'workspace_root',
      command: `jj workspace root --name ${workspace.name}`,
      exit_code: 0,
      summary: `Workspace path is missing on disk: ${workspace.path}`,
    });
    return {
      ...workspace,
      status,
      recovery_needed: true,
      recovery_allowed: false,
      diagnostics,
      recovery_preview: createRecoveryPreview(workspace, status, { stdout: '', stderr: '' }),
    };
  }

  const statusResult = execJj(workspace.path, ['status']);
  const statusOutput = [statusResult.stdout, statusResult.stderr].filter(Boolean).join('\n');
  let status = 'healthy';

  if (statusResult.exitCode !== 0) {
    if (/working copy is stale/i.test(statusOutput)) {
      status = 'stale';
    } else {
      status = 'failed';
    }
  } else if (/unresolved conflicts/i.test(statusOutput) || /\(conflict\)/i.test(statusOutput)) {
    status = 'divergent';
  }

  const summaryLimit = status === 'divergent' ? 8 : 4;
  const summaryText = summarizeLines(statusOutput, summaryLimit).join(' | ');
  diagnostics.evidence.push({
    kind: 'jj_status',
    command: 'jj status',
    exit_code: statusResult.exitCode,
    summary: status === 'divergent'
      ? `Unresolved conflicts detected. ${summaryText}`.trim()
      : (summaryText || 'The working copy has no changes.'),
  });

  const opLogResult = execJj(workspace.path, ['op', 'log', '--limit', String(OP_LOG_LIMIT), '--no-graph', '-T', 'id.short(8) ++ "\t" ++ description.first_line() ++ "\n"']);
  if (opLogResult.exitCode === 0) {
    diagnostics.op_log = parseOpLogEntries(opLogResult.stdout);
  } else {
    diagnostics.evidence.push({
      kind: 'jj_op_log',
      command: `jj op log --limit ${OP_LOG_LIMIT}`,
      exit_code: opLogResult.exitCode,
      summary: summarizeLines(opLogResult.stderr || opLogResult.stdout, 2).join(' | ') || 'Unable to read JJ operation log.',
    });
  }

  return {
    ...workspace,
    status,
    recovery_needed: status !== 'healthy',
    recovery_allowed: status === 'stale',
    diagnostics,
    result_manifest: createResultManifest(workspace, statusOutput),
    recovery_preview: createRecoveryPreview(workspace, status, statusResult),
  };
}

module.exports = {
  collectWorkspaceProof,
  comparablePath,
  inspectWorkspace,
  SHARED_PLANNING_FILES,
  WORKSPACE_FALLBACK_REASON,
};
