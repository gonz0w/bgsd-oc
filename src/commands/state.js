const fs = require('fs');
const path = require('path');
const { output, error, debugLog } = require('../lib/output');
const { loadConfig } = require('../lib/config');
const { safeReadFile, cachedReadFile, invalidateFileCache, normalizePhaseName, findPhaseInternal, getPhaseTree } = require('../lib/helpers');
const { execGit } = require('../lib/git');

// ─── Pre-compiled Regex Cache ────────────────────────────────────────────────
// Avoids repeated `new RegExp()` construction in hot paths like stateExtractField/stateReplaceField
const _fieldRegexCache = new Map();

function getFieldExtractRegex(fieldName) {
  const key = `extract:${fieldName}`;
  if (_fieldRegexCache.has(key)) return _fieldRegexCache.get(key);
  const pattern = new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*(.+)`, 'i');
  _fieldRegexCache.set(key, pattern);
  return pattern;
}

function getFieldReplaceRegex(fieldName) {
  const key = `replace:${fieldName}`;
  if (_fieldRegexCache.has(key)) return _fieldRegexCache.get(key);
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(\\*\\*${escaped}:\\*\\*\\s*)(.*)`, 'i');
  _fieldRegexCache.set(key, pattern);
  return pattern;
}

// ─── State Commands ──────────────────────────────────────────────────────────

function cmdStateLoad(cwd, raw) {
  const config = loadConfig(cwd);
  const planningDir = path.join(cwd, '.planning');

  const stateContent = cachedReadFile(path.join(planningDir, 'STATE.md'));
  const stateRaw = stateContent || '';
  const stateExists = stateRaw.length > 0;

  // Use try/catch on statSync instead of existsSync to avoid double syscalls
  let configExists = false;
  let roadmapExists = false;
  try { fs.statSync(path.join(planningDir, 'config.json')); configExists = true; } catch {}
  try { fs.statSync(path.join(planningDir, 'ROADMAP.md')); roadmapExists = true; } catch {}

  const result = {
    config,
    state_raw: stateRaw,
    state_exists: stateExists,
    roadmap_exists: roadmapExists,
    config_exists: configExists,
  };

  // Legacy rawValue: condensed key=value format for formatted/pretty mode
  const c = config;
  const rawLines = [
    `model_profile=${c.model_profile}`,
    `commit_docs=${c.commit_docs}`,
    `branching_strategy=${c.branching_strategy}`,
    `phase_branch_template=${c.phase_branch_template}`,
    `milestone_branch_template=${c.milestone_branch_template}`,
    `parallelization=${c.parallelization}`,
    `research=${c.research}`,
    `plan_checker=${c.plan_checker}`,
    `verifier=${c.verifier}`,
    `config_exists=${configExists}`,
    `roadmap_exists=${roadmapExists}`,
    `state_exists=${stateExists}`,
  ].join('\n');

  output(result, raw, rawLines);
}

function cmdStateGet(cwd, section, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  const content = cachedReadFile(statePath);
  if (!content) {
    error('STATE.md not found');
  }

  if (!section) {
    output({ content }, raw, content);
    return;
  }

  // Check for **field:** value (pre-compiled regex)
  const fieldMatch = content.match(getFieldReplaceRegex(section));
  if (fieldMatch) {
    const val = fieldMatch[2].trim();
    output({ [section]: val }, raw, val);
    return;
  }

  // Check for ## Section
  const fieldEscaped = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sectionPattern = new RegExp(`##\\s*${fieldEscaped}\\s*\n([\\s\\S]*?)(?=\\n##|$)`, 'i');
  const sectionMatch = content.match(sectionPattern);
  if (sectionMatch) {
    output({ [section]: sectionMatch[1].trim() }, raw, sectionMatch[1].trim());
    return;
  }

  output({ error: `Section or field "${section}" not found` }, raw, '');
}

function cmdStatePatch(cwd, patches, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  let content = cachedReadFile(statePath);
  if (!content) {
    error('STATE.md not found');
  }

  const results = { updated: [], failed: [] };

  for (const [field, value] of Object.entries(patches)) {
    const pattern = getFieldReplaceRegex(field);
    if (pattern.test(content)) {
      content = content.replace(pattern, `$1${value}`);
      results.updated.push(field);
    } else {
      results.failed.push(field);
    }
  }

  if (results.updated.length > 0) {
    fs.writeFileSync(statePath, content, 'utf-8');
    invalidateFileCache(statePath);
  }

  output(results, raw, results.updated.length > 0 ? 'true' : 'false');
}

function cmdStateUpdate(cwd, field, value) {
  if (!field || value === undefined) {
    error('field and value required for state update');
  }

  const statePath = path.join(cwd, '.planning', 'STATE.md');
  let content = cachedReadFile(statePath);
  if (!content) {
    output({ updated: false, reason: 'STATE.md not found' });
    return;
  }

  const pattern = getFieldReplaceRegex(field);
  if (pattern.test(content)) {
    content = content.replace(pattern, `$1${value}`);
    fs.writeFileSync(statePath, content, 'utf-8');
    invalidateFileCache(statePath);
    output({ updated: true });
  } else {
    output({ updated: false, reason: `Field "${field}" not found in STATE.md` });
  }
}

// ─── State Progression Engine ────────────────────────────────────────────────

function stateExtractField(content, fieldName) {
  const pattern = getFieldExtractRegex(fieldName);
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}

function stateReplaceField(content, fieldName, newValue) {
  const pattern = getFieldReplaceRegex(fieldName);
  if (pattern.test(content)) {
    return content.replace(pattern, `$1${newValue}`);
  }
  return null;
}

function cmdStateAdvancePlan(cwd, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  let content = cachedReadFile(statePath);
  if (!content) { output({ error: 'STATE.md not found' }, raw); return; }
  const currentPlan = parseInt(stateExtractField(content, 'Current Plan'), 10);
  const totalPlans = parseInt(stateExtractField(content, 'Total Plans in Phase'), 10);
  const today = new Date().toISOString().split('T')[0];

  if (isNaN(currentPlan) || isNaN(totalPlans)) {
    output({ error: 'Cannot parse Current Plan or Total Plans in Phase from STATE.md' }, raw);
    return;
  }

  if (currentPlan >= totalPlans) {
    content = stateReplaceField(content, 'Status', 'Phase complete — ready for verification') || content;
    content = stateReplaceField(content, 'Last Activity', today) || content;
    fs.writeFileSync(statePath, content, 'utf-8');
    invalidateFileCache(statePath);
    output({ advanced: false, reason: 'last_plan', current_plan: currentPlan, total_plans: totalPlans, status: 'ready_for_verification' }, raw, 'false');
  } else {
    const newPlan = currentPlan + 1;
    content = stateReplaceField(content, 'Current Plan', String(newPlan)) || content;
    content = stateReplaceField(content, 'Status', 'Ready to execute') || content;
    content = stateReplaceField(content, 'Last Activity', today) || content;
    fs.writeFileSync(statePath, content, 'utf-8');
    invalidateFileCache(statePath);
    output({ advanced: true, previous_plan: currentPlan, current_plan: newPlan, total_plans: totalPlans }, raw, 'true');
  }
}

function cmdStateRecordMetric(cwd, options, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  let content = cachedReadFile(statePath);
  if (!content) { output({ error: 'STATE.md not found' }, raw); return; }
  const { phase, plan, duration, tasks, files } = options;

  if (!phase || !plan || !duration) {
    output({ error: 'phase, plan, and duration required' }, raw);
    return;
  }

  // Find Performance Metrics section and its table
  const metricsPattern = /(##\s*Performance Metrics[\s\S]*?\n\|[^\n]+\n\|[-|\s]+\n)([\s\S]*?)(?=\n##|\n$|$)/i;
  const metricsMatch = content.match(metricsPattern);

  if (metricsMatch) {
    const tableHeader = metricsMatch[1];
    let tableBody = metricsMatch[2].trimEnd();
    const newRow = `| Phase ${phase} P${plan} | ${duration} | ${tasks || '-'} tasks | ${files || '-'} files |`;

    if (tableBody.trim() === '' || tableBody.includes('None yet')) {
      tableBody = newRow;
    } else {
      tableBody = tableBody + '\n' + newRow;
    }

    content = content.replace(metricsPattern, `${tableHeader}${tableBody}\n`);
    fs.writeFileSync(statePath, content, 'utf-8');
    invalidateFileCache(statePath);
    output({ recorded: true, phase, plan, duration }, raw, 'true');
  } else {
    output({ recorded: false, reason: 'Performance Metrics section not found in STATE.md' }, raw, 'false');
  }
}

function cmdStateUpdateProgress(cwd, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  let content = cachedReadFile(statePath);
  if (!content) { output({ error: 'STATE.md not found' }, raw); return; }

  // Count summaries across all phases — use cached phase tree
  let totalPlans = 0;
  let totalSummaries = 0;

  const phaseTree = getPhaseTree(cwd);
  for (const [, entry] of phaseTree) {
    totalPlans += entry.plans.length;
    totalSummaries += entry.summaries.length;
  }

  const percent = totalPlans > 0 ? Math.round(totalSummaries / totalPlans * 100) : 0;
  const barWidth = 10;
  const filled = Math.round(percent / 100 * barWidth);
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);
  const progressStr = `[${bar}] ${percent}%`;

  const progressPattern = /(\*\*Progress:\*\*\s*).*/i;
  if (progressPattern.test(content)) {
    content = content.replace(progressPattern, `$1${progressStr}`);
    fs.writeFileSync(statePath, content, 'utf-8');
    invalidateFileCache(statePath);
    output({ updated: true, percent, completed: totalSummaries, total: totalPlans, bar: progressStr }, raw, progressStr);
  } else {
    output({ updated: false, reason: 'Progress field not found in STATE.md' }, raw, 'false');
  }
}

function cmdStateAddDecision(cwd, options, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  let content = cachedReadFile(statePath);
  if (!content) { output({ error: 'STATE.md not found' }, raw); return; }

  const { phase, summary, rationale } = options;
  if (!summary) { output({ error: 'summary required' }, raw); return; }
  const entry = `- [Phase ${phase || '?'}]: ${summary}${rationale ? ` — ${rationale}` : ''}`;

  // Find Decisions section (various heading patterns)
  const sectionPattern = /(###?\s*(?:Decisions|Decisions Made|Accumulated.*Decisions)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
  const match = content.match(sectionPattern);

  if (match) {
    let sectionBody = match[2];
    // Remove placeholders
    sectionBody = sectionBody.replace(/None yet\.?\s*\n?/gi, '').replace(/No decisions yet\.?\s*\n?/gi, '');
    sectionBody = sectionBody.trimEnd() + '\n' + entry + '\n';
    content = content.replace(sectionPattern, `${match[1]}${sectionBody}`);
    fs.writeFileSync(statePath, content, 'utf-8');
    invalidateFileCache(statePath);
    output({ added: true, decision: entry }, raw, 'true');
  } else {
    output({ added: false, reason: 'Decisions section not found in STATE.md' }, raw, 'false');
  }
}

function cmdStateAddBlocker(cwd, text, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  let content = cachedReadFile(statePath);
  if (!content) { output({ error: 'STATE.md not found' }, raw); return; }
  if (!text) { output({ error: 'text required' }, raw); return; }
  const entry = `- ${text}`;

  const sectionPattern = /(###?\s*(?:Blockers|Blockers\/Concerns|Concerns)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
  const match = content.match(sectionPattern);

  if (match) {
    let sectionBody = match[2];
    sectionBody = sectionBody.replace(/None\.?\s*\n?/gi, '').replace(/None yet\.?\s*\n?/gi, '');
    sectionBody = sectionBody.trimEnd() + '\n' + entry + '\n';
    content = content.replace(sectionPattern, `${match[1]}${sectionBody}`);
    fs.writeFileSync(statePath, content, 'utf-8');
    invalidateFileCache(statePath);
    output({ added: true, blocker: text }, raw, 'true');
  } else {
    output({ added: false, reason: 'Blockers section not found in STATE.md' }, raw, 'false');
  }
}

function cmdStateResolveBlocker(cwd, text, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  let content = cachedReadFile(statePath);
  if (!content) { output({ error: 'STATE.md not found' }, raw); return; }
  if (!text) { output({ error: 'text required' }, raw); return; }

  const sectionPattern = /(###?\s*(?:Blockers|Blockers\/Concerns|Concerns)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
  const match = content.match(sectionPattern);

  if (match) {
    const sectionBody = match[2];
    const lines = sectionBody.split('\n');
    const filtered = lines.filter(line => {
      if (!line.startsWith('- ')) return true;
      return !line.toLowerCase().includes(text.toLowerCase());
    });

    let newBody = filtered.join('\n');
    // If section is now empty, add placeholder
    if (!newBody.trim() || !newBody.includes('- ')) {
      newBody = 'None\n';
    }

    content = content.replace(sectionPattern, `${match[1]}${newBody}`);
    fs.writeFileSync(statePath, content, 'utf-8');
    invalidateFileCache(statePath);
    output({ resolved: true, blocker: text }, raw, 'true');
  } else {
    output({ resolved: false, reason: 'Blockers section not found in STATE.md' }, raw, 'false');
  }
}

function cmdStateRecordSession(cwd, options, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  let content = cachedReadFile(statePath);
  if (!content) { output({ error: 'STATE.md not found' }, raw); return; }
  const now = new Date().toISOString();
  const updated = [];

  // Update Last session / Last Date
  let result = stateReplaceField(content, 'Last session', now);
  if (result) { content = result; updated.push('Last session'); }
  result = stateReplaceField(content, 'Last Date', now);
  if (result) { content = result; updated.push('Last Date'); }

  // Update Stopped at
  if (options.stopped_at) {
    result = stateReplaceField(content, 'Stopped At', options.stopped_at);
    if (!result) result = stateReplaceField(content, 'Stopped at', options.stopped_at);
    if (result) { content = result; updated.push('Stopped At'); }
  }

  // Update Resume file
  const resumeFile = options.resume_file || 'None';
  result = stateReplaceField(content, 'Resume File', resumeFile);
  if (!result) result = stateReplaceField(content, 'Resume file', resumeFile);
  if (result) { content = result; updated.push('Resume File'); }

  if (updated.length > 0) {
    fs.writeFileSync(statePath, content, 'utf-8');
    invalidateFileCache(statePath);
    output({ recorded: true, updated }, raw, 'true');
  } else {
    output({ recorded: false, reason: 'No session fields found in STATE.md' }, raw, 'false');
  }
}

// ─── State Validation Engine ─────────────────────────────────────────────────

function cmdStateValidate(cwd, options, raw) {
  const planningDir = path.join(cwd, '.planning');
  const roadmapPath = path.join(planningDir, 'ROADMAP.md');
  const statePath = path.join(planningDir, 'STATE.md');
  const phasesDir = path.join(planningDir, 'phases');

  const issues = [];
  const fixesApplied = [];

  const roadmapContent = safeReadFile(roadmapPath);
  const stateContent = safeReadFile(statePath);

  if (!roadmapContent && !stateContent) {
    output({
      status: 'errors',
      issues: [{ type: 'missing_files', location: '.planning/', expected: 'ROADMAP.md and STATE.md', actual: 'Neither found', severity: 'error' }],
      fixes_applied: [],
      summary: 'Found 1 error and 0 warnings',
    }, raw);
    return;
  }

  // ─── Check 1: Plan count drift (SVAL-01) ────────────────────────────────
  if (roadmapContent) {
    const phasePattern = /#{2,4}\s*Phase\s+(\d+(?:\.\d+)?)\s*:\s*([^\n]+)/gi;
    let phaseMatch;

    while ((phaseMatch = phasePattern.exec(roadmapContent)) !== null) {
      const phaseNum = phaseMatch[1];
      const normalized = normalizePhaseName(phaseNum);

      // Find the phase section to extract plan count claims
      const sectionStart = phaseMatch.index;
      const restOfContent = roadmapContent.slice(sectionStart);
      const nextHeader = restOfContent.match(/\n#{2,4}\s+Phase\s+\d/i);
      const sectionEnd = nextHeader ? sectionStart + nextHeader.index : roadmapContent.length;
      const section = roadmapContent.slice(sectionStart, sectionEnd);

      // Extract claimed plan count from "**Plans:** N/M plans" or "**Plans:** N plans"
      const plansMatch = section.match(/\*\*Plans:?\*\*:?\s*(?:(\d+)\/)?(\d+)\s*plan/i);
      const claimedPlanCount = plansMatch ? parseInt(plansMatch[2], 10) : null;
      const claimedSummaryCount = plansMatch && plansMatch[1] ? parseInt(plansMatch[1], 10) : null;

      // Count actual files on disk — use cached phase tree
      let diskPlanCount = 0;
      let diskSummaryCount = 0;
      let phaseDirName = null;

      const phaseTree = getPhaseTree(cwd);
      const cachedPhase = phaseTree.get(normalized);
      if (cachedPhase) {
        phaseDirName = cachedPhase.dirName;
        diskPlanCount = cachedPhase.plans.length;
        diskSummaryCount = cachedPhase.summaries.length;
      }

      // Compare plan count
      if (claimedPlanCount !== null && claimedPlanCount !== diskPlanCount && phaseDirName) {
        issues.push({
          type: 'plan_count_drift',
          location: `ROADMAP.md Phase ${phaseNum}`,
          expected: `${diskPlanCount} plans on disk`,
          actual: `ROADMAP claims ${claimedPlanCount} plans`,
          severity: 'error',
        });

        // Auto-fix if requested
        if (options.fix) {
          try {
            let updatedRoadmap = safeReadFile(roadmapPath) || roadmapContent;
            const phaseEscaped = phaseNum.replace(/\./g, '\\.');

            // Fix plan count in "**Plans:** X/Y plans" or "**Plans:** Y plans"
            const fixPattern = new RegExp(
              `(#{2,4}\\s*Phase\\s+${phaseEscaped}[\\s\\S]*?\\*\\*Plans:?\\*\\*:?\\s*)(?:\\d+\\/)?\\d+(\\s*plan)`,
              'i'
            );
            const fixMatch = updatedRoadmap.match(fixPattern);
            if (fixMatch) {
              const newText = claimedSummaryCount !== null
                ? `${fixMatch[1]}${diskSummaryCount}/${diskPlanCount}${fixMatch[2]}`
                : `${fixMatch[1]}${diskPlanCount}${fixMatch[2]}`;
              updatedRoadmap = updatedRoadmap.replace(fixPattern, newText);
              fs.writeFileSync(roadmapPath, updatedRoadmap, 'utf-8');

              // Auto-commit the fix
              execGit(cwd, ['add', roadmapPath]);
              execGit(cwd, ['commit', '-m', `fix(state): correct phase ${phaseNum} plan count ${claimedPlanCount} → ${diskPlanCount}`]);

              fixesApplied.push({
                phase: phaseNum,
                field: 'plan_count',
                old: String(claimedPlanCount),
                new: String(diskPlanCount),
              });
            }
          } catch (e) { debugLog('state.validate', 'auto-fix failed for phase ' + phaseNum, e); }
        }
      }

      // Compare completion status: checkbox checked but not all summaries present
      if (phaseDirName && diskPlanCount > 0) {
        const checkboxPattern = new RegExp(`-\\s*\\[x\\]\\s*.*Phase\\s+${phaseNum.replace(/\./g, '\\.')}`, 'i');
        const isMarkedComplete = checkboxPattern.test(roadmapContent);

        if (isMarkedComplete && diskSummaryCount < diskPlanCount) {
          issues.push({
            type: 'completion_drift',
            location: `ROADMAP.md Phase ${phaseNum}`,
            expected: `${diskPlanCount} summaries for completion`,
            actual: `${diskSummaryCount} summaries on disk`,
            severity: 'error',
          });
        }
      }
    }
  }

  // ─── Check 2: Position validation (SVAL-02) ─────────────────────────────
  if (stateContent) {
    const phaseFieldMatch = stateContent.match(/\*\*Phase:\*\*\s*(\d+(?:\.\d+)?)\s+of\s+(\d+)/i);
    if (phaseFieldMatch) {
      const currentPhaseNum = phaseFieldMatch[1];
      const phaseInfo = findPhaseInternal(cwd, currentPhaseNum);

      if (!phaseInfo) {
        issues.push({
          type: 'position_missing',
          location: 'STATE.md Phase field',
          expected: `Phase ${currentPhaseNum} directory exists`,
          actual: 'Phase directory not found',
          severity: 'error',
        });
      } else if (phaseInfo.plans.length > 0 && phaseInfo.summaries.length >= phaseInfo.plans.length) {
        issues.push({
          type: 'position_completed',
          location: 'STATE.md Phase field',
          expected: 'Active phase with incomplete plans',
          actual: `Phase ${currentPhaseNum} is fully complete (${phaseInfo.summaries.length}/${phaseInfo.plans.length})`,
          severity: 'warn',
        });
      }
    }
  }

  // ─── Check 3: Activity staleness (SVAL-03) ──────────────────────────────
  if (stateContent) {
    const activityMatch = stateContent.match(/\*\*Last Activity:\*\*\s*(\S+)/i);
    if (activityMatch) {
      const declaredDate = activityMatch[1];
      const declaredTime = new Date(declaredDate).getTime();

      // Get most recent .planning/ commit date
      const gitResult = execGit(cwd, ['log', '-1', '--format=%ci', '--', '.planning/']);
      if (gitResult.exitCode === 0 && gitResult.stdout) {
        const gitDate = gitResult.stdout.split(' ')[0]; // Extract YYYY-MM-DD from git date
        const gitTime = new Date(gitDate).getTime();

        // Stale if declared timestamp is >24 hours older than most recent git commit
        const dayMs = 24 * 60 * 60 * 1000;
        if (!isNaN(declaredTime) && !isNaN(gitTime) && (gitTime - declaredTime) > dayMs) {
          issues.push({
            type: 'activity_stale',
            location: 'STATE.md Last Activity',
            expected: `Recent date near ${gitDate}`,
            actual: `Declared ${declaredDate}`,
            severity: 'warn',
          });
        }
      }
    }
  }

  // ─── Check 5: Blocker/todo staleness (SVAL-05) ──────────────────────────
  if (stateContent) {
    const config = loadConfig(cwd);
    const stalenessThreshold = config.staleness_threshold || 2;

    // Count completed plans across all phases — use cached phase tree
    let totalCompletedPlans = 0;
    const phaseTreeForBlockers = getPhaseTree(cwd);
    for (const [, entry] of phaseTreeForBlockers) {
      totalCompletedPlans += entry.summaries.length;
    }

    // Check blockers section
    const blockerSection = stateContent.match(/###?\s*(?:Blockers|Blockers\/Concerns|Concerns)\s*\n([\s\S]*?)(?=\n###?|\n##[^#]|$)/i);
    if (blockerSection) {
      const blockerBody = blockerSection[1].trim();
      if (blockerBody && !/^none\.?$/i.test(blockerBody) && !/^none yet\.?$/i.test(blockerBody)) {
        const blockerLines = blockerBody.split('\n').filter(l => l.startsWith('- '));
        if (blockerLines.length > 0 && totalCompletedPlans >= stalenessThreshold) {
          for (const line of blockerLines) {
            issues.push({
              type: 'stale_blocker',
              location: 'STATE.md Blockers',
              expected: `Resolved within ${stalenessThreshold} completed plans`,
              actual: `"${line.slice(2).trim()}" still open after ${totalCompletedPlans} completed plans`,
              severity: 'warn',
            });
          }
        }
      }
    }

    // Check pending todos section
    const todoSection = stateContent.match(/###?\s*(?:Pending Todos|Todos|Open Todos)\s*\n([\s\S]*?)(?=\n###?|\n##[^#]|$)/i);
    if (todoSection) {
      const todoBody = todoSection[1].trim();
      if (todoBody && !/^none\.?$/i.test(todoBody) && !/^none yet\.?$/i.test(todoBody)) {
        const todoLines = todoBody.split('\n').filter(l => l.startsWith('- '));
        if (todoLines.length > 0 && totalCompletedPlans >= stalenessThreshold) {
          for (const line of todoLines) {
            issues.push({
              type: 'stale_todo',
              location: 'STATE.md Pending Todos',
              expected: `Resolved within ${stalenessThreshold} completed plans`,
              actual: `"${line.slice(2).trim()}" still open after ${totalCompletedPlans} completed plans`,
              severity: 'warn',
            });
          }
        }
      }
    }
  }

  // ─── Build result ───────────────────────────────────────────────────────
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warnCount = issues.filter(i => i.severity === 'warn').length;

  let status = 'clean';
  if (errorCount > 0) status = 'errors';
  else if (warnCount > 0) status = 'warnings';

  const summary = status === 'clean'
    ? 'State validation passed — no issues found'
    : `Found ${errorCount} error${errorCount !== 1 ? 's' : ''} and ${warnCount} warning${warnCount !== 1 ? 's' : ''}`;

  output({
    status,
    issues,
    fixes_applied: fixesApplied,
    summary,
  }, raw);
}

module.exports = {
  cmdStateLoad,
  cmdStateGet,
  cmdStatePatch,
  cmdStateUpdate,
  stateExtractField,
  stateReplaceField,
  cmdStateAdvancePlan,
  cmdStateRecordMetric,
  cmdStateUpdateProgress,
  cmdStateAddDecision,
  cmdStateAddBlocker,
  cmdStateResolveBlocker,
  cmdStateRecordSession,
  cmdStateValidate,
};
