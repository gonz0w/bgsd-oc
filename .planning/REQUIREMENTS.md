# Requirements: GSD Plugin Performance & Quality Improvement

**Defined:** 2026-02-22
**Core Value:** Every improvement must make the plugin more reliable and faster for developers using GSD to plan and execute real projects

## v1 Requirements

Requirements for this improvement pass. Each maps to roadmap phases.

### Foundation & Safety

- [x] **FOUND-01**: Debug logging via `GSD_DEBUG` env var — a single `debugLog(context, message)` helper replaces all 55 silent catch blocks with gated stderr logging, no behavioral change when env var unset
- [x] **FOUND-02**: Single `CONFIG_SCHEMA` constant extracted — `loadConfig()`, `cmdConfigEnsureSection()`, and `cmdValidateConfig()` all derive from one canonical schema with alias mappings
- [x] **FOUND-03**: State mutation tests — round-trip tests for all 8 state mutation commands (`state update`, `state patch`, `state add-decision`, `state add-blocker`, `state resolve-blocker`, `state record-session`, `state advance-plan`, `state record-metric`)
- [x] **FOUND-04**: Frontmatter round-trip tests — `extractFrontmatter()` → `reconstructFrontmatter()` cycle verified lossless for edge cases (nested objects, arrays, quoted strings with colons)
- [x] **FOUND-05**: `package.json` created with `name`, `version`, `engines: { node: ">=18" }`, `scripts: { test, build }`, devDependencies for esbuild
- [x] **FOUND-06**: Shell interpolation sanitized — centralized `sanitizeShellArg()` function, strict date regex for `--since`, `--fixed-strings` for grep patterns
- [x] **FOUND-07**: Temp file cleanup — `process.on('exit')` handler cleans `gsd-*.json` from tmpdir, or fixed filename that gets overwritten

### Performance

- [ ] **PERF-01**: In-memory file cache — `Map`-based cache wrapping `safeRead()`, invalidated on write, lives for duration of single CLI invocation
- [ ] **PERF-02**: Batch grep in `cmdCodebaseImpact()` — combine search patterns into single `grep -rl -e pat1 -e pat2` call instead of spawning per-pattern
- [ ] **PERF-03**: Configurable context window — `cmdContextBudget()` reads `context_window` and `context_target_percent` from config.json with current 200K/50% as defaults

### Developer Experience

- [ ] **DX-01**: Per-command `--help` support — `COMMAND_HELP` map at module level, `--help` check in router before dispatching, prints usage text to stderr
- [ ] **DX-02**: Wire 11 unwired commands into slash commands — create `.md` command files in plugin `command/` directory for `session-diff`, `context-budget`, `test-run`, `search-decisions`, `validate-dependencies`, `search-lessons`, `codebase-impact`, `rollback-info`, `velocity`, `trace-requirement`, `validate-config`
- [ ] **DX-03**: Config migration command — `cmdConfigMigrate()` reads existing config, merges with CONFIG_SCHEMA defaults for missing keys, writes back without overwriting existing values
- [ ] **DX-04**: Parallel execution visualization — ASCII dependency/wave diagram in `execute-phase.md` workflow showing which plans can run simultaneously

### Workflow Integration

- [ ] **WFLOW-01**: Wire `validate-dependencies` into `execute-phase` workflow as pre-flight check before phase execution begins
- [ ] **WFLOW-02**: Wire `search-lessons` into `plan-phase` workflow to auto-surface relevant lessons from completed phases
- [ ] **WFLOW-03**: Wire `context-budget` into `execute-plan` workflow to warn agents when plan is too large for context window

### Build System

- [ ] **BUILD-01**: esbuild bundler pipeline — `build.js` script using esbuild API, `--platform=node`, `--format=cjs`, `--banner` for shebang, produces single-file output at `bin/gsd-tools.cjs`
- [ ] **BUILD-02**: Source module split — split `gsd-tools.cjs` into `src/` directory with `src/lib/` (config, frontmatter, git, markdown, output, cache, constants) and `src/commands/` (grouped by domain), strict `router → commands → lib` dependency direction
- [ ] **BUILD-03**: Deploy script updated — `deploy.sh` calls `npm run build` before copying, with smoke test that verifies deployed artifact executes

### Documentation

- [x] **DOC-01**: Fix stale line count in AGENTS.md (says 5400+, actual is 6,495+)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Testing

- **TEST-01**: Snapshot testing for regex parsers (requires Node 22+, `node:test` snapshot API)
- **TEST-02**: Verify command test coverage (cmdVerifyPlanStructure, cmdVerifyReferences, cmdVerifyCommits, etc.)

### Templates

- **TMPL-01**: Plan template files (ash-resource.md, pulsar-function.md, go-service.md)

### Documentation

- **DOC-02**: Per-command help text for all 79 commands (DX-01 creates infrastructure, this fills all content)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Full async I/O rewrite | Sync I/O is correct for CLI tool, not a real bottleneck |
| npm package publishing | Plugin deploys via file copy, not a library |
| Markdown AST parser (unified/remark) | Would add 20+ dependencies, regex approach works with better tests |
| Full argument parsing library (commander/yargs) | Manual router is well-suited to subcommand-heavy pattern |
| Interactive prompts (inquirer) | Tool is invoked by AI agents, not humans. JSON-over-stdout is correct |
| File watching / daemon mode | Tool runs on-demand, watching serves no purpose |
| Multi-process file locking | Single-writer assumption is correct in practice |
| ESM output format | CJS avoids __dirname/require rewriting, keep CJS |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 2 | Complete |
| FOUND-02 | Phase 1 | Complete |
| FOUND-03 | Phase 1 | Complete |
| FOUND-04 | Phase 1 | Complete |
| FOUND-05 | Phase 1 | Complete |
| FOUND-06 | Phase 2 | Complete |
| FOUND-07 | Phase 2 | Complete |
| PERF-01 | Phase 5 | Pending |
| PERF-02 | Phase 5 | Pending |
| PERF-03 | Phase 5 | Pending |
| DX-01 | Phase 3 | Pending |
| DX-02 | Phase 3 | Pending |
| DX-03 | Phase 3 | Pending |
| DX-04 | Phase 3 | Pending |
| WFLOW-01 | Phase 3 | Pending |
| WFLOW-02 | Phase 3 | Pending |
| WFLOW-03 | Phase 3 | Pending |
| BUILD-01 | Phase 4 | Pending |
| BUILD-02 | Phase 4 | Pending |
| BUILD-03 | Phase 4 | Pending |
| DOC-01 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0

---
*Requirements defined: 2026-02-22*
*Last updated: 2026-02-22 after roadmap phase mapping*
