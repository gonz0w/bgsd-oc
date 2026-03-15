'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { output, error, debugLog } = require('../lib/output');
const { searchRipgrep, transformJson, parseYAML } = require('../lib/cli-tools');

// --- Language Manifest Patterns -----------------------------------------------

const LANG_MANIFESTS = [
  { file: 'package.json', language: 'node', binary: 'node', versionFlag: '--version' },
  { file: 'go.mod', language: 'go', binary: 'go', versionFlag: 'version' },
  { file: 'mix.exs', language: 'elixir', binary: 'elixir', versionFlag: '--version' },
  { file: 'Cargo.toml', language: 'rust', binary: 'cargo', versionFlag: '--version' },
  { file: 'pyproject.toml', language: 'python', binary: 'python3', versionFlag: '--version' },
  { file: 'setup.py', language: 'python', binary: 'python3', versionFlag: '--version' },
  { file: 'requirements.txt', language: 'python', binary: 'python3', versionFlag: '--version' },
  { file: 'Gemfile', language: 'ruby', binary: 'ruby', versionFlag: '--version' },
  { file: 'composer.json', language: 'php', binary: 'php', versionFlag: '--version' },
  { file: 'build.gradle', language: 'java', binary: 'java', versionFlag: '--version' },
  { file: 'build.gradle.kts', language: 'kotlin', binary: 'java', versionFlag: '--version' },
  { file: 'pom.xml', language: 'java', binary: 'java', versionFlag: '--version' },
  { file: 'Package.swift', language: 'swift', binary: 'swift', versionFlag: '--version' },
  { file: 'CMakeLists.txt', language: 'cpp', binary: 'cc', versionFlag: '--version' },
  { file: 'Makefile', language: 'make', binary: 'make', versionFlag: '--version' },
  { file: 'Justfile', language: 'just', binary: 'just', versionFlag: '--version' },
  { file: 'Dockerfile', language: 'docker', binary: 'docker', versionFlag: '--version' },
  { file: 'docker-compose.yml', language: 'docker', binary: 'docker', versionFlag: '--version' },
  { file: 'docker-compose.yaml', language: 'docker', binary: 'docker', versionFlag: '--version' },
  { file: 'compose.yml', language: 'docker', binary: 'docker', versionFlag: '--version' },
  { file: 'compose.yaml', language: 'docker', binary: 'docker', versionFlag: '--version' },
  { file: 'flake.nix', language: 'nix', binary: 'nix', versionFlag: '--version' },
  { file: 'deno.json', language: 'deno', binary: 'deno', versionFlag: '--version' },
  { file: 'deno.jsonc', language: 'deno', binary: 'deno', versionFlag: '--version' },
  { file: 'bun.lockb', language: 'bun', binary: 'bun', versionFlag: '--version' },
  { file: 'bunfig.toml', language: 'bun', binary: 'bun', versionFlag: '--version' },
];

// Directories to skip during recursive scan
const SKIP_DIRS = new Set([
  'node_modules', 'vendor', 'deps', '_build', '.git', '.next', 'target',
  'dist', 'build', '__pycache__', '.elixir_ls', '.cache',
]);

// Package manager lockfile precedence (first match wins)
const PM_LOCKFILES = [
  { file: 'bun.lock', pm: 'bun' },
  { file: 'bun.lockb', pm: 'bun' },
  { file: 'pnpm-lock.yaml', pm: 'pnpm' },
  { file: 'yarn.lock', pm: 'yarn' },
  { file: 'package-lock.json', pm: 'npm' },
  // Non-Node lockfiles
  { file: 'mix.lock', pm: 'mix' },
  { file: 'go.sum', pm: 'go-modules' },
  { file: 'Cargo.lock', pm: 'cargo' },
  { file: 'Gemfile.lock', pm: 'bundler' },
  { file: 'poetry.lock', pm: 'poetry' },
  { file: 'Pipfile.lock', pm: 'pipenv' },
];

// Version manager files
const VERSION_MANAGERS = [
  { file: '.tool-versions', name: 'asdf' },
  { file: 'mise.toml', name: 'mise' },
  { file: '.mise.toml', name: 'mise' },
  { file: '.nvmrc', name: 'nvm' },
  { file: '.node-version', name: 'node-version' },
  { file: '.python-version', name: 'pyenv' },
  { file: '.ruby-version', name: 'rbenv' },
  { file: '.go-version', name: 'goenv' },
];

// CI config patterns
const CI_CONFIGS = [
  { check: 'dir', path: '.github/workflows', platform: 'github-actions' },
  { check: 'file', path: '.gitlab-ci.yml', platform: 'gitlab-ci' },
  { check: 'dir', path: '.circleci', platform: 'circleci' },
  { check: 'file', path: 'Jenkinsfile', platform: 'jenkins' },
  { check: 'file', path: '.travis.yml', platform: 'travis' },
];

// Test framework config patterns
const TEST_CONFIGS = [
  { pattern: 'jest.config.*', name: 'jest' },
  { pattern: 'vitest.config.*', name: 'vitest' },
  { pattern: '.mocharc.*', name: 'mocha' },
  { pattern: 'pytest.ini', name: 'pytest' },
  { pattern: 'setup.cfg', name: 'pytest', check: '[tool:pytest]' },
  { pattern: 'tox.ini', name: 'tox' },
];

// Linter/formatter config patterns
const LINT_CONFIGS = [
  { pattern: '.eslintrc*', name: 'eslint', type: 'linter' },
  { pattern: 'eslint.config.*', name: 'eslint', type: 'linter' },
  { pattern: '.prettierrc*', name: 'prettier', type: 'formatter' },
  { pattern: 'prettier.config.*', name: 'prettier', type: 'formatter' },
  { pattern: 'biome.json', name: 'biome', type: 'both' },
  { pattern: 'biome.jsonc', name: 'biome', type: 'both' },
  { pattern: '.credo.exs', name: 'credo', type: 'linter' },
  { pattern: '.golangci.yml', name: 'golangci-lint', type: 'linter' },
  { pattern: '.golangci.yaml', name: 'golangci-lint', type: 'linter' },
  { pattern: 'rustfmt.toml', name: 'rustfmt', type: 'formatter' },
  { pattern: '.rubocop.yml', name: 'rubocop', type: 'both' },
];

// Well-known script names to capture
const WELL_KNOWN_SCRIPTS = ['test', 'build', 'lint', 'start', 'deploy', 'format', 'check'];


// --- Scanning Functions -------------------------------------------------------

/**
 * Recursively scan directory for manifest files up to a depth limit.
 * Returns array of { language, file, path (relative), depth, binary, versionFlag }.
 */
function scanManifests(rootDir, maxDepth) {
  const results = [];

  function walk(dir, depth) {
    if (depth > maxDepth) return;

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // Permission denied or other error — skip
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          walk(path.join(dir, entry.name), depth + 1);
        }
      } else if (entry.isFile()) {
        for (const manifest of LANG_MANIFESTS) {
          if (entry.name === manifest.file) {
            results.push({
              language: manifest.language,
              file: manifest.file,
              path: path.relative(rootDir, path.join(dir, entry.name)),
              depth,
              binary: manifest.binary,
              versionFlag: manifest.versionFlag,
            });
          }
        }
      }
    }
  }

  walk(rootDir, 0);
  return results;
}

/**
 * Determine primary language from detected manifests.
 * Priority: root manifest (depth 0), count at depth 0, then total count.
 */
function determinePrimaryLanguage(manifests) {
  if (manifests.length === 0) return null;

  // Group by language
  const langStats = {};
  for (const m of manifests) {
    if (!langStats[m.language]) {
      langStats[m.language] = { rootCount: 0, totalCount: 0 };
    }
    langStats[m.language].totalCount++;
    if (m.depth === 0) langStats[m.language].rootCount++;
  }

  // Sort: most root manifests first, then most total manifests
  const sorted = Object.entries(langStats).sort((a, b) => {
    if (b[1].rootCount !== a[1].rootCount) return b[1].rootCount - a[1].rootCount;
    return b[1].totalCount - a[1].totalCount;
  });

  return sorted[0][0];
}

/**
 * Build language entries from manifests. Groups by language.
 */
function buildLanguageEntries(manifests, primaryLang) {
  const byLang = {};

  for (const m of manifests) {
    if (!byLang[m.language]) {
      byLang[m.language] = {
        name: m.language,
        primary: m.language === primaryLang,
        manifests: [],
        binary: { name: m.binary, versionFlag: m.versionFlag, available: false, version: null, path: null },
      };
    }
    byLang[m.language].manifests.push({ file: m.file, path: m.path, depth: m.depth });
  }

  return Object.values(byLang);
}

/**
 * Check binary availability and version.
 * Returns { available, version, path }.
 */
function checkBinary(binaryName, versionFlag) {
  const result = { available: false, version: null, path: null };
  const timeout = 3000;

  try {
    // Use execFileSync — avoids shell spawning overhead (~2ms per call)
    const whichResult = execFileSync('which', [binaryName], {
      encoding: 'utf-8', timeout, stdio: 'pipe',
    }).trim();

    if (whichResult) {
      result.available = true;
      result.path = whichResult;

      try {
        // Parse versionFlag which may contain spaces (e.g., 'go version')
        const flagArgs = versionFlag.split(/\s+/);
        const versionOut = execFileSync(binaryName, flagArgs, {
          encoding: 'utf-8', timeout, stdio: 'pipe',
        }).trim();

        const versionMatch = versionOut.match(/(\d+\.\d+[\.\d]*)/);
        if (versionMatch) {
          result.version = versionMatch[1];
        }
      } catch {
        // Binary found but version check failed
        debugLog('env.binary', `version check failed for ${binaryName}`);
      }
    }
  } catch {
    // Binary not found
    debugLog('env.binary', `${binaryName} not found on PATH`);
  }

  return result;
}

/**
 * Detect package manager from lockfiles and packageManager field.
 */
function detectPackageManager(rootDir) {
  const result = { name: null, version: null, source: null, detected_from: null };

  // Check packageManager field in package.json first (highest precedence)
  const pkgJsonPath = path.join(rootDir, 'package.json');
  try {
    if (fs.existsSync(pkgJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
      if (pkg.packageManager) {
        const match = pkg.packageManager.match(/^([^@]+)(?:@(.+))?$/);
        if (match) {
          result.name = match[1];
          result.version = match[2] || null;
          result.source = 'packageManager-field';
          result.detected_from = 'package.json';
          return result;
        }
      }
    }
  } catch {
    debugLog('env.pm', 'package.json parse failed');
  }

  // Fall back to lockfile detection
  for (const lockfile of PM_LOCKFILES) {
    if (fs.existsSync(path.join(rootDir, lockfile.file))) {
      result.name = lockfile.pm;
      result.source = 'lockfile';
      result.detected_from = lockfile.file;
      return result;
    }
  }

  return result;
}

/**
 * Detect version managers and their configured versions.
 */
function detectVersionManagers(rootDir) {
  const results = [];

  for (const vm of VERSION_MANAGERS) {
    const filePath = path.join(rootDir, vm.file);
    if (fs.existsSync(filePath)) {
      const entry = { name: vm.name, file: vm.file, configured_versions: {} };

      try {
        const content = fs.readFileSync(filePath, 'utf-8').trim();

        if (vm.file === '.nvmrc' || vm.file === '.node-version') {
          entry.configured_versions.node = content.replace(/^v/, '');
        } else if (vm.file === '.python-version') {
          entry.configured_versions.python = content;
        } else if (vm.file === '.ruby-version') {
          entry.configured_versions.ruby = content;
        } else if (vm.file === '.go-version') {
          entry.configured_versions.go = content;
        } else if (vm.file === '.tool-versions') {
          // Parse asdf .tool-versions: each line is "tool version"
          for (const line of content.split('\n')) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 2 && !parts[0].startsWith('#')) {
              entry.configured_versions[parts[0]] = parts[1];
            }
          }
        } else if (vm.file === 'mise.toml' || vm.file === '.mise.toml') {
          // Simplified mise.toml parsing: look for [tools] section
          const toolsMatch = content.match(/\[tools\]\s*\n((?:.*\n?)*?)(?:\n\[|$)/);
          if (toolsMatch) {
            for (const line of toolsMatch[1].split('\n')) {
              const kvMatch = line.match(/^\s*(\w+)\s*=\s*["']?([^"'\s]+)["']?/);
              if (kvMatch) {
                entry.configured_versions[kvMatch[1]] = kvMatch[2];
              }
            }
          }
        }
      } catch {
        debugLog('env.vm', `failed to parse ${vm.file}`);
      }

      results.push(entry);
    }
  }

  return results;
}

/**
 * Detect CI platform.
 */
function detectCI(rootDir) {
  for (const ci of CI_CONFIGS) {
    const fullPath = path.join(rootDir, ci.path);
    try {
      if (ci.check === 'dir') {
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
          return { platform: ci.platform, config_file: ci.path };
        }
      } else {
        if (fs.existsSync(fullPath)) {
          return { platform: ci.platform, config_file: ci.path };
        }
      }
    } catch {
      // Skip on permission errors
    }
  }
  return null;
}

/**
 * Detect test frameworks from config files and directories.
 */
function detectTestFrameworks(rootDir) {
  const results = [];
  const seen = new Set();

  for (const tc of TEST_CONFIGS) {
    try {
      // Simple glob-like matching for patterns with wildcards
      const dir = fs.readdirSync(rootDir);
      for (const entry of dir) {
        if (matchSimpleGlob(entry, tc.pattern)) {
          if (tc.check) {
            // Need to verify content
            const content = fs.readFileSync(path.join(rootDir, entry), 'utf-8');
            if (!content.includes(tc.check)) continue;
          }
          if (!seen.has(tc.name)) {
            seen.add(tc.name);
            results.push({ name: tc.name, config_file: entry });
          }
        }
      }
    } catch {
      // Skip
    }
  }

  // Also check for test directories
  for (const testDir of ['test', 'tests', 'spec', '__tests__']) {
    try {
      const fullPath = path.join(rootDir, testDir);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
        results.push({ name: testDir, config_file: null });
      }
    } catch {
      // Skip
    }
  }

  return results;
}

/**
 * Detect linters and formatters from config files.
 */
function detectLintFormat(rootDir) {
  const linters = [];
  const formatters = [];
  const seen = new Set();

  try {
    const dir = fs.readdirSync(rootDir);
    for (const entry of dir) {
      for (const lc of LINT_CONFIGS) {
        if (matchSimpleGlob(entry, lc.pattern) && !seen.has(lc.name)) {
          seen.add(lc.name);
          const item = { name: lc.name, config_file: entry };
          if (lc.type === 'linter' || lc.type === 'both') linters.push(item);
          if (lc.type === 'formatter' || lc.type === 'both') formatters.push(item);
        }
      }
    }
  } catch {
    // Skip
  }

  return { linters, formatters };
}

/**
 * Simple glob matching: supports * wildcard at end of pattern.
 * e.g., "jest.config.*" matches "jest.config.js", "jest.config.ts"
 * e.g., ".eslintrc*" matches ".eslintrc", ".eslintrc.json", ".eslintrc.js"
 */
function matchSimpleGlob(name, pattern) {
  if (!pattern.includes('*')) return name === pattern;

  const starIdx = pattern.indexOf('*');
  const prefix = pattern.slice(0, starIdx);
  const suffix = pattern.slice(starIdx + 1);

  if (suffix) {
    return name.startsWith(prefix) && name.endsWith(suffix);
  }
  return name.startsWith(prefix);
}

/**
 * Detect well-known scripts from package.json, Makefile, and Justfile.
 */
function detectScripts(rootDir) {
  const scripts = {};

  // package.json scripts
  try {
    const pkgPath = path.join(rootDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.scripts) {
        for (const name of WELL_KNOWN_SCRIPTS) {
          if (pkg.scripts[name]) {
            scripts[name] = pkg.scripts[name];
          }
        }
      }
    }
  } catch {
    debugLog('env.scripts', 'package.json parse failed');
  }

  // Makefile targets
  try {
    const makefilePath = path.join(rootDir, 'Makefile');
    if (fs.existsSync(makefilePath)) {
      const content = fs.readFileSync(makefilePath, 'utf-8');
      const targets = [];
      for (const line of content.split('\n')) {
        const match = line.match(/^([a-zA-Z_][\w-]*):/);
        if (match && !match[1].startsWith('.')) {
          targets.push(match[1]);
        }
      }
      if (targets.length > 0) {
        scripts._makefile_targets = targets;
      }
    }
  } catch {
    debugLog('env.scripts', 'Makefile parse failed');
  }

  // Justfile targets
  try {
    const justfilePath = path.join(rootDir, 'Justfile');
    if (fs.existsSync(justfilePath)) {
      const content = fs.readFileSync(justfilePath, 'utf-8');
      const targets = [];
      for (const line of content.split('\n')) {
        const match = line.match(/^([a-zA-Z_][\w-]*)(?:\s.*)?:/);
        if (match) {
          targets.push(match[1]);
        }
      }
      if (targets.length > 0) {
        scripts._justfile_targets = targets;
      }
    }
  } catch {
    debugLog('env.scripts', 'Justfile parse failed');
  }

  // mix aliases (if mix.exs exists)
  try {
    const mixPath = path.join(rootDir, 'mix.exs');
    if (fs.existsSync(mixPath)) {
      const result = execFileSync('mix', ['help', '--names'], {
        cwd: rootDir, encoding: 'utf-8', timeout: 3000, stdio: 'pipe',
      }).trim();
      if (result) {
        const aliases = result.split('\n').filter(l => l.trim());
        if (aliases.length > 0) {
          scripts._mix_tasks = aliases.slice(0, 20); // Cap to avoid bloat
        }
      }
    }
  } catch {
    debugLog('env.scripts', 'mix help failed');
  }

  return scripts;
}

/**
 * Detect infrastructure services from docker-compose files.
 */
function detectInfraServices(rootDir) {
  const dockerServices = [];
  const composeFiles = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'];

  for (const file of composeFiles) {
    const filePath = path.join(rootDir, file);
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');

        // Ripgrep pre-filter: if no image/build lines, skip this file entirely
        const rgResult = searchRipgrep('image:|build:', { paths: [filePath] });
        const hasServices = !rgResult.success || rgResult.usedFallback ||
          (Array.isArray(rgResult.result) && rgResult.result.length > 0);
        if (!hasServices) continue;

        // Try yq-backed structured parse first
        let foundViaYq = false;
        const parsed = parseYAML(content);
        if (parsed.success && parsed.result && parsed.result.services &&
            typeof parsed.result.services === 'object') {
          const names = Object.keys(parsed.result.services);
          if (names.length > 0) {
            dockerServices.push(...names);
            foundViaYq = true;
          }
        }

        // Regex fallback if yq parse failed or returned no services
        if (!foundViaYq) {
          const servicesMatch = content.match(/^services:\s*\n((?:[ \t]+\S.*\n?)*)/m);
          if (servicesMatch) {
            const serviceLines = servicesMatch[1].split('\n');
            for (const line of serviceLines) {
              const match = line.match(/^[ \t]{2}(\w[\w-]*):/);
              if (match) {
                dockerServices.push(match[1]);
              }
            }
          }
        }
      }
    } catch {
      debugLog('env.infra', `failed to parse ${file}`);
    }
  }

  return dockerServices;
}

/**
 * Detect MCP servers from .mcp.json.
 */
function detectMcpServers(rootDir) {
  const servers = [];

  try {
    const mcpPath = path.join(rootDir, '.mcp.json');
    if (fs.existsSync(mcpPath)) {
      const rawContent = fs.readFileSync(mcpPath, 'utf-8');
      // Use jq for server name extraction (with JS fallback)
      const jqResult = transformJson(rawContent, '.mcpServers | keys', { compact: true });
      if (jqResult.success && jqResult.result) {
        try {
          const names = JSON.parse(jqResult.result);
          if (Array.isArray(names)) {
            servers.push(...names);
          }
        } catch {
          // jq returned unparseable — fall through to manual parse
          const content = JSON.parse(rawContent);
          if (content.mcpServers && typeof content.mcpServers === 'object') {
            for (const name of Object.keys(content.mcpServers)) {
              servers.push(name);
            }
          }
        }
      } else {
        // jq not available — use manual parse
        const content = JSON.parse(rawContent);
        if (content.mcpServers && typeof content.mcpServers === 'object') {
          for (const name of Object.keys(content.mcpServers)) {
            servers.push(name);
          }
        }
      }
    }
  } catch {
    debugLog('env.mcp', '.mcp.json parse failed');
  }

  return servers;
}

/**
 * Detect monorepo/workspace configuration.
 */
function detectMonorepo(rootDir) {
  // npm/yarn/pnpm workspaces
  try {
    const pkgPath = path.join(rootDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.workspaces) {
        const members = Array.isArray(pkg.workspaces)
          ? pkg.workspaces
          : (pkg.workspaces.packages || []);
        return { type: 'npm-workspaces', members };
      }
    }
  } catch {
    // Skip
  }

  // pnpm-workspace.yaml
  try {
    const pnpmWsPath = path.join(rootDir, 'pnpm-workspace.yaml');
    if (fs.existsSync(pnpmWsPath)) {
      const content = fs.readFileSync(pnpmWsPath, 'utf-8');
      let members = [];

      // Try yq-backed structured parse first
      const parsed = parseYAML(content);
      if (parsed.success && parsed.result && Array.isArray(parsed.result.packages)) {
        members = parsed.result.packages;
      } else {
        // Regex fallback if yq parse failed or returned no packages
        const packagesMatch = content.match(/packages:\s*\n((?:\s*-\s*.+\n?)*)/);
        if (packagesMatch) {
          for (const line of packagesMatch[1].split('\n')) {
            const m = line.match(/^\s*-\s*['"]?(.+?)['"]?\s*$/);
            if (m) members.push(m[1]);
          }
        }
      }

      return { type: 'pnpm-workspaces', members };
    }
  } catch {
    // Skip
  }

  // Go workspace
  try {
    const goWorkPath = path.join(rootDir, 'go.work');
    if (fs.existsSync(goWorkPath)) {
      const content = fs.readFileSync(goWorkPath, 'utf-8');
      const members = [];
      const useMatch = content.match(/use\s*\(([\s\S]*?)\)/);
      if (useMatch) {
        for (const line of useMatch[1].split('\n')) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('//')) {
            members.push(trimmed);
          }
        }
      }
      return { type: 'go-workspace', members };
    }
  } catch {
    // Skip
  }

  // Elixir umbrella
  try {
    const mixPath = path.join(rootDir, 'mix.exs');
    if (fs.existsSync(mixPath)) {
      const content = fs.readFileSync(mixPath, 'utf-8');
      if (content.includes('apps_path')) {
        // Try to list apps directory
        const appsDir = path.join(rootDir, 'apps');
        if (fs.existsSync(appsDir) && fs.statSync(appsDir).isDirectory()) {
          const members = fs.readdirSync(appsDir).filter(d => {
            try {
              return fs.statSync(path.join(appsDir, d)).isDirectory();
            } catch { return false; }
          });
          return { type: 'elixir-umbrella', members };
        }
      }
    }
  } catch {
    // Skip
  }

  return null;
}


// --- Watched Files & Staleness ------------------------------------------------

/**
 * Determine which files should be watched for staleness.
 * Includes: root-level manifest files (depth 0), lockfiles, version manager files,
 * docker-compose files.
 */
function getWatchedFiles(cwd, manifests) {
  const watched = new Set();

  // Root manifest files (depth 0 only)
  for (const m of manifests) {
    if (m.depth === 0) {
      watched.add(m.file);
    }
  }

  // Lockfiles
  for (const lf of PM_LOCKFILES) {
    if (fs.existsSync(path.join(cwd, lf.file))) {
      watched.add(lf.file);
    }
  }

  // Version manager files
  for (const vm of VERSION_MANAGERS) {
    if (fs.existsSync(path.join(cwd, vm.file))) {
      watched.add(vm.file);
    }
  }

  // Docker-compose files
  for (const dcFile of ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml']) {
    if (fs.existsSync(path.join(cwd, dcFile))) {
      watched.add(dcFile);
    }
  }

  return Array.from(watched).sort();
}

/**
 * Get mtimes for watched files.
 */
function getWatchedFilesMtimes(cwd, watchedFiles) {
  const mtimes = {};
  for (const file of watchedFiles) {
    try {
      const stat = fs.statSync(path.join(cwd, file));
      mtimes[file] = stat.mtimeMs;
    } catch {
      // File disappeared between check and stat — skip
    }
  }
  return mtimes;
}

/**
 * Ensure env-manifest.json is in gitignore.
 * Checks .planning/.gitignore first, then creates it if needed.
 */
function ensureManifestGitignored(cwd) {
  const planningDir = path.join(cwd, '.planning');
  const planningGitignore = path.join(planningDir, '.gitignore');

  // Try to read .planning/.gitignore — if it exists, check/append
  try {
    const content = fs.readFileSync(planningGitignore, 'utf-8');
    if (content.includes('env-manifest.json')) return; // Already there
    // Append
    const newContent = content.endsWith('\n') ? content + 'env-manifest.json\n' : content + '\nenv-manifest.json\n';
    fs.writeFileSync(planningGitignore, newContent);
    return;
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    // File doesn't exist — fall through
  }

  // Check root .gitignore
  const rootGitignore = path.join(cwd, '.gitignore');
  try {
    const content = fs.readFileSync(rootGitignore, 'utf-8');
    if (content.includes('env-manifest.json')) return; // Already there
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }

  // Create .planning/.gitignore with env-manifest.json (only if .planning/ exists)
  try {
    fs.writeFileSync(planningGitignore, 'env-manifest.json\n');
  } catch (e) {
    if (e.code === 'ENOENT') return; // .planning/ dir doesn't exist — skip
    throw e;
  }
}

/**
 * Write the committed project profile (non-machine-specific structure info).
 */
function writeProjectProfile(cwd, result) {
  const planningDir = path.join(cwd, '.planning');

  const ci = result.tools && result.tools.ci;
  const infraServices = result.infrastructure && result.infrastructure.docker_services
    ? result.infrastructure.docker_services
    : [];

  const profile = {
    '$schema_version': '1.0',
    generated_at: new Date().toISOString(),
    languages: result.languages.map(l => l.name),
    primary_language: (result.languages.find(l => l.primary) || {}).name || null,
    package_manager: result.package_manager ? result.package_manager.name : null,
    monorepo: result.monorepo || null,
    ci_platform: ci ? ci.platform : null,
    infrastructure_services: infraServices,
  };

  const profilePath = path.join(planningDir, 'project-profile.json');
  try {
    fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2) + '\n');
  } catch (e) {
    if (e.code === 'ENOENT') return; // .planning/ dir doesn't exist — skip
    throw e;
  }
}

/**
 * Check manifest staleness by comparing watched file mtimes.
 * @param {string} cwd - Project root
 * @returns {{ stale: boolean, reason?: string, changed_files?: string[] }}
 */
function checkEnvManifestStaleness(cwd) {
  const manifestPath = path.join(cwd, '.planning', 'env-manifest.json');

  if (!fs.existsSync(manifestPath)) {
    return { stale: true, reason: 'no_manifest' };
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch {
    return { stale: true, reason: 'corrupt_manifest' };
  }

  if (!manifest.watched_files_mtimes) {
    return { stale: true, reason: 'no_mtime_data' };
  }

  // Compare mtimes
  const changedFiles = [];
  for (const file of (manifest.watched_files || [])) {
    const filePath = path.join(cwd, file);
    try {
      const currentMtime = fs.statSync(filePath).mtimeMs;
      const recordedMtime = manifest.watched_files_mtimes[file];
      if (recordedMtime === undefined || currentMtime > recordedMtime) {
        changedFiles.push(file);
      }
    } catch {
      // File was deleted since last scan — that's a change
      if (manifest.watched_files_mtimes[file] !== undefined) {
        changedFiles.push(file);
      }
    }
  }

  // Check for new watched files that weren't in the manifest.
  // Instead of doing a full scanManifests(cwd, 0) recursive walk,
  // just check if any known manifest/lockfile/version-manager files exist
  // that weren't in the original watched list (cheap existsSync checks).
  // Deduplicated set avoids redundant existsSync calls for shared filenames.
  const knownFilesSet = new Set([
    ...LANG_MANIFESTS.map(m => m.file),
    ...PM_LOCKFILES.map(l => l.file),
    ...VERSION_MANAGERS.map(v => v.file),
  ]);
  const trackedSet = new Set(manifest.watched_files || []);
  for (const file of knownFilesSet) {
    if (!trackedSet.has(file) && fs.existsSync(path.join(cwd, file))) {
      // New file appeared that wasn't tracked
      changedFiles.push(file);
      break; // One new file is enough to trigger rescan
    }
  }

  if (changedFiles.length > 0) {
    return { stale: true, reason: 'files_changed', changed_files: [...new Set(changedFiles)] };
  }

  return { stale: false };
}


// --- Main Command Functions ---------------------------------------------------

/**
 * Perform the full environment scan and return the result object.
 * Extracted so both cmdEnvScan and cmdEnvStatus can reuse detection logic.
 * @param {string} cwd - Project root directory
 * @param {object} [options] - Scan options
 * @param {boolean} [options.skipBinaryVersions=false] - Skip binary version checks for speed
 */
function performEnvScan(cwd, options = {}) {
  const { skipBinaryVersions = false } = options;
  const startMs = Date.now();

  // 1. Scan for manifest files (fast path — file existence only)
  const manifests = scanManifests(cwd, 3);

  // 2. Determine primary language
  const primaryLang = determinePrimaryLanguage(manifests);

  // 3. Build language entries
  const languages = buildLanguageEntries(manifests, primaryLang);

  // 4. Check binary availability for each detected language
  if (!skipBinaryVersions) {
    for (const lang of languages) {
      const binaryResult = checkBinary(lang.binary.name, lang.binary.versionFlag);
      lang.binary.available = binaryResult.available;
      lang.binary.version = binaryResult.version;
      lang.binary.path = binaryResult.path;
    }

    // Elixir special case: also check 'mix' binary
    const elixirLang = languages.find(l => l.name === 'elixir');
    if (elixirLang) {
      const mixResult = checkBinary('mix', '--version');
      elixirLang.binary.extra = { name: 'mix', ...mixResult };
    }
  }

  // 5. Detect package manager
  const packageManager = detectPackageManager(cwd);

  // 6. Detect version managers
  const versionManagers = detectVersionManagers(cwd);

  // 7. Detect tools
  const ci = detectCI(cwd);
  const testFrameworks = detectTestFrameworks(cwd);
  const { linters, formatters } = detectLintFormat(cwd);

  // 8. Detect scripts
  const scripts = detectScripts(cwd);

  // 9. Detect infrastructure
  const dockerServices = detectInfraServices(cwd);
  const mcpServers = detectMcpServers(cwd);

  // 10. Detect monorepo
  const monorepo = detectMonorepo(cwd);

  const detectionMs = Date.now() - startMs;

  // 11. Compute watched files and their mtimes
  const watchedFiles = getWatchedFiles(cwd, manifests);
  const watchedFilesMtimes = getWatchedFilesMtimes(cwd, watchedFiles);

  return {
    '$schema_version': '1.0',
    scanned_at: new Date().toISOString(),
    detection_ms: detectionMs,
    languages,
    package_manager: packageManager,
    version_managers: versionManagers,
    tools: {
      ci,
      test_frameworks: testFrameworks,
      linters,
      formatters,
    },
    scripts,
    infrastructure: {
      docker_services: dockerServices,
      mcp_servers: mcpServers,
    },
    monorepo,
    watched_files: watchedFiles,
    watched_files_mtimes: watchedFilesMtimes,
  };
}

/**
 * Write the manifest to disk if .planning/ exists.
 */
function writeManifest(cwd, result) {
  const planningDir = path.join(cwd, '.planning');
  if (!fs.existsSync(planningDir)) return false;

  const manifestPath = path.join(planningDir, 'env-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(result, null, 2) + '\n');
  return true;
}

/**
 * cmdEnvScan - Environment detection engine.
 * Scans a project for languages, package managers, tools, and binary availability.
 * Writes env-manifest.json to .planning/ and project-profile.json.
 *
 * @param {string} cwd - Project root directory
 * @param {string[]} args - CLI arguments (after 'env scan')
 * @param {boolean} raw - Raw JSON output mode
 */
function cmdEnvScan(cwd, args, raw) {
  const force = args.includes('--force');
  const verbose = global._gsdCompactMode === false; // --verbose flag parsed globally in router

  // Staleness check (unless --force)
  if (!force) {
    const staleness = checkEnvManifestStaleness(cwd);
    if (!staleness.stale) {
      // Manifest is fresh — return existing data without re-scanning
      const manifestPath = path.join(cwd, '.planning', 'env-manifest.json');
      const existing = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      if (verbose) {
        process.stderr.write('Environment manifest is current\n');
      }
      if (raw) {
        output(existing, raw);
      }
      // Silent exit (no stdout) when not --raw and manifest is fresh
      process.exit(0);
    }

    // Stale — notify if verbose and reason is files_changed
    if (staleness.reason === 'files_changed' && verbose) {
      const changed = staleness.changed_files || [];
      process.stderr.write(`Environment changed (${changed.join(', ')} modified), rescanning...\n`);
    }
  }

  // Perform full scan
  const result = performEnvScan(cwd);

  // Write manifest to .planning/ if it exists
  writeManifest(cwd, result);

  // Ensure gitignore entry
  ensureManifestGitignored(cwd);

  // Write committed project profile
  writeProjectProfile(cwd, result);

  // Verbose summary to stderr
  if (verbose) {
    const langNames = result.languages.map(l => l.name).join(', ');
    const pm = result.package_manager ? result.package_manager.name : 'none';
    process.stderr.write(`Scanned in ${result.detection_ms}ms: languages=[${langNames}], pm=${pm}, watched=${result.watched_files.length} files\n`);
  }

  // Output: --raw prints JSON to stdout, otherwise silent
  if (raw) {
    output(result, raw);
  }

  process.exit(0);
}

/**
 * cmdEnvStatus - Report manifest staleness without scanning.
 *
 * @param {string} cwd - Project root directory
 * @param {string[]} args - CLI arguments (after 'env status')
 * @param {boolean} raw - Raw JSON output mode
 */
function cmdEnvStatus(cwd, args, raw) {
  const manifestPath = path.join(cwd, '.planning', 'env-manifest.json');
  const exists = fs.existsSync(manifestPath);

  let manifest = null;
  if (exists) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch {
      // corrupt
    }
  }

  const staleness = checkEnvManifestStaleness(cwd);

  const result = {
    exists,
    stale: staleness.stale,
    reason: staleness.reason || null,
    scanned_at: manifest ? manifest.scanned_at : null,
    age_minutes: manifest ? Math.round((Date.now() - new Date(manifest.scanned_at).getTime()) / 60000) : null,
    languages_count: manifest ? (manifest.languages || []).length : 0,
    changed_files: staleness.changed_files || [],
  };

  output(result, raw);
}

// --- Environment Summary Helpers -----------------------------------------------

/**
 * Read and parse the env-manifest.json file.
 * @param {string} cwd - Project root directory
 * @returns {object|null} Parsed manifest or null if missing/invalid
 */
function readEnvManifest(cwd) {
  const manifestPath = path.join(cwd, '.planning', 'env-manifest.json');
  try {
    if (!fs.existsSync(manifestPath)) return null;
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Format a compact "Tools: ..." summary line from a manifest.
 * Groups each language with its PM if applicable.
 * Output: "Tools: node@20.11 (pnpm), elixir@1.16 (mix), go@1.21, docker"
 *
 * @param {object|null} manifest - Parsed env-manifest.json
 * @returns {string|null} Compact summary line or null
 */
function formatEnvSummary(manifest) {
  if (!manifest || !manifest.languages || manifest.languages.length === 0) return null;

  // Map PM names to the language they belong to
  const langPmMap = {
    npm: 'node', pnpm: 'node', yarn: 'node', bun: 'node',
    mix: 'elixir',
    cargo: 'rust',
    bundler: 'ruby',
    poetry: 'python', pipenv: 'python',
    'go-modules': 'go',
  };

  const pm = manifest.package_manager;
  const pmName = pm && pm.name ? pm.name : null;
  const pmLang = pmName ? (langPmMap[pmName] || null) : null;

  const parts = [];
  for (const lang of manifest.languages) {
    let entry;
    if (lang.binary && lang.binary.available && lang.binary.version) {
      entry = `${lang.name}@${lang.binary.version}`;
    } else if (lang.binary && lang.binary.available) {
      entry = lang.name;
    } else {
      entry = `${lang.name} (no binary)`;
    }

    // Append PM in parentheses if this is the PM's language
    if (pmLang === lang.name && pmName) {
      // For go-modules, show as "go modules" in parens
      const pmDisplay = pmName === 'go-modules' ? 'go modules' : pmName;
      // Don't duplicate: if entry is "elixir@1.16" and PM is "mix", add "(mix)"
      // But if PM name === language name (like "mix" for elixir), still useful
      entry += ` (${pmDisplay})`;
    }

    parts.push(entry);
  }

  // Add docker if detected
  if (manifest.infrastructure && manifest.infrastructure.docker_services && manifest.infrastructure.docker_services.length > 0) {
    // Only add docker entry if no docker language entry already exists
    if (!manifest.languages.some(l => l.name === 'docker')) {
      parts.push('docker');
    }
  }

  return `Tools: ${parts.join(', ')}`;
}

/**
 * Auto-trigger environment scan on init commands if no manifest exists or manifest is stale.
 * Uses fast path: skips binary version checks for speed.
 *
 * @param {string} cwd - Project root directory
 * @returns {object|null} Manifest object or null if not a GSD project
 */
function autoTriggerEnvScan(cwd) {
  const planningDir = path.join(cwd, '.planning');
  if (!fs.existsSync(planningDir)) return null;  // Not a GSD project

  const manifest = readEnvManifest(cwd);

  // If manifest exists, check staleness
  if (manifest) {
    const staleness = checkEnvManifestStaleness(cwd);
    if (!staleness.stale) {
      return manifest; // Fresh manifest — return as-is
    }
    // Stale — rescan
    debugLog('env.autoTrigger', `rescan: ${staleness.reason}`);
  }

  // No manifest or stale — run a fast scan (skip binary version checks on rescan)
  try {
    const result = performEnvScan(cwd, { skipBinaryVersions: !!manifest });
    writeManifest(cwd, result);
    ensureManifestGitignored(cwd);
    writeProjectProfile(cwd, result);
    return result;
  } catch (e) {
    debugLog('env.autoTrigger', `scan failed: ${e.message}`);
    return manifest; // Return stale manifest rather than nothing
  }
}

module.exports = {
  cmdEnvScan, cmdEnvStatus,
  LANG_MANIFESTS, checkBinary,
  readEnvManifest, formatEnvSummary, autoTriggerEnvScan,
};
