'use strict';

const { spawnSync } = require('child_process');
const { error } = require('./output');

function buildPlanningCapabilityContext(options = {}) {
  const workspace = options.workspace || {};

  return {
    advisory: true,
    execution_backend: 'jj-workspace',
    jj_required_for_execution: true,
    workspace_backed_parallelism: true,
    recovery_supported: true,
    workspace: {
      config_keys: ['workspace.base_path', 'workspace.max_concurrent'],
      base_path: workspace.base_path || '/tmp/gsd-workspaces',
      max_concurrent: workspace.max_concurrent || 3,
    },
    sibling_work_advisory: 'Planning and roadmapping may prefer low-overlap sibling work when plan/file ownership data indicates it is safe.',
    metadata: {
      capability_only: true,
      excludes_live_inventory: true,
      automatic_routing: false,
    },
  };
}

function execJj(cwd, args) {
  try {
    const result = spawnSync('jj', args, {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    return {
      exitCode: result.status ?? 1,
      stdout: String(result.stdout || '').trim(),
      stderr: String(result.stderr || '').trim(),
      error: result.error || null,
    };
  } catch (err) {
    return {
      exitCode: 1,
      stdout: String(err.stdout || '').trim(),
      stderr: String(err.stderr || err.message || '').trim(),
      error: err,
    };
  }
}

function isGitRepo(cwd) {
  const result = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return result.status === 0 && String(result.stdout || '').trim() === 'true';
}

function classifyJjEnvironment(cwd) {
  const result = spawnSync('jj', ['root'], {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error && result.error.code === 'ENOENT') {
    return {
      ok: false,
      kind: 'jj-missing',
      setup_command: 'jj git init',
      stderr: '',
    };
  }

  if (result.status === 0) {
    return {
      ok: true,
      kind: 'jj-backed-repo',
      root: (result.stdout || '').trim() || cwd,
      setup_command: 'jj git init',
      stderr: (result.stderr || '').trim(),
    };
  }

  const stderr = (result.stderr || '').trim();
  const isGitOnlyRepo = /There is no jj repo/i.test(stderr) && isGitRepo(cwd);

  return {
    ok: false,
    kind: isGitOnlyRepo ? 'git-only-repo' : 'jj-unavailable',
    setup_command: 'jj git init',
    stderr,
  };
}

function requireJjForExecution(cwd, surface) {
  const status = classifyJjEnvironment(cwd);
  if (status.ok) return status;

  if (status.kind === 'jj-missing') {
    error(`Jujutsu (jj) is required for ${surface}. Install jj, then run \`jj git init\` in this repository before retrying.`);
  }

  if (status.kind === 'git-only-repo') {
    error(`Jujutsu (jj) is required for ${surface}. This repository is Git-backed but not JJ-backed yet. Run \`jj git init\` from the repo root, then retry.`);
  }

  error(`Jujutsu (jj) is required for ${surface}. ${status.stderr || 'Run `jj git init` from the repo root, then retry.'}`);
}

function classifyPathScopedCommitFallback(cwd, failures, files) {
  const environment = classifyJjEnvironment(cwd);
  const fileList = Array.isArray(files) && files.length > 0 ? files : ['.planning/'];
  const failureChecks = Array.isArray(failures)
    ? failures.map((failure) => failure && failure.check).filter(Boolean)
    : [];
  const allowedChecks = new Set(['detached_head', 'dirty_tree']);

  if (!environment.ok) {
    return {
      supported: false,
      reason: 'jj_unavailable',
      environment,
      files: fileList,
      checks: failureChecks,
    };
  }

  if (fileList.length === 0) {
    return {
      supported: false,
      reason: 'missing_path_scope',
      environment,
      files: fileList,
      checks: failureChecks,
    };
  }

  if (failureChecks.length === 0 || failureChecks.some((check) => !allowedChecks.has(check))) {
    return {
      supported: false,
      reason: 'unsupported_failures',
      environment,
      files: fileList,
      checks: failureChecks,
    };
  }

  return {
    supported: true,
    reason: 'jj_path_scoped_fallback',
    environment,
    files: fileList,
    checks: failureChecks,
  };
}

module.exports = {
  buildPlanningCapabilityContext,
  execJj,
  classifyJjEnvironment,
  classifyPathScopedCommitFallback,
  requireJjForExecution,
};
