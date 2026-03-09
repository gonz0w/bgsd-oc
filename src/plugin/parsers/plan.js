import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * PLAN.md parser for in-process reading.
 * Extracts frontmatter, tasks, and sections from PLAN.md files.
 *
 * Parsing logic extracted from src/lib/frontmatter.js (extractFrontmatter)
 * and plan structure patterns. Self-contained — no CLI imports.
 */

// Module-level cache: planPath → frozen parsed plan, cwd → frozen plan array
const _planCache = new Map();
const _plansCache = new Map();

// Pre-compiled patterns
const FM_DELIMITERS = /^---\n([\s\S]+?)\n---/;
const FM_KEY_VALUE = /^(\s*)([a-zA-Z0-9_-]+):\s*(.*)/;

/**
 * Minimal YAML-like frontmatter parser.
 * Handles the subset of YAML used in PLAN.md files.
 * Extracted from src/lib/frontmatter.js — self-contained copy.
 */
function extractFrontmatter(content) {
  if (!content || typeof content !== 'string') return {};
  if (!content.startsWith('---\n')) return {};

  const frontmatter = {};
  const match = content.match(FM_DELIMITERS);
  if (!match) return frontmatter;

  const yaml = match[1];
  const lines = yaml.split('\n');

  let stack = [{ obj: frontmatter, key: null, indent: -1 }];

  for (const line of lines) {
    if (line.trim() === '') continue;

    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1].length : 0;

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const current = stack[stack.length - 1];

    const keyMatch = line.match(FM_KEY_VALUE);
    if (keyMatch) {
      const key = keyMatch[2];
      const value = keyMatch[3].trim();

      if (value === '' || value === '[') {
        current.obj[key] = value === '[' ? [] : {};
        current.key = null;
        stack.push({ obj: current.obj[key], key: null, indent });
      } else if (value.startsWith('[') && value.endsWith(']')) {
        current.obj[key] = value.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
        current.key = null;
      } else {
        current.obj[key] = value.replace(/^["']|["']$/g, '');
        current.key = null;
      }
    } else if (line.trim().startsWith('- ')) {
      const itemValue = line.trim().slice(2).replace(/^["']|["']$/g, '');

      if (typeof current.obj === 'object' && !Array.isArray(current.obj) && Object.keys(current.obj).length === 0) {
        const parent = stack.length > 1 ? stack[stack.length - 2] : null;
        if (parent) {
          for (const k of Object.keys(parent.obj)) {
            if (parent.obj[k] === current.obj) {
              parent.obj[k] = [itemValue];
              current.obj = parent.obj[k];
              break;
            }
          }
        }
      } else if (Array.isArray(current.obj)) {
        current.obj.push(itemValue);
      }
    }
  }

  return frontmatter;
}

/**
 * Extract an XML-tagged section from plan content.
 */
function extractXmlSection(content, tagName) {
  const pattern = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`);
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}

/**
 * Extract tasks from <tasks> section.
 */
function extractTasks(content) {
  const tasksSection = extractXmlSection(content, 'tasks');
  if (!tasksSection) return [];

  const tasks = [];
  const taskPattern = /<task\s+([^>]*)>([\s\S]*?)<\/task>/g;
  let match;

  while ((match = taskPattern.exec(tasksSection)) !== null) {
    const attrs = match[1];
    const body = match[2];

    // Parse attributes
    const typeMatch = attrs.match(/type="([^"]+)"/);
    const type = typeMatch ? typeMatch[1] : 'auto';

    // Parse named sub-elements
    const nameMatch = body.match(/<name>([\s\S]*?)<\/name>/);
    const filesMatch = body.match(/<files>([\s\S]*?)<\/files>/);
    const actionMatch = body.match(/<action>([\s\S]*?)<\/action>/);
    const verifyMatch = body.match(/<verify>([\s\S]*?)<\/verify>/);
    const doneMatch = body.match(/<done>([\s\S]*?)<\/done>/);

    tasks.push(Object.freeze({
      type,
      name: nameMatch ? nameMatch[1].trim() : null,
      files: filesMatch ? filesMatch[1].trim().split(',').map(f => f.trim()).filter(Boolean) : [],
      action: actionMatch ? actionMatch[1].trim() : null,
      verify: verifyMatch ? verifyMatch[1].trim() : null,
      done: doneMatch ? doneMatch[1].trim() : null,
    }));
  }

  return tasks;
}

/**
 * Parse a single PLAN.md file.
 * Returns a frozen object with frontmatter, sections, and tasks, or null if can't parse.
 *
 * @param {string} planPath - Absolute path to the PLAN.md file
 * @returns {object|null} Frozen plan object or null
 */
export function parsePlan(planPath) {
  // Check cache
  if (_planCache.has(planPath)) {
    return _planCache.get(planPath);
  }

  let raw;
  try {
    raw = readFileSync(planPath, 'utf-8');
  } catch {
    return null;
  }

  if (!raw || raw.trim().length === 0) {
    return null;
  }

  const frontmatter = extractFrontmatter(raw);
  const tasks = extractTasks(raw);

  const result = Object.freeze({
    raw,
    path: planPath,
    frontmatter: Object.freeze(frontmatter),
    objective: extractXmlSection(raw, 'objective'),
    context: extractXmlSection(raw, 'context'),
    tasks,
    verification: extractXmlSection(raw, 'verification'),
    successCriteria: extractXmlSection(raw, 'success_criteria'),
    output: extractXmlSection(raw, 'output'),
  });

  _planCache.set(planPath, result);
  return result;
}

/**
 * Discover and parse all PLAN.md files for a phase.
 * Returns a frozen array of parsed plans sorted by plan number, or empty array.
 *
 * @param {string|number} phaseNum - Phase number (e.g., "71" or 71)
 * @param {string} [cwd] - Working directory (defaults to process.cwd())
 * @returns {object[]} Frozen array of parsed plans
 */
export function parsePlans(phaseNum, cwd) {
  const resolvedCwd = cwd || process.cwd();
  const cacheKey = `${resolvedCwd}:${phaseNum}`;

  // Check cache
  if (_plansCache.has(cacheKey)) {
    return _plansCache.get(cacheKey);
  }

  const numStr = String(phaseNum).padStart(2, '0');
  const phasesDir = join(resolvedCwd, '.planning', 'phases');

  // Find phase directory
  let phaseDir = null;
  try {
    const entries = readdirSync(phasesDir);
    const dirName = entries.find(d => d.startsWith(numStr + '-') || d === numStr);
    if (dirName) {
      phaseDir = join(phasesDir, dirName);
    }
  } catch {
    return Object.freeze([]);
  }

  if (!phaseDir) {
    return Object.freeze([]);
  }

  // Find PLAN.md files
  let planFiles;
  try {
    const files = readdirSync(phaseDir);
    planFiles = files
      .filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md')
      .sort();
  } catch {
    return Object.freeze([]);
  }

  const plans = planFiles
    .map(f => parsePlan(join(phaseDir, f)))
    .filter(Boolean);

  const frozen = Object.freeze(plans);
  _plansCache.set(cacheKey, frozen);
  return frozen;
}

/**
 * Invalidate cached plans.
 * @param {string} [cwd] - Specific CWD to invalidate plans cache, or clear all
 */
export function invalidatePlans(cwd) {
  if (cwd) {
    // Clear entries matching this cwd
    for (const key of _plansCache.keys()) {
      if (key.startsWith(cwd + ':')) {
        _plansCache.delete(key);
      }
    }
    // Clear individual plan caches under this cwd
    for (const key of _planCache.keys()) {
      if (key.startsWith(cwd)) {
        _planCache.delete(key);
      }
    }
  } else {
    _planCache.clear();
    _plansCache.clear();
  }
}
