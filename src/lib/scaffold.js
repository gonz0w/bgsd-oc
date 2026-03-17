// ─── Scaffold Merge Library ───────────────────────────────────────────────────
// Reusable data/judgment separation and merge utilities for plan:generate and
// verify:generate commands. Generalizes the JUDGMENT_SECTIONS + mergeSummary()
// pattern from src/commands/misc.js into a standalone module.

'use strict';

const { extractFrontmatter, reconstructFrontmatter } = require('./frontmatter');

// ─── Marker Constants ─────────────────────────────────────────────────────────

/** HTML comment marker placed at the start of a CLI-pre-filled data section */
const DATA_MARKER = '<!-- data -->';

/** HTML comment marker placed at the start of an LLM-fills judgment section */
const JUDGMENT_MARKER = '<!-- judgment -->';

/** Closing marker for data sections */
const DATA_END = '<!-- /data -->';

/** Closing marker for judgment sections */
const JUDGMENT_END = '<!-- /judgment -->';

// ─── markSection ─────────────────────────────────────────────────────────────

/**
 * Wraps a content block with the appropriate open/close marker pair.
 *
 * @param {string} content - The section body text to wrap
 * @param {'data'|'judgment'} type - Marker type to apply
 * @returns {string} Content wrapped with marker pair
 */
function markSection(content, type) {
  if (type === 'data') {
    return `${DATA_MARKER}\n${content}\n${DATA_END}`;
  }
  return `${JUDGMENT_MARKER}\n${content}\n${JUDGMENT_END}`;
}

// ─── parseMarkedSections ──────────────────────────────────────────────────────

/**
 * Parse a scaffold document (frontmatter already stripped) into a structured
 * map of sections. Mirrors parseSummarySections() in misc.js but also detects
 * data/judgment marker types per section.
 *
 * @param {string} text - Document text (may include frontmatter — it will be stripped)
 * @returns {Map<string, {content: string, markerType: 'data'|'judgment'|null}>}
 */
function parseMarkedSections(text) {
  if (!text || typeof text !== 'string') return new Map();

  // Strip frontmatter if present
  const bodyMatch = text.match(/^---[\s\S]*?---\n\n?([\s\S]*)$/);
  const body = bodyMatch ? bodyMatch[1] : text;

  const result = new Map();
  const headingRegex = /^## (.+)$/gm;
  let match;
  const headings = [];

  while ((match = headingRegex.exec(body)) !== null) {
    headings.push({ heading: match[1].trim(), index: match.index + match[0].length });
  }

  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].index;
    const end = i + 1 < headings.length
      ? headings[i + 1].index - `## ${headings[i + 1].heading}`.length - 1
      : body.length;

    const content = body.slice(start, end).trim();

    // Detect marker type
    let markerType = null;
    if (content.includes(DATA_MARKER)) markerType = 'data';
    else if (content.includes(JUDGMENT_MARKER)) markerType = 'judgment';

    result.set(headings[i].heading, { content, markerType });
  }

  return result;
}

// ─── mergeScaffold ────────────────────────────────────────────────────────────

/**
 * Idempotent merge: preserves LLM-written judgment sections from an existing
 * document while refreshing data sections from a freshly generated document.
 * Mirrors mergeSummary() in misc.js but is generalized for any document type.
 *
 * @param {string|null} existingText - Existing file content (null = fresh generation)
 * @param {string} freshText - Freshly generated scaffold content
 * @param {string[]} judgmentHeadings - Section headings that are LLM-fills
 * @returns {string} Merged document string
 */
function mergeScaffold(existingText, freshText, judgmentHeadings) {
  // Fresh generation — no existing content to preserve
  if (!existingText) return freshText;

  const existingSections = parseMarkedSections(existingText);
  const freshSections = parseMarkedSections(freshText);

  // Start from the fresh sections map; selectively replace judgment sections
  // with preserved existing content if the LLM has filled them (no TODO:)
  const merged = new Map(freshSections);

  for (const heading of judgmentHeadings) {
    const existingSection = existingSections.get(heading);
    if (existingSection && !existingSection.content.includes('TODO:')) {
      // LLM has filled this section — preserve it
      merged.set(heading, existingSection);
    }
  }

  // Preserve filled frontmatter fields from existing
  const existingFm = extractFrontmatter(existingText);
  const freshFm = extractFrontmatter(freshText);

  const preservableFmFields = [
    'key-decisions', 'one-liner', 'provides', 'affects', 'requires',
    'tech-stack', 'patterns-established', 'subsystem', 'tags',
    'title', 'status',
  ];

  const mergedFm = Object.assign({}, freshFm);
  for (const field of preservableFmFields) {
    const existVal = existingFm[field];
    if (existVal === undefined || existVal === null) continue;

    const isTodo = (v) => typeof v === 'string' && v.includes('TODO:');
    const isArrayWithTodo = (v) => Array.isArray(v) && v.some(item => isTodo(item));

    if (isTodo(existVal) || isArrayWithTodo(existVal)) continue;
    if (Array.isArray(existVal) && existVal.length === 0) continue;
    if (typeof existVal === 'object' && !Array.isArray(existVal)) {
      const hasContent = Object.values(existVal).some(v =>
        (Array.isArray(v) && v.length > 0) || (typeof v === 'string' && v.trim())
      );
      if (!hasContent) continue;
    }

    mergedFm[field] = existVal;
  }

  // Rebuild document: frontmatter + title heading + sections in fresh order
  const newFmYaml = reconstructFrontmatter(mergedFm);

  // Get title heading from fresh document
  const titleMatch = freshText.match(/^---[\s\S]*?---\n\n?(# .+)\n/);
  const titleLine = titleMatch ? titleMatch[1] : '';

  // Rebuild body: iterate fresh section order, using merged content
  const bodyLines = [];
  if (titleLine) bodyLines.push(titleLine);

  for (const [heading] of freshSections) {
    const section = merged.get(heading);
    bodyLines.push('');
    bodyLines.push(`## ${heading}`);
    bodyLines.push('');
    if (section) bodyLines.push(section.content);
  }

  return `---\n${newFmYaml}\n---\n\n${bodyLines.join('\n')}\n`;
}

// ─── formatFrontmatter ────────────────────────────────────────────────────────

/**
 * Serialize a JS object to YAML frontmatter string.
 * Reuses the reconstructFrontmatter() pattern from src/lib/frontmatter.js.
 *
 * @param {object} obj - Object to serialize as YAML frontmatter block (without delimiters)
 * @returns {string} YAML-formatted frontmatter content (without --- delimiters)
 */
function formatFrontmatter(obj) {
  return reconstructFrontmatter(obj);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  DATA_MARKER,
  JUDGMENT_MARKER,
  DATA_END,
  JUDGMENT_END,
  markSection,
  parseMarkedSections,
  mergeScaffold,
  formatFrontmatter,
};
