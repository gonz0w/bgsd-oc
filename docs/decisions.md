# Design Decisions

Why bGSD is built the way it is. Every major architectural and product decision documented with rationale, alternatives considered, and outcomes observed.

---

## Table of Contents

- [Architectural Decisions](#architectural-decisions)
- [Technical Decisions](#technical-decisions)
- [Product Decisions](#product-decisions)
- [Decisions by Milestone](#decisions-by-milestone)
- [Out of Scope Decisions](#out-of-scope-decisions)

---

## Architectural Decisions

### Two-Layer Architecture: Deterministic CLI + AI Workflows

**Decision:** Separate all operations into a deterministic layer (`gsd-tools.cjs`) and an AI layer (workflow `.md` files).

**Why:** AI agents are unreliable at parsing markdown, managing state, and performing file I/O consistently. By making the CLI handle all structured operations (parsing, validation, git, state management) and returning clean JSON, agents only need to reason about what to do — not how to do it.

**Alternatives considered:**
- Monolithic agent prompt with inline file operations — rejected because agents make parsing errors and state becomes inconsistent
- Python-based orchestration framework — rejected because it adds runtime dependencies and complexity
- Direct LLM API calls from CLI — rejected because bGSD produces prompts, it doesn't call LLM APIs directly

**Outcome:** Good. 669+ tests cover the deterministic layer. Workflows are portable across any LLM that follows markdown instructions. State changes are atomic and predictable.

---

### Single-File CLI Bundle

**Decision:** Bundle all 34 source modules into a single `bin/gsd-tools.cjs` file via esbuild.

**Why:** Deployment is a file copy (`deploy.sh`), not a package installation. A single file means no `node_modules` at the deployment target, no dependency resolution, no version conflicts.

**Alternatives considered:**
- npm package with standard `node_modules` — rejected because plugin deployment is file-copy to `~/.config/opencode/`
- ESM output — rejected because CJS avoids `__dirname`/`require` rewriting issues
- Multiple bundled chunks — rejected for deployment simplicity

**Outcome:** Good. The build produces one file (1000KB), deploys with `cp`, and has zero runtime dependency issues.

---

### Intelligence as Data, Not Agents

**Decision:** New capabilities are CLI commands that produce richer data for existing agents, not new agent roles. Hard cap at 12 agent roles (11 original + gsd-reviewer).

**Why:** DeepMind research shows coordination overhead grows quadratically with agent count. Cursor's experiment with 20 equal-status agents failed. Gas Town's production incident (DB down 2 days) came from autonomous agents. The right approach is fewer, smarter agents with better data.

**Alternatives considered:**
- Agent role per capability (gsd-git-analyst, gsd-context-optimizer, gsd-task-router) — rejected due to coordination overhead
- Dynamic agent spawning based on task — rejected because Cursor validated that pre-planned parallelism beats self-spawning
- Autonomous agent teams — rejected because 67% AI PR rejection rate (LinearB) and 9% more bugs (DORA 2025) show human-in-the-loop is correct

**Outcome:** Good. 12 agent roles cover all needs. New intelligence (task classification, context budgets, AST analysis) is delivered as CLI data that existing agents consume.

---

### Advisory-Only Validation

**Decision:** State validation, intent drift detection, and orchestration routing recommendations are advisory — they never block workflows.

**Why:** False positives in blocking gates halt productivity. The v2.0 state validation design established this: "Never block workflows; warn and let user decide." The risk of blocking legitimate work outweighs the risk of missing a real issue.

**Alternatives considered:**
- Blocking validation gates — rejected because false positives on legitimate state transitions (archival, manual commits, mid-execution) would halt work
- Auto-correcting validation — rejected because automated "fixes" to false positives corrupt real state

**Outcome:** Good. Catches drift without disrupting work. Users trust the warnings because they don't get false-positive fatigue.

---

### File-Based Agent Communication

**Decision:** Agents communicate through files (PLAN.md in, SUMMARY.md out), not through conversation history or message passing.

**Why:** Files survive context resets (`/clear`), session restarts, and agent crashes. Git tracks all changes. Any agent can pick up where another left off by reading the files.

**Alternatives considered:**
- Conversation-based state passing — rejected because context resets lose all state
- Database-backed state — rejected because JSON + git history suffices for current scale
- Event-sourced state (like OpenHands) — considered but file-based achieves same durability through git

**Outcome:** Good. Projects resume cleanly after days-long breaks. All state is human-readable in `.planning/`.

---

## Technical Decisions

### In-Memory Map Cache Over LRU Cache

**Decision:** Use plain JavaScript `Map` for file caching instead of an LRU cache library.

**Why:** CLI invocations are short-lived processes (<5 seconds). There's no long-running process where memory management matters. A plain Map needs no eviction strategy and has zero dependencies.

**Outcome:** Good — simpler, zero dependency.

---

### tokenx for Token Estimation

**Decision:** Use the tokenx library (4.5KB bundled) for BPE-based token estimation instead of the previous `lines * 4` heuristic.

**Why:** The old heuristic was ~50% inaccurate. tokenx provides ~96% accuracy with zero dependencies and minimal bundle impact.

**Alternatives considered:**
- tiktoken (WASM, ~2MB) — rejected because WASM doesn't bundle cleanly with esbuild and violates single-file constraint
- Manual BPE implementation — rejected because tokenx already solves this at 4.5KB

**Outcome:** Good. Context budget calculations are accurate. Token savings are measurable.

---

### acorn for AST Parsing

**Decision:** Use acorn (114KB bundled) for JavaScript/TypeScript AST parsing with regex fallback for non-JS languages.

**Why:** acorn is the most widely-used JS parser (used by webpack, eslint/espree). Zero dependencies, well-documented API, reliable.

**Alternatives considered:**
- tree-sitter (v0.25.0) — rejected because it requires native bindings, violating the zero-native-dep constraint
- Full TypeScript parser — rejected because regex-based TypeScript stripping is sufficient for signature extraction
- Babel parser — rejected because it's 500KB+ bundled

**Outcome:** Good. Enables repo map generation, function signature extraction, and complexity metrics with one dependency.

---

### Synchronous I/O

**Decision:** All file and git operations are synchronous (`readFileSync`, `execSync`).

**Why:** Each CLI invocation is a short-lived process that runs a single command. Async I/O adds complexity (callbacks, promises, error handling) with no performance benefit in a sequential pipeline that completes in under 5 seconds.

**Outcome:** Good. Code is simple, predictable, and easy to test.

---

### Dual-Store Memory Pattern

**Decision:** Cross-session memory uses STATE.md as the authoritative source and `.planning/memory/*.json` files as machine-optimized caches. STATE.md always wins if they disagree.

**Why:** Having a single human-readable authority (STATE.md) prevents the "two sources of truth" problem identified in research. JSON stores enable fast machine queries without parsing markdown.

**Outcome:** Good. Decisions survive sessions. Memory files are searchable. No contradiction bugs.

---

### Smart Output TTY Detection

**Decision:** CLI commands produce human-readable branded output in TTY mode and JSON when piped, with `--raw` and `--pretty` overrides.

**Why:** Agents consume JSON via pipes. Humans read formatted output in terminals. Auto-detection eliminates the need to remember flags.

**Outcome:** Good. Backward-compatible. Agent workflows work unchanged. Human-facing commands look polished.

---

### Git Trailers for Commit Metadata

**Decision:** Use git trailers (`GSD-Phase: red`, `Agent-Type: gsd-executor`) instead of commit message conventions for metadata.

**Why:** Trailers are a git standard. They're machine-parseable without regex on the commit message body. They don't clutter the human-readable commit summary.

**Outcome:** Good. TDD phase tracking and agent attribution are clean and queryable.

---

## Product Decisions

### Two Flows: Easy and Expert

**Decision:** Provide both an easy flow (GSD drives everything, user answers questions) and an expert flow (user controls every step).

**Why:** New users need guidance. Experienced users need control. A single flow either overwhelms beginners or frustrates experts.

**Outcome:** Good. New users start with `/gsd-new-project` and get walked through. Experts use individual commands for fine-grained control.

---

### Three Model Profiles

**Decision:** Offer quality/balanced/budget profiles that map agent types to AI model tiers (opus/sonnet/haiku).

**Why:** Different tasks need different intelligence levels. Planning requires deep reasoning (opus). Execution needs competent coding (sonnet). Verification can be fast (haiku). Users should control cost vs quality.

**Outcome:** Good. Per-agent overrides in config.json provide fine-grained control when needed.

---

### Wave-Based Parallel Execution

**Decision:** Plans within a phase are organized into dependency waves. Independent plans execute in parallel; dependent plans wait.

**Why:** Sequential execution is slow. Fully parallel execution creates merge conflicts. Wave-based execution is the middle ground — maximum parallelism within dependency constraints.

**Outcome:** Good. Phases with 3-5 plans see significant speedup on independent work.

---

### Milestone-Driven Development

**Decision:** Projects progress through milestones (v1.0, v2.0, etc.), each containing multiple phases, each containing multiple plans.

**Why:** This mirrors how real software is built. Milestones provide natural checkpoints for archival, retrospection, and scope management.

**Outcome:** Good. bGSD itself has shipped 7 milestones (v1.0 through v7.0) in 8 days, demonstrating the system works at scale.

---

### TDD as Opt-In Plan Type

**Decision:** TDD enforcement is a plan type (`type: tdd`), not a global setting. Plans specify whether they follow RED-GREEN-REFACTOR.

**Why:** Not all work benefits from TDD. Research, configuration, documentation, and refactoring tasks don't need test-first development. Forcing TDD on everything adds overhead without benefit.

**Outcome:** Good. Implementation-heavy plans use TDD. Other plans execute normally.

---

### Reviewer as Non-Blocking (Initially)

**Decision:** The gsd-reviewer agent's findings are informational until the pipeline is proven reliable, then graduated to blocking for critical issues.

**Why:** A new review system will have false positives. Blocking on false positives destroys developer trust. Starting advisory and graduating to blocking follows the proven "crawl, walk, run" pattern.

**Outcome:** Good. Phase 44 graduated the reviewer to blocking for BLOCKER-severity findings, with stuck/loop detection as a safety net.

---

## Decisions by Milestone

### v1.0 Decisions (Performance & Quality)

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| esbuild bundler pipeline with src/ module split | 18 modules organized by domain with strict dependency direction | Good — maintainable, no circular imports |
| Debug logging (GSD_DEBUG) over error throwing | Most silent catches are "optional data" patterns that shouldn't crash | Good — 96 catch blocks instrumented |
| Shell injection sanitization (sanitizeShellArg) | CLI tool executes git commands; must prevent injection | Good — security hardened |

### v1.1 Decisions (Context Reduction)

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| --compact flag as default for init commands | 46.7% average output reduction saves tokens on every workflow | Good — agents get essential data only |
| extract-sections CLI with dual-boundary parsing | 67% reference file reduction via selective section loading | Good — agents load only needed sections |
| Workflow compression preserving behavioral logic | 54.6% average reduction (39,426 to 15,542 tokens) across top 8 workflows | Good — same behavior, less context |

### v2.0 Decisions (Quality & Intelligence)

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Advisory-only state validation | Never block workflows; warn and let user decide | Good — catches drift without disrupting |
| Dual-store pattern (STATE.md + memory.json) | Human-readable authority + machine-optimized caching | Good — decisions survive sessions |
| Tiered verification (light/standard/deep) | Per-plan verification is wasteful; test at phase level by default | Good — verification overhead <10% |

### v3.0 Decisions (Intent Engineering)

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Intent as architectural layer | INTENT.md + per-phase tracing + drift validation aligns all work with goals | Good — drift detected early |
| Structured assertions over Gherkin | 80% benefit at 20% ceremony — simple, readable, testable | Good — practical verification |
| Workflow-wide intent injection (conditional) | Zero impact on projects without INTENT.md | Good — backward compatible |

### v4.0 Decisions (Environment & Execution Intelligence)

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Worktree three-gate check | worktree_enabled AND parallelization AND multi-plan wave before using worktrees | Good — conservative fallback to sequential |
| 26 manifest patterns for environment detection | Covers languages, package managers, CI, test frameworks, linters, Docker, MCP, monorepo | Good — comprehensive detection |
| MCP server profiling with auto-disable | 20-server known database with token estimation, backup before disable | Good — token savings with safety net |

### v5.0 Decisions (Codebase Intelligence)

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Codebase-intel.json with git-hash watermarks | Staleness detection via git hash; incremental analysis only when codebase changes | Good — no stale data |
| Convention extraction with confidence scoring | Only apply high-confidence conventions; low-confidence ones are informational | Good — reduces false positives |
| Tarjan's SCC for dependency cycle detection | Standard algorithm for strongly connected components; proven correct | Good — catches real circular deps |
| 5K token budget for task-scoped context | Bounded context injection prevents context rot | Good — focused context |

### v6.0 Decisions (UX & Developer Experience)

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single-module format.js | All formatting primitives in one file; picocolors-pattern inline (~2KB) | Good — zero-dep, TTY-aware |
| Co-located formatter functions | Formatters next to command handlers, not centralized | Good — only user-facing commands migrated |
| bGSD branding | Subtle rename for consistent brand identity | Good — professional feel |

### v7.0 Decisions (Agent Orchestration & Efficiency)

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Dependencies allowed when they serve quality | Dropped zero-dep constraint — acorn (114KB) provides AST intelligence worth the cost | Good — enables repo map |
| Hybrid snapshot strategy for contract tests | Full snapshots for high-value commands, field-level for others | Good — catches regressions without brittle tests |
| Model mapping (scores 1-3 → sonnet, 4-5 → opus) | Task complexity drives model selection automatically | Good — cost optimization |
| Agent manifests use whitelist not blacklist | Agents declare what they need; system provides only that | Good — safe context scoping |
| Two-stage review (spec + quality) | Spec compliance catches "built the wrong thing"; quality catches "built it wrong" | Good — catches both failure modes |
| Severity classification (BLOCKER/WARNING/INFO) | Blockers prevent completion; warnings are advisory | Good — graduated enforcement |
| Stuck/loop detection at 3 failures | Prevents token waste from repeating failed patterns | Good — automatic recovery |
| TDD gate validation via execSync with 120s timeout | Synchronous test execution fits CLI model; timeout prevents hangs | Good — predictable |
| Auto test-after-edit (non-blocking) | Catches errors early without stopping execution flow | Good — error prevention |

---

## Out of Scope Decisions

Decisions about what NOT to build, with reasoning.

| Feature | Why Not |
|---------|---------|
| Async I/O rewrite | Synchronous I/O is appropriate for a CLI tool that completes in <5 seconds |
| npm package publishing | Plugin is deployed via file copy, not a library |
| ESM output format | CJS avoids __dirname/require rewriting complexity |
| RAG / vector search | Wrong architecture for a CLI tool; file-based search suffices |
| SQLite codebase index | Heavy dependency with marginal ROI over JSON + git |
| Runtime MCP server connection | Static analysis of MCP config is sufficient |
| CI/CD pipeline management | Handled by external tooling |
| TypeScript migration | Not worth 34-module migration cost |
| Database/SQLite for state | JSON + git history suffices for current scale |
| Autonomous agent teams | 67% AI PR rejection rate, 9% more bugs — human-in-the-loop is correct |
| Dynamic agent spawning | Cursor's 20-agent failure validates pre-planned parallelism |
| LLM SDK integration | bGSD produces prompts, doesn't call LLM APIs directly |
| Agent role explosion (>12) | Coordination overhead grows quadratically; intelligence = data, not agents |

---

## Research That Informed Decisions

Key research sources that shaped bGSD's architecture:

- **DeepMind scaling research** — Coordination overhead grows quadratically with agent count; 17x error amplification in unstructured networks
- **Anthropic context engineering** (Sep 2025) — "The smallest possible set of high-signal tokens"; context rot degrades performance
- **Chroma context rot research** — Empirical evidence that larger contexts degrade LLM recall accuracy
- **LinearB data** — 67% AI PR rejection rate validates human-in-the-loop
- **DORA 2025** — 9% more bugs from autonomous AI coding
- **Cursor scaling agents blog** — Equal-status agent architecture failed; hierarchical control required
- **Gas Town incident** — Production DB down 2 days from autonomous agent; validates safety gates
- **Aider repo map** — Tree-sitter + PageRank pattern for ~1k token codebase summaries
- **Superpowers (obra)** — Two-stage review (spec + quality), TDD enforcement, pressure-tested skill compliance
- **SWE-agent** — Edit-with-linter guard, stuck-in-loop detection
- **OpenHands** — Context condensation, stuck detection, event-sourced state patterns

---

*This document captures the reasoning behind bGSD's design. For the technical implementation, see [Architecture](architecture.md).*
