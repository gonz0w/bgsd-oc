/**
 * gh CLI Tool Wrapper Module
 * 
 * Provides GitHub CLI operations for PRs and issues.
 * No Node.js fallback - clear error when unavailable.
 */

const { execFileSync } = require('child_process');
const { isToolAvailable, withToolFallback } = require('./fallback.js');

const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds

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
      
      // Parse auth status - if no error, user is logged in
      const isLoggedIn = output.includes('Logged in to') || output.includes('github.com');
      return { authenticated: isLoggedIn, status: output.trim() };
    },
    () => {
      throw new Error('GitHub CLI (gh) is required for auth checks. Install from https://cli.github.com/');
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
  checkAuth
};
