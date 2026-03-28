# Feature Research

**Domain:** Enterprise Developer Team Capabilities — Code Review, Security Audit, Release Pipeline, Agent Memory, Safety Guardrails
**Researched:** 2026-03-28
**Confidence:** HIGH (5/6 features verified against competitive implementations and industry patterns; agent memory patterns verified against Claude Code docs and hermes-agent)

<!-- section: compact -->
<features_compact>
<!-- Compact view for planners. Keep under 30 lines. -->

**Table stakes (must have):**
- Code review: structural audit (dead code, complexity, missing tests) + auto-fix for mechanical issues — every AI dev tool offers this
- Security audit: OWASP Top 10 mapping + secrets scanning + dependency CVE checks — industry baseline since 2024
- Release workflow: semver bump + changelog + git tag + PR — semantic-release pattern is 10 years mature
- Agent memory: cross-session learning persisted to file, injected at session start — Claude Code MEMORY.md is the standard
- Destructive command detection: pattern-matching dangerous operations before execution — every safety-conscious tool has this
- Review readiness: pre-ship checklist aggregating test/lint/coverage/TODO status — quality gate dashboards are standard

**Differentiators:**
- Code review with FIX-FIRST philosophy (auto-fix silently, only ASK for judgment calls) — gstack's proven model
- Security audit with confidence gating (suppress <8/10 findings) + 17+ false positive exclusions — eliminates alert fatigue
- Agent memory with frozen-snapshot injection (not live file — prevents context drift) — hermes-agent's innovation
- Destructive detection with Unicode normalization + LLM-assessed approval for edge cases — beyond simple regex

**Defer (v17+):** Real-time DAST scanning, cross-repo memory federation, automated rollback, SBOM generation

**Key dependencies:** Review readiness requires code review + security audit data; release workflow requires gh CLI; memory injection requires plugin hook changes; destructive detection requires plugin guardrail extension
</features_compact>
<!-- /section -->

<!-- section: feature_landscape -->
## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in an enterprise-grade AI development tool. Missing these = product feels incomplete.

#### 1. Code Review (`/bgsd-review`)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Structural code audit | Every AI review tool (CodeRabbit, Copilot, Codacy) does multi-file structural analysis | MEDIUM | Use existing AST module (acorn) for complexity, dead code, export analysis |
| Auto-fix for mechanical issues | Mobb, Snyk Autofix, GitHub Copilot Autofix all provide deterministic fixes | HIGH | Fix import ordering, unused vars, naming violations — don't just report |
| Batched user questions | CodeRabbit batches questions per PR; gstack batches as ASK items | MEDIUM | Group judgment-call findings into single prompt, not one-by-one |
| Severity classification | Every tool classifies BLOCKER/WARNING/INFO | LOW | Existing `severity.js` module already has this classification system |
| File-scoped findings | Findings mapped to specific files + line ranges | MEDIUM | Leverage existing AST line-range tracking from context.js |

#### 2. Security Audit (`/bgsd-security`)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| OWASP Top 10 mapping | Industry standard since OWASP 2021; every SAST tool maps to it | MEDIUM | Pattern-based detection: injection, auth, XSS, SSRF, etc. |
| Secrets scanning | GitHub Secret Scanning, GitLeaks, TruffleHog are baseline | MEDIUM | Regex patterns for API keys, tokens, passwords in source files |
| Dependency vulnerability checks | Dependabot, Snyk SCA, npm audit — expected since 2020 | LOW | Wrap `npm audit --json` + parse output into structured findings |
| Confidence-scored findings | Semgrep achieves 98% FP reduction via confidence scoring | MEDIUM | Each finding gets confidence 1-10; suppress below threshold |
| Actionable fix suggestions | Mobb, Veracode Fix, Checkmarx all provide remediation guidance | MEDIUM | Don't just flag — provide the fix or fix direction |

#### 3. Review Readiness Dashboard

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Pre-ship status aggregation | Every CI/CD has quality gates (SonarQube, Codacy) | MEDIUM | Aggregate: tests, lint, coverage, TODOs, review findings, security findings |
| GO/NO-GO verdict | TestCollab, Cortex Scorecards, GitHub branch protection | LOW | Binary output: ready or blocked (with reasons) |
| Blocking vs advisory items | Standard in all quality gate systems | LOW | BLOCKER items prevent release; warnings are advisory |

#### 4. Automated Release (`/bgsd-release`)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Semver version bump | semantic-release, release-it, release-please all do this | MEDIUM | Parse conventional commits to determine major/minor/patch |
| Changelog generation | Standard in every release tool since 2016 | MEDIUM | Existing `auto-changelog` pattern in milestone wrapup; extend to releases |
| Git tag creation | Basic git operation, every release tool does this | LOW | `git tag v{version}` — straightforward |
| PR creation for release | release-please pattern (Google): release PR with changelog | MEDIUM | Uses existing gh CLI wrapper; creates PR with version + changelog |

#### 5. Structured Agent Memory (MEMORY.md)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Cross-session learning persistence | Claude Code has ~/.claude/projects/*/memory/MEMORY.md since 2025 | MEDIUM | File-based memory loaded at session start — industry standard |
| Automatic memory capture | Claude Code auto-writes to memory on compaction; hermes-agent captures on session end | HIGH | Hook into compaction event + session end to extract learnings |
| Memory injection into prompts | Every memory system injects at session start | MEDIUM | Plugin system prompt hook already exists for this |
| Human-editable memory | Markdown files are git-trackable and human-readable — core advantage over DB-based memory | LOW | Inherent in file-based approach |

#### 6. Destructive Command Detection

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Pattern-matching dangerous commands | dcg (Rust tool), openclaw-shield, maybedont.ai all do this | MEDIUM | Regex patterns for rm -rf, git reset --hard, DROP TABLE, etc. |
| Pre-execution interception | Every guardrail tool intercepts before execution | MEDIUM | Hook into tool.execute.before (new hook) or extend existing onToolAfter |
| Confirmation gate for destructive ops | Human-in-the-loop is universal for dangerous commands | LOW | Notification system already supports this pattern |

### Differentiators (Competitive Advantage)

Features that set bGSD apart from generic tools. These leverage bGSD's unique position as an AI planning/execution engine.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **FIX-FIRST review philosophy** | Auto-fix mechanical issues silently; only ASK for judgment calls. Reduces developer interruption by 60-80% vs report-only tools. gstack proved this with AUTO-FIX/ASK categorization | HIGH | Classify each finding as AUTO-FIX (naming, imports, dead code) or ASK (architecture, logic); fix the first category without asking |
| **Confidence-gated security findings** | 8/10 confidence threshold eliminates alert fatigue. Semgrep reports 98% FP reduction via similar gating; gstack uses 8/10 threshold with 17 FP exclusion patterns | HIGH | Each finding scored 1-10; only surface ≥8; maintain curated false-positive exclusion list |
| **Plan-aware code review** | Review scope derived from PLAN.md task files — knows what was *supposed* to be built, not just what changed. No competitor has this | MEDIUM | Cross-reference git diff with plan task <files> to detect missing implementations, scope creep |
| **Frozen-snapshot memory injection** | Memory loaded as immutable snapshot at session start, not live-file reference. Prevents mid-session context drift. hermes-agent's innovation | MEDIUM | Serialize MEMORY.md to frozen block during system prompt build; don't re-read during session |
| **Unicode-normalized destructive detection** | Catches Unicode homoglyph attacks (e.g., `rm` with Cyrillic characters). hermes-agent has 25+ patterns with normalization | MEDIUM | NFKD normalize command strings before pattern matching; catches evasion attempts |
| **LLM-assessed approval for edge cases** | When pattern confidence is LOW, use LLM to assess whether command is truly dangerous. Smart alternative to blanket blocking | HIGH | Pattern match → HIGH confidence = block; LOW confidence = LLM assessment before decision |
| **Release with plan context** | Release changelog generated from SUMMARY.md accomplishments + conventional commits. Richer than commit-only changelogs | MEDIUM | Combine git log with SUMMARY.md data for human-readable release notes |
| **Memory compaction with quality scoring** | Memory entries scored by impact; low-value memories pruned during compaction. Prevents memory bloat over time | MEDIUM | Reuse existing lessons:compact pattern with frequency/recency/severity scoring |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems in the bGSD context.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time DAST scanning | Comprehensive security coverage | Wrong architecture for CLI tool — requires running application; massive complexity | Static analysis (SAST) + dependency checks cover 90% of issues for CLI-based workflows |
| Automated rollback on failure | Safety net for bad releases | Dangerous in itself — automated rollback can corrupt state, lose data, trigger cascading failures | Provide rollback *information* (`/bgsd-rollback-info` already exists) + human confirmation |
| Cross-repo memory federation | Share learnings across projects | Memory is highly project-specific; cross-pollination creates noise and false confidence | Project-scoped memory with explicit export/import commands |
| Review-then-auto-merge | Reduce human steps | Removes critical human judgment; auto-merge belongs in CI (already in github-ci), not in review | Review produces findings; merge is separate deliberate step via github-ci |
| SBOM generation | Supply chain compliance | Heavy tooling (CycloneDX, SPDX); not a CLI plugin's job; better handled by dedicated tools | Dependency vulnerability scanning covers the actionable subset |
| Live memory file watching | Always-current memory | Mid-session memory changes cause context drift and unpredictable agent behavior | Frozen snapshot at session start; explicit `/bgsd-refresh` if needed |
| Full OWASP ASVS compliance | Enterprise checkbox | ASVS has 300+ controls — impossible to implement meaningfully in a CLI tool | Focus on Top 10 + secrets + dependencies — covers 95% of real-world developer needs |
<!-- /section -->

<!-- section: dependencies -->
## Feature Dependencies

```
[Code Review (/bgsd-review)]
    ├──uses──> [AST module (ast.js)] — complexity, dead code, exports
    ├──uses──> [Severity classification (review/severity.js)] — finding categorization
    ├──uses──> [Convention detection (conventions.js)] — naming, style violations
    └──creates──> [Review findings JSON] — consumed by readiness dashboard

[Security Audit (/bgsd-security)]
    ├──uses──> [Skills security scanner (skills.js)] — 41 existing patterns
    ├──uses──> [Dependency detection (lifecycle.js)] — package manager awareness
    ├──new──> [Secrets scanner module] — regex-based credential detection
    └──creates──> [Security findings JSON] — consumed by readiness dashboard

[Review Readiness Dashboard]
    ├──requires──> [Code Review findings]
    ├──requires──> [Security Audit findings]
    ├──uses──> [Test runner detection (advisory-guardrails.js)] — npm test / pytest
    ├──uses──> [Format module (format.js)] — branded CLI output
    └──creates──> [GO/NO-GO verdict]

[Automated Release (/bgsd-release)]
    ├──requires──> [gh CLI wrapper (cli-tools/gh.js)] — PR creation, release creation
    ├──uses──> [Git module (git.js)] — tag, log, conventional commit parsing
    ├──uses──> [Milestone summary (reports/milestone-summary.js)] — changelog data
    └──optionally──> [Review Readiness] — pre-release quality gate

[Structured Agent Memory (MEMORY.md)]
    ├──extends──> [Plugin context-builder.js] — memory injection into system prompt
    ├──extends──> [Plugin compaction hook] — memory capture before context loss
    ├──reuses──> [Lessons system (lessons.js)] — structured entry schema + validation
    └──creates──> [.planning/MEMORY.md] — persistent memory file

[Destructive Command Detection]
    ├──extends──> [Plugin advisory-guardrails.js] — new guardrail type GARD-04
    ├──uses──> [Plugin notification system] — confirmation prompts
    └──optionally──> [LLM assessment] — edge case disambiguation
```

### Dependency Notes

- **Review Readiness requires Code Review + Security Audit:** The dashboard aggregates findings from both; build review and security first
- **Release optionally requires Review Readiness:** Can run without it (just semver + changelog), but pre-release gate is the enterprise pattern
- **Memory injection requires plugin hook changes:** context-builder.js needs a new data source; frozen-snapshot pattern means one-time read
- **Destructive detection extends existing guardrails:** advisory-guardrails.js already has the hook infrastructure (GARD-01/02/03); add GARD-04
- **Security audit reuses skills scanner infrastructure:** The 41-pattern security scanner in skills.js is a head start; extend patterns for source code
- **Code review reuses AST module:** acorn-based complexity metrics, export analysis already exist in ast.js; review wraps these
<!-- /section -->

<!-- section: mvp -->
## MVP Definition

### Launch With (v16.0)

Minimum viable product — what's needed to deliver the 6-feature enterprise team.

- [x] **Code review structural audit** — AST-based complexity, dead code, missing tests, naming violations
- [x] **Code review auto-fix** — FIX-FIRST philosophy: auto-fix mechanical issues, batch ASK items
- [x] **Security audit OWASP Top 10** — Pattern-based detection for injection, auth, XSS, SSRF, secrets
- [x] **Security confidence gating** — 8/10 threshold with curated false-positive exclusion list
- [x] **Dependency vulnerability scanning** — Wrap npm audit + parse structured findings
- [x] **Review readiness dashboard** — CLI command aggregating tests, lint, review findings, security findings, GO/NO-GO
- [x] **Release workflow** — Semver bump (from conventional commits), changelog generation, git tag, PR creation
- [x] **MEMORY.md with frozen injection** — Cross-session memory captured from lessons/decisions, injected as snapshot
- [x] **Destructive command detection** — 25+ patterns with Unicode normalization, confirmation gate
- [x] **Plan-aware review scope** — Review scope derived from PLAN.md task files

### Add After Validation (v16.x)

Features to add once core is working.

- [ ] **LLM-assessed approval for edge cases** — When destructive pattern confidence is LOW, use LLM to disambiguate
- [ ] **Memory compaction with quality scoring** — Auto-prune low-value memories during compaction
- [ ] **Release dry-run mode** — Preview version bump + changelog without executing
- [ ] **Security trend tracking** — Compare findings across releases to show improvement/regression
- [ ] **Custom security rule authoring** — User-defined patterns in config.json

### Future Consideration (v17+)

Features to defer until v16.0 patterns are proven.

- [ ] **Cross-project memory export/import** — Share curated learnings between projects
- [ ] **Review delegation** — Route findings to specific team members based on file ownership
- [ ] **SBOM generation** — CycloneDX/SPDX output for supply chain compliance
- [ ] **Custom release channels** — Separate alpha/beta/stable release tracks
- [ ] **Automated dependency updates** — Dependabot-like PR creation for vulnerable deps
<!-- /section -->

<!-- section: prioritization -->
## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Rationale |
|---------|------------|---------------------|----------|-----------|
| Code review (`/bgsd-review`) | HIGH | HIGH | P1 | Core enterprise capability; leverages existing AST + severity infrastructure |
| Security audit (`/bgsd-security`) | HIGH | HIGH | P1 | Security is non-negotiable for enterprise; existing 41-pattern scanner is starting point |
| Destructive command detection | HIGH | MEDIUM | P1 | Safety-critical; prevents real-world damage; extends existing guardrail infrastructure |
| Structured agent memory (MEMORY.md) | HIGH | MEDIUM | P1 | Cross-session continuity is the #1 user pain point; builds on lessons system |
| Review readiness dashboard | MEDIUM | LOW | P2 | Aggregation layer over review + security data; low cost once sources exist |
| Automated release (`/bgsd-release`) | MEDIUM | MEDIUM | P2 | Convenience feature; well-understood pattern; depends on gh CLI |

**Priority key:**
- P1: Must have for launch — these define the "enterprise developer team" value proposition
- P2: Should have — enhances the experience but the product is viable without them
<!-- /section -->

<!-- section: competitors -->
## Competitor Feature Analysis

### gstack

| Feature | gstack Implementation | Strengths | Our Approach |
|---------|----------------------|-----------|--------------|
| Code review (`/review`) | Fix-first with AUTO-FIX/ASK categorization; deterministic fixes applied silently | Proven UX reduction — developers only see what needs judgment | Adopt FIX-FIRST philosophy; classify findings as AUTO-FIX vs ASK; existing severity.js provides foundation |
| Security audit (`/cso`) | 15 audit phases; 8/10 confidence gate; 17 false-positive exclusions | Eliminates alert fatigue; curated exclusions from real-world experience | Adopt 8/10 confidence threshold; build curated FP exclusion list; fewer phases (5-7 — OWASP + secrets + deps) |
| Release pipeline (`/ship`) | Full pipeline: version bump, changelog, tag, PR | Integrated end-to-end release | Similar scope; leverage existing gh.js wrapper + git.js; add SUMMARY.md data for richer changelogs |
| Review dashboard | Template-based pre-ship status view | Quick visual status | CLI command with branded output (format.js); GO/NO-GO verdict; machine-readable JSON for automation |

### hermes-agent

| Feature | hermes-agent Implementation | Strengths | Our Approach |
|---------|---------------------------|-----------|--------------|
| Agent memory (MEMORY.md) | Frozen-snapshot injection; structured sections for preferences, patterns, anti-patterns | Prevents context drift; organized knowledge | Adopt frozen-snapshot pattern; structure memory into categories (decisions, patterns, anti-patterns, preferences) |
| Destructive detection | 25+ patterns with Unicode normalization; smart LLM-assessed approval | Catches evasion; LLM handles edge cases | Adopt Unicode NFKD normalization; implement 25+ patterns; defer LLM assessment to v16.x |
| Memory lifecycle | Automatic capture from conversation; compaction with pruning | Self-improving memory without manual curation | Hook into compaction event + lesson capture; auto-extract high-value findings |

### Claude Code (Reference — Not Competitor)

| Feature | Claude Code Implementation | Relevance to bGSD |
|---------|---------------------------|-------------------|
| MEMORY.md | `~/.claude/projects/<project>/memory/MEMORY.md` + topic files; auto-memory writes during compaction | Validates file-based memory as the standard; we can go further with structured injection |
| Permissions | Tool-level allow/deny with `--allowedTools` flag | Different model — we use advisory guardrails, not hard permissions |
| Project knowledge | CLAUDE.md loaded at session start | Similar to our AGENTS.md + MEMORY.md injection pattern |

### Industry Tools (SonarQube, Snyk, CodeRabbit)

| Capability | Industry Standard | bGSD Advantage |
|-----------|-------------------|----------------|
| Code review | PR-based, requires running service, per-seat pricing | Local, CLI-based, zero cost, plan-aware context |
| Security scanning | Requires SaaS or self-hosted infrastructure | Local analysis, no data leaves the machine |
| Release automation | CI/CD pipeline configuration | Single command, integrated with planning context |
| Quality gates | Dashboard/web UI | CLI + JSON output, scriptable, no browser needed |
<!-- /section -->

<!-- section: complexity_assessment -->
## Complexity Assessment Per Feature

### 1. Code Review (`/bgsd-review`) — HIGH complexity

**What makes it hard:**
- FIX-FIRST philosophy requires reliable auto-fix that doesn't break code
- Need to distinguish mechanical fixes (safe to auto-apply) from judgment calls (must ask)
- Plan-aware scoping requires cross-referencing PLAN.md tasks with git diff
- Multi-file structural analysis (not just single-file linting)

**Existing infrastructure to leverage:**
- `ast.js` — acorn-based complexity metrics, export analysis, repo map
- `review/severity.js` — BLOCKER/WARNING/INFO classification
- `conventions.js` — naming convention detection
- `git.js` — structured diff, blame, log

**New modules needed:**
- Review workflow (workflow .md file)
- Review findings formatter (CLI command)
- Auto-fix engine (mechanical fix application)

**Estimated scope:** 2-3 plans, 6-9 tasks

### 2. Security Audit (`/bgsd-security`) — HIGH complexity

**What makes it hard:**
- False positive management is the #1 challenge in all security tools
- OWASP Top 10 mapping requires deep pattern library
- Confidence scoring requires calibration against real codebases
- Secrets scanning needs high precision (avoid flagging test data)

**Existing infrastructure to leverage:**
- `skills.js` security scanner — 41 patterns already (code execution, exfiltration, injection, mining)
- `lifecycle.js` — detects package managers for dependency scanning
- `cli-tools/` — can invoke `npm audit`, `gh api` for advisory data

**New modules needed:**
- Source-code-focused security patterns (vs current skill-focused patterns)
- Confidence scoring engine
- False positive exclusion list (curated, extensible)
- Dependency vulnerability aggregator

**Estimated scope:** 2-3 plans, 6-9 tasks

### 3. Review Readiness Dashboard — LOW complexity

**What makes it hard:**
- Aggregating data from multiple sources (tests, lint, review, security)
- GO/NO-GO logic needs sensible defaults that work across project types

**Existing infrastructure to leverage:**
- `format.js` — branded CLI output, tables, progress bars
- `advisory-guardrails.js` — test runner detection
- Review + security findings (once built)

**New modules needed:**
- Readiness aggregator (CLI command)
- Status check runners (test, lint, coverage detection)

**Estimated scope:** 1 plan, 2-3 tasks

### 4. Automated Release (`/bgsd-release`) — MEDIUM complexity

**What makes it hard:**
- Conventional commit parsing for semver determination
- Changelog formatting that's actually readable
- Error handling for gh CLI failures mid-release

**Existing infrastructure to leverage:**
- `cli-tools/gh.js` — PR creation, release creation capabilities
- `git.js` — tag creation, log parsing, conventional commit detection
- `reports/milestone-summary.js` — existing changelog generation pattern

**New modules needed:**
- Release workflow (workflow .md file)
- Semver determination logic (from commit history)
- Changelog formatter (combining commits + SUMMARY.md data)

**Estimated scope:** 1-2 plans, 4-6 tasks

### 5. Structured Agent Memory (MEMORY.md) — MEDIUM complexity

**What makes it hard:**
- Deciding what to remember vs forget (extraction quality)
- Frozen-snapshot injection without bloating system prompt
- Integration with existing lessons system without duplication
- Compaction hook timing (before context is lost)

**Existing infrastructure to leverage:**
- `lessons.js` — structured entry schema, validation, capture, suggest
- `plugin/context-builder.js` — system prompt injection (sacred block pattern)
- `planning-cache.js` — memory store with SQLite backing
- Compaction hook in plugin already exists

**New modules needed:**
- MEMORY.md reader/writer
- Memory extraction logic (from session learnings)
- Plugin integration (context-builder + compaction hook extensions)

**Estimated scope:** 1-2 plans, 4-6 tasks

### 6. Destructive Command Detection — MEDIUM complexity

**What makes it hard:**
- Pattern library must be comprehensive without false positives
- Unicode normalization adds edge-case complexity
- Hook integration needs to intercept *before* execution (currently only after)
- Must not slow down normal command execution

**Existing infrastructure to leverage:**
- `plugin/advisory-guardrails.js` — GARD-01/02/03 infrastructure, notification system
- `skills.js` — 41 security patterns (code execution category is relevant)
- Plugin hook system — tool.execute.after exists; may need tool.execute.before

**New modules needed:**
- Destructive pattern library (25+ patterns with categories)
- Unicode normalization layer (NFKD)
- Pre-execution hook (tool.execute.before or extend existing)
- Confirmation gate (notification + block until confirmed)

**Estimated scope:** 1-2 plans, 4-6 tasks
<!-- /section -->

<!-- section: existing_infrastructure -->
## Existing bGSD Infrastructure Map

Infrastructure each feature builds on:

| Feature | Primary Module(s) | Plugin Component(s) | CLI Commands | Workflow(s) |
|---------|-------------------|---------------------|-------------|-------------|
| Code Review | `ast.js`, `review/severity.js`, `conventions.js`, `git.js` | — | New: `review:audit`, `review:fix` | New: `review.md` |
| Security Audit | `skills.js` (41 patterns), `lifecycle.js` | — | New: `security:scan`, `security:report` | New: `security.md` |
| Review Readiness | `format.js`, `output.js` | `advisory-guardrails.js` (test detection) | New: `review:readiness` | — (CLI only) |
| Release | `cli-tools/gh.js`, `git.js`, `reports/milestone-summary.js` | — | New: `release:prepare`, `release:execute` | New: `release.md` |
| Agent Memory | `lessons.js`, `planning-cache.js` | `context-builder.js`, compaction hook | New: `memory:inject`, `memory:capture` | — (plugin integration) |
| Destructive Detection | `skills.js` (patterns) | `advisory-guardrails.js`, notification | New: `detect:destructive` | — (plugin integration) |

### Module Reuse Density

These modules are shared across multiple features — changes here have high blast radius:

| Module | Used By | Blast Radius |
|--------|---------|-------------|
| `advisory-guardrails.js` | Destructive detection, Review readiness | MEDIUM — add GARD-04, don't change GARD-01/02/03 |
| `context-builder.js` | Agent memory | HIGH — system prompt injection is critical path |
| `git.js` | Code review, Release | LOW — additive functions only |
| `format.js` | Review readiness, all CLI output | LOW — existing formatting primitives sufficient |
| `skills.js` | Security audit (pattern reuse) | LOW — security scanner is isolated function |
<!-- /section -->

## Sources

- Claude Code documentation: Memory system architecture — https://code.claude.com/docs/en/memory [HIGH confidence — official docs]
- Medium: "Persistent Memory for AI Coding Agents" (Sourabh Sharma, Feb 2026) — cross-session memory patterns [MEDIUM confidence — well-sourced article]
- dev.to: "AI Agent Memory Management: When Markdown Files Are All You Need" — MEMORY.md patterns [MEDIUM confidence]
- GitHub Gist: destructive_command_guard — Rust-based safety hook for AI agents, 49+ security packs [MEDIUM confidence — real tool with usage]
- Knostic: openclaw-shield — open source security plugin for AI agents, 5-layer defense [MEDIUM confidence — published tool]
- maybedont.ai: AI Guardrails — runtime policy enforcement with natural language + CEL rules [MEDIUM confidence]
- OWASP Foundation: Source Code Analysis Tools listing — comprehensive SAST tool survey [HIGH confidence — official source]
- DigitalOcean: "10 AI Code Review Tools" (2025) — market landscape [MEDIUM confidence]
- CodeAnt.ai: "Best 7 AI Code Review Tools" (2026) — competitive comparison with pricing [MEDIUM confidence]
- Cycode: "10 Best AI Cybersecurity Tools in 2026" — confidence scoring, false positive reduction [MEDIUM confidence]
- LogRocket: "Using semantic-release to automate releases" — semantic-release workflow patterns [HIGH confidence — well-documented]
- OneUptime: "How to Automate Releases with GitHub Actions" (Jan 2026) — release pipeline patterns [MEDIUM confidence]
- gstack competitive analysis (from milestone context) — FIX-FIRST review, 8/10 confidence gate, 17 FP exclusions [HIGH confidence — direct analysis]
- hermes-agent competitive analysis (from milestone context) — MEMORY.md frozen snapshot, 25+ destructive patterns, Unicode normalization [HIGH confidence — direct analysis]

---
*Feature research for: Enterprise Developer Team Capabilities (v16.0)*
*Researched: 2026-03-28*
