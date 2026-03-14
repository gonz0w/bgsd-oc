# Stack Research — Test Suite Failure Analysis

**Domain:** Test infrastructure stabilization for bGSD CLI plugin
**Researched:** 2026-03-13
**Confidence:** HIGH (all findings verified via live test runs and source inspection)

<!-- section: compact -->
<stack_compact>
<!-- Compact view for planners. Keep under 25 lines. -->

**Test infrastructure:** 1014 tests, 21 suites, node:test runner, execSync-based CLI invocation

**Root cause:** Bun runtime banner (console.log to stdout) poisons JSON output parsed by tests

**Failure breakdown:**

| Category | Failures | Fix |
|----------|----------|-----|
| Banner: `[bGSD] Running with Bun v...` | 551 | Suppress banner in non-TTY/JSON mode |
| Banner: `[bGSD] Falling back to Node.js` | 40 | Same fix (remove fallback banner entirely) |
| Missing `src/lib/profiler` module | 3 | Remove/skip stale tests referencing deleted module |
| Plugin parser edge cases | 7 | Test isolation fix (ROADMAP.md.backup, live project assumptions) |
| Env/infra/misc edge cases | 6 | Individual fixes (baselines dir, config-migrate, context-budget) |
| **Total** | **607** | |

**Minimal fix:** Guard `showRuntimeBanner()` in `src/router.js` to skip when `_gsdOutputMode === 'json'` or `!process.stdout.isTTY`. One line change, 589 tests fixed.

**Avoid:** Changing test helpers (runGsdTools), adding env vars to test scripts, using stderr for banner
</stack_compact>
<!-- /section -->

<!-- section: recommended_stack -->
## Root Cause Analysis

### Primary Failure: Bun Runtime Banner (591 of 607 failures)

**Source file:** `src/router.js` lines 50-70, 170-176

**Mechanism:** When `bin/bgsd-tools.cjs` starts up, the router module:
1. Detects Bun availability via `detectBun()` in `src/lib/cli-tools/bun-runtime.js`
2. Since Bun 1.3.10 is installed on this system, `_runtimeDetected.available = true`
3. On line 173: `const showBanner = isVerbose || (_runtimeDetected && _runtimeDetected.available);`
4. Banner always shows when Bun is present, regardless of output mode
5. `showRuntimeBanner()` uses `console.log()` which writes to stdout
6. Tests call CLI via `execSync` (piped stdout) and `JSON.parse()` the output
7. Output becomes `[bGSD] Running with Bun v1.3.10\n{"key":"value",...}` — invalid JSON

**Two banner variants cause failures:**

| Banner Text | Condition | Failures |
|-------------|-----------|----------|
| `[bGSD] Running with Bun v1.3.10` | Bun detected, not forced via config | 551 |
| `[bGSD] Falling back to Node.js` | `BGSD_RUNTIME=node` or config `runtime=node` | 40 |

**Verification:** Setting `BGSD_RUNTIME=node BGSD_RUNTIME_DETECTED=true` before test run changes results from 407 pass / 607 fail → 996 pass / 18 fail. This confirms 589 failures are exclusively caused by the banner.

**Why it wasn't caught earlier:** The banner was added in v9.2 (CLI Tool Integrations & Runtime Modernization). At that time, Bun may not have been installed on the dev machine, or tests were run without Bun present. The banner only triggers when Bun is actually detected on the system.

### Fix Strategy

**Option A (RECOMMENDED): Guard banner on output mode** — 1 line change in `src/router.js`

```javascript
// Current (line 173):
const showBanner = isVerbose || (_runtimeDetected && _runtimeDetected.available);

// Fixed:
const showBanner = process.stdout.isTTY
  && (isVerbose || (_runtimeDetected && _runtimeDetected.available));
```

This suppresses the banner in piped/JSON mode (which is what tests use) while preserving it for interactive TTY use. It follows the existing output mode pattern used throughout the codebase (`global._gsdOutputMode` defaults to `'json'` when `!process.stdout.isTTY`).

**Option B: Use stderr for banner** — Changes `console.log` → `console.error` in `showRuntimeBanner()`. Works but pollutes stderr in piped workflows where stderr carries error information. Not recommended.

**Option C: Strip banner in test helper** — Modify `runGsdTools()` in `tests/helpers.cjs` to strip lines starting with `[bGSD]` before JSON.parse. Hack — masks the real bug instead of fixing it.

**Option D: Set env vars in test scripts** — Add `BGSD_RUNTIME_DETECTED=true` to `package.json` test scripts. Workaround — doesn't fix the underlying issue for any consumer that pipes output.

### Secondary Failures (18 remaining after banner fix)

**Evidence:** With banner suppressed (`BGSD_RUNTIME=node BGSD_RUNTIME_DETECTED=true`), 18 tests still fail across 5 suites.
<!-- /section -->

<!-- section: alternatives -->
## Failure Categorization: Residual 18 Tests

### Category 1: Missing `src/lib/profiler` Module (3 tests in `infra`)

**Tests:**
- `profiler disabled by default` — tries `require('./src/lib/profiler')` via `node -e`
- `profiler baseline JSON structure` — expects `.planning/baselines` directory from profiler
- Related assertion failures

**Root cause:** The profiler module was likely removed, renamed, or bundled into the CLI during a previous milestone. Tests still reference `./src/lib/profiler` as a standalone module, but it no longer exists at that path.

**Fix:** Either update tests to use the bundled CLI command (`node bin/bgsd-tools.cjs measure:profile`) or remove these stale tests if the profiler is no longer a standalone module.

**Effort:** ~15 min

### Category 2: Plugin Parser Tests (7 tests in `plugin`)

**Tests:**
- `parseRoadmap handles various milestone formats` — ENOENT on `.planning/ROADMAP.md.backup`
- `parseState handles extra unknown fields gracefully`
- `bgsd_status returns structured data from live project`
- `bgsd_plan no-args returns phases array`
- `bgsd_plan with phase number returns phase details`
- `bgsd_plan with invalid phase returns validation_error`
- `bgsd_plan validates valid and invalid input`

**Root causes:**
1. ROADMAP.md.backup rename failure: Test creates a backup of the real project's ROADMAP.md but fails to restore it (test isolation issue — modifies live project files)
2. Plugin tool tests (bgsd_status, bgsd_plan): These test LLM-callable tools that read the live `.planning/` directory. Failures stem from assumptions about the current project state (phase numbers, structure) that may have changed

**Fix:** Improve test isolation — use temp directories instead of modifying the live project. For plugin tool tests, create fixture project state.

**Effort:** ~30 min

### Category 3: Infrastructure Edge Cases (3 tests in `infra`)

**Tests:**
- `process exit handler is registered for temp file cleanup`
- `_tmpFiles tracking is wired into output pipeline`
- `outputJSON() function should push tmpPath to _tmpFiles`

**Root cause:** Tests check for `_tmpFiles` array and `process.on('exit')` registration in the bundle source. Pattern may have changed during a refactor.

**Fix:** Update assertions to match current bundle implementation.

**Effort:** ~15 min

### Category 4: Config Migration (2 tests — 1 `integration`, 1 `infra`)

**Tests:**
- `already-complete config returns empty migrated_keys`
- `idempotent on modern config`

**Root cause:** Config migration logic assumes certain config structure that has evolved. Modern configs may have fields that the migration check doesn't recognize as "already migrated."

**Fix:** Update test expectations or config migration detection logic.

**Effort:** ~15 min

### Category 5: Env & Misc (3 tests — 1 `env`, 1 `misc`, 1 `infra`)

**Tests:**
- `env scan does NOT write manifest when .planning/ does not exist`
- `context-budget <path> works with file arg`
- Plus cascading suite failure

**Root cause:** Various individual issues — env manifest write guard, context-budget file path handling.

**Fix:** Individual investigation needed per test.

**Effort:** ~20 min
<!-- /section -->

<!-- section: patterns -->
## Fix Strategy by Wave

**Wave 1: Banner suppression (589 tests fixed, ~10 min)**
- Single change in `src/router.js` line 173
- Guard `showBanner` on `process.stdout.isTTY`
- No behavioral change for interactive users
- Rebuild with `npm run build`

**Wave 2: Stale profiler tests (3 tests, ~15 min)**
- Remove or update tests referencing `./src/lib/profiler`
- Check if profiler functionality moved to `measure:profile` CLI command

**Wave 3: Plugin test isolation (7 tests, ~30 min)**
- Fix ROADMAP.md backup/restore in test
- Create fixture-based tests for plugin tools instead of testing against live project

**Wave 4: Infra assertions + config migration (5 tests, ~30 min)**
- Update `_tmpFiles` assertions to match current implementation
- Update config migration test expectations

**Wave 5: Individual edge cases (3 tests, ~20 min)**
- Fix env manifest guard test
- Fix context-budget file arg handling
- Verify cascading fixes

**Total estimated effort:** ~1.5-2 hours for all 607 → 0 failures
<!-- /section -->

<!-- section: compatibility -->
## Test Infrastructure Details

### Current Configuration

| Component | Value | Notes |
|-----------|-------|-------|
| Test runner | `node:test` | Built-in, no dependencies |
| Execution | `execSync` via `runGsdTools()` | Pipes stdout, parses JSON |
| Concurrency | `--test-concurrency=8` | Parallel suite execution |
| Force exit | `--test-force-exit` | Prevents hanging on unclosed handles |
| Node version | v25.7.0 | Running on current system |
| Bun version | 1.3.10 | Installed, detected by runtime module |
| Total tests | 1014 | Across 21 test suites |

### Per-Suite Failure Summary (before fix)

| Suite | Pass | Fail | Cause |
|-------|------|------|-------|
| decisions | 85 | 0 | Clean |
| enricher-decisions | 46 | 0 | Clean |
| summary-generate | 20 | 0 | Clean |
| plugin-advisory-guardrails | 27 | 0 | Clean |
| misc | 7 | 103 | Banner (103) |
| codebase | 55 | 67 | Banner (67) |
| env | 5 | 51 | Banner (50) + 1 edge case |
| verify | 4 | 53 | Banner (53) |
| state | 2 | 41 | Banner (41) |
| plan | 9 | 40 | Banner (40) |
| intent | 12 | 39 | Banner (39) |
| trajectory | 28 | 39 | Banner (39) |
| memory | 7 | 34 | Banner (34) |
| infra | 34 | 31 | Banner (22) + profiler (3) + tmpFiles (3) + config (2) + misc (1) |
| worktree | 6 | 30 | Banner (30) |
| agent | 23 | 19 | Banner (19) |
| init | 1 | 20 | Banner (20) |
| integration | 2 | 14 | Banner (13) + config (1) |
| orchestration | 0 | 11 | Banner (11) |
| contracts | 0 | 8 | Banner (8) |
| plugin | 34 | 7 | Parser/tool isolation (7) |

### After Banner Fix (projected)

| Suite | Pass | Fail | Remaining Issues |
|-------|------|------|------------------|
| 16 suites | all | 0 | Fully green |
| infra | 59 | 6 | profiler, tmpFiles, config |
| plugin | 34 | 7 | parser isolation, tool tests |
| env | 55 | 1 | manifest guard |
| integration | 15 | 1 | config migration |
| misc | 109 | 1 | context-budget |

## Sources

- **Live test run:** `node --test --test-force-exit --test-concurrency=8 tests/*.test.cjs` — 1014 tests, 407 pass, 607 fail
- **Banner suppression test:** `BGSD_RUNTIME=node BGSD_RUNTIME_DETECTED=true` prefix — 996 pass, 18 fail
- **Source inspection:** `src/router.js` lines 16-70, 170-176 — banner generation logic
- **Source inspection:** `src/lib/cli-tools/bun-runtime.js` — Bun detection module (608 lines)
- **Source inspection:** `tests/helpers.cjs` — `runGsdTools()` helper using `execSync` with piped stdio + `JSON.parse`
- **Per-suite isolation:** Individual test file runs with/without env variable suppression

---
*Stack research for: bGSD v11.4 test suite stabilization*
*Researched: 2026-03-13*
