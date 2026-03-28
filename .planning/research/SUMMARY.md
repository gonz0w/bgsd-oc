# Project Research Summary

**Project:** bGSD Plugin v16.0 — Enterprise Developer Team
**Domain:** Code review automation, security audit, release management, agent memory, safety guardrails
**Researched:** 2026-03-28
**Confidence:** HIGH

<!-- section: compact -->
<compact_summary>
<!-- The compact summary is the DEFAULT view for orchestrators and planners.
     Keep it under 30 lines. Synthesizes all 4 research areas. -->

**Summary:** Six enterprise developer features (code review, security audit, readiness dashboard, release pipeline, agent memory, destructive command detection) built entirely on existing infrastructure — zero new runtime dependencies, zero new agents. All six extend proven patterns: acorn AST, 41-pattern security scanner, advisory guardrails, memory stores, git.js, and context-builder. Top risk is false positive flood destroying trust in review/security — mitigated by 8/10 confidence gating and exclusion lists from day 1.

**Recommended stack:** acorn (existing, AST analysis), node:sqlite (existing, memory tables), git.js (existing, diff/log/tag), review/severity.js (existing, finding classification), advisory-guardrails.js (existing, plugin interception), skills.js patterns (existing, scanner architecture) — **no new packages**

**Architecture:** CLI-first data generation + agent-second judgment via workflow specialization. Verifier agent handles review + security; executor handles release. Plugin extends for GARD-04 + MEMORY.md injection. ~63KB new source (~25KB minified, +5% bundle).

**Top pitfalls:**
1. FP flood destroys review trust — 8/10 confidence gate + configurable exclusion list from day 1
2. Memory poisoning via prompt injection — frozen-snapshot reads, provenance tagging, sanitization with existing scanner
3. Unicode bypass of command detection — NFKD normalization + zero-width stripping before pattern matching
4. Release automation runaway — dry-run default, confirmation gate, never auto-push tags
5. Dashboard becomes blocking gate — advisory language only; inform, never block (C-03 constraint)

**Suggested phases:** 1) Safety & Memory Foundation (GARD-04 + MEMORY.md), 2) Code Review Workflow, 3) Security Audit Workflow, 4) Dashboard & Release Pipeline

**Confidence:** HIGH | **Gaps:** tool.execute.before hook availability; LLM-assessed approval deferred to v16.x
</compact_summary>
<!-- /section -->

<!-- section: executive_summary -->
## Executive Summary

The v16.0 milestone transforms bGSD from a planning/execution engine into a complete enterprise development team by adding six features: code review with structural audit and auto-fix, security audit with OWASP Top 10 and secrets scanning, a review readiness dashboard, automated release pipeline, structured agent memory for cross-session learning, and destructive command detection. Research confirms all six can be built entirely on existing infrastructure — acorn AST, the 41-pattern security scanner, advisory guardrails, memory stores, git.js, and the context-builder plugin — with zero new runtime dependencies and zero new agents (staying within the 9-agent cap by reusing the verifier and executor agents via specialized workflows).

The recommended approach follows "CLI-first data, agent-second judgment": CLI commands perform deterministic structural analysis (pattern matching, complexity scoring, semver parsing) and produce structured JSON; agents consume this JSON alongside source code to make nuanced judgment calls (prioritization, false positive filtering, batched user questions). This two-pass architecture makes analysis testable and fast while letting agent intelligence improve with better models. The competitive analysis of gstack and hermes-agent validates key patterns: FIX-FIRST review philosophy (auto-fix mechanical issues silently, only ask for judgment calls), 8/10 confidence gating (eliminates alert fatigue), frozen-snapshot memory injection (prevents context drift), and Unicode-normalized destructive command detection.

The primary risk across all features is false positive overload — code review, security scanning, and command detection all face the same trust destruction if they cry wolf. The mitigation is consistent: confidence gating, configurable exclusion lists, advisory-not-blocking output (matching the existing C-03 constraint), and severity-first presentation. Memory poisoning via prompt injection is the second critical risk, addressed by frozen-snapshot reads, provenance tagging, and sanitization using the existing security scanner patterns.
<!-- /section -->

<!-- section: key_findings -->
## Key Findings

### Recommended Stack

All six features build on existing bGSD infrastructure. No new npm packages. Estimated total bundle impact is ~25KB minified (+5% of current ~500KB bundle). The approach mirrors how the existing 52 source modules were built: new `src/commands/` and `src/lib/` files auto-bundled by esbuild with no config changes.

**Core technologies (all existing):**
- **acorn ^8.16.0** (bundled): AST analysis for code review — complexity metrics, dead code detection, export analysis via existing `parseWithAcorn()`, `analyzeComplexity()`, `analyzeExports()`
- **node:sqlite** (Node 22.5+): Persistent agent memory via new migration v6 `agent_memory` table; extends existing schema migration runner in `db.js`
- **git.js** (internal): Diff analysis, changelog generation, tag management — `structuredLog()` already parses conventional commits; `diffSummary()` provides file-level stats
- **review/severity.js** (internal): Finding classification (BLOCKER/WARNING/INFO) — already classifies security, syntax, unused code patterns
- **advisory-guardrails.js** (internal): Plugin-level command interception — GARD-01/02/03 pattern extends to GARD-04 for destructive command detection
- **skills.js SECURITY_PATTERNS** (internal): 41-pattern security scanner with severity-first grouping — architecture extends to OWASP/secrets scanning

**What NOT to use:** semver npm package (24KB for 2 operations we need), conventional-changelog (44KB + 9 deps), eslint-plugin-security (requires ESLint runtime), gitleaks/trufflehog (external binaries), better-sqlite3 (native binary breaks single-file deploy), vector databases (wrong architecture).

### Expected Features

**Must have (table stakes) — what every enterprise AI dev tool offers:**
- Code review: structural audit (dead code, complexity, missing tests) + auto-fix for mechanical issues
- Security audit: OWASP Top 10 mapping + secrets scanning + dependency CVE checks
- Release workflow: semver bump + changelog + git tag + PR creation
- Agent memory: cross-session learning persisted to MEMORY.md, injected at session start
- Destructive command detection: pattern-matching dangerous operations before execution
- Review readiness: pre-ship checklist aggregating test/lint/coverage/TODO status

**Differentiators (competitive advantage):**
- FIX-FIRST review philosophy: auto-fix silently, only ASK for judgment calls (gstack's proven model — 60-80% interruption reduction)
- Confidence-gated security: 8/10 threshold + 17+ false positive exclusions (eliminates alert fatigue)
- Plan-aware code review: scope derived from PLAN.md task files — knows what was supposed to be built
- Frozen-snapshot memory injection: immutable at session start, prevents mid-session context drift (hermes-agent innovation)
- Unicode-normalized command detection: catches homoglyph attacks (Cyrillic 'а' for Latin 'a', zero-width characters)
- Release with plan context: changelog combines git log with SUMMARY.md accomplishments

**Defer (v17+):** Real-time DAST scanning, cross-repo memory federation, automated rollback, SBOM generation, LLM-assessed approval for edge cases, memory compaction with quality scoring.

### Architecture Approach

Extension-based integration into the existing layered CLI + plugin + workflow architecture. Six features delivered as new CLI modules, workflows, plugin enhancements, and skills — zero new agents. The verifier agent handles code review and security audit (verification against quality/security standards). The executor agent handles release pipeline (sequential ordered steps). The readiness dashboard and destructive command detection need no agents (pure CLI and plugin guardrail respectively).

**Major new components:**

| Component | Layer | Responsibility |
|-----------|-------|----------------|
| `src/commands/review.js` (~400 lines) | CLI | Structural audit, anti-pattern detection, auto-fix suggestions |
| `src/commands/security.js` (~400 lines) | CLI | OWASP patterns, secrets scanning, dependency vulnerability checks |
| `src/commands/release.js` (~300 lines) | CLI | Semver bump, changelog generation, git tag, PR creation |
| `src/commands/readiness.js` (~200 lines) | CLI | Test/lint/coverage/TODO aggregation dashboard |
| `workflows/review.md` | Workflow | Code review orchestration (drives verifier agent) |
| `workflows/security-audit.md` | Workflow | Security audit orchestration (drives verifier agent) |
| `workflows/release.md` | Workflow | Release pipeline orchestration (drives executor agent) |
| `advisory-guardrails.js` (extend) | Plugin | GARD-04: destructive command detection |
| `context-builder.js` (extend) | Plugin | MEMORY.md injection into system prompts |
| `memory.js` (extend) | CLI | Structured MEMORY.md read/write/compact |

**Key architectural patterns:**
1. **CLI-first data, agent-second judgment** — deterministic analysis in CLI (testable), nuanced judgment in agent (improvable)
2. **Agent reuse via workflow specialization** — workflows define domain process; agents provide competency
3. **Progressive trust guardrails** — advisory mode first (warn), configurable graduation to blocking
4. **Markdown-as-interface for memory** — human-readable, git-committable, directly injectable into prompts

### Critical Pitfalls

1. **False positive flood destroys review trust** — Industry data shows 36-54% FP rates in pure LLM review. Mitigate: 8/10 confidence gate, configurable exclusion list (`review_exclusions` in config.json), severity tiers (BLOCKER/WARNING/INFO), no linting overlap (skip anything covered by ESLint/Prettier), batched questions (collect uncertain findings, present once).

2. **Memory poisoning via prompt injection** — Research shows >95% injection success rate against agents with persistent memory (MINJA/Palo Alto Unit 42). Mitigate: frozen-snapshot reads (load at session start, write at session end), provenance tagging (source, timestamp, context), sanitization on write (existing 41-pattern scanner), hard 500-token injection cap, structured schema (not freeform text).

3. **Unicode bypass of destructive command detection** — Character injection techniques achieve near-100% evasion of regex guardrails (arxiv:2504.11168). Mitigate: `str.normalize('NFKD')` + strip zero-width characters + strip combining marks before pattern matching. Must be in initial implementation, not retrofitted.

4. **Release automation runaway** — Accidental version bumps, premature releases, and garbage changelogs from non-conventional commits. Mitigate: dry-run by default, confirmation gate before tag creation, commit message validation (warn, not block), changelog filtering (exclude chore/ci/docs), no auto-push of tags.

5. **Dashboard becomes blocking gate** — Violates C-03 advisory constraint when agents interpret "NOT READY" as a precondition. Mitigate: advisory language everywhere ("Consider addressing" not "Must fix"), no binary pass/fail, never block downstream commands, context-aware thresholds.
<!-- /section -->

<!-- section: roadmap_implications -->
## Implications for Roadmap

Based on research, suggested phase structure (4 phases, matching standard depth calibration):

### Phase 1: Safety & Memory Foundation
**Rationale:** Smallest scope features with highest immediate value. GARD-04 is a single-file plugin extension following the exact GARD-01/02/03 pattern. MEMORY.md is independent of all other features but benefits all of them — once memory works, agents learning during review/security/release can persist discoveries.
**Delivers:** Destructive command detection (25+ patterns with Unicode normalization), structured agent memory (MEMORY.md read/write/compact/inject)
**Addresses:** Destructive command detection (FEATURES P1), agent memory (FEATURES P1)
**Avoids:** Unicode bypass (Pitfall 4 — normalization from day 1), memory poisoning (Pitfall 3 — frozen-snapshot + sanitization), memory prompt bloat (Pitfall 7 — token cap + compaction from day 1)
**Estimated scope:** 3-4 plans

### Phase 2: Code Review Workflow
**Rationale:** Largest new capability and highest user value. Establishes the "CLI analysis + agent judgment" pattern that security audit will follow. The two-pass architecture (CLI scan → JSON findings, then agent reviews findings + source → batched questions) must be proven here before replication.
**Delivers:** `/bgsd-review` command with structural audit, FIX-FIRST auto-fix, plan-aware scoping, severity classification
**Uses:** acorn AST (complexity, exports), review/severity.js (classification), conventions.js (naming), git.js (diff extraction)
**Implements:** CLI-first data pattern, agent reuse via workflow specialization (verifier)
**Avoids:** FP flood (Pitfall 1 — confidence gate + exclusion list), scope creep into linting (Pitfall 8 — explicit exclusions)
**Estimated scope:** 3-4 plans

### Phase 3: Security Audit Workflow
**Rationale:** Same architecture as code review — ~50% of design decisions carry over. Can share scanning infrastructure (regex patterns, confidence scoring). Readiness dashboard benefits from both review and security being complete.
**Delivers:** `/bgsd-security` command with OWASP Top 10 patterns, secrets scanning, dependency vulnerability checks, confidence-gated findings
**Uses:** skills.js SECURITY_PATTERNS (41-pattern architecture), ast.js (code patterns), review/severity.js (classification)
**Implements:** CLI-first data pattern (reused from Phase 2), verifier agent workflow (security-audit.md)
**Avoids:** Security FP overload (Pitfall 2 — advisory-only + confidence gating), missing real vulns (Pitfall 9 — differentiated from existing scanner)
**Estimated scope:** 3-4 plans

### Phase 4: Dashboard & Release Pipeline
**Rationale:** Both features are aggregation/orchestration layers over data produced by earlier phases. Readiness dashboard maximized by having review + security data. Release benefits from readiness:check as pre-release gate. Smallest greenfield work — release is primarily refactoring existing phase.js milestone code.
**Delivers:** Review readiness dashboard (test/lint/coverage/TODO aggregation, GO/NO-GO), automated release (`/bgsd-release` with semver bump, changelog, git tag, PR creation)
**Uses:** format.js (dashboard output), git.js (release operations), cli-tools/gh.js (PR creation)
**Implements:** Readiness aggregation, release orchestration (executor agent)
**Avoids:** Dashboard as gate (Pitfall 6 — advisory language), release runaway (Pitfall 5 — dry-run default + confirmation gate), changelog garbage (Pitfall 8 — conventional commit filtering)
**Estimated scope:** 2-3 plans

### Phase Ordering Rationale

- **Safety first:** GARD-04 and MEMORY.md have zero dependencies on other features, provide immediate value, and build project momentum. Memory is foundational — all subsequent features can persist learnings.
- **Core capability second:** Code review is the highest-value feature and establishes the CLI→agent two-pass pattern. Building it before security means the architecture is proven before replication.
- **Shared pattern third:** Security audit reuses ~50% of code review's architecture. Building it after review means less design risk and faster implementation.
- **Aggregation last:** Dashboard and release both consume outputs from earlier phases. Building them last maximizes the data available for aggregation and the pre-release quality gate.
- **Pitfall alignment:** Each phase addresses its relevant pitfalls at the design stage, not as retrofits.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (GARD-04):** Check if host editor plugin API supports `tool.execute.before` hook for true pre-execution blocking. If not, start with `tool.execute.after` advisory pattern.
- **Phase 2 (Code Review):** Complex feature — auto-fix engine needs careful scoping to avoid breaking code. Plan-aware review scope requires cross-referencing PLAN.md with git diff.
- **Phase 3 (Security):** Curating ~40 secrets patterns from secrets-patterns-db and ~30 OWASP patterns requires careful selection for high precision / low false positives.

Phases with standard patterns (skip research-phase):
- **Phase 4 (Dashboard + Release):** Well-documented patterns. Dashboard is pure CLI aggregation. Release refactors existing milestone completion code. Standard implementation.
<!-- /section -->

<!-- section: confidence -->
## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies — all features extend proven existing modules. Bundle impact estimated at +5%. |
| Features | HIGH | 5/6 features verified against competitive implementations (gstack, hermes-agent); agent memory validated against Claude Code docs. |
| Architecture | HIGH | Extension-based approach within existing layered architecture. 9-agent cap respected. All integration points identified. |
| Pitfalls | HIGH | Top pitfalls backed by industry research (CodeRabbit FP rates, MINJA memory poisoning, Unicode evasion papers). Mitigations verified against competitive implementations. |

**Overall confidence:** HIGH

### Gaps to Address

- **`tool.execute.before` hook:** Need to verify if host editor plugin API supports pre-execution hooks for GARD-04 blocking mode. If not, advisory-only (tool.execute.after) is the fallback. Check during Phase 1 planning.
- **LLM-assessed approval:** Deferred to v16.x. For borderline destructive command findings, the initial implementation uses regex-only detection. LLM assessment adds value but increases complexity and latency.
- **False positive calibration:** Confidence gates (8/10 threshold) and exclusion lists are based on competitive analysis. Real calibration requires running review and security tools on the bGSD codebase itself during implementation. Track FP rates and adjust.
- **Memory compaction quality:** The compaction strategy (TTL, deduplication, category budgets) is designed but untested at scale. With default limits (20 entries/section, 2KB cap), scale shouldn't be an issue for v16.0.
<!-- /section -->

<!-- section: sources -->
## Sources

### Primary (HIGH confidence)
- Existing bGSD codebase: `src/lib/ast.js`, `src/lib/git.js`, `src/plugin/advisory-guardrails.js`, `src/commands/skills.js`, `src/commands/memory.js`, `src/plugin/context-builder.js` — verified all integration points and existing patterns
- OWASP Top 10:2025 (https://owasp.org/Top10/2025/en/) — current vulnerability categories for security patterns
- OWASP ASI06 2026 — Memory and Context Poisoning as top agentic security risk
- Palo Alto Unit 42 — persistent memory poisoning in AI agents via indirect prompt injection (>95% success rate)
- arxiv:2504.11168 — Unicode character injection achieves near-100% evasion of guardrail classifiers
- gstack competitive analysis — FIX-FIRST review, 8/10 confidence gate, 17 FP exclusions, advisory-not-blocking philosophy
- hermes-agent competitive analysis — frozen-snapshot memory, 25+ destructive patterns, Unicode normalization, LLM-assessed approval

### Secondary (MEDIUM confidence)
- DeepSource benchmark — hybrid static analysis + AI achieves lower FP rates than pure LLM review
- CodeRabbit OpenSSF CVE Benchmark — 59.39% accuracy, 36.19% F1 score showing FP problem in pure LLM review
- Graphite Agent — <3% unhelpful comment rate, 55% developer action rate on findings
- mazen160/secrets-patterns-db — 1600+ curated regex patterns for secrets detection (reference data, not dependency)
- bundlephobia.com — semver 7.7.4 = 24KB/0 deps; conventional-changelog 7.2.0 = 44KB/9 deps
- Mindgard research — zero-width characters, homoglyphs, and emoji bypass guardrail detection
- LinearB DevEx metrics — dashboard without actions = "Metric Theater" (Goodhart's Law)

### Tertiary (LOW confidence)
- Claude Code guardrails gist — production command detection with Unicode handling (community reference, not official)
- Various AI code review tool surveys (DigitalOcean, CodeAnt.ai, Cycode) — market landscape context

---
*Research completed: 2026-03-28*
*Ready for roadmap: yes*
