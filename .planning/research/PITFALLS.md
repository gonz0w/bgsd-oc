# Pitfalls Research

**Domain:** Adding SQLite cache layer, agent architecture consolidation, command restructuring, and performance optimization to an existing Node.js single-file CLI tool (1058KB bundle, 751 tests, esbuild pipeline, file-copy deploy)
**Researched:** 2026-03-01
**Confidence:** HIGH — based on codebase analysis (34 src/ modules, 751 tests, existing in-memory Map cache, esbuild bundler config, deploy.sh pipeline), Node.js v25 `node:sqlite` official docs, esbuild native addon documentation, better-sqlite3 bundling issues, and prior v7.1 pitfall research

<!-- section: compact -->
<pitfalls_compact>
**Top pitfalls:**
1. **Native SQLite addon breaks single-file deploy** — use `node:sqlite` (built-in) not `better-sqlite3`; requires Node ≥22.5 and still experimental (Phase: Cache Foundation)
2. **Cache grows stale while markdown stays authoritative** — invalidate on every write via existing `invalidateFileCache()` pattern; hash-stamp entries; never trust cache over disk (Phase: Cache Foundation)
3. **Agent consolidation breaks workflow spawn chains** — map ALL 41+ command wrappers and 19+ workflows to agent roles BEFORE merging; verify no spawn references break (Phase: Agent Audit)
4. **Command rename breaks 751 tests and all workflows** — use alias-based migration: old names work for 1 version, emit deprecation warning, remove in v9.0 (Phase: Command Consolidation)
5. **esbuild bundles WASM blob inflating bundle past 1500KB budget** — if using sql.js WASM, bundle size jumps ~1MB; `node:sqlite` adds 0KB to bundle (Phase: Cache Foundation)

**Tech debt traps:** premature SQLite schema, caching write paths not just reads, over-normalizing markdown into SQL tables, creating a migration framework for a single-file cache

**Security risks:** SQLite file permissions in shared environments, SQL injection from unsanitized markdown content used in queries

**"Looks done but isn't" checks:**
- Cache layer: verify `cachedReadFile()` and SQLite cache return IDENTICAL results for all 751 tests
- Agent consolidation: verify every workflow `.md` file's agent spawn references resolve to an existing agent
- Command rename: verify all 41 command wrappers in `commands/` use new names or valid aliases
- Performance: verify `GSD_PROFILE=1` baselines show improvement, not regression
</pitfalls_compact>
<!-- /section -->

<!-- section: critical_pitfalls -->
## Critical Pitfalls

### Pitfall 1: Native SQLite Addon Destroys Single-File Deploy Model

**What goes wrong:**
`better-sqlite3` is a native C++ addon. It compiles a `.node` binary during `npm install` that is platform-specific (linux-x64, darwin-arm64, etc.). esbuild cannot bundle `.node` files — the esbuild documentation explicitly states: "a native `.node` extension has expectations about the layout of the file system that are no longer true after bundling" (esbuild CHANGELOG-2022, issue #2830). The current build pipeline (`build.js`) produces a single `bin/gsd-tools.cjs` file that `deploy.sh` copies to `~/.config/oc/get-shit-done/bin/`. With `better-sqlite3`, deploy must ALSO copy `node_modules/better-sqlite3/build/Release/better_sqlite3.node` — plus ensure the load path resolves correctly from the deployed location.

This breaks three guarantees simultaneously:
- **Single-file deploy:** `deploy.sh` copies `bin/`, `workflows/`, `templates/`, `references/`, `src/`, `agents/`. Adding a native addon means also copying `node_modules/` or the `.node` file, plus updating the require path.
- **Cross-machine portability:** The `.node` binary compiled on the dev machine won't work if deployed to a machine with a different Node.js ABI version (`NODE_MODULE_VERSION` mismatch — documented in better-sqlite3 issue #1411 and multiple Reddit reports).
- **esbuild bundling:** Must mark `better-sqlite3` as `external` in build.js, meaning it's resolved at runtime from `node_modules/`, not bundled.

**Why it happens:**
`better-sqlite3` is the most-recommended SQLite library for Node.js (3,977 dependents on npm). Its synchronous API is a perfect fit for this CLI's synchronous I/O pattern. The temptation is strong. But "best library for a web server" ≠ "best library for a single-file CLI deployed by file copy."

**How to avoid:**
1. **Use `node:sqlite` (built-in).** Node.js v22.5+ includes `node:sqlite` as a built-in module. As of Node v25.7.0, it is **Stability 1.2 (Release Candidate)** — no longer behind `--experimental-sqlite` flag since v23.4.0/v22.13.0. It provides `DatabaseSync` with synchronous API (matching the CLI's sync I/O pattern), requires zero bundle size increase (it's a Node.js built-in), and needs no native compilation.
2. **If `node:sqlite` stability is unacceptable,** use `sql.js` (SQLite compiled to WASM via emscripten). Pure JavaScript, no native addon, esbuild can bundle it. BUT: adds ~1MB WASM blob to bundle (exceeds 1500KB budget) and is 2-5x slower than native SQLite. This is a fallback, not a preference.
3. **NEVER use `better-sqlite3` for this project.** The deployment model is incompatible. Period.
4. **Bump minimum Node.js version to 22.5+ in package.json engines field.** Currently `>=18`. The `node:sqlite` module requires 22.5+. This is a breaking change that must be documented and announced.
5. **Wrap `node:sqlite` import in a try/catch with graceful fallback.** If the user's Node.js doesn't support `node:sqlite`, fall back to the existing in-memory Map cache. The cache is an optimization, not a requirement.

**Warning signs:**
- `better-sqlite3` appears in `package.json` dependencies
- `build.js` adds `better-sqlite3` to `external` array
- `deploy.sh` gains `cp -r node_modules/` lines
- CI/CD runs `npm install` with `--build-from-source` flags
- Bundle size jumps past 1500KB budget

**Phase to address:**
Cache Foundation — the FIRST decision. Technology choice gates everything else.

---

### Pitfall 2: Cache Becomes Source of Truth Instead of Markdown

**What goes wrong:**
The system reads STATE.md, ROADMAP.md, PLAN.md dozens of times per CLI invocation. A SQLite cache eliminates repeated parsing by storing parsed results. But over time, code starts reading from cache WITHOUT checking if the markdown file changed. Three failure modes:

1. **External edit invalidation:** User edits ROADMAP.md in their editor. CLI reads cached version. Agent acts on stale roadmap data. Plans get created for a phase that was restructured.
2. **Write-through failure:** `cmdStatePatch()` writes to STATE.md but doesn't update the cache. Next `cmdStateLoad()` reads stale cache. STATE.md says "Phase 5" but cache says "Phase 4."
3. **Cache corruption silent fallback:** SQLite database file gets corrupted (power loss, concurrent access). CLI silently reads corrupt data instead of falling back to disk parsing. All downstream operations produce garbage.

This is especially dangerous because the project has an established convention: `cachedReadFile()` (helpers.js line 30) explicitly documents "lives for single CLI invocation, no TTL needed." A persistent SQLite cache changes this assumption fundamentally — it persists ACROSS invocations. Every code path that assumes "cache = this invocation only" breaks.

**Why it happens:**
The current in-memory Map cache is inherently safe: it's created at process start and discarded at process exit. There is zero staleness risk. SQLite persistence introduces a new failure mode that didn't exist before. Developers who are used to the "Map cache = always fresh" assumption will not think to add invalidation checks when reading from SQLite.

**How to avoid:**
1. **Hash-based invalidation.** Every cached entry stores the file's `mtime` (from `fs.statSync()`) and size. Before returning cached data, check: `current_mtime === cached_mtime && current_size === cached_size`. If mismatch, re-parse from disk and update cache. This adds one `statSync()` call per read — much cheaper than full file read + regex parsing.
2. **Extend `invalidateFileCache(filePath)` to also invalidate SQLite cache.** Every existing call site that invalidates the Map cache (helpers.js line 46) must also invalidate the SQLite entry. Grep for all `invalidateFileCache` calls and ensure SQLite is included.
3. **Write-through on ALL mutations.** Every command that writes a markdown file (`cmdStatePatch`, `cmdStateUpdate`, `cmdFrontmatterSet`, `cmdFrontmatterMerge`, `cmdMemoryWrite`) must update the SQLite cache in the same operation. Wrap file-write + cache-update in a single function.
4. **Fallback-first design.** If SQLite open fails, cache read fails, or cache data fails validation: silently fall back to disk read. NEVER crash, NEVER return partial data. Match the existing pattern from `cachedReadFile()` which returns `null` on error.
5. **Test with cache AND without cache.** Run the full 751-test suite with SQLite cache enabled AND disabled. Results must be identical. Any difference reveals a cache coherence bug.

**Warning signs:**
- Tests pass with cache but fail without (or vice versa)
- `init execute-phase` output differs between first run (cold cache) and second run (warm cache)
- User reports "I edited ROADMAP.md but the tool still shows old data"
- `GSD_DEBUG=1` shows "cache hit" for a file that was just modified

**Phase to address:**
Cache Foundation — invalidation strategy must be designed before ANY caching code is written.

---

### Pitfall 3: Agent Consolidation Breaks Workflow Spawn References

**What goes wrong:**
The codebase has 11 agent definitions (in `agents/gsd-*.md`) and 41+ command wrappers (in `commands/gsd-*.md`) that spawn agents by name. Workflows (in `workflows/`) reference agents via spawn syntax (e.g., "spawn gsd-executor", "@agent gsd-planner"). If agent `gsd-plan-checker` is merged into `gsd-planner` (consolidation), every workflow that explicitly spawns `gsd-plan-checker` breaks.

The dependency chain is:
```
commands/gsd-plan-phase.md → workflows/plan-phase.md → spawns gsd-planner + gsd-plan-checker
commands/gsd-execute-phase.md → workflows/execute-phase.md → spawns gsd-executor + gsd-verifier
commands/gsd-verify-work.md → workflows/verify-work.md → spawns gsd-verifier
```

Renaming or merging an agent without updating EVERY reference in this chain causes the orchestrator to fail when it tries to spawn a non-existent agent. The host editor renders this as a silent failure (agent doesn't spawn) or an error dialog, depending on implementation.

Additionally, `AGENT_MANIFESTS` in `src/lib/context.js` (line 99) has per-agent field whitelists. If `gsd-plan-checker` is merged into `gsd-planner`, the manifest for `gsd-planner` must be updated to include fields that `gsd-plan-checker` needed (e.g., `plans`, `plan_count`). Missing fields = missing context for the merged agent's checker behavior.

**Why it happens:**
Agent names are string references scattered across markdown files, not typed imports. There's no compile-time checking. A rename that would be caught by a linter in TypeScript is invisible in markdown until runtime.

**How to avoid:**
1. **Build an agent dependency map BEFORE any consolidation.** Run: `grep -r 'gsd-' agents/ commands/ workflows/ | grep -v '.git'` to find every cross-reference. Document which files reference which agents. This is the blast radius analysis.
2. **Consolidation must be a rename-first, merge-second process.** Step 1: Add the new agent name as an alias (existing agent accepts both names). Step 2: Update all references to new name. Step 3: Remove old agent definition. Never do step 3 before step 2.
3. **Update `AGENT_MANIFESTS` in context.js.** When merging agents, the new manifest must be the UNION of both old manifests' fields. A merged `gsd-planner` that also does plan-checking needs: `fields: ['phase_dir', 'phase_number', 'phase_name', 'plan_count', 'research_enabled', 'plan_checker_enabled', 'intent_summary', 'plans']` (union of planner + plan-checker fields).
4. **Add a validation command:** `gsd-tools validate-agents` that reads all workflow `.md` files, extracts agent spawn references, and verifies each referenced agent exists in `agents/`. Run this as part of `deploy.sh` smoke test.
5. **Update `deploy.sh` to verify agent count.** Currently it reports `AGENT_COUNT=$(ls "$AGENT_DIR"/gsd-*.md 2>/dev/null | wc -l)`. After consolidation, the expected count changes. Update the assertion.

**Warning signs:**
- Workflow says "spawn gsd-plan-checker" but `agents/gsd-plan-checker.md` no longer exists
- `init execute-phase --manifest gsd-planner` returns fewer fields than before
- Plan-checking step in `/gsd-plan-phase` silently skips (agent not found, no error)
- Agent count in deploy output drops unexpectedly

**Phase to address:**
Agent Audit — complete the dependency map and consolidation plan BEFORE removing any agent definitions.

---

### Pitfall 4: Command Rename Breaks 751 Tests and External Consumers

**What goes wrong:**
The router.js has 85 `case` branches. Command consolidation (e.g., merging `find-phase`, `list-phases`, `phases` into `phase list`, `phase find`) changes the command string that callers use. Three categories of callers break:

1. **Test suite (751 tests, 17,965 lines).** Tests call commands via `execSync('node bin/gsd-tools.cjs find-phase 3')`. Renaming `find-phase` to `phase find` breaks every test that uses the old name.
2. **Workflow files.** Workflows contain `gsd-tools find-phase` calls. There are 27+ workflow files with embedded CLI calls.
3. **Agent system prompts.** Agent markdown files reference CLI commands for agents to call. `gsd-executor.md` (481 lines) contains multiple `gsd-tools` invocations.
4. **User muscle memory.** External users who've memorized `gsd-tools find-phase` will get errors.

A big-bang rename that changes all commands at once is a 1000+ line diff touching tests, workflows, agents, and the router. If any reference is missed, it causes a runtime failure that may not surface until that specific code path is exercised.

**Why it happens:**
Command names are string identifiers used across a distributed set of markdown and JavaScript files. There's no refactoring tool that renames a CLI command across markdown, JavaScript, and bash contexts simultaneously.

**How to avoid:**
1. **Alias-based migration (MANDATORY).** In router.js, add aliases: `case 'find-phase': /* fall through */ case 'phase': { if (args[1] === 'find') { ... } }`. Old command works, new command works. Both route to the same handler.
2. **Deprecation warnings.** When old command name is used, emit to stderr: `"[DEPRECATED] 'find-phase' is now 'phase find'. Old name will be removed in v9.0."` Use the existing `debugLog` pattern but write to stderr unconditionally.
3. **Migrate tests incrementally.** Don't rename all tests at once. Add new tests using new command names. Mark old-name tests with comments. Remove old names in a future version.
4. **Update workflows and agents IN THE SAME PHASE as the router change.** The command rename, workflow update, and agent update must be atomic — merged in the same commit. Otherwise there's a window where deployed workflows reference commands that don't exist.
5. **Add a `COMMAND_ALIASES` map in constants.js.** `{ 'find-phase': 'phase find', 'list-phases': 'phase list', ... }`. Router checks aliases before failing with "unknown command." This also enables `--help` to show the canonical name.
6. **Contract tests.** The existing snapshot tests for command output must be updated for new command names. But keep old-name snapshots until aliases are removed.

**Warning signs:**
- Tests fail with "Unknown command: find-phase" after rename
- Agent says "running gsd-tools find-phase" and gets an error
- Workflow stops mid-execution because CLI call returned non-zero exit code
- `COMMAND_HELP` entries don't match actual command names

**Phase to address:**
Command Consolidation — implement aliases FIRST (old + new both work), then migrate callers, then (v9.0) remove old names.

---

### Pitfall 5: node:sqlite Experimental Status and Node.js Version Constraint

**What goes wrong:**
`node:sqlite` is Stability 1.2 (Release Candidate) as of Node v25.7.0. The API has changed between versions:
- v22.5.0: Added (experimental, behind `--experimental-sqlite` flag)
- v23.4.0/v22.13.0: Flag removed, but still experimental
- v24.0.0/v22.16.0: `timeout` option added, `aggregate` added
- v25.5.0: `defensive` enabled by default
- v25.7.0: Release Candidate status

The current `package.json` specifies `"node": ">=18"`. Using `node:sqlite` requires bumping to `>=22.5`. Users running Node 18 or 20 (both still in LTS) will get: `Error: Cannot find module 'node:sqlite'`.

Additionally, the API may change before reaching Stability 2 (Stable). Code written against v22.5 API may break on v25 due to new default options (`defensive: true` in v25.5 changes behavior — writes to shadow tables now fail by default).

**Why it happens:**
Node.js built-in SQLite is the RIGHT technology choice for this project (zero bundle impact, sync API, no native addon). But "right choice" doesn't mean "mature choice." Experimental APIs change.

**How to avoid:**
1. **Graceful capability detection.** Wrap `node:sqlite` import in try/catch:
   ```javascript
   let DatabaseSync = null;
   try { ({ DatabaseSync } = require('node:sqlite')); }
   catch { /* node:sqlite not available — cache disabled */ }
   ```
   If `DatabaseSync` is null, all cache operations return `null` and the system falls back to in-memory Map + disk reads (current behavior). Zero degradation for users on older Node.js.
2. **Pin API surface.** Only use `DatabaseSync`, `prepare`, `run`, `all`, `get`, `exec`, `close`. These have been stable since v22.5.0. Avoid newer features (`aggregate`, `createTagStore`, `setAuthorizer`) that were added later and may change.
3. **Isolate SQLite behind an abstraction layer.** Create `src/lib/cache.js` that exports `cacheGet(key)`, `cacheSet(key, value, mtime)`, `cacheInvalidate(key)`, `cacheStats()`. The implementation uses `node:sqlite` if available, in-memory Map otherwise. No other module imports `node:sqlite` directly.
4. **Document the version requirement.** In `AGENTS.md`, `package.json`, and `--help` output: "SQLite cache requires Node.js ≥22.5. Cache is automatically disabled on older versions."
5. **Test on both Node 22 LTS and Node 18.** CI must run tests with cache enabled (Node 22+) AND cache disabled (Node 18). Both must pass.
6. **Use `enableDefensive(false)` explicitly** if schema requires shadow table writes, to avoid behavior change between v24 and v25.

**Warning signs:**
- `npm test` passes on developer's Node 25 but fails on user's Node 20
- SQLite-related error in stack trace for user who didn't opt into caching
- API change in new Node.js version breaks cache silently (wrong results, not crash)
- Build succeeds but smoke test fails on deploy target machine

**Phase to address:**
Cache Foundation — implement capability detection and fallback in the first task.

---

### Pitfall 6: Caching Parsed Markdown Creates Schema Coupling

**What goes wrong:**
ROADMAP.md is parsed by 309+ regex patterns into a structured object: `{ phases: [...], milestones: [...], active_milestone: {...} }`. This parsed result is cached in SQLite. But the parsing logic evolves — new regex patterns are added, field names change, nested structures are restructured. The cached data has the OLD schema. Two failure modes:

1. **Schema mismatch:** Code expects `result.phases[0].status` but cached data has `result.phases[0].state` (field renamed in a parser update). Runtime error.
2. **Missing fields:** New parser extracts `intent_drift_score` from PLAN.md. Cached version doesn't have this field. Code does `if (result.intent_drift_score > 50)` → `undefined > 50` → false → drift never detected.
3. **Schema version hell:** Adding a `schema_version` field to cache entries means writing migration code for a cache that's meant to be disposable. This is over-engineering.

This is especially acute for this codebase because the regex patterns are the product's core logic — they change frequently (309+ patterns accumulated over 7 versions). Caching their output means caching something that changes shape every milestone.

**Why it happens:**
The temptation to cache parsed results (save regex time) conflicts with the reality that parsed results are tightly coupled to parser version. Web applications solve this with database migrations. CLI tools should NOT have migrations for a cache.

**How to avoid:**
1. **Cache raw file content + mtime, NOT parsed results.** The cache stores `(file_path, content_text, mtime, size)`. Parsing happens in-process from cached content. This eliminates schema coupling entirely — the cache is a filesystem accelerator, not a parsed-data store.
2. **If parsed results ARE cached**, use a version stamp: `cache_version = hash(parser_source_code)`. On startup, compute hash of the relevant parser module. If it differs from cached version, invalidate entire cache. Crude but effective.
3. **Make cache disposable.** `gsd-tools cache clear` deletes the SQLite file. No migrations, no schema evolution. If the cache is invalid, nuke it. The system must work perfectly with an empty cache.
4. **Store cache in `.planning/.cache/` directory** (which is already gitignored — confirmed by `.planning/.gitignore`). Cache file is project-scoped, not global. Different projects don't pollute each other's cache.

**Warning signs:**
- Cache entry has a `CREATE TABLE` with >5 columns (over-structured for a cache)
- Migration code appears for cache schema
- Tests create SQLite databases with specific schema versions
- Error messages mention "cache schema mismatch" or "migration needed"

**Phase to address:**
Cache Foundation — decide "cache raw content" vs "cache parsed results" in the architecture phase. Strong recommendation: cache raw content only.

<!-- /section -->

<!-- section: tech_debt -->
## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Cache parsed results instead of raw content | Saves regex parsing time (~5ms per file) | Schema coupling; cache invalidation bugs; migration complexity | Never for this project — regex parsing is fast enough |
| Skip alias migration for command renames | Simpler router, fewer code paths | All external consumers break simultaneously; no migration path | Never — backward compat is a project constraint |
| Merge agents without updating manifests | Faster consolidation | Merged agent gets wrong context; token waste or missing data | Never — manifest is the agent's contract |
| Hard-code Node.js ≥22.5 without fallback | Simpler code; no conditional imports | Users on Node 18/20 LTS can't use the tool AT ALL | Only when Node 22 reaches "Maintenance" LTS phase |
| Global SQLite cache file (`~/.cache/gsd/`) | Shared cache across projects | Cross-project data leakage; wrong project's data served | Never — cache must be project-scoped |
| Bypass existing `invalidateFileCache()` for SQLite | Avoid touching helpers.js | Two invalidation systems drift; one gets stale | Never — extend existing function |

## Integration Gotchas

Common mistakes when connecting cache layer to existing systems.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `cachedReadFile()` → SQLite | Replacing Map cache with SQLite entirely | Layer SQLite UNDER Map cache: SQLite → Map → disk. Map is per-invocation L1; SQLite is cross-invocation L2 |
| `getPhaseTree()` → SQLite | Caching the full phase tree object | Cache individual file contents; let `getPhaseTree()` build the tree from cached file reads |
| `init execute-phase` → SQLite | Caching the full init output blob | Cache input files (STATE.md, ROADMAP.md, plans); let init re-compose from cached inputs |
| `cmdStatePatch()` → SQLite | Forgetting to invalidate cache after write | Add `cacheInvalidate(statePath)` call inside `cmdStatePatch()` immediately after `fs.writeFileSync()` |
| `deploy.sh` → SQLite | Deploying the cache database file | Add `.planning/.cache/*.db` to deploy exclusion; cache is per-machine, not deployable |
| `npm test` → SQLite | Tests sharing a SQLite cache between test cases | Each test creates its own temp directory; SQLite file is inside the temp directory; zero shared state |
| Agent manifest → consolidated agent | Keeping old manifest key for removed agent | Remove old key from `AGENT_MANIFESTS`; add combined manifest under new agent name |
<!-- /section -->

<!-- section: performance -->
## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Opening SQLite connection per CLI invocation | 10-30ms overhead per command; negates caching benefit for fast commands | Lazy-open: only connect to SQLite if a cache-eligible read is requested | Always — every invocation pays the cost |
| WAL mode on network filesystem | SQLite WAL requires shared memory; NFS doesn't support it; silent corruption | Use `journal_mode=DELETE` for safety, or detect filesystem type first | When `.planning/` is on NFS/CIFS/SMB mount |
| Caching files that are rarely re-read | SQLite write overhead for files read once per invocation; net slower | Only cache files read 2+ times per invocation: STATE.md, ROADMAP.md, config.json | Immediately — most files are read once |
| Full-table scan for cache lookup | `SELECT * FROM cache WHERE path = ?` without index | `CREATE INDEX idx_path ON cache(path)` | At ~100 cached files (unlikely, but defensive) |
| Synchronous SQLite blocking process exit | `database.close()` not called; SQLite WAL checkpoint blocks on exit | Register `process.on('exit', () => db.close())` or use `Symbol.dispose` | When WAL mode is enabled and writes pending |
| Profiling with `GSD_PROFILE=1` but not measuring cache hit rate | Can't tell if cache is helping or hurting | Add cache hit/miss counters to profiler output; export via `cacheStats()` | Can't diagnose performance issues without this |
<!-- /section -->

<!-- section: security -->
## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| SQLite file readable by other users | Other processes on shared machine can read cached project data | `fs.chmodSync(dbPath, 0o600)` after creation; verify umask |
| SQL injection from markdown content | Markdown content containing `'; DROP TABLE` stored via string concatenation | Always use parameterized queries (`db.prepare('INSERT INTO cache VALUES (?, ?)').run(path, content)`); never interpolate |
| Cache file path traversal | Attacker-crafted file path in cache key escapes `.planning/` | Validate all cache keys: `path.resolve(key).startsWith(path.resolve(cwd))` |
| Stale cache serving old security patches | Security fix in PLAN.md not picked up because cache serves pre-fix version | mtime-based invalidation catches this; but test explicitly |
<!-- /section -->

<!-- section: ux -->
## UX Pitfalls

Common user experience mistakes when restructuring CLI commands.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Removing old command names without deprecation period | User scripts and muscle memory break instantly | Alias old → new for one major version; deprecation warning to stderr |
| Consolidating too many concepts under one command | `phase` command with 15 subcommands is as bad as 15 separate commands | Max 7 subcommands per parent command; group by user intent, not implementation |
| Changing output format during rename | Command works but output JSON schema changed; downstream consumers break | Renames ONLY change the command name; output schema stays identical |
| Silent cache degradation | User doesn't know cache is disabled because Node.js is too old | On first run, if cache unavailable: `[info] SQLite cache unavailable (Node.js >=22.5 required). Using in-memory cache.` |
| Help text showing only new names | User tries `--help` with old name, gets "unknown command" | Help system resolves aliases: `gsd-tools find-phase --help` shows help AND says "Note: this command is now `phase find`" |
<!-- /section -->

<!-- section: looks_done -->
## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **SQLite cache "works":** Run full 751-test suite with `NODE_SQLITE_CACHE=1` AND `NODE_SQLITE_CACHE=0`. Both must produce identical results. Any diff = cache coherence bug.
- [ ] **Cache invalidation "complete":** Edit STATE.md externally (via editor, not CLI). Run `gsd-tools state` twice. Second run must show the edited content, not cached stale content. Verify mtime check works.
- [ ] **Agent consolidation "safe":** Run `grep -r 'gsd-plan-checker\|gsd-codebase-mapper\|gsd-integration-checker' workflows/ commands/ agents/` — zero hits for any removed agent name. All references updated.
- [ ] **Command aliases "working":** Old command name produces identical output to new command name. `gsd-tools find-phase 3` === `gsd-tools phase find 3`. Deprecation warning goes to stderr, not stdout (would corrupt JSON piping).
- [ ] **Bundle size "within budget":** After adding cache module, `build.js` reports ≤1500KB. If using `node:sqlite` (built-in), bundle size should be unchanged (~1058KB).
- [ ] **Node 18 fallback "graceful":** On Node 18, tool starts without errors. Cache features silently disabled. All existing functionality works. `GSD_DEBUG=1` shows "node:sqlite not available."
- [ ] **deploy.sh "updated":** After agent consolidation, `AGENT_COUNT` matches new expected count. Old agent files are NOT deployed. `.planning/.cache/*.db` is NOT deployed.
- [ ] **Manifest "merged":** After merging `gsd-plan-checker` into `gsd-planner`, run `gsd-tools init execute-phase --manifest gsd-planner`. Output includes fields from BOTH old manifests: `plans`, `plan_count`, `phase_dir`, `phase_number`, `phase_name`, `research_enabled`, `plan_checker_enabled`, `intent_summary`.
<!-- /section -->

<!-- section: recovery -->
## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Native addon breaks deploy (P1) | HIGH | Remove `better-sqlite3`; refactor all SQLite code to use `node:sqlite` or remove cache entirely |
| Cache serves stale data (P2) | LOW | `gsd-tools cache clear` (delete SQLite file); fix invalidation logic; re-run |
| Agent spawn reference broken (P3) | MEDIUM | Grep all workflow/command files; add missing agent definitions or fix references; re-deploy |
| Command rename breaks tests (P4) | MEDIUM | Add aliases for old names in router.js; all tests pass again immediately; migrate incrementally |
| Node.js version too old (P5) | LOW | Cache auto-disables; no recovery needed; user upgrades Node.js when ready |
| Schema coupling in cache (P6) | LOW | Delete cache file; it rebuilds automatically on next run |
| Agent manifest incomplete (P3) | LOW | Update `AGENT_MANIFESTS` in context.js; merged agent gets full field set |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| P1: Native addon breaks deploy | Cache Foundation (technology decision) | `build.js` produces single file; `deploy.sh` succeeds; no `node_modules/` copied |
| P2: Cache serves stale data | Cache Foundation (invalidation strategy) | Edit-then-read test: external edit → CLI reads fresh content |
| P3: Agent spawn references break | Agent Audit (dependency map) | `validate-agents` command returns zero errors; all workflow spawns resolve |
| P4: Command rename breaks callers | Command Consolidation (aliases) | Old AND new command names produce identical output |
| P5: node:sqlite experimental | Cache Foundation (capability detection) | Tests pass on Node 18 (no cache) AND Node 22+ (with cache) |
| P6: Schema coupling in cache | Cache Foundation (architecture) | Cache stores raw content only; no schema version field; `cache clear` fully recovers |
<!-- /section -->

<!-- section: sources -->
## Sources

- **Node.js v25.7.0 `node:sqlite` docs** (https://nodejs.org/api/sqlite.html): Stability 1.2 Release Candidate; `DatabaseSync` synchronous API; available since v22.5.0; flag removed since v23.4.0/v22.13.0 — HIGH confidence
- **esbuild CHANGELOG-2022** (via Context7, /evanw/esbuild): Native `.node` extensions cannot be bundled; must use `external` flag; packages must be resolved at runtime from `node_modules` — HIGH confidence
- **better-sqlite3 npm page** (https://www.npmjs.com/package/better-sqlite3): 3,977 dependents; requires native compilation; prebuilt binaries for LTS only — HIGH confidence
- **esbuild issue #2830** (https://github.com/evanw/esbuild/issues/2830): SQLite3 prebuilt binaries cannot be bundled; require external + manual file copy — HIGH confidence
- **better-sqlite3 issue #1411** (https://github.com/WiseLibs/better-sqlite3/issues/1411): Build fails on Node 25; native compilation fragility — HIGH confidence
- **sql.js** (https://github.com/sql-js/sql.js): SQLite compiled to WASM; pure JS; no native addon; ~1MB bundle size — HIGH confidence
- **SQLite corruption docs** (https://www.sqlite.org/howtocorrupt.html): Cache invalidation failures, WAL mode on network filesystems — HIGH confidence
- **Codebase analysis:** `build.js` (94 lines, esbuild config with external Node builtins), `deploy.sh` (87 lines, file-copy deploy), `src/lib/helpers.js` (946 lines, Map cache, `cachedReadFile`, `invalidateFileCache`), `src/lib/context.js` (389 lines, `AGENT_MANIFESTS`), `src/router.js` (947 lines, 85 case branches), `package.json` (engines: `>=18`)
- **Prior v7.1 PITFALLS.md:** Integration gotchas for file cache invalidation after branch switch, worktree namespace separation — directly applicable patterns

---
*Pitfalls research for: GSD Plugin v8.0 Performance & Agent Architecture*
*Researched: 2026-03-01*
