'use strict';

const fs = require('fs');
const path = require('path');
const { output, error, debugLog } = require('../../lib/output');
const { safeReadFile, cachedReadFile, getArchivedPhaseDirs, getMilestoneInfo, getPhaseTree } = require('../../lib/helpers');
const { extractFrontmatter } = require('../../lib/frontmatter');
const { execGit } = require('../../lib/git');
const { createPlanMetadataContext } = require('../../lib/plan-metadata');

function cmdVerifyPhaseCompleteness(cwd, phase, raw) {
  if (!phase) { error('phase required'); }
  const phaseInfo = getArchivedPhaseDirs(cwd, phase);
  if (!phaseInfo || !phaseInfo.found) {
    output({ error: 'Phase not found', phase }, raw);
    return;
  }

  const errors = [];
  const warnings = [];
  const phaseDir = path.join(cwd, phaseInfo.directory);

  let files;
  try { files = fs.readdirSync(phaseDir); } catch (e) { debugLog('verify.phaseComplete', 'readdir phase failed', e); output({ error: 'Cannot read phase directory' }, raw); return; }

  const plans = files.filter(f => f.match(/-PLAN\.md$/i));
  const summaries = files.filter(f => f.match(/-SUMMARY\.md$/i));

  const planIds = new Set(plans.map(p => p.replace(/-PLAN\.md$/i, '')));
  const summaryIds = new Set(summaries.map(s => s.replace(/-SUMMARY\.md$/i, '')));

  const incompletePlans = [...planIds].filter(id => !summaryIds.has(id));
  if (incompletePlans.length > 0) {
    errors.push(`Plans without summaries: ${incompletePlans.join(', ')}`);
  }

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

  const atRefs = content.match(/@([^\s\n,)]+\/[^\s\n,)]+)/g) || [];
  for (const ref of atRefs) {
    const cleanRef = ref.slice(1);
    const resolved = cleanRef.startsWith('~/')
      ? path.join(process.env.HOME || '', cleanRef.slice(2))
      : path.join(cwd, cleanRef);
    if (fs.existsSync(resolved)) {
      found.push(cleanRef);
    } else {
      missing.push(cleanRef);
    }
  }

  const backtickRefs = content.match(/`([^`]+\/[^`]+\.[a-zA-Z]{1,10})`/g) || [];
  for (const ref of backtickRefs) {
    const cleanRef = ref.slice(1, -1);
    if (cleanRef.startsWith('http') || cleanRef.includes('${') || cleanRef.includes('{{')) continue;
    if (found.includes(cleanRef) || missing.includes(cleanRef)) continue;
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
  const context = require('./quality').getPlanMetadataContext ? require('./quality').getPlanMetadataContext(cwd) : createPlanMetadataContext(cwd);
  const metadata = context.getPlan(fullPath);
  if (!metadata.content) { output({ error: 'File not found', path: planFilePath }, raw); return; }

  const artifacts = metadata.mustHaves?.artifacts || { status: 'missing', items: [] };
  if (artifacts.status === 'missing') {
    output({ status: 'missing', error: require('./quality').getMissingMetadataMessage('artifacts'), path: planFilePath, total: 0, artifacts: [] }, raw, 'invalid');
    return;
  }
  if (artifacts.status === 'inconclusive') {
    output({ status: 'inconclusive', error: require('./quality').getInconclusiveMetadataMessage('artifacts'), path: planFilePath, total: 0, artifacts: [] }, raw, 'invalid');
    return;
  }

  const results = require('./quality').verifyArtifactEntries(context, artifacts.items);

  const passed = results.filter(r => r.passed).length;
  output({
    status: 'present',
    all_passed: passed === results.length,
    passed,
    total: results.length,
    artifacts: results,
  }, raw, passed === results.length ? 'valid' : 'invalid');
}

function cmdVerifyKeyLinks(cwd, planFilePath, raw) {
  if (!planFilePath) { error('plan file path required'); }
  const fullPath = path.isAbsolute(planFilePath) ? planFilePath : path.join(cwd, planFilePath);
  const context = require('./quality').getPlanMetadataContext ? require('./quality').getPlanMetadataContext(cwd) : createPlanMetadataContext(cwd);
  const metadata = context.getPlan(fullPath);
  if (!metadata.content) { output({ error: 'File not found', path: planFilePath }, raw); return; }

  const keyLinks = metadata.mustHaves?.keyLinks || { status: 'missing', items: [] };
  if (keyLinks.status === 'missing') {
    output({ status: 'missing', error: require('./quality').getMissingMetadataMessage('key_links'), path: planFilePath, total: 0, links: [] }, raw, 'invalid');
    return;
  }
  if (keyLinks.status === 'inconclusive') {
    output({ status: 'inconclusive', error: require('./quality').getInconclusiveMetadataMessage('key_links'), path: planFilePath, total: 0, links: [] }, raw, 'invalid');
    return;
  }

  const results = require('./quality').verifyKeyLinkEntries(context, keyLinks.items);

  const verified = results.filter(r => r.verified).length;
  output({
    status: 'present',
    all_verified: verified === results.length,
    verified,
    total: results.length,
    links: results,
  }, raw, verified === results.length ? 'valid' : 'invalid');
}

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

  const dirName = path.basename(fullPath);
  const phaseMatch = dirName.match(/^(\d+(?:\.\d+)?)/);
  const phaseNum = phaseMatch ? phaseMatch[1] : dirName;

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

  const waves = {};
  for (const [wave, plans] of Object.entries(plansByWave)) {
    waves[wave] = plans.map(p => p.id);
  }

  const conflicts = [];
  for (const [wave, plans] of Object.entries(plansByWave)) {
    const fileMap = {};
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

  const parallelizationWarnings = [];
  for (const conflict of conflicts) {
    const plansStr = conflict.plans.join(' and ');
    parallelizationWarnings.push({
      wave: conflict.wave,
      reason: `Plans ${plansStr} both modify ${conflict.file}`,
      recommendation: 'Run sequentially or merge into single plan',
    });
  }

  const allPlanIds = Object.values(plansByWave).flatMap(plans => plans.map(p => p.id));
  const conflictedPlanIds = new Set(conflicts.flatMap(c => c.plans));
  const safeToParallelize = allPlanIds.filter(id => !conflictedPlanIds.has(id));

  const verdict = conflicts.length > 0 ? 'conflicts_found' : 'clean';

  output({
    phase: phaseNum,
    waves,
    conflicts,
    parallelization_warnings: parallelizationWarnings,
    safe_to_parallelize: safeToParallelize,
    verdict,
  }, raw, verdict);
}

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

  const dirName = path.basename(fullPath);
  const phaseMatch = dirName.match(/^(\d+(?:\.\d+)?)/);
  const phaseNum = phaseMatch ? phaseMatch[1] : dirName;

  const plans = {};
  for (const planFile of planFiles) {
    const content = safeReadFile(path.join(fullPath, planFile));
    if (!content) continue;
    const fm = extractFrontmatter(content);

    const planIdMatch = planFile.match(/(\d{2})-PLAN\.md$/i);
    const planId = planIdMatch ? planIdMatch[1] : fm.plan || planFile.replace(/-PLAN\.md$/i, '');

    let dependsOn = [];
    if (Array.isArray(fm.depends_on)) {
      dependsOn = fm.depends_on;
    } else if (typeof fm.depends_on === 'string' && fm.depends_on.trim()) {
      dependsOn = [fm.depends_on];
    }

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

  for (const [id, info] of Object.entries(plans)) {
    for (const dep of info.deps) {
      if (!planIds.has(dep)) {
        issues.push({ type: 'unreachable', plan: id, dep, message: `Plan ${id} depends on ${dep} which is not in this phase` });
      }
    }
  }

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const colorState = {};
  for (const id of planIds) colorState[id] = WHITE;

  function dfs(node, pathStack) {
    colorState[node] = GRAY;
    pathStack.push(node);

    const deps = plans[node] ? plans[node].deps : [];
    for (const dep of deps) {
      if (!planIds.has(dep)) continue;
      if (colorState[dep] === GRAY) {
        const cycleStart = pathStack.indexOf(dep);
        const cycle = pathStack.slice(cycleStart).concat(dep);
        issues.push({ type: 'cycle', plans: cycle, message: `Dependency cycle: ${cycle.join(' → ')}` });
        return;
      }
      if (colorState[dep] === WHITE) {
        dfs(dep, pathStack);
      }
    }

    pathStack.pop();
    colorState[node] = BLACK;
  }

  for (const id of planIds) {
    if (colorState[id] === WHITE) {
      dfs(id, []);
    }
  }

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

function cmdValidateConsistency(cwd, raw) {
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const errors = [];
  const warnings = [];

  const roadmapContent = cachedReadFile(roadmapPath);
  if (!roadmapContent) {
    errors.push('ROADMAP.md not found');
    output({ passed: false, errors, warnings }, raw, 'failed');
    return;
  }

  const roadmapPhases = new Set();
  const phasePattern = /#{2,4}\s*Phase\s+(\d+(?:\.\d+)?)\s*:/gi;
  let m;
  while ((m = phasePattern.exec(roadmapContent)) !== null) {
    roadmapPhases.add(m[1]);
  }

  const phaseTree = getPhaseTree(cwd);
  const diskPhases = new Set();
  for (const [, entry] of phaseTree) {
    diskPhases.add(entry.phaseNumber);
  }

  for (const p of roadmapPhases) {
    if (!diskPhases.has(p) && !diskPhases.has(require('./search').normalizePhaseName(p))) {
      warnings.push(`Phase ${p} in ROADMAP.md but no directory on disk`);
    }
  }

  for (const p of diskPhases) {
    const unpadded = String(parseInt(p, 10));
    if (!roadmapPhases.has(p) && !roadmapPhases.has(unpadded)) {
      warnings.push(`Phase ${p} exists on disk but not in ROADMAP.md`);
    }
  }

  const integerPhases = [...diskPhases]
    .filter(p => !p.includes('.'))
    .map(p => parseInt(p, 10))
    .sort((a, b) => a - b);

  for (let i = 1; i < integerPhases.length; i++) {
    if (integerPhases[i] !== integerPhases[i - 1] + 1) {
      warnings.push(`Gap in phase numbering: ${integerPhases[i - 1]} → ${integerPhases[i]}`);
    }
  }

  for (const [, entry] of phaseTree) {
    const plans = entry.plans;
    const summaries = entry.summaries;

    const planNums = plans.map(p => {
      const pm = p.match(/-(\d{2})-PLAN\.md$/);
      return pm ? parseInt(pm[1], 10) : null;
    }).filter(n => n !== null);

    for (let i = 1; i < planNums.length; i++) {
      if (planNums[i] !== planNums[i - 1] + 1) {
        warnings.push(`Gap in plan numbering in ${entry.dirName}: plan ${planNums[i - 1]} → ${planNums[i]}`);
      }
    }

    const planIds = new Set(plans.map(p => p.replace('-PLAN.md', '')));
    const summaryIds = new Set(summaries.map(s => s.replace('-SUMMARY.md', '')));
    for (const sid of summaryIds) {
      if (!planIds.has(sid)) {
        warnings.push(`Summary ${sid}-SUMMARY.md in ${entry.dirName} has no matching PLAN.md`);
      }
    }

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

module.exports = {
  // Reference/phase functions
  getArchivedPhaseDirs,
  getMilestoneInfo,
  getPhaseTree,
  cmdVerifyPhaseCompleteness,
  cmdVerifyReferences,
  cmdVerifyCommits,
  cmdVerifyArtifacts,
  cmdVerifyKeyLinks,
  cmdVerifyPlanWave,
  cmdVerifyPlanDeps,
  cmdValidateConsistency,
};
