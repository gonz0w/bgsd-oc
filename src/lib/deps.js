'use strict';

const fs = require('fs');
const path = require('path');
const { debugLog } = require('./output');
const { readIntel } = require('./codebase-intel');

// ─── Import Parsers ──────────────────────────────────────────────────────────
// Each parser takes file content (string) and returns an array of raw import
// specifiers (module paths or names extracted from import statements).

/**
 * Parse JavaScript/TypeScript imports.
 * Handles: require('...'), import ... from '...', import('...'), export ... from '...'
 * Strips comments before parsing.
 *
 * @param {string} content - File content
 * @returns {string[]} Array of import specifiers
 */
function parseJavaScript(content) {
  const imports = [];

  // Strip block comments (non-greedy)
  let stripped = content.replace(/\/\*[\s\S]*?\*\//g, '');
  // Strip line comments
  stripped = stripped.replace(/\/\/[^\n]*/g, '');

  // require('...')  or  require("...")
  const requireRe = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = requireRe.exec(stripped)) !== null) {
    imports.push(m[1]);
  }

  // import ... from '...'  or  import ... from "..."
  // Also: export ... from '...'
  const importFromRe = /\b(?:import|export)\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g;
  while ((m = importFromRe.exec(stripped)) !== null) {
    imports.push(m[1]);
  }

  // import '...'  (side-effect imports)
  const sideEffectRe = /\bimport\s+['"]([^'"]+)['"]/g;
  while ((m = sideEffectRe.exec(stripped)) !== null) {
    imports.push(m[1]);
  }

  // Dynamic import('...')
  const dynamicRe = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = dynamicRe.exec(stripped)) !== null) {
    imports.push(m[1]);
  }

  // Deduplicate
  return [...new Set(imports)];
}

/**
 * Parse Python imports.
 * Handles: import X, from X import Y, from . import Y (relative)
 *
 * @param {string} content - File content
 * @returns {string[]} Array of module paths
 */
function parsePython(content) {
  const imports = [];

  // Strip comments
  const stripped = content.replace(/#[^\n]*/g, '');

  // from X import Y  or  from . import Y  or  from ..X import Y
  const fromImportRe = /^\s*from\s+(\.{0,3}[\w.]*)\s+import\b/gm;
  let m;
  while ((m = fromImportRe.exec(stripped)) !== null) {
    imports.push(m[1]);
  }

  // import X  or  import X, Y, Z  or  import X as alias
  const importRe = /^\s*import\s+([\w.]+(?:\s*,\s*[\w.]+)*)/gm;
  while ((m = importRe.exec(stripped)) !== null) {
    const modules = m[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim());
    for (const mod of modules) {
      if (mod) imports.push(mod);
    }
  }

  return [...new Set(imports)];
}

/**
 * Parse Go imports.
 * Handles: import "path" and import ( "path1" \n "path2" ) blocks
 *
 * @param {string} content - File content
 * @returns {string[]} Array of import paths
 */
function parseGo(content) {
  const imports = [];

  // Strip comments
  let stripped = content.replace(/\/\*[\s\S]*?\*\//g, '');
  stripped = stripped.replace(/\/\/[^\n]*/g, '');

  // Single import: import "path"
  const singleRe = /\bimport\s+"([^"]+)"/g;
  let m;
  while ((m = singleRe.exec(stripped)) !== null) {
    imports.push(m[1]);
  }

  // Grouped imports: import ( ... )
  const groupRe = /\bimport\s*\(([\s\S]*?)\)/g;
  while ((m = groupRe.exec(stripped)) !== null) {
    const block = m[1];
    const pathRe = /"([^"]+)"/g;
    let pm;
    while ((pm = pathRe.exec(block)) !== null) {
      imports.push(pm[1]);
    }
  }

  return [...new Set(imports)];
}

/**
 * Parse Elixir imports.
 * Handles: alias Module, import Module, use Module, require Module
 * Also: alias Module.{A, B} (multi-alias)
 *
 * @param {string} content - File content
 * @returns {string[]} Array of module names
 */
function parseElixir(content) {
  const imports = [];

  // Strip comments
  const stripped = content.replace(/#[^\n]*/g, '');

  // alias/import/use/require Module
  const simpleRe = /^\s*(?:alias|import|use|require)\s+([A-Z][\w.]*)/gm;
  let m;
  while ((m = simpleRe.exec(stripped)) !== null) {
    imports.push(m[1]);
  }

  // Multi-alias: alias Module.{A, B, C}
  const multiRe = /^\s*alias\s+([A-Z][\w.]*)\.\{([^}]+)\}/gm;
  while ((m = multiRe.exec(stripped)) !== null) {
    const base = m[1];
    const parts = m[2].split(',').map(s => s.trim());
    for (const part of parts) {
      if (part) imports.push(`${base}.${part}`);
    }
  }

  return [...new Set(imports)];
}

/**
 * Parse Rust imports.
 * Handles: use crate::path, use super::path, mod name, extern crate name
 *
 * @param {string} content - File content
 * @returns {string[]} Array of crate/module paths
 */
function parseRust(content) {
  const imports = [];

  // Strip comments
  let stripped = content.replace(/\/\*[\s\S]*?\*\//g, '');
  stripped = stripped.replace(/\/\/[^\n]*/g, '');

  // use crate::... or use super::... or use std::... etc.
  const useRe = /\buse\s+([\w:]+(?:::[\w:{}*,\s]+)?)/g;
  let m;
  while ((m = useRe.exec(stripped)) !== null) {
    // Extract the root path (before any { or ::*)
    const fullPath = m[1].split('{')[0].replace(/::$/, '');
    imports.push(fullPath);
  }

  // mod name;
  const modRe = /\bmod\s+(\w+)\s*;/g;
  while ((m = modRe.exec(stripped)) !== null) {
    imports.push(m[1]);
  }

  // extern crate name;
  const externRe = /\bextern\s+crate\s+(\w+)/g;
  while ((m = externRe.exec(stripped)) !== null) {
    imports.push(m[1]);
  }

  return [...new Set(imports)];
}


// ─── Parser Registry ─────────────────────────────────────────────────────────

/**
 * Maps language names (matching LANGUAGE_MAP values from codebase-intel.js)
 * to parser functions. Languages without a parser silently return empty arrays.
 */
const IMPORT_PARSERS = {
  javascript: parseJavaScript,
  typescript: parseJavaScript, // Same syntax
  python: parsePython,
  go: parseGo,
  elixir: parseElixir,
  rust: parseRust,
};


// ─── Import Resolution ──────────────────────────────────────────────────────

/**
 * Build a set of all file paths in intel for fast lookup.
 *
 * @param {object} intel - Codebase intel object
 * @returns {Set<string>} Set of all file paths
 */
function buildFileSet(intel) {
  return new Set(Object.keys(intel.files || {}));
}

/**
 * Resolve a JS/TS import specifier to an actual project file path.
 *
 * @param {string} specifier - Raw import specifier (e.g., './utils')
 * @param {string} fromFile - File path of the importing file
 * @param {Set<string>} fileSet - Set of all project file paths
 * @returns {string|null} Resolved file path or null
 */
function resolveJsImport(specifier, fromFile, fileSet) {
  // Only resolve relative imports
  if (!specifier.startsWith('.')) return null;

  const dir = path.dirname(fromFile);
  const base = path.join(dir, specifier);
  // Normalize separators
  const normalized = base.split(path.sep).join('/');

  // Try direct match, then with extensions, then as index
  const candidates = [
    normalized,
    normalized + '.js',
    normalized + '.ts',
    normalized + '.tsx',
    normalized + '.jsx',
    normalized + '.cjs',
    normalized + '.mjs',
    normalized + '/index.js',
    normalized + '/index.ts',
    normalized + '/index.tsx',
  ];

  for (const candidate of candidates) {
    if (fileSet.has(candidate)) return candidate;
  }

  return null;
}

/**
 * Resolve a Python import to an actual project file path.
 *
 * @param {string} specifier - Module path (e.g., 'foo.bar')
 * @param {string} fromFile - File path of the importing file
 * @param {Set<string>} fileSet - Set of all project file paths
 * @returns {string|null} Resolved file path or null
 */
function resolvePythonImport(specifier, fromFile, fileSet) {
  // Handle relative imports (starting with .)
  let modulePath;
  if (specifier.startsWith('.')) {
    const dir = path.dirname(fromFile);
    const dots = specifier.match(/^(\.+)/)[1];
    const levels = dots.length - 1;
    let baseDir = dir;
    for (let i = 0; i < levels; i++) {
      baseDir = path.dirname(baseDir);
    }
    const rest = specifier.slice(dots.length).replace(/\./g, '/');
    modulePath = rest ? path.join(baseDir, rest) : baseDir;
  } else {
    modulePath = specifier.replace(/\./g, '/');
  }

  const normalized = modulePath.split(path.sep).join('/');

  const candidates = [
    normalized + '.py',
    normalized + '/__init__.py',
    normalized + '.pyi',
  ];

  for (const candidate of candidates) {
    if (fileSet.has(candidate)) return candidate;
  }

  return null;
}

/**
 * Resolve an Elixir module name to an actual project file path.
 * Elixir convention: MyApp.Accounts.User -> search for files containing
 * `defmodule MyApp.Accounts.User`. Also try lib/ path convention.
 *
 * @param {string} specifier - Module name (e.g., 'MyApp.Accounts.User')
 * @param {string} fromFile - File path of the importing file
 * @param {Set<string>} fileSet - Set of all project file paths
 * @param {object} intel - Full intel for content searching
 * @returns {string|null} Resolved file path or null
 */
function resolveElixirImport(specifier, fromFile, fileSet, intel) {
  // Convert module name to possible file path: MyApp.Accounts.User -> accounts/user.ex
  // Strip common app prefix and convert to snake_case path
  const parts = specifier.split('.');
  // Skip the first part if it's the app module name (common pattern)
  const pathParts = parts.map(p =>
    p.replace(/([A-Z])/g, (match, letter, offset) =>
      (offset > 0 ? '_' : '') + letter.toLowerCase()
    )
  );

  // Try with and without first segment (app name)
  const fullPath = pathParts.join('/');
  const withoutApp = pathParts.slice(1).join('/');

  const candidates = [];
  // Common Elixir paths
  for (const base of [fullPath, withoutApp]) {
    if (!base) continue;
    candidates.push(`lib/${base}.ex`);
    candidates.push(`${base}.ex`);
    candidates.push(`lib/${base}/index.ex`);
  }

  for (const candidate of candidates) {
    if (fileSet.has(candidate)) return candidate;
  }

  return null;
}

/**
 * Resolve a Go import path to a project file.
 * Match by package directory name.
 *
 * @param {string} specifier - Import path
 * @param {string} fromFile - File path of the importing file
 * @param {Set<string>} fileSet - Set of all project file paths
 * @returns {string|null} Resolved file path or null
 */
function resolveGoImport(specifier, fromFile, fileSet) {
  // Go imports are package paths; try to match by last segment (package name)
  const pkgName = specifier.split('/').pop();
  if (!pkgName) return null;

  // Find any .go file in a directory matching the package name
  for (const file of fileSet) {
    if (file.endsWith('.go')) {
      const dir = path.dirname(file);
      const dirName = path.basename(dir);
      if (dirName === pkgName) return file;
    }
  }

  return null;
}

/**
 * Resolve a Rust import path to a project file.
 * Convert crate:: paths relative to src/.
 *
 * @param {string} specifier - Use path (e.g., 'crate::utils')
 * @param {string} fromFile - File path of the importing file
 * @param {Set<string>} fileSet - Set of all project file paths
 * @returns {string|null} Resolved file path or null
 */
function resolveRustImport(specifier, fromFile, fileSet) {
  let modulePath;

  if (specifier.startsWith('crate')) {
    // crate::foo::bar -> src/foo/bar.rs or src/foo/bar/mod.rs
    const rest = specifier.replace(/^crate::?/, '').replace(/::/g, '/');
    modulePath = 'src/' + rest;
  } else if (specifier.startsWith('super')) {
    const dir = path.dirname(fromFile);
    const supers = specifier.match(/^(super::)*/)[0];
    const levels = (supers.match(/super/g) || []).length;
    let baseDir = dir;
    for (let i = 0; i < levels; i++) {
      baseDir = path.dirname(baseDir);
    }
    const rest = specifier.replace(/^(super::)+/, '').replace(/::/g, '/');
    modulePath = rest ? path.join(baseDir, rest) : baseDir;
  } else {
    return null; // External crate
  }

  const normalized = modulePath.split(path.sep).join('/');
  const candidates = [
    normalized + '.rs',
    normalized + '/mod.rs',
  ];

  for (const candidate of candidates) {
    if (fileSet.has(candidate)) return candidate;
  }

  return null;
}


// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Parse imports from a file and return structured results.
 *
 * @param {string} filePath - Relative file path
 * @param {string} content - File content
 * @param {string} language - Language name (from LANGUAGE_MAP)
 * @param {Set<string>} fileSet - Set of all project file paths
 * @param {object} [intel] - Full intel object (for Elixir content searching)
 * @returns {{ raw: string, resolved: string|null }[]} Array of import entries
 */
function parseImports(filePath, content, language, fileSet, intel) {
  const parser = IMPORT_PARSERS[language];
  if (!parser) return [];

  const rawImports = parser(content);

  return rawImports.map(raw => {
    let resolved = null;

    switch (language) {
      case 'javascript':
      case 'typescript':
        resolved = resolveJsImport(raw, filePath, fileSet);
        break;
      case 'python':
        resolved = resolvePythonImport(raw, filePath, fileSet);
        break;
      case 'go':
        resolved = resolveGoImport(raw, filePath, fileSet);
        break;
      case 'elixir':
        resolved = resolveElixirImport(raw, filePath, fileSet, intel);
        break;
      case 'rust':
        resolved = resolveRustImport(raw, filePath, fileSet);
        break;
    }

    return { raw, resolved };
  });
}

/**
 * Build a dependency graph from codebase intel.
 *
 * Iterates all source files, parses imports, and builds:
 * - forward: { [filePath]: [importedFilePaths] } — what each file imports
 * - reverse: { [filePath]: [importerFilePaths] } — what imports each file
 *
 * Only includes edges where resolved is non-null (actual project files).
 *
 * @param {object} intel - Full codebase intel object
 * @returns {{ forward: object, reverse: object, stats: object, built_at: string }}
 */
function buildDependencyGraph(intel) {
  const forward = {};
  const reverse = {};
  const languagesParsed = new Set();
  let totalEdges = 0;
  let totalFilesParsed = 0;
  let parseErrors = 0;

  const fileSet = buildFileSet(intel);
  const files = intel.files || {};

  for (const [filePath, fileInfo] of Object.entries(files)) {
    const language = fileInfo.language;
    if (!language || !IMPORT_PARSERS[language]) continue;

    totalFilesParsed++;
    languagesParsed.add(language);

    let content;
    try {
      // Read file content from disk
      const absPath = path.resolve(filePath);
      content = fs.readFileSync(absPath, 'utf8');
    } catch (e) {
      debugLog('deps.buildGraph', `read error: ${filePath}: ${e.message}`);
      parseErrors++;
      continue;
    }

    try {
      const imports = parseImports(filePath, content, language, fileSet, intel);
      const resolvedTargets = [];

      for (const imp of imports) {
        if (imp.resolved) {
          resolvedTargets.push(imp.resolved);

          // Build reverse edge
          if (!reverse[imp.resolved]) {
            reverse[imp.resolved] = [];
          }
          if (!reverse[imp.resolved].includes(filePath)) {
            reverse[imp.resolved].push(filePath);
          }

          totalEdges++;
        }
      }

      if (resolvedTargets.length > 0) {
        forward[filePath] = [...new Set(resolvedTargets)];
      }
    } catch (e) {
      debugLog('deps.buildGraph', `parse error: ${filePath}: ${e.message}`);
      parseErrors++;
    }
  }

  return {
    forward,
    reverse,
    stats: {
      total_files_parsed: totalFilesParsed,
      total_edges: totalEdges,
      languages_parsed: [...languagesParsed].sort(),
      parse_errors: parseErrors,
    },
    built_at: new Date().toISOString(),
  };
}


// ─── Cycle Detection (Tarjan's SCC) ─────────────────────────────────────────

/**
 * Find circular dependencies using Tarjan's strongly connected components algorithm.
 *
 * @param {{ forward: Object<string, string[]> }} graph - Dependency graph with forward adjacency list
 * @returns {{ cycles: string[][], cycle_count: number, files_in_cycles: number }}
 */
function findCycles(graph) {
  const forward = graph.forward || {};
  let index = 0;
  const stack = [];
  const onStack = new Set();
  const indices = {};
  const lowlinks = {};
  const sccs = [];

  function strongConnect(v) {
    indices[v] = index;
    lowlinks[v] = index;
    index++;
    stack.push(v);
    onStack.add(v);

    const neighbors = forward[v] || [];
    for (const w of neighbors) {
      if (indices[w] === undefined) {
        strongConnect(w);
        lowlinks[v] = Math.min(lowlinks[v], lowlinks[w]);
      } else if (onStack.has(w)) {
        lowlinks[v] = Math.min(lowlinks[v], indices[w]);
      }
    }

    // If v is a root node, pop the SCC
    if (lowlinks[v] === indices[v]) {
      const scc = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);

      // Only report components with >= 2 nodes (actual cycles)
      if (scc.length >= 2) {
        sccs.push(scc);
      }
    }
  }

  // Collect all unique nodes (files that appear in forward or as targets)
  const allNodes = new Set(Object.keys(forward));
  for (const targets of Object.values(forward)) {
    for (const t of targets) allNodes.add(t);
  }

  for (const node of allNodes) {
    if (indices[node] === undefined) {
      strongConnect(node);
    }
  }

  // Sort cycles by length descending (largest first)
  sccs.sort((a, b) => b.length - a.length);

  // Count unique files in any cycle
  const filesInCycles = new Set();
  for (const scc of sccs) {
    for (const f of scc) filesInCycles.add(f);
  }

  return {
    cycles: sccs,
    cycle_count: sccs.length,
    files_in_cycles: filesInCycles.size,
  };
}


// ─── Impact Analysis (Transitive Dependents) ────────────────────────────────

/**
 * Get all transitive dependents of a file via BFS on reverse edges.
 *
 * @param {{ reverse: Object<string, string[]> }} graph - Dependency graph with reverse adjacency list
 * @param {string} filePath - Target file path
 * @param {number} [maxDepth=10] - Maximum BFS depth to prevent infinite loops
 * @returns {{ file: string, direct_dependents: string[], transitive_dependents: Array<{file: string, depth: number}>, fan_in: number, max_depth_reached: number }}
 */
function getTransitiveDependents(graph, filePath, maxDepth = 10) {
  const reverse = graph.reverse || {};
  const visited = new Set();
  const directDependents = [];
  const transitiveDependents = [];
  let maxDepthReached = 0;

  // BFS queue: [node, depth]
  const queue = [[filePath, 0]];
  visited.add(filePath);

  while (queue.length > 0) {
    const [current, depth] = queue.shift();

    if (depth > maxDepth) continue;

    const dependents = reverse[current] || [];
    for (const dep of dependents) {
      if (visited.has(dep)) continue;
      visited.add(dep);

      const depDepth = depth + 1;
      if (depDepth > maxDepthReached) maxDepthReached = depDepth;

      if (depDepth === 1) {
        directDependents.push(dep);
      } else {
        transitiveDependents.push({ file: dep, depth: depDepth });
      }

      if (depDepth < maxDepth) {
        queue.push([dep, depDepth]);
      }
    }
  }

  // Sort transitive dependents by depth ascending
  transitiveDependents.sort((a, b) => a.depth - b.depth);

  return {
    file: filePath,
    direct_dependents: directDependents,
    transitive_dependents: transitiveDependents,
    fan_in: directDependents.length + transitiveDependents.length,
    max_depth_reached: maxDepthReached,
  };
}


// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  buildDependencyGraph,
  findCycles,
  getTransitiveDependents,
  // Expose individual parsers for testing
  parseJavaScript,
  parsePython,
  parseGo,
  parseElixir,
  parseRust,
};
