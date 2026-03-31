'use strict';

const path = require('path');
const { extractFrontmatter } = require('./frontmatter');
const {
  cachedReadFile,
  createWorkspaceEvidenceIndex,
  getPhaseTree,
  normalizePhaseName,
} = require('./helpers');

function flattenValue(value) {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.flatMap(flattenValue);
  return [value];
}

function normalizeStringValue(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().replace(/^['"]|['"]$/g, '');
  return normalized || null;
}

function normalizeSection(rawValue, normalizeItem) {
  const rawItems = flattenValue(rawValue);
  const items = rawItems.map(normalizeItem).filter(Boolean);
  const status = items.length > 0 ? 'present' : rawItems.length > 0 ? 'inconclusive' : 'missing';
  return {
    status,
    rawCount: rawItems.length,
    items,
  };
}

function normalizeTruthItem(item) {
  if (typeof item === 'string') {
    const text = normalizeStringValue(item);
    return text ? { text } : null;
  }
  if (item && typeof item === 'object') {
    const text = normalizeStringValue(item.text || item.truth || item.value);
    return text ? { text } : null;
  }
  return null;
}

function normalizeArtifactItem(item) {
  if (typeof item === 'string') {
    const artifactPath = normalizeStringValue(item);
    if (artifactPath && /^(path|file|artifact|provides|contains|exports|min_lines|minLines):\s*/i.test(artifactPath)) {
      return null;
    }
    return artifactPath ? { path: artifactPath, provides: '' } : null;
  }
  if (item && typeof item === 'object') {
    const artifactPath = normalizeStringValue(item.path || item.file || item.artifact);
    if (!artifactPath) return null;
    return {
      path: artifactPath,
      provides: normalizeStringValue(item.provides) || '',
      contains: normalizeStringValue(item.contains) || null,
      exports: item.exports || null,
      min_lines: item.min_lines || item.minLines || null,
    };
  }
  return null;
}

function parseKeyLinkString(value) {
  const normalized = normalizeStringValue(value);
  if (!normalized) return null;

  const viaMatch = normalized.match(/^(.+?)\s*->\s*(.+?)(?:\s+via\s+(.+))?$/);
  if (!viaMatch) return null;
  return {
    from: normalizeStringValue(viaMatch[1]),
    to: normalizeStringValue(viaMatch[2]),
    via: normalizeStringValue(viaMatch[3]) || '',
    pattern: null,
  };
}

function normalizeKeyLinkItem(item) {
  if (typeof item === 'string') return parseKeyLinkString(item);
  if (item && typeof item === 'object') {
    const from = normalizeStringValue(item.from || item.source);
    const to = normalizeStringValue(item.to || item.target);
    if (!from && !to) return null;
    return {
      from: from || '',
      to: to || '',
      via: normalizeStringValue(item.via) || '',
      pattern: normalizeStringValue(item.pattern) || null,
    };
  }
  return null;
}

function normalizeMustHaves(rawMustHaves) {
  const source = rawMustHaves && typeof rawMustHaves === 'object' && !Array.isArray(rawMustHaves)
    ? rawMustHaves
    : null;

  const truths = normalizeSection(source?.truths, normalizeTruthItem);
  const artifacts = normalizeSection(source?.artifacts, normalizeArtifactItem);
  const keyLinks = normalizeSection(source?.key_links ?? source?.keyLinks, normalizeKeyLinkItem);
  const status = !source
    ? 'missing'
    : (truths.items.length + artifacts.items.length + keyLinks.items.length) > 0
      ? 'present'
      : 'inconclusive';

  return {
    status,
    truths,
    artifacts,
    keyLinks,
  };
}

function getIndent(line) {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

function parseYamlScalar(value) {
  const normalized = normalizeStringValue(value);
  return normalized === null ? '' : normalized;
}

function parseInlineArray(value) {
  const inner = value.trim().slice(1, -1).trim();
  if (!inner) return [];
  return inner.split(/,(?=(?:[^"']|"[^"]*"|'[^']*')*$)/).map((item) => parseYamlScalar(item)).filter(Boolean);
}

function parseRawMustHavesSection(content, blockName) {
  const fmMatch = content && content.match(/^---\n([\s\S]+?)\n---/);
  if (!fmMatch) return [];

  const lines = fmMatch[1].split('\n');
  const mustIndex = lines.findIndex((line) => /^\s*must_haves:\s*$/.test(line));
  if (mustIndex === -1) return [];

  const mustIndent = getIndent(lines[mustIndex]);
  let sectionIndex = -1;
  let sectionIndent = -1;
  for (let index = mustIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    const indent = getIndent(line);
    if (indent <= mustIndent) break;
    const trimmed = line.trim();
    if (trimmed.startsWith(`${blockName}:`)) {
      sectionIndex = index;
      sectionIndent = indent;
      break;
    }
  }

  if (sectionIndex === -1) return [];

  const header = lines[sectionIndex].trim();
  const inlineValue = header.slice(blockName.length + 1).trim();
  if (inlineValue) {
    if (inlineValue.startsWith('[') && inlineValue.endsWith(']')) return parseInlineArray(inlineValue);
    return [parseYamlScalar(inlineValue)].filter(Boolean);
  }

  const items = [];
  let current = null;

  for (let index = sectionIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    const indent = getIndent(line);
    if (indent <= sectionIndent) break;
    const trimmed = line.trim();

    if (trimmed.startsWith('- ')) {
      if (current) items.push(current);
      const itemValue = trimmed.slice(2).trim();
      const separator = itemValue.indexOf(':');
      if (separator > 0) {
        const key = itemValue.slice(0, separator).trim();
        const value = itemValue.slice(separator + 1).trim();
        current = { [key]: parseYamlScalar(value) };
      } else {
        current = parseYamlScalar(itemValue);
      }
      continue;
    }

    if (!current || typeof current !== 'object') continue;
    const separator = trimmed.indexOf(':');
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    current[key] = parseYamlScalar(value);
  }

  if (current) items.push(current);
  return items;
}

function hasSuspiciousNormalizedItems(sectionName, section) {
  if (!section || section.status !== 'present') return false;
  if (sectionName === 'artifacts') {
    return section.items.some((item) => /^(path|file|artifact):\s*/i.test(item.path || ''));
  }
  if (sectionName === 'key_links') {
    return section.items.some((item) => /^(from|to|source|target):\s*/i.test(item.from || '') || /^(from|to|source|target):\s*/i.test(item.to || ''));
  }
  if (sectionName === 'truths') {
    return section.items.some((item) => /^(text|truth|value):\s*/i.test(item.text || ''));
  }
  return false;
}

function chooseNormalizedSection(sectionName, primary, fallback) {
  if (fallback.status === 'present' && (primary.status !== 'present' || hasSuspiciousNormalizedItems(sectionName, primary))) {
    return fallback;
  }
  if (primary.status !== 'present' && fallback.status !== 'missing') {
    return fallback;
  }
  return primary;
}

function normalizeMustHavesFromPlan(rawMustHaves, content) {
  const primary = normalizeMustHaves(rawMustHaves);
  if (!content) return primary;

  const fallbackTruths = normalizeSection(parseRawMustHavesSection(content, 'truths'), normalizeTruthItem);
  const fallbackArtifacts = normalizeSection(parseRawMustHavesSection(content, 'artifacts'), normalizeArtifactItem);
  const fallbackKeyLinks = normalizeSection(parseRawMustHavesSection(content, 'key_links'), normalizeKeyLinkItem);

  const truths = chooseNormalizedSection('truths', primary.truths, fallbackTruths);
  const artifacts = chooseNormalizedSection('artifacts', primary.artifacts, fallbackArtifacts);
  const keyLinks = chooseNormalizedSection('key_links', primary.keyLinks, fallbackKeyLinks);
  const status = (truths.items.length + artifacts.items.length + keyLinks.items.length) > 0
    ? 'present'
    : (!rawMustHaves && fallbackTruths.rawCount + fallbackArtifacts.rawCount + fallbackKeyLinks.rawCount === 0)
      ? 'missing'
      : 'inconclusive';

  return {
    status,
    truths,
    artifacts,
    keyLinks,
  };
}

function createPlanMetadataContext(options = {}) {
  const cwd = options.cwd || process.cwd();
  const readFile = options.readFile || cachedReadFile;
  const planCache = new Map();
  const phaseCache = new Map();
  const workspace = createWorkspaceEvidenceIndex(cwd, options.workspace || {});

  return {
    cwd,
    workspace,
    getPlan(planFilePath) {
      const absolutePath = path.isAbsolute(planFilePath) ? planFilePath : path.join(cwd, planFilePath);
      if (planCache.has(absolutePath)) return planCache.get(absolutePath);

      const content = readFile(absolutePath);
      const frontmatter = content ? extractFrontmatter(content) : {};
      const metadata = {
        path: planFilePath,
        absolutePath,
        relativePath: path.relative(cwd, absolutePath),
        content,
        frontmatter,
        mustHaves: normalizeMustHavesFromPlan(frontmatter.must_haves, content),
      };

      planCache.set(absolutePath, metadata);
      return metadata;
    },
    listPhasePlans(phase) {
      const normalizedPhase = normalizePhaseName(String(phase || ''));
      if (phaseCache.has(normalizedPhase)) return phaseCache.get(normalizedPhase);

      const phaseEntry = getPhaseTree(cwd).get(normalizedPhase);
      const plans = !phaseEntry
        ? []
        : phaseEntry.plans.map((planFile) => this.getPlan(path.join(phaseEntry.relPath, planFile)));

      phaseCache.set(normalizedPhase, plans);
      return plans;
    },
  };
}

function readPlanMetadata(planFilePath, options = {}) {
  const context = options.context || createPlanMetadataContext(options);
  return context.getPlan(planFilePath);
}

function listPhasePlanMetadata(phase, options = {}) {
  const context = options.context || createPlanMetadataContext(options);
  return context.listPhasePlans(phase);
}

module.exports = {
  createPlanMetadataContext,
  readPlanMetadata,
  listPhasePlanMetadata,
  normalizeMustHaves,
  normalizeMustHavesFromPlan,
};
