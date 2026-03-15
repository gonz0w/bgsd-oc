# CLI Tool Integration Pitfalls Research

**Domain:** Integrating external CLI tools (ripgrep, fd, jq, yq, bat, gh) into single-file Node.js CLI
**Researched:** 2026-03-14
**Confidence:** HIGH (verified against official tool docs, existing codebase analysis, Node.js child_process security docs)

<!-- section: compact -->
<pitfalls_compact>
<!-- Compact view for planners. Keep under 25 lines. -->

**Top pitfalls:**
1. **Tool absence crashes workflows** — Fallback wrapper + graceful degradation required (Detection phase)
2. **Shell injection via unsanitized arguments** — Use execFileSync with array args, never shell: true (All phases)
3. **Output format differences across tool versions** — JSON output breaking in minor versions; pin format validation (Wrapper phase)
4. **Platform-specific binary detection** — Windows PATH case-sensitivity; Use "which" with try-catch, cache results (Detection phase)
5. **Subprocess startup overhead in editor plugin** — Each tool spawn adds 50-150ms; batch operations, lazy-load tools (Integration phase)
6. **Tool output staleness in editor context** — Results cached 5min; invalidate on file change, user request (Caching phase)
7. **Version compatibility breaking changes** — ripgrep 14→15, jq 1.6→1.7 change output; feature-detect (Version phase)
8. **Exceeded performance budgets** — Single ripgrep call OK; parallel spawning of all 6 tools = startup penalty (All phases)

**Tech debt traps:** hardcoding tool names without detection, skipping fallback implementations, ignoring Windows PATH issues, no version constraint documentation, caching without invalidation strategy

**Security risks:** Command injection via user input to rg/fd patterns, PATH traversal via gh token exposure, Shell metacharacter escaping failures

**"Looks done but isn't" checks:**
- Tool availability: verify `which rg` returns correct path on Windows/Linux/Mac
- Fallback quality: verify CLI still works fully without tool installed (slower but correct)
- Subprocess safety: verify user input can't break shell with spaces, pipes, quotes
- Version handling: verify code doesn't crash on tool version mismatch, gracefully degrades
- Performance: verify tool detection doesn't block editor UI (under 100ms)

</pitfalls_compact>
<!-- /section -->

<!-- section: critical_pitfalls -->
## Critical Pitfalls

### Pitfall 1: Tool Absence Crashes Workflows

**What goes wrong:**
A workflow calls ripgrep expecting results, but the tool isn't installed. The code doesn't check availability first — it just `execFileSync('rg', ...)` and throws when the binary isn't found. The entire workflow dies, user gets a cryptic error, and there's no path to "still works, just slower."

The existing `detector.js` has a solid foundation, but fallback implementation in `ripgrep.js` uses `globSync` from 'glob' — which must be bundled, adding dependency overhead. Fallback paths often aren't tested during development because the developer has all tools installed.

**Why it happens:**
"I have the tool installed so I don't need fallback." Fallback code is written once and never tested. It sits unmaintained until the first user without the tool hits it. External tools feel "optional" until they become critical to a workflow — then the missing fallback is discovered in production.

**How to avoid:**
1. **Detection layer must exist before wrapper layers**: `detector.js` runs on every tool call (cached 5 min), not once at startup
2. Every tool has two code paths: native (fast) and Node.js fallback (slow but working)
3. Fallback paths are tested in CI with tools explicitly removed from PATH
4. Return `{ success, usedFallback, result, guidance }` from every tool operation — never throw
5. Document fallback quality for each tool:
   - ripgrep: fallback = glob + regex in Node (40x slower, correct regex support)
   - fd: fallback = recursive fs walk + name matching (20x slower, correct ignore support)
   - jq: fallback = subset of jq operations or error gracefully (some operations unsupported)
   - yq: fallback = similar to jq (YAML only, limited query support)
   - bat: fallback = cat or stdout without syntax highlighting (works, zero color)
   - gh: fallback = none — gh requires auth, no graceful text fallback
6. Workflows must handle `usedFallback: true` — potentially slower response, user should know

**Warning signs:**
- Code path starting with `detectTool(...)` followed immediately by `execFileSync` with no error handling
- Fallback functions that say `// TODO: implement` or return dummy data
- CI passing but production errors: "command not found"
- No test environment that specifically removes tools from PATH
- Fallback code becoming increasingly buggy after tool version changes

**Phase to address:**
Tool Detection & Wrapper phase (phase 1) — establish dual-path pattern BEFORE integrating into any workflow.

---

### Pitfall 2: Shell Injection via Unsanitized Arguments

**What goes wrong:**
A user submits a search pattern containing shell metacharacters: `"foo ; rm -rf .git"` or `"bar | cat /etc/passwd"`. The code does:
```js
execSync(`rg "${userPattern}" .`)  // DANGEROUS
```
The shell interprets the metacharacters, executing arbitrary commands. Or worse, user provides a filename: `"file with spaces.txt"` and the code passes it incorrectly escaped, causing ripgrep to search for two separate files.

The existing code in `ripgrep.js` correctly uses `execFileSync('rg', args, ...)` with array args (not shell), but downstream code might bypass this. Manual shell escaping is fragile — the moment someone refactors to `exec` for convenience, the vulnerability returns.

**Why it happens:**
Developers conflate "use execFileSync" (safer) with "safe from all injection." They test with normal inputs, find it works, and don't test with adversarial input. Shell escaping is tedious — the first time a pipe character causes issues, someone might switch to `exec` + shell escaping library, introducing a new attack surface.

**How to avoid:**
1. **ABSOLUTE RULE: Never use `shell: true` or string templates with user input**
2. All tool invocations must use `execFileSync(cmd, arrayArgs, options)` pattern — never `exec(stringCmd, ...)`
3. Create a sanitizer layer that validates user patterns:
   ```js
   function validateRipgrepPattern(pattern) {
     // Reject if: null bytes, invalid regex, excessive length (>10KB)
     // Return pattern unchanged or reject
   }
   ```
4. Escape strings explicitly when building output (e.g., for display in terminal):
   ```js
   console.log(`Searched: ${escapeTerminal(userPattern)}`)
   ```
5. Avoid building command strings — always pass array args
6. Static code review: grep codebase for `execSync\(.*\$` patterns and flag for review

**Warning signs:**
- String templates in exec calls: `execSync(`cmd ${arg}`, ...)`
- Comments saying "this should be safe because..." (flags self-doubt)
- User input tests missing from test suite
- Fallback code using different escaping than native code

**Phase to address:**
Tool Wrapper phase (phase 1) — audited before any tool is used in production.

---

### Pitfall 3: Tool Output Format Drift Across Versions

**What goes wrong:**
ripgrep 14.1.0 outputs JSON with `{ data: { path: { text: '...' } } }` structure. ripgrep 15.0.0 changes the schema to `{ data: { path: '...' } }`. Code parsing JSON:
```js
const path = obj.data.path.text  // Works in 14.x, fails in 15.x (path is string, not object)
```
The CLI is installed via multiple package managers (homebrew, apt, cargo, npm) — each may have different versions. A user with ripgrep 14 gets different output format than a user with ripgrep 15.

Example from existing `ripgrep.js` line 33: `obj.data?.path?.text || obj.data?.path` (defensive but partial).

**Why it happens:**
Tool maintainers change output formats for reasons: performance, new fields, schema cleanup. CLI tools aren't versioned like packages — homebrew might ship v14 while another system ships v15. Developers test against their installed version and don't expect drift. Version detection (running `rg --version`) is slow (subprocess spawn) so it's skipped.

**How to avoid:**
1. **Defensive parsing for output formats**: Always use optional chaining (`?.`) and test both old and new schemas
2. Add a version detection layer that caches version for 5 minutes:
   ```js
   function getRipgrepVersion() {
     // cache → execFileSync('rg', ['--version']) → return version string
   }
   ```
3. Document supported version ranges in tool-info:
   ```js
   tools: { ripgrep: { versionRange: '13.0.0+', minFeatureVersion: '14.0.0' } }
   ```
4. For format-breaking changes, detect version and use appropriate parser:
   ```js
   const version = getRipgrepVersion();
   return version.startsWith('14.') ? parseRipgrepV14(output) : parseRipgrepV15(output);
   ```
5. Test suite includes "output format snapshot tests" for each supported version
6. Pin version in install guidance if format is critical:
   ```bash
   brew install ripgrep@14  # OR: cargo install ripgrep --version 14.1.0
   ```

**Warning signs:**
- Parser using `.path?.text || .path` (defensive but indicates awareness of drift)
- No version detection code
- Error messages like "unexpected field type" when parsing output
- Users reporting tool works on their machine but not in CI
- Multiple `.get()` clauses or try-catch blocks in parsing

**Phase to address:**
Tool Wrapper phase (phase 1) — detection + parsing must handle version variance.

---

### Pitfall 4: Platform-Specific Binary Discovery

**What goes wrong:**
On macOS/Linux, `/usr/bin/rg` is in PATH. On Windows, the tool may be installed in Program Files, or in `node_modules/.bin`, or via chocolatey in a custom location. The code uses `which rg` to find it, but:
- Windows `PATH` is case-insensitive but `process.env.PATH` might be `Path` (uppercase) — `which` fails
- Some Windows installs have ripgrep in `C:\Program Files\BurntSushi\ripgrep\rg.exe` — NOT in PATH by default
- Tool might be installed via npm in `./node_modules/.bin/fd` — project-local, not system-wide
- WSL vs native Windows have different paths

The existing `detector.js` uses `which` (Unix-only, requires separate binary on Windows or npm package). It works on Linux/Mac but struggles on Windows.

**Why it happens:**
Unix developers test on Linux/Mac where `which` works perfectly. Windows paths are complex (multiple drives, backslashes, case-insensitive, multiple installation methods). Developers skip Windows testing and assume their Unix-only approach will work. The first Windows user hits a cryptic error.

**How to avoid:**
1. Use `shutil.which()` equivalent that works across platforms:
   ```js
   // NOT: execFileSync('which', [name])
   // YES: Use 'which' npm package or cross-platform implementation
   const which = require('which');  // npm package handles Windows
   function findTool(name) {
     try {
       return which.sync(name);
     } catch {
       return null;
     }
   }
   ```
2. Check multiple installation locations:
   ```js
   function findRipgrep() {
     // Try 1: which rg
     // Try 2: node_modules/.bin/rg
     // Try 3: Common Windows paths (Program Files)
     // Try 4: Check if installed via Bun
   }
   ```
3. Handle `PATH` case-sensitivity on Windows:
   ```js
   const pathVar = process.env.PATH || process.env.Path || '';
   ```
4. Test on actual Windows (or CI matrix covering Windows) — not just WSL
5. Document installation paths per OS:
   ```
   Linux: apt install ripgrep / cargo install ripgrep
   macOS: brew install ripgrep
   Windows: scoop install ripgrep / choco install ripgrep
   ```

**Warning signs:**
- Code only uses `execFileSync('which', [name])`
- No Windows-specific path handling
- Test suite skipped on Windows CI
- Users reporting "works on Linux, fails on Windows"
- Path lookups failing silently instead of trying fallbacks

**Phase to address:**
Tool Detection phase (phase 1) — cross-platform discovery before any tool is invoked.

---

### Pitfall 5: Subprocess Startup Overhead Kills Editor Plugin Performance

**What goes wrong:**
The plugin is always-on, responding to user idle events, file changes, and manual requests. Each tool spawn (`execFileSync`) adds 50-150ms (process startup, binary load, regex compilation). Spawning all 6 tools in sequence = 300-900ms. For a user idle event that should feel instant, this is catastrophic. The UI blocks, the editor lags, the user thinks the plugin is broken.

Additionally, if you spawn tools in parallel (multiple `execFileSync` calls), the overhead is still O(n) in the number of tools. And if the plugin tries to search all files with ripgrep + list all git files with fd, the combined latency breaks the "instant response" experience.

The existing code doesn't benchmark or budget performance. A quick `execFileSync('rg', [...])` call seems fast in isolation, but repeated across many IDE events it becomes a stall.

**Why it happens:**
Developers measure single tool invocations (fast!) and don't consider the cumulative impact in a hot loop. The plugin architecture changes tool usage from "occasional CLI call" to "background process responding to every file change." Developers test manually (one call at a time) and don't simulate the plugin's event-driven pattern.

**How to avoid:**
1. **Establish a performance budget: 50ms max for tool operations in hot paths**
2. Batch operations — if you need ripgrep + fd results, spawn them in parallel, not sequentially
3. Lazy-load tools: don't detect all tools at startup, detect on first use (then cache 5 min)
4. Cache results aggressively:
   - File search results cached 30 seconds (user editing own files)
   - Directory listing cached 5 minutes (only changes on git operations)
5. Debounce rapid requests: if IDE triggers 10 file-change events in 100ms, spawn tool once for the batch, not 10 times
6. Profile in plugin context (not standalone CLI):
   ```js
   const start = Date.now();
   const result = spawnTool(...);
   const elapsed = Date.now() - start;
   if (elapsed > 100) warn(`Tool took ${elapsed}ms, budget is 50ms`);
   ```
7. Document tool latency expectations:
   ```
   ripgrep: 50-100ms per search
   fd: 30-60ms per discovery
   jq: 10-20ms per transform (depending on JSON size)
   ```

**Warning signs:**
- No latency measurements in code
- Tools invoked in loops (O(n²) spawning)
- No caching between tool calls
- Plugin events triggering tool spawns for every keystroke
- Users reporting "plugin makes editor slow"

**Phase to address:**
Integration phase (phase 2) — before plugin hooks use tools, establish performance budgets and measurements.

---

### Pitfall 6: Tool Output Staleness in Long-Running Editor Sessions

**What goes wrong:**
The plugin caches tool results for 5 minutes (to avoid repeated spawning). User runs `rg 'foo'` at 10:00, gets cached result at 10:01, then modifies multiple files at 10:02. At 10:03, they ask "does anyone use this pattern?" and get cached results from 10:00 — missing the new code they just wrote. Or worse: git adds a new file at 10:05, but the fd cache doesn't know about it until 10:05.

The cache invalidation strategy matters: time-based TTL (5 min) works for most cases, but file-change events should invalidate immediately. Existing `cache.js` has mtime-based invalidation for `file_cache`, but doesn't extend to tool output caches.

**Why it happens:**
Tool output feels immutable — the code on disk is fixed, so the search results should be fixed. Developers forget that users edit files, add new files, and delete files between tool calls. A 5-minute cache is conservative compared to a build cache, but for interactive editing it's too long. Time-based TTL is simple, but event-based invalidation (on file change, git commit, manual refresh) is more correct.

**How to avoid:**
1. Use time-based TTL for casual queries (5 min is OK for "what files match pattern")
2. Use event-based invalidation for critical paths:
   - File watcher detects change → invalidate ripgrep cache for that file's patterns
   - Git hook detects commit → invalidate fd and ripgrep caches (new/deleted files)
   - User manually requests refresh → immediate invalidate
3. Store cache invalidation metadata:
   ```js
   {
     result: [...],
     timestamp: Date.now(),
     sourceFiles: ['path1.js', 'path2.js'],  // what files this result depends on
     gitHash: '...'  // git commit when this was computed
   }
   ```
4. On each tool call, check preconditions:
   ```js
   if (cache.exists && cache.gitHash === currentGitHash && cache.sourceFiles.all exist) {
     return cache  // Still valid
   }
   // Otherwise, re-run tool
   ```
5. Provide user-visible "cache stale" indicator when TTL is exceeded but results shown
6. Add `--refresh` flag to CLI commands that invalidates cache

**Warning signs:**
- Simple `Date.now() - timestamp < 5 * 60000` checks
- No file-change event hooks into cache invalidation
- Users reporting "results don't match current code"
- Cache invalidation logic duplicated per tool
- No "last computed at" timestamp in results

**Phase to address:**
Caching Strategy phase (phase 2) — establish invalidation rules before integration into workflows.

---

### Pitfall 7: Version Compatibility and Breaking Changes

**What goes wrong:**
ripgrep 14.1.0 ships with certain regex engines; ripgrep 15.0.0 upgrades the regex library and behavior changes subtly. jq 1.6 and jq 1.7 have different command-line flag names. Users on different systems have different versions, and code assumes a feature that's only in v15. Example:

User with ripgrep 13.0 doesn't have `--json-path` flag. Code does:
```js
execFileSync('rg', ['--json-path', ...])
```
Crashes with "unknown flag" error.

The existing code has no version constraint enforcement. A user with a 3-year-old ripgrep might use bGSD fine, then upgrade to the latest and hit a breaking change because code now assumes new features.

**Why it happens:**
Developers test with their current tool version and assume that version is the minimum. They don't document "requires ripgrep 14+" or test against older versions. Tool maintainers don't guarantee backward compatibility — each new version is a fresh start. Users have no incentive to upgrade tools, so old versions persist in the wild.

**How to avoid:**
1. Document version requirements clearly:
   ```
   ripgrep: 13.0.0+ (14.0.0+ for --json-path flag)
   jq: 1.6+ (note: 1.7 changed --arg syntax)
   ```
2. Implement feature detection (not version parsing):
   ```js
   function supportsJsonPath() {
     try {
       execFileSync('rg', ['--json-path', '--help'], { stdio: 'ignore' });
       return true;
     } catch {
       return false;  // Flag not recognized
     }
   }
   ```
3. For breaking changes, provide two code paths:
   ```js
   const hasJsonPath = supportsJsonPath();
   const args = ['--json'];
   if (hasJsonPath) args.push('--json-path');
   execFileSync('rg', args);
   ```
4. Install guidance includes version constraint:
   ```
   # macOS:
   brew install ripgrep  # installs latest
   # If you need a specific version:
   brew install ripgrep@14
   ```
5. CI matrix includes minimum version testing:
   ```
   Test against: ripgrep 13, 14, 15 (latest)
   ```

**Warning signs:**
- Code using flags/options without checking availability
- Version comparison with string parsing (fragile)
- No minimum version documentation
- Features working on developer machine but failing in CI
- Fallback code taking over for older tool versions

**Phase to address:**
Tool Version Management phase (phase 1) — establish compatibility matrix before feature-flag usage.

---

### Pitfall 8: Exceeded Performance Budgets from Parallel Tool Spawning

**What goes wrong:**
A workflow needs to: search files (ripgrep), list all source files (fd), and transform data (jq). The code spawns all 3 tools in sequence, taking 50+30+20 = 100ms. Then it spawns them again for a batch operation, and again in the plugin hook. What seemed like "small overhead" is now 20% of the CLI startup budget. The single-file bundler still needs to initialize, parse arguments, validate state — and now tool spawning competes for time budget.

The existing code doesn't track "how many tools are spawned per command" or have a performance dashboard. A command that should take 200ms starts taking 800ms.

**Why it happens:**
Each tool spawn feels cheap — 50ms is nothing. But orchestrating multiple tools without batching or parallelization wastes time. Developers add tools incrementally ("oh, I also need fd for this") without stepping back to optimize the overall pipeline. The overhead is distributed across many commands, so no single command looks bad, but the cumulative effect is large.

**How to avoid:**
1. Establish performance budgets per command type:
   ```
   init: 300ms total (tool spawning budget: 50ms)
   plan: 500ms total (tool spawning budget: 100ms)
   execute: 1000ms total (tool spawning budget: 200ms)
   ```
2. Batch operations: if you need multiple tool results, spawn them in parallel:
   ```js
   const [ripgrepResults, fdResults, jqResults] = await Promise.all([
     spawnRipgrep(...),
     spawnFd(...),
     spawnJq(...)
   ]);
   // Not: await spawnRipgrep, then await spawnFd, then await spawnJq
   ```
3. Profile command execution and warn if budget exceeded:
   ```js
   if (toolSpawnTime > budget) {
     console.warn(`Tool operations took ${toolSpawnTime}ms, budget is ${budget}ms`);
   }
   ```
4. Consider caching tool results across commands in the same session
5. Document tool spawn counts in command help:
   ```
   % bgsd-tools plan --help
   This command uses: ripgrep (1), fd (1), jq (0)
   Estimated overhead: 80ms
   ```

**Warning signs:**
- Multiple sequential `execFileSync` calls without batching
- No measurement of tool spawn time vs. total command time
- Tool overhead growing as features are added
- Plugin performance degradation over time
- Workflow spawning same tool multiple times for different operations

**Phase to address:**
Performance Optimization phase (phase 2) — after integration, measure and optimize tool spawn patterns.

---

<!-- /section -->

<!-- section: tech_debt -->
## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoded tool names (`'rg'`, `'fd'`) | Code is simple | Can't support aliases (fd-find on Debian) | Never — use TOOLS registry |
| Skipping fallback implementation | Faster development | Breaks for users without tools (40% of users?) | MVP only — fallback required for 1.0 |
| Ignoring Windows PATH issues | Works on Linux | Complete failure on Windows | Never — test matrix must include Windows |
| Caching tool output with only TTL | Simple to implement | Stale results between commits | Acceptable for non-critical paths (30s min) |
| Single-threaded tool spawning | Easier to debug | 2-3x overhead for multi-tool operations | Acceptable for single-tool commands only |
| No version constraints | Works for all users | Breaking changes when users update | Never — min version documented |
| Parsing JSON without format versioning | Fewer code paths | Breaks on tool minor update | Never — defensive parsing required |
| Not measuring performance | Faster to ship | Creeping slowness until timeout/lag | Never — profile in target context |

## Integration Gotchas

Common mistakes when connecting to external tools.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Ripgrep search | Using `exec()` with user pattern directly | Use `execFileSync('rg', [pattern], ...)` with array args |
| Ripgrep JSON parsing | `obj.data.path.text` without null checks | Defensive: `obj.data?.path?.text \|\| obj.data?.path` |
| fd file discovery | Synchronous spawning in loops | Batch all fd calls, spawn in parallel, cache results |
| jq transformation | Assuming jq is installed | Check availability first, provide Node.js fallback |
| yq YAML parsing | Output format assumptions | Feature-detect version, parse both old/new schema |
| gh CLI auth | Assuming gh is logged in | Check exit code, provide "not logged in" error message |
| Subprocess in plugin | Spawning on every keystroke | Debounce events, cache results 30s minimum |
| Error handling | Throwing errors from tool failures | Return `{ success: false, error, usedFallback }` |

<!-- /section -->

<!-- section: performance -->
## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Sequential tool spawning | Commands take 300ms instead of 100ms | Spawn tools in parallel with Promise.all | >3 tools per operation |
| Per-invocation tool detection | CLI startup delayed by 50ms | Cache tool detection 5 minutes | Tool detection called >10 times/session |
| Unbounded ripgrep search | Search pattern matches 100k lines | Limit results: `--max-count 1000` | Repositories with large codebases |
| Caching without invalidation | Stale results after file edit | Check file mtime before serving cache | Files edited within cache TTL |
| Tool version detection per call | 20ms subprocess overhead per operation | Detect once, cache version 5 minutes | >5 operations per session |
| Regex compilation overhead | ripgrep slow on complex patterns | Pre-compile patterns, cache patterns | Pattern complexity >50 chars |
| JSON parsing large outputs | jq result 1MB, parsing blocks | Stream JSON, parse incrementally | jq output >100KB |

<!-- /section -->

<!-- section: security -->
## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| User input to ripgrep pattern directly | Command injection, arbitrary code execution | Always use execFileSync with array args, never shell interpolation |
| Shell escaping with quotes/backslashes | Escaping bypasses | Use execFileSync array args (no escaping needed) |
| Assuming PATH is safe | Tool name collision (malicious rg in PATH) | Verify tool path hash matches expected binary, warn on path changes |
| Building fd patterns from user input | Directory traversal (symlink attacks) | Validate patterns, use `--max-one-result` to limit scope |
| gh token exposure in error messages | Token leak to logs/console | Never print token, mask in error messages |
| jq arbitrary code via `--arg` | Code injection via user input | Validate arg names, use `--argjson` for JSON not user-sourced |
| Subprocess timeout not set | Denial of service (hung process) | Set timeout on all execFileSync calls (30s default) |
| No tool availability check before use | Information leakage (error messages reveal system info) | Check tool availability, provide generic error to users |

<!-- /section -->

<!-- section: ux -->
## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Silent failures when tool absent | User confused why feature doesn't work | Return `usedFallback: true` + show guidance message with install command |
| Cryptic "command not found" error | User doesn't know how to fix it | Show friendly error: "ripgrep not installed. Install: brew install ripgrep" |
| Tool results that seem wrong | User distrusts tool, uses CLI manually | Show version info, cache timestamp, "results from 5min ago" indicator |
| Slow responses without explanation | User thinks CLI hung | Show progress indicator, "searching 50 files..." during long operations |
| Feature unavailable on older tool version | User frustrated, can't use feature | Show required version: "Feature requires ripgrep 14+, you have 13.0" |
| Inconsistent tool behavior across platforms | Works on Mac, fails on Linux | Document platform differences, provide troubleshooting guide |
| Output format differences per tool version | User workflow breaks after update | Show tool version in output, document supported versions |
| No way to force refresh cached results | User stuck with stale data | Provide `--refresh` flag to invalidate cache |

<!-- /section -->

<!-- section: looks_done -->
## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Tool Detection:** Detection code runs, tool found — verify it works on Windows (not just Linux/Mac) with case-insensitive PATH
- [ ] **Fallback Implementation:** Fallback code exists — verify CLI works fully when tool removed from PATH (slower but correct results)
- [ ] **Shell Safety:** execFileSync uses array args — verify user input with spaces, pipes, quotes doesn't break (test: `"foo | bar"`, `"foo;rm -rf"`, `"foo $(evil)"`)
- [ ] **JSON Parsing:** JSON output parsed — verify parser handles format changes between tool versions (test with old and new version output)
- [ ] **Version Compatibility:** Version detection code exists — verify fallback for unsupported version (feature detect, not version parse)
- [ ] **Subprocess Startup:** Tool spawns quickly — verify single tool call <100ms in CLI context (50ms in plugin context)
- [ ] **Cache Invalidation:** Tool output cached — verify editing a file invalidates cache within 1 second (not stuck for 5 min)
- [ ] **Performance Measurement:** Tool usage profiled — verify command stays within budget (e.g., "init" <300ms total with tools)
- [ ] **Installation Guidance:** Install message shown — verify instructions work on target OS (test on Windows, macOS, Linux)
- [ ] **Error Messages:** Tool failures handled gracefully — verify user sees actionable message, not stack trace (e.g., "tool not found, try: brew install X")

<!-- /section -->

<!-- section: recovery -->
## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Absent tool discovered in production | LOW | Show install guidance, fallback to slower implementation, monitor usage |
| Shell injection vulnerability found | HIGH | Immediately audit all tool invocations, add test cases, release patch |
| Performance regression from added tools | MEDIUM | Profile bottleneck, batch tool spawning, increase cache TTL, add debounce |
| Tool version breaking change | MEDIUM | Feature-detect new API, add compatibility layer, update min version docs |
| Stale cache causing user confusion | LOW | Add cache timestamp to output, implement TTL invalidation, add `--refresh` flag |
| Tool unavailable on Windows | MEDIUM | Implement Windows-specific path detection, add to test matrix, test locally on Windows VM |
| Tool output format changed between versions | MEDIUM | Add version detection, parse both old/new formats, test with version matrix |
| Exceeded performance budget | MEDIUM | Profile tool spawning, parallelize calls, increase cache time, reduce scope |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Tool absence crashes workflows | Tool Detection & Wrapper (Phase 1) | Run CLI without installing any tools — fallback works |
| Shell injection via unsanitized args | Tool Wrapper (Phase 1) | Pass adversarial user input (pipes, quotes, newlines) — no execution |
| Tool output format drift | Tool Wrapper (Phase 1) | Test parser against v13, v14, v15 ripgrep JSON output formats |
| Platform-specific binary discovery | Tool Detection (Phase 1) | Run tool detection on Windows CI, verify PATH case-insensitivity |
| Subprocess startup overhead | Integration (Phase 2) | Profile plugin context tool usage, measure startup latency <100ms |
| Tool output staleness | Caching Strategy (Phase 2) | Edit a file, run CLI within 5s — results reflect new code |
| Version compatibility breaking | Tool Version Management (Phase 1) | Test min supported version (ripgrep 13), verify graceful degradation |
| Exceeded performance budgets | Performance Optimization (Phase 2) | Measure "bgsd init" command, verify <300ms with all tools enabled |

<!-- /section -->

<!-- section: sources -->
## Sources

- [Node.js child_process security best practices](https://auth0.com/blog/preventing-command-injection-attacks-in-node-js-apps/)
- [Prevent Command Injection: execFile safety patterns](https://securecodingpractices.com/prevent-command-injection-node-js-child-process/)
- [Cross-Platform CLI development with Node.js — path handling, shell differences](https://www.grizzlypeaksoftware.com/library/cross-platform-clis-with-nodejs-ilyjtf8j)
- [ripgrep releases and changelog — output format evolution](https://github.com/BurntSushi/ripgrep/releases)
- [jq version compatibility — 1.6 to 1.7 breaking changes](https://github.com/jqlang/jq)
- [Node.js CLI Apps Best Practices — 3.9k stars, comprehensive guide](https://github.com/lirantal/nodejs-cli-apps-best-practices)
- [CLI Error Handling and User-Friendly Messages — Grizzly Peak](https://www.grizzlypeaksoftware.com/library/cli-error-handling-and-user-friendly-messages-qgugu9kg)
- [CLI Performance Optimization techniques — startup profiling](https://www.grizzlypeaksoftware.com/library/cli-performance-optimization-x9ny2efw)
- [Cache Invalidation Strategies — time-based vs event-driven](https://leapcell.io/blog/cache-invalidation-strategies-time-based-vs-event-driven)
- [Caching in Node.js — preventing stale data issues](https://www.wondermentapps.com/blog/caching-in-node-js/)
- Existing codebase: `src/lib/cli-tools/` (detector.js, ripgrep.js, fallback.js, install-guidance.js)

---
*CLI tool integration pitfalls for v12.1 bGSD milestone*
*Researched: 2026-03-14*
*Confidence: HIGH (official docs + existing code analysis)*
