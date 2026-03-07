# Codebase Concerns

**Analysis Date:** 2026-03-07

## Active Tech Debt

**Output Mode Migration Incomplete (~176 legacy vs ~10 migrated):**
- Issue: v6.0 introduced dual-mode output via `output(result, { formatter })` but ~176 command call-sites still use the legacy `output(result, raw)` boolean signature. Only ~10 call-sites use the new formatter pattern.
- Files: `src/commands/verify.js`, `src/commands/features.js`, `src/commands/misc.js`, `src/commands/phase.js`, `src/commands/memory.js`, `src/commands/roadmap.js`
- Impact: Legacy commands fall through to JSON output even in TTY mode. Users see raw JSON instead of formatted output for ~95% of commands.
- Fix approach: Migrate each command handler individually — add a `format*` function and pass it as `{ formatter }` to `output()`. The `src/commands/research.js` shows the migrated pattern (uses `{ formatter: formatYtSearch, raw }`). Prioritize high-frequency commands: `init`, `state`, `verify`, `phases`.

**Router Is a 930-Line Switch Statement:**
- Issue: `src/router.js` is a 930-line `main()` function with hand-rolled argument parsing for every subcommand. Argument extraction is copy-pasted per case: `const phaseIdx = args.indexOf('--phase'); const phase = phaseIdx !== -1 ? args[phaseIdx + 1] : null;`
- Files: `src/router.js`
- Impact: Adding a new subcommand requires ~15 lines of boilerplate argument parsing. No validation of flag values (missing `--phase` value silently becomes `undefined`). v8.2 removed the backward-compat block (from 1642 to 930 lines) but the pattern itself persists.
- Fix approach: Extract a `parseArgs(args, schema)` helper that declaratively defines flags per command. Define schemas in a map; keep the switch for dispatch but reduce each case to 2-3 lines.

**Compact/Manifest Mode Repetition in init.js:**
- Issue: `src/commands/init.js` has 12 `if (global._gsdCompactMode)` blocks each containing nearly identical `compactResult` construction and `if (global._gsdManifestMode)` sub-blocks. 35+ references to these globals throughout the file.
- Files: `src/commands/init.js` (1,883 lines — largest command module)
- Impact: Every new init command requires ~40 lines of repeated compact/manifest logic. High risk of field drift between compact and verbose output.
- Fix approach: Extract a `compactInit(result, fields, manifestFiles)` helper. Each init handler returns a full result object and the helper handles mode-switching, field selection, and manifest generation.

**Duplicated SKIP_DIRS Constants:**
- Issue: Two independent `SKIP_DIRS` Set definitions with nearly identical values. The comment in `src/lib/codebase-intel.js:62` says "(matches env.js SKIP_DIRS)" but the lists differ — `codebase-intel.js` includes `.planning` while `env.js` does not.
- Files: `src/commands/env.js`, `src/lib/codebase-intel.js:63-66`
- Impact: Directory exclusion behavior diverges silently between env scan and codebase analysis. Adding a new skip directory requires remembering to update both.
- Fix approach: Move `SKIP_DIRS` to `src/lib/constants.js` and import from both modules. Extend with `.planning` where needed.

**Global State for Output Configuration:**
- Issue: Output mode, compact mode, manifest mode, and field filtering are communicated via 4 globals: `global._gsdOutputMode`, `global._gsdCompactMode`, `global._gsdManifestMode`, `global._gsdRequestedFields`. Set in `src/router.js` and read throughout command handlers (52 references across 5 files).
- Files: `src/router.js:34-82`, `src/lib/output.js:79-105`, `src/commands/init.js` (17 reads), `src/commands/features.js` (8 reads + save/restore mutations at lines 1662-1710), `src/commands/env.js` (1 read)
- Impact: Globals make testing harder (must save/restore between tests), create coupling between router and commands. The context-budget measure command (`src/commands/features.js:1662-1710`) directly mutates `global._gsdCompactMode` multiple times, creating subtle state leak risk.
- Fix approach: Pass an `options` object through command handlers instead of globals. The `output()` function already supports an options argument — extend to include compact/manifest/fields.

**Stale Test Failure Count in STATE.md:**
- Issue: STATE.md and PROJECT.md both claim "31 pre-existing test failures (config-migrate, compact, codebase-impact, codebase ast CLI handler)" but the actual test suite has 812 tests (767 main + 45 format). The failure count may be stale.
- Files: `.planning/STATE.md:139`, `.planning/PROJECT.md:161`
- Impact: Gives false impression of known defects that no longer exist. May cause unnecessary concern or incorrect prioritization.
- Fix approach: Run full test suite to verify current pass/fail counts, then update STATE.md and PROJECT.md accordingly.

**Hardcoded User Path Fallback in agent.js:**
- Issue: `src/commands/agent.js:15` has a hardcoded fallback path `/home/cam/.config/oc/get-shit-done` if `$HOME` is undefined.
- Files: `src/commands/agent.js:15`
- Impact: If deployed on a system without `$HOME` set, it silently uses a user-specific hardcoded path. Affects agent audit and RACI validation commands.
- Fix approach: Use `/root` or `/tmp` as fallback instead of a hardcoded user path. Or require `$HOME` to be set and error with a clear message.

**Style Inconsistency: var Declarations in lifecycle.js:**
- Issue: `src/lib/lifecycle.js` uses `var` declarations (3 occurrences of module-level `var`) while the rest of the 34-module codebase uses `const`/`let` exclusively.
- Files: `src/lib/lifecycle.js:28` and others
- Impact: Purely cosmetic, but signals the file may have been ported or not reviewed to match conventions.
- Fix approach: Replace `var` with `const`/`let`. Straightforward find-and-replace.

## Known Bugs

**Frontmatter Cache Key Collision Risk:**
- Symptoms: Two different files with identical first 200 characters and identical length would produce the same cache key, causing stale frontmatter to be returned.
- Files: `src/lib/frontmatter.js`
- Trigger: Cache key is `content.length + ':' + content.slice(0, 200)`. Files with the same YAML frontmatter header and equal total length collide.
- Workaround: Unlikely in practice because file content includes the body which varies. The cache lives only for a single CLI invocation. Low real-world impact.

**Stateful Regex with Global Flag:**
- Symptoms: `PHASE_HEADER` in `src/lib/regex-cache.js:49` uses the `gi` flag. Global regexes maintain `.lastIndex` state across `.exec()` calls. If reused across different strings without resetting, matches may be missed.
- Files: `src/lib/regex-cache.js:49`
- Trigger: Calling `.exec()` or `.test()` on the shared `PHASE_HEADER` regex from multiple callers within one invocation.
- Workaround: Most callers use `matchAll()` or `match()` which reset lastIndex. Only direct `.exec()` usage on this shared regex would be affected. The pre-compiled `PHASE_HEADER` regex is exported but not actually imported by any file via the module exports (only `cachedRegex` and `PHASE_DIR_NUMBER` are exported from `regex-cache.js`), so this is currently a dead risk.

## Security Considerations

**Shell Command Execution via execSync:**
- Risk: `execSync()` spawns a shell which interprets the command string. User-provided test commands from `config.json` are passed directly to `execSync()`.
- Files: `src/commands/features.js:209` (test-run), `src/commands/verify.js:875` (verify deliverables), `src/commands/verify.js:1649` (verify quality test run), `src/commands/misc.js:1502,1514` (TDD validate), `src/commands/worktree.js:284` (setup hooks)
- Current mitigation: 6 `execSync()` call sites — all take commands from project-controlled `config.json`, not untrusted input. The `execGit()` function in `src/lib/git.js` correctly uses `execFileSync` (no shell). All research commands in `src/commands/research.js` also use `execFileSync` (no shell).
- Recommendations: These are intentional — users configure their own test commands. Document that `config.json` `test_commands` and worktree `setup_hooks` execute arbitrary shell commands. No external untrusted input reaches these paths.

**No Input Validation on CLI Arguments:**
- Risk: Missing values for flags (e.g., `gsd-tools verify:state update --phase` with no value) silently pass `undefined` to command handlers.
- Files: `src/router.js` (all flag parsing — ~50 instances of `args.indexOf('--flag')` pattern)
- Current mitigation: Most commands handle `null`/`undefined` gracefully via early returns or error calls.
- Recommendations: Add validation in the argument parser — if a flag expects a value and none follows, emit an error before dispatch.

**Broad Silent Error Swallowing:**
- Risk: 70 empty `catch` blocks (no error variable binding) across the source, plus ~76 `catch (e)` blocks where only `debugLog` is called. Errors in file operations, JSON parsing, git commands, and cache operations are silently ignored.
- Files: `src/commands/init.js` (41 catch blocks, 4 empty), `src/commands/research.js` (28 catch blocks), `src/commands/env.js` (26 catch blocks), `src/lib/cache.js` (16 catch blocks — all silent)
- Current mitigation: `GSD_DEBUG=1` enables `debugLog` output to stderr for the `catch (e)` variants. Empty `catch {}` blocks produce no diagnostic at all, even with debug enabled.
- Recommendations: At minimum, add `debugLog` to empty catch blocks so failures are visible with `GSD_DEBUG=1`. The cache layer's 16 silent catches are particularly concerning — a SQLite corruption would produce zero diagnostic output.

## Performance Concerns

**Bundle Size at 1163KB (Over Original 1050KB Budget):**
- Problem: The single-file bundle is 1163KB / 28,817 lines. The `build.js` budget was raised from 1000KB to 1500KB to accommodate growth. Acorn (230KB) is lazy-loaded, reducing effective cold-start to ~923KB.
- Files: `bin/gsd-tools.cjs`, `build.js:61` (`BUNDLE_BUDGET_KB = 1500`)
- Cause: 39 source modules (~29,600 lines of source) plus acorn (230KB) and tokenx (~50KB) bundled as runtime dependencies.
- Improvement path: Acorn is already lazy-loaded (Phase 65). Further reduction would require: (1) moving MCP_KNOWN_SERVERS data or COMMAND_HELP entries to external JSON, (2) code-splitting rarely-used command modules, (3) minification (currently disabled for debuggability).

**Large Init Commands Do Multiple Disk Scans:**
- Problem: `cmdInitExecutePhase` and `cmdInitProgress` in `src/commands/init.js` sequentially call `autoTriggerEnvScan()`, `readCodebaseIntel()`, `getIntentDriftData()`, `getIntentSummary()`, and `getPhaseTree()`. Each reads overlapping sets of files.
- Files: `src/commands/init.js:300-396`, `src/commands/init.js:1300-1560`
- Cause: Each subsystem independently reads `.planning/` files. The `cachedReadFile()` helper (backed by SQLite L2 cache) mitigates repeat reads of the same file within and across invocations, but the initial scan still touches many files.
- Improvement path: Pre-warm the file cache with a single directory walk before calling subsystem functions. Phase 65 reduced init I/O by 97% via `readCodebaseIntel` (stale-but-fast) replacing `autoTriggerCodebaseIntel`, so the worst case is largely addressed.

**Synchronous File I/O Throughout:**
- Problem: All 160+ `readFileSync`/`readdirSync` calls are blocking. For a CLI tool that runs one command per invocation, this is acceptable. However, codebase analysis (`src/lib/codebase-intel.js`) walks the entire project tree synchronously.
- Files: `src/lib/codebase-intel.js:160-180`, `src/lib/deps.js` (dependency graph construction)
- Cause: Deliberate design decision — async I/O is explicitly out of scope per PROJECT.md.
- Improvement path: Only relevant if analysis of very large codebases (>10K files) becomes slow. Current architecture is correct for the CLI use case.

## Stability Risks

**node:sqlite Is Stability 1.2 (Release Candidate):**
- Risk: `src/lib/cache.js` depends on `node:sqlite` (Node.js 22.5+) for persistent L2 caching. This API is Stability 1.2 (Release Candidate) and may change before reaching Stability 2 (Stable).
- Files: `src/lib/cache.js:32` (`const { DatabaseSync } = require('node:sqlite')`)
- Current mitigation: The `CacheEngine` class in `src/lib/cache.js:518-541` detects Node version and gracefully falls back to `MapBackend` (in-memory only) on Node <22.5 or if SQLite initialization fails. The `--no-cache` flag forces Map fallback for testing.
- Impact: If the `node:sqlite` API changes in a future Node.js release, the `SQLiteBackend` constructor would throw, and the fallback to `MapBackend` would activate silently. Loss of cross-invocation cache persistence, but no functional breakage.

**package.json engines vs Actual Requirement Mismatch:**
- Risk: `package.json` declares `"engines": { "node": ">=18" }` but PROJECT.md states "Node.js >= 22.5 (required for `node:sqlite` caching)" and the SQLite backend requires Node 22.5+.
- Files: `package.json:9`, `.planning/PROJECT.md:156`
- Impact: Users on Node 18-22.4 get silent degradation to Map-only caching (no cross-invocation persistence). This is by design (graceful degradation) but the engines field is misleading about the full-feature requirement.
- Fix approach: Either document the tiered requirement clearly in README.md, or update engines to `>=22.5` if cache persistence is considered essential.

**External CLI Tool Dependencies for Research:**
- Risk: The research pipeline (`src/commands/research.js`) depends on `yt-dlp` and `notebooklm-py` (optional external binaries). These are invoked via `execFileSync` with timeouts but their output format could change across versions.
- Files: `src/commands/research.js:592,914` (yt-dlp), `src/commands/research.js:1875,1893,1911` (notebooklm-py)
- Current mitigation: 4-tier graceful degradation — missing tools degrade tier level rather than crashing. All `execFileSync` calls have timeouts (30-60s). JSON output is parsed with try-catch.
- Impact: A breaking change in `yt-dlp --dump-json` format or `notebooklm-py --json` output would cause research commands to fail silently (returning null for that tier), degrading to a lower tier.

## Scalability

**Single-File Bundle Architecture:**
- Current capacity: 1163KB bundle with 28K lines loads acceptably on Node 22+. Lazy module loading in `src/router.js:10-31` (20 lazy-loaded modules) means only the relevant command module is parsed per invocation.
- Limit: At ~2MB+ bundle size, cold-start time could become noticeable. At 50K+ source lines, debugging via source reading becomes impractical.
- Scaling path: The lazy-loading pattern already mitigates parse cost. If the bundle exceeds 1500KB, consider: code-splitting into main + command bundles, moving data tables (COMMAND_HELP, MCP_KNOWN_SERVERS, LANGUAGE_MAP) to external JSON files.

**Phase Tree Cache:**
- Current capacity: Handles ~100 phase directories efficiently with single-scan caching via `getPhaseTree()`.
- Limit: At 500+ active phases, the initial scan reads every phase directory synchronously.
- Scaling path: The milestone archiving system (`src/commands/phase.js` milestone complete) moves completed phases out of the active tree. Twelve milestones shipped with ~60 total phases — well within limits.

**Memory Store (Append-Only JSON):**
- Current capacity: Memory stores (`src/commands/memory.js`) use append-only JSON arrays with compaction at 50 entries.
- Limit: Sacred stores (decisions, lessons) never compact. After hundreds of decisions, the JSON file grows unbounded.
- Scaling path: At >1MB per store file, implement pagination or summary extraction. Current usage across 12 milestones stays well under this limit.

**Regex-Heavy Markdown Parsing:**
- Current capacity: 309+ regex patterns handle ROADMAP.md, STATE.md, and PLAN.md formats.
- Limit: The regex cache (`src/lib/regex-cache.js`) caps at 200 dynamically-constructed patterns with LRU eviction. Pre-compiled patterns are not bounded.
- Scaling path: Adding many new markdown formats could push against the regex cache limit, but the cap prevents unbounded memory growth.

## Maintenance Burden

**Large Command Modules:**
- Issue: Eight command modules exceed 1000 lines: `src/commands/verify.js` (2179), `src/commands/features.js` (2015), `src/commands/research.js` (2002), `src/commands/init.js` (1883), `src/commands/intent.js` (1625), `src/commands/misc.js` (1616), `src/commands/codebase.js` (1482), `src/commands/env.js` (1175).
- Impact: Hard to navigate, understand ownership boundaries, and review changes. `verify.js` and `features.js` are catch-all modules with many unrelated command handlers.
- Fix approach: Split `features.js` into focused modules (e.g., `search.js`, `codebase-impact.js`, `context-budget.js`). Split `misc.js` into `template.js`, `tdd.js`, `scaffold.js`.

**Try-Catch Density:**
- Issue: `src/commands/init.js` has 41 try-catch blocks. The source has 296 total try blocks. High catch density makes it hard to understand which errors are expected vs unexpected.
- Impact: Debugging production issues requires tracing through many catch-and-continue paths. `GSD_DEBUG=1` helps but 70 empty `catch {}` blocks produce no output even in debug mode.
- Fix approach: Categorize catches: (1) expected (file not found, optional data) should use `debugLog`, (2) unexpected (corruption, invariant violation) should use `error()`. Convert empty catches to at minimum `debugLog` calls.

**Duplicated Plan/Summary File Matching Logic:**
- Issue: The pattern `files.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md')` appears 20+ times across 7 files. Same for `-SUMMARY.md`.
- Files: `src/lib/helpers.js`, `src/commands/phase.js`, `src/commands/features.js`, `src/commands/misc.js`, `src/commands/intent.js`, `src/commands/verify.js`, `src/commands/init.js`
- Impact: Inconsistent behavior risk — some check `|| f === 'PLAN.md'`, others check only `-PLAN.md`. Changing the naming convention requires updating 20 locations.
- Fix approach: Add `isPlanFile(f)` and `isSummaryFile(f)` helpers to `src/lib/helpers.js` and replace all inline filter predicates.

## Dependencies at Risk

**tokenx Runtime Dependency:**
- Risk: Only npm runtime dependency (along with acorn). If it becomes unmaintained or introduces breaking changes, token estimation falls back to `Math.ceil(text.length / 4)`.
- Impact: Token budget calculations in `src/lib/context.js` would become less accurate, potentially leading to context window overflows.
- Migration plan: The fallback in `src/lib/context.js` already handles tokenx failure gracefully. Could replace with `tiktoken` or `gpt-tokenizer` if needed, but those are larger packages.

**acorn Runtime Dependency:**
- Risk: 230KB bundled JS parser. Lazy-loaded in `src/lib/ast.js:88` inside `parseWithAcorn()`. Used for AST parsing (function signatures, exports, complexity, repo map). Well-maintained (most popular JS parser).
- Impact: If acorn breaks, AST features degrade gracefully (regex-based fallback for non-JS files already exists). JS/TS-specific features (complexity, signatures) would lose accuracy.
- Migration plan: acorn is actively maintained. Alternative would be `@babel/parser` but it's significantly larger.

**notebooklm-py (Unofficial API):**
- Risk: The NotebookLM integration in `src/commands/research.js` depends on `notebooklm-py`, which wraps an unofficial Google API. Google could change or disable the API at any time.
- Impact: Tier 1 research (full RAG synthesis) would become unavailable. The 4-tier degradation handles this gracefully — Tier 2+ continues to function.
- Migration plan: Research pipeline is designed for this eventuality. NotebookLM is explicitly "a quality enhancer, never a requirement" per PROJECT.md decisions.

## Test Coverage Gaps

**Router Argument Edge Cases:**
- What's not tested: Flag parsing in `src/router.js` — missing flag values, duplicate flags, flags in unexpected positions, interaction between global flags and command-specific flags.
- Files: `src/router.js:27-96`
- Risk: User invocations with unusual flag combinations could silently produce wrong behavior.
- Priority: Medium — impacts CLI usability but not data integrity.

**Cross-Command Integration (Global State Mutation):**
- What's not tested: `src/commands/features.js:1660-1710` imports `cmdInitProgress`, `cmdInitExecutePhase`, `cmdInitPlanPhase` from init.js for context-budget measurement. These cross-module calls save/restore `global._gsdCompactMode` around each measurement.
- Files: `src/commands/features.js:1660-1710`
- Risk: Global state mutations during measurement could affect output if any called function spawns or nests calls. The save/restore pattern is brittle.
- Priority: Low — context-budget measure is a diagnostic command.

**Frontmatter Reconstruction Round-trip:**
- What's not tested: Complex round-trips through `extractFrontmatter()` → modify → `reconstructFrontmatter()` → `spliceFrontmatter()` for deeply nested structures (nested objects with arrays, multi-line values, special characters).
- Files: `src/lib/frontmatter.js`
- Risk: Writing back modified frontmatter could lose data or produce invalid YAML for complex structures. Affects `state update`, `frontmatter set/merge`, and `phase complete`.
- Priority: High — data loss risk on frontmatter write operations.

**Empty Catch Block Coverage:**
- What's not tested: The 70 empty `catch {}` blocks represent error paths with zero diagnostic capability. If any of these paths trigger in production, there's no way to diagnose what went wrong.
- Files: Distributed across `src/commands/init.js`, `src/lib/codebase-intel.js`, `src/commands/env.js`, `src/lib/cache.js`, `src/commands/codebase.js`
- Risk: Silent failures in file operations, cache operations, or git commands go undetected.
- Priority: Medium — add `debugLog` calls to all empty catch blocks.

## Recommended Actions

**Priority 1 (High Impact, Low Risk):**
1. **Fix stale test documentation** — Verify actual pass/fail counts (812 total tests) and update STATE.md and PROJECT.md accordingly
2. **Remove hardcoded user path** — Replace `/home/cam/.config/oc/get-shit-done` fallback in `src/commands/agent.js:15` with a generic fallback
3. **Add debugLog to empty catch blocks** — Convert 70 empty `catch {}` blocks to `catch { debugLog(...) }` for diagnostic visibility

**Priority 2 (Medium Impact, Medium Risk):**
4. **Extract `isPlanFile()`/`isSummaryFile()` helpers** — Deduplicate 20+ inline file-matching predicates into `src/lib/helpers.js`
5. **Consolidate SKIP_DIRS** — Move to `src/lib/constants.js`, import from `env.js` and `codebase-intel.js`
6. **Extract `parseArgs(args, schema)` helper** — Reduce router boilerplate and add missing-value validation

**Priority 3 (High Impact, Higher Risk):**
7. **Extract compact/manifest helper for init.js** — Reduce 12 repeated `if (global._gsdCompactMode)` blocks to a single helper call
8. **Migrate output to formatter pattern** — Convert high-frequency commands from `output(result, raw)` to `output(result, { formatter })`
9. **Replace globals with options threading** — Pass output configuration via function parameters instead of `global._gsd*`

**Priority 4 (Monitor):**
10. **Bundle size** — At 1163KB (77% of 1500KB budget). Monitor via `build.js` budget tracking. Acorn lazy-loading already reduces effective cold-start to 923KB.
11. **node:sqlite stability** — Track Node.js release notes for `node:sqlite` API changes. The MapBackend fallback provides a safety net.
12. **notebooklm-py availability** — Track the unofficial API status. 4-tier degradation handles loss of Tier 1 gracefully.

---

*Concerns audit: 2026-03-07*
