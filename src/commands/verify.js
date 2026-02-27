'use strict';

const fs = require('fs');
const path = require('path');
const { output, error, debugLog } = require('../lib/output');
const { safeReadFile, cachedReadFile, findPhaseInternal, normalizePhaseName, parseMustHavesBlock, getArchivedPhaseDirs, getMilestoneInfo, getPhaseTree } = require('../lib/helpers');
const { extractFrontmatter } = require('../lib/frontmatter');
const { execGit } = require('../lib/git');
const { banner, sectionHeader, formatTable, summaryLine, color, SYMBOLS, colorByPercent, progressBar, box } = require('../lib/format');

function cmdVerifyPlanStructure(cwd, filePath, raw) {
  if (!filePath) { error('file path required'); }
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  const content = safeReadFile(fullPath);
  if (!content) { output({ error: 'File not found', path: filePath }, raw); return; }

  const fm = extractFrontmatter(content);
  const errors = [];
  const warnings = [];

  // Check required frontmatter fields
  const required = ['phase', 'plan', 'type', 'wave', 'depends_on', 'files_modified', 'autonomous', 'must_haves'];
  for (const field of required) {
    if (fm[field] === undefined) errors.push(`Missing required frontmatter field: ${field}`);
  }

  // Parse and check task elements
  const taskPattern = /<task[^>]*>([\s\S]*?)<\/task>/g;
  const tasks = [];
  let taskMatch;
  while ((taskMatch = taskPattern.exec(content)) !== null) {
    const taskContent = taskMatch[1];
    const nameMatch = taskContent.match(/<name>([\s\S]*?)<\/name>/);
    const taskName = nameMatch ? nameMatch[1].trim() : 'unnamed';
    const hasFiles = /<files>/.test(taskContent);
    const hasAction = /<action>/.test(taskContent);
    const hasVerify = /<verify>/.test(taskContent);
    const hasDone = /<done>/.test(taskContent);

    if (!nameMatch) errors.push('Task missing <name> element');
    if (!hasAction) errors.push(`Task '${taskName}' missing <action>`);
    if (!hasVerify) warnings.push(`Task '${taskName}' missing <verify>`);
    if (!hasDone) warnings.push(`Task '${taskName}' missing <done>`);
    if (!hasFiles) warnings.push(`Task '${taskName}' missing <files>`);

    tasks.push({ name: taskName, hasFiles, hasAction, hasVerify, hasDone });
  }

  if (tasks.length === 0) warnings.push('No <task> elements found');

  // Wave/depends_on consistency
  if (fm.wave && parseInt(fm.wave) > 1 && (!fm.depends_on || (Array.isArray(fm.depends_on) && fm.depends_on.length === 0))) {
    warnings.push('Wave > 1 but depends_on is empty');
  }

  // Autonomous/checkpoint consistency
  const hasCheckpoints = /<task\s+type=["']?checkpoint/.test(content);
  if (hasCheckpoints && fm.autonomous !== 'false' && fm.autonomous !== false) {
    errors.push('Has checkpoint tasks but autonomous is not false');
  }

  // Template compliance checks
  const templateCompliance = { valid: true, missing_fields: [], type_issues: [] };
  const planType = fm.type || 'execute';

  // Required fields by plan type
  const typeRequiredFields = {
    execute: ['wave', 'depends_on', 'files_modified', 'autonomous', 'requirements', 'must_haves'],
    tdd: ['wave', 'depends_on', 'files_modified', 'autonomous', 'requirements'],
  };

  const requiredForType = typeRequiredFields[planType] || typeRequiredFields.execute;
  for (const field of requiredForType) {
    if (fm[field] === undefined) {
      templateCompliance.missing_fields.push(field);
    }
  }

  // Check requirements is non-empty
  if (fm.requirements !== undefined) {
    const reqEmpty = (Array.isArray(fm.requirements) && fm.requirements.length === 0) ||
                     (typeof fm.requirements === 'string' && fm.requirements.trim() === '') ||
                     (typeof fm.requirements === 'object' && !Array.isArray(fm.requirements) && Object.keys(fm.requirements).length === 0);
    if (reqEmpty) {
      templateCompliance.type_issues.push('requirements is empty — every plan should map to requirements');
    }
  }

  // TDD type: check for <feature> block
  if (planType === 'tdd') {
    if (!/<feature>/.test(content)) {
      templateCompliance.type_issues.push('TDD plan missing <feature> block');
    }
  }

  // Check task elements have required sub-elements
  for (const task of tasks) {
    if (!task.hasAction) templateCompliance.type_issues.push(`Task '${task.name}' missing <action>`);
    if (!task.hasVerify) templateCompliance.type_issues.push(`Task '${task.name}' missing <verify>`);
    if (!task.hasDone) templateCompliance.type_issues.push(`Task '${task.name}' missing <done>`);
  }

  if (templateCompliance.missing_fields.length > 0 || templateCompliance.type_issues.length > 0) {
    templateCompliance.valid = false;
  }

  output({
    valid: errors.length === 0,
    errors,
    warnings,
    task_count: tasks.length,
    tasks,
    frontmatter_fields: Object.keys(fm),
    template_compliance: templateCompliance,
  }, raw, errors.length === 0 ? 'valid' : 'invalid');
}

function cmdVerifyPhaseCompleteness(cwd, phase, raw) {
  if (!phase) { error('phase required'); }
  const phaseInfo = findPhaseInternal(cwd, phase);
  if (!phaseInfo || !phaseInfo.found) {
    output({ error: 'Phase not found', phase }, raw);
    return;
  }

  const errors = [];
  const warnings = [];
  const phaseDir = path.join(cwd, phaseInfo.directory);

  // List plans and summaries
  let files;
  try { files = fs.readdirSync(phaseDir); } catch (e) { debugLog('verify.phaseComplete', 'readdir phase failed', e); output({ error: 'Cannot read phase directory' }, raw); return; }

  const plans = files.filter(f => f.match(/-PLAN\.md$/i));
  const summaries = files.filter(f => f.match(/-SUMMARY\.md$/i));

  // Extract plan IDs (everything before -PLAN.md)
  const planIds = new Set(plans.map(p => p.replace(/-PLAN\.md$/i, '')));
  const summaryIds = new Set(summaries.map(s => s.replace(/-SUMMARY\.md$/i, '')));

  // Plans without summaries
  const incompletePlans = [...planIds].filter(id => !summaryIds.has(id));
  if (incompletePlans.length > 0) {
    errors.push(`Plans without summaries: ${incompletePlans.join(', ')}`);
  }

  // Summaries without plans (orphans)
  const orphanSummaries = [...summaryIds].filter(id => !planIds.has(id));
  if (orphanSummaries.length > 0) {
    warnings.push(`Summaries without plans: ${orphanSummaries.join(', ')}`);
  }

  output({
    complete: errors.length === 0,
    phase: phaseInfo.phase_number,
    plan_count: plans.length,
    summary_count: summaries.length,
    incomplete_plans: incompletePlans,
    orphan_summaries: orphanSummaries,
    errors,
    warnings,
  }, raw, errors.length === 0 ? 'complete' : 'incomplete');
}

function cmdVerifyReferences(cwd, filePath, raw) {
  if (!filePath) { error('file path required'); }
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  const content = safeReadFile(fullPath);
  if (!content) { output({ error: 'File not found', path: filePath }, raw); return; }

  const found = [];
  const missing = [];

  // Find @-references: @path/to/file (must contain / to be a file path)
  const atRefs = content.match(/@([^\s\n,)]+\/[^\s\n,)]+)/g) || [];
  for (const ref of atRefs) {
    const cleanRef = ref.slice(1); // remove @
    const resolved = cleanRef.startsWith('~/')
      ? path.join(process.env.HOME || '', cleanRef.slice(2))
      : path.join(cwd, cleanRef);
    if (fs.existsSync(resolved)) {
      found.push(cleanRef);
    } else {
      missing.push(cleanRef);
    }
  }

  // Find backtick file paths that look like real paths (contain / and have extension)
  const backtickRefs = content.match(/`([^`]+\/[^`]+\.[a-zA-Z]{1,10})`/g) || [];
  for (const ref of backtickRefs) {
    const cleanRef = ref.slice(1, -1); // remove backticks
    if (cleanRef.startsWith('http') || cleanRef.includes('${') || cleanRef.includes('{{')) continue;
    if (found.includes(cleanRef) || missing.includes(cleanRef)) continue; // dedup
    const resolved = path.join(cwd, cleanRef);
    if (fs.existsSync(resolved)) {
      found.push(cleanRef);
    } else {
      missing.push(cleanRef);
    }
  }

  output({
    valid: missing.length === 0,
    found: found.length,
    missing,
    total: found.length + missing.length,
  }, raw, missing.length === 0 ? 'valid' : 'invalid');
}

function cmdVerifyCommits(cwd, hashes, raw) {
  if (!hashes || hashes.length === 0) { error('At least one commit hash required'); }

  const valid = [];
  const invalid = [];
  for (const hash of hashes) {
    const result = execGit(cwd, ['cat-file', '-t', hash]);
    if (result.exitCode === 0 && result.stdout.trim() === 'commit') {
      valid.push(hash);
    } else {
      invalid.push(hash);
    }
  }

  output({
    all_valid: invalid.length === 0,
    valid,
    invalid,
    total: hashes.length,
  }, raw, invalid.length === 0 ? 'valid' : 'invalid');
}

function cmdVerifyArtifacts(cwd, planFilePath, raw) {
  if (!planFilePath) { error('plan file path required'); }
  const fullPath = path.isAbsolute(planFilePath) ? planFilePath : path.join(cwd, planFilePath);
  const content = safeReadFile(fullPath);
  if (!content) { output({ error: 'File not found', path: planFilePath }, raw); return; }

  const artifacts = parseMustHavesBlock(content, 'artifacts');
  if (artifacts.length === 0) {
    output({ error: 'No must_haves.artifacts found in frontmatter', path: planFilePath }, raw);
    return;
  }

  const results = [];
  for (const artifact of artifacts) {
    if (typeof artifact === 'string') continue; // skip simple string items
    const artPath = artifact.path;
    if (!artPath) continue;

    const artFullPath = path.join(cwd, artPath);
    const exists = fs.existsSync(artFullPath);
    const check = { path: artPath, exists, issues: [], passed: false };

    if (exists) {
      const fileContent = safeReadFile(artFullPath) || '';
      const lineCount = fileContent.split('\n').length;

      if (artifact.min_lines && lineCount < artifact.min_lines) {
        check.issues.push(`Only ${lineCount} lines, need ${artifact.min_lines}`);
      }
      if (artifact.contains && !fileContent.includes(artifact.contains)) {
        check.issues.push(`Missing pattern: ${artifact.contains}`);
      }
      if (artifact.exports) {
        const exports = Array.isArray(artifact.exports) ? artifact.exports : [artifact.exports];
        for (const exp of exports) {
          if (!fileContent.includes(exp)) check.issues.push(`Missing export: ${exp}`);
        }
      }
      check.passed = check.issues.length === 0;
    } else {
      check.issues.push('File not found');
    }

    results.push(check);
  }

  const passed = results.filter(r => r.passed).length;
  output({
    all_passed: passed === results.length,
    passed,
    total: results.length,
    artifacts: results,
  }, raw, passed === results.length ? 'valid' : 'invalid');
}

function cmdVerifyKeyLinks(cwd, planFilePath, raw) {
  if (!planFilePath) { error('plan file path required'); }
  const fullPath = path.isAbsolute(planFilePath) ? planFilePath : path.join(cwd, planFilePath);
  const content = safeReadFile(fullPath);
  if (!content) { output({ error: 'File not found', path: planFilePath }, raw); return; }

  const keyLinks = parseMustHavesBlock(content, 'key_links');
  if (keyLinks.length === 0) {
    output({ error: 'No must_haves.key_links found in frontmatter', path: planFilePath }, raw);
    return;
  }

  const results = [];
  for (const link of keyLinks) {
    if (typeof link === 'string') continue;
    const check = { from: link.from, to: link.to, via: link.via || '', verified: false, detail: '' };

    const sourceContent = safeReadFile(path.join(cwd, link.from || ''));
    if (!sourceContent) {
      check.detail = 'Source file not found';
    } else if (link.pattern) {
      try {
        const regex = new RegExp(link.pattern);
        if (regex.test(sourceContent)) {
          check.verified = true;
          check.detail = 'Pattern found in source';
        } else {
          const targetContent = safeReadFile(path.join(cwd, link.to || ''));
          if (targetContent && regex.test(targetContent)) {
            check.verified = true;
            check.detail = 'Pattern found in target';
          } else {
            check.detail = `Pattern "${link.pattern}" not found in source or target`;
          }
        }
      } catch (e) {
        debugLog('verify.keyLinks', 'read failed', e);
        check.detail = `Invalid regex pattern: ${link.pattern}`;
      }
    } else {
      // No pattern: just check source references target
      if (sourceContent.includes(link.to || '')) {
        check.verified = true;
        check.detail = 'Target referenced in source';
      } else {
        check.detail = 'Target not referenced in source';
      }
    }

    results.push(check);
  }

  const verified = results.filter(r => r.verified).length;
  output({
    all_verified: verified === results.length,
    verified,
    total: results.length,
    links: results,
  }, raw, verified === results.length ? 'valid' : 'invalid');
}

function cmdValidateConsistency(cwd, raw) {
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const errors = [];
  const warnings = [];

  // Check for ROADMAP
  const roadmapContent = cachedReadFile(roadmapPath);
  if (!roadmapContent) {
    errors.push('ROADMAP.md not found');
    output({ passed: false, errors, warnings }, raw, 'failed');
    return;
  }

  // Extract phases from ROADMAP
  const roadmapPhases = new Set();
  const phasePattern = /#{2,4}\s*Phase\s+(\d+(?:\.\d+)?)\s*:/gi;
  let m;
  while ((m = phasePattern.exec(roadmapContent)) !== null) {
    roadmapPhases.add(m[1]);
  }

  // Get phases on disk — single cached scan instead of 3 separate readdirSync
  const phaseTree = getPhaseTree(cwd);
  const diskPhases = new Set();
  for (const [, entry] of phaseTree) {
    diskPhases.add(entry.phaseNumber);
  }

  // Check: phases in ROADMAP but not on disk
  for (const p of roadmapPhases) {
    if (!diskPhases.has(p) && !diskPhases.has(normalizePhaseName(p))) {
      warnings.push(`Phase ${p} in ROADMAP.md but no directory on disk`);
    }
  }

  // Check: phases on disk but not in ROADMAP
  for (const p of diskPhases) {
    const unpadded = String(parseInt(p, 10));
    if (!roadmapPhases.has(p) && !roadmapPhases.has(unpadded)) {
      warnings.push(`Phase ${p} exists on disk but not in ROADMAP.md`);
    }
  }

  // Check: sequential phase numbers (integers only)
  const integerPhases = [...diskPhases]
    .filter(p => !p.includes('.'))
    .map(p => parseInt(p, 10))
    .sort((a, b) => a - b);

  for (let i = 1; i < integerPhases.length; i++) {
    if (integerPhases[i] !== integerPhases[i - 1] + 1) {
      warnings.push(`Gap in phase numbering: ${integerPhases[i - 1]} → ${integerPhases[i]}`);
    }
  }

  // Check: plan numbering + orphan summaries + frontmatter — all from cached tree
  for (const [, entry] of phaseTree) {
    const plans = entry.plans;
    const summaries = entry.summaries;

    // Extract plan numbers
    const planNums = plans.map(p => {
      const pm = p.match(/-(\d{2})-PLAN\.md$/);
      return pm ? parseInt(pm[1], 10) : null;
    }).filter(n => n !== null);

    for (let i = 1; i < planNums.length; i++) {
      if (planNums[i] !== planNums[i - 1] + 1) {
        warnings.push(`Gap in plan numbering in ${entry.dirName}: plan ${planNums[i - 1]} → ${planNums[i]}`);
      }
    }

    // Summary without matching plan is suspicious
    const planIds = new Set(plans.map(p => p.replace('-PLAN.md', '')));
    const summaryIds = new Set(summaries.map(s => s.replace('-SUMMARY.md', '')));
    for (const sid of summaryIds) {
      if (!planIds.has(sid)) {
        warnings.push(`Summary ${sid}-SUMMARY.md in ${entry.dirName} has no matching PLAN.md`);
      }
    }

    // Check: frontmatter in plans has required fields
    for (const plan of plans) {
      const content = cachedReadFile(path.join(entry.fullPath, plan));
      if (!content) continue;
      const fm = extractFrontmatter(content);
      if (!fm.wave) {
        warnings.push(`${entry.dirName}/${plan}: missing 'wave' in frontmatter`);
      }
    }
  }

  const passed = errors.length === 0;
  output({ passed, errors, warnings, warning_count: warnings.length }, raw, passed ? 'passed' : 'failed');
}

function cmdValidateHealth(cwd, options, raw) {
  const planningDir = path.join(cwd, '.planning');
  const projectPath = path.join(planningDir, 'PROJECT.md');
  const roadmapPath = path.join(planningDir, 'ROADMAP.md');
  const statePath = path.join(planningDir, 'STATE.md');
  const configPath = path.join(planningDir, 'config.json');
  const phasesDir = path.join(planningDir, 'phases');

  const errors = [];
  const warnings = [];
  const info = [];
  const repairs = [];

  // Helper to add issue
  const addIssue = (severity, code, message, fix, repairable = false) => {
    const issue = { code, message, fix, repairable };
    if (severity === 'error') errors.push(issue);
    else if (severity === 'warning') warnings.push(issue);
    else info.push(issue);
  };

  // Check 1: .planning/ exists
  if (!fs.existsSync(planningDir)) {
    addIssue('error', 'E001', '.planning/ directory not found', 'Run /gsd:new-project to initialize');
    output({
      status: 'broken',
      errors,
      warnings,
      info,
      repairable_count: 0,
    }, raw);
    return;
  }

  // Check 2: PROJECT.md exists and has required sections
  const projectContent = cachedReadFile(projectPath);
  if (!projectContent) {
    addIssue('error', 'E002', 'PROJECT.md not found', 'Run /gsd:new-project to create');
  } else {
    const requiredSections = ['## What This Is', '## Core Value', '## Requirements'];
    for (const section of requiredSections) {
      if (!projectContent.includes(section)) {
        addIssue('warning', 'W001', `PROJECT.md missing section: ${section}`, 'Add section manually');
      }
    }
  }

  // Check 3: ROADMAP.md exists
  if (!fs.existsSync(roadmapPath)) {
    addIssue('error', 'E003', 'ROADMAP.md not found', 'Run /gsd:new-milestone to create roadmap');
  }

  // Check 4: STATE.md exists and references valid phases
  const stateContent = cachedReadFile(statePath);
  if (!stateContent) {
    addIssue('error', 'E004', 'STATE.md not found', 'Run /gsd:health --repair to regenerate', true);
    repairs.push('regenerateState');
  } else {
    const phaseRefs = [...stateContent.matchAll(/[Pp]hase\s+(\d+(?:\.\d+)?)/g)].map(m => m[1]);
    // Use cached phase tree instead of separate readdirSync
    const phaseTree = getPhaseTree(cwd);
    const diskPhases = new Set();
    for (const [, entry] of phaseTree) {
      diskPhases.add(entry.phaseNumber);
    }
    for (const ref of phaseRefs) {
      const normalizedRef = String(parseInt(ref, 10)).padStart(2, '0');
      if (!diskPhases.has(ref) && !diskPhases.has(normalizedRef) && !diskPhases.has(String(parseInt(ref, 10)))) {
        if (diskPhases.size > 0) {
          addIssue('warning', 'W002', `STATE.md references phase ${ref}, but only phases ${[...diskPhases].sort().join(', ')} exist`, 'Run /gsd:health --repair to regenerate STATE.md', true);
          if (!repairs.includes('regenerateState')) repairs.push('regenerateState');
        }
      }
    }
  }

  // Check 5: config.json valid JSON + valid schema
  const configContent = cachedReadFile(configPath);
  if (!configContent) {
    addIssue('warning', 'W003', 'config.json not found', 'Run /gsd:health --repair to create with defaults', true);
    repairs.push('createConfig');
  } else {
    try {
      const parsed = JSON.parse(configContent);
      const validProfiles = ['quality', 'balanced', 'budget'];
      if (parsed.model_profile && !validProfiles.includes(parsed.model_profile)) {
        addIssue('warning', 'W004', `config.json: invalid model_profile "${parsed.model_profile}"`, `Valid values: ${validProfiles.join(', ')}`);
      }
    } catch (err) {
      debugLog('validate.health', 'JSON parse failed', err);
      addIssue('error', 'E005', `config.json: JSON parse error - ${err.message}`, 'Run /gsd:health --repair to reset to defaults', true);
      repairs.push('resetConfig');
    }
  }

  // Check 6 & 7: Phase directory naming + orphaned plans — use cached phase tree
  const healthPhaseTree = getPhaseTree(cwd);
  for (const [, entry] of healthPhaseTree) {
    // Check 6: Phase directory naming (NN-name format)
    if (!entry.dirName.match(/^\d{2}(?:\.\d+)?-[\w-]+$/)) {
      addIssue('warning', 'W005', `Phase directory "${entry.dirName}" doesn't follow NN-name format`, 'Rename to match pattern (e.g., 01-setup)');
    }

    // Check 7: Orphaned plans (PLAN without SUMMARY)
    const summaryBases = new Set(entry.summaries.map(s => s.replace('-SUMMARY.md', '').replace('SUMMARY.md', '')));
    for (const plan of entry.plans) {
      const planBase = plan.replace('-PLAN.md', '').replace('PLAN.md', '');
      if (!summaryBases.has(planBase)) {
        addIssue('info', 'I001', `${entry.dirName}/${plan} has no SUMMARY.md`, 'May be in progress');
      }
    }
  }

  // Check 8: Run existing consistency checks
  if (fs.existsSync(roadmapPath)) {
    const roadmapContent = fs.readFileSync(roadmapPath, 'utf-8');
    const roadmapPhases = new Set();
    const phasePattern = /#{2,4}\s*Phase\s+(\d+(?:\.\d+)?)\s*:/gi;
    let m;
    while ((m = phasePattern.exec(roadmapContent)) !== null) {
      roadmapPhases.add(m[1]);
    }

    const diskPhases = new Set();
    try {
      const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory()) {
          const dm = e.name.match(/^(\d+(?:\.\d+)?)/);
          if (dm) diskPhases.add(dm[1]);
        }
      }
    } catch (e) { debugLog('validate.health', 'readdir failed', e); }

    for (const p of roadmapPhases) {
      const padded = String(parseInt(p, 10)).padStart(2, '0');
      if (!diskPhases.has(p) && !diskPhases.has(padded)) {
        addIssue('warning', 'W006', `Phase ${p} in ROADMAP.md but no directory on disk`, 'Create phase directory or remove from roadmap');
      }
    }

    for (const p of diskPhases) {
      const unpadded = String(parseInt(p, 10));
      if (!roadmapPhases.has(p) && !roadmapPhases.has(unpadded)) {
        addIssue('warning', 'W007', `Phase ${p} exists on disk but not in ROADMAP.md`, 'Add to roadmap or remove directory');
      }
    }
  }

  // Perform repairs if requested
  const repairActions = [];
  if (options.repair && repairs.length > 0) {
    for (const repair of repairs) {
      try {
        switch (repair) {
          case 'createConfig':
          case 'resetConfig': {
            const defaults = {
              model_profile: 'balanced',
              commit_docs: true,
              search_gitignored: false,
              branching_strategy: 'none',
              research: true,
              plan_checker: true,
              verifier: true,
              parallelization: true,
            };
            fs.writeFileSync(configPath, JSON.stringify(defaults, null, 2), 'utf-8');
            repairActions.push({ action: repair, success: true, path: 'config.json' });
            break;
          }
          case 'regenerateState': {
            if (fs.existsSync(statePath)) {
              const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
              const backupPath = `${statePath}.bak-${timestamp}`;
              fs.copyFileSync(statePath, backupPath);
              repairActions.push({ action: 'backupState', success: true, path: backupPath });
            }
            const milestone = getMilestoneInfo(cwd);
            let stateContent = `# Session State\n\n`;
            stateContent += `## Project Reference\n\n`;
            stateContent += `See: .planning/PROJECT.md\n\n`;
            stateContent += `## Position\n\n`;
            stateContent += `**Milestone:** ${milestone.version} ${milestone.name}\n`;
            stateContent += `**Current phase:** (determining...)\n`;
            stateContent += `**Status:** Resuming\n\n`;
            stateContent += `## Session Log\n\n`;
            stateContent += `- ${new Date().toISOString().split('T')[0]}: STATE.md regenerated by /gsd:health --repair\n`;
            fs.writeFileSync(statePath, stateContent, 'utf-8');
            repairActions.push({ action: repair, success: true, path: 'STATE.md' });
            break;
          }
        }
      } catch (err) {
        debugLog('validate.health', 'write failed', err);
        repairActions.push({ action: repair, success: false, error: err.message });
      }
    }
  }

  // Determine overall status
  let status;
  if (errors.length > 0) {
    status = 'broken';
  } else if (warnings.length > 0) {
    status = 'degraded';
  } else {
    status = 'healthy';
  }

  const repairableCount = errors.filter(e => e.repairable).length +
                         warnings.filter(w => w.repairable).length;

  output({
    status,
    errors,
    warnings,
    info,
    repairable_count: repairableCount,
    repairs_performed: repairActions.length > 0 ? repairActions : undefined,
  }, raw);
}

function cmdAnalyzePlan(cwd, planPath, raw) {
  if (!planPath) { error('plan file path required'); }
  const fullPath = path.isAbsolute(planPath) ? planPath : path.join(cwd, planPath);
  const content = safeReadFile(fullPath);
  if (!content) { output({ error: 'File not found', path: planPath }, raw); return; }

  const fm = extractFrontmatter(content);

  // Derive plan identifier from frontmatter or filename
  const planId = (fm.phase && fm.plan)
    ? `${String(fm.phase).replace(/^0+/, '')}-${String(fm.plan).replace(/^0+/, '').padStart(2, '0')}`
    : path.basename(planPath, '.md').replace(/-PLAN$/i, '');

  // Parse task blocks
  const taskPattern = /<task[^>]*>([\s\S]*?)<\/task>/g;
  const tasks = [];
  let taskMatch;
  while ((taskMatch = taskPattern.exec(content)) !== null) {
    const taskContent = taskMatch[1];
    const nameMatch = taskContent.match(/<name>([\s\S]*?)<\/name>/);
    const filesMatch = taskContent.match(/<files>([\s\S]*?)<\/files>/);
    const taskName = nameMatch ? nameMatch[1].trim() : 'unnamed';
    const taskFiles = filesMatch
      ? filesMatch[1].split('\n').map(f => f.trim()).filter(f => f.length > 0)
      : [];
    tasks.push({ name: taskName, files: taskFiles });
  }

  // Collect all files and directories
  const allFiles = [];
  const dirSet = new Set();
  for (const task of tasks) {
    for (const file of task.files) {
      allFiles.push(file);
      const dir = path.dirname(file);
      dirSet.add(dir === '.' ? '(root)' : dir);
    }
  }

  // Extract directories per task for concern grouping
  const taskDirs = tasks.map(t => {
    const dirs = new Set();
    for (const f of t.files) {
      const dir = path.dirname(f);
      dirs.add(dir === '.' ? '(root)' : dir);
    }
    return dirs;
  });

  // Union-find for concern clustering
  const parent = tasks.map((_, i) => i);
  function find(x) {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  }
  function union(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  // Merge tasks that share any directory
  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      for (const dir of taskDirs[i]) {
        if (taskDirs[j].has(dir)) {
          union(i, j);
          break;
        }
      }
    }
  }

  // Build concern groups
  const groups = {};
  for (let i = 0; i < tasks.length; i++) {
    const root = find(i);
    if (!groups[root]) groups[root] = { tasks: [], files: new Set(), dirs: new Set() };
    groups[root].tasks.push(tasks[i].name);
    for (const f of tasks[i].files) groups[root].files.add(f);
    for (const d of taskDirs[i]) groups[root].dirs.add(d);
  }

  const concerns = Object.values(groups).map((g, idx) => {
    const dirsArr = [...g.dirs];
    // Derive area label from most common directory prefix
    const area = dirsArr.length > 0
      ? dirsArr[0].split('/').filter(s => s !== '(root)')[0] || '(root)'
      : '(none)';
    return {
      group: idx + 1,
      tasks: g.tasks,
      files: [...g.files],
      area,
    };
  });

  const concernCount = concerns.length;
  const taskCount = tasks.length;
  const dirCount = dirSet.size;

  // SR scoring
  let base = 5;
  if (concernCount > 1) base -= 1;
  if (concernCount > 2) base -= 1;
  if (concernCount > 3) base -= 1;
  if (taskCount > 3) base -= 1;
  if (taskCount > 5) base -= 1;
  const srScore = Math.max(1, Math.min(5, base));

  const labels = { 5: 'Excellent', 4: 'Good', 3: 'Acceptable', 2: 'Poor', 1: 'Bad' };
  const srLabel = labels[srScore];

  // Split suggestions for score <= 3
  let splitSuggestion = null;
  if (srScore <= 3 && concernCount > 1) {
    splitSuggestion = {
      recommended_splits: concernCount,
      proposed_plans: concerns.map((c, idx) => ({
        plan_suffix: String(idx + 1).padStart(2, '0'),
        area: c.area,
        tasks: c.tasks,
        files: c.files,
      })),
    };
  }

  // Flags for notable conditions
  const flags = [];
  if (taskCount === 0) flags.push('no_tasks_found');
  if (dirCount > 5) flags.push('high_directory_spread');
  if (concernCount > 3) flags.push('many_concerns');

  output({
    plan: planId,
    sr_score: srScore,
    sr_label: srLabel,
    concern_count: concernCount,
    concerns,
    task_count: taskCount,
    files_total: allFiles.length,
    directories_touched: dirCount,
    split_suggestion: splitSuggestion,
    flags,
  }, raw);
}

// ─── Verify Deliverables (VRFY-01) ──────────────────────────────────────────

function cmdVerifyDeliverables(cwd, options, raw) {
  const { execSync } = require('child_process');
  const { loadConfig } = require('../lib/config');

  let testCommand = null;
  let framework = null;

  // Check config for test_commands override
  const config = loadConfig(cwd);
  if (config.test_commands && typeof config.test_commands === 'object') {
    const keys = Object.keys(config.test_commands);
    if (keys.length > 0) {
      framework = keys[0];
      testCommand = config.test_commands[framework];
    }
  }

  // Auto-detect test framework if no config override
  if (!testCommand) {
    if (fs.existsSync(path.join(cwd, 'package.json'))) {
      framework = 'npm';
      testCommand = 'npm test';
    } else if (fs.existsSync(path.join(cwd, 'mix.exs'))) {
      framework = 'mix';
      testCommand = 'mix test';
    } else if (fs.existsSync(path.join(cwd, 'go.mod'))) {
      framework = 'go';
      testCommand = 'go test ./...';
    }
  }

  if (!testCommand) {
    output({
      test_result: 'skip',
      tests_passed: 0,
      tests_failed: 0,
      tests_total: 0,
      framework: null,
      verdict: 'skip',
      reason: 'No test framework detected',
    }, raw, 'skip');
    return;
  }

  let testOutput = '';
  let testExitCode = 0;
  try {
    testOutput = execSync(testCommand, {
      cwd,
      encoding: 'utf-8',
      timeout: 60000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    testExitCode = err.status || 1;
    testOutput = (err.stdout || '') + '\n' + (err.stderr || '');
  }

  // Parse test output for results
  let testsPassed = 0;
  let testsFailed = 0;
  let testsTotal = 0;

  // Common patterns across frameworks
  // Handles: "258 passing", "pass 258", "ℹ pass 258"
  const passMatch = testOutput.match(/(\d+)\s+pass(?:ing|ed)?/i) || testOutput.match(/pass\s+(\d+)/i);
  const failMatch = testOutput.match(/(\d+)\s+fail(?:ing|ed|ure)?/i) || testOutput.match(/fail\s+(\d+)/i);
  const totalMatch = testOutput.match(/(?:tests?|suites?)\s+(\d+)/i) || testOutput.match(/(\d+)\s+tests?/i);

  if (passMatch) testsPassed = parseInt(passMatch[1], 10);
  if (failMatch) testsFailed = parseInt(failMatch[1], 10);
  if (totalMatch) testsTotal = parseInt(totalMatch[1], 10);

  // If we got pass/fail but no total, compute it
  if (testsTotal === 0 && (testsPassed > 0 || testsFailed > 0)) {
    testsTotal = testsPassed + testsFailed;
  }

  const testResult = testExitCode === 0 ? 'pass' : 'fail';

  // If plan provided, verify artifacts and key_links too
  let artifactsOk = true;
  let keyLinksOk = true;
  if (options && options.plan) {
    const planPath = path.isAbsolute(options.plan) ? options.plan : path.join(cwd, options.plan);
    const planContent = safeReadFile(planPath);
    if (planContent) {
      const artifacts = parseMustHavesBlock(planContent, 'artifacts');
      if (artifacts.length > 0) {
        for (const artifact of artifacts) {
          if (typeof artifact === 'string') continue;
          const artPath = artifact.path;
          if (!artPath) continue;
          if (!fs.existsSync(path.join(cwd, artPath))) {
            artifactsOk = false;
            break;
          }
        }
      }

      const keyLinks = parseMustHavesBlock(planContent, 'key_links');
      if (keyLinks.length > 0) {
        for (const link of keyLinks) {
          if (typeof link === 'string') continue;
          const sourceContent = safeReadFile(path.join(cwd, link.from || ''));
          if (!sourceContent) {
            keyLinksOk = false;
            break;
          }
        }
      }
    }
  }

  const verdict = testResult === 'pass' && artifactsOk && keyLinksOk ? 'pass' : 'fail';

  output({
    test_result: testResult,
    tests_passed: testsPassed,
    tests_failed: testsFailed,
    tests_total: testsTotal,
    framework,
    artifacts_ok: artifactsOk,
    key_links_ok: keyLinksOk,
    verdict,
  }, raw, verdict);
}

// ─── Verify Requirements Formatter ──────────────────────────────────────────

function formatVerifyRequirements(result) {
  const lines = [];
  lines.push(banner('Requirements'));
  lines.push('');

  if (result.error) {
    lines.push(box(result.error, 'warning'));
    return lines.join('\n');
  }

  const addressedPercent = result.total > 0 ? Math.round((result.addressed / result.total) * 100) : 0;
  lines.push(`  ${result.addressed}/${result.total} requirements addressed`);
  lines.push('  ' + progressBar(addressedPercent));
  lines.push('');

  // Unaddressed requirements table
  if (result.unaddressed_list && result.unaddressed_list.length > 0) {
    lines.push(sectionHeader('Unaddressed'));
    lines.push('');
    const rows = result.unaddressed_list.map(u => [
      SYMBOLS.cross + ' ' + u.id,
      u.phase ? 'Phase ' + u.phase : color.dim('n/a'),
      u.reason || '',
    ]);
    lines.push(formatTable(['ID', 'Phase', 'Reason'], rows));
    lines.push('');
  }

  // Assertions summary
  if (result.assertions) {
    const a = result.assertions;
    lines.push(sectionHeader('Assertions'));
    lines.push('');
    const passStr = color.green(a.verified + ' pass');
    const failStr = a.failed > 0 ? color.red(a.failed + ' fail') : color.dim(a.failed + ' fail');
    const humanStr = a.needs_human > 0 ? color.yellow(a.needs_human + ' needs human') : color.dim(a.needs_human + ' needs human');
    lines.push('  ' + passStr + ', ' + failStr + ', ' + humanStr);
    lines.push('');
  }

  // Summary line
  if (result.addressed === result.total) {
    lines.push(summaryLine(SYMBOLS.check + ' All requirements addressed'));
  } else {
    lines.push(summaryLine(result.unaddressed + ' requirements need attention'));
  }

  return lines.join('\n');
}

// ─── Verify Requirements (VRFY-02) ─────────────────────────────────────────

function cmdVerifyRequirements(cwd, options, raw) {
  const reqPath = path.join(cwd, '.planning', 'REQUIREMENTS.md');
  const content = safeReadFile(reqPath);
  if (!content) {
    output({
      total: 0,
      addressed: 0,
      unaddressed: 0,
      unaddressed_list: [],
      error: 'REQUIREMENTS.md not found',
    }, raw, 'skip');
    return;
  }

  // Parse requirement lines: - [x] **REQ-01** or - [ ] **REQ-01**
  const reqPattern = /- \[(x| )\] \*\*(\w+-\d+)\*\*/g;
  const requirements = [];
  let match;
  while ((match = reqPattern.exec(content)) !== null) {
    requirements.push({
      id: match[2],
      checked: match[1] === 'x',
    });
  }

  // Parse traceability table with optional test-command column:
  // | REQ-01 | Phase 03 | Status | test-command |
  const tracePattern = /\| (\w+-\d+) \| Phase (\d+)[^|\n]*\|[^|\n]*\|([^|\n]*)/g;
  const traceMap = {};
  while ((match = tracePattern.exec(content)) !== null) {
    const testCommand = match[3] ? match[3].trim() : null;
    traceMap[match[1]] = { phase: match[2], testCommand: testCommand || null };
  }

  // Fallback: simpler pattern without test-command column
  if (Object.keys(traceMap).length === 0) {
    const simpleTracePattern = /\| (\w+-\d+) \| Phase (\d+)/g;
    while ((match = simpleTracePattern.exec(content)) !== null) {
      traceMap[match[1]] = { phase: match[2], testCommand: null };
    }
  }

  const unaddressedList = [];
  let addressedCount = 0;

  for (const req of requirements) {
    if (req.checked) {
      addressedCount++;
      continue;
    }

    // Check if the phase has summaries
    const traceEntry = traceMap[req.id];
    const phase = traceEntry ? traceEntry.phase : null;
    if (phase) {
      const phasePadded = phase.padStart(2, '0');
      const phasesDir = path.join(cwd, '.planning', 'phases');
      let hasSummaries = false;

      try {
        const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && entry.name.startsWith(phasePadded)) {
            const phaseFiles = fs.readdirSync(path.join(phasesDir, entry.name));
            if (phaseFiles.some(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md')) {
              hasSummaries = true;
            }
            break;
          }
        }
      } catch (e) {
        debugLog('verify.requirements', 'readdir failed', e);
      }

      if (hasSummaries) {
        addressedCount++;
      } else {
        unaddressedList.push({ id: req.id, phase, reason: 'Phase has no summaries' });
      }
    } else {
      unaddressedList.push({ id: req.id, phase: null, reason: 'Not in traceability table' });
    }
  }

  // ── Test-command checking ──────────────────────────────────────────────
  const testCommands = { total: 0, valid: 0, invalid: 0, coverage_percent: 0, commands: [] };
  const knownCommands = new Set(['npm', 'node', 'npx', 'mix', 'go', 'cargo', 'pytest', 'python', 'python3', 'ruby', 'bundle', 'jest', 'mocha', 'vitest']);
  for (const [reqId, entry] of Object.entries(traceMap)) {
    if (entry.testCommand) {
      testCommands.total++;
      const baseCommand = entry.testCommand.split(/\s+/)[0];
      const valid = knownCommands.has(baseCommand);
      if (valid) testCommands.valid++;
      else testCommands.invalid++;
      testCommands.commands.push({ reqId, command: entry.testCommand, valid });
    }
  }
  testCommands.coverage_percent = requirements.length > 0
    ? Math.round((testCommands.total / requirements.length) * 100)
    : 0;

  // ── Per-assertion verification (when ASSERTIONS.md exists) ─────────────
  const assertionsPath = path.join(cwd, '.planning', 'ASSERTIONS.md');
  const assertionsContent = safeReadFile(assertionsPath);
  const allAssertions = assertionsContent ? parseAssertionsMd(assertionsContent) : null;

  let assertionsResult = null;

  if (allAssertions && Object.keys(allAssertions).length > 0) {
    let totalAssertions = 0;
    let verified = 0;
    let failed = 0;
    let needsHuman = 0;
    let mustHavePass = 0;
    let mustHaveFail = 0;
    const byRequirement = {};

    for (const [reqId, data] of Object.entries(allAssertions)) {
      const reqResult = { assertion_count: 0, pass: 0, fail: 0, needs_human: 0, assertions: [] };

      for (const a of data.assertions) {
        totalAssertions++;
        reqResult.assertion_count++;

        let status = 'needs_human';
        let evidence = null;

        if (a.type === 'file') {
          // Check if referenced files/patterns exist on disk
          // Look for file paths in the assert text (patterns like path/to/file or *.ext)
          const filePatterns = a.assert.match(/[\w./-]+\.\w{1,10}/g) || [];
          const whenPatterns = a.when ? (a.when.match(/[\w./-]+\.\w{1,10}/g) || []) : [];
          const thenPatterns = a.then ? (a.then.match(/[\w./-]+\.\w{1,10}/g) || []) : [];
          const allPatterns = [...filePatterns, ...whenPatterns, ...thenPatterns];

          if (allPatterns.length > 0) {
            const existingFiles = allPatterns.filter(p => {
              // Try several path resolutions
              return fs.existsSync(path.join(cwd, p)) ||
                     fs.existsSync(path.join(cwd, '.planning', p)) ||
                     fs.existsSync(path.join(cwd, 'templates', p));
            });
            if (existingFiles.length > 0) {
              status = 'pass';
              evidence = `Files found: ${existingFiles.join(', ')}`;
            } else {
              status = 'fail';
              evidence = `No matching files on disk for: ${allPatterns.join(', ')}`;
            }
          } else {
            // No file patterns detected; try checking common words as file/dir names
            status = 'needs_human';
            evidence = 'No file path detected in assertion text';
          }
        } else if (a.type === 'cli') {
          // Check if the CLI command described in 'when' field is a valid gsd-tools command
          const whenText = (a.when || a.assert || '').toLowerCase();
          const gsdCommands = ['assertions', 'verify', 'trace-requirement', 'env', 'mcp-profile',
            'init', 'state', 'roadmap', 'phase', 'memory', 'intent', 'context-budget',
            'test-run', 'search-decisions', 'validate-dependencies', 'search-lessons',
            'codebase-impact', 'rollback-info', 'velocity', 'validate-config', 'quick-summary',
            'extract-sections', 'test-coverage', 'token-budget', 'session-diff'];
          const matchedCmd = gsdCommands.find(cmd => whenText.includes(cmd));
          if (matchedCmd) {
            status = 'pass';
            evidence = `CLI command "${matchedCmd}" exists in gsd-tools`;
          } else {
            status = 'needs_human';
            evidence = 'Could not map assertion to a known CLI command';
          }
        }
        // behavior and api types: always needs_human

        if (status === 'pass') {
          verified++;
          reqResult.pass++;
          if (a.priority === 'must-have') mustHavePass++;
        } else if (status === 'fail') {
          failed++;
          reqResult.fail++;
          if (a.priority === 'must-have') mustHaveFail++;
        } else {
          needsHuman++;
          reqResult.needs_human++;
        }

        const assertionEntry = {
          assert: a.assert,
          priority: a.priority,
          type: a.type || null,
          status,
          evidence,
        };

        // Failed must-have assertions include gap_description for --gaps workflow
        if (status === 'fail' && a.priority === 'must-have') {
          assertionEntry.gap_description = `[${reqId}] Must-have assertion failed: ${a.assert}`;
        }

        reqResult.assertions.push(assertionEntry);
      }

      byRequirement[reqId] = reqResult;
    }

    const coveragePercent = totalAssertions > 0
      ? Math.round(((verified + failed) / totalAssertions) * 100)
      : 0;

    assertionsResult = {
      total: totalAssertions,
      verified,
      failed,
      needs_human: needsHuman,
      must_have_pass: mustHavePass,
      must_have_fail: mustHaveFail,
      coverage_percent: coveragePercent,
      by_requirement: byRequirement,
    };
  }

  // ── Build output (backward compatible) ─────────────────────────────────
  const result = {
    total: requirements.length,
    addressed: addressedCount,
    unaddressed: unaddressedList.length,
    unaddressed_list: unaddressedList,
  };

  if (assertionsResult) {
    result.assertions = assertionsResult;
  }

  if (testCommands.total > 0) {
    result.test_commands = testCommands;
  }

  // Build rawValue
  let rawValue;
  if (assertionsResult) {
    rawValue = `${requirements.length} reqs (${addressedCount} addressed), ${assertionsResult.total} assertions (${assertionsResult.verified} pass, ${assertionsResult.failed} fail, ${assertionsResult.needs_human} human)`;
  } else {
    rawValue = unaddressedList.length === 0 ? 'pass' : 'fail';
  }

  output(result, { formatter: formatVerifyRequirements, rawValue });
}

// ─── Verify Regression (VRFY-03) ────────────────────────────────────────────

function cmdVerifyRegression(cwd, options, raw) {
  const memoryDir = path.join(cwd, '.planning', 'memory');
  const baselinePath = path.join(memoryDir, 'test-baseline.json');

  let beforeData = null;
  let afterData = null;

  if (options && options.before && options.after) {
    // Explicit before/after files
    const beforePath = path.isAbsolute(options.before) ? options.before : path.join(cwd, options.before);
    const afterPath = path.isAbsolute(options.after) ? options.after : path.join(cwd, options.after);

    const beforeContent = safeReadFile(beforePath);
    const afterContent = safeReadFile(afterPath);

    if (!beforeContent) {
      output({ error: 'Before file not found', path: options.before }, raw, 'error');
      return;
    }
    if (!afterContent) {
      output({ error: 'After file not found', path: options.after }, raw, 'error');
      return;
    }

    try {
      beforeData = JSON.parse(beforeContent);
      afterData = JSON.parse(afterContent);
    } catch (e) {
      debugLog('verify.regression', 'JSON parse failed', e);
      output({ error: 'Invalid JSON in before/after files' }, raw, 'error');
      return;
    }
  } else {
    // Check for stored baseline
    const baselineContent = safeReadFile(baselinePath);
    if (!baselineContent) {
      output({
        regressions: [],
        regression_count: 0,
        verdict: 'pass',
        note: 'No baseline found. Save a baseline with --before/--after or store test-baseline.json in .planning/memory/',
      }, raw, 'pass');
      return;
    }

    try {
      beforeData = JSON.parse(baselineContent);
    } catch (e) {
      debugLog('verify.regression', 'baseline parse failed', e);
      output({ error: 'Invalid JSON in test-baseline.json' }, raw, 'error');
      return;
    }

    // Need after data
    if (!afterData) {
      output({
        regressions: [],
        regression_count: 0,
        verdict: 'pass',
        note: 'Baseline found but no current results provided. Pass --after to compare.',
      }, raw, 'pass');
      return;
    }
  }

  // Build lookup from before tests
  const beforeMap = {};
  if (beforeData.tests && Array.isArray(beforeData.tests)) {
    for (const t of beforeData.tests) {
      beforeMap[t.name] = t.status;
    }
  }

  // Find regressions: pass in before, fail in after
  const regressions = [];
  if (afterData.tests && Array.isArray(afterData.tests)) {
    for (const t of afterData.tests) {
      const beforeStatus = beforeMap[t.name];
      if (beforeStatus === 'pass' && t.status === 'fail') {
        regressions.push({
          test_name: t.name,
          before: 'pass',
          after: 'fail',
        });
      }
    }
  }

  output({
    regressions,
    regression_count: regressions.length,
    verdict: regressions.length === 0 ? 'pass' : 'fail',
  }, raw, regressions.length === 0 ? 'pass' : 'fail');
}

// ─── Verify Plan Wave (PLAN-04) ─────────────────────────────────────────────

function cmdVerifyPlanWave(cwd, phasePath, raw) {
  if (!phasePath) { error('phase directory path required'); }
  const fullPath = path.isAbsolute(phasePath) ? phasePath : path.join(cwd, phasePath);

  let files;
  try { files = fs.readdirSync(fullPath); } catch (e) {
    debugLog('verify.planWave', 'readdir failed', e);
    output({ error: 'Cannot read phase directory', path: phasePath }, raw);
    return;
  }

  const planFiles = files.filter(f => f.match(/-PLAN\.md$/i)).sort();

  // Extract phase number from directory name
  const dirName = path.basename(fullPath);
  const phaseMatch = dirName.match(/^(\d+(?:\.\d+)?)/);
  const phaseNum = phaseMatch ? phaseMatch[1] : dirName;

  // Read each plan and extract wave + files_modified
  const plansByWave = {};
  for (const planFile of planFiles) {
    const content = safeReadFile(path.join(fullPath, planFile));
    if (!content) continue;
    const fm = extractFrontmatter(content);

    const wave = fm.wave ? String(fm.wave) : '1';
    const planId = planFile.replace(/-PLAN\.md$/i, '');

    let filesModified = [];
    if (Array.isArray(fm.files_modified)) {
      filesModified = fm.files_modified;
    } else if (typeof fm.files_modified === 'string' && fm.files_modified.trim()) {
      filesModified = [fm.files_modified];
    }

    if (!plansByWave[wave]) plansByWave[wave] = [];
    plansByWave[wave].push({ id: planId, files: filesModified });
  }

  // Build waves output
  const waves = {};
  for (const [wave, plans] of Object.entries(plansByWave)) {
    waves[wave] = plans.map(p => p.id);
  }

  // Check for file conflicts within each wave
  const conflicts = [];
  for (const [wave, plans] of Object.entries(plansByWave)) {
    const fileMap = {}; // file -> [planIds]
    for (const plan of plans) {
      for (const file of plan.files) {
        if (!fileMap[file]) fileMap[file] = [];
        fileMap[file].push(plan.id);
      }
    }
    for (const [file, planIds] of Object.entries(fileMap)) {
      if (planIds.length > 1) {
        conflicts.push({ wave: parseInt(wave, 10), file, plans: planIds });
      }
    }
  }

  const verdict = conflicts.length > 0 ? 'conflicts_found' : 'clean';

  output({
    phase: phaseNum,
    waves,
    conflicts,
    verdict,
  }, raw, verdict);
}

// ─── Verify Plan Dependencies (PLAN-05) ─────────────────────────────────────

function cmdVerifyPlanDeps(cwd, phasePath, raw) {
  if (!phasePath) { error('phase directory path required'); }
  const fullPath = path.isAbsolute(phasePath) ? phasePath : path.join(cwd, phasePath);

  let files;
  try { files = fs.readdirSync(fullPath); } catch (e) {
    debugLog('verify.planDeps', 'readdir failed', e);
    output({ error: 'Cannot read phase directory', path: phasePath }, raw);
    return;
  }

  const planFiles = files.filter(f => f.match(/-PLAN\.md$/i)).sort();

  // Extract phase number from directory name
  const dirName = path.basename(fullPath);
  const phaseMatch = dirName.match(/^(\d+(?:\.\d+)?)/);
  const phaseNum = phaseMatch ? phaseMatch[1] : dirName;

  // Read each plan: extract plan ID, depends_on, wave
  const plans = {};
  for (const planFile of planFiles) {
    const content = safeReadFile(path.join(fullPath, planFile));
    if (!content) continue;
    const fm = extractFrontmatter(content);

    // Extract plan number from filename: "12-03-PLAN.md" -> "03"
    const planIdMatch = planFile.match(/(\d{2})-PLAN\.md$/i);
    const planId = planIdMatch ? planIdMatch[1] : fm.plan || planFile.replace(/-PLAN\.md$/i, '');

    let dependsOn = [];
    if (Array.isArray(fm.depends_on)) {
      dependsOn = fm.depends_on;
    } else if (typeof fm.depends_on === 'string' && fm.depends_on.trim()) {
      dependsOn = [fm.depends_on];
    }

    // Normalize deps: "12-01" -> "01", "01" stays "01"
    const normalizedDeps = dependsOn.map(d => {
      const depMatch = d.match(/(?:\d+-)?(\d+)$/);
      return depMatch ? depMatch[1] : d;
    }).filter(d => d.trim());

    const wave = fm.wave ? parseInt(fm.wave, 10) : 1;
    plans[planId] = { deps: normalizedDeps, wave };
  }

  const planIds = new Set(Object.keys(plans));
  const dependencyGraph = {};
  for (const [id, info] of Object.entries(plans)) {
    dependencyGraph[id] = info.deps;
  }

  const issues = [];

  // 1. Unreachable dependencies: deps referencing plan IDs not in the phase
  for (const [id, info] of Object.entries(plans)) {
    for (const dep of info.deps) {
      if (!planIds.has(dep)) {
        issues.push({ type: 'unreachable', plan: id, dep, message: `Plan ${id} depends on ${dep} which is not in this phase` });
      }
    }
  }

  // 2. Cycle detection using DFS with three states
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = {};
  for (const id of planIds) color[id] = WHITE;

  function dfs(node, pathStack) {
    color[node] = GRAY;
    pathStack.push(node);

    const deps = plans[node] ? plans[node].deps : [];
    for (const dep of deps) {
      if (!planIds.has(dep)) continue; // skip unreachable (already reported)
      if (color[dep] === GRAY) {
        // Found cycle: extract the cycle path
        const cycleStart = pathStack.indexOf(dep);
        const cycle = pathStack.slice(cycleStart).concat(dep);
        issues.push({ type: 'cycle', plans: cycle, message: `Dependency cycle: ${cycle.join(' → ')}` });
        return;
      }
      if (color[dep] === WHITE) {
        dfs(dep, pathStack);
      }
    }

    pathStack.pop();
    color[node] = BLACK;
  }

  for (const id of planIds) {
    if (color[id] === WHITE) {
      dfs(id, []);
    }
  }

  // 3. Unnecessary serialization: plan in wave > 1 that doesn't depend on any plan in a lower wave
  for (const [id, info] of Object.entries(plans)) {
    if (info.wave > 1) {
      const hasLowerWaveDep = info.deps.some(dep => {
        return planIds.has(dep) && plans[dep] && plans[dep].wave < info.wave;
      });
      if (!hasLowerWaveDep && info.deps.length === 0) {
        issues.push({
          type: 'unnecessary_serialization',
          plan: id,
          wave: info.wave,
          message: `Plan ${id} is in wave ${info.wave} but has no dependencies on lower waves — could be wave 1`,
        });
      }
    }
  }

  const verdict = issues.length > 0 ? 'issues_found' : 'clean';

  output({
    phase: phaseNum,
    plan_count: planIds.size,
    dependency_graph: dependencyGraph,
    issues,
    verdict,
  }, raw, verdict);
}

// ─── Verify Quality Formatter ───────────────────────────────────────────────

function formatVerifyQuality(result) {
  const lines = [];
  lines.push(banner('Quality'));
  lines.push('');

  // Overall score with color-coded grade
  const scorePct = Math.max(0, Math.min(100, result.score || 0));
  const gradeColor = colorByPercent(scorePct);
  lines.push('  ' + color.bold(gradeColor(result.grade)) + ' ' + gradeColor('(' + scorePct + '/100)'));
  lines.push('');

  // Dimensions table
  const dimNames = { tests: 'Tests', must_haves: 'Must-Haves', requirements: 'Requirements', regression: 'Regression' };
  lines.push(sectionHeader('Dimensions'));
  lines.push('');

  const rows = [];
  for (const [key, dim] of Object.entries(result.dimensions || {})) {
    const name = dimNames[key] || key;
    let scoreStr;
    if (dim.score === null || dim.score === undefined) {
      scoreStr = color.dim('n/a');
    } else {
      const dimColor = colorByPercent(dim.score);
      scoreStr = dimColor(String(dim.score));
    }
    rows.push([name, scoreStr, String(dim.weight) + '%', dim.detail || '']);
  }
  lines.push(formatTable(['Dimension', 'Score', 'Weight', 'Detail'], rows));
  lines.push('');

  // Trend indicator
  const trend = result.trend || 'stable';
  let trendStr;
  if (trend === 'improving') {
    trendStr = color.green('\u2191 improving');
  } else if (trend === 'declining') {
    trendStr = color.red('\u2193 declining');
  } else {
    trendStr = color.dim('\u2192 stable');
  }
  lines.push('  Trend: ' + trendStr);
  lines.push('');

  // Summary line
  lines.push(summaryLine('Quality: ' + result.grade + ' (' + scorePct + '/100) \u2014 ' + trend));

  return lines.join('\n');
}

// ─── Verify Quality (VRFY-04, VRFY-05, VRFY-06) ────────────────────────────

function cmdVerifyQuality(cwd, options, raw) {
  const { execSync } = require('child_process');
  const { loadConfig } = require('../lib/config');

  const phaseNum = options.phase || null;
  const planPath = options.plan || null;

  // ── 1. Tests dimension (weight 30%) ──────────────────────────────────────
  let testsScore = null;
  let testsDetail = 'no test framework detected';

  const config = loadConfig(cwd);
  let testCommand = null;
  let framework = null;

  if (config.test_commands && typeof config.test_commands === 'object') {
    const keys = Object.keys(config.test_commands);
    if (keys.length > 0) {
      framework = keys[0];
      testCommand = config.test_commands[framework];
    }
  }
  if (!testCommand) {
    if (fs.existsSync(path.join(cwd, 'package.json'))) {
      framework = 'npm';
      testCommand = 'npm test';
    } else if (fs.existsSync(path.join(cwd, 'mix.exs'))) {
      framework = 'mix';
      testCommand = 'mix test';
    } else if (fs.existsSync(path.join(cwd, 'go.mod'))) {
      framework = 'go';
      testCommand = 'go test ./...';
    }
  }

  if (testCommand) {
    let testExitCode = 0;
    let testOutput = '';
    try {
      testOutput = execSync(testCommand, {
        cwd,
        encoding: 'utf-8',
        timeout: 120000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      testExitCode = err.status || 1;
      testOutput = (err.stdout || '') + '\n' + (err.stderr || '');
    }

    if (testExitCode === 0) {
      testsScore = 100;
      // Try to parse count
      const passMatch = testOutput.match(/(\d+)\s+pass(?:ing|ed)?/i) || testOutput.match(/pass\s+(\d+)/i);
      const count = passMatch ? passMatch[1] : '?';
      testsDetail = `all ${count} pass`;
    } else {
      testsScore = 0;
      const failMatch = testOutput.match(/(\d+)\s+fail(?:ing|ed|ure)?/i) || testOutput.match(/fail\s+(\d+)/i);
      const count = failMatch ? failMatch[1] : '?';
      testsDetail = `${count} failing`;
    }
  }

  // ── 2. Must-haves dimension (weight 30%) ─────────────────────────────────
  let mustHavesScore = null;
  let mustHavesDetail = 'no plan specified';

  if (planPath) {
    const fullPlanPath = path.isAbsolute(planPath) ? planPath : path.join(cwd, planPath);
    const planContent = safeReadFile(fullPlanPath);

    if (planContent) {
      const artifacts = parseMustHavesBlock(planContent, 'artifacts');
      const keyLinks = parseMustHavesBlock(planContent, 'key_links');
      let total = 0;
      let verified = 0;

      // Check artifacts
      for (const artifact of artifacts) {
        if (typeof artifact === 'string') continue;
        if (!artifact.path) continue;
        total++;
        const artFullPath = path.join(cwd, artifact.path);
        if (fs.existsSync(artFullPath)) {
          let ok = true;
          if (artifact.contains) {
            const fileContent = safeReadFile(artFullPath) || '';
            if (!fileContent.includes(artifact.contains)) ok = false;
          }
          if (ok) verified++;
        }
      }

      // Check key_links
      for (const link of keyLinks) {
        if (typeof link === 'string') continue;
        total++;
        const sourceContent = safeReadFile(path.join(cwd, link.from || ''));
        if (sourceContent) {
          if (link.pattern) {
            try {
              const regex = new RegExp(link.pattern);
              if (regex.test(sourceContent)) {
                verified++;
              }
            } catch (e) {
              debugLog('verify.quality', 'regex failed', e);
            }
          } else {
            verified++;
          }
        }
      }

      if (total > 0) {
        mustHavesScore = Math.round((verified / total) * 100);
        mustHavesDetail = `${verified}/${total} verified`;
      } else {
        mustHavesDetail = 'no must_haves defined';
      }
    } else {
      mustHavesDetail = 'plan file not found';
    }
  }

  // ── 3. Requirements dimension (weight 20%) ───────────────────────────────
  let reqScore = null;
  let reqDetail = 'no REQUIREMENTS.md';

  const reqPath = path.join(cwd, '.planning', 'REQUIREMENTS.md');
  const reqContent = safeReadFile(reqPath);
  if (reqContent) {
    const reqPattern = /- \[(x| )\] \*\*(\w+-\d+)\*\*/g;
    const requirements = [];
    let reqMatch;
    while ((reqMatch = reqPattern.exec(reqContent)) !== null) {
      requirements.push({ id: reqMatch[2], checked: reqMatch[1] === 'x' });
    }

    // If phase filter, also get traceability
    let filteredReqs = requirements;
    if (phaseNum) {
      const tracePattern = /\| (\w+-\d+) \| Phase (\d+)/g;
      const traceMap = {};
      let tm;
      while ((tm = tracePattern.exec(reqContent)) !== null) {
        traceMap[tm[1]] = tm[2];
      }
      const pn = String(parseInt(phaseNum, 10));
      filteredReqs = requirements.filter(r => {
        const mapped = traceMap[r.id];
        return mapped && String(parseInt(mapped, 10)) === pn;
      });
    }

    if (filteredReqs.length > 0) {
      const addressed = filteredReqs.filter(r => r.checked).length;
      reqScore = Math.round((addressed / filteredReqs.length) * 100);
      reqDetail = `${addressed}/${filteredReqs.length} addressed`;
    } else {
      reqDetail = phaseNum ? `no requirements mapped to phase ${phaseNum}` : 'no requirements found';
    }
  }

  // ── 4. Regression dimension (weight 20%) ─────────────────────────────────
  let regressionScore = null;
  let regressionDetail = 'no baseline';

  const baselinePath = path.join(cwd, '.planning', 'memory', 'test-baseline.json');
  const baselineContent = safeReadFile(baselinePath);
  if (baselineContent) {
    try {
      const baseline = JSON.parse(baselineContent);
      if (baseline.tests_total !== undefined && baseline.tests_failed !== undefined) {
        regressionScore = baseline.tests_failed === 0 ? 100 : 0;
        regressionDetail = baseline.tests_failed === 0 ? 'no regressions' : `${baseline.tests_failed} regressions`;
      } else if (baseline.tests && Array.isArray(baseline.tests)) {
        const failures = baseline.tests.filter(t => t.status === 'fail').length;
        regressionScore = failures === 0 ? 100 : 0;
        regressionDetail = failures === 0 ? 'no regressions' : `${failures} regressions`;
      }
    } catch (e) {
      debugLog('verify.quality', 'baseline parse failed', e);
      regressionDetail = 'invalid baseline JSON';
    }
  }

  // ── Composite score ──────────────────────────────────────────────────────
  const dimensions = {
    tests: { score: testsScore, weight: 30, detail: testsDetail },
    must_haves: { score: mustHavesScore, weight: 30, detail: mustHavesDetail },
    requirements: { score: reqScore, weight: 20, detail: reqDetail },
    regression: { score: regressionScore, weight: 20, detail: regressionDetail },
  };

  let totalWeight = 0;
  let weightedSum = 0;
  for (const dim of Object.values(dimensions)) {
    if (dim.score !== null) {
      totalWeight += dim.weight;
      weightedSum += dim.score * dim.weight;
    }
  }

  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  let grade;
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 60) grade = 'D';
  else grade = 'F';

  // Derive plan identifier
  let planId = null;
  if (planPath) {
    const planBase = path.basename(planPath, '.md').replace(/-PLAN$/i, '');
    planId = planBase;
  }

  // ── Trend tracking ───────────────────────────────────────────────────────
  const memoryDir = path.join(cwd, '.planning', 'memory');
  const scoresPath = path.join(memoryDir, 'quality-scores.json');

  let scores = [];
  const scoresContent = safeReadFile(scoresPath);
  if (scoresContent) {
    try {
      scores = JSON.parse(scoresContent);
      if (!Array.isArray(scores)) scores = [];
    } catch (e) {
      debugLog('verify.quality', 'scores parse failed', e);
      scores = [];
    }
  }

  const entry = {
    phase: phaseNum || (planId ? planId.split('-')[0] : null),
    plan: planId,
    score,
    grade,
    timestamp: new Date().toISOString(),
  };
  scores.push(entry);

  // Write scores (ensure directory exists)
  try {
    if (!fs.existsSync(memoryDir)) {
      fs.mkdirSync(memoryDir, { recursive: true });
    }
    fs.writeFileSync(scoresPath, JSON.stringify(scores, null, 2), 'utf-8');
  } catch (e) {
    debugLog('verify.quality', 'write scores failed', e);
  }

  // Compute trend from last 3 scores
  let trend = 'stable';
  if (scores.length >= 3) {
    const last3 = scores.slice(-3);
    const s = last3.map(e => e.score);
    if (s[0] < s[1] && s[1] < s[2]) trend = 'improving';
    else if (s[0] > s[1] && s[1] > s[2]) trend = 'declining';
  }

  output({
    score,
    grade,
    dimensions,
    trend,
    plan: planId,
    phase: phaseNum || (planId ? planId.split('-')[0] : null),
  }, { formatter: formatVerifyQuality });
}

// ─── Assertions Commands ────────────────────────────────────────────────────

function cmdAssertionsList(cwd, options, raw) {
  const assertionsPath = path.join(cwd, '.planning', 'ASSERTIONS.md');
  const content = safeReadFile(assertionsPath);
  if (!content) {
    output({ error: 'ASSERTIONS.md not found', path: '.planning/ASSERTIONS.md' }, raw, 'ASSERTIONS.md not found');
    return;
  }

  const parsed = parseAssertionsMd(content);

  // Filter by reqId if specified
  const reqId = options && options.reqId;
  const requirements = {};
  let totalAssertions = 0;
  let mustHaveCount = 0;
  let niceToHaveCount = 0;

  for (const [id, data] of Object.entries(parsed)) {
    if (reqId && id !== reqId) continue;
    const assertions = data.assertions || [];
    const must = assertions.filter(a => a.priority === 'must-have').length;
    const nice = assertions.filter(a => a.priority === 'nice-to-have').length;
    totalAssertions += assertions.length;
    mustHaveCount += must;
    niceToHaveCount += nice;
    requirements[id] = {
      description: data.description,
      assertion_count: assertions.length,
      assertions,
    };
  }

  const totalRequirements = Object.keys(requirements).length;
  const rawValue = `${totalRequirements} requirements, ${totalAssertions} assertions (${mustHaveCount} must-have, ${niceToHaveCount} nice-to-have)`;

  output({
    total_requirements: totalRequirements,
    total_assertions: totalAssertions,
    must_have_count: mustHaveCount,
    nice_to_have_count: niceToHaveCount,
    requirements,
  }, raw, rawValue);
}

function cmdAssertionsValidate(cwd, raw) {
  const assertionsPath = path.join(cwd, '.planning', 'ASSERTIONS.md');
  const content = safeReadFile(assertionsPath);
  if (!content) {
    output({ error: 'ASSERTIONS.md not found', path: '.planning/ASSERTIONS.md' }, raw, 'ASSERTIONS.md not found');
    return;
  }

  const parsed = parseAssertionsMd(content);
  const issues = [];

  // Read REQUIREMENTS.md for cross-referencing
  const reqPath = path.join(cwd, '.planning', 'REQUIREMENTS.md');
  const reqContent = safeReadFile(reqPath);
  const reqIds = new Set();
  if (reqContent) {
    const reqPattern = /- \[(x| )\] \*\*(\w+-\d+)\*\*/g;
    let m;
    while ((m = reqPattern.exec(reqContent)) !== null) {
      reqIds.add(m[2]);
    }
  }

  const validTypes = new Set(['api', 'cli', 'file', 'behavior']);
  const validPriorities = new Set(['must-have', 'nice-to-have']);
  let totalAssertions = 0;

  for (const [reqId, data] of Object.entries(parsed)) {
    // Check: requirement ID exists in REQUIREMENTS.md
    if (reqIds.size > 0 && !reqIds.has(reqId)) {
      issues.push({ reqId, issue: `Requirement ${reqId} not found in REQUIREMENTS.md`, severity: 'warning' });
    }

    const assertions = data.assertions || [];
    totalAssertions += assertions.length;

    // Check: 2-5 assertions per requirement
    if (assertions.length < 2) {
      issues.push({ reqId, issue: `Only ${assertions.length} assertion(s), recommended 2-5`, severity: 'info' });
    } else if (assertions.length > 5) {
      issues.push({ reqId, issue: `${assertions.length} assertions, recommended max 5`, severity: 'info' });
    }

    for (let i = 0; i < assertions.length; i++) {
      const a = assertions[i];

      // Check: non-empty assert field
      if (!a.assert || !a.assert.trim()) {
        issues.push({ reqId, issue: `Assertion ${i + 1} has empty assert field`, severity: 'error' });
      }

      // Check: valid type if present
      if (a.type && !validTypes.has(a.type)) {
        issues.push({ reqId, issue: `Assertion ${i + 1} has invalid type "${a.type}"`, severity: 'error' });
      }

      // Check: valid priority
      if (a.priority && !validPriorities.has(a.priority)) {
        issues.push({ reqId, issue: `Assertion ${i + 1} has invalid priority "${a.priority}"`, severity: 'error' });
      }
    }
  }

  // Coverage: requirements with assertions / total requirements
  const assertionReqCount = Object.keys(parsed).length;
  const totalReqs = reqIds.size || assertionReqCount;
  const coveragePercent = totalReqs > 0 ? Math.round((assertionReqCount / totalReqs) * 100) : 0;

  const valid = issues.filter(i => i.severity === 'error').length === 0;
  const rawValue = valid ? 'valid' : `${issues.length} issues found`;

  output({
    valid,
    issues,
    stats: {
      total_reqs: totalReqs,
      total_assertions: totalAssertions,
      reqs_with_assertions: assertionReqCount,
      coverage_percent: coveragePercent,
    },
  }, raw, rawValue);
}

// ─── Assertions Parser ──────────────────────────────────────────────────────

/**
 * Parse ASSERTIONS.md content into structured assertion map.
 * Returns: { [reqId]: { description, assertions: [{assert, when, then, type, priority}] } }
 *
 * Format: ## REQ-ID: Description heading, followed by indented assertion blocks.
 * Each assertion starts with `- assert:` and may have optional when/then/type/priority fields.
 */
function parseAssertionsMd(content) {
  if (!content || typeof content !== 'string') return {};

  const result = {};
  // Split on ## headings to find requirement-assertion groups
  const sections = content.split(/^## /m).slice(1); // skip content before first ##

  for (const section of sections) {
    const lines = section.split('\n');
    const heading = lines[0].trim();

    // Extract requirement ID from heading: "SREQ-01: description" or "ENV-01: description"
    const idMatch = heading.match(/^([A-Z][\w]+-\d+)\s*:\s*(.+)/);
    if (!idMatch) continue; // skip non-requirement headings (e.g., "Examples")

    const reqId = idMatch[1];
    const description = idMatch[2].trim();
    const assertions = [];
    let current = null;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      // New assertion: starts with "- assert:"
      const assertMatch = line.match(/^- assert:\s*"?([^"]*)"?\s*$/);
      if (assertMatch) {
        if (current) assertions.push(current);
        current = {
          assert: assertMatch[1].trim(),
          when: null,
          then: null,
          type: null,
          priority: 'must-have',
        };
        continue;
      }

      // Continuation fields (indented under an assertion)
      if (current) {
        const fieldMatch = line.match(/^\s+(when|then|type|priority):\s*"?([^"]*)"?\s*$/);
        if (fieldMatch) {
          const key = fieldMatch[1];
          const val = fieldMatch[2].trim();
          if (key === 'priority') {
            current.priority = (val === 'nice-to-have') ? 'nice-to-have' : 'must-have';
          } else {
            current[key] = val || null;
          }
        }
      }
    }
    if (current) assertions.push(current);

    result[reqId] = { description, assertions };
  }

  return result;
}

module.exports = {
  cmdVerifyPlanStructure,
  cmdVerifyPhaseCompleteness,
  cmdVerifyReferences,
  cmdVerifyCommits,
  cmdVerifyArtifacts,
  cmdVerifyKeyLinks,
  cmdValidateConsistency,
  cmdValidateHealth,
  cmdAnalyzePlan,
  cmdVerifyDeliverables,
  cmdVerifyRequirements,
  cmdVerifyRegression,
  cmdVerifyPlanWave,
  cmdVerifyPlanDeps,
  cmdVerifyQuality,
  parseAssertionsMd,
  cmdAssertionsList,
  cmdAssertionsValidate,
};
