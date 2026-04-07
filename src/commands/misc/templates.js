'use strict';

const fs = require('fs');
const path = require('path');
const { output, error, debugLog } = require('../../lib/output');
const { cachedReadFile, normalizePhaseName, findPhaseInternal, generateSlugInternal } = require('../../lib/helpers');
const { extractFrontmatter, reconstructFrontmatter } = require('../../lib/frontmatter');

function cmdTemplateSelect(cwd, planPath, raw) {
  if (!planPath) {
    error('plan-path required');
  }

  try {
    const fullPath = path.join(cwd, planPath);
    const content = cachedReadFile(fullPath);

    // Simple heuristics
    const taskMatch = content.match(/###\s*Task\s*\d+/g) || [];
    const taskCount = taskMatch.length;

    const decisionMatch = content.match(/decision/gi) || [];
    const hasDecisions = decisionMatch.length > 0;

    // Count file mentions
    const fileMentions = new Set();
    const filePattern = /`([^`]+\.[a-zA-Z]+)`/g;
    let m;
    while ((m = filePattern.exec(content)) !== null) {
      if (m[1].includes('/') && !m[1].startsWith('http')) {
        fileMentions.add(m[1]);
      }
    }
    const fileCount = fileMentions.size;

    let template = 'templates/summary-standard.md';
    let type = 'standard';

    if (taskCount <= 2 && fileCount <= 3 && !hasDecisions) {
      template = 'templates/summary-minimal.md';
      type = 'minimal';
    } else if (hasDecisions || fileCount > 6 || taskCount > 5) {
      template = 'templates/summary-complex.md';
      type = 'complex';
    }

    const result = { template, type, taskCount, fileCount, hasDecisions };
    output(result, raw, template);
  } catch (e) {
    debugLog('template.pick', 'template selection failed', e);
    // Fallback to standard
    output({ template: 'templates/summary-standard.md', type: 'standard', error: e.message }, raw, 'templates/summary-standard.md');
  }
}

function cmdTemplateFill(cwd, templateType, options, raw) {
  if (!templateType) { error('template type required: summary, plan, or verification'); }
  if (!options.phase) { error('--phase required'); }

  const phaseInfo = findPhaseInternal(cwd, options.phase);
  if (!phaseInfo || !phaseInfo.found) { output({ error: 'Phase not found', phase: options.phase }, raw); return; }

  const padded = normalizePhaseName(options.phase);
  const today = new Date().toISOString().split('T')[0];
  const phaseName = options.name || phaseInfo.phase_name || 'Unnamed';
  const phaseSlug = phaseInfo.phase_slug || generateSlugInternal(phaseName);
  const phaseId = `${padded}-${phaseSlug}`;
  const planNum = (options.plan || '01').padStart(2, '0');
  const fields = options.fields || {};

  let frontmatter, body, fileName;

  switch (templateType) {
    case 'summary': {
      frontmatter = {
        phase: phaseId,
        plan: planNum,
        subsystem: '[primary category]',
        tags: [],
        provides: [],
        affects: [],
        'tech-stack': { added: [], patterns: [] },
        'key-files': { created: [], modified: [] },
        'key-decisions': [],
        'patterns-established': [],
        duration: '[X]min',
        completed: today,
        ...fields,
      };
      body = [
        `# Phase ${options.phase}: ${phaseName} Summary`,
        '',
        '**[Substantive one-liner describing outcome]**',
        '',
        '## Performance',
        '- **Duration:** [time]',
        '- **Tasks:** [count completed]',
        '- **Files modified:** [count]',
        '',
        '## Accomplishments',
        '- [Key outcome 1]',
        '- [Key outcome 2]',
        '',
        '## Task Commits',
        '1. **Task 1: [task name]** - `hash`',
        '',
        '## Files Created/Modified',
        '- `path/to/file.ts` - What it does',
        '',
        '## Decisions & Deviations',
        '[Key decisions or "None - followed plan as specified"]',
        '',
        '## Next Phase Readiness',
        '[What\'s ready for next phase]',
      ].join('\n');
      fileName = `${padded}-${planNum}-SUMMARY.md`;
      break;
    }
    case 'plan': {
      const planType = options.type || 'execute';
      const wave = parseInt(options.wave) || 1;
      frontmatter = {
        phase: phaseId,
        plan: planNum,
        type: planType,
        wave,
        depends_on: [],
        files_modified: [],
        autonomous: true,
        user_setup: [],
        verification_route: 'light',
        verification_route_reason: 'TODO: explain why this route is proportionate, especially for any downgrade.',
        must_haves: { truths: [], artifacts: [], key_links: [] },
        ...fields,
      };
      body = [
        `# Phase ${options.phase} Plan ${planNum}: [Title]`,
        '',
        '## Objective',
        '- **What:** [What this plan builds]',
        '- **Why:** [Why it matters for the phase goal]',
        '- **Output:** [Concrete deliverable]',
        '',
        '## Context',
        '@.planning/PROJECT.md',
        '@.planning/ROADMAP.md',
        '@.planning/STATE.md',
        '',
        '## Tasks',
        '',
        '<task type="code">',
        '  <name>[Task name]</name>',
        '  <files>[file paths]</files>',
        '  <action>[What to do]</action>',
        '  <verify>[How to verify]</verify>',
        '  <done>[Definition of done]</done>',
        '</task>',
        '',
        '## Verification Route',
        '- **Route:** `skip | light | full`',
        '- **Reason:** [Why this proof level is proportionate. Required for any lower-than-default route.]',
        '',
        '## Verification',
        '[How to verify this plan achieved its objective]',
        '',
        '## Success Criteria',
        '- [ ] [Criterion 1]',
        '- [ ] [Criterion 2]',
      ].join('\n');
      fileName = `${padded}-${planNum}-PLAN.md`;
      break;
    }
    case 'verification': {
      frontmatter = {
        phase: phaseId,
        verified: new Date().toISOString(),
        status: 'pending',
        score: '0/0 must-haves verified',
        ...fields,
      };
      body = [
        `# Phase ${options.phase}: ${phaseName} — Verification`,
        '',
        '## Proof Buckets',
        '',
        '### Behavior Proof',
        '- Status: pending',
        '- Evidence: ',
        '',
        '### Regression Proof',
        '- Status: not required',
        '- Evidence: ',
        '',
        '### Human Verification',
        '- Status: not required',
        '- Evidence: ',
        '',
        '## Observable Truths',
        '| # | Truth | Status | Evidence |',
        '|---|-------|--------|----------|',
        '| 1 | [Truth] | pending | |',
        '',
        '## Required Artifacts',
        '| Artifact | Expected | Status | Details |',
        '|----------|----------|--------|---------|',
        '| [path] | [what] | pending | |',
        '',
        '## Key Link Verification',
        '| From | To | Via | Status | Details |',
        '|------|----|----|--------|---------|',
        '| [source] | [target] | [connection] | pending | |',
        '',
        '## Requirements Coverage',
        '| Requirement | Status | Blocking Issue |',
        '|-------------|--------|----------------|',
        '| [req] | pending | |',
        '',
        '## Result',
        '[Pending verification]',
      ].join('\n');
      fileName = `${padded}-VERIFICATION.md`;
      break;
    }
    default:
      error(`Unknown template type: ${templateType}. Available: summary, plan, verification`);
      return;
  }

  const fullContent = `---\n${reconstructFrontmatter(frontmatter)}\n---\n\n${body}\n`;
  const outPath = path.join(cwd, phaseInfo.directory, fileName);

  // Use exclusive-create flag to atomically check existence + write (no TOCTOU race)
  let fd;
  try {
    fd = fs.openSync(outPath, 'wx');
  } catch (err) {
    if (err.code === 'EEXIST') {
      output({ error: 'File already exists', path: path.relative(cwd, outPath) }, raw);
      return;
    }
    throw err;
  }
  try {
    fs.writeFileSync(fd, fullContent, 'utf-8');
  } finally {
    fs.closeSync(fd);
  }
  const relPath = path.relative(cwd, outPath);
  output({ created: true, path: relPath, template: templateType }, raw, relPath);
}

function cmdScaffold(cwd, type, options, raw) {
  const { phase, name } = options;
  const padded = phase ? normalizePhaseName(phase) : '00';
  const today = new Date().toISOString().split('T')[0];

  // Find phase directory
  const phaseInfo = phase ? findPhaseInternal(cwd, phase) : null;
  const phaseDir = phaseInfo ? path.join(cwd, phaseInfo.directory) : null;

  if (phase && !phaseDir && type !== 'phase-dir') {
    error(`Phase ${phase} directory not found`);
  }

  let filePath, content;

  switch (type) {
    case 'context': {
      filePath = path.join(phaseDir, `${padded}-CONTEXT.md`);
      content = `---\nphase: "${padded}"\nname: "${name || phaseInfo?.phase_name || 'Unnamed'}"\ncreated: ${today}\n---\n\n# Phase ${phase}: ${name || phaseInfo?.phase_name || 'Unnamed'} — Context\n\n## Decisions\n\n_Decisions will be captured during /gsd:discuss-phase ${phase}_\n\n## Discretion Areas\n\n_Areas where the executor can use judgment_\n\n## Deferred Ideas\n\n_Ideas to consider later_\n`;
      break;
    }
    case 'uat': {
      filePath = path.join(phaseDir, `${padded}-UAT.md`);
      content = `---\nphase: "${padded}"\nname: "${name || phaseInfo?.phase_name || 'Unnamed'}"\ncreated: ${today}\nstatus: pending\n---\n\n# Phase ${phase}: ${name || phaseInfo?.phase_name || 'Unnamed'} — User Acceptance Testing\n\n## Test Results\n\n| # | Test | Status | Notes |\n|---|------|--------|-------|\n\n## Summary\n\n_Pending UAT_\n`;
      break;
    }
    case 'verification': {
      filePath = path.join(phaseDir, `${padded}-VERIFICATION.md`);
      content = `---\nphase: "${padded}"\nname: "${name || phaseInfo?.phase_name || 'Unnamed'}"\ncreated: ${today}\nstatus: pending\n---\n\n# Phase ${phase}: ${name || phaseInfo?.phase_name || 'Unnamed'} — Verification\n\n## Goal-Backward Verification\n\n**Phase Goal:** [From ROADMAP.md]\n\n## Checks\n\n| # | Requirement | Status | Evidence |\n|---|------------|--------|----------|\n\n## Result\n\n_Pending verification_\n`;
      break;
    }
    case 'phase-dir': {
      if (!phase || !name) {
        error('phase and name required for phase-dir scaffold');
      }
      const slug = generateSlugInternal(name);
      const dirName = `${padded}-${slug}`;
      const phasesParent = path.join(cwd, '.planning', 'phases');
      fs.mkdirSync(phasesParent, { recursive: true });
      const dirPath = path.join(phasesParent, dirName);
      fs.mkdirSync(dirPath, { recursive: true });
      output({ created: true, directory: `.planning/phases/${dirName}`, path: dirPath }, raw, dirPath);
      return;
    }
    default:
      error(`Unknown scaffold type: ${type}. Available: context, uat, verification, phase-dir`);
  }

  // Use exclusive-create flag to atomically check existence + write (no TOCTOU race)
  let fd;
  try {
    fd = fs.openSync(filePath, 'wx');
  } catch (err) {
    if (err.code === 'EEXIST') {
      output({ created: false, reason: 'already_exists', path: filePath }, raw, 'exists');
      return;
    }
    throw err;
  }
  try {
    fs.writeFileSync(fd, content, 'utf-8');
  } finally {
    fs.closeSync(fd);
  }
  const relPath = path.relative(cwd, filePath);
  output({ created: true, path: relPath }, raw, relPath);
}

function cmdSummaryExtract(cwd, summaryPath, fields, raw) {
  const fs = require('fs');
  const path = require('path');
  const { safeReadFile } = require('../../lib/helpers');
  const { output } = require('../../lib/output');

  if (!summaryPath) {
    output({ error: 'summary path required' }, raw);
    return;
  }
  const fullPath = path.isAbsolute(summaryPath) ? summaryPath : path.join(cwd, summaryPath);
  const content = safeReadFile(fullPath);
  if (!content) {
    output({ error: 'File not found', path: summaryPath }, raw);
    return;
  }

  // Simple extraction - parse frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!frontmatterMatch) {
    output({ error: 'No frontmatter found' }, raw);
    return;
  }

  const result = { path: summaryPath };
  if (fields && fields.length > 0) {
    for (const field of fields) {
      const match = frontmatterMatch[1].match(new RegExp(`^${field}:\\s*(.*)$`, 'm'));
      result[field] = match ? match[1].trim() : null;
    }
  } else {
    // Return all frontmatter fields
    const lines = frontmatterMatch[1].split('\n');
    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        const key = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();
        result[key] = value;
      }
    }
  }
  output(result, raw);
}

function cmdSummaryGenerate(cwd, phaseArg, planArg, raw) {
  const { findPhaseInternal, safeReadFile } = require('../../lib/helpers');
  const path = require('path');
  const fs = require('fs');
  const { output } = require('../../lib/output');

  if (!phaseArg) {
    output({ error: 'Phase argument required' }, raw);
    return;
  }

  const phaseInfo = findPhaseInternal(cwd, phaseArg);
  if (!phaseInfo || !phaseInfo.found) {
    output({ error: `Phase ${phaseArg} not found` }, raw);
    return;
  }

  const paddedPhase = phaseInfo.phase_number;
  const paddedPlan = (planArg || '01').padStart(2, '0');
  const phaseDir = path.join(cwd, phaseInfo.directory);

  // Find PLAN.md and SUMMARY.md
  const planFileName = fs.readdirSync(phaseDir).find(f =>
    f.endsWith(`-${paddedPlan}-PLAN.md`) || (paddedPlan === '01' && f === 'PLAN.md')
  );

  if (!planFileName) {
    output({ error: `PLAN.md not found for phase ${phaseArg} plan ${paddedPlan}` }, raw);
    return;
  }

  const planPath = path.join(phaseDir, planFileName);
  const summaryPath = path.join(phaseDir, `${paddedPhase}-${paddedPlan}-SUMMARY.md`);

  // Read PLAN.md
  const planContent = safeReadFile(planPath);
  if (!planContent) {
    output({ error: `PLAN.md not readable at ${planPath}` }, raw);
    return;
  }

  // Extract tdd_rationale from plan frontmatter
  const planFrontmatter = extractFrontmatter(planContent);
  const tddRationale = planFrontmatter.tdd_rationale || null;

  // Find TDD-AUDIT.json files in phase directory
  const tddAuditFiles = fs.readdirSync(phaseDir)
    .filter(f => f.endsWith('-TDD-AUDIT.json'))
    .sort();

  // Render TDD audit narrative if audits exist
  let tddNarrative = null;
  if (tddAuditFiles.length > 0) {
    const narrativeParts = [];
    // Add TDD Decision section if tdd_rationale exists
    if (tddRationale) {
      narrativeParts.push('## TDD Decision\n\n**Rationale:** ' + tddRationale + '\n\n');
    }
    narrativeParts.push('## TDD Audit Trail\n');
    for (const auditFile of tddAuditFiles) {
      const auditPath = path.join(phaseDir, auditFile);
      let auditData;
      try {
        auditData = JSON.parse(fs.readFileSync(auditPath, 'utf-8'));
      } catch {
        continue;
      }

      const planMatch = auditFile.match(/-(\d+)-TDD-AUDIT\.json$/);
      const planNum = planMatch ? planMatch[1] : '?';
      narrativeParts.push(`### Plan ${planNum}\n`);

      // Normalize structure - handle both {phases: {red, green, refactor}} and direct stage objects
      const source = auditData && typeof auditData === 'object'
        ? (auditData.phases && typeof auditData.phases === 'object' ? auditData.phases : auditData)
        : {};

      const stages = ['red', 'green', 'refactor'].filter(s => source[s] && typeof source[s] === 'object');

      for (const stage of stages) {
        const stageData = source[stage];
        const targetCommand = stageData.target_command || '';
        const exitCode = stageData.exit_code;
        const evidence = stageData.matched_evidence_snippet || '';
        const commit = stageData.commit || '';
        const gsdPhase = stageData.gsd_phase || stage;

        // Render as narrative (no backtick-wrapped command tokens)
        narrativeParts.push(`#### ${stage.toUpperCase()}\n`);
        if (commit) {
          narrativeParts.push(`- **Commit:** ${commit}\n`);
        }
        if (gsdPhase) {
          narrativeParts.push(`- **GSD-Phase:** ${gsdPhase}\n`);
        }
        if (targetCommand) {
          // Render command without backticks - just the command text
          narrativeParts.push(`- **Target command:** ${targetCommand}\n`);
        }
        if (exitCode !== undefined) {
          const exitDesc = exitCode === 0 ? 'passed' : 'failed';
          narrativeParts.push(`- **Exit status:** ${exitCode} (${exitDesc})\n`);
        }
        if (evidence) {
          // Wrap evidence in quotes for readability, no backticks
          narrativeParts.push(`- **Matched evidence:** "${evidence}"\n`);
        }
        narrativeParts.push('\n');
      }
    }
    tddNarrative = narrativeParts.join('');
  }

  // Build summary output - if SUMMARY.md already exists, append TDD narrative to it
  let summaryContent = '';
  const existingSummary = safeReadFile(summaryPath);
  if (existingSummary) {
    // If TDD narrative exists and summary doesn't already have it, append it
    if (tddNarrative && !existingSummary.includes('## TDD Audit Trail')) {
      summaryContent = existingSummary.trimEnd() + '\n\n' + tddNarrative;
    } else {
      summaryContent = existingSummary;
    }
  } else {
    // No existing summary - create basic structure with TDD narrative if available
    if (tddNarrative) {
      summaryContent = tddNarrative;
    } else {
      summaryContent = '## Summary\n\nNo TDD audit found for this plan.\n';
    }
  }

  // Write summary
  try {
    fs.writeFileSync(summaryPath, summaryContent, 'utf-8');
    output({
      generated: true,
      phase: phaseArg,
      plan: paddedPlan,
      plan_path: planPath,
      summary_path: summaryPath,
      tdd_audits_found: tddAuditFiles.length,
    }, raw);
  } catch (e) {
    output({ error: `Failed to write summary: ${e.message}` }, raw);
  }
}

module.exports = {
  cmdTemplateSelect,
  cmdTemplateFill,
  cmdScaffold,
  cmdSummaryExtract,
  cmdSummaryGenerate,
};
