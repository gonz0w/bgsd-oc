'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { output, error, debugLog } = require('../lib/output');
const { loadConfig } = require('../lib/config');
const { CONFIG_SCHEMA } = require('../lib/constants');
const { parseAssertionsMd } = require('./verify');
const { safeReadFile, findPhaseInternal, getArchivedPhaseDirs, normalizePhaseName, isValidDateString, sanitizeShellArg, getMilestoneInfo } = require('../lib/helpers');
const { extractFrontmatter } = require('../lib/frontmatter');
const { execGit } = require('../lib/git');
const { estimateTokens, estimateJsonTokens, checkBudget } = require('../lib/context');

function cmdSessionDiff(cwd, raw) {
  // Get last activity from STATE.md
  let since = null;
  try {
    const state = fs.readFileSync(path.join(cwd, '.planning', 'STATE.md'), 'utf-8');
    const lastMatch = state.match(/\*\*Last Activity:\*\*\s*(\d{4}-\d{2}-\d{2})/);
    if (lastMatch) since = lastMatch[1];
    // Also check session timestamp
    const sessionMatch = state.match(/\*\*Last session:\*\*\s*(\S+)/);
    if (sessionMatch && sessionMatch[1] > (since || '')) since = sessionMatch[1].split('T')[0];
  } catch (e) { debugLog('feature.sessionDiff', 'read failed', e); }

  if (!since) {
    output({ error: 'No last activity found in STATE.md', changes: [] }, raw);
    return;
  }

  if (!isValidDateString(since)) {
    output({ error: 'Invalid date format in STATE.md', changes: [] }, raw);
    return;
  }

  const sanitizedSince = sanitizeShellArg(since);

  // Get git commits since last activity
  const changes = [];
  try {
    const result = execSync(`git log --since=${sanitizedSince} --oneline --no-merges -- .planning/`, {
      cwd, encoding: 'utf-8', timeout: 10000
    }).trim();
    if (result) {
      for (const line of result.split('\n')) {
        const match = line.match(/^([a-f0-9]+)\s+(.*)/);
        if (match) changes.push({ sha: match[1], message: match[2] });
      }
    }
  } catch (e) { debugLog('feature.sessionDiff', 'exec failed', e); }

  // Get file-level changes since last activity
  const filesChanged = [];
  try {
    const result = execSync(`git diff --name-only --since=${sanitizedSince} HEAD -- .planning/`, {
      cwd, encoding: 'utf-8', timeout: 10000
    }).trim();
    if (result) {
      filesChanged.push(...result.split('\n').filter(Boolean));
    }
  } catch (e) {
    debugLog('feature.sessionDiff', 'exec failed', e);
    // Fallback: use log-based diffstat
    try {
      const result = execSync(`git log --since=${sanitizedSince} --name-only --pretty=format: -- .planning/`, {
        cwd, encoding: 'utf-8', timeout: 10000
      }).trim();
      if (result) {
        const unique = [...new Set(result.split('\n').filter(Boolean))];
        filesChanged.push(...unique);
      }
    } catch (e) { debugLog('feature.sessionDiff', 'exec failed', e); }
  }

  // Categorize changes
  const summaries = filesChanged.filter(f => f.includes('SUMMARY'));
  const plans = filesChanged.filter(f => f.includes('PLAN'));
  const state = filesChanged.filter(f => f.includes('STATE'));
  const roadmap = filesChanged.filter(f => f.includes('ROADMAP'));

  output({
    since,
    commit_count: changes.length,
    commits: changes.slice(0, 20),
    files_changed: filesChanged.length,
    categories: {
      summaries: summaries.length,
      plans: plans.length,
      state_updates: state.length,
      roadmap_updates: roadmap.length,
    },
  }, raw);
}

function cmdContextBudget(cwd, planPath, raw) {
  if (!planPath || !fs.existsSync(path.join(cwd, planPath))) {
    error('Plan path required and must exist');
  }

  const content = fs.readFileSync(path.join(cwd, planPath), 'utf-8');
  const fm = extractFrontmatter(content);

  // Count files and estimate sizes using tokenx (accurate) and old heuristic (for comparison)
  const filesModified = fm.files_modified || [];
  let totalLines = 0;
  let fileReadTokens = 0;
  let heuristicFileReadTokens = 0;
  let existingFiles = 0;
  let newFiles = 0;
  const fileDetails = [];

  for (const file of filesModified) {
    const fullPath = path.join(cwd, file);
    if (fs.existsSync(fullPath)) {
      existingFiles++;
      try {
        const fileContent = fs.readFileSync(fullPath, 'utf-8');
        const lines = fileContent.split('\n').length;
        const tokens = estimateTokens(fileContent);
        totalLines += lines;
        fileReadTokens += tokens;
        heuristicFileReadTokens += lines * 4;
        fileDetails.push({ path: file, lines, tokens, exists: true });
      } catch (e) {
        debugLog('feature.contextBudget', 'read failed', e);
        fileDetails.push({ path: file, lines: 0, tokens: 0, exists: true, error: 'unreadable' });
      }
    } else {
      newFiles++;
      fileDetails.push({ path: file, lines: 0, tokens: 0, exists: false });
    }
  }

  // Count tasks
  const taskMatches = content.match(/<task\s/gi) || [];
  const taskCount = taskMatches.length;

  // Estimate context consumption using tokenx for text content
  const planTokens = estimateTokens(content);
  const heuristicPlanTokens = content.split('\n').length * 4;
  const executionTokens = taskCount * 3500; // Heuristic for execution overhead (not text)
  const testTokens = taskCount * 750;       // Heuristic for test overhead (not text)
  const totalEstimate = planTokens + fileReadTokens + executionTokens + testTokens;
  const heuristicTotal = heuristicPlanTokens + heuristicFileReadTokens + executionTokens + testTokens;

  // Read context window settings from config (defaults: 200K tokens, 50% target)
  const config = loadConfig(cwd);
  const contextWindow = config.context_window || 200000;
  const targetPercent = config.context_target_percent || 50;
  const estimatedPercent = Math.round((totalEstimate / contextWindow) * 100);

  let risk = 'low';
  if (estimatedPercent > 60) risk = 'high';
  else if (estimatedPercent > 40) risk = 'medium';

  const recommendations = [];
  if (estimatedPercent > 50) {
    recommendations.push('Consider splitting this plan — estimated to exceed 50% context budget');
  }
  if (filesModified.length > 5) {
    recommendations.push(`${filesModified.length} files modified — high file count increases context pressure`);
  }
  if (taskCount > 3) {
    recommendations.push(`${taskCount} tasks — plans should have 2-3 tasks max`);
  }
  if (totalLines > 1000) {
    recommendations.push(`${totalLines} existing lines to read — large codebase context`);
  }

  output({
    plan: planPath,
    files: {
      total: filesModified.length,
      existing: existingFiles,
      new: newFiles,
      total_lines: totalLines,
      details: fileDetails,
    },
    tasks: taskCount,
    estimates: {
      plan_tokens: planTokens,
      file_read_tokens: fileReadTokens,
      execution_tokens: executionTokens,
      test_tokens: testTokens,
      total_tokens: totalEstimate,
      heuristic_tokens: heuristicTotal,
      context_window: contextWindow,
      context_percent: estimatedPercent,
      target_percent: targetPercent,
    },
    risk,
    recommendations,
  }, raw);
}

function cmdTestRun(cwd, raw) {
  const config = loadConfig(cwd);
  const testCommands = config.test_commands || {};
  const testGate = config.test_gate !== false; // default true

  if (Object.keys(testCommands).length === 0) {
    output({
      configured: false,
      message: 'No test_commands configured in .planning/config.json',
      example: {
        test_commands: {
          elixir: 'cd services/console && mix test',
          go: 'cd services/ingestion && go test ./...',
          python: 'cd services/ai && pytest',
        },
        test_gate: true,
      },
    }, raw);
    return;
  }

  const results = {};
  let allPassed = true;

  for (const [name, command] of Object.entries(testCommands)) {
    const start = Date.now();
    try {
      const testOutput = execSync(command, {
        cwd, encoding: 'utf-8', timeout: 300000, // 5 min timeout
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const duration = Date.now() - start;

      // Parse common test output formats
      const parsed = parseTestOutput(name, testOutput);
      results[name] = {
        status: 'passed',
        duration_ms: duration,
        command,
        ...parsed,
      };
    } catch (err) {
      debugLog('feature.testRun', 'exec failed', err);
      const duration = Date.now() - start;
      allPassed = false;
      const stderr = err.stderr || '';
      const stdout = err.stdout || '';
      const parsed = parseTestOutput(name, stdout + '\n' + stderr);
      results[name] = {
        status: 'failed',
        duration_ms: duration,
        command,
        exit_code: err.status,
        ...parsed,
        error_tail: (stderr || stdout).split('\n').slice(-20).join('\n'),
      };
    }
  }

  output({
    configured: true,
    test_gate: testGate,
    all_passed: allPassed,
    gate_blocked: testGate && !allPassed,
    results,
  }, raw);
}

function parseTestOutput(framework, text) {
  // ExUnit (Elixir): "42 tests, 0 failures"
  const exunit = text.match(/(\d+)\s+tests?,\s+(\d+)\s+failures?(?:,\s+(\d+)\s+excluded)?/);
  if (exunit) {
    return { passed: parseInt(exunit[1]) - parseInt(exunit[2]), failed: parseInt(exunit[2]), skipped: parseInt(exunit[3] || '0') };
  }

  // Go test: "ok  \t..." lines, "FAIL\t..." lines, "--- FAIL:" lines
  const goPass = (text.match(/^ok\s+/gm) || []).length;
  const goFail = (text.match(/^FAIL\s+/gm) || []).length;
  if (goPass + goFail > 0) {
    return { passed: goPass, failed: goFail, skipped: 0 };
  }

  // pytest: "5 passed, 1 failed, 2 skipped"
  const pytest = text.match(/(\d+)\s+passed(?:.*?(\d+)\s+failed)?(?:.*?(\d+)\s+skipped)?/);
  if (pytest) {
    return { passed: parseInt(pytest[1]), failed: parseInt(pytest[2] || '0'), skipped: parseInt(pytest[3] || '0') };
  }

  return { passed: null, failed: null, skipped: null };
}

function cmdSearchDecisions(cwd, query, raw) {
  if (!query) {
    error('Query string required for decision search');
  }

  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/);
  const results = [];

  // Search current STATE.md
  try {
    const state = fs.readFileSync(path.join(cwd, '.planning', 'STATE.md'), 'utf-8');
    const decisions = extractDecisions(state, 'current');
    for (const d of decisions) {
      const score = scoreDecision(d.text, queryWords);
      if (score > 0) results.push({ ...d, score, source: 'STATE.md' });
    }
  } catch (e) { debugLog('feature.searchDecisions', 'read failed', e); }

  // Search archived milestone roadmaps for decisions in their STATE sections
  try {
    const archiveDir = path.join(cwd, '.planning', 'milestones');
    if (fs.existsSync(archiveDir)) {
      const files = fs.readdirSync(archiveDir).filter(f => f.endsWith('-ROADMAP.md'));
      for (const file of files) {
        const content = fs.readFileSync(path.join(archiveDir, file), 'utf-8');
        const version = file.replace('-ROADMAP.md', '');
        const decisions = extractDecisions(content, version);
        for (const d of decisions) {
          const score = scoreDecision(d.text, queryWords);
          if (score > 0) results.push({ ...d, score, source: file });
        }
      }
    }
  } catch (e) { debugLog('feature.searchDecisions', 'read failed', e); }

  // Sort by relevance score
  results.sort((a, b) => b.score - a.score);

  output({
    query,
    match_count: results.length,
    decisions: results.slice(0, 20),
  }, raw);
}

function extractDecisions(content, milestone) {
  const decisions = [];
  // Match numbered decisions: "N. **description** (phase): details"
  const pattern = /(\d+)\.\s+\*\*([^*]+)\*\*\s*(?:\(([^)]+)\))?\s*:?\s*([^\n]+)/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    decisions.push({
      number: parseInt(match[1]),
      title: match[2].trim(),
      phase: match[3] ? match[3].trim() : null,
      text: match[4].trim(),
      full: match[0].trim(),
      milestone,
    });
  }
  return decisions;
}

function scoreDecision(text, queryWords) {
  const textLower = text.toLowerCase();
  let score = 0;
  for (const word of queryWords) {
    if (textLower.includes(word)) score += 1;
  }
  return score;
}

function cmdValidateDependencies(cwd, phase, raw) {
  if (!phase) {
    error('Phase number required for dependency validation');
  }

  const phasesDir = path.join(cwd, '.planning', 'phases');
  const issues = [];
  const checked = [];

  // Find the phase directory (may not exist yet for future phases)
  const phaseInfo = findPhaseInternal(cwd, phase);

  let planFiles = [];
  let fullPhaseDir = null;

  if (phaseInfo && phaseInfo.found) {
    fullPhaseDir = path.join(cwd, phaseInfo.directory);
    try {
      planFiles = fs.readdirSync(fullPhaseDir).filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
    } catch (e) { debugLog('validate.dependencies', 'readdir failed', e); }
  }

  if (planFiles.length === 0) {
    // Phase has no plans yet — check ROADMAP deps at phase level only
    try {
      const roadmap = fs.readFileSync(path.join(cwd, '.planning', 'ROADMAP.md'), 'utf-8');
      const phaseSection = roadmap.match(new RegExp(`###?\\s*Phase\\s+${phase}[\\s\\S]*?(?=###?\\s*Phase\\s+\\d|$)`, 'i'));
      if (phaseSection) {
        const depMatch = phaseSection[0].match(/\*\*Depends on:?\*\*:?\s*([^\n]+)/i);
        if (depMatch && !depMatch[1].toLowerCase().includes('nothing')) {
          const depPhases = depMatch[1].match(/Phase\s+(\d+)/gi) || [];
          for (const dp of depPhases) {
            const num = dp.match(/\d+/)[0];
            const depCheck = { plan: 'ROADMAP', dependency: dp, status: 'unknown' };
            try {
              const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
              const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
              const depDir = dirs.find(d => d.startsWith(num + '-') || d === num);
              if (!depDir) {
                depCheck.status = 'missing'; depCheck.message = `Dependency phase ${num} has no directory`;
                issues.push(depCheck);
              } else {
                const depFiles = fs.readdirSync(path.join(phasesDir, depDir));
                const depPlans = depFiles.filter(f => f.endsWith('-PLAN.md'));
                const depSummaries = depFiles.filter(f => f.endsWith('-SUMMARY.md'));
                if (depPlans.length === 0) {
                  depCheck.status = 'not_planned'; depCheck.message = `Phase ${num} has no plans`;
                  issues.push(depCheck);
                } else if (depSummaries.length < depPlans.length) {
                  depCheck.status = 'incomplete'; depCheck.message = `Phase ${num}: ${depSummaries.length}/${depPlans.length} complete`;
                  issues.push(depCheck);
                } else {
                  depCheck.status = 'satisfied';
                }
              }
            } catch (e) { debugLog('validate.dependencies', 'readdir failed', e); depCheck.status = 'error'; issues.push(depCheck); }
            checked.push(depCheck);
          }
        }
      }
    } catch (e) { debugLog('validate.dependencies', 'read roadmap deps failed', e); }

    output({ phase, valid: issues.length === 0, issue_count: issues.length, issues, checked, note: 'Phase has no plans yet — checked ROADMAP-level dependencies only' }, raw);
    return;
  }

  for (const planFile of planFiles) {
    const planPath = path.join(fullPhaseDir, planFile);
    const content = fs.readFileSync(planPath, 'utf-8');
    const fm = extractFrontmatter(content);

    const dependsOn = fm.depends_on || [];
    for (const dep of dependsOn) {
      const depCheck = { plan: planFile, dependency: dep, status: 'unknown' };

      // Parse dependency — could be plan ID or phase number
      const depPhaseMatch = dep.toString().match(/^(\d+)/);
      if (!depPhaseMatch) {
        depCheck.status = 'unparseable';
        depCheck.message = `Cannot parse dependency: ${dep}`;
        issues.push(depCheck);
        checked.push(depCheck);
        continue;
      }

      // Check if dependency phase directory exists
      const depPhaseNum = depPhaseMatch[1];
      try {
        const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
        const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
        const depDir = dirs.find(d => d.startsWith(depPhaseNum + '-') || d === depPhaseNum);

        if (!depDir) {
          depCheck.status = 'missing';
          depCheck.message = `Dependency phase ${depPhaseNum} has no directory`;
          issues.push(depCheck);
        } else {
          // Check for summaries (completion evidence)
          const depFiles = fs.readdirSync(path.join(phasesDir, depDir));
          const depPlans = depFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
          const depSummaries = depFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');

          if (depPlans.length === 0) {
            depCheck.status = 'not_planned';
            depCheck.message = `Dependency phase ${depPhaseNum} has no plans`;
            issues.push(depCheck);
          } else if (depSummaries.length < depPlans.length) {
            depCheck.status = 'incomplete';
            depCheck.message = `Dependency phase ${depPhaseNum}: ${depSummaries.length}/${depPlans.length} plans complete`;
            issues.push(depCheck);
          } else {
            depCheck.status = 'satisfied';
          }
        }
      } catch (e) {
        debugLog('validate.dependencies', `check dependency phase ${depPhaseNum} failed`, e);
        depCheck.status = 'error';
        depCheck.message = `Error checking dependency phase ${depPhaseNum}`;
        issues.push(depCheck);
      }

      checked.push(depCheck);
    }
  }

  // Also check ROADMAP "Depends on" for phase-level deps
  try {
    const roadmap = fs.readFileSync(path.join(cwd, '.planning', 'ROADMAP.md'), 'utf-8');
    const phaseSection = roadmap.match(new RegExp(`###?\\s*Phase\\s+${phase}[\\s\\S]*?(?=###?\\s*Phase\\s+\\d|$)`, 'i'));
    if (phaseSection) {
      const depMatch = phaseSection[0].match(/\*\*Depends on:?\*\*:?\s*([^\n]+)/i);
      if (depMatch && !depMatch[1].toLowerCase().includes('nothing')) {
        const depPhases = depMatch[1].match(/Phase\s+(\d+)/gi) || [];
        for (const dp of depPhases) {
          const num = dp.match(/\d+/)[0];
          const existing = checked.find(c => c.dependency.toString().startsWith(num));
          if (!existing) {
            checked.push({ plan: 'ROADMAP', dependency: dp, status: 'info', message: 'Roadmap-level dependency (not in plan frontmatter)' });
          }
        }
      }
    }
  } catch (e) { debugLog('validate.dependencies', 'read failed', e); }

  output({
    phase,
    valid: issues.length === 0,
    issue_count: issues.length,
    issues,
    checked,
  }, raw);
}

function cmdSearchLessons(cwd, query, raw) {
  if (!query) {
    error('Query string required for lessons search');
  }

  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/);
  const results = [];

  // Search tasks/lessons.md
  const lessonsPath = path.join(cwd, 'tasks', 'lessons.md');
  if (!fs.existsSync(lessonsPath)) {
    // Also check .planning/lessons.md
    const altPath = path.join(cwd, '.planning', 'lessons.md');
    if (!fs.existsSync(altPath)) {
      output({ query, match_count: 0, lessons: [], message: 'No lessons file found (checked tasks/lessons.md and .planning/lessons.md)' }, raw);
      return;
    }
  }

  const searchPaths = [
    path.join(cwd, 'tasks', 'lessons.md'),
    path.join(cwd, '.planning', 'lessons.md'),
  ].filter(p => fs.existsSync(p));

  for (const searchPath of searchPaths) {
    const content = fs.readFileSync(searchPath, 'utf-8');

    // Parse lessons — look for patterns like "## Lesson" or "### Pattern" or "- **Title**: description"
    const sections = content.split(/(?=^#{1,3}\s)/m).filter(Boolean);
    for (const section of sections) {
      const titleMatch = section.match(/^#{1,3}\s+(.+)/);
      const title = titleMatch ? titleMatch[1].trim() : 'Untitled';
      const body = section.replace(/^#{1,3}\s+.+\n?/, '').trim();

      let score = 0;
      const sectionLower = section.toLowerCase();
      for (const word of queryWords) {
        if (sectionLower.includes(word)) score += 1;
        // Boost for title matches
        if (title.toLowerCase().includes(word)) score += 2;
      }

      if (score > 0) {
        results.push({
          title,
          body: body.slice(0, 300) + (body.length > 300 ? '...' : ''),
          score,
          source: path.relative(cwd, searchPath),
        });
      }
    }
  }

  results.sort((a, b) => b.score - a.score);

  output({
    query,
    match_count: results.length,
    lessons: results.slice(0, 15),
  }, raw);
}

function cmdCodebaseImpact(cwd, filePaths, raw) {
  if (!filePaths || filePaths.length === 0) {
    error('File paths required for impact estimation');
  }

  const results = [];

  for (const filePath of filePaths) {
    const fullPath = path.join(cwd, filePath);
    if (!fs.existsSync(fullPath)) {
      results.push({ path: filePath, exists: false, dependents: [] });
      continue;
    }

    // Find files that import/reference this file
    const dependents = [];
    const basename = path.basename(filePath, path.extname(filePath));
    const ext = path.extname(filePath);

    // Build search patterns based on language
    const searchPatterns = [];
    if (['.ex', '.exs'].includes(ext)) {
      // Elixir: alias, import, use patterns
      const moduleName = basename.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
      searchPatterns.push(moduleName);
      searchPatterns.push(basename);
      try {
        const fileContent = fs.readFileSync(fullPath, 'utf-8');
        const defmodMatch = fileContent.match(/defmodule\s+([\w.]+)/);
        if (defmodMatch) {
          const parts = defmodMatch[1].split('.');
          const lastPart = parts[parts.length - 1];
          if (!searchPatterns.includes(lastPart)) searchPatterns.push(lastPart);
          if (!searchPatterns.includes(defmodMatch[1])) searchPatterns.push(defmodMatch[1]);
        }
      } catch (e) { debugLog('feature.codebaseImpact', 'read failed', e); }
    } else if (ext === '.go') {
      const dirName = path.dirname(filePath).split('/').pop();
      searchPatterns.push(`"${dirName}"`);
    } else if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      searchPatterns.push(basename);
    } else if (ext === '.py') {
      searchPatterns.push(`from.*${basename}`);
      searchPatterns.push(`import.*${basename}`);
    }

    // Search for dependents using batched grep (1-2 processes instead of N)
    if (searchPatterns.length > 0) {
      const regexMeta = /[.*+?[\]{}()|^$\\]/;
      const fixedPatterns = searchPatterns.filter(p => !regexMeta.test(p));
      const regexPatterns = searchPatterns.filter(p => regexMeta.test(p));
      const includeFlags = '--include="*.ex" --include="*.exs" --include="*.go" --include="*.py" --include="*.ts" --include="*.tsx" --include="*.js"';
      const filterPipe = 'grep -v node_modules | grep -v _build | grep -v deps | head -30';

      // Batch fixed-string patterns into single grep -rl -e pat1 -e pat2
      if (fixedPatterns.length > 0) {
        const eArgs = fixedPatterns.map(p => `-e ${sanitizeShellArg(p)}`).join(' ');
        try {
          const grepResult = execSync(
            `grep -rl --fixed-strings ${eArgs} ${includeFlags} . 2>/dev/null | ${filterPipe}`,
            { cwd, encoding: 'utf-8', timeout: 15000 }
          ).trim();
          if (grepResult) {
            for (const dep of grepResult.split('\n')) {
              const relative = dep.replace(/^\.\//, '');
              if (relative !== filePath && !dependents.includes(relative)) {
                dependents.push(relative);
              }
            }
          }
        } catch (e) { debugLog('feature.codebaseImpact', 'fixed grep failed', e); }
      }

      // Batch regex patterns into single grep -rl -e pat1 -e pat2 (no --fixed-strings)
      if (regexPatterns.length > 0) {
        const eArgs = regexPatterns.map(p => `-e ${sanitizeShellArg(p)}`).join(' ');
        try {
          const grepResult = execSync(
            `grep -rl ${eArgs} ${includeFlags} . 2>/dev/null | ${filterPipe}`,
            { cwd, encoding: 'utf-8', timeout: 15000 }
          ).trim();
          if (grepResult) {
            for (const dep of grepResult.split('\n')) {
              const relative = dep.replace(/^\.\//, '');
              if (relative !== filePath && !dependents.includes(relative)) {
                dependents.push(relative);
              }
            }
          }
        } catch (e) { debugLog('feature.codebaseImpact', 'regex grep failed', e); }
      }
    }

    results.push({
      path: filePath,
      exists: true,
      dependent_count: dependents.length,
      dependents: dependents.slice(0, 20),
      risk: dependents.length > 10 ? 'high' : dependents.length > 5 ? 'medium' : 'low',
    });
  }

  const totalDependents = results.reduce((sum, r) => sum + r.dependent_count, 0);

  output({
    files_analyzed: results.length,
    total_dependents: totalDependents,
    overall_risk: totalDependents > 20 ? 'high' : totalDependents > 10 ? 'medium' : 'low',
    files: results,
  }, raw);
}

function cmdRollbackInfo(cwd, planId, raw) {
  if (!planId) {
    error('Plan ID required (e.g., 68-01)');
  }

  // Find the SUMMARY file for this plan
  const phasesDir = path.join(cwd, '.planning', 'phases');
  let summaryPath = null;
  let summaryContent = null;

  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);

    const phaseMatch = planId.match(/^(\d+)/);
    if (phaseMatch) {
      const phaseNum = phaseMatch[1];
      const dir = dirs.find(d => d.startsWith(phaseNum + '-') || d === phaseNum);
      if (dir) {
        const files = fs.readdirSync(path.join(phasesDir, dir));
        const summary = files.find(f => f.includes(planId) && f.endsWith('-SUMMARY.md'));
        if (summary) {
          summaryPath = path.join('.planning', 'phases', dir, summary);
          summaryContent = fs.readFileSync(path.join(cwd, summaryPath), 'utf-8');
        }
      }
    }
  } catch (e) { debugLog('feature.rollbackInfo', 'read failed', e); }

  if (!summaryContent) {
    output({ found: false, plan_id: planId, message: 'No SUMMARY found for this plan' }, raw);
    return;
  }

  // Extract commit SHAs from summary
  const commitPattern = /\b([a-f0-9]{7,40})\b/g;
  const fm = extractFrontmatter(summaryContent);
  const commits = fm.commits || [];

  // Also search for commit references in the body
  const bodyCommits = [];
  let cm;
  while ((cm = commitPattern.exec(summaryContent)) !== null) {
    const sha = cm[1];
    // Verify it's a real commit
    try {
      execSync(`git rev-parse --verify ${sha}^{commit}`, { cwd, encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] });
      if (!bodyCommits.includes(sha) && !commits.includes(sha)) {
        bodyCommits.push(sha);
      }
    } catch (e) { debugLog('feature.rollbackInfo', 'exec failed', e); }
  }

  const allCommits = [...commits, ...bodyCommits];

  // Get details for each commit
  const commitDetails = [];
  for (const sha of allCommits) {
    try {
      const info = execSync(`git log -1 --format="%H|%s|%an|%ai" ${sha}`, {
        cwd, encoding: 'utf-8', timeout: 5000
      }).trim();
      const [hash, subject, author, date] = info.split('|');
      const files = execSync(`git diff-tree --no-commit-id --name-only -r ${sha}`, {
        cwd, encoding: 'utf-8', timeout: 5000
      }).trim().split('\n').filter(Boolean);
      commitDetails.push({ sha: hash.slice(0, 7), subject, author, date, files });
    } catch (e) { debugLog('feature.rollbackInfo', 'exec failed', e); }
  }

  output({
    found: true,
    plan_id: planId,
    summary_path: summaryPath,
    commit_count: commitDetails.length,
    commits: commitDetails,
    rollback_command: allCommits.length > 0
      ? `git revert --no-commit ${allCommits.map(c => c.slice(0, 7)).join(' ')} && git commit -m "rollback: revert plan ${planId}"`
      : null,
    warning: 'Review the commits above before running rollback. This creates a revert commit (non-destructive).',
  }, raw);
}

function cmdVelocity(cwd, raw) {
  const milestone = getMilestoneInfo(cwd);

  // Collect plan execution metrics from STATE.md
  const metrics = [];
  try {
    const state = fs.readFileSync(path.join(cwd, '.planning', 'STATE.md'), 'utf-8');
    const metricsSection = state.match(/### Performance Metrics[\s\S]*?\|[\s\S]*?(?=\n###|\n---|\n$)/);
    if (metricsSection) {
      const rows = metricsSection[0].match(/\|\s*[\d.]+-[\d.]+\s*\|[^\n]+/g) || [];
      for (const row of rows) {
        const cols = row.split('|').map(c => c.trim()).filter(Boolean);
        if (cols.length >= 2) {
          metrics.push({
            plan: cols[0],
            duration: cols[1],
            tasks: cols[2] ? parseInt(cols[2]) : null,
            files: cols[3] ? parseInt(cols[3]) : null,
          });
        }
      }
    }
  } catch (e) { debugLog('feature.velocity', 'read STATE.md metrics failed', e); }

  // Get git log for planning activity
  let plansPerDay = {};
  try {
    const log = execSync('git log --oneline --format="%ai|%s" -- .planning/', {
      cwd, encoding: 'utf-8', timeout: 10000
    }).trim();
    if (log) {
      for (const line of log.split('\n')) {
        const [dateTime, ...msgParts] = line.split('|');
        const date = dateTime.split(' ')[0];
        const msg = msgParts.join('|');
        // Count SUMMARY commits as completed plans
        if (msg.toLowerCase().includes('summary') || msg.toLowerCase().includes('complete')) {
          plansPerDay[date] = (plansPerDay[date] || 0) + 1;
        }
      }
    }
  } catch (e) { debugLog('feature.velocity', 'exec failed', e); }

  const daysList = Object.entries(plansPerDay).sort((a, b) => a[0].localeCompare(b[0]));
  const totalDays = daysList.length || 1;
  const totalCompletedPlans = daysList.reduce((sum, [, count]) => sum + count, 0);
  const avgPerDay = (totalCompletedPlans / totalDays).toFixed(1);

  // Estimate remaining work
  let remainingPhases = 0;
  try {
    const roadmap = fs.readFileSync(path.join(cwd, '.planning', 'ROADMAP.md'), 'utf-8');
    const unchecked = (roadmap.match(/- \[ \] \*\*Phase/g) || []).length;
    remainingPhases = unchecked;
  } catch (e) { debugLog('feature.velocity', 'read failed', e); }

  // Estimate plans per phase (average of completed phases)
  const avgPlansPerPhase = metrics.length > 0 ? Math.ceil(metrics.length / Math.max(1, metrics.length / 4)) : 4;
  const estimatedRemainingPlans = remainingPhases * avgPlansPerPhase;
  const estimatedDaysRemaining = totalCompletedPlans > 0
    ? Math.ceil(estimatedRemainingPlans / (totalCompletedPlans / totalDays))
    : null;

  output({
    milestone: milestone.version,
    metrics: {
      plans_completed: totalCompletedPlans,
      active_days: totalDays,
      avg_plans_per_day: parseFloat(avgPerDay),
      daily_breakdown: daysList.slice(-7), // Last 7 days
    },
    plan_metrics: metrics,
    forecast: {
      remaining_phases: remainingPhases,
      estimated_remaining_plans: estimatedRemainingPlans,
      estimated_days_remaining: estimatedDaysRemaining,
    },
  }, raw);
}

function cmdTraceRequirement(cwd, reqId, raw) {
  if (!reqId) {
    error('Requirement ID required (e.g., ANOM-01)');
  }

  const reqUpper = reqId.toUpperCase();
  const trace = { requirement: reqUpper, phase: null, plans: [], files: [], status: 'unknown' };

  // Find in ROADMAP coverage map
  try {
    const roadmap = fs.readFileSync(path.join(cwd, '.planning', 'ROADMAP.md'), 'utf-8');
    const coverageMatch = roadmap.match(new RegExp(`${reqUpper}\\s*\\|\\s*(\\d+)`, 'i'));
    if (coverageMatch) {
      trace.phase = coverageMatch[1];
    }
    // Also check Requirements line in phase sections
    if (!trace.phase) {
      const reqLine = roadmap.match(new RegExp(`Phase\\s+(\\d+)[\\s\\S]*?Requirements:?\\*\\*:?\\s*[^\\n]*${reqUpper}`, 'i'));
      if (reqLine) trace.phase = reqLine[1];
    }
  } catch (e) { debugLog('feature.traceRequirement', 'read failed', e); }

  if (!trace.phase) {
    output({ ...trace, status: 'unmapped', message: `${reqUpper} not found in ROADMAP.md coverage map` }, raw);
    return;
  }

  // Find plans that cover this requirement
  const phasesDir = path.join(cwd, '.planning', 'phases');
  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    const phaseDir = dirs.find(d => d.startsWith(trace.phase + '-'));

    if (phaseDir) {
      const phaseFiles = fs.readdirSync(path.join(phasesDir, phaseDir));

      // Check PLANs
      const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md'));
      for (const plan of plans) {
        const content = fs.readFileSync(path.join(phasesDir, phaseDir, plan), 'utf-8');
        const fm = extractFrontmatter(content);
        const reqs = fm.requirements || [];
        if (reqs.some(r => r.toUpperCase().includes(reqUpper))) {
          trace.plans.push({
            file: plan,
            has_summary: phaseFiles.includes(plan.replace('-PLAN.md', '-SUMMARY.md')),
          });

          // Get files from plan's files_modified
          const planFiles = fm.files_modified || [];
          trace.files.push(...planFiles);
        }
      }

      // Check SUMMARYs for actual implementation evidence
      const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md'));
      const allSummariesExist = trace.plans.every(p => p.has_summary);

      if (trace.plans.length === 0) {
        trace.status = 'planned_no_plans';
      } else if (allSummariesExist) {
        trace.status = 'implemented';
      } else {
        trace.status = 'in_progress';
      }
    } else {
      trace.status = 'not_started';
    }
  } catch (e) { debugLog('feature.traceRequirement', 'search phase plans failed', e); }

  // Deduplicate files
  trace.files = [...new Set(trace.files)];

  // Verify files actually exist on disk
  trace.files = trace.files.map(f => ({
    path: f,
    exists: fs.existsSync(path.join(cwd, f)),
  }));

  // ── Assertion chain (when ASSERTIONS.md exists) ──────────────────────
  const assertionsContent = safeReadFile(path.join(cwd, '.planning', 'ASSERTIONS.md'));
  if (assertionsContent) {
    const allAssertions = parseAssertionsMd(assertionsContent);
    const reqAssertions = allAssertions[reqUpper];
    if (reqAssertions) {
      // Cross-reference assertions with plan must_haves.truths
      const planTruths = new Set();
      const phaseDirName = trace.phase ? (() => {
        try {
          const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
          const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
          return dirs.find(d => d.startsWith(trace.phase + '-'));
        } catch (e) { return null; }
      })() : null;

      if (phaseDirName) {
        const phaseFiles = fs.readdirSync(path.join(phasesDir, phaseDirName));
        const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md'));
        for (const plan of plans) {
          try {
            const planContent = fs.readFileSync(path.join(phasesDir, phaseDirName, plan), 'utf-8');
            const fm = extractFrontmatter(planContent);
            // Extract must_haves.truths
            if (fm.must_haves && fm.must_haves.truths) {
              const truths = Array.isArray(fm.must_haves.truths) ? fm.must_haves.truths : [fm.must_haves.truths];
              for (const t of truths) {
                if (typeof t === 'string') planTruths.add(t.toLowerCase());
              }
            }
          } catch (e) { debugLog('feature.traceRequirement', 'read plan for truths failed', e); }
        }
      }

      const hasSummaries = trace.plans.length > 0 && trace.plans.every(p => p.has_summary);
      const assertionEntries = reqAssertions.assertions.map(a => {
        const assertLower = a.assert.toLowerCase();
        const planned = planTruths.size > 0 && [...planTruths].some(t =>
          t.includes(assertLower.slice(0, 30)) || assertLower.includes(t.slice(0, 30))
        );
        const implemented = planned && hasSummaries;
        return {
          assert: a.assert,
          priority: a.priority,
          type: a.type || null,
          planned,
          implemented,
          gap: !planned,
        };
      });

      trace.assertions = assertionEntries;
      trace.assertion_count = assertionEntries.length;
      trace.must_have_count = assertionEntries.filter(a => a.priority === 'must-have').length;

      // Build chain field: human-readable status chain
      const passCount = assertionEntries.filter(a => a.implemented).length;
      const failCount = assertionEntries.filter(a => !a.implemented && a.priority === 'must-have').length;
      const planRef = trace.plans.length > 0 ? trace.plans.map(p => p.file.replace(/-PLAN\.md$/, '')).join(', ') : 'no plan';
      const verificationStatus = passCount === assertionEntries.length ? 'PASSED'
        : failCount > 0 ? 'partial'
        : 'pending';
      trace.chain = `${reqUpper} → ${assertionEntries.length} assertions (${trace.must_have_count} must-have) → ${planRef} → VERIFICATION: ${verificationStatus}`;
    }
  }

  output(trace, raw);
}

function cmdValidateConfig(cwd, raw) {
  const configPath = path.join(cwd, '.planning', 'config.json');

  if (!fs.existsSync(configPath)) {
    output({ exists: false, message: 'No config.json found' }, raw);
    return;
  }

  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (e) {
    debugLog('feature.validateConfig', 'read failed', e);
    output({ exists: true, valid_json: false, error: e.message }, raw);
    return;
  }

  // Derive known keys from CONFIG_SCHEMA (single source of truth)
  const knownKeys = {};
  for (const [key, def] of Object.entries(CONFIG_SCHEMA)) {
    knownKeys[key] = { type: def.type, default: def.default, description: def.description };
    // Register aliases as known keys (e.g., research_enabled → research)
    for (const alias of def.aliases) {
      knownKeys[alias] = { type: def.type, default: def.default, description: `Alias for ${key}: ${def.description}` };
    }
  }
  // Register section container keys as known (workflow, planning, git)
  const sectionNames = new Set();
  for (const [, def] of Object.entries(CONFIG_SCHEMA)) {
    if (def.nested) sectionNames.add(def.nested.section);
  }
  for (const section of sectionNames) {
    knownKeys[section] = { type: 'object', default: {}, description: `${section} configuration section` };
  }

  const warnings = [];
  const effective = {};

  // Check for unknown keys
  for (const key of Object.keys(config)) {
    if (!knownKeys[key]) {
      warnings.push({ type: 'unknown_key', key, value: config[key], message: `Unknown config key: "${key}" — possible typo?` });
    }
  }

  // Build effective config (explicit + defaults)
  for (const [key, schema] of Object.entries(knownKeys)) {
    const hasExplicit = key in config;
    const value = hasExplicit ? config[key] : schema.default;

    // Type check
    if (hasExplicit) {
      const actualType = typeof config[key];
      if (actualType !== schema.type && !(schema.type === 'object' && actualType === 'object')) {
        warnings.push({
          type: 'type_mismatch', key,
          expected: schema.type, actual: actualType,
          message: `"${key}" should be ${schema.type}, got ${actualType}`,
        });
      }
    }

    effective[key] = { value, source: hasExplicit ? 'explicit' : 'default', description: schema.description };
  }

  output({
    exists: true,
    valid_json: true,
    warning_count: warnings.length,
    warnings,
    effective_config: effective,
  }, raw);
}

function cmdQuickTaskSummary(cwd, raw) {
  const milestone = getMilestoneInfo(cwd);
  const quickTasks = [];

  // Parse quick tasks from STATE.md
  try {
    const state = fs.readFileSync(path.join(cwd, '.planning', 'STATE.md'), 'utf-8');
    const quickSection = state.match(/### Quick Tasks Completed[\s\S]*?\|[\s\S]*?(?=\n###|\n---|\n$)/);
    if (quickSection) {
      const rows = quickSection[0].match(/\|\s*\d+\s*\|[^\n]+/g) || [];
      for (const row of rows) {
        const cols = row.split('|').map(c => c.trim()).filter(Boolean);
        if (cols.length >= 4) {
          quickTasks.push({
            number: cols[0],
            description: cols[1],
            date: cols[2],
            commit: cols[3],
            status: cols[4] || 'unknown',
          });
        }
      }
    }
  } catch (e) { debugLog('feature.quickSummary', 'parse STATE.md quick tasks failed', e); }

  output({
    milestone: milestone.version,
    total_quick_tasks: quickTasks.length,
    tasks: quickTasks,
  }, raw);
}

// ─── Extract Sections ───────────────────────────────────────────────────────

/**
 * Extract named sections from a markdown file.
 * Supports ## headers and <!-- section: name --> markers as boundaries.
 * Discovery mode (no section names) returns available section list.
 */
function extractSectionsFromFile(filePath, sectionNames) {
  const content = safeReadFile(filePath);
  if (content === null) {
    return { error: 'File not found', file: filePath };
  }

  const lines = content.split('\n');
  const sections = []; // { name, startLine, endLine }

  // First pass: find all section boundaries
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match <!-- section: name --> markers
    const markerMatch = line.match(/<!--\s*section:\s*(.+?)\s*-->/i);
    if (markerMatch) {
      const name = markerMatch[1].trim();
      sections.push({ name, startLine: i, endLine: -1, type: 'marker' });
      continue;
    }

    // Match <!-- /section --> end markers — close the last open marker section
    const endMarkerMatch = line.match(/<!--\s*\/section\s*-->/i);
    if (endMarkerMatch) {
      // Find the last unclosed marker section
      for (let j = sections.length - 1; j >= 0; j--) {
        if (sections[j].type === 'marker' && sections[j].endLine === -1) {
          sections[j].endLine = i;
          break;
        }
      }
      continue;
    }

    // Match ## and ### headers
    const headerMatch = line.match(/^(#{2,3})\s+(.+)/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const name = headerMatch[2].trim();
      sections.push({ name, startLine: i, endLine: -1, type: 'header', level });
    }
  }

  // Second pass: close unclosed header sections
  // A header section ends at the next header of equal or higher level, or EOF
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    if (sec.endLine !== -1) continue; // Already closed (marker sections)

    if (sec.type === 'header') {
      // Find next header at same or higher level
      let closed = false;
      for (let j = i + 1; j < sections.length; j++) {
        if (sections[j].type === 'header' && sections[j].level <= sec.level) {
          sec.endLine = sections[j].startLine - 1;
          closed = true;
          break;
        }
      }
      if (!closed) {
        sec.endLine = lines.length - 1;
      }
    } else if (sec.type === 'marker' && sec.endLine === -1) {
      // Unclosed marker — extend to EOF
      sec.endLine = lines.length - 1;
    }
  }

  // Build available sections list
  const availableSections = sections.map(s => s.name);

  // Discovery mode: no section names requested
  if (!sectionNames || sectionNames.length === 0) {
    return {
      file: filePath,
      available_sections: availableSections,
    };
  }

  // Extraction mode: find matching sections
  const found = [];
  const missing = [];
  const contentParts = [];

  for (const requestedName of sectionNames) {
    const requestedLower = requestedName.toLowerCase();
    const match = sections.find(s => s.name.toLowerCase() === requestedLower);

    if (match) {
      found.push(match.name);
      const sectionLines = lines.slice(match.startLine, match.endLine + 1);
      contentParts.push(sectionLines.join('\n'));
    } else {
      missing.push(requestedName);
    }
  }

  return {
    file: filePath,
    sections_found: found,
    sections_missing: missing,
    content: contentParts.join('\n\n'),
  };
}

function cmdExtractSections(cwd, args, raw) {
  const filePath = args[0];
  if (!filePath) {
    error('Usage: extract-sections <file-path> [section1] [section2] ...');
  }

  // Resolve file path relative to cwd
  const resolvedPath = path.isAbsolute(filePath)
    ? filePath
    : path.join(cwd, filePath);

  const sectionNames = args.slice(1);
  const result = extractSectionsFromFile(resolvedPath, sectionNames);

  if (result.error) {
    error(`File not found: ${filePath}`);
  }

  output(result, raw);
}

// ─── Workflow Measurement (Baseline & Compare) ──────────────────────────────

const { extractAtReferences } = require('../lib/helpers');

/**
 * Measure token consumption for all workflow files.
 * Scans workflow directory, parses @-references, estimates tokens.
 * Returns: { timestamp, workflow_count, total_tokens, workflows: [...] }
 */
function measureAllWorkflows(cwd) {
  // Detect plugin path: bundled binary at bin/gsd-tools.cjs → ../workflows/
  // Or use GSD_PLUGIN_DIR env var for testing
  let pluginDir = process.env.GSD_PLUGIN_DIR;
  if (!pluginDir) {
    // __dirname is the dir of the bundled output (bin/), so go up one level
    pluginDir = path.resolve(__dirname, '..');
  }

  const workflowsDir = path.join(pluginDir, 'workflows');
  if (!fs.existsSync(workflowsDir)) {
    return { error: `Workflows directory not found: ${workflowsDir}`, workflows: [] };
  }

  const workflowFiles = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.md')).sort();
  const workflows = [];
  let totalTokens = 0;

  for (const file of workflowFiles) {
    const filePath = path.join(workflowsDir, file);
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
      debugLog('baseline.measure', `read workflow failed: ${file}`, e);
      continue;
    }

    const workflowTokens = estimateTokens(content);

    // Extract @-references and measure their tokens
    const refs = extractAtReferences(content);
    let refTokens = 0;
    let resolvedRefs = 0;

    for (const ref of refs) {
      // Resolve reference to absolute path
      let refPath;
      if (path.isAbsolute(ref)) {
        refPath = ref;
      } else {
        // Try relative to plugin dir first, then CWD
        const pluginRef = path.join(pluginDir, ref);
        const cwdRef = path.join(cwd, ref);
        if (fs.existsSync(pluginRef)) {
          refPath = pluginRef;
        } else if (fs.existsSync(cwdRef)) {
          refPath = cwdRef;
        } else {
          continue; // Skip unresolvable references
        }
      }

      try {
        const refContent = fs.readFileSync(refPath, 'utf-8');
        refTokens += estimateTokens(refContent);
        resolvedRefs++;
      } catch (e) {
        debugLog('baseline.measure', `read ref failed: ${ref}`, e);
      }
    }

    const total = workflowTokens + refTokens;
    totalTokens += total;

    workflows.push({
      name: file,
      workflow_tokens: workflowTokens,
      ref_count: resolvedRefs,
      ref_tokens: refTokens,
      total_tokens: total,
    });
  }

  // Sort by total_tokens descending (biggest first)
  workflows.sort((a, b) => b.total_tokens - a.total_tokens);

  return {
    timestamp: new Date().toISOString(),
    workflow_count: workflows.length,
    total_tokens: totalTokens,
    workflows,
  };
}

function cmdContextBudgetBaseline(cwd, raw) {
  const measurement = measureAllWorkflows(cwd);

  if (measurement.error) {
    error(measurement.error);
  }

  // Save baseline to .planning/baselines/
  const baselinesDir = path.join(cwd, '.planning', 'baselines');
  if (!fs.existsSync(baselinesDir)) {
    fs.mkdirSync(baselinesDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baselinePath = path.join(baselinesDir, `baseline-${timestamp}.json`);
  fs.writeFileSync(baselinePath, JSON.stringify(measurement, null, 2), 'utf-8');

  // Print table to stderr for humans
  const maxNameLen = Math.max(25, ...measurement.workflows.map(w => w.name.length));
  const header = `${'Workflow'.padEnd(maxNameLen)} | Tokens  | Refs | Ref Tokens | Total`;
  const sep = '-'.repeat(maxNameLen) + '-|---------|------|------------|--------';
  process.stderr.write('\n## Workflow Token Baseline\n\n');
  process.stderr.write(header + '\n');
  process.stderr.write(sep + '\n');
  for (const w of measurement.workflows) {
    const name = w.name.padEnd(maxNameLen);
    const tokens = String(w.workflow_tokens).padStart(7);
    const refs = String(w.ref_count).padStart(4);
    const refTokens = String(w.ref_tokens).padStart(10);
    const total = String(w.total_tokens).padStart(7);
    process.stderr.write(`${name} | ${tokens} | ${refs} | ${refTokens} | ${total}\n`);
  }
  process.stderr.write(sep + '\n');
  process.stderr.write(`${'TOTAL'.padEnd(maxNameLen)} | ${String(measurement.total_tokens).padStart(7)} |      |            |\n`);
  process.stderr.write(`\nBaseline saved: ${path.relative(cwd, baselinePath)}\n\n`);

  measurement.baseline_file = path.relative(cwd, baselinePath);
  output(measurement, raw);
}

function cmdContextBudgetCompare(cwd, baselinePath, raw) {
  // Resolve baseline file
  let baseline;
  const baselinesDir = path.join(cwd, '.planning', 'baselines');

  if (baselinePath) {
    // Explicit path provided
    const fullPath = path.isAbsolute(baselinePath) ? baselinePath : path.join(cwd, baselinePath);
    if (!fs.existsSync(fullPath)) {
      error(`Baseline file not found: ${baselinePath}`);
    }
    try {
      baseline = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    } catch (e) {
      error(`Invalid baseline file: ${e.message}`);
    }
  } else {
    // Find most recent baseline
    if (!fs.existsSync(baselinesDir)) {
      error('No baselines directory. Run `context-budget baseline` first.');
    }
    const files = fs.readdirSync(baselinesDir)
      .filter(f => f.startsWith('baseline-') && f.endsWith('.json'))
      .sort()
      .reverse();
    if (files.length === 0) {
      error('No baseline found. Run `context-budget baseline` first.');
    }
    const latestFile = path.join(baselinesDir, files[0]);
    try {
      baseline = JSON.parse(fs.readFileSync(latestFile, 'utf-8'));
      baselinePath = path.relative(cwd, latestFile);
    } catch (e) {
      error(`Invalid baseline file: ${e.message}`);
    }
  }

  // Measure current state
  const current = measureAllWorkflows(cwd);
  if (current.error) {
    error(current.error);
  }

  // Build lookup maps
  const baselineMap = {};
  for (const w of (baseline.workflows || [])) {
    baselineMap[w.name] = w;
  }
  const currentMap = {};
  for (const w of current.workflows) {
    currentMap[w.name] = w;
  }

  // Compare
  const allNames = new Set([...Object.keys(baselineMap), ...Object.keys(currentMap)]);
  const comparisons = [];
  let beforeTotal = 0;
  let afterTotal = 0;
  let improved = 0;
  let unchanged = 0;
  let worsened = 0;

  for (const name of allNames) {
    const before = baselineMap[name];
    const after = currentMap[name];

    if (before && after) {
      const delta = after.total_tokens - before.total_tokens;
      const pctChange = before.total_tokens > 0
        ? Math.round((delta / before.total_tokens) * 1000) / 10
        : 0;
      beforeTotal += before.total_tokens;
      afterTotal += after.total_tokens;
      if (delta < 0) improved++;
      else if (delta > 0) worsened++;
      else unchanged++;
      comparisons.push({ name, before: before.total_tokens, after: after.total_tokens, delta, percent_change: pctChange });
    } else if (before && !after) {
      beforeTotal += before.total_tokens;
      comparisons.push({ name, before: before.total_tokens, after: 0, delta: -before.total_tokens, percent_change: -100, status: 'removed' });
      improved++;
    } else if (!before && after) {
      afterTotal += after.total_tokens;
      comparisons.push({ name, before: 0, after: after.total_tokens, delta: after.total_tokens, percent_change: 100, status: 'new' });
      worsened++;
    }
  }

  // Sort by delta ascending (biggest reductions first)
  comparisons.sort((a, b) => a.delta - b.delta);

  const totalDelta = afterTotal - beforeTotal;
  const totalPctChange = beforeTotal > 0
    ? Math.round((totalDelta / beforeTotal) * 1000) / 10
    : 0;

  const result = {
    baseline_file: baselinePath || 'unknown',
    baseline_date: baseline.timestamp || 'unknown',
    current_date: current.timestamp,
    summary: {
      before_total: beforeTotal,
      after_total: afterTotal,
      delta: totalDelta,
      percent_change: totalPctChange,
      workflows_improved: improved,
      workflows_unchanged: unchanged,
      workflows_worsened: worsened,
    },
    workflows: comparisons,
  };

  // Print comparison table to stderr
  const maxNameLen = Math.max(25, ...comparisons.map(c => c.name.length));
  const header = `${'Workflow'.padEnd(maxNameLen)} | Before  | After   | Delta   | Change`;
  const sep = '-'.repeat(maxNameLen) + '-|---------|---------|---------|-------';
  process.stderr.write('\n## Context Budget Comparison\n\n');
  process.stderr.write(`Baseline: ${baselinePath} (${baseline.timestamp || 'unknown'})\n\n`);
  process.stderr.write(header + '\n');
  process.stderr.write(sep + '\n');
  for (const c of comparisons) {
    const name = c.name.padEnd(maxNameLen);
    const before = String(c.before).padStart(7);
    const after = String(c.after).padStart(7);
    const delta = (c.delta >= 0 ? '+' + c.delta : String(c.delta)).padStart(7);
    const pct = (c.percent_change >= 0 ? '+' + c.percent_change : String(c.percent_change)) + '%';
    process.stderr.write(`${name} | ${before} | ${after} | ${delta} | ${pct.padStart(6)}\n`);
  }
  process.stderr.write(sep + '\n');
  const totalDeltaStr = (totalDelta >= 0 ? '+' + totalDelta : String(totalDelta)).padStart(7);
  const totalPctStr = (totalPctChange >= 0 ? '+' + totalPctChange : String(totalPctChange)) + '%';
  process.stderr.write(`${'TOTAL'.padEnd(maxNameLen)} | ${String(beforeTotal).padStart(7)} | ${String(afterTotal).padStart(7)} | ${totalDeltaStr} | ${totalPctStr.padStart(6)}\n`);
  process.stderr.write(`\nImproved: ${improved} | Unchanged: ${unchanged} | Worsened: ${worsened}\n\n`);

  output(result, raw);
}

// ─── Context Budget Measure ─────────────────────────────────────────────────

/**
 * Measures token savings from slim/limit flags on init and history-digest commands.
 * Spawns subprocesses for each command variant, captures JSON output, and compares token counts.
 */
function cmdContextBudgetMeasure(cwd, raw) {
  const measurements = [];
  // Use process.argv[1] to get the actual binary path (works in bundled context)
  const gsdBin = process.argv[1];

  // Helper: run a gsd-tools command and return the JSON output size in tokens
  function measureCommand(cmdArgs) {
    try {
      const result = execSync(`node ${sanitizeShellArg(gsdBin)} ${cmdArgs} --raw`, {
        cwd, encoding: 'utf-8', timeout: 30000,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large JSON outputs
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, GSD_DEBUG: '', GSD_NO_TMPFILE: '1' }, // suppress debug, disable file redirect
      }).trim();

      // Handle @file: redirect for large outputs
      let jsonStr = result;
      if (result.startsWith('@file:')) {
        const filePath = result.slice(6);
        try {
          jsonStr = fs.readFileSync(filePath, 'utf-8');
        } catch (e) {
          debugLog('measure', `read tmpfile failed: ${filePath}`, e);
          return { tokens: 0, bytes: 0, error: 'tmpfile read failed' };
        }
      }

      const tokens = estimateTokens(jsonStr);
      return { tokens, bytes: Buffer.byteLength(jsonStr, 'utf-8') };
    } catch (e) {
      debugLog('measure', `command failed: ${cmdArgs}`, e);
      // Try to capture stdout even on non-zero exit
      const stdout = (e.stdout || '').trim();
      if (stdout) {
        const tokens = estimateTokens(stdout);
        return { tokens, bytes: Buffer.byteLength(stdout, 'utf-8') };
      }
      return { tokens: 0, bytes: 0, error: e.message ? e.message.split('\n')[0] : 'unknown' };
    }
  }

  // Detect first available phase for init commands
  let testPhase = null;
  try {
    const phasesDir = path.join(cwd, '.planning', 'phases');
    if (fs.existsSync(phasesDir)) {
      const dirs = fs.readdirSync(phasesDir, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => e.name)
        .sort();
      if (dirs.length > 0) {
        const match = dirs[0].match(/^(\d+)/);
        if (match) testPhase = match[1];
      }
    }
  } catch (e) { debugLog('measure', 'phase detection failed', e); }

  // ── Measurement 1: history-digest (full vs --limit 5 vs --slim) ──

  const hdFull = measureCommand('history-digest');
  const hdLimit5 = measureCommand('history-digest --limit 5');
  const hdSlim = measureCommand('history-digest --slim');
  const hdSlimLimit5 = measureCommand('history-digest --slim --limit 5');

  if (!hdFull.error) {
    measurements.push({
      command: 'history-digest',
      variant: '--limit 5',
      full_tokens: hdFull.tokens,
      slim_tokens: hdLimit5.tokens,
      saved_tokens: hdFull.tokens - hdLimit5.tokens,
      saved_percent: hdFull.tokens > 0 ? Math.round(((hdFull.tokens - hdLimit5.tokens) / hdFull.tokens) * 100) : 0,
      full_bytes: hdFull.bytes,
      slim_bytes: hdLimit5.bytes,
    });
    measurements.push({
      command: 'history-digest',
      variant: '--slim',
      full_tokens: hdFull.tokens,
      slim_tokens: hdSlim.tokens,
      saved_tokens: hdFull.tokens - hdSlim.tokens,
      saved_percent: hdFull.tokens > 0 ? Math.round(((hdFull.tokens - hdSlim.tokens) / hdFull.tokens) * 100) : 0,
      full_bytes: hdFull.bytes,
      slim_bytes: hdSlim.bytes,
    });
    measurements.push({
      command: 'history-digest',
      variant: '--slim --limit 5',
      full_tokens: hdFull.tokens,
      slim_tokens: hdSlimLimit5.tokens,
      saved_tokens: hdFull.tokens - hdSlimLimit5.tokens,
      saved_percent: hdFull.tokens > 0 ? Math.round(((hdFull.tokens - hdSlimLimit5.tokens) / hdFull.tokens) * 100) : 0,
      full_bytes: hdFull.bytes,
      slim_bytes: hdSlimLimit5.bytes,
    });
  }

  // ── Measurement 2: init progress (verbose vs compact) ──

  const progressVerbose = measureCommand('init progress --verbose');
  const progressCompact = measureCommand('init progress');

  if (!progressVerbose.error) {
    measurements.push({
      command: 'init progress',
      variant: 'compact (default) vs verbose',
      full_tokens: progressVerbose.tokens,
      slim_tokens: progressCompact.tokens,
      saved_tokens: progressVerbose.tokens - progressCompact.tokens,
      saved_percent: progressVerbose.tokens > 0 ? Math.round(((progressVerbose.tokens - progressCompact.tokens) / progressVerbose.tokens) * 100) : 0,
      full_bytes: progressVerbose.bytes,
      slim_bytes: progressCompact.bytes,
    });
  }

  // ── Measurement 3: init execute-phase (verbose vs compact) ──

  if (testPhase) {
    const execVerbose = measureCommand(`init execute-phase ${testPhase} --verbose`);
    const execCompact = measureCommand(`init execute-phase ${testPhase}`);

    if (!execVerbose.error) {
      measurements.push({
        command: `init execute-phase ${testPhase}`,
        variant: 'compact (default) vs verbose',
        full_tokens: execVerbose.tokens,
        slim_tokens: execCompact.tokens,
        saved_tokens: execVerbose.tokens - execCompact.tokens,
        saved_percent: execVerbose.tokens > 0 ? Math.round(((execVerbose.tokens - execCompact.tokens) / execVerbose.tokens) * 100) : 0,
        full_bytes: execVerbose.bytes,
        slim_bytes: execCompact.bytes,
      });
    }

    // ── Measurement 4: init plan-phase (verbose vs compact) ──

    const planVerbose = measureCommand(`init plan-phase ${testPhase} --verbose`);
    const planCompact = measureCommand(`init plan-phase ${testPhase}`);

    if (!planVerbose.error) {
      measurements.push({
        command: `init plan-phase ${testPhase}`,
        variant: 'compact (default) vs verbose',
        full_tokens: planVerbose.tokens,
        slim_tokens: planCompact.tokens,
        saved_tokens: planVerbose.tokens - planCompact.tokens,
        saved_percent: planVerbose.tokens > 0 ? Math.round(((planVerbose.tokens - planCompact.tokens) / planVerbose.tokens) * 100) : 0,
        full_bytes: planVerbose.bytes,
        slim_bytes: planCompact.bytes,
      });
    }
  }

  // ── Aggregate totals ──

  const totalFullTokens = measurements.reduce((sum, m) => sum + m.full_tokens, 0);
  const totalSlimTokens = measurements.reduce((sum, m) => sum + m.slim_tokens, 0);
  const totalSavedTokens = totalFullTokens - totalSlimTokens;
  const totalSavedPercent = totalFullTokens > 0 ? Math.round((totalSavedTokens / totalFullTokens) * 100) : 0;

  output({
    measurements,
    total_full_tokens: totalFullTokens,
    total_slim_tokens: totalSlimTokens,
    total_saved_tokens: totalSavedTokens,
    total_saved_percent: totalSavedPercent,
    note: 'Measures real JSON output token counts. "full" = verbose/unfiltered, "slim" = compact/filtered.',
  }, raw);
}

// ─── Token Budget Command ───────────────────────────────────────────────────

const WORKFLOW_BUDGETS = {
  'execute-phase': 15000,
  'plan-phase': 15000,
  'execute-plan': 12000,
  'new-project': 25000,
  'quick': 10000,
  'progress': 8000,
  'verify-work': 12000,
  'resume-project': 8000,
  'help': 10000,
  'pause-work': 5000,
};

function cmdTokenBudget(cwd, raw) {
  let pluginDir = process.env.GSD_PLUGIN_DIR;
  if (!pluginDir) {
    pluginDir = path.resolve(__dirname, '..');
  }
  const searchDirs = [
    path.join(cwd, 'workflows'),
    path.join(pluginDir, 'workflows'),
  ];
  const homeConfig = process.env.HOME
    ? path.join(process.env.HOME, '.config', 'opencode', 'get-shit-done', 'workflows')
    : null;
  if (homeConfig) searchDirs.push(homeConfig);
  let workflowsDir = null;
  for (const dir of searchDirs) {
    if (fs.existsSync(dir)) { workflowsDir = dir; break; }
  }
  const workflows = [];
  let overBudgetCount = 0;
  for (const [name, budgetTokens] of Object.entries(WORKFLOW_BUDGETS)) {
    const fileName = `${name}.md`;
    let content = null;
    if (workflowsDir) {
      const filePath = path.join(workflowsDir, fileName);
      if (fs.existsSync(filePath)) {
        try { content = fs.readFileSync(filePath, 'utf-8'); }
        catch (e) { debugLog('feature.tokenBudget', `read workflow failed: ${fileName}`, e); }
      }
    }
    if (content === null) {
      workflows.push({ name, actual_tokens: null, budget_tokens: budgetTokens, over_budget: false, percent_of_budget: null, status: 'not_found' });
      continue;
    }
    const actualTokens = Math.ceil(content.length / 4);
    const overBudget = actualTokens > budgetTokens;
    const percentOfBudget = Math.round((actualTokens / budgetTokens) * 100);
    if (overBudget) overBudgetCount++;
    workflows.push({ name, actual_tokens: actualTokens, budget_tokens: budgetTokens, over_budget: overBudget, percent_of_budget: percentOfBudget });
  }
  output({ workflows, over_budget_count: overBudgetCount, total_workflows: workflows.length }, raw);
}

// ─── Test Coverage Analysis ─────────────────────────────────────────────────

function cmdTestCoverage(cwd, raw) {
  const config = loadConfig(cwd);

  // Determine test file path
  const testFile = config.test_file || 'bin/gsd-tools.test.cjs';
  const testPath = path.join(cwd, testFile);

  if (!fs.existsSync(testPath)) {
    error(`Test file not found: ${testFile}`);
  }

  // Determine router file path
  const routerFile = config.router_file || 'src/router.js';
  const routerPath = path.join(cwd, routerFile);

  if (!fs.existsSync(routerPath)) {
    error(`Router file not found: ${routerFile}`);
  }

  const testContent = fs.readFileSync(testPath, 'utf-8');
  const routerContent = fs.readFileSync(routerPath, 'utf-8');

  // Extract all command names from router switch cases
  const routerCommands = new Set();
  const casePattern = /^\s{4}case\s+'([^']+)'/gm;
  let caseMatch;
  while ((caseMatch = casePattern.exec(routerContent)) !== null) {
    routerCommands.add(caseMatch[1]);
  }

  // Also extract init subcommands as 'init <sub>'
  const initPattern = /^\s{8}case\s+'([^']+)'/gm;
  let initMatch;
  while ((initMatch = initPattern.exec(routerContent)) !== null) {
    routerCommands.add('init ' + initMatch[1]);
  }

  // Extract tested commands from test file
  const testedCommands = new Set();

  // Pattern 1: runGsdTools('commandname ...')
  const runPattern = /runGsdTools\(\s*['"`]([^'"`]+)['"`]/g;
  let runMatch;
  while ((runMatch = runPattern.exec(testContent)) !== null) {
    const fullCmd = runMatch[1].trim();
    const words = fullCmd.split(/\s+/);
    const cmd = words[0];
    testedCommands.add(cmd);

    if (words.length > 1 && ['init', 'state', 'verify', 'memory', 'roadmap', 'phase', 'phases', 'frontmatter', 'template', 'validate', 'milestone', 'requirements', 'context-budget', 'todo'].includes(cmd)) {
      testedCommands.add(cmd + ' ' + words[1]);
    }
  }

  // Pattern 2: runGsdTools(`commandname ...`)
  const templatePattern = /runGsdTools\(\s*`([^`]+)`/g;
  let templateMatch;
  while ((templateMatch = templatePattern.exec(testContent)) !== null) {
    const fullCmd = templateMatch[1].replace(/\$\{[^}]+\}/g, 'X').trim();
    const words = fullCmd.split(/\s+/);
    const cmd = words[0];
    testedCommands.add(cmd);

    if (words.length > 1 && ['init', 'state', 'verify', 'memory', 'roadmap', 'phase', 'phases', 'frontmatter', 'template', 'validate', 'milestone', 'requirements', 'context-budget', 'todo'].includes(cmd)) {
      testedCommands.add(cmd + ' ' + words[1]);
    }
  }

  // Pattern 3: describe('command-name ...')
  const describePattern = /describe\(\s*['"`]([^'"`]+)['"`]/g;
  let describeMatch;
  while ((describeMatch = describePattern.exec(testContent)) !== null) {
    const desc = describeMatch[1].trim();
    const descWords = desc.split(/[\s:]+/);
    for (const word of descWords) {
      if (routerCommands.has(word)) {
        testedCommands.add(word);
      }
    }
  }

  // Count test functions
  const testMatches = testContent.match(/\btest\s*\(/g) || [];
  const testCount = testMatches.length;

  // Compare
  const allCommands = [...routerCommands].sort();
  const covered = allCommands.filter(cmd => {
    if (testedCommands.has(cmd)) return true;
    const base = cmd.split(' ')[0];
    if (testedCommands.has(base) && cmd.startsWith('init ')) {
      return testedCommands.has(cmd);
    }
    return false;
  });
  const uncovered = allCommands.filter(cmd => !covered.includes(cmd));

  const totalCommands = allCommands.length;
  const commandsWithTests = covered.length;
  const coveragePercent = totalCommands > 0
    ? Math.round((commandsWithTests / totalCommands) * 100)
    : 0;

  output({
    total_commands: totalCommands,
    commands_with_tests: commandsWithTests,
    coverage_percent: coveragePercent,
    covered: covered,
    uncovered: uncovered,
    test_count: testCount,
  }, raw);
}

function cmdSessionSummary(cwd, raw) {
  const pd = path.join(cwd, '.planning');
  const sc = safeReadFile(path.join(pd, 'STATE.md'));
  if (!sc) { output({ error: 'STATE.md not found' }, raw); return; }

  const xf = (f) => { const m = sc.match(new RegExp(`\\*\\*${f}:\\*\\*\\s*(.+)`, 'i')); return m ? m[1].trim() : null; };
  const pm = (xf('Phase') || '').match(/(\d+)\s*of\s*(\d+)\s*\(([^)]+)\)/);
  const phaseNum = pm ? pm[1] : xf('Phase');
  const phaseName = pm ? pm[3] : null;
  const plan = xf('Current Plan') || 'Not started';
  const status = xf('Status') || 'Unknown';
  const lastAct = xf('Last Activity');

  // Session activity from git log
  const completed = [];
  if (lastAct && isValidDateString(lastAct)) {
    try {
      const log = execSync(`git log --since=${sanitizeShellArg(lastAct)} --oneline --no-merges -- .planning/`, { cwd, encoding: 'utf-8', timeout: 1e4 }).trim();
      if (log) for (const l of log.split('\n')) {
        const m = l.match(/(?:feat|fix|docs|chore|refactor|test|perf)\((\d+-\d+)\)/);
        if (m && !completed.includes(m[1])) completed.push(m[1]);
      }
    } catch (e) { debugLog('feature.sessionSummary', 'git failed', e); }
  }

  // Decisions from STATE.md
  const ds = sc.match(/### Decisions\s*\n([\s\S]*?)(?=\n###|\n## |\n$)/);
  const decisions = [];
  if (ds) for (const l of ds[1].split('\n')) {
    const m = l.match(/^-\s*(?:\[Phase \d+\]:\s*)?(.{10,})/);
    if (m && !m[1].startsWith('All v')) decisions.push(m[1].trim());
  }

  // Next action from roadmap
  let next = { command: '/gsd-resume', description: 'Resume project work' };
  const rc = safeReadFile(path.join(pd, 'ROADMAP.md'));
  if (rc && phaseNum) {
    const unchecked = [];
    let um; const up = /- \[ \] \*\*Phase (\d+):\s*([^*]+)\*\*/g;
    while ((um = up.exec(rc)) !== null) unchecked.push({ n: um[1], name: um[2].trim() });

    const pDir = path.join(pd, 'phases');
    const countPlans = (num) => {
      try {
        const dirs = fs.readdirSync(pDir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);
        const d = dirs.find(d => d.startsWith(normalizePhaseName(num) + '-'));
        if (!d) return { plans: 0, summaries: 0 };
        const files = fs.readdirSync(path.join(pDir, d));
        return { plans: files.filter(f => f.endsWith('-PLAN.md')).length, summaries: files.filter(f => f.endsWith('-SUMMARY.md')).length };
      } catch (e) { return { plans: 0, summaries: 0 }; }
    };

    const cur = countPlans(phaseNum);
    if (cur.plans > 0 && cur.summaries < cur.plans) {
      next = { command: `/gsd-execute-phase ${phaseNum}`, description: `Continue Phase ${phaseNum}: ${phaseName || 'current'}` };
    } else if (unchecked.length > 0) {
      const np = unchecked.find(p => parseInt(p.n) > parseInt(phaseNum));
      if (np) {
        const nc = countPlans(np.n);
        next = nc.plans > 0
          ? { command: `/gsd-execute-phase ${np.n}`, description: `Execute Phase ${np.n}: ${np.name}` }
          : { command: `/gsd-plan-phase ${np.n}`, description: `Plan Phase ${np.n}: ${np.name}` };
      } else {
        next = { command: '/gsd-complete-milestone', description: 'All phases done — complete milestone' };
      }
    } else {
      next = { command: '/gsd-complete-milestone', description: 'All phases done — complete milestone' };
    }
  }

  const sa = sc.match(/Stopped at:\s*(.+)/);
  const rf = sc.match(/Resume file:\s*(.+)/);
  output({
    current_position: { phase: pm ? `${pm[1]} of ${pm[2]}` : (phaseNum || 'Unknown'), phase_name: phaseName || 'Unknown', plan, status },
    session_activity: { plans_completed: completed, decisions_made: decisions.slice(-5), blockers_resolved: [], last_activity: lastAct || 'Unknown' },
    next_action: next,
    session_continuity: { stopped_at: sa ? sa[1].trim() : `Phase ${phaseNum || '?'} — ${status}`, resume_file: rf ? rf[1].trim() : 'None' },
  }, raw);
}

module.exports = {
  cmdSessionDiff,
  cmdContextBudget,
  cmdContextBudgetBaseline,
  cmdContextBudgetCompare,
  cmdContextBudgetMeasure,
  cmdTestRun,
  cmdSearchDecisions,
  cmdValidateDependencies,
  cmdSearchLessons,
  cmdCodebaseImpact,
  cmdRollbackInfo,
  cmdVelocity,
  cmdTraceRequirement,
  cmdValidateConfig,
  cmdQuickTaskSummary,
  cmdExtractSections,
  extractSectionsFromFile,
  cmdTokenBudget,
  cmdTestCoverage,
  cmdSessionSummary,
};
