'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { output, error, debugLog } = require('../lib/output');
const { getDb } = require('../lib/db');
const { PlanningCache } = require('../lib/planning-cache');

// ─── Lesson Schema ────────────────────────────────────────────────────────────

const LESSON_SCHEMA = {
  required: ['title', 'severity', 'type', 'root_cause', 'prevention_rule', 'affected_agents'],
  severity_values: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
  type_values: ['workflow', 'agent-behavior', 'tooling', 'environment'],
};

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate and normalize a lesson entry.
 * Returns { valid: true, normalized } or { valid: false, errors: [...] }
 */
function validateLesson(entry) {
  const errors = [];
  const normalized = Object.assign({}, entry);

  for (const field of LESSON_SCHEMA.required) {
    const value = entry[field];
    if (field === 'affected_agents') {
      // Accept string or non-empty array
      if (
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0)
      ) {
        errors.push(`${field} is required`);
      }
    } else {
      if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
        errors.push(`${field} is required`);
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Normalize severity to uppercase
  const severityUpper = String(normalized.severity).toUpperCase();
  if (!LESSON_SCHEMA.severity_values.includes(severityUpper)) {
    errors.push(`severity must be one of: ${LESSON_SCHEMA.severity_values.join(', ')}`);
  } else {
    normalized.severity = severityUpper;
  }

  // Normalize type to lowercase
  const typeLower = String(normalized.type).toLowerCase();
  if (!LESSON_SCHEMA.type_values.includes(typeLower)) {
    errors.push(`type must be one of: ${LESSON_SCHEMA.type_values.join(', ')}`);
  } else {
    normalized.type = typeLower;
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Normalize affected_agents to array
  if (typeof normalized.affected_agents === 'string') {
    normalized.affected_agents = normalized.affected_agents
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }

  return { valid: true, normalized };
}

// ─── Helper: Read lessons store ───────────────────────────────────────────────

function readLessonsStore(cwd) {
  const memDir = path.join(cwd, '.planning', 'memory');
  fs.mkdirSync(memDir, { recursive: true });
  const filePath = path.join(memDir, 'lessons.json');
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function writeLessonsStore(cwd, entries) {
  const memDir = path.join(cwd, '.planning', 'memory');
  fs.mkdirSync(memDir, { recursive: true });
  const filePath = path.join(memDir, 'lessons.json');
  fs.writeFileSync(filePath, JSON.stringify(entries, null, 2), 'utf-8');
}

// ─── Capture ──────────────────────────────────────────────────────────────────

/**
 * Capture a structured lesson entry.
 * Options: title, severity, type, rootCause, prevention, agents
 */
function cmdLessonsCapture(cwd, options, raw) {
  const { title, severity, type, rootCause, prevention, agents } = options;

  const entry = {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    title: title || '',
    severity: severity || '',
    type: type || '',
    root_cause: rootCause || '',
    prevention_rule: prevention || '',
    affected_agents: agents || '',
  };

  const validation = validateLesson(entry);
  if (!validation.valid) {
    error(`Lesson validation failed:\n${validation.errors.map(e => `  - ${e}`).join('\n')}`);
    return;
  }

  const normalized = validation.normalized;

  const entries = readLessonsStore(cwd);
  entries.push(normalized);
  writeLessonsStore(cwd, entries);

  // Dual-write to SQLite (best-effort)
  try {
    const db = getDb(cwd);
    const cache = new PlanningCache(db);
    cache.writeMemoryEntry(cwd, 'lessons', normalized);
  } catch (e) {
    debugLog('lessons.capture', 'SQLite dual-write failed', e);
  }

  output({
    captured: true,
    id: normalized.id,
    title: normalized.title,
    severity: normalized.severity,
    type: normalized.type,
    entry_count: entries.length,
  });
}

// ─── Migrate ──────────────────────────────────────────────────────────────────

/**
 * Migrate free-form lessons.md to structured format.
 * Searches: cwd/lessons.md, cwd/tasks/lessons.md, cwd/.planning/lessons.md
 */
function cmdLessonsMigrate(cwd, options, raw) {
  const searchPaths = [
    path.join(cwd, 'lessons.md'),
    path.join(cwd, 'tasks', 'lessons.md'),
    path.join(cwd, '.planning', 'lessons.md'),
  ];

  const foundFiles = searchPaths.filter(p => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  });

  if (foundFiles.length === 0) {
    output({ migrated: 0, sources: [], message: 'No lessons.md files found to migrate' });
    return;
  }

  const existingEntries = readLessonsStore(cwd);
  const migrated = [];

  for (const filePath of foundFiles) {
    let content;
    let mtime;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
      mtime = fs.statSync(filePath).mtime.toISOString();
    } catch (e) {
      debugLog('lessons.migrate', `Failed to read ${filePath}`, e);
      continue;
    }

    // Split by ## or ### headings
    const sections = content.split(/^(?=#{2,3}\s)/m).filter(s => s.trim());

    for (const section of sections) {
      const lines = section.split('\n');
      const headingLine = lines[0] || '';
      const headingMatch = headingLine.match(/^#{2,3}\s+(.+)$/);
      if (!headingMatch) continue;

      const title = headingMatch[1].trim();
      if (!title) continue;

      // Extract body (lines after heading)
      const bodyLines = lines.slice(1).filter(l => l.trim());
      const bodyText = bodyLines.join('\n').trim();

      // Try to extract date from section (e.g. "2026-02-28: ...")
      let entryDate = mtime;
      const dateMatch = title.match(/^(\d{4}-\d{2}-\d{2})/) || bodyText.match(/^(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        try {
          entryDate = new Date(dateMatch[1]).toISOString();
        } catch {
          entryDate = mtime;
        }
      }

      // Root cause: first paragraph trimmed to 500 chars
      const rootCause = bodyText.substring(0, 500);

      const entry = {
        id: crypto.randomUUID(),
        date: entryDate,
        title,
        severity: 'MEDIUM',
        type: 'environment',
        root_cause: rootCause || 'Migrated from free-form lessons',
        prevention_rule: 'Migrated from free-form lessons — review and update',
        affected_agents: [],
        migrated_from: filePath,
      };

      migrated.push(entry);
    }
  }

  if (migrated.length === 0) {
    output({ migrated: 0, sources: foundFiles, message: 'No sections found in lessons files' });
    return;
  }

  const allEntries = existingEntries.concat(migrated);
  writeLessonsStore(cwd, allEntries);

  output({
    migrated: migrated.length,
    sources: foundFiles,
    entry_count: allEntries.length,
  });
}

// ─── List ─────────────────────────────────────────────────────────────────────

/**
 * List lesson entries with optional filters.
 * Options: type, severity, since, limit, query
 */
function cmdLessonsList(cwd, options, raw) {
  const { type, severity, since, limit, query } = options;

  let entries = readLessonsStore(cwd);
  const total = entries.length;

  // Filter by type
  if (type) {
    entries = entries.filter(e => e.type && e.type.toLowerCase() === type.toLowerCase());
  }

  // Filter by severity
  if (severity) {
    entries = entries.filter(e => e.severity && e.severity.toUpperCase() === severity.toUpperCase());
  }

  // Filter by since (ISO date string comparison)
  if (since) {
    entries = entries.filter(e => e.date && e.date >= since);
  }

  // Filter by query (case-insensitive substring on title, root_cause, prevention_rule)
  if (query) {
    const q = query.toLowerCase();
    entries = entries.filter(e => {
      return (
        (e.title && e.title.toLowerCase().includes(q)) ||
        (e.root_cause && e.root_cause.toLowerCase().includes(q)) ||
        (e.prevention_rule && e.prevention_rule.toLowerCase().includes(q))
      );
    });
  }

  // Sort by date descending (newest first)
  entries = entries.slice().sort((a, b) => {
    const da = a.date || '';
    const db = b.date || '';
    return db.localeCompare(da);
  });

  // Apply limit (default 20)
  const maxResults = limit ? parseInt(limit, 10) : 20;
  const limited = entries.slice(0, maxResults);

  const filters = {};
  if (type) filters.type = type;
  if (severity) filters.severity = severity;
  if (since) filters.since = since;
  if (query) filters.query = query;

  output({
    entries: limited,
    count: limited.length,
    filtered_total: entries.length,
    total,
    filters,
  });
}

// ─── Severity ordering ────────────────────────────────────────────────────────

const SEVERITY_ORDER = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

// ─── Analyze ──────────────────────────────────────────────────────────────────

/**
 * Analyze recurrent patterns across lessons, grouped by affected agent + type.
 * Only shows groups with ≥2 supporting lessons (LESSON-04).
 * Options: agent (filter to specific agent)
 */
function cmdLessonsAnalyze(cwd, options, raw) {
  const { agent } = options;

  const entries = readLessonsStore(cwd);

  // Build per-agent groups: { agentName: { type: [entries] } }
  const agentTypeMap = {};
  for (const entry of entries) {
    const agents = Array.isArray(entry.affected_agents)
      ? entry.affected_agents
      : (typeof entry.affected_agents === 'string' && entry.affected_agents.trim()
          ? entry.affected_agents.split(',').map(s => s.trim()).filter(Boolean)
          : []);

    for (const agentName of agents) {
      if (!agentTypeMap[agentName]) agentTypeMap[agentName] = {};
      const type = entry.type || 'unknown';
      if (!agentTypeMap[agentName][type]) agentTypeMap[agentName][type] = [];
      agentTypeMap[agentName][type].push(entry);
    }
  }

  // Build groups with ≥2 lessons
  const groups = [];
  for (const [agentName, typeMap] of Object.entries(agentTypeMap)) {
    // Apply --agent filter
    if (agent && agentName !== agent) continue;

    for (const [type, typeEntries] of Object.entries(typeMap)) {
      if (typeEntries.length < 2) continue;

      // Severity distribution
      const severityDist = {};
      for (const e of typeEntries) {
        const sev = e.severity || 'UNKNOWN';
        severityDist[sev] = (severityDist[sev] || 0) + 1;
      }

      // Deduplicated root causes
      const rootCauses = [];
      const seen = new Set();
      for (const e of typeEntries) {
        if (e.root_cause && !seen.has(e.root_cause)) {
          seen.add(e.root_cause);
          rootCauses.push(e.root_cause);
        }
      }

      groups.push({
        agent: agentName,
        pattern_type: type,
        count: typeEntries.length,
        severity_distribution: severityDist,
        common_root_causes: rootCauses,
        lessons: typeEntries.map(e => ({
          id: e.id,
          title: e.title,
          date: e.date,
          severity: e.severity,
        })),
      });
    }
  }

  // Sort by count descending
  groups.sort((a, b) => b.count - a.count);

  output({
    groups,
    group_count: groups.length,
    total_lessons_analyzed: entries.length,
    filter: agent ? { agent } : null,
  });
}

// ─── Suggest ──────────────────────────────────────────────────────────────────

/**
 * Map lesson type to suggestion_type.
 */
function getSuggestionType(type) {
  if (type === 'agent-behavior') return 'behavioral';
  if (type === 'workflow') return 'workflow';
  if (type === 'tooling') return 'tooling';
  return 'general';
}

/**
 * Generate structured improvement suggestions from lesson patterns.
 * Excludes type:environment entries (LESSON-02 sentinel).
 * Only groups with ≥2 lessons (LESSON-05).
 * Options: agent (filter to specific agent)
 */
function cmdLessonsSuggest(cwd, options, raw) {
  const { agent } = options;

  const allEntries = readLessonsStore(cwd);

  // Exclude type:environment (migrated free-form lessons)
  const entries = allEntries.filter(e => e.type !== 'environment');

  // Build per-agent groups: { agentName: { type: [entries] } }
  const agentTypeMap = {};
  for (const entry of entries) {
    const agents = Array.isArray(entry.affected_agents)
      ? entry.affected_agents
      : (typeof entry.affected_agents === 'string' && entry.affected_agents.trim()
          ? entry.affected_agents.split(',').map(s => s.trim()).filter(Boolean)
          : []);

    for (const agentName of agents) {
      if (!agentTypeMap[agentName]) agentTypeMap[agentName] = {};
      const type = entry.type || 'unknown';
      if (!agentTypeMap[agentName][type]) agentTypeMap[agentName][type] = [];
      agentTypeMap[agentName][type].push(entry);
    }
  }

  const suggestions = [];

  for (const [agentName, typeMap] of Object.entries(agentTypeMap)) {
    // Apply --agent filter
    if (agent && agentName !== agent) continue;

    for (const [type, typeEntries] of Object.entries(typeMap)) {
      if (typeEntries.length < 2) continue;

      // Deduplicated prevention rules
      const preventionRules = [];
      const seenRules = new Set();
      for (const e of typeEntries) {
        if (e.prevention_rule && !seenRules.has(e.prevention_rule)) {
          seenRules.add(e.prevention_rule);
          preventionRules.push(e.prevention_rule);
        }
      }

      // Deduplicated root causes
      const rootCauses = [];
      const seenCauses = new Set();
      for (const e of typeEntries) {
        if (e.root_cause && !seenCauses.has(e.root_cause)) {
          seenCauses.add(e.root_cause);
          rootCauses.push(e.root_cause);
        }
      }

      // Highest severity in group
      let highestSev = 'LOW';
      for (const e of typeEntries) {
        const sev = e.severity || 'LOW';
        if ((SEVERITY_ORDER[sev] || 0) > (SEVERITY_ORDER[highestSev] || 0)) {
          highestSev = sev;
        }
      }

      // Synthesize summary
      const rootCausePattern = rootCauses.slice(0, 2).join('; ');
      const preventionSummary = preventionRules.slice(0, 2).join('; ');
      const summary = `Agent ${agentName} repeatedly encounters: ${rootCausePattern}. Consider: ${preventionSummary}`;

      suggestions.push({
        agent: agentName,
        suggestion_type: getSuggestionType(type),
        summary,
        supporting_lessons: {
          count: typeEntries.length,
          ids: typeEntries.map(e => e.id).filter(Boolean),
        },
        severity: highestSev,
        prevention_rules: preventionRules,
      });
    }
  }

  // Sort: severity descending, then supporting lesson count descending
  suggestions.sort((a, b) => {
    const sevDiff = (SEVERITY_ORDER[b.severity] || 0) - (SEVERITY_ORDER[a.severity] || 0);
    if (sevDiff !== 0) return sevDiff;
    return b.supporting_lessons.count - a.supporting_lessons.count;
  });

  output({
    suggestions,
    suggestion_count: suggestions.length,
    advisory_note: 'These are suggestions only — review and apply manually',
    filter: agent ? { agent } : null,
  });
}

// ─── Compact ──────────────────────────────────────────────────────────────────

/**
 * Deduplicate lessons store by normalized root_cause when above threshold.
 * Options: threshold (default 100)
 */
function cmdLessonsCompact(cwd, options, raw) {
  const threshold = options.threshold !== undefined ? parseInt(options.threshold, 10) : 100;

  const entries = readLessonsStore(cwd);
  const count = entries.length;

  if (count < threshold) {
    output({
      compacted: false,
      reason: 'Below threshold',
      count,
      threshold,
    });
    return;
  }

  // Group by normalized root_cause
  const rootCauseGroups = {};
  for (const entry of entries) {
    const key = (entry.root_cause || '').toLowerCase().trim();
    if (!rootCauseGroups[key]) rootCauseGroups[key] = [];
    rootCauseGroups[key].push(entry);
  }

  const result = [];
  let groupsMerged = 0;

  for (const [key, group] of Object.entries(rootCauseGroups)) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }

    groupsMerged++;

    // Keep entry with latest date
    const sorted = group.slice().sort((a, b) => {
      const da = a.date || '';
      const db = b.date || '';
      return db.localeCompare(da);
    });
    const kept = Object.assign({}, sorted[0]);

    // Merge unique prevention rules
    const seenRules = new Set();
    const mergedRules = [];
    for (const e of group) {
      const rule = e.prevention_rule || '';
      if (rule && !seenRules.has(rule)) {
        seenRules.add(rule);
        mergedRules.push(rule);
      }
    }
    if (mergedRules.length > 1) {
      kept.prevention_rule = mergedRules.join(' | ');
    }

    // Preserve highest severity
    let highestSev = kept.severity || 'LOW';
    for (const e of group) {
      const sev = e.severity || 'LOW';
      if ((SEVERITY_ORDER[sev] || 0) > (SEVERITY_ORDER[highestSev] || 0)) {
        highestSev = sev;
      }
    }
    kept.severity = highestSev;

    // Record compaction metadata
    kept.compacted_from = group.length;

    result.push(kept);
  }

  writeLessonsStore(cwd, result);

  // Clear and rewrite SQLite entries if available (best-effort)
  try {
    const db = getDb(cwd);
    const cache = new PlanningCache(db);
    for (const entry of result) {
      cache.writeMemoryEntry(cwd, 'lessons', entry);
    }
  } catch (e) {
    debugLog('lessons.compact', 'SQLite rewrite failed (non-blocking)', e);
  }

  output({
    compacted: true,
    before: count,
    after: result.length,
    removed: count - result.length,
    groups_merged: groupsMerged,
  });
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  LESSON_SCHEMA,
  validateLesson,
  cmdLessonsCapture,
  cmdLessonsMigrate,
  cmdLessonsList,
  cmdLessonsAnalyze,
  cmdLessonsSuggest,
  cmdLessonsCompact,
};
