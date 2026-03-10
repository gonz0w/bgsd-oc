'use strict';

const fs = require('fs');
const path = require('path');
const { debugLog } = require('../output');
const { execGit } = require('../git');

const DEFAULT_MODE = process.env.BGSD_DISCOVERY_MODE === 'optimized' ? 'optimized' : 'legacy';

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

function getSourceDirs(cwd, options) {
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
  return legacyGetSourceDirs(cwd);
}

function walkSourceFiles(cwd, sourceDirs, skipDirs, options) {
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
  return legacyWalkSourceFiles(cwd, sourceDirs, skipDirs);
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
};
