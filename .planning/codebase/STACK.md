# Technology Stack

**Analysis Date:** 2026-03-07

## Languages

**Primary:**
- JavaScript (CommonJS) — All source code in `src/`, build script, tests

**Secondary:**
- Markdown — Workflow definitions (`workflows/`), command wrappers (`commands/`), templates (`templates/`), reference docs (`references/`)
- Bash — Deploy script (`deploy.sh`)

## Runtime

**Environment:**
- Node.js >= 18 (declared in `package.json` engines field)
- Build target: `node18` (esbuild config in `build.js`)
- Node.js v22.5+ required for SQLite cache backend (`node:sqlite` built-in)
- Graceful fallback: in-memory Map cache when `node:sqlite` unavailable
- No TypeScript — pure JavaScript with `'use strict'` throughout
- Uses `node:perf_hooks` for opt-in performance profiling

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- None — zero-framework architecture. Pure Node.js standard library (`fs`, `path`, `child_process`, `os`, `crypto`, `process`).

**Testing:**
- Node.js built-in test runner (`node --test`) — configured in `package.json` as `npm test`
- No external test framework (jest, vitest, mocha — none used)
- 812 tests total: 767 in `bin/gsd-tools.test.cjs` (~18,125 lines) + 45 in `bin/format.test.cjs`

**Build/Dev:**
- esbuild ^0.27.3 (devDependency) — Bundles source modules into single `bin/gsd-tools.cjs`

**Auditing:**
- knip ^5.85.0 — Dead code / unused export detection (`npm run audit:dead-code`)
- madge ^8.0.0 — Circular dependency detection (`npm run audit:circular`)
- Custom scripts: `audit-exports.js`, `audit-commands.js`

## Key Dependencies

**Runtime (bundled into output):**
- `tokenx` ^1.3.0 — Fast token estimation at ~96% accuracy. Used in `src/lib/context.js` for context window budget calculations. Lazy-loaded with fallback to `Math.ceil(text.length / 4)` if unavailable.
- `acorn` ^8.16.0 — JavaScript AST parser. Used in `src/lib/ast.js` for extracting function/class/method signatures from JS/TS source files. Powers `codebase ast`, `codebase exports`, and `codebase complexity` commands.

**Dev Only:**
- `esbuild` ^0.27.3 — JavaScript bundler
- `knip` ^5.85.0 — Unused export/file detection
- `madge` ^8.0.0 — Circular dependency analysis

**Critical design constraint:** This project is explicitly designed as a "zero-dependency" CLI. `tokenx` and `acorn` are the two runtime dependencies and are bundled into the output. The built artifact `bin/gsd-tools.cjs` has no external `node_modules` requirements.

## Build System

**Entry point:** `src/index.js`
**Output:** `bin/gsd-tools.cjs` (CJS format, ~1,163KB)
**Bundle budget:** 1,500KB hard limit enforced in `build.js`
**Bundle size tracking:** Writes to `.planning/baselines/bundle-size.json` on each build

**Build process (`build.js`):**
1. esbuild bundles `src/index.js` → `bin/gsd-tools.cjs`
2. Custom `strip-shebang` plugin removes source shebangs to avoid duplicates
3. Adds `#!/usr/bin/env node` banner
4. Node.js built-ins externalized (not bundled), npm deps (tokenx, acorn) bundled
5. Smoke test: runs `node bin/gsd-tools.cjs util:current-timestamp --raw`
6. Bundle size check against 1,500KB budget — fails build if exceeded
7. Metafile analysis: per-module byte attribution, grouped by directory
8. Warns on individual source files >50KB in output
9. Manifest generation: lists all deployable files to `bin/manifest.json`

**Build command:**
```bash
npm run build    # node build.js
```

**Audit commands:**
```bash
npm run audit:dead-code     # knip: unused exports/files
npm run audit:circular      # madge: circular dependencies
npm run audit:commands      # custom: command coverage check
npm run audit:exports       # custom: export usage audit
npm run audit:all           # all audits combined
```

**Key esbuild settings:**
- `platform: 'node'`, `format: 'cjs'`, `target: 'node18'`
- `minify: false` — keeps output readable for debugging
- `sourcemap: false`
- `metafile: true` — enables per-module size attribution
- Externals: all Node.js built-ins (`node:*`, `fs`, `path`, `os`, `child_process`, `crypto`, `util`, `stream`, `events`, `buffer`, `url`, `http`, `https`, `net`, `tls`, `zlib`)

## Source Architecture

**Module count:** 39 source files (18 command modules + 19 lib modules + router + index)
**Total source lines:** ~29,600
**Test lines:** ~18,125 (`bin/gsd-tools.test.cjs`)

**Source layout:**
- `src/index.js` — Entry point (5 lines, calls router)
- `src/router.js` — CLI argument parser and namespace-based command dispatch (930 lines)
- `src/commands/` — 18 command modules (lazy-loaded via `_modules` map in router)
- `src/lib/` — 16 shared library modules (including `recovery/` and `review/` subdirs)

**Command modules (src/commands/):**
- `agent.js` — Agent audit, list, contract validation
- `cache.js` — Cache status, clear, warm operations
- `codebase.js` — Codebase analysis, AST, deps, impact, conventions, repo-map
- `env.js` — Environment scanning and detection engine
- `features.js` — Session diff/summary, velocity, context budget, search, test-run
- `init.js` — Compound initialization for workflows (plan-phase, execute-phase, etc.)
- `intent.js` — Intent tracking (create, show, update, validate, trace, drift)
- `mcp.js` — MCP server discovery, token cost profiling, relevance scoring
- `memory.js` — Persistent memory stores (write, read, list, compact)
- `misc.js` — Commits, templates, frontmatter, websearch, TDD, review, progress
- `phase.js` — Phase CRUD, milestone operations, requirements marking
- `profiler.js` — Performance profile comparison, cache speedup measurement
- `research.js` — RAG research pipeline (yt-search, yt-transcript, collect, NotebookLM)
- `roadmap.js` — Roadmap analysis and phase extraction
- `state.js` — STATE.md read/write, progress tracking, metrics, decisions, blockers
- `trajectory.js` — Trajectory checkpoints, pivots, comparisons, dead-end tracking
- `verify.js` — Plan structure, phase completeness, reference, artifact verification
- `worktree.js` — Git worktree create/list/remove/merge/cleanup

**Library modules (src/lib/):**
- `ast.js` — AST parsing via acorn with TypeScript stripping (1,199 lines)
- `cache.js` — SQLite-backed persistent cache with Map fallback (629 lines)
- `codebase-intel.js` — Multi-language codebase analysis (591 lines)
- `config.js` — Config loading with schema, caching, git-ignore checks (76 lines)
- `constants.js` — Model profiles, config schema, command help text (906 lines)
- `context.js` — Token estimation, context assembly, budget management (397 lines)
- `conventions.js` — Naming pattern detection, convention inference (640 lines)
- `deps.js` — Multi-language import parsing and dependency graph (695 lines)
- `format.js` — TTY-aware formatting, colors, tables, progress bars (431 lines)
- `frontmatter.js` — Custom YAML frontmatter parser (166 lines)
- `git.js` — Git command execution wrapper, structured log, blame, diff (401 lines)
- `helpers.js` — File I/O, cached reads, phase discovery, model resolution (1,024 lines)
- `lifecycle.js` — Migration/boot/config lifecycle detection (569 lines)
- `orchestration.js` — Task XML parsing, plan classification (528 lines)
- `output.js` — JSON/TTY output routing, field filtering, tmp file management (196 lines)
- `profiler.js` — Opt-in performance timing via `node:perf_hooks` (116 lines)
- `recovery/stuck-detector.js` — Agent stuck loop detection (229 lines)
- `regex-cache.js` — LRU regex compilation cache (75 lines)
- `review/severity.js` — Code review severity classification (139 lines)

## Key Patterns

**Lazy loading:** All 18 command modules lazy-loaded on first use via `_modules` map in `src/router.js`. Only the invoked command's module gets parsed per CLI call.

**Namespace routing:** Commands use `namespace:subcommand` syntax (e.g., `plan:intent create`, `verify:state get`). Seven namespaces: `init`, `plan`, `execute`, `verify`, `util`, `research`, `cache`.

**Dual output mode:** All commands produce both formatted (TTY) and JSON (piped) output. Each command handler accepts a `raw` flag and passes a `{ formatter }` function to `output()`. The `output()` function in `src/lib/output.js` routes to the appropriate format.

**Global flags:** `--pretty`, `--raw`, `--fields`, `--verbose`, `--compact`, `--manifest`, `--no-cache` — parsed in router before command dispatch and set via `global._gsd*` properties.

**Performance profiling:** Opt-in via `GSD_PROFILE=1`. Uses `node:perf_hooks` with zero overhead when disabled. Writes timing baselines to `.planning/baselines/`.

**Persistent cache:** SQLite-backed (via `node:sqlite` in Node 22.5+) with in-memory Map fallback. Provides mtime-based staleness detection for file reads. Located at `~/.config/oc/get-shit-done/cache.db`.

## Configuration

**Project configuration:**
- `package.json` — npm package manifest, scripts, engines
- `build.js` — esbuild build configuration with metafile analysis
- `.gitignore` — Ignores `node_modules/` and `bin/gsd-tools.cjs` (built artifact)
- `VERSION` — Semver version file (currently `1.20.5`)

**Runtime configuration (per-project):**
- `.planning/config.json` — GSD workflow configuration per target project
- Schema defined in `src/lib/constants.js` (`CONFIG_SCHEMA`)
- Key settings: `model_profile`, `commit_docs`, `branching_strategy`, `brave_search`, `mode`, `context_window`, `context_target_percent`, `test_commands`, `test_gate`, `rag_enabled`, `rag_timeout`, `ytdlp_path`, `nlm_path`, `mcp_config_path`
- Config template: `templates/config.json`
- Lookup priority: flat key → nested path → aliases → default

**Environment variables:**
- `GSD_DEBUG` — Enable debug logging to stderr
- `GSD_PROFILE` — Enable performance profiling (`=1`)
- `GSD_NO_TMPFILE` — Skip large JSON tmpfile redirect
- `GSD_CACHE_FORCE_MAP` — Force Map fallback for cache (test parity)
- `BRAVE_API_KEY` — Brave Search API key (optional, for websearch command)
- `HOME` / `USERPROFILE` — Home directory (for config discovery)
- `XDG_CONFIG_HOME` — XDG base directory for cache DB location
- `NO_COLOR` — Disable ANSI color output (no-color.org standard)
- `FORCE_COLOR` — Force ANSI color even in non-TTY

**Output modes (auto-detected):**
- TTY → `formatted` (human-readable with ANSI colors)
- Piped → `json` (structured JSON to stdout)
- `--pretty` flag → force formatted output when piped

## Deployment

**Target:** `~/.config/opencode/get-shit-done/` (host editor plugin directory)

**Deploy process (`deploy.sh`):**
1. Runs `npm run build`
2. Backs up current installation and command directory
3. Manifest-based file sync: reads `bin/manifest.json` for deployable files
4. Copies `bin/`, `workflows/`, `templates/`, `references/`, `src/`, `VERSION`
5. Copies command wrappers (`commands/bgsd-*.md`) to `~/.config/opencode/command/`
6. Copies agent definitions (`agents/gsd-*.md`) to `~/.config/opencode/agents/`
7. Smoke test on deployed artifact
8. Rollback on smoke test failure
9. Cleans up files removed from manifest

**Platform requirements:**
- Linux/macOS (Bash deploy script)
- Node.js >= 18 (Node.js >= 22.5 for SQLite cache)
- Git (used extensively for commit operations, worktree management, file history)

---

*Stack analysis: 2026-03-07*
