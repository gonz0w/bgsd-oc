# GSD Plugin Performance & Quality Improvement

## What This Is

A comprehensive improvement pass on the GSD (Get Shit Done) planning plugin for Claude Code. The plugin is a zero-dependency, single-file Node.js CLI (`bin/gsd-tools.cjs`, 6,495 lines) that provides structured data operations for AI-driven project planning workflows. This project addresses performance bottlenecks, code quality gaps, and unwired features to make the plugin faster, more reliable, and fully functional.

## Core Value

Every improvement must make the plugin more reliable and faster for developers using GSD to plan and execute real projects — no regressions, no breaking changes.

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

### Active

- [ ] In-memory file cache to eliminate repeated reads within single invocations
- [ ] Bundle-based build system (dev dependencies allowed, deploy still produces single file)
- [ ] Replace 55 silent catch blocks with debug logging
- [ ] Extract single CONFIG_SCHEMA constant (eliminate 3-way config drift)
- [ ] Add tests for 8 state mutation commands
- [ ] Add frontmatter round-trip tests
- [ ] Wire 11+ unwired commands into slash commands
- [ ] Wire validate-dependencies into execute-phase workflow
- [ ] Wire search-lessons into plan-phase workflow
- [ ] Wire context-budget into execute-plan workflow
- [ ] Add package.json with engines field, test scripts
- [ ] Sanitize shell interpolation in git commands
- [ ] Clean up temp files on exit
- [ ] Fix stale line count in AGENTS.md
- [ ] Create plan templates (ash-resource, pulsar-function, go-service)
- [ ] Add parallel execution visualization to execute-phase workflow
- [ ] Per-command --help support
- [ ] Config migration for new keys
- [ ] Batch grep patterns in cmdCodebaseImpact()
- [ ] Configurable context window size in cmdContextBudget()

### Out of Scope

- Full module split of gsd-tools.cjs — Intentional design choice, bundle approach preserves single-file deploy
- Async I/O rewrite — Synchronous I/O is appropriate for CLI tool, not a real bottleneck
- npm package publishing — This is a plugin deployed via file copy, not a library
- Markdown AST parser — Would add heavy dependencies, regex approach is workable with better tests
- Multi-process file locking — Only one AI session runs per project, race conditions are theoretical

## Context

- The plugin runs as a CLI tool invoked by AI agents during planning workflows
- All state lives in `.planning/` as markdown files with YAML frontmatter
- The codebase map (`.planning/codebase/`) was just created and surfaces 8 recommended improvements
- AGENTS.md documents 6 "optional next steps" that are all in scope for this project
- CONCERNS.md identifies 55 silent catches, 309 regex patterns, and config schema drift as top issues
- The zero-dependency constraint is relaxed: dev dependencies for build tooling are now allowed, but the deployed artifact must remain a single file
- Test file exists at `bin/gsd-tools.test.cjs` (2,302 lines) using `node:test` — extend this

## Constraints

- **Backward compatibility**: All regex/parser changes must accept both old and new formats
- **No breaking changes**: Existing ROADMAP.md, STATE.md, PLAN.md files must keep working
- **Single-file deploy**: `deploy.sh` must continue to work — bundle to single file if splitting source
- **Node.js 18+**: Minimum version (for fetch, node:test) — formalize in package.json
- **Test against real project**: Always test against `/mnt/raid/DEV/event-pipeline/.planning/`

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Allow dev dependencies via bundler | Enables node-cache, proper test tooling while keeping single-file deploy | — Pending |
| In-memory cache over disk cache | CLI is short-lived process; disk cache adds complexity for minimal gain | — Pending |
| Extend existing test file | `bin/gsd-tools.test.cjs` already has patterns; adding to it is simpler than new test infrastructure | — Pending |
| Debug logging over error throwing for catches | Most silent catches are "optional data" patterns; throwing would break workflows | — Pending |

---
*Last updated: 2026-02-22 after initialization*
