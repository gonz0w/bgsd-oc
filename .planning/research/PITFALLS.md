# Domain Pitfalls

**Domain:** Adding state validation, cross-session memory, atomic planning, verification, integration testing, and dependency optimization to an existing Node.js CLI tool (GSD Plugin v2.0)
**Researched:** 2026-02-22
**Confidence:** HIGH — based on codebase analysis (15 src/ modules, 202 tests, 309+ regex patterns), industry context engineering patterns (Manus, Philschmid, Inkeep, LangChain), and testing anti-pattern research (Codepipes, Google Testing Blog)

## Critical Pitfalls

Mistakes that cause rewrites, data corruption, or features that make the system worse.

---

### Pitfall 1: State Validation That Creates More Problems Than State Drift

**What goes wrong:**
You add a `state validate` command that compares STATE.md against git/filesystem reality (e.g., "STATE.md says Phase 3, plan 2 is current, but no 03-02-PLAN.md exists on disk"). The validation fires false positives in legitimate scenarios:

1. **Mid-execution false positives.** A plan is being executed right now — the plan file exists but the SUMMARY.md hasn't been written yet. Validation reports "plan incomplete" during active work, interrupting the agent with a false alarm.
2. **Archive blindness.** After `milestone complete`, completed phase directories are archived to `.planning/milestones/vX.Y-phases/`. STATE.md still references "Phase 5 completed" but the directory moved. Validation reports "Phase 5 directory not found" — a false positive because archival is a correct state transition.
3. **Stale detection that fires on legitimate pauses.** You add "stale state detection" — if STATE.md's `Last activity` is >24h old, warn the user. But weekend breaks, multi-project developers, and vacation returns all trigger the warning. The first interaction after a break starts with a false alarm instead of useful context.
4. **Git history mismatch.** STATE.md says "3 commits in current plan" but `git log` returns 5 (because the developer made manual commits outside GSD). The validation reports "unexpected commits" which are actually legitimate.

The worst outcome: the agent starts "fixing" false positives. If the workflow says "Resolve all state validation warnings before proceeding," and validation reports phantom issues, the agent begins modifying STATE.md to silence warnings — corrupting the real state to satisfy a buggy validator.

**Why it happens:**
State drift detection requires an accurate model of ALL valid states and ALL valid transitions. The GSD system has at least 12 state transitions (plan start, plan complete, phase complete, milestone complete, blocker added, blocker resolved, session recorded, decision added, etc.) plus external events (manual git commits, file moves, archival). Missing even one legitimate transition in the validator produces false positives that erode trust.

**Consequences:**
- Agent wastes tokens diagnosing and "fixing" phantom issues
- User loses trust in state validation and ignores it (including real warnings)
- STATE.md corruption from automated "fixes" to false positives
- Workflows stall on validation gates that block legitimate work

**Prevention:**
1. **Start with read-only advisory mode.** The validator reports issues but NEVER blocks workflows or triggers automated fixes. Log warnings to `_validation` field in STATE.md JSON output — don't make them workflow-blocking gates.
2. **Enumerate every valid state transition before writing the validator.** Create a state machine diagram: `{current_state} + {event} → {next_state}`. Include archival, manual commits, paused states, and fresh starts. Only flag transitions that aren't in the machine.
3. **Require 3+ violations before triggering a warning.** A single mismatch between STATE.md and reality should be INFO level (logged), not WARNING (shown to agent). Only escalate to WARNING when multiple independent signals agree: wrong phase AND wrong plan count AND missing expected files.
4. **Test the validator against the real event-pipeline `.planning/` directory**, including after milestone completion, mid-execution, and fresh-start scenarios. If it fires false positives on the real project, it's not ready.
5. **Never auto-correct state.** The validator identifies drift; a separate explicit command (`state repair`) fixes it, and only with user confirmation.

**Warning signs:**
- Validator fires on first run against a project that was working fine
- Agent spends >30 seconds on "state validation" before starting real work
- STATE.md gets modified by the validation process itself
- Developer adds exceptions/ignores to suppress specific warnings

**Phase to address:** State Validation phase — must be the FIRST task: design the state machine before writing any validation code.

---

### Pitfall 2: Cross-Session Memory That Bloats Context Instead of Reducing It

**What goes wrong:**
You implement cross-session memory to survive `/clear` — persisting decisions, codebase knowledge, and position to a file (e.g., `.planning/.memory/session.md`). But the memory accumulates without bounds and eventually consumes MORE context than the problem it solved:

1. **Accumulation without decay.** Every decision, every file path, every architectural observation gets saved. After 20 sessions, the memory file is 8,000 tokens — 4% of context window consumed before any work begins. This is exactly the Manus `todo.md` problem: "~30% of tokens wasted on constant rewriting" of a growing working memory.
2. **Stale memories pollute context.** Session 5 recorded "STATE.md uses flat keys." Session 12 migrated to nested keys. Both facts exist in memory. The agent now has contradictory context — the definition of "Context Pollution" per Philschmid (2025): "too much irrelevant, redundant, or conflicting information that distracts the LLM."
3. **Memory becomes a second STATE.md.** Cross-session memory stores "current phase: 3, current plan: 2, last blocker: API timeout." But STATE.md already stores this. Now two sources of truth diverge, and the agent can't tell which is authoritative. This is the "retention without understanding" anti-pattern (Sphere Inc., 2025): persisting everything without semantic awareness of what's current.
4. **Resumption overhead exceeds benefit.** The init command loads memory file + STATE.md + ROADMAP.md + config.json. If memory adds 2,000 tokens, but the information was already in STATE.md (or obsolete), you've added 2,000 tokens of noise for zero information gain.

**Why it happens:**
Memory feels like a pure win — "persist knowledge across sessions." But memory management requires TWO operations: writing AND forgetting. Without controlled forgetting, memory degrades from signal to noise. As Ajith Vallath Prabhakar (2025) noted: "If controlled forgetting is not implemented, memory bloat can occur, leading to decreased reasoning efficiency."

**Consequences:**
- Context window consumed by stale/redundant memory, leaving less room for actual work
- Contradictory memories cause agent confusion and hallucinated reasoning
- Two sources of truth (memory vs STATE.md) diverge, causing decision errors
- "Context Rot" threshold hit earlier because memory fills the window faster

**Prevention:**
1. **Memory must have explicit categories with TTL (time-to-live).** Three categories:
   - **Position** (current phase/plan/status): overwritten each session, never accumulated. 50-100 tokens max.
   - **Decisions** (architectural choices, resolved blockers): kept until milestone completion, then archived. Each decision is ONE line.
   - **Codebase knowledge** (file locations, module relationships): refreshed by hashing `src/` directory listing; invalidated when hash changes.
2. **Hard token budget for memory: 500 tokens max.** If memory exceeds 500 tokens, the oldest non-position entries are evicted. This prevents unbounded growth.
3. **Memory is DERIVED from STATE.md, not a parallel store.** The `state record-session` command already records session continuity. Cross-session memory should be a curated SUBSET of STATE.md, not a separate document. Specifically: extract `Current Position` + `Decisions` (last 5) + `Blockers` into a compact format.
4. **Test memory after 10 simulated sessions.** Write a test that calls `state record-session` 10 times with varying data and verifies the memory file stays under 500 tokens. If it grows unbounded, the design is wrong.
5. **Use Manus's pattern: "Share context by communicating, not communicate by sharing context."** Don't inject memory into every workflow. Have workflows explicitly request memory when resuming (`init resume` returns memory; `init execute-phase` does not).

**Warning signs:**
- `.planning/.memory/` directory grows beyond 5KB
- `init resume` output exceeds 1,000 tokens
- Agent asks "Should I use the memory or STATE.md?" — two sources of truth detected
- Session start time increases as memory file grows

**Phase to address:** Cross-Session Memory phase — establish the 500-token budget and 3-category structure in the first task, before implementing persistence.

---

### Pitfall 3: Atomic Plan Decomposition Rules That Are Too Rigid or Too Loose

**What goes wrong:**
You add rules for plan granularity — "each plan should do one thing." But defining "one thing" is the hard part:

1. **Too rigid: trivial plans.** Rules say "max 3 files modified per plan." A simple rename that touches 5 import statements across 5 files now requires 2 plans, with a dependency between them. The planning overhead exceeds the work itself. You've created bureaucratic overhead that slows the agent.
2. **Too loose: bundled plans.** Rules say "one logical change per plan." An agent interprets "add state validation" as one logical change and produces a single 800-line plan that modifies 12 files. The plan exceeds context budget and fails mid-execution.
3. **Decomposition rules conflict with wave/dependency system.** The existing PLAN.md frontmatter has `wave` and `depends_on` fields for parallel execution. If atomic decomposition creates 8 plans where 3 existed, the wave assignments become complex, and `validate-dependencies` starts finding circular dependencies in what was previously a simple linear chain.
4. **Verification complexity scales with plan count.** Each plan gets a VERIFICATION.md. If decomposition triples plan count (3→9 plans), verification time triples too. A phase that previously took 4 sessions now takes 12 — most of it verifying trivial changes.

**Why it happens:**
Plan decomposition is a spectrum, not a binary. "Atomic" plans sound good in theory but the optimal granularity depends on context: a complex algorithm is better as one plan with internal steps; a broad refactoring is better as multiple plans. Fixed rules can't capture this.

**Consequences:**
- Agent spends more time planning and verifying than executing
- Plan dependencies become tangled, blocking parallel execution
- Context budget consumed by plan overhead (frontmatter, verification criteria, must_haves for each plan)
- Developer frustration: "Why is this trivial change split into 3 plans?"

**Prevention:**
1. **Use heuristics, not hard rules.** Instead of "max N files" or "max N lines," provide the planner with a decision framework:
   - Is this change independently verifiable? → Yes = one plan. No = split.
   - Will this plan exceed 50% of context budget? → Yes = must split.
   - Can any part of this change be done in parallel? → Yes = split into parallel plans with wave assignments.
2. **Set a context-budget threshold, not a file-count limit.** Use the existing `context-budget` command: estimate tokens for the plan + all referenced files + workflow overhead. If >60% of context window, recommend splitting. This is objective and measurable.
3. **Keep existing plans working.** The decomposition rules should be guidance for the `plan-phase` workflow, not a validation gate that rejects existing plans. v1.0/v1.1 plans that work fine should NOT be flagged as "not atomic enough."
4. **Test with real plans.** Take 5 existing PLAN.md files from v1.0/v1.1 and run the decomposition rules against them. If any working plan gets rejected or requires splitting, the rules are too rigid.

**Warning signs:**
- Planner produces plans with <100 lines of actual work but 200 lines of metadata
- Phase plan count jumps from 2-3 to 7-8 for equivalent scope
- `validate-dependencies` finds issues in plans that the decomposition created
- Agent requests "Can I merge these plans?" during execution

**Phase to address:** Atomic Planning phase — first task: define the decomposition heuristics as workflow guidance, not validation gates. Test against existing real plans.

---

### Pitfall 4: Verification That Takes Longer Than the Work It Verifies

**What goes wrong:**
"Comprehensive verification" sounds responsible. In practice, it can become the dominant cost of every phase:

1. **Auto-test execution on every plan.** Adding `npm test` (or `node --test`) as a mandatory verification step after every plan sounds good. But the test suite (202 tests) takes ~8 seconds to run. In a phase with 5 plans, that's 5 runs = 40 seconds of test execution, plus the agent reading and reasoning about each test result (~500 tokens of output per run × 5 = 2,500 tokens of verification overhead). For trivial plans (update a help string), this is disproportionate.
2. **Requirement tracing on every plan.** Checking "does this plan satisfy requirement X from REQUIREMENTS.md?" requires loading the requirements file (300+ tokens), the plan file, and the summary — then reasoning about the mapping. For 5 plans in a phase, that's 5 separate requirement-tracing operations consuming 1,500+ tokens total. The tracing itself doesn't find bugs; it confirms alignment that the planner already established.
3. **Regression detection via `session-diff`.** After each plan, comparing git state to expected state to detect regressions. But "expected state" is undefined for most plans — what file SHOULDN'T have changed? Without a clear expectation, regression detection becomes "did anything unexpected happen?" which is computationally expensive and prone to false positives.
4. **Verification of verification.** Adding `verify plan-structure` before execution AND `verify phase-completeness` after AND `verify artifacts` after AND `verify key-links` after. Four verification passes per plan × 5 plans = 20 verification calls. The existing verify commands total ~668 lines of code — more than many feature commands.

**Why it happens:**
Verification is the one area where "more is always better" feels true. But verification has diminishing returns just like test coverage. The first check catches 80% of issues; each additional check catches exponentially fewer.

**Consequences:**
- Phase execution time doubles or triples from verification overhead
- Token budget consumed by verification results instead of actual work
- Agent becomes "verification-bound" — spending more time checking than doing
- Developer disables verification ("too slow") and loses all benefit

**Prevention:**
1. **Tiered verification: light/standard/deep.** 
   - **Light** (default for plans <200 lines): `verify plan-structure` before, `verify phase-completeness` after. No test execution, no requirement tracing.
   - **Standard** (default for phases): test suite runs once at PHASE end, not per-plan. Requirement tracing at phase level.
   - **Deep** (opt-in via `config.json`): full verification suite per plan. Reserved for critical phases (foundation, security).
2. **Test execution: once per phase, not per plan.** Run `node --test` after all plans in a phase complete, not after each individual plan. If tests fail, bisect which plan broke them. This cuts test execution from 5× to 1× per phase.
3. **Budget verification itself.** Verification should consume <10% of total phase tokens. Use `context-budget` to measure: if verification output exceeds 10% of the phase's total context consumption, reduce verification scope.
4. **Make regression detection opt-in.** Don't add regression detection as a default — it requires defining "expected unchanged files" which is plan-specific overhead. Let the planner declare `expect_unchanged: [file1, file2]` in frontmatter; regression detection only runs when this field exists.

**Warning signs:**
- Agent output contains more verification summaries than code changes
- Phase takes 3+ sessions where the work itself fits in 1
- Developer asks "Can we skip verification?" frequently
- Verification finds zero issues for 10 consecutive plans (ROI is zero)

**Phase to address:** Comprehensive Verification phase — first task: design the light/standard/deep tiers. Default to light. Prove standard is necessary with data before mandating it.

---

### Pitfall 5: Integration Tests That Test Implementation Details of a CLI Tool

**What goes wrong:**
You add end-to-end integration tests (init → plan → execute → verify) and they become the most expensive part of the codebase to maintain:

1. **Snapshot fragility.** You snapshot the JSON output of `init execute-phase 1` as a golden file. Any change to output format — adding a field, changing a date, updating version number — breaks the snapshot. node:test has snapshot support but it requires `--test-update-snapshots` after every change, which defeats the purpose of regression detection.
2. **Git-dependent tests are non-deterministic.** Integration tests that call `session-diff`, `commit`, or `rollback-info` depend on git state. If a test creates commits, the SHA changes every run. If it checks commit count, parallel test execution can see commits from other tests. The Codepipes blog (2018) identifies flaky tests as the #1 reason teams abandon test suites: "even a small number of flaky tests is enough to destroy the credibility of the rest."
3. **Multi-step workflow tests are order-dependent.** A test for "init → plan → execute → verify" requires each step to succeed before the next. If step 2 fails, you get a cascade of 3 failures — all showing "execute failed" or "verify failed" when the root cause was in planning. Debugging requires understanding the full chain.
4. **Temp directory explosion.** Each integration test creates a full `.planning/` directory structure with ROADMAP.md, STATE.md, config.json, phase directories, and plan files. A 10-test integration suite creates 10 temp directories with dozens of files each. Test setup is 50+ lines per test; the actual assertion is 5 lines. The test code becomes harder to read than the feature code.
5. **Real project coupling.** The AGENTS.md directive says "Always test against `/mnt/raid/DEV/event-pipeline/.planning/`." Integration tests that rely on a specific real project are non-portable (they fail on any other developer's machine) and non-deterministic (the real project changes over time).

**Why it happens:**
Integration tests for a CLI tool that processes files are inherently I/O-heavy. The black-box testing approach (run CLI as subprocess, check output) means every test pays the Node.js startup cost (~80ms), file creation cost, and JSON parsing cost. This is the correct approach for API contract testing, but it's expensive for behavioral testing.

**Consequences:**
- Test suite takes 30+ seconds, discouraging frequent runs
- Snapshot updates become a ritual chore after every change
- Git-dependent tests fail randomly on CI, eroding trust
- Team avoids writing new tests because the setup cost is high

**Prevention:**
1. **Separate integration tests from unit tests by directory.** Keep the existing `gsd-tools.test.cjs` (202 tests, fast, temp-dir-based) as the primary suite. Create `gsd-tools.integration.test.cjs` for workflow-level tests. Run integration tests only on `npm run test:integration`, not on every change.
2. **Don't snapshot full JSON output.** Instead, assert specific fields that define the contract: `assert.ok(output.phase_found)`, `assert.strictEqual(output.plan_count, 3)`. This survives field additions without breaking.
3. **Mock git for integration tests.** Create a helper that initializes a git repo in the temp directory with a known initial commit. Tests that need git history create deterministic commits with fixed messages/dates. Never depend on the real project's git history.
4. **Use test fixtures, not inline file creation.** Create a `test/fixtures/basic-project/` directory with a canonical `.planning/` structure. Copy it into temp directories at test start. This eliminates the 50-line setup blocks and makes tests readable.
5. **No real project dependencies in automated tests.** The event-pipeline testing is for manual validation. Automated tests must use self-contained fixtures. Add a comment: "// Manual: test against real project per AGENTS.md."
6. **Limit integration tests to 5-10 per feature area.** They validate the critical paths only. Business logic is tested by the existing unit tests. Integration tests confirm: "Can the CLI parse this input format?" and "Does the multi-command workflow produce the expected state transition?"

**Warning signs:**
- `npm test` takes >15 seconds (currently ~8 seconds for 202 tests)
- A code change breaks >10 tests that are unrelated to the change
- Tests contain `sleep()`, `setTimeout()`, or retry loops
- Test file exceeds 5,000 lines (current test file is 4,591 lines — already large)

**Phase to address:** Integration Testing phase — first task: create the test infrastructure (fixtures directory, git mock helper, integration test runner). Don't write tests until infrastructure is solid.

---

### Pitfall 6: Adding Dependencies That Break the Zero-Runtime-Dep Constraint or Bloat the Bundle

**What goes wrong:**
v2.0 says "may introduce bundled dependencies if they demonstrably reduce tokens or improve quality." This opens the door to dependency creep:

1. **WASM dependencies that don't bundle.** A YAML parser like `js-yaml` (72KB) bundles fine via esbuild. A tokenizer with WASM binaries (e.g., `tiktoken` at ~2MB) does NOT bundle cleanly — esbuild can't tree-shake WASM, and the binary needs to be deployed alongside the JS bundle. This violates the single-file deploy constraint.
2. **ESM-only packages.** The project outputs CJS (`gsd-tools.cjs`). Adding an ESM-only dependency requires esbuild to transpile it, which usually works but occasionally fails for packages with complex dynamic imports. The `tokenx` library (already bundled, 4.5KB) was chosen specifically because it works with CJS; many newer libraries don't.
3. **Bundle size regression.** The current bundle is ~200KB. Each added dependency increases startup time. If the bundle grows to 500KB, Node.js cold-start goes from ~80ms to ~150ms. Multiply by 10 CLI invocations per workflow = 700ms added latency. This was already identified as a pitfall in v1.1 (Pitfall 3) — it's more dangerous in v2.0 because the scope of "allowed dependencies" is wider.
4. **Transitive dependency explosion.** Adding one library pulls its dependencies. Even with bundling, esbuild includes all transitive code. A library that looks like 10KB might bundle to 100KB because of transitive dependencies. Example from the wild: `esbuild-based tools tend to have less accurate tree shaking, resulting in larger bundle sizes` (ryoppippi, 2025).
5. **Test dependency vs runtime dependency confusion.** v2.0 adds integration tests that may need test helpers (a YAML assertion library, a git mock library). These should be devDependencies only. If they leak into the bundle (because esbuild resolves all requires), the production CLI carries test-only code.

**Why it happens:**
The "bundled dependency" permission feels like freedom. But the single-file constraint means EVERY byte of every dependency ships in the CLI. There's no tree-shaking for unused features; there's no lazy loading of separate modules.

**Consequences:**
- Bundle exceeds 500KB; CLI startup becomes noticeably slow
- WASM dependency breaks single-file deploy
- ESM-only package causes build failure that blocks deployment
- Test code accidentally included in production bundle

**Prevention:**
1. **Bundle size budget: 300KB max.** Currently ~200KB. Allow 100KB growth for v2.0. If a dependency would push past 300KB, it needs explicit justification with measured benefit.
2. **Pre-check every dependency before adding it:**
   - `du -sh node_modules/<pkg>` — raw size
   - `esbuild --bundle --analyze src/index.js` — bundled size with tree shaking
   - Check for WASM/native binaries: `find node_modules/<pkg> -name "*.wasm" -o -name "*.node"`
   - Check for ESM-only: `grep '"type": "module"' node_modules/<pkg>/package.json`
3. **Prefer micro-libraries over full frameworks.** `tokenx` (4.5KB) over `tiktoken` (2MB). `yaml-tiny` (3KB) over `js-yaml` (72KB). If no micro-library exists, copy the 50 lines you need into `src/lib/` instead.
4. **Mark devDependencies correctly in package.json** and configure esbuild with `--external` for test-only packages. Verify with `node -e "require('./bin/gsd-tools.cjs')"` after build — if it throws a missing module error, a test dep leaked.
5. **Test startup time in CI.** Add to build pipeline: `time node bin/gsd-tools.cjs current-timestamp --raw`. If it exceeds 150ms, investigate.

**Warning signs:**
- `ls -la bin/gsd-tools.cjs` shows >300KB
- `npm run build` emits esbuild warnings about unresolved imports
- `node bin/gsd-tools.cjs current-timestamp` takes >150ms
- `deploy.sh` copies more than one JS file

**Phase to address:** Dependency & Token Optimization phase — first task: establish the 300KB budget and pre-check protocol. Every subsequent dependency addition must pass the check.

---

## Moderate Pitfalls

Mistakes that cause rework or significant wasted effort, but not rewrites.

---

### Pitfall 7: Memory and State Validation Creating Circular Dependencies

**What goes wrong:**
Cross-session memory needs state validation to know if memory is stale. State validation needs memory to know what the last validated state was. You create a bootstrap problem: validating state requires loading memory, but loading memory requires validated state.

Concrete scenario: `init resume` loads memory file to restore position. Memory says "Phase 3, plan 2." It then validates state: STATE.md says "Phase 3, plan 1." Which is correct — memory (last session's snapshot) or STATE.md (current truth)? The answer should be STATE.md, but memory was loaded first, and the agent has already used memory's "plan 2" to orient itself.

**Prevention:**
1. **STATE.md is always authoritative.** Memory is advisory only. Memory says "I think we were at..." State says "We are at..." If they disagree, state wins, memory updates.
2. **Load order: STATE.md first, memory second, then reconcile.** Never load memory before state. The `init resume` command should: (1) load STATE.md, (2) load memory, (3) diff and warn if they disagree, (4) return STATE.md values with memory annotations.
3. **Test the bootstrap: fresh project, stale memory, corrupted memory, missing memory.** Four test cases that validate the load-order contract.

**Phase to address:** Cross-Session Memory phase AND State Validation phase — define the precedence rule in the first task of whichever ships first.

---

### Pitfall 8: Verification Suite Testing Its Own Output Format Instead of Behavior

**What goes wrong:**
The existing verification commands (`verify plan-structure`, `verify phase-completeness`, `verify references`, etc.) return structured JSON with `errors`, `warnings`, and `valid` fields. When adding "comprehensive verification," you write tests that assert the exact JSON structure of verification output — not whether verification catches real problems.

Example test: `assert.deepStrictEqual(output.errors, ['Missing required frontmatter field: phase'])`. This breaks when you rename the error message string, even though the verification still works correctly. This is the "testing internal implementation" anti-pattern from Codepipes: "tests were instructed to verify internal implementation which is always a recipe for disaster."

**Prevention:**
1. **Test verification by behavior:** Create a plan with a known defect → run verify → assert `valid === false`. Create a good plan → run verify → assert `valid === true`. Don't assert error message strings.
2. **Test error categories, not messages:** `assert.ok(output.errors.length > 0, 'should find errors')` and `assert.ok(output.errors.some(e => e.includes('frontmatter')), 'should mention frontmatter')` — contains-check, not exact-match.
3. **Use regression tests from real bugs.** When verification misses a real issue (false negative) or flags a good file (false positive), capture that file as a test fixture. These are the highest-value tests.

**Phase to address:** Comprehensive Verification phase AND Integration Testing phase — establish the behavioral testing pattern before writing verification tests.

---

### Pitfall 9: Integration Tests That Require Specific Node.js Version Features

**What goes wrong:**
node:test in Node.js 18 supports basic `describe`/`test`/`assert`. Node.js 20+ adds snapshot testing, `mock`, and `test.plan()`. Node.js 22+ adds `--test-isolation`. Writing integration tests that use Node 22+ features locks out Node 18 users (the minimum version in package.json `engines`).

**Prevention:**
1. **Test only with features available in Node.js 18.** No `t.mock()`, no `assert.snapshot()`, no `--test-isolation`. The project constraint is `>=18`.
2. **If mocking is needed, use manual mocking patterns:** inject dependencies via function parameters or environment variables, not framework-level mocking.
3. **Document node:test version compatibility** in TESTING.md: "Tests must work on Node.js 18. Do not use: mock, snapshot, plan, isolation features."

**Phase to address:** Integration Testing phase — document in the first task before anyone writes tests.

---

### Pitfall 10: Atomic Decomposition Inflating the Phase Directory Structure

**What goes wrong:**
Current phases have 1-4 plans each (e.g., Phase 1 had 4 plans, Phase 8 had 3 plans). Atomic decomposition could inflate this to 6-10 plans per phase. Each plan requires:
- `XX-NN-PLAN.md` (the plan file)
- `XX-NN-SUMMARY.md` (the completion record)
- Wave/dependency frontmatter
- Verification criteria in must_haves

A phase directory grows from 6-8 files to 12-20 files. The `phase-plan-index` command that inventories plans now returns a larger JSON blob. The `init execute-phase` output grows. Wave visualization becomes complex. The overhead per phase increases even when the actual work stays the same.

**Prevention:**
1. **Allow "tasks within plans" as an alternative to splitting.** A plan can contain multiple `<task>` elements. Atomic decomposition should prefer task-level splitting within a single plan file over creating separate plans. Only create separate plans when tasks need different waves or have different dependencies.
2. **Set a plan-count guideline: 2-5 plans per phase.** If decomposition produces >5 plans, reconsider whether the phase scope is too large (split the phase) rather than adding more plans.
3. **Measure overhead: total metadata tokens per phase.** For each phase, sum frontmatter + must_haves + verification criteria tokens across all plans. If metadata exceeds 25% of total plan content, the decomposition is too fine-grained.

**Phase to address:** Atomic Planning phase — second task: test decomposition rules against v1.0/v1.1 phases and verify plan counts stay in 2-5 range.

---

## Minor Pitfalls

Annoyances that waste time but don't derail the project.

---

### Pitfall 11: Verification Commands Duplicating Logic From Verify Suite

The existing verify suite has 5 commands in `src/commands/verify.js` (668 lines). "Comprehensive verification" adds new checks (auto-test, requirement tracing, regression detection). If these are added as separate commands rather than extending existing ones, you get two verify paths: the old `verify plan-structure` and the new `verify comprehensive` that partially overlap. Agents don't know which to call.

**Prevention:** Extend existing verify commands with new capabilities. Add `--deep` flag to existing commands rather than creating new top-level commands. The verify suite should remain a single entry point.

---

### Pitfall 12: Integration Test File Becoming Larger Than the Source It Tests

The existing test file is 4,591 lines (vs source bundle at ~6,500 lines). Integration tests with their extensive setup blocks could easily add 2,000+ lines. A test file larger than the source is a maintenance smell — it means tests are doing more work than the feature.

**Prevention:** Use shared fixtures and helper functions. A well-designed `test/helpers.js` with `createBasicProject()`, `createProjectWithPhases(3)`, `createProjectWithState({phase: 3, plan: 2})` can reduce per-test setup from 50 lines to 1 line.

---

### Pitfall 13: Dependency Optimization Finding Savings That Don't Survive the Bundle

You profile tokenx and find a "better" tokenizer that's 2KB smaller. You replace it. But esbuild's bundling adds overhead (CJS wrappers, module resolution) that negates the 2KB savings. Net bundle size is the same or larger.

**Prevention:** Always measure bundle size, not package size. `esbuild --bundle --analyze` shows actual contribution per module. Only pursue savings >10KB net bundle impact.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| State Validation | False positives on legitimate state transitions (archival, manual commits, mid-execution) | Advisory-only mode first; enumerate all valid transitions before coding |
| Atomic Plan Decomposition | Plans too granular, verification overhead per plan, wave complexity explosion | Context-budget threshold, not file-count limits; tasks-within-plans over separate plans |
| Cross-Session Memory | Unbounded growth, stale facts, second source of truth vs STATE.md | 500-token budget, 3-category TTL system, STATE.md always authoritative |
| Comprehensive Verification | Takes longer than the work; per-plan test execution wasteful for trivial plans | Light/standard/deep tiers; tests run per-phase not per-plan |
| Integration Tests | Snapshot fragility, git non-determinism, multi-step cascade failures | Behavioral assertions, git mock helper, separate test runner |
| Dependency/Token Optimization | Bundle bloat, WASM breaks single-file deploy, ESM-only packages | 300KB budget, pre-check protocol, prefer micro-libraries |

## Integration Gotchas

Cross-cutting mistakes when these features interact with each other.

| Feature A | Feature B | What Goes Wrong | Prevention |
|-----------|-----------|----------------|------------|
| State Validation | Cross-Session Memory | Circular dependency: validation needs memory for baseline, memory needs validation for freshness | STATE.md is authoritative; memory is advisory; load STATE.md first always |
| Atomic Decomposition | Verification | 3× more plans = 3× more verification calls; overhead dominates | Verification at phase level, not plan level (except for deep mode) |
| Integration Tests | Dependencies | Test helpers become runtime dependencies via bundler mistake | Separate test infrastructure; `--external` flags for test packages in esbuild |
| Cross-Session Memory | Atomic Decomposition | Memory tracks "last plan" but decomposition changes plan numbering between sessions | Memory references phase + plan by content hash or description, not by number |
| State Validation | Integration Tests | Testing validation requires many fixture states; test setup becomes complex | Shared fixture library with pre-built states: valid, drifted, archived, mid-execution |
| Verification | Dependencies | Adding a test framework dependency (assertion library) gets bundled into production | Use only `node:assert` and `node:test`; no external test frameworks |

## "Looks Done But Isn't" Checklist

Things that appear complete but have critical gaps.

- [ ] **State validation "works":** Run it against event-pipeline mid-phase-execution, after milestone-complete, after manual commit, and with stale STATE.md. All 4 scenarios must either pass or produce accurate warnings.
- [ ] **Cross-session memory "persists":** After 10 sessions, memory file is under 500 tokens. After a codebase change that restructures files, memory invalidates stale knowledge.
- [ ] **Atomic decomposition "enforced":** Existing v1.0/v1.1 PLAN.md files pass the decomposition validator without changes. New plans that genuinely need splitting are detected.
- [ ] **Verification "comprehensive":** Light mode adds <5% overhead to phase execution. Deep mode is opt-in. Test execution runs once at phase end, not per-plan.
- [ ] **Integration tests "stable":** 50+ consecutive runs with zero flaky failures. No dependency on real project paths. Run time under 30 seconds for the integration suite.
- [ ] **Dependencies "optimized":** Bundle under 300KB. `time node bin/gsd-tools.cjs current-timestamp --raw` under 150ms. `deploy.sh` still deploys a single JS file.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| State validation false positives | LOW | Add the missing state transition to the validator. Switch to advisory mode. |
| Memory bloat | LOW | Truncate memory file to 500 tokens, add eviction logic. |
| Plans too granular | MEDIUM | Merge plans back; relax decomposition rules to heuristics. |
| Verification too slow | LOW | Switch from deep to light mode as default. |
| Integration tests flaky | MEDIUM | Delete flaky tests. Rebuild with deterministic fixtures. Separate from main test suite. |
| Bundle too large | MEDIUM | Remove the offending dependency. Replace with micro-library or inline code. |
| Memory contradicts state | LOW | Delete memory file. Regenerate from STATE.md. |
| Decomposition breaks wave system | MEDIUM | Revert to pre-decomposition plan structure. Re-plan with looser rules. |

## Sources

- **Codebase analysis:** `src/commands/state.js` (390 lines), `src/commands/verify.js` (668 lines), `src/commands/features.js` (1,461 lines), `bin/gsd-tools.test.cjs` (4,591 lines), `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md`, `.planning/codebase/TESTING.md`
- **PROJECT.md:** v2.0 scope, constraints, key decisions
- **Manus context engineering:** (Philschmid, Dec 2025) — Context Rot, Context Pollution, Context Confusion; todo.md wasted ~30% tokens; "share context by communicating, not communicate by sharing context"; prefer compaction > summarization — https://www.philschmid.de/context-engineering-part-2
- **Inkeep context rot analysis** (Oct 2025) — "Every unnecessary token actively degrades performance"; just-in-time retrieval over upfront loading; attention budget concept — https://inkeep.com/blog/fighting-context-rot
- **AI-native memory** (Ajith Vallath Prabhakar, Jun 2025) — "If controlled forgetting is not implemented, memory bloat can occur, leading to decreased reasoning efficiency" — https://ajithp.com/2025/06/30/ai-native-memory-persistent-agents-second-me/
- **Mem0 production memory** (2025) — "the absence of persistence, prioritization, and salience makes [large context] insufficient for true intelligence" — https://mem0.ai/blog/memory-in-agents-what-why-and-how
- **Cross-session agent memory** (MGX.dev, 2025) — "Intelligent Filtering: Using priority scoring and contextual tagging to store only highly relevant information, preventing memory bloat" — https://mgx.dev/insights/cross-session-agent-memory-foundations-implementations-challenges-and-future-directions/
- **Sphere Inc memory vs context** (2025) — "2025 was the year of retention without understanding — vendors rushed to add retention features" — https://www.sphereinc.com/blogs/ai-memory-and-context/
- **OpenAI Agents SDK session memory** (2025) — "prevents context bloat by discarding older turns wholesale" — https://cookbook.openai.com/examples/agents_sdk/session_memory
- **Software testing anti-patterns** (Codepipes, 2018, updated 2026) — integration test complexity/debugging, testing implementation vs behavior, flaky tests destroying suite credibility — https://blog.codepipes.com/testing/software-testing-antipatterns.html
- **Node.js CLI bundle concerns** (ryoppippi, 2025) — "esbuild-based tools tend to have less accurate tree shaking, resulting in larger bundle sizes" — https://ryoppippi.com/blog/2025-08-12-my-js-cli-stack-2025-en
- **esbuild FAQ** — startup performance characteristics for bundled CLI tools — https://esbuild.github.io/faq/
- **Configuration drift detection** (multiple 2025 sources) — false positive prevention techniques, drift detection lifecycle — https://www.josys.com/article/understanding-the-lifecycle-of-configuration-drift-detection-remediation-and-prevention

---
*Pitfalls research for: GSD Plugin v2.0 Quality & Intelligence*
*Researched: 2026-02-22*
