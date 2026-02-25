const fs = require('fs');
const path = require('path');
const { output, error, debugLog } = require('../lib/output');
const { loadConfig } = require('../lib/config');
const { execGit } = require('../lib/git');
const { parseIntentMd, generateIntentMd } = require('../lib/helpers');

// ─── Intent Commands ─────────────────────────────────────────────────────────

function cmdIntentCreate(cwd, args, raw) {
  const planningDir = path.join(cwd, '.planning');

  // Guard: .planning/ must exist
  if (!fs.existsSync(planningDir)) {
    error('.planning/ directory not found. Run project initialization first.');
  }

  const intentPath = path.join(planningDir, 'INTENT.md');
  const force = args.includes('--force');

  // Check existence
  if (fs.existsSync(intentPath) && !force) {
    error('INTENT.md already exists. Use --force to overwrite.');
  }

  // Parse CLI flags for section content
  const getFlag = (flag) => {
    const idx = args.indexOf(flag);
    if (idx === -1 || idx + 1 >= args.length) return null;
    return args[idx + 1];
  };

  const getMultiFlag = (flag) => {
    const idx = args.indexOf(flag);
    if (idx === -1) return [];
    const values = [];
    for (let i = idx + 1; i < args.length; i++) {
      if (args[i].startsWith('--')) break;
      values.push(args[i]);
    }
    return values;
  };

  const now = new Date().toISOString().split('T')[0];

  // Build data structure
  const data = {
    revision: 1,
    created: now,
    updated: now,
    objective: { statement: '', elaboration: '' },
    users: [],
    outcomes: [],
    criteria: [],
    constraints: { technical: [], business: [], timeline: [] },
    health: { quantitative: [], qualitative: '' },
  };

  // Populate from flags if provided
  const objectiveText = getFlag('--objective');
  if (objectiveText) {
    const parts = objectiveText.split('\n');
    data.objective.statement = parts[0] || '';
    data.objective.elaboration = parts.slice(1).join('\n').trim();
  }

  const userArgs = getMultiFlag('--users');
  for (const u of userArgs) {
    data.users.push({ text: u });
  }

  const outcomeArgs = getMultiFlag('--outcomes');
  for (const o of outcomeArgs) {
    const match = o.match(/^(DO-\d+)\s+\[(P[123])\]:\s*(.+)$/);
    if (match) {
      data.outcomes.push({ id: match[1], priority: match[2], text: match[3] });
    }
  }

  const criteriaArgs = getMultiFlag('--criteria');
  for (const c of criteriaArgs) {
    const match = c.match(/^(SC-\d+):\s*(.+)$/);
    if (match) {
      data.criteria.push({ id: match[1], text: match[2] });
    }
  }

  // Generate INTENT.md content
  const content = generateIntentMd(data);

  // Write file
  fs.writeFileSync(intentPath, content, 'utf-8');

  // Build section list for output
  const sections = ['objective', 'users', 'outcomes', 'criteria', 'constraints', 'health'];

  // Auto-commit if commit_docs enabled
  const config = loadConfig(cwd);
  let commitHash = null;
  if (config.commit_docs) {
    execGit(cwd, ['add', '.planning/INTENT.md']);
    const commitResult = execGit(cwd, ['commit', '-m', 'docs(intent): create INTENT.md']);
    if (commitResult.exitCode === 0) {
      const hashResult = execGit(cwd, ['rev-parse', '--short', 'HEAD']);
      commitHash = hashResult.exitCode === 0 ? hashResult.stdout : null;
    }
  }

  const result = {
    created: true,
    path: '.planning/INTENT.md',
    revision: 1,
    sections,
    commit: commitHash,
  };

  output(result, raw, commitHash || 'created');
}

// ─── Intent Show / Read ──────────────────────────────────────────────────────

const SECTION_ALIASES = ['objective', 'users', 'outcomes', 'criteria', 'constraints', 'health'];

function cmdIntentShow(cwd, args, raw) {
  const planningDir = path.join(cwd, '.planning');
  const intentPath = path.join(planningDir, 'INTENT.md');

  if (!fs.existsSync(intentPath)) {
    error('No INTENT.md found. Run `intent create` first.');
  }

  const content = fs.readFileSync(intentPath, 'utf-8');
  const data = parseIntentMd(content);

  // Check for section filter (first positional arg after subcommand)
  const sectionFilter = args.length > 0 && SECTION_ALIASES.includes(args[0]) ? args[0] : null;
  const fullFlag = args.includes('--full');

  // JSON output mode (--raw flag or invoked as "intent read")
  if (raw) {
    if (sectionFilter) {
      // Return just that section's data
      const sectionData = {};
      sectionData[sectionFilter] = data[sectionFilter];
      output(sectionData, false);
    } else {
      output(data, false);
    }
    return;
  }

  // Human-readable output
  if (fullFlag) {
    // Render complete INTENT.md content
    output(null, true, content);
    return;
  }

  if (sectionFilter) {
    // Show just that section's full content
    const sectionContent = renderSection(data, sectionFilter);
    output(null, true, sectionContent);
    return;
  }

  // Default: compact summary (10-20 lines)
  const summary = renderCompactSummary(data);
  output(null, true, summary);
}

/**
 * Render a compact summary of INTENT.md (target 10-20 lines).
 * Sorts outcomes by priority (P1 first).
 */
function renderCompactSummary(data) {
  const lines = [];
  const isTTY = process.stdout.isTTY;

  // Header
  const updated = data.updated || 'unknown';
  lines.push(`INTENT — Revision ${data.revision || '?'} (updated ${updated})`);
  lines.push('');

  // Objective (truncated to ~80 chars)
  const obj = data.objective.statement || '(not set)';
  const truncObj = obj.length > 80 ? obj.slice(0, 77) + '...' : obj;
  lines.push(`Objective: ${truncObj}`);
  lines.push('');

  // Outcomes with priority sorting
  if (data.outcomes.length > 0) {
    const sorted = [...data.outcomes].sort((a, b) => {
      const pa = parseInt(a.priority.replace('P', ''), 10);
      const pb = parseInt(b.priority.replace('P', ''), 10);
      return pa - pb;
    });

    // Count by priority
    const counts = { P1: 0, P2: 0, P3: 0 };
    for (const o of sorted) {
      if (counts[o.priority] !== undefined) counts[o.priority]++;
    }
    const countParts = [];
    if (counts.P1 > 0) countParts.push(`${counts.P1}×P1`);
    if (counts.P2 > 0) countParts.push(`${counts.P2}×P2`);
    if (counts.P3 > 0) countParts.push(`${counts.P3}×P3`);

    lines.push(`Outcomes (${sorted.length}): ${countParts.join('  ')}`);
    for (const o of sorted) {
      const priorityLabel = colorPriority(o.priority, isTTY);
      lines.push(`  ${priorityLabel}: ${o.id} — ${o.text}`);
    }
  } else {
    lines.push('Outcomes: none defined');
  }
  lines.push('');

  // Success Criteria count
  lines.push(`Success Criteria: ${data.criteria.length} defined`);

  // Constraints breakdown
  const techCount = data.constraints.technical.length;
  const bizCount = data.constraints.business.length;
  const timeCount = data.constraints.timeline.length;
  lines.push(`Constraints: ${techCount} technical, ${bizCount} business, ${timeCount} timeline`);

  // Health metrics breakdown
  const quantCount = data.health.quantitative.length;
  const hasQual = data.health.qualitative && data.health.qualitative.trim() ? 'defined' : 'none';
  lines.push(`Health Metrics: ${quantCount} quantitative, qualitative ${hasQual}`);

  // Target users
  lines.push(`Target Users: ${data.users.length} audience${data.users.length !== 1 ? 's' : ''}`);

  return lines.join('\n') + '\n';
}

/**
 * Render a single section's full content.
 */
function renderSection(data, section) {
  const isTTY = process.stdout.isTTY;
  const lines = [];

  switch (section) {
    case 'objective':
      lines.push('## Objective');
      lines.push('');
      lines.push(data.objective.statement || '(not set)');
      if (data.objective.elaboration) {
        lines.push('');
        lines.push(data.objective.elaboration);
      }
      break;

    case 'users':
      lines.push('## Target Users');
      lines.push('');
      if (data.users.length > 0) {
        for (const u of data.users) {
          lines.push(`- ${u.text}`);
        }
      } else {
        lines.push('(none defined)');
      }
      break;

    case 'outcomes':
      lines.push('## Desired Outcomes');
      lines.push('');
      if (data.outcomes.length > 0) {
        const sorted = [...data.outcomes].sort((a, b) => {
          const pa = parseInt(a.priority.replace('P', ''), 10);
          const pb = parseInt(b.priority.replace('P', ''), 10);
          return pa - pb;
        });
        for (const o of sorted) {
          const priorityLabel = colorPriority(o.priority, isTTY);
          lines.push(`- ${o.id} [${priorityLabel}]: ${o.text}`);
        }
      } else {
        lines.push('(none defined)');
      }
      break;

    case 'criteria':
      lines.push('## Success Criteria');
      lines.push('');
      if (data.criteria.length > 0) {
        for (const c of data.criteria) {
          lines.push(`- ${c.id}: ${c.text}`);
        }
      } else {
        lines.push('(none defined)');
      }
      break;

    case 'constraints':
      lines.push('## Constraints');
      if (data.constraints.technical.length > 0) {
        lines.push('');
        lines.push('### Technical');
        for (const c of data.constraints.technical) {
          lines.push(`- ${c.id}: ${c.text}`);
        }
      }
      if (data.constraints.business.length > 0) {
        lines.push('');
        lines.push('### Business');
        for (const c of data.constraints.business) {
          lines.push(`- ${c.id}: ${c.text}`);
        }
      }
      if (data.constraints.timeline.length > 0) {
        lines.push('');
        lines.push('### Timeline');
        for (const c of data.constraints.timeline) {
          lines.push(`- ${c.id}: ${c.text}`);
        }
      }
      if (data.constraints.technical.length === 0 && data.constraints.business.length === 0 && data.constraints.timeline.length === 0) {
        lines.push('');
        lines.push('(none defined)');
      }
      break;

    case 'health':
      lines.push('## Health Metrics');
      if (data.health.quantitative.length > 0) {
        lines.push('');
        lines.push('### Quantitative');
        for (const m of data.health.quantitative) {
          lines.push(`- ${m.id}: ${m.text}`);
        }
      }
      if (data.health.qualitative && data.health.qualitative.trim()) {
        lines.push('');
        lines.push('### Qualitative');
        lines.push(data.health.qualitative);
      }
      if (data.health.quantitative.length === 0 && (!data.health.qualitative || !data.health.qualitative.trim())) {
        lines.push('');
        lines.push('(none defined)');
      }
      break;
  }

  return lines.join('\n') + '\n';
}

/**
 * Apply ANSI color to priority labels (only when TTY).
 * P1 = red, P2 = yellow, P3 = dim.
 */
function colorPriority(priority, isTTY) {
  if (!isTTY) return priority;
  switch (priority) {
    case 'P1': return '\x1b[31mP1\x1b[0m';
    case 'P2': return '\x1b[33mP2\x1b[0m';
    case 'P3': return '\x1b[2mP3\x1b[0m';
    default: return priority;
  }
}

// ─── Intent Update ───────────────────────────────────────────────────────────

function cmdIntentUpdate(cwd, args, raw) {
  const planningDir = path.join(cwd, '.planning');
  const intentPath = path.join(planningDir, 'INTENT.md');

  if (!fs.existsSync(intentPath)) {
    error('No INTENT.md found. Run `intent create` first.');
  }

  const content = fs.readFileSync(intentPath, 'utf-8');
  const data = parseIntentMd(content);

  // Extract section alias
  const section = args.length > 0 && SECTION_ALIASES.includes(args[0]) ? args[0] : null;
  if (!section) {
    error('Usage: intent update <section> [--add|--remove|--set-priority|--value] [value]\nSections: objective, users, outcomes, criteria, constraints, health');
  }

  // Helper: extract flag value
  const getFlag = (flag) => {
    const idx = args.indexOf(flag);
    if (idx === -1 || idx + 1 >= args.length) return null;
    return args[idx + 1];
  };

  const addValue = getFlag('--add');
  const removeValue = getFlag('--remove');
  const setPriorityId = getFlag('--set-priority');
  const replaceValue = getFlag('--value');
  const priorityValue = getFlag('--priority');
  const typeValue = getFlag('--type');

  let operation = null;
  let operationDetail = null;
  let commitMessage = null;

  if (setPriorityId) {
    // --set-priority DO-03 P1
    if (section !== 'outcomes') {
      error('--set-priority is only valid for outcomes');
    }

    // The new priority is the argument after the ID
    const idIdx = args.indexOf('--set-priority');
    const id = args[idIdx + 1];
    const newPriority = args[idIdx + 2];

    if (!id || !newPriority || !/^P[123]$/.test(newPriority)) {
      error('Usage: intent update outcomes --set-priority <DO-XX> <P1|P2|P3>');
    }

    const outcome = data.outcomes.find(o => o.id === id);
    if (!outcome) {
      error(`Outcome ${id} not found`);
    }

    outcome.priority = newPriority;
    operation = 'set-priority';
    operationDetail = { id, priority: newPriority };
    commitMessage = `docs(intent): set ${id} priority to ${newPriority}`;

  } else if (removeValue) {
    // --remove DO-03
    operation = 'remove';

    if (section === 'outcomes') {
      data.outcomes = data.outcomes.filter(o => o.id !== removeValue);
      operationDetail = { id: removeValue };
      commitMessage = `docs(intent): remove ${removeValue} from outcomes`;
    } else if (section === 'criteria') {
      data.criteria = data.criteria.filter(c => c.id !== removeValue);
      operationDetail = { id: removeValue };
      commitMessage = `docs(intent): remove ${removeValue} from criteria`;
    } else if (section === 'constraints') {
      for (const type of ['technical', 'business', 'timeline']) {
        data.constraints[type] = data.constraints[type].filter(c => c.id !== removeValue);
      }
      operationDetail = { id: removeValue };
      commitMessage = `docs(intent): remove ${removeValue} from constraints`;
    } else if (section === 'health') {
      data.health.quantitative = data.health.quantitative.filter(m => m.id !== removeValue);
      operationDetail = { id: removeValue };
      commitMessage = `docs(intent): remove ${removeValue} from health`;
    } else if (section === 'users') {
      // Users don't have IDs — remove by text match
      data.users = data.users.filter(u => u.text !== removeValue);
      operationDetail = { text: removeValue };
      commitMessage = `docs(intent): remove user from target users`;
    } else {
      error(`--remove is not supported for section: ${section}`);
    }

  } else if (addValue) {
    // --add 'description'
    operation = 'add';

    if (section === 'outcomes') {
      const nextId = getNextId(data.outcomes, 'DO');
      const priority = priorityValue || 'P2';
      data.outcomes.push({ id: nextId, priority, text: addValue });
      operationDetail = { id: nextId, priority };
      commitMessage = `docs(intent): add ${nextId} to outcomes`;
    } else if (section === 'criteria') {
      const nextId = getNextId(data.criteria, 'SC');
      data.criteria.push({ id: nextId, text: addValue });
      operationDetail = { id: nextId };
      commitMessage = `docs(intent): add ${nextId} to criteria`;
    } else if (section === 'constraints') {
      const type = typeValue || 'technical';
      if (!['technical', 'business', 'timeline'].includes(type)) {
        error('--type must be one of: technical, business, timeline');
      }
      // Collect all constraints across types for ID assignment
      const allConstraints = [
        ...data.constraints.technical,
        ...data.constraints.business,
        ...data.constraints.timeline,
      ];
      const nextId = getNextId(allConstraints, 'C');
      data.constraints[type].push({ id: nextId, text: addValue });
      operationDetail = { id: nextId, type };
      commitMessage = `docs(intent): add ${nextId} to constraints (${type})`;
    } else if (section === 'health') {
      const nextId = getNextId(data.health.quantitative, 'HM');
      data.health.quantitative.push({ id: nextId, text: addValue });
      operationDetail = { id: nextId };
      commitMessage = `docs(intent): add ${nextId} to health metrics`;
    } else if (section === 'users') {
      data.users.push({ text: addValue });
      operationDetail = { text: addValue };
      commitMessage = `docs(intent): add user to target users`;
    } else {
      error(`--add is not supported for section: ${section}`);
    }

  } else if (replaceValue) {
    // Section-level replace: --value 'new content'
    operation = 'replace';

    if (section === 'objective') {
      const parts = replaceValue.split('\n');
      data.objective.statement = parts[0] || '';
      data.objective.elaboration = parts.slice(1).join('\n').trim();
    } else if (section === 'users') {
      data.users = replaceValue.split('\n').filter(l => l.trim()).map(l => ({ text: l.trim() }));
    } else {
      error(`--value for section "${section}" is not supported. Use --add/--remove for list sections.`);
    }
    operationDetail = { section };
    commitMessage = `docs(intent): update ${section}`;

  } else {
    error('No operation specified. Use --add, --remove, --set-priority, or --value');
  }

  // Increment revision and update timestamp
  data.revision = (data.revision || 0) + 1;
  data.updated = new Date().toISOString().split('T')[0];

  // Regenerate and write
  const newContent = generateIntentMd(data);
  fs.writeFileSync(intentPath, newContent, 'utf-8');

  // Auto-commit if commit_docs enabled
  const config = loadConfig(cwd);
  let commitHash = null;
  if (config.commit_docs && commitMessage) {
    execGit(cwd, ['add', '.planning/INTENT.md']);
    const commitResult = execGit(cwd, ['commit', '-m', commitMessage]);
    if (commitResult.exitCode === 0) {
      const hashResult = execGit(cwd, ['rev-parse', '--short', 'HEAD']);
      commitHash = hashResult.exitCode === 0 ? hashResult.stdout : null;
    }
  }

  const result = {
    updated: true,
    section,
    operation,
    ...operationDetail,
    revision: data.revision,
    commit: commitHash,
  };

  output(result, raw);
}

/**
 * Get the next sequential ID for a given prefix.
 * Scans existing items, finds max number, returns prefix-{max+1}.
 * Preserves ID gaps — only looks at max.
 */
function getNextId(items, prefix) {
  let maxNum = 0;
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  for (const item of items) {
    const match = item.id.match(pattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  const nextNum = (maxNum + 1).toString().padStart(2, '0');
  return `${prefix}-${nextNum}`;
}

// ─── Intent Validate ─────────────────────────────────────────────────────────

function cmdIntentValidate(cwd, args, raw) {
  const planningDir = path.join(cwd, '.planning');
  const intentPath = path.join(planningDir, 'INTENT.md');

  if (!fs.existsSync(intentPath)) {
    error('No INTENT.md found. Run `intent create` first.');
  }

  const content = fs.readFileSync(intentPath, 'utf-8');
  const data = parseIntentMd(content);

  const issues = [];
  const sections = {};

  // ── Section presence checks ──

  // Objective
  if (data.objective && data.objective.statement && data.objective.statement.trim()) {
    sections.objective = { valid: true, message: 'defined' };
  } else {
    sections.objective = { valid: false, message: 'missing or empty' };
    issues.push({ section: 'objective', type: 'missing', message: 'Objective: missing or empty' });
  }

  // Target Users
  if (data.users && data.users.length > 0) {
    sections.users = { valid: true, count: data.users.length };
  } else {
    sections.users = { valid: false, count: 0, issues: ['missing or empty'] };
    issues.push({ section: 'users', type: 'missing', message: 'Target Users: missing or empty' });
  }

  // Outcomes — presence + ID format + uniqueness + content minimum
  if (data.outcomes && data.outcomes.length > 0) {
    const outcomeIssues = [];
    const seenIds = new Set();
    for (const o of data.outcomes) {
      if (!/^DO-\d+$/.test(o.id)) {
        outcomeIssues.push(`${o.id} has invalid format`);
      }
      if (seenIds.has(o.id)) {
        outcomeIssues.push(`duplicate ID ${o.id}`);
      }
      seenIds.add(o.id);
    }
    if (outcomeIssues.length > 0) {
      sections.outcomes = { valid: false, count: data.outcomes.length, issues: outcomeIssues };
      for (const iss of outcomeIssues) {
        issues.push({ section: 'outcomes', type: 'format', message: `Outcomes: ${iss}` });
      }
    } else {
      sections.outcomes = { valid: true, count: data.outcomes.length };
    }
  } else {
    sections.outcomes = { valid: false, count: 0, issues: ['no items defined (minimum 1)'] };
    issues.push({ section: 'outcomes', type: 'missing', message: 'Outcomes: no items defined (minimum 1)' });
  }

  // Criteria — presence + ID format + uniqueness + content minimum
  if (data.criteria && data.criteria.length > 0) {
    const criteriaIssues = [];
    const seenIds = new Set();
    for (const c of data.criteria) {
      if (!/^SC-\d+$/.test(c.id)) {
        criteriaIssues.push(`${c.id} has invalid format`);
      }
      if (seenIds.has(c.id)) {
        criteriaIssues.push(`duplicate ID ${c.id}`);
      }
      seenIds.add(c.id);
    }
    if (criteriaIssues.length > 0) {
      sections.criteria = { valid: false, count: data.criteria.length, issues: criteriaIssues };
      for (const iss of criteriaIssues) {
        issues.push({ section: 'criteria', type: 'format', message: `Criteria: ${iss}` });
      }
    } else {
      sections.criteria = { valid: true, count: data.criteria.length };
    }
  } else {
    sections.criteria = { valid: false, count: 0, issues: ['no items defined (minimum 1)'] };
    issues.push({ section: 'criteria', type: 'missing', message: 'Success Criteria: no items defined (minimum 1)' });
  }

  // Constraints — sub-section checks + ID format + uniqueness
  const techCount = data.constraints ? data.constraints.technical.length : 0;
  const bizCount = data.constraints ? data.constraints.business.length : 0;
  const timeCount = data.constraints ? data.constraints.timeline.length : 0;
  const totalConstraints = techCount + bizCount + timeCount;

  if (totalConstraints > 0) {
    const constraintIssues = [];
    const subSections = [];
    if (techCount > 0) subSections.push('technical');
    if (bizCount > 0) subSections.push('business');
    if (timeCount > 0) subSections.push('timeline');

    // Check all constraint IDs
    const seenIds = new Set();
    const allConstraints = [
      ...(data.constraints.technical || []),
      ...(data.constraints.business || []),
      ...(data.constraints.timeline || []),
    ];
    for (const c of allConstraints) {
      if (!/^C-\d+$/.test(c.id)) {
        constraintIssues.push(`${c.id} has invalid format`);
      }
      if (seenIds.has(c.id)) {
        constraintIssues.push(`duplicate ID ${c.id}`);
      }
      seenIds.add(c.id);
    }

    if (constraintIssues.length > 0) {
      sections.constraints = { valid: false, count: totalConstraints, sub_sections: subSections, issues: constraintIssues };
      for (const iss of constraintIssues) {
        issues.push({ section: 'constraints', type: 'format', message: `Constraints: ${iss}` });
      }
    } else {
      sections.constraints = { valid: true, count: totalConstraints, sub_sections: subSections };
    }
  } else {
    // Check if raw content has sub-section headers (even if no items parsed)
    const constraintsRaw = content.match(/<constraints>([\s\S]*?)<\/constraints>/);
    const rawText = constraintsRaw ? constraintsRaw[1] : '';
    const hasTechHeader = /^###\s*Technical/im.test(rawText);
    const hasBizHeader = /^###\s*Business/im.test(rawText);
    const hasTimeHeader = /^###\s*Timeline/im.test(rawText);
    if (hasTechHeader || hasBizHeader || hasTimeHeader) {
      const subSections = [];
      if (hasTechHeader) subSections.push('technical');
      if (hasBizHeader) subSections.push('business');
      if (hasTimeHeader) subSections.push('timeline');
      sections.constraints = { valid: true, count: 0, sub_sections: subSections };
    } else {
      sections.constraints = { valid: false, count: 0, issues: ['missing sub-sections (need at least ### Technical, ### Business, or ### Timeline)'] };
      issues.push({ section: 'constraints', type: 'missing', message: 'Constraints: missing sub-sections' });
    }
  }

  // Health — sub-section checks + ID format
  const quantCount = data.health ? data.health.quantitative.length : 0;
  const hasQual = data.health && data.health.qualitative && data.health.qualitative.trim();

  // Check raw content for sub-section headers
  const healthRaw = content.match(/<health>([\s\S]*?)<\/health>/);
  const healthText = healthRaw ? healthRaw[1] : '';
  const hasQuantHeader = /^###\s*Quantitative/im.test(healthText);
  const hasQualHeader = /^###\s*Qualitative/im.test(healthText);

  if (hasQuantHeader || hasQualHeader) {
    const healthIssues = [];

    // Check quantitative IDs
    if (quantCount > 0) {
      const seenIds = new Set();
      for (const m of data.health.quantitative) {
        if (!/^HM-\d+$/.test(m.id)) {
          healthIssues.push(`${m.id} has invalid format`);
        }
        if (seenIds.has(m.id)) {
          healthIssues.push(`duplicate ID ${m.id}`);
        }
        seenIds.add(m.id);
      }
    }

    if (!hasQuantHeader) {
      healthIssues.push('missing ### Quantitative');
    }
    if (!hasQualHeader) {
      healthIssues.push('missing ### Qualitative');
    }

    if (healthIssues.length > 0) {
      sections.health = { valid: false, quantitative_count: quantCount, qualitative: !!hasQual, issues: healthIssues };
      for (const iss of healthIssues) {
        issues.push({ section: 'health', type: 'format', message: `Health: ${iss}` });
      }
    } else {
      sections.health = { valid: true, quantitative_count: quantCount, qualitative: !!hasQual };
    }
  } else {
    sections.health = { valid: false, quantitative_count: 0, qualitative: false, issues: ['missing or empty'] };
    issues.push({ section: 'health', type: 'missing', message: 'Health Metrics: missing or empty' });
  }

  // ── Revision check ──
  const revision = data.revision;
  const revisionValid = revision !== null && Number.isInteger(revision) && revision > 0;

  // ── Build result ──
  const valid = issues.length === 0 && revisionValid;

  if (!revisionValid) {
    issues.push({ section: 'revision', type: 'missing', message: 'Revision: missing or invalid' });
  }

  const result = {
    valid,
    issues,
    sections,
    revision: revision || null,
  };

  // Output
  if (raw) {
    // JSON output
    process.stdout.write(JSON.stringify(result, null, 2));
    process.exit(valid ? 0 : 1);
  } else {
    // Human-readable lint-style output
    const lines = [];
    lines.push('INTENT Validation — .planning/INTENT.md');
    lines.push('');

    // Section results
    const sym = (v) => v ? '✓' : '✗';

    lines.push(`${sym(sections.objective.valid)} Objective: ${sections.objective.message || 'defined'}`);

    if (sections.users.valid) {
      lines.push(`${sym(true)} Target Users: ${sections.users.count} audience${sections.users.count !== 1 ? 's' : ''}`);
    } else {
      lines.push(`${sym(false)} Target Users: missing or empty`);
    }

    if (sections.outcomes.valid) {
      lines.push(`${sym(true)} Outcomes: ${sections.outcomes.count} items, IDs valid`);
    } else if (sections.outcomes.count > 0) {
      lines.push(`${sym(false)} Outcomes: ${(sections.outcomes.issues || []).join('; ')}`);
    } else {
      lines.push(`${sym(false)} Outcomes: no items defined (minimum 1)`);
    }

    if (sections.criteria.valid) {
      lines.push(`${sym(true)} Success Criteria: ${sections.criteria.count} items, IDs valid`);
    } else if (sections.criteria.count > 0) {
      lines.push(`${sym(false)} Success Criteria: ${(sections.criteria.issues || []).join('; ')}`);
    } else {
      lines.push(`${sym(false)} Success Criteria: no items defined (minimum 1)`);
    }

    if (sections.constraints.valid) {
      const subCount = (sections.constraints.sub_sections || []).length;
      lines.push(`${sym(true)} Constraints: ${subCount} sub-section${subCount !== 1 ? 's' : ''} (${(sections.constraints.sub_sections || []).join(', ')})`);
    } else {
      lines.push(`${sym(false)} Constraints: ${(sections.constraints.issues || []).join('; ')}`);
    }

    if (sections.health.valid) {
      lines.push(`${sym(true)} Health Metrics: quantitative (${sections.health.quantitative_count} items), qualitative ${sections.health.qualitative ? 'defined' : 'none'}`);
    } else {
      lines.push(`${sym(false)} Health Metrics: ${(sections.health.issues || []).join('; ')}`);
    }

    if (revisionValid) {
      lines.push(`${sym(true)} Revision: ${revision}`);
    } else {
      lines.push(`${sym(false)} Revision: missing or invalid`);
    }

    lines.push('');
    if (valid) {
      lines.push('Result: valid');
    } else {
      lines.push(`Result: ${issues.length} issue${issues.length !== 1 ? 's' : ''} found`);
    }

    process.stdout.write(lines.join('\n') + '\n');
    process.exit(valid ? 0 : 1);
  }
}

module.exports = {
  cmdIntentCreate,
  cmdIntentShow,
  cmdIntentUpdate,
  cmdIntentValidate,
};
