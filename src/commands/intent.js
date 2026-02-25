const fs = require('fs');
const path = require('path');
const { output, error, debugLog } = require('../lib/output');
const { loadConfig } = require('../lib/config');
const { execGit } = require('../lib/git');
const { parseIntentMd, generateIntentMd, parsePlanIntent, getMilestoneInfo, normalizePhaseName } = require('../lib/helpers');
const { extractFrontmatter } = require('../lib/frontmatter');

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

// ─── Intent Trace ────────────────────────────────────────────────────────────

function cmdIntentTrace(cwd, args, raw) {
  const planningDir = path.join(cwd, '.planning');
  const intentPath = path.join(planningDir, 'INTENT.md');

  if (!fs.existsSync(intentPath)) {
    error('No INTENT.md found. Run `intent create` first.');
  }

  const intentContent = fs.readFileSync(intentPath, 'utf-8');
  const intentData = parseIntentMd(intentContent);

  if (!intentData.outcomes || intentData.outcomes.length === 0) {
    error('INTENT.md has no desired outcomes defined.');
  }

  const gapsOnly = args.includes('--gaps');

  // Get milestone info for phase range scoping
  const milestone = getMilestoneInfo(cwd);
  const phaseRange = milestone.phaseRange;

  // Scan phase directories for PLAN.md files
  const phasesDir = path.join(planningDir, 'phases');
  const plans = [];

  if (fs.existsSync(phasesDir)) {
    try {
      const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
      const phaseDirs = entries
        .filter(e => e.isDirectory())
        .map(e => e.name)
        .sort();

      for (const dir of phaseDirs) {
        // Filter to current milestone's phase range if available
        const phaseNumMatch = dir.match(/^(\d+)/);
        if (phaseNumMatch && phaseRange) {
          const phaseNum = parseInt(phaseNumMatch[1], 10);
          if (phaseNum < phaseRange.start || phaseNum > phaseRange.end) continue;
        }

        const phaseDir = path.join(phasesDir, dir);
        const files = fs.readdirSync(phaseDir);
        const planFiles = files.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').sort();

        for (const planFile of planFiles) {
          const planPath = path.join(phaseDir, planFile);
          const planContent = fs.readFileSync(planPath, 'utf-8');
          const fm = extractFrontmatter(planContent);
          const intentInfo = parsePlanIntent(planContent);

          // Build plan_id from frontmatter or filename
          const planPhase = fm.phase || dir;
          const planNum = fm.plan || planFile.replace(/-PLAN\.md$/, '').split('-').pop() || '01';
          const paddedPhase = normalizePhaseName(planPhase);
          const paddedPlan = String(planNum).padStart(2, '0');
          const planId = `${paddedPhase}-${paddedPlan}`;

          plans.push({
            plan_id: planId,
            phase: planPhase,
            outcome_ids: intentInfo ? intentInfo.outcome_ids : [],
            rationale: intentInfo ? intentInfo.rationale : '',
          });
        }
      }
    } catch (e) {
      debugLog('intent.trace', 'scan phase dirs failed', e);
    }
  }

  // Build traceability matrix
  const matrix = [];
  const gaps = [];
  let coveredCount = 0;

  for (const outcome of intentData.outcomes) {
    const tracingPlans = plans
      .filter(p => p.outcome_ids.includes(outcome.id))
      .map(p => p.plan_id);

    const entry = {
      outcome_id: outcome.id,
      priority: outcome.priority,
      text: outcome.text,
      plans: tracingPlans,
    };
    matrix.push(entry);

    if (tracingPlans.length === 0) {
      gaps.push({
        outcome_id: outcome.id,
        priority: outcome.priority,
        text: outcome.text,
      });
    } else {
      coveredCount++;
    }
  }

  const totalOutcomes = intentData.outcomes.length;
  const coveragePercent = totalOutcomes > 0 ? Math.round((coveredCount / totalOutcomes) * 100) : 0;

  // Sort: gaps first (by priority P1→P3), then covered (by priority)
  const priorityOrder = (a, b) => {
    const pa = parseInt((a.priority || 'P9').replace('P', ''), 10);
    const pb = parseInt((b.priority || 'P9').replace('P', ''), 10);
    return pa - pb;
  };

  const sortedMatrix = [
    ...matrix.filter(m => m.plans.length === 0).sort(priorityOrder),
    ...matrix.filter(m => m.plans.length > 0).sort(priorityOrder),
  ];

  const result = {
    total_outcomes: totalOutcomes,
    covered_outcomes: coveredCount,
    coverage_percent: coveragePercent,
    matrix: gapsOnly ? gaps.sort(priorityOrder) : sortedMatrix,
    gaps: gaps.sort(priorityOrder),
    plans: plans.map(p => ({
      plan_id: p.plan_id,
      phase: p.phase,
      outcome_ids: p.outcome_ids,
    })),
  };

  if (raw) {
    output(result, false);
    return;
  }

  // Human-readable output
  const lines = [];
  lines.push('Intent Traceability — .planning/INTENT.md');
  lines.push(`Coverage: ${coveredCount}/${totalOutcomes} outcomes (${coveragePercent}%)`);
  lines.push('');

  if (gapsOnly) {
    // Show only gaps
    if (gaps.length === 0) {
      lines.push('  No gaps — all outcomes have at least one plan tracing to them.');
    } else {
      for (const gap of gaps.sort(priorityOrder)) {
        lines.push(`  ✗ ${gap.outcome_id} [${gap.priority}]: ${gap.text} → (no plans)`);
      }
    }
  } else {
    // Show full matrix sorted: gaps first, then covered
    for (const entry of sortedMatrix) {
      if (entry.plans.length === 0) {
        lines.push(`  ✗ ${entry.outcome_id} [${entry.priority}]: ${entry.text} → (no plans)`);
      } else {
        lines.push(`  ✓ ${entry.outcome_id} [${entry.priority}]: ${entry.text} → ${entry.plans.join(', ')}`);
      }
    }
  }

  if (gaps.length > 0) {
    lines.push('');
    // Count gaps by priority
    const gapCounts = {};
    for (const g of gaps) {
      gapCounts[g.priority] = (gapCounts[g.priority] || 0) + 1;
    }
    const gapParts = Object.entries(gapCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([p, c]) => `${c}×${p}`);
    lines.push(`Gaps: ${gaps.length} outcomes uncovered (${gapParts.join(', ')})`);
  }

  output(null, true, lines.join('\n') + '\n');
}

// ─── Intent Drift (Validation) ───────────────────────────────────────────────

/**
 * Calculate drift score from raw signal data.
 * Weights: coverage_gap 40, objective_mismatch 25, feature_creep 15, priority_inversion 20.
 * P1 gaps weighted 3x, P2 gaps weighted 2x, P3 gaps weighted 1x.
 * Score 0 = perfect alignment, 100 = total drift.
 */
function calculateDriftScore(data) {
  const { outcomes, plans, signalData } = data;
  const totalOutcomes = outcomes.length;
  const totalPlans = plans.length;

  // Coverage gap component (40 pts max)
  let coverageGap = 0;
  if (totalOutcomes > 0) {
    let weightedGapSum = 0;
    let weightedTotal = 0;
    for (const o of outcomes) {
      const weight = o.priority === 'P1' ? 3 : o.priority === 'P2' ? 2 : 1;
      weightedTotal += weight;
      if (!signalData.coveredOutcomeIds.has(o.id)) {
        weightedGapSum += weight;
      }
    }
    coverageGap = weightedTotal > 0 ? (weightedGapSum / weightedTotal) * 40 : 0;
  }

  // Objective mismatch component (25 pts max)
  let objectiveMismatch = 0;
  if (totalPlans > 0) {
    const untracedCount = signalData.untracedPlans.length;
    objectiveMismatch = (untracedCount / totalPlans) * 25;
  }

  // Feature creep component (15 pts max)
  let featureCreep = 0;
  const totalRefs = signalData.totalOutcomeRefs;
  if (totalRefs > 0) {
    featureCreep = (signalData.invalidRefs.length / totalRefs) * 15;
  }

  // Priority inversion component (20 pts max)
  const priorityInversion = signalData.inversions.length > 0 ? 20 : 0;

  const score = Math.round(Math.min(100, Math.max(0, coverageGap + objectiveMismatch + featureCreep + priorityInversion)));

  return {
    score,
    components: {
      coverage_gap: Math.round(coverageGap * 10) / 10,
      objective_mismatch: Math.round(objectiveMismatch * 10) / 10,
      feature_creep: Math.round(featureCreep * 10) / 10,
      priority_inversion: Math.round(priorityInversion * 10) / 10,
    },
  };
}

/**
 * Get alignment label from drift score.
 */
function getAlignmentLabel(score) {
  if (score <= 15) return 'excellent';
  if (score <= 35) return 'good';
  if (score <= 60) return 'moderate';
  return 'poor';
}

/**
 * Get intent drift data without formatting output.
 * Exported for use by init commands (advisory pre-flight).
 *
 * @param {string} cwd - project root
 * @returns {{ drift_score, alignment, signals, total_outcomes, covered_outcomes, total_plans, traced_plans } | null}
 */
function getIntentDriftData(cwd) {
  const planningDir = path.join(cwd, '.planning');
  const intentPath = path.join(planningDir, 'INTENT.md');

  if (!fs.existsSync(intentPath)) return null;

  const intentContent = fs.readFileSync(intentPath, 'utf-8');
  const intentData = parseIntentMd(intentContent);

  if (!intentData.outcomes || intentData.outcomes.length === 0) return null;

  const outcomes = intentData.outcomes;
  const validOutcomeIds = new Set(outcomes.map(o => o.id));

  // Get milestone info for phase range scoping
  const milestone = getMilestoneInfo(cwd);
  const phaseRange = milestone.phaseRange;

  // Scan phase directories for PLAN.md files
  const phasesDir = path.join(planningDir, 'phases');
  const plans = [];

  if (fs.existsSync(phasesDir)) {
    try {
      const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
      const phaseDirs = entries
        .filter(e => e.isDirectory())
        .map(e => e.name)
        .sort();

      for (const dir of phaseDirs) {
        const phaseNumMatch = dir.match(/^(\d+)/);
        if (phaseNumMatch && phaseRange) {
          const phaseNum = parseInt(phaseNumMatch[1], 10);
          if (phaseNum < phaseRange.start || phaseNum > phaseRange.end) continue;
        }

        const phaseDir = path.join(phasesDir, dir);
        const files = fs.readdirSync(phaseDir);
        const planFiles = files.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').sort();

        for (const planFile of planFiles) {
          const planPath = path.join(phaseDir, planFile);
          const planContent = fs.readFileSync(planPath, 'utf-8');
          const fm = extractFrontmatter(planContent);
          const intentInfo = parsePlanIntent(planContent);

          const planPhase = fm.phase || dir;
          const planNum = fm.plan || planFile.replace(/-PLAN\.md$/, '').split('-').pop() || '01';
          const paddedPhase = normalizePhaseName(planPhase);
          const paddedPlan = String(planNum).padStart(2, '0');
          const planId = `${paddedPhase}-${paddedPlan}`;

          plans.push({
            plan_id: planId,
            phase: planPhase,
            outcome_ids: intentInfo ? intentInfo.outcome_ids : [],
          });
        }
      }
    } catch (e) {
      debugLog('intent.drift', 'scan phase dirs failed', e);
    }
  }

  // Signal 1: Coverage gaps — outcomes with no plans
  const coveredOutcomeIds = new Set();
  for (const plan of plans) {
    for (const id of plan.outcome_ids) {
      if (validOutcomeIds.has(id)) {
        coveredOutcomeIds.add(id);
      }
    }
  }

  const coverageGapDetails = outcomes
    .filter(o => !coveredOutcomeIds.has(o.id))
    .sort((a, b) => {
      const pa = parseInt(a.priority.replace('P', ''), 10);
      const pb = parseInt(b.priority.replace('P', ''), 10);
      return pa - pb;
    })
    .map(o => ({ outcome_id: o.id, priority: o.priority, text: o.text }));

  // Signal 2: Objective mismatch — plans with no intent section or empty outcome_ids
  const untracedPlans = plans
    .filter(p => p.outcome_ids.length === 0)
    .map(p => p.plan_id);

  // Signal 3: Feature creep — plans referencing non-existent outcome IDs
  const invalidRefs = [];
  let totalOutcomeRefs = 0;
  for (const plan of plans) {
    for (const id of plan.outcome_ids) {
      totalOutcomeRefs++;
      if (!validOutcomeIds.has(id)) {
        invalidRefs.push({ plan_id: plan.plan_id, invalid_id: id });
      }
    }
  }

  // Signal 4: Priority inversion — uncovered P1 while P2/P3 covered
  const inversions = [];
  const uncoveredP1 = outcomes.filter(o => o.priority === 'P1' && !coveredOutcomeIds.has(o.id));
  const coveredP2P3 = outcomes.filter(o =>
    (o.priority === 'P2' || o.priority === 'P3') && coveredOutcomeIds.has(o.id)
  );

  for (const p1 of uncoveredP1) {
    for (const lower of coveredP2P3) {
      const lowerPlanCount = plans.filter(p => p.outcome_ids.includes(lower.id)).length;
      inversions.push({
        uncovered: { outcome_id: p1.id, priority: p1.priority, text: p1.text },
        covered: { outcome_id: lower.id, priority: lower.priority, text: lower.text, plan_count: lowerPlanCount },
      });
    }
  }

  // Calculate drift score
  const signalData = {
    coveredOutcomeIds,
    untracedPlans,
    invalidRefs,
    totalOutcomeRefs,
    inversions,
  };

  const { score, components } = calculateDriftScore({ outcomes, plans, signalData });
  const alignment = getAlignmentLabel(score);

  return {
    drift_score: score,
    alignment,
    signals: {
      coverage_gap: {
        score: components.coverage_gap,
        details: coverageGapDetails,
      },
      objective_mismatch: {
        score: components.objective_mismatch,
        plans: untracedPlans,
      },
      feature_creep: {
        score: components.feature_creep,
        invalid_refs: invalidRefs,
      },
      priority_inversion: {
        score: components.priority_inversion,
        inversions: inversions.map(inv => ({
          uncovered_id: inv.uncovered.outcome_id,
          uncovered_priority: inv.uncovered.priority,
          covered_id: inv.covered.outcome_id,
          covered_priority: inv.covered.priority,
          covered_plan_count: inv.covered.plan_count,
        })),
      },
    },
    total_outcomes: outcomes.length,
    covered_outcomes: coveredOutcomeIds.size,
    total_plans: plans.length,
    traced_plans: plans.length - untracedPlans.length,
  };
}

function cmdIntentDrift(cwd, args, raw) {
  const planningDir = path.join(cwd, '.planning');
  const intentPath = path.join(planningDir, 'INTENT.md');

  if (!fs.existsSync(intentPath)) {
    error('No INTENT.md found. Run `intent create` first.');
  }

  const data = getIntentDriftData(cwd);

  if (!data) {
    error('INTENT.md has no desired outcomes defined.');
  }

  if (raw) {
    output(data, false);
    return;
  }

  // Human-readable output
  const isTTY = process.stdout.isTTY;
  const lines = [];

  // Score with color
  let scoreLabel = `${data.drift_score}/100 (${data.alignment})`;
  if (isTTY) {
    if (data.alignment === 'excellent') scoreLabel = `\x1b[32m${scoreLabel}\x1b[0m`;
    else if (data.alignment === 'moderate') scoreLabel = `\x1b[33m${scoreLabel}\x1b[0m`;
    else if (data.alignment === 'poor') scoreLabel = `\x1b[31m${scoreLabel}\x1b[0m`;
  }

  lines.push('Intent Drift Analysis');
  lines.push(`Score: ${scoreLabel}`);
  lines.push('');

  // Coverage Gaps
  const cg = data.signals.coverage_gap;
  lines.push(`Coverage Gaps (${cg.score} pts):`);
  if (cg.details.length === 0) {
    lines.push('  ✓ All outcomes have plans');
  } else {
    for (const gap of cg.details) {
      lines.push(`  ✗ ${gap.outcome_id} [${gap.priority}]: ${gap.text} — no plans`);
    }
  }
  lines.push('');

  // Objective Mismatch
  const om = data.signals.objective_mismatch;
  lines.push(`Objective Mismatch (${om.score} pts):`);
  if (om.plans.length === 0) {
    lines.push('  ✓ All plans have intent sections');
  } else {
    for (const planId of om.plans) {
      lines.push(`  ✗ ${planId}: no intent section in frontmatter`);
    }
  }
  lines.push('');

  // Feature Creep
  const fc = data.signals.feature_creep;
  lines.push(`Feature Creep (${fc.score} pts):`);
  if (fc.invalid_refs.length === 0) {
    lines.push('  ✓ No invalid outcome references');
  } else {
    for (const ref of fc.invalid_refs) {
      lines.push(`  ✗ ${ref.plan_id}: references non-existent ${ref.invalid_id}`);
    }
  }
  lines.push('');

  // Priority Inversion
  const pi = data.signals.priority_inversion;
  lines.push(`Priority Inversion (${pi.score} pts):`);
  if (pi.inversions.length === 0) {
    lines.push('  ✓ No priority inversions');
  } else {
    for (const inv of pi.inversions) {
      lines.push(`  ⚠ ${inv.uncovered_id} [${inv.uncovered_priority}] uncovered, but ${inv.covered_id} [${inv.covered_priority}] has ${inv.covered_plan_count} plan${inv.covered_plan_count !== 1 ? 's' : ''}`);
    }
  }
  lines.push('');

  // Summary
  lines.push(`Summary: ${data.covered_outcomes}/${data.total_outcomes} outcomes covered, ${data.traced_plans}/${data.total_plans} plans traced`);

  output(null, true, lines.join('\n') + '\n');
}

module.exports = {
  cmdIntentCreate,
  cmdIntentShow,
  cmdIntentUpdate,
  cmdIntentValidate,
  cmdIntentTrace,
  cmdIntentDrift,
  getIntentDriftData,
};
