# Research & Competitive Analysis

How bGSD approaches research, what competitive systems were analyzed, and the key findings that shaped the architecture.

---

## Research Methodology

bGSD uses structured research at two levels:

### Project-Level Research

Before each milestone, 4 parallel researcher agents investigate the domain:

| Researcher | Focus | Output |
|-----------|-------|--------|
| Stack researcher | Technology choices, dependencies, bundling | `research/STACK.md` |
| Features researcher | Feature analysis, competitive landscape | `research/FEATURES.md` |
| Architecture researcher | Design patterns, module structure, data flows | `research/ARCHITECTURE.md` |
| Pitfalls researcher | Known problems, anti-patterns, failure modes | `research/PITFALLS.md` |

A synthesis agent merges all findings into `research/SUMMARY.md` with confidence ratings.

### Phase-Level Research

Before individual phases, an optional researcher investigates specific implementation approaches:

- Ecosystem standard approaches
- Library APIs and integration patterns
- Known pitfalls and gotchas
- Recommended implementations

---

## Competitive Audit

Six agent systems were analyzed to identify capability gaps and validate architectural decisions.

### Systems Analyzed

#### 1. Superpowers (obra/superpowers)

A skills framework for Claude Code enforcing brainstorm-plan-implement-review workflow. 64.5k GitHub stars.

**Key innovations adopted by bGSD:**
- **Two-stage code review** — Spec compliance check, then code quality check (adopted in Phase 44)
- **RED-GREEN TDD enforcement** — Strict test-first cycle with code deletion for violations (adopted in Phase 43)
- **Anti-pattern reference library** — Proactive mistake prevention (adopted in Phase 43)

**Key innovations not adopted:**
- Pressure-tested skill compliance via adversarial scenarios — not applicable to CLI tool
- Skill authoring meta-skill — not applicable to CLI tool

---

#### 2. Aider

Terminal-based AI pair programmer with deep git integration and repo map innovation.

**Key innovations adopted by bGSD:**
- **Repo map via AST signatures** — Function signatures ranked by importance in ~1k token budget (adopted in Phase 38)
- **Auto test-after-edit with fix loop** — Tests run after every change, failures sent back for repair (adopted in Phase 43)
- **Commit attribution** — Agent type tagged in commit metadata (adopted in Phase 41)
- **Dirty file protection** — Pre-commit safety checks (adopted in Phase 37)

**Key innovations not adopted:**
- Three chat modes (code/ask/architect) — bGSD has planner/executor separation which serves same purpose
- Automatic lint-after-edit — considered but deferred; test-after-edit covers the critical case

---

#### 3. SWE-agent (NeurIPS 2024)

Autonomous coding agent with custom Agent-Computer Interface. 74%+ on SWE-bench verified.

**Key innovations adopted by bGSD:**
- **Edit-with-linter guard** — Syntax errors caught at edit time (informed Phase 43 auto-test design)
- **Stuck-in-loop detection** — Agent repeatedly performing same actions without progress (adopted in Phase 44)

**Key innovations not adopted:**
- Custom ACI tools — Claude Code already has its own tool interface
- Thought-action-observation loop — Claude Code's extended thinking provides this natively

---

#### 4. Devin / Cognition

Autonomous AI software engineer with cloud IDE and self-verification.

**Key innovations adopted by bGSD:**
- **Severity-rated review findings** — Red/yellow/gray severity classification (adopted in Phase 44 as BLOCKER/WARNING/INFO)
- **Code review as bottleneck insight** — "Code review, not generation, is now the bottleneck" (validated bGSD's reviewer direction)

**Key innovations not adopted:**
- Computer-use testing — Outside CLI tool scope
- Self-review autofix loop — bGSD uses separate reviewer agent (writer/reviewer separation is better for quality)

---

#### 5. OpenHands (ICLR 2025)

Open-source SDK for building software agents. 64k+ GitHub stars.

**Key innovations adopted by bGSD:**
- **Stuck detection** — Detects looping agents and triggers recovery (adopted in Phase 44)
- **Context condensation** — Summarizes old events when context grows large (informed context efficiency work in Phase 40)

**Key innovations not adopted:**
- Event-sourced state — bGSD's git-backed state achieves same durability through simpler means
- Security analyzer with risk rating — Claude Code has its own permission model

---

#### 6. Review Gate Patterns (Propel, Vadim, Anthropic)

Research-backed review gate design patterns.

**Patterns adopted:**
- **Risk-tiered review** — Review intensity scales with change risk (informed Phase 44)
- **Severity classification** — Not binary pass/fail; graduated findings (adopted in Phase 44)
- **Feedback loop** — Fix-and-resubmit for mechanical issues (planned for future)

---

## Capability Matrix

| Capability | Aider | SWE-agent | Devin | OpenHands | Superpowers | bGSD |
|-----------|-------|-----------|-------|-----------|-------------|------|
| Brainstorm→plan→execute | -- | -- | Yes | -- | Yes | **Yes** |
| Per-task agent isolation | -- | -- | Yes | Yes | Yes | **Yes** |
| Two-stage review | -- | -- | Yes | -- | Yes | **Yes** |
| TDD enforcement | -- | -- | -- | -- | Yes | **Yes** |
| Auto test-after-edit | Yes | Yes | Yes | -- | -- | **Yes** |
| Stuck detection | -- | Yes | -- | Yes | -- | **Yes** |
| Repo map (AST) | Yes | -- | -- | -- | -- | **Yes** |
| Model routing | Yes | -- | -- | Yes | -- | **Yes** |
| Commit attribution | Yes | -- | -- | -- | -- | **Yes** |
| Convention file support | Yes | -- | -- | -- | -- | **Yes** |
| Risk-tiered review | -- | -- | Yes | -- | -- | **Yes** |
| Context condensation | -- | -- | -- | Yes | -- | **Yes** |
| Wave-based parallel execution | -- | -- | -- | -- | -- | **Yes** |
| Milestone-driven development | -- | -- | -- | -- | -- | **Yes** |
| Quality scoring (A-F) | -- | -- | -- | -- | -- | **Yes** |
| Intent drift detection | -- | -- | -- | -- | -- | **Yes** |

---

## Key Research Findings

### 1. Intelligence as Data, Not Agents

DeepMind scaling research shows coordination overhead grows quadratically with agent count. Error amplification reaches 17x in unstructured networks. The correct approach is fewer agents with better data, not more specialized agents.

**bGSD response:** Hard cap at 12 agent roles. New capabilities delivered as CLI data for existing agents.

### 2. Human-in-the-Loop is Correct

- **LinearB data:** 67% AI PR rejection rate
- **DORA 2025:** 9% more bugs from autonomous AI coding
- **Gas Town incident:** Production DB down 2 days from autonomous agent
- **Cursor experiment:** Equal-status 20-agent architecture failed

**bGSD response:** All operations are advisory. Human approves plans before execution. Safety gates on destructive operations.

### 3. Context Rot is Real

- **Chroma research:** Larger contexts degrade LLM recall accuracy
- **16x Engineer evaluation:** 11/12 models score <50% accuracy at 32k tokens
- **Anthropic guidance:** "The smallest possible set of high-signal tokens"

**bGSD response:** Agent context manifests limit what agents receive. Compact serialization reduces tokens 40-60%. Task-scoped injection loads only relevant files.

### 4. Review is the Bottleneck

Code generation is effectively solved. Code review — catching wrong implementations, convention violations, and architectural drift — is where quality breaks down.

**bGSD response:** Dedicated gsd-reviewer with two-stage review (spec compliance + code quality), severity classification, and graduated enforcement.

### 5. Test-After-Edit Prevents Error Cascading

The most common failure mode in agentic coding is compounding errors from one bad edit. Running tests immediately after each modification catches problems before they cascade.

**bGSD response:** Auto test-after-edit instruction in executor workflow. TDD enforcement for implementation-heavy plans.

---

## Pitfalls Research

13 pitfalls were identified across critical/moderate/minor severity with prevention strategies. Key pitfalls that shaped the architecture:

### Critical Pitfalls

1. **State validation false positives** — Validation must handle mid-execution, archival, manual commits, and pause/resume states. Prevention: advisory-only mode, enumerate all valid transitions before coding.

2. **Memory bloat** — Without controlled forgetting, memory degrades from signal to noise. Prevention: 500-token budget, 3-category TTL system (position/decisions/codebase), STATE.md always authoritative.

3. **Plans too granular** — Decomposition rules that are too rigid create bureaucratic overhead. Prevention: heuristics over hard rules, context-budget thresholds not file-count limits.

4. **Verification taking longer than the work** — Per-plan verification is wasteful for trivial plans. Prevention: tiered verification (light/standard/deep), tests run per-phase not per-plan by default.

5. **Integration tests testing implementation** — Snapshot fragility, git non-determinism, cascade failures. Prevention: behavioral assertions, deterministic fixtures, separate test runner.

6. **Bundle bloat from dependencies** — WASM breaks single-file deploy, ESM-only packages fail bundling. Prevention: pre-check protocol, prefer micro-libraries, measure bundle size not package size.

### Key Cross-Cutting Risks

| Feature A | Feature B | Risk | Prevention |
|-----------|-----------|------|------------|
| State validation | Memory | Circular dependency | STATE.md is always authoritative; load state first |
| Decomposition | Verification | N× more plans = N× more verification | Verify at phase level, not plan level |
| Memory | Decomposition | Plan renumbering breaks memory references | Reference by content hash, not number |

---

## Research Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Stack choices | HIGH | npm registry verification, bundlephobia API, direct testing |
| Feature priorities | HIGH | 6+ competitive systems cross-referenced with primary sources |
| Architecture patterns | HIGH | Direct inspection of 34 existing source modules |
| Pitfall identification | HIGH | Real failure cases (Gas Town, Cursor, bGSD's own v6.0 --raw incident) |
| Token savings estimates | MEDIUM | Extrapolated from Chrome DevTools pattern; empirically validated at 40-60% |
| Orchestration heuristics | MEDIUM | Framework provided; thresholds need iterative refinement |

---

## Sources

### Primary (HIGH confidence)
- Anthropic context engineering guidance (Sep 2025)
- Claude Code Agent Teams documentation
- Aider official documentation (aider.chat)
- SWE-agent NeurIPS 2024 proceedings
- Devin/Cognition blog posts (2.0, 2.2, Devin Review)
- OpenHands ICLR 2025 paper and SDK paper
- DeepMind scaling agent systems (arxiv)
- GitHub multi-agent engineering blog
- acorn npm registry and bundlephobia verification

### Secondary (MEDIUM confidence)
- Chrome DevTools AI assistance blog (compact serialization pattern)
- TU Wien diploma thesis on reducing token usage
- Chroma context rot research
- Propel guardrails framework
- Qodo/CodeRabbit review patterns

---

*For how research findings became architectural decisions, see [Decisions](decisions.md). For the current project state, see `.planning/STATE.md`.*
