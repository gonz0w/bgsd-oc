# Architecture

**Analysis Date:** 2026-03-07

## Pattern Overview

**Overall:** Single-entry CLI with namespace-based command router, lazy-loaded command modules, and a shared library layer. All 39 source modules are bundled by esbuild into one CJS file (`bin/gsd-tools.cjs`) for zero-dependency deployment.

**Key Characteristics:**
- **Single-file bundle:** `src/` modules are bundled into `bin/gsd-tools.cjs` (~29K source lines pre-bundle) — only runtime dependency is `tokenx` (token estimation) and `acorn` (AST parsing), both bundled in
- **Namespace routing:** All commands use `namespace:command` syntax (e.g., `plan:intent create`, `verify:state get`). No legacy flat commands remain
- **Lazy module loading:** Command modules are loaded on first use via `_modules` cache object in `src/router.js`, avoiding parsing all 18 command modules when only one runs per invocation
- **Synchronous by default:** All file I/O uses `fs.readFileSync`/`fs.writeFileSync` and `execFileSync`. Only `websearch`, `profiler cache-speedup`, and esbuild's `build()` are async
- **Dual-mode output:** TTY detection routes to formatted (human-readable) or JSON (machine-parseable) output automatically. `--pretty` forces formatted mode when piped

## Module Dependency Direction

**Layer 0 — Foundation (no internal dependencies):**
- `src/lib/profiler.js` — Performance timing (zero-cost when `GSD_PROFILE` unset)
- `src/lib/regex-cache.js` — LRU regex compilation cache
- `src/lib/constants.js` — Config schema, model profiles, command help text

**Layer 1 — Core Output:**
- `src/lib/output.js` — `output()`, `error()`, `debugLog()`, `status()`, field filtering, tmpfile fallback
- `src/lib/format.js` — ANSI color, tables, progress bars, banners (NO_COLOR aware)

**Layer 2 — Config & Parsing:**
- `src/lib/config.js` → depends on `output`, `constants`
- `src/lib/frontmatter.js` — YAML frontmatter parser with parse cache
- `src/lib/context.js` → depends on `output`, `profiler`; lazy-loads `tokenx`

**Layer 3 — Infrastructure:**
- `src/lib/helpers.js` → depends on `output`, `config`, `constants`, `regex-cache`, `profiler`; lazy-loads `cache`. Central utility module with file I/O, phase tree scanning, intent parsing
- `src/lib/git.js` → depends on `output`, `profiler`. Shell-free git via `execFileSync`
- `src/lib/cache.js` — SQLite-backed persistent cache (Node.js v22.5+ `node:sqlite`)

**Layer 4 — Analysis:**
- `src/lib/codebase-intel.js` → depends on `output`, `git`, `helpers`. File scanning, language detection, import analysis
- `src/lib/ast.js` → depends on `codebase-intel`, `profiler`. AST extraction via acorn with TypeScript stripping
- `src/lib/deps.js` → depends on `output`, `codebase-intel`. Multi-language import parsing and dependency graph
- `src/lib/conventions.js` → depends on `codebase-intel`. Naming pattern detection, style analysis
- `src/lib/lifecycle.js` → depends on `output`, `deps`. Migration/seed/boot ordering detection
- `src/lib/orchestration.js` → depends on `output`, `frontmatter`, `format`. Task XML parsing, plan classification

**Layer 5 — Subdirectory modules:**
- `src/lib/recovery/stuck-detector.js` — Loop detection for stuck execution patterns
- `src/lib/review/severity.js` — Review finding severity classification

**Layer 6 — Commands (depend on lib/ modules, never on each other except targeted cross-imports):**
- 18 command modules in `src/commands/` (see STRUCTURE.md for details)
- Notable cross-command imports: `init.js` imports from `intent.js`, `env.js`, `codebase.js`, `worktree.js`; `features.js` imports `verify.js`'s `parseAssertionsMd`

**Layer 7 — Router & Entry:**
- `src/router.js` → depends on `constants`, `output`; lazy-loads all command modules + `git`, `orchestration`
- `src/index.js` → depends on `router.js` only. 5-line entry point

**Dependency Rules:**
- lib/ modules never import from commands/
- Commands import from lib/ and occasionally from other commands
- router.js lazy-loads everything; nothing imports router.js except index.js

## Command Routing

**Namespace Architecture (router.js, 930 lines):**

The CLI uses a `namespace:command` pattern with 7 namespaces:

| Namespace | Purpose | Lazy Loaders |
|-----------|---------|--------------|
| `init` | Workflow initialization (context gathering for agents) | `lazyInit()` |
| `plan` | Planning operations (intent, roadmap, phases, milestones) | `lazyIntent()`, `lazyRoadmap()`, `lazyPhase()`, `lazyMisc()` |
| `execute` | Execution operations (commit, worktree, TDD, trajectory) | `lazyMisc()`, `lazyFeatures()`, `lazyWorktree()`, `lazyTrajectory()` |
| `verify` | Verification & validation (state, assertions, search) | `lazyState()`, `lazyVerify()`, `lazyFeatures()`, `lazyMisc()` |
| `util` | Utilities (config, env, memory, codebase, templates, git) | Multiple loaders |
| `research` | RAG research pipeline (YouTube, NLM, collection) | `lazyResearch()` |
| `cache` | Cache management (status, clear, warm, research) | `lazyCache()` |

**Routing Flow:**
1. `process.argv` → parse global flags (`--pretty`, `--verbose`, `--fields`, `--manifest`, `--no-cache`)
2. Split command on first colon: `plan:intent` → namespace=`plan`, remaining=`intent`
3. Switch on namespace → switch on subcommand → call specific `cmd*()` function
4. Each `cmd*()` function receives `(cwd, ...args, raw)` and calls `output(result, raw)` to emit

**Output Modes:**
- `json` (default when piped) — JSON to stdout, field filtering via `--fields`, tmpfile fallback for >50KB
- `formatted` (default on TTY) — Human-readable via formatter functions using `src/lib/format.js`
- `pretty` (forced via `--pretty`) — Same as formatted, even when piped

## Data Flow

**CLI Invocation Flow:**
```
process.argv → router.js main()
  ├── Parse global flags (--pretty, --verbose, --fields, --manifest, --no-cache)
  ├── Extract namespace:command
  ├── Start profiler timer (if GSD_PROFILE=1)
  ├── Lazy-load target command module
  ├── Call cmd*() function with (cwd, args, raw)
  │   ├── Read .planning/ files via cachedReadFile() or safeReadFile()
  │   ├── Parse markdown/frontmatter/YAML
  │   ├── Perform computation (validation, analysis, git ops)
  │   └── Call output(result, options) → JSON or formatted to stdout
  └── process.exit(0)
```

**File I/O Pattern:**
- `cachedReadFile(path)` → checks SQLite cache → falls back to `fs.readFileSync` → populates cache
- `safeReadFile(path)` → direct `fs.readFileSync` with error handling (for guaranteed fresh reads)
- `invalidateFileCache(path)` → called after writes to ensure cache coherence
- `getPhaseTree(cwd)` → single scan of `.planning/phases/` directory tree, cached per invocation

**State Management:**
- No in-process state between invocations — each CLI call is stateless
- Persistent state lives in `.planning/STATE.md` (markdown with `**Field:** value` patterns)
- Module-level caches (`_configCache`, `_phaseTreeCache`, `_milestoneCache`, `dirCache`) live for a single CLI invocation only
- Persistent file cache uses SQLite via `src/lib/cache.js` (`~/.config/oc/get-shit-done/cache.db`)

## Agent System

**Architecture:** Agents are AI model instances (Claude) that invoke `gsd-tools` as a CLI subprocess. The agent system is defined entirely in markdown files — the CLI provides structured data, agents provide intelligence.

**Agent Definitions (`agents/`):**
- `gsd-planner.md` — Creates execution plans for phases
- `gsd-executor.md` — Executes plans (writes code, runs tests)
- `gsd-verifier.md` — Verifies completed work against criteria
- `gsd-roadmapper.md` — Builds and refines project roadmaps
- `gsd-phase-researcher.md` — Researches requirements for a phase
- `gsd-project-researcher.md` — Project-level research
- `gsd-debugger.md` — Diagnoses issues and stuck states
- `gsd-plan-checker.md` — Reviews plan quality before execution
- `gsd-codebase-mapper.md` — Analyzes codebase structure (this agent)

**Agent Invocation Pattern:**
1. User runs slash command (e.g., `/bgsd-plan-phase`)
2. Command file (`commands/bgsd-plan-phase.md`) defines the workflow
3. Workflow file (`workflows/plan-phase.md`) orchestrates the agent
4. Agent calls `gsd-tools init:plan-phase <phase>` to gather context
5. Agent reads the structured JSON output and performs its task
6. Agent calls additional `gsd-tools` commands as needed

**Model Profile Resolution:**
- Configured in `.planning/config.json` via `model_profile` (quality/balanced/budget)
- Per-agent model mapping in `src/lib/constants.js` `MODEL_PROFILES` table
- Per-agent overrides via `config.json` `model_overrides` object
- Resolved by `resolveModelInternal()` in `src/lib/helpers.js`

## Key Design Decisions

**Single-File Bundle:**
- All source bundled into one `bin/gsd-tools.cjs` via esbuild
- Enables atomic deployment: copy one file, everything works
- Bundle size tracked with 1500KB budget (enforced in `build.js`)
- npm dependencies (`tokenx`, `acorn`) are bundled in; Node.js builtins are external

**Synchronous I/O:**
- All file and git operations use sync APIs (`readFileSync`, `execFileSync`)
- Simplifies control flow — no async/await propagation through the call stack
- Acceptable because each CLI invocation runs one command and exits
- Only exceptions: web search (`cmdWebsearch`), profiler cache-speedup, and the build script itself

**Markdown as Data Store:**
- Planning state lives in `.planning/*.md` files (ROADMAP.md, STATE.md, phase PLANs, SUMMARYs)
- Custom YAML frontmatter parser (`src/lib/frontmatter.js`) — not a full YAML parser, handles the subset used
- Regex-based field extraction from markdown patterns (`**Field:** value`)
- Human-readable AND machine-parseable — agents can read/write these files directly

**Performance Tuning:**
- Lazy module loading in router.js (only load what's needed)
- SQLite-backed file cache with mtime-based staleness detection
- Module-level caches for config, phase tree, milestone info, directory listings
- LRU regex cache to avoid repeated `new RegExp()` in hot paths
- Profiler opt-in via `GSD_PROFILE=1` with baseline comparison support
- `getPhaseTree()` replaces N individual `readdirSync` calls with one tree scan

**Compact Mode (Default):**
- `--verbose` flag disabled by default (`global._gsdCompactMode = true`)
- Commands emit minimal JSON by default, full detail with `--verbose`
- `--manifest` flag adds context manifest for token budget tracking

## Error Handling

**Strategy:** Fail fast with descriptive error messages to stderr.

**Patterns:**
- `error(message)` → writes to stderr and calls `process.exit(1)` — used for unrecoverable errors (missing args, invalid commands)
- `debugLog(context, message, err)` → conditional stderr output when `GSD_DEBUG=1` — used for diagnosable failures
- `safeReadFile()` returns `null` on read failure instead of throwing — callers check for null
- Git operations via `execGit()` return `{ exitCode, stdout, stderr }` — callers check `exitCode`

## Cross-Cutting Concerns

**Logging:** No logging framework. `debugLog()` writes to stderr when `GSD_DEBUG=1`. `status()` writes progress messages to stderr (visible even when stdout is piped).

**Validation:** Input validation happens at command entry points. Schema validation for config via `CONFIG_SCHEMA` in constants. Frontmatter validation via custom parser. Plan structure validation via `verify` commands.

**Authentication:** Not applicable — CLI tool runs locally with user's filesystem permissions.

**Caching:** Three-tier caching strategy:
1. Module-level Maps (single invocation): config, phase tree, milestone info, directory listings
2. Frontmatter parse cache (module-level Map, LRU-bounded at 100 entries)
3. SQLite persistent cache (`cache.db`): file contents with mtime-based invalidation

---

*Architecture analysis: 2026-03-07*
