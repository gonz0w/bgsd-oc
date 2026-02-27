# Technology Stack

**Analysis Date:** 2026-02-26

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
- No TypeScript — pure JavaScript with `'use strict'` throughout

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- None — zero-framework architecture. Pure Node.js standard library (`fs`, `path`, `child_process`, `os`, `crypto`, `process`).

**Testing:**
- Node.js built-in test runner (`node --test`) — configured in `package.json` as `npm test`
- No external test framework (jest, vitest, mocha — none used)

**Build/Dev:**
- esbuild ^0.27.3 (devDependency) — Bundles 18 source modules into single `bin/gsd-tools.cjs`

## Key Dependencies

**Runtime (production):**
- `tokenx` ^1.3.0 — Fast token estimation at 96% accuracy in a 2KB bundle. Used in `src/lib/context.js` for context window budget calculations. Lazy-loaded with fallback to `Math.ceil(text.length / 4)` if unavailable.

**Dev:**
- `esbuild` ^0.27.3 — JavaScript bundler. Bundles `src/index.js` entry point into `bin/gsd-tools.cjs` as a single CJS file.

**Critical design constraint:** This project is explicitly designed as a "zero-dependency" CLI. `tokenx` is the sole runtime dependency and is bundled into the output. The built artifact `bin/gsd-tools.cjs` has no external `node_modules` requirements.

## Build System

**Entry point:** `src/index.js`
**Output:** `bin/gsd-tools.cjs` (CJS format, ~269KB, 17K lines)
**Bundle budget:** 1000KB hard limit enforced in `build.js`
**Bundle size tracking:** Writes to `.planning/baselines/bundle-size.json` on each build

**Build process (`build.js`):**
1. esbuild bundles `src/index.js` → `bin/gsd-tools.cjs`
2. Custom `strip-shebang` plugin removes source shebangs to avoid duplicates
3. Adds `#!/usr/bin/env node` banner
4. Node.js built-ins externalized (not bundled), npm deps (tokenx) bundled
5. Smoke test: runs `node bin/gsd-tools.cjs current-timestamp --raw`
6. Bundle size check against 1000KB budget — fails build if exceeded

**Build command:**
```bash
npm run build    # node build.js
```

**Key esbuild settings:**
- `platform: 'node'`, `format: 'cjs'`, `target: 'node18'`
- `minify: false` — keeps output readable for debugging
- `sourcemap: false`
- Externals: all Node.js built-ins (`node:*`, `fs`, `path`, `os`, `child_process`, etc.)

## Source Architecture

**Module count:** 26 source files (13 commands + 13 lib modules + router + index)
**Total source lines:** ~21,100 (excluding tests)
**Test lines:** ~14,100 (two test files in `bin/`)

**Source layout:**
- `src/index.js` — Entry point (5 lines, calls router)
- `src/router.js` — CLI argument parser and command dispatch (791 lines)
- `src/commands/` — 13 command modules (lazy-loaded)
- `src/lib/` — 13 shared library modules

**Largest modules:**
- `src/commands/verify.js` — 2,089 lines (plan/phase verification suite)
- `src/commands/features.js` — 2,016 lines (session, context, search, velocity)
- `src/commands/init.js` — 1,743 lines (compound initialization commands)
- `src/commands/intent.js` — 1,625 lines (intent tracking system)
- `src/commands/misc.js` — 1,431 lines (commits, templates, frontmatter, websearch)
- `src/commands/codebase.js` — 1,220 lines (codebase analysis commands)
- `src/commands/env.js` — 1,177 lines (environment detection engine)

## Configuration

**Project configuration:**
- `package.json` — npm package manifest, scripts, engines
- `build.js` — esbuild build configuration
- `.gitignore` — Ignores `node_modules/` and `bin/gsd-tools.cjs` (built artifact)
- `VERSION` — Semver version file (currently `1.20.5`)

**Runtime configuration (per-project):**
- `.planning/config.json` — GSD workflow configuration per target project
- Schema defined in `src/lib/constants.js` (`CONFIG_SCHEMA`)
- Key settings: `model_profile`, `commit_docs`, `branching_strategy`, `brave_search`, `mode`, `context_window`, `test_commands`, `test_gate`
- Config template: `templates/config.json`

**Environment variables:**
- `GSD_DEBUG` — Enable debug logging to stderr
- `GSD_NO_TMPFILE` — Skip large JSON tmpfile redirect
- `BRAVE_API_KEY` — Brave Search API key (optional, for websearch command)
- `HOME` / `USERPROFILE` — Home directory (for config discovery)
- `NO_COLOR` — Disable ANSI color output (no-color.org standard)
- `FORCE_COLOR` — Force ANSI color even in non-TTY

**Output modes (auto-detected):**
- TTY → `formatted` (human-readable with ANSI colors)
- Piped → `json` (structured JSON to stdout)
- `--pretty` flag → force formatted output when piped

## Deployment

**Target:** `~/.config/opencode/get-shit-done/` (OpenCode plugin directory)

**Deploy process (`deploy.sh`):**
1. Runs `npm run build`
2. Backs up current installation
3. Copies `bin/`, `workflows/`, `templates/`, `references/`, `src/`, `VERSION`
4. Copies command wrappers (`commands/gsd-*.md`) to `~/.config/opencode/command/`
5. Smoke test on deployed artifact
6. Rollback on smoke test failure

**Platform requirements:**
- Linux/macOS (Bash deploy script)
- Node.js >= 18
- Git (used extensively for commit operations, worktree management, file history)

---

*Stack analysis: 2026-02-26*
