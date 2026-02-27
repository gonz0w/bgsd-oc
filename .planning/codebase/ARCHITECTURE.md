# Architecture

**Analysis Date:** 2026-02-26

## Pattern Overview

**Overall:** Single-entry CLI with command-router pattern, lazy-loaded command modules, and a shared library layer.

**Key Characteristics:**
- **Single-file bundle:** 28 source modules (src/) are bundled by esbuild into one CJS file (`bin/gsd-tools.cjs`, ~17K lines) — zero runtime dependencies except Node.js builtins and `tokenx`
- **JSON-over-stdout interface:** Every command outputs structured JSON to stdout; human-readable formatting is an opt-in overlay (TTY auto-detect or `--pretty`)
- **Lazy module loading:** Command modules are loaded on first use, not at startup — only one module is loaded per invocation
- **Process-per-command model:** Each CLI invocation is a fresh process. Caching is per-invocation only (module-level `Map` caches). No daemon, no server.
- **Markdown-as-database:** All state is stored in `.planning/` markdown files (STATE.md, ROADMAP.md, PLAN.md) and JSON files (config.json, memory stores). No external database.

## Layers

**Entry Point (src/index.js):**
- Purpose: Shebang entry, delegates to router
- Location: `src/index.js` (5 lines)
- Contains: `require('./router').main()` call only
- Depends on: `src/router.js`
- Used by: esbuild as entrypoint → `bin/gsd-tools.cjs`

**Router (src/router.js):**
- Purpose: Parse argv, extract global flags (`--pretty`, `--verbose`, `--compact`, `--fields`, `--manifest`), dispatch to command handlers via switch statement
- Location: `src/router.js` (791 lines)
- Contains: Global flag parsing, TTY auto-detection, lazy module loaders, command dispatch switch, `--help` handling
- Depends on: `src/lib/constants.js` (COMMAND_HELP), `src/lib/output.js` (error)
- Used by: `src/index.js`
- Key pattern: 13 lazy loaders (`lazyState()`, `lazyRoadmap()`, etc.) that cache module references in `_modules` object

**Command Modules (src/commands/*.js):**
- Purpose: Implement CLI command logic — each module groups related commands (e.g., all `state` subcommands in one file)
- Location: `src/commands/` (13 files)
- Contains: `cmd*()` exported functions, each implementing one CLI subcommand
- Depends on: `src/lib/*` utilities; some commands cross-import from sibling command modules
- Used by: `src/router.js` via lazy loading
- Key files:
  - `src/commands/init.js` (1743 lines) — compound initialization commands that aggregate context for workflows
  - `src/commands/verify.js` (2089 lines) — verification suite (plan structure, completeness, regressions, quality)
  - `src/commands/features.js` (2016 lines) — slash-command implementations (session-diff, velocity, context-budget, etc.)
  - `src/commands/misc.js` (1431 lines) — utility commands (template, config, commit, frontmatter, scaffold, etc.)
  - `src/commands/codebase.js` (1220 lines) — codebase analysis/intel commands
  - `src/commands/env.js` (1177 lines) — environment/runtime detection
  - `src/commands/intent.js` (1625 lines) — INTENT.md CRUD, drift detection, traceability
  - `src/commands/state.js` (716 lines) — STATE.md read/write/patch
  - `src/commands/phase.js` (901 lines) — phase lifecycle (add/insert/remove/complete)
  - `src/commands/worktree.js` (791 lines) — git worktree management for parallel execution
  - `src/commands/memory.js` (307 lines) — persistent memory stores (decisions, bookmarks, lessons, todos)
  - `src/commands/roadmap.js` (295 lines) — ROADMAP.md parsing and updates
  - `src/commands/mcp.js` (405 lines) — MCP server profiling and management

**Library Layer (src/lib/*.js):**
- Purpose: Shared utilities with zero cross-dependencies between lib modules (except output.js as the base dependency)
- Location: `src/lib/` (11 files)
- Contains: Pure functions, parsers, caches, git wrapper, formatting primitives
- Depends on: Node.js builtins only (fs, path, child_process, os, crypto)
- Used by: All command modules
- Key files:
  - `src/lib/output.js` (196 lines) — **Foundation module**: `output()`, `error()`, `debugLog()`, `status()`, field filtering, tmpfile fallback. Every other module imports from here.
  - `src/lib/helpers.js` (946 lines) — **Core utilities**: file caching (`cachedReadFile`, `cachedReaddirSync`), phase tree scanning (`getPhaseTree`), phase lookup, milestone parsing, intent parsing, @ reference extraction
  - `src/lib/config.js` (76 lines) — Config loading from `.planning/config.json` with schema defaults and nested path resolution
  - `src/lib/constants.js` (1088 lines) — `MODEL_PROFILES`, `CONFIG_SCHEMA`, `COMMAND_HELP` (most content is help text strings)
  - `src/lib/frontmatter.js` (166 lines) — Custom YAML frontmatter parser optimized for GSD planning files (extract, reconstruct, splice)
  - `src/lib/format.js` (431 lines) — TTY-aware terminal formatting: color, tables, progress bars, section headers, banners, symbols
  - `src/lib/git.js` (29 lines) — Shell-free git execution via `execFileSync('git', args)`
  - `src/lib/regex-cache.js` (83 lines) — LRU-bounded regex cache + pre-compiled patterns
  - `src/lib/codebase-intel.js` (570 lines) — File walking, language detection, staleness checking, incremental analysis
  - `src/lib/deps.js` (697 lines) — Multi-language import parsing (JS/TS/Python/Go/Elixir/Rust), dependency graph, cycle detection (Tarjan's SCC), impact analysis (BFS)
  - `src/lib/conventions.js` (644 lines) — Naming pattern detection, file organization analysis, framework-specific convention extraction
  - `src/lib/lifecycle.js` (569 lines) — Lifecycle ordering DAG (migration chains, Elixir/Phoenix boot order)
  - `src/lib/context.js` (97 lines) — Token estimation via `tokenx` with char/4 fallback, budget checking

**Workflow/Prompt Layer (workflows/*.md, commands/*.md):**
- Purpose: Markdown prompt files that AI agents follow; they call `gsd-tools` via shell commands
- Location: `workflows/` (44 files), `commands/` (11 files)
- Contains: Agent instructions, tool call patterns, decision trees
- Depends on: `bin/gsd-tools.cjs` (invoked via Bash tool)
- Used by: AI coding assistants (Claude Code, OpenCode) as slash commands and agent workflows

**Template Layer (templates/*.md):**
- Purpose: Document scaffolds filled programmatically by `template fill` command
- Location: `templates/` (28 entries including subdirs)
- Contains: Markdown templates with placeholder fields for PLAN.md, SUMMARY.md, ROADMAP.md, STATE.md, etc.
- Used by: `src/commands/misc.js` (cmdTemplateFill, cmdTemplateSelect)

**Reference Layer (references/*.md):**
- Purpose: Supplementary documentation loaded by workflows via `extract-sections` command
- Location: `references/` (13 files)
- Contains: Git integration guides, verification patterns, model profiles, TDD workflows
- Used by: Workflows that need reference material beyond the main prompt

## Data Flow

**Command Execution Flow:**

1. User/agent invokes `gsd-tools <command> [subcommand] [args] [--flags]`
2. `src/index.js` → `src/router.js:main()` parses argv
3. Global flags extracted: `--pretty`, `--verbose`, `--compact`, `--fields`, `--manifest`, `--raw`
4. Output mode set: `global._gsdOutputMode` = `'json'` (piped) | `'formatted'` (TTY) | `'pretty'` (forced)
5. Router switch dispatches to lazy-loaded command module: `lazyState().cmdStateGet(cwd, field, raw)`
6. Command reads `.planning/` files (via `cachedReadFile` or `fs.readFileSync`)
7. Command processes data, optionally writes back to `.planning/` files
8. Command calls `output(result, raw)` or `output(result, { formatter: fn })`
9. `output()` routes to JSON (stdout) or formatted (stdout via formatter), then `process.exit(0)`

**Init Compound Command Flow (critical path):**

1. Agent invokes `gsd-tools init execute-phase 03`
2. `cmdInitExecutePhase` aggregates: state, config, phase info, roadmap section, plan details, codebase context, environment, worktree info
3. Single JSON response returned containing all context needed for the execute-phase workflow
4. If `--compact`, output is trimmed 38-50% by removing non-essential fields
5. If `--manifest`, a context manifest is included telling the agent which files to load for remaining context

**Codebase Analysis Flow:**

1. `gsd-tools codebase analyze` triggers `cmdCodebaseAnalyze`
2. `checkStaleness()` checks git HEAD vs stored commit hash
3. If stale: `performAnalysis()` walks source dirs, analyzes files, builds language aggregates
4. If incremental mode possible: only re-analyzes changed files from `git diff`
5. Writes `codebase-intel.json` to `.planning/codebase/`
6. Subsequent commands (`codebase conventions`, `codebase deps`, `codebase impact`) read cached intel

**State Management:**
- All state lives in markdown files with structured patterns (e.g., `**Field:** value` lines in STATE.md)
- State is parsed via regex (pre-compiled in `_fieldRegexCache`)
- State updates use search-and-replace on the raw markdown content, then write back
- No ORM, no database — just `fs.readFileSync` + `fs.writeFileSync`

## Key Abstractions

**Output System (output.js):**
- Purpose: Unified output with dual-mode routing (JSON vs formatted)
- Examples: `src/lib/output.js`
- Pattern: `output(result, { formatter })` — formatter renders TTY output, JSON mode ignores it
- Large payloads (>50KB) are written to tmpfiles with `@file:/tmp/gsd-*.json` prefix

**Phase Tree (helpers.js):**
- Purpose: Single-scan directory tree of `.planning/phases/` providing all phase metadata
- Examples: `src/lib/helpers.js:getPhaseTree()`
- Pattern: Module-level cache (`_phaseTreeCache`) built once per invocation, replaces hundreds of individual `readdirSync` calls

**File Cache (helpers.js):**
- Purpose: Module-level `Map` cache for file reads within single CLI invocation
- Examples: `src/lib/helpers.js:cachedReadFile()`, `cachedReaddirSync()`
- Pattern: Read-through cache, explicit invalidation via `invalidateFileCache(path)` after writes

**Config System (config.js + constants.js):**
- Purpose: Schema-driven config with defaults, aliases, and nested path resolution
- Examples: `src/lib/config.js:loadConfig()`, `src/lib/constants.js:CONFIG_SCHEMA`
- Pattern: Schema defines type, default, description, aliases, nested path. `loadConfig()` checks flat key → nested path → aliases → default.

**Frontmatter Parser (frontmatter.js):**
- Purpose: Custom lightweight YAML frontmatter parser (not a full YAML parser)
- Examples: `src/lib/frontmatter.js:extractFrontmatter()`
- Pattern: LRU-cached (100 entries), handles the YAML subset used in planning files. Pre-compiled regex patterns.

**Detector Registries (conventions.js, lifecycle.js):**
- Purpose: Extensible plugin registries for framework detection and lifecycle ordering
- Examples: `src/lib/conventions.js:FRAMEWORK_DETECTORS[]`, `src/lib/lifecycle.js:LIFECYCLE_DETECTORS[]`
- Pattern: Array of `{ name, detect(intel), extractPatterns(intel, cwd) }` objects. Add a new framework by pushing to the array.

**Import Parser Registry (deps.js):**
- Purpose: Multi-language import parsing with resolution
- Examples: `src/lib/deps.js:IMPORT_PARSERS`
- Pattern: Map of language → parser function. Each parser returns raw specifiers, then resolution functions convert to project file paths.

## Entry Points

**CLI Entry (bin/gsd-tools.cjs):**
- Location: `bin/gsd-tools.cjs` (bundled output), source at `src/index.js`
- Triggers: `node bin/gsd-tools.cjs <command>` or `gsd-tools <command>` (via npm bin)
- Responsibilities: Parse args, dispatch command, output result, exit

**Build Entry (build.js):**
- Location: `build.js`
- Triggers: `npm run build` or `node build.js`
- Responsibilities: Bundle `src/index.js` → `bin/gsd-tools.cjs` via esbuild, run smoke test, track bundle size

**Deploy Entry (deploy.sh):**
- Location: `deploy.sh`
- Triggers: `./deploy.sh`
- Responsibilities: Build, backup current installation, copy files to `~/.config/opencode/get-shit-done/`, deploy command wrappers, smoke test

**Test Entry (bin/gsd-tools.test.cjs):**
- Location: `bin/gsd-tools.test.cjs` (13,736 lines)
- Triggers: `npm test` → `node --test bin/gsd-tools.test.cjs`
- Responsibilities: 574+ tests running against the bundled `bin/gsd-tools.cjs`

## Error Handling

**Strategy:** Fail-fast with `process.exit(1)` and stderr messages. No exceptions propagate to the caller.

**Patterns:**
- `error(message)` — writes `"Error: {message}"` to stderr, exits with code 1
- `debugLog(context, message, err)` — conditional stderr logging when `GSD_DEBUG` env var is set
- `safeReadFile(path)` — returns `null` on read failure (never throws)
- `cachedReadFile(path)` — returns `null` on cache miss + read failure
- Command handlers generally check preconditions early and call `error()` for invalid input
- Git operations via `execGit()` return `{ exitCode, stdout, stderr }` — callers check exitCode

## Cross-Cutting Concerns

**Logging:** Debug logging to stderr via `debugLog()`, gated by `GSD_DEBUG` env var. Status messages to stderr via `status()`. No log files.

**Validation:** Schema validation in `CONFIG_SCHEMA` for config. YAML frontmatter validation via `extractFrontmatter()`. State consistency checks in `cmdStateValidate()`. Plan structure verification in `cmdVerifyPlanStructure()`.

**Authentication:** Not applicable — local CLI tool, no auth layer.

**Caching:** Three-tier per-invocation caching:
1. `fileCache` (Map) — file content read cache in `helpers.js`
2. `dirCache` (Map) — directory listing cache in `helpers.js`
3. `_fmCache` (Map, LRU-100) — frontmatter parse cache in `frontmatter.js`
4. `_configCache` (Map) — config.json parse cache in `config.js`
5. `_phaseTreeCache` — complete phases directory tree in `helpers.js`
6. `_dynamicRegexCache` (Map, LRU-200) — compiled regex cache in `regex-cache.js`

**Performance:** Sub-100ms invocations for most commands. Lazy loading avoids parsing unused modules. `execFileSync('git', args)` avoids shell overhead (~2ms savings per git call). Bundle budget: 1000KB max.

---

*Architecture analysis: 2026-02-26*
