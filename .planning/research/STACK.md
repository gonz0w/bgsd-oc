# Stack Research — Enterprise Developer Team Features

**Domain:** Code review automation, security audit, release management, agent memory, and safety guardrails for an existing Node.js CLI plugin (52 src/ modules, zero runtime deps, esbuild-bundled CJS).
**Researched:** 2026-03-28
**Confidence:** HIGH

<!-- section: compact -->
<stack_compact>
<!-- Compact view for planners. Keep under 25 lines. -->

**Core approach:** Build ALL six features from first principles using existing infrastructure. Zero new runtime dependencies.

| Feature | Built With | Key Infrastructure |
|---------|-----------|-------------------|
| Code review workflow | acorn AST + git.js diff + regex patterns | Extends existing `review/severity.js` classification |
| Security audit | New regex pattern DB (like `skills.js` 41-pattern scanner) | OWASP/secrets patterns as structured data |
| Review readiness dashboard | git.js + detect.js + execFileSync orchestration | Aggregates existing subsystems (tests, lint, TODOs) |
| Automated release | git.js tags + regex semver parsing + changelog from `structuredLog` | Extends existing `phase.js` tag/changelog code |
| Agent memory (MEMORY.md) | Existing `memory.js` stores + SQLite tables + markdown generation | Extends existing sacred data dual-write pattern |
| Destructive command detection | Regex pattern matching (like `skills.js` scanner) | Extends advisory-guardrails.js plugin hook |

**No new libraries.** Semver parsing: 30-line regex (already done in `detector.js`). Changelog: extend `structuredLog()`. Secrets scanning: curated regex DB from `secrets-patterns-db` (data, not dependency). Security patterns: structured data arrays like existing `SECURITY_PATTERNS` in `skills.js`.

**Avoid:** semver npm package (24KB, overkill — we need parse+compare only), conventional-changelog (44KB + 9 deps), any SAST library (wrong granularity), eslint-plugin-security (requires eslint runtime)
</stack_compact>
<!-- /section -->

<!-- section: recommended_stack -->
## Recommended Stack

### Core Technologies

**No new runtime dependencies.** All features built on existing infrastructure.

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| acorn (existing, bundled) | ^8.16.0 | AST analysis for code review structural audit | Already bundled; provides function signatures, complexity metrics, export analysis — exactly what code review needs |
| node:sqlite (existing) | Node 22.5+ | Persistent agent memory, review findings cache | Already in use for planning tables; schema migration v6 adds memory/review tables |
| git.js (existing) | internal | Diff analysis, changelog generation, tag management | `structuredLog()` already parses conventional commits; `diffSummary()` provides file-level stats; `execGit()` handles tag creation |
| review/severity.js (existing) | internal | Finding classification (BLOCKER/WARNING/INFO) | Already classifies security, syntax, unused code patterns — extend with new categories |
| advisory-guardrails.js (existing) | internal | Plugin-level command interception for safety | Already intercepts tool execution in ESM plugin; GARD-01/02/03 pattern extends to GARD-04 (destructive command detection) |
| skills.js SECURITY_PATTERNS (existing) | internal | Pattern-based scanning infrastructure | 41-pattern security scanner with severity-first grouping — architecture extends to OWASP/secrets scanning |

### New Internal Modules (No External Dependencies)

| Module | Purpose | Lines Estimate | Extends |
|--------|---------|---------------|---------|
| `src/lib/review/code-review.js` | Structural audit: dead exports, complexity hotspots, convention violations | ~300 | acorn AST + `review/severity.js` |
| `src/lib/review/security-scanner.js` | OWASP Top 10 + secrets detection regex DB | ~400 | `skills.js` SECURITY_PATTERNS architecture |
| `src/lib/review/readiness.js` | Dashboard aggregation: tests, lint, coverage, TODOs, git status | ~200 | `detect.js` + `git.js` + `execFileSync` |
| `src/lib/release.js` | Semver parsing, version bump, changelog generation, tag/PR creation | ~250 | `git.js` + `cli-tools/gh.js` |
| `src/lib/agent-memory.js` | MEMORY.md generation from structured stores, prompt injection | ~200 | `memory.js` stores + `context-builder.js` |
| `src/lib/safety/destructive-detector.js` | Pattern-based destructive command detection | ~250 | `advisory-guardrails.js` GARD pattern |
| `src/commands/review.js` | CLI commands: `review:code`, `review:security`, `review:readiness` | ~400 | Standard command pattern |
| `src/commands/release.js` | CLI commands: `release:bump`, `release:changelog`, `release:create` | ~300 | Standard command pattern |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| esbuild (existing) | Bundle new modules into `bin/bgsd-tools.cjs` | No config changes needed — new `src/` files auto-included |
| node:test (existing) | Test new modules | Add `tests/review.test.cjs`, `tests/release.test.cjs`, `tests/safety.test.cjs` |
| secrets-patterns-db (reference data only) | Source of curated regex patterns for secrets scanning | **NOT a dependency** — copy ~40 highest-value patterns as inline data |

## Installation

```bash
# No new packages to install.
# All features built on existing infrastructure.
#
# The only "installation" is creating new source files:
#   src/lib/review/code-review.js
#   src/lib/review/security-scanner.js
#   src/lib/review/readiness.js
#   src/lib/release.js
#   src/lib/agent-memory.js
#   src/lib/safety/destructive-detector.js
#   src/commands/review.js
#   src/commands/release.js
#
# Then: npm run build (esbuild bundles everything)
```
<!-- /section -->

<!-- section: detailed_analysis -->
## Feature-by-Feature Stack Analysis

### 1. Code Review Workflow (`/bgsd-review`)

**What exists:**
- `src/lib/ast.js` (1186 lines): Full acorn-based AST parsing with `parseWithAcorn()`, `extractFunctionSignatures()`, `analyzeComplexity()`, `analyzeExports()`, TypeScript stripping
- `src/lib/review/severity.js` (139 lines): BLOCKER/WARNING/INFO classification with regex-based pattern matching
- `src/lib/git.js`: `diffSummary()` for file-level change analysis, `structuredLog()` for conventional commit parsing
- `src/lib/conventions.js`: Naming convention extraction with confidence scoring

**What to build:**
- Structural audit engine: Use AST to detect dead exports, high-complexity functions (>15 cyclomatic), inconsistent patterns across changed files
- Auto-fix capability: For simple issues (unused imports, missing semicolons) — generate patch output, not in-place edits
- Batched user questions: Collect ambiguous findings, present as single checkpoint (like existing `checkpointAdvisor.js`)

**Why no library:** eslint-plugin-security requires ESLint runtime (200KB+). SonarJS requires SonarQube server. acorn + regex patterns cover 90% of structural review needs at 0KB additional bundle cost.

**Confidence:** HIGH — acorn AST already provides all primitives needed. The v7.0 `gsd-reviewer` agent already does two-stage review (spec + quality) via prompts; this adds CLI-backed structural analysis.

### 2. Security Audit Workflow (`/bgsd-security`)

**What exists:**
- `src/commands/skills.js`: 41-pattern security scanner (`SECURITY_PATTERNS` array) with category grouping, severity classification (`dangerous`/`warn`), and `formatScanReport()` — **this is the exact architecture to extend**
- `src/lib/review/severity.js`: Already classifies `security|vulnerability|injection|expose|credential` as BLOCKER

**What to build:**
- **OWASP Top 10 patterns** (~30 regex patterns): SQL injection sinks, XSS output points, path traversal, insecure deserialization, SSRF patterns, hardcoded credentials, weak crypto
- **Secrets detection** (~40 regex patterns): AWS keys (`AKIA[0-9A-Z]{16}`), GitHub tokens (`ghp_[a-zA-Z0-9]{36}`), generic high-entropy strings, private key headers, connection strings
- **Dependency vulnerability check**: Shell out to `npm audit --json` or `gh api` for known CVEs
- **Confidence-gated findings**: HIGH confidence (exact pattern match) vs LOW confidence (heuristic/entropy) — only BLOCKER for HIGH confidence

**Data source for patterns:** [mazen160/secrets-patterns-db](https://github.com/mazen160/secrets-patterns-db) provides 1600+ curated regex patterns. **Do not add as dependency.** Copy the top ~40 highest-value patterns (AWS, GitHub, Slack, Stripe, generic API key, JWT, private key) as inline structured data, following the exact `SECURITY_PATTERNS` array format in `skills.js`.

**Why no library:** The existing `skills.js` scanner architecture (pattern array → scan → severity grouping → formatted report) is exactly the right abstraction. Adding `@bytehide/secrets-scanner` or `gitleaks` would add runtime deps and wouldn't integrate with the existing severity/reporting pipeline.

**Confidence:** HIGH — architectural pattern is proven (41 patterns already work this way). Pattern curation is the work, not infrastructure.

### 3. Review Readiness Dashboard

**What exists:**
- `src/lib/cli-tools/detector.js`: Tool detection for `gh`, test runners, lint tools
- `src/lib/git.js`: Working tree status, uncommitted changes detection
- `src/commands/verify.js`: Health check command with tool status (advisory, non-blocking)
- `src/lib/format.js`: `formatTable()`, `progressBar()`, `box()` for terminal output

**What to build:**
- Aggregation command that runs: `node --test` (or detected test runner), lint check, `git status --porcelain`, TODO/FIXME grep, coverage report parsing
- Pre-ship checklist with pass/fail per category
- JSON output for workflow consumption + TTY-aware formatted output

**Why no library:** Each check is a single `execFileSync` call to existing tools. The aggregation is ~50 lines of orchestration. No library provides this specific aggregation for arbitrary projects.

**Confidence:** HIGH — pure orchestration of existing primitives.

### 4. Automated Release Workflow (`/bgsd-release`)

**What exists:**
- `src/lib/git.js`: `structuredLog()` already parses conventional commits (`type(scope): description`), `execGit()` for all git operations
- `src/commands/phase.js` (lines 1144-1235): Existing milestone completion already generates changelog from git log, creates annotated tags, and commits
- `src/lib/cli-tools/gh.js`: GitHub CLI wrapper with `createPR()`, `listPRs()`, authentication pre-flight
- `src/lib/cli-tools/detector.js`: `parseVersion()` already does basic semver parsing (major.minor.patch extraction)

**What to build:**
- **Semver parsing/bumping** (~30 lines): Parse `X.Y.Z` from package.json/VERSION file, apply bump rule (major/minor/patch), write back. The `detector.js` `parseVersion()` already extracts major/minor/patch — extend with `bumpVersion(current, type)`.
- **Changelog generation** (~80 lines): Group `structuredLog()` commits by conventional commit type (feat→Features, fix→Fixes, etc.), format as markdown sections. The phase.js milestone completion already does basic changelog — refactor and enhance.
- **Release orchestration** (~100 lines): Version bump → changelog → git tag → git commit → `gh pr create` (or `gh release create`). Sequence of existing git.js + gh.js calls.

**Why NOT use npm `semver` (24KB bundled, 0 deps):** The full semver spec (ranges, pre-release, build metadata, satisfies/intersects/coerce) is massive overkill. We need exactly two operations: `parse("1.2.3") → {major:1, minor:2, patch:3}` and `bump({major:1, minor:2, patch:3}, "minor") → "1.3.0"`. That's 30 lines of code. The existing `parseVersion()` in `detector.js` already does the parse half.

**Why NOT use `conventional-changelog` (44KB + 9 transitive deps):** It requires handlebars templates, git-client abstractions, and package.json normalization. We already have `structuredLog()` returning parsed conventional commits. Grouping by type and formatting as markdown is ~80 lines.

**Confidence:** HIGH — all building blocks exist. This is primarily refactoring `phase.js` milestone code into a reusable release module.

### 5. Structured Agent Memory (MEMORY.md)

**What exists:**
- `src/commands/memory.js`: Full CRUD for 5 stores (decisions, bookmarks, lessons, todos, trajectories) with sacred data protection, compaction, and SQLite dual-write
- `src/plugin/context-builder.js`: Builds `<sacred>` block injected into every prompt with critical project data
- `src/lib/db.js`: Schema versioning with migration runner, WAL mode, statement caching

**What to build:**
- **MEMORY.md generator** (~80 lines): Read from existing memory stores (decisions, lessons, trajectories), format as concise markdown for agent consumption. Filter by recency and relevance (last N decisions, lessons from current milestone).
- **Prompt injection** (~40 lines): Extend `context-builder.js` to include MEMORY.md summary in `<sacred>` block. Apply token budget (~2K tokens for memory section).
- **Cross-session learning** (~60 lines): After each milestone completion, auto-capture key patterns (recurring failures, successful strategies) into a new `learning` memory store. Use existing `lessons:capture` + `lessons:analyze` pipeline.
- **SQLite table** (~20 lines): Add `agent_memory` table in migration v6 for structured memory entries with `type`, `content`, `relevance_score`, `last_accessed` columns.

**Why no library:** The entire memory infrastructure already exists. MEMORY.md is a *view* over existing data stores, not a new storage system. The `memory.js` + `db.js` + `context-builder.js` pipeline handles everything.

**Confidence:** HIGH — this is extending an existing, proven pattern. hermes-agent's SQLite+FTS5 approach is overkill; bGSD already has SQLite stores and the dual-write pattern handles persistence.

### 6. Destructive Command Detection

**What exists:**
- `src/plugin/advisory-guardrails.js`: Plugin-level tool execution interception with GARD-01/02/03 patterns, notification system, debounced batching
- `src/commands/skills.js`: `SECURITY_PATTERNS` array with pattern→severity→category classification — exactly the architecture needed
- `src/lib/git.js`: `PROTECTED_PATHS` array and `isProtectedPath()` — existing path protection pattern

**What to build:**
- **Destructive command pattern DB** (~100 lines as data): Regex patterns for dangerous operations organized by category:
  - **Git:** `git push --force`, `git reset --hard`, `git clean -fd`, `git branch -D`, `git rebase` (on main/master)
  - **Filesystem:** `rm -rf /`, `rm -rf ~`, `rm -rf .`, `chmod -R 777`, `chown -R`
  - **Database:** `DROP TABLE`, `DROP DATABASE`, `TRUNCATE`, `DELETE FROM` (without WHERE)
  - **Docker/Infra:** `docker system prune -af`, `docker rm -f`, `kubectl delete namespace`
  - **Package:** `npm publish` (accidental), `npm unpublish`
  - **Shell:** `:(){ :|:& };:` (fork bomb), `> /dev/sda`, `mkfs`

**Pattern count target:** ~25-30 high-confidence patterns (matching hermes-agent's 25+ patterns). Each pattern includes: regex, severity (`block`/`warn`), category, description, and suggested safe alternative.

- **Plugin integration** (~50 lines): Add GARD-04 to `advisory-guardrails.js` that intercepts `tool.execute` events, extracts shell commands from tool input, matches against pattern DB, and emits warning/block notification via existing notification system.

**Why no library:** hermes-agent builds this with ~25 Python regex patterns. The exact same approach works in JavaScript. The `SECURITY_PATTERNS` architecture in `skills.js` proves this pattern works at scale (41 patterns, category grouping, severity classification, formatted reports).

**Confidence:** HIGH — pattern-based detection is well-understood. The advisory-guardrails plugin hook already intercepts tool execution. This is adding a new pattern database and a new guardrail type.

<!-- /section -->

<!-- section: alternatives -->
## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Inline semver parsing (30 lines) | `semver` npm package (24KB, 0 deps) | If you need range satisfaction (`^1.2.3`), pre-release comparison, or coercion — none of which this project needs |
| `structuredLog()` → grouped changelog | `conventional-changelog` (44KB + 9 deps) | If you need Angular/Atom/ESLint preset formatting, or want handlebars-templated output — overkill for grouped-by-type markdown |
| Inline security patterns (data array) | `eslint-plugin-security` | If the project runs ESLint already and wants rule-level granularity — bGSD is a CLI tool, not an ESLint plugin |
| Curated 40-pattern secrets DB | `@bytehide/secrets-scanner`, `gitleaks` | If you need 1600+ patterns or binary distribution — overkill for a CLI plugin that scans its own project files |
| SQLite + MEMORY.md view | Vector database (Pinecone, Qdrant) | If you need semantic similarity search across thousands of memory entries — bGSD has dozens of entries, not thousands |
| Regex destructive detection (25 patterns) | Shell AST parsing (bashlex, shlex) | If you need to parse complex shell pipelines — regex catches 95%+ of dangerous commands with zero deps |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `semver` npm package | 24KB for 2 operations (parse + bump) we can write in 30 lines | Inline `parseSemver()` + `bumpVersion()` in `release.js` |
| `conventional-changelog` | 44KB + 9 transitive deps; requires handlebars, git-client abstractions | `structuredLog()` already parses conventional commits — group by type, format as markdown |
| `eslint-plugin-security` | Requires ESLint runtime (~200KB); wrong abstraction for a CLI tool | Regex pattern arrays following `SECURITY_PATTERNS` architecture |
| `gitleaks` / `trufflehog` | External binary dependency; not bundleable into CJS | Curate 40 highest-value patterns as inline data from secrets-patterns-db |
| `better-sqlite3` | Native binary; breaks single-file deploy | Continue using `node:sqlite` (already in use since v8.0) |
| Vector DB for memory | Wrong architecture per PROJECT.md "Out of Scope" | SQLite tables + MEMORY.md markdown view |
| Shell AST parsers | Heavy dependency for edge-case accuracy gain over regex | Regex patterns catch `rm -rf`, `git push --force`, `DROP TABLE` without parsing |
| `release-it` / `standard-version` | Full release management frameworks with many deps | Compose from existing git.js + gh.js primitives |
<!-- /section -->

<!-- section: patterns -->
## Stack Patterns by Feature

**Code Review — extending AST analysis:**
- Use `parseWithAcorn()` for structural analysis, `analyzeComplexity()` for hotspot detection
- Pattern: `git diff --name-only HEAD~1..HEAD` → filter `.js/.ts` files → AST-analyze each → classify findings with `severity.js`
- Integration point: `src/lib/review/` directory already exists with `severity.js`

**Security Audit — extending pattern scanner:**
- Use identical architecture to `SECURITY_PATTERNS` in `skills.js` (lines 13-94): `{ id, category, severity, pattern, description }` objects
- Pattern: Load file content → run all patterns → group by severity → format report
- Integration point: `scanSkillContent()` function in `skills.js` is the template

**Release — extending milestone completion:**
- Refactor `phase.js` lines 1144-1235 (changelog generation, tag creation) into reusable `src/lib/release.js`
- Pattern: Parse VERSION/package.json → bump → write → `structuredLog()` → group by type → write CHANGELOG.md → `git tag -a` → `gh pr create`
- Integration point: `git.js` execGit + `cli-tools/gh.js` createPR

**Agent Memory — extending context builder:**
- Use existing `memory.js` stores as source of truth; generate MEMORY.md as a view
- Pattern: Read decisions/lessons/trajectories → filter by recency → format as concise markdown → inject into `<sacred>` block
- Integration point: `plugin/context-builder.js` `buildSacredBlock()`

**Destructive Detection — extending advisory guardrails:**
- Add `GARD-04` following `GARD-01/02/03` pattern in `advisory-guardrails.js`
- Pattern: `tool.execute.after` event → extract command string → match against `DESTRUCTIVE_PATTERNS` array → emit notification
- Integration point: `advisory-guardrails.js` `onToolAfter()` method
<!-- /section -->

<!-- section: compatibility -->
## Version Compatibility

| Existing Package | Compatible With New Features | Notes |
|------------------|------------------------------|-------|
| Node.js >= 22.5 | All features | Required for `node:sqlite`; no new Node.js version requirements |
| acorn ^8.16.0 | Code review AST analysis | Already bundled via esbuild; no version change needed |
| esbuild ^0.27.3 | New source modules | Auto-bundles any file in `src/` — no config changes |
| node:sqlite | New migration v6 (agent_memory table) | Extends existing MIGRATIONS array in `db.js` |
| valibot ^1.2.0 | Schema validation for new commands | Can validate review/release command inputs |
| fast-glob ^3.3.3 | File discovery for security scanning | Already available for finding scannable files |

## Integration Points with Existing 52 Modules

| New Module | Depends On | Depended On By |
|------------|-----------|----------------|
| `review/code-review.js` | `ast.js`, `git.js`, `review/severity.js`, `conventions.js` | `commands/review.js`, workflows |
| `review/security-scanner.js` | `review/severity.js`, `git.js` | `commands/review.js`, workflows |
| `review/readiness.js` | `cli-tools/detector.js`, `git.js`, `format.js` | `commands/review.js` |
| `release.js` | `git.js`, `cli-tools/gh.js`, `format.js` | `commands/release.js`, workflows |
| `agent-memory.js` | `db.js`, `memory.js` (commands) | `plugin/context-builder.js`, workflows |
| `safety/destructive-detector.js` | (standalone pattern DB) | `plugin/advisory-guardrails.js` |

## Bundle Size Impact

| New Module | Est. Size (pre-minify) | Post-esbuild (minified) | Impact on ~500KB bundle |
|------------|----------------------|------------------------|------------------------|
| review/code-review.js | ~8KB | ~3KB | +0.6% |
| review/security-scanner.js | ~12KB (patterns are data) | ~5KB | +1.0% |
| review/readiness.js | ~5KB | ~2KB | +0.4% |
| release.js | ~7KB | ~3KB | +0.6% |
| agent-memory.js | ~5KB | ~2KB | +0.4% |
| safety/destructive-detector.js | ~8KB (patterns are data) | ~3KB | +0.6% |
| commands/review.js + release.js | ~18KB | ~7KB | +1.4% |
| **Total** | **~63KB** | **~25KB** | **+5.0%** |

Estimated total bundle size increase: ~25KB minified (~5% of current bundle). Well within acceptable limits.

## Sources

- `src/commands/skills.js` lines 13-94 — Existing 41-pattern security scanner architecture (HIGH confidence, verified in codebase)
- `src/lib/ast.js` — Existing acorn AST infrastructure (HIGH confidence, verified in codebase)
- `src/lib/git.js` — Existing git operations including structuredLog, diffSummary, tag creation (HIGH confidence, verified in codebase)
- `src/plugin/advisory-guardrails.js` — Existing GARD-01/02/03 pattern for plugin-level interception (HIGH confidence, verified in codebase)
- `src/commands/memory.js` — Existing 5-store memory system with sacred data protection (HIGH confidence, verified in codebase)
- `src/commands/phase.js` lines 1144-1235 — Existing changelog generation and tag creation (HIGH confidence, verified in codebase)
- [mazen160/secrets-patterns-db](https://github.com/mazen160/secrets-patterns-db) — 1600+ curated regex patterns for secrets detection (MEDIUM confidence, open-source reference data)
- [bundlephobia.com](https://bundlephobia.com/package/semver@7.7.4) — semver 7.7.4 is 24KB/0 deps; conventional-changelog 7.2.0 is 44KB/9 deps (HIGH confidence, verified via API)
- hermes-agent toolsets — 25+ pattern-based destructive command detection in Python (MEDIUM confidence, referenced from competitive analysis)
- [OWASP Top 10:2025](https://owasp.org/Top10/2025/en/) — Current vulnerability categories for security patterns (HIGH confidence, authoritative source)

<!-- /section -->

---
*Stack research for: Enterprise Developer Team features (v16.0)*
*Researched: 2026-03-28*
