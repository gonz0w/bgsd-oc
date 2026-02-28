# Agentic Capabilities Audit: What GSD Is Missing

**Audited:** 2026-02-27
**Scope:** Superpowers, Aider, SWE-agent, Devin/Cognition, OpenHands, Review Gate Patterns
**Overall confidence:** HIGH (primary sources verified for all 6 systems)

---

## Systems Analyzed

### 1. Superpowers (obra/superpowers — 64.5k GitHub stars)

**What it is:** A "skills framework" for Claude Code that enforces a brainstorm → plan → implement → review workflow. Skills are markdown files that Claude reads and follows.

**Key capabilities:**
- **Mandatory brainstorm-before-code discipline:** Won't jump to code. Asks questions, refines spec in digestible chunks, requires sign-off before planning. GSD equivalent: planner workflow already does this via researcher → planner → plan-checker. **Status: COVERED.**
- **Two-stage code review (spec compliance, then code quality):** After each subagent task, a reviewer checks: (1) Does the output match the spec? (2) Is the code quality acceptable? Critical issues block progress. **Status: PARTIALLY MISSING.** GSD's planned reviewer checks conventions, but not spec compliance as a separate gate.
- **Strict RED-GREEN TDD enforcement:** Deletes code written before tests. Not just "write tests" — enforces the RED → GREEN → REFACTOR cycle. Includes anti-patterns reference. **Status: MISSING.** GSD has no TDD enforcement or anti-pattern detection.
- **Per-task subagent isolation with fresh context:** Each engineering task dispatched to a fresh subagent (not the same long conversation). Prevents context pollution between tasks. **Status: PARTIALLY COVERED.** GSD's execute-phase spawns subagents, but doesn't mandate fresh context per task within a plan.
- **Pressure-tested skill compliance:** Skills tested via adversarial subagent scenarios (time pressure, sunk cost fallacy, confidence traps) to ensure Claude actually follows them. Uses Cialdini persuasion principles. **Status: MISSING.** GSD skills/workflows aren't adversarially tested for compliance.
- **Skill authoring meta-skill:** Claude can create new skills, TDD-style (write skill, test with subagents, refine). Self-improving framework. **Status: NOT APPLICABLE.** GSD is a CLI tool, not a skill framework.
- **Git worktree creation before implementation:** Automatically creates a worktree and branch before any implementation begins. **Status: COVERED.** GSD already supports worktree parallelism.

**Source confidence:** HIGH — GitHub README, obra's blog (Oct 2025), multiple community reviews verified.

### 2. Aider

**What it is:** Terminal-based AI pair programmer with deep git integration and repo map innovation.

**Key capabilities:**
- **Three chat modes (code/ask/architect):** `code` edits files, `ask` discusses without editing, `architect` plans then hands to editor model. Users bounce between modes fluidly. **Status: PARTIALLY COVERED.** GSD has planner/executor separation, but no explicit "ask-only" mode that prevents edits.
- **Architect → Editor two-model pattern:** Strong model plans, weaker/cheaper model translates plan into file edits. Decouples reasoning from editing. **Status: MISSING as explicit pattern.** GSD's model routing plans to do this (ORCH-02), but Aider's implementation is more mature — it has built-in defaults mapping architect→editor models.
- **Automatic lint-after-edit with auto-fix loop:** Every edit triggers lint. If lint fails, aider sees errors and auto-fixes. Built-in linters for most languages. **Status: MISSING.** GSD has no automatic lint integration. The verifier checks goals but not code style/lint.
- **Automatic test-after-edit with auto-fix loop:** `--test-cmd` + `--auto-test` runs tests after every change. Failures get sent back to aider for auto-repair. **Status: MISSING.** GSD runs tests only during verification phase, not after every individual edit within execution.
- **Repo map via tree-sitter + PageRank:** Extracts function signatures, ranks by dependency importance, fits into ~1k token budget. The innovation GSD is already planning to replicate. **Status: PLANNED (AST-03).** In v7.0 roadmap.
- **Auto-commit per edit with attribution:** Every successful edit gets its own commit with "(aider)" attribution. Creates a clean audit trail. **Status: PARTIALLY COVERED.** GSD commits per plan, not per edit. Attribution planned (QUAL-02).
- **Dirty file protection:** Commits dirty files before making changes to separate human edits from AI edits. **Status: PLANNED (GIT-02).** In v7.0 roadmap.
- **Undo per change (`/undo`):** Instantly reverts the last AI edit. Trivial because each edit is its own commit. **Status: PARTIALLY COVERED.** GSD has rollback-info but it's informational, not single-edit granular.
- **Convention file support (`.aider.conventions.md`):** Users specify coding conventions in a file that aider includes in every edit context. **Status: COVERED.** GSD's CONVENTIONS.md from codebase mapper serves this purpose.

**Source confidence:** HIGH — Official aider docs (aider.chat) verified directly.

### 3. SWE-agent / SWE-bench (NeurIPS 2024)

**What it is:** Autonomous coding agent with custom Agent-Computer Interface (ACI) designed for issue resolution. 74%+ on SWE-bench verified.

**Key capabilities:**
- **Custom ACI tools over raw bash:** Instead of exposing full bash, provides simplified tools: `open_file`, `goto_line`, `edit_file`, `search_dir`, `find_file`, `scroll_down/up`. Simple actions with few options. **Status: NOT APPLICABLE.** GSD operates inside Claude Code, which already has its own tool interface (Read, Edit, Write, Bash, Grep, Glob). GSD doesn't control the ACI.
- **Edit-with-linter guard:** Every edit passes through a linter. Syntax errors are caught *at edit time*, forcing the agent to fix before proceeding. Prevents compounding mistakes from a single bad edit. **Status: MISSING.** This is the key SWE-agent innovation. When an edit introduces a syntax error, the edit is rejected before the agent moves on. GSD has no equivalent.
- **Restricted search output length:** Search results are truncated to prevent context overflow. Only relevant file fragments returned, not full files. **Status: PARTIALLY COVERED.** GSD's repo map (planned) will do this, but there's no truncation guard on search results during execution today.
- **Thought-action-observation loop:** At each step, agent generates a thought (reasoning), then a command, then observes output. Explicit reasoning trace. **Status: PARTIALLY COVERED.** Claude Code's extended thinking provides this natively. GSD doesn't add structure to it.
- **Stuck-in-loop detection:** SWE-EVO benchmark identified a failure mode where agents repeatedly read files or rerun tests without making progress. Detection enables recovery. **Status: MISSING.** GSD has no stuck detection. If a subagent loops, it burns tokens until context limit.

**Source confidence:** HIGH — NeurIPS 2024 proceedings, SWE-EVO arxiv paper, official GitHub repo.

### 4. Devin / Cognition

**What it is:** Autonomous AI software engineer with cloud IDE, interactive planning, and self-verification.

**Key capabilities:**
- **Interactive planning with plan modification:** Devin presents a preliminary plan with relevant files and findings. User modifies the plan before execution. **Status: COVERED.** GSD's plan-checker + human approval cycle does this.
- **Self-review autofix loop (Devin 2.2):** After writing code, Devin reviews its own output, catches issues, and fixes them — all before the user sees the PR. Plans → codes → reviews own output → fixes. **Status: MISSING as self-loop.** GSD's reviewer is a *separate* agent (which is actually better for quality — writer/reviewer separation). But GSD doesn't have the executor self-checking before handing to reviewer.
- **Computer-use testing (Devin 2.2):** After creating a PR, Devin launches the app on its Linux desktop and runs through it visually, sending screen recordings. Tests desktop apps, not just web. **Status: NOT APPLICABLE.** GSD is a CLI tool orchestrating Claude Code. Browser/desktop testing is outside scope.
- **Parallel Devin sessions:** Multiple independent agents working on different tasks simultaneously, each with its own IDE. **Status: COVERED.** GSD's worktree parallelism achieves this.
- **Devin Search (agentic codebase Q&A):** Ask questions about the codebase, get cited answers. Deep mode for extensive exploration. **Status: NOT DIRECTLY APPLICABLE.** Claude Code already has this natively via grep/read tools.
- **Auto-generated wiki from repo:** Automatically indexes repos, creates architecture diagrams and docs. **Status: PARTIALLY COVERED.** GSD's codebase mapper generates docs but not auto-updating wiki.
- **Code review as bottleneck insight:** Cognition identified that "code review, not code generation, is now the bottleneck." Built Devin Review: intelligent diff organization, grouped changes, severity-rated issues (red/yellow/gray). **Status: ALIGNS WITH GSD DIRECTION.** GSD's reviewer agent targets this. The severity rating pattern is worth adopting.

**Source confidence:** HIGH — Official Cognition blog posts (Devin 2.0, 2.2, Devin Review) verified directly.

### 5. OpenHands (formerly OpenDevin — 64k+ GitHub stars, ICLR 2025)

**What it is:** Open-source SDK for building software agents with event-sourced state, sandboxed execution, and typed tool system.

**Key capabilities:**
- **Event-sourced state with deterministic replay:** All interactions are immutable events in a log. State can be replayed, recovered, and inspected. Single source of truth. **Status: PARTIALLY COVERED.** GSD uses STATE.md + git history, which is file-based state management. Not event-sourced, but achieves durability through git.
- **Stuck detection:** Detects when an agent is looping (repeatedly reading files or rerunning tests without progress). **Status: MISSING.** Same gap as SWE-agent. Multiple systems have this; GSD doesn't.
- **Context condensation (conversation compaction):** LLMSummarizingCondenser summarizes old events when context grows too large. Reduces costs by up to 2× with no performance degradation. **Status: PLANNED (CTX-03).** In v7.0 roadmap.
- **Security analyzer + confirmation policy:** Every tool call gets a risk rating (low/medium/high). Actions above threshold require user confirmation. Dynamic trust adjustment. **Status: NOT DIRECTLY APPLICABLE.** GSD runs inside Claude Code, which has its own permission model. But the *pattern* of risk-rating agent actions is relevant.
- **Multi-LLM routing via RouterLLM:** Agent selects different models per request based on content (e.g., images → multimodal model, text → cheap model). **Status: PLANNED (ORCH-02).** GSD's model routing is in v7.0 roadmap.
- **Typed tool system (Action → Execution → Observation):** Every tool has validated input schema, execution logic, and structured output. Type-safe, MCP-compatible. **Status: NOT APPLICABLE.** GSD is a CLI tool producing data, not a tool execution framework.
- **Sub-agent delegation as a tool:** Parent spawns independent child conversations that inherit config but run in isolation. Blocking parallel execution. **Status: COVERED.** GSD's execute-phase already does subagent spawning.
- **Pause/resume agent execution:** Agent can be paused mid-execution, state persisted, resumed later from exact point. **Status: PARTIALLY COVERED.** GSD's checkpoint protocol allows session continuity, but not mid-plan pause/resume within a single agent invocation.
- **Long-term memory across sessions:** Persistent context that carries across agent sessions. **Status: COVERED.** GSD's STATE.md + accumulated context is purpose-built for this.

**Source confidence:** HIGH — ICLR 2025 paper, OpenHands SDK paper (arxiv:2511.03690v1) verified directly.

### 6. Review Gate Hardening Patterns

**Sources:** Propel's guardrails framework, Vadim's Verification Gate (research-backed), Anthropic's 2026 Agentic Coding Trends Report.

**Key patterns discovered:**

#### Pattern A: Risk-Tiered Review Gates
Changes categorized by risk level; review intensity scales with risk.

| Tier | Examples | Review Gate | Required Proof |
|------|----------|-------------|----------------|
| Low | Docs, refactors, low blast radius | AI review only | Lint + unit tests |
| Medium | Business logic changes | AI review + human approval | Integration tests |
| High | Auth, billing, data access | AI review + AppSec sign-off | Security checks |

**GSD status: MISSING.** GSD's verifier treats all changes equally. No risk tiering.

#### Pattern B: Four-Verdict System (Accept / Accept-with-Warnings / Reject / Partial)
Not binary pass/fail. Changes can partially pass: accept the good parts, queue failures for retry.

**GSD status: PARTIALLY COVERED.** GSD has A-F scoring, but no partial-accept pattern where some tasks in a plan pass review and others get sent back.

#### Pattern C: Confidence-Scored Verification
Every verification produces a confidence score (0.0-1.0). Low-confidence verifications are treated differently. Overall confidence reflects the weakest check, not the average.

**GSD status: MISSING.** GSD's verifier produces pass/fail + grade, but no explicit confidence score on its own verification quality.

#### Pattern D: Counterfactual Analysis
For every change, ask: "What if this weren't made? What if applied incorrectly? Is there a simpler alternative?" Prevents over-engineering and unnecessary changes.

**GSD status: MISSING.** GSD verifier checks goal achievement but doesn't question necessity.

#### Pattern E: Five-Check Verification Trajectory
1. Coherence — does modified file make internal sense?
2. Cross-concern — does change conflict with other components?
3. Convention — does code follow project conventions?
4. Regression — did fix break neighboring code?
5. Build — do lint + build pass?

**GSD status: PARTIALLY COVERED.** GSD verifier covers goal-achievement and some convention checking. Missing coherence, regression, and build checks as explicit verification steps.

#### Pattern F: Feedback Loop (not single-pass review)
Agent fixes issue → re-runs tests → submits update for re-evaluation. Loop until passing. Not "one review, done."

**GSD status: MISSING.** GSD's review is single-pass (reviewer → findings → human decides). No automatic fix-and-resubmit loop.

---

## Capability Matrix

| Capability | Superpowers | Aider | SWE-agent | Devin | OpenHands | GSD Status |
|-----------|-------------|-------|-----------|-------|-----------|------------|
| Brainstorm→plan→execute discipline | ✅ Mandatory | ✅ architect/code modes | ❌ | ✅ Interactive planning | ❌ | ✅ COVERED |
| Per-task subagent isolation | ✅ Fresh per task | ❌ Single agent | ❌ Single agent | ✅ Parallel Devins | ✅ Sub-agent delegation | ⚠️ PARTIAL |
| Two-stage review (spec + quality) | ✅ Core feature | ❌ | ❌ | ✅ Self-review | ❌ | ⚠️ PARTIAL |
| TDD enforcement | ✅ RED-GREEN strict | ❌ | ❌ | ❌ | ❌ | ❌ MISSING |
| Anti-pattern reference library | ✅ Testing anti-patterns | ❌ | ❌ | ❌ | ❌ | ❌ MISSING |
| Auto lint-after-edit | ❌ | ✅ Built-in | ✅ Edit-time linter | ❌ | ❌ | ❌ MISSING |
| Auto test-after-edit | ❌ | ✅ --auto-test | ✅ Test loop | ✅ Self-verify | ❌ | ❌ MISSING |
| Edit-test-fix loop | ❌ | ✅ Auto-fix on failure | ✅ Core loop | ✅ Autofix (2.2) | ❌ | ❌ MISSING |
| Stuck detection | ❌ | ❌ | ✅ Identified pattern | ❌ | ✅ Built-in | ❌ MISSING |
| Repo map (AST signatures) | ❌ | ✅ Pioneered | ❌ | ❌ | ❌ | ⏳ PLANNED |
| Risk-tiered review | ❌ | ❌ | ❌ | ✅ Severity levels | ❌ | ❌ MISSING |
| Confidence-scored verification | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ MISSING |
| Context condensation | ❌ | ❌ | ❌ | ❌ | ✅ Built-in | ⏳ PLANNED |
| Model routing | ❌ | ✅ architect/editor | ❌ | ❌ | ✅ RouterLLM | ⏳ PLANNED |
| Commit attribution | ❌ | ✅ "(aider)" tag | ❌ | ❌ | ❌ | ⏳ PLANNED |
| Dirty file protection | ❌ | ✅ Core feature | ❌ | ❌ | ❌ | ⏳ PLANNED |
| Convention file support | ❌ | ✅ .aider.conventions.md | ❌ | ❌ | ❌ | ✅ COVERED |

---

## Missing High-Impact Features

### 🔴 CRITICAL: Automatic Lint/Test After Edit with Fix Loop

**What it does:** After every code edit (not just at verification), automatically runs lint and/or tests. If they fail, sends errors back to the agent for immediate fix. This is the edit→test→fix cycle that Aider, SWE-agent, and Devin all implement.

**Why it matters:** Currently, GSD's executor writes code across an entire plan, then the verifier checks at the end. If early edits break things, later edits compound on broken code. Catching errors immediately after each edit prevents error cascading — the #1 cause of AI code quality issues.

**Impact:** HIGH — Prevents the most common failure mode in agentic coding (compounding errors from one bad edit)

**Feasibility in GSD:** HIGH — Can be added to execute-plan workflow as a post-edit instruction. GSD doesn't need to implement a linter — it instructs the executor agent to run `npm test` / lint after each file modification and fix failures before proceeding. This is a *workflow instruction*, not a CLI feature.

**Recommendation:** ADD NOW — Add to execute-plan workflow as mandatory post-edit verification instruction. Zero CLI changes needed. Just workflow text.

---

### 🔴 CRITICAL: Stuck/Loop Detection

**What it does:** Detects when an agent is repeatedly performing the same actions without progress (re-reading same files, re-running failing tests without code changes, rewriting the same code). Triggers recovery: escalate, backtrack, or abort.

**Why it matters:** Without this, a stuck subagent burns tokens until context exhaustion. OpenHands and SWE-EVO both identified "stuck in loop" as a top failure mode. Reddit users report OpenHands "lacks a proper backtracking orchestrator" as its biggest weakness — this is a known industry problem.

**Impact:** HIGH — Directly prevents token waste and stuck sessions

**Feasibility in GSD:** MEDIUM — Could be implemented as:
1. **Workflow instruction** (low effort): Tell executor "if you've attempted the same fix 3 times without tests passing, stop and report the issue"
2. **CLI detection** (medium effort): Track edit patterns in git history. If last N commits touch the same file with similar diffs, flag as stuck.

**Recommendation:** ADD NOW (workflow instruction) + PLAN (CLI detection for v7.x)

---

### 🟡 HIGH-VALUE: Two-Stage Review (Spec Compliance + Code Quality)

**What it does:** Superpowers' core innovation. After each task, review happens in two stages:
1. **Spec compliance:** Does the output match what the plan specified? Right files, right behavior, right tests.
2. **Code quality:** Is the code clean, well-structured, following conventions?

These are different concerns — a change can be exactly what was requested but poorly coded, or beautifully coded but missing the point.

**Why it matters:** GSD's planned reviewer (QUAL-01) checks conventions but doesn't explicitly verify spec compliance. The spec-first check catches the more dangerous failure mode: building the wrong thing well.

**Impact:** HIGH — Catches "correct code, wrong feature" errors that convention-only review misses

**Feasibility in GSD:** HIGH — The reviewer agent's reference file can structure the review into two sections: (1) Does the diff satisfy the plan task requirements? (2) Does the code follow CONVENTIONS.md? Requires reading the PLAN.md task alongside the diff.

**Recommendation:** ADD NOW — Modify the gsd-reviewer agent reference to include both review stages. The reviewer already has access to plan files and diffs. Just structure the review prompt.

---

### 🟡 HIGH-VALUE: Risk-Tiered Review Gates

**What it does:** Not all changes need the same scrutiny. Risk is assessed based on blast radius (file count, module boundaries crossed), sensitivity (auth, data, billing), and test coverage. Low-risk changes get AI-only review. High-risk changes require human approval.

**Why it matters:** Currently GSD applies the same review process to all changes. A doc typo fix and a payment system rewrite get identical treatment. This either under-reviews critical changes or over-reviews trivial ones.

**Impact:** HIGH — Right-sizes review effort, prevents critical changes from getting rubber-stamped

**Feasibility in GSD:** MEDIUM — The orchestrator (ORCH-01 task classification) already plans to score task complexity 1-5. Extend this: complexity score → review tier. Score ≤2 → advisory review. Score 3-4 → blocking review. Score 5 → blocking + human approval required.

**Recommendation:** ADD to Phase 41 (Quality Gates) — Natural extension of ORCH-01 complexity scoring. Add `review_tier` field to task classification output that the reviewer workflow consumes.

---

### 🟡 HIGH-VALUE: Confidence-Scored Verification

**What it does:** Every verification check produces a confidence score (0.0-1.0) reflecting how thoroughly the verifier could actually check. "I found no issues but couldn't verify runtime behavior" = 0.6. "All tests pass, conventions followed, spec met" = 0.95. Overall score reflects weakest link.

**Why it matters:** GSD's A-F grading is a quality assessment of the *code*. This is different — it's the verifier's assessment of its *own verification quality*. A low-confidence "A" is more dangerous than a high-confidence "B" because it means the A might be wrong.

**Impact:** MEDIUM-HIGH — Prevents false confidence in verification results

**Feasibility in GSD:** MEDIUM — The verifier workflow can be modified to output confidence alongside grade. Structure: for each check (goal achievement, test coverage, convention compliance, regression), report individual confidence + overall. Aggregate using min-of-components (weakest-link model).

**Recommendation:** ADD to Phase 41 — Extend verifier output format to include confidence scores. Workflow change + minor CLI output format change.

---

### 🟡 MEDIUM-VALUE: Review Fix-and-Resubmit Loop

**What it does:** When reviewer finds issues, instead of just reporting them, the system loops: reviewer identifies issues → executor fixes → reviewer re-checks → until passing or max iterations reached.

**Why it matters:** GSD's current flow: reviewer reports → human reads → human decides → maybe re-executes manually. This adds friction and delays. Auto-looping for minor issues (lint violations, missing test cases, convention breaches) saves time.

**Impact:** MEDIUM — Reduces human intervention for mechanical fixes

**Feasibility in GSD:** MEDIUM — Execute-plan workflow can be extended: after reviewer findings, if all issues are "mechanical" (not architectural), automatically re-execute with findings as additional instructions. Cap at 2 iterations to prevent loops. Requires the reviewer to classify issue severity (critical=stop, minor=autofix).

**Recommendation:** DEFER to v7.x — Depends on reviewer being built first. Add as enhancement after Phase 41.

---

### 🟢 MODERATE-VALUE: TDD Enforcement in Executor

**What it does:** Superpowers enforces RED→GREEN→REFACTOR: write a failing test first, verify it fails, write code to make it pass, verify it passes, commit. If code is written before tests, the code gets deleted.

**Why it matters:** Test-first development produces more testable designs and catches issues earlier. When agents skip tests or write them after the fact, test quality degrades.

**Impact:** MEDIUM — Improves test quality but adds execution overhead

**Feasibility in GSD:** HIGH — Purely a workflow instruction change. Add to execute-plan workflow: "For implementation tasks: (1) Write a failing test first. (2) Run it — confirm failure. (3) Write code to pass. (4) Run test — confirm pass. (5) Commit." The executor agent will follow this if instructed clearly enough.

**Recommendation:** ADD NOW (optional) — Add as a toggle in plan metadata. Plans can specify `tdd: true` for implementation-heavy work. Don't enforce for all tasks (research, config, docs don't need TDD).

---

### 🟢 MODERATE-VALUE: Anti-Pattern Reference Library

**What it does:** Superpowers includes a reference document of common testing anti-patterns that Claude reads before writing tests. Prevents known bad patterns proactively rather than catching them in review.

**Why it matters:** Preventive is cheaper than corrective. Rather than reviewing code and finding anti-patterns, give the agent a "don't do this" list upfront.

**Impact:** MEDIUM — Reduces common mistakes but doesn't catch novel issues

**Feasibility in GSD:** HIGH — Create an anti-patterns section in CONVENTIONS.md or as a separate reference file. Load it into executor context alongside conventions. Zero CLI changes.

**Recommendation:** ADD NOW — Trivial to implement. Create a reference file. Add to executor context manifest.

---

### 🟢 LOW-VALUE: Counterfactual Analysis in Verification

**What it does:** For every change, the verifier asks: "What if this change weren't made? What if applied incorrectly? Is there a simpler alternative?" Prevents unnecessary changes and over-engineering.

**Why it matters:** Agents sometimes make changes that aren't needed or are more complex than necessary. This forces justification.

**Impact:** LOW-MEDIUM — Catches over-engineering but adds verification time

**Feasibility in GSD:** HIGH — Add to verifier workflow prompt: "For each significant change, consider: (1) Is this change necessary? (2) What's the blast radius if it breaks? (3) Is there a simpler approach?" Purely prompt-level.

**Recommendation:** DEFER — Nice to have but low priority compared to other gaps. Consider for v7.x verifier enhancement.

---

## Review Gate Hardening Patterns

### Current State: GSD's Review System

GSD's planned review pipeline (Phase 41):
```
Execute → Reviewer checks diff vs CONVENTIONS.md → Findings in SUMMARY.md → Human reads
```

This is **advisory-only**: findings are reported but don't gate anything.

### Recommended Hardening Path

#### Stage 1: Advisory with Structure (Phase 41 — already planned)
```
Execute → Two-stage review (spec + quality) → Findings with severity (critical/warning/info)
                                              → Confidence score per check
                                              → Human reads & decides
```
Changes from current plan:
- Add spec compliance check (not just conventions)
- Add severity classification
- Add confidence scoring

#### Stage 2: Soft Gating (v7.x enhancement)
```
Execute → Review → If critical findings → Block auto-completion, require explicit override
                 → If warnings only → Auto-complete with warnings logged
                 → If clean → Auto-complete
```
The reviewer's findings now *influence* the pipeline flow, but human can always override.

**Escape hatch:** `GSD_REVIEW_OVERRIDE=1` environment variable or explicit user command to bypass blocking review for false positives.

#### Stage 3: Hard Gating (v8.0+)
```
Execute → Review → If critical findings → Block + auto-fix loop (max 2 iterations)
                                        → If still failing → Block + require human
                 → If warnings → Log + proceed
```
The reviewer now actively gates progression. Fix-and-resubmit loop handles mechanical issues automatically.

**Escape hatch:** False positive tracking. If a user overrides a specific finding type 3+ times, the system learns to downgrade it from critical to warning.

### Confidence Thresholds for Gating

| Verification Confidence | Review Severity | Action |
|--------------------------|----------------|--------|
| ≥ 0.8 | Clean | Auto-proceed |
| ≥ 0.8 | Warnings | Proceed with logged warnings |
| ≥ 0.8 | Critical | Block, require fix or override |
| 0.5-0.8 | Any | Advisory only (confidence too low to gate) |
| < 0.5 | Any | Flag for human review (verifier unsure) |

Key principle: **Never gate on low-confidence verification.** A gate that the verifier isn't sure about creates noise and erodes trust.

---

## Recommendations Summary

### ADD NOW (v7.0 — workflow changes, zero/minimal CLI changes)

| # | Capability | Source | Effort | Impact |
|---|-----------|--------|--------|--------|
| 1 | Auto lint/test after edit instruction | Aider, SWE-agent | LOW (workflow text) | HIGH |
| 2 | Stuck detection instruction | OpenHands, SWE-agent | LOW (workflow text) | HIGH |
| 3 | Two-stage review (spec + quality) | Superpowers | LOW (reviewer reference) | HIGH |
| 4 | Anti-pattern reference library | Superpowers | LOW (reference file) | MEDIUM |
| 5 | TDD enforcement option | Superpowers | LOW (workflow text) | MEDIUM |

**Total effort: ~2 hours of workflow/reference file editing. No CLI code changes.**

These are all *workflow intelligence* — making the existing agents smarter through better instructions, not building new CLI features.

### ADD to v7.0 PHASES (requires CLI work)

| # | Capability | Phase | Effort | Impact |
|---|-----------|-------|--------|--------|
| 6 | Risk-tiered review gates | Phase 41 | MEDIUM (extend ORCH-01 output) | HIGH |
| 7 | Confidence-scored verification | Phase 41 | MEDIUM (verifier output format) | MEDIUM-HIGH |
| 8 | Severity-classified review findings | Phase 41 | LOW (reviewer output format) | HIGH |

### DEFER to v7.x or v8.0

| # | Capability | Why Defer | Impact |
|---|-----------|-----------|--------|
| 9 | Review fix-and-resubmit loop | Needs reviewer built first | MEDIUM |
| 10 | CLI-level stuck detection | Needs git pattern analysis | HIGH (but workflow instruction covers 80%) |
| 11 | Counterfactual analysis | Low priority vs other gaps | LOW-MEDIUM |
| 12 | Partial-accept for multi-task reviews | Complex orchestration change | LOW |

### SKIP (out of scope or already covered differently)

| # | Capability | Why Skip |
|---|-----------|----------|
| — | Custom ACI tools | Claude Code controls this, not GSD |
| — | Event-sourced state | GSD's git-backed state achieves same durability |
| — | Sandbox execution | Claude Code runs on user machine, not sandboxed |
| — | Browser/desktop testing | CLI tool scope — not an IDE |
| — | Skill authoring framework | GSD is a CLI tool, not a plugin framework |
| — | Auto-updating wiki | Devin-specific feature, not needed in CLI workflow |

---

## Key Insight

The most impactful missing capabilities are **not CLI features** — they're **workflow instructions**. The five "ADD NOW" items require no code changes. They're improvements to how GSD *instructs* the executor, verifier, and reviewer agents.

This aligns with GSD's architecture: the CLI produces data, workflows produce behavior. The biggest capability gaps are in behavior (what agents are told to do), not in data (what the CLI computes).

**The single highest-ROI change is adding "run tests after each file modification and fix failures before proceeding" to the execute-plan workflow.** This one instruction addresses the most common failure mode across all agentic coding systems.

---

## Sources

- Superpowers GitHub: https://github.com/obra/superpowers (PRIMARY, HIGH)
- obra blog (Oct 2025): https://blog.fsck.com/2025/10/09/superpowers/ (PRIMARY, HIGH)
- Aider chat modes: https://aider.chat/docs/usage/modes.html (PRIMARY, HIGH)
- Aider lint/test: https://aider.chat/docs/usage/lint-test.html (PRIMARY, HIGH)
- SWE-agent NeurIPS 2024: https://arxiv.org/abs/2405.15793 (PRIMARY, HIGH)
- SWE-EVO benchmark: https://arxiv.org/pdf/2512.18470 (PRIMARY, HIGH)
- Devin 2.0: https://cognition.ai/blog/devin-2 (PRIMARY, HIGH)
- Devin 2.2: https://cognition.ai/blog/introducing-devin-2-2 (PRIMARY, HIGH)
- Devin Review: https://cognition.ai/blog/devin-review (PRIMARY, HIGH)
- OpenHands SDK paper: https://arxiv.org/html/2511.03690v1 (PRIMARY, HIGH)
- OpenHands ICLR 2025: https://arxiv.org/abs/2407.16741 (PRIMARY, HIGH)
- Propel guardrails: https://www.propelcode.ai/blog/agentic-engineering-code-review-guardrails (SECONDARY, HIGH)
- Verification Gate research: https://vadim.blog/verification-gate-research-to-practice (SECONDARY, HIGH)
- Anthropic 2026 Agentic Coding Trends: Referenced via tessl.io summary (SECONDARY, MEDIUM)

---
*Agentic Capabilities Audit for: bGSD Plugin v7.0 Extending Milestone*
*Audited: 2026-02-27*
