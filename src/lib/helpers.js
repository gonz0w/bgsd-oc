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
      // Use console.warn for visibility but keep it brief
      console.warn(`Warming cache... ${fileCount} files`);
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
    const content = cachedReadFile(roadmapPath);
    if (!content) return null;
    const escapedPhase = phaseNum.toString().replace(/\./g, '\\.');
    const phasePattern = cachedRegex(`#{2,4}\\s*Phase\\s+${escapedPhase}:\\s*([^\\n]+)`, 'i');
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

    return {
      found: true,
      phase_number: phaseNum.toString(),
      phase_name: phaseName,
      goal,
      section,
    };
  } catch (e) {
    debugLog('roadmap.getPhaseInternal', 'read roadmap phase failed', e);
    return null;
  }
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
  parseMustHavesBlock,
  sanitizeShellArg,
  isValidDateString,
  resolveModelInternal,
  getArchivedPhaseDirs,
  findPhaseInternal,
  getRoadmapPhaseInternal,
  pathExistsInternal,
  generateSlugInternal,
  getMilestoneInfo,
  extractAtReferences,
  parseIntentMd,
  generateIntentMd,
  parsePlanIntent,
};
