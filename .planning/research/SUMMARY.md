# Project Research Summary

**Project:** GSD Plugin v2.0 — Quality & Intelligence
**Domain:** State validation, cross-session memory, atomic planning, verification, and integration testing for AI-driven CLI workflow orchestration
**Researched:** 2026-02-22
**Confidence:** HIGH

<!-- section: compact -->
<compact_summary>

**Summary:** v2.0 makes the GSD plugin self-aware — it validates its own state against reality, persists knowledge across sessions, enforces atomic plan structure, verifies deliverables comprehensively, and locks this down with integration tests. The recommended approach adds zero new runtime dependencies (all capabilities built with Node.js built-ins), keeping the bundle under 315KB. The key risk is feature interactions: state validation that fires false positives, memory that bloats context instead of reducing it, and verification that costs more tokens than the work it verifies.

**Recommended stack:** No new npm dependencies. Node.js built-ins only: `node:crypto` (SHA-256 drift detection), `node:assert` (deep comparison), `node:test` (integration tests), `structuredClone` (state snapshots), `fs.writeFileSync` + `fs.renameSync` (atomic JSON persistence). Estimated +4-8KB bundle growth (1-3% of current 303KB).

**Architecture:** Layered CLI with 3 new modules (`lib/validation.js`, `lib/memory.js`, `commands/memory.js`) extending existing 16-module structure. Commands import from lib (never cross-command). Dual-store pattern: STATE.md (human-readable, authoritative) + memory.json (machine-optimized, advisory).

**Top pitfalls:**
1. State validation false positives (mid-execution, post-archive, manual commits) — advisory-only mode first; enumerate all valid state transitions before coding
2. Cross-session memory bloating context — hard 500-token budget, 3-category TTL, STATE.md always authoritative over memory
3. Verification overhead exceeding the work it verifies — light/standard/deep tiers; tests run per-phase not per-plan
4. Integration tests coupled to implementation details — behavioral assertions, git mock helper, separate test runner
5. Atomic decomposition being too rigid — context-budget threshold, not file-count limits; heuristics not hard rules

**Suggested phases:**
1. **Phase 10: State Intelligence** — Foundation: everything benefits from validated state. LOW complexity, immediate trust improvement.
2. **Phase 11: Session Continuity** — Cross-session memory with dual-store pattern. Builds on validated state.
3. **Phase 12: Quality Gates** — Comprehensive verification + atomic decomposition. Both are verification concerns; test execution gating + plan atomicity checks.
4. **Phase 13: Test Infrastructure & Polish** — Integration tests for all new features + dependency/token optimization research.

**Confidence:** HIGH overall | **Gaps:** Integration test fixture design needs prototyping; memory compaction algorithm needs validation after 10+ sessions
</compact_summary>
<!-- /section -->

<!-- section: executive_summary -->
## Executive Summary

The GSD plugin v2.0 transitions from "build and compress" (v1.0/v1.1) to "trust and verify." The research confirms that the AI coding tool ecosystem is converging on three capabilities that separate production tools from prototypes: drift detection (ensuring declared state matches reality, borrowed from IaC/GitOps), persistent memory (claude-mem at 30K+ GitHub stars and OpenCode issue #8043 prove cross-session memory is the most requested missing capability), and eval-driven development (Anthropic's Jan 2026 evals engineering post establishes verification as a first-class concern). GSD already has the filesystem-as-database pattern (`.planning/`) and 79 CLI commands — v2.0 makes the system self-correcting by detecting when state drifts, remembering what it learned, and proving work was done correctly.

The recommended approach is emphatically zero new dependencies. STACK.md research measured actual bundle sizes: AJV adds 238KB (79% bloat), Zod adds 150KB (50% bloat), better-sqlite3 can't bundle at all, sql.js adds 1.2MB of WASM. Every v2.0 capability maps to Node.js built-ins or hand-written code costing 1-3KB each. The total estimated bundle growth is 4-8KB, keeping the CLI under 315KB. This is a 100x size advantage over library alternatives for GSD's 3-5 fixed, simple schemas. Architecture research confirms the integration strategy: 3 new source modules, 7 modified modules, ~2,000 new lines of source, ~400 new lines of integration tests, growing from 16 to 19 modules while preserving every architectural invariant (commands never import from other commands, every command follows the `(cwd, ...args, raw)` → `output(result, raw)` protocol).

The key risks are feature interactions, not individual feature complexity. State validation that fires false positives on legitimate transitions (archival, manual commits, mid-execution) will erode trust faster than no validation at all. Cross-session memory that accumulates without decay will consume MORE context than the problem it solves — the Manus `todo.md` anti-pattern where ~30% of tokens were wasted on growing working memory. Verification that runs per-plan instead of per-phase will make phases take 3x longer. Each risk has a concrete prevention strategy grounded in industry patterns: advisory-only validation (IaC drift detection), hard token budgets for memory (500 tokens max), and tiered verification (light/standard/deep). The mitigation pattern is consistent: start conservative, measure, then tighten.
<!-- /section -->

<!-- section: key_findings -->
## Key Findings

### Recommended Stack

Zero new npm dependencies. All v2.0 capabilities built with Node.js built-ins plus targeted hand-written code. The existing stack (Node.js 18+, esbuild 0.27.3, node:test, tokenx 1.3.0, 15 src/ modules) is unchanged. No build pipeline changes required.

**Core technologies:**
- **Hand-written schema validators** (~1-3KB): State/config/plan validation — 100x smaller than AJV (238KB) or Zod (150KB) for 3-5 fixed schemas with 5-15 fields each
- **JSON + atomic write** (`fs.writeFileSync` + `fs.renameSync`): Cross-session persistence — no concurrent access (CLI runs <5s), data <50KB, human-readable and git-committable
- **node:test + execSync** (existing pattern): Integration testing — 202 tests already use this; `describe/it/beforeEach/afterEach/mock.fn()` all available in Node 18+
- **node:crypto SHA-256 + structuredClone + node:assert.deepStrictEqual**: State drift detection — hash files for change detection, deep clone for snapshots, deep compare with diff output
- **tokenx** (already bundled, 4.5KB): Token optimization — ~96% accurate BPE estimation, sufficient for context budgeting

**Critical decision: No AJV, no Zod, no SQLite, no test frameworks.** Hand-written validators for known, fixed schemas at ~500 bytes each. JSON file persistence with atomic rename. Node.js built-in test runner. Every alternative was measured and rejected on bundle size grounds.

### Expected Features

**Must have (table stakes):**
- **Phase completion drift detection** — compare ROADMAP.md claims against actual SUMMARY.md files on disk (LOW complexity)
- **Current position validation** — detect when STATE.md points to non-existent or already-completed plans (LOW complexity)
- **Decision persistence + session bookmarks** — survive `/clear` by persisting decisions and exact position (LOW complexity each)
- **Test execution gating** — wire existing unwired `test-run` command into verification workflow (LOW complexity)
- **Workflow sequence tests** — end-to-end tests for init → plan → execute → verify chains (MEDIUM complexity)
- **Plan complexity analysis** — flag when plans bundle 3+ unrelated concerns (MEDIUM complexity)

**Should have (competitive):**
- **Auto-repair of simple drift** — `validate --fix` for unambiguous corrections (MEDIUM complexity)
- **Context injection at session start** — init commands include memory digest automatically (MEDIUM complexity)
- **Regression detection via test comparison** — before/after test result baseline comparison (MEDIUM complexity)
- **Goal-backward verification** — verify `must_haves` were actually produced, not just that tasks completed (MEDIUM complexity)

**Defer (v2+ later phases or v3.0):**
- **Cross-project knowledge** — global memory at `~/.config/opencode/gsd-memory/` (HIGH complexity, needs proven project-level pattern first)
- **Multi-dimensional quality scoring** — composite quality score across dimensions (HIGH complexity, capstone)
- **End-to-end workflow simulation** — simulate complete agent decision-making chains (HIGH complexity, diminishing returns)
- **Progressive --compact adoption** — breaking change, needs migration period across milestone boundary

### Architecture Approach

The integration adds 3 new modules to the existing 16-module structure while preserving strict architectural invariants. The dual-store pattern — STATE.md for human-readable authoritative state, memory.json for machine-optimized advisory data — avoids the anti-pattern of using markdown as a structured database. New lib modules (`validation.js`, `memory.js`) provide shared foundation; a new command module (`commands/memory.js`) provides the CLI surface. Existing modules grow modestly: verify.js gains ~350 lines for comprehensive verification, features.js gains ~80 lines for regression detection baselines, init.js gains ~50 lines for validation warnings and memory digests.

**Major components:**
1. **`lib/validation.js` (NEW, ~150-200 lines)** — State drift detection, position validation, milestone alignment, progress accuracy checks. Consumed by state.js, verify.js, and init.js.
2. **`lib/memory.js` (NEW, ~200-250 lines)** — Structured memory CRUD with atomic JSON persistence, token-budgeted digest, pruning. Storage at `.planning/memory.json`.
3. **`commands/memory.js` (NEW, ~250-300 lines)** — CLI interface: `memory load/add/query/prune/digest`. Follows one-module-per-domain pattern.
4. **`commands/verify.js` (EXTENDED, 668→~1,060 lines)** — 4 new subcommands: plan-atomicity, requirements, regression, deliverables.
5. **`bin/gsd-integration.test.cjs` (NEW, ~400-600 lines)** — End-to-end workflow chain tests with fixture-based test infrastructure.

### Critical Pitfalls

1. **State validation false positives** — Mid-execution, post-archive, and manual commit scenarios all produce legitimate states that a naive validator flags as drift. **Prevention:** Advisory-only mode (never blocks workflows), enumerate all valid state transitions before coding, require 3+ violations before WARNING level, test against real event-pipeline project in all scenarios.

2. **Cross-session memory bloating context** — Without controlled forgetting, memory degrades from signal to noise. After 20 sessions, an unbounded memory file consumes 8,000+ tokens before any work begins. **Prevention:** Hard 500-token budget, 3-category TTL system (position: overwrite each session; decisions: keep until milestone; codebase knowledge: invalidate on hash change), STATE.md always authoritative.

3. **Verification overhead exceeding work** — Per-plan test execution (5 plans × 8s test suite = 40s + 2,500 tokens verification overhead) is disproportionate for trivial changes. **Prevention:** Tiered verification (light/standard/deep), test execution once per phase not per plan, verification budget <10% of total phase tokens.

4. **Integration tests coupling to implementation** — Snapshot fragility, git-dependent non-determinism, multi-step cascade failures, temp directory explosion. **Prevention:** Assert specific behavioral fields not full JSON, mock git with deterministic fixtures, use `test/fixtures/` directory, limit to 5-10 tests per feature area.

5. **Atomic decomposition too rigid or too loose** — Hard file-count limits create bureaucratic overhead; loose rules allow bundled plans. **Prevention:** Context-budget threshold (>60% of context window = must split), heuristic scoring not hard rules, existing plans must pass without changes.
<!-- /section -->

<!-- section: roadmap_implications -->
## Implications for Roadmap

Based on research, suggested 4-phase structure (continuing from v1.1's Phase 9):

### Phase 10: State Intelligence
**Rationale:** Foundation for everything. State validation MUST come first because every subsequent feature benefits from knowing if STATE.md is accurate. Memory should persist validated state. Verification should detect drift. Integration tests need validation to be testable. All LOW complexity items that deliver immediate trust improvement.
**Delivers:** `lib/validation.js`, `state validate` command, validation_warnings in init outputs, stale activity detection, position validation, phase completion drift detection.
**Addresses:** Phase completion drift detection, current position validation, stale activity detection, pre-execution state validation (all from FEATURES.md Category 1).
**Avoids:** Pitfall 1 (false positives) — advisory-only mode first, enumerate all valid state transitions before coding. Pitfall 7 (circular deps) — STATE.md is always authoritative.
**Estimated effort:** 2-3 plans

### Phase 11: Session Continuity
**Rationale:** Cross-session memory is the #1 user pain point (claude-mem 30K+ stars, OpenCode issue #8043). Builds on Phase 10's validated state — only persist validated state. The dual-store pattern (STATE.md + memory.json) is the key architectural decision.
**Delivers:** `lib/memory.js`, `commands/memory.js`, 5 memory CLI commands (load/add/query/prune/digest), memory_digest in init outputs, session position bookmarks, decision persistence improvements.
**Uses:** lib/validation.js (from Phase 10) for ensuring persisted state is valid.
**Implements:** Dual-store architecture (STATE.md authoritative + memory.json advisory), atomic JSON persistence, token-budgeted digest.
**Avoids:** Pitfall 2 (memory bloat) — 500-token budget, 3-category TTL. Pitfall 7 (circular deps) — load STATE.md first, memory second, reconcile.
**Estimated effort:** 2-3 plans

### Phase 12: Quality Gates
**Rationale:** Both comprehensive verification and atomic decomposition are verification concerns — they answer "was the work done correctly?" and "is the plan structured correctly?" Grouping them avoids creating two separate verification phases. Verification depends on validated state (Phase 10) and memory baselines (Phase 11).
**Delivers:** Test execution gating (wire test-run into verify workflow), requirement delivery verification, regression detection with baseline storage, plan complexity analysis, plan atomicity scoring, `verify deliverables` combined verdict.
**Addresses:** All FEATURES.md Category 2 (atomic plans) and Category 4 (verification) table stakes and differentiators.
**Avoids:** Pitfall 3 (decomposition too rigid) — heuristics not rules, context-budget threshold. Pitfall 4 (verification overhead) — light/standard/deep tiers, tests per-phase not per-plan. Pitfall 10 (inflated directory structure) — prefer tasks-within-plans over separate plans.
**Estimated effort:** 3-4 plans

### Phase 13: Test Infrastructure & Polish
**Rationale:** Integration tests exercise the assembled system — all features must exist first. Dependency optimization is research/analysis that may produce zero code changes. Both are low-risk final-phase activities. Integration tests lock in the v2.0 contract.
**Delivers:** `bin/gsd-integration.test.cjs` with workflow chain tests, state drift tests, memory persistence tests, verification pipeline tests; esbuild metafile analysis; bundle size tracking; token budget per workflow.
**Addresses:** All FEATURES.md Category 5 (integration tests) and Category 6 (optimization).
**Avoids:** Pitfall 5 (tests coupled to implementation) — behavioral assertions, git mock, shared fixtures. Pitfall 6 (bundle bloat) — 300KB budget, pre-check protocol. Pitfall 12 (test file bigger than source) — shared fixture library.
**Estimated effort:** 2-3 plans

### Phase Ordering Rationale

- **State validation first** (Phase 10): Dependencies flow FROM validation TO everything else. Memory should only persist validated state. Verification needs drift detection as its foundation. Integration tests need validation to be testable.
- **Memory before verification** (Phase 11 before 12): Verification stores baselines (test results, requirement mappings) that benefit from the persistence infrastructure memory establishes. Memory's `lib/memory.js` atomic write pattern is reused by baseline storage in `commands/features.js`.
- **Verification and decomposition together** (Phase 12): Both are "quality gate" concerns. Plan atomicity is a form of pre-execution verification. Grouping avoids verification code being split across phases.
- **Integration tests last** (Phase 13): End-to-end tests validate the assembled system. Writing them before features exist means constant test updates as features ship. Writing them after = one pass, stable tests.
- **Total projected growth:** 16→19 modules, 8,208→~10,250 LOC, 202→~280 tests, 0→~40 integration tests, ~79→~90 commands.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 11 (Session Continuity):** Memory compaction algorithm needs prototyping — how to deterministically compress 100+ decisions into 500 tokens while preserving the most decision-relevant entries. The 3-category TTL system needs validation with real session data.
- **Phase 12 (Quality Gates):** Regression detection baseline format needs design — what test result data to persist, how to compare across runs, how to handle test additions/removals between baselines. Plan atomicity heuristics need calibration against real v1.0/v1.1 plans.

Phases with standard patterns (skip research-phase):
- **Phase 10 (State Intelligence):** Well-documented drift detection pattern from IaC tools (Terraform plan, driftctl). State machine enumeration is straightforward codebase analysis. All LOW complexity.
- **Phase 13 (Test Infrastructure):** Integration test patterns fully documented in ARCHITECTURE.md. Fixture-based testing is a well-understood approach. No design decisions needed — just implementation.
<!-- /section -->

<!-- section: confidence -->
## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Every alternative measured with actual esbuild bundling. Hand-written validators verified at 500 bytes vs AJV 238KB. JSON persistence verified atomic on POSIX. node:test capabilities enumerated for Node 18+. |
| Features | HIGH | 6 categories with table stakes/differentiators/anti-features. Dependency graph validated. Effort estimates grounded in existing module sizes and patterns. MVP priority ranking clear. |
| Architecture | HIGH | Based on direct analysis of all 16 source modules (8,208 LOC). Module integration map specifies exact functions, line counts, and data flow changes. Strict invariants documented and preserved. |
| Pitfalls | HIGH | 13 pitfalls grounded in codebase specifics (309+ regex, 43 workflows, 12 init commands) and industry sources (Manus context engineering, Anthropic evals, Codepipes testing anti-patterns). Each has prevention strategy, warning signs, and recovery steps. |

**Overall confidence:** HIGH

### Gaps to Address

- **Memory compaction algorithm unvalidated:** The 500-token budget and 3-category TTL system are theoretically sound but haven't been tested with real multi-session data. The compaction algorithm (group decisions by topic, count occurrences, keep most recent + highest impact) needs prototyping during Phase 11 planning.
- **Integration test fixture design needs prototyping:** The shared fixture approach (`test/fixtures/basic-project/`) needs a canonical `.planning/` structure design. What constitutes a "basic project," "project with drift," "mid-execution project," etc. should be defined before writing tests.
- **Plan atomicity heuristic calibration:** The context-budget threshold (>60% context window = must split) and file-group overlap detection need testing against actual v1.0/v1.1 PLAN.md files to verify they don't produce false positives on working plans.
- **Verification tier boundaries undefined:** The light/standard/deep verification tiers need concrete criteria: what plan size triggers standard? What phase characteristics trigger deep? These should be config-driven (`CONFIG_SCHEMA` entries) but the default values need data.
- **Node 18 mock limitations:** node:test `mock.fn()` exists in Node 18 but `mock.method()` was added later. Integration tests must be verified to work on Node 18.0.0 specifically, not just "18+."
<!-- /section -->

<!-- section: sources -->
## Sources

### Primary (HIGH confidence)
- Context7 `/nodejs/node` — Node.js test runner API, mocking, coverage capabilities
- Context7 `/evanw/esbuild` — Bundling behavior, native addon handling, metafile analysis
- Context7 `/wiselibs/better-sqlite3` — Why native addons can't bundle (eliminates SQLite option)
- Context7 `/ajv-validator/ajv` — Standalone code generation, actual bundle sizes (238KB measured)
- Node.js v25.6.1 docs — test runner features, fs atomicity, crypto hashing
- npm package measurements — Actual esbuild bundle sizes measured locally (AJV 238KB, Zod 150KB, tokenx 4.5KB)
- Direct codebase analysis — 16 modules (8,208 LOC), 202 tests (4,591 LOC), 43 workflows, 309+ regex patterns
- Anthropic Engineering, "Demystifying Evals for AI Agents" (Jan 2026) — Verification methodology, regression eval patterns
- claude-mem (thedotmack, 30K+ stars, v10.3.1) — Proves cross-session memory demand, validates design patterns

### Secondary (MEDIUM confidence)
- Snyk driftctl — Infrastructure drift detection pattern (compare declared vs actual state)
- Cognizant MAKER (2026) — Atomic decomposition pattern ("focused microagents, each responsible for one atomic action")
- Manus context engineering (Philschmid, Dec 2025) — Context Rot, Context Pollution, todo.md bloat (~30% token waste)
- Codepipes testing anti-patterns (2018/2026) — Snapshot fragility, flaky tests destroying suite credibility
- OpenCode Issue #8043 — Feature request for model-agnostic memory layer (assigned to core maintainer)
- Inkeep context rot analysis (Oct 2025) — "Every unnecessary token actively degrades performance"
- MGX.dev cross-session agent memory (2025) — Priority scoring and contextual tagging patterns

### Tertiary (LOW confidence)
- Bundlephobia — Bundle size cross-reference (rendering issues during research)
- ryoppippi CLI stack (2025) — esbuild tree-shaking limitations observation
- Sphere Inc memory vs context (2025) — "2025 was the year of retention without understanding"
- OneUptime task decomposition (Jan 2026) — Practical decomposition guide

---
*Research completed: 2026-02-22*
*Supersedes: v1.1 research summary (context reduction & tech debt)*
*Ready for roadmap: yes*
