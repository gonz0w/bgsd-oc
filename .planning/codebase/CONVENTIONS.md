# Coding Conventions

**Analysis Date:** 2026-02-26

## Naming Patterns

**Files:**
- Source modules use `kebab-case.js`: `codebase-intel.js`, `regex-cache.js`, `frontmatter.js`
- Command modules are single-word or kebab-case: `state.js`, `verify.js`, `codebase.js`
- Test files use dot-separated suffix: `gsd-tools.test.cjs`, `format.test.cjs`
- All source files use `.js` extension (ES module syntax but CommonJS format)
- Built output uses `.cjs` extension: `bin/gsd-tools.cjs`

**Functions:**
- Use `camelCase` for all functions: `cmdStateLoad`, `findPhaseInternal`, `extractFrontmatter`
- Command handler functions use `cmd` prefix + PascalCase command name: `cmdStateLoad`, `cmdVerifyPlanStructure`, `cmdPhaseAdd`
- Internal/private helpers use descriptive camelCase without prefix: `normalizePhaseName`, `safeReadFile`, `resolveModelInternal`
- Suffix `Internal` for functions used by other modules but not CLI-exposed: `findPhaseInternal`, `pathExistsInternal`, `resolveModelInternal`
- Formatter functions use `format` prefix: `formatStateShow`, `formatStateUpdateProgress`

**Variables:**
- Use `camelCase` for local variables: `tmpDir`, `phaseDir`, `configPath`
- Private module-level caches use `_` prefix: `_modules`, `_configCache`, `_fmCache`, `_phaseTreeCache`, `_tmpFiles`
- Constants use `UPPER_SNAKE_CASE`: `MODEL_PROFILES`, `CONFIG_SCHEMA`, `COMMAND_HELP`, `MAX_CACHE_SIZE`
- Regex patterns use `UPPER_SNAKE_CASE`: `FRONTMATTER_DELIMITERS`, `PHASE_HEADER`, `PHASE_DIR_NUMBER`

**Types:**
- No TypeScript. JSDoc `@typedef` used for complex object shapes in `src/lib/lifecycle.js`
- JSDoc `@param`/`@returns` used for key exported functions in lib modules

## Code Style

**Formatting:**
- No automated formatter configured (no `.prettierrc`, `.eslintrc`)
- 2-space indentation throughout
- Single quotes for strings
- Semicolons always used
- Max line length ~120 characters (not enforced, but observed)
- Trailing commas in multi-line object/array literals

**Linting:**
- No linter configured
- Style enforced by convention and build validation

**Section Dividers:**
- Use Unicode box-drawing comment headers to organize files into sections:
  ```javascript
  // ─── Section Name ──────────────────────────────────────────────────────────
  ```
- Every file uses these section dividers to separate logical groups
- Pattern: `// ─── ` + label + ` ─` repeated to ~80 chars

## Module Format

**Module System:** CommonJS (`require`/`module.exports`)
- All source uses `'use strict';` at top of file (except `helpers.js`, `config.js`)
- Built output is CJS via esbuild: `format: 'cjs'`, `platform: 'node'`

**Strict Mode:**
- Place `'use strict';` as the first statement in every new source file
- Exception: files that start with shebang (`#!/usr/bin/env node`) — the shebang comes first, then `'use strict';`

## Import Organization

**Order:**
1. Node.js built-in modules: `const fs = require('fs');`, `const path = require('path');`, `const { execFileSync } = require('child_process');`
2. Internal lib modules: `const { output, error, debugLog } = require('../lib/output');`
3. Internal lib modules (continued, grouped by function): config, helpers, frontmatter, git, format
4. Sibling command modules (rare): `const { parseAssertionsMd } = require('./verify');`

**Path Style:**
- Always relative paths with `../lib/` or `./` prefix
- No path aliases configured
- Destructured imports preferred: `const { safeReadFile, cachedReadFile, normalizePhaseName } = require('../lib/helpers');`

**Lazy Loading:**
- Router uses lazy-loading pattern for command modules to avoid parsing all 13 modules at startup:
  ```javascript
  const _modules = {};
  function lazyState() { return _modules.state || (_modules.state = require('./commands/state')); }
  ```
- Use this pattern when adding new command modules in `src/router.js`

## Error Handling

**Patterns:**
- **Fatal errors:** Use `error(message)` from `src/lib/output.js` — writes to stderr and calls `process.exit(1)`
  ```javascript
  if (!filePath) { error('file path required'); }
  ```
- **Recoverable errors:** Return error in JSON output object, do NOT exit:
  ```javascript
  if (!content) { output({ error: 'File not found', path: filePath }, raw); return; }
  ```
- **Silent failures:** Use try/catch with `debugLog` for non-critical operations:
  ```javascript
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    debugLog('file.read', 'read failed', e);
    return null;
  }
  ```
- **Never throw.** Functions return `null` or empty defaults on failure, never throw exceptions
- `safeReadFile()` wraps `fs.readFileSync` — returns `null` on error instead of throwing:
  ```javascript
  function safeReadFile(filePath) {
    try { return fs.readFileSync(filePath, 'utf-8'); }
    catch (e) { debugLog('file.read', 'read failed', e); return null; }
  }
  ```

**Debug Logging:**
- Use `debugLog(context, message, err)` for all debug output
- Only emits when `GSD_DEBUG` env var is set
- Format: `[GSD_DEBUG] {context}: {message} | {err.message}`
- Context uses dot-notation convention: `'file.read'`, `'config.load'`, `'git.exec'`, `'phase.tree'`

## Output Patterns

**Dual-Mode Output:**
- All command handlers receive a `raw` boolean parameter (legacy) or use `output(result, { formatter })` (migrated)
- `output()` from `src/lib/output.js` handles JSON/formatted routing based on `global._gsdOutputMode`
- Piped (non-TTY) → JSON to stdout; TTY → human-readable formatted output
- Status/progress messages go to stderr via `status(message)` — never pollute stdout

**Command Handler Signature:**
```javascript
function cmdSomething(cwd, args, raw) {
  // ... compute result ...
  output(result, raw);
}
```

**New commands (migrated pattern):**
```javascript
function cmdSomething(cwd, args, raw) {
  const result = { /* ... */ };
  output(result, {
    formatter: (data) => {
      const lines = [];
      lines.push(banner('Title'));
      // ... format data ...
      lines.push(summaryLine('Summary text'));
      return lines.join('\n');
    }
  });
}
```

**Formatted output primitives** (from `src/lib/format.js`):
- `banner(title)` — branded header: `bGSD ▶ {TITLE}` with rule
- `sectionHeader(label)` — `━━ Label ━━━━━━━━━`
- `formatTable(headers, rows, options)` — PSql-style aligned table
- `progressBar(percent, width)` — `47% [███████░░░]`
- `summaryLine(text)` — horizontal rule + bold summary
- `actionHint(text)` — dim `→ next action`
- `box(content, type)` — info/warning/error/success box
- `color.red/green/yellow/blue/bold/dim()` — ANSI color wrappers (auto-disabled in non-TTY)
- `listWithTruncation(items, max)` — numbered list with "... and N more"

## Caching Patterns

**Module-level caches** persist for a single CLI invocation (no TTL needed since process exits):
- `fileCache` (Map) in `src/lib/helpers.js` — caches `safeReadFile` results
- `dirCache` (Map) in `src/lib/helpers.js` — caches `fs.readdirSync` results
- `_configCache` (Map) in `src/lib/config.js` — keyed by cwd
- `_fmCache` (Map) in `src/lib/frontmatter.js` — keyed by content hash, LRU eviction at 100 entries
- `_dynamicRegexCache` (Map) in `src/lib/regex-cache.js` — LRU eviction at 200 entries
- `_phaseTreeCache` in `src/lib/helpers.js` — single cached phase directory tree scan
- `_milestoneCache` in `src/lib/helpers.js` — single cached milestone info
- `_fieldRegexCache` (Map) in `src/commands/state.js` — cached regex for field extraction

**Cache invalidation:** Call `invalidateFileCache(path)` or `invalidateMilestoneCache()` after writing files to ensure fresh reads.

**LRU Pattern:**
```javascript
const MAX_SIZE = 200;
const cache = new Map();
function cachedGet(key) {
  if (cache.has(key)) {
    const val = cache.get(key);
    cache.delete(key); cache.set(key, val); // Move to end
    return val;
  }
  if (cache.size >= MAX_SIZE) {
    cache.delete(cache.keys().next().value); // Evict oldest
  }
  const val = compute(key);
  cache.set(key, val);
  return val;
}
```

## CLI Argument Parsing

**Pattern:** Manual `args.indexOf()` for named flags, positional `args[N]` for required args:
```javascript
const phaseIdx = args.indexOf('--phase');
const phase = phaseIdx !== -1 ? args[phaseIdx + 1] : null;
const planIdx = args.indexOf('--plan');
const plan = planIdx !== -1 ? args[planIdx + 1] : null;
```

**Global flags** are parsed and spliced out in `src/router.js` before command dispatch:
- `--pretty`, `--raw`, `--fields`, `--verbose`, `--compact`, `--manifest`
- These set `global._gsdOutputMode`, `global._gsdRequestedFields`, `global._gsdCompactMode`, `global._gsdManifestMode`

**Boolean flags:** Use `args.includes('--flag')`: `const fix = args.includes('--fix');`

## Git Operations

**Use `execGit()` from `src/lib/git.js`** — NOT `execSync('git ...')`:
```javascript
const { execGit } = require('../lib/git');
const result = execGit(cwd, ['log', '--oneline', '-n', '10']);
if (result.exitCode === 0) { /* use result.stdout */ }
```
- Uses `execFileSync('git', args)` — bypasses shell, prevents injection
- Returns `{ exitCode, stdout, stderr }` — never throws

**Shell argument safety:** Use `sanitizeShellArg()` from `src/lib/helpers.js` when interpolating user input into shell commands (wraps in single quotes).

## Frontmatter Handling

**Use `extractFrontmatter()` from `src/lib/frontmatter.js`** for reading YAML frontmatter:
```javascript
const { extractFrontmatter } = require('../lib/frontmatter');
const fm = extractFrontmatter(content);
// fm.wave, fm.phase, fm.type, etc.
```

**Use `spliceFrontmatter()` for updating** — replaces frontmatter block while preserving body:
```javascript
const { spliceFrontmatter } = require('../lib/frontmatter');
fm.wave = '2';
const newContent = spliceFrontmatter(content, fm);
fs.writeFileSync(filePath, newContent);
```

## Function Design

**Size:** Functions are medium-length (20-80 lines typical). Complex parsers can reach 100-150 lines.

**Parameters:** Use positional params for required args, object destructuring for optional:
```javascript
function cmdVerifyQuality(cwd, { plan, phase }, raw) { ... }
```

**Return Values:**
- Return plain objects for JSON serialization. Never return class instances.
- Use `null` for "not found" cases, empty arrays/objects for "no results"
- Boolean results use `found: true/false` or `valid: true/false`

## Module Design

**Exports:** Single `module.exports` at end of file with explicit named exports:
```javascript
module.exports = { cmdStateLoad, cmdStateUpdate, cmdStatePatch, ... };
```

**Barrel Files:** Not used. Each module imports directly from the source.

**File Organization:**
- `src/lib/*.js` — shared utilities, parsers, helpers (no CLI output)
- `src/commands/*.js` — command handlers (call `output()` or `error()`)
- `src/router.js` — CLI argument parsing and command dispatch
- `src/index.js` — entry point (5 lines: require router, call main)

## Comments

**When to Comment:**
- JSDoc `@param`/`@returns` for exported functions with non-obvious signatures
- Inline comments for regex patterns explaining what they match
- Section dividers (`// ─── Section Name ──`) for file organization
- `// Backward compat:` comments when preserving legacy behavior

**JSDoc:**
- Used selectively on key exported functions, not universally
- `@typedef` for complex object shapes (see `src/lib/lifecycle.js`)
- Always include `@param` types and `@returns` type

---

*Convention analysis: 2026-02-26*
