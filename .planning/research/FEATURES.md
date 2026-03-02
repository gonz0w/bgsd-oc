# Feature Research

**Domain:** CLI performance optimization, agent architecture, and developer experience for AI-driven planning tool
**Researched:** 2026-03-01
**Confidence:** HIGH

<!-- section: compact -->
<features_compact>
<!-- Compact view for planners. Keep under 30 lines. -->

**Table stakes (must have):**
- SQLite read cache with git-hash staleness — eliminates redundant markdown parsing across invocations
- Agent responsibility matrix (RACI) — documents exactly which agent owns each lifecycle phase, no overlap
- Subcommand consolidation — group 85 switch cases under ~12 top-level commands with consistent grammar
- Performance profiler expansion — extend existing GSD_PROFILE to cover hot paths (markdown parsing, git ops, AST)
- Cache invalidation on file write — any write to cached file must invalidate the cache entry
- Deterministic agent context loading — replace ad-hoc file reads with manifest-driven context assembly

**Differentiators:**
- Prepared-statement cache for repeated queries — SQLite prepared statements cached across invocations
- Agent lifecycle coverage audit with gap/overlap detection — automated report showing uncovered lifecycle steps
- Milestone documentation generation — auto-generate CHANGELOG.md section from git log + STATE.md decisions
- Command alias backward compatibility — old command names route to new subcommand homes

**Defer (v2+):** Full async I/O rewrite, agent self-spawning, runtime MCP connections, cross-project cache sharing

**Key dependencies:** Cache layer requires existing `cachedReadFile` + `codebase-intel.js` patterns; Agent matrix requires context.js AGENT_MANIFESTS; Subcommand grouping requires router.js refactor; Profiler requires existing profiler.js
</features_compact>
<!-- /section -->

<!-- section: feature_landscape -->
## Feature Landscape

### Table Stakes (Users Expect These)

Features the v8.0 milestone must deliver. Missing these = milestone goals unmet.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **SQLite read cache layer** | Markdown files parsed identically across invocations; current Map cache dies with process | MEDIUM | `better-sqlite3` (bundled via esbuild) or Node.js built-in `node:sqlite` (release candidate in v25.7). Store parsed JSON representations keyed by filepath + git hash. Markdown stays authoritative; cache is disposable derivative. |
| **Cache staleness detection via git hash** | Cache must not serve stale data after file edits | LOW | Use `git hash-object <file>` or `fs.statSync().mtimeMs` as cache key. Git hash preferred — deterministic, content-addressed. Existing `codebase-intel.js` already uses git-hash watermarks (proven pattern). |
| **Cache invalidation on write** | Any CLI command that writes to STATE.md/ROADMAP.md must invalidate the cache entry | LOW | Hook into existing `invalidateFileCache()` in helpers.js. Extend to also invalidate SQLite row for same path. |
| **Agent responsibility matrix** | 12 agents exist but no single document maps which agent owns which lifecycle step; overlap between planner/plan-checker, verifier/reviewer unclear | MEDIUM | RACI matrix: rows = lifecycle steps (research, plan, execute, verify, review, commit, wrapup), columns = 12 agent roles. Produce as CLI data (`gsd-tools agents matrix`), not a new agent. Depends on: `context.js` AGENT_MANIFESTS, `constants.js` MODEL_PROFILES. |
| **Deterministic context loading** | Current init commands assemble context ad-hoc with conditional includes; agents sometimes get too much or too little | MEDIUM | Extend AGENT_MANIFESTS with `files` array (exact file paths to load) alongside existing `fields` array. Context builder reads manifest → loads files → assembles payload. Removes guesswork. Depends on: `context.js`, `init.js`. |
| **Subcommand consolidation** | 85 switch cases in router.js, 40+ top-level commands, inconsistent naming (e.g., `codebase-impact` vs `codebase impact`, `mcp-profile` vs `mcp profile`) | HIGH | Group under ~12 namespaces: `state`, `phase`, `roadmap`, `verify`, `codebase`, `memory`, `intent`, `env`, `git`, `trajectory`, `config`, `init`. Keep old names as aliases for backward compat. Router refactor is the largest code change. |
| **Performance profiler hot-path coverage** | Existing profiler.js covers command-level timing but not sub-operations (markdown parsing, git execSync calls, AST analysis) | LOW | Add `startTimer`/`endTimer` calls to: `helpers.js` (file reads), `git.js` (execGit), `ast.js` (acorn parse), `frontmatter.js` (YAML extract). Report as nested timings under command timer. Zero cost when GSD_PROFILE unset. |
| **Baseline comparison reporting** | Need to prove performance improved; current baselines are raw JSON with no comparison tool | LOW | `gsd-tools profiler compare --before <file> --after <file>`. Diff timings, highlight regressions/improvements. Depends on: `profiler.js`, `format.js`. |

### Differentiators (Competitive Advantage)

Features that make v8.0 more than "just faster." High value, not strictly required.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Agent lifecycle gap/overlap report** | Automated audit: scan all agent manifests + workflows, produce report showing which lifecycle steps have no owner (gaps) and which have multiple owners (overlaps) | MEDIUM | CLI command `gsd-tools agents audit`. Reads AGENT_MANIFESTS + workflow .md files. Outputs table: step × agent × role (R/A/C/I). Flags gaps (no R) and overlaps (multiple R). Depends on: `context.js`, workflow directory scan. |
| **Milestone documentation generation** | Auto-generate milestone summary from git history + STATE.md decisions + test metrics | MEDIUM | `gsd-tools milestone docs` or integrated into `wrapup-milestone` workflow. Collects: git log since milestone start, decisions from STATE.md, requirement completion from ASSERTIONS.md, test counts, bundle size delta. Renders markdown section for CHANGELOG or release notes. Depends on: `git.js`, `state.js`, `verify.js`. |
| **SQLite prepared-statement caching** | For repeated queries (e.g., "get all phase plans"), cache the prepared statement across calls within same invocation | LOW | `better-sqlite3` natively supports this. Node.js `node:sqlite` has `createTagStore()` for LRU prepared-statement cache. Already proven pattern. |
| **Command alias backward compatibility layer** | Old flat commands (`config-set`, `mcp-profile`, `codebase-impact`) transparently route to new namespaced commands | LOW | Alias map in router.js: `'config-set' → ['config', 'set']`. Zero user disruption. Deprecation warnings after 2 versions. |
| **Parsed-result cache (JSON cache)** | Don't just cache raw file content — cache the parsed JSON result of markdown parsing | MEDIUM | Key = filepath + git-hash + parse-function-name. Value = parsed JSON. Eliminates regex parsing on cache hit. Biggest performance win for `init` commands that parse ROADMAP.md, STATE.md, PLAN.md in sequence. |
| **Agent context token budget enforcement** | Each manifest declares a max token budget; context builder truncates/summarizes if payload exceeds budget | MEDIUM | Extend AGENT_MANIFESTS with `maxTokens: number`. Use existing `estimateTokens()` to check. If over budget, drop optional fields first, then truncate large fields. Depends on: `context.js`, `estimateTokens`. |
| **Cache warm-up command** | `gsd-tools cache warm` pre-populates the SQLite cache by parsing all planning files | LOW | Walk `.planning/` directory, parse each file, store result in cache. Useful after git pull or checkout. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems in this specific architecture.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Full async I/O rewrite** | "Sync I/O is slow" | CLI process lives <5s. Async adds complexity (promises, error handling) for zero user-perceived benefit. Every `execSync` call is inherently blocking (git, test runners). PROJECT.md explicitly lists this as out of scope. | Profile first; optimize hot paths with caching. |
| **SQLite as primary store (replacing markdown)** | "Markdown is slow to parse" | Markdown is human-readable, git-diffable, and the authoritative source. SQLite binary files can't be meaningfully diffed. Users read/edit STATE.md and ROADMAP.md directly. | Cache layer: markdown authoritative, SQLite as read-only derived cache. |
| **Cross-invocation in-memory cache (daemon mode)** | "Keep parsed data in memory between CLI calls" | Requires long-running daemon process, IPC, lifecycle management. The tool is invoked by AI agents — it can't assume a daemon is running. Massive architectural change for marginal gain. | SQLite file cache persists between invocations without a daemon. |
| **Dynamic agent spawning / agent count increase** | "Let agents create new agents for subtasks" | PROJECT.md caps agents at 12. Coordination overhead grows quadratically. Intelligence should come from better data, not more agents. | Improve existing agents' data feeds via cache + context optimization. |
| **Commander.js / yargs migration for CLI parsing** | "Use a proper CLI framework" | Adds ~200KB dependency, breaks single-file zero-dep architecture. Current manual parsing works for 100+ commands. `--help` already implemented. | Keep manual parsing but improve router structure with nested dispatch tables. |
| **Real-time file watching for cache invalidation** | "Watch for changes and invalidate automatically" | Requires `fs.watch` / chokidar, long-running process, platform-specific quirks. CLI is short-lived. | Staleness check on read: compare git-hash at read time. Cheap and correct. |
| **RAG / vector search for codebase queries** | "Semantic search over codebase" | Wrong architecture. GSD is a CLI tool, not a search engine. Vector DBs need embedding models, storage, query infrastructure. AI coding assistant already has semantic search via its own tools. | Keep codebase-intel.js for structural analysis. Leave semantic search to the host editor. |
<!-- /section -->

<!-- section: dependencies -->
## Feature Dependencies

```
[SQLite cache module]
    └──requires──> [Cache staleness detection (git-hash keying)]
                       └──requires──> [git.js execGit for hash-object]
    └──requires──> [Cache invalidation on write]
                       └──requires──> [helpers.js invalidateFileCache extension]

[Parsed-result cache]
    └──requires──> [SQLite cache module]
    └──requires──> [Deterministic parse function signatures]

[Cache warm-up command]
    └──requires──> [SQLite cache module]
    └──requires──> [Parsed-result cache]

[Agent responsibility matrix]
    └──requires──> [context.js AGENT_MANIFESTS audit]

[Agent lifecycle gap/overlap report]
    └──requires──> [Agent responsibility matrix]
    └──requires──> [Workflow directory scanning]

[Deterministic context loading]
    └──requires──> [Agent responsibility matrix]
    └──enhances──> [SQLite cache module] (cached context assembly)

[Agent context token budget enforcement]
    └──requires──> [Deterministic context loading]
    └──requires──> [context.js estimateTokens]

[Subcommand consolidation]
    └──requires──> [Command alias backward compatibility layer]

[Milestone documentation generation]
    └──requires──> [git.js structuredLog]
    └──requires──> [state.js decision extraction]

[Performance profiler expansion]
    └──enhances──> [SQLite cache module] (measure cache hit/miss rates)
    └──requires──> [profiler.js existing infrastructure]

[Baseline comparison reporting]
    └──requires──> [Performance profiler expansion]
```

### Dependency Notes

- **[SQLite cache module] requires [Cache staleness detection]:** Without staleness detection, cache serves stale data. This is a hard requirement — cache without invalidation is worse than no cache.
- **[Parsed-result cache] requires [SQLite cache module]:** Raw file caching is the foundation; parsed results are the optimization layer on top.
- **[Agent lifecycle report] requires [Agent responsibility matrix]:** Can't detect gaps/overlaps without first defining what each agent should own.
- **[Deterministic context loading] enhances [SQLite cache]:** Once context is deterministic, the exact files needed can be pre-cached, making context assembly O(1) lookups.
- **[Subcommand consolidation] requires [Alias backward compat]:** Can't rename commands without an alias layer or users' workflows break.
- **[Profiler expansion] enhances [SQLite cache]:** Profiling measures cache effectiveness — hit rate, time saved, staleness check overhead.
<!-- /section -->

<!-- section: mvp -->
## MVP Definition

### Phase 1: Cache Foundation + Profiler (Must ship first)

Essential infrastructure that every subsequent feature builds on.

- [ ] **SQLite cache module** — `src/lib/cache.js` with open/close/get/set/invalidate. Use `better-sqlite3` (bundled via esbuild, ~300KB addition to bundle). Node.js built-in `node:sqlite` is release candidate (v25.7) but still needs `--experimental-sqlite` flag on older Node — too risky for production CLI tool on Node 18+.
- [ ] **Cache staleness via git-hash** — `git hash-object <file>` result stored as cache key. On read, compare stored hash to current hash. Stale → re-parse and update cache.
- [ ] **Cache invalidation on write** — Extend `invalidateFileCache()` to also clear SQLite row. Any state/roadmap/plan write clears cache for that file.
- [ ] **Profiler hot-path instrumentation** — Add timing to: file reads, git operations, markdown parsing, AST analysis. Enables data-driven optimization.
- [ ] **Baseline comparison CLI** — `gsd-tools profiler compare` to diff before/after baselines.

### Phase 2: Agent Architecture (Builds on cache)

Audit and optimize agent context delivery.

- [ ] **Agent responsibility matrix** — RACI matrix as CLI data. Map 12 agents × lifecycle steps.
- [ ] **Deterministic context loading** — Extend AGENT_MANIFESTS with file declarations. Context builder uses manifest to assemble payload.
- [ ] **Agent lifecycle gap/overlap report** — Automated audit producing formatted table of coverage.
- [ ] **Agent context token budget** — Manifests declare max tokens; builder enforces.

### Phase 3: Command Consolidation + Docs (Polish)

Developer experience improvements.

- [ ] **Subcommand consolidation** — Refactor router.js to nested dispatch. ~12 top-level namespaces.
- [ ] **Command alias backward compat** — Map old names to new. Deprecation warnings.
- [ ] **Milestone documentation generation** — Auto-generate milestone summary in wrapup workflow.
- [ ] **Cache warm-up command** — `gsd-tools cache warm` for post-checkout optimization.

### Future Consideration (v9+)

Features to defer until v8.0 proves the cache/architecture patterns.

- [ ] **Parsed-result cache** — Cache parsed JSON, not just raw file content. Depends on cache proving effective.
- [ ] **Cross-project cache patterns** — Share cache schema across multiple GSD projects.
- [ ] **Agent context condensation** — When over budget, auto-summarize stale context rather than truncating.
- [ ] **Cache analytics dashboard** — Hit rates, miss reasons, space usage over time.
<!-- /section -->

<!-- section: prioritization -->
## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| SQLite read cache layer | HIGH | MEDIUM | P1 |
| Cache staleness detection | HIGH | LOW | P1 |
| Cache invalidation on write | HIGH | LOW | P1 |
| Profiler hot-path coverage | HIGH | LOW | P1 |
| Agent responsibility matrix | HIGH | MEDIUM | P1 |
| Deterministic context loading | HIGH | MEDIUM | P1 |
| Subcommand consolidation | HIGH | HIGH | P1 |
| Command alias backward compat | MEDIUM | LOW | P1 |
| Baseline comparison reporting | MEDIUM | LOW | P2 |
| Agent lifecycle gap/overlap report | MEDIUM | MEDIUM | P2 |
| Milestone documentation generation | MEDIUM | MEDIUM | P2 |
| Agent context token budget | MEDIUM | MEDIUM | P2 |
| Parsed-result cache | HIGH | MEDIUM | P2 |
| Cache warm-up command | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for v8.0 launch — directly addresses milestone goals
- P2: Should have, add when cache/architecture foundation is stable
- P3: Nice to have, future consideration
<!-- /section -->

<!-- section: implementation_details -->
## Implementation Detail Notes

### SQLite Technology Choice

**Recommendation: `better-sqlite3`** over Node.js built-in `node:sqlite`.

| Criterion | `better-sqlite3` | `node:sqlite` (built-in) |
|-----------|-------------------|--------------------------|
| Stability | Mature, 114M+ weekly downloads | Release candidate (v25.7.0) |
| Node 18+ compat | Yes, native addon | No — requires Node 22.5+ and `--experimental-sqlite` flag |
| API | Synchronous (perfect for CLI) | Synchronous (same) |
| Bundle via esbuild | Yes, native addon handled by esbuild `external` + copy | N/A (built-in) |
| Performance | 2-5x faster than node:sqlite in benchmarks | Still optimizing |
| Size impact | ~2MB native addon (platform-specific) | Zero (built-in) |

**Risk:** `better-sqlite3` is a native C++ addon. This means platform-specific binaries, potential build issues, and deploy.sh complexity. **Mitigation:** esbuild marks it as `external`, and `npm install` handles the native build. The deploy.sh script already copies the built bundle.

**Alternative if native addon is too heavy:** Use Node.js built-in `node:sqlite` with a minimum Node 22.5+ requirement (check at runtime, fall back to Map cache on older Node). This eliminates the native addon but narrows platform support.

**Simplest viable option:** Enhanced in-memory Map cache with JSON serialization to `.planning/cache/cache.json`. No native deps, no version constraints, still persists across invocations. Less performant than SQLite for large datasets but simpler. **This may be sufficient** given CLI invocations are <5s and the planning directory is <100 files.

### Cache Schema

```sql
CREATE TABLE file_cache (
  filepath TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL,       -- git hash-object result
  raw_content TEXT,                  -- raw file content (optional)
  parsed_json TEXT,                  -- JSON.stringify of parsed result
  parse_type TEXT,                   -- 'frontmatter' | 'state' | 'roadmap' | 'plan'
  cached_at INTEGER NOT NULL,       -- Date.now()
  access_count INTEGER DEFAULT 1    -- for analytics
);

CREATE INDEX idx_cache_hash ON file_cache(content_hash);
```

### Subcommand Grouping Plan

Current 40+ top-level commands consolidated into ~12 namespaces:

| Namespace | Subcommands | Currently |
|-----------|-------------|-----------|
| `state` | load, get, update, patch, advance-plan, update-progress, record-metric, add-decision, add-blocker, resolve-blocker, record-session, validate, snapshot | Already grouped ✓ |
| `verify` | plan-structure, phase-completeness, references, commits, artifacts, key-links, analyze-plan, deliverables, requirements, regression, plan-wave, plan-deps, quality, summary | Mostly grouped ✓ |
| `phase` | next-decimal, add, insert, remove, complete, list | Already grouped ✓ |
| `roadmap` | get-phase, analyze, update-plan-progress | Already grouped ✓ |
| `codebase` | analyze, status, conventions, rules, deps, impact, context, lifecycle, ast, exports, complexity, repo-map | Already grouped ✓ |
| `memory` | write, read, list, ensure-dir, compact | Already grouped ✓ |
| `intent` | create, show, read, update, validate, trace, drift | Already grouped ✓ |
| `trajectory` | checkpoint, list, pivot, compare, choose, dead-ends | Already grouped ✓ |
| `git` | log, diff-summary, blame, branch-info, rewind, trajectory-branch | Already grouped ✓ |
| `config` | set, get, ensure-section, migrate, validate | **NEEDS GROUPING** — currently `config-set`, `config-get`, `config-ensure-section`, `config-migrate`, `validate-config` |
| `init` | execute-phase, plan-phase, new-project, new-milestone, quick, resume, verify-work, phase-op, todos, milestone-op, map-codebase, progress, memory | Already grouped ✓ |
| `misc` | commit, scaffold, template, generate-slug, current-timestamp, progress, review, tdd, classify | **NEEDS GROUPING** — these are top-level orphans |

**Key insight from audit:** Most commands are already grouped! The consolidation work is primarily:
1. Move `config-*` commands under `config` namespace (4 commands)
2. Move orphan commands: `codebase-impact` → `codebase impact`, `mcp-profile` → `mcp profile`, `validate-config` → `config validate`
3. Group remaining misc top-level commands under appropriate namespaces
4. Add alias map for backward compat

**Estimated scope:** ~15-20 commands need relocating. Not 85. The router.js refactor is smaller than it initially appears.

### Agent Responsibility Matrix Structure

Lifecycle steps mapped to the 12 agents:

| Lifecycle Step | researcher | planner | plan-checker | executor | verifier | reviewer | synthesizer | debugger | roadmapper | phase-researcher | integration-checker | codebase-mapper |
|---------------|------------|---------|--------------|----------|----------|----------|-------------|----------|------------|-------------------|---------------------|-----------------|
| Research | **R** | C | - | - | - | - | A | - | - | **R** | - | - |
| Plan creation | I | **R/A** | - | - | - | - | - | - | I | - | - | C |
| Plan review | - | C | **R/A** | - | - | - | - | - | - | - | I | - |
| Execution | - | - | - | **R/A** | - | - | - | C | - | - | - | - |
| Verification | - | - | - | - | **R/A** | - | - | - | - | - | C | - |
| Code review | - | - | - | - | - | **R/A** | - | - | - | - | - | C |
| Debugging | - | - | - | C | - | - | - | **R/A** | - | - | - | - |
| Roadmap mgmt | - | I | - | - | - | - | - | - | **R/A** | - | - | - |
| Codebase map | - | - | - | - | - | - | - | - | - | - | - | **R/A** |
| Integration | - | - | - | - | - | - | - | - | - | - | **R/A** | - |
| Synthesis | - | - | - | - | - | - | **R/A** | - | - | - | - | - |

**R** = Responsible, **A** = Accountable, **C** = Consulted, **I** = Informed

**Identified gaps:** No agent explicitly owns milestone wrapup or documentation generation. The synthesizer is closest but currently scoped to research synthesis only.

**Identified overlaps:**
- Verifier and reviewer both check output quality (different angles: goal completion vs code quality — this is intentional, per Superpowers/Aider patterns)
- Planner and roadmapper both modify roadmap structure (planner within phase, roadmapper across phases — needs clearer boundary)
<!-- /section -->

<!-- section: competitors -->
## Competitor Feature Analysis

| Feature | Aider | SWE-agent | OpenHands | GSD v7.1 | GSD v8.0 Target |
|---------|-------|-----------|-----------|----------|-----------------|
| Persistent cache | Repo map cached, rebuilt on changes | No caching layer | Event store (not cache) | In-memory Map (dies with process) | SQLite read cache |
| Agent responsibility docs | N/A (single agent) | N/A (single agent) | Event-typed actions | 12 agents, manifests | RACI matrix + gap audit |
| Subcommand grouping | `/code`, `/ask`, `/architect` | Single CLI | SDK with typed tools | 40+ top-level commands | ~12 namespaces |
| Performance profiling | Benchmarks on website | SWE-bench scores | Event timing | GSD_PROFILE opt-in | Hot-path instrumentation |
| Context optimization | Repo map (~1k tokens) | Truncated search | Context condensation | Agent manifests (40-60% reduction) | Deterministic loading + budget enforcement |
| Documentation generation | Commit messages only | N/A | N/A | Manual | Auto milestone docs |

## Sources

- Node.js `node:sqlite` docs (v25.7.0): https://nodejs.org/api/sqlite.html — Release candidate status, synchronous API, `createTagStore()` for prepared-statement caching [HIGH confidence]
- `better-sqlite3` docs via Context7: https://github.com/wiselibs/better-sqlite3 — WAL mode, prepared statements, performance tuning [HIGH confidence]
- Commander.js subcommand patterns: https://github.com/tj/commander.js — Nested subcommand structure, stand-alone executables [HIGH confidence]
- Node.js CLI best practices: https://github.com/lirantal/nodejs-cli-apps-best-practices — Subcommand organization, help generation [HIGH confidence]
- RACI matrix methodology: https://asana.com/resources/raci-chart — Responsibility assignment for multi-agent systems [HIGH confidence]
- GSD existing codebase audit: `router.js` (947 lines, 85 switch cases), `context.js` (389 lines, 6 agent manifests), `helpers.js` (946 lines, file/dir cache), `profiler.js` (116 lines) [HIGH confidence — primary source]
- GSD AGENTIC-AUDIT.md: Prior research on Superpowers, Aider, SWE-agent, OpenHands review patterns [HIGH confidence]

---
*Feature research for: bGSD v8.0 Performance & Agent Architecture*
*Researched: 2026-03-01*
