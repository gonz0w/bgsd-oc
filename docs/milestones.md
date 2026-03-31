# Version History

Complete history of every bGSD milestone, what was delivered, and the metrics.

---

## Summary

| Version | Name | Phases | Plans | Timeline | Tests | Bundle |
|---------|------|--------|-------|----------|-------|--------|
| v1.0 | Performance & Quality | 5 | 14 | 2 days | 153 | — |
| v1.1 | Context Reduction & Tech Debt | 4 | 10 | 1 day | — | — |
| v2.0 | Quality & Intelligence | 4 | 13 | 3 days | 297 | 373KB |
| v3.0 | Intent Engineering | 4 | 10 | 1 day | 348 | 447KB |
| v4.0 | Environment & Execution Intelligence | 5 | 13 | 1 day | 502 | 549KB |
| v5.0 | Codebase Intelligence | 7 | 14 | 2 days | 572 | 672KB |
| v6.0 | UX & Developer Experience | 7 | 11 | 1 day | 574 | 681KB |
| v7.0 | Agent Orchestration & Efficiency | 8 | 15 | 2 days | 762 | 1000KB |
| v7.1 | Trajectory Engineering | 6 | 10 | 1 day | 762 | 1050KB |
| v8.0 | Performance & Architecture | 5 | ~10 | 3 days | 762 | 1058KB |
| v9.2 | CLI Tool Integrations & Runtime Modernization | 4 | ~10 | 2 days | 762 | 1100KB |
| v9.3 | Quality, Performance & Agent Sharpening | 5 | ~12 | 3 days | 762 | 1150KB |
| v10.0 | Agent Intelligence & UX | 7 | ~12 | 1 day | 762 | — |
| v11.0 | Natural Interface & Insights | 5 | ~9 | 1 day | — | — |
| v11.1 | Command Execution & Polish | 3 | ~7 | 1 day | — | — |
| v11.2 | Code Cleanup | 4 | ~8 | 1 day | — | — |
| v11.3 | LLM Offloading | 4 | 9 | 1 day | — | — |
| v12.0 | SQLite-First Data Layer | 6 | 16 | 2 days | 1008 | — |
| v12.1 | Tool Integration & Agent Enhancement | 5 | 13 | 1 day | 1398 | — |
| v13.0 | Closed-Loop Agent Evolution | 5 | 12 | 1 day | 1504 | — |
| **Total** | | **107** | **~242** | **~25 days** | | |

---

## v7.0 Agent Orchestration & Efficiency

**Shipped:** 2026-02-27 | **Phases:** 37-44 | **Plans:** 15

**Goal:** Make bGSD the definitive agent orchestrator for building large software — add missing agent roles, improve orchestration intelligence, optimize performance, and reduce context load.

**What was delivered:**

### Foundation & Safety (Phases 37-38)
- **Contract test suite** — Snapshot-based consumer contract tests for all `init` and `state` JSON output, catching field renames before they break agents
- **Enhanced git.js** — Structured log, diff summary, blame, branch info, pre-commit safety checks (dirty tree, rebase in progress, detached HEAD, shallow clones)
- **AST intelligence** — Acorn-based JS/TS parser for function signature extraction, export surface analysis, per-function complexity metrics
- **Repository map** — ~1k token compact codebase summary from AST signatures, replacing full file content in agent context
- **Multi-language fallback** — Regex-based signature extraction for non-JS languages via detector registry pattern

### Intelligence (Phases 39-40)
- **Task complexity classifier** — Scores tasks 1-5 based on file count, cross-module reach, and test requirements
- **Automatic agent routing** — Auto-selects agent type and model tier from task classification
- **Execution mode selector** — Auto-selects single/parallel/team mode from plan structure
- **Agent context manifests** — Each agent declares required context; system provides only declared fields (40-60% token reduction)
- **Compact serialization** — Dense format for plan state (70-80% reduction) and dependency graphs (45-60% reduction)
- **Task-scoped file injection** — Loads only task-relevant files using dependency graph and relevance scoring

### Quality (Phases 41, 44)
- **gsd-reviewer agent** — Code review against project conventions with fresh context
- **Two-stage review** — First checks spec compliance (plan must_haves), then code quality (conventions)
- **Severity classification** — BLOCKER (prevents completion), WARNING (advisory), INFO (informational)
- **Commit attribution** — Git trailers (`Agent-Type: gsd-executor`) for agent tracking
- **Stuck/loop detection** — Identifies repeated failure patterns (>2 retries) and triggers recovery

### Execution (Phase 43)
- **TDD execution engine** — RED-GREEN-REFACTOR state machine with orchestrator-enforced gates
- **TDD commit discipline** — Git trailers (`GSD-Phase: red|green|refactor`) for audit trail
- **Auto test-after-edit** — Runs test suite after each file modification to catch errors early
- **Anti-pattern detection** — Blocks pre-test code in TDD, YAGNI violations, over-mocking

### Validation (Phase 42)
- **Canary cycle** — Full planning-execution-verification on test project
- **Token measurement** — Validated context reduction against v6.0 baselines
- **All tests passing** — 762 tests with zero regressions

**Requirements:** 29 total, all mapped to phases. See `.planning/REQUIREMENTS.md`.

---

## v7.1 Trajectory Engineering

**Shipped:** 2026-03-01 | **Phases:** 45-50 | **Plans:** 10
**Tests:** 762 | **Bundle:** 1050KB

**Goal:** Add trajectory engineering capabilities — named checkpoints with auto-metrics, selective code rewind, pivot/compare/choose lifecycle, and decision journaling for safe experimentation.

**What was delivered:**

### Foundation (Phase 45)
- **Trajectory store** — New memory store type (`trajectories`) with auto-generated 6-char hex IDs and collision detection
- **Checkpoint command** — `bgsd-tools execute:trajectory checkpoint <name>` creates named git branch at `trajectory/<scope>/<name>/attempt-N` with automatic metrics collection (test count, LOC delta, cyclomatic complexity)
- **Selective rewind** — `bgsd-tools util:git rewind --ref <ref>` reverts code to a checkpoint while protecting `.planning/` directory, root configs (package.json, tsconfig.json, etc.), and auto-stashes dirty working tree. Denylist approach for protected paths.
- **Trajectory branch creation** — `bgsd-tools util:git trajectory-branch --phase N --slug name` creates branches in `gsd/trajectory/` namespace

### Checkpoint & Metrics (Phase 46)
- **Snapshot metrics collection** — Fault-tolerant collection of test count, LOC delta, and cyclomatic complexity at checkpoint time. Partial metrics if any collector fails.
- **Branch ref-only creation** — Uses `git branch` (not checkout) to preserve working tree during checkpoint
- **Trajectory list command** — `bgsd-tools execute:trajectory list` with scope/name filtering, limit control, and dual-mode output (JSON for agents, formatted for humans). Sorted newest-first.
- **Dirty tree exclusion** — Excludes `.planning/` from dirty working tree checks for consecutive checkpoints

### Pivot (Phase 47)
- **Pivot command** — `bgsd-tools execute:trajectory pivot <checkpoint> --reason "..."` abandons the current approach with recorded reasoning
- **Selective checkout** — Rewinds source code to target checkpoint while preserving `.planning/` and root configs via `selectiveRewind`
- **Auto-archival** — Current HEAD is auto-checkpointed as an abandoned attempt with archived branch before rewinding
- **Auto-stash support** — `--stash` flag handles dirty working trees gracefully
- **Attempt targeting** — `--attempt N` for specific attempt, defaults to most recent
- **Formatted output** — TTY banner + table output showing pivoted state, rewound files, and archived branch

### Compare (Phase 48)
- **Compare command** — `bgsd-tools execute:trajectory compare <name>` shows side-by-side metrics across all non-abandoned attempts
- **Directional scoring** — Best/worst identification per metric (higher is better for tests_pass, lower for complexity and LOC)
- **Color-coded output** — Green for best values, red for worst values in TTY mode
- **Formatted tables** — Test results, LOC delta, and cyclomatic complexity per attempt with best/worst indicators

### Choose (Phase 49)
- **Choose command** — `bgsd-tools execute:trajectory choose <name> --attempt N` selects the winning attempt and finalizes the exploration
- **Merge with lineage** — Winning attempt merged via `git merge --no-ff` to preserve exploration history
- **Tag archival** — Non-chosen attempts archived as lightweight git tags (permanent reference)
- **Branch cleanup** — ALL trajectory working branches deleted (including winner, since code is now merged)
- **Journal recording** — `category: 'choose'` entry with `tags: ['choose', 'lifecycle-complete']` marking the exploration as complete
- **12 dedicated tests** — Full coverage of merge, tag archival, branch cleanup, journal integrity, and error handling

---

## v8.0 Performance & Architecture

**Shipped:** 2026-03-03 | **Phases:** 51-55 | **Plans:** ~10
**Tests:** 762 | **Bundle:** 1058KB

**Goal:** Optimize runtime performance with SQLite caching, consolidate agent system from 12 to 9, add namespace routing, profiler instrumentation, and release-readiness improvements.

**What was delivered:**

### Cache Foundation (Phases 51-52)
- **L1/L2 caching** — Two-layer cache via `node:sqlite` `DatabaseSync`: in-memory Map (L1) for instant hits, SQLite (L2) for persistent cache across CLI invocations. Zero dependencies — uses Node's built-in module.
- **Graceful Map fallback** — Falls back to Map-only on Node <22.5 with zero crashes and zero warnings.
- **Hot-path command wiring** — All hot-path commands (phase, verify, misc) use `cachedReadFile()` for `.planning/` file reads.
- **Cache warm with auto-discovery** — `cache warm` command with auto-discovery of `.planning/` files, `--no-cache` flag for test parity.
- **Explicit invalidation** — Cache invalidated on all CLI file writes for immediate consistency.

### Agent Consolidation (Phase 53)
- **RACI matrix** — Every lifecycle step has exactly one responsible agent. Agent audit command validates the matrix.
- **Agent merges** — Merged gsd-integration-checker into gsd-verifier, gsd-research-synthesizer into gsd-roadmapper (12→9 agents).
- **Token budgets** — All 9 agent manifests declare token budgets (80K for planning/execution, 60K for verification/research). Context builder warns on budget exceedance.

### Command Consolidation (Phase 54)
- **Namespace routing** — Commands organized into semantic namespaces (`init:`, `plan:`, `execute:`, `verify:`, `util:`) with colon syntax. Router supports both namespaced and flat command formats.
- **Auto changelog** — `bgsd-tools plan:milestone complete` auto-generates version docs from git log and STATE.md metrics.

### Profiler & Validation (Phase 55)
- **Profiler instrumentation** — `GSD_PROFILE=1` emits timing data for file reads, git operations, markdown parsing, and AST analysis.
- **Profiler compare** — `profiler compare` shows before/after timing deltas with color-coded regression highlighting.
- **Cache speedup validation** — `cache-speedup` command validates cache effectiveness with measurable timing data.

---

## v9.2 CLI Tool Integrations & Runtime Modernization

**Shipped:** 2026-03-10 | **Phases:** 82-85 | **Plans:** ~10
**Tests:** 762 | **Bundle:** ~1100KB

**Goal:** Add CLI tool integrations (ripgrep, fd, jq, yq, bat, gh) for enhanced search and productivity, explore Bun runtime, and improve shell execution safety.

**What was delivered:**

### CLI Tool Foundation (Phases 82-83)
- **Shell injection prevention** — All subprocess calls use `execFileSync` with array args to prevent shell injection vulnerabilities.
- **5-minute TTL cache** — Balances freshness with performance for tool availability detection.
- **ripgrep integration** — Uses `ripgrep --json` for structured output parsing.
- **fd integration** — Uses `fd --glob` for proper glob pattern handling.

### Extended Tools (Phase 84)
- **jq integration** — JSON query and transformation support.
- **yq integration** — YAML processing.
- **bat integration** — Syntax-highlighted file viewing.
- **gh CLI integration** — GitHub CLI wrapper for PR creation, issue management.

### Runtime Exploration (Phase 85)
- **Bun runtime detection** — Session cache-based detection with `bun --version` first, then `which bun` fallback.
- **Graceful degradation** — Falls back to Node.js when Bun unavailable.
- **Full details display** — Shows full details when Bun detected, install instructions when unavailable.

---

## v9.3 Quality, Performance & Agent Sharpening

**Shipped:** 2026-03-10 | **Phases:** 86-90 | **Plans:** ~12
**Tests:** 762 | **Bundle:** ~1150KB

**Goal:** Improve code quality, reduce command surface from 50 to 11 commands (78% reduction), implement RACI handoff contracts, and add host editor native routing.

**What was delivered:**

### Agent Sharpening (Phase 86)
- **Agent manifest audit** — Found zero capability conflicts; all agents share foundational tools but have distinct responsibilities.
- **Handoff contracts (RACI)** — Every lifecycle step has exactly one responsible agent. Documented in RACI skill with inputs, outputs, preconditions.
- **verify:agents command** — Automated boundary validation for agent responsibilities.

### Command Consolidation (Phase 87)
- **8 subcommand wrappers** — Created wrapper commands to group 41 original commands into logical categories.
- **50→11 commands** — 78% reduction in slash command surface.
- **Host editor native routing** — Wrapper commands are definition files for host editor. Plugin's command-enricher.js adds context but doesn't route.

### Quality & Context (Phase 88)
- **Context budget enforcement** — All agents declare token budgets.
- **Intent validation** — 4 signals for intent drift detection.

### Runtime & Benchmark (Phases 89-90)
- **Performance profiling** — Timing data for file reads, git operations, markdown parsing.
- **Cache effectiveness validation** — Measurable timing data for cache speedup.

---

## v13.0 Closed-Loop Agent Evolution

**Shipped:** 2026-03-15 | **Phases:** 129-133 | **Plans:** 12
**Tests:** 1,504 | **Velocity:** ~14 min/plan

**Goal:** Close the agent improvement loop — let agents customize themselves per-project, learn from past executions, discover community skills, and auto-capture deviation recoveries.

**What was delivered:**

### Agent Overrides (Phase 129)
- **Local agent lifecycle** — `agent:list-local`, `agent:override`, `agent:diff`, `agent:sync` commands for project-specific agent customization
- **YAML validation** — Frontmatter validation and content sanitization against system-prompt mangling
- **bgsd-context integration** — `local_agent_overrides` field injected into workflow context

### Lesson Analysis Pipeline (Phase 130)
- **Structured lesson schema** — Migration from free-form text to structured capture with category, severity, and tags
- **Analysis commands** — `lessons:analyze` groups patterns across phases, `lessons:suggest` generates advisory improvements
- **Workflow hooks** — Auto-invoked in verify-work and complete-milestone workflows
- **Compaction** — `lessons:compact` deduplicates redundant lessons

### Skill Discovery & Security (Phase 131)
- **41-pattern security scanner** — Detects shell injection, eval, network access, filesystem traversal in skill files
- **Install pipeline** — `skills:install` fetches from GitHub with content diff and human confirmation gate
- **Audit logging** — Append-only `skill-audit.json` tracks all install/remove operations
- **Full lifecycle** — `skills:list`, `skills:validate`, `skills:remove` commands
- **New-milestone integration** — Step 8.5 discovers and suggests relevant skills

### Deviation Auto-Capture (Phase 132)
- **Rule-1 recovery capture** — Auto-captures autonomous recovery patterns as structured lessons
- **3-per-milestone cap** — Prevents lesson flooding from repetitive deviations
- **Workflow hook** — Integrated into execute-plan.md post-completion

### Enhanced Research (Phase 133)
- **Structured quality profiles** — `research:score` returns multi-dimensional quality assessment (not single grade)
- **Gap surfacing** — `research:gaps` extracts actionable gap lists from research documents
- **Multi-source conflict detection** — Flags contradictions across research sources
- **New-milestone integration** — Research quality profile displayed after RESEARCH COMPLETE banner

---

## v12.1 Tool Integration & Agent Enhancement

**Shipped:** 2026-03-15 | **Phases:** 124-128 | **Plans:** 13
**Tests:** 1,398 | **Velocity:** ~14 min/plan

**Goal:** Integrate external CLI tools for faster operations and enhance agent collaboration with tool-aware routing and structured handoff contracts.

**What was delivered:**

### Tool Detection (Phase 124)
- **Unified detect.js** — Single detection module for 6 CLI tools (ripgrep, fd, jq, yq, bat, gh) with 5-minute file cache
- **Cross-platform PATH resolution** — macOS, Linux, and Windows support with install guidance

### Core Tools (Phase 125)
- **ripgrep** — <100ms search on 10K+ file repos with `--json` structured output
- **fd** — 20x faster file discovery with `--glob` pattern handling
- **jq** — JSON query and transformation with streaming support
- **Graceful fallbacks** — Node.js alternatives when tools unavailable

### Extended Tools (Phase 126)
- **yq** — YAML processing integration
- **bat** — Syntax-highlighted file viewing
- **gh** — GitHub CLI wrapper with 2.88.0 version blocklist
- **Config toggles** — Per-tool enable/disable in config.json

### Agent Routing (Phase 127)
- **3 decision functions** — Tool-aware routing for search, file discovery, and data transformation
- **tool_availability enricher** — Injects detected tool state into agent context

### Agent Collaboration (Phase 128)
- **Capability resolution** — `resolveAgentCapabilityLevel` scores agent effectiveness based on available tools
- **Phase dependencies** — `resolvePhaseDependencies` determines execution ordering
- **9 handoff contracts** — Structured input/output contracts for all agent-pair handoffs
- **Context filtering** — Capability-aware context reduction (25%+ token savings)

---

## v12.0 SQLite-First Data Layer

**Shipped:** 2026-03-15 | **Phases:** 118-123 | **Plans:** 16
**Tests:** 1,008 | **Velocity:** ~15 min/plan

**Goal:** Move bGSD's data layer from file-only to SQLite-first with write-through consistency, accelerated enrichment, and SQL-backed memory stores.

**What was delivered:**

### Foundation (Phase 118)
- **DataStore class** — SQLite via `node:sqlite` DatabaseSync with WAL mode, busy timeout, and automatic schema versioning/migration
- **Map fallback** — Graceful degradation to in-memory Map on Node <22.5

### Planning Tables (Phase 119)
- **Write-through cache** — Roadmap and plan parsers backed by SQLite with git-hash + mtime invalidation
- **`.planning/.cache.db`** — Persistent planning cache database

### Enricher Acceleration (Phase 120)
- **Zero-redundancy enricher** — `parsePlans` and `listSummaryFiles` called exactly once per invocation
- **<50ms warm cache** — Enricher runs under 50ms with warm SQLite cache

### Memory Migration (Phase 121)
- **Dual-write architecture** — Sacred data (decisions, lessons, trajectories, bookmarks) written to both SQLite and JSON
- **SQL-backed search** — Full-text search across memory stores via SQL queries

### Decision Rules (Phase 122)
- **6 new decision functions** — Model selection, verification routing, research gate, phase readiness, milestone completion, commit strategy
- **model_profiles table** — Decision rules consume SQLite state directly

### Session State (Phase 123)
- **SQLite session persistence** — Session state stored in database
- **STATE.md as generated view** — STATE.md becomes a rendered output from SQLite state

---

## v11.3 LLM Offloading

**Shipped:** 2026-03-13 | **Phases:** 110-113 | **Plans:** 9
**Velocity:** ~15 min/plan

**Goal:** Replace wasteful LLM calls with deterministic decision functions, and pre-build SUMMARY.md from git data so LLMs only fill judgment sections.

**What was delivered:**

### Audit Framework (Phase 110)
- **Codebase scan** — Identified LLM-offloadable decisions across all workflows
- **Inline replacements** — Direct substitution of LLM calls with deterministic logic

### Decision Engine (Phase 111)
- **decision-rules.js** — 12 pure decision functions with confidence scoring (HIGH/MEDIUM/LOW)
- **Decision registry** — `decisions` CLI namespace with list/inspect/evaluate subcommands
- **85 contract tests** — Full coverage of decision function behavior

### Workflow Integration (Phase 112)
- **13 workflows wired** — Decision consumption blocks with fallback logic in 13 workflows
- **Savings report** — `decisions:savings` shows per-workflow LLM step reduction

### Summary Generation (Phase 113)
- **`summary:generate`** — Pre-builds SUMMARY.md from git history and plan metadata
- **LLM fill** — LLM only writes judgment sections (50%+ reduction in summary generation cost)

---

## v11.2 Code Cleanup

**Shipped:** 2026-03-12 | **Phases:** 106-109 | **Plans:** ~8

**Goal:** Systematic codebase cleanup — remove dead code, consolidate duplicates, eliminate unused exports.

**What was delivered:**
- **Code audit** — Removed verify:orphans command and performance profiler (-14.5KB bundle reduction)
- **AST-based inventory** — Export/import analysis across all modules; confirmed no dead code
- **Duplicate detection** — jscpd-based analysis; decided clarity-over-DRY for remaining similarities
- **New verification commands** — `verify:handoff` and `verify:agents` CLI commands
- **Dead route removal** — Removed orphaned ci.js, dead routes, deduplicated standalone commands

---

## v11.1 Command Execution & Polish

**Shipped:** 2026-03-12 | **Phases:** 103-105 | **Plans:** ~7

**Goal:** Make slash commands execute immediately without clarification prompts, with smart defaults and clear error messages.

**What was delivered:**
- **Direct command routing** — Bypass flags for NL modules, commands execute without asking "did you mean?"
- **60% confidence threshold** — All 77 command routes tested above threshold
- **Smart defaults** — `--defaults` flag for zero-prompt execution, `--exact` for deterministic override
- **Context boosting** — Phase-matching context boost and user choice learning
- **Error clarity** — Command confusion suggestions with actionable error messages

---

## v11.0 Natural Interface & Insights

**Shipped:** 2026-03-11 | **Phases:** 98-102 | **Plans:** ~9

**Goal:** Add natural language parsing and visualization capabilities so users can type freely and see project state visually.

**What was delivered:**

### Natural Language (Phases 98-99)
- **Intent classification** — 31-phrase command registry with parameter extraction
- **Fuzzy resolver** — Disambiguation with contextual help fallback
- **Multi-intent detection** — Handles compound requests ("plan and execute phase 3")
- **Smart aliases** — Common phrases resolve to commands

### Visualization (Phases 100-101)
- **ASCII progress bars** — Phase and milestone progress display
- **Quality score display** — Visual A-F grade rendering
- **Burndown charts** — Ideal vs actual plan completion tracking
- **Velocity sparklines** — Session trend visualization
- **Terminal dashboard** — Full-screen dashboard with keyboard navigation

### Reporting (Phase 102)
- **Milestone summaries** — Aggregated completion reports
- **Velocity computation** — Plans/day metrics with historical comparison

---

## v10.0 Agent Intelligence & UX

**Shipped:** 2026-03-11 | **Phases:** 91-97 | **Plans:** ~12

**Goal:** Make agents smarter — better planning decisions, execution recovery, verification intelligence, and interactive workflows with rich terminal output.

**What was delivered:**

### Rich TTY Output (Phase 91)
- **Color-coded formatting** — Spinner, ProgressTracker, and branded output via format.js
- **Structured errors** — Error classes with recovery suggestions (error.js)
- **Debug utilities** — debug.js with trace, context-dump capabilities

### Planning Intelligence (Phase 92)
- **Dependency detection** — Automatic identification of task dependencies
- **Task sizing** — Heuristic task complexity estimation
- **Parallelization analysis** — Optimal wave assignment suggestions

### Verification Intelligence (Phase 93)
- **Regression detection** — Identifies regressions across plan executions
- **Edge case suggestions** — Recommends untested edge cases
- **Coverage analysis** — Tracks verification coverage across requirements

### Execution Intelligence (Phase 94)
- **Autonomous deviation recovery** — Self-corrects when execution drifts from plan
- **Checkpoint decisions** — Automated checkpoint type selection
- **Loop detection** — Enhanced stuck/loop identification with recovery strategies

### Interactive Workflows (Phase 95)
- **Guided prompts** — Wizard-style workflows for complex operations
- **Abort handling** — Clean abort with state preservation

### Multi-Agent Collaboration (Phase 96)
- **Structured handoffs** — Typed context objects passed between agents
- **Shared context registry** — Central registry for cross-agent context
- **Contract verification** — Validates handoff contract compliance

### UX Polish (Phase 97)
- **Contextual help** — Autocomplete hints and command suggestions
- **Bundle reduction** — Optimized output size

---

## v6.0 UX & Developer Experience

**Shipped:** 2026-02-27 | **Phases:** 30-36 | **Plans:** 11
**Commits:** 29 | **Files:** 102 | **Lines:** +6,275 / -1,982 | **Tests:** 574 | **Bundle:** 681KB

**What was delivered:**
- **Shared formatting engine** (`src/lib/format.js`) — formatTable, progressBar, banner, box, and ~2KB picocolors-pattern color utility with TTY-aware auto-disable
- **Smart output detection** — Human-readable branded output in TTY mode, JSON when piped, with `--raw` and `--pretty` overrides
- **Command renderer migration** — All user-facing commands (init, state, verify, codebase, velocity, intent) migrated to shared formatting
- **Workflow output tightening** — 455-line reduction across 27 files, help.md cut 44%
- **11 slash command wrappers** — Created in `commands/` directory with deploy.sh safe sync
- **AGENTS.md** — Rewritten as lean 59-line project index

---

## v5.0 Codebase Intelligence

**Shipped:** 2026-02-26 | **Phases:** 23-29 | **Plans:** 14
**Commits:** 79 | **Files:** 185 | **Lines:** +27,096 / -8,274 | **Tests:** 572 | **Bundle:** 672KB

**What was delivered:**
- **Codebase-intel.json** — Storage with git-hash watermarks, staleness detection, incremental analysis
- **Convention extraction** — Naming patterns, file organization, framework macros with confidence scoring
- **Dependency graph** — Import/require/use analysis across 6 languages (JS, TS, Python, Go, Elixir, Rust) with Tarjan's SCC cycle detection
- **Lifecycle awareness** — Execution order detection (seeds, migrations, config, boot) with extensible detector registry
- **Task-scoped context** — Heuristic relevance scoring (graph distance + plan scope + git recency) with 5K token budget
- **Non-blocking analysis** — Background re-analysis with lock file and --refresh flag

---

## v4.0 Environment & Execution Intelligence

**Shipped:** 2026-02-25 | **Phases:** 18-22 | **Plans:** 13
**Commits:** 55 | **Files:** 70 | **Lines:** +16,399 / -2,478 | **Tests:** 502 | **Bundle:** 549KB

**What was delivered:**
- **Environment detection** — 26 manifest patterns, package manager precedence, binary version checks, auto-inject into init commands
- **MCP server profiling** — 20-server token estimation database, 16-type relevance scoring, keep/disable/review recommendations with backup/restore
- **Structured requirements** — ASSERTIONS.md template, per-assertion verification (pass/fail/needs_human), traceability chains
- **Git worktree parallelism** — Full CRUD lifecycle, merge-tree conflict pre-check, lockfile auto-resolution, static file overlap detection
- **Session management** — session-summary CLI and complete-and-clear workflow

---

## v3.0 Intent Engineering

**Shipped:** 2026-02-25 | **Phases:** 14-17 | **Plans:** 10
**Commits:** 43 | **Files:** 47 | **Lines:** +10,142 / -400 | **Tests:** 348 | **Bundle:** 447KB

**What was delivered:**
- **INTENT.md** — Template and CRUD commands (create, read/show, update, validate)
- **Intent tracing** — Per-plan intent sections in YAML frontmatter, traceability matrix, coverage gap detection
- **Intent drift validation** — 4 signals (coverage gap, objective mismatch, feature creep, priority inversion) producing weighted 0-100 score
- **Workflow-wide injection** — All workflows (research, plan, execute, verify) receive intent context automatically
- **Guided questionnaire** — Intent capture in new-project and new-milestone workflows
- **Evolution tracking** — History section with auto-logging, milestone context, --reason flag

---

## v2.0 Quality & Intelligence

**Shipped:** 2026-02-24 | **Phases:** 10-13 | **Plans:** 13
**Commits:** 25 | **Files:** 61 | **Lines:** +14,172 / -2,553 | **Tests:** 297 | **Bundle:** 373KB

**What was delivered:**
- **State validation** — 5 drift-detection checks (plan count, position, stale activity, blocker staleness, plan claims) with auto-fix
- **Cross-session memory** — Dual-store pattern (STATE.md authority + memory.json cache), sacred data protection, bookmark auto-save, deterministic compaction
- **Quality gates** — Test gating, requirement checking, regression detection, A-F quality scoring, single-responsibility analysis with union-find concern grouping
- **Integration tests** — Workflow sequence tests, state round-trips, E2E simulation, snapshot tests across 297 tests
- **Bundle tracking** — Token budgets, compact-as-default, MCP server discovery

---

## v1.1 Context Reduction & Tech Debt

**Shipped:** 2026-02-22 | **Phases:** 6-9 | **Plans:** 10
**Commits:** 42 | **Files:** 78 | **Lines:** +12,642 / -4,576

**What was delivered:**
- **tokenx integration** — Accurate BPE-based token estimation (~96% accuracy)
- **--compact flag** — 46.7% average output reduction across 12 init commands
- **extract-sections CLI** — Dual-boundary parsing enabling 67% reference file reduction
- **Workflow compression** — 54.6% average (39,426 to 15,542 tokens) across top 8 workflows
- **Research templates** — Summary/detail tiers for context-aware loading
- **Tech debt resolution** — Fixed failing test, completed 44-command help coverage, created plan templates

---

## v1.0 Performance & Quality

**Shipped:** 2026-02-22 | **Phases:** 1-5 | **Plans:** 14
**Commits:** 63 | **Files:** 86 | **Lines:** +24,142 / -5,143

**What was delivered:**
- **Test suite** — 153+ tests covering state mutations, frontmatter parsing, config schema
- **Debug logging** — GSD_DEBUG-gated stderr logging for all 96 catch blocks
- **Command discoverability** — --help support for all 15 feature commands (43 entries)
- **Module split** — Monolith split into 15 organized src/ modules with esbuild bundler
- **Performance** — In-memory file cache and batch grep to eliminate redundant I/O
- **Security** — sanitizeShellArg() for shell injection prevention, cleanup handlers for temp files

---

## Development Timeline

```
2026-02-21  v1.0 started
2026-02-22  v1.0 shipped, v1.1 shipped (same day)
2026-02-24  v2.0 shipped
2026-02-25  v3.0 shipped, v4.0 shipped (same day)
2026-02-26  v5.0 shipped
2026-02-27  v6.0 shipped, v7.0 shipped (same day)
2026-02-28  v7.1 started (Trajectory Engineering)
2026-03-01  v7.1 shipped
2026-03-01  v8.0 started (Performance & Architecture)
2026-03-03  v8.0 shipped
2026-03-10  v9.2 shipped, v9.3 shipped
2026-03-11  v10.0 shipped, v11.0 shipped
2026-03-12  v11.1 shipped, v11.2 shipped
2026-03-13  v11.3 shipped (LLM Offloading)
2026-03-15  v12.0 shipped, v12.1 shipped, v13.0 shipped
```

Total: 20 milestones shipped, 107 phases, ~242 plans, 1,504 tests across ~25 days.

---

*For the architectural decisions behind each milestone, see [Decisions](decisions.md). For the current project state, see `.planning/STATE.md`.*
