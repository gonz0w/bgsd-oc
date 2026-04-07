const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { output, error, debugLog } = require('../lib/output');
const { getDb } = require('../lib/db');
const { PlanningCache } = require('../lib/planning-cache');
const { mutateJsonStore } = require('../lib/json-store-mutator');
const { writeFileAtomic } = require('../lib/atomic-write');

// ─── Memory Commands ─────────────────────────────────────────────────────────

const VALID_STORES = ['decisions', 'bookmarks', 'lessons', 'todos', 'trajectories'];
const SACRED_STORES = ['decisions', 'lessons', 'trajectories'];
const BOOKMARKS_MAX = 20;
const COMPACT_THRESHOLD = 50;
const COMPACT_KEEP_RECENT = 10;
const VALID_CATEGORIES = ['decision', 'observation', 'correction', 'hypothesis'];
const VALID_CONFIDENCE = ['high', 'medium', 'low'];

const MEMORY_FILE = path.join('.planning', 'MEMORY.md');
const MEMORY_TITLE = '# Agent Memory';
const MEMORY_SECTIONS = [
  'Active / Recent',
  'Project Facts',
  'User Preferences',
  'Environment Patterns',
  'Correction History',
];
const MEMORY_SECTION_DEFAULT_TYPE = {
  'Active / Recent': 'project-fact',
  'Project Facts': 'project-fact',
  'User Preferences': 'user-preference',
  'Environment Patterns': 'environment-pattern',
  'Correction History': 'correction',
};
const MEMORY_ALLOWED_TYPES = ['project-fact', 'user-preference', 'environment-pattern', 'correction'];
const MEMORY_METADATA_ORDER = ['Added', 'Updated', 'Source', 'Keep', 'Status', 'Expires', 'Replaces'];
const MEMORY_METADATA_REQUIRED = ['Added', 'Updated'];
const MEMORY_KEEP_ALWAYS = new Set(['always', 'pinned', 'pin', 'true', 'yes']);
const MEMORY_ACTIVE_STATUSES = new Set(['active', 'current', 'in-use', 'in_use']);
const DEFAULT_PRUNE_THRESHOLD_DAYS = 90;

// Store name → filename overrides (default: `${store}.json`)
const STORE_FILES = { trajectories: 'trajectory.json' };
const SQLITE_MEMORY_STORES = new Set(['decisions', 'bookmarks', 'lessons', 'trajectories']);

function storeFilename(store) {
  return STORE_FILES[store] || `${store}.json`;
}

function getMemoryFilePath(cwd) {
  return path.join(cwd, MEMORY_FILE);
}

function normalizeMemorySection(section) {
  if (!section) return null;
  const trimmed = String(section).trim().toLowerCase();
  const match = MEMORY_SECTIONS.find(name => name.toLowerCase() === trimmed);
  return match || null;
}

function normalizeMemoryType(type, section) {
  if (!type || !String(type).trim()) {
    return MEMORY_SECTION_DEFAULT_TYPE[section] || 'project-fact';
  }
  const trimmed = String(type).trim().toLowerCase();
  if (!MEMORY_ALLOWED_TYPES.includes(trimmed)) {
    error(`Invalid --type. Must be one of: ${MEMORY_ALLOWED_TYPES.join(', ')}`);
  }
  return trimmed;
}

function canonicalMetadataKey(key) {
  if (!key) return null;
  const trimmed = String(key).trim().toLowerCase();
  const match = MEMORY_METADATA_ORDER.find(name => name.toLowerCase() === trimmed);
  return match || null;
}

function currentMemoryDate() {
  return new Date().toISOString().split('T')[0];
}

function parseMemoryDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00.000Z` : raw;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function diffDays(from, to) {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / 86400000);
}

function normalizeMemoryText(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function redactMemoryText(value, max = 72) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function sortMemoryMetadata(metadata) {
  const ordered = {};
  for (const key of MEMORY_METADATA_ORDER) {
    if (metadata[key] !== undefined && metadata[key] !== null && String(metadata[key]).trim() !== '') {
      ordered[key] = String(metadata[key]).trim();
    }
  }
  return ordered;
}

function createEmptyStructuredMemory() {
  return {
    title: MEMORY_TITLE,
    sections: MEMORY_SECTIONS.map(name => ({ name, entries: [] })),
  };
}

function structuredMemoryToMap(doc) {
  const map = new Map();
  for (const section of doc.sections) {
    map.set(section.name, section);
  }
  return map;
}

function serializeStructuredMemory(doc) {
  const lines = [doc.title || MEMORY_TITLE, ''];
  const sectionMap = structuredMemoryToMap(doc);

  for (const sectionName of MEMORY_SECTIONS) {
    const section = sectionMap.get(sectionName) || { name: sectionName, entries: [] };
    lines.push(`## ${sectionName}`);

    for (const entry of section.entries) {
      lines.push(`- **${entry.id}** [${entry.type}] ${entry.text}`);
      const metadata = sortMemoryMetadata(entry.metadata || {});
      for (const key of MEMORY_METADATA_ORDER) {
        if (metadata[key]) {
          lines.push(`  - ${key}: ${metadata[key]}`);
        }
      }
      lines.push('');
    }

    if (lines[lines.length - 1] === '') {
      // keep a single blank line between sections
    } else {
      lines.push('');
    }
  }

  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return `${lines.join('\n')}\n`;
}

function parseStructuredMemory(content) {
  const lines = String(content || '').replace(/\r\n/g, '\n').split('\n');
  const doc = createEmptyStructuredMemory();
  const sectionMap = structuredMemoryToMap(doc);

  let currentSection = null;
  let currentEntry = null;

  function finalizeEntry() {
    if (!currentSection || !currentEntry) return;
    const metadata = { ...(currentEntry.metadata || {}) };
    const today = currentMemoryDate();
    if (!metadata.Added) metadata.Added = today;
    if (!metadata.Updated) metadata.Updated = metadata.Added || today;
    currentEntry.metadata = sortMemoryMetadata(metadata);
    currentSection.entries.push(currentEntry);
    currentEntry = null;
  }

  for (const line of lines) {
    const sectionMatch = line.match(/^##\s+(.+?)\s*$/);
    if (sectionMatch) {
      finalizeEntry();
      currentSection = sectionMap.get(normalizeMemorySection(sectionMatch[1]));
      continue;
    }

    if (!currentSection) continue;

    const entryMatch = line.match(/^-\s+\*\*(MEM-\d+)\*\*(?:\s+\[([^\]]+)\])?\s+(.+?)\s*$/);
    if (entryMatch) {
      finalizeEntry();
      currentEntry = {
        id: entryMatch[1],
        type: normalizeMemoryType(entryMatch[2], currentSection.name),
        text: entryMatch[3].trim(),
        metadata: {},
      };
      continue;
    }

    const metadataMatch = line.match(/^\s{2,}-\s+([^:]+):\s*(.*?)\s*$/);
    if (metadataMatch && currentEntry) {
      const key = canonicalMetadataKey(metadataMatch[1]);
      if (key) currentEntry.metadata[key] = metadataMatch[2];
    }
  }

  finalizeEntry();
  return doc;
}

function ensureStructuredMemoryFile(cwd) {
  const filePath = getMemoryFilePath(cwd);
  if (!fs.existsSync(filePath)) {
    writeFileAtomic(filePath, serializeStructuredMemory(createEmptyStructuredMemory()));
  }
  return filePath;
}

function loadStructuredMemory(cwd) {
  const filePath = ensureStructuredMemoryFile(cwd);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const doc = parseStructuredMemory(raw);
  return { filePath, doc };
}

function writeStructuredMemory(cwd, doc) {
  const filePath = ensureStructuredMemoryFile(cwd);
  writeFileAtomic(filePath, serializeStructuredMemory(doc));
  return filePath;
}

function getAllStructuredEntries(doc) {
  return doc.sections.flatMap(section => section.entries.map(entry => ({ ...entry, section: section.name })));
}

function nextStructuredMemoryId(doc) {
  const max = getAllStructuredEntries(doc).reduce((highest, entry) => {
    const match = entry.id && entry.id.match(/^MEM-(\d+)$/);
    const value = match ? parseInt(match[1], 10) : 0;
    return Math.max(highest, value);
  }, 0);
  return `MEM-${String(max + 1).padStart(3, '0')}`;
}

function buildStructuredListPayload(doc, filePath) {
  const sections = MEMORY_SECTIONS.map(name => {
    const section = doc.sections.find(item => item.name === name) || { name, entries: [] };
    return {
      name,
      count: section.entries.length,
      entries: section.entries.map(entry => ({
        id: entry.id,
        type: entry.type,
        text: entry.text,
        metadata: sortMemoryMetadata(entry.metadata || {}),
      })),
    };
  });

  return {
    file: filePath,
    section_order: MEMORY_SECTIONS.slice(),
    total_entries: sections.reduce((sum, section) => sum + section.count, 0),
    sections,
  };
}

function getReplacedIds(doc) {
  const replaced = new Set();
  for (const entry of getAllStructuredEntries(doc)) {
    const value = entry.metadata && entry.metadata.Replaces;
    if (!value) continue;
    for (const part of String(value).split(',')) {
      const trimmed = part.trim();
      if (trimmed) replaced.add(trimmed);
    }
  }
  return replaced;
}

function getDuplicateIds(doc) {
  const groups = new Map();
  for (const entry of getAllStructuredEntries(doc)) {
    const key = `${entry.type}::${normalizeMemoryText(entry.text)}`;
    const list = groups.get(key) || [];
    list.push(entry);
    groups.set(key, list);
  }

  const duplicates = new Set();
  for (const entries of groups.values()) {
    if (entries.length < 2) continue;
    const sorted = entries.slice().sort((a, b) => {
      const aDate = parseMemoryDate(a.metadata && (a.metadata.Updated || a.metadata.Added));
      const bDate = parseMemoryDate(b.metadata && (b.metadata.Updated || b.metadata.Added));
      return (bDate ? bDate.getTime() : 0) - (aDate ? aDate.getTime() : 0);
    });
    for (let i = 1; i < sorted.length; i++) duplicates.add(sorted[i].id);
  }
  return duplicates;
}

function computePruneCandidates(doc, thresholdDays = DEFAULT_PRUNE_THRESHOLD_DAYS) {
  const now = new Date();
  const replacedIds = getReplacedIds(doc);
  const duplicateIds = getDuplicateIds(doc);
  const candidates = [];

  for (const section of doc.sections) {
    for (const entry of section.entries) {
      const metadata = entry.metadata || {};
      if (section.name === 'Active / Recent') continue;

      const keepValue = normalizeMemoryText(metadata.Keep);
      if (MEMORY_KEEP_ALWAYS.has(keepValue)) continue;

      const statusValue = normalizeMemoryText(metadata.Status);
      if (MEMORY_ACTIVE_STATUSES.has(statusValue)) continue;

      const updatedAt = parseMemoryDate(metadata.Updated) || parseMemoryDate(metadata.Added);
      const ageDays = updatedAt ? diffDays(updatedAt, now) : null;

      let reason = null;
      if (replacedIds.has(entry.id)) {
        reason = 'superseded';
      } else if (duplicateIds.has(entry.id)) {
        reason = 'duplicate';
      } else if (statusValue === 'inactive' || statusValue === 'stale' || statusValue === 'archived') {
        reason = 'inactive';
      } else if (ageDays !== null && ageDays >= thresholdDays) {
        reason = 'old';
      }

      if (!reason) continue;
      if (ageDays !== null && ageDays < thresholdDays && (reason === 'inactive' || reason === 'duplicate' || reason === 'superseded')) {
        continue;
      }

      candidates.push({
        id: entry.id,
        type: entry.type,
        section: section.name,
        reason,
        age_days: ageDays,
        text: redactMemoryText(entry.text),
      });
    }
  }

  return candidates.sort((a, b) => {
    if ((b.age_days || 0) !== (a.age_days || 0)) return (b.age_days || 0) - (a.age_days || 0);
    return a.id.localeCompare(b.id);
  });
}

function parseOptionValue(restArgs, flag) {
  const idx = restArgs.indexOf(flag);
  if (idx === -1 || idx === restArgs.length - 1) return null;
  return restArgs[idx + 1];
}

/**
 * Ensure .planning/memory/ directory exists.
 * Returns the directory path.
 */
function cmdMemoryEnsureDir(cwd) {
  const dir = path.join(cwd, '.planning', 'memory');
  fs.mkdirSync(dir, { recursive: true });
  output({ ensured: true, memory_dir: dir });
}

/**
 * Write an entry to a memory store.
 * Options: store (required), entry (required, JSON string)
 */
function cmdMemoryWrite(cwd, options, raw) {
  const { store, entry: entryJson } = options;

  if (!store || !VALID_STORES.includes(store)) {
    error(`Invalid or missing store. Must be one of: ${VALID_STORES.join(', ')}`);
  }
  if (!entryJson) {
    error('Missing --entry (JSON string)');
  }

  // Sacred data boundary: decisions, lessons, trajectories always use the canonical
  // single-write path. Batch operations are prohibited for sacred stores.
  if (SACRED_STORES.includes(store)) {
    // Route to canonical single-write path — NEVER batch
  }

  let entry;
  try {
    entry = JSON.parse(entryJson);
  } catch (e) {
    error(`Invalid JSON in --entry: ${e.message}`);
  }

  const memDir = path.join(cwd, '.planning', 'memory');
  fs.mkdirSync(memDir, { recursive: true });

  const filePath = path.join(memDir, storeFilename(store));

  const mutation = mutateJsonStore(cwd, {
    filePath,
    defaultValue: [],
    transform(currentEntries) {
      const entries = Array.isArray(currentEntries) ? currentEntries : [];
      const nextEntry = { ...entry };

      if (!nextEntry.timestamp) {
        nextEntry.timestamp = new Date().toISOString();
      }

      if (store === 'trajectories') {
        if (!nextEntry.category || !VALID_CATEGORIES.includes(nextEntry.category)) {
          error(`Invalid or missing category. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
        }
        if (!nextEntry.text || typeof nextEntry.text !== 'string' || nextEntry.text.trim() === '') {
          error('Missing or empty text field. Trajectory entries require non-empty text.');
        }
        if (nextEntry.confidence !== undefined && !VALID_CONFIDENCE.includes(nextEntry.confidence)) {
          error(`Invalid confidence. Must be one of: ${VALID_CONFIDENCE.join(', ')}`);
        }
        if (nextEntry.tags !== undefined) {
          if (!Array.isArray(nextEntry.tags) || !nextEntry.tags.every(t => typeof t === 'string')) {
            error('Invalid tags. Must be an array of strings.');
          }
        }
        if (nextEntry.references !== undefined) {
          if (!Array.isArray(nextEntry.references) || !nextEntry.references.every(r => typeof r === 'string')) {
            error('Invalid references. Must be an array of strings.');
          }
        }
        if (nextEntry.phase !== undefined && typeof nextEntry.phase !== 'string' && typeof nextEntry.phase !== 'number') {
          error('Invalid phase. Must be a string or number.');
        }

        let id;
        const existingIds = new Set(entries.map(e => e.id));
        do {
          id = 'tj-' + crypto.randomBytes(3).toString('hex');
        } while (existingIds.has(id));
        nextEntry.id = id;
        entries.push(nextEntry);
      } else if (store === 'bookmarks') {
        entries.unshift(nextEntry);
        if (entries.length > BOOKMARKS_MAX) {
          entries.splice(BOOKMARKS_MAX);
        }
      } else {
        entries.push(nextEntry);
      }

      return {
        nextData: entries,
        result: { entry: nextEntry, entry_count: entries.length },
      };
    },
    sqliteMirror({ result }) {
      const db = getDb(cwd);
      const cache = new PlanningCache(db);
      cache.writeMemoryEntry(cwd, store, result.entry);
    },
  });

  const result = { written: true, store, entry_count: mutation.entry_count };
  if (!SACRED_STORES.includes(store) && mutation.entry_count > COMPACT_THRESHOLD) {
    result.compact_needed = true;
    result.threshold = COMPACT_THRESHOLD;
  }

  output(result);
}

/**
 * Read entries from a memory store.
 * Options: store (required), limit, query, phase
 */
function cmdMemoryRead(cwd, options, raw) {
  const { store, limit, query, phase, category, tags, from, to, asc } = options;

  if (!store || !VALID_STORES.includes(store)) {
    error(`Invalid or missing store. Must be one of: ${VALID_STORES.join(', ')}`);
  }

  const filePath = path.join(cwd, '.planning', 'memory', storeFilename(store));

  let entries = [];
  let total = 0;
  let source = 'json';
  let db = null;
  try {
    db = getDb(cwd);
  } catch (e) {
    debugLog('memory.read', 'backend detection failed', e);
  }

  const useSqlite = db && db.backend === 'sqlite' && SQLITE_MEMORY_STORES.has(store);
  if (useSqlite) {
    try {
      const cache = new PlanningCache(db);
      const sqlResult = cache.searchMemory(cwd, store, query || null, {
        phase: phase || null,
        category: store === 'trajectories' ? category : null,
        limit: 10000,
      });
      if (sqlResult) {
        entries = sqlResult.entries;
        total = sqlResult.total;
        source = 'sql';
      }
    } catch (e) {
      debugLog('memory.read', 'SQL read failed, falling back to JSON', e);
      entries = [];
      total = 0;
      source = 'json';
    }
  }

  if (!useSqlite || source === 'json') {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      entries = JSON.parse(raw);
      if (!Array.isArray(entries)) entries = [];
    } catch (e) {
      debugLog('memory.read', 'read failed', e);
      entries = [];
    }
    total = entries.length;
  }

  if (phase) {
    entries = entries.filter(e => e.phase && String(e.phase) === String(phase));
  }

  if (query) {
    const q = query.toLowerCase();
    entries = entries.filter(e => Object.values(e).some(v => typeof v === 'string' && v.toLowerCase().includes(q)));
  }

  if (store === 'trajectories') {
    if (category) {
      entries = entries.filter(e => e.category === category);
    }
    if (tags) {
      const requiredTags = tags.split(',').map(t => t.trim());
      entries = entries.filter(e => Array.isArray(e.tags) && requiredTags.every(rt => e.tags.includes(rt)));
    }
    if (from) {
      entries = entries.filter(e => e.timestamp && e.timestamp >= from);
    }
    if (to) {
      entries = entries.filter(e => e.timestamp && e.timestamp <= to + 'T23:59:59.999Z');
    }
    entries = entries.slice().sort((a, b) => {
      const left = a.timestamp || '';
      const right = b.timestamp || '';
      return asc ? left.localeCompare(right) : right.localeCompare(left);
    });
  }

  if (store === 'lessons') {
    if (options.type) {
      entries = entries.filter(e => e.type && e.type.toLowerCase() === options.type.toLowerCase());
    }
    if (options.since) {
      entries = entries.filter(e => e.date && e.date >= options.since);
    }
    if (options.severity) {
      entries = entries.filter(e => e.severity && e.severity.toUpperCase() === options.severity.toUpperCase());
    }
    if (!asc) {
      entries = entries.slice().sort((a, b) => {
        const da = a.date || '';
        const db = b.date || '';
        return db.localeCompare(da);
      });
    }
  }

  if (limit && parseInt(limit, 10) > 0) {
    entries = entries.slice(0, parseInt(limit, 10));
  }

  if (store === 'bookmarks' && (!limit || parseInt(limit, 10) <= 0)) {
    entries = entries.slice(0, BOOKMARKS_MAX);
    total = Math.min(total, BOOKMARKS_MAX);
  }

  output({ entries, count: entries.length, store, total, source });
}

/**
 * List memory stores with stats.
 */
function cmdMemoryList(cwd, options, raw) {
  const memDir = path.join(cwd, '.planning', 'memory');

  const stores = [];
  try {
    const files = fs.readdirSync(memDir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const filePath = path.join(memDir, file);
      const stat = fs.statSync(filePath);
      let entryCount = 0;
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (Array.isArray(data)) entryCount = data.length;
      } catch (e) {
        debugLog('memory.list', `parse failed for ${file}`, e);
      }
      stores.push({
        name: file.replace('.json', ''),
        entry_count: entryCount,
        size_bytes: stat.size,
        last_modified: stat.mtime.toISOString(),
      });
    }
  } catch (e) {
    debugLog('memory.list', 'readdir failed', e);
  }

  output({ stores, memory_dir: memDir });
}

/**
 * Compact memory stores by summarizing old entries.
 * Options: store (optional), threshold (default: 50), dryRun (boolean)
 */
function cmdMemoryCompact(cwd, options, raw) {
  const { store, threshold: thresholdStr, dryRun } = options;
  const threshold = thresholdStr ? parseInt(thresholdStr, 10) : COMPACT_THRESHOLD;

  if (store && !VALID_STORES.includes(store)) {
    error(`Invalid store. Must be one of: ${VALID_STORES.join(', ')}`);
  }

  const memDir = path.join(cwd, '.planning', 'memory');
  const storesToProcess = store ? [store] : VALID_STORES;

  const result = {
    compacted: false,
    stores_processed: [],
    entries_before: {},
    entries_after: {},
    summaries_created: {},
    sacred_skipped: [],
  };

  for (const s of storesToProcess) {
    if (SACRED_STORES.includes(s)) {
      result.sacred_skipped.push(s);
      continue;
    }

    const filePath = path.join(memDir, storeFilename(s));

    let entries = [];
    try {
      const rawData = fs.readFileSync(filePath, 'utf-8');
      entries = JSON.parse(rawData);
      if (!Array.isArray(entries)) entries = [];
    } catch (e) {
      debugLog('memory.compact', `read failed for ${s}`, e);
      continue;
    }

    const beforeCount = entries.length;
    result.entries_before[s] = beforeCount;

    if (beforeCount <= threshold) {
      result.entries_after[s] = beforeCount;
      result.summaries_created[s] = 0;
      result.stores_processed.push(s);
      continue;
    }

    let compactedEntries;
    let summariesCreated = 0;

    if (s === 'bookmarks') {
      const kept = entries.slice(0, COMPACT_KEEP_RECENT);
      const old = entries.slice(COMPACT_KEEP_RECENT);
      const summarized = old.map(e => {
        const ts = e.timestamp || '';
        const date = ts ? ts.split('T')[0] : 'unknown';
        const phase = e.phase || '?';
        const plan = e.plan || '?';
        const task = e.task !== undefined ? e.task : '?';
        return {
          summary: `${date}: Phase ${phase}, Plan ${plan}, Task ${task}`,
          original_timestamp: ts,
        };
      });
      summariesCreated = summarized.length;
      compactedEntries = [...kept, ...summarized];
    } else if (s === 'todos') {
      const active = [];
      const completedSummaries = [];
      for (const e of entries) {
        const isCompleted = e.completed === true || e.status === 'completed' || e.status === 'done';
        if (isCompleted) {
          const ts = e.timestamp || '';
          const date = ts ? ts.split('T')[0] : 'unknown';
          const text = e.text || e.summary || e.title || 'todo';
          completedSummaries.push({
            summary: `${date}: [completed] ${text}`,
            original_timestamp: ts,
          });
        } else {
          active.push(e);
        }
      }
      summariesCreated = completedSummaries.length;
      compactedEntries = [...active, ...completedSummaries];
    } else {
      result.entries_after[s] = beforeCount;
      result.summaries_created[s] = 0;
      result.stores_processed.push(s);
      continue;
    }

    result.entries_after[s] = compactedEntries.length;
    result.summaries_created[s] = summariesCreated;
    result.stores_processed.push(s);
    if (summariesCreated > 0) result.compacted = true;

    if (!dryRun) {
      fs.mkdirSync(memDir, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(compactedEntries, null, 2), 'utf-8');
    }
  }

  if (store && SACRED_STORES.includes(store)) {
    output({ compacted: false, reason: 'sacred_data' });
    return;
  }

  if (dryRun) result.dry_run = true;
  output(result);
}

function cmdStructuredMemoryList(cwd, options, raw) {
  const { filePath, doc } = loadStructuredMemory(cwd);
  output(buildStructuredListPayload(doc, filePath));
}

function cmdStructuredMemoryAdd(cwd, options, raw) {
  const section = normalizeMemorySection(options.section);
  if (!section) {
    error(`Missing or invalid --section. Must be one of: ${MEMORY_SECTIONS.join(', ')}`);
  }
  if (!options.text || !String(options.text).trim()) {
    error('Missing --text');
  }

  const { doc } = loadStructuredMemory(cwd);
  const sectionObj = doc.sections.find(item => item.name === section);
  const id = nextStructuredMemoryId(doc);
  const today = currentMemoryDate();
  const entry = {
    id,
    type: normalizeMemoryType(options.type, section),
    text: String(options.text).trim(),
    metadata: sortMemoryMetadata({
      Added: today,
      Updated: today,
      Source: options.source,
      Keep: options.keep,
      Status: options.status,
      Expires: options.expires,
      Replaces: options.replaces,
    }),
  };

  sectionObj.entries.push(entry);
  const filePath = writeStructuredMemory(cwd, doc);

  output({
    added: true,
    file: filePath,
    entry: {
      id: entry.id,
      section,
      type: entry.type,
      text: entry.text,
      metadata: entry.metadata,
    },
  });
}

function cmdStructuredMemoryRemove(cwd, options, raw) {
  const id = String(options.id || '').trim();
  if (!id) error('Missing --id');

  const { doc } = loadStructuredMemory(cwd);
  for (const section of doc.sections) {
    const index = section.entries.findIndex(entry => entry.id === id);
    if (index === -1) continue;
    const [removed] = section.entries.splice(index, 1);
    const filePath = writeStructuredMemory(cwd, doc);
    output({ removed: true, file: filePath, id, section: section.name, entry: removed });
    return;
  }

  error(`Memory entry not found: ${id}`);
}

function cmdStructuredMemoryPrune(cwd, options, raw) {
  const threshold = options.threshold ? parseInt(options.threshold, 10) : DEFAULT_PRUNE_THRESHOLD_DAYS;
  if (Number.isNaN(threshold) || threshold < 0) {
    error('Invalid --threshold. Must be a non-negative integer.');
  }

  const { doc } = loadStructuredMemory(cwd);
  const candidates = computePruneCandidates(doc, threshold);

  if (!options.apply) {
    output({
      preview: true,
      threshold_days: threshold,
      candidate_count: candidates.length,
      candidates,
    });
    return;
  }

  const idsToRemove = new Set(candidates.map(candidate => candidate.id));
  for (const section of doc.sections) {
    section.entries = section.entries.filter(entry => !idsToRemove.has(entry.id));
  }
  const filePath = writeStructuredMemory(cwd, doc);

  output({
    preview: false,
    applied: true,
    file: filePath,
    threshold_days: threshold,
    removed_count: candidates.length,
    removed_ids: candidates.map(candidate => candidate.id),
    candidates,
  });
}

module.exports = {
  cmdMemoryWrite,
  cmdMemoryRead,
  cmdMemoryList,
  cmdMemoryEnsureDir,
  cmdMemoryCompact,
  cmdStructuredMemoryList,
  cmdStructuredMemoryAdd,
  cmdStructuredMemoryRemove,
  cmdStructuredMemoryPrune,
  parseStructuredMemory,
  serializeStructuredMemory,
  computePruneCandidates,
  MEMORY_SECTIONS,
  MEMORY_METADATA_ORDER,
  SACRED_STORES,
};
