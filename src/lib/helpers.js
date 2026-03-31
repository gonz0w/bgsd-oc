const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { debugLog } = require('./output');
const { loadConfig } = require('./config');
const { MODEL_PROFILES } = require('./constants');
const { cachedRegex, PHASE_DIR_NUMBER } = require('./regex-cache');

// ─── File Helpers ────────────────────────────────────────────────────────────

/** Lazy-loaded persistent cache engine */
let _cacheEngine = null;

function getCacheEngine() {
  if (!_cacheEngine) {
    try {
      const { CacheEngine } = require('./cache');
      _cacheEngine = new CacheEngine();
    } catch (e) {
      debugLog('cache', 'failed to load CacheEngine, using in-memory fallback', e);
      // Return a simple fallback object
      _cacheEngine = {
        get: () => null,
        set: () => {},
        invalidate: () => {},
        clear: () => {},
        status: () => ({ backend: 'fallback', count: 0, hits: 0, misses: 0 }),
        warm: () => 0
      };
    }
  }
  return _cacheEngine;
}

/** Module-level directory listing cache — avoids redundant readdirSync calls */
const dirCache = new Map();

function safeReadFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    debugLog('file.read', 'read failed', e);
    return null;
  }
}

function normalizeTddHintValue(value) {
  if (value === null || value === undefined) return null;

  const raw = String(value).trim().toLowerCase().replace(/^['"]|['"]$/g, '');
  if (!raw) return null;

  const tokenMatch = raw.match(/^(required|require|mandatory|must|enforced|recommended|recommend|suggested|prefer(?:red)?|true|yes|y|false|no|n|skip(?:ped)?|omit(?:ted)?|none|n\/a|na|not applicable)\b/);
  const token = tokenMatch ? tokenMatch[1] : raw;

  if (['required', 'require', 'mandatory', 'must', 'enforced'].includes(token)) return 'required';
  if (['recommended', 'recommend', 'suggested', 'prefer', 'preferred', 'true', 'yes', 'y'].includes(token)) return 'recommended';
  if (['false', 'no', 'n', 'skip', 'skipped', 'omit', 'omitted', 'none', 'n/a', 'na', 'not applicable'].includes(token)) return null;

  return null;
}

function normalizePlanTddDecisionValue(value) {
  if (value === null || value === undefined) return null;

  const raw = String(value).trim().toLowerCase().replace(/^['"]|['"]$/g, '');
  if (!raw) return null;

  const tokenMatch = raw.match(/^(selected|select|tdd|true|yes|required|recommended|skipped|skip|false|no|none|omit(?:ted)?)\b/);
  const token = tokenMatch ? tokenMatch[1] : raw;

  if (['selected', 'select', 'tdd', 'true', 'yes', 'required', 'recommended'].includes(token)) return 'selected';
  if (['skipped', 'skip', 'false', 'no', 'none', 'omit', 'omitted'].includes(token)) return 'skipped';

  return null;
}

function buildCanonicalTddDecisionCallout(decision, rationale) {
  if (!decision) return null;
  const label = decision === 'selected' ? 'Selected' : 'Skipped';
  const fallback = decision === 'selected'
    ? 'this legacy plan already marked testable behavior for TDD, so it now uses the canonical visible decision callout.'
    : 'this legacy plan already marked TDD as not selected, so it now uses the canonical visible decision callout.';
  return `> **TDD Decision:** ${label} — ${String(rationale || fallback).trim()}`;
}

function normalizeRoadmapTddMetadata(content) {
  if (!content || typeof content !== 'string') return { content, changed: false };

  let changed = false;
  const next = content.replace(/^(\*\*TDD:?\*\*:?\s*)([^\n]*)$/gim, (match, _prefix, rawValue) => {
    const normalized = normalizeTddHintValue(rawValue);
    const canonical = normalized ? `**TDD:** ${normalized}` : '';
    if (canonical !== match) changed = true;
    return canonical;
  }).replace(/\n{3,}/g, '\n\n');

  return { content: next, changed };
}

function readRoadmapWithTddNormalization(cwd) {
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const original = cachedReadFile(roadmapPath);
  if (!original) return null;

  const normalized = normalizeRoadmapTddMetadata(original);
  if (normalized.changed) {
    fs.writeFileSync(roadmapPath, normalized.content, 'utf-8');
    invalidateFileCache(roadmapPath);
    return normalized.content;
  }

  return original;
}

function normalizePlanTddMetadata(content) {
  if (!content || typeof content !== 'string') return { content, changed: false, decision: null };

  const frontmatter = require('./frontmatter').extractFrontmatter(content);
  const newFrontmatter = { ...frontmatter };
  let changed = false;

  const canonicalMatch = content.match(/^>\s*\*\*TDD Decision:\*\*\s*(Selected|Skipped)\s*[—-]\s*(.+)$/im);
  const legacyCalloutMatch = content.match(/^>\s*\*\*TDD(?: Decision)?\*\*\s*:?\s*(.+)$/im);

  let decision = canonicalMatch ? canonicalMatch[1].toLowerCase() : null;
  if (!decision) {
    decision = normalizePlanTddDecisionValue(
      newFrontmatter.tdd_decision ??
      newFrontmatter.tddDecision ??
      newFrontmatter.tdd ??
      newFrontmatter['tdd-decision'] ??
      newFrontmatter['tdd_decision'] ??
      newFrontmatter['tddDecision'] ??
      newFrontmatter['tdd-hint'] ??
      newFrontmatter['tdd_hint']
    );
  }
  if (!decision && String(newFrontmatter.type || '').trim().toLowerCase() === 'tdd') {
    decision = 'selected';
  }

  const rationale = canonicalMatch?.[2]?.trim()
    || newFrontmatter.tdd_rationale
    || newFrontmatter.tddRationale
    || newFrontmatter['tdd-rationale']
    || newFrontmatter.tdd_reason
    || newFrontmatter.tddReason
    || newFrontmatter['tdd-reason']
    || (legacyCalloutMatch ? legacyCalloutMatch[1].trim() : null);

  for (const key of ['tdd', 'tdd_decision', 'tddDecision', 'tdd_rationale', 'tddRationale', 'tdd_reason', 'tddReason', 'tdd-hint', 'tdd_hint', 'tdd-rationale', 'tdd-reason']) {
    if (Object.prototype.hasOwnProperty.call(newFrontmatter, key)) {
      delete newFrontmatter[key];
      changed = true;
    }
  }

  if (decision === 'selected' && newFrontmatter.type !== 'tdd') {
    newFrontmatter.type = 'tdd';
    changed = true;
  }
  if (decision === 'skipped' && (!newFrontmatter.type || newFrontmatter.type === 'tdd')) {
    newFrontmatter.type = 'execute';
    changed = true;
  }

  let next = content;
  if (JSON.stringify(frontmatter) !== JSON.stringify(newFrontmatter)) {
    next = require('./frontmatter').spliceFrontmatter(next, newFrontmatter);
    changed = true;
  }

  if (decision) {
    const canonicalCallout = buildCanonicalTddDecisionCallout(decision, rationale);
    if (canonicalMatch) {
      if (canonicalMatch[0] !== canonicalCallout) {
        next = next.replace(canonicalMatch[0], canonicalCallout);
        changed = true;
      }
    } else if (legacyCalloutMatch) {
      next = next.replace(legacyCalloutMatch[0], canonicalCallout);
      changed = true;
    } else {
      const objectiveClose = next.indexOf('</objective>');
      if (objectiveClose !== -1) {
        const insertAt = objectiveClose + '</objective>'.length;
        next = `${next.slice(0, insertAt)}\n\n${canonicalCallout}${next.slice(insertAt)}`;
        changed = true;
      }
    }
  }

  return { content: next, changed, decision };
}

function normalizePlanFileTddMetadata(filePath) {
  const original = safeReadFile(filePath);
  if (!original) return { changed: false, decision: null };
  const normalized = normalizePlanTddMetadata(original);
  if (normalized.changed) {
    fs.writeFileSync(filePath, normalized.content, 'utf-8');
    invalidateFileCache(filePath);
  }
  return { changed: normalized.changed, decision: normalized.decision };
}

function normalizePhasePlanFilesTddMetadata(cwd, phaseInfo) {
  const results = [];
  if (!phaseInfo?.directory || !Array.isArray(phaseInfo.plans)) return results;

  for (const planFile of phaseInfo.plans) {
    const filePath = path.join(cwd, phaseInfo.directory, planFile);
    const result = normalizePlanFileTddMetadata(filePath);
    if (result.changed) results.push({ file: filePath, decision: result.decision });
  }

  return results;
}

/**
 * Cached wrapper around safeReadFile using persistent CacheEngine.
 * CacheEngine handles staleness detection via mtime comparison.
 * Use safeReadFile directly when you need a guaranteed fresh read.
 */
function cachedReadFile(filePath) {
  const cacheEngine = getCacheEngine();
  
  // Try to get from persistent cache (CacheEngine checks staleness via mtime)
  const cached = cacheEngine.get(filePath);
  if (cached !== null) {
    debugLog('file.cache', `cache hit: ${filePath}`);
    return cached;
  }
  
  // Cache miss or stale - read fresh and populate cache
  const content = safeReadFile(filePath);
  if (content !== null) {
    // Check if this is the first entry being added to trigger auto-warm message
    const status = cacheEngine.status();
    if (status.count === 0 && !_autoWarmMessageShown) {
      _autoWarmMessageShown = true;
      const fileCount = countPlanningFiles();
      writeDebugDiagnostic('[bGSD:cache]', `Warming cache... ${fileCount} files`);
    }
    cacheEngine.set(filePath, content);
  }
  return content;
}

/** Track whether auto-warm message has been shown in this session */
let _autoWarmMessageShown = false;

/**
 * Count .planning/ files for auto-warm message
 */
function countPlanningFiles() {
  const fs = require('fs');
  const path = require('path');
  const cwd = process.cwd();
  const planningDir = path.join(cwd, '.planning');
  let count = 0;
  
  function walk(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          count++;
        }
      }
    } catch (e) {}
  }
  
  if (fs.existsSync(planningDir)) {
    walk(planningDir);
  }
  return count;
}

/** Reset auto-warm flag (call at start of each CLI invocation if needed) */
// Note: Module is reloaded each CLI invocation, so this resets automatically

/**
 * Invalidate a specific file from cache, or clear entire cache if no path given.
 * Call after writing a file to ensure subsequent reads get fresh content.
 */
function invalidateFileCache(filePath) {
  const cacheEngine = getCacheEngine();
  if (filePath) {
    cacheEngine.invalidate(filePath);
  } else {
    cacheEngine.clear();
  }

  if (!filePath || String(filePath).includes(`${path.sep}.planning${path.sep}`)) {
    dirCache.clear();
    _phaseTreeCache = null;
    _phaseTreeCwd = null;
    invalidateMilestoneCache();
  }
}

/**
 * Cached wrapper around fs.readdirSync. Returns cached listing on repeated reads
 * of the same directory within a single CLI invocation.
 * @param {string} dirPath - Absolute directory path
 * @param {object} [options] - Options passed to readdirSync (e.g., { withFileTypes: true })
 * @returns {Array|null} Directory entries or null on error
 */
function cachedReaddirSync(dirPath, options) {
  // Build cache key from path + option signature
  const optKey = options?.withFileTypes ? ':wt' : '';
  const key = dirPath + optKey;
  if (dirCache.has(key)) {
    return dirCache.get(key);
  }
  try {
    const entries = fs.readdirSync(dirPath, options);
    dirCache.set(key, entries);
    return entries;
  } catch (e) {
    debugLog('dir.cache', `readdir failed: ${dirPath}`, e);
    dirCache.set(key, null);
    return null;
  }
}

/** Module-level phase tree cache — built once per invocation */
let _phaseTreeCache = null;
let _phaseTreeCwd = null;

/**
 * Get a cached scan of the entire .planning/phases/ directory tree.
 * Returns a Map<normalizedPhaseNum, phaseEntry> where phaseEntry contains
 * all file metadata needed by most commands.
 *
 * This replaces 100+ individual readdirSync calls with a single tree scan.
 *
 * @param {string} cwd - Project root
 * @returns {Map<string, object>} Phase tree map
 */
function getPhaseTree(cwd) {
  if (_phaseTreeCache && _phaseTreeCwd === cwd) {
    return _phaseTreeCache;
  }

  const phasesDir = path.join(cwd, '.planning', 'phases');
  const tree = new Map();

  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();

    for (const dir of dirs) {
      const dirMatch = dir.match(PHASE_DIR_NUMBER);
      const phaseNumber = dirMatch ? dirMatch[1] : dir;
      const normalized = normalizePhaseName(phaseNumber);
      const phaseName = dirMatch && dirMatch[2] ? dirMatch[2] : null;
      const phaseDir = path.join(phasesDir, dir);
      const phaseFiles = fs.readdirSync(phaseDir);

      const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').sort();
      const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md').sort();
      const hasResearch = phaseFiles.some(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md');
      const hasContext = phaseFiles.some(f => f.endsWith('-CONTEXT.md') || f === 'CONTEXT.md');
      const hasVerification = phaseFiles.some(f => f.endsWith('-VERIFICATION.md') || f === 'VERIFICATION.md');

      const completedPlanIds = new Set(
        summaries.map(s => s.replace('-SUMMARY.md', '').replace('SUMMARY.md', ''))
      );
      const incompletePlans = plans.filter(p => {
        const planId = p.replace('-PLAN.md', '').replace('PLAN.md', '');
        return !completedPlanIds.has(planId);
      });

      tree.set(normalized, {
        dirName: dir,
        fullPath: phaseDir,
        relPath: path.join('.planning', 'phases', dir),
        phaseNumber,
        phaseName,
        phaseSlug: phaseName ? phaseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : null,
        files: phaseFiles,
        plans,
        summaries,
        incompletePlans,
        hasResearch,
        hasContext,
        hasVerification,
      });
    }
  } catch (e) {
    debugLog('phase.tree', 'scan failed', e);
  }

  _phaseTreeCache = tree;
  _phaseTreeCwd = cwd;
  return tree;
}

// ─── Phase Helpers ───────────────────────────────────────────────────────────

function normalizePhaseName(phase) {
  const match = phase.match(/^(\d+(?:\.\d+)?)/);
  if (!match) return phase;
  const num = match[1];
  const parts = num.split('.');
  // Strip leading zeros first, then pad to minimum 2 digits
  // This ensures both "0110" (from dir name) and "110" (from user input) normalize to "110"
  const stripped = parts[0].replace(/^0+/, '') || '0';
  const padded = stripped.padStart(2, '0');
  return parts.length > 1 ? `${padded}.${parts[1]}` : padded;
}

function buildPhaseHandoffRunId(phase, timestamp = new Date()) {
  const normalizedPhase = normalizePhaseName(String(phase || '')).trim() || 'unknown';
  const iso = timestamp instanceof Date ? timestamp.toISOString() : new Date(timestamp || Date.now()).toISOString();
  return `${normalizedPhase}-${iso.replace(/[:.]/g, '-').replace(/Z$/, 'Z')}`;
}

function buildPhaseHandoffSourceFingerprint(phase, runId) {
  const normalizedPhase = normalizePhaseName(String(phase || '')).trim() || 'unknown';
  const seed = `${normalizedPhase}:${String(runId || '').trim()}`;
  return crypto.createHash('sha256').update(seed).digest('hex').slice(0, 16);
}

function normalizePhaseHandoffFingerprintContent(content) {
  if (!content || typeof content !== 'string') return '';
  return content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/g, ''))
    .filter((line) => !/^\*\*(?:Date|Generated|Updated|Last updated|Completed|Last Activity|Status):\*\*/i.test(line.trim()))
    .join('\n')
    .trim();
}

function getPhaseRequirementFingerprintEntries(cwd, requirementIds = []) {
  if (!Array.isArray(requirementIds) || requirementIds.length === 0) return [];

  const requirementsPath = path.join(cwd, '.planning', 'REQUIREMENTS.md');
  const requirementsContent = safeReadFile(requirementsPath);
  if (!requirementsContent) return [];

  return requirementIds
    .map((requirementId) => {
      const safeId = String(requirementId || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (!safeId) return null;
      const match = requirementsContent.match(new RegExp(`^\\s*-\\s+\\[[ x]\\]\\s+\\*\\*${safeId}\\*\\*:\\s*(.+)$`, 'im'));
      return match ? `${safeId}: ${match[1].trim()}` : null;
    })
    .filter(Boolean);
}

function buildPhaseHandoffExpectedFingerprint(cwd, phase) {
  const normalizedPhase = normalizePhaseName(String(phase || '')).trim() || 'unknown';
  const fingerprintInputs = [`phase:${normalizedPhase}`];

  const roadmapPhase = getRoadmapPhaseInternal(cwd, normalizedPhase);
  const roadmapSection = normalizePhaseHandoffFingerprintContent(roadmapPhase?.section || '');
  if (roadmapSection) fingerprintInputs.push(`roadmap:\n${roadmapSection}`);

  const requirementEntries = getPhaseRequirementFingerprintEntries(cwd, roadmapPhase?.requirements || []);
  if (requirementEntries.length > 0) {
    fingerprintInputs.push(`requirements:\n${requirementEntries.sort().join('\n')}`);
  }

  const phaseInfo = findPhaseInternal(cwd, normalizedPhase);
  const phaseFiles = phaseInfo?.directory
    ? (cachedReaddirSync(path.join(cwd, phaseInfo.directory)) || [])
    : [];
  const canonicalFiles = phaseFiles.length > 0
    ? phaseFiles
        .filter((file) => (
          file === 'CONTEXT.md'
          || file === 'RESEARCH.md'
          || file === 'PLAN.md'
          || file.endsWith('-CONTEXT.md')
          || file.endsWith('-RESEARCH.md')
          || file.endsWith('-PLAN.md')
        ))
        .sort()
    : [];

  for (const file of canonicalFiles) {
    const content = normalizePhaseHandoffFingerprintContent(safeReadFile(path.join(cwd, phaseInfo.directory, file)));
    if (content) fingerprintInputs.push(`file:${file}\n${content}`);
  }

  const seed = fingerprintInputs.join('\n---\n');
  return crypto.createHash('sha256').update(seed).digest('hex').slice(0, 16);
}

function buildDefaultPhaseHandoffSummary(step, status) {
  const normalizedStep = String(step || '').trim() || 'workflow';
  const label = normalizedStep.charAt(0).toUpperCase() + normalizedStep.slice(1);
  if (String(status || '').trim() === 'blocked') return `${label} blocked`;
  if (String(status || '').trim() === 'pending') return `${label} pending`;
  return `${label} ready`;
}

/**
 * Find a phase directory by phase number using normalized comparison.
 * This handles variable-length zero-padding in directory names (e.g., "67", "0067", "0114").
 *
 * @param {string} phasesDir - Path to the phases directory
 * @param {number|string} phaseNum - Phase number to find
 * @returns {string|null} The matching directory name, or null if not found
 */
function findPhaseDirByNumber(phasesDir, phaseNum) {
  const normalized = normalizePhaseName(String(phaseNum));
  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dirMatch = entry.name.match(PHASE_DIR_NUMBER);
      if (!dirMatch) continue;
      const dirPhaseNumber = dirMatch[1];
      const dirNormalized = normalizePhaseName(dirPhaseNumber);
      if (dirNormalized === normalized) {
        return entry.name;
      }
    }
  } catch {
    // Directory scan failed
  }
  return null;
}

// ─── Must-Haves Block Parser ─────────────────────────────────────────────────

function parseMustHavesBlock(content, blockName) {
  // Extract a specific block from must_haves in raw frontmatter YAML
  // Handles 3-level nesting: must_haves > artifacts/key_links > [{path, provides, ...}]
  const fmMatch = content.match(/^---\n([\s\S]+?)\n---/);
  if (!fmMatch) return [];

  const yaml = fmMatch[1];
  // Find the block (e.g., "truths:", "artifacts:", "key_links:")
  const blockPattern = cachedRegex(`^\\s{4}${blockName}:\\s*$`, 'm');
  const blockStart = yaml.search(blockPattern);
  if (blockStart === -1) return [];

  const afterBlock = yaml.slice(blockStart);
  const blockLines = afterBlock.split('\n').slice(1); // skip the header line

  const items = [];
  let current = null;

  for (const line of blockLines) {
    // Stop at same or lower indent level (non-continuation)
    if (line.trim() === '') continue;
    const indent = line.match(/^(\s*)/)[1].length;
    if (indent <= 4 && line.trim() !== '') break; // back to must_haves level or higher

    if (line.match(/^\s{6}-\s+/)) {
      // New list item at 6-space indent
      if (current) items.push(current);
      current = {};
      // Check if it's a simple string item
      const simpleMatch = line.match(/^\s{6}-\s+"?([^"]+)"?\s*$/);
      if (simpleMatch && !line.includes(':')) {
        current = simpleMatch[1];
      } else {
        // Key-value on same line as dash: "- path: value"
        const kvMatch = line.match(/^\s{6}-\s+(\w+):\s*"?([^"]*)"?\s*$/);
        if (kvMatch) {
          current = {};
          current[kvMatch[1]] = kvMatch[2];
        }
      }
    } else if (current && typeof current === 'object') {
      // Continuation key-value at 8+ space indent
      const kvMatch = line.match(/^\s{8,}(\w+):\s*"?([^"]*)"?\s*$/);
      if (kvMatch) {
        const val = kvMatch[2];
        // Try to parse as number
        current[kvMatch[1]] = /^\d+$/.test(val) ? parseInt(val, 10) : val;
      }
      // Array items under a key
      const arrMatch = line.match(/^\s{10,}-\s+"?([^"]+)"?\s*$/);
      if (arrMatch) {
        // Find the last key added and convert to array
        const keys = Object.keys(current);
        const lastKey = keys[keys.length - 1];
        if (lastKey && !Array.isArray(current[lastKey])) {
          current[lastKey] = current[lastKey] ? [current[lastKey]] : [];
        }
        if (lastKey) current[lastKey].push(arrMatch[1]);
      }
    }
  }
  if (current) items.push(current);

  return items;
}

/**
 * Escape a string for safe interpolation into a shell command.
 * Wraps in single quotes and escapes internal single quotes.
 * Same pattern used in execGit() — extracted here for reuse.
 */
function sanitizeShellArg(arg) {
  return "'" + String(arg).replace(/'/g, "'\\''") + "'";
}

/**
 * Validate that a string is a strict YYYY-MM-DD date.
 * Prevents non-date strings from being interpolated into --since git args.
 */
function isValidDateString(str) {
  return /^\d{4}-\d{2}-\d{2}$/.test(str);
}

// ─── Internal Helpers (used by commands, not exported to CLI) ─────────────────

function resolveModelInternal(cwd, agentType) {
  const config = loadConfig(cwd);

  // Check per-agent override first
  const override = config.model_overrides?.[agentType];
  if (override) {
    return override === 'opus' ? 'inherit' : override;
  }

  const profile = config.model_profile || 'balanced';

  // Try model-selection decision rule first (SQLite-backed, Phase 122)
  try {
    const { resolveModelSelection } = require('./decision-rules');
    const { getDb } = require('./db');
    const db = getDb(cwd);
    const result = resolveModelSelection({ agent_type: agentType, model_profile: profile, db });
    if (result && result.value && result.value.model) {
      const model = result.value.model;
      return model === 'opus' ? 'inherit' : model;
    }
  } catch {
    // Fall through to static lookup
  }

  // Static fallback
  const agentModels = MODEL_PROFILES[agentType];
  if (!agentModels) return 'sonnet';
  const resolved = agentModels[profile] || agentModels['balanced'] || 'sonnet';
  return resolved === 'opus' ? 'inherit' : resolved;
}

function getArchivedPhaseDirs(cwd) {
  const milestonesDir = path.join(cwd, '.planning', 'milestones');
  const results = [];

  if (!fs.existsSync(milestonesDir)) return results;

  try {
    const milestoneEntries = fs.readdirSync(milestonesDir, { withFileTypes: true });
    // Find v*-phases directories, sort newest first
    const phaseDirs = milestoneEntries
      .filter(e => e.isDirectory() && /^v[\d.]+-phases$/.test(e.name))
      .map(e => e.name)
      .sort()
      .reverse();

    for (const archiveName of phaseDirs) {
      const version = archiveName.match(/^(v[\d.]+)-phases$/)[1];
      const archivePath = path.join(milestonesDir, archiveName);
      const entries = fs.readdirSync(archivePath, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();

      for (const dir of dirs) {
        results.push({
          name: dir,
          milestone: version,
          basePath: path.join('.planning', 'milestones', archiveName),
          fullPath: path.join(archivePath, dir),
        });
      }
    }
  } catch (e) { debugLog('phase.getArchived', 'readdir failed', e); }

  return results;
}

function searchPhaseInDir(baseDir, relBase, normalized) {
  try {
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
    const match = dirs.find(d => {
      const dm = d.match(PHASE_DIR_NUMBER);
      return dm ? normalizePhaseName(dm[1]) === normalized : d.startsWith(normalized);
    });
    if (!match) return null;

    const dirMatch = match.match(PHASE_DIR_NUMBER);
    const phaseNumber = dirMatch ? dirMatch[1] : normalized;
    const phaseName = dirMatch && dirMatch[2] ? dirMatch[2] : null;
    const phaseDir = path.join(baseDir, match);
    const phaseFiles = fs.readdirSync(phaseDir);

    const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').sort();
    const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md').sort();
    const hasResearch = phaseFiles.some(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md');
    const hasContext = phaseFiles.some(f => f.endsWith('-CONTEXT.md') || f === 'CONTEXT.md');
    const hasVerification = phaseFiles.some(f => f.endsWith('-VERIFICATION.md') || f === 'VERIFICATION.md');

    const completedPlanIds = new Set(
      summaries.map(s => s.replace('-SUMMARY.md', '').replace('SUMMARY.md', ''))
    );
    const incompletePlans = plans.filter(p => {
      const planId = p.replace('-PLAN.md', '').replace('PLAN.md', '');
      return !completedPlanIds.has(planId);
    });

    return {
      found: true,
      directory: path.join(relBase, match),
      phase_number: phaseNumber,
      phase_name: phaseName,
      phase_slug: phaseName ? phaseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : null,
      plans,
      summaries,
      incomplete_plans: incompletePlans,
      has_research: hasResearch,
      has_context: hasContext,
      has_verification: hasVerification,
    };
  } catch (e) {
    debugLog('phase.searchDir', 'search directory failed', e);
    return null;
  }
}

function findPhaseInternal(cwd, phase) {
  if (!phase) return null;

  const normalized = normalizePhaseName(phase);

  // Search current phases first — use cached tree for fast lookup
  const tree = getPhaseTree(cwd);
  const cached = tree.get(normalized);
  if (cached) {
    return {
      found: true,
      directory: cached.relPath,
      phase_number: cached.phaseNumber,
      phase_name: cached.phaseName,
      phase_slug: cached.phaseSlug,
      plans: cached.plans,
      summaries: cached.summaries,
      incomplete_plans: cached.incompletePlans,
      has_research: cached.hasResearch,
      has_context: cached.hasContext,
      has_verification: cached.hasVerification,
    };
  }

  // Search archived milestone phases (newest first)
  const milestonesDir = path.join(cwd, '.planning', 'milestones');
  if (!fs.existsSync(milestonesDir)) return null;

  try {
    const milestoneEntries = fs.readdirSync(milestonesDir, { withFileTypes: true });
    const archiveDirs = milestoneEntries
      .filter(e => e.isDirectory() && /^v[\d.]+-phases$/.test(e.name))
      .map(e => e.name)
      .sort()
      .reverse();

    for (const archiveName of archiveDirs) {
      const version = archiveName.match(/^(v[\d.]+)-phases$/)[1];
      const archivePath = path.join(milestonesDir, archiveName);
      const relBase = path.join('.planning', 'milestones', archiveName);
      const result = searchPhaseInDir(archivePath, relBase, normalized);
      if (result) {
        result.archived = version;
        return result;
      }
    }
  } catch (e) { debugLog('phase.findInternal', 'search archived phases failed', e); }

  return null;
}

function getRoadmapPhaseInternal(cwd, phaseNum) {
  if (!phaseNum) return null;
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');

  try {
    const content = readRoadmapWithTddNormalization(cwd);
    if (!content) return null;
    const phaseStr = phaseNum.toString();
    const normalizedPhase = normalizePhaseName(phaseStr);
    const phaseAlternates = Array.from(new Set([phaseStr, normalizedPhase, normalizedPhase.replace(/^0+/, '') || '0']))
      .map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const phasePattern = cachedRegex(`#{2,4}\\s*Phase\\s+(?:${phaseAlternates.join('|')}):\\s*([^\\n]+)`, 'i');
    const headerMatch = content.match(phasePattern);
    if (!headerMatch) return null;

    const phaseName = headerMatch[1].trim();
    const headerIndex = headerMatch.index;
    const restOfContent = content.slice(headerIndex);
    const nextHeaderMatch = restOfContent.match(/\n#{2,4}\s+Phase\s+\d/i);
    const sectionEnd = nextHeaderMatch ? headerIndex + nextHeaderMatch.index : content.length;
    const section = content.slice(headerIndex, sectionEnd).trim();

    const goalMatch = section.match(/\*\*Goal:?\*\*:?\s*([^\n]+)/i);
    const goal = goalMatch ? goalMatch[1].trim() : null;

    const requirementsMatch = section.match(/\*\*Requirements:?\*\*:?\s*([^\n]+)/i);
    const requirements = requirementsMatch
      ? requirementsMatch[1]
          .split(/[\s,]+/)
          .map(item => item.replace(/[\[\]]/g, '').trim())
          .filter(Boolean)
      : [];

    const tddMatch = section.match(/\*\*TDD:?\*\*:?\s*([^\n]+)/i);
    const tdd = tddMatch ? normalizeTddHintValue(tddMatch[1]) : null;

    return {
      found: true,
      phase_number: phaseNum.toString(),
      phase_name: phaseName,
      goal,
      requirements,
      tdd,
      section,
    };
  } catch (e) {
    debugLog('roadmap.getPhaseInternal', 'read roadmap phase failed', e);
    return null;
  }
}

function buildPhaseSnapshotInternal(cwd, phase) {
  if (!phase) return null;

  const normalized = normalizePhaseName(String(phase));
  const phaseInfo = findPhaseInternal(cwd, phase);
  const roadmapPhase = getRoadmapPhaseInternal(cwd, phase);

  if (!phaseInfo && !roadmapPhase) {
    return {
      found: false,
      phase: normalized,
      error: 'Phase not found',
      requirements: [],
      artifacts: {
        phase_dir: null,
        context: null,
        research: null,
        verification: null,
        uat: null,
        plans: [],
        summaries: [],
      },
      plan_index: {
        plans: [],
        waves: {},
        incomplete: [],
        has_checkpoints: false,
      },
    };
  }

  const phaseNumber = phaseInfo?.phase_number || normalized;
  const phaseName = roadmapPhase?.phase_name || phaseInfo?.phase_name || null;
  const phaseSlug = phaseInfo?.phase_slug || (phaseName ? generateSlugInternal(phaseName) : null);
  const phaseDir = phaseInfo?.directory || null;
  const phaseDirAbs = phaseDir ? path.join(cwd, phaseDir) : null;

  const plans = phaseInfo?.plans || [];
  const summaries = phaseInfo?.summaries || [];
  const incompletePlans = phaseInfo?.incomplete_plans || [];
  const waves = {};
  const planInventory = [];
  let hasCheckpoints = false;

  for (const planFile of plans) {
    const planPath = phaseDirAbs ? path.join(phaseDirAbs, planFile) : null;
    const content = planPath ? cachedReadFile(planPath) : null;
    const fm = content ? require('./frontmatter').extractFrontmatter(content) : {};
    const wave = parseInt(fm.wave, 10) || 1;
    const autonomous = fm.autonomous !== undefined ? (fm.autonomous === true || fm.autonomous === 'true') : true;
    if (!autonomous) hasCheckpoints = true;

    const id = planFile.replace('-PLAN.md', '').replace('PLAN.md', '');
    const entry = {
      id,
      file: phaseDir ? path.join(phaseDir, planFile) : planFile,
      wave,
      autonomous,
      has_summary: summaries.some(summary => summary.replace('-SUMMARY.md', '').replace('SUMMARY.md', '') === id),
    };
    if (fm.objective) entry.objective = fm.objective;
    if (fm['files-modified']) {
      entry.files_modified = Array.isArray(fm['files-modified']) ? fm['files-modified'] : [fm['files-modified']];
    }
    planInventory.push(entry);
    const waveKey = String(wave);
    if (!waves[waveKey]) waves[waveKey] = [];
    waves[waveKey].push(id);
  }

  const artifactFromDir = suffix => {
    if (!phaseDirAbs) return null;
    try {
      const entries = cachedReaddirSync(phaseDirAbs) || [];
      const match = entries.find(file => file.endsWith(suffix) || file === suffix.replace(/^.*-/, ''));
      return match ? path.join(phaseDir, match) : null;
    } catch {
      return null;
    }
  };

  return {
    found: true,
    phase: phaseNumber,
    metadata: {
      number: phaseNumber,
      normalized: normalized,
      name: phaseName,
      slug: phaseSlug,
      directory: phaseDir,
      on_disk: !!phaseInfo,
      roadmap_only: !phaseInfo && !!roadmapPhase,
      archived: phaseInfo?.archived || null,
      goal: roadmapPhase?.goal || null,
      requirements: roadmapPhase?.requirements || [],
    },
    requirements: roadmapPhase?.requirements || [],
    artifacts: {
      phase_dir: phaseDir,
      context: artifactFromDir('-CONTEXT.md'),
      research: artifactFromDir('-RESEARCH.md'),
      verification: artifactFromDir('-VERIFICATION.md'),
      uat: artifactFromDir('-UAT.md'),
      plans: phaseDir ? plans.map(file => path.join(phaseDir, file)) : [],
      summaries: phaseDir ? summaries.map(file => path.join(phaseDir, file)) : [],
    },
    plan_index: {
      plans: planInventory,
      waves,
      incomplete: incompletePlans.map(file => file.replace('-PLAN.md', '').replace('PLAN.md', '')),
      has_checkpoints: hasCheckpoints,
    },
    execution_context: {
      plan_count: plans.length,
      summary_count: summaries.length,
      incomplete_count: incompletePlans.length,
      has_context: !!phaseInfo?.has_context,
      has_research: !!phaseInfo?.has_research,
      has_verification: !!phaseInfo?.has_verification,
      incomplete_plans: incompletePlans,
    },
    roadmap: roadmapPhase ? {
      found: true,
      goal: roadmapPhase.goal,
      requirements: roadmapPhase.requirements || [],
    } : {
      found: false,
      goal: null,
      requirements: [],
    },
  };
}

function pathExistsInternal(cwd, targetPath) {
  const fullPath = path.isAbsolute(targetPath) ? targetPath : path.join(cwd, targetPath);
  try {
    fs.statSync(fullPath);
    return true;
  } catch (e) {
    debugLog('file.exists', 'stat failed', e);
    return false;
  }
}

function createWorkspaceEvidenceIndex(cwd, overrides = {}) {
  const existsSync = overrides.existsSync || fs.existsSync;
  const readFile = overrides.readFile || safeReadFile;
  const cache = new Map();

  return {
    get(targetPath, options = {}) {
      const includeContent = options.includeContent !== false;
      const fullPath = path.isAbsolute(targetPath) ? targetPath : path.join(cwd, targetPath);
      const cacheKey = `${fullPath}:${includeContent ? 'content' : 'stat'}`;
      if (cache.has(cacheKey)) return cache.get(cacheKey);

      const exists = !!existsSync(fullPath);
      const evidence = {
        path: targetPath,
        fullPath,
        exists,
        content: null,
      };

      if (includeContent && exists) {
        evidence.content = readFile(fullPath);
      }

      cache.set(cacheKey, evidence);
      return evidence;
    },
    clear() {
      cache.clear();
    },
  };
}

const RUNTIME_FRESHNESS_RULES = [
  {
    id: 'cli-bundle',
    sourcePrefixes: ['src/'],
    artifactPath: 'bin/bgsd-tools.cjs',
    buildCommand: 'npm run build',
    description: 'rebuilt local CLI runtime',
  },
  {
    id: 'plugin-bundle',
    sourcePrefixes: ['src/plugin/'],
    artifactPath: 'plugin.js',
    buildCommand: 'npm run build',
    description: 'rebuilt local plugin runtime',
  },
];

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function getRuntimeFreshness(cwd, changedFiles = []) {
  const normalizedFiles = Array.from(new Set(
    (Array.isArray(changedFiles) ? changedFiles : [])
      .map((file) => String(file || '').trim().replace(/^\.\//, ''))
      .filter(Boolean)
  ));

  const ruleSources = new Map();
  for (const file of normalizedFiles) {
    let selectedRule = null;
    let selectedPrefixLength = -1;

    for (const rule of RUNTIME_FRESHNESS_RULES) {
      for (const prefix of rule.sourcePrefixes) {
        if (!file.startsWith(prefix)) continue;
        if (prefix.length > selectedPrefixLength) {
          selectedRule = rule;
          selectedPrefixLength = prefix.length;
        }
      }
    }

    if (!selectedRule) continue;
    const existing = ruleSources.get(selectedRule.id) || [];
    existing.push(file);
    ruleSources.set(selectedRule.id, existing);
  }

  const relevantChecks = [];
  for (const rule of RUNTIME_FRESHNESS_RULES) {
    const relevantSources = ruleSources.get(rule.id) || [];
    if (relevantSources.length === 0) continue;

    const artifactFullPath = path.join(cwd, rule.artifactPath);
    const artifactExists = fs.existsSync(artifactFullPath);
    const artifactMtimeMs = artifactExists ? fs.statSync(artifactFullPath).mtimeMs : null;
    const sourceEntries = relevantSources
      .map((sourcePath) => {
        const sourceFullPath = path.join(cwd, sourcePath);
        if (!fs.existsSync(sourceFullPath)) return null;
        const stat = fs.statSync(sourceFullPath);
        return {
          path: sourcePath,
          mtime_ms: stat.mtimeMs,
          mtime: toIso(stat.mtimeMs),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.mtime_ms - a.mtime_ms);

    const newestSource = sourceEntries[0] || null;
    if (!newestSource) continue;

    let stale = false;
    let reason = null;
    if (!artifactExists) {
      stale = true;
      reason = 'missing_artifact';
    } else if (artifactMtimeMs < newestSource.mtime_ms) {
      stale = true;
      reason = 'source_newer_than_artifact';
    } else {
      reason = 'fresh';
    }

    relevantChecks.push({
      id: rule.id,
      path: rule.artifactPath,
      description: rule.description,
      build_command: rule.buildCommand,
      exists: artifactExists,
      artifact_mtime: toIso(artifactMtimeMs),
      stale,
      reason,
      sources: sourceEntries.map((entry) => entry.path),
      newest_source: newestSource.path,
      newest_source_mtime: newestSource.mtime,
    });
  }

  if (relevantChecks.length === 0) {
    return {
      checked: false,
      stale: false,
      stale_sources: false,
      stale_runtime: false,
      build_command: null,
      artifacts: [],
      sources: [],
      message: null,
    };
  }

  const staleChecks = relevantChecks.filter((entry) => entry.stale);
  const buildCommand = staleChecks[0]?.build_command || relevantChecks[0]?.build_command || null;
  const uniqueSources = Array.from(new Set(relevantChecks.flatMap((entry) => entry.sources))).sort();

  return {
    checked: true,
    stale: staleChecks.length > 0,
    stale_sources: staleChecks.length > 0,
    stale_runtime: staleChecks.length > 0,
    build_command: buildCommand,
    artifacts: relevantChecks,
    sources: uniqueSources,
    message: staleChecks.length > 0
      ? `Local runtime artifacts are stale for the active checkout. Run \`${buildCommand}\` before trusting deliverables verification.`
      : 'Local runtime artifacts are fresh for the active checkout.',
  };
}

function generateSlugInternal(text) {
  if (!text) return null;
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Module-level milestone info cache — computed once per invocation */
let _milestoneCache = null;
let _milestoneCwd = null;

function getMilestoneInfo(cwd) {
  // Return cached result if same cwd (single CLI invocation)
  if (_milestoneCache && _milestoneCwd === cwd) {
    return _milestoneCache;
  }

  const result = _getMilestoneInfoUncached(cwd);
  _milestoneCache = result;
  _milestoneCwd = cwd;
  return result;
}

function _getMilestoneInfoUncached(cwd) {
  try {
    const roadmap = cachedReadFile(path.join(cwd, '.planning', 'ROADMAP.md'));
    if (!roadmap) return { version: 'v1.0', name: 'milestone', phaseRange: null };
    let version = null;
    let name = null;
    let phaseRange = null;

    // Helper to extract phase range from a milestone line
    function extractPhaseRange(line) {
      const rangeMatch = line.match(/Phases?\s+(\d+)\s*[-–]\s*(\d+)/i);
      if (rangeMatch) return { start: parseInt(rangeMatch[1]), end: parseInt(rangeMatch[2]) };
      return null;
    }

    // Strategy 1: Look for active milestone marker (🔵 or "(active)")
    const activeMatch = roadmap.match(/[-*]\s*🔵\s*\*\*v(\d+(?:\.\d+)*)\s+([^*]+)\*\*([^\n]*)/);
    if (activeMatch) {
      version = 'v' + activeMatch[1];
      name = activeMatch[2].trim();
      phaseRange = extractPhaseRange(activeMatch[0]);
    }

    // Strategy 2: Look for "(active)" tag on a milestone line
    if (!version) {
      const activeTagMatch = roadmap.match(/[-*]\s*(?:🔵\s*)?\*\*v(\d+(?:\.\d+)*)\s+([^*]+)\*\*([^\n]*\(active\)[^\n]*)/i);
      if (activeTagMatch) {
        version = 'v' + activeTagMatch[1];
        name = activeTagMatch[2].trim();
        phaseRange = extractPhaseRange(activeTagMatch[0]);
      }
    }

    // Strategy 3: Parse "Active Milestone" from Current Work section
    if (!version) {
      const currentWorkMatch = roadmap.match(/\*\*Active Milestone\*\*\s*[-—]+\s*v(\d+(?:\.\d+)*)[\s:]+([^\n]+)/i);
      if (currentWorkMatch) {
        version = 'v' + currentWorkMatch[1];
        name = currentWorkMatch[2].trim();
        // Try to find phase range from milestone list for this version
        const listMatch = roadmap.match(cachedRegex('v' + currentWorkMatch[1].replace('.', '\\.') + '[^\\n]*Phases?\\s+(\\d+)\\s*[-–]\\s*(\\d+)', 'i'));
        if (listMatch) phaseRange = { start: parseInt(listMatch[1]), end: parseInt(listMatch[2]) };
      }
    }

    // Strategy 4: Last non-completed milestone in the list (no ✅)
    if (!version) {
      const milestoneLines = [...roadmap.matchAll(/[-*]\s*(?!✅)[^\n]*\*\*v(\d+(?:\.\d+)*)\s+([^*]+)\*\*([^\n]*)/g)];
      if (milestoneLines.length > 0) {
        const last = milestoneLines[milestoneLines.length - 1];
        version = 'v' + last[1];
        name = last[2].trim();
        phaseRange = extractPhaseRange(last[0]);
      }
    }

    // Strategy 5: Fall back to any version match (original behavior)
    if (!version) {
      const versionMatch = roadmap.match(/v(\d+\.\d+)/);
      const nameMatch = roadmap.match(/## .*v\d+\.\d+[:\s]+([^\n(]+)/);
      version = versionMatch ? versionMatch[0] : 'v1.0';
      name = nameMatch ? nameMatch[1].trim() : 'milestone';
    }

    return { version, name, phaseRange };
  } catch (e) {
    debugLog('milestone.info', 'read roadmap for milestone failed', e);
    return { version: 'v1.0', name: 'milestone', phaseRange: null };
  }
}

/** Invalidate milestone cache (call after writing ROADMAP.md) */
function invalidateMilestoneCache() {
  _milestoneCache = null;
  _milestoneCwd = null;
}

// ─── Workflow Reference Parsing ──────────────────────────────────────────────

/**
 * Extract @-file-references from markdown content.
 * Handles: @/absolute/path, @relative/path, @.planning/path
 * Also extracts from <context>, <required_reading>, <execution_context> blocks.
 * Skips email addresses, @mentions without paths, and too-short refs.
 *
 * @param {string} content - Markdown content to parse
 * @returns {string[]} Array of unique file path references
 */
function extractAtReferences(content) {
  if (!content || typeof content !== 'string') return [];

  const refs = new Set();

  // Match @-references: @ followed by a path-like string (contains / or starts with .)
  // Patterns: @/home/user/file.md, @.planning/STATE.md, @src/lib/output.js
  const atPattern = /@((?:\/[\w.+\-/]+|\.[\w.+\-/]+|[\w][\w.+\-]*\/[\w.+\-/]+)(?:\.\w+)?)/g;
  let match;
  while ((match = atPattern.exec(content)) !== null) {
    const ref = match[1];
    // Filter: must contain a / to be a path, skip email-like patterns
    if (ref.includes('/') && !ref.includes('@') && ref.length > 2) {
      refs.add(ref);
    }
  }

  return Array.from(refs);
}

// ─── Intent Parsing ─────────────────────────────────────────────────────────

/**
 * Parse INTENT.md content into structured JSON.
 * Graceful degradation: missing sections return null/empty defaults.
 */
function parseIntentMd(content) {
  if (!content || typeof content !== 'string') {
    return {
      revision: null, created: null, updated: null,
      objective: { statement: '', elaboration: '' },
      users: [], outcomes: [], criteria: [],
      constraints: { technical: [], business: [], timeline: [] },
      health: { quantitative: [], qualitative: '' },
      history: [],
    };
  }

  // Extract revision, created, updated from metadata
  const revisionMatch = content.match(/\*\*Revision:\*\*\s*(\d+)/);
  const createdMatch = content.match(/\*\*Created:\*\*\s*(\S+)/);
  const updatedMatch = content.match(/\*\*Updated:\*\*\s*(\S+)/);

  const revision = revisionMatch ? parseInt(revisionMatch[1], 10) : null;
  const created = createdMatch ? createdMatch[1] : null;
  const updated = updatedMatch ? updatedMatch[1] : null;

  // Extract XML-tagged sections
  function extractSection(tag) {
    const pattern = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`);
    const match = content.match(pattern);
    return match ? match[1].trim() : null;
  }

  // Parse objective: first line = statement, rest = elaboration
  const objectiveRaw = extractSection('objective');
  const objective = { statement: '', elaboration: '' };
  if (objectiveRaw) {
    const lines = objectiveRaw.split('\n');
    objective.statement = lines[0].trim();
    objective.elaboration = lines.slice(1).join('\n').trim();
  }

  // Parse users: bullet list items
  const usersRaw = extractSection('users');
  const users = [];
  if (usersRaw) {
    const userLines = usersRaw.split('\n').filter(l => l.match(/^\s*-\s+/));
    for (const line of userLines) {
      const text = line.replace(/^\s*-\s+/, '').trim();
      if (text) users.push({ text });
    }
  }

  // Parse outcomes: - DO-XX [PX]: description
  const outcomesRaw = extractSection('outcomes');
  const outcomes = [];
  if (outcomesRaw) {
    const outcomePattern = /^\s*-\s+(DO-\d+)\s+\[(P[123])\]:\s*(.+)/;
    for (const line of outcomesRaw.split('\n')) {
      const match = line.match(outcomePattern);
      if (match) {
        outcomes.push({ id: match[1], priority: match[2], text: match[3].trim() });
      }
    }
  }

  // Parse criteria: - SC-XX: description
  const criteriaRaw = extractSection('criteria');
  const criteria = [];
  if (criteriaRaw) {
    const criteriaPattern = /^\s*-\s+(SC-\d+):\s*(.+)/;
    for (const line of criteriaRaw.split('\n')) {
      const match = line.match(criteriaPattern);
      if (match) {
        criteria.push({ id: match[1], text: match[2].trim() });
      }
    }
  }

  // Parse constraints: split by ### Technical, ### Business, ### Timeline sub-headers
  const constraintsRaw = extractSection('constraints');
  const constraints = { technical: [], business: [], timeline: [] };
  if (constraintsRaw) {
    const constraintPattern = /^\s*-\s+(C-\d+):\s*(.+)/;
    let currentType = null;
    for (const line of constraintsRaw.split('\n')) {
      if (/^###\s*Technical/i.test(line)) { currentType = 'technical'; continue; }
      if (/^###\s*Business/i.test(line)) { currentType = 'business'; continue; }
      if (/^###\s*Timeline/i.test(line)) { currentType = 'timeline'; continue; }
      if (currentType) {
        const match = line.match(constraintPattern);
        if (match) {
          constraints[currentType].push({ id: match[1], text: match[2].trim() });
        }
      }
    }
  }

  // Parse health: split by ### Quantitative and ### Qualitative
  const healthRaw = extractSection('health');
  const health = { quantitative: [], qualitative: '' };
  if (healthRaw) {
    const healthPattern = /^\s*-\s+(HM-\d+):\s*(.+)/;
    let inQuantitative = false;
    let inQualitative = false;
    const qualLines = [];
    for (const line of healthRaw.split('\n')) {
      if (/^###\s*Quantitative/i.test(line)) { inQuantitative = true; inQualitative = false; continue; }
      if (/^###\s*Qualitative/i.test(line)) { inQualitative = true; inQuantitative = false; continue; }
      if (inQuantitative) {
        const match = line.match(healthPattern);
        if (match) {
          health.quantitative.push({ id: match[1], text: match[2].trim() });
        }
      }
      if (inQualitative && line.trim()) {
        qualLines.push(line.trim());
      }
    }
    health.qualitative = qualLines.join('\n');
  }

  // Parse history: milestone-grouped entries tracking intent evolution
  const historyRaw = extractSection('history');
  const history = [];
  if (historyRaw) {
    let currentEntry = null;
    let currentChange = null;
    for (const line of historyRaw.split('\n')) {
      // New milestone entry: ### vX.Y — YYYY-MM-DD
      const milestoneMatch = line.match(/^###\s+(v[\d.]+)\s+[—–-]\s+(\d{4}-\d{2}-\d{2})/);
      if (milestoneMatch) {
        if (currentChange && currentEntry) currentEntry.changes.push(currentChange);
        currentChange = null;
        if (currentEntry) history.push(currentEntry);
        currentEntry = { milestone: milestoneMatch[1], date: milestoneMatch[2], changes: [] };
        continue;
      }
      // Change line: - **Type** target: description
      const changeMatch = line.match(/^\s*-\s+\*\*(Added|Modified|Removed)\*\*\s+(.+?):\s*(.+)/);
      if (changeMatch && currentEntry) {
        if (currentChange) currentEntry.changes.push(currentChange);
        currentChange = { type: changeMatch[1], target: changeMatch[2], description: changeMatch[3].trim() };
        continue;
      }
      // Reason line:   - Reason: text
      const reasonMatch = line.match(/^\s+-\s+Reason:\s*(.+)/);
      if (reasonMatch && currentChange) {
        currentChange.reason = reasonMatch[1].trim();
        continue;
      }
    }
    if (currentChange && currentEntry) currentEntry.changes.push(currentChange);
    if (currentEntry) history.push(currentEntry);
  }

  return {
    revision, created, updated,
    objective, users, outcomes, criteria, constraints, health, history,
  };
}

/**
 * Generate INTENT.md content from structured data.
 * When data has empty sections, produces HTML comments as instructions.
 */
function generateIntentMd(data) {
  const lines = [];

  // Metadata
  lines.push(`**Revision:** ${data.revision || 1}`);
  lines.push(`**Created:** ${data.created || new Date().toISOString().split('T')[0]}`);
  lines.push(`**Updated:** ${data.updated || new Date().toISOString().split('T')[0]}`);
  lines.push('');

  // Objective
  lines.push('<objective>');
  if (data.objective && data.objective.statement) {
    lines.push(data.objective.statement);
    if (data.objective.elaboration) {
      lines.push('');
      lines.push(data.objective.elaboration);
    }
  } else {
    lines.push('<!-- Single statement: what this project does and why -->');
  }
  lines.push('</objective>');
  lines.push('');

  // Users
  lines.push('<users>');
  if (data.users && data.users.length > 0) {
    for (const u of data.users) {
      lines.push(`- ${u.text}`);
    }
  } else {
    lines.push('<!-- Brief audience descriptions, one per line -->');
  }
  lines.push('</users>');
  lines.push('');

  // Outcomes
  lines.push('<outcomes>');
  if (data.outcomes && data.outcomes.length > 0) {
    for (const o of data.outcomes) {
      lines.push(`- ${o.id} [${o.priority}]: ${o.text}`);
    }
  } else {
    lines.push('<!-- Bullet list: - DO-XX [PX]: description -->');
  }
  lines.push('</outcomes>');
  lines.push('');

  // Criteria
  lines.push('<criteria>');
  if (data.criteria && data.criteria.length > 0) {
    for (const c of data.criteria) {
      lines.push(`- ${c.id}: ${c.text}`);
    }
  } else {
    lines.push('<!-- Bullet list: - SC-XX: launch gate -->');
  }
  lines.push('</criteria>');
  lines.push('');

  // Constraints
  lines.push('<constraints>');
  const hasTech = data.constraints && data.constraints.technical && data.constraints.technical.length > 0;
  const hasBiz = data.constraints && data.constraints.business && data.constraints.business.length > 0;
  const hasTime = data.constraints && data.constraints.timeline && data.constraints.timeline.length > 0;
  if (hasTech || hasBiz || hasTime) {
    if (hasTech) {
      lines.push('### Technical');
      for (const c of data.constraints.technical) {
        lines.push(`- ${c.id}: ${c.text}`);
      }
      lines.push('');
    }
    if (hasBiz) {
      lines.push('### Business');
      for (const c of data.constraints.business) {
        lines.push(`- ${c.id}: ${c.text}`);
      }
      lines.push('');
    }
    if (hasTime) {
      lines.push('### Timeline');
      for (const c of data.constraints.timeline) {
        lines.push(`- ${c.id}: ${c.text}`);
      }
      lines.push('');
    }
  } else {
    lines.push('<!-- Sub-headers: ### Technical, ### Business, ### Timeline. Items: - C-XX: constraint -->');
  }
  lines.push('</constraints>');
  lines.push('');

  // Health
  lines.push('<health>');
  const hasQuant = data.health && data.health.quantitative && data.health.quantitative.length > 0;
  const hasQual = data.health && data.health.qualitative && data.health.qualitative.trim();
  if (hasQuant || hasQual) {
    if (hasQuant) {
      lines.push('### Quantitative');
      for (const m of data.health.quantitative) {
        lines.push(`- ${m.id}: ${m.text}`);
      }
      lines.push('');
    }
    if (hasQual) {
      lines.push('### Qualitative');
      lines.push(data.health.qualitative);
    }
  } else {
    lines.push('<!-- Sub-headers: ### Quantitative (- HM-XX: metric) and ### Qualitative (prose) -->');
  }
  lines.push('</health>');
  lines.push('');

  // History (optional — only written if entries exist)
  if (data.history && data.history.length > 0) {
    lines.push('<history>');
    for (const entry of data.history) {
      lines.push(`### ${entry.milestone} — ${entry.date}`);
      for (const change of entry.changes) {
        lines.push(`- **${change.type}** ${change.target}: ${change.description}`);
        if (change.reason) {
          lines.push(`  - Reason: ${change.reason}`);
        }
      }
      lines.push('');
    }
    lines.push('</history>');
    lines.push('');
  }

  return lines.join('\n');
}

// ─── Plan Intent Parsing ─────────────────────────────────────────────────────

/**
 * Extract intent tracing data from a PLAN.md's YAML frontmatter.
 * Looks for an `intent` field with `outcome_ids` and `rationale`.
 *
 * Handles:
 *   - Array format: outcome_ids: [DO-01, DO-03]
 *   - Comma-separated string: outcome_ids: "DO-01, DO-03"
 *   - Validates IDs match DO-\d+ pattern, filters out invalid ones
 *
 * @param {string} content - Raw PLAN.md file content
 * @returns {{ outcome_ids: string[], rationale: string } | null}
 */
function parsePlanIntent(content) {
  if (!content || typeof content !== 'string') return null;

  const { extractFrontmatter } = require('./frontmatter');
  const fm = extractFrontmatter(content);
  if (!fm || !fm.intent) return null;

  const intent = fm.intent;
  let outcomeIds = [];
  let rationale = '';

  // Extract outcome_ids
  const rawIds = intent.outcome_ids || intent['outcome_ids'];
  if (rawIds) {
    if (Array.isArray(rawIds)) {
      outcomeIds = rawIds;
    } else if (typeof rawIds === 'string') {
      // Comma-separated string: "DO-01, DO-03"
      outcomeIds = rawIds.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  // Validate IDs match DO-\d+ pattern
  const doPattern = /^DO-\d+$/;
  outcomeIds = outcomeIds.filter(id => doPattern.test(id));

  // Extract rationale
  rationale = intent.rationale || '';

  if (outcomeIds.length === 0 && !rationale) return null;

  return { outcome_ids: outcomeIds, rationale };
}

module.exports = {
  safeReadFile,
  cachedReadFile,
  invalidateFileCache,
  cachedReaddirSync,
  getPhaseTree,
  normalizePhaseName,
  buildPhaseHandoffRunId,
  buildPhaseHandoffExpectedFingerprint,
  buildPhaseHandoffSourceFingerprint,
  buildDefaultPhaseHandoffSummary,
  parseMustHavesBlock,
  sanitizeShellArg,
  isValidDateString,
  resolveModelInternal,
  getArchivedPhaseDirs,
  findPhaseInternal,
  getRoadmapPhaseInternal,
  buildPhaseSnapshotInternal,
  pathExistsInternal,
  createWorkspaceEvidenceIndex,
  getRuntimeFreshness,
  generateSlugInternal,
  getMilestoneInfo,
  extractAtReferences,
  normalizeTddHintValue,
  readRoadmapWithTddNormalization,
  normalizePlanTddMetadata,
  normalizePlanFileTddMetadata,
  normalizePhasePlanFilesTddMetadata,
  parseIntentMd,
  generateIntentMd,
  parsePlanIntent,
};
