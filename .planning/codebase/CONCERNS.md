# Codebase Concerns

**Analysis Date:** 2026-02-26

## Tech Debt

**Output Mode Migration Incomplete (176 legacy vs 10 migrated):**
- Issue: v6.0 introduced dual-mode output via `output(result, { formatter })` but 176 command call-sites still use the legacy `output(result, raw)` boolean signature. Only 10 call-sites use the new formatter pattern.
- Files: `src/commands/verify.js`, `src/commands/features.js`, `src/commands/misc.js`, `src/commands/phase.js`, `src/commands/memory.js`, `src/commands/roadmap.js`
- Impact: Legacy commands fall through to JSON output even in TTY mode. Users see raw JSON instead of formatted output for 95% of commands.
- Fix approach: Migrate each command handler one at a time — add a `format*` function and pass it as `{ formatter }` to `output()`. The `src/commands/state.js` and `src/commands/init.js` files show the migrated pattern. Prioritize high-frequency commands: `init`, `state`, `verify`, `phases`.

**Giant Switch Statement Router (791 lines):**
- Issue: `src/router.js` is an 800-line switch statement with hand-rolled argument parsing for every subcommand. Argument extraction is copy-pasted per case: `const phaseIdx = args.indexOf('--phase'); const phase = phaseIdx !== -1 ? args[phaseIdx + 1] : null;`
- Files: `src/router.js`
- Impact: Adding a new subcommand requires ~15 lines of boilerplate argument parsing. Easy to introduce off-by-one errors with `args[idx + 1]`. No validation of flag values (missing `--phase` value silently becomes `undefined`).
- Fix approach: Extract a `parseArgs(args, schema)` helper that declaratively defines flags per command. Define schemas in a map rather than inline. Keep the switch for dispatch but reduce each case to 2-3 lines.

**Compact/Manifest Mode Repetition in init.js:**
- Issue: `src/commands/init.js` has 12 `if (global._gsdCompactMode)` blocks each containing nearly identical compactResult construction and `if (global._gsdManifestMode)` sub-blocks. 25 references to these globals throughout the file.
- Files: `src/commands/init.js` (1,743 lines)
- Impact: Every new init command requires ~40 lines of repeated compact/manifest logic. High risk of field drift between compact and verbose output (e.g., forgetting to include a new field in the compact version).
- Fix approach: Extract a `compactInit(result, fields, manifestFiles)` helper. Each init handler returns a full result object and the helper handles mode-switching, field selection, and manifest generation.

**Duplicated SKIP_DIRS Constants:**
- Issue: Two independent `SKIP_DIRS` Set definitions with nearly identical values exist. The comment in `src/lib/codebase-intel.js:62` says "(matches env.js SKIP_DIRS)" but the lists differ — `codebase-intel.js` includes `.planning` while `env.js` does not.
- Files: `src/commands/env.js:40-43`, `src/lib/codebase-intel.js:63-66`
- Impact: Directory exclusion behavior diverges silently between env scan and codebase analysis. Adding a new skip directory requires remembering to update both.
- Fix approach: Move `SKIP_DIRS` to `src/lib/constants.js` and import from both modules. If `.planning` needs special treatment in one, extend with `new Set([...SKIP_DIRS, '.planning'])`.

**Duplicated Plan/Summary File Matching Logic:**
- Issue: The pattern `files.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md')` appears 20+ times across 7 files. Same for `-SUMMARY.md`. Each occurrence is hand-written inline.
- Files: `src/lib/helpers.js:113-114`, `src/commands/phase.js:64-66`, `src/commands/features.js:364`, `src/commands/misc.js:496-497`, `src/commands/intent.js:1130`, `src/commands/verify.js:1062`, `src/commands/init.js:866-869`
- Impact: Inconsistent behavior risk — some check `|| f === 'PLAN.md'`, others check only `-PLAN.md`. Changing the naming convention requires updating 20 locations.
- Fix approach: Add `isPlanFile(f)` and `isSummaryFile(f)` helpers to `src/lib/helpers.js` and replace all inline filter predicates.

**Style Inconsistency: ES5 var in lifecycle.js:**
- Issue: `src/lib/lifecycle.js` uses `var` declarations (18 occurrences) and ES5-style `function` expressions while the rest of the codebase uses `const`/`let` and ES6+ style consistently.
- Files: `src/lib/lifecycle.js`
- Impact: Purely cosmetic, but makes the file look like it was ported from a different project. Confuses contributors about which style to follow.
- Fix approach: Replace `var` with `const`/`let` throughout. Straightforward find-and-replace.

**Global State for Output Configuration:**
- Issue: Output mode, compact mode, manifest mode, and field filtering are communicated via 4 globals: `global._gsdOutputMode`, `global._gsdCompactMode`, `global._gsdManifestMode`, `global._gsdRequestedFields`. These are set in `src/router.js` and read throughout command handlers.
- Files: `src/router.js:34-82`, `src/lib/output.js:79-105`, `src/commands/init.js` (17 reads), `src/commands/features.js` (8 reads), `src/commands/env.js` (1 read)
- Impact: Globals make testing harder (must save/restore between tests), create coupling between router and commands, and risk state leaks in the context-budget measure command which manipulates `global._gsdCompactMode` directly (`src/commands/features.js:1662-1710`).
- Fix approach: Pass an `options` object through command handlers instead of globals. The `output()` function already supports an options argument — extend to include compact/manifest/fields.

## Known Bugs

**Frontmatter Cache Key Collision Risk:**
- Symptoms: Two different files with identical first 200 characters and identical length would produce the same cache key, causing stale frontmatter to be returned.
- Files: `src/lib/frontmatter.js:20-22`
- Trigger: Cache key is `content.length + ':' + content.slice(0, 200)`. Files with the same YAML frontmatter header pattern and equal total length collide.
- Workaround: Unlikely in practice because file content includes the body which varies. The cache lives only for a single CLI invocation. Low real-world impact.

**Stateful Regex with Global Flag:**
- Symptoms: `PHASE_HEADER` in `src/lib/regex-cache.js:49` uses the `gi` flag. Global regexes maintain `.lastIndex` state across `.exec()` calls. If reused across different strings without resetting, matches may be missed.
- Files: `src/lib/regex-cache.js:49`
- Trigger: Calling `.exec()` or `.test()` on the shared `PHASE_HEADER` regex from multiple callers within one invocation could cause inconsistent results.
- Workaround: Most callers use `matchAll()` or `match()` which reset lastIndex. But any direct `.exec()` usage on this shared regex would be affected.

## Security Considerations

**Shell Command Execution via execSync:**
- Risk: `execSync()` spawns a shell which interprets the command string. User-provided test commands from `config.json` are passed directly to `execSync()`.
- Files: `src/commands/features.js:209` (test-run), `src/commands/verify.js:863` (verify quality), `src/commands/verify.js:1637` (verify deliverables), `src/commands/worktree.js:284` (setup hooks)
- Current mitigation: Test commands come from `.planning/config.json` which is project-controlled. The `execGit()` function in `src/lib/git.js` correctly uses `execFileSync` (no shell), but `execSync` in feature commands does not.
- Recommendations: These are intentional — users configure their own test commands. No external untrusted input reaches these paths. Document that `config.json` test_commands/setup_hooks execute arbitrary shell commands.

**No Input Validation on CLI Arguments:**
- Risk: Missing values for flags (e.g., `gsd-tools state update --phase` with no value) silently pass `undefined` to command handlers.
- Files: `src/router.js` (all flag parsing)
- Current mitigation: Most commands handle `null`/`undefined` gracefully via early returns or error calls.
- Recommendations: Add validation in the argument parser — if a flag expects a value and none follows, emit an error before dispatch.

**JSON.parse Without try-catch in Some Paths:**
- Risk: Several `JSON.parse()` calls could throw on malformed JSON, crashing the CLI with an unhandled error.
- Files: `src/commands/env.js:255`, `src/commands/env.js:459`, `src/commands/worktree.js:34`
- Current mitigation: Most JSON.parse calls are wrapped in try-catch, but a few in `env.js` (reading `package.json`) are inside a broader try-catch that may not provide useful error messages.
- Recommendations: Ensure every `JSON.parse` has a specific try-catch with a user-facing error message identifying which file is malformed.

## Performance Bottlenecks

**Large Init Commands Do Multiple Disk Scans:**
- Problem: `cmdInitExecutePhase` and `cmdInitProgress` in `src/commands/init.js` sequentially call `autoTriggerEnvScan()`, `autoTriggerCodebaseIntel()`, `getIntentDriftData()`, `getIntentSummary()`, and `getPhaseTree()`. Each reads overlapping sets of files.
- Files: `src/commands/init.js:300-396`, `src/commands/init.js:1300-1483`
- Cause: Each subsystem independently reads `.planning/` files. The `cachedReadFile()` helper mitigates repeat reads of the same file, but the initial traversal is still sequential and reads many files.
- Improvement path: Pre-warm the file cache with a single directory walk before calling subsystem functions. The `getPhaseTree()` cache partially does this for phase directories but doesn't cover `STATE.md`, `ROADMAP.md`, `INTENT.md`, etc.

**Synchronous File I/O Throughout:**
- Problem: All 160+ `readFileSync`/`readdirSync` calls are blocking. For a CLI tool that runs one command per invocation, this is acceptable. However, codebase analysis (`src/lib/codebase-intel.js`) walks the entire project tree synchronously.
- Files: `src/lib/codebase-intel.js:160-180` (walkSourceFiles), `src/lib/deps.js` (dependency graph construction)
- Cause: Deliberate design decision — sync I/O is simpler and the CLI exits immediately after one command.
- Improvement path: Only relevant if analysis of very large codebases (>10k files) becomes slow. Async I/O with parallel directory walks would help but adds significant complexity.

**Bundle Size at 681KB (68% of 1000KB Budget):**
- Problem: The single-file bundle is 681KB / 17,032 lines. The `tokenx` dependency adds ~50KB. Growing steadily across v1-v6.
- Files: `bin/gsd-tools.cjs`, `build.js:60` (budget tracking)
- Cause: 21,104 lines of source code across 26 modules, bundled with tokenx dependency.
- Improvement path: Monitor via `build.js` budget tracking. If approaching 1000KB, consider: (1) moving MCP_KNOWN_SERVERS data to an external JSON file, (2) tree-shaking unused exports from `tokenx`, (3) splitting rarely-used commands (websearch, mcp-profile) into separate lazy-loaded chunks.

## Fragile Areas

**YAML Frontmatter Parser (Custom, Not Spec-Compliant):**
- Files: `src/lib/frontmatter.js:15-91`
- Why fragile: Custom YAML parser handles only the subset of YAML used in planning files. Multi-line strings, anchors, flow sequences with nested objects, and edge cases like `key: "value: with colon"` may parse incorrectly. The parser uses indent-tracking with a stack, which breaks on unconventional whitespace.
- Safe modification: Always test against actual planning files from `.planning/phases/`. The 577 tests include frontmatter parsing scenarios.
- Test coverage: Well-tested for common cases, but edge cases around nested objects within arrays and multi-line values are under-tested.

**Must-Haves Block Parser:**
- Files: `src/lib/helpers.js:165-229`
- Why fragile: Parses a deeply nested YAML structure (3 levels: `must_haves > artifacts/key_links > [{path, provides}]`) using hand-rolled line-by-line parsing with hardcoded indent levels (4, 6, 8, 10 spaces). Any change to indentation in plan templates breaks parsing.
- Safe modification: Test with actual `-PLAN.md` files. Prefer not modifying indent expectations without updating all existing plans.
- Test coverage: Covered by verify tests, but sensitive to whitespace changes.

**Milestone Detection in ROADMAP.md:**
- Files: `src/lib/helpers.js:466-535`
- Why fragile: Uses 5 cascading regex strategies to detect the active milestone from freeform markdown. Each strategy targets a different formatting pattern. New ROADMAP formats may not match any strategy.
- Safe modification: Add new strategies as fallbacks (append to the chain, don't modify existing patterns). Test against multiple real ROADMAP.md files.
- Test coverage: Moderate. Each strategy is tested individually but interactions between strategies are not exhaustively covered.

**Router Argument Parsing:**
- Files: `src/router.js:107-788`
- Why fragile: Hand-rolled `args.indexOf('--flag')` + `args[idx + 1]` pattern with no bounds checking. Global flags (`--pretty`, `--raw`, `--fields`, `--verbose`, `--compact`, `--manifest`) are parsed and spliced from args before command dispatch, which can shift indices.
- Safe modification: When adding new commands, copy an existing case block and modify. Never change the order of global flag parsing at the top of `main()`.
- Test coverage: Each command is individually tested, but the argument parsing itself lacks unit tests for edge cases (missing values, duplicate flags, flag ordering).

## Scaling Limits

**Single-File Bundle Architecture:**
- Current capacity: 681KB bundle with 17K lines loads in ~50ms on Node 18+.
- Limit: At ~2MB+ bundle size, cold-start time becomes noticeable (>200ms). At 50K+ lines, debugging via source reading becomes impractical.
- Scaling path: The lazy-loading module pattern in `src/router.js:10-24` already mitigates parse cost. If the bundle exceeds 1MB, consider code-splitting into a main bundle + command bundles loaded dynamically.

**Phase Tree Cache:**
- Current capacity: Handles ~100 phase directories efficiently with single-scan caching.
- Limit: At 500+ phases, the initial `getPhaseTree()` call reads every phase directory and its contents synchronously.
- Scaling path: The milestone archiving system (`src/lib/helpers.js:267-300`) already moves completed phases out of the active tree. This keeps active phase counts manageable.

**Memory Store (Append-Only JSON):**
- Current capacity: Memory stores (`src/commands/memory.js`) use append-only JSON arrays with compaction at 50 entries.
- Limit: Sacred stores (decisions, lessons) never compact. After hundreds of decisions, the JSON file grows unbounded.
- Scaling path: Sacred stores are read-only append. At >1MB per store file, implement pagination or summary extraction. The compaction mechanism for bookmarks/todos is already in place.

## Dependencies at Risk

**tokenx Dependency:**
- Risk: Only runtime dependency. If it becomes unmaintained or introduces breaking changes, token estimation falls back to `Math.ceil(text.length / 4)` — a 4x less accurate heuristic.
- Impact: Token budget calculations in `src/lib/context.js` would become less accurate, potentially leading to context window overflows.
- Migration plan: The fallback in `src/lib/context.js:20-21` already handles tokenx failure gracefully. Could replace with `tiktoken` or `gpt-tokenizer` if needed, but those are larger packages.

**esbuild Dev Dependency:**
- Risk: Build-time only. Well-maintained by the Go team. Low risk.
- Impact: Only affects `npm run build`. If unavailable, the pre-built `bin/gsd-tools.cjs` continues to work.
- Migration plan: Could switch to any other bundler (rollup, webpack) with minimal config change. The build is straightforward CJS bundling.

## Missing Critical Features

**No Async Command Support:**
- Problem: Only `cmdWebsearch` in `src/router.js:541` uses `await`. The `main()` function is async but all other commands are synchronous. Adding commands that need async I/O (e.g., API calls, async test runners) requires modifying the router pattern.
- Blocks: Any future integration with external APIs, async test frameworks, or network-dependent commands.

**No Built-in Help for Subcommand Discovery:**
- Problem: `--help` shows text from `COMMAND_HELP` in `src/lib/constants.js`, but not all commands have help entries. Running a command with wrong subcommands only gets a terse `error('Unknown X subcommand. Available: ...')` with no usage examples.
- Blocks: Self-service usage without consulting documentation.

## Test Coverage Gaps

**Router Argument Edge Cases:**
- What's not tested: Flag parsing in `src/router.js` — missing flag values, duplicate flags, flags in unexpected positions, interaction between global flags and command-specific flags.
- Files: `src/router.js:27-82`
- Risk: User invocations with unusual flag combinations could silently produce wrong behavior (e.g., `gsd-tools state update --phase` with no value passes `undefined`).
- Priority: Medium — impacts CLI usability but not data integrity.

**Cross-Command Integration:**
- What's not tested: `src/commands/features.js:1609` imports `cmdInitProgress`, `cmdInitExecutePhase`, `cmdInitPlanPhase` from init.js for context-budget measurement. These cross-module calls manipulate `global._gsdCompactMode` and are tested only at the unit level.
- Files: `src/commands/features.js:1660-1710`
- Risk: Global state mutations during measurement could affect output of concurrent or nested command calls.
- Priority: Low — context-budget measure is a diagnostic command, not a production workflow.

**Frontmatter Reconstruction Round-trip:**
- What's not tested: `extractFrontmatter()` → modify → `reconstructFrontmatter()` → `spliceFrontmatter()` round-trip for complex nested structures (nested objects with arrays, multi-line values, special characters).
- Files: `src/lib/frontmatter.js:93-164`
- Risk: Writing back modified frontmatter could lose data or produce invalid YAML for complex structures. Affects `state update`, `frontmatter set/merge`, and `phase complete`.
- Priority: High — data loss risk on frontmatter write operations.

---

*Concerns audit: 2026-02-26*
