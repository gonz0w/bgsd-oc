# GSD Plugin Performance & Quality Improvement

## What This Is

A zero-dependency, single-file Node.js CLI built from 15 organized `src/` modules via esbuild, producing `bin/gsd-tools.cjs`. It provides structured data operations for AI-driven project planning workflows. v1.0 established the test suite, module split, and observability layer. v1.1 focuses on reducing context consumption across all workflow layers and resolving remaining tech debt.

## Core Value

Every improvement must make the plugin more reliable and faster for developers using GSD to plan and execute real projects — no regressions, no breaking changes.

## Current Milestone: v1.1 Context Reduction & Tech Debt

**Goal:** Reduce token/context consumption across workflows, planning doc reads, research outputs, and CLI output while resolving remaining tech debt items.

**Target features:**
- Research and implement context reduction techniques across all layers (workflow prompts, doc loading, CLI output, research files)
- Measurable token reduction (30%+ target) with before/after benchmarks
- Fix broken `roadmap analyze` test (pre-existing failure)
- Add missing `--help` text for remaining 36 commands
- Create plan template files (deferred TMPL-01 from v1.0)

## Requirements

### Validated

- ✓ 79 CLI commands with JSON-over-stdout interface — existing
- ✓ Zero-dependency single-file architecture — existing
- ✓ Markdown parsing with 309+ regex patterns — existing
- ✓ YAML frontmatter extraction and reconstruction — existing
- ✓ Git integration (commit, diff, log) via execSync — existing
- ✓ State management (STATE.md read/write/patch) — existing
- ✓ Roadmap analysis and phase management — existing
- ✓ Milestone detection with 5-strategy fallback — existing
- ✓ 19 test suites covering core parsing and state — existing
- ✓ Workflow orchestration via markdown prompts — existing
- ✓ Deploy script for live install — existing
- ✓ 15 feature commands (session-diff through quick-summary) — existing but unwired
- ✓ In-memory file cache to eliminate repeated reads — v1.0
- ✓ esbuild bundler pipeline with src/ module split — v1.0
- ✓ Debug logging (GSD_DEBUG) across all 96 catch blocks — v1.0
- ✓ Single CONFIG_SCHEMA constant (eliminated 3-way config drift) — v1.0
- ✓ Round-trip tests for 8 state mutation commands — v1.0
- ✓ Frontmatter round-trip tests (13 edge cases) — v1.0
- ✓ 11 slash commands wiring unwired features — v1.0
- ✓ Workflow integrations (validate-deps, search-lessons, context-budget) — v1.0
- ✓ package.json with engines, test/build scripts — v1.0
- ✓ Shell injection sanitization (sanitizeShellArg) — v1.0
- ✓ Temp file cleanup on exit — v1.0
- ✓ AGENTS.md line count fix — v1.0
- ✓ Parallel execution ASCII visualization — v1.0
- ✓ Per-command --help support (43 entries) — v1.0
- ✓ Config migration command — v1.0
- ✓ Batch grep in cmdCodebaseImpact() — v1.0
- ✓ Configurable context window size — v1.0

### Active

<!-- v1.1 scope — details in REQUIREMENTS.md -->

- [ ] Context reduction across workflow prompts, doc loading, CLI output, research files
- [ ] Token usage measurement (before/after benchmarks)
- [ ] Fix broken `roadmap analyze` test
- [ ] Complete `--help` coverage (36 remaining commands)
- [ ] Plan template files

### Out of Scope

- Async I/O rewrite — Synchronous I/O is appropriate for CLI tool, not a real bottleneck
- npm package publishing — This is a plugin deployed via file copy, not a library
- Markdown AST parser — Would add heavy dependencies, regex approach is workable with better tests
- Multi-process file locking — Only one AI session runs per project, race conditions are theoretical
- Full argument parsing library (commander/yargs) — Manual router is well-suited to subcommand-heavy pattern
- ESM output format — CJS avoids __dirname/require rewriting, keep CJS

## Context

Shipped v1.0 with 153+ tests, 15 src/ modules, esbuild bundler.
Tech stack: Node.js 18+, node:test, esbuild, zero runtime dependencies.
Source split into `src/lib/` (7 modules) and `src/commands/` (7 modules) + router + index.
Deploy pipeline: `npm run build` → esbuild bundle → `deploy.sh` with smoke test and rollback.
New Node.js dev dependencies are allowed for v1.1 if they improve context handling (must stay zero runtime deps in bundle).

Known tech debt (v1.1 targets):
- 1 pre-existing test failure (`roadmap analyze` expects 50%, gets 33%)
- Plan template files not yet created (deferred from v1.0 as TMPL-01)
- 36 of 79 commands missing --help text (deferred from v1.0 as DOC-02)

## Constraints

- **Backward compatibility**: All regex/parser changes must accept both old and new formats
- **No breaking changes**: Existing ROADMAP.md, STATE.md, PLAN.md files must keep working
- **Single-file deploy**: `deploy.sh` must continue to work — bundle to single file if splitting source
- **Node.js 18+**: Minimum version (for fetch, node:test) — formalized in package.json
- **Test against real project**: Always test against `/mnt/raid/DEV/event-pipeline/.planning/`

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Allow dev dependencies via bundler | Enables esbuild, proper test tooling while keeping single-file deploy | ✓ Good — esbuild bundles 15 modules to single file in <500ms |
| In-memory Map cache over lru-cache | CLI is short-lived process (<5s); plain Map needs no eviction | ✓ Good — simpler, zero dependency |
| Extend existing test file | `bin/gsd-tools.test.cjs` already has patterns; adding to it is simpler than new test infrastructure | ✓ Good — 153+ tests in single file |
| Debug logging over error throwing for catches | Most silent catches are "optional data" patterns; throwing would break workflows | ✓ Good — 96 catch blocks instrumented, zero behavioral change when GSD_DEBUG unset |
| Strip-shebang esbuild plugin | Monolith has shebang that breaks bundling; plugin strips on input, banner adds on output | ✓ Good — clean build pipeline |
| 15-module split (6 lib + 7 commands + router + index) | Logical grouping by domain, strict dependency direction | ✓ Good — maintainable, no circular imports |
| Config migration with .bak backup | Safe upgrade path for existing configs | ✓ Good — only creates backup when changes needed |
| Batch grep: fixed-string vs regex split | Different grep flags needed; 1-2 calls max regardless of pattern count | ✓ Good — eliminates per-pattern spawn overhead |

---
*Last updated: 2026-02-22 after v1.1 milestone start*
