const fs = require('fs');
const path = require('path');
const { debugLog } = require('./output');
const { loadConfig } = require('./config');
const { MODEL_PROFILES } = require('./constants');

// ─── File Helpers ────────────────────────────────────────────────────────────

/** Module-level file cache — lives for single CLI invocation, no TTL needed */
const fileCache = new Map();

function safeReadFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    debugLog('file.read', 'read failed', e);
    return null;
  }
}

/**
 * Cached wrapper around safeReadFile. Returns cached content on repeated reads
 * of the same path within a single CLI invocation. Use safeReadFile directly
 * when you need a guaranteed fresh read.
 */
function cachedReadFile(filePath) {
  if (fileCache.has(filePath)) {
    debugLog('file.cache', `cache hit: ${filePath}`);
    return fileCache.get(filePath);
  }
  const content = safeReadFile(filePath);
  if (content !== null) {
    fileCache.set(filePath, content);
  }
  return content;
}

/**
 * Invalidate a specific file from cache, or clear entire cache if no path given.
 * Call after writing a file to ensure subsequent reads get fresh content.
 */
function invalidateFileCache(filePath) {
  if (filePath) {
    fileCache.delete(filePath);
  } else {
    fileCache.clear();
  }
}

// ─── Phase Helpers ───────────────────────────────────────────────────────────

function normalizePhaseName(phase) {
  const match = phase.match(/^(\d+(?:\.\d+)?)/);
  if (!match) return phase;
  const num = match[1];
  const parts = num.split('.');
  const padded = parts[0].padStart(2, '0');
  return parts.length > 1 ? `${padded}.${parts[1]}` : padded;
}

// ─── Must-Haves Block Parser ─────────────────────────────────────────────────

function parseMustHavesBlock(content, blockName) {
  // Extract a specific block from must_haves in raw frontmatter YAML
  // Handles 3-level nesting: must_haves > artifacts/key_links > [{path, provides, ...}]
  const fmMatch = content.match(/^---\n([\s\S]+?)\n---/);
  if (!fmMatch) return [];

  const yaml = fmMatch[1];
  // Find the block (e.g., "truths:", "artifacts:", "key_links:")
  const blockPattern = new RegExp(`^\\s{4}${blockName}:\\s*$`, 'm');
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

  // Fall back to profile lookup
  const profile = config.model_profile || 'balanced';
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
    const match = dirs.find(d => d.startsWith(normalized));
    if (!match) return null;

    const dirMatch = match.match(/^(\d+(?:\.\d+)?)-?(.*)/);
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

  const phasesDir = path.join(cwd, '.planning', 'phases');
  const normalized = normalizePhaseName(phase);

  // Search current phases first
  const current = searchPhaseInDir(phasesDir, path.join('.planning', 'phases'), normalized);
  if (current) return current;

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
  if (!fs.existsSync(roadmapPath)) return null;

  try {
    const content = fs.readFileSync(roadmapPath, 'utf-8');
    const escapedPhase = phaseNum.toString().replace(/\./g, '\\.');
    const phasePattern = new RegExp(`#{2,4}\\s*Phase\\s+${escapedPhase}:\\s*([^\\n]+)`, 'i');
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

function getMilestoneInfo(cwd) {
  try {
    const roadmap = fs.readFileSync(path.join(cwd, '.planning', 'ROADMAP.md'), 'utf-8');
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
        const listMatch = roadmap.match(new RegExp('v' + currentWorkMatch[1].replace('.', '\\.') + '[^\\n]*Phases?\\s+(\\d+)\\s*[-–]\\s*(\\d+)', 'i'));
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
  normalizePhaseName,
  parseMustHavesBlock,
  sanitizeShellArg,
  isValidDateString,
  resolveModelInternal,
  getArchivedPhaseDirs,
  searchPhaseInDir,
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
