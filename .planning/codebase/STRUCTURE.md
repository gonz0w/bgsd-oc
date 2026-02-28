# Codebase Structure

**Analysis Date:** 2026-02-26

## Directory Layout

```
bgsd-oc/
├── bin/                    # Built artifacts and tests
│   ├── gsd-tools.cjs      # Bundled CLI (single-file, ~17K lines)
│   ├── gsd-tools.test.cjs # Test suite (~13.7K lines, 574+ tests)
│   └── format.test.cjs    # Format module tests
├── src/                    # Source modules (bundled into bin/gsd-tools.cjs)
│   ├── index.js            # Entry point (5 lines, just calls router)
│   ├── router.js           # Command dispatch + global flag parsing
│   ├── commands/           # Command implementations (13 files)
│   │   ├── codebase.js     # Codebase analysis commands
│   │   ├── env.js          # Environment detection commands
│   │   ├── features.js     # Slash-command implementations
│   │   ├── init.js         # Compound context-loading commands
│   │   ├── intent.js       # INTENT.md CRUD + drift detection
│   │   ├── mcp.js          # MCP server profiling
│   │   ├── memory.js       # Persistent memory store commands
│   │   ├── misc.js         # Utility commands (config, template, commit, etc.)
│   │   ├── phase.js        # Phase lifecycle (add/insert/remove/complete)
│   │   ├── roadmap.js      # ROADMAP.md parsing and updates
│   │   ├── state.js        # STATE.md read/write/patch
│   │   ├── verify.js       # Verification suite (plan structure, quality, etc.)
│   │   └── worktree.js     # Git worktree management
│   └── lib/                # Shared library modules (11 files)
│       ├── output.js       # Output routing, error handling, debug logging
│       ├── helpers.js      # File caching, phase tree, phase lookup, intent parsing
│       ├── config.js       # Config loading with schema defaults
│       ├── constants.js    # Model profiles, config schema, command help text
│       ├── frontmatter.js  # Custom YAML frontmatter parser
│       ├── format.js       # TTY formatting: color, tables, progress bars
│       ├── git.js          # Shell-free git execution wrapper
│       ├── regex-cache.js  # LRU regex cache + pre-compiled patterns
│       ├── codebase-intel.js # File walking, language detection, staleness
│       ├── deps.js         # Multi-language import parsing + dependency graph
│       ├── conventions.js  # Naming/organization/framework detection
│       ├── lifecycle.js    # Lifecycle ordering DAG (migrations, boot order)
│       └── context.js      # Token estimation + budget checking
├── commands/               # Slash command wrappers (deployed to AI coding assistant)
│   ├── gsd-codebase-impact.md
│   ├── gsd-context-budget.md
│   ├── gsd-rollback-info.md
│   ├── gsd-search-decisions.md
│   ├── gsd-search-lessons.md
│   ├── gsd-session-diff.md
│   ├── gsd-test-run.md
│   ├── gsd-trace-requirement.md
│   ├── gsd-validate-config.md
│   ├── gsd-validate-deps.md
│   └── gsd-velocity.md
├── workflows/              # AI agent workflow definitions (44 files)
│   ├── execute-phase.md    # Main execution workflow
│   ├── plan-phase.md       # Planning workflow
│   ├── new-project.md      # New project setup workflow
│   ├── quick.md            # Quick task workflow
│   ├── resume-project.md   # Resume session workflow
│   ├── verify-work.md      # Post-execution verification
│   ├── map-codebase.md     # Codebase mapping workflow
│   ├── progress.md         # Progress overview workflow
│   ├── cmd-*.md            # Command-specific workflows (11 files)
│   └── ...                 # Other specialized workflows
├── templates/              # Document templates for scaffolding
│   ├── codebase/           # Codebase analysis templates (7 files)
│   │   ├── architecture.md
│   │   ├── conventions.md
│   │   ├── concerns.md
│   │   ├── integrations.md
│   │   ├── stack.md
│   │   ├── structure.md
│   │   └── testing.md
│   ├── plans/              # Plan type templates (3 files)
│   │   ├── execute.md
│   │   ├── tdd.md
│   │   └── discovery.md
│   ├── research-project/   # Research project templates
│   ├── roadmap.md          # ROADMAP.md template
│   ├── state.md            # STATE.md template
│   ├── config.json         # config.json template
│   ├── summary.md          # Standard SUMMARY.md template
│   ├── summary-complex.md  # Complex summary template
│   ├── summary-minimal.md  # Minimal summary template
│   ├── intent.md           # INTENT.md template
│   ├── project.md          # PROJECT.md template
│   └── ...                 # Other document templates
├── references/             # Reference documentation for agent workflows
│   ├── checkpoints.md      # Checkpoint types and guidelines
│   ├── verification-patterns.md
│   ├── git-integration.md
│   ├── model-profiles.md
│   ├── tdd.md
│   └── ...                 # Other reference docs (13 files)
├── docs/                   # Human-facing documentation
│   ├── getting-started.md
│   ├── commands.md
│   ├── architecture.md
│   └── expert-guide.md
├── .planning/              # Planning state (this project's own planning data)
│   ├── STATE.md            # Current project state
│   ├── ROADMAP.md          # Project roadmap
│   ├── INTENT.md           # Project intent
│   ├── PROJECT.md          # Project description
│   ├── MILESTONES.md       # Completed milestones
│   ├── config.json         # Project config
│   ├── phases/             # Phase directories
│   ├── milestones/         # Archived milestone data
│   ├── memory/             # Memory stores (decisions, bookmarks, etc.)
│   ├── codebase/           # Codebase analysis output
│   ├── baselines/          # Context budget baselines
│   ├── quick/              # Quick task state
│   └── research/           # Research artifacts
├── build.js                # esbuild bundler script
├── deploy.sh               # Deploy to ~/.config/opencode/
├── package.json            # Package manifest
├── AGENTS.md               # Development rules for AI agents
├── README.md               # Project README
└── VERSION                 # Version file
```

## Directory Purposes

**`src/`:**
- Purpose: All source code — bundled by esbuild into `bin/gsd-tools.cjs`
- Contains: 28 JavaScript files (CommonJS) totaling ~21K lines
- Key files: `src/router.js` (command dispatch), `src/commands/init.js` (largest command module)

**`src/lib/`:**
- Purpose: Shared library utilities used by multiple command modules
- Contains: 11 pure utility modules — parsers, caches, formatters, git wrapper
- Key files: `src/lib/helpers.js` (core utilities), `src/lib/output.js` (foundation module)
- Dependency rule: lib modules may import from other lib modules but NEVER from `src/commands/`

**`src/commands/`:**
- Purpose: Command handler implementations — each file groups related subcommands
- Contains: 13 command modules exporting `cmd*()` functions
- Key files: `src/commands/verify.js` (2089 lines, largest), `src/commands/features.js` (2016 lines)
- Dependency rule: commands may import from `src/lib/*` and from sibling commands (e.g., init imports from intent, env, codebase, worktree)

**`bin/`:**
- Purpose: Built artifacts — the bundled CLI and test file
- Contains: `gsd-tools.cjs` (bundled, ~17K lines), `gsd-tools.test.cjs` (tests, ~13.7K lines), `format.test.cjs`
- Generated: Yes (by `npm run build`)
- Committed: Yes (deployed artifact)

**`workflows/`:**
- Purpose: AI agent workflow definitions — markdown prompts that agents follow step-by-step
- Contains: 44 workflow files defining planning, execution, verification, and utility workflows
- Deployed to: `~/.config/opencode/get-shit-done/workflows/`

**`commands/`:**
- Purpose: Slash command wrappers — thin markdown files that trigger workflows
- Contains: 11 `gsd-*.md` files, each wrapping a specific slash command
- Deployed to: `~/.config/opencode/command/`

**`templates/`:**
- Purpose: Document templates filled programmatically by `gsd-tools template fill`
- Contains: 28 template files/dirs for PLAN.md, SUMMARY.md, STATE.md, ROADMAP.md, etc.
- Deployed to: `~/.config/opencode/get-shit-done/templates/`

**`references/`:**
- Purpose: Supplementary reference docs loaded by workflows at runtime via `gsd-tools extract-sections`
- Contains: 13 reference files covering git integration, verification patterns, model profiles, etc.
- Deployed to: `~/.config/opencode/get-shit-done/references/`

**`docs/`:**
- Purpose: Human-facing documentation (getting started, command reference, architecture, expert guide)
- Contains: 4 markdown files
- Not deployed — stays in repo only

**`.planning/`:**
- Purpose: This project's own planning state managed by the bGSD system
- Contains: State, roadmap, intent, config, phases, milestones, memory, codebase intel
- Special: Self-referential — the project uses itself for project management

## Key File Locations

**Entry Points:**
- `src/index.js`: Source entry point (requires router)
- `bin/gsd-tools.cjs`: Built CLI entry point (single-file bundle)
- `build.js`: Build script entry point (esbuild config)
- `deploy.sh`: Deployment script

**Configuration:**
- `package.json`: Package manifest (name, scripts, dependencies)
- `.planning/config.json`: Per-project GSD configuration
- `src/lib/constants.js`: CONFIG_SCHEMA (config key definitions and defaults)
- `templates/config.json`: Default config template for new projects

**Core Logic:**
- `src/router.js`: Command routing and global flag parsing
- `src/commands/init.js`: Compound init commands (execute-phase, plan-phase, resume, etc.)
- `src/commands/verify.js`: Verification suite (plan structure, quality, regressions)
- `src/commands/state.js`: STATE.md CRUD operations
- `src/lib/helpers.js`: Phase tree, file caching, intent/milestone parsing

**Testing:**
- `bin/gsd-tools.test.cjs`: Main test suite (574+ tests)
- `bin/format.test.cjs`: Format module tests

**Output/Formatting:**
- `src/lib/output.js`: `output()`, `error()`, `debugLog()`, `status()`
- `src/lib/format.js`: Color, tables, progress bars, section headers, banners

## Naming Conventions

**Files:**
- Source files: `kebab-case.js` — e.g., `codebase-intel.js`, `regex-cache.js`
- Command files: `kebab-case.js` matching command domain — e.g., `state.js`, `verify.js`, `worktree.js`
- Workflow files: `kebab-case.md` — e.g., `execute-phase.md`, `verify-work.md`
- Slash commands: `gsd-kebab-case.md` — e.g., `gsd-velocity.md`, `gsd-test-run.md`
- Templates: `kebab-case.md` or `PascalCase.md` for document type templates

**Functions:**
- Command handlers: `cmd<PascalCaseName>(cwd, args, raw)` — e.g., `cmdStateGet()`, `cmdInitExecutePhase()`
- Formatters: `format<PascalCaseName>(result)` — e.g., `formatStateShow()`, `formatCodebaseAnalyze()`
- Internal helpers: `camelCase` — e.g., `findPhaseInternal()`, `resolveModelInternal()`, `normalizePhaseName()`
- Lazy loaders: `lazy<PascalCaseName>()` — e.g., `lazyState()`, `lazyVerify()`

**Exports:**
- Every module uses `module.exports = { ... }` (CommonJS)
- Command modules export only `cmd*()` functions (and occasionally shared helpers)
- Lib modules export utility functions and constants

**Directories:**
- `kebab-case` for functional groupings — `src/lib/`, `src/commands/`
- `kebab-case` for template subdirs — `templates/plans/`, `templates/codebase/`

## Where to Add New Code

**New CLI Command:**
1. Determine which command module owns the domain (state, verify, features, misc, etc.)
2. Add `cmd<Name>(cwd, args, raw)` function to the appropriate `src/commands/*.js` file
3. Add case to `src/router.js` switch statement with lazy loader
4. Add help text to `COMMAND_HELP` in `src/lib/constants.js`
5. Add tests to `bin/gsd-tools.test.cjs`
6. Run `npm run build` to bundle

**New Command Module (new domain):**
1. Create `src/commands/<domain>.js` with `cmd*()` exports
2. Add lazy loader function in `src/router.js`: `function lazy<Domain>() { return _modules.<domain> || (_modules.<domain> = require('./commands/<domain>')); }`
3. Add switch cases in `src/router.js` for the new commands
4. Add help text to `COMMAND_HELP`

**New Library Module:**
1. Create `src/lib/<name>.js` with pure utility functions
2. Export via `module.exports = { ... }`
3. Import in command modules as needed: `const { fn } = require('../lib/<name>')`
4. NEVER import from `src/commands/` — lib modules must not depend on command layer

**New Workflow:**
1. Create `workflows/<workflow-name>.md` with agent instructions
2. If it needs a slash command wrapper, create `commands/gsd-<name>.md`
3. If it needs an init compound command, add `cmdInit<Name>()` to `src/commands/init.js`
4. Add init case to `src/router.js`

**New Template:**
1. Create `templates/<name>.md` (or in appropriate subdir like `templates/plans/`)
2. Register in `cmdTemplateSelect()` / `cmdTemplateFill()` in `src/commands/misc.js`

**New Framework Detector:**
1. Add detector object to `FRAMEWORK_DETECTORS[]` in `src/lib/conventions.js`
2. Implement `{ name, detect(intel), extractPatterns(intel, cwd) }` interface
3. Patterns are automatically picked up by `extractConventions()`

**New Lifecycle Detector:**
1. Add detector object to `LIFECYCLE_DETECTORS[]` in `src/lib/lifecycle.js`
2. Implement `{ name, detect(intel), extractLifecycle(intel, cwd) }` interface

**New Import Parser (for dependency analysis):**
1. Add parser function to `src/lib/deps.js` following the `parseJavaScript()` pattern
2. Register in `IMPORT_PARSERS` map: `'<language>': parse<Language>`
3. Add resolution function: `resolve<Language>Import(specifier, fromFile, fileSet)`

## Special Directories

**`bin/`:**
- Purpose: Built artifacts (bundled CLI + tests)
- Generated: Yes (by `npm run build`)
- Committed: Yes — the deployed artifact must be committed

**`.planning/`:**
- Purpose: Planning state for this project (self-referential)
- Generated: Partially (codebase-intel.json is generated; STATE.md, ROADMAP.md are managed)
- Committed: Mostly (except `.planning/.cache/` and `env-manifest.json` which are gitignored)

**`node_modules/`:**
- Purpose: npm dependencies (only `esbuild` devDep + `tokenx` dep)
- Generated: Yes
- Committed: No

**`.planning/memory/`:**
- Purpose: Persistent memory stores — JSON arrays of decisions, bookmarks, lessons, todos
- Generated: Yes (by `gsd-tools memory write`)
- Committed: Yes

**`.planning/baselines/`:**
- Purpose: Context budget baselines and bundle size records
- Generated: Yes (by `gsd-tools context-budget baseline` and `npm run build`)
- Committed: Yes

**`.planning/codebase/`:**
- Purpose: Codebase analysis output (intel JSON) and human-authored analysis docs (this file)
- Generated: Partially (codebase-intel.json is auto-generated; .md files are authored)
- Committed: Yes

---

*Structure analysis: 2026-02-26*
