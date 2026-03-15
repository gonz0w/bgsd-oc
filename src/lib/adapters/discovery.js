'use strict';

const fs = require('fs');
const path = require('path');
const fg = require('fast-glob');
const ignore = require('ignore');
const { debugLog } = require('../output');
const { execGit } = require('../git');
const { findFiles: fdFindFiles } = require('../cli-tools/fd');
const { isToolEnabled } = require('../cli-tools/fallback');

const DEFAULT_MODE = process.env.BGSD_DISCOVERY_MODE === 'legacy' ? 'legacy' : 'optimized';

const LANGUAGE_MAP = {
  '.js': 'javascript', '.cjs': 'javascript', '.mjs': 'javascript',
  '.ts': 'typescript', '.tsx': 'typescript', '.jsx': 'javascript',
  '.py': 'python', '.pyw': 'python', '.pyi': 'python',
  '.go': 'go',
  '.ex': 'elixir', '.exs': 'elixir',
  '.rs': 'rust',
  '.rb': 'ruby', '.rake': 'ruby',
  '.java': 'java', '.kt': 'kotlin', '.kts': 'kotlin',
  '.c': 'c', '.h': 'c', '.cpp': 'cpp', '.hpp': 'cpp', '.cc': 'cpp', '.hh': 'cpp',
  '.sh': 'shell', '.bash': 'shell', '.zsh': 'shell',
  '.md': 'markdown', '.mdx': 'markdown',
  '.json': 'json', '.jsonc': 'json',
  '.yaml': 'yaml', '.yml': 'yaml',
  '.toml': 'toml',
  '.xml': 'xml',
  '.html': 'html', '.htm': 'html',
  '.css': 'css', '.scss': 'css', '.less': 'css',
  '.sql': 'sql',
  '.graphql': 'graphql', '.gql': 'graphql',
  '.proto': 'protobuf',
  '.swift': 'swift',
  '.dart': 'dart',
  '.lua': 'lua',
  '.r': 'r', '.R': 'r',
  '.php': 'php',
  '.pl': 'perl', '.pm': 'perl',
  '.zig': 'zig',
  '.nim': 'nim',
  '.nix': 'nix',
  '.tf': 'terraform', '.hcl': 'terraform',
  '.vue': 'vue',
  '.svelte': 'svelte',
};

const SKIP_DIRS = new Set([
  'node_modules', 'vendor', 'deps', '_build', '.git', '.next', 'target',
  'dist', 'build', '__pycache__', '.elixir_ls', '.cache', '.planning',
]);

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', '.webp',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.exe', '.dll', '.so', '.dylib', '.a', '.o',
  '.zip', '.tar', '.gz', '.bz2', '.xz', '.7z', '.rar',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.mp3', '.mp4', '.wav', '.avi', '.mov', '.mkv', '.flac',
  '.wasm', '.pyc', '.pyo', '.class', '.beam',
  '.db', '.sqlite', '.sqlite3',
  '.lock',
]);

const KNOWN_SOURCE_DIRS = new Set(['src', 'lib', 'app', 'apps', 'pkg', 'cmd', 'internal', 'test', 'tests', 'spec']);

function normalizeMode(mode) {
  return mode === 'optimized' ? 'optimized' : 'legacy';
}

function normalizeOptions(options) {
  const opts = options || {};
  return {
    mode: normalizeMode(opts.mode || DEFAULT_MODE),
    shadowCompare: opts.shadowCompare === true,
    onShadowCompare: typeof opts.onShadowCompare === 'function' ? opts.onShadowCompare : null,
  };
}

function stableStringify(value) {
  if (!Array.isArray(value)) return JSON.stringify(value);
  return JSON.stringify([...new Set(value)].sort());
}

function toPosix(relPath) {
  if (!relPath) return '';
  return relPath.split(path.sep).join('/');
}

function fromPosix(relPath) {
  if (!relPath) return relPath;
  return relPath.split('/').join(path.sep);
}

function normalizeRelativePath(relPath) {
  const normalized = toPosix(relPath).replace(/^\.\//, '');
  if (!normalized || normalized === '.') return '';
  return normalized;
}

function escapeGlobSegment(segment) {
  return segment.replace(/[\\*?\[\]{}()!+@]/g, '\\$&');
}

function escapeGlobPath(relPath) {
  return toPosix(relPath).split('/').map(escapeGlobSegment).join('/');
}

function readGitIgnoreLines(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);
  } catch {
    return [];
  }
}

function buildIgnoreMatcher(cwd) {
  const matcher = ignore();
  const gitIgnoreFiles = ['.gitignore'];
  const skipPatterns = Array.from(SKIP_DIRS).map((dirName) => `**/${dirName}/**`);

  const nestedGitIgnores = fg.sync('**/.gitignore', {
    cwd,
    dot: true,
    onlyFiles: true,
    followSymbolicLinks: false,
    suppressErrors: true,
    ignore: skipPatterns,
  });

  for (const relPath of nestedGitIgnores) {
    if (relPath !== '.gitignore') gitIgnoreFiles.push(relPath);
  }

  for (const relPath of gitIgnoreFiles) {
    const absPath = path.join(cwd, relPath);
    const baseDir = path.dirname(relPath);
    const prefix = baseDir === '.' ? '' : toPosix(baseDir);
    const lines = readGitIgnoreLines(absPath);

    for (const rawLine of lines) {
      if (!rawLine) continue;
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const negated = line.startsWith('!');
      let rule = negated ? line.slice(1) : line;
      if (!rule) continue;

      if (rule.startsWith('/')) {
        rule = rule.slice(1);
      }
      if (prefix) {
        rule = `${prefix}/${rule}`;
      }
      if (!rule) continue;

      matcher.add(negated ? `!${rule}` : rule);
    }
  }

  return matcher;
}

function isIgnoredPath(matcher, relPath, isDir) {
  const normalized = normalizeRelativePath(relPath);
  if (!normalized) return false;
  const candidate = isDir ? `${normalized}/` : normalized;
  return matcher.ignores(candidate);
}

function runWithShadowCompare(kind, args, options, legacyFn, optimizedFn) {
  const opts = normalizeOptions(options);
  const primary = opts.mode === 'optimized' ? optimizedFn : legacyFn;
  const secondary = opts.mode === 'optimized' ? legacyFn : optimizedFn;
  const primaryResult = primary(...args);

  if (opts.shadowCompare) {
    const secondaryResult = secondary(...args);
    if (stableStringify(primaryResult) !== stableStringify(secondaryResult)) {
      const payload = {
        kind,
        mode: opts.mode,
        primary: primaryResult,
        secondary: secondaryResult,
      };
      if (opts.onShadowCompare) {
        opts.onShadowCompare(payload);
      } else {
        debugLog('discovery.shadow', JSON.stringify(payload));
      }
    }
  }

  return primaryResult;
}

/**
 * Use fd for source directory detection.
 * Gets top-level directories via fd and filters through known source dirs logic.
 * fd respects .gitignore natively — no need for ignore matcher.
 * @param {string} cwd - Project root
 * @returns {string[]} Source directory names
 */
function fdGetSourceDirs(cwd) {
  try {
    const fdResult = fdFindFiles('', { type: 'd', maxDepth: 1 });
    if (!fdResult.success || fdResult.usedFallback || !Array.isArray(fdResult.result)) {
      return null; // Signal to caller to fall through
    }
    const sourceDirs = [];
    const topLevelDirs = fdResult.result
      .map(p => normalizeRelativePath(p))
      .filter(p => p && !p.includes('/'));

    // Check for source files at root level
    const rootFdResult = fdFindFiles('', { type: 'f', maxDepth: 1 });
    if (rootFdResult.success && !rootFdResult.usedFallback && Array.isArray(rootFdResult.result)) {
      const hasRootSource = rootFdResult.result.some(f => {
        const ext = path.extname(f);
        return LANGUAGE_MAP[ext] !== undefined;
      });
      if (hasRootSource) sourceDirs.push('.');
    }

    for (const name of topLevelDirs) {
      if (SKIP_DIRS.has(name)) continue;
      if (name.startsWith('.')) continue;
      if (KNOWN_SOURCE_DIRS.has(name)) {
        sourceDirs.push(name);
        continue;
      }
      // Check for source files inside this dir via fd
      const innerResult = fdFindFiles('', { type: 'f', maxDepth: 1 });
      if (innerResult.success && !innerResult.usedFallback && Array.isArray(innerResult.result)) {
        const hasSource = innerResult.result.some(f => {
          const ext = path.extname(path.basename(f));
          return LANGUAGE_MAP[ext] !== undefined;
        });
        if (hasSource) sourceDirs.push(name);
      }
    }

    if (sourceDirs.length === 0) sourceDirs.push('.');
    return sourceDirs;
  } catch {
    return null; // Signal to caller to fall through
  }
}

/**
 * Use fd for source file discovery.
 * fd respects .gitignore natively — significantly faster than fast-glob on large codebases.
 * @param {string} cwd - Project root
 * @param {string[]} sourceDirs - Source directories to search
 * @returns {string[]|null} File list or null to signal fallback
 */
function fdWalkSourceFiles(cwd, sourceDirs) {
  try {
    const uniqueDirs = [...new Set(sourceDirs || [])];
    if (uniqueDirs.length === 0) return [];

    const files = [];
    for (const dir of uniqueDirs) {
      const searchDir = dir === '.' || dir === './' ? cwd : path.join(cwd, dir);
      // Exclude skip dirs via fd's exclude flag (call once per dir, exclude each skip dir)
      const excludes = [...SKIP_DIRS];
      const fdOptions = { type: 'f', exclude: excludes, absolutePath: true };
      const fdResult = fdFindFiles('', { ...fdOptions, hidden: false });
      if (!fdResult.success || fdResult.usedFallback) {
        return null; // Fall through to fast-glob
      }
      for (const absPath of (fdResult.result || [])) {
        const ext = path.extname(absPath);
        if (BINARY_EXTENSIONS.has(ext)) continue;
        const relPath = normalizeRelativePath(path.relative(cwd, absPath));
        if (relPath) files.push(fromPosix(relPath));
      }
    }
    return files;
  } catch {
    return null; // Signal to caller to fall through
  }
}

function getSourceDirs(cwd, options) {
  // Try fd acceleration first if enabled
  if (isToolEnabled('fd')) {
    try {
      const fdDirs = fdGetSourceDirs(cwd);
      if (fdDirs !== null) {
        debugLog('discovery.sourceDirs', `fd mode: ${fdDirs.length} dirs`);
        return fdDirs;
      }
    } catch {
      // Fall through to existing modes
    }
  }
  return runWithShadowCompare('source_dirs', [cwd], options, legacyGetSourceDirs, optimizedGetSourceDirs);
}

function legacyGetSourceDirs(cwd) {
  const sourceDirs = [];

  let entries;
  try {
    entries = fs.readdirSync(cwd, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      const ext = path.extname(entry.name);
      if (LANGUAGE_MAP[ext] && !sourceDirs.includes('.')) {
        sourceDirs.push('.');
      }
      continue;
    }

    const name = entry.name;
    if (SKIP_DIRS.has(name)) continue;
    if (name.startsWith('.') && name !== '.') continue;

    const ignoreResult = execGit(cwd, ['check-ignore', '-q', name]);
    if (ignoreResult.exitCode === 0) {
      debugLog('discovery.sourceDirs', `skipping git-ignored: ${name}`);
      continue;
    }

    if (KNOWN_SOURCE_DIRS.has(name)) {
      sourceDirs.push(name);
      continue;
    }

    try {
      const subEntries = fs.readdirSync(path.join(cwd, name), { withFileTypes: true });
      const hasSource = subEntries.some((subEntry) => {
        if (!subEntry.isFile()) return false;
        const ext = path.extname(subEntry.name);
        return LANGUAGE_MAP[ext] !== undefined;
      });
      if (hasSource) {
        sourceDirs.push(name);
      }
    } catch {
    }
  }

  if (sourceDirs.length === 0) {
    sourceDirs.push('.');
  }

  return sourceDirs;
}

function optimizedGetSourceDirs(cwd) {
  const sourceDirs = [];
  const matcher = buildIgnoreMatcher(cwd);

  let entries;
  try {
    entries = fs.readdirSync(cwd, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      const ext = path.extname(entry.name);
      if (LANGUAGE_MAP[ext] && !sourceDirs.includes('.')) {
        sourceDirs.push('.');
      }
      continue;
    }

    const name = entry.name;
    if (SKIP_DIRS.has(name)) continue;
    if (name.startsWith('.')) continue;
    if (isIgnoredPath(matcher, name, true)) continue;

    if (KNOWN_SOURCE_DIRS.has(name)) {
      sourceDirs.push(name);
      continue;
    }

    const pattern = `${escapeGlobPath(name)}/*`;
    const candidateFiles = fg.sync(pattern, {
      cwd,
      dot: true,
      onlyFiles: true,
      followSymbolicLinks: false,
      suppressErrors: true,
    });

    const hasSource = candidateFiles.some((relPath) => {
      if (isIgnoredPath(matcher, relPath, false)) return false;
      const ext = path.extname(relPath);
      return LANGUAGE_MAP[ext] !== undefined;
    });

    if (hasSource) {
      sourceDirs.push(name);
    }
  }

  if (sourceDirs.length === 0) {
    sourceDirs.push('.');
  }

  return sourceDirs;
}

function walkSourceFiles(cwd, sourceDirs, skipDirs, options) {
  // Try fd acceleration first if enabled
  if (isToolEnabled('fd')) {
    try {
      const fdFiles = fdWalkSourceFiles(cwd, sourceDirs);
      if (fdFiles !== null) {
        debugLog('discovery.walkFiles', `fd mode: ${fdFiles.length} files`);
        return fdFiles;
      }
    } catch {
      // Fall through to existing modes
    }
  }
  return runWithShadowCompare('source_files', [cwd, sourceDirs, skipDirs], options, legacyWalkSourceFiles, optimizedWalkSourceFiles);
}

function legacyWalkSourceFiles(cwd, sourceDirs, skipDirs) {
  const files = [];
  const visited = new Set();

  function walk(dir) {
    const absDir = path.join(cwd, dir);
    if (visited.has(absDir)) return;
    visited.add(absDir);

    let entries;
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const relPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name) && !entry.name.startsWith('.')) {
          walk(relPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (!BINARY_EXTENSIONS.has(ext)) {
          files.push(relPath);
        }
      }
    }
  }

  for (const dir of sourceDirs) {
    walk(dir);
  }

  return files;
}

function optimizedWalkSourceFiles(cwd, sourceDirs, skipDirs) {
  const matcher = buildIgnoreMatcher(cwd);
  const uniqueDirs = [...new Set(sourceDirs || [])];
  if (uniqueDirs.length === 0) return [];

  const patterns = uniqueDirs.map((dir) => {
    if (dir === '.' || dir === './') return '**/*';
    return `${escapeGlobPath(dir)}/**/*`;
  });

  const skipSet = skipDirs || SKIP_DIRS;
  const ignorePatterns = ['**/.*/**'];
  for (const dirName of skipSet) {
    ignorePatterns.push(`${escapeGlobPath(dirName)}/**`);
    ignorePatterns.push(`**/${escapeGlobPath(dirName)}/**`);
  }

  const walked = fg.sync(patterns, {
    cwd,
    dot: true,
    onlyFiles: true,
    followSymbolicLinks: false,
    unique: true,
    suppressErrors: true,
    ignore: ignorePatterns,
  });

  const files = [];
  for (const relPath of walked) {
    const normalized = normalizeRelativePath(relPath);
    if (!normalized) continue;
    if (isIgnoredPath(matcher, normalized, false)) continue;

    const ext = path.extname(normalized);
    if (BINARY_EXTENSIONS.has(ext)) continue;
    files.push(fromPosix(normalized));
  }

  return files;
}

/**
 * Return the runtime-active discovery mode string.
 * Useful for diagnostics and tests that need to verify optimized-by-default behavior.
 *
 * @returns {'optimized'|'legacy'}
 */
function getActiveMode() {
  return DEFAULT_MODE;
}

/**
 * Parity diagnostic: run both discovery paths and return a structured comparison.
 * Designed for mismatch triage — maintainers can call this to identify exactly
 * which files or directories differ between legacy and optimized behavior.
 *
 * Usage:
 *   BGSD_DISCOVERY_SHADOW=1 — enables shadow compare on every call (via env)
 *   discovery.diagnoseParity(cwd) — explicit one-shot comparison for triage
 *
 * Fallback controls:
 *   BGSD_DISCOVERY_MODE=legacy — forces legacy subprocess path globally
 *   options.mode = 'legacy' — forces legacy per-call in adapter API
 *   options.shadowCompare = true — runs both paths and logs mismatches
 *
 * @param {string} cwd - Project root to diagnose
 * @returns {{ sourceDirs: { match: boolean, legacy: string[], optimized: string[] }, walkFiles: { match: boolean, legacy: string[], optimized: string[], onlyLegacy: string[], onlyOptimized: string[] }}}
 */
function diagnoseParity(cwd) {
  const legacyDirs = legacyGetSourceDirs(cwd).sort();
  const optimizedDirs = optimizedGetSourceDirs(cwd).sort();
  const dirsMatch = stableStringify(legacyDirs) === stableStringify(optimizedDirs);

  const dirs = dirsMatch ? legacyDirs : [...new Set([...legacyDirs, ...optimizedDirs])].sort();
  const skipDirs = SKIP_DIRS;

  const legacyFiles = legacyWalkSourceFiles(cwd, dirs, skipDirs).sort();
  const optimizedFiles = optimizedWalkSourceFiles(cwd, dirs, skipDirs).sort();
  const filesMatch = stableStringify(legacyFiles) === stableStringify(optimizedFiles);

  const legacySet = new Set(legacyFiles);
  const optimizedSet = new Set(optimizedFiles);
  const onlyLegacy = legacyFiles.filter(f => !optimizedSet.has(f));
  const onlyOptimized = optimizedFiles.filter(f => !legacySet.has(f));

  return {
    sourceDirs: { match: dirsMatch, legacy: legacyDirs, optimized: optimizedDirs },
    walkFiles: { match: filesMatch, legacy: legacyFiles, optimized: optimizedFiles, onlyLegacy, onlyOptimized },
  };
}

module.exports = {
  LANGUAGE_MAP,
  SKIP_DIRS,
  BINARY_EXTENSIONS,
  getSourceDirs,
  walkSourceFiles,
  legacyGetSourceDirs,
  legacyWalkSourceFiles,
  optimizedGetSourceDirs,
  optimizedWalkSourceFiles,
  getActiveMode,
  diagnoseParity,
};
