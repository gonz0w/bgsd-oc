# Project Research Summary

**Project:** bGSD v7.0 — Agent Orchestration & Efficiency
**Domain:** CLI agent orchestration, context optimization, git intelligence
**Researched:** 2026-02-26
**Confidence:** HIGH

<!-- section: compact -->
<compact_summary>

**Summary:** bGSD v7.0 adds intelligent agent orchestration (task routing, context budgeting, role-scoped data) and context efficiency (AST-based repo maps, compact serialization) to the existing CLI planning plugin. The recommended approach is conservative: one new dependency (acorn ~121KB), four new modules (~850 lines total), enhanced git.js, and intelligence-as-data instead of new agent roles. The #1 risk is output format regression breaking all 11 agent consumers silently — contract tests must come first.

**Recommended stack:** acorn + acorn-walk (AST extraction, ~121KB), node:perf_hooks (profiling, 0KB), enhanced execGit (git intelligence, 0KB), custom orchestrator/serializer/profiler modules (~33-50KB)

**Architecture:** Hybrid CLI-data + workflow-coordination pattern: 4 new modules (ast-intel, orchestrator, serializer, profiler) feeding data to existing agent roles through enhanced CLI commands. No new agent roles — intelligence is data, not agents.

**Top pitfalls:**
1. Output format regression — add consumer contract tests BEFORE any output changes (Phase 1)
2. Context reduction info loss — measure agent quality before/after, not just token count (Phase 3-4)
3. Agent role explosion — cap at 11 roles, new intelligence = CLI data for existing agents (all phases)
4. Self-referential corruption — pin tool version during milestone, use canary project (all phases)
5. Git automation surprise — every write operation is gated, preview-first (Phase 2)

**Suggested phases:**
1. Foundation & Contracts — contract tests, profiler, enhanced git.js (safety net first)
2. AST Intelligence — acorn integration, signature extraction, repo map generation (enables everything)
3. Orchestration Intelligence — task classification, agent routing, context budgeting (core value)
4. Context Efficiency — compact serialization, agent context scoping, conversation compaction (token savings)
5. Agent Quality — code review agent, writer/reviewer separation, commit attribution (quality gates)
6. Integration & Validation — execution wave optimization, performance validation, canary testing (ship it)

**Confidence:** HIGH | **Gaps:** Exact token savings from compact serialization (estimated 40-60%, needs measurement), orchestration routing heuristics (need iterative refinement)
</compact_summary>
<!-- /section -->

<!-- section: executive_summary -->
## Executive Summary

bGSD v7.0 is a self-improvement milestone for a CLI-based AI planning plugin that orchestrates LLM agent workflows. The core challenge is well-understood: agents need the *right* context (not all context), tasks need intelligent routing (not manual agent selection), and the system needs performance observability. Research across competitive tools (Claude Code Agent Teams, Aider, Cursor, OpenHands) confirms bGSD's existing architecture — hierarchical agent roles communicating through files, not messages — is the correct topology. Cursor's failed experiment with equal-status agents and Gas Town's production DB incident both validate bGSD's human-in-the-loop approach. The innovation gap is in context efficiency (Aider's repo map pattern) and automatic orchestration (no CLI planning tool does this well).

The recommended approach is surgical: add one external dependency (acorn + acorn-walk, ~121KB for AST parsing), build four new modules (orchestrator ~300 lines, ast-intel ~300 lines, serializer ~200 lines, profiler ~250 lines), and enhance existing git.js with structured operations. The critical architectural principle is "intelligence as data, not as agents" — new capabilities are CLI commands that produce richer data for existing agent roles, not new agent roles. This avoids the agent role explosion anti-pattern identified by DeepMind (coordination overhead grows quadratically, 17x error amplification in unstructured networks). The bundle stays within budget (~850-870KB of 1000KB).

The primary risks are output format regression (silent breaks across 11 agent consumers), context reduction that degrades agent quality (easy to measure tokens, hard to measure decision quality), and self-referential corruption (using in-development bGSD to manage its own development). Mitigation is straightforward: contract tests before any output changes (Phase 1), quality baselines before any context reduction (Phase 3-4), and version pinning throughout. The competitive landscape confirms this milestone's features are table stakes (task routing, code review agent, repo map) and differentiators (automatic orchestration mode, execution wave optimization, compact serialization).
<!-- /section -->

<!-- section: key_findings -->
## Key Findings

### Recommended Stack

The stack strategy is maximally conservative: one new npm dependency, everything else built on Node.js builtins and custom code. This preserves the zero-server, single-file, synchronous architecture validated through 574 tests and 5+ milestones.

**Core technologies:**
- **acorn + acorn-walk** (~121KB bundled): JS/TS AST parsing for function signature extraction, export surface analysis, complexity metrics. Same parser esbuild uses internally. Zero dependencies. Enables repo map generation (60-80% context reduction for code files).
- **node:perf_hooks** (0KB, built-in): Opt-in performance profiling via `GSD_PROFILE=1`. Wraps `performance.mark()`/`performance.measure()`. Zero cost when disabled. Instruments CLI startup, git calls, file reads, token estimation.
- **Enhanced git.js** (0KB new deps): Structured git log, diff summary, blame, branch info — all built on existing `execGit()` wrapper. Rejected simple-git (async-only, 4+ deps, 80-120KB). Rejected isomorphic-git (500KB+).
- **Custom orchestrator** (~15-25KB): Task classification, agent role selection, context budget allocation. A context router, not a job scheduler. Rejected Temporal (requires server), bull/bullmq (requires Redis), LangChain (wrong abstraction — bGSD produces prompts, doesn't call LLM APIs).
- **Custom serializer** (~5-10KB): Chrome DevTools-inspired compact format with one-time schema description. Estimated 40-60% overall context reduction.

**Bundle projection:** ~850-870KB (from current 681KB), leaving ~130-150KB headroom within 1000KB budget.

**What NOT to add:** No LLM SDKs (bGSD produces prompts, doesn't call APIs), no database (JSON + git history suffices), no web framework (CLI tool, not a service), no schema validation library (existing regex + custom works), no CLI framework (machine-consumed tool doesn't need yargs), no TypeScript (not worth 18-module migration cost this milestone).

### Expected Features

**Must have (table stakes):**
- **Task complexity estimation** — Foundation for all routing. Score tasks 1-5 based on file count, cross-module reach, test requirements. Every competitor classifies tasks before routing.
- **Smart agent/model routing** — Auto-select agent type + model tier based on task classification. Aider's architect mode, Claude Code's model selection, ClaudeFast's 5-tier complexity all do this.
- **Code review agent (gsd-reviewer)** — Writer/reviewer separation prevents confirmation bias. CodeRabbit, Qodo PR-Agent prove this is baseline for serious tooling.
- **Repository map generation** — Aider's proven pattern: AST → signatures → ranking → token budget. ~1k tokens instead of full file contents. Now industry standard.
- **Agent context scoping** — Each agent type declares required context. System provides only that at spawn. Partially built via `<files_to_read>` blocks; needs formalization.
- **Compact serialization format** — Dense CLI output for agent consumption. One-time schema, dense data. Immediate token savings across all existing commands.

**Should have (differentiators):**
- **Automatic orchestration mode selection** — No CLI tool auto-selects between single/parallel/team mode based on plan structure.
- **Execution wave optimization** — Parallel subagent execution for independent plan waves. Extends existing wave grouping.
- **Agent performance tracking** — Per-agent success/failure rates fed back into routing decisions.
- **Commit attribution** — Tag commits with agent type in metadata. LOW effort, HIGH observability.
- **Conversation compaction** — Hook into Claude API `compact-2026-01-12` for long-running sessions.
- **Task-scoped file injection** — Load only task-relevant files using dependency graph. Major context savings on large codebases.

**Defer (v2+):**
- Security scanning agent (use snyk/semgrep instead), dependency management agent (use dependabot/renovate), refactoring agent, documentation agent, full PR automation (dangerous without human gate), merge intelligence, incremental context loading, stacked PR workflow, autonomous agent teams.

### Architecture Approach

The architecture is a hybrid: analytical intelligence lives in CLI modules (testable, measurable, cacheable), coordination logic lives in workflow markdown (readable, auditable, agent-consumed). Four new modules slot into the existing dependency graph with strict downward-only dependencies. The orchestrator is the top-level coordinator — it consumes data from ast-intel, context, and codebase-intel, then produces structured output that workflows pass to existing agents.

**Major components:**
1. **ast-intel.js** (~300 lines) — Acorn-based JS/TS parsing. Extracts function signatures, exports, class shapes, complexity metrics. Detector registry pattern (like conventions.js) for multi-language support. Invocation-scoped cache. Non-JS languages fall back to regex extractors.
2. **orchestrator.js** (~300 lines) — Task classification → agent role assignment → context budget allocation → output assembly. Specific functions per role (`assembleExecutorContext()`, `assemblePlannerContext()`), not generic workflow engine. Consumes all other new modules.
3. **serializer.js** (~200 lines) — Compact format converters: plan state (~70-80% reduction), dependency graphs (~50-60% reduction), code summaries (~60-80% reduction). Chrome DevTools dense-format-with-description pattern.
4. **profiler.js** (~250 lines) — `node:perf_hooks` wrapper. Opt-in via `GSD_PROFILE=1`. Wraps git calls, file reads, regex parsing, token estimation. Outputs to `.planning/baselines/profile-{timestamp}.json`. Standalone module — imports nothing from project.
5. **git.js** (enhanced to ~200 lines) — Structured log, diff summary, blame, branch info, conventional commit parsing. All through existing `execGit()`. No async, no new deps.

**Key patterns to follow:**
- Detector Registry (existing: conventions.js, lifecycle.js — extend for AST extractors)
- Lazy Loading (existing: router.js — all new modules must use `lazy*()` pattern)
- Invocation-Scoped Caching (existing: helpers.js — AST results cached per CLI invocation)
- Opt-In Instrumentation (new: zero-cost profiling when GSD_PROFILE not set)
- Compact Format with Schema (new: dense data with one-time format description)
- Intelligence as Data, Not Agents (architectural principle: new CLI commands, not new agent roles)

### Critical Pitfalls

1. **Output Format Regression** — Every `outputJSON()` call is an API contract consumed by 11 agents. A renamed field passes unit tests but silently breaks all workflows. **Prevention:** Consumer contract tests (snapshot-based) before ANY output changes. This must be Phase 1. **Recovery:** Add backward-compat alias emitting both old and new field names (~2 hours).

2. **Context Reduction Information Loss** — Token count is easy to measure, agent decision quality is not. Reducing context "improves" metrics while degrading agent output (generic commit messages, dropped requirements, missed architectural decisions). **Prevention:** Establish quality baselines before reduction. A/B test every compaction change. Never remove fields from JSON. **Recovery:** Revert reduction, establish baseline, re-apply incrementally (~1 day).

3. **Agent Role Explosion** — The temptation to create `gsd-git-analyst`, `gsd-context-optimizer`, `gsd-task-router` fragments the system. Research shows diminishing returns past ~4 active agents, coordination overhead grows quadratically (DeepMind), 17x error amplification in unstructured networks. **Prevention:** Hard cap at current 11 roles. New intelligence = CLI data consumed by existing agents. Only justified new role: gsd-reviewer (writer/reviewer separation is an industry-standard split).

4. **Self-Referential Corruption** — bGSD improving itself means bugs in Phase N affect planning of Phase N+1. v6.0 had exactly this: `--raw` removal caused 243 test failures caught by tests, but if tests had been affected, bug would have propagated silently. **Prevention:** Pin tool version at milestone start, test against current project, separate dev/deploy via `deploy.sh`.

5. **Git Automation Surprise** — "Smart" git features conflict with developer's actual git state (dirty tree, rebase in progress, detached HEAD, shallow clones). **Prevention:** Every git-write operation is preview-first and gated. Read operations always safe. Test with pathological git states. **Recovery:** `git reflog` to find pre-automation state (minutes if reflog intact).
<!-- /section -->

<!-- section: roadmap_implications -->
## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation & Safety Net
**Rationale:** Pitfall #1 (output format regression) is the highest risk and must be addressed before any feature work touches output. Profiler provides measurement infrastructure for all subsequent phases. Enhanced git.js is a dependency for orchestration.
**Delivers:** Consumer contract test suite (snapshot tests for all `init` and `state` JSON output), profiler module with `GSD_PROFILE=1` instrumentation, enhanced git.js (structured log, diff summary, blame, branch info).
**Features from FEATURES.md:** Pre-commit dirty file handling (LOW effort, safety), commit attribution (LOW effort, observability).
**Avoids:** Pitfall #1 (regression) by establishing contract tests first. Pitfall #5 (git automation) by establishing safety protocol and testing with pathological git states.

### Phase 2: AST Intelligence & Repo Map
**Rationale:** Repository map generation is the highest-impact feature (60-80% code context reduction) and a dependency for both context efficiency and task-scoped file injection. acorn is the only new npm dependency — get it integrated, bundled, and tested early to remove highest-uncertainty technical risk.
**Delivers:** ast-intel.js module with acorn integration, function signature extraction, export surface analysis, complexity metrics. Repo map generation (~1k token compact codebase summary). Detector registry for multi-language support (regex fallback for non-JS).
**Uses from STACK.md:** acorn ^8.16.0, acorn-walk ^8.3.5 (~121KB total).
**Implements:** Detector Registry pattern, Invocation-Scoped Caching pattern.
**Avoids:** Anti-Pattern 2 (over-parsing) — incremental parsing with file change detection, 50-file cap per invocation.

### Phase 3: Orchestration Intelligence
**Rationale:** Task classification and agent routing are the core value proposition of v7.0. Depends on ast-intel (for complexity metrics) and enhanced git (for change context). This is where bGSD differentiates from every competitor.
**Delivers:** orchestrator.js module — task classification (type, complexity 1-5, scope, affected modules), agent role selection, context budget allocation per role. Enhanced `init` commands with routing data. Agent context manifests declaring what each role needs.
**Features from FEATURES.md:** Task complexity estimation (P1), smart agent/model routing (P1), agent context scoping (P1).
**Avoids:** Pitfall #3 (role explosion) — intelligence as data for existing agents, not new roles. Anti-Pattern 3 (generic orchestration) — specific `assembleXContext()` functions, not a generic workflow engine. Anti-Pattern 5 (config-driven everything) — opinionated defaults, minimal override surface.

### Phase 4: Context Efficiency
**Rationale:** Compact serialization and context scoping depend on having the orchestrator (which defines role budgets) and ast-intel (which produces summaries). Token savings compound across all subsequent workflow executions. Must include quality measurement infrastructure BEFORE implementing reductions.
**Delivers:** serializer.js module — compact plan state (~70-80% reduction), dependency graph compression (~50-60% reduction), code summary format (~60-80% reduction). Context budget enforcement per agent role with automatic truncation. Conversation compaction integration via Claude API `compact-2026-01-12`.
**Features from FEATURES.md:** Compact serialization format (P1), conversation compaction (P1), context budget tracking enhancement.
**Avoids:** Pitfall #2 (context reduction info loss) — establish quality baselines using Phase 1 profiler BEFORE any reduction, A/B test every compaction change against agent output quality.

### Phase 5: Agent Quality Gates
**Rationale:** Code review agent and writer/reviewer separation require the orchestration layer (Phase 3) to route review tasks and the context scoping (Phase 4) to provide focused review context. This phase fills the quality gap that every serious competitor has already addressed.
**Delivers:** gsd-reviewer agent definition (code review against CONVENTIONS.md), writer/reviewer separation workflow update, enhanced verification pipeline with post-execution review step.
**Features from FEATURES.md:** Code review agent (P1), writer/reviewer separation (table stakes).
**Avoids:** Pitfall #3 (role explosion) — gsd-reviewer is the ONE justified new role (writer vs. reviewer is an industry-standard separation validated by Anthropic, CodeRabbit, Qodo). No other new agent roles.

### Phase 6: Integration, Waves & Validation
**Rationale:** Execution wave optimization is the highest-complexity differentiator and depends on all previous phases (orchestrator for routing, context scoping for parallel agents, git intelligence for worktree coordination). Final phase validates everything works together end-to-end.
**Delivers:** Execution wave optimization (parallel subagent execution for independent plan waves, capped at 3-5 agents), end-to-end performance validation against Phase 1 baselines, agent performance tracking foundation for feedback loop.
**Features from FEATURES.md:** Execution wave optimization (P2), agent performance tracking (P2).
**Avoids:** Pitfall #4 (self-referential corruption) — full canary validation and version comparison before milestone ship. Dynamic agent spawning anti-pattern (pre-planned parallelism, not self-spawning agents — Cursor's lesson).

### Phase Ordering Rationale

- **Safety before features:** Phase 1 establishes the test safety net and measurement infrastructure that all subsequent phases depend on. Research identified output regression as the #1 risk — this cannot be deferred.
- **Dependencies flow downward:** AST (Phase 2) → Orchestration (Phase 3) → Serialization (Phase 4) → Quality (Phase 5) → Integration (Phase 6). Each phase produces infrastructure consumed by the next.
- **Biggest external dependency first:** acorn is the only new npm dependency. Getting it integrated, bundled, and tested in Phase 2 removes the highest-uncertainty technical risk early.
- **Avoid the "reads everything to decide what to include" trap:** Building AST extraction (Phase 2) before orchestration (Phase 3) ensures the orchestrator routes based on file metadata and signatures rather than reading full file contents.
- **Measurement before reduction:** Profiler in Phase 1, baselines established, THEN context reduction in Phase 4. Prevents Pitfall #2 (measuring tokens instead of quality).
- **Quality gates before parallel execution:** Writer/reviewer separation (Phase 5) before execution waves (Phase 6) ensures parallel agents produce verified output.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Orchestration):** Task classification heuristics need iterative refinement. How to score complexity (file count vs. cross-module reach vs. API surface) is empirical. Routing accuracy thresholds need experimentation. MEDIUM confidence on initial heuristics.
- **Phase 4 (Context Efficiency):** Exact token savings are estimated (40-60%), not measured against bGSD's specific output shapes. Compact format LLM compatibility needs testing — pipe-delimited format must not cause Claude parsing confusion. Need A/B testing with actual agent tasks.
- **Phase 6 (Execution Waves):** Parallel subagent coordination at scale is highest-complexity work. Cursor's 20-agent failure is instructive but bGSD's hierarchical model is different. Conservative agent cap (3-5) needs validation.

Phases with standard patterns (skip deep research):
- **Phase 1 (Foundation):** Contract testing and profiling are well-established patterns. Enhanced git.js extends a proven 29-line module with standard git CLI output parsing.
- **Phase 2 (AST Intelligence):** acorn is the most widely used JS parser (webpack, eslint/espree). API is well-documented. Aider's repo map pattern is documented and production-proven.
- **Phase 5 (Agent Quality):** Writer/reviewer separation is an industry-standard pattern documented by Anthropic, validated by CodeRabbit and Qodo with 15+ specialized review agents.
<!-- /section -->

<!-- section: confidence -->
## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | acorn verified via npm/bundlephobia (v8.16.0, 114KB, 0 deps). perf_hooks stable since Node 8.5.0. simple-git rejection validated via Context7 + npm registry. Bundle projection verified. |
| Features | HIGH | Primary sources: Claude Code Agent Teams docs, Aider docs, Cursor blog, OpenHands paper, GitHub multi-agent engineering blog. 6+ competitors cross-referenced. |
| Architecture | HIGH | Direct inspection of all 18 existing modules. Patterns extend proven existing patterns (detector registry, lazy loading, invocation cache). Dependency direction validated — no cycles. |
| Pitfalls | HIGH | DeepMind scaling research, real failure cases (Gas Town DB down 2 days, Cursor equal-status agents, 67% AI PR rejection rate), bGSD v6.0's own --raw removal incident (243 failures). |

**Overall confidence:** HIGH

### Gaps to Address

- **Token savings precision:** 40-60% overall reduction is estimated from Chrome DevTools patterns and TU Wien research, not measured against bGSD's specific data structures. **Handle:** Build measurement infrastructure in Phase 1, empirically validate in Phase 4.
- **Orchestration routing accuracy:** Task classification heuristics (complexity scoring, agent selection thresholds) need iterative refinement. Research provides the framework but not tuned values. **Handle:** Make thresholds configurable in Phase 3, adjust based on real usage data.
- **TypeScript AST coverage:** acorn parses JS. TS-specific patterns (decorators, type annotations) may need acorn-typescript plugin or regex fallback. **Handle:** Assess in Phase 2 planning — current bGSD codebase is JS, so JS coverage is sufficient for self-hosting. Multi-language is an extension point.
- **Conversation compaction API stability:** Claude API `compact-2026-01-12` is documented as beta. **Handle:** Abstract behind a thin wrapper in Phase 4 serializer. If API changes, only wrapper needs update.
- **Execution wave parallelism limits:** Worktree-based parallel execution at >3 agents is not well-tested in the ecosystem. **Handle:** Cap at 3-5 parallel agents in Phase 6, validate with real tasks before increasing.
<!-- /section -->

<!-- section: sources -->
## Sources

### Primary (HIGH confidence)
- **acorn:** npm registry (v8.16.0 verified 2026-02-26), bundlephobia API (114KB bundled, 0 deps confirmed)
- **acorn-walk:** npm registry (v8.3.5), bundlephobia API (7KB bundled)
- **Node.js perf_hooks:** Official docs (v25.7.0, API stable since v8.5.0)
- **Claude Code Agent Teams:** https://code.claude.com/docs/en/agent-teams
- **Claude API Compaction:** https://platform.claude.com/docs/en/build-with-claude/compaction
- **Aider repo map:** https://aider.chat/docs/repomap.html
- **Aider git integration:** https://aider.chat/docs/git.html
- **Cursor scaling agents blog:** https://cursor.com/blog/scaling-agents
- **OpenHands architecture:** https://arxiv.org/html/2511.03690v1
- **GitHub multi-agent engineering:** https://github.blog/ai-and-ml/generative-ai/multi-agent-workflows-often-fail-heres-how-to-engineer-ones-that-dont/
- **DeepMind scaling agent systems:** https://arxiv.org/pdf/2512.08296
- **Chrome DevTools AI assistance:** Blog post 2026-01-30 (compact serialization pattern)
- **bGSD codebase:** Direct inspection of all 18 src/ modules, 574 tests, 11 agent definitions, 44 workflow files

### Secondary (MEDIUM confidence)
- **Mike Mason synthesis:** https://mikemason.ca/writing/ai-coding-agents-jan-2026/ (cross-references primary sources)
- **TU Wien diploma thesis:** "Reducing Token Usage of Software Engineering Agents" (2025) — function signatures vs full files approach
- **Context Rot research (Chroma):** https://research.trychroma.com/context-rot — performance degradation with context length
- **LLM Context Management (16x Engineer):** https://eval.16x.engineer/blog/llm-context-management-guide — 11/12 models <50% accuracy at 32k tokens
- **Augment Code:** https://www.augmentcode.com/guides/why-multi-agent-llm-systems-fail-and-how-to-fix-them — 41-86.7% failure rates
- **Qodo/CodeRabbit:** https://www.qodo.ai/, https://www.coderabbit.ai/ (vendor sites)
- **Steve Yegge Gas Town/Beads:** Medium posts via Mason article
- **simple-git:** Context7 /steveukx/git-js (API verification, async-only confirmed)
- **tree-sitter:** npm registry (v0.25.0, native binding deps confirmed — disqualified)

### Tertiary (LOW confidence)
- Token savings estimates (40-60%) — extrapolated from Chrome DevTools pattern to bGSD's specific data structures, needs empirical validation
- Execution wave parallelism cap (3-5 agents) — inferred from Cursor's 20-agent failure, bGSD's hierarchical model may handle differently
- ClaudeFast agent guide (community site, not official docs)

---
*Research completed: 2026-02-26*
*Ready for roadmap: yes*
