/**
 * gh CLI Tool Wrapper Module
 * 
 * Provides GitHub CLI operations for PRs and issues.
 * No Node.js fallback - clear error when unavailable.
 */

const { execFileSync } = require('child_process');
const { isToolAvailable, withToolFallback, isToolEnabled } = require('./fallback.js');
const { detectTool, parseVersion } = require('./detector.js');

const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Versions of gh CLI with known regressions that should be blocked.
 * Uses exact match on major.minor.patch.
 */
const BLOCKED_VERSIONS = [
  { major: 2, minor: 88, patch: 0, reason: 'PR commands fail with read:project scope error (reverted in 2.88.1)' }
];

/**
 * Check if gh CLI is usable (installed, not a blocked version, not disabled in config).
 * Per CONTEXT.md: gh errors are clear error-and-stop — no partial completion, no JS fallback.
 * 
 * @returns {object} - { usable: boolean, reason?: string, version?: string, message?: string }
 */
function isGhUsable() {
  // Check config — if gh is disabled, report as such
  if (!isToolEnabled('gh')) {
    return {
      usable: false,
      reason: 'disabled',
      message: 'gh disabled in config'
    };
  }

  // Check availability
  const detection = detectTool('gh');
  if (!detection.available) {
    return {
      usable: false,
      reason: 'not_installed',
      message: 'GitHub CLI (gh) not found. Install from https://cli.github.com/'
    };
  }

  // Check for blocked versions (exact match on major.minor.patch)
  if (detection.version) {
    const parsed = parseVersion(detection.version);
    if (parsed) {
      for (const blocked of BLOCKED_VERSIONS) {
        if (
          parsed.major === blocked.major &&
          parsed.minor === blocked.minor &&
          parsed.patch === blocked.patch
        ) {
          return {
            usable: false,
            reason: 'blocked_version',
            version: detection.version,
            message: `gh ${detection.version} has a known regression: ${blocked.reason}. Update: gh upgrade`
          };
        }
      }
    }
  }

  return {
    usable: true,
    version: detection.version
  };
}

/**
 * List pull requests
 * @param {object} options - List options
 * @returns {object} - { success, usedFallback, result, error }
 */
function listPRs(options = {}) {
  const {
    state = 'open',
    limit = 30,
    head = null,
    base = null,
    timeout = DEFAULT_TIMEOUT_MS
  } = options;

  return withToolFallback(
    'gh',
    () => {
      const args = ['pr', 'list', '--json', 'number,title,state,url,author,headRefName,baseRefName,isDraft'];
      
      // Add state filter
      args.push('--state', state);
      
      // Add limit
      args.push('--limit', String(limit));
      
      // Add branch filters
      if (head) args.push('--head', head);
      if (base) args.push('--base', base);
      
      const output = execFileSync('gh', args, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout,
        windowsHide: true
      });
      
      return JSON.parse(output.trim());
    },
    () => {
      // No Node.js fallback for gh - return error
      throw new Error('GitHub CLI (gh) is required for PR operations. Install from https://cli.github.com/');
    }
  );
}

/**
 * Get details of a specific PR
 * @param {number} prNumber - PR number
 * @param {object} options - Options
 * @returns {object} - { success, usedFallback, result, error }
 */
function getPR(prNumber, options = {}) {
  const { timeout = DEFAULT_TIMEOUT_MS } = options;

  return withToolFallback(
    'gh',
    () => {
      const args = ['pr', 'view', String(prNumber), '--json', 'number,title,state,url,author,body,headRefName,baseRefName,isDraft,mergeable,reviewDecision,comments,reviews'];
      
      const output = execFileSync('gh', args, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout,
        windowsHide: true
      });
      
      return JSON.parse(output.trim());
    },
    () => {
      throw new Error('GitHub CLI (gh) is required for PR operations. Install from https://cli.github.com/');
    }
  );
}

/**
 * List issues
 * @param {object} options - List options
 * @returns {object} - { success, usedFallback, result, error }
 */
function listIssues(options = {}) {
  const {
    state = 'open',
    limit = 30,
    labels = null,
    assignee = null,
    timeout = DEFAULT_TIMEOUT_MS
  } = options;

  return withToolFallback(
    'gh',
    () => {
      const args = ['issue', 'list', '--json', 'number,title,state,url,author,labels,assignees'];
      
      // Add state filter
      args.push('--state', state);
      
      // Add limit
      args.push('--limit', String(limit));
      
      // Add labels filter
      if (labels) args.push('--label', labels);
      
      // Add assignee filter
      if (assignee) args.push('--assignee', assignee);
      
      const output = execFileSync('gh', args, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout,
        windowsHide: true
      });
      
      return JSON.parse(output.trim());
    },
    () => {
      throw new Error('GitHub CLI (gh) is required for issue operations. Install from https://cli.github.com/');
    }
  );
}

/**
 * Get details of a specific issue
 * @param {number} issueNumber - Issue number
 * @param {object} options - Options
 * @returns {object} - { success, usedFallback, result, error }
 */
function getIssue(issueNumber, options = {}) {
  const { timeout = DEFAULT_TIMEOUT_MS } = options;

  return withToolFallback(
    'gh',
    () => {
      const args = ['issue', 'view', String(issueNumber), '--json', 'number,title,state,url,author,body,labels,assignees,comments'];
      
      const output = execFileSync('gh', args, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout,
        windowsHide: true
      });
      
      return JSON.parse(output.trim());
    },
    () => {
      throw new Error('GitHub CLI (gh) is required for issue operations. Install from https://cli.github.com/');
    }
  );
}

/**
 * Get current repository information
 * @param {object} options - Options
 * @returns {object} - { success, usedFallback, result, error }
 */
function getRepoInfo(options = {}) {
  const { timeout = DEFAULT_TIMEOUT_MS } = options;

  return withToolFallback(
    'gh',
    () => {
      const args = ['repo', 'view', '--json', 'name,owner,url,description,visibility,defaultBranch,isFork,isPrivate'];
      
      const output = execFileSync('gh', args, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout,
        windowsHide: true
      });
      
      return JSON.parse(output.trim());
    },
    () => {
      throw new Error('GitHub CLI (gh) is required for repository operations. Install from https://cli.github.com/');
    }
  );
}

/**
 * Check if gh CLI is available
 * @returns {boolean}
 */
function isGhAvailable() {
  return isToolAvailable('gh');
}

/**
 * Check if user is authenticated to gh
 * @param {object} options - Options
 * @returns {object} - { success, usedFallback, result, error }
 */
function checkAuth(options = {}) {
  const { timeout = 10000 } = options;

  return withToolFallback(
    'gh',
    () => {
      const output = execFileSync('gh', ['auth', 'status'], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout,
        windowsHide: true
      });
      
      // Parse auth status - check for logged in indicator
      // gh <=2.88: "Logged in to github.com as user..."
      // gh >=2.89: "✓ Logged in to github.com account user..."
      // Lines may have leading whitespace and Unicode checkmark prefix
      const isLoggedIn = /Logged in to github\.com (as|account)\b/m.test(output);
      return { authenticated: isLoggedIn, status: output.trim() };
    },
    () => {
      throw new Error('GitHub CLI (gh) is required for auth checks. Install from https://cli.github.com/');
    }
  );
}

/**
 * Create a pull request via gh CLI.
 * @param {object} options - PR creation options
 * @returns {object} - { success, usedFallback, result, error }
 */
function createPullRequest(options = {}) {
  const {
    title,
    body,
    base,
    head,
    draft = false,
    timeout = DEFAULT_TIMEOUT_MS,
  } = options;

  return withToolFallback(
    'gh',
    () => {
      const args = ['pr', 'create', '--title', title, '--body', body, '--base', base, '--head', head];
      if (draft) args.push('--draft');

      const output = execFileSync('gh', args, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout,
        windowsHide: true,
      }).trim();

      return {
        url: output.split('\n').find((line) => /^https?:\/\//.test(line)) || output,
        title,
        body,
        base,
        head,
      };
    },
    () => {
      throw new Error('GitHub CLI (gh) is required for PR operations. Install from https://cli.github.com/');
    }
  );
}

module.exports = {
  listPRs,
  getPR,
  listIssues,
  getIssue,
  getRepoInfo,
  isGhAvailable,
  checkAuth,
  isGhUsable,
  createPullRequest
};
