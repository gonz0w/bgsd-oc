# Roadmap: GSD Plugin Performance & Quality Improvement

## Overview

Incremental improvement of the GSD planning plugin (gsd-tools.cjs) from a working but brittle 6,495-line monolith to a well-tested, observable, and developer-friendly tool. The approach builds safety nets first (tests, logging), then hardens error handling, adds missing DX features, introduces a build system for source splitting, and finishes with performance optimizations. Each phase delivers verifiable improvements without breaking the existing tool.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Safety Nets** - Tests, package.json, config schema extraction — build the safety net before touching anything risky
- [x] **Phase 2: Error Handling & Hardening** - Debug logging across 55 catch blocks, shell sanitization, temp file cleanup
- [x] **Phase 3: Developer Experience & Discoverability** - --help support, 11 slash commands, config migration, workflow integrations
- [x] **Phase 4: Build System & Module Split** - esbuild bundler pipeline, source split into src/, deploy.sh updated atomically
- [x] **Phase 5: Performance & Polish** - In-memory file cache, batch grep optimization, configurable context window

## Phase Details

### Phase 1: Foundation & Safety Nets
**Goal**: The plugin has a formalized project structure, a single source of truth for config schema, and comprehensive tests covering state mutations and frontmatter parsing — creating the safety net required before any refactoring
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-02, FOUND-03, FOUND-04, FOUND-05, DOC-01
**Success Criteria** (what must be TRUE):
  1. `npm test` runs all existing + new tests from the project root via package.json scripts
  2. All 8 state mutation commands have round-trip tests that verify STATE.md content survives write-read cycles
  3. Frontmatter with nested objects, arrays, and quoted strings with colons round-trips losslessly through extract/reconstruct
  4. A single `CONFIG_SCHEMA` constant is the canonical source — `loadConfig()`, `cmdConfigEnsureSection()`, and `cmdValidateConfig()` all derive from it with no field drift
  5. AGENTS.md accurately reflects the current line count of gsd-tools.cjs
**Plans**: 4/4 plans executed
Plans:
- [x] 01-01-PLAN.md — Project scaffolding (package.json + DOC-01 line count fix)
- [x] 01-02-PLAN.md — CONFIG_SCHEMA extraction (single source of truth for config)
- [x] 01-03-PLAN.md — State mutation round-trip tests (8 commands)
- [x] 01-04-PLAN.md — Frontmatter round-trip tests (edge cases)

### Phase 2: Error Handling & Hardening
**Goal**: The plugin is observable when debugging and hardened against shell injection and temp file leaks — all 55 silent catch blocks log diagnostics via stderr without affecting JSON stdout
**Depends on**: Phase 1
**Requirements**: FOUND-01, FOUND-06, FOUND-07
**Success Criteria** (what must be TRUE):
  1. Setting `GSD_DEBUG=1` produces diagnostic output on stderr for every previously-silent catch block, while stdout JSON remains valid parseable JSON
  2. With `GSD_DEBUG` unset, the tool behaves identically to before — no output changes, no behavioral changes
  3. Git command arguments containing shell metacharacters (quotes, semicolons, backticks) are safely escaped and do not execute arbitrary commands
  4. No `gsd-*.json` temp files remain in the system tmpdir after the CLI process exits (normal or error)
**Plans**: 2/2 plans executed
Plans:
- [x] 02-01-PLAN.md — Debug logging helper + instrument all catch blocks
- [x] 02-02-PLAN.md — Shell sanitization + temp file cleanup

### Phase 3: Developer Experience & Discoverability
**Goal**: All 15 feature commands are discoverable and reachable — via slash commands in Claude Code, via --help in the CLI, and via automatic integration in planning/execution workflows
**Depends on**: Phase 2
**Requirements**: DX-01, DX-02, DX-03, DX-04, WFLOW-01, WFLOW-02, WFLOW-03
**Success Criteria** (what must be TRUE):
  1. Running any command with `--help` prints usage text to stderr describing arguments, options, and example invocations
  2. All 11 previously-unwired commands (session-diff, context-budget, test-run, search-decisions, validate-dependencies, search-lessons, codebase-impact, rollback-info, velocity, trace-requirement, validate-config) are callable as `/gsd-*` slash commands in Claude Code
  3. Running `execute-phase` workflow automatically validates phase dependencies before execution begins and warns on unmet dependencies
  4. Running `plan-phase` workflow automatically surfaces relevant lessons from previously completed phases
  5. Running `execute-plan` workflow warns agents when plan content exceeds the configured context window threshold
**Plans**: 3/3 plans executed
Plans:
- [x] 03-01-PLAN.md — --help support + config migration command
- [x] 03-02-PLAN.md — 11 slash command files + execution visualization
- [x] 03-03-PLAN.md — Workflow integrations (validate-deps, search-lessons, context-budget)

### Phase 4: Build System & Module Split
**Goal**: Source code lives in organized modules under src/ while the deployed artifact remains a single file — esbuild bundles everything, deploy.sh builds before copying, and a smoke test verifies the result
**Depends on**: Phase 3
**Requirements**: BUILD-01, BUILD-02, BUILD-03
**Success Criteria** (what must be TRUE):
  1. `npm run build` produces a single `bin/gsd-tools.cjs` file from `src/` modules in under 500ms, with working shebang and no runtime dependencies
  2. Source code in `src/` follows strict `router -> commands -> lib` dependency direction with no circular imports
  3. `deploy.sh` calls the build step before copying and runs a smoke test that verifies the deployed artifact can execute `current-timestamp --raw` successfully
  4. All existing tests pass against the bundled output with zero behavioral differences from the pre-split monolith
**Plans**: 3/3 plans executed
Plans:
- [x] 04-01-PLAN.md — esbuild pipeline setup (proof-of-concept bundling)
- [x] 04-02-PLAN.md — Source module split into src/
- [x] 04-03-PLAN.md — Deploy script update with build + smoke test

### Phase 5: Performance & Polish
**Goal**: Repeated file reads within a single CLI invocation are eliminated by an in-memory cache, grep operations are batched for efficiency, and context budget calculations are configurable
**Depends on**: Phase 4
**Requirements**: PERF-01, PERF-02, PERF-03
**Success Criteria** (what must be TRUE):
  1. Commands that read the same file multiple times during a single invocation only hit the filesystem once — subsequent reads come from the in-memory LRU cache
  2. `cmdCodebaseImpact()` spawns a single grep process for multiple patterns instead of one process per pattern
  3. `cmdContextBudget()` reads `context_window` and `context_target_percent` from config.json, falling back to 200K/50% defaults when not configured
**Plans**: 2/2 plans executed
Plans:
- [x] 05-01-PLAN.md — In-memory file cache + batch grep optimization
- [x] 05-02-PLAN.md — Configurable context window

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Safety Nets | 4/4 | Complete | 2026-02-22 |
| 2. Error Handling & Hardening | 2/2 | Complete | 2026-02-22 |
| 3. Developer Experience & Discoverability | 3/3 | Complete | 2026-02-22 |
| 4. Build System & Module Split | 3/3 | Complete | 2026-02-22 |
| 5. Performance & Polish | 2/2 | Complete | 2026-02-22 |
