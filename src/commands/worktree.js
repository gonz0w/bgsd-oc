'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { output, error, debugLog } = require('../lib/output');
const { execGit } = require('../lib/git');
const { loadConfig } = require('../lib/config');

// --- Default Worktree Configuration ------------------------------------------

const WORKTREE_DEFAULTS = {
  enabled: false,
  base_path: '/tmp/gsd-worktrees',
  sync_files: ['.env', '.env.local', '.planning/config.json'],
  setup_hooks: [],
  max_concurrent: 3,
};

// --- Helpers -----------------------------------------------------------------

/**
 * Get the worktree config, merging user config with defaults.
 * Reads the raw config.json directly for the worktree section since
 * loadConfig() only handles CONFIG_SCHEMA fields.
 */
function getWorktreeConfig(cwd) {
  const defaults = { ...WORKTREE_DEFAULTS };

  try {
    const configPath = path.join(cwd, '.planning', 'config.json');
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (raw.worktree && typeof raw.worktree === 'object') {
      return { ...defaults, ...raw.worktree };
    }
  } catch {
    debugLog('worktree.config', 'No worktree config found, using defaults');
  }

  return defaults;
}

/**
 * Get the project name from cwd (directory basename).
 */
function getProjectName(cwd) {
  return path.basename(cwd);
}

/**
 * Parse a plan ID like "21-02" into { phase, plan }.
 */
function parsePlanId(planId) {
  if (!planId) return null;
  const match = planId.match(/^(\d+(?:\.\d+)?)-(\d+)$/);
  if (!match) return null;
  return { phase: match[1], plan: match[2] };
}

/**
 * Get the wave from a PLAN.md's frontmatter, if available.
 */
function getWaveFromPlan(cwd, planId) {
  const parsed = parsePlanId(planId);
  if (!parsed) return '0';

  // Search for the plan file
  const phasesDir = path.join(cwd, '.planning', 'phases');
  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const phaseDir = entries.find(e => e.isDirectory() && e.name.startsWith(parsed.phase.padStart(2, '0')));
    if (!phaseDir) return '0';

    const planFile = path.join(phasesDir, phaseDir.name, `${parsed.phase.padStart(2, '0')}-${parsed.plan.padStart(2, '0')}-PLAN.md`);
    if (!fs.existsSync(planFile)) return '0';

    const content = fs.readFileSync(planFile, 'utf-8');
    const waveMatch = content.match(/^wave:\s*(\d+)/m);
    return waveMatch ? waveMatch[1] : '0';
  } catch {
    return '0';
  }
}

/**
 * Parse `git worktree list --porcelain` output into structured data.
 * Each worktree block is separated by blank lines.
 * Format:
 *   worktree /path/to/worktree
 *   HEAD abc123
 *   branch refs/heads/branch-name
 */
function parseWorktreeListPorcelain(porcelainOutput) {
  if (!porcelainOutput || !porcelainOutput.trim()) return [];

  const worktrees = [];
  const blocks = porcelainOutput.split('\n\n');

  for (const block of blocks) {
    if (!block.trim()) continue;

    const lines = block.trim().split('\n');
    const wt = {};

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        wt.path = line.slice('worktree '.length);
      } else if (line.startsWith('HEAD ')) {
        wt.head = line.slice('HEAD '.length);
      } else if (line.startsWith('branch ')) {
        wt.branch = line.slice('branch '.length).replace('refs/heads/', '');
      } else if (line === 'bare') {
        wt.bare = true;
      } else if (line === 'detached') {
        wt.detached = true;
      }
    }

    if (wt.path) worktrees.push(wt);
  }

  return worktrees;
}

/**
 * Get disk usage for a path as human-readable string.
 */
function getDiskUsage(dirPath) {
  try {
    const result = execSync(`du -sh "${dirPath}" 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
    // Output is like "123M\t/path" — extract size
    const match = result.match(/^([\d.]+[BKMGT]?)\s/);
    return match ? match[1] : 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Get available disk space on the partition containing the given path.
 */
function getAvailableDiskMB(dirPath) {
  try {
    // Use df to get available space in 1K blocks
    const result = execSync(`df -k "${dirPath}" 2>/dev/null | tail -1`, {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
    const parts = result.split(/\s+/);
    // df columns: Filesystem, 1K-blocks, Used, Available, Use%, Mounted
    const availKB = parseInt(parts[3], 10);
    return isNaN(availKB) ? null : Math.round(availKB / 1024);
  } catch {
    return null;
  }
}

/**
 * Get project size in MB.
 */
function getProjectSizeMB(cwd) {
  try {
    const result = execSync(`du -sm "${cwd}" 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 10000,
    }).trim();
    const match = result.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  } catch {
    return null;
  }
}

// --- Command Implementations -------------------------------------------------

/**
 * cmdWorktreeCreate - Create an isolated worktree for a plan.
 *
 * @param {string} cwd - Project root directory
 * @param {string} planId - Plan ID (e.g., "21-02")
 * @param {boolean} raw - Raw JSON output mode
 */
function cmdWorktreeCreate(cwd, planId, raw) {
  if (!planId) {
    error('Usage: gsd-tools worktree create <plan-id>\n\nplan-id format: NN-MM (e.g., 21-02)');
  }

  const parsed = parsePlanId(planId);
  if (!parsed) {
    error(`Invalid plan ID "${planId}". Expected format: NN-MM (e.g., 21-02)`);
  }

  const config = getWorktreeConfig(cwd);
  const projectName = getProjectName(cwd);
  const wave = getWaveFromPlan(cwd, planId);
  const branchName = `worktree-${parsed.phase.padStart(2, '0')}-${parsed.plan.padStart(2, '0')}-${wave}`;
  const worktreePath = path.join(config.base_path, projectName, planId);

  // Pre-check: worktree already exists?
  const listResult = execGit(cwd, ['worktree', 'list', '--porcelain']);
  if (listResult.exitCode === 0) {
    const existing = parseWorktreeListPorcelain(listResult.stdout);
    const alreadyExists = existing.some(wt => wt.path === worktreePath || wt.branch === branchName);
    if (alreadyExists) {
      error(`Worktree already exists for plan ${planId} (path: ${worktreePath}, branch: ${branchName})`);
    }

    // Pre-check: max_concurrent not exceeded
    const projectWorktrees = existing.filter(wt =>
      wt.path && wt.path.startsWith(path.join(config.base_path, projectName))
    );
    if (projectWorktrees.length >= config.max_concurrent) {
      error(`Max concurrent worktrees (${config.max_concurrent}) reached. Remove a worktree first or increase max_concurrent in config.`);
    }
  }

  // Resource validation: check RAM
  const freeMemMB = Math.round(os.freemem() / (1024 * 1024));
  const requiredMemMB = config.max_concurrent * 4096; // 4GB per worktree estimate
  const resourceWarnings = [];
  if (freeMemMB < requiredMemMB) {
    resourceWarnings.push(`Low memory: ${freeMemMB}MB free, estimated need ${requiredMemMB}MB for ${config.max_concurrent} concurrent worktrees`);
  }

  // Disk space check
  const projectSizeMB = getProjectSizeMB(cwd);
  if (projectSizeMB) {
    const neededMB = Math.round(projectSizeMB * 1.5);
    // Check if base_path parent exists, create if needed
    const basePathParent = path.dirname(config.base_path);
    const availMB = getAvailableDiskMB(fs.existsSync(config.base_path) ? config.base_path : basePathParent);
    if (availMB !== null && availMB < neededMB) {
      resourceWarnings.push(`Low disk: ${availMB}MB available at ${config.base_path}, estimated need ${neededMB}MB`);
    }
  }

  // Ensure base_path/projectName directory exists
  const projectWorktreeDir = path.join(config.base_path, projectName);
  try {
    fs.mkdirSync(projectWorktreeDir, { recursive: true });
  } catch (e) {
    error(`Failed to create worktree base directory: ${projectWorktreeDir}: ${e.message}`);
  }

  // Create worktree with new branch
  const createResult = execGit(cwd, ['worktree', 'add', '-b', branchName, worktreePath]);
  if (createResult.exitCode !== 0) {
    error(`Failed to create worktree: ${createResult.stderr}`);
  }

  // Sync configured files
  const syncedFiles = [];
  for (const syncFile of config.sync_files) {
    const srcPath = path.join(cwd, syncFile);
    const destPath = path.join(worktreePath, syncFile);
    try {
      if (fs.existsSync(srcPath)) {
        // Ensure destination directory exists
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(srcPath, destPath);
        syncedFiles.push(syncFile);
      }
    } catch (e) {
      debugLog('worktree.sync', `Failed to sync ${syncFile}: ${e.message}`);
    }
  }

  // Run setup hooks
  let setupStatus = 'ok';
  let setupError = null;
  for (const hook of config.setup_hooks) {
    try {
      execSync(hook, {
        cwd: worktreePath,
        timeout: 120000,
        stdio: 'pipe',
        encoding: 'utf-8',
      });
    } catch (e) {
      setupStatus = 'failed';
      setupError = `Hook "${hook}" failed: ${e.message}`;
      debugLog('worktree.setup', `Setup hook failed: ${hook}: ${e.message}`);
      break; // Stop running further hooks on failure
    }
  }

  const result = {
    created: true,
    plan_id: planId,
    branch: branchName,
    path: worktreePath,
    synced_files: syncedFiles,
    setup_status: setupStatus,
  };

  if (setupError) result.setup_error = setupError;
  if (resourceWarnings.length > 0) result.resource_warnings = resourceWarnings;

  output(result, raw);
}

/**
 * cmdWorktreeList - List active worktrees for the current project.
 *
 * @param {string} cwd - Project root directory
 * @param {boolean} raw - Raw JSON output mode
 */
function cmdWorktreeList(cwd, raw) {
  const config = getWorktreeConfig(cwd);
  const projectName = getProjectName(cwd);
  const projectBase = path.join(config.base_path, projectName);

  const listResult = execGit(cwd, ['worktree', 'list', '--porcelain']);
  if (listResult.exitCode !== 0) {
    error(`Failed to list worktrees: ${listResult.stderr}`);
  }

  const allWorktrees = parseWorktreeListPorcelain(listResult.stdout);

  // Filter to only worktrees under the project's base_path
  const projectWorktrees = allWorktrees.filter(wt =>
    wt.path && wt.path.startsWith(projectBase + '/')
  );

  const worktrees = projectWorktrees.map(wt => {
    // Extract plan_id from path (last segment of path)
    const planId = path.basename(wt.path);

    // Get disk usage
    const diskUsage = fs.existsSync(wt.path) ? getDiskUsage(wt.path) : 'removed';

    return {
      plan_id: planId,
      branch: wt.branch || null,
      path: wt.path,
      head: wt.head ? wt.head.slice(0, 8) : null,
      disk_usage: diskUsage,
    };
  });

  const result = { worktrees };

  // Table-formatted string for rawValue
  if (worktrees.length === 0) {
    output(result, raw, 'No active worktrees for this project.\n');
  } else {
    const lines = ['Plan ID   | Branch                     | Path                                    | Disk Usage',
                   '--------- | -------------------------- | --------------------------------------- | ----------'];
    for (const wt of worktrees) {
      lines.push(`${(wt.plan_id || '').padEnd(9)} | ${(wt.branch || '').padEnd(26)} | ${(wt.path || '').padEnd(39)} | ${wt.disk_usage}`);
    }
    output(result, raw, lines.join('\n') + '\n');
  }
}

/**
 * cmdWorktreeRemove - Remove a specific worktree by plan ID.
 *
 * @param {string} cwd - Project root directory
 * @param {string} planId - Plan ID to remove
 * @param {boolean} raw - Raw JSON output mode
 */
function cmdWorktreeRemove(cwd, planId, raw) {
  if (!planId) {
    error('Usage: gsd-tools worktree remove <plan-id>');
  }

  const config = getWorktreeConfig(cwd);
  const projectName = getProjectName(cwd);
  const worktreePath = path.join(config.base_path, projectName, planId);

  // Find the worktree and its branch
  const listResult = execGit(cwd, ['worktree', 'list', '--porcelain']);
  if (listResult.exitCode !== 0) {
    error(`Failed to list worktrees: ${listResult.stderr}`);
  }

  const allWorktrees = parseWorktreeListPorcelain(listResult.stdout);
  const targetWt = allWorktrees.find(wt => wt.path === worktreePath);

  if (!targetWt) {
    error(`No worktree found for plan ${planId} at ${worktreePath}`);
  }

  const branchName = targetWt.branch;

  // Remove the worktree (--force because it may have uncommitted changes)
  const removeResult = execGit(cwd, ['worktree', 'remove', worktreePath, '--force']);
  if (removeResult.exitCode !== 0) {
    error(`Failed to remove worktree: ${removeResult.stderr}`);
  }

  // Delete the branch
  if (branchName) {
    const branchResult = execGit(cwd, ['branch', '-D', branchName]);
    if (branchResult.exitCode !== 0) {
      debugLog('worktree.remove', `Failed to delete branch ${branchName}: ${branchResult.stderr}`);
    }
  }

  output({ removed: true, plan_id: planId, path: worktreePath }, raw);
}

/**
 * cmdWorktreeCleanup - Remove all worktrees for the current project.
 *
 * @param {string} cwd - Project root directory
 * @param {boolean} raw - Raw JSON output mode
 */
function cmdWorktreeCleanup(cwd, raw) {
  const config = getWorktreeConfig(cwd);
  const projectName = getProjectName(cwd);
  const projectBase = path.join(config.base_path, projectName);

  const listResult = execGit(cwd, ['worktree', 'list', '--porcelain']);
  if (listResult.exitCode !== 0) {
    error(`Failed to list worktrees: ${listResult.stderr}`);
  }

  const allWorktrees = parseWorktreeListPorcelain(listResult.stdout);
  const projectWorktrees = allWorktrees.filter(wt =>
    wt.path && wt.path.startsWith(projectBase + '/')
  );

  const removed = [];
  for (const wt of projectWorktrees) {
    const planId = path.basename(wt.path);
    const branchName = wt.branch;

    const removeResult = execGit(cwd, ['worktree', 'remove', wt.path, '--force']);
    if (removeResult.exitCode === 0) {
      removed.push({ plan_id: planId, path: wt.path });
    } else {
      debugLog('worktree.cleanup', `Failed to remove ${wt.path}: ${removeResult.stderr}`);
    }

    // Delete the branch
    if (branchName) {
      execGit(cwd, ['branch', '-D', branchName]);
    }
  }

  // Prune stale worktree references
  execGit(cwd, ['worktree', 'prune']);

  // Clean up the project directory if empty
  try {
    if (fs.existsSync(projectBase)) {
      const remaining = fs.readdirSync(projectBase);
      if (remaining.length === 0) {
        fs.rmdirSync(projectBase);
      }
    }
  } catch {
    debugLog('worktree.cleanup', 'Failed to remove empty project directory');
  }

  output({ cleaned: removed.length, worktrees: removed }, raw);
}

module.exports = {
  cmdWorktreeCreate,
  cmdWorktreeList,
  cmdWorktreeRemove,
  cmdWorktreeCleanup,
  // Exported for testing
  getWorktreeConfig,
  parsePlanId,
  parseWorktreeListPorcelain,
  WORKTREE_DEFAULTS,
};
