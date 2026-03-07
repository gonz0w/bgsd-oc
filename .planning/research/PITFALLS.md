# Domain Pitfalls

**Domain:** Cleanup/hardening milestone on a CLI tool with AI agent orchestration (34 src modules, 9 agents, 41 commands, 45 workflows, 762+ tests, 1216KB bundle, SQLite caching, deploy.sh live install)
**Researched:** 2026-03-06
**Confidence:** HIGH — based on codebase analysis (router.js command map, 49 files referencing gsd-tools with 131+ unique invocations), industry literature on dead code removal risks, multi-agent orchestration failure modes (GitHub Engineering blog, ETH Zurich AGENTS.md study), and direct inspection of agent/workflow/reference coupling patterns

<!-- section: compact -->
<pitfalls_compact>
**Top pitfalls:**
1. **Removing "dead" exports that are consumed by 49 agent/workflow markdown files — invisible to static analysis** — Static analysis (tree-shaking, unused export detection) cannot see that `gsd-tools.cjs commit`, `gsd-tools.cjs state`, `gsd-tools.cjs verify` etc. are invoked from markdown prompt files parsed by LLMs at runtime. Removing a "dead" function kills agent capabilities silently. (Phase: Dead Code Audit)
2. **Breaking backward-compat CLI commands during namespace migration** — 37+ non-namespaced command forms (`commit`, `state`, `verify`, `roadmap`, etc.) are still actively used in 49 agent/workflow/reference files. Removing the backward-compat `switch(command)` block in router.js breaks every workflow that hasn't been migrated. (Phase: Command Restructuring)
3. **Refactoring introduces subtle behavioral changes that pass 762 tests but break agent workflows** — Tests verify CLI output structure. They don't verify that agents can parse the output correctly with changed field names, reordered keys, or modified formatting. Agent prompts are brittle consumers of CLI JSON output. (Phase: Performance Tuning / Dead Code Audit)
4. **Over-engineering the audit itself — spending more effort cataloguing debt than fixing it** — Cleanup milestones have a unique failure mode: creating exhaustive spreadsheets of issues, scoring them, prioritizing them, building tooling to detect them... and shipping nothing. The audit IS the trap. (Phase: All)
5. **Deploy.sh breaks when bundle internals change** — deploy.sh copies the bundle to live config. If cleanup changes exports, file paths, or naming conventions, deploy.sh may silently install a broken version. Smoke test coverage in deploy.sh is the only safety net. (Phase: All)

**Tech debt traps:** Building an AST-based dead code detector for markdown files instead of grep; creating a migration tool for command namespaces instead of find-and-replace; adding new abstractions "while we're in here"; making cleanup depend on cleanup (auditing the audit tooling)

**Security risks:** Removing security-related code (sanitizeShellArg, input validation) that appears "unused" because it's defensive; weakening error handling during "simplification"; cache.js changes exposing SQLite file to broader access

**"Looks done but isn't" checks:**
- Dead code removal: Run ALL 762 tests AND deploy to live config AND run every slash command end-to-end through the host editor. Tests alone won't catch workflow breakage.
- Command restructuring: `grep -r "gsd-tools" agents/ workflows/ references/ templates/ commands/` after changes. Every hit must use a working command form.
- Performance tuning: Compare profiler baselines BEFORE and AFTER. "Faster build" ≠ "faster runtime". esbuild bundle time improvements don't help CLI invocation speed.
- Agent architecture: Have each agent process a real task after boundary changes. Manifest token budgets that worked before may overflow after context boundary shifts.
</pitfalls_compact>
<!-- /section -->

<!-- section: critical_pitfalls -->
## Critical Pitfalls

Mistakes that cause rewrites, broken user workflows, or multi-day debugging.

### Pitfall 1: The Invisible Consumer Problem — Agents and Workflows Are Not in the Dependency Graph

**What goes wrong:**
Standard dead code analysis tools (ESLint `no-unused-vars`, esbuild tree-shaking, Knip, ts-prune) analyze JavaScript import/export graphs. They identify functions exported from `src/lib/*.js` but not imported by any other `src/` module as "dead." In this codebase, that analysis is **dangerously wrong** because:

1. **49 markdown files invoke gsd-tools CLI commands** that internally call those "dead" exports. The router.js has 20 lazy-loaded modules mapping 100+ CLI commands to internal functions. Static analysis sees `cmdCommit` exported from `src/commands/misc.js` but never imported directly — because it's accessed via `require('./commands/misc').cmdCommit` in `router.js`, which itself is loaded dynamically.

2. **131+ unique command invocations** exist across agents, workflows, references, and templates — in markdown, not JavaScript. No JavaScript analyzer will find `gsd-tools.cjs verify:state validate --fix` in `agents/gsd-verifier.md`.

3. **Non-namespaced backward-compat commands are still actively used.** The router has a ~350-line backward-compat `switch(command)` block (lines 748-1098+) that maps old command names to the same functions as namespaced commands. Analysis might flag the backward-compat block as redundant. It's not — 37+ old-form commands are still referenced in production workflows.

4. **Agent skill files (`.agents/skills/`) reference CLI commands** at the project level, varying per project. Dead code analysis of the gsd-tools codebase won't see these consumers.

**Why it happens:**
The architecture intentionally decouples CLI commands from their consumers. Commands output JSON to stdout; agents parse that JSON from markdown prompts. This is a good architecture for flexibility but creates an invisible dependency graph that no static analyzer can trace.

**Consequences:**
- Removing an "unused" export silently breaks one or more of 9 agents
- The breakage manifests as an LLM receiving an error message instead of JSON, causing cascading failures in multi-step workflows
- Debugging is extremely hard: the agent doesn't crash — it receives an error string and tries to work around it, producing subtly wrong output

**Prevention:**
1. **Build a command reference map BEFORE removing anything.** Run: `grep -roP 'gsd-tools\.cjs\s+\S+' agents/ workflows/ references/ templates/ commands/ | sort -u` to get every command actually invoked. This is the ground truth for what's "alive."
2. **Cross-reference the map against router.js.** Every command in the grep output must have a handler in the router. Every handler's function must exist in its source module. Only functions NOT in this chain AND not in the grep output are candidates for removal.
3. **Never trust esbuild tree-shaking for dead code identification.** Tree-shaking works for bundle size (removing unreachable code from the output). It does NOT work for identifying code that can be removed from the source — because the entry point (`src/index.js → router.js`) dynamically requires all modules.
4. **Add a "command surface" contract test.** After dead code removal, run `node bin/gsd-tools.cjs --help 2>&1` and compare the output against a snapshot. If any command disappeared, the test fails.

**Detection (warning signs):**
- Agent workflows producing `"Error: Unknown command"` strings instead of JSON
- `error()` calls in router.js being triggered during normal workflow execution
- Test suite passes but `/bgsd-execute-phase` fails in the host editor

**Phase to address:**
Dead Code Audit — FIRST task must be building the command reference map. Removal comes AFTER.

**Confidence:** HIGH — verified by direct codebase analysis: 49 files reference gsd-tools, 131+ unique commands, 37+ non-namespaced forms still in active use.

---

### Pitfall 2: Breaking Backward-Compatible CLI Commands During Restructuring

**What goes wrong:**
The router.js has two parallel command routing systems:

1. **Namespace routing** (lines 151-746): `init:execute-phase`, `plan:intent create`, `verify:state validate`, etc.
2. **Backward-compat routing** (lines 748-1098+): `state update`, `commit`, `verify plan-structure`, `roadmap analyze`, etc.

Both systems call the same underlying functions. The cleanup instinct is "remove the backward-compat block since we have namespaces." But:

- **14 workflow files** still use `gsd-tools.cjs commit` (not `execute:commit`)
- **9 workflow files** still use `gsd-tools.cjs state` (not `verify:state`)
- **8 workflow files** still use `gsd-tools.cjs verify` (not `verify:verify`)
- **5 workflow files** still use `gsd-tools.cjs roadmap` (not `plan:roadmap`)
- **Plus 25+ other non-namespaced forms** scattered across agents/references

Removing backward-compat breaks these silently. The CLI emits an error message. The agent receives the error instead of JSON. The workflow continues with corrupted state.

**Why it happens:**
Namespace routing was added in v8.0. Not all markdown files were migrated. The old forms still work, so there was no pressure to migrate them. During cleanup, the backward-compat block looks like duplication — because it IS duplication, but it's load-bearing duplication.

**Consequences:**
- Workflows break with cryptic "Unknown command" errors
- Users on existing projects with older workflow files experience failures
- Agent prompts that reference specific commands stop working
- The breakage only appears when running through the host editor, not in test suite

**Prevention:**
1. **Migrate ALL markdown references to namespaced forms BEFORE removing backward-compat.** This is a mechanical find-and-replace task, not a judgment call. Script it:
   ```bash
   # Example: migrate 'commit' → 'execute:commit' in all markdown files
   sed -i 's/gsd-tools\.cjs commit/gsd-tools.cjs execute:commit/g' agents/*.md workflows/*.md references/*.md
   ```
2. **After migration, verify zero non-namespaced references remain:**
   ```bash
   grep -roP 'gsd-tools\.cjs\s+(?!init:|plan:|execute:|verify:|util:|research:|cache:)\S+' agents/ workflows/ references/ templates/
   ```
   This must return empty.
3. **Keep backward-compat for one more milestone** even after migration. Remove in the NEXT milestone after migration has been validated in production. Defense-in-depth.
4. **Add deprecation warnings** to the backward-compat block: emit a `process.stderr.write('DEPRECATED: use execute:commit instead of commit\n')` so usage becomes visible.

**Detection (warning signs):**
- `grep -r 'gsd-tools.cjs commit' workflows/` returning results after the backward-compat block is removed
- Agent logs showing "Unknown command" during plan execution
- Slash commands that worked yesterday returning errors today

**Phase to address:**
Command Restructuring — migration must happen BEFORE removal. Two separate tasks, not one.

**Confidence:** HIGH — verified by codebase grep: 37+ non-namespaced command forms are still actively referenced.

---

### Pitfall 3: Refactoring Changes Output Shape, Breaking Agent JSON Consumers

**What goes wrong:**
The 9 agents and 45 workflows are brittle consumers of gsd-tools CLI JSON output. They parse specific fields by name, expect specific structures, and make assumptions about field order. Refactoring that changes output shape — even while maintaining "the same data" — breaks these consumers silently:

1. **Renaming fields.** Changing `phase_found` to `phaseFound` (camelCase consistency) breaks every workflow parsing `phase_found` from `init:execute-phase` output.

2. **Reordering or restructuring nested objects.** Moving `plans` from a top-level array to a `data.plans` wrapper breaks agent prompts that access `plans` directly.

3. **Changing data types.** Returning `"3"` (string) instead of `3` (number) for a phase count, or vice versa. Agent prompts may have hardcoded comparisons.

4. **Removing "unnecessary" fields.** A field that looks redundant to the developer may be the specific field an agent prompt parses. The v7.0 contract tests (snapshot-based) catch some of this, but only for the init/state commands — not for all 100+ commands.

5. **Changing error message strings.** Agent prompts sometimes check for specific error strings like `"phase_found": false` to detect conditions. Changing the string breaks the detection.

**Why it happens:**
Refactoring naturally improves consistency — standardizing naming conventions, flattening nested structures, removing redundancy. Each individual change seems safe and is an improvement. But the consumers weren't updated because they're in markdown files, not in the JavaScript dependency graph.

**Consequences:**
- Agents receive JSON they can't parse, fall back to heuristic behavior
- Workflow orchestration makes wrong decisions based on misinterpreted data
- Contract tests pass (they test specific commands) but unmeasured commands break
- Failures appear intermittent because different agents parse different fields

**Prevention:**
1. **Expand contract tests to cover ALL commands used by agents.** Currently only init/state have snapshot tests. The 131+ unique command invocations identified in agents/workflows should ALL have snapshot tests.
2. **Treat CLI output as a public API.** Apply the same backward-compatibility discipline to JSON output that you'd apply to a REST API: additive changes only, no renames, no removals without deprecation.
3. **When refactoring output, add new fields alongside old ones.** Return both `phase_found` and `phaseFound` for one milestone. Remove the old form in the next milestone.
4. **Use `--fields` filtering for cleanup.** The router already supports `--fields` (line 58-66). Use it to verify that specific field access still works.
5. **Run the "agent smoke test":** execute each slash command end-to-end through the host editor after output changes. This is the only test that exercises the full agent→CLI→agent pipeline.

**Detection (warning signs):**
- Contract test snapshots changing (this is GOOD — it means the test caught something)
- Agent prompts producing "I couldn't parse the output" or falling back to generic responses
- `--fields` queries returning `undefined` for previously valid fields

**Phase to address:**
All phases that modify CLI output — Dead Code Audit, Performance Tuning, and Agent Architecture.

**Confidence:** HIGH — v7.0 contract tests explicitly exist because of this risk. Expanding their coverage is the mitigation.

---

### Pitfall 4: Over-Engineering the Audit — the Cleanup Milestone That Never Ships

**What goes wrong:**
Cleanup milestones have a unique pathology: they attract exhaustive cataloguing instead of focused fixing. The pattern:

1. **Week 1:** Build comprehensive audit tooling. AST-based dead code detector. Command reference mapper. Bundle analyzer. Config schema validator.
2. **Week 2:** Generate reports. 47 dead functions found. 12 unused config keys. 8 candidate commands for removal. 3 agent overlap areas.
3. **Week 3:** Debate priorities. Which dead code is riskiest to remove? Should we fix the naming inconsistency first? What about that one function that MIGHT be used?
4. **Week 4:** Realize we've shipped tooling but removed zero dead code. The audit is comprehensive but the codebase is unchanged.

This is especially dangerous for this project because:
- The codebase is 1216KB — there's a LOT to audit
- 34 src modules × 100+ commands = large surface area for analysis paralysis
- The milestone explicitly mentions FOUR separate cleanup areas (dead code, performance, commands, agents) — scope creep invitation
- Existing tooling (profiler, agent audit, contract tests) makes it tempting to build MORE tooling instead of using what exists

**Why it happens:**
Cleanup is inherently less satisfying than feature work. Auditing feels productive (you're learning the codebase!) without the risk of breaking things. Developers gravitate toward the safe activity (analysis) over the scary one (deletion).

**Consequences:**
- Milestone takes 2x estimated time
- "Hardening" milestone produces reports, not improvements
- Bundle size stays at 1216KB despite a milestone dedicated to reducing it
- Tech debt documented but not addressed — adding meta-debt

**Prevention:**
1. **Time-box the audit to 20% of the milestone.** If the milestone is 5 phases, the audit is phase 1. The remaining 4 phases are EXECUTION — removing, refactoring, shipping.
2. **Set concrete, measurable targets upfront:**
   - Bundle size: 1216KB → under 1100KB
   - Dead exports: count before → count after (must decrease by ≥30%)
   - Commands: remove N specific stale commands (list them by name)
   - Agent manifests: specific changes (list them)
3. **Don't build audit tooling — USE existing tooling.** The profiler exists. The agent audit command exists. Contract tests exist. `grep` exists. No new tools needed.
4. **Delete first, analyze later.** If something looks dead and grep confirms zero references, delete it. Run tests. If tests pass, it was dead. If tests fail, revert. This is faster than building a comprehensive dead code analyzer.
5. **One phase per cleanup area.** Don't mix dead code removal with command restructuring with agent boundary refinement. Each area gets its own phase with its own tests.

**Detection (warning signs):**
- Phase 1 taking more than 25% of the milestone timeline
- Creating new files/tools for the audit (instead of using existing commands)
- Discussion documents growing longer than the code changes
- "We need to audit X before we can clean Y" chains longer than 2 links

**Phase to address:**
All phases — the project lead must enforce time-boxing and concrete targets from day one.

**Confidence:** HIGH — based on common software engineering anti-patterns for cleanup/hardening work. The "audit trap" is well-documented in refactoring literature.

---

### Pitfall 5: Deploy.sh Becomes a Silent Breakage Vector

**What goes wrong:**
`deploy.sh` copies the built bundle and associated files (agents, workflows, commands, templates, references) to the live host editor config. It's the only deployment mechanism — there's no npm publish, no CI/CD pipeline, no staged rollout. Changes ship the moment `deploy.sh` runs.

During a cleanup milestone, multiple things can go wrong:

1. **Renaming or moving files.** If `deploy.sh` copies `agents/gsd-integration-checker.md` but that agent was merged into `gsd-verifier.md` (v8.0 consolidation), the old file persists in the deploy target. Users get ghost agents that reference deleted commands.

2. **Stale files in deploy target.** `deploy.sh` likely copies files TO the target but doesn't DELETE files that no longer exist in the source. Removing `commands/bgsd-join-discord.md` from the repo doesn't remove it from `~/.config/OC/get-shit-done/commands/`. The stale command remains available.

3. **Bundle changes without smoke test coverage.** If the cleanup removes a function that the smoke test doesn't exercise, `deploy.sh` installs a broken bundle that passes the smoke test.

4. **Config schema changes.** If cleanup modifies `config.json` schema (removing dead config keys, renaming them), the deployed version may conflict with existing user `config.json` files.

**Why it happens:**
File-copy deploy is simple and reliable for additive changes. It becomes dangerous for subtractive changes (removing files, renaming, restructuring) because it doesn't have a "sync" or "clean" step.

**Consequences:**
- Users' live installs have stale files that cause confusing behavior
- Removed commands still appear in the host editor command palette
- Bundle appears to deploy successfully but is actually broken
- Config migration issues only discovered when users run commands

**Prevention:**
1. **Add a "clean deploy" mode to deploy.sh** that removes the target directory before copying. Or add a manifest of expected files and delete anything not on the manifest.
2. **Expand the smoke test** in deploy.sh to cover critical path commands: `init:execute-phase`, `verify:state`, `execute:commit`. If any fail, abort the deploy.
3. **Test deploy.sh in CI** (or at least in a temp directory) before deploying to live config.
4. **Add config migration logic.** When config keys are removed or renamed, the CLI should handle old configs gracefully — ignoring unknown keys, providing defaults for missing keys.
5. **Document the "nuclear redeploy"** for users: delete `~/.config/OC/get-shit-done/` entirely and re-run `deploy.sh`. This clears all stale files.

**Detection (warning signs):**
- `ls ~/.config/OC/get-shit-done/agents/` showing agents that don't exist in the repo
- Slash commands appearing in the host editor that were supposed to be removed
- Users reporting "command not found" after deploy but not after clean install
- Deploy smoke test passing but manual usage failing

**Phase to address:**
First phase — deploy.sh safety must be established before any file removal begins.

**Confidence:** HIGH — based on codebase analysis showing deploy.sh as the sole deployment mechanism, and the known pattern of file-copy deploys accumulating stale files.

<!-- /section -->

<!-- section: moderate_pitfalls -->
## Moderate Pitfalls

### Pitfall 6: Performance Regression from "Cleanup" Refactoring

**What goes wrong:**
Refactoring for readability/maintainability can inadvertently degrade performance in ways the profiler doesn't catch:

1. **Breaking lazy loading.** The router uses 20 `lazyX()` functions to defer module loading. Refactoring that moves code between modules or changes import patterns can turn lazy loads into eager loads, increasing startup time for ALL commands even when only one is needed.

2. **Invalidating the L1/L2 cache.** The SQLite caching layer (v8.0) caches file reads. Refactoring that changes file access patterns (e.g., reading a file in a different order, or reading it from a new function) may cause cache misses where there were cache hits.

3. **Bundle size increase from "cleaner" code.** Adding intermediate abstractions, extracting helper functions, or splitting modules can increase total code volume. esbuild bundles everything reachable — more functions = larger bundle, even if each function is smaller.

4. **Changing sync to async.** If any refactoring introduces async/await into a previously synchronous hot path, it adds microtask overhead and changes the execution profile.

**Prevention:**
1. **Run profiler baseline BEFORE any changes:** `GSD_PROFILE=1 node bin/gsd-tools.cjs init:execute-phase 1` and capture the baseline.
2. **After each phase of cleanup, re-run the profiler** and compare. Any regression >10% on a hot path must be investigated before continuing.
3. **Monitor bundle size after every build.** The build script should report size. Current: ~1216KB. Set a ratchet: size can go DOWN, never UP during cleanup.
4. **Never change lazy loading patterns** unless specifically targeting startup time. The lazy loading in router.js is a performance feature, not style.

**Phase to address:**
Performance Tuning — but also any phase that modifies src/ code.

---

### Pitfall 7: Agent Manifest Token Budgets Overflow After Context Boundary Changes

**What goes wrong:**
Each of the 9 agents has a declared token budget (60-80K). The agent architecture audit may recommend:
- Merging agents (combining two agents' context into one)
- Expanding an agent's responsibilities (adding more reference files)
- Changing which files are loaded into agent context

If the context grows beyond the token budget, the context builder truncates or warns. But if the budget is updated without verifying fit, agents may:
- Lose critical reference material that was truncated
- Receive partial prompts that cut off mid-instruction
- Have their system prompts exceed the model's context window

**Prevention:**
1. **Measure actual token usage per agent BEFORE making changes.** Use `gsd-tools.cjs verify:token-budget` or the context budget tool.
2. **After any boundary change, re-measure.** Budget compliance must be verified, not assumed.
3. **If merging agents, the new budget is NOT the sum of the old budgets.** Consolidation should REDUCE total context, not increase it. If it increases, the merge was wrong.
4. **Keep agent manifests as the source of truth.** The manifest declares what the agent needs. If boundary changes require more context than the budget allows, the boundary change is wrong — not the budget.

**Phase to address:**
Agent Architecture Audit.

---

### Pitfall 8: Removing "Stale" Workflows/Templates That Are Actually Used by External Projects

**What goes wrong:**
The bGSD plugin is deployed to ANY project's `.planning/` directory. Workflows and templates are consumed by AI agents across all projects using the plugin, not just the gsd-tools development workspace. A workflow that appears unused in THIS repo may be critical for OTHER projects.

For example:
- `templates/discovery.md` may appear unused because gsd-tools doesn't have a discovery phase. But every new project created with `/bgsd-new-project` uses it.
- `workflows/discuss-phase.md` may not be referenced by any gsd-tools test. But it's invoked by `/bgsd-discuss-phase` in every user project.
- `references/model-profiles.md` may seem like dead content. But agents load it at runtime to resolve model selection.

**Prevention:**
1. **Never determine workflow/template "liveness" by searching only the gsd-tools source.** These files are consumed by the deployed plugin across ALL projects.
2. **The ground truth for liveness is: does a slash command reference this workflow?** If `commands/bgsd-discuss-phase.md` exists and references `workflows/discuss-phase.md`, then `discuss-phase.md` is alive.
3. **Build a reference chain:** `commands/*.md` → `workflows/*.md` → `references/*.md` + `templates/*.md`. Any file not in this chain AND not referenced by any agent manifest is a candidate for removal. Files IN the chain are alive.
4. **Err on the side of keeping files.** A 5KB unused template costs nothing. A removed template that breaks a user's project workflow costs trust.

**Phase to address:**
Stale File Audit.

---

### Pitfall 9: SQLite Cache Corruption During Refactoring

**What goes wrong:**
The v8.0 SQLite caching layer stores file content for cross-invocation persistence. During cleanup:

1. **Changing the cache key format** (e.g., from absolute paths to relative paths, or adding a hash) invalidates all cached entries. This isn't corruption — it's cache miss. But if code assumes cache hits for performance, the first invocation after cleanup will be significantly slower.

2. **Changing cached data format.** If the cache stores parsed results and the parser changes during refactoring, cached data may be parsed differently on read, producing incorrect results.

3. **Changing the `node:sqlite` API usage.** `node:sqlite` is Stability 1.2 (Release Candidate). API changes between Node versions are possible. Refactoring that targets a newer Node version may use APIs not available in 22.5.

4. **Race conditions in cache cleanup.** If cleanup adds a cache eviction or compaction step, concurrent CLI invocations (e.g., from parallel agent workflows) may conflict.

**Prevention:**
1. **Include a `cache:clear` step in the cleanup test protocol.** After any change to cache-related code, clear the cache and verify the system rebuilds correctly.
2. **Pin the `node:sqlite` API surface.** Don't use newer APIs than what's available in Node 22.5. Check the Node.js changelog for sqlite API changes.
3. **Cache stores raw data, not parsed results.** If cache stores parsed data, changing the parser changes the cache semantics. Store raw file content; parse on read.
4. **The Map fallback (Node <22.5) must be tested after every cache change.** Run the test suite with `--no-cache` to verify Map-only operation.

**Phase to address:**
Performance Tuning — any changes to cache.js or cachedReadFile patterns.

<!-- /section -->

<!-- section: minor_pitfalls -->
## Minor Pitfalls

### Pitfall 10: Test Suite Passes But Misses Integration Breakage

**What goes wrong:**
The 762 tests are primarily unit and integration tests that run gsd-tools CLI commands and verify JSON output. They do NOT test:
- Agent prompts parsing CLI output correctly
- Workflow markdown referencing valid command names
- Template placeholders being filled correctly
- Reference files being loadable by agents
- Deploy.sh producing a working installation

A cleanup can pass all 762 tests while breaking the actual user experience.

**Prevention:**
1. **Add a "command existence" test** that verifies every command referenced in agents/workflows/references is routable.
2. **Add a "deploy dry run" test** that runs deploy.sh to a temp directory and verifies file integrity.
3. **After each cleanup phase, manually test 2-3 slash commands** through the host editor. This is the integration test that catches agent-level breakage.

**Phase to address:** All phases.

---

### Pitfall 11: Removing Security-Adjacent Code That Looks Unused

**What goes wrong:**
Defensive code appears "dead" because it handles edge cases that don't occur in normal operation:
- `sanitizeShellArg()` — only matters when user input contains shell metacharacters
- Input validation in `execFileSync` calls — only matters when agents pass malformed args
- Error-boundary try/catch blocks — only matter during failures
- Rate limiting or timeout logic — only matters under load

During cleanup, these look like unnecessary complexity. They're actually security and reliability features.

**Prevention:**
1. **Never remove error handling, input validation, or sanitization during cleanup** — even if it appears unreachable.
2. **Mark security-adjacent code with `// SAFETY:` comments** so future cleanup passes know to keep it.
3. **If a try/catch block catches nothing in tests, that means tests are incomplete** — not that the catch is dead.

**Phase to address:** Dead Code Audit.

---

### Pitfall 12: Config Key Removal Without Migration

**What goes wrong:**
`config.json` stores user preferences. Removing "dead" config keys (keys the CLI no longer reads) seems harmless. But:
- Users have existing `config.json` files with those keys
- The config parser may error on unknown keys after cleanup
- Other tools in the ecosystem (scripts, CI/CD) may set those keys
- Removing a key and later re-adding it with different semantics causes confusion

**Prevention:**
1. **Config parsers should IGNORE unknown keys, not reject them.** This is standard JSON API practice.
2. **Removed config keys should be documented** in a migration note so users know to clean their configs.
3. **Never reuse a config key name with different semantics.** If `research_timeout` meant seconds and you want it to mean milliseconds, use `research_timeout_ms`.

**Phase to address:** Stale File/Config Audit.

<!-- /section -->

<!-- section: phase_warnings -->
## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Dead Code Audit | Removing exports consumed by markdown files (Pitfall 1) | Build command reference map via grep before ANY removal |
| Dead Code Audit | Removing security-adjacent code (Pitfall 11) | Never delete error handling, sanitization, or defensive checks |
| Dead Code Audit | Over-engineering the audit (Pitfall 4) | Time-box to 20% of milestone; delete-first, analyze-later |
| Command Restructuring | Breaking backward-compat (Pitfall 2) | Migrate ALL markdown refs to namespaced forms BEFORE removing compat block |
| Command Restructuring | Stale files in deploy target (Pitfall 5) | Add clean-deploy or manifest-based sync to deploy.sh |
| Performance Tuning | Breaking lazy loading (Pitfall 6) | Profiler baseline before AND after every change |
| Performance Tuning | Cache invalidation (Pitfall 9) | Clear cache in test protocol; test with `--no-cache` |
| Performance Tuning | Bundle size regression (Pitfall 6) | Build reports size; enforce ratchet (only decrease allowed) |
| Agent Architecture | Token budget overflow (Pitfall 7) | Measure before AND after; merging agents must reduce total context |
| Agent Architecture | Output shape changes (Pitfall 3) | Expand contract test coverage to ALL agent-consumed commands |
| Stale File/Config Audit | Removing files used by external projects (Pitfall 8) | Build command→workflow→reference chain; only remove files outside the chain |
| Stale File/Config Audit | Config key removal (Pitfall 12) | Ignore unknown keys in parser; document removals |
| All Phases | Deploy.sh as silent breakage vector (Pitfall 5) | Expand smoke test; clean-deploy mode |
| All Phases | Tests pass but integration breaks (Pitfall 10) | Manual slash command testing after each phase |

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Removed an export consumed by agents (Pitfall 1) | LOW | `git revert` the commit. Run grep to find all consumers. Re-add the export. |
| Broke backward-compat commands (Pitfall 2) | LOW-MEDIUM | `git revert` or re-add the switch cases. Migrate markdown files. Remove compat later. |
| Changed output shape (Pitfall 3) | MEDIUM | May require updating all agent/workflow files that parse the old shape. Or revert and keep old shape. |
| Over-engineered audit (Pitfall 4) | HIGH | Time wasted is unrecoverable. The mitigation is prevention (time-boxing), not recovery. |
| Deploy installed stale/broken files (Pitfall 5) | LOW | User can clean-install: `rm -rf ~/.config/OC/get-shit-done/ && ./deploy.sh` |
| Performance regression (Pitfall 6) | LOW | `git bisect` to find regressing commit, revert it. Profiler baselines make identification fast. |
| Token budget overflow (Pitfall 7) | LOW | Revert the agent boundary change. Re-measure before retrying. |
| Removed workflow used by other projects (Pitfall 8) | MEDIUM | `git revert`. File is restored but users may have experienced breakage in between. |
| Cache corruption (Pitfall 9) | LOW | `gsd-tools cache:clear`. Cache rebuilds on next invocation. |
| Tests pass but integration broken (Pitfall 10) | MEDIUM | Must manually identify which command broke, which agent consumes it, and fix. |
| Removed security code (Pitfall 11) | HIGH | If shipped to users, vulnerability window exists until fix. `git revert` + deploy immediately. |
| Config key removal (Pitfall 12) | LOW | Re-add the key handling with backward compat. |

<!-- /section -->

<!-- section: integration_gotchas -->
## Integration Gotchas: Agent ↔ CLI ↔ Workflow Coupling

| Integration Point | Common Mistake | Correct Approach |
|-------------------|----------------|------------------|
| Agent → CLI command | Removing a CLI command because it's not imported in JS | Check all 49 markdown files that reference gsd-tools before removing ANY command |
| CLI output → Agent parsing | Renaming a JSON field for consistency | Add new field alongside old field; deprecate old field; remove in next milestone |
| Workflow → CLI version | Assuming all workflow files use namespaced commands | Verify with grep: 37+ old-form commands are still in active use |
| Agent manifest → context loading | Changing which files are in an agent's context boundary | Re-measure token usage after ANY boundary change; budget overflow is silent |
| Contract tests → CLI changes | Assuming snapshot tests cover all commands | Only init/state commands have snapshots; 100+ other commands are untested at the contract level |
| Deploy.sh → file removal | Removing a file from repo and expecting deploy to remove it from target | Deploy copies but doesn't delete; stale files persist in target directory |
| Config.json → CLI parser | Removing config keys the CLI no longer uses | Users have existing configs; parser should ignore unknown keys, not error |
| Template → project creation | Removing "unused" templates | Templates are used by new projects, not by the gsd-tools repo itself |
| Reference → agent context | Removing "unused" references | References are loaded at runtime by agents; grep the agent files to verify |
| Backward-compat commands → namespaced commands | Removing backward-compat block because "namespaces exist" | 37+ old-form commands still actively used in production workflows |

<!-- /section -->

<!-- section: tech_debt -->
## Technical Debt Patterns Specific to Cleanup Milestones

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Remove backward-compat commands without migrating workflows | Cleaner router.js | 37+ workflows break | Never |
| Build AST-based dead code detector | "Comprehensive" audit | Weeks spent on tooling that grep does in seconds | Never — use grep |
| Change output field names for consistency | Cleaner API | Breaks agent consumers who parse old field names | Only with contract test expansion AND deprecation period |
| Remove all try/catch blocks around optional operations | Simpler code | Next edge case causes unhandled exception crash | Never — error handling is not dead code |
| Merge all 18 lib/ modules into fewer files | "Simpler" structure | Breaks lazy loading, increases startup time, harder to test | Never — 18 modules is correct granularity |
| "Fix" the 309+ regex patterns for consistency | Consistent parsing | Breaks backward compat for ROADMAP.md/STATE.md/PLAN.md files in existing projects | Never unless exhaustive regression testing |
| Delete the entire backward-compat switch block | Clean router.js, ~350 lines removed | 37+ production workflows break | Only AFTER 100% migration AND one milestone of dual-support |
| Skip manual testing through host editor | Faster milestone completion | Integration breakage reaches users | Never — 3-5 manual tests per phase is the minimum |

<!-- /section -->

<!-- section: sources -->
## Sources

- **Codebase analysis (primary source):**
  - `src/router.js`: 1098+ lines, 20 lazy-loaded modules, dual routing (namespace + backward-compat), 100+ command handlers — HIGH confidence
  - `grep -r gsd-tools agents/ workflows/ references/ templates/ commands/`: 49 files reference gsd-tools, 131+ unique command invocations, 37+ non-namespaced forms still active — HIGH confidence
  - `src/lib/`: 18 modules with lazy loading from router.js — HIGH confidence
  - `src/commands/`: 18 command modules (14 original + 4 added in v8.0-v8.1) — HIGH confidence
  - `agents/*.md`: 9 agent definitions with tool specifications and CLI command references — HIGH confidence
  - `workflows/*.md`: 45 workflow files with embedded CLI invocations — HIGH confidence
  - `PROJECT.md`: v8.2 milestone scope, constraints, tech stack, known debt — HIGH confidence

- **Industry research:**
  - GitHub Engineering Blog: "Multi-agent workflows often fail. Here's how to engineer ones that don't." (2026-02-24) — agent coordination, implicit assumptions about state/ordering — HIGH confidence
  - ETH Zurich: "Evaluating AGENTS.md" (2026-02-12) — 138-repo study showing agent documentation pitfalls — MEDIUM confidence (different domain but relevant patterns)
  - Medium / FreeCodeCamp: Refactoring pitfalls literature (2025-2026) — characterization tests, behavioral change detection, silent regressions — MEDIUM confidence

- **esbuild/bundling:**
  - esbuild official docs: tree-shaking, metafile analysis, dead code elimination — HIGH confidence
  - esbuild tree-shaking limitations: dynamic requires prevent elimination — HIGH confidence

- **Node.js:**
  - `node:sqlite` Stability 1.2 status (Release Candidate as of Node 22.x) — HIGH confidence
  - Node.js child_process docs for execSync/execFileSync patterns — HIGH confidence

<!-- /section -->

---
*Pitfalls research for: bGSD Plugin v8.2 Cleanup, Performance & Validation*
*Researched: 2026-03-06*
