'use strict';

const { checkAuth, createPullRequest, isGhUsable } = require('../cli-tools/gh');
const { execGit } = require('../git');
const { buildReleaseMutationPreview, executeReleaseTag, hasLocalTag, persistReleaseProgress } = require('./mutate');
const { readReleaseState } = require('./state');

function getCurrentBranch(cwd) {
  const result = execGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
  return result.exitCode === 0 ? result.stdout.trim() : null;
}

function remoteExists(cwd, remote = 'origin') {
  const result = execGit(cwd, ['remote']);
  return result.exitCode === 0 && result.stdout.split('\n').map((line) => line.trim()).includes(remote);
}

function ensureHeadBranch(cwd, baseBranch, headBranch) {
  const currentBranch = getCurrentBranch(cwd);
  if (currentBranch === headBranch) {
    return { ok: true, current_branch: currentBranch, branch_name: headBranch, created: false };
  }

  if (currentBranch && currentBranch !== 'HEAD' && currentBranch !== baseBranch) {
    return { ok: true, current_branch: currentBranch, branch_name: currentBranch, created: false };
  }

  const result = execGit(cwd, ['checkout', '-B', headBranch]);
  return {
    ok: result.exitCode === 0,
    current_branch: result.exitCode === 0 ? headBranch : currentBranch,
    branch_name: headBranch,
    created: true,
    error: result.stderr || result.stdout || null,
  };
}

function pushReleaseRefs(cwd, remote, branchName, tagName) {
  return execGit(cwd, ['push', '-u', remote, branchName, `refs/tags/${tagName}`]);
}

function deleteLocalTag(cwd, tagName) {
  return execGit(cwd, ['tag', '-d', tagName]);
}

function buildPrDetails(preview, options = {}) {
  const baseBranch = options.base || 'main';
  const branchName = options.head || `release/v${preview.target_version}`;
  const highlights = (preview.changelog_summary || [])
    .map((entry) => entry.one_liner || entry.title)
    .filter(Boolean)
    .slice(0, 3);
  const title = `release: v${preview.target_version}`;
  const bodyLines = [
    '## Summary',
    '',
    '- Release version: `v' + preview.target_version + '`',
    '- Tag: `' + preview.tag_name + '`',
  ];

  for (const item of highlights) bodyLines.push(`- ${item}`);

  bodyLines.push('', '## Changelog Draft', '', '```markdown', preview.changelog_preview.trim(), '```');

  return {
    title,
    body: bodyLines.join('\n'),
    base_branch: baseBranch,
    branch_name: branchName,
    github_ci: {
      workflow: '/bgsd-github-ci',
      branch_name: branchName,
      base_branch: baseBranch,
      scope: `release-${preview.target_version}`,
    },
  };
}

function buildGhPreflight() {
  const usable = isGhUsable();
  if (!usable.usable) {
    return {
      ok: false,
      message: usable.message,
      fix_command: usable.reason === 'blocked_version' ? 'gh upgrade' : 'gh auth login',
    };
  }

  const auth = checkAuth();
  if (!auth.success || !auth.result || !auth.result.authenticated) {
    return {
      ok: false,
      message: auth.error || 'Not authenticated to GitHub. Run: gh auth login',
      fix_command: 'gh auth login',
    };
  }

  return {
    ok: true,
    version: usable.version,
  };
}

function executeReleasePr(cwd, options = {}) {
  const preview = buildReleaseMutationPreview(cwd, options);
  const prDetails = buildPrDetails(preview, options);
  let state = readReleaseState(cwd);

  const ghPreflight = buildGhPreflight();
  if (!ghPreflight.ok) {
    state = persistReleaseProgress(cwd, state, {
      command: 'release:pr',
      status: 'blocked',
      target_version: preview.target_version,
      tag_name: preview.tag_name,
      preview,
      pr: prDetails,
      completed_steps: Array.isArray(state?.completed_steps) ? state.completed_steps : [],
      next_safe_step: 'gh-preflight',
      next_safe_command: 'gh auth login && node bin/bgsd-tools.cjs release:pr --resume',
      error: ghPreflight.message,
    });
    return {
      command: 'release:pr',
      status: 'blocked',
      message: ghPreflight.message,
      fix_command: ghPreflight.fix_command,
      preview,
      pr: prDetails,
      state,
    };
  }

  const tagResult = executeReleaseTag(cwd, { ...options, resume: options.resume || !!state });
  if (tagResult.status !== 'ok') {
    return {
      command: 'release:pr',
      status: 'blocked',
      message: 'Release tag step did not complete successfully.',
      preview,
      pr: prDetails,
      state: readReleaseState(cwd),
    };
  }

  state = readReleaseState(cwd);
  const branchResult = ensureHeadBranch(cwd, prDetails.base_branch, prDetails.branch_name);
  if (!branchResult.ok) {
    state = persistReleaseProgress(cwd, state, {
      command: 'release:pr',
      status: 'blocked',
      pr: { ...prDetails, branch_name: prDetails.branch_name },
      error: branchResult.error,
      next_safe_step: 'branch-create',
      next_safe_command: 'node bin/bgsd-tools.cjs release:pr --resume',
    });
    return {
      command: 'release:pr',
      status: 'blocked',
      message: branchResult.error || 'Failed to prepare release branch.',
      preview,
      pr: prDetails,
      state,
    };
  }

  const effectivePr = { ...prDetails, branch_name: branchResult.branch_name };

  if (!remoteExists(cwd, 'origin')) {
    const cleanupPerformed = [];
    if (hasLocalTag(cwd, preview.tag_name)) {
      const cleanupResult = deleteLocalTag(cwd, preview.tag_name);
      if (cleanupResult.exitCode === 0) cleanupPerformed.push(`deleted-local-tag:${preview.tag_name}`);
    }

    state = persistReleaseProgress(cwd, state, {
      command: 'release:pr',
      status: 'blocked',
      pr: effectivePr,
      completed_steps: cleanupPerformed.length > 0
        ? (state.completed_steps || []).filter((step) => step !== 'tag-created')
        : state.completed_steps,
      cleanup: {
        attempted: [...(state.cleanup?.attempted || []), `delete-local-tag:${preview.tag_name}`],
        performed: [...(state.cleanup?.performed || []), ...cleanupPerformed],
      },
      next_safe_step: cleanupPerformed.length > 0 ? 'tag-create' : 'remote-push',
      next_safe_command: 'git remote add origin <url> && node bin/bgsd-tools.cjs release:pr --resume',
      error: 'No git remote configured. Add one with: git remote add origin <url>',
    });
    return {
      command: 'release:pr',
      status: 'blocked',
      message: state.error,
      preview,
      pr: effectivePr,
      state,
    };
  }

  if (!state.completed_steps.includes('remote-pushed')) {
    const pushResult = pushReleaseRefs(cwd, 'origin', effectivePr.branch_name, preview.tag_name);
    if (pushResult.exitCode !== 0) {
      state = persistReleaseProgress(cwd, state, {
        command: 'release:pr',
        status: 'blocked',
        pr: effectivePr,
        next_safe_step: 'remote-push',
        next_safe_command: 'node bin/bgsd-tools.cjs release:pr --resume',
        error: pushResult.stderr || pushResult.stdout || 'Failed to push release refs.',
      });
      return {
        command: 'release:pr',
        status: 'blocked',
        message: state.error,
        preview,
        pr: effectivePr,
        state,
      };
    }

    state = persistReleaseProgress(cwd, state, {
      command: 'release:pr',
      status: 'running',
      pr: effectivePr,
      completed_steps: [...state.completed_steps, 'remote-pushed'],
      next_safe_step: 'pr-create',
      next_safe_command: 'node bin/bgsd-tools.cjs release:pr --resume',
    });
  }

  if (!state.completed_steps.includes('pr-created')) {
    const createdPr = createPullRequest({
      title: effectivePr.title,
      body: effectivePr.body,
      base: effectivePr.base_branch,
      head: effectivePr.branch_name,
    });

    if (!createdPr.success) {
      state = persistReleaseProgress(cwd, state, {
        command: 'release:pr',
        status: 'blocked',
        pr: effectivePr,
        next_safe_step: 'pr-create',
        next_safe_command: 'node bin/bgsd-tools.cjs release:pr --resume',
        error: createdPr.error || 'Failed to create release PR.',
      });
      return {
        command: 'release:pr',
        status: 'blocked',
        message: state.error,
        preview,
        pr: effectivePr,
        state,
      };
    }

    state = persistReleaseProgress(cwd, state, {
      command: 'release:pr',
      status: 'ready',
      pr: {
        ...effectivePr,
        url: createdPr.result.url,
      },
      completed_steps: [...state.completed_steps, 'pr-created'],
      next_safe_step: 'github-ci',
      next_safe_command: `/bgsd-github-ci --branch ${effectivePr.branch_name} --base ${effectivePr.base_branch} --scope ${effectivePr.github_ci.scope}`,
    });
  }

  return {
    command: 'release:pr',
    status: 'ok',
    advisory: false,
    dry_run: false,
    preview,
    pr: state.pr,
    completed_steps: state.completed_steps,
    last_safe_completed_step: state.last_safe_completed_step,
    next_safe_step: state.next_safe_step,
    next_safe_command: state.next_safe_command,
    state_file: state.state_file,
    github_ci: state.pr.github_ci,
  };
}

function formatReleasePr(result) {
  const lines = [];
  lines.push('release:pr');
  lines.push(`- Status: ${result.status}`);
  lines.push(`- Version: ${result.preview.target_version}`);
  lines.push(`- Tag: ${result.preview.tag_name}`);
  lines.push(`- Branch: ${result.pr.branch_name}`);
  lines.push(`- Base: ${result.pr.base_branch}`);
  lines.push(`- Title: ${result.pr.title}`);
  if (result.pr.url) lines.push(`- PR: ${result.pr.url}`);
  if (result.next_safe_step) lines.push(`- Next safe step: ${result.next_safe_step}`);
  if (result.next_safe_command) lines.push(`- Next command: ${result.next_safe_command}`);
  return lines.join('\n');
}

module.exports = {
  buildGhPreflight,
  buildPrDetails,
  executeReleasePr,
  formatReleasePr,
};
