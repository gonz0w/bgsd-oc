# Requirements

**Milestone:** v16.0 Enterprise Developer Team
**Generated:** 2026-03-28

## Traceability

Traceability matrix at bottom.

---

## Category: SAFE (Safety & Destructive Command Detection)

### Requirements

- [x] **SAFE-01:** Destructive command pattern library — 25+ regex patterns detecting dangerous operations (rm -rf, DROP TABLE, force-push, format disk, kill -9, etc.) with Unicode NFKD normalization to prevent homoglyph bypass

- [x] **SAFE-02:** User confirmation gate — When destructive command detected, present advisory warning with command details, risk assessment, and confirmation prompt; non-blocking per C-03 (user can always proceed)

- [x] **SAFE-03:** Container/sandbox bypass — Detect Docker, Singularity, Modal, Daytona environments and skip confirmation (sandboxed execution is inherently safer); configurable override

---

## Category: MEM (Structured Agent Memory)

### Requirements

- [ ] **MEM-01:** MEMORY.md file format — Structured markdown file in `.planning/` with sections for project facts, user preferences, environment patterns, and correction history; human-readable and git-trackable

- [ ] **MEM-02:** Frozen-snapshot prompt injection — Inject MEMORY.md contents into agent system prompts at session start as a frozen snapshot; mid-session writes update disk but NOT the active prompt (preserves prompt caching)

- [ ] **MEM-03:** Memory content sanitization — Scan memory entries for prompt injection patterns before injecting into system prompts; block entries matching threat patterns with clear warnings

- [ ] **MEM-04:** Memory management CLI — `memory:list`, `memory:add`, `memory:remove`, `memory:prune` commands for managing MEMORY.md entries; `memory:prune` removes stale entries older than configurable threshold

---

## Category: REV (Code Review Workflow)

### Requirements

- [ ] **REV-01:** Code review CLI module — `review:scan` command analyzing staged/committed changes; produces structured JSON findings with file, line, category, severity, confidence score, and suggested fix

- [ ] **REV-02:** Fix-first categorization — Findings classified as AUTO-FIX (mechanical issues the system can fix silently), ASK (judgment calls requiring user input), or INFO (advisory notices); AUTO-FIX items applied directly, ASK items batched into single user question

- [ ] **REV-03:** Confidence-gated output — 8/10 confidence threshold for reported findings; suppress low-confidence findings to reduce noise; threshold configurable in project config

- [ ] **REV-04:** `/bgsd-review` workflow — Slash command orchestrating CLI analysis (review:scan) + verifier agent judgment pass; two-stage review: structural audit then quality assessment

- [ ] **REV-05:** False positive exclusion list — Project-local `.planning/review-exclusions.json` with patterns to suppress known FPs; exclusions carry reason and author for auditability

---

## Category: SEC (Security Audit Workflow)

### Requirements

- [ ] **SEC-01:** OWASP Top 10 pattern library — Security scanning patterns covering injection, broken auth, sensitive data exposure, XXE, broken access control, security misconfiguration, XSS, insecure deserialization, known vulnerabilities, insufficient logging

- [ ] **SEC-02:** Secrets-in-code detection — Pattern-based scanning for API keys, tokens, passwords, connection strings, private keys in source files; configurable allowlist for test fixtures and examples

- [ ] **SEC-03:** Dependency vulnerability check — Parse package.json/requirements.txt/go.mod for known vulnerable versions; check against advisory databases; report severity and remediation

- [ ] **SEC-04:** `/bgsd-security` workflow — Slash command orchestrating security:scan CLI + verifier agent assessment; confidence-gated findings with 8/10 threshold; independent verification of each finding before reporting

- [ ] **SEC-05:** Security false positive exclusions — Project-local `.planning/security-exclusions.json` with suppressed patterns; separate from code review exclusions; includes reason and expiry date

---

## Category: READY (Review Readiness Dashboard)

### Requirements

- [ ] **READY-01:** Readiness CLI command — `review:readiness` command returning JSON with pass/fail/skip status for: tests passing, lint clean, review findings resolved, security findings resolved, TODOs in diff, changelog updated

- [ ] **READY-02:** Advisory-only output — Dashboard is informational only, never blocks any workflow; clearly labeled as advisory per C-03 constraint; TTY mode shows color-coded status, JSON mode for piping

---

## Category: REL (Automated Release Workflow)

### Requirements

- [ ] **REL-01:** Semver version bump — `release:bump` command analyzing conventional commits since last tag to determine major/minor/patch bump; supports manual override; updates version files

- [ ] **REL-02:** Changelog generation — `release:changelog` command generating CHANGELOG.md entries from plan summaries + conventional commit messages; groups by type (feat, fix, docs, etc.)

- [ ] **REL-03:** Git tag and PR automation — `release:tag` creates annotated git tag; `release:pr` creates release PR with changelog diff as body; integrates with existing github-ci workflow

- [ ] **REL-04:** `/bgsd-release` workflow — Slash command orchestrating version bump → changelog → tag → PR with dry-run default; user confirms before any git mutations; confirmation gate prevents accidental releases

---

## Out of Scope

- Browser-based E2E testing (requires Playwright/headless browser — defer to v17.0)
- Post-deploy production monitoring (requires external service awareness — defer to v17.0)
- Cross-model validation / Mixture of Agents (requires multi-provider config — defer to v17.0)
- Sprint retrospective workflow (defer to v16.1)
- Test coverage enforcement (defer to v16.1)
- Skill auto-creation from execution patterns (defer to v16.1)
- Lesson-to-agent automatic feedback loop (defer to v16.1)
- Session search with FTS5 (defer to v16.1)
- Prompt injection scanning of context files (defer to v16.1)

---

## Future Requirements

- **FUT-01:** E2E browser testing workflow — Real browser QA with accessibility tree refs (gstack pattern)
- **FUT-02:** Post-deploy canary monitoring — Console error and perf regression detection after merge
- **FUT-03:** Cross-model validation — Second opinion from different model provider for critical decisions
- **FUT-04:** Sprint retrospective — `/bgsd-retro` with velocity trends, failure patterns, improvement areas
- **FUT-05:** Test coverage enforcement — Auto-detect untested code paths, generate test stubs
- **FUT-06:** Skill auto-creation — Suggest saving approach as reusable skill after complex executions
- **FUT-07:** Session search — FTS5-backed search across past decisions, blockers, and lessons
- **FUT-08:** Prompt injection scanning — Runtime detection of injection patterns in context files

---

## Traceability Matrix

| REQ-ID | Type | Phase | Intent Outcome | Priority |
|---------|------|-------|----------------|----------|
| SAFE-01 | must | Phase 144 | DO-114 | HIGH |
| SAFE-02 | must | Phase 144 | DO-114 | HIGH |
| SAFE-03 | should | Phase 144 | DO-114 | MEDIUM |
| MEM-01 | must | Phase 145 | DO-113 | HIGH |
| MEM-02 | must | Phase 145 | DO-113 | HIGH |
| MEM-03 | must | Phase 145 | DO-113 | HIGH |
| MEM-04 | must | Phase 145 | DO-113 | MEDIUM |
| REV-01 | must | Phase 146 | DO-109 | HIGH |
| REV-02 | must | Phase 146 | DO-109 | HIGH |
| REV-03 | must | Phase 146 | DO-109 | HIGH |
| REV-04 | must | Phase 146 | DO-109, DO-111 | HIGH |
| REV-05 | should | Phase 146 | DO-109 | MEDIUM |
| SEC-01 | must | Phase 147 | DO-110 | HIGH |
| SEC-02 | must | Phase 147 | DO-110 | HIGH |
| SEC-03 | should | Phase 147 | DO-110 | MEDIUM |
| SEC-04 | must | Phase 147 | DO-110 | HIGH |
| SEC-05 | should | Phase 147 | DO-110 | MEDIUM |
| READY-01 | must | Phase 148 | DO-111 | HIGH |
| READY-02 | must | Phase 148 | DO-111 | HIGH |
| REL-01 | must | Phase 148 | DO-112 | HIGH |
| REL-02 | must | Phase 148 | DO-112 | HIGH |
| REL-03 | must | Phase 148 | DO-112 | HIGH |
| REL-04 | must | Phase 148 | DO-112 | HIGH |

---

*Requirements confirmed: 2026-03-28*
