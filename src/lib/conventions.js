'use strict';

const fs = require('fs');
const path = require('path');
const { LANGUAGE_MAP } = require('./codebase-intel');

// ─── Naming Pattern Classifiers ──────────────────────────────────────────────

/** Regex classifiers for file naming patterns */
const NAMING_PATTERNS = {
  camelCase: /^[a-z][a-z0-9]*[A-Z][a-zA-Z0-9]*$/,
  PascalCase: /^[A-Z][a-zA-Z0-9]*[a-z][a-zA-Z0-9]*$/,
  snake_case: /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/,
  'kebab-case': /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/,
  UPPER_SNAKE_CASE: /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/,
};

/**
 * Classify a filename (without extension) into a naming pattern.
 *
 * @param {string} name - Filename without extension
 * @returns {string} Pattern name or 'single-word' or 'mixed'
 */
function classifyName(name) {
  // Check single-word first (before multi-word patterns)
  if (/^[a-z][a-z0-9]*$/.test(name)) return 'single-word';
  if (/^[A-Z][A-Z0-9]*$/.test(name)) return 'single-word';

  for (const [pattern, regex] of Object.entries(NAMING_PATTERNS)) {
    if (regex.test(name)) return pattern;
  }
  return 'mixed';
}


// ─── Source File Filtering ───────────────────────────────────────────────────

/** Extensions that represent source code (not config/docs) */
const SOURCE_LANGUAGES = new Set([
  'javascript', 'typescript', 'python', 'go', 'elixir', 'rust',
  'ruby', 'java', 'kotlin', 'c', 'cpp', 'shell', 'swift', 'dart',
  'lua', 'r', 'php', 'perl', 'zig', 'nim', 'vue', 'svelte',
]);

/**
 * Check if a file path is a source file (not config/docs/data).
 *
 * @param {string} filePath - Relative file path
 * @param {object} fileInfo - File info from intel (with language field)
 * @returns {boolean}
 */
function isSourceFile(filePath, fileInfo) {
  if (!fileInfo || !fileInfo.language) return false;
  return SOURCE_LANGUAGES.has(fileInfo.language);
}


// ─── Naming Convention Detection ─────────────────────────────────────────────

/**
 * Detect naming conventions from codebase intel file data.
 * Groups results by directory and calculates overall project patterns.
 *
 * @param {object} intel - Codebase intel object (from codebase-intel.json)
 * @returns {{ overall: object, by_directory: object }}
 */
function detectNamingConventions(intel) {
  if (!intel || !intel.files) return { overall: {}, by_directory: {} };

  const byDir = {};   // directory -> { pattern -> [filenames] }
  const allNames = {}; // pattern -> [filenames]

  for (const [filePath, fileInfo] of Object.entries(intel.files)) {
    if (!isSourceFile(filePath, fileInfo)) continue;

    const dir = path.dirname(filePath);
    const basename = path.basename(filePath, path.extname(filePath));
    const pattern = classifyName(basename);

    // Skip single-word — not informative for convention detection
    if (pattern === 'single-word') continue;

    // Track by directory
    if (!byDir[dir]) byDir[dir] = {};
    if (!byDir[dir][pattern]) byDir[dir][pattern] = [];
    byDir[dir][pattern].push(basename);

    // Track overall
    if (!allNames[pattern]) allNames[pattern] = [];
    allNames[pattern].push(basename);
  }

  // Calculate overall conventions
  const totalMultiWord = Object.values(allNames).reduce((sum, arr) => sum + arr.length, 0);
  const overall = {};
  for (const [pattern, names] of Object.entries(allNames)) {
    overall[pattern] = {
      pattern,
      confidence: totalMultiWord > 0 ? Math.round((names.length / totalMultiWord) * 100) : 0,
      file_count: names.length,
      examples: names.slice(0, 3),
    };
  }

  // Calculate per-directory conventions
  const byDirectory = {};
  for (const [dir, patterns] of Object.entries(byDir)) {
    const dirTotal = Object.values(patterns).reduce((sum, arr) => sum + arr.length, 0);
    if (dirTotal < 2) continue; // Skip dirs with too few multi-word files

    // Find dominant pattern
    let dominant = null;
    let maxCount = 0;
    for (const [pattern, names] of Object.entries(patterns)) {
      if (names.length > maxCount) {
        maxCount = names.length;
        dominant = pattern;
      }
    }

    byDirectory[dir] = {
      dominant_pattern: dominant,
      confidence: Math.round((maxCount / dirTotal) * 100),
      file_count: dirTotal,
      patterns: {},
    };

    for (const [pattern, names] of Object.entries(patterns)) {
      byDirectory[dir].patterns[pattern] = {
        count: names.length,
        examples: names.slice(0, 3),
      };
    }
  }

  return { overall, by_directory: byDirectory };
}


// ─── File Organization Detection ─────────────────────────────────────────────

/**
 * Detect file organization patterns from codebase intel.
 *
 * @param {object} intel - Codebase intel object
 * @returns {object} File organization patterns
 */
function detectFileOrganization(intel) {
  if (!intel || !intel.files) {
    return { structure_type: 'unknown', patterns: [] };
  }

  const filePaths = Object.keys(intel.files);
  const patterns = [];

  // ── Structure type (flat vs nested) ──
  const depths = filePaths.map(f => f.split(path.sep).length);
  const maxDepth = Math.max(...depths, 0);
  const avgDepth = depths.length > 0 ? Math.round((depths.reduce((a, b) => a + b, 0) / depths.length) * 10) / 10 : 0;
  const structureType = maxDepth <= 2 ? 'flat' : 'nested';

  patterns.push({
    pattern: `${structureType} structure`,
    detail: `max depth ${maxDepth}, avg depth ${avgDepth}`,
    confidence: 100,
  });

  // ── Source file grouping ──
  const topDirs = new Set();
  for (const fp of filePaths) {
    const parts = fp.split(path.sep);
    if (parts.length > 1) topDirs.add(parts[0]);
  }

  const knownGroupings = {
    'by-type': ['commands', 'lib', 'models', 'controllers', 'views', 'services', 'utils', 'helpers'],
    'by-feature': ['features', 'modules', 'domains', 'pages'],
  };

  let groupingType = 'unknown';
  let groupingConfidence = 0;
  const topDirList = [...topDirs];

  const byTypeMatches = topDirList.filter(d => knownGroupings['by-type'].includes(d));
  const byFeatureMatches = topDirList.filter(d => knownGroupings['by-feature'].includes(d));

  if (byTypeMatches.length > byFeatureMatches.length) {
    groupingType = 'by-type';
    groupingConfidence = Math.round((byTypeMatches.length / Math.max(topDirList.length, 1)) * 100);
  } else if (byFeatureMatches.length > 0) {
    groupingType = 'by-feature';
    groupingConfidence = Math.round((byFeatureMatches.length / Math.max(topDirList.length, 1)) * 100);
  }

  if (groupingType !== 'unknown') {
    patterns.push({
      pattern: `${groupingType} grouping`,
      detail: `detected from top-level directories: ${topDirList.join(', ')}`,
      confidence: groupingConfidence,
    });
  }

  // ── Test file placement ──
  const testFiles = filePaths.filter(f => {
    const base = path.basename(f);
    return base.includes('.test.') || base.includes('.spec.') || base.includes('_test.') || base.includes('_spec.');
  });
  const testDirFiles = filePaths.filter(f => {
    const parts = f.split(path.sep);
    return parts.some(p => p === 'test' || p === 'tests' || p === 'spec' || p === '__tests__');
  });

  let testPlacement = 'none';
  let testConfidence = 0;

  if (testFiles.length > 0 && testDirFiles.length > 0) {
    // Both patterns exist — check which dominates
    if (testFiles.length > testDirFiles.length) {
      testPlacement = 'co-located';
      testConfidence = Math.round((testFiles.length / (testFiles.length + testDirFiles.length)) * 100);
    } else {
      testPlacement = 'separate-directory';
      testConfidence = Math.round((testDirFiles.length / (testFiles.length + testDirFiles.length)) * 100);
    }
  } else if (testFiles.length > 0) {
    testPlacement = 'co-located';
    testConfidence = 100;
  } else if (testDirFiles.length > 0) {
    testPlacement = 'separate-directory';
    testConfidence = 100;
  }

  if (testPlacement !== 'none') {
    patterns.push({
      pattern: `${testPlacement} tests`,
      detail: `${testFiles.length} co-located, ${testDirFiles.length} in test dirs`,
      confidence: testConfidence,
    });
  }

  // ── Config file placement ──
  const configExtensions = new Set(['.json', '.yaml', '.yml', '.toml', '.env', '.ini', '.cfg']);
  const configNames = new Set(['config', 'settings', 'configuration', '.env', '.eslintrc', '.prettierrc', 'tsconfig', 'jest.config', 'webpack.config', 'vite.config']);
  const configFiles = filePaths.filter(f => {
    const base = path.basename(f);
    const ext = path.extname(f);
    const nameNoExt = path.basename(f, ext);
    return (configExtensions.has(ext) && f.split(path.sep).length <= 2) ||
           configNames.has(nameNoExt) || base.startsWith('.');
  });

  const rootConfigs = configFiles.filter(f => f.split(path.sep).length === 1);
  if (configFiles.length > 0) {
    const configPlacement = rootConfigs.length > configFiles.length / 2 ? 'root' : 'config-directory';
    patterns.push({
      pattern: `${configPlacement} config placement`,
      detail: `${rootConfigs.length}/${configFiles.length} config files at root`,
      confidence: Math.round((rootConfigs.length / Math.max(configFiles.length, 1)) * 100),
    });
  }

  // ── Index/barrel files ──
  const indexFiles = filePaths.filter(f => {
    const base = path.basename(f);
    return base.startsWith('index.') || base.startsWith('mod.') || base.startsWith('__init__.');
  });

  if (indexFiles.length > 0) {
    const dirsWithSource = new Set(filePaths.filter(f => {
      const info = intel.files[f];
      return isSourceFile(f, info);
    }).map(f => path.dirname(f)));

    const barrelConfidence = Math.round((indexFiles.length / Math.max(dirsWithSource.size, 1)) * 100);
    patterns.push({
      pattern: 'barrel/index exports',
      detail: `${indexFiles.length} index files across ${dirsWithSource.size} source dirs`,
      confidence: Math.min(barrelConfidence, 100),
    });
  }

  return {
    structure_type: structureType,
    max_depth: maxDepth,
    avg_depth: avgDepth,
    test_placement: testPlacement,
    patterns,
  };
}


// ─── Framework Pattern Registry ──────────────────────────────────────────────
//
// Extensible framework detection. To add a new framework:
//   1. Create a detector object with { name, detect, extractPatterns }
//   2. Push it to FRAMEWORK_DETECTORS array
//   3. detect(intel) → boolean: does this project use this framework?
//   4. extractPatterns(intel, cwd) → ConventionPattern[]: extract framework-specific patterns
//

/**
 * @typedef {Object} ConventionPattern
 * @property {string} category - Always 'framework' for framework-detected patterns
 * @property {string} framework - Framework identifier (e.g. 'elixir-phoenix')
 * @property {string} pattern - Human-readable convention description
 * @property {number} confidence - 0-100 confidence score
 * @property {string[]} evidence - File paths or examples supporting this pattern
 */

/**
 * Safely read file content, returning empty string on error.
 * @param {string} filePath - Absolute file path
 * @returns {string}
 */
function safeReadFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    return '';
  }
}

/**
 * Framework detector registry.
 * Each detector: { name: string, detect: (intel) => boolean, extractPatterns: (intel, cwd) => ConventionPattern[] }
 * @type {Array<{name: string, detect: function, extractPatterns: function}>}
 */
const FRAMEWORK_DETECTORS = [
  {
    name: 'elixir-phoenix',

    /**
     * Detect if this project uses Elixir/Phoenix.
     * Checks for Elixir language presence and Phoenix indicators (router.ex, mix.exs).
     */
    detect(intel) {
      if (!intel || !intel.languages) return false;
      if (!intel.languages.elixir) return false;

      const filePaths = Object.keys(intel.files || {});
      const hasRouter = filePaths.some(f => f.endsWith('router.ex'));
      const hasMixExs = filePaths.some(f => f === 'mix.exs' || f.endsWith('/mix.exs'));
      return hasRouter || hasMixExs;
    },

    /**
     * Extract Elixir/Phoenix-specific convention patterns.
     */
    extractPatterns(intel, cwd) {
      const patterns = [];
      const filePaths = Object.keys(intel.files || {});

      // 1. Phoenix routes — detect router.ex with pipe_through and HTTP macros
      const routerFiles = filePaths.filter(f => f.endsWith('router.ex'));
      if (routerFiles.length > 0) {
        let routeEvidence = [];
        let hasPipeThrough = false;
        for (const rf of routerFiles) {
          const content = safeReadFile(path.join(cwd, rf));
          if (/pipe_through/.test(content)) hasPipeThrough = true;
          if (/\b(get|post|put|delete|patch)\s/.test(content)) {
            routeEvidence.push(rf);
          }
        }
        if (routeEvidence.length > 0) {
          patterns.push({
            category: 'framework',
            framework: 'elixir-phoenix',
            pattern: hasPipeThrough
              ? 'Routes defined in router.ex using pipe_through pipelines'
              : 'Routes defined in router.ex',
            confidence: Math.round((routeEvidence.length / Math.max(routerFiles.length, 1)) * 100),
            evidence: routeEvidence.slice(0, 5),
          });
        }
      }

      // 2. Ecto schemas — files containing `use Ecto.Schema`
      const schemaFiles = filePaths.filter(f => f.endsWith('.ex') || f.endsWith('.exs'));
      const ectoSchemaFiles = [];
      for (const sf of schemaFiles) {
        const content = safeReadFile(path.join(cwd, sf));
        if (/use Ecto\.Schema/.test(content)) {
          ectoSchemaFiles.push(sf);
        }
      }
      if (ectoSchemaFiles.length > 0) {
        patterns.push({
          category: 'framework',
          framework: 'elixir-phoenix',
          pattern: 'Ecto schemas use `schema` macro with `field` declarations',
          confidence: Math.round((ectoSchemaFiles.length / Math.max(schemaFiles.length, 1)) * 100),
          evidence: ectoSchemaFiles.slice(0, 5),
        });
      }

      // 3. Plugs — files with `use Plug` or `import Plug.Conn`
      const plugFiles = [];
      for (const sf of schemaFiles) {
        const content = safeReadFile(path.join(cwd, sf));
        if (/use Plug\b/.test(content) || /import Plug\.Conn/.test(content)) {
          plugFiles.push(sf);
        }
      }
      if (plugFiles.length > 0) {
        patterns.push({
          category: 'framework',
          framework: 'elixir-phoenix',
          pattern: 'Plugs follow init/call pattern',
          confidence: Math.round((plugFiles.length / Math.max(schemaFiles.length, 1)) * 100),
          evidence: plugFiles.slice(0, 5),
        });
      }

      // 4. Context modules — detect lib/*/  subdirectories acting as Phoenix contexts
      const libDirs = new Set();
      for (const fp of filePaths) {
        const match = fp.match(/^lib\/([^/]+)\//);
        if (match) libDirs.add(match[1]);
      }
      if (libDirs.size > 1) {
        patterns.push({
          category: 'framework',
          framework: 'elixir-phoenix',
          pattern: 'Business logic organized into context modules',
          confidence: Math.min(Math.round((libDirs.size / 3) * 100), 100),
          evidence: [...libDirs].slice(0, 5).map(d => `lib/${d}/`),
        });
      }

      // 5. Migration naming — detect priv/repo/migrations/ timestamps
      const migrationFiles = filePaths.filter(f =>
        f.includes('priv/repo/migrations/') || f.match(/priv\/[^/]*\/migrations\//)
      );
      if (migrationFiles.length > 0) {
        const timestampMigrations = migrationFiles.filter(f =>
          /\d{14}_/.test(path.basename(f))
        );
        patterns.push({
          category: 'framework',
          framework: 'elixir-phoenix',
          pattern: 'Migrations use timestamp prefixes',
          confidence: Math.round((timestampMigrations.length / Math.max(migrationFiles.length, 1)) * 100),
          evidence: migrationFiles.slice(0, 5),
        });
      }

      return patterns;
    },
  },
];


/**
 * Detect framework-specific conventions by iterating the detector registry.
 *
 * @param {object} intel - Codebase intel object
 * @param {string} cwd - Project root directory
 * @returns {ConventionPattern[]} Detected framework patterns
 */
function detectFrameworkConventions(intel, cwd) {
  const allPatterns = [];

  for (const detector of FRAMEWORK_DETECTORS) {
    try {
      if (detector.detect(intel)) {
        const patterns = detector.extractPatterns(intel, cwd);
        allPatterns.push(...patterns);
      }
    } catch (e) {
      // Silently skip failed detectors — don't break convention extraction
    }
  }

  return allPatterns;
}


// ─── Combined Extraction ─────────────────────────────────────────────────────

/**
 * Extract all conventions from codebase intel.
 * Combines naming detection, file organization analysis, and framework detection.
 *
 * @param {object} intel - Codebase intel object
 * @param {object} [options] - Extraction options
 * @param {number} [options.threshold=60] - Minimum confidence to include (0-100)
 * @param {boolean} [options.showAll=false] - Show all patterns regardless of threshold
 * @param {string} [options.cwd] - Project root for framework file reading (defaults to process.cwd())
 * @returns {object} Complete conventions object
 */
function extractConventions(intel, options = {}) {
  const { threshold = 60, showAll = false, cwd = process.cwd() } = options;

  const naming = detectNamingConventions(intel);
  const fileOrganization = detectFileOrganization(intel);
  const frameworkPatterns = detectFrameworkConventions(intel, cwd);

  // Filter by threshold unless showAll
  const filteredNaming = { ...naming };
  if (!showAll) {
    filteredNaming.overall = {};
    for (const [key, value] of Object.entries(naming.overall)) {
      if (value.confidence >= threshold) {
        filteredNaming.overall[key] = value;
      }
    }
    filteredNaming.by_directory = {};
    for (const [dir, value] of Object.entries(naming.by_directory)) {
      if (value.confidence >= threshold) {
        filteredNaming.by_directory[dir] = value;
      }
    }
  }

  const filteredFileOrg = { ...fileOrganization };
  if (!showAll) {
    filteredFileOrg.patterns = fileOrganization.patterns.filter(p => p.confidence >= threshold);
  }

  const filteredFrameworks = showAll
    ? frameworkPatterns
    : frameworkPatterns.filter(p => p.confidence >= threshold);

  return {
    naming: filteredNaming,
    file_organization: filteredFileOrg,
    frameworks: filteredFrameworks,
    extracted_at: new Date().toISOString(),
  };
}


// ─── Rules Generation ────────────────────────────────────────────────────────

/**
 * Generate an agent-consumable rules document from extracted conventions.
 * Rules are ranked by confidence, filtered by threshold, and capped at maxRules.
 *
 * Each rule is a concise, actionable statement suitable for direct injection into agent prompts.
 *
 * @param {object} conventions - Output from extractConventions()
 * @param {object} [options] - Generation options
 * @param {number} [options.threshold=60] - Minimum confidence to include (0-100)
 * @param {number} [options.maxRules=15] - Maximum number of rules to output
 * @returns {{ rules: string[], rules_text: string, rule_count: number, total_conventions: number, filtered_count: number }}
 */
function generateRules(conventions, options = {}) {
  const { threshold = 60, maxRules = 15 } = options;

  if (!conventions) {
    return { rules: [], rules_text: '', rule_count: 0, total_conventions: 0, filtered_count: 0 };
  }

  // Collect all conventions as { text, confidence } pairs
  const allConventions = [];

  // ── Naming conventions (overall) ──
  if (conventions.naming && conventions.naming.overall) {
    for (const [, value] of Object.entries(conventions.naming.overall)) {
      if (value.confidence > 0) {
        allConventions.push({
          text: `File names use ${value.pattern} (${value.confidence}% of ${value.file_count} multi-word files)`,
          confidence: value.confidence,
        });
      }
    }
  }

  // ── Naming conventions (per-directory) ──
  if (conventions.naming && conventions.naming.by_directory) {
    for (const [dir, value] of Object.entries(conventions.naming.by_directory)) {
      if (value.confidence > 0) {
        allConventions.push({
          text: `File names in \`${dir}/\` use ${value.dominant_pattern} (${value.confidence}% of ${value.file_count} files)`,
          confidence: value.confidence,
        });
      }
    }
  }

  // ── File organization patterns ──
  if (conventions.file_organization && conventions.file_organization.patterns) {
    for (const p of conventions.file_organization.patterns) {
      if (p.confidence > 0) {
        allConventions.push({
          text: `Project uses ${p.pattern} (${p.detail})`,
          confidence: p.confidence,
        });
      }
    }
  }

  // ── Framework patterns ──
  if (conventions.frameworks) {
    for (const p of conventions.frameworks) {
      if (p.confidence > 0) {
        allConventions.push({
          text: `${p.pattern} (${p.confidence}%)`,
          confidence: p.confidence,
        });
      }
    }
  }

  const totalConventions = allConventions.length;

  // Filter by threshold
  const filtered = allConventions.filter(c => c.confidence >= threshold);
  const filteredCount = totalConventions - filtered.length;

  // Sort by confidence (highest first), then alphabetically for stability
  filtered.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.text.localeCompare(b.text);
  });

  // Cap at maxRules
  const capped = filtered.slice(0, maxRules);

  // Format rules
  const rules = capped.map(c => c.text);
  const rulesText = rules.map((r, i) => `${i + 1}. ${r}`).join('\n');

  return {
    rules,
    rules_text: rulesText,
    rule_count: rules.length,
    total_conventions: totalConventions,
    filtered_count: filteredCount,
  };
}


// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  detectNamingConventions,
  detectFileOrganization,
  detectFrameworkConventions,
  extractConventions,
  generateRules,
  FRAMEWORK_DETECTORS,
};
