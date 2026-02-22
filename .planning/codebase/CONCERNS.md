# Codebase Concerns

**Analysis Date:** 2026-02-21

## Architecture Concerns

**Single-File Monolith (6,495 lines):**
- Issue: All 79 command functions, helpers, parsers, and the CLI router live in one file: `bin/gsd-tools.cjs`
- Files: `bin/gsd-tools.cjs`
- Impact: Navigating, debugging, and modifying the file is increasingly difficult. Finding a specific function requires searching through 6,495 lines. No module boundaries enforce separation of concerns.
- Fix approach: This is an **intentional design choice** documented in `AGENTS.md` line 36 ("Single-file CLI: gsd-tools.cjs stays as one file (Node.js, zero dependencies)"). Splitting would require rethinking deployment (deploy.sh copies `bin/` wholesale). If ever refactored, consider splitting by domain (state, roadmap, phase, verify, scaffold, init, features) while bundling to a single file at deploy time.

**Duplicated Config Defaults:**
- Issue: Default configuration values are defined in two separate locations with slightly different shapes — `loadConfig()` at line 158 and `cmdConfigEnsureSection()` at line 616
- Files: `bin/gsd-tools.cjs` lines 158–206 and 616–635
- Impact: When a new config key is added, both locations must be updated. The shape differs: `loadConfig()` flattens `workflow.*` keys to top-level (`research`, `plan_checker`, `verifier`), while `cmdConfigEnsureSection()` preserves the nested `workflow: { research, plan_check, verifier }` structure. This mismatch means config written by `config-ensure-section` has different key names than what `loadConfig()` looks for.
- Fix approach: Extract a single `CONFIG_DEFAULTS` constant at module level. Both functions should reference it. Use a normalize step that handles nested→flat translation consistently.

**Two Config Loading Approaches:**
- Issue: `loadConfig()` (line 156) reads config from `.planning/config.json` with a flat key model, but `cmdValidateConfig()` (line 5932) has its own `knownKeys` schema definition with different field names (e.g., `research_enabled` vs `research`, `mode` vs `model_profile`)
- Files: `bin/gsd-tools.cjs` lines 156–206 and 5932–5945
- Impact: The validation command may report false "unknown key" warnings for keys that `loadConfig()` actually reads (like `workflow` nested keys). Schema drift is inevitable without a single source of truth.
- Fix approach: Define one canonical schema that both `loadConfig()` and `cmdValidateConfig()` reference.

## Code Quality

**55 Silent Catch Blocks:**
- Issue: There are 55 instances of `} catch {}` throughout the code — empty catch blocks that silently swallow errors
- Files: `bin/gsd-tools.cjs` — lines 553, 555, 750, 1068, 2593, 2758, 2829, 2897, 2955, 3311, 3420, 3423, 3503, 3560, 3622, 3642, 3720, 3761, 3780, 3802, 3934, 4108, 4190, 4442, 4466, 4555, 4596, 4725, 4760, 4762, 4809, 4811, 4820, 4859, 4941, 4949, 5024, 5043, 5064, 5295, 5312, 5372, 5413, 5494, 5612, 5640, 5691, 5714, 5731, 5771, 5790, 5803, 5851, 5900, 6011
- Impact: When parsing fails, file reads fail, or git commands fail, errors are silently ignored. This makes debugging extremely difficult — a corrupted STATE.md or malformed ROADMAP.md will produce incorrect output with no indication of what went wrong. For example, `cmdStateLoad()` (line 1066–1068) silently returns empty string if STATE.md read fails, and `getSessionDiffSummary()` (line 5002–5008) silently returns null if git log fails.
- Fix approach: Replace empty catches with at minimum a debug log. For functions that return data, use explicit null/error sentinel values. Most of these are "optional data" patterns where `null` is valid, but at least 10–15 of them mask genuine bugs.

**Regex-Heavy Markdown Parsing — Fragility Risk:**
- Issue: Over 309 regex patterns are used for parsing markdown structure (headings, checkboxes, bold fields, frontmatter, tables). The core abstraction is `**FieldName:** value` pattern matching, which appears in ~20 variations across the codebase.
- Files: `bin/gsd-tools.cjs` — throughout, especially lines 920–935 (phase section extraction), 966–972 (goal/criteria parsing), 1117–1129 (state field extraction), 2544–2598 (roadmap analysis), 4244–4311 (milestone detection)
- Impact: Markdown is not a formally specified data format for structured data. Minor formatting changes (extra whitespace, different heading levels, inconsistent bold markers) can break parsing. The backward compatibility rule (`AGENTS.md` line 34: "All regex/parser changes must accept both old and new formats") means patterns accumulate complexity over time — e.g., `**Goal:?**:?` accepts 4 format variations. This is manageable today but becomes increasingly fragile.
- Fix approach: Continue with regex (the alternative — a markdown AST parser — would add dependencies violating the zero-dependency constraint). Improve resilience by adding more test coverage for edge cases. Consider moving structured data to frontmatter YAML (which already has a parser) rather than inline bold fields.

**Custom YAML Parser:**
- Issue: The `extractFrontmatter()` function (lines 251–323) is a hand-rolled YAML parser that handles a subset of YAML: simple key-value, inline arrays, nested objects, and array items. It does NOT handle: multi-line strings, anchors/aliases, flow mappings, comments, or type coercion (numbers stay as strings).
- Files: `bin/gsd-tools.cjs` lines 251–323
- Impact: Frontmatter with complex YAML features will silently misparsed or ignored. For example, a value like `name: "Phase: Setup"` works, but `name: Phase: Setup` would be parsed as key="name", value="Phase", losing ": Setup". The parser handles the project's current usage well but is brittle for edge cases.
- Fix approach: This is acceptable given the zero-dependency constraint. Add more test cases covering edge cases. Document what YAML subset is supported.

**Test Coverage Gap:**
- Issue: The test file (`bin/gsd-tools.test.cjs`, 2,302 lines) covers 19 `describe` blocks, but the main file has 79 `cmd*` functions. That means ~60 command functions have zero test coverage, including security-sensitive ones like `cmdCommit`, `cmdTestRun`, `cmdWebsearch`, and `cmdCodebaseImpact`.
- Files: `bin/gsd-tools.test.cjs` — covers: history-digest, phases-list, roadmap-get-phase, phase-next-decimal, phase-plan-index, state-snapshot, summary-extract, init, roadmap-analyze, phase-add, phase-insert, phase-remove, phase-complete, milestone-complete, validate-consistency, progress, todo-complete, scaffold
- Impact: Regressions in untested commands go undetected. The state management commands (`state update`, `state patch`, `state add-decision`, etc.), all verify commands, frontmatter CRUD, template fill, websearch, and all 15 new feature commands (session-diff through quick-summary) have no tests.
- Fix approach: Prioritize testing for: (1) state mutation commands (data loss risk), (2) commit command (side effects), (3) frontmatter CRUD (data corruption risk), (4) verify commands (false positive/negative risk).

**Stale Documentation:**
- Issue: `AGENTS.md` line 11 says "5400+ lines" but the file is 6,495 lines. Line 91 notes this discrepancy but it hasn't been fixed.
- Files: `AGENTS.md` line 11
- Impact: Minor — misleading documentation only.
- Fix approach: Update line count in AGENTS.md.

## Security

**Shell Command Injection Surface (Low Risk):**
- Risk: Low (CLI tool run by developer, not a server)
- Issue: Several places pass user-derived strings directly into shell commands via `execSync()`:
  - `getSessionDiffSummary()` line 5002: `git log --since="${since}"` where `since` comes from STATE.md parsing (attacker would need to modify STATE.md)
  - `cmdSessionDiff()` line 5034: Same pattern with `since` from STATE.md
  - `cmdCodebaseImpact()` line 5628: `grep -rl "${pattern}"` where `pattern` is derived from file content (module names)
  - `cmdTestRun()` line 5213: Executes `command` from `config.json test_commands` — this is intentionally user-controlled
  - Line 4460: `find . -maxdepth 3 ...` — hardcoded, no user input
- Files: `bin/gsd-tools.cjs` lines 5002, 5034, 5048, 5057, 5628
- Mitigation: The `execGit()` helper (line 221) properly escapes arguments. The `since` variable is validated by regex (`\d{4}-\d{2}-\d{2}`) before use in most cases. The `grep` pattern (line 5628) in `cmdCodebaseImpact()` uses double-quotes which prevents most injection but a module name containing `$(...)` or backticks could execute arbitrary code.
- Recommendations: (1) Validate `since` dates with a strict regex before shell interpolation. (2) Use `execSync` with array-style arguments where possible. (3) For `grep` patterns, sanitize or use `--fixed-strings` flag.

**Temp File Not Cleaned Up:**
- Risk: Low
- Issue: The `output()` function (line 472–475) writes large JSON payloads to temp files at `os.tmpdir()/gsd-{timestamp}.json` but never cleans them up. These accumulate over time.
- Files: `bin/gsd-tools.cjs` lines 472–476
- Impact: Minor disk usage. Temp files may contain planning data (phase info, roadmap analysis) that persists on disk indefinitely.
- Fix approach: Add cleanup on exit or use a fixed filename that gets overwritten.

**Brave API Key Storage:**
- Risk: Low
- Issue: The Brave Search API key can be stored in a plaintext file at `~/.gsd/brave_api_key` (line 601). This is a common pattern for CLI tools but worth noting.
- Files: `bin/gsd-tools.cjs` lines 601–602, 2114
- Impact: API key exposed to any process that can read the user's home directory.
- Fix approach: Acceptable for CLI tool usage. The `process.env.BRAVE_API_KEY` alternative is preferred.

## Performance

**Synchronous File I/O Throughout:**
- Problem: Every file operation uses synchronous calls (`fs.readFileSync`, `fs.readdirSync`, `fs.writeFileSync`, `execSync`). The entire tool blocks on each operation.
- Files: `bin/gsd-tools.cjs` — throughout (the only `async` function is `cmdWebsearch()` which uses `fetch`)
- Cause: Simpler code, and the tool is a short-lived CLI process, not a server.
- Impact: For typical usage (reading a few markdown files), this is imperceptible. For commands like `cmdHistoryDigest()` or `cmdRoadmapAnalyze()` that scan many phase directories, or `cmdCodebaseImpact()` that runs multiple `grep` commands, it could be noticeable on large projects. Not a real problem today.
- Improvement path: Not worth changing — synchronous I/O is appropriate for a CLI tool.

**`cmdCodebaseImpact()` Runs Multiple Greps:**
- Problem: For each file analyzed, runs `grep -rl` across the entire codebase (line 5628), potentially multiple times per file (one per search pattern). Each grep spawns a child process.
- Files: `bin/gsd-tools.cjs` lines 5626–5641
- Cause: No dependency graph; relies on text search.
- Impact: On large codebases with many source files, this could take several seconds per file. The 15-second timeout (line 5630) limits worst-case but multiple files could still take a minute.
- Improvement path: Batch all patterns into a single grep call. Consider using a dependency graph (for Elixir: parse `defmodule`/`alias`/`import`; for TS/JS: parse import statements) instead of brute-force text search.

**Repeated File Reads:**
- Problem: Some commands re-read the same files multiple times. For example, `cmdPhaseComplete()` reads `ROADMAP.md`, `STATE.md`, and phase directories independently, then `cmdRoadmapAnalyze()` (if called later) reads them all again. Within a single CLI invocation this isn't an issue, but the init commands (e.g., `cmdInitProgress()` at line ~4700) often call multiple internal functions that each read the same files.
- Files: `bin/gsd-tools.cjs` — init commands (~lines 4313–4990)
- Impact: Negligible for current usage — each command runs once per invocation.

## Known Limitations

**Zero Dependencies:**
- Limitation: The tool deliberately uses no npm dependencies (`AGENTS.md` line 36). This means no proper YAML parser, no markdown AST, no argument parser library, no test framework dependencies.
- Context: Simplifies deployment (just copy files), eliminates supply chain risk, but forces hand-rolled parsing for everything.

**No Argument Parsing Library:**
- Limitation: CLI arguments are parsed manually in the `main()` function (lines 6022–6492) using index-based lookups (`args.indexOf('--flag')`). There's no validation, no help text generation, no type coercion, no required argument checking at the router level.
- Files: `bin/gsd-tools.cjs` lines 6022–6492
- Context: Works fine for current command set but error messages for misused commands are inconsistent — some commands check for missing args, others silently use `null`.

**Markdown Format Lock-in:**
- Limitation: All project state (ROADMAP.md, STATE.md, PLAN.md, SUMMARY.md) is stored in markdown with specific formatting conventions. Moving to a different format would require rewriting all 309+ regex patterns.
- Context: Markdown is human-readable and git-friendly, which are core requirements. But the parsing is inherently fragile.

**No Concurrent Write Protection:**
- Limitation: Multiple processes/sessions writing to the same STATE.md or ROADMAP.md simultaneously could corrupt them. There's no file locking or atomic write mechanism.
- Files: `bin/gsd-tools.cjs` — all `fs.writeFileSync` calls
- Context: In practice, only one AI session runs at a time per project, so this is unlikely. But `cmdCommit()` could race with a human `git add`.

**Context Window Assumptions Hardcoded:**
- Limitation: `cmdContextBudget()` assumes a 200K context window and 50% target usage (lines 5137–5139). These values are hardcoded rather than configurable.
- Files: `bin/gsd-tools.cjs` lines 5137–5139
- Context: Different models have different context sizes. This should be configurable via `config.json`.

**Elixir-Biased Codebase Analysis:**
- Limitation: `cmdCodebaseImpact()` (line 5570) has the most sophisticated analysis for Elixir (defmodule extraction, alias matching). Go, TypeScript, and Python support is basic (directory name or filename matching).
- Files: `bin/gsd-tools.cjs` lines 5593–5623
- Context: Reflects the tool's origin project (EventPipeline is Elixir-based). Should be improved for Go and TypeScript if used broadly.

## TODOs in Code

- No `TODO`, `FIXME`, `HACK`, or `XXX` comments exist in `bin/gsd-tools.cjs` or `bin/gsd-tools.test.cjs`.
- TODOs referenced in workflow/template files are example content for templates, not actual debt markers.

## Fragile Areas

**Milestone Detection (`getMilestoneInfo()`):**
- Files: `bin/gsd-tools.cjs` lines 4244–4311
- Why fragile: Uses 5 fallback strategies with increasingly loose pattern matching. Strategy 5 (line 4300) just grabs any `v\d+.\d+` pattern. Each strategy depends on specific emoji (🔵, ✅) and markdown formatting. If ROADMAP.md uses slightly different milestone formatting, wrong milestone could be detected.
- Safe modification: Always test with the real event-pipeline ROADMAP.md (as documented in `AGENTS.md` line 33).
- Test coverage: Partially covered via `init` command tests, but milestone-specific edge cases not directly tested.

**Phase Section Extraction (`cmdRoadmapGetPhase()`):**
- Files: `bin/gsd-tools.cjs` lines 916–987
- Why fragile: Extracts a section between two heading-level phase markers. If headings use inconsistent levels (## vs ### vs ####), the section boundary detection fails. The `#{2,4}` pattern handles 3 levels but not `#` (h1) or `#####` (h5+).
- Safe modification: Test with phases that have decimal numbers (e.g., 12.1, 12.2) as these have additional complexity.

**`cmdPhaseInsert()` — Roadmap Manipulation:**
- Files: `bin/gsd-tools.cjs` lines ~2700–2830
- Why fragile: Inserts text into ROADMAP.md at calculated positions. Uses regex to find insertion points. If the roadmap has unexpected structure (missing checklist, different heading format), insertion could corrupt the file.
- Test coverage: Has dedicated test suite.

## Dependencies at Risk

**Node.js Built-in `fetch()`:**
- Risk: `cmdWebsearch()` uses global `fetch()` which requires Node.js 18+ (or 17.5+ with `--experimental-fetch`). No version check or graceful fallback.
- Files: `bin/gsd-tools.cjs` line 2140
- Impact: On Node.js < 18, the websearch command throws a `ReferenceError: fetch is not defined`.
- Migration plan: Add a version check, or use `require('https')` as fallback.

**No package.json:**
- Risk: There's no `package.json` in the project, so no declared Node.js version requirement, no `engines` field, no scripts.
- Impact: Users have no way to know the minimum Node.js version required. No `npm test` script for running tests.

## Missing Critical Features

**No `--help` Per Command:**
- Problem: Running `node gsd-tools.cjs state` shows available subcommands, but there's no per-command help. `node gsd-tools.cjs state patch --help` doesn't work — it would try to use `--help` as a field name.
- Blocks: New users have to read source code or AGENTS.md to understand argument format.

**No Config Migration:**
- Problem: When new config keys are added, existing `config.json` files don't get them. `loadConfig()` handles this via defaults, but `cmdValidateConfig()` may report them as missing without providing upgrade commands.
- Blocks: Smooth upgrades between versions.

**Workflow Integration Gaps (from AGENTS.md):**
- Problem: Several features built in `gsd-tools.cjs` are not wired into workflows:
  - `validate-dependencies` is not called by `execute-phase` workflow as a pre-flight check
  - `search-lessons` is not called by `plan-phase` to auto-surface relevant lessons
  - `context-budget` is not called by `execute-plan` to warn about large plans
  - 11 new commands have no corresponding slash commands in `~/.config/opencode/command/`
- Files: `AGENTS.md` lines 83–91 (documents these as "Optional Next Steps")
- Blocks: Features exist but are unreachable unless manually invoked.

## Test Coverage Gaps

**State Mutation Commands:**
- What's not tested: `cmdStateUpdate`, `cmdStatePatch`, `cmdStateAdvancePlan`, `cmdStateRecordMetric`, `cmdStateAddDecision`, `cmdStateAddBlocker`, `cmdStateResolveBlocker`, `cmdStateRecordSession`
- Files: `bin/gsd-tools.cjs` lines 1108–1424
- Risk: These modify STATE.md in place. A regex pattern error could corrupt or lose state data without detection.
- Priority: **High** — data mutation without tests is the highest-risk gap.

**Frontmatter CRUD:**
- What's not tested: `cmdFrontmatterGet`, `cmdFrontmatterSet`, `cmdFrontmatterMerge`, `cmdFrontmatterValidate`
- Files: `bin/gsd-tools.cjs` lines 2177–2260
- Risk: Frontmatter set/merge modify files in place. The `reconstructFrontmatter()` function could lose data if it doesn't handle a YAML structure that `extractFrontmatter()` parsed.
- Priority: **High** — round-trip data integrity not verified.

**Verify Suite:**
- What's not tested: `cmdVerifyPlanStructure`, `cmdVerifyReferences`, `cmdVerifyCommits`, `cmdVerifyArtifacts`, `cmdVerifyKeyLinks`
- Files: `bin/gsd-tools.cjs` lines 2260–2528
- Risk: False positives or false negatives in verification could lead to premature phase completion or unnecessary rework.
- Priority: **Medium**

**New Features (session-diff through quick-summary):**
- What's not tested: All 15 feature commands added in commit `6212eeb`: `cmdSessionDiff`, `cmdContextBudget`, `cmdTestRun`, `cmdSearchDecisions`, `cmdValidateDependencies`, `cmdSearchLessons`, `cmdCodebaseImpact`, `cmdRollbackInfo`, `cmdVelocity`, `cmdTraceRequirement`, `cmdValidateConfig`, `cmdQuickTaskSummary`
- Files: `bin/gsd-tools.cjs` lines 5012–6018
- Risk: These are newer and less battle-tested. Edge cases with missing data, empty results, or unexpected file formats are likely.
- Priority: **Medium** — most are read-only so risk is lower than mutation commands.

**Template Fill:**
- What's not tested: `cmdTemplateFill` — generates pre-filled PLAN.md, SUMMARY.md, and VERIFICATION.md files
- Files: `bin/gsd-tools.cjs` lines ~1700–1900
- Risk: Generated templates might have incorrect structure that fails later verification.
- Priority: **Low** — templates are starting points, not final artifacts.

## Recommended Improvements

**1. Extract Config Schema (Priority: High)**
- Rationale: Three places define config defaults/schema independently. A single `CONFIG_SCHEMA` object would eliminate drift and simplify `loadConfig()`, `cmdConfigEnsureSection()`, and `cmdValidateConfig()`.

**2. Add State Mutation Tests (Priority: High)**
- Rationale: The 8 state mutation commands modify STATE.md in place with regex replacement. Any regression silently corrupts project state.

**3. Replace Silent Catches with Debug Logging (Priority: Medium)**
- Rationale: 55 `} catch {}` blocks mask errors. Add `if (process.env.GSD_DEBUG) console.error(...)` to at least the 15 most critical ones (state reads, git operations, roadmap parsing).

**4. Add Frontmatter Round-Trip Tests (Priority: Medium)**
- Rationale: `extractFrontmatter()` → `reconstructFrontmatter()` round-trip must be lossless. Currently untested.

**5. Sanitize Shell Interpolation in Git Commands (Priority: Medium)**
- Rationale: `since` dates from STATE.md are interpolated into `git log --since="${since}"`. While currently validated by regex in most paths, a centralized sanitizer function would be safer.

**6. Add package.json With engines Field (Priority: Low)**
- Rationale: No declared Node.js version requirement. `fetch()` requires Node 18+. A package.json with `"engines": { "node": ">=18" }` and test scripts would formalize requirements.

**7. Wire Features Into Workflows (Priority: Low)**
- Rationale: 11+ commands exist but aren't accessible via slash commands or automatically invoked by workflows. This is documented in `AGENTS.md` lines 83–91 as "Optional Next Steps."

**8. Tmp File Cleanup (Priority: Low)**
- Rationale: Large JSON outputs create temp files in `os.tmpdir()` that are never cleaned up. Add cleanup or use a fixed path.

---

*Concerns audit: 2026-02-21*
