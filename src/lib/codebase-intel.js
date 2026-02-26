'use strict';

const fs = require('fs');
const path = require('path');
const { debugLog } = require('./output');
const { execGit } = require('./git');
const { cachedReadFile } = require('./helpers');

// ─── Constants ───────────────────────────────────────────────────────────────

/** Return the path to codebase-intel.json for a given project root */
function INTEL_PATH(cwd) {
  return path.join(cwd, '.planning', 'codebase', 'codebase-intel.json');
}

/** Map file extensions to language names */
const LANGUAGE_MAP = {
  // JavaScript / TypeScript
  '.js': 'javascript', '.cjs': 'javascript', '.mjs': 'javascript',
  '.ts': 'typescript', '.tsx': 'typescript', '.jsx': 'javascript',
  // Python
  '.py': 'python', '.pyw': 'python', '.pyi': 'python',
  // Go
  '.go': 'go',
  // Elixir
  '.ex': 'elixir', '.exs': 'elixir',
  // Rust
  '.rs': 'rust',
  // Ruby
  '.rb': 'ruby', '.rake': 'ruby',
  // Java / Kotlin
  '.java': 'java', '.kt': 'kotlin', '.kts': 'kotlin',
  // C / C++
  '.c': 'c', '.h': 'c', '.cpp': 'cpp', '.hpp': 'cpp', '.cc': 'cpp', '.hh': 'cpp',
  // Shell
  '.sh': 'shell', '.bash': 'shell', '.zsh': 'shell',
  // Markup / Config
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

/** Directories to always skip during traversal (matches env.js SKIP_DIRS) */
const SKIP_DIRS = new Set([
  'node_modules', 'vendor', 'deps', '_build', '.git', '.next', 'target',
  'dist', 'build', '__pycache__', '.elixir_ls', '.cache', '.planning',
]);

/** Binary file extensions to skip */
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


// ─── Source Directory Detection ──────────────────────────────────────────────

/**
 * Auto-detect source directories by walking top-level entries.
 * Returns directories that contain source files (or are known source dirs).
 * Respects .gitignore via `git check-ignore`.
 *
 * @param {string} cwd - Project root
 * @returns {string[]} Array of relative directory paths (e.g., ['src/', 'lib/'])
 */
function getSourceDirs(cwd) {
  const sourceDirs = [];
  const knownSourceDirs = new Set(['src', 'lib', 'app', 'apps', 'pkg', 'cmd', 'internal', 'test', 'tests', 'spec']);

  let entries;
  try {
    entries = fs.readdirSync(cwd, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      // Include root-level source files
      const ext = path.extname(entry.name);
      if (LANGUAGE_MAP[ext]) {
        // Root has source files — we'll include root scanning implicitly
        if (!sourceDirs.includes('.')) sourceDirs.push('.');
      }
      continue;
    }

    const name = entry.name;
    if (SKIP_DIRS.has(name)) continue;
    if (name.startsWith('.') && name !== '.') continue;

    // Check if git would ignore this directory
    const ignoreResult = execGit(cwd, ['check-ignore', '-q', name]);
    if (ignoreResult.exitCode === 0) {
      debugLog('codebase.sourceDirs', `skipping git-ignored: ${name}`);
      continue;
    }

    // Include known source dirs or dirs that contain source files
    if (knownSourceDirs.has(name)) {
      sourceDirs.push(name);
    } else {
      // Quick check: does this dir have any source files?
      try {
        const subEntries = fs.readdirSync(path.join(cwd, name), { withFileTypes: true });
        const hasSource = subEntries.some(e => {
          if (e.isFile()) {
            const ext = path.extname(e.name);
            return LANGUAGE_MAP[ext] !== undefined;
          }
          return false;
        });
        if (hasSource) {
          sourceDirs.push(name);
        }
      } catch {
        // Skip directories we can't read
      }
    }
  }

  // If no source dirs found, fall back to scanning everything (minus SKIP_DIRS)
  if (sourceDirs.length === 0) {
    sourceDirs.push('.');
  }

  return sourceDirs;
}


// ─── File Walking ────────────────────────────────────────────────────────────

/**
 * Recursively walk source directories, collecting file paths.
 * Skips SKIP_DIRS and binary files.
 *
 * @param {string} cwd - Project root
 * @param {string[]} sourceDirs - Directories to walk (relative to cwd)
 * @param {Set<string>} skipDirs - Directory names to skip
 * @returns {string[]} Array of file paths relative to cwd
 */
function walkSourceFiles(cwd, sourceDirs, skipDirs) {
  const files = [];
  const visited = new Set(); // Prevent walking same dir twice

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


// ─── File Analysis ───────────────────────────────────────────────────────────

/**
 * Analyze a single file: detect language, count lines, get size and mtime.
 *
 * @param {string} filePath - Absolute path to the file
 * @returns {{ language: string|null, size_bytes: number, lines: number, last_modified: string }}
 */
function analyzeFile(filePath) {
  const ext = path.extname(filePath);
  const language = LANGUAGE_MAP[ext] || null;

  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return { language, size_bytes: 0, lines: 0, last_modified: null };
  }

  let lines = 0;
  try {
    const content = fs.readFileSync(filePath);
    // Count newlines in buffer for performance
    for (let i = 0; i < content.length; i++) {
      if (content[i] === 0x0a) lines++;
    }
    // If file doesn't end with newline but has content, count final line
    if (content.length > 0 && content[content.length - 1] !== 0x0a) {
      lines++;
    }
  } catch {
    // Can't read file — just use 0 lines
  }

  return {
    language,
    size_bytes: stat.size,
    lines,
    last_modified: stat.mtime.toISOString(),
  };
}


// ─── Git Info ────────────────────────────────────────────────────────────────

/**
 * Get current HEAD commit hash and branch name.
 *
 * @param {string} cwd - Project root
 * @returns {{ commit_hash: string|null, branch: string|null }}
 */
function getGitInfo(cwd) {
  const hashResult = execGit(cwd, ['rev-parse', 'HEAD']);
  const branchResult = execGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);

  return {
    commit_hash: hashResult.exitCode === 0 ? hashResult.stdout : null,
    branch: branchResult.exitCode === 0 ? branchResult.stdout : null,
  };
}

/**
 * Get files changed since a given commit hash.
 *
 * @param {string} cwd - Project root
 * @param {string} commitHash - Commit hash to diff from
 * @returns {string[]|null} Array of changed file paths, or null if error (signals full rescan)
 */
function getChangedFilesSinceCommit(cwd, commitHash) {
  if (!commitHash) return null;

  const result = execGit(cwd, ['diff', '--name-only', commitHash, 'HEAD']);
  if (result.exitCode !== 0) {
    debugLog('codebase.changedFiles', `git diff failed for ${commitHash}`);
    return null; // Commit no longer exists or other error — full rescan needed
  }

  const files = result.stdout.split('\n').filter(f => f.trim().length > 0);
  return files;
}


// ─── Staleness Detection ─────────────────────────────────────────────────────

/**
 * Check if existing codebase intel is stale.
 *
 * @param {string} cwd - Project root
 * @returns {{ stale: boolean, reason?: string, changed_files?: string[] }}
 */
function checkStaleness(cwd) {
  const intel = readIntel(cwd);

  if (!intel) {
    return { stale: true, reason: 'no_intel' };
  }

  // Strategy 1: Git-based staleness (preferred)
  if (intel.git_commit_hash) {
    // Check if HEAD matches stored hash
    const gitInfo = getGitInfo(cwd);
    if (gitInfo.commit_hash && gitInfo.commit_hash === intel.git_commit_hash) {
      return { stale: false };
    }

    // HEAD differs — get changed files
    const changedFiles = getChangedFilesSinceCommit(cwd, intel.git_commit_hash);
    if (changedFiles === null) {
      // Commit no longer exists (rebase, etc.) — full rescan needed
      return { stale: true, reason: 'commit_missing', changed_files: [] };
    }

    if (changedFiles.length > 0) {
      return { stale: true, reason: 'files_changed', changed_files: changedFiles };
    }

    // No files changed but HEAD differs (e.g., empty commits)
    return { stale: false };
  }

  // Strategy 2: Mtime-based fallback (non-git or missing hash)
  if (intel.generated_at) {
    const generatedTime = new Date(intel.generated_at).getTime();
    const sourceDirs = intel.source_dirs || getSourceDirs(cwd);
    const allFiles = walkSourceFiles(cwd, sourceDirs, SKIP_DIRS);
    const changedFiles = [];

    for (const file of allFiles) {
      try {
        const stat = fs.statSync(path.join(cwd, file));
        if (stat.mtimeMs > generatedTime) {
          changedFiles.push(file);
        }
      } catch {
        // File may have been deleted — count as changed
        changedFiles.push(file);
      }
    }

    if (changedFiles.length > 0) {
      return { stale: true, reason: 'mtime_newer', changed_files: changedFiles };
    }

    return { stale: false };
  }

  // No basis for staleness check — assume stale
  return { stale: true, reason: 'no_watermark' };
}


// ─── Analysis Engine ─────────────────────────────────────────────────────────

/**
 * Perform full or incremental codebase analysis.
 *
 * @param {string} cwd - Project root
 * @param {object} options
 * @param {boolean} [options.incremental=false] - Use incremental mode
 * @param {object} [options.previousIntel=null] - Previous intel for incremental mode
 * @param {string[]} [options.changedFiles=null] - Files to re-analyze in incremental mode
 * @returns {object} Complete intel JSON object
 */
function performAnalysis(cwd, options = {}) {
  const { incremental = false, previousIntel = null, changedFiles = null } = options;
  const startMs = Date.now();

  const gitInfo = getGitInfo(cwd);
  const sourceDirs = getSourceDirs(cwd);

  let fileEntries;

  if (incremental && previousIntel && changedFiles) {
    debugLog('codebase.analyze', `incremental: re-analyzing ${changedFiles.length} files`);

    // Start from previous file entries
    fileEntries = { ...previousIntel.files };

    // Remove deleted files (files in previous intel but not on disk)
    for (const filePath of Object.keys(fileEntries)) {
      try {
        fs.statSync(path.join(cwd, filePath));
      } catch {
        // File no longer exists
        delete fileEntries[filePath];
      }
    }

    // Re-analyze changed files
    for (const filePath of changedFiles) {
      const absPath = path.join(cwd, filePath);
      try {
        fs.statSync(absPath);
        const ext = path.extname(filePath);
        if (!BINARY_EXTENSIONS.has(ext)) {
          const result = analyzeFile(absPath);
          fileEntries[filePath] = result;
        }
      } catch {
        // Changed file no longer exists — already removed above
        delete fileEntries[filePath];
      }
    }
  } else {
    debugLog('codebase.analyze', 'full analysis');

    // Full analysis: walk all files
    const allFiles = walkSourceFiles(cwd, sourceDirs, SKIP_DIRS);
    fileEntries = {};

    for (const filePath of allFiles) {
      const absPath = path.join(cwd, filePath);
      const result = analyzeFile(absPath);
      fileEntries[filePath] = result;
    }
  }

  // Build language aggregates
  const languages = {};
  let totalLines = 0;
  let totalFiles = 0;

  for (const [filePath, info] of Object.entries(fileEntries)) {
    totalFiles++;
    totalLines += info.lines || 0;

    const lang = info.language;
    if (!lang) continue;

    if (!languages[lang]) {
      languages[lang] = { count: 0, extensions: new Set(), lines: 0 };
    }
    languages[lang].count++;
    languages[lang].lines += info.lines || 0;
    const ext = path.extname(filePath);
    if (ext) languages[lang].extensions.add(ext);
  }

  // Convert Sets to sorted arrays for JSON serialization
  for (const lang of Object.values(languages)) {
    lang.extensions = [...lang.extensions].sort();
  }

  const durationMs = Date.now() - startMs;

  return {
    version: 1,
    generated_at: new Date().toISOString(),
    git_commit_hash: gitInfo.commit_hash,
    git_branch: gitInfo.branch,
    analysis_duration_ms: durationMs,
    source_dirs: sourceDirs,
    languages,
    files: fileEntries,
    stats: {
      total_files: totalFiles,
      total_lines: totalLines,
      languages_detected: Object.keys(languages).length,
    },
  };
}


// ─── Read / Write Intel ──────────────────────────────────────────────────────

/**
 * Read and parse codebase-intel.json.
 * Uses cachedReadFile for <10ms repeated reads.
 *
 * @param {string} cwd - Project root
 * @returns {object|null} Parsed intel or null if missing/invalid
 */
function readIntel(cwd) {
  const intelPath = INTEL_PATH(cwd);
  const content = cachedReadFile(intelPath);
  if (!content) return null;

  try {
    return JSON.parse(content);
  } catch (e) {
    debugLog('codebase.readIntel', 'JSON parse failed', e);
    return null;
  }
}

/**
 * Write intel JSON to .planning/codebase/codebase-intel.json.
 * Ensures directory exists.
 *
 * @param {string} cwd - Project root
 * @param {object} intel - Intel data to write
 */
function writeIntel(cwd, intel) {
  const intelPath = INTEL_PATH(cwd);
  const dir = path.dirname(intelPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(intelPath, JSON.stringify(intel, null, 2) + '\n');
  debugLog('codebase.writeIntel', `wrote ${intelPath}`);
}


// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  INTEL_PATH,
  LANGUAGE_MAP,
  SKIP_DIRS,
  BINARY_EXTENSIONS,
  getSourceDirs,
  walkSourceFiles,
  analyzeFile,
  getGitInfo,
  getChangedFilesSinceCommit,
  checkStaleness,
  performAnalysis,
  readIntel,
  writeIntel,
};
