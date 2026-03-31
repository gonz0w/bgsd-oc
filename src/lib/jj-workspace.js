'use strict';

const fs = require('fs');
const { execJj } = require('./jj');

const OP_LOG_LIMIT = 5;

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
    recovery_preview: createRecoveryPreview(workspace, status, statusResult),
  };
}

module.exports = {
  inspectWorkspace,
};
