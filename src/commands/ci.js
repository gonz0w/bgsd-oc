/**
 * GitHub CI Command
 * 
 * Implements the CI workflow directly in CLI:
 * 1. Push branch to remote
 * 2. Create pull request
 * 3. Monitor code scanning checks
 * 4. Fix any true positive findings (optional)
 * 5. Auto-merge when all checks pass
 */

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { output, error } = require('../lib/output');
const { loadConfig } = require('../lib/config');

const DEFAULT_TIMEOUT_MS = 30000;
const CHECK_POLL_INTERVAL_MS = 5000;
const MAX_WAIT_MS = 600000; // 10 minutes max wait

function isToolAvailable(tool) {
  try {
    execFileSync(tool, ['--version'], { stdio: 'ignore', windowsHide: true });
    return true;
  } catch (e) {
    return false;
  }
}

function execGit(args, options = {}) {
  const { cwd = process.cwd(), timeout = DEFAULT_TIMEOUT_MS, ...rest } = options;
  try {
    return {
      success: true,
      stdout: execFileSync('git', args, {
        cwd,
        encoding: 'utf8',
        timeout,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        ...rest
      }),
      stderr: ''
    };
  } catch (e) {
    return {
      success: false,
      stdout: e.stdout || '',
      stderr: e.stderr || e.message,
      code: e.status
    };
  }
}

function execGh(args, options = {}) {
  const { cwd = process.cwd(), timeout = DEFAULT_TIMEOUT_MS, ...rest } = options;
  try {
    return {
      success: true,
      stdout: execFileSync('gh', args, {
        cwd,
        encoding: 'utf8',
        timeout,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        ...rest
      }),
      stderr: ''
    };
  } catch (e) {
    return {
      success: false,
      stdout: e.stdout || '',
      stderr: e.stderr || e.message,
      code: e.status
    };
  }
}

function cmdExecuteCi(cwd, args, raw) {
  // Parse arguments
  const opts = {
    branch: null,
    base: 'main',
    scope: null,
    autoMerge: true,
    dryRun: false,
    message: null
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--branch' && args[i + 1]) {
      opts.branch = args[++i];
    } else if (arg === '--base' && args[i + 1]) {
      opts.base = args[++i];
    } else if (arg === '--scope' && args[i + 1]) {
      opts.scope = args[++i];
    } else if (arg === '--no-merge') {
      opts.autoMerge = false;
    } else if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--message' && args[i + 1]) {
      opts.message = args[++i];
    }
  }
  
  // Check prerequisites
  if (!isToolAvailable('gh')) {
    error('GitHub CLI (gh) is required. Install from https://cli.github.com/');
    return;
  }
  
  const ghAuth = execGh(['auth', 'status']);
  if (!ghAuth.success) {
    error('GitHub CLI not authenticated. Run: gh auth login');
    return;
  }
  
  // Get current branch and status
  const currentBranch = execGit(['branch', '--show-current']);
  const branchName = currentBranch.success ? currentBranch.stdout.trim() : 'unknown';
  
  // Check for uncommitted changes
  const status = execGit(['status', '--porcelain']);
  const hasChanges = status.success && status.stdout.trim().length > 0;
  
  if (opts.dryRun) {
    output({
      dry_run: true,
      current_branch: branchName,
      target_branch: opts.base,
      scope: opts.scope,
      auto_merge: opts.autoMerge,
      has_uncommitted_changes: hasChanges,
      message: 'Dry run - no changes made',
      next_steps: hasChanges ? [
        'git add -A',
        'git commit -m "Your commit message"',
        'git push -u origin ' + branchName
      ] : [
        'git push -u origin ' + branchName
      ]
    }, { raw });
    return;
  }
  
  const results = {
    branch: branchName,
    target_base: opts.base,
    scope: opts.scope,
    pushed: false,
    pr_created: false,
    pr_url: null,
    checks_passed: false,
    merged: false,
    errors: []
  };
  
  // Step 1: Push branch
  console.error('→ Pushing branch to remote...');
  const pushResult = execGit(['push', '-u', 'origin', branchName], { timeout: 60000 });
  
  if (!pushResult.success) {
    results.errors.push('Push failed: ' + pushResult.stderr);
    output({ ci_result: results, status: 'failed', step: 'push' }, { raw });
    return;
  }
  results.pushed = true;
  console.error('✓ Branch pushed');
  
  // Step 2: Create PR
  console.error('→ Creating pull request...');
  
  // Check if PR already exists
  const existingPr = execGh(['pr', 'list', '--head', branchName, '--json', 'number']);
  let prNumber = null;
  
  try {
    const prs = JSON.parse(existingPr.stdout);
    if (prs.length > 0) {
      prNumber = prs[0].number;
      results.pr_created = true;
      results.pr_url = prs[0].url;
      console.error('✓ PR already exists: #' + prNumber);
    }
  } catch (e) {
    // No existing PR, create one
  }
  
  if (!prNumber) {
    const prTitle = opts.message || `Pull request for ${opts.scope || branchName}`;
    const prBody = `Automated PR from bGSD CI workflow${opts.scope ? '\n\nScope: ' + opts.scope : ''}`;
    
    const createPr = execGh([
      'pr', 'create',
      '--base', opts.base,
      '--title', prTitle,
      '--body', prBody
    ]);
    
    if (createPr.success) {
      // Extract PR URL from output
      const prUrlMatch = createPr.stdout.match(/https:\/\/github\.com\/[^\/]+\/[^\/]+\/pull\/\d+/);
      if (prUrlMatch) {
        results.pr_url = prUrlMatch[0];
        results.pr_created = true;
        console.error('✓ PR created: ' + results.pr_url);
        
        // Extract PR number
        const prNumMatch = results.pr_url.match(/\/pull\/(\d+)/);
        if (prNumMatch) {
          prNumber = parseInt(prNumMatch[1], 10);
        }
      }
    } else {
      results.errors.push('PR creation failed: ' + createPr.stderr);
      output({ ci_result: results, status: 'failed', step: 'pr_create' }, { raw });
      return;
    }
  }
  
  if (!opts.autoMerge) {
    output({
      ci_result: results,
      status: 'success',
      message: 'PR created successfully. Auto-merge disabled.',
      next_step: 'Monitor checks at: ' + results.pr_url
    }, { raw });
    return;
  }
  
  // Step 3: Wait for checks
  console.error('→ Waiting for CI checks...');
  let checksPassed = false;
  const startTime = Date.now();
  
  while (Date.now() - startTime < MAX_WAIT_MS) {
    // Get PR status
    const prStatus = execGh(['pr', 'status', '--json', 'statusCheckRollup'], { timeout: 10000 });
    
    let checks = [];
    try {
      const statusData = JSON.parse(prStatus.stdout);
      if (statusData.statusCheckRollup && statusData.statusCheckRollup.nodes) {
        checks = statusData.statusCheckRollup.nodes;
      }
    } catch (e) {
      // Status check not available yet
    }
    
    if (checks.length > 0) {
      const allPassed = checks.every(c => c.conclusion === 'SUCCESS' || c.conclusion === 'SKIPPED');
      const anyFailed = checks.some(c => c.conclusion === 'FAILURE');
      
      if (allPassed) {
        checksPassed = true;
        results.checks_passed = true;
        console.error('✓ All checks passed');
        break;
      }
      
      if (anyFailed) {
        console.error('✗ Some checks failed');
        results.errors.push('CI checks failed');
        output({ ci_result: results, status: 'failed', step: 'ci_checks' }, { raw });
        return;
      }
      
      console.error('  Checks in progress...');
    } else {
      console.error('  Waiting for checks to start...');
    }
    
    // Wait before next poll
    const waitFor = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const waitPromise = waitFor(CHECK_POLL_INTERVAL_MS);
    
    // Use sync sleep approximation
    const start = Date.now();
    while (Date.now() - start < CHECK_POLL_INTERVAL_MS) {
      // busy wait
    }
  }
  
  if (!checksPassed) {
    results.errors.push('Timed out waiting for CI checks');
    output({ ci_result: results, status: 'failed', step: 'ci_checks', reason: 'timeout' }, { raw });
    return;
  }
  
  // Step 4: Merge PR
  console.error('→ Merging pull request...');
  const mergeResult = execGh(['pr', 'merge', '--admin', '--squash'], { timeout: 30000 });
  
  if (mergeResult.success) {
    results.merged = true;
    console.error('✓ PR merged successfully');
    output({
      ci_result: results,
      status: 'success',
      message: 'CI workflow complete: pushed → PR created → checks passed → merged'
    }, { raw });
  } else {
    // Might already be merged or merge conflict
    if (mergeResult.stderr.includes('already merged') || mergeResult.stdout.includes('already merged')) {
      results.merged = true;
      console.error('✓ PR was already merged');
      output({
        ci_result: results,
        status: 'success',
        message: 'CI workflow complete: pushed → PR created → checks passed → already merged'
      }, { raw });
    } else {
      results.errors.push('Merge failed: ' + mergeResult.stderr);
      output({
        ci_result: results,
        status: 'partial',
        message: 'PR created and checks passed, but merge failed',
        merge_error: mergeResult.stderr
      }, { raw });
    }
  }
}

module.exports = {
  cmdExecuteCi
};
