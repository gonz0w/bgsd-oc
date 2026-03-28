# Pitfalls Research

**Domain:** Enterprise Developer Team Features for AI Agent Orchestration
**Researched:** 2026-03-28
**Confidence:** HIGH

<!-- section: compact -->
<pitfalls_compact>
<!-- Compact view for planners. Keep under 25 lines. -->

**Top pitfalls:**
1. **FP flood in code review** — 8/10 confidence gate + exclusion list from day 1 (Phase 1-2)
2. **Security scanner crying wolf** — advisory-not-blocking + severity tiers; never auto-fix security (Phase 2-3)
3. **Memory poisoning via prompt injection** — frozen-snapshot reads, provenance tagging, sanitization (Phase 4)
4. **Release automation runaway** — dry-run default, confirmation gate, never auto-push tags (Phase 3-4)
5. **Destructive command regex bypass** — Unicode normalization + canonical form before matching (Phase 1)
6. **Dashboard as gate** — advisory-only (C-03 constraint); inform, never block (Phase 2-3)
7. **Memory prompt bloat** — hard token cap (500 tokens), aggressive summarization, TTL expiry (Phase 4)
8. **Changelog garbage** — require conventional commits; garbage-in = garbage-out (Phase 3)

**Tech debt traps:** Hardcoding FP exclusions instead of config, security rules that can't update without code changes, memory without compaction, changelog templates coupled to git log format

**Security risks:** Memory poisoning across sessions, MEMORY.md injection into system prompts, Unicode homoglyph bypass of command detection, secrets in changelog entries

**"Looks done but isn't" checks:**
- Code review: verify FP rate < 30% on real codebase, not just test fixtures
- Security: verify OWASP Top 10 coverage with actual vulnerable code samples
- Memory: verify old memories don't override fresh context; test poisoning resistance
- Release: verify dry-run output matches actual release; test rollback path
- Command detection: verify with Unicode homoglyphs, zero-width chars, shell aliases
</pitfalls_compact>
<!-- /section -->

<!-- section: critical_pitfalls -->
## Critical Pitfalls

### Pitfall 1: False Positive Flood Destroys Code Review Trust

**What goes wrong:**
Code review automation generates so many low-quality findings that developers learn to ignore ALL findings — including real bugs. Industry data shows pure LLM-based reviewers produce 36-54% false positive rates (CodeRabbit's F1 score is 36.19% on the OpenSSF CVE Benchmark). Hacker News reports of PRs becoming "unreadable with noise" and developers resolving AI comments "without taking any action" are common. Once trust is lost, it takes months to rebuild.

**Why it happens:**
- No confidence threshold — every finding gets surfaced regardless of certainty
- Linting overlap — flagging style issues that formatters/linters already catch
- Missing project context — flagging patterns that are intentional in the codebase (e.g., `execFileSync` is expected in bgsd-tools)
- No exclusion mechanism — same FP appears on every review, training developers to ignore

**How to avoid:**
1. **Confidence gate at 8/10** — only surface findings the reviewer is ≥80% confident about (gstack pattern)
2. **Exclusion list from day 1** — `review_exclusions` in config.json, updatable without code changes (gstack has 17 exclusions)
3. **Severity tiers** — BLOCKER (must address), WARNING (should address), INFO (awareness only). Only BLOCKERs require response.
4. **No linting overlap** — explicitly skip anything covered by ESLint, Prettier, or project linters. Check codebase-intel for existing tools.
5. **Batched questions** — collect uncertain findings and ask user once, not per-finding (reduces interruption)

**Warning signs:**
- Developers consistently dismiss findings without reading them
- Same false positive appears across 3+ reviews
- Review findings per file exceed 5 (noise threshold)
- Review time exceeds 2 minutes per file (context overload)

**Phase to address:**
Phase 1 (Code Review Workflow) — confidence gate and exclusion list must ship with MVP. Phase 2 refinement with FP tracking.

---

### Pitfall 2: Security Scanner Crying Wolf — FP Overload Masks Real Vulnerabilities

**What goes wrong:**
Security scanning produces dozens of findings per scan, most of which are false positives or low-severity issues. The real vulnerability (SQL injection, secrets leak) gets buried in noise about "potential XSS in test file" and "unused import could indicate dead code." Security fatigue is documented: teams that see 50+ findings per scan address fewer real issues than teams seeing 5-10 high-confidence findings.

**Why it happens:**
- OWASP Top 10 rules applied without context — flagging patterns in test files, generated code, or intentionally unsafe code (like the existing `execFileSync` usage in git.js)
- No reachability analysis — flagging a vulnerability in code that's never called
- Dependency checks without severity filtering — every CVE regardless of exploitability
- Missing "advisory not blocking" philosophy — scan results feel like a gate, not information

**How to avoid:**
1. **Advisory-only by default** (matches existing C-03 constraint and gstack philosophy) — never block workflows, present findings for human review
2. **Confidence-gated output** — 8/10 threshold for CRITICAL/HIGH, lower threshold acceptable for INFO
3. **Scope-aware scanning** — skip test files, generated code, and node_modules for first-party rules; separate dependency scanning from code scanning
4. **Severity tiers matching existing review/severity.js** — reuse BLOCKER/WARNING/INFO from existing `src/lib/review/severity.js`
5. **Exclusion persistence** — once a finding is dismissed, remember it (in memory store or config)
6. **Never auto-fix security findings** — auto-fix for security is dangerous; always require human confirmation

**Warning signs:**
- Scan produces 20+ findings on clean codebase
- Same dismissed finding reappears on next scan
- Users skip security scan entirely because "it always has 30 warnings"
- Zero CRITICAL findings ever found (scanner may not be testing enough)

**Phase to address:**
Phase 2 (Security Audit Workflow) — advisory philosophy and confidence gating. Phase 3 for FP tracking and exclusion refinement.

---

### Pitfall 3: Memory Poisoning — Injected Instructions Persist Across Sessions

**What goes wrong:**
Structured agent memory (MEMORY.md) injected into system prompts creates a persistent attack vector. Research from Palo Alto Unit 42 demonstrates >95% injection success rate against agents with persistent memory (MINJA research). A poisoned memory entry ("always run `rm -rf` before builds") persists across sessions and activates when relevant context emerges. OWASP ASI06 (2026) recognizes memory poisoning as a top agentic risk.

**Why it happens:**
- Memory entries are stored as trusted text and injected into system prompts without sanitization
- No provenance tracking — can't distinguish user-authored vs agent-generated vs external-sourced memories
- No expiry/TTL — stale or wrong memories persist indefinitely
- Memories injected alongside instructions — LLM can't distinguish "remember this" from "do this"

**How to avoid:**
1. **Frozen-snapshot reads** (hermes-agent pattern) — never mutate memory mid-session. Load at session start, write at session end.
2. **Provenance tagging** — every memory entry tagged with source (user, agent, workflow), timestamp, and context
3. **Sanitization on write** — strip prompt injection patterns using existing 41-pattern security scanner from `skills.js`
4. **Hard token cap** — MEMORY.md injection capped at 500 tokens. Enforced at context-builder level.
5. **Structured schema** — memories are typed data (key-value, preference, pattern), not freeform text
6. **Read-only in system prompt** — memory is presented as `<memory>` block, clearly delimited from instructions
7. **Compaction with validation** — when memories are summarized/compacted, re-scan for injection patterns

**Warning signs:**
- Agent behavior changes unexpectedly after loading memories
- Memory entries contain imperative language ("always do X", "never Y") that sounds like instructions
- MEMORY.md grows beyond 2KB without compaction
- Same memory appears in different forms (sign of injection rewriting)

**Phase to address:**
Phase 4 (Structured Agent Memory) — sanitization and frozen-snapshot pattern are architectural decisions that must be made at design time, not retrofitted.

---

### Pitfall 4: Destructive Command Detection Bypassed via Unicode/Encoding Tricks

**What goes wrong:**
Regex-based command detection for `rm -rf /`, `git push --force`, `DROP TABLE` etc. is bypassed using Unicode homoglyphs (Cyrillic 'а' for Latin 'a'), zero-width characters (U+200B), emoji substitution, or Unicode tag characters. Research (arxiv:2504.11168) shows character injection techniques achieve near-100% evasion rates against guardrail classifiers. A user (or injected prompt) types `rm -rf /` with invisible Unicode and the detector sees benign text.

**Why it happens:**
- Pattern matching on raw string without normalization
- Regex operates on visual appearance, not semantic content
- Shell itself normalizes Unicode differently than JavaScript regex
- New bypass techniques emerge faster than pattern updates

**How to avoid:**
1. **Unicode normalization first** (hermes-agent pattern) — `str.normalize('NFKD')` + strip zero-width characters + strip combining marks before any pattern matching
2. **Canonical form pipeline** — normalize → lowercase → strip non-ASCII → then match patterns
3. **Allowlist approach over denylist** — instead of blocking known-dangerous commands, flag anything outside a known-safe set for the current context
4. **LLM-assessed approval** (hermes-agent pattern) — for borderline cases, ask the LLM "is this command dangerous in this context?" as a second opinion
5. **Advisory not blocking** (C-03 constraint) — warn, don't prevent. User can always proceed.
6. **Layer the detection** — regex for obvious cases, AST parsing for shell commands, LLM for ambiguous cases

**Warning signs:**
- Detection test suite passes but a manual test with Unicode characters bypasses it
- Detection only tests ASCII representations of dangerous commands
- No normalization step in the detection pipeline
- Pattern list hasn't been updated since initial implementation

**Phase to address:**
Phase 1 (Destructive Command Detection) — Unicode normalization must be in the initial implementation, not added later. The existing 41-pattern scanner in `skills.js` already handles some patterns; extend rather than rebuild.

---

### Pitfall 5: Release Automation Runaway — Accidental Version Bumps and Premature Releases

**What goes wrong:**
Automated release workflow bumps version, generates changelog, creates git tag, and pushes — then the user realizes the version was wrong, the changelog included debug commits, or the release was premature. Git tags are hard to undo cleanly (force-deleting pushed tags breaks downstream). Industry reports: inconsistent commit messages cause wrong version bumps, permission errors in CI pipelines cause partial releases, changelog includes every commit including "wip" and "fix typo."

**Why it happens:**
- No dry-run step — automation goes from analysis to execution without preview
- No confirmation gate — user doesn't see what will happen before it happens
- Conventional Commits not enforced — `fix:` and `feat:` prefixes missing, so semver analysis guesses wrong
- Tag immutability not respected — once a tag is pushed, it should be considered permanent
- Changelog includes all commits — not filtered by type, so WIP/merge/chore commits appear

**How to avoid:**
1. **Dry-run by default** — `bgsd-release --dry-run` shows version bump, changelog preview, and tag name without executing. Require explicit `--execute` flag.
2. **Confirmation gate** — human-action checkpoint before any git tag creation or push
3. **Commit message validation** — warn (not block) when commits don't follow Conventional Commits; show which commits will be categorized as "uncategorized"
4. **Changelog filtering** — exclude `chore:`, `ci:`, `docs:` (configurable); only show `feat:`, `fix:`, `BREAKING CHANGE:` in user-facing changelog
5. **No auto-push** — create tag locally, show it, require explicit push. Never push tags without user confirmation.
6. **Rollback documentation** — every release shows the exact commands to undo (tag delete, version revert)
7. **Reuse existing git.js** — leverage `execGit()` and structured log from existing `src/lib/git.js` rather than new git wrappers

**Warning signs:**
- Release created without user seeing the changelog first
- Git tag pushed before user confirmed version number
- Changelog contains "wip", "fix lint", "merge branch" entries
- No rollback instructions in release output

**Phase to address:**
Phase 3 (Automated Release Workflow) — dry-run default and confirmation gate are architectural; changelog filtering is refinement.

---

### Pitfall 6: Review Readiness Dashboard Becomes a Blocking Gate

**What goes wrong:**
A dashboard showing "not ready" (tests failing, coverage low, TODOs remaining) transforms from informational into a de facto gate when agents or users refuse to proceed until all indicators are green. This violates the advisory-only constraint (C-03) and slows development. Dashboards with red/green indicators create implicit pressure to game metrics (Goodhart's Law).

**Why it happens:**
- Binary pass/fail presentation — "ready" vs "not ready" instead of a nuanced status
- Agents interpret dashboard output as precondition — if they see "NOT READY" they refuse to create PRs
- Missing "override" signal — no way to say "I know the tests are red, ship it anyway"
- Metric gaming — adding `// TODO: remove` comments before dashboard check, then removing them after

**How to avoid:**
1. **Advisory language everywhere** — "Consider addressing" not "Must fix". "3 items noted" not "3 items blocking."
2. **No binary pass/fail** — use a readiness score (e.g., 7/10) or categorized status (tests: ✓, coverage: 82%, TODOs: 3 noted)
3. **Never block downstream commands** — dashboard output is informational input, never a precondition for `/bgsd-release` or `/bgsd-github-ci`
4. **Context-aware thresholds** — what's "ready" differs per project; use config.json for thresholds, with sensible defaults
5. **Separate concerns** — tests, lint, coverage, TODOs are separate indicators, not aggregated into one score

**Warning signs:**
- Agents refuse to execute commands because "readiness check failed"
- Users skip dashboard entirely because it's always red
- Dashboard shows binary PASS/FAIL instead of detailed status
- Same metrics appear in dashboard AND as blocking gates elsewhere

**Phase to address:**
Phase 2 (Review Readiness Dashboard) — advisory language and non-blocking design must be architectural decisions.

---

### Pitfall 7: Memory Prompt Bloat — Growing MEMORY.md Exceeds Token Budgets

**What goes wrong:**
Every session adds memories. No compaction or expiry means MEMORY.md grows from 200 tokens to 2000+ tokens over weeks. This crowds out task-specific context from the token budget (existing agents have 60-80K budgets, already tight). Eventually, the agent spends more tokens reading memories than doing work. Research shows context window pollution from accumulated data degrades agent performance.

**Why it happens:**
- Write-optimized design — easy to add memories, no mechanism to remove or expire them
- No deduplication — same insight captured multiple times in different words
- No relevance filtering — all memories injected regardless of current task
- Compaction not built-in — "we'll add it later" but later never comes

**How to avoid:**
1. **Hard token cap enforced at injection** — 500 tokens max for memory injection (context-builder.js already enforces block budgets)
2. **TTL on memories** — memories expire after configurable period (default: 30 days). Expired memories move to archive.
3. **Relevance scoring** — only inject memories relevant to current task/phase (use existing task-scoped context pattern from `context.js`)
4. **Compaction built-in from day 1** — reuse existing memory compaction pattern from `memory.js` (SACRED_STORES protection, COMPACT_THRESHOLD, COMPACT_KEEP_RECENT)
5. **Deduplication on write** — hash-based or semantic similarity check before storing
6. **Category budgets** — max 3 preferences, max 5 patterns, max 3 corrections active at once

**Warning signs:**
- MEMORY.md exceeds 1KB
- context-builder.js token budget warnings mention memory block
- Agent responses include irrelevant "remembered" information
- Memory compaction has never been triggered

**Phase to address:**
Phase 4 (Structured Agent Memory) — token cap and compaction must be in initial implementation. TTL and relevance scoring can follow.

---

### Pitfall 8: Code Review Scope Creep into Linting Territory

**What goes wrong:**
Code review starts flagging naming conventions, import ordering, semicolons, and formatting — things that automated linters already handle. This creates two problems: (1) duplicate noise (same issue flagged by ESLint AND review), (2) the review becomes a linting pass rather than a structural/logic review, missing the actual bugs.

**Why it happens:**
- Review prompt doesn't explicitly exclude linter-covered issues
- No integration with codebase-intel — review doesn't know which linters are configured
- Easy wins bias — style issues are easy to detect, logic bugs are hard, so the reviewer gravitates to easy
- No separation of review phases — structural audit and style audit run as one pass

**How to avoid:**
1. **Two-stage review** (existing pattern from v7.0) — Stage 1: structural/logic audit ("built the right thing?"). Stage 2: quality audit ("built it right?"). Style explicitly excluded.
2. **Codebase-intel integration** — read `codebase-intel.json` for configured linters; exclude any category covered by existing tools
3. **Review scope definition in prompt** — explicitly state "Do NOT flag: formatting, import ordering, naming conventions, whitespace" in the reviewer prompt
4. **Dedup with existing advisory-guardrails** — GARD-01 already handles naming conventions; don't duplicate in review

**Warning signs:**
- Review findings include "should use camelCase" or "missing semicolon"
- More style findings than logic findings in review output
- Review duplicates existing linter output
- Users say "the review just tells me what ESLint already told me"

**Phase to address:**
Phase 1 (Code Review Workflow) — review scope definition and linter exclusion in the reviewer prompt.

---

### Pitfall 9: Security Audit Misses Real Vulnerabilities While Finding FP Noise

**What goes wrong:**
The scanner focuses on easy-to-detect patterns (string matching for `eval`, `exec`) but misses actual vulnerabilities: unsanitized shell injection via variable interpolation, path traversal, prototype pollution, or SSRF. The existing 41-pattern scanner in `skills.js` already catches code execution patterns — the security audit must go deeper, not wider.

**Why it happens:**
- Pattern matching is shallow — catches `eval(` but not `Function(userInput)`
- No data flow analysis — can't trace user input to dangerous sinks
- OWASP Top 10 coverage is checkbox-driven — "we check for injection" means regex for `eval`, not actual injection path analysis
- Dependency scanning treats all CVEs equally — a CVE in an unused transitive dependency is flagged the same as one in a directly-called API

**How to avoid:**
1. **Differentiate from existing scanner** — `skills.js` handles code execution patterns. Security audit should cover: secrets in code, dependency vulnerabilities, OWASP-specific patterns (injection, broken auth, misconfiguration)
2. **Secrets scanning first** — highest ROI: detect API keys, tokens, passwords in source. Use entropy detection + known patterns (AWS keys start with AKIA, etc.)
3. **Dependency vulnerability checking** — parse package.json/lock files, check against known CVE databases. Filter by: (a) is it a direct dependency? (b) is the vulnerable function called?
4. **Confidence-gated reporting** — HIGH confidence for secrets (pattern match + entropy), MEDIUM for OWASP (pattern + context), LOW for dependency (CVE exists but usage unknown)
5. **Triage workflow** — findings go to a triage queue, not directly to "fix" queue

**Warning signs:**
- Scanner finds 0 issues on a codebase with known `execFileSync` usage (existing in git.js)
- Scanner flags `execFileSync` in git.js as a vulnerability (it's intentional)
- No secrets-specific scanning rules
- Dependency scan lists 50 CVEs, none with context

**Phase to address:**
Phase 2 (Security Audit Workflow) — scope differentiation from existing scanner is design-time decision.

<!-- /section -->

<!-- section: tech_debt -->
## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode FP exclusions in code | Quick to add exclusions | Every new exclusion requires code change + build + deploy | Never — use config.json from day 1 |
| Skip memory compaction | Simpler initial implementation | MEMORY.md grows unbounded, token budgets blown | Never — ship compaction with MVP (reuse memory.js pattern) |
| Security rules as static regex | Fast to implement | Can't update rules without code changes; stale patterns | MVP only — migrate to configurable rules by Phase 3 |
| Binary dashboard pass/fail | Simple to implement | Becomes de facto gate; violates C-03 advisory constraint | Never — advisory language from day 1 |
| Inline changelog template | Quick release implementation | Changelog format locked to git log format; can't customize | MVP only — extract template by Phase 4 |
| Memory as freeform text | Maximum flexibility | Unstructured = unparseable, unsanitizable, uncompactable | Never — typed schema from day 1 |
| Command detection without normalization | Works for ASCII commands | Unicode bypass from day 1 | Never — normalization is 3 lines of code |
| Auto-fix for security findings | Impressive demo | Security auto-fix can introduce new vulnerabilities | Never — security requires human review |

## Integration Gotchas

Common mistakes when connecting new features to existing bGSD architecture.

| Integration Point | Common Mistake | Correct Approach |
|-------------------|----------------|------------------|
| context-builder.js (memory injection) | Adding memory block without token budget — exceeds 60-80K agent limits | Use `countTokens()` from token-budget.js; enforce 500-token cap for memory block |
| advisory-guardrails.js (command detection) | Creating parallel detection system instead of extending existing guardrails | Extend GARD-01/02/03 pattern; add GARD-04 for destructive command detection |
| decision-rules.js (review decisions) | Adding review decisions as LLM calls instead of deterministic rules | Add `resolveReviewConfidence()` and `resolveSecuritySeverity()` to DECISION_REGISTRY |
| memory.js (agent memory) | Creating new storage mechanism instead of reusing dual-store pattern | Reuse VALID_STORES + SACRED_STORES pattern; add 'memories' to VALID_STORES |
| severity.js (review severity) | Creating new severity system for security findings | Reuse existing BLOCKER/WARNING/INFO from `src/lib/review/severity.js` |
| config.json (feature settings) | Hardcoding feature toggles in code | Add `code_review`, `security_audit`, `release`, `agent_memory`, `command_detection` sections to config schema |
| plugin.js (command enrichment) | Not suppressing guardrails during workflow-driven operations | Reuse `setBgsdCommandActive()` / `clearBgsdCommandActive()` pattern for new commands |
| orchestration.js (task routing) | Adding new agent for review instead of routing to existing reviewer | bgsd-reviewer already exists in agent manifests; extend, don't duplicate (agent cap = 9) |
| git.js (release operations) | Writing new git wrappers instead of using execGit() | Existing `execGit()`, `structuredLog()`, `execGit(cwd, ['tag', ...])` — reuse all |
| skills.js (security scanner) | Rebuilding security patterns instead of extending 41-pattern scanner | Add new patterns to SECURITY_PATTERNS array; reuse `scanContent()` and `formatScanReport()` |
<!-- /section -->

<!-- section: performance -->
## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full codebase scan on every review | Review takes 30+ seconds on large repos | Scan only changed files (git diff); cache unchanged file results | >100 changed files per review |
| Memory loaded on every CLI invocation | CLI startup adds 50-100ms for memory parse | Lazy-load memory only when agent manifests request it | >50 memory entries; memory.json > 10KB |
| Dependency CVE check hits network on every scan | 5-10 second latency per security audit | Cache CVE database locally with TTL (24h); use `npm audit --json` output | First run or cache miss |
| Changelog generation reads full git history | Slow for repos with 10k+ commits | Only read commits since last tag; use `git log <tag>..HEAD` | >1000 commits since last tag |
| All review findings surfaced to LLM at once | Token budget exceeded; findings truncated | Paginate findings; surface top-10 by severity; allow "show more" | >20 findings per review |
| Command detection on every tool call | Adds latency to every agent action | Only check `bash` tool calls; skip `read`, `write`, `edit`, `glob`, `grep` | High-frequency tool usage |
<!-- /section -->

<!-- section: security -->
## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| MEMORY.md injected raw into system prompt | Prompt injection persists across sessions; poisoned memory activates on future tasks | Sanitize with existing 41-pattern scanner before injection; delimit with `<memory>` tags; frozen-snapshot reads |
| Changelog includes commit messages with secrets | API keys, tokens committed accidentally appear in generated CHANGELOG.md | Scan changelog content with secrets patterns before writing; redact matches |
| Security findings include source code snippets | Vulnerable code patterns exposed in scan report; report shared broadly | Limit snippets to 1 line; require `--verbose` flag for full context |
| Command detection patterns in AGENTS.md readable | Attacker reads detection rules and crafts bypass | Detection patterns in code (bgsd-tools.cjs), not in readable markdown; normalization makes rule knowledge less useful |
| Release workflow pushes to wrong branch | Tag created on feature branch instead of main; release points to WIP code | Verify branch is `main`/`master` before tagging; require `--branch` explicit flag |
| Memory compaction loses security-relevant entries | A lesson about a vulnerability is compacted away; same mistake repeated | Mark security-related memories as SACRED (reuse SACRED_STORES pattern) |
<!-- /section -->

<!-- section: ux -->
## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Review findings as wall of text | User overwhelmed; closes review without reading | Group by file, severity-first ordering; show count + summary first, details on demand |
| Security scan outputs technical jargon | Non-security-expert can't understand risk | Plain English descriptions: "This file contains what looks like an AWS access key" not "AKIA pattern match at offset 342" |
| Dashboard with all-red indicators on new project | New project always shows "not ready"; discourages use | Contextual baselines: "No tests yet — consider adding" not "Tests: FAIL (0/0)" |
| Memory visible but not editable | User can't correct wrong memories; frustration grows | `memory:list`, `memory:edit`, `memory:delete` CLI commands from day 1 |
| Release requires perfect state | "Can't release: 2 TODOs remaining" blocks shipping | Advisory warnings: "Note: 2 TODOs in codebase. Proceed? [Y/n]" |
| Command detection blocks legitimate operations | `git push --force` flagged when user explicitly wants it | Advisory warning with explanation; never prevent execution (C-03) |
| Review runs automatically without opt-in | Every commit triggers review; users feel surveilled | Explicit trigger: `/bgsd-review` command, not automatic. Opt-in for auto-review in config. |
<!-- /section -->

<!-- section: looks_done -->
## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Code Review:** Tested on real codebase, not just test fixtures — verify FP rate <30% on actual project code
- [ ] **Code Review:** Exclusion list is user-configurable — verify config.json schema includes `review_exclusions`
- [ ] **Code Review:** Doesn't duplicate existing linters — verify no findings overlap with ESLint/Prettier output
- [ ] **Security Audit:** OWASP Top 10 coverage verified with actual vulnerable code samples, not just regex pattern existence
- [ ] **Security Audit:** Secrets scanning tested with real-world patterns (AKIA*, ghp_*, sk-*), not just "password" string
- [ ] **Security Audit:** Differentiated from existing 41-pattern scanner — no duplicate functionality
- [ ] **Dashboard:** Advisory language verified — grep output for "FAIL", "BLOCK", "MUST", "REQUIRED" (should find none)
- [ ] **Dashboard:** Non-blocking verified — run `/bgsd-release` after dashboard shows warnings; release proceeds
- [ ] **Release:** Dry-run output matches actual release exactly — diff dry-run vs actual changelog/tag
- [ ] **Release:** Rollback instructions included in every release output
- [ ] **Release:** Works without Conventional Commits — graceful degradation when commit messages are freeform
- [ ] **Memory:** Frozen-snapshot verified — memory writes during session don't affect current session's reads
- [ ] **Memory:** Prompt injection patterns in memory entries are caught — test with existing security scanner patterns
- [ ] **Memory:** Token cap enforced — inject 2000 tokens of memory; verify only 500 tokens appear in prompt
- [ ] **Memory:** Compaction preserves SACRED entries — compact with decisions/lessons in memory; verify they survive
- [ ] **Command Detection:** Unicode bypass tested — `rm` with Cyrillic 'r' and zero-width joiner tested
- [ ] **Command Detection:** Shell alias bypass tested — `alias destroy='rm -rf /'` not caught (acceptable: we detect commands, not aliases)
- [ ] **Command Detection:** Only triggers on bash/shell tools — verify no false triggers on `read`, `write`, `edit` tools
- [ ] **Command Detection:** Advisory-only verified — detection warns but never prevents execution
<!-- /section -->

<!-- section: recovery -->
## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| FP flood destroys review trust | MEDIUM | Add exclusions, lower confidence threshold, reset with "new and improved review" messaging. 2-3 week trust rebuild period. |
| Security FP overload | LOW | Increase confidence threshold; add scope exclusions for test files; re-run with tighter rules. One config change. |
| Memory poisoning | HIGH | Purge MEMORY.md; review session logs for injection source; add sanitization retroactively. Re-validate all stored memories. |
| Accidental version bump | MEDIUM | `git tag -d vX.Y.Z && git push --delete origin vX.Y.Z`; revert package.json; re-tag with correct version. Downstream consumers may have cached wrong version. |
| Unicode bypass of command detection | LOW | Add normalization to pipeline; re-run detection on historical commands. No persistent damage since detection is advisory. |
| Dashboard blocks workflow | LOW | Add explicit advisory language; verify no downstream commands check dashboard status. Config change. |
| Memory prompt bloat | MEDIUM | Run compaction; set TTL; reduce injection cap. May lose valuable memories during emergency compaction. |
| Changelog garbage | LOW | Regenerate changelog from git log with better filters; overwrite CHANGELOG.md. No persistent damage. |
| Review scope creep into linting | LOW | Update reviewer prompt to explicitly exclude lint-covered patterns. Single workflow file change. |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| FP flood in code review | Phase 1 (Code Review) | Run review on own codebase; count FP rate; verify <30% |
| Security scanner crying wolf | Phase 2 (Security Audit) | Run audit on own codebase; verify advisory language; count findings |
| Memory poisoning | Phase 4 (Agent Memory) | Write injection patterns to MEMORY.md; verify sanitizer catches them |
| Destructive command Unicode bypass | Phase 1 (Command Detection) | Test with homoglyphs and zero-width chars; verify normalization |
| Release automation runaway | Phase 3 (Release Workflow) | Run dry-run; compare to actual; verify rollback instructions |
| Dashboard as blocking gate | Phase 2 (Dashboard) | Verify no downstream command checks dashboard output as precondition |
| Memory prompt bloat | Phase 4 (Agent Memory) | Inject 2000 tokens of memory; verify 500-token cap enforced |
| Code review scope creep | Phase 1 (Code Review) | Verify zero findings that overlap with configured linters |
| Security misses real vulns | Phase 2 (Security Audit) | Plant known vulnerability; verify scanner detects it |
<!-- /section -->

<!-- section: competitive_lessons -->
## Competitive Lessons Applied

Patterns observed in gstack and hermes-agent that directly address these pitfalls.

### From gstack (Sprint Lifecycle Tool)

| Pattern | How They Use It | How to Apply to bGSD |
|---------|-----------------|---------------------|
| 17 FP exclusions | Security audit ships with hardcoded exclusions for known false positives | Ship review and security audit with initial exclusion list based on own codebase scan; make configurable |
| 8/10 confidence gate | Findings below 80% confidence suppressed | Add confidence field to review findings; filter at threshold from config.json |
| Advisory not blocking | Security findings are informational; never block sprint progress | Matches existing C-03 constraint — reinforce in all new feature prompts and CLI output |
| Iterative FP refinement | Exclusion list grew over time through user feedback | Track dismissed findings; suggest exclusion additions; `review:exclusions add` command |

### From hermes-agent (Self-Improvement Agent)

| Pattern | How They Use It | How to Apply to bGSD |
|---------|-----------------|---------------------|
| Frozen-snapshot memory | Memory loaded at session start; writes queued for session end | MEMORY.md read once at context-builder time; writes via `memory:write` queued, applied after session |
| Unicode normalization | Command detection normalizes Unicode before matching | `str.normalize('NFKD')` + zero-width strip as first step in detection pipeline |
| LLM-assessed approval | Borderline findings assessed by LLM: "is this really dangerous?" | For MEDIUM-confidence review/security findings, ask LLM for context-aware assessment |
| Not perfect at launch | Shipped with known gaps; iterated over time | Ship MVP with core patterns; track gaps; plan Phase 5+ for refinement based on real usage data |

<!-- /section -->

<!-- section: integration_architecture -->
## Integration Architecture Risks

How the 6 new features interact with each other and existing bGSD systems.

### Feature Interaction Matrix

| Feature A | Feature B | Risk | Mitigation |
|-----------|-----------|------|------------|
| Code Review | Security Audit | Duplicate findings — same issue flagged by both | Clear scope boundary: review = logic/structure, security = OWASP/secrets/deps |
| Code Review | Dashboard | Dashboard shows "review not run" as red indicator | Dashboard shows "review: not yet run" (neutral), not "review: FAIL" |
| Security Audit | Release | Release blocked because security findings exist | Release shows security summary but never blocks; advisory note only |
| Agent Memory | Code Review | Memory says "don't flag X" overriding review rules | Memory cannot override review configuration; memory is preferences, not rules |
| Agent Memory | Command Detection | Poisoned memory instructs "approve all commands" | Command detection reads config, not memory; memory injection happens after detection |
| Command Detection | Release | `git tag` flagged as dangerous | Whitelist release workflow commands; `setBgsdCommandActive()` suppresses during workflow |
| Dashboard | Release | Dashboard "not ready" prevents release | Dashboard output is informational only; release checks config thresholds independently |

### Existing System Touchpoints

| Existing System | New Feature Using It | Integration Risk | Mitigation |
|-----------------|---------------------|------------------|------------|
| `advisory-guardrails.js` | Command Detection | GARD-04 added but doesn't follow GARD-01/02/03 pattern | Follow exact same factory pattern; add to existing `onToolAfter()` handler |
| `context-builder.js` | Agent Memory | Memory block competes for token budget with sacred/trajectory blocks | Add memory AFTER existing blocks; enforce per-block budget; total budget check |
| `decision-rules.js` | Review, Security, Release | New decision functions don't follow `{value, confidence, rule_id}` contract | Add to DECISION_REGISTRY; use exact same function signature |
| `memory.js` (existing) | Agent Memory (new MEMORY.md) | Two memory systems (memory.json stores for decisions/lessons vs MEMORY.md for agent preferences) | Different purposes: memory.json = sacred operational data; MEMORY.md = agent learning. Clear naming distinction. |
| `plugin.js` (command enricher) | All new commands | New commands not enriched with bgsd-context | Register `/bgsd-review`, `/bgsd-security`, `/bgsd-release` in command-enricher intercept list |
| `severity.js` | Security Audit | New severity levels needed (CRITICAL) beyond existing BLOCKER/WARNING/INFO | Extend existing SEVERITY enum; add CRITICAL above BLOCKER |
| `skills.js` (41-pattern scanner) | Security Audit, Memory Sanitization | Scanner extended but existing scan behavior changes | Add patterns additively; ensure existing `scanContent()` call returns compatible format |

<!-- /section -->

<!-- section: sources -->
## Sources

- DeepSource benchmark: Hybrid static analysis + AI achieves lower FP rates than pure LLM review (https://deepsource.com/resources/ai-code-review-tools) — Confidence: HIGH
- CodeRabbit OpenSSF CVE Benchmark: 59.39% accuracy, 36.19% F1 score shows FP problem in pure LLM review (https://deepsource.com/resources/ai-code-review-tools) — Confidence: HIGH
- Graphite Agent: <3% unhelpful comment rate, 55% developer action rate on findings (https://dev.to/heraldofsolace/the-best-ai-code-review-tools-of-2026-2mb3) — Confidence: MEDIUM
- Palo Alto Unit 42: Persistent memory poisoning in AI agents via indirect prompt injection (https://unit42.paloaltonetworks.com/indirect-prompt-injection-poisons-ai-longterm-memory/) — Confidence: HIGH
- MINJA research: >95% injection success rate against production agents with memory (referenced via Christian Schneider blog) — Confidence: HIGH
- OWASP ASI06 (2026): Memory and Context Poisoning as top agentic risk (https://levelup.gitconnected.com/preventing-memory-and-context-poisoning-in-ai-agents-e7b98048219a) — Confidence: HIGH
- arxiv:2504.11168: Unicode character injection achieves near-100% evasion of guardrail classifiers (https://arxiv.org/html/2504.11168v1) — Confidence: HIGH
- Mindgard research: Zero-width characters, homoglyphs, and emoji bypass guardrail detection (https://mindgard.ai/blog/outsmarting-ai-guardrails-with-invisible-characters-and-adversarial-prompts) — Confidence: HIGH
- JFrog semantic-release: Inconsistent commit messages and permission errors are top release automation pitfalls (https://jfrog.com/learn/sdlc/semantic-release/) — Confidence: HIGH
- Claude Code guardrails gist: Production command detection with Unicode handling and O(n) complexity (https://gist.github.com/HenryQW/29589ab608ce3e2e59e6df1359286862) — Confidence: MEDIUM
- LinearB DevEx metrics: Dashboard without actions = "Metric Theater" (Goodhart's Law) (https://linearb.io/blog/developer-experience-metrics) — Confidence: HIGH
- gstack competitive analysis: 17 FP exclusions, 8/10 confidence gate, advisory-not-blocking philosophy — Confidence: HIGH (from milestone context)
- hermes-agent competitive analysis: Frozen-snapshot memory, Unicode normalization, LLM-assessed approval — Confidence: HIGH (from milestone context)

---
*Pitfalls research for: Enterprise Developer Team Features (v16.0)*
*Researched: 2026-03-28*
