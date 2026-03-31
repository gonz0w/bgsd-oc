'use strict';

const fs = require('fs');
const path = require('path');
const { buildReleaseBump } = require('./bump');
const { buildReleaseChangelog } = require('./changelog');
const { execGit } = require('../git');
const { readReleaseState, writeReleaseState } = require('./state');

const VERSION_FILES = ['package.json', 'package-lock.json', 'VERSION'];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf-8');
}

function updatePackageLockVersion(lockfile, version) {
  if (lockfile && typeof lockfile === 'object') {
    lockfile.version = version;
    if (lockfile.packages && lockfile.packages[''] && typeof lockfile.packages[''] === 'object') {
      lockfile.packages[''].version = version;
    }
  }
  return lockfile;
}

function syncReleaseVersionFiles(cwd, version) {
  const packagePath = path.join(cwd, 'package.json');
  const lockPath = path.join(cwd, 'package-lock.json');
  const versionPath = path.join(cwd, 'VERSION');

  const pkg = readJson(packagePath);
  pkg.version = version;
  writeJson(packagePath, pkg);

  if (fs.existsSync(lockPath)) {
    const lockfile = updatePackageLockVersion(readJson(lockPath), version);
    writeJson(lockPath, lockfile);
  }

  fs.writeFileSync(versionPath, version + '\n', 'utf-8');

  return VERSION_FILES.filter((file) => fs.existsSync(path.join(cwd, file)));
}

function buildReleaseMutationPreview(cwd, options = {}) {
  const bump = buildReleaseBump(cwd, options);
  const changelog = buildReleaseChangelog(cwd, options);
  const targetVersion = bump.proposed_version;
  return {
    current_version: bump.current_version,
    target_version: targetVersion,
    proposed_bump: bump.proposed_bump,
    tag_name: `v${targetVersion}`,
    changelog_path: changelog.changelog_path,
    changelog_preview: changelog.file_preview,
    changelog_summary: changelog.summary_files,
    ambiguity: bump.ambiguity,
  };
}

function persistReleaseProgress(cwd, baseState, patch) {
  return writeReleaseState(cwd, {
    ...(baseState || {}),
    ...patch,
  });
}

function createAnnotatedReleaseTag(cwd, tagName, version) {
  const result = execGit(cwd, ['tag', '-a', tagName, '-m', `Release ${version}`]);
  return {
    ok: result.exitCode === 0,
    error: result.stderr || result.stdout || null,
  };
}

function hasLocalTag(cwd, tagName) {
  const result = execGit(cwd, ['rev-parse', '-q', '--verify', `refs/tags/${tagName}`]);
  return result.exitCode === 0;
}

function executeReleaseTag(cwd, options = {}) {
  const preview = buildReleaseMutationPreview(cwd, options);
  const previous = options.resume ? readReleaseState(cwd) : null;
  let state = persistReleaseProgress(cwd, previous, {
    command: 'release:tag',
    status: 'running',
    target_version: preview.target_version,
    tag_name: preview.tag_name,
    preview,
    completed_steps: Array.isArray(previous?.completed_steps) ? previous.completed_steps : [],
    next_safe_step: 'version-files-update',
    next_safe_command: 'node bin/bgsd-tools.cjs release:tag --resume',
  });

  if (!state.completed_steps.includes('version-files-updated')) {
    const updatedFiles = syncReleaseVersionFiles(cwd, preview.target_version);
    state = persistReleaseProgress(cwd, state, {
      status: 'running',
      version_files: updatedFiles,
      completed_steps: [...state.completed_steps, 'version-files-updated'],
      next_safe_step: 'changelog-update',
    });
  }

  if (!state.completed_steps.includes('changelog-updated')) {
    fs.writeFileSync(path.join(cwd, 'CHANGELOG.md'), preview.changelog_preview, 'utf-8');
    state = persistReleaseProgress(cwd, state, {
      status: 'running',
      completed_steps: [...state.completed_steps, 'changelog-updated'],
      next_safe_step: 'tag-create',
    });
  }

  if (!state.completed_steps.includes('tag-created')) {
    if (!hasLocalTag(cwd, preview.tag_name)) {
      const tagResult = createAnnotatedReleaseTag(cwd, preview.tag_name, preview.target_version);
      if (!tagResult.ok) {
        state = persistReleaseProgress(cwd, state, {
          status: 'blocked',
          error: tagResult.error,
          next_safe_step: 'tag-create',
        });
        return {
          command: 'release:tag',
          status: 'blocked',
          message: 'Release tag creation failed.',
          state,
        };
      }
    }

    state = persistReleaseProgress(cwd, state, {
      status: 'ready',
      completed_steps: [...state.completed_steps, 'tag-created'],
      next_safe_step: 'release-pr',
      next_safe_command: 'node bin/bgsd-tools.cjs release:pr --resume',
    });
  }

  return {
    command: 'release:tag',
    status: 'ok',
    advisory: false,
    dry_run: false,
    current_version: preview.current_version,
    target_version: preview.target_version,
    proposed_bump: preview.proposed_bump,
    tag_name: preview.tag_name,
    version_files: state.version_files || VERSION_FILES,
    state_file: state.state_file,
    completed_steps: state.completed_steps,
    last_safe_completed_step: state.last_safe_completed_step,
    next_safe_step: state.next_safe_step,
    next_safe_command: state.next_safe_command,
  };
}

function formatReleaseTag(result) {
  const lines = [];
  lines.push('release:tag');
  lines.push(`- Status: ${result.status}`);
  lines.push(`- Version: ${result.current_version} -> ${result.target_version}`);
  lines.push(`- Tag: ${result.tag_name}`);
  lines.push(`- Updated files: ${(result.version_files || []).join(', ')}`);
  if (result.state_file) lines.push(`- Resume state: ${result.state_file}`);
  if (result.next_safe_step) lines.push(`- Next safe step: ${result.next_safe_step}`);
  if (result.next_safe_command) lines.push(`- Next command: ${result.next_safe_command}`);
  return lines.join('\n');
}

module.exports = {
  VERSION_FILES,
  buildReleaseMutationPreview,
  executeReleaseTag,
  formatReleaseTag,
  hasLocalTag,
  persistReleaseProgress,
  syncReleaseVersionFiles,
};
