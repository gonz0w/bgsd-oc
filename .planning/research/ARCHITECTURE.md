# Architecture Research

**Domain:** Enterprise developer team features for bGSD plugin (v16.0)
**Researched:** 2026-03-28
**Confidence:** HIGH

<!-- section: compact -->
<architecture_compact>
<!-- Compact view for planners. Keep under 30 lines. -->

**Architecture:** Extension-based integration into existing layered CLI + plugin + workflow architecture. Six features delivered as new CLI modules, workflows, plugin enhancements, and skills — zero new agents.

**Major new components:**

| Component | Responsibility | Layer |
|-----------|----------------|-------|
| `src/commands/review.js` | Code review analysis CLI (structural audit, anti-pattern detection) | CLI |
| `src/commands/security.js` | Security audit CLI (OWASP patterns, secrets scanning, dependency checks) | CLI |
| `src/commands/release.js` | Release pipeline CLI (semver bump, changelog gen, git tag, PR creation) | CLI |
| `src/commands/readiness.js` | Pre-ship dashboard CLI (tests, lint, coverage, TODOs aggregation) | CLI |
| `workflows/review.md` | Code review orchestration workflow (drives verifier agent) | Workflow |
| `workflows/security-audit.md` | Security audit orchestration workflow (drives verifier agent) | Workflow |
| `workflows/release.md` | Release pipeline orchestration workflow (drives executor agent) | Workflow |
| `src/plugin/advisory-guardrails.js` (extend) | GARD-04: Destructive command detection | Plugin |
| `src/plugin/context-builder.js` (extend) | MEMORY.md injection into system prompts | Plugin |
| `src/commands/memory.js` (extend) | Structured MEMORY.md read/write/compact | CLI |

**Key patterns:** Workflow-driven agent reuse (verifier for review+security, executor for release), CLI-first data generation, progressive trust (advisory→blocking), plugin hook extension

**Anti-patterns:** New agents (capped at 9), monolithic workflows, inline security rules, hardcoded version strings

**Scaling priority:** Memory file size (compaction needed), review performance on large codebases (file batching)
</architecture_compact>
<!-- /section -->

<!-- section: standard_architecture -->
## Standard Architecture

### System Overview — Integration Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                     SLASH COMMANDS (commands/*.md)                    │
│  /bgsd-review  /bgsd-security  /bgsd-release  /bgsd-readiness       │
├──────────┬──────────┬──────────┬──────────┬─────────────────────────┤
│          │          │          │          │                          │
│          ▼          ▼          ▼          ▼                          │
│     WORKFLOWS (workflows/*.md)                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                             │
│  │ review   │ │ security │ │ release  │                              │
│  │ .md      │ │-audit.md │ │ .md      │                              │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘                             │
│       │            │            │                                    │
│       ▼            ▼            ▼                                    │
│     AGENTS (existing — no new roles)                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                             │
│  │ verifier │ │ verifier │ │ executor │  ← reused existing agents    │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘                             │
│       │            │            │                                    │
├───────┴────────────┴────────────┴────────────────────────────────────┤
│              CLI MODULES (src/commands/*.js)                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│  │review.js │ │security  │ │release.js│ │readiness │                │
│  │          │ │.js       │ │          │ │.js       │                │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘                │
│       │            │            │            │                       │
├───────┴────────────┴────────────┴────────────┴───────────────────────┤
│              SHARED LIBRARIES (src/lib/*.js)                         │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐             │
│  │git.js│ │ast.js│ │format│ │deps  │ │config│ │output│             │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘             │
├─────────────────────────────────────────────────────────────────────┤
│              PLUGIN (src/plugin/*.js)                                 │
│  ┌───────────────────┐ ┌───────────────┐ ┌───────────────────────┐  │
│  │advisory-guardrails│ │context-builder│ │command-enricher       │  │
│  │ + GARD-04         │ │ + MEMORY.md   │ │ + review/security ctx │  │
│  └───────────────────┘ └───────────────┘ └───────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│              DATA LAYER                                              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────┐   │
│  │STATE.md    │ │.cache.db   │ │memory/     │ │MEMORY.md (new) │   │
│  │(generated) │ │(SQLite)    │ │(JSON store)│ │(cross-session)  │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Integration Points |
|-----------|----------------|-------------------|
| `review.js` | Structural code review: anti-pattern detection, consistency checks, complexity scoring, auto-fix suggestions | Consumes `ast.js` (complexity, exports), `conventions.js` (naming), `git.js` (diff extraction), `deps.js` (import analysis) |
| `security.js` | Security scanning: secrets patterns, OWASP rules, dependency vulnerability checks, confidence scoring | Consumes `ast.js` (code patterns), `deps.js` (dependency graph), `git.js` (diff for focused scanning) |
| `release.js` | Release pipeline: semver version bump, changelog generation from git log, git tag creation, PR creation via `gh` | Consumes `git.js` (structured log, branch info, tag), `detect.js` (gh preflight) |
| `readiness.js` | Pre-ship status dashboard: test results, lint status, coverage, TODO count, security findings aggregation | Consumes `review.js`, `security.js`, test runner, lint runner — aggregator pattern |
| `MEMORY.md` | Structured cross-session learning: agent preferences, project patterns, error resolutions, performance hints | Written by `memory.js` CLI, read by `context-builder.js` plugin, compacted by `memory:compact` |
| GARD-04 | Destructive command detection: warns on `rm -rf`, `git push --force`, `DROP TABLE`, production env access | Extends `advisory-guardrails.js` with new pattern matcher in `onToolAfter` hook |

<!-- /section -->

<!-- section: feature_architectures -->
## Feature Architectures

### Feature 1: Code Review Workflow (`/bgsd-review`)

**Agent mapping:** The **verifier** agent runs code reviews. Rationale: verifier already does goal-backward analysis ("did we build what we intended?"). Code review is the same pattern applied to code quality ("does this code meet standards?"). The verifier agent's skills (verification-reference, goal-backward) directly apply.

**Data flow:**
```
/bgsd-review [--scope phase|file|diff]
    ↓
commands/bgsd-review.md (thin wrapper)
    ↓
workflows/review.md (orchestration)
    ↓ calls
review:analyze CLI     →  Structural analysis JSON
    ↓                      (complexity, patterns, issues)
verifier agent         ←  Reads analysis + source code
    ↓
review:report CLI      →  Writes REVIEW.md report
    ↓ (if auto-fix)
executor agent         ←  Applies suggested fixes
```

**New CLI commands:**
- `review:analyze [--scope diff|phase|files] [--severity blocker|major|minor|all]` — Returns JSON with structural issues, complexity metrics, anti-pattern detections
- `review:report [--format md|json]` — Generates REVIEW.md from analysis results
- `review:auto-fix [--dry-run]` — Applies mechanical fixes (imports, naming, dead code)

**Key design decisions:**
- CLI does structural analysis (deterministic, testable); agent does judgment calls (context-dependent, nuanced)
- Two-pass architecture: Pass 1 = CLI scan → JSON findings; Pass 2 = agent reviews findings + source context → batched user questions
- Auto-fix is opt-in, mechanical only (import ordering, unused variables, naming convention). No semantic changes.
- Scope modes: `diff` (changed files only — default), `phase` (all files in current phase's plans), `files` (explicit file list)

**Integration with existing modules:**
- `ast.js`: Complexity metrics (cyclomatic), export analysis, function signatures
- `conventions.js`: Naming pattern detection for consistency checks
- `deps.js`: Import/dependency analysis for unused imports, circular dependencies
- `git.js`: `structuredDiff()` for extracting changed files and hunks

---

### Feature 2: Security Audit Workflow (`/bgsd-security`)

**Agent mapping:** The **verifier** agent runs security audits. Rationale: security auditing is verification — checking code against security requirements. The verifier's pattern of "derive must-haves → check codebase" maps directly to "derive security requirements → scan for violations."

**Data flow:**
```
/bgsd-security [--scope full|diff|deps]
    ↓
commands/bgsd-security.md (thin wrapper)
    ↓
workflows/security-audit.md (orchestration)
    ↓ calls
security:scan CLI      →  Pattern-matched findings JSON
    ↓                      (secrets, OWASP, dependencies)
verifier agent         ←  Reviews findings, triages severity
    ↓                      eliminates false positives
security:report CLI    →  Writes SECURITY.md report
```

**New CLI commands:**
- `security:scan [--scope full|diff|deps] [--rules owasp|secrets|deps|all]` — Returns JSON with confidence-scored findings
- `security:report [--format md|json]` — Generates SECURITY.md from scan results
- `security:baseline [--update]` — Manages known/accepted findings (suppression list)

**Security scanning categories:**
1. **Secrets detection** (HIGH confidence — pattern-based): API keys, tokens, passwords, private keys in source code. Uses regex patterns similar to `skills:validate` 41-pattern scanner already in `src/commands/skills.js`.
2. **OWASP Top 10 patterns** (MEDIUM confidence — heuristic): SQL injection vectors, XSS opportunities, insecure deserialization, path traversal, command injection. AST-based where possible.
3. **Dependency vulnerabilities** (HIGH confidence — data-driven): `npm audit --json`, known CVE checks via package-lock.json analysis.

**Confidence gating:** Every finding has a confidence level (HIGH/MEDIUM/LOW). Only HIGH findings auto-escalate. MEDIUM findings are presented as advisory. LOW findings are suppressed unless `--verbose`.

**Integration with existing modules:**
- `ast.js`: Pattern detection in source code (e.g., `eval()`, `child_process.exec()` with user input)
- `deps.js`: Dependency graph for transitive vulnerability analysis
- `skills.js`: Reuse/extend the 41-pattern security scanner from skill installation validation

---

### Feature 3: Review Readiness Dashboard

**Architecture:** Pure CLI command — no workflow, no agent. This is a data aggregation command that pulls from multiple sources and presents a dashboard.

**Data flow:**
```
/bgsd-readiness [--phase N]
    ↓
commands/bgsd-readiness.md (thin wrapper — runs CLI directly)
    ↓
readiness:dashboard CLI
    ↓ aggregates
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ npm test │ │ lint     │ │ review:  │ │security: │ │ TODO     │
│ results  │ │ results  │ │ analyze  │ │ scan     │ │ count    │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
    ↓ formats
readiness dashboard (TTY table or JSON)
```

**New CLI commands:**
- `readiness:dashboard [--phase N] [--format table|json]` — Aggregated pre-ship status
- `readiness:check [--gate pass|warn]` — CI-mode: exit 0/1 based on readiness thresholds

**Dashboard sections:**
1. Tests: pass/fail/skip counts, coverage % if available
2. Lint: error/warning counts
3. Review: open issues by severity
4. Security: open findings by confidence
5. TODOs: count of TODO/FIXME/HACK comments in codebase
6. Git status: dirty files, unpushed commits

**Integration with existing modules:**
- `format.js`: `formatTable()`, `progressBar()`, `color()`, `box()` for TTY output
- `detect.js`: Tool availability for lint runner detection
- Reuses `review:analyze` and `security:scan` if those CLI commands exist (graceful degradation if not yet built)

---

### Feature 4: Automated Release Workflow (`/bgsd-release`)

**Agent mapping:** The **executor** agent runs release workflows. Rationale: release is a sequence of concrete, ordered steps (bump version, generate changelog, create tag, create PR) — exactly what the executor does. The executor's commit protocol, deviation handling, and checkpoint system all apply.

**Data flow:**
```
/bgsd-release [--type major|minor|patch] [--dry-run]
    ↓
commands/bgsd-release.md (thin wrapper)
    ↓
workflows/release.md (orchestration)
    ↓ calls
release:prepare CLI     →  Version bump, changelog draft
    ↓
executor agent          ←  Reviews changelog, creates commits
    ↓ calls
release:tag CLI         →  Git tag creation
    ↓
release:publish CLI     →  PR creation via gh CLI
    ↓ (checkpoint)
human verification      ←  Review PR before merge
```

**New CLI commands:**
- `release:prepare [--type major|minor|patch] [--dry-run]` — Bumps version in package.json, generates changelog from git log since last tag
- `release:changelog [--since tag|date] [--format md|json]` — Generates changelog from structured git log (uses conventional commit parsing)
- `release:tag [--version X.Y.Z] [--sign]` — Creates annotated git tag
- `release:publish [--draft] [--base main]` — Creates GitHub release PR via `gh` CLI
- `release:validate` — Pre-release checks (tests pass, no dirty files, on correct branch, gh authenticated)

**Version detection:** Reads `package.json` for current version. Applies semver increment. Writes back. Follows existing pattern of `execGit` for all git operations.

**Changelog generation:** Uses `git.structuredLog()` to extract commits since last tag. Parses conventional commit prefixes (feat, fix, chore, docs, refactor). Groups by type. The existing `milestone:auto-changelog` in `complete-milestone` workflow provides a pattern to follow.

**Integration with existing modules:**
- `git.js`: `structuredLog()`, `branchInfo()`, `execGit()` for tag operations
- `detect.js`: `gh-preflight` for GitHub CLI availability check
- Existing `github-ci` workflow pattern for PR creation and merge

---

### Feature 5: Structured Agent Memory (MEMORY.md)

**Architecture:** Three-layer system: CLI writes structured data → plugin reads and injects into prompts → compaction keeps it bounded.

**Data flow:**
```
Agent learns something useful
    ↓
memory:write CLI         →  Appends to MEMORY.md
    ↓
Next agent session starts
    ↓
context-builder.js       ←  Reads MEMORY.md, injects into system prompt
    ↓
Agent sees memory         →  Applies learned patterns
    ↓ (when file grows too large)
memory:compact CLI       →  Consolidates entries, removes stale data
```

**MEMORY.md format:**
```markdown
# Agent Memory

**Last updated:** 2026-03-28
**Entries:** 12

## Project Patterns
<!-- Patterns specific to this project that agents should follow -->
- [pattern]: [description] (learned: [date], source: [agent])

## Error Resolutions  
<!-- Known error→fix mappings for this project -->
- [error pattern]: [resolution] (confidence: HIGH, last seen: [date])

## Performance Hints
<!-- What works well/poorly for this codebase -->
- [hint]: [details] (learned: [date])

## Agent Preferences
<!-- User-confirmed preferences for agent behavior -->
- [preference]: [details] (confirmed: [date])
```

**New CLI commands:**
- `memory:write [--section patterns|errors|hints|preferences] [--entry JSON]` — Append structured entry
- `memory:read [--section all|patterns|errors|hints|preferences] [--format md|json]` — Read memory entries
- `memory:compact [--max-entries N] [--age-days N]` — Consolidate and prune old/low-value entries
- `memory:search [--query text]` — Search memory entries

**Plugin integration — context-builder.js extension:**
- Read MEMORY.md at plugin init (cached, like other planning files)
- Inject relevant entries into `buildSystemPrompt()` as `<agent_memory>` XML block
- Token budget: ~200-400 tokens max for memory injection (configurable in config.json)
- Section filtering: Only inject sections relevant to the current agent type (executor sees performance hints, verifier sees error resolutions, etc.)

**Relationship to existing memory system:**
- Existing `memory.js` manages JSON stores in `.planning/memory/` (decisions, lessons, trajectories, bookmarks) — these are _system_ memory for bGSD's own state
- MEMORY.md is _agent_ memory for cross-session learning — what agents discover about the _target project_
- The two systems are complementary, not competing. MEMORY.md is human-readable, project-committed. JSON stores are machine-optimized, often gitignored.

**Compaction strategy:**
- Max entries per section (configurable, default 20)
- Age-based pruning (entries older than 90 days auto-archived unless marked `sticky: true`)
- Duplicate detection (similar entries consolidated with latest date)
- Size cap: MEMORY.md should stay under 2KB to fit within token budget constraints

---

### Feature 6: Destructive Command Detection (GARD-04)

**Architecture:** Extension of existing `advisory-guardrails.js` with a new guardrail type. Follows the exact same pattern as GARD-01 (conventions), GARD-02 (planning protection), GARD-03 (test suggestions).

**Data flow:**
```
Agent calls bash tool with command
    ↓
plugin hook: tool.execute.after (or tool.execute.before for blocking)
    ↓
advisory-guardrails.js → GARD-04 check
    ↓ matches destructive pattern?
notifier.notify()       →  Warning to user
    ↓ (if blocking mode enabled)
return { blocked: true }  →  Prevents execution
```

**Destructive command patterns (initial set):**

| Category | Patterns | Severity |
|----------|----------|----------|
| File deletion | `rm -rf /`, `rm -rf ~`, `rm -rf .` (recursive on sensitive paths) | CRITICAL |
| Git destructive | `git push --force`, `git reset --hard`, `git clean -fd` | HIGH |
| Database destructive | `DROP TABLE`, `DROP DATABASE`, `TRUNCATE`, `DELETE FROM` (without WHERE) | HIGH |
| Production access | `ssh prod`, `kubectl delete`, `docker rm -f` | HIGH |
| Package publish | `npm publish`, `pip upload` | MEDIUM |
| Environment destructive | `unset PATH`, `export PATH=` | MEDIUM |

**Implementation approach:**
- Extend `onToolAfter` in `advisory-guardrails.js` to also inspect `bash` tool calls (currently only checks `write`/`edit`/`patch`)
- Add `WRITE_TOOLS` → `MONITORED_TOOLS` expansion: include `bash` for GARD-04
- Pattern matching on `input.args.command` for bash tool invocations
- Two modes: `advisory` (default — warn only) and `blocking` (configurable — prevent execution)
- Config: `advisory_guardrails.destructive_commands.enabled`, `advisory_guardrails.destructive_commands.mode` (advisory|blocking), `advisory_guardrails.destructive_commands.patterns` (extensible list)

**Key design decision — `tool.execute.before` vs `tool.execute.after`:**
- For GARD-04, ideally use `tool.execute.before` to _prevent_ execution rather than warn after
- However, the current plugin hooks only register `tool.execute.after` (see `plugin/index.js` hooks)
- Phase 1: Use `tool.execute.after` with strong warning (matches existing pattern)
- Phase 2 (if OC supports it): Migrate to `tool.execute.before` for true blocking
- Note: Check if OC's plugin API supports `tool.execute.before` hook — if yes, use it from the start

**Integration with existing modules:**
- `advisory-guardrails.js`: Direct extension of existing factory function
- `notification.js`: Uses existing `notifier.notify()` for warnings
- `config.js`: Uses existing config parsing for guardrail settings
- No new dependencies — pure pattern matching on command strings

<!-- /section -->

<!-- section: patterns -->
## Architectural Patterns

### Pattern 1: CLI-First Data, Agent-Second Judgment

**What:** CLI commands produce structured JSON analysis; agents consume JSON + source to make judgment calls. The CLI does the deterministic work (pattern matching, metric calculation, structural analysis). The agent does the nuanced work (prioritization, context-aware filtering, user communication).

**When to use:** All new features (review, security, release, readiness).

**Trade-offs:**
- ✅ CLI analysis is testable, fast, deterministic — unit tests cover analysis logic
- ✅ Agent judgment improves with better models — no code changes needed
- ✅ JSON output enables both human CLI usage and agent consumption
- ❌ Two-step process adds complexity vs. single agent doing everything
- ❌ CLI must be built first before workflow can function

**Example:**
```javascript
// review.js — CLI produces structured data
function cmdReviewAnalyze(cwd, options) {
  const findings = [];
  // Deterministic: complexity > threshold → finding
  const complexity = ast.getComplexity(filePath);
  if (complexity.cyclomatic > 15) {
    findings.push({
      type: 'complexity',
      severity: 'major',
      file: filePath,
      metric: complexity.cyclomatic,
      suggestion: 'Extract helper functions to reduce complexity'
    });
  }
  output({ findings, summary: { total: findings.length, ... } });
}
```

### Pattern 2: Agent Reuse via Workflow Specialization

**What:** Instead of creating new agents for code review and security audit, create specialized workflows that guide existing agents (verifier, executor) through domain-specific processes. The workflow is the specialization layer.

**When to use:** Whenever a new capability maps naturally to an existing agent's competency (verification → verifier, sequential execution → executor).

**Trade-offs:**
- ✅ Respects 9-agent cap — no new roles needed
- ✅ Agents inherit existing skills (verification-reference, commit-protocol, etc.)
- ✅ Consistent behavior — same agent patterns, same return formats
- ❌ Workflows must be more detailed to guide agents through unfamiliar territory
- ❌ Verifier agent system prompt may need minor extension for review/security context

**Agent-to-feature mapping:**

| Feature | Agent | Why This Agent |
|---------|-------|----------------|
| Code review | verifier | Review = verification of code quality against standards |
| Security audit | verifier | Security = verification of code against security requirements |
| Release pipeline | executor | Release = sequential execution of ordered steps |
| Memory write | executor | Memory updates happen during plan execution |
| Readiness dashboard | (none) | Pure CLI — no agent needed |
| Destructive detection | (none) | Plugin guardrail — no agent needed |

### Pattern 3: Progressive Trust Guardrails

**What:** New safety features start in advisory mode (warn but allow), then graduate to blocking mode after building user trust. This matches the existing pattern established in v7.0 for review enforcement.

**When to use:** Destructive command detection (GARD-04), and potentially security audit findings in CI mode.

**Trade-offs:**
- ✅ No disruption on day 1 — users see warnings, adapt behavior
- ✅ Configurable — users choose when to enable blocking
- ✅ Matches existing GARD-01/02/03 pattern exactly
- ❌ Advisory-only may be ignored — some destructive commands should be blocked immediately

**Config pattern:**
```json
{
  "advisory_guardrails": {
    "destructive_commands": {
      "enabled": true,
      "mode": "advisory",
      "critical_patterns_block": true
    }
  }
}
```

### Pattern 4: Markdown-as-Interface for Agent Memory

**What:** MEMORY.md uses structured markdown (not JSON, not database) as the persistence format for cross-session agent learning. Human-readable, git-committable, directly injectable into prompts.

**When to use:** Agent memory (MEMORY.md). NOT for system state (use SQLite/JSON for that).

**Trade-offs:**
- ✅ Human-readable — users can review and edit agent memories
- ✅ Git-trackable — memories travel with the repo
- ✅ Direct injection — markdown → system prompt with minimal transformation
- ✅ Matches bGSD philosophy: "human-readable authority + machine-optimized caching"
- ❌ Parsing markdown is fuzzier than parsing JSON
- ❌ Token cost — markdown is less compact than JSON
- ❌ Compaction requires markdown-aware logic

<!-- /section -->

<!-- section: data_flow -->
## Data Flow

### Review Flow (End-to-End)

```
User: /bgsd-review --scope diff
    ↓
command-enricher.js
    ↓ enriches with phase context, review:analyze output
<bgsd-context> includes review_data
    ↓
workflows/review.md
    ↓ Step 1: Run analysis
review:analyze --scope diff --format json
    ↓ returns JSON findings
    ↓ Step 2: Agent reviews
verifier reads findings + source files
    ↓ classifies, prioritizes, batches questions
    ↓ Step 3: User interaction
"These 3 issues need your input: [batched questions]"
    ↓ Step 4: Auto-fix (if approved)
executor applies mechanical fixes
    ↓ Step 5: Report
review:report → writes .planning/REVIEW.md
```

### Security Audit Flow (End-to-End)

```
User: /bgsd-security --scope full
    ↓
workflows/security-audit.md
    ↓ Step 1: Run scans
security:scan --rules all --format json
    ↓ returns confidence-scored findings
    ↓ Step 2: Agent triage
verifier reviews findings, eliminates false positives
    ↓ applies confidence gating (HIGH=escalate, MEDIUM=advisory, LOW=suppress)
    ↓ Step 3: Report
security:report → writes .planning/SECURITY.md
    ↓ Step 4: Baseline management
security:baseline --update (if user approves known/accepted findings)
```

### Release Flow (End-to-End)

```
User: /bgsd-release --type minor
    ↓
workflows/release.md
    ↓ Step 1: Validate
release:validate (tests, clean tree, correct branch, gh auth)
    ↓ Step 2: Prepare
release:prepare --type minor (bump package.json, generate changelog)
    ↓ Step 3: Review (checkpoint)
Present changelog to user for approval
    ↓ Step 4: Tag & commit
executor commits version bump + changelog, creates git tag
    ↓ Step 5: Publish
release:publish (creates GitHub PR via gh CLI)
    ↓ Step 6: Verify (checkpoint)
Human reviews PR before merge
```

### Memory Injection Flow

```
Plugin starts (session init)
    ↓
context-builder.js reads .planning/MEMORY.md
    ↓ parses sections, applies token budget
    ↓ filters by current agent type
buildSystemPrompt() includes <agent_memory> block
    ↓
Every LLM turn sees relevant memories (~200-400 tokens)
    ↓
Agent learns new pattern during execution
    ↓
memory:write --section patterns --entry '{"pattern": "..."}'
    ↓ appends to MEMORY.md
Next session picks up the new memory
```

### Destructive Command Detection Flow

```
Agent calls bash tool
    ↓
plugin hook: tool.execute.after
    ↓
advisory-guardrails.js → onToolAfter()
    ↓ checks: is tool 'bash'?
    ↓ extracts command from args
    ↓ matches against destructive patterns
    ↓ if match found:
notifier.notify({ type: 'advisory-destructive', severity: 'critical', ... })
    ↓
User sees warning in notification channel
```

<!-- /section -->

<!-- section: build_order -->
## Suggested Build Order

Build order is driven by **inter-feature dependencies** and **value delivery speed**.

### Dependency Graph

```
Feature 6 (GARD-04)           ← no dependencies, smallest scope
    ↓ (none)
Feature 5 (MEMORY.md)         ← no dependencies on other features
    ↓ (none)
Feature 3 (Readiness)         ← benefits from review.js + security.js but degrades gracefully
    ↓ (soft dependency)
Feature 1 (Code Review)       ← independent, but readiness uses review:analyze
Feature 2 (Security Audit)    ← independent, but readiness uses security:scan
    ↓ (both complete)
Feature 4 (Release)           ← benefits from readiness:check as pre-release gate
```

### Recommended Phase Structure

| Phase | Feature | Rationale | Estimated Scope |
|-------|---------|-----------|-----------------|
| 1 | **Destructive Command Detection** (GARD-04) | Smallest scope, pure plugin extension, follows existing GARD-01/02/03 pattern exactly. Immediate safety value. | ~2-3 plans |
| 2 | **Structured Agent Memory** (MEMORY.md) | Independent, foundational for agent improvement across all subsequent features. Plugin + CLI work. | ~2-3 plans |
| 3 | **Code Review Workflow** | Core enterprise feature. New CLI module + workflow + skill. Enables readiness dashboard. | ~3-4 plans |
| 4 | **Security Audit Workflow** | Same architecture as review. Can reuse review patterns. Enables readiness dashboard fully. | ~3-4 plans |
| 5 | **Review Readiness Dashboard** | Aggregation layer — maximized by having review + security built first. Pure CLI. | ~1-2 plans |
| 6 | **Automated Release Workflow** | Final feature. Benefits from readiness:check as pre-release validation gate. | ~2-3 plans |

### Why This Order

1. **GARD-04 first:** One file to modify (`advisory-guardrails.js`), one config extension, immediate safety value. Ships in ~1 plan. Builds momentum.

2. **MEMORY.md second:** Independent of all other features but benefits all of them. Once memory is working, agents learning during review/security/release workflows can persist what they learn.

3. **Code review third:** The largest new capability and highest user value. Establishes the "CLI analysis + agent judgment" pattern that security audit will follow.

4. **Security audit fourth:** Follows code review's pattern exactly. ~50% of the architecture decisions carry over. Can share some scanning infrastructure (regex patterns, confidence scoring).

5. **Readiness dashboard fifth:** By this point, both `review:analyze` and `security:scan` exist. The dashboard aggregates their output. Without them, it's a thinner dashboard (just tests + lint + TODOs).

6. **Release last:** Benefits from readiness:check as a pre-release gate. The complete-milestone workflow already tags releases, so this is evolutionary rather than greenfield.

<!-- /section -->

<!-- section: module_inventory -->
## New vs Modified Component Inventory

### New Files

| File | Type | Purpose |
|------|------|---------|
| `src/commands/review.js` | CLI module | Code review analysis commands (`review:analyze`, `review:report`, `review:auto-fix`) |
| `src/commands/security.js` | CLI module | Security scanning commands (`security:scan`, `security:report`, `security:baseline`) |
| `src/commands/release.js` | CLI module | Release pipeline commands (`release:prepare`, `release:changelog`, `release:tag`, `release:publish`, `release:validate`) |
| `src/commands/readiness.js` | CLI module | Review readiness dashboard (`readiness:dashboard`, `readiness:check`) |
| `workflows/review.md` | Workflow | Code review orchestration (drives verifier agent) |
| `workflows/security-audit.md` | Workflow | Security audit orchestration (drives verifier agent) |
| `workflows/release.md` | Workflow | Release pipeline orchestration (drives executor agent) |
| `commands/bgsd-review.md` | Slash command | Thin wrapper for `/bgsd-review` |
| `commands/bgsd-security.md` | Slash command | Thin wrapper for `/bgsd-security` |
| `commands/bgsd-release.md` | Slash command | Thin wrapper for `/bgsd-release` |
| `commands/bgsd-readiness.md` | Slash command | Thin wrapper for `/bgsd-readiness` |
| `skills/review-workflow.md` | Skill | Review-specific guidance loaded by verifier during code review |
| `skills/security-workflow.md` | Skill | Security-specific guidance loaded by verifier during security audit |
| `skills/release-workflow.md` | Skill | Release-specific guidance loaded by executor during release |
| `templates/review-report.md` | Template | REVIEW.md report template |
| `templates/security-report.md` | Template | SECURITY.md report template |
| `test/review.test.js` | Test | Review CLI command tests |
| `test/security.test.js` | Test | Security CLI command tests |
| `test/release.test.js` | Test | Release CLI command tests |
| `test/readiness.test.js` | Test | Readiness CLI command tests |
| `test/guardrails-destructive.test.js` | Test | GARD-04 destructive detection tests |
| `test/memory-structured.test.js` | Test | MEMORY.md read/write/compact tests |

### Modified Files

| File | Modification | Scope |
|------|-------------|-------|
| `src/router.js` | Add routes for `review:*`, `security:*`, `release:*`, `readiness:*` namespaces | Small — add lazy-load entries |
| `src/plugin/advisory-guardrails.js` | Add GARD-04 destructive command detection | Medium — new pattern matcher, extend `onToolAfter` |
| `src/plugin/context-builder.js` | Add MEMORY.md reading and `<agent_memory>` block injection | Medium — new block in `buildSystemPrompt()` |
| `src/plugin/command-enricher.js` | Add review/security context enrichment for new commands | Small — extend enrichment object |
| `src/plugin/index.js` | Register `tool.execute.before` hook if available for GARD-04 blocking | Small — add hook registration |
| `src/commands/memory.js` | Add MEMORY.md structured write/read/compact commands | Medium — new command functions |
| `src/lib/constants.js` | Add COMMAND_HELP entries for new namespaces | Small — data additions |
| `agents/bgsd-verifier.md` | Add skills table entries for review-workflow and security-workflow | Small — 2 lines in skills table |
| `agents/bgsd-executor.md` | Add skills table entry for release-workflow | Small — 1 line in skills table |
| `src/lib/config.js` | Add schema entries for new config options (GARD-04, memory budget) | Small |
| `build.cjs` | Ensure new modules are included in bundle | Small — add to entry points if needed |

### Unchanged (But Consumed)

| File | Used By |
|------|---------|
| `src/lib/ast.js` | review.js (complexity), security.js (pattern detection) |
| `src/lib/git.js` | review.js (diff), release.js (log, tag, branch) |
| `src/lib/deps.js` | review.js (imports), security.js (dependency analysis) |
| `src/lib/format.js` | readiness.js (dashboard formatting) |
| `src/lib/conventions.js` | review.js (naming consistency) |
| `src/lib/detect.js` | release.js (gh preflight), readiness.js (tool availability) |
| `src/plugin/notification.js` | GARD-04 (destructive warnings) |

<!-- /section -->

<!-- section: agent_cap_analysis -->
## Agent Cap Analysis

**Constraint:** Maximum 9 agent roles. Current agents: executor, planner, verifier, debugger, github-ci, roadmapper, codebase-mapper, project-researcher, phase-researcher.

**All 6 features delivered within the cap:**

| Feature | Agent Used | New Agent? | Justification |
|---------|-----------|------------|---------------|
| Code review | **verifier** | No | Code review IS verification — checking code against quality standards |
| Security audit | **verifier** | No | Security audit IS verification — checking code against security requirements |
| Release pipeline | **executor** | No | Release IS execution — sequential ordered steps with commits |
| Agent memory | **executor** (writes) + **plugin** (reads) | No | CLI writes during execution; plugin reads at session start |
| Readiness dashboard | **(none)** | No | Pure CLI command — no agent involvement |
| Destructive detection | **(none)** | No | Plugin guardrail — no agent involvement |

**Why this works:** The existing agent roles are defined by *competency* not *domain*:
- **Verifier** = "checks if something meets criteria" → applies to phase goals, code quality, security
- **Executor** = "performs ordered sequence of steps" → applies to plans, releases, memory updates
- **Plugin** = "always-on background intelligence" → applies to context injection, guardrails

The differentiation comes from **workflows** (which define the domain-specific process) and **skills** (which provide domain-specific knowledge). The agent provides the competency; the workflow provides the context.

**Verifier agent extension:** The verifier agent system prompt needs minimal changes. Add 2 entries to its skills table:
```markdown
| review-workflow | Code review analysis patterns and question batching | When running /bgsd-review | — |
| security-workflow | OWASP patterns, secrets scanning, confidence scoring | When running /bgsd-security | — |
```
These skills are loaded on-demand — they don't increase the verifier's base token cost.

<!-- /section -->

<!-- section: anti_patterns -->
## Anti-Patterns

### Anti-Pattern 1: Creating New Agent Roles

**What people do:** Create a `bgsd-reviewer` agent and a `bgsd-security-auditor` agent to handle review and security features.
**Why it's wrong:** Violates the 9-agent cap (PROJECT.md: "Agent role explosion — Cap at 9 roles; intelligence = data, not agents"). Each new agent adds coordination overhead, model costs, and system prompt maintenance burden.
**Do this instead:** Reuse the verifier agent with specialized workflows and skills. The verifier already knows how to check things against criteria — just change what criteria it's checking.

### Anti-Pattern 2: Hardcoding Security Patterns

**What people do:** Embed regex patterns for secrets detection directly in the workflow markdown.
**Why it's wrong:** Patterns need to be testable, versionable, and extensible. Workflow markdown is for agent orchestration, not data.
**Do this instead:** Put patterns in `security.js` CLI module as a data structure. Expose via `security:scan` JSON output. The workflow calls the CLI and acts on results.

### Anti-Pattern 3: Blocking Guardrails Without Progressive Trust

**What people do:** Ship GARD-04 in blocking mode from day 1, preventing all destructive commands.
**Why it's wrong:** False positives will frustrate users. `rm -rf dist/` is perfectly safe; `rm -rf /` is catastrophic. The patterns need tuning before they should block.
**Do this instead:** Ship in advisory mode. Track false positive rate. Graduate to blocking for CRITICAL patterns only after validation. Allow per-pattern mode overrides.

### Anti-Pattern 4: Memory Without Compaction

**What people do:** Append to MEMORY.md indefinitely, growing the file to thousands of tokens.
**Why it's wrong:** Every token in MEMORY.md is injected into every LLM turn. 2KB of memory = ~500 tokens per turn. At 50 turns per session, that's 25K extra tokens wasted.
**Do this instead:** Hard cap at 2KB. Auto-compact when exceeding limit. Prune old entries. Deduplicate. Users can mark entries as `sticky` to protect them from compaction.

### Anti-Pattern 5: Monolithic Review/Security Workflows

**What people do:** Create a single workflow that does analysis, reporting, auto-fixing, and user interaction in one pass.
**Why it's wrong:** Workflows should be composable. A user might want just the analysis (CI mode), just the report (documentation), or the full interactive experience. Monolithic workflows can't be partially invoked.
**Do this instead:** CLI commands for each step (analyze, report, auto-fix). Workflow orchestrates the full flow. Each step is independently callable.

<!-- /section -->

<!-- section: integration -->
## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| GitHub (via `gh` CLI) | `detect:gh-preflight` → `gh pr create`, `gh release create` | Already established in github-ci workflow. Release workflow reuses this pattern. |
| npm registry | `npm audit --json` for dependency vulnerabilities | Read-only. No publishing (out of scope per PROJECT.md). |
| Git | `execGit()` for all operations — tags, log, diff, branch | Already comprehensive in `git.js`. Release adds tag creation. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| CLI ↔ Plugin | JSON over stdout (CLI output) and file system (.planning/) | Standard pattern. New commands follow existing convention. |
| Plugin ↔ Agent | `<bgsd-context>` XML block in system prompt | command-enricher.js already handles this. Extend for review/security data. |
| Agent ↔ Workflow | Workflow markdown defines process; agent follows steps | New workflows follow existing patterns (verify-work, github-ci). |
| Workflow ↔ Skill | On-demand skill loading via `<skill:name />` | New skills (review-workflow, security-workflow, release-workflow) loaded only when needed. |
| MEMORY.md ↔ Plugin | File read by context-builder.js, parsed as markdown | New integration point. Uses existing caching patterns from state/roadmap parsers. |
| GARD-04 ↔ Plugin | Extends existing `onToolAfter` hook in advisory-guardrails.js | Minimal new integration — follows GARD-01/02/03 pattern exactly. |

### Cross-Feature Integration

| Integration | Description |
|-------------|-------------|
| readiness ← review + security | Readiness dashboard aggregates review:analyze and security:scan output |
| release ← readiness | Release workflow calls readiness:check as pre-release validation gate |
| memory ← all features | All agents can write memories during any workflow execution |
| GARD-04 ← all agents | Destructive command detection applies to all agent bash calls |

<!-- /section -->

## Sources

- Existing bGSD architecture: `src/plugin/index.js`, `src/plugin/advisory-guardrails.js`, `src/plugin/context-builder.js`
- Agent definitions: `agents/bgsd-verifier.md`, `agents/bgsd-executor.md`
- Plugin hook system: `src/plugin/safe-hook.js`, plugin.js (bundled output)
- Existing patterns: `src/commands/verify.js` (2832 lines), `src/commands/memory.js` (433 lines), `src/commands/lessons.js` (726 lines)
- Decision architecture: `src/lib/decision-rules.js` (878 lines)
- Git integration: `src/lib/git.js` (392 lines)
- Skills system: 30 skills in `skills/` directory
- PROJECT.md: Agent cap constraint, architecture decisions, out-of-scope items

---
*Architecture research for: bGSD v16.0 Enterprise Developer Team Features*
*Researched: 2026-03-28*
